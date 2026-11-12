import type { Page } from "@playwright/test";

const CLIP_SIZE_PIXELS = 64;
const CLIP_MILLISECONDS = 3000;
const CLIP_FRAME_RATE = 30;
const CLIP_FRAME_MILLISECONDS = 33;
const CLIP_HUE_STEP_DEGREES = 12;

/** A short WebM generated in the page, so no video file is ever stored (V19 J14). */
async function generateClipBase64(page: Page): Promise<string> {
  return page.evaluate(
    async ({ size, milliseconds, frameRate, frameMilliseconds, hueStep }) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d")!;
      const recorder = new MediaRecorder(canvas.captureStream(frameRate), {
        mimeType: "video/webm",
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      let frame = 0;
      const timer = setInterval(() => {
        context.fillStyle = `hsl(${(frame * hueStep) % 360}, 80%, 50%)`;
        context.fillRect(0, 0, size, size);
        frame += 1;
      }, frameMilliseconds);
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
      clearInterval(timer);
      recorder.stop();
      await stopped;
      const bytes = new Uint8Array(
        await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
      );
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    {
      size: CLIP_SIZE_PIXELS,
      milliseconds: CLIP_MILLISECONDS,
      frameRate: CLIP_FRAME_RATE,
      frameMilliseconds: CLIP_FRAME_MILLISECONDS,
      hueStep: CLIP_HUE_STEP_DEGREES,
    },
  );
}

/** Opens the tagger's video input with a generated clip and enters its presented frame rate. */
export async function loadTestClip(page: Page): Promise<void> {
  const base64 = await generateClipBase64(page);
  await page.locator('input[type="file"][accept="video/*"]').setInputFiles({
    name: "clip.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(base64, "base64"),
  });
  await page.getByLabel(/presented frame rate/i).fill(String(CLIP_FRAME_RATE));
}

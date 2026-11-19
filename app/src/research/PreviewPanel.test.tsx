import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { unsafeFixture } from "../test/fixture";
import { AUTHORED_MONSTER_FILES } from "../game/config/data";
import { encounterConfigOf } from "../game/config/encounter";
import { HELP_SECTION_PREVIEW } from "./helpText";
import { PreviewPanel } from "./PreviewPanel";
import { drawEmptyPreview, drawPreviewFrame } from "./previewDraw";
import { PREVIEW_SIZE_PIXELS } from "./previewPreference";
import type { StudyV6 } from "./study";
import { emptyStudy } from "./studyMigrate";

// The canvas drawer is stubbed: these tests assert what the panel hands it.
vi.mock("./previewDraw", () => ({ drawPreviewFrame: vi.fn(), drawEmptyPreview: vi.fn() }));

const config = encounterConfigOf("killer-bee-queen");

const study: StudyV6 = emptyStudy({
  encounterId: "killer-bee-queen",
  archetypeId: "killer-bee-queen",
  provenance: { sourceUrl: null, fileName: "x.mp4", frameRate: 30, durationSeconds: 100 },
  recordedAt: "2026-11-16T00:00:00.000Z",
  rawFile: AUTHORED_MONSTER_FILES["killer-bee-queen"],
});

const LAYOUT = { shown: true, size: "medium", videoSize: "medium" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(unsafeFixture<CanvasRenderingContext2D>({}));
});

function renderPanel(props: Partial<Parameters<typeof PreviewPanel>[0]> = {}) {
  const onLayoutChange = vi.fn();
  render(
    <PreviewPanel
      study={study}
      windows={[]}
      mediaTime={0}
      hasVideo
      config={config}
      selectedTrackIndex={null}
      layout={LAYOUT}
      onLayoutChange={onLayoutChange}
      {...props}
    />,
  );
  return { onLayoutChange };
}

test("draws the model's frame onto the canvas when a video is open", () => {
  renderPanel();
  expect(drawPreviewFrame).toHaveBeenCalled();
  const [, frame, , pixels, highlighted] = vi.mocked(drawPreviewFrame).mock.calls.at(-1)!;
  expect(frame.projectiles).toBeInstanceOf(Array);
  expect(pixels).toBe(PREVIEW_SIZE_PIXELS.medium);
  expect(highlighted).toEqual([]);
  expect(drawEmptyPreview).not.toHaveBeenCalled();
});

test("without a video it draws the empty preview and says to open one", () => {
  renderPanel({ hasVideo: false });
  expect(drawEmptyPreview).toHaveBeenCalled();
  expect(drawPreviewFrame).not.toHaveBeenCalled();
  expect(screen.getByText("Open a video to see the preview")).toBeInTheDocument();
});

test("a selected track is handed to the drawer as highlighted", () => {
  renderPanel({ selectedTrackIndex: 2 });
  expect(vi.mocked(drawPreviewFrame).mock.calls.at(-1)![4]).toEqual([2]);
});

test("the canvas is sized from the layout", () => {
  renderPanel({ layout: { ...LAYOUT, size: "large" } });
  const canvas = screen.getByLabelText("Tag preview canvas");
  expect(canvas).toHaveAttribute("width", String(PREVIEW_SIZE_PIXELS.large));
});

test("Hide preview reports a hidden layout and a hidden panel has no canvas", async () => {
  const user = userEvent.setup();
  const { onLayoutChange } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Hide preview" }));
  expect(onLayoutChange).toHaveBeenCalledWith({ ...LAYOUT, shown: false });
});

test("a hidden preview offers Show preview and no canvas", () => {
  renderPanel({ layout: { ...LAYOUT, shown: false } });
  expect(screen.getByRole("button", { name: "Show preview" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByLabelText("Tag preview canvas")).not.toBeInTheDocument();
});

test("choosing a size reports it", async () => {
  const user = userEvent.setup();
  const { onLayoutChange } = renderPanel();
  await user.click(screen.getByRole("button", { name: "Small" }));
  expect(onLayoutChange).toHaveBeenCalledWith({ ...LAYOUT, size: "small" });
  expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");
});

test("the panel draws one thing and offers no draw-mode toggle (plan V23 Q17)", () => {
  renderPanel();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Draw" })).not.toBeInTheDocument();
});

test("moving a player slider updates its readout", async () => {
  renderPanel();
  const slider = screen.getByRole("slider", { name: /Player x/ });
  const before = slider.parentElement!.querySelector("output")!.textContent;
  const next = String(Number(slider.getAttribute("max")) / 2);
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(slider, { target: { value: next } });
  expect(slider.parentElement!.querySelector("output")!.textContent).toBe(Number(next).toFixed(1));
  expect(before).not.toBeNull();
});

test("the help mark carries the preview help text", () => {
  renderPanel();
  expect(screen.getAllByRole("img", { name: "Help" }).map((mark) => mark.getAttribute("title"))).toContain(
    HELP_SECTION_PREVIEW,
  );
});

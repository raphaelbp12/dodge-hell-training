/**
 * Pure helpers for the dev-only tagger route (T13/T14).
 *
 * They live outside the React component so the query-string convention,
 * frame-step arithmetic, key map and provenance assembly are unit-testable
 * without a DOM or a video element. No React, Phaser, DOM or video API here.
 */
import type { VideoProvenance } from "./tagging";

/**
 * Z26: the typed presented frame rate. Null when blank, zero, negative or not
 * a finite number.
 */
export function parseFrameRate(text: string): number | null {
  if (text.trim().length === 0) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The tagger opts in through the same query-string convention as `?phase=`
 * and `?encounter=`; `?tagger=1` is the whole switch (T14).
 */
export function isTaggerRequested(search: string): boolean {
  return new URLSearchParams(search).get("tagger") === "1";
}

/**
 * One frame at the typed rate (T19). The rate is a convenience for stepping
 * only; recorded times always come from the frame callback's `mediaTime`.
 */
export function frameStepSeconds(frameRate: number): number {
  if (!Number.isFinite(frameRate) || frameRate <= 0)
    throw new RangeError("frameRate must be a positive finite number");
  return 1 / frameRate;
}

/** T37: a coarse transport jump for reaching a region without frame stepping. */
export const FINE_JUMP_SECONDS = 5;
export const COARSE_JUMP_SECONDS = 30;

export type TaggerAction =
  | Readonly<{
      kind: "frame-step";
      direction: -1 | 1;
      deltaSeconds: number;
    }>
  | Readonly<{ kind: "jump"; direction: -1 | 1; seconds: number }>
  | Readonly<{ kind: "play-pause" }>
  | Readonly<{ kind: "record"; mode: "standalone" | "new-burst" | "continue-burst" }>
  | Readonly<{ kind: "set-shots"; shots: number }>;

/**
 * The one key map the route binds: arrows step one frame, Shift+arrows jump
 * five seconds, PageUp/PageDown jump thirty, space toggles playback, Enter
 * records a standalone tag, B records a volley that starts a new burst, Shift+Enter
 * adds a volley to the latest matching burst, and 1-9 set the sticky shot count. Everything else belongs to the
 * browser or another control.
 */
export function actionForKey(
  key: string,
  frameRate: number,
  shiftKey = false,
): TaggerAction | null {
  if (shiftKey && key === "ArrowLeft")
    return { kind: "jump", direction: -1, seconds: FINE_JUMP_SECONDS };
  if (shiftKey && key === "ArrowRight")
    return { kind: "jump", direction: 1, seconds: FINE_JUMP_SECONDS };
  if (key === "PageUp")
    return { kind: "jump", direction: -1, seconds: COARSE_JUMP_SECONDS };
  if (key === "PageDown")
    return { kind: "jump", direction: 1, seconds: COARSE_JUMP_SECONDS };
  if (key === "ArrowLeft")
    return {
      kind: "frame-step",
      direction: -1,
      deltaSeconds: frameStepSeconds(frameRate),
    };
  if (key === "ArrowRight")
    return {
      kind: "frame-step",
      direction: 1,
      deltaSeconds: frameStepSeconds(frameRate),
    };
  if (key === " ") return { kind: "play-pause" };
  if (key === "Enter" && shiftKey)
    return { kind: "record", mode: "continue-burst" };
  if (key === "Enter") return { kind: "record", mode: "standalone" };
  if (key === "b" || key === "B") return { kind: "record", mode: "new-burst" };
  if (/^[1-9]$/.test(key)) return { kind: "set-shots", shots: Number(key) };
  return null;
}

export type KeyTarget = Readonly<{
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
}>;

/**
 * A focused text-like field keeps its own keys; the tagger's shortcuts step
 * aside. Radios and checkboxes are deliberately not editable: Enter should
 * still record a tag after changing one with the mouse.
 */
export function isEditableTarget(target: KeyTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName?.toUpperCase();
  if (tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (tagName !== "INPUT") return false;
  const type = target.type?.toLowerCase() ?? "text";
  return !["radio", "checkbox", "button", "submit", "reset"].includes(type);
}

/**
 * A focused control that activates on Enter or Space keeps that key so the
 * user can operate the device without the tagger eating the activation. A
 * radio or checkbox activates on Space only, which leaves Enter available to
 * record a tag.
 */
export function isActivationTarget(
  target: KeyTarget | null,
  key: string,
): boolean {
  if (!target) return false;
  const tagName = target.tagName?.toUpperCase();
  if (tagName === "BUTTON" || tagName === "A" || tagName === "SUMMARY")
    return key === "Enter" || key === " ";
  if (tagName !== "INPUT") return false;
  const type = target.type?.toLowerCase() ?? "text";
  if (type === "radio" || type === "checkbox") return key === " ";
  if (type === "button" || type === "submit" || type === "reset")
    return key === "Enter" || key === " ";
  return false;
}

/**
 * Assembles the four provenance fields exactly (T18). `sourceUrl` is typed
 * rather than discovered, so a blank field becomes `null` (a local-only
 * recording) instead of an empty string that claims a source.
 */
export function buildProvenance(input: {
  fileName: string;
  durationSeconds: number;
  sourceUrl: string;
  frameRate: number;
}): VideoProvenance {
  const fileName = input.fileName.trim();
  if (fileName.length === 0)
    throw new RangeError("provenance.fileName must be a nonempty string");
  const sourceUrl = input.sourceUrl.trim();
  return {
    sourceUrl: sourceUrl.length === 0 ? null : sourceUrl,
    fileName,
    frameRate: input.frameRate,
    durationSeconds: input.durationSeconds,
  };
}

/**
 * Z22: the one absolute seek target, clamped to the video. A relative step or
 * jump adds its delta to the current time first, then shares this clamp.
 */
export function clampSeekTarget(target: number, limitSeconds: number): number {
  const floored = Math.max(0, target);
  return limitSeconds > 0 ? Math.min(floored, limitSeconds) : floored;
}

/** One `requestVideoFrameCallback` report: the frame's time and running count. */
export type FrameSample = Readonly<{
  mediaTime: number;
  presentedFrames: number;
}>;

/** Rates a recording is commonly presented at; a measured rate snaps to one. */
export const COMMON_FRAME_RATES: readonly number[] = [
  23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120,
];

const MIN_FRAME_GAPS = 10;
const FRAME_RATE_SNAP_TOLERANCE = 0.01;

/**
 * Estimates the presented frame rate from consecutive frame reports during
 * playback. Only gaps between frames the browser presented back to back
 * (`presentedFrames` up by one) count, so dropped frames cannot stretch a
 * gap. The median gap is snapped to the nearest common rate within 1%; null when there
 * are too few gaps or no common rate fits.
 */
export function estimateFrameRate(
  samples: readonly FrameSample[],
): number | null {
  const gaps: number[] = [];
  for (let index = 1; index < samples.length; index++) {
    const gap = samples[index]!.mediaTime - samples[index - 1]!.mediaTime;
    if (
      samples[index]!.presentedFrames - samples[index - 1]!.presentedFrames ===
        1 &&
      gap > 0
    )
      gaps.push(gap);
  }
  if (gaps.length < MIN_FRAME_GAPS) return null;
  gaps.sort((first, second) => first - second);
  const measured = 1 / gaps[Math.floor(gaps.length / 2)]!;
  const nearest = COMMON_FRAME_RATES.reduce((best, rate) =>
    Math.abs(measured - rate) < Math.abs(measured - best) ? rate : best,
  );
  return Math.abs(measured - nearest) / nearest <= FRAME_RATE_SNAP_TOLERANCE
    ? nearest
    : null;
}

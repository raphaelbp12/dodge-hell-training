/**
 * The timeline's horizontal zoom: the part of the video the rows show, as
 * fractions of the video's duration. Zoom changes only the time axis; the
 * row height never changes. A view concern only, never stored in a study.
 */
export type TimelineWindow = Readonly<{ start: number; end: number }>;

export const FULL_WINDOW: TimelineWindow = Object.freeze({ start: 0, end: 1 });

const clampToVideo = (start: number, span: number): TimelineWindow => {
  const clamped = Math.min(Math.max(0, start), 1 - span);
  return { start: clamped, end: clamped + span };
};

export function isFullWindow(window: TimelineWindow): boolean {
  return window.start <= 0 && window.end >= 1;
}

/**
 * Scales the visible span by `factor` (below 1 zooms in) around `center`,
 * never narrower than `minSpan` and never wider than the whole video.
 */
export function zoomWindow(
  window: TimelineWindow,
  factor: number,
  center: number,
  minSpan: number,
): TimelineWindow {
  const span = Math.min(1, Math.max(minSpan, (window.end - window.start) * factor));
  if (span >= 1) return FULL_WINDOW;
  return clampToVideo(center - span / 2, span);
}

/** A video fraction's position across the visible window; outside 0-1 is off screen. */
export function visibleFraction(fraction: number, window: TimelineWindow): number {
  return (fraction - window.start) / (window.end - window.start);
}

/** The same window while the playhead is inside it; otherwise one centred on the playhead. */
export function followPlayhead(window: TimelineWindow, playhead: number): TimelineWindow {
  if (playhead >= window.start && playhead <= window.end) return window;
  const span = window.end - window.start;
  return clampToVideo(playhead - span / 2, span);
}

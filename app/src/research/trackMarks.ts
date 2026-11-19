/**
 * Plan V23 Q02-Q09: the `marks` a track exports, built once for the export,
 * the preview, the timeline and the parity report so all of them fire the same
 * volleys. Pure: no video, DOM or React.
 */
import type { AttackMarks } from "../game/config/encounter";
import { markedVolleysBetween } from "../game/simulation/marks";
import { splitGaps } from "./cadenceFit";
import { windowAt, windowsForTrack, type AttackTrack, type SegmentWindow } from "./study";

/** Rounds to the millisecond so an exported file stays readable (step 98.2). */
export function roundToMillisecond(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/**
 * The windows a track's marks count in. A sub-phase track has its sub-phase's
 * windows. A phase-level track of a phase with sub-phases has one window per
 * run of consecutive sub-phase windows, from the phase's entry, because the
 * game keeps counting a phase's own marked attacks across its sub-phases.
 */
export function trackWindowsOf(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
): readonly SegmentWindow[] {
  const own = windowsForTrack(windows, track.location);
  if (track.location.subPhaseId !== null) return own;
  const runs: SegmentWindow[] = [];
  for (const window of own) {
    const last = runs[runs.length - 1];
    if (last && window.segmentId.includes("/") && last.endSeconds === window.startSeconds)
      runs[runs.length - 1] = { ...last, endSeconds: window.endSeconds };
    else runs.push(window);
  }
  return runs;
}

/** The track's first window (Q04), or null when its segment has none. */
export function firstWindowOf(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
): SegmentWindow | null {
  return trackWindowsOf(track, windows)[0] ?? null;
}

/** The track's volley mark times inside `window`, one of `trackWindowsOf`, sorted. */
export function volleyTimesInWindow(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
  window: SegmentWindow,
): number[] {
  const trackWindows = trackWindowsOf(track, windows);
  return track.marks
    .filter(
      (mark) =>
        mark.kind === "volley" &&
        windowAt(trackWindows, mark.timeSeconds)?.startSeconds === window.startSeconds,
    )
    .map((mark) => mark.timeSeconds)
    .sort((first, second) => first - second);
}

/** A guard on a tiny typed period, not a game value: the timeline draws at most this many repeats. */
export const MAX_REPEAT_TICKS = 2000;

/**
 * Plan V23 Q18: a periodic track's repeated volleys after its first cycle, in
 * its first window, up to the stop's effect or the window's end. Empty for a
 * track that plays once or exports nothing.
 */
export function repeatTimesOf(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
): readonly number[] {
  const marks = trackMarksOf(track, windows);
  const window = firstWindowOf(track, windows);
  if (marks === null || marks.periodSeconds === undefined || window === null) return [];
  return markedVolleysBetween(marks, -1, window.endSeconds - window.startSeconds)
    .filter((volley) => volley.burstIndex >= marks.bursts.length)
    .map((volley) => window.startSeconds + volley.offsetSeconds)
    .filter((time) => time < window.endSeconds)
    .slice(0, MAX_REPEAT_TICKS);
}

/**
 * The attack's marks: the first window's volley marks as offsets from the
 * window's start (Q03), grouped into bursts by `splitGaps`' automatic
 * threshold (Q09), duplicates kept (Q08). A periodic track adds its period and,
 * when its end mark is inside the first window, its stop (Q06, Q07). Null when
 * the first window has no volley mark, so export drops the track (Q16).
 */
export function trackMarksOf(
  track: AttackTrack,
  windows: readonly SegmentWindow[],
): AttackMarks | null {
  const window = firstWindowOf(track, windows);
  if (window === null) return null;
  const offsets = volleyTimesInWindow(track, windows, window).map((time) =>
    roundToMillisecond(time - window.startSeconds),
  );
  if (offsets.length === 0) return null;
  const { classes } = splitGaps(offsets.slice(1).map((offset, index) => offset - offsets[index]));
  const bursts: number[][] = [[offsets[0]]];
  offsets.slice(1).forEach((offset, index) => {
    if (classes[index] === "cooldown") bursts.push([offset]);
    else bursts[bursts.length - 1].push(offset);
  });
  if (track.periodSeconds === undefined) return { bursts };
  const stop = track.endSeconds;
  const stopInside =
    stop !== undefined && stop >= window.startSeconds && stop <= window.endSeconds;
  return {
    bursts,
    periodSeconds: track.periodSeconds,
    ...(stopInside ? { stopAfterSeconds: roundToMillisecond(stop - window.startSeconds) } : {}),
  };
}

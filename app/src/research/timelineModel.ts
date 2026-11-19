/**
 * Pure marker arithmetic for the tagger's timeline bar (plan V16 phase 58).
 * No DOM or React: the bar only draws what these functions return.
 */
import {
  segmentWindows,
  windowAt,
  windowsForTrack,
  type Segment,
  type StudyV6,
} from "./study";
import { repeatTimesOf } from "./trackMarks";

/** Plan V20 E20: the height of one timeline row, in canvas pixels. */
export const TIMELINE_ROW_HEIGHT_PX = 14;

export type TimelineTickStyle = "solid" | "hollow" | "faint" | "boundary";

export type TimelineRow = Readonly<{
  /** "structure", "status", "scratch", or a track id. */
  id: string;
  label: string;
  ticks: readonly Readonly<{ fraction: number; style: TimelineTickStyle }>[];
  bars: readonly Readonly<{ fromFraction: number; toFraction: number }>[];
  /** A boundary tick's segment label, keyed by fraction. */
  labels: readonly Readonly<{ fraction: number; text: string }>[];
}>;

/** Distinct volley times in ascending order; ties collapse to one marker. */
function sortedUnique(times: readonly number[]): number[] {
  return [...new Set(times)].sort((first, second) => first - second);
}

/**
 * Each volley's position along a bar covering the whole video, as a fraction
 * from 0 to 1 (S15, S16). A time past the end clamps to 1; a video with no
 * known duration has no markers.
 */
export function markerFractions(
  times: readonly number[],
  durationSeconds: number,
): readonly number[] {
  if (!(durationSeconds > 0)) return [];
  return sortedUnique(times).map((time) =>
    Math.min(1, Math.max(0, time / durationSeconds)),
  );
}

/**
 * The latest volley strictly before `currentSeconds` by more than the
 * tolerance, so a press from a marker's own frame moves on (S17). Null at the
 * start.
 */
export function previousVolleyTime(
  times: readonly number[],
  currentSeconds: number,
  toleranceSeconds: number,
): number | null {
  const earlier = sortedUnique(times).filter(
    (time) => time < currentSeconds - toleranceSeconds,
  );
  return earlier.length === 0 ? null : earlier[earlier.length - 1];
}

/** The earliest volley after `currentSeconds` by more than the tolerance. Null at the end. */
export function nextVolleyTime(
  times: readonly number[],
  currentSeconds: number,
  toleranceSeconds: number,
): number | null {
  const later = sortedUnique(times).filter(
    (time) => time > currentSeconds + toleranceSeconds,
  );
  return later.length === 0 ? null : later[0];
}

/** Half a frame at the typed rate, or zero without one (S17). */
export function volleyStepTolerance(frameRate: number | null): number {
  return frameRate !== null && frameRate > 0 ? 0.5 / frameRate : 0;
}

/**
 * E20: the rows the timeline draws, in order: structure (boundaries and
 * telegraph ends), status (invulnerable spans; an open span runs to the end),
 * one row per attack track in study order (volley marks solid, detonation
 * marks hollow, a periodic track's repeats faint (plan V23 Q18), the end mark
 * as a bar to its window's end, or to the video end outside every window), and
 * scratch.
 */
export function timelineRows(
  input: Readonly<{
    study: StudyV6;
    segments: readonly Segment[];
    durationSeconds: number;
  }>,
): readonly TimelineRow[] {
  const { study, segments, durationSeconds } = input;
  const at = (seconds: number) => markerFractions([seconds], durationSeconds)[0] ?? 0;
  const ticksOf = (times: readonly number[], style: TimelineTickStyle) =>
    durationSeconds > 0 ? times.map((time) => ({ fraction: at(time), style })) : [];
  const empty = { ticks: [], bars: [], labels: [] };
  const windows = segmentWindows(study.boundaries, segments, durationSeconds);
  const boundaries = [...study.boundaries].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const structure: TimelineRow = {
    ...empty,
    id: "structure",
    label: "Structure",
    ticks: [
      ...ticksOf(boundaries.map((boundary) => boundary.timeSeconds), "boundary"),
      ...ticksOf(
        boundaries.flatMap((boundary) =>
          boundary.telegraphEndSeconds === undefined ? [] : [boundary.telegraphEndSeconds],
        ),
        "hollow",
      ),
    ],
    labels:
      durationSeconds > 0
        ? boundaries.map((boundary) => ({
            fraction: at(boundary.timeSeconds),
            text:
              segments.find((segment) => segment.id === boundary.segmentId)?.label ??
              boundary.segmentId,
          }))
        : [],
  };
  const status: TimelineRow = {
    ...empty,
    id: "status",
    label: "Status",
    bars:
      durationSeconds > 0
        ? study.statusSpans.map((span) => ({
            fromFraction: at(span.inSeconds),
            toFraction: span.outSeconds === null ? 1 : at(span.outSeconds),
          }))
        : [],
  };
  const tracks = study.tracks.map((track): TimelineRow => {
    const endWindow =
      track.endSeconds === undefined
        ? null
        : windowAt(windowsForTrack(windows, track.location), track.endSeconds);
    return {
      ...empty,
      id: track.id,
      label: track.id,
      ticks: [
        ...track.marks.flatMap((mark) =>
          ticksOf([mark.timeSeconds], mark.kind === "volley" ? "solid" : "hollow"),
        ),
        ...ticksOf(repeatTimesOf(track, windows), "faint"),
      ],
      bars:
        track.endSeconds === undefined || !(durationSeconds > 0)
          ? []
          : [
              {
                fromFraction: at(track.endSeconds),
                toFraction: at(endWindow?.endSeconds ?? durationSeconds),
              },
            ],
    };
  });
  const scratch: TimelineRow = {
    ...empty,
    id: "scratch",
    label: "Scratch",
    ticks: ticksOf(study.scratch.map((mark) => mark.timeSeconds), "solid"),
  };
  return [structure, status, ...tracks, scratch];
}

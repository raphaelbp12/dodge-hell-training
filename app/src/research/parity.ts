/**
 * Plan V23 Q19: the parity report. For a study and its exported monster file:
 * whether the game's schedule reproduces each exported track's marks, the
 * tracks export drops, the segment values it changes, and the later windows
 * whose marks differ from the first. Pure and read-only: it never blocks the
 * export.
 */
import type { AttackMarks } from "../game/config/encounter";
import { markedVolleysBetween } from "../game/simulation/marks";
import { segmentIdOf, windowsForTrack, type SegmentRef, type SegmentWindow, type StudyV6 } from "./study";
import { studyWindowsOfFile } from "./studyExport";
import { firstWindowOf, trackMarksOf, trackWindowsOf, volleyTimesInWindow } from "./trackMarks";

/** Without a frame rate, offsets agree to the millisecond export rounds to. */
const MILLISECOND = 0.001;

export type Mismatch = Readonly<{ index: number; expected: number | null; actual: number | null }>;

/** The first index where two sorted time lists disagree beyond `toleranceSeconds`, or null. */
export function firstMismatch(
  expected: readonly number[],
  actual: readonly number[],
  toleranceSeconds: number,
): Mismatch | null {
  for (let index = 0; index < Math.max(expected.length, actual.length); index++) {
    const wanted = expected[index];
    const got = actual[index];
    if (wanted === undefined || got === undefined || Math.abs(wanted - got) > toleranceSeconds)
      return { index, expected: wanted ?? null, actual: got ?? null };
  }
  return null;
}

/** The times `marks` fires inside `window`, from its start, before its end. */
export function scheduledTimesInWindow(marks: AttackMarks, window: SegmentWindow): number[] {
  return markedVolleysBetween(marks, -1, window.endSeconds - window.startSeconds)
    .map((volley) => window.startSeconds + volley.offsetSeconds)
    .filter((time) => time < window.endSeconds);
}

export type TrackParity = Readonly<{
  trackId: string;
  segmentId: string;
  matches: boolean;
  /** The first mark (or scheduled volley) time that disagrees; null when they match. */
  firstMismatchSeconds: number | null;
}>;

export type DroppedTrack = Readonly<{ trackId: string; segmentId: string }>;

export type ValueChange = Readonly<{
  segmentId: string;
  field: "telegraphSeconds" | "invulnerableOnEnterSeconds" | "durationSeconds" | "exitAfterSeconds";
  shipped: number | null;
  exported: number | null;
}>;

export type WindowDifference = Readonly<{
  trackId: string;
  windowStartSeconds: number;
  firstDifferenceSeconds: number;
}>;

export type ParityReport = Readonly<{
  tracks: readonly TrackParity[];
  dropped: readonly DroppedTrack[];
  valueChanges: readonly ValueChange[];
  laterWindows: readonly WindowDifference[];
}>;

type RawSegment = Record<string, unknown> & {
  id: string;
  attacks?: readonly (Record<string, unknown> & { id: string; marks?: AttackMarks })[];
};
type RawPhase = RawSegment & { subPhases?: RawSegment[] | null };

const VALUE_FIELDS: readonly ValueChange["field"][] = [
  "telegraphSeconds",
  "invulnerableOnEnterSeconds",
  "durationSeconds",
  "exitAfterSeconds",
];

function ownersOf(rawFile: unknown): Map<string, RawSegment> {
  const owners = new Map<string, RawSegment>();
  for (const phase of (rawFile as { phases: RawPhase[] }).phases) {
    owners.set(phase.id, phase);
    for (const sub of phase.subPhases ?? []) owners.set(`${phase.id}/${sub.id}`, sub);
  }
  return owners;
}

const refOf = (id: string): SegmentRef => {
  const [phaseId, subPhaseId] = id.split("/");
  return { phaseId, subPhaseId: subPhaseId ?? null };
};

const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);

/** Q19: the four lists of the parity panel. `exportedRawFile` is the parsed export. */
export function parityReport(
  input: Readonly<{ study: StudyV6; shippedRawFile: unknown; exportedRawFile: unknown }>,
): ParityReport {
  const { study } = input;
  const frameRate = study.provenance.frameRate;
  const tolerance = frameRate ? 1 / frameRate : MILLISECOND;
  const windows = studyWindowsOfFile(study, input.shippedRawFile);
  const exportedOwners = ownersOf(input.exportedRawFile);
  const shippedOwners = ownersOf(input.shippedRawFile);
  const tracks: TrackParity[] = [];
  const dropped: DroppedTrack[] = [];
  const laterWindows: WindowDifference[] = [];
  for (const track of study.tracks) {
    const segmentId = segmentIdOf(track.location);
    const first = firstWindowOf(track, windows);
    if (first === null) continue;
    if (trackMarksOf(track, windows) === null) {
      dropped.push({ trackId: track.id, segmentId });
      continue;
    }
    const marks = exportedOwners.get(segmentId)?.attacks?.find((attack) => attack.id === track.attack.id)?.marks;
    const marked = volleyTimesInWindow(track, windows, first);
    const mismatch = marks
      ? firstMismatch(marked, scheduledTimesInWindow(marks, first), tolerance)
      : { index: 0, expected: marked[0] ?? null, actual: null };
    tracks.push({
      trackId: track.id,
      segmentId,
      matches: mismatch === null,
      firstMismatchSeconds: mismatch === null ? null : (mismatch.expected ?? mismatch.actual),
    });
    const firstOffsets = marked.map((time) => time - first.startSeconds);
    for (const window of trackWindowsOf(track, windows).slice(1)) {
      const offsets = volleyTimesInWindow(track, windows, window).map((time) => time - window.startSeconds);
      // A later window cut short by the video's end only needs the offsets it can show.
      const shown = firstOffsets.filter((offset) => window.startSeconds + offset < window.endSeconds);
      const difference = firstMismatch(shown, offsets, tolerance);
      if (difference !== null)
        laterWindows.push({
          trackId: track.id,
          windowStartSeconds: window.startSeconds,
          firstDifferenceSeconds: window.startSeconds + (difference.actual ?? difference.expected ?? 0),
        });
    }
  }
  const valueChanges: ValueChange[] = [];
  for (const [segmentId, exported] of exportedOwners) {
    if (windowsForTrack(windows, refOf(segmentId)).length === 0) continue;
    const shipped = shippedOwners.get(segmentId);
    for (const field of VALUE_FIELDS) {
      const before = numberOrNull(shipped?.[field]);
      const after = numberOrNull(exported[field]);
      if (before !== after) valueChanges.push({ segmentId, field, shipped: before, exported: after });
    }
  }
  return { tracks, dropped, valueChanges, laterWindows };
}

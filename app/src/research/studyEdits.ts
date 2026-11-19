/**
 * Pure edits of a v6 study (plan V20 E04, E05, E16; plan V23 Q06). Every
 * function returns a new study and never mutates its input; a refusal carries
 * a sentence the route can show.
 */
import type { CadencedAuthoredAttack } from "../game/config/data";
import {
  nextSegmentId,
  type AttackTrack,
  type Boundary,
  type Mark,
  type Segment,
  type SegmentRef,
  type StudyV6,
} from "./study";

export type EditResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: string }>;

const ok = (value: StudyV6): EditResult<StudyV6> => ({ ok: true, value });
const fail = (error: string): EditResult<StudyV6> => ({ ok: false, error });

function isTime(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 0;
}

const NOT_A_TIME = "A time must be a finite number of seconds, zero or more.";

function byTime<T extends Readonly<{ timeSeconds: number }>>(list: readonly T[]): T[] {
  return [...list].sort((first, second) => first.timeSeconds - second.timeSeconds);
}

/** The index of the latest boundary at or before `timeSeconds`, or -1. */
function latestBoundaryIndex(boundaries: readonly Boundary[], timeSeconds: number): number {
  let found = -1;
  boundaries.forEach((boundary, index) => {
    if (boundary.timeSeconds <= timeSeconds) found = index;
  });
  return found;
}

function withTrack(
  study: StudyV6,
  trackId: string,
  update: (track: AttackTrack) => AttackTrack | string,
): EditResult<StudyV6> {
  const index = study.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return fail(`No attack track is named ${trackId}.`);
  const next = update(study.tracks[index]);
  if (typeof next === "string") return fail(next);
  return ok({ ...study, tracks: study.tracks.map((track, at) => (at === index ? next : track)) });
}

function hasTrack(study: StudyV6, trackId: string): boolean {
  return study.tracks.some((track) => track.id === trackId);
}

// ---- Structure ------------------------------------------------------------

/** E04: the new boundary enters the segment after the latest boundary at or before it. */
export function addBoundary(
  study: StudyV6,
  timeSeconds: number,
  segments: readonly Segment[],
): EditResult<StudyV6> {
  if (!isTime(timeSeconds)) return fail(NOT_A_TIME);
  if (segments.length === 0) return fail("This monster has no segment to enter.");
  const sorted = byTime(study.boundaries);
  const previous = latestBoundaryIndex(sorted, timeSeconds);
  const boundary: Boundary = {
    timeSeconds,
    segmentId: nextSegmentId(segments, previous < 0 ? null : sorted[previous].segmentId),
  };
  return ok({
    ...study,
    boundaries: [...sorted.slice(0, previous + 1), boundary, ...sorted.slice(previous + 1)],
  });
}

export function setBoundarySegment(
  study: StudyV6,
  index: number,
  segmentId: string,
): EditResult<StudyV6> {
  if (study.boundaries[index] === undefined) return fail("No boundary is at that position.");
  if (segmentId.trim().length === 0) return fail("A boundary must name a segment.");
  return ok({
    ...study,
    boundaries: study.boundaries.map((boundary, at) =>
      at === index ? { ...boundary, segmentId } : boundary,
    ),
  });
}

export function removeBoundary(study: StudyV6, index: number): EditResult<StudyV6> {
  if (study.boundaries[index] === undefined) return fail("No boundary is at that position.");
  return ok({ ...study, boundaries: study.boundaries.filter((_, at) => at !== index) });
}

/** E05: on the latest boundary at or before `timeSeconds`. */
export function setTelegraphEnd(study: StudyV6, timeSeconds: number): EditResult<StudyV6> {
  if (!isTime(timeSeconds)) return fail(NOT_A_TIME);
  const index = latestBoundaryIndex(study.boundaries, timeSeconds);
  if (index < 0) return fail("Add a boundary before marking where its telegraph ends.");
  const boundary = study.boundaries[index];
  if (timeSeconds <= boundary.timeSeconds)
    return fail("A telegraph must end after its boundary; step forward at least one frame.");
  return ok({
    ...study,
    boundaries: study.boundaries.map((entry, at) =>
      at === index ? { ...entry, telegraphEndSeconds: timeSeconds } : entry,
    ),
  });
}

/** E05: closes the open span at `timeSeconds`, otherwise opens a new one. */
export function toggleInvulnerable(study: StudyV6, timeSeconds: number): EditResult<StudyV6> {
  if (!isTime(timeSeconds)) return fail(NOT_A_TIME);
  const open = study.statusSpans.findIndex((span) => span.outSeconds === null);
  if (open >= 0) {
    if (timeSeconds <= study.statusSpans[open].inSeconds)
      return fail("An invulnerable span must end after it starts; step forward at least one frame.");
    return ok({
      ...study,
      statusSpans: study.statusSpans.map((span, at) =>
        at === open ? { ...span, outSeconds: timeSeconds } : span,
      ),
    });
  }
  const spans = [
    ...study.statusSpans,
    { kind: "invulnerable" as const, inSeconds: timeSeconds, outSeconds: null },
  ].sort((first, second) => first.inSeconds - second.inSeconds);
  return ok({ ...study, statusSpans: spans });
}

export function removeSpan(study: StudyV6, index: number): EditResult<StudyV6> {
  if (study.statusSpans[index] === undefined) return fail("No invulnerable span is at that position.");
  return ok({ ...study, statusSpans: study.statusSpans.filter((_, at) => at !== index) });
}

// ---- Marks ----------------------------------------------------------------

/** A null `trackId` is the scratch track, which takes only volley marks (E16). */
export function addMark(
  study: StudyV6,
  trackId: string | null,
  mark: Mark,
  isBombTrack: (trackId: string) => boolean,
): EditResult<StudyV6> {
  if (!isTime(mark.timeSeconds)) return fail(NOT_A_TIME);
  if (trackId === null) {
    if (mark.kind !== "volley")
      return fail("The scratch track takes only volley marks; select a bomb's track first.");
    return ok({ ...study, scratch: byTime([...study.scratch, mark]) });
  }
  if (mark.kind === "detonation" && hasTrack(study, trackId) && !isBombTrack(trackId))
    return fail("Only a bomb's track takes detonation marks.");
  return withTrack(study, trackId, (track) => ({ ...track, marks: byTime([...track.marks, mark]) }));
}

/** Removes the single nearest mark within the tolerance. */
export function removeMarkNear(
  study: StudyV6,
  trackId: string | null,
  timeSeconds: number,
  toleranceSeconds: number,
): EditResult<StudyV6> {
  const without = (marks: readonly Mark[]): readonly Mark[] | string => {
    let nearest = -1;
    marks.forEach((mark, index) => {
      const distance = Math.abs(mark.timeSeconds - timeSeconds);
      if (
        distance <= toleranceSeconds &&
        (nearest < 0 || distance < Math.abs(marks[nearest].timeSeconds - timeSeconds))
      )
        nearest = index;
    });
    if (nearest < 0) return "No mark within one frame of this frame.";
    return marks.filter((_, index) => index !== nearest);
  };
  if (trackId === null) {
    const scratch = without(study.scratch);
    return typeof scratch === "string" ? fail(scratch) : ok({ ...study, scratch });
  }
  return withTrack(study, trackId, (track) => {
    const marks = without(track.marks);
    return typeof marks === "string" ? marks : { ...track, marks };
  });
}

/** E07: a null time removes the end mark. */
export function setEndMark(
  study: StudyV6,
  trackId: string,
  timeSeconds: number | null,
): EditResult<StudyV6> {
  if (timeSeconds !== null && !isTime(timeSeconds)) return fail(NOT_A_TIME);
  return withTrack(study, trackId, (track) => {
    const { endSeconds: _dropped, ...rest } = track;
    return timeSeconds === null ? rest : { ...rest, endSeconds: timeSeconds };
  });
}

// ---- Tracks ---------------------------------------------------------------

const duplicateId = (id: string) => `An attack track named ${id} already exists.`;

export function addTrack(study: StudyV6, track: AttackTrack): EditResult<StudyV6> {
  if (hasTrack(study, track.id)) return fail(duplicateId(track.id));
  return ok({ ...study, tracks: [...study.tracks, track] });
}

export function removeTrack(study: StudyV6, trackId: string): EditResult<StudyV6> {
  if (!hasTrack(study, trackId)) return fail(`No attack track is named ${trackId}.`);
  return ok({ ...study, tracks: study.tracks.filter((track) => track.id !== trackId) });
}

/**
 * Plan V20 step 86.1, "Reload from game": every track with no marks is
 * replaced by the file's tracks; every track with marks is kept in the file's
 * place for its id, or at the end when the file no longer has it.
 */
export function reloadTracks(
  study: StudyV6,
  fromFile: readonly AttackTrack[],
): Readonly<{ study: StudyV6; keptCount: number }> {
  const kept = study.tracks.filter((track) => track.marks.length > 0);
  const keptById = new Map(kept.map((track) => [track.id, track]));
  const fileIds = new Set(fromFile.map((track) => track.id));
  const tracks = [
    ...fromFile.map((track) => keptById.get(track.id) ?? track),
    ...kept.filter((track) => !fileIds.has(track.id)),
  ];
  return { study: { ...study, tracks }, keptCount: kept.length };
}

/** Copies the definition under a new id, with no marks, end mark or measured ranges. */
export function duplicateTrack(study: StudyV6, trackId: string, newId: string): EditResult<StudyV6> {
  const source = study.tracks.find((track) => track.id === trackId);
  if (!source) return fail(`No attack track is named ${trackId}.`);
  if (newId.trim().length === 0) return fail("An attack track needs a name.");
  const { endSeconds: _end, measuredRangeTiles: _ranges, ...definition } = source;
  return addTrack(study, {
    ...structuredClone(definition),
    id: newId,
    attack: { ...structuredClone(source.attack), id: newId },
    marks: [],
  });
}

export function setTrackAttack(
  study: StudyV6,
  trackId: string,
  attack: CadencedAuthoredAttack,
): EditResult<StudyV6> {
  return withTrack(study, trackId, (track) => ({ ...track, attack }));
}

/** Plan V23 Q06: a period makes the track periodic; undefined makes it play its marks once. */
export function setTrackPeriod(
  study: StudyV6,
  trackId: string,
  seconds: number | undefined,
): EditResult<StudyV6> {
  if (seconds !== undefined && !(Number.isFinite(seconds) && seconds > 0))
    return fail("A period must be a positive number of seconds.");
  return withTrack(study, trackId, (track) => {
    const { periodSeconds: _dropped, ...rest } = track;
    return seconds === undefined ? rest : { ...rest, periodSeconds: seconds };
  });
}

export function setTrackLocation(
  study: StudyV6,
  trackId: string,
  location: SegmentRef,
): EditResult<StudyV6> {
  if (location.phaseId.trim().length === 0) return fail("An attack track must name a phase.");
  return withTrack(study, trackId, (track) => ({ ...track, location }));
}

/** E09: writes one pair's measured range at its pair index; unmeasured pairs before it are null. */
export function setMeasuredRange(
  study: StudyV6,
  trackId: string,
  pairIndex: number,
  tiles: number,
): EditResult<StudyV6> {
  if (!(Number.isInteger(pairIndex) && pairIndex >= 0)) return fail("No pair is at that position.");
  if (!(Number.isFinite(tiles) && tiles >= 0))
    return fail("A measured range must be a finite number of tiles, zero or more.");
  return withTrack(study, trackId, (track) => {
    const ranges: (number | null)[] = [...(track.measuredRangeTiles ?? [])];
    while (ranges.length < pairIndex) ranges.push(null);
    ranges[pairIndex] = tiles;
    return { ...track, measuredRangeTiles: ranges };
  });
}

/** E16: moves the listed scratch marks onto a new track with no marks of its own. */
export function createTrackFromScratch(
  study: StudyV6,
  markIndices: readonly number[],
  track: AttackTrack,
): EditResult<StudyV6> {
  if (track.marks.length > 0) return fail("A track made from scratch marks must start with no marks.");
  const chosen = new Set(markIndices);
  if (chosen.size === 0) return fail("Select at least one scratch mark first.");
  if ([...chosen].some((index) => study.scratch[index] === undefined))
    return fail("A selected scratch mark no longer exists.");
  const added = addTrack(study, {
    ...track,
    marks: byTime(study.scratch.filter((_, index) => chosen.has(index))),
  });
  if (!added.ok) return added;
  return ok({ ...added.value, scratch: study.scratch.filter((_, index) => !chosen.has(index)) });
}

/** E09: undefined removes the calibration. */
export function setScale(study: StudyV6, tileWidthFraction: number | undefined): EditResult<StudyV6> {
  const { scale: _dropped, ...rest } = study;
  if (tileWidthFraction === undefined) return ok(rest);
  if (!(Number.isFinite(tileWidthFraction) && tileWidthFraction > 0))
    return fail("A scale must be a positive fraction of the video's width.");
  return ok({ ...rest, scale: { tileWidthFraction } });
}

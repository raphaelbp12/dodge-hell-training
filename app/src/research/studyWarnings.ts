/**
 * Pure warnings about a v5 study (plan V20 E07, E18). A warning informs; it
 * never blocks an export.
 */
import { fitCadence } from "./cadenceFit";
import {
  nextSegmentId,
  segmentIdOf,
  segmentWindows,
  windowAt,
  windowsForTrack,
  type AttackTrack,
  type Segment,
  type SegmentWindow,
  type StudyV5,
} from "./study";

/** E18: a fit whose residual is above this many frames is reported. */
export const RESIDUAL_WARNING_FRAMES = 2;

export type StudyWarning = Readonly<{
  /** "structure", "status", or a track id. */
  where: string;
  text: string;
}>;

const seconds = (value: number) => value.toFixed(3);

function labelOf(track: AttackTrack, segments: readonly Segment[]): string {
  const id = segmentIdOf(track.location);
  return segments.find((segment) => segment.id === id)?.label ?? id;
}

export function studyWarnings(
  input: Readonly<{
    study: StudyV5;
    segments: readonly Segment[];
    videoEndSeconds: number;
    /** Half a frame; from `volleyStepTolerance`. Zero without a frame rate. */
    frameToleranceSeconds: number;
  }>,
): readonly StudyWarning[] {
  const { study, segments, frameToleranceSeconds } = input;
  const frame = 2 * frameToleranceSeconds;
  const warnings: StudyWarning[] = [];
  const structure = (text: string) => warnings.push({ where: "structure", text });
  const segmentOf = (id: string) => segments.find((segment) => segment.id === id);
  const boundaries = [...study.boundaries].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const windows = segmentWindows(boundaries, segments, input.videoEndSeconds);
  const trackWindows = new Map<string, readonly SegmentWindow[]>(
    study.tracks.map((track) => [track.id, windowsForTrack(windows, track.location)]),
  );

  // 1. Unknown segments.
  for (const boundary of boundaries)
    if (!segmentOf(boundary.segmentId))
      structure(`Boundary at ${seconds(boundary.timeSeconds)} s names an unknown segment ${boundary.segmentId}.`);

  // 2. The authored sub-phase cycle.
  boundaries.forEach((boundary, index) => {
    const previous = boundaries[index - 1];
    const current = segmentOf(boundary.segmentId);
    const before = previous && segmentOf(previous.segmentId);
    if (!current || !before || current.ref.phaseId !== before.ref.phaseId) return;
    const expected = nextSegmentId(segments, before.id);
    if (expected !== current.id)
      structure(
        `Boundary at ${seconds(boundary.timeSeconds)} s enters ${current.id}; the authored cycle expects ${expected}.`,
      );
  });

  // 3. Invulnerability away from every boundary.
  for (const span of study.statusSpans)
    if (!boundaries.some((boundary) => Math.abs(boundary.timeSeconds - span.inSeconds) <= frame))
      warnings.push({
        where: "status",
        text: `Invulnerable from ${seconds(span.inSeconds)} s starts away from every boundary; the game can only start invulnerability when a segment is entered.`,
      });

  // 4. Marks outside the track's windows.
  for (const track of study.tracks) {
    const own = trackWindows.get(track.id) ?? [];
    for (const mark of track.marks)
      if (mark.kind === "volley" && windowAt(own, mark.timeSeconds) === null)
        warnings.push({
          where: track.id,
          text: `${track.id}: mark at ${seconds(mark.timeSeconds)} s is outside every window of ${labelOf(track, segments)}.`,
        });
  }

  // 5. An end mark before its window ends (E07).
  for (const track of study.tracks) {
    if (track.endSeconds === undefined) continue;
    const window = windowAt(trackWindows.get(track.id) ?? [], track.endSeconds);
    if (window && track.endSeconds < window.endSeconds - frame)
      warnings.push({
        where: track.id,
        text: `${track.id}: ends at ${seconds(track.endSeconds)} s but its window runs to ${seconds(window.endSeconds)} s; the game runs an attack until its segment ends, so a sub-phase boundary may be missing.`,
      });
  }

  // 6 and 7. The fit.
  const fits = study.tracks
    .filter((track) => track.marks.some((mark) => mark.kind === "volley"))
    .map((track) => ({
      track,
      fit: fitCadence({
        marks: track.marks,
        windows: trackWindows.get(track.id) ?? [],
        ...(track.burstGapThresholdSeconds === undefined
          ? {}
          : { thresholdSeconds: track.burstGapThresholdSeconds }),
      }),
    }));
  for (const { track, fit } of fits) {
    if (fit.cooldownAfterLastShotSeconds === null)
      warnings.push({ where: track.id, text: `${track.id}: the fit needs one more burst to measure the cooldown.` });
    if (fit.shotsPerBurst === null)
      warnings.push({
        where: track.id,
        text: `${track.id}: the fit cannot tell bursts apart; set a burst gap threshold.`,
      });
  }
  if (frameToleranceSeconds > 0)
    for (const { track, fit } of fits)
      if (fit.maxResidualSeconds !== null && fit.maxResidualSeconds > RESIDUAL_WARNING_FRAMES * frame)
        warnings.push({
          where: track.id,
          text: `${track.id}: a mark lies ${seconds(fit.maxResidualSeconds)} s from the fitted cadence.`,
        });
  return warnings;
}

/**
 * Pure marker arithmetic for the tagger's timeline bar (plan V16 phase 58).
 * No DOM or React: the bar only draws what these functions return.
 */

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

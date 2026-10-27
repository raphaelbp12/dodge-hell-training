// Gap-sector geometry shared by the authored-data validator, the runtime
// config validator and the ring resolver. Angles are degrees, measured from
// the pattern's own frame, with increasing angles running clockwise. A
// sector's width is therefore the clockwise span from `fromDegrees` to
// `toDegrees`, wrapping across zero when `toDegrees` is numerically smaller.

const fullCircleDegrees = 360;

/** Clockwise width of one `[fromDegrees, toDegrees]` sector, in [0, 360]. */
export function sectorWidthDegrees(
  fromDegrees: number,
  toDegrees: number,
): number {
  const span = toDegrees - fromDegrees;
  const normalized = ((span % fullCircleDegrees) + fullCircleDegrees) % fullCircleDegrees;
  // A nonzero span that is a whole number of turns is a full circle, not an
  // empty sector; a zero span is a no-op.
  return normalized === 0 && span !== 0 ? fullCircleDegrees : normalized;
}

/**
 * Union of every sector's coverage, so overlapping gaps are counted once.
 * Used to guarantee that an authored ring can never be silenced in every
 * direction at once.
 */
export function totalCoverageDegrees(
  sectors: readonly (readonly [number, number])[],
): number {
  const intervals: [number, number][] = [];
  for (const [fromDegrees, toDegrees] of sectors) {
    const width = sectorWidthDegrees(fromDegrees, toDegrees);
    if (width === 0) continue;
    const start =
      ((fromDegrees % fullCircleDegrees) + fullCircleDegrees) %
      fullCircleDegrees;
    const end = start + width;
    if (end <= fullCircleDegrees) intervals.push([start, end]);
    else {
      intervals.push([start, fullCircleDegrees]);
      intervals.push([0, end - fullCircleDegrees]);
    }
  }
  intervals.sort((left, right) => left[0] - right[0]);
  let total = 0;
  let currentStart = -1;
  let currentEnd = -1;
  for (const [start, end] of intervals) {
    if (start > currentEnd) {
      if (currentEnd > currentStart) total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    } else if (end > currentEnd) {
      currentEnd = end;
    }
  }
  if (currentEnd > currentStart) total += currentEnd - currentStart;
  return total;
}

/**
 * The first arm-spread maximum at which two arms of an `arms`-sided ring
 * share a bearing. Arm `i` is offset by `i * spread`, so arms `i` and `j`
 * coincide once `(i - j) * (360 / arms + spread)` is a whole turn; the
 * smallest such spread is `360 / (arms * (arms - 1))`.
 */
export function firstArmCollisionDegrees(arms: number): number {
  return arms > 1
    ? fullCircleDegrees / (arms * (arms - 1))
    : Number.POSITIVE_INFINITY;
}

import type { AttackMarks } from "../config/encounter";

/** One marked volley: its offset from the segment's entry and its place in the burst count. */
export type MarkedVolley = Readonly<{
  offsetSeconds: number;
  burstIndex: number;
  shotIndex: number;
}>;

/**
 * Whether a volley at `offsetSeconds` is due by `atSeconds`, with the same
 * relative rounding tolerance the cadence clock uses, so a volley computed as
 * `k * period` still fires on the step that lands on it.
 */
function dueBy(offsetSeconds: number, atSeconds: number): boolean {
  const tolerance =
    Math.max(Math.abs(offsetSeconds), Math.abs(atSeconds)) * Number.EPSILON * 16;
  return offsetSeconds <= atSeconds + tolerance;
}

/**
 * Plan V23 Q05-Q09: every volley of `marks` whose offset is in the half-open
 * span (`fromOffsetSeconds`, `toOffsetSeconds`], in time order. Without a
 * period the marks fire once. With one, cycle `k` is the marks shifted by
 * `k * periodSeconds`; a cycle whose first volley is after the stop does not
 * start, and a started cycle finishes. Each cycle is computed from `k`
 * directly so error never accumulates, and only the cycles that can reach
 * the span are visited.
 */
export function markedVolleysBetween(
  marks: AttackMarks,
  fromOffsetSeconds: number,
  toOffsetSeconds: number,
): MarkedVolley[] {
  const { bursts, periodSeconds, stopAfterSeconds } = marks;
  const first = bursts[0][0];
  const last = bursts[bursts.length - 1][bursts[bursts.length - 1].length - 1];
  let firstCycle = 0;
  let lastCycle = 0;
  if (periodSeconds !== undefined) {
    firstCycle = Math.max(0, Math.floor((fromOffsetSeconds - last) / periodSeconds) - 1);
    lastCycle = Math.floor((toOffsetSeconds - first) / periodSeconds) + 1;
  }
  const volleys: MarkedVolley[] = [];
  for (let cycle = firstCycle; cycle <= lastCycle; cycle++) {
    const shift = periodSeconds === undefined ? 0 : cycle * periodSeconds;
    if (stopAfterSeconds !== undefined && !dueBy(first + shift, stopAfterSeconds)) break;
    for (let burst = 0; burst < bursts.length; burst++) {
      for (let shot = 0; shot < bursts[burst].length; shot++) {
        const offsetSeconds = bursts[burst][shot] + shift;
        if (dueBy(offsetSeconds, toOffsetSeconds) && !dueBy(offsetSeconds, fromOffsetSeconds))
          volleys.push({
            offsetSeconds,
            burstIndex: cycle * bursts.length + burst,
            shotIndex: shot,
          });
      }
    }
  }
  if (periodSeconds !== undefined)
    volleys.sort(
      (a, b) =>
        a.offsetSeconds - b.offsetSeconds ||
        a.burstIndex - b.burstIndex ||
        a.shotIndex - b.shotIndex,
    );
  return volleys;
}

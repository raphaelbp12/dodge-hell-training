/**
 * Groups a track's marks into bursts (plan V20 E06, plan V23 Q09) and pairs
 * bomb throws with detonations (E08). Pure: no video, DOM or React. The
 * cadence fit itself was removed by plan V23 Q17.
 */
import type { Mark } from "./study";

/** E06: the automatic split needs the longest gap to be at least this many times the shortest. */
export const BURST_GAP_SPLIT_RATIO = 3;

/** Null for an empty list. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export type GapClass = "within-burst" | "cooldown";

/** Splits gaps automatically (E06, Q09). Returns the threshold used, or null when every gap is a cooldown. */
export function splitGaps(
  gaps: readonly number[],
): Readonly<{ thresholdSeconds: number | null; classes: readonly GapClass[] }> {
  const threshold = automaticThreshold(gaps);
  return {
    thresholdSeconds: threshold,
    classes: gaps.map((gap) => (threshold !== null && gap < threshold ? "within-burst" : "cooldown")),
  };
}

function automaticThreshold(gaps: readonly number[]): number | null {
  const sorted = [...gaps].sort((first, second) => first - second);
  let bestRatio = 0;
  let bestIndex = -1;
  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const ratio = sorted[index] > 0 ? sorted[index + 1] / sorted[index] : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestIndex = index;
    }
  }
  if (bestIndex < 0 || bestRatio < BURST_GAP_SPLIT_RATIO) return null;
  return Math.sqrt(sorted[bestIndex] * sorted[bestIndex + 1]);
}

export type DetonationPair = Readonly<{ throwSeconds: number; detonationSeconds: number }>;

/** E08: each throw takes the first detonation after it and before the next throw; unpaired marks are ignored. */
export function pairDetonations(marks: readonly Mark[]): readonly DetonationPair[] {
  const sorted = [...marks].sort((first, second) => first.timeSeconds - second.timeSeconds);
  const pairs: DetonationPair[] = [];
  sorted.forEach((mark, index) => {
    if (mark.kind !== "volley") return;
    for (const later of sorted.slice(index + 1)) {
      if (later.kind === "volley") return;
      if (later.timeSeconds > mark.timeSeconds) {
        pairs.push({ throwSeconds: mark.timeSeconds, detonationSeconds: later.timeSeconds });
        return;
      }
    }
  });
  return pairs;
}

/**
 * Derives a cadence from a track's marks (plan V20 E06) and pairs bomb throws
 * with detonations (E08). Pure: no video, DOM or React.
 */
import { windowAt, type Mark, type SegmentWindow } from "./study";

/** E06: the automatic split needs the longest gap to be at least this many times the shortest. */
export const BURST_GAP_SPLIT_RATIO = 3;

/** Guards the prediction loop of the residual against a degenerate cadence. */
const MAX_PREDICTED_VOLLEYS = 10_000;

export type CadenceFit = Readonly<{
  shotsPerBurst: number | null;
  shotIntervalSeconds: number | null;
  cooldownAfterLastShotSeconds: number | null;
  initialDelaySeconds: number | null;
  thresholdSeconds: number | null;
  maxResidualSeconds: number | null;
  volleyCount: number;
  completeBurstCount: number;
}>;

/** Null for an empty list. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The time of volley `index` of a cadence from `startSeconds`, computed directly so error never accumulates. */
export function predictedVolleyTime(
  startSeconds: number,
  cadence: Readonly<{
    shotsPerBurst: number;
    shotIntervalSeconds: number;
    cooldownAfterLastShotSeconds: number;
  }>,
  index: number,
): number {
  const perBurst = cadence.shotsPerBurst;
  const interval = cadence.shotIntervalSeconds;
  const burstPeriod = (perBurst - 1) * interval + cadence.cooldownAfterLastShotSeconds;
  return startSeconds + Math.floor(index / perBurst) * burstPeriod + (index % perBurst) * interval;
}

/** A guard on a near-zero cooldown, not a game value (plan V20 step 86.3). */
export const MAX_PREDICTED_VOLLEYS_PER_WINDOW = 2000;

/**
 * The timeline's faint ticks: each window's predicted volleys from its epoch
 * plus the initial delay while below the window's end, capped per window.
 */
export function predictedTimesInWindows(
  windows: readonly SegmentWindow[],
  cadence: Readonly<{
    shotsPerBurst: number;
    shotIntervalSeconds: number;
    cooldownAfterLastShotSeconds: number;
    initialDelaySeconds: number;
  }>,
): readonly number[] {
  const times: number[] = [];
  for (const window of windows) {
    const start = window.epochSeconds + cadence.initialDelaySeconds;
    for (let index = 0; index < MAX_PREDICTED_VOLLEYS_PER_WINDOW; index += 1) {
      const time = predictedVolleyTime(start, cadence, index);
      if (!(time < window.endSeconds)) break;
      times.push(time);
    }
  }
  return times;
}

export type GapClass = "within-burst" | "cooldown";

/** Splits gaps at `thresholdSeconds` when given, else automatically (E06). Returns the threshold used, or null when every gap is a cooldown. */
export function splitGaps(
  gaps: readonly number[],
  thresholdSeconds?: number,
): Readonly<{ thresholdSeconds: number | null; classes: readonly GapClass[] }> {
  const threshold = thresholdSeconds ?? automaticThreshold(gaps);
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

type Group = Readonly<{ window: SegmentWindow; times: readonly number[] }>;

function groupsOf(times: readonly number[], windows: readonly SegmentWindow[]): Group[] {
  const byWindow = new Map<SegmentWindow, number[]>();
  for (const time of times) {
    const window = windowAt(windows, time);
    if (window === null) continue;
    const list = byWindow.get(window) ?? [];
    list.push(time);
    byWindow.set(window, list);
  }
  return [...byWindow].map(([window, list]) => ({ window, times: list }));
}

function gapsOf(times: readonly number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index]);
}

/** The most common value; ties go to the smaller. */
function modeOf(values: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [value, count] of counts)
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  return best;
}

function maxResidual(
  groups: readonly Group[],
  cadence: Parameters<typeof predictedVolleyTime>[1],
): number {
  let worst = 0;
  for (const { times } of groups) {
    const last = times[times.length - 1];
    const predictions: number[] = [];
    for (let index = 0; index < MAX_PREDICTED_VOLLEYS; index += 1) {
      const time = predictedVolleyTime(times[0], cadence, index);
      predictions.push(time);
      if (time > last) break;
    }
    for (const time of times) {
      const nearest = Math.min(...predictions.map((predicted) => Math.abs(predicted - time)));
      worst = Math.max(worst, nearest);
    }
  }
  return worst;
}

/** E06, in the seven steps of plan step 84.2. */
export function fitCadence(
  input: Readonly<{
    marks: readonly Mark[];
    windows: readonly SegmentWindow[];
    thresholdSeconds?: number;
  }>,
): CadenceFit {
  const times = input.marks
    .filter((mark) => mark.kind === "volley")
    .map((mark) => mark.timeSeconds)
    .sort((first, second) => first - second);
  const groups = groupsOf(times, input.windows);
  const initialDelaySeconds = medianOf(
    groups.map((group) => Math.max(0, group.times[0] - group.window.epochSeconds)),
  );
  const groupGaps = groups.map((group) => gapsOf(group.times));
  const gaps = groupGaps.flat();
  if (gaps.length === 0)
    return {
      shotsPerBurst: groups.length > 0 ? 1 : null,
      shotIntervalSeconds: null,
      cooldownAfterLastShotSeconds: null,
      initialDelaySeconds,
      thresholdSeconds: null,
      maxResidualSeconds: null,
      volleyCount: times.length,
      completeBurstCount: 0,
    };
  const split = splitGaps(gaps, input.thresholdSeconds);
  const within: number[] = [];
  const cooldowns: number[] = [];
  const burstSizes: number[] = [];
  let offset = 0;
  for (const list of groupGaps) {
    let size = 1;
    list.forEach((gap, index) => {
      if (split.classes[offset + index] === "within-burst") {
        within.push(gap);
        size += 1;
      } else {
        cooldowns.push(gap);
        burstSizes.push(size);
        size = 1;
      }
    });
    offset += list.length;
  }
  const shotsPerBurst =
    burstSizes.length > 0 ? modeOf(burstSizes) : within.length === 0 ? 1 : null;
  const shotIntervalSeconds =
    shotsPerBurst === null || shotsPerBurst === 1 ? null : medianOf(within);
  const cooldownAfterLastShotSeconds = medianOf(cooldowns);
  const known =
    shotsPerBurst !== null &&
    cooldownAfterLastShotSeconds !== null &&
    initialDelaySeconds !== null &&
    (shotsPerBurst === 1 || shotIntervalSeconds !== null);
  return {
    shotsPerBurst,
    shotIntervalSeconds,
    cooldownAfterLastShotSeconds,
    initialDelaySeconds,
    thresholdSeconds: split.thresholdSeconds,
    maxResidualSeconds: known
      ? maxResidual(groups, {
          shotsPerBurst,
          shotIntervalSeconds: shotIntervalSeconds ?? 0,
          cooldownAfterLastShotSeconds,
        })
      : null,
    volleyCount: times.length,
    completeBurstCount: burstSizes.length,
  };
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

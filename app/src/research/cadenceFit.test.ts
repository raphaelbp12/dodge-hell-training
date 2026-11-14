import { describe, expect, test } from "vitest";
import {
  fitCadence,
  medianOf,
  pairDetonations,
  predictedVolleyTime,
  predictedTimesInWindows,
  MAX_PREDICTED_VOLLEYS_PER_WINDOW,
  splitGaps,
} from "./cadenceFit";
import type { Mark, SegmentWindow } from "./study";

const volleys = (...times: number[]): Mark[] =>
  times.map((timeSeconds) => ({ timeSeconds, kind: "volley" }));
const window = (startSeconds: number, endSeconds: number, epochSeconds = startSeconds): SegmentWindow => ({
  segmentId: "a",
  startSeconds,
  epochSeconds,
  endSeconds,
});

describe("helpers", () => {
  test("medianOf", () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });

  test("predictedVolleyTime walks bursts", () => {
    const cadence = { shotsPerBurst: 3, shotIntervalSeconds: 0.1, cooldownAfterLastShotSeconds: 1 };
    expect(predictedVolleyTime(5, cadence, 4)).toBeCloseTo(6.3);
  });
});

describe("fitCadence", () => {
  test("three-shot bursts", () => {
    const fit = fitCadence({ marks: volleys(0, 0.1, 0.2, 2.0, 2.1, 2.2), windows: [window(0, 10)] });
    expect(fit.shotsPerBurst).toBe(3);
    expect(fit.shotIntervalSeconds).toBeCloseTo(0.1);
    expect(fit.cooldownAfterLastShotSeconds).toBeCloseTo(1.8);
    expect(fit.initialDelaySeconds).toBe(0);
    expect(fit.maxResidualSeconds).toBeCloseTo(0);
    expect(fit.volleyCount).toBe(6);
    expect(fit.completeBurstCount).toBe(1);
  });

  test("an offset after the epoch is the initial delay", () => {
    const fit = fitCadence({
      marks: volleys(0.5, 0.6, 0.7, 2.5, 2.6, 2.7),
      windows: [window(0, 10)],
    });
    expect(fit.initialDelaySeconds).toBeCloseTo(0.5);
    expect(fit.shotsPerBurst).toBe(3);
  });

  test("evenly spaced single shots", () => {
    const fit = fitCadence({ marks: volleys(0, 1, 2, 3), windows: [window(0, 10)] });
    expect(fit.shotsPerBurst).toBe(1);
    expect(fit.cooldownAfterLastShotSeconds).toBe(1);
    expect(fit.shotIntervalSeconds).toBeNull();
    expect(fit.maxResidualSeconds).toBe(0);
  });

  test("a single mark", () => {
    const fit = fitCadence({ marks: volleys(2), windows: [window(0, 10)] });
    expect(fit.shotsPerBurst).toBe(1);
    expect(fit.cooldownAfterLastShotSeconds).toBeNull();
    expect(fit.maxResidualSeconds).toBeNull();
    expect(fitCadence({ marks: [], windows: [window(0, 10)] }).shotsPerBurst).toBeNull();
  });

  test("an ambiguous split makes every gap a cooldown", () => {
    expect(splitGaps([0.1, 0.1, 0.2])).toEqual({
      thresholdSeconds: null,
      classes: ["cooldown", "cooldown", "cooldown"],
    });
  });

  test("an explicit threshold splits the ambiguous gaps", () => {
    const fit = fitCadence({
      marks: volleys(0, 0.1, 0.2, 0.4),
      windows: [window(0, 10)],
      thresholdSeconds: 0.15,
    });
    expect(fit.shotsPerBurst).toBe(3);
    expect(fit.thresholdSeconds).toBe(0.15);
  });

  test("no gap spans a window boundary", () => {
    const fit = fitCadence({
      marks: volleys(1, 2, 5.5, 6.5),
      windows: [window(0, 5), window(5, 10)],
    });
    expect(fit.cooldownAfterLastShotSeconds).toBe(1);
    expect(fit.initialDelaySeconds).toBeCloseTo(0.75);
  });

  test("marks outside every window are ignored and detonations are not volleys", () => {
    const fit = fitCadence({
      marks: [...volleys(1, 3), { timeSeconds: 2, kind: "detonation" }],
      windows: [window(2, 10)],
    });
    expect(fit.volleyCount).toBe(2);
    expect(fit.cooldownAfterLastShotSeconds).toBeNull();
  });
});

describe("pairDetonations", () => {
  test("pairs each throw with the next detonation before the next throw", () => {
    const marks: Mark[] = [
      { timeSeconds: 0, kind: "volley" },
      { timeSeconds: 1.2, kind: "detonation" },
      { timeSeconds: 3, kind: "volley" },
      { timeSeconds: 4, kind: "volley" },
      { timeSeconds: 5, kind: "detonation" },
    ];
    expect(pairDetonations(marks)).toEqual([
      { throwSeconds: 0, detonationSeconds: 1.2 },
      { throwSeconds: 4, detonationSeconds: 5 },
    ]);
  });
});

describe("predictedTimesInWindows", () => {
  const cadence = {
    shotsPerBurst: 2,
    shotIntervalSeconds: 0.5,
    cooldownAfterLastShotSeconds: 2,
    initialDelaySeconds: 1,
  };

  test("walks each window from its epoch plus the initial delay to its end", () => {
    expect(predictedTimesInWindows([window(0, 5, 1), window(10, 11)], cadence)).toEqual([2, 2.5, 4.5]);
  });

  test("caps a near-zero cooldown", () => {
    const fast = { ...cadence, shotsPerBurst: 1, cooldownAfterLastShotSeconds: 0 };
    expect(predictedTimesInWindows([window(0, 5)], fast)).toHaveLength(MAX_PREDICTED_VOLLEYS_PER_WINDOW);
  });
});

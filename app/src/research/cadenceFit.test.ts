import { describe, expect, test } from "vitest";
import { medianOf, pairDetonations, splitGaps } from "./cadenceFit";
import type { Mark } from "./study";

describe("helpers", () => {
  test("medianOf", () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("splitGaps", () => {
  test("a clear ratio splits short gaps inside a burst from long cooldowns", () => {
    const split = splitGaps([0.1, 0.1, 1.8, 0.1, 0.1]);
    expect(split.thresholdSeconds).toBeCloseTo(Math.sqrt(0.1 * 1.8));
    expect(split.classes).toEqual(["within-burst", "within-burst", "cooldown", "within-burst", "within-burst"]);
  });

  test("an ambiguous split makes every gap a cooldown", () => {
    expect(splitGaps([0.1, 0.1, 0.2])).toEqual({
      thresholdSeconds: null,
      classes: ["cooldown", "cooldown", "cooldown"],
    });
  });

  test("zero gaps never set the ratio, so duplicates alone split nothing", () => {
    expect(splitGaps([0, 0]).thresholdSeconds).toBeNull();
    expect(splitGaps([]).classes).toEqual([]);
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

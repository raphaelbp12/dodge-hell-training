import { expect, test } from "vitest";
import {
  arbitrarySeed,
  assertSeed,
  nextSeed,
  unitFromSeed,
} from "./random";

const sequence = (seed: number, count: number): number[] => {
  let state = assertSeed(seed);
  return Array.from({ length: count }, () => {
    state = nextSeed(state);
    return unitFromSeed(state);
  });
};

test("the same seed replays the same sequence", () => {
  expect(sequence(42, 50)).toEqual(sequence(42, 50));
});

test("values stay in [0, 1) and different seeds diverge", () => {
  const values = sequence(7, 500);
  for (const value of values) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
  expect(new Set(values).size).toBeGreaterThan(400);
  expect(sequence(8, 20)).not.toEqual(values.slice(0, 20));
});

test("the generator is pure in its seed, so advancing is reproducible", () => {
  const first = nextSeed(assertSeed(99));
  expect(nextSeed(assertSeed(99))).toBe(first);
  expect(unitFromSeed(first)).toBe(unitFromSeed(first));
});

test("rejects a nonfinite seed and truncates to 32 bits", () => {
  expect(() => assertSeed(Number.NaN)).toThrow(RangeError);
  expect(() => assertSeed(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  expect(assertSeed(-1)).toBe(4294967295);
  expect(assertSeed(3.9)).toBe(3);
  expect(Number.isSafeInteger(arbitrarySeed())).toBe(true);
});

import { describe, expect, test } from "vitest";
import {
  markerFractions,
  nextVolleyTime,
  previousVolleyTime,
  volleyStepTolerance,
} from "./timelineModel";

describe("markerFractions", () => {
  test("is empty for no times or no duration", () => {
    expect(markerFractions([], 100)).toEqual([]);
    expect(markerFractions([5], 0)).toEqual([]);
  });

  test("sorts, collapses ties and clamps", () => {
    expect(markerFractions([50, 25, 25, 150, -3], 100)).toEqual([0, 0.25, 0.5, 1]);
  });
});

describe("previous and next volley", () => {
  const times = [10, 20, 20, 30];

  test("return null at both ends and for an empty list", () => {
    expect(previousVolleyTime([], 5, 0)).toBeNull();
    expect(nextVolleyTime([], 5, 0)).toBeNull();
    expect(previousVolleyTime(times, 10, 0)).toBeNull();
    expect(nextVolleyTime(times, 30, 0)).toBeNull();
  });

  test("move across a tie once", () => {
    expect(nextVolleyTime(times, 10, 0)).toBe(20);
    expect(nextVolleyTime(times, 20, 0)).toBe(30);
    expect(previousVolleyTime(times, 30, 0)).toBe(20);
    expect(previousVolleyTime(times, 20, 0)).toBe(10);
  });

  test("a press from a marker's own frame moves on when the tolerance covers it", () => {
    const tolerance = volleyStepTolerance(60);
    expect(nextVolleyTime(times, 20.003, tolerance)).toBe(30);
    expect(previousVolleyTime(times, 20.003, tolerance)).toBe(10);
  });

  test("work between markers", () => {
    expect(nextVolleyTime(times, 15, 0)).toBe(20);
    expect(previousVolleyTime(times, 15, 0)).toBe(10);
  });
});

describe("volleyStepTolerance", () => {
  test("is half a frame, or zero without a rate", () => {
    expect(volleyStepTolerance(50)).toBeCloseTo(0.01);
    expect(volleyStepTolerance(null)).toBe(0);
  });
});

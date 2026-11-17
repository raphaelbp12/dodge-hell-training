import { describe, expect, test } from "vitest";
import { firstArmCollisionDegrees, sectorWidthDegrees, totalCoverageDegrees } from "./sectors";

const FULL_CIRCLE_DEGREES = 360;

describe("sectorWidthDegrees", () => {
  test("is the clockwise span from the start to the end", () => {
    expect(sectorWidthDegrees(10, 70)).toBe(60);
  });

  test("wraps across zero when the end is numerically smaller", () => {
    expect(sectorWidthDegrees(350, 10)).toBe(20);
  });

  test("a zero span is an empty sector", () => {
    expect(sectorWidthDegrees(90, 90)).toBe(0);
  });

  test("a nonzero span of whole turns is a full circle, not an empty sector", () => {
    expect(sectorWidthDegrees(0, FULL_CIRCLE_DEGREES)).toBe(FULL_CIRCLE_DEGREES);
    expect(sectorWidthDegrees(30, 30 + 2 * FULL_CIRCLE_DEGREES)).toBe(FULL_CIRCLE_DEGREES);
  });

  test("normalises a negative start", () => {
    expect(sectorWidthDegrees(-30, 30)).toBe(60);
  });
});

describe("totalCoverageDegrees", () => {
  test("no sectors cover nothing", () => {
    expect(totalCoverageDegrees([])).toBe(0);
  });

  test("adds separate sectors", () => {
    expect(totalCoverageDegrees([[0, 30], [100, 150]])).toBe(80);
  });

  test("counts overlapping sectors once", () => {
    expect(totalCoverageDegrees([[0, 100], [50, 150]])).toBe(150);
  });

  test("a sector inside another adds nothing", () => {
    expect(totalCoverageDegrees([[0, 200], [50, 100]])).toBe(200);
  });

  test("a sector that wraps across zero is counted in full", () => {
    expect(totalCoverageDegrees([[350, 10]])).toBe(20);
  });

  test("a wrapping sector overlapping a plain one is counted once", () => {
    expect(totalCoverageDegrees([[350, 20], [10, 40]])).toBe(50);
  });

  test("an empty sector contributes nothing and the order of sectors does not matter", () => {
    expect(totalCoverageDegrees([[90, 90], [200, 220], [0, 10]])).toBe(30);
    expect(totalCoverageDegrees([[0, 10], [200, 220], [90, 90]])).toBe(30);
  });

  test("two full circles cover one circle", () => {
    expect(totalCoverageDegrees([[0, FULL_CIRCLE_DEGREES], [10, 10 + FULL_CIRCLE_DEGREES]])).toBe(FULL_CIRCLE_DEGREES);
  });
});

describe("firstArmCollisionDegrees", () => {
  test("is 360 over arms times arms minus one", () => {
    expect(firstArmCollisionDegrees(4)).toBe(FULL_CIRCLE_DEGREES / (4 * 3));
    expect(firstArmCollisionDegrees(2)).toBe(FULL_CIRCLE_DEGREES / 2);
  });

  test("a single arm never collides with itself", () => {
    expect(firstArmCollisionDegrees(1)).toBe(Number.POSITIVE_INFINITY);
  });
});

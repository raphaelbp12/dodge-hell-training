import { expect, test } from "vitest";
import { firstArmCollisionDegrees, totalCoverageDegrees } from "./sectors";

test("a ring with fewer than two arms never collides", () => {
  expect(firstArmCollisionDegrees(0)).toBe(Number.POSITIVE_INFINITY);
  expect(firstArmCollisionDegrees(1)).toBe(Number.POSITIVE_INFINITY);
});

test("the first collision spread is 360 / (arms * (arms - 1))", () => {
  expect(firstArmCollisionDegrees(2)).toBe(180);
  expect(firstArmCollisionDegrees(3)).toBe(60);
});

test("no sectors cover nothing", () => {
  expect(totalCoverageDegrees([])).toBe(0);
});

test("unsorted, overlapping and nested sectors are counted once", () => {
  expect(
    totalCoverageDegrees([
      [200, 220],
      [10, 40],
      [30, 60],
      [15, 20],
    ]),
  ).toBe(70);
});

test("a sector that wraps across zero is split and merged", () => {
  expect(totalCoverageDegrees([[350, 20]])).toBe(30);
  expect(
    totalCoverageDegrees([
      [350, 20],
      [10, 30],
    ]),
  ).toBe(40);
});

test("a full circle covers 360 and zero-width sectors add nothing", () => {
  expect(totalCoverageDegrees([[0, 360]])).toBe(360);
  expect(totalCoverageDegrees([[45, 45]])).toBe(0);
});

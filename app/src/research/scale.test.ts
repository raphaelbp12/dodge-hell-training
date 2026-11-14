import { expect, test } from "vitest";
import { distanceTiles, tileWidthFractionOf } from "./scale";

const point = (xFraction: number, yFraction: number) => ({ xFraction, yFraction });

test("a horizontal drag of 0.2 of the width over a 2-tile body gives 0.1", () => {
  expect(tileWidthFractionOf(point(0.3, 0.5), point(0.5, 0.5), 2, 0.5625)).toBeCloseTo(0.1, 12);
});

test("a vertical drag is converted to width units by the aspect ratio", () => {
  // 0.4 of a height that is half the width is 0.2 of the width.
  expect(tileWidthFractionOf(point(0.5, 0.1), point(0.5, 0.5), 2, 0.5)).toBeCloseTo(0.1, 12);
});

test("distanceTiles of two points 0.1 apart horizontally with scale 0.1 is 1", () => {
  expect(distanceTiles(point(0.2, 0.4), point(0.3, 0.4), 0.1, 0.75)).toBeCloseTo(1, 12);
});

test("a zero-length drag, a non-positive body width and a non-positive scale are refused", () => {
  expect(() => tileWidthFractionOf(point(0.2, 0.2), point(0.2, 0.2), 2, 1)).toThrow(RangeError);
  expect(() => tileWidthFractionOf(point(0.2, 0.2), point(0.4, 0.2), 0, 1)).toThrow(RangeError);
  expect(() => distanceTiles(point(0.2, 0.2), point(0.4, 0.2), 0, 1)).toThrow(RangeError);
});

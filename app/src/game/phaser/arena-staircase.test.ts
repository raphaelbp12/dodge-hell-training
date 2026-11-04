import { describe, expect, test } from "vitest";
import {
  octagonRowHalfWidthTiles,
  octagonStaircaseRows,
} from "./arena-staircase";

const nestOctagon = {
  kind: "octagon" as const,
  centerTiles: { x: 0, y: 0 },
  flatHalfWidthTiles: 9.5,
  cornerSumTiles: 14.25,
};

describe("octagonRowHalfWidthTiles", () => {
  test("is capped at the rounded flat half-width near the centre row", () => {
    for (let row = -5; row <= 5; row++) {
      expect(octagonRowHalfWidthTiles(row, nestOctagon)).toBe(10);
    }
  });

  test("falls by exactly one tile per row once the corner face is the binding constraint", () => {
    const rows = [6, 7, 8, 9, 10, 11, 12, 13, 14];
    const halfWidths = rows.map((row) => octagonRowHalfWidthTiles(row, nestOctagon));
    for (let index = 1; index < halfWidths.length; index++) {
      expect(halfWidths[index]).toBe(halfWidths[index - 1] - 1);
    }
    expect(halfWidths[halfWidths.length - 1]).toBe(1);
  });

  test("is zero once the row lies outside the octagon's corner sum", () => {
    expect(octagonRowHalfWidthTiles(15, nestOctagon)).toBe(0);
    expect(octagonRowHalfWidthTiles(100, nestOctagon)).toBe(0);
  });

  test("is symmetric about the centre row", () => {
    for (let row = -14; row <= 14; row++) {
      expect(octagonRowHalfWidthTiles(row, nestOctagon)).toBe(
        octagonRowHalfWidthTiles(-row, nestOctagon),
      );
    }
  });

  test("never exceeds the rounded-outward flat half-width", () => {
    for (let row = -20; row <= 20; row++) {
      expect(octagonRowHalfWidthTiles(row, nestOctagon)).toBeLessThanOrEqual(
        Math.ceil(nestOctagon.flatHalfWidthTiles),
      );
    }
  });
});

describe("octagonStaircaseRows", () => {
  test("only lists rows with a positive half-width, in ascending row order", () => {
    const rows = octagonStaircaseRows(nestOctagon);
    expect(rows.every((row) => row.halfWidthTiles > 0)).toBe(true);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].rowCenterTiles).toBeGreaterThan(
        rows[index - 1].rowCenterTiles,
      );
    }
    expect(rows[0].rowCenterTiles).toBe(-14);
    expect(rows[rows.length - 1].rowCenterTiles).toBe(14);
  });

  test("is symmetric about the centre row in both axes", () => {
    const rows = octagonStaircaseRows(nestOctagon);
    const byRow = new Map(rows.map((row) => [row.rowCenterTiles, row.halfWidthTiles]));
    for (const row of rows) {
      expect(byRow.get(-row.rowCenterTiles)).toBe(row.halfWidthTiles);
    }
  });
});

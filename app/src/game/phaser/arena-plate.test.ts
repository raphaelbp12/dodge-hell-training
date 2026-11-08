import { expect, test } from "vitest";
import { arenaExtentTiles, octagonBoundaryPath } from "./arena-plate";

const octagon = {
  kind: "octagon",
  centerTiles: { x: 0, y: 0 },
  flatHalfWidthTiles: 9.5,
  cornerSumTiles: 14.25,
} as const;

test("a circle's extent is its radius", () => {
  expect(
    arenaExtentTiles({ kind: "circle", centerTiles: { x: 0, y: 0 }, radiusTiles: 19.2 }),
  ).toBe(19.2);
});

test("an octagon's extent covers its corners and its path is closed", () => {
  expect(arenaExtentTiles(octagon)).toBeGreaterThanOrEqual(14.25);
  const path = octagonBoundaryPath(octagon);
  expect(path.startsWith("M")).toBe(true);
  expect(path.endsWith("Z")).toBe(true);
});

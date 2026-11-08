import type { ArenaShape } from "../models";
import { octagonStaircaseRows, type OctagonArenaShape } from "./arena-staircase";

/** Half the width of the square that holds the whole arena, in tiles. */
export function arenaExtentTiles(shape: ArenaShape): number {
  if (shape.kind === "circle") return shape.radiusTiles;
  return Math.max(
    ...octagonStaircaseRows(shape).map((row) =>
      Math.max(row.halfWidthTiles, Math.abs(row.rowCenterTiles) + 0.5),
    ),
  );
}

/** The stepped octagon boundary as an SVG path, in tiles from the centre. */
export function octagonBoundaryPath(shape: OctagonArenaShape): string {
  const rows = octagonStaircaseRows(shape);
  const right = rows.flatMap((row) => [
    [row.halfWidthTiles, row.rowCenterTiles - 0.5],
    [row.halfWidthTiles, row.rowCenterTiles + 0.5],
  ]);
  const left = [...rows].reverse().flatMap((row) => [
    [-row.halfWidthTiles, row.rowCenterTiles + 0.5],
    [-row.halfWidthTiles, row.rowCenterTiles - 0.5],
  ]);
  return `M${[...right, ...left].map(([x, y]) => `${x} ${y}`).join("L")}Z`;
}

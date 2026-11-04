import type { ArenaShape } from "../models";

export type OctagonArenaShape = Extract<ArenaShape, { kind: "octagon" }>;

export type StaircaseRow = Readonly<{
  /** The tile row's y centre, in tiles from the arena centre. */
  rowCenterTiles: number;
  /** Half-width of the row, rounded outward to a whole tile. */
  halfWidthTiles: number;
}>;

/**
 * The octagon's half-width at one tile row, rounded outward (ceil) to a
 * whole tile so the stepped outline never cuts inside the true boundary
 * (plan V10 step 38.4). Zero once the row lies entirely outside the octagon.
 */
export function octagonRowHalfWidthTiles(
  rowCenterTiles: number,
  octagon: OctagonArenaShape,
): number {
  const rawHalfWidthTiles = Math.min(
    octagon.flatHalfWidthTiles,
    octagon.cornerSumTiles - Math.abs(rowCenterTiles),
  );
  return rawHalfWidthTiles <= 0 ? 0 : Math.ceil(rawHalfWidthTiles);
}

/**
 * Every tile row the octagon covers, centred on the arena's own centre row,
 * with its rounded-outward half-width - the pure derivation `drawGround`
 * strokes as the boundary staircase. Nothing is stored; this is recomputed
 * at draw time from the authored shape alone.
 */
export function octagonStaircaseRows(
  octagon: OctagonArenaShape,
): readonly StaircaseRow[] {
  const maxRow = Math.ceil(octagon.cornerSumTiles);
  const rows: StaircaseRow[] = [];
  for (let row = -maxRow; row <= maxRow; row++) {
    const halfWidthTiles = octagonRowHalfWidthTiles(row, octagon);
    if (halfWidthTiles > 0) rows.push({ rowCenterTiles: row, halfWidthTiles });
  }
  return rows;
}

import type { HazardBand, Vector2 } from "../models";

/**
 * Pure region-to-outline conversion for drawing: resolves each hazard's exact
 * drawable shape (diamond vertices, or an annulus's inner/outer radius),
 * centred on the arena's own centre - the caller offsets by that centre and
 * the tile-to-pixel scale. No Phaser, no DOM; `drawGround` consumes this to
 * draw the honey ponds as their true shapes, not an approximation.
 */
export type DiamondOutline = Readonly<{
  kind: "diamond";
  /** Ordered (east, south, west, north) so a caller can draw them as a polygon directly. */
  verticesTiles: readonly Vector2[];
}>;

export type AnnulusOutline = Readonly<{
  kind: "annulus";
  innerRadiusTiles: number;
  outerRadiusTiles: number;
}>;

export type HazardOutline = DiamondOutline | AnnulusOutline;

export function hazardOutlinesOf(
  hazards: readonly HazardBand[],
): readonly HazardOutline[] {
  return hazards.map(({ region }): HazardOutline => {
    if (region.shape === "diamond") {
      const { halfDiagonalTiles } = region;
      return {
        kind: "diamond",
        verticesTiles: [
          { x: halfDiagonalTiles, y: 0 },
          { x: 0, y: halfDiagonalTiles },
          { x: -halfDiagonalTiles, y: 0 },
          { x: 0, y: -halfDiagonalTiles },
        ],
      };
    }
    return {
      kind: "annulus",
      innerRadiusTiles: region.innerRadiusTiles,
      outerRadiusTiles: region.outerRadiusTiles,
    };
  });
}

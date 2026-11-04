import { describe, expect, it } from "vitest";
import { hazardOutlinesOf } from "./terrain-art";

describe("hazardOutlinesOf", () => {
  it("produces a diamond outline with vertices on each axis at the half-diagonal", () => {
    const outlines = hazardOutlinesOf([
      { kind: "honey", region: { shape: "diamond", halfDiagonalTiles: 3.5 } },
    ]);
    expect(outlines).toEqual([
      {
        kind: "diamond",
        verticesTiles: [
          { x: 3.5, y: 0 },
          { x: 0, y: 3.5 },
          { x: -3.5, y: 0 },
          { x: 0, y: -3.5 },
        ],
      },
    ]);
  });

  it("produces the annulus's own inner and outer radius", () => {
    const outlines = hazardOutlinesOf([
      {
        kind: "honey",
        region: { shape: "annulus", innerRadiusTiles: 7.5, outerRadiusTiles: 9.5 },
      },
    ]);
    expect(outlines).toEqual([
      { kind: "annulus", innerRadiusTiles: 7.5, outerRadiusTiles: 9.5 },
    ]);
  });

  it("produces no outlines for an empty hazards array", () => {
    expect(hazardOutlinesOf([])).toEqual([]);
  });
});

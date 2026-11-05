import { describe, expect, test } from "vitest";
import type { ArenaShape } from "../game/models";
import {
  arenaBoundsTiles,
  canvasToTile,
  fitView,
  octagonOutlineVertices,
  panBy,
  pixelsPerTile,
  playerSliderRanges,
  tileToCanvas,
  zoomAbout,
} from "./previewView";

const CIRCLE: ArenaShape = {
  kind: "circle",
  centerTiles: { x: 10, y: 20 },
  radiusTiles: 8,
};
const OCTAGON: ArenaShape = {
  kind: "octagon",
  centerTiles: { x: 0, y: 0 },
  flatHalfWidthTiles: 12,
  cornerSumTiles: 16,
};
const CANVAS = 480;

describe("arenaBoundsTiles", () => {
  test("circle and octagon bounds", () => {
    expect(arenaBoundsTiles(CIRCLE)).toEqual({ minX: 2, maxX: 18, minY: 12, maxY: 28 });
    expect(arenaBoundsTiles(OCTAGON)).toEqual({ minX: -12, maxX: 12, minY: -12, maxY: 12 });
  });
});

describe("scale and transform", () => {
  test("zoom 1 fits the bounds into a square canvas", () => {
    expect(pixelsPerTile(CIRCLE, CANVAS, 1)).toBe(30);
    expect(pixelsPerTile(OCTAGON, CANVAS, 4)).toBe(80);
  });

  test("the fitted centre maps to the canvas centre and round trips", () => {
    const view = fitView(CIRCLE);
    expect(tileToCanvas(CIRCLE.centerTiles, view, CIRCLE, CANVAS)).toEqual({ x: 240, y: 240 });
    const point = { x: 13.5, y: 22.25 };
    const back = canvasToTile(tileToCanvas(point, view, CIRCLE, CANVAS), view, CIRCLE, CANVAS);
    expect(back.x).toBeCloseTo(point.x, 9);
    expect(back.y).toBeCloseTo(point.y, 9);
  });
});

describe("zoomAbout", () => {
  const corner = { x: 400, y: 100 };

  test("steps up and down, stopping at 1 and 4", () => {
    let view = fitView(OCTAGON);
    view = zoomAbout(view, 1, corner, OCTAGON, CANVAS);
    expect(view.zoom).toBe(2);
    view = zoomAbout(view, 1, corner, OCTAGON, CANVAS);
    expect(view.zoom).toBe(4);
    expect(zoomAbout(view, 1, corner, OCTAGON, CANVAS)).toBe(view);
    view = zoomAbout(view, -1, corner, OCTAGON, CANVAS);
    view = zoomAbout(view, -1, corner, OCTAGON, CANVAS);
    expect(view.zoom).toBe(1);
    expect(zoomAbout(view, -1, corner, OCTAGON, CANVAS)).toBe(view);
  });

  test("keeps the tile under the cursor fixed", () => {
    const view = fitView(OCTAGON);
    const cursor = { x: 300, y: 260 };
    const before = canvasToTile(cursor, view, OCTAGON, CANVAS);
    const zoomed = zoomAbout(view, 1, cursor, OCTAGON, CANVAS);
    const after = canvasToTile(cursor, zoomed, OCTAGON, CANVAS);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
});

describe("panBy", () => {
  test("there is nothing to pan at zoom 1", () => {
    const view = fitView(OCTAGON);
    expect(panBy(view, { x: 90, y: -40 }, OCTAGON, CANVAS)).toEqual(view);
  });

  test("clamps at each edge of the bounds", () => {
    const zoomed = zoomAbout(fitView(OCTAGON), 1, { x: 240, y: 240 }, OCTAGON, CANVAS);
    const half = 240 / pixelsPerTile(OCTAGON, CANVAS, 2);
    const left = panBy(zoomed, { x: 99999, y: 0 }, OCTAGON, CANVAS);
    expect(left.centerTiles.x).toBeCloseTo(-12 + half, 9);
    const right = panBy(zoomed, { x: -99999, y: 0 }, OCTAGON, CANVAS);
    expect(right.centerTiles.x).toBeCloseTo(12 - half, 9);
    const top = panBy(zoomed, { x: 0, y: 99999 }, OCTAGON, CANVAS);
    expect(top.centerTiles.y).toBeCloseTo(-12 + half, 9);
    const bottom = panBy(zoomed, { x: 0, y: -99999 }, OCTAGON, CANVAS);
    expect(bottom.centerTiles.y).toBeCloseTo(12 - half, 9);
  });

  test("a drag moves the scene with the pointer", () => {
    const zoomed = zoomAbout(fitView(OCTAGON), 1, { x: 240, y: 240 }, OCTAGON, CANVAS);
    const panned = panBy(zoomed, { x: -20, y: 0 }, OCTAGON, CANVAS);
    expect(panned.centerTiles.x).toBeGreaterThan(zoomed.centerTiles.x);
  });
});

describe("playerSliderRanges", () => {
  test("ranges equal the arena bounds", () => {
    expect(playerSliderRanges(CIRCLE)).toEqual({ x: [2, 18], y: [12, 28] });
  });
});

describe("octagonOutlineVertices", () => {
  test("lies on the flat sides and the corner faces", () => {
    const vertices = octagonOutlineVertices({
      ...(OCTAGON as Extract<ArenaShape, { kind: "octagon" }>),
    });
    expect(vertices).toHaveLength(8);
    for (const { x, y } of vertices) {
      expect(Math.max(Math.abs(x), Math.abs(y))).toBe(12);
      expect(Math.abs(x) + Math.abs(y)).toBe(16);
    }
  });
});

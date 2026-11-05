import type { ArenaShape, Vector2 } from "../game/models";

export type PreviewZoom = 1 | 2 | 4;

export type PreviewView = Readonly<{
  zoom: PreviewZoom;
  /** World point at the canvas centre, clamped per M34. */
  centerTiles: Vector2;
}>;

export type TileBounds = Readonly<{
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

/** M27: the fixed zoom steps. */
export const PREVIEW_ZOOM_STEPS: readonly PreviewZoom[] = [1, 2, 4];

/** The arena's axis-aligned bounding box. */
export function arenaBoundsTiles(shape: ArenaShape): TileBounds {
  const halfTiles =
    shape.kind === "circle" ? shape.radiusTiles : shape.flatHalfWidthTiles;
  return {
    minX: shape.centerTiles.x - halfTiles,
    maxX: shape.centerTiles.x + halfTiles,
    minY: shape.centerTiles.y - halfTiles,
    maxY: shape.centerTiles.y + halfTiles,
  };
}

/** Zoom 1 centred on the bounds' centre. */
export function fitView(shape: ArenaShape): PreviewView {
  return { zoom: 1, centerTiles: { ...shape.centerTiles } };
}

/** Zoom 1 fits the larger bounds side into the canvas (M27). */
export function pixelsPerTile(
  shape: ArenaShape,
  canvasPixels: number,
  zoom: PreviewZoom,
): number {
  const bounds = arenaBoundsTiles(shape);
  const sideTiles = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  return (canvasPixels / sideTiles) * zoom;
}

export function tileToCanvas(
  tile: Vector2,
  view: PreviewView,
  shape: ArenaShape,
  canvasPixels: number,
): Vector2 {
  const scale = pixelsPerTile(shape, canvasPixels, view.zoom);
  return {
    x: canvasPixels / 2 + (tile.x - view.centerTiles.x) * scale,
    y: canvasPixels / 2 + (tile.y - view.centerTiles.y) * scale,
  };
}

export function canvasToTile(
  point: Vector2,
  view: PreviewView,
  shape: ArenaShape,
  canvasPixels: number,
): Vector2 {
  const scale = pixelsPerTile(shape, canvasPixels, view.zoom);
  return {
    x: view.centerTiles.x + (point.x - canvasPixels / 2) / scale,
    y: view.centerTiles.y + (point.y - canvasPixels / 2) / scale,
  };
}

function clampAxis(
  centre: number,
  min: number,
  max: number,
  halfVisibleTiles: number,
): number {
  if (max - min <= 2 * halfVisibleTiles) return (min + max) / 2;
  return Math.min(max - halfVisibleTiles, Math.max(min + halfVisibleTiles, centre));
}

/** M34: the visible area never leaves the bounds. */
export function clampView(
  view: PreviewView,
  shape: ArenaShape,
  canvasPixels: number,
): PreviewView {
  const bounds = arenaBoundsTiles(shape);
  const halfVisibleTiles = canvasPixels / 2 / pixelsPerTile(shape, canvasPixels, view.zoom);
  return {
    zoom: view.zoom,
    centerTiles: {
      x: clampAxis(view.centerTiles.x, bounds.minX, bounds.maxX, halfVisibleTiles),
      y: clampAxis(view.centerTiles.y, bounds.minY, bounds.maxY, halfVisibleTiles),
    },
  };
}

/**
 * Steps the zoom (+1 in, -1 out), stopping at the ends, and keeps the world
 * point under `canvasPoint` fixed where the clamp allows (M26).
 */
export function zoomAbout(
  view: PreviewView,
  direction: 1 | -1,
  canvasPoint: Vector2,
  shape: ArenaShape,
  canvasPixels: number,
): PreviewView {
  const index = PREVIEW_ZOOM_STEPS.indexOf(view.zoom) + direction;
  const zoom = PREVIEW_ZOOM_STEPS[index];
  if (zoom === undefined) return view;
  const anchor = canvasToTile(canvasPoint, view, shape, canvasPixels);
  const scale = pixelsPerTile(shape, canvasPixels, zoom);
  return clampView(
    {
      zoom,
      centerTiles: {
        x: anchor.x - (canvasPoint.x - canvasPixels / 2) / scale,
        y: anchor.y - (canvasPoint.y - canvasPixels / 2) / scale,
      },
    },
    shape,
    canvasPixels,
  );
}

/** Drags the scene with the pointer: the centre moves opposite the drag. */
export function panBy(
  view: PreviewView,
  deltaCanvasPixels: Vector2,
  shape: ArenaShape,
  canvasPixels: number,
): PreviewView {
  const scale = pixelsPerTile(shape, canvasPixels, view.zoom);
  return clampView(
    {
      zoom: view.zoom,
      centerTiles: {
        x: view.centerTiles.x - deltaCanvasPixels.x / scale,
        y: view.centerTiles.y - deltaCanvasPixels.y / scale,
      },
    },
    shape,
    canvasPixels,
  );
}

/** M23: slider ranges are the bounds' axes; the default is the player spawn. */
export function playerSliderRanges(shape: ArenaShape): Readonly<{
  x: readonly [number, number];
  y: readonly [number, number];
}> {
  const bounds = arenaBoundsTiles(shape);
  return { x: [bounds.minX, bounds.maxX], y: [bounds.minY, bounds.maxY] };
}

/** The arena outline as canvas-ready tile vertices; a circle has none. */
export function octagonOutlineVertices(
  shape: Extract<ArenaShape, { kind: "octagon" }>,
): readonly Vector2[] {
  const flat = shape.flatHalfWidthTiles;
  const corner = shape.cornerSumTiles - flat;
  const { x, y } = shape.centerTiles;
  return [
    [flat, -corner],
    [flat, corner],
    [corner, flat],
    [-corner, flat],
    [-flat, corner],
    [-flat, -corner],
    [-corner, -flat],
    [corner, -flat],
  ].map(([dx, dy]) => ({ x: x + dx!, y: y + dy! }));
}

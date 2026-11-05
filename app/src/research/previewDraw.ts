import type { ProjectileAppearanceSpec } from "../game/config/encounter";
import { appearanceRgbaPixels } from "../game/phaser/appearance-pixels";
import type { PreviewFrame } from "./previewModel";
import {
  octagonOutlineVertices,
  pixelsPerTile,
  tileToCanvas,
  type PreviewView,
} from "./previewView";

/** M37: presentation choices for the research preview, not gameplay values. */
export const PREVIEW_COLORS = {
  background: "#000000",
  arenaOutline: "#4b5a78",
  emitter: "#ffb347",
  player: "#6ee7a8",
  highlight: "#ffffff",
  detonation: "#ff7a59",
} as const;

const EMITTER_RADIUS_CSS_PIXELS = 4;
const PLAYER_RADIUS_CSS_PIXELS = 5;
const HIGHLIGHT_PADDING_CSS_PIXELS = 4;

const spriteCache = new WeakMap<ProjectileAppearanceSpec, HTMLCanvasElement>();

/** Each appearance's pixel grid is converted once into an offscreen canvas. */
function spriteOf(appearance: ProjectileAppearanceSpec): HTMLCanvasElement {
  const cached = spriteCache.get(appearance);
  if (cached) return cached;
  const { width, height, data } = appearanceRgbaPixels(appearance);
  const sprite = document.createElement("canvas");
  sprite.width = width;
  sprite.height = height;
  sprite
    .getContext("2d")!
    .putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  spriteCache.set(appearance, sprite);
  return sprite;
}

function fillBackground(context: CanvasRenderingContext2D, canvasPixels: number) {
  context.fillStyle = PREVIEW_COLORS.background;
  context.fillRect(0, 0, canvasPixels, canvasPixels);
}

/** M15: no video, a black canvas; the panel shows the note as text. */
export function drawEmptyPreview(
  context: CanvasRenderingContext2D,
  canvasPixels: number,
): void {
  fillBackground(context, canvasPixels);
}

function dot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();
}

function ring(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
}

function drawArena(
  context: CanvasRenderingContext2D,
  frame: PreviewFrame,
  view: PreviewView,
  canvasPixels: number,
): void {
  const { arena } = frame;
  context.strokeStyle = PREVIEW_COLORS.arenaOutline;
  context.lineWidth = 2;
  context.beginPath();
  if (arena.kind === "circle") {
    const centre = tileToCanvas(arena.centerTiles, view, arena, canvasPixels);
    context.arc(
      centre.x,
      centre.y,
      arena.radiusTiles * pixelsPerTile(arena, canvasPixels, view.zoom),
      0,
      2 * Math.PI,
    );
  } else {
    octagonOutlineVertices(arena).forEach((vertex, index) => {
      const point = tileToCanvas(vertex, view, arena, canvasPixels);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
  }
  context.stroke();
}

/** Draws one preview frame through a view onto a square canvas (M10-M13, M28, M32). */
export function drawPreviewFrame(
  context: CanvasRenderingContext2D,
  frame: PreviewFrame,
  view: PreviewView,
  canvasPixels: number,
  highlightedTagIndices: readonly number[],
): void {
  fillBackground(context, canvasPixels);
  drawArena(context, frame, view, canvasPixels);
  const scale = pixelsPerTile(frame.arena, canvasPixels, view.zoom);
  const toCanvas = (tile: PreviewFrame["emitterTiles"]) =>
    tileToCanvas(tile, view, frame.arena, canvasPixels);
  const emitter = toCanvas(frame.emitterTiles);
  dot(context, emitter.x, emitter.y, EMITTER_RADIUS_CSS_PIXELS, PREVIEW_COLORS.emitter);
  const player = toCanvas(frame.playerTiles);
  dot(context, player.x, player.y, PLAYER_RADIUS_CSS_PIXELS, PREVIEW_COLORS.player);
  context.imageSmoothingEnabled = false;
  for (const projectile of frame.projectiles) {
    const { appearance } = projectile;
    const centre = toCanvas(projectile.positionTiles);
    const width = appearance.visualWidthTiles * scale;
    const height = appearance.visualHeightTiles * scale;
    if (appearance.bomb) {
      dot(context, centre.x, centre.y, width / 2, appearance.bomb.bodyColor);
    } else {
      context.save();
      context.translate(centre.x, centre.y);
      context.rotate(projectile.orientationRadians);
      context.drawImage(spriteOf(appearance), -width / 2, -height / 2, width, height);
      context.restore();
    }
    if (highlightedTagIndices.includes(projectile.tagIndex))
      ring(
        context,
        centre.x,
        centre.y,
        Math.max(width, height) / 2 + HIGHLIGHT_PADDING_CSS_PIXELS,
        PREVIEW_COLORS.highlight,
      );
  }
  for (const detonation of frame.detonations) {
    const centre = toCanvas(detonation.positionTiles);
    ring(
      context,
      centre.x,
      centre.y,
      detonation.radiusTiles * scale,
      highlightedTagIndices.includes(detonation.tagIndex)
        ? PREVIEW_COLORS.highlight
        : PREVIEW_COLORS.detonation,
    );
  }
}

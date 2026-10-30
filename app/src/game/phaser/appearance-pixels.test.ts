import { expect, test } from "vitest";
import type { ProjectileAppearanceSpec } from "../config/encounter";
import {
  appearanceRgbaPixels,
  bombExplosionFrameIndex,
} from "./appearance-pixels";

const appearance = {
  id: "test",
  nativeWidthPixels: 2,
  nativeHeightPixels: 2,
  pixels: [
    ["#FF0000", null],
    ["#00FF00", "#0000FF"],
  ],
  palette: {},
  pixelsPerTile: 12.8,
  visualWidthTiles: 2 / 12.8,
  visualHeightTiles: 2 / 12.8,
  partsTiles: [],
  source: "test",
} satisfies ProjectileAppearanceSpec;

test("converts a pixel grid to RGBA with transparent null cells", () => {
  const rgba = appearanceRgbaPixels(appearance);
  expect(rgba.width).toBe(2);
  expect(rgba.height).toBe(2);
  expect([...rgba.data]).toEqual([
    255, 0, 0, 255,
    0, 0, 0, 0,
    0, 255, 0, 255,
    0, 0, 255, 255,
  ]);
});

test("dims the spent variant without changing its alpha", () => {
  const rgba = appearanceRgbaPixels(appearance, 0.5);
  expect([...rgba.data]).toEqual([
    128, 0, 0, 255,
    0, 0, 0, 0,
    0, 128, 0, 255,
    0, 0, 128, 255,
  ]);
});

test("does not mutate the appearance", () => {
  const before = JSON.stringify(appearance);
  appearanceRgbaPixels(appearance, 0.5);
  expect(JSON.stringify(appearance)).toBe(before);
});

test("the bomb explosion frame index holds the last frame and rejects negatives", () => {
  expect(bombExplosionFrameIndex(0, 0.04, 5)).toBe(0);
  expect(bombExplosionFrameIndex(0.039, 0.04, 5)).toBe(0);
  expect(bombExplosionFrameIndex(0.04, 0.04, 5)).toBe(1);
  expect(bombExplosionFrameIndex(0.16, 0.04, 5)).toBe(4);
  expect(bombExplosionFrameIndex(0.2, 0.04, 5)).toBe(4);
  expect(bombExplosionFrameIndex(-1, 0.04, 5)).toBe(0);
  expect(bombExplosionFrameIndex(0, 0.04, 0)).toBe(0);
});

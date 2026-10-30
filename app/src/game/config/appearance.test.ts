import { expect, test } from "vitest";
import { MAXIMUM_BODY_PART_COUNT } from "../simulation/geometry";
import { encounterConfigOf, projectileOf } from "./encounter";

const QUEEN = encounterConfigOf("killer-bee-queen");

const expected = {
  "red-stinger-small": { width: 7 / 12.8, height: 1 / 12.8, parts: 1 },
  "red-stinger-large-v1": { width: 8 / 12.8, height: 5 / 12.8, parts: 5 },
  "red-ball": { width: 8 / 12.8, height: 8 / 12.8, parts: 8 },
  "red-glaive-v1": { width: 8 / 12.8, height: 8 / 12.8, parts: 14 },
  "hive-spiral-shot-v1": { width: 49 / 12.8, height: 28 / 12.8, parts: 58 },
  "bee-shot": { width: 8 / 12.8, height: 6 / 12.8, parts: 8 },
} as const;

test.each(Object.entries(expected))(
  "%s derives its visual size and compound part count from the pixel grid",
  (id, size) => {
    const projectile = projectileOf(QUEEN, id);
    expect(projectile.appearance).not.toBeNull();
    expect(projectile.appearance!.visualWidthTiles).toBeCloseTo(size.width, 12);
    expect(projectile.appearance!.visualHeightTiles).toBeCloseTo(size.height, 12);
    expect(projectile.appearance!.partsTiles).toHaveLength(size.parts);
    expect(projectile.collisionPartsTiles).toBe(projectile.appearance!.partsTiles);
  },
);

test("the three hive colours share the same 49 x 28 grid with different palettes", () => {
  const spiral = projectileOf(QUEEN, "hive-spiral-shot-v1").appearance!;
  const range = projectileOf(QUEEN, "hive-range-shot-v1").appearance!;
  const shot = projectileOf(QUEEN, "hive-shot-v1").appearance!;
  const shape = (pixels: readonly (readonly (string | null)[])[]) =>
    pixels.map((row) => row.map((colour) => colour !== null));
  expect(shape(spiral.pixels)).toEqual(shape(range.pixels));
  expect(shape(range.pixels)).toEqual(shape(shot.pixels));
  expect(spiral.palette).not.toEqual(range.palette);
  expect(range.palette).not.toEqual(shot.palette);
});

test("the opaque pixels are covered exactly once by the collision parts", () => {
  for (const id of [
    "red-stinger-small",
    "red-stinger-large-v1",
    "red-ball",
    "red-glaive-v1",
    "hive-spiral-shot-v1",
    "bee-shot",
  ]) {
    const appearance = projectileOf(QUEEN, id).appearance!;
    const scale = 12.8;
    const widthPixels = appearance.nativeWidthPixels;
    const heightPixels = appearance.nativeHeightPixels;
    const covered = Array.from({ length: heightPixels }, () =>
      Array<boolean>(widthPixels).fill(false),
    );
    for (const part of appearance.partsTiles) {
      const xs = part.map((vertex) => vertex.x);
      const ys = part.map((vertex) => vertex.y);
      const left = Math.round((Math.min(...xs) * scale) + widthPixels / 2);
      const right = Math.round((Math.max(...xs) * scale) + widthPixels / 2);
      const top = Math.round((Math.min(...ys) * scale) + heightPixels / 2);
      const bottom = Math.round((Math.max(...ys) * scale) + heightPixels / 2);
      expect(right - left).toBeGreaterThan(0);
      expect(bottom - top).toBe(1);
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          expect(covered[y]![x]).toBe(false);
          covered[y]![x] = true;
        }
      }
    }
    for (let y = 0; y < heightPixels; y++) {
      for (let x = 0; x < widthPixels; x++) {
        const opaque = appearance.pixels[y]![x] !== null;
        expect(covered[y]![x]).toBe(opaque);
      }
    }
  }
});

test("bombs keep a visual-only octagon body and a five-frame explosion", () => {
  const bomb = projectileOf(QUEEN, "red-bomb-v1");
  expect(bomb.appearance).not.toBeNull();
  expect(bomb.appearance!.bomb).toBeDefined();
  expect(bomb.appearance!.bomb!.frameOuterPixels).toEqual([4, 5, 7, 9, 13]);
  expect(bomb.appearance!.bomb!.borderPixels).toBe(1);
  expect(bomb.appearance!.bomb!.bodyColor).toBe("#FF0000");
  expect(bomb.collisionPartsTiles).toHaveLength(1);
  expect(bomb.motion.kind).toBe("lob");
});

test("the body-part cap equals the largest authored compound body", () => {
  const largest = Math.max(
    ...Object.values(QUEEN.projectiles).map(
      (projectile) => projectile.collisionPartsTiles.length,
    ),
  );
  expect(largest).toBe(MAXIMUM_BODY_PART_COUNT);
  expect(largest).toBe(58);
});

test("the small stinger is one exact 7 x 1 rectangle centred on the shard", () => {
  const part = projectileOf(QUEEN, "red-stinger-small").collisionPartsTiles[0]!;
  const halfWidth = 7 / 12.8 / 2;
  const halfHeight = 1 / 12.8 / 2;
  expect(part).toEqual([
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ]);
});

test("the Crystal Worm shard keeps its authored body and has no appearance", () => {
  const worm = projectileOf(QUEEN, "crystal-worm-child-shard");
  expect(worm.appearance).toBeNull();
  expect(worm.collisionPartsTiles).toHaveLength(1);
  expect(worm.collisionPartsTiles[0]).toBe(worm.verticesTiles);
  expect(worm.verticesTiles).toHaveLength(6);
});

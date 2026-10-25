import { expect, test } from "vitest";
import { V2_GEOMETRY_CANDIDATE } from "../config/geometry-candidate";
import type { Vector2 } from "../models";
import { sweptConvexOverlap, transformBodyVertices } from "./geometry";

const square: readonly Vector2[] = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
];
const stationary = { x: 0, y: 0 };

type SweepCase = Readonly<{
  name: string;
  start: readonly [number, number];
  motion: readonly [number, number];
  target: readonly [number, number];
  targetMotion: readonly [number, number];
  hit: boolean;
}>;

test("transforms the shared vertices by rotation then translation without mutating them", () => {
  const original = structuredClone(
    V2_GEOMETRY_CANDIDATE.bodies.shard.verticesTiles,
  );
  const transformed = transformBodyVertices(
    original,
    { x: 4, y: -3 },
    Math.PI / 2,
  );
  transformed.forEach((vertex, index) => {
    expect(vertex.x).toBeCloseTo(4 - original[index].y, 12);
    expect(vertex.y).toBeCloseTo(-3 + original[index].x, 12);
    expect(Object.getPrototypeOf(vertex)).toBe(Object.prototype);
  });
  expect(original).toEqual(V2_GEOMETRY_CANDIDATE.bodies.shard.verticesTiles);
});

test.each<SweepCase>([
  {
    name: "initial overlap while moving apart",
    start: [0, 0],
    motion: [10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "initial boundary contact while moving apart",
    start: [1, 0],
    motion: [10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "newborn overlap",
    start: [0.25, 0.25],
    motion: [0, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "stationary separation",
    start: [2, 0],
    motion: [0, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: false,
  },
  {
    name: "equal motion while separated",
    start: [2, 0],
    motion: [8, 3],
    target: [0, 0],
    targetMotion: [8, 3],
    hit: false,
  },
  {
    name: "equal motion while overlapping",
    start: [0.5, 0],
    motion: [8, 3],
    target: [0, 0],
    targetMotion: [8, 3],
    hit: true,
  },
  {
    name: "high-speed axial crossing with disjoint endpoints",
    start: [-5, 0],
    motion: [10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "high-speed diagonal crossing",
    start: [-5, -5],
    motion: [10, 10],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "parallel near miss",
    start: [-5, 1.000000001],
    motion: [10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: false,
  },
  {
    name: "edge tangency",
    start: [-5, 1],
    motion: [10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "contact exactly at segment end",
    start: [-5, 0],
    motion: [4, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "just short of contact",
    start: [-5, 0],
    motion: [3.999999999, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: false,
  },
  {
    name: "return-direction crossing",
    start: [5, 0],
    motion: [-10, 0],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "player crossing a stationary shard",
    start: [-5, 0],
    motion: [0, 0],
    target: [0, 0],
    targetMotion: [-10, 0],
    hit: true,
  },
  {
    name: "both bodies moving without crossing the stationary target",
    start: [-5, 0],
    motion: [3, 0],
    target: [0, 0],
    targetMotion: [-7, 0],
    hit: true,
  },
  {
    name: "isolated corner tangency",
    start: [-2, 0],
    motion: [2, 2],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: true,
  },
  {
    name: "just past isolated corner tangency",
    start: [-2, 0.000000001],
    motion: [2, 2],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: false,
  },
  {
    name: "disjoint axis overlap times",
    start: [-5, -8],
    motion: [10, 10],
    target: [0, 0],
    targetMotion: [0, 0],
    hit: false,
  },
])(
  "sweeps fixed-orientation polygons: $name",
  ({ start, motion, target, targetMotion, hit }) => {
    expect(
      sweptConvexOverlap(
        transformBodyVertices(square, { x: start[0], y: start[1] }),
        { x: motion[0], y: motion[1] },
        transformBodyVertices(square, { x: target[0], y: target[1] }),
        { x: targetMotion[0], y: targetMotion[1] },
      ),
    ).toBe(hit);
  },
);

test("uses axes from both bodies instead of accepting world-axis overlap", () => {
  const diamond = transformBodyVertices(square, { x: 1, y: 1 }, Math.PI / 4);
  expect(Math.min(...diamond.map((vertex) => vertex.x))).toBeLessThan(0.5);
  expect(Math.min(...diamond.map((vertex) => vertex.y))).toBeLessThan(0.5);
  expect(sweptConvexOverlap(square, stationary, diamond, stationary)).toBe(
    false,
  );
  expect(sweptConvexOverlap(diamond, stationary, square, stationary)).toBe(
    false,
  );
});

test("rejects enclosing-circle overlap for the approved player and elongated shard", () => {
  const player = V2_GEOMETRY_CANDIDATE.bodies.player.verticesTiles;
  const shard = V2_GEOMETRY_CANDIDATE.bodies.shard.verticesTiles;
  const radius = (vertices: readonly Vector2[]) =>
    Math.max(...vertices.map((vertex) => Math.hypot(vertex.x, vertex.y)));
  expect(radius(player) + radius(shard)).toBeGreaterThan(2);
  expect(
    sweptConvexOverlap(
      player,
      stationary,
      transformBodyVertices(shard, { x: 0, y: 2 }),
      stationary,
    ),
  ).toBe(false);
});

test.each([0, 0.37, Math.PI / 2, 2.2])(
  "preserves approved-body crossing and miss under common rotation %s",
  (angle) => {
    const rotate = (vector: Vector2): Vector2 => ({
      x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
      y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
    });
    const player = transformBodyVertices(
      V2_GEOMETRY_CANDIDATE.bodies.player.verticesTiles,
      stationary,
      angle,
    );
    for (const [height, hit] of [
      [0, true],
      [3, false],
    ] as const) {
      const shard = transformBodyVertices(
        V2_GEOMETRY_CANDIDATE.bodies.shard.verticesTiles,
        rotate({ x: -5, y: height }),
        angle,
      );
      expect(
        sweptConvexOverlap(shard, rotate({ x: 10, y: 0 }), player, stationary),
      ).toBe(hit);
      expect(
        sweptConvexOverlap(
          shard,
          rotate({ x: 20, y: 0 }),
          player,
          rotate({ x: 10, y: 0 }),
        ),
      ).toBe(hit);
      expect(
        sweptConvexOverlap(shard, rotate({ x: -10, y: 0 }), player, stationary),
      ).toBe(false);
    }
    const rotatedSquare = transformBodyVertices(square, stationary, angle);
    const tangentSquare = transformBodyVertices(
      square,
      rotate({ x: 1, y: 0 }),
      angle,
    );
    expect(
      sweptConvexOverlap(rotatedSquare, stationary, tangentSquare, stationary),
    ).toBe(true);
  },
);

test("accepts either vertex winding and does not mutate sweep inputs", () => {
  const clockwise = square.map((vertex) => ({ ...vertex }));
  const opposite = [...clockwise].reverse();
  const motion = { x: -10, y: 0 };
  const start = transformBodyVertices(clockwise, { x: 5, y: 0 });
  const before = structuredClone({ start, opposite, motion });
  expect(sweptConvexOverlap(start, motion, opposite, stationary)).toBe(true);
  expect({ start, opposite, motion }).toEqual(before);
});

test.each([0.000001, 1, 1000000])(
  "distinguishes tangent from a meaningful gap at scale %s",
  (scale) => {
    const scaled = square.map((vertex) => ({
      x: vertex.x * scale,
      y: vertex.y * scale,
    }));
    expect(
      sweptConvexOverlap(
        scaled,
        stationary,
        transformBodyVertices(scaled, { x: scale, y: 0 }),
        stationary,
      ),
    ).toBe(true);
    expect(
      sweptConvexOverlap(
        scaled,
        stationary,
        transformBodyVertices(scaled, { x: scale * (1 + 0.0000001), y: 0 }),
        stationary,
      ),
    ).toBe(false);
  },
);

const invalidBodies: readonly (readonly Vector2[])[] = [
  [],
  square.slice(0, 2),
  Array.from({ length: 9 }, (_, index) => ({
    x: Math.cos((index * 2 * Math.PI) / 9),
    y: Math.sin((index * 2 * Math.PI) / 9),
  })),
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
  [square[0], square[1], square[1], square[3]],
  [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ],
  [square[0], square[2], square[1], square[3]],
  Array.from({ length: 5 }, (_, index) => ({
    x: Math.cos((index * 4 * Math.PI) / 5),
    y: Math.sin((index * 4 * Math.PI) / 5),
  })),
  [{ x: Number.NaN, y: 0 }, square[1], square[2]],
  [{ x: 0, y: Number.POSITIVE_INFINITY }, square[1], square[2]],
];

test.each(invalidBodies.map((vertices, index) => ({ vertices, index })))(
  "rejects invalid convex geometry case $index at both boundaries",
  ({ vertices }) => {
    expect(() => transformBodyVertices(vertices, stationary)).toThrow(
      RangeError,
    );
    expect(() =>
      sweptConvexOverlap(vertices, stationary, square, stationary),
    ).toThrow(RangeError);
    expect(() =>
      sweptConvexOverlap(square, stationary, vertices, stationary),
    ).toThrow(RangeError);
  },
);

test("rejects nonfinite transforms and motion instead of accepting accidental overlap", () => {
  expect(() => transformBodyVertices(square, { x: Number.NaN, y: 0 })).toThrow(
    RangeError,
  );
  expect(() =>
    transformBodyVertices(square, stationary, Number.POSITIVE_INFINITY),
  ).toThrow(RangeError);
  expect(() =>
    sweptConvexOverlap(square, { x: Number.NaN, y: 0 }, square, stationary),
  ).toThrow(RangeError);
  expect(() =>
    sweptConvexOverlap(square, stationary, square, {
      x: 0,
      y: Number.POSITIVE_INFINITY,
    }),
  ).toThrow(RangeError);
});

test("runs in Node without browser, storage or engine globals", () => {
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  expect(typeof localStorage).toBe("undefined");
  expect(sweptConvexOverlap(square, stationary, square, stationary)).toBe(true);
});

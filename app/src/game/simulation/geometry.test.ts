import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
} from "../config/encounter";
import type { Vector2 } from "../models";
import {
  constrainBodyToArena,
  convexBodyFitsCircle,
  convexBodyOverlapsCircle,
  convexContactDistance,
  maximumBodyCenterDistance,
  pursueBody,
  sweptConvexOverlap,
  transformBodyVertices,
} from "./geometry";

// Local fixture bodies at the historical review scale. They exercise the
// geometry kernel against larger, non-square silhouettes than the shipped
// 1.25 x 1.25 encounter bodies, and the expected contact distances and radii
// asserted below are properties of these shapes. The retired geometry study
// (G01) built its bodies the same way; this is test-local fixture
// construction, not production derivation. Provenance: docs/mechanics.md 8.2.
const fixturePixelsPerTile = 435.118 / 19.2;
const scaleFixture = (
  outline: readonly (readonly [number, number])[],
  widthPixels: number,
  heightPixels: number,
): readonly Vector2[] =>
  outline.map(([horizontal, vertical]) => ({
    x: (horizontal * widthPixels) / fixturePixelsPerTile,
    y: (vertical * heightPixels) / fixturePixelsPerTile,
  }));
const beveledFixtureOutline = [
  [-0.3, -0.5],
  [0.3, -0.5],
  [0.5, -0.3],
  [0.5, 0.3],
  [0.3, 0.5],
  [-0.3, 0.5],
  [-0.5, 0.3],
  [-0.5, -0.3],
] as const;
const shardFixtureOutline = [
  [0.5, 0],
  [0.25, 0.5],
  [-0.25, 0.5],
  [-0.5, 0],
  [-0.25, -0.5],
  [0.25, -0.5],
] as const;
const fixtureBodies = {
  player: { verticesTiles: scaleFixture(beveledFixtureOutline, 36, 33) },
  head: { verticesTiles: scaleFixture(beveledFixtureOutline, 42, 55) },
  shard: { verticesTiles: scaleFixture(shardFixtureOutline, 56.576, 34.66) },
};

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
    fixtureBodies.shard.verticesTiles,
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
  expect(original).toEqual(fixtureBodies.shard.verticesTiles);
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
  const player = fixtureBodies.player.verticesTiles;
  const shard = fixtureBodies.shard.verticesTiles;
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
      fixtureBodies.player.verticesTiles,
      stationary,
      angle,
    );
    for (const [height, hit] of [
      [0, true],
      [3, false],
    ] as const) {
      const shard = transformBodyVertices(
        fixtureBodies.shard.verticesTiles,
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

const arena = { centerTiles: stationary, radiusTiles: 5 };

test("checks actual vertices for circular interior, contact and outside placements", () => {
  expect(convexBodyFitsCircle(square, arena)).toBe(true);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(square, { x: 4.4, y: 0 }),
      arena,
    ),
  ).toBe(true);
  expect(4.4 + Math.SQRT1_2).toBeGreaterThan(arena.radiusTiles);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(square, { x: 4.5, y: 0 }),
      arena,
    ),
  ).toBe(false);
  const reach = maximumBodyCenterDistance(
    square,
    { x: 1, y: 0 },
    arena.radiusTiles,
  );
  expect(reach).toBeCloseTo(Math.sqrt(25 - 0.25) - 0.5, 12);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(square, { x: reach, y: 0 }),
      arena,
    ),
  ).toBe(true);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(square, { x: reach + 0.000001, y: 0 }),
      arena,
    ),
  ).toBe(false);
});

test("convexBodyOverlapsCircle detects interior, boundary and outside placements", () => {
  // Circle center inside the body: overlap regardless of radius.
  expect(convexBodyOverlapsCircle(square, { x: 0, y: 0 }, 0.1)).toBe(true);
  // The square's nearest edge point to (1.5, 0) is (0.5, 0), exactly 1 tile away.
  expect(convexBodyOverlapsCircle(square, { x: 1.5, y: 0 }, 1)).toBe(true);
  expect(convexBodyOverlapsCircle(square, { x: 1.5, y: 0 }, 0.999)).toBe(
    false,
  );
  expect(convexBodyOverlapsCircle(square, { x: 1.5, y: 0 }, 1.001)).toBe(
    true,
  );
  expect(convexBodyOverlapsCircle(square, { x: 10, y: 0 }, 1)).toBe(false);
  expect(() =>
    convexBodyOverlapsCircle(square, { x: 0, y: 0 }, 0),
  ).toThrow(RangeError);
  expect(() =>
    convexBodyOverlapsCircle(square, { x: 0, y: 0 }, Number.NaN),
  ).toThrow(RangeError);
});

test("derives rotated corner contact from the same physical vertices", () => {
  const rotated = transformBodyVertices(square, stationary, Math.PI / 4);
  const reach = maximumBodyCenterDistance(
    rotated,
    { x: 3, y: 0 },
    arena.radiusTiles,
  );
  expect(reach).toBeCloseTo(5 - Math.SQRT1_2, 12);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(rotated, { x: reach, y: 0 }),
      arena,
    ),
  ).toBe(true);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(rotated, { x: reach + 0.000001, y: 0 }),
      arena,
    ),
  ).toBe(false);
});

test("preserves radial candidate direction and interior positions in translated arenas", () => {
  const translatedArena = { centerTiles: { x: 11, y: -8 }, radiusTiles: 5 };
  const interior = { x: 12, y: -7 };
  expect(constrainBodyToArena(square, interior, translatedArena)).toEqual(
    interior,
  );
  expect(
    constrainBodyToArena(square, translatedArena.centerTiles, translatedArena),
  ).toEqual(translatedArena.centerTiles);
  const constrained = constrainBodyToArena(
    square,
    { x: 21, y: 2 },
    translatedArena,
  );
  expect(constrained.x - 11).toBeCloseTo(constrained.y + 8, 12);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(square, constrained),
      translatedArena,
    ),
  ).toBe(true);
  expect(
    Math.max(
      ...transformBodyVertices(square, constrained).map((vertex) =>
        Math.hypot(vertex.x - 11, vertex.y + 8),
      ),
    ),
  ).toBeCloseTo(5, 12);
});

test("rejects outward movement while retaining tangential edge movement over repeated constraints", () => {
  const edge = constrainBodyToArena(square, { x: 10, y: 0 }, arena);
  expect(
    constrainBodyToArena(square, { x: edge.x + 0.1, y: 0 }, arena),
  ).toEqual(edge);
  let position = edge;
  for (let tick = 0; tick < 240; tick++) {
    const tangent = { x: -position.y, y: position.x };
    const length = Math.hypot(tangent.x, tangent.y);
    const next = constrainBodyToArena(
      square,
      {
        x: position.x + (tangent.x / length) * 0.05,
        y: position.y + (tangent.y / length) * 0.05,
      },
      arena,
    );
    expect(
      Math.hypot(next.x - position.x, next.y - position.y),
    ).toBeGreaterThan(0.01);
    expect(
      convexBodyFitsCircle(transformBodyVertices(square, next), arena),
    ).toBe(true);
    expect(constrainBodyToArena(square, next, arena).x).toBeCloseTo(next.x, 12);
    expect(constrainBodyToArena(square, next, arena).y).toBeCloseTo(next.y, 12);
    position = next;
  }
});

test("fits the approved north spawn and constrains both approved upright bodies", () => {
  const approvedArena = ENCOUNTER_CONFIG.arena;
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(
        primaryArchetype(ENCOUNTER_CONFIG).verticesTiles,
        primaryArchetype(ENCOUNTER_CONFIG).spawnTiles,
      ),
      approvedArena,
    ),
  ).toBe(true);
  for (const body of [ENCOUNTER_CONFIG.player, primaryArchetype(ENCOUNTER_CONFIG)]) {
    for (const direction of [
      { x: 30, y: 0 },
      { x: 0, y: -30 },
      { x: 30, y: 30 },
    ]) {
      const position = constrainBodyToArena(
        body.verticesTiles,
        direction,
        approvedArena,
      );
      expect(
        convexBodyFitsCircle(
          transformBodyVertices(body.verticesTiles, position),
          approvedArena,
        ),
      ).toBe(true);
    }
  }
});

test("rejects invalid circles, directions and bodies in containment and constraints", () => {
  for (const radiusTiles of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const invalidArena = { ...arena, radiusTiles };
    expect(() => convexBodyFitsCircle(square, invalidArena)).toThrow(
      RangeError,
    );
    expect(() =>
      constrainBodyToArena(square, stationary, invalidArena),
    ).toThrow(RangeError);
    expect(() =>
      maximumBodyCenterDistance(square, { x: 1, y: 0 }, radiusTiles),
    ).toThrow(RangeError);
  }
  expect(() => maximumBodyCenterDistance(square, stationary, 5)).toThrow(
    RangeError,
  );
  expect(() =>
    maximumBodyCenterDistance(square, { x: Number.NaN, y: 0 }, 5),
  ).toThrow(RangeError);
  expect(() => maximumBodyCenterDistance(square, { x: 1, y: 0 }, 0.1)).toThrow(
    RangeError,
  );
  expect(() =>
    constrainBodyToArena(square, { x: Number.NaN, y: 0 }, arena),
  ).toThrow(RangeError);
  expect(() =>
    convexBodyFitsCircle(square, {
      ...arena,
      centerTiles: { x: 0, y: Number.NaN },
    }),
  ).toThrow(RangeError);
  for (const vertices of invalidBodies) {
    expect(() => convexBodyFitsCircle(vertices, arena)).toThrow(RangeError);
    expect(() => constrainBodyToArena(vertices, stationary, arena)).toThrow(
      RangeError,
    );
  }
});

test.each([
  { direction: { x: 1, y: 0 }, expected: 1.7209124881066744 },
  { direction: { x: -1, y: 0 }, expected: 1.7209124881066744 },
  { direction: { x: 0, y: 1 }, expected: 1.9415422942741967 },
  { direction: { x: 0, y: -1 }, expected: 1.9415422942741967 },
  { direction: { x: 1, y: 1 }, expected: 2.0932846919542065 },
])(
  "stops pursuit at shared-silhouette contact for $direction",
  ({ direction, expected }) => {
    const { player, head } = fixtureBodies;
    expect(
      convexContactDistance(
        player.verticesTiles,
        head.verticesTiles,
        direction,
      ),
    ).toBeCloseTo(expected, 12);
    const length = Math.hypot(direction.x, direction.y);
    const start = {
      x: (direction.x / length) * 10,
      y: (direction.y / length) * 10,
    };
    const stopped = pursueBody(
      head.verticesTiles,
      start,
      player.verticesTiles,
      stationary,
      100,
    );
    expect(Math.hypot(stopped.x, stopped.y)).toBeCloseTo(expected, 12);
    expect(
      sweptConvexOverlap(
        transformBodyVertices(head.verticesTiles, stopped),
        stationary,
        player.verticesTiles,
        stationary,
      ),
    ).toBe(true);
    const separated = {
      x: stopped.x + (direction.x / length) * 0.000001,
      y: stopped.y + (direction.y / length) * 0.000001,
    };
    expect(
      sweptConvexOverlap(
        transformBodyVertices(head.verticesTiles, separated),
        stationary,
        player.verticesTiles,
        stationary,
      ),
    ).toBe(false);
    let position = stopped;
    for (let tick = 0; tick < 60; tick++) {
      const next = pursueBody(
        head.verticesTiles,
        position,
        player.verticesTiles,
        stationary,
        0.025,
      );
      expect(next).toBe(position);
      position = next;
    }
  },
);

test("limits pursuit travel without pushing already-overlapping or coincident bodies apart", () => {
  const { player, head } = fixtureBodies;
  const start = { x: 8, y: 6 };
  const moved = pursueBody(
    head.verticesTiles,
    start,
    player.verticesTiles,
    stationary,
    0.05,
  );
  expect(Math.hypot(moved.x - start.x, moved.y - start.y)).toBeCloseTo(
    0.05,
    12,
  );
  expect(
    pursueBody(head.verticesTiles, start, player.verticesTiles, stationary, 0),
  ).toBe(start);
  for (const overlap of [
    stationary,
    { x: Number.EPSILON, y: 0 },
    { x: 0.5, y: 0 },
  ]) {
    expect(
      pursueBody(
        head.verticesTiles,
        overlap,
        player.verticesTiles,
        stationary,
        1,
      ),
    ).toBe(overlap);
  }
  const target = { x: 3, y: -4 };
  expect(
    pursueBody(head.verticesTiles, target, player.verticesTiles, target, 1),
  ).toBe(target);
  const eastSeparationTiles = convexContactDistance(
    player.verticesTiles,
    head.verticesTiles,
    { x: 1, y: 0 },
  );
  const near = { x: eastSeparationTiles + 0.001, y: 0 };
  expect(
    pursueBody(head.verticesTiles, near, player.verticesTiles, stationary, 1).x,
  ).toBeCloseTo(eastSeparationTiles, 12);
});

test("rejects invalid pursuit inputs even at coincident centers", () => {
  for (const travel of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() =>
      pursueBody(square, stationary, square, stationary, travel),
    ).toThrow(RangeError);
  }
  expect(() => convexContactDistance(square, square, stationary)).toThrow(
    RangeError,
  );
  expect(() =>
    pursueBody(square, { x: Number.NaN, y: 0 }, square, stationary, 1),
  ).toThrow(RangeError);
  expect(() =>
    pursueBody(
      square,
      stationary,
      square,
      { x: 0, y: Number.POSITIVE_INFINITY },
      1,
    ),
  ).toThrow(RangeError);
  for (const vertices of invalidBodies) {
    expect(() =>
      pursueBody(vertices, stationary, square, stationary, 1),
    ).toThrow(RangeError);
    expect(() =>
      pursueBody(square, stationary, vertices, stationary, 1),
    ).toThrow(RangeError);
  }
});

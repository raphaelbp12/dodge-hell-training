import { describe, expect, test } from "vitest";
import type { ArenaShape, Vector2 } from "../models";
import {
  MAXIMUM_BODY_PART_COUNT,
  arenaInradiusTiles,
  constrainBodyToArena,
  convexBodyFitsArenaShape,
  convexBodyFitsCircle,
  convexBodyFitsOctagon,
  convexBodyOverlapsCircle,
  convexContactDistance,
  convexPartsBoundingRadiusTiles,
  maximumBodyCenterDistance,
  pointOnRing,
  pursueBody,
  sweptConvexOverlap,
  sweptConvexPartsOverlap,
  transformBodyParts,
  transformBodyVertices,
  validateConvexParts,
} from "./geometry";

type Octagon = Extract<ArenaShape, { kind: "octagon" }>;

const rect = (x0: number, x1: number, y0: number, y1: number): Vector2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const square = (half: number, cx = 0, cy = 0): Vector2[] =>
  rect(cx - half, cx + half, cy - half, cy + half);
const polygon = (count: number): Vector2[] =>
  Array.from({ length: count }, (_, index) => ({
    x: Math.cos((2 * Math.PI * index) / count),
    y: Math.sin((2 * Math.PI * index) / count),
  }));
const zero = { x: 0, y: 0 };
const octagon = (
  flat = 10,
  corner = 14,
  center: Vector2 = zero,
): Octagon => ({
  kind: "octagon",
  centerTiles: center,
  flatHalfWidthTiles: flat,
  cornerSumTiles: corner,
});
const circle = (radius: number, center: Vector2 = zero) => ({
  kind: "circle" as const,
  centerTiles: center,
  radiusTiles: radius,
});

describe("body validation", () => {
  test("vertex count window is 3 to 8 inclusive", () => {
    const far = square(1, 100, 0);
    expect(() => sweptConvexOverlap(polygon(2), zero, far, zero)).toThrow(
      /3 to 8 ordered vertices/,
    );
    expect(() => sweptConvexOverlap(polygon(9), zero, far, zero)).toThrow(
      /3 to 8 ordered vertices/,
    );
    expect(sweptConvexOverlap(polygon(3), zero, far, zero)).toBe(false);
    expect(sweptConvexOverlap(polygon(8), zero, far, zero)).toBe(false);
  });

  test("non-finite vertices are rejected", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const shape = square(1);
      shape[2] = { x: bad, y: 1 };
      expect(() => transformBodyVertices(shape, zero)).toThrow(/finite/);
      const shapeY = square(1);
      shapeY[2] = { x: 1, y: bad };
      expect(() => transformBodyVertices(shapeY, zero)).toThrow(/finite/);
    }
  });

  test("duplicate vertices give a zero-length edge", () => {
    const shape = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(() => transformBodyVertices(shape, zero)).toThrow(
      /distinct, representable edges/,
    );
  });

  test("edge length tolerance scales with coordinate magnitude", () => {
    // tolerance = 64 eps * 1e6 = 1.4e-8
    const tiny = [
      { x: 1e6, y: 1e6 },
      { x: 1e6 + 1e-9, y: 1e6 },
      { x: 1e6, y: 1e6 + 1 },
    ];
    expect(() => transformBodyVertices(tiny, zero)).toThrow(
      /distinct, representable edges/,
    );
    const ok = [
      { x: 1e6, y: 1e6 },
      { x: 1e6 + 1e-6, y: 1e6 },
      { x: 1e6, y: 1e6 + 1 },
    ];
    expect(() => transformBodyVertices(ok, zero)).not.toThrow();
    // the larger of |x| and |y| sets the scale, not the smaller
    const xLarge = [
      { x: 1e6, y: 0 },
      { x: 1e6 + 1e-9, y: 0 },
      { x: 1e6, y: 1 },
    ];
    expect(() => transformBodyVertices(xLarge, zero)).toThrow(
      /distinct, representable edges/,
    );
  });

  test("overflowing edge length is rejected", () => {
    const huge = [
      { x: -1.7e308, y: 0 },
      { x: 1.7e308, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(() => transformBodyVertices(huge, zero)).toThrow(
      /distinct, representable edges/,
    );
  });

  test("collinear corners are rejected, near-collinear within tolerance too", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    expect(() => transformBodyVertices(line, zero)).toThrow(
      /nondegenerate, noncollinear/,
    );
    const nearLine = [
      { x: 1e6, y: 0 },
      { x: 1e6 + 1, y: 1e-9 },
      { x: 1e6 + 2, y: 0 },
    ];
    expect(() => transformBodyVertices(nearLine, zero)).toThrow(
      /nondegenerate, noncollinear/,
    );
    const thin = [
      { x: 1e6, y: 0 },
      { x: 1e6 + 1, y: 1e-3 },
      { x: 1e6 + 2, y: 0 },
    ];
    expect(() => transformBodyVertices(thin, zero)).not.toThrow();
  });

  test("overflowing corner distance is rejected", () => {
    const shape = [
      { x: -1e308, y: 0 },
      { x: 1e308, y: 0 },
      { x: 0, y: 1e308 },
    ];
    // Edge lengths are representable (2e308 overflows -> distinct error)
    expect(() => transformBodyVertices(shape, zero)).toThrow(RangeError);
  });

  test("both windings are valid but a mixed winding is not", () => {
    const clockwise = [...square(1)].reverse();
    expect(() => transformBodyVertices(clockwise, zero)).not.toThrow();
    const bowtie = [
      { x: -1, y: -1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
    ];
    expect(() => transformBodyVertices(bowtie, zero)).toThrow(
      /ordered convex boundary/,
    );
    const dent = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 2, y: 1 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(() => transformBodyVertices(dent, zero)).toThrow(
      /ordered convex boundary/,
    );
  });
});

describe("transformBodyVertices", () => {
  test("rotates about the origin, then translates", () => {
    const result = transformBodyVertices(
      [
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ],
      { x: 10, y: 20 },
      Math.PI / 2,
    );
    expect(result[0].x).toBeCloseTo(10, 12);
    expect(result[0].y).toBeCloseTo(21, 12);
    expect(result[1].x).toBeCloseTo(10, 12);
    expect(result[1].y).toBeCloseTo(23, 12);
    expect(result[2].x).toBeCloseTo(9, 12);
    expect(result[2].y).toBeCloseTo(23, 12);
  });

  test("orientation defaults to zero", () => {
    const result = transformBodyVertices(square(1), { x: 5, y: 7 });
    expect(result[0]).toEqual({ x: 4, y: 6 });
    expect(result[2]).toEqual({ x: 6, y: 8 });
    expect(result).toHaveLength(4);
  });

  test("rejects non-finite position and orientation", () => {
    expect(() => transformBodyVertices(square(1), { x: NaN, y: 0 })).toThrow(
      /finite/,
    );
    expect(() => transformBodyVertices(square(1), { x: 0, y: Infinity })).toThrow(
      /finite/,
    );
    for (const bad of [NaN, Infinity]) {
      expect(() => transformBodyVertices(square(1), zero, bad)).toThrow(
        /orientation must be finite radians/,
      );
    }
  });

  test("rejects invalid local vertices before transforming", () => {
    expect(() => transformBodyVertices(polygon(2), zero)).toThrow(
      /3 to 8/,
    );
  });

  test("rejects a transform that collapses the body", () => {
    expect(() => transformBodyVertices(square(1), { x: 1e20, y: 0 })).toThrow(
      /distinct, representable edges/,
    );
  });
});

describe("compound parts", () => {
  test("validateConvexParts bounds the part count", () => {
    expect(() => validateConvexParts([])).toThrow(/at least one part/);
    expect(MAXIMUM_BODY_PART_COUNT).toBe(58);
    const part = square(1);
    expect(() =>
      validateConvexParts(Array.from({ length: 58 }, () => part)),
    ).not.toThrow();
    expect(() =>
      validateConvexParts(Array.from({ length: 59 }, () => part)),
    ).toThrow(/at most 58 parts/);
    expect(() => validateConvexParts([part])).not.toThrow();
    expect(() => validateConvexParts([part, polygon(2)])).toThrow(/3 to 8/);
  });

  test("transformBodyParts rotates then translates and freezes", () => {
    const parts = [[{ x: 1, y: 0 }], [{ x: 0, y: 2 }]];
    const result = transformBodyParts(parts, { x: 10, y: 20 }, Math.PI / 2);
    expect(result[0][0].x).toBeCloseTo(10, 12);
    expect(result[0][0].y).toBeCloseTo(21, 12);
    expect(result[1][0].x).toBeCloseTo(8, 12);
    expect(result[1][0].y).toBeCloseTo(20, 12);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    const plain = transformBodyParts(parts, { x: 3, y: 4 });
    expect(plain[0][0]).toEqual({ x: 4, y: 4 });
    expect(plain[1][0]).toEqual({ x: 3, y: 6 });
  });

  test("convexPartsBoundingRadiusTiles is the farthest vertex over all parts", () => {
    expect(
      convexPartsBoundingRadiusTiles([
        [{ x: 3, y: 4 }],
        [{ x: -6, y: 8 }],
        [{ x: 1, y: 1 }],
      ]),
    ).toBe(10);
    expect(convexPartsBoundingRadiusTiles([[{ x: -3, y: -4 }]])).toBe(5);
  });
});

describe("sweptConvexOverlap", () => {
  const first = square(1);
  const approach = (t: number, dx = 3, dy = 0) =>
    sweptConvexOverlap(first, zero, square(1, dx + 2, dy + 2), { x: -t, y: 0 });

  test("stationary overlap, touching, separation", () => {
    expect(sweptConvexOverlap(first, zero, square(1, 1), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, 2), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, 2, 2), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, 2.001), zero)).toBe(false);
    expect(sweptConvexOverlap(first, zero, square(1, 0, 2.001), zero)).toBe(false);
    expect(sweptConvexOverlap(first, zero, square(1, -2.001), zero)).toBe(false);
    expect(sweptConvexOverlap(first, zero, square(1, 0, -2.001), zero)).toBe(false);
    expect(sweptConvexOverlap(first, zero, square(1, -2), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, 0, -2), zero)).toBe(true);
  });

  test("tolerance admits a hair-width gap and nothing wider", () => {
    expect(sweptConvexOverlap(first, zero, square(1, 2 + 1e-14), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, -2 - 1e-14), zero)).toBe(true);
    expect(sweptConvexOverlap(first, zero, square(1, 2 + 1e-9), zero)).toBe(false);
    expect(sweptConvexOverlap(first, zero, square(1, -2 - 1e-9), zero)).toBe(false);
  });

  test("tolerance scales with the larger coordinates of both bodies", () => {
    const wide = rect(0, 1e6, 0, 1);
    expect(
      sweptConvexOverlap(wide, zero, rect(1e6 + 1e-9, 1e6 + 1, 0, 1), zero),
    ).toBe(true);
    expect(
      sweptConvexOverlap(wide, zero, rect(1e6 + 1e-7, 1e6 + 1, 0, 1), zero),
    ).toBe(false);
    const far = rect(1e6, 1e6 + 1, 0, 1);
    expect(
      sweptConvexOverlap(rect(1e6 - 1, 1e6 - 1e-9, 0, 1), zero, far, zero),
    ).toBe(true);
    // y magnitude sets the scale as well
    const tall = rect(0, 1, 0, 1e6);
    expect(
      sweptConvexOverlap(tall, zero, rect(0, 1, 1e6 + 1e-9, 1e6 + 1), zero),
    ).toBe(true);
    expect(
      sweptConvexOverlap(tall, zero, rect(0, 1, 1e6 + 1e-7, 1e6 + 1), zero),
    ).toBe(false);
  });

  test("a closing second body hits only when it reaches", () => {
    // gap is 2 along x (first right edge 1, second left edge 3)
    expect(approach(1.9, 3, 0)).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 0), { x: -1.9, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 0), { x: -2, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 0), { x: -2.1, y: 0 }),
    ).toBe(true);
    // passes completely through
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 0), { x: -10, y: 0 }),
    ).toBe(true);
  });

  test("mirrored approaches (negative relative displacement)", () => {
    expect(
      sweptConvexOverlap(first, zero, square(1, -4, 0), { x: 1.9, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, -4, 0), { x: 2.1, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, -4, 0), { x: 10, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, 0, 4), { x: 0, y: -1.9 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, 0, 4), { x: 0, y: -2.1 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, 0, -4), { x: 0, y: 2.1 }),
    ).toBe(true);
  });

  test("moving apart never hits", () => {
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 0), { x: 10, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, -4, 0), { x: -10, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, { x: 10, y: 0 }, square(1, -4, 0), zero),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, { x: -10, y: 0 }, square(1, -4, 0), zero),
    ).toBe(true);
  });

  test("an overlapping pair moving apart still overlaps at time zero", () => {
    expect(
      sweptConvexOverlap(first, zero, square(1, 1), { x: 50, y: 0 }),
    ).toBe(true);
  });

  test("relative displacement is first minus second", () => {
    // identical displacement: relative motion is zero, gap stays
    expect(
      sweptConvexOverlap(first, { x: 5, y: 5 }, square(1, 4, 0), { x: 5, y: 5 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, { x: 0, y: 5 }, square(1, 4, 0), { x: 0, y: 5 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, { x: 5, y: 0 }, square(1, 4, 0), { x: 5, y: 0 }),
    ).toBe(false);
    // first moves toward second
    expect(
      sweptConvexOverlap(first, { x: 5, y: 0 }, square(1, 4, 0), zero),
    ).toBe(true);
    // both move toward each other by 1.1 each
    expect(
      sweptConvexOverlap(first, { x: 1.1, y: 0 }, square(1, 4, 0), { x: -1.1, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, { x: 0.9, y: 0 }, square(1, 4, 0), { x: -0.9, y: 0 }),
    ).toBe(false);
  });

  test("diagonal sweeps need the entry and exit windows to meet", () => {
    const target = square(1, 4, 4);
    // x window [0.2, 0.6], y window [0.4, 1.2] -> overlap [0.4, 0.6]
    expect(sweptConvexOverlap(first, zero, target, { x: -10, y: -5 })).toBe(true);
    // y window [0.8, 2.4] starts after x window ends at 0.6
    expect(sweptConvexOverlap(first, zero, target, { x: -10, y: -2.5 })).toBe(false);
    // x window starts after the y window ends
    expect(sweptConvexOverlap(first, zero, target, { x: -2.5, y: -10 })).toBe(false);
    expect(sweptConvexOverlap(first, zero, target, { x: -5, y: -10 })).toBe(true);
    // the exit side too: windows [0.2, 0.6] and [0.1, 0.3] -> true; but a
    // window ending before the other starts must fail
    expect(sweptConvexOverlap(first, zero, target, { x: -10, y: -20 })).toBe(true);
  });

  test("stationary on one axis requires a lateral overlap", () => {
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 1.5), { x: -10, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, 2.5), { x: -10, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, 4, -2.5), { x: -10, y: 0 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, 1.5, 4), { x: 0, y: -10 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, square(1, 2.5, 4), { x: 0, y: -10 }),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, square(1, -2.5, 4), { x: 0, y: -10 }),
    ).toBe(false);
  });

  test("a body behind a retreating mover is not hit", () => {
    expect(
      sweptConvexOverlap(first, { x: 10, y: 0 }, square(1, -4, 0), zero),
    ).toBe(false);
    expect(
      sweptConvexOverlap(first, { x: 10, y: 0 }, square(1, -4, 0), { x: 20, y: 0 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, { x: 20, y: 0 }, square(1, -4, 0), { x: 10, y: 0 }),
    ).toBe(false);
  });

  test("rotated bodies use diagonal axes", () => {
    const diamond = [
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
    ];
    // Square corner (1,1) vs diamond edge x+y=2: touching
    expect(sweptConvexOverlap(first, zero, diamond, zero)).toBe(true);
    const shifted = diamond.map((v) => ({ x: v.x + 0.01, y: v.y + 0.01 }));
    expect(sweptConvexOverlap(first, zero, shifted, zero)).toBe(true);
    const fartherAway = diamond.map((v) => ({ x: v.x + 2.5, y: v.y + 2.5 }));
    expect(sweptConvexOverlap(first, zero, fartherAway, zero)).toBe(false);
    expect(
      sweptConvexOverlap(first, zero, fartherAway, { x: -2, y: -2 }),
    ).toBe(true);
    expect(
      sweptConvexOverlap(first, zero, fartherAway, { x: -0.3, y: -0.3 }),
    ).toBe(false);
  });

  test("non-finite displacements throw", () => {
    expect(() =>
      sweptConvexOverlap(first, { x: NaN, y: 0 }, square(1, 5), zero),
    ).toThrow(/finite/);
    expect(() =>
      sweptConvexOverlap(first, zero, square(1, 5), { x: 0, y: Infinity }),
    ).toThrow(/finite/);
    expect(() =>
      sweptConvexOverlap(first, { x: 1.7e308, y: 0 }, square(1, 5), {
        x: -1.7e308,
        y: 0,
      }),
    ).toThrow(/finite/);
  });

  test("projected displacement overflow throws", () => {
    const diamond = [
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
    ];
    expect(() =>
      sweptConvexOverlap(diamond, { x: 1.7e308, y: 1.7e308 }, square(1, 1), zero),
    ).toThrow(/Projected displacement exceeds representable geometry/);
  });

  test("projection overflow throws", () => {
    expect(() =>
      sweptConvexOverlap(square(1e300, -1.7e308), zero, square(1e300, 1.7e308), zero),
    ).toThrow(/Body separation exceeds representable geometry/);
  });

  test("invalid bodies throw", () => {
    expect(() => sweptConvexOverlap(polygon(2), zero, first, zero)).toThrow(/3 to 8/);
    expect(() => sweptConvexOverlap(first, zero, polygon(9), zero)).toThrow(/3 to 8/);
  });
});

describe("sweptConvexPartsOverlap", () => {
  const parts = [square(1, -10, 0), square(1, 10, 0)];
  const target = square(1);

  test("any part overlapping is enough", () => {
    expect(sweptConvexPartsOverlap(parts, zero, target, zero)).toBe(false);
    expect(sweptConvexPartsOverlap(parts, { x: 9, y: 0 }, target, zero)).toBe(true);
    expect(sweptConvexPartsOverlap(parts, { x: -9, y: 0 }, target, zero)).toBe(true);
    expect(sweptConvexPartsOverlap(parts, { x: 7, y: 0 }, target, zero)).toBe(false);
    expect(sweptConvexPartsOverlap([], zero, target, zero)).toBe(false);
  });

  test("stationary edge cases match the tolerance rules", () => {
    const one = [square(1)];
    expect(sweptConvexPartsOverlap(one, zero, square(1, 2), zero)).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, -2), zero)).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 2 + 1e-14), zero)).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, -2 - 1e-14), zero)).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 2.001), zero)).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, -2.001), zero)).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 0, 2.001), zero)).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 0, -2.001), zero)).toBe(false);
  });

  test("tolerance scales with both inputs' coordinates", () => {
    const wide = [rect(0, 1e6, 0, 1)];
    expect(
      sweptConvexPartsOverlap(wide, zero, rect(1e6 + 1e-9, 1e6 + 1, 0, 1), zero),
    ).toBe(true);
    expect(
      sweptConvexPartsOverlap(wide, zero, rect(1e6 + 1e-7, 1e6 + 1, 0, 1), zero),
    ).toBe(false);
    const tall = [rect(0, 1, 0, 1e6)];
    expect(
      sweptConvexPartsOverlap(tall, zero, rect(0, 1, 1e6 + 1e-9, 1e6 + 1), zero),
    ).toBe(true);
    expect(
      sweptConvexPartsOverlap(
        [rect(1e6 - 1, 1e6 - 1e-9, 0, 1)],
        zero,
        rect(1e6, 1e6 + 1, 0, 1),
        zero,
      ),
    ).toBe(true);
    // second body's coordinates count too
    expect(
      sweptConvexPartsOverlap(
        [square(1)],
        zero,
        rect(1 + 1e-9, 1e6, -1, 1),
        zero,
      ),
    ).toBe(true);
  });

  test("swept timing, direction and relative motion", () => {
    const one = [square(1)];
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, 0), { x: -1.9, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, 0), { x: -2, y: 0 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, 0), { x: -10, y: 0 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, -4, 0), { x: 1.9, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, -4, 0), { x: 10, y: 0 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, 0), { x: 10, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, { x: 5, y: 0 }, square(1, 4, 0), { x: 5, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, { x: 0, y: 5 }, square(1, 4, 0), { x: 0, y: 5 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, { x: 5, y: 0 }, square(1, 4, 0), zero)).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 1), { x: 50, y: 0 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, { x: 10, y: 0 }, square(1, -4, 0), { x: 20, y: 0 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, { x: 20, y: 0 }, square(1, -4, 0), { x: 10, y: 0 })).toBe(false);
    const diag = square(1, 4, 4);
    expect(sweptConvexPartsOverlap(one, zero, diag, { x: -10, y: -5 })).toBe(true);
    expect(sweptConvexPartsOverlap(one, zero, diag, { x: -10, y: -2.5 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, diag, { x: -2.5, y: -10 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, 2.5), { x: -10, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 4, -2.5), { x: -10, y: 0 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 2.5, 4), { x: 0, y: -10 })).toBe(false);
    expect(sweptConvexPartsOverlap(one, zero, square(1, 1.5, 4), { x: 0, y: -10 })).toBe(true);
  });

  test("non-finite displacements and overflowing projections throw", () => {
    expect(() =>
      sweptConvexPartsOverlap([target], { x: NaN, y: 0 }, square(1, 5), zero),
    ).toThrow(/finite/);
    expect(() =>
      sweptConvexPartsOverlap([target], zero, square(1, 5), { x: 0, y: -Infinity }),
    ).toThrow(/finite/);
    expect(() =>
      sweptConvexPartsOverlap([square(1e300, -1.7e308)], zero, square(1e300, 1.7e308), zero),
    ).toThrow(/Body separation exceeds representable geometry/);
  });

  test("works with triangles and octagons (modular edge wrap)", () => {
    expect(sweptConvexPartsOverlap([polygon(3)], zero, polygon(8), zero)).toBe(true);
    expect(
      sweptConvexPartsOverlap(
        [polygon(8)],
        zero,
        polygon(3).map((v) => ({ x: v.x + 3, y: v.y })),
        zero,
      ),
    ).toBe(false);
  });
});

describe("arena inradius and shape validation", () => {
  test("circle returns its radius", () => {
    expect(arenaInradiusTiles(circle(7))).toBe(7);
  });

  test("octagon returns the nearer of flat side and corner face", () => {
    expect(arenaInradiusTiles(octagon(10, 15))).toBe(10);
    expect(arenaInradiusTiles(octagon(10, 14.1))).toBeCloseTo(14.1 * Math.SQRT1_2, 12);
    expect(arenaInradiusTiles(octagon(10, 14.1))).toBeLessThan(10);
  });

  test("invalid circles throw", () => {
    for (const radius of [0, -1, NaN, Infinity]) {
      expect(() => arenaInradiusTiles(circle(radius))).toThrow(
        /Circle radius must be positive finite tiles/,
      );
    }
    expect(() => arenaInradiusTiles(circle(1, { x: NaN, y: 0 }))).toThrow(/finite/);
    expect(() => arenaInradiusTiles(circle(1, { x: 0, y: NaN }))).toThrow(/finite/);
  });

  test("invalid octagons throw", () => {
    for (const flat of [0, -1, NaN, Infinity]) {
      expect(() => arenaInradiusTiles(octagon(flat, 14))).toThrow(
        /flat half-width must be positive finite/,
      );
    }
    for (const corner of [10, 9, 20, 21, NaN, Infinity]) {
      expect(() => arenaInradiusTiles(octagon(10, corner))).toThrow(
        /corner sum must exceed the flat half-width/,
      );
    }
    expect(() => arenaInradiusTiles(octagon(10, 10.0001))).not.toThrow();
    expect(() => arenaInradiusTiles(octagon(10, 19.9999))).not.toThrow();
    expect(() => arenaInradiusTiles(octagon(10, 14, { x: NaN, y: 0 }))).toThrow(
      /finite/,
    );
  });

  test("half planes are cached per shape and stay consistent", () => {
    const shape = octagon(10, 14);
    expect(arenaInradiusTiles(shape)).toBe(arenaInradiusTiles(shape));
  });
});

describe("convexBodyFitsOctagon", () => {
  const tiny = (cx: number, cy: number) => [
    { x: cx - 0.01, y: cy - 0.01 },
    { x: cx + 0.01, y: cy - 0.01 },
    { x: cx, y: cy + 0.01 },
  ];
  const normals = [
    [1, 0, 10],
    [-1, 0, 10],
    [0, 1, 10],
    [0, -1, 10],
    [Math.SQRT1_2, Math.SQRT1_2, 14 * Math.SQRT1_2],
    [Math.SQRT1_2, -Math.SQRT1_2, 14 * Math.SQRT1_2],
    [-Math.SQRT1_2, Math.SQRT1_2, 14 * Math.SQRT1_2],
    [-Math.SQRT1_2, -Math.SQRT1_2, 14 * Math.SQRT1_2],
  ];

  test.each(normals)("plane (%f, %f) bounds the body", (nx, ny, offset) => {
    for (const center of [zero, { x: 100, y: -50 }]) {
      const shape = octagon(10, 14, center);
      const inside = tiny(center.x + nx * (offset - 0.5), center.y + ny * (offset - 0.5));
      const outside = tiny(center.x + nx * (offset + 0.5), center.y + ny * (offset + 0.5));
      expect(convexBodyFitsOctagon(inside, shape)).toBe(true);
      expect(convexBodyFitsOctagon(outside, shape)).toBe(false);
    }
  });

  test("the octagon's own corners fit, a hair beyond does not", () => {
    const body = [
      { x: 10, y: -4 },
      { x: 10, y: 4 },
      { x: 4, y: 10 },
      { x: -4, y: 10 },
      { x: -10, y: 4 },
      { x: -10, y: -4 },
      { x: -4, y: -10 },
      { x: 4, y: -10 },
    ].reverse();
    expect(convexBodyFitsOctagon(body, octagon(10, 14))).toBe(true);
    expect(convexBodyFitsOctagon(body, octagon(10, 13.9))).toBe(false);
    expect(convexBodyFitsOctagon(body, octagon(9.9, 14))).toBe(false);
  });

  test("small-scale tolerance comes from the corner-sum roundoff budget", () => {
    // body tiny and centred: coordinate tolerance ~1e-17, corner budget ~2e-13
    const body = rect(-0.01, 10 + 1e-14, -0.01, 0.01);
    expect(convexBodyFitsOctagon(body, octagon(10, 14))).toBe(true);
    const beyond = rect(-0.01, 10 + 1e-9, -0.01, 0.01);
    expect(convexBodyFitsOctagon(beyond, octagon(10, 14))).toBe(false);
    // coordinate term 1.4e-13 < corner floor 2.0e-13
    const floorOnly = rect(-0.01, 10 + 1.7e-13, -0.01, 0.01);
    expect(convexBodyFitsOctagon(floorOnly, octagon(10, 14))).toBe(true);
  });

  test("large-scale tolerance comes from the coordinates", () => {
    const center = { x: 1e6, y: 0 };
    const body = rect(1e6 - 0.01, 1e6 + 10 + 1e-9, -0.01, 0.01);
    expect(convexBodyFitsOctagon(body, octagon(10, 14, center))).toBe(true);
    const beyond = rect(1e6 - 0.01, 1e6 + 10 + 1e-6, -0.01, 0.01);
    expect(convexBodyFitsOctagon(beyond, octagon(10, 14, center))).toBe(false);
    // y-dominated coordinates scale tolerance too
    const centerY = { x: 0, y: 1e6 };
    const bodyY = rect(-0.01, 0.01, 1e6 - 0.01, 1e6 + 10 + 1e-9);
    expect(convexBodyFitsOctagon(bodyY, octagon(10, 14, centerY))).toBe(true);
  });

  test("validates body and octagon", () => {
    expect(() => convexBodyFitsOctagon(polygon(2), octagon())).toThrow(/3 to 8/);
    expect(() => convexBodyFitsOctagon(square(1), octagon(-1, 14))).toThrow(
      /flat half-width/,
    );
  });

  test("dispatch by shape kind", () => {
    expect(convexBodyFitsArenaShape(square(1), circle(2))).toBe(true);
    expect(convexBodyFitsArenaShape(square(1), circle(1.2))).toBe(false);
    expect(convexBodyFitsArenaShape(square(1), octagon(10, 14))).toBe(true);
    expect(convexBodyFitsArenaShape(square(11), octagon(10, 14))).toBe(false);
    expect(convexBodyFitsArenaShape(square(8), circle(10))).toBe(false);
    expect(convexBodyFitsArenaShape(square(8), octagon(10, 14))).toBe(false);
  });
});

describe("convexBodyFitsCircle", () => {
  test("vertices on the rim fit, beyond do not, any centre", () => {
    expect(convexBodyFitsCircle(square(1), circle(Math.SQRT2))).toBe(true);
    expect(convexBodyFitsCircle(square(1), circle(1.4))).toBe(false);
    expect(convexBodyFitsCircle(square(1), circle(1.5))).toBe(true);
    const center = { x: 30, y: -20 };
    expect(convexBodyFitsCircle(square(1, 30, -20), circle(1.5, center))).toBe(true);
    expect(convexBodyFitsCircle(square(1, 30, -20), circle(1.4, center))).toBe(false);
    expect(convexBodyFitsCircle(square(1, 31, -20), circle(1.5, center))).toBe(false);
    expect(convexBodyFitsCircle(square(1, 30, -19), circle(1.5, center))).toBe(false);
  });

  test("tolerance has a roundoff floor and a coordinate term", () => {
    // coordinates (max 8) give 1.1e-13, the radius floor 1.42e-13
    const k = 1 + 1.3e-14;
    const floorOnly = [
      { x: 6 * k, y: 8 * k },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    expect(convexBodyFitsCircle(floorOnly, circle(10))).toBe(true);
    const edgeBody = [
      { x: 10 + 1e-14, y: 0 },
      { x: 9, y: 0.5 },
      { x: 9, y: -0.5 },
    ];
    expect(convexBodyFitsCircle(edgeBody, circle(10))).toBe(true);
    const farEdge = [
      { x: 10 + 1e-9, y: 0 },
      { x: 10, y: 0.01 },
      { x: 9.99, y: -0.01 },
    ];
    expect(convexBodyFitsCircle(farEdge, circle(10))).toBe(false);
    const center = { x: 1e6, y: 0 };
    const bigCoords = [
      { x: 1e6 + 10 + 1e-9, y: 0 },
      { x: 1e6 + 9, y: 0.5 },
      { x: 1e6 + 9, y: -0.5 },
    ];
    expect(convexBodyFitsCircle(bigCoords, circle(10, center))).toBe(true);
    const bigY = [
      { x: 0, y: 1e6 + 10 + 1e-9 },
      { x: 0.5, y: 1e6 + 9 },
      { x: -0.5, y: 1e6 + 9 },
    ];
    expect(convexBodyFitsCircle(bigY, circle(10, { x: 0, y: 1e6 }))).toBe(true);
    const bigBeyond = [
      { x: 1e6 + 10 + 1e-6, y: 0 },
      { x: 1e6 + 9, y: 0.5 },
      { x: 1e6 + 9, y: -0.5 },
    ];
    expect(convexBodyFitsCircle(bigBeyond, circle(10, center))).toBe(false);
  });

  test("validates inputs", () => {
    expect(() => convexBodyFitsCircle(polygon(2), circle(5))).toThrow(/3 to 8/);
    expect(() => convexBodyFitsCircle(square(1), circle(0))).toThrow(
      /Circle radius must be positive finite tiles/,
    );
  });
});

describe("maximumBodyCenterDistance", () => {
  const body = square(1);

  test("axis-aligned travel stops where the leading corner meets the rim", () => {
    const expected = Math.sqrt(99) - 1;
    expect(maximumBodyCenterDistance(body, { x: 1, y: 0 }, 10)).toBeCloseTo(expected, 12);
    expect(maximumBodyCenterDistance(body, { x: 0, y: 3 }, 10)).toBeCloseTo(expected, 12);
    expect(maximumBodyCenterDistance(body, { x: -2, y: 0 }, 10)).toBeCloseTo(expected, 12);
    expect(maximumBodyCenterDistance(body, { x: 0, y: -1 }, 10)).toBeCloseTo(expected, 12);
  });

  test("diagonal travel and off-centre bodies", () => {
    // direction (1,1)/sqrt2: leading corner (1,1) is on-axis: perpendicular 0
    expect(maximumBodyCenterDistance(body, { x: 1, y: 1 }, 10)).toBeCloseTo(
      10 - Math.SQRT2,
      12,
    );
    expect(maximumBodyCenterDistance(body, { x: -1, y: 1 }, 10)).toBeCloseTo(
      10 - Math.SQRT2,
      12,
    );
    // a lopsided body: min over every vertex, not only the first
    const lopsided = rect(-1, 3, -1, 1);
    const expected = Math.min(
      Math.sqrt(100 - 1) + 1,
      Math.sqrt(100 - 1) - 3,
    );
    expect(maximumBodyCenterDistance(lopsided, { x: 1, y: 0 }, 10)).toBeCloseTo(
      expected,
      12,
    );
    expect(maximumBodyCenterDistance(lopsided, { x: -1, y: 0 }, 10)).toBeCloseTo(
      Math.sqrt(99) - 1,
      12,
    );
    // perpendicular term uses y*nx - x*ny
    const tall = rect(-0.5, 0.5, -2, 2);
    expect(maximumBodyCenterDistance(tall, { x: 1, y: 0 }, 10)).toBeCloseTo(
      Math.sqrt(100 - 4) - 0.5,
      12,
    );
    expect(maximumBodyCenterDistance(tall, { x: 0, y: 1 }, 10)).toBeCloseTo(
      Math.sqrt(100 - 0.25) - 2,
      12,
    );
  });

  test("throws for bodies that do not fit, zero directions and overflow", () => {
    expect(() => maximumBodyCenterDistance(square(20), { x: 1, y: 0 }, 10)).toThrow(
      /must fit at the circle center/,
    );
    expect(() => maximumBodyCenterDistance(body, zero, 10)).toThrow(
      /finite nonzero length/,
    );
    expect(() => maximumBodyCenterDistance(body, { x: NaN, y: 0 }, 10)).toThrow(
      /finite/,
    );
    expect(() => maximumBodyCenterDistance(body, { x: Infinity, y: 0 }, 10)).toThrow(
      /finite/,
    );
    expect(() => maximumBodyCenterDistance(body, { x: 1, y: 0 }, 1e200)).toThrow(
      /Circle contact exceeds representable geometry/,
    );
  });

  test("a body that only just fits has a tiny non-negative reach", () => {
    const distance = maximumBodyCenterDistance(square(1), { x: 1, y: 0 }, Math.SQRT2);
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThan(1e-7);
  });
});

describe("pointOnRing", () => {
  test("offsets from the centre by radius at the bearing", () => {
    const point = pointOnRing({ x: 10, y: 20 }, 5, Math.PI / 2);
    expect(point.x).toBeCloseTo(10, 12);
    expect(point.y).toBeCloseTo(25, 12);
    const east = pointOnRing({ x: 10, y: 20 }, 5, 0);
    expect(east).toEqual({ x: 15, y: 20 });
  });
});

describe("clockwise winding parity", () => {
  const ccw = rect(-1, 3, -1, 1);
  const cw = [...ccw].reverse();
  const other = square(0.5, 5, 0.2);

  test("contact distance matches", () => {
    const direction = { x: 2, y: 1 };
    expect(convexContactDistance(cw, square(0.5), direction)).toBeCloseTo(
      convexContactDistance(ccw, square(0.5), direction),
      12,
    );
    expect(convexContactDistance(square(0.5), cw, direction)).toBeCloseTo(
      convexContactDistance(square(0.5), ccw, direction),
      12,
    );
  });

  test("swept overlap matches", () => {
    const move = { x: 3, y: 0 };
    expect(sweptConvexOverlap(cw, move, other, zero)).toBe(true);
    expect(sweptConvexOverlap(ccw, move, other, zero)).toBe(true);
    expect(sweptConvexOverlap(cw, zero, other, zero)).toBe(false);
  });

  test("arena fit and constraint match", () => {
    expect(convexBodyFitsOctagon(cw, octagon())).toBe(
      convexBodyFitsOctagon(ccw, octagon()),
    );
    const target = { x: 50, y: 3 };
    for (const shape of [octagon(), circle(10)]) {
      const arena = { shape, hazards: [] };
      expect(constrainBodyToArena(cw, target, arena)).toEqual(
        constrainBodyToArena(ccw, target, arena),
      );
    }
  });
});

describe("constrainBodyToArena", () => {
  const body = square(1);

  test("circle: interior candidates pass through unchanged", () => {
    const candidate = { x: 3, y: 4 };
    const arena = { shape: circle(10), hazards: [] };
    expect(constrainBodyToArena(body, candidate, arena)).toBe(candidate);
    const centre = { x: 0, y: 0 };
    expect(constrainBodyToArena(body, centre, arena)).toBe(centre);
  });

  test("circle: exterior candidates clamp along the radial direction", () => {
    const arena = { shape: circle(10, { x: 5, y: -5 }), hazards: [] };
    const limit = Math.sqrt(99) - 1;
    const east = constrainBodyToArena(body, { x: 500, y: -5 }, arena);
    expect(east.x).toBeCloseTo(5 + limit, 10);
    expect(east.y).toBeCloseTo(-5, 10);
    const north = constrainBodyToArena(body, { x: 5, y: 500 }, arena);
    expect(north.x).toBeCloseTo(5, 10);
    expect(north.y).toBeCloseTo(-5 + limit, 10);
    const diagonal = constrainBodyToArena(body, { x: -95, y: 95 }, arena);
    expect(diagonal.x).toBeCloseTo(5 - (10 - Math.SQRT2) * Math.SQRT1_2, 10);
    expect(diagonal.y).toBeCloseTo(-5 + (10 - Math.SQRT2) * Math.SQRT1_2, 10);
  });

  test("circle: non-finite candidates and unfit bodies throw", () => {
    const arena = { shape: circle(10), hazards: [] };
    expect(() => constrainBodyToArena(body, { x: NaN, y: 0 }, arena)).toThrow(/finite/);
    expect(() => constrainBodyToArena(body, { x: 0, y: Infinity }, arena)).toThrow(
      /finite/,
    );
    expect(() => constrainBodyToArena(square(20), { x: 1, y: 0 }, arena)).toThrow(
      /fit at the circle center/,
    );
    expect(() =>
      constrainBodyToArena(body, { x: 1, y: 0 }, { shape: circle(-1), hazards: [] }),
    ).toThrow(/Circle radius/);
    expect(() =>
      constrainBodyToArena(body, { x: 1, y: Infinity }, { shape: circle(5), hazards: [] }),
    ).toThrow(/finite/);
  });

  const octArena = (center: Vector2 = { x: 100, y: 50 }) => ({
    shape: octagon(10, 14, center),
    hazards: [],
  });

  test("octagon: interior candidates pass through unchanged", () => {
    const candidate = { x: 103, y: 52 };
    expect(constrainBodyToArena(body, candidate, octArena())).toBe(candidate);
    const edge = { x: 109, y: 50 };
    expect(constrainBodyToArena(body, edge, octArena())).toBe(edge);
  });

  test("octagon: tolerance admits a hair beyond the eroded wall only", () => {
    const hair = { x: 109 + 1e-14, y: 50 };
    expect(constrainBodyToArena(body, hair, octArena())).toBe(hair);
    const beyond = constrainBodyToArena(body, { x: 109 + 1e-6, y: 50 }, octArena());
    expect(beyond.x).toBeCloseTo(109, 9);
    expect(beyond.x).not.toBe(109 + 1e-6);
  });

  test("octagon: large coordinates widen the tolerance", () => {
    const arena = { shape: octagon(10, 14, { x: 1e6, y: 0 }), hazards: [] };
    const hair = { x: 1e6 + 9 + 1e-9, y: 0 };
    expect(constrainBodyToArena(body, hair, arena)).not.toBe(hair);
    const arenaY = { shape: octagon(10, 14, { x: 0, y: 1e6 }), hazards: [] };
    const hairY = { x: 0, y: 1e6 + 9 + 1e-9 };
    expect(constrainBodyToArena(body, hairY, arenaY)).not.toBe(hairY);
  });

  test("octagon: tolerance follows the body's and offset's own scale", () => {
    const huge = square(1e6);
    const arena = { shape: octagon(2e6, 3.9e6), hazards: [] };
    const hairX = { x: 1e6 + 3e-8, y: 0 };
    expect(constrainBodyToArena(huge, hairX, arena)).toBe(hairX);
    const hairY = { x: 0, y: 1e6 + 3e-8 };
    expect(constrainBodyToArena(huge, hairY, arena)).toBe(hairY);
    const beyond = { x: 1e6 + 1e-6, y: 0 };
    expect(constrainBodyToArena(huge, beyond, arena)).not.toBe(beyond);
  });

  test("octagon: the corner-sum roundoff floor exceeds the coordinate term", () => {
    // coordinate term 64eps*9 = 1.3e-13, corner floor 64eps*14 = 2.0e-13
    const hair = { x: 9 + 1.7e-13, y: 0 };
    expect(constrainBodyToArena(body, hair, octArena({ x: 0, y: 0 }))).toBe(hair);
  });

  test("octagon: flat walls clamp to the eroded offset", () => {
    const east = constrainBodyToArena(body, { x: 300, y: 50 }, octArena());
    expect(east.x).toBeCloseTo(109, 9);
    expect(east.y).toBeCloseTo(50, 9);
    const west = constrainBodyToArena(body, { x: -300, y: 50 }, octArena());
    expect(west.x).toBeCloseTo(91, 9);
    const north = constrainBodyToArena(body, { x: 100, y: 300 }, octArena());
    expect(north.y).toBeCloseTo(59, 9);
    const south = constrainBodyToArena(body, { x: 100, y: -300 }, octArena());
    expect(south.y).toBeCloseTo(41, 9);
  });

  test("octagon: corner faces clamp onto the eroded diagonal in every quadrant", () => {
    // diagonal offset 7*sqrt2 - 1*sqrt2 = 6*sqrt2 => point (6,6)
    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const result = constrainBodyToArena(
        body,
        { x: 100 + sx * 200, y: 50 + sy * 200 },
        octArena(),
      );
      expect(result.x).toBeCloseTo(100 + sx * 6, 9);
      expect(result.y).toBeCloseTo(50 + sy * 6, 9);
    }
  });

  test("octagon: nearest boundary point wins between neighbouring edges", () => {
    // beyond the east flat wall but near the corner: nearest is on the flat
    const result = constrainBodyToArena(body, { x: 100 + 20, y: 50 + 1 }, octArena());
    expect(result.x).toBeCloseTo(109, 9);
    expect(result.y).toBeCloseTo(51, 9);
    const result2 = constrainBodyToArena(body, { x: 100 - 1, y: 50 - 20 }, octArena());
    expect(result2.x).toBeCloseTo(99, 9);
    expect(result2.y).toBeCloseTo(41, 9);
  });

  test("octagon: a body that cannot sit at the centre throws", () => {
    expect(() =>
      constrainBodyToArena(square(11), { x: 100, y: 50 }, octArena()),
    ).toThrow(/Body must fit at the octagon center before travel/);
    expect(() =>
      constrainBodyToArena(body, { x: 100, y: 50 }, {
        shape: octagon(-1, 14),
        hazards: [],
      }),
    ).toThrow(/flat half-width/);
  });

  test("octagon: the fit check uses the origin, not the arena centre", () => {
    // body centred at origin fits an octagon centred far away
    expect(() =>
      constrainBodyToArena(body, { x: 1e5, y: 0 }, octArena({ x: 1e5, y: 0 })),
    ).not.toThrow();
  });

  test("octagon: a body that exactly fills the octagon pins to the centre", () => {
    const filling = [
      { x: 10, y: -4 },
      { x: 10, y: 4 },
      { x: 4, y: 10 },
      { x: -4, y: 10 },
      { x: -10, y: 4 },
      { x: -10, y: -4 },
      { x: -4, y: -10 },
      { x: 4, y: -10 },
    ].reverse();
    const arena = { shape: octagon(10, 14), hazards: [] };
    const result = constrainBodyToArena(filling, { x: 5, y: 3 }, arena);
    expect(result.x).toBeCloseTo(0, 6);
    expect(result.y).toBeCloseTo(0, 6);
  });

  test("octagon: non-finite candidates throw", () => {
    expect(() => constrainBodyToArena(body, { x: NaN, y: 0 }, octArena())).toThrow(
      /finite/,
    );
  });
});

describe("convexBodyOverlapsCircle", () => {
  const body = square(1);

  test("a centre inside the body overlaps regardless of radius", () => {
    expect(convexBodyOverlapsCircle(body, { x: 0.5, y: -0.5 }, 0.001)).toBe(true);
    expect(convexBodyOverlapsCircle(body, zero, 0.001)).toBe(true);
  });

  test("distance to each side against the radius", () => {
    const sides: [Vector2, Vector2][] = [
      [{ x: 1.5, y: 0 }, { x: 1, y: 0 }],
      [{ x: -1.5, y: 0 }, { x: -1, y: 0 }],
      [{ x: 0, y: 1.5 }, { x: 0, y: 1 }],
      [{ x: 0, y: -1.5 }, { x: 0, y: -1 }],
    ];
    for (const [centre] of sides) {
      expect(convexBodyOverlapsCircle(body, centre, 0.6)).toBe(true);
      expect(convexBodyOverlapsCircle(body, centre, 0.4)).toBe(false);
      expect(convexBodyOverlapsCircle(body, centre, 0.5)).toBe(true);
    }
    // a skewed (non-diagonal-symmetric) placement along the edge
    expect(convexBodyOverlapsCircle(body, { x: 0.3, y: 1.5 }, 0.6)).toBe(true);
    expect(convexBodyOverlapsCircle(body, { x: 0.3, y: 1.5 }, 0.4)).toBe(false);
  });

  test("beyond a corner the nearest point is the vertex", () => {
    const corner = Math.hypot(0.5, 0.5);
    for (const [sx, sy] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const centre = { x: sx * 1.5, y: sy * 1.5 };
      expect(convexBodyOverlapsCircle(body, centre, corner + 0.01)).toBe(true);
      expect(convexBodyOverlapsCircle(body, centre, corner - 0.01)).toBe(false);
    }
    // far down the line of an edge: clamp to the segment's end
    expect(convexBodyOverlapsCircle(body, { x: 5, y: 1 }, 3.9)).toBe(false);
    expect(convexBodyOverlapsCircle(body, { x: 5, y: 1 }, 4.1)).toBe(true);
    expect(convexBodyOverlapsCircle(body, { x: -5, y: -1 }, 3.9)).toBe(false);
    expect(convexBodyOverlapsCircle(body, { x: -5, y: -1 }, 4.1)).toBe(true);
  });

  test("tolerance admits a hair beyond the radius", () => {
    expect(convexBodyOverlapsCircle(body, { x: 1.5 + 1e-14, y: 0 }, 0.5)).toBe(true);
    expect(convexBodyOverlapsCircle(body, { x: 1.5 + 1e-9, y: 0 }, 0.5)).toBe(false);
    const wide = rect(0, 1e6, 0, 1);
    expect(convexBodyOverlapsCircle(wide, { x: 1e6 + 1 + 1e-9, y: 0.5 }, 1)).toBe(true);
    expect(convexBodyOverlapsCircle(wide, { x: 1e6 + 1 + 1e-6, y: 0.5 }, 1)).toBe(false);
    const tall = rect(0, 1, 0, 1e6);
    expect(convexBodyOverlapsCircle(tall, { x: 0.5, y: 1e6 + 1 + 1e-9 }, 1)).toBe(true);
    // circle centre's own coordinates also widen the tolerance
    expect(
      convexBodyOverlapsCircle(rect(0, 1, 0, 1), { x: 1e6 + 0.5, y: 0.5 }, 1e6 - 0.5 - 1e-9),
    ).toBe(true);
    expect(
      convexBodyOverlapsCircle(rect(0, 1, 0, 1), { x: 0.5, y: 1e6 + 0.5 }, 1e6 - 0.5 - 1e-9),
    ).toBe(true);
  });

  test("roundoff floor on the radius", () => {
    const radius = 1e-3;
    expect(
      convexBodyOverlapsCircle(body, { x: 1 + radius + 1e-17, y: 0 }, radius),
    ).toBe(true);
  });

  test("clockwise bodies behave like counter-clockwise ones", () => {
    const clockwise = [...body].reverse();
    expect(convexBodyOverlapsCircle(clockwise, { x: 1.5, y: 0 }, 0.4)).toBe(false);
    expect(convexBodyOverlapsCircle(clockwise, { x: 1.5, y: 0 }, 0.6)).toBe(true);
  });

  // Fix from the user's 2026-11-18 decision: clockwise bodies are supported.
  test("clockwise body: centre inside overlaps", () => {
    const clockwise = [...body].reverse();
    expect(convexBodyOverlapsCircle(clockwise, zero, 0.001)).toBe(true);
  });

  test("clockwise body: containment matches counter-clockwise off-centre", () => {
    const ccw = rect(-1, 3, -1, 1);
    const cw = [...ccw].reverse();
    for (const shape of [ccw, cw]) {
      expect(convexBodyOverlapsCircle(shape, { x: 1, y: 0.3 }, 0.01)).toBe(true);
      expect(convexBodyOverlapsCircle(shape, { x: 4, y: 0 }, 0.5)).toBe(false);
    }
  });

  test("validates inputs", () => {
    expect(() => convexBodyOverlapsCircle(polygon(2), zero, 1)).toThrow(/3 to 8/);
    expect(() => convexBodyOverlapsCircle(body, { x: NaN, y: 0 }, 1)).toThrow(/finite/);
    expect(() => convexBodyOverlapsCircle(body, { x: 0, y: Infinity }, 1)).toThrow(
      /finite/,
    );
    for (const radius of [0, -1, NaN, Infinity]) {
      expect(() => convexBodyOverlapsCircle(body, zero, radius)).toThrow(
        /Circle radius must be positive finite tiles/,
      );
    }
  });
});

describe("convexContactDistance", () => {
  const body = square(1);

  test("axis-aligned contact is the summed half-widths", () => {
    expect(convexContactDistance(body, body, { x: 1, y: 0 })).toBeCloseTo(2, 12);
    expect(convexContactDistance(body, body, { x: -1, y: 0 })).toBeCloseTo(2, 12);
    expect(convexContactDistance(body, body, { x: 0, y: 1 })).toBeCloseTo(2, 12);
    expect(convexContactDistance(body, body, { x: 0, y: -4 })).toBeCloseTo(2, 12);
  });

  test("asymmetric bodies and sizes", () => {
    const first = rect(-1, 3, -1, 1);
    const second = rect(-0.5, 2, -2, 0.5);
    expect(convexContactDistance(first, second, { x: 1, y: 0 })).toBeCloseTo(3 + 0.5, 12);
    expect(convexContactDistance(first, second, { x: -1, y: 0 })).toBeCloseTo(1 + 2, 12);
    expect(convexContactDistance(first, second, { x: 0, y: 1 })).toBeCloseTo(1 + 2, 12);
    expect(convexContactDistance(first, second, { x: 0, y: -1 })).toBeCloseTo(1 + 0.5, 12);
  });

  test("oblique directions", () => {
    expect(convexContactDistance(body, body, { x: 1, y: 1 })).toBeCloseTo(2 * Math.SQRT2, 12);
    expect(convexContactDistance(body, body, { x: -1, y: 1 })).toBeCloseTo(2 * Math.SQRT2, 12);
    expect(convexContactDistance(body, body, { x: 2, y: 1 })).toBeCloseTo(
      2 / (2 / Math.sqrt(5)),
      12,
    );
    expect(convexContactDistance(body, body, { x: 1, y: 2 })).toBeCloseTo(
      2 / (2 / Math.sqrt(5)),
      12,
    );
  });

  test("anchors must lie inside both bodies", () => {
    const far = rect(1, 3, -1, 1);
    expect(() => convexContactDistance(far, body, { x: 1, y: 0 })).toThrow(
      /contain their local center anchors/,
    );
    expect(() => convexContactDistance(rect(-3, -1, -1, 1), body, { x: 1, y: 0 })).toThrow(
      /local center anchors/,
    );
    expect(() => convexContactDistance(body, far, { x: 1, y: 0 })).toThrow(
      /local center anchors/,
    );
    expect(() => convexContactDistance(body, rect(-3, -1, -1, 1), { x: 1, y: 0 })).toThrow(
      /local center anchors/,
    );
    expect(() => convexContactDistance(rect(-1, 1, 1, 3), body, { x: 1, y: 0 })).toThrow(
      /local center anchors/,
    );
    expect(() => convexContactDistance(body, rect(-1, 1, -3, -1), { x: 1, y: 0 })).toThrow(
      /local center anchors/,
    );
  });

  test("anchor on an edge is allowed, a hair outside within tolerance too", () => {
    expect(convexContactDistance(rect(0, 2, -1, 1), body, { x: 1, y: 0 })).toBeCloseTo(
      3,
      12,
    );
    expect(convexContactDistance(rect(-2, 0, -1, 1), body, { x: 1, y: 0 })).toBeCloseTo(
      1,
      12,
    );
    expect(convexContactDistance(rect(1e-14, 2, -1, 1), body, { x: 1, y: 0 })).toBeCloseTo(
      3,
      9,
    );
    expect(convexContactDistance(body, rect(1e-14, 2, -1, 1), { x: 1, y: 0 })).toBeCloseTo(
      1 - 1e-14,
      9,
    );
    expect(convexContactDistance(rect(-2, -1e-14, -1, 1), body, { x: 1, y: 0 })).toBeCloseTo(
      1,
      9,
    );
    expect(convexContactDistance(body, rect(-2, -1e-14, -1, 1), { x: 1, y: 0 })).toBeCloseTo(
      3,
      9,
    );
    expect(() =>
      convexContactDistance(rect(1e-9, 2, -1, 1), body, { x: 1, y: 0 }),
    ).toThrow(/local center anchors/);
    expect(() =>
      convexContactDistance(rect(-2, -1e-9, -1, 1), body, { x: 1, y: 0 }),
    ).toThrow(/local center anchors/);
    expect(() =>
      convexContactDistance(body, rect(1e-9, 2, -1, 1), { x: 1, y: 0 }),
    ).toThrow(/local center anchors/);
    expect(() =>
      convexContactDistance(body, rect(-2, -1e-9, -1, 1), { x: 1, y: 0 }),
    ).toThrow(/local center anchors/);
  });

  test("anchor tolerance scales with coordinate magnitude", () => {
    // coordinates near 1e6 widen the tolerance to 1.4e-8
    const first = rect(1e-9, 1e6, -1, 1);
    expect(() => convexContactDistance(first, body, { x: 1, y: 0 })).not.toThrow();
    const firstNeg = rect(-1e6, -1e-9, -1, 1);
    expect(() => convexContactDistance(firstNeg, body, { x: 1, y: 0 })).not.toThrow();
    const tall = rect(1e-9, 1, -1e6, 1e6);
    expect(() => convexContactDistance(tall, body, { x: 1, y: 0 })).not.toThrow();
    const tallNeg = rect(-1, -1e-9, -1, 1e6);
    expect(() => convexContactDistance(tallNeg, body, { x: 1, y: 0 })).not.toThrow();
    // second body also contributes to the scale
    expect(() =>
      convexContactDistance(rect(1e-9, 1, -1, 1), rect(-1e6, 1e6, -1, 1), {
        x: 1,
        y: 0,
      }),
    ).not.toThrow();
  });

  test("anchors that only touch within tolerance give a negative reach and throw", () => {
    const left = rect(-2, -1e-14, -1, 1);
    const right = rect(1e-14, 2, -1, 1);
    expect(() => convexContactDistance(left, right, { x: 1, y: 0 })).toThrow(
      /Silhouette contact exceeds representable geometry/,
    );
  });

  test("zero or non-finite direction throws; invalid bodies throw", () => {
    expect(() => convexContactDistance(body, body, zero)).toThrow(/nonzero length/);
    expect(() => convexContactDistance(body, body, { x: NaN, y: 1 })).toThrow(/finite/);
    expect(() => convexContactDistance(polygon(2), body, { x: 1, y: 0 })).toThrow(/3 to 8/);
    expect(() => convexContactDistance(body, polygon(9), { x: 1, y: 0 })).toThrow(/3 to 8/);
  });
});

describe("pursueBody", () => {
  const body = square(1);
  const target = { x: 10, y: 0 };

  test("closes to contact and stops there", () => {
    const result = pursueBody(body, zero, body, target, 100);
    expect(result.x).toBeCloseTo(8, 12);
    expect(result.y).toBeCloseTo(0, 12);
  });

  test("travel is limited by the allowance", () => {
    const result = pursueBody(body, { x: 1, y: 2 }, body, { x: 11, y: 2 }, 3);
    expect(result.x).toBeCloseTo(4, 12);
    expect(result.y).toBeCloseTo(2, 12);
  });

  test("zero allowance, zero distance and already-touching stay put", () => {
    const start = { x: 1, y: 1 };
    expect(pursueBody(body, start, body, target, 0)).toBe(start);
    expect(pursueBody(body, start, body, start, 5)).toBe(start);
    expect(pursueBody(body, zero, body, { x: 2, y: 0 }, 5)).toEqual(zero);
    expect(pursueBody(body, zero, body, { x: 1.5, y: 0 }, 5)).toEqual(zero);
  });

  test("a hair beyond contact stays put (tolerance), a real gap closes", () => {
    const start = zero;
    expect(pursueBody(body, start, body, { x: 2 + 1e-14, y: 0 }, 5)).toBe(start);
    const moved = pursueBody(body, start, body, { x: 2 + 1e-9, y: 0 }, 5);
    expect(moved.x).toBeCloseTo(1e-9, 12);
    expect(moved.x).toBeGreaterThan(0);
    // large coordinates widen the tolerance
    const startBig = { x: 1e6, y: 0 };
    expect(pursueBody(body, startBig, body, { x: 1e6 + 2 + 1e-9, y: 0 }, 5)).toBe(startBig);
    const startBigY = { x: 0, y: 1e6 };
    expect(pursueBody(body, startBigY, body, { x: 0, y: 1e6 + 2 + 1e-9 }, 5)).toBe(
      startBigY,
    );
  });

  test("diagonal and negative-direction pursuit", () => {
    const result = pursueBody(body, zero, body, { x: -10, y: -10 }, 100);
    const stop = 2 * Math.SQRT2;
    const distance = 10 * Math.SQRT2;
    expect(result.x).toBeCloseTo(-(distance - stop) * Math.SQRT1_2, 10);
    expect(result.y).toBeCloseTo(-(distance - stop) * Math.SQRT1_2, 10);
  });

  test("invalid inputs throw", () => {
    for (const travel of [-1, NaN, Infinity]) {
      expect(() => pursueBody(body, zero, body, target, travel)).toThrow(
        /nonnegative finite tiles/,
      );
    }
    expect(() => pursueBody(polygon(2), zero, body, target, 1)).toThrow(/3 to 8/);
    expect(() => pursueBody(body, zero, polygon(2), target, 1)).toThrow(/3 to 8/);
    expect(() => pursueBody(body, { x: NaN, y: 0 }, body, target, 1)).toThrow(/finite/);
    expect(() => pursueBody(body, zero, body, { x: 0, y: NaN }, 1)).toThrow(/finite/);
  });
});

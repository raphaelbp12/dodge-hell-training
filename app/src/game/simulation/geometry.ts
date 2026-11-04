import { Matrix } from "@flatten-js/core";
import type { Arena, ArenaShape, CircularArena, Vector2 } from "../models";

type OctagonArena = Extract<ArenaShape, { kind: "octagon" }>;

const minimumBodyVertexCount = 3;
const maximumBodyVertexCount = 8;
const numericalRoundoffBudget = 64 * Number.EPSILON;
const originTiles = { x: 0, y: 0 };

function assertFiniteVector(vector: Vector2): void {
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    throw new RangeError(
      "Geometry coordinates and displacements must be finite",
    );
  }
}

function coordinateTolerance(verticesTiles: readonly Vector2[]): number {
  return (
    numericalRoundoffBudget *
    Math.max(
      ...verticesTiles.map((vertex) =>
        Math.max(Math.abs(vertex.x), Math.abs(vertex.y)),
      ),
    )
  );
}

function validatedAxes(verticesTiles: readonly Vector2[]): Vector2[] {
  if (
    verticesTiles.length < minimumBodyVertexCount ||
    verticesTiles.length > maximumBodyVertexCount
  ) {
    throw new RangeError("Convex bodies require 3 to 8 ordered vertices");
  }
  verticesTiles.forEach(assertFiniteVector);
  const toleranceTiles = coordinateTolerance(verticesTiles);
  let winding = 0;
  return verticesTiles.map((start, index) => {
    const endIndex = (index + 1) % verticesTiles.length;
    const end = verticesTiles[endIndex];
    const horizontal = end.x - start.x;
    const vertical = end.y - start.y;
    const lengthTiles = Math.hypot(horizontal, vertical);
    if (!Number.isFinite(lengthTiles) || lengthTiles <= toleranceTiles) {
      throw new RangeError(
        "Convex bodies require distinct, representable edges",
      );
    }
    const axis = { x: -vertical / lengthTiles, y: horizontal / lengthTiles };
    verticesTiles.forEach((vertex, vertexIndex) => {
      if (vertexIndex === index || vertexIndex === endIndex) return;
      const distanceTiles =
        (vertex.x - start.x) * axis.x + (vertex.y - start.y) * axis.y;
      if (
        !Number.isFinite(distanceTiles) ||
        Math.abs(distanceTiles) <= toleranceTiles
      ) {
        throw new RangeError(
          "Convex bodies must have nondegenerate, noncollinear corners",
        );
      }
      const side = Math.sign(distanceTiles);
      if (winding !== 0 && side !== winding) {
        throw new RangeError(
          "Body vertices must form an ordered convex boundary",
        );
      }
      winding = side;
    });
    return axis;
  });
}

export function transformBodyVertices(
  localVerticesTiles: readonly Vector2[],
  positionTiles: Vector2,
  orientationRadians = 0,
): readonly Vector2[] {
  validatedAxes(localVerticesTiles);
  assertFiniteVector(positionTiles);
  if (!Number.isFinite(orientationRadians)) {
    throw new RangeError("Body orientation must be finite radians");
  }
  const matrix = new Matrix()
    .translate(positionTiles.x, positionTiles.y)
    .rotate(orientationRadians);
  const verticesTiles = localVerticesTiles.map((vertex) => {
    const [horizontal, vertical] = matrix.transform([vertex.x, vertex.y]);
    return { x: horizontal, y: vertical };
  });
  validatedAxes(verticesTiles);
  return verticesTiles;
}

function project(
  verticesTiles: readonly Vector2[],
  axis: Vector2,
  originTiles: Vector2,
): Readonly<{ minimum: number; maximum: number }> {
  const projections = verticesTiles.map((vertex) => {
    const projection =
      (vertex.x - originTiles.x) * axis.x + (vertex.y - originTiles.y) * axis.y;
    if (!Number.isFinite(projection)) {
      throw new RangeError("Body separation exceeds representable geometry");
    }
    return projection;
  });
  return {
    minimum: Math.min(...projections),
    maximum: Math.max(...projections),
  };
}

/**
 * Fixed validation ceiling for a compound projectile body. The largest
 * authored template currently produces 58 parts (the hive); a focused test
 * asserts the catalog never exceeds this value. It is not recomputed at
 * runtime, so changing the templates requires updating the ceiling and its
 * assertion together.
 */
export const MAXIMUM_BODY_PART_COUNT = 58;

export type ConvexPart = readonly Vector2[];

export function validateConvexParts(parts: readonly ConvexPart[]): void {
  if (parts.length === 0)
    throw new RangeError("Compound bodies require at least one part");
  if (parts.length > MAXIMUM_BODY_PART_COUNT)
    throw new RangeError(
      `Compound bodies may contain at most ${MAXIMUM_BODY_PART_COUNT} parts`,
    );
  for (const part of parts) validatedAxes(part);
}

/**
 * Fast rigid transform for already-validated rectangular parts. It performs
 * the same `translate(position) * rotate(orientation)` operation as
 * `transformBodyVertices` without re-validating every part on every step.
 */
export function transformBodyParts(
  parts: readonly ConvexPart[],
  positionTiles: Vector2,
  orientationRadians = 0,
): readonly (readonly Vector2[])[] {
  const cos = Math.cos(orientationRadians);
  const sin = Math.sin(orientationRadians);
  return Object.freeze(
    parts.map((part) =>
      Object.freeze(
        part.map((vertex) => ({
          x: vertex.x * cos - vertex.y * sin + positionTiles.x,
          y: vertex.x * sin + vertex.y * cos + positionTiles.y,
        })),
      ),
    ),
  );
}

function uncheckedAxes(verticesTiles: readonly Vector2[]): Vector2[] {
  return verticesTiles.map((start, index) => {
    const end = verticesTiles[(index + 1) % verticesTiles.length];
    const vertical = end.y - start.y;
    const horizontal = end.x - start.x;
    const lengthTiles = Math.hypot(horizontal, vertical);
    return { x: -vertical / lengthTiles, y: horizontal / lengthTiles };
  });
}

function sweptConvexOverlapPrepared(
  firstStartVerticesTiles: readonly Vector2[],
  firstAxes: readonly Vector2[],
  secondStartVerticesTiles: readonly Vector2[],
  secondAxes: readonly Vector2[],
  firstDisplacementTiles: Vector2,
  secondDisplacementTiles: Vector2,
  toleranceTiles: number,
): boolean {
  const axes = [...firstAxes, ...secondAxes];
  const relativeDisplacementTiles = {
    x: firstDisplacementTiles.x - secondDisplacementTiles.x,
    y: firstDisplacementTiles.y - secondDisplacementTiles.y,
  };
  const originTiles = firstStartVerticesTiles[0];
  let entryFraction = 0;
  let exitFraction = 1;
  for (const axis of axes) {
    const first = project(firstStartVerticesTiles, axis, originTiles);
    const second = project(secondStartVerticesTiles, axis, originTiles);
    const displacement =
      relativeDisplacementTiles.x * axis.x +
      relativeDisplacementTiles.y * axis.y;
    if (displacement === 0) {
      if (
        second.minimum - first.maximum - toleranceTiles > 0 ||
        second.maximum - first.minimum + toleranceTiles < 0
      )
        return false;
      continue;
    }
    const firstFraction =
      (second.minimum - first.maximum - toleranceTiles) / displacement;
    const secondFraction =
      (second.maximum - first.minimum + toleranceTiles) / displacement;
    entryFraction = Math.max(
      entryFraction,
      Math.min(firstFraction, secondFraction),
    );
    exitFraction = Math.min(
      exitFraction,
      Math.max(firstFraction, secondFraction),
    );
    if (entryFraction > exitFraction) return false;
  }
  return true;
}

export function sweptConvexPartsOverlap(
  firstStartPartsTiles: readonly ConvexPart[],
  firstDisplacementTiles: Vector2,
  secondStartVerticesTiles: readonly Vector2[],
  secondDisplacementTiles: Vector2,
): boolean {
  assertFiniteVector(firstDisplacementTiles);
  assertFiniteVector(secondDisplacementTiles);
  const secondAxes = uncheckedAxes(secondStartVerticesTiles);
  const toleranceTiles = coordinateTolerance([
    ...firstStartPartsTiles.flatMap((part) => part),
    ...secondStartVerticesTiles,
  ]);
  for (const part of firstStartPartsTiles) {
    if (
      sweptConvexOverlapPrepared(
        part,
        uncheckedAxes(part),
        secondStartVerticesTiles,
        secondAxes,
        firstDisplacementTiles,
        secondDisplacementTiles,
        toleranceTiles,
      )
    )
      return true;
  }
  return false;
}

export function convexPartsBoundingRadiusTiles(
  parts: readonly ConvexPart[],
): number {
  return Math.max(
    ...parts.flatMap((part) =>
      part.map((vertex) => Math.hypot(vertex.x, vertex.y)),
    ),
  );
}

export function sweptConvexOverlap(
  firstStartVerticesTiles: readonly Vector2[],
  firstDisplacementTiles: Vector2,
  secondStartVerticesTiles: readonly Vector2[],
  secondDisplacementTiles: Vector2,
): boolean {
  const axes = [
    ...validatedAxes(firstStartVerticesTiles),
    ...validatedAxes(secondStartVerticesTiles),
  ];
  assertFiniteVector(firstDisplacementTiles);
  assertFiniteVector(secondDisplacementTiles);
  const relativeDisplacementTiles = {
    x: firstDisplacementTiles.x - secondDisplacementTiles.x,
    y: firstDisplacementTiles.y - secondDisplacementTiles.y,
  };
  assertFiniteVector(relativeDisplacementTiles);
  const toleranceTiles = coordinateTolerance([
    ...firstStartVerticesTiles,
    ...secondStartVerticesTiles,
  ]);
  const originTiles = firstStartVerticesTiles[0];
  let entryFraction = 0;
  let exitFraction = 1;
  for (const axis of axes) {
    const first = project(firstStartVerticesTiles, axis, originTiles);
    const second = project(secondStartVerticesTiles, axis, originTiles);
    const displacement =
      relativeDisplacementTiles.x * axis.x +
      relativeDisplacementTiles.y * axis.y;
    if (!Number.isFinite(displacement)) {
      throw new RangeError(
        "Projected displacement exceeds representable geometry",
      );
    }
    const entryDistanceTiles = second.minimum - first.maximum - toleranceTiles;
    const exitDistanceTiles = second.maximum - first.minimum + toleranceTiles;
    if (displacement === 0) {
      if (entryDistanceTiles > 0 || exitDistanceTiles < 0) return false;
      continue;
    }
    const firstFraction = entryDistanceTiles / displacement;
    const secondFraction = exitDistanceTiles / displacement;
    entryFraction = Math.max(
      entryFraction,
      Math.min(firstFraction, secondFraction),
    );
    exitFraction = Math.min(
      exitFraction,
      Math.max(firstFraction, secondFraction),
    );
    if (entryFraction > exitFraction) return false;
  }
  return true;
}

function assertCircle(arena: CircularArena): void {
  assertFiniteVector(arena.centerTiles);
  if (!Number.isFinite(arena.radiusTiles) || arena.radiusTiles <= 0) {
    throw new RangeError("Circle radius must be positive finite tiles");
  }
}

/**
 * An octagon's eight half-planes, derived once per authored shape (W03): the
 * four axis-aligned flat sides at `flatHalfWidthTiles`, and the four 45-degree
 * corner faces at `cornerSumTiles / sqrt(2)`. Cached per shape object so a
 * step never re-derives them.
 */
type HalfPlane = Readonly<{ normal: Vector2; offsetTiles: number }>;

const octagonHalfPlaneCache = new WeakMap<OctagonArena, readonly HalfPlane[]>();
const inverseSqrt2 = Math.SQRT1_2;

function assertOctagon(octagon: OctagonArena): void {
  assertFiniteVector(octagon.centerTiles);
  if (
    !Number.isFinite(octagon.flatHalfWidthTiles) ||
    octagon.flatHalfWidthTiles <= 0
  ) {
    throw new RangeError("Octagon flat half-width must be positive finite tiles");
  }
  if (
    !Number.isFinite(octagon.cornerSumTiles) ||
    octagon.cornerSumTiles <= octagon.flatHalfWidthTiles ||
    octagon.cornerSumTiles >= 2 * octagon.flatHalfWidthTiles
  ) {
    throw new RangeError(
      "Octagon corner sum must exceed the flat half-width and stay below twice it",
    );
  }
}

function octagonHalfPlanes(octagon: OctagonArena): readonly HalfPlane[] {
  const cached = octagonHalfPlaneCache.get(octagon);
  if (cached) return cached;
  const diagonalOffsetTiles = octagon.cornerSumTiles * inverseSqrt2;
  const halfPlanes: readonly HalfPlane[] = Object.freeze([
    { normal: { x: 1, y: 0 }, offsetTiles: octagon.flatHalfWidthTiles },
    { normal: { x: -1, y: 0 }, offsetTiles: octagon.flatHalfWidthTiles },
    { normal: { x: 0, y: 1 }, offsetTiles: octagon.flatHalfWidthTiles },
    { normal: { x: 0, y: -1 }, offsetTiles: octagon.flatHalfWidthTiles },
    {
      normal: { x: inverseSqrt2, y: inverseSqrt2 },
      offsetTiles: diagonalOffsetTiles,
    },
    {
      normal: { x: inverseSqrt2, y: -inverseSqrt2 },
      offsetTiles: diagonalOffsetTiles,
    },
    {
      normal: { x: -inverseSqrt2, y: inverseSqrt2 },
      offsetTiles: diagonalOffsetTiles,
    },
    {
      normal: { x: -inverseSqrt2, y: -inverseSqrt2 },
      offsetTiles: diagonalOffsetTiles,
    },
  ]);
  octagonHalfPlaneCache.set(octagon, halfPlanes);
  return halfPlanes;
}

/** The inradius of any authored arena shape: the distance to its nearest wall. */
export function arenaInradiusTiles(shape: ArenaShape): number {
  if (shape.kind === "circle") {
    assertCircle(shape);
    return shape.radiusTiles;
  }
  assertOctagon(shape);
  return Math.min(
    ...octagonHalfPlanes(shape).map((plane) => plane.offsetTiles),
  );
}

/** Support function `max(v . n)` over a body's own (already centred) vertices. */
function bodySupport(
  orientedLocalVerticesTiles: readonly Vector2[],
  normal: Vector2,
): number {
  return Math.max(
    ...orientedLocalVerticesTiles.map(
      (vertex) => vertex.x * normal.x + vertex.y * normal.y,
    ),
  );
}

export function convexBodyFitsOctagon(
  worldVerticesTiles: readonly Vector2[],
  octagon: OctagonArena,
): boolean {
  validatedAxes(worldVerticesTiles);
  assertOctagon(octagon);
  const toleranceTiles = Math.max(
    coordinateTolerance([...worldVerticesTiles, octagon.centerTiles]),
    numericalRoundoffBudget * octagon.cornerSumTiles,
  );
  return octagonHalfPlanes(octagon).every((plane) => {
    const supportTiles = Math.max(
      ...worldVerticesTiles.map(
        (vertex) =>
          (vertex.x - octagon.centerTiles.x) * plane.normal.x +
          (vertex.y - octagon.centerTiles.y) * plane.normal.y,
      ),
    );
    return supportTiles <= plane.offsetTiles + toleranceTiles;
  });
}

/** Dispatches containment on `shape.kind`; the only place outside the two
 * shape-specific fit checks that needs to know both kinds exist. */
export function convexBodyFitsArenaShape(
  worldVerticesTiles: readonly Vector2[],
  shape: ArenaShape,
): boolean {
  return shape.kind === "circle"
    ? convexBodyFitsCircle(worldVerticesTiles, shape)
    : convexBodyFitsOctagon(worldVerticesTiles, shape);
}

/**
 * Clips a convex polygon (vertices in order) to the half-plane
 * `v . normal <= offsetTiles`, by the Sutherland-Hodgman algorithm.
 */
function clipPolygonToHalfPlane(
  polygon: readonly Vector2[],
  normal: Vector2,
  offsetTiles: number,
): Vector2[] {
  if (polygon.length === 0) return [];
  const signedDistance = (point: Vector2): number =>
    point.x * normal.x + point.y * normal.y - offsetTiles;
  const output: Vector2[] = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentDistance = signedDistance(current);
    const nextDistance = signedDistance(next);
    if (currentDistance <= 0) output.push(current);
    if ((currentDistance <= 0) !== (nextDistance <= 0)) {
      const fraction = currentDistance / (currentDistance - nextDistance);
      output.push({
        x: current.x + (next.x - current.x) * fraction,
        y: current.y + (next.y - current.y) * fraction,
      });
    }
  }
  return output;
}

/**
 * The region a body's centre may occupy inside an octagon: the octagon's own
 * half-planes, each moved inward by the body's support along that normal
 * (W: step 38.2). Starts from a square comfortably larger than the octagon
 * and clips it by all eight eroded half-planes in turn.
 */
function erodedOctagonPolygon(
  orientedLocalVerticesTiles: readonly Vector2[],
  octagon: OctagonArena,
): readonly Vector2[] {
  const halfSideTiles = 2 * octagon.cornerSumTiles;
  let polygon: readonly Vector2[] = [
    { x: -halfSideTiles, y: -halfSideTiles },
    { x: halfSideTiles, y: -halfSideTiles },
    { x: halfSideTiles, y: halfSideTiles },
    { x: -halfSideTiles, y: halfSideTiles },
  ];
  for (const plane of octagonHalfPlanes(octagon)) {
    const supportTiles = bodySupport(orientedLocalVerticesTiles, plane.normal);
    polygon = clipPolygonToHalfPlane(
      polygon,
      plane.normal,
      plane.offsetTiles - supportTiles,
    );
    if (polygon.length === 0) break;
  }
  return polygon;
}

function constrainBodyToOctagon(
  orientedLocalVerticesTiles: readonly Vector2[],
  candidatePositionTiles: Vector2,
  octagon: OctagonArena,
): Vector2 {
  assertOctagon(octagon);
  if (
    !convexBodyFitsOctagon(orientedLocalVerticesTiles, {
      ...octagon,
      centerTiles: originTiles,
    })
  ) {
    throw new RangeError(
      "Body must fit at the octagon center before travel",
    );
  }
  const polygon = erodedOctagonPolygon(orientedLocalVerticesTiles, octagon);
  if (polygon.length === 0) {
    throw new RangeError("Octagon contact exceeds representable geometry");
  }
  const offsetTiles = {
    x: candidatePositionTiles.x - octagon.centerTiles.x,
    y: candidatePositionTiles.y - octagon.centerTiles.y,
  };
  const toleranceTiles = Math.max(
    coordinateTolerance([...orientedLocalVerticesTiles, offsetTiles]),
    numericalRoundoffBudget * octagon.cornerSumTiles,
  );
  const inside = octagonHalfPlanes(octagon).every((plane) => {
    const erodedOffsetTiles =
      plane.offsetTiles - bodySupport(orientedLocalVerticesTiles, plane.normal);
    return (
      offsetTiles.x * plane.normal.x + offsetTiles.y * plane.normal.y <=
      erodedOffsetTiles + toleranceTiles
    );
  });
  if (inside) return candidatePositionTiles;
  let nearest = polygon[0];
  let nearestDistanceSquaredTiles = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const closest = closestPointOnSegment(offsetTiles, start, end);
    const deltaX = offsetTiles.x - closest.x;
    const deltaY = offsetTiles.y - closest.y;
    const distanceSquaredTiles = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquaredTiles < nearestDistanceSquaredTiles) {
      nearestDistanceSquaredTiles = distanceSquaredTiles;
      nearest = closest;
    }
  }
  return {
    x: octagon.centerTiles.x + nearest.x,
    y: octagon.centerTiles.y + nearest.y,
  };
}

function unitDirection(direction: Vector2): Vector2 {
  assertFiniteVector(direction);
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length === 0) {
    throw new RangeError("Geometry direction must have finite nonzero length");
  }
  return { x: direction.x / length, y: direction.y / length };
}

export function convexBodyFitsCircle(
  worldVerticesTiles: readonly Vector2[],
  arena: CircularArena,
): boolean {
  validatedAxes(worldVerticesTiles);
  assertCircle(arena);
  const toleranceTiles = Math.max(
    coordinateTolerance([...worldVerticesTiles, arena.centerTiles]),
    numericalRoundoffBudget * arena.radiusTiles,
  );
  return worldVerticesTiles.every(
    (vertex) =>
      Math.hypot(
        vertex.x - arena.centerTiles.x,
        vertex.y - arena.centerTiles.y,
      ) <=
      arena.radiusTiles + toleranceTiles,
  );
}

function closestPointOnSegment(
  point: Vector2,
  segmentStart: Vector2,
  segmentEnd: Vector2,
): Vector2 {
  const edgeX = segmentEnd.x - segmentStart.x;
  const edgeY = segmentEnd.y - segmentStart.y;
  const lengthSquared = edgeX * edgeX + edgeY * edgeY;
  if (lengthSquared === 0) return segmentStart;
  const fraction = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * edgeX + (point.y - segmentStart.y) * edgeY) /
        lengthSquared,
    ),
  );
  return {
    x: segmentStart.x + edgeX * fraction,
    y: segmentStart.y + edgeY * fraction,
  };
}

/**
 * Whether a point lies on the inner side of every edge of a convex polygon.
 * `axes[i]`, as `validatedAxes` derives it, is the *inward* normal of the
 * edge starting at `vertices[i]` for this winding, so the inside test is a
 * nonnegative projection against every edge.
 */
function pointInsideConvexBody(
  point: Vector2,
  verticesTiles: readonly Vector2[],
  axes: readonly Vector2[],
  toleranceTiles: number,
): boolean {
  return verticesTiles.every((vertex, index) => {
    const axis = axes[index];
    const projection =
      (point.x - vertex.x) * axis.x + (point.y - vertex.y) * axis.y;
    return projection >= -toleranceTiles;
  });
}

/**
 * Whether a circle overlaps a convex body - a bomb's detonation radius
 * touching the player, for example - as opposed to `convexBodyFitsCircle`,
 * which asks whether the body is entirely *inside* the circle.
 */
export function convexBodyOverlapsCircle(
  worldVerticesTiles: readonly Vector2[],
  circleCenterTiles: Vector2,
  radiusTiles: number,
): boolean {
  const axes = validatedAxes(worldVerticesTiles);
  assertFiniteVector(circleCenterTiles);
  if (!Number.isFinite(radiusTiles) || radiusTiles <= 0) {
    throw new RangeError("Circle radius must be positive finite tiles");
  }
  const toleranceTiles = Math.max(
    coordinateTolerance([...worldVerticesTiles, circleCenterTiles]),
    numericalRoundoffBudget * radiusTiles,
  );
  if (
    pointInsideConvexBody(circleCenterTiles, worldVerticesTiles, axes, toleranceTiles)
  )
    return true;
  let minimumDistanceSquaredTiles = Infinity;
  for (let index = 0; index < worldVerticesTiles.length; index++) {
    const start = worldVerticesTiles[index];
    const end = worldVerticesTiles[(index + 1) % worldVerticesTiles.length];
    const closest = closestPointOnSegment(circleCenterTiles, start, end);
    const deltaX = circleCenterTiles.x - closest.x;
    const deltaY = circleCenterTiles.y - closest.y;
    minimumDistanceSquaredTiles = Math.min(
      minimumDistanceSquaredTiles,
      deltaX * deltaX + deltaY * deltaY,
    );
  }
  return Math.sqrt(minimumDistanceSquaredTiles) <= radiusTiles + toleranceTiles;
}

export function maximumBodyCenterDistance(
  orientedLocalVerticesTiles: readonly Vector2[],
  direction: Vector2,
  radiusTiles: number,
): number {
  const centeredArena = {
    kind: "circle" as const,
    centerTiles: originTiles,
    radiusTiles,
  };
  if (!convexBodyFitsCircle(orientedLocalVerticesTiles, centeredArena)) {
    throw new RangeError(
      "Body must fit at the circle center before radial travel",
    );
  }
  const normal = unitDirection(direction);
  const distanceTiles = Math.min(
    ...orientedLocalVerticesTiles.map((vertex) => {
      const parallelTiles = vertex.x * normal.x + vertex.y * normal.y;
      const perpendicularTiles = vertex.y * normal.x - vertex.x * normal.y;
      return (
        Math.sqrt(Math.max(0, radiusTiles ** 2 - perpendicularTiles ** 2)) -
        parallelTiles
      );
    }),
  );
  if (!Number.isFinite(distanceTiles)) {
    throw new RangeError("Circle contact exceeds representable geometry");
  }
  return Math.max(0, distanceTiles);
}

/** A point at `radiusTiles` from `center`, at `bearingRadians` (shared by spawn placement). */
export function pointOnRing(
  center: Vector2,
  radiusTiles: number,
  bearingRadians: number,
): Vector2 {
  return {
    x: center.x + Math.cos(bearingRadians) * radiusTiles,
    y: center.y + Math.sin(bearingRadians) * radiusTiles,
  };
}

function constrainBodyToCircle(
  orientedLocalVerticesTiles: readonly Vector2[],
  candidatePositionTiles: Vector2,
  arena: CircularArena,
): Vector2 {
  assertCircle(arena);
  assertFiniteVector(candidatePositionTiles);
  const offsetTiles = {
    x: candidatePositionTiles.x - arena.centerTiles.x,
    y: candidatePositionTiles.y - arena.centerTiles.y,
  };
  const distanceTiles = Math.hypot(offsetTiles.x, offsetTiles.y);
  const direction =
    distanceTiles === 0 ? { x: 1, y: 0 } : unitDirection(offsetTiles);
  const limitTiles = maximumBodyCenterDistance(
    orientedLocalVerticesTiles,
    direction,
    arena.radiusTiles,
  );
  if (distanceTiles <= limitTiles) return candidatePositionTiles;
  return {
    x: arena.centerTiles.x + direction.x * limitTiles,
    y: arena.centerTiles.y + direction.y * limitTiles,
  };
}

/** Clamps a body's centre inside an arena, dispatching on `arena.shape.kind`
 * (W: step 38.2) - nothing else in the simulation learns about shapes. */
export function constrainBodyToArena(
  orientedLocalVerticesTiles: readonly Vector2[],
  candidatePositionTiles: Vector2,
  arena: Arena,
): Vector2 {
  assertFiniteVector(candidatePositionTiles);
  return arena.shape.kind === "circle"
    ? constrainBodyToCircle(
        orientedLocalVerticesTiles,
        candidatePositionTiles,
        arena.shape,
      )
    : constrainBodyToOctagon(
        orientedLocalVerticesTiles,
        candidatePositionTiles,
        arena.shape,
      );
}

export function convexContactDistance(
  firstLocalVerticesTiles: readonly Vector2[],
  secondLocalVerticesTiles: readonly Vector2[],
  directionFromFirstToSecond: Vector2,
): number {
  const axes = [
    ...validatedAxes(firstLocalVerticesTiles),
    ...validatedAxes(secondLocalVerticesTiles),
  ];
  const direction = unitDirection(directionFromFirstToSecond);
  const toleranceTiles = coordinateTolerance([
    ...firstLocalVerticesTiles,
    ...secondLocalVerticesTiles,
  ]);
  let contactDistanceTiles = Number.POSITIVE_INFINITY;
  for (const axis of axes) {
    const first = project(firstLocalVerticesTiles, axis, originTiles);
    const second = project(secondLocalVerticesTiles, axis, originTiles);
    if (
      first.minimum > toleranceTiles ||
      first.maximum < -toleranceTiles ||
      second.minimum > toleranceTiles ||
      second.maximum < -toleranceTiles
    ) {
      throw new RangeError(
        "Contact bodies must contain their local center anchors",
      );
    }
    const alignment = axis.x * direction.x + axis.y * direction.y;
    for (const sign of [-1, 1]) {
      if (alignment * sign <= 0) continue;
      const supportTiles =
        sign === 1
          ? first.maximum - second.minimum
          : second.maximum - first.minimum;
      contactDistanceTiles = Math.min(
        contactDistanceTiles,
        supportTiles / (alignment * sign),
      );
    }
  }
  if (!Number.isFinite(contactDistanceTiles) || contactDistanceTiles < 0) {
    throw new RangeError("Silhouette contact exceeds representable geometry");
  }
  return contactDistanceTiles;
}

export function pursueBody(
  movingLocalVerticesTiles: readonly Vector2[],
  startPositionTiles: Vector2,
  targetLocalVerticesTiles: readonly Vector2[],
  targetPositionTiles: Vector2,
  maximumTravelTiles: number,
): Vector2 {
  validatedAxes(movingLocalVerticesTiles);
  validatedAxes(targetLocalVerticesTiles);
  assertFiniteVector(startPositionTiles);
  assertFiniteVector(targetPositionTiles);
  if (!Number.isFinite(maximumTravelTiles) || maximumTravelTiles < 0) {
    throw new RangeError("Pursuit travel must be nonnegative finite tiles");
  }
  const offsetTiles = {
    x: targetPositionTiles.x - startPositionTiles.x,
    y: targetPositionTiles.y - startPositionTiles.y,
  };
  const distanceTiles = Math.hypot(offsetTiles.x, offsetTiles.y);
  if (distanceTiles === 0) return startPositionTiles;
  const direction = unitDirection(offsetTiles);
  const stopDistanceTiles = convexContactDistance(
    movingLocalVerticesTiles,
    targetLocalVerticesTiles,
    direction,
  );
  const toleranceTiles = Math.max(
    coordinateTolerance([startPositionTiles, targetPositionTiles]),
    numericalRoundoffBudget * stopDistanceTiles,
  );
  if (
    maximumTravelTiles === 0 ||
    distanceTiles <= stopDistanceTiles + toleranceTiles
  )
    return startPositionTiles;
  const travelTiles = Math.min(
    maximumTravelTiles,
    distanceTiles - stopDistanceTiles,
  );
  return {
    x: startPositionTiles.x + direction.x * travelTiles,
    y: startPositionTiles.y + direction.y * travelTiles,
  };
}

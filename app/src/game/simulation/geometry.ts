import { Matrix } from "@flatten-js/core";
import type { CircularArena, Vector2 } from "../models";

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

export function maximumBodyCenterDistance(
  orientedLocalVerticesTiles: readonly Vector2[],
  direction: Vector2,
  radiusTiles: number,
): number {
  const centeredArena = { centerTiles: originTiles, radiusTiles };
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

export function constrainBodyToArena(
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

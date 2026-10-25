import { Matrix } from "@flatten-js/core";
import type { Vector2 } from "../models";

const minimumBodyVertexCount = 3;
const maximumBodyVertexCount = 8;
const numericalRoundoffBudget = 64 * Number.EPSILON;

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

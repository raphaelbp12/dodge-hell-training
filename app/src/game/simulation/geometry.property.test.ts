import fc from "fast-check";
import { expect, test } from "vitest";
import { ENCOUNTER_CONFIGS } from "../config/encounter";
import type { Vector2 } from "../models";
import { propertyParameters } from "../../test/property";
import {
  sweptConvexOverlap,
  sweptConvexPartsOverlap,
  transformBodyParts,
  transformBodyVertices,
  type ConvexPart,
} from "./geometry";

/**
 * Margin for the separation property: bounding boxes this far apart are
 * clearly separated, so the geometry's own roundoff tolerance (64 machine
 * epsilons) can never turn the result into an overlap.
 */
const SEPARATION_MARGIN_TILES = 1e-6;

const configs = Object.values(ENCOUNTER_CONFIGS);
const projectileParts: readonly (readonly ConvexPart[])[] = configs.flatMap(
  (config) =>
    Object.values(config.projectiles).map(
      (projectile) => projectile.collisionPartsTiles,
    ),
);
const playerBodies: readonly (readonly Vector2[])[] = configs.map(
  (config) => config.player.verticesTiles,
);

const coordinate = fc.double({ min: -4, max: 4, noNaN: true });
const vector = fc.record({ x: coordinate, y: coordinate });
const motion = fc.record({
  x: fc.double({ min: -3, max: 3, noNaN: true }),
  y: fc.double({ min: -3, max: 3, noNaN: true }),
});
const angle = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true });
const partsIndex = fc.nat({ max: projectileParts.length - 1 });
const playerIndex = fc.nat({ max: playerBodies.length - 1 });

const scenario = fc.record({
  parts: partsIndex,
  player: playerIndex,
  partsPosition: vector,
  partsAngle: angle,
  playerPosition: vector,
  partsMotion: motion,
  playerMotion: motion,
});

type Scenario = {
  parts: number;
  player: number;
  partsPosition: Vector2;
  partsAngle: number;
  playerPosition: Vector2;
  partsMotion: Vector2;
  playerMotion: Vector2;
};

function bodies(input: Scenario, shift: Vector2 = { x: 0, y: 0 }) {
  const parts = transformBodyParts(
    projectileParts[input.parts],
    { x: input.partsPosition.x + shift.x, y: input.partsPosition.y + shift.y },
    input.partsAngle,
  );
  const player = transformBodyVertices(playerBodies[input.player], {
    x: input.playerPosition.x + shift.x,
    y: input.playerPosition.y + shift.y,
  });
  return { parts, player };
}

test("swapping the bodies and their motions leaves the result unchanged", () => {
  fc.assert(
    fc.property(scenario, (input) => {
      const { parts, player } = bodies(input);
      const forward = sweptConvexPartsOverlap(
        parts,
        input.partsMotion,
        player,
        input.playerMotion,
      );
      const swapped = parts.some((part) =>
        sweptConvexOverlap(player, input.playerMotion, part, input.partsMotion),
      );
      expect(swapped).toBe(forward);
    }),
    propertyParameters(),
  );
});

test("translating both bodies by the same vector leaves the result unchanged", () => {
  fc.assert(
    fc.property(scenario, vector, (input, shift) => {
      const base = bodies(input);
      const moved = bodies(input, shift);
      expect(
        sweptConvexPartsOverlap(
          moved.parts,
          input.partsMotion,
          moved.player,
          input.playerMotion,
        ),
      ).toBe(
        sweptConvexPartsOverlap(
          base.parts,
          input.partsMotion,
          base.player,
          input.playerMotion,
        ),
      );
    }),
    propertyParameters(),
  );
});

test("with zero motion the swept result equals the static overlap of any part", () => {
  const still = { x: 0, y: 0 };
  fc.assert(
    fc.property(scenario, (input) => {
      const { parts, player } = bodies(input);
      expect(sweptConvexPartsOverlap(parts, still, player, still)).toBe(
        parts.some((part) => sweptConvexOverlap(part, still, player, still)),
      );
    }),
    propertyParameters(),
  );
});

function sweptBounds(vertices: readonly Vector2[], displacement: Vector2) {
  const xs = vertices.flatMap((vertex) => [vertex.x, vertex.x + displacement.x]);
  const ys = vertices.flatMap((vertex) => [vertex.y, vertex.y + displacement.y]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

test("bodies whose swept bounding boxes stay separated never overlap", () => {
  fc.assert(
    fc.property(scenario, (input) => {
      const { parts, player } = bodies(input);
      const first = sweptBounds(parts.flat(), input.partsMotion);
      const second = sweptBounds(player, input.playerMotion);
      const separated =
        first.maxX + SEPARATION_MARGIN_TILES < second.minX ||
        second.maxX + SEPARATION_MARGIN_TILES < first.minX ||
        first.maxY + SEPARATION_MARGIN_TILES < second.minY ||
        second.maxY + SEPARATION_MARGIN_TILES < first.minY;
      fc.pre(separated);
      expect(
        sweptConvexPartsOverlap(
          parts,
          input.partsMotion,
          player,
          input.playerMotion,
        ),
      ).toBe(false);
    }),
    propertyParameters({ maxSkipsPerRun: 2000 }),
  );
});

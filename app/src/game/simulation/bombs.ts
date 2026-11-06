import { convexBodyOverlapsCircle, transformBodyVertices } from "./geometry";
import { interpolatePosition } from "./projectiles";
import { bombOf, type BombSpec, type EncounterConfig } from "../config/encounter";
import type { BombState, Vector2 } from "../models";

/** The one field bomb collision needs from SimulationState. */
export type BombCollisionContext = Readonly<{ config: EncounterConfig }>;

/**
 * Where a bomb lands. Untargeted (N24): the spawn point plus the firing
 * direction times its authored range. Targeted (N27): exactly `targetTiles`,
 * captured by value at fire time, at any distance and ignoring `rangeTiles`.
 */
export function resolveBombDestination(
  bomb: BombSpec,
  spawnTiles: Vector2,
  bearingRadians: number,
  targetTiles?: Vector2,
): Vector2 {
  if (targetTiles) return { x: targetTiles.x, y: targetTiles.y };
  return {
    x: spawnTiles.x + Math.cos(bearingRadians) * bomb.rangeTiles,
    y: spawnTiles.y + Math.sin(bearingRadians) * bomb.rangeTiles,
  };
}

/**
 * Builds one bomb fired from `positionTiles` along `orientationRadians`. Its
 * velocity is derived from the destination and travel time (N25); no speed is
 * stored anywhere.
 */
export function createBomb(
  projectile: BombSpec,
  id: number,
  positionTiles: Vector2,
  orientationRadians: number,
  targetTiles?: Vector2,
): BombState {
  const detonationTargetTiles = resolveBombDestination(
    projectile,
    positionTiles,
    orientationRadians,
    targetTiles,
  );
  return {
    id,
    projectileId: projectile.id,
    orientationRadians,
    positionTiles: { ...positionTiles },
    velocityTilesPerSecond: {
      x: (detonationTargetTiles.x - positionTiles.x) / projectile.travelSeconds,
      y: (detonationTargetTiles.y - positionTiles.y) / projectile.travelSeconds,
    },
    ageSeconds: 0,
    lifetimeSeconds: projectile.travelSeconds,
    damageHp: projectile.damageHp,
    hasHitPlayer: false,
    detonationTargetTiles,
  };
}

/**
 * Advances a bomb by one fixed step. A bomb never collides in flight; it hits
 * only by detonating, exactly once, in the step its age reaches
 * `lifetimeSeconds` (N22). The age is snapped onto that boundary when it lands
 * within rounding of it, so the comparison is exact rather than approximate.
 * `detonated` reports the explosion even when it misses the player.
 */
export function advanceBomb(
  context: BombCollisionContext,
  bomb: BombState,
  elapsedSeconds: number,
  playerStart: Vector2,
  playerEnd: Vector2,
): { alive: boolean; hitPlayer: boolean; detonated: boolean } {
  const boundaryToleranceSeconds = bomb.lifetimeSeconds * Number.EPSILON * 16;
  let targetAgeSeconds = Math.min(
    bomb.ageSeconds + elapsedSeconds,
    bomb.lifetimeSeconds,
  );
  if (
    Math.abs(targetAgeSeconds - bomb.lifetimeSeconds) <= boundaryToleranceSeconds
  )
    targetAgeSeconds = bomb.lifetimeSeconds;
  const segmentSeconds = targetAgeSeconds - bomb.ageSeconds;
  const segmentPlayerEnd = interpolatePosition(
    playerStart,
    playerEnd,
    segmentSeconds / elapsedSeconds,
  );
  bomb.positionTiles = {
    x: bomb.positionTiles.x + bomb.velocityTilesPerSecond.x * segmentSeconds,
    y: bomb.positionTiles.y + bomb.velocityTilesPerSecond.y * segmentSeconds,
  };
  const detonating = bomb.ageSeconds + segmentSeconds >= bomb.lifetimeSeconds;
  bomb.ageSeconds = targetAgeSeconds;
  const projectile = bombOf(context.config, bomb.projectileId);
  const hitPlayer =
    detonating &&
    !bomb.hasHitPlayer &&
    convexBodyOverlapsCircle(
      transformBodyVertices(context.config.player.verticesTiles, segmentPlayerEnd),
      bomb.detonationTargetTiles,
      projectile.detonationRadiusTiles,
    );
  return {
    alive: bomb.ageSeconds < bomb.lifetimeSeconds,
    hitPlayer,
    detonated: bomb.ageSeconds >= bomb.lifetimeSeconds,
  };
}

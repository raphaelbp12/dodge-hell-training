import {
  sweptConvexPartsOverlap,
  transformBodyParts,
  transformBodyVertices,
} from "./geometry";
import { bulletOf, projectileOf, type BulletSpec, type EncounterConfig } from "../config/encounter";
import type { ShardState, Vector2 } from "../models";

/** The two fields shard motion and collision need from SimulationState. */
export type ShardCollisionContext = Readonly<{
  config: EncounterConfig;
  collisionBoundingRadiusTiles: number;
}>;

/**
 * Resolves a shard's lifetime and reversal age from its projectile's motion
 * kind. `linear`'s range is published speed times lifetime (ROTMG's rule for
 * every straight-line projectile), so its lifetime derives from the range
 * rather than being authored a second time; its reversal age is set to
 * `Infinity` so the existing reversal branch in `advanceShard` can never fire,
 * which keeps `linear` on the same code path as `boomerang` with no second
 * branch to maintain.
 */
export function resolveShardLifetime(
  projectile: BulletSpec,
): { lifetimeSeconds: number; reversalAgeSeconds: number } {
  const { motion } = projectile;
  if (motion.kind === "boomerang") {
    return {
      lifetimeSeconds: motion.lifetimeSeconds,
      reversalAgeSeconds: motion.reversalAgeSeconds,
    };
  }
  return {
    lifetimeSeconds: motion.rangeTiles / projectile.speedTilesPerSecond,
    reversalAgeSeconds: Infinity,
  };
}

/**
 * Closed-form position of a `turning` or `wavy` shard at age `t`, evaluated
 * directly from its spawn pose rather than integrated incrementally - an
 * incremental integral's error would depend on how many fixed steps a single
 * update executed, which would break determinism (K11). The collision test
 * sweeps a straight chord between the exact positions at a step's start and
 * end ages, which is why this is the only place either path is evaluated.
 */
export type CurvedProjectileMotion = Extract<
  BulletSpec["motion"],
  { kind: "turning" | "wavy" }
>;

export function curvedShardPositionAtAge(
  motion: CurvedProjectileMotion,
  speedTilesPerSecond: number,
  spawnPositionTiles: Vector2,
  spawnOrientationRadians: number,
  ageSeconds: number,
): Vector2 {
  if (motion.kind === "turning") {
    const turnRateRadiansPerSecond =
      (motion.turnRateDegreesPerSecond * Math.PI) / 180;
    const headingRadians =
      spawnOrientationRadians + turnRateRadiansPerSecond * ageSeconds;
    const radiusTiles = speedTilesPerSecond / turnRateRadiansPerSecond;
    return {
      x:
        spawnPositionTiles.x +
        radiusTiles * (Math.sin(headingRadians) - Math.sin(spawnOrientationRadians)),
      y:
        spawnPositionTiles.y -
        radiusTiles * (Math.cos(headingRadians) - Math.cos(spawnOrientationRadians)),
    };
  }
  const angularFrequency = 2 * Math.PI * motion.frequencyHz;
  const lateralOffsetTiles =
    motion.amplitudeTiles * Math.sin(angularFrequency * ageSeconds);
  const forwardTiles = speedTilesPerSecond * ageSeconds;
  const forwardX = Math.cos(spawnOrientationRadians);
  const forwardY = Math.sin(spawnOrientationRadians);
  // Perpendicular to the spawn heading, rotated +90 degrees.
  const lateralX = -forwardY;
  const lateralY = forwardX;
  return {
    x: spawnPositionTiles.x + forwardTiles * forwardX + lateralOffsetTiles * lateralX,
    y: spawnPositionTiles.y + forwardTiles * forwardY + lateralOffsetTiles * lateralY,
  };
}

/** Heading a `turning` or `wavy` shard's body should face at age `t`. */
export function curvedShardOrientationAtAge(
  motion: CurvedProjectileMotion,
  speedTilesPerSecond: number,
  spawnOrientationRadians: number,
  ageSeconds: number,
): number {
  if (motion.kind === "turning") {
    const turnRateRadiansPerSecond =
      (motion.turnRateDegreesPerSecond * Math.PI) / 180;
    return spawnOrientationRadians + turnRateRadiansPerSecond * ageSeconds;
  }
  const angularFrequency = 2 * Math.PI * motion.frequencyHz;
  const forwardX = Math.cos(spawnOrientationRadians);
  const forwardY = Math.sin(spawnOrientationRadians);
  const lateralX = -forwardY;
  const lateralY = forwardX;
  const lateralVelocity =
    motion.amplitudeTiles * angularFrequency * Math.cos(angularFrequency * ageSeconds);
  return Math.atan2(
    speedTilesPerSecond * forwardY + lateralVelocity * lateralY,
    speedTilesPerSecond * forwardX + lateralVelocity * lateralX,
  );
}

function isCurvedMotion(
  motion: BulletSpec["motion"],
): motion is Extract<BulletSpec["motion"], { kind: "turning" | "wavy" }> {
  return motion.kind === "turning" || motion.kind === "wavy";
}

/** Builds one shard fired from `positionTiles` along `orientationRadians`. */
export function createShard(
  projectile: BulletSpec,
  id: number,
  positionTiles: Vector2,
  orientationRadians: number,
): ShardState {
  const { lifetimeSeconds, reversalAgeSeconds } =
    resolveShardLifetime(projectile);
  const velocityTilesPerSecond = {
    x: Math.cos(orientationRadians) * projectile.speedTilesPerSecond,
    y: Math.sin(orientationRadians) * projectile.speedTilesPerSecond,
  };
  return {
    id,
    projectileId: projectile.id,
    orientationRadians,
    positionTiles: { ...positionTiles },
    velocityTilesPerSecond,
    ageSeconds: 0,
    damageHp: projectile.damageHp,
    reversalAgeSeconds,
    lifetimeSeconds,
    hasReversed: false,
    hasHitPlayer: false,
    spawnPositionTiles: { ...positionTiles },
    spawnOrientationRadians: orientationRadians,
  };
}

/**
 * Re-applies a weapon's fired-with values to shards already in flight and drops
 * any that the new lifetime has already expired.
 *
 * Damage, reversal age and lifetime are one category - values a shard was fired
 * with - so one rule governs all three (G09). This is the single write site for
 * that category outside shard creation, which is why it is a named operation
 * here rather than inline in the debug setter.
 */
export function restampLiveShards(
  shards: readonly ShardState[],
  projectile: BulletSpec,
): ShardState[] {
  const { lifetimeSeconds, reversalAgeSeconds } =
    resolveShardLifetime(projectile);
  return shards.filter((shard) => {
    shard.damageHp = projectile.damageHp;
    shard.reversalAgeSeconds = reversalAgeSeconds;
    shard.lifetimeSeconds = lifetimeSeconds;
    if (shard.ageSeconds >= shard.reversalAgeSeconds) shard.hasReversed = true;
    const speed =
      projectile.speedTilesPerSecond * (shard.hasReversed ? -1 : 1);
    shard.velocityTilesPerSecond = {
      x: Math.cos(shard.orientationRadians) * speed,
      y: Math.sin(shard.orientationRadians) * speed,
    };
    return shard.ageSeconds < shard.lifetimeSeconds;
  });
}

export function shardOverlapsPlayer(
  context: ShardCollisionContext,
  shardStart: Vector2,
  shardEnd: Vector2,
  playerStart: Vector2,
  playerEnd: Vector2,
  shard: ShardState,
): boolean {
  const relativeStart = {
    x: shardStart.x - playerStart.x,
    y: shardStart.y - playerStart.y,
  };
  const relativeEnd = {
    x: shardEnd.x - playerEnd.x,
    y: shardEnd.y - playerEnd.y,
  };
  const bound =
    context.collisionBoundingRadiusTiles +
    Number.EPSILON *
      64 *
      Math.max(
        1,
        Math.abs(shardStart.x),
        Math.abs(shardStart.y),
        Math.abs(playerStart.x),
        Math.abs(playerStart.y),
      );
  if (
    Math.min(relativeStart.x, relativeEnd.x) > bound ||
    Math.max(relativeStart.x, relativeEnd.x) < -bound ||
    Math.min(relativeStart.y, relativeEnd.y) > bound ||
    Math.max(relativeStart.y, relativeEnd.y) < -bound
  )
    return false;
  const projectile = projectileOf(context.config, shard.projectileId);
  return sweptConvexPartsOverlap(
    transformBodyParts(
      projectile.collisionPartsTiles,
      shardStart,
      shard.orientationRadians,
    ),
    { x: shardEnd.x - shardStart.x, y: shardEnd.y - shardStart.y },
    transformBodyVertices(context.config.player.verticesTiles, playerStart),
    { x: playerEnd.x - playerStart.x, y: playerEnd.y - playerStart.y },
  );
}

export function interpolatePosition(
  start: Vector2,
  end: Vector2,
  fraction: number,
): Vector2 {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function moveShard(
  context: ShardCollisionContext,
  shard: ShardState,
  elapsedSeconds: number,
  playerStart: Vector2,
  playerEnd: Vector2,
): boolean {
  const projectile = bulletOf(context.config, shard.projectileId);
  const shardStart = shard.positionTiles;
  if (isCurvedMotion(projectile.motion)) {
    const ageAtSegmentEndSeconds = shard.ageSeconds + elapsedSeconds;
    shard.positionTiles = curvedShardPositionAtAge(
      projectile.motion,
      projectile.speedTilesPerSecond,
      shard.spawnPositionTiles,
      shard.spawnOrientationRadians,
      ageAtSegmentEndSeconds,
    );
    shard.orientationRadians = curvedShardOrientationAtAge(
      projectile.motion,
      projectile.speedTilesPerSecond,
      shard.spawnOrientationRadians,
      ageAtSegmentEndSeconds,
    );
  } else {
    shard.positionTiles = {
      x: shard.positionTiles.x + shard.velocityTilesPerSecond.x * elapsedSeconds,
      y: shard.positionTiles.y + shard.velocityTilesPerSecond.y * elapsedSeconds,
    };
  }
  return (
    !shard.hasHitPlayer &&
    shardOverlapsPlayer(
      context,
      shardStart,
      shard.positionTiles,
      playerStart,
      playerEnd,
      shard,
    )
  );
}

export function advanceShard(
  context: ShardCollisionContext,
  shard: ShardState,
  elapsedSeconds: number,
  playerStart: Vector2,
  playerEnd: Vector2,
): { alive: boolean; hitPlayer: boolean } {
  const initialAgeSeconds = shard.ageSeconds;
  let hitPlayer = false;
  let segmentPlayerStart = playerStart;
  function moveSegment(segmentSeconds: number): void {
    const endFraction =
      (shard.ageSeconds - initialAgeSeconds + segmentSeconds) / elapsedSeconds;
    const segmentPlayerEnd = interpolatePosition(
      playerStart,
      playerEnd,
      endFraction,
    );
    const segmentHit = moveShard(
      context,
      shard,
      segmentSeconds,
      segmentPlayerStart,
      segmentPlayerEnd,
    );
    hitPlayer = hitPlayer || segmentHit;
    segmentPlayerStart = segmentPlayerEnd;
  }
  const boundaryToleranceSeconds = shard.lifetimeSeconds * Number.EPSILON * 16;
  let targetAgeSeconds = Math.min(
    shard.ageSeconds + elapsedSeconds,
    shard.lifetimeSeconds,
  );
  for (const boundarySeconds of [
    shard.reversalAgeSeconds,
    shard.lifetimeSeconds,
  ]) {
    if (
      Math.abs(targetAgeSeconds - boundarySeconds) <= boundaryToleranceSeconds
    )
      targetAgeSeconds = boundarySeconds;
  }
  if (!shard.hasReversed && targetAgeSeconds >= shard.reversalAgeSeconds) {
    moveSegment(shard.reversalAgeSeconds - shard.ageSeconds);
    shard.ageSeconds = shard.reversalAgeSeconds;
    shard.velocityTilesPerSecond = {
      x: -shard.velocityTilesPerSecond.x,
      y: -shard.velocityTilesPerSecond.y,
    };
    shard.hasReversed = true;
  }
  moveSegment(targetAgeSeconds - shard.ageSeconds);
  shard.ageSeconds = targetAgeSeconds;
  return {
    alive: shard.ageSeconds < shard.lifetimeSeconds,
    hitPlayer,
  };
}

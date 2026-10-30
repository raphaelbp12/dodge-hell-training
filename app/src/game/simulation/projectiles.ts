import {
  convexBodyOverlapsCircle,
  sweptConvexPartsOverlap,
  transformBodyParts,
  transformBodyVertices,
} from "./geometry";
import { projectileOf, type EncounterConfig, type ProjectileSpec } from "../config/encounter";
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
function resolveShardLifetime(
  projectile: ProjectileSpec,
): { lifetimeSeconds: number; reversalAgeSeconds: number } {
  const { motion } = projectile;
  if (motion.kind === "boomerang") {
    return {
      lifetimeSeconds: motion.lifetimeSeconds,
      reversalAgeSeconds: motion.reversalAgeSeconds,
    };
  }
  if (motion.kind === "lob") {
    return { lifetimeSeconds: motion.travelSeconds, reversalAgeSeconds: Infinity };
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
type CurvedProjectileMotion = Extract<
  ProjectileSpec["motion"],
  { kind: "turning" | "wavy" }
>;

function curvedShardPositionAtAge(
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
function curvedShardOrientationAtAge(
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
  motion: ProjectileSpec["motion"],
): motion is Extract<ProjectileSpec["motion"], { kind: "turning" | "wavy" }> {
  return motion.kind === "turning" || motion.kind === "wavy";
}

/**
 * Resolves where a `lob` shard will land. Aimed at the player, the
 * destination is the player's position at fire time, clamped to the maximum
 * distance the shard can cover in its travel time; otherwise it is the
 * emitter point plus the firing direction times that same maximum distance.
 */
function resolveLobDestination(
  projectile: ProjectileSpec,
  travelSeconds: number,
  positionTiles: Vector2,
  orientationRadians: number,
  aimPlayerPositionTiles: Vector2 | undefined,
): Vector2 {
  const maximumDistanceTiles = projectile.speedTilesPerSecond * travelSeconds;
  if (!aimPlayerPositionTiles) {
    return {
      x: positionTiles.x + Math.cos(orientationRadians) * maximumDistanceTiles,
      y: positionTiles.y + Math.sin(orientationRadians) * maximumDistanceTiles,
    };
  }
  const deltaX = aimPlayerPositionTiles.x - positionTiles.x;
  const deltaY = aimPlayerPositionTiles.y - positionTiles.y;
  const distanceTiles = Math.hypot(deltaX, deltaY);
  const clampFraction =
    distanceTiles > maximumDistanceTiles && distanceTiles > 0
      ? maximumDistanceTiles / distanceTiles
      : 1;
  return {
    x: positionTiles.x + deltaX * clampFraction,
    y: positionTiles.y + deltaY * clampFraction,
  };
}

/**
 * Builds one shard fired from `positionTiles` along `orientationRadians`.
 * `aimPlayerPositionTiles`, when given, is only read for the `lob` kind's
 * player-aimed destination case; every other kind ignores it.
 */
export function createShard(
  projectile: ProjectileSpec,
  id: number,
  positionTiles: Vector2,
  orientationRadians: number,
  aimPlayerPositionTiles?: Vector2,
): ShardState {
  const { lifetimeSeconds, reversalAgeSeconds } =
    resolveShardLifetime(projectile);
  let velocityTilesPerSecond = {
    x: Math.cos(orientationRadians) * projectile.speedTilesPerSecond,
    y: Math.sin(orientationRadians) * projectile.speedTilesPerSecond,
  };
  let detonationTargetTiles: Vector2 | null = null;
  if (projectile.motion.kind === "lob") {
    const target = resolveLobDestination(
      projectile,
      lifetimeSeconds,
      positionTiles,
      orientationRadians,
      aimPlayerPositionTiles,
    );
    detonationTargetTiles = target;
    velocityTilesPerSecond = {
      x: (target.x - positionTiles.x) / lifetimeSeconds,
      y: (target.y - positionTiles.y) / lifetimeSeconds,
    };
  }
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
    detonationTargetTiles,
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
  projectile: ProjectileSpec,
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

function interpolatePosition(
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
  const projectile = projectileOf(context.config, shard.projectileId);
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
  if (projectile.motion.kind === "lob") {
    // A lob shard never collides in flight; it only ever hits by detonating,
    // which happens exactly once, in the same fixed step its age reaches
    // `lifetimeSeconds` (travelSeconds) - the boundary snapping in
    // `advanceShard` guarantees this comparison is exact, not approximate.
    const isDetonating = shard.ageSeconds + elapsedSeconds >= shard.lifetimeSeconds;
    if (!isDetonating || !shard.detonationTargetTiles) return false;
    return (
      !shard.hasHitPlayer &&
      convexBodyOverlapsCircle(
        transformBodyVertices(context.config.player.verticesTiles, playerEnd),
        shard.detonationTargetTiles,
        projectile.motion.detonationRadiusTiles,
      )
    );
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
): { alive: boolean; hitPlayer: boolean; detonated: boolean } {
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
  const projectile = projectileOf(context.config, shard.projectileId);
  return {
    alive: shard.ageSeconds < shard.lifetimeSeconds,
    hitPlayer,
    detonated:
      projectile.motion.kind === "lob" &&
      shard.ageSeconds >= shard.lifetimeSeconds &&
      shard.detonationTargetTiles !== null,
  };
}

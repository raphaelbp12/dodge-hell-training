import {
  primaryArchetype,
  type ArmPattern,
  type AttackPattern,
  type EncounterConfig,
  type ProjectileAppearanceSpec,
  type ProjectileSpec,
} from "../game/config/encounter";
import type { ArenaShape, Vector2 } from "../game/models";
import { resolveBombDestination } from "../game/simulation/bombs";
import {
  curvedShardOrientationAtAge,
  curvedShardPositionAtAge,
  resolveShardLifetime,
} from "../game/simulation/projectiles";

export type PreviewProjectile = Readonly<{
  /** The index of the drawn track in the study, for the highlight (step 86.4). */
  tagIndex: number;
  appearance: ProjectileAppearanceSpec;
  positionTiles: Vector2;
  orientationRadians: number;
}>;

export type PreviewDetonation = Readonly<{
  tagIndex: number;
  positionTiles: Vector2;
  radiusTiles: number;
}>;

export type PreviewFrame = Readonly<{
  timeSeconds: number;
  arena: ArenaShape;
  emitterTiles: Vector2;
  playerTiles: Vector2;
  /** N20: the enemy-rotation slider, in radians; shown as an arrow on the emitter. */
  headingRadians: number;
  projectiles: readonly PreviewProjectile[];
  detonations: readonly PreviewDetonation[];
}>;

/**
 * Where the primary enemy stands at the start of a fight: the arena centre
 * under the `arena-center` spawn rule, as `resolveSpawnPosition` places it,
 * otherwise the archetype's authored spawn. The archetype's `spawnTiles` alone
 * can lie outside the arena (Killer Bee Queen), which hid every projectile.
 */
export function emitterTilesOf(config: EncounterConfig): Vector2 {
  return config.spawns.placement.rule === "arena-center"
    ? config.arena.shape.centerTiles
    : primaryArchetype(config).spawnTiles;
}

/**
 * N20: where the heading slider starts: the primary archetype's
 * `initialHeadingDegrees`, or 0, normalised into the slider's 0-360 range.
 */
export function initialHeadingSliderDegrees(config: EncounterConfig): number {
  const degrees = primaryArchetype(config).initialHeadingDegrees ?? 0;
  return ((degrees % 360) + 360) % 360;
}

type PoseAtAge = Readonly<{
  positionTiles: Vector2;
  orientationRadians: number;
}> | null;

export function poseAtAge(
  projectile: ProjectileSpec,
  spawnTiles: Vector2,
  bearingRadians: number,
  ageSeconds: number,
  targetTiles?: Vector2,
): PoseAtAge {
  if (projectile.type === "bomb") {
    if (ageSeconds < 0 || ageSeconds >= projectile.travelSeconds) return null;
    const target = resolveBombDestination(
      projectile,
      spawnTiles,
      bearingRadians,
      targetTiles,
    );
    const fraction = ageSeconds / projectile.travelSeconds;
    return {
      positionTiles: {
        x: spawnTiles.x + (target.x - spawnTiles.x) * fraction,
        y: spawnTiles.y + (target.y - spawnTiles.y) * fraction,
      },
      orientationRadians: bearingRadians,
    };
  }
  const { lifetimeSeconds, reversalAgeSeconds } =
    resolveShardLifetime(projectile);
  if (ageSeconds < 0 || ageSeconds >= lifetimeSeconds) return null;
  const { motion, speedTilesPerSecond: speed } = projectile;
  if (motion.kind === "turning" || motion.kind === "wavy")
    return {
      positionTiles: curvedShardPositionAtAge(
        motion,
        speed,
        spawnTiles,
        bearingRadians,
        ageSeconds,
      ),
      orientationRadians: curvedShardOrientationAtAge(
        motion,
        speed,
        bearingRadians,
        ageSeconds,
      ),
    };
  const travelledTiles =
    speed *
    (ageSeconds < reversalAgeSeconds
      ? ageSeconds
      : 2 * reversalAgeSeconds - ageSeconds);
  return {
    positionTiles: {
      x: spawnTiles.x + Math.cos(bearingRadians) * travelledTiles,
      y: spawnTiles.y + Math.sin(bearingRadians) * travelledTiles,
    },
    orientationRadians: bearingRadians,
  };
}

/** `count` evenly spaced values in (0, 1), standing in for a seeded scatter draw (M09). */
function evenDraws(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 0.5) / count);
}

function armEvenDraws(armPattern: ArmPattern | undefined): number[] {
  if (!armPattern) return [];
  if (armPattern.kind === "scatter") return evenDraws(armPattern.shots);
  if (armPattern.kind === "ring")
    return Array.from({ length: armPattern.arms }, () =>
      armEvenDraws(armPattern.armPattern),
    ).flat();
  return [];
}

/**
 * Even stand-ins for every scatter draw a volley of `pattern` takes, one run
 * per scatter instance in depth-first arm order, matching `scatterDrawCount`.
 */
export function evenDrawsFor(pattern: AttackPattern): number[] | undefined {
  const draws =
    pattern.kind === "scatter"
      ? evenDraws(pattern.shots)
      : pattern.kind === "ring"
        ? Array.from({ length: pattern.arms }, () =>
            armEvenDraws(pattern.armPattern),
          ).flat()
        : [];
  return draws.length > 0 ? draws : undefined;
}

/** How long after firing a projectile can still be drawn: in flight, or exploding. */
export function drawnLifetimeSeconds(projectile: ProjectileSpec, explosionSeconds: number): number {
  return projectile.type === "bomb"
    ? projectile.travelSeconds + explosionSeconds
    : resolveShardLifetime(projectile).lifetimeSeconds;
}

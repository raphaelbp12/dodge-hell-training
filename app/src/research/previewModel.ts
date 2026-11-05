import {
  primaryArchetype,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type ProjectileAppearanceSpec,
  type ProjectileSpec,
} from "../game/config/encounter";
import type { ArenaShape, Vector2 } from "../game/models";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import { resolveBearings } from "../game/simulation/patterns";
import {
  curvedShardOrientationAtAge,
  curvedShardPositionAtAge,
  resolveLobDestination,
  resolveShardLifetime,
} from "../game/simulation/projectiles";
import type { Tag, TagPattern } from "./tagging";

/** M03/M05/M06: the matched attack plus the pattern the preview resolves. */
export type PreviewMatch = Readonly<{
  attack: AttackSpec;
  projectile: ProjectileSpec;
  /** The authored pattern with arms or shots replaced by the tag's shots. */
  pattern: AttackPattern;
}>;

export type PreviewProjectile = Readonly<{
  /** Index into the study's tag array, for the M31 highlight. */
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
  projectiles: readonly PreviewProjectile[];
  detonations: readonly PreviewDetonation[];
  /** M04: study tags with no match, independent of time. */
  unmatchedTagCount: number;
}>;

const FAMILY_BY_TAG_PATTERN: Readonly<
  Record<TagPattern, AttackPattern["kind"] | null>
> = {
  "rotating-arm": "ring",
  "fixed-ring": "ring",
  spread: "spread",
  scatter: "scatter",
  volley: null,
};

function withShots(pattern: AttackPattern, shots: number): AttackPattern {
  return pattern.kind === "ring"
    ? { ...pattern, arms: shots }
    : { ...pattern, shots };
}

/**
 * Finds the first authored attack of the tag's top-level phase (sub-phase
 * attacks included, in authored order) that fires the tag's sprite in the
 * tag's pattern family (M03, M04).
 */
export function matchTagAttack(
  tag: Tag,
  config: EncounterConfig,
): PreviewMatch | null {
  const family = FAMILY_BY_TAG_PATTERN[tag.pattern];
  const phase = primaryArchetype(config).phases[tag.phaseIndex];
  if (!family || !phase) return null;
  const attacks = [
    ...phase.attacks,
    ...(phase.subPhases ?? []).flatMap((subPhase) => subPhase.attacks),
  ];
  for (const attack of attacks) {
    const projectile = config.projectiles[attack.projectileId];
    if (
      projectile?.appearance?.id === tag.spriteId &&
      attack.pattern.kind === family
    )
      return {
        attack,
        projectile,
        pattern: withShots(attack.pattern, tag.shots),
      };
  }
  return null;
}

export function countUnmatchedTags(
  tags: readonly Tag[],
  config: EncounterConfig,
): number {
  return tags.filter((tag) => matchTagAttack(tag, config) === null).length;
}

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

type PoseAtAge = Readonly<{
  positionTiles: Vector2;
  orientationRadians: number;
}> | null;

function poseAtAge(
  projectile: ProjectileSpec,
  spawnTiles: Vector2,
  bearingRadians: number,
  ageSeconds: number,
): PoseAtAge {
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
  if (motion.kind === "lob") {
    const target = resolveLobDestination(
      projectile,
      lifetimeSeconds,
      spawnTiles,
      bearingRadians,
      undefined,
    );
    const fraction = ageSeconds / lifetimeSeconds;
    return {
      positionTiles: {
        x: spawnTiles.x + (target.x - spawnTiles.x) * fraction,
        y: spawnTiles.y + (target.y - spawnTiles.y) * fraction,
      },
      orientationRadians: bearingRadians,
    };
  }
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

/**
 * Every live tagged projectile and detonation at `timeSeconds`, computed
 * from each tag's age alone (M01). A pure function of its inputs: no clock,
 * no state between calls.
 */
export function previewAt(input: {
  tags: readonly Tag[];
  timeSeconds: number;
  config: EncounterConfig;
  playerTiles: Vector2;
}): PreviewFrame {
  const { tags, timeSeconds, config, playerTiles } = input;
  const emitterTiles = emitterTilesOf(config);
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  tags.forEach((tag, tagIndex) => {
    if (tag.timeSeconds > timeSeconds) return;
    const match = matchTagAttack(tag, config);
    if (!match) return;
    const { projectile, pattern } = match;
    const bearings = resolveBearings(pattern, {
      enemyPositionTiles: emitterTiles,
      playerPositionTiles: playerTiles,
      ringPhaseRadians:
        pattern.kind === "ring" ? pattern.initialPhaseRadians : 0,
      volleyIndexInBurst: 0,
      burstsFired: 0,
      secondsSinceEpoch: 0,
      drawnUnitRandoms:
        pattern.kind === "scatter"
          ? Array.from(
              { length: pattern.shots },
              (_, shot) => (shot + 0.5) / pattern.shots,
            )
          : undefined,
    });
    const ageSeconds = timeSeconds - tag.timeSeconds;
    for (const bearing of bearings) {
      const spawnTiles = {
        x: emitterTiles.x + Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
        y: emitterTiles.y + Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
      };
      const appearance = projectile.appearance;
      if (!appearance) continue;
      const pose = poseAtAge(projectile, spawnTiles, bearing.bearingRadians, ageSeconds);
      if (pose) {
        projectiles.push({ tagIndex, appearance, ...pose });
        continue;
      }
      if (projectile.motion.kind !== "lob" || !appearance.bomb) continue;
      const { travelSeconds, detonationRadiusTiles } = projectile.motion;
      const sinceLandingSeconds = ageSeconds - travelSeconds;
      if (
        sinceLandingSeconds >= 0 &&
        sinceLandingSeconds <
          appearance.bomb.frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS
      )
        detonations.push({
          tagIndex,
          positionTiles: resolveLobDestination(
            projectile,
            travelSeconds,
            spawnTiles,
            bearing.bearingRadians,
            undefined,
          ),
          radiusTiles: detonationRadiusTiles,
        });
    }
  });
  return {
    timeSeconds,
    arena: config.arena.shape,
    emitterTiles,
    playerTiles,
    projectiles,
    detonations,
    unmatchedTagCount: countUnmatchedTags(tags, config),
  };
}

/** M31: every tag in the selected tag's burst, or just the selected tag. */
export function highlightedTagIndices(
  tags: readonly Tag[],
  selectedIndex: number | null,
): readonly number[] {
  const selected = selectedIndex === null ? undefined : tags[selectedIndex];
  if (selectedIndex === null || !selected) return [];
  if (selected.burstId === undefined) return [selectedIndex];
  return tags.flatMap((tag, index) =>
    tag.burstId === selected.burstId ? [index] : [],
  );
}

/** M32: keeps the selection naming the same tag after `deletedIndex` is removed. */
export function selectionAfterDelete(
  selectedIndex: number | null,
  deletedIndex: number,
): number | null {
  if (selectedIndex === null || selectedIndex === deletedIndex) return null;
  return selectedIndex > deletedIndex ? selectedIndex - 1 : selectedIndex;
}

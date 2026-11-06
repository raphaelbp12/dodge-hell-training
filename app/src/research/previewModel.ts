import {
  degreesToRadians,
  primaryArchetype,
  type ArmPattern,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type ProjectileAppearanceSpec,
  type ProjectileSpec,
} from "../game/config/encounter";
import type { ArenaShape, Vector2 } from "../game/models";
import { BOMB_EXPLOSION_FRAME_SECONDS } from "../game/phaser/appearance-pixels";
import { resolveBombDestination } from "../game/simulation/bombs";
import { resolveBearings } from "../game/simulation/patterns";
import {
  curvedShardOrientationAtAge,
  curvedShardPositionAtAge,
  resolveShardLifetime,
} from "../game/simulation/projectiles";
import { groupKey, type Tag, type TagPattern } from "./tagging";

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
  /** N20: the enemy-rotation slider, in radians; shown as an arrow on the emitter. */
  headingRadians: number;
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

/** The arm pattern a tag describes; absent means a single shot, even on an authored composite. */
function armPatternOfTag(tag: Tag): ArmPattern | undefined {
  const { armPattern, shotsPerArm = 1, armArcDegrees = 0 } = tag;
  if (armPattern === "spread")
    return { kind: "spread", shots: shotsPerArm, arcDegrees: armArcDegrees };
  if (armPattern === "scatter")
    return { kind: "scatter", shots: shotsPerArm, coneDegrees: armArcDegrees };
  if (armPattern === "ring") return { kind: "ring", arms: shotsPerArm };
  return undefined;
}

/**
 * The pattern the preview draws: the matched attack's pattern with the tag's
 * own geometry laid over it (M05, N36-N39). The tag wins wherever it says
 * something; the attack only supplies what the tag cannot (the projectile's
 * motion, cadence-independent fields, and untyped rotation values).
 *
 * - Rings: `arms` is the tag's shots; the arm pattern comes from the tag
 *   alone; `rotating-arm` takes the tag's typed rate and phase where present
 *   and the authored ones otherwise; `fixed-ring` has rate 0.
 * - Spread and scatter: `shots` is the tag's. A tag's `player` or `front`
 *   replaces the authored aim (front keeps the authored offset, else 0); a
 *   tag's `fixed` changes nothing.
 */
export function withTagGeometry(pattern: AttackPattern, tag: Tag): AttackPattern {
  if (pattern.kind === "ring") {
    const { armPattern: _authoredArms, ...ring } = pattern;
    const armPattern = armPatternOfTag(tag);
    const rotating = tag.pattern === "rotating-arm";
    return {
      ...ring,
      arms: tag.shots,
      clockwiseDegreesPerSecond: rotating
        ? (tag.clockwiseDegreesPerSecond ?? pattern.clockwiseDegreesPerSecond)
        : 0,
      initialPhaseRadians:
        rotating && tag.initialPhaseDegrees !== undefined
          ? degreesToRadians(tag.initialPhaseDegrees)
          : pattern.initialPhaseRadians,
      ...(armPattern ? { armPattern } : {}),
    };
  }
  const withCount = { ...pattern, shots: tag.shots };
  if (tag.aim === "player") {
    const { aim: _aim, ...rest } = withCount;
    const { fixedBearingDegrees: _bearing, offsetDegrees: _offset, ...bare } =
      rest as typeof rest & { fixedBearingDegrees?: number; offsetDegrees?: number };
    return { ...bare, aim: "player" } as AttackPattern;
  }
  if (tag.aim === "front") {
    const { aim: _aim, ...rest } = withCount;
    const { fixedBearingDegrees: _bearing, ...bare } = rest as typeof rest & {
      fixedBearingDegrees?: number;
    };
    return {
      ...bare,
      aim: "front",
      offsetDegrees: pattern.aim === "front" ? pattern.offsetDegrees : 0,
    } as AttackPattern;
  }
  return withCount;
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
        pattern: withTagGeometry(attack.pattern, tag),
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

function poseAtAge(
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
function evenDrawsFor(pattern: AttackPattern): number[] | undefined {
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

/** N37: the earliest tag time of each grouping-key group, computed once per frame. */
function firstTimeByGroup(tags: readonly Tag[]): Map<string, number> {
  const first = new Map<string, number>();
  for (const entry of tags) {
    const key = groupKey(entry);
    const seen = first.get(key);
    if (seen === undefined || entry.timeSeconds < seen)
      first.set(key, entry.timeSeconds);
  }
  return first;
}

/**
 * Every live tagged projectile and detonation at `timeSeconds`, computed
 * from each tag's age alone (M01). A pure function of its inputs: no clock,
 * no state between calls. `headingRadians` is the preview's enemy-rotation
 * slider (N20); it only turns `front`-aimed shots.
 */
export function previewAt(input: {
  tags: readonly Tag[];
  timeSeconds: number;
  config: EncounterConfig;
  playerTiles: Vector2;
  headingRadians?: number;
}): PreviewFrame {
  const { tags, timeSeconds, config, playerTiles, headingRadians = 0 } = input;
  const emitterTiles = emitterTilesOf(config);
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  const firstTimes = firstTimeByGroup(tags);
  tags.forEach((tag, tagIndex) => {
    if (tag.timeSeconds > timeSeconds) return;
    const match = matchTagAttack(tag, config);
    if (!match) return;
    const { projectile, pattern, attack } = match;
    // N37: arm 0 sits at the pattern's phase plus its rate times the time since
    // the group's first tag. Per-burst advance and arm spread stay excluded
    // (N38), so burstsFired and secondsSinceEpoch are 0.
    const groupElapsedSeconds =
      tag.timeSeconds - (firstTimes.get(groupKey(tag)) ?? tag.timeSeconds);
    const bearings = resolveBearings(pattern, {
      enemyPositionTiles: emitterTiles,
      playerPositionTiles: playerTiles,
      enemyHeadingRadians: headingRadians,
      ringPhaseRadians:
        pattern.kind === "ring"
          ? pattern.initialPhaseRadians +
            degreesToRadians(pattern.clockwiseDegreesPerSecond) * groupElapsedSeconds
          : 0,
      volleyIndexInBurst: 0,
      burstsFired: 0,
      secondsSinceEpoch: 0,
      drawnUnitRandoms: evenDrawsFor(pattern),
    });
    // N40: a targeted bomb lands on the preview's player point, but only when
    // the resolved pattern is one shot; otherwise the tag's count wins and the
    // bomb uses its range.
    const targetTiles =
      attack.target === "player" && pattern.kind === "spread" && pattern.shots === 1
        ? playerTiles
        : undefined;
    const ageSeconds = timeSeconds - tag.timeSeconds;
    for (const bearing of bearings) {
      const spawnTiles = {
        x: emitterTiles.x + Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
        y: emitterTiles.y + Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
      };
      const appearance = projectile.appearance;
      if (!appearance) continue;
      const pose = poseAtAge(
        projectile,
        spawnTiles,
        bearing.bearingRadians,
        ageSeconds,
        targetTiles,
      );
      if (pose) {
        projectiles.push({ tagIndex, appearance, ...pose });
        continue;
      }
      if (projectile.type !== "bomb" || !appearance.bomb) continue;
      const { travelSeconds, detonationRadiusTiles } = projectile;
      const sinceLandingSeconds = ageSeconds - travelSeconds;
      if (
        sinceLandingSeconds >= 0 &&
        sinceLandingSeconds <
          appearance.bomb.frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS
      )
        detonations.push({
          tagIndex,
          positionTiles: resolveBombDestination(
            projectile,
            spawnTiles,
            bearing.bearingRadians,
            targetTiles,
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
    headingRadians,
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

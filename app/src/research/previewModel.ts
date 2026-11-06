import {
  degreesToRadians,
  primaryArchetype,
  type ArmPattern,
  type AttackPattern,
  type AttackSpec,
  type EncounterConfig,
  type PhaseSpec,
  type ProjectileAppearanceSpec,
  type ProjectileSpec,
  type ScatterPattern,
  type SpreadPattern,
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
import { volleyTimesOf } from "./repeat";
import { groupKey, type SavedAttack, type Tag, type TagPattern } from "./tagging";

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

/** The aim fields a tag states, or null when a `fixed` aim has no bearing anywhere (S23). */
function aimFieldsOfTag(
  tag: Tag,
  authored: SpreadPattern | ScatterPattern | null,
):
  | Readonly<{ aim: "player" }>
  | Readonly<{ aim: "fixed"; fixedBearingDegrees: number }>
  | Readonly<{ aim: "front"; offsetDegrees: number }>
  | null {
  if (tag.aim === "fixed") {
    const bearing =
      tag.fixedBearingDegrees ??
      (authored?.aim === "fixed" ? authored.fixedBearingDegrees : undefined);
    return bearing === undefined ? null : { aim: "fixed", fixedBearingDegrees: bearing };
  }
  if (tag.aim === "front")
    return {
      aim: "front",
      offsetDegrees:
        tag.frontOffsetDegrees ?? (authored?.aim === "front" ? authored.offsetDegrees : 0),
    };
  return { aim: "player" };
}

/** Why a tag has no pattern to draw; both are fixed by typing the missing value (S23, S10). */
type PatternProblem = "needs-bearing" | "needs-cone";

/**
 * The pattern the preview draws: the matched attack's pattern with the tag's
 * own geometry laid over it (M05, N36-N39, V16 S22-S25). The tag wins wherever
 * it says something; the attack only supplies what the tag cannot (the
 * projectile's motion, cadence-independent fields, and untyped values).
 *
 * - Rings: `arms` is the tag's shots; the arm pattern comes from the tag
 *   alone; `rotating-arm` takes the tag's typed rate and phase where present
 *   and the authored ones otherwise; `fixed-ring` has rate 0; a typed emitter
 *   radius replaces the authored one.
 * - Spread and scatter: `shots` is the tag's and a typed cone replaces the
 *   authored one. The tag's aim always wins: `player`; `fixed` with its typed
 *   bearing, else the attack's own when that attack is fixed; `front` with its
 *   typed offset, else the authored one, else 0. A `fixed` tag with no bearing
 *   anywhere has no pattern (S23).
 */
export function withTagGeometry(
  pattern: AttackPattern,
  tag: Tag,
): AttackPattern | null {
  if (pattern.kind === "ring") {
    const { armPattern: _authoredArms, ...ring } = pattern;
    const armPattern = armPatternOfTag(tag);
    const rotating = tag.pattern === "rotating-arm";
    return {
      ...ring,
      arms: tag.shots,
      emitterRadiusTiles: tag.emitterRadiusTiles ?? pattern.emitterRadiusTiles,
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
  const aim = aimFieldsOfTag(tag, pattern);
  if (!aim) return null;
  const {
    aim: _aim,
    fixedBearingDegrees: _bearing,
    offsetDegrees: _offset,
    ...bare
  } = pattern as typeof pattern & { fixedBearingDegrees?: number; offsetDegrees?: number };
  const shape =
    pattern.kind === "spread"
      ? { arcDegrees: tag.coneDegrees ?? pattern.arcDegrees }
      : { coneDegrees: tag.coneDegrees ?? pattern.coneDegrees };
  return { ...bare, ...shape, shots: tag.shots, ...aim } as AttackPattern;
}

/**
 * A pattern built from the tag alone, for a bomb fired in another family than
 * the tag's (S10). Only the attack's emitter radius is borrowed. A ring's
 * missing phase and rate are 0 and a spread's missing arc is 0: neutral
 * defaults, not observations. A scatter with no typed cone has no pattern.
 */
function patternFromTag(
  tag: Tag,
  family: AttackPattern["kind"],
  borrowedRadiusTiles: number,
): AttackPattern | PatternProblem {
  const emitterRadiusTiles = tag.emitterRadiusTiles ?? borrowedRadiusTiles;
  if (family === "ring") {
    const armPattern = armPatternOfTag(tag);
    const rotating = tag.pattern === "rotating-arm";
    return {
      kind: "ring",
      arms: tag.shots,
      emitterRadiusTiles,
      initialPhaseRadians: degreesToRadians(rotating ? (tag.initialPhaseDegrees ?? 0) : 0),
      clockwiseDegreesPerSecond: rotating ? (tag.clockwiseDegreesPerSecond ?? 0) : 0,
      ...(armPattern ? { armPattern } : {}),
    };
  }
  const aim = aimFieldsOfTag(tag, null);
  if (!aim) return "needs-bearing";
  if (family === "spread")
    return {
      kind: "spread",
      shots: tag.shots,
      arcDegrees: tag.coneDegrees ?? 0,
      emitterRadiusTiles,
      ...aim,
    } as AttackPattern;
  if (tag.coneDegrees === undefined) return "needs-cone";
  return {
    kind: "scatter",
    shots: tag.shots,
    coneDegrees: tag.coneDegrees,
    emitterRadiusTiles,
    ...aim,
  } as AttackPattern;
}

/**
 * Lays a tag's typed projectile values over a copy of the matched spec, so the
 * game's own `resolveBombDestination`, `poseAtAge` and `resolveShardLifetime`
 * work unchanged and speed stays derived (S11, S24, N25). A typed bullet value
 * applies to `linear` motion only.
 */
function withTypedProjectileValues(projectile: ProjectileSpec, tag: Tag): ProjectileSpec {
  if (projectile.type === "bomb")
    return {
      ...projectile,
      rangeTiles: tag.bombRangeTiles ?? projectile.rangeTiles,
      travelSeconds: tag.bombTravelSeconds ?? projectile.travelSeconds,
    };
  if (
    projectile.motion.kind !== "linear" ||
    (tag.bulletSpeedTilesPerSecond === undefined && tag.bulletRangeTiles === undefined)
  )
    return projectile;
  return {
    ...projectile,
    speedTilesPerSecond: tag.bulletSpeedTilesPerSecond ?? projectile.speedTilesPerSecond,
    motion: {
      ...projectile.motion,
      rangeTiles: tag.bulletRangeTiles ?? projectile.motion.rangeTiles,
    },
  };
}

/** S18: what a tag would do in the preview and the export. */
export type TagMatchStatus =
  | Readonly<{
      kind: "plays-as";
      attackId: string;
      /** S10: the phase a bomb was borrowed from, when it is not the tag's own. */
      borrowedFromPhaseIndex?: number;
    }>
  | Readonly<{
      kind: "wont-preview";
      reason:
        | "no-attack"
        | "needs-bearing"
        | "needs-cone"
        | "legacy-volley"
        | "unknown-phase";
    }>;

type Resolved =
  | Readonly<{ ok: true; match: PreviewMatch; borrowedFromPhaseIndex?: number }>
  | Readonly<{ ok: false; reason: Extract<TagMatchStatus, { kind: "wont-preview" }>["reason"] }>;

function attacksOfPhase(phase: PhaseSpec): readonly AttackSpec[] {
  return [
    ...phase.attacks,
    ...(phase.subPhases ?? []).flatMap((subPhase) => subPhase.attacks),
  ];
}

/**
 * M03/M04, extended for bombs by S10. A bullet tag matches the first attack of
 * its phase firing its sprite in its pattern family. A bomb tag matches the
 * first attack of its phase firing its sprite whatever the family, otherwise
 * the first in any phase, in authored order.
 */
function resolveTagMatch(tag: Tag, config: EncounterConfig): Resolved {
  const family = FAMILY_BY_TAG_PATTERN[tag.pattern];
  if (!family) return { ok: false, reason: "legacy-volley" };
  const phases = primaryArchetype(config).phases;
  const phase = phases[tag.phaseIndex];
  if (!phase) return { ok: false, reason: "unknown-phase" };
  const firesSprite = (attack: AttackSpec) =>
    config.projectiles[attack.projectileId]?.appearance?.id === tag.spriteId;
  const bomb = Object.values(config.projectiles).some(
    (spec) => spec.type === "bomb" && spec.appearance?.id === tag.spriteId,
  );
  let attack = attacksOfPhase(phase).find(
    (candidate) => firesSprite(candidate) && (bomb || candidate.pattern.kind === family),
  );
  let borrowedFromPhaseIndex: number | undefined;
  if (!attack && bomb)
    phases.some((other, index) => {
      attack = attacksOfPhase(other).find(firesSprite);
      if (attack) borrowedFromPhaseIndex = index;
      return attack !== undefined;
    });
  if (!attack) return { ok: false, reason: "no-attack" };
  const projectile = withTypedProjectileValues(config.projectiles[attack.projectileId], tag);
  const built =
    attack.pattern.kind === family
      ? (withTagGeometry(attack.pattern, tag) ?? "needs-bearing")
      : patternFromTag(tag, family, attack.pattern.emitterRadiusTiles);
  if (typeof built === "string") return { ok: false, reason: built };
  return {
    ok: true,
    match: { attack, projectile, pattern: built },
    ...(borrowedFromPhaseIndex === undefined ? {} : { borrowedFromPhaseIndex }),
  };
}

/** M03/M04/S10: the attack, projectile and pattern a tag draws, or null when it draws nothing. */
export function matchTagAttack(
  tag: Tag,
  config: EncounterConfig,
): PreviewMatch | null {
  const resolved = resolveTagMatch(tag, config);
  return resolved.ok ? resolved.match : null;
}

/** S18: the one answer behind the Tag panel, the row badges, the export refusal and the unmatched count. */
export function tagMatchStatus(tag: Tag, config: EncounterConfig): TagMatchStatus {
  const resolved = resolveTagMatch(tag, config);
  if (!resolved.ok) return { kind: "wont-preview", reason: resolved.reason };
  return {
    kind: "plays-as",
    attackId: resolved.match.attack.id,
    ...(resolved.borrowedFromPhaseIndex === undefined
      ? {}
      : { borrowedFromPhaseIndex: resolved.borrowedFromPhaseIndex }),
  };
}

/** Plain words for a `wont-preview` reason, shared by every place that shows one. */
export function wontPreviewText(
  reason: Extract<TagMatchStatus, { kind: "wont-preview" }>["reason"],
): string {
  switch (reason) {
    case "no-attack":
      return "no attack in this phase fires this sprite in this pattern";
    case "needs-bearing":
      return "needs a bearing (type one for aim fixed)";
    case "needs-cone":
      return "needs a cone width (type one for a scatter)";
    case "legacy-volley":
      return "a legacy volley tag has no shape to draw";
    case "unknown-phase":
      return "this phase does not exist in the encounter";
  }
}

/** The one-line text for a status, in the Tag panel, a row badge and the export refusal (S18). */
export function matchStatusText(
  status: TagMatchStatus,
  phaseName: (phaseIndex: number) => string = (index) => `phase ${index + 1}`,
): string {
  if (status.kind === "wont-preview")
    return `Won't preview: ${wontPreviewText(status.reason)}`;
  return status.borrowedFromPhaseIndex === undefined
    ? `Plays as ${status.attackId}`
    : `Plays as ${status.attackId} (borrowed from ${phaseName(status.borrowedFromPhaseIndex)})`;
}

/**
 * V16 S24: whether the tag's matched projectile is a `linear` bullet, the only
 * kind whose speed and range a tag may type.
 */
export function matchesLinearBullet(tag: Tag, config: EncounterConfig): boolean {
  const projectile = matchTagAttack(tag, config)?.projectile;
  return (
    projectile !== undefined &&
    projectile.type !== "bomb" &&
    projectile.motion.kind === "linear"
  );
}

export function countUnmatchedTags(
  tags: readonly Tag[],
  config: EncounterConfig,
): number {
  return tags.filter((tag) => tagMatchStatus(tag, config).kind === "wont-preview").length;
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
 * S44: a linked ring's rotation clock is keyed by saved attack and phase and
 * starts at that key's earliest row, turning through the gaps between rows.
 */
function rotationClockKey(tag: Tag): string | null {
  return tag.savedAttackId === undefined
    ? null
    : `${tag.savedAttackId}\u0000${tag.phaseIndex}`;
}

function firstTimeByRotationClock(tags: readonly Tag[]): Map<string, number> {
  const first = new Map<string, number>();
  for (const entry of tags) {
    const key = rotationClockKey(entry);
    if (key === null) continue;
    const seen = first.get(key);
    if (seen === undefined || entry.timeSeconds < seen)
      first.set(key, entry.timeSeconds);
  }
  return first;
}

/** How long after firing a projectile can still be drawn: in flight, or exploding. */
function drawnLifetimeSeconds(projectile: ProjectileSpec, explosionSeconds: number): number {
  return projectile.type === "bomb"
    ? projectile.travelSeconds + explosionSeconds
    : resolveShardLifetime(projectile).lifetimeSeconds;
}

/**
 * Every live tagged projectile and detonation at `timeSeconds`, computed
 * from each volley's age alone (M01). A pure function of its inputs: no clock,
 * no state between calls. `headingRadians` is the preview's enemy-rotation
 * slider (N20); it only turns `front`-aimed shots. A repeat row expands to its
 * saved attack's volleys (S38), each drawn from the row's index so the M31
 * highlight outlines the whole repeat.
 */
export function previewAt(input: {
  tags: readonly Tag[];
  /** Needed only to expand repeat rows; absent means every row is one volley. */
  savedAttacks?: readonly SavedAttack[];
  timeSeconds: number;
  config: EncounterConfig;
  playerTiles: Vector2;
  headingRadians?: number;
}): PreviewFrame {
  const {
    tags,
    savedAttacks = [],
    timeSeconds,
    config,
    playerTiles,
    headingRadians = 0,
  } = input;
  const emitterTiles = emitterTilesOf(config);
  const projectiles: PreviewProjectile[] = [];
  const detonations: PreviewDetonation[] = [];
  const firstTimes = firstTimeByGroup(tags);
  const clockStarts = firstTimeByRotationClock(tags);
  tags.forEach((tag, tagIndex) => {
    if (tag.timeSeconds > timeSeconds) return;
    const match = matchTagAttack(tag, config);
    if (!match) return;
    const { projectile, pattern } = match;
    const appearance = projectile.appearance;
    if (!appearance) return;
    const explosionSeconds = appearance.bomb
      ? appearance.bomb.frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS
      : 0;
    const lifetimeSeconds = drawnLifetimeSeconds(projectile, explosionSeconds);
    const cadence = savedAttacks.find((entry) => entry.id === tag.savedAttackId)?.cadence;
    const clockKey = rotationClockKey(tag);
    const clockStart =
      clockKey === null
        ? (firstTimes.get(groupKey(tag)) ?? tag.timeSeconds)
        : (clockStarts.get(clockKey) ?? tag.timeSeconds);
    // N40/S09: a tag marked as targeting lands on the preview's player point,
    // but only when the resolved pattern is one shot; any other tag lands at
    // its range. The matched attack's own `target` is ignored.
    const targetTiles =
      tag.target === "player" && pattern.kind === "spread" && pattern.shots === 1
        ? playerTiles
        : undefined;
    for (const volleyTimeSeconds of volleyTimesOf(tag, cadence)) {
      if (volleyTimeSeconds > timeSeconds) break;
      const ageSeconds = timeSeconds - volleyTimeSeconds;
      // A volley that has finished flying and exploding draws nothing; skipping
      // it here keeps a long repeat cheap on each presented frame.
      if (ageSeconds >= lifetimeSeconds) continue;
      // N37/S44: arm 0 sits at the pattern's phase plus its rate times the time
      // since the clock started. Per-burst advance and arm spread stay excluded
      // (N38), so burstsFired and secondsSinceEpoch are 0.
      const clockElapsedSeconds = volleyTimeSeconds - clockStart;
      const bearings = resolveBearings(pattern, {
        enemyPositionTiles: emitterTiles,
        playerPositionTiles: playerTiles,
        enemyHeadingRadians: headingRadians,
        ringPhaseRadians:
          pattern.kind === "ring"
            ? pattern.initialPhaseRadians +
              degreesToRadians(pattern.clockwiseDegreesPerSecond) * clockElapsedSeconds
            : 0,
        volleyIndexInBurst: 0,
        burstsFired: 0,
        secondsSinceEpoch: 0,
        drawnUnitRandoms: evenDrawsFor(pattern),
      });
      for (const bearing of bearings) {
        const spawnTiles = {
          x: emitterTiles.x + Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
          y: emitterTiles.y + Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
        };
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
        if (sinceLandingSeconds >= 0 && sinceLandingSeconds < explosionSeconds)
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

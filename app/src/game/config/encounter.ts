import type { CircularArena, Vector2 } from "../models";
import type { ConditionApplication } from "../simulation/conditions";
import {
  AUTHORED_APPEARANCES,
  AUTHORED_ARCHETYPES,
  AUTHORED_ARENA,
  AUTHORED_ENCOUNTER,
  AUTHORED_ENCOUNTER_DATA,
  AUTHORED_PROJECTILES,
  loadOutline,
  TELEGRAPH_COLOR_NAMES,
  type AuthoredAppearance,
  type AuthoredAppearanceTemplate,
  type AuthoredArchetype,
  type AuthoredAttack,
  type AuthoredBody,
  type AuthoredPhase,
  type AuthoredPhaseSpawn,
  type AuthoredProjectile,
  type AuthoredSubPhase,
  type TelegraphColorName,
} from "./data";
import { assertNonnegative, PALADIN_DERIVED_STATS } from "./stats";
import {
  constrainBodyToArena,
  convexBodyFitsCircle,
  transformBodyVertices,
  validateConvexParts,
} from "../simulation/geometry";
import {
  firstArmCollisionDegrees,
  sectorWidthDegrees,
  totalCoverageDegrees,
} from "./sectors";

// Approved encounter geometry. Authored values live in `../data` and are
// validated at the boundary by `./data`; this module only derives runtime
// configuration from them. Provenance: docs/mechanics.md step 8.2.
const ARENA = AUTHORED_ARENA;

export type ProjectileMotion =
  | Readonly<{
      kind: "boomerang";
      reversalAgeSeconds: number;
      lifetimeSeconds: number;
    }>
  | Readonly<{ kind: "linear"; rangeTiles: number }>
  | Readonly<{
      kind: "turning";
      rangeTiles: number;
      turnRateDegreesPerSecond: number;
    }>
  | Readonly<{
      kind: "wavy";
      rangeTiles: number;
      amplitudeTiles: number;
      frequencyHz: number;
    }>
  | Readonly<{
      kind: "lob";
      travelSeconds: number;
      detonationRadiusTiles: number;
    }>;

export type ProjectileBombSpec = Readonly<{
  frameOuterPixels: readonly number[];
  borderPixels: number;
  bodyColor: string;
}>;

export type ProjectileAppearanceSpec = Readonly<{
  id: string;
  nativeWidthPixels: number;
  nativeHeightPixels: number;
  /** Resolved hex colours, or null for a transparent cell. */
  pixels: readonly (readonly (string | null)[])[];
  palette: Readonly<Record<string, string>>;
  pixelsPerTile: number;
  visualWidthTiles: number;
  visualHeightTiles: number;
  /** Compound collision rectangles derived from the opaque pixel runs. */
  partsTiles: readonly (readonly Vector2[])[];
  source: string;
  bomb?: ProjectileBombSpec;
}>;

export type ProjectileSpec = Readonly<{
  id: string;
  damageHp: number;
  speedTilesPerSecond: number;
  armorPiercing: boolean;
  conditions: readonly ConditionApplication[];
  verticesTiles: readonly Vector2[];
  collisionPartsTiles: readonly (readonly Vector2[])[];
  appearance: ProjectileAppearanceSpec | null;
  expiration: string;
  hitPolicy: string;
  motion: ProjectileMotion;
}>;

/**
 * One rotating ring of arms. The optional fields deliberately subsume the
 * pattern names later phases might otherwise invent: a spiral is a ring with
 * a nonzero `clockwiseDegreesPerSecond`; a static radial burst is a ring with
 * a zero rotation rate; and the Queen's phase 6 machinegun is a ring with
 * `arms: 2`, a high rotation rate, gap sectors and an arm spread.
 *
 * A gap sector is measured in the pattern's own frame, anchored at
 * `initialPhaseRadians`, and an arm is suppressed while its current bearing
 * falls inside one. The live rotation therefore sweeps arms through a fixed
 * opening rather than carrying the opening with them.
 *
 * `armSpreadDegreesPerSecond` adds `armIndex * elapsed` degrees of lag to each
 * successive arm, growing from zero at the clock epoch and clamping at
 * `maxArmSpreadDegrees`. A maximum at or above `360 / (arms * (arms - 1))`
 * would carry two arms onto the same bearing and is rejected.
 */
export type RingPattern = Readonly<{
  kind: "ring";
  arms: number;
  emitterRadiusTiles: number;
  initialPhaseRadians: number;
  clockwiseDegreesPerSecond: number;
  perBurstAdvanceDegrees?: number;
  gapSectorsDegrees?: readonly (readonly [number, number])[];
  armSpreadDegreesPerSecond?: number;
  maxArmSpreadDegrees?: number;
}>;

export type SpreadPattern =
  | Readonly<{
      kind: "spread";
      shots: number;
      arcDegrees: number;
      aim: "player";
      emitterRadiusTiles: number;
    }>
  | Readonly<{
      kind: "spread";
      shots: number;
      arcDegrees: number;
      aim: "fixed";
      fixedBearingDegrees: number;
      emitterRadiusTiles: number;
    }>;

export type ScatterPattern =
  | Readonly<{
      kind: "scatter";
      shots: number;
      coneDegrees: number;
      aim: "player";
      emitterRadiusTiles: number;
    }>
  | Readonly<{
      kind: "scatter";
      shots: number;
      coneDegrees: number;
      aim: "fixed";
      fixedBearingDegrees: number;
      emitterRadiusTiles: number;
    }>;

export type AttackPattern = RingPattern | SpreadPattern | ScatterPattern;

/**
 * An enemy's movement behaviour, authored per archetype (step 22.1). `chase`
 * is the sole kind the shipped Crystal Worm uses and the only one
 * `validateShippedEncounter` holds below the Paladin's speed; the debug panel
 * only ever edits a `chase` speed. `orbit`'s tangential speed is checked
 * against the Paladin unconditionally, in `validateEncounterConfig` itself,
 * because an orbiting boss must never be able to outrun the player under any
 * configuration, debug included.
 */
export type MovementSpec =
  | Readonly<{ kind: "chase"; speedTilesPerSecond: number }>
  | Readonly<{ kind: "stationary" }>
  | Readonly<{
      kind: "move-to-point";
      target: "arena-center";
      speedTilesPerSecond: number;
    }>
  | Readonly<{
      kind: "orbit";
      radiusTiles: number;
      degreesPerSecond: number;
      direction: "cw" | "ccw";
      approachSpeedTilesPerSecond: number;
    }>
  | Readonly<{
      kind: "wander";
      speedTilesPerSecond: number;
      retargetSeconds: number;
      radiusTiles: number;
    }>;

export type Progression =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "simulated-dps"; hpPerSecond: number }>;

export type HealthSpec = Readonly<{
  maxHealthHp: number;
  progression: Progression;
}>;

export type AttackCadence = Readonly<{
  shotsPerBurst: number;
  shotIntervalSeconds: number;
  cooldownAfterLastShotSeconds: number;
  initialDelaySeconds: number;
}>;

export type AttackSpec = Readonly<{
  id: string;
  projectileId: string;
  tuningSource: string;
  pattern: AttackPattern;
  cadence: AttackCadence;
}>;

export type { TelegraphColorName };

/**
 * One phase of an enemy's lifecycle (step 22.3): its own movement, attacks and
 * optional progression override, entered on an HP threshold or on the
 * previous phase's authored duration (K09). The telegraph is implemented by
 * anchoring the rebuilt attack clocks' epoch past `telegraphSeconds`, not by a
 * separate firing gate - see `simulation/phases.ts`.
 */
/**
 * One sub-phase of a cycling attack rotation inside a phase (step 22.4),
 * entered and advanced through the same mechanism as a phase: duration-based
 * entry, its own invulnerability window and telegraph, and a rebuilt attack
 * clock set. `movement` is `null` when the sub-phase leaves the phase's own
 * movement in effect for its duration.
 */
export type SubPhaseSpec = Readonly<{
  id: string;
  durationSeconds: number;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  movement: MovementSpec | null;
  attacks: readonly AttackSpec[];
  spawns: readonly PhaseSpawnSpec[] | null;
}>;

export type SpawnPlacement =
  | Readonly<{ kind: "ring-around-owner"; radiusTiles: number }>
  | Readonly<{ kind: "arena-ring"; ringRadiusFraction: number }>;

/** Resolved once on entering the phase or sub-phase that authors it (step 22.4). */
export type PhaseSpawnSpec = Readonly<{
  archetypeId: string;
  count: number;
  despawnOnExit: boolean;
  startPhaseIndex: number;
  placement: SpawnPlacement;
}>;

export type PhaseSpec = Readonly<{
  id: string;
  enterAtHpFraction: number;
  exitAfterSeconds: number | null;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  telegraphColor: TelegraphColorName;
  movement: MovementSpec;
  progression: Progression | null;
  attacks: readonly AttackSpec[];
  subPhases: readonly SubPhaseSpec[] | null;
  spawns: readonly PhaseSpawnSpec[] | null;
}>;

export type EnemyArchetype = Readonly<{
  id: string;
  spawnTiles: Vector2;
  verticesTiles: readonly Vector2[];
  /** Ordered, strictly descending by `enterAtHpFraction`; the first is always 1 (K09). */
  phases: readonly PhaseSpec[];
  /** Absent entirely for an enemy with no sourced hit-point total, e.g. the Crystal Worm. */
  health?: HealthSpec;
  contactDamageHp: number;
  contactConditions: readonly ConditionApplication[];
  contactArmorPiercing: boolean;
  contactCooldownSeconds: number;
  blocksPlayer: boolean;
}>;

export type SpawnRule = Readonly<{
  archetypeId: string;
  firstSpawnSeconds: number;
  /** `null` means the opening spawn is never repeated (K10: a single boss). */
  everySeconds: number | null;
  maxConcurrent: number;
  ringRadiusTiles: number;
  goldenAngleRadians: number;
}>;

export type EncounterConfig = Readonly<{
  rulesVersion: string;
  spawns: SpawnRule;
  maxConcurrentMinions: number;
  simulation: Readonly<{
    fixedStepSeconds: number;
    maxStepsPerUpdate: number;
  }>;
  arena: CircularArena;
  player: Readonly<{ spawnTiles: Vector2; verticesTiles: readonly Vector2[] }>;
  primaryArchetypeId: string;
  archetypes: Readonly<Record<string, EnemyArchetype>>;
  projectiles: Readonly<Record<string, ProjectileSpec>>;
  camera: Readonly<{
    cssPixelsPerTile: number;
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
  }>;
  session: Readonly<{
    startCountdownSeconds: number;
    retryCountdownSeconds: number;
    historyLimit: number;
  }>;
  presentation: Readonly<{ lobTelegraphSeconds: number }>;
}>;

export const RULES_VERSION = AUTHORED_ENCOUNTER.rulesVersion;
/** The only encounter the debug panel ever tunes (K12); its id in `ENCOUNTER_CONFIGS`. */
export const DEBUG_TUNABLE_ENCOUNTER_ID = "crystal-worm";
export const PRIMARY_ARCHETYPE_ID = AUTHORED_ENCOUNTER.primaryArchetype;

const authoredPrimary = AUTHORED_ARCHETYPES[PRIMARY_ARCHETYPE_ID];
// The debug panel is not phase-aware; it tunes the single phase the shipped
// primary archetype authors.
if (authoredPrimary.phases.length !== 1)
  throw new RangeError("The debug-tunable archetype must author exactly one phase");
const authoredPrimaryPhase = authoredPrimary.phases[0];
// The debug panel tunes exactly one attack; later steps that add a second
// attack to any archetype must not route sliders through this index.
const authoredPrimaryAttack = authoredPrimaryPhase.attacks[0];
// The debug panel only ever tunes a ring-kind attack (the shipped Crystal
// Worm spiral); a `spread` attack is additive and not yet debug-tunable.
if (authoredPrimaryAttack.pattern.kind !== "ring")
  throw new RangeError("The debug-tunable attack must use a ring pattern");
const authoredPrimaryPattern = authoredPrimaryAttack.pattern;
// The debug panel only ever tunes a `chase` speed; later archetypes may use
// another movement kind, but the shipped primary never does.
if (authoredPrimaryPhase.movement.kind !== "chase")
  throw new RangeError("The debug-tunable archetype must use chase movement");
const authoredPrimaryMovement = authoredPrimaryPhase.movement;
const AUTHORED_PROJECTILE_ID = authoredPrimaryAttack.projectile;
const authoredProjectile = AUTHORED_PROJECTILES[AUTHORED_PROJECTILE_ID];
// The debug panel only ever tunes the shipped, boomerang-kind shard (G: 19.3
// adds `linear` to the catalog type, but not to any debug-tunable projectile).
if (authoredProjectile.motion.kind !== "boomerang")
  throw new RangeError("The debug-tunable projectile must use boomerang motion");
const authoredBoomerangMotion = authoredProjectile.motion;
// The debug panel's spawn-rate slider edits a real cadence; the debug-tunable
// encounter must author one, unlike the Queen's single never-repeated spawn.
if (AUTHORED_ENCOUNTER.spawns.everySeconds === null)
  throw new RangeError(
    "The debug-tunable encounter must author a repeating spawn cadence",
  );
const authoredPrimaryEverySeconds = AUTHORED_ENCOUNTER.spawns.everySeconds;

export function scaleBody(
  vertices: readonly Vector2[],
  width: number,
  height: number,
): readonly Vector2[] {
  const sourceWidth = bodyExtentTiles(vertices, "x");
  const sourceHeight = bodyExtentTiles(vertices, "y");
  if (sourceWidth === width && sourceHeight === height) return vertices;
  return vertices.map((vertex) => ({
    x: (vertex.x / sourceWidth) * width,
    y: (vertex.y / sourceHeight) * height,
  }));
}

/** Span of a body on one axis, in tiles. One definition for all callers. */
export function bodyExtentTiles(
  vertices: readonly Vector2[],
  axis: "x" | "y",
): number {
  return (
    Math.max(...vertices.map((vertex) => vertex[axis])) -
    Math.min(...vertices.map((vertex) => vertex[axis]))
  );
}

export const degreesToRadians = (degrees: number): number =>
  (degrees * Math.PI) / 180;

export function bodyVertices(body: AuthoredBody): readonly Vector2[] {
  return scaleBody(loadOutline(body.shape), body.widthTiles, body.heightTiles);
}

/**
 * The flat tuning surface. These are the values the debug panel edits and the
 * authored data supplies, and `buildEncounterConfig` is the single mapping from
 * them to a runtime config - used by both the shipped and the debug path, so
 * there is no second builder to drift (G: F2, F3).
 */
export type TuningValues = Readonly<{
  headWidth: number;
  headHeight: number;
  playerWidth: number;
  playerHeight: number;
  enemySpeedTilesPerSecond: number;
  spawnX: number;
  spawnY: number;
  emitterCount: number;
  emitterRadiusTiles: number;
  initialPhaseDegrees: number;
  rotationDegreesPerSecond: number;
  shotsPerEmitter: number;
  shotIntervalSeconds: number;
  cooldownSeconds: number;
  initialCooldownSeconds: number;
  projectileDamageHp: number;
  projectileSpeedTilesPerSecond: number;
  reversalSeconds: number;
  lifetimeSeconds: number;
  projectileWidth: number;
  projectileHeight: number;
  firstSpawnSeconds: number;
  spawnEverySeconds: number;
  maxConcurrentEnemies: number;
  spawnRingFraction: number;
}>;

export const AUTHORED_TUNING: TuningValues = Object.freeze({
  headWidth: authoredPrimary.body.widthTiles,
  headHeight: authoredPrimary.body.heightTiles,
  playerWidth: AUTHORED_ENCOUNTER.player.body.widthTiles,
  playerHeight: AUTHORED_ENCOUNTER.player.body.heightTiles,
  enemySpeedTilesPerSecond: authoredPrimaryMovement.speedTilesPerSecond,
  spawnX: authoredPrimary.spawnTiles.x,
  spawnY: authoredPrimary.spawnTiles.y,
  emitterCount: authoredPrimaryPattern.arms,
  emitterRadiusTiles: authoredPrimaryPattern.emitterRadiusTiles,
  initialPhaseDegrees: authoredPrimaryPattern.initialPhaseDegrees,
  rotationDegreesPerSecond:
    authoredPrimaryPattern.clockwiseDegreesPerSecond,
  shotsPerEmitter: authoredPrimaryAttack.cadence.shotsPerBurst,
  shotIntervalSeconds: authoredPrimaryAttack.cadence.shotIntervalSeconds,
  cooldownSeconds: authoredPrimaryAttack.cadence.cooldownAfterLastShotSeconds,
  initialCooldownSeconds: authoredPrimaryAttack.cadence.initialDelaySeconds,
  projectileDamageHp: authoredProjectile.damageHp,
  projectileSpeedTilesPerSecond: authoredProjectile.speedTilesPerSecond,
  reversalSeconds: authoredBoomerangMotion.reversalAgeSeconds,
  lifetimeSeconds: authoredBoomerangMotion.lifetimeSeconds,
  projectileWidth: authoredProjectile.body!.widthTiles,
  projectileHeight: authoredProjectile.body!.heightTiles,
  firstSpawnSeconds: AUTHORED_ENCOUNTER.spawns.firstSpawnSeconds,
  spawnEverySeconds: authoredPrimaryEverySeconds,
  maxConcurrentEnemies: AUTHORED_ENCOUNTER.spawns.maxConcurrent,
  spawnRingFraction: AUTHORED_ENCOUNTER.spawns.placement.ringRadiusFraction,
});

/**
 * The debug panel's "load selected values" preset: the screenshot-selected
 * head, emitter, burst and projectile values only. Deliberately a subset -
 * enemy speed, spawn position and player size are omitted so the preset does
 * not clobber them. Values are projected from AUTHORED_TUNING, so there is
 * still only one copy of each number.
 */
const selectedKeys = [
  "headWidth",
  "headHeight",
  "emitterCount",
  "emitterRadiusTiles",
  "initialPhaseDegrees",
  "rotationDegreesPerSecond",
  "shotsPerEmitter",
  "shotIntervalSeconds",
  "cooldownSeconds",
  "initialCooldownSeconds",
  "projectileDamageHp",
  "projectileSpeedTilesPerSecond",
  "reversalSeconds",
  "lifetimeSeconds",
  "projectileWidth",
  "projectileHeight",
] as const satisfies readonly (keyof TuningValues)[];

export const SELECTED_ENCOUNTER_VALUES: Readonly<
  Pick<TuningValues, (typeof selectedKeys)[number]>
> = Object.freeze(
  Object.fromEntries(
    selectedKeys.map((key) => [key, AUTHORED_TUNING[key]]),
  ) as Pick<TuningValues, (typeof selectedKeys)[number]>,
);

const headOutline = loadOutline(authoredPrimary.body.shape);
const playerOutline = loadOutline(AUTHORED_ENCOUNTER.player.body.shape);
const shardOutline = loadOutline(authoredProjectile.body!.shape);

export type BuildOptions = Readonly<{
  rulesVersion: string;
  /** Copies head size onto the player instead of using its authored size. */
  matchPlayerToHead: boolean;
}>;

export function buildEncounterConfig(
  values: TuningValues,
  options: BuildOptions,
): EncounterConfig {
  const verticesTiles = scaleBody(
    headOutline,
    values.headWidth,
    values.headHeight,
  );
  const archetype: EnemyArchetype = Object.freeze({
    id: PRIMARY_ARCHETYPE_ID,
    // The spawn inputs can reach past the arena wall, so clamp here and keep
    // every config valid by construction.
    spawnTiles: constrainBodyToArena(
      verticesTiles,
      { x: values.spawnX, y: values.spawnY },
      ARENA,
    ),
    verticesTiles,
    contactDamageHp: authoredPrimary.contactDamageHp,
    contactConditions: authoredPrimary.contactConditions,
    contactArmorPiercing: authoredPrimary.contactArmorPiercing,
    contactCooldownSeconds: authoredPrimary.contactCooldownSeconds,
    blocksPlayer: authoredPrimary.blocksPlayer,
    phases: Object.freeze([
      Object.freeze({
        id: authoredPrimaryPhase.id,
        enterAtHpFraction: authoredPrimaryPhase.enterAtHpFraction,
        exitAfterSeconds: authoredPrimaryPhase.exitAfterSeconds,
        telegraphSeconds: authoredPrimaryPhase.telegraphSeconds,
        invulnerableOnEnterSeconds:
          authoredPrimaryPhase.invulnerableOnEnterSeconds,
        telegraphColor: authoredPrimaryPhase.telegraphColor,
        movement: Object.freeze({
          kind: "chase",
          speedTilesPerSecond: values.enemySpeedTilesPerSecond,
        }),
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: Object.freeze([
          Object.freeze({
            id: authoredPrimaryAttack.id,
            projectileId: AUTHORED_PROJECTILE_ID,
            tuningSource: authoredPrimaryAttack.tuningSource,
            pattern: Object.freeze({
              kind: "ring",
              arms: values.emitterCount,
              emitterRadiusTiles: values.emitterRadiusTiles,
              initialPhaseRadians: degreesToRadians(values.initialPhaseDegrees),
              clockwiseDegreesPerSecond: values.rotationDegreesPerSecond,
            }),
            cadence: Object.freeze({
              shotsPerBurst: values.shotsPerEmitter,
              shotIntervalSeconds: values.shotIntervalSeconds,
              cooldownAfterLastShotSeconds: values.cooldownSeconds,
              initialDelaySeconds: values.initialCooldownSeconds,
            }),
          }),
        ]),
      }),
    ]),
  });
  const projectileVerticesTiles = scaleBody(
    shardOutline,
    values.projectileWidth,
    values.projectileHeight,
  );
  const projectile: ProjectileSpec = Object.freeze({
    id: AUTHORED_PROJECTILE_ID,
    damageHp: values.projectileDamageHp,
    speedTilesPerSecond: values.projectileSpeedTilesPerSecond,
    armorPiercing: authoredProjectile.armorPiercing,
    conditions: authoredProjectile.conditions,
    verticesTiles: projectileVerticesTiles,
    collisionPartsTiles: Object.freeze([projectileVerticesTiles]),
    appearance: null,
    expiration: authoredProjectile.expiration,
    hitPolicy: authoredProjectile.hitPolicy,
    motion: Object.freeze({
      kind: "boomerang",
      reversalAgeSeconds: values.reversalSeconds,
      lifetimeSeconds: values.lifetimeSeconds,
    }),
  });
  return {
    rulesVersion: options.rulesVersion,
    spawns: {
      archetypeId: AUTHORED_ENCOUNTER.spawns.archetype,
      firstSpawnSeconds: values.firstSpawnSeconds,
      everySeconds: values.spawnEverySeconds,
      maxConcurrent: values.maxConcurrentEnemies,
      ringRadiusTiles: values.spawnRingFraction * ARENA.radiusTiles,
      goldenAngleRadians: degreesToRadians(
        AUTHORED_ENCOUNTER.spawns.placement.goldenAngleDegrees,
      ),
    },
    maxConcurrentMinions: AUTHORED_ENCOUNTER.maxConcurrentMinions,
    simulation: AUTHORED_ENCOUNTER.simulation,
    arena: ARENA,
    player: {
      spawnTiles: AUTHORED_ENCOUNTER.player.spawnTiles,
      verticesTiles: options.matchPlayerToHead
        ? scaleBody(playerOutline, values.headWidth, values.headHeight)
        : scaleBody(playerOutline, values.playerWidth, values.playerHeight),
    },
    primaryArchetypeId: PRIMARY_ARCHETYPE_ID,
    archetypes: Object.freeze({ [PRIMARY_ARCHETYPE_ID]: archetype }),
    projectiles: Object.freeze({ [AUTHORED_PROJECTILE_ID]: projectile }),
    camera: AUTHORED_ENCOUNTER.camera,
    session: AUTHORED_ENCOUNTER.session,
    presentation: AUTHORED_ENCOUNTER.presentation,
  };
}

export const ENCOUNTER_CONFIG = buildEncounterConfig(AUTHORED_TUNING, {
  rulesVersion: RULES_VERSION,
  // The player uses its own authored size; coupling to the head is a debug
  // override, not the shipped default (G08).
  matchPlayerToHead: false,
});

/**
 * Maps an authored attack pattern to its runtime shape (K14/F5): identical
 * field-for-field except `ring`'s phase, authored in degrees like every other
 * authored angle, converted once here to the radians the simulation uses.
 */
function patternFromAuthored(pattern: AuthoredAttack["pattern"]): AttackPattern {
  if (pattern.kind !== "ring") return pattern;
  const { initialPhaseDegrees, ...rest } = pattern;
  return Object.freeze({
    ...rest,
    initialPhaseRadians: degreesToRadians(initialPhaseDegrees),
  });
}

function attackSpecFromAuthored(attack: AuthoredAttack): AttackSpec {
  return Object.freeze({
    id: attack.id,
    projectileId: attack.projectile,
    tuningSource: attack.tuningSource,
    pattern: patternFromAuthored(attack.pattern),
    cadence: attack.cadence,
  });
}

function phaseSpawnFromAuthored(spawn: AuthoredPhaseSpawn): PhaseSpawnSpec {
  return Object.freeze({
    archetypeId: spawn.archetype,
    count: spawn.count,
    despawnOnExit: spawn.despawnOnExit,
    startPhaseIndex: spawn.startPhaseIndex,
    placement: spawn.placement,
  });
}

function subPhaseSpecFromAuthored(subPhase: AuthoredSubPhase): SubPhaseSpec {
  return Object.freeze({
    id: subPhase.id,
    durationSeconds: subPhase.durationSeconds,
    telegraphSeconds: subPhase.telegraphSeconds,
    invulnerableOnEnterSeconds: subPhase.invulnerableOnEnterSeconds,
    movement: subPhase.movement,
    attacks: Object.freeze(subPhase.attacks.map(attackSpecFromAuthored)),
    spawns: subPhase.spawns
      ? Object.freeze(subPhase.spawns.map(phaseSpawnFromAuthored))
      : null,
  });
}

function phaseSpecFromAuthored(phase: AuthoredPhase): PhaseSpec {
  return Object.freeze({
    id: phase.id,
    enterAtHpFraction: phase.enterAtHpFraction,
    exitAfterSeconds: phase.exitAfterSeconds,
    telegraphSeconds: phase.telegraphSeconds,
    invulnerableOnEnterSeconds: phase.invulnerableOnEnterSeconds,
    telegraphColor: phase.telegraphColor,
    movement: phase.movement,
    progression: phase.progression,
    attacks: Object.freeze(phase.attacks.map(attackSpecFromAuthored)),
    subPhases: phase.subPhases
      ? Object.freeze(phase.subPhases.map(subPhaseSpecFromAuthored))
      : null,
    spawns: phase.spawns
      ? Object.freeze(phase.spawns.map(phaseSpawnFromAuthored))
      : null,
  });
}

/**
 * Maps any authored archetype to its runtime shape as authored, with no
 * debug-slider overrides - the generalization the single Crystal Worm debug
 * path (`buildEncounterConfig`, above) never needed until a second, static
 * encounter existed (F5).
 */
function archetypeFromAuthored(authored: AuthoredArchetype): EnemyArchetype {
  const outline = loadOutline(authored.body.shape);
  return Object.freeze({
    id: authored.id,
    spawnTiles: authored.spawnTiles,
    verticesTiles: scaleBody(
      outline,
      authored.body.widthTiles,
      authored.body.heightTiles,
    ),
    ...(authored.health ? { health: authored.health } : {}),
    contactDamageHp: authored.contactDamageHp,
    contactConditions: authored.contactConditions,
    contactArmorPiercing: authored.contactArmorPiercing,
    contactCooldownSeconds: authored.contactCooldownSeconds,
    blocksPlayer: authored.blocksPlayer,
    phases: Object.freeze(authored.phases.map(phaseSpecFromAuthored)),
  });
}

const projectileBombBodyTiles = 0.6;

function boundingRectangleVertices(
  widthTiles: number,
  heightTiles: number,
): readonly Vector2[] {
  const halfWidth = widthTiles / 2;
  const halfHeight = heightTiles / 2;
  return Object.freeze([
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ]);
}

function rectanglePart(
  leftTiles: number,
  topTiles: number,
  widthTiles: number,
  heightTiles: number,
): readonly Vector2[] {
  return Object.freeze([
    { x: leftTiles, y: topTiles },
    { x: leftTiles + widthTiles, y: topTiles },
    { x: leftTiles + widthTiles, y: topTiles + heightTiles },
    { x: leftTiles, y: topTiles + heightTiles },
  ]);
}

function appearancePixels(
  template: Extract<AuthoredAppearanceTemplate, { kind: "pixels" }>,
  palette: Readonly<Record<string, string>>,
): readonly (readonly (string | null)[])[] {
  return Object.freeze(
    template.rows.map((row) =>
      Object.freeze(
        [...row].map((character) => (character === "." ? null : palette[character])),
      ),
    ),
  );
}

/**
 * Converts one opaque horizontal run into a collision rectangle. The union of
 * every run is the exact visible silhouette, which is why the same pixel grid
 * drives drawing and collision (P03/P05).
 */
function appearanceParts(
  pixels: readonly (readonly (string | null)[])[],
  pixelsPerTile: number,
  widthPixels: number,
  heightPixels: number,
): readonly (readonly Vector2[])[] {
  const parts: (readonly Vector2[])[] = [];
  pixels.forEach((row, rowIndex) => {
    let runStart = -1;
    for (let column = 0; column <= row.length; column++) {
      const opaque = column < row.length && row[column] !== null;
      if (opaque && runStart < 0) runStart = column;
      if (!opaque && runStart >= 0) {
        const leftTiles = (runStart - widthPixels / 2) / pixelsPerTile;
        const topTiles = (rowIndex - heightPixels / 2) / pixelsPerTile;
        parts.push(
          rectanglePart(
            leftTiles,
            topTiles,
            (column - runStart) / pixelsPerTile,
            1 / pixelsPerTile,
          ),
        );
        runStart = -1;
      }
    }
  });
  return Object.freeze(parts);
}

function appearanceFromAuthored(
  id: string,
  authored: AuthoredAppearance,
  template: AuthoredAppearanceTemplate,
  pixelsPerTile: number,
): ProjectileAppearanceSpec {
  if (template.kind === "bomb") {
    if (!authored.bodyColor)
      throw new RangeError(`Appearance ${id} is missing its bomb body colour`);
    return Object.freeze({
      id,
      nativeWidthPixels: 0,
      nativeHeightPixels: 0,
      pixels: Object.freeze([]),
      palette: authored.palette,
      pixelsPerTile,
      visualWidthTiles: projectileBombBodyTiles,
      visualHeightTiles: projectileBombBodyTiles,
      partsTiles: Object.freeze([]),
      source: authored.source,
      bomb: Object.freeze({
        frameOuterPixels: template.frameOuterPixels,
        borderPixels: template.borderPixels,
        bodyColor: authored.bodyColor,
      }),
    });
  }
  const pixels = appearancePixels(template, authored.palette);
  return Object.freeze({
    id,
    nativeWidthPixels: template.widthPixels,
    nativeHeightPixels: template.heightPixels,
    pixels,
    palette: authored.palette,
    pixelsPerTile,
    visualWidthTiles: template.widthPixels / pixelsPerTile,
    visualHeightTiles: template.heightPixels / pixelsPerTile,
    partsTiles: appearanceParts(
      pixels,
      pixelsPerTile,
      template.widthPixels,
      template.heightPixels,
    ),
    source: authored.source,
  });
}

const STATIC_APPEARANCES: Readonly<Record<string, ProjectileAppearanceSpec>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(AUTHORED_APPEARANCES.appearances).map(([id, authored]) => {
        const template = AUTHORED_APPEARANCES.templates[authored.templateId];
        if (!template)
          throw new RangeError(`Appearance ${id} names an unknown template`);
        return [
          id,
          appearanceFromAuthored(
            id,
            authored,
            template,
            AUTHORED_APPEARANCES.pixelsPerTile,
          ),
        ];
      }),
    ),
  );

function projectileFromAuthored(authored: AuthoredProjectile): ProjectileSpec {
  const appearance = authored.appearance
    ? STATIC_APPEARANCES[authored.appearance]
    : null;
  if (authored.appearance && !appearance)
    throw new RangeError(`Unknown projectile appearance: ${authored.appearance}`);
  if (!appearance && !authored.body)
    throw new RangeError(`Projectile ${authored.id} has no body or appearance`);

  let verticesTiles: readonly Vector2[];
  let collisionPartsTiles: readonly (readonly Vector2[])[];
  if (appearance) {
    if (appearance.bomb) {
      const bombBody = scaleBody(
        loadOutline("beveled-octagon"),
        projectileBombBodyTiles,
        projectileBombBodyTiles,
      );
      verticesTiles = bombBody;
      collisionPartsTiles = Object.freeze([bombBody]);
    } else {
      verticesTiles = boundingRectangleVertices(
        appearance.visualWidthTiles,
        appearance.visualHeightTiles,
      );
      collisionPartsTiles = appearance.partsTiles;
    }
  } else {
    const outline = loadOutline(authored.body!.shape);
    verticesTiles = scaleBody(
      outline,
      authored.body!.widthTiles,
      authored.body!.heightTiles,
    );
    collisionPartsTiles = Object.freeze([verticesTiles]);
  }

  return Object.freeze({
    id: authored.id,
    damageHp: authored.damageHp,
    speedTilesPerSecond: authored.speedTilesPerSecond,
    armorPiercing: authored.armorPiercing,
    conditions: authored.conditions,
    verticesTiles,
    collisionPartsTiles,
    appearance,
    expiration: authored.expiration,
    hitPolicy: authored.hitPolicy,
    motion: authored.motion,
  });
}

/** Every archetype and projectile, converted once and shared by every static (non-debug-tunable) encounter. */
const STATIC_ARCHETYPES: Readonly<Record<string, EnemyArchetype>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(AUTHORED_ARCHETYPES).map(([id, archetype]) => [
        id,
        archetypeFromAuthored(archetype),
      ]),
    ),
  );
const STATIC_PROJECTILES: Readonly<Record<string, ProjectileSpec>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(AUTHORED_PROJECTILES).map(([id, projectile]) => [
        id,
        projectileFromAuthored(projectile),
      ]),
    ),
  );

/** Builds a non-debug-tunable encounter's runtime config straight from its authored entry (K14). */
function buildStaticEncounterConfig(
  entryId: string,
): EncounterConfig {
  const entry = AUTHORED_ENCOUNTER_DATA.encounters[entryId];
  return {
    rulesVersion: entry.rulesVersion,
    spawns: {
      archetypeId: entry.spawns.archetype,
      firstSpawnSeconds: entry.spawns.firstSpawnSeconds,
      everySeconds: entry.spawns.everySeconds,
      maxConcurrent: entry.spawns.maxConcurrent,
      ringRadiusTiles:
        entry.spawns.placement.ringRadiusFraction * ARENA.radiusTiles,
      goldenAngleRadians: degreesToRadians(
        entry.spawns.placement.goldenAngleDegrees,
      ),
    },
    maxConcurrentMinions: AUTHORED_ENCOUNTER_DATA.maxConcurrentMinions,
    simulation: AUTHORED_ENCOUNTER_DATA.simulation,
    arena: ARENA,
    player: {
      spawnTiles: AUTHORED_ENCOUNTER_DATA.player.spawnTiles,
      verticesTiles: scaleBody(
        loadOutline(AUTHORED_ENCOUNTER_DATA.player.body.shape),
        AUTHORED_ENCOUNTER_DATA.player.body.widthTiles,
        AUTHORED_ENCOUNTER_DATA.player.body.heightTiles,
      ),
    },
    primaryArchetypeId: entry.primaryArchetype,
    archetypes: STATIC_ARCHETYPES,
    projectiles: STATIC_PROJECTILES,
    camera: AUTHORED_ENCOUNTER_DATA.camera,
    session: entry.session,
    presentation: AUTHORED_ENCOUNTER_DATA.presentation,
  };
}

/** One runtime config per authored encounter (K14); the Crystal Worm keeps its debug-tunable build. */
export const ENCOUNTER_CONFIGS: Readonly<Record<string, EncounterConfig>> =
  Object.freeze(
    Object.fromEntries(
      Object.keys(AUTHORED_ENCOUNTER_DATA.encounters).map((id) => [
        id,
        id === "crystal-worm" ? ENCOUNTER_CONFIG : buildStaticEncounterConfig(id),
      ]),
    ),
  );

export const DEFAULT_ENCOUNTER_ID = AUTHORED_ENCOUNTER_DATA.defaultEncounter;

/** The Home screen's selectable list (K14): one entry per encounter, in authored order. */
export const ENCOUNTER_LIST: readonly Readonly<{
  id: string;
  displayName: string;
}>[] = Object.freeze(
  Object.entries(AUTHORED_ENCOUNTER_DATA.encounters).map(([id, entry]) => ({
    id,
    displayName: entry.displayName,
  })),
);

/** Resolves an encounter id to its runtime config, rejecting an unknown one. */
export function encounterConfigOf(id: string): EncounterConfig {
  const config = ENCOUNTER_CONFIGS[id];
  if (!config) throw new RangeError(`Unknown encounter: ${id}`);
  return config;
}

/**
 * Worst-case live shards for one enemy of this archetype: every shard emitted
 * within one shard lifetime. Replaces the retired study's stale literal, and
 * step 17.4 asserts the browser bound against this rather than a hand-picked
 * number.
 */
/** A projectile's lifetime, however its motion kind derives it. */
function lifetimeSecondsOf(projectile: ProjectileSpec): number {
  const { motion } = projectile;
  if (motion.kind === "boomerang") return motion.lifetimeSeconds;
  if (motion.kind === "lob") return motion.travelSeconds;
  return motion.rangeTiles / projectile.speedTilesPerSecond;
}

/**
 * Worst case across every attack of this archetype, summed: each attack
 * fires on its own clock, so an enemy's shard bound is the sum of its
 * attacks' individual bounds, not just the first attack's (G: step 20.1
 * keeps exactly one attack per archetype; this sum already generalises
 * correctly once step 20.2 allows more).
 */
/** Shots one volley of this pattern fires at once. */
function shotsPerVolley(pattern: AttackPattern): number {
  return pattern.kind === "ring" ? pattern.arms : pattern.shots;
}

/** Worst-case concurrently-live shards one authored attack can sustain. */
export function attackShardBound(
  config: EncounterConfig,
  attack: AttackSpec,
): number {
  const { pattern, cadence } = attack;
  const projectile = projectileOf(config, attack.projectileId);
  const groupSeconds =
    (cadence.shotsPerBurst - 1) * cadence.shotIntervalSeconds +
    cadence.cooldownAfterLastShotSeconds;
  return (
    shotsPerVolley(pattern) *
    cadence.shotsPerBurst *
    Math.ceil(lifetimeSecondsOf(projectile) / groupSeconds)
  );
}

/** Sum across a concurrently-firing attack set (phase or sub-phase). */
function attackSetShardBound(
  config: EncounterConfig,
  attacks: readonly AttackSpec[],
): number {
  return attacks.reduce(
    (total, attack) => total + attackShardBound(config, attack),
    0,
  );
}

/**
 * Only one phase is ever active per enemy at a time, so the bound is the
 * worst case across an enemy's own phase - the max over phases. Within a
 * phase its own attacks and at most one sub-phase fire concurrently, so a
 * phase's bound sums its own attacks with the max across its sub-phases.
 */
export function liveShardBoundPerEnemy(
  config: EncounterConfig,
  archetype: EnemyArchetype,
): number {
  return Math.max(
    ...archetype.phases.map((phase) => {
      const subPhaseMax = phase.subPhases?.length
        ? Math.max(
            ...phase.subPhases.map((subPhase) =>
              attackSetShardBound(config, subPhase.attacks),
            ),
          )
        : 0;
      return attackSetShardBound(config, phase.attacks) + subPhaseMax;
    }),
  );
}

/**
 * Per encounter: the primary archetype's own bound times its max concurrent
 * enemy count, plus every minion archetype's bound times the shared
 * `maxConcurrentMinions` cap (step 24.1).
 */
export function liveShardBoundForEncounter(config: EncounterConfig): number {
  const primaryBound =
    liveShardBoundPerEnemy(config, primaryArchetype(config)) *
    config.spawns.maxConcurrent;
  const minionBound = Object.entries(config.archetypes)
    .filter(([id]) => id !== config.primaryArchetypeId)
    .reduce(
      (total, [, archetype]) =>
        total + liveShardBoundPerEnemy(config, archetype),
      0,
    );
  return primaryBound + minionBound * config.maxConcurrentMinions;
}

/**
 * Conservative live collision-part bound: the shard bound times the largest
 * compound body in the catalog. The hive shot currently supplies the largest
 * body (58 rectangles), so this is a derived cap rather than a round number.
 */
export function liveCollisionPartBoundForEncounter(
  config: EncounterConfig,
): number {
  const largestBody = Math.max(
    ...Object.values(config.projectiles).map(
      (projectile) => projectile.collisionPartsTiles.length,
    ),
  );
  return liveShardBoundForEncounter(config) * largestBody;
}

/** Resolves an archetype by id, rejecting an unknown one. */
export function archetypeOf(
  config: EncounterConfig,
  id: string,
): EnemyArchetype {
  const archetype = config.archetypes[id];
  if (!archetype) throw new RangeError(`Unknown enemy archetype: ${id}`);
  return archetype;
}

/** Resolves a catalog projectile by id, rejecting an unknown one. */
export function projectileOf(
  config: EncounterConfig,
  id: string,
): ProjectileSpec {
  const projectile = config.projectiles[id];
  if (!projectile) throw new RangeError(`Unknown projectile: ${id}`);
  return projectile;
}

/** The single archetype this slice ships (G04). */
export function primaryArchetype(config: EncounterConfig): EnemyArchetype {
  return archetypeOf(config, config.primaryArchetypeId);
}

function assertPositive(value: number, name: string): void {
  assertNonnegative(value, name);
  if (value === 0) throw new RangeError(`${name} must be positive`);
}

function validatePoint(point: Vector2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Tile coordinates must be finite");
  }
}

export function validateEncounterConfig(config: EncounterConfig): void {
  if (config.rulesVersion.trim().length === 0)
    throw new RangeError("rulesVersion must not be empty");
  const positiveValues = {
    fixedStepSeconds: config.simulation.fixedStepSeconds,
    maxStepsPerUpdate: config.simulation.maxStepsPerUpdate,
    arenaRadiusTiles: config.arena.radiusTiles,
    cssPixelsPerTile: config.camera.cssPixelsPerTile,
    minZoom: config.camera.minZoom,
    maxZoom: config.camera.maxZoom,
    defaultZoom: config.camera.defaultZoom,
    zoomStep: config.camera.zoomStep,
    historyLimit: config.session.historyLimit,
    lobTelegraphSeconds: config.presentation.lobTelegraphSeconds,
  };
  for (const [name, value] of Object.entries(positiveValues))
    assertPositive(value, name);
  for (const count of [
    config.simulation.maxStepsPerUpdate,
    config.session.historyLimit,
  ]) {
    if (!Number.isSafeInteger(count))
      throw new RangeError("Counts must be safe integers");
  }
  assertNonnegative(
    config.session.startCountdownSeconds,
    "startCountdownSeconds",
  );
  assertNonnegative(
    config.session.retryCountdownSeconds,
    "retryCountdownSeconds",
  );
  if (
    config.camera.minZoom > config.camera.maxZoom ||
    config.camera.defaultZoom < config.camera.minZoom ||
    config.camera.defaultZoom > config.camera.maxZoom
  ) {
    throw new RangeError("Default zoom must be within ordered zoom bounds");
  }
  validatePoint(config.arena.centerTiles);
  validatePoint(config.player.spawnTiles);
  if (
    !convexBodyFitsCircle(
      transformBodyVertices(
        config.player.verticesTiles,
        config.player.spawnTiles,
      ),
      config.arena,
    )
  ) {
    throw new RangeError("Entity collision extent must spawn inside the arena");
  }
  const spawns = config.spawns;
  assertNonnegative(spawns.firstSpawnSeconds, "firstSpawnSeconds");
  // `null` means the opening spawn is never repeated (K10: a single boss).
  if (spawns.everySeconds !== null)
    assertPositive(spawns.everySeconds, "spawnEverySeconds");
  assertPositive(spawns.maxConcurrent, "maxConcurrentEnemies");
  if (!Number.isSafeInteger(spawns.maxConcurrent))
    throw new RangeError("maxConcurrentEnemies must be a safe integer");
  assertPositive(config.maxConcurrentMinions, "maxConcurrentMinions");
  if (!Number.isSafeInteger(config.maxConcurrentMinions))
    throw new RangeError("maxConcurrentMinions must be a safe integer");
  assertPositive(spawns.ringRadiusTiles, "spawnRingRadiusTiles");
  if (spawns.ringRadiusTiles >= config.arena.radiusTiles)
    throw new RangeError("Spawn ring must lie inside the arena");
  if (!Number.isFinite(spawns.goldenAngleRadians))
    throw new RangeError("goldenAngleRadians must be finite");
  if (!config.archetypes[spawns.archetypeId])
    throw new RangeError("spawns.archetypeId must name a defined archetype");
  const spawnBody = config.archetypes[spawns.archetypeId].verticesTiles;
  const farthestVertexTiles = Math.max(
    ...spawnBody.map((vertex) => Math.hypot(vertex.x, vertex.y)),
  );
  if (spawns.ringRadiusTiles + farthestVertexTiles > config.arena.radiusTiles)
    throw new RangeError("Spawn ring must keep the body inside the arena");

  const ids = Object.keys(config.archetypes);
  if (ids.length === 0)
    throw new RangeError("At least one enemy archetype is required");
  if (!config.archetypes[config.primaryArchetypeId])
    throw new RangeError("primaryArchetypeId must name a defined archetype");
  for (const id of ids) validateArchetype(config, config.archetypes[id]);
}

function validateProjectileSpec(projectile: ProjectileSpec): void {
  const { motion } = projectile;
  assertNonnegative(projectile.damageHp, "shardDamageHp");
  assertNonnegative(projectile.speedTilesPerSecond, "shardSpeedTilesPerSecond");
  transformBodyVertices(projectile.verticesTiles, { x: 0, y: 0 });
  validateConvexParts(projectile.collisionPartsTiles);
  if (motion.kind === "boomerang") {
    assertPositive(motion.reversalAgeSeconds, "reversalAgeSeconds");
    assertPositive(motion.lifetimeSeconds, "lifetimeSeconds");
    if (motion.reversalAgeSeconds >= motion.lifetimeSeconds)
      throw new RangeError(
        "Shard reversal must be strictly within its lifetime",
      );
  } else if (motion.kind === "lob") {
    assertPositive(motion.travelSeconds, "travelSeconds");
    assertPositive(motion.detonationRadiusTiles, "detonationRadiusTiles");
  } else {
    assertPositive(motion.rangeTiles, "rangeTiles");
  }
  if (projectile.expiration !== "lifetime-only")
    throw new RangeError("Shards must expire by lifetime only");
  if (projectile.hitPolicy !== "once-per-shard")
    throw new RangeError("Shards must hit the player at most once");
}

/** Validates the optional ring extensions on a runtime config. */
function validateRingPatternOptions(pattern: RingPattern): void {
  if (
    pattern.perBurstAdvanceDegrees !== undefined &&
    !Number.isFinite(pattern.perBurstAdvanceDegrees)
  )
    throw new RangeError("perBurstAdvanceDegrees must be finite");

  if (pattern.gapSectorsDegrees !== undefined) {
    if (!Array.isArray(pattern.gapSectorsDegrees))
      throw new RangeError("gapSectorsDegrees must be an array of pairs");
    for (const sector of pattern.gapSectorsDegrees as readonly unknown[]) {
      if (!Array.isArray(sector) || sector.length !== 2)
        throw new RangeError(
          "Each gap sector must be a two-element [fromDegrees, toDegrees] pair",
        );
      const [fromDegrees, toDegrees] = sector as readonly unknown[];
      if (
        typeof fromDegrees !== "number" ||
        !Number.isFinite(fromDegrees) ||
        typeof toDegrees !== "number" ||
        !Number.isFinite(toDegrees)
      )
        throw new RangeError("Gap sector bounds must be finite numbers");
      if (sectorWidthDegrees(fromDegrees, toDegrees) >= 360)
        throw new RangeError("A gap sector must be narrower than 360 degrees");
    }
    if (totalCoverageDegrees(pattern.gapSectorsDegrees) >= 360)
      throw new RangeError(
        "Total gap coverage must leave at least some of the circle un-gapped",
      );
  }

  const rate = pattern.armSpreadDegreesPerSecond;
  const maximum = pattern.maxArmSpreadDegrees;
  if (rate !== undefined && !Number.isFinite(rate))
    throw new RangeError("armSpreadDegreesPerSecond must be finite");
  if (maximum !== undefined) {
    if (!Number.isFinite(maximum))
      throw new RangeError("maxArmSpreadDegrees must be finite");
    if (maximum < 0)
      throw new RangeError("maxArmSpreadDegrees must be nonnegative");
    if (pattern.arms > 1 && maximum >= firstArmCollisionDegrees(pattern.arms))
      throw new RangeError(
        "maxArmSpreadDegrees must stay below the first spread that makes two arms share a bearing",
      );
  }
  if (rate !== undefined && rate !== 0 && maximum === undefined)
    throw new RangeError(
      "maxArmSpreadDegrees must be present when armSpreadDegreesPerSecond is nonzero",
    );
}

function validateAttackSpec(
  config: EncounterConfig,
  attack: AttackSpec,
): void {
  validateProjectileSpec(projectileOf(config, attack.projectileId));
  const { pattern, cadence } = attack;
  // Strictly positive: a zero here would make the attack degenerate (an
  // infinite fire rate or no shots).
  const positiveValues = {
    shotsPerVolley: shotsPerVolley(pattern),
    shotsPerEmitter: cadence.shotsPerBurst,
    shotIntervalSeconds: cadence.shotIntervalSeconds,
    cooldownAfterLastShotSeconds: cadence.cooldownAfterLastShotSeconds,
  };
  for (const [name, value] of Object.entries(positiveValues))
    assertPositive(value, name);
  assertNonnegative(cadence.initialDelaySeconds, "initialCooldownSeconds");
  for (const count of [shotsPerVolley(pattern), cadence.shotsPerBurst]) {
    if (!Number.isSafeInteger(count))
      throw new RangeError("Counts must be safe integers");
  }
  if (pattern.kind === "ring") {
    // Nonnegative: zero is a meaningful, supported value - an idle emitter.
    assertNonnegative(pattern.emitterRadiusTiles, "emitterRadiusTiles");
    // Signed: negative rotation is counter-clockwise, zero is no rotation.
    if (!Number.isFinite(pattern.clockwiseDegreesPerSecond))
      throw new RangeError("clockwiseDegreesPerSecond must be finite");
    if (!Number.isFinite(pattern.initialPhaseRadians))
      throw new RangeError("initialPhaseRadians must be finite");
    validateRingPatternOptions(pattern);
  } else if (pattern.kind === "spread") {
    assertNonnegative(pattern.emitterRadiusTiles, "emitterRadiusTiles");
    assertNonnegative(pattern.arcDegrees, "arcDegrees");
    if (pattern.arcDegrees >= 360)
      throw new RangeError("A spread's arcDegrees must be below 360 degrees");
    if (pattern.aim === "fixed" && !Number.isFinite(pattern.fixedBearingDegrees))
      throw new RangeError("fixedBearingDegrees must be finite");
  } else {
    assertNonnegative(pattern.emitterRadiusTiles, "emitterRadiusTiles");
    assertPositive(pattern.coneDegrees, "coneDegrees");
    if (pattern.coneDegrees > 360)
      throw new RangeError("A scatter's coneDegrees must be at most 360 degrees");
    if (pattern.aim === "fixed" && !Number.isFinite(pattern.fixedBearingDegrees))
      throw new RangeError("fixedBearingDegrees must be finite");
  }
}

/**
 * The speed a movement kind travels at, where it moves at all: the field a
 * caller overriding the active movement (the `chaseArenaCenter` debug toggle)
 * needs regardless of which kind the archetype authors.
 */
export function movementSpeedTilesPerSecond(movement: MovementSpec): number {
  switch (movement.kind) {
    case "chase":
    case "move-to-point":
    case "wander":
      return movement.speedTilesPerSecond;
    case "orbit":
      return movement.approachSpeedTilesPerSecond;
    case "stationary":
      return 0;
  }
}

/** Validates one archetype's authored movement kind and its own fields. */
function validateMovementSpec(movement: MovementSpec): void {
  if (movement.kind === "chase" || movement.kind === "move-to-point") {
    // Nonnegative, not strictly positive: the debug panel's chase-speed
    // slider spans down to 0 (G: F3), and only the shipped encounter's own
    // rule (validateShippedEncounter) holds a chase speed below the Paladin's.
    assertNonnegative(movement.speedTilesPerSecond, "speedTilesPerSecond");
    if (movement.kind === "move-to-point" && movement.target !== "arena-center")
      throw new RangeError('move-to-point target must be "arena-center"');
  } else if (movement.kind === "orbit") {
    assertPositive(movement.radiusTiles, "orbitRadiusTiles");
    assertPositive(movement.degreesPerSecond, "orbitDegreesPerSecond");
    assertPositive(
      movement.approachSpeedTilesPerSecond,
      "orbitApproachSpeedTilesPerSecond",
    );
    if (movement.direction !== "cw" && movement.direction !== "ccw")
      throw new RangeError('orbit direction must be "cw" or "ccw"');
    const tangentialSpeedTilesPerSecond =
      movement.radiusTiles * degreesToRadians(movement.degreesPerSecond);
    if (
      tangentialSpeedTilesPerSecond >= PALADIN_DERIVED_STATS.speedTilesPerSecond
    )
      throw new RangeError(
        "An orbit's tangential speed must stay below the Paladin's",
      );
  } else if (movement.kind === "wander") {
    assertPositive(movement.speedTilesPerSecond, "speedTilesPerSecond");
    assertPositive(movement.retargetSeconds, "retargetSeconds");
    assertPositive(movement.radiusTiles, "wanderRadiusTiles");
  } else if (movement.kind !== "stationary") {
    throw new RangeError(
      `Unknown movement kind: ${(movement as { kind: string }).kind}`,
    );
  }
}

/** Resolves one enemy's active progression: an authored phase override, else its archetype's. */
export function resolveProgression(
  archetype: EnemyArchetype,
  phaseOverride?: Progression | null,
): Progression {
  return phaseOverride ?? archetype.health?.progression ?? { kind: "none" };
}

function validateProgressionSpec(progression: Progression): void {
  if (progression.kind === "simulated-dps")
    assertPositive(progression.hpPerSecond, "hpPerSecond");
  else if (progression.kind !== "none")
    throw new RangeError(
      `Unknown progression kind: ${(progression as { kind: string }).kind}`,
    );
}

function validateHealthSpec(health: HealthSpec): void {
  assertPositive(health.maxHealthHp, "maxHealthHp");
  validateProgressionSpec(health.progression);
}

function validateSubPhaseSpec(
  config: EncounterConfig,
  subPhase: SubPhaseSpec,
): void {
  for (const attack of subPhase.attacks) validateAttackSpec(config, attack);
  if (subPhase.movement !== null) validateMovementSpec(subPhase.movement);
  assertPositive(subPhase.durationSeconds, "durationSeconds");
  assertNonnegative(subPhase.telegraphSeconds, "telegraphSeconds");
  assertNonnegative(
    subPhase.invulnerableOnEnterSeconds,
    "invulnerableOnEnterSeconds",
  );
  if (subPhase.spawns !== null) {
    if (subPhase.spawns.length === 0)
      throw new RangeError("spawns must not be an empty array");
    for (const spawn of subPhase.spawns) validateSpawnSpec(config, spawn);
  }
}

function validateSpawnSpec(
  config: EncounterConfig,
  spawn: PhaseSpawnSpec,
): void {
  if (!Number.isSafeInteger(spawn.count) || spawn.count <= 0)
    throw new RangeError("spawn count must be a positive safe integer");
  if (spawn.count > config.maxConcurrentMinions)
    throw new RangeError("spawn count must not exceed maxConcurrentMinions");
  if (!config.archetypes[spawn.archetypeId])
    throw new RangeError("spawn archetypeId must name a defined archetype");
  const spawnedPhases = config.archetypes[spawn.archetypeId].phases;
  if (
    !Number.isSafeInteger(spawn.startPhaseIndex) ||
    spawn.startPhaseIndex < 0 ||
    spawn.startPhaseIndex >= spawnedPhases.length
  )
    throw new RangeError(
      "spawn startPhaseIndex must index the spawned archetype's phases",
    );
  if (spawn.placement.kind === "ring-around-owner")
    assertPositive(spawn.placement.radiusTiles, "radiusTiles");
  else {
    assertPositive(spawn.placement.ringRadiusFraction, "ringRadiusFraction");
    if (spawn.placement.ringRadiusFraction >= 1)
      throw new RangeError("ringRadiusFraction must be inside the arena, below 1");
  }
}

function validatePhaseSpec(config: EncounterConfig, phase: PhaseSpec): void {
  for (const attack of phase.attacks) validateAttackSpec(config, attack);
  validateMovementSpec(phase.movement);
  if (phase.progression !== null) validateProgressionSpec(phase.progression);
  assertNonnegative(phase.telegraphSeconds, "telegraphSeconds");
  assertNonnegative(
    phase.invulnerableOnEnterSeconds,
    "invulnerableOnEnterSeconds",
  );
  if (phase.exitAfterSeconds !== null)
    assertPositive(phase.exitAfterSeconds, "exitAfterSeconds");
  if (!TELEGRAPH_COLOR_NAMES.includes(phase.telegraphColor))
    throw new RangeError(`Unknown telegraph colour: ${phase.telegraphColor}`);
  if (phase.subPhases !== null) {
    if (phase.subPhases.length === 0)
      throw new RangeError("subPhases must not be an empty array");
    for (const subPhase of phase.subPhases)
      validateSubPhaseSpec(config, subPhase);
  }
  if (phase.spawns !== null) {
    if (phase.spawns.length === 0)
      throw new RangeError("spawns must not be an empty array");
    for (const spawn of phase.spawns) validateSpawnSpec(config, spawn);
  }
}

/**
 * Phases are authored in strictly descending `enterAtHpFraction`, with the
 * first fixed at exactly 1 (K09): rejects an empty array, a first fraction
 * other than 1, an ascending or duplicated threshold, and a fraction outside
 * the range (0, 1].
 */
function validatePhases(
  config: EncounterConfig,
  phases: readonly PhaseSpec[],
): void {
  if (phases.length === 0)
    throw new RangeError("An archetype requires at least one phase");
  if (phases[0].enterAtHpFraction !== 1)
    throw new RangeError("The first phase must enter at HP fraction 1");
  let previousPhase: PhaseSpec | null = null;
  for (const phase of phases) {
    if (phase.enterAtHpFraction <= 0 || phase.enterAtHpFraction > 1)
      throw new RangeError("enterAtHpFraction must be in the range (0, 1]");
    // A phase costs no health when it exits by duration instead of by
    // threshold (K08/K09), so the next phase may repeat its entry fraction
    // only in that case - step 23.2's phase 6 into phase 7.
    const repeatsAfterScriptedDuration =
      previousPhase !== null &&
      phase.enterAtHpFraction === previousPhase.enterAtHpFraction &&
      previousPhase.exitAfterSeconds !== null;
    if (
      previousPhase !== null &&
      phase.enterAtHpFraction >= previousPhase.enterAtHpFraction &&
      !repeatsAfterScriptedDuration
    )
      throw new RangeError(
        "Phases must be authored in strictly descending enterAtHpFraction order, unless the previous phase exits by duration",
      );
    previousPhase = phase;
    validatePhaseSpec(config, phase);
  }
}

function validateArchetype(
  config: EncounterConfig,
  archetype: EnemyArchetype,
): void {
  validatePhases(config, archetype.phases);
  if (archetype.health !== undefined) validateHealthSpec(archetype.health);
  // Approved rules, asserted here rather than pinned in the structural type so
  // the type does not forbid the variation it appears to model (G: F10).
  // Contact damage is approved (K17); blocking is not (G16: enemies pass
  // through each other, and pushback is a separate, un-designed mechanic).
  if (archetype.blocksPlayer !== false)
    throw new RangeError("Enemy body blocking is not approved");

  validatePoint(archetype.spawnTiles);
  if (
    !convexBodyFitsCircle(
      transformBodyVertices(archetype.verticesTiles, archetype.spawnTiles),
      config.arena,
    )
  ) {
    throw new RangeError("Entity collision extent must spawn inside the arena");
  }
}

/**
 * The approved gameplay rules for the *shipped* encounter, on top of structural
 * validity. These are deliberately violable from the debug panel - which is why
 * a debug attempt carries DEBUG_RULES_VERSION and is excluded from saved
 * history - so they are asserted here rather than in `validateEncounterConfig`.
 */
export function validateShippedEncounter(config: EncounterConfig): void {
  validateEncounterConfig(config);
  for (const archetype of Object.values(config.archetypes)) {
    for (const phase of archetype.phases) {
      if (
        phase.movement.kind === "chase" &&
        phase.movement.speedTilesPerSecond >=
          PALADIN_DERIVED_STATS.speedTilesPerSecond
      ) {
        throw new RangeError("Enemy pursuit must be slower than the Paladin");
      }
    }
  }
}

validateShippedEncounter(ENCOUNTER_CONFIG);

import type { CircularArena, Vector2 } from "../models";
import {
  AUTHORED_ARCHETYPES,
  AUTHORED_ARENA,
  AUTHORED_ENCOUNTER,
  AUTHORED_PROJECTILES,
  loadOutline,
  type AuthoredBody,
} from "./data";
import { assertNonnegative, PALADIN_DERIVED_STATS } from "./stats";
import {
  constrainBodyToArena,
  convexBodyFitsCircle,
  transformBodyVertices,
} from "../simulation/geometry";

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

export type ProjectileSpec = Readonly<{
  id: string;
  damageHp: number;
  speedTilesPerSecond: number;
  armorPiercing: boolean;
  conditions: readonly unknown[];
  verticesTiles: readonly Vector2[];
  expiration: string;
  hitPolicy: string;
  motion: ProjectileMotion;
}>;

export type RingPattern = Readonly<{
  kind: "ring";
  arms: number;
  emitterRadiusTiles: number;
  initialPhaseRadians: number;
  clockwiseDegreesPerSecond: number;
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

export type EnemyArchetype = Readonly<{
  id: string;
  spawnTiles: Vector2;
  verticesTiles: readonly Vector2[];
  speedTilesPerSecond: number;
  contactDamageHp: number;
  blocksPlayer: boolean;
  attacks: readonly AttackSpec[];
}>;

export type SpawnRule = Readonly<{
  archetypeId: string;
  firstSpawnSeconds: number;
  everySeconds: number;
  maxConcurrent: number;
  ringRadiusTiles: number;
  goldenAngleRadians: number;
}>;

export type EncounterConfig = Readonly<{
  rulesVersion: string;
  spawns: SpawnRule;
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
export const PRIMARY_ARCHETYPE_ID = AUTHORED_ENCOUNTER.primaryArchetype;

const authoredPrimary = AUTHORED_ARCHETYPES[PRIMARY_ARCHETYPE_ID];
// The debug panel tunes exactly one attack; later steps that add a second
// attack to any archetype must not route sliders through this index.
const authoredPrimaryAttack = authoredPrimary.attacks[0];
// The debug panel only ever tunes a ring-kind attack (the shipped Crystal
// Worm spiral); a `spread` attack is additive and not yet debug-tunable.
if (authoredPrimaryAttack.pattern.kind !== "ring")
  throw new RangeError("The debug-tunable attack must use a ring pattern");
const authoredPrimaryPattern = authoredPrimaryAttack.pattern;
const AUTHORED_PROJECTILE_ID = authoredPrimaryAttack.projectile;
const authoredProjectile = AUTHORED_PROJECTILES[AUTHORED_PROJECTILE_ID];
// The debug panel only ever tunes the shipped, boomerang-kind shard (G: 19.3
// adds `linear` to the catalog type, but not to any debug-tunable projectile).
if (authoredProjectile.motion.kind !== "boomerang")
  throw new RangeError("The debug-tunable projectile must use boomerang motion");
const authoredBoomerangMotion = authoredProjectile.motion;

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
  enemySpeedTilesPerSecond: authoredPrimary.speedTilesPerSecond,
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
  projectileWidth: authoredProjectile.body.widthTiles,
  projectileHeight: authoredProjectile.body.heightTiles,
  firstSpawnSeconds: AUTHORED_ENCOUNTER.spawns.firstSpawnSeconds,
  spawnEverySeconds: AUTHORED_ENCOUNTER.spawns.everySeconds,
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
const shardOutline = loadOutline(authoredProjectile.body.shape);

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
    speedTilesPerSecond: values.enemySpeedTilesPerSecond,
    contactDamageHp: authoredPrimary.contactDamageHp,
    blocksPlayer: authoredPrimary.blocksPlayer,
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
  });
  const projectile: ProjectileSpec = Object.freeze({
    id: AUTHORED_PROJECTILE_ID,
    damageHp: values.projectileDamageHp,
    speedTilesPerSecond: values.projectileSpeedTilesPerSecond,
    armorPiercing: authoredProjectile.armorPiercing,
    conditions: authoredProjectile.conditions,
    verticesTiles: scaleBody(
      shardOutline,
      values.projectileWidth,
      values.projectileHeight,
    ),
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

export function liveShardBoundPerEnemy(
  config: EncounterConfig,
  archetype: EnemyArchetype,
): number {
  return archetype.attacks.reduce((total, attack) => {
    const { pattern, cadence } = attack;
    const projectile = projectileOf(config, attack.projectileId);
    const groupSeconds =
      (cadence.shotsPerBurst - 1) * cadence.shotIntervalSeconds +
      cadence.cooldownAfterLastShotSeconds;
    return (
      total +
      shotsPerVolley(pattern) *
        cadence.shotsPerBurst *
        Math.ceil(lifetimeSecondsOf(projectile) / groupSeconds)
    );
  }, 0);
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
  assertPositive(spawns.everySeconds, "spawnEverySeconds");
  assertPositive(spawns.maxConcurrent, "maxConcurrentEnemies");
  if (!Number.isSafeInteger(spawns.maxConcurrent))
    throw new RangeError("maxConcurrentEnemies must be a safe integer");
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

function validateArchetype(
  config: EncounterConfig,
  archetype: EnemyArchetype,
): void {
  if (archetype.attacks.length === 0)
    throw new RangeError("An archetype requires at least one attack");
  for (const attack of archetype.attacks) validateAttackSpec(config, attack);
  // Approved rules, asserted here rather than pinned in the structural type so
  // the type does not forbid the variation it appears to model (G: F10).
  if (archetype.contactDamageHp !== 0)
    throw new RangeError("Contact damage is not approved for this encounter");
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
    if (
      archetype.speedTilesPerSecond >= PALADIN_DERIVED_STATS.speedTilesPerSecond
    ) {
      throw new RangeError("Enemy pursuit must be slower than the Paladin");
    }
  }
}

validateShippedEncounter(ENCOUNTER_CONFIG);

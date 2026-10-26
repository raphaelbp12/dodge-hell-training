import type { CircularArena, Vector2 } from "../models";
import {
  AUTHORED_ARCHETYPES,
  AUTHORED_ARENA,
  AUTHORED_ENCOUNTER,
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

export type EnemyArchetype = Readonly<{
  id: string;
  spawnTiles: Vector2;
  verticesTiles: readonly Vector2[];
  speedTilesPerSecond: number;
  contactDamageHp: number;
  blocksPlayer: boolean;
  weapon: Readonly<{
    emitters: Readonly<{
      count: number;
      radiusTiles: number;
      initialPhaseRadians: number;
      clockwiseDegreesPerSecond: number;
      rotateDuringCooldown: boolean;
    }>;
    burst: Readonly<{
      shotsPerEmitter: number;
      shotIntervalSeconds: number;
      cooldownAfterLastShotSeconds: number;
      initialCooldownSeconds: number;
    }>;
    shard: Readonly<{
      damageHp: number;
      speedTilesPerSecond: number;
      verticesTiles: readonly Vector2[];
      reversalAgeSeconds: number;
      lifetimeSeconds: number;
      expiration: string;
      hitPolicy: string;
    }>;
  }>;
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
}>;

export const RULES_VERSION = AUTHORED_ENCOUNTER.rulesVersion;
export const PRIMARY_ARCHETYPE_ID = AUTHORED_ENCOUNTER.primaryArchetype;

const authoredPrimary = AUTHORED_ARCHETYPES[PRIMARY_ARCHETYPE_ID];

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
  emitterCount: authoredPrimary.weapon.emitters.count,
  emitterRadiusTiles: authoredPrimary.weapon.emitters.radiusTiles,
  initialPhaseDegrees: authoredPrimary.weapon.emitters.initialPhaseDegrees,
  rotationDegreesPerSecond:
    authoredPrimary.weapon.emitters.clockwiseDegreesPerSecond,
  shotsPerEmitter: authoredPrimary.weapon.burst.shotsPerEmitter,
  shotIntervalSeconds: authoredPrimary.weapon.burst.shotIntervalSeconds,
  cooldownSeconds: authoredPrimary.weapon.burst.cooldownAfterLastShotSeconds,
  initialCooldownSeconds: authoredPrimary.weapon.burst.initialCooldownSeconds,
  projectileDamageHp: authoredPrimary.weapon.shard.damageHp,
  projectileSpeedTilesPerSecond:
    authoredPrimary.weapon.shard.speedTilesPerSecond,
  reversalSeconds: authoredPrimary.weapon.shard.reversalAgeSeconds,
  lifetimeSeconds: authoredPrimary.weapon.shard.lifetimeSeconds,
  projectileWidth: authoredPrimary.weapon.shard.body.widthTiles,
  projectileHeight: authoredPrimary.weapon.shard.body.heightTiles,
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
const shardOutline = loadOutline(authoredPrimary.weapon.shard.body.shape);

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
    weapon: Object.freeze({
      emitters: Object.freeze({
        count: values.emitterCount,
        radiusTiles: values.emitterRadiusTiles,
        initialPhaseRadians: degreesToRadians(values.initialPhaseDegrees),
        clockwiseDegreesPerSecond: values.rotationDegreesPerSecond,
        rotateDuringCooldown:
          authoredPrimary.weapon.emitters.rotateDuringCooldown,
      }),
      burst: Object.freeze({
        shotsPerEmitter: values.shotsPerEmitter,
        shotIntervalSeconds: values.shotIntervalSeconds,
        cooldownAfterLastShotSeconds: values.cooldownSeconds,
        initialCooldownSeconds: values.initialCooldownSeconds,
      }),
      shard: Object.freeze({
        damageHp: values.projectileDamageHp,
        speedTilesPerSecond: values.projectileSpeedTilesPerSecond,
        verticesTiles: scaleBody(
          shardOutline,
          values.projectileWidth,
          values.projectileHeight,
        ),
        reversalAgeSeconds: values.reversalSeconds,
        lifetimeSeconds: values.lifetimeSeconds,
        expiration: authoredPrimary.weapon.shard.expiration,
        hitPolicy: authoredPrimary.weapon.shard.hitPolicy,
      }),
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
    camera: AUTHORED_ENCOUNTER.camera,
    session: AUTHORED_ENCOUNTER.session,
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
export function liveShardBoundPerEnemy(archetype: EnemyArchetype): number {
  const { emitters, burst, shard } = archetype.weapon;
  const groupSeconds =
    (burst.shotsPerEmitter - 1) * burst.shotIntervalSeconds +
    burst.cooldownAfterLastShotSeconds;
  return (
    emitters.count *
    burst.shotsPerEmitter *
    Math.ceil(shard.lifetimeSeconds / groupSeconds)
  );
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

function validateArchetype(
  config: EncounterConfig,
  archetype: EnemyArchetype,
): void {
  const { emitters, burst, shard } = archetype.weapon;
  // Strictly positive: a zero here would make the weapon degenerate (an
  // infinite fire rate, no emitters, or a reversal outside the lifetime).
  const positiveValues = {
    emitterCount: emitters.count,
    shotsPerEmitter: burst.shotsPerEmitter,
    shotIntervalSeconds: burst.shotIntervalSeconds,
    cooldownAfterLastShotSeconds: burst.cooldownAfterLastShotSeconds,
    reversalAgeSeconds: shard.reversalAgeSeconds,
    lifetimeSeconds: shard.lifetimeSeconds,
  };
  for (const [name, value] of Object.entries(positiveValues))
    assertPositive(value, name);
  // Nonnegative: zero is a meaningful, supported value - a stationary enemy,
  // immediate first volley, harmless shards or frozen shards. The debug panel
  // exposes each of these at its slider minimum.
  const nonnegativeValues = {
    enemySpeedTilesPerSecond: archetype.speedTilesPerSecond,
    initialCooldownSeconds: burst.initialCooldownSeconds,
    shardDamageHp: shard.damageHp,
    shardSpeedTilesPerSecond: shard.speedTilesPerSecond,
    emitterRadiusTiles: emitters.radiusTiles,
  };
  for (const [name, value] of Object.entries(nonnegativeValues))
    assertNonnegative(value, name);
  // Signed: negative rotation is counter-clockwise, zero is no rotation.
  if (!Number.isFinite(emitters.clockwiseDegreesPerSecond))
    throw new RangeError("clockwiseDegreesPerSecond must be finite");
  transformBodyVertices(shard.verticesTiles, { x: 0, y: 0 });
  for (const count of [emitters.count, burst.shotsPerEmitter]) {
    if (!Number.isSafeInteger(count))
      throw new RangeError("Counts must be safe integers");
  }
  if (!Number.isFinite(emitters.initialPhaseRadians))
    throw new RangeError("initialPhaseRadians must be finite");
  if (shard.reversalAgeSeconds >= shard.lifetimeSeconds)
    throw new RangeError("Shard reversal must be strictly within its lifetime");
  // Approved rules, asserted here rather than pinned in the structural type so
  // the type does not forbid the variation it appears to model (G: F10).
  if (archetype.contactDamageHp !== 0)
    throw new RangeError("Contact damage is not approved for this encounter");
  if (archetype.blocksPlayer !== false)
    throw new RangeError("Enemy body blocking is not approved");
  if (!emitters.rotateDuringCooldown)
    throw new RangeError("Emitters must rotate during cooldown");
  if (shard.expiration !== "lifetime-only")
    throw new RangeError("Shards must expire by lifetime only");
  if (shard.hitPolicy !== "once-per-shard")
    throw new RangeError("Shards must hit the player at most once");

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

import {
  constrainBodyToArena,
  convexPartsBoundingRadiusTiles,
  pointOnRing,
  pursueBody,
  sweptConvexOverlap,
  transformBodyVertices,
} from "./geometry";
import {
  applyConditions,
  createConditionSeconds,
  effectiveDefenseFor,
  effectiveInput,
  hasCondition,
  playerTravelTiles,
  tickConditions,
  type ConditionApplication,
} from "./conditions";
import {
  archetypeOf,
  degreesToRadians,
  ENCOUNTER_CONFIG,
  movementSpeedTilesPerSecond,
  PRIMARY_ARCHETYPE_ID,
  bombOf,
  bulletOf,
  projectileOf,
  type AttackSpec,
  type EncounterConfig,
  type EnemyArchetype,
  type MovementSpec,
  type SpawnRule,
} from "../config/encounter";
import {
  advanceShard,
  createShard,
  restampLiveShards,
  shardOverlapsPlayer,
} from "./projectiles";
import { advanceBomb, createBomb } from "./bombs";
import { resolveBearings, scatterDrawCount } from "./patterns";
import {
  DEFAULT_DEBUG_SETTINGS,
  DEBUG_RULES_VERSION,
  debugEncounterConfig,
  isDefaultDebugSettings,
  validateDebugSettings,
  type DebugSettings,
} from "../config/debug";
import {
  assertNonnegative,
  PALADIN_STATS,
} from "../config/stats";
import {
  drillRulesVersion,
  normalizeDrillSelection,
} from "../config/drill";
import type {
  AcceptedHit,
  AttackClockState,
  Arena,
  DrillSelection,
  EnemyState,
  PlayerState,
  BombState,
  ShardState,
  SimulationInput,
  Vector2,
} from "../models";
import { applyPlayerHit, regeneratePlayer } from "./health";
import {
  activeAttacks,
  activeMovement,
  applyPhaseTransitions,
  applyProgression,
  createAttackClocks,
  enterDrillPhase,
  resolveEntrySpawns,
} from "./phases";
import { arbitrarySeed, assertSeed, nextSeed, unitFromSeed } from "./random";
import {
  honeyAt,
  HONEY_DAMAGE_HP,
  HONEY_DAMAGE_INTERVAL_SECONDS,
} from "./terrain";

export type SimulationState = {
  config: EncounterConfig;
  debugSettings: DebugSettings;
  collisionBoundingRadiusTiles: number;
  nextShardId: number;
  nextEnemyId: number;
  /** Elapsed time of the next scheduled spawn. */
  nextSpawnSeconds: number;
  /** Generator cursor. Plain data, so the state stays structuredClone-able. */
  randomSeed: number;
  rulesVersion: string;
  /**
   * The active drill selection: a sorted set of top-level phases plus a Loop
   * flag. `null` is the normal full fight. Only the primary enemy is drilled.
   */
  drill: DrillSelection | null;
  /** "ended" means the player died; "cleared" means a drained boss's health reached zero. */
  phase: "playing" | "ended" | "cleared";
  hitsTaken: number;
  player: PlayerState;
  /** Insertion-ordered so a fixed input sequence stays reproducible. */
  enemies: EnemyState[];
  shards: ShardState[];
  /** Bombs live apart from shards (N22) but share their id sequence (N23). */
  bombs: BombState[];
  ticksElapsed: number;
  elapsedSeconds: number;
  accumulatorSeconds: number;
};

export type DetonationEvent = Readonly<{
  projectileId: string;
  positionTiles: Vector2;
  radiusTiles: number;
}>;

export type AdvanceResult = Readonly<{
  stepsExecuted: number;
  discardedSeconds: number;
  acceptedHits: readonly AcceptedHit[];
  detonations: readonly DetonationEvent[];
}>;

const timeRoundingToleranceSeconds =
  ENCOUNTER_CONFIG.simulation.fixedStepSeconds * Number.EPSILON * 16;
const fullTurnRadians = 2 * Math.PI;

/** Broadphase bound: player body plus the largest compound body across the projectile catalog. */
function boundingRadiusTiles(config: EncounterConfig): number {
  const radius = (vertices: readonly Vector2[]): number =>
    Math.max(...vertices.map((vertex) => Math.hypot(vertex.x, vertex.y)));
  return (
    radius(config.player.verticesTiles) +
    Math.max(
      ...Object.values(config.projectiles).map((projectile) =>
        convexPartsBoundingRadiusTiles(projectile.collisionPartsTiles),
      ),
    )
  );
}
/**
 * Builds one enemy instance with one attack clock per authored attack, each
 * anchored at the enemy's spawn time, so a later arrival serves its own
 * initial cooldown. Clocks are built in authored order, which is also the
 * order shards are pushed in, so a fixed input sequence stays reproducible.
 */
export type CreateEnemyOptions = Readonly<{
  /** K18: the phase index a spawned minion begins in, instead of its archetype's phase 0. */
  startPhaseIndex?: number;
  spawnedByEnemyId?: number | null;
  despawnOnExit?: boolean;
}>;

export function createEnemy(
  config: EncounterConfig,
  archetypeId: string,
  id: number,
  spawnedAtSeconds: number,
  positionTiles?: Vector2,
  options: CreateEnemyOptions = {},
): EnemyState {
  const archetype = archetypeOf(config, archetypeId);
  const phaseIndex = options.startPhaseIndex ?? 0;
  const phase = archetype.phases[phaseIndex];
  // A phase with sub-phases is anchored as if the enemy had just entered its
  // first sub-phase (step 22.4), the same entry effects `enterSubPhase` would
  // apply; a phase with none behaves exactly as step 22.3 left it.
  const subPhase = phase.subPhases?.[0] ?? null;
  const attacks = subPhase ? [...phase.attacks, ...subPhase.attacks] : phase.attacks;
  const telegraphSeconds = subPhase?.telegraphSeconds ?? phase.telegraphSeconds;
  const invulnerableOnEnterSeconds =
    subPhase?.invulnerableOnEnterSeconds ?? phase.invulnerableOnEnterSeconds;
  return {
    id,
    archetypeId,
    positionTiles: { ...(positionTiles ?? archetype.spawnTiles) },
    headingRadians: ((archetype.initialHeadingDegrees ?? 0) * Math.PI) / 180,
    spawnedAtSeconds,
    attackClocks: createAttackClocks(
      attacks,
      spawnedAtSeconds + telegraphSeconds,
    ),
    nextContactEligibleSeconds: spawnedAtSeconds,
    movementPhaseRadians: 0,
    wanderTargetTiles: null,
    // Due immediately: the first movement tick after spawn draws a wander
    // enemy's opening target rather than leaving it stuck at null.
    wanderRetargetAtSeconds: spawnedAtSeconds,
    healthHp: archetype.health?.maxHealthHp ?? null,
    maxHealthHp: archetype.health?.maxHealthHp ?? null,
    invulnerableUntilSeconds: spawnedAtSeconds + invulnerableOnEnterSeconds,
    phaseIndex,
    phaseEnteredAtSeconds: spawnedAtSeconds,
    subPhaseIndex: 0,
    subPhaseEnteredAtSeconds: spawnedAtSeconds,
    spawnedByEnemyId: options.spawnedByEnemyId ?? null,
    despawnOnExit: options.despawnOnExit ?? false,
  };
}

/** `startPhaseIndex` and `loopPhase` are compatibility aliases for `drill`. */
export type CreateSimulationOptions = Readonly<{
  /** The drill to start and loop; absent means the normal full fight. */
  drill?: DrillSelection | null;
  /** Legacy alias: the phase the primary enemy starts in. */
  startPhaseIndex?: number;
  /** Legacy alias: when true, the drilled phase re-enters itself on exit. */
  loopPhase?: boolean;
}>;

export function createSimulation(
  config: EncounterConfig = ENCOUNTER_CONFIG,
  seed: number = arbitrarySeed(),
  options: CreateSimulationOptions = {},
): SimulationState {
  const primaryPhaseCount =
    archetypeOf(config, config.primaryArchetypeId).phases.length;
  const hasExplicitDrill = options.drill !== undefined;
  const explicitDrill = hasExplicitDrill
    ? normalizeDrillSelection(options.drill, primaryPhaseCount)
    : null;
  // The legacy `startPhaseIndex` without `loopPhase` keeps its old
  // start-and-continue behaviour: it starts in that phase but is not an active
  // drill, so authored progression continues. `loopPhase` still arms the old
  // single-phase loop. The explicit `drill` option is the one-shot/group model.
  const legacyDrill =
    !hasExplicitDrill && options.startPhaseIndex !== undefined
      ? normalizeDrillSelection(
          {
            phaseIndices: [options.startPhaseIndex],
            loop: options.loopPhase ?? false,
          },
          primaryPhaseCount,
        )
      : null;
  const drill = explicitDrill ?? (legacyDrill?.loop ? legacyDrill : null);
  const startPhaseIndex = hasExplicitDrill
    ? explicitDrill?.phaseIndices[0]
    : options.startPhaseIndex;
  const rulesVersion = hasExplicitDrill
    ? drillRulesVersion(config.rulesVersion, explicitDrill)
    : options.startPhaseIndex !== undefined
      ? `${config.rulesVersion}-drill-p${options.startPhaseIndex}`
      : config.rulesVersion;
  const state: SimulationState = {
    config,
    debugSettings: DEFAULT_DEBUG_SETTINGS,
    collisionBoundingRadiusTiles: boundingRadiusTiles(config),
    nextShardId: 1,
    nextEnemyId: 1,
    nextSpawnSeconds: config.spawns.firstSpawnSeconds,
    randomSeed: assertSeed(seed),
    rulesVersion,
    drill,
    phase: "playing",
    hitsTaken: 0,
    player: {
      positionTiles: { ...config.player.spawnTiles },
      healthHp: PALADIN_STATS.healthHp,
      combatRemainingSeconds: 0,
      conditionSeconds: createConditionSeconds(),
      honeyContactSeconds: 0,
      nextHoneyDamageAtSeconds: 0,
    },
    enemies: [],
    shards: [],
    bombs: [],
    ticksElapsed: 0,
    elapsedSeconds: 0,
    accumulatorSeconds: 0,
  };
  // The opening enemy is schedule index 0, created through the same routine as
  // every later spawn, so there is no special-cased initial enemy (G18).
  const enemy = spawnEnemy(state);
  if (enemy && startPhaseIndex !== undefined)
    enterDrillPhase(
      state,
      enemy,
      archetypeOf(config, config.primaryArchetypeId),
      startPhaseIndex,
    );
  return state;
}

/**
 * Places and appends one enemy on the spawn ring.
 *
 * The chosen bearing is the one diametrically opposite the player's bearing
 * from the arena centre, offset by the golden angle per concurrent spawn so two
 * enemies never land on the same point (G12, G15). When the player stands
 * exactly at the centre that bearing is undefined - which is the case at t = 0,
 * the default opening - so the bearing is drawn from the injected generator
 * (G13, G14).
 */
/** Advances the simulation's generator cursor and returns a value in [0, 1). */
function nextUnitRandom(state: SimulationState): number {
  state.randomSeed = nextSeed(state.randomSeed);
  return unitFromSeed(state.randomSeed);
}

/**
 * Resolves where the encounter's opening spawn (and every later repeat of
 * it) should appear, dispatching on the encounter's authored placement rule
 * (step 40.1). Shared by `spawnEnemy` and, reused rather than recomputed, by
 * `applyDrill`'s live-switch reposition (step 40.2).
 */
export function resolveSpawnPosition(
  state: SimulationState,
  spawns: SpawnRule,
  arena: Arena,
): Vector2 {
  if (spawns.placement.rule === "arena-center") return arena.shape.centerTiles;
  const offsetX = state.player.positionTiles.x - arena.shape.centerTiles.x;
  const offsetY = state.player.positionTiles.y - arena.shape.centerTiles.y;
  const distanceTiles = Math.hypot(offsetX, offsetY);
  const awayBearing =
    distanceTiles === 0
      ? nextUnitRandom(state) * fullTurnRadians
      : Math.atan2(offsetY, offsetX) + Math.PI;
  const bearing =
    awayBearing + state.enemies.length * spawns.goldenAngleRadians;
  return pointOnRing(
    arena.shape.centerTiles,
    spawns.placement.ringRadiusTiles,
    bearing,
  );
}

export function spawnEnemy(state: SimulationState): EnemyState | null {
  const { spawns, arena } = state.config;
  if (state.enemies.length >= spawns.maxConcurrent) return null;
  const enemy = createEnemy(
    state.config,
    spawns.archetypeId,
    state.nextEnemyId++,
    state.elapsedSeconds,
    resolveSpawnPosition(state, spawns, arena),
  );
  state.enemies.push(enemy);
  resolveEntrySpawns(state, enemy, archetypeOf(state.config, spawns.archetypeId));
  return enemy;
}

/**
 * Repositions the primary enemy to the encounter's spawn-placement
 * resolution (step 40.2), used when a live drill switch forces a phase on a
 * running attempt. Minions are despawned/respawned by phase machinery
 * already and must not be touched here.
 */
export function repositionPrimaryEnemy(state: SimulationState): void {
  const enemy = state.enemies.find(
    (candidate) => candidate.archetypeId === state.config.primaryArchetypeId,
  );
  if (!enemy) return;
  const resolved = resolveSpawnPosition(state, state.config.spawns, state.config.arena);
  enemy.positionTiles = constrainBodyToArena(
    archetypeOf(state.config, enemy.archetypeId).verticesTiles,
    resolved,
    state.config.arena,
  );
}

/**
 * Resolves due spawns. A suppressed spawn is skipped rather than deferred: the
 * schedule keeps advancing, so lowering the cap does not bank arrivals.
 */
function updateSpawns(state: SimulationState): void {
  const { everySeconds } = state.config.spawns;
  // `null` means the opening spawn (schedule index 0) is never repeated (K10).
  if (everySeconds === null) return;
  const toleranceSeconds =
    Math.max(state.elapsedSeconds, state.nextSpawnSeconds) *
    Number.EPSILON *
    16;
  while (state.elapsedSeconds + toleranceSeconds >= state.nextSpawnSeconds) {
    spawnEnemy(state);
    state.nextSpawnSeconds += everySeconds;
  }
}

export function setDebugSettings(
  state: SimulationState,
  settings: DebugSettings,
): void {
  validateDebugSettings(settings);
  const defaults = isDefaultDebugSettings(settings);
  // Only the Crystal Worm has a debug tuning config. Other encounters may still
  // carry the debug toggle state - god mode is the non-tuning case - but their
  // config must not be replaced by the Crystal Worm debug config.
  if (state.config.primaryArchetypeId !== PRIMARY_ARCHETYPE_ID) {
    state.debugSettings = { ...settings };
    if (!defaults) state.rulesVersion = DEBUG_RULES_VERSION;
    return;
  }
  const config = defaults ? ENCOUNTER_CONFIG : debugEncounterConfig(settings);
  const previous = state.debugSettings;
  const changed = Object.keys(settings).some(
    (key) =>
      settings[key as keyof DebugSettings] !==
      previous[key as keyof DebugSettings],
  );
  if (!changed) return;
  state.config = config;
  state.debugSettings = { ...settings };
  if (!defaults) state.rulesVersion = DEBUG_RULES_VERSION;
  const rotationChanged =
    settings.rotationDegreesPerSecond !== previous.rotationDegreesPerSecond ||
    settings.initialPhaseDegrees !== previous.initialPhaseDegrees;
  const burstChanged =
    settings.shotsPerEmitter !== previous.shotsPerEmitter ||
    settings.shotIntervalSeconds !== previous.shotIntervalSeconds ||
    settings.cooldownSeconds !== previous.cooldownSeconds ||
    settings.initialCooldownSeconds !== previous.initialCooldownSeconds;
  for (const enemy of state.enemies) {
    const archetype = archetypeOf(config, enemy.archetypeId);
    const attacks = activeAttacks(archetype, enemy);
    for (let index = 0; index < enemy.attackClocks.length; index++) {
      const clock = enemy.attackClocks[index];
      const attack = attacks[index];
      if (rotationChanged && attack.pattern.kind === "ring") {
        clock.rotationEpochSeconds = state.elapsedSeconds;
        clock.rotationPhaseAtEpoch =
          settings.initialPhaseDegrees !== previous.initialPhaseDegrees
            ? attack.pattern.initialPhaseRadians
            : clock.ringPhaseRadians;
        clock.ringPhaseRadians = clock.rotationPhaseAtEpoch;
      }
      if (burstChanged) {
        clock.epochSeconds = state.elapsedSeconds;
        clock.volleysAtEpoch = clock.volleysFired;
        clock.initialDelaySeconds =
          clock.volleysFired === 0
            ? settings.initialCooldownSeconds
            : settings.shotIntervalSeconds;
      }
    }
    enemy.positionTiles = constrainToArena(
      enemy.positionTiles,
      archetype.verticesTiles,
      config.arena,
    );
  }
  // G20: a lowered cap takes effect at once by dropping the newest arrivals.
  // A changed ring fraction applies to future spawns; enemies already in play
  // have moved off the ring regardless.
  if (state.enemies.length > config.spawns.maxConcurrent)
    state.enemies.length = config.spawns.maxConcurrent;
  if (state.nextSpawnSeconds < state.elapsedSeconds)
    state.nextSpawnSeconds = state.elapsedSeconds;
  state.player.positionTiles = constrainToArena(
    state.player.positionTiles,
    config.player.verticesTiles,
    config.arena,
  );
  state.collisionBoundingRadiusTiles = boundingRadiusTiles(config);
  state.shards = restampLiveShards(
    state.shards,
    bulletOf(
      config,
      archetypeOf(config, config.primaryArchetypeId).phases[0].attacks[0]
        .projectileId,
    ),
  );
}

function constrainToArena(
  positionTiles: Vector2,
  verticesTiles: readonly Vector2[],
  arena: Arena,
): Vector2 {
  return constrainBodyToArena(verticesTiles, positionTiles, arena);
}

/** Point-based travel toward a target: not body-aware, and a zero remaining
 * distance travels zero (the retired `chaseArenaCenter` inline block's exact
 * semantics, preserved for `move-to-point`, `orbit`'s approach and `wander`). */
function movePointToward(
  start: Vector2,
  target: Vector2,
  maxTravelTiles: number,
): Vector2 {
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  const length = Math.hypot(deltaX, deltaY);
  const fraction = length === 0 ? 0 : Math.min(1, maxTravelTiles / length);
  return { x: start.x + deltaX * fraction, y: start.y + deltaY * fraction };
}

const orbitRingToleranceTiles = 1e-9;

/**
 * Advances one `orbit` enemy: moves toward its nearest ring point at the
 * approach speed while off the ring, then holds the ring and advances
 * `movementPhaseRadians` in closed form at the authored rate. `cw` increases
 * the bearing angle and `ccw` decreases it.
 */
function advanceOrbitMovement(
  enemy: EnemyState,
  movement: Extract<MovementSpec, { kind: "orbit" }>,
  arenaCenterTiles: Vector2,
  stepSeconds: number,
): Vector2 {
  const offsetX = enemy.positionTiles.x - arenaCenterTiles.x;
  const offsetY = enemy.positionTiles.y - arenaCenterTiles.y;
  const distanceTiles = Math.hypot(offsetX, offsetY);
  const bearingRadians =
    distanceTiles === 0
      ? enemy.movementPhaseRadians
      : Math.atan2(offsetY, offsetX);
  if (Math.abs(distanceTiles - movement.radiusTiles) > orbitRingToleranceTiles) {
    enemy.movementPhaseRadians = bearingRadians;
    return movePointToward(
      enemy.positionTiles,
      {
        x: arenaCenterTiles.x + Math.cos(bearingRadians) * movement.radiusTiles,
        y: arenaCenterTiles.y + Math.sin(bearingRadians) * movement.radiusTiles,
      },
      movement.approachSpeedTilesPerSecond * stepSeconds,
    );
  }
  const signedDegreesPerSecond =
    movement.direction === "cw"
      ? movement.degreesPerSecond
      : -movement.degreesPerSecond;
  enemy.movementPhaseRadians =
    bearingRadians + degreesToRadians(signedDegreesPerSecond) * stepSeconds;
  return {
    x:
      arenaCenterTiles.x +
      Math.cos(enemy.movementPhaseRadians) * movement.radiusTiles,
    y:
      arenaCenterTiles.y +
      Math.sin(enemy.movementPhaseRadians) * movement.radiusTiles,
  };
}

const wanderArrivalToleranceTiles = 1e-9;

/**
 * Advances one `wander` enemy toward a target drawn from the injected seeded
 * generator within `radiusTiles` of the arena centre, redrawing on schedule
 * or on arrival. The only randomness `wander` draws: one angle, then one
 * radius fraction, per redraw - see the draw-order comment on `updateMovement`.
 */
function advanceWanderMovement(
  state: SimulationState,
  enemy: EnemyState,
  movement: Extract<MovementSpec, { kind: "wander" }>,
  arenaCenterTiles: Vector2,
  stepSeconds: number,
): Vector2 {
  const arrived =
    enemy.wanderTargetTiles !== null &&
    Math.hypot(
      enemy.positionTiles.x - enemy.wanderTargetTiles.x,
      enemy.positionTiles.y - enemy.wanderTargetTiles.y,
    ) <= wanderArrivalToleranceTiles;
  if (
    enemy.wanderTargetTiles === null ||
    arrived ||
    state.elapsedSeconds >= enemy.wanderRetargetAtSeconds
  ) {
    const angleRadians = nextUnitRandom(state) * fullTurnRadians;
    const radiusTiles = nextUnitRandom(state) * movement.radiusTiles;
    enemy.wanderTargetTiles = {
      x: arenaCenterTiles.x + Math.cos(angleRadians) * radiusTiles,
      y: arenaCenterTiles.y + Math.sin(angleRadians) * radiusTiles,
    };
    enemy.wanderRetargetAtSeconds =
      state.elapsedSeconds + movement.retargetSeconds;
  }
  return movePointToward(
    enemy.positionTiles,
    enemy.wanderTargetTiles,
    movement.speedTilesPerSecond * stepSeconds,
  );
}

/**
 * The least displacement that turns an enemy's heading. A numerical tolerance
 * (matching `orbitRingToleranceTiles`), not a gameplay value.
 */
const HEADING_MIN_DISPLACEMENT_TILES = 1e-9;

/** Resolves one enemy's unconstrained next position under its active movement kind. */
function advanceEnemyMovement(
  state: SimulationState,
  enemy: EnemyState,
  archetype: EnemyArchetype,
  stepSeconds: number,
): Vector2 {
  const config = state.config;
  const phaseMovement = activeMovement(archetype, enemy);
  // The `chaseArenaCenter` debug toggle swaps the active movement for
  // `move-to-point` at the arena centre, at the archetype's own speed,
  // rather than branching inline on every movement kind.
  const movement: MovementSpec = state.debugSettings.chaseArenaCenter
    ? {
        kind: "move-to-point",
        target: "arena-center",
        speedTilesPerSecond: movementSpeedTilesPerSecond(phaseMovement),
      }
    : phaseMovement;
  switch (movement.kind) {
    case "chase":
      return pursueBody(
        archetype.verticesTiles,
        enemy.positionTiles,
        config.player.verticesTiles,
        state.player.positionTiles,
        movement.speedTilesPerSecond * stepSeconds,
      );
    case "stationary":
      return enemy.positionTiles;
    case "move-to-point":
      return movePointToward(
        enemy.positionTiles,
        config.arena.shape.centerTiles,
        movement.speedTilesPerSecond * stepSeconds,
      );
    case "orbit":
      return advanceOrbitMovement(
        enemy,
        movement,
        config.arena.shape.centerTiles,
        stepSeconds,
      );
    case "wander":
      return advanceWanderMovement(
        state,
        enemy,
        movement,
        config.arena.shape.centerTiles,
        stepSeconds,
      );
  }
}

/**
 * Advances the player, then every enemy in insertion order. The full per-tick
 * randomness draw order (K11), fixed by this step: player movement draws
 * nothing; enemy movement draws here, per enemy in insertion order, only for
 * a `wander` kind; then shard advance and hit resolution; then timed spawns
 * (the opening-bearing fallback); then attacks, in enemy order and then
 * authored attack order (a `scatter` pattern's draws). Every generator draw
 * happens in exactly this order, so a fixed seed and input sequence stay
 * reproducible regardless of step rate.
 */
function updateMovement(state: SimulationState, input: SimulationInput): void {
  const config = state.config;
  const stepSeconds = config.simulation.fixedStepSeconds;
  const conditionedInput = effectiveInput(state.player, input);
  const directionX =
    Number(conditionedInput.east) - Number(conditionedInput.west);
  const directionY =
    Number(conditionedInput.south) - Number(conditionedInput.north);
  const directionLength = Math.hypot(directionX, directionY) || 1;
  const playerTravel = playerTravelTiles(state.player, stepSeconds);
  state.player.positionTiles = constrainToArena(
    {
      x:
        state.player.positionTiles.x +
        (directionX / directionLength) * playerTravel,
      y:
        state.player.positionTiles.y +
        (directionY / directionLength) * playerTravel,
    },
    config.player.verticesTiles,
    config.arena,
  );

  for (const enemy of state.enemies) {
    const archetype = archetypeOf(config, enemy.archetypeId);
    const startTiles = enemy.positionTiles;
    enemy.positionTiles = constrainToArena(
      advanceEnemyMovement(state, enemy, archetype, stepSeconds),
      archetype.verticesTiles,
      config.arena,
    );
    // N17: the heading follows movement only, and holds when the enemy stops.
    const displacementX = enemy.positionTiles.x - startTiles.x;
    const displacementY = enemy.positionTiles.y - startTiles.y;
    if (Math.hypot(displacementX, displacementY) > HEADING_MIN_DISPLACEMENT_TILES)
      enemy.headingRadians = Math.atan2(displacementY, displacementX);
  }
}

/**
 * Shared hit path for both a shard and an enemy contact: resolves the
 * condition-aware defense formula, applies damage and conditions, and records
 * the hit. Returns whether the hit was accepted, so a shard caller can mark
 * itself as having hit (once-only) while a contact caller never does.
 */
function applyAcceptedHit(
  state: SimulationState,
  shardId: number,
  rawDamageHp: number,
  armorPiercing: boolean,
  conditions: readonly ConditionApplication[],
  acceptedHits: AcceptedHit[],
): boolean {
  if (state.debugSettings.godMode) return false;
  const defense = effectiveDefenseFor(state.player, armorPiercing);
  const cursed = hasCondition(state.player, "cursed");
  const damageHp = applyPlayerHit(state.player, rawDamageHp, defense, cursed);
  if (damageHp === null) return false;
  applyConditions(state.player, conditions);
  state.hitsTaken++;
  acceptedHits.push({
    shardId,
    damageHp,
    positionTiles: { ...state.player.positionTiles },
  });
  if (state.player.healthHp === 0) state.phase = "ended";
  return true;
}

function registerShardHit(
  state: SimulationState,
  shard: ShardState | BombState,
  acceptedHits: AcceptedHit[],
): void {
  const projectile = projectileOf(state.config, shard.projectileId);
  if (
    applyAcceptedHit(
      state,
      shard.id,
      shard.damageHp,
      projectile.armorPiercing,
      projectile.conditions,
      acceptedHits,
    )
  )
    shard.hasHitPlayer = true;
}

/**
 * Advances every live shard and bomb, merged by ascending id (N23). Shards and
 * bombs share one id sequence, so resolving them in id order keeps hit and
 * detonation order identical to when both lived in one list. Everything is kept
 * untouched once the run is no longer playing, as before the split.
 */
function advanceProjectiles(
  state: SimulationState,
  stepSeconds: number,
  playerStart: Vector2,
  acceptedHits: AcceptedHit[],
  detonations: DetonationEvent[],
): void {
  const { shards, bombs } = state;
  const survivingShards: ShardState[] = [];
  const survivingBombs: BombState[] = [];
  let shardIndex = 0;
  let bombIndex = 0;
  while (shardIndex < shards.length || bombIndex < bombs.length) {
    const takeShard =
      bombIndex >= bombs.length ||
      (shardIndex < shards.length && shards[shardIndex].id < bombs[bombIndex].id);
    if (takeShard) {
      const shard = shards[shardIndex++];
      if (currentPhase(state) !== "playing") {
        survivingShards.push(shard);
        continue;
      }
      const result = advanceShard(
        state,
        shard,
        stepSeconds,
        playerStart,
        state.player.positionTiles,
      );
      if (result.hitPlayer) registerShardHit(state, shard, acceptedHits);
      if (result.alive) survivingShards.push(shard);
    } else {
      const bomb = bombs[bombIndex++];
      if (currentPhase(state) !== "playing") {
        survivingBombs.push(bomb);
        continue;
      }
      const result = advanceBomb(
        state,
        bomb,
        stepSeconds,
        playerStart,
        state.player.positionTiles,
      );
      if (result.hitPlayer) registerShardHit(state, bomb, acceptedHits);
      if (result.detonated)
        detonations.push(
          Object.freeze({
            projectileId: bomb.projectileId,
            positionTiles: { ...bomb.detonationTargetTiles },
            radiusTiles: bombOf(state.config, bomb.projectileId)
              .detonationRadiusTiles,
          }),
        );
      if (result.alive) survivingBombs.push(bomb);
    }
  }
  state.shards = survivingShards;
  state.bombs = survivingBombs;
}

/**
 * Resolves enemy contact damage (K17), once per fixed step, after enemy
 * movement and before shard advance. Unlike a shard's once-per-shard rule,
 * contact repeats on its cooldown for as long as the bodies overlap - that is
 * deliberate, not a bug to "fix" into once-only: it is the pressure a
 * charging minion applies. Uses the same swept-convex-overlap test as shards
 * so a fast enemy cannot tunnel through the player within one step.
 */
function resolveEnemyContact(
  state: SimulationState,
  enemyStarts: ReadonlyMap<number, Vector2>,
  playerStart: Vector2,
  playerEnd: Vector2,
  acceptedHits: AcceptedHit[],
): void {
  for (const enemy of state.enemies) {
    if (state.player.healthHp === 0) break;
    const archetype = archetypeOf(state.config, enemy.archetypeId);
    if (archetype.contactDamageHp === 0 && archetype.contactConditions.length === 0)
      continue;
    if (state.elapsedSeconds < enemy.nextContactEligibleSeconds) continue;
    const enemyStart = enemyStarts.get(enemy.id) ?? enemy.positionTiles;
    const enemyEnd = enemy.positionTiles;
    const overlaps = sweptConvexOverlap(
      transformBodyVertices(archetype.verticesTiles, enemyStart),
      { x: enemyEnd.x - enemyStart.x, y: enemyEnd.y - enemyStart.y },
      transformBodyVertices(state.config.player.verticesTiles, playerStart),
      { x: playerEnd.x - playerStart.x, y: playerEnd.y - playerStart.y },
    );
    if (!overlaps) continue;
    // Stable synthetic shard identity derived from the enemy id, not a
    // minted fake shard, since the shared hit path only needs an id to tag.
    const accepted = applyAcceptedHit(
      state,
      -enemy.id,
      archetype.contactDamageHp,
      archetype.contactArmorPiercing,
      archetype.contactConditions,
      acceptedHits,
    );
    if (accepted)
      enemy.nextContactEligibleSeconds =
        state.elapsedSeconds + archetype.contactCooldownSeconds;
  }
}

/**
 * Advances every enemy's attack clocks and fires each one's volley when due.
 * Iterates enemies, then each enemy's attacks in authored order, so shard ids
 * stay stable and a fixed input sequence stays reproducible (G: step 20.2).
 */
function updateAttacks(state: SimulationState): void {
  const config = state.config;
  for (const enemy of state.enemies) {
    const archetype = archetypeOf(config, enemy.archetypeId);
    const attacks = activeAttacks(archetype, enemy);
    for (let index = 0; index < attacks.length; index++) {
      updateAttackClock(state, enemy, attacks[index], enemy.attackClocks[index]);
    }
  }
}

/** Advances one attack's rotation and fires its volley when its clock is due. */
function updateAttackClock(
  state: SimulationState,
  enemy: EnemyState,
  attack: AttackSpec,
  clock: AttackClockState,
): void {
  const projectile = projectileOf(state.config, attack.projectileId);
  const { pattern, cadence } = attack;
  // Only a `ring` pattern rotates; every other kind leaves ringPhaseRadians
  // at its fixed, deterministic starting value (see createEnemy).
  if (pattern.kind === "ring") {
    clock.ringPhaseRadians =
      (clock.rotationPhaseAtEpoch +
        ((state.elapsedSeconds - clock.rotationEpochSeconds) *
          pattern.clockwiseDegreesPerSecond *
          Math.PI) /
          180) %
      fullTurnRadians;
  }
  const { shotsPerBurst, shotIntervalSeconds } = cadence;
  const burstGroupSeconds =
    (shotsPerBurst - 1) * shotIntervalSeconds +
    cadence.cooldownAfterLastShotSeconds;
  const volleysSinceEpoch = clock.volleysFired - clock.volleysAtEpoch;
  const groupIndex = Math.floor(volleysSinceEpoch / shotsPerBurst);
  const shotIndex = volleysSinceEpoch % shotsPerBurst;
  const nextShotSeconds =
    clock.epochSeconds +
    clock.initialDelaySeconds +
    groupIndex * burstGroupSeconds +
    shotIndex * shotIntervalSeconds;
  const shotToleranceSeconds =
    Math.max(state.elapsedSeconds, nextShotSeconds) * Number.EPSILON * 16;
  if (state.elapsedSeconds + shotToleranceSeconds < nextShotSeconds) return;

  // A volley draws one unit-random value per final scatter shot (a top-level
  // scatter or a scatter inside a ring's arms), in depth-first arm order,
  // advancing the shared generator cursor - the only place this attack's
  // randomness enters, so draw order across attacks and enemies stays fixed
  // by the authored/enemy-insertion order the caller already iterates in
  // (K11). A pattern with no scatter draws nothing. `resolveBearings` itself
  // never draws; it only consumes these.
  const drawCount = scatterDrawCount(pattern);
  const drawnUnitRandoms =
    drawCount > 0
      ? Array.from({ length: drawCount }, () => nextUnitRandom(state))
      : undefined;
  const bearings = resolveBearings(pattern, {
    enemyPositionTiles: enemy.positionTiles,
    playerPositionTiles: state.player.positionTiles,
    enemyHeadingRadians: enemy.headingRadians,
    ringPhaseRadians: clock.ringPhaseRadians,
    volleyIndexInBurst: shotIndex,
    burstsFired: groupIndex,
    // Arm spread is measured from this clock's epoch, not the simulation's,
    // so a re-entered phase starts its spread over instead of inheriting it.
    secondsSinceEpoch: Math.max(0, state.elapsedSeconds - clock.epochSeconds),
    drawnUnitRandoms,
  });
  for (const bearing of bearings) {
    const spawnTiles = {
      x:
        enemy.positionTiles.x +
        Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
      y:
        enemy.positionTiles.y +
        Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
    };
    if (projectile.type === "bomb")
      state.bombs.push(
        createBomb(
          projectile,
          state.nextShardId++,
          spawnTiles,
          bearing.bearingRadians,
          attack.target === "player" ? state.player.positionTiles : undefined,
        ),
      );
    else
      state.shards.push(
        createShard(projectile, state.nextShardId++, spawnTiles, bearing.bearingRadians),
      );
  }
  clock.volleysFired++;
}

/**
 * Reads `state.phase` through an opaque call so TS does not keep narrowing
 * it to an earlier-checked literal across the fixed-step loop below, where
 * `applyProgression` can reassign it mid-iteration.
 */
function currentPhase(state: SimulationState): SimulationState["phase"] {
  return state.phase;
}

export function advanceSimulation(
  state: SimulationState,
  elapsedSeconds: number,
  input: SimulationInput,
): AdvanceResult {
  assertNonnegative(elapsedSeconds, "elapsedSeconds");
  const acceptedHits: AcceptedHit[] = [];
  const detonations: DetonationEvent[] = [];
  if (currentPhase(state) !== "playing")
    return {
      stepsExecuted: 0,
      discardedSeconds: elapsedSeconds,
      acceptedHits,
      detonations,
    };
  const pendingSeconds = state.accumulatorSeconds + elapsedSeconds;
  assertNonnegative(pendingSeconds, "pendingSeconds");
  const { fixedStepSeconds, maxStepsPerUpdate } = state.config.simulation;
  const availableSteps = Math.floor(
    (pendingSeconds + timeRoundingToleranceSeconds) / fixedStepSeconds,
  );
  const maximumSteps = Math.min(availableSteps, maxStepsPerUpdate);
  let remainderSeconds = pendingSeconds % fixedStepSeconds;
  if (
    remainderSeconds <= timeRoundingToleranceSeconds ||
    fixedStepSeconds - remainderSeconds <= timeRoundingToleranceSeconds
  ) {
    remainderSeconds = 0;
  }
  const discardedSeconds =
    availableSteps > maxStepsPerUpdate
      ? Math.max(
          0,
          pendingSeconds - maximumSteps * fixedStepSeconds - remainderSeconds,
        )
      : 0;

  let stepsExecuted = 0;
  while (stepsExecuted < maximumSteps) {
    // Conditions tick before movement; hits later in the step retain their
    // full authored duration and first decrement on the following step.
    tickConditions(state.player, fixedStepSeconds);
    const playerStart = state.player.positionTiles;
    const enemyStarts = new Map(
      state.enemies.map((enemy) => [enemy.id, enemy.positionTiles] as const),
    );
    updateMovement(state, input);
    state.ticksElapsed++;
    state.elapsedSeconds = state.ticksElapsed * fixedStepSeconds;
    // Honey occupancy is evaluated AFTER movement finalises this step's
    // position, so the speed multiplier a step uses reflects contact
    // accumulated BEFORE that step: entering honey slows the player starting
    // the step after they first stood in it, the same one-step lag the
    // condition model already has. Re-entry damages on the very first step
    // inside (the clock resets to due-immediately on leaving), so dipping in
    // and out is never cheaper than standing still.
    if (
      state.player.healthHp > 0 &&
      currentPhase(state) === "playing" &&
      honeyAt(state.config.arena, state.player.positionTiles)
    ) {
      state.player.honeyContactSeconds += fixedStepSeconds;
      if (state.elapsedSeconds >= state.player.nextHoneyDamageAtSeconds) {
        // No shard is involved, so 0 (never a real shard or enemy-contact
        // id) tags the hit through the same shared path shards and enemy
        // contact use.
        applyAcceptedHit(state, 0, HONEY_DAMAGE_HP, true, [], acceptedHits);
        state.player.nextHoneyDamageAtSeconds =
          state.elapsedSeconds + HONEY_DAMAGE_INTERVAL_SECONDS;
      }
    } else if (currentPhase(state) === "playing") {
      state.player.honeyContactSeconds = 0;
      state.player.nextHoneyDamageAtSeconds = 0;
    }
    applyProgression(state, fixedStepSeconds);
    applyPhaseTransitions(state);
    if (state.player.healthHp > 0 && currentPhase(state) === "playing")
      resolveEnemyContact(
        state,
        enemyStarts,
        playerStart,
        state.player.positionTiles,
        acceptedHits,
      );
    advanceProjectiles(
      state,
      fixedStepSeconds,
      playerStart,
      acceptedHits,
      detonations,
    );
    if (state.player.healthHp > 0 && currentPhase(state) === "playing") {
      updateSpawns(state);
      const existingCount = state.shards.length;
      updateAttacks(state);
      // Only shards are checked on arrival: a bomb hits only by detonating.
      for (const shard of state.shards.slice(existingCount)) {
        if (
          shardOverlapsPlayer(
            state,
            shard.positionTiles,
            shard.positionTiles,
            state.player.positionTiles,
            state.player.positionTiles,
            shard,
          )
        )
          registerShardHit(state, shard, acceptedHits);
        if (state.player.healthHp === 0) break;
      }
      regeneratePlayer(state.player, fixedStepSeconds);
    }
    stepsExecuted++;
    if (state.player.healthHp === 0 || currentPhase(state) === "cleared") {
      state.accumulatorSeconds = 0;
      return {
        stepsExecuted,
        acceptedHits,
        detonations,
        discardedSeconds: Math.max(
          0,
          pendingSeconds - stepsExecuted * fixedStepSeconds,
        ),
      };
    }
  }
  state.accumulatorSeconds = remainderSeconds;
  return { stepsExecuted, discardedSeconds, acceptedHits, detonations };
}

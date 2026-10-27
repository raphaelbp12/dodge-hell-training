import { constrainBodyToArena, pursueBody } from "./geometry";
import {
  archetypeOf,
  ENCOUNTER_CONFIG,
  projectileOf,
  type AttackSpec,
  type EncounterConfig,
} from "../config/encounter";
import {
  advanceShard,
  createShard,
  restampLiveShards,
  shardOverlapsPlayer,
} from "./projectiles";
import { resolveBearings } from "./patterns";
import {
  DEFAULT_DEBUG_SETTINGS,
  DEBUG_RULES_VERSION,
  debugEncounterConfig,
  isDefaultDebugSettings,
  type DebugSettings,
} from "../config/debug";
import {
  assertNonnegative,
  PALADIN_DERIVED_STATS,
  PALADIN_STATS,
} from "../config/stats";
import type {
  AcceptedHit,
  AttackClockState,
  EnemyState,
  PlayerState,
  ShardState,
  SimulationInput,
  Vector2,
} from "../models";
import { applyPlayerHit, regeneratePlayer } from "./health";
import { arbitrarySeed, assertSeed, nextSeed, unitFromSeed } from "./random";

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
  phase: "playing" | "ended";
  hitsTaken: number;
  player: PlayerState;
  /** Insertion-ordered so a fixed input sequence stays reproducible. */
  enemies: EnemyState[];
  shards: ShardState[];
  ticksElapsed: number;
  elapsedSeconds: number;
  accumulatorSeconds: number;
};

export type AdvanceResult = Readonly<{
  stepsExecuted: number;
  discardedSeconds: number;
  acceptedHits: readonly AcceptedHit[];
}>;

const timeRoundingToleranceSeconds =
  ENCOUNTER_CONFIG.simulation.fixedStepSeconds * Number.EPSILON * 16;
const fullTurnRadians = 2 * Math.PI;
const combinedBoundingRadiusTiles = boundingRadiusTiles(ENCOUNTER_CONFIG);

/** Broadphase bound: player body plus the largest body across the projectile catalog. */
function boundingRadiusTiles(config: EncounterConfig): number {
  const radius = (vertices: readonly Vector2[]): number =>
    Math.max(...vertices.map((vertex) => Math.hypot(vertex.x, vertex.y)));
  return (
    radius(config.player.verticesTiles) +
    Math.max(
      ...Object.values(config.projectiles).map((projectile) =>
        radius(projectile.verticesTiles),
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
export function createEnemy(
  config: EncounterConfig,
  archetypeId: string,
  id: number,
  spawnedAtSeconds: number,
  positionTiles?: Vector2,
): EnemyState {
  const archetype = archetypeOf(config, archetypeId);
  return {
    id,
    archetypeId,
    positionTiles: { ...(positionTiles ?? archetype.spawnTiles) },
    spawnedAtSeconds,
    // ringPhaseRadians/rotationPhaseAtEpoch are ring-specific; a non-ring
    // pattern never rotates one, so it starts and stays at 0 - a fixed,
    // deterministic fallback bearing for a pattern like `spread`'s degenerate
    // aim case, not a value that pattern ever advances.
    attackClocks: archetype.attacks.map((attack) => ({
      attackId: attack.id,
      epochSeconds: spawnedAtSeconds,
      volleysAtEpoch: 0,
      initialDelaySeconds: attack.cadence.initialDelaySeconds,
      rotationEpochSeconds: spawnedAtSeconds,
      rotationPhaseAtEpoch:
        attack.pattern.kind === "ring" ? attack.pattern.initialPhaseRadians : 0,
      ringPhaseRadians:
        attack.pattern.kind === "ring" ? attack.pattern.initialPhaseRadians : 0,
      volleysFired: 0,
    })),
  };
}

export function createSimulation(
  config: EncounterConfig = ENCOUNTER_CONFIG,
  seed: number = arbitrarySeed(),
): SimulationState {
  const state: SimulationState = {
    config,
    debugSettings: DEFAULT_DEBUG_SETTINGS,
    collisionBoundingRadiusTiles: combinedBoundingRadiusTiles,
    nextShardId: 1,
    nextEnemyId: 1,
    nextSpawnSeconds: config.spawns.firstSpawnSeconds,
    randomSeed: assertSeed(seed),
    rulesVersion: config.rulesVersion,
    phase: "playing",
    hitsTaken: 0,
    player: {
      positionTiles: { ...config.player.spawnTiles },
      healthHp: PALADIN_STATS.healthHp,
      combatRemainingSeconds: 0,
    },
    enemies: [],
    shards: [],
    ticksElapsed: 0,
    elapsedSeconds: 0,
    accumulatorSeconds: 0,
  };
  // The opening enemy is schedule index 0, created through the same routine as
  // every later spawn, so there is no special-cased initial enemy (G18).
  spawnEnemy(state);
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

export function spawnEnemy(state: SimulationState): EnemyState | null {
  const { spawns, arena } = state.config;
  if (state.enemies.length >= spawns.maxConcurrent) return null;
  const offsetX = state.player.positionTiles.x - arena.centerTiles.x;
  const offsetY = state.player.positionTiles.y - arena.centerTiles.y;
  const distanceTiles = Math.hypot(offsetX, offsetY);
  const awayBearing =
    distanceTiles === 0
      ? nextUnitRandom(state) * fullTurnRadians
      : Math.atan2(offsetY, offsetX) + Math.PI;
  const bearing =
    awayBearing + state.enemies.length * spawns.goldenAngleRadians;
  const enemy = createEnemy(
    state.config,
    spawns.archetypeId,
    state.nextEnemyId++,
    state.elapsedSeconds,
    {
      x: arena.centerTiles.x + Math.cos(bearing) * spawns.ringRadiusTiles,
      y: arena.centerTiles.y + Math.sin(bearing) * spawns.ringRadiusTiles,
    },
  );
  state.enemies.push(enemy);
  return enemy;
}

/**
 * Resolves due spawns. A suppressed spawn is skipped rather than deferred: the
 * schedule keeps advancing, so lowering the cap does not bank arrivals.
 */
function updateSpawns(state: SimulationState): void {
  const { everySeconds } = state.config.spawns;
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
  const config = debugEncounterConfig(settings);
  const previous = state.debugSettings;
  const changed = Object.keys(settings).some(
    (key) =>
      settings[key as keyof DebugSettings] !==
      previous[key as keyof DebugSettings],
  );
  if (!changed) return;
  state.config = config;
  state.debugSettings = { ...settings };
  if (!isDefaultDebugSettings(settings))
    state.rulesVersion = DEBUG_RULES_VERSION;
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
    for (let index = 0; index < enemy.attackClocks.length; index++) {
      const clock = enemy.attackClocks[index];
      const attack = archetype.attacks[index];
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
  );
  state.collisionBoundingRadiusTiles = boundingRadiusTiles(config);
  state.shards = restampLiveShards(
    state.shards,
    projectileOf(
      config,
      archetypeOf(config, config.primaryArchetypeId).attacks[0].projectileId,
    ),
  );
}

function constrainToArena(
  positionTiles: Vector2,
  verticesTiles: readonly Vector2[],
): Vector2 {
  return constrainBodyToArena(
    verticesTiles,
    positionTiles,
    ENCOUNTER_CONFIG.arena,
  );
}

function updateMovement(state: SimulationState, input: SimulationInput): void {
  const config = state.config;
  const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
  const directionX = Number(input.east) - Number(input.west);
  const directionY = Number(input.south) - Number(input.north);
  const directionLength = Math.hypot(directionX, directionY) || 1;
  const playerTravelTiles =
    PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds;
  state.player.positionTiles = constrainToArena(
    {
      x:
        state.player.positionTiles.x +
        (directionX / directionLength) * playerTravelTiles,
      y:
        state.player.positionTiles.y +
        (directionY / directionLength) * playerTravelTiles,
    },
    config.player.verticesTiles,
  );

  for (const enemy of state.enemies) {
    const archetype = archetypeOf(config, enemy.archetypeId);
    enemy.positionTiles = constrainToArena(
      state.debugSettings.chaseArenaCenter
        ? (() => {
            const target = config.arena.centerTiles;
            const deltaX = target.x - enemy.positionTiles.x;
            const deltaY = target.y - enemy.positionTiles.y;
            const length = Math.hypot(deltaX, deltaY);
            const fraction =
              length === 0
                ? 0
                : Math.min(
                    1,
                    (archetype.speedTilesPerSecond * stepSeconds) / length,
                  );
            return {
              x: enemy.positionTiles.x + deltaX * fraction,
              y: enemy.positionTiles.y + deltaY * fraction,
            };
          })()
        : pursueBody(
            archetype.verticesTiles,
            enemy.positionTiles,
            config.player.verticesTiles,
            state.player.positionTiles,
            archetype.speedTilesPerSecond * stepSeconds,
          ),
      archetype.verticesTiles,
    );
  }
}

function registerShardHit(
  state: SimulationState,
  shard: ShardState,
  acceptedHits: AcceptedHit[],
): void {
  if (state.debugSettings.godMode) return;
  const damageHp = applyPlayerHit(state.player, shard.damageHp);
  if (damageHp === null) return;
  shard.hasHitPlayer = true;
  state.hitsTaken++;
  acceptedHits.push({
    shardId: shard.id,
    damageHp,
    positionTiles: { ...state.player.positionTiles },
  });
  if (state.player.healthHp === 0) state.phase = "ended";
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
    for (let index = 0; index < archetype.attacks.length; index++) {
      updateAttackClock(
        state,
        enemy,
        archetype.attacks[index],
        enemy.attackClocks[index],
      );
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

  // A `scatter` volley draws one unit-random value per shot, in shot order,
  // advancing the shared generator cursor - the only place this attack's
  // randomness enters, so draw order across attacks and enemies stays fixed
  // by the authored/enemy-insertion order the caller already iterates in
  // (K11). `resolveBearings` itself never draws; it only consumes these.
  const drawnUnitRandoms =
    pattern.kind === "scatter"
      ? Array.from({ length: pattern.shots }, () => nextUnitRandom(state))
      : undefined;
  const bearings = resolveBearings(pattern, {
    enemyPositionTiles: enemy.positionTiles,
    playerPositionTiles: state.player.positionTiles,
    ringPhaseRadians: clock.ringPhaseRadians,
    volleyIndexInBurst: shotIndex,
    burstsFired: groupIndex,
    // Arm spread is measured from this clock's epoch, not the simulation's,
    // so a re-entered phase starts its spread over instead of inheriting it.
    secondsSinceEpoch: Math.max(0, state.elapsedSeconds - clock.epochSeconds),
    drawnUnitRandoms,
  });
  for (const bearing of bearings) {
    state.shards.push(
      createShard(
        projectile,
        state.nextShardId++,
        {
          x:
            enemy.positionTiles.x +
            Math.cos(bearing.bearingRadians) * bearing.emitterRadiusTiles,
          y:
            enemy.positionTiles.y +
            Math.sin(bearing.bearingRadians) * bearing.emitterRadiusTiles,
        },
        bearing.bearingRadians,
      ),
    );
  }
  clock.volleysFired++;
}

export function advanceSimulation(
  state: SimulationState,
  elapsedSeconds: number,
  input: SimulationInput,
): AdvanceResult {
  assertNonnegative(elapsedSeconds, "elapsedSeconds");
  const acceptedHits: AcceptedHit[] = [];
  if (state.phase === "ended")
    return { stepsExecuted: 0, discardedSeconds: elapsedSeconds, acceptedHits };
  const pendingSeconds = state.accumulatorSeconds + elapsedSeconds;
  assertNonnegative(pendingSeconds, "pendingSeconds");
  const { fixedStepSeconds, maxStepsPerUpdate } = ENCOUNTER_CONFIG.simulation;
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
    const playerStart = state.player.positionTiles;
    updateMovement(state, input);
    state.ticksElapsed++;
    state.elapsedSeconds = state.ticksElapsed * fixedStepSeconds;
    state.shards = state.shards.filter((shard) => {
      if (state.phase === "ended") return true;
      const result = advanceShard(
        state,
        shard,
        fixedStepSeconds,
        playerStart,
        state.player.positionTiles,
      );
      if (result.hitPlayer) registerShardHit(state, shard, acceptedHits);
      return result.alive;
    });
    if (state.player.healthHp > 0) {
      updateSpawns(state);
      const existingCount = state.shards.length;
      updateAttacks(state);
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
    if (state.player.healthHp === 0) {
      state.accumulatorSeconds = 0;
      return {
        stepsExecuted,
        acceptedHits,
        discardedSeconds: Math.max(
          0,
          pendingSeconds - stepsExecuted * fixedStepSeconds,
        ),
      };
    }
  }
  state.accumulatorSeconds = remainderSeconds;
  return { stepsExecuted, discardedSeconds, acceptedHits };
}

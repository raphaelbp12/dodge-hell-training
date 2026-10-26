import {
  constrainBodyToArena,
  pursueBody,
  sweptConvexOverlap,
  transformBodyVertices,
} from "./geometry";
import {
  archetypeOf,
  ENCOUNTER_CONFIG,
  type EncounterConfig,
  type EnemyArchetype,
} from "../config/encounter";
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

/** Broadphase bound: player body plus the largest shard body across archetypes. */
function boundingRadiusTiles(config: EncounterConfig): number {
  const radius = (vertices: readonly Vector2[]): number =>
    Math.max(...vertices.map((vertex) => Math.hypot(vertex.x, vertex.y)));
  return (
    radius(config.player.verticesTiles) +
    Math.max(
      ...Object.values(config.archetypes).map((archetype) =>
        radius(archetype.weapon.shard.verticesTiles),
      ),
    )
  );
}
/**
 * Builds one enemy instance with its own attack and rotation clock anchored at
 * its spawn time, so a later arrival serves its own initial cooldown.
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
    emitterPhaseRadians: archetype.weapon.emitters.initialPhaseRadians,
    spawnedAtSeconds,
    attackEpochSeconds: spawnedAtSeconds,
    volleysAtEpoch: 0,
    attackInitialDelaySeconds: archetype.weapon.burst.initialCooldownSeconds,
    rotationEpochSeconds: spawnedAtSeconds,
    rotationPhaseAtEpoch: archetype.weapon.emitters.initialPhaseRadians,
    volleysFired: 0,
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
    if (rotationChanged) {
      enemy.rotationEpochSeconds = state.elapsedSeconds;
      enemy.rotationPhaseAtEpoch =
        settings.initialPhaseDegrees !== previous.initialPhaseDegrees
          ? archetype.weapon.emitters.initialPhaseRadians
          : enemy.emitterPhaseRadians;
      enemy.emitterPhaseRadians = enemy.rotationPhaseAtEpoch;
    }
    if (burstChanged) {
      enemy.attackEpochSeconds = state.elapsedSeconds;
      enemy.volleysAtEpoch = enemy.volleysFired;
      enemy.attackInitialDelaySeconds =
        enemy.volleysFired === 0
          ? settings.initialCooldownSeconds
          : settings.shotIntervalSeconds;
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
    archetypeOf(config, config.primaryArchetypeId).weapon,
  );
}

/**
 * Re-applies a weapon's fired-with values to shards already in flight and drops
 * any that the new lifetime has already expired.
 *
 * Damage, reversal age and lifetime are one category - values a shard was fired
 * with - so one rule governs all three (G09). This is the single write site for
 * that category outside `updateEnemyAttacks`, which is why it is a named
 * operation here rather than inline in the debug setter.
 */
export function restampLiveShards(
  shards: readonly ShardState[],
  weapon: EnemyArchetype["weapon"],
): ShardState[] {
  return shards.filter((shard) => {
    shard.damageHp = weapon.shard.damageHp;
    shard.reversalAgeSeconds = weapon.shard.reversalAgeSeconds;
    shard.lifetimeSeconds = weapon.shard.lifetimeSeconds;
    if (shard.ageSeconds >= shard.reversalAgeSeconds) shard.hasReversed = true;
    const speed =
      weapon.shard.speedTilesPerSecond * (shard.hasReversed ? -1 : 1);
    shard.velocityTilesPerSecond = {
      x: Math.cos(shard.orientationRadians) * speed,
      y: Math.sin(shard.orientationRadians) * speed,
    };
    return shard.ageSeconds < shard.lifetimeSeconds;
  });
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

function shardOverlapsPlayer(
  state: SimulationState,
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
    state.collisionBoundingRadiusTiles +
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
  return sweptConvexOverlap(
    transformBodyVertices(
      archetypeOf(state.config, shard.archetypeId).weapon.shard.verticesTiles,
      shardStart,
      shard.orientationRadians,
    ),
    { x: shardEnd.x - shardStart.x, y: shardEnd.y - shardStart.y },
    transformBodyVertices(state.config.player.verticesTiles, playerStart),
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
  state: SimulationState,
  shard: ShardState,
  elapsedSeconds: number,
  playerStart: Vector2,
  playerEnd: Vector2,
): boolean {
  const shardStart = shard.positionTiles;
  shard.positionTiles = {
    x: shard.positionTiles.x + shard.velocityTilesPerSecond.x * elapsedSeconds,
    y: shard.positionTiles.y + shard.velocityTilesPerSecond.y * elapsedSeconds,
  };
  return (
    !shard.hasHitPlayer &&
    shardOverlapsPlayer(
      state,
      shardStart,
      shard.positionTiles,
      playerStart,
      playerEnd,
      shard,
    )
  );
}

function advanceShard(
  state: SimulationState,
  shard: ShardState,
  elapsedSeconds: number,
  playerStart: Vector2,
  playerEnd: Vector2,
): { alive: boolean; hitPlayer: boolean } {
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
      state,
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
  return { alive: shard.ageSeconds < shard.lifetimeSeconds, hitPlayer };
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

function updateAttacks(state: SimulationState): void {
  const config = state.config;
  for (const enemy of state.enemies) updateEnemyAttacks(state, config, enemy);
}

/** Advances one enemy's rotation and fires its volley when its clock is due. */
function updateEnemyAttacks(
  state: SimulationState,
  config: EncounterConfig,
  enemy: EnemyState,
): void {
  const weapon = archetypeOf(config, enemy.archetypeId).weapon;
  enemy.emitterPhaseRadians =
    (enemy.rotationPhaseAtEpoch +
      ((state.elapsedSeconds - enemy.rotationEpochSeconds) *
        weapon.emitters.clockwiseDegreesPerSecond *
        Math.PI) /
        180) %
    fullTurnRadians;
  const { shotsPerEmitter, shotIntervalSeconds } = weapon.burst;
  const burstGroupSeconds =
    (shotsPerEmitter - 1) * shotIntervalSeconds +
    weapon.burst.cooldownAfterLastShotSeconds;
  const volleysSinceEpoch = enemy.volleysFired - enemy.volleysAtEpoch;
  const groupIndex = Math.floor(volleysSinceEpoch / shotsPerEmitter);
  const shotIndex = volleysSinceEpoch % shotsPerEmitter;
  const nextShotSeconds =
    enemy.attackEpochSeconds +
    enemy.attackInitialDelaySeconds +
    groupIndex * burstGroupSeconds +
    shotIndex * shotIntervalSeconds;
  const shotToleranceSeconds =
    Math.max(state.elapsedSeconds, nextShotSeconds) * Number.EPSILON * 16;
  if (state.elapsedSeconds + shotToleranceSeconds < nextShotSeconds) return;

  const { count, radiusTiles } = weapon.emitters;
  for (let emitter = 0; emitter < count; emitter++) {
    const angleRadians =
      enemy.emitterPhaseRadians + (emitter * fullTurnRadians) / count;
    const directionX = Math.cos(angleRadians);
    const directionY = Math.sin(angleRadians);
    state.shards.push({
      id: state.nextShardId++,
      archetypeId: enemy.archetypeId,
      orientationRadians: angleRadians,
      positionTiles: {
        x: enemy.positionTiles.x + directionX * radiusTiles,
        y: enemy.positionTiles.y + directionY * radiusTiles,
      },
      velocityTilesPerSecond: {
        x: directionX * weapon.shard.speedTilesPerSecond,
        y: directionY * weapon.shard.speedTilesPerSecond,
      },
      ageSeconds: 0,
      damageHp: weapon.shard.damageHp,
      reversalAgeSeconds: weapon.shard.reversalAgeSeconds,
      lifetimeSeconds: weapon.shard.lifetimeSeconds,
      hasReversed: false,
      hasHitPlayer: false,
    });
  }
  enemy.volleysFired++;
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

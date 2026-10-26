import {
  constrainBodyToArena,
  pursueBody,
  sweptConvexOverlap,
  transformBodyVertices,
} from "./geometry";
import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
  type EncounterConfig,
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

export type SimulationState = {
  config: EncounterConfig;
  debugSettings: DebugSettings;
  collisionBoundingRadiusTiles: number;
  attackEpochSeconds: number;
  volleysAtEpoch: number;
  attackInitialDelaySeconds: number;
  rotationEpochSeconds: number;
  rotationPhaseAtEpoch: number;
  nextShardId: number;
  rulesVersion: string;
  phase: "playing" | "ended";
  hitsTaken: number;
  player: PlayerState;
  enemy: EnemyState;
  shards: ShardState[];
  volleysFired: number;
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
export function createSimulation(): SimulationState {
  return {
    config: ENCOUNTER_CONFIG,
    debugSettings: DEFAULT_DEBUG_SETTINGS,
    collisionBoundingRadiusTiles: combinedBoundingRadiusTiles,
    attackEpochSeconds: 0,
    volleysAtEpoch: 0,
    attackInitialDelaySeconds:
      primaryArchetype(ENCOUNTER_CONFIG).weapon.burst.initialCooldownSeconds,
    rotationEpochSeconds: 0,
    rotationPhaseAtEpoch:
      primaryArchetype(ENCOUNTER_CONFIG).weapon.emitters.initialPhaseRadians,
    nextShardId: 1,
    rulesVersion: ENCOUNTER_CONFIG.rulesVersion,
    phase: "playing",
    hitsTaken: 0,
    player: {
      positionTiles: { ...ENCOUNTER_CONFIG.player.spawnTiles },
      healthHp: PALADIN_STATS.healthHp,
      combatRemainingSeconds: 0,
    },
    enemy: {
      positionTiles: { ...primaryArchetype(ENCOUNTER_CONFIG).spawnTiles },
      emitterPhaseRadians:
        primaryArchetype(ENCOUNTER_CONFIG).weapon.emitters.initialPhaseRadians,
    },
    shards: [],
    volleysFired: 0,
    ticksElapsed: 0,
    elapsedSeconds: 0,
    accumulatorSeconds: 0,
  };
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
  if (
    settings.rotationDegreesPerSecond !== previous.rotationDegreesPerSecond ||
    settings.initialPhaseDegrees !== previous.initialPhaseDegrees
  ) {
    state.rotationEpochSeconds = state.elapsedSeconds;
    state.rotationPhaseAtEpoch =
      settings.initialPhaseDegrees !== previous.initialPhaseDegrees
        ? primaryArchetype(config).weapon.emitters.initialPhaseRadians
        : state.enemy.emitterPhaseRadians;
    state.enemy.emitterPhaseRadians = state.rotationPhaseAtEpoch;
  }
  if (
    settings.shotsPerEmitter !== previous.shotsPerEmitter ||
    settings.shotIntervalSeconds !== previous.shotIntervalSeconds ||
    settings.cooldownSeconds !== previous.cooldownSeconds ||
    settings.initialCooldownSeconds !== previous.initialCooldownSeconds
  ) {
    state.attackEpochSeconds = state.elapsedSeconds;
    state.volleysAtEpoch = state.volleysFired;
    state.attackInitialDelaySeconds =
      state.volleysFired === 0
        ? settings.initialCooldownSeconds
        : settings.shotIntervalSeconds;
  }
  if (
    settings.spawnX !== previous.spawnX ||
    settings.spawnY !== previous.spawnY
  )
    state.enemy.positionTiles = { ...primaryArchetype(config).spawnTiles };
  state.player.positionTiles = constrainToArena(
    state.player.positionTiles,
    config.player.verticesTiles,
  );
  state.enemy.positionTiles = constrainToArena(
    state.enemy.positionTiles,
    primaryArchetype(config).verticesTiles,
  );
  state.collisionBoundingRadiusTiles = boundingRadiusTiles(config);
  state.shards = state.shards.filter((shard) => {
    shard.reversalAgeSeconds = settings.reversalSeconds;
    shard.lifetimeSeconds = settings.lifetimeSeconds;
    if (shard.ageSeconds >= shard.reversalAgeSeconds) shard.hasReversed = true;
    const speed =
      settings.projectileSpeedTilesPerSecond * (shard.hasReversed ? -1 : 1);
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

  state.enemy.positionTiles = constrainToArena(
    state.debugSettings.chaseArenaCenter
      ? (() => {
          const target = config.arena.centerTiles;
          const deltaX = target.x - state.enemy.positionTiles.x;
          const deltaY = target.y - state.enemy.positionTiles.y;
          const length = Math.hypot(deltaX, deltaY);
          const fraction =
            length === 0
              ? 0
              : Math.min(
                  1,
                  (primaryArchetype(config).speedTilesPerSecond *
                    stepSeconds) /
                    length,
                );
          return {
            x: state.enemy.positionTiles.x + deltaX * fraction,
            y: state.enemy.positionTiles.y + deltaY * fraction,
          };
        })()
      : pursueBody(
          primaryArchetype(config).verticesTiles,
          state.enemy.positionTiles,
          config.player.verticesTiles,
          state.player.positionTiles,
          primaryArchetype(config).speedTilesPerSecond * stepSeconds,
        ),
    primaryArchetype(config).verticesTiles,
  );
}

function shardOverlapsPlayer(
  state: SimulationState,
  shardStart: Vector2,
  shardEnd: Vector2,
  playerStart: Vector2,
  playerEnd: Vector2,
  orientationRadians: number,
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
      primaryArchetype(state.config).weapon.shard.verticesTiles,
      shardStart,
      orientationRadians,
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
      shard.orientationRadians,
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
  const damageHp = applyPlayerHit(
    state.player,
    primaryArchetype(state.config).weapon.shard.damageHp,
  );
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
  const weapon = primaryArchetype(config).weapon;
  state.enemy.emitterPhaseRadians =
    (state.rotationPhaseAtEpoch +
      ((state.elapsedSeconds - state.rotationEpochSeconds) *
        weapon.emitters.clockwiseDegreesPerSecond *
        Math.PI) /
        180) %
    fullTurnRadians;
  const { shotsPerEmitter, shotIntervalSeconds } = weapon.burst;
  const burstGroupSeconds =
    (shotsPerEmitter - 1) * shotIntervalSeconds +
    weapon.burst.cooldownAfterLastShotSeconds;
  const volleysSinceEpoch = state.volleysFired - state.volleysAtEpoch;
  const groupIndex = Math.floor(volleysSinceEpoch / shotsPerEmitter);
  const shotIndex = volleysSinceEpoch % shotsPerEmitter;
  const nextShotSeconds =
    state.attackEpochSeconds +
    state.attackInitialDelaySeconds +
    groupIndex * burstGroupSeconds +
    shotIndex * shotIntervalSeconds;
  const shotToleranceSeconds =
    Math.max(state.elapsedSeconds, nextShotSeconds) * Number.EPSILON * 16;
  if (state.elapsedSeconds + shotToleranceSeconds < nextShotSeconds) return;

  const { count, radiusTiles } = weapon.emitters;
  for (let emitter = 0; emitter < count; emitter++) {
    const angleRadians =
      state.enemy.emitterPhaseRadians + (emitter * fullTurnRadians) / count;
    const directionX = Math.cos(angleRadians);
    const directionY = Math.sin(angleRadians);
    state.shards.push({
      id: state.nextShardId++,
      orientationRadians: angleRadians,
      positionTiles: {
        x: state.enemy.positionTiles.x + directionX * radiusTiles,
        y: state.enemy.positionTiles.y + directionY * radiusTiles,
      },
      velocityTilesPerSecond: {
        x: directionX * weapon.shard.speedTilesPerSecond,
        y: directionY * weapon.shard.speedTilesPerSecond,
      },
      ageSeconds: 0,
      reversalAgeSeconds: weapon.shard.reversalAgeSeconds,
      lifetimeSeconds: weapon.shard.lifetimeSeconds,
      hasReversed: false,
      hasHitPlayer: false,
    });
  }
  state.volleysFired++;
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
            shard.orientationRadians,
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

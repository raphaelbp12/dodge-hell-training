import { ENCOUNTER_CONFIG } from "../config/encounter";
import {
  assertNonnegative,
  PALADIN_DERIVED_STATS,
  PALADIN_STATS,
} from "../config/stats";
import type {
  EnemyState,
  PlayerState,
  ShardState,
  SimulationInput,
  Vector2,
} from "../models";

export type SimulationState = {
  rulesVersion: string;
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
}>;

const timeRoundingToleranceSeconds =
  ENCOUNTER_CONFIG.simulation.fixedStepSeconds * Number.EPSILON * 16;
const fullTurnRadians = 2 * Math.PI;
const emitterRadiansPerSecond =
  (ENCOUNTER_CONFIG.emitters.clockwiseDegreesPerSecond * Math.PI) / 180;
const burstGroupSeconds =
  (ENCOUNTER_CONFIG.burst.shotsPerEmitter - 1) *
    ENCOUNTER_CONFIG.burst.shotIntervalSeconds +
  ENCOUNTER_CONFIG.burst.cooldownAfterLastShotSeconds;

export function createSimulation(): SimulationState {
  return {
    rulesVersion: ENCOUNTER_CONFIG.rulesVersion,
    player: {
      positionTiles: { ...ENCOUNTER_CONFIG.player.spawnTiles },
      healthHp: PALADIN_STATS.healthHp,
      combatRemainingSeconds: 0,
    },
    enemy: {
      positionTiles: { ...ENCOUNTER_CONFIG.enemy.spawnTiles },
      emitterPhaseRadians: ENCOUNTER_CONFIG.emitters.initialPhaseRadians,
    },
    shards: [],
    volleysFired: 0,
    ticksElapsed: 0,
    elapsedSeconds: 0,
    accumulatorSeconds: 0,
  };
}

function constrainToArena(
  positionTiles: Vector2,
  colliderRadiusTiles: number,
): Vector2 {
  const { centerTiles, radiusTiles } = ENCOUNTER_CONFIG.arena;
  const offsetX = positionTiles.x - centerTiles.x;
  const offsetY = positionTiles.y - centerTiles.y;
  const distanceTiles = Math.hypot(offsetX, offsetY);
  const centerLimitTiles = radiusTiles - colliderRadiusTiles;
  if (distanceTiles <= centerLimitTiles) return positionTiles;
  const scale = centerLimitTiles / distanceTiles;
  return {
    x: centerTiles.x + offsetX * scale,
    y: centerTiles.y + offsetY * scale,
  };
}

function updateMovement(state: SimulationState, input: SimulationInput): void {
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
    ENCOUNTER_CONFIG.player.colliderRadiusTiles,
  );

  const targetX = state.player.positionTiles.x - state.enemy.positionTiles.x;
  const targetY = state.player.positionTiles.y - state.enemy.positionTiles.y;
  const distanceTiles = Math.hypot(targetX, targetY);
  const { stopDistanceTiles, speedTilesPerSecond, colliderRadiusTiles } =
    ENCOUNTER_CONFIG.enemy;
  if (distanceTiles <= stopDistanceTiles) return;
  const enemyTravelTiles = Math.min(
    speedTilesPerSecond * stepSeconds,
    distanceTiles - stopDistanceTiles,
  );
  state.enemy.positionTiles = constrainToArena(
    {
      x:
        state.enemy.positionTiles.x +
        (targetX / distanceTiles) * enemyTravelTiles,
      y:
        state.enemy.positionTiles.y +
        (targetY / distanceTiles) * enemyTravelTiles,
    },
    colliderRadiusTiles,
  );
}

function moveShard(shard: ShardState, elapsedSeconds: number): void {
  shard.positionTiles = {
    x: shard.positionTiles.x + shard.velocityTilesPerSecond.x * elapsedSeconds,
    y: shard.positionTiles.y + shard.velocityTilesPerSecond.y * elapsedSeconds,
  };
}

function advanceShard(shard: ShardState, elapsedSeconds: number): boolean {
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
    moveShard(shard, shard.reversalAgeSeconds - shard.ageSeconds);
    shard.ageSeconds = shard.reversalAgeSeconds;
    shard.velocityTilesPerSecond = {
      x: -shard.velocityTilesPerSecond.x,
      y: -shard.velocityTilesPerSecond.y,
    };
    shard.hasReversed = true;
  }
  moveShard(shard, targetAgeSeconds - shard.ageSeconds);
  shard.ageSeconds = targetAgeSeconds;
  return shard.ageSeconds < shard.lifetimeSeconds;
}

function updateAttacks(state: SimulationState): void {
  state.enemy.emitterPhaseRadians =
    (ENCOUNTER_CONFIG.emitters.initialPhaseRadians +
      state.elapsedSeconds * emitterRadiansPerSecond) %
    fullTurnRadians;
  const { shotsPerEmitter, shotIntervalSeconds, initialCooldownSeconds } =
    ENCOUNTER_CONFIG.burst;
  const groupIndex = Math.floor(state.volleysFired / shotsPerEmitter);
  const shotIndex = state.volleysFired % shotsPerEmitter;
  const nextShotSeconds =
    initialCooldownSeconds +
    groupIndex * burstGroupSeconds +
    shotIndex * shotIntervalSeconds;
  const shotToleranceSeconds =
    Math.max(state.elapsedSeconds, nextShotSeconds) * Number.EPSILON * 16;
  if (state.elapsedSeconds + shotToleranceSeconds < nextShotSeconds) return;

  const { count, radiusTiles } = ENCOUNTER_CONFIG.emitters;
  for (let emitter = 0; emitter < count; emitter++) {
    const angleRadians =
      state.enemy.emitterPhaseRadians + (emitter * fullTurnRadians) / count;
    const directionX = Math.cos(angleRadians);
    const directionY = Math.sin(angleRadians);
    state.shards.push({
      id: state.volleysFired * count + emitter + 1,
      positionTiles: {
        x: state.enemy.positionTiles.x + directionX * radiusTiles,
        y: state.enemy.positionTiles.y + directionY * radiusTiles,
      },
      velocityTilesPerSecond: {
        x: directionX * ENCOUNTER_CONFIG.shard.speedTilesPerSecond,
        y: directionY * ENCOUNTER_CONFIG.shard.speedTilesPerSecond,
      },
      ageSeconds: 0,
      reversalAgeSeconds: ENCOUNTER_CONFIG.shard.reversalAgeSeconds,
      lifetimeSeconds: ENCOUNTER_CONFIG.shard.lifetimeSeconds,
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
  const pendingSeconds = state.accumulatorSeconds + elapsedSeconds;
  assertNonnegative(pendingSeconds, "pendingSeconds");
  const { fixedStepSeconds, maxStepsPerUpdate } = ENCOUNTER_CONFIG.simulation;
  const availableSteps = Math.floor(
    (pendingSeconds + timeRoundingToleranceSeconds) / fixedStepSeconds,
  );
  const stepsExecuted = Math.min(availableSteps, maxStepsPerUpdate);
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
          pendingSeconds - stepsExecuted * fixedStepSeconds - remainderSeconds,
        )
      : 0;

  for (let step = 0; step < stepsExecuted; step++) {
    updateMovement(state, input);
    state.shards = state.shards.filter((shard) =>
      advanceShard(shard, fixedStepSeconds),
    );
    state.ticksElapsed++;
    state.elapsedSeconds = state.ticksElapsed * fixedStepSeconds;
    updateAttacks(state);
  }
  state.accumulatorSeconds = remainderSeconds;
  return { stepsExecuted, discardedSeconds };
}

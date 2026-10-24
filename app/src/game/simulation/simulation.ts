import { ENCOUNTER_CONFIG } from "../config/encounter";
import {
  assertNonnegative,
  PALADIN_DERIVED_STATS,
  PALADIN_STATS,
} from "../config/stats";
import type {
  EnemyState,
  PlayerState,
  SimulationInput,
  Vector2,
} from "../models";

export type SimulationState = {
  rulesVersion: string;
  player: PlayerState;
  enemy: EnemyState;
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

  for (let step = 0; step < stepsExecuted; step++) updateMovement(state, input);
  state.accumulatorSeconds = remainderSeconds;
  state.ticksElapsed += stepsExecuted;
  state.elapsedSeconds = state.ticksElapsed * fixedStepSeconds;
  return { stepsExecuted, discardedSeconds };
}

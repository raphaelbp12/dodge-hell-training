import {
  constrainBodyToArena,
  pursueBody,
  sweptConvexOverlap,
  transformBodyVertices,
} from "./geometry";
import { ENCOUNTER_CONFIG } from "../config/encounter";
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
const combinedBoundingRadiusTiles =
  Math.max(
    ...ENCOUNTER_CONFIG.player.verticesTiles.map((vertex) =>
      Math.hypot(vertex.x, vertex.y),
    ),
  ) +
  Math.max(
    ...ENCOUNTER_CONFIG.shard.verticesTiles.map((vertex) =>
      Math.hypot(vertex.x, vertex.y),
    ),
  );
const emitterRadiansPerSecond =
  (ENCOUNTER_CONFIG.emitters.clockwiseDegreesPerSecond * Math.PI) / 180;
const burstGroupSeconds =
  (ENCOUNTER_CONFIG.burst.shotsPerEmitter - 1) *
    ENCOUNTER_CONFIG.burst.shotIntervalSeconds +
  ENCOUNTER_CONFIG.burst.cooldownAfterLastShotSeconds;

export function createSimulation(): SimulationState {
  return {
    rulesVersion: ENCOUNTER_CONFIG.rulesVersion,
    phase: "playing",
    hitsTaken: 0,
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
  verticesTiles: readonly Vector2[],
): Vector2 {
  return constrainBodyToArena(
    verticesTiles,
    positionTiles,
    ENCOUNTER_CONFIG.arena,
  );
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
    ENCOUNTER_CONFIG.player.verticesTiles,
  );

  state.enemy.positionTiles = constrainToArena(
    pursueBody(
      ENCOUNTER_CONFIG.enemy.verticesTiles,
      state.enemy.positionTiles,
      ENCOUNTER_CONFIG.player.verticesTiles,
      state.player.positionTiles,
      ENCOUNTER_CONFIG.enemy.speedTilesPerSecond * stepSeconds,
    ),
    ENCOUNTER_CONFIG.enemy.verticesTiles,
  );
}

function shardOverlapsPlayer(
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
    combinedBoundingRadiusTiles +
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
      ENCOUNTER_CONFIG.shard.verticesTiles,
      shardStart,
      orientationRadians,
    ),
    { x: shardEnd.x - shardStart.x, y: shardEnd.y - shardStart.y },
    transformBodyVertices(ENCOUNTER_CONFIG.player.verticesTiles, playerStart),
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
      shardStart,
      shard.positionTiles,
      playerStart,
      playerEnd,
      shard.orientationRadians,
    )
  );
}

function advanceShard(
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

function registerShardHit(state: SimulationState, shard: ShardState, acceptedHits: AcceptedHit[]): void {
  const damageHp = applyPlayerHit(state.player, ENCOUNTER_CONFIG.shard.damageHp);
  if (damageHp === null) return;
  shard.hasHitPlayer = true;
  state.hitsTaken++;
  acceptedHits.push({ shardId: shard.id, damageHp, positionTiles: { ...state.player.positionTiles } });
  if (state.player.healthHp === 0) state.phase = "ended";
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
      orientationRadians: angleRadians,
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

import { expect, test } from "vitest";
import { ENCOUNTER_CONFIG, validateEncounterConfig } from "../config/encounter";
import { PALADIN_DERIVED_STATS, PALADIN_STATS } from "../config/stats";
import type { ShardState, SimulationInput, Vector2 } from "../models";
import {
  advanceSimulation,
  createSimulation,
  setDebugSettings,
} from "./simulation.ts";
import {
  DEFAULT_DEBUG_SETTINGS,
  updateDebugParameter,
  loadSelectedDebugValues,
} from "../config/debug";
import {
  convexBodyFitsCircle,
  maximumBodyCenterDistance,
  transformBodyVertices,
} from "./geometry";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const east: SimulationInput = { ...idle, east: true };
const stepSeconds = 1 / 60;
const horizontalContactTiles =
  Math.max(...ENCOUNTER_CONFIG.player.verticesTiles.map((vertex) => vertex.x)) +
  Math.max(...ENCOUNTER_CONFIG.shard.verticesTiles.map((vertex) => vertex.x));
const verticalContactTiles =
  Math.max(...ENCOUNTER_CONFIG.player.verticesTiles.map((vertex) => vertex.y)) +
  Math.max(...ENCOUNTER_CONFIG.shard.verticesTiles.map((vertex) => vertex.y));

test("matched player size controls shard collision instead of the old larger preset body", () => {
  const state = createSimulation();
  setDebugSettings(state, {
    ...loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS),
    enemySpeedTilesPerSecond: 0,
    initialCooldownSeconds: 5,
  });
  state.shards.push({
    id: 999,
    positionTiles: { x: 1.45, y: 0 },
    velocityTilesPerSecond: { x: 0, y: 0 },
    orientationRadians: 0,
    ageSeconds: 0,
    reversalAgeSeconds: 1.5,
    lifetimeSeconds: 3,
    hasReversed: false,
    hasHitPlayer: false,
  });
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toEqual([]);
  expect(state.hitsTaken).toBe(0);
});

test("matched player size controls movement and immediate live-resize wall containment", () => {
  const state = createSimulation();
  const selected = {
    ...loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS),
    godMode: true,
  };
  setDebugSettings(state, selected);
  state.player.positionTiles = { x: 18.5, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeGreaterThan(18.5);
  setDebugSettings(state, { ...selected, enemyWidth: 5, enemyHeight: 5 });
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(
        state.config.player.verticesTiles,
        state.player.positionTiles,
      ),
      state.config.arena,
    ),
  ).toBe(true);
});

test("live debug settings suppress accepted hits, stop pursuit and target the arena center", () => {
  const state = createSimulation();
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    enemySpeedTilesPerSecond: 0,
  });
  const enemyStart = { ...state.enemy.positionTiles };
  state.shards.push({
    id: 1,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 0, y: 0 },
    orientationRadians: 0,
    ageSeconds: 0,
    reversalAgeSeconds: 1,
    lifetimeSeconds: 2,
    hasReversed: false,
    hasHitPlayer: false,
  });
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toEqual([]);
  expect(state.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(state.hitsTaken).toBe(0);
  expect(state.shards[0].hasHitPlayer).toBe(false);
  expect(state.enemy.positionTiles).toEqual(enemyStart);
  state.player.positionTiles = { x: 10, y: 0 };
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    chaseArenaCenter: true,
  });
  runTicks(state, 60);
  expect(state.enemy.positionTiles.x).toBeCloseTo(0, 12);
  expect(state.enemy.positionTiles.y).toBeGreaterThan(enemyStart.y);
  expect(state.rulesVersion).not.toBe(ENCOUNTER_CONFIG.rulesVersion);
});

test("live projectile edits preserve IDs and once-only reversal, and lifetime reductions expire existing shards", () => {
  const state = createSimulation();
  let settings = {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    initialCooldownSeconds: 0,
    enemySpeedTilesPerSecond: 0,
  };
  setDebugSettings(state, settings);
  runTicks(state, 2);
  const first = state.shards[0];
  const firstId = first.id;
  settings = {
    ...settings,
    emitterCount: 3,
    projectileSpeedTilesPerSecond: 12,
    reversalSeconds: 0.05,
  };
  setDebugSettings(state, settings);
  runTicks(state, 12);
  expect(
    Math.hypot(first.velocityTilesPerSecond.x, first.velocityTilesPerSecond.y),
  ).toBeCloseTo(12);
  expect(first.hasReversed).toBe(true);
  const returnedVelocity = { ...first.velocityTilesPerSecond };
  settings = { ...settings, reversalSeconds: 2 };
  setDebugSettings(state, settings);
  runTicks(state, 1);
  expect(first.velocityTilesPerSecond).toEqual(returnedVelocity);
  expect(first.id).toBe(firstId);
  expect(new Set(state.shards.map((shard) => shard.id)).size).toBe(
    state.shards.length,
  );
  const shortened = updateDebugParameter(settings, "lifetimeSeconds", 0.1);
  setDebugSettings(state, shortened);
  expect(state.shards.some((shard) => shard.id === firstId)).toBe(false);
  expect(
    state.shards.every((shard) => shard.ageSeconds < shard.lifetimeSeconds),
  ).toBe(true);
});

test("live burst edits re-anchor scheduling without a catch-up avalanche and rotation can stop", () => {
  const state = createSimulation();
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  runTicks(state, 600);
  const count = state.volleysFired;
  const phase = state.enemy.emitterPhaseRadians;
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    shotsPerEmitter: 1,
    shotIntervalSeconds: 0.05,
    cooldownSeconds: 0.05,
    rotationDegreesPerSecond: 0,
  });
  runTicks(state, 1);
  expect(state.volleysFired).toBe(count);
  expect(state.enemy.emitterPhaseRadians).toBe(phase);
  runTicks(state, 5);
  expect(state.volleysFired - count).toBe(2);
});

test("arena-center chase reaches the exact center and ignores the player silhouette", () => {
  const state = createSimulation();
  state.player.positionTiles = { x: 10, y: 0 };
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    chaseArenaCenter: true,
    enemySpeedTilesPerSecond: 12,
  });
  runTicks(state, 180);
  expect(state.enemy.positionTiles).toEqual(ENCOUNTER_CONFIG.arena.centerTiles);
});

test("activates the selected v3 preset and eleven-volley first group atomically", () => {
  expect(ENCOUNTER_CONFIG.rulesVersion).toBe(
    "crystal-worm-child-head-paladin-v3",
  );
  expect(ENCOUNTER_CONFIG.arena.radiusTiles).toBe(19.2);
  expect(ENCOUNTER_CONFIG.enemy.spawnTiles).toEqual({ x: 0, y: -16.2 });
  const state = createSimulation();
  for (let tick = 0; tick < 234; tick++) {
    state.player.healthHp = PALADIN_STATS.healthHp;
    advanceSimulation(state, stepSeconds, idle);
  }
  expect(state.volleysFired).toBe(11);
});

function distance(first: Vector2, second: Vector2 = { x: 0, y: 0 }): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function runTicks(
  state: ReturnType<typeof createSimulation>,
  count: number,
  input = idle,
): void {
  for (let tick = 0; tick < count; tick++)
    advanceSimulation(state, stepSeconds, input);
}

test("initializes independent deterministic state from the approved preset", () => {
  const first = createSimulation();
  const second = createSimulation();
  expect(first).toEqual(second);
  expect(first.rulesVersion).toBe(ENCOUNTER_CONFIG.rulesVersion);
  expect(first.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(first.enemy.positionTiles).toEqual({ x: 0, y: -16.2 });
  expect(first.enemy.emitterPhaseRadians).toBe(
    ENCOUNTER_CONFIG.emitters.initialPhaseRadians,
  );
  expect(first.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(first.player.combatRemainingSeconds).toBe(0);
  expect(first.elapsedSeconds).toBe(0);
  expect(first.ticksElapsed).toBe(0);
  expect(first.accumulatorSeconds).toBe(0);
  expect(first.player.positionTiles).not.toBe(second.player.positionTiles);
  expect(first.enemy.positionTiles).not.toBe(ENCOUNTER_CONFIG.enemy.spawnTiles);
  first.player.healthHp = 1;
  expect(second.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(typeof document).toBe("undefined");
});

test("uses the delegated 60 Hz, eight-step catch-up policy", () => {
  expect(ENCOUNTER_CONFIG.simulation).toEqual({
    fixedStepSeconds: stepSeconds,
    maxStepsPerUpdate: 8,
  });
});

test("does not advance movement or survival time without a full tick", () => {
  const state = createSimulation();
  expect(advanceSimulation(state, 0, east)).toEqual({
    stepsExecuted: 0,
    discardedSeconds: 0,
    acceptedHits: [],
  });
  advanceSimulation(state, stepSeconds / 4, east);
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(state.enemy.positionTiles).toEqual({ x: 0, y: -16.2 });
  expect(state.elapsedSeconds).toBe(0);
  expect(state.accumulatorSeconds).toBeCloseTo(stepSeconds / 4, 12);
  expect(
    advanceSimulation(state, (stepSeconds * 3) / 4, east).stepsExecuted,
  ).toBe(1);
  expect(state.elapsedSeconds).toBe(stepSeconds);
});

test.each([
  idle,
  { north: true, south: true, east: true, west: true },
  { ...idle, north: true, south: true },
  { ...idle, east: true, west: true },
])("no input or opposing inputs leave the player stationary: %j", (input) => {
  const state = createSimulation();
  runTicks(state, 60, input);
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(state.elapsedSeconds).toBe(1);
  expect(state.enemy.positionTiles.y).toBeCloseTo(-14.7, 9);
});

test.each([
  ["north", 0, -1],
  ["south", 0, 1],
  ["east", 1, 0],
  ["west", -1, 0],
] as const)("maps %s into world axes", (direction, expectedX, expectedY) => {
  const state = createSimulation();
  advanceSimulation(state, stepSeconds, { ...idle, [direction]: true });
  const movementTiles = PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds;
  expect(state.player.positionTiles.x).toBeCloseTo(
    expectedX * movementTiles,
    9,
  );
  expect(state.player.positionTiles.y).toBeCloseTo(
    expectedY * movementTiles,
    9,
  );
});

test("normalizes diagonals and cancels opposing inputs independently per axis", () => {
  const axial = createSimulation();
  const diagonal = createSimulation();
  const cancelled = createSimulation();
  runTicks(axial, 60, east);
  runTicks(diagonal, 60, { ...east, north: true });
  runTicks(cancelled, 60, { ...east, north: true, south: true });
  expect(distance(axial.player.positionTiles)).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond,
    9,
  );
  expect(distance(diagonal.player.positionTiles)).toBeCloseTo(
    distance(axial.player.positionTiles),
    9,
  );
  expect(diagonal.player.positionTiles.x).toBeCloseTo(
    -diagonal.player.positionTiles.y,
    9,
  );
  expect(cancelled.player.positionTiles).toEqual(axial.player.positionTiles);
});

test("moves the configured distance over 120 ticks and counts only simulated seconds", () => {
  const state = createSimulation();
  runTicks(state, 120, east);
  expect(state.player.positionTiles.x).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond * 2,
    9,
  );
  expect(state.elapsedSeconds).toBe(2);
  expect(state.ticksElapsed).toBe(120);
});

test("pursues the updated player position at the configured slower speed", () => {
  const state = createSimulation();
  const initialEnemy = state.enemy.positionTiles;
  advanceSimulation(state, stepSeconds, east);
  expect(state.enemy.positionTiles.x).toBeGreaterThan(0);
  expect(distance(state.enemy.positionTiles, initialEnemy)).toBeCloseTo(
    ENCOUNTER_CONFIG.enemy.speedTilesPerSecond * stepSeconds,
    9,
  );
  expect(distance(state.enemy.positionTiles, initialEnemy)).toBeLessThan(
    distance(state.player.positionTiles),
  );
  expect(
    distance(state.enemy.positionTiles, state.player.positionTiles),
  ).toBeLessThan(distance(initialEnemy, state.player.positionTiles));
});

test.each([-1.01, -1, -0.5, 0])(
  "stops without overshoot or division by zero from enemy y=%s",
  (enemyY) => {
    const state = createSimulation();
    state.enemy.positionTiles = { x: 0, y: enemyY };
    runTicks(state, 20);
    expect(state.enemy.positionTiles.x).toBe(0);
    expect(state.enemy.positionTiles.y).toBeCloseTo(enemyY, 9);
  },
);

test("body overlap neither damages nor blocks the player", () => {
  const state = createSimulation();
  state.player.positionTiles = { x: -0.01, y: 0 };
  state.enemy.positionTiles = { x: 0, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeCloseTo(
    -0.01 + PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds,
    9,
  );
  expect(state.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(state.player.combatRemainingSeconds).toBe(0);
});

test("constrains the player collider at the wall while permitting tangential movement", () => {
  const state = createSimulation();
  const limitTiles = maximumBodyCenterDistance(
    ENCOUNTER_CONFIG.player.verticesTiles,
    { x: 1, y: 0 },
    ENCOUNTER_CONFIG.arena.radiusTiles,
  );
  state.player.positionTiles = { x: limitTiles, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeCloseTo(limitTiles, 9);
  expect(state.player.positionTiles.y).toBe(0);
  advanceSimulation(state, stepSeconds, { ...idle, north: true });
  expect(state.player.positionTiles.y).toBeLessThan(0);
  expect(state.player.positionTiles.x).toBeLessThan(limitTiles);
  expect(
    convexBodyFitsCircle(
      transformBodyVertices(
        ENCOUNTER_CONFIG.player.verticesTiles,
        state.player.positionTiles,
      ),
      ENCOUNTER_CONFIG.arena,
    ),
  ).toBe(true);
});

test("keeps both collision extents inside the arena over repeated edge movement", () => {
  const state = createSimulation();
  state.enemy.positionTiles = { x: 15.4, y: 0 };
  for (let tick = 0; tick < 600; tick++) {
    advanceSimulation(state, stepSeconds, { ...east, south: true });
    expect(
      convexBodyFitsCircle(
        transformBodyVertices(
          ENCOUNTER_CONFIG.player.verticesTiles,
          state.player.positionTiles,
        ),
        ENCOUNTER_CONFIG.arena,
      ),
    ).toBe(true);
    expect(
      convexBodyFitsCircle(
        transformBodyVertices(
          ENCOUNTER_CONFIG.enemy.verticesTiles,
          state.enemy.positionTiles,
        ),
        ENCOUNTER_CONFIG.arena,
      ),
    ).toBe(true);
  }
});

test("equivalent elapsed time and constant input yield equivalent state across frame schedules", () => {
  const schedules = [
    Array<number>(60).fill(stepSeconds),
    Array<number>(120).fill(stepSeconds / 2),
    Array<number>(30).fill(stepSeconds * 2),
    Array<number>(20).fill(stepSeconds * 3),
    Array.from({ length: 12 }, () => [
      stepSeconds / 4,
      stepSeconds * 1.75,
      stepSeconds / 2,
      stepSeconds * 2.5,
    ]).flat(),
  ];
  const reference = createSimulation();
  runTicks(reference, 60, east);
  for (const schedule of schedules) {
    const state = createSimulation();
    for (const elapsedSeconds of schedule) {
      expect(
        advanceSimulation(state, elapsedSeconds, east).discardedSeconds,
      ).toBe(0);
    }
    expect(state.ticksElapsed).toBe(60);
    expect(state.elapsedSeconds).toBe(1);
    expect(state.accumulatorSeconds).toBeCloseTo(0, 12);
    expect(state.player.positionTiles.x).toBeCloseTo(
      reference.player.positionTiles.x,
      9,
    );
    expect(state.player.positionTiles.y).toBeCloseTo(
      reference.player.positionTiles.y,
      9,
    );
    expect(state.enemy.positionTiles.x).toBeCloseTo(
      reference.enemy.positionTiles.x,
      9,
    );
    expect(state.enemy.positionTiles.y).toBeCloseTo(
      reference.enemy.positionTiles.y,
      9,
    );
  }
});

test("caps catch-up, discards excess whole ticks, and never awards discarded survival time", () => {
  const state = createSimulation();
  const maximum = ENCOUNTER_CONFIG.simulation.maxStepsPerUpdate;
  const result = advanceSimulation(state, 1, east);
  expect(result.stepsExecuted).toBe(maximum);
  expect(result.discardedSeconds).toBeCloseTo(1 - maximum * stepSeconds, 12);
  expect(state.elapsedSeconds).toBe(maximum * stepSeconds);
  expect(state.player.positionTiles.x).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond * state.elapsedSeconds,
    9,
  );
  expect(advanceSimulation(state, 0, east).stepsExecuted).toBe(0);
});

test("retains a fractional remainder after dropping whole ticks without a delayed backlog", () => {
  const state = createSimulation();
  const maximum = ENCOUNTER_CONFIG.simulation.maxStepsPerUpdate;
  const result = advanceSimulation(state, (maximum + 3.5) * stepSeconds, east);
  expect(result.stepsExecuted).toBe(maximum);
  expect(result.discardedSeconds).toBeCloseTo(3 * stepSeconds, 12);
  expect(state.accumulatorSeconds).toBeCloseTo(stepSeconds / 2, 12);
  expect(advanceSimulation(state, stepSeconds / 2, east).stepsExecuted).toBe(1);
  expect(state.ticksElapsed).toBe(maximum + 1);
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "rejects invalid elapsed time %s without changing simulation state",
  (elapsedSeconds) => {
    const state = createSimulation();
    const before = structuredClone(state);
    expect(() => advanceSimulation(state, elapsedSeconds, east)).toThrow(
      RangeError,
    );
    expect(state).toEqual(before);
  },
);

test("bounds work even for a very large finite supplied duration", () => {
  const state = createSimulation();
  const result = advanceSimulation(state, Number.MAX_VALUE, east);
  expect(result.stepsExecuted).toBe(8);
  expect(Number.isFinite(result.discardedSeconds)).toBe(true);
  expect(state.accumulatorSeconds).toBeGreaterThanOrEqual(0);
  expect(state.accumulatorSeconds).toBeLessThan(stepSeconds);
  expect(state.elapsedSeconds).toBe(8 * stepSeconds);
});

test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid fixed step %s",
  (fixedStepSeconds) => {
    expect(() =>
      validateEncounterConfig({
        ...ENCOUNTER_CONFIG,
        simulation: { ...ENCOUNTER_CONFIG.simulation, fixedStepSeconds },
      }),
    ).toThrow(RangeError);
  },
);

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects invalid catch-up step limit %s",
  (maxStepsPerUpdate) => {
    expect(() =>
      validateEncounterConfig({
        ...ENCOUNTER_CONFIG,
        simulation: { ...ENCOUNTER_CONFIG.simulation, maxStepsPerUpdate },
      }),
    ).toThrow(RangeError);
  },
);

test("starts with independent empty shards and no shots before initial cooldown ends", () => {
  const state = createSimulation();
  expect(state.shards).toEqual([]);
  expect(state.shards).not.toBe(createSimulation().shards);
  expect(state.volleysFired).toBe(0);
  runTicks(state, 119);
  expect(state.shards).toEqual([]);
  expect(state.volleysFired).toBe(0);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.shards).toHaveLength(6);
  expect(state.volleysFired).toBe(1);
  expect(state.shards.every((shard) => shard.ageSeconds === 0)).toBe(true);
});

test("rotates clockwise from east toward south even during cooldown", () => {
  const state = createSimulation();
  runTicks(state, 60);
  expect(state.enemy.emitterPhaseRadians).toBeCloseTo(Math.PI / 4, 12);
  expect(Math.cos(state.enemy.emitterPhaseRadians)).toBeGreaterThan(0);
  expect(Math.sin(state.enemy.emitterPhaseRadians)).toBeGreaterThan(0);
  runTicks(state, 60);
  expect(state.shards[0].velocityTilesPerSecond.x).toBeCloseTo(0, 9);
  expect(state.shards[0].velocityTilesPerSecond.y).toBeCloseTo(8, 9);
  runTicks(state, 360);
  expect(state.enemy.emitterPhaseRadians).toBeCloseTo(0, 12);
});

test.each([0, 1, 2, 3, 4, 5])(
  "samples emitter %s at sixth-turn offsets from the current enemy",
  (emitter) => {
    const state = createSimulation();
    runTicks(state, 120);
    const shard = state.shards[emitter];
    const angle = Math.PI / 2 + (emitter * Math.PI) / 3;
    expect(shard.positionTiles.x).toBeCloseTo(
      state.enemy.positionTiles.x +
        Math.cos(angle) * ENCOUNTER_CONFIG.emitters.radiusTiles,
      9,
    );
    expect(shard.positionTiles.y).toBeCloseTo(
      state.enemy.positionTiles.y +
        Math.sin(angle) * ENCOUNTER_CONFIG.emitters.radiusTiles,
      9,
    );
    expect(shard.velocityTilesPerSecond.x).toBeCloseTo(Math.cos(angle) * 8, 9);
    expect(shard.velocityTilesPerSecond.y).toBeCloseTo(Math.sin(angle) * 8, 9);
    expect(shard).toEqual({
      id: emitter + 1,
      orientationRadians: angle,
      positionTiles: shard.positionTiles,
      velocityTilesPerSecond: shard.velocityTilesPerSecond,
      ageSeconds: 0,
      reversalAgeSeconds: ENCOUNTER_CONFIG.shard.reversalAgeSeconds,
      lifetimeSeconds: ENCOUNTER_CONFIG.shard.lifetimeSeconds,
      hasReversed: false,
      hasHitPlayer: false,
    });
  },
);

test("fires 66 shards on the first fixed tick at each scheduled shot, then waits three seconds", () => {
  const state = createSimulation();
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  runTicks(state, 120);
  for (let volley = 1; volley < 11; volley++) {
    const shotTime = 2 + volley * 0.19;
    const beforeTick = Math.ceil(shotTime / stepSeconds - 1e-9) - 1;
    runTicks(state, beforeTick - state.ticksElapsed);
    expect(state.shards).toHaveLength(volley * 6);
    advanceSimulation(state, stepSeconds, idle);
    expect(state.shards).toHaveLength((volley + 1) * 6);
    for (const shard of state.shards.slice(-6))
      expect(state.elapsedSeconds - shard.ageSeconds).toBeCloseTo(
        (beforeTick + 1) * stepSeconds,
        12,
      );
  }
  expect(new Set(state.shards.map((shard) => shard.id)).size).toBe(66);
  runTicks(state, 179);
  expect(state.volleysFired).toBe(11);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.elapsedSeconds).toBeCloseTo(6.9, 12);
  expect(state.volleysFired).toBe(12);
  expect(state.shards.slice(-6).map((shard) => shard.id)).toEqual([
    67, 68, 69, 70, 71, 72,
  ]);
});

test("resamples the moving enemy and rotated direction for later shots", () => {
  const state = createSimulation();
  runTicks(state, 120);
  const firstVelocity = { ...state.shards[0].velocityTilesPerSecond };
  const firstEnemy = { ...state.enemy.positionTiles };
  runTicks(state, 57, east);
  const shard = state.shards[30];
  const angle = (2.95 * Math.PI) / 4;
  expect(state.enemy.positionTiles).not.toEqual(firstEnemy);
  expect(shard.velocityTilesPerSecond).not.toEqual(firstVelocity);
  expect(shard.positionTiles.x).toBeCloseTo(
    state.enemy.positionTiles.x +
      Math.cos(angle) * ENCOUNTER_CONFIG.emitters.radiusTiles,
    9,
  );
  expect(shard.positionTiles.y).toBeCloseTo(
    state.enemy.positionTiles.y +
      Math.sin(angle) * ENCOUNTER_CONFIG.emitters.radiusTiles,
    9,
  );
  expect(shard.velocityTilesPerSecond.x).toBeLessThan(firstVelocity.x);
});

function makeShard(overrides: Partial<ShardState> = {}): ShardState {
  return {
    id: 100,
    orientationRadians: 0,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 8, y: 0 },
    ageSeconds: 0,
    reversalAgeSeconds: 1.2,
    lifetimeSeconds: 2.4,
    hasReversed: false,
    hasHitPlayer: false,
    ...overrides,
  };
}

test("accepted-hit output separates simultaneous hits from regeneration and spent returns", () => {
  const state = createSimulation();
  state.shards.push(makeShard({ id: 1 }), makeShard({ id: 2 }));
  const result = advanceSimulation(state, stepSeconds * 3, idle);
  expect(result.acceptedHits).toEqual([
    { shardId: 1, damageHp: 128, positionTiles: { x: 0, y: 0 } },
    { shardId: 2, damageHp: 128, positionTiles: { x: 0, y: 0 } },
  ]);
  expect(state.player.healthHp).toBeGreaterThan(775 - 256);
  expect(advanceSimulation(state, 0, idle).acceptedHits).toEqual([]);
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toEqual([]);
});

test("lethal output reports post-defense damage, not clamped HP, and stops later hits", () => {
  const state = createSimulation();
  state.player.healthHp = 1;
  state.shards.push(makeShard({ id: 1 }), makeShard({ id: 2 }));
  const result = advanceSimulation(state, stepSeconds * 8, idle);
  expect(result.acceptedHits).toEqual([
    { shardId: 1, damageHp: 128, positionTiles: { x: 0, y: 0 } },
  ]);
  expect(state.player.healthHp).toBe(0);
  expect(state.shards[1]!.hasHitPlayer).toBe(false);
  expect(advanceSimulation(state, 10, idle).acceptedHits).toEqual([]);
});

test("one advance collects accepted hits from later fixed ticks without a persistent log", () => {
  const state = createSimulation();
  state.shards.push(
    makeShard({ id: 1 }),
    makeShard({
      id: 2,
      positionTiles: { x: -(horizontalContactTiles + 0.9), y: 0 },
      velocityTilesPerSecond: { x: 20, y: 0 },
    }),
  );
  expect(
    advanceSimulation(state, stepSeconds * 3, idle).acceptedHits.map(
      (hit) => hit.shardId,
    ),
  ).toEqual([1, 2]);
  expect(state).not.toHaveProperty("acceptedHits");
});

test("moves outbound, reverses exactly at its boundary, and never reverses again", () => {
  const state = createSimulation();
  const shard = makeShard();
  state.shards.push(shard);
  runTicks(state, 71);
  expect(shard.hasReversed).toBe(false);
  expect(shard.positionTiles.x).toBeCloseTo((8 * 71) / 60, 9);
  runTicks(state, 1);
  expect(shard.ageSeconds).toBeCloseTo(1.2, 12);
  expect(shard.positionTiles.x).toBeCloseTo(9.6, 9);
  expect(shard.hasReversed).toBe(true);
  expect(shard.velocityTilesPerSecond).toEqual({ x: -8, y: -0 });
  runTicks(state, 30);
  expect(shard.positionTiles.x).toBeCloseTo(5.6, 9);
  expect(shard.velocityTilesPerSecond.x).toBe(-8);
});

test("splits a tick spanning reversal into outbound and return segments", () => {
  const state = createSimulation();
  const outboundSeconds = stepSeconds / 4;
  const shard = makeShard({ ageSeconds: 1.2 - outboundSeconds });
  state.shards.push(shard);
  runTicks(state, 1);
  expect(shard.positionTiles.x).toBeCloseTo(
    8 * (2 * outboundSeconds - stepSeconds),
    12,
  );
  expect(shard.ageSeconds).toBeCloseTo(1.2 + stepSeconds - outboundSeconds, 12);
  expect(shard.hasReversed).toBe(true);
});

test("splits movement at expiry, removes only then, and does not move an expired shard further", () => {
  const state = createSimulation();
  const shard = makeShard({
    ageSeconds: 2.4 - stepSeconds / 4,
    velocityTilesPerSecond: { x: -8, y: 0 },
    hasReversed: true,
  });
  state.shards.push(shard);
  runTicks(state, 1);
  expect(state.shards).not.toContain(shard);
  expect(shard.ageSeconds).toBe(2.4);
  expect(shard.positionTiles.x).toBeCloseTo((-8 * stepSeconds) / 4, 12);
  const finalPosition = { ...shard.positionTiles };
  runTicks(state, 1);
  expect(shard.positionTiles).toEqual(finalPosition);
});

test("handles reversal and expiry within the same tick", () => {
  const state = createSimulation();
  const shard = makeShard({
    reversalAgeSeconds: stepSeconds / 4,
    lifetimeSeconds: (stepSeconds * 3) / 4,
  });
  state.shards.push(shard);
  runTicks(state, 1);
  expect(shard.hasReversed).toBe(true);
  expect(shard.ageSeconds).toBe(shard.lifetimeSeconds);
  expect(shard.positionTiles.x).toBeCloseTo((-8 * stepSeconds) / 4, 12);
  expect(state.shards).toEqual([]);
});

test.each([false, true])(
  "keeps shards outside the arena and at the player regardless of hit flag %s",
  (hasHitPlayer) => {
    const state = createSimulation();
    const outside = makeShard({
      positionTiles: { x: 1000, y: 0 },
      hasHitPlayer,
    });
    const overlap = makeShard({
      id: 101,
      positionTiles: { ...state.player.positionTiles },
      hasHitPlayer,
    });
    state.shards.push(outside, overlap);
    runTicks(state, 1);
    expect(state.shards).toEqual([outside, overlap]);
    expect(outside.positionTiles.x).toBeGreaterThan(1000);
    expect(outside.hasHitPlayer).toBe(hasHitPlayer);
    expect(overlap.hasHitPlayer).toBe(true);
    expect(state.hitsTaken).toBe(Number(!hasHitPlayer));
    expect(state.player.healthHp).toBeCloseTo(
      hasHitPlayer ? PALADIN_STATS.healthHp : 775 - 128 + 6.0547 * stepSeconds,
      10,
    );
  },
);

test("returns to its emission point without an origin field or following later enemy movement", () => {
  const state = createSimulation();
  runTicks(state, 120);
  const shard = state.shards[0];
  const emissionPoint = { ...shard.positionTiles };
  state.enemy.positionTiles = { x: -12, y: 0 };
  const reversalTicks = Math.floor(shard.reversalAgeSeconds / stepSeconds);
  runTicks(state, reversalTicks, east);
  expect(shard.positionTiles.x).toBeCloseTo(emissionPoint.x, 9);
  expect(shard.positionTiles.y).toBeCloseTo(
    emissionPoint.y + reversalTicks * stepSeconds * 8,
    9,
  );
  const orientation = shard.orientationRadians;
  runTicks(
    state,
    Math.ceil(shard.lifetimeSeconds / stepSeconds) - reversalTicks,
  );
  expect(state.shards).not.toContain(shard);
  expect(shard.positionTiles.x).toBeCloseTo(emissionPoint.x, 9);
  expect(shard.positionTiles.y).toBeCloseTo(emissionPoint.y, 9);
  expect(shard.ageSeconds).toBe(shard.lifetimeSeconds);
  expect(shard.orientationRadians).toBe(orientation);
  expect(shard).not.toHaveProperty("origin");
  expect(shard).not.toHaveProperty("originTiles");
});

test("shot times and shard state agree across render-frame schedules over several groups", () => {
  const schedules = [
    Array<number>(600).fill(stepSeconds),
    Array<number>(1200).fill(stepSeconds / 2),
    Array<number>(300).fill(stepSeconds * 2),
    Array<number>(200).fill(stepSeconds * 3),
    Array.from({ length: 120 }, () => [
      stepSeconds / 4,
      stepSeconds * 1.75,
      stepSeconds / 2,
      stepSeconds * 2.5,
    ]).flat(),
  ];
  const reference = createSimulation();
  runTicks(reference, 600, east);
  expect(reference.volleysFired).toBe(22);
  for (const schedule of schedules) {
    const state = createSimulation();
    const observedShotTimes = new Map<number, number>();
    for (const elapsedSeconds of schedule) {
      advanceSimulation(state, elapsedSeconds, east);
      for (const shard of state.shards) {
        if (!observedShotTimes.has(shard.id))
          observedShotTimes.set(
            shard.id,
            state.elapsedSeconds - shard.ageSeconds,
          );
      }
    }
    expect(observedShotTimes.size).toBe(132);
    for (const [id, shotTime] of observedShotTimes) {
      const volley = Math.floor((id - 1) / 6);
      const scheduledTime =
        2 + Math.floor(volley / 11) * 4.9 + (volley % 11) * 0.19;
      expect(shotTime).toBeCloseTo(
        Math.ceil(scheduledTime / stepSeconds - 1e-9) * stepSeconds,
        12,
      );
    }
    expect(state).toEqual(reference);
  }
});

test("five-minute moving encounters stay bounded and agree at 30/60/120 Hz", () => {
  const validationSeconds = 5 * 60;
  const movementSegmentSeconds = 4;
  const route: SimulationInput[] = [
    east,
    { ...idle, south: true },
    { ...idle, west: true },
    { ...idle, north: true },
  ];
  const groupPeriodSeconds =
    (ENCOUNTER_CONFIG.burst.shotsPerEmitter - 1) *
      ENCOUNTER_CONFIG.burst.shotIntervalSeconds +
    ENCOUNTER_CONFIG.burst.cooldownAfterLastShotSeconds;
  const shardBound =
    ENCOUNTER_CONFIG.emitters.count *
    ENCOUNTER_CONFIG.burst.shotsPerEmitter *
    Math.ceil(ENCOUNTER_CONFIG.shard.lifetimeSeconds / groupPeriodSeconds);
  let reference: ReturnType<typeof createSimulation> | undefined;
  for (const frameRate of [60, 30, 120]) {
    const state = createSimulation();
    let peakShards = 0;
    let maximumAgeSeconds = 0;
    let discardedSeconds = 0;
    const observedShardIds = new Set<number>();
    for (let frame = 0; frame < validationSeconds * frameRate; frame++) {
      const direction =
        route[
          Math.floor(frame / (movementSegmentSeconds * frameRate)) %
            route.length
        ]!;
      state.player.healthHp = PALADIN_STATS.healthHp;
      discardedSeconds += advanceSimulation(
        state,
        1 / frameRate,
        direction,
      ).discardedSeconds;
      peakShards = Math.max(peakShards, state.shards.length);
      for (const shard of state.shards) {
        observedShardIds.add(shard.id);
        maximumAgeSeconds = Math.max(maximumAgeSeconds, shard.ageSeconds);
      }
    }
    expect(state.phase).toBe("playing");
    expect(state.elapsedSeconds).toBe(validationSeconds);
    expect(state.ticksElapsed).toBe(validationSeconds / stepSeconds);
    expect(state.volleysFired).toBe(671);
    expect(observedShardIds.size).toBe(
      state.volleysFired * ENCOUNTER_CONFIG.emitters.count,
    );
    expect(peakShards).toBeLessThanOrEqual(shardBound);
    expect(peakShards).toBeGreaterThan(44);
    expect(maximumAgeSeconds).toBeLessThan(
      ENCOUNTER_CONFIG.shard.lifetimeSeconds,
    );
    expect(discardedSeconds).toBe(0);
    if (reference) expect(state).toEqual(reference);
    else reference = state;
  }
}, 60000);

test("discarded time advances neither rotation nor the attack scheduler", () => {
  const state = createSimulation();
  const shard = makeShard();
  state.shards.push(shard);
  advanceSimulation(state, 20, idle);
  expect(state.volleysFired).toBe(0);
  expect(state.shards).toEqual([shard]);
  expect(shard.ageSeconds).toBeCloseTo(8 * stepSeconds, 12);
  expect(shard.positionTiles.x).toBeCloseTo(8 * 8 * stepSeconds, 9);
  expect(state.enemy.emitterPhaseRadians).toBeCloseTo(
    (state.elapsedSeconds * Math.PI) / 4,
    12,
  );
});

test("initializes a live simulation with no registered hits", () => {
  const state = createSimulation();
  expect(state.phase).toBe("playing");
  expect(state.hitsTaken).toBe(0);
});

test("applies one defense-reduced hit before fractional in-combat regeneration without removing the shard", () => {
  const state = createSimulation();
  const shard = makeShard();
  state.shards.push(shard);
  runTicks(state, 1);
  expect(shard.hasHitPlayer).toBe(true);
  expect(state.shards).toContain(shard);
  expect(state.hitsTaken).toBe(1);
  expect(state.player.healthHp).toBeCloseTo(
    775 - 128 + 6.0547 * stepSeconds,
    10,
  );
  expect(state.player.combatRemainingSeconds).toBeCloseTo(
    5.32 - stepSeconds,
    12,
  );
});

test("repeated overlap never reapplies damage or refreshes combat for the same shard", () => {
  const state = createSimulation();
  const shard = makeShard({ velocityTilesPerSecond: { x: 0, y: 0 } });
  state.shards.push(shard);
  runTicks(state, 60);
  expect(state.hitsTaken).toBe(1);
  expect(state.player.healthHp).toBeCloseTo(775 - 128 + 6.0547, 9);
  expect(state.player.combatRemainingSeconds).toBeCloseTo(4.32, 10);
  expect(state.shards).toContain(shard);
});

test("independent shards can each hit in one tick without global invulnerability", () => {
  const state = createSimulation();
  state.shards.push(makeShard({ id: 1 }), makeShard({ id: 2 }));
  runTicks(state, 1);
  expect(state.hitsTaken).toBe(2);
  expect(state.player.healthHp).toBeCloseTo(
    775 - 256 + 6.0547 * stepSeconds,
    10,
  );
  expect(state.shards.every((shard) => shard.hasHitPlayer)).toBe(true);
  expect(state.shards).toHaveLength(2);
});

test.each([
  [0, true],
  [verticalContactTiles, true],
  [verticalContactTiles + 0.000001, false],
] as const)(
  "sweeps a fast shard at y=%s against actual polygon extents",
  (offsetY, expectedHit) => {
    const state = createSimulation();
    const shard = makeShard({
      positionTiles: { x: -2, y: offsetY },
      velocityTilesPerSecond: { x: 240, y: 0 },
    });
    state.shards.push(shard);
    runTicks(state, 1);
    expect(shard.positionTiles.x).toBe(2);
    expect(shard.hasHitPlayer).toBe(expectedHit);
    expect(state.hitsTaken).toBe(Number(expectedHit));
  },
);

test("detects a stationary shard during player movement", () => {
  const state = createSimulation();
  const travelTiles = PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds;
  state.player.positionTiles = { x: -travelTiles / 2, y: 0 };
  const shard = makeShard({
    positionTiles: { x: 0, y: 0.399 },
    velocityTilesPerSecond: { x: 0, y: 0 },
  });
  expect(
    distance(state.player.positionTiles, shard.positionTiles),
  ).toBeGreaterThan(0.4);
  state.shards.push(shard);
  runTicks(state, 1, east);
  expect(
    distance(state.player.positionTiles, shard.positionTiles),
  ).toBeGreaterThan(0.4);
  expect(state.hitsTaken).toBe(1);
});

test("does not confuse crossing world paths at different times with a relative-motion hit", () => {
  const state = createSimulation();
  const travelTiles = PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds;
  state.player.positionTiles = { x: -horizontalContactTiles - 0.05, y: 0 };
  const shard = makeShard({
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: travelTiles / stepSeconds, y: 0 },
  });
  state.shards.push(shard);
  runTicks(state, 1, east);
  expect(state.hitsTaken).toBe(0);
});

test("detects the outbound excursion of a reversal tick even when the endpoints coincide", () => {
  const state = createSimulation();
  const shard = makeShard({
    positionTiles: { x: -1, y: 0 },
    velocityTilesPerSecond: { x: 240, y: 0 },
    ageSeconds: 1.2 - stepSeconds / 2,
  });
  state.shards.push(shard);
  runTicks(state, 1);
  expect(shard.positionTiles.x).toBeCloseTo(-1, 10);
  expect(shard.hasReversed).toBe(true);
  expect(shard.hasHitPlayer).toBe(true);
  expect(state.hitsTaken).toBe(1);
});

test("detects a return-only crossing within a reversal tick", () => {
  const state = createSimulation();
  const shard = makeShard({
    positionTiles: { x: 1, y: 0 },
    velocityTilesPerSecond: { x: 240, y: 0 },
    ageSeconds: 1.2 - stepSeconds / 4,
  });
  state.shards.push(shard);
  runTicks(state, 1);
  expect(shard.positionTiles.x).toBeCloseTo(-1, 10);
  expect(state.hitsTaken).toBe(1);
});

test("never hits again when a previously consumed shard returns through the player", () => {
  const state = createSimulation();
  const shard = makeShard();
  state.shards.push(shard);
  runTicks(state, 144);
  expect(state.hitsTaken).toBe(1);
  expect(shard.hasHitPlayer).toBe(true);
  expect(shard.positionTiles.x).toBeCloseTo(0, 9);
  expect(state.shards).not.toContain(shard);
});

test.each([
  [-horizontalContactTiles - 0.1, true],
  [-horizontalContactTiles - 0.6, false],
] as const)(
  "checks only the live part of an expiring shard path from x=%s",
  (startX, expectedHit) => {
    const state = createSimulation();
    const shard = makeShard({
      positionTiles: { x: startX, y: 0 },
      velocityTilesPerSecond: { x: 120, y: 0 },
      ageSeconds: 2.4 - stepSeconds / 4,
      hasReversed: true,
    });
    state.shards.push(shard);
    runTicks(state, 1);
    expect(shard.hasHitPlayer).toBe(expectedHit);
    expect(state.hitsTaken).toBe(Number(expectedHit));
    expect(state.shards).not.toContain(shard);
  },
);

test("does not extend the player's sweep past a shard's expiry", () => {
  const state = createSimulation();
  state.player.positionTiles = { x: -horizontalContactTiles - 0.08, y: 0 };
  state.shards.push(
    makeShard({
      velocityTilesPerSecond: { x: 0, y: 0 },
      ageSeconds: 2.4 - stepSeconds / 4,
      hasReversed: true,
    }),
  );
  runTicks(state, 1, east);
  expect(state.player.positionTiles.x).toBeGreaterThan(-horizontalContactTiles);
  expect(state.hitsTaken).toBe(0);
});

test("uses the matching portion of player movement for each reversal segment", () => {
  const state = createSimulation();
  state.player.positionTiles = { x: -horizontalContactTiles - 0.1, y: 0 };
  state.shards.push(
    makeShard({
      positionTiles: { x: -0.07, y: 0 },
      ageSeconds: 1.2 - stepSeconds * 0.9,
    }),
  );
  runTicks(state, 1, east);
  expect(state.hitsTaken).toBe(0);
});

test("regenerates fractionally at the normal rate and caps health", () => {
  const state = createSimulation();
  state.player.healthHp = 700;
  runTicks(state, 60);
  expect(state.player.healthHp).toBeCloseTo(712.1094, 9);
  state.player.healthHp = 774.99;
  runTicks(state, 1);
  expect(state.player.healthHp).toBe(775);
});

test("splits regeneration when combat expires partway through a tick", () => {
  const state = createSimulation();
  state.player.healthHp = 700;
  state.player.combatRemainingSeconds = stepSeconds / 4;
  runTicks(state, 1);
  expect(state.player.healthHp).toBeCloseTo(
    700 + (6.0547 * stepSeconds) / 4 + (12.1094 * stepSeconds * 3) / 4,
    10,
  );
  expect(state.player.combatRemainingSeconds).toBe(0);
});

test("a fresh qualifying hit refreshes combat before regeneration spans the old expiry", () => {
  const state = createSimulation();
  state.player.combatRemainingSeconds = stepSeconds / 4;
  state.shards.push(makeShard());
  runTicks(state, 1);
  expect(state.player.healthHp).toBeCloseTo(647 + 6.0547 * stepSeconds, 10);
  expect(state.player.combatRemainingSeconds).toBeCloseTo(
    5.32 - stepSeconds,
    12,
  );
});

test("stops on lethal damage in stable spawn order before later hits or regeneration", () => {
  const state = createSimulation();
  state.player.healthHp = 128;
  const first = makeShard({ id: 1 });
  const later = makeShard({ id: 2 });
  state.shards.push(first, later);
  const result = advanceSimulation(state, stepSeconds * 3.5, idle);
  expect(state.phase).toBe("ended");
  expect(state.player.healthHp).toBe(0);
  expect(state.hitsTaken).toBe(1);
  expect(first.hasHitPlayer).toBe(true);
  expect(later.hasHitPlayer).toBe(false);
  expect(state.shards).toContain(first);
  expect(state.elapsedSeconds).toBe(stepSeconds);
  expect(state.ticksElapsed).toBe(1);
  expect(state.accumulatorSeconds).toBe(0);
  expect(result.stepsExecuted).toBe(1);
});

test("includes the lethal tick in survival time and freezes all state after death", () => {
  const state = createSimulation();
  runTicks(state, 5);
  state.player.healthHp = 1;
  state.shards.push(makeShard());
  runTicks(state, 1);
  expect(state.elapsedSeconds).toBe(6 * stepSeconds);
  expect(state.player.healthHp).toBe(0);
  const ended = structuredClone(state);
  for (const duration of [0, stepSeconds / 2, stepSeconds, 100]) {
    expect(advanceSimulation(state, duration, east).stepsExecuted).toBe(0);
    expect(state).toEqual(ended);
  }
});

test("checks newborn overlap at the exact firing boundary", () => {
  const state = createSimulation();
  runTicks(state, 119);
  state.enemy.positionTiles = { x: 0, y: 0 };
  state.player.positionTiles = { x: 0, y: 0.75 };
  runTicks(state, 1);
  expect(state.elapsedSeconds).toBe(2);
  expect(state.shards).toHaveLength(6);
  expect(state.shards[0].ageSeconds).toBe(0);
  expect(state.shards[0].hasHitPlayer).toBe(true);
  expect(state.hitsTaken).toBe(6);
  expect(state.player.healthHp).toBeCloseTo(
    775 - 6 * 128 + 6.0547 * stepSeconds,
    10,
  );
});

test("a lethal boundary-spawn hit prevents later newborn hits and regeneration", () => {
  const state = createSimulation();
  runTicks(state, 119);
  state.enemy.positionTiles = { x: 0, y: 0 };
  state.player.positionTiles = { x: 0, y: 0.75 };
  state.player.healthHp = 128;
  runTicks(state, 1);
  expect(state.phase).toBe("ended");
  expect(state.elapsedSeconds).toBe(2);
  expect(state.player.healthHp).toBe(0);
  expect(state.hitsTaken).toBe(1);
  expect(state.shards.filter((shard) => shard.hasHitPlayer)).toHaveLength(1);
  expect(state.shards).toHaveLength(6);
});

test("does not sweep a newborn shard against player movement before its firing time", () => {
  const state = createSimulation();
  runTicks(state, 119);
  state.enemy.positionTiles = { x: 0, y: 0 };
  state.player.positionTiles = {
    x: horizontalContactTiles + ENCOUNTER_CONFIG.emitters.radiusTiles + 0.01,
    y: 0,
  };
  runTicks(state, 1, east);
  expect(state.player.positionTiles.x).toBeGreaterThan(
    horizontalContactTiles + ENCOUNTER_CONFIG.emitters.radiusTiles + 0.025,
  );
  expect(state.shards).toHaveLength(6);
  expect(state.shards.every((shard) => shard.ageSeconds === 0)).toBe(true);
  expect(state.hitsTaken).toBe(0);
  expect(state.player.healthHp).toBe(775);
});

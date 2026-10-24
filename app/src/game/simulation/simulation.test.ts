import { expect, test } from "vitest";
import { ENCOUNTER_CONFIG, validateEncounterConfig } from "../config/encounter";
import { PALADIN_DERIVED_STATS, PALADIN_STATS } from "../config/stats";
import type { SimulationInput, Vector2 } from "../models";
import { advanceSimulation, createSimulation } from "./simulation";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const east: SimulationInput = { ...idle, east: true };
const stepSeconds = 1 / 60;

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
  expect(first.enemy.positionTiles).toEqual({ x: 0, y: -13 });
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
  });
  advanceSimulation(state, stepSeconds / 4, east);
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(state.enemy.positionTiles).toEqual({ x: 0, y: -13 });
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
  expect(state.enemy.positionTiles.y).toBeCloseTo(-11.5, 9);
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
    expect(state.enemy.positionTiles.y).toBeCloseTo(Math.max(enemyY, -1), 9);
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
  const limitTiles =
    ENCOUNTER_CONFIG.arena.radiusTiles -
    ENCOUNTER_CONFIG.player.colliderRadiusTiles;
  state.player.positionTiles = { x: limitTiles, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeCloseTo(limitTiles, 9);
  expect(state.player.positionTiles.y).toBe(0);
  advanceSimulation(state, stepSeconds, { ...idle, north: true });
  expect(state.player.positionTiles.y).toBeLessThan(0);
  expect(state.player.positionTiles.x).toBeLessThan(limitTiles);
  expect(distance(state.player.positionTiles)).toBeCloseTo(limitTiles, 9);
});

test("keeps both collision extents inside the arena over repeated edge movement", () => {
  const state = createSimulation();
  state.enemy.positionTiles = { x: 15.4, y: 0 };
  for (let tick = 0; tick < 600; tick++) {
    advanceSimulation(state, stepSeconds, { ...east, south: true });
    expect(
      distance(state.player.positionTiles) +
        ENCOUNTER_CONFIG.player.colliderRadiusTiles,
    ).toBeLessThanOrEqual(16 + 1e-9);
    expect(
      distance(state.enemy.positionTiles) +
        ENCOUNTER_CONFIG.enemy.colliderRadiusTiles,
    ).toBeLessThanOrEqual(16 + 1e-9);
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

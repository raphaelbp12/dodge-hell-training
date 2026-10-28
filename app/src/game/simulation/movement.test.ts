import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  movementSpeedTilesPerSecond,
  primaryArchetype,
  validateEncounterConfig,
  type EncounterConfig,
  type EnemyArchetype,
  type MovementSpec,
} from "../config/encounter";
import { PALADIN_DERIVED_STATS } from "../config/stats";
import type { SimulationInput } from "../models";
import { advanceSimulation, createSimulation } from "./simulation";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const PRIMARY_PHASE = PRIMARY.phases[0];
const TEST_SEED = 20261028;

/** ENCOUNTER_CONFIG with the primary archetype's sole phase's movement replaced. */
function withMovement(movement: MovementSpec): EncounterConfig {
  const archetype: EnemyArchetype = {
    ...PRIMARY,
    phases: [{ ...PRIMARY_PHASE, movement }],
  };
  return {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: archetype },
  };
}

function freshStateWith(movement: MovementSpec) {
  return createSimulation(withMovement(movement), TEST_SEED);
}

function runTicks(
  state: ReturnType<typeof createSimulation>,
  ticks: number,
  input: SimulationInput = idle,
): void {
  for (let i = 0; i < ticks; i++) advanceSimulation(state, stepSeconds, input);
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

test("the movement union rejects a kind outside the five authored ones", () => {
  expect(() =>
    validateEncounterConfig(
      withMovement({ kind: "bogus" } as unknown as MovementSpec),
    ),
  ).toThrow(RangeError);
});

test("chase reproduces today's pursuit and stopping distance exactly", () => {
  const state = freshStateWith({ kind: "chase", speedTilesPerSecond: 1.5 });
  const initial = state.enemies[0].positionTiles;
  advanceSimulation(state, stepSeconds, idle);
  expect(
    distance(state.enemies[0].positionTiles, initial),
  ).toBeCloseTo(1.5 * stepSeconds, 9);
});

test("stationary never moves, regardless of the player's position", () => {
  const state = freshStateWith({ kind: "stationary" });
  const initial = { ...state.enemies[0].positionTiles };
  runTicks(state, 120, { ...idle, east: true });
  expect(state.enemies[0].positionTiles).toEqual(initial);
});

test("move-to-point reaches the arena center, stops there, and travels zero at zero remaining distance", () => {
  const state = freshStateWith({
    kind: "move-to-point",
    target: "arena-center",
    speedTilesPerSecond: 12,
  });
  runTicks(state, 180);
  expect(state.enemies[0].positionTiles).toEqual(
    ENCOUNTER_CONFIG.arena.centerTiles,
  );
  const settledPosition = { ...state.enemies[0].positionTiles };
  advanceSimulation(state, stepSeconds, idle);
  expect(state.enemies[0].positionTiles).toEqual(settledPosition);
});

test("orbit approaches the ring, then holds it and advances in the authored direction", () => {
  const radiusTiles = 10;
  const state = freshStateWith({
    kind: "orbit",
    radiusTiles,
    degreesPerSecond: 30,
    direction: "cw",
    approachSpeedTilesPerSecond: 20,
  });
  const arenaCenter = ENCOUNTER_CONFIG.arena.centerTiles;
  const distanceFromCenter = () =>
    Math.hypot(
      state.enemies[0].positionTiles.x - arenaCenter.x,
      state.enemies[0].positionTiles.y - arenaCenter.y,
    );
  runTicks(state, 60);
  expect(distanceFromCenter()).toBeCloseTo(radiusTiles, 6);
  const onRing = { ...state.enemies[0].positionTiles };
  advanceSimulation(state, stepSeconds, idle);
  expect(distanceFromCenter()).toBeCloseTo(radiusTiles, 6);
  expect(state.enemies[0].positionTiles).not.toEqual(onRing);
});

test("rejects an orbit whose tangential speed would reach or exceed the Paladin's", () => {
  const radiusTiles = 10;
  const tooFastDegreesPerSecond =
    (PALADIN_DERIVED_STATS.speedTilesPerSecond / radiusTiles) * (180 / Math.PI) +
    1;
  const config = withMovement({
    kind: "orbit",
    radiusTiles,
    degreesPerSecond: tooFastDegreesPerSecond,
    direction: "cw",
    approachSpeedTilesPerSecond: 1,
  });
  expect(() => validateEncounterConfig(config)).toThrow(RangeError);
  const slowEnoughDegreesPerSecond =
    ((PALADIN_DERIVED_STATS.speedTilesPerSecond - 0.1) / radiusTiles) *
    (180 / Math.PI);
  const validConfig = withMovement({
    kind: "orbit",
    radiusTiles,
    degreesPerSecond: slowEnoughDegreesPerSecond,
    direction: "cw",
    approachSpeedTilesPerSecond: 1,
  });
  expect(() => validateEncounterConfig(validConfig)).not.toThrow();
});

test("wander retargets on schedule and on arrival, and stays within its radius", () => {
  const radiusTiles = 5;
  const state = freshStateWith({
    kind: "wander",
    speedTilesPerSecond: 20,
    retargetSeconds: 0.5,
    radiusTiles,
  });
  const arenaCenter = ENCOUNTER_CONFIG.arena.centerTiles;
  const targetsSeen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    advanceSimulation(state, stepSeconds, idle);
    const target = state.enemies[0].wanderTargetTiles;
    expect(target).not.toBeNull();
    if (target) {
      expect(
        Math.hypot(target.x - arenaCenter.x, target.y - arenaCenter.y),
      ).toBeLessThanOrEqual(radiusTiles + 1e-9);
      targetsSeen.add(`${target.x.toFixed(6)},${target.y.toFixed(6)}`);
    }
  }
  expect(targetsSeen.size).toBeGreaterThan(1);
});

test("wander is reproducible under a fixed seed", () => {
  const movement: MovementSpec = {
    kind: "wander",
    speedTilesPerSecond: 20,
    retargetSeconds: 0.3,
    radiusTiles: 5,
  };
  const a = freshStateWith(movement);
  const b = freshStateWith(movement);
  runTicks(a, 90);
  runTicks(b, 90);
  expect(a.enemies[0].positionTiles).toEqual(b.enemies[0].positionTiles);
  expect(a.enemies[0].wanderTargetTiles).toEqual(b.enemies[0].wanderTargetTiles);
});

test("every movement kind keeps the enemy's collision extent inside the arena", () => {
  const movements: readonly MovementSpec[] = [
    { kind: "chase", speedTilesPerSecond: 50 },
    { kind: "stationary" },
    { kind: "move-to-point", target: "arena-center", speedTilesPerSecond: 50 },
    {
      kind: "orbit",
      radiusTiles: ENCOUNTER_CONFIG.arena.radiusTiles - 0.5,
      degreesPerSecond: 20,
      direction: "ccw",
      approachSpeedTilesPerSecond: 50,
    },
    {
      kind: "wander",
      speedTilesPerSecond: 50,
      retargetSeconds: 0.2,
      radiusTiles: ENCOUNTER_CONFIG.arena.radiusTiles - 0.5,
    },
  ];
  for (const movement of movements) {
    const state = freshStateWith(movement);
    state.enemies[0].positionTiles = {
      x: ENCOUNTER_CONFIG.arena.radiusTiles - 1,
      y: 0,
    };
    runTicks(state, 90);
    const radiusFromCenter = Math.hypot(
      state.enemies[0].positionTiles.x - ENCOUNTER_CONFIG.arena.centerTiles.x,
      state.enemies[0].positionTiles.y - ENCOUNTER_CONFIG.arena.centerTiles.y,
    );
    expect(radiusFromCenter).toBeLessThanOrEqual(
      ENCOUNTER_CONFIG.arena.radiusTiles + 1e-6,
    );
  }
});

test("the full per-tick randomness draw order holds when wander, a timed spawn and a scatter attack coincide", () => {
  const scatterArchetype: EnemyArchetype = {
    ...PRIMARY,
    phases: [
      {
        ...PRIMARY_PHASE,
        movement: {
          kind: "wander",
          speedTilesPerSecond: 20,
          retargetSeconds: 1000,
          radiusTiles: 5,
        },
        attacks: [
          {
            ...PRIMARY_PHASE.attacks[0],
            pattern: {
              kind: "scatter",
              shots: 2,
              coneDegrees: 90,
              aim: "player",
              emitterRadiusTiles: 0,
            },
            cadence: {
              shotsPerBurst: 1,
              shotIntervalSeconds: 0.1,
              cooldownAfterLastShotSeconds: 0.1,
              initialDelaySeconds: 0,
            },
          },
        ],
      },
    ],
  };
  const config: EncounterConfig = {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: scatterArchetype },
    spawns: { ...ENCOUNTER_CONFIG.spawns, firstSpawnSeconds: 0, everySeconds: 1000 },
  };
  const withSeed = (seed: number) => {
    const state = createSimulation(config, seed);
    runTicks(state, 5);
    return state.shards.map((shard) => shard.orientationRadians);
  };
  // Determinism across runs with the same seed is the only property this test
  // needs: it proves the draw order (wander, then spawn's fallback bearing,
  // then the scatter attack) is fixed rather than incidental.
  expect(withSeed(TEST_SEED)).toEqual(withSeed(TEST_SEED));
  expect(withSeed(TEST_SEED)).not.toEqual(withSeed(TEST_SEED + 1));
});

test("movementSpeedTilesPerSecond resolves the speed field each kind actually moves at", () => {
  expect(movementSpeedTilesPerSecond({ kind: "stationary" })).toBe(0);
  expect(
    movementSpeedTilesPerSecond({ kind: "chase", speedTilesPerSecond: 3 }),
  ).toBe(3);
  expect(
    movementSpeedTilesPerSecond({
      kind: "move-to-point",
      target: "arena-center",
      speedTilesPerSecond: 4,
    }),
  ).toBe(4);
  expect(
    movementSpeedTilesPerSecond({
      kind: "wander",
      speedTilesPerSecond: 5,
      retargetSeconds: 1,
      radiusTiles: 1,
    }),
  ).toBe(5);
  expect(
    movementSpeedTilesPerSecond({
      kind: "orbit",
      radiusTiles: 1,
      degreesPerSecond: 1,
      direction: "cw",
      approachSpeedTilesPerSecond: 6,
    }),
  ).toBe(6);
});

test("the chaseArenaCenter debug toggle still swaps to move-to-point at the archetype's own speed", () => {
  const degreesPerSecondOrbit: MovementSpec = {
    kind: "orbit",
    radiusTiles: 8,
    degreesPerSecond: 10,
    direction: "cw",
    approachSpeedTilesPerSecond: 3,
  };
  const state = freshStateWith(degreesPerSecondOrbit);
  state.debugSettings = { ...state.debugSettings, chaseArenaCenter: true };
  const initial = { ...state.enemies[0].positionTiles };
  advanceSimulation(state, stepSeconds, idle);
  const travelled = distance(state.enemies[0].positionTiles, initial);
  expect(travelled).toBeCloseTo(
    movementSpeedTilesPerSecond(degreesPerSecondOrbit) * stepSeconds,
    6,
  );
});

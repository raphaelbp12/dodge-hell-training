import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  liveShardBoundPerEnemy,
  primaryArchetype,
  projectileOf,
  validateEncounterConfig,
} from "../config/encounter";
import { PALADIN_DERIVED_STATS, PALADIN_STATS } from "../config/stats";
import type { ShardState, SimulationInput, Vector2 } from "../models";
import {
  advanceSimulation,
  createEnemy,
  createSimulation,
  setDebugSettings,
  spawnEnemy,
} from "./simulation.ts";
import { createShard, restampLiveShards } from "./projectiles.ts";
import {
  DEFAULT_DEBUG_SETTINGS,
  updateDebugParameter,
  loadSelectedDebugValues,
} from "../config/debug";
import {
  convexBodyFitsCircle,
  convexContactDistance,
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
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const PRIMARY_ATTACK = PRIMARY.attacks[0];
const PRIMARY_PROJECTILE = projectileOf(
  ENCOUNTER_CONFIG,
  PRIMARY_ATTACK.projectileId,
);
if (PRIMARY_PROJECTILE.motion.kind !== "boomerang")
  throw new Error("test fixture assumes the shipped shard is boomerang-kind");
const PRIMARY_MOTION = PRIMARY_PROJECTILE.motion;
if (PRIMARY_ATTACK.pattern.kind !== "ring")
  throw new Error("test fixture assumes the shipped attack is ring-kind");
const PRIMARY_PATTERN = PRIMARY_ATTACK.pattern;
// Spawn placement draws from the seeded generator, so these tests pin a seed.
const TEST_SEED = 20261026;
const freshSimulation = () => createSimulation(ENCOUNTER_CONFIG, TEST_SEED);
/** Distance of an enemy from the arena centre, in tiles. */
const ringDistance = (state: ReturnType<typeof createSimulation>): number =>
  Math.hypot(
    state.enemies[0].positionTiles.x - state.config.arena.centerTiles.x,
    state.enemies[0].positionTiles.y - state.config.arena.centerTiles.y,
  );
const horizontalContactTiles =
  Math.max(...ENCOUNTER_CONFIG.player.verticesTiles.map((vertex) => vertex.x)) +
  Math.max(
    ...PRIMARY_PROJECTILE.verticesTiles.map(
      (vertex: { x: number }) => vertex.x,
    ),
  );
const verticalContactTiles =
  Math.max(...ENCOUNTER_CONFIG.player.verticesTiles.map((vertex) => vertex.y)) +
  Math.max(
    ...PRIMARY_PROJECTILE.verticesTiles.map(
      (vertex: { y: number }) => vertex.y,
    ),
  );

test("matched player size controls shard collision instead of the old larger preset body", () => {
  const state = freshSimulation();
  setDebugSettings(state, {
    ...loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS),
    enemySpeedTilesPerSecond: 0,
    initialCooldownSeconds: 5,
  });
  state.shards.push({
    id: 999,
    projectileId: "crystal-worm-child-shard",
    damageHp: 160,
    positionTiles: { x: 1.45, y: 0 },
    velocityTilesPerSecond: { x: 0, y: 0 },
    orientationRadians: 0,
    ageSeconds: 0,
    reversalAgeSeconds: 1.5,
    lifetimeSeconds: 3,
    hasReversed: false,
    hasHitPlayer: false,
    spawnPositionTiles: { x: 1.45, y: 0 },
    spawnOrientationRadians: 0,
    detonationTargetTiles: null,
  });
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toEqual([]);
  expect(state.hitsTaken).toBe(0);
});

test("matched player size controls movement and immediate live-resize wall containment", () => {
  const state = freshSimulation();
  const selected = {
    ...loadSelectedDebugValues(DEFAULT_DEBUG_SETTINGS),
    godMode: true,
  };
  setDebugSettings(state, selected);
  state.player.positionTiles = { x: 18.5, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeGreaterThan(18.5);
  setDebugSettings(state, { ...selected, headWidth: 5, headHeight: 5 });
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
  const state = freshSimulation();
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    enemySpeedTilesPerSecond: 0,
  });
  const enemyStart = { ...state.enemies[0].positionTiles };
  state.shards.push({
    id: 1,
    projectileId: "crystal-worm-child-shard",
    damageHp: 160,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 0, y: 0 },
    orientationRadians: 0,
    ageSeconds: 0,
    reversalAgeSeconds: 1,
    lifetimeSeconds: 2,
    hasReversed: false,
    hasHitPlayer: false,
    spawnPositionTiles: { x: 0, y: 0 },
    spawnOrientationRadians: 0,
    detonationTargetTiles: null,
  });
  expect(advanceSimulation(state, stepSeconds, idle).acceptedHits).toEqual([]);
  expect(state.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(state.hitsTaken).toBe(0);
  expect(state.shards[0].hasHitPlayer).toBe(false);
  expect(state.enemies[0].positionTiles).toEqual(enemyStart);
  state.player.positionTiles = { x: 10, y: 0 };
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    chaseArenaCenter: true,
  });
  const startDistance = Math.hypot(enemyStart.x, enemyStart.y);
  runTicks(state, 60);
  // Chasing the centre closes one second of travel, from whatever bearing the
  // seeded opening used, and ignores the player who stands away from it.
  expect(ringDistance(state)).toBeCloseTo(
    startDistance - state.debugSettings.enemySpeedTilesPerSecond,
    9,
  );
  expect(ringDistance(state)).toBeLessThan(startDistance);
  expect(state.rulesVersion).not.toBe(ENCOUNTER_CONFIG.rulesVersion);
});

test("live projectile edits preserve IDs and once-only reversal, and lifetime reductions expire existing shards", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  runTicks(state, 600);
  const count = state.enemies[0].attackClocks[0].volleysFired;
  const phase = state.enemies[0].attackClocks[0].ringPhaseRadians;
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    shotsPerEmitter: 1,
    shotIntervalSeconds: 0.05,
    cooldownSeconds: 0.05,
    rotationDegreesPerSecond: 0,
  });
  runTicks(state, 1);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(count);
  expect(state.enemies[0].attackClocks[0].ringPhaseRadians).toBe(phase);
  runTicks(state, 5);
  expect(state.enemies[0].attackClocks[0].volleysFired - count).toBe(2);
});

test("arena-center chase reaches the exact center and ignores the player silhouette", () => {
  const state = freshSimulation();
  state.player.positionTiles = { x: 10, y: 0 };
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    godMode: true,
    chaseArenaCenter: true,
    enemySpeedTilesPerSecond: 12,
  });
  runTicks(state, 180);
  expect(state.enemies[0].positionTiles).toEqual(ENCOUNTER_CONFIG.arena.centerTiles);
});

test("activates the selected v3 preset and eleven-volley first group atomically", () => {
  expect(ENCOUNTER_CONFIG.rulesVersion).toBe(
    "crystal-worm-child-swarm-paladin-v4",
  );
  expect(ENCOUNTER_CONFIG.arena.radiusTiles).toBe(19.2);
  expect(PRIMARY.spawnTiles).toEqual({ x: 0, y: -16.2 });
  const state = freshSimulation();
  for (let tick = 0; tick < 234; tick++) {
    state.player.healthHp = PALADIN_STATS.healthHp;
    advanceSimulation(state, stepSeconds, idle);
  }
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(11);
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
  const first = freshSimulation();
  const second = freshSimulation();
  expect(first).toEqual(second);
  expect(first.rulesVersion).toBe(ENCOUNTER_CONFIG.rulesVersion);
  expect(first.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(ringDistance(first)).toBeCloseTo(
    ENCOUNTER_CONFIG.spawns.ringRadiusTiles,
    9,
  );
  expect(first.enemies[0].positionTiles).toEqual(
    second.enemies[0].positionTiles,
  );
  expect(first.enemies[0].attackClocks[0].ringPhaseRadians).toBe(
    PRIMARY_PATTERN.initialPhaseRadians,
  );
  expect(first.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(first.player.combatRemainingSeconds).toBe(0);
  expect(first.elapsedSeconds).toBe(0);
  expect(first.ticksElapsed).toBe(0);
  expect(first.accumulatorSeconds).toBe(0);
  expect(first.player.positionTiles).not.toBe(second.player.positionTiles);
  expect(first.enemies[0].positionTiles).not.toBe(PRIMARY.spawnTiles);
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
  const state = freshSimulation();
  expect(advanceSimulation(state, 0, east)).toEqual({
    stepsExecuted: 0,
    discardedSeconds: 0,
    acceptedHits: [],
  });
  advanceSimulation(state, stepSeconds / 4, east);
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(ringDistance(state)).toBeCloseTo(
    ENCOUNTER_CONFIG.spawns.ringRadiusTiles,
    9,
  );
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
  const state = freshSimulation();
  runTicks(state, 60, input);
  expect(state.player.positionTiles).toEqual({ x: 0, y: 0 });
  expect(state.elapsedSeconds).toBe(1);
  // One second of pursuit closes 1.5 tiles toward the centred player,
  // whatever bearing the seeded opening used.
  expect(ringDistance(state)).toBeCloseTo(
    ENCOUNTER_CONFIG.spawns.ringRadiusTiles - PRIMARY.speedTilesPerSecond,
    9,
  );
});

test.each([
  ["north", 0, -1],
  ["south", 0, 1],
  ["east", 1, 0],
  ["west", -1, 0],
] as const)("maps %s into world axes", (direction, expectedX, expectedY) => {
  const state = freshSimulation();
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
  const axial = freshSimulation();
  const diagonal = freshSimulation();
  const cancelled = freshSimulation();
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
  const state = freshSimulation();
  runTicks(state, 120, east);
  expect(state.player.positionTiles.x).toBeCloseTo(
    PALADIN_DERIVED_STATS.speedTilesPerSecond * 2,
    9,
  );
  expect(state.elapsedSeconds).toBe(2);
  expect(state.ticksElapsed).toBe(120);
});

test("pursues the updated player position at the configured slower speed", () => {
  const state = freshSimulation();
  const initialEnemy = state.enemies[0].positionTiles;
  advanceSimulation(state, stepSeconds, east);
  expect(state.enemies[0].positionTiles.x).toBeGreaterThan(0);
  expect(distance(state.enemies[0].positionTiles, initialEnemy)).toBeCloseTo(
    PRIMARY.speedTilesPerSecond * stepSeconds,
    9,
  );
  expect(distance(state.enemies[0].positionTiles, initialEnemy)).toBeLessThan(
    distance(state.player.positionTiles),
  );
  expect(
    distance(state.enemies[0].positionTiles, state.player.positionTiles),
  ).toBeLessThan(distance(initialEnemy, state.player.positionTiles));
});

test.each([-1.01, -1, -0.5, 0])(
  "stops without overshoot or division by zero from enemy y=%s",
  (enemyY) => {
    const state = freshSimulation();
    state.enemies[0].positionTiles = { x: 0, y: enemyY };
    runTicks(state, 20);
    expect(state.enemies[0].positionTiles.x).toBe(0);
    expect(state.enemies[0].positionTiles.y).toBeCloseTo(enemyY, 9);
  },
);

test("body overlap neither damages nor blocks the player", () => {
  const state = freshSimulation();
  state.player.positionTiles = { x: -0.01, y: 0 };
  state.enemies[0].positionTiles = { x: 0, y: 0 };
  advanceSimulation(state, stepSeconds, east);
  expect(state.player.positionTiles.x).toBeCloseTo(
    -0.01 + PALADIN_DERIVED_STATS.speedTilesPerSecond * stepSeconds,
    9,
  );
  expect(state.player.healthHp).toBe(PALADIN_STATS.healthHp);
  expect(state.player.combatRemainingSeconds).toBe(0);
});

test("constrains the player collider at the wall while permitting tangential movement", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
  state.enemies[0].positionTiles = { x: 15.4, y: 0 };
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
          PRIMARY.verticesTiles,
          state.enemies[0].positionTiles,
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
  const reference = freshSimulation();
  runTicks(reference, 60, east);
  for (const schedule of schedules) {
    const state = freshSimulation();
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
    expect(state.enemies[0].positionTiles.x).toBeCloseTo(
      reference.enemies[0].positionTiles.x,
      9,
    );
    expect(state.enemies[0].positionTiles.y).toBeCloseTo(
      reference.enemies[0].positionTiles.y,
      9,
    );
  }
});

test("caps catch-up, discards excess whole ticks, and never awards discarded survival time", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
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
    const state = freshSimulation();
    const before = structuredClone(state);
    expect(() => advanceSimulation(state, elapsedSeconds, east)).toThrow(
      RangeError,
    );
    expect(state).toEqual(before);
  },
);

test("bounds work even for a very large finite supplied duration", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
  expect(state.shards).toEqual([]);
  expect(state.shards).not.toBe(freshSimulation().shards);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(0);
  runTicks(state, 119);
  expect(state.shards).toEqual([]);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(0);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.shards).toHaveLength(6);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(1);
  expect(state.shards.every((shard) => shard.ageSeconds === 0)).toBe(true);
});

test("rotates clockwise from east toward south even during cooldown", () => {
  const state = freshSimulation();
  runTicks(state, 60);
  expect(state.enemies[0].attackClocks[0].ringPhaseRadians).toBeCloseTo(Math.PI / 4, 12);
  expect(Math.cos(state.enemies[0].attackClocks[0].ringPhaseRadians)).toBeGreaterThan(0);
  expect(Math.sin(state.enemies[0].attackClocks[0].ringPhaseRadians)).toBeGreaterThan(0);
  runTicks(state, 60);
  expect(state.shards[0].velocityTilesPerSecond.x).toBeCloseTo(0, 9);
  expect(state.shards[0].velocityTilesPerSecond.y).toBeCloseTo(8, 9);
  runTicks(state, 360);
  expect(state.enemies[0].attackClocks[0].ringPhaseRadians).toBeCloseTo(0, 12);
});

test.each([0, 1, 2, 3, 4, 5])(
  "samples emitter %s at sixth-turn offsets from the current enemy",
  (emitter) => {
    const state = freshSimulation();
    runTicks(state, 120);
    const shard = state.shards[emitter];
    const angle = Math.PI / 2 + (emitter * Math.PI) / 3;
    expect(shard.positionTiles.x).toBeCloseTo(
      state.enemies[0].positionTiles.x +
        Math.cos(angle) * PRIMARY_ATTACK.pattern.emitterRadiusTiles,
      9,
    );
    expect(shard.positionTiles.y).toBeCloseTo(
      state.enemies[0].positionTiles.y +
        Math.sin(angle) * PRIMARY_ATTACK.pattern.emitterRadiusTiles,
      9,
    );
    expect(shard.velocityTilesPerSecond.x).toBeCloseTo(Math.cos(angle) * 8, 9);
    expect(shard.velocityTilesPerSecond.y).toBeCloseTo(Math.sin(angle) * 8, 9);
    expect(shard).toEqual({
      id: emitter + 1,
      projectileId: "crystal-worm-child-shard",
      damageHp: PRIMARY_PROJECTILE.damageHp,
      orientationRadians: angle,
      positionTiles: shard.positionTiles,
      velocityTilesPerSecond: shard.velocityTilesPerSecond,
      ageSeconds: 0,
      reversalAgeSeconds: PRIMARY_MOTION.reversalAgeSeconds,
      lifetimeSeconds: PRIMARY_MOTION.lifetimeSeconds,
      hasReversed: false,
      hasHitPlayer: false,
      spawnPositionTiles: shard.spawnPositionTiles,
      spawnOrientationRadians: angle,
      detonationTargetTiles: null,
    });
  },
);

test("fires 66 shards on the first fixed tick at each scheduled shot, then waits three seconds", () => {
  const state = freshSimulation();
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
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(11);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.elapsedSeconds).toBeCloseTo(6.9, 12);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(12);
  expect(state.shards.slice(-6).map((shard) => shard.id)).toEqual([
    67, 68, 69, 70, 71, 72,
  ]);
});

test("resamples the moving enemy and rotated direction for later shots", () => {
  const state = freshSimulation();
  runTicks(state, 120);
  const firstVelocity = { ...state.shards[0].velocityTilesPerSecond };
  const firstEnemy = { ...state.enemies[0].positionTiles };
  runTicks(state, 57, east);
  const shard = state.shards[30];
  const angle = (2.95 * Math.PI) / 4;
  expect(state.enemies[0].positionTiles).not.toEqual(firstEnemy);
  expect(shard.velocityTilesPerSecond).not.toEqual(firstVelocity);
  expect(shard.positionTiles.x).toBeCloseTo(
    state.enemies[0].positionTiles.x +
      Math.cos(angle) * PRIMARY_ATTACK.pattern.emitterRadiusTiles,
    9,
  );
  expect(shard.positionTiles.y).toBeCloseTo(
    state.enemies[0].positionTiles.y +
      Math.sin(angle) * PRIMARY_ATTACK.pattern.emitterRadiusTiles,
    9,
  );
  expect(shard.velocityTilesPerSecond.x).toBeLessThan(firstVelocity.x);
});

function makeShard(overrides: Partial<ShardState> = {}): ShardState {
  return {
    id: 100,
    projectileId: PRIMARY_ATTACK.projectileId,
    damageHp: PRIMARY_PROJECTILE.damageHp,
    orientationRadians: 0,
    positionTiles: { x: 0, y: 0 },
    velocityTilesPerSecond: { x: 8, y: 0 },
    ageSeconds: 0,
    reversalAgeSeconds: 1.2,
    lifetimeSeconds: 2.4,
    hasReversed: false,
    hasHitPlayer: false,
    spawnPositionTiles: { x: 0, y: 0 },
    spawnOrientationRadians: 0,
    detonationTargetTiles: null,
    ...overrides,
  };
}

test("accepted-hit output separates simultaneous hits from regeneration and spent returns", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
  state.shards.push(
    makeShard({ id: 1 }),
    makeShard({
      id: 2,
      projectileId: "crystal-worm-child-shard",
      damageHp: 160,
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
    const state = freshSimulation();
    const outside = makeShard({
      positionTiles: { x: 1000, y: 0 },
      hasHitPlayer,
    });
    const overlap = makeShard({
      id: 101,
      projectileId: "crystal-worm-child-shard",
      damageHp: 160,
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
  const state = freshSimulation();
  runTicks(state, 120);
  const shard = state.shards[0];
  const emissionPoint = { ...shard.positionTiles };
  state.enemies[0].positionTiles = { x: -12, y: 0 };
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
  const reference = freshSimulation();
  runTicks(reference, 600, east);
  expect(reference.enemies[0].attackClocks[0].volleysFired).toBe(22);
  for (const schedule of schedules) {
    const state = freshSimulation();
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
  // Spawning is active over five minutes, so the bound scales with the cap.
  const shardBound =
    liveShardBoundPerEnemy(ENCOUNTER_CONFIG, PRIMARY) *
    ENCOUNTER_CONFIG.spawns.maxConcurrent;
  let reference: ReturnType<typeof createSimulation> | undefined;
  for (const frameRate of [60, 30, 120]) {
    const state = freshSimulation();
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
    expect(state.enemies).toHaveLength(ENCOUNTER_CONFIG.spawns.maxConcurrent);
    expect(state.enemies[0].attackClocks[0].volleysFired).toBe(671);
    const totalVolleys = state.enemies.reduce(
      (total, enemy) => total + enemy.attackClocks[0].volleysFired,
      0,
    );
    expect(observedShardIds.size).toBe(
      totalVolleys * PRIMARY_PATTERN.arms,
    );
    expect(peakShards).toBeLessThanOrEqual(shardBound);
    expect(peakShards).toBeGreaterThan(44);
    expect(maximumAgeSeconds).toBeLessThan(
      PRIMARY_MOTION.lifetimeSeconds,
    );
    expect(discardedSeconds).toBe(0);
    if (reference) expect(state).toEqual(reference);
    else reference = state;
  }
}, 60000);

test("discarded time advances neither rotation nor the attack scheduler", () => {
  const state = freshSimulation();
  const shard = makeShard();
  state.shards.push(shard);
  advanceSimulation(state, 20, idle);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(0);
  expect(state.shards).toEqual([shard]);
  expect(shard.ageSeconds).toBeCloseTo(8 * stepSeconds, 12);
  expect(shard.positionTiles.x).toBeCloseTo(8 * 8 * stepSeconds, 9);
  expect(state.enemies[0].attackClocks[0].ringPhaseRadians).toBeCloseTo(
    (state.elapsedSeconds * Math.PI) / 4,
    12,
  );
});

test("initializes a live simulation with no registered hits", () => {
  const state = freshSimulation();
  expect(state.phase).toBe("playing");
  expect(state.hitsTaken).toBe(0);
});

test("applies one defense-reduced hit before fractional in-combat regeneration without removing the shard", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
  const shard = makeShard({ velocityTilesPerSecond: { x: 0, y: 0 } });
  state.shards.push(shard);
  runTicks(state, 60);
  expect(state.hitsTaken).toBe(1);
  expect(state.player.healthHp).toBeCloseTo(775 - 128 + 6.0547, 9);
  expect(state.player.combatRemainingSeconds).toBeCloseTo(4.32, 10);
  expect(state.shards).toContain(shard);
});

test("independent shards can each hit in one tick without global invulnerability", () => {
  const state = freshSimulation();
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
    const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
    const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
  state.player.healthHp = 700;
  runTicks(state, 60);
  expect(state.player.healthHp).toBeCloseTo(712.1094, 9);
  state.player.healthHp = 774.99;
  runTicks(state, 1);
  expect(state.player.healthHp).toBe(775);
});

test("splits regeneration when combat expires partway through a tick", () => {
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
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
  const state = freshSimulation();
  runTicks(state, 119);
  state.enemies[0].positionTiles = { x: 0, y: 0 };
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
  const state = freshSimulation();
  runTicks(state, 119);
  state.enemies[0].positionTiles = { x: 0, y: 0 };
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
  const state = freshSimulation();
  runTicks(state, 119);
  state.enemies[0].positionTiles = { x: 0, y: 0 };
  state.player.positionTiles = {
    x: horizontalContactTiles + PRIMARY_ATTACK.pattern.emitterRadiusTiles + 0.01,
    y: 0,
  };
  runTicks(state, 1, east);
  expect(state.player.positionTiles.x).toBeGreaterThan(
    horizontalContactTiles + PRIMARY_ATTACK.pattern.emitterRadiusTiles + 0.025,
  );
  expect(state.shards).toHaveLength(6);
  expect(state.shards.every((shard) => shard.ageSeconds === 0)).toBe(true);
  expect(state.hitsTaken).toBe(0);
  expect(state.player.healthHp).toBe(775);
});

test("starts with exactly one enemy whose clock is anchored at its spawn", () => {
  const state = freshSimulation();
  expect(state.enemies).toHaveLength(1);
  const [enemy] = state.enemies;
  expect(enemy.id).toBe(1);
  expect(state.nextEnemyId).toBe(2);
  expect(enemy.archetypeId).toBe(ENCOUNTER_CONFIG.primaryArchetypeId);
  expect(enemy.spawnedAtSeconds).toBe(0);
  expect(enemy.attackClocks[0].epochSeconds).toBe(0);
  expect(enemy.attackClocks[0].rotationEpochSeconds).toBe(0);
  expect(enemy.attackClocks[0].volleysFired).toBe(0);
  expect(enemy.attackClocks[0].volleysAtEpoch).toBe(0);
  expect(enemy.attackClocks[0].initialDelaySeconds).toBe(
    PRIMARY_ATTACK.cadence.initialDelaySeconds,
  );
  // One clock per authored attack - exactly one attack for this archetype.
  expect(enemy.attackClocks).toHaveLength(PRIMARY.attacks.length);
  expect(enemy.attackClocks[0].attackId).toBe(PRIMARY_ATTACK.id);
  // The clock fields live on each enemy's attackClocks, not on the simulation.
  expect(state).not.toHaveProperty("attackEpochSeconds");
  expect(state).not.toHaveProperty("volleysFired");
  expect(state).not.toHaveProperty("rotationPhaseAtEpoch");
  expect(state).not.toHaveProperty("enemy");
  expect(enemy).not.toHaveProperty("emitterPhaseRadians");
  expect(enemy).not.toHaveProperty("volleysFired");
});

test("a fixed input sequence reproduces the same timeline every run", () => {
  const timeline = () => {
    const state = freshSimulation();
    const samples: string[] = [];
    for (let tick = 0; tick < 600; tick++) {
      advanceSimulation(state, stepSeconds, tick % 120 < 60 ? east : idle);
      if (tick % 30 !== 0) continue;
      samples.push(
        [
          state.enemies.map((enemy) => `${enemy.id}:${enemy.attackClocks[0].volleysFired}`),
          state.shards.length,
          state.shards.map((shard) => shard.id).join("."),
          state.player.healthHp.toFixed(6),
          state.hitsTaken,
        ].join("|"),
      );
    }
    return samples;
  };
  const first = timeline();
  expect(timeline()).toEqual(first);
  // Insertion-ordered iteration, so the sequence is not an artefact of key order.
  expect(first.length).toBe(20);
  expect(first.at(-1)).toContain("1:");
});

test("restampLiveShards re-applies every fired-with value to shards in flight", () => {
  const state = freshSimulation();
  runTicks(state, 150);
  expect(state.shards.length).toBeGreaterThan(0);
  const before = state.shards.map((shard) => shard.id);
  const projectile = {
    ...PRIMARY_PROJECTILE,
    damageHp: 7,
    speedTilesPerSecond: 3,
    motion: {
      ...PRIMARY_MOTION,
      reversalAgeSeconds: 0.4,
      lifetimeSeconds: 0.9,
    },
  };
  state.shards = restampLiveShards(state.shards, projectile);
  // Same identities, and all three fired-with values follow one rule (G09).
  expect(state.shards.map((shard) => shard.id)).toEqual(
    before.filter((_, index) => state.shards[index] !== undefined),
  );
  for (const shard of state.shards) {
    expect(shard.damageHp).toBe(7);
    expect(shard.reversalAgeSeconds).toBe(0.4);
    expect(shard.lifetimeSeconds).toBe(0.9);
    expect(Math.hypot(
      shard.velocityTilesPerSecond.x,
      shard.velocityTilesPerSecond.y,
    )).toBeCloseTo(3, 9);
    expect(shard.ageSeconds).toBeLessThan(shard.lifetimeSeconds);
  }
});

test("a live damage edit applies to shards already in flight", () => {
  const state = freshSimulation();
  runTicks(state, 150);
  expect(state.shards.length).toBeGreaterThan(0);
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    projectileDamageHp: 11,
  });
  for (const shard of state.shards) expect(shard.damageHp).toBe(11);
});

// ---------------------------------------------------------------------------
// Step 16.3: many enemies of the one archetype, with no spawn rule yet. These
// pin the properties phase 17's spawning will depend on.
// ---------------------------------------------------------------------------

/** Adds enemies through the public creator, at distinct ring positions. */
function withEnemies(
  state: ReturnType<typeof createSimulation>,
  positions: readonly Vector2[],
  spawnedAtSeconds = 0,
): void {
  for (const positionTiles of positions) {
    state.enemies.push(
      createEnemy(
        state.config,
        state.config.primaryArchetypeId,
        state.nextEnemyId++,
        spawnedAtSeconds,
        positionTiles,
      ),
    );
  }
}

const ringPositions: readonly Vector2[] = [
  { x: 16.2, y: 0 },
  { x: 0, y: 16.2 },
  { x: -16.2, y: 0 },
];

test("each enemy fires on its own clock from its own spawn time", () => {
  const state = freshSimulation();
  runTicks(state, 60);
  withEnemies(state, [{ x: 16.2, y: 0 }], state.elapsedSeconds);
  const [first, late] = state.enemies;
  expect(late.spawnedAtSeconds).toBeCloseTo(1, 9);
  expect(late.attackClocks[0].epochSeconds).toBeCloseTo(1, 9);
  // The first enemy's two-second cooldown is already half spent; the late
  // arrival serves its own from scratch.
  runTicks(state, 66);
  expect(first.attackClocks[0].volleysFired).toBeGreaterThan(0);
  expect(late.attackClocks[0].volleysFired).toBe(0);
  runTicks(state, 60);
  expect(late.attackClocks[0].volleysFired).toBeGreaterThan(0);
  expect(first.attackClocks[0].volleysFired).toBeGreaterThan(late.attackClocks[0].volleysFired);
});

test("every enemy pursues independently and stops at its own contact distance", () => {
  const state = freshSimulation();
  withEnemies(state, ringPositions);
  const archetype = primaryArchetype(state.config);
  const stopDistance = convexContactDistance(
    state.config.player.verticesTiles,
    archetype.verticesTiles,
    { x: 1, y: 0 },
  );
  const start = state.enemies.map((enemy) => ({ ...enemy.positionTiles }));
  runTicks(state, 1200);
  state.enemies.forEach((enemy, index) => {
    const moved = Math.hypot(
      enemy.positionTiles.x - start[index].x,
      enemy.positionTiles.y - start[index].y,
    );
    expect(moved).toBeGreaterThan(0);
    const toPlayer = Math.hypot(
      enemy.positionTiles.x - state.player.positionTiles.x,
      enemy.positionTiles.y - state.player.positionTiles.y,
    );
    expect(toPlayer).toBeGreaterThanOrEqual(stopDistance - 1e-9);
  });
});

test("shard ids stay unique across enemies and every enemy stays in the arena", () => {
  const state = freshSimulation();
  withEnemies(state, ringPositions);
  runTicks(state, 900);
  const ids = state.shards.map((shard) => shard.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(state.shards.length).toBeGreaterThan(0);
  const archetype = primaryArchetype(state.config);
  for (const enemy of state.enemies) {
    expect(
      convexBodyFitsCircle(
        transformBodyVertices(archetype.verticesTiles, enemy.positionTiles),
        state.config.arena,
      ),
    ).toBe(true);
  }
});

test("hits stay once-per-shard with several enemies firing at one player", () => {
  const state = freshSimulation();
  withEnemies(state, ringPositions);
  const seen = new Map<number, number>();
  for (let tick = 0; tick < 1800; tick++) {
    const result = advanceSimulation(state, stepSeconds, idle);
    for (const hit of result.acceptedHits)
      seen.set(hit.shardId, (seen.get(hit.shardId) ?? 0) + 1);
    if (state.phase === "ended") break;
  }
  expect(seen.size).toBeGreaterThan(0);
  for (const [, count] of seen) expect(count).toBe(1);
});

test("live shards stay within the derived bound times the enemy count", () => {
  const state = freshSimulation();
  withEnemies(state, ringPositions);
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  const bound =
    liveShardBoundPerEnemy(state.config, primaryArchetype(state.config)) *
    state.enemies.length;
  let peak = 0;
  for (let tick = 0; tick < 2400; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    peak = Math.max(peak, state.shards.length);
  }
  expect(peak).toBeGreaterThan(0);
  expect(peak).toBeLessThanOrEqual(bound);
  // Reported for the execution record and for step 17.4's browser bound.
  console.info(
    `multi-enemy peak live shards: ${peak} of ${bound} (${state.enemies.length} enemies)`,
  );
});

// ---------------------------------------------------------------------------
// Step 17.2: timed spawning.
// ---------------------------------------------------------------------------

test("enemies arrive on the approved schedule and stop at the cap", () => {
  const state = freshSimulation();
  const { firstSpawnSeconds, everySeconds, maxConcurrent } =
    ENCOUNTER_CONFIG.spawns;
  expect(state.enemies).toHaveLength(1);
  expect(state.enemies[0].spawnedAtSeconds).toBe(0);
  const arrivals: number[] = [0];
  let seen = 1;
  for (let tick = 0; tick < 60 * 60; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    state.player.healthHp = PALADIN_STATS.healthHp;
    if (state.enemies.length > seen) {
      seen = state.enemies.length;
      arrivals.push(state.enemies.at(-1)!.spawnedAtSeconds);
    }
  }
  expect(arrivals).toHaveLength(maxConcurrent);
  arrivals.slice(1).forEach((at, index) => {
    expect(at).toBeCloseTo(firstSpawnSeconds + index * everySeconds, 6);
  });
  // Cap holds for the rest of the minute, and a suppressed spawn is skipped
  // rather than banked.
  expect(state.enemies).toHaveLength(maxConcurrent);
  expect(state.nextSpawnSeconds).toBeGreaterThan(state.elapsedSeconds);
});

test("every spawn lands on the ring and keeps its body inside the arena", () => {
  const archetype = primaryArchetype(ENCOUNTER_CONFIG);
  for (const seed of [1, 7, 1234, 98765, 20261026]) {
    const state = createSimulation(ENCOUNTER_CONFIG, seed);
    for (let tick = 0; tick < 60 * 35; tick++) {
      advanceSimulation(state, stepSeconds, idle);
      state.player.healthHp = PALADIN_STATS.healthHp;
    }
    expect(state.enemies).toHaveLength(ENCOUNTER_CONFIG.spawns.maxConcurrent);
    for (const enemy of state.enemies) {
      expect(
        convexBodyFitsCircle(
          transformBodyVertices(archetype.verticesTiles, enemy.positionTiles),
          ENCOUNTER_CONFIG.arena,
        ),
      ).toBe(true);
    }
  }
});

test("the opening bearing is drawn from the seed and spreads by golden angle", () => {
  // The player stands exactly at the arena centre at t = 0, so the
  // farthest-from-player bearing is undefined and comes from the seed (G14).
  const bearings = [11, 22, 33, 44].map((seed) => {
    const state = createSimulation(ENCOUNTER_CONFIG, seed);
    const [enemy] = state.enemies;
    return Math.atan2(enemy.positionTiles.y, enemy.positionTiles.x);
  });
  expect(new Set(bearings.map((b) => b.toFixed(6))).size).toBeGreaterThan(1);
  for (const bearing of bearings) expect(Number.isFinite(bearing)).toBe(true);

  // Concurrent spawns are offset by the golden angle per index.
  const state = createSimulation(ENCOUNTER_CONFIG, 11);
  state.player.positionTiles = { x: 5, y: 0 };
  const before = state.enemies.length;
  spawnEnemy(state);
  expect(state.enemies).toHaveLength(before + 1);
  const added = state.enemies.at(-1)!;
  const expected =
    Math.atan2(0, 5) +
    Math.PI +
    before * ENCOUNTER_CONFIG.spawns.goldenAngleRadians;
  expect(added.positionTiles.x).toBeCloseTo(
    Math.cos(expected) * ENCOUNTER_CONFIG.spawns.ringRadiusTiles,
    9,
  );
  expect(added.positionTiles.y).toBeCloseTo(
    Math.sin(expected) * ENCOUNTER_CONFIG.spawns.ringRadiusTiles,
    9,
  );
});

test("a later arrival serves its own initial cooldown", () => {
  const state = freshSimulation();
  for (let tick = 0; tick < 60 * 11; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    state.player.healthHp = PALADIN_STATS.healthHp;
  }
  expect(state.enemies.length).toBeGreaterThan(1);
  const late = state.enemies[1];
  expect(late.spawnedAtSeconds).toBeCloseTo(
    ENCOUNTER_CONFIG.spawns.firstSpawnSeconds,
    6,
  );
  expect(late.attackClocks[0].epochSeconds).toBe(late.spawnedAtSeconds);
  expect(late.attackClocks[0].volleysFired).toBe(0);
  expect(state.enemies[0].attackClocks[0].volleysFired).toBeGreaterThan(0);
});

test("spawning is reproducible for a seed, including under catch-up", () => {
  const timeline = (stepsPerUpdate: number) => {
    const state = createSimulation(ENCOUNTER_CONFIG, 555);
    // God mode, so the player cannot die partway through a multi-step update
    // and truncate the loop - that would be a property of the test, not of
    // spawning. Both runs reconcile identically.
    setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
    const seconds = 40;
    const updates = (seconds / stepSeconds) / stepsPerUpdate;
    for (let update = 0; update < updates; update++) {
      advanceSimulation(state, stepSeconds * stepsPerUpdate, idle);
    }
    return state.enemies.map(
      (enemy) =>
        `${enemy.id}@${enemy.spawnedAtSeconds.toFixed(6)}:` +
        `${enemy.positionTiles.x.toFixed(9)},${enemy.positionTiles.y.toFixed(9)}`,
    );
  };
  const single = timeline(1);
  expect(single).toHaveLength(ENCOUNTER_CONFIG.spawns.maxConcurrent);
  // One step per update, and eight at once, must agree.
  expect(timeline(8)).toEqual(single);
  expect(timeline(1)).toEqual(single);
});

test("a different seed opens from a different place but the same schedule", () => {
  const openings = [101, 202].map((seed) => {
    const state = createSimulation(ENCOUNTER_CONFIG, seed);
    return { ...state.enemies[0].positionTiles };
  });
  expect(openings[0]).not.toEqual(openings[1]);
  for (const opening of openings) {
    expect(Math.hypot(opening.x, opening.y)).toBeCloseTo(
      ENCOUNTER_CONFIG.spawns.ringRadiusTiles,
      9,
    );
  }
});

test("lowering the concurrency cap despawns the newest enemies at once", () => {
  const state = freshSimulation();
  for (let tick = 0; tick < 60 * 35; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    state.player.healthHp = PALADIN_STATS.healthHp;
  }
  expect(state.enemies).toHaveLength(4);
  const keptIds = state.enemies.slice(0, 2).map((enemy) => enemy.id);
  setDebugSettings(state, {
    ...DEFAULT_DEBUG_SETTINGS,
    maxConcurrentEnemies: 2,
  });
  expect(state.enemies.map((enemy) => enemy.id)).toEqual(keptIds);
  // The cap keeps holding as time advances.
  for (let tick = 0; tick < 60 * 30; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    state.player.healthHp = PALADIN_STATS.healthHp;
  }
  expect(state.enemies.length).toBeLessThanOrEqual(2);
});

test("an archetype edit applies to every live enemy", () => {
  const state = freshSimulation();
  for (let tick = 0; tick < 60 * 25; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    state.player.healthHp = PALADIN_STATS.healthHp;
  }
  expect(state.enemies.length).toBeGreaterThan(1);
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, headWidth: 2 });
  const archetype = primaryArchetype(state.config);
  expect(
    Math.max(...archetype.verticesTiles.map((vertex) => vertex.x)) -
      Math.min(...archetype.verticesTiles.map((vertex) => vertex.x)),
  ).toBeCloseTo(2, 9);
  for (const enemy of state.enemies) {
    expect(enemy.archetypeId).toBe(state.config.primaryArchetypeId);
    expect(
      convexBodyFitsCircle(
        transformBodyVertices(archetype.verticesTiles, enemy.positionTiles),
        state.config.arena,
      ),
    ).toBe(true);
  }
});

test("a lob shard's detonation goes through the shared registerShardHit path, producing one AcceptedHit and no in-flight hit", () => {
  const LOB_PROJECTILE_ID = "test-lob-bomb";
  const state = freshSimulation();
  state.config = {
    ...state.config,
    projectiles: {
      ...state.config.projectiles,
      [LOB_PROJECTILE_ID]: {
        id: LOB_PROJECTILE_ID,
        damageHp: 200,
        speedTilesPerSecond: 5,
        armorPiercing: false,
        conditions: [],
        verticesTiles: PRIMARY_PROJECTILE.verticesTiles,
        expiration: "lifetime-only",
        hitPolicy: "once-per-shard",
        motion: { kind: "lob", travelSeconds: 2, detonationRadiusTiles: 1.5 },
      },
    },
  };
  state.enemies = [];
  state.shards = [];
  state.player.positionTiles = { x: 10.5, y: 0 };
  const lobProjectile = state.config.projectiles[LOB_PROJECTILE_ID];
  state.shards.push(createShard(lobProjectile, state.nextShardId++, { x: 0, y: 0 }, 0));

  // Mid-flight: the lob passes near the player's path but must not collide.
  for (let tick = 0; tick < 60; tick++) {
    const result = advanceSimulation(state, stepSeconds, idle);
    expect(result.acceptedHits).toEqual([]);
  }
  expect(state.shards).toHaveLength(1);

  // The remaining second brings the shard to its detonation at (10, 0),
  // 0.5 tiles from the player at (10.5, 0) - within the 1.5-tile radius.
  const healthBefore = state.player.healthHp;
  let detonationHits: unknown[] = [];
  for (let tick = 0; tick < 60; tick++) {
    const result = advanceSimulation(state, stepSeconds, idle);
    detonationHits = detonationHits.concat(result.acceptedHits);
  }
  expect(detonationHits).toHaveLength(1);
  expect(state.player.healthHp).toBeLessThan(healthBefore);
  expect(state.shards).toEqual([]);
});

test("a lob shard whose detonation misses the player applies nothing", () => {
  const LOB_PROJECTILE_ID = "test-lob-bomb-miss";
  const state = freshSimulation();
  state.config = {
    ...state.config,
    projectiles: {
      ...state.config.projectiles,
      [LOB_PROJECTILE_ID]: {
        id: LOB_PROJECTILE_ID,
        damageHp: 200,
        speedTilesPerSecond: 5,
        armorPiercing: false,
        conditions: [],
        verticesTiles: PRIMARY_PROJECTILE.verticesTiles,
        expiration: "lifetime-only",
        hitPolicy: "once-per-shard",
        motion: { kind: "lob", travelSeconds: 2, detonationRadiusTiles: 1.5 },
      },
    },
  };
  state.enemies = [];
  state.shards = [];
  state.player.positionTiles = { x: 20, y: 0 };
  const lobProjectile = state.config.projectiles[LOB_PROJECTILE_ID];
  state.shards.push(createShard(lobProjectile, state.nextShardId++, { x: 0, y: 0 }, 0));

  const healthBefore = state.player.healthHp;
  for (let tick = 0; tick < 120; tick++) {
    const result = advanceSimulation(state, stepSeconds, idle);
    expect(result.acceptedHits).toEqual([]);
  }
  expect(state.player.healthHp).toBe(healthBefore);
  expect(state.shards).toEqual([]);
});

test("a two-attack archetype fires each attack on its own independent cadence, with shard ids ordered by attack", () => {
  const fastAttack = {
    id: "fast",
    projectileId: PRIMARY_ATTACK.projectileId,
    tuningSource: "trainer-authored",
    pattern: {
      kind: "ring" as const,
      arms: 1,
      emitterRadiusTiles: 0,
      initialPhaseRadians: 0,
      clockwiseDegreesPerSecond: 0,
    },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 1,
      cooldownAfterLastShotSeconds: 0.1,
      initialDelaySeconds: 0,
    },
  };
  const slowAttack = {
    id: "slow",
    projectileId: PRIMARY_ATTACK.projectileId,
    tuningSource: "trainer-authored",
    pattern: {
      kind: "ring" as const,
      arms: 1,
      emitterRadiusTiles: 0,
      initialPhaseRadians: 0,
      clockwiseDegreesPerSecond: 0,
    },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 1,
      cooldownAfterLastShotSeconds: 5,
      initialDelaySeconds: 0,
    },
  };
  const twoAttackArchetype = {
    ...PRIMARY,
    attacks: [fastAttack, slowAttack],
  };
  const config = {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: twoAttackArchetype },
  };
  const state = createSimulation(config, TEST_SEED);
  const [enemy] = state.enemies;
  expect(enemy.attackClocks).toHaveLength(2);
  expect(enemy.attackClocks[0].attackId).toBe("fast");
  expect(enemy.attackClocks[1].attackId).toBe("slow");

  // Both fire their opening volley on the very first tick; shard ids are
  // pushed in authored attack order (fast's shard, then slow's).
  advanceSimulation(state, stepSeconds, idle);
  expect(state.shards.map((shard) => shard.id)).toEqual([1, 2]);
  expect(enemy.attackClocks[0].volleysFired).toBe(1);
  expect(enemy.attackClocks[1].volleysFired).toBe(1);

  for (let tick = 0; tick < 60 * 3 - 1; tick++) {
    advanceSimulation(state, stepSeconds, idle);
  }
  // Fast repeats every 0.1s; slow (5s cooldown) has not fired a second
  // volley within these 3 seconds. Independent clocks, independent cadences.
  expect(enemy.attackClocks[0].volleysFired).toBeGreaterThan(20);
  expect(enemy.attackClocks[1].volleysFired).toBe(1);
});

test("a scatter attack is deterministic for a seed and reproducible across step batching, even when a spawn lands in the same tick", () => {
  const scatterAttack = {
    id: "scatter-volley",
    projectileId: PRIMARY_ATTACK.projectileId,
    tuningSource: "trainer-authored",
    pattern: {
      kind: "scatter" as const,
      shots: 5,
      coneDegrees: 90,
      aim: "fixed" as const,
      fixedBearingDegrees: 0,
      emitterRadiusTiles: 0.2,
    },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 1,
      cooldownAfterLastShotSeconds: stepSeconds * 2,
      initialDelaySeconds: 0,
    },
  };
  const scattererArchetype = { ...PRIMARY, attacks: [scatterAttack] };
  const config = {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: scattererArchetype },
    spawns: {
      ...ENCOUNTER_CONFIG.spawns,
      // A second enemy spawns on the same tick the first fires its second
      // scatter volley (tick 2), so a spawn draw and a scatter draw land in
      // the same fixed step.
      firstSpawnSeconds: stepSeconds * 2,
      everySeconds: stepSeconds * 2,
      maxConcurrent: 3,
    },
  };

  const runTimeline = (advance: (state: ReturnType<typeof createSimulation>) => void) => {
    const state = createSimulation(config, TEST_SEED);
    advance(state);
    return {
      shardSnapshot: state.shards.map((shard) => ({
        id: shard.id,
        x: shard.positionTiles.x,
        y: shard.positionTiles.y,
        orientationRadians: shard.orientationRadians,
      })),
      enemyCount: state.enemies.length,
      randomSeed: state.randomSeed,
    };
  };

  const ticks = 3;
  const oneBigStep = runTimeline((state) =>
    advanceSimulation(state, stepSeconds * ticks, idle),
  );
  const manySmallSteps = runTimeline((state) => {
    for (let tick = 0; tick < ticks; tick++)
      advanceSimulation(state, stepSeconds, idle);
  });
  const sameSeedAgain = runTimeline((state) =>
    advanceSimulation(state, stepSeconds * ticks, idle),
  );

  expect(oneBigStep.enemyCount).toBe(2);
  expect(oneBigStep).toEqual(manySmallSteps);
  expect(oneBigStep).toEqual(sameSeedAgain);

  const differentSeedState = createSimulation(config, TEST_SEED + 1);
  advanceSimulation(differentSeedState, stepSeconds * ticks, idle);
  expect(
    differentSeedState.shards.map((shard) => shard.orientationRadians),
  ).not.toEqual(oneBigStep.shardSnapshot.map((shard) => shard.orientationRadians));
});

test("arm spread is measured from the attack clock's epoch, not the simulation's start", () => {
  const spreadingAttack = {
    id: "spreading-ring",
    projectileId: PRIMARY_ATTACK.projectileId,
    tuningSource: "trainer-authored",
    pattern: {
      kind: "ring" as const,
      arms: 2,
      emitterRadiusTiles: 0,
      initialPhaseRadians: 0,
      clockwiseDegreesPerSecond: 0,
      armSpreadDegreesPerSecond: 10,
      maxArmSpreadDegrees: 100,
    },
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 1,
      cooldownAfterLastShotSeconds: 0.5,
      initialDelaySeconds: 0,
    },
  };
  const archetype = { ...PRIMARY, attacks: [spreadingAttack] };
  const config = {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: archetype },
  };
  const state = createSimulation(config, TEST_SEED);
  // Replace the opening enemy with one whose clock epoch is t = 2 seconds,
  // then advance to t = 3: its spread has had one second, not three.
  state.enemies = [
    createEnemy(config, PRIMARY.id, state.nextEnemyId++, 2, { x: 5, y: 0 }),
  ];
  for (let tick = 0; tick < 180; tick++)
    advanceSimulation(state, stepSeconds, idle);

  const fresh = state.shards.filter((shard) => shard.ageSeconds === 0);
  expect(fresh).toHaveLength(2);
  const bearings = fresh
    .map((shard) => shard.orientationRadians)
    .sort((left, right) => left - right);
  expect(bearings[0]).toBeCloseTo(0, 9);
  // 180 + 10 degrees after one clock second; measuring from the simulation
  // start would put it at 180 + 30 degrees instead.
  expect(bearings[1]).toBeCloseTo((190 * Math.PI) / 180, 6);
});

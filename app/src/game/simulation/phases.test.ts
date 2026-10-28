import { expect, test } from "vitest";
import {
  archetypeOf,
  ENCOUNTER_CONFIG,
  primaryArchetype,
  validateEncounterConfig,
  type EncounterConfig,
  type EnemyArchetype,
  type HealthSpec,
  type PhaseSpec,
  type PhaseSpawnSpec,
  type SubPhaseSpec,
} from "../config/encounter";
import type { EnemyState, SimulationInput } from "../models";
import { advanceSimulation, createSimulation } from "./simulation";
import { enterDrillPhase, healthFraction } from "./phases";

const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const TEST_SEED = 20261028;

/** ENCOUNTER_CONFIG with the primary archetype's health block replaced (or removed). */
function withHealth(health: HealthSpec | undefined): EncounterConfig {
  const archetype: EnemyArchetype = { ...PRIMARY, health };
  return { ...ENCOUNTER_CONFIG, archetypes: { [PRIMARY.id]: archetype } };
}

function freshStateWith(health: HealthSpec | undefined) {
  return createSimulation(withHealth(health), TEST_SEED);
}

function runTicks(
  state: ReturnType<typeof createSimulation>,
  ticks: number,
): void {
  for (let i = 0; i < ticks; i++) advanceSimulation(state, stepSeconds, idle);
}

test("an archetype with no health block has null health and a healthFraction of 1", () => {
  const state = freshStateWith(undefined);
  const enemy = state.enemies[0];
  expect(enemy.healthHp).toBeNull();
  expect(enemy.maxHealthHp).toBeNull();
  expect(healthFraction(enemy)).toBe(1);
  runTicks(state, 60);
  expect(state.enemies[0].healthHp).toBeNull();
  expect(state.phase).toBe("playing");
});

test("a simulated-dps enemy loses exactly hpPerSecond * stepSeconds each step", () => {
  const state = freshStateWith({
    maxHealthHp: 100,
    progression: { kind: "simulated-dps", hpPerSecond: 10 },
  });
  advanceSimulation(state, stepSeconds, idle);
  expect(state.enemies[0].healthHp).toBeCloseTo(100 - 10 * stepSeconds, 10);
});

test("health clamps at zero and never goes negative", () => {
  const state = freshStateWith({
    maxHealthHp: 1,
    progression: { kind: "simulated-dps", hpPerSecond: 1000 },
  });
  advanceSimulation(state, stepSeconds, idle);
  expect(state.enemies[0].healthHp).toBe(0);
});

test("invulnerability suppresses the drain for exactly its duration, resuming the step after", () => {
  const state = freshStateWith({
    maxHealthHp: 100,
    progression: { kind: "simulated-dps", hpPerSecond: 10 },
  });
  state.enemies[0].invulnerableUntilSeconds = stepSeconds * 3;
  runTicks(state, 2);
  expect(state.enemies[0].healthHp).toBe(100);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.enemies[0].healthHp).toBeCloseTo(100 - 10 * stepSeconds, 10);
});

test("reaching zero health sets cleared and stops further advancement", () => {
  const state = freshStateWith({
    maxHealthHp: 10 * stepSeconds,
    progression: { kind: "simulated-dps", hpPerSecond: 10 },
  });
  runTicks(state, 1);
  expect(state.phase).toBe("cleared");
  const enemyBefore = state.enemies[0];
  const result = advanceSimulation(state, stepSeconds, idle);
  expect(result.stepsExecuted).toBe(0);
  expect(state.enemies[0]).toBe(enemyBefore);
});

test("pauseProgression suppresses the drain and leaves health unchanged over many steps", () => {
  const state = freshStateWith({
    maxHealthHp: 100,
    progression: { kind: "simulated-dps", hpPerSecond: 10 },
  });
  state.debugSettings = { ...state.debugSettings, pauseProgression: true };
  runTicks(state, 60);
  expect(state.enemies[0].healthHp).toBe(100);
});

test("the drain is identical at 30, 60 and 120 Hz for the same elapsed time", () => {
  const health: HealthSpec = {
    maxHealthHp: 1000,
    progression: { kind: "simulated-dps", hpPerSecond: 10 },
  };
  const validationSeconds = 1;
  const outcomes = [30, 60, 120].map((frameRate) => {
    const state = freshStateWith(health);
    for (let frame = 0; frame < validationSeconds * frameRate; frame++)
      advanceSimulation(state, 1 / frameRate, idle);
    return state.enemies[0].healthHp;
  });
  expect(outcomes[0]).toBe(outcomes[1]);
  expect(outcomes[1]).toBe(outcomes[2]);
});

// --- Step 22.3: the phase machine -----------------------------------------

const PRIMARY_ATTACK = PRIMARY.phases[0].attacks[0];
const STATIONARY_MOVEMENT = { kind: "stationary" as const };

/** A fresh three-phase test archetype's config: p1 (1), p2 (0.5), p3 (0.2, scripted exit). */
function threePhaseConfig(baseHpPerSecond = 10): EncounterConfig {
  const phases: PhaseSpec[] = [
    {
      id: "p1",
      enterAtHpFraction: 1,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY_MOVEMENT,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p1-attack" }],
    },
    {
      id: "p2",
      enterAtHpFraction: 0.5,
      exitAfterSeconds: null,
      telegraphSeconds: 1,
      invulnerableOnEnterSeconds: 0.5,
      telegraphColor: "red",
      movement: STATIONARY_MOVEMENT,
      progression: { kind: "simulated-dps", hpPerSecond: 5 },
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p2-attack" }],
    },
    {
      id: "p3",
      enterAtHpFraction: 0.2,
      exitAfterSeconds: 2,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "violet",
      movement: STATIONARY_MOVEMENT,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p3-attack" }],
    },
  ];
  const archetype: EnemyArchetype = {
    ...PRIMARY,
    health: {
      maxHealthHp: 100,
      progression: { kind: "simulated-dps", hpPerSecond: baseHpPerSecond },
    },
    phases,
  };
  return { ...ENCOUNTER_CONFIG, archetypes: { [PRIMARY.id]: archetype } };
}

test("a three-phase archetype enters phase 2 at its authored HP fraction", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(0);
  while (state.enemies[0].phaseIndex === 0 && state.phase === "playing")
    runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(1);
  expect(state.enemies[0].healthHp).toBeLessThanOrEqual(50);
});

test("entry happens at exactly the threshold, not one step late", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  // 10 hp/s drain, 1/60s steps: health first reaches exactly 50 at tick 300.
  runTicks(state, 299);
  expect(state.enemies[0].phaseIndex).toBe(0);
  runTicks(state, 1);
  expect(state.enemies[0].healthHp).toBeCloseTo(50, 9);
  expect(state.enemies[0].phaseIndex).toBe(1);
});

test("a single step crossing two thresholds lands in the later phase with both entries' effects applied", () => {
  // A very high drain rate so one 1/60s fixed step crosses both the 0.5 and
  // 0.2 thresholds at once.
  const state = createSimulation(threePhaseConfig(10000), TEST_SEED);
  runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(2);
  expect(state.enemies[0].attackClocks[0].attackId).toBe("p3-attack");
});

test("exitAfterSeconds exits on duration while health is untouched", () => {
  // A dedicated two-phase config whose first phase is scripted (K09): it
  // exits after its authored duration regardless of the (paused) drain.
  const scriptedPhases: PhaseSpec[] = [
    {
      id: "scripted",
      enterAtHpFraction: 1,
      exitAfterSeconds: 2,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY_MOVEMENT,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "scripted-attack" }],
    },
    {
      id: "after-script",
      enterAtHpFraction: 0.99,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "red",
      movement: STATIONARY_MOVEMENT,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "after-script-attack" }],
    },
  ];
  const archetype: EnemyArchetype = {
    ...PRIMARY,
    health: { maxHealthHp: 100, progression: { kind: "simulated-dps", hpPerSecond: 10 } },
    phases: scriptedPhases,
  };
  const config: EncounterConfig = {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: archetype },
  };
  const state = createSimulation(config, TEST_SEED);
  state.debugSettings = { ...state.debugSettings, pauseProgression: true };
  const healthAtEntry = state.enemies[0].healthHp;
  runTicks(state, Math.round(2 / stepSeconds) - 1);
  expect(state.enemies[0].phaseIndex).toBe(0);
  runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(1);
  expect(state.enemies[0].healthHp).toBe(healthAtEntry);
});

test("progression never goes backward when health is restored artificially", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(0);
  while (state.enemies[0].phaseIndex === 0) runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(1);
  state.enemies[0].healthHp = 100;
  runTicks(state, 10);
  expect(state.enemies[0].phaseIndex).toBe(1);
});

test("clocks are rebuilt on entry, anchored for the new phase's own attacks", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  expect(state.enemies[0].attackClocks[0].attackId).toBe("p1-attack");
  while (state.enemies[0].phaseIndex === 0) runTicks(state, 1);
  expect(state.enemies[0].attackClocks).toHaveLength(1);
  expect(state.enemies[0].attackClocks[0].attackId).toBe("p2-attack");
  expect(state.enemies[0].attackClocks[0].volleysFired).toBe(0);
});

test("the telegraph delays the first shot by telegraphSeconds plus the attack's own initial delay", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  while (state.enemies[0].phaseIndex === 0) runTicks(state, 1);
  const enemy = state.enemies[0];
  expect(enemy.attackClocks[0].epochSeconds).toBeCloseTo(
    enemy.phaseEnteredAtSeconds + 1,
    9,
  );
  const expectedFirstShotSeconds =
    enemy.attackClocks[0].epochSeconds +
    enemy.attackClocks[0].initialDelaySeconds;
  while (state.elapsedSeconds < expectedFirstShotSeconds - stepSeconds) {
    runTicks(state, 1);
    expect(enemy.attackClocks[0].volleysFired).toBe(0);
  }
  runTicks(state, 1);
  expect(enemy.attackClocks[0].volleysFired).toBe(1);
});

test("the invulnerability window set on entry suppresses the drain for exactly its duration", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  while (state.enemies[0].phaseIndex === 0) runTicks(state, 1);
  const enemy = state.enemies[0];
  const healthOnEntry = enemy.healthHp as number;
  const invulnerableSteps = Math.round(0.5 / stepSeconds);
  runTicks(state, invulnerableSteps - 1);
  expect(state.enemies[0].healthHp).toBe(healthOnEntry);
  runTicks(state, 1);
  expect(state.enemies[0].healthHp).toBeLessThan(healthOnEntry);
});

test("a phase authoring a progression override drains at its own rate, and the next phase reverts to the archetype's", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  while (state.enemies[0].phaseIndex === 0) runTicks(state, 1);
  // Past the invulnerability window, p2 drains at its own 5 hp/s, not 10.
  runTicks(state, Math.round(0.5 / stepSeconds));
  const before = state.enemies[0].healthHp as number;
  runTicks(state, 1);
  expect(before - (state.enemies[0].healthHp as number)).toBeCloseTo(
    5 * stepSeconds,
    9,
  );
  while (state.enemies[0].phaseIndex === 1) runTicks(state, 1);
  const beforeP3 = state.enemies[0].healthHp as number;
  runTicks(state, 1);
  expect(beforeP3 - (state.enemies[0].healthHp as number)).toBeCloseTo(
    10 * stepSeconds,
    9,
  );
});

test("validateEncounterConfig rejects a malformed health block and accepts a well-formed one", () => {
  expect(() =>
    validateEncounterConfig(
      withHealth({ maxHealthHp: 0, progression: { kind: "none" } }),
    ),
  ).toThrow(RangeError);
  expect(() =>
    validateEncounterConfig(
      withHealth({
        maxHealthHp: 100,
        progression: { kind: "simulated-dps", hpPerSecond: -1 },
      }),
    ),
  ).toThrow(RangeError);
  expect(() =>
    validateEncounterConfig(
      withHealth({
        maxHealthHp: 100,
        progression: { kind: "simulated-dps", hpPerSecond: 5 },
      }),
    ),
  ).not.toThrow();
});

// --- Step 22.5: drill mode -------------------------------------------------

test("createSimulation with startPhaseIndex starts the primary enemy in that phase at its entry health", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED, {
    startPhaseIndex: 2,
  });
  const enemy = state.enemies[0];
  expect(enemy.phaseIndex).toBe(2);
  expect(enemy.healthHp).toBeCloseTo(20, 9);
  expect(enemy.attackClocks[0].attackId).toBe("p3-attack");
});

test("a drilled phase's telegraph and invulnerability window apply exactly as a real entry would", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED, {
    startPhaseIndex: 1,
  });
  const enemy = state.enemies[0];
  expect(enemy.invulnerableUntilSeconds).toBeCloseTo(0.5, 9);
  expect(enemy.attackClocks[0].epochSeconds).toBeCloseTo(1, 9);
});

test("loopPhase re-enters the drilled phase on exit, resetting health, clocks and telegraph", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED, {
    startPhaseIndex: 1,
    loopPhase: true,
  });
  const enemy = state.enemies[0];
  // p2 drains at 5 hp/s from its 50 hp entry; exits to p3 at 20 hp without
  // looping (6 s past the invulnerability window), so push well past that
  // point while looped and confirm health was seen reset above it again.
  let sawReset = false;
  while (state.elapsedSeconds < 10) {
    runTicks(state, 1);
    if ((enemy.healthHp as number) > 20) sawReset = true;
  }
  expect(enemy.phaseIndex).toBe(1);
  expect(sawReset).toBe(true);
  expect(enemy.attackClocks[0].attackId).toBe("p2-attack");
});

test("without loopPhase, the same drilled phase's exit advances normally", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED, {
    startPhaseIndex: 1,
  });
  while (state.enemies[0].phaseIndex === 1) runTicks(state, 1);
  expect(state.enemies[0].phaseIndex).toBe(2);
});

test("an out-of-range startPhaseIndex is rejected", () => {
  expect(() =>
    createSimulation(threePhaseConfig(), TEST_SEED, { startPhaseIndex: 3 }),
  ).toThrow(RangeError);
  expect(() =>
    createSimulation(threePhaseConfig(), TEST_SEED, { startPhaseIndex: -1 }),
  ).toThrow(RangeError);
});

test("the debug phase jump moves the enemy into the chosen phase mid-run", () => {
  const config = threePhaseConfig();
  const state = createSimulation(config, TEST_SEED);
  const enemy = state.enemies[0];
  expect(enemy.phaseIndex).toBe(0);
  enterDrillPhase(state, enemy, archetypeOf(config, enemy.archetypeId), 2);
  expect(enemy.phaseIndex).toBe(2);
  expect(enemy.healthHp).toBeCloseTo(20, 9);
});

// --- Step 22.4: cycling sub-phases and phase-driven spawns ----------------

const MINION_ID = "test-minion";

/** A minion archetype with two phases, for the startPhaseIndex tests. */
function minionArchetype(): EnemyArchetype {
  return {
    ...PRIMARY,
    id: MINION_ID,
    // A health block that never drains, so healthFraction stays 1 and the
    // second phase's own threshold (below 1) is what gates the transition -
    // otherwise a health-less enemy's healthFraction of 1 would satisfy any
    // threshold and advance immediately.
    health: { maxHealthHp: 100, progression: { kind: "none" } },
    phases: [
      {
        id: "m0",
        enterAtHpFraction: 1,
        exitAfterSeconds: null,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "amber",
        movement: STATIONARY_MOVEMENT,
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [
          {
            ...PRIMARY_ATTACK,
            id: "m0-attack",
            cadence: { ...PRIMARY_ATTACK.cadence, initialDelaySeconds: 0 },
          },
        ],
      },
      {
        id: "m1",
        enterAtHpFraction: 0.5,
        exitAfterSeconds: null,
        telegraphSeconds: 1,
        invulnerableOnEnterSeconds: 1.5,
        telegraphColor: "red",
        movement: STATIONARY_MOVEMENT,
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [{ ...PRIMARY_ATTACK, id: "m1-attack" }],
      },
    ],
  };
}

/**
 * An owner archetype with one phase that cycles between two sub-phases
 * (step 22.4). `sub0`/`sub1` overrides let each test tailor duration,
 * invulnerability, movement override and spawns independently.
 */
function ownerConfig(
  sub0: Partial<SubPhaseSpec> = {},
  sub1: Partial<SubPhaseSpec> = {},
  extraArchetypes: Readonly<Record<string, EnemyArchetype>> = {},
  maxConcurrentMinions = ENCOUNTER_CONFIG.maxConcurrentMinions,
): EncounterConfig {
  const subPhases: SubPhaseSpec[] = [
    {
      id: "sub0",
      durationSeconds: 2 * stepSeconds,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      movement: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "sub0-attack" }],
      spawns: null,
      ...sub0,
    },
    {
      id: "sub1",
      durationSeconds: 2 * stepSeconds,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      movement: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "sub1-attack" }],
      spawns: null,
      ...sub1,
    },
  ];
  const phases: PhaseSpec[] = [
    {
      id: "p1",
      enterAtHpFraction: 1,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY_MOVEMENT,
      progression: { kind: "simulated-dps", hpPerSecond: 1000 },
      subPhases,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "owner-attack" }],
    },
  ];
  const archetype: EnemyArchetype = {
    ...PRIMARY,
    health: {
      maxHealthHp: 100000,
      progression: { kind: "simulated-dps", hpPerSecond: 1000 },
    },
    phases,
  };
  return {
    ...ENCOUNTER_CONFIG,
    maxConcurrentMinions,
    archetypes: { [PRIMARY.id]: archetype, ...extraArchetypes },
  };
}

function minionsOf(enemies: readonly EnemyState[]): readonly EnemyState[] {
  return enemies.filter((enemy) => enemy.spawnedByEnemyId !== null);
}

test("a phase with two sub-phases alternates on its authored durations and wraps after the last", () => {
  const state = createSimulation(ownerConfig(), TEST_SEED);
  expect(state.enemies[0].subPhaseIndex).toBe(0);
  runTicks(state, 2);
  expect(state.enemies[0].subPhaseIndex).toBe(1);
  runTicks(state, 2);
  expect(state.enemies[0].subPhaseIndex).toBe(0);
});

test("the active attack set is the phase's own attacks followed by the active sub-phase's", () => {
  const state = createSimulation(ownerConfig(), TEST_SEED);
  expect(state.enemies[0].attackClocks.map((clock) => clock.attackId)).toEqual([
    "owner-attack",
    "sub0-attack",
  ]);
  runTicks(state, 2);
  expect(state.enemies[0].attackClocks.map((clock) => clock.attackId)).toEqual([
    "owner-attack",
    "sub1-attack",
  ]);
});

test("a sub-phase movement override applies for its duration, and the phase's own movement resumes when it ends", () => {
  const state = createSimulation(
    ownerConfig(
      {},
      { movement: { kind: "move-to-point", target: "arena-center", speedTilesPerSecond: 5 } },
    ),
    TEST_SEED,
  );
  const startPosition = { ...state.enemies[0].positionTiles };
  runTicks(state, 1);
  expect(state.enemies[0].positionTiles).toEqual(startPosition);
  runTicks(state, 1);
  // sub1 is now active, but this tick's movement already ran under sub0.
  expect(state.enemies[0].positionTiles).toEqual(startPosition);
  runTicks(state, 1);
  expect(state.enemies[0].positionTiles).not.toEqual(startPosition);
});

test("a phase with no sub-phases behaves exactly as step 22.3 left it", () => {
  const state = createSimulation(threePhaseConfig(), TEST_SEED);
  expect(state.enemies[0].subPhaseIndex).toBe(0);
  runTicks(state, 10);
  expect(state.enemies[0].subPhaseIndex).toBe(0);
  expect(state.enemies[0].attackClocks).toHaveLength(1);
});

test("each sub-phase entry sets its own invulnerability window, pausing the drain for exactly its duration", () => {
  const state = createSimulation(
    ownerConfig({ durationSeconds: 4 * stepSeconds, invulnerableOnEnterSeconds: 2 * stepSeconds }),
    TEST_SEED,
  );
  const before = state.enemies[0].healthHp as number;
  runTicks(state, 1);
  expect(state.enemies[0].healthHp).toBe(before);
  runTicks(state, 1);
  expect(state.enemies[0].healthHp).toBeLessThan(before);
});

test("spawns resolve once on entering a (sub)phase, not on every tick", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const state = createSimulation(
    ownerConfig(
      { durationSeconds: 10 * stepSeconds, spawns: [spawn] },
      {},
      { [MINION_ID]: minionArchetype() },
    ),
    TEST_SEED,
  );
  expect(minionsOf(state.enemies)).toHaveLength(1);
  runTicks(state, 5);
  expect(minionsOf(state.enemies)).toHaveLength(1);
});

test("spawn placements are evenly spread, and a repeated entry's bearings are golden-angle offset", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 3,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const config = ownerConfig(
    { spawns: [spawn] },
    { spawns: [spawn] },
    { [MINION_ID]: minionArchetype() },
    9,
  );
  const state = createSimulation(config, TEST_SEED);
  const owner = state.enemies[0].positionTiles;
  const bearingsOf = (minions: readonly EnemyState[]) =>
    minions.map((minion) =>
      Math.atan2(
        minion.positionTiles.y - owner.y,
        minion.positionTiles.x - owner.x,
      ),
    );
  const firstBatch = bearingsOf(minionsOf(state.enemies));
  expect(firstBatch).toHaveLength(3);
  const spacing = (firstBatch[1] - firstBatch[0] + 2 * Math.PI) % (2 * Math.PI);
  expect(spacing).toBeCloseTo((2 * Math.PI) / 3, 9);
  runTicks(state, 2);
  const secondBatch = bearingsOf(minionsOf(state.enemies).slice(3));
  expect(secondBatch).toHaveLength(3);
  expect(secondBatch[0]).not.toBeCloseTo(firstBatch[0], 6);
});

test("despawnOnExit removes a minion when its owner leaves the phase or sub-phase, but its shards survive to their own lifetimes", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: true,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const state = createSimulation(
    ownerConfig(
      { durationSeconds: 3 * stepSeconds, spawns: [spawn] },
      {},
      { [MINION_ID]: minionArchetype() },
    ),
    TEST_SEED,
  );
  expect(minionsOf(state.enemies)).toHaveLength(1);
  runTicks(state, 1);
  const shardsBefore = state.shards.length;
  expect(shardsBefore).toBeGreaterThan(0);
  runTicks(state, 2);
  expect(minionsOf(state.enemies)).toHaveLength(0);
  expect(state.shards.length).toBeGreaterThanOrEqual(shardsBefore);
});

test("maxConcurrentMinions suppresses an over-cap spawn rather than queuing it", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 3,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const state = createSimulation(
    ownerConfig(
      { spawns: [spawn] },
      {},
      { [MINION_ID]: minionArchetype() },
      1,
    ),
    TEST_SEED,
  );
  expect(minionsOf(state.enemies)).toHaveLength(1);
  runTicks(state, 10);
  expect(minionsOf(state.enemies)).toHaveLength(1);
});

test("a startPhaseIndex of 1 starts the minion in its second phase with that phase's clocks, telegraph and invulnerability", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 1,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const state = createSimulation(
    ownerConfig({ spawns: [spawn] }, {}, { [MINION_ID]: minionArchetype() }),
    TEST_SEED,
  );
  const minion = minionsOf(state.enemies)[0];
  expect(minion.phaseIndex).toBe(1);
  expect(minion.attackClocks[0].attackId).toBe("m1-attack");
  expect(minion.attackClocks[0].epochSeconds).toBeCloseTo(1, 9);
  expect(minion.invulnerableUntilSeconds).toBeCloseTo(1.5, 9);
});

test("validateEncounterConfig rejects a sub-phase with a nonpositive durationSeconds", () => {
  expect(() =>
    validateEncounterConfig(ownerConfig({ durationSeconds: 0 })),
  ).toThrow(RangeError);
});

test("validateEncounterConfig rejects a spawn count above maxConcurrentMinions", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 5,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  expect(() =>
    validateEncounterConfig(
      ownerConfig(
        { spawns: [spawn] },
        {},
        { [MINION_ID]: minionArchetype() },
        2,
      ),
    ),
  ).toThrow(RangeError);
});

test("validateEncounterConfig rejects a spawn naming an unknown archetype", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: "no-such-archetype",
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  expect(() =>
    validateEncounterConfig(ownerConfig({ spawns: [spawn] })),
  ).toThrow(RangeError);
});

test("validateEncounterConfig rejects a startPhaseIndex beyond the spawned archetype's phase count", () => {
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 2,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  expect(() =>
    validateEncounterConfig(
      ownerConfig({ spawns: [spawn] }, {}, { [MINION_ID]: minionArchetype() }),
    ),
  ).toThrow(RangeError);
});

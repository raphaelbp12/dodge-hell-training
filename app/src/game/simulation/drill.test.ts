import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
  type EncounterConfig,
  type EnemyArchetype,
  type PhaseSpec,
  type PhaseSpawnSpec,
} from "../config/encounter";
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
const PRIMARY_ATTACK = PRIMARY.phases[0].attacks[0];
const STATIONARY = { kind: "stationary" as const };
const TEST_SEED = 20261102;
const MINION_ID = "drill-minion";

/** A synthetic eight-phase primary whose health drains at 10 HP/s from 100 HP. */
function drillConfig(phaseCount = 8): EncounterConfig {
  const phases: PhaseSpec[] = Array.from({ length: phaseCount }, (_, index) => ({
    id: `p${index}`,
    enterAtHpFraction: 1 - index / (phaseCount + 1),
    exitAfterSeconds: null,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    telegraphColor: "amber",
    movement: STATIONARY,
    progression: null,
    subPhases: null,
    spawns: null,
    attacks: [{ ...PRIMARY_ATTACK, id: `p${index}-attack` }],
  }));
  const archetype: EnemyArchetype = {
    ...PRIMARY,
    health: {
      maxHealthHp: 100,
      progression: { kind: "simulated-dps", hpPerSecond: 10 },
    },
    phases,
  };
  return { ...ENCOUNTER_CONFIG, archetypes: { [PRIMARY.id]: archetype } };
}

function runUntil(
  state: ReturnType<typeof createSimulation>,
  predicate: () => boolean,
  maxTicks = 2000,
): void {
  for (let tick = 0; tick < maxTicks && !predicate(); tick++)
    advanceSimulation(state, stepSeconds, idle);
}

/** The primary's phase index each time it changes over `ticks` fixed steps. */
function phaseSequence(
  state: ReturnType<typeof createSimulation>,
  ticks: number,
): number[] {
  const sequence = [state.enemies[0].phaseIndex];
  for (let tick = 0; tick < ticks; tick++) {
    advanceSimulation(state, stepSeconds, idle);
    const index = state.enemies[0].phaseIndex;
    if (index !== sequence[sequence.length - 1]) sequence.push(index);
  }
  return sequence;
}

// --- Step 29.1: the normalized drill selection ----------------------------

test("an explicit drill normalizes and starts the primary in its first phase", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [3, 1, 3], loop: true },
  });
  expect(state.drill).toEqual({ phaseIndices: [1, 3], loop: true });
  expect(state.enemies[0].phaseIndex).toBe(1);
  expect(state.enemies[0].healthHp).toBeCloseTo(100 * (1 - 1 / 9), 9);
  expect(state.rulesVersion).toBe(`${config.rulesVersion}-drill-p1-3`);
});

test("the legacy startPhaseIndex and loopPhase aliases still start and loop", () => {
  const config = drillConfig();
  const looped = createSimulation(config, TEST_SEED, {
    startPhaseIndex: 2,
    loopPhase: true,
  });
  expect(looped.drill).toEqual({ phaseIndices: [2], loop: true });
  expect(looped.enemies[0].phaseIndex).toBe(2);
  expect(looped.rulesVersion).toBe(`${config.rulesVersion}-drill-p2`);

  const started = createSimulation(config, TEST_SEED, { startPhaseIndex: 2 });
  expect(started.drill).toBeNull();
  expect(started.enemies[0].phaseIndex).toBe(2);
  expect(started.rulesVersion).toBe(`${config.rulesVersion}-drill-p2`);
});

test("an empty or missing drill starts the full fight", () => {
  const config = drillConfig();
  for (const options of [
    {},
    { drill: null },
    { drill: { phaseIndices: [], loop: true } },
  ]) {
    const state = createSimulation(config, TEST_SEED, options);
    expect(state.drill).toBeNull();
    expect(state.enemies[0].phaseIndex).toBe(0);
    expect(state.rulesVersion).toBe(config.rulesVersion);
  }
});

test("an explicit null drill is the full fight even with legacy aliases", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: null,
    startPhaseIndex: 2,
    loopPhase: true,
  });
  expect(state.drill).toBeNull();
  expect(state.enemies[0].phaseIndex).toBe(0);
  expect(state.rulesVersion).toBe(config.rulesVersion);
});

test.each([-1, 8, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects an invalid drill phase index %s",
  (index) => {
    expect(() =>
      createSimulation(drillConfig(), TEST_SEED, {
        drill: { phaseIndices: [index], loop: false },
      }),
    ).toThrow(RangeError);
  },
);

// --- Step 29.2: group transitions and finite clear ------------------------

test("single phase, Loop on: re-enters the same phase and resets health", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1], loop: true },
  });
  const entryHealth = state.enemies[0].healthHp as number;
  let sawReset = false;
  for (let tick = 0; tick < 500 && !sawReset; tick++) {
    const before = state.enemies[0].healthHp as number;
    advanceSimulation(state, stepSeconds, idle);
    if ((state.enemies[0].healthHp as number) > before) sawReset = true;
  }
  expect(sawReset).toBe(true);
  expect(state.phase).toBe("playing");
  expect(state.enemies[0].phaseIndex).toBe(1);
  expect(state.enemies[0].healthHp).toBeCloseTo(entryHealth, 9);
});

test("single phase, Loop off: clears after one exit", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1], loop: false },
  });
  runUntil(state, () => state.phase !== "playing", 500);
  expect(state.phase).toBe("cleared");
  expect(state.enemies[0].phaseIndex).toBe(1);
});

test("group [1, 3], Loop on: 1 -> 3 -> 1 -> 3", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1, 3], loop: true },
  });
  expect(phaseSequence(state, 500).slice(0, 4)).toEqual([1, 3, 1, 3]);
});

test("group [1, 3], Loop off: 1 -> 3, then cleared", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1, 3], loop: false },
  });
  expect(phaseSequence(state, 500)).toEqual([1, 3]);
  expect(state.phase).toBe("cleared");
});

test("group [1, 3, 5] with non-contiguous indices follows authored order", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [5, 1, 3], loop: true },
  });
  expect(phaseSequence(state, 800).slice(0, 4)).toEqual([1, 3, 5, 1]);
});

test("phase 8, Loop on: resets at health zero and re-enters instead of clearing", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [7], loop: true },
  });
  const entryHealth = state.enemies[0].healthHp as number;
  let sawReset = false;
  for (let tick = 0; tick < 500 && !sawReset; tick++) {
    const before = state.enemies[0].healthHp as number;
    advanceSimulation(state, stepSeconds, idle);
    if ((state.enemies[0].healthHp as number) > before) sawReset = true;
  }
  expect(sawReset).toBe(true);
  expect(state.phase).toBe("playing");
  expect(state.enemies[0].phaseIndex).toBe(7);
  expect(state.enemies[0].healthHp).toBeCloseTo(entryHealth, 9);
});

test("phase 8, Loop off: health zero clears", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [7], loop: false },
  });
  runUntil(state, () => state.phase !== "playing", 500);
  expect(state.phase).toBe("cleared");
  expect(state.enemies[0].healthHp).toBe(0);
});

test("a group ending at phase 8, Loop on: wraps to its first selected phase at health zero", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1, 7], loop: true },
  });
  expect(phaseSequence(state, 1000).slice(0, 3)).toEqual([1, 7, 1]);
  expect(state.phase).toBe("playing");
});

test("a group ending before phase 8, Loop off: clears at the last selected phase exit", () => {
  const config = drillConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [1, 3], loop: false },
  });
  runUntil(state, () => state.phase !== "playing", 500);
  expect(state.phase).toBe("cleared");
  expect(state.enemies[0].phaseIndex).toBe(3);
});

/** A primary whose phase 0 spawns a two-phase minion that exits by duration. */
function minionConfig(): EncounterConfig {
  const minionPhases: PhaseSpec[] = [
    {
      id: "m0",
      enterAtHpFraction: 1,
      exitAfterSeconds: 0.5,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "m0-attack" }],
    },
    {
      id: "m1",
      enterAtHpFraction: 0.5,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "red",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "m1-attack" }],
    },
  ];
  const minion: EnemyArchetype = {
    ...PRIMARY,
    id: MINION_ID,
    health: { maxHealthHp: 100, progression: { kind: "none" } },
    phases: minionPhases,
  };
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const primaryPhases: PhaseSpec[] = [
    {
      id: "p0",
      enterAtHpFraction: 1,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: [spawn],
      attacks: [{ ...PRIMARY_ATTACK, id: "p0-attack" }],
    },
    {
      id: "p1",
      enterAtHpFraction: 0.5,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "red",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p1-attack" }],
    },
    {
      id: "p2",
      enterAtHpFraction: 0.2,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "violet",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p2-attack" }],
    },
  ];
  const primary: EnemyArchetype = {
    ...PRIMARY,
    health: {
      maxHealthHp: 100,
      progression: { kind: "simulated-dps", hpPerSecond: 10 },
    },
    phases: primaryPhases,
  };
  return {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: primary, [MINION_ID]: minion },
  };
}

test("a phase-driven minion in the same fight still advances monotonically", () => {
  const config = minionConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [0], loop: true },
  });
  const minion = state.enemies.find((enemy) => enemy.spawnedByEnemyId !== null)!;
  expect(minion.phaseIndex).toBe(0);
  runUntil(state, () => minion.phaseIndex === 1, 200);
  expect(minion.phaseIndex).toBe(1);
  // The primary loops phase 0 every 5s; the minion must not be reset with it.
  runUntil(state, () => state.elapsedSeconds >= 6, 500);
  expect(minion.phaseIndex).toBe(1);
  // A non-despawnOnExit minion survives the primary's drill jump.
  expect(state.enemies.some((enemy) => enemy.id === minion.id)).toBe(true);
});

/** A primary whose phase 0 exits by duration while a spawned minion drains to zero. */
function minionHealthConfig(): EncounterConfig {
  const minion: EnemyArchetype = {
    ...PRIMARY,
    id: MINION_ID,
    health: {
      maxHealthHp: 100,
      progression: { kind: "simulated-dps", hpPerSecond: 10 },
    },
    phases: [
      {
        id: "m0",
        enterAtHpFraction: 1,
        exitAfterSeconds: null,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "amber",
        movement: STATIONARY,
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [{ ...PRIMARY_ATTACK, id: "m0-attack" }],
      },
    ],
  };
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: false,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const primary: EnemyArchetype = {
    ...PRIMARY,
    health: { maxHealthHp: 100, progression: { kind: "none" } },
    phases: [
      {
        id: "p0",
        enterAtHpFraction: 1,
        exitAfterSeconds: 10,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "amber",
        movement: STATIONARY,
        progression: null,
        subPhases: null,
        spawns: [spawn],
        attacks: [{ ...PRIMARY_ATTACK, id: "p0-attack" }],
      },
      {
        id: "p1",
        enterAtHpFraction: 0.5,
        exitAfterSeconds: null,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "red",
        movement: STATIONARY,
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [{ ...PRIMARY_ATTACK, id: "p1-attack" }],
      },
    ],
  };
  return {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: primary, [MINION_ID]: minion },
  };
}

test("a minion's health-zero clear survives a primary drill jump", () => {
  const config = minionHealthConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [0], loop: true },
  });
  const minion = state.enemies.find((enemy) => enemy.spawnedByEnemyId !== null)!;
  runUntil(state, () => state.elapsedSeconds >= 10, 700);
  expect(minion.healthHp).toBe(0);
  expect(state.phase).toBe("cleared");
});

/** A primary whose phase 0 exits by duration, spawns a despawn-on-exit minion and fires once. */
function jumpConfig(): EncounterConfig {
  const minion: EnemyArchetype = {
    ...PRIMARY,
    id: MINION_ID,
    health: undefined,
    phases: [
      {
        id: "m0",
        enterAtHpFraction: 1,
        exitAfterSeconds: null,
        telegraphSeconds: 0,
        invulnerableOnEnterSeconds: 0,
        telegraphColor: "amber",
        movement: STATIONARY,
        progression: null,
        subPhases: null,
        spawns: null,
        attacks: [{ ...PRIMARY_ATTACK, id: "m0-attack" }],
      },
    ],
  };
  const spawn: PhaseSpawnSpec = {
    archetypeId: MINION_ID,
    count: 1,
    despawnOnExit: true,
    startPhaseIndex: 0,
    placement: { kind: "ring-around-owner", radiusTiles: 2 },
  };
  const primaryPhases: PhaseSpec[] = [
    {
      id: "p0",
      enterAtHpFraction: 1,
      exitAfterSeconds: 0.2,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "amber",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: [spawn],
      attacks: [
        {
          ...PRIMARY_ATTACK,
          id: "jump-attack",
          cadence: {
            ...PRIMARY_ATTACK.cadence,
            initialDelaySeconds: 0,
            shotsPerBurst: 1,
            cooldownAfterLastShotSeconds: 10,
          },
        },
      ],
    },
    {
      id: "p1",
      enterAtHpFraction: 0.5,
      exitAfterSeconds: null,
      telegraphSeconds: 0,
      invulnerableOnEnterSeconds: 0,
      telegraphColor: "red",
      movement: STATIONARY,
      progression: null,
      subPhases: null,
      spawns: null,
      attacks: [{ ...PRIMARY_ATTACK, id: "p1-attack" }],
    },
  ];
  const primary: EnemyArchetype = {
    ...PRIMARY,
    health: {
      maxHealthHp: 100,
      progression: { kind: "simulated-dps", hpPerSecond: 10 },
    },
    phases: primaryPhases,
  };
  return {
    ...ENCOUNTER_CONFIG,
    archetypes: { [PRIMARY.id]: primary, [MINION_ID]: minion },
  };
}

test("fired shards survive a drill jump and only despawnOnExit minions disappear", () => {
  const config = jumpConfig();
  const state = createSimulation(config, TEST_SEED, {
    drill: { phaseIndices: [0], loop: true },
  });
  const firstMinion = state.enemies.find(
    (enemy) => enemy.spawnedByEnemyId !== null,
  )!;
  advanceSimulation(state, stepSeconds, idle);
  const shardIds = state.shards.map((shard) => shard.id);
  expect(shardIds.length).toBeGreaterThan(0);
  runUntil(state, () => state.elapsedSeconds >= 0.25, 100);
  expect(state.shards.map((shard) => shard.id)).toEqual(
    expect.arrayContaining(shardIds),
  );
  expect(state.enemies.some((enemy) => enemy.id === firstMinion.id)).toBe(false);
  expect(state.enemies.some((enemy) => enemy.spawnedByEnemyId !== null)).toBe(
    true,
  );
});

import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  primaryArchetype,
  validateEncounterConfig,
  type AttackMarks,
  type AttackSpec,
  type EncounterConfig,
  type PhaseSpec,
  type SubPhaseSpec,
} from "../config/encounter";
import { DEFAULT_DEBUG_SETTINGS } from "../config/debug";
import type { SimulationInput } from "../models";
import { advanceSimulation, createSimulation, setDebugSettings } from "./simulation";
import { cadenced } from "./test-support";

/** Plan V23 step 97.3: a marked attack fires its marks from the segment's entry. */
const idle: SimulationInput = { north: false, south: false, east: false, west: false };
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const CADENCE_ATTACK = cadenced(PRIMARY.phases[0].attacks[0]);

function markedAttack(id: string, marks: AttackMarks): AttackSpec {
  const { cadence: _cadence, ...rest } = CADENCE_ATTACK;
  return { ...rest, id, marks };
}

const basePhase: PhaseSpec = {
  ...PRIMARY.phases[0],
  id: "p",
  enterAtHpFraction: 1,
  exitAfterSeconds: null,
  telegraphSeconds: 1,
  invulnerableOnEnterSeconds: 0,
  movement: { kind: "stationary" },
  progression: null,
  subPhases: null,
  spawns: null,
};

function configWith(phase: Partial<PhaseSpec>): EncounterConfig {
  const config = {
    ...ENCOUNTER_CONFIG,
    archetypes: {
      [PRIMARY.id]: { ...PRIMARY, health: undefined, phases: [{ ...basePhase, ...phase }] },
    },
  };
  validateEncounterConfig(config);
  return config;
}

/** The simulation time of every volley the clock at `index` fires within `seconds`. */
function volleyTimes(config: EncounterConfig, seconds: number, index = 0): number[] {
  const state = createSimulation(config, 1);
  const times: number[] = [];
  const steps = Math.round(seconds / stepSeconds);
  const fullHealthHp = state.player.healthHp;
  for (let step = 0; step < steps; step++) {
    const before = state.enemies[0].attackClocks[index]?.volleysFired ?? 0;
    state.player.healthHp = fullHealthHp;
    advanceSimulation(state, stepSeconds, idle);
    const after = state.enemies[0].attackClocks[index]?.volleysFired ?? 0;
    for (let volley = before; volley < after; volley++) times.push(state.elapsedSeconds);
  }
  return times;
}

/** The first step time at or after `seconds`. */
const stepAt = (seconds: number) => Math.ceil(seconds / stepSeconds - 1e-9) * stepSeconds;

test("volleys fire on the step that reaches each marked offset from entry", () => {
  const times = volleyTimes(configWith({ attacks: [markedAttack("m", { bursts: [[1.5], [2.25]] })] }), 5);
  expect(times).toHaveLength(2);
  expect(times[0]).toBeCloseTo(stepAt(1.5), 9);
  expect(times[1]).toBeCloseTo(stepAt(2.25), 9);
});

test("a mark inside the telegraph fires before the epoch, and a mark at 0 fires at entry", () => {
  const times = volleyTimes(configWith({ attacks: [markedAttack("m", { bursts: [[0, 0.5]] })] }), 2);
  expect(times).toHaveLength(2);
  // The first step after entry, exactly as a cadence attack with no delay.
  expect(times[0]).toBeCloseTo(stepSeconds, 9);
  expect(times[1]).toBeLessThan(basePhase.telegraphSeconds);
});

test("two marks inside one step both fire on that step", () => {
  const times = volleyTimes(
    configWith({ attacks: [markedAttack("m", { bursts: [[1, 1 + stepSeconds / 4, 1 + stepSeconds / 4]] })] }),
    2,
  );
  expect(times).toHaveLength(3);
  expect(new Set(times.slice(1)).size).toBe(1);
});

test("a periodic attack repeats every period and starts no cycle after its stop", () => {
  const times = volleyTimes(
    configWith({
      attacks: [markedAttack("m", { bursts: [[1], [1.25]], periodSeconds: 2, stopAfterSeconds: 5.5 })],
    }),
    12,
  );
  // Cycles start at 1, 3 and 5; the cycle at 7 is after the stop.
  expect(times.map((time) => Math.round(time * 100) / 100)).toEqual(
    [1, 1.25, 3, 3.25, 5, 5.25].map((time) => Math.round(stepAt(time) * 100) / 100),
  );
});

test("a sub-phase attack restarts its marks on each sub-phase entry", () => {
  const subPhase = (id: string): SubPhaseSpec => ({
    id,
    durationSeconds: 2,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    movement: null,
    attacks: [markedAttack(`${id}-m`, { bursts: [[0.5]] })],
    spawns: null,
  });
  const times = volleyTimes(configWith({ attacks: [], subPhases: [subPhase("a"), subPhase("b")] }), 6.5);
  expect(times.map((time) => Math.round(time * 10) / 10)).toEqual([0.5, 2.5, 4.5, 6.5]);
});

test("a phase attack keeps counting from the phase's entry across its sub-phases", () => {
  const subPhase = (id: string): SubPhaseSpec => ({
    id,
    durationSeconds: 1,
    telegraphSeconds: 0,
    invulnerableOnEnterSeconds: 0,
    movement: null,
    attacks: [],
    spawns: null,
  });
  const times = volleyTimes(
    configWith({ attacks: [markedAttack("m", { bursts: [[0.5], [2.5]] })], subPhases: [subPhase("a"), subPhase("b")] }),
    4,
  );
  expect(times.map((time) => Math.round(time * 10) / 10)).toEqual([0.5, 2.5]);
});

test("the debug burst sliders do not move a marked volley (Q12)", () => {
  const config = configWith({ attacks: [markedAttack("m", { bursts: [[1], [2]] })] });
  const state = createSimulation(config, 1);
  advanceSimulation(state, 0.5, idle);
  const before = structuredClone(state.enemies[0].attackClocks[0]);
  setDebugSettings(state, { ...DEFAULT_DEBUG_SETTINGS, godMode: true });
  expect(state.enemies[0].attackClocks[0]).toEqual(before);
});

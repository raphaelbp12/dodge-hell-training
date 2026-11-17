import fc from "fast-check";
import { expect, test } from "vitest";
import {
  encounterConfigOf,
  primaryArchetype,
  type EncounterConfig,
} from "../config/encounter";
import { PALADIN_STATS } from "../config/stats";
import type { SimulationInput } from "../models";
import { propertyParameters, SIMULATION_PROPERTY_RUNS } from "../../test/property";
import { convexBodyFitsArenaShape, transformBodyVertices } from "./geometry";
import {
  advanceSimulation,
  createSimulation,
  type SimulationState,
} from "./simulation";

const QUEEN = encounterConfigOf("killer-bee-queen");
const WORM = encounterConfigOf("crystal-worm");
const QUEEN_PHASE_COUNT = primaryArchetype(QUEEN).phases.length;

/** Longest script, in segments and steps per segment: a runtime budget for the file. */
const MAX_SEGMENTS = 4;
const MAX_STEPS_PER_SEGMENT = 90;

type Scenario = {
  /** A drilled Queen phase index, or `null` for the Crystal Worm's full fight. */
  phaseIndex: number | null;
  seed: number;
  script: { input: SimulationInput; steps: number }[];
};

const inputArbitrary = fc.record({
  north: fc.boolean(),
  south: fc.boolean(),
  east: fc.boolean(),
  west: fc.boolean(),
});

const scenario: fc.Arbitrary<Scenario> = fc.record({
  phaseIndex: fc.option(fc.nat({ max: QUEEN_PHASE_COUNT - 1 }), { nil: null }),
  seed: fc.integer({ min: 0, max: 0xffffffff }),
  script: fc.array(
    fc.record({
      input: inputArbitrary,
      steps: fc.integer({ min: 1, max: MAX_STEPS_PER_SEGMENT }),
    }),
    { minLength: 1, maxLength: MAX_SEGMENTS },
  ),
});

function configOf(input: Scenario): EncounterConfig {
  return input.phaseIndex === null ? WORM : QUEEN;
}

function create(input: Scenario): SimulationState {
  return createSimulation(
    configOf(input),
    input.seed,
    input.phaseIndex === null
      ? {}
      : { drill: { phaseIndices: [input.phaseIndex], loop: true } },
  );
}

const parameters = propertyParameters({ numRuns: SIMULATION_PROPERTY_RUNS });

test("two runs of the same configuration, seed and script are deep-equal after every segment", () => {
  fc.assert(
    fc.property(scenario, (input) => {
      const first = create(input);
      const second = create(input);
      const stepSeconds = first.config.simulation.fixedStepSeconds;
      for (const segment of input.script) {
        for (let step = 0; step < segment.steps; step++) {
          advanceSimulation(first, stepSeconds, segment.input);
          advanceSimulation(second, stepSeconds, segment.input);
        }
        expect(second).toStrictEqual(first);
      }
    }),
    parameters,
  );
});

test("advancing the same total in any partition of whole fixed steps gives a deep-equal state", () => {
  fc.assert(
    fc.property(
      scenario,
      fc.array(fc.integer({ min: 1, max: 8 }), { minLength: 1, maxLength: 12 }),
      (input, chunkSizes) => {
        const whole = create(input);
        const chunked = create(input);
        const stepSeconds = whole.config.simulation.fixedStepSeconds;
        const maxSteps = whole.config.simulation.maxStepsPerUpdate;
        for (const segment of input.script) {
          for (let step = 0; step < segment.steps; step++)
            advanceSimulation(whole, stepSeconds, segment.input);
          let remaining = segment.steps;
          for (let index = 0; remaining > 0; index++) {
            const chunk = Math.min(
              remaining,
              maxSteps,
              chunkSizes[index % chunkSizes.length],
            );
            advanceSimulation(chunked, chunk * stepSeconds, segment.input);
            remaining -= chunk;
          }
          expect(chunked.ticksElapsed).toBe(whole.ticksElapsed);
          expect(chunked.player).toStrictEqual(whole.player);
          expect(chunked.enemies).toStrictEqual(whole.enemies);
          expect(chunked.shards).toStrictEqual(whole.shards);
          expect(chunked.bombs).toStrictEqual(whole.bombs);
          expect(chunked.phase).toBe(whole.phase);
        }
      },
    ),
    parameters,
  );
});

test("the player stays inside the arena, health stays within bounds and no projectile is accepted twice", () => {
  fc.assert(
    fc.property(scenario, (input) => {
      const state = create(input);
      const config = configOf(input);
      const stepSeconds = config.simulation.fixedStepSeconds;
      const acceptedProjectileIds = new Set<number>();
      for (const segment of input.script) {
        for (let step = 0; step < segment.steps; step++) {
          const result = advanceSimulation(state, stepSeconds, segment.input);
          for (const hit of result.acceptedHits) {
            // Honey ticks report id 0 and enemy contact a negative id.
            if (hit.shardId <= 0) continue;
            expect(acceptedProjectileIds.has(hit.shardId)).toBe(false);
            acceptedProjectileIds.add(hit.shardId);
          }
          expect(
            convexBodyFitsArenaShape(
              transformBodyVertices(
                config.player.verticesTiles,
                state.player.positionTiles,
              ),
              config.arena.shape,
            ),
          ).toBe(true);
          expect(state.player.healthHp).toBeGreaterThanOrEqual(0);
          expect(state.player.healthHp).toBeLessThanOrEqual(PALADIN_STATS.healthHp);
        }
      }
    }),
    parameters,
  );
});

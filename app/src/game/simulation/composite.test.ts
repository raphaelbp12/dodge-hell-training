import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIG,
  ENCOUNTER_CONFIGS,
  primaryArchetype,
  type AttackPattern,
  type EncounterConfig,
  type ProjectileSpec,
} from "../config/encounter";
import type { SimulationInput } from "../models";
import { advanceSimulation, createSimulation } from "./simulation";

const idle: SimulationInput = { north: false, south: false, east: false, west: false };
const SEED = 20261105;
const PRIMARY = primaryArchetype(ENCOUNTER_CONFIG);
const PRIMARY_PHASE = PRIMARY.phases[0];
const stepSeconds = ENCOUNTER_CONFIG.simulation.fixedStepSeconds;
const degrees = (value: number): number => (value * Math.PI) / 180;

/** A stationary primary firing one volley of `pattern` on its first tick. */
function configFiring(
  pattern: AttackPattern,
  projectiles: EncounterConfig["projectiles"] = ENCOUNTER_CONFIG.projectiles,
  projectileId = PRIMARY_PHASE.attacks[0].projectileId,
): EncounterConfig {
  const attack = {
    id: "composite",
    projectileId,
    tuningSource: "trainer-authored",
    pattern,
    cadence: {
      shotsPerBurst: 1,
      shotIntervalSeconds: 1,
      cooldownAfterLastShotSeconds: 5,
      initialDelaySeconds: 0,
    },
  };
  return {
    ...ENCOUNTER_CONFIG,
    projectiles,
    archetypes: {
      [PRIMARY.id]: {
        ...PRIMARY,
        phases: [
          {
            ...PRIMARY_PHASE,
            movement: { kind: "stationary" as const },
            attacks: [attack],
          },
        ],
      },
    },
  };
}

const ringOf = (
  armPattern: Extract<AttackPattern, { kind: "ring" }>["armPattern"],
  overrides: Partial<Extract<AttackPattern, { kind: "ring" }>> = {},
): AttackPattern => ({
  kind: "ring",
  arms: 4,
  emitterRadiusTiles: 0,
  initialPhaseRadians: 0,
  clockwiseDegreesPerSecond: 0,
  armPattern,
  ...overrides,
});

test("a ring of 3-shot spreads fires 12 shards in clusters around each arm", () => {
  const state = createSimulation(
    configFiring(ringOf({ kind: "spread", shots: 3, arcDegrees: 20 })),
    SEED,
  );
  advanceSimulation(state, stepSeconds, idle);
  expect(state.shards).toHaveLength(12);
  state.shards.forEach((shard, index) => {
    const arm = Math.floor(index / 3);
    const offset = (index % 3) - 1;
    expect(shard.orientationRadians).toBeCloseTo(
      arm * (Math.PI / 2) + offset * degrees(10),
      12,
    );
  });
});

test("a nested scatter draws one value per final shot, in order, from the seeded stream", () => {
  const pattern = ringOf({ kind: "scatter", shots: 2, coneDegrees: 40 }, { arms: 2 });
  const first = createSimulation(configFiring(pattern), SEED);
  advanceSimulation(first, stepSeconds, idle);
  expect(first.shards).toHaveLength(4);
  const again = createSimulation(configFiring(pattern), SEED);
  advanceSimulation(again, stepSeconds, idle);
  expect(again.shards.map((shard) => shard.orientationRadians)).toEqual(
    first.shards.map((shard) => shard.orientationRadians),
  );
  const other = createSimulation(configFiring(pattern), SEED + 1);
  advanceSimulation(other, stepSeconds, idle);
  expect(other.shards.map((shard) => shard.orientationRadians)).not.toEqual(
    first.shards.map((shard) => shard.orientationRadians),
  );
  // Each cluster stays inside its cone around its own arm.
  first.shards.forEach((shard, index) => {
    const arm = index < 2 ? 0 : Math.PI;
    expect(Math.abs(shard.orientationRadians - arm)).toBeLessThanOrEqual(degrees(20) + 1e-12);
  });
});

test("a pattern with no scatter consumes no random draws", () => {
  const plain = createSimulation(configFiring(ringOf(undefined)), SEED);
  const composite = createSimulation(
    configFiring(ringOf({ kind: "spread", shots: 3, arcDegrees: 20 })),
    SEED,
  );
  advanceSimulation(plain, stepSeconds, idle);
  advanceSimulation(composite, stepSeconds, idle);
  expect(composite.randomSeed).toBe(plain.randomSeed);
});

test("a composite volley is identical across 30, 60 and 120 Hz", () => {
  const config = configFiring(
    ringOf({ kind: "scatter", shots: 3, coneDegrees: 50 }, { clockwiseDegreesPerSecond: 40 }),
  );
  const runs = [30, 60, 120].map((hz) => {
    const state = createSimulation(config, SEED);
    // 2 simulated seconds at hz updates per second; the fixed step is 1/60 s.
    for (let update = 0; update < hz * 2; update++)
      advanceSimulation(state, 1 / hz, idle);
    return state.shards.map((shard) => shard.orientationRadians);
  });
  expect(runs[1]).toEqual(runs[0]);
  expect(runs[2]).toEqual(runs[0]);
});

test("a composite firing a bomb creates BombStates, not shards", () => {
  const queen = ENCOUNTER_CONFIGS["killer-bee-queen"];
  const config = configFiring(
    ringOf({ kind: "spread", shots: 2, arcDegrees: 10 }, { arms: 3 }),
    queen.projectiles as Readonly<Record<string, ProjectileSpec>>,
    "white-bomb-v1",
  );
  const state = createSimulation(config, SEED);
  advanceSimulation(state, stepSeconds, idle);
  expect(state.shards).toHaveLength(0);
  expect(state.bombs).toHaveLength(6);
});

test("rotation moves every arm's cluster together", () => {
  const config = configFiring(
    ringOf({ kind: "spread", shots: 3, arcDegrees: 20 }, { clockwiseDegreesPerSecond: 90 }),
  );
  const volleyAt = (initialDelaySeconds: number) => {
    const state = createSimulation(config, SEED);
    state.enemies[0].attackClocks[0].initialDelaySeconds = initialDelaySeconds;
    while (state.shards.length === 0) advanceSimulation(state, stepSeconds, idle);
    return {
      elapsedSeconds: state.elapsedSeconds,
      bearings: state.shards.map((shard) => shard.orientationRadians),
    };
  };
  const early = volleyAt(0);
  const late = volleyAt(1);
  expect(late.bearings).toHaveLength(12);
  const turnRadians = degrees(90) * (late.elapsedSeconds - early.elapsedSeconds);
  late.bearings.forEach((bearing, index) =>
    expect(bearing - early.bearings[index]).toBeCloseTo(turnRadians, 9),
  );
});

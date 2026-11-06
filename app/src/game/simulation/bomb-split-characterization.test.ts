import { expect, test } from "vitest";
import {
  ENCOUNTER_CONFIGS,
  type AttackSpec,
  type EncounterConfig,
} from "../config/encounter";
import type { SimulationInput } from "../models";
import { advanceSimulation, createSimulation, type SimulationState } from "./simulation";

/**
 * Plan V15 N23: proves the bomb/shard split changes nothing. The expected
 * values were recorded on the code before the split and must never be edited
 * to make a later step pass. Each fixed step contributes accepted hits,
 * detonations and every live projectile (id order, 9-decimal positions); one
 * FNV-1a digest per simulated second keeps the snapshot small, and the first
 * differing second is the first mismatching entry of the snapshot diff.
 */
const idle: SimulationInput = {
  north: false,
  south: false,
  east: false,
  west: false,
};
const SEED = 20261105;
const STEPS_PER_SECOND = 60;
/**
 * Plan V15 N02 gave `white-bomb-targeted` a `target`. The expected values
 * predate it, so this configuration removes `target` again; everything else
 * the split and the targeting code touch must still match them.
 */
function withoutTargets(shipped: EncounterConfig): EncounterConfig {
  const strip = (attacks: readonly AttackSpec[]): AttackSpec[] =>
    attacks.map(({ target: _target, ...attack }) => attack);
  const archetypes = Object.fromEntries(
    Object.entries(shipped.archetypes).map(([id, archetype]) => [
      id,
      {
        ...archetype,
        phases: archetype.phases.map((phase) => ({
          ...phase,
          attacks: strip(phase.attacks),
          subPhases:
            phase.subPhases?.map((subPhase) => ({
              ...subPhase,
              attacks: strip(subPhase.attacks),
            })) ?? null,
        })),
      },
    ]),
  );
  return { ...shipped, archetypes };
}
const config = withoutTargets(ENCOUNTER_CONFIGS["killer-bee-queen"]);

/** Every live projectile in id order, across both lists. */
function liveProjectiles(state: SimulationState): readonly {
  id: number;
  projectileId: string;
  positionTiles: { x: number; y: number };
}[] {
  return [...state.shards, ...state.bombs].sort((a, b) => a.id - b.id);
}

const round = (value: number): string => value.toFixed(9);

function fnv1a(text: string, seed: number): number {
  let hash = seed;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

type SecondRecord = Readonly<{
  second: number;
  digest: string;
  hits: number;
  detonations: number;
  live: number;
}>;

/**
 * `immortal` turns god mode on, so the run lasts long enough to fire and
 * detonate every bomb; a mortal run records the accepted hits instead.
 */
function characterize(
  options: { startPhaseIndex?: number },
  seconds: number,
  immortal: boolean,
): SecondRecord[] {
  const state = createSimulation(config, SEED, options);
  state.debugSettings = { ...state.debugSettings, godMode: immortal };
  const records: SecondRecord[] = [];
  let digest = 2166136261;
  let hits = 0;
  let detonations = 0;
  for (let step = 1; step <= seconds * STEPS_PER_SECOND; step++) {
    const result = advanceSimulation(state, config.simulation.fixedStepSeconds, idle);
    const parts: string[] = [`t${state.ticksElapsed}`];
    for (const hit of result.acceptedHits) {
      hits++;
      parts.push(`h${hit.shardId}:${hit.damageHp}`);
    }
    for (const event of result.detonations) {
      detonations++;
      parts.push(
        `d${event.projectileId}:${round(event.positionTiles.x)},${round(event.positionTiles.y)}:${event.radiusTiles}`,
      );
    }
    for (const live of liveProjectiles(state))
      parts.push(
        `p${live.id}:${live.projectileId}:${round(live.positionTiles.x)},${round(live.positionTiles.y)}`,
      );
    digest = fnv1a(parts.join("|"), digest);
    if (step % STEPS_PER_SECOND === 0 || state.phase !== "playing") {
      records.push({
        second: Math.ceil(step / STEPS_PER_SECOND),
        digest: digest.toString(16),
        hits,
        detonations,
        live: liveProjectiles(state).length,
      });
    }
    if (state.phase !== "playing") break;
  }
  return records;
}

const scenarios = [
  { name: "the full fight", options: {}, seconds: 30, file: "phase-0" },
  ...[1, 2, 6].map((phaseIndex) => ({
    name: `a drill into phase ${phaseIndex}`,
    options: { startPhaseIndex: phaseIndex },
    seconds: 20,
    file: `phase-${phaseIndex}`,
  })),
];

for (const scenario of scenarios) {
  for (const immortal of [false, true]) {
    const mode = immortal ? "immortal" : "mortal";
    test(`${scenario.name} behaves as recorded (${mode})`, async () => {
      const records = characterize(scenario.options, scenario.seconds, immortal);
      const last = records[records.length - 1];
      if (immortal) expect(last.detonations).toBeGreaterThan(0);
      else expect(last.hits).toBeGreaterThan(0);
      await expect(JSON.stringify(records, null, 1)).toMatchFileSnapshot(
        `./bomb-split-characterization.${scenario.file}.${mode}.snap.json`,
      );
    });
  }
}

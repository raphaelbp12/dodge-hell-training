import { test } from "vitest";
import {
  encounterConfigOf,
  primaryArchetype,
  type EncounterConfig,
} from "../config/encounter";
import type { ShardState, SimulationInput, Vector2 } from "../models";
import { sweptConvexPartsOverlap, transformBodyParts, transformBodyVertices } from "./geometry";
import { advanceShard, createShard } from "./projectiles";
import { advanceSimulation, createSimulation, type SimulationState } from "./simulation";

/**
 * Plan V22 A23. Each benchmark builds its state in `setup`, so only the
 * measured work is timed. The configuration is read, never changed.
 */

const QUEEN = encounterConfigOf("killer-bee-queen");
const WORM = encounterConfigOf("crystal-worm");
const SEED = 1;
const SIMULATED_SECONDS = 10;/** Whole seconds each phase runs when its densest point is looked for. */
const PROBE_SECONDS = 20;

const strafe: readonly SimulationInput[] = [
  { north: false, south: false, east: true, west: false },
  { north: false, south: true, east: false, west: false },
  { north: false, south: false, east: false, west: true },
  { north: true, south: false, east: false, west: false },
];
const STRAFE_PERIOD_STEPS = 30;

function steps(config: EncounterConfig, seconds: number): number {
  return Math.round(seconds / config.simulation.fixedStepSeconds);
}

/** Advances `seconds` of scripted circle-strafe input, one fixed step at a time. */
function run(state: SimulationState, seconds: number, onStep?: () => void): void {
  const { fixedStepSeconds } = state.config.simulation;
  for (let step = 0; step < steps(state.config, seconds); step++) {
    advanceSimulation(state, fixedStepSeconds, strafe[Math.floor(step / STRAFE_PERIOD_STEPS) % strafe.length]);
    onStep?.();
  }
}

/** The drilled Queen phase with the most live shards, found by running each once. */
function densestQueenPhase(): { phaseIndex: number; peakShards: number } {
  let best = { phaseIndex: 0, peakShards: -1 };
  const count = primaryArchetype(QUEEN).phases.length;
  for (let phaseIndex = 0; phaseIndex < count; phaseIndex++) {
    const state = createSimulation(QUEEN, SEED, { drill: { phaseIndices: [phaseIndex], loop: true } });
    let peak = 0;
    run(state, PROBE_SECONDS, () => {
      peak = Math.max(peak, state.shards.length);
    });
    if (peak > best.peakShards) best = { phaseIndex, peakShards: peak };
  }
  return best;
}

const densest = densestQueenPhase();

let queenState: SimulationState;
let wormState: SimulationState;

const bullets = Object.values(QUEEN.projectiles).filter((projectile) => projectile.type === "bullet");
const shardTemplate = bullets[0];
if (shardTemplate.type !== "bullet") throw new Error("expected a bullet in the Queen's catalog");
const farAway: Vector2 = { x: 1e6, y: 1e6 };
const shardContext = {
  config: QUEEN,
  collisionBoundingRadiusTiles: Math.max(...QUEEN.player.verticesTiles.map((vertex) => Math.hypot(vertex.x, vertex.y))),
};
const shardCount = Math.max(densest.peakShards, 1);
let shards: ShardState[];

const largest = Object.values(QUEEN.projectiles).reduce((best, projectile) =>
  projectile.collisionPartsTiles.length > best.collisionPartsTiles.length ? projectile : best,
);
const playerBody = transformBodyVertices(QUEEN.player.verticesTiles, { x: 1, y: 0 });
const projectileParts = transformBodyParts(largest.collisionPartsTiles, { x: -1, y: 0 }, 0.3);

/** Calls per measured iteration of the microbenchmarks, so one takes roughly 0.5 to 2 ms and its rme stays low. */
const REPEATS = 1000;

/** One result file per benchmark; `scripts/bench-gate.mjs` reads the directory. */
const resultPath = (slug: string) => `reports/bench/${slug}.json`;

test("simulation benchmarks", async ({ bench }) => {
  const queen = bench(
    `Queen phase ${densest.phaseIndex + 1} (densest, peak ${densest.peakShards} shards), ${SIMULATED_SECONDS} simulated seconds`,
    {
      writeResult: resultPath("queen-densest-phase"),
      beforeEach: () => {
        queenState = createSimulation(QUEEN, SEED, { drill: { phaseIndices: [densest.phaseIndex], loop: true } });
      },
    },
    () => run(queenState, SIMULATED_SECONDS),
  );
  const worm = bench(
    `Crystal Worm and its minions, ${SIMULATED_SECONDS} simulated seconds`,
    {
      writeResult: resultPath("minion-encounter"),
      beforeEach: () => {
        wormState = createSimulation(WORM, SEED);
      },
    },
    () => run(wormState, SIMULATED_SECONDS),
  );
  const advance = bench(
    `advanceShard, ${REPEATS} steps over ${shardCount} live shards`,
    {
      writeResult: resultPath("advance-shard-x1000"),
      beforeEach: () => {
        shards = Array.from({ length: shardCount }, (_, index) =>
          createShard(shardTemplate, index + 1, { x: 0, y: 0 }, (index / shardCount) * 2 * Math.PI),
        );
      },
    },
    () => {
      for (let repeat = 0; repeat < REPEATS; repeat++)
        for (const shard of shards)
          advanceShard(shardContext, shard, QUEEN.simulation.fixedStepSeconds, farAway, farAway);
    },
  );
  const swept = bench(
    `sweptConvexPartsOverlap x${REPEATS}, ${largest.id} (${largest.collisionPartsTiles.length} parts) against the player body`,
    { writeResult: resultPath("swept-overlap-x1000") },
    () => {
      for (let repeat = 0; repeat < REPEATS; repeat++)
        sweptConvexPartsOverlap(projectileParts, { x: 0.2, y: 0.05 }, playerBody, { x: -0.05, y: 0 });
    },
  );
  await bench.compare(queen, worm, advance, swept);
});

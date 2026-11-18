import { readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { MUTATE_GLOBS, MUTATION_SHARDS, shardOptions } from "../stryker.config.mjs";

const NEGATED = MUTATE_GLOBS.filter((glob) => glob.startsWith("!"));

test("a shard mutates only its own directories and keeps every exclusion", () => {
  const { mutate } = shardOptions("state");
  expect(mutate.filter((glob) => !glob.startsWith("!"))).toEqual([
    "src/game/session/**/*.ts",
    "src/storage/**/*.ts",
  ]);
  expect(mutate.filter((glob) => glob.startsWith("!"))).toEqual(NEGATED);
});

const SIMULATION_GLOB = "src/game/simulation/**/*.ts";

/** The mutated simulation sources: every non-test .ts file in the directory. */
function simulationSources() {
  return readdirSync("src/game/simulation")
    .filter((file) => file.endsWith(".ts") && !/\.(test|property\.test|soak\.test|bench)\.ts$|^test-support\.ts$/.test(file))
    .map((file) => `src/game/simulation/${file}`);
}

test("the shards together cover every mutated glob and simulation file exactly once", () => {
  const positive = Object.keys(MUTATION_SHARDS).flatMap((name) =>
    shardOptions(name).mutate.filter((glob) => !glob.startsWith("!")),
  );
  const expected = MUTATE_GLOBS.filter((glob) => !glob.startsWith("!") && glob !== SIMULATION_GLOB);
  expect(positive.toSorted()).toEqual([...expected, ...simulationSources()].toSorted());
});

test("a shard that lists files mutates exactly those files and keeps every exclusion", () => {
  const { mutate } = shardOptions("simulation-main");
  expect(mutate.filter((glob) => !glob.startsWith("!"))).toEqual(["src/game/simulation/simulation.ts"]);
  expect(mutate.filter((glob) => glob.startsWith("!"))).toEqual(NEGATED);
});

test("each shard keeps its own incremental file and reports, so parallel jobs never share one", () => {
  const research = shardOptions("research");
  expect(research.incrementalFile).toBe("reports/mutation/stryker-incremental-research.json");
  expect(research.htmlReporter.fileName).toBe("reports/mutation/research/mutation.html");
  expect(research.jsonReporter.fileName).toBe("reports/mutation/research/mutation.json");
});

test("each shard breaks at its own ratcheted score", () => {
  expect(shardOptions("research").thresholds.break).toBe(MUTATION_SHARDS.research.break);
  expect(shardOptions("simulation-core").thresholds.break).toBe(MUTATION_SHARDS["simulation-core"].break);
});

test("no shard leaves the whole-set options unchanged, and an unknown shard throws", () => {
  expect(shardOptions(undefined)).toEqual({});
  expect(() => shardOptions("ui")).toThrow('Unknown MUTATION_SHARD "ui"');
});

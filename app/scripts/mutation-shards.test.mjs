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

test("the shards together cover every mutated glob exactly once", () => {
  const positive = Object.keys(MUTATION_SHARDS).flatMap((name) =>
    shardOptions(name).mutate.filter((glob) => !glob.startsWith("!")),
  );
  expect(positive.toSorted()).toEqual(MUTATE_GLOBS.filter((glob) => !glob.startsWith("!")).toSorted());
});

test("each shard keeps its own incremental file and reports, so parallel jobs never share one", () => {
  const research = shardOptions("research");
  expect(research.incrementalFile).toBe("reports/mutation/stryker-incremental-research.json");
  expect(research.htmlReporter.fileName).toBe("reports/mutation/research/mutation.html");
  expect(research.jsonReporter.fileName).toBe("reports/mutation/research/mutation.json");
});

test("each shard breaks at its own ratcheted score", () => {
  expect(shardOptions("research").thresholds.break).toBe(MUTATION_SHARDS.research.break);
  expect(shardOptions("simulation").thresholds.break).toBe(MUTATION_SHARDS.simulation.break);
});

test("no shard leaves the whole-set options unchanged, and an unknown shard throws", () => {
  expect(shardOptions(undefined)).toEqual({});
  expect(() => shardOptions("ui")).toThrow('Unknown MUTATION_SHARD "ui"');
});

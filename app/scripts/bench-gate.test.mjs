import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  BENCH_MAX_RME_PERCENT,
  noisyBenchmarks,
  rmesOf,
  worstRmes,
  BENCH_REGRESSION_THRESHOLD,
  bestMeans,
  calibration,
  compareBenchmarks,
  formatTable,
  typicalOf,
  runOf,
} from "./bench-gate.mjs";

const run = (entries) =>
  runOf(Object.entries(entries).map(([name, mean]) => [`${name}.json`, { latency: { p50: mean, mean: mean * 1000 } }]));

test("reads the median latency of a result file, falls back to the mean and ignores a file without either", () => {
  expect(typicalOf({ latency: { p50: 4.5, mean: 90 } })).toBe(4.5);
  expect(typicalOf({ latency: { mean: 4.5 } })).toBe(4.5);
  expect(typicalOf({})).toBeNull();
  expect([...run({ a: 1, b: 2 })]).toEqual([
    ["a", 1],
    ["b", 2],
  ]);
  expect(runOf([["bad.json", { nothing: true }]]).size).toBe(0);
});

test("keeps the lowest mean of each benchmark across runs", () => {
  const best = bestMeans([run({ a: 5, b: 2 }), run({ a: 3, b: 4 })]);
  expect(best.get("a")).toBe(3);
  expect(best.get("b")).toBe(2);
});

test("passes when head is within the threshold, including exactly at it", () => {
  const base = bestMeans([run({ a: 100 })]);
  const atThreshold = bestMeans([run({ a: 100 * (1 + BENCH_REGRESSION_THRESHOLD) })]);
  expect(compareBenchmarks(base, atThreshold, BENCH_REGRESSION_THRESHOLD).regressions).toEqual([]);
});

test("fails when head is slower than the threshold", () => {
  const base = bestMeans([run({ a: 100 })]);
  const slow = bestMeans([run({ a: 100 * (1 + BENCH_REGRESSION_THRESHOLD) + 0.001 })]);
  const result = compareBenchmarks(base, slow, BENCH_REGRESSION_THRESHOLD);
  expect(result.regressions.map((row) => row.name)).toEqual(["a"]);
  expect(formatTable(result, BENCH_REGRESSION_THRESHOLD)).toContain("SLOWER");
});

test("a faster head never fails", () => {
  expect(compareBenchmarks(bestMeans([run({ a: 100 })]), bestMeans([run({ a: 10 })])).regressions).toEqual([]);
});

test("a benchmark present on one side only is listed and skipped", () => {
  const result = compareBenchmarks(
    bestMeans([run({ a: 100, onlyBase: 1 })]),
    bestMeans([run({ a: 100, onlyHead: 1 })]),
  );
  expect(result.regressions).toEqual([]);
  expect(result.skipped).toEqual(["onlyBase (missing on head)", "onlyHead (missing on base)"]);
});

test("an empty base reports no base benchmarks and passes", () => {
  const result = compareBenchmarks(bestMeans([]), bestMeans([run({ a: 1 })]));
  expect(result.regressions).toEqual([]);
  expect(formatTable(result)).toBe("no base benchmarks");
});

test("calibration takes the worst difference in either direction and triples it, never below the floor", () => {
  const noisy = compareBenchmarks(bestMeans([run({ a: 10, b: 10 })]), bestMeans([run({ a: 11, b: 8.8 })]));
  expect(calibration(noisy)).toEqual({ worstDifference: expect.closeTo(0.12, 9), threshold: expect.closeTo(0.36, 9) });
  const quiet = compareBenchmarks(bestMeans([run({ a: 10 })]), bestMeans([run({ a: 10.1 })]));
  expect(calibration(quiet).threshold).toBe(0.2);
});

test("calibration of an empty comparison has no difference and keeps the floor", () => {
  expect(calibration(compareBenchmarks(bestMeans([]), bestMeans([])))).toEqual({ worstDifference: 0, threshold: 0.2 });
});

test("reads rme per benchmark, keeps the worst across runs and lists those above the limit", () => {
  const a = rmesOf([["x.json", { latency: { rme: 1 } }], ["y.json", { latency: { rme: 9 } }], ["z.json", {}]]);
  expect([...a]).toEqual([["x", 1], ["y", 9]]);
  const worst = worstRmes([a, rmesOf([["x.json", { latency: { rme: 6 } }]])]);
  expect(worst.get("x")).toBe(6);
  expect(noisyBenchmarks(worst)).toEqual(["x", "y"]);
  expect(noisyBenchmarks(new Map([["ok", BENCH_MAX_RME_PERCENT]]))).toEqual([]);
});

test("the table shows rme and warns on a noisy benchmark without failing it", () => {
  const result = compareBenchmarks(bestMeans([run({ a: 10 })]), bestMeans([run({ a: 10 })]));
  const table = formatTable(result, BENCH_REGRESSION_THRESHOLD, new Map([["a", 7.25]]));
  expect(table).toContain("| 7.3%");
  expect(table).toContain("warning: a rme 7.3% is above 5%");
  expect(result.regressions).toEqual([]);
});

test("calibrate mode exits nonzero and names a noisy benchmark; gate mode only warns", () => {
  const dir = mkdtempSync(join(tmpdir(), "bench-"));
  const write = (name, rme) => writeFileSync(join(dir, `${name}.json`), JSON.stringify({ latency: { p50: 1, rme } }));
  write("quiet", 1);
  write("loud", 12);
  const script = fileURLToPath(new URL("./bench-gate.mjs", import.meta.url));
  const calibrate = spawnSync("node", [script, "--calibrate", "--base", dir, "--head", dir], { encoding: "utf8" });
  expect(calibrate.status).toBe(1);
  expect(calibrate.stdout).toContain("loud");
  const gate = spawnSync("node", [script, "--base", dir, "--head", dir], { encoding: "utf8" });
  expect(gate.status).toBe(0);
  expect(gate.stdout).toContain("warning: loud");
});

test("the threshold is at least the plan's 20 percent floor", () => {
  expect(BENCH_REGRESSION_THRESHOLD).toBeGreaterThanOrEqual(0.2);
});

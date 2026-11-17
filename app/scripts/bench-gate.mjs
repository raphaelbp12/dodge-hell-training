// Same-runner benchmark gate (plan V22 A24). Takes the result directories of
// alternating base and head `vitest bench` runs, keeps each benchmark's best
// (lowest) mean per side and fails when any benchmark present on both sides is
// slower on head by more than the threshold.
//
// Each run is a directory of result files (`reports/bench/*.json`, written by
// `npm run bench`), copied aside after every run.
//
// Usage: node scripts/bench-gate.mjs --base dirA dirB --head dirC dirD [--calibrate]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Largest tolerated slowdown, as a fraction of the base mean (0.20 is 20 percent).
 *
 * Plan V22 A24 sets it to the larger of 0.20 and three times the worst
 * base-against-base difference over three CI runs. Measured on 2026-11-17 with
 * the manual workflow `.github/workflows/bench-calibrate.yml` at five rounds a
 * side, worst difference per run:
 *   run 1: 0.5% (minion-encounter), run 2: 1.5% (minion-encounter),
 *   run 3: 3.7% (advance-shard).
 * Three times 3.7 is 11.1 percent, under the floor, so the floor applies.
 * Remeasure with the same workflow after a change to the benchmarks or to
 * BENCH_ROUNDS, and record the new runs here and in docs/quality-gates.md.
 */
export const BENCH_REGRESSION_THRESHOLD = 0.2;

/** The mean latency, in milliseconds, of one benchmark result file written by `bench(..., { writeResult })`. */
export function meanOf(result) {
  const mean = result?.latency?.mean;
  return typeof mean === "number" ? mean : null;
}

/** One run: result file name (without `.json`) to mean, from `[fileName, parsedJson]` pairs. */
export function runOf(files) {
  const means = new Map();
  for (const [fileName, result] of files) {
    const mean = meanOf(result);
    if (mean !== null) means.set(fileName.replace(/\.json$/, ""), mean);
  }
  return means;
}

/** Per benchmark, the lowest mean across the given runs. */
export function bestMeans(runs) {
  const best = new Map();
  for (const run of runs)
    for (const [name, mean] of run)
      if (!best.has(name) || mean < best.get(name)) best.set(name, mean);
  return best;
}

/**
 * Compares best means. `rows` holds every benchmark on both sides;
 * `regressions` those slower than the threshold; `skipped` names a benchmark
 * present on only one side.
 */
export function compareBenchmarks(base, head, threshold = BENCH_REGRESSION_THRESHOLD) {
  if (base.size === 0)
    return { rows: [], regressions: [], skipped: [], message: "no base benchmarks" };
  const rows = [];
  const skipped = [];
  for (const [name, baseMean] of base) {
    if (!head.has(name)) {
      skipped.push(`${name} (missing on head)`);
      continue;
    }
    const headMean = head.get(name);
    const change = baseMean === 0 ? 0 : (headMean - baseMean) / baseMean;
    rows.push({ name, base: baseMean, head: headMean, change });
  }
  for (const name of head.keys()) if (!base.has(name)) skipped.push(`${name} (missing on base)`);
  return {
    rows,
    regressions: rows.filter((row) => row.change > threshold),
    skipped,
    message: null,
  };
}

/** The plan's floor for the threshold (A24). */
const THRESHOLD_FLOOR = 0.2;

/**
 * Calibration from a base-against-base comparison (A24): the worst difference
 * in either direction, and the threshold it implies, the larger of the floor
 * and three times that difference.
 */
export function calibration(result) {
  const worstDifference = Math.max(0, ...result.rows.map((row) => Math.abs(row.change)));
  return { worstDifference, threshold: Math.max(THRESHOLD_FLOOR, 3 * worstDifference) };
}

/** The table printed to the log, one benchmark per line. */
export function formatTable(result, threshold = BENCH_REGRESSION_THRESHOLD) {
  if (result.message) return result.message;
  const lines = ["benchmark | base ms | head ms | change"];
  for (const row of result.rows) {
    const flag = row.change > threshold ? "  SLOWER" : "";
    lines.push(
      `${row.name} | ${row.base.toFixed(4)} | ${row.head.toFixed(4)} | ${(row.change * 100).toFixed(1)}%${flag}`,
    );
  }
  for (const entry of result.skipped) lines.push(`skipped: ${entry}`);
  lines.push(`threshold: ${(threshold * 100).toFixed(0)}% slower than base`);
  return lines.join("\n");
}

function parseArguments(argv) {
  const groups = { "--base": [], "--head": [] };
  let current = null;
  for (const argument of argv) {
    if (argument in groups) current = argument;
    else if (argument.startsWith("--")) continue; // a flag such as --calibrate, never a directory
    else if (current) groups[current].push(argument);
  }
  return groups;
}

function readRuns(directories) {
  const runs = [];
  for (const directory of directories) {
    try {
      const files = readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .map((name) => [name, JSON.parse(readFileSync(join(directory, name), "utf8"))]);
      runs.push(runOf(files));
    } catch {
      // A missing directory means that run produced no benchmarks.
    }
  }
  return runs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { "--base": basePaths, "--head": headPaths } = parseArguments(process.argv.slice(2));
  const base = bestMeans(readRuns(basePaths));
  const head = bestMeans(readRuns(headPaths));
  const result = compareBenchmarks(base, head);
  console.log(formatTable(result));
  if (process.argv.includes("--calibrate")) {
    // Base-against-base run (.github/workflows/bench-calibrate.yml): report, never fail.
    const { worstDifference, threshold } = calibration(result);
    console.log(
      `calibration: worst difference ${(worstDifference * 100).toFixed(1)}%, implied threshold ${(threshold * 100).toFixed(1)}%`,
    );
    process.exit(0);
  }
  process.exit(result.regressions.length > 0 ? 1 : 0);
}

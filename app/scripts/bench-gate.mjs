// Same-runner benchmark gate (plan V22 A24). Takes the result directories of
// alternating base and head `vitest bench` runs, keeps each benchmark's best
// (lowest) median per side and fails when any benchmark present on both sides is
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
 * Largest tolerated slowdown, as a fraction of the base median (0.20 is 20 percent).
 *
 * Plan V22 A24 sets it to the larger of 0.20 and three times the worst
 * base-against-base difference over three CI runs. Measured on 2026-11-17 with
 * the manual workflow `.github/workflows/bench-calibrate.yml` at five rounds a
 * side, worst difference per run:
 *   run 1: 0.5% (minion-encounter), run 2: 1.5% (minion-encounter),
 *   run 3: 3.7% (advance-shard).
 * Three times 3.7 is 11.1 percent, under the floor, so the floor applies.
 * These runs used the mean. The gate now compares the median, so re-run
 * `.github/workflows/bench-calibrate.yml` three times and update the figures.
 * The calibration must also be re-run after the 2026-11-18 change that batched
 * `advance-shard` and `swept-overlap` into `advance-shard-x1000` and
 * `swept-overlap-x1000` and added the rme check (BENCH_MAX_RME_PERCENT).
 * Remeasure with the same workflow after a change to the benchmarks or to
 * BENCH_ROUNDS, and record the new runs here and in docs/quality-gates.md.
 */
export const BENCH_REGRESSION_THRESHOLD = 0.2;

/**
 * The typical latency, in milliseconds, of one benchmark result file written
 * by `bench(..., { writeResult })`: the median (`latency.p50`), or the mean
 * when a file has no median. The mean is not used first because a few GC or
 * scheduler outliers dominate it on a sub-microsecond benchmark. On
 * 2026-11-18 `advance-shard` (about 0.01 ms) read 36 percent slower on a
 * change that touched no simulation code, with a maximum of 17 ms against a
 * 0.0078 ms minimum. The median ignores such outliers.
 */
export function typicalOf(result) {
  const { p50, mean } = result?.latency ?? {};
  if (typeof p50 === "number") return p50;
  return typeof mean === "number" ? mean : null;
}

/**
 * Largest tolerated relative margin of error (`latency.rme`, percent) of a
 * benchmark. A noisy benchmark fails calibration (`--calibrate`) and only
 * warns in the gate, so it is fixed in the benchmark, not on a pull request.
 */
export const BENCH_MAX_RME_PERCENT = 5;

/** Benchmark name to `latency.rme` (percent), from `[fileName, parsedJson]` pairs; files without one are left out. */
export function rmesOf(files) {
  const rmes = new Map();
  for (const [fileName, result] of files) {
    const rme = result?.latency?.rme;
    if (typeof rme === "number") rmes.set(fileName.replace(/\.json$/, ""), rme);
  }
  return rmes;
}

/** Per benchmark, the highest rme across the given runs. */
export function worstRmes(rmeRuns) {
  const worst = new Map();
  for (const run of rmeRuns)
    for (const [name, rme] of run) if (!worst.has(name) || rme > worst.get(name)) worst.set(name, rme);
  return worst;
}

/** Names of the benchmarks whose rme is above the limit. */
export function noisyBenchmarks(rmes, limit = BENCH_MAX_RME_PERCENT) {
  return [...rmes].filter(([, rme]) => rme > limit).map(([name]) => name);
}

/** One run: result file name (without `.json`) to typical latency, from `[fileName, parsedJson]` pairs. */
export function runOf(files) {
  const means = new Map();
  for (const [fileName, result] of files) {
    const mean = typicalOf(result);
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
export function formatTable(result, threshold = BENCH_REGRESSION_THRESHOLD, rmes = new Map()) {
  if (result.message) return result.message;
  const lines = ["benchmark | base ms | head ms | change | rme"];
  for (const row of result.rows) {
    const flag = row.change > threshold ? "  SLOWER" : "";
    lines.push(
      `${row.name} | ${row.base.toFixed(4)} | ${row.head.toFixed(4)} | ${(row.change * 100).toFixed(1)}% | ${rmes.has(row.name) ? `${rmes.get(row.name).toFixed(1)}%` : "n/a"}${flag}`,
    );
  }
  for (const name of noisyBenchmarks(rmes))
    lines.push(`warning: ${name} rme ${rmes.get(name).toFixed(1)}% is above ${BENCH_MAX_RME_PERCENT}%`);
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
  const rmeRuns = [];
  for (const directory of directories) {
    try {
      const files = readdirSync(directory)
        .filter((name) => name.endsWith(".json"))
        .map((name) => [name, JSON.parse(readFileSync(join(directory, name), "utf8"))]);
      runs.push(runOf(files));
      rmeRuns.push(rmesOf(files));
    } catch {
      // A missing directory means that run produced no benchmarks.
    }
  }
  return { runs, rmes: worstRmes(rmeRuns) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { "--base": basePaths, "--head": headPaths } = parseArguments(process.argv.slice(2));
  const baseRuns = readRuns(basePaths);
  const headRuns = readRuns(headPaths);
  const base = bestMeans(baseRuns.runs);
  const head = bestMeans(headRuns.runs);
  const rmes = worstRmes([baseRuns.rmes, headRuns.rmes]);
  const result = compareBenchmarks(base, head);
  console.log(formatTable(result, BENCH_REGRESSION_THRESHOLD, rmes));
  if (process.argv.includes("--calibrate")) {
    // Base-against-base run (.github/workflows/bench-calibrate.yml): report the
    // threshold, but fail when a benchmark is too noisy to gate on.
    const { worstDifference, threshold } = calibration(result);
    console.log(
      `calibration: worst difference ${(worstDifference * 100).toFixed(1)}%, implied threshold ${(threshold * 100).toFixed(1)}%`,
    );
    const noisy = noisyBenchmarks(rmes);
    if (noisy.length > 0) {
      console.log(`calibration failed: rme above ${BENCH_MAX_RME_PERCENT}% in ${noisy.join(", ")}`);
      process.exit(1);
    }
    process.exit(0);
  }
  process.exit(result.regressions.length > 0 ? 1 : 0);
}

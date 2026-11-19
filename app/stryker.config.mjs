// Mutation testing of the pure core (plan V22 A15-A18). Phaser and React code
// are left to the Playwright and component suites.

/** Files Stryker mutates; a leading `!` excludes. Shared with scripts/mutation-diff.mjs. */
export const MUTATE_GLOBS = [
  "src/game/simulation/**/*.ts",
  "src/game/config/data.ts",
  "src/game/config/encounter.ts",
  "src/game/config/stats.ts",
  "src/game/config/sectors.ts",
  "src/game/config/drill.ts",
  "src/game/config/phaseDossier.ts",
  "src/game/session/**/*.ts",
  "src/storage/**/*.ts",
  "src/research/*.ts",
  "!**/*.test.ts",
  "!**/*.property.test.ts",
  "!**/*.soak.test.ts",
  "!**/*.bench.ts",
  "!**/test-support.ts",
  "!src/research/previewDraw.ts",
  // Static user-facing copy: mutating text proves nothing.
  "!src/research/glossary.ts",
  "!src/research/helpText.ts",
  "!src/research/stepGuide.ts",
];

/**
 * The break threshold is the dated baseline score rounded down, minus 5 points
 * (plan V22 A18; the 5 points absorb incremental-mode noise). The baseline and
 * its date are in docs/quality-gates.md, "Mutation baseline". The phase 94
 * ratchet run on 2026-11-17 scored 82.4 percent, so 77 = floor(82.4) - 5.
 */
const BREAK_THRESHOLD = 77;

const THRESHOLDS = { high: 80, low: 60 };

/**
 * The diff run (`scripts/mutation-diff.mjs` sets MUTATION_DIFF) has no break
 * value. The score of a few changed modules is not comparable with a baseline
 * taken over the whole set, so breaking on it would fail a change to a weak
 * module and pass one to a strong module whatever the change did. The run
 * reports its undetected mutants instead, and exits nonzero only when Stryker
 * itself fails.
 */
const WHOLE_SET_BREAK = process.env.MUTATION_DIFF === "1" ? null : BREAK_THRESHOLD;

/**
 * The scheduled CI run is split into these shards, one job each, so that a
 * cold whole-set run of several hours is spread over parallel jobs. Each shard
 * has its own incremental file and its own break, floor(score) - 5 from the
 * 2026-11-17 ratchet scores in docs/quality-gates.md (A18): config 82.1,
 * simulation 94.7, research 75.7, session plus storage 88.6 (225 of 254).
 *
 * Stryker writes the incremental file when a run finishes and also when it is
 * interrupted by SIGINT or SIGTERM (a partial file holding the mutants tested
 * so far). The workflow interrupts a shard before the job limit for that
 * reason, so a shard too slow for one job still makes progress every run.
 *
 * The former single `simulation` shard (2,054 mutants in the 2026-11-17
 * ratchet) could not finish cold in 320 minutes: it tested 1,486 mutants at a
 * partial 91.9 percent. It is split into three shards of 600 to 770 mutants.
 * geometry.ts is calibrated at 654 mutants in 846 lines; the other 1,400 or so
 * mutants spread over the remaining 2,479 lines, 0.565 per line.
 * simulation-core: geometry 654, bombs 63, terrain 35, health 25, random 24
 * = about 800.
 * simulation-main: simulation.ts = about 619.
 * simulation-rules: phases 224, projectiles 192, patterns 148, conditions 106
 * = about 670. Breaks are floor(size-weighted partial score) - 5 (A18) from
 * the 2026-11-18 partial run, with geometry.ts at its post-fix 94.9 percent:
 * core 95.4 gives 90, main 96.5 gives 91, rules 94.4 gives 89. A shard lists
 * `directories` (glob prefixes) or `files` (exact paths of one directory that
 * is split). The incremental cache key includes the shard name, so the three
 * new shards start cold once; the old `simulation` cache entry is never read
 * again and ages out.
 */
export const MUTATION_SHARDS = {
  config: { directories: ["src/game/config/"], break: 77 },
  "simulation-core": {
    files: [
      "src/game/simulation/geometry.ts",
      "src/game/simulation/random.ts",
      "src/game/simulation/health.ts",
      "src/game/simulation/bombs.ts",
      "src/game/simulation/terrain.ts",
    ],
    break: 90,
  },
  "simulation-main": { files: ["src/game/simulation/simulation.ts"], break: 91 },
  "simulation-rules": {
    files: [
      "src/game/simulation/phases.ts",
      "src/game/simulation/projectiles.ts",
      "src/game/simulation/conditions.ts",
      "src/game/simulation/patterns.ts",
      // Plan V23 step 97.2: the marked-volley schedule, a rules module.
      "src/game/simulation/marks.ts",
    ],
    break: 89,
  },
  research: { directories: ["src/research/"], break: 70 },
  state: { directories: ["src/game/session/", "src/storage/"], break: 83 },
};

/** The options one shard overrides; none for an unset shard (the whole set). */
export function shardOptions(name) {
  if (name === undefined || name === "") return {};
  const shard = MUTATION_SHARDS[name];
  if (!shard) throw new Error(`Unknown MUTATION_SHARD "${name}"`);
  const mutate = MUTATE_GLOBS.filter((glob) =>
    glob.startsWith("!") ||
    (shard.directories ?? []).some((directory) => glob.startsWith(directory)),
  );
  // A split directory's glob is replaced by the shard's own files, placed
  // before the exclusions.
  const firstNegated = mutate.findIndex((glob) => glob.startsWith("!"));
  mutate.splice(firstNegated === -1 ? mutate.length : firstNegated, 0, ...(shard.files ?? []));
  return {
    mutate,
    incrementalFile: `reports/mutation/stryker-incremental-${name}.json`,
    htmlReporter: { fileName: `reports/mutation/${name}/mutation.html` },
    jsonReporter: { fileName: `reports/mutation/${name}/mutation.json` },
    thresholds: { ...THRESHOLDS, break: shard.break },
  };
}

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  // `related` finds no tests under Vitest 5; coverage analysis still maps mutants to tests.
  vitest: { configFile: "vitest.mutation.config.ts", related: false },
  // In place, not in a sandbox copy of app/: several tests read ../docs, which a
  // copy omits. Stryker restores the files when it exits. After a killed run,
  // `git status` shows any file left instrumented; `git checkout -- <file>`
  // restores it. (This also avoids Stryker's tsconfig rewriter, which calls a
  // compiler API that TypeScript 7 no longer ships.)
  inPlace: true,
  // Only files that are mutated get instrumented; the default would also stamp
  // `// @ts-nocheck` on every test file in place.
  disableTypeChecks: false,
  // Same filesystem as the sources, so the backup restores with a rename.
  tempDirName: ".stryker-tmp",
  ignorePatterns: ["dist", "reports", "test-results", "playwright-report", ".stryker-tmp"],
  coverageAnalysis: "perTest",
  // Mutants in module-level code run when any test imports the module, so every
  // test covers them and each would cost a whole suite run; they are skipped
  // and counted separately in the report.
  ignoreStatic: true,
  incremental: true,
  incrementalFile: "reports/mutation/stryker-incremental.json",
  mutate: MUTATE_GLOBS,
  // Half of all mutants rewrite a string literal (messages, ids, copy). Tests
  // that pinned them would pin wording, not behaviour.
  mutator: { excludedMutations: ["StringLiteral"] },
  reporters: ["html", "json", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { ...THRESHOLDS, break: WHOLE_SET_BREAK },
  // The node project's slowest test takes about 20 seconds and allows 60;
  // a mutant that loops forever is killed after this many milliseconds plus
  // the factor times the unmutated run time.
  // The unmutated run executes every node test once with coverage, about ten
  // minutes on a shared runner; the default of five is too short.
  dryRunTimeoutMinutes: 30,
  timeoutMS: 10000,
  timeoutFactor: 1.5,
  cleanTempDir: true,
  // `MUTATION_SHARD=<name>` (see MUTATION_SHARDS) narrows the run to one shard.
  ...shardOptions(process.env.MUTATION_SHARD),
};

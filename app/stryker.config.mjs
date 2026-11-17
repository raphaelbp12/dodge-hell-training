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
 * The weekly CI run is split into these shards, one job each, because a cold
 * whole-set run takes hours and Stryker saves its incremental file only when a
 * run finishes: a single job cut off by its timeout would never save one and
 * would start cold every week. Each shard has its own incremental file and its
 * own break, floor(score) - 5 from the 2026-11-17 ratchet scores in
 * docs/quality-gates.md (A18): config 82.1, simulation 94.7, research 75.7,
 * session plus storage 88.6 (225 of 254).
 */
export const MUTATION_SHARDS = {
  config: { directories: ["src/game/config/"], break: 77 },
  simulation: { directories: ["src/game/simulation/"], break: 89 },
  research: { directories: ["src/research/"], break: 70 },
  state: { directories: ["src/game/session/", "src/storage/"], break: 83 },
};

/** The options one shard overrides; none for an unset shard (the whole set). */
export function shardOptions(name) {
  if (name === undefined || name === "") return {};
  const shard = MUTATION_SHARDS[name];
  if (!shard) throw new Error(`Unknown MUTATION_SHARD "${name}"`);
  const mutate = MUTATE_GLOBS.filter((glob) =>
    glob.startsWith("!") || shard.directories.some((directory) => glob.startsWith(directory)),
  );
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
  thresholds: { ...THRESHOLDS, break: BREAK_THRESHOLD },
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

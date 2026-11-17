# Phase 93: Mutation Testing

> Step prompts and execution records for phase 93 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 93.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-93.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 93.1 - Stryker Configuration

Status: complete. Dependencies: phases 91, 92.

**Implementation prompt**

Apply A15. From `app/`, run `npm install --save-dev --save-exact @stryker-mutator/core @stryker-mutator/vitest-runner`. Create `app/stryker.config.mjs` with:

- `testRunner: "vitest"`;
- `coverageAnalysis: "perTest"`;
- `incremental: true`, with `incrementalFile: "reports/mutation/stryker-incremental.json"`;
- the A15 `mutate` globs, with negations for `**/*.test.ts`, `**/*.property.test.ts`, `**/*.soak.test.ts`, `**/*.bench.ts`, `**/test-support.ts` and `src/research/previewDraw.ts`;
- reporters `html`, `json`, `clear-text` and `progress`, with the HTML report in `reports/mutation/`;
- `thresholds: { high: 80, low: 60, break: null }`;
- a `timeoutMS` that covers the longest node test. The node project allows 60 seconds; set `timeoutFactor` and record the choice.

Stryker must run only the `node` Vitest project. If the vitest runner cannot select a project from the workspace configuration, add `app/vitest.mutation.config.ts`, which extends `vite.config.ts` with the node project's settings only, and point `vitest.configFile` at it. Add `reports/` to `app/.gitignore`. Add the scripts `test:mutation` (`stryker run`) and `test:mutation:diff` (`node scripts/mutation-diff.mjs`).

`app/scripts/mutation-diff.mjs` lists the files changed against `origin/main` (`git diff --name-only --diff-filter=AM origin/main...HEAD` plus uncommitted changes) that match the mutate globs. It runs `stryker run --mutate <files>` and exits with Stryker's code. When nothing matches, it prints "no mutated modules changed" and exits 0.

**Focused checks**

Write `app/scripts/mutation-diff.test.mjs` first, next to `verify.test.mjs` and in its style. It tests the file-selection function alone: globs, negations, deleted files dropped and the empty case. Make sure the node Vitest project's `include` covers it; if it does not, add `scripts/**/*.test.mjs` to the include.

Then run `npm run test:mutation -- --mutate src/game/simulation/random.ts` as a smoke test, and record its score and runtime.

**Acceptance**

The smoke run completes and produces an HTML report. The diff script's tests pass.

### Step 93.2 - Baseline

Status: complete. Dependencies: 93.1.

**Implementation prompt**

Apply A16. Run `npm run test:mutation` over the whole set in the background, with a time limit of 90 minutes. If it is cut off, split it by directory with `--mutate` and run each directory in turn. Record per directory:

- the score;
- killed, survived, no-coverage and timeout counts;
- the runtime.

Record them in this step's execution record and in a new `docs/quality-gates.md` under "Mutation baseline", dated. Keep the five files with the most survivors as the starting list for step 94.2.

**Focused checks**

The JSON report exists, and the recorded numbers match it.

**Acceptance**

A dated baseline is recorded, and no source file changed.

### Step 93.3 - CI Workflow

Status: complete. Dependencies: 93.2.

**Implementation prompt**

Apply A17. Create `.github/workflows/mutation.yml`. It has the `app` working directory, the `.node-version` Node setup, the pinned npm and `npm ci` exactly as `pages.yml` does, and `permissions: contents: read`. It has two jobs:

- **`full`**: on `schedule` (`cron: "0 6 * * 1"`) and `workflow_dispatch`. It restores and saves `app/reports/mutation/stryker-incremental.json` with `actions/cache`, keyed on the workflow and branch. It runs `npm run test:mutation`, uploads `app/reports/mutation/` as an artifact for 14 days, and has a 90-minute timeout.
- **`diff`**: on `pull_request`. It checks out with `fetch-depth: 0` so `origin/main` exists, runs `npm run test:mutation:diff`, sets `continue-on-error: true`, uploads the report for 7 days and has a 30-minute timeout.

It never deploys and never writes to the repository. Update `.claude/skills/verify/SKILL.md` where it mirrors CI.

**Focused checks**

Validate the workflow's syntax with `npx --yes @action-validator/cli .github/workflows/mutation.yml`, or a YAML parse if that tool is unavailable. Record which one ran. Do not trigger the workflow.

**Acceptance**

The workflow is valid, and the verify skill mentions it.

### Step 93.4 - Threshold

Status: complete. Dependencies: 93.2.

**Implementation prompt**

Apply A18. Set `thresholds.break` in `stryker.config.mjs` to the baseline score rounded down, minus 5. Add a comment citing the dated baseline in `docs/quality-gates.md` and A18.

**Focused checks**

None. The weekly run enforces the threshold.

**Acceptance**

The configured break value matches the formula and the recorded baseline.

### Step 93.5 - Phase Gate

Status: complete. Dependencies: 93.1-93.4.

**Implementation prompt**

Delegate one `npm run verify` run to the `verifier` subagent, and record its lines. Update the Phase Index and archive this file.

**Focused checks**

None beyond the gate run.

**Acceptance**

All four gates pass, and `reports/` is ignored by git.

## Execution Record

Implemented 2026-11-16 in auto mode and completed 2026-11-17. 93.2's baseline finished on 2026-11-17, and the 93.4 threshold has since been ratcheted to 77 by step 94.5. 93.3's syntax check ran on 2026-11-17 once the user fetched the validator: `npx --yes @action-validator/cli .github/workflows/mutation.yml` printed `ok` (exit 0), and `pages.yml` also validated. 93.5's gate is the `npm run verify` recorded in phase 94's 94.5 (all four gates PASS, 113 files, 1,851 tests plus the 2 A10 `test.fails`), which ran after every phase 93 change.

- **93.1** Stryker 10.1.1 with the Vitest runner, exact-pinned. `stryker.config.mjs` (mutate globs shared with `scripts/mutation-diff.mjs`), `vitest.mutation.config.ts`, the `test:mutation` and `test:mutation:diff` scripts, `reports/` and `.stryker-tmp/` ignored, `scripts/mutation-diff.test.mjs` (five tests, added to the node project's include; `verify.test.mjs` uses `node:test` and is not run by Vitest). Deviations, each with its reason in the config: `inPlace: true` (several tests read `../docs`, which a sandbox copy lacks, and Stryker's tsconfig rewriter calls a compiler API TypeScript 7 does not ship); `vitest.related: false` (finds no tests under Vitest 5); `ignoreStatic: true`; string-literal mutants excluded; `glossary.ts`, `helpText.ts` and `stepGuide.ts` (static copy) excluded; `dryRunTimeoutMinutes: 30`; `timeoutMS: 10000`; long integration tests, and the data, contract and study property suites, excluded from the mutation run by `vitest.mutation.config.ts`; `FC_SEED` fixed and `FC_NUM_RUNS` 10. First in-place run crashed on a cross-device rename and left instrumented files; the originals were restored from Stryker's backup and the backup directory moved into `app/` (`.stryker-tmp`). Smoke run on `random.ts`: 83.33 percent (10 killed, 2 survived), 54 s.
- **93.2** The full run does not fit the 90-minute limit. Partial baseline recorded in `docs/quality-gates.md` (60.2 percent over 1,535 decided mutants; `game/session` 92.3, `game/simulation` 87.4, `game/config` 64.2; `src/research` and `src/storage` not reached). Most-surviving files so far: `encounter.ts` (64 survivors), `data.ts`, `phaseDossier.ts`, `drill.ts`.
- **93.3** `.github/workflows/mutation.yml` (weekly full run with a cached incremental file, informational pull-request diff run). Validation: no YAML parser or network validator was available offline (the `action-validator` download was refused), so the syntax was reviewed by hand only; the workflow was not triggered.
- **93.3 deviation (2026-11-17, user-approved)** The step's single 90-minute `full` job could never finish a cold run (about 3 hours locally on 15 workers, several times that on a hosted runner), and Stryker saves the incremental file only when a run finishes, so it would start cold every week. `full` is now a four-shard matrix (`config`, `simulation`, `research`, `state`), selected by `MUTATION_SHARD` through `shardOptions` in `stryker.config.mjs`, with a 360-minute limit per job, a per-shard incremental file restored and saved separately (`actions/cache/restore` and `actions/cache/save` with `if: always()`, so a broken threshold still keeps the file) and per-shard break values from the phase 94 ratchet scores. Five tests in `scripts/mutation-shards.test.mjs`, written first; `action-validator` printed `ok`.
- **93.2 update (2026-11-17)** The user ran the rest of the baseline in their own terminal: 80.7 percent over 8,279 decided mutants (`game/config` 77.3, `game/session` 92.3, `game/simulation` 92.5, `src/research` 75.7, `src/storage` 86.5). Recorded in `docs/quality-gates.md`.
- **93.4** `thresholds.break` is 75 (floor(80.7) minus 5), derived from the full baseline.
- **93.5** Gate: see phase 95's record (one `npm run verify` after phases 93 to 95).

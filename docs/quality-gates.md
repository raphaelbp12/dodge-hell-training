# Quality Gates

One reference for every gate that raises trust in a change before it is committed or deployed (plan V22, [plan-v22.md](plan-v22.md)). All commands run from `app/`. `npm run verify` stays the single local gate: it runs `lint`, `typecheck`, `test` and `build`. Everything below that is not part of `verify` is slower or needs the network, so it runs in CI or on demand.

| Gate | Command | Where it runs |
| --- | --- | --- |
| Lint boundaries, determinism, categories | `npm run lint` | `verify`, CI `Lint` |
| Compiler strictness | `npm run typecheck` | `verify`, CI `Typecheck` |
| Dependency audit | `npm run audit` | CI `Audit` (needs the network) |
| Property tests | `npm test` | `verify`, CI `Unit Tests` |
| Contracts, fingerprint, fixtures | `npm test` | `verify`, CI `Unit Tests` |
| Test presence, component tests | `npm test` | `verify`, CI `Unit Tests` |
| Mutation tests | `npm run test:mutation`, `npm run test:mutation:diff` | `mutation.yml`: full run twice a week; `mutation-diff.yml`: required pull-request run |
| Benchmarks | `npm run bench` | CI `bench` job on pull requests |
| Branch coverage floors | `npm test`, `npm run test:coverage` | `verify`, CI `Unit Tests` |
| Simulated soak | `npm run test:soak:sim` | CI `Simulated Soak` check |
| Browser soak | `PLAYWRIGHT_SOAK=1 npm run test:e2e -- --grep @soak` | CI Playwright `soak` job |

## Lint boundaries (A01)

**Catches:** the simulation core (`src/game/models.ts`, `config/`, `simulation/`, `session/`) importing React, Phaser, CSS, UI, research, Phaser-layer or storage modules or reading `window`, `document`, `localStorage`, `sessionStorage`, `navigator` or `requestAnimationFrame`; `src/game/phaser/` importing `src/research/` (T13); `src/storage/` importing React or Phaser. Test files are exempt.
**Run:** `npm run lint`; the rules are tested by `npx vitest run lint/boundaries.test.ts`.
**Reproduce:** the lint message names the rule and points at the project instructions' Architecture section. Move the import or the global read out of the core.

## Determinism (A02)

**Catches:** `Math.random()`, `Date.now()`, `new Date()` with no arguments, `performance.now()`, `crypto.getRandomValues()` and `crypto.randomUUID()` in the core. The only allowed use is `arbitrarySeed` in `random.ts`, with an inline disable that gives its reason and decision ID (G13).
**Run:** `npm run lint`; `npx vitest run lint/determinism.test.ts`.

## Strictness and lint categories (A03, A04)

**Catches:** implicit `any` and the other `strict` checks, a missing `override` keyword, and every oxlint `correctness` and `suspicious` finding. `npm run lint` is `oxlint --deny-warnings`, so a warning fails it. Each rule turned off in `.oxlintrc.json` carries its reason in the file.
**Run:** `npm run typecheck`, `npm run lint`.

## Dependency audit (A05)

**Catches:** a high-severity advisory in a production dependency.
**Run:** `npm run audit` (`npm audit --omit=dev --audit-level=high`). It is not part of `verify` because it needs the network. In CI it is its own `Audit` job, outside the deployment's needs: a finding fails the job on the pull request and on `main`, but does not hold back a deployment, because a new upstream advisory says nothing about the change under test and the live site keeps the same dependency either way. It reads only `package-lock.json`, so the job installs nothing.

## Slow-test budget

**Catches:** a node-project test that used more than half of its own effective timeout (the project's `testTimeout`, 60 s, or the test's explicit `{ timeout }`), so a test close to timing out under CPU load is caught while it still passes.
**Behaviour (2026-11-19):** locally the reporter prints the tests and sets exit code 1. On the GitHub-hosted runner (`GITHUB_ACTIONS=true`) it prints the same message plus one `::warning title=Slow test::` annotation per test and leaves the exit code alone, because a shared runner's slowness turned `main` red (run 44376706799). A real timeout still fails everywhere.
**Run:** `npm test`. The reporter `scripts/slow-test-reporter.mjs` decides in `decideSlowTestReport`; it is tested in `scripts/slow-test-reporter.test.mjs`.
**Reproduce:** any test over 5 s carries an explicit timeout of about 4x its measured time, rounded up to 10 s, with a comment giving the measured time and date. Speed the test up, or re-measure and raise the timeout with a new comment. Do not raise the project-wide timeout.

## Property tests (A06-A10)

**Catches:** a violated invariant of the random source, collision geometry, every projectile motion kind and the bomb type, a whole simulation (determinism, step chunking, arena containment, health bounds, unique accepted projectile ids), every loader of untrusted input, the study JSON round trip, cadence recovery and timeline zoom.
**Run:** `npx vitest run <module>.property.test.ts`; they also run inside `npm test`. `FC_NUM_RUNS` overrides the run count; whole-simulation properties use `SIMULATION_PROPERTY_RUNS` (25).
**Reproduce:** fast-check prints a `seed` and a `path` for any failure. Run `FC_SEED=<seed> npx vitest run <file>`, and pass `{ path: "<path>" }` to the failing property's `propertyParameters` call to jump to the shrunk counterexample. CI draws a fresh seed on every run; the mutation run fixes `FC_SEED` so mutants compare.
**Policy (A10):** a failing property is a finding. Record the counterexample, seed and path, keep the property as `test.fails` with a comment that cites the record, and stop for a user decision. Never weaken it, and never change simulation behaviour without approval.

## Contracts and the rules fingerprint (A11-A13)

**Catches:** a JSON file under `src/game/data/` that no validator claims or that fails its validator; a dangling cross-file reference (attack projectile, appearance, spawned archetype, `arenaId`, shape); gameplay data changed without a `rulesVersion` bump; a bump without a refreshed fingerprint; a tagger export that is not valid game data.
**Run:** `npx vitest run src/game/config/data-contract.test.ts src/game/config/rules-fingerprint.test.ts src/research/export-contract.test.ts`.
**Reproduce:** the fingerprint test prints the new entry for `app/src/game/config/rules-fingerprint.json`; copy it in the same change as the data edit and the `rulesVersion` bump. The test never writes the file. Appearance, `comment`, `source`, `telegraphColor` and `displayName` fields are excluded from the hash.

## Frozen persistence fixtures (A14)

**Catches:** a change that stops an older saved attempt history, study or tagger autosave from loading. Fixtures live in `src/storage/__fixtures__/` and `src/research/__fixtures__/`, plus `docs/killer-bee-queen-study-TFclwuPtC94.json`.
**Run:** `npx vitest run src/storage/persistence-contract.test.ts src/research/persistence-contract.test.ts`.
**Rule:** never edit a fixture. A schema change adds a new fixture.

## Mutation tests (A15-A18)

**Catches:** a test that runs code without asserting on it. Stryker mutates `src/game/simulation/**`, the configuration modules `data`, `encounter`, `stats`, `sectors`, `drill` and `phaseDossier`, `src/game/session/**`, `src/storage/**` and `src/research/*.ts` (not `previewDraw.ts`), and runs the Vitest node project with `FC_SEED` fixed.
**Run:** `npm run test:mutation` (full), `npm run test:mutation:diff` (modules changed against the base branch, plus the module beside each changed unit or property test, so a weakened test shows as new survivors). The base branch is the pull request's own base (`GITHUB_BASE_REF`), so a pull request stacked on another counts only its own changes; outside a pull request it is `origin/main`. When more than `DIFF_MODULE_LIMIT` (4) modules are selected, the diff run prints them and skips; the scheduled sharded run covers them. To cover them locally, name them in consecutive batches of at most four until every changed module has run: `npm run test:mutation:diff -- src/game/simulation/marks.ts src/research/parity.ts` (the limit applies to each batch). Do not pick a subset. Avoid `npx stryker run --mutate` for this: its reports merge the incremental cache, so they list every module as if all had run.

**Pull-request run** (`.github/workflows/mutation-diff.yml`): it runs on every pull request, but its first step skips the mutation work, and the job passes, unless a file under `app/` or the workflow itself changed. A new push cancels the run of the commit it replaces. The diff run has no break value (`MUTATION_DIFF` in `app/stryker.config.mjs`), because the score of a few changed modules is not comparable with a whole-set baseline. Instead `scripts/mutation-summary.mjs` writes the score of each mutated module to the job summary, lists the undetected mutants on the lines the pull request changed, and marks up to ten survivors on those lines as annotations in the diff. A skipped run says so in the summary. The job fails when Stryker itself cannot run, and when a mutant with status `NoCoverage` sits on a line the pull request changed: `mutation-summary.mjs` prints one `::error ... title=Changed line not covered` per such line (up to ten) and exits 1, under a "Blocks the merge" heading in the summary. Survivors stay warnings, because some are equivalent. The scheduled run, without `--changed`, never fails on this.

Approved deviation from plan V22 A17 (user decision, 2026-11-19): a changed line that no test runs blocks the pull request. A pull request with a failing `Mutation Of Changed Files` check is not merged. Since 2026-11-19 (user decision, replacing T5's "not a required status") the check is required by the `Protect main` ruleset on `main`, which is why the workflow has no paths filter: a required check that never reports would block a pull request that changes no app file. Known limits:

- The mutation run excludes the Queen full-fight tests and the data, contract and study property suites, so a line covered only by those counts as not covered. The remedy is a focused unit test.
- The override is Stryker's own comment, `// Stryker disable next-line all: <reason>`, which turns the mutant into an ignored one. It must give a reason. The repository has none today.
- A pull request that changes more than `DIFF_MODULE_LIMIT` (4) mutated modules is skipped by the diff run and is not gated.
- An existing uncovered line that a pull request edits now blocks that pull request. This is intended.

Stryker is interrupted after `DIFF_BUDGET_MINUTES` (24), inside the 30-minute job, and the summary then shows the mutants tested so far, marked as partial.

**Scheduled run** (`.github/workflows/mutation.yml`): Monday and Thursday, and on demand. GitHub evicts a cache entry that no run has read for seven days, so a weekly schedule would restore each incremental file within minutes of that limit. The run is split into six shards, one job each (`MUTATION_SHARDS` in `app/stryker.config.mjs`): `config`, `simulation-core`, `simulation-main`, `simulation-rules`, `research` and `state` (session plus storage). A shard lists directories or, for the split simulation directory, exact files. Each shard caches its own incremental file and has its own break value. Stryker writes the incremental file when a run finishes and also when it is interrupted by SIGINT or SIGTERM, as a partial file of the mutants tested so far. Each job therefore interrupts Stryker after `MUTATION_BUDGET_MINUTES` (320 of GitHub's 360-minute job limit), saves the file and ends the step with a warning and exit status 0, because an interrupted run is expected on a cold cache and is not a failure; the next run continues from it. Any other nonzero status, such as a broken threshold, still fails the job. No shard has yet been timed on a hosted runner, so the first runs after the workflow reaches `main` may be partial ones. Each job writes its shard's score, break value and per-file table to the job summary. The `force` input of a manual run re-tests every mutant: an incremental run re-tests a mutant only when its module or a test that covers it changed, so it does not notice a change to game data JSON, to a test helper or to a dependency. Run one shard locally with `MUTATION_SHARD=<name> npm run test:mutation`; its report goes to `reports/mutation/<name>/`.
**Reproduce:** open `app/reports/mutation/mutation.html`, or read `mutation.json`. The run rewrites sources in place and restores them on exit, so edit nothing while it runs. After a killed run, `git status` lists any file left instrumented; `git checkout -- <file>` restores it. `--mutate <file>` narrows a run. A killed run can also leave `app/stryker-setup-*.js` files (git-ignored; safe to delete). Agents delegate the diff run to the `verifier` subagent and never start the full run.
**Threshold:** `thresholds.break` is the baseline score rounded down, minus 5 points (A18). See "Mutation baseline" below.

## Test presence (A19)

**Catches:** a runtime module under `src/` with no sibling `.test.ts`, `.test.tsx` or `.property.test.ts` and no entry in `app/lint/test-presence-allowlist.json`; an allowlisted module that now has a test; an allowlisted path that no longer exists.
**Run:** `npx vitest run lint/test-presence.test.ts`.

## Component tests (A21, A22)

**Catches:** UI and tagger regressions in jsdom: roles, labels, visible text, accessible state and callbacks. Conventions: query by role or label, drive input with `userEvent.setup()`, no markup snapshots, import constants instead of copying values.
**Run:** `npx vitest run <Component>.test.tsx`.

## Benchmarks (A23, A24)

**Catches:** a slowdown of the simulation, `advanceShard` or swept collision. `src/game/simulation/simulation.bench.ts` measures 10 simulated seconds of the Queen's densest drilled phase, 10 of a minion-only encounter, 1000 `advanceShard` steps over a large shard list (`advance-shard-x1000`) and 1000 `sweptConvexPartsOverlap` calls on the largest compound hitbox (`swept-overlap-x1000`), batched so each iteration takes about 0.5 to 2 ms.
**Run:** `npm run bench`. On pull requests the CI `bench` job runs base and head alternately on one runner, `BENCH_ROUNDS` (5) times each, and fails through `scripts/bench-gate.mjs` when a benchmark is slower than `BENCH_REGRESSION_THRESHOLD`. Each side keeps its best run, compared by the median latency (`latency.p50`, the mean only when a file has none), because the mean of a sub-microsecond benchmark such as `advance-shard` is dominated by a few GC or scheduler outliers (a 36 percent false failure on 2026-11-18). Each result's `latency.rme` is printed in the table; one above `BENCH_MAX_RME_PERCENT` (5) prints a warning in the gate but never fails it, and fails `--calibrate`, so a noisy benchmark is fixed in the benchmark, not on a pull request. The calibration below used the mean and unbatched benchmarks, and must be re-run three times with `bench-calibrate.yml` after the batching (the renamed benchmarks are skipped by the gate on the first pull request, as missing on base). Locally on 2026-11-17 the worst base-against-base difference was 4.5 percent over two runs a side and 1.7 percent over five. The job compares nothing when the pull request leaves `app/src/game`, the toolchain files and the gate unchanged, because such a change cannot alter a timing and a comparison could only fail from runner noise. The comparison table is written to the job summary.
**Reproduce:** the gate prints a table of name, base, head and percent change. Run `npm run bench` on `main` and on the branch, alternating, copying `reports/bench/` aside after each run, then `node scripts/bench-gate.mjs --base <dirs> --head <dirs>`. Compare only timings taken on one machine; the browser soak's recorded local baseline is not comparable with CI.
**Threshold:** `BENCH_REGRESSION_THRESHOLD` in `scripts/bench-gate.mjs` is the larger of 20 percent and three times the worst base-against-base difference over three CI runs (A24). Measure it by running the manual `.github/workflows/bench-calibrate.yml` three times; `--calibrate` prints each run's worst difference and implied threshold and exits nonzero when any benchmark's rme exceeds 5 percent. Three CI runs on 2026-11-17, at five rounds a side, measured a worst difference of 0.5, 1.5 and 3.7 percent; three times 3.7 is 11.1 percent, so the 20 percent floor applies and the `bench` job is blocking. Remeasure after a change to the benchmarks or to `BENCH_ROUNDS`.

## Branch coverage (report 2026-11-18, items 2.2, 2.7, 2.11)

**Catches:** an untested throw or refusal branch in a module Stryker mutates, found on the push instead of by the twice-weekly mutation run. Coverage is measured over `MUTATE_GLOBS` (imported from `app/stryker.config.mjs`, so the two lists cannot drift).
**Run:** `npm test` runs the node and dom projects with v8 coverage and fails when a directory is below its floor; `npm run test:coverage` runs the node project alone. It prints a text summary and writes `app/reports/coverage/coverage-summary.json`. It runs in `verify` and the CI `Unit Tests` check through `npm test`.
**Thresholds:** branches and statements per directory in `coverage.thresholds` of `app/vitest.config.ts`, each floor(measured) minus 2, measured 2026-11-18 (branches/statements, percent): `src/game/config` 97.3/98.3, `src/game/session` 100.0/98.5, `src/game/simulation` 97.4/99.0, `src/storage` 97.7/98.4, `src/research` 85.1/92.7. Raise a floor when coverage rises; never lower one to pass.
**Reproduce:** the failure names the directory and the metric. Run the node project with `--coverage.reporter=text` to see uncovered lines, then add a test for the untested branch.
**Cost:** coverage roughly doubles the node project's time (about 47 s to 100 s locally).

## Simulated soak (A25)

**Catches:** a leak or unbounded growth in the session: live shards, bombs, enemies, condition entries, serialized state size and history length, over 10 simulated minutes of every Queen phase drilled and looped, plus 25 retries.
**Run:** `npm run test:soak:sim`. It is its own Vitest project and is excluded from `npm test`.
**Reproduce:** the test prints the peak of each measure.

## Browser soak (A26)

The three 60-second Playwright `@soak` tests, their tag policy and their CI artifacts are unchanged. Run with `PLAYWRIGHT_SOAK=1`, or `CI=true`.

**Flaky tests (report item 2.9):** in CI Playwright keeps `retries: 2` so a failing test leaves its retry trace, but `failOnFlakyTests` is on, so a test that passes only on retry fails the job. Locally there are no retries. To reproduce, run `npm run test:e2e -- --grep "<pattern>" --repeat-each=10`.

## Mutation baseline

Dated 2026-11-17, **full run** (finished across two sessions through the incremental file; a single run needs about 3 hours, more than the plan's 90-minute limit, so the scheduled CI run relies on the cached incremental file). Mutants: 5,932 killed, 746 timed out, 1,131 survived, 470 not covered, 1,932 ignored (excluded or static). Score = (killed + timeout) / (killed + timeout + survived + not covered).

| Area | Killed + timeout | Survived | Not covered | Score |
| --- | --- | --- | --- | --- |
| `src/game/config` (data, encounter, drill, phaseDossier, sectors, stats) | 1,562 | 279 | 179 | 77.3 |
| `src/game/session` | 84 | 6 | 1 | 92.3 |
| `src/game/simulation` | 1,900 | 131 | 23 | 92.5 |
| `src/research` | 2,991 | 694 | 266 | 75.7 |
| `src/storage` | 141 | 21 | 1 | 86.5 |
| Whole set | 6,678 | 1,131 | 470 | 80.7 |

Tests excluded from mutation runs for cost: the Queen full-fight and five-minute runs, the data, contract and study property suites.

**Ratchet, 2026-11-17 (phase 94).** After the survivor-driven tests for `projectiles.ts` and `data.ts`, the full run scored 82.4: 6,067 killed, 752 timed out, 1,017 survived, 443 not covered.

| Area | Killed + timeout | Survived | Not covered | Score |
| --- | --- | --- | --- | --- |
| `src/game/config` | 1,658 | 210 | 152 | 82.1 |
| `src/game/session` | 84 | 6 | 1 | 92.3 |
| `src/game/simulation` | 1,945 | 86 | 23 | 94.7 |
| `src/research` | 2,991 | 694 | 266 | 75.7 |
| `src/storage` | 141 | 21 | 1 | 86.5 |
| Whole set | 6,819 | 1,017 | 443 | 82.4 |

`thresholds.break` is 77 (floor(82.4) - 5). The largest remaining gap is `src/research` (694 survivors).

Per-shard break values, each floor(score) - 5 from this table: `config` 77 (82.1), `research` 70 (75.7), `state` 83 (session plus storage, 225 of 254 = 88.6). The `simulation` shard could not finish cold in one 320-minute job (2026-11-18: 1,486 mutants tested, partial score 91.9, report item 2.3), so it is split by file into `simulation-core` (geometry, bombs, terrain, health, random; about 800 mutants, break 90 from a size-weighted 95.4 with geometry at its post-fix 94.9), `simulation-main` (`simulation.ts`; about 619 mutants, break 91 from 96.5) and `simulation-rules` (phases, projectiles, conditions, patterns; about 670 mutants, break 89 from 94.4). The mutant counts are estimates from source size, calibrated on a geometry-only run (654 mutants, about 57 minutes locally). The cache key includes the shard name, so the three new shards start cold once. The whole-set value of 77 still applies to an unsharded local run; one shared value would fail `research`.

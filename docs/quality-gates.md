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
| Mutation tests | `npm run test:mutation`, `npm run test:mutation:diff` | `mutation.yml`: full run twice a week; `mutation-diff.yml`: informational pull-request run |
| Benchmarks | `npm run bench` | CI `bench` job on pull requests |
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
**Run:** `npm run test:mutation` (full), `npm run test:mutation:diff` (modules changed against the base branch, plus the module beside each changed unit or property test, so a weakened test shows as new survivors). The base branch is the pull request's own base (`GITHUB_BASE_REF`), so a pull request stacked on another counts only its own changes; outside a pull request it is `origin/main`. When more than `DIFF_MODULE_LIMIT` (4) modules are selected, the diff run prints them and skips; the scheduled sharded run covers them, and `--mutate <file>` narrows a local check.

**Pull-request run** (`.github/workflows/mutation-diff.yml`): it starts only when a file under `app/` changes, and a new push cancels the run of the commit it replaces. The diff run has no break value (`MUTATION_DIFF` in `app/stryker.config.mjs`), because the score of a few changed modules is not comparable with a whole-set baseline. Instead `scripts/mutation-summary.mjs` writes the score of each mutated module to the job summary, lists the undetected mutants on the lines the pull request changed, and marks up to ten survivors on those lines as annotations in the diff. A skipped run says so in the summary. The job fails only when Stryker itself cannot run. Stryker is interrupted after `DIFF_BUDGET_MINUTES` (24), inside the 30-minute job, and the summary then shows the mutants tested so far, marked as partial.

**Scheduled run** (`.github/workflows/mutation.yml`): Monday and Thursday, and on demand. GitHub evicts a cache entry that no run has read for seven days, so a weekly schedule would restore each incremental file within minutes of that limit. The run is split into four shards, one job each (`MUTATION_SHARDS` in `app/stryker.config.mjs`): `config`, `simulation`, `research` and `state` (session plus storage). Each shard caches its own incremental file and has its own break value. Stryker writes the incremental file when a run finishes and also when it is interrupted by SIGINT or SIGTERM, as a partial file of the mutants tested so far. Each job therefore interrupts Stryker after `MUTATION_BUDGET_MINUTES` (320 of GitHub's 360-minute job limit), saves the file and fails with a message; the next run continues from it. No shard has yet been timed on a hosted runner, so the first runs after the workflow reaches `main` may be partial ones. Each job writes its shard's score, break value and per-file table to the job summary. The `force` input of a manual run re-tests every mutant: an incremental run re-tests a mutant only when its module or a test that covers it changed, so it does not notice a change to game data JSON, to a test helper or to a dependency. Run one shard locally with `MUTATION_SHARD=<name> npm run test:mutation`; its report goes to `reports/mutation/<name>/`.
**Reproduce:** open `app/reports/mutation/mutation.html`, or read `mutation.json`. The run rewrites sources in place and restores them on exit, so edit nothing while it runs. After a killed run, `git status` lists any file left instrumented; `git checkout -- <file>` restores it. `--mutate <file>` narrows a run. A killed run can also leave `app/stryker-setup-*.js` files (git-ignored; safe to delete). Agents delegate the diff run to the `verifier` subagent and never start the full run.
**Threshold:** `thresholds.break` is the baseline score rounded down, minus 5 points (A18). See "Mutation baseline" below.

## Test presence (A19)

**Catches:** a runtime module under `src/` with no sibling `.test.ts`, `.test.tsx` or `.property.test.ts` and no entry in `app/lint/test-presence-allowlist.json`; an allowlisted module that now has a test; an allowlisted path that no longer exists.
**Run:** `npx vitest run lint/test-presence.test.ts`.

## Component tests (A21, A22)

**Catches:** UI and tagger regressions in jsdom: roles, labels, visible text, accessible state and callbacks. Conventions: query by role or label, drive input with `userEvent.setup()`, no markup snapshots, import constants instead of copying values.
**Run:** `npx vitest run <Component>.test.tsx`.

## Benchmarks (A23, A24)

**Catches:** a slowdown of the simulation, `advanceShard` or swept collision. `src/game/simulation/simulation.bench.ts` measures 10 simulated seconds of the Queen's densest drilled phase, 10 of a minion-only encounter, one `advanceShard` step over a large shard list and `sweptConvexPartsOverlap` on the largest compound hitbox.
**Run:** `npm run bench`. On pull requests the CI `bench` job runs base and head alternately on one runner, `BENCH_ROUNDS` (5) times each, and fails through `scripts/bench-gate.mjs` when a benchmark is slower than `BENCH_REGRESSION_THRESHOLD`. Each side keeps its best run; locally on 2026-11-17 the worst base-against-base difference was 4.5 percent over two runs a side and 1.7 percent over five. The job compares nothing when the pull request leaves `app/src/game`, the toolchain files and the gate unchanged, because such a change cannot alter a timing and a comparison could only fail from runner noise. The comparison table is written to the job summary.
**Reproduce:** the gate prints a table of name, base, head and percent change. Run `npm run bench` on `main` and on the branch, alternating, copying `reports/bench/` aside after each run, then `node scripts/bench-gate.mjs --base <dirs> --head <dirs>`. Compare only timings taken on one machine; the browser soak's recorded local baseline is not comparable with CI.
**Threshold:** `BENCH_REGRESSION_THRESHOLD` in `scripts/bench-gate.mjs` is the larger of 20 percent and three times the worst base-against-base difference over three CI runs (A24). Measure it by running the manual `.github/workflows/bench-calibrate.yml` three times; `--calibrate` prints each run's worst difference and implied threshold and never fails. Until three CI measurements are recorded, the threshold is the 20 percent floor and the `bench` job keeps `continue-on-error: true`. One local base-against-base pair on 2026-11-17 gave a worst difference of 13.7 percent (`advance-shard`), implying 41.1 percent, so the CI value is likely to exceed the floor.

## Simulated soak (A25)

**Catches:** a leak or unbounded growth in the session: live shards, bombs, enemies, condition entries, serialized state size and history length, over 10 simulated minutes of every Queen phase drilled and looped, plus 25 retries.
**Run:** `npm run test:soak:sim`. It is its own Vitest project and is excluded from `npm test`.
**Reproduce:** the test prints the peak of each measure.

## Browser soak (A26)

The three 60-second Playwright `@soak` tests, their tag policy and their CI artifacts are unchanged. Run with `PLAYWRIGHT_SOAK=1`, or `CI=true`.

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

Per-shard break values, each floor(score) - 5 from this table: `config` 77 (82.1), `simulation` 89 (94.7), `research` 70 (75.7), `state` 83 (session plus storage, 225 of 254 = 88.6). The whole-set value of 77 still applies to an unsharded local run; one shared value would fail `research`.

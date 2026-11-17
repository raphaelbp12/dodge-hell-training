# Plan V22: Pre-Merge Quality Gates

Phases 90-96. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 90-96 build and why. It is not authorization to implement any phase by itself.

The project already runs lint, typecheck, unit and component tests, a production build and a Playwright suite with three 60-second soak tests on every push. This plan adds gates that raise the trust of a delivered change before it is committed or deployed: architecture boundaries enforced by lint, property-based tests of the simulation's invariants, contract tests for every data file and persisted format, mutation testing of the pure core, unit and component test gaps closed against mutation evidence, and benchmark and simulated-soak checks of performance.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and the approved technical approach for phases 90-96. Later explicit user decisions override older statements; record changes here.
- The user's request on 2026-11-16: from a list of software verification procedures, rank those most relevant to this project, then build a plan to implement unit tests, property-based tests, static analysis, contract tests, mutation tests, component tests, and performance, benchmark and soak tests. The user asked for the plan to be written by a senior developer and QA specialist, decisively and without questions. The A decisions below were therefore chosen by the agent, not answered by the user one by one; the user reviews them as a whole before any phase is implemented, and any one of them can be overridden.
- A code and configuration audit on 2026-11-16. Its findings:
  - `app/package.json` gates are `lint` (oxlint), `typecheck` (`tsc -b`), `test` (Vitest), `build` and `test:e2e` (Playwright); `npm run verify` runs the first four through `app/scripts/verify.mjs`.
  - `app/vitest.config.ts` has two projects: `node` (`src/**/*.test.ts`, `lint/**/*.test.ts`, 60-second timeout) and `dom` (jsdom, `src/**/*.test.tsx`).
  - `app/.oxlintrc.json` enables the `react`, `typescript` and `oxc` plugins and one local JS plugin, `lint/test-drift.js`, applied to `tests/**/*.ts` only. Nothing enforces the rule that models, configuration and simulation stay independent of React, Phaser, the DOM and localStorage.
  - `app/tsconfig.app.json` does not state `strict` explicitly.
  - `.github/workflows/pages.yml` runs lint, typecheck and unit tests as a matrix, builds once, runs Playwright in three main shards and three soak shards against that build, and deploys only from `main`.
  - The simulation is deterministic by seed (`app/src/game/simulation/random.ts`, mulberry32, G13); `arbitrarySeed` is the only host entropy.
  - `app/src/game/simulation/bomb-split-characterization.*.snap.json` are existing characterization snapshots.
  - Persisted formats carry a schema version: `HISTORY_SCHEMA_VERSION` in `app/src/storage/attempts.ts`, `schemaVersion: 5` in `app/src/research/study.ts`, with older study versions migrated by `app/src/research/studyMigrate.ts`.
  - No property-based, mutation-testing or benchmark tooling is installed.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification. Phase 96 adds short rules to their Verification section.
- [The deferred register](deferred-work.md): nothing is promoted or added.

No value in this plan is a gameplay value or a ROTMG fidelity claim. Every threshold below is a test or tooling threshold, and each one states its source.

## Completed Baseline

This plan is independent of the gameplay plans: it adds tests, lint rules, tooling and CI jobs, and changes no shipped behaviour.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V20](plan-v20.md) | 83-88 | The timeline tagger |
| [V21](plan-v21.md) | 89 | The tagger in every environment |

## Confirmed Design

Carried forward unchanged: every gameplay rule, value and `rulesVersion`; the architecture ownership rules in the project instructions; `npm run verify` as the single local gate and its four gates; the Playwright suite, its `@soak` tag policy and its CI sharding; the existing characterization snapshots.

This plan adds, as a delta:

- **Lint enforces the architecture (A01-A05).** Models, configuration, simulation and session code cannot import React, Phaser, UI, research, rendering or storage modules, cannot read browser globals, and cannot draw ambient entropy or wall-clock time. The game cannot import the tagger. Compiler strictness is explicit and oxlint's suspicious category is on.
- **Properties state the simulation's invariants (A06-A10).** fast-check property tests cover the random source, collision geometry, every projectile motion kind and the bomb type, whole-simulation determinism and step chunking, arena containment, and every validator and research model that takes untrusted input.
- **Contracts pin every data file and persisted format (A11-A14).** Every shipped JSON file is validated, cross-file references are closed, a rules fingerprint ties gameplay data to its `rulesVersion`, the tagger's export is proven to be valid game data, and frozen fixtures prove every saved format still loads.
- **Mutation testing measures the tests (A15-A18).** Stryker mutates the pure core, a weekly full run enforces a threshold from a recorded baseline, and a pull-request run reports mutants in changed files.
- **Unit and component gaps close against evidence (A19-A22).** A ratcheting test-presence check, survivor-driven unit tests, and component tests for every untested UI and tagger component.
- **Performance regressions are caught before merge (A23-A26).** A Vitest benchmark suite, a same-runner base-versus-head benchmark gate on pull requests, and a simulated soak that runs minutes of simulated time in Node.
- **The process records the evidence (A27-A28).** A quality-gates reference, short new rules in the project instructions, the verify skill mirroring the new CI jobs, and a pull-request template.

## Recorded Decisions - 2026-11-16

Chosen by the agent under the user's instruction to plan decisively without questions (see Sources). Each is overridable by the user.

### Static analysis (phase 90)

- **A01 - Layer import boundaries in oxlint configuration.** Use oxlint's built-in `no-restricted-imports` and `no-restricted-globals` in `.oxlintrc.json` overrides, not a custom plugin, wherever they can express the rule. The core is `src/game/models.ts`, `src/game/config/**`, `src/game/simulation/**` and `src/game/session/**`. The core must not import `react`, `react-dom`, `phaser`, any CSS file, or any module under `src/ui/`, `src/research/`, `src/game/phaser/` or `src/storage/`. The core must not read `window`, `document`, `localStorage`, `sessionStorage`, `navigator` or `requestAnimationFrame`. Nothing under `src/game/` may import `src/research/` (the one-way boundary of T13). `src/storage/**` must not import `react` or `phaser`. If oxlint's built-ins cannot express a pattern, that pattern moves into the A02 plugin, with the reason in the step's execution record.
- **A02 - A determinism lint rule.** Add a local JS plugin, `lint/determinism.js`, with one rule, `determinism/no-ambient-entropy`. It reports `Math.random`, `Date.now`, a `new Date()` without arguments, `performance.now`, `crypto.getRandomValues` and `crypto.randomUUID` in the core. A legitimate use, such as `arbitrarySeed` in `random.ts`, keeps an inline disable comment that gives its reason and decision ID. Source: G13 and the project rule against a second simulation clock.
- **A03 - Explicit compiler strictness.** Set `"strict": true` and `"noImplicitOverride": true` in `tsconfig.app.json` and `tsconfig.node.json`, and add the `override` keywords this requires. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not adopted: their churn across the simulation's indexed loops outweighs the bugs they would catch here.
- **A04 - oxlint suspicious category, no warnings.** Enable the `correctness` category as errors and the `suspicious` category. Fix true positives. Turn off a whole rule only with a one-line reason in the configuration. Then change the lint script to `oxlint --deny-warnings`, so warnings cannot pile up.
- **A05 - Production dependency audit in CI.** Add an `Audit` entry to the `checks` matrix that runs `npm audit --omit=dev --audit-level=high`. It stays out of `npm run verify`, because it needs the network.

### Property-based tests (phase 91)

- **A06 - fast-check, with a shared reproducible configuration.** Install `fast-check` as an exact-pinned dev dependency. `src/test/property.ts` exports the run configuration. It reads `FC_SEED` and `FC_NUM_RUNS` from the environment. The default is 100 runs for pure functions and `SIMULATION_PROPERTY_RUNS = 25` for whole-simulation properties, a runtime budget, not a gameplay value. Property files are named `<module>.property.test.ts`, so the existing `node` project picks them up. CI uses a fresh seed on every run. fast-check prints the seed and path of any failure, and the file header explains how to replay one locally.
- **A07 - Projectile and bomb invariants.** The generators draw projectile ids from the shipped catalog, so every motion kind (`linear`, `boomerang`, `turning`, `wavy`) and the bomb type is exercised with real data. The properties are:
  - a projectile is accepted as a hit at most once;
  - only a `boomerang` reverses, and it reverses at most once;
  - a projectile's age never passes its lifetime, and it is alive exactly when its age is less than its lifetime;
  - a curved motion's position does not depend on how the elapsed time is split into steps;
  - a bomb reports a hit only on its detonation step, detonates at its travel time, and never survives that step.
- **A08 - Whole-simulation invariants.** The properties are:
  - the same configuration, seed and input script give deep-equal states;
  - advancing the same total time in any partition of whole fixed steps gives a deep-equal state;
  - the player's body stays inside the arena shape for any input script;
  - health stays within zero and its maximum;
  - no projectile id appears twice among the accepted hits of a run.
- **A09 - Untrusted-input and research-model properties.** The properties are:
  - every validator and loader that takes outside input, given any JSON value, either returns or throws its own documented error, never a `TypeError` or other incidental crash;
  - a valid study survives a JSON round trip unchanged;
  - a cadence generated within bounded ranges is recovered by the cadence fit within its documented tolerance;
  - timeline zoom keeps its window inside the video and returns to the original window when zoomed back out.

  The validators and loaders are `validateEncounterData`, `validateStudyV5`, the study migration entry point, the history store's load and the tagger session restore.
- **A10 - A failing property is a finding, not a test to weaken.** When a property fails on the current code, record the counterexample, seed and path in the step's execution record. Keep the property, marked `test.fails` with a comment that cites the record, and stop for a user decision. Never change simulation behaviour, or any value that would need a `rulesVersion` bump, without approval. A counterexample worth keeping becomes an explicit example test beside the property.

### Contract tests (phase 92)

- **A11 - Every data file is validated and its references are closed.** A test globs `src/game/data/**/*.json`, maps each path pattern to the validator that consumes it, and fails on any file no pattern claims. Negative fixtures prove that every cross-file reference fails validation when it dangles: projectile ids in attacks, appearance ids, spawned archetypes, `arenaId` and shape ids.
- **A12 - A rules fingerprint.** `src/game/config/rules-fingerprint.json` maps each encounter id to its `rulesVersion` and to a SHA-256 hash of the canonical JSON (sorted keys) of every gameplay input that encounter consumes. Appearance and presentation-only data is excluded. A test fails with one of two messages: either gameplay data changed without a `rulesVersion` bump, or `rulesVersion` was bumped without updating the fingerprint. Source: the project rule to record comparison-breaking rules versions. The test may use `node:crypto`, because tests are not core.
- **A13 - The tagger's export is valid game data.** For every shipped monster file, loading it into the tagger and exporting the copy-file text with no edits gives JSON deep-equal to the file. Any difference is a finding under A10. For edits generated with the phase 91 harness, the exported text passes the game's own monster validator, and an exported projectile variant passes the projectile validator. Source: plan V18 L01, which promises monster JSON for a person to apply.
- **A14 - Frozen persistence fixtures.** Add one never-edited fixture per persisted schema version:
  - `src/storage/__fixtures__/` holds the attempt history;
  - `src/research/__fixtures__/` holds each study version `studyMigrate.ts` accepts, and one tagger session autosave.

  Every fixture must load or migrate into the current version. The committed `docs/killer-bee-queen-study-TFclwuPtC94.json` is a fixture too. A schema change adds a new fixture and never edits an old one, because saved player history and saved studies on the live site must keep loading.

### Mutation tests (phase 93)

- **A15 - Stryker on the pure core only.** Install `@stryker-mutator/core` and `@stryker-mutator/vitest-runner` as exact-pinned dev dependencies. Stryker uses the `node` Vitest project only, with `coverageAnalysis: "perTest"` and incremental mode, keeping its incremental file in a git-ignored `reports/mutation/`. It mutates:
  - `src/game/simulation/**/*.ts`;
  - the configuration modules `data.ts`, `encounter.ts`, `stats.ts`, `sectors.ts`, `drill.ts` and `phaseDossier.ts`;
  - `src/game/session/**/*.ts`;
  - `src/storage/**/*.ts`;
  - every `src/research/*.ts` model except the canvas drawer `previewDraw.ts`.

  Tests and `.tsx` files are never mutated. Phaser and React code are left to the Playwright and component suites.
- **A16 - A recorded baseline.** Run the whole mutation set once and record, per directory, the mutation score, survivor count and runtime in `docs/quality-gates.md` and in the step's execution record.
- **A17 - A weekly full run and an informational pull-request run.** A new `.github/workflows/mutation.yml` runs:
  - the full set weekly and on `workflow_dispatch`, with the incremental file cached;
  - a diff-only run on pull requests, mutating the changed files in the mutate globs, with `continue-on-error: true` and an HTML report artifact.

  `npm run test:mutation` runs the full set locally. `npm run test:mutation:diff` runs the set changed against `origin/main`.
- **A18 - A ratcheted threshold.** After the baseline, the full run's `thresholds.break` is the baseline score rounded down, minus 5 points; the 5 points absorb incremental-mode noise. Phase 94 raises the threshold to its new measured score, rounded down, minus 5. The pull-request run stays informational in this plan.

### Unit and component tests (phase 94)

- **A19 - A ratcheting test-presence check.** `lint/test-presence.test.ts` requires every runtime module under `src/` to have a sibling `<name>.test.ts`, `.test.tsx` or `.property.test.ts`. The only exceptions are listed in `lint/test-presence-allowlist.json`, each with a reason, such as a types-only module, an entry point or CSS. The check also fails when an allowlisted module gains a test, so the list can only shrink.
- **A20 - Survivor-driven unit tests.** Kill the baseline's surviving mutants by adding assertions to the existing unit tests. Start with `simulation.ts`, `projectiles.ts`, `bombs.ts`, `phases.ts`, `patterns.ts`, `health.ts`, `conditions.ts` and `data.ts`. An equivalent mutant gets `// Stryker disable next-line <mutator>: <reason>`. Production code changes only when a survivor exposes a bug, and that is a finding under A10.
- **A21 - Component tests for every untested UI component.** Cover each `src/ui/*.tsx` component without a test: `ResultsPanel`, `History`, `SessionRail`, `ControlsDialog`, `DebugPanel`, `ConditionList`, `PhaseLadder`, `PhaseDossier`, `ProjectileSprite`, `Changelog` and `ArenaPlate`. `EncounterScreen` and `PhasePreview` get tests through a fake encounter handle, with no Phaser in jsdom. Conventions:
  - query by role or label;
  - drive input with `userEvent.setup()`;
  - assert visible text, accessible state and callbacks;
  - no markup snapshots;
  - import every constant instead of hand-copying a value.
- **A22 - Component tests for the tagger.** Cover `AttackEditor`, `CommitInput`, `ScalePanel`, `TaggerControls`, `InfoDialog` and `PreviewPanel`, with `previewDraw` stubbed. `TaggerRoute` gets flow tests through its public behaviour: restore a study, edit an attack, accept a reconciled value and copy the export. They use a fake video element.

### Performance, benchmark and soak tests (phase 95)

- **A23 - A Vitest benchmark suite.** `src/game/simulation/simulation.bench.ts` benchmarks:
  - 10 simulated seconds of the Killer Bee Queen's most shard-dense drilled phase, with a fixed seed and scripted input;
  - 10 simulated seconds of a minion-only encounter;
  - one `advanceShard` step over a large pre-spawned shard list;
  - `sweptConvexPartsOverlap` on the Queen's largest compound hitbox.

  `npm run bench` runs the suite. It stays out of `npm run verify`.
- **A24 - A same-runner benchmark gate on pull requests.** A `bench` job in `pages.yml`, on pull requests only, checks out the merge base and the head side by side. It installs both and runs the benchmarks alternately, base, head, base, head, keeping each one's best. `scripts/bench-gate.mjs` fails when any benchmark present on both sides is slower by more than `BENCH_REGRESSION_THRESHOLD`. The threshold is measured, not guessed: the larger of 20 percent and three times the worst base-against-base difference over three CI runs. The constant's comment records the measurement. Comparing on one runner avoids comparing CI timings with the local baseline, which the project rules forbid.
- **A25 - A simulated soak in Node.** `src/game/simulation/runtime-bounds.soak.test.ts` runs in its own Vitest project, `soak`, which is excluded from `npm test`. Its script is `npm run test:soak:sim`, and the `checks` matrix gains a `Simulated Soak` entry. Through the session, it drives each Queen phase drilled and looped for 10 simulated minutes, plus 25 retries. It asserts:
  - live shards stay within the derived shard bound, with the bound's helper imported from source and not copied from `tests/app.spec.ts`;
  - bombs, enemies and condition state stay bounded;
  - the serialized state size at minute 10 is at most 1.1 times its largest size over minutes 1-2;
  - history never exceeds `historyLimit`.

  It catches leaks before a 60-second browser soak can.
- **A26 - The browser soaks stay as they are.** The three Playwright `@soak` tests, their tag policy and their CI artifacts are unchanged.

### Process (phase 96)

- **A27 - One reference and short rules.** `docs/quality-gates.md` describes every gate: what it catches, how to run it, how to reproduce a failure (`FC_SEED`, the Stryker report, the benchmark table) and where it runs. The project instructions gain only rules:
  - A10, on failing properties;
  - A12, on the fingerprint;
  - run `npm run test:mutation:diff` before reporting a change to a mutated module;
  - run `npm run bench` and the gate against `main` before reporting a change to the simulation's hot path.

  The verify skill mirrors the new CI jobs.
- **A28 - A pull-request template.** `.github/pull_request_template.md` asks for:
  - the gates actually run, with their printed result lines;
  - the mutation diff score and the benchmark gate table, when they apply;
  - whether `rulesVersion` and the fingerprint changed;
  - whether a deferred-register item was touched.

## Architecture

Every addition is test or tooling code. No production module gains a dependency.

| Addition | Location | Owner |
| --- | --- | --- |
| Boundary and determinism lint | `app/.oxlintrc.json`, `app/lint/determinism.js` | oxlint |
| Property harness | `app/src/test/property.ts` | Vitest `node` project |
| Property tests | `app/src/**/<module>.property.test.ts` | Vitest `node` project |
| Rules fingerprint | `app/src/game/config/rules-fingerprint.json` and its test | Vitest `node` project |
| Persistence fixtures | `app/src/storage/__fixtures__/`, `app/src/research/__fixtures__/` | Vitest `node` project |
| Mutation configuration | `app/stryker.config.mjs`, `app/scripts/mutation-diff.mjs`, `.github/workflows/mutation.yml` | Stryker |
| Test-presence ratchet | `app/lint/test-presence.test.ts`, `app/lint/test-presence-allowlist.json` | Vitest `node` project |
| Benchmarks and gate | `app/src/game/simulation/simulation.bench.ts`, `app/scripts/bench-gate.mjs` | Vitest bench, CI `bench` job |
| Simulated soak | `app/src/game/simulation/runtime-bounds.soak.test.ts` | Vitest `soak` project |

`npm run verify` keeps its four gates. Property, contract, presence and component tests run inside `test`. The mutation run, benchmarks, simulated soak and audit are slower or need the network, so they run in CI and on demand.

## Approved Scope And Review Gates

In scope: A01-A28 only.

Out of scope:

- any change to gameplay behaviour, values, `rulesVersion` or snapshots;
- coverage gates; Stryker's per-test coverage replaces them;
- golden replay regression tests (ranked separately, not requested), and seeded replay in attempt history (D08);
- visual regression screenshots;
- dead-code detection;
- `noUncheckedIndexedAccess`;
- any production-side monitoring or telemetry, which needs a backend.

Review gates:

- each step's focused test file run alone with `npx vitest run <path>`;
- `npm run verify` from `app/` at the end of every phase, run by the `verifier` subagent;
- `npm run test:soak:sim`, `npm run bench` and the mutation runs where a phase introduces them;
- no Playwright run beyond what a phase names.

A failing property, contract or mutation finding on current code stops the phase for a user decision (A10).

## Phase Index

- [Phase 90 - Architecture And Static Analysis](plan-archive/phase-90.md). Status: complete. Outcome: oxlint enforces the layer boundaries and bans ambient entropy in the core, `strict` and `noImplicitOverride` are on, lint denies warnings and CI audits production dependencies. Dependencies: none.
- [Phase 91 - Property-Based Invariants](plan-archive/phase-91.md). Status: complete. Outcome: fast-check properties cover the random source, geometry, every motion kind and bombs, whole-simulation invariants, untrusted-input loaders, cadence fit and timeline zoom. Dependencies: none.
- [Phase 92 - Data And Persistence Contracts](plan-archive/phase-92.md). Status: complete. Outcome: every data file is claimed and its references closed, a rules fingerprint ties gameplay data to `rulesVersion`, the tagger export is checked (two A10 findings recorded) and frozen fixtures pin every saved format. Dependencies: phase 91.
- [Phase 93 - Mutation Testing](plan-archive/phase-93.md). Status: complete. Outcome: Stryker mutates the core, storage and research modules in place with a fixed fast-check seed, a dated full baseline of 80.7 is recorded, and a validated weekly and pull-request workflow enforces the ratcheted break threshold. Dependencies: phases 91, 92.
- [Phase 94 - Unit And Component Gaps](plan-archive/phase-94.md). Status: complete. Outcome: a test-presence ratchet with only permanent allowlist entries, component tests for every UI and tagger component, survivor-driven tests that lifted `projectiles.ts` to 92.0 and `data.ts` to 86.1, and a mutation ratchet from 80.7 to 82.4 with `thresholds.break` at 77. Dependencies: phase 93.
- [Phase 95 - Performance, Benchmarks And Simulated Soak](plan/phase-95.md). Status: partial (see its execution record). Dependencies: phase 90.
- [Phase 96 - Process Integration And Acceptance](plan/phase-96.md). Status: partial (see its execution record). Dependencies: phases 90-95.

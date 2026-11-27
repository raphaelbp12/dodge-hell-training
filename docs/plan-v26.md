# Plan V26: Doc-Only Pull Requests Skip The Pages Checks

Phase 103. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phase 103 builds and why. It is not authorization to implement the phase by itself.

A pull request that changes only Markdown or `.claude/**` files, such as every plan pull request, currently runs every job in `.github/workflows/pages.yml`: lint, typecheck, unit tests, simulated soak, audit, build and the browser suites. They cannot change a result. This plan makes those jobs skip their work on such a pull request while still reporting success, so the `Protect main` required checks never stay pending.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved approach for phase 103. Later explicit user decisions override older statements; record changes here.
- The user's issue text (SAFE-10, 2026-11-24): "when a new plan is made, the github actions runs, even tests runs, we don't need to run all the actions just for the plan files".
- The user's answers of 2026-11-27 to the `/brainstorm` questions 1-5, recorded below as D-26-1 to D-26-5.
- [The trust plan of 2026-11-19](trust-plan-2026-11-19.md), T3, which removed `paths-ignore` from the `pull_request` trigger so that required checks always report. This plan keeps that trigger and changes what the jobs do after it.

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V24](plan-v24.md) | 101 | Camera rotation |

## Confirmed Design

Carried forward unchanged: every gameplay rule, the simulation and every `rulesVersion`; the `pull_request` trigger of `pages.yml` without a paths filter (T3); the `paths-ignore` of its `push` trigger; the required checks of the `Protect main` ruleset and their names; `mutation-diff.yml`, which already skips a pull request that changes no app file; `mutation.yml` and `bench-calibrate.yml`.

This plan adds, as a delta: on a pull request that changes only doc files, each job of `pages.yml` that does work skips its steps after a diff against the base and reports success.

## Recorded User Decisions - 2026-11-27

- **D-26-1. Step-level skip.** Each job diffs against the base first. If only doc files changed it skips its remaining steps and reports success, as `mutation-diff.yml` does. No separate `changes` job and no job-level `if`, so every required check, including the matrix jobs, keeps reporting under its own name. (Question 1a.)
- **D-26-2. What counts as doc-only.** The set of the existing push filter: `**/*.md` and `.claude/**`. A pull request with any other changed file runs everything. (Question 2a.)
- **D-26-3. Every job skips.** Lint, Typecheck, Unit Tests, Simulated Soak, Audit, Build and the Browser Tests skip. The Benchmark Gate already skips a pull request that changes no benchmarked code and stays as it is. (Question 3a.)
- **D-26-4. Documented in two places.** The workflow header comment, which now says a pull request always runs, is corrected, and `docs/quality-gates.md` gains a sentence describing the doc-only skip. (Question 4b.)
- **D-26-5. Verification.** The YAML is validated locally. The skip is confirmed on the pull request that carries the change and on a later doc-only pull request. No `actionlint` and no new tooling. (Question 5a.)

## Architecture

- `.github/workflows/pages.yml`: the jobs `checks`, `audit`, `build` and `browser` each check out with enough history to diff against the pull request's base, run one detection step that writes an output, and guard every later step with that output, following `mutation-diff.yml`. On `push` the detection reports "run" without a diff. The `deploy` job is push-only and unchanged.
- `build` skipping means `browser` finds no `production-build` artifact; `browser` therefore detects for itself and skips its own steps, and does not depend on the artifact when it skips.
- Doc-only means every changed file matches `*.md` anywhere or lies under `.claude/`. An empty diff counts as doc-only.

## Target Data Shapes

None. No data file, `rulesVersion`, fingerprint or application code changes.

## Approved Scope And Review Gates

In scope: D-26-1 to D-26-5 only.

Out of scope: `mutation-diff.yml`, `mutation.yml` and `bench-calibrate.yml`; the `push` trigger; the ruleset and its required check names; a job-level skip; non-Markdown files under `docs/`; any `actionlint` step; any application, test or data change.

Review gates:

- Only `.github/workflows/pages.yml`, `docs/quality-gates.md` and plan files change; no `rulesVersion`, fingerprint or simulation snapshot changes.
- The pull request that carries the change changes a workflow file, so it is not doc-only and runs every job: they must pass.
- A later doc-only pull request is the check that the skip works: every required check reports success and no job installs dependencies. Record it as performed or blocked.
- `npm run verify` is skipped for the documentation files and not needed for the workflow; the YAML is parsed locally.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 103 | Doc-Only Pull Requests Skip The Pages Checks | pending | None |

## Phase 103: Doc-Only Pull Requests Skip The Pages Checks

[Step prompts](plan/phase-103.md).

- 103.1 - Skip Doc-Only Pull Requests In Pages: pending. Dependencies: none.
- 103.2 - Document The Skip: pending. Dependencies: 103.1.

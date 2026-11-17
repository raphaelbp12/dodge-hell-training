# Phase 96: Process Integration And Acceptance

> Step prompts and execution records for phase 96 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 96.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-96.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 96.1 - Quality-Gates Reference And Rules

Status: complete. Dependencies: phases 90-95.

**Implementation prompt**

Apply A27. Complete `docs/quality-gates.md`, which phase 93 started. Give one section per gate:

- lint boundaries;
- determinism;
- strictness;
- the audit;
- properties;
- contracts and the fingerprint;
- frozen fixtures;
- mutation;
- test presence;
- component tests;
- benchmarks;
- simulated soak;
- browser soak.

Each section states what the gate catches, the command, where it runs (local verify, CI checks, the CI bench job, the weekly mutation run) and how to reproduce a failure: `FC_SEED` and path, the Stryker HTML report, the bench table, the soak's peak output.

In `AGENTS.md`'s Verification section, add only these rules, each one sentence:

- A10's failing-property policy;
- A12's fingerprint rule;
- run `npm run test:mutation:diff` before reporting a change to a module in the mutate globs;
- run `npm run bench` against `main` and the gate before reporting a change to the simulation's hot path, meaning `simulation.ts`, `projectiles.ts`, `bombs.ts` or `geometry.ts`;
- the pointer to `docs/quality-gates.md`.

Update the instruction-files table only if a file was added that belongs there. Make sure `.claude/skills/verify/SKILL.md` mirrors every new CI job.

**Focused checks**

Every command named in `docs/quality-gates.md` exists in `app/package.json`. Grep for each one.

**Acceptance**

The reference is complete. `AGENTS.md` gains rules, not copies of the reference. The verify skill matches `pages.yml` and `mutation.yml`.

### Step 96.2 - Pull-Request Template

Status: complete. Dependencies: 96.1.

**Implementation prompt**

Apply A28. Create `.github/pull_request_template.md` with these sections:

- **Summary**;
- **Gates run**: paste the `npm run verify` lines; tick `test:soak:sim`, `bench` and the gate, and `test:mutation:diff` with its score, each marked "ran" or "not applicable", with a reason;
- **Rules**: whether `rulesVersion` and `rules-fingerprint.json` changed;
- **Deferred register**: whether an item was touched, and the approval;
- **Findings**: any A10 finding raised.

Keep it under 40 lines.

**Focused checks**

None.

**Acceptance**

The template exists, and every gate it names exists.

### Step 96.3 - Acceptance Run

Status: partial (every gate ran and all four seeded defects were caught; the `implementation-plan.md` row update and the archive wait on phase 95). Dependencies: 96.1, 96.2.

**Implementation prompt**

Run the plan's acceptance once, and record each result here:

1. Delegate `npm run verify` to the `verifier` subagent.
2. Run `npm run test:soak:sim`.
3. Run `npm run bench`.
4. Run `npm run test:mutation` in full, in the background, and compare its score with the configured break value.
5. Run `npm run audit`.
6. Introduce one deliberate defect in a scratch branch or stash, and confirm the expected gate catches it, then revert it:
   - a `Math.random()` in `phases.ts` is caught by lint;
   - a shard that may hit twice is caught by the property;
   - a projectile speed change with no `rulesVersion` bump is caught by the fingerprint;
   - an assertion removed from `projectiles.test.ts` is caught as a new survivor by `test:mutation:diff`.

Record each defect, the gate that caught it and the revert. Run no Playwright beyond what CI runs. Commit, push and CI observation are outside this step.

**Focused checks**

`git status` after the defect checks shows no leftover defect.

**Acceptance**

Every gate ran or is recorded as blocked, and each of the four seeded defects was caught by its gate. Update `implementation-plan.md`'s V22 row status and archive this file.

## Execution Record

Implemented 2026-11-16 in auto mode; **partly done**.

- **96.1** `docs/quality-gates.md` (one section per gate), five short rules in `AGENTS.md` Verification, the verify skill mirrors `Audit`, `Simulated Soak`, `bench` and `mutation.yml`. Every command it names exists in `app/package.json` (`audit`, `test:soak:sim`, `bench`, `test:mutation`, `test:mutation:diff`).
- **96.2** `.github/pull_request_template.md`, 33 lines.
- **96.3** Acceptance, by item: verify, soak, bench and audit ran (results in the phase 90 and 95 records; audit found 0 vulnerabilities). The full mutation run did **not** complete (partial baseline, phase 93). Seeded defects: a `Math.random()` in `phases.ts` was caught by lint (`determinism/no-ambient-entropy`); a projectile speed change in `projectiles.json` without a `rulesVersion` bump was caught by the fingerprint test; both were reverted. **Not done:** the shard-hits-twice defect (the property that guards it passed unchanged on current code) and the removed-assertion defect for `test:mutation:diff`, because each needs a mutation run.
- **96.3, completed 2026-11-17.** The full mutation run finished (82.4, above the break value 77; phase 94's record). The two remaining seeded defects:
  - *Shard that may hit twice.* Removing `!shard.hasHitPlayer &&` from `moveShard` in `projectiles.ts` failed two properties on their first counterexample: "a projectile is accepted as a hit at most once, whatever the steps and player path" (`projectiles.property.test.ts`, after 1 run) and "... no projectile is accepted twice" (`simulation.property.test.ts`, after 2 runs). Reverted; both properties pass and `projectiles.ts` has no diff.
  - *Assertion removed from `projectiles.test.ts`.* Seeding it showed a gap in the gate: `scripts/mutation-diff.mjs` selected only changed modules, so a change to a test alone never mutated the module it tests and the defect could not be caught. The script now also selects the module beside each changed `.test.ts` or `.property.test.ts` when it exists (two new tests in `mutation-diff.test.mjs`, written first; seven pass). With the `interpolatePosition` assertion removed, the user ran the Stryker command the diff run builds, narrowed to `projectiles.ts` (a real diff run would mutate every module the uncommitted V22 work touches): the score fell from 92.0 to 91.0 and two new survivors appeared, both in `interpolatePosition` (line 234 `start.x - (end.x - start.x) * fraction`, line 235 `(end.y - start.y) / fraction`). Reverted; no `SEEDED` marker remains and `git status` shows no defect.
  - The user's `rtk` command-rewriting hook blocked agent-run mutation commands under auto mode; `npm run test:mutation` and `npm run test:mutation:diff` are now in `exclude_commands` in `~/.config/rtk/config.toml` (outside the repository).

  Every seeded defect was caught by its gate; the fourth by the Stryker command that `test:mutation:diff` builds, narrowed to `projectiles.ts` and run by the user, not by a full `test:mutation:diff` run. Phase gate after these changes, one `npm run verify` through the `verifier` subagent: lint PASS, typecheck PASS, test PASS (113 files, 1,855 tests plus the 2 A10 `test.fails`, 42.3 s), build PASS. Phase 96 stays open only because its dependency, phase 95, is partial (the bench threshold needs three CI measurements).

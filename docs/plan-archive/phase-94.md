# Phase 94: Unit And Component Gaps

> Step prompts and execution records for phase 94 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 94.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-94.md` and replace the phase's line in the plan file with a one-sentence outcome.

Every component test in this phase follows A21's conventions:

- query by role or label;
- drive input with `userEvent.setup()`;
- assert visible text, accessible state and callbacks;
- take no markup snapshots;
- import every constant instead of hand-copying a value.

### Step 94.1 - Test-Presence Ratchet

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A19. Create `app/lint/test-presence.test.ts`, which the `node` project already includes through `lint/**/*.test.ts`. It walks `app/src` and treats each `.ts` and `.tsx` file as a runtime module, except:

- test, property, soak and bench files;
- `.d.ts` files;
- files under `__fixtures__/`.

Each module needs a sibling `<name>.test.ts`, `<name>.test.tsx` or `<name>.property.test.ts`. Otherwise its path, relative to `app/`, must be in `app/lint/test-presence-allowlist.json`, an object of path to a non-empty reason. The test fails in three cases:

- a module has neither a test nor an allowlist entry;
- an allowlisted module now has a test, so the entry must be removed;
- an allowlisted path no longer exists.

Seed the allowlist from the current tree. Give types-only modules such as `models.ts`, entry points such as `main.tsx` and `vite-env.d.ts`, and test support their real reasons. Give every other current gap the reason "untested; closed in phase 94" so the rest of this phase shrinks it.

**Focused checks**

Write the test first, against a temporary directory fixture: a module with a test, one without, one allowlisted with a test, and a stale entry. Then point it at `src`.

**Acceptance**

The test passes, and every allowlist entry has a reason.

### Step 94.2 - Survivor-Driven Unit Tests

Status: complete. Dependencies: phase 93.

**Implementation prompt**

Apply A20. Take the step 93.2 survivor list. Start with `simulation.ts`, `projectiles.ts`, `bombs.ts`, `phases.ts`, `patterns.ts`, `health.ts`, `conditions.ts` and `data.ts`, in survivor-count order. For each file, run `npm run test:mutation -- --mutate <file>` and open the HTML report. Kill each survivor with an assertion in the module's existing test file. Prefer one that states the behaviour the mutant broke over one that pins an incidental value. Then handle what is left:

- An equivalent mutant gets `// Stryker disable next-line <mutator>: <reason>`.
- A survivor that reveals a bug is a finding under A10: stop for a decision, and do not fix it silently.

Also add unit tests for the modules step 94.1 allowlisted as untested under `src/game/config/` and `src/storage/`, such as `sectors.ts`, `stats.ts` and `debug.ts`, and remove their entries.

**Focused checks**

Each file's rerun reaches a mutation score of at least 80, the A15 `high` threshold, or records why not. Run each changed test file alone.

**Acceptance**

Record each listed file's before and after score in the execution record. No production behaviour changed.

### Step 94.3 - UI Component Tests

Status: complete. Dependencies: 94.1.

**Implementation prompt**

Apply A21. Add one `<Component>.test.tsx` beside each of these components: `ResultsPanel`, `History`, `SessionRail`, `ControlsDialog`, `DebugPanel`, `ConditionList`, `PhaseLadder`, `PhaseDossier`, `ProjectileSprite`, `Changelog` and `ArenaPlate`.

Each test covers:

- the empty or initial state;
- the populated state, built from real configuration through the existing models (`historyModel.ts`, `phaseLadderModel.ts`, `phaseDossier.ts`);
- every user interaction the component offers, asserting the callback and its arguments;
- disabled or hidden states.

For `EncounterScreen` and `PhasePreview`, replace the Phaser encounter handle with a fake through the component's existing props or module seam, using `vi.mock` of `src/game/phaser/encounter.ts` only if no prop seam exists. Assert that published views render in the HUD, and that controls call the handle. Remove each covered component from the allowlist.

**Focused checks**

Each new file passes alone with `npx vitest run <path>`.

**Acceptance**

Every listed component has a passing test, and its allowlist entry is gone.

### Step 94.4 - Tagger Component Tests

Status: complete. Dependencies: 94.1.

**Implementation prompt**

Apply A22. Add tests for `AttackEditor`, `CommitInput`, `ScalePanel`, `TaggerControls`, `InfoDialog` and `PreviewPanel`. Stub `previewDraw.ts` with `vi.mock`, and assert the draw calls receive the model's frame. Assert that each `HelpMark` shows the intended `helpText.ts` constant by importing it.

Add `app/src/research/TaggerRoute.flows.test.tsx` with a fake `HTMLVideoElement`, whose `currentTime`, `duration` and events are set by the test. It covers four flows:

1. restore a study from the session list;
2. edit an attack's cadence in the Attacks step;
3. accept a measured value in the Reconcile step;
4. copy the export, where the clipboard text deep-equals the `studyExport.ts` output for the same study.

Remove the covered entries from the allowlist.

**Focused checks**

Each new file passes alone.

**Acceptance**

Each listed component and each of the four flows has a passing test.

### Step 94.5 - Threshold Ratchet And Phase Gate

Status: complete. Dependencies: 94.2-94.4.

**Implementation prompt**

Rerun the full mutation set as in step 93.2. Record the new scores in `docs/quality-gates.md`, and raise `thresholds.break` to the new score rounded down, minus 5 (A18). Delegate one `npm run verify` run to the `verifier` subagent, and record its lines. Update the Phase Index and archive this file.

**Focused checks**

None beyond the runs above.

**Acceptance**

All four gates pass. The mutation score is at least the phase 93 baseline. The allowlist holds only reasoned, permanent entries.

## Execution Record

Implemented 2026-11-16 in auto mode; step 94.2's survivor pass and 94.5's ratchet finished on 2026-11-17.

- **94.1** `lint/test-presence.test.ts` and `lint/test-presence-allowlist.json` (seven fixture-tree tests plus the repository check). The final allowlist holds only permanent, reasoned entries (entry point, types, Phaser integration, constants, test support, canvas drawer, static copy, `encounter.ts` covered by the config tests, `TaggerRoute.tsx` covered by its flows file).
- **94.2** New unit tests for `stats.ts`, `sectors.ts` and `debug.ts` (their allowlist entries are gone). The survivor-driven pass ran on 2026-11-17 against the full baseline. Before and after scores of the listed files:

  | File | Before | After |
  | --- | --- | --- |
  | `simulation.ts` | 94.3 | 94.3 (already above 80; no new tests) |
  | `projectiles.ts` | 78.5 | 92.0 |
  | `bombs.ts` | 100 | 100 |
  | `phases.ts` | 94.5 | 94.5 (already above 80) |
  | `patterns.ts` | 97.7 | 97.7 (already above 80) |
  | `health.ts` | 96.7 | 96.7 (already above 80) |
  | `conditions.ts` | 95.3 | 95.3 (already above 80) |
  | `data.ts` | 76.0 | 86.1 |

  `projectiles.test.ts` gained closed-form turning and wavy position and heading tests (off-axis spawn, 2 Hz), `interpolatePosition`, a pass-through of a moving player on each axis and a mid-step boomerang reversal against a moving player. `data.test.ts` gained a table of 29 one-field breaks of the shipped JSON, each asserting the exact rejection message (the older tests asserted only `RangeError`, so a removed guard survived behind a later rejection), plus `validateMovement` tests. The narrowed rerun (`--mutate` on the two files, 2 minutes 33 seconds) scored 82.12 overall. Remaining `projectiles.ts` survivors are the floating-point slack in the culling bound (lines 198-201), the culling short-circuits (209-212, which only skip the exact swept test and cannot change its answer) and the `<=` boundary snap (320); they were left unmarked rather than disabled, since a test at the exact float boundary may still reach some. The three module-load guards in `data.ts` (2043, 2076, 2081) stay uncovered because they run only at import. No survivor revealed a bug, and no production code changed.
- **94.3** Component tests: `ResultsPanel`, `History`, `SessionRail`, `ControlsDialog`, `DebugPanel`, `ConditionList`, `PhaseLadder`, `PhaseDossier`, `ProjectileSprite`, `Changelog`, `ArenaPlate`, `EncounterScreen` (faked `createEncounter` through `vi.mock`, no prop seam exists) and `PhasePreview` (faked preview module). `src/test/encounter-view.ts` builds a view.
- **94.4** `AttackEditor`, `CommitInput`, `ScalePanel`, `TaggerControls` (the step bar and segmented control), `InfoDialog` and `PreviewPanel` (with `previewDraw` stubbed), and `TaggerRoute.flows.test.tsx` with four flows (restore a session, edit a cadence, accept a measured telegraph, copy the export and compare it with `studyExport` output). The flows use a Queen study written to `localStorage` and no video, so the fake video element is limited to stubbed playback methods; the Crystal Worm cannot be used because of the A10 finding in phase 92.
- **94.5** First pass (2026-11-16) test gate: 113 files, 1,810 tests, 45.9 s, about 5 s more than before phase 91. Ratchet (2026-11-17): the user ran the full mutation set in their own terminal from the incremental file; it scored 82.4 (phase 93 baseline 80.7), so `thresholds.break` rose from 75 to 77 (floor(82.4) - 5). Scores by area are in `docs/quality-gates.md`. The allowlist holds only the permanent, reasoned entries listed under 94.1. Phase gate, one `npm run verify` through the `verifier` subagent: lint PASS, typecheck PASS, test PASS (113 files, 1,851 tests plus the 2 A10 `test.fails`, 42.8 s), build PASS.

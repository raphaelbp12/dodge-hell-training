# Phase 29: Drill Sets And Phase Transitions

> This phase belongs to [plan V7](../implementation-plan-v7.md). Read [the implementation plan](../../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 29 adds the simulation-level drill set: a sorted set of top-level phases plus a Loop flag, group jumps, finite one-shot completion, final-phase looping, and drill-specific attempt identities. No UI is added in this phase; the existing single-phase URL and debug controls keep working through compatibility aliases.

### Step 29.1 - Normalize The Drill Selection Model

Status: complete. Dependencies: none.

**Implementation prompt.** Add `DrillSelection` to `app/src/game/models.ts`:

```ts
export type DrillSelection = Readonly<{
  phaseIndices: readonly number[];
  loop: boolean;
}>;
```

Extend `CreateSimulationOptions` in `app/src/game/simulation/simulation.ts` with `drill?: DrillSelection | null`. Keep `startPhaseIndex` and `loopPhase` as compatibility aliases; normalize them at the `createSimulation` boundary into a `DrillSelection` (single index, `loop` from `loopPhase`). Replace `SimulationState.loopPhaseIndex` with `SimulationState.drill: DrillSelection | null`.

Validation and normalization:

- `phaseIndices` must be a nonempty list of unique, in-range, integer top-level phase indices. Sort ascending and deduplicate before storing.
- An empty list, an absent drill or a `null` drill means the normal full fight and stores `drill: null`.
- Out-of-range, fractional, negative or non-finite indices are a `RangeError`, matching the existing `startPhaseIndex` validation.
- The primary enemy starts in the first normalized index through `enterDrillPhase`; minions keep their authored `startPhaseIndex`.
- Existing callers using `startPhaseIndex`/`loopPhase` must behave exactly as before.

**Focused checks.** Add failing-first cases in `app/src/game/simulation/simulation.test.ts` or a focused drill test file:

- `{ phaseIndices: [3, 1, 3], loop: true }` normalizes to `[1, 3]`;
- `startPhaseIndex: 2, loopPhase: true` becomes `{ phaseIndices: [2], loop: true }`;
- an empty or missing drill starts the full fight;
- an out-of-range or fractional index throws;
- the opening enemy starts in the first normalized phase and the rules version uses the drill identity from step 29.3.

**Acceptance.** `CreateSimulationOptions` and `SimulationState` expose the normalized drill, the old aliases behave identically, and invalid sets are rejected at creation.

### Step 29.2 - Implement Group Transitions And Finite Clear

Status: complete. Dependencies: 29.1.

**Implementation prompt.** Add a pure helper (for example `nextDrillPhaseIndex(drill, currentIndex)` in `app/src/game/config/drill.ts`) that returns:

- the next selected phase after `currentIndex` in authored order;
- the first selected phase when `currentIndex` is the last selected and `drill.loop` is true;
- `null` when `currentIndex` is the last selected and `drill.loop` is false.

Use it in `app/src/game/simulation/phases.ts`:

- In `tryAdvancePhase`, before the authored `nextIndex` guard, handle the drilled primary enemy. When its current phase exits normally, either `enterDrillPhase` the next selected phase, wrap to the first selected, or set `state.phase = "cleared"` for a finished one-shot. The final authored phase must enter this path because a drill can loop it.
- Only the primary enemy is drilled; a phase-driven minion keeps the authored monotonic progression.
- When a looped selection reaches the final authored phase's health-zero exit, reset its health to that phase's entry fraction and continue the selection instead of setting `state.phase = "cleared"`. The reset must happen before the session turns the simulation into a result.
- With Loop off, the final authored phase clears normally at health zero; a one-shot selection that ends before the final phase sets `cleared` when its last selected phase exits.
- Every jump uses `enterDrillPhase`; do not clear shards or non-`despawnOnExit` minions, and do not add a second phase machine.

**Focused checks.** Add failing-first cases covering:

- single phase, Loop on: re-enters the same phase on exit, health resets to its entry fraction;
- single phase, Loop off: clears after one exit;
- group `[1, 3]`, Loop on: 1 -> 3 -> 1 -> 3;
- group `[1, 3]`, Loop off: 1 -> 3, then `cleared` when phase 3 exits;
- group `[1, 3, 5]` with non-contiguous indices;
- phase 8, Loop on: at health zero it resets and re-enters instead of clearing;
- phase 8, Loop off: health zero clears;
- a group ending at phase 8, Loop on: wraps to its first selected phase at health zero;
- a group ending before phase 8, Loop off: sets `cleared` at the last selected phase exit;
- a phase-driven minion in the same fight still advances monotonically;
- fired shards survive a jump and only `despawnOnExit` minions disappear.

Use the existing phase-machine test helpers or drive `advanceSimulation` with fixed steps; do not add a second clock.

**Acceptance.** The drill matrix in plan V7 is reproduced exactly, the primary-only rule holds, and a one-shot selection produces a normal `cleared` result at the end of its set.

### Step 29.3 - Add Drill Identities And History Separation

Status: complete. Dependencies: 29.2.

**Implementation prompt.** Add `drillRulesVersion(baseRulesVersion, drill)` to `app/src/game/config/drill.ts`:

- no drill -> the base rules version;
- one phase, Loop on -> `-drill-p<N>` (preserve the existing single-loop identity);
- one phase, Loop off -> `-drill-p<N>-once`;
- multiple phases, Loop on -> `-drill-p<a-b-c>`;
- multiple phases, Loop off -> `-drill-p<a-b-c>-once`.

Use it in `createSimulation` and in `SessionController.applyDrill` (phase 31). Do not change the stored attempt schema; `rulesVersion` is the existing grouping key.

**Focused checks.** Add failing-first cases:

- base, single-loop, single-once, group-loop and group-once identities exactly as above;
- the same selection with different loop flags produces different identities;
- different phase sets produce different identities;
- `retainedBestSeconds` keeps a one-shot best separate from a looped best and from a different group;
- the old single-loop `-drill-pN` identity is unchanged for an existing single-loop run.

**Acceptance.** Every drill selection carries a deterministic identity, full fight stays on the base identity, and attempt comparisons never mix loop and one-shot or different phase sets.

### Execution record

Implemented on 2026-11-02 in the working tree; nothing was committed, pushed or deployed.

Commands run from `app/`:

- `npx vitest run src/game/config/drill.test.ts` — first run failed with `Cannot find module './drill'`; after implementation, 12 tests passed.
- `npx vitest run src/game/simulation/drill.test.ts` — 19 tests passed.
- `npx vitest run src/game/simulation/phases.test.ts src/game/simulation/simulation.test.ts src/game/config/config.test.ts` — 310 tests passed.
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`.

Drill matrix evidence from `src/game/simulation/drill.test.ts`:

- single phase, Loop on: re-enters the same phase and resets health to its entry fraction;
- single phase, Loop off: clears after one exit;
- group `[1, 3]`, Loop on: `1 -> 3 -> 1 -> 3`;
- group `[1, 3]`, Loop off: `1 -> 3`, then `cleared`;
- group `[1, 3, 5]` with non-contiguous indices: `1 -> 3 -> 5 -> 1`;
- phase 8, Loop on: resets at health zero and re-enters instead of clearing;
- phase 8, Loop off: health zero clears;
- group ending at phase 8, Loop on: wraps to its first selected phase at health zero;
- group ending before phase 8, Loop off: clears at the last selected phase exit;
- a phase-driven minion in the same fight still advances monotonically;
- fired shards survive a drill jump and only `despawnOnExit` minions disappear.

Rulings and deviations:

- **Legacy aliases keep their old transition semantics.** The controller ruling requires `startPhaseIndex`/`loopPhase` to behave exactly as before for existing callers and tests. `startPhaseIndex` without `loopPhase` therefore still starts in that phase and continues authored progression (`state.drill` stays `null`), and keeps its old `-drill-p<N>` rules version. `loopPhase: true` normalizes to `{ phaseIndices: [N], loop: true }`. The explicit `drill` option is the new one-shot/group model. This is a deliberate deviation from the step 29.1 wording that every alias becomes a `DrillSelection`; the alternative would break the existing "without loopPhase, the same drilled phase's exit advances normally" test and the Queen's start-and-continue tests.
- **`drillRulesVersion` was implemented in step 29.1**, as the controller directed, so the opening enemy's identity is available to the step 29.1 focused check. Step 29.3 added the full identity/history matrix.
- **`EncounterScene.setLoopPhase`** now writes `state.drill` from the current primary phase and keeps its method signature. It does not change `rulesVersion`, matching the old debug toggle.
- **No `SessionController.applyDrill`** was added; the plan assigns it to phase 31.
- **Process note:** the config-level drill tests were written and seen failing before `drill.ts` existed. The simulation matrix tests were added after the transition implementation rather than being seen failing first; they exercise the new paths and all pass.

### Fix round 1

Addressed the three reviewer findings and the optional M4 cleanup.

- **C1 — minion health-zero clear survives a primary drill jump.** `tryAdvancePhase` now captures `enemy.healthHp === 0` before `enterDrillPhase` and only resets `"cleared"` to `"playing"` when the primary's own health reached zero. Regression test `a minion's health-zero clear survives a primary drill jump` in `src/game/simulation/drill.test.ts` failed before the fix with `expected 'playing' to be 'cleared'` and passes after it.
- **I1 — explicit `drill: null` is the full fight.** `hasExplicitDrill` is now `options.drill !== undefined`, so an explicit `null` is authoritative and legacy aliases do not win. Regression test `an explicit null drill is the full fight even with legacy aliases` failed before the fix with `expected { phaseIndices: [2], loop: true } to be null` and passes after it.
- **I2 — non-`despawnOnExit` minion presence.** The `a phase-driven minion in the same fight still advances monotonically` test now asserts the held minion is still present in `state.enemies` after the primary's drill jump; the existing shards test already asserts the `despawnOnExit` minion is gone. This was a coverage gap, not a behavioural regression.
- **M4 — `setLoopPhase` no-enemy/false behaviour.** `setLoopPhase` now assigns `state.drill = enabled && enemy ? { phaseIndices: [enemy.phaseIndex], loop: true } : null`, so `enabled: false` with no primary enemy still clears the drill. The signature is unchanged.

Commands run from `app/`:

- `npx vitest run src/game/simulation/drill.test.ts` — first run after adding the regressions: 2 failed, 19 passed (C1 and I1 failed as expected); after the fixes: 21 passed.
- `npx vitest run src/game/simulation/drill.test.ts src/game/config/drill.test.ts src/game/simulation/phases.test.ts src/game/simulation/simulation.test.ts src/game/config/config.test.ts` — 5 files, 343 tests passed.
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`.

No commit, push or deployment was made.



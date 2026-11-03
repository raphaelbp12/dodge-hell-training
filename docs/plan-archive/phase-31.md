# Phase 31: The Live Panel And Apply

> This phase belongs to [plan V7](../implementation-plan-v7.md). Read [the implementation plan](../../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 31 adds the live phase panel and the Apply action: opening pauses, Close resumes, Apply restarts at the first selected phase and keeps the panel open and paused, the active phase is shown, the panel closes on a result, and the old debug-panel phase drill is removed.

### Step 31.1 - Add Session And Encounter Apply APIs

Status: complete. Dependencies: 29.3.

**Implementation prompt.** Extend the session and engine adapter:

- `SessionController.applyDrill(drill: DrillSelection | null)` updates the stored drill options, rebuilds the simulation with `initialize(0)` (new attempt, fresh seed, no countdown), and then pauses the session so the panel can stay open. It must not save an abandoned previous attempt.
- `EncounterHandle` gains `pause(): void` and `applyDrill(drill: DrillSelection | null): void`. `EncounterScene.pause()` pauses the session and publishes the view. `EncounterScene.applyDrill()` calls the session, clears hit numbers, bomb effects and audio state like Retry, redraws, recenters, and publishes. The new attempt stays paused.
- `EncounterView` gains `phaseIndex`, `phaseLabel`, `phaseCount` and `drill`. Derive them from the primary enemy's current phase and `state.drill`; use the phase label helper from `game/config/drill.ts`. The view is still published at the existing HUD cadence, not per frame.
- Extend the test-only `inspect()` payload with the same phase/drill fields only if a Playwright case needs them; otherwise the view/DOM is enough.
- Do not add a second clock or a per-frame React update. The panel reads the latest view.

**Focused checks.** Add failing-first tests for:

- `applyDrill` creates a new attempt, starts at the first selected phase, uses the drill identity, and leaves the session paused;
- `applyDrill(null)` restarts a full fight paused;
- the previous attempt is abandoned without a result entry;
- `view.phaseIndex`/`phaseLabel`/`phaseCount` follow the primary enemy and `drill` follows the selection;
- the existing Retry/Resume behavior is unchanged.

**Acceptance.** The session and scene can apply a drill while paused, the view identifies the active phase, and no new clock or React frame path exists.

### Step 31.2 - Integrate The Live Panel And Pause Lifecycle

Status: complete. Dependencies: 31.1 and 30.1.

**Implementation prompt.** In the live `Encounter` component:

- add a "Phases" button to the gameplay HUD actions, with `aria-expanded`/`aria-controls`; hide or disable it when the attempt has a result;
- render the shared `PhaseSelector` in live mode as an aside; its `drill` comes from the App-owned selection and its `onChange` updates that selection;
- opening the panel calls `pause()`; closing it calls `resume()`; Apply calls `applyDrill(drill)` and leaves the panel open and the new attempt paused;
- the active row uses `view.phaseIndex`/`view.phaseLabel`;
- when `view.result` appears, close the panel (20.b); Retry keeps the selection but does not reopen the panel;
- opening Controls closes the phase panel and opening the phase panel closes Controls, so two overlays never stack;
- the panel uses the same right-hand aside styling as the Home panel and does not cover the results dialog.

The App passes the current `drill` and an `onDrillChange` callback into `Encounter`; the Encounter owns the live panel's open state because it owns the view and handle.

**Focused checks.** Add one targeted Playwright case for:

- opening the panel pauses the encounter and shows the active phase;
- Apply restarts at the first selected phase, keeps the panel open and the session paused;
- Close resumes;
- a result closes the panel;
- Retry keeps the selection;
- the Home reset and the session-only behavior still hold.

Use the existing `inspect`/HUD helpers; do not run the full suite.

**Acceptance.** The live panel is controllable with mouse and keyboard, pausing/resuming follows the session, Apply uses the current selection, and the results/Retry/Home lifecycle matches R09/R10.

### Step 31.3 - Remove The Debug Phase Drill

Status: complete. Dependencies: 31.2.

**Implementation prompt.** Remove the `Phase drill` fieldset from `DebugPanel` in `app/src/App.tsx`: the phase select, the "Loop this phase" checkbox and the now-unused `PHASE_COUNT`. Remove `jumpToPhase` and `setLoopPhase` from `EncounterHandle` and the scene if nothing else calls them. Keep the Crystal Worm stat tuning, the debug toggles and the "Next sub-phase" action (R14).

Update the Debug panel's accessible labels/tests so the remaining controls are unambiguous and the new phase panel owns phase selection.

**Focused checks.** Add or update tests for:

- the Debug panel no longer exposes "Jump to phase" or "Loop this phase";
- "Next sub-phase" still works for a Queen drill and is a no-op for a phase without sub-phases;
- the phase panel still exposes Full fight, phase checkboxes, Loop, Apply/Close in live mode.

**Acceptance.** There is exactly one phase-selection control, the Debug panel remains useful for Crystal Worm tuning and sub-phase debugging, and no dead handle methods or constants remain.

### Execution record

Implemented on 2026-11-03 in the working tree; nothing was committed, pushed or deployed. The phase and plan index status lines were left untouched for the controller's review. This record was corrected in fix round 1 after the QA and strict-review findings.

Files changed by Phase 31:

- `app/src/game/session/session.ts` — added `applyDrill(drill: DrillSelection | null)`, which stores the drill, calls `initialize(0)` for a fresh attempt and seed, then pauses. Its guard accepts only a live attempt (`playing` or `paused`), so Home and an ended attempt cannot be resurrected. The abandoned attempt never writes a result.
- `app/src/game/session/session.test.ts` — restored every existing test from HEAD (19 cases, 260 deleted lines) and added five failing-first `applyDrill` cases: a new attempt at the first selected phase with the drill identity and paused state; a full fight paused for `applyDrill(null)`; the abandoned attempt incrementing the attempt id with no result; a fresh seed from the injected supplier; and the Home/ended no-op guard. The file now has 24 passing cases, not the three reported in round 0.
- `app/src/game/phaser/view.ts` — new pure helper `phaseViewOf(state)` that derives the primary phase index, label, authored phase count and active drill without importing Phaser.
- `app/src/game/phaser/view.test.ts` — focused coverage for the derivation, including a Queen phase 3 label and the missing-primary fallback.
- `app/src/game/phaser/encounter.ts` — added `pause()`, `applyDrill(drill)`, the four new `EncounterView` fields (`phaseIndex`, `phaseLabel`, `phaseCount`, `drill`), and the `publishView` derivation through `phaseViewOf`. `applyDrill` reuses the Retry cleanup path (hit numbers, bomb effects, audio, movement, HUD timer), redraws, recenters and publishes. Removed the debug-only `jumpToPhase`/`setLoopPhase` handle methods.
- `app/src/ui/PhaseSelector.tsx` — the shared selector supports `mode: "live"` with the read-only "Now playing" row, the Apply action, the live overlay class, heading focus on open and an Escape handler.
- `app/src/ui/PhaseSelector.module.css` — new live `.live` overlay rule; the Home panel is unchanged.
- `app/src/ui/PhaseSelector.test.tsx` — new unit coverage for the `activePhaseLabel` override, the live controls and Escape not leaking to the window.
- `app/src/App.tsx` — the live `Encounter` owns the phase panel's open state and adds the "Phases" HUD button with conditional `aria-expanded`/`aria-controls`, pauses on open, resumes on close, applies the current drill and leaves the panel open and paused, closes on a result, keeps the Retry selection without reopening, and makes Controls, Debug and the phase panel mutually exclusive. HUD Resume and Retry close the panel first. `Start` clears a Home Debug aside before launching. Removed the `Phase drill` fieldset (phase select, "Loop this phase" checkbox, unused `PHASE_COUNT`) from `DebugPanel`; kept Crystal Worm tuning, debug toggles and "Next sub-phase".
- `app/src/App.module.css` — `liveLayout` is positioned for the overlay and the hidden-action styling keeps the HUD actions out of the results dialog; the Home panel is unchanged.
- `app/src/App.test.tsx` — a faithful adapter mock (`pause`, `applyDrill`, `advanceSubPhase`) plus live-panel unit tests for open/pause, close/resume, Escape, Apply, result close and inert actions, Retry selection, Home reset, Controls/phase exclusion, Crystal Worm Debug/phase exclusion, HUD Resume/Retry closing the panel, and the removed debug controls.
- `app/src/game/simulation/phases.test.ts` — Phase 31 tests: a Queen drill advances a sub-phase through `forceNextSubPhase`, and the Crystal Worm's sole phase is a no-op.
- `app/tests/app.spec.ts` — the targeted live-panel Playwright case now also asserts the overlay layout (arena/canvas stay full width, panel overlays the right 320 px, camera stays on the player), asserts the "Now playing" text after Apply and captures `live-phase-panel.png` after Apply; a second targeted case covers the Crystal Worm Debug panel dropping "Jump to phase"/"Loop this phase" and keeping "Next sub-phase" a no-op.
- `docs/plan/phase-31.md` — this execution record.
- `.superpowers/sdd/plan-v7/phase-31-report.md` — the corrected report.
- `.superpowers/sdd/plan-v7/phase-31-artifacts/live-phase-panel.png` — recaptured after Apply; it shows the panel over the full 1280 px playfield with "Phase 3 - Pond Barrage" in "Now playing".

Prior-phase or pre-existing working-tree changes, not part of Phase 31:

- Phase 29/30 drill work: `app/src/game/models.ts`, `app/src/game/simulation/phases.ts`, `app/src/game/simulation/simulation.ts`, `app/src/game/config/drill.ts`, `app/src/game/config/drill.test.ts`, `app/src/game/simulation/drill.test.ts`.
- Plan/agent bookkeeping: `.gitignore`, `docs/deferred-work.md` (D16-D18), `implementation-plan.md`, `docs/plan-v7.md` and `docs/plan/`.
- `app/.vitest/` is transient Vitest JSON output, not source.
- `app/src/ui/` was created during Phase 30; Phase 31 edited the selector files listed above.
- The QA audit spec and the screenshot probe were transient, were not part of the implementation, and were deleted by QA; no audit spec remains in the working tree.

Commands run from `app/`:

- `npx vitest run src/game/session/session.test.ts` — 24 tests passed (19 restored + 5 new).
- `npx vitest run src/game/session/session.test.ts src/App.test.tsx src/ui/PhaseSelector.test.tsx src/game/phaser/view.test.ts src/game/simulation/phases.test.ts` — 5 files, 112 tests passed.
- `npm run test:e2e -- --grep "the live phase panel pauses|the Crystal Worm Debug panel"` — 2 passed (12.2 s): the existing live-panel case (10.1 s) and the new Crystal Worm Debug case (2.6 s).
- `npm run test:e2e -- --grep "the live phase panel pauses, applies, resumes, and handles result/retry/home"` — 1 passed (9.6 s; 11.6 s total).
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`. The test gate reports 22 files and 818 tests passing.

Acceptance evidence:

- `applyDrill` starts a new attempt with a fresh seed and no countdown and leaves the session paused; the previous attempt produces no result entry and the attempt id increments. Home and ended attempts are rejected.
- The live view publishes the primary enemy's current phase and the active drill at the existing 100 ms HUD cadence; `phaseViewOf` is unit-tested without Phaser. No per-frame React update or second clock was added.
- Opening the panel pauses; the panel focuses its heading; Escape closes it and resumes; Apply restarts at the selected phase and leaves the panel open and paused; Close resumes; HUD Resume/Retry close the panel first; a result closes it through the unit test; Retry keeps the selection without reopening; Home resets it.
- The live panel overlays the right 320 px without shrinking the arena or the Phaser canvas, and the camera stays centred on the player.
- The Debug panel no longer exposes a phase drill. The 31.3 ruling is: keep the Debug panel Crystal-Worm-only; the encounter-agnostic `forceNextSubPhase`/`advanceSubPhase` action is covered for a Queen drill at the simulation level, and the Crystal Worm's Debug button is covered as a no-op. The Debug panel was not extended to the Queen.

Deviations and rulings:

- The user ruled that phase 31.3's "Next sub-phase still works for a Queen drill" means the encounter-agnostic simulation action, not a Queen Debug panel. The tracked suite now has a Queen simulation test and a Crystal Worm no-op test.
- The user ruled that HUD Resume and Retry close the live panel first; both are implemented and unit-tested.
- The user ruled that the live panel overlays the playfield instead of shrinking the arena. The arena and canvas stay 1280 px and the panel overlays the right 320 px.
- Keyboard focus moves to the panel heading on open and Escape closes the panel. Focus is not restored to the "Phases" button on close because that would pull focus out of the arena, and the standing focus-pause policy would immediately pause the attempt again, contradicting R09's "Close resumes". The scene's `resume()` focuses the arena as before; this conflict is recorded in the fix report.
- `aria-controls="phase-selector"` is set only while the panel is open, so the button never advertises a missing IDREF.
- `applyDrill` is guarded to `playing`/`paused`, so Home and `ended` cannot restart via the session API.
- M5 (Full fight radio inside the checkbox fieldset) and M6 (duplicated aside CSS) are prior non-blocking concerns and were documented, not reworked.

Concerns:

- The live panel's "Phases" button is hidden once a result exists; the results dialog's Retry/Home actions remain the only way out. This matches the phase's instruction to hide or disable it on a result.
- The drill's one-shot completion timing depends on the authored phase duration; the Playwright case uses Phase 3 and advances the clock in 1 s steps, so a future change to that phase's length could affect the test's timing, though the 70 s poll window leaves headroom.
- Restoring focus to "Phases" would re-pause the attempt under the current focus-pause policy; see the deviation above.

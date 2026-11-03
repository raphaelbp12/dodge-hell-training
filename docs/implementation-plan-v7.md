# V7 Implementation Plan Archive

Historical v7 design and completed phases 29-32, archived on 2026-11-03. Read [the implementation plan](../implementation-plan.md) for pending work and current decisions. This archive is evidence, not a queue of steps to rerun.

Phases 29-32 added the shared phase selector, the drill-set model with Loop and one-shot semantics, group transitions, final-phase looping, URL deep links and drill-specific attempt identities, and removed the old debug-panel phase drill. No gameplay value, phase or encounter was added or retuned. Decisions R01-R18 below remain in force wherever a later plan does not supersede them.

# Plan V7: The Phase Selector And Drill Sets

This is the plan-specific record for the current planning effort. [`implementation-plan.md`](../implementation-plan.md) holds the reusable process (execution modes, phase lifecycle, how to read a phase prompt) that governs every plan version, including this one; read it first if you have not already this session.

Phases 29-32 add a player-facing **phase selector** to every encounter: a panel on Home and in the live encounter, a phase-set drill model with a Loop toggle, group loops, finite one-shot drills, final-phase looping, URL deep links, drill-specific attempt identities, and the removal of the old debug-panel phase drill. No new encounter, phase, projectile, condition, tuning value or stat slider is added.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process. It is not authorization to implement a phase by itself.
- This file: the decisions and approved technical approach for phases 29-32. Later explicit user decisions override older statements; record changes here.
- [The V6 archive](implementation-plan-v6.md): the completed projectile-appearance and hitbox work, including the live drill URL and the debug phase-jump behaviour this plan extends.
- [The mechanics contract](mechanics.md): the encounter, phase-machine and drill rules that remain in force. This plan records its drill additions there during phase 32.
- [The deferred register](deferred-work.md): D16, D17 and D18 record the sub-phase, persistence and results-screen work this plan deliberately leaves out.
- [The project instructions](../AGENTS.md): the architecture boundaries, TDD rule and verification policy.

## Completed Baseline

Phases 1-28 are complete. The deployed runtime is the V6 release: the Crystal Worm under `crystal-worm-child-swarm-paladin-v4`, the Killer Bee Queen under `killer-bee-queen-nest-paladin-v7`, the projectile appearance catalog and compound hitboxes. The existing drill support is:

- `?phase=<index>&loop=1` starts the primary enemy in one top-level phase and re-enters it on exit.
- The debug panel has a Crystal Worm-only phase jump and loop checkbox; its phase count is hardwired to the Crystal Worm.
- `SimulationState.loopPhaseIndex` can hold only one phase, and the final authored phase never loops because the phase machine returns before the loop check.
- Entering a drill phase resets health to the phase entry fraction, uses the normal phase-entry path, despawns only authored `despawnOnExit` minions, and leaves fired shards alive.

## Approaches Considered

1. **Extend the existing debug panel only.** Smallest code change, but the panel is Crystal Worm-only, is framed as developer tooling, and cannot be configured on Home. Rejected.
2. **URL-only group support.** Add `?phase=1,3,5` and leave the UI alone. No player-facing panel and no live selection; rejected by the request.
3. **A first-class shared phase selector with a drill-set model.** One presentational panel on Home and in the live encounter, backed by a simulation-level phase set and Loop flag. This is the chosen approach: it satisfies the request, keeps one source of truth, and removes the old debug drill.

The phase selector is a training control, not a stat-tuning UI. It changes which authored phases are played, never the values inside them.

## Confirmed Design

The V6 confirmed design stands in every respect not listed here. In particular, no gameplay value, projectile, condition, hitbox, encounter or authored phase changes.

Phases 29-32 add exactly these elements, and nothing else:

- **A shared phase-selector panel.** It is available on Home and in the live encounter for the currently selected encounter. It lists every top-level phase, offers an explicit Full fight option, phase checkboxes, a Loop toggle and, in live mode, an Apply action and a read-only active-phase row.
- **A drill-set model.** A drill is a sorted, unique set of top-level phase indices plus a Loop flag. With Loop on, the selected phases repeat in authored order. With Loop off, they play once and the attempt clears when the last selected phase exits.
- **Group jumps.** When a selected phase exits, the primary enemy jumps to the next selected phase, wraps to the first when Loop is on, or clears when Loop is off. The final authored phase can loop by resetting its health to its entry fraction instead of clearing.
- **Normal phase-entry semantics.** Every jump uses `enterDrillPhase`: health resets to the target phase's entry fraction, telegraphs and invulnerability apply, authored exit minions despawn, fired shards persist, and only the primary enemy is drilled.
- **A Loop toggle.** Loop on repeats the selected set; Loop off plays it once and clears at the last selected phase exit. A single phase without Loop is therefore a finite one-shot drill, not the old start-and-continue behaviour.
- **URL deep links.** `?phase=` accepts a comma-separated list and `loop=1` turns looping on. The single-value form remains valid; invalid or out-of-range lists fall back to Full fight.
- **Drill-specific identities.** Full fight uses the encounter's base rules version. A single loop keeps `-drill-p<N>`, a single one-shot adds `-once`, a group loop uses `-drill-p<a-b-c>`, and a group one-shot appends `-once`.
- **Live panel behaviour.** Opening pauses the encounter, Close resumes, Apply starts a fresh attempt at the first selected phase and keeps the panel open and paused, and the panel closes when the attempt ends. Retry keeps the selection; returning Home or reloading resets it.
- **Debug cleanup.** The developer Debug panel loses its phase select/loop control and keeps its Crystal Worm stat tuning and its "Next sub-phase" debug action.

Nothing else is added. In particular: no sub-phase rows, no persistence in localStorage, no panel over the results screen, no encounter selector inside the panel, no new authored phases, no stat sliders, and no changes to the Crystal Worm's single phase.

### Supersessions

- **The old `?phase=N` without `loop=1` behaviour is superseded.** It used to start at phase N and continue through the authored phases to the encounter's real end. It now means a single-phase one-shot drill that clears when phase N exits. The Loop toggle makes the distinction explicit.
- **The old debug-panel phase jump is removed.** The new panel's Apply is the player-facing replacement; the debug panel keeps only the Crystal Worm stat controls and the next-sub-phase action.
- **The old `-drill-pN` identity remains the single-loop identity.** One-shot drills use the new `-once` suffix, so future finite drills do not mix with looped attempts under the same name.

## Recorded User Decisions - 2026-11-02

- **R01 - One shared panel on Home and in the live encounter.** The panel lists phases for the currently selected encounter; the encounter radio list stays on Home. It is not a second Home screen and does not switch encounters.
- **R02 - Home sets the selection; Start launches it.** The Home panel has no Apply action. In the live encounter, Apply restarts the attempt at the first selected phase.
- **R03 - Selected phases play in authored order.** Click order does not matter; the set is sorted before it is stored or displayed.
- **R04 - Loop is a toggle.** Loop on repeats the selected set. Loop off plays the set once and marks the attempt cleared when the last selected phase exits. A single phase with Loop off is one finite drill.
- **R05 - The final authored phase can loop.** When a looped selection reaches the final phase's health-zero exit, its health resets to the phase entry fraction and the selection continues instead of clearing. With Loop off, the final phase clears normally.
- **R06 - Only top-level phases are selectable.** Selecting a phase includes its authored sub-phase cycle; individual colour sub-phases are deferred as D16.
- **R07 - `?phase=` accepts a comma-separated list.** `loop=1` turns looping on; its absence means one-shot. The single-value form remains valid. An invalid or out-of-range list falls back to Full fight.
- **R08 - Drill identities are selection- and loop-specific.** Full fight uses the base rules version; single loop keeps `-drill-pN`; single one-shot uses `-drill-pN-once`; a group loop uses `-drill-p<a-b-c>`; a group one-shot appends `-once`. Attempt history therefore never compares a loop with a one-shot or two different phase sets.
- **R09 - Opening the panel pauses; Close resumes.** The panel stays open across Apply and is not a modal. Apply starts a new attempt and leaves it paused behind the panel.
- **R10 - Selector state is session-only.** The open state, selection and Loop toggle reset when returning Home or reloading. A URL deep link is the explicit reload path.
- **R11 - Phase labels are derived from authored ids.** `phase-3-pond-barrage` becomes "Phase 3 - Pond Barrage"; an id without a numeric prefix falls back to "Phase <index + 1>". No new authored display names.
- **R12 - Full fight is explicit.** The panel has a Full fight choice; a custom selection requires at least one phase. The Loop toggle is disabled while Full fight is selected.
- **R13 - Transitions use the normal phase-entry path.** Health resets to the target phase's entry fraction, authored exit minions despawn, fired shards persist, and only the primary enemy is drilled. No clean-slate clearing.
- **R14 - The debug panel loses its phase select/loop.** The new panel owns phase selection. The Crystal Worm debug panel keeps its stat tuning and its "Next sub-phase" action, which is a debugging action rather than a player drill control.
- **R15 - The panel shows the active phase.** In live mode a read-only "Now playing" row highlights the current top-level phase, using the same derived label.
- **R16 - Apply uses a fresh seed.** It behaves like Retry: a new attempt with a new injected seed. `?seed=` still pins a reproducible opening.
- **R17 - Panel placement and defaults are our call.** Reuse the existing right-hand aside layout; open the panel with a "Phases" button; default the Loop toggle on when a phase is first selected; unchecking the last phase returns to Full fight; changing the encounter on Home resets the selection to Full fight.
- **R18 - No new phases or values.** The Crystal Worm keeps its single phase, the Queen keeps its eight, and the selector adds no gameplay tuning.

## Drill Semantics

| Selection | Loop on | Loop off |
| --------- | ------- | -------- |
| Single phase N | Re-enter N on every exit; at phase 8 health zero reset to phase 8's entry fraction | Play N once; clear when N exits; phase 8 clears at health zero |
| Group [a, b, c] | a -> b -> c -> a; at the final phase's health-zero exit wrap to the first selected | a -> b -> c; clear when c exits; if c is phase 8, clear at health zero |
| Full fight | Normal authored progression to the real end | Normal authored progression to the real end |

Every jump uses `enterDrillPhase`, so health, telegraphs, invulnerability, minions and shards follow the existing phase-entry rules.

## Architecture

The V6 boundary table stands. Ownership for the new concepts:

| Boundary | Home under `app/src` | Owns |
| -------- | -------------------- | ---- |
| Models | `game/models.ts` | `DrillSelection` and the active drill on simulation state |
| Configuration/derivation | `game/config/drill.ts` | Parsing `?phase=`/`loop`, normalizing indices, labels, rules-version suffixes |
| Simulation | `game/simulation/simulation.ts`, `phases.ts` | Drill start, group jumps, finite clear, final-phase loop |
| Session | `game/session/session.ts` | Applying a new drill to a live attempt, paused, with a fresh seed |
| Engine adapter | `game/phaser/encounter.ts` | `pause`, `applyDrill`, active-phase view fields, live panel host |
| Web components | `App.tsx`, `ui/PhaseSelector.tsx` | Home panel, live panel, header/HUD buttons, Full fight, checkboxes, Loop, Apply/Close |
| Persistence | none | Selector state is session-only; only the existing attempt history changes |

The React panel reads counts and labels from configuration and the live phase from `EncounterView`; it never drives per-frame simulation. The simulation remains free of React, Phaser and DOM imports. There is one clock and one phase machine.

## Target Data Shapes

```ts
// game/models.ts
export type DrillSelection = Readonly<{
  /** Sorted, unique, authored top-level phase indices. Nonempty when present. */
  phaseIndices: readonly number[];
  loop: boolean;
}>;
```

```ts
// game/simulation/simulation.ts
export type CreateSimulationOptions = Readonly<{
  /** The drill to start and loop; absent means the normal full fight. */
  drill?: DrillSelection | null;
  /** Legacy aliases accepted at the boundary for existing callers/tests. */
  startPhaseIndex?: number;
  loopPhase?: boolean;
}>;

export type SimulationState = Readonly<{
  // existing fields
  drill: DrillSelection | null; // replaces loopPhaseIndex
}>;
```

```ts
// game/config/drill.ts
export function parseDrillFromLocation(
  config: EncounterConfig,
  search?: string,
): DrillSelection | null;

export function drillRulesVersion(
  baseRulesVersion: string,
  drill: DrillSelection | null,
): string;

export function nextDrillPhaseIndex(
  drill: DrillSelection,
  currentIndex: number,
): number | null; // null means the one-shot selection is finished
```

```ts
// game/phaser/encounter.ts
export type EncounterView = {
  // existing fields
  phaseIndex: number;
  phaseLabel: string;
  phaseCount: number;
  drill: DrillSelection | null;
};

export type EncounterHandle = {
  // existing methods
  pause(): void;
  applyDrill(drill: DrillSelection | null): void;
};
```

```ts
// ui/PhaseSelector.tsx
type PhaseOption = Readonly<{ index: number; id: string; label: string }>;
type PhaseSelectorProps = Readonly<{
  mode: "home" | "live";
  phases: readonly PhaseOption[];
  drill: DrillSelection | null;
  activePhaseIndex?: number;
  onChange: (drill: DrillSelection | null) => void;
  onApply?: () => void;
  onClose: () => void;
}>;
```

## Approved Scope And Review Gates

- The selector changes only which authored phases are played and whether the set loops. No gameplay value, projectile, hitbox, condition, phase or encounter is added or retuned.
- The Crystal Worm keeps one phase and the Queen keeps eight. No new authored phases or display names.
- The panel is a training control, not a stat-tuning UI. It does not expose projectile, damage, speed or cadence values.
- Every drill jump uses `enterDrillPhase` and the normal phase-entry path. Do not add a second phase machine or a clean-slate shard/minion clear.
- Only the primary enemy is drilled. Minions advance normally.
- Loop off must clear at the last selected phase's exit; loop on must wrap in authored order; phase 8 must be loopable only in drill mode by resetting its health at the zero boundary.
- Attempt identities must separate loop from one-shot and different phase sets. Do not mix them under one rules version.
- Selector state is session-only. Do not add localStorage, a results-screen panel or a sub-phase selector; see D16-D18.
- The existing focus-pause and one-clock policies stand. The live panel pauses through the session, not a second clock.
- The old `?phase=N` start-and-continue behaviour is superseded by one-shot. Record the supersession in the mechanics contract and README.
- Focused Vitest tests per step; `npm run verify` at the end of each phase; targeted Playwright only for the Home panel, live Apply/Close and a group loop. Do not run the full Playwright suite unless requested.

## Phase Index

| Phase | Steps | Outcome | Gate | Status |
| ----- | ----- | ------- | ---- | ------ |
| 29 | 29.1-29.3 | Drill-set model, group transitions, finite clear, final-phase loop and identities | G15 | Complete: drill set, group jumps, one-shot clear, final-phase loop and identities implemented and covered. |
| 30 | 30.1-30.3 | Shared phase-selector panel, Home integration and URL parsing | G16 | Complete: shared selector, Home integration, comma-separated `?phase=` parsing and the Home browser case. |
| 31 | 31.1-31.3 | Live Apply/Close, pause/resume, active readout and debug cleanup | G17 | Complete: live panel, Apply/pause lifecycle, active readout, overlay layout and debug cleanup. |
| 32 | 32.1-32.2 | Acceptance matrix, documentation and handoff | G18 | Complete: every matrix row passed, targeted Chromium cases passed, docs and phase archive updated. |

## Phase 29: Drill Sets And Phase Transitions

Status: complete. Outcome: the simulation-level drill set, group jumps, finite one-shot clear, final-phase loop and drill identities are implemented and covered by focused tests; the legacy aliases keep their old behaviour.

- [Step 29.1 - Normalize The Drill Selection Model](plan-archive/phase-29.md#step-291---normalize-the-drill-selection-model)
- [Step 29.2 - Implement Group Transitions And Finite Clear](plan-archive/phase-29.md#step-292---implement-group-transitions-and-finite-clear)
- [Step 29.3 - Add Drill Identities And History Separation](plan-archive/phase-29.md#step-293---add-drill-identities-and-history-separation)

## Phase 30: The Phase Selector On Home

Status: complete. Outcome: the shared phase selector, Home integration, comma-separated `?phase=` parsing, session-only reset behavior and the targeted Home browser case are implemented; the strict reviewer's repeated-parameter and inventory findings were fixed in round 1.

- [Step 30.1 - Build The Shared Phase Selector](plan-archive/phase-30.md#step-301---build-the-shared-phase-selector)
- [Step 30.2 - Integrate Home, Start And The URL](plan-archive/phase-30.md#step-302---integrate-home-start-and-the-url)
- [Step 30.3 - Cover The Home Selector](plan-archive/phase-30.md#step-303---cover-the-home-selector)

## Phase 31: The Live Panel And Apply

Status: complete. Outcome: the live phase panel and Apply, the pause/resume lifecycle, the active readout, the debug cleanup, the overlay layout and the missing coverage are implemented; the QA and strict code re-reviews are satisfied.

- [Step 31.1 - Add Session And Encounter Apply APIs](plan-archive/phase-31.md#step-311---add-session-and-encounter-apply-apis)
- [Step 31.2 - Integrate The Live Panel And Pause Lifecycle](plan-archive/phase-31.md#step-312---integrate-the-live-panel-and-pause-lifecycle)
- [Step 31.3 - Remove The Debug Phase Drill](plan-archive/phase-31.md#step-313---remove-the-debug-phase-drill)

## Phase 32: Acceptance, Documentation And Handoff

Status: complete. Outcome: the selector acceptance matrix and the five named Chromium cases passed, the V6 full-fight, peak-shard and 30/60/120 Hz determinism results are unchanged, the README and mechanics contract record the selector contract, D16-D18 remain deferred, and phases 29-32 are archived.

- [Step 32.1 - Run The Selector Acceptance Matrix](plan-archive/phase-32.md#step-321---run-the-selector-acceptance-matrix)
- [Step 32.2 - Document And Hand Off](plan-archive/phase-32.md#step-322---document-and-hand-off)

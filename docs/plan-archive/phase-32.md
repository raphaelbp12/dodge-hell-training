# Phase 32: Acceptance, Documentation And Handoff

> This phase belongs to [plan V7](../implementation-plan-v7.md). Read [the implementation plan](../../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 32 proves the selector matrix, checks that the live panel did not disturb the one-clock/one-phase-machine contracts, and closes the documentation.

### Step 32.1 - Run The Selector Acceptance Matrix

Status: complete. Dependencies: 31.3.

**Implementation prompt.** Run the complete selector matrix in the headless simulation and the named browser cases:

- Full fight: the normal encounter still clears at its authored end and keeps the base rules version.
- Single phase, Loop on and off: repeat and one-shot clear, with the correct identity and health reset.
- Group `[1,3]` and a non-contiguous group `[1,3,5]`: authored order, wrap/clear, correct identity.
- Final phase 8 alone and as the last selected phase: loop resets health; one-shot clears.
- A group ending before phase 8, Loop off: `cleared` at the last selected exit.
- The primary-only rule: a phase-driven minion in the same fight still advances monotonically.
- Normal transition semantics: fired shards survive; only `despawnOnExit` minions disappear.
- Browser: Home selection -> Start; live panel open/pause, Apply, Close/resume; result closes the panel; Retry keeps the selection; Home resets it.
- The full fight still prints the same elapsed time, peak shards and deterministic 30/60/120 Hz result as V6. The panel adds no per-frame simulation work; do not widen a performance bound.

Run `npm run verify` from `app/` once and the targeted Playwright cases. Do not run the full Playwright suite unless the user asks for an acceptance run.

**Focused checks.** The matrix is covered by focused Vitest cases from phases 29-31 and the named Playwright cases from 30.3/31.2. Record the exact commands, the matrix results and any blocker in the phase execution record.

**Acceptance.** Every matrix row has a passing check, the V6 full-fight/determinism results are unchanged, and no performance bound was relaxed.

### Step 32.2 - Document And Hand Off

Status: complete. Dependencies: 32.1.

**Implementation prompt.** Update the documentation:

- [README](../../README.md): the phase selector, Full fight vs custom phases, the Loop toggle and its one-shot meaning, the comma-separated `?phase=` form, the drill rules identities, the debug-panel cleanup, and the fact that selector state is session-only.
- [The mechanics contract](../mechanics.md): the drill-set contract, the supersession of the old `?phase=N` start-and-continue behavior, the final-phase loop reset, normal phase-entry semantics, the primary-only rule and the rules-version suffixes.
- [The deferred register](../deferred-work.md): keep D16 (sub-phase selection), D17 (persistence) and D18 (results-screen panel) accurate; do not mark any complete.
- The phase file records and the plan's Phase Index as phases 29-32 complete; archive completed phase files under `docs/plan-archive/` following the implementation plan. Update the Current Plan row for V7 only when the whole plan is complete.
- Do not commit, push or deploy.

**Focused checks.** `npm run verify` must print a pass for lint, typecheck, test and build. The targeted Playwright cases must pass. The documentation must not claim that sub-phase selection, persistence across reloads or a results-screen panel exists.

**Acceptance.** All gates pass, the selector contract is recorded in one place per topic, the deferred items are accurate, and no approval or fidelity claim is overstated.

### Execution record

Implemented on 2026-11-03 in the working tree; nothing was committed, pushed or deployed. The phase's own statuses, the plan index and the archive moves were completed in this record; the controller's QA and strict code re-reviews run afterwards.

#### Commands and results

All commands were run from `app/`:

- `npx vitest run src/game/config/drill.test.ts src/game/simulation/drill.test.ts src/game/simulation/phases.test.ts src/game/session/session.test.ts src/App.test.tsx src/ui/PhaseSelector.test.tsx src/game/phaser/view.test.ts` — **7 files, 164 tests passed** (7.14 s).
- `npx vitest run src/game/config/config.test.ts -t "full fight"` — **4 passed, 142 skipped** (34.60 s); this runs the all-eight-phases clear, the live-shard bound, the determinism and the fight-length-unchanged tests.
- `npx vitest run src/game/config/config.test.ts -t "never exceeds the derived live-shard bound" --reporter=verbose --silent=false` — **3 passed**; printed `Queen full fight: peak shards 119 (bound 1571), peak parts 1906, peak enemies 13, cleared at 373.43s`, plus `Drilling phase 3 for 60s: peak shards 56 (bound 1571)` and `Drilling phase 6 for 60s: peak shards 56 (bound 1571)`.
- `npx vitest run src/game/config/config.test.ts -t "deterministic across frame rates and step batching" --reporter=verbose` — **1 passed, 145 skipped** (19.13 s). The test compares a 60 Hz reference with 30 Hz, 120 Hz and `maxStepsPerUpdate`-sized bursts by full-state equality.
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`. The test gate logs 22 files and 818 tests passing.
- `npm run test:e2e -- --grep "Home phase panel|drill URL parameter|direct Queen|live phase panel|Crystal Worm Debug"` — **5 passed (17.3 s)**: the `?phase=` one-shot case (5.0 s), the direct Queen single-loop link (2.6 s), the Home phase panel case (2.8 s), the live phase panel case (10.2 s) and the Crystal Worm Debug case (2.6 s).

No group-loop Playwright case exists: `app/tests/app.spec.ts` has no comma-separated `phase=` link with `loop=1` (checked by grep). Group-loop behaviour is covered by the focused Vitest rows below. The full Playwright suite was not run.

#### Matrix row -> test mapping and results

| Matrix row | Check | Result |
| --- | --- | --- |
| Full fight: authored clear and base rules version | `src/game/config/config.test.ts` "the Killer Bee Queen's full fight clears through all eight phases" and "the Killer Bee Queen's full fight never exceeds the derived live-shard bound"; `src/game/simulation/drill.test.ts` "an empty or missing drill starts the full fight" and "an explicit null drill is the full fight even with legacy aliases" (base `rulesVersion`); `src/game/session/session.test.ts` "applyDrill(null) restarts a full fight paused" | Pass |
| Single phase, Loop on: repeat, identity and health reset | `src/game/simulation/drill.test.ts` "single phase, Loop on: re-enters the same phase and resets health"; `src/game/config/drill.test.ts` "drillRulesVersion separates base, loop, one-shot and phase sets" and "the old single-loop identity is unchanged"; `src/game/session/session.test.ts` "applyDrill starts a new attempt at the first selected phase, uses its identity, and pauses" | Pass |
| Single phase, Loop off: one-shot clear, identity | `src/game/simulation/drill.test.ts` "single phase, Loop off: clears after one exit"; `src/game/config/drill.test.ts` "drillRulesVersion separates base, loop, one-shot and phase sets" (`-drill-p2-once`); Playwright `?phase=0` one-shot case asserts `crystal-worm-child-swarm-paladin-v4-drill-p0-once` | Pass |
| Group `[1,3]`: authored order, wrap/clear, identity | `src/game/simulation/drill.test.ts` "group [1, 3], Loop on: 1 -> 3 -> 1 -> 3" and "group [1, 3], Loop off: 1 -> 3, then cleared"; `src/game/config/drill.test.ts` "nextDrillPhaseIndex follows authored order and wraps only when looping" and the `-drill-p1-3` / `-drill-p1-3-once` identity cases; Playwright Home panel asserts `killer-bee-queen-nest-paladin-v7-drill-p2-4-once` | Pass |
| Non-contiguous group `[1,3,5]`: authored order, wrap, identity | `src/game/simulation/drill.test.ts` "group [1, 3, 5] with non-contiguous indices follows authored order" (`[5,1,3]` normalizes to `1 -> 3 -> 5 -> 1`); `src/game/config/drill.test.ts` "?phase= parses a comma-separated looped selection", "?phase= without loop is a one-shot selection" and "duplicate and unsorted phase values normalize" | Pass |
| Final phase 8 alone: loop resets health; one-shot clears | `src/game/simulation/drill.test.ts` "phase 8, Loop on: resets at health zero and re-enters instead of clearing" and "phase 8, Loop off: health zero clears" | Pass |
| Group ending at phase 8 as the last selected phase | `src/game/simulation/drill.test.ts` "a group ending at phase 8, Loop on: wraps to its first selected phase at health zero" (`[1,7]` -> `1 -> 7 -> 1`) | Pass |
| Group ending before phase 8, Loop off: `cleared` at the last selected exit | `src/game/simulation/drill.test.ts` "a group ending before phase 8, Loop off: clears at the last selected phase exit" (phase index 3 at `cleared`) | Pass |
| Primary-only: a phase-driven minion still advances monotonically | `src/game/simulation/drill.test.ts` "a phase-driven minion in the same fight still advances monotonically"; extra regression "a minion's health-zero clear survives a primary drill jump" | Pass |
| Normal transition semantics: fired shards survive; only `despawnOnExit` minions disappear | `src/game/simulation/drill.test.ts` "fired shards survive a drill jump and only despawnOnExit minions disappear"; `src/game/simulation/phases.test.ts` "despawnOnExit removes a minion when its owner leaves the phase or sub-phase, but its shards survive to their own lifetimes" and "a drilled phase's telegraph and invulnerability window apply exactly as a real entry would" | Pass |
| Browser: Home selection -> Start | Playwright "the Home phase panel starts a two-phase one-shot drill at the first selected phase" (phases 3 and 5, Loop unchecked, one-shot identity, starts in phase 3) | Pass |
| Browser: `?phase=` deep link | Playwright "the ?phase= drill URL parameter starts the named phase as a one-shot and suffixes rulesVersion, and an out-of-range value is ignored" and "a direct Queen ?phase= link starts the requested phase" (single loop) | Pass |
| Browser: live panel open/pause, Apply, Close/resume | Playwright "the live phase panel pauses, applies, resumes, and handles result/retry/home" (paused on open, Apply keeps the panel and pause, "Now playing" shows Phase 3 - Pond Barrage, Close resumes); `src/App.test.tsx` "the live phase panel pauses on open, resumes on close, and manages focus", "Escape closes the live phase panel and resumes without leaking to the scene" and "the live Apply uses the current selection and leaves the panel open" | Pass |
| Browser: a result closes the panel | `src/App.test.tsx` "a result closes the live phase panel and hides the HUD actions". The Playwright case closes the panel before awaiting the result, so the result-close assertion is unit-level, as recorded in phase 31 | Pass |
| Browser: Retry keeps the selection | Playwright live case (Retry, reopen, Phase 3 - Pond Barrage still checked); `src/App.test.tsx` "result Retry keeps the selection without reopening the panel" | Pass |
| Browser: Home resets the selection | Playwright live case (Home, reopen, Full fight checked, Phase 3 unchecked); `src/App.test.tsx` "Home resets the live selection and closes the phase panel" and "returning Home clears the selection and closes the phase panel" | Pass |
| Browser: Crystal Worm Debug cleanup | Playwright "the Crystal Worm Debug panel drops the phase drill and keeps Next sub-phase a no-op" (no "Jump to phase", no "Loop this phase", no "Phase drill", Next sub-phase remains a no-op) | Pass |
| Full fight parity with V6: elapsed time, peak shards, deterministic 30/60/120 Hz | `config.test.ts` prints `373.43s`, peak shards `119`, peak parts `1,906`, peak enemies `13`, matching the V6 record; the determinism test passes at 30/60/120 Hz and under step batching | Pass |
| The panel adds no per-frame simulation work; no bound widened | `src/game/phaser/view.test.ts` "phaseViewOf follows the primary enemy's phase and the active drill" proves the live phase data is a pure derivation; neither `PhaseSelector.tsx` nor `App.tsx` calls `requestAnimationFrame`, `setInterval`, `advanceSimulation` or the simulation, and the view is published at the existing HUD cadence (phase 31). Phase 32 changed no simulation, view or Phaser source; the live-shard bound in `config.test.ts` is still `1571` | Pass |

#### Documentation changes

- `README.md`: replaced the old **Drill mode** paragraph with a pointer to the new **Phase Selector And Drill Sets (V7)** section, which records the shared selector, Full fight versus custom phases, the Loop toggle and its one-shot meaning, the comma-separated `?phase=` form with 0-based indices, the drill identities, the live panel overlay and Apply/Close lifecycle, the session-only state, and the D16-D18 limits. Added the Crystal-Worm-only, phase-drill-free Debug panel note and the v6/v7 archive links. The top heading `## Current V6 State` became `## Current State` after the V7 archive, since the section now describes both the V6 gameplay and the V7 selector.
- `docs/mechanics.md`: appended **Implemented V7 Handoff - Phase Selector And Drill Sets** covering the drill-set contract, the `?phase=N` supersession, the drill semantics table, normal phase-entry semantics, the primary-only rule, the final-phase loop reset, the rules-version suffixes, the live panel session boundary, and the acceptance evidence.
- `docs/deferred-work.md`: reviewed D16, D17 and D18 against the shipped behaviour. All three remain deferred and accurate: no sub-phase rows, no persistence and no results-screen panel were added. No edit was needed and nothing was marked complete.
- `docs/plan/phase-29.md` … `phase-32.md`: statuses complete; this execution record added.
- `docs/plan-v7.md` → `docs/implementation-plan-v7.md`: Phase Index rows for 29-32 complete with one-sentence outcomes, and the phase links repointed at `plan-archive/`. Archived with a V7 archive header because all four phases are complete.
- `docs/plan/phase-29.md` … `phase-32.md` moved to `docs/plan-archive/phase-29.md` … `phase-32.md` with their plan link updated to `../implementation-plan-v7.md` (implementation-plan.md lifecycle).
- `implementation-plan.md`: the V7 Current Plan row is now `archived` and links the archive. No `docs/plan-v8.md` was started; a new effort begins only with its own brainstorm.

#### Fix round 1 (documentation only)

Dispatched after QA (`phase-32-qa.md`, CHANGES REQUIRED: B1) and the strict review (`phase-32-review.md`, APPROVED with minor findings). No product, gameplay, simulation, engine or UI file changed. Nothing was committed, pushed or deployed.

- **B1 - `?loop=` validation corrected.** `docs/mechanics.md` now says `loop=1` enables looping, any other `loop` value means one-shot, and only a repeated `loop` parameter falls back to Full fight. `README.md` was disambiguated the same way: a repeated `phase` or `loop`, a malformed or out-of-range `phase`, or a fractional index falls back; any other `loop` value is one-shot. This matches `app/src/game/config/drill.ts:101-106` and the test "loop values other than 1 mean one-shot" (`drill.test.ts:200-209`).
- **Minor 1 - mechanics link fixed.** `docs/mechanics.md:608` now links `implementation-plan-v5.md` instead of the missing `plan-v5.md`.
- **Minor 3 - README label.** "Active implementation plan" became "Implementation plan", because every plan row is archived.
- **Minor 4 - heading rename recorded.** The earlier `## Current V6 State` -> `## Current State` change is now listed under the README documentation changes above.
- **N4 - brainstorm skill paths.** `.claude/skills/brainstorm/SKILL.md` now uses `docs/implementation-plan-v5.md` and `docs/plan-archive/phase-21.md` as its examples instead of the missing `docs/plan-v5.md` and `docs/plan/phase-21.md`.
- **N5 - 0-based placeholders.** The README identity table and the mechanics suffix list now state that `<N>` and `<a-b-c>` are the same 0-based top-level indices as `?phase=`.
- **N6 - next-plan wording.** `implementation-plan.md` no longer instructs the archiver to start `docs/plan-v<N+1>.md`; it says the next plan is written to that path when the next effort is brainstormed.
- **Minor 7 - V6 label.** The V6 handoff's hitbox comparison now reads "(V6)" rather than "(V7)", matching `README.md`'s V6 verification and this section's heading. The V7 rules-identity bump remains recorded in the same section.
- **N8 - drill bests clarified (corrected in fix round 2).** The first attempt said the History panel evaluates its retained best against "the encounter's base identity". That was false: the panel compares against one fixed base version. See fix round 2 for the corrected statement now in README and mechanics.
- **N7 - `.gitignore`.** Added `/app/.vitest/`, the local Vitest JSON output produced by tooling. It is a generated test artifact, not source or a build output, so ignoring it is safe.
- **Link check.** A one-off relative-link scan over `README.md`, `implementation-plan.md`, `AGENTS.md`, `docs/mechanics.md`, `docs/deferred-work.md`, `docs/implementation-plan-v7.md`, `docs/plan-archive/phase-29.md` … `phase-32.md`, `.claude/skills/brainstorm/SKILL.md` and `.gitignore` reported **all relative links resolve**.
- **Verification.** `npm run verify` was skipped because only documentation, plan and instruction files changed; the Phase 32 source tree is unchanged, so the 32.1 gate result above still stands.

#### Fix round 2 (documentation only)

Dispatched after the QA Fix Round 1 re-review (`phase-32-qa.md`, blocking B2). No product, gameplay, simulation, engine or UI file changed; nothing was committed, pushed or deployed.

- **B2 - History retained-best comparison corrected.** The sentence added in fix round 1 said the History panel uses "the encounter's base identity". The code (`app/src/App.tsx:15,237,262`) compares every record against the single module-level `RULES_VERSION`, which is the Crystal Worm's `crystal-worm-child-swarm-paladin-v4` (`app/src/game/data.ts:1633`), regardless of the selected encounter. README and mechanics now state that the panel compares against that fixed Crystal Worm base version; records from another version, including Crystal Worm drills and every Killer Bee Queen attempt, show as **Other rules** and never become the retained best. The preceding accurate wording about exact-version retained bests, **Other rules** against another selection, and no separate drill best is kept.
- **Link check.** A one-off relative-link scan over `README.md`, `implementation-plan.md`, `AGENTS.md`, `docs/mechanics.md`, `docs/deferred-work.md`, `docs/implementation-plan-v7.md`, `docs/plan-archive/phase-29.md` … `phase-32.md` and `.claude/skills/brainstorm/SKILL.md` reported **all relative links resolve**.
- **Verification.** `npm run verify` was skipped because only documentation files changed; the 32.1 gate evidence still stands.

#### Deviations and rulings

- No gameplay or code change was made in phase 32. The `npm run verify` run happened before the documentation and archive edits, as the brief allows; the documentation edits change no source.
- The Phase 31 rulings are reflected in the docs: the Debug panel is Crystal-Worm-only; the live panel overlays the playfield and is session-only; `?phase=N` without `loop=1` is a one-shot drill; the identities are base / `-drill-pN` / `-drill-pN-once` / `-drill-p<a-b-c>` / `-drill-p<a-b-c>-once`.
- The five targeted Playwright cases named in the brief were run. There is no existing group-loop browser case to run; group-loop behaviour relies on the focused Vitest matrix.

#### Concerns

- The result-closes-the-panel row is proven only at the unit level because the live Playwright case closes the panel before waiting for the result; this is unchanged from phase 31 and recorded rather than widened.
- No automated link check is committed. A one-off scan resolved every relative link in the files touched by this phase, including after the fix-round link corrections. A whole-repository scan still finds pre-existing broken links in the older v5/v6 archive files and is not chased here, per the fix brief. A future move of these files could still leave a stale link, which would be a documentation defect rather than a gameplay defect.
- The History panel's fixed base-identity comparison predates V7. The docs now state it as-is; changing it to per-encounter or per-drill bests would be product work needing its own approval, not part of this documentation fix.


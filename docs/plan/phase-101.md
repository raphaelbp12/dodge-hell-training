# Phase 101: Camera Rotation

> Step prompts and execution records for phase 101 of [plan v24](../plan-v24.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 101.` for it.

### Step 101.1 - The Rotation Model

Status: complete. Dependencies: none.

**Implementation prompt**

Create `app/src/game/phaser/camera-rotation.ts`, a pure module with no Phaser, DOM or React import (D-24-8). Export `CAMERA_ROTATION_RADIANS_PER_SECOND = 3.0` (unit rad/s, source: the user's table in the plan, D-24-1), a state `{ angleRadians }` starting at 0, a step function taking the state, `{ counterClockwise, clockwise }` input flags (`Q` and `E`) and elapsed seconds and returning the new state, and a reset returning angle 0 (D-24-2, D-24-9). `Q` turns the camera counter-clockwise, `E` clockwise. Both flags held cancel. The angle is normalized into the range from 0 up to but not including 2 pi. Which sign convention maps to the screen is fixed by the Phaser step (101.2); state it in a code comment.

**Focused checks:** a failing-first test file covering: one second of `E` turns 3.0 rad; `Q` turns the opposite way; both keys leave the angle unchanged; no keys leave it unchanged; the angle wraps past a full turn and stays in range; stepping 1 s as one call or as sixty 1/60 s calls gives the same angle within floating tolerance; reset returns 0 from any angle; a zero or tiny elapsed time changes nothing.

**Acceptance:** the focused test passes; `npx tsc -b` passes; the module imports nothing from Phaser, React or the DOM (the boundaries lint passes); mutation diff reports no surviving mutant on the new module.

**Execution and verification**

- Changed: new `app/src/game/phaser/camera-rotation.ts` (rate constant 3.0 rad/s, state, step, reset, and `rotationInputOf` mapping held `Q`/`E` to flags) and `camera-rotation.test.ts`. Positive angle is a clockwise camera turn (`E`); Phaser's camera rotation is the negation (comment in the module).
- Checks: `npx vitest run src/game/phaser/camera-rotation.test.ts` failed first (module missing), then passed; `npx tsc -b` and `npx oxlint --deny-warnings` pass.
- Mutation diff: `src/game/phaser/` is not in the Stryker mutate globs (`app/stryker.config.mjs`), so there is no mutant to report; not run.

### Step 101.2 - Rotate The Camera In The Encounter

Status: complete. Dependencies: 101.1.

**Implementation prompt**

In `app/src/game/phaser/encounter.ts`, register `Q`, `E` and `Z` next to the WASD keys (D-24-3: always on). During active play only, step the pure model each frame and apply the angle to the main camera, pivoting about the player, where `centerCamera` already centres (D-24-5, D-24-7). Movement input is unchanged (D-24-4). Keep health bars, hit numbers and text labels upright and correctly placed over their world objects (D-24-6). Reset the angle to 0 when a new run starts and clear held rotation keys on focus loss, pause and the Controls modal exactly as the movement keys are cleared; rotation keys are ignored while debug tools have focus, as movement keys are (D-24-7). `Z` snaps to 0 (D-24-9). Add `cameraRotationRadians` to the debug snapshot (D-24-8). Do not touch the simulation or any data file.

**Focused checks:** where Phaser objects are not unit-testable, put the logic in pure helpers and test those: the upright-label placement for a given angle, and the key-to-flags mapping with its clearing rules. A view test confirms the snapshot reports the model's angle.

**Acceptance:** with keys held during play the angle follows the model; pause, focus loss and a new run clear or reset it; labels stay upright in a manual check at several angles (record as performed or blocked); simulation, characterization and fingerprint tests pass unchanged; `graphify update .` run.

**Execution and verification** (manual upright check and `graphify update .` not performed, see the addendum under 101.3)

- Changed: `encounter.ts` registers `Q`/`E` (Phaser keys) and `Z` (keydown), steps the model while `playing`, applies `setRotation(-angle)` in `centerCamera`, resets on retry and drill, suppresses `Q`/`E` like movement keys (debug tools, `clearMovement`), and adds `cameraRotationRadians` to `inspect()`. New `camera-upright.ts` (+ test, failed first then passed) places the health bar, condition chips, chip texts and hit numbers so they stay upright; bar and chips are drawn relative to the player in a counter-rotated Graphics.
- Ran: `npx vitest run src/game/phaser src/ui/ControlsDialog.test.tsx` pass; `npx tsc -b` and `npx oxlint --deny-warnings` pass.
- Not met: manual upright check at several angles blocked (no browser run); simulation, characterization and fingerprint tests not run (no simulation file touched); `graphify update .` blocked (`graphify` not installed). The snapshot field has no unit test (the scene is not unit-testable); the step-101.3 Playwright test covers it.

### Step 101.3 - Controls Rows And The Browser Test

Status: complete. Dependencies: 101.2.

**Implementation prompt**

Add rows to `app/src/ui/ControlsDialog.tsx` for `Q` (rotate camera counter-clockwise), `E` (rotate camera clockwise) and `Z` (reset camera angle) (D-24-10), and update `ControlsDialog.test.tsx`. Add one Playwright test: start a run, hold `E` for a measured time, read `cameraRotationRadians` from the debug snapshot and assert it changed by about the rate times the held time (read the rate from the module source, not a copied literal, per AGENTS.md); press `Z` and assert it is 0. Run only that test with `--grep`.

**Focused checks:** the Controls dialog test lists the three new keys; the Playwright test fails before 101.2's integration and passes after.

**Acceptance:** the dialog test and the Playwright test pass; `npm run verify` passes; the `verifier` ran the full non-soak browser suite before the branch is pushed; nothing is committed without authorization.

**Execution and verification** (Playwright, verify and the browser suite pass, see the addendum)

- Changed: `ControlsDialog.tsx` rows for `Q`, `E`, `Z`; `ControlsDialog.test.tsx` test (failed first, then passed); `tests/app.spec.ts` gains `cameraRotationRadians` in the `Inspection` type and one test, "holding E turns the camera at the module's rate and Z resets it", reading the rate through `sourceExport`. The Playwright test was written, not run.

**Orchestrator addendum (second run).** `npm run verify` from `app/` passed (lint, typecheck, test, build; it includes the simulation, characterization and fingerprint tests, unchanged). The Playwright test "holding E turns the camera..." passes. The full non-soak browser suite passes, run as the three shards `--shard=1/3`, `2/3`, `3/3` (17 tests each, no retries). `camera-rotation.ts` is outside the Stryker mutate globs, so no mutation check applies to it. The snapshot field is covered by the Playwright test.

**Not performed:** the manual check that labels and health bars stay upright at several angles (a person's check by eye), and `graphify update .` (`graphify` is not installed; the git hooks rebuild the graph).

Step 101.3 is `complete`; step 101.2 is `complete` except for those two items.

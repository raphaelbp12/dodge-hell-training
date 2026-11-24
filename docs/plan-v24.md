# Plan V24: Camera Rotation

Phase 101. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phase 101 builds and why. It is not authorization to implement the phase by itself.

ROTMG lets a player turn the camera with `Q` and `E` and reset it with a key. The game has WASD movement and zoom, and a camera that follows the player, but no rotation. This plan adds view-only camera rotation at one fixed speed, a reset key, and behaviour tests that prove the camera turns as specified.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved approach for phase 101. Later explicit user decisions override older statements; record changes here.
- The user's issue text (SAFE-9, 2026-11-24): the key names and the speed table below. These are user-supplied facts about ROTMG, not verified in this repository.
- The user's answers of 2026-11-24 to the `/brainstorm` questions 1-10, recorded below as D-24-1 to D-24-10.

User-supplied speed table (only Normal is built, D-24-1):

| Preset | Multiplier | rad/s | deg/s | Full turn |
| ------ | ---------- | ----- | ----- | --------- |
| Slow | 0.5 | 1.5 | ~85.9 | ~4.19 s |
| Normal | 1.0 | 3.0 | ~171.9 | ~2.09 s |
| Fast | 1.5 | 4.5 | ~257.8 | ~1.40 s |

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V23](plan-v23.md) | 97-100 | The game plays the study |

## Confirmed Design

Carried forward unchanged: every gameplay rule, the simulation, its fixed step, the rules fingerprint and every `rulesVersion`; the one-way boundaries (models, configuration and simulation know nothing of React, Phaser, DOM or localStorage); WASD movement; zoom with `O` and `P`; `R` as immediate retry; the existing pause, focus-loss and Controls-modal input rules.

This plan adds, as a delta:

- **A view-only camera rotation** about the player (D-24-5), turned by `Q` and `E` at one speed (D-24-1) and reset by `Z` (D-24-2, D-24-9).
- **No simulation change.** Movement stays tied to screen directions (D-24-4); the simulation never sees the angle.

## Recorded User Decisions - 2026-11-24

- **D-24-1. One speed.** Rotation turns at Normal, 3.0 rad/s (~171.9 deg/s). No Slow or Fast preset, no selector. (Issue topic; question 1a.)
- **D-24-2. Reset key.** `Z` resets the camera to the default angle, 0 degrees. `R` is already bound to retry. (Question 2b.)
- **D-24-3. No setting.** There is no "Allow Camera Rotation" toggle; `Q`, `E` and `Z` always work. (Question 3a.)
- **D-24-4. Movement is screen-relative.** `WASD` keeps its screen directions at every camera angle; rotation is view-only and the simulation and input mapping do not change. (Question 4a.)
- **D-24-5. Pivot.** The camera pivots about the player; it already follows the player. (Question 5b.)
- **D-24-6. What turns.** The arena, bullets and sprites rotate with the world. Health bars, hit numbers and text labels in the canvas stay upright. The React HUD never rotates. (Question 6a.)
- **D-24-7. Lifecycle.** Rotation works only during active play, like movement. The angle resets to 0 degrees on each new run and is not saved. Held `Q`, `E` or `Z` clears on focus loss, pause and the Controls modal. (Question 7a.)
- **D-24-8. Tests.** Unit tests on a pure rotation model independent of Phaser (rate, opposite keys, both keys cancel, wrap past 360 degrees, frame-rate independence, reset), plus one Playwright test that pressing `E` changes the camera rotation in the debug snapshot. (Question 8a.)
- **D-24-9. Reset is instant.** `Z` snaps to 0 degrees at once; no eased turn. (Question 9a.)
- **D-24-10. Controls dialog.** The Controls dialog gains rows for `Q`, `E` and `Z`. (Question 10a.)

## Architecture

- A pure module `app/src/game/phaser/camera-rotation.ts`, with no Phaser, DOM or React import, owns the angle: its state, a step function taking input flags and elapsed seconds, and the reset. The rate is a named constant `CAMERA_ROTATION_RADIANS_PER_SECOND = 3.0` in that module, with its unit and source (the user's table). It is not in `encounter.json`, so no gameplay data, `rulesVersion` or fingerprint changes.
- `app/src/game/phaser/encounter.ts` reads `Q`, `E` and `Z`, calls the module each frame during active play, applies the angle with the camera's rotation and keeps canvas text and health bars upright.
- `app/src/ui/ControlsDialog.tsx` lists the keys.

## Target Data Shapes

- The pure module's state: `{ angleRadians: number }`, normalized to the range from 0 up to but not including 2 pi.
- The debug snapshot (`inspect`) gains `cameraRotationRadians: number`, next to `zoom` and `camera`.

## Approved Scope And Review Gates

In scope: D-24-1 to D-24-10 only.

Out of scope: Slow and Fast presets and a selector (D48); WASD turning with the camera (D49); an on/off setting; persistence of the angle; eased reset; mouse or touch rotation; any simulation, data or rules change; every other deferred-register entry.

Review gates:

- Phase 101 changes no data file, no `rulesVersion`, no fingerprint and no simulation snapshot; the existing simulation, property and characterization tests pass unchanged.
- Each step's focused test file runs alone with `npx vitest run <path>`, and `npx tsc -b` passes before a test change is reported.
- `npm run test:mutation:diff`, by the `verifier` subagent, for any step that changes a module in the Stryker mutate globs.
- `npm run verify` from `app/` at the end of the phase, by the `verifier` subagent.
- The new Playwright test is run alone with `--grep`; before the branch is pushed, the `verifier` runs the full non-soak suite (AGENTS.md).
- A property, contract or mutation finding on current code stops the phase for a user decision (V22 A10).
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 101 | Camera Rotation | pending | None |

## Phase 101: Camera Rotation

[Step prompts](plan/phase-101.md).

- 101.1 - The Rotation Model: complete. Dependencies: none.
- 101.2 - Rotate The Camera In The Encounter: pending. Dependencies: 101.1.
- 101.3 - Controls Rows And The Browser Test: pending. Dependencies: 101.2.

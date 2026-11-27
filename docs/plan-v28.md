# Plan V28: Camera-Relative Movement And Upright Sprites

Phase 105. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phase 105 builds and why. It is not authorization to implement the phase by itself.

Multica issue SAFE-18, raised against PR #22 (phase 101, camera rotation). The camera turns correctly with `Q`, `E` and `Z`, but movement and sprites are wrong: sprites rotate with the world and `WASD` keeps world axes, so after a turn `A` no longer moves the player to the left of what the player sees. This plan makes movement relative to the player's view and keeps every entity sprite upright on screen.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- [Plan v24](plan-v24.md) and [phase 101](plan/phase-101.md): the camera rotation this plan corrects. This plan supersedes D-24-4 and the sprite part of D-24-6.
- This file: the decisions and approved approach for phase 105. Later explicit user decisions override older statements; record changes here.
- The Multica issue SAFE-18 text and the user's answers of 2026-11-27 to the `/brainstorm` questions 1-9, recorded below as D-28-1 to D-28-9.

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V27](plan-v27.md) | 104 | Encounter page opens over plain HTTP |

Plan v24 (phase 101) is not yet merged: it is implemented in PR #22 (branch `agent/developer/cf5e4bc216f0`) and is a prerequisite of this plan.

## Confirmed Design

Carried forward unchanged from plan v24: `Q` and `E` turn the camera at 3.0 rad/s, `Z` snaps it to 0, the camera pivots about the player, rotation works only during active play and resets on each new run, and health bars, hit numbers and canvas text labels stay upright. The simulation, every `rulesVersion` and all data files stay unchanged.

This plan adds, as a delta:

- **Camera-relative movement.** `WASD` is turned by the camera angle, so `A` always moves the player to the left of the screen (D-28-1 to D-28-3).
- **Upright sprites.** Every entity sprite (player, enemies, bullets, pickups) stays unrotated on screen; the arena floor, walls and boundary still rotate (D-28-4, D-28-5).

## Recorded User Decisions - 2026-11-27

- **D-28-1. Movement is view-relative.** `W`, `A`, `S`, `D` move the player up, left, down and right as seen on screen at any camera angle. This supersedes D-24-4. (Issue text.)
- **D-28-2. Applied in the input layer.** The camera angle turns the `WASD` direction into a world direction before it reaches the simulation. The simulation, fingerprints and replays do not change and never see the angle. (Question 2a.)
- **D-28-3. Recomputed every frame.** A held movement key follows the camera while it turns: the direction is recomputed each frame, not latched at key press. (Question 3a.)
- **D-28-4. Every entity sprite stays upright.** Player, enemies, bullets and pickups are not rotated by the camera. This supersedes the sprite part of D-24-6. (Question 1b.)
- **D-28-5. Arena still rotates.** The arena floor, walls and boundary rotate with the camera so that rotation stays visible. (Question 8a.)
- **D-28-6. Directional sprites keep a screen-relative heading.** A sprite with its own orientation (a bullet, an arena shard) is not rotated by the camera, but its own heading is turned by the camera angle, so a bullet flying up-screen points up-screen at every angle. (Question 7a.)
- **D-28-7. Facing logic unchanged.** Sprites keep whatever facing or animation logic they have today. (Question 4a.)
- **D-28-8. Verification.** Pure unit tests for the angle-to-direction mapping and the upright and heading helpers, plus one Playwright test that the user or CI runs (Chromium does not start in the agent environment). (Question 5a.)
- **D-28-9. Landing.** Phase 105 stacks on the PR #22 branch and lands with or after it, as a new phase 105 that depends on phase 101; it does not rewrite phase 101's steps. (Questions 6b, 9a.)

## Architecture

- `app/src/game/phaser/camera-relative-input.ts` (new, pure, no Phaser, DOM or React import): turns a screen-space movement vector and the camera angle into a world-space vector.
- `app/src/game/phaser/camera-upright.ts` (from phase 101): extended with a helper that places an entity sprite upright and turns an own heading by the camera angle.
- `app/src/game/phaser/encounter.ts`: uses the mapping where it reads `WASD`, and the upright helper for entity sprites. The simulation is not touched.

## Target Data Shapes

None new. The debug snapshot keeps `cameraRotationRadians` from phase 101.

## Approved Scope And Review Gates

In scope: D-28-1 to D-28-9 only.

Out of scope: any simulation, data, `rulesVersion` or fingerprint change; sprite facing or animation changes; a setting to turn view-relative movement off; rewriting phase 101.

Review gates:

- Only the files named in the Architecture section, their tests, the Controls dialog text if needed, the Playwright spec and plan files change.
- New unit tests are shown failing first.
- Simulation, characterization and fingerprint tests pass unchanged.
- `npm run verify` from `app/` passes; the full non-soak browser suite is run by the user or CI and recorded.
- No commit, push or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 105 | Camera-Relative Movement And Upright Sprites | pending | Phase 101 (PR #22) |

## Phase 105: Camera-Relative Movement And Upright Sprites

[Step prompts](plan/phase-105.md).

- 105.1 - The View-Relative Movement Mapping: pending. Dependencies: phase 101.
- 105.2 - Upright Entity Sprites: pending. Dependencies: phase 101.
- 105.3 - Wire Movement In The Encounter: pending. Dependencies: 105.1.
- 105.4 - Browser Test: pending. Dependencies: 105.2, 105.3.

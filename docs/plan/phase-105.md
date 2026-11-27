# Phase 105: Camera-Relative Movement And Upright Sprites

> Step prompts and execution records for phase 105 of [plan v28](../plan-v28.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 105.` for it.

### Step 105.1 - The View-Relative Movement Mapping

Status: complete. Dependencies: phase 101.

**Implementation prompt**

Create `app/src/game/phaser/camera-relative-input.ts`, a pure module with no Phaser, DOM or React import (D-28-2). Export a function taking the screen-space movement vector (from `WASD`, up is negative y as the encounter already reads it) and the camera angle in radians, using the sign convention fixed in `camera-rotation.ts`, and returning the world-space vector that appears on screen as the input direction. At angle 0 it returns the input unchanged. Vector length is preserved, so diagonals are not faster. State the sign convention in a code comment (D-28-1).

**Focused checks:** a failing-first test file: angle 0 is identity; at a quarter turn each of `W`, `A`, `S`, `D` maps to the expected world axis for both turn directions; the zero vector stays zero; length is preserved at several angles including a full turn and values past it; applying the camera rotation to the result gives back the screen vector within floating tolerance.

**Acceptance:** the focused test passes; `npx tsc -b` passes; the boundaries lint passes; no simulation file changes.

**Execution and verification**

- Added `app/src/game/phaser/camera-relative-input.ts` (`cameraRelativeMovement`, a clockwise rotation by the camera angle) and its test file, seen failing first (module missing).
- `npx vitest run src/game/phaser`: 71 passed. `npx tsc -b`: passes. `npx oxlint --deny-warnings src/game/phaser`: passes (the separate boundaries lint was not run). No simulation file changed.

### Step 105.2 - Upright Entity Sprites

Status: pending. Dependencies: phase 101.

**Implementation prompt**

In `app/src/game/phaser/camera-upright.ts`, add pure helpers that, for a camera rotation, give an entity sprite the counter-rotation that keeps it upright and turn a sprite's own heading by the camera angle (D-28-4, D-28-6). In `encounter.ts` and `arena-renderer.ts`, apply them to the player, enemies, bullets, pickups and oriented arena shards each frame; leave the arena floor, walls and boundary rotating (D-28-5). Do not change facing or animation logic (D-28-7). Do not touch the simulation or any data file.

**Focused checks:** a failing-first test: the counter-rotation equals minus the camera rotation at several angles; a heading is turned by the camera angle so that a world heading and the camera angle give the same on-screen heading at every angle; angle 0 changes nothing.

**Acceptance:** the focused test passes; `npx tsc -b` passes; in a manual check at several angles sprites stay upright and bullets point along their on-screen motion (record as performed or blocked); simulation, characterization and fingerprint tests pass unchanged.

**Execution and verification**

- Added `uprightRotation` and `screenHeading` to `camera-upright.ts` (tests seen failing first: "not a function"). `arena-renderer.ts` `drawWorld(zoom, cameraRotation = 0)` now draws player, enemy and bomb/shard bodies and shard images counter-rotated; directional shards and bombs are drawn at their world heading, which the camera turns onto the on-screen heading. `encounter.ts` passes `this.cameraRotation`. The arena floor, walls and boundary are untouched. The game has no pickups. Facing logic unchanged.
- `npx vitest run src/game/phaser`: 71 passed; `npx tsc -b` and oxlint pass.
- Manual check at several angles: blocked (no browser in the agent environment). Simulation, characterization and fingerprint tests were not run (no simulation file changed). Status stays pending until the manual check and those tests are done.

### Step 105.3 - Wire Movement In The Encounter

Status: pending. Dependencies: 105.1.

**Implementation prompt**

In `app/src/game/phaser/encounter.ts`, pass the `WASD` vector through the 105.1 mapping every frame with the current camera angle before it is given to the simulation, so a held key follows the camera as it turns (D-28-1 to D-28-3). Movement keys keep their existing clearing rules (focus loss, pause, Controls modal, debug focus). Update the `ControlsDialog.tsx` wording only if it describes movement as world-fixed. Do not touch the simulation.

**Focused checks:** where the encounter code is not unit-testable, test the pure pieces already covered by 105.1; add a view or helper test that the vector reaching the simulation input equals the mapped vector for a given angle; existing movement tests pass unchanged at angle 0.

**Acceptance:** with the camera at a quarter turn, `A` moves the player to the screen-left; at angle 0 behaviour is identical to before; simulation, characterization and fingerprint tests pass unchanged; `npm run verify` passes.

### Step 105.4 - Browser Test

Status: pending. Dependencies: 105.2, 105.3.

**Implementation prompt**

Add one Playwright test in `app/tests/app.spec.ts`: start a run, hold `E` to turn the camera by a measured amount, hold `A` for a measured time, and assert from the debug snapshot that the player moved to the screen-left (the camera-relative direction), not along the world x axis. Read the rotation rate from the module source, not a copied literal. Run only that test with `--grep` (D-28-8).

**Focused checks:** the test fails before 105.3 and passes after.

**Acceptance:** the Playwright test passes where Chromium can start (user or CI; record as blocked if run in the agent environment); the full non-soak browser suite is run by the user or CI before the pull request is merged; nothing is committed without authorization.

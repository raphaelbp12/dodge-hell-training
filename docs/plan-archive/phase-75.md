# Phase 75: The Draft Preview

> Step prompts and execution records for phase 75 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 75.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-75.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 75.1 - Block Windows And Volley Times

Status: complete. Dependencies: phase 74.

**Implementation prompt**

Create `research/draftPreview.ts`, pure.

`blockWindows(blocks, anchors, videoEndSeconds)` returns, for each anchored block, its `anchorSeconds`, `epochSeconds` (anchor plus telegraph, L20) and `endSeconds`. The end is the earliest of the anchor plus its authored duration, the monster's next anchor in video time, and the video end (L19, L34). Blocks anchored at the same time resolve in authored order, and the later one wins. An unanchored block has no window, so it draws nothing (L29).

`draftVolleysLiveAt(cadence, window, timeSeconds, lifetimeSeconds)` returns each volley whose flight could still be drawn at `timeSeconds`, with its time, burst index and volley index in the burst. It uses the formula under the plan's Target Data Shapes, which matches `updateAttackClock`. A volley fires only if its time is before the window's end. Find the first relevant burst by arithmetic rather than by iterating from the block's start, so cost does not grow with distance from the anchor.

**Focused checks**

Write failing `draftPreview.test.ts` cases first: the epoch adds the telegraph; a timed block stops at its duration; an untimed block stops at the next anchor and otherwise at the video end; a timed block stops early at a nearer next anchor; a same-time pair resolves as specified; multi-shot bursts use interval and cooldown exactly as the formula states, compared against `createSimulation` running one attack for the same span; a volley at exactly the end does not fire; a volley fired before the end is still returned after it while it is in flight; and a time long after the anchor does no more iteration than a short one.

**Acceptance**

The volley-time comparison with the real simulation passes for at least a single-shot and a multi-shot cadence. The module runs no simulation outside tests and has no clock of its own.

**Execution record**

Added `research/draftPreview.ts` with `blockWindows` and `draftVolleysLiveAt` (the first relevant burst is found by arithmetic). Volley times match a real `createSimulation` run to within 1.5 fixed steps for a single-shot and a multi-shot cadence, using a derived config holding one attack.

### Step 75.2 - One Draft Frame

Status: complete. Dependencies: 75.1.

**Implementation prompt**

Add `draftPreviewAt({ draft, blocks, config, timeSeconds, videoEndSeconds, playerTiles, headingRadians })` to `research/draftPreview.ts`. It returns a `PreviewFrame`, so `drawPreviewFrame` draws it unchanged, plus `undrawnAttackIds` for attacks with no sprite (L36).

For each window and each attack from `activeDraftAttacks`, convert with `attackSpecFromAuthored` (L37), look up the projectile in `config.projectiles`, and call the existing `resolveBearings` with `volleyIndexInBurst`, `burstsFired` and `secondsSinceEpoch` set from the volley, and `ringPhaseRadians` from the plan's formula (L14). Position shots from `emitterTilesOf(config)` (L16). A bomb with `attack.target === "player"` lands on `playerTiles`, as the simulation does. Reuse `poseAtAge`, `evenDrawsFor`, `drawnLifetimeSeconds` and the detonation handling by exporting them from `research/previewModel.ts` without changing them. Use a named `NO_TAG_INDEX` for `tagIndex`, and set `unmatchedTagCount` to 0.

Do not change `previewAt` or any tag preview result.

**Focused checks**

Write failing cases first: an unanchored draft draws nothing; a ring's arm bearing at a later volley matches `resolveBearings` with the expected phase; a pattern with `perBurstAdvanceDegrees` and one with arm spread differ between bursts, as they do in the simulation (L14); shots outlive their block's end; a targeted bomb lands at the player point; an attack with no appearance appears in `undrawnAttackIds` and draws nothing; and the existing `previewModel.test.ts` passes unchanged.

**Acceptance**

For a fixed player position and a stationary emitter, the draft frame's projectile count matches a real simulation of one Queen block at sampled times. Scatter is compared by count only, because the preview uses even draws. `npm run verify` passes.

**Execution record**

Added `draftPreviewAt` and `NO_TAG_INDEX`; exported `poseAtAge`, `evenDrawsFor` and `drawnLifetimeSeconds` from `previewModel.ts` without changing them. A sampled comparison against the simulation (3-arm ring, 2-shot burst, four times) agrees within 3 projectiles, which allows for shots crossing their lifetime between a step and the sampled time; it is not exact.

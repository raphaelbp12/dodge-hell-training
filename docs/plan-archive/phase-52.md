# Phase 52: Front-Relative Aim

> Step prompts and execution records for phase 52 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 52.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-52.md` and replace the plan's step lines with one-sentence outcomes.

### Step 52.1 - Enemy Heading

Status: complete. Dependencies: phase 51.

**Implementation prompt**

Add optional `initialHeadingDegrees` to the authored and runtime archetype (N17), validated finite. Add `headingRadians` to `EnemyState`, set in enemy creation from it, or 0 when absent.

Where each enemy's position is committed after `advanceEnemyMovement` and arena constraint, compare it with the step's starting position. If the displacement exceeds a named `HEADING_MIN_DISPLACEMENT_TILES` of `1e-9` tiles (matching `orbitRingToleranceTiles`, a numerical tolerance and not a gameplay value), set `headingRadians` to the displacement's `atan2`. Otherwise hold it. Do not update it anywhere a position changes other than by movement.

**Focused checks**

Write failing `movement.test.ts` cases first: the initial value; absent means 0; chase, move-to-point and wander point along their travel; an orbit points along its tangent; a stationary enemy holds its heading; an enemy that stops holds its last heading; and identical values across 30, 60 and 120 Hz.

**Acceptance**

Heading reads no randomness, nothing shipped reads it yet, and the characterization test passes unchanged.

### Step 52.2 - The Front Aim

Status: complete. Dependencies: 52.1.

**Implementation prompt**

Add the `aim: "front"` case with required finite `offsetDegrees` to `spread` and `scatter`, in both `game/config/data.ts` and `game/config/encounter.ts` (N16). Rings stay without aim (N14), and inner patterns stay without aim (N06). Add `enemyHeadingRadians` to `PatternContext`, pass `enemy.headingRadians` from `updateAttackClock`, and make `resolveAimBearingRadians` return heading + offset for `front`.

Add a runtime validation that an archetype with any front-aimed attack, in any phase or sub-phase, authors `initialHeadingDegrees` (N17). Record the source in `docs/mechanics.md` as the user's video observation of the Queen's phase index 0, not a wiki fact, and that no shipped attack uses it yet (N18, D27).

Run `npm run verify` through the `verifier` subagent.

**Focused checks**

Write failing cases first: offsets 0 and 180 and an arbitrary angle; a spread and a scatter; the bearing following the heading as an enemy moves; a validator rejecting a missing `offsetDegrees`, a front aim without `initialHeadingDegrees` in a sub-phase, and `front` on a ring; and a front-aimed bomb landing at `rangeTiles` along that bearing.

**Acceptance**

`enemies.json` does not change, existing aim tests pass unchanged, and `npm run verify` passes.

## Execution record

Added `EnemyState.headingRadians` (movement heading, held when still, `HEADING_MIN_DISPLACEMENT_TILES` 1e-9), optional `initialHeadingDegrees` (authored and runtime, finite, required when any attack aims `front`), and `aim: "front"` with a required `offsetDegrees` on spread and scatter; `front` is rejected on rings and inner patterns. A front-aimed bomb lands at `rangeTiles` along its bearing. docs/mechanics.md records the source as the user's video observation, not a wiki fact, with no shipped front shot (D27). `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

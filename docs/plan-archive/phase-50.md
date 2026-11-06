# Phase 50: The Targeted Bomb

> Step prompts and execution records for phase 50 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 50.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-50.md` and replace the plan's step lines with one-sentence outcomes.

### Step 50.1 - The Target Field

Status: complete. Dependencies: phase 49.

**Implementation prompt**

Add an optional `target: "player"` to the authored attack in `game/config/data.ts` and to `AttackSpec` in `game/config/encounter.ts` (N28, N29). Validate that an attack with `target` fires a bomb projectile and has a `spread` pattern with `shots: 1` and `aim: "player"` (N30). This check needs both the projectile and the pattern, so put it in the runtime `validateAttackSpec`.

In `updateAttackClock`, pass `state.player.positionTiles` to `createBomb` when `attack.target === "player"`. `resolveBombDestination` then returns that position exactly, with no clamp, captured at fire time, ignoring `rangeTiles` (N13, N27). Velocity stays (destination − spawn) / `travelSeconds`, and `lifetimeSeconds` stays `travelSeconds`.

**Focused checks**

Write failing tests first: a targeted bomb lands exactly on the player's fire-time position at a near and a far distance, in exactly `travelSeconds`; moving the player after firing does not move the landing; a player on the spawn point gives zero velocity and no error; an untargeted bomb still lands at range; validators reject `target` on a bullet, on `shots: 3`, on `aim: "fixed"`, and on a ring. The determinism test across 30, 60 and 120 Hz passes for a targeted bomb.

**Acceptance**

No shipped data has changed yet, and the characterization test passes unchanged.

### Step 50.2 - Adopt It And Advance The Rules

Status: complete. Dependencies: 50.1.

**Implementation prompt**

Add `"target": "player"` to `white-bomb-targeted` in `game/data/enemies.json` (N02). It is the only change to that file. Advance the Queen's `rulesVersion` in `game/data/encounter.json` from `killer-bee-queen-nest-paladin-v11` to `killer-bee-queen-nest-paladin-v12`. Update the identity checks in `config.test.ts` and the drill key in `app/tests/app.spec.ts`. Leave the Crystal Worm's identity alone.

Make the characterization test build its configuration with `target` removed from `white-bomb-targeted`, and leave its expected values alone. This proves the split and the targeting code changed nothing else.

Add a test that the shipped phase-index-0 bomb lands on a standing player and that its bomb can be dodged: a player moving at the Paladin's speed for `travelSeconds` clears the detonation radius. Rerun the headless full-fight clear and record its new time and peak counts in `docs/mechanics.md`, alongside the rules-identity note and the statement that phase 1 is now harder because this bomb reaches the player.

**Focused checks**

`config.test.ts`'s retained-best test shows v11 attempts excluded from the v12 best. Run the Playwright drill case that names the identity, alone. Run `npm run verify` through the `verifier` subagent.

**Acceptance**

`git diff` on `enemies.json` is one field, the characterization test passes unchanged, and the new clear time is recorded as measured rather than claimed.

## Execution record

Added `target: "player"` to the authored attack and `AttackSpec`, validated at runtime (bomb projectile, single-shot player-aimed spread; rejected on a bullet, 3 shots, fixed aim and a ring), landing the bomb exactly on the player's fire-time position in `travelSeconds` with no clamp. `white-bomb-targeted` adopts it (the only `enemies.json` change), advancing the Queen to `killer-bee-queen-nest-paladin-v12`; the characterization test strips `target` and still passes unchanged. Tests prove a standing player is hit once and a moving player dodges it. Headless god-mode full-fight clear measured at 373.43 s, peak 119 live projectiles, 1,906 collision parts (identical to before). The drill Playwright case passes. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

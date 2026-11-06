# Phase 49: Bombs Become Their Own Shot

> Step prompts and execution records for phase 49 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 49.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-49.md` and replace the plan's step lines with one-sentence outcomes.

### Step 49.1 - Characterize Today's Fight

Status: complete. Dependencies: V14 phase 48.

**Implementation prompt**

Before any bomb code changes, add `app/src/game/simulation/bomb-split-characterization.test.ts` (N23). It runs the shipped Killer Bee Queen with one fixed seed and an idle player for a fixed simulated duration long enough to fire every phase-index-0 bomb attack, and repeats this for a drill into each phase that fires bombs (phase indexes 0, 1, 2 and 6). Each run produces a list, per fixed step, of accepted hits (time, shard id, damage), detonations (projectile id, position, radius), and every live projectile's id and position, in id order. Round positions to 9 decimals, because N24's authored 1.8 differs from today's `3 * 0.6` by under 1e-15.

Commit the result as a compact JSON snapshot beside the test. Use Vitest's file snapshot or a checked-in fixture, whichever keeps the file smallest. A digest per second with the first differing step reported on failure is acceptable if the full list is too large.

**Focused checks**

The test passes on the unmodified code. Run it twice to prove it is stable.

**Acceptance**

A committed snapshot records today's behaviour, and it reads live projectiles through one helper that step 49.3 can repoint without touching the expected values.

### Step 49.2 - The Authored Bomb Type

Status: complete. Dependencies: 49.1.

**Implementation prompt**

In `game/config/data.ts`, accept a projectile entry with `"type": "bomb"` holding `rangeTiles`, `travelSeconds` and `detonationRadiusTiles` (N21, N24). It must reject `speedTilesPerSecond`, `motion`, and any other `type` value. An entry without `type` validates as a bullet, as today. Remove the `lob` motion kind from the authored union and its validator.

In `game/config/encounter.ts`, make `ProjectileSpec` the `BulletSpec | BombSpec` union from [plan V15](../plan-v15.md), setting `type: "bullet"` on bullets in the loader. Update every reader that used `motion.kind === "lob"` or `speedTilesPerSecond` so bullet-only code narrows on `type`. This includes `resolveShardLifetime`, `boundingRadiusTiles` and the projectile-lifetime function near `encounter.ts:1090`. Keep bomb-related values numerically the same.

Convert the five bomb entries in `game/data/projectiles.json` (`white-bomb-v1`, `white-bomb-v2`, `blue-bomb`, `red-bomb-v1`, `red-bomb-v2`) to the new shape, with `rangeTiles: 1.8` and `travelSeconds: 0.6`, keeping each one's detonation radius, damage, conditions, appearance, source and policies.

At the end of this step bombs may still run through the shard path, reading `rangeTiles` as the distance. `createShard` and the preview's `poseAtAge` use the new fields.

**Focused checks**

Write failing `data.test.ts` cases first: a valid bomb entry; a bomb with `speedTilesPerSecond`; a bomb with `motion`; an unknown `type`; a nonpositive `rangeTiles` and `travelSeconds`; and a `lob` motion on a bullet being rejected. The characterization test still passes.

**Acceptance**

`projectiles.json` changes only in the five bomb entries, and no `lob` motion kind remains in authored or runtime types.

### Step 49.3 - The Separate Runtime

Status: complete. Dependencies: 49.2.

**Implementation prompt**

Create `game/simulation/bombs.ts` with `BombState` from the plan, `createBomb`, `advanceBomb` and `resolveBombDestination(bomb, spawnTiles, bearingRadians, targetTiles)`. An absent target lands at spawn + bearing × `rangeTiles`. A bomb never collides in flight and hits only by detonating, exactly once, in the step its age reaches `travelSeconds`, moving today's logic from `projectiles.ts:327` and `:414` unchanged in behaviour (N22, N25).

Add `bombs: BombState[]` to `SimulationState`, initialised empty and reset wherever `shards` is. In `updateAttackClock`, a bomb projectile creates a `BombState` in `state.bombs` from the shared `state.nextShardId++` (N23). Replace the step's `state.shards.filter` near `simulation.ts:954` with an id-merged walk over both lists that resolves each projectile in ascending id, so hits and detonations occur in the same order as before. Preserve the existing early-out behaviour when the phase is no longer `playing`. Generalize `registerShardHit` to accept either state through the fields it reads. The new-volley overlap loop near `simulation.ts:981` then needs no bomb skip, because only shards are in that list. Remove `detonationTargetTiles` from `ShardState`, and remove the lob branches from `projectiles.ts`.

Find every place `state.shards` is cleared, filtered or counted (`grep -rn "\.shards\b" app/src/game`) and apply the same rule to `state.bombs` (N22). `restampLiveShards` stays shard-only: it only re-applies Crystal Worm debug values, and that encounter has no bombs.

Repoint the characterization helper from step 49.1 to merge both lists by id. Do not change the expected values.

Rewrite tests that find bombs in `state.shards` (N26), in `conditions.test.ts`, `simulation.test.ts`, `projectiles.test.ts`, `phases.test.ts`, `drill.test.ts` and `session.test.ts`. A test that totals peak projectiles sums both lists.

**Focused checks**

Write failing `bombs.test.ts` cases first: destination at the authored range; velocity; one detonation at the exact step; no hit in flight; one hit at most; no event for a bullet; and a detonation that misses still reporting an event. The characterization test passes with no expected value changed, which is this step's main proof.

**Acceptance**

`state.shards` never holds a bomb, ids are shared, and the characterization snapshot is byte-identical to step 49.1.

### Step 49.4 - Drawing And Inspection

Status: complete. Dependencies: 49.3.

**Implementation prompt**

In `game/phaser/encounter.ts`, draw bombs in their own pass: the in-flight body, the red telegraph at `detonationTargetTiles` and the explosion stay visually as they are today, reading from `state.bombs`. Remove the lob branches from the shard draw near `:888`. `inspect()` already clones state, so it exposes `bombs` separately (N26). Keep `bombsDetonated`, `bombExplosionsActive` and `bombExplosionFramesDrawn` as they are.

Update any case in `app/tests/app.spec.ts` that reads bombs from `.shards`.

**Focused checks**

Run the existing Playwright bomb detonation case alone: `npm run test:e2e -- --grep "bomb detonation"`. Compare a screenshot of a bomb's flight, telegraph and explosion against the case's existing attachment.

**Acceptance**

A bomb looks the same on screen, and the Crystal Worm's rendering is untouched.

### Step 49.5 - Record The Rule Change

Status: complete. Dependencies: 49.4.

**Implementation prompt**

Amend the Architecture motion rule in `AGENTS.md`: motion kinds become `linear`, `boomerang`, `turning` and `wavy`, and a bomb is a separate shot type that expires by its travel time and hits only by detonating. In `docs/mechanics.md`, record a bomb's authored fields, the runtime split, N23's merged order and N24's unchanged 1.8 tile landing, and note K02's `lob` is superseded by N21. Run `npm run verify` through the `verifier` subagent.

**Focused checks**

`grep -rn "lob" app/src` finds only the `lobTelegraphSeconds` presentation constant and any comment describing history. `npm run verify` passes.

**Acceptance**

No rules identity changes in this phase, and the characterization test and all gates pass.

## Execution record

Characterized the Queen fight (phase 0 plus drills into phases 1, 2 and 6, mortal and god-mode, per-second digests committed as snapshots) before any bomb change; made a bomb an authored `"type": "bomb"` projectile (rangeTiles 1.8, travelSeconds 0.6, detonationRadiusTiles) and removed `lob`; moved bombs to `state.bombs` with `BombState`, `createBomb`, `advanceBomb` and `resolveBombDestination` in `simulation/bombs.ts`, sharing `nextShardId` and resolved id-merged with shards each step; bombs draw in their own pass; AGENTS.md motion rule and docs/mechanics.md updated. The snapshots are byte-identical to the pre-split recording. Existing tests that read bombs from `state.shards` were rewritten (N26). The `bomb detonation` Playwright case passes. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

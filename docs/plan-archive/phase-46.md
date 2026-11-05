# Phase 46: The Preview Model

> Step prompts and execution records for phase 46 of [plan V14](../plan-v14.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 46.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-46.md` and replace the plan's step lines with one-sentence outcomes.

### Step 46.1 - Export The Engine Helpers

Status: complete. Dependencies: V13 phase 43.

**Implementation prompt**

In `app/src/game/simulation/projectiles.ts`, export `resolveShardLifetime`, `curvedShardPositionAtAge`, `curvedShardOrientationAtAge` and `resolveLobDestination` without changing their signatures or bodies (M20). Export the `CurvedProjectileMotion` type if a caller needs it.

In `app/src/game/phaser/appearance-pixels.ts`, which imports no Phaser, add an exported `BOMB_EXPLOSION_FRAME_SECONDS = 0.04` carrying the existing comment that it is a trainer-authored placeholder because the wiki strip gives no frame timing. Make `presentation.bombExplosion.frameSeconds` in `app/src/game/phaser/encounter.ts` read this constant instead of its own literal (M29).

No other line under `app/src/game/` changes.

**Focused checks**

No new behaviour, so no failing-first test. Run the existing `projectiles.test.ts`, `appearance-pixels.test.ts` and `simulation.test.ts` focused files and confirm they pass unchanged.

**Acceptance**

The four helpers and the constant are importable from `research/`. Simulation behaviour, authored data and rules versions are unchanged, and `phaser/encounter.ts` has no remaining 0.04 literal for the explosion frame time.

### Step 46.2 - Match A Tag To An Authored Attack

Status: complete. Dependencies: 46.1.

**Implementation prompt**

Create `app/src/research/previewModel.ts` with a pure `matchTagAttack(tag, config): PreviewMatch | null` using the `PreviewMatch` shape from [plan V14](../plan-v14.md).

- Look only in the primary archetype's phase at `tag.phaseIndex`, including the attacks of its sub-phases in authored order, and take the first attack whose projectile's `appearance.id` equals `tag.spriteId` and whose pattern family matches: `rotating-arm` and `fixed-ring` match `ring`, `spread` matches `spread`, and `scatter` matches `scatter` (M03).
- Return null for no match, an out-of-range phase, an unknown sprite or the load-only `volley` pattern (M04).
- Build the returned `pattern` by copying the authored one and replacing `arms` (ring) or `shots` (spread, scatter) with `tag.shots` (M05). Keep every other authored field, including aim and fixed bearing. The tag's `aim` does not override the authored aim; it already took part in matching only through the pattern family.

Add `countUnmatchedTags(tags, config)` for M04's count.

**Focused checks**

Write failing tests first, against small hand-built configs rather than the shipped encounter, for: a ring match from `rotating-arm` and from `fixed-ring`; spread and scatter matches; first authored match winning when two attacks qualify; no match when the sprite matches but the pattern family does not; no match for a sprite in a different phase; null for an unknown phase, an unknown sprite and `volley`; `tag.shots` replacing arms and shots while other fields stay; and the unmatched count.

**Acceptance**

Matching is pure, reads no React, DOM or storage, and never invents a value. The shipped Killer Bee Queen's phase-3 `bee-shot` tags in the committed evidence resolve to a match (manual spot check in a test or the console).

### Step 46.3 - The Preview Frame

Status: complete. Dependencies: 46.2.

**Implementation prompt**

Add a pure `previewAt({ tags, timeSeconds, config, playerTiles }): PreviewFrame` to `previewModel.ts`, using the shapes and the per-shard pose rules in [plan V14](../plan-v14.md).

- The emitter is the primary archetype's `spawnTiles` (M07). The frame also carries `config.arena.shape` and `playerTiles`.
- For each matched tag with `tag.timeSeconds <= timeSeconds`, resolve bearings with `resolveBearings(match.pattern, context)`, where the context uses the emitter and `playerTiles`, `ringPhaseRadians` equal to the ring's `initialPhaseRadians` (or 0 for non-rings), `burstsFired: 0`, `secondsSinceEpoch: 0` (M06), and, for scatter, `drawnUnitRandoms` of `(i + 0.5) / shots` (M09). Read `PatternContext` for any other required field and fill it with the same neutral values.
- Offset each spawn point from the emitter by `emitterRadiusTiles` along its bearing, as `simulation.ts` does when it spawns a shard.
- Compute each shard's pose at age `timeSeconds - tag.timeSeconds` with the plan's per-kind rules, reusing the helpers exported in 46.1. For a lob, pass `playerTiles` as the aim point under the same condition the simulation uses when it calls `createShard` with a player position.
- Include a shard while it is live. Include a detonation for a lob whose appearance has a `bomb` spec, from landing for `frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS` seconds (M12, M29).
- Set `unmatchedTagCount` from `countUnmatchedTags`.

**Focused checks**

Write failing tests first for: an empty study giving no projectiles; a tag in the future giving nothing; a tag at age 0 placing every shot at its emitter-offset spawn point; a linear shard's position at a known age; a boomerang shard before and after reversal; a turning and a wavy shard agreeing with `curvedShardPositionAtAge`; a shard disappearing at its lifetime; a lob reaching its destination and its detonation window opening and closing; a player-aimed spread pointing at a moved `playerTiles`; even scatter bearings; a ring with no rotation at any time; and the unmatched count. Also assert that a frame computed for one time does not depend on frames computed before it.

**Acceptance**

`previewAt` is a pure function of its inputs, with no clock or state of its own (M01). Positions agree with the engine's motion maths for every kind. Run `npm run verify` once at the end of the phase.

## Execution record

Exported the engine helpers and `BOMB_EXPLOSION_FRAME_SECONDS`; added `matchTagAttack`, `countUnmatchedTags` and the pure `previewAt` (research/previewModel.ts). Deviation: lob destinations are not player-aimed, because simulation.ts never passes a player position to `createShard`; the preview matches the simulation. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved. Manual checks with a real video are not performed.

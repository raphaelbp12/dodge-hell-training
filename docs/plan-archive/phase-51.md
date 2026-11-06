# Phase 51: Composite Patterns

> Step prompts and execution records for phase 51 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 51.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-51.md` and replace the plan's step lines with one-sentence outcomes.

### Step 51.1 - The Authored Arm Pattern

Status: complete. Dependencies: phase 49.

**Implementation prompt**

Add `ArmPattern` from [plan V15](../plan-v15.md) to `game/config/data.ts`, with a recursive `validateArmPattern`, and an optional `armPattern` on the outermost ring (N03, N05). Carry it through `patternFromAuthored` in `game/config/encounter.ts` and add it to `RingPattern`. Inner angles stay in degrees at runtime, converted when evaluated.

Rules:

- `single` holds nothing else.
- `spread` holds `shots` and `arcDegrees`. `scatter` holds `shots` and `coneDegrees`. Each reuses the outer pattern's count and angle checks and rejects `aim`, `fixedBearingDegrees` and `emitterRadiusTiles` (N06, N07).
- An inner `ring` holds `arms`, optional finite `phaseOffsetDegrees` and optional `armPattern`. It rejects `emitterRadiusTiles`, `clockwiseDegreesPerSecond`, `initialPhaseDegrees`, `perBurstAdvanceDegrees`, `gapSectorsDegrees`, `armSpreadDegreesPerSecond` and `maxArmSpreadDegrees` (N07, N11).
- A `spread` or `scatter` at the top level rejects `armPattern` (N04).
- No depth or volley limit is added (N10). Add a comment saying this is a recorded decision and not an oversight.

**Focused checks**

Write failing `data.test.ts` and `config.test.ts` cases first for every rule above, including a three-level nesting accepted, an existing plain ring unchanged, and `armPattern` absent staying absent after loading.

**Acceptance**

`enemies.json` does not change, and all 53 existing rings load identically.

### Step 51.2 - Resolving Nested Bearings

Status: complete. Dependencies: 51.1.

**Implementation prompt**

In `game/simulation/patterns.ts`, expand each surviving arm of the outermost ring through its `armPattern`, keeping the existing arm loop and gap test untouched so per-burst advance, arm spread and gap tests stay on the arm's bearing (N08).

- `single` or absent: one bearing, the arm's.
- `spread`: the existing evenly spaced formula, centred on the arm's bearing, one shot centred.
- `scatter`: arm bearing + (draw − 0.5) × cone.
- `ring`: for each inner arm `i`, arm bearing + `phaseOffsetDegrees` + `i` × full turn / `arms`, then expanded recursively.

Every resulting bearing carries the outermost `emitterRadiusTiles`, so each shot offsets along its own bearing (N07). Extract the shared spread formula rather than duplicating it.

Export `scatterDrawCount(pattern)`, returning the total scatter draws a volley needs including gap-removed arms (N12). Consume draws from `drawnUnitRandoms` with a cursor in depth-first arm order. A gap-removed arm advances the cursor by its own draw count. An outer `scatter` keeps its current count and order.

**Focused checks**

Write failing `patterns.test.ts` cases first: a 4-arm ring of 3-shot spreads gives 12 bearings in the expected clusters; a 1-shot spread equals its arm; a ring of rings; a phase offset; a three-level nesting; a gap removes a whole arm's shots; a scatter arm with fixed draws; a gap with a scatter arm consumes the same draw count and leaves later arms' bearings the same; emitter offset per shot's own bearing; and an existing plain ring returning exactly its current values.

**Acceptance**

`resolveBearings` stays pure and never draws randomness itself, and existing pattern tests pass unchanged.

### Step 51.3 - Firing A Composite

Status: complete. Dependencies: 51.2.

**Implementation prompt**

In `updateAttackClock`, size `drawnUnitRandoms` from `scatterDrawCount(pattern)` and draw only when it is above zero, so a pattern with no scatter draws nothing and the generator's stream is unchanged. Every other step stays the same: each bearing creates one shard or bomb.

Add a section to `docs/mechanics.md` on composites and N10's accepted risk. Run `npm run verify` through the `verifier` subagent.

**Focused checks**

Write failing `simulation.test.ts` cases first using a test-fixture composite: the right shard count and bearings; a nested scatter drawing one value per final shot in order; identical results across 30, 60 and 120 Hz; a composite firing bombs creating `BombState`s; and rotation moving every arm's cluster together. The characterization test passes unchanged.

**Acceptance**

Nothing shipped uses a composite (N01), and `npm run verify` passes.

## Execution record

Added the recursive `armPattern` (`single`, `spread`, `scatter`, inner `ring`) to the authored schema and `RingPattern` with the N04/N06/N07/N11 rejections and no depth limit (N10), expanded each surviving arm through it in `resolveBearings` (gaps and advance stay on the arm bearing), added `scatterDrawCount` so a gap-removed arm still consumes its draws (N12), sized `updateAttackClock`'s draws from it, and multiplied the shard bound by final shots per arm. No shipped ring changed; the characterization snapshots are unchanged. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

# Phase 39: Killer Honey

> Step prompts and execution records for phase 39 of [plan v10](../plan-v10.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 39.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-39.md` and replace the plan's step lines with one-sentence outcomes.

### Step 39.1 - The Pure Terrain Module

Status: pending. Dependencies: 38.4.

**Implementation prompt**

Add the terrain rules as pure functions, before anything calls them. This traces to W06, W07, W08, W09 and W12.

Create `app/src/game/simulation/terrain.ts`. It must have no React, no Phaser, no DOM and no clock of its own: it takes an arena and a position and returns facts, and the simulation owns when it is asked. Export:

```ts
export const HONEY_SPEED_MULTIPLIER = 0.75;
export const HONEY_RAMP_PER_SECOND = 0.05;
export const HONEY_SPEED_MULTIPLIER_FLOOR = 0.5;
export const HONEY_DAMAGE_HP = 60;
export const HONEY_DAMAGE_INTERVAL_SECONDS = 1;

export function honeyAt(arena: Arena, positionTiles: Vector2): boolean;
export function honeySpeedMultiplier(contactSeconds: number): number;
```

`honeyAt` offsets the position by the arena centre, then returns true if it lies in any `hazards` entry: a `diamond` region when `|dx| + |dy| <= halfDiagonalTiles`, an `annulus` when `innerRadiusTiles <= hypot(dx, dy) <= outerRadiusTiles`. Per W12 the caller passes the player body's **centre**, not an outline - keep that in a comment, because the containment code one module over is a body test and the difference is exactly the kind of thing a later reader would "unify".

`honeySpeedMultiplier` returns `max(FLOOR, HONEY_SPEED_MULTIPLIER - HONEY_RAMP_PER_SECOND * contactSeconds)`. Reject a negative `contactSeconds` with a `RangeError`, matching how the geometry helpers reject bad input.

The comments on the constants must label their provenance precisely, because two of these five are not wiki facts:

- `HONEY_SPEED_MULTIPLIER` and `HONEY_DAMAGE_HP`: wiki, `https://www.realmeye.com/wiki/killer-honey`, "deals 60 armor piercing damage and reduces player's movement speed by 25%".
- `HONEY_RAMP_PER_SECOND` and `HONEY_SPEED_MULTIPLIER_FLOOR`: **trainer-authored under W09.** The wiki says only that the player gets slower the longer they stand in honey, with no number on any of the Killer Honey, Honey or Quicksand pages. Say so in the comment and do not imply otherwise.
- `HONEY_DAMAGE_INTERVAL_SECONDS`: **inferred under W11** from Evil Water's published "55 armor piercing damage per every second"; the Killer Honey page states no interval. Say so in the comment.

Also move the arena containment predicate here if the scene or a future caller needs a point-in-arena test without a body: `arenaContains(shape, positionTiles)`, circle and octagon forms. Add it only if 39.4 needs it for drawing; otherwise leave it out rather than ship an unused export.

**Focused checks:** failing test first on `honeyAt` at the pond boundary. Then, against the authored `nest-boss-room`: the centre is honey; a point at `(3.5, 0)` is honey and `(3.51, 0)` is not; `(1.75, 1.75)` is honey and `(1.8, 1.8)` is not, which is what distinguishes the diamond from a circle; a point at radius 5 is safe; `(7.5, 0)` and `(9.5, 0)` are honey and `(7.49, 0)` is not; a point outside the arena entirely still reports honey if it is inside the annulus, since `honeyAt` is not a containment test and must not pretend to be. Against `crystal-worm-circle` with no hazards, every point is safe. Then `honeySpeedMultiplier`: 0.75 at 0 s, 0.70 at 1 s, 0.50 at exactly 5 s, 0.50 at 10 s, and a `RangeError` at -1. Focused Vitest only.

**Acceptance:** `terrain.ts` exists, is pure, exports the five constants with provenance comments that distinguish wiki facts from the two trainer-authored values and the one inference, and `honeyAt` and `honeySpeedMultiplier` behave as above; the diamond is a diamond and not a circle; an arena with no hazards reports safe everywhere.

### Step 39.2 - The Honey Movement Penalty

Status: pending. Dependencies: 39.1.

**Implementation prompt**

Make honey slow the player. This traces to W09, W10 and W13.

Add two fields to `PlayerState` in `app/src/game/models.ts`, exactly as [plan v10](../plan-v10.md)'s Target Data Shapes section gives them: `honeyContactSeconds` and `nextHoneyDamageAtSeconds`, both initialised to 0 in `createSimulation`. This step uses the first; 39.3 uses the second. Initialising both here keeps one edit to the state shape.

In `app/src/game/simulation/conditions.ts`, `playerTravelTiles` currently resolves a speed from the paralyzed and slowed conditions. Multiply its result by `honeySpeedMultiplier(player.honeyContactSeconds)` when that contact is above zero. Honey is a multiplier on whatever the condition model already decided, so paralyzed stays 0 and slowed's 4.0 tiles/s is itself reduced by honey - which is right, because the wiki describes two independent effects. Per W10 honey never sets a condition and never appears in `visibleConditions`, so no HUD chip changes.

In `app/src/game/simulation/simulation.ts`, accumulate the contact. Immediately after `updateMovement` has produced the player's final position for the step, and only while the attempt is `playing` per W13:

- if `honeyAt(config.arena, state.player.positionTiles)`, add `fixedStepSeconds` to `honeyContactSeconds`;
- otherwise set `honeyContactSeconds` to 0, which is W09's instant reset with no decay rate.

The ordering is the thing to get right and to pin: occupancy is evaluated **after** movement, so the multiplier a step uses comes from the contact accumulated before it. Entering honey therefore slows the player from the next step, one 60 Hz step later - the same one-step lag the condition model already has, and the reason the condition model documents its own ordering. Put that reasoning in a comment.

Per W13, nothing else reads terrain: no enemy, minion or projectile path may call `honeyAt`. Per W29 nothing about the camera changes.

**Focused checks:** failing test first on the player's travel in honey. Then: a player standing still in honey accumulates contact at the step rate; a player moving through honey travels `7.061 * 0.75` tiles per second on the step after entry, within one step's tolerance; after 5 seconds of unbroken contact the rate is `7.061 * 0.5`; leaving honey for one step resets the contact to 0 and the very next step is full speed; re-entering starts the ramp from 0.75 again; a slowed player in honey travels `4.0 * 0.75` tiles per second; a paralyzed player in honey travels 0; the step on which the slow first applies is exactly the one after the step whose final position was in honey, asserted on recorded per-step travel rather than on an aggregate; and during the start countdown a player inside the pond accumulates no contact and travels at full speed. Confirm nothing else moved: enemy positions over a fixed seed and input sequence are identical to before this step. Focused Vitest only.

**Acceptance:** `PlayerState` carries both new fields initialised to 0; `playerTravelTiles` applies the honey multiplier on top of the condition result; contact accumulates after movement and resets instantly on leaving; the slow first applies on the step after entry and that exact step is asserted; honey is inert during the countdown; no condition or HUD chip is involved; and no enemy or projectile path reads terrain.

### Step 39.3 - The Honey Damage Clock

Status: pending. Dependencies: 39.2.

**Implementation prompt**

Make honey hurt. This traces to W11, W13 and W14.

In `app/src/game/simulation/simulation.ts`, in the same place 39.2 evaluates occupancy and while the attempt is `playing`:

- when the player is in honey and `state.elapsedSeconds >= player.nextHoneyDamageAtSeconds`, apply `HONEY_DAMAGE_HP` as armor-piercing damage through the **existing** shared hit path - the one a shard and an enemy contact already share - and set `nextHoneyDamageAtSeconds` to `state.elapsedSeconds + HONEY_DAMAGE_INTERVAL_SECONDS`;
- when the player is not in honey, set `nextHoneyDamageAtSeconds` back to 0, so re-entering damages on the first step inside. That is deliberate: dipping in and out must not be cheaper than standing still.

Because it goes through the shared hit path, the tick counts in `hitsTaken`, appears in the hit log and plays the hit audio exactly like any other damage, which is W14. Do not add an environmental counter, a separate HUD figure or a new `AcceptedHit` field. Armor-piercing means the existing `effectiveDefenseFor(player, true)` branch, so Armor Broken and Exposed are already irrelevant to it; confirm that rather than re-deriving it.

Honey damage must not run during countdown, pause or after the attempt ends. `regeneratePlayer` and the shard hit path are already gated to `playing`; reuse that gate rather than widening it. Honey damage can kill: the attempt ends through the same path a lethal shard uses, with no special case.

**Focused checks:** failing test first on the first tick. Then: a player placed in the pond at t=0 takes 60 on the first `playing` step, not on the countdown steps before it; the next tick lands 1.0 s later and not sooner, asserted on the step index; standing in honey for 3.05 s yields exactly 4 ticks; stepping out at 0.5 s and back in at 0.6 s damages again on re-entry, and the clock restarts from there; the damage is armor-piercing, proven by an Armor Broken player taking the same 60 as an unbroken one; each tick increments `hitsTaken` by one and appears in the hit log with the player's position; the hit audio play count rises by one per tick; honey damage can reduce health to zero and ends the attempt through the normal path; and no honey damage occurs while paused or after the attempt ended. Focused Vitest only; the phase's single `npm run verify` comes at the end of 39.4.

**Acceptance:** honey applies 60 armor-piercing HP on a 1.0 s per-player clock through the shared hit path; it counts in `hitsTaken`, the hit log and the hit audio with no new counter or field; the clock resets on leaving so re-entry damages immediately; it never fires outside `playing`; a lethal tick ends the attempt normally; and every timing assertion is on step indices rather than aggregates.

### Step 39.4 - The Honey And Honeycomb Floor Art

Status: pending. Dependencies: 39.3.

**Implementation prompt**

Make the floor look like the Nest, procedurally. This traces to W16, and it is drawing only - no rule depends on it.

Extend `drawGround` in `app/src/game/phaser/encounter.ts`, on top of 38.4's shape-driven fill and inside the arena outline:

- **Safe floor**: a two-tone honeycomb cell pattern over the base fill. Generate it from the tile grid - a small repeating motif per tile, two shades of the existing ground colour - so it needs no asset and no authored grid. Keep it cheap: it is drawn once into the `ground` graphics at create time and on resize, never per frame.
- **Honey**: fill each of the arena's `hazards` regions with an amber colour and stroke a lighter rim just inside its boundary, so the player can see where the penalty starts. Draw the `diamond` as a diamond and the `annulus` as a ring, matching W08's shapes exactly - a circular pond or a square ring would misinform the player about where they are safe.
- Keep 38.4's tile staircase boundary stroke on top, and keep the existing tile grid.

Add the two new colours to the `presentation` block beside `ground`, `grid` and `boundary`; do not inline hex strings at the call site. Per W15 there is no HUD indicator: the floor art is the only signal, which is why the rim matters.

The Crystal Worm has no hazards, so its arena renders exactly as 38.4 left it. Assert that rather than assume it.

**Focused checks:** the drawing is not unit-tested, but the geometry feeding it is, so extract any region-to-outline conversion as a pure exported helper and test that: the diamond outline for `halfDiagonalTiles: 3.5` has its four vertices at `(+/-3.5, 0)` and `(0, +/-3.5)`; the annulus produces an inner and an outer radius of 7.5 and 9.5; an arena with an empty `hazards` array produces no outlines. Then confirm by hand in the running app and record it in the execution notes: the Queen's room shows the diamond pond, the honey rim and the honeycomb pattern inside the stepped octagon; the rim is visible against the honey fill; the Crystal Worm's arena is unchanged; and the honeycomb pattern does not degrade the frame figures - re-run V9's phase-3 drill observation and note the peak live-shard and part counts beside V9's 112 and 1,256, confirming no regression and widening no bound. Then `npm run verify` once for the whole phase, and read `app/test-results/verification/<gate>.log` only if a printed excerpt is not enough.

**Acceptance:** safe floor carries a procedural two-tone honeycomb pattern and each honey region is filled in its authored shape with a lighter rim; the new colours live in `presentation`; the pattern and fills are drawn once, not per frame; the Crystal Worm's arena is unchanged; the region-outline helper is pure and tested; the hand confirmation and the phase-3 drill frame figures are recorded; and `npm run verify` passes all four gates.

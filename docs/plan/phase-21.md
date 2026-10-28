# Phase 21: Player Conditions And The Damage Model

> Step prompts and execution records for phase 21 of [plan v5](../plan-v5.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 21.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-21.md` and replace the plan's step lines with one-sentence outcomes.

### Step 21.1 - Add Condition State, Application And Ticking

Status: complete. Dependencies: 20.5.

**Implementation prompt**

Give the player status conditions. This step adds the state and its lifecycle only; no condition yet changes movement or damage, and no shipped projectile applies one.

Create `app/src/game/simulation/conditions.ts`. Define the full key set from [the source extract](../killer-bee-queen-source.md)'s status table, all thirteen that the Queen can inflict:

```ts
export const ACTIVE_CONDITIONS = ["paralyzed", "slowed", "confused",
  "armorBroken", "exposed", "cursed", "sick"] as const;
export const INERT_CONDITIONS = ["dazed", "silenced", "quiet",
  "weak", "unstable", "petStasis"] as const;
```

All thirteen are authorable, validated, stored and displayed; only the seven active ones ever change a rule. That is K03. Tracking the inert six is deliberate and is not speculative state: the authored data stays faithful to the source, the HUD can honestly tell the player what the live game would be doing to them, and promoting one later is a data change rather than a model change. Put that reasoning in a comment so a later reader does not "simplify" it away.

Add `conditionSeconds: Record<ConditionKey, number>` to `PlayerState`, initialised to zero for every key in `createSimulation`. Give the module three operations:

- `applyConditions(player, conditions)` where `conditions` is the authored array from a projectile. The refresh rule is `remaining = Math.max(remaining, appliedSeconds)`: a longer application replaces a shorter remainder, a shorter one never shortens a longer remainder, and durations never stack or sum.
- `tickConditions(player, stepSeconds)` decrements every nonzero entry, clamping at zero.
- `hasCondition(player, key)` returns whether its remaining time is greater than zero.

**Ordering inside the fixed step, which must be exact and tested.** Call `tickConditions` at the **start** of each step, before player movement. A condition applied by a hit during step N is therefore read at full strength by step N+1's movement and damage, and is never shortened by the step that applied it. Do not decrement at the end of the step; do not decrement inside `applyConditions`.

Extend `config/data.ts` so a projectile's `conditions` array is validated: each entry an object with a `key` from the thirteen and a `seconds` greater than zero; reject an unknown key, a duplicated key within one projectile, and a nonpositive duration. Author nothing into `projectiles.json`: the Crystal Worm shard keeps its empty `conditions` array.

Also expose the condition state through `inspect()` and the Playwright `Inspection` type, since later steps and the acceptance run need to observe it.

**Focused checks:** focused failing test on `applyConditions` first. Then: a fresh player has every key at zero; applying 1.4 seconds sets exactly 1.4; re-applying 0.8 over a 1.4 remainder leaves 1.4; re-applying 3 over a 1.4 remainder sets 3; ticking decrements by the step and clamps at zero rather than going negative; a condition expires on the exact step boundary; `hasCondition` is false at exactly zero; a hit in step N leaves the condition at full duration for step N+1, asserted on the recorded remaining time; validation rejects an unknown key, a duplicate key and a zero or negative duration. Confirm no gameplay changed: every pre-existing assertion passes unchanged. All four routine gates.

**Acceptance:** all thirteen conditions are modelled, refreshed by the maximum rule, ticked once at the start of each step, validated at the data boundary and visible to `inspect()`; no condition yet changes a rule; nothing pre-existing changed; and all four gates pass.

**Execution and verification - 2026-10-27**

Added `simulation/conditions.ts` with the seven active and six inert keys, deliberate inert-state documentation, zero-filled initialisation, maximum-rule refresh, start-of-step ticking with exact-boundary clamping, and positive-remainder queries. `PlayerState.conditionSeconds` is initialised by `createSimulation` and is therefore included in the existing structured-clone `inspect()` payload and its Playwright `PlayerState` type. Authored projectile conditions now have typed entries and loader validation for objects, known keys, duplicates and positive finite durations. No shipped JSON value changed.

Accepted-hit condition application was included in this step because its required hit-ordering test cannot otherwise observe the lifecycle; step 21.3 retains all condition-aware damage work. This does not change shipped gameplay because the Crystal Worm still authors no conditions. A machine-precision relative tolerance handles exact expiry after floating-point subtraction without changing zero-step behavior. The apply/refresh, ticking, accepted-hit ordering and six malformed-data cases were each watched fail before implementation.

Checks run from `app/` with Node 24.22.1/npm 12.2.1: focused condition/data tests - 95/95 passed; `npm run lint` (pass); `npm run typecheck` (pass); `npm run test` - 508/508 passed across 14 files; `npm run build` (pass, existing large-chunk warning only). No blockers.

### Step 21.2 - Apply The Movement Conditions

Status: complete. Dependencies: 21.1.

**Implementation prompt**

Make Paralyzed, Slowed and Confused change how the player moves. These are the three conditions that directly change dodging, so they are the heart of what this boss teaches.

Each rule comes from the source's status table, quoted in [the source extract](../killer-bee-queen-source.md), and each maps onto this project's existing movement derivation in `config/stats.ts`:

- **Paralyzed** - "Renders entity completely immobile." The player's travel this step is zero. Input is still read and still has no effect; do not freeze the simulation, the camera or anything else.
- **Slowed** - "Reduces player SPD to 0 during movement speed calculation, resulting in a base speed of 4 tiles/second." Do not author 4 as a literal. Derive it by running the existing `derivePlayerStats` with the Paladin's speed stat replaced by zero, which yields `STAT_RULES.movement.baseTilesPerSecond` exactly. Compute it once as a module constant and assert in a test that it equals 4 and that it is strictly less than the Paladin's 7.0613 tiles per second.
- **Confused** - "Changes controls by swapping directional controls... Left > Down, Down > Left, Right > Up, Up > Right." Apply this as a transform on `SimulationInput` before the direction vector is built: west becomes south, south becomes west, east becomes north, north becomes east. Transform the input, do not negate the resulting vector - a sign flip is a different and wrong effect. Note that this mapping is its own inverse, so applying it twice returns the original input; assert that.

Implement these as a single `playerTravelTiles(player, stepSeconds)` and a single `effectiveInput(player, input)` in `conditions.ts`, called from `updateMovement` in `simulation.ts`. Paralyzed takes priority over Slowed, since zero speed is already the stronger effect; the published rule that Slowed "nullifies the effects of Speedy" has no referent here because no positive conditions exist.

These conditions affect the **player only**. Enemy movement is untouched: nothing in this encounter slows or paralyses an enemy, and the player cannot attack. Do not add condition state to `EnemyState`.

No shipped projectile applies a condition yet, so apply these in tests by setting `conditionSeconds` directly on a simulation state.

**Focused checks:** focused failing test that a paralysed player does not move first. Then: a paralysed player holding every direction stays exactly in place for the whole duration and moves again on the first step after expiry; a slowed player travels exactly `4 * stepSeconds` per step and the derived constant equals 4 and is below 7.0613; paralysed plus slowed moves zero; each of the four confused mappings is correct, applied to a single direction and to a diagonal; the confused transform applied twice is the identity; the diagonal normalisation still holds under confusion, so a confused diagonal is no faster than a straight line; and arena containment still holds under every combination. Confirm nothing pre-existing changed. All four routine gates.

**Acceptance:** Paralyzed, Slowed and Confused change player movement exactly as the source specifies, the slowed speed is derived rather than authored, the confused mapping is the published one and is self-inverse, enemies are unaffected, nothing pre-existing changed, and all four gates pass.

**Execution and verification - 2026-10-27**

Added `playerTravelTiles` and `effectiveInput` in `simulation/conditions.ts` and composed them into the existing player-only movement path. Paralyzed produces zero travel and takes priority; Slowed derives its speed once through `derivePlayerStats({ ...PALADIN_STATS, speed: 0 })`, yielding 4 tiles/second without an authored gameplay literal; Confused applies the published west→south, south→west, east→north, north→east input transform. Enemy state and movement rules were not changed.

Tests cover paralysis in every direction and diagonal, expiry-step recovery, Paralyzed-plus-Slowed priority, exact slowed travel and derived speed, every confused mapping including a diagonal, self-inversion, confused diagonal normalization, and containment for all eight movement-condition combinations. The paralysis, slowed-speed and confused-mapping checks were watched fail before their implementations.

Checks run from `app/` with Node 24.22.1/npm 12.2.1: focused condition tests - 13/13 passed; `npm run lint` (pass); `npm run typecheck` (pass); `npm run test` - 516/516 passed across 14 files; `npm run build` (pass, existing large-chunk warning only). No deviations or blockers.

### Step 21.3 - Apply The Damage Conditions And Armor Piercing

Status: pending. Dependencies: 21.2.

**Implementation prompt**

Make Armor Broken, Exposed, Curse and Sick change damage and regeneration, and make a projectile's `armorPiercing` flag mean something. Most of the Queen's shots ignore defence, so this is what makes her dangerous rather than merely busy.

**The formula, which must be implemented exactly as written.** Defence is resolved first, may go negative, and Curse is applied last:

```ts
// conditions.ts - named constants, both sourced from the status-effects page
const EXPOSED_DEFENSE_PENALTY = 20;
const CURSE_DAMAGE_MULTIPLIER = 1.25;

export function effectiveDefenseFor(player, armorPiercing): number {
  let defense =
    armorPiercing || hasCondition(player, "armorBroken")
      ? 0
      : PALADIN_STATS.defense;
  if (hasCondition(player, "exposed")) defense -= EXPOSED_DEFENSE_PENALTY;
  return defense;
}
```

Then change `calculateDamageHp` in `config/stats.ts` to take a signed defence and a `cursed` flag:

```ts
damage = Math.max(rawDamageHp - defense, rawDamageHp * minimumFraction);
if (cursed) damage *= CURSE_DAMAGE_MULTIPLIER;
return Math.ceil(damage);
```

`calculateDamageHp` currently calls `assertNonnegative(defense, "defense")`. **Remove that assertion** and replace it with a finiteness check, because Exposed legitimately produces a negative defence - that is exactly how the source's "20 more damage per hit" against an armour-piercing or Armor-Broken target arises. Keep the existing zero-raw-damage early return: a Red Glaive deals 0 damage and exists only to apply Armor Broken for 7 seconds, so it must still count as a hit and must still apply its condition.

These are the seven cases to pin as tests, for a raw 100-damage shot against the Paladin's 32 defence:

| Case | Effective defence | Damage |
| ---- | ----------------- | ------ |
| none | 32 | 68 |
| armour-piercing | 0 | 100 |
| Armor Broken | 0 | 100 |
| Exposed | 12 | 88 |
| armour-piercing + Exposed | -20 | 120 |
| Armor Broken + Exposed | -20 | 120 |
| Curse only | 32 | 85 |

**Two things to record as interpretations, not facts.** First, Curse is applied after the minimum-damage floor; the source says only that Curse is calculated "after defense and defense modifiers" and says nothing about the floor. Second, the source's two sentences about Armor Broken against an already-negative defence cannot both hold in one linear formula; the formula above is correct for every defence of 20 or more, and the only player preset has 32, so the sub-20 case is deliberately not modelled. Both notes belong in the step's execution record and in the mechanics contract section written in 19.1.

**Sick** stops regeneration: in `regeneratePlayer`, when the player has `sick`, add no HP at all - neither the normal nor the in-combat rate - while still decrementing `combatRemainingSeconds` so the combat window expires on schedule.

Wire it together: `registerShardHit` resolves the firing projectile through `projectileOf`, computes `effectiveDefenseFor(player, projectile.armorPiercing)`, passes it and the `cursed` flag to `applyPlayerHit`, and calls `applyConditions(player, projectile.conditions)` on an accepted hit. Apply conditions **only** on an accepted hit, so the once-per-shard rule governs conditions exactly as it governs damage.

**Focused checks:** focused failing test on the armour-piercing-plus-Exposed case producing 120 first. Then: all seven table rows exactly; `calculateDamageHp` accepts a negative defence and rejects a nonfinite one; the minimum-damage floor still applies to a high-defence low-damage shot; a 0-damage condition-only projectile registers a hit, applies its condition and deals 0; a sick player regenerates nothing while the combat timer still counts down; conditions are applied once per shard and a second overlap by the same shard applies nothing; and the existing `applyPlayerHit` and regeneration tests pass unchanged for an unconditioned player. All four routine gates.

**Acceptance:** the condition-aware damage formula matches all seven cases, negative defence is supported and tested, Sick stops regeneration without stalling the combat timer, conditions are applied once per shard on accepted hits only, the two unsourced interpretations are recorded, and all four gates pass.

### Step 21.4 - Show Active Conditions To The Player

Status: pending. Dependencies: 21.3.

**Implementation prompt**

A dodge trainer that paralyses the player without saying so is unusable. Surface the active conditions.

Draw them in **Phaser**, beside the existing health bar in `phaser/encounter.ts`, not in React. React must not re-render per frame, and the health bar already establishes this pattern for fast-changing player state. Reuse `drawHealthBar`'s layout approach and its colour constants rather than introducing a second styling route.

For each condition with remaining time greater than zero, draw a small labelled chip showing a short name and the remaining seconds to one decimal place. Order them by the declaration order of `ACTIVE_CONDITIONS` followed by `INERT_CONDITIONS`, so the display never jitters as durations change. Mark an inert condition visibly - a dimmed chip and the word "inert" in its tooltip or label - so the player can see the live game would be affecting them while this trainer does not. Take the colours, chip size and spacing from the existing presentation constants in that file; add new ones there with explicit units rather than inlining numbers at the draw site.

Add the condition names to the existing Controls dialog's content so the player can read what each one does, using the source's published wording for the seven active ones and "no effect in this trainer, because the player does not attack" for the six inert ones.

Do not add a React HUD element, a per-frame React state update, a condition timeline, or a settings toggle.

**Focused checks:** a focused Vitest check that the renderer's draw routine emits one chip per active condition in the declared order, following whatever seam the existing `drawEntities` and `drawHealthBar` tests already use; a check that an expired condition draws nothing; a React test that the Controls dialog lists all thirteen conditions and marks the six inert ones; and `npm run test:e2e -- --grep "<the condition display test you add>"` for the browser path. Confirm no React component re-renders per frame, by showing that no new state or effect was added to a per-frame path. All four routine gates.

**Acceptance:** active conditions are visible in the Phaser layer with remaining time, inert ones are visibly marked as inert, the Controls dialog documents all thirteen, no per-frame React update was introduced, and all four gates pass.

### Step 21.5 - Implement Enemy Contact Damage

Status: pending. Dependencies: 21.4.

**Implementation prompt**

Implement K17. The archetype has carried `contactDamageHp` and `blocksPlayer` since step 15.3, validated and asserted to be `0` and `false`, with no behaviour behind them. The Small Worker Bee needs them: its only attack is an invisible projectile at speed 0 and range 0, and [the source extract](../killer-bee-queen-source.md) records its behaviour as "Charges at player attempting to do contact damage" for 40 armour-piercing damage and Slowed for 1.6 seconds.

Extend the archetype's contact block to carry what a touch attack needs: `contactDamageHp`, `contactConditions` shaped exactly like a projectile's `conditions`, `contactArmorPiercing` and `contactCooldownSeconds`. The cooldown is essential - without it an overlapping enemy would apply damage sixty times a second - and it is `trainer-authored`, because the source gives no rate. Track the next eligible contact time per enemy in `EnemyState`, not globally, so two touching enemies each hit on their own schedule.

Resolve contact once per fixed step, after enemy movement and before shard advance, so a chasing enemy's new position is the one tested. Use the existing swept convex overlap between the enemy's body and the player's body across the step, exactly as shards do - **not** a cheaper distance check, because a fast-charging minion must not tunnel through the player between steps. Route an accepted contact through the same `registerShardHit` path that projectiles use, so damage, conditions, the condition-aware defence formula from step 21.3, the hit audio and the floating damage number all behave identically. Where that path needs a shard id, pass a stable synthetic identity derived from the enemy id rather than minting a fake shard.

Contact damage is **not** once-per-enemy: it repeats on its cooldown for as long as the bodies overlap. That is the opposite of the per-shard rule and is correct - it is the pressure that makes a charging minion dangerous. Make the difference explicit in a comment so a later reader does not "fix" it into once-only.

Leave `blocksPlayer` behaviour out of this step. No enemy in this encounter blocks, G16 says enemies pass through each other, and implementing collision pushback is a separate mechanic with its own design questions. Keep the field validated and keep asserting it is `false`.

The Crystal Worm keeps `contactDamageHp: 0`, and `validateEncounterConfig` must keep asserting it, so a zero contact damage must mean "no contact attack at all" rather than "a zero-damage hit on a cooldown". Short-circuit before the overlap test when contact damage is zero and there are no contact conditions, both for correctness and to keep the per-tick cost off encounters that do not use it.

**Focused checks:** focused failing test that an overlapping contact-damaging enemy damages the player first. Then: contact applies on the cooldown and not every step, asserted on hit count over a known duration; it repeats while overlapping, unlike a shard; it stops when the bodies separate and resumes when they overlap again; two overlapping enemies hit on independent schedules; contact conditions are applied through the same path, proven by a contact that applies Slowed and measurably halves the player's travel; `contactArmorPiercing` goes through step 21.3's formula, so 40 armour-piercing damage deals 40 rather than 8; a fast enemy crossing the player within one step still registers, which is the tunnelling regression test; an archetype with zero contact damage and no contact conditions never runs the overlap test; and the Crystal Worm's zero-contact assertion still holds with every pre-existing assertion unchanged. All four routine gates.

**Acceptance:** enemies with authored contact damage hit the player on a cooldown through the shared hit path, the swept test prevents tunnelling, contact conditions work, the repeat-versus-once-only difference is documented, `blocksPlayer` is untouched, zero-contact archetypes short-circuit, and all four gates pass.

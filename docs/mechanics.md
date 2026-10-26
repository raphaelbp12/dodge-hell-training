# Vertical Slice Mechanics Contract

Status: complete under delegated decision-making on 2026-10-24; ready for user review. No application implementation is authorized by this document alone.

Initial encounter/preset rules version: `crystal-worm-child-head-paladin-v1`.

Current implementation: `crystal-worm-child-head-paladin-v3`. The user explicitly approved promoting **Load selected values** to normal defaults on 2026-10-25. See [Selected V3 Defaults](#selected-v3-defaults) for that override and [Implemented V2 Handoff](#implemented-v2-handoff) for unchanged behavior, presentation policies and acceptance limits. Earlier sections preserve dated historical evidence.

## Selected V3 Defaults

**User-defined, 2026-10-25:** the previously saved screenshot values are now the normal, scoring-eligible configuration. Player/head dimensions are 1.25x1.25 tiles, with matching enabled by default; six emitters, offset 0.35 tiles, phase zero, clockwise rotation 45 degrees/s; eleven shots per emitter at 0.19-second intervals, 3-second cooldown after the last shot and 2-second initial cooldown. Projectiles retain their pointed hexagon at 1.45x0.65 tiles, deal 160 HP before defense, move at 8 tiles/s, reverse once at 1.5 seconds and expire at 3 seconds. This supersedes prior debug-only restrictions for these specific defaults, not other debug options.

These are selected trainer values, not externally verified ROTMG dimensions or timings. Historical v2 screenshot geometry and its geometry-derived reversal/lifetime remain recorded below but no longer supply active body dimensions or projectile timings. The existing 60 Hz scheduler fires each scheduled shot on its first eligible fixed tick; 0.19 seconds is not an integral tick count. No sub-tick clock or changed collision policy was introduced. Pursuit speed, spawn, arena, Paladin stats, once-per-shard hits and lifetime-only expiration are unchanged.

Normal attempts use `crystal-worm-child-head-paladin-v3`; previous rules versions remain in history but do not contribute to the v3 best. Loading already-default values is scoring eligible. God mode, center chasing, disabled size matching or numeric deviations still taint the current attempt until a fresh default Start/Retry. Reset restores the selected v3 defaults rather than the historical v2 preset. No release/publication verification is implied by this local change.

Research/access date: 2026-10-24.

## Authority And Evidence

Read alongside the [implementation plan](../implementation-plan.md) and [original draft](../first-draft.md). Subsequent explicit user decisions take priority over the original draft. This document does not authorize scaffolding or gameplay implementation.

Labels used throughout:

- **User-defined**: explicitly requested or approved by the user; binding for this trainer, but not independently verified ROTMG behavior.
- **Verified**: supported by readable source content obtained during this research. This establishes what the cited wiki says, not independent validation of the current game client; contradictions and article age remain relevant.
- **Unknown**: not established by accessible evidence or user approval.
- **Proposed**: a recommendation awaiting approval, not a default that implementers may silently use.
- **Conditional derivation**: arithmetic under stated assumptions, not evidence that the assumptions match ROTMG.
- **Delegated decision**: selected by the agent after the user authorized autonomous decisions for later review. Binding for implementation unless changed by the user, but not an explicit endorsement of each individual value or proof of ROTMG fidelity.

### Source Access Log

Initial fetch requests and the first browser attempt returned only `Just a moment...`. On a later attempt on the same date, the VS Code browser rendered the articles successfully. Read the browser's accessibility snapshot or rendered body text, not the initial fetch response; retain the captured snapshot when a tab becomes unavailable. No challenge bypass was attempted. The log distinguishes original failures from successful browser follow-up.

| ID  | Attempted URL                                          | Intended evidence                                               | Result on 2026-10-24                                                                          |
| --- | ------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| S1  | https://www.realmeye.com/wiki/crystal-worm-child       | Head attack, shard stats/range/return behavior                  | Browser read succeeded; article labels last update Aug 2019                                   |
| S2  | https://www.realmeye.com/wiki/paladin                  | Starting stats and level-up gain distributions                  | Browser read succeeded; article labels last update Sep 2025                                   |
| S3  | https://www.realmeye.com/wiki/character-stats          | Movement, defense, vitality, health, collision rules/references | Browser read succeeded                                                                        |
| S4  | https://www.realmeye.com/wiki/sword-of-acclaim         | Candidate sword reference; tier/bonuses not established         | Blocked                                                                                       |
| S5  | https://www.realmeye.com/wiki/ravenheart-sword         | Alternate candidate sword reference                             | Browser read succeeded: T8, not requested T10; item navigation identifies T10 Archon Sword    |
| S6  | https://www.realmeye.com/wiki/desolation-armor         | Candidate armor reference                                       | Browser read succeeded: T9, not requested T10; item navigation identifies T10 Vengeance Armor |
| S7  | https://www.realmeye.com/wiki/seal-of-the-divine       | T4 seal passive bonuses                                         | Browser read succeeded: T4, +3 DEX on equip                                                   |
| S8  | https://www.realmeye.com/wiki/ring-of-exalted-health   | Candidate health-ring reference; tier/bonuses not established   | Blocked                                                                                       |
| S9  | https://www.realmeye.com/wiki/vital-combat             | In-combat trigger, duration, healing changes                    | Browser snapshot read succeeded; threshold descriptions conflict                              |
| S10 | https://www.realmeye.com/wiki/controls                 | Candidate controls URL                                          | Browser revealed missing page; links to S12                                                   |
| S11 | https://www.realmeye.com/wiki/ring-of-paramount-health | T4 health ring passive bonuses                                  | Browser read succeeded: T4, +100 HP and +20 MP                                                |
| S12 | https://www.realmeye.com/wiki/controls-and-commands    | Correct controls article                                        | Browser read succeeded                                                                        |
| S13 | https://www.realmeye.com/wiki/archon-sword             | Correct T10 sword                                               | Browser snapshot read succeeded: T10; no passive On Equip bonus listed                        |
| S14 | https://www.realmeye.com/wiki/vengeance-armor          | Correct T10 heavy armor                                         | Browser snapshot read succeeded: T10, +22 DEF on equip                                        |

Candidate item URLs are research leads, not a claim that those items match the requested tiers. S5's navigation identifies Sword of Acclaim as T12, not T10; S11 identifies Ring of Exalted Health as T5, not T4. S6 records that Desolation Armor changed from T10 to T9 in Nov 2024. Use current item-tier evidence, not remembered names. S13/S14 establish the correct T10 items and listed bonuses.

Browser access now resolves most of the original access gap; the user need not supply screenshots for articles already read. Continue through correct linked references for remaining gaps. Label user-provided evidence by provenance; do not present it as independently accessed. Use official linked references when available and note version differences. Do not substitute an old private-server implementation for current ROTMG rules without explicit approval of that limitation.

## Confirmed Trainer Rules

All entries in this section are **user-defined**, not claims of external verification.

| Part                     | Contract                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Objective                | Endless survival against one Crystal Worm Child Head; repeat attempts for practice                                                 |
| Character                | Fixed average unpotted level-20 Paladin; identical stats every attempt                                                             |
| Loadout                  | T10 sword, T10 heavy armor, T4 seal, T4 health ring; passive bonuses only                                                          |
| Excluded actions         | Player cannot attack or activate the seal                                                                                          |
| Visible attributes       | Health, vitality, speed, defense                                                                                                   |
| Movement                 | WASD; derived speed and approved diagonal/collision rules below                                                                    |
| Arena                    | Circular; player at center, enemy near an edge; no shrinking or hazards                                                            |
| Enemy movement           | Slow pursuit of the player; enemy slower than Paladin                                                                              |
| Fidelity exception       | Pursuit is intentional; the draft's wiki quotation instead describes irregular wandering                                           |
| Emitters                 | Four, separated by 90 degrees; clockwise rotation; radial outward firing                                                           |
| Bursts                   | Four shots per emitter per burst group: 16 shards total; short intra-burst delays followed by cooldown                             |
| Moving emitters          | Sample emitter position/direction for every shot, not once for the entire burst                                                    |
| Initial attack state     | Cooldown, not an immediate shot                                                                                                    |
| Shard motion             | Initial velocity; one timed reversal; no stored origin or homing target; later enemy motion has no effect                          |
| Shard expiration         | Only when lifetime ends, never on collision, arena exit, or leaving the camera                                                     |
| Shard damage eligibility | Each shard hits the single player once at most; use per-shard `hasHitPlayer`                                                       |
| Camera                   | Player-centered; approved fixed north-up framing and provisional scale/zoom below; not a full reproduction of ROTMG camera options |
| Keys                     | WASD movement; R immediate retry; O zoom out; P zoom in                                                                            |
| Rendering                | Geometric placeholders acceptable; prioritize readable collision and depth ordering                                                |
| Records                  | Local attempt history/comparison; approved metrics and retention below                                                             |

## Paladin Preset: Evidence Gate

S2's current stat table supplies the following **verified wiki values**, excluding equipment and Exaltations. Its historical discussion describes older gains, so do not combine those with the current table.

| Required input                           | Unit                         | Current state                                                                                        |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Level-1 health, vitality, speed, defense | Stat points                  | S2: 200 HP, 23 VIT, 22 SPD, 1 DEF                                                                    |
| Level-up gains                           | Stat points per level        | S2: +25 HP, +1 VIT, +1 SPD, 0 to 1 DEF; DEF probabilities not stated                                 |
| Published average level-20 base stats    | Stat points                  | S2: 675 HP, 42 VIT, 41 SPD, 10 DEF                                                                   |
| Base stat caps                           | Stat points                  | S2: 800 HP, 60 VIT, 55 SPD, 30 DEF; no cap reached by the stated unpotted gains                      |
| T10 sword                                | Relevant passive stat points | Archon Sword, T10 (S13); no passive stat bonus listed; no attacks in this slice                      |
| T10 heavy armor                          | Relevant passive stat points | Vengeance Armor, T10: +22 DEF (S14)                                                                  |
| T4 seal                                  | Relevant passive stat points | Seal of the Divine: +3 DEX (S7); none of the four trainer stats; activation excluded                 |
| T4 health ring                           | Passive stat points          | Ring of Paramount Health: +100 HP, +20 MP (S11); mana excluded from this slice                       |
| Fractional-average rounding rule         | Stat points                  | Delegated decision: use S2's published integer average, not a reconstructed random-stat distribution |

### Average Methodology

There are 19 transitions from level 1 to level 20. For deterministic gains, add 19 times the gain to the starting stat. For a randomized stat, a mathematical expectation would require probability-weighted outcomes and applicable caps. The source does not establish the DEF probabilities. This fixed-preset trainer therefore uses S2's published integer averages directly and does not implement a random leveling system.

**Delegated decision:** use the published integer average of 10 base DEF, then add equipment. This supersedes the earlier proposal to reconstruct and floor an expected random DEF value. No additional base-stat rounding is necessary; do not invent gain probabilities.

For the read table, 200 + 19 \* 25 = 675 HP, 23 + 19 = 42 VIT, and 22 + 19 = 41 SPD. If DEF gains are equiprobable 0/1, the unrounded expected DEF would be 10.5 and flooring yields the published 10. The page does not prove that probability distribution or its average-rounding policy. A smaller, source-grounded alternative is to adopt its published integer average of 10 DEF explicitly as the fixed trainer preset, without implementing random stat rolling.

### Final Equipped Preset

These are derived from published integer averages and verified listed item bonuses. Under the user's delegation, adopt this preset with no pets, Exaltations, enchantments, consumables, or active buffs. These exclusions are trainer scope decisions, not assumptions about the user's actual ROTMG account.

| Primary stat | Published level-20 base | Relevant equipment                          | Equipped total |
| ------------ | ----------------------- | ------------------------------------------- | -------------- |
| Health       | 675 HP (S2)             | +100 HP from T4 ring (S11)                  | 775 HP         |
| Defense      | 10 DEF (S2)             | +22 DEF from T10 armor (S14)                | 32 DEF         |
| Speed        | 41 SPD (S2)             | No listed relevant bonuses (S7/S11/S13/S14) | 41 SPD         |
| Vitality     | 42 VIT (S2)             | No listed relevant bonuses (S7/S11/S13/S14) | 42 VIT         |

For this preset, ordinary defense-reduced damage from a raw 160 shard is max(160 - 32, 16) = 128 HP. The approved 1.5 tiles/second pursuit is slower than the resulting approximately 7.061333 tiles/second player speed. The delegated combat rule below gives floor(15 + (32 - 15) \* 0.75) = 27 as the combat trigger. The 128-HP damage of this shard qualifies for combat.

Do not implement mana, attack speed, damage dealt, inventory management, or ability effects for completeness. Record unused equipment facts only when they explain why a slot does not affect this training preset.

## Derived Rules: Evidence Gate

| Rule                        | Required specification                                                | Status/source target                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player speed                | Tiles/second as a function of speed stat                              | S3: 4 + 5.6 \* SPD / 75; at 41 SPD, about 7.061333 tiles/second; use this primary expression, not the page's approximately rearranged equality                                                        |
| Incoming damage             | Defense subtraction and minimum                                       | S3: subtract DEF, with damage at least 10% of raw damage; delegated integer rounding below; no piercing projectiles in this slice                                                                     |
| Health regeneration         | HP/second as a function of vitality                                   | S3: 2 + 0.2407 \* VIT; at 42 VIT, 12.1094 HP/second; delegated integration below is not a claim about exact client ticks                                                                              |
| In-combat regeneration      | Reduction                                                             | S9: VIT/WIS regeneration operates at 50%; at 42 VIT, 6.0547 HP/second                                                                                                                                 |
| In-combat duration          | Seconds                                                               | S9: max(1, 7 - 0.04 \* VIT - exaltation reduction); at 42 VIT with zero reduction, 5.32 seconds                                                                                                       |
| Combat trigger              | Threshold, rounding, refresh                                          | S9 examples/table give DEF breakpoints 15/35/65/125; delegated rule below resolves the contradictory prose and defines equality/refresh                                                               |
| Player/projectile collision | Shapes, dimensions in tiles, position anchors, overlap/crossing rules | Authentic sizes unknown; user-approved provisional circles below, tested with swept relative-motion crossings                                                                                         |
| Camera                      | Source controls versus trainer scope                                  | S12 lists Q/E rotation, Z angle reset, X centering toggle, R Nexus escape and O options; trainer intentionally retains approved fixed rotation and R/O/P overrides; numeric scale remains provisional |

Keep source-derived formulas separate from trainer decisions. Do not replace these documented rules with remembered formulas or expand to status effects, abilities, or piercing behavior outside this encounter.

S9's worked examples give triggers 12 at DEF 12, 22 at DEF 25, 35 at DEF 45, and 48 at DEF 77. Its prose also describes differing bracket boundaries and an initial value of 1, so do not claim the entire article is internally consistent. The following delegated decision selects the worked-example interpretation; it does not independently verify the game client.

### Final Damage And Combat Rules

The user delegated the remaining decisions for later review on 2026-10-24. Adopt these explicit trainer rules:

1. Inputs are finite, nonnegative raw damage and DEF. For positive raw damage, damage received is `ceil(max(rawDamage - defense, rawDamage * 0.1))`. Zero raw damage receives zero damage. This ceiling policy is a trainer approximation; S3 establishes the reduction/minimum but not its rounding.
2. Compute the combat trigger by summing DEF contributions: first 15 DEF at 1.0, next 20 at 0.75, next 30 at 0.5, next 60 at 0.25, and any remaining DEF at 0. Floor the sum and clamp to the inclusive range 1 through 60. At 32 DEF, the trigger is 27 HP.
3. Each newly registered shard hit whose post-defense damage is at least the trigger enters or refreshes combat to `max(1, 7 - 0.04 * vitality)` seconds. For 42 VIT, this is 5.32 seconds. Subthreshold hits do not enter or refresh combat. There is no global hit immunity.
4. At each health update, apply that update's collisions/damage in stable projectile spawn order before regeneration. A qualifying hit resets the timer before regeneration integrates that update's elapsed time. Stop on lethal damage; no later hits or regeneration can resurrect the player. Death time is the simulation tick applying the lethal hit.
5. Integrate regeneration by simulation time, retaining fractional HP internally: `2 + 0.2407 * vitality` HP/second out of combat, half that in combat. When an update spans timer expiry, use the in-combat rate for the remaining timer portion and the out-of-combat rate for the rest. Clamp health to maximum. A fresh qualifying hit resets the timer before this split is computed.
6. Damage and regeneration are tick-resolved as described, not a claim of exact sub-tick ROTMG client ordering. Do not round regeneration every update. Display positive current HP rounded up in the HUD, without feeding display rounding back into gameplay; display zero when dead.
7. Retry starts at full health, out of combat, with no modifiers. No pets, Exaltations, enchantments, consumables, active buffs, or armor-piercing mechanics are part of this slice.

Regression cases: trigger values at DEF 0/12/15/25/32/35/45/65/77/125/126 are 1/12/15/22/27/30/35/45/48/60/60. At the fixed preset, a shard deals 128 damage, resets combat to 5.32 seconds, and regeneration rates are 12.1094 or 6.0547 HP/second. Tests must also cover damage exactly at the trigger, just below it, minimum damage rounding, combat refresh, partial-update timer expiry, health cap, and lethal damage before regeneration.

## Shard Range And Timing

S1's rendered attack table verifies the wiki-listed **160 damage**, **8 tiles/second**, and **19.2 tiles range** for the head's boomerang shot. It also labels the shot as hitting multiple targets and passing through obstacles. This does not establish the range convention, exact reversal time, lifetime, or repeated-hit behavior against the same target. The article labels its last update Aug 2019; this is source verification, not proof of unchanged current-client behavior.

The following are **conditional derivations**, assuming constant speed, an instantaneous reversal, and equal outbound/return durations:

| Interpretation of 19.2 tiles | Outward distance | Reversal age | Lifetime    | Total path length |
| ---------------------------- | ---------------- | ------------ | ----------- | ----------------- |
| Total traveled distance      | 9.6 tiles        | 1.2 seconds  | 2.4 seconds | 19.2 tiles        |
| Outward distance only        | 19.2 tiles       | 2.4 seconds  | 4.8 seconds | 38.4 tiles        |

Neither interpretation is verified. Returning to the origin at expiry also requires equal time at equal speed; reversal by itself does not establish that equality. The trainer's approved straight-line reversal need not match every detail of the source game's boomerang implementation.

**Decision recorded 2026-10-24:** the user selected the total-traveled-distance interpretation provisionally: reversal age 1.2 seconds, lifetime 2.4 seconds, outward distance 9.6 tiles at 8 tiles/second. This remains an approved trainer approximation, not verified ROTMG range semantics, even after the table's damage/speed/range were read successfully. Replace provisional behavior only after reviewing new evidence with the user.

Implementation invariant once approved: split movement when a simulation step crosses reversal/expiry; detect collisions along traveled segments, including the return segment. A consumed hit does not stop motion or remove the shard. Death/retry ends or resets the session, not a new projectile-specific expiration rule.

## Proposed Encounter Tuning

The user approved every value in this section as **user-defined provisional tuning** on 2026-10-24. These are starting options for playtesting, not verified estimates of authentic ROTMG values. Keep them in named configuration with units. The heading retains the proposal's name to identify the table reviewed by the user.

| Parameter                 | Proposed initial value/rule                                                            | Rationale or constraint                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Arena radius              | 16 tiles                                                                               | Initial spacious practice arena; revisit with camera/range               |
| Spawn positions           | Player (0, 0); enemy (0, -13) tiles                                                    | Deterministic north-edge start, with a 3-tile center-to-edge margin      |
| Enemy pursuit speed       | 1.5 tiles/second, only if verified Paladin speed exceeds it                            | A provisional value, not a speed derived from the enemy wiki             |
| Enemy stop distance       | 1 tile between centers; no overshoot                                                   | Avoid coincident centers during slow pursuit                             |
| Body contact              | No contact damage, no entity body blocking                                             | Focus the slice on dodging shards; fidelity limitation if source differs |
| Boundary                  | Keep player/enemy collision extents inside arena; tangential movement remains possible | Avoid clipping sprites/colliders through walls                           |
| Player collider           | Circle, radius 0.25 tile, center at ground anchor                                      | User-approved provisional approximation, not verified source size        |
| Enemy collider            | Circle, radius 0.6 tile, center at ground anchor                                       | Boundary extent; not a damage source under proposed contact rule         |
| Shard collider            | Circle, radius 0.15 tile                                                               | User-approved provisional approximation, not verified source size        |
| Emitter radius            | 0.75 tile from enemy center                                                            | Clear separation from enemy placeholder                                  |
| Initial emitter phase     | 0 radians points east                                                                  | Deterministic; other emitters add quarter turns                          |
| Angular speed             | 45 degrees/second clockwise                                                            | Tuning candidate, not a fidelity claim                                   |
| Rotation during cooldown  | Continue                                                                               | Continuous pattern phase; reset phase on retry                           |
| Intra-burst interval      | 0.15 seconds                                                                           | Four shots at offsets 0, 0.15, 0.30, 0.45 seconds                        |
| Cooldown semantics        | 2 seconds from last shot to next group's first shot                                    | Next first shot is 2.45 seconds after previous first shot                |
| Initial cooldown          | 2 seconds after gameplay becomes active                                                | No shot during optional countdown; not an immediate opening volley       |
| Diagonal movement         | Normalize; opposite inputs cancel                                                      | User-approved trainer rule; not independently verified client behavior   |
| Death                     | End at the simulation tick that applies lethal damage; no regeneration resurrection    | Tick-based survival timing, not a wall-clock interval                    |
| Damage/regeneration order | Resolve shard hits, stop if dead, otherwise apply eligible regeneration                | Final Damage And Combat Rules define eligibility and integration         |

If the verified speed is at most 1.5 tiles/second, the pursuit recommendation is invalid and needs a new user-approved value. Do not silently clamp it or change the Paladin speed. Proposed collision sizes may substantially affect fidelity and must not be advertised as authentic.

## Simulation Timing And Movement Policy

**Delegated decision recorded during step 3.2 on 2026-10-24:** fixed-step frequency, catch-up limits, and movement update order had not been selected in step 1.1. Asked to approve a recommendation, the user delegated the decision for later review: "The user is not available to respond and will review your work later. Work autonomously and make good decisions." Adopt the following trainer policy; these are not independently verified ROTMG timing values or an explicit numeric endorsement by the user.

- Fixed step: 1/60 second (60 ticks/second), named `ENCOUNTER_CONFIG.simulation.fixedStepSeconds`.
- At most 8 ticks per supplied elapsed-time update, named `maxStepsPerUpdate`. Add the previous fractional remainder to supplied active time; execute available whole ticks up to that limit, discard excess whole ticks, and retain only the sub-tick remainder. Return discarded seconds explicitly. There is no delayed backlog, movement, or survival credit for discarded time.
- Count survival time from executed ticks only. Do not use wall-clock APIs inside simulation. The future Phaser/session adapter supplies active elapsed seconds and must not submit paused/hidden gaps for catch-up.
- Use the current sampled directional input for every tick executed by that update. Frame-schedule equivalence assumes the same per-tick input; arbitrary input changes sampled at different render times are not claimed to be equivalent.
- World axes are positive X east and positive Y south. Cancel opposite inputs independently, then normalize any remaining diagonal before applying the approved player speed.
- Move the player first, then let the enemy pursue the updated player position at its configured speed. Limit pursuit travel to the remaining distance above the 1-tile stop distance; if already within that distance, including coincident centers, do not push entities apart. Body overlap does not block movement or damage the player.
- Project an out-of-bounds candidate position radially onto the arena circle reduced by that entity's collider radius (15.75 tiles for the player; 15.4 for the enemy). This rejects outward motion while allowing tangential sliding. It introduces no contact response between entities.
- Use only a machine-precision allowance at tick boundaries to avoid losing a tick through floating-point rounding. Tests compare positions across schedules within 1e-9 tile and the retained remainder within 1e-12 second; these are numerical tolerances, not new gameplay tuning.

These choices establish the initial implementation of `crystal-worm-child-head-paladin-v1`; no earlier playable attempt/history implementation exists to compare against. Future comparison-breaking changes to the tick/movement policy require a reviewed rules-version bump, just like encounter tuning changes. Projectile scheduling, hits, regeneration integration, and session pause/retry transitions remain their separately requested steps.

## Proposed Camera And Session Policy

The user approved this entire table on 2026-10-24. Session policies are **user-defined**; camera scale, zoom, and rotation scope remain trainer choices rather than verified ROTMG behavior. The heading retains the proposal's name to identify the table reviewed by the user.

| Topic               | Proposed rule                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Camera anchor       | Exact player ground position centered in the gameplay viewport, including near the arena edge; do not clamp camera to arena bounds |
| Camera rotation     | Fixed north-up for this slice, no Q/E rotation; disclose this limitation if source fidelity would require rotation                 |
| Movement mapping    | W = world north, D = east, S = south, A = west; remains screen-aligned with fixed rotation                                         |
| Default world scale | 32 CSS pixels/tile at zoom 1, independent of device pixel ratio; provisional, not verified ROTMG scale                             |
| Zoom                | Minimum 0.75, maximum 1.5; each O/P press subtracts/adds 0.125; clamp at bounds; ignore held-key repeats                           |
| Zoom on retry       | Retain current zoom during the current app visit; reset encounter state but not viewing preference                                 |
| Resize              | Preserve pixels/tile and zoom; change visible world extent, not movement speed; no fit-entire-arena behavior                       |
| Countdown           | 3 seconds on Start; no countdown on R or results Retry to preserve immediate practice                                              |
| During countdown    | No simulation time, enemy rotation, pursuit, firing, or damage; health/positions at initial values                                 |
| Manual pause        | Escape toggles pause while playing; visible Resume action; R can restart from pause                                                |
| Focus loss          | Pause on blur/hidden; clear held inputs; require explicit resume; never advance/catch up hidden time                               |
| Timer               | Count only active simulated survival time, excluding countdown, pause, results, and discarded real-time gaps                       |
| R behavior          | One restart per press from active/countdown/paused/ended; ignore on home; clear held inputs                                        |
| Retry reset         | Reset health/combat state, spawns, inputs, projectiles/hit flags, rotation phase, burst/cooldown, elapsed time and metrics         |
| Results             | Survival duration, hits taken, compatible personal best, recent attempts; no composite skill score                                 |
| Aborted attempt     | R or Home before death discards the unfinished attempt; no record, no personal-best eligibility                                    |
| Death record        | Save once per attempt; immediate retry must not duplicate a result                                                                 |
| Comparison          | Only compare records sharing encounter/preset rules version; proposed zoom changes do not split records                            |
| Retention           | Keep latest 100 completed attempts total; personal best computed from retained compatible records, clearly labeled as such         |
| Storage failure     | Practice remains playable; no persistence guarantee when browser storage is unavailable                                            |

The retention proposal means a deleted old record can remove the retained best. If an all-time personal best is wanted, approve a separate durable per-version best record instead. Any pause/countdown/result policy different from this table needs an explicit replacement, not an implementation-time guess.

## Approval Checklist

Step 1.1 is complete using sourced values, prior explicit approvals, and the delegated decisions recorded below. This does not certify exact ROTMG fidelity or authorize automatically executing later steps.

- [x] Evidence: readable sources and dates recorded for Paladin stats, item identities/bonuses, movement, damage, regeneration, combat, and controls. Unverified details are replaced only by explicitly recorded trainer approximations or delegated decisions, not claims of source verification.
- [x] Paladin: adopt published integer averages and the calculated 775 HP / 32 DEF / 41 SPD / 42 VIT preset under delegation, excluding all listed extra modifiers. No random DEF distribution is assumed.
- [x] Shards: user selected the provisional total-path interpretation at the draft speed: reverse at 1.2 seconds and expire at 2.4 seconds. Source verification remains open.
- [x] Encounter: user approved the complete proposed tuning table provisionally, including collision approximations and conditional pursuit speed.
- [x] Camera: user approved framing, fixed rotation scope, provisional world scale, zoom bounds/increment/retention, and resize policy.
- [x] Session: user approved countdown, pause/focus behavior, death ordering, immediate retry/reset, and abort policy.
- [x] Records: user approved metrics, compatibility/versioning, latest-100 retention and best among retained compatible records, not a separately persisted all-time best.

### Approval Record

Recorded 2026-10-24 through the user's clarification answers:

- Source evidence: the user will provide excerpts/screenshots or another readable source. No new external mechanics were verified by this answer.
- Encounter: "Approve the table provisionally."
- Shard timing: "Provisional total path: reverse at 1.2 seconds, expire at 2.4 seconds."
- Camera and sessions: "Approve the table as proposed."

Research follow-up on 2026-10-24: the user suggested reading rendered VS Code browser pages. This succeeded for the enemy, Paladin, stats, Vital Combat, controls, and candidate equipment references; no replacement screenshots are needed for those readable facts. This is an access-method improvement, not new gameplay approval.

Final follow-up on 2026-10-24: when asked about the preset, combat, and health arithmetic, the user answered each question with: "The user is not available to respond and will review your work later. Work autonomously and make good decisions."

Under that delegation, the agent selected the published integer averages, calculated equipped preset, exclusion of extra modifiers, worked-example combat brackets, inclusive trigger/refresh, upward integer damage rounding, and fractional time-integrated regeneration specified above. These are decisions made under delegated authority, not explicit user endorsements of every individual number and not additional external verification.

The decision gate for step 1.1 is resolved. Retain the listed fidelity limitations for later review and tuning; change the rules version if subsequent changes invalidate comparisons. Stop after documenting/validating step 1.1. Run step 2.1 only when requested separately.

## Validation And Known Limitations

Step 1.1 was documentation-only: validate local links, required mechanics sections, evidence labels, source dates, conditional range/preset/combat arithmetic, approval checklist, and completed step status. That research did not authorize application code, a test harness, or bootstrap. Subsequent implementation and behavior checks are recorded separately in the implementation plan.

Known limitations, not implementation blockers: published stat averages do not establish the DEF roll distribution; the trainer uses the published integers instead. Vital Combat has inconsistent threshold descriptions; the trainer selects its worked-example interpretation. Authentic hitboxes, camera scale, client regeneration tick/rounding details, and shard lifetime are not established; approved or delegated trainer approximations cover them. Encounter tuning and camera/session policies retain earlier user approval. The equipped preset and final arithmetic are delegated decisions for later user review. No source gap is silently represented as current-client verification.

## Step 6.1 Technical Review

Reviewed on 2026-10-24. Technical checks passed; the user subsequently accepted the current implementation as recorded below. When initially asked about acceptance/tuning and test budgets, the user delegated autonomous decisions for later review. The agent selected five simulated minutes at each of 30/60/120 Hz, 60 seconds of browser play, and 25 consecutive retries, leaving all tuning unchanged. That initial delegation alone was not treated as personal playtesting or training-feel acceptance.

| Aspect               | Implementation compared with available evidence                                                                                | Review outcome                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Player speed         | 41 SPD yields approximately 7.061333 tiles/second using recorded S3 formula                                                    | Formula matches contract; browser movement/resize/zoom checks pass, not an independent client comparison                          |
| Camera               | Player-centered, north-up, 32 CSS pixels/tile at zoom 1; 0.75-1.5 zoom                                                         | User-approved provisional trainer scale and restricted rotation; S12 does not establish numeric scale                             |
| Rotation and cadence | Clockwise 45 degrees/second; four emitters with four shots at 0.15-second intervals; 2-second initial/after-last-shot cooldown | Matches user-defined provisional contract; S1's spiralling prose does not verify direction, angular speed, or exact cadence       |
| Shard return         | Speed 8, reversal at 1.2 seconds, lifetime 2.4 seconds, no stored origin/homing                                                | S1 reread confirms 160/8/19.2 and boomerang label; total-path interpretation and exact reversal/lifetime remain provisional       |
| Damage and recovery  | 128 HP after 32 DEF; combat trigger 27 HP for 5.32 seconds; regeneration 12.1094/6.0547 HP per second                          | Matches recorded S3/S9 formulas and delegated brackets, rounding, integration, and ordering; client tick fidelity remains unknown |
| Encounter scope      | Slow pursuit, circular arena, approximate circles, no contact damage, attacks, active seal, or other worm segments             | Intentional trainer scope; S1 describes irregular movement after only the head remains                                            |

S1 was readable again and still labels its update Aug 2019. The review does not independently verify the current ROTMG client. No stronger numeric evidence was established for authentic camera scale, hitboxes, rotation/cadence, or range semantics, so no replacement tuning was inferred.

The five-minute schedule test executes 18,000 ticks and 488 volleys (1,952 unique shards) at each schedule with equal final state, no dropped time, and a peak of 16 live shards. The lifetime (2.4 seconds) is shorter than the repeat period (2.45 seconds) of each of the four shot slots on four emitters, bounding live shards to 16. The browser soak samples this bound, lifetime, one canvas/handler, and ongoing simulation progress, then verifies 25 full resets on the same canvas and cleanup on Home.

The final full-suite soak recorded 59.9833 simulated seconds, no deaths, 16 peak shards, and 219 progressing samples during its 60-second budget. Its test-only animation-frame observer measured 3,601 frames, approximately 16.7 ms median/p95 and 16.8 ms maximum gap. These are one-machine headless Chromium observations, not guaranteed FPS or a heap/leak analysis. Separate browser tests cover real deaths, results, persistence/reload, and retry. All 194 unit tests, typecheck, lint, build, and 18 Chromium checks passed. Generated metrics/screenshots stay ignored under `app/test-results/`; the known large Phaser bundle warning remains.

**User acceptance recorded on 2026-10-24:** "let's approve for now what we have. I will make the adjustments later, after our full plan is implemented". Together with the recorded passing technical checks, this completes step 6.1. Current tuning is accepted for now; adjustment notes are deferred until after the full plan. Known trainer approximations remain provisional fidelity choices, not verified current-client behavior, and no independently observed user playtest is claimed. Rules version remains `crystal-worm-child-head-paladin-v1`; future approved comparison-breaking changes require a new version and corresponding tests. This acceptance does not automatically start deployment work.

## Approved V2 Contract - Step 8.1

Recorded 2026-10-25. This additive section defines the approved follow-up target, not implemented gameplay. It supersedes conflicting v1 tuning above only when the coordinated encounter is activated in step 10.1. Until then, the runtime remains `crystal-worm-child-head-paladin-v1`; all preceding source history, approvals and release evidence remain historical v1 records.

Authority: [the fixes decision record](fixes-plan.md#4-one-batch-decision-table) supplies Q01-Q20; [the follow-up answers](fixes-plan.md#77-follow-up-decisions-recorded---2026-10-25) supply R01-R05; [the selected calibration](fixes-plan.md#78-selected-leading-edge-calibration) supplies nominal measurements and their uncertainty. The [v2 archive](implementation-plan-v2.md#phase-8-revised-contract-and-geometry-approval) records their execution status and completed review gates. These are user-defined provisional trainer decisions, not new independent verification of ROTMG or permission to implement later steps.

### Decision Coverage And Provenance

| Approval  | Binding v2 decision and remaining precision                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q01       | Player, head and shard reference identities are confirmed; the head remains partly occluded.                                                                                                                                                                                         |
| Q02       | Derive approximate proportions from colored body measurements, not crop windows or forced equal sizes.                                                                                                                                                                               |
| Q03       | Use original simple art/code-generated shapes, not copied sprites. Source screenshot/crops remain local-only, ignored reference material outside runtime assets.                                                                                                                     |
| Q04       | Four emitters, eleven shots each: forty-four shards per group.                                                                                                                                                                                                                       |
| Q05       | Wait one second after the eleventh shot before the next group's first shot.                                                                                                                                                                                                          |
| Q06       | Keep 0.15-second shot spacing, clockwise 45 degrees/second rotation and two-second initial firing cooldown. Rotation continues during cooldown; phases remain 90 degrees apart.                                                                                                      |
| Q07 / R02 | Near-center offset is 10% of calibrated head width. Zero is a valid configuration input, not the selected offset; negative/nonfinite values are invalid.                                                                                                                             |
| Q08 / R01 | Treat the selected lower-left outer shard as maximum reach for this calibration: 19.2 tiles from head simulation center to the body's farthest leading edge, including emitter offset. This is not center travel or total path. Speed remains 8 tiles/second, not 19.2 tiles/second. |
| Q09       | At reversal the shard body only touches the 19.2-tile arena circle with a stationary head at arena center. Off-axis vertices count; a bounding circle is not proof of exact contact.                                                                                                 |
| Q10 / R03 | Player starts at center; enemy starts north with a three-tile center-to-wall margin, subject to actual polygon fit. Derive pursuit stopping separation from silhouettes; an extra nonzero gap is not approved.                                                                       |
| Q11       | Use one original convex physical silhouette with 3-8 ordered vertices per body, shared by rendering and collision with the same anchor, dimensions and transform. No hidden small-circle final hit test.                                                                             |
| Q12 / R04 | Persist O/P zoom independently of history: minimum 0.25, maximum 3.0, default 1, step 0.125. Preserve 32 CSS pixels/tile at zoom 1 independently of source-image scale and device pixel ratio.                                                                                       |
| Q13       | Always-visible Phaser health bar below the character, using authoritative HP/max HP; retain the React HUD.                                                                                                                                                                           |
| Q14       | Display the post-defense amount separately for each accepted hit, not a health-delta estimate that mixes hits, regeneration and lethal clamping. Existing damage arithmetic is unchanged.                                                                                            |
| Q15       | Separate floating hit numbers/cues with bounded mixing; lethal feedback is visible without delaying results. Effect duration, placement and numeric limits still need review.                                                                                                        |
| Q16 / R05 | Quiet original synthesized hit cue with visible user-controlled mute. Numeric gain/voice cap require audible review; persisted mute is optional, not a mandatory saved preference.                                                                                                   |
| Q17       | Controls access on both Home and gameplay HUD; no new custom shortcut or rebinding.                                                                                                                                                                                                  |
| Q18       | Accessible Controls dialog; after session closure require explicit Resume and show centered Paused text. Escape closes the dialog once without also toggling play; no background input or inactive-time catch-up.                                                                    |
| Q19       | Activate comparison-breaking changes together as `crystal-worm-child-head-paladin-v2`. Retain v1 records, labeled incompatible and excluded from v2 bests; do not delete or relabel them.                                                                                            |
| Q20       | Tuning is approved provisionally for this trainer. Disclose calibration assumptions, head uncertainty and remaining fidelity limits; do not claim exact client behavior.                                                                                                             |

### Cadence, Range And Geometry

Eleven emission offsets per emitter are `k * 0.15` seconds for integer `k` from 0 through 10. The group span is `(11 - 1) * 0.15 = 1.5` seconds; the last-shot cooldown makes the first-to-first period `1.5 + 1 = 2.5` seconds, with no overlapping groups. Four emitters yield `4 * 11 = 44` shards/group and a steady average `44 / 2.5 = 17.6` shards/second. The initial two-second cooldown begins with active gameplay, not during the unchanged Start countdown. Sample the moving head position and rotating direction for each shot.

R01 replaces v1's provisional total-path interpretation with head-center-to-leading-edge maximum reach. R01/Q09 set arena radius to 19.2 tiles and diameter to 38.4 tiles. This is a centered-head calibration condition, not a change to the near-edge play spawn or a rule that confines shards emitted by a pursuing head. Previously emitted shards ignore later head movement.

Use original shared convex silhouettes and fixed orientation within each motion segment. The shard is centrally symmetric, with its long axis aligned to its original firing direction; reversal does not rotate its occupied body and there is no within-tick spin. Borders must not create a materially larger apparent physical body than the collider. Shadows, bars and hit feedback are explicitly nonphysical decorations. Continuous relative-motion collision must use the existing reversal/expiry segmentation, not endpoint-only overlap; circles/AABBs may reject candidates but never establish final hits. Exact vertices/anchors and their visual acceptance belong to step 8.2; continuous collision and body-aware movement belong to steps 9.1/9.2, disconnected from gameplay until 10.1.

The nominal scale is `435.118 / 19.2 = 22.662396` source pixels/tile, from the selected farthest pixel-center distance. Source image: local-only root `image.png`, 857x700, SHA-256 `f1c9b0715e8d2b91f1eac60ea3ad9e5adc694e4e2bcbd3fc65f9426b5f9cc86b`. This identifies the reference; it is not a public asset or a recovered exact client hitbox. Measurements exclude the player's weapon/bar; pixel footprint, masks, anchor choice, head occlusion and unknown head motion limit precision.

| Nominal measurement or derivation       | Value, not a frozen runtime constant                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| Player width x height                   | 36x33 source pixels; 1.588535 x 1.456157 tiles                       |
| Visible head width x height             | 42x55 source pixels; 1.853290 x 2.426928 tiles; occluded contour     |
| Shard long x short dimensions           | 56.576x34.660 source pixels; 2.496470 x 1.529406 tiles               |
| Emitter offset                          | 10% of head width; nominally 0.185329 tile                           |
| Maximum head-to-shard centroid          | 409.973 source pixels; nominally 18.090453 tiles                     |
| Observed radial extension past centroid | 1.109547 tiles; not an assumed half-length                           |
| Center travel from emitter              | 17.905124 tiles                                                      |
| Reversal / lifetime                     | 2.238140 / 4.476281 seconds at 8 tiles/second                        |
| North enemy center                      | `(0, -16.2)` tiles from `-(19.2 - 3)`, subject to actual polygon fit |
| Conservative live-shard bound           | Nominally 88; recompute from exact lifetime                          |

Step 8.2 must derive exact timing from the approved polygon rather than retaining the asymmetric reference glyph's centroid timing. With unit firing direction `n`, transformed local shard vertices `q_i`, emitter offset `e` in tiles, radius `R = 19.2` tiles and speed `v = 8` tiles/second:

$$
p_i=q_i\cdot n,\qquad b_i^2=\|q_i\|^2-p_i^2,\qquad
C_{max}=\min_i\left(\sqrt{R^2-b_i^2}-p_i\right)
$$

$$
t_{reverse}=\frac{C_{max}-e}{v},\qquad
T=2t_{reverse},\qquad
\max_i\|C_{max}n+q_i\|=R
$$

Here `C_max` is head-to-shard-center distance, not travel from the emitter. Validate finite geometry, fit at emission, nonnegative square-root arguments and positive travel `C_max > e`. Do not change radius/proportions or round timing to simulation ticks to preserve nominal values. The conservative bound is `44 * ceil(T / 2.5)` live shards, nominally 88; it is not a required observed peak. Actual spawn fit, silhouette-derived direction-dependent pursuit separation and any explicitly proposed extra gap require step 8.2 review. The old one-tile center stopping distance is not silently retained for larger bodies.

### Presentation, Persistence And Session Boundaries

Zoom restoration must validate finite values against the approved range/step policy, read safely, write only on actual changes and retain visit-local fallback for blocked/corrupt/quota-failed storage. Preference storage must not modify or depend on attempt-history validation. Retry/Home preserve zoom; zoom and resize never change world geometry, timing or comparisons.

Accepted-hit output belongs to the pure simulation/session boundary and remains ephemeral, not a persistent event history. Phaser consumes each eligible hit once, including independent same-tick hits and lethal hits; spent returns and post-death overlap produce no feedback. Reuse existing health arithmetic and stable hit order. React must not track each projectile/effect per frame. Clear effects/audio on retry/Home and dispose owned resources. Unlock audio from a user gesture; blocked/unsupported audio, mute and voice limiting cannot change damage/time or queue stale cues. Lethal feedback must not defer results.

React owns the accessible labeled Controls dialog with keyboard focus containment/restoration and actual WASD/R/O/P/Escape bindings plus existing UI actions. Opening during play/countdown freezes the relevant session state; movement, retry and zoom cannot act behind it. Closing by Escape must not also toggle the underlying session. Preserve focus-loss safety, require explicit Resume after a session dialog closes, and never advance paused/hidden time. No custom shortcut, touch controls or rebinding is added.

### Preserved Rules And Review Ownership

Keep the fixed 775 HP / 32 DEF / 41 SPD / 42 VIT Paladin and existing damage/regeneration/combat ordering, 1.5 tiles/second pursuit, normalized movement, sole fixed-step clock and catch-up/discard policy. Keep one velocity reversal, lifetime-only expiration, per-shard `hasHitPlayer`, no stored firing origin/homing, and no global invulnerability. Arena constraints apply to player/head bodies, never projectile lifespan. Preserve immediate retry, abort-without-record, death-record-once, latest-100 retention and version-compatible bests. No storage schema migration is required without an actual field change. No backend, accounts, attacks, seal activation, body contact damage/blocking, shrinking arena or tuning UI is authorized.

| Owning step        | Remaining review or implementation gate                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.2                | Approve actual original vertices, anchors/orientations, aspect/dimension tolerances and common-scale collision overlay; derive exact emitter/timing, live bound, spawn fit and pursuit separation. Any extra gap needs approval. No such outputs are invented by step 8.1. |
| 9.1 / 9.2          | Test pure continuous collision, tangency/numerical tolerance and body-aware arena/pursuit helpers without activating them. Numerical tolerance is not gameplay tuning.                                                                                                     |
| 10.1 / 10.2        | Activate the coordinated v2 preset and obtain actual geometry/pattern acceptance and v1/v2 comparison isolation. Preparatory geometry must not ship as changed v1 physics.                                                                                                 |
| 11.1 / 11.2        | Implement defensive independent zoom preference storage and verify actual reload-safe rendered restoration.                                                                                                                                                                |
| 12.1               | Implement ephemeral accepted-hit output without duplicating health rules or adding an event bus.                                                                                                                                                                           |
| 12.2 / 12.3        | Review unspecified health-bar placement/style and hit-number placement/duration, then validate full/partial/zero health, simultaneous/lethal hits and cleanup.                                                                                                             |
| 12.4               | Audibly review numeric gain, voice cap and cue tuning; implement visible mute and nonfatal audio lifecycle. Mute persistence remains optional.                                                                                                                             |
| 13.1 / 13.2        | Implement accessible Home/HUD Controls and verify focus, Escape isolation, centered Paused state and explicit Resume.                                                                                                                                                      |
| 14.1 / 14.2 / 14.3 | Full repeated-practice regression, local acceptance and separately authorized publication followed by actual hosted verification. Documentation approval is not deployment evidence.                                                                                       |

No missing polygon or presentation value blocks this reconciliation step: the owning steps must obtain the necessary review before completion. Settled Q/R choices are not reopened. This section neither implements the target nor records fresh human geometry/audio acceptance, client verification, commit, push or deployment.

### Step 8.2 Geometry Candidate - Approved

Proposed and **user-approved on 2026-10-25; not activated**. In response to the combined G01-G04 review request, the user replied "approved". This explicitly approves the exact shapes, anchors/orientations, review tolerances and derived values below, including zero extra pursuit gap. It is design approval, not an independently observed playtest or verification of ROTMG client fidelity. The pure candidate configuration (`app/src/game/config/geometry-candidate.ts`, retired) owns the shared typed vertices; only the existing config tests and review generator (`app/scripts/review-geometry.mjs`, retired) import it. The playable configuration, renderer and simulation still use v1. No reference screenshot or crop is installed as artwork.

Run `node app/scripts/review-geometry.mjs` from the repository root under the pinned Node version to regenerate the ignored local review page `app/test-results/geometry-review/index.html` and exact `values.json`. The page includes a common-scale body/collision overlay, centered-head reach construction, min/default/max zoom views and actual north-spawn fit. PNG review captures are also local-only. Generated images/pages are not committed or runtime assets; a fresh clone can regenerate the page from the original vertices without the reference screenshot.

#### Approved Silhouettes And Anchors

All coordinates use X east and Y south. Each local origin `(0, 0)` is the physical body's bounding-box center and simulation position, **not feet/ground contact**, a weapon anchor or an independently offset visual center. For the partly occluded head this is an explicitly approved reconstruction, not the measured colored-pixel centroid. Player/head remain upright with zero rotation. The shard's local positive X axis follows its initial firing direction; velocity reversal does not rotate it. All three candidates are convex and centrally symmetric, with consistent clockwise screen-space vertex ordering and nonzero area.

Normalized coordinates below multiply X by full body width in tiles and Y by full body height in tiles. The full dimensions come from the common scale `435.118 / 19.2` source pixels/tile, not independent per-body resizing:

| Body   | Normalized ordered vertices                                                      | Source dimensions        |
| ------ | -------------------------------------------------------------------------------- | ------------------------ |
| Player | `(-.3,-.5),(.3,-.5),(.5,-.3),(.5,.3),(.3,.5),(-.3,.5),(-.5,.3),(-.5,-.3)`        | 36 x 33 pixels           |
| Head   | Same original beveled octagon as player, scaled only by measured head dimensions | 42 x 55 pixels; occluded |
| Shard  | `(.5,0),(.25,.5),(-.25,.5),(-.5,0),(-.25,-.5),(.25,-.5)`                         | 56.576 x 34.660 pixels   |

The octagons cut each corner by 20% of the corresponding full dimension; the shard uses tips at half-length and shoulders at quarter-length. These shape choices are approved original trainer geometry, not copied sprite contours or recovered client hitboxes. The physical fill and dashed collision-review outline use the same `verticesTiles` and parent transform. Review-only anchor marks/strokes and later health/effect decorations are nonphysical; they do not add collider padding.

| Body   | Approved dimension tolerance, source pixels | Resulting allowed aspect interval, width/height | Basis and limitation                                                                                                   |
| ------ | ------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Player | Width +/-2, height +/-2                     | 0.971429-1.225806                               | Broad 36x33 versus strict 35x32, with weapon-exclusion uncertainty                                                     |
| Head   | Width +/-2, height +/-7                     | 0.645161-0.916667                               | Broad 42x55 versus strict 42x48; occlusion leaves center/contour uncertain                                             |
| Shard  | Long dimension +/-1, short dimension +/-1   | 1.558497-1.710517                               | Broad measurements 56.576x34.660 and 55.975x35.146 differ by less than one pixel; highlight-only masks omit body color |

These are approved review tolerances, not numerical collision epsilon, randomized dimensions, invisible padding or authority to retune approved geometry without review. The actual candidate uses the nominal dimensions exactly. Each interval is `(width - widthTolerance)/(height + heightTolerance)` through `(width + widthTolerance)/(height - heightTolerance)`.

#### Candidate-Derived Calibration

Applying the already-approved leading-edge equation to the G01-G04-approved vertices gives the following finalized v2 geometry outputs. They do not change R01-R05 and do not activate the v2 encounter before step 10.1:

| Quantity                                        | Candidate value                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Emitter offset                                  | 0.185329037181 tile, 10% of head width                            |
| Maximum head-to-shard-center distance           | 17.951764808627 tiles                                             |
| Center travel from emitter                      | 17.766435771446 tiles                                             |
| Reversal age at 8 tiles/second                  | 2.220804471431 seconds                                            |
| Lifetime                                        | 4.441608942861 seconds, twice reversal age                        |
| Conservative live bound                         | `44 * ceil(4.441608942861 / 2.5) = 88`                            |
| Play spawn                                      | Player `(0,0)`, head `(0,-16.2)` tiles                            |
| Farthest spawned head vertex                    | 17.422337611417 tiles from arena center, inside radius 19.2       |
| Pursuit center separation on east/west axis     | 1.720912488107 tiles before any extra gap                         |
| Pursuit center separation on north/south axis   | 1.941542294274 tiles before any extra gap                         |
| Pursuit center separation on 45-degree diagonal | 2.093284691954 tiles before any extra gap                         |
| Approved extra pursuit gap                      | 0 tiles; silhouette contact only, with no blocking/contact damage |

For this pointed hexagon the limiting vertex is the forward tip `(1.248235191373,0)` tiles, so `C_max = 19.2 - 1.248235191373`. All other vertices lie inside the circle at reversal. Rotating the shard and its radial center together preserves contact across firing phases; translating just `0.000001` tile farther breaches the circle. That displacement is a test probe, not a gameplay tolerance. No timing is rounded to simulation ticks. The screenshot-centroid estimate of 2.238140/4.476281 seconds is intentionally not retained: doing so would let this candidate's tip overshoot the approved reach.

Pursuit must use direction-dependent contact of the shared silhouettes, not a single axial maximum or the old one-tile center distance. For these centered, symmetric player/head polygons, let `h_body(a)` be the maximum vertex dot product with an edge normal `a`. For unit center direction `n`, the ray exits their Minkowski contact region at `min((h_player(a) + h_head(-a)) / dot(a,n))` over edge normals of both polygons with `dot(a,n) > 0`. The values above apply that construction with the approved zero extra gap. This records the intended separation derivation, not the step 9.2 movement implementation; coincident centers, no overshoot and absence of body blocking remain unchanged requirements.

#### Approval Questions

G01-G04 were presented together with the local review page and are now approved by the user's response "approved" on 2026-10-25. The questions are retained as approval scope/evidence; settled Q/R decisions are not reopened.

| ID  | Requested approval                                                                                                                                                          | Status              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| G01 | Accept the original player/head beveled octagons and symmetric pointed shard hexagon, at the exact shared-scale dimensions/vertices above?                                  | Approved 2026-10-25 |
| G02 | Accept body-center simulation/drawing anchors, upright player/head and fixed initial-firing-axis shard orientation, including the explicitly uncertain head reconstruction? | Approved 2026-10-25 |
| G03 | Accept the proposed source-pixel dimension/aspect review tolerances, without treating them as collider padding or automatic retuning permission?                            | Approved 2026-10-25 |
| G04 | Accept the exact candidate-derived offset/reversal/lifetime/live bound, fitted north spawn and silhouette-derived pursuit separation with **zero extra gap**?               | Approved 2026-10-25 |

The actual user response, not technical checks or delegated acceptance, resolves this approval gate. The reviewed vertices and derived numeric values are unchanged. Step 8.2 is complete with focused verification recorded in the active plan. Preparatory data stays disconnected; steps 9-14 remain unstarted and require separate requests. No runtime activation, commit, push or deployment is authorized by this approval.

### Step 9.1 Continuous Convex Geometry

The pure [geometry adapter](../app/src/game/simulation/geometry.ts) is preparatory, not a change to playable collision. The installed `@flatten-js/core` 1.6.14 declarations expose static polygon intersections and affine transforms, but no continuous translating-convex query. `transformBodyVertices` reuses its `Matrix` to rotate canonical local vertices about the body-center origin, then translate them into world tiles. It returns plain `Vector2` data without modifying the input. No dependency or framework is added.

`sweptConvexOverlap` accepts two world-space start polygons and their full displacements in tiles over the **same** motion segment. Both orientations must remain fixed throughout that segment. It projects onto normalized edge normals from **both** bodies, using relative displacement `firstDisplacement - secondDisplacement` and a common projection origin. For each axis, start intervals `A` and `B` and projected relative displacement `s` give:

$$
u_1 = \frac{b_{min} - a_{max} - \tau}{s}, \qquad
u_2 = \frac{b_{max} - a_{min} + \tau}{s}
$$

For nonzero `s`, intersect `[min(u1,u2), max(u1,u2)]` with the other axes' intervals and `[0,1]`. For exactly zero `s`, reject only if the initial intervals are separated by more than the numerical allowance. No near-zero velocity cutoff substitutes for motion. A nonempty common interval means contact: initial/newborn overlap, edge/corner tangency and contact exactly at segment end all count, including contact while moving apart. Disjoint endpoints do not imply a miss; overlapping swept AABBs or enclosing circles do not imply a hit. No broad-phase acceptance or endpoint-only shortcut is used.

#### Numerical Policy, Not Gameplay Tuning

- `tau = 64 * Number.EPSILON * S` tiles, where `S` is the largest absolute X/Y coordinate among both start polygons. Unit-length axes keep this allowance in world tiles. There is no fixed tile floor or adjustable collider padding. The factor 64 is an engineering roundoff budget for the small coordinate differences, normalized normals and projections, not a measured gameplay value or fidelity claim.
- Projections subtract a common start vertex before taking dot products to limit cancellation. Validation uses the same coordinate-scaled allowance per polygon. At the centered arena's approximately 19.2-tile scale, `tau` is approximately `2.73e-13` tile; it is unrelated to the source-pixel review uncertainty, the pursuit gap or shape dimensions. Separations within roundoff may count as touching; representable gaps above it remain misses. Changing world-coordinate scale also changes roundoff, not physical tuning.
- Inputs require 3-8 finite, ordered, strictly convex vertices, in either winding. Duplicate/collinear corners, zero-area shapes, concavity, self-crossing order, nonfinite transforms/motion and numerically unresolvable edges throw `RangeError`. Every non-edge vertex must lie strictly on the same interior side of every edge; a same-turn self-crossing star is not accepted as convex. Transform output is validated too, so an unrepresentable translation cannot silently collapse a body.
- The focused Node suite covers tiny/ordinary/large scales, rotated tangency and just-separation, approved shapes under common rotations, relative motion of both bodies, axial/diagonal/return crossings, mutually disjoint axis-time intervals, enclosing-circle false positives and invalid inputs. Numerical policy does not authorize changes to approved vertices, timing or rules identity.

No live simulation, configuration or drawing imports these helpers yet. Step 10.1 will reuse existing reversal/expiry segments and matching player interpolation, retaining the firing-axis orientation on reversal and the sole Phaser-driven simulation clock. Arena/pursuit helpers remain separate step 9.2 work. This step adds no collision despawn, hit state, rendering, persistence or runtime branch.

### Step 9.2 Body-Aware Arena And Pursuit Geometry

The same pure [geometry adapter](../app/src/game/simulation/geometry.ts) now owns circular containment, radial candidate constraints, silhouette contact/pursuit and exact shard timing. The preparatory candidate config (`app/src/game/config/geometry-candidate.ts`, retired) and local review generator (`app/scripts/review-geometry.mjs`, retired) reuse these derivations instead of maintaining separate timing or pursuit equations. Approved vertices, anchors, dimensions, emitter offset, spawn, reversal/lifetime and zero extra gap are unchanged. Diagonal contact remains numerically equivalent to the approved value (a one-unit-in-last-place rounding difference). No live configuration, simulation, renderer or storage integration is activated.

#### Circular Containment And Movement

`convexBodyFitsCircle` checks every actual world vertex against the arena's center and radius. Since both the polygon and disk are convex, contained vertices establish containment of the whole physical body, including its edges. Enclosing-circle overlap, body-center fit or AABB overlap is not proof of fit. Tangency is contained, with the existing `64 * Number.EPSILON` roundoff budget scaled by world coordinates, arena center and radius; no gameplay padding is added.

`maximumBodyCenterDistance` accepts already-oriented local vertices, a nonzero direction and a positive finite circle radius. The local body must fit when its anchor is at the circle center. Normalize the direction to `n`; with vertex components `p_i = dot(q_i,n)` and `b_i = cross(n,q_i)`, the exact maximum center distance along that ray is:

$$
D(n) = \min_i\left(\sqrt{R^2-b_i^2}-p_i\right)
$$

`constrainBodyToArena` preserves the existing radial candidate-projection semantics, not a new wall-response system. For candidate offset `c` from arena center, retain it when `length(c) <= D(c/length(c))`; otherwise place the anchor at distance `D` along the same candidate direction. At zero offset, keep the centered body without dividing by zero. The body orientation stays fixed. This prevents outward clipping while preserving tangential progress; it is neither a circumradius clamp nor a polygon-wall approximation. Repeated constraints retain vertex containment. No body blocking or contact response is introduced.

#### Pursuit And Shared Calibration

`convexContactDistance` uses normalized edge normals from both local bodies, testing both signs. Local center anchors must lie inside their respective silhouettes. For direction `n` from the first body's anchor to the second, it finds the ray exit of their Minkowski contact region from support values `h_first(a) + h_second(-a)` divided by `dot(a,n)` for positive alignment. This produces the approved east/west, north/south and diagonal separations rather than using a single radius or axial maximum.

`pursueBody` takes an explicit maximum travel in tiles, supplied by the caller's existing speed/time rules. It advances toward the target by at most `min(maximumTravel, distance - contactDistance)`. Coincident, already-overlapping and contact-within-roundoff placements stay unchanged: there is no push-apart correction, oscillation, extra stopping gap, contact damage or reciprocal player blocking. Circle constraints remain a separate operation on the proposed position, matching the existing movement sequence. Pursuit speed and the sole simulation clock are unchanged.

`deriveShardTiming` reuses the exact vertex ray limit: `centerTravel = D - emitterOffset`, `reversalAge = centerTravel / speed`, and `lifetime = 2 * reversalAge`. Zero emitter offset is valid; negative/nonfinite offsets, nonpositive/nonfinite speed or radius, invalid geometry, failed centered fit and nonpositive/unrepresentable travel/timing throw `RangeError`. All results use tiles/seconds without rounding to ticks. Approved exact values remain emitter `0.18532903718071878` tile, center reach `17.951764808626624` tiles, reversal `2.2208044714307382` seconds, lifetime `4.4416089428614765` seconds and conservative live bound 88.

These circle operations are available for player/head movement and centered-head calibration only. They do not constrain, despawn or otherwise alter shards in play. Step 10.1 remains responsible for coordinated runtime activation; no projectile trajectory, lifetime or rules identity changes in step 9.2.

## Implemented V2 Handoff

Implemented through steps 10-13 on 2026-10-25 under the user's explicit all-remaining-steps authorization, with tests and a separate verified commit/push per step. The current identity is `crystal-worm-child-head-paladin-v2`. Earlier v1 data and dated preparation/approval records above remain historical. Actual G01-G04 shape approval is preserved; subsequent technical presentation/release acceptance is delegated, not fresh human visual/play/listening approval.

### Active Geometry And Gameplay

- Shared source scale is `435.118 / 19.2 = 22.662395833333335` source pixels/tile, separate from 32 CSS pixels/tile at zoom 1. Source dimensions remain player 36x33, partly occluded head 42x55 and shard 56.576x34.660 pixels; exact local octagons/hexagon and body-center anchors remain in canonical geometry (`app/src/game/config/geometry-candidate.ts`, retired) and [approved silhouettes](#approved-silhouettes-and-anchors).
- Physical drawing/collision consume the same vertices and transforms: upright player/head, fixed initial-firing-axis shard orientation even after reversal. Pure translating-convex swept SAT uses both silhouettes' axes over existing reversal/expiry segments with matching player interpolation. Conservative relative broad-phase rejection never accepts a hit. Numerical roundoff is not collider padding.
- Arena radius 19.2 tiles, player `(0,0)`, head `(0,-16.2)`, actual spawned head max vertex radius 17.422337611416594. Player/head movement checks actual vertices and preserves radial/tangential semantics. Pursuit stops at silhouette contact (axial 1.7209124881066744/1.9415422942741967, diagonal approximately 2.093284691954207 tiles), zero extra gap, no blocking/contact damage.
- Four emitters, eleven shots per emitter, 0.15-second spacing, one second after the last shot, initial cooldown two seconds and clockwise 45 degrees/second continuously. First volleys 2.00 through 3.50 seconds; next group 4.50 seconds. Forty-four shards/group, period 2.5 seconds. Offset 0.18532903718071878 tile is 10% head width.
- Speed 8 tiles/second, incoming 160 HP. Exact maximum shard center distance 17.951764808626624 tiles, center travel 17.766435771445905, reversal 2.2208044714307382 seconds and lifetime 4.4416089428614765 seconds. No nominal screenshot timings or tick rounding. Leading-edge reach 19.2 tiles applies to a stationary centered head; moving emissions are not confined to the arena. Conservative live bound `44 * ceil(lifetime / 2.5) = 88`.
- Shards reverse velocity once, expire only by lifetime, retain once-per-shard hit state and never store an origin/target. No wall/offscreen/collision despawn, global immunity, homing, player attacks, contact damage, seal, touch controls, shrinking arena, accounts or backend. Paladin/stat/health formulas are unchanged.

### Feedback And Audio Policy

Presentation choices below were delegated under the batch authorization, not independently measured ROTMG values or human comfort approval. They do not alter geometry, damage, comparison identity or result timing.

| Surface          | Named Policy And Ownership                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health bar       | One Phaser Graphics, authoritative HP/775; 48x6 CSS pixels, 1 px dark border, 6 px gap below physical body; green `#55d6a0`, empty `#592e39`, border `#101b1b`; inverse camera scaling keeps it screen-sized                                                           |
| Floating amounts | One Phaser Text per accepted hit, exact post-defense amount (-128 now); 18 px Consolas, pink `#ff8fa3`, 3 px dark stroke; 0.9 active seconds, 28 px rise, 12 px gap above body, seven 54 px lanes, at most 16 texts; no merged or inferred HP-delta events             |
| Lethal handoff   | Immediate frozen result is not delayed; only final-advance amounts also appear individually in React's accessible Final hit amounts group until Retry/Home; no independent timer                                                                                       |
| Audio            | Original sine 440 -> 220 Hz, 5 ms attack, total 55 ms, peak gain 0.018, max four voices; borrows Phaser WebAudio context, no copied assets/new context; same accepted-hit callback                                                                                     |
| Audio fallback   | Muted/saturated/suspended/closed/unavailable cues drop, never queue. Supported gestures attempt resume; rejection is nonfatal. Pause stops voices, Retry resets, Home/disposal disconnects owned nodes/listeners; lethal cue may finish naturally while results appear |

The pure health rule returns its calculated post-defense amount independently of lethal HP clamping. Simulation output contains only current-advance accepted hits, including multi-tick/simultaneous/lethal events; session forwards each before its once-only death-result handoff. No persistent log, event bus or extra clock. Numbers age only by actual advanced simulation seconds, freeze on pause/end and clear on Retry/Home. React does not update per hit/projectile during play. Visible accessible Mute remains visit-local across Home/Start, not persisted.

### Zoom, Controls And Records

Zoom limits 0.25-3, default 1, increment 0.125. Dedicated [zoom storage](../app/src/storage/zoom.ts) key `dodge-hell-training.zoom` uses a JSON number and exact finite in-range values, including arbitrary valid fractions without snapping. Read before first scene render; write only actual O/P changes, not HUD/frame updates. Missing/invalid/blocked/quota data retains visit-local operation; unreadable data is preserved, with no history coupling. World units, collision, elapsed time and v2 compatibility are unchanged by zoom/resize.

Home/HUD use one native labeled Controls dialog with keyboard containment, Escape/Close and opener restoration. Actual bindings: WASD, R, O/P, Escape, Mute, Resume and standard Tab/Enter/Space UI activation. HUD opening synchronously pauses play/countdown and clears held input. Modal gate blocks gameplay keys/advance/retry/resume; existing event-identity WeakSet records rejected keys so Phaser's retained queue cannot replay them after closure. Closing leaves explicit Resume, preserved phase/countdown and first-delta skip; centered Paused uses existing overlay conventions. Results cannot resurrect a runtime; Home dialog cannot start play.

[Attempt storage](../app/src/storage/attempts.ts) remains schema 1, latest 100 deaths across rules, exact-version retained best. V1 records remain readable/labeled Other rules, untouched and excluded from v2 bests. Actual deaths save once; retries/aborts do not save. Malformed/future/blocked/quota data falls back without overwriting unreadable history. No migration, deletion, relabeling, all-time-best promise, cross-tab merge or cloud storage.

### Acceptance And Limits

Step 14.1 passed 292 unit/component tests, typecheck, lint, production build and 27 Chromium cases under Node 24.22.1/npm 12.2.1. Real desktop/narrow 0.25/1/3 feedback captures, production-safe actual death/records/reload/Controls/mute flows and storage/audio failures pass. Pure five-minute schedules at 30/60/120 Hz agree on 1313 volleys. The 60-second browser observation recorded three deaths, 58.95 simulated seconds, peaks 88 shards/5 texts/1 sampled voice and 25 retries with one canvas/listener. Bounds are 88/16/4; observations do not prove tighter caps, cross-device FPS or leak freedom.

Technical repeated-practice acceptance is delegated; human feel/listening comfort, Firefox/WebKit, physical mobile input, screen readers and axe remain unverified. Screenshot-based geometry/occluded-head reconstruction, pursuit, range interpretation, cadence and integration are intentional trainer approximations, not current-client fidelity. Future comparison-breaking tuning requires approval/version review. Existing ~1.72 MB Phaser bundle warning remains.

Original `image.png`, `docs/fixes-*-candidate.png` and `docs/fixes-calibration-reference.png` remain local-only/ignored. Generated review pages, screenshots, metrics and browser artifacts stay under ignored `app/test-results/`; none are runtime assets or approved for public distribution. The original SHA-256 remains `f1c9b0715e8d2b91f1eac60ea3ad9e5adc694e4e2bcbd3fc65f9426b5f9cc86b`.

The [README checklist](../README.md#v2-verification-and-handoff) supplies manual practice steps. Actual local checks/statuses and independently authorized publication/live evidence belong to [the v2 archive](implementation-plan-v2.md), especially steps 14.1-14.3; a local pass is not deployment evidence.

## Requested Debug Tools Follow-Up

On 2026-10-25 the user explicitly requested immediate live sliders for enemy parameters, a no-hit god mode and chasing the arena center. This later request authorizes a debug-only tuning interface/invulnerability/target override, superseding the earlier slice exclusions for these tools only. No new phased plan or normal-preset retuning is introduced. [Debug metadata](../app/src/game/config/debug.ts) owns the 19 typed numeric controls, units, defaults and finite exploration ranges; [usage and live-update semantics](../README.md#debug-tools) are documented separately from the historical deployed baseline.

Defaults are copied/derived from the approved v2 config. Width/height scale its existing local convex vertices; drawing and continuous collision consume the same per-simulation shapes. Spawn changes reposition/constrain the head live. Center chase is direct bounded movement to the arena center, not silhouette contact with the player. God mode rejects hits before health/combat/per-shard hit state/counts/feedback/audio, without healing existing damage or resetting already-spent hit state.

Visit-local settings flow React -> existing Phaser handle -> session -> pure simulation, using the same clock. Existing projectiles adopt changed speed/timing/shape; one reversal and lifetime-only expiration remain. Lowering lifetime removes only already-expired shards. Reversal/lifetime stay strictly ordered; cadence edits re-anchor rather than catch up. IDs are monotonic across emitter-count edits. Debug-control focus isolates gameplay input without pausing the live preview; other focus loss and Controls still require explicit Resume.

Any nondefault setting or debug flag taints the current attempt as `crystal-worm-child-head-debug` until the next fresh attempt. Debug results are displayed but not saved/compared; resetting defaults cannot launder an existing attempt. Retry/Home retain visit-local settings, result-screen edits apply on Retry without mutating frozen results, and reset plus fresh Retry/Start restores normal v2 eligibility. No history schema/migration/persistence/deployment claim is added by this local follow-up. Bounds are trainer exploration/resource choices, not measured game-client limits.

The user's later 2026-10-25 screenshot replaces the saved debug preset's cooldown with 3 seconds and projectile dimensions with 1.45x0.65 tiles; other visible values are unchanged. The user additionally requested player dimensions matching the 1.25x1.25-tile head. Loading the selected preset now enables the explicit Match player to head flag, coupling only the player's body dimensions to subsequent head-width/height edits. Both keep their original convex silhouettes. Active vertices own player drawing, swept collision, pursuit separation, immediate live-resize containment, movement and feedback placement. Turning off the flag restores the original player body; Reset defaults and a fresh attempt restore normal v2 eligibility. This is a debug-only approved size override, not a normal v2 retune or approval to replace the scored preset.

## Approved V4 Swarm Contract - Step 17.1

Additive record of the user's 2026-10-26 decisions (G01-G22 in [the active plan](../implementation-plan.md)) and their verification. This supersedes nothing in the v2 or v3 record except where stated. These are user-defined trainer decisions, not new independent ROTMG verification.

### Data Layer

Arena, enemy archetypes and encounter-wide values are authored in JSON under `app/src/game/data/` and validated at runtime by `app/src/game/config/data.ts`. The pixel-measurement geometry study is retired; the surviving approved facts are the 19.2-tile arena radius, the 3-tile enemy center-to-wall margin and the two body outlines, now normalized to a 1x1 tile box and scaled by authored dimensions. Because scaling normalizes by source extents, the retired study's source pixel sizes never affected a shipped vertex.

### Spawn Rule

| Value | Setting | Verification |
| --- | --- | --- |
| Archetype | `crystal-worm-child-head` | The only archetype; spawning adds instances, not kinds |
| Opening enemy | `t = 0` | Schedule index 0, created through the same routine as later spawns |
| `firstSpawnSeconds` | 10 | First additional spawn |
| `everySeconds` | 10 | Spawns at 10, 20, 30 seconds |
| `maxConcurrent` | 4 | Cap reached at `t = 30` seconds |
| `ringRadiusFraction` | 0.84375 | `0.84375 * 19.2 = 16.2` tiles exactly, reproducing the current spawn distance |
| Placement | Farthest from the player | Point diametrically opposite the player's bearing from the arena center |
| Undefined bearing | Seeded random among candidates | The player is exactly at the center at `t = 0`, so this is the default opening |
| Tie-break | Golden angle, 137.5 degrees | Per concurrent spawn index |
| Enemy interaction | Pass through each other | Consistent with `blocksPlayer: false`; per-tick cost stays O(shards) |
| Despawn | Never | Enemies accumulate to the cap and remain |
| Session end | Death only | No win or timeout state |

Verified arithmetic:

- **Ring fit.** The head body's farthest vertex sits 0.728869 tiles from its center, so `16.2 + 0.728869 = 16.928869 < 19.2`. `convexBodyFitsCircle` confirms the body fits at every one-degree bearing on the ring.
- **Golden-angle spread.** Four concurrent spawns land at 0, 137.5, 275.0 and 52.5 degrees, with a minimum pairwise separation of 14.3301 tiles against a 1.25-tile body. The offset is applied per concurrent spawn index, not accumulated across the run.
- **Shard budget.** `burstGroupSeconds = (11 - 1) * 0.19 + 3 = 4.9`, so the live bound per enemy is `6 * 11 * ceil(3 / 4.9) = 66`, and `264` at the cap of four. A four-enemy simulation measured a peak of exactly 264, so the bound is tight rather than loose. The existing browser assertion of 88 is a single-enemy v2-era literal and step 17.4 re-derives it.
- **Cadence against real play.** Recorded v2 deaths occur near 8 seconds, so a typical attempt meets only the opening enemy and a strong attempt meets more. The cap is reached at 30 seconds.

### Randomness And Determinism

Spawn placement is the only source of randomness, and it enters through a seeded generator injected into the simulation, in the same style as the existing audio and storage boundaries. The simulation never calls `Math.random`. Given a seed, the same elapsed time and input reproduce the same enemies at the same positions, including across a catch-up update that executes several fixed steps at once. The seed is not recorded in attempt history, so attempts are not reproducible across runs; no storage schema change is made.

### Recorded Deviations

- **The opening enemy's bearing is no longer fixed north.** Because the player stands exactly at the arena center at `t = 0`, the undefined-bearing case is the default opening rather than a rare edge case, so every attempt opens from a random direction at an unchanged distance of 16.2 tiles. This supersedes the v2 statement that the enemy starts north at `(0, -16.2)`; the v2 record is retained as history.
- **The arena stays 19.2 tiles.** The `fixes.md` request for an arena at double the enemy's reach is superseded by the v3 tuning: shipped reach is `0.35 + 8 * 1.5 = 12.35` tiles. More dodging room matters more once several enemies fire.
- **New comparison identity `crystal-worm-child-swarm-paladin-v4`.** v1, v2 and v3 records are retained, displayed as "Other rules" and excluded from the new retained best. No history schema change.
- **Approved rules are split by enforcement point.** Immutable rules - no contact damage, no body blocking, rotation during cooldown, lifetime-only expiry, once-per-shard hits - are asserted for any config. "Pursuit slower than the Paladin" is asserted only for the shipped encounter, because the debug speed slider reaches 12 tiles/second against the Paladin's 7.0613 and is meant to.

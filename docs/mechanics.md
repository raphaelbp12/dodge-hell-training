# Vertical Slice Mechanics Contract

Status: complete under delegated decision-making on 2026-10-24; ready for user review. No application implementation is authorized by this document alone.

Initial encounter/preset rules version: `crystal-worm-child-head-paladin-v1`.

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

| ID | Attempted URL | Intended evidence | Result on 2026-10-24 |
| --- | --- | --- | --- |
| S1 | https://www.realmeye.com/wiki/crystal-worm-child | Head attack, shard stats/range/return behavior | Browser read succeeded; article labels last update Aug 2019 |
| S2 | https://www.realmeye.com/wiki/paladin | Starting stats and level-up gain distributions | Browser read succeeded; article labels last update Sep 2025 |
| S3 | https://www.realmeye.com/wiki/character-stats | Movement, defense, vitality, health, collision rules/references | Browser read succeeded |
| S4 | https://www.realmeye.com/wiki/sword-of-acclaim | Candidate sword reference; tier/bonuses not established | Blocked |
| S5 | https://www.realmeye.com/wiki/ravenheart-sword | Alternate candidate sword reference | Browser read succeeded: T8, not requested T10; item navigation identifies T10 Archon Sword |
| S6 | https://www.realmeye.com/wiki/desolation-armor | Candidate armor reference | Browser read succeeded: T9, not requested T10; item navigation identifies T10 Vengeance Armor |
| S7 | https://www.realmeye.com/wiki/seal-of-the-divine | T4 seal passive bonuses | Browser read succeeded: T4, +3 DEX on equip |
| S8 | https://www.realmeye.com/wiki/ring-of-exalted-health | Candidate health-ring reference; tier/bonuses not established | Blocked |
| S9 | https://www.realmeye.com/wiki/vital-combat | In-combat trigger, duration, healing changes | Browser snapshot read succeeded; threshold descriptions conflict |
| S10 | https://www.realmeye.com/wiki/controls | Candidate controls URL | Browser revealed missing page; links to S12 |
| S11 | https://www.realmeye.com/wiki/ring-of-paramount-health | T4 health ring passive bonuses | Browser read succeeded: T4, +100 HP and +20 MP |
| S12 | https://www.realmeye.com/wiki/controls-and-commands | Correct controls article | Browser read succeeded |
| S13 | https://www.realmeye.com/wiki/archon-sword | Correct T10 sword | Browser snapshot read succeeded: T10; no passive On Equip bonus listed |
| S14 | https://www.realmeye.com/wiki/vengeance-armor | Correct T10 heavy armor | Browser snapshot read succeeded: T10, +22 DEF on equip |

Candidate item URLs are research leads, not a claim that those items match the requested tiers. S5's navigation identifies Sword of Acclaim as T12, not T10; S11 identifies Ring of Exalted Health as T5, not T4. S6 records that Desolation Armor changed from T10 to T9 in Nov 2024. Use current item-tier evidence, not remembered names. S13/S14 establish the correct T10 items and listed bonuses.

Browser access now resolves most of the original access gap; the user need not supply screenshots for articles already read. Continue through correct linked references for remaining gaps. Label user-provided evidence by provenance; do not present it as independently accessed. Use official linked references when available and note version differences. Do not substitute an old private-server implementation for current ROTMG rules without explicit approval of that limitation.

## Confirmed Trainer Rules

All entries in this section are **user-defined**, not claims of external verification.

| Part | Contract |
| --- | --- |
| Objective | Endless survival against one Crystal Worm Child Head; repeat attempts for practice |
| Character | Fixed average unpotted level-20 Paladin; identical stats every attempt |
| Loadout | T10 sword, T10 heavy armor, T4 seal, T4 health ring; passive bonuses only |
| Excluded actions | Player cannot attack or activate the seal |
| Visible attributes | Health, vitality, speed, defense |
| Movement | WASD; derived speed and approved diagonal/collision rules below |
| Arena | Circular; player at center, enemy near an edge; no shrinking or hazards |
| Enemy movement | Slow pursuit of the player; enemy slower than Paladin |
| Fidelity exception | Pursuit is intentional; the draft's wiki quotation instead describes irregular wandering |
| Emitters | Four, separated by 90 degrees; clockwise rotation; radial outward firing |
| Bursts | Four shots per emitter per burst group: 16 shards total; short intra-burst delays followed by cooldown |
| Moving emitters | Sample emitter position/direction for every shot, not once for the entire burst |
| Initial attack state | Cooldown, not an immediate shot |
| Shard motion | Initial velocity; one timed reversal; no stored origin or homing target; later enemy motion has no effect |
| Shard expiration | Only when lifetime ends, never on collision, arena exit, or leaving the camera |
| Shard damage eligibility | Each shard hits the single player once at most; use per-shard `hasHitPlayer` |
| Camera | Player-centered; approved fixed north-up framing and provisional scale/zoom below; not a full reproduction of ROTMG camera options |
| Keys | WASD movement; R immediate retry; O zoom out; P zoom in |
| Rendering | Geometric placeholders acceptable; prioritize readable collision and depth ordering |
| Records | Local attempt history/comparison; approved metrics and retention below |

## Paladin Preset: Evidence Gate

S2's current stat table supplies the following **verified wiki values**, excluding equipment and Exaltations. Its historical discussion describes older gains, so do not combine those with the current table.

| Required input | Unit | Current state |
| --- | --- | --- |
| Level-1 health, vitality, speed, defense | Stat points | S2: 200 HP, 23 VIT, 22 SPD, 1 DEF |
| Level-up gains | Stat points per level | S2: +25 HP, +1 VIT, +1 SPD, 0 to 1 DEF; DEF probabilities not stated |
| Published average level-20 base stats | Stat points | S2: 675 HP, 42 VIT, 41 SPD, 10 DEF |
| Base stat caps | Stat points | S2: 800 HP, 60 VIT, 55 SPD, 30 DEF; no cap reached by the stated unpotted gains |
| T10 sword | Relevant passive stat points | Archon Sword, T10 (S13); no passive stat bonus listed; no attacks in this slice |
| T10 heavy armor | Relevant passive stat points | Vengeance Armor, T10: +22 DEF (S14) |
| T4 seal | Relevant passive stat points | Seal of the Divine: +3 DEX (S7); none of the four trainer stats; activation excluded |
| T4 health ring | Passive stat points | Ring of Paramount Health: +100 HP, +20 MP (S11); mana excluded from this slice |
| Fractional-average rounding rule | Stat points | Delegated decision: use S2's published integer average, not a reconstructed random-stat distribution |

### Average Methodology

There are 19 transitions from level 1 to level 20. For deterministic gains, add 19 times the gain to the starting stat. For a randomized stat, a mathematical expectation would require probability-weighted outcomes and applicable caps. The source does not establish the DEF probabilities. This fixed-preset trainer therefore uses S2's published integer averages directly and does not implement a random leveling system.

**Delegated decision:** use the published integer average of 10 base DEF, then add equipment. This supersedes the earlier proposal to reconstruct and floor an expected random DEF value. No additional base-stat rounding is necessary; do not invent gain probabilities.

For the read table, 200 + 19 * 25 = 675 HP, 23 + 19 = 42 VIT, and 22 + 19 = 41 SPD. If DEF gains are equiprobable 0/1, the unrounded expected DEF would be 10.5 and flooring yields the published 10. The page does not prove that probability distribution or its average-rounding policy. A smaller, source-grounded alternative is to adopt its published integer average of 10 DEF explicitly as the fixed trainer preset, without implementing random stat rolling.

### Final Equipped Preset

These are derived from published integer averages and verified listed item bonuses. Under the user's delegation, adopt this preset with no pets, Exaltations, enchantments, consumables, or active buffs. These exclusions are trainer scope decisions, not assumptions about the user's actual ROTMG account.

| Primary stat | Published level-20 base | Relevant equipment | Equipped total |
| --- | --- | --- | --- |
| Health | 675 HP (S2) | +100 HP from T4 ring (S11) | 775 HP |
| Defense | 10 DEF (S2) | +22 DEF from T10 armor (S14) | 32 DEF |
| Speed | 41 SPD (S2) | No listed relevant bonuses (S7/S11/S13/S14) | 41 SPD |
| Vitality | 42 VIT (S2) | No listed relevant bonuses (S7/S11/S13/S14) | 42 VIT |

For this preset, ordinary defense-reduced damage from a raw 160 shard is max(160 - 32, 16) = 128 HP. The approved 1.5 tiles/second pursuit is slower than the resulting approximately 7.061333 tiles/second player speed. The delegated combat rule below gives floor(15 + (32 - 15) * 0.75) = 27 as the combat trigger. The 128-HP damage of this shard qualifies for combat.

Do not implement mana, attack speed, damage dealt, inventory management, or ability effects for completeness. Record unused equipment facts only when they explain why a slot does not affect this training preset.

## Derived Rules: Evidence Gate

| Rule | Required specification | Status/source target |
| --- | --- | --- |
| Player speed | Tiles/second as a function of speed stat | S3: 4 + 5.6 * SPD / 75; at 41 SPD, about 7.061333 tiles/second; use this primary expression, not the page's approximately rearranged equality |
| Incoming damage | Defense subtraction and minimum | S3: subtract DEF, with damage at least 10% of raw damage; delegated integer rounding below; no piercing projectiles in this slice |
| Health regeneration | HP/second as a function of vitality | S3: 2 + 0.2407 * VIT; at 42 VIT, 12.1094 HP/second; delegated integration below is not a claim about exact client ticks |
| In-combat regeneration | Reduction | S9: VIT/WIS regeneration operates at 50%; at 42 VIT, 6.0547 HP/second |
| In-combat duration | Seconds | S9: max(1, 7 - 0.04 * VIT - exaltation reduction); at 42 VIT with zero reduction, 5.32 seconds |
| Combat trigger | Threshold, rounding, refresh | S9 examples/table give DEF breakpoints 15/35/65/125; delegated rule below resolves the contradictory prose and defines equality/refresh |
| Player/projectile collision | Shapes, dimensions in tiles, position anchors, overlap/crossing rules | Authentic sizes unknown; user-approved provisional circles below, tested with swept relative-motion crossings |
| Camera | Source controls versus trainer scope | S12 lists Q/E rotation, Z angle reset, X centering toggle, R Nexus escape and O options; trainer intentionally retains approved fixed rotation and R/O/P overrides; numeric scale remains provisional |

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

| Interpretation of 19.2 tiles | Outward distance | Reversal age | Lifetime | Total path length |
| --- | --- | --- | --- | --- |
| Total traveled distance | 9.6 tiles | 1.2 seconds | 2.4 seconds | 19.2 tiles |
| Outward distance only | 19.2 tiles | 2.4 seconds | 4.8 seconds | 38.4 tiles |

Neither interpretation is verified. Returning to the origin at expiry also requires equal time at equal speed; reversal by itself does not establish that equality. The trainer's approved straight-line reversal need not match every detail of the source game's boomerang implementation.

**Decision recorded 2026-10-24:** the user selected the total-traveled-distance interpretation provisionally: reversal age 1.2 seconds, lifetime 2.4 seconds, outward distance 9.6 tiles at 8 tiles/second. This remains an approved trainer approximation, not verified ROTMG range semantics, even after the table's damage/speed/range were read successfully. Replace provisional behavior only after reviewing new evidence with the user.

Implementation invariant once approved: split movement when a simulation step crosses reversal/expiry; detect collisions along traveled segments, including the return segment. A consumed hit does not stop motion or remove the shard. Death/retry ends or resets the session, not a new projectile-specific expiration rule.

## Proposed Encounter Tuning

The user approved every value in this section as **user-defined provisional tuning** on 2026-10-24. These are starting options for playtesting, not verified estimates of authentic ROTMG values. Keep them in named configuration with units. The heading retains the proposal's name to identify the table reviewed by the user.

| Parameter | Proposed initial value/rule | Rationale or constraint |
| --- | --- | --- |
| Arena radius | 16 tiles | Initial spacious practice arena; revisit with camera/range |
| Spawn positions | Player (0, 0); enemy (0, -13) tiles | Deterministic north-edge start, with a 3-tile center-to-edge margin |
| Enemy pursuit speed | 1.5 tiles/second, only if verified Paladin speed exceeds it | A provisional value, not a speed derived from the enemy wiki |
| Enemy stop distance | 1 tile between centers; no overshoot | Avoid coincident centers during slow pursuit |
| Body contact | No contact damage, no entity body blocking | Focus the slice on dodging shards; fidelity limitation if source differs |
| Boundary | Keep player/enemy collision extents inside arena; tangential movement remains possible | Avoid clipping sprites/colliders through walls |
| Player collider | Circle, radius 0.25 tile, center at ground anchor | User-approved provisional approximation, not verified source size |
| Enemy collider | Circle, radius 0.6 tile, center at ground anchor | Boundary extent; not a damage source under proposed contact rule |
| Shard collider | Circle, radius 0.15 tile | User-approved provisional approximation, not verified source size |
| Emitter radius | 0.75 tile from enemy center | Clear separation from enemy placeholder |
| Initial emitter phase | 0 radians points east | Deterministic; other emitters add quarter turns |
| Angular speed | 45 degrees/second clockwise | Tuning candidate, not a fidelity claim |
| Rotation during cooldown | Continue | Continuous pattern phase; reset phase on retry |
| Intra-burst interval | 0.15 seconds | Four shots at offsets 0, 0.15, 0.30, 0.45 seconds |
| Cooldown semantics | 2 seconds from last shot to next group's first shot | Next first shot is 2.45 seconds after previous first shot |
| Initial cooldown | 2 seconds after gameplay becomes active | No shot during optional countdown; not an immediate opening volley |
| Diagonal movement | Normalize; opposite inputs cancel | User-approved trainer rule; not independently verified client behavior |
| Death | End at the simulation tick that applies lethal damage; no regeneration resurrection | Tick-based survival timing, not a wall-clock interval |
| Damage/regeneration order | Resolve shard hits, stop if dead, otherwise apply eligible regeneration | Final Damage And Combat Rules define eligibility and integration |

If the verified speed is at most 1.5 tiles/second, the pursuit recommendation is invalid and needs a new user-approved value. Do not silently clamp it or change the Paladin speed. Proposed collision sizes may substantially affect fidelity and must not be advertised as authentic.

## Proposed Camera And Session Policy

The user approved this entire table on 2026-10-24. Session policies are **user-defined**; camera scale, zoom, and rotation scope remain trainer choices rather than verified ROTMG behavior. The heading retains the proposal's name to identify the table reviewed by the user.

| Topic | Proposed rule |
| --- | --- |
| Camera anchor | Exact player ground position centered in the gameplay viewport, including near the arena edge; do not clamp camera to arena bounds |
| Camera rotation | Fixed north-up for this slice, no Q/E rotation; disclose this limitation if source fidelity would require rotation |
| Movement mapping | W = world north, D = east, S = south, A = west; remains screen-aligned with fixed rotation |
| Default world scale | 32 CSS pixels/tile at zoom 1, independent of device pixel ratio; provisional, not verified ROTMG scale |
| Zoom | Minimum 0.75, maximum 1.5; each O/P press subtracts/adds 0.125; clamp at bounds; ignore held-key repeats |
| Zoom on retry | Retain current zoom during the current app visit; reset encounter state but not viewing preference |
| Resize | Preserve pixels/tile and zoom; change visible world extent, not movement speed; no fit-entire-arena behavior |
| Countdown | 3 seconds on Start; no countdown on R or results Retry to preserve immediate practice |
| During countdown | No simulation time, enemy rotation, pursuit, firing, or damage; health/positions at initial values |
| Manual pause | Escape toggles pause while playing; visible Resume action; R can restart from pause |
| Focus loss | Pause on blur/hidden; clear held inputs; require explicit resume; never advance/catch up hidden time |
| Timer | Count only active simulated survival time, excluding countdown, pause, results, and discarded real-time gaps |
| R behavior | One restart per press from active/countdown/paused/ended; ignore on home; clear held inputs |
| Retry reset | Reset health/combat state, spawns, inputs, projectiles/hit flags, rotation phase, burst/cooldown, elapsed time and metrics |
| Results | Survival duration, hits taken, compatible personal best, recent attempts; no composite skill score |
| Aborted attempt | R or Home before death discards the unfinished attempt; no record, no personal-best eligibility |
| Death record | Save once per attempt; immediate retry must not duplicate a result |
| Comparison | Only compare records sharing encounter/preset rules version; proposed zoom changes do not split records |
| Retention | Keep latest 100 completed attempts total; personal best computed from retained compatible records, clearly labeled as such |
| Storage failure | Practice remains playable; no persistence guarantee when browser storage is unavailable |

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

Documentation-only step: validate local links, required mechanics sections, evidence labels, source dates, conditional range/preset/combat arithmetic, approval checklist, and completed step status. No application code, unit-test harness, or bootstrap should be created for this research. Actual behavior tests remain work for the implementation steps.

Known limitations, not implementation blockers: published stat averages do not establish the DEF roll distribution; the trainer uses the published integers instead. Vital Combat has inconsistent threshold descriptions; the trainer selects its worked-example interpretation. Authentic hitboxes, camera scale, client regeneration tick/rounding details, and shard lifetime are not established; approved or delegated trainer approximations cover them. Encounter tuning and camera/session policies retain earlier user approval. The equipped preset and final arithmetic are delegated decisions for later user review. No source gap is silently represented as current-client verification.
# Phase 23: Author The Killer Bee Queen Of The Nest

> Step prompts and execution records for phase 23 of [the implementation plan](../../implementation-plan.md), whose general sections stay the authority for how to work. Read only this introduction and the requested step: grep `^### Step 23.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-23.md` and replace the plan's step lines with one-sentence outcomes.

Every step in this phase authors data against machinery that already exists and is already tested. If a step needs a new pattern field, a new motion kind or a new phase feature, that is a signal the machinery is incomplete: **stop and report it** rather than extending the engine inside an authoring step.

Three rules apply to all ten steps:

1. **Cite every number.** A projectile entry's `source` names its row number in [the source extract](../killer-bee-queen-source.md). An attack's `tuningSource` is `"wiki-prose"` when the source states the attack's shape, or `"trainer-authored"` when this project invented the number. That is K13, and the loader enforces it.
2. **Author a projectile only when a phase fires it.** No `Plagued Nest only` row enters `projectiles.json` (K07), and no row is added speculatively.
3. **Record each phase's fidelity gaps** in that step's execution record: what the source describes that this phase does not do, and why.

### Step 23.1 - Add Encounter Selection And The Cleared Outcome

Status: pending. Dependencies: 22.5.

**Implementation prompt**

Make more than one encounter exist. Until this step, `encounter.json` describes the one and only encounter; the Queen needs her own arena policy, spawn policy, rules version and history. K14 settles the selection surface: a plain list on the Home screen.

Restructure the authored data so encounters are a keyed collection: each entry owns its `rulesVersion`, `primaryArchetype`, arena reference, `spawns` rule, `session` values and its display name. The Crystal Worm encounter keeps `crystal-worm-child-swarm-paladin-v4` and every one of its current values unchanged. Add the Queen's encounter entry with `killer-bee-queen-nest-paladin-v5`, its `primaryArchetype` pointing at an archetype that step 23.2 will author, and a `spawns` rule that creates exactly one enemy at `t = 0` and never again - the Queen is a single boss, not a swarm, so `maxConcurrent` is 1 and no repeat cadence applies. Validate that shape rather than relying on a large `everySeconds`.

**Fix F5 here, because this is the step that makes it a real defect.** `constrainToArena` and `advanceSimulation` read the module-level `ENCOUNTER_CONFIG` for the arena and the fixed step instead of reading `state.config`. That is harmless while every simulation shares one encounter and becomes wrong the moment two encounters differ. Change both to read `state.config`, and add a test that two simulations built from different encounter configs each use their own arena. Do not fix the other open principles-review findings; they stay in [the deferred register](../deferred-work.md) as D09.

Surface the choice and the outcome:

- Per K14, add a plain selectable list of encounters to the Home screen, beside the existing Start button, showing each encounter's display name and defaulting to the Queen. Reuse the existing CSS Modules styling and keyboard-accessible control patterns already on that screen; do not introduce a component library, a card layout, thumbnails or a second screen. Also add an `?encounter=<id>` parameter validated like the existing `?seed=`.
- Record the chosen encounter on each attempt and compare bests **within** an encounter, never across. `AttemptRecord` already carries `rulesVersion`, which is per-encounter, so prefer deriving the grouping from it to adding a field. If a field is genuinely required, add it as optional with a default so existing v1-v4 records still load, and prove that with a test against a stored record from before this change.
- Surface step 22.2's `"cleared"` simulation phase: the session ends as a win, the results screen says the boss was defeated and shows the elapsed time, and the attempt is recorded with an outcome distinguishable from a death. Keep the existing retry flow and the R key working identically for both outcomes.

Do not add difficulty settings, encounter unlocking, a second arena shape or per-encounter stat presets.

**Focused checks:** focused failing test on the keyed encounter collection first. Then: the Crystal Worm encounter's derived config is identical field for field to before this step; the Queen's encounter validates and spawns exactly one enemy that is never repeated; two simulations with different arenas each constrain to their own, which is the F5 regression test; the Home list renders one entry per encounter, defaults to the Queen, is keyboard operable and starts the selected encounter; `?encounter=` accepts a known id and ignores an unknown one; bests are grouped per encounter and a v4 record still loads and still appears under the Crystal Worm; a cleared run ends the session as a win, shows the elapsed time and records an attempt; and retry works from both outcomes. All four routine gates, plus `npm run test:e2e -- --grep "encounter"`.

**Acceptance:** encounters are a keyed collection with per-encounter rules versions and bests, the Home screen lists them and the selection starts the right one, F5 is fixed with a regression test, the Crystal Worm encounter is byte-identical, a cleared run is a visible win, existing records still load, and all four gates pass.

### Step 23.2 - Author The Queen's Skeleton

Status: pending. Dependencies: 23.1.

**Implementation prompt**

Author the Queen as a harmless, fully-structured boss: real body, real health, all eight phases with their real thresholds, telegraphs, invulnerability windows and movement - and **no attacks at all**. A playable but harmless boss proves the phase machine against real data before a single projectile exists, which is far easier to debug than a complete fight.

Add the `killer-bee-queen` archetype to `enemies.json`:

- Body: a new convex outline in `shapes.json` if the existing two do not suit, normalized to a 1-by-1 box and within the three-to-eight vertex contract. Size it from the source's hitbox size of 2, authored as `widthTiles` and `heightTiles` of 2. Record that the mapping from ROTMG's "Hitbox Size" to tiles is this project's interpretation, not a published equivalence.
- `health`: `maxHealthHp` 112,500 from the source, and `progression` of `{ "kind": "simulated-dps", "hpPerSecond": 375 }`, the rate approved in K15. Cite K15 in the authored `comment`, since 375 is this project's value and not a published one.
- `phases`: all eight, with the source's thresholds - 1, 0.9, 0.75, 0.6, 0.45, 0.25, 0.25 and 0.125 - each with `attacks: []`, its authored movement, its telegraph colour and seconds, and its invulnerability window. Phase 6 authors `exitAfterSeconds` of 29 and an `invulnerableOnEnterSeconds` of 29, so per K08 it costs no health, which is what keeps phase 7 starting at 25%. Phases 2, 5 and 7 author their three colour sub-phases with empty attack lists.
- Movement per phase, from the source: 1 alternating orbits via two sub-phases; 2 chase per colour; 3 `move-to-point` at the arena centre; 4 `orbit` counter-clockwise at a small radius; 5 per colour - orbit, chase, wander; 6 `move-to-point` at the centre then stationary; 7 per colour; 8 `move-to-point` at the centre.

Note the two thresholds that are both 0.25: phase 6 is entered at 25% and exits on its duration, and phase 7 is then entered at the same fraction. Step 22.3's loader rejects a duplicate threshold, so this needs the rule relaxed to permit a repeat **only** where the earlier phase authors an `exitAfterSeconds`. Implement that as a narrow validation change with its own test, not by removing the ordering check.

Do not author any projectile or attack. Do not author minions.

**Focused checks:** focused failing test that the Queen's archetype loads and reports eight phases first. Then: her body fits inside the arena at her spawn point; the derived phase timeline matches the plan's Worked Progression Timeline at 375 HP per second, phase by phase, asserted on entry times; phase 6 costs no health and phase 7 begins at 25%; the duplicate-threshold relaxation accepts this list and still rejects a duplicate without an `exitAfterSeconds`; each phase's movement behaves as authored; a full run reaches phase 8 and then `"cleared"`; and the Crystal Worm encounter is untouched. All four routine gates, plus `npm run test:e2e -- --grep "killer bee queen"`.

**Acceptance:** the Queen exists as a harmless eight-phase boss with sourced health and thresholds, her derived timeline matches the plan's table, the duplicate-threshold relaxation is narrow and tested, a full run clears, and all four gates pass.

### Step 23.3 - Author Phase 1

Status: pending. Dependencies: 23.2.

**Implementation prompt**

Author phase 1's attacks. Source: *"The Queen switches between circling the room and circling the pond of Killer Honey in the middle, throwing radial spreads of Quieting Blue Bombs around it while throwing targeted Dazing White Bombs at players. In addition, it fires directed spreads of Large Blue/Red Stingers and Small Yellow Stingers at nearby players... it may sometimes look like the Queen is firing only 3 stingers, but in fact that is 9 shots with each color stinger stacked ontop of each other."*

Author these projectiles, citing their row numbers: row 30 `blue-bomb`, row 27 `white-bomb-v1`, row 2 `red-stinger-large-v1`, row 6 `blue-stinger-large`, row 3 `yellow-stinger-small-v1`. The two bombs use `kind: "lob"` with the source's radius of 2 tiles; the source gives bombs **no speed**, so their `speedTilesPerSecond` and `travelSeconds` are `trainer-authored` and must be marked as such.

Author these attacks on phase 1:

- A `ring` of `blue-bomb` with no rotation, which is the "radial spread... around it".
- A `spread` of `white-bomb-v1` with `shots: 1` and `aim: "player"`, which is the "targeted" bomb.
- **Three** `spread` attacks sharing one cadence, one each for `red-stinger-large-v1`, `blue-stinger-large` and `yellow-stinger-small-v1`, all `aim: "player"`. This is how the source's "3 stingers that are in fact 9 shots with each color stacked" is expressed, per step 20.3's note: one projectile per attack, three attacks fired together. Author `shots: 3` on each, giving nine shots in three visual lines.

The phase's two sub-phases from step 23.2 keep identical attack lists and differ only in their orbit radius, which is how "switches between circling the room and circling the pond" is expressed without a second mechanism.

Mark every shot count, interval, cooldown, arc and bomb travel time `trainer-authored`. The source states the **shape** of each attack, so each attack's pattern kind, aim and projectile are `wiki-prose`; its numbers are not. Do not tune for difficulty here - that is step 24.2. Pick values that are clearly survivable and let 24.2 tighten them.

Record as a fidelity gap: the Plagued Nest's extra green stinger spread is excluded (K07), and the pond the Queen circles is not modelled because the arena is static (K05, D01).

**Focused checks:** focused failing test that phase 1 fires something first. Then: each of the five projectiles validates and its damage, speed, range and conditions match its cited row exactly; the three stinger attacks fire in the same tick and produce nine shards; the targeted bomb's destination is the player's position at fire time; the radial bomb ring is evenly spaced; both bombs detonate and apply Quiet and Dazed respectively, which being inert conditions means the chips appear and no rule changes; a scripted dodge run survives the whole phase, and a stationary run takes damage; the loader rejects an attack if you forget `tuningSource`. All four routine gates.

**Acceptance:** phase 1 fires the five sourced projectiles through two bombs and three stacked stinger spreads, every value is cited or marked trainer-authored, the sub-phase orbit alternation works, the phase is survivable, and all four gates pass.

### Step 23.4 - Author Phase 2 And The Killer Bee Minions

Status: pending. Dependencies: 23.3.

**Implementation prompt**

Author phase 2's three colour sub-phases and the first minions. Source, per sub-phase: red - *"she chases players quickly while firing multi-directional spreads of Small Red Stingers and single directed Large Red Stingers. All the while, she tosses radial bursts of Red Bombs that inflict Confused."* Blue - *"she chases players while firing directed spreads of Large Blue Stingers and spirals of Small Blue Stingers. She also fires a messy omnidirectional spray of Blue Balls along with radial bursts of Blue Bombs that Quiet."* Yellow - *"she fires 3-way spreads of Large Yellow Stingers and a messy spiral of Yellow Balls, all while tossing a large number of White Bombs that Daze around her."* And: *"For each color, she also spawns in a number of the respective Killer Bees, which despawn when she switches attacks. She is invulnerable in between attacks."*

The three Killer Bees are **already transcribed** in [the source extract](../killer-bee-queen-source.md)'s Minion Source Extracts section (K16); author from it and do not re-fetch. All three are 400 HP, 25 defence, levitating, and all three behave identically: *"Chases players while firing single shots at them."* Their single attacks differ: Red fires `EH Red Stinger Small` at 80 damage, 7 tiles per second, 10.5 tiles range, armour-piercing, no condition; Blue fires `EH Blue Stinger Small` at 100 damage, 7.5, 9.75, Silenced for 3 seconds; Yellow fires `EH Yellow Stinger Small` at 130 damage, 6, 10.5, no condition. Note that these are **not** the Queen's own stinger rows - the damage, speed and range all differ - so they need their own catalog entries rather than reusing hers.

Author the new projectiles: row 1 `red-stinger-small`, row 25 `red-bomb-v1` (Confused), row 5 `blue-stinger-small-v1`, row 9 `blue-ball-v2`, row 4 `yellow-stinger-large`, row 10 `yellow-ball-v1`. `red-stinger-large-v1`, `blue-stinger-large`, `white-bomb-v1` and `blue-bomb` already exist from 23.3; reuse them rather than adding variants.

Map each described attack onto the vocabulary, and note the three that matter: *"messy omnidirectional spray"* is `scatter` with a 360-degree cone; *"spirals of Small Blue Stingers"* and *"a messy spiral of Yellow Balls"* are `ring` with a nonzero rotation rate; *"3-way spreads"* is `spread` with `shots: 3`. Red Bombs inflicting **Confused** are the first genuinely dangerous condition in the fight - the source warns that "staying in front of the queen will make them miss you entirely" - so place them as a radial `ring` of lobs around her, not aimed.

Author each colour's minions as a sub-phase `spawns` entry with `despawnOnExit: true`, placed `ring-around-owner`. Each Killer Bee is its own archetype with a single phase, its own movement and its own attack, authored from its wiki page.

Author each sub-phase's `invulnerableOnEnterSeconds` as a nonzero value, which is the source's "invulnerable in between attacks" and which per K08 pauses the drain.

Record as a fidelity gaps: the Killer Honey flood that would confine the player to a narrow ring around the Queen is not modelled, so this phase is materially easier than the live fight (K05, D01); the teleport of all players into the room has no single-player meaning; the Plagued Nest's green sub-phase is excluded (K07).

**Focused checks:** focused failing test on the red sub-phase firing first. Then: each new projectile matches its cited row; the three sub-phases cycle on their authored durations with their own attack sets and movement; minions spawn on sub-phase entry, are placed on the owner ring and are despawned on exit while their shards survive; the invulnerability window pauses the drain for exactly its duration; a `scatter` spray is reproducible under a fixed seed; each Killer Bee archetype validates and its values match the transcribed minion section exactly, including that they differ from the Queen's same-named stinger rows; the minion cap suppresses rather than queues when it is reached. All four routine gates, plus `npm run test:e2e -- --grep "killer bee"`.

**Acceptance:** phase 2 cycles three colour sub-phases with sourced attacks and minions, the Killer Bees use their own transcribed stats rather than the Queen's, despawn-on-exit and the invulnerability pause both work, fidelity gaps are recorded, and all four gates pass.

### Step 23.5 - Author Phase 3

Status: pending. Dependencies: 23.4.

**Implementation prompt**

Author phase 3, the stationary barrage. This is the phase whose structure the source states most precisely, so it is the best test of the `ring` pattern.

Source: *"the Queen despawns all Killer Bees and moves to the center of the room, flashing white. She then becomes stationary and begins firing a messy omnidirectional barrage of Red, Blue, and Yellow Balls along with Slowing bees, occasionally lobbing White Bombs along the cardinal/intermediate directions. Every 7 seconds and at the start of the phase, she fires an unavoidable wave of Red Glaives that do no damage but Armor Break for 7 seconds."* And the explicit pattern: *"Two 3-armed spirals of blue orbs, each one rotating in a different direction; One two-armed spiral of red orbs, rotating clockwise; Frequent rings of yellow orbs; Occasional 4-way bursts of bee projectiles."*

Author these projectiles: row 14 `red-ball` (Curse), row 24 `bee-shot` (Slowed), row 7 `red-glaive-v1` (0 damage, Armor Broken 7s). Reuse `blue-ball-v2`, `yellow-ball-v1` and `white-bomb-v1`.

Author six attacks, mapping the source's list one to one:

- Two `ring` attacks of `blue-ball-v2`, each `arms: 3`, with **opposite** signs on `clockwiseDegreesPerSecond`.
- One `ring` of `red-ball`, `arms: 2`, clockwise.
- One `ring` of `yellow-ball-v1` with no rotation and a short cooldown, which is "frequent rings".
- One `ring` of `bee-shot`, `arms: 4`, with a long cooldown, which is "occasional 4-way bursts".
- One `ring` of `white-bomb-v1` lobs, `arms: 8`, which is "along the cardinal/intermediate directions" - author the eight bearings as a ring with eight arms, not as eight attacks.
- One `ring` of `red-glaive-v1` with a `cooldownAfterLastShotSeconds` of **7**, which is the only cadence in this phase the source actually states, so mark it `wiki-prose` while every other cadence here stays `trainer-authored`.

The phase's movement is `move-to-point` at the arena centre, which stops on arrival and is therefore stationary for the rest of the phase - no second mechanism and no sub-phase is needed. The despawn of phase 2's Killer Bees happens automatically through their `despawnOnExit` flag; confirm that in a test rather than adding explicit despawn logic.

Record as a fidelity gap: the source calls the Red Glaive wave "unavoidable", which is true in the real fight's small room. This project's arena is 19.2 tiles, so a radial wave from the centre is dodgeable near the wall. Do not fake unavoidability by widening the wave into something the source does not describe; record the gap and leave it for step 24.2 to consider.

**Focused checks:** focused failing test on the two counter-rotating blue spirals first. Then: the two blue rings rotate in opposite directions, asserted on bearings at two separate times; the red ring has exactly two arms and rotates clockwise; the glaive wave fires at phase entry and then every 7 seconds exactly; a glaive deals 0 damage, still registers a hit and applies Armor Broken for 7 seconds; with Armor Broken active, a subsequent 100-damage non-piercing shot deals 100 rather than 68, linking this phase to step 21.3's formula; the eight-arm bomb ring lands on the eight compass bearings; phase 2's minions are gone on entry; the Queen arrives at the centre and then stops. All four routine gates.

**Acceptance:** phase 3 reproduces the source's six-attack pattern including the counter-rotating spirals and the 7-second armour-break wave, Armor Broken measurably changes damage, the minion despawn is automatic, the unavoidability gap is recorded, and all four gates pass.

### Step 23.6 - Author Phase 4

Status: pending. Dependencies: 23.5.

**Implementation prompt**

Author phase 4, the glaive phase. Source: *"the Queen begins to slowly circle counter-clockwise in the center of the room while firing 4-directional spreads of Yellow, Red, and Blue Glaives at a rapid pace. Each one is aimed at a different angle so that it cannot be dodged just by standing still. It is imperative to dodge the yellow shots as they will paralyze you and make you tank half of the next wave."*

Author these projectiles: row 11 `yellow-glaive-v1` (Paralyzed 0.8s and Dazed 3s), row 12 `red-glaive-v2` (Armor Broken 3s, armour-piercing), row 13 `blue-glaive-v1` (Quiet and Pet Stasis, both inert). Reuse nothing else.

Author three `ring` attacks, one per glaive colour, each `arms: 4`, sharing a cadence but each with a **different** `initialPhaseDegrees` and a nonzero `perBurstAdvanceDegrees`, which is how the source's "each one is aimed at a different angle so that it cannot be dodged just by standing still" is expressed. Choose advances that do not share a common divisor with 90 degrees, so the three rings never realign into a single dodgeable wave; assert that property in a test over many bursts rather than trusting the choice.

The source's Tips section additionally states that phase 4 fires a *"shotgun of Red Hive Shots"* where *"each one inflicts 200 unblockable damage, meaning that tanking the shotgun will result in 600 armor-piercing damage"*. The behaviour prose for phase 4 does not mention it. **Record this as a source conflict**, resolve it by including it - the Tips text is specific, quantitative and names phase 4 - and author it as a `spread` of three row 15 `hive-spiral-shot-v1` with `aim: "player"`. Three shots at 200 armour-piercing damage is 600, matching the quoted figure exactly, which is good evidence the reading is right. Note in your execution record that this binding comes from the Tips section rather than the phase description.

This phase is the first that can kill a careless player outright: the Paladin has 775 HP, and 600 armour-piercing damage plus a paralysing glaive is most of it. That is the intended difficulty, but confirm the phase is survivable with correct play before marking the step complete.

Record as a fidelity gap: the Plagued Nest's faster spinner spreads and multicoloured 4-way spiral are excluded (K07).

**Focused checks:** focused failing test on the three glaive rings firing at different phases first. Then: each projectile matches its cited row, including `red-glaive-v2`'s armour-piercing flag; the three rings never realign over at least fifty bursts, asserted on bearing sets; the hive-shot shotgun is three shots and deals exactly 600 against the Paladin's 32 defence, exercising step 21.3's armour-piercing path; a paralysing yellow glaive hit leaves the player immobile for 0.8 seconds and therefore unable to dodge the following volley, which is the source's stated consequence; the orbit's derived tangential speed is below the player's; a scripted dodge run survives the phase. All four routine gates.

**Acceptance:** phase 4 fires three non-realigning glaive rings plus the Tips-sourced hive shotgun at a verified 600 armour-piercing damage, the paralysis consequence is demonstrated, the source conflict is recorded, the phase is survivable with correct play, and all four gates pass.

### Step 23.7 - Author Phase 5

Status: pending. Dependencies: 23.6.

**Implementation prompt**

Author phase 5's three colour sub-phases, the densest of the colour phases. Source: red - *"she rapidly circles the pool of Killer Honey in the middle of the room, firing streams of Red Balls in various directions while also firing radial bursts of Red Glaives and 3-directional shotguns of red Hive Spiral Shots. She also fires radial bursts of Large Red Stingers."* Blue - *"she rapidly chases players, firing a messy bombardment of Blue Balls in all directions (akin to a Djinn's pattern) while using radial bursts of Blue Glaives and 4-directional Small Blue Stingers. She also fires wide, directed shotguns of blue Hive Range Shots."* Yellow - *"she slowly wanders in the center of the room, firing short spiralling bursts of bee projetiles and 4-directional spreads of Yellow Glaives. She also uses radial bursts of Large Yellow Stingers and 4-directional yellow Hive Shots."*

Author the new projectiles: row 15 `hive-spiral-shot-v1` if 23.6 did not already, row 21 `red-stinger-large-v2`, row 20 `blue-ball-v3`, row 18 `blue-stinger-small-v2`, row 16 `hive-range-shot-v1`, row 17 `hive-shot-v1`. Reuse `red-ball`, `red-glaive-v2`, `blue-glaive-v1`, `yellow-glaive-v1`, `yellow-stinger-large` and `bee-shot`.

This step is where the pattern vocabulary earns its keep; map carefully and reuse:

- *"streams... in various directions"* and *"messy bombardment... in all directions"* are both `scatter`, the first with a wide cone and the second with 360 degrees.
- *"radial bursts"* are `ring` with no rotation.
- *"3-directional"* and *"4-directional"* are `spread` with `shots` of 3 or 4 when the source says "shotgun" or "spread", and `ring` with `arms` of 4 when it says "4-directional" of a radial attack. Where the source is ambiguous between the two, choose `spread` aimed at the player when it also says "directed", and `ring` otherwise, and state your reading in the execution record.
- *"short spiralling bursts"* is `ring` with a rotation rate and a small `shotsPerBurst`.

Each sub-phase spawns its colour's Killer Bees, reusing the archetypes authored in 23.4 - *"every time she uses a colored attack she spawns in a group of the respective color Killer Bee"*. No new minion archetype is needed here; if you believe one is, check the transcribed minion section before authoring anything.

Record as fidelity gaps: the hardening entrance tiles that act as walls, and the disconnect-on-changing-tile mechanic, are not modelled (K05, D01); the Queen's Stun vulnerability on each colour switch has no effect (D05); the Plagued Nest's green sub-phase is excluded (K07).

**Focused checks:** focused failing test on the red sub-phase's hive shotgun first. Then: each new projectile matches its cited row; all three sub-phases cycle with their own movement - orbit, chase and wander respectively - and their own attack sets; the wander movement stays inside its radius and is seed-reproducible; the blue 360-degree scatter is reproducible and covers the circle; `hive-range-shot-v1` applies Pet Stasis and Weak, both inert, and the chips show while no rule changes; Killer Bees spawn and despawn per sub-phase; a scripted dodge run survives all three sub-phases. All four routine gates.

**Acceptance:** phase 5's three sub-phases are authored with sourced attacks, each ambiguous directional reading is recorded, minions are reused rather than duplicated, the three movement kinds all work in one phase, and all four gates pass.

### Step 23.8 - Author Phase 6, The Nests And Worker Bees

Status: pending. Dependencies: 23.7.

**Implementation prompt**

Author phase 6, the "stinger phase" the source calls *"extremely dangerous and most likely instant death if not avoided"*. This is the phase the whole `ring` gap-and-spread design in step 20.5 exists for.

Source: *"the Queen despawns all Killer Bees, moves back to the center of the room while flashing red, and spawns 3 Killer Bee Nests along the edges of the room... The Queen herself will be stationary and invulnerable while firing a 2-way shot-machinegun of Small Red Stingers that rotates clockwise for 29 seconds, with two gaps in the rotation. The shot-machinegun is initially aimed at the top and bottom of the room and will expand over the first few seconds to cover the top-right and bottom-left corners of the room, meaning players should start in either the top-left or bottom-right to avoid this attack."* And: *"The 3 Nests will periodically spawn Small Worker Bees and gradually swell in size until they break open."*

The Nest and the Small Worker Bee are **already transcribed** in [the source extract](../killer-bee-queen-source.md)'s Minion Source Extracts section (K16); author from it. Its page slug is `killer-bee-nest-queen`, not `killer-bee-nest`, which is an unrelated stub.

The machinegun is a single `ring` attack of `red-stinger-small`, using every option step 20.5 added: `arms: 2`, a clockwise rotation rate, two `gapSectorsDegrees` entries, and an `armSpreadDegreesPerSecond` with a `maxArmSpreadDegrees` of 45 so the two arms open from the vertical to cover the diagonals, exactly as the source describes. Its `shotsPerBurst` and `shotIntervalSeconds` make it a machinegun; those are `trainer-authored`. The two gaps are the openings the player survives in, so their width is the single most important tuning value in this phase - author it generously here and let step 24.2 narrow it.

Phase 6 already authors `exitAfterSeconds: 29` and `invulnerableOnEnterSeconds: 29` from step 23.2, so it costs no health. Verify that rather than re-authoring it.

Author the three Nests as a phase `spawns` entry placed `arena-ring`, with `despawnOnExit: false` - the source says the broken-open Nests keep firing through phase 7 and stop only at the Queen's death, so they must survive the phase change. Per K06 they are **not destructible**: author them with no `health` block, and record the consequence that the phase always runs its full 29 seconds and always yields the default Beehemoth set.

**Each Nest is a two-phase archetype, per K18.** The source gives it two distinct attack sets, and the phase machine already expresses the transition with no new mechanism:

- Phase 1, alive: a `ring` of its colour's Hive Shot, with `exitAfterSeconds` set so it breaks open at the end of the Queen's phase 6 - the Nest page says "after approximately 30 seconds". Red fires `EH Hive Spiral Shot` at 100 damage, speed 5, range 7, armour-piercing; Blue fires `EH Hive Range Shot` at 120, 5.5, 7.15, Weak for 2 seconds; Yellow fires `EH Hive Shot` at 120, 4.5, 6.75, Dazed for 2 seconds. These are again **not** the Queen's same-named rows, so they need their own catalog entries.
- Phase 2, corpse: a `ring` of its colour's ball at 45 damage, speed 2.5, range 1.875, with a short cooldown, which is the source's "the dead Nests will fire their radial attacks constantly". Red applies Curse for 2 seconds, Blue Pet Stasis for 4, Yellow Dazed for 2. No exit - it fires until the encounter ends.

Give the Nest's **alive** phase a `spawns` entry of its own for the Small Worker Bees. The Worker Bee is 125 HP, charges the player, and per K17 and step 21.5 applies its slow through **contact damage**, not a projectile: author `contactDamageHp` 40, `contactArmorPiercing` true, `contactConditions` of Slowed for 1.6 seconds, and a `trainer-authored` `contactCooldownSeconds`. Its movement is `chase`. Do not substitute `bee-shot` for its contact attack; the source is explicit that it is a speed-0, range-0 touch attack.

Record as fidelity gaps: Nest destruction and Beehemoth colour control are deferred (K06, D03); the Plagued Nest's 3-way machinegun and fourth Nest are excluded (K07); the hardened honey that lowers move speed in this phase is not modelled (K05, D01).

**Focused checks:** focused failing test on the machinegun's two arms and gaps first. Then: the arms start vertical and spread to 45 degrees over the authored time and then hold; a player standing inside a gap sector takes no hits for the whole 29 seconds, asserted as a scripted run with zero accepted hits; a player standing in the beam takes heavy damage quickly; the gaps rotate with the ring; the phase exits after exactly 29 seconds with the Queen's health unchanged; the three Nests spawn on the arena ring, survive the phase exit and keep firing; each Nest transitions from its alive phase to its corpse phase on its authored duration and the two attack sets differ as transcribed; the Nest attack stats differ from the Queen's same-named rows; Worker Bees spawn from the alive Nests, chase the player and apply 40 armour-piercing contact damage with Slowed through step 21.5's path rather than through a projectile; the minion cap holds with three Nests plus their Worker Bees. All four routine gates, plus `npm run test:e2e -- --grep "machinegun"`.

**Acceptance:** phase 6 fires the gapped, spreading 2-arm machinegun with a provably survivable gap, runs exactly 29 seconds at no health cost, spawns three indestructible two-phase Nests that break open into their corpse attack and survive into phase 7, Worker Bees slow the player by contact, deferred items are recorded, and all four gates pass.

### Step 23.9 - Author Phase 7 And The Beehemoths

Status: pending. Dependencies: 23.8.

**Implementation prompt**

Author phase 7, the Queen's last colour rotation, with the three Adolescent Beehemoths.

Source: yellow - *"she stays in the middle of the room, firing a rotating spiral of Slowing bees while firing another spiral of Yellow Balls rotating the other way. She also fires radial bursts of Large Yellow Stingers and yellow blasts, along with 4 White Bombs that Daze, at a 15 degree-increasing angle each time."* Red - *"she circles the area slowly while firing rings of Red Balls and red Hive Spiral Shots, along with wide spreads of Large Red Stingers and radial Red bombs. She makes a total of two rotations."* Blue - *"she fires sprials of Blue Glaives, radial bombardments of Blue Balls, targeted spreads of Small/Large Blue Stingers, and enormous radial blasts of blue Hive Range Shots while quickly chasing the nearest player."* And: *"the Beehemoths will heal for 7,500 HP up to 3 times... The Beehemoths also heal the Queen every 10 seconds... With less than 5 players, they will each heal for 600 HP."*

The three Adolescent Beehemoths are **already transcribed** in [the source extract](../killer-bee-queen-source.md)'s Minion Source Extracts section (K16). All three are 20,000 HP, 40 defence, levitating, and all three behave the same way: *"Fires pairs or spreads of large stingers at the nearest player. During the Killer Bee Queen's final phase, fires radial bursts of large stingers and spreads of Glaives"* - orbs rather than glaives for the red one. Their stats: Red fires `EH Red Stinger Large` at 100 damage, speed 6, range 10.5, Armor Broken for 4 seconds, plus `EH Red Ball` at 60, 7, 10.5, Curse for 2 seconds; Blue fires `EH Blue Stinger Large` at 120, 6.5, 9.75, Weak and Pet Stasis, plus `EH Blue Glaive` at 60, 7.5, 10.5, Quiet for 3 seconds; Yellow fires `EH Yellow Stinger Large` at 150, 7, 9.8, Dazed for 2 seconds, plus `EH Yellow Glaive` at 80, 5, 8.5, Paralyzed for 0.8 seconds. None of these match the Queen's same-named rows, so all six need their own catalog entries - and note that the yellow glaive is the only Beehemoth shot that paralyses, which makes it the one the player must actually dodge.

**Per K18, each Beehemoth is a two-phase archetype**: phase 1 is the aimed-stinger behaviour the source describes as normal, and phase 2 is the radial-burst-and-glaive-spread behaviour it describes for the Queen's final phase. Neither phase has an HP or duration exit - the phase is selected at spawn time by the `startPhaseIndex` that step 22.4 added. This step spawns them at index 0; step 23.10 spawns them at index 1.

Author the new projectiles: row 19 `yellow-ball-v2`, row 28 `white-bomb-v2` (radius 3), row 23 `red-stinger-large-v3`, row 26 `red-bomb-v2`, row 8 `blue-ball-v1`. Reuse `bee-shot`, `yellow-stinger-large`, `hive-shot-v1`, `red-ball`, `hive-spiral-shot-v1`, `blue-glaive-v1`, `blue-stinger-small-v1`, `blue-stinger-large` and `hive-range-shot-v1`.

Two details need care:

- The yellow sub-phase's *"4 White Bombs... at a 15 degree-increasing angle each time"* is exactly step 20.5's `perBurstAdvanceDegrees`: a `ring` of `white-bomb-v2` lobs with `arms: 4` and `perBurstAdvanceDegrees: 15`. This is a stated number, so mark it `wiki-prose`.
- **The Beehemoth healing is a phase-level progression override, not new machinery.** Three Beehemoths each healing 600 HP every 10 seconds is 180 HP per second of healing at the single-player rate the source gives. Author phase 7's `progression` override as the encounter's rate minus 180 HP per second, cite the source lines, and note in the execution record that the healing is modelled as reduced net drain rather than as a minion ability, because the progression rate is already an abstraction of group DPS. The Beehemoths' own self-healing of 7,500 HP up to three times has no referent, since they are not damageable; record it as omitted.

Author the three Beehemoths as a phase `spawns` entry with `startPhaseIndex: 0` and `despawnOnExit: true`. The source has them persist into phase 8, and step 23.10 re-spawns them there at `startPhaseIndex: 1` to switch their behaviour; record that despawn-and-respawn at the phase boundary is an **approved simplification** of "they persist", chosen over cross-enemy phase coupling, and that it is behaviourally equivalent apart from a visible blink at the boundary. Their placement differs per colour in the source - circling the room's edge for yellow, orbiting her closely for red, following loosely for blue - so author a static placement and movement per sub-phase rather than building minion movement scripting.

Record as fidelity gaps: the Queen's and Beehemoths' Armored windows are **not** modelled, because Armored only changes how fast a real group kills her and the authored progression rate already abstracts that entirely; the source's group-size healing tiers above 5 players have no single-player meaning (D06); the Plagued Nest's green sub-phase and fourth Beehemoth are excluded (K07).

**Focused checks:** focused failing test on the 15-degree-advancing bomb ring first. Then: the advance accumulates exactly 15 degrees per burst and not per shot; the two yellow spirals rotate in opposite directions; each new projectile matches its cited row, including `white-bomb-v2`'s 3-tile radius; the phase 7 progression override makes the net drain exactly the encounter rate minus 180 HP per second, asserted against a measured phase duration; the three Beehemoths spawn at phase index 0, fire their aimed stinger pairs, and their six new projectiles match the transcribed rows rather than the Queen's; a yellow glaive hit paralyses for 0.8 seconds; the broken-open Nests from phase 6 are still firing their corpse attack; a scripted dodge run survives all three sub-phases. All four routine gates.

**Acceptance:** phase 7's three sub-phases are authored with the stated 15-degree advance marked as sourced, the Beehemoth healing is a cited progression override with no new machinery, the Beehemoths and Nests persist into phase 8, every omission is recorded, and all four gates pass.

### Step 23.10 - Author Phase 8 And Complete The Fight

Status: pending. Dependencies: 23.9.

**Implementation prompt**

Author the final phase and make a full fight completable end to end.

Source: *"the Queen returns to the center of the room and begins to fire slow, radial bursts of Large Red Stingers, Small Yellow Stingers, Blue Balls, Hive Range Shots, and all her Glaives. The Adolescent Beehemoths orbit her closely, firing radial stingers and spreads of Glaives at players, and they will cease healing the boss if her HP decreases further. This phase lasts until her death."*

Author the one new projectile, row 22 `yellow-stinger-small-v2`, and reuse `red-stinger-large-v2`, `blue-ball-v2`, `hive-range-shot-v1`, `yellow-glaive-v1`, `red-glaive-v2` and `blue-glaive-v1` - "all her Glaives" is those three.

Author one `ring` attack per listed projectile, all with no rotation and a long cooldown, which is the source's "slow, radial bursts". The phase's movement is `move-to-point` at the arena centre.

Re-spawn the three Beehemoths here with `startPhaseIndex: 1`, which selects the final-phase behaviour transcribed in 23.9 - *"radial bursts of large stingers and spreads of Glaives"* - and `despawnOnExit: false`, since this phase ends only at the Queen's death. Their orbit placement is the source's "orbit her closely". No new Beehemoth projectile is needed; both phases fire the same two per colour in different patterns. It authors no `exitAfterSeconds`: it ends when the drain reaches zero health, which step 22.2's `"cleared"` phase and step 23.1's win screen already handle.

The source says the Beehemoths "cease healing the boss if her HP decreases further", so phase 8 authors **no** progression override - it uses the encounter's full rate, unlike phase 7. State that this is the implementation of the quoted line.

Then verify the whole encounter as one piece, which is this step's real deliverable:

- A full run from phase 1 to `"cleared"` passes through all eight phases in order, with the three sub-phase rotations cycling, every minion spawning and despawning as authored, and the Nests and Beehemoths persisting as they should.
- The total elapsed time is within a few seconds of the plan's Worked Progression Timeline plus the authored telegraph and invulnerability windows. Report the measured total.
- A stationary player dies, and roughly where. Report the phase.
- Report the peak live shard count and the peak live enemy count, which step 24.1 needs as its starting measurement.

Record the final fidelity summary for the encounter in the execution record: every gap from 23.3 through 23.10 collected in one list, each naming its K or D id. That list is what step 24.4 publishes.

**Focused checks:** focused failing test on phase 8's radial bursts first. Then: the new projectile matches row 22; all seven attacks fire; phase 8 uses the full encounter drain rate with no override, asserted against phase 7's reduced rate; the Beehemoths are present at phase index 1, firing radial bursts and glaive spreads rather than aimed pairs, orbiting the Queen closely; the corpse Nests are still firing; a full seeded run reaches `"cleared"` and the measured phase entry times match the derived timeline; a stationary run dies and the death phase is reported; the peak shard and enemy counts are measured and reported. All four routine gates, plus `npm run test:e2e -- --grep "full fight"` for a browser run that reaches at least phase 3.

**Acceptance:** phase 8 is authored, a full seeded run clears the encounter through all eight phases with timings matching the derived table, the measured peaks are reported for step 24.1, the complete fidelity summary is recorded, and all four gates pass.

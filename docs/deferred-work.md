# Deferred Work Register

Work that is **recognised, deliberately not being done now, and expected later**. This file exists so that a known gap is never mistaken for an oversight, and so that no implementation step quietly invents a mechanic that was consciously postponed.

Rules for this register:

- A deferred item is not approved work. It gains scope, rules and tuning only when it is promoted into [the active implementation plan](../implementation-plan.md) by an explicit user decision.
- Every item records **why** it is deferred and **what it is blocked on**, so promotion is a decision about prerequisites rather than a rediscovery.
- An item that leaves a visible gap between this trainer and the real game records that gap, so the fidelity limitation is documented rather than implied.
- When an item ships, move it out of this file into the plan's execution record. Do not leave a shipped item here marked done.

## Deferred - Intended Later

### D01 - Killer Honey Flooding And Hardening Tiles

**What.** The Killer Bee Queen's arena mutates mid-fight. At 90% HP (phase 2) the outer floor floods with Killer Honey, limiting the usable ground to a small ring around the Queen. At 45% HP (phase 5) the entrance tiles harden into walls that shots still travel over, and standing on a changing tile disconnects the player. Hardened honey also lowers move speed.

**Why deferred.** Deferred by explicit user decision on 2026-10-27. It is an arena-geometry feature, not an enemy feature, and the whole enemy can be authored and practised without it. The project instructions currently forbid shrinking arenas, so promoting this requires editing both mirrored instruction files.

**Blocked on.** A decision on how a mutating arena interacts with `constrainBodyToArena`, which today takes one immutable `CircularArena`. The likely shape is a time-varying inner/outer annulus plus an optional movement-speed multiplier per region, which is cheap on top of the existing containment geometry.

**Fidelity gap this leaves.** Material. The flooded ring is a large part of why phase 2 is hard: in the real fight the player loses most of the arena and must dodge a fast-chasing boss in a narrow band. Practising phases 2 and 5 on the full 19.2-tile arena is easier than the real encounter, and the trainer must not claim otherwise.

**Update (plan V10, phases 37-39).** The Nest boss room is no longer the Crystal Worm's 19.2-tile circle: it is its own octagon arena with Killer Honey authored as a *static* hazard - a centre pond and an outer-ring annulus, both present in every phase including phase 1. This is a deliberate partial pre-emption of this item (W32), not a resolution of it: the static rim and pond are a fixed approximation of where the real fight's flooding eventually settles, authored because the trainer needed some Killer Honey underfoot to test speed and damage against, not because the mutation question below was answered. D01's remaining scope is unchanged and still fully open: the progressive flood triggering at 90% HP, the hardening-tile transition at 45% HP, the disconnect-on-a-changing-tile rule, and a time-varying arena shape in general. The "blocked on" `constrainBodyToArena` question is now partly answered in passing - the arena model already dispatches on a shape union (circle/octagon) and already carries hazard regions as data separate from the containment shapes - but nothing about *time-varying* shapes or hazards exists yet.

### D02 - Plagued Nest Variant

**What.** The harder Plagued Nest version of the same boss: green enemy variants, green projectiles inflicting Sick and Unstable, a modified attack in most phases, a 3-way shot-machinegun instead of 2-way in phase 6, and a fourth Nest and Adolescent Green Beehemoth.

**Why deferred.** Deferred by explicit user decision at the start of this work. The user's stated intent is to implement it in future.

**Blocked on.** Nothing structural. Once the projectile catalog, pattern vocabulary and phase machine exist, this is additive authored data: the 20 `Plagued Nest only` projectile rows already transcribed in [the source extract](killer-bee-queen-source.md), one extra colour sub-phase in the affected phases, and one extra Nest. It is deliberately *not* authored early, because a projectile entry with no firing attack is speculative data.

**Fidelity gap this leaves.** None for The Nest. The trainer simply covers one of the boss's two locations.

### D03 - Killer Bee Nest Destruction And Beehemoth Colour Control

**What.** In phase 6 the three Nests become vulnerable and can be destroyed, which changes which Adolescent Beehemoths spawn: destroying one Nest makes another spawn two of its colour, destroying two ends the phase early and makes the last spawn three of its colour. Choosing which Beehemoths to face is a real skill in the live fight.

**Why deferred.** Requires the player to deal damage, which this project does not have (see D04).

**Blocked on.** D04.

**Fidelity gap this leaves.** Phase 6 always runs its full 29 seconds and always yields the default one-of-each Beehemoth outcome. Phase 7's three colour sub-phases therefore always appear, which is the hardest version and acceptable for training.

### D04 - Player Attacks

**What.** A player weapon, projectiles, damage, fire rate, and the ability slot.

**Why deferred.** Excluded from the vertical slice since the original draft: "The character won't attack in this first version." The training goal is dodging, and every phase of this boss can be practised without attacking.

**Blocked on.** An explicit decision to widen the project's goal. This is the single largest scope change available and would pull in weapon and ability tuning, DPS modelling and a much larger stat surface.

**Fidelity gap this leaves.** Large but intentional, and it is the reason several other items here are deferred. Consequences already recorded in the plan: the Queen's HP is depleted by an authored simulated-DPS rate rather than by the player; her Stun and Daze vulnerability windows (D05) have no effect; and the six status effects that only touch attacking are authored but inert.

### D05 - Stun And Daze Vulnerability Windows

**What.** The Queen is not normally immune to Stun or Daze but gains conditional immunity during most attacks. Phases 1, 3 (while flashing white) and 8 leave her vulnerable, and stunning her there skips attacks outright. The source calls phase 8 "exceptionally easy" for this reason.

**Why deferred.** Requires player abilities, which requires D04.

**Blocked on.** D04.

**Fidelity gap this leaves.** The trainer's phases 1, 3 and 8 are harder than a real group's, because a real group suppresses those attacks. For a dodge trainer this is the right direction to err in, but it should be stated.

### D06 - Boss Adaptive HP Scaling

**What.** The real Queen's 112,500 base HP scales with the number of players in the dungeon.

**Why deferred.** Meaningless for a single-player trainer, and the simulated-DPS progression rule makes the absolute HP figure a tuning input rather than a fidelity-critical number.

**Blocked on.** Nothing; it is unlikely ever to be promoted. Recorded so the authored `112500` is not mistaken for a complete model.

**Fidelity gap this leaves.** None that affects dodging.

### D07 - Arena Hazards From The Original Draft

**What.** The original draft's idea: "Later, it would be interesting to have a mechanic that the arena shrinks, or the floor turns to be lava or something like it."

**Why deferred.** Never scoped into any phase. It overlaps D01, which is the fidelity-driven version of the same capability, so D01 should land first and this should be reconsidered afterwards rather than designed separately.

**Blocked on.** D01.

### D08 - Seeded Replay In Attempt History

**What.** Recording the simulation seed in `AttemptRecord` so an attempt can be replayed exactly.

**Why deferred.** Decision G13 in [the v4 archive](implementation-plan-v4.md) deliberately left the seed out of the record: attempts stay non-reproducible across runs and no storage schema change was needed. The `?seed=` URL parameter already covers deliberate reproduction during development.

**Blocked on.** A real demand for replay. Promoting it is a storage schema change and needs a migration decision.

### D09 - Outstanding Principles Review Findings

**What.** From [the principles review](../principles-review.md), recorded unfixed at the end of phase 18: **F4** the `EncounterScene` responsibility split; **F5** the simulation's remaining global `ENCOUNTER_CONFIG` reads in `advanceSimulation` and `constrainToArena`; **F6** test-only `inspect()` instrumentation and `HitAudio` counters shipping in the production bundle; **F8** the palette duplicated between CSS strings and Phaser numbers plus the unused `index.css` token system; **F9** the duplicated storage load/degrade protocol.

**Why deferred.** Each was measured and judged not worth its churn at the time.

**F5 fixed.** Step 23.1 moved the per-encounter arena/step reads onto `state.config` when it introduced encounter selection, so `advanceSimulation` and `constrainToArena` no longer read the module-level `ENCOUNTER_CONFIG`. The remaining findings below are still open.

**Blocked on.** Nothing for F4, F6, F8 and F9; each remains deferred on the same basis as before.

### D11 - Bearing-Aware Dodge Verification For Phases 2, 7 And 8

**What.** A scripted-movement test proving the Killer Bee Queen's phases 2, 7 and 8 are survivable with correct dodging, not just damaging when stationary.

**Why deferred.** Step 24.2 tried several scripted dodges for these phases and every one died to a stacked volley within 6-16 seconds. Writing a dodge script good enough to prove survivability needs bearing-aware movement logic (steering away from the densest incoming volley), which was out of that step's budget.

**Blocked on.** A bearing-aware scripted-dodge helper for the acceptance suite. Until one exists, these three phases are proven dangerous but not proven fair.

**Fidelity gap this leaves.** None to the shipped rules; this is a verification gap. The authored attacks themselves are unchanged from their sourced/trainer-authored cadences.

### D12 - Full Browser Win-Screen Coverage For The Killer Bee Queen

**What.** A Playwright case that drives a real browser through a full Killer Bee Queen fight to the win screen.

**Why deferred.** Step 24.3 found that a full Queen fight takes about six minutes of real browser time, and no existing test runs that long. The headless-simulation clear (`src/game/config/config.test.ts`, "the Killer Bee Queen's full fight clears through all eight phases") proves the cleared path exists; only the real-browser rendering/session path to the win screen is unverified.

**Blocked on.** A decision to accept a multi-minute Playwright case, or a faster way to drive a full clear (for example a debug-only HP-drain multiplier) that does not change shipped tuning.

**Fidelity gap this leaves.** None to the trainer's rules; this is a test-coverage gap. The Crystal Worm encounter's own browser win-screen path is already proven.

### D10 - Playwright Coverage For The Condition Chip Display

**What.** A browser-path (Playwright) check that step 21.4's Phaser condition chips actually render for a live, running encounter.

**Why deferred.** `tests/app.spec.ts` has no existing seam to set `conditionSeconds` on the player of a running encounter: no shipped projectile or debug control applies a condition yet (that lands with later steps and the 23.x boss authoring). Adding one now would mean inventing a debug-only injection backdoor outside step 21.4's scope. The feature is covered by focused Vitest checks on the pure `visibleConditions` function and the Controls dialog instead; only the end-to-end browser render is unverified.

**Blocked on.** A shipped projectile, enemy contact or debug control that applies a condition to the player in a running encounter, giving the e2e test a real seam instead of a purpose-built one.

**Fidelity gap this leaves.** None to the trainer's rules; this is a test-coverage gap, not a behavior gap. The chip-drawing code path is otherwise exercised by its focused unit tests.

### D13 - Killer Bee Queen Cadence Retuning After Projectile Hitbox Correction

**Status (2026-11-03): resolved for phase 3, open for the other seven phases.** Plan V9 retuned `phase-3-pond-barrage`'s seven attacks from the tagged recording committed by V8, citing [the observations](killer-bee-queen-observations.md) as the source and advancing the Queen's `rulesVersion` to `killer-bee-queen-nest-paladin-v8`; the decision and values are recorded in [the mechanics contract](mechanics.md#the-phase-3-retune-plan-v9) and [plan V9](plan-v9.md). The rest of this entry describes the scope that remains.

**What.** Re-tune the Killer Bee Queen's authored attack cadences after the sprite-derived projectile hitboxes change.

**Why deferred.** Plan V6's P13 keeps every V5 cadence and deliberately excludes retuning. Step 26.3 captures a pre-change baseline and step 28.2 measures the shift, but correcting it is a separate tuning decision.

**Blocked on.** A measurement for each remaining phase. V8 measured phase 3 only (D22); the other seven phases have no tagged run, so retuning them would again be an estimate rather than evidence.

**Fidelity gap this leaves.** Phases 1, 2 and 4-8 may be easier or harder than the real encounter. Phase 3 now follows the measured barrage.

### D14 - Crystal Worm Shard Hitbox And Appearance Correction

**What.** Apply the same sprite-derived appearance and compound hitbox to the Crystal Worm child shard, which still uses the gold shard drawing and its 1.45 x 0.65 tile body.

**Why deferred.** Plan V6's P11 preserves V5's protected Crystal Worm behaviour. Changing it requires fetching its own wiki sprite and re-opening a V5-protected value.

**Blocked on.** A decision to re-open the Crystal Worm preset and transcribe its wiki sprite.

**Fidelity gap this leaves.** The Crystal Worm shard's visual and hitbox remain trainer approximations while the Killer Bee Queen's are sprite-derived.

### D15 - Licensing Review For Recreated Projectile Pixel Art

**What.** A licensing review of the recreated ROTMG projectile pixel grids and palettes, and a decision on distribution or replacement art.

**Why deferred.** The user approved exact code-generated recreation for this non-commercial trainer and said copyright can be addressed later. No third-party image file is shipped.

**Blocked on.** A distribution or permission decision, or a decision to replace the recreated grids with clearly original art.

**Fidelity gap this leaves.** None to gameplay. This is a distribution-risk item, not a rules gap; [the appearance source record](projectile-appearance-source.md) keeps the provenance.

### D16 - Sub-Phase Drill Selection

**What.** Select and loop individual colour sub-phases, for example the Queen's Phase 2 Red alone, instead of a whole top-level phase.

**Why deferred.** Plan V7's R06 selects top-level phases only. Individual sub-phases need a drill key containing both phase and sub-phase, extra selector rows and entry logic beyond `enterDrillPhase`.

**Blocked on.** A decision to extend the drill model and selector UI to sub-phases.

**Fidelity gap this leaves.** Players cannot isolate one colour sub-phase; selecting Phase 2 always cycles all three.

### D17 - Persist Phase-Selector State Across Reloads

**What.** Store the phase selector's open state, selected phases and Loop toggle in localStorage so a drill survives a reload or a Home return.

**Why deferred.** Plan V7's R10 keeps selector state session-only; returning Home or reloading resets to Full fight. A `?phase=` URL remains the explicit reload path.

**Blocked on.** A storage schema and migration decision, plus a decision to keep drill state across sessions.

**Fidelity gap this leaves.** None to gameplay. This is a training-continuity and convenience gap.

### D18 - Phase Selector On The Results Screen

**What.** Keep the phase selector available after death or clear, so a new drill can be applied directly from the results screen.

**Why deferred.** Plan V7 hides the panel once an attempt ends. Retry keeps the selection, but changing it requires Retry and then reopening the panel.

**Blocked on.** A decision to layer a persistent panel beside the results dialog and define its focus and pause semantics.

**Fidelity gap this leaves.** None to gameplay. This is a UX convenience gap.

### D19 - Despawn Tagging And Projectile Variant Disambiguation

**What.** Extend the video tagger to record a projectile's despawn frame as well as its spawn, so measured lifetime can identify which variant of a shared sprite was fired.

**Why deferred.** Plan V8's T26 records spawn tags only. Cadence, which is V8's goal, does not need lifetime, and spawn-only tagging is substantially less work per tag.

**Blocked on.** A decision that variant-level binding is worth a second tagging pass over the same footage.

**Fidelity gap this leaves.** Six sprites cover more than one projectile variant and stay bound only at sprite level: `red-stinger-large` (3 variants), `blue-ball` (3), `yellow-stinger-small`, `blue-stinger-small`, `red-glaive` and `yellow-ball` (2 each). Their variants differ sharply in speed and lifetime - `red-stinger-large` spans 1.3 s, 2.2 s and 3.0 s - so the choice among them remains an authored interpretation rather than an observation.

### D20 - Pattern Geometry Measurement

**What.** Measure arm counts, cone widths and rotation rates from video, rather than inferring them from the wiki prose.

**Why deferred.** Plan V8's T27 keeps geometry out of the tagger. An angle-measurement overlay needs its own pixel-per-tile calibration and camera-motion compensation, which is a materially different tool from timestamp tagging.

**Blocked on.** A decision to build an overlay with scale calibration, and a judgement that the authored geometry is actually wrong.

**Fidelity gap this leaves.** `coneDegrees`, ring arm counts and `clockwiseDegreesPerSecond` remain authored interpretations. V8 records an observed arm count per rotating-attack tag, which partially covers arm counts but not angles or rotation rates.

### D21 - Adopt The Current Client-XML Projectile Data

**What.** Reconcile the committed projectile data against the current game client XML (`HiddenElementGames/RotmgVersionRepo`, `TextAsset/epicHiveObjects`, commit dated 2025-09-30, Queen object id `EH King Bee`), and adopt the fields it carries that the wiki does not publish: the per-projectile `Size` scale multiplier and the projectile index per row.

**Why deferred.** Plan V8's T09 keeps it out of scope as unrelated to video tagging. Datamined client assets are also a different provenance class from the RealmEye wiki, which needs its own decision alongside the licensing review deferred as D15.

**Blocked on.** A re-check of the RealmEye page for the damage conflict below, and a decision that datamined client XML is acceptable provenance with a `tuningSource` of its own.

**Fidelity gap this leaves.** One known defect stands in committed data: `bee-shot` is authored at 130 damage in `app/src/game/data/projectiles.json`, matching the transcribed wiki table, while the current client XML reports 80. The `Size` field is also the sourced projectile scale that the V6 sprite-derived hitboxes approximated from silhouettes, so D13 and D14 may both be resting on an avoidable approximation.

### D22 - Measure Cadences For The Remaining Seven Phases

**What.** Extend the video-tagging measurement from phase 3 to the Killer Bee Queen's other seven phases, producing measured intervals and phase-to-projectile bindings for the rest of the fight.

**Why deferred.** Plan V8's T10 reduces the first measurement to a phase-3 pilot. Phase 3 carries a wiki-verifiable anchor, exercises both tag kinds and has no sub-phases, so it tests the whole method and the write-up format at roughly an eighth of the cost. Committing to a fight-wide run before knowing whether the output is decision-useful would have been the larger bet.

**Blocked on.** The pilot's own "Was This Worth Repeating" verdict in `docs/killer-bee-queen-observations.md`, plus two capabilities the pilot deliberately does without: sub-phase attribution, which phases 1, 2, 5 and 7 need and T25 cut as unexercised, and a phase-identification aid, since across eight visually similar HP-gated phases a mis-set sticky phase would silently mislabel a whole run. Import and resume, cut by T30, would also return for a multi-session run.

**Fidelity gap this leaves.** Seven of eight phases stay unmeasured, so the large majority of the 58 `trainer-authored` attack cadences remain invented values with no external source. The phase-to-projectile bindings the wiki cannot supply stay interpretations outside phase 3.

### D23 - Per-Variant Hive Projectile Sizes

**What.** Separate authored sizes for the three hive projectile families - `hive-spiral-shot`, `hive-range-shot` and `hive-shot` - instead of the single scale plan V10 gives all three.

**Why deferred.** Deferred by explicit user decision on 2026-11-04, recorded as part of [plan V10](plan-v10.md)'s W18. V10's measurement corrected the hive grids from an apparent 49 x 28 at 1x to a 4x render of roughly 12.25 x 7, which brought every hive shot from a predicted 5.44 tiles down into the 1.07-1.44 tiles the screenshots show. Within that range the measurements fall into two clusters, about 1.9 x 1.3 tiles and about 2.9 x 2.2 tiles, and the user's own impression is that the size differs by phase. No screenshot supplied labels which cluster belongs to which variant, and the hive families fire in phases 5, 7 and 8 rather than the phase 3 that is best documented, so splitting them now would mean assigning two measured numbers to three families by guesswork.

**Blocked on.** One labelled screenshot per hive variant - a red Hive Spiral Shot, a blue Hive Range Shot and a yellow Hive Shot, each identifiable and not overlapping another shot - measured against the same 51.5 px tile. The data shape needs nothing new: each appearance can already carry its own `sourceUpscale`, so this is a data change once the evidence exists.

**Fidelity gap this leaves.** All three hive families render and collide at 1.361 x 0.778 tiles. If the two measured clusters really are two different in-game sizes, one or two of the three families is wrong by up to about 1.5x in each axis, and because V10's W19 keeps hitboxes sprite-derived, the error is in the hitbox as well as the art. It affects phases 5, 7 and 8 only.

### D24 - Player Character Sprite Appearance

**What.** Render the Paladin's 8 x 8 pixel character as the player's sprite, code-generated from the RealmEye Paladin class image, instead of the white body marker.

**Why deferred.** Declined by explicit user decision on 2026-11-05 (plan V11, X03). The request was the player body's footprint and hitbox, not its art, and project decision Q03 chose original simple art or code-generated shapes over copied sprites. No third-party image is shipped.

**Blocked on.** A decision to reopen Q03 and extend the D15 licensing review to a recreated player sprite, plus an appearance path for the player: the existing appearance catalog and pixel renderer are projectile-only.

**Fidelity gap this leaves.** The player reads as a white body marker rather than the Paladin sprite, so class identity, facing and animation are absent. The hitbox still matches the sprite-derived body, so the gap is visual only and the trainer does not misstate the player's size.

### D25 - Re-Tag And Retune The Killer Bee Queen's Phase-3 Bee Shot

**What.** Re-tag phase 3's `bee-shot` with the burst-capable tagger from plan V13, then decide whether `bee-shot-burst-occasional` should change its `shotsPerBurst`, `shotIntervalSeconds`, cooldown or `clockwiseDegreesPerSecond`, with a new rules version if it does.

**Why deferred.** Plan V13's Z34 keeps that plan to tooling. A retune should rest on the new evidence, which cannot exist until the tool ships, and gameplay changes should not be mixed with tooling.

**Blocked on.** Completion of plan V13's phase 43, the user's re-tagging run, and an explicit retuning decision in its own plan.

**Fidelity gap this leaves.** The encounter authors `bee-shot` as one 4-arm volley with `clockwiseDegreesPerSecond: 0` every 3.04 s, while the user reads the footage as a burst fired by rotating arms. Until this is resolved, the attack's rate and motion may differ from the real fight. Tag spacing of one video frame also means a new tagging run may not fully separate distinct volleys from one event stepped across frames.

### D26 - Tag Preview Without A Video

**What.** Let the tagger's preview play a study on its own clock (play, pause, restart) when no video is open, for example a study loaded or restored without its footage.

**Why deferred.** Plan V14's M01 chose the video's `mediaTime` as the preview's only clock, because it gives play, pause, stepping and seeking with no extra transport and keeps the preview frame-aligned with the footage. A second clock would add its own controls and break that alignment, and M15 leaves the canvas black without a video.

**Blocked on.** Completion of plan V14's phases 46-47 and an explicit user decision to add a video-free clock.

**Fidelity gap this leaves.** None for gameplay. It is a capability gap: a study opened without its video (Z14) cannot be previewed until the video is chosen.

## Out Of Scope - Not Planned

These are standing non-goals from the original draft and the confirmed design. They are listed so a step never proposes them as an improvement.

- A backend, accounts, online leaderboards, or any server component.
- Touch controls and key rebinding.
- A player-facing tuning UI beyond the existing developer debug panel.
- Seal activation and the wider ROTMG ability system.
- Multiplayer mechanics that have no single-player meaning: teleporting all players to the boss room, group-size-scaled Beehemoth healing above 5 players, and other crowd-dependent behaviour.
- Redistributing third-party artwork files. Reference screenshots stay local review material; the original ROTMG PNGs are not committed or shipped. Code-generated pixel-grid recreations derived from the wiki sprites are approved for this non-commercial trainer by P01 and P02 in [plan V6](implementation-plan-v6.md), with licensing review deferred as D15.

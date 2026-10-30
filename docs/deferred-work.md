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

**What.** Re-tune the Killer Bee Queen's authored attack cadences after the sprite-derived projectile hitboxes change.

**Why deferred.** Plan V6's P13 keeps every V5 cadence and deliberately excludes retuning. Step 26.3 captures a pre-change baseline and step 28.2 measures the shift, but correcting it is a separate tuning decision.

**Blocked on.** The measured difficulty shift from step 28.2, and a decision that the shift needs correction. Comparison with real-game footage would strengthen that decision.

**Fidelity gap this leaves.** The trainer may be easier or harder than the real encounter. The cadences were tuned against the old 0.5 x 0.25 to 0.9 x 0.4 tile bodies, while the new hitboxes follow the wiki sprite silhouettes.

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

## Out Of Scope - Not Planned

These are standing non-goals from the original draft and the confirmed design. They are listed so a step never proposes them as an improvement.

- A backend, accounts, online leaderboards, or any server component.
- Touch controls and key rebinding.
- A player-facing tuning UI beyond the existing developer debug panel.
- Seal activation and the wider ROTMG ability system.
- Multiplayer mechanics that have no single-player meaning: teleporting all players to the boss room, group-size-scaled Beehemoth healing above 5 players, and other crowd-dependent behaviour.
- Redistributing third-party artwork files. Reference screenshots stay local review material; the original ROTMG PNGs are not committed or shipped. Code-generated pixel-grid recreations derived from the wiki sprites are approved for this non-commercial trainer by P01 and P02 in [plan V6](implementation-plan-v6.md), with licensing review deferred as D15.

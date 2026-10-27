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

**Blocked on.** Nothing - but note that **F5 stops being latent the moment a second encounter exists.** `constrainToArena` and `advanceSimulation` read the module-level `ENCOUNTER_CONFIG` rather than `state.config`, which is harmless while every simulation shares one arena and one fixed step, and wrong as soon as two encounters differ in either. The active plan fixes F5 inside the step that introduces encounter selection rather than leaving it here.

## Out Of Scope - Not Planned

These are standing non-goals from the original draft and the confirmed design. They are listed so a step never proposes them as an improvement.

- A backend, accounts, online leaderboards, or any server component.
- Touch controls and key rebinding.
- A player-facing tuning UI beyond the existing developer debug panel.
- Seal activation and the wider ROTMG ability system.
- Multiplayer mechanics that have no single-player meaning: teleporting all players to the boss room, group-size-scaled Beehemoth healing above 5 players, and other crowd-dependent behaviour.
- Redistributing third-party artwork. Reference screenshots stay local review material; shipped sprites remain original placeholder geometry.

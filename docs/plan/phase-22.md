# Phase 22: Enemy Health, Phases And Movement Behaviours

> Step prompts and execution records for phase 22 of [the implementation plan](../../implementation-plan.md), whose general sections stay the authority for how to work. Read only this introduction and the requested step: grep `^### Step 22.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-22.md` and replace the plan's step lines with one-sentence outcomes.

### Step 22.1 - Introduce The Movement Behaviour Vocabulary

Status: pending. Dependencies: 21.5.

**Implementation prompt**

Behaviour-identical refactor. The Queen moves differently in every phase, so movement becomes an authored behaviour rather than a bare speed. No shipped gameplay value may change.

Replace the archetype's `speedTilesPerSecond` with a `movement` discriminated union, authored in `enemies.json`. The Crystal Worm becomes `{ "kind": "chase", "speedTilesPerSecond": 1.5 }`, which must behave exactly as today. Implement all five kinds now, because step 23 authors phases that use each of them:

- `chase` with `speedTilesPerSecond`: the existing `pursueBody` call, body-aware, stopping at silhouette contact distance. Unchanged.
- `stationary`: no movement at all.
- `move-to-point` with `target` of `"arena-center"` and `speedTilesPerSecond`: move toward a point, stopping on arrival. This is **point-based, not body-aware** - it is the behaviour the `chaseArenaCenter` debug toggle already implements inline in `updateMovement`, and that inline block must be deleted in favour of this kind. Preserve its exact semantics, including that a zero remaining distance produces zero travel.
- `orbit` with `radiusTiles`, `degreesPerSecond`, `direction` of `"cw"` or `"ccw"`, and `approachSpeedTilesPerSecond`: while the enemy is not yet on the ring around the arena centre, move toward its nearest ring point at the approach speed; once on it, hold the ring and advance `movementPhaseRadians` at the authored rate, positioning the enemy in closed form from that phase. Derive the resulting tangential speed as `radiusTiles * degreesPerSecond` in radians and **validate it is strictly below the Paladin's 7.0613 tiles per second**, so an orbiting boss can never outrun the player.
- `wander` with `speedTilesPerSecond`, `retargetSeconds` and `radiusTiles`: move toward a target point drawn from the injected seeded generator within `radiusTiles` of the arena centre, redrawing every `retargetSeconds` and on arrival.

Add `movementPhaseRadians` to `EnemyState` for the orbit phase, and whatever minimal state `wander` needs for its current target and next retarget time. Keep every field plain data so `SimulationState` stays `structuredClone`-able.

**The randomness draw order, which this step fixes and tests.** `wander` draws inside the simulation, so the full per-tick order is now: player movement, then enemy movement in enemy insertion order, then shard advance and hit resolution, then timed spawns, then attacks in enemy order and then authored attack order. Every generator draw happens in exactly that order. This extends step 20.4's spawns-before-attacks rule rather than replacing it; state the full order in a comment beside the step function and assert it with a test that mixes a wandering enemy, a timed spawn and a scatter attack in one tick.

Replace the `chaseArenaCenter` debug toggle's inline implementation with a movement-spec override: the toggle swaps the active movement for `move-to-point` at the arena centre. The toggle's observable behaviour must not change. Extend `validateEncounterConfig` to validate each movement kind's own fields and to keep asserting that a `chase` speed is below the Paladin's, which `validateShippedEncounter` already requires.

**Focused checks:** focused failing test on the `movement` union shape first. Then: `chase` reproduces today's pursuit and stopping distance exactly; `stationary` never moves; `move-to-point` reaches the arena centre, stops there and matches the retired `chaseArenaCenter` path step for step; `orbit` approaches the ring then holds it, advances in the authored direction, and its derived tangential speed is validated against the Paladin's speed with a rejection case; `wander` retargets on schedule and on arrival, stays inside its radius, and is reproducible under a fixed seed; the full draw order holds in a tick that mixes wander, spawn and scatter; arena containment holds for every kind. Then prove behaviour identity: the 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must pass **unchanged**. All four routine gates, plus `npm run test:e2e -- --grep "chase"`.

**Acceptance:** all five movement kinds work, the `chaseArenaCenter` inline block is gone in favour of `move-to-point`, orbit speed is validated against the player's, the generator draw order is documented and tested, the Crystal Worm timeline is unchanged, and all four gates pass.

### Step 22.2 - Add Enemy Health And The Simulated Progression Driver

Status: pending. Dependencies: 22.1.

**Implementation prompt**

Give an enemy optional health and the authored drain rate that advances a boss through its phases. This implements K01's progression half and K08.

Add to the archetype an optional `health` block: `maxHealthHp` and `progression`, where `progression` is `{ "kind": "none" }` or `{ "kind": "simulated-dps", "hpPerSecond": N }`. The Crystal Worm authors **no** `health` block at all, so its `healthHp` and `maxHealthHp` stay `null`: do not invent a hit-point total for it, because none is sourced. An archetype with no `health` block must behave exactly as today.

Add `healthHp: number | null`, `maxHealthHp: number | null` and `invulnerableUntilSeconds: number` to `EnemyState`, set in `createEnemy` from the archetype. Add a `healthFraction(enemy)` helper returning `healthHp / maxHealthHp`, or exactly `1` when either is `null`, so the phase machine in 22.3 has one query that works for both kinds of archetype.

Apply the drain once per fixed step, in a named operation in `simulation/phases.ts`, after enemy movement and before attacks:

- `{ "kind": "none" }` drains nothing.
- `{ "kind": "simulated-dps", "hpPerSecond": N }` subtracts `N * stepSeconds`, clamped at zero.
- **K08: while `elapsedSeconds < enemy.invulnerableUntilSeconds`, drain nothing.** Invulnerability affects progression and nothing else - the player cannot deal damage, so there is nothing else for it to block. Say so in a comment, so a later reader does not look for a missing damage path.

When a drained enemy reaches zero health, set `state.phase` to a new `"cleared"` value and stop the simulation the way `"ended"` already stops it. `"ended"` keeps meaning the player died; `"cleared"` means the boss did. Return both from `advanceSimulation` the same way, and make every existing early-return path that checks `state.phase === "ended"` handle `"cleared"` too - search for every comparison rather than assuming there is one.

**Do not** surface `"cleared"` in the session layer, the results screen, the attempt record or the Home comparison in this step. Step 23.1 owns that, together with encounter selection and the storage implication, so the schema is touched once. Note in your execution record that a cleared run currently ends the simulation without a distinct player-visible result, and that this is deliberate and temporary.

Allow a **per-phase override** of the same `progression` shape, resolved as "the active phase's `progression` if it authored one, otherwise the archetype's". Step 23.9 needs it: the source's Beehemoths heal the Queen at a fixed single-player rate during phase 7, which under this model is simply a lower net drain for that phase. One resolution rule and no second mechanism; the phase field is validated by the same validator as the archetype field. Step 22.3 reads it once the phase machine exists - until then, resolve against the archetype only and leave the field validated but unused.

Add a debug toggle `pauseProgression` per K12, defaulting off, which suppresses the drain entirely so a phase can be inspected indefinitely. Add it to the existing `DEBUG_TOGGLES` registry rather than hand-coding a checkbox.

**Focused checks:** focused failing test that an archetype with no `health` block has `null` health and `healthFraction` of 1 first. Then: a `simulated-dps` enemy loses exactly `hpPerSecond * stepSeconds` each step; health clamps at zero and never goes negative; the drain is suppressed for the exact duration of an invulnerability window and resumes on the first step after it; reaching zero sets `"cleared"` and stops further advancement; `pauseProgression` suppresses the drain and the enemy's health is unchanged over many steps; the drain is identical at 30, 60 and 120 Hz for the same elapsed time; a per-phase `progression` override validates and is rejected when malformed, while the archetype rate is still used when a phase authors none; and every pre-existing assertion passes unchanged for the Crystal Worm, which has no health. All four routine gates.

**Acceptance:** enemies have optional health with an authored progression rate, invulnerability pauses the drain, a drained boss sets `"cleared"` and halts the simulation, `pauseProgression` works from the existing debug registry, the Crystal Worm is unaffected, and all four gates pass.

### Step 22.3 - Implement The Phase Machine

Status: pending. Dependencies: 22.2.

**Implementation prompt**

Behaviour-identical refactor, and the step the whole encounter is built on. An enemy's attacks and movement become properties of its current phase.

Move the archetype's `attacks` and `movement` into an ordered `phases` array, each phase shaped as the plan's Target Data Shapes section shows: `id`, `enterAtHpFraction`, `exitAfterSeconds`, `telegraphSeconds`, `invulnerableOnEnterSeconds`, `movement`, `progression`, `attacks`. Leave `subPhases` and `spawns` out entirely; step 22.4 adds them. Connect step 22.2's per-phase `progression` override here: the drain resolves the active phase's rate when it authored one and the archetype's otherwise. The Crystal Worm authors `null`, so nothing changes for it. The Crystal Worm becomes a single phase: `id` `"sole"`, `enterAtHpFraction` 1, `exitAfterSeconds` null, `telegraphSeconds` 0, `invulnerableOnEnterSeconds` 0, its `chase` movement and its one attack. Its observable behaviour must not change.

Own the transition rules in `simulation/phases.ts`:

- Phases are authored in strictly **descending** `enterAtHpFraction`, and the first must be exactly 1. The loader rejects any other ordering, a duplicate threshold, a fraction outside 0 to 1 exclusive of 0, and an empty array.
- Evaluate transitions once per fixed step, after the progression drain. Advance to the next phase when **either** `healthFraction(enemy) <= nextPhase.enterAtHpFraction` **or** the current phase authored an `exitAfterSeconds` and `elapsedSeconds - enemy.phaseEnteredAtSeconds >= it`. That is K09.
- Progression is **monotonic**: never return to an earlier phase, and never re-enter the current one. A single step may cross more than one threshold if the drain rate is high, so advance in a loop and apply each entry's effects, rather than advancing at most one phase per step.
- On entering a phase: set `phaseEnteredAtSeconds`, set `invulnerableUntilSeconds` to `elapsedSeconds + invulnerableOnEnterSeconds`, reset `movementPhaseRadians` and any wander state, and **rebuild `attackClocks`** from the new phase's attacks.
- **The telegraph is implemented by the clock anchor, not by a firing gate.** When rebuilding clocks on phase entry, anchor each clock's epoch at `phaseEnteredAtSeconds + telegraphSeconds`. Each attack's own `initialDelaySeconds` then adds on top of that. Do not add a separate "is telegraphing" branch in `updateAttackClock`; one anchor is enough and it cannot drift.

Read the active phase's `movement` in `updateMovement` and the active phase's `attacks` in `updateAttacks`. Add a `telegraph` colour flash to `phaser/encounter.ts` while a phase is telegraphing, using the existing presentation constants, because the source's phases are all introduced by the Queen flashing a colour and the player must be able to read it. Author the flash colour per phase in `enemies.json` as a named string resolved against the existing palette, not as a raw hex value in the data.

Extend `inspect()` and the Playwright `Inspection` type with the active phase id, index and entry time.

**Focused checks:** focused failing test that a three-phase test archetype enters phase 2 at its authored HP fraction first. Then: entry at exactly the threshold, not one step late; a single step crossing two thresholds lands in the correct later phase with both entries' effects applied; `exitAfterSeconds` exits on duration while health is untouched; progression never goes backward when health is restored artificially; clocks are rebuilt on entry so the new phase's attacks start from their own epoch; the telegraph delays the first shot by exactly `telegraphSeconds` plus the attack's own initial delay; the invulnerability window set on entry suppresses the drain for exactly its duration; a phase authoring a `progression` override drains at its own rate and the next phase reverts to the archetype's; the loader rejects an empty phase array, a first fraction other than 1, an ascending or duplicated threshold, and a fraction of 0 or above 1. Then prove behaviour identity: the 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must pass **unchanged**. All four routine gates, plus `npm run test:e2e -- --grep "phase"`.

**Acceptance:** phases own movement and attacks, transitions fire on an HP fraction or a duration, progression is monotonic and handles multi-threshold steps, the telegraph is implemented by the clock anchor and is visible, validation covers every malformed phase list, the Crystal Worm is a single phase with an unchanged timeline, and all four gates pass.

### Step 22.4 - Add Cycling Sub-Phases And Phase-Driven Spawns

Status: pending. Dependencies: 22.3.

**Implementation prompt**

Add the two remaining structures the Queen needs: the colour rotation inside phases 2, 5 and 7, and minions summoned by a phase. Additive; the Crystal Worm uses neither.

**Sub-phases.** Add an optional `subPhases` array to a phase, each entry carrying `id`, `durationSeconds`, `telegraphSeconds`, `invulnerableOnEnterSeconds`, an optional `movement` override and its own `attacks`. While a phase has sub-phases, exactly one is active: it advances when `elapsedSeconds - subPhaseEnteredAtSeconds >= durationSeconds`, cycling back to the first after the last. Use the **same mechanism** as the phase machine, not a parallel one: entry sets `subPhaseEnteredAtSeconds` and `invulnerableUntilSeconds`, and rebuilds `attackClocks` anchored at the entry time plus the sub-phase's telegraph. The active attack set is the phase's own attacks plus the current sub-phase's attacks, with the phase's attacks first so clock and shard ordering stays deterministic. A sub-phase `movement` override replaces the phase's for its duration; when absent the phase's movement continues. The source's "she is invulnerable in between attacks" is expressed as a nonzero `invulnerableOnEnterSeconds` on each sub-phase, which per K08 also pauses the drain - so a sub-phase cycle lengthens the fight, which is correct and intended.

Reuse `subPhaseIndex` and `subPhaseEnteredAtSeconds`, already on `EnemyState`. A phase with no sub-phases keeps `subPhaseIndex` at 0 and must behave exactly as step 22.3 left it.

**Phase-driven spawns.** Add an optional `spawns` array to a phase or sub-phase, each entry carrying `archetype`, `count`, `despawnOnExit` and a `placement` of `{ "kind": "ring-around-owner", "radiusTiles": N }` or `{ "kind": "arena-ring", "ringRadiusFraction": N }`. Resolve them **once on entry**, not per step. Spread the `count` positions evenly around the chosen ring, offsetting by the golden angle already authored in `encounter.json` so repeated entries do not stack minions on the same points, reusing the existing placement helper rather than writing a second one.

Add an optional `startPhaseIndex` to a spawn entry, defaulting to 0, which selects the phase the spawned minion begins in. K18 needs it: an Adolescent Beehemoth fires aimed stinger pairs normally and radial bursts during the Queen's final phase, so one archetype with two phases is spawned at index 0 by phase 7 and at index 1 by phase 8. Validate it against the spawned archetype's phase count. This is the same concept step 22.5 gives `createSimulation` for drill mode; share the entry routine rather than writing a second one.

Add `spawnedByEnemyId: number | null` to `EnemyState`. On leaving a phase or sub-phase, remove every enemy that it spawned with `despawnOnExit` set, which is how the source's Killer Bees "despawn when she switches attacks". Removing an enemy must **not** remove the shards it already fired: they expire on their own lifetimes, exactly as the once-fired rules require.

Guard the explosion risk explicitly. Add an authored `maxConcurrentMinions` to `encounter.json`, validate it, and have a phase spawn fewer than its `count` rather than exceed it - suppressed like the existing `maxConcurrent` cap, never queued for later. Reject a `count` above the cap at load time so an unreachable authored number is a loud failure, not a silent truncation.

**Focused checks:** focused failing test that a two-sub-phase test archetype alternates on its authored durations first. Then: a sub-phase cycle wraps after the last entry; the active attack set is phase attacks followed by sub-phase attacks in that order; a sub-phase movement override applies for its duration and the phase's movement resumes when it ends; each sub-phase entry sets its invulnerability window and therefore pauses the drain; a phase with no sub-phases behaves exactly as 22.3 left it; spawns resolve once on entry and not per step; placements are evenly spread and golden-angle offset; `despawnOnExit` minions are removed on exit while their shards survive to their own lifetimes; `maxConcurrentMinions` suppresses rather than queues; a `startPhaseIndex` of 1 starts the minion in its second phase with that phase's clocks, telegraph and invulnerability applied; the loader rejects a `count` above the cap, a nonpositive `durationSeconds`, an unknown spawn archetype and a `startPhaseIndex` beyond the spawned archetype's phase count. Then prove the Crystal Worm timeline is unchanged. All four routine gates.

**Acceptance:** sub-phases cycle through the same mechanism as phases, spawns resolve once on entry with reusable placement and an optional starting phase, despawn-on-exit removes minions but not their shards, the minion cap suppresses rather than queues, the Crystal Worm is unaffected, and all four gates pass.

### Step 22.5 - Add Drill Mode

Status: pending. Dependencies: 22.4.

**Implementation prompt**

Implement K01's second half: let the player practise a single phase instead of replaying the whole fight to reach it. This is the feature that makes a long boss usable as a trainer.

Add an options object to `createSimulation(config, seed, options)` carrying `startPhaseIndex` and `loopPhase`, both optional, following the existing injected-dependency style rather than adding a new module boundary. When `startPhaseIndex` is given, the primary enemy starts in that phase with its health set to that phase's `enterAtHpFraction` of `maxHealthHp`, its clocks anchored as if it had just entered, and its telegraph and invulnerability window applied normally. When `loopPhase` is set, reaching the phase's exit condition re-enters the **same** phase from the top instead of advancing - resetting health to the phase's entry fraction, rebuilding clocks, re-running the telegraph, and despawning and re-spawning its minions. This is the single, explicitly approved exception to K09's monotonic rule; gate it on `loopPhase` so the normal path cannot regress.

Surface it without building a new screen:

- A `?phase=<index>` URL parameter and a `?loop=1` flag, parsed alongside the existing `?seed=` parameter and validated against the archetype's phase count. An out-of-range value is ignored with the full fight starting normally, matching how `?seed=` already handles bad input.
- Phase and sub-phase jump controls in the existing debug panel, per K12: a phase selector, a "loop this phase" toggle and a "next sub-phase" action, all registered in the existing `DEBUG_PARAMETERS` and `DEBUG_TOGGLES` registries so the panel renders them without hand-coded blocks.

**A drill attempt must never pollute the full-fight records.** Give it its own rules version, derived from the encounter's by suffixing the phase - for example `killer-bee-queen-nest-paladin-v5-drill-p3` - reusing the existing mechanism that already keeps `DEBUG_RULES_VERSION` attempts out of the retained best. Do not add a new exclusion mechanism, and do not change the storage schema.

Do not add a phase-selection screen, a progress tracker, per-phase leaderboards or achievement state.

**Focused checks:** focused failing test that `createSimulation` with `startPhaseIndex: 2` starts in phase 3 at its entry health first. Then: the started phase's telegraph and invulnerability window apply; `loopPhase` re-enters the same phase on exit with health, clocks, telegraph and minions all reset; without `loopPhase` the same exit advances normally; an out-of-range `?phase=` is ignored and the full fight starts; a drill attempt's rules version carries the phase suffix and is excluded from the retained best by the existing comparison code; the debug phase jump moves the enemy into the chosen phase mid-run; and the storage schema is unchanged, proven by an existing record still loading. All four routine gates, plus `npm run test:e2e -- --grep "drill"` for the URL parameter path.

**Acceptance:** a run can start at and loop any phase through a URL parameter or the debug panel, drill attempts carry a distinct rules version and are excluded from bests through the existing mechanism, the monotonic rule is bypassed only under `loopPhase`, no new screen or schema change was added, and all four gates pass.

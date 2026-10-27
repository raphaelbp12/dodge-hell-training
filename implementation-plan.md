# Active Implementation Plan

## Purpose And Execution

Deliver a pure-frontend ROTMG-inspired training game: repeatedly survive a faithful recreation of a real ROTMG boss encounter, inspect results, and retry immediately.

This file holds the **pending** work only: phases 19-24, which generalize the single-weapon simulation into a projectile catalog, an emission-pattern vocabulary, a player condition model and a multi-phase boss machine, then author the **Killer Bee Queen** of The Nest on top of them.

This is a plan, not authorization to implement all phases at once. Each numbered step is an implementation prompt stored in its phase file under `docs/plan/`, linked from the Phase Index section below. Run one at a time with `/implement-step <step-id>`, for example `/implement-step 19.2`. Read the shared contract below, then execute only the requested prompt. Dependencies must be complete first.

**Execution modes.** Two modes are available and the user chooses per request:

- **Single step (default).** Run exactly one step, then stop and report. Do not commit, push, deploy or begin the next step. This is the mode whenever the user does not say otherwise.
- **Batch, on explicit request.** When the user explicitly asks for a batch - naming the steps or phases - run them in dependency order, each with its own focused checks, execution record and gate run before the next begins. A failed gate stops the batch and is reported; it is never recorded as complete. Still no commit, push or deployment without separate authorization. A batch request covers only the steps named in it and does not carry to later requests.

Steps start pending. After completing a step, replace its status with `complete` both in its phase file and on its line here, record the actual checks and outcomes below its prompt in the phase file, and note any approved deviations. Do not mark a step complete when its required checks are blocked. Do not automatically start the next step.

**Keep this file small.** Its general sections are read once per `/implement-step` session, so their size is a recurring cost. Step prompts never live here: each pending phase has its own `docs/plan/phase-<n>.md`, and this file keeps one line per step (id, title, status, dependencies). As soon as every step in a phase is complete, move that phase file to `docs/plan-archive/phase-<n>.md` (see [`docs/plan-archive/phase-19-20.md`](docs/plan-archive/phase-19-20.md) for the format) and give each step line here a one-sentence outcome. Do this in the same change that completes the phase's last step.

## Sources And Decision Authority

- [Original draft](first-draft.md): original requirements and project intent. Keep it intact.
- This plan: consolidates subsequent user decisions and the approved technical approach. Later explicit user decisions override older statements; record changes here.
- [The mechanics contract](docs/mechanics.md) records sources, approvals and fidelity limits. Do not treat user-supplied wiki numbers or proposed formulas as independently verified facts.
- [The Killer Bee Queen source extract](docs/killer-bee-queen-source.md) is the **transcribed, verified** wiki material for this encounter: stats, the full projectile table with derived lifetimes, the verbatim behaviour prose, and the status-effect magnitudes. Every authored gameplay number for this boss must trace to a line in that file. It also carries the eight transcribed minion extracts and records the `curl` access method, because `WebFetch` returns an empty document for RealmEye pages.
- [The deferred register](docs/deferred-work.md) lists work that is recognised, deliberately postponed and **not approved**. If a step seems to need something listed there, stop and report it rather than implementing it.
- [The v4 archive](docs/implementation-plan-v4.md) holds completed phases 15-18 and decisions G01-G22. Those decisions stand except where a K-numbered decision below supersedes them.
- [The principles review](principles-review.md) records measured YAGNI/DRY/SOLID findings. F4, F5, F6, F8 and F9 remain open; see D09 in the deferred register. F5 is fixed by step 23.1, because it stops being latent once a second encounter exists.
- Never silently resolve a gameplay ambiguity. Research it, explain alternatives, and ask the user for approval before dependent implementation.

## Completed Baseline

Phases 1-18 are complete. Their prompts, blockers, resolutions and acceptance evidence are archived, not deleted or reopened. The deployed runtime is the verified v4 release: a validated JSON data layer, a many-enemy simulation, and timed spawning of the `crystal-worm-child-head` archetype under the `crystal-worm-child-swarm-paladin-v4` identity.

| Archive | Phases | Contents |
| ------- | ------ | -------- |
| [V1 archive](docs/implementation-plan-v1.md) | 1-7 | Mechanics contract, generated foundation, testable simulation, playable engine, practice interface, delivery and handoff |
| [V2 archive](docs/implementation-plan-v2.md) | 8-14 | V2 contract and geometry, continuous collision, persisted zoom, hit feedback and audio, Controls and pause safety, verified release |
| [V4 archive](docs/implementation-plan-v4.md) | 15-18 | Retired geometry study, JSON data layer, many-enemy generalization, timed spawning, regression and handoff |

For step 19.1's dependency check, read step 18.2's archived final status and execution record in the v4 archive. Do not rerun completed steps automatically.

The v1/v2/v4 archives above are end-of-release snapshots, written once a whole numbered release shipped. `docs/plan-archive/` holds rolling, phase-by-phase archives of the still-in-progress v5 work (phases 19-24), written as each phase completes rather than held until 24.4's handoff - see the note under Purpose And Execution.

## Confirmed Design

The v4 confirmed design stands unchanged in all these respects: React, pure frontend, GitHub Pages on push to `main`; Home screen with Start, description, changelog and links; desktop keyboard play with WASD, R, O and P; endless survival until death; the one fixed average unpotted level-20 Paladin preset; circular arena with the player spawning at its centre; a player-centred camera with persisted zoom; original convex silhouettes of at most eight sides shared between drawing and collision; local attempt history and comparisons with no backend.

Phases 19-24 add exactly these elements, and nothing else:

- **A projectile catalog.** Projectiles are authored entries in a keyed catalog, each with its own damage, speed, range, body, applied conditions and **motion kind**. A projectile is no longer a property of one weapon.
- **Several motion kinds.** `linear`, `boomerang`, `turning`, `wavy` and `lob`. This supersedes the v2/v4 rule that a projectile always reverses once and expires only by lifetime; that rule survives as the `boomerang` kind.
- **An emission-pattern vocabulary.** `ring`, `spread` and `scatter`. The Crystal Worm's rotating emitters become a `ring`.
- **Concurrent attacks.** One enemy runs several attacks at once, each on its own clock.
- **Player conditions.** Paralyzed, Slowed, Confused, Armor Broken, Exposed, Curse and Sick affect the player. Conditions that only touch attacking are authored and inert.
- **Enemy health and a phase machine.** An enemy has optional health, an authored progression rate, and an ordered list of phases with HP-fraction or duration exits, telegraphs, invulnerability windows, per-phase movement and per-phase attacks, plus cycling sub-phases.
- **Enemy-driven spawns.** A phase can request minions, in addition to the existing timed encounter spawn rule.
- **Encounter selection and drill mode.** More than one encounter exists, so the player picks one, and can practise a single phase in isolation.

Nothing else is added. In particular: no player attacks, no arena mutation, no Plagued Nest, no Nest destruction. See [the deferred register](docs/deferred-work.md).

## Recorded User Decisions - 2026-10-27

These answer the design questions raised when the Killer Bee Queen was proposed. They are approved; do not reopen them.

- **K01 - Phase progression is a simulated raid DPS, plus a drill mode.** The authentic HP-fraction thresholds from the source are authored as the real trigger. Because the player cannot attack, an authored `progression` rule drains the boss's HP at a constant rate so a full-fight run advances through every phase. A drill mode additionally lets the player start at, and loop, a single chosen phase. Giving the player attacks was explicitly rejected for this work; see D04 in the deferred register.
- **K02 - Implement every motion kind the fight requires.** `linear`, `boomerang`, `turning`, `wavy` and `lob`. The project instruction that projectiles reverse once and expire only by lifetime is **superseded**: it now describes the `boomerang` kind specifically, not all projectiles. Both mirrored instruction files are updated accordingly.
- **K03 - Only conditions that change dodging or survival are simulated.** Active: **Paralyzed**, **Slowed**, **Confused**, **Armor Broken**, **Exposed**, **Curse**, **Sick**. Inert, authored but with no effect: **Dazed**, **Silenced**, **Quiet**, **Weak**, **Unstable**, **Pet Stasis** - each of these only affects attacking, abilities, mana or pets, none of which exist. Sick is active specifically because the player does regenerate HP from the VIT stat.
- **K04 - Pattern cadences are trainer-authored, not wiki facts.** The source gives projectile stats but almost no shot counts or intervals. Those are authored as this project's own tuning, each marked with an explicit `tuningSource` field, and are **tuned for trainability only after every mechanic is implemented** (step 24.2). Do not describe an invented cadence as authentic.
- **K05 - The arena stays static.** Killer Honey flooding and hardening tiles are deferred as D01. Phases 2 and 5 are practised on the full arena and the resulting fidelity gap is documented, not hidden.
- **K06 - Killer Bee Nests are not destructible.** Phase 6 always runs its full authored duration and always produces the default one-of-each Adolescent Beehemoth outcome. Deferred as D03.
- **K07 - The Plagued Nest is not authored yet.** Only the 30 non-`Plagued Nest only` projectile rows enter `projectiles.json`, and only when a phase actually fires them. The 20 Plagued rows stay transcribed in the source extract. Deferred as D02.
- **K08 - Invulnerability pauses progression.** While an enemy is invulnerable, the simulated-DPS driver does not drain its HP. This is both faithful - the source says the Queen is invulnerable between attacks and throughout phase 6 - and the mechanism that lets a scripted fixed-duration phase exist without being cut short by HP drain.
- **K09 - A phase exits on an HP fraction or on an authored duration.** Most phases exit when the next phase's HP threshold is crossed. Phase 6 is scripted and exits after its authored duration instead. Both exits are authored per phase; phase order is monotonic and a phase is never re-entered except in drill mode.
- **K10 - The Killer Bee Queen is a second encounter, not a replacement.** The Crystal Worm swarm stays playable with its `crystal-worm-child-swarm-paladin-v4` identity. The Queen ships as `killer-bee-queen-nest-paladin-v5`. Attempt history is recorded and compared per encounter.
- **K11 - Randomness extends to projectile angles and wandering, through the same injected seeded generator.** The v4 scope confined randomness to spawn placement; `scatter` patterns and `wander` movement now draw from it too. `Math.random` is still never called inside the simulation. The determinism requirement is unchanged and absolute: the same seed and the same input sequence must produce an identical run, no matter how many fixed steps a single update executes.
- **K12 - The debug panel is not extended per attack.** A slider for every projectile and attack of a boss with eight phases would be unusable and would duplicate the authored data. The panel keeps its Crystal Worm tuning registry and gains only encounter-level controls: jump to a phase or sub-phase, pause progression, and show the active phase and conditions. Killer Bee Queen cadence tuning is done by editing `enemies.json`.
- **K13 - Every authored Killer Bee Queen value carries its provenance.** Projectile entries cite their source-extract row number. Attack entries carry `tuningSource` set to `"wiki-prose"` when the source states the shape of the attack, or `"trainer-authored"` when this project invented the number. A value with neither is a defect.

## Recorded User Decisions - 2026-10-27, Second Round

These resolve the three questions the first round left open. All are approved.

- **K14 - The player picks an encounter from a list on the Home screen.** A simple list, for now: no difficulty settings, no unlocking, no per-encounter screens. The Queen is the default selection because she is the new content. An `?encounter=<id>` parameter is still parsed and validated like `?seed=`, so a specific encounter can be linked. Attempt history and bests are grouped per encounter and never compared across them.
- **K15 - The simulated raid DPS is 375 HP per second.** Approved. The Worked Progression Timeline below is therefore the approved expected timeline, not a sketch, and step 23.2 authors this value. Step 24.2 may still adjust it as the single lever for total fight length, which is the one place a tuning pass should touch it.
- **K16 - Minion stats are transcribed from their own wiki pages, not guessed.** The user approved guessing them to avoid blocking; it turned out to be unnecessary, because all eight non-Plagued minion pages are reachable by the same `curl` method and **are now transcribed** into [the source extract](docs/killer-bee-queen-source.md): Red, Blue and Yellow Killer Bee, Small Worker Bee, Killer Bee Nest (Queen) and the three Adolescent Beehemoths, each with its stats, its verbatim behaviour line and its attack table. QC is therefore closed with sourced data rather than with placeholders. The standing policy that follows from the user's decision: where a **specific value** is genuinely absent from a reachable source - a cadence, a shot count, a body size - author a `trainer-authored` placeholder and move on rather than blocking. Where a whole enemy's stats are missing, fetch the page; blocking a step on research that takes one command is not acceptable either.
- **K17 - Enemy contact damage is implemented.** Transcribing the minions revealed a mechanic no earlier phase covered. The Small Worker Bee's only attack is an invisible projectile at speed 0 and range 0, and its behaviour is "Charges at player attempting to do contact damage": 40 armour-piercing damage and Slowed for 1.6 seconds applied on touch. The archetype already carries `contactDamageHp` and `blocksPlayer` fields that have only ever held zero and false. New step 21.5 implements them.
- **K18 - Nests and Beehemoths are multi-phase archetypes, and a phase spawn chooses a minion's starting phase.** Both have two sourced states: a Nest fires its colour's Hive Shot while alive and a slow short-range radial ball "constantly" once it has broken open, and a Beehemoth fires aimed stinger pairs normally but radial bursts and glaive spreads during the Queen's final phase. Both are expressed with the phase machine that already exists - a duration exit for the Nest, and a `startPhaseIndex` on the spawn entry for the Beehemoth - rather than with duplicate archetypes or cross-enemy coupling. Step 22.4 gains that one optional field.

## Worked Progression Timeline

Derived from the source's HP thresholds at the **approved** 375 HP/second of K15, with K08 pausing the drain while invulnerable. This is the timeline a correct phase machine must produce; step 23.2 asserts against it.

| Phase | Enters at | HP span | Exit rule | Duration at 375 HP/s |
| ----- | --------- | ------- | --------- | -------------------- |
| 1 | 100% | 11,250 | next threshold | 30 s |
| 2 | 90% | 16,875 | next threshold | 45 s |
| 3 | 75% | 16,875 | next threshold | 45 s |
| 4 | 60% | 16,875 | next threshold | 45 s |
| 5 | 45% | 22,500 | next threshold | 60 s |
| 6 | 25% | 0 - invulnerable throughout | authored duration (29 s in the source) | 29 s |
| 7 | 25% | 14,062.5 | next threshold | 37.5 s |
| 8 | 12.5% | 14,062.5 | runs until death | 37.5 s |

Total is about 5 minutes 29 seconds of drain, plus every telegraph and inter-sub-phase invulnerability window. Phase 6 costs no HP precisely because K08 pauses the drain, which is why phase 7 still begins at 25%.

## Approved Technical Approach

Unchanged from v4: application in `app/`; React + TypeScript + Vite generated with the official CLI; npm with a committed lockfile; Phaser for input, loop, camera and drawing; CSS Modules; Vitest, React Testing Library and Playwright; a fixed-step framework-independent simulation that owns gameplay; authored gameplay data as validated JSON under `app/src/game/data`, imported at build time.

Still forbidden without a demonstrated need: a backend, an ECS, a dependency-injection framework, an event-bus library, a state library, a generic plugin system, a custom physics engine, a JSON schema library, or runtime data fetching.

## Architecture

The v4 boundary table stands. Ownership for the new concepts:

| Boundary | Home under `app/src` | Owns |
| -------- | -------------------- | ---- |
| Models | `game/models.ts` | Typed entities, inputs, session states, condition state |
| Authored data | `game/data/*.json` | Arena, shapes, projectiles, enemy archetypes with phases, encounters |
| Configuration/data | `game/config/data.ts` | Runtime validation of every authored value |
| Configuration/derivation | `game/config/encounter.ts` | The single mapping from authored values to runtime config |
| Simulation/rules | `game/simulation/` | Fixed step, movement, patterns, projectile motion, conditions, phases, damage |
| Session | `game/session/` | Start, pause, resume, death, retry, encounter choice, drill mode |
| Engine adapter | `game/phaser/` | Phaser lifecycle, input sampling, camera, drawing |
| Web components | `App.tsx`, `ui` | Home, HUD, results, condition and phase readout |
| Persistence | `storage/` | Versioned local records, per-encounter history |

New simulation modules are expected, because `simulation.ts` is already 660 lines and these phases roughly double its responsibilities. Create a module only when a step's prompt names it. The expected split, created incrementally:

```
game/simulation/projectiles.ts   motion kinds: spawn, advance, expire
game/simulation/patterns.ts      emission patterns: bearings for one volley
game/simulation/conditions.ts    player condition refresh, tick and queries
game/simulation/phases.ts        phase and sub-phase transitions
game/simulation/simulation.ts    the fixed-step loop that composes the above
```

All gameplay uses tiles and seconds; pixel conversion belongs to rendering. React must not update state per projectile per frame. There is exactly one clock.

## Target Data Shapes

Reference shapes for the steps below. A step introduces only the fields it needs; do not author a field before its step.

```jsonc
// app/src/game/data/projectiles.json
{
  "projectiles": {
    "crystal-worm-child-shard": {
      "source": "docs/mechanics.md approved v3 tuning",
      "damageHp": 160,
      "speedTilesPerSecond": 8,
      "armorPiercing": false,
      "conditions": [],
      "body": { "shape": "shard-hexagon", "widthTiles": 1.45, "heightTiles": 0.65 },
      "motion": { "kind": "boomerang", "reversalAgeSeconds": 1.5, "lifetimeSeconds": 3 }
    },
    "kbq-red-stinger-small": {
      "source": "docs/killer-bee-queen-source.md projectile row 1",
      "damageHp": 100,
      "speedTilesPerSecond": 8.5,
      "armorPiercing": true,
      "conditions": [],
      "body": { "shape": "shard-hexagon", "widthTiles": 0.8, "heightTiles": 0.35 },
      "motion": { "kind": "linear", "rangeTiles": 9.5 }
    }
  }
}
```

Motion kinds, and the single rule that governs duration:

| Kind | Extra fields | Lifetime |
| ---- | ------------ | -------- |
| `linear` | none | `rangeTiles / speedTilesPerSecond` |
| `boomerang` | `reversalAgeSeconds`, `lifetimeSeconds` | authored directly |
| `turning` | `turnRateDegreesPerSecond` (signed) | `rangeTiles / speedTilesPerSecond` |
| `wavy` | `amplitudeTiles`, `frequencyHz` | `rangeTiles / speedTilesPerSecond` |
| `lob` | `travelSeconds`, `detonationRadiusTiles` | `travelSeconds` |

Every kind except `boomerang` and `lob` authors `rangeTiles` and derives its lifetime, because ROTMG's published range is speed multiplied by lifetime regardless of the path's shape. `boomerang` keeps authored seconds so the approved v3 Crystal Worm values stay exact; its approved 19.2-tile reach was measured at reversal, not over the whole path, so it cannot be re-derived from a range.

```jsonc
// one attack inside a phase, in app/src/game/data/enemies.json
{
  "id": "p1-targeted-stingers",
  "projectile": "kbq-red-stinger-large",
  "tuningSource": "wiki-prose",          // or "trainer-authored", or "approved-v3"
  "pattern": {
    "kind": "spread",
    "shots": 3,
    "arcDegrees": 24,
    "aim": "player",
    "emitterRadiusTiles": 0.6
  },
  "cadence": {
    "shotsPerBurst": 1,
    "shotIntervalSeconds": 0.2,
    "cooldownAfterLastShotSeconds": 1.4,
    "initialDelaySeconds": 0
  }
}
```

Pattern kinds. **`ring` deliberately subsumes spiral, radial and rotating-machinegun attacks**; there is no separate kind for each, because they differ only in parameters.

| Kind | Fields | Covers |
| ---- | ------ | ------ |
| `ring` | `arms`, `emitterRadiusTiles`, `initialPhaseDegrees`, `clockwiseDegreesPerSecond`, `perBurstAdvanceDegrees`, `gapSectorsDegrees`, `armSpreadDegreesPerSecond`, `maxArmSpreadDegrees` | The Crystal Worm's rotating emitters (`clockwiseDegreesPerSecond: 45`); a static radial burst (`clockwiseDegreesPerSecond: 0`); an N-armed spiral; phase 7's 15-degree-advancing bombs (`perBurstAdvanceDegrees: 15`); phase 6's 2-way rotating machinegun with gaps (`arms: 2` plus gap sectors and arm spread) |
| `spread` | `shots`, `arcDegrees`, `aim`, `fixedBearingDegrees`, `emitterRadiusTiles` | Targeted shotguns and 3-way spreads. `aim: "player"` centres the arc on the player's bearing; `aim: "fixed"` uses `fixedBearingDegrees` |
| `scatter` | `shots`, `coneDegrees`, `aim`, `emitterRadiusTiles` | The source's "messy omnidirectional spray" attacks. Draws each bearing from the injected seeded generator (K11) |

```jsonc
// one phase inside an archetype
{
  "id": "phase-3-center-barrage",
  "enterAtHpFraction": 0.75,
  "exitAfterSeconds": null,              // set instead of relying on the next threshold (K09)
  "telegraphSeconds": 2,
  "invulnerableOnEnterSeconds": 2,
  "movement": { "kind": "stationary" },
  "progression": null,                    // or a per-phase override of the archetype's rate
  "attacks": [ /* AttackSpec[] */ ],
  "subPhases": null,                      // or SubPhaseSpec[] that cycle while the phase runs
  "spawns": null                          // or PhaseSpawnSpec[]
}
```

Movement kinds: `chase`, `stationary`, `move-to-point`, `orbit`, `wander`. Each carries its own `speedTilesPerSecond` where it moves. The Crystal Worm is `{ "kind": "chase", "speedTilesPerSecond": 1.5 }`.

Runtime state additions, for reference:

```ts
type ConditionKey =
  | "paralyzed" | "slowed" | "confused"
  | "armorBroken" | "exposed" | "cursed" | "sick";

type PlayerState = {
  positionTiles: Vector2;
  healthHp: number;
  combatRemainingSeconds: number;
  /** Remaining seconds per condition; 0 means not applied. */
  conditionSeconds: Record<ConditionKey, number>;
};

type AttackClockState = {
  attackId: string;
  epochSeconds: number;
  volleysAtEpoch: number;
  initialDelaySeconds: number;
  rotationEpochSeconds: number;
  rotationPhaseAtEpoch: number;
  ringPhaseRadians: number;
  volleysFired: number;
};

type EnemyState = {
  id: number;
  archetypeId: string;
  positionTiles: Vector2;
  spawnedAtSeconds: number;
  /** null for an archetype with no authored health and no progression. */
  healthHp: number | null;
  maxHealthHp: number | null;
  phaseIndex: number;
  phaseEnteredAtSeconds: number;
  subPhaseIndex: number;
  subPhaseEnteredAtSeconds: number;
  invulnerableUntilSeconds: number;
  /** One per active attack of the current phase and sub-phase. */
  attackClocks: AttackClockState[];
  /** Movement state owned by the active movement kind, for example an orbit bearing. */
  movementPhaseRadians: number;
};

type ShardState = {
  id: number;
  projectileId: string;
  orientationRadians: number;
  positionTiles: Vector2;
  velocityTilesPerSecond: Vector2;
  ageSeconds: number;
  damageHp: number;
  lifetimeSeconds: number;
  hasHitPlayer: boolean;
  /** Only meaningful for the boomerang kind. */
  reversalAgeSeconds: number;
  hasReversed: boolean;
  /** Only meaningful for turning and wavy kinds. */
  spawnPositionTiles: Vector2;
  spawnOrientationRadians: number;
  /** Only meaningful for the lob kind. */
  detonationTargetTiles: Vector2 | null;
};
```

## Approved Scope And Review Gates

- **Behaviour-identical steps must be proven, not asserted.** Steps 19.2, 20.1, 20.2, 22.1 and 22.3 are refactors. Each must leave the Crystal Worm encounter producing an identical timeline: same volley times, same shard ids, same shard positions, same accepted hits, same death times. The suite already contains exact assertions for this - the 671-volley count and the 30/60/120 Hz equivalence test - and they must pass unchanged. Weakening or deleting one of those assertions is a defect, not a fix; report it instead.
- **No shipped Crystal Worm value may change** anywhere in phases 19 through 22. If a step appears to require it, stop and report.
- **One clock, one simulation.** Preserve the fixed-step and catch-up policy, the per-shard once-only hit rule, and insertion-ordered iteration of enemies, attacks and shards.
- **Determinism is absolute (K11).** Randomness enters only through the injected seeded generator, only inside fixed-step updates. A test that runs the same seed and input at 30, 60 and 120 Hz must produce identical results. Nondeterminism inside a seeded run is a defect, never an acceptable source of variety.
- **Curved motion is bounded, not sub-stepped.** The collision test is a swept convex overlap along a straight segment per step, and a `turning` or `wavy` shard does not travel in a straight line within a step. The approved rule is to evaluate each curved path as a closed-form function of age, sweep straight between the step's exact start and end positions, and make the resulting path-versus-chord deviation a **validated loader invariant** capped at 0.02 tiles. At the source's most extreme authored values that deviation is about 0.0044 tiles, so no sub-stepping is needed; step 19.4 derives, tests and enforces this. Do not integrate a curved path incrementally - the error would then depend on how many fixed steps an update executed, which breaks K11.
- **Every authored value carries provenance (K13).** A projectile cites its source-extract row; an attack carries `tuningSource`. The loader rejects an attack with no `tuningSource`.
- **Performance bounds are re-derived, never relaxed.** The Queen's phases 3 and 6 are far denser than four Crystal Worms. The measured v4 peak was 264 live shards with a derived bound of 264. Step 24.1 re-derives the bound from configuration and re-measures in the browser. Never widen or delete a bound to make a run pass.
- **The existing debug panel is extended only as K12 allows.** No per-attack sliders, no authoring UI.
- No backend, accounts, player attacks, seal activation, touch controls, rebinding, arena mutation, Nest destruction or Plagued Nest content. See [the deferred register](docs/deferred-work.md).

## Shared Prompt Contract

Every step prompt inherits these instructions:

1. Read this plan's general sections, the requested step in its phase file, and the [project instructions](AGENTS.md). Check the requested step's dependencies and the existing implementation before editing. Preserve unrelated changes.
2. Work only on this step. Apply YAGNI, DRY, SOLID and TDD pragmatically: no speculative abstractions, no duplicated rules, no unexplained gameplay literals. Use named constants and typed configuration with explicit units.
3. If a necessary design choice is missing, ask the user. Do not turn proposed mechanics into requirements and do not invent a ROTMG value.
4. For testable behaviour, write a focused failing test, run it to establish the expected failure, implement the smallest change, rerun it, then refactor only if needed. Documentation steps use structural checks instead of artificial unit tests.
5. Keep game logic free of React and Phaser dependencies. Add coverage to nearby tests; do not create a duplicate test harness.
6. Run the step's focused checks and the routine gates. Disclose unavailable tools, source access failures and unverified behaviour. Never claim a check ran when it did not. After committing and pushing, do not watch or poll the pipeline or deployment; report the push and stop.
7. End with changed files, actual check outcomes, remaining blockers, and a concise manual verification procedure where relevant. Update this step's status only when its acceptance criteria are met.

## How To Read A Step Prompt

Read this section before your first step.

- **The step prompt is the authority for what to build.** This plan's general sections are the authority for how. If they conflict, stop and ask rather than choosing.
- **"Behaviour-identical" has one meaning:** a fixed input sequence against the Crystal Worm encounter produces byte-identical observable output before and after your change. Prove it by running the existing suite unchanged, not by reasoning that it should hold.
- **Routine gates** are `lint`, `typecheck`, `test` and `build`, run together by `npm run verify`; "all four routine gates" in a step means that command. When to run them, and the Playwright scoping rule, are defined once in the Verification section of [the project instructions](AGENTS.md).
- **Use the pinned toolchain** in `.node-version` (24.22.1) with `npm@12.2.1`. A mismatched local `node` is a disclosed limitation, not a substitute for a gate run.
- **`strict` is off in `tsconfig.app.json`.** The compiler will not catch a missing or mistyped authored JSON field. Every authored value is validated at runtime in `config/data.ts`, in the same defensive style as `isAttemptRecord` in the storage adapter: reject non-objects, absent keys, wrong types, nonfinite numbers and out-of-range values, and throw a `RangeError` naming the offending path. A malformed data file is a programming error caught at module load, never a recoverable user condition, so do not add a silent fallback. Do not enable `strict`; that is out of scope.
- **When you are blocked, report the blocker and stop.** Do not invent a gameplay number, do not implement a deferred item, and do not weaken an existing assertion to make a run pass. A step that reports an honest blocker is a successful step; one that fabricates evidence is not.
- **Record your work in the step's phase file**, directly below the step's prompt, under an `**Execution and verification - <date>**` heading: what you changed, the actual check results with counts, any deviation from the prompt and why, and any blocker. Then set the step's status to `complete` only if every acceptance criterion is met.

## Phase Index

| Phase | Steps | Outcome | Gate |
| ----- | ----- | ------- | ---- |
| 19 | 19.1-19.5 | Contract recorded; projectile catalog and all five motion kinds | G5 |
| 20 | 20.1-20.5 | Emission-pattern vocabulary and concurrent per-attack clocks | G6 |
| 21 | 21.1-21.5 | Player conditions, the condition-aware damage model, HUD readout and contact damage | G7 |
| 22 | 22.1-22.5 | Movement vocabulary, enemy health, the phase machine and drill mode | G8 |
| 23 | 23.1-23.10 | The Killer Bee Queen of The Nest, authored one phase at a time | G9 |
| 24 | 24.1-24.4 | Bounds, trainability tuning, full regression and handoff | G10 |

## Phase 19: The Projectile Catalog And Motion Kinds

> Full prompts and execution records archived: [`docs/plan-archive/phase-19-20.md`](docs/plan-archive/phase-19-20.md).

- **19.1** - Record The V5 Contract And Sources. Status: complete. Dependencies: 18.2. Recorded the V5 contract (K01-K13) in `docs/mechanics.md` and updated the shard-reversal bullet in both instruction files to describe `boomerang` specifically. All gates passed, no runtime file changed.
- **19.2** - Extract Projectiles Into A Keyed Catalog. Status: complete. Dependencies: 19.1. Projectiles became a keyed catalog (`data/projectiles.json`) behind `projectileOf`; `weapon.shard` replaced by `weapon.projectileId`. 373/373 tests, all pre-existing timeline assertions unchanged, all gates passed.
- **19.3** - Add The Linear Motion Kind. Status: complete. Dependencies: 19.2. Extracted motion rules into `simulation/projectiles.ts`; added `linear` motion (straight line, range-based lifetime) alongside `boomerang`. All gates passed.
- **19.4** - Add The Turning And Wavy Motion Kinds. Status: complete. Dependencies: 19.3. Added closed-form `turning` and `wavy` motion kinds for determinism across step rates. All gates passed.
- **19.5** - Add The Lob Motion Kind And Area Detonation. Status: complete. Dependencies: 19.4. Added `lob` motion with detonation-only movement and a telegraph circle; added `presentation.lobTelegraphSeconds` to `encounter.json`. All gates passed.

## Phase 20: Emission Patterns And Concurrent Attacks

> Full prompts and execution records archived: [`docs/plan-archive/phase-19-20.md`](docs/plan-archive/phase-19-20.md).

- **20.1** - Re-Express The Emitter Ring As A Pattern. Status: complete. Dependencies: 19.5. Introduced `attacks: AttackSpec[]` (pattern/cadence/projectile) replacing the single `weapon` block; added pure `resolveBearings` in `simulation/patterns.ts` for `kind: "ring"`. All gates passed.
- **20.2** - Give Each Attack Its Own Clock. Status: complete. Dependencies: 20.1. Replaced the single enemy-level clock with `attackClocks: AttackClockState[]`, one per authored attack, each independently epoched. All gates passed.
- **20.3** - Add The Aimed Spread Pattern. Status: complete. Dependencies: 20.2. Added `kind: "spread"` with `aim: "player" | "fixed"`; shared `resolveAimBearingRadians` helper. 456/456 tests, all gates passed.
- **20.4** - Add The Scatter Pattern And Extend Seeded Randomness. Status: complete. Dependencies: 20.3. Added `kind: "scatter"` with caller-supplied seeded draws, keeping `resolveBearings` pure and draw order fixed. 462/462 tests, all gates passed.
- **20.5** - Add Ring Gaps, Per-Burst Advance And Arm Spread. Status: complete. Dependencies: 20.4. Added `perBurstAdvanceDegrees`, `gapSectorsDegrees` and `armSpreadDegreesPerSecond`/`maxArmSpreadDegrees` to `ring`; absent-field bearings proven identical to 20.1. 497/497 tests, all gates passed.

## Phase 21: Player Conditions And The Damage Model

> Step prompts and execution records: [`docs/plan/phase-21.md`](docs/plan/phase-21.md).

- **21.1** - Add Condition State, Application And Ticking. Status: complete. Dependencies: 20.5.
- **21.2** - Apply The Movement Conditions. Status: complete. Dependencies: 21.1.
- **21.3** - Apply The Damage Conditions And Armor Piercing. Status: pending. Dependencies: 21.2.
- **21.4** - Show Active Conditions To The Player. Status: pending. Dependencies: 21.3.
- **21.5** - Implement Enemy Contact Damage. Status: pending. Dependencies: 21.4.

## Phase 22: Enemy Health, Phases And Movement Behaviours

> Step prompts and execution records: [`docs/plan/phase-22.md`](docs/plan/phase-22.md).

- **22.1** - Introduce The Movement Behaviour Vocabulary. Status: pending. Dependencies: 21.5.
- **22.2** - Add Enemy Health And The Simulated Progression Driver. Status: pending. Dependencies: 22.1.
- **22.3** - Implement The Phase Machine. Status: pending. Dependencies: 22.2.
- **22.4** - Add Cycling Sub-Phases And Phase-Driven Spawns. Status: pending. Dependencies: 22.3.
- **22.5** - Add Drill Mode. Status: pending. Dependencies: 22.4.

## Phase 23: Author The Killer Bee Queen Of The Nest

> Step prompts and execution records: [`docs/plan/phase-23.md`](docs/plan/phase-23.md).

- **23.1** - Add Encounter Selection And The Cleared Outcome. Status: pending. Dependencies: 22.5.
- **23.2** - Author The Queen's Skeleton. Status: pending. Dependencies: 23.1.
- **23.3** - Author Phase 1. Status: pending. Dependencies: 23.2.
- **23.4** - Author Phase 2 And The Killer Bee Minions. Status: pending. Dependencies: 23.3.
- **23.5** - Author Phase 3. Status: pending. Dependencies: 23.4.
- **23.6** - Author Phase 4. Status: pending. Dependencies: 23.5.
- **23.7** - Author Phase 5. Status: pending. Dependencies: 23.6.
- **23.8** - Author Phase 6, The Nests And Worker Bees. Status: pending. Dependencies: 23.7.
- **23.9** - Author Phase 7 And The Beehemoths. Status: pending. Dependencies: 23.8.
- **23.10** - Author Phase 8 And Complete The Fight. Status: pending. Dependencies: 23.9.

## Phase 24: Bounds, Tuning, Regression And Handoff

> Step prompts and execution records: [`docs/plan/phase-24.md`](docs/plan/phase-24.md).

- **24.1** - Re-Derive And Re-Measure The Performance Bounds. Status: pending. Dependencies: 23.10.
- **24.2** - Tune The Fight For Trainability. Status: pending. Dependencies: 24.1.
- **24.3** - Run The Full Acceptance Matrix. Status: pending. Dependencies: 24.2.
- **24.4** - Update The Handoff Documentation. Status: pending. Dependencies: 24.3.

## Customization Choice

Shared engineering rules live only in `AGENTS.md`, which Copilot and other agents read directly and `CLAUDE.md` imports for Claude Code. The `/implement-step` and `/verify` workflows live only in `.claude/skills/<name>/SKILL.md`, which both Claude Code and Copilot load. Each file is the single source of truth; there are no mirrored copies to keep in sync.

Phase 23 is ten authoring steps against one stable vocabulary, which is the repeated workflow a skill would serve. Reconsider a reusable encounter-authoring skill after step 23.4: by then two phases and one minion family will have been authored and it will be clear whether the repetition is mechanical enough to automate, or whether each phase's source reading is the actual work.

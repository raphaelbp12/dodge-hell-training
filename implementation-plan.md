# Active Implementation Plan

## Purpose And Execution

Deliver a pure-frontend ROTMG-inspired training game: repeatedly survive a faithful recreation of a real ROTMG boss encounter, inspect results, and retry immediately.

This file holds the **pending** work only: phases 19-24, which generalize the single-weapon simulation into a projectile catalog, an emission-pattern vocabulary, a player condition model and a multi-phase boss machine, then author the **Killer Bee Queen** of The Nest on top of them.

This is a plan, not authorization to implement all phases at once. Each numbered step below is an implementation prompt. Run one at a time with `/implement-step <step-id>`, for example `/implement-step 19.2`. Read the shared contract below, then execute only the requested prompt. Dependencies must be complete first.

**Execution modes.** Two modes are available and the user chooses per request:

- **Single step (default).** Run exactly one step, then stop and report. Do not commit, push, deploy or begin the next step. This is the mode whenever the user does not say otherwise.
- **Batch, on explicit request.** When the user explicitly asks for a batch - naming the steps or phases - run them in dependency order, each with its own focused checks, execution record and gate run before the next begins. A failed gate stops the batch and is reported; it is never recorded as complete. Still no commit, push or deployment without separate authorization. A batch request covers only the steps named in it and does not carry to later requests.

Steps start pending. After completing a step, replace its status with `complete`, record the actual checks and outcomes below its prompt, and note any approved deviations. Do not mark a step complete when its required checks are blocked. Do not automatically start the next step.

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

1. Read this plan and the [project instructions](CLAUDE.md). Check the requested step's dependencies and the existing implementation before editing. Preserve unrelated changes.
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
- **Routine gates, run from `app/`, in this order:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Run all four for every change that touches runtime code.
- **Playwright is not routine.** CI runs the full `npm run test:e2e` on every push. When your step adds or changes a Playwright test, run only that test with `npm run test:e2e -- --grep "<pattern>"`. Run the full suite locally only to reproduce a failure CI reported, or when a step explicitly asks for a full acceptance run.
- **Use the pinned toolchain** in `.node-version` (24.22.1) with `npm@12.2.1`. A mismatched local `node` is a disclosed limitation, not a substitute for a gate run.
- **`strict` is off in `tsconfig.app.json`.** The compiler will not catch a missing or mistyped authored JSON field. Every authored value is validated at runtime in `config/data.ts`, in the same defensive style as `isAttemptRecord` in the storage adapter: reject non-objects, absent keys, wrong types, nonfinite numbers and out-of-range values, and throw a `RangeError` naming the offending path. A malformed data file is a programming error caught at module load, never a recoverable user condition, so do not add a silent fallback. Do not enable `strict`; that is out of scope.
- **When you are blocked, report the blocker and stop.** Do not invent a gameplay number, do not implement a deferred item, and do not weaken an existing assertion to make a run pass. A step that reports an honest blocker is a successful step; one that fabricates evidence is not.
- **Record your work in this file**, directly below the step's prompt, under an `**Execution and verification - <date>**` heading: what you changed, the actual check results with counts, any deviation from the prompt and why, and any blocker. Then set the step's status to `complete` only if every acceptance criterion is met.

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

### Step 19.1 - Record The V5 Contract And Sources

Status: complete. Dependencies: 18.2.

**Implementation prompt**

Documentation only. Write down the approved contract before any code changes, so later steps cite a record instead of re-deriving it.

In [the mechanics contract](docs/mechanics.md), append a new section `## Approved V5 Boss Encounter Contract - Step 19.1`, following the style of the existing `## Approved V4 Swarm Contract - Step 17.1`. It is additive: do not edit or reword any existing section, and do not touch v1-v4 provenance. Record, with subsections:

- **Source access.** That [the source extract](docs/killer-bee-queen-source.md) is the verified transcription for this encounter, retrieved 2026-10-27 from the page at Exalt version 5.14.0.0, and that `WebFetch` returns an empty document for RealmEye pages so `curl` plus HTML parsing is the access method. Add the retrieval to the contract's existing Source Access Log.
- **Decisions.** K01 through K13 from the active plan, each in one or two sentences, as the approved contract rather than a proposal.
- **Fidelity limits.** The five gaps this encounter ships with, each naming its deferred register id: no arena mutation (D01), no Plagued Nest (D02), no Nest destruction (D03), no player attacks and therefore no Stun or Daze windows (D04, D05), and no adaptive HP scaling (D06). State plainly that phases 2 and 5 are easier than the live fight because the player keeps the whole arena, and that phases 1, 3 and 8 are harder because a real group suppresses attacks by stunning.
- **The two interpretations that are not sourced.** First, the phase-to-projectile-variant bindings, because the wiki's attack table does not say which phase fires which variant of a repeated sprite. Second, the ordering of Curse against this project's minimum-damage floor, because the source states only that Curse applies after defence and defence modifiers.
- **The damage formula.** The exact condition-aware formula from step 21.3's prompt, with its seven worked cases, and the explicit note that the sub-20-defence Armor-Broken-plus-Exposed interaction is not modelled because the only player preset has 32 defence.

Then update both mirrored instruction files in the same change, because K02 supersedes a rule they currently state. In [`CLAUDE.md`](CLAUDE.md) and [`.github/copilot-instructions.md`](.github/copilot-instructions.md): change the bullet that requires shards to reverse velocity once and expire only by lifetime so that it describes the `boomerang` motion kind specifically; state that other motion kinds exist and are authored per projectile; keep the per-projectile once-only hit rule, which is unchanged. Add one bullet pointing at [the deferred register](docs/deferred-work.md) as the list of recognised, postponed, unapproved work. Add one bullet recording the `curl` access method for RealmEye pages. Keep the two files identical in content; the mirror table at the bottom of `CLAUDE.md` already records the pairing.

Do not change any JSON, TypeScript or test file in this step.

**Focused checks:** no unit tests - this step adds no behaviour. Verify structurally: every relative link in the files you touched resolves on disk; the two instruction files differ only in their header and the mirror note; `docs/mechanics.md` still contains every pre-existing section heading, confirmed by comparing the heading list before and after; and the K01-K13 wording in the contract does not contradict the active plan. Run `npm run lint`, `npm run typecheck` and `npm run test` from `app/` to prove nothing was disturbed.

**Acceptance:** the V5 contract is recorded additively in the mechanics document, both instruction files reflect K02 and are identical in content, all links resolve, no earlier contract section is altered, and no runtime file changed.

**Execution and verification - 2026-10-27**

Added `## Approved V5 Boss Encounter Contract - Step 19.1` to the end of `docs/mechanics.md`: Source Access (with S13 appended to the Source Access Log), Decisions (K01-K13), Fidelity Limits (D01-D06), the two unsourced interpretations, and the damage formula with its seven worked cases. Updated the shard-reversal bullet in both `CLAUDE.md` and `.github/copilot-instructions.md` to describe `boomerang` specifically (K02), and added one bullet each for the deferred register and the RealmEye `curl` access method. No v1-v4 section of `mechanics.md` was edited (`git diff` shows only additions, zero deletions); the two instruction files diverge only in relative link depth (`../` prefixes in the Copilot file), confirmed by diffing both bodies with that prefix normalized. All referenced links (`docs/deferred-work.md`, `docs/killer-bee-queen-source.md`, `docs/mechanics.md`) resolve on disk.

Checks run from `app/`: `npm run lint` (pass), `npm run typecheck` (pass), `npm run test` - 357/357 passed across 11 files. No runtime file changed in this step, matching its own focused-checks list (build was not required for a docs-only step).

### Step 19.2 - Extract Projectiles Into A Keyed Catalog

Status: complete. Dependencies: 19.1.

**Implementation prompt**

Behaviour-identical refactor. Projectiles become a catalog shared by every archetype, instead of a block nested inside one weapon. No shipped gameplay value may change.

Add `app/src/game/data/projectiles.json` with exactly **one** entry, `crystal-worm-child-shard`, carrying the values that `enemies.json` holds today at `archetypes.crystal-worm-child-head.weapon.shard`: `damageHp` 160, `speedTilesPerSecond` 8, the `shard-hexagon` body at 1.45 by 0.65 tiles, `expiration` `"lifetime-only"` and `hitPolicy` `"once-per-shard"`. Add `armorPiercing: false`, `conditions: []`, a `source` string citing the approved v3 tuning, and `motion: { "kind": "boomerang", "reversalAgeSeconds": 1.5, "lifetimeSeconds": 3 }`. Then replace that whole `weapon.shard` block in `enemies.json` with `"projectile": "crystal-worm-child-shard"`.

In `config/data.ts`, add `validateProjectiles` and export `validateProjectile` so a single entry can be tested with a literal object. Validate: a nonempty keyed object; `damageHp` nonnegative; `speedTilesPerSecond` nonnegative; `armorPiercing` boolean; `conditions` an array; the body through the existing shape path; `expiration` exactly `"lifetime-only"` and `hitPolicy` exactly `"once-per-shard"`; and a `motion` object whose `kind` is `"boomerang"` with `reversalAgeSeconds` strictly greater than zero and strictly less than `lifetimeSeconds`. Reject any other `kind` in this step - later steps add them one at a time. Also reject an `enemies.json` weapon whose `projectile` names a key absent from the catalog.

In `config/encounter.ts`, add `ProjectileSpec` to the exported types and `projectiles: Readonly<Record<string, ProjectileSpec>>` to `EncounterConfig`, with a `projectileOf(config, id)` resolver that mirrors the existing `archetypeOf` and throws on an unknown id. `EnemyArchetype["weapon"]` loses its `shard` object and gains `projectileId: string`. Route the existing `TuningValues` keys `projectileDamageHp`, `projectileSpeedTilesPerSecond`, `reversalSeconds`, `lifetimeSeconds`, `projectileWidth` and `projectileHeight` through the catalog entry inside `buildEncounterConfig`, so the debug sliders keep working and there is still exactly one mapping from authored values to runtime config. Do not add a second builder.

In `models.ts`, rename `ShardState.archetypeId` to `projectileId`. In `simulation.ts`: resolve the firing projectile through `projectileOf`; change `boundingRadiusTiles` to take the maximum over the **projectile catalog** rather than over archetypes; change `restampLiveShards(shards, weapon)` to `restampLiveShards(shards, projectile)`; and resolve each shard's collision body through `projectileOf(state.config, shard.projectileId)`. In `phaser/encounter.ts`, resolve each shard's drawing body the same way. Update the Playwright `Inspection` type so shards carry `projectileId`.

Do not add any second projectile, any other motion kind, or any new pattern. Do not change the emitter, burst, movement or spawn structures.

**Focused checks:** start with a focused failing test that `ENCOUNTER_CONFIG.projectiles["crystal-worm-child-shard"]` exists, and confirm the red. Then: every `validateProjectile` rejection case, each naming its path; an `enemies.json` weapon naming an absent projectile is rejected; the derived runtime projectile values equal the pre-refactor `weapon.shard` values field for field; `boundingRadiusTiles` equals the maximum over the catalog; `restampLiveShards` still re-stamps damage, reversal age and lifetime and still filters expired shards. Then prove behaviour identity: the existing 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must all pass **unchanged**. Run all four routine gates, and `npm run test:e2e -- --grep "shard"` for the inspection path you changed.

**Acceptance:** projectiles are a keyed catalog behind the existing validating loader, `weapon.shard` is gone in favour of `weapon.projectileId`, shards carry `projectileId`, the broadphase bound comes from the catalog, every pre-existing timeline assertion passes unchanged, and all four gates pass.

**Execution and verification - 2026-10-27**

Added `app/src/game/data/projectiles.json` with the single `crystal-worm-child-shard` entry carrying the exact pre-refactor `weapon.shard` values (damage 160, speed 8, body 1.45x0.65, reversal 1.5s, lifetime 3s), plus `armorPiercing: false`, `conditions: []` and a `source` string. Replaced `enemies.json`'s `weapon.shard` block with `"projectile": "crystal-worm-child-shard"`.

`config/data.ts`: added `validateProjectile`/`validateProjectiles` (exported `AUTHORED_PROJECTILES`), rejecting any `motion.kind` other than `"boomerang"` and any reversal not strictly inside the lifetime. `validateArchetypes`/`validateArchetype` now take the catalog's id set and reject a `weapon.projectile` absent from it. `config/encounter.ts`: added `ProjectileSpec`, `EncounterConfig.projectiles`, and `projectileOf`; `EnemyArchetype.weapon` lost `shard` in favour of `projectileId`; `buildEncounterConfig` now builds one catalog entry from `TuningValues` (unchanged debug-slider routing) instead of a nested shard object; `liveShardBoundPerEnemy` takes `(config, archetype)` and resolves the projectile's lifetime through `projectileOf`; `validateArchetype`'s shard-shaped checks moved into a new `validateProjectileSpec`.

`models.ts`: renamed `ShardState.archetypeId` to `projectileId`. `simulation.ts`: `boundingRadiusTiles` now maxes over `config.projectiles`; `restampLiveShards` takes a `ProjectileSpec` instead of a weapon; `updateEnemyAttacks` resolves the firing projectile via `projectileOf` and stamps `projectileId` on each new shard; `shardOverlapsPlayer` and `setDebugSettings`'s restamp call resolve the shard/primary body the same way. `phaser/encounter.ts` draws each shard's body via `projectileOf(config, shard.projectileId)`.

Tests: added a focused failing-first set in `config/data.test.ts` (`AUTHORED_PROJECTILES` existence, 12 `validateProjectile` rejection cases, empty-catalog rejection, and `validateArchetypes` rejecting a weapon naming an unknown projectile) and updated every existing shard-shaped literal and `PRIMARY.weapon.shard.*` read across `config.test.ts` and `simulation.test.ts` to the new `projectileId`/`projectileOf` shape, including the `restampLiveShards` and `liveShardBoundPerEnemy` call sites (now `(config, archetype)`). No pre-existing assertion was weakened or deleted - the exact pre-refactor numeric values (66, 671 volleys, SHARD_BODY_TILES, etc.) are still pinned, now read through the catalog.

Checks run from `app/`: `npm run lint` (pass, no findings), `npm run typecheck` (pass), `npm run test` - 373/373 passed across 11 files (357 pre-existing + 16 new, zero removed or weakened), including the 671-volley assertion (`five-minute moving encounters stay bounded and agree at 30/60/120 Hz`), the 30/60/120 Hz equivalence test, and the fixed-input reproducibility test, all unchanged. `npm run build` (pass). `npm run test:e2e -- --grep "pursue, fire, reverse, register hits"` (1 passed) - the Playwright spec has no test titled with "shard"; this is the test that exercises the live Phaser shard-inspection path (`Inspection.shards: ShardState[]`, which now carries `projectileId`) end to end, so it was run in its place.

### Step 19.3 - Add The Linear Motion Kind

Status: complete. Dependencies: 19.2.

**Implementation prompt**

Add the motion kind that most Killer Bee Queen projectiles use: travel in a straight line and expire at the published range. Additive only; no shipped projectile uses it yet, exactly as step 16.3 proved multi-enemy behaviour before any spawn rule existed.

Create `app/src/game/simulation/projectiles.ts` and move the projectile motion rules into it from `simulation.ts`: the shard-spawn construction currently inlined in `updateEnemyAttacks`, `advanceShard`, `moveShard` and `restampLiveShards`. `simulation.ts` keeps the fixed-step loop, hit registration and player/enemy movement, and calls into the new module. This is a pure move for the `boomerang` kind - do not change its behaviour while moving it.

Give the module a motion-kind dispatch with two named operations:

- `createShard(projectile, id, positionTiles, orientationRadians)` returns a `ShardState` with its lifetime resolved by kind: authored `lifetimeSeconds` for `boomerang`, and `rangeTiles / speedTilesPerSecond` for `linear`. Set `reversalAgeSeconds` to `Infinity` for `linear`, so the existing reversal branch can never fire and no second code path is needed.
- `advanceShard(...)` keeps its current signature and behaviour. A `linear` shard travels along its initial velocity and expires only when `ageSeconds` reaches `lifetimeSeconds`.

Extend `validateProjectile` to accept `kind: "linear"` with a `rangeTiles` strictly greater than zero, and to reject `reversalAgeSeconds` or `lifetimeSeconds` on a `linear` entry, so a lifetime can never be authored in two places. Keep rejecting every kind other than `linear` and `boomerang`.

Record one derived fact in a test rather than a comment: for the source's row 1, `red-stinger-small` at speed 8.5 and range 9.5, the derived lifetime is 9.5 / 8.5, which is 1.117647 seconds to six places. Assert the exact division, not the rounded decimal.

Do not author any Killer Bee Queen projectile into `projectiles.json` in this step. Test `linear` behaviour with literal `ProjectileSpec` and `ShardState` objects in the test file, and with a config clone built through the existing public surface, following step 16.3's precedent of a test-file-local helper rather than widening the production API for tests.

**Focused checks:** focused failing test on `createShard` with a `linear` spec first. Then: lifetime derives from range divided by speed and is exact; a `linear` shard never reverses; it expires exactly at its lifetime boundary and not a tick early or late, using the existing boundary-tolerance style; `validateProjectile` accepts a valid `linear` entry and rejects a missing or nonpositive `rangeTiles`, an authored `lifetimeSeconds`, and an authored `reversalAgeSeconds`; and the move of the boomerang rules into `projectiles.ts` changed nothing, proven by the existing timeline assertions passing unchanged. All four routine gates.

**Acceptance:** `projectiles.ts` owns projectile motion, the `linear` kind works and derives its lifetime from the published range, the `boomerang` kind is byte-identical after the move, every pre-existing timeline assertion passes unchanged, and all four gates pass.

**Execution and verification - 2026-10-27**

Created `app/src/game/simulation/projectiles.ts`, moving `restampLiveShards`, `shardOverlapsPlayer`, `moveShard`/`interpolatePosition` and `advanceShard` out of `simulation.ts` verbatim (pure move for `boomerang`), plus a new `createShard(projectile, id, positionTiles, orientationRadians)` factory that replaces the inline shard-literal construction in `updateEnemyAttacks`. The three collision functions take a narrow `ShardCollisionContext` (`{ config, collisionBoundingRadiusTiles }`) rather than the full `SimulationState`, so `projectiles.ts` has no dependency on `simulation.ts` and there is no circular import; `simulation.ts` still passes its `SimulationState` directly since it structurally satisfies the narrower type.

Added a private `resolveShardLifetime(projectile)` dispatcher inside `projectiles.ts`: `boomerang` returns its authored `reversalAgeSeconds`/`lifetimeSeconds` unchanged; `linear` returns `rangeTiles / speedTilesPerSecond` for the lifetime and `Infinity` for the reversal age, so `advanceShard`'s existing reversal branch (`!shard.hasReversed && targetAgeSeconds >= shard.reversalAgeSeconds`) can structurally never fire for a `linear` shard - no second motion branch was added. `restampLiveShards` now calls the same dispatcher instead of reading `.motion.reversalAgeSeconds`/`.lifetimeSeconds` directly, so it now also restamps correctly for a (currently nonexistent) live `linear` shard.

`config/data.ts`: split `validateProjectileMotion` out of `validateProjectile`, dispatching on `motion.kind`; added the `linear` case requiring a positive `rangeTiles` and explicitly rejecting an authored `reversalAgeSeconds` or `lifetimeSeconds` on it; kept rejecting any kind other than `boomerang`/`linear`. `config/encounter.ts`: widened `ProjectileSpec`/`AuthoredProjectileMotion`'s `motion` to the two-member discriminated union; `validateProjectileSpec` now checks the `boomerang`-only reversal/lifetime invariant only for that kind and a positive `rangeTiles` for `linear`; added `lifetimeSecondsOf` (a one-line, intentionally independent copy of the same kind-dispatch, since `config/` cannot depend on `simulation/`) so `liveShardBoundPerEnemy` still works if a future archetype ever ships a `linear` primary weapon; `AUTHORED_TUNING`'s debug-slider routing narrows `authoredProjectile.motion` to `boomerang` once at module load (the debug panel only ever tunes the shipped boomerang shard) and throws if that ever stops holding.

Did not author any Killer Bee Queen projectile; `projectiles.json` still has exactly the one `crystal-worm-child-shard` entry.

Tests: added `app/src/game/simulation/projectiles.test.ts` with a focused failing-first test on `createShard`'s derived linear lifetime (asserts the exact division `9.5 / 8.5`, then `toBeCloseTo(1.117647, 6)`), a never-reverses test driving `advanceShard` for 200 ticks, and an exact-boundary expiry test (ticks until `alive` is false, asserts `ageSeconds === lifetimeSeconds`, not a tick early/late) and a boomerang-shape regression check. Added 5 new `validateProjectile` cases to `config/data.test.ts` for the `linear` kind (valid entry, nonpositive/missing `rangeTiles`, authored `lifetimeSeconds`/`reversalAgeSeconds` rejected, unknown kind rejected). Updated existing `PRIMARY.weapon.shard`-derived reads in `config.test.ts`/`simulation.test.ts` to resolve through `projectileOf` and narrow the union to `boomerang` once per file (a thrown fixture guard, not a silent cast) since those tests assume the shipped shard's kind.

Checks run from `app/`: `npm run lint` (pass), `npm run typecheck` (pass), `npm run test` - 383/383 passed across 12 files (373 pre-existing + 10 new, zero removed or weakened), including the 671-volley, 30/60/120 Hz equivalence and fixed-input reproducibility assertions unchanged. `npm run build` (pass). `npm run test:e2e -- --grep "pursue, fire, reverse, register hits"` (1 passed) - same substitute test as 19.2, since no Playwright test title contains "linear" or "shard" and this is the one exercising the moved motion/collision path live.

### Step 19.4 - Add The Turning And Wavy Motion Kinds

Status: complete. Dependencies: 19.3.

**Implementation prompt**

Add the two curved motion kinds the source's attack table specifies: `Turn Rate: ±70` and `±20` degrees per second, and `Amplitude: 0.8, Frequency: 1`. Additive; no shipped projectile uses them yet.

Both kinds derive their lifetime from `rangeTiles / speedTilesPerSecond`, exactly as `linear` does, because ROTMG's published range is speed multiplied by lifetime regardless of the path's shape. Both need the spawn pose kept on the shard, so add `spawnPositionTiles` and `spawnOrientationRadians` to `ShardState` and set them in `createShard` for every kind.

Define each path as an exact closed-form function of age, evaluated at the end of the step, rather than as an incrementally integrated velocity. Incremental integration accumulates error differently depending on how many fixed steps a single update executes, which would break the determinism requirement in K11.

- `turning`: heading at age `t` is `spawnOrientationRadians + turnRate * t`. Position is the arc traced at constant speed. Set `orientationRadians` to the current heading each step so the body visibly faces its direction of travel.
- `wavy`: position at age `t` is the point `speed * t` along the spawn orientation, plus a lateral offset of `amplitudeTiles * sin(2 * pi * frequencyHz * t)` perpendicular to it. The lateral offset is zero at `t = 0`.

**Collision correctness, and the measurement that decides it.** The collision test is a swept convex overlap along a straight segment per fixed step. For a curved path, compute the exact position at the start and the end of the step and sweep straight between them. That approximation is acceptable only while the path's deviation from that chord stays far below the body size, so make the bound an explicit, validated invariant rather than an assumption:

- For `turning`, the per-step chord length is `speed / 60` and the per-step heading change is `turnRate / 60`. The arc's maximum deviation from its chord is about `chordLength * headingChange / 8` radians-scaled. At the source's worst case - speed 8 tiles per second and 70 degrees per second - that is about 0.00034 tiles.
- For `wavy`, the lateral acceleration is `amplitudeTiles * (2 * pi * frequencyHz)^2`, and the per-step deviation is at most half of that times the step squared. At the source's values - amplitude 0.8 and frequency 1 - that is about 0.0044 tiles.

Both are under half a percent of the 1.25-tile player body, so **no sub-stepping is required at the fixed 60 Hz step**. Encode that conclusion as a guard, not as a comment: add a named constant for the maximum tolerated per-step path deviation, set it to 0.02 tiles, derive each curved projectile's worst-case deviation in the loader from its authored parameters and the fixed step, and have `validateProjectile` reject any entry that exceeds it. A future projectile with an extreme turn rate then fails loudly at module load instead of silently tunnelling.

Extend `validateProjectile` to accept `kind: "turning"` with a finite nonzero signed `turnRateDegreesPerSecond` and a positive `rangeTiles`, and `kind: "wavy"` with a positive `amplitudeTiles`, a positive `frequencyHz` and a positive `rangeTiles`. Keep rejecting unknown kinds. Keep rejecting authored `lifetimeSeconds` on any range-derived kind.

Do not author a Killer Bee Queen projectile here. Do not add sub-stepping machinery; the point of the measurement is that it is not needed.

**Focused checks:** focused failing test on a `turning` shard's position after a known age first. Then: a `turning` shard at 70 degrees per second completes a quarter turn in exactly 90/70 seconds, asserted on heading; its path length over its lifetime equals `speed * lifetime` to within floating-point tolerance; a `wavy` shard's lateral offset is zero at age 0 and at every whole multiple of `1 / frequencyHz`, and reaches `amplitudeTiles` at a quarter period; both kinds expire exactly at their derived lifetime; the derived worst-case deviation for the source's extreme values matches the figures above; `validateProjectile` rejects a turn rate or amplitude that would exceed the 0.02-tile tolerance; and advancing either kind at 30, 60 and 120 Hz over the same elapsed time gives positions that agree at the shared step boundaries. All four routine gates.

**Acceptance:** `turning` and `wavy` motion are implemented as closed-form functions of age, the path-deviation tolerance is a validated loader invariant with the derivation tested, determinism holds across step rates, no sub-stepping was added, every pre-existing assertion passes unchanged, and all four gates pass.

**Execution and verification - 2026-10-27**

Added `spawnPositionTiles`/`spawnOrientationRadians` to `ShardState`, set by `createShard` for every motion kind. In `simulation/projectiles.ts`: added `curvedShardPositionAtAge`/`curvedShardOrientationAtAge` as exact closed-form functions of age (standard circular-arc parametrisation for `turning` - position `spawn + (v/ω)·(sinφ(t)−sinθ0, −(cosφ(t)−cosθ0))` with heading `φ(t)=θ0+ωt`; constant-forward-plus-perpendicular-sine for `wavy`) and an `isCurvedMotion` type guard. `moveShard` now resolves the firing projectile via `projectileOf` and branches: `boomerang`/`linear` keep the exact pre-existing velocity-integration code path untouched; `turning`/`wavy` evaluate the closed form directly at the segment's start and end ages and sweep a straight chord between them, per the plan's collision-correctness rule. Because `turning`/`wavy` never reverse (`resolveShardLifetime` gives them `reversalAgeSeconds: Infinity`, same mechanism as `linear`), `advanceShard`'s reversal branch still structurally cannot fire for them, so `moveSegment` is called exactly once per fixed step for a curved shard - consistent with "sweep straight between the step's exact start and end positions."

`config/data.ts`: added the named `MAXIMUM_PATH_DEVIATION_TILES` constant (0.02 tiles) and two derivation functions, `turningDeviationTiles` (sagitta of the per-step arc: `chordLength * headingChangeRadians / 8`) and `wavyDeviationTiles` (`0.5 * amplitude * (2πf)² * stepSeconds²`), both exported for direct testing. `validateProjectileMotion` gained `turning` (nonzero finite `turnRateDegreesPerSecond`, positive `rangeTiles`) and `wavy` (positive `amplitudeTiles`/`frequencyHz`, positive `rangeTiles`) cases, generalising the existing "no authored `lifetimeSeconds`/`reversalAgeSeconds`" rejection to all three range-derived kinds via a small `rangeDerivedKinds` dispatch. `validateProjectile` now computes each kind's deviation after `speedTilesPerSecond` is known and rejects any entry whose derived deviation exceeds the bound. Threading the fixed-step duration into this check required reordering the module's three `AUTHORED_*` exports so `AUTHORED_ENCOUNTER` (which doesn't depend on the catalog) is validated first, then `AUTHORED_PROJECTILES` and `AUTHORED_ARCHETYPES` are built from its `fixedStepSeconds` - no raw/duplicate read of the JSON was needed. `config/encounter.ts`'s `ProjectileMotion`/`AuthoredProjectileMotion` widened to the four-kind union; `validateProjectileSpec`'s existing `else` branch already generalised to all three range-derived kinds via the shared `rangeTiles` field, so no change was needed there.

Did not add any sub-stepping machinery; did not author a Killer Bee Queen projectile.

Tests: added 14 tests to `simulation/projectiles.test.ts` covering a quarter turn at the source's extreme turn rate completing in exactly `90/70` seconds (single closed-form call, exact), constant instantaneous speed at four sampled ages (confirming path length accumulates as `speed * elapsed` without literally integrating a polyline), wavy's zero-at-whole-periods and peak-at-quarter-period lateral offset, expiry exactness at 30/60/120 Hz, and cross-rate position agreement at a shared 0.5s boundary for both kinds. Picked a 16-tile (2-second) test range rather than a very long one, after discovering that a 1000-tile/125-second test fixture accumulates enough fixed-step floating-point drift over 7500+ ticks to itself exceed the loader's own boundary tolerance - a test-authoring pitfall, not a defect in the production code, and not a realistic range for this trainer. Added 14 cases to `config/data.test.ts`: accepting the source's exact extreme values for both kinds, a direct numeric check that the derived deviations match the plan's stated ~0.00034 and ~0.0044 tile figures, and rejection cases for a zero/nonfinite turn rate, nonpositive amplitude/frequency, and values that exceed the 0.02-tile tolerance.

Checks run from `app/`: `npm run lint` (pass), `npm run typecheck` (pass), `npm run test` - 402/402 passed across 12 files (392 pre-existing + 10 net new, zero removed or weakened), including the 671-volley, 30/60/120 Hz equivalence and fixed-input reproducibility assertions unchanged (the `toEqual` shard-shape assertion in `simulation.test.ts` was extended with the two new fields, not weakened). `npm run build` (pass). `npm run test:e2e -- --grep "pursue, fire, reverse, register hits"` (1 passed) - same substitute as 19.2/19.3.

### Step 19.5 - Add The Lob Motion Kind And Area Detonation

Status: complete. Dependencies: 19.4.

**Implementation prompt**

Add bombs. The source's table gives six bomb rows with a damage, a condition and a `Radius` of 2 or 3 tiles, and no speed or range: a bomb is lobbed to a point, passes over everything on the way, and detonates into an area. Additive; no shipped projectile uses it yet.

Author `kind: "lob"` with `travelSeconds` and `detonationRadiusTiles`. A lob shard's lifetime is `travelSeconds`. Resolve its destination at fire time and store it on the shard as `detonationTargetTiles`, then set `velocityTilesPerSecond` to `(target - start) / travelSeconds` so it arrives exactly at the end of its lifetime regardless of the distance. Destination resolution has exactly two cases:

- The firing pattern aims at the player: the destination is the player's position at fire time, clamped so the distance never exceeds `speedTilesPerSecond * travelSeconds`.
- Otherwise: the destination is the emitter point plus the firing direction times `speedTilesPerSecond * travelSeconds`.

A lob shard **does not collide while in flight.** Skip the swept overlap test for it entirely; do not merely give it a zero-size body. When its age reaches `travelSeconds` it detonates exactly once: if the player's body overlaps a circle of `detonationRadiusTiles` centred on `detonationTargetTiles`, apply its damage and conditions through the same `registerShardHit` path every other projectile uses, so there is one damage and one hit-feedback route. Then the shard expires. A detonation that misses applies nothing. The once-per-shard hit rule is unchanged: a detonation is one hit opportunity, not a lingering area.

Reuse the existing geometry kernel for the overlap test - a convex body against a circle - rather than writing a new primitive. If no existing function expresses it, add the narrowest helper to `simulation/geometry.ts` next to `convexBodyFitsCircle`, and give it its own focused test.

For drawing, `phaser/encounter.ts` draws a lob shard's body in flight like any other, and additionally draws the detonation circle's outline at `detonationTargetTiles` for a short authored number of seconds before the detonation, so the attack is dodgeable rather than unfair. Put that telegraph duration in `encounter.json` under `camera` or a new `presentation` block with an explicit unit, not as a literal in the renderer.

Extend `validateProjectile` to accept `kind: "lob"` with a positive `travelSeconds`, a positive `detonationRadiusTiles` and a positive `speedTilesPerSecond`, and to reject `rangeTiles`, `lifetimeSeconds` and `reversalAgeSeconds` on a lob entry. Do not author a Killer Bee Queen bomb here.

**Focused checks:** focused failing test that a lob shard reaches its destination exactly at `travelSeconds` first. Then: arrival is exact for a near and a far destination; a targeted destination beyond the maximum distance is clamped to it; a lob shard passing directly through the player's body in flight registers no hit; a detonation whose circle overlaps the player applies damage once through `registerShardHit` and produces one `AcceptedHit`; a detonation whose circle does not reach the player applies nothing; a detonating shard expires in the same step; the body-against-circle overlap helper is correct at the boundary, just inside and just outside; and the telegraph duration is authored configuration, proven by a test that reads it from the config rather than the renderer. All four routine gates, plus `npm run test:e2e -- --grep "<the renderer test you touched>"` if you changed a Playwright pixel check.

**Acceptance:** the `lob` kind travels to a resolved destination and arrives exactly on time, does not collide in flight, detonates once into an area through the shared hit path, is telegraphed from authored configuration, every pre-existing assertion passes unchanged, and all four gates pass.

**Execution and verification - 2026-10-27**

Added `ShardState.detonationTargetTiles: Vector2 | null`. In `simulation/geometry.ts`, added the narrowest new primitive, `convexBodyOverlapsCircle` (distinct from the existing `convexBodyFitsCircle`, which asks "is the body entirely inside"), with its own 7-case focused test (center inside, exact boundary contact, just inside, just outside, far outside, and the two radius-validation rejections). Discovered and fixed a latent sign bug while writing that test: `validatedAxes`' per-edge axis is the polygon's *inward* normal for this project's winding (confirmed algebraically from the existing convexity-winding check), so the new point-in-polygon helper's inequality had to be `projection >= -tolerance`, not `<= tolerance`.

In `config/data.ts`: added the `lob` case to `AuthoredProjectileMotion` and `validateProjectileMotion` (positive `travelSeconds` and `detonationRadiusTiles`; rejects authored `rangeTiles`, `lifetimeSeconds` or `reversalAgeSeconds`). Added a `presentation` block to `AuthoredEncounter`/`validateEncounterData` carrying `lobTelegraphSeconds` (authored in `encounter.json` as `0.3`, explicitly marked `trainer-authored` in its comment since the source gives no telegraph timing). `config/encounter.ts`: widened `ProjectileMotion`, `EncounterConfig.presentation`, `lifetimeSecondsOf` (lob's lifetime is `travelSeconds` directly) and `validateProjectileSpec`'s dispatch; `validateEncounterConfig` now asserts `lobTelegraphSeconds` positive alongside the other presentation/session values.

In `simulation/projectiles.ts`: `resolveShardLifetime` gained the `lob` case (`reversalAgeSeconds: Infinity`, same mechanism as every other non-reversing kind). Added `resolveLobDestination` (the two cases from the prompt: player-aimed and clamped, or direction-based from `speedTilesPerSecond * travelSeconds`) and widened `createShard` with an optional fifth `aimPlayerPositionTiles` parameter that only a `lob` projectile reads; no existing call site passes it, so no shipped or future-authored attack aims yet - that capability is authored, not wired to any pattern, matching 19.1-19.4's "additive, not authored into an attack" precedent. A lob shard's velocity is set directly to `(target - start) / travelSeconds`, reusing the existing straight-line position-integration branch in `moveShard` unchanged - no third position-update code path was needed. `moveShard` gained one new branch: while a lob shard's age-at-segment-end is below its `lifetimeSeconds`, it skips `shardOverlapsPlayer` entirely (true "no collision in flight," not a zero-size body); at the exact tick its age reaches `lifetimeSeconds` - guaranteed exact by the existing boundary-snapping in `advanceShard`, which this code reuses verbatim - it instead tests `convexBodyOverlapsCircle` against the player's body at that step's (possibly sub-step-interpolated) position. Returning `hitPlayer` from that one new branch means detonation damage flows through `simulation.ts`'s existing `registerShardHit` call site unchanged - exactly one damage/feedback route for every projectile kind, as required.

`phaser/encounter.ts` draws a lob shard's body identically to any other (no change needed to the existing per-shard draw loop) and additionally strokes the detonation circle's outline once `shard.ageSeconds >= shard.lifetimeSeconds - config.presentation.lobTelegraphSeconds`, reading the duration from config rather than a literal.

Did not author a Killer Bee Queen bomb; did not add sub-stepping.

Tests: `geometry.test.ts` +7 (`convexBodyOverlapsCircle`). `data.test.ts` +6 (`lob` accept/reject cases: missing/nonpositive `travelSeconds`/`detonationRadiusTiles`, authored `lifetimeSeconds`/`reversalAgeSeconds`/`rangeTiles` rejected). `config.test.ts` +1 (the telegraph duration is read from `ENCOUNTER_CONFIG.presentation`, and a zero value is rejected by `validateEncounterConfig` - proving it is configuration, not a renderer literal). `projectiles.test.ts` +9: exact arrival for a near (player-aimed, unclamped) and far (clamped) destination, a direct-line shard passing through the player in flight registering no hit, a detonation that overlaps the player registering exactly one hit and expiring, a detonation that misses applying nothing, and a shard near the player mid-flight (before `travelSeconds`) still not detonating. `simulation.test.ts` +2: a full `advanceSimulation` integration proving a lob shard's detonation produces exactly one `AcceptedHit` and reduces `player.healthHp` (the shared `registerShardHit` path), with zero hits throughout its flight, and a second case where the detonation misses and nothing is applied.

Checks run from `app/`: `npm run lint` (pass), `npm run typecheck` (pass), `npm run test` - 420/420 passed across 12 files (402 pre-existing + 18 net new, zero removed or weakened), including the 671-volley, 30/60/120 Hz equivalence and fixed-input reproducibility assertions unchanged. `npm run build` (pass). `npm run test:e2e -- --grep "pursue, fire, reverse, register hits"` (1 passed) - no Playwright test exercises a lob visually (none ships yet) and no existing pixel check was touched, so this is the same substitute live-shard-path test used for 19.2-19.4.

**Phase 19 complete.** The projectile catalog and all five motion kinds (`boomerang`, `linear`, `turning`, `wavy`, `lob`) are implemented, validated at load time with provenance and the path-deviation invariant, and proven behaviour-identical for the shipped Crystal Worm encounter throughout.

## Phase 20: Emission Patterns And Concurrent Attacks

### Step 20.1 - Re-Express The Emitter Ring As A Pattern

Status: pending. Dependencies: 19.5.

**Implementation prompt**

Behaviour-identical refactor. The Crystal Worm's rotating emitters become the first case of a general emission pattern. No shipped gameplay value may change.

Create `app/src/game/simulation/patterns.ts` owning one pure operation:

```ts
resolveBearings(pattern, context): readonly { bearingRadians: number; emitterRadiusTiles: number }[]
```

where `context` carries what a pattern may read: the firing enemy's position, the player's position, the attack clock's current `ringPhaseRadians`, the volley index within the burst, and the number of bursts already fired. It returns one entry per shot in this volley. It must be pure: no mutation, no clock reading, no randomness in this step.

Implement only `kind: "ring"` with the fields the Crystal Worm needs: `arms`, `emitterRadiusTiles`, `initialPhaseDegrees` and `clockwiseDegreesPerSecond`. Its bearings are `ringPhaseRadians + armIndex * 2 * pi / arms`, which is exactly what `updateEnemyAttacks` computes inline today. Leave `perBurstAdvanceDegrees`, `gapSectorsDegrees`, `armSpreadDegreesPerSecond` and `maxArmSpreadDegrees` out entirely; step 20.5 adds them.

In `enemies.json`, replace the archetype's `weapon.emitters` and `weapon.burst` blocks with a single `attacks` array holding one entry, shaped as the plan's Target Data Shapes section shows: `id` `"spiral-shards"`, `projectile` `"crystal-worm-child-shard"`, `tuningSource` `"approved-v3"`, a `ring` pattern carrying arms 6, emitter radius 0.35, initial phase 0 degrees and 45 clockwise degrees per second, and a `cadence` carrying shots-per-burst 11, shot interval 0.19, cooldown-after-last-shot 3 and initial delay 2. Note the rename: the authored `rotateDuringCooldown: true` disappears, because rotation is a continuous function of elapsed time and was never actually gated by the burst - assert that in a test rather than keeping a field that only ever held one value.

Extend `config/data.ts` with `validateAttack`, exported for direct testing: require a nonempty `id` unique within the archetype, a `projectile` key present in the catalog, a `tuningSource` that is one of `"approved-v3"`, `"wiki-prose"` or `"trainer-authored"` - **reject an attack with no `tuningSource`**, per K13 - a `pattern` whose `kind` is `"ring"`, and a `cadence` with a positive integer `shotsPerBurst`, a positive `shotIntervalSeconds`, a positive `cooldownAfterLastShotSeconds` and a nonnegative `initialDelaySeconds`. Reject any other pattern kind in this step.

Update `encounter.ts` so the archetype's whole `weapon` object is replaced by `attacks: readonly AttackSpec[]` directly on the archetype - the `projectileId` that step 19.2 put on `weapon` moves onto each attack entry - and route the existing `TuningValues` keys `emitterCount`, `emitterRadiusTiles`, `initialPhaseDegrees`, `rotationDegreesPerSecond`, `shotsPerEmitter`, `shotIntervalSeconds`, `cooldownSeconds` and `initialCooldownSeconds` into the single authored attack, so the debug sliders keep working through the one existing builder. Update `updateEnemyAttacks` in `simulation.ts` to read the attack spec and call `resolveBearings` instead of computing bearings inline. Keep `liveShardBoundPerEnemy` correct against the new shape; for the shipped v3 cadence it must still derive 66.

Do not add a second attack, a second pattern kind, or per-attack clocks; step 20.2 owns the clock change.

**Focused checks:** focused failing test on `resolveBearings` with a `ring` pattern first. Then: six bearings at exactly 60-degree spacing from a given ring phase; the emitter radius is returned unchanged; `validateAttack` accepts the authored attack and rejects a duplicate id, an unknown projectile, an absent `tuningSource`, an unknown pattern kind and each nonpositive cadence value; rotation is proven continuous across a cooldown, replacing the retired `rotateDuringCooldown` field; `liveShardBoundPerEnemy` still derives 66. Then prove behaviour identity: the 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must pass **unchanged**. All four routine gates, plus `npm run test:e2e -- --grep "volleys"`.

**Acceptance:** emission bearings come from a pure `resolveBearings` with a `ring` pattern, the authored weapon is an `attacks` array, `tuningSource` is mandatory, the debug registry still drives one builder, every pre-existing timeline assertion passes unchanged, and all four gates pass.

### Step 20.2 - Give Each Attack Its Own Clock

Status: pending. Dependencies: 20.1.

**Implementation prompt**

Behaviour-identical refactor, and the structural change the whole boss depends on. One enemy must be able to run several attacks at once, each on its own cadence. The Crystal Worm has exactly one attack, so nothing observable may change.

This is the same move step 16.1 made from global to per-enemy state, one level deeper. Today `EnemyState` holds one attack clock in seven fields: `attackEpochSeconds`, `volleysAtEpoch`, `attackInitialDelaySeconds`, `rotationEpochSeconds`, `rotationPhaseAtEpoch`, `volleysFired` and `emitterPhaseRadians`. Move all seven into a new `AttackClockState` keyed by `attackId`, and give `EnemyState` an `attackClocks: AttackClockState[]` built from its archetype's `attacks` in authored order. Rename `emitterPhaseRadians` to `ringPhaseRadians` while moving it, since it is now a pattern's phase rather than an emitter's.

Build the clocks in `createEnemy`, one per authored attack, each anchored at the enemy's `spawnedAtSeconds` and each taking its own `initialDelaySeconds` from its own cadence. Split `updateEnemyAttacks` into a loop over clocks and a per-clock `updateAttackClock(state, enemy, attack, clock)` holding the arithmetic that exists today: advance the ring phase from the rotation epoch, compute the burst-group span, resolve the next shot time from the epoch plus the initial delay plus the group and shot offsets, return early if it is not yet due, otherwise resolve bearings and push one shard per bearing, then increment `volleysFired`.

Iterate attacks in authored order and push shards in bearing order, so a fixed input sequence stays reproducible and shard ids remain stable. Update `setDebugSettings` to re-epoch **every clock of every enemy**, preserving today's semantics exactly: a rotation or initial-phase change re-epochs rotation, a cadence change re-epochs the attack clock and sets `initialDelaySeconds` to the initial cooldown when no volley has fired yet and to the shot interval otherwise. Update `inspect()` to expose per-attack clocks while keeping the aggregate `volleysFired` total the Playwright suite already asserts, and update the `Inspection` type accordingly.

Do not add a second attack to any archetype. Do not change cadence, positions, damage or death times.

**Focused checks:** focused failing test that `createEnemy` produces one clock per authored attack and that no clock field remains on `EnemyState` first. Then: a two-attack archetype built through a test-file-local helper fires both on independent cadences, with the slower one still at zero volleys while the faster has fired; shard ids are unique and ordered by attack then bearing; the debug re-epoch is applied to every clock; and the aggregate `volleysFired` in `inspect()` equals the sum across clocks. Then prove behaviour identity: the 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must pass **unchanged**. All four routine gates, plus `npm run test:e2e -- --grep "volleys"`.

**Acceptance:** attack clocks are a per-attack collection, a multi-attack archetype fires each on its own cadence in a test, the debug re-epoch covers every clock, the Crystal Worm still has exactly one attack with an identical timeline, and all four gates pass.

### Step 20.3 - Add The Aimed Spread Pattern

Status: pending. Dependencies: 20.2.

**Implementation prompt**

Add the pattern the source calls a "directed spread", a "3-way spread" and a "shotgun": a fan of shots over an arc, either aimed at the player or fixed in the world. Additive; no shipped attack uses it yet.

Implement `kind: "spread"` in `resolveBearings` with `shots`, `arcDegrees`, `aim`, `fixedBearingDegrees` and `emitterRadiusTiles`. The arc is **centred** on the aim bearing: with `shots` of 3 over 24 degrees the bearings are the centre minus 12, the centre, and the centre plus 12. With `shots` of 1 the single bearing is the centre exactly, regardless of `arcDegrees`. With `aim: "player"` the centre is `atan2` of the player's position minus the firing emitter's position; with `aim: "fixed"` it is `fixedBearingDegrees` converted to radians.

`resolveBearings` must stay pure. The player's position is already available on the context object step 20.1 defined; read it from there rather than reaching into simulation state. Where the aim bearing is undefined - the player standing exactly on the firing point - fall back to the attack clock's current `ringPhaseRadians` rather than drawing a random value, so this pattern introduces no new randomness. That mirrors the existing spawn-placement decision G12 in spirit while keeping step 20.4's seeded generator as the only source of randomness.

Note for later authoring, not for implementation here: the source's phase 1 remark that "it may sometimes look like the Queen is firing only 3 stingers, but in fact that is 9 shots with each color stinger stacked ontop of each other" is expressed as **three separate `spread` attacks sharing one cadence**, one per projectile colour, not as a single pattern that fires three projectile types. Keep one projectile per attack.

Extend `validateAttack` to accept `kind: "spread"` with a positive integer `shots`, a nonnegative `arcDegrees`, an `aim` of exactly `"player"` or `"fixed"`, a finite `fixedBearingDegrees` when and only when `aim` is `"fixed"`, and a nonnegative `emitterRadiusTiles`. Reject `arcDegrees` of 360 or more, which would make the fan wrap onto itself; a full circle is a `ring`, not a `spread`.

**Focused checks:** focused failing test on a 3-shot 24-degree spread's bearings first. Then: the arc is centred, asserted on all three bearings; a 1-shot spread fires exactly on the aim bearing; an even shot count is still symmetric about the centre; `aim: "player"` tracks a moving player across two volleys; `aim: "fixed"` ignores the player entirely; the degenerate player-on-emitter case falls back to the ring phase and is deterministic across runs; `validateAttack` rejects a zero or fractional `shots`, an `arcDegrees` of 360, an unknown `aim`, and a `fixedBearingDegrees` present with `aim: "player"`. Prove no existing behaviour changed. All four routine gates.

**Acceptance:** the `spread` pattern produces centred, correctly aimed fans, stays pure and deterministic with no new randomness, validation covers every rejection case, nothing pre-existing changed, and all four gates pass.

### Step 20.4 - Add The Scatter Pattern And Extend Seeded Randomness

Status: pending. Dependencies: 20.3.

**Implementation prompt**

Add the pattern behind the source's "messy omnidirectional spray" and "messy bombardment" attacks, and extend the project's seeded randomness to cover it. Additive; no shipped attack uses it yet.

Implement `kind: "scatter"` with `shots`, `coneDegrees`, `aim`, `fixedBearingDegrees` and `emitterRadiusTiles`. Each shot's bearing is drawn uniformly within `coneDegrees` centred on the aim bearing, resolved the same way `spread` resolves it. A `coneDegrees` of 360 is the omnidirectional case and is explicitly allowed here, unlike `spread`.

This is the step that implements K11, so get the determinism right and treat it as the step's real deliverable:

- `resolveBearings` must stay pure. Do not let it reach into simulation state for randomness. Pass the draws in: have the caller take `shots` values from the generator and hand them to `resolveBearings` as part of its context, or have `resolveBearings` accept an explicit `nextUnitRandom` function. Choose one and say which in your execution record; do not introduce both.
- Draws happen only inside a fixed step, in `updateAttackClock`, in authored attack order and then shot order, advancing `state.randomSeed` through the existing `nextSeed` and `unitFromSeed` helpers in `simulation/random.ts`. `Math.random` must not appear anywhere in the simulation.
- The generator cursor stays plain data on `SimulationState`, so the state remains `structuredClone`-able, exactly as G13 established.

The hard requirement: **the same seed and the same input sequence must produce an identical run however many fixed steps a single update executes.** Spawn placement already draws from this generator, so a scatter attack firing in the same tick as a spawn must consume draws in a defined order. Fix that order explicitly - spawns resolve before attacks within a tick today, and that stays true - and test it.

Extend `validateAttack` to accept `kind: "scatter"` with a positive integer `shots`, a `coneDegrees` greater than zero and at most 360, and the same `aim` rules as `spread`.

**Focused checks:** focused failing test that two simulations with the same seed produce identical scatter bearings first. Then: every drawn bearing lies within the cone; a 360-degree cone covers the full circle over enough draws; the same seed reproduces bearings exactly while a different seed does not; a run advanced in one 10-step update matches a run advanced in ten 1-step updates, bearing for bearing and shard id for shard id; a scatter attack firing in the same tick as a timed spawn consumes draws in the documented order and both outcomes are reproducible; and `grep` over `app/src/game` finds no `Math.random`. All four routine gates.

**Acceptance:** the `scatter` pattern draws bearings from the injected seeded generator only, `resolveBearings` is still pure, draw order is defined and tested across step batching, no `Math.random` exists in the simulation, nothing pre-existing changed, and all four gates pass.

### Step 20.5 - Add Ring Gaps, Per-Burst Advance And Arm Spread

Status: pending. Dependencies: 20.4.

**Implementation prompt**

Complete the `ring` pattern with the three options the Killer Bee Queen's later phases need, so that no separate "radial", "spiral" or "machinegun" pattern kind is ever introduced. Additive; no shipped attack uses them yet.

Add three optional `ring` fields, each defaulting to the behaviour the Crystal Worm has today when absent or zero:

- `perBurstAdvanceDegrees`: the ring's phase additionally advances by this many degrees per completed burst. This expresses the source's phase 7 detail that the Queen fires "4 White Bombs ... at a 15 degree-increasing angle each time". It composes with `clockwiseDegreesPerSecond` rather than replacing it; a static radial burst that steps round is `clockwiseDegreesPerSecond: 0` with a nonzero advance.
- `gapSectorsDegrees`: an array of `[fromDegrees, toDegrees]` sectors, measured in the ring's **own rotating frame** so a gap travels with the pattern. An arm whose bearing falls inside any sector fires nothing this volley. This expresses the source's phase 6 detail that the rotating shot-machinegun has "two gaps in the rotation", which are the openings the player survives in.
- `armSpreadDegreesPerSecond` with `maxArmSpreadDegrees`: the angular offset between arms grows from zero at the attack's start up to the maximum, then holds. This expresses the source's phase 6 detail that the attack "is initially aimed at the top and bottom of the room and will expand over the first few seconds to cover the top-right and bottom-left corners". Measure the elapsed time from the attack clock's epoch, not from the simulation start, so a re-entered phase behaves the same way.

Record the mapping in a comment next to the pattern type, so a later reader does not reinvent the missing kinds: a spiral is a ring with a nonzero rotation rate; a static radial burst is a ring with a zero rotation rate; phase 6's machinegun is a ring with `arms: 2`, a high rotation rate, two gap sectors and an arm spread.

Extend `validateAttack`: `perBurstAdvanceDegrees` finite and optional; `gapSectorsDegrees` an array of two-element finite pairs, each sector narrower than 360 degrees, with the **total** gap coverage strictly less than 360 so an attack can never be silenced entirely; `armSpreadDegreesPerSecond` finite with `maxArmSpreadDegrees` present and nonnegative whenever it is nonzero. Reject an arm spread that would carry two arms onto the same bearing.

A ring with all three fields absent must resolve bearings identically to step 20.1's implementation. Prove that, do not assume it.

**Focused checks:** focused failing test on a ring with a 15-degree per-burst advance first. Then: the advance accumulates per completed burst and not per shot; a gap sector suppresses exactly the arms inside it and no others; a gap rotates with the ring, proven by the same arm being suppressed and then not suppressed as the phase advances; arm spread grows linearly from zero and clamps at the maximum; spread is measured from the clock epoch; a ring with all three absent produces bearings byte-identical to 20.1; validation rejects total gap coverage of 360 degrees, a malformed sector pair, an arm spread without a maximum, and a spread that collides two arms. Then prove behaviour identity on the Crystal Worm: the 671-volley assertion, the 30/60/120 Hz equivalence test and the fixed-600-tick reproducibility test must pass **unchanged**. All four routine gates.

**Acceptance:** `ring` covers spiral, radial and gapped rotating-machinegun attacks through three optional fields, the absent-field case is proven identical to 20.1, validation prevents a fully silenced or self-colliding ring, the Crystal Worm timeline is unchanged, and all four gates pass.

## Phase 21: Player Conditions And The Damage Model

### Step 21.1 - Add Condition State, Application And Ticking

Status: pending. Dependencies: 20.5.

**Implementation prompt**

Give the player status conditions. This step adds the state and its lifecycle only; no condition yet changes movement or damage, and no shipped projectile applies one.

Create `app/src/game/simulation/conditions.ts`. Define the full key set from [the source extract](docs/killer-bee-queen-source.md)'s status table, all thirteen that the Queen can inflict:

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

### Step 21.2 - Apply The Movement Conditions

Status: pending. Dependencies: 21.1.

**Implementation prompt**

Make Paralyzed, Slowed and Confused change how the player moves. These are the three conditions that directly change dodging, so they are the heart of what this boss teaches.

Each rule comes from the source's status table, quoted in [the source extract](docs/killer-bee-queen-source.md), and each maps onto this project's existing movement derivation in `config/stats.ts`:

- **Paralyzed** - "Renders entity completely immobile." The player's travel this step is zero. Input is still read and still has no effect; do not freeze the simulation, the camera or anything else.
- **Slowed** - "Reduces player SPD to 0 during movement speed calculation, resulting in a base speed of 4 tiles/second." Do not author 4 as a literal. Derive it by running the existing `derivePlayerStats` with the Paladin's speed stat replaced by zero, which yields `STAT_RULES.movement.baseTilesPerSecond` exactly. Compute it once as a module constant and assert in a test that it equals 4 and that it is strictly less than the Paladin's 7.0613 tiles per second.
- **Confused** - "Changes controls by swapping directional controls... Left > Down, Down > Left, Right > Up, Up > Right." Apply this as a transform on `SimulationInput` before the direction vector is built: west becomes south, south becomes west, east becomes north, north becomes east. Transform the input, do not negate the resulting vector - a sign flip is a different and wrong effect. Note that this mapping is its own inverse, so applying it twice returns the original input; assert that.

Implement these as a single `playerTravelTiles(player, stepSeconds)` and a single `effectiveInput(player, input)` in `conditions.ts`, called from `updateMovement` in `simulation.ts`. Paralyzed takes priority over Slowed, since zero speed is already the stronger effect; the published rule that Slowed "nullifies the effects of Speedy" has no referent here because no positive conditions exist.

These conditions affect the **player only**. Enemy movement is untouched: nothing in this encounter slows or paralyses an enemy, and the player cannot attack. Do not add condition state to `EnemyState`.

No shipped projectile applies a condition yet, so apply these in tests by setting `conditionSeconds` directly on a simulation state.

**Focused checks:** focused failing test that a paralysed player does not move first. Then: a paralysed player holding every direction stays exactly in place for the whole duration and moves again on the first step after expiry; a slowed player travels exactly `4 * stepSeconds` per step and the derived constant equals 4 and is below 7.0613; paralysed plus slowed moves zero; each of the four confused mappings is correct, applied to a single direction and to a diagonal; the confused transform applied twice is the identity; the diagonal normalisation still holds under confusion, so a confused diagonal is no faster than a straight line; and arena containment still holds under every combination. Confirm nothing pre-existing changed. All four routine gates.

**Acceptance:** Paralyzed, Slowed and Confused change player movement exactly as the source specifies, the slowed speed is derived rather than authored, the confused mapping is the published one and is self-inverse, enemies are unaffected, nothing pre-existing changed, and all four gates pass.

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

Implement K17. The archetype has carried `contactDamageHp` and `blocksPlayer` since step 15.3, validated and asserted to be `0` and `false`, with no behaviour behind them. The Small Worker Bee needs them: its only attack is an invisible projectile at speed 0 and range 0, and [the source extract](docs/killer-bee-queen-source.md) records its behaviour as "Charges at player attempting to do contact damage" for 40 armour-piercing damage and Slowed for 1.6 seconds.

Extend the archetype's contact block to carry what a touch attack needs: `contactDamageHp`, `contactConditions` shaped exactly like a projectile's `conditions`, `contactArmorPiercing` and `contactCooldownSeconds`. The cooldown is essential - without it an overlapping enemy would apply damage sixty times a second - and it is `trainer-authored`, because the source gives no rate. Track the next eligible contact time per enemy in `EnemyState`, not globally, so two touching enemies each hit on their own schedule.

Resolve contact once per fixed step, after enemy movement and before shard advance, so a chasing enemy's new position is the one tested. Use the existing swept convex overlap between the enemy's body and the player's body across the step, exactly as shards do - **not** a cheaper distance check, because a fast-charging minion must not tunnel through the player between steps. Route an accepted contact through the same `registerShardHit` path that projectiles use, so damage, conditions, the condition-aware defence formula from step 21.3, the hit audio and the floating damage number all behave identically. Where that path needs a shard id, pass a stable synthetic identity derived from the enemy id rather than minting a fake shard.

Contact damage is **not** once-per-enemy: it repeats on its cooldown for as long as the bodies overlap. That is the opposite of the per-shard rule and is correct - it is the pressure that makes a charging minion dangerous. Make the difference explicit in a comment so a later reader does not "fix" it into once-only.

Leave `blocksPlayer` behaviour out of this step. No enemy in this encounter blocks, G16 says enemies pass through each other, and implementing collision pushback is a separate mechanic with its own design questions. Keep the field validated and keep asserting it is `false`.

The Crystal Worm keeps `contactDamageHp: 0`, and `validateEncounterConfig` must keep asserting it, so a zero contact damage must mean "no contact attack at all" rather than "a zero-damage hit on a cooldown". Short-circuit before the overlap test when contact damage is zero and there are no contact conditions, both for correctness and to keep the per-tick cost off encounters that do not use it.

**Focused checks:** focused failing test that an overlapping contact-damaging enemy damages the player first. Then: contact applies on the cooldown and not every step, asserted on hit count over a known duration; it repeats while overlapping, unlike a shard; it stops when the bodies separate and resumes when they overlap again; two overlapping enemies hit on independent schedules; contact conditions are applied through the same path, proven by a contact that applies Slowed and measurably halves the player's travel; `contactArmorPiercing` goes through step 21.3's formula, so 40 armour-piercing damage deals 40 rather than 8; a fast enemy crossing the player within one step still registers, which is the tunnelling regression test; an archetype with zero contact damage and no contact conditions never runs the overlap test; and the Crystal Worm's zero-contact assertion still holds with every pre-existing assertion unchanged. All four routine gates.

**Acceptance:** enemies with authored contact damage hit the player on a cooldown through the shared hit path, the swept test prevents tunnelling, contact conditions work, the repeat-versus-once-only difference is documented, `blocksPlayer` is untouched, zero-contact archetypes short-circuit, and all four gates pass.


## Phase 22: Enemy Health, Phases And Movement Behaviours

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

## Phase 23: Author The Killer Bee Queen Of The Nest

Every step in this phase authors data against machinery that already exists and is already tested. If a step needs a new pattern field, a new motion kind or a new phase feature, that is a signal the machinery is incomplete: **stop and report it** rather than extending the engine inside an authoring step.

Three rules apply to all ten steps:

1. **Cite every number.** A projectile entry's `source` names its row number in [the source extract](docs/killer-bee-queen-source.md). An attack's `tuningSource` is `"wiki-prose"` when the source states the attack's shape, or `"trainer-authored"` when this project invented the number. That is K13, and the loader enforces it.
2. **Author a projectile only when a phase fires it.** No `Plagued Nest only` row enters `projectiles.json` (K07), and no row is added speculatively.
3. **Record each phase's fidelity gaps** in that step's execution record: what the source describes that this phase does not do, and why.

### Step 23.1 - Add Encounter Selection And The Cleared Outcome

Status: pending. Dependencies: 22.5.

**Implementation prompt**

Make more than one encounter exist. Until this step, `encounter.json` describes the one and only encounter; the Queen needs her own arena policy, spawn policy, rules version and history. K14 settles the selection surface: a plain list on the Home screen.

Restructure the authored data so encounters are a keyed collection: each entry owns its `rulesVersion`, `primaryArchetype`, arena reference, `spawns` rule, `session` values and its display name. The Crystal Worm encounter keeps `crystal-worm-child-swarm-paladin-v4` and every one of its current values unchanged. Add the Queen's encounter entry with `killer-bee-queen-nest-paladin-v5`, its `primaryArchetype` pointing at an archetype that step 23.2 will author, and a `spawns` rule that creates exactly one enemy at `t = 0` and never again - the Queen is a single boss, not a swarm, so `maxConcurrent` is 1 and no repeat cadence applies. Validate that shape rather than relying on a large `everySeconds`.

**Fix F5 here, because this is the step that makes it a real defect.** `constrainToArena` and `advanceSimulation` read the module-level `ENCOUNTER_CONFIG` for the arena and the fixed step instead of reading `state.config`. That is harmless while every simulation shares one encounter and becomes wrong the moment two encounters differ. Change both to read `state.config`, and add a test that two simulations built from different encounter configs each use their own arena. Do not fix the other open principles-review findings; they stay in [the deferred register](docs/deferred-work.md) as D09.

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

The three Killer Bees are **already transcribed** in [the source extract](docs/killer-bee-queen-source.md)'s Minion Source Extracts section (K16); author from it and do not re-fetch. All three are 400 HP, 25 defence, levitating, and all three behave identically: *"Chases players while firing single shots at them."* Their single attacks differ: Red fires `EH Red Stinger Small` at 80 damage, 7 tiles per second, 10.5 tiles range, armour-piercing, no condition; Blue fires `EH Blue Stinger Small` at 100 damage, 7.5, 9.75, Silenced for 3 seconds; Yellow fires `EH Yellow Stinger Small` at 130 damage, 6, 10.5, no condition. Note that these are **not** the Queen's own stinger rows - the damage, speed and range all differ - so they need their own catalog entries rather than reusing hers.

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

The Nest and the Small Worker Bee are **already transcribed** in [the source extract](docs/killer-bee-queen-source.md)'s Minion Source Extracts section (K16); author from it. Its page slug is `killer-bee-nest-queen`, not `killer-bee-nest`, which is an unrelated stub.

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

The three Adolescent Beehemoths are **already transcribed** in [the source extract](docs/killer-bee-queen-source.md)'s Minion Source Extracts section (K16). All three are 20,000 HP, 40 defence, levitating, and all three behave the same way: *"Fires pairs or spreads of large stingers at the nearest player. During the Killer Bee Queen's final phase, fires radial bursts of large stingers and spreads of Glaives"* - orbs rather than glaives for the red one. Their stats: Red fires `EH Red Stinger Large` at 100 damage, speed 6, range 10.5, Armor Broken for 4 seconds, plus `EH Red Ball` at 60, 7, 10.5, Curse for 2 seconds; Blue fires `EH Blue Stinger Large` at 120, 6.5, 9.75, Weak and Pet Stasis, plus `EH Blue Glaive` at 60, 7.5, 10.5, Quiet for 3 seconds; Yellow fires `EH Yellow Stinger Large` at 150, 7, 9.8, Dazed for 2 seconds, plus `EH Yellow Glaive` at 80, 5, 8.5, Paralyzed for 0.8 seconds. None of these match the Queen's same-named rows, so all six need their own catalog entries - and note that the yellow glaive is the only Beehemoth shot that paralyses, which makes it the one the player must actually dodge.

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

## Phase 24: Bounds, Tuning, Regression And Handoff

### Step 24.1 - Re-Derive And Re-Measure The Performance Bounds

Status: pending. Dependencies: 23.10.

**Implementation prompt**

The v4 bound was derived for one archetype with one attack: `liveShardBoundPerEnemy(archetype)` computed `emitterCount * shotsPerEmitter * ceil(lifetimeSeconds / burstGroupSeconds)`, giving 66 per enemy and a measured peak of 264 with four enemies. The Queen has up to eight concurrent attacks, several minions each with their own attacks, and projectile lifetimes up to 4.252 seconds. That formula no longer describes the system.

Re-derive the bound from configuration, never from a literal:

- Per attack: `shotsPerVolley * shotsPerBurst * ceil(projectileLifetimeSeconds / burstGroupSeconds)`, where `shotsPerVolley` comes from the attack's pattern - `arms` for a `ring`, `shots` for a `spread` or `scatter` - and `burstGroupSeconds` is the existing `(shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds`.
- Per phase: the sum over the phase's attacks plus the maximum over its sub-phases, since only one sub-phase is ever active.
- Per archetype: the maximum over its phases.
- Per encounter: the archetype bound times `maxConcurrent`, plus each possible minion's bound times `maxConcurrentMinions`.

Replace `liveShardBoundPerEnemy` with this derivation, keeping it a function rather than a stored field so it cannot go stale. Assert the Crystal Worm still derives **66**, which proves the generalisation is a superset rather than a replacement.

Then measure, in the browser, at the pinned toolchain, and report real numbers rather than estimates:

- Peak live shards and peak live enemies over a full Queen fight from phase 1 to cleared, and separately over a 60-second drill of phase 3 and a drill of phase 6, which are the two densest phases.
- Sustained frame timing over each of those runs, compared against the v4 figures recorded in step 17.4's execution record in [the v4 archive](docs/implementation-plan-v4.md).
- Whether `maxStepsPerUpdate` of 8 is still sufficient, or whether the catch-up path now discards time during the dense phases. If it discards, report it as a finding with the measurement; do not raise the limit as a fix without the user's approval, because a higher limit changes the simulation's timing guarantees.

If a measured peak exceeds the derived bound, the derivation is wrong - fix the derivation. **Never widen or delete a bound to make a run pass.** If the frame timing is materially worse than v4, report it with numbers and a diagnosis; a renderer optimisation is a separate, approved step, not something to bundle here.

**Focused checks:** focused failing test on the per-attack derivation first. Then: the Crystal Worm still derives 66; a two-attack archetype's bound is the sum of its attacks; a phase with sub-phases uses the maximum rather than the sum across them; the encounter bound includes minions; and a measured run's peak never exceeds the derived bound, asserted as a test rather than only reported. All four routine gates, plus the full `npm run test:e2e` since this step is explicitly a measurement step.

**Acceptance:** the shard bound is derived from configuration for multi-attack, multi-phase and minion-bearing archetypes, the Crystal Worm still derives 66, measured peaks and frame timings for the full fight and both dense drills are reported against the v4 baseline, any catch-up discarding is reported rather than papered over, and all gates pass.

### Step 24.2 - Tune The Fight For Trainability

Status: pending. Dependencies: 24.1.

**Implementation prompt**

Every cadence authored in phase 23 was deliberately generous. This is the step K04 reserved for tightening them, now that every mechanic exists and can be measured together.

This is a **tuning** step, not a feature step. Change only `trainer-authored` values: shot counts, shot intervals, cooldowns, arc widths, gap widths, bomb travel times, sub-phase durations, minion counts and the progression rate. Do **not** change a value marked `wiki-prose` or `approved-v3`, do not add an attack, a projectile, a pattern field or a motion kind, and do not change any sourced projectile stat. If a phase cannot be made trainable without one of those, that is a finding to report, not a licence.

Tune toward stated targets rather than feel, and record the measurement for each:

- Every phase must be survivable by a competent player with correct movement, and must not be survivable by standing still. Demonstrate both ends with scripted runs.
- Phase 6's machinegun gaps must leave a provably survivable opening for the full 29 seconds, which step 23.8 already asserts; tightening them must not break that assertion.
- The full fight's total length should land where K15's 375 HP per second implies, within a few seconds. If tuning the cadences changes the natural length, adjust the progression rate rather than distorting individual phases.
- No phase should be trivially survivable by standing in one place away from the Queen, which is the failure mode a static 19.2-tile arena invites given D01.

Present the before-and-after value for every number you change, in a table, with the reason. A tuning step whose record is "adjusted for difficulty" is not acceptable; each change needs a measurement or an observation behind it.

Bump the Queen's encounter `rulesVersion` if and only if tuning changes gameplay enough to invalidate comparison with attempts recorded before this step. Given that this is the first tuning pass over a brand-new encounter, it almost certainly does: use `killer-bee-queen-nest-paladin-v5` through step 23 and advance the suffix here, retaining earlier records and excluding them from the new bests exactly as G19 did for v4.

**Focused checks:** the scripted survivable and non-survivable runs per phase, each asserted; the phase 6 gap-survivability assertion unchanged; the measured full-fight length; a test that no `wiki-prose` or `approved-v3` value changed, implemented by asserting the sourced projectile stats against the source extract's table; and the retained-best exclusion for the previous rules version. All four routine gates, plus the full `npm run test:e2e`.

**Acceptance:** every phase is demonstrably survivable with correct play and lethal when stationary, only `trainer-authored` values changed, each change is justified with a measurement in a before-and-after table, the rules version is advanced with history retained and excluded, and all gates pass.

### Step 24.3 - Run The Full Acceptance Matrix

Status: pending. Dependencies: 24.2.

**Implementation prompt**

Verify the whole product, not just the new encounter. Add no features. Fix only defects this step finds, and report anything that needs a design decision rather than deciding it.

Run and record, on the pinned toolchain in `.node-version` (24.22.1) with `npm@12.2.1`:

- All four routine gates, with the actual test count and timing.
- The full `npm run test:e2e` suite in Chromium, with its case count and timing.
- **Crystal Worm regression.** Its encounter must behave exactly as the v4 release did: same cadence, same positions, same death times, the 671-volley assertion, and the 30/60/120 Hz equivalence. This is the proof that nineteen steps of engine generalisation cost the existing content nothing.
- **Determinism.** The same seed and input sequence reproduces a full Queen fight identically, including every scatter bearing, every wander target and every spawn placement, at 30, 60 and 120 Hz and under both one-step and multi-step updates.
- **Storage compatibility.** A v1, v2, v3 and v4 attempt record each still load, appear under the Crystal Worm encounter, and are excluded from the Queen's bests. A Queen record and a drill record round-trip correctly. Corrupt and absent records still degrade safely through the existing adapter.
- **Session safety.** Pause, resume, retry with R, the Controls dialog, zoom persistence and the countdown all behave identically in both encounters and in drill mode, with no background time catch-up while paused.
- **Both encounters end to end in a browser**, including a cleared Queen run reaching the win screen and a death run reaching the results screen.

Then collect the honest limitations in one place: every fidelity gap from phase 23's records, every unsourced interpretation, every deferred item that affects this encounter, and anything the acceptance run could not verify. Name what is unverified rather than omitting it.

**Focused checks:** the full matrix above. Report each item's actual outcome with numbers. A blocked item is reported as blocked, never as passed.

**Acceptance:** every item in the matrix has a recorded outcome with real figures, the Crystal Worm encounter is proven unchanged from v4, determinism and storage compatibility hold, both encounters complete in a browser, and the consolidated limitations list is written down.

### Step 24.4 - Update The Handoff Documentation

Status: pending. Dependencies: 24.3.

**Implementation prompt**

Documentation only. Make the repository describe what now exists, for a reader arriving with no knowledge of this plan.

- **`README.md`.** Replace the "Current V4 State" section with a "Current V5 State" section covering both encounters, the Queen's eight phases and what each teaches, drill mode with its `?phase=` and `?loop=` parameters, encounter selection, the condition model with its active and inert split, and the per-encounter comparison identities. Extend the "Authored Data" subsection to table all six JSON files - `shapes.json`, `arena.json`, `projectiles.json`, `enemies.json`, `encounter.json` and whatever 23.1 added - saying which file to edit for the arena, a projectile, an enemy's phases, and spawning. Add a "V5 Verification" subsection recording step 24.3's gate run and measurements. Preserve the existing v1-v4 history sections.
- **A new "Fidelity And Limitations" section in `README.md`**, published from step 24.3's consolidated list: what this trainer does not reproduce and why, each item linked to its deferred register id. State plainly that phases 2 and 5 are easier than the live fight because the arena does not flood, and that phases 1, 3 and 8 are harder because a real group suppresses attacks by stunning. A training tool that misrepresents its own fidelity is worse than one that admits the gap.
- **The Home changelog.** Add an entry in player-facing language: a new boss with eight phases, status effects that change how you move, single-phase practice, and the ability to choose which encounter to train. Preserve every earlier entry.
- **[The mechanics contract](docs/mechanics.md).** Append the implemented-V5 handoff beside the V5 contract that step 19.1 recorded, covering the final tuned values, the sourced-versus-authored split, and the two unsourced interpretations. Do not alter the v1-v4 provenance.
- **[The deferred register](docs/deferred-work.md).** Update it to reflect reality: items that shipped move out, items this work revealed move in, and D09's F5 entry is marked fixed by step 23.1 with the other findings left open.
- **Archive this plan.** Copy it to `docs/implementation-plan-v5.md` with an archive header in the style of the v2 and v4 archives, rewrite its relative links for the new directory depth, and leave `implementation-plan.md` holding whatever work is genuinely pending. Verify every relative link in every file you touched resolves on disk.

Do not claim a deployment. Publication remains a separately authorized step.

**Focused checks:** structural only. Every relative link in every touched file resolves; the README's v1-v4 history sections and the Home changelog's earlier entries are intact, confirmed by comparing before and after; the mechanics contract retains every pre-existing heading; the archived plan's links resolve from `docs/`; and the six authored JSON files listed in the README all exist. Run all four routine gates to prove nothing was disturbed.

**Acceptance:** the README describes the V5 state and publishes the fidelity limitations, the changelog gains a player-facing entry with history intact, the mechanics contract and deferred register are current, this plan is archived with working links, and all four gates pass.

## Customization Choice

Shared engineering rules live in `.github/copilot-instructions.md`, mirrored for Claude Code by `CLAUDE.md`; the single-step command lives in `.github/prompts/implement-step.prompt.md`, mirrored by `.claude/commands/implement-step.md`. Keep each mirrored pair in sync in the same commit. The mirror table at the bottom of `CLAUDE.md` records the pairings.

Phase 23 is ten authoring steps against one stable vocabulary, which is the repeated workflow a skill would serve. Reconsider a reusable encounter-authoring skill after step 23.4: by then two phases and one minion family will have been authored and it will be clear whether the repetition is mechanical enough to automate, or whether each phase's source reading is the actual work.

# Plan V24: Solo Crystal Worm In A Reach-Sized Arena

Phase 101. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phase 101 builds and why. It is not authorization to implement any phase by itself.

The Crystal Worm encounter currently spawns a new worm every 10 seconds, up to four at once, inside a circular arena of radius 19.2 tiles. This plan makes it a single-worm encounter: only the opening worm ever spawns, and the arena shrinks to a fixed radius equal to 70 percent of the worm attack's maximum reach. Development starts with failing behaviour tests (TDD).

This is the first plan to use the `DC-V<plan>-<n>` decision-ID scheme instead of a single-letter prefix (DC-V24-14).

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and the approved approach for phase 101. Later explicit user decisions override older statements; record changes here.
- The user's request on 2026-11-19 via `/brainstorm`: the Crystal Worm encounter should stop spawning new monsters, keeping only the first one, and its arena should shrink to a size set by 70 percent of the maximum reach of its attack, developed test-first with behavioural tests. The user answered questions 1-14 of that session one by one; DC-V24-1 to DC-V24-13 record those answers. The user then numbered this plan V24, because V23 (phases 97-100) is being written in another devcontainer, and replaced single-letter decision prefixes with `DC-V<plan>-<n>` (DC-V24-14).
- A code and data audit on 2026-11-19. Its findings:
  - `app/src/game/data/encounter.json`, entry `crystal-worm`: `rulesVersion` `crystal-worm-child-swarm-paladin-v7`, `displayName` `Crystal Worm Swarm`, spawns `firstSpawnSeconds` 10, `everySeconds` 10, `maxConcurrent` 4, placement `farthest-from-player` with `ringRadiusFraction` 0.84375 and `goldenAngleDegrees` 137.5.
  - `app/src/game/data/arena.json`, arena `crystal-worm-circle`: `kind` `circle`, centre (0, 0), `radiusTiles` 19.2, no hazards.
  - `app/src/game/data/enemies/crystal-worm-child-head.json`: `spawnTiles` (0, -16.2); single phase `sole`, chase 1.5 tiles/s; attack `spiral-shards`, a 6-arm ring with `emitterRadiusTiles` 0.35, firing `crystal-worm-child-shard`.
  - `app/src/game/data/projectiles.json`, `crystal-worm-child-shard`: `speedTilesPerSecond` 8, motion `boomerang` with `reversalAgeSeconds` 1.5 and `lifetimeSeconds` 3. These are trainer-approved values ("approved v3 tuning"), not wiki-sourced.
  - `app/src/game/config/encounter.ts:420-426` throws at module load unless the debug-tunable encounter (the Crystal Worm, K12) authors a repeating spawn cadence, because the debug panel's First spawn, Spawn interval and Max concurrent sliders (`app/src/game/config/debug.ts`, group `Spawns`) edit it. Debug settings are not persisted, so removing a slider cannot break stored data.
  - `resolveSpawnPosition` in `app/src/game/simulation/simulation.ts` places the opening worm on the spawn ring farthest from the player; `updateSpawns` already treats `everySeconds: null` as "the opening spawn is never repeated" (K10), as the Killer Bee Queen uses.
  - The archetype's `spawnTiles` is read only by the tagger preview (`app/src/research/previewModel.ts`) and, clamped, by the debug build.
- [The project instructions](../AGENTS.md): ownership, scope, TDD and verification.
- [The deferred register](deferred-work.md): nothing is promoted or added. D14 (Crystal Worm shard hitbox and appearance) stays deferred.

No value in this plan is a ROTMG fidelity claim. The arena radius and spawn change are user-approved trainer tuning derived from the already trainer-approved shard values.

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V5](implementation-plan-v5.md) | 19-24 | The multi-encounter catalog; the Crystal Worm's protected values |
| [V21](plan-v21.md) | 89 | The tagger in every environment |
| [V22](plan-v22.md) | 90-96 | Pre-merge quality gates, including the rules fingerprint (A12) |

V23 (phases 97-100) is drafted separately and is independent of this plan.

## Confirmed Design

Carried forward unchanged: the Killer Bee Queen encounter in every respect; the Crystal Worm's body, chase movement, attack, cadence, shard projectile and its hitbox (P11, D14); the encounter id `crystal-worm` and arena id `crystal-worm-circle`; the periodic-spawn engine path in the schema, validator and simulation; the debug panel's remaining sliders, including Spawn ring; the player spawn at (0, 0); every quality gate from V22.

This plan adds, as a delta:

- **The arena is sized from the attack's reach (DC-V24-1 to DC-V24-4).** The Crystal Worm arena radius becomes a fixed 8.645 tiles, 70 percent of the shard's 12.35-tile maximum reach, authored in `arena.json` with its derivation and guarded by a test.
- **Only the opening worm spawns (DC-V24-5 to DC-V24-7).** The encounter spawns its single worm at t = 0 and never again; the worm still spawns on the ring farthest from the player.
- **The debug panel no longer edits a spawn cadence (DC-V24-8).** The First spawn, Spawn interval and Max concurrent sliders are removed.
- **The encounter is renamed and re-versioned (DC-V24-9, DC-V24-10).** `rulesVersion` `crystal-worm-child-solo-paladin-v1`, display name `Crystal Worm`.
- **Tests come first (DC-V24-12, DC-V24-13).** Failing Vitest behaviour tests define the new encounter before any data changes, and tests that exercised periodic spawning through the shipped worm move onto synthetic fixtures.
- **Decision IDs no longer use letters (DC-V24-14).** From this plan on, decisions are numbered `DC-V<plan>-<n>`.

## Recorded User Decisions - 2026-11-19

- **DC-V24-1 - Maximum reach includes the emitter offset.** The attack's maximum reach is measured from the worm's centre to the shard centre at reversal: `emitterRadiusTiles + speedTilesPerSecond * reversalAgeSeconds` = 0.35 + 8 x 1.5 = **12.35 tiles**. The shard body's half-length is not added. (Question 1, option b.)
- **DC-V24-2 - The arena radius, not its diameter, is 70 percent of reach.** `radiusTiles` = 0.7 x 12.35 = **8.645 tiles** (diameter 17.29). The user's request said "diameter"; on review the user chose radius. (Question 2, option b.)
- **DC-V24-3 - The radius is fixed for the whole fight.** No arena shrinks during play; shrinking arenas stay out of scope. (Question 3, option a.)
- **DC-V24-4 - The radius is authored, not computed.** `arena.json` carries `radiusTiles: 8.645` with a comment stating DC-V24-1 and DC-V24-2. A test reads the authored attack and projectile and fails if `radiusTiles` differs from `0.7 * (emitterRadiusTiles + speedTilesPerSecond * reversalAgeSeconds)`. The loader gains no arena-to-projectile coupling. (Question 4, option a.)
- **DC-V24-5 - One spawn, never repeated.** The `crystal-worm` spawns become `firstSpawnSeconds: 0`, `everySeconds: null`, `maxConcurrent: 1`, the same shape the Killer Bee Queen uses (K10). (Question 5, option a.)
- **DC-V24-6 - Spawn placement is unchanged.** The rule stays `farthest-from-player` with `ringRadiusFraction` 0.84375, which now resolves to 0.84375 x 8.645 = **7.29421875 tiles** from the centre. `goldenAngleDegrees` 137.5 stays authored; with one worm it has no effect. (Question 6, option a.)
- **DC-V24-7 - The archetype's `spawnTiles` moves onto the new ring.** `crystal-worm-child-head.json` `spawnTiles` becomes (0, -7.29421875), the ring point due north, and its comment is rewritten to say so. (Question 7, option a.)
- **DC-V24-8 - The debug panel's spawn-cadence sliders are removed.** Delete `firstSpawnSeconds`, `spawnEverySeconds` and `maxConcurrentEnemies` from `DEBUG_PARAMETERS`, from the tuning values the debug build reads, and from `buildEncounterConfig`, which takes the encounter's spawn schedule from its authored entry instead. Delete the module-load guard that requires a repeating cadence. The Spawn ring slider stays. The debug panel can no longer re-enable periodic spawning. (Question 8, option a.)
- **DC-V24-9 - New `rulesVersion` slug.** `crystal-worm-child-swarm-paladin-v7` becomes `crystal-worm-child-solo-paladin-v1`, and `rules-fingerprint.json` is updated in the same change (A12). Attempts recorded under v7 stay in history under their own version and are not comparable with v1 attempts. (Questions 9 and 14, option b then a.)
- **DC-V24-10 - The display name drops "Swarm".** `displayName` becomes `Crystal Worm`. (Question 10, option b.)
- **DC-V24-11 - Every other Crystal Worm value stands.** Body, chase speed 1.5 tiles/s, the `spiral-shards` attack and cadence, and the shard projectile, including its hitbox and appearance (P11, D14), are unchanged. (Question 11, option a.)
- **DC-V24-12 - The periodic-spawn engine path stays.** `everySeconds` as a number remains valid in the schema, validator and simulation. Existing tests that exercise periodic spawning, or that assert the old 19.2-tile arena or 16.2-tile ring, through the shipped Crystal Worm data move onto synthetic fixtures before the data changes, so that coverage survives. (Question 12, option a.)
- **DC-V24-13 - Behaviour tests in Vitest, written first.** The new rules are first expressed as failing Vitest tests at the configuration and simulation level. No new Playwright test is added; existing Playwright tests change only where they name the encounter. (Question 13, option a.)
- **DC-V24-14 - Decision IDs use `DC-V<plan>-<n>`.** From V24 on, a plan's decisions are numbered `DC-V<plan>-<n>`, with the plan number unpadded and `n` counting from 1, for example `DC-V24-1`. Plans no longer pick a letter prefix. Earlier plans keep their letter IDs. `implementation-plan.md` and the `/brainstorm` skill state the rule, and the Current Plan table's Decision prefix column holds `DC-V<plan>` for new rows. This was already applied when this plan was written; phase 101 has no step for it.

## Approved Scope And Review Gates

In scope: DC-V24-1 to DC-V24-13. DC-V24-14 is a process rule and was applied when this plan was written.

Out of scope:

- any change to the Killer Bee Queen;
- any other Crystal Worm value (DC-V24-11), including D14;
- an arena that shrinks during play (DC-V24-3);
- deleting the periodic-spawn engine path (DC-V24-12);
- keeping debug control over the spawn cadence (DC-V24-8);
- a new Playwright behaviour test (DC-V24-13);
- updating the historical Crystal Worm sections of `docs/mechanics.md`, which record earlier plans' values as history;
- renaming earlier plans' letter decision IDs.

Review gates:

- step 101.1's new test file run alone with `npx vitest run <path>`, and its failures recorded before any data edit;
- `npx tsc -b` before reporting any test change;
- `npm run verify` from `app/`, run once at the end of the phase by the `verifier` subagent;
- `npm run test:mutation:diff` by the `verifier` subagent, because `encounter.ts` and `debug.ts` are in the Stryker mutate globs, with no edits under `app/` while it runs;
- `npm run test:e2e -- --grep "<pattern>"` by the `verifier` subagent, only for the Playwright tests whose encounter name changed;
- no benchmark run: no hot-path module (`simulation.ts`, `projectiles.ts`, `bombs.ts`, `geometry.ts`) changes.

## Phase Index

- [Phase 101 - Solo Crystal Worm In A Reach-Sized Arena](plan-archive/phase-101.md). Status: complete. Dependencies: none. The Crystal Worm is now one worm in an 8.645-tile arena, with periodic-spawn coverage moved to a synthetic swarm fixture.

## Phase 101 - Solo Crystal Worm In A Reach-Sized Arena

- Step 101.1 - complete: `crystal-worm-solo.test.ts` defines the solo worm and was recorded red before any data change.
- Step 101.2 - complete: periodic-spawn and large-arena tests run on `app/src/test/swarm-config.ts`.
- Step 101.3 - complete: data, fingerprint and debug sliders changed; the debug ring radius is now clamped so the head stays inside the arena (a recorded deviation).

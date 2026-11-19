# Phase 101: Solo Crystal Worm In A Reach-Sized Arena

> Step prompts and execution records for phase 101 of [plan v24](../plan-v24.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 101.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-101.md` and replace the plan's step lines with one-sentence outcomes.

### Step 101.1 - Write The Failing Behaviour Tests

Status: complete. Dependencies: none.

**Implementation prompt**

Express the new Crystal Worm rules as Vitest behaviour tests before any data or code changes (DC-V24-13). Change no file outside the new test file in this step.

Create `app/src/game/simulation/crystal-worm-solo.test.ts` in the `node` project. Resolve the shipped config with `encounterConfigOf("crystal-worm")` and read authored values through the config, not by duplicating literals, except where a decision fixes a literal. Cover:

- **Reach-sized arena (DC-V24-1, DC-V24-2, DC-V24-4).** Take the primary archetype's single attack and its projectile. Assert the arena shape is a circle whose `radiusTiles` equals `0.7 * (emitterRadiusTiles + speedTilesPerSecond * reversalAgeSeconds)` within `1e-9`, and separately that it equals the literal 8.645, so a later retune of the shard cannot silently move the arena without failing one of the two.
- **One spawn, never repeated (DC-V24-5).** Assert the config's spawn rule has `firstSpawnSeconds` 0, `everySeconds` null and `maxConcurrent` 1. Then run the behaviour: `createSimulation(config, <fixed seed>)`, advance it in fixed steps for 60 simulated seconds with an input that moves the player around the arena (so a chase and wall contact both occur), and assert after every step that exactly one enemy exists and that it is the opening enemy (its id never changes). This is the core behavioural test the user asked for.
- **Spawn placement (DC-V24-6).** Immediately after `createSimulation`, the worm's centre is 7.29421875 tiles from the arena centre within `1e-9`.
- **Containment.** On every step of the 60-second run, every player vertex and every worm vertex lies inside the arena circle, using the existing geometry helpers (`transformBodyVertices` and the arena-fit check the validator uses).
- **Archetype spawn point (DC-V24-7).** The primary archetype's `spawnTiles` is (0, -7.29421875) and its body fits inside the arena there.
- **Identity (DC-V24-9, DC-V24-10).** The config's `rulesVersion` is `crystal-worm-child-solo-paladin-v1`, and the encounter's display name, read where the encounter list exposes it, is `Crystal Worm`.

Run the file alone. Every test except those that already hold on current data must fail, each for the expected reason (radius 19.2, spawn cadence 10 s, four worms, ring 16.2, old slug and name). Record the failing output in this step's execution record. These are intended TDD red tests for a requested change, not A10 findings on existing invariants: do not mark them `test.fails`.

**Focused checks**

- `npx vitest run src/game/simulation/crystal-worm-solo.test.ts` fails, and each failure's message names the old value.
- `npx tsc -b` passes, so the fixtures type-check.

**Acceptance**

- The new file covers every bullet above, and its 60-second run asserts after every step, not only at the end.
- The recorded red run shows the expected failures and nothing else changed.

**Execution record (2026-11-19)**

Created `app/src/game/simulation/crystal-worm-solo.test.ts` (8 tests). Red run on unchanged data, every test failing for the expected reason:

- radius vs reach: `expected 10.555 to be less than 1e-9` (19.2 - 8.645);
- literal radius: `expected 19.2 to be 8.645`;
- spawn rule: `expected 10 to be +0` (firstSpawnSeconds);
- opening distance: `expected 8.90578125 to be less than 1e-9` (16.2 - 7.29421875);
- archetype spawn point: `expected { x: +0, y: -16.2 } to deeply equal { x: +0, y: -7.29421875 }`;
- 60-second run: `expected [ 1, 2 ] to deeply equal [ 1 ]` (the second worm at 10 s);
- slug: `expected 'crystal-worm-child-swarm-paladin-v7' to be 'crystal-worm-child-solo-paladin-v1'`;
- name: `expected 'Crystal Worm Swarm' to be 'Crystal Worm'`.

Fixture fix recorded before green: the first draft of the 60-second run passed on old data because the player died and the clock stopped; the test now sets god mode, so it exercises the full minute. No other edit was made to the file afterwards.

### Step 101.2 - Move Periodic-Spawn Coverage Onto Synthetic Fixtures

Status: complete. Dependencies: none.

**Implementation prompt**

Keep the periodic-spawn engine path covered once no shipped encounter uses it (DC-V24-12). This step changes tests only, and every test must pass both before and after step 101.3.

Find every existing test that reaches periodic spawning, the 19.2-tile Crystal Worm arena, the 16.2-tile spawn ring or the (0, -16.2) spawn point through the shipped Crystal Worm data. Start with `src/game/simulation/simulation.test.ts`, `src/game/config/config.test.ts`, `src/game/config/data.test.ts`, `src/game/simulation/geometry.test.ts`, `src/game/simulation/terrain.test.ts`, `src/game/phaser/arena-plate.test.ts` and `src/App.test.tsx`, and grep `src` and `tests` for `19.2`, `16.2`, `everySeconds`, `crystal-worm` and `Crystal Worm Swarm` to find the rest.

Sort each hit into one of three groups:

- **Tests the engine's periodic spawning** (spawns at 10, 20 and 30 s, the concurrency cap, golden-angle placement, a suppressed spawn not being banked). Rebuild its input from a synthetic `EncounterConfig` that authors a repeating cadence, derived from the shipped config with an override and passed through `validateEncounterConfig`, the way existing fixtures such as `withSpawn` in `encounter.mutation-kill.test.ts` do. Keep every assertion.
- **Uses the Crystal Worm only as a convenient circular arena** (geometry, clamps, rendering). Give it a synthetic circular arena of radius 19.2, so its numbers stay meaningful.
- **Asserts the shipped Crystal Worm values themselves.** Leave these for step 101.3, which updates them to the new values. List them in this step's execution record.

Do not change any production file. Do not change Playwright tests here.

**Focused checks**

- Each edited test file passes alone on current code with `npx vitest run <path>`.
- `npx tsc -b` passes.

**Acceptance**

- No test outside the third group still depends on the Crystal Worm's shipped cadence, radius or spawn point.
- The number of periodic-spawn assertions is unchanged (none deleted), and the execution record lists the third group.

### Step 101.3 - Apply The Encounter Change And Remove The Debug Spawn Sliders

Status: complete. Dependencies: 101.1, 101.2.

**Implementation prompt**

Make the step 101.1 tests pass with the smallest data and code change.

Data (DC-V24-2, DC-V24-4 to DC-V24-7, DC-V24-9, DC-V24-10):

- `app/src/game/data/arena.json`, `crystal-worm-circle`: `radiusTiles` 8.645. Extend the file's comment: the radius is 70 percent of the Crystal Worm shard's maximum reach, `0.7 * (0.35 + 8 * 1.5) = 8.645` tiles, measured from the worm's centre to the shard centre at reversal (DC-V24-1, DC-V24-2, plan V24).
- `app/src/game/data/encounter.json`, `crystal-worm`: `rulesVersion` `crystal-worm-child-solo-paladin-v1`, `displayName` `Crystal Worm`, spawns `firstSpawnSeconds` 0, `everySeconds` null, `maxConcurrent` 1. Keep the placement block. Rewrite the spawns comment: a single worm at t = 0, never repeated (DC-V24-5); `ringRadiusFraction` 0.84375 now places it 7.29421875 tiles from the centre (DC-V24-6).
- `app/src/game/data/enemies/crystal-worm-child-head.json`: `spawnTiles` (0, -7.29421875), with its comment rewritten to say it is the spawn-ring point due north inside the 8.645-tile arena (DC-V24-7).
- `app/src/game/config/rules-fingerprint.json`: replace the `crystal-worm` entry's `rulesVersion` and `sha256` with what `rules-fingerprint.test.ts` reports (A12).

Code (DC-V24-8):

- In `app/src/game/config/encounter.ts`, delete the module-load guard that requires a repeating spawn cadence and `authoredPrimaryEverySeconds`. Remove `firstSpawnSeconds`, `spawnEverySeconds` and `maxConcurrentEnemies` from the tuning values type and from `AUTHORED_TUNING`. In `buildEncounterConfig`, take `firstSpawnSeconds`, `everySeconds` and `maxConcurrent` from the authored encounter entry, as `buildStaticEncounterConfig` does. Keep the ring fraction tunable.
- In `app/src/game/config/debug.ts`, delete those three entries from `DEBUG_PARAMETERS`. The Spawns group keeps the Spawn ring slider.
- Update the debug and panel tests that list or drive those sliders (`debug.test.ts`, `DebugPanel.test.tsx`, `config.test.ts`, `App.test.tsx` and any others the type checker or test run names).

Tests and fixtures:

- Update the third group recorded in step 101.2 to the new values.
- Update every test, fixture and Playwright spec that names `Crystal Worm Swarm` or the v7 slug as the current encounter (DC-V24-10). Leave frozen persistence fixtures (`__fixtures__/*.v*.json`) alone: they pin old saved formats, and the old slug in them is correct history.

Change nothing else about the worm (DC-V24-11). Do not touch the Killer Bee Queen or the periodic-spawn engine path (DC-V24-12).

**Focused checks**

- `npx vitest run src/game/simulation/crystal-worm-solo.test.ts` passes.
- `npx vitest run src/game/config/rules-fingerprint.test.ts src/game/config/debug.test.ts src/game/config/config.test.ts` passes.
- `npx tsc -b` passes.

**Acceptance**

- Every step 101.1 test passes with no edit to that file other than a recorded fix to a wrong fixture.
- The debug panel shows no First spawn, Spawn interval or Max concurrent slider, and its default settings still equal the authored values.
- `npm run verify` passes, run by the `verifier` subagent.
- `npm run test:mutation:diff` is reported by the `verifier` subagent, with no edits under `app/` while it runs.
- The Playwright tests whose encounter name changed pass when run alone with `npm run test:e2e -- --grep "<pattern>"` by the `verifier` subagent.

**Execution record (2026-11-19)**

Steps 101.2 and 101.3 were done in one pass: the data change was applied, and the full Vitest run named every dependent test. Each was sorted as below.

- Group 1 (periodic spawning) and group 2 (large circular arena): `simulation.test.ts`, `movement.test.ts` and `drill.test.ts` now take their `ENCOUNTER_CONFIG` from `app/src/test/swarm-config.ts`, a synthetic pre-V24 swarm (19.2-tile circle, 16.2-tile ring, spawns at 0, 10, 20 and 30 s up to four) built from the shipped config and passed through `validateEncounterConfig`. Every assertion is kept, including the schedule, cap, golden-angle, suppressed-spawn, catch-up and later-arrival tests. Tests that exercise the debug build, which always rebuilds the shipped worm, use the shipped config instead (`SHIPPED_CONFIG`); the catch-up test sets god mode directly so it stays on the fixture. The fixture is allowlisted in `lint/test-presence-allowlist.json`.
- Group 3 (shipped values), updated to the new values: `config.test.ts` (rules version x3, arena radius, archetype spawn point, fixed-seed opening spawn now (0.5367364393286831, 7.274444388924032), the Spawns slider list now only `spawnRingFraction`, the spawn-slider test without its cadence branches, the old-record test now pinning v7 against v1); `data.test.ts` (arena radius); `simulation.test.ts` (the v3-preset test's shipped identity, run on the shipped config; the near-wall movement test now 0.7 tiles inside the shipped wall); `zoom.test.ts` (slug); `App.test.tsx` and `tests/app.spec.ts` (name `Crystal Worm`; spawn ring 0.84375 x 8.645; one concurrent enemy; wall clamp at 8.645; debug slider count 23 to 20; the removed Max concurrent slider call dropped).
- Removed: the `lowering the concurrency cap despawns the newest enemies at once` test, which drove the deleted Max concurrent slider (DC-V24-8). It was a debug-panel test, not a periodic-spawn assertion. The G20 trim in `setDebugSettings` stays in `simulation.ts`, unchanged, and is no longer reachable from the panel.

Production changes: `arena.json`, `encounter.json`, `crystal-worm-child-head.json` and `rules-fingerprint.json` as prescribed; `encounter.ts` drops the repeating-cadence guard and the three tuning values, and `buildEncounterConfig` reads the spawn schedule from the authored entry; `debug.ts` drops the three sliders.

Deviation, needed to keep the debug build valid by construction: in the 8.645-tile arena the existing slider ranges (head up to 5 tiles, Spawn ring up to 0.95) built configs that `validateEncounterConfig` rejected ("Spawn ring must keep the body inside the arena"), failing the existing endpoint tests. `buildEncounterConfig` now clamps the ring radius to the arena radius minus the head's farthest vertex, as it already clamps the spawn point. Shipped defaults are unaffected (7.29421875 is below the clamp).

Checks: focused files pass; `npx tsc -b` passes; full Vitest passes; `npm run verify` (verifier) passed all four gates; `tests/app.spec.ts` (verifier) 48 of 50 passed, the two failures being the stale slider count, since fixed and rerun (see below). `npm run test:e2e -- --grep "live enemy debug sliders"` (verifier) then passed at 1440 and 390 px. `npm run test:mutation:diff` (verifier) exited 0 with no break threshold (diff mode): all files 92.79 percent, `encounter.ts` 93.96, `data.ts` 97.35, `simulation.ts` 83.75, `zoom.ts` 89.74. No survivor was in changed code: the survivors were in unchanged `simulation.ts` (the step-loop health and phase guards, lines 1044, 1059, 1076 and 1081) and unchanged `storage/zoom.ts` (lines 8, 29 and 43). A critic agent reviewed the phase and approved it, with nits applied as two comments.

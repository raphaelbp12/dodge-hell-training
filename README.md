# Dodge Hell Training

A pure-frontend bullet-hell practice game targeting repeated survival training against the Crystal Worm Child Head from Realm of the Mad God.

## Current State

Step 3.4 is complete: `app/` contains the command-generated React + TypeScript + Vite starter, runtime/test dependencies, domain configuration, pure stat formulas, and fixed-step movement, pursuit, rotating bursts, returning shards, swept hits, regeneration, and survival end. It still displays the Vite starter screen and counter, not a playable encounter. Phaser integration, session controls, and GitHub Pages deployment belong to later plan steps.

## Domain Data

The [mechanics contract](docs/mechanics.md) is the source of approved values and fidelity limitations. Configuration uses HP, tiles, seconds, radians, degrees/second, and CSS pixels explicitly in property names; primary DEF/SPD/VIT remain stat points. No browser or rendering framework is required to import these modules.

| Contract/source                                                           | Named implementation                                                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published integer level-20 averages (S2), adopted under delegation        | [stats.ts](app/src/game/config/stats.ts): `PALADIN_BASE_STATS` = 675 HP, 10 DEF, 41 SPD, 42 VIT                                                                        |
| Relevant passive bonuses (S7/S11/S13/S14)                                 | `PALADIN_EQUIPMENT_BONUSES`: four fixed items, +22 DEF armor and +100 HP ring; no unused mana/attack systems                                                           |
| Equipped preset                                                           | `calculateEquippedStats` / `PALADIN_STATS` = 775 HP, 32 DEF, 41 SPD, 42 VIT; base data is not mutated                                                                  |
| Source formulas (S3/S9), delegated combat brackets and integer rounding   | `STAT_RULES`, `derivePlayerStats`, `calculateDamageHp`, `calculateCombatTriggerHp`, `calculateCombatDurationSeconds`; `PALADIN_DERIVED_STATS` retains fractional rates |
| Approved arena, spawns, collision circles, pursuit, emitters, bursts      | [encounter.ts](app/src/game/config/encounter.ts): `ENCOUNTER_CONFIG.arena/player/enemy/emitters/burst`; cooldown is measured from the last shot                        |
| Wiki shard damage/speed; approved provisional range interpretation        | `ENCOUNTER_CONFIG.shard`: 160 HP, 8 tiles/second, reversal age 1.2 seconds and independent lifetime 2.4 seconds; lifetime-only expiry and once-per-shard hit policy    |
| Approved viewing/session numbers                                          | `ENCOUNTER_CONFIG.camera/session`: 32 CSS pixels/tile; zoom 1 within 0.75-1.5 in 0.125 steps; Start/retry countdowns 3/0 seconds; 100 retained deaths                  |
| Entities, directional input, circular arena and versioned snapshot shapes | [models.ts](app/src/game/models.ts): plain types; shards carry velocity, age, reversal/hit flags, and no stored origin                                                 |
| Comparison identity                                                       | `RULES_VERSION` = `crystal-worm-child-head-paladin-v1`, carried in configuration and `SessionSnapshot.rulesVersion`                                                    |

`validateEncounterConfig` checks finite values, positive sizes/counts/timings, reversal strictly within lifetime, spawn collision extents, ordered zoom limits, and pursuit slower than the Paladin. Rule functions reject negative/nonfinite inputs. This is local validation for the typed preset, not a tuning UI or generic schema system.

Comparison-breaking changes to the preset, formulas, or encounter tuning require an explicit `RULES_VERSION` bump and corresponding contract/test updates. Future persistence must compare this version before sharing personal bests; viewing zoom alone does not split comparisons. No comparison/history implementation is introduced here.

Run the configuration Node suite from `app/` with `npm.cmd run test -- --project node src/game/config/config.test.ts` (46 cases). Formula helpers do not mutate entities; the simulation's health rules apply damage, combat refresh, fractional regeneration, and health caps. Session transitions beyond death remain later-step work.

## Fixed-Step Movement

[simulation.ts](app/src/game/simulation/simulation.ts) exposes `createSimulation()` and one advancement entry point, `advanceSimulation(state, elapsedSeconds, input)`. Initialization copies the approved positions and full-health preset into independent state. Advancement mutates that state using supplied active seconds and sampled directions only; it does not read clocks, draw, bind keyboard listeners, or schedule its own loop.

The [mechanics timing policy](docs/mechanics.md#simulation-timing-and-movement-policy) records the delegated decision made during step 3.2. `ENCOUNTER_CONFIG.simulation` sets a 1/60-second fixed step and at most 8 steps per call. Each call returns `stepsExecuted` and `discardedSeconds`, retains a sub-tick remainder, and drops excess whole ticks instead of catching up later. `ticksElapsed` counts executed ticks; `elapsedSeconds` is that count times the fixed step, so discarded time cannot earn survival credit.

Each tick cancels opposite directions and normalizes diagonals, moves the player, then pursues its updated position without overshooting the enemy's stop distance. Positive X is east; positive Y is south. Circle projection accounts for both collision radii and permits wall sliding. There is no body blocking or contact damage. Session start/pause/retry controls are not implemented here.

From `app/`, run the focused 95-case simulation/health suites (79 simulation cases and 16 pure health cases):

```powershell
npm.cmd run test -- --project node src/game/simulation
```

Tests cover initialization, directions/opposite inputs, normalized speed, known tick counts, boundaries, pursuit/stopping, frame schedules, invalid time, and catch-up accounting. Equivalent schedules with the same per-tick input and no dropped time match within 1e-9 tile; the remainder tolerance is 1e-12 second. At low frame rates that exceed the catch-up limit, intentional dropped time means results are not expected to equal an undropped schedule. No new browser keyboard behavior is expected until Phaser integration.

## Rotating Bursts And Shards

The same simulation state now exposes `shards` and `volleysFired` (one volley is four simultaneous emitter shots). There is no second clock. Shot times derive from the volley count and configured initial cooldown, intra-burst interval, and cooldown after the last shot: 2.00, 2.15, 2.30, 2.45 seconds, then the next group starts at 4.45 seconds. Each group creates 16 shards with stable spawn-order IDs.

All approved shot times align with the 60 Hz tick boundaries. Each tick moves the player/enemy, advances existing shards, then samples the enemy's updated position and continuously rotating phase for any due volley. New shards start at age zero at that boundary. Phase zero points east; increasing angles move toward positive Y (south), so rotation is clockwise. Rotation continues during cooldown and derives from executed simulation time, never discarded time.

Shard updates split displacement at reversal and expiry, reversing velocity exactly once at 1.2 seconds and expiring at 2.4 seconds. Only lifetime removes a shard; arena exit, player overlap, and `hasHitPlayer` do not. Shards store no origin or target, and later enemy movement cannot alter their velocity. Hit flags initialize false and prevent repeated damage without stopping shard movement.

The focused suite retains 17 attack/shard cases covering cooldown and shot boundaries, all emitter offsets, resampling, clockwise rotation, partial-step reversal/expiry, symmetric return, lifetime-only removal, and discarded time. Five frame schedules over ten simulated seconds agree on all 64 emitted shard times within 1e-12 second and on final state. No rendered shards or manual gameplay verification are available until step 4.1.

## Hits, Health, And Survival End

The simulation uses `@flatten-js/core` segment-distance geometry behind a pure circle-sweep check, with no React, Phaser, or browser imports. Subtract the player's interpolated start/end positions from each shard movement segment and compare the segment's distance to the origin against the combined 0.4-tile radii. Each outbound/return segment uses the matching portion of player movement; expired shards cannot hit along untraveled paths. Newborn shards check only overlap at their emission boundary, not earlier player movement.

[health.ts](app/src/game/simulation/health.ts) applies the approved preset rules through `applyPlayerHit` and `regeneratePlayer`. A first hit marks that shard, increments `hitsTaken`, applies 128 HP damage, and refreshes combat to 5.32 seconds. Separate shards can each hit without global immunity. Resolve hits in spawn order before regeneration; retain fractional HP, use 6.0547 HP/second in combat and 12.1094 otherwise, split at combat expiry, and cap at 775 HP. Damage rounding/minimum and inclusive combat-trigger boundaries reuse the existing stat rules.

Fresh state has `phase: "playing"` and zero hits. Lethal damage clamps HP to zero and sets `phase: "ended"`; no later hits or regeneration can change the result. Count the lethal tick in survival time, stop the rest of a multi-tick update, clear the accumulator, and report unexecuted supplied time as discarded. Later advancement calls execute zero ticks and leave the entire ended state unchanged. The session controller, UI, and persistence remain separate later steps.

Step 3.4 adds 40 cases for defense/minimum/ceiling damage, combat trigger and refresh, fractional regeneration/expiry/caps, fast and moving-player crossings, tangencies/near misses, reversal/expiry segments, birth-time overlap, consumed return hits, independent simultaneous hits, lethal ordering, and post-death state freezing. Manual gameplay verification awaits step 4.1; the existing Chromium smoke test still checks only the unchanged starter.

## Prerequisites

- Use Node.js 24.22.1 LTS and npm 12.2.1. The root [.node-version](.node-version) selects the exact Node version; app package metadata records npm and supported Node/npm ranges.
- Node 24 is LTS; Node 26 is still Current as of 2026-10-24. See [Node release status](https://nodejs.org/en/about/previous-releases). The selected runtime satisfies the [Vite requirements](https://vite.dev/guide/) and npm 12's engine requirements.
- Keep `app/package-lock.json` in version control. Use `npm ci` for an existing checkout; use npm commands to change dependencies.

## Windows Toolchain Setup

fnm 1.39.0 was installed as a per-user portable package. The existing system Node installation was left untouched, and no PowerShell profile was modified. Install fnm if needed:

```powershell
winget install --id Schniz.fnm --exact --source winget --scope user --accept-source-agreements --accept-package-agreements --disable-interactivity
```

After installation, restart VS Code so it inherits the updated user PATH. From the repository root, initialize fnm for the current PowerShell session and install/select the pinned Node version:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm install (Get-Content .node-version)
fnm use
```

Node 24.22.1 bundles npm 11.19.1. Upgrade npm inside the selected fnm-managed installation, not inside the system Node installation:

```powershell
$managedNodeDirectory = Split-Path (Get-Command node.exe).Source
if ($managedNodeDirectory -notlike '*fnm*') { throw 'Select fnm-managed Node before upgrading npm.' }
npm install --global --prefix $managedNodeDirectory npm@12.2.1
node --version
npm --version
```

Expected versions: `v24.22.1` and `12.2.1`. In each new terminal, initialize fnm and run `fnm use` from the repository root before working in `app/`. Profile integration is optional and has not been enabled automatically. Do not uninstall or replace the system Node installation merely to use this project.

## Current Toolchain

Updated and validated on 2026-10-24:

| Tool                                          | Current version                                                       |
| --------------------------------------------- | --------------------------------------------------------------------- |
| fnm                                           | 1.39.0                                                                |
| Node.js / npm                                 | 24.22.1 / 12.2.1                                                      |
| React / React DOM                             | 19.3.1 / 19.3.1                                                       |
| TypeScript                                    | 7.0.2                                                                 |
| Node type definitions                         | 24.19.2; intentionally aligned to Node 24 rather than latest major 26 |
| Vite / React plugin                           | 8.3.5 / 6.1.2                                                         |
| Oxlint                                        | 1.89.0                                                                |
| Phaser                                        | 4.2.1; installed, not integrated yet                                  |
| @flatten-js/core                              | 1.6.14; typed, framework-independent collision geometry               |
| Vitest / jsdom                                | 5.0.5 / 30.1.3                                                        |
| React Testing Library / jest-dom / user-event | 16.3.3 / 7.0.1 / 14.6.8                                               |
| Playwright Test / create-playwright           | 1.64.1 / 1.17.139                                                     |

TypeScript was upgraded through npm; other compatible packages were refreshed and were already current within their supported ranges. A clean `npm ci`, lint, and the TypeScript/production build pass with this toolchain. The original bootstrap record below is historical, not the current runtime requirement.

The project's Chromium smoke test now verifies the starter heading, a normal mouse click updating its counter, all starter images, and absence of uncaught page errors. This supersedes step 2.1's limited editor-browser automation check; no application component was changed to accommodate automation.

## Local Development

After selecting the pinned toolchain above, from the repository root:

```powershell
cd app
npm ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

On Windows, stop this project's dev/test servers before running `npm ci`: a loaded Vite native module can otherwise cause an `EPERM` file-lock error. Retry after stopping the server; elevation is not the remedy for that lock.

Open the URL printed by Vite, normally http://127.0.0.1:5173/. If that port is occupied, Vite chooses another available port. The server is local-only with this command. Stop it with Ctrl+C in its terminal.

In Windows PowerShell 5.1, use `npm.cmd` when forwarding flags after `--`: npm 12's PowerShell entry point did not preserve the separator in the checked environment. On other platforms, use `npm` instead of `npm.cmd`.

## Validation And Build

Run these from `app/`:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The generated lint script uses Oxlint. Typecheck uses the generated TypeScript project references (`tsc -b`), including test/tooling files. The build script runs that same check followed by the Vite production build, producing ignored output in `app/dist/`. All five commands passed on 2026-10-24 (143 Vitest tests and one Chromium smoke test).

Use `npm run test:watch` during development. Vitest runs `src/**/*.test.ts` in Node without DOM setup; reserve that convention for pure models, configuration, simulation, and adapters. React tests use `src/**/*.test.tsx` in jsdom with jest-dom matchers and automatic cleanup. Only CSS Modules are processed in jsdom; a test-only stylesheet verifies scoped class names and computed styles. Full page styles run in Chromium, not jsdom.

Install the required browser on each new machine or after a Playwright browser-version upgrade, from `app/`:

```powershell
npx.cmd playwright install chromium
```

On other platforms, use `npx` instead of `npx.cmd`; Linux may also need Playwright's [browser system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies). Browser binaries are cached outside the repository. `npm ci` alone does not install them.

Playwright starts the local Vite CLI from `app/` using the current Node executable at http://127.0.0.1:4173/. Keep that test port free: `reuseExistingServer: false` and Vite's `--strictPort` intentionally reject an occupied port instead of testing an unrelated server. The runner stops its own server afterward. Tests never navigate to external websites; traces on failure live in ignored `app/test-results/`. No CI workflow is introduced in this step.

To serve the production build locally, run:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

Use the URL printed by the preview command. Preview also defaults to port 4173, so stop it before running browser tests.

## Bootstrap Record

Generated on 2026-10-24 from the repository root using the official CLI, without hand-writing bootstrap files:

```powershell
npm --yes create vite@latest app -- --template react-ts --no-interactive
npm --prefix app install
npm --prefix app run lint
npm --prefix app run build
```

`--yes` accepts npm's generator-package installation; `--no-interactive` selects noninteractive scaffolding. Do not rerun the generator over the existing app. No nested Git repository was created.

| Tool                | Original bootstrap version |
| ------------------- | -------------------------- |
| Node.js / npm       | 22.20.0 / 11.7.0           |
| create-vite         | 9.3.1                      |
| React / React DOM   | 19.3.1 / 19.3.1            |
| TypeScript          | 6.0.3                      |
| Vite / React plugin | 8.3.5 / 6.1.2              |
| Oxlint              | 1.89.0                     |

The lockfile records installed dependency versions. The initial installation reported zero vulnerabilities; that result is specific to the installation date and is not a continuing security guarantee.

## Project Documents

- [Implementation plan](implementation-plan.md): phased prompts, dependencies, acceptance criteria, and execution records. Next: step 4.1.
- [Mechanics contract](docs/mechanics.md): sourced rules, delegated decisions, and explicit fidelity limitations.
- [Original draft](first-draft.md): initial design intent.
- [Generated template notes](app/README.md): upstream starter documentation, retained unchanged.

Implement one step at a time with `/implement-step <step-id>`. Completing a step does not automatically authorize later steps, a commit, or a push.

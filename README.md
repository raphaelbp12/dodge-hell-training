# Dodge Hell Training

A pure-frontend bullet-hell practice game targeting repeated survival training against the Crystal Worm Child Head from Realm of the Mad God.

## Current State

Step 5.2 is complete: Home and results display local recent attempts and the retained personal best for the current rules version. Completed deaths save once; unfinished retries/Home do not create records. Storage failures leave practice usable with visit-only history and a warning. The existing Start/countdown, compact health/stat HUD, pause, immediate Retry, and zoom remain unchanged. Encounter tuning/acceptance and GitHub Pages deployment remain later steps.

Current local preview: http://127.0.0.1:5175/. The older server on 5174 returned an empty cached App transform during step 5.2; a fresh server was started without stopping the existing servers.

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

Comparison-breaking changes to the preset, formulas, or encounter tuning require an explicit `RULES_VERSION` bump and corresponding contract/test updates. History compares only records with the same rules version; viewing zoom alone does not split comparisons.

Run the configuration Node suite from `app/` with `npm.cmd run test -- --project node src/game/config/config.test.ts` (46 cases). Formula helpers do not mutate entities; the simulation's health rules apply damage, combat refresh, fractional regeneration, and health caps. Session transitions are owned by the separate controller below.

## Fixed-Step Movement

[simulation.ts](app/src/game/simulation/simulation.ts) exposes `createSimulation()` and one advancement entry point, `advanceSimulation(state, elapsedSeconds, input)`. Initialization copies the approved positions and full-health preset into independent state. Advancement mutates that state using supplied active seconds and sampled directions only; it does not read clocks, draw, bind keyboard listeners, or schedule its own loop.

The [mechanics timing policy](docs/mechanics.md#simulation-timing-and-movement-policy) records the delegated decision made during step 3.2. `ENCOUNTER_CONFIG.simulation` sets a 1/60-second fixed step and at most 8 steps per call. Each call returns `stepsExecuted` and `discardedSeconds`, retains a sub-tick remainder, and drops excess whole ticks instead of catching up later. `ticksElapsed` counts executed ticks; `elapsedSeconds` is that count times the fixed step, so discarded time cannot earn survival credit.

Each tick cancels opposite directions and normalizes diagonals, moves the player, then pursues its updated position without overshooting the enemy's stop distance. Positive X is east; positive Y is south. Circle projection accounts for both collision radii and permits wall sliding. There is no body blocking or contact damage. Session start/pause/retry controls belong to the controller, not this simulation module.

From `app/`, run the focused 95-case simulation/health suites (79 simulation cases and 16 pure health cases):

```powershell
npm.cmd run test -- --project node src/game/simulation
```

Tests cover initialization, directions/opposite inputs, normalized speed, known tick counts, boundaries, pursuit/stopping, frame schedules, invalid time, and catch-up accounting. Equivalent schedules with the same per-tick input and no dropped time match within 1e-9 tile; the remainder tolerance is 1e-12 second. At low frame rates that exceed the catch-up limit, intentional dropped time means results are not expected to equal an undropped schedule. The Phaser adapter now supplies active elapsed seconds and sampled keyboard input to this same simulation.

## Rotating Bursts And Shards

The same simulation state now exposes `shards` and `volleysFired` (one volley is four simultaneous emitter shots). There is no second clock. Shot times derive from the volley count and configured initial cooldown, intra-burst interval, and cooldown after the last shot: 2.00, 2.15, 2.30, 2.45 seconds, then the next group starts at 4.45 seconds. Each group creates 16 shards with stable spawn-order IDs.

All approved shot times align with the 60 Hz tick boundaries. Each tick moves the player/enemy, advances existing shards, then samples the enemy's updated position and continuously rotating phase for any due volley. New shards start at age zero at that boundary. Phase zero points east; increasing angles move toward positive Y (south), so rotation is clockwise. Rotation continues during cooldown and derives from executed simulation time, never discarded time.

Shard updates split displacement at reversal and expiry, reversing velocity exactly once at 1.2 seconds and expiring at 2.4 seconds. Only lifetime removes a shard; arena exit, player overlap, and `hasHitPlayer` do not. Shards store no origin or target, and later enemy movement cannot alter their velocity. Hit flags initialize false and prevent repeated damage without stopping shard movement.

The focused suite retains 17 attack/shard cases covering cooldown and shot boundaries, all emitter offsets, resampling, clockwise rotation, partial-step reversal/expiry, symmetric return, lifetime-only removal, and discarded time. Five frame schedules over ten simulated seconds agree on all 64 emitted shard times within 1e-12 second and on final state. Phaser draws these same shards; it does not own a separate projectile simulation or expiration policy.

## Hits, Health, And Survival End

The simulation uses `@flatten-js/core` segment-distance geometry behind a pure circle-sweep check, with no React, Phaser, or browser imports. Subtract the player's interpolated start/end positions from each shard movement segment and compare the segment's distance to the origin against the combined 0.4-tile radii. Each outbound/return segment uses the matching portion of player movement; expired shards cannot hit along untraveled paths. Newborn shards check only overlap at their emission boundary, not earlier player movement.

[health.ts](app/src/game/simulation/health.ts) applies the approved preset rules through `applyPlayerHit` and `regeneratePlayer`. A first hit marks that shard, increments `hitsTaken`, applies 128 HP damage, and refreshes combat to 5.32 seconds. Separate shards can each hit without global immunity. Resolve hits in spawn order before regeneration; retain fractional HP, use 6.0547 HP/second in combat and 12.1094 otherwise, split at combat expiry, and cap at 775 HP. Damage rounding/minimum and inclusive combat-trigger boundaries reuse the existing stat rules.

Fresh state has `phase: "playing"` and zero hits. Lethal damage clamps HP to zero and sets `phase: "ended"`; no later hits or regeneration can change the result. Count the lethal tick in survival time, stop the rest of a multi-tick update, clear the accumulator, and report unexecuted supplied time as discarded. Later advancement calls execute zero ticks and leave the entire ended state unchanged. The controller handles session transitions separately; persistence remains a later step.

Step 3.4 adds 40 cases for defense/minimum/ceiling damage, combat trigger and refresh, fractional regeneration/expiry/caps, fast and moving-player crossings, tangencies/near misses, reversal/expiry segments, birth-time overlap, consumed return hits, independent simultaneous hits, lethal ordering, and post-death state freezing. Browser integration now verifies pursuit, firing, reversal, hit registration, and health loss through real Phaser updates.

## Playable Engine Adapter

[encounter.ts](app/src/game/phaser/encounter.ts) owns the Phaser game, scene, keyboard sampling, camera, and drawing. [App.tsx](app/src/App.tsx) owns Home, the focusable canvas host, primary-stat HUD, and results, styled through [App.module.css](app/src/App.module.css). React receives scalar HUD updates at most every 100 milliseconds during play, not projectile positions per frame. Phaser's update lifecycle is the only driver of the existing fixed-step simulation.

Game creation is deferred by one cancellable microtask so React Strict Mode's discarded mount never boots a second game. Unmount synchronously disables adapter input, removes adapter listeners and its canvas, and requests Phaser's supported asynchronous destruction on the next engine frame. A read-only `inspectEncounter(host)` returns detached diagnostic snapshots for browser checks; it cannot mutate live simulation state.

The camera remains north-up and centered exactly on the player, including at arena edges, without world bounds. World scale is 32 CSS pixels/tile at zoom 1. O/P change zoom by 0.125 per press within 0.75-1.5; held repeats do not repeat zoom changes. Resize changes visible world extent, never world speed or timing. Ground, bodies, and yellow shards use separate Phaser graphics depths, with circle fills matching configured collision radii.

The practice interface uses the approved session flow below. Blur, host focus loss, or a hidden document clear held keys and gate both countdown and gameplay until explicit Resume. Resume/retry discard the first frame delta instead of catching up inactive time. Held movement is suppressed until release or a fresh press. R/Escape are edge-triggered; a weak event-identity set prevents Phaser's same-frame keyboard queue from replaying already handled events. Gameplay key cancellation leaves unrelated keys and browser modifier shortcuts untouched. No touch input is installed.

Manual check: open http://127.0.0.1:5175/, review Home, and select **Start** (or press Enter while it is focused). Observe the three-second countdown, then move with WASD and change zoom with O/P. Press R during countdown, a burst, pause, or after death: the attempt resets immediately without another countdown and retains zoom. Hold R to confirm it does not continually restart. Escape pauses/resumes active play; switching focus away leaves play paused until **Resume** or an explicit keyboard action. Let the player die and compare results with the HUD, then use **Retry** or **Home**. Home discards an unfinished attempt, removes the canvas, and focuses Start. Starting again counts down and retains visit-long zoom. Narrow screens show a keyboard requirement, not touch controls.

Seventeen Chromium checks cover countdown, immediate/held/repeated R, burst/death/paused retry, same-frame event replay, input clearing, retained zoom, repeated mounts/one canvas/one effective keyboard handler, movement/camera/zoom, focus/visibility safety, scoped key cancellation and cleanup, resize invariance, and real combat. They also verify real death records, refresh persistence, retry/abort deduplication, compatible bests, and corrupt/blocked/quota storage fallback. Desktop (1440x1000) and narrow (390x844) Home/history/arena/results screenshots, canvas-pixel checks, and layout assertions verify readable nonblank gameplay, unclipped text, viewport-contained results, and stable arena geometry. Screenshots are saved under ignored `app/test-results/`.

## Practice Interface

Home includes only implemented capabilities in its dated changelog. Under the user's step 5.1 delegation, reference links point to the RealmEye enemy article and the official Realm of the Mad God website. The geometric specimen follows the existing encounter palette; no new asset package is required.

HUD values come from the approved preset and bounded adapter snapshots. Positive HP rounds upward for display; the health meter retains the unrounded value. The timer has `aria-live="off"`; only lifecycle status changes are announced. Resume is disabled outside pause. Results read the controller's frozen result, show survival seconds to two decimals and hits taken, and focus their heading. Keyboard traversal reaches Retry/Home, and Home restores focus to Start. HUD control space is retained during results to prevent arena shifts. No independent React clock or result scoring is added.

The eleven React tests cover Home content/links, Start, Strict Mode cleanup, HUD values/rounding, pause/disabled Resume, results Retry/Home, focus restoration, discarded-runtime publications, CSS Modules, persistence/deduplication/remount identity, compatible bests, and storage failures. Browser accessibility checks use semantic role/name locators, native keyboard activation, focus and disabled-state assertions, quiet timer output, and layout checks. Retry/Home precede expandable history in the result panel's tab order. A screen-reader audit and automated axe audit were not performed.

## Local Attempt Records

[attempts.ts](app/src/storage/attempts.ts) owns the injected storage boundary; it imports no Phaser, React, or browser globals. App supplies a guarded getter for `window.localStorage`. The key is `dodge-hell-training.attempts`; the JSON envelope is `{ schemaVersion: 1, records: [...] }`. Each death record contains a unique `id`, `rulesVersion`, finite nonnegative `elapsedSeconds`, safe-integer nonnegative `hitsTaken`, and `outcome: "death"`. Runtime shape validation precedes all use. No type assertion substitutes for parsing/validation.

The session's synchronous `onResult` callback is wired at the application boundary, not from HUD renders. A random per-runtime namespace plus controller attempt ID prevents collisions after Home/Start or refresh. A per-runtime delivery guard, disposed-effect guard, and stored-ID deduplication prevent repeated callbacks/retries from recording twice. Aborted attempts have no death callback. Simulation, controller, and engine files need no persistence changes.

Records are newest-first, deduplicated, copied/frozen, and bounded to the configured latest 100 completed attempts across all rules versions. The displayed retained best is the longest time among retained records matching the current rules; incompatible records remain visible as **Other rules** and are excluded from that best. There is no separately durable all-time best: removing an old best through retention can lower the retained best. Zoom is not a scoring field or compatibility key.

Unavailable storage, blocked reads, invalid JSON, unknown schema versions, or malformed records switch this visit to in-memory history with a visible warning. Unreadable stored data is preserved, not overwritten or migrated. Quota/write failures also retain current/later results in memory and stop repeated failed writes. No refresh-persistence guarantee is made in fallback mode. Storage is browser-profile/origin-specific (different localhost ports have separate histories); there is no cross-tab merge, cloud sync, export, settings UI, or backend.

The 25 Node adapter tests use an injected storage fake and cover serialization/reload, deduplication, retention, compatibility, corrupt/unknown/malformed data, blocked getters/reads, quota failures, and immutable copies. Run from `app/` with `npm.cmd run test -- --project node src/storage/attempts.test.ts`. The focused browser command is `npm.cmd run test:e2e -- --grep "death results|loaded history|storage still"`.

Manual persistence check: at the current preview origin, complete one attempt, note the history count/best, immediately Retry, then Home and reload. The completed record should remain once; aborting the new attempt should not increase the count. Start must remain usable. Automated Chromium checks verify this real-death/reload flow and storage failures. The shared integrated browser loaded the new Home but mouse/keyboard automation timed out during an additional interactive check; that interactive refresh check is not claimed as passed.

## Session Lifecycle

[session.ts](app/src/game/session/session.ts) owns the pure `home -> countdown -> playing -> paused/ended` flow. It consumes only supplied active seconds; there are no timers, browser imports, or asynchronous result queues. Start and retry share initialization through `createSimulation()`. Start uses the configured three-second countdown without advancing any gameplay; retry uses zero countdown and replaces all simulation state, including combat, shard hit flags, burst/cooldown, positions, counters, and accumulator. Phaser remains the only runtime driver and does not recreate the game on retry.

Death produces one frozen `AttemptResult` with attempt identity, rules version, survival duration, and hits. `advance()` returns that result only on the lethal transition; the adapter's synchronous optional `onResult` handoff now feeds the application's history adapter. Home/retry aborts do not produce completed results or records. Retry clears the prior result and never reuses the old simulation object. Zoom is a viewing preference retained across retry and Home/Start during the app visit, not part of simulation reset. React consumes the bounded snapshots and persisted-history summary without another simulation clock.

Run the 16 focused Node lifecycle cases from `app/`:

```powershell
npm.cmd run test -- --project node src/game/session/session.test.ts
```

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
| Phaser                                        | 4.2.1; integrated runtime, input, camera, and drawing                 |
| @flatten-js/core                              | 1.6.14; typed, framework-independent collision geometry               |
| Vitest / jsdom                                | 5.0.5 / 30.1.3                                                        |
| React Testing Library / jest-dom / user-event | 16.3.3 / 7.0.1 / 14.6.8                                               |
| Playwright Test / create-playwright           | 1.64.1 / 1.17.139                                                     |

TypeScript was upgraded through npm; other compatible packages were refreshed and were already current within their supported ranges. A clean `npm ci`, lint, and the TypeScript/production build pass with this toolchain. The original bootstrap record below is historical, not the current runtime requirement.

The Chromium suite verifies the complete Home/session/results flow. The Start/Home lifecycle check includes uncaught-page-error assertions; render checks inspect actual canvas pixels and save screenshots.

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

The generated lint script uses Oxlint. Typecheck uses the generated TypeScript project references (`tsc -b`), including test/tooling files. The existing Node test project includes DOM types for code evaluated inside browser pages; runtime domain tests still run without browser globals. The build script runs that same check followed by the Vite production build, producing ignored output in `app/dist/`. All five commands passed on 2026-10-24 (193 Vitest tests and seventeen Chromium checks). Build reports a nonblocking large-chunk warning for the initial Phaser bundle (about 1.70 MB minified / 456 kB gzip); no warning limit was raised.

Use `npm run test:watch` during development. Vitest runs `src/**/*.test.ts` in Node without DOM setup; reserve that convention for pure models, configuration, simulation, and adapters. React tests use `src/**/*.test.tsx` in jsdom with jest-dom matchers and automatic cleanup. Only CSS Modules are processed in jsdom; a test-only stylesheet verifies scoped class names and computed styles. Full page styles run in Chromium, not jsdom.

Install the required browser on each new machine or after a Playwright browser-version upgrade, from `app/`:

```powershell
npx.cmd playwright install chromium
```

On other platforms, use `npx` instead of `npx.cmd`; Linux may also need Playwright's [browser system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies). Browser binaries are cached outside the repository. `npm ci` alone does not install them.

Playwright starts the local Vite CLI from `app/` using the current Node executable at http://127.0.0.1:4173/. Keep that test port free: `reuseExistingServer: false` and Vite's `--strictPort` intentionally reject an occupied port instead of testing an unrelated server. Local runs use two Chromium workers after eight simultaneous Phaser instances caused GPU stalls/timeouts; CI retains one worker. The runner stops its own server afterward. Tests never navigate to external websites; traces on failure live in ignored `app/test-results/`. No CI workflow is introduced in this step.

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

- [Implementation plan](implementation-plan.md): phased prompts, dependencies, acceptance criteria, and execution records. Next: step 6.1, only when requested.
- [Mechanics contract](docs/mechanics.md): sourced rules, delegated decisions, and explicit fidelity limitations.
- [Original draft](first-draft.md): initial design intent.
- [Generated template notes](app/README.md): upstream starter documentation, retained unchanged.

Implement one step at a time with `/implement-step <step-id>`. Completing a step does not automatically authorize later steps, a commit, or a push.

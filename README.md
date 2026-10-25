# Dodge Hell Training

A pure-frontend bullet-hell practice game targeting repeated survival training against the Crystal Worm Child Head from Realm of the Mad God.

## Current V2 State

The preset is `crystal-worm-child-head-paladin-v2`: shared polygon bodies/collision, eleven-shot spirals, persisted zoom, a below-player health bar, individual hit amounts, original quiet hit audio with visit-local mute, and accessible Home/HUD Controls with explicit pause safety.

[The active plan](implementation-plan.md) records actual execution. Step 14.1 passed all five gates on 2026-10-25: 292 unit/component tests and 27 Chromium cases. Geometry G01-G04 was explicitly approved; the user delegated remaining technical acceptance and sequential publication. No fresh human playtest/listening approval, exact ROTMG fidelity, Firefox/WebKit certification or touch support is claimed.

Site: https://raphaelbp12.github.io/dodge-hell-training/. Publication is authorized, but **v2 hosted verification belongs to step 14.3**, after actual Actions/deployment and live checks. Historical v1 evidence below is not evidence for a newer build. Use the local server's printed URL with the `/dodge-hell-training/` prefix; origins/ports have separate storage.

## V2 Contract

[The mechanics contract](docs/mechanics.md#implemented-v2-handoff) records provenance and fidelity limits. [Canonical geometry](app/src/game/config/geometry-candidate.ts), [encounter config](app/src/game/config/encounter.ts) and [pure geometry](app/src/game/simulation/geometry.ts) own the implementation.

| Quantity | Implemented Value |
| --- | --- |
| Paladin | 775 HP, 32 DEF, 41 SPD, 42 VIT; unchanged fixed equipment/stat formulas |
| Arena/spawn | Radius 19.2 tiles; player `(0,0)`, head `(0,-16.2)` |
| Physical shapes | Upright player/head octagons, pointed symmetric shard hexagon; shared drawing/collision vertices and transforms |
| Emission | Four emitters, eleven shots each, 0.15 s spacing, 1 s after last shot, initial 2 s cooldown, clockwise 45 degrees/s |
| Offset/speed/damage | 0.18532903718071878 tile (10% head width), 8 tiles/s, incoming 160 HP, accepted post-defense 128 HP |
| Reversal/lifetime | 2.2208044714307382 / 4.4416089428614765 seconds; exact polygon leading-edge calibration, not rounded to ticks |
| Reach/bound | 19.2 tiles from a stationary centered head to leading body edge; 44 shards/group, period 2.5 s, conservative live bound 88 |
| Camera | 32 CSS pixels/tile at zoom 1; zoom 0.25-3, default 1, step 0.125 |
| Clock | One Phaser driver; pure simulation at 1/60 s, max eight ticks/advance, no inactive-time catch-up |
| History | Latest 100 completed deaths, exact-version best; v1 retained as Other rules and excluded from v2 bests |

Pursuit stops at direction-dependent silhouette contact with zero extra gap. Actual vertices constrain player/head to the circle; broad-phase rejection never proves a hit. Swept polygon contact uses existing reversal/expiry segments and matching player interpolation. Shards retain initial firing-axis orientation, expire only by lifetime and hit once via per-shard state. No origin/homing, collision/wall/offscreen despawn, global immunity, player attacks, contact damage or blocking.

[Simulation](app/src/game/simulation/simulation.ts) returns only the current advance's individual accepted hits, including lethal post-defense amounts. [Session](app/src/game/session/session.ts) forwards them once before frozen results. React receives bounded HUD/result summaries, never per-projectile frame state; Phaser owns drawing/input/camera and the only runtime clock.

## V2 Controls And Feedback

| Input | Action |
| --- | --- |
| WASD | Move; diagonals normalized |
| R / Retry | Immediate fresh attempt, no retry countdown; held R does not repeat |
| O / P | Zoom out / in; exact valid values persist across same-origin reload |
| Escape | Pause/resume active play; in Controls, close only and stay paused |
| Controls | Home/HUD native modal; freezes play/countdown and blocks background gameplay keys |
| Resume | Deliberately resume after focus loss, pause or closing session Controls |
| Mute | Visit-local hit-audio checkbox, independent of accepted hits/history |
| Home | Abort unfinished attempt, remove runtime and focus Start |
| Tab / Shift+Tab, Enter / Space | Standard UI navigation/activation; Controls contains focus and restores its opener |

Start counts down for three active seconds. Focus loss clears held input and pauses; no stale movement/time catch-up. Zoom/resize never changes speed, collision, scoring or rules identity. Keyboard is required at narrow widths; no touch controls.

The authoritative Phaser health bar stays 48x6 CSS pixels below the body at every zoom. Individual -128 numbers use 18 px text, 0.9 active seconds, a 16-text cap, paused aging and Retry/Home cleanup. Final-update amounts remain individually visible in immediate results without delaying death. Original [hit synthesis](app/src/game/phaser/hit-audio.ts) borrows Phaser's context: 55 ms sine cue, gain 0.018, max four voices. Muted/suspended/unsupported cues drop without catch-up. Numeric presentation policy is delegated trainer design, not human audible approval.

[History](app/src/storage/attempts.ts) saves deaths once at `dodge-hell-training.attempts`, schema 1; R/Home aborts save nothing. [Zoom](app/src/storage/zoom.ts) independently stores a JSON number at `dodge-hell-training.zoom`, restores before first render and writes only actual O/P changes. Valid fractions are not snapped. Invalid/blocked/quota storage preserves unreadable data and falls back for the visit. No history migration, mute persistence, backend or accounts.

## V2 Verification And Handoff

Step 14.1: 292 unit/component tests, typecheck, lint, build and 27 Chromium cases passed. Coverage includes pure geometry/cadence/health/lifecycle, actual desktop/narrow min/default/max feedback pixels, real deaths/results, zoom reload, mute/audio failure, Controls/focus/pause, mixed history and storage failure. Five-minute 30/60/120 Hz schedules agree on 1313 volleys. The 60-second browser run observed three deaths, peak 88 shards/5 texts/1 sampled voice, and 25 retries retaining one canvas/listener set. These are machine-specific observations, not universal FPS/leak certification.

Technical acceptance is delegated by the batch request, preserving earlier G01-G04 approval. Human feel/listening comfort, Firefox/WebKit, physical mobile input, screen readers and axe remain unverified. The initial Phaser bundle is about 1.72 MB with a retained nonblocking warning. Reference screenshot/crops remain local-only, ignored and absent from runtime assets; public distribution rights are unapproved.

Manual practice checklist:

1. Start, move with WASD, inspect clockwise eleven-shot groups and returning polygons.
2. Change O/P to both extremes, reload then Start; verify restored scale and readable bar/numbers.
3. Take independent hits, toggle Mute, let a real death show final amounts and save once.
4. Open Controls from Home/HUD, close by Escape/Close; verify frozen play/countdown until Resume and no held-input replay.
5. Repeat R/Retry/Home/Start; aborts add no records, and v1 remains Other rules without raising the v2 best.

<details>
<summary>Historical V1 Implementation And Acceptance (Superseded By V2 Above)</summary>

The following sections through Training-Feel Review preserve the v1 handoff. Circles, four-shot groups, 1.2/2.4 s timing, 0.75-1.5 zoom, old counts and preview URL are historical only. Current behavior is the v2 contract above; phase 1-7 execution evidence remains in [the v1 archive](docs/implementation-plan-v1.md).

## Historical V1 State

Step 6.1 is complete: technical validation passed, and the user accepted the current implementation on 2026-10-24. Adjustments are deferred until after the full plan, as requested. No tuning changed; rules version remains `crystal-worm-child-head-paladin-v1`, with known trainer-fidelity limitations retained.

Step 7.1 is complete and user-approved on 2026-10-24. All six Actions jobs and the Pages deployment passed for `5db1674`. Step 7.2 is complete under delegated technical release acceptance: live repeated-practice checks passed, and the shipped gameplay baseline remains the implementation previously accepted in step 6.1. Play at https://raphaelbp12.github.io/dodge-hell-training/. This does not claim a fresh human playtest, exact ROTMG fidelity, Firefox/WebKit certification, or touch support.

The live gameplay verified during this handoff was `5db1674`, with JS/CSS SHA-256 hashes matching the local production build. Step 7.2's test/handoff updates and unused-starter cleanup do not change that gameplay. Subsequent pushes and deployments need their own Actions evidence; the recorded release checks do not claim a newer deployment.

Home and results display local recent attempts and the retained personal best for the current rules version. Completed deaths save once; unfinished retries/Home do not create records. Storage failures leave practice usable with visit-only history and a warning. Start/countdown, the health/stat HUD, pause, immediate Retry, and zoom remain unchanged.

Current local production preview: http://127.0.0.1:5176/dodge-hell-training/. Existing development servers were preserved; use the `/dodge-hell-training/` prefix on those ports too. Histories are origin-specific and do not transfer between preview ports.

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

From `app/`, run the focused 96-case simulation/health suites (80 simulation cases and 16 pure health cases):

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

Manual check: open http://127.0.0.1:5176/dodge-hell-training/, review Home, and select **Start** (or press Enter while it is focused). Observe the three-second countdown, then move with WASD and change zoom with O/P. Press R during countdown, a burst, pause, or after death: the attempt resets immediately without another countdown and retains zoom. Hold R to confirm it does not continually restart. Escape pauses/resumes active play; switching focus away leaves play paused until **Resume** or an explicit keyboard action. Let the player die and compare results with the HUD, then use **Retry** or **Home**. Home discards an unfinished attempt, removes the canvas, and focuses Start. Starting again counts down and retains visit-long zoom. Narrow screens show a keyboard requirement, not touch controls.

Eighteen development-server Chromium checks cover countdown, immediate/held/repeated R, burst/death/paused retry, same-frame event replay, input clearing, retained zoom, repeated mounts/one canvas/one effective keyboard handler, movement/camera/zoom, focus/visibility safety, scoped key cancellation and cleanup, resize invariance, and real combat. They also verify real death records, refresh persistence, retry/abort deduplication, compatible bests, corrupt/blocked/quota storage fallback, and 60 seconds of sustained play followed by 25 retries. Desktop (1440x1000) and narrow (390x844) Home/history/arena/results screenshots, canvas-pixel checks, and layout assertions verify readable nonblank gameplay, unclipped text, viewport-contained results, and stable arena geometry. Screenshots are saved under ignored `app/test-results/`.

Two production Chromium checks use built output without importing dev-only diagnostic modules. At 1440x1000 and 390x844 they verify the Pages pathname/assets, countdown and initial cooldown, rendered shards and health loss, two actual deaths, result metrics, button Retry plus repeated R, Home cleanup/abort, and valid deduplicated records/bests surviving refresh. Desktop additionally checks WASD through rendered camera-relative motion and O/P through rendered player size; both check pause/resume, readable layout, nonblank canvas pixels, and static same-origin requests only. The same tests can target the live site explicitly, as documented below. Screenshots and JSON evidence remain ignored under `app/test-results/`.

## Controls

| Input  | Action                                                               |
| ------ | -------------------------------------------------------------------- |
| WASD   | Move north/west/south/east; diagonals normalized                     |
| R      | Immediately reset the attempt without countdown; ignore held repeats |
| O / P  | Zoom out / in; viewing preference persists during this app visit     |
| Escape | Pause/resume active play                                             |
| Resume | Explicitly resume after focus loss or pause                          |
| Retry  | Start again immediately, including from results                      |
| Home   | Discard an unfinished attempt and return to Home                     |

Start has a three-second countdown. Changing focus pauses play and clears held input. Keyboard input is required even at narrow widths; no touch controls are implemented.

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

Manual persistence check: at the live URL or current preview origin, complete one attempt, note the history count/best, immediately Retry, then Home and reload. The completed record should remain once; aborting the new attempt should not increase the count. Start must remain usable. Automated Chromium checks now verify two real-death/reload flows on Pages as well as the existing local storage-failure coverage. An earlier additional shared-browser interaction timed out; it is not counted as a human playtest or release evidence.

## Session Lifecycle

[session.ts](app/src/game/session/session.ts) owns the pure `home -> countdown -> playing -> paused/ended` flow. It consumes only supplied active seconds; there are no timers, browser imports, or asynchronous result queues. Start and retry share initialization through `createSimulation()`. Start uses the configured three-second countdown without advancing any gameplay; retry uses zero countdown and replaces all simulation state, including combat, shard hit flags, burst/cooldown, positions, counters, and accumulator. Phaser remains the only runtime driver and does not recreate the game on retry.

Death produces one frozen `AttemptResult` with attempt identity, rules version, survival duration, and hits. `advance()` returns that result only on the lethal transition; the adapter's synchronous optional `onResult` handoff now feeds the application's history adapter. Home/retry aborts do not produce completed results or records. Retry clears the prior result and never reuses the old simulation object. Zoom is a viewing preference retained across retry and Home/Start during the app visit, not part of simulation reset. React consumes the bounded snapshots and persisted-history summary without another simulation clock.

Run the 16 focused Node lifecycle cases from `app/`:

```powershell
npm.cmd run test -- --project node src/game/session/session.test.ts
```

## Training-Feel Review

Step 6.1's [technical review](docs/mechanics.md#step-61-technical-review) and [execution record](docs/implementation-plan-v1.md#step-61---tune-and-approve-the-encounter) separate verified wiki formulas from trainer choices. Pursuit, camera scale, hitboxes, rotation/cadence, reversal/lifetime interpretation, and exact health integration remain intentional or provisional approximations. No tuning or rules-version change was made, and no current-client fidelity is claimed.

Under delegated decision-making, validation used five simulated minutes at each of 30/60/120 Hz, 60 seconds of browser play, and 25 consecutive retries. All schedules matched exactly with a 16-shard peak. The final browser run observed 59.98 simulated seconds, no deaths, one canvas/handler, and approximately 16.7/16.7/16.8 ms median/p95/max animation-frame gaps. These are machine-specific observations, not a universal FPS or memory-leak guarantee; separate browser cases cover real deaths and the complete results/history loop. Generated JSON metrics and screenshots remain under ignored `app/test-results/`.

Open http://127.0.0.1:5176/dodge-hell-training/ with a keyboard and review:

1. Start, move with WASD, and compare movement speed, camera scale, and O/P zoom.
2. Watch the clockwise pattern, four-shot bursts, cooldown, and returning shards; assess collision fairness.
3. Take hits and assess damage and regeneration, then let the attempt end and inspect results/history.
4. Use R/Retry repeatedly, Escape/Resume, and Home/Start; confirm a predictable reset and comfortable practice loop.
5. For future tuning, note desired changes without altering the accepted baseline. The user accepted the current implementation for now on 2026-10-24 and deferred adjustments until after the full plan. Step 6.1 is complete; steps 7.1/7.2 subsequently supplied deployment and technical release evidence. Future adjustments still require approval and comparison-breaking changes require a rules-version bump.

</details>

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

Open the URL printed by Vite, normally http://127.0.0.1:5173/dodge-hell-training/. If that port is occupied, Vite chooses another available port. The project prefix is configured in `app/vite.config.ts` for both development and production. The server is local-only with this command. Stop it with Ctrl+C in its terminal.

In Windows PowerShell 5.1, use `npm.cmd` when forwarding flags after `--`: npm 12's PowerShell entry point did not preserve the separator in the checked environment. On other platforms, use `npm` instead of `npm.cmd`.

## Validation And Build

Current v2 evidence is step 14.1: all five commands passed with 292 unit/component tests and 27 Chromium cases. Dated step 7.2 counts below are retained historical v1 evidence, not the current suite size. Step 14.2 reruns relevant checks for handoff edits; step 14.3 separately records deployed evidence.

Run these from `app/`:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The generated lint script uses Oxlint. Typecheck uses the generated TypeScript project references (`tsc -b`), including test/tooling files. The existing Node test project includes DOM types for code evaluated inside browser pages; runtime domain tests still run without browser globals. The build script runs that same check followed by the Vite production build, producing ignored output in `app/dist/`. All five commands passed for step 7.2 on 2026-10-24: 194 Vitest cases and twenty local Chromium cases; the browser run used `--workers=1 --output=test-results/local-release` and took about 4.9 minutes. Build reports a nonblocking large-chunk warning for the initial Phaser bundle (about 1.70 MB minified / 456 kB gzip); no warning limit was raised.

Use `npm run test:watch` during development. Vitest runs `src/**/*.test.ts` in Node without DOM setup; reserve that convention for pure models, configuration, simulation, and adapters. React tests use `src/**/*.test.tsx` in jsdom with jest-dom matchers and automatic cleanup. Only CSS Modules are processed in jsdom; a test-only stylesheet verifies scoped class names and computed styles. Full page styles run in Chromium, not jsdom.

Install the required browser on each new machine or after a Playwright browser-version upgrade, from `app/`:

```powershell
npx.cmd playwright install chromium
```

On other platforms, use `npx` instead of `npx.cmd`; Linux may also need Playwright's [browser system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies). Browser binaries are cached outside the repository. `npm ci` alone does not install them.

With `PLAYWRIGHT_LIVE_URL` unset, build before running `test:e2e`: its production project requires current `app/dist/` output. Playwright starts a Vite development server on port 4173 and production preview on 4174, both under `/dodge-hell-training/`, deriving the prefix from Vite configuration. Keep both ports free: `reuseExistingServer: false` and `--strictPort` reject occupied ports instead of testing unrelated servers. The development project retains diagnostic imports; the production project tests only public UI and built assets. Local runs default to two Chromium workers; CI uses one. To reproduce that setting locally, use `npm.cmd run test:e2e -- --workers=1`. The runner stops both of its servers afterward. Default runs never navigate to external websites; hosted verification is an explicit opt-in below. Failure traces, screenshots, and soak metrics live in ignored `app/test-results/`.

## Hosted Release Verification

The command below now exercises current v2 production-safe Controls, pause, persisted rendered zoom, bar/numbers/lethal feedback, mute and real versioned death records. Current v2 run/deployment identity and outcome are recorded in step 14.3 of the active plan. The dated step 7.2 hosted outcomes/acceptance below are historical v1 only.

From `app/`, after installing dependencies and Chromium, run only the two production-safe tests against Pages:

```powershell
$env:PLAYWRIGHT_LIVE_URL = 'https://raphaelbp12.github.io/dodge-hell-training/'
try {
	npm.cmd run test:e2e -- --project live-chromium --workers=1 --output=test-results/live-release
} finally {
	Remove-Item Env:PLAYWRIGHT_LIVE_URL
}
```

Hosted mode starts no localhost servers, needs no local build, and excludes every source-diagnostic test. Each case uses a fresh isolated browser context; real death records are created only in that context, never in the user's browser profile. Keep the environment variable unset for the normal local/CI suite. Separate output subdirectories preserve local and live evidence when running both.

Step 7.2's actual hosted run passed both cases in about one minute at https://raphaelbp12.github.io/dodge-hell-training/. Four real completed attempts across two isolated contexts were saved, compared with the results UI, retained across refresh, and not duplicated by aborted retries. Live requests contained only same-origin static GETs, with no API, XHR/fetch/WebSocket, application token, or server secret required. Gameplay JS/CSS SHA-256 hashes matched the rebuilt local output exactly. Saved Home/arena/results/history screenshots and per-width JSON reports are under ignored `app/test-results/`; desktop arena and narrow Home/arena/results were visually reviewed alongside pixel/layout assertions.

Acceptance outcome: the user had already explicitly accepted this unchanged gameplay baseline in step 6.1 and approved deployment in step 7.1. When presented the completed release checks and Chromium-only scope, the user delegated the release decision for later review. The agent accepted the technical handoff under that delegation; no fresh user playtest is claimed. The vertical slice is shipped at the live URL under this limited release baseline, not certified for every browser or exact ROTMG behavior.

Remaining limitations: only desktop Chromium was exercised, including keyboard-driven narrow layout; Firefox, WebKit/Safari, physical mobile input, screen readers, and an axe audit were not tested. History is origin/profile-specific and bests cover only the latest 100 compatible retained deaths. Known provisional pursuit/hitboxes/camera/cadence/range interpretation and health-integration differences remain in the mechanics contract. Future tuning lives in the named `ENCOUNTER_CONFIG`, `STAT_RULES`, and Paladin data listed above; approval and versioned comparisons still apply. The Phaser bundle warning is unchanged. No backend, account system, custom deployment secret, or new gameplay feature was added.

To serve the production build locally, run:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

Use the URL printed by the preview command. Preview also defaults to port 4173, so stop it before running browser tests.

## GitHub Pages Setup

The six-job workflow remains current; its browser suite now contains 27 cases. The deployment IDs/commit and old suite counts in the following dated setup history describe the first v1 release. They must not be used to claim current v2 deployment success; see active step 14.3 for that evidence.

The repository is [raphaelbp12/dodge-hell-training](https://github.com/raphaelbp12/dodge-hell-training), with default branch `main`. The verified live project-site URL is https://raphaelbp12.github.io/dodge-hell-training/. [Actions run 40117403684](https://github.com/raphaelbp12/dodge-hell-training/actions/runs/40117403684) succeeded for `5db1674`, including all six jobs and deployment `7302230739` at `2026-10-24T17:49:16Z`. Initial metadata reported Pages disabled before setup; the unauthenticated Pages metadata endpoint later still returned 404 despite successful publication and live HTTP 200, so that endpoint alone must not be used to diagnose site availability. No custom domain or remote settings change was made by the assistant.

[The workflow](.github/workflows/pages.yml) validates pull requests and every push to `main` on Ubuntu 24.04. It selects Node 24.22.1 from `.node-version`, pins npm 12.2.1, caches npm data against `app/package-lock.json`, runs `npm ci` from `app/`, and installs Chromium/system dependencies with `npx playwright install --with-deps chromium`. Lint, typecheck, unit/component tests, build, and the default local browser suite gate publication. The published run used the previous nineteen-case suite; the step 7.2 harness expands it to twenty. Hosted mode is opt-in, not a network dependency added to CI. Browser artifacts are retained for seven days, including on failures when the run is not cancelled.

The Actions graph shows six separate jobs: **Lint**, **Typecheck**, **Unit Tests**, **Build**, **Browser Tests**, and **Deploy Pages**. The first three use a matrix with fail-fast disabled so each reports its own result; they run in parallel with Build. Build shares a one-day `production-build` artifact containing only `app/dist`. Browser Tests downloads it before running the full suite, and Deploy Pages downloads that same build only after every check and browser test passes. No rebuild occurs between browser verification and publication. Each job has an isolated runner and its own dependency installation; npm caching reduces repeated download cost, rather than sharing `node_modules`.

Pull requests never upload a Pages artifact or deploy. Only successful `main` pushes upload `app/dist` through the official Pages artifact action. A dependent deployment job uses the official configure/deploy actions and `github-pages` environment. Validation has only `contents: read`; only deployment has `pages: write` and `id-token: write`. Checkout does not persist credentials. Per-ref concurrency serializes runs without cancelling an in-flight deployment. Pages auto-enablement is explicitly disabled. No backend, custom token, application secret, or repository-settings change is needed or performed by the local implementation.

Configuration for future setup or troubleshooting:

1. In [repository Pages settings](https://github.com/raphaelbp12/dodge-hell-training/settings/pages), select **Build and deployment -> Source -> GitHub Actions**, not a publishing branch.
2. Ensure Actions permits the official `actions/*` actions and the `github-pages` environment permits deployment from `main`; satisfy any required environment reviews.
3. Commit/push always requires separate authorization. Initial setup and the split-job workflow were published as `8dff4d0` and `5db1674` after explicit authorization. A main-push workflow must complete successfully; a passing PR check alone is not deployment evidence.
4. For each release, record the successful run/commit and emitted deployment URL. The step 7.1 live smoke and step 7.2 controls/combat/persistence/responsive checks have passed for this published gameplay baseline. Future changes still need their own validation and separately authorized commit/push.

Local workflow validation passed with checksum-verified actionlint 1.7.12. The six-job Ubuntu 24.04 workflow and Pages publication are verified. Step 7.2's expanded live checks used isolated Chromium at 1440x1000 and 390x844 without modifying the user's existing browser storage. Its delegated technical acceptance is recorded above; no cross-browser certification is claimed. Check subsequent workflow runs separately rather than treating this handoff's deployment evidence as evidence for a newer commit.

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

- [Implementation plan](implementation-plan.md): phased prompts, dependencies, acceptance criteria, and execution records. Steps 7.1 and 7.2 are complete; release evidence and delegated acceptance limitations are recorded explicitly.
- [Mechanics contract](docs/mechanics.md): sourced rules, delegated decisions, and explicit fidelity limitations.
- [Original draft](first-draft.md): initial design intent.

Implement one step at a time with `/implement-step <step-id>`. Completing a step does not automatically authorize later steps, a commit, or a push.

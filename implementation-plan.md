# Vertical Slice Implementation Plan

## Purpose And Execution

Deliver a pure-frontend ROTMG-inspired training game: repeatedly survive against the Crystal Worm Child Head, inspect results, and retry immediately.

This is a plan, not authorization to implement all phases at once. Each numbered step below is an implementation prompt. Run one at a time with `/implement-step <step-id>`, for example `/implement-step 2.1`. A smaller model should read the shared contract below, then execute only the requested prompt. Dependencies must be complete first.

All steps start pending. After completing a step, replace its status with `complete`, record the actual checks and outcomes below its prompt, and note any approved deviations. Do not mark a step complete when its required checks are blocked. Do not automatically start the next step.

## Sources And Decision Authority

- [Original draft](first-draft.md): original requirements and project intent. Keep it intact.
- This plan: consolidates subsequent user decisions and the approved technical approach. Later explicit user decisions override older statements; record changes here.
- Step 1.1 will produce a sourced mechanics specification. Do not treat user-supplied wiki numbers or proposed formulas as independently verified facts.
- Never silently resolve a gameplay ambiguity. Research it, explain alternatives, and ask the user for approval before dependent implementation.

## Confirmed Design

- React application, pure frontend, deployed to GitHub Pages on every push to `main`.
- Home screen with a prominent Start button, description, changelog, and links. The requested home screen is intentional, not a marketing landing page.
- Desktop keyboard play: WASD movement; R immediately retries; O zooms out; P zooms in.
- Endless survival until death. No player attacks or seal activation in this slice.
- One fixed, average unpotted level-20 Paladin. Include passive bonuses from a T10 sword, T10 heavy armor, T4 seal, and T4 health ring. Verify exact items, average-stat methodology, bonuses, and rounding before assigning values. Every attempt uses identical stats.
- Visible primary attributes: health, vitality, speed, defense. Derive gameplay values through verified rules rather than embedding formulas in UI code.
- Circular arena; player spawns at its center and enemy near an edge. No shrinking floor or hazards.
- The head slowly chases the player, slower than the configured Paladin. This intentionally replaces the wiki's wandering behavior.
- Four emitters, spaced 90 degrees apart, rotate clockwise. Every emitter fires four projectiles per burst, separated by a short interval, followed by cooldown. Rotation continues between shots so their origins and directions differ. Each projectile fires radially outward from its emitter's current position.
- Enemy begins in its firing cooldown. Exact timing and angular speed need research or approved playtesting values.
- Shards travel along their initial direction, reverse velocity once at a configured age, and expire only at their configured lifetime. No stored firing origin or homing target is needed. Enemy movement never changes an existing shard's trajectory.
- A shard can damage the single player only once in its lifetime. Store `hasHitPlayer` per shard. It remains alive after a hit, overlap, or return collision. Do not remove it at arena boundaries or when offscreen.
- Draft shard values: 160 damage, 8 tiles/second, 19.2-tile range. These require source verification, including the meaning of range for a returning projectile.
- Player-centered camera, seeking ROTMG fidelity, with O/P zoom. Exact framing, limits, and any camera rotation behavior require approval.
- Placeholder geometric graphics are acceptable. Gameplay readability and fidelity take priority over final artwork.
- Local attempt history and comparisons support repeated practice; no backend, accounts, or online leaderboard.

## Approved Technical Approach

- Application in `app/`; planning and project-shared Copilot customizations at repository root.
- React + TypeScript + Vite, generated with the official CLI. npm with a committed lockfile.
- Phaser for input integration, game loop, camera, and drawing. Use its lifecycle and supported APIs instead of hand-building a rendering engine.
- CSS Modules for web UI; no component framework is needed for this slice.
- Vitest for pure logic tests; React Testing Library for React interaction tests; Playwright for browser integration checks.
- A fixed-step, framework-independent simulation owns gameplay. Phaser adapts input and renders its state; React renders session summaries and low-frequency HUD updates.
- Do not introduce a backend, ECS, dependency injection framework, event bus library, state library, generic plugin system, or custom physics engine without a demonstrated need.

## Architecture

Create folders only when their step introduces actual code. Names below describe ownership, not a requirement to create empty scaffolding.

| Boundary | Suggested home under app/src | Owns | Must not depend on |
| --- | --- | --- | --- |
| Models | game/models | Typed entities, inputs, snapshots, session states | React, Phaser, storage |
| Configuration/data | game/config | Validated stats, encounter values, units, preset version | React, Phaser, browser APIs |
| Simulation/rules | game/simulation | Fixed-step movement, pursuit, burst scheduling, shards, damage, regeneration, elapsed time | React, Phaser, DOM, localStorage |
| Session application layer | game/session | Start, pause, resume, death, retry, result handoff | UI components, drawing details |
| Engine adapter/drawing | game/phaser | Phaser lifecycle, keyboard sampling, camera, geometry, render order | Persistence internals |
| Web components | ui | Home, HUD, results, accessible controls | Per-frame entity mutation |
| Persistence adapter | storage | Versioned local records and safe reads/writes | Phaser |

Use simple modules and functions, adding interfaces only at actual external boundaries. React must not update state for every projectile on every frame. Do not run independent React and Phaser simulation clocks. All gameplay uses tiles and seconds; conversion to pixels belongs to rendering. Prefer library collision utilities where suitable, but isolate them behind pure rules and test high-speed crossings. Phaser automatic projectile destruction must not override lifetime-only expiration.

## Shared Prompt Contract

Every step prompt inherits these instructions:

1. Read this plan and applicable repository instructions. Check the requested step's dependencies and existing implementation before editing. Preserve unrelated changes.
2. Work only on this step. Apply YAGNI, DRY, SOLID, and TDD pragmatically: no speculative abstractions, duplicated rules, or unexplained gameplay literals. Use named constants/configuration with explicit units.
3. If a necessary design choice is missing, ask the user. Do not turn proposed mechanics into requirements or invent an allegedly authentic ROTMG value.
4. For testable behavior, write a focused failing test, run it to establish the expected failure, implement the smallest change, rerun it, then refactor only if needed. Documentation and generated scaffolding use appropriate structural/build checks instead of artificial unit tests.
5. Use official commands to generate the React bootstrap and install dependencies. Never manually recreate generated bootstrap files. Never delete existing work to make a generator accept the directory.
6. Keep game logic free from React/Phaser dependencies. Add coverage to nearby tests; do not create duplicate test harnesses.
7. Run the step's focused checks and relevant existing checks. Disclose unavailable tools, source access failures, and unverified behavior. Never claim that a test or deployment ran when it did not.
8. End with changed files, actual check outcomes, remaining blockers, and a concise manual verification procedure where relevant. Update this step's status only when its acceptance criteria are met.

## Phase 1: Mechanics And Scope Approval

### Step 1.1 - Produce The Sourced Mechanics Contract

Status: complete. Dependencies: none.

**Implementation prompt**

Act as a gameplay researcher and technical designer. Do not scaffold or implement the app. Create `docs/mechanics.md` from the confirmed design above. Research https://www.realmeye.com/wiki/crystal-worm-child and authoritative linked sources for the Paladin, specified equipment, movement, defense, vitality/regeneration, in-combat effects, hit detection, and camera behavior. Record source URLs, access date, values with units, and whether each entry is verified, user-defined, or still unknown. Distinguish behavior mandated by this trainer from authentic ROTMG behavior. If sources are inaccessible or insufficient, report that limitation rather than supplying remembered numbers as facts.

For Paladin base stats, document how averages across 19 level-ups are computed and how fractional results are rounded; verify passive item bonuses separately. Do not model unused attack or mana systems just because source tables contain them. For shards, resolve whether 19.2 tiles describes total travel or outward range; document reversal time and lifetime independently. Do not infer a lifetime solely from range divided by speed without establishing the source's range convention.

Present a compact approval checklist for unresolved encounter values: arena radius, spawn offset, enemy pursuit speed/stopping behavior, contact damage or body blocking, emitter radius/initial phase/angular speed, burst interval semantics and cooldown, shard return/lifetime, collision shapes, player damage/regeneration rules, camera framing/rotation/default scale/zoom limits. Also ask about countdown, pause/focus-loss behavior, result metrics, aborted attempts on R, zoom persistence across retry, and history retention. These were proposed during discussion but are not all explicitly approved. Offer clearly labeled recommendations to reduce decision effort.

Acceptance: the document distinguishes facts from assumptions and lists remaining questions. Stop for user approval before dependent implementation. Mark this step complete only after recording the user's decisions and all values/rules required by later steps; playtesting values may be explicitly approved as provisional. Do not create custom skills for knowledge that fits in this document.

**Execution record - 2026-10-24**

- Drafted [the mechanics contract](docs/mechanics.md), separating confirmed trainer rules, unknown external mechanics, conditional range calculations, and proposed tuning/session policies.
- RealmEye requests for the enemy, Paladin, stats, candidate equipment, combat rules, and controls returned only `Just a moment...` access-challenge content. Browser access to the enemy article also returned the challenge; no external numeric mechanics or item identities were verified.
- Later browser follow-up on the same date succeeded: rendered pages supplied the head's shot table, Paladin stats, movement/defense/regeneration formulas, combat rules, controls, and several item identities/bonuses. The mechanics contract now records these facts, corrected item-tier leads, and source inconsistencies. Initial fetch failures no longer mean browser research is blocked.
- User approved the encounter tuning table provisionally, selected reversal at 1.2 seconds and expiry at 2.4 seconds for the provisional total-path shard interpretation, and approved the camera/session/records table. Full decisions are recorded in the mechanics contract.
- Final decisions: the user delegated all three remaining clarification questions to the agent for autonomous decisions and later review. Adopted the published integer-average preset (775 HP, 32 DEF, 41 SPD, 42 VIT), excluded extra modifiers, selected the wiki's worked-example combat brackets (trigger 27, duration 5.32 seconds), and documented precise trainer damage/rounding/regeneration rules. These are delegated decisions, not claims of explicit numeric endorsement or exact client fidelity.
- Status complete under that delegation. The mechanics contract specifies the required rules and documents remaining fidelity limitations as approved/delegated approximations. No app scaffolding, gameplay implementation, or later step was started.
- Validation: earlier documentation checks passed for required sections, evidence labels/access date, links, conditional range and preset arithmetic, and absence of an app scaffold. Final checks additionally cover combat boundaries, health arithmetic, the completed approval checklist, and step status. No application tests apply yet.

## Phase 2: Command-Generated Foundation

### Step 2.1 - Generate And Verify The React App

Status: complete. Dependencies: 1.1.

**Implementation prompt**

Inspect installed Node/npm and the current Vite Node requirements. Explain any incompatibility and use a supported environment before proceeding. Ensure `app/` does not contain existing work; if it does, inspect it and ask before replacing anything. From the repository root, generate the bootstrap using `npm create vite@latest app -- --template react-ts`. Use the CLI, not hand-written package, HTML, TypeScript, or Vite bootstrap files. Run `npm install` from `app/` and retain the lockfile. Do not use a force flag or delete repository files to make generation work.

Keep the generated app initially; adjust generated files only for a demonstrated project requirement after generation. Keep the root draft and planning/customization files untouched. Ensure dependencies, output, and local test artifacts are appropriately ignored. Document the actual supported Node version and commands in a root README. Do not initialize another Git repository inside `app/` or commit changes.

Acceptance: `npm run lint` and `npm run build` pass from `app/`. Start the Vite development server on an available port, verify the generated page loads, report its URL, and record commands and generated-tool versions. No game implementation yet.

**Execution record - 2026-10-24**

- Confirmed step 1.1 complete and `app/` absent before generation. Node.js 22.20.0 / npm 11.7.0 satisfy create-vite 9.3.1 and Vite 8.3.5 engine requirements (`^20.19.0 || >=22.12.0`), checked through npm metadata and the Vite setup guide.
- Generated the official React TypeScript starter with `npm --yes create vite@latest app -- --template react-ts --no-interactive`. The extra flags accept npm's package-install confirmation and disable scaffold prompts; no bootstrap files were manually authored or existing files removed.
- Ran `npm --prefix app install`; retained the generated lockfile. Installation reported zero vulnerabilities. Installed React/React DOM 19.3.1, TypeScript 6.0.3, Vite 8.3.5, React plugin 6.1.2, and Oxlint 1.89.0.
- `npm --prefix app run lint` and `npm --prefix app run build` passed on the untouched scaffold. Build includes `tsc -b`. The current template uses Oxlint rather than ESLint; retained the generated choice without changing the approved application stack.
- Started `npm --prefix app run dev -- --host 127.0.0.1 --port 5173`; live local URL: http://127.0.0.1:5173/. The editor browser loaded the starter, verified its counter changes from 0 to 1, and confirmed every starter image loaded. No browser errors were reported by those checks.
- Added [the root README](README.md) with actual prerequisites, commands, versions, and current scope. Extended the generated app ignore rules for local test artifacts; retained dependency/build ignores. React components and generated app configuration remain unchanged.
- No game behavior, Phaser, test framework, CI/deployment workflow, commit, push, or later plan step was introduced. The development server is intentionally left available for local inspection.

**Toolchain follow-up - 2026-10-24**

- At the user's request, reviewed current tools and selected Node 24.22.1 LTS rather than the Node 26 Current release. Remaining installation/update choices were delegated to the agent for later review.
- Installed fnm 1.39.0 as a per-user WinGet portable package, installed/selected Node 24.22.1, and upgraded npm to 12.2.1 only inside the managed Node installation. The original system Node and PowerShell profile were not modified.
- Upgraded TypeScript to 7.0.2 through npm and refreshed compatible dependencies; retained Node types on 24.x to match the runtime. Lint and TypeScript/production build passed after the upgrade; install/update audits reported zero vulnerabilities.
- Added the root Node version file and app engine/package-manager metadata. Updated the README with current versions and reproducible Windows setup, keeping the original bootstrap record as history. No additional implementation step was started.
- Reinstalled with `npm --prefix app ci` after synchronizing lockfile metadata; lint, TypeScript/production build, and installed dependency checks passed. npm 12's PowerShell entry point misparsed forwarded Vite flags in this environment; verified `npm.cmd` forwards them correctly and documented that Windows-specific invocation.
- Restarted Vite explicitly under managed Node 24.22.1 / npm 12.2.1 at http://127.0.0.1:5173/. The page and every starter image loaded; a DOM click event changed the React counter from 5 to 6. Normal mouse-actionability automation timed out and is not claimed as passing; manual mouse review remains recommended. Version pins, lockfile engines, documentation links, and editor diagnostics were checked. No application components were changed for the update.

### Step 2.2 - Install Runtime And Testing Tools

Status: complete. Dependencies: 2.1.

**Implementation prompt**

Install Phaser using npm. Install compatible Vitest, jsdom, React Testing Library, jest-dom, and Playwright test packages through npm rather than editing dependency lists manually. Initialize Playwright with its official CLI and retain only configuration/tests relevant to this project; do not add an extra generated CI workflow because deployment and CI are owned by phase 7. Install the needed browser binaries through Playwright's command. Keep the app's generated TypeScript/lint configuration working.

Configure `test` as a single-run unit-test command, `test:watch`, `typecheck` using the generated TypeScript project references, and `test:e2e`. Separate pure simulation tests from DOM tests using the simplest supported configuration. Configure Playwright's web server to run from `app/`, use a known test port, and avoid accidentally testing an unrelated existing server. Add one minimal React render test and one browser smoke test for the existing app; do not leave example tests for external websites. Verify CSS Module support without adding a styling framework.

Acceptance: lint, typecheck, unit tests, production build, and the local browser smoke test pass. Document exact commands and any environment prerequisites. Do not introduce game behavior yet.

**Execution record - 2026-10-24**

- Confirmed step 2.1 complete and retained the generated starter components, Vite config, and TypeScript project references. Installed Phaser 4.2.1 with `npm.cmd --prefix app install phaser`; no engine integration or gameplay was added.
- Installed Vitest 5.0.5, jsdom 30.1.3, React Testing Library 16.3.3, jest-dom 7.0.1, user-event 14.6.8, and Playwright Test 1.64.1 using `npm.cmd --prefix app install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test`. Retained the npm lockfile; installs and clean installation reported zero vulnerabilities.
- Initialized with the official create-playwright 1.17.139 CLI from `app/`: `npm.cmd --yes create playwright@latest -- --browser chromium --no-browsers --no-examples --quiet --lang ts`. Installed Chromium through `npx.cmd playwright install chromium`. Kept only the local Chromium configuration/test and the generated auth-artifact ignore; no external-site examples or CI workflow were added.
- The initializer's npm subprocess reported the old system Node 22.20.0/npm 11.7.0 after an interactive terminal reset. Re-selected managed Node 24.22.1/npm 12.2.1 before a clean `npm.cmd --prefix app ci` and all acceptance gates. The first clean-install attempt hit a Windows native-module lock; stopping the existing dev server released it, and the retry passed without elevation.
- Added the starter render/counter test and test-only CSS Module fixture first. The initial `npx.cmd vitest run src/App.test.tsx` failed both tests due to missing DOM configuration. Configured separate Node (`src/**/*.test.ts`) and jsdom (`src/**/*.test.tsx`) projects, jest-dom/cleanup setup, and CSS Module processing; both tests then passed. Global starter CSS is left to the real browser rather than parsed by jsdom.
- Added one local browser smoke test first; `npm.cmd run test:e2e -- --reporter=line` failed on the missing base URL. Adapted the generated config to start Vite from `app/` using the current Node executable, dedicated port 4173, `--strictPort`, and `reuseExistingServer: false`. The same test then passed with normal mouse interaction, loaded images, and no uncaught page errors; no forced or synthetic click workaround is used.
- Added single-run `test`, `test:watch`, `typecheck` (`tsc -b`), and `test:e2e` scripts. Extended the existing Node TypeScript project's include list to cover both test configs and browser tests. The existing app project typechecks React tests and their setup; no replacement bootstrap/configuration system was introduced.
- Acceptance gates passed from `app/` under Node 24.22.1/npm 12.2.1: `npm run test` (two tests), `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e` (one Chromium test). Updated [the root README](README.md) with exact commands, browser prerequisites, test conventions, port ownership, and the Windows file-lock remedy.
- No gameplay, simulation values, UI redesign, CI/deployment workflow, commit, push, or later step was introduced. No gameplay approval or design deviation was needed. Step 3.1 remains pending.

## Phase 3: Testable Simulation

### Step 3.1 - Define Preset Data, Models, And Derived Stats

Status: pending. Dependencies: 1.1, 2.2.

**Implementation prompt**

Implement only the models and configuration needed for one Paladin, one enemy, shards, circular arena, simulation inputs, and session snapshots. Encode the approved mechanics document in typed configuration with explicit units and named constants. Keep base stats, passive equipment bonuses, and derived gameplay values distinct; do not build an inventory/equipment UI. Include a preset/rules version so results from different tuning values cannot silently share a personal best.

Write failing tests for the fixed Paladin stat totals, approved derived speed/regeneration/damage formulas, and configuration constraints such as positive lifetime and reversal within lifetime. Test rounding and bounds from the mechanics contract. Unknown values are blockers, not TODO defaults in playable code. Avoid a generic configuration/schema framework unless the existing toolchain makes it genuinely simpler.

Acceptance: focused tests, typecheck, and lint pass; importing the models/configuration does not require DOM, React, Phaser, or localStorage. Record the correspondence between approved mechanics and named configuration values.

### Step 3.2 - Implement Fixed-Step Player Movement And Pursuit

Status: pending. Dependencies: 3.1.

**Implementation prompt**

Introduce one fixed-step simulation entry point, driven by supplied elapsed time and sampled input rather than wall-clock APIs inside game rules. Implement approved WASD movement including normalized diagonals, circular-arena constraints accounting for the approved player collision extent, and slow enemy pursuit. Apply approved enemy stopping/contact/boundary rules; do not invent contact damage. Initialize deterministic spawn positions from configuration.

Write failing tests for no input, opposite inputs, equal axial/diagonal speed, movement over a known number of ticks, arena edge movement, enemy distance reduction, and enemy speed below player speed. Verify equivalent simulated elapsed time split across different render-frame schedules produces equivalent state within a stated tolerance. Bound catch-up work according to an explicit policy; do not award survival time for simulation time that was discarded.

Acceptance: focused movement/timing tests and typecheck pass. No renderer, event bus, pathfinding, or unrelated physics features are introduced.

### Step 3.3 - Implement Rotating Bursts And Returning Shards

Status: pending. Dependencies: 3.2.

**Implementation prompt**

Implement the approved attack scheduler in simulation time. Start in cooldown. Maintain four equally spaced clockwise emitters, sampling enemy position and current emitter phase at each shot. Each burst group emits four shots from each emitter for 16 shards total, respecting the approved intra-burst interval and cooldown definition. Define clockwise using the renderer's eventual coordinate convention and test the actual direction. Keep rotation progressing according to the mechanics contract during cooldown.

Represent shard position, velocity, age, reversal state if needed, lifetime, and `hasHitPlayer`. Reverse velocity exactly once at the configured time; when an update crosses reversal or expiry, split movement across the boundary rather than integrating the whole update with the wrong velocity. Do not store the origin, home toward the enemy, remove shards offscreen/on arena exit, or add collision-driven expiration.

Write failing tests for no premature firing, all four emitter offsets, 16 correctly timed shots, rotation between successive shots, cooldown boundaries, one reversal, partial-step reversal, lifetime-only expiry, and independence from later enemy movement. Test symmetric outbound/return movement returns near the emission location without storing that location in the entity.

Acceptance: focused attack/shard tests and typecheck pass; multiple frame schedules preserve shot counts/times for the same simulated duration.

### Step 3.4 - Implement Hits, Health, And Survival End

Status: pending. Dependencies: 3.3.

**Implementation prompt**

Implement collision and damage using the approved shapes and ROTMG rules. Use suitable proven geometry utilities, including Phaser's independently testable helpers if appropriate, without pulling rendering objects into entity models. Detect fast shard crossings, not only overlap at the end of a tick. Account for player movement during the tick when testing relative motion. Preserve the approved return-path collision behavior when a tick spans reversal.

On a shard's first registered hit, apply damage and set `hasHitPlayer`; later collisions by that shard do nothing. Keep it alive. Separate shards can each hit; do not add global invulnerability unless the approved contract requires it. Apply the approved defense minimum-damage rule, regeneration and in-combat rules, health cap, and death transition. Freeze survival time at the approved death instant/tick and prevent post-death simulation from changing results.

Write failing tests for defense boundaries, first hit, repeated overlap, return collision, multiple shards, fast crossings, regeneration timing/caps, lethal damage, and immutable results after death. Handle ordering between damage and regeneration explicitly according to the contract.

Acceptance: focused collision/health tests, existing simulation tests, and typecheck pass. No projectile is destroyed by collision and no player attack/ability behavior is introduced.

## Phase 4: Playable Engine Integration

### Step 4.1 - Render The Simulation And Bind Controls

Status: pending. Dependencies: 3.4.

**Implementation prompt**

Create the minimal Phaser adapter and React canvas host. Instantiate the game once per mounted host, run the existing simulation from Phaser's update lifecycle, and destroy the game and all listeners on unmount. Prove React Strict Mode does not create duplicate loops, canvases, or key handlers. Use Phaser rendering and camera APIs, not a parallel custom renderer or React entity tree.

Draw the circular arena, player, enemy, and yellow shards with readable placeholder geometry and the approved collision/render alignment. Keep ground, entities, and effects in predictable depth order. Player camera tracking, world scale, O/P zoom bounds, and resize behavior must follow the mechanics contract. Screen size changes and zoom must not change world speed, collision, or attack timing. Prevent page scrolling only for relevant gameplay keys while the game has appropriate focus. Clear held input on focus loss according to the approved pause policy.

Use adapter tests where practical and Playwright for lifecycle/input checks. Capture screenshots at desktop and narrow viewport sizes and verify the canvas is nonblank using canvas pixel checks, the arena/characters/shards render, and layout does not overlap. Narrow-screen layout may communicate keyboard requirements without claiming touch gameplay. Do not add mobile touch controls.

Acceptance: a temporary minimal React entry can launch the encounter; WASD, pursuit, bursts, returns, hits, health loss, camera follow, and zoom work. Run relevant tests, typecheck, lint, build, and browser checks. Start the dev server and provide its URL.

### Step 4.2 - Implement Session Lifecycle, Pause, And Retry

Status: pending. Dependencies: 4.1.

**Implementation prompt**

Introduce the smallest session controller for the approved home/countdown/running/paused/ended flow. Do not add countdown or pause modes the user rejected. Wire R as an edge-triggered immediate retry from the approved states, not once per repeated keydown event. Restart through the same session initialization path used by Start. Reset health, positions, inputs, shards, attack phase, initial cooldown, counters, and simulation clock. Apply the explicitly approved camera/zoom retention policy.

Implement focus-loss behavior and resume input clearing from the contract; hidden-tab wall time must not become survival time or a catch-up burst. Ensure any death/abort result is emitted exactly once and restart cannot deliver stale asynchronous updates to the new attempt. Avoid rebuilding the entire Phaser instance per retry unless required by its lifecycle.

Write failing controller tests and browser checks for repeated R presses, held R, retry during a burst, retry after death, pause/resume, focus loss, and stale input. Verify several consecutive retries leave one canvas and one effective input handler.

Acceptance: lifecycle tests and browser checks pass, retries are immediate and repeatable, and no timer/projectile state leaks between attempts.

## Phase 5: Practice Interface And Records

### Step 5.1 - Build Home, HUD, And Results

Status: pending. Dependencies: 4.2.

**Implementation prompt**

Replace the temporary entry with the requested React home screen: prominent Start action, concise description, changelog, and approved links. Ask for unknown link targets rather than inventing them. Build a compact in-session health/timer/primary-stat HUD and results view with approved metrics, Retry, and Home actions. Honor the session controller rather than duplicating lifecycle logic in components.

Use CSS Modules, semantic buttons, visible keyboard focus, and accessible health/status output without announcing every animation tick. Use library icons for icon controls if needed. Keep game state out of per-frame React updates: publish bounded HUD snapshots and lifecycle events through one well-cleaned-up boundary. Clearly distinguish result metrics from proposed features not approved in step 1.1.

Write React tests for Start, results, Retry/Home, HUD values, and disabled/paused states that actually exist. Check desktop and narrow-screen screenshots for clipped text, obstructed play area, and layout shifts. Preserve the explicit home description/changelog requirement; do not turn it into an oversized promotional page.

Acceptance: the complete Home -> Session -> Results -> Retry flow works with buttons and the approved keybinds; relevant React/browser tests, accessibility checks available in the toolchain, lint, typecheck, and build pass.

### Step 5.2 - Persist Comparable Attempt History

Status: pending. Dependencies: 5.1.

**Implementation prompt**

Implement a small localStorage adapter and typed record format following the approved result/abort/retention policy. Include record schema version and encounter/preset rules version. Only compare best times within the same compatible rules version; zoom alone should affect comparison only if the contract says it changes scoring eligibility. Use structured JSON parsing plus runtime shape validation; never trust stored data via a TypeScript assertion alone.

Keep storage out of simulation and publish each eligible result once through the application layer. Handle unavailable storage, invalid JSON, unknown versions, malformed records, and quota failures without preventing practice. Enforce the approved history bound. Do not implement export, cloud sync, arbitrary migrations, or settings UI unless requested.

Write failing adapter tests using an injected storage boundary, and integration tests for a completed attempt, retry deduplication, refresh persistence, compatible personal best, and corrupt/unavailable storage. Display approved history/comparisons in the existing result/home surfaces rather than adding a dashboard.

Acceptance: tests pass and manual refresh retains valid attempts while storage failure leaves Start/Retry usable.

## Phase 6: Fidelity And Repeated-Practice Validation

### Step 6.1 - Tune And Approve The Encounter

Status: pending. Dependencies: 5.2.

**Implementation prompt**

Run the full playable loop and review it against `docs/mechanics.md` with the user. Compare available references for player speed, camera scale, clockwise rotation, burst cadence, return timing, damage, and regeneration. Explicitly separate pursuit and other trainer-specific choices from faithful mechanics. Do not claim authenticity based on the wiki's descriptive prose alone.

Ask the user to approve changes to provisional angular speed, cooldown, arena/spawn dimensions, hitboxes, and other feel-related values. Change only approved configuration and corresponding expectations. Do not add a permanent tuning panel or adaptive difficulty. Increment the encounter/preset rules version when a change invalidates comparisons, and document the reason.

Validate sustained play and repeated resets with user-approved test durations/counts. Check active projectile counts follow firing/lifetime bounds instead of growing forever; inspect listener/canvas counts and frame responsiveness without assuming a universal FPS guarantee. Check multiple render schedules through deterministic tests and a browser run where practical. Retain representative screenshots as test artifacts rather than committing large binaries by default.

Acceptance: the user approves the training feel, the approval/provisional status is recorded, and all affected tests plus lint, typecheck, build, and complete browser loop pass. Report remaining deviations and performance limitations honestly.

## Phase 7: Continuous Delivery And Handoff

### Step 7.1 - Add CI And GitHub Pages Deployment

Status: pending. Dependencies: 6.1.

**Implementation prompt**

Create a GitHub Actions workflow for pull-request validation and deployment on every push to `main`. Run install commands from `app/` using `npm ci`, a supported pinned Node major, and npm caching keyed to `app/package-lock.json`. Gate deployment on lint, typecheck, unit/component tests, build, and Playwright smoke/critical-loop checks. Install CI browser dependencies using Playwright's official command and retain useful failure artifacts.

Use GitHub Pages' official artifact/deployment actions with least-required permissions, the appropriate environment, and concurrency behavior that prevents conflicting deployments. Pull requests must never deploy. Confirm the actual GitHub repository name/owner and Pages URL before hardcoding a base path. Configure Vite for the real project-site or user-site path and test assets under that prefix. Avoid client-side path routing for this one-screen app unless necessary; any router must handle direct loads on Pages.

Publish only `app/dist`, never the repository root or development dependencies. Document the required repository Pages source setting and any manual owner action. Do not request tokens through chat, create a repository, push, or change remote settings without authorization.

Acceptance: local production preview works with the deployment base path, the workflow's event/job/permission logic is reviewed, and all local gates pass. An actual successful Actions deployment and live smoke check are required to mark this step complete; if push/Pages authorization is unavailable, record it as blocked rather than claiming deployment.

### Step 7.2 - Verify Release And Finish The Handoff

Status: pending. Dependencies: 7.1.

**Implementation prompt**

Test the deployed GitHub Pages URL, not only localhost: home loads, assets resolve, Start works, controls work, the head begins in cooldown, damage and death work, R retries, O/P zoom, and valid local records survive refresh. Confirm the hosted app needs no API or server secrets. Check the agreed desktop browsers and responsive layout; do not claim touch support.

Update the root README with actual install/dev/test/build commands, controls, architecture summary, Pages setup, known fidelity limitations, and links to the approved mechanics and this plan. Keep changelog content accurate and explain where future tuning values live. Review the final diff for generated boilerplate that is truly unused, accidental assets, secrets, and unrelated edits; remove only task-owned unused material.

Acceptance: record the live URL, deployment/run evidence, tests actually run, user acceptance outcome, and unresolved limitations. Do not mark the vertical slice shipped until live verification and repeated-practice acceptance succeed.

## Definition Of Done

- A fresh install reproduces the tested build using the committed lockfile.
- The user-approved Paladin and encounter rules are encoded as named, unit-aware configuration and pure tested rules.
- Four clockwise rotating four-shot bursts, initial cooldown, reversal, lifetime-only expiration, and one-hit-per-shard behavior are verified.
- Player-centered camera and WASD/R/O/P work; retry fully resets the encounter with no duplicate loops or listeners.
- Death, results, history, and personal-best comparisons obey the approved policy and tolerate localStorage failures.
- Frame scheduling, focus changes, and zoom cannot silently alter gameplay rules or inflate recorded time.
- The requested home screen and complete repeated-practice loop work on the live Pages site.
- CI validates changes and successful `main` pushes deploy automatically.

## Customization Choice

Use `.github/copilot-instructions.md` for shared engineering rules and `.github/prompts/implement-step.prompt.md` for the single-step command. No custom agent or skill is necessary yet. Consider a reusable encounter-authoring skill only when a second encounter exposes a genuinely repeated workflow; keep this enemy's facts in the mechanics document rather than duplicating them into a skill.
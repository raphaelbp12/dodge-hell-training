# Active Implementation Plan

## Purpose And Execution

**Batch authorization - 2026-10-25:** The user explicitly requested all remaining steps in order, tests and a separate commit/push between steps, with no further confirmation prompts. For this batch this overrides the single-step invocation/publication restrictions below. Use conservative presentation choices and record them as delegated technical decisions, not human visual/audible acceptance. Never treat a failed gate as complete or invent deployment evidence. Preserve unrelated local edits. Each completed step still requires its own checks, execution record, commit and verified push before the next step begins.

Deliver a pure-frontend ROTMG-inspired training game: repeatedly survive against the Crystal Worm Child Head, inspect results, and retry immediately.

This is a plan, not authorization to implement all phases at once. Each numbered step below is an implementation prompt. Run one at a time with `/implement-step <step-id>`, for example `/implement-step 8.1`. Read the shared contract below, then execute only the requested prompt. Dependencies must be complete first.

New steps start pending. After completing a step, replace its status with `complete`, record the actual checks and outcomes below its prompt, and note any approved deviations. Do not mark a step complete when its required checks are blocked. Do not automatically start the next step.

Completed phases 1-7 and their v1 acceptance history are preserved in [the v1 archive](docs/implementation-plan-v1.md). This file contains pending phases 8-14 for the approved fixes. Begin with `/implement-step 8.1`; the existing command reads this file without changes. Archiving history does not implement or complete any new step.

## Sources And Decision Authority

- [Original draft](first-draft.md): original requirements and project intent. Keep it intact.
- This plan: consolidates subsequent user decisions and the approved technical approach. Later explicit user decisions override older statements; record changes here.
- [The mechanics contract](docs/mechanics.md) records sources, approvals and fidelity limits. Do not treat user-supplied wiki numbers or proposed formulas as independently verified facts.
- [The fixes decision record](docs/fixes-plan.md), especially sections 4, 7.7 and 7.8, supplies Q01-Q20/R01-R05 approvals and supersedes conflicting archived v1 design. Its section 5 is a historical high-level outline; executable steps/statuses live here. [The adjustment notes](fixes.md) and reference image are supporting inputs, not permission to publish third-party artwork.
- Never silently resolve a gameplay ambiguity. Research it, explain alternatives, and ask the user for approval before dependent implementation.

## Completed Baseline

Phases 1-7 are complete; their prompts, earlier blockers, later resolutions and acceptance evidence are archived, not deleted or reopened. The existing playable runtime remains v1 until step 10.1.

| Archived dependency | Final status                                          | Evidence                                                                                                            |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 7.2                 | Complete under delegated technical release acceptance | [Step 7.2 and release verification](docs/implementation-plan-v1.md#step-72---verify-release-and-finish-the-handoff) |

For step 8.1's dependency check, read that archived final status and execution record, not the historical blocked attempt within it. Other completed step records are available in the same archive when needed. Do not rerun completed steps automatically.

## Confirmed Design

- React application, pure frontend, deployed to GitHub Pages on every push to `main`.
- Home screen with a prominent Start button, description, changelog, and links. The requested home screen is intentional, not a marketing landing page.
- Desktop keyboard play: WASD movement; R immediately retries; O zooms out; P zooms in.
- Endless survival until death. No player attacks or seal activation in this slice.
- One fixed, average unpotted level-20 Paladin using the mechanics contract's approved equipment, stat totals, derivation and rounding. Every attempt uses identical stats; this follow-up does not reopen the preset.
- Visible primary attributes: health, vitality, speed, defense. Derive gameplay values through verified rules rather than embedding formulas in UI code.
- Circular arena; player spawns at its center and enemy near an edge. No shrinking floor or hazards.
- The head slowly chases the player, slower than the configured Paladin. This intentionally replaces the wiki's wandering behavior.
- Four emitters, spaced 90 degrees apart, rotate clockwise at 45 degrees/second. Each fires eleven projectiles 0.15 seconds apart, followed by one second after the last shot. Rotation continues during cooldown; the near-center offset is 10% of head width.
- Enemy begins in a two-second firing cooldown. Keep the approved center-player/near-edge-enemy spawn policy.
- Shards travel along their initial direction, reverse velocity once at a configured age, and expire only at their configured lifetime. No stored firing origin or homing target is needed. Enemy movement never changes an existing shard's trajectory.
- A shard can damage the single player only once in its lifetime. Store `hasHitPlayer` per shard. It remains alive after a hit, overlap, or return collision. Do not remove it at arena boundaries or when offscreen.
- Shards use 160 incoming damage and speed 8 tiles/second. Approved maximum head-center-to-leading-edge reach and arena radius are 19.2 tiles; exact reversal/lifetime derive from reviewed polygons, not total-path semantics.
- Player-centered camera with persisted O/P zoom from 0.25 to 3.0, default 1 and step 0.125. Zoom does not change world units or gameplay.
- Original simple convex silhouettes of at most eight sides share body geometry with collision. Add the approved health bar, hit feedback/audio and Controls/pause behavior through the phased steps below.
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

| Boundary                  | Suggested home under app/src | Owns                                                                                       | Must not depend on               |
| ------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------- |
| Models                    | game/models                  | Typed entities, inputs, snapshots, session states                                          | React, Phaser, storage           |
| Configuration/data        | game/config                  | Validated stats, encounter values, units, preset version                                   | React, Phaser, browser APIs      |
| Simulation/rules          | game/simulation              | Fixed-step movement, pursuit, burst scheduling, shards, damage, regeneration, elapsed time | React, Phaser, DOM, localStorage |
| Session application layer | game/session                 | Start, pause, resume, death, retry, result handoff                                         | UI components, drawing details   |
| Engine adapter/drawing    | game/phaser                  | Phaser lifecycle, keyboard sampling, camera, geometry, render order                        | Persistence internals            |
| Web components            | ui                           | Home, HUD, results, accessible controls                                                    | Per-frame entity mutation        |
| Persistence adapter       | storage                      | Versioned local records and safe reads/writes                                              | Phaser                           |

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

## Follow-Up Execution Contract - Phases 8-14

The architecture, shared prompt contract and project instructions still apply. Execute only the requested numbered step and stop afterward. Steps were initially planned as pending; each step's status and execution record below now report its actual progress.

### Approved Scope And Review Gates

- One coordinated gameplay identity: `crystal-worm-child-head-paladin-v2`. Retain v1 history, exclude it from v2 bests, and avoid a schema migration unless a demonstrated field change requires it.
- Four emitters, eleven shots each, 0.15-second spacing, one second after the last shot, two-second initial cooldown, clockwise 45 degrees/second. Group span 1.5 seconds, period 2.5 seconds, forty-four shards per group.
- Maximum reach is 19.2 tiles from a stationary centered head's simulation center to the projectile's farthest body edge at reversal. Speed remains 8 tiles/second; arena radius is 19.2 tiles. This calibration condition does not confine shards emitted by a moving head.
- Use the decision record's common scale and nominal body dimensions. Nominal reversal 2.238140 seconds and lifetime 4.476281 seconds are estimates, not immutable rounded runtime constants. Derive exact timing from the approved polygon, emitter offset and edge criterion.
- Emitter offset is 10% of head width. Player starts at center; enemy starts north with a three-tile center-to-wall margin, nominally `(0, -16.2)`, subject to actual body fit. Derive pursuit stopping separation from silhouettes; an extra gap is not silently authorized.
- Original convex body silhouettes, three to eight vertices, share their physical outline and transform between drawing and collision. Shard is centrally symmetric and retains firing-axis orientation on reversal; no within-tick spin. Decorations are explicitly nonphysical.
- Preserve one clock, existing fixed-step/catch-up policy, one reversal, lifetime-only expiry and per-shard once-only hits. No firing-origin storage, homing, global invulnerability, contact damage, blocking, wall/offscreen despawn or shrinking arena.
- Persist zoom independently of history: 0.25-3.0, default 1, step 0.125. Preserve 32 CSS pixels/tile independently of image reference scale and camera magnification.
- Always-visible Phaser health bar, individual post-defense floating hit amounts, quiet original cue and visible mute; retain existing HUD. Controls on Home/HUD, accessible modal, explicit Resume after session dialog closure, centered Paused label, no background input/time catch-up.
- Unspecified polygon coordinates, extra stopping gap, effect durations/placement and numeric audio gain/voice cap require review at their owning steps. Present candidates and record approval; do not reopen settled question batches or invent fidelity. Missing approval blocks completion, not preliminary proposals/tests.
- Screenshot/crops remain local review material outside runtime assets; public distribution rights are unapproved. No backend, accounts, attacks, seal activation, touch controls, rebinding or tuning UI.

### Reuse And Verification Policy

Extend existing config/models, `createSimulation`/`advanceSimulation`, shard movement segmentation, health arithmetic, `SessionController`, `EncounterScene`, React screens and defensive storage boundary. Reuse neighboring tests and the existing Playwright helpers, diagnostic/production split and pixel checks. Add a small module only for a real ownership boundary; no parallel simulation, generic settings/event-bus framework, second clock or duplicate test harness.

Behavior steps start with a focused failing test, run it, implement the smallest change, and rerun it immediately. Documentation/review steps use structural/math/diagram checks. Pure geometry uses existing Node Vitest without DOM/Phaser/React/storage. Prefer suitable installed `@flatten-js/core` operations; a narrow translating-convex sweep helper is justified where those APIs cannot express continuous collision, not as a general physics engine or dependency replacement.

Run relevant checks from `app/` using established scripts: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (`npm.cmd` for forwarded flags in PowerShell). All five are required for runtime-integrating changes and final acceptance; pure/documentation steps use focused checks plus relevant regression/type/build checks. Build before production-browser checks. Do not weaken meaningful assertions or target historical v1 death times.

Preparatory geometry remains disconnected from the playable preset until step 10.1. Never deploy intermediate physics as v1 or distinct gameplay presets under one v2 identity. After publication, comparison-breaking changes require explicit version review. Each execution records actual checks, approvals/deviations, blockers and manual verification where relevant. The command never commits/pushes; publication requires separate authorization.

### Phase Index

| Phase | Steps      | Outcome                                                | High-level outline |
| ----- | ---------- | ------------------------------------------------------ | ------------------ |
| 8     | 8.1, 8.2   | V2 contract and approved exact geometry                | F0-F2              |
| 9     | 9.1, 9.2   | Tested pure continuous collision and boundary rules    | F2-F3              |
| 10    | 10.1, 10.2 | Coordinated playable v2 and comparison safety          | F3                 |
| 11    | 11.1, 11.2 | Defensive zoom preference and restoration              | F4                 |
| 12    | 12.1-12.4  | Hit data, health bar, floating amounts and audio       | F5                 |
| 13    | 13.1, 13.2 | Accessible Controls and paused-session safety          | F6                 |
| 14    | 14.1-14.3  | Regression, local handoff and authorized live evidence | F7                 |

## Phase 8: Revised Contract And Geometry Approval

### Step 8.1 - Record The Approved V2 Contract

Status: complete. Dependencies: 7.2.

**Implementation prompt**

Reconcile the latest fixes decisions into an additive v2 section in [the mechanics contract](docs/mechanics.md). Preserve v1 approvals/source history and completed plan statuses. Record approved cadence, range semantics, polygon/emitter/spawn policy, comparison version and UI decisions with units/provenance. Distinguish exact approvals from nominal measurements, geometry-dependent outputs and unspecified presentation constants. Assign remaining review gates to their owning steps rather than making this step depend on unfinished geometry. Do not change runtime or invent polygon/audio numbers.

**Focused checks:** all Q/R approvals covered, cadence/range arithmetic, source-image hash unchanged, links and absence of runtime changes.

**Acceptance:** authority and remaining review ownership are clear, no settled choice is reopened, and document checks pass. Exact polygon-derived numbers remain explicitly assigned to step 8.2, not a blocker to this contract-reconciliation step.

**Execution record - 2026-10-25**

- Verified the final [archived step 7.2 release record](docs/implementation-plan-v1.md#step-72---verify-release-and-finish-the-handoff): complete under delegated technical release acceptance, with prior successful deployment and live/local checks. Preserved its earlier blocked attempt and subsequent resolution; no fresh deployment verification was needed or claimed.
- Appended [the approved v2 contract](docs/mechanics.md#approved-v2-contract---step-81) without rewriting v1 mechanics/source/approval text. Covered Q01-Q20 and R01-R05, cadence/range units, shared polygon/emitter/spawn policy, nominal calibration, comparison isolation, UI/session/persistence decisions and preserved invariants. Explicitly separated user approvals from uncertain image measurements, geometry-derived outputs and unspecified presentation values.
- Assigned exact vertices/anchors, tolerances, edge-contact timing, spawn fit, live bound and pursuit separation to step 8.2; implementation/acceptance and presentation/audio reviews remain with their numbered owning steps. No settled question was reopened, geometry/audio value invented or additional approval assumed. No deviation or remaining blocker for step 8.1.
- Focused Node assertions passed: all 25 approval IDs; group span 1.5 seconds, period 2.5 seconds, 44 shards/group and 17.6 shards/second; nominal dimensions, offset, reversal/lifetime, 19.2/38.4-tile radius/diameter, north spawn and conditional 88-shard bound; 13 local file links/anchors across mechanics/active plan; original screenshot SHA-256 `f1c9b0715e8d2b91f1eac60ea3ad9e5adc694e4e2bcbd3fc65f9426b5f9cc86b`; exact pre-edit v1 mechanics prefix and archive/decision-record/original-draft preservation; hashes of every tracked app file unchanged. Scoped Git whitespace checks passed.
- Documentation-only checks replace artificial behavior tests here. Application unit/type/lint/build/browser suites were not rerun; no runtime, dependency, storage, rules activation, commit, push or deployment changed. Preserved pre-existing mechanics table formatting and the unrelated local Vite formatting edit. Step 8.2 and all later steps remain pending and unstarted.
- Manual review: read the appended v2 section and its approval/review tables alongside the linked decision record; confirm that exact polygon outputs belong to 8.2 and runtime activation to 10.1. No new application behavior is expected from this step.

### Step 8.2 - Define And Approve Shared Geometry

Status: complete. Dependencies: 8.1.

**Implementation prompt**

Propose original typed local player/head/shard vertices from the measured common scale/proportions, with explicit center anchors/orientation and visible head-occlusion uncertainty. Reuse vector/config conventions; introduce a pure geometry configuration module only as a genuine shared owner. Keep the playable preset/renderer unchanged. Generate a common-scale comparison and collision-overlay review from the same proposed vertices, not independent approximate art. Review artifacts are not runtime assets or a tuning screen.

Derive the 10%-head-width emission offset, exact reversal/lifetime from farthest-vertex contact, spawn fit and silhouette-derived pursuit separation. Show the 19.2-tile construction with head at arena center, not its near-edge play spawn. Recalculate the live bound from exact lifetime/group period: nominally 88, not unconditional. Present any extra stopping gap explicitly. Obtain and record approval of actual silhouettes/anchors and necessary unspecified choices; finalize these v2 mechanics entries. Do not retain nominal glyph-centroid timing at the expense of exact edge contact.

**Focused checks:** finite ordered convex vertices, nonzero area, 3-8 sides, shard central symmetry, documented dimension/aspect tolerances reflecting source uncertainty, shared transforms, exact edge contact/just-beyond failure, spawn fit, positive reversal within lifetime. Use existing Node tests and common-scale visual review.

**Acceptance:** exact geometry and derived values have actual approval evidence; data/math/comparison checks pass; runtime remains v1. Missing approval is recorded as a blocker, not assumed acceptance.

**Candidate preparation and approval blocker - 2026-10-25**

- Verified step 8.1 complete and read its approved v2 contract and Q/R decision provenance. Added a disconnected, Node-only [typed geometry candidate](app/src/game/config/geometry-candidate.ts), reusing `Vector2`, and four tests in the existing config suite. Proposed upright beveled player/head octagons, a centrally symmetric firing-axis shard hexagon, body-center anchors, source-informed dimension/aspect review tolerances and zero extra pursuit gap. None of these new geometry choices is recorded as user-approved.
- Added [a reproducible review generator](app/scripts/review-geometry.mjs). Run `node app/scripts/review-geometry.mjs` from the root to create ignored `app/test-results/geometry-review/index.html` and `values.json`. Review figures use identical candidate vertices/transforms for the physical fill/collision overlay, and show common-scale proportions, centered-head edge contact, min/default/max zoom and actual near-edge spawn. No reference artwork or generated review image is committed or bundled.
- Recorded exact vertices, uncertainty, tolerances, derivation and [approval questions G01-G04](docs/mechanics.md#approval-questions). Conditional candidate outputs: emitter 0.185329037181 tile, center reach 17.951764808627 tiles, reversal 2.220804471431 seconds, lifetime 4.441608942861 seconds, conservative live bound 88, north spawn `(0,-16.2)` fitting within radius 19.2. Axial pursuit contact is 1.720912488107/1.941542294274 tiles and diagonal contact 2.093284691954 tiles, with proposed zero extra gap; the direction-dependent movement helper remains step 9.2 work.
- TDD: focused config test first failed because the candidate module was absent, then passed all four new cases after the smallest data implementation. Checks cover finite ordered convex nonzero-area 3-8-vertex bodies, exact common-scale dimensions/aspects, shard central symmetry, fixed orientation policy, exact contact and just-beyond failure across firing phases, spawn fit, positive reversal/lifetime, dynamic live bound and unchanged v1 values. Under pinned Node 24.22.1, all 198 unit/component tests across six files, typecheck, lint and production build passed. The existing large Phaser bundle warning remains unchanged.
- Isolated Chromium review checks at 1440x1000 and 390x1000 passed: four nonblank figures, body/overlay vertex equality, colored-body pixels, no clipping/overflow or page errors. Visual inspection found comparison/zoom-row overlaps missed by the first clipping check; a focused pairwise-overlap assertion reproduced them, then passed at both widths after a layout-only repair. Screenshots remain ignored in the review artifact directory. This is automated/agent visual review, not user geometry acceptance or a fresh full gameplay end-to-end run.
- Documentation checks passed against generated numeric/aspect values and local links; the original image SHA-256 remains `f1c9b0715e8d2b91f1eac60ea3ad9e5adc694e4e2bcbd3fc65f9426b5f9cc86b`. No live v1 config, simulation, renderer, history, dependency, lockfile, gameplay rules identity, commit, push or deployment changed. Preserved the pre-existing local Vite formatting and step 8.1 documentation work.
- **Blocker:** actual user approval of G01-G04 is required before finalizing these v2 geometry entries or completing step 8.2. Review the generated local page and answer the four questions together in the mechanics document or conversation. No approval is inferred from technical checks; steps 9-14 remain pending and unstarted.

**User approval and completion - 2026-10-25**

- In response to the combined G01-G04 review request, the user replied "approved". Recorded actual approval of the exact original silhouettes, body-center anchors/orientations, dimension/aspect review tolerances and derived offset/timing/live-bound/spawn/pursuit values with zero extra gap in [the finalized mechanics entries](docs/mechanics.md#step-82-geometry-candidate---approved). This resolves the historical handoff blocker above; no approval is inferred from test success or delegated acceptance.
- Updated candidate approval/provenance metadata and the existing config assertion, plus generated-review labels. Preserved all reviewed vertices and physical values exactly, verified by deep comparison of regenerated data against the pre-approval review artifact. Source-informed uncertainty remains documented; approval is not client-fidelity certification or a newly observed playtest.
- Approval-state TDD check failed as expected (`proposed` versus required `approved`), then all four focused geometry cases passed after the metadata change. All 50 config tests, typecheck and lint passed on this follow-up; approved-artifact and documentation assertions passed. The prior candidate-preparation record retains the full 198-test/build and desktop/narrow visual evidence; those broader gameplay gates were not rerun or misrepresented as fresh here.
- Acceptance: exact geometry/derived values have explicit user approval and passing data/math/common-scale review evidence. Step 8.2 is complete with no remaining blocker or deviation. Runtime configuration, simulation, renderer, comparison identity and history remain v1; geometry is still disconnected until the coordinated step 10.1 activation. Step 9.1 and all later steps remain pending and unstarted. No commit, push or deployment was performed.

## Phase 9: Pure Geometry Rules

### Step 9.1 - Implement Continuous Convex Hit Detection

Status: complete. Dependencies: 8.2.

**Implementation prompt**

Implement minimal shared vertex transforms and continuous translating-convex overlap. Check installed geometry APIs first and reuse suitable operations. Where unsupported, use the reviewed swept separating-axis overlap intervals with axes from both shapes and relative player/shard displacement. Document tangency and numerical tolerance separately from gameplay tuning. Circles/AABBs can reject candidates but never accept final hits. Keep helpers disconnected from playable collision until step 10.1; no new physics framework.

**Focused checks:** newborn/initial overlap, stationary/equal motion, axial/diagonal high-speed crossing, miss, tangency/just-separation, circle false positive rejected, rotated equivalence, reverse crossing and invalid geometry. Extend nearby tests; add one focused geometry test only if ownership warrants it. Verify Node-only imports.

**Acceptance:** approved fixed-orientation shapes pass continuous-relative-motion tests; no endpoint-only shortcut, runtime branch or additional clock/framework is introduced.

**Execution and verification - 2026-10-25**

- Confirmed step 8.2 completion and explicit G01-G04 approval before implementation. Inspected installed `@flatten-js/core` 1.6.14 declarations: static polygon intersection and affine transforms are available, but no continuous translating-convex query. The new pure [geometry adapter](app/src/game/simulation/geometry.ts) reuses `Matrix` for rotation-then-translation and implements the reviewed swept overlap intervals on normalized edge normals from both bodies, with relative displacement over one shared motion segment. No dependency or physics framework was added.
- Added one focused [Node geometry test file](app/src/game/simulation/geometry.test.ts) beside the simulation owner. TDD first failed on the absent module; implementation passed 36 cases and exposed a malformed one-component test vector. Correcting that fixture made all 37 pass. Strengthened coverage to 41 passing cases, including initial/newborn and endpoint-only contact, equal/stationary motion, high-speed axial/diagonal/return crossings, both bodies moving, disjoint axis-time intervals, edge/corner tangency versus just-separation, enclosing-circle and world-AABB false positives, either winding, approved-body rotation equivalence, scale variation, nonmutation and invalid geometry. Motion fixtures now require typed two-component tuples.
- Documented the [collision and numerical contract](docs/mechanics.md#step-91-continuous-convex-geometry): touching counts as contact; a coordinate-scaled `64 * Number.EPSILON` allowance is numerical roundoff, not source uncertainty, invisible collider tuning or a velocity cutoff. Finite ordered strictly convex 3-8-vertex bodies and finite transforms/displacements are required; degenerate, concave, self-crossing or numerically unresolvable inputs throw `RangeError`. Projections use a shared origin and no broad-phase overlap can accept a hit.
- Under pinned Node 24.22.1, all 239 unit/component tests across seven files, typecheck, lint and production build passed. The existing approximately 1.70 MB Phaser chunk warning remains. Editor diagnostics are clear. The Node-only suite and import inspection confirm no React, Phaser, DOM or storage integration; only the new test imports the geometry adapter. The production bundle retains the existing v1 asset identities.
- Local Playwright initially passed 19/20 cases; the production desktop retry assertion observed `2.0` seconds after a pixel readback against its existing strict `< 2` bound. The affected production desktop case passed on an isolated rerun (1/1). This scheduling-sensitive result is recorded rather than claimed as a clean full-suite pass; no runtime/test assertion was weakened or unrelated failure repaired. Development and production narrow-screen scenarios passed in the initial run. No hosted check or fresh human playtest was performed.
- Acceptance met with no design deviation or remaining step 9.1 blocker: approved fixed-orientation polygons pass continuous-relative-motion checks without an endpoint-only shortcut or another runtime branch/clock. Live v1 configuration, simulation, renderer, hit/lifetime behavior, rules identity, history and dependencies remain unchanged; helpers stay disconnected until 10.1. Preserved the pre-existing Vite formatting edit. Step 9.2 and later steps remain pending and unstarted; no commit, push or deployment was performed.

### Step 9.2 - Implement Body-Aware Arena And Pursuit Geometry

Status: complete. Dependencies: 9.1.

**Implementation prompt**

Extend the same pure geometry slice with transformed-vertex circular containment/contact, a tested movement constraint preserving existing tangential edge movement, and silhouette-derived enemy stopping separation. Reuse radial/pursuit semantics where suitable; no polygon-wall replacement, body blocking or contact damage. Validate actual vertices, not bounding-circle overlap as proof of fit. Share exact reach derivation with config validation instead of copying timing formulas into drawing. Do not activate these rules yet.

**Focused checks:** interior/edge/outside placements, rotated corner contact, outward rejection/tangential movement, repeated containment, approved spawn, coincident/near pursuit without overshoot/division by zero/jitter, zero emitter offset accepted and negative/nonfinite rejected, exact leading-edge contact across firing phases.

**Acceptance:** shared physical shapes move/stop under approved semantics and fit where required; arena containment never becomes projectile confinement. Helpers remain disconnected from live v1 rules.

**Execution and verification - 2026-10-25**

- Verified step 9.1 complete with its 41-case continuous-geometry record and the actual G01-G04 approvals, including zero extra pursuit gap. Extended the existing pure [geometry adapter](app/src/game/simulation/geometry.ts); no new module, test harness, dependency, physics framework or clock was added. Reused the existing validator, normalized edge axes, projections, numerical roundoff policy and installed `Matrix` transform.
- Added actual-vertex circular containment and exact direction-dependent center limits, then a radial candidate constraint preserving the existing arena projection/tangential movement semantics. Translated arena centers, rotated corner contact, approved north spawn and upright player/head shapes are supported. Neither center-only fit nor an enclosing circle proves physical fit. The constraint operates only on supplied movement candidates; no shard confinement, wall despawn or contact response was introduced.
- Added support-plane silhouette contact and pursuit capped by the remaining distance to contact. Tests confirm the approved 1.720912488107/1.941542294274-tile axial and 2.093284691954-tile diagonal separations, bounded travel, no overshoot, stable repeated stopping, coincident/near/overlapping placements and invalid-input rejection. Zero extra gap remains unchanged; there is no push-apart correction, player blocking or contact damage.
- Added shared exact leading-edge timing and reused it in the disconnected [candidate config](app/src/game/config/geometry-candidate.ts), which also reuses axial contact derivation. Replaced the [review generator](app/scripts/review-geometry.mjs)'s duplicate diagonal-contact math with the shared helper. Direct Node execution/regeneration passed; review JSON comparison retained every other value and vertex exactly, with only a one-unit-in-last-place diagonal rounding difference. Approved emitter/reach/reversal/lifetime/spawn/live-bound values remain unchanged; no nominal timing was restored or rounded to ticks. Documented the [helper and numerical contracts](docs/mechanics.md#step-92-body-aware-arena-and-pursuit-geometry).
- TDD: six new arena tests failed on missing helpers, then all 47 geometry cases passed after implementation. Twelve subsequent pursuit/timing cases failed on their missing helpers, then all 59 passed. Eighteen new cases cover interior/edge/outside fit, enclosing-circle overconstraint rejected, rotated corner contact, radial/outward/tangential behavior over 240 consecutive moves, repeated containment, approved spawn, pursuit stability and no division by zero, valid zero emitter offset versus negative/nonfinite input, and exact contact/just-beyond failure across firing rotations. Existing independent config assertions also pass: 109 focused geometry/config checks total.
- Under pinned Node 24.22.1, all 257 unit/component tests across seven files, typecheck, lint and production build passed. Production retains the v1 JS/CSS asset identities and the existing approximately 1.70 MB Phaser chunk warning. Node-only import inspection confirms that only preparatory config, tests and the review generator use these helpers; no React, Phaser, DOM or storage dependency was introduced. Browser/hosted suites and fresh human visual/play acceptance were not rerun or claimed for this disconnected pure-code step; generated figures/layout were not redesigned.
- Acceptance met with no remaining blocker or design/tuning deviation. Live v1 encounter configuration, simulation, drawing, shard lifecycle, comparison identity, history, dependencies and lockfile remain unchanged. Preserved the unrelated local Vite formatting edit and prior step records. Step 10.1 and later remain pending and unstarted; no commit, push, deployment or coordinated runtime activation was performed.

## Phase 10: Coordinated Playable V2

### Step 10.1 - Activate The Revised Encounter Atomically

Status: complete. Dependencies: 9.2.

**Implementation prompt**

Wire reviewed geometry/config/drawing into the existing encounter together under `crystal-worm-child-head-paladin-v2`: cadence, emitter offset, exact shard timing, arena/spawns, pursuit and polygon hits. Physical drawing and collision consume identical vertices/transforms; decorations stay nonphysical. Replace obsolete positive-circle validation with polygon validation and nonnegative emitter radius. Retain firing-axis shape orientation on reversal using only minimal necessary state, never a stored firing origin.

Reuse simulation entry points, `updateAttacks`, reversal/expiry segment splitting, player interpolation, stable shard order, `hasHitPlayer`, health rules and the sole Phaser driver. Replace the local circle hit-test with the tested sweep, including newborn overlap. Existing shards ignore later head movement. Update affected regression expectations deliberately; no zoom/audio/modal work in this step.

**Focused checks:** eleven shots per phase/44 per group; initial/last/next-group boundaries; moving-head origins/rotation; fractional reversal/expiry inside ticks; swept outward/return hits, independent once-only shards/lethal stop; lifetime-only expiry outside arena; schedule equivalence; spawn/edge constraints and final live bound. Browser checks prove nonblank polygons, matching outlines and repeated-practice lifecycle at desktop/narrow sizes.

**Acceptance:** all five app gates pass; v2 activates as one coherent preset without hidden circle hits, a second clock or weakened resource/lifetime assertions. Record exact geometry/timing/bounds; later visual acceptance remains pending.

**Execution and verification - 2026-10-25**

- Activated approved shared octagons/hexagon, actual-vertex arena/pursuit, relative swept polygon hits and drawing atomically as `crystal-worm-child-head-paladin-v2`. Shards retain firing-axis orientation on reversal; existing fractional reversal/expiry segmentation, once-only hit state, stable lethal ordering and one Phaser clock remain. A conservative relative swept-AABB rejection avoids unnecessary SAT work; it never accepts collisions or confines shards.
- Arena radius 19.2 tiles, north head center -16.2 tiles, emitter offset 0.18532903718071878 tile; speed 8 tiles/s, reversal 2.2208044714307382 s, lifetime 4.4416089428614765 s. Four emitters times eleven shots, 0.15 s apart, 1 s after last shot, two-second initial cooldown. Conservative live bound `44 * ceil(lifetime / 2.5) = 88`. No timing was rounded to ticks or nominal screenshot values.
- Focused activation test failed v1 identity then passed. Updated obsolete v1 radius/spawn/cadence fixtures without weakening once-only, lifetime, schedule or resource tests. Five-minute schedules at 30/60/120 Hz agree, 1313 volleys, resource bound 88. Browser fixtures now wait for the near-edge head to be visible and use an atomic time/pixel cooldown observation with 50 ms sampling, repairing the previously observed poll/readback race without weakening the two-second rule.
- Final pinned-toolchain gates: 258 unit/component tests, typecheck, lint, production build and all 20 Chromium browser cases passed. Desktop/narrow screenshots and pixels are generated, actual deaths and persistence exercised, 60-second play plus 25 retries retain one canvas/listener set. Existing large Phaser chunk warning remains nonblocking. Earlier failing browser runs exposed obsolete v1 assertions and the cooldown observation race; neither was treated as a pass.
- No zoom/audio/modal behavior, tuning, migration, artwork distribution, fresh human geometry approval or hosted verification claimed. Step 10.2 owns comparison/technical visual acceptance. Batch publication is explicitly authorized above; unrelated Vite formatting remains excluded.

### Step 10.2 - Verify Geometry And Comparison Isolation

Status: complete. Dependencies: 10.1.

**Implementation prompt**

Reuse existing history/storage and production-safe browser helpers to prove v1 records remain readable/labeled and excluded from v2 bests, while real v2 deaths save once and R/aborts save nothing. Do not migrate/delete/relabel old records or add a schema without need. If current code already satisfies this, add only missing tests/evidence.

Review actual desktop/narrow practice and shared outlines at currently available min/default/max zoom, including sustained play and 25 retries using the derived resource bound. Verify edge contact in the controlled centered-head condition, not a pursuing-head frame. Obtain user geometry/pattern acceptance; screenshots are not human approval. Repair integration defects only; tuning changes require approval/version review.

**Focused checks:** mixed-version best/history, corrupt/future-record handling, one canvas/driver, resets/cleanup, geometry pixels/overlays, actual hits and resource bounds. Run relevant gates, all five if runtime changes.

**Acceptance:** comparison/practice checks and actual geometry/pattern approval are recorded; no v1 death-time/pixel-radius target or new deployment is claimed.

**Execution and verification - 2026-10-25**

- Step 10.1 published and remote verified at `6422656be044548372d6f52b109707cff8777322`. Existing exact-version history comparison already isolates v2; no runtime/storage/schema change was needed. Replaced generic incompatible fixtures with actual v1 identities; browser assertions prove v1 metrics/version survive R/abort unchanged, remain labeled Other rules and are excluded from the v2 best. Existing real-death production tests, result-once tests and corrupt/future-storage preservation continue to apply unchanged.
- Extended existing desktop/narrow pixel workflows with current 0.75/1/1.5 min/default/max zoom screenshots, then restore default. All three focused history/responsive browser cases passed. Reviewed generated min/max and active-pattern captures at 1440x1000 and 390x844: original shared polygons, nonblank play, no HUD overlap; head/shards can be offscreen at tighter views by design. Controlled centered-head leading-edge contact is proved by the shared geometry/config tests, not inferred from a chasing-head screenshot.
- 258 unit/component tests, typecheck, lint and production build passed. Unchanged runtime's immediately preceding full 20-case browser gate includes real v2 deaths, 60-second play, 25 retries, one canvas/listener and conservative shard bound 88. No claims of a new sustained run or hosted verification for this evidence-only step.
- Geometry/pattern accepted technically under the explicit no-further-confirmation batch delegation, building on actual G01-G04 shape approvals. No fresh human play/visual approval, fidelity claim or tuning is invented. Broader zoom and health/Controls presentation remain later steps. Preserved unrelated Vite edit and local reference art.

## Phase 11: Persisted Camera Zoom

### Step 11.1 - Add The Defensive Zoom Preference Boundary

Status: complete. Dependencies: 10.2.

**Implementation prompt**

Set typed camera limits to 0.25-3.0/default 1/step 0.125 without changing world geometry or comparison identity. Add one dedicated zoom storage adapter/key, reusing attempt storage interfaces/safe-access patterns where suitable. Do not generalize history into a settings framework. Specify a stable encoding; accept finite in-range values including valid fractional O/P sequences, default invalid data without an unapproved snapping policy. Keep visit-local fallback on unavailable/corrupt/blocked/quota storage, write only actual changes, and never overwrite/remove history.

**Focused checks:** absent/valid/boundary/fractional values, malformed/wrong-type/nonfinite/out-of-range data, throwing getter/read/write, quota failure, unchanged-write deduplication and history independence. Reuse neighboring tests or one adapter-specific test where warranted.

**Acceptance:** config/storage tests and relevant regression/type/build checks pass; history is unchanged and persistence rules remain outside simulation. Camera binding/reload restoration is not claimed yet.

**Execution and verification - 2026-10-25**

- Dependency 10.2 pushed and remote verified at `38f0699d792edf4fc92ce266e3ccdcdb8f0fa373`. Added dedicated `ZoomPreference` adapter, key `dodge-hell-training.zoom`, stable JSON-number encoding. Reuses the existing injected storage port; history/schema/data are untouched. Valid finite values in [0.25, 3] retain exact fractional values with no snapping. Missing data defaults to 1; malformed/blocked/read/getter/quota failures retain visit-local operation, preserve invalid saved data and stop failed writes. Only actual changes write.
- Approved camera limits now 0.25-3, default 1, increment 0.125, 32 CSS pixels/tile unchanged; rules identity stays v2. The existing live camera automatically consumes these limits; updated keyboard clamp evidence without binding persistence early.
- TDD: adapter suite failed missing module, then 97 focused storage/config/history cases passed. All five gates passed: 280 unit/component cases across eight files, typecheck, lint, build and 20 Chromium cases including sustained/25 retries and desktop/narrow extended-zoom captures. Existing Phaser bundle warning remains. Camera reload restoration remains solely step 11.2; no claim of a bound preference or hosted verification.

### Step 11.2 - Wire Reload-Safe Camera Restoration

Status: complete. Dependencies: 11.1.

**Implementation prompt**

Connect the adapter to the existing React zoom ref and Phaser camera boundary. Read safely at initialization, restore before first encounter rendering, and persist only actual O/P changes. Preserve R/Home/Start continuity and visit-local fallback. No writes per HUD/frame update or per-projectile React state; zoom cannot alter units, collisions, survival time or rules identity.

**Focused checks:** actual O/P -> reload -> rendered restored scale, min/max clamp, R/Home preservation, resize, write counts, blocked/quota fallback, untouched history and comparable simulation outcomes across zoom. Reuse pixel helpers without old circle assumptions.

**Acceptance:** all five gates pass; desktop/narrow min/default/max views are nonblank/layout-safe; same-origin persistence works and storage failures do not prevent practice.

**Execution and verification - 2026-10-25**

- Step 11.1 remote verified at `80882ee9c44716c45b62822fed3dbb9835b4232d`. React initializes the dedicated preference once and supplies its value before Phaser's first render. Retains existing zoom ref across R/Home/Start. An explicit camera-change callback writes only actual O/P changes, never HUD/frame publication; disposed callbacks are ignored. No simulation, history, comparison or clock change.
- Focused React test failed initial 1 versus saved 2.375, then all 34 React/storage cases passed. Covers exact restoration, no HUD writes, deduplication, Home/Start continuity and untouched history. Existing storage-failure tests and adapter cases retain nonfatal visit-local operation.
- Production-safe desktop/narrow tests now verify rendered player area after real O/P, reload and Start, without diagnostic source imports/injected outcomes; both passed. Final gates: 281 unit/component tests, typecheck, lint, build and all 20 Chromium cases passed, including 0.25/1/3 captures, resize/world-speed/camera invariance, storage failures, real deaths, sustained play and 25 retries. Nonblocking Phaser chunk warning unchanged; no hosted or human play approval claimed.

## Phase 12: Health And Accepted-Hit Feedback

### Step 12.1 - Expose Ephemeral Accepted-Hit Data

Status: complete. Dependencies: 11.2.

**Implementation prompt**

Extend existing simulation/session advancement with narrow accepted-hit output using the existing damage calculation's result, not a duplicated formula, HUD/HP delta or raw overlap. Report post-defense amount independently of lethal HP clamping; distinguish simultaneous hits and include the lethal hit. Output is ephemeral/bounded to the current advance, including multi-tick advances. Preserve session result-once behavior or adapt callers narrowly; no persistent event log/event bus or framework dependency.

**Focused checks:** nonlethal, same-tick independent hits/regeneration, spent-return suppression, lethal amount despite HP clamp, no hits after death, multiple ticks per advance, paused/no-step advances and no replay after Retry/Home.

**Acceptance:** each accepted event reaches the runtime once, including lethal data before result handling, without changing damage/time/history. Focused health/simulation/session tests, typecheck and relevant integration gates pass.

**Execution and verification - 2026-10-25**

- Step 11.2 pushed/remote verified at `78c84f7c5bb39119152e2c19e8705d69dc4c4714`. Existing health rule now returns its already-calculated post-defense amount (or null for dead player). Each simulation advance returns only its own `acceptedHits`: shard identity, damage and copied player position. No stored log, duplicated damage formula, HUD-delta inference, event bus or clock.
- Session forwards individual hits through an optional narrow callback before its unchanged once-only death-result handoff. Newborn/existing hits use the same registration, stable lethal stop and spent-state rules. Output is bounded by accepted shards in the capped current advance; no cross-advance accumulation/truncation or resource policy changes.
- TDD: four new simulation/session tests failed absent output/delivery, then 117 focused health/simulation/session cases passed. Covers simultaneous 128-HP events despite regeneration, multiple fixed ticks, lethal 128 with only 1 HP remaining, suppression after lethal/spent/zero-step/pause/end/Retry/Home and delivery before result creation.
- All five gates passed: 285 unit/component cases, typecheck, lint, build and 20 Chromium cases, including real deaths/history/sustained/25 retries. No visual/audio changes or hosted/human approval claimed. Existing Phaser bundle warning remains.

### Step 12.2 - Draw The Always-Visible Health Bar

Status: pending. Dependencies: 12.1.

**Implementation prompt**

Extend existing Phaser drawing with a below-player bar from authoritative HP/max HP; retain HUD. Propose/review unspecified dimensions, spacing/colors and encode named unit-aware presentation constants. Reuse drawing/cleanup primitives; no React entity overlay, collider extent, timer or independent health state. Keep it readable at approved zoom limits without hiding the physical outline.

**Focused checks:** full/partial/zero health, min/default/max zoom, resize/anchor/draw order, Retry/Home/results cleanup, unchanged physical body and HUD agreement. Reuse pixel/screenshots rather than canvas-existence assertions.

**Acceptance:** presentation values/review and all five app gates pass; no gameplay/version change.

### Step 12.3 - Render Individual Floating Hit Amounts

Status: pending. Dependencies: 12.2.

**Implementation prompt**

Consume accepted-hit output in the runtime for one post-defense number per hit, including independent same-update events. Review missing placement/duration/concurrency values; use named constants and the existing runtime's elapsed/pause policy, not another simulation clock/timer framework. Bound visual resources without changing accepted-hit data. Make lethal feedback observable during the immediate result transition, using a narrow presentation handoff if needed; propose that treatment explicitly. Do not delay death/results or destroy the only lethal display before it is visible.

**Focused checks:** exact amounts, independent numbers, no regeneration/spent-return false events, resource bound/cleanup, visible lethal feedback, pause and no stale Retry/Home effects; unchanged health/time/records.

**Acceptance:** approved numbers are observable once including at death without delaying results; all five gates and desktop/narrow review pass. Audio is not implemented yet.

### Step 12.4 - Add Quiet Hit Audio And Mute

Status: pending. Dependencies: 12.3.

**Implementation prompt**

Use the same hit output for an original quiet synthesized cue with visible accessible mute. Prefer the existing Phaser audio lifecycle where suitable; add only the smallest owned synthesis adapter needed. Obtain audible review/approval of gain, cue duration and voice cap. Bound mixing without stale catch-up sounds, dropping visual numbers or changing accepted hits. Keep mute visit-local unless persistence is separately approved; lethal cue must survive the immediate result handoff appropriately.

Unlock/resume from supported user gestures. Unavailable/blocked/suspended/rejected audio must not block practice. Dispose owned voices/listeners/resources and clear stale playback on lifecycle changes. No copied sounds, soundtrack, generic audio system or simulation audio imports.

**Focused checks:** cue request per accepted event, simultaneous voice cap, lethal cue, mute/unmute, gesture unlock, unavailable/rejected audio, pause policy, no stale Resume/Retry/Home playback and repeated-session cleanup. Automation does not replace audible approval.

**Acceptance:** numerical audio policy/audible approval and all five gates pass; mute/fallback work without changing gameplay, history or result timing.

## Phase 13: Controls And Paused-Session Safety

### Step 13.1 - Build The Accessible Controls Dialog

Status: pending. Dependencies: 12.4.

**Implementation prompt**

Add a minimal reusable React dialog with native semantics where suitable, existing CSS Modules/button patterns, labeled title/close action, focus containment/restoration and responsive content. List actual WASD/R/O/P/Escape, mute/Resume and UI actions, distinguishing standard browser keyboard activation from custom bindings. No UI framework, rebinding, tutorial page or touch controls. Expose Home access now; defer gameplay access until step 13.2 so incomplete pause/input isolation cannot leak into play.

**Focused checks:** accessible naming, keyboard open/close/Tab/Shift+Tab/focus return, Escape once, repeated opens, unchanged Home/session state, desktop/narrow clipping. Reuse React/browser tests, not another modal harness.

**Acceptance:** Home dialog passes relevant interaction/type/lint/build/browser checks and reflects current controls; no unguarded gameplay entry point.

### Step 13.2 - Integrate Controls With Pause And Input Isolation

Status: pending. Dependencies: 13.1.

**Implementation prompt**

Expose the same dialog from HUD through existing runtime/session boundaries. Opening during play/countdown freezes state and clears held input; closing leaves an explicit Resume requirement, preserving countdown remainder/prior phase and focus-loss safety. Draw centered Paused using existing countdown-overlay conventions, not another state machine.

Block WASD/R/O/P behind the dialog. Escape closes once without also toggling background pause. Preserve existing keyboard event-identity deduplication rather than removing queue safeguards. Clear held inputs, skip stale delta and require deliberate Resume. Home closure cannot start play; results/ended state cannot resurrect a session.

**Focused checks:** countdown/play/already-paused open, frozen state, blocked keys, Escape dedupe, held-key release, explicit Resume/focus return, blur/visibility, no first-frame catch-up, R/Home cleanup and one canvas/listener set. Use actual browser actions and focused session/React tests.

**Acceptance:** all five gates and desktop/narrow keyboard review pass; modal actions cannot move/reset/resume background play and Paused matches authoritative state.

## Phase 14: Regression, Handoff And Authorized Live Verification

### Step 14.1 - Run The Full Repeated-Practice Acceptance Matrix

Status: pending. Dependencies: 13.2.

**Implementation prompt**

Run all five app gates under the pinned toolchain. Reuse sustained-play/25-retry and desktop/narrow production-safe tests with explicit projectile/effect/audio bounds, one clock/canvas and once-only records. Add only missing coverage for cadence, calibrated edge condition/shared polygons, restored zoom extremes, bar, independent/lethal feedback, mute/audio failure, Controls/pause/focus and mixed versions. Preserve diagnostic versus production-safe separation: no hosted source imports or injected successful outcomes.

Review min/default/max zoom screenshots for nonblank correctly framed play, readable bar/numbers/dialog/results and no overlap/clipping. Exercise real deaths/Retry/R/Home/reload and storage/audio failures. Verify production assets exclude reference screenshots/crops. Fix only task regressions; record unrelated blockers without broad cleanup. Automated checks do not supply audible/human feel approval.

**Focused checks:** current unit/type/lint/build/browser outputs, actual run counts/bounds, screenshots and repeatability. Historical v1 release evidence is not evidence for this build.

**Acceptance:** all five gates/current visual checks pass and prior geometry/audio approvals are recorded with honest limitations. No publication/live verification implied.

### Step 14.2 - Finish The Local V2 Handoff

Status: pending. Dependencies: 14.1.

**Implementation prompt**

Update README/changelog/mechanics links for implemented behavior, controls, zoom, feedback/mute, versioned history and known fidelity/browser limits. Preserve v1 history and nominal-versus-final geometry provenance. Review scoped changes for duplicate rules/helpers, unused task-owned artifacts, accidental reference artwork, generated output and secrets; preserve user notes/images and avoid unrelated refactoring. Record final config/shape values, gate evidence and a short manual practice checklist.

Obtain actual completed-feature repeated-practice acceptance. Record any explicit technical-acceptance delegation and its limits, not invented human playtesting. List local reference files excluded from publication pending permission. Commit/push require separate authorization; live verification belongs to step 14.3.

**Focused checks:** links/document structure, config-to-doc correspondence, scope/artifact exclusion and acceptance evidence. Runtime repairs require relevant gates again rather than stale step 14.1 evidence.

**Acceptance:** local handoff/acceptance are recorded, publishing boundaries clear, and no new deployment is claimed. Step 14.3 remains pending until external prerequisites exist.

### Step 14.3 - Verify The Authorized Deployed V2

Status: pending. Dependencies: 14.2; separately authorized publication performed outside this command, with successful Actions/deployment evidence for the v2 commit.

**Implementation prompt**

Check external publication prerequisites first; if absent, record blocker and stop without committing/pushing/deploying or completing them automatically. Verify deployed commit, actual six-job Actions success, artifact/deployment identity and emitted Pages URL. Run existing opt-in hosted production-safe Chromium checks against that URL with isolated contexts/prefixed assets, not localhost/diagnostics or the user's profile.

Verify Start/cooldown/pattern, real damage/death/retry, zoom/reload, bar/hit feedback, mute/Controls/Resume, v2 records and compatible bests. Record asset/build parity where practical, network/page errors and actual browser/viewport scope. Public image exposure still requires separate permission. A live defect requires separately scoped local repair; never accept a failed deployment.

**Focused checks:** hosted suite, asset responses/version identity, screenshots and actual run/commit/deployment evidence. Audio automation is not fresh audible approval.

**Acceptance:** the authorized deployed v2 passes hosted checks with evidence/limitations; only then record v2 live-verified. No implied cross-browser certification or further feature work.

## Customization Choice

Use `.github/copilot-instructions.md` for shared engineering rules and `.github/prompts/implement-step.prompt.md` for the single-step command. No custom agent or skill is necessary yet. Consider a reusable encounter-authoring skill only when a second encounter exposes a genuinely repeated workflow; keep this enemy's facts in the mechanics document rather than duplicating them into a skill.

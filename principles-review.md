# YAGNI / DRY / SOLID Review

**Date:** 26 Oct 2026 · **Reviewer:** Senior developer review (static read of `app/`, `docs/`, `.github/`)
**Commit reviewed:** `3857e5c` (`main`, clean tree) · **Rules version:** `crystal-worm-child-head-paladin-v3`

## How this was reviewed

Full read of every production module under `app/src` (~2,900 lines), plus `app/scripts/review-geometry.mjs`,
the CSS, and the test layout. Every "unused"/"duplicated" claim below was checked with `grep` across
`src/` and `tests/`, separating production readers from test-only readers. Numeric claims were verified by
recomputing the project's own formulas in a standalone script (no project imports).

**Not verified:** `node_modules` is absent, so `npm run test`, `typecheck`, `lint`, `build` and `test:e2e`
were **not executed**. No behavioural regression is asserted here, and nothing was changed — this document
is the only output. The active `node` is v22.21.1 while `.node-version` pins 24.22.1, so install/run the
gates on the pinned toolchain before acting on anything below.

## Verdict

The architecture is better than most codebases this size. The layering the project set out to enforce is
genuinely intact: no React or Phaser import reaches `simulation/`, `config/` or `storage/`; there is exactly
one fixed-step clock; `HitAudio` and both storage adapters invert their dependencies through injected
factories; the geometry kernel validates its own inputs instead of trusting callers. Credit where due —
these are the hard parts, and they were done right.

The debt is concentrated in one place: **the configuration layer has four parallel representations of the
same tuning data, and the pixel-calibration pipeline that feeds it is no longer connected to what ships.**
Nearly every finding below is a consequence of that. One of them (F1) means a measurement chain spanning
three modules, a dev script and ~1,400 lines of test currently has *zero* effect on the shipped game.

| # | Finding | Principle | Severity |
|---|---|---|---|
| F1 | Pixel-calibration pipeline is fully overridden by hand-tuned values | YAGNI | **High** |
| F2 | Tuning data exists in four parallel shapes; adding a parameter needs five edits | DRY / OCP | **High** |
| F3 | `debugEncounterConfig` re-implements `ENCOUNTER_CONFIG`, and skips its validator | DRY | **High** |
| F4 | `EncounterScene` is a 530-line god class with eight responsibilities | SRP | **High** |
| F5 | Simulation reads the global config in four places despite carrying `state.config` | DIP | Medium |
| F6 | Test-only instrumentation ships in the production bundle | YAGNI / SRP | Medium |
| F7 | Collision bounding-radius formula duplicated verbatim | DRY | Medium |
| F8 | Palette defined twice (CSS hex strings + Phaser numbers); token system unused | DRY / YAGNI | Medium |
| F9 | Two storage adapters duplicate the same load/validate/degrade protocol | DRY | Medium |
| F10 | `EncounterConfig` pins four fields to literal singletons | LSP / OCP | Low |
| F11 | Dead exports and template leftovers | YAGNI | Low |
| F12 | Repeated numeric idioms (degree conversion, epsilon tolerances) | DRY | Low |
| F13 | Controls dialog and debug group list restate data that already exists | DRY | Low |

---

## F1 — The pixel-calibration pipeline has no effect on the shipped game

**Principle:** YAGNI · **Severity:** High
**Files:** `app/src/game/config/geometry-candidate.ts`, `app/src/game/config/encounter.ts:101-150`

`geometry-candidate.ts` measures each body in source pixels (`36x33` player, `42x55` head,
`56.576x34.66` shard), converts through `sourcePixelsPerTile = 435.118 / 19.2`, and derives shard timing
from arena geometry via `deriveShardTiming`. `ENCOUNTER_CONFIG` then passes every one of those bodies
through `scaleBody(...)` with hand-tuned dimensions from `SELECTED_ENCOUNTER_VALUES`, and takes its shard
timing from the same hand-tuned block.

`scaleBody` normalises by the source extents (`(vertex.x / sourceWidth) * width`), so **the source
measurement cancels out exactly.** What survives is only the normalised outline shape. Recomputing the
project's own formulas:

| Quantity | Derived by `geometry-candidate.ts` | Shipped by `ENCOUNTER_CONFIG` |
|---|---|---|
| Player body | 1.5886 × 1.4561 tiles | 1.25 × 1.25 (`selected.enemyWidth/Height`) |
| Head body | 1.8533 × 2.4269 tiles | 1.25 × 1.25 (same two values) |
| Shard body | 2.4965 × 1.5294 tiles | 1.45 × 0.65 |
| Shard reversal age | 2.2208 s | 1.5 s |
| Shard lifetime | 4.4416 s | 3.0 s |

Two consequences, both verified numerically:

1. **Player and head collision bodies are now identical** — same `beveledOutline`, and both scaled to
   1.25 × 1.25. Max per-vertex difference: `5.55e-17` tiles, i.e. floating-point noise. The distinct
   `36x33` and `42x55` measurements, their `dimensionToleranceSourcePixels`, and the two separate
   `bodies` entries are inert.
2. **`shardsPerGroup = 44` and `groupPeriodSeconds = 2.5` are stale.** The shipped encounter fires
   6 emitters × 11 shots = **66** per group, and `conservativeLiveShardBound` therefore reports 88 where
   the real bound is 132. `config.test.ts:590` asserts the stale 88 and passes, because it recomputes the
   same stale inputs.

A related tuning consequence worth raising with whoever owns the numbers: shipped shard reach is
`0.35 + 8 × 1.5 = 12.35` tiles against an arena radius of 19.2. `fixes.md` asks for "the arena as large as
double the reach of the enemy" — that would be a radius of 12.35. This review does not change gameplay
values; flagging it because F1 is why the mismatch is invisible.

**Why it matters:** `app/scripts/review-geometry.mjs` draws its calibration diagram from the *derived*
values, so the artefact used to approve this geometry documents a 4.44 s lifetime and 17.95-tile reach that
the game does not produce. The pipeline looks authoritative and is not.

**Recommendation:** decide which is the source of truth. Either (a) delete the measurement chain, keep the
two normalised outlines plus hand-tuned sizes, and keep the source pixels as a comment citing
`docs/mechanics.md` — the YAGNI-consistent option; or (b) make `ENCOUNTER_CONFIG` consume the derived
values and re-approve the gameplay change. Do not leave both. Whichever is chosen, regenerate the review
diagram from the values that actually ship, and make `shardsPerGroup` derive from
`emitterCount × shotsPerEmitter` instead of a literal.

## F2 — Tuning data exists in four parallel shapes

**Principle:** DRY, Open/Closed · **Severity:** High
**Files:** `encounter.ts:17-71` (type + `SELECTED_ENCOUNTER_VALUES`), `encounter.ts:101-150` (`ENCOUNTER_CONFIG`),
`encounter.ts:178-243` (`validateEncounterConfig`), `debug.ts:19-220` (`DEBUG_PARAMETERS`), `debug.ts:295-346`
(`debugEncounterConfig`)

One tunable travels through five hand-maintained places with three different naming conventions:

```
SELECTED_ENCOUNTER_VALUES.cooldownSeconds          flat, tuning names
  → EncounterConfig.burst.cooldownAfterLastShotSeconds   nested, domain names
  → ENCOUNTER_CONFIG.burst.cooldownAfterLastShotSeconds  the mapping
  → validateEncounterConfig's positiveValues map          validation
  → DEBUG_PARAMETERS[key: "cooldownSeconds"]              slider metadata
  → debugEncounterConfig's burst block                    the mapping, again
```

Adding one parameter means five correct edits in three files, with no compile error if you miss the
validator or the debug mapping. This is textbook shotgun surgery, and the drift it permits is not
hypothetical — F1 and F3 are both instances of a step having been missed.

The type system is close to catching this already: `SELECTED_DEBUG_VALUES` (`debug.ts:222`) asserts
`SELECTED_ENCOUNTER_VALUES satisfies Partial<Record<DebugParameterKey, number>>`. That proves the keys are
compatible but not that the two *mappings* agree.

**Recommendation:** make `DEBUG_PARAMETERS` the single registry. Give each entry an `apply(config, value)`
(or a typed path) along with its `min`/`max`/`step`/`label`, then build both `ENCOUNTER_CONFIG` and the debug
config by folding the registry over a base. `SELECTED_ENCOUNTER_VALUES` becomes just the default values,
`debugEncounterConfig` disappears into the fold, and the validator reads its bounds from the same registry.
One edit per new parameter, and the compiler enforces completeness.

## F3 — `debugEncounterConfig` duplicates the config builder and skips its validator

**Principle:** DRY · **Severity:** High
**Files:** `debug.ts:295-346`, `encounter.ts:101-150`, `encounter.ts:243`

`debugEncounterConfig` rebuilds `player`, `enemy`, `emitters`, `burst` and `shard` with the same structure
and the same `scaleBody` / degree-to-radian conversions as `ENCOUNTER_CONFIG`. Two concrete divergences
already present:

- `ENCOUNTER_CONFIG` scales the player by `selected.enemyWidth/enemyHeight` unconditionally
  (`encounter.ts:110-114`); `debugEncounterConfig` gates the same scaling behind
  `settings.matchPlayerToHead`. The default path therefore has no equivalent of
  `matchPlayerToHead: false`, and the parameter named `enemyWidth` silently sizes the *player*.
- `validateEncounterConfig(ENCOUNTER_CONFIG)` runs at module load (`encounter.ts:243`).
  `debugEncounterConfig` returns without ever calling it. It calls `validateDebugSettings`, which checks
  slider bounds and `reversalSeconds < lifetimeSeconds` — but not the cross-field invariants the encounter
  validator owns (bodies fit the arena at spawn, enemy slower than the Paladin, zoom ordering). Debug
  configs can reach the simulation in states the production config is forbidden to take.

**Recommendation:** fold into F2's registry so there is one builder. Until then, at minimum call
`validateEncounterConfig` on the result of `debugEncounterConfig`, and rename `enemyWidth`/`enemyHeight` to
`bodyWidth`/`bodyHeight` to match what they actually control.

## F4 — `EncounterScene` is a god class

**Principle:** Single Responsibility · **Severity:** High
**File:** `app/src/game/phaser/encounter.ts:79-608` (530 lines, one class)

Eight distinct responsibilities in one class: keyboard decoding and event-identity dedup; focus /
visibility / pause lifecycle; camera zoom and centring; arena rendering; body and shard rendering; health
bar layout; floating hit-number pool with lane assignment and lifetime; HUD publication throttling; audio
orchestration; debug re-application; and test inspection.

`drawEntities` (`:478-563`, 86 lines) alone draws bodies, draws every shard, lays out the health bar from
the player's body extent, and repositions every hit number. The pause path is reachable from five separate
triggers (`onFocusOut`, `onVisibility`, `window.blur`, `setControlsOpen`, and a focus check inside
`update`), which is why `clearMovement()` and `skipDelta` have to be re-asserted defensively in each.

The project's own architecture rule ("Phaser owns runtime integration/drawing") is satisfied at the module
boundary but not inside it.

**Recommendation:** extract three collaborators that need no Phaser scene subclass — `EncounterInput`
(key→direction decoding, suppression, held-key dedup), `HitNumberLayer` (pool, ageing, lane layout), and
`ArenaRenderer` (ground, bodies, health bar). The scene then wires them and owns the frame loop.
`HitAudio` is the model to copy: it already does exactly this for sound.

## F5 — The simulation reads the global config despite carrying `state.config`

**Principle:** Dependency Inversion · **Severity:** Medium
**File:** `app/src/game/simulation/simulation.ts:59, 181-188, 194, 461`

`SimulationState` carries `config: EncounterConfig`, and most code correctly uses `state.config`. Four
places bypass it and import the concrete global:

| Line | Reads | Should read |
|---|---|---|
| `:188` | `ENCOUNTER_CONFIG.arena` (inside `constrainToArena`) | `state.config.arena` |
| `:194` | `ENCOUNTER_CONFIG.simulation.fixedStepSeconds` | `state.config.simulation.…` |
| `:461` | `ENCOUNTER_CONFIG.simulation` | `state.config.simulation` |
| `:59` | `ENCOUNTER_CONFIG.simulation.fixedStepSeconds` (module constant) | derive per state |

This is latent, not live: `debugEncounterConfig` spreads `ENCOUNTER_CONFIG` and overrides only
`player`/`enemy`/`emitters`/`burst`/`shard`, so `arena` and `simulation` are currently identical either way.
The moment a debug slider touches arena radius or step rate, `constrainToArena` silently clamps against the
wrong arena. `health.ts` has the same shape: it reads `PALADIN_STATS` and `PALADIN_DERIVED_STATS` from
module scope, so the damage and regeneration rules cannot be exercised with any other stat block.

**Recommendation:** make `createSimulation(config = ENCOUNTER_CONFIG, stats = PALADIN_DERIVED_STATS)` and
route every read through the state. Keeping the defaults means no caller changes and no speculative
abstraction — just an honest seam, which also removes the main reason the simulation tests have to assert
against globals.

## F6 — Test-only instrumentation ships in production

**Principle:** YAGNI, SRP · **Severity:** Medium
**Files:** `phaser/encounter.ts:565-607, 610-613, 77`, `phaser/hit-audio.ts:18-19, 100-107`,
`simulation.ts:52-55`

Four instrumentation surfaces exist solely for tests, confirmed by grep (no production reader):

- `EncounterScene.inspect()` (43 lines) and `inspectEncounter()`, reached by `tests/app.spec.ts:52-61`
  through a dynamic import. The `encounters` WeakMap (`:77`) is populated on every `createEncounter`.
  Exported functions tree-shake, but **class methods do not** — `inspect()` is in the production bundle.
- `HitAudio.requests` / `played` counters increment on every hit in production; only `inspect()` reads them.
- `AdvanceResult.stepsExecuted` and `discardedSeconds` are returned on every advance and read by
  `simulation.test.ts` only — `SessionController.advance` discards both.

The e2e suite's dev/production split (`playwright.config.ts` `grep` / `grepInvert` on `production assets`)
shows the intent was for diagnostics to stay out of the production path. The code does not fully honour it.

**Recommendation:** move `inspect()` out of the class into a function over the scene's public surface in a
`*.debug.ts` module imported only by tests, so it tree-shakes; drop the two `HitAudio` counters in favour of
spying on `play()`; and either have `SessionController` surface `stepsExecuted`/`discardedSeconds` or assert
the observable state (`ticksElapsed`, `accumulatorSeconds`) instead.

## F7 — Collision bounding-radius formula duplicated verbatim

**Principle:** DRY · **Severity:** Medium
**File:** `simulation.ts:61-70` and `:156-165`

The same expression — max vertex distance of the player body plus max vertex distance of the shard body —
is written twice, once as the module constant `combinedBoundingRadiusTiles` and once inline in
`setDebugSettings`. Identical four-line `Math.hypot(vertex.x, vertex.y)` reductions.

`debug.ts:12-17` has a third instance of the same family: `extent()` recomputes the max-minus-min span that
`scaleBody` (`encounter.ts:81-98`) already computes internally, and the two must stay consistent or every
slider's `defaultValue` drifts from the config it describes.

**Recommendation:** one `boundingRadiusTiles(vertices)` and one `bodyExtentTiles(vertices)` in
`simulation/geometry.ts`, consumed by all five sites. `scaleBody` should also expose the extents it already
computes rather than making `debug.ts` recompute them.

## F8 — The palette is defined twice, and the token system is unused

**Principle:** DRY, YAGNI · **Severity:** Medium
**Files:** `app/src/index.css`, `app/src/App.module.css`, `phaser/encounter.ts:44-75`

Six colours are maintained in two incompatible notations — CSS hex strings in `App.module.css` and numeric
literals in the Phaser `presentation` object:

| Colour | `App.module.css` | `phaser/encounter.ts` |
|---|---|---|
| `101b1b` background | 6 uses | `0x101b1b` |
| `1c302a` ground | 1 | `0x1c302a` |
| `29423a` grid | 2 | `0x29423a` |
| `648575` boundary | 2 | `0x648575` |
| `ea7969` enemy | 1 | `0xea7969` |
| `55d6a0` health fill | 1 | `0x55d6a0` |

Meanwhile `index.css` defines a full design-token system (`--text`, `--bg`, `--accent`, `--sans`, `--mono`,
plus a `prefers-color-scheme: dark` block) that **`App.module.css` never references** — `grep -c 'var(--'`
returns 0. `App.module.css` instead hardcodes 14 distinct hex values, repeating `#c4d5cc` 8 times and
`#4a6b5c` 7 times, and writes `font-family: Consolas, monospace` four times where `--mono` exists.

`index.css` is also substantially Vite starter scaffolding: a purple `--accent: #aa3bff` that contradicts
the app's green/teal palette, an unused `.counter` class, and `h2` declared twice (`:70` and `:85`). The
project already did one pass of this cleanup (`implementation-plan.md:477`, "unused palette constants").

**Recommendation:** define the encounter palette once as hex numbers in a `presentation` module, derive the
CSS custom properties from it (or generate both from one source), and have `App.module.css` consume
`var(--…)`. Delete the starter tokens, `.counter`, and the duplicate `h2`. The dark-mode block is dead
weight until someone decides whether the trainer supports light mode at all.

## F9 — Both storage adapters duplicate the same protocol

**Principle:** DRY · **Severity:** Medium
**Files:** `storage/attempts.ts:88-115`, `storage/zoom.ts:17-40`

`AttemptHistory` and `ZoomPreference` independently implement: call the injected factory in a `try`,
`getItem`, bail on `null`, `JSON.parse`, validate or `throw`, assign, remember the storage handle, and on
any failure null the handle and degrade to visit-local. `set`/`save` then repeat the
try/`setItem`/null-the-handle pattern. The only real differences are the validator and whether a
user-visible warning is produced.

`zoom.ts:2` also imports its storage interface as `type HistoryStorage` — a two-method key-value interface
named after the first of its two consumers.

**Recommendation:** extract `PersistedValue<T>(key, validate, getStorage)` owning the load/degrade/write
protocol; `AttemptHistory` composes it and adds retention, dedup and warning text, `ZoomPreference` becomes
a thin wrapper. Rename the interface `KeyValueStorage`. This is consolidation of code that already exists
twice, not speculative generalisation.

## F10 — `EncounterConfig` pins four fields to literal singletons

**Principle:** Liskov Substitution, Open/Closed · **Severity:** Low
**File:** `encounter.ts:28-48`

```ts
contactDamageHp: 0;          blocksPlayer: false;
expiration: "lifetime-only"; hitPolicy: "once-per-shard";
```

These are declared in the *type*, not just the value, so no conforming config can vary them — the interface
models a variation point and then forbids it. Any future "contact damage" or "despawn on collision" variant
breaks the type for every existing consumer rather than substituting into it. The four fields are read by
nothing in production (grep: declaration and assignment only).

They do carry real documentary value — they record approved rules that `docs/mechanics.md` and the project
instructions explicitly protect, and that intent should survive any refactor.

**Recommendation:** either widen to `number` / `boolean` / union types and let `validateEncounterConfig`
assert the approved values (keeping the rule enforced, at runtime, in the place that owns rules), or move
them out of the structural type into a documented `APPROVED_RULES` constant. Don't encode policy in a type
that pretends to be configurable.

## F11 — Dead exports and template leftovers

**Principle:** YAGNI · **Severity:** Low

Confirmed by grep across `src/` and `tests/`:

| Symbol | Where | Status |
|---|---|---|
| `SessionSnapshot` | `models.ts:62-70` | No production reader; only `config.test.ts` and `app.spec.ts`. Production uses `EncounterView` + `SimulationState`. |
| `conservativeLiveShardBound` | `geometry-candidate.ts:121` | Asserted by `config.test.ts:590` only — and the assertion is stale (F1). |
| `shardsPerGroup`, `groupPeriodSeconds` | `geometry-candidate.ts:21-22` | Feed only the above. |
| `dimensionToleranceSourcePixels` | `geometry-candidate.ts:10` | Asserted `> 0` by `config.test.ts:532`; nothing uses the tolerance. |
| `anchor`, `orientation`, `approval`, `source` | `geometry-candidate.ts` | Metadata, never read. `approval`/`source` are worth keeping as provenance; the other two are not. |
| `centerTravelTiles` | `geometry.ts:360` | Returned by `deriveShardTiming`; one test assertion. |
| `maximumShardCenterDistanceTiles`, `emitterOffsetTiles`, derived `reversalAgeSeconds`/`lifetimeSeconds` | `geometry-candidate.ts` | Used by `scripts/review-geometry.mjs` and tests — **not** by the game (F1). |
| `.counter`, duplicate `h2`, `--accent*`, `--social-bg`, `--shadow` | `index.css` | Vite starter remnants (F8). |

`src/test/probe.module.css` is correctly scoped (used only by `App.test.tsx:18` to prove CSS Modules work).

**Recommendation:** delete `SessionSnapshot` (have the e2e `Inspection` type derive from `SimulationState`),
drop the inert metadata fields, and resolve the rest as part of F1. Add a dead-export check — `knip` or
`ts-prune` — to `npm run lint`; `.oxlintrc.json` enables only two rules and no linter catches unused
*exports*, which is precisely how this accumulated.

## F12 — Repeated numeric idioms

**Principle:** DRY · **Severity:** Low

- **Degree↔radian** conversion is open-coded four times: `encounter.ts:130`, `debug.ts:99` (inverse),
  `debug.ts:324`, and inside `simulation.ts:395-400` (`updateAttacks`). Three of the four convert the same
  two fields.
- **Floating-point tolerance** uses a scattered `Number.EPSILON × k` idiom with four different `k` and no
  shared rationale: `geometry.ts:6` (`64 × EPSILON`), `simulation.ts:59` (`× 16`), `simulation.ts:260`
  (`× 64`), `simulation.ts:352` (`× 16`), `simulation.ts:420` (`× 16`), `session.ts:24` (`× 32`).

The tolerance policy is load-bearing — it governs shard reversal boundaries, shot scheduling and countdown
rounding, and the project stabilised browser tests against exactly this class of timing issue (`4563f6d`).
Six independent magic multipliers is the wrong shape for something that important.

**Recommendation:** `degreesToRadians` / `radiansToDegrees` in a shared module. For tolerance, name the
budgets (`geometricRoundoffUlps = 64`, `temporalRoundoffUlps = 16`, …) in one place with a comment
explaining why each differs, and have callers reference them.

## F13 — UI restates data that already exists

**Principle:** DRY · **Severity:** Low
**File:** `app/src/App.tsx:77, 40-75, 119-170, 299-307, 435-440`

- `DebugPanel` hardcodes `(["Enemy", "Emitters", "Burst", "Projectiles"] as const)` and then filters
  `DEBUG_PARAMETERS` by `group` — the group list is already derivable from the registry it filters. A new
  group renders nothing, silently.
- The three boolean toggles (`godMode`, `chaseArenaCenter`, `matchPlayerToHead`) are three copy-pasted
  JSX blocks differing only in key and label; they belong in the same registry as the sliders.
- `ControlsDialog`'s `<dl>` restates the keybindings in prose while the real bindings live in
  `phaser/encounter.ts` (`KeyW/A/S/D`, `KeyO`, `KeyP`, `KeyR`, `Escape`). Two sources, no link — the
  documentation can drift from the handler with nothing to catch it.
- `PALADIN_STATS.vitality/speed/defense` is rendered as a three-`<span>` group twice (HUD `:299-307`,
  home preset `:435-440`).
- `App()` is ~230 lines and additionally owns the hardcoded changelog JSX; that content is data, and
  belongs in a module the way `DEBUG_PARAMETERS` is.

**Recommendation:** derive the group list (`[...new Set(DEBUG_PARAMETERS.map(p => p.group))]`), move the
toggles into the registry, export a `CONTROLS` map from the Phaser layer that both the key handler and the
dialog read, and lift the changelog and the stat-chip group into small components/constants.

---

## What is working well

Worth protecting through any refactor:

- **Layer discipline holds.** No React, Phaser, DOM or `localStorage` reference appears in `simulation/`,
  `config/` or `storage/`. This is the constraint most projects lose first.
- **One clock.** A single fixed-step accumulator with explicit `maxStepsPerUpdate` clamping and tracked
  discard. No second timeline anywhere.
- **Dependency inversion where it counts.** `HitAudio(getContext)`, `AttemptHistory(getStorage)` and
  `ZoomPreference(getStorage)` all take factories, which is why the storage-failure and audio paths are
  testable without a browser.
- **The geometry kernel validates its own contract.** `validatedAxes` rejects degenerate, collinear,
  concave and self-crossing bodies and re-validates after transform — the tolerance handling is careful,
  genuinely hard code to get right.
- **Storage is defensive by construction.** Schema version, per-record type guards, dedup by id, retention
  bound, frozen copies, and graceful visit-local degradation on corrupt / blocked / quota failure.
- **Honest provenance.** `RULES_VERSION` / `DEBUG_RULES_VERSION` keep debug attempts out of saved history
  and out of personal-best comparisons — a real integrity mechanism, not a label.

## Suggested order of work

Each step is independently shippable behind the project's existing gates. Steps 1-2 are the ones that pay
for themselves; the rest is cleanup.

1. **Resolve F1 first.** Everything else in the config layer depends on knowing which numbers are
   authoritative. This needs a tuning decision, so it is the one item that should not be refactored
   unilaterally — it touches approved gameplay values and `docs/mechanics.md` provenance.
2. **Unify the tuning registry (F2 + F3 + F13's first two points).** One registry, one builder, one
   validator. Largest single reduction in drift risk, and it closes the validation gap in F3.
3. **Extract from `EncounterScene` (F4), then strip instrumentation (F6).** Easier in that order — the
   extracted collaborators give `inspect()` a public surface to read from outside the class.
4. **Thread config through the simulation (F5)** with defaulted parameters, so no caller changes.
5. **Consolidate the small duplications:** F7 geometry helpers, F9 `PersistedValue`, F12 shared
   conversions and named tolerance budgets.
6. **Clean the presentation layer (F8) and delete dead code (F11),** adding `knip` to `lint` so F11
   cannot recur.
7. **Revisit F10** when a second encounter or rules variant actually exists — the type-level pinning is
   only a problem at that point, and changing it earlier would itself be speculative.

Two notes on method, given the project's stated rules. These are refactors of code that already exists in
duplicate, not new abstractions — F2's registry replaces five hand-maintained mappings with one, and F9's
`PersistedValue` replaces two copies of one protocol. And none of this should change gameplay: F1 is the
only finding that can, which is why it is called out as a decision rather than a fix.

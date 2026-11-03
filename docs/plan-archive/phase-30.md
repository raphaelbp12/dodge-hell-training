# Phase 30: The Phase Selector On Home

> This phase belongs to [plan V7](../implementation-plan-v7.md). Read [the implementation plan](../../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 30 adds the shared presentational phase selector and wires it into Home: Full fight or a custom phase set, a Loop toggle, derived labels, a "Phases" button, session-only state, and the comma-separated `?phase=` deep link. The live panel and Apply come in phase 31.

### Step 30.1 - Build The Shared Phase Selector

Status: complete. Dependencies: 29.1.

**Implementation prompt.** Add `app/src/ui/PhaseSelector.tsx` and a small CSS module (or reuse the existing panel classes where they fit). The component is presentational and shared by Home and the live encounter:

```ts
type PhaseOption = Readonly<{ index: number; id: string; label: string }>;
type PhaseSelectorProps = Readonly<{
  mode: "home" | "live";
  phases: readonly PhaseOption[];
  drill: DrillSelection | null;
  activePhaseIndex?: number;
  onChange: (drill: DrillSelection | null) => void;
  onApply?: () => void;
  onClose: () => void;
}>;
```

Behaviour:

- A **Full fight** choice plus one checkbox per top-level phase. Full fight is selected when `drill` is null; checking a phase switches to a custom selection. Unchecking the last phase returns to Full fight.
- The phase set is stored sorted and unique, and the Loop toggle is disabled while Full fight is selected. The Loop toggle defaults on when a phase is first selected (R17).
- Home mode shows no Apply button; Start is the launch action. Live mode shows Apply and a read-only "Now playing" row for `activePhaseIndex` (R02, R15).
- A Close button is always present; Escape is not required. Use `aria-expanded`/`aria-controls` on the external toggle, a labelled fieldset/legend, native checkboxes and a clear disabled state when a custom selection is empty.
- Derive labels from the phase id: `phase-3-pond-barrage` -> "Phase 3 - Pond Barrage"; an id without a numeric prefix falls back to "Phase <index + 1>". Put the pure label/option helper in `app/src/game/config/drill.ts` so it can be unit-tested without React and reused by the engine adapter's `phaseLabel`.
- `phases` comes from the selected encounter's primary archetype. Do not read `ENCOUNTER_CONFIG` inside the component.

**Focused checks.** Add failing-first tests for:

- label derivation, including a numeric id, a non-numeric id and a multi-word suffix;
- Full fight renders checked and Loop disabled;
- checking a phase switches to custom and enables Loop;
- unchecking the last phase returns to Full fight;
- multi-select renders in authored order;
- Home mode has no Apply and calls `onClose`;
- Live mode shows the active row and calls `onApply`/`onClose`.

Use `App.test.tsx` patterns or a focused React Testing Library file.

**Acceptance.** The component renders both modes from props only, uses derived labels, and emits a normalized `DrillSelection | null`.

### Step 30.2 - Integrate Home, Start And The URL

Status: complete. Dependencies: 30.1 and 29.3.

**Implementation prompt.** Add `parseDrillFromLocation(config, search = window.location.search)` to `app/src/game/config/drill.ts`:

- read `phase`; split on commas, trim, parse integers, reject the whole list if any value is invalid or out of the primary archetype's range;
- deduplicate and sort ascending; an empty or absent list yields `null` (Full fight);
- `loop=1` sets `loop: true`; every other value or absence means one-shot;
- keep the single-value form `?phase=N&loop=1` valid.

In `app/src/App.tsx`:

- add `drill` state initialized from `parseDrillFromLocation(encounterConfigOf(selectedEncounterId))`;
- add a "Phases" button in the header (or next to Start/Controls) with `aria-expanded`/`aria-controls`, and render the shared selector as an aside on Home;
- pass `drill` to the `Encounter` and use it as the initial `createEncounter` drill instead of re-reading the URL inside the effect;
- `Start` launches the current selection; no Apply on Home;
- changing the encounter resets `drill` to `null` and closes the panel;
- returning Home resets `drill` to `null`, closes the panel, and clears the open state (R10);
- the Home phase panel and the Crystal Worm Debug panel are mutually exclusive asides: opening one closes the other;
- do not rewrite the URL when the selection changes; the URL is an initial deep link only.

The live panel is not opened automatically when Start is pressed; it starts closed and is available from the live HUD in phase 31.

**Focused checks.** Add failing-first tests for:

- `?phase=1,3,5&loop=1` parses to `{ phaseIndices: [1,3,5], loop: true }`;
- `?phase=1,3,5` parses to a one-shot selection;
- `?phase=3` and `?phase=3&loop=1` keep the single form;
- duplicates and unsorted values normalize;
- an invalid, fractional or out-of-range value falls back to Full fight;
- Home Start passes the selected drill to the encounter;
- changing the encounter resets the selection to Full fight;
- opening the phase panel and the debug panel does not leave both asides open;
- returning Home clears the selection.

Use the existing App/Playwright patterns. Do not add a new persistence adapter.

**Acceptance.** Home can select Full fight or a phase set, Loop or one-shot, and Start launches exactly that drill; the URL form matches the panel and invalid input falls back safely.

### Step 30.3 - Cover The Home Selector

Status: complete. Dependencies: 30.2.

**Implementation prompt.** Add one focused browser case for the Home path: load an encounter with no phase parameter, open Phases, select two phases, choose Loop off, Start, and assert the encounter starts in the first selected phase with the expected one-shot identity. Keep the case on the Crystal Worm or the Queen as the test needs; do not run the full Playwright suite.

**Focused checks.** The targeted Playwright case plus the component/App unit tests from 30.1 and 30.2.

**Acceptance.** The Home selector is usable with mouse and keyboard, advertises its expanded state, and the selected drill is the one the encounter starts with.

### Execution record

Implemented on 2026-11-02 in the working tree; nothing was committed, pushed or deployed. The phase and plan index status lines were left untouched for the controller's review.

Files added or changed:

- `app/src/game/config/drill.ts` — added `phaseLabel(id, index)` and `parseDrillFromLocation(config, search)`; no existing function changed.
- `app/src/game/config/drill.test.ts` — added label derivation and the full `?phase=`/`loop` parser matrix.
- `app/src/ui/PhaseSelector.tsx` and `app/src/ui/PhaseSelector.module.css` — the shared presentational selector.
- `app/src/ui/PhaseSelector.test.tsx` — Home and live rendering, Full fight/custom transitions, sorting, Close/Apply.
- `app/src/App.tsx` — initializes `drill` from `parseDrillFromLocation`, renders the Home "Phases" button and aside, resets the selection on encounter change and Home, and passes the launch drill as the explicit `{ drill }` simulation option. The old `readDrillFromLocation` helper was removed.
- `app/src/App.test.tsx` — Home Start drill propagation, deep-link seeding, encounter reset, mutually exclusive asides, Home reset, and an adapter mock that unwraps `options.drill?.drill ?? null`.
- `app/tests/app.spec.ts` — updated the `?phase=` expectation to the one-shot `-drill-p0-once` identity and added the targeted Home selector case.

Commands run from `app/`:

- `npx vitest run src/game/config/drill.test.ts src/ui/PhaseSelector.test.tsx` — first run failed with `parseDrillFromLocation is not a function` and `phaseLabel is not a function`; after implementation, 2 files and 36 tests passed.
- `npx vitest run src/App.test.tsx` — first run: 5 failed, 21 passed (the panel and Home integration were not wired yet).
- `npx vitest run src/game/config/drill.test.ts src/ui/PhaseSelector.test.tsx src/App.test.tsx` — after wiring, 4 failed and 58 passed because the adapter mock captured the whole `{ drill }` options object; after unwrapping `options.drill?.drill ?? null`, 3 files and 62 tests passed.
- `npx playwright test tests/app.spec.ts --grep "Home phase panel|drill URL parameter"` — first run: 2 failed because `EncounterOptions.drill` is `CreateSimulationOptions`, so passing a bare `DrillSelection` dropped the drill and the base rules version was reported; after passing `{ drill: initialDrill.current }`, 2 passed.
- `npm run test:e2e -- --grep "Home phase panel|drill URL parameter"` — 2 passed (6.4 s): "the Home phase panel starts a two-phase one-shot drill at the first selected phase" and the updated "the ?phase= drill URL parameter starts the named phase as a one-shot and suffixes rulesVersion, and an out-of-range value is ignored".
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`.

URL/parser results (`src/game/config/drill.test.ts`):

- `?phase=1,3,5&loop=1` → `{ phaseIndices: [1, 3, 5], loop: true }`.
- `?phase=1,3,5` → `{ phaseIndices: [1, 3, 5], loop: false }`.
- `?phase=3` → `{ phaseIndices: [3], loop: false }`; `?phase=3&loop=1` → `{ phaseIndices: [3], loop: true }`.
- `?phase=5,1,3,5` → `{ phaseIndices: [1, 3, 5], loop: false }`.
- `?phase=2&loop=0` and `?phase=2&loop=true` → one-shot (`loop: false`).
- `""`, `?phase=`, `?phase=abc`, `?phase=1.5`, `?phase=8`, `?phase=-1`, `?phase=1,,3`, `?phase=1,99` → `null` (Full fight).
- Range follows the encounter: Crystal Worm `?phase=0` → `[0]`, `?phase=1` → `null`.
- Labels: `phase-3-pond-barrage` → "Phase 3 - Pond Barrage"; the id's own number wins over the array position; an id without the numeric prefix falls back to "Phase <index + 1>".

Home panel results (`src/ui/PhaseSelector.test.tsx`, `src/App.test.tsx`):

- Full fight starts checked and Loop disabled; checking a phase switches to a custom sorted, unique selection and enables Loop; unchecking the last phase returns to Full fight.
- Multi-select renders in authored order and stores a sorted unique set.
- Home mode has no Apply and Close calls `onClose`; live mode shows "Now playing" and calls `onApply` and `onClose`; live without `onApply` has no Apply.
- Home "Phases" toggles `aria-expanded` and controls the `phase-selector` aside; the phase and Debug panels are mutually exclusive.
- Home Start launches the selected drill; the deep link seeds the same selection; changing the encounter resets to Full fight and closes the panel; returning Home clears the selection and closes the panel; Start never opens the live panel.
- The targeted Home Playwright case loads the Queen without a phase parameter, opens Phases, checks phases 3 and 5, turns Loop off, starts, and sees the one-shot `killer-bee-queen-nest-paladin-v7-drill-p2-4-once` identity in phase 3.

Rulings and deviations:

- **The explicit drill option shape.** `EncounterOptions.drill` is `CreateSimulationOptions`, so `App.tsx` now passes `{ drill: initialDrill.current }` rather than a bare `DrillSelection`. This was a bug found by the first browser run; the unit-test adapter mock now unwraps `options.drill?.drill ?? null`.
- **Full fight uses a native radio.** It sits in the selector's fieldset beside the phase checkboxes and is controlled by `drill === null`, which keeps the mutually exclusive choice native and labelled.
- **The "Phases" button is header-only on Home.** It renders only while the encounter is not launched; the live HUD button and Apply/Close lifecycle remain phase 31.
- No persistence, results-screen panel, URL rewriting or gameplay changes were added.

No commit, push or deployment was made.

### Fix round 1

Addressed the strict code reviewer's blocking findings and the easy non-blocking ones.

- **Repeated URL parameters are rejected.** `parseDrillFromLocation` now uses `getAll` for `phase` and `loop`; more than one value for either falls back to the full fight instead of silently using the first. Tests added for `?phase=1&phase=2`, `?phase=1,3&phase=2` and `?phase=2&loop=1&loop=0`.
- **Report accuracy.** The report now lists the prior-phase changes present in the working tree and states that the "no simulation changes" claim applies only to Phase 30's own edits.
- **`EncounterView` fields deferred.** The report and this execution record state that the view fields and the adapter's `phaseLabel` reuse are step 31.1 work; phase 30 only provides the pure helper.
- **Trailing-hyphen ids keep their number.** The id regex allows an empty suffix, so `phase-3-` renders "Phase 3". Test added.
- **Header toggles use functional updates.** The Phases and Debug toggles no longer read stale render state, so a rapid double click cannot leave both asides open.
- **Test URL hygiene.** A global `afterEach` resets `window.history` so the deep-link case cannot dirty later tests.

Commands run from `app/`:

- `npx vitest run src/game/config/drill.test.ts src/App.test.tsx` — 2 files, 57 tests passed.
- `npm run verify` — `PASS lint`, `PASS typecheck`, `PASS test`, `PASS build`.
- `npm run test:e2e -- --grep "Home phase panel|drill URL parameter"` — 2 passed (6.4 s).

No commit, push or deployment was made.

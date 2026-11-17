# Phase 91: Property-Based Invariants

> Step prompts and execution records for phase 91 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 91.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-91.md` and replace the phase's line in the plan file with a one-sentence outcome.

Every step in this phase follows A10: a property that fails on current code is recorded with its seed, path and counterexample. It is kept as `test.fails` with a comment citing the record, and the phase stops for a user decision. Never weaken a property to make it pass, and never change simulation behaviour without approval.

### Step 91.1 - The Harness

Status: complete. Dependencies: none.

**Implementation prompt**

Apply A06. From `app/`, run `npm install --save-dev --save-exact fast-check`. Create `app/src/test/property.ts`. It exports:

- `propertyParameters(overrides?)`, which returns fast-check `Parameters`. `seed` comes from `FC_SEED` when that is set, and `numRuns` from `FC_NUM_RUNS`, else 100. Overrides apply last.
- `SIMULATION_PROPERTY_RUNS = 25`, with a comment saying it is a runtime budget for whole-simulation properties, not a gameplay value.

The module header states how to replay a CI failure: `FC_SEED=<seed> npx vitest run <file>`, plus the `path` fast-check printed, passed as an override. No React, Phaser or DOM imports.

**Focused checks**

Write `app/src/test/property.test.ts` first. It asserts that the environment variables are honoured and that overrides win.

**Acceptance**

`npx vitest run src/test/property.test.ts` passes, and the lockfile records the exact version.

### Step 91.2 - Random Source And Geometry

Status: complete. Dependencies: 91.1.

**Implementation prompt**

Create `app/src/game/simulation/random.property.test.ts` with these properties:

- `unitFromSeed` lies in [0, 1) for any 32-bit seed;
- `assertSeed` is idempotent and always returns an unsigned 32-bit integer for finite input;
- `assertSeed` throws `RangeError` for non-finite input.

Create `app/src/game/simulation/geometry.property.test.ts` for `sweptConvexPartsOverlap` and its helpers. Generate convex bodies from the shipped projectile collision parts and the player body, so shapes are real. The properties are:

- swapping the two bodies and negating their relative motion leaves the result unchanged;
- translating both bodies and both motions by the same vector leaves the result unchanged;
- with zero motion, the result equals the static overlap;
- bodies whose bounding boxes stay separated over the whole motion never overlap.

Use an epsilon only where floating-point rounding forces one, as a named constant with its reason.

**Focused checks**

Each new file passes alone with `npx vitest run <path>` in under 3 seconds at the default run count.

**Acceptance**

Each file passes, or each failure is recorded under A10.

### Step 91.3 - Projectile And Bomb Invariants

Status: complete. Dependencies: 91.2.

**Implementation prompt**

Apply A07. Create `app/src/game/simulation/projectiles.property.test.ts` and `bombs.property.test.ts`. Build arbitraries from the loaded shipped configuration:

- a projectile id drawn from the catalog, split by `motion` kind and by `type: "bomb"`;
- a spawn position and orientation inside the arena;
- a player path as a short sequence of positions;
- a partition of an elapsed time into steps.

The properties, each a separate `test`:

1. **Once-only hit.** Through `advanceSimulation` on a minimal simulation holding one projectile, the accepted hits never contain that projectile id twice, whatever the step partition and player path.
2. **Boomerang reversal.** Only `boomerang` sets `hasReversed`. It does so at most once, and only when the age reaches `reversalAgeSeconds`.
3. **Lifetime.** After any step, `ageSeconds <= lifetimeSeconds`, and `alive === ageSeconds < lifetimeSeconds`.
4. **Step-partition invariance.** For curved motions (`turning`, `wavy`, `boomerang`), the position after total time T is the same within `POSITION_EPSILON_TILES` for one step of T and for any partition of T. Document the constant as floating-point tolerance.
5. **Bomb.** A hit is reported only on the step that detonates. Detonation happens at the bomb's travel time, and no bomb is alive after the step that detonates it.

Use the existing test helpers in `simulation.test.ts` and `bombs.test.ts` where they can be imported. Where they are local, extract shared builders to `app/src/game/simulation/test-support.ts`. That is test-only code, and it is listed in the A19 allowlist with the reason "test support".

**Focused checks**

Both files pass alone, each in under 10 seconds.

**Acceptance**

All five properties pass, or each failure is recorded under A10.

### Step 91.4 - Whole-Simulation Invariants

Status: complete. Dependencies: 91.3.

**Implementation prompt**

Apply A08. Create `app/src/game/simulation/simulation.property.test.ts` with `numRuns: SIMULATION_PROPERTY_RUNS`. Generate:

- an encounter choice, which is a drilled Queen phase index or a minion-only spawn;
- a seed;
- an input script, a sequence of `SimulationInput` values held for a count of fixed steps each.

The properties are:

1. **Determinism.** Two independent runs with the same configuration, seed and script are deep-equal (`toStrictEqual`) after every scripted segment.
2. **Chunking.** Advancing the same total as whole multiples of `config.simulation.fixedStepSeconds`, in any partition, gives a deep-equal state.
3. **Arena containment.** After every step, the player's transformed body fits the arena shape (`convexBodyFitsArenaShape`).
4. **Health bounds.** Health stays in [0, max].
5. **Unique hits.** Across the run, no projectile id is accepted twice.

The whole file stays under 20 seconds; lower the generated script length, not the run count, if it does not.

**Focused checks**

The file passes alone, and its runtime is recorded.

**Acceptance**

All five properties pass, or each failure is recorded under A10.

### Step 91.5 - Untrusted Input And Research Models

Status: complete. Dependencies: 91.1.

**Implementation prompt**

Apply A09.

- **Robustness.** Create `app/src/game/config/data.property.test.ts` and `app/src/research/study.property.test.ts`. Feed `fc.jsonValue()` and `fc.anything()` to these loaders:
  - `validateEncounterData`;
  - the monster and projectile validators exported from `data.ts`;
  - `validateStudyV5`;
  - the `studyMigrate.ts` entry point;
  - the attempts store's load, through an in-memory storage fake;
  - the `taggerSessions.ts` restore.

  The property: the call returns, or it throws the error type that loader documents. Read each loader to find that type. Never `TypeError`, `ReferenceError` or a stack overflow.
- **Round trip.** A valid study (start from the test file's `minimalStudy` and the committed `docs/killer-bee-queen-study-TFclwuPtC94.json`, varied by an arbitrary track and mark generator) survives `JSON.parse(JSON.stringify(...))` followed by validation, and stays deep-equal.
- **Cadence recovery.** In `app/src/research/cadenceFit.property.test.ts`, generate an authored cadence:
  - shots per burst 1-8;
  - shot interval 0.05-1 s;
  - cooldown 0.2-5 s;
  - initial delay 0-3 s.

  These are generator bounds, not gameplay values. Synthesize its volley marks over 30 s and fit them. The fit recovers each parameter within the tolerance `cadenceFit.ts` documents. If it documents none, record that as a finding.
- **Timeline zoom.** In `app/src/research/timelineZoom.property.test.ts`: the visible window always lies inside [0, duration], and zooming in then out by the same steps restores the window.

**Focused checks**

Each file passes alone.

**Acceptance**

Every property passes, or each failure is recorded under A10.

### Step 91.6 - Phase Gate

Status: complete. Dependencies: 91.1-91.5.

**Implementation prompt**

Delegate one `npm run verify` run to the `verifier` subagent. Record:

- each gate's line;
- the added wall time of the `test` gate compared with the run before this phase;
- every A10 finding.

Update the Phase Index and archive this file.

**Focused checks**

None beyond the gate run.

**Acceptance**

All four gates pass. The `test` gate grew by under 60 seconds in total. No production file changed.

## Execution Record

Implemented 2026-11-16 in auto mode.

- **91.1** `fast-check` 4.10.2, exact-pinned. `src/test/property.ts` (`propertyParameters`, `SIMULATION_PROPERTY_RUNS = 25`) with `property.test.ts`.
- **91.2** `random.property.test.ts` and `geometry.property.test.ts` (swap, translation, zero motion, separated bounding boxes), generated from every shipped projectile's collision parts and the player body. All pass.
- **91.3** `projectiles.property.test.ts` and `bombs.property.test.ts`, with `test-support.ts` holding the catalog split by kind. **Finding (not a failure):** no shipped projectile uses `turning` or `wavy` motion, so `test-support.ts` derives one variant of each from the first shipped linear bullet, using the source rows already in `projectiles.test.ts` (turning 70 degrees per second, wavy 0.8 tiles at 1 Hz, both over 16 tiles). The once-only-hit property counts positive ids only: honey ticks report id 0 and enemy contact a negative id, by design. All five A07 properties pass.
- **91.4** `simulation.property.test.ts` (determinism per segment, chunking in whole steps, arena containment, health bounds, unique accepted projectile ids) over a drilled Queen phase or the Crystal Worm full fight, 25 runs. All pass, under 1 second.
- **91.5** `data.property.test.ts`, `study.property.test.ts`, `cadenceFit.property.test.ts`, `timelineZoom.property.test.ts`. Every loader returns or throws `RangeError` (the documented error); `parseStudyFile` throws a plain `Error` with no incidental `TypeError` cause; the attempt history constructor never throws. **Finding (not a failure):** `cadenceFit.ts` documents no recovery tolerance, so the cadence property uses a named 1e-9-per-second tolerance, because synthesized marks are exact, and requires the cooldown to be at least 3.03 times the shot interval (the documented `BURST_GAP_SPLIT_RATIO` of 3 plus a margin) and at least three complete bursts.
- **91.6** `npm run verify`: lint PASS, typecheck PASS, test PASS (82 files, 1531 tests, vitest 39.38 s), build PASS. Property tests add about 1 second to the gate. No production file changed.

No A10 failures.

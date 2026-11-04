# Phase 36: The Phase-3 Retune

> Step prompts and execution records for phase 36 of [plan v9](../plan-v9.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 36.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-36.md` and replace the plan's step lines with one-sentence outcomes.

This phase applies the V8 measurement to phase 3. It changes the seven authored attacks in `phase-3-pond-barrage`, the Queen's comparison identity, the tuning-source vocabulary and the coupled tests and records. It changes nothing else in gameplay.

Preconditions: V8 phase 35 is complete and V8 is archived; `docs/killer-bee-queen-observations.json` and `.md` exist. Do not start if the export is missing or fails `validateObservationExport`.

### Step 36.1 - Add The `video-observation` Tuning Source

Status: complete. Dependencies: V8 phase 35.

**Implementation prompt**

The authored `tuningSource` union has three values. Add a fourth, `video-observation`, meaning "fitted from the tagged recording, see `docs/killer-bee-queen-observations.md`". The validator must still reject an unknown source.

Write the failing test first, in `app/src/game/config/data.test.ts`:

```ts
test("validateAttack accepts the video-observation tuning source", () => {
  const attack = validateAttack(
    { ...VALID_ATTACK, tuningSource: "video-observation" },
    "attacks[0]",
    CATALOG_IDS,
    new Set(),
  );
  expect(attack.tuningSource).toBe("video-observation");
});
```

Run `npx vitest run src/game/config/data.test.ts` and confirm it fails with the validator's unapproved-source `RangeError`. The existing `"an unapproved tuningSource"` case with `"guessed"` stays and must still reject.

Then add `"video-observation"` to `validTuningSources` in `app/src/game/config/data.ts`. The `AuthoredAttack` type derives from the array, so no second edit is needed. Re-run the focused test.

Do not rename or reorder the existing three values; committed authored data depends on them.

**Focused checks:** `npx vitest run src/game/config/data.test.ts` passes, including the unknown-source rejection.

**Acceptance:** the new value is accepted and preserved by `validateAttack`, `"guessed"` is still rejected, and no other tuning source changed.

### Step 36.2 - Retune The Seven Attacks

Status: complete. Dependencies: 36.1.

**Implementation prompt**

Change the two phase-3 tests first, then the data.

In `app/src/game/config/config.test.ts`, extend the counter-rotation test at "the Killer Bee Queen's phase 3 fires two counter-rotating blue spirals" so it pins the whole overlap model rather than only the opposite signs. Keep the existing `phase3`, `blueRings` and `rates` declarations and replace the loose assertions with:

```ts
expect(rates).toEqual([37.5, -37.5]);
for (const ring of blueRings) {
  if (ring.pattern.kind !== "ring") throw new Error("expected ring");
  expect(ring.pattern.arms).toBe(3);
  expect(ring.cadence.cooldownAfterLastShotSeconds).toBe(0.4);
  expect(ring.cadence.shotsPerBurst).toBe(1);
  expect(ring.cadence.initialDelaySeconds).toBe(0);
}
if (blueRings[0].pattern.kind !== "ring" || blueRings[1].pattern.kind !== "ring")
  throw new Error("expected rings");
expect(blueRings[0].pattern.initialPhaseRadians).toBe(0);
expect(blueRings[1].pattern.initialPhaseRadians).toBeCloseTo(Math.PI / 3, 10);
const rate = Math.abs(blueRings[0].pattern.clockwiseDegreesPerSecond);
expect(120 / (2 * rate)).toBeCloseTo(1.6, 10);
expect((120 - 60) / (2 * rate)).toBeCloseTo(0.8, 10);
```

In the same file, in "the Killer Bee Queen's phase 3 reproduces the source's six-attack barrage", replace the old cadence relationships and counts with exact measured values, and add the alignment and provenance guards. Keep each projectile's existing `if (attack.pattern.kind !== "ring") throw new Error("expected ring");` narrowing:

```ts
expect(redRing.pattern.arms).toBe(2);
expect(redRing.pattern.clockwiseDegreesPerSecond).toBe(40);
expect(redRing.cadence.cooldownAfterLastShotSeconds).toBe(0.4);

expect(yellowRing.pattern.arms).toBe(8);
expect(yellowRing.cadence.cooldownAfterLastShotSeconds).toBe(2.5);

expect(beeRing.pattern.arms).toBe(4);
expect(beeRing.cadence.cooldownAfterLastShotSeconds).toBe(3.04);

expect(bombRing.pattern.arms).toBe(4);
expect(bombRing.cadence.cooldownAfterLastShotSeconds).toBe(3.23);

expect(glaiveRing.pattern.arms).toBe(60);
expect(glaiveRing.cadence.cooldownAfterLastShotSeconds).toBe(6.02);
expect(glaiveRing.cadence.initialDelaySeconds).toBe(0);
expect(glaiveRing.tuningSource).toBe("video-observation");

expect(phase3.attacks).toHaveLength(7);
for (const attack of phase3.attacks)
  expect(attack.cadence.initialDelaySeconds).toBe(0);
```

The yellow assertion needs a ring narrowing added before it, matching the other three. Keep the existing assertions for movement, minion despawn, Armor Break and the attack ids; remove only assertions whose values this phase changes.

Run `npx vitest run src/game/config/config.test.ts` and confirm the failures name the old values.

Then edit `app/src/game/data/enemies.json`:

- Set `tuningSource: "video-observation"` on all seven phase-3 attacks.
- Apply the target table from plan v9's Target Data Shapes: arms, rotation, initial phase and `cooldownAfterLastShotSeconds` exactly as listed; keep `shotsPerBurst: 1`, `shotIntervalSeconds: 0.1`, `emitterRadiusTiles: 0` and `initialDelaySeconds: 0`.
- Replace the phase's `comment` with the measured account. It must keep these facts: the values come from `docs/killer-bee-queen-observations.json` and its write-up `docs/killer-bee-queen-observations.md`; two counter-rotating 3-arm blue spirals at 0.40 s with a 60° offset interleave to six balls and coincide to three every fourth volley (1.6 s beat); the 2-arm red spiral is clockwise at 0.40 s; yellow is 8 arms every 2.50 s; bee is a 4-way burst every 3.04 s; white bombs are 4 every 3.23 s and the wiki's cardinal/intermediate (8) count is contradicted by the footage, which is the authority here; the 60-glaive Armor-Break wave is every 6.02 s and supersedes the wiki's 7 s; red's rotation rate, the initial delays and the telegraph/movement remain trainer-authored; and the 60-arm wave may be effectively unavoidable in the 19.2-tile arena, to be recorded from playtest rather than claimed.

Re-run the focused test.

**Focused checks:** the two named tests pass; `npx vitest run src/game/config/config.test.ts` passes in full; the derived shard bound test for the Queen still passes without any literal change.

**Acceptance:** all seven phase-3 attacks carry the target values and `video-observation`; the phase-3 tests assert the values, the 60° offset and the 1.6 s beat; the phase comment records the measured account, the white-bomb conflict and the glaive supersession; no bound or unrelated value changed.

### Step 36.3 - Advance The Rules Version To V8

Status: complete. Dependencies: 36.2.

**Implementation prompt**

The retune is comparison-breaking, so the Queen's identity advances. Change the tests first:

- `config.test.ts` around line 843: `expect(queenConfig.rulesVersion).toBe("killer-bee-queen-nest-paladin-v8")`.
- The test "an older Killer Bee Queen attempt record is retained but excluded from the v7 best" becomes the v8 test: rename it, assert v8, and make the older record `killer-bee-queen-nest-paladin-v7` instead of v5. Keep the two retained-best assertions, the second using the v7 literal.
- `app/tests/app.spec.ts` around line 2398: the drill literal becomes `"killer-bee-queen-nest-paladin-v8-drill-p2-4-once"`.

Run `npx vitest run src/game/config/config.test.ts` and confirm it fails on the version.

Then change `rulesVersion` in `app/src/game/data/encounter.json` for the `killer-bee-queen` encounter to `killer-bee-queen-nest-paladin-v8`. Do not change the Crystal Worm's value.

Re-run the focused Vitest file, then the one browser test:

`npm run test:e2e -- --grep "the Home phase panel starts a two-phase one-shot drill"`

Do not run the full Playwright suite.

**Focused checks:** `npx vitest run src/game/config/config.test.ts` passes; the named Playwright test passes and reports the v8 drill suffix.

**Acceptance:** the Queen config reports v8; a v7 attempt is retained but excluded from the v8 best; the drill suffix and every v7 literal are updated; the Crystal Worm identity is unchanged.

### Step 36.4 - Split The 24.2 Guard And Pin Phase-3 Provenance

Status: complete. Dependencies: 36.3.

**Implementation prompt**

The test "the 24.2 tuning pass changed no wiki-prose or approved-v3 value" currently asserts the glaive's `wiki-prose` source and 7 s cooldown. Those values are now legitimately different, but the 24.2 pass really did leave them alone at the time. Preserve that record:

- Remove the three glaive assertions from the 24.2 test (the `tuningSource`, cooldown and initial-delay block). Keep its phase-7 `white-bomb-advance` 15° assertion and the sourced projectile spot checks.
- Add a comment above the remaining test stating that the glaive's phase-3 guard moved to the V9 test below because V9 retuned it, and that the 24.2 record is historical.
- Add a new test immediately after it:

```ts
test("every phase-3 attack cites the tagged video observation", () => {
  const queenConfig = encounterConfigOf("killer-bee-queen");
  const phase3 = primaryArchetype(queenConfig).phases[2];
  expect(phase3.attacks).toHaveLength(7);
  expect(phase3.attacks.map((attack) => attack.tuningSource)).toEqual([
    "video-observation",
    "video-observation",
    "video-observation",
    "video-observation",
    "video-observation",
    "video-observation",
    "video-observation",
  ]);
});
```

Run `npx vitest run src/game/config/config.test.ts`.

**Focused checks:** the focused file passes; `Select-String -Path app/src/game/config/config.test.ts -Pattern "wiki-prose"` shows the phase-7 assertion remains and no phase-3 glaive assertion remains.

**Acceptance:** the 24.2 test keeps its historical claims and sourced-value guards; phase 3's provenance is guarded by its own V9 test; no assertion was merely deleted.

### Step 36.5 - Verify And Measure Phase 3

Status: complete. Dependencies: 36.4.

**Implementation prompt**

Run the full gate once from `app/`:

`npm run verify`

Expect lint, typecheck, test and build to pass, with full logs under `app/test-results/verification/`. If a test other than the ones plan v9 names fails, stop and report; do not edit an expectation to make it pass. Confirm the Queen's full-fight length test still reports about 373.43 s: cadence does not govern the HP progression. If it moved, stop and report.

Then run the one real-browser density check:

`npm run test:e2e -- --grep "Queen phase-3 drilled"`

Read its metrics JSON under `app/test-results/` and record peak live shards, peak collision parts, frame count, median/p95/maximum frame gap and the derived bounds. Compare against the pre-retune phase-3 drill figure (peak 50-52 shards); report the change as a measurement, not a pass/fail.

Ask the user to playtest phase 3 in the development build and report three things: how dense the barrage feels in the 19.2-tile arena, whether the 60-glaive wave is dodgeable, and whether the 3-ball blue overlap is visible. Record their answers verbatim. Do not claim the wave is unavoidable or that the phase is fairly tuned without that report. If the user judges the phase unfair, stop and return to the design; do not invent a deviation. If the user is not available during execution, complete the measurable checks, state in the report that the playtest is outstanding, and claim no playtest finding.

**Focused checks:** the verify summary line per gate; the drill test's own bound assertions (they are derived, so they should pass); the metrics JSON exists and is quoted.

**Acceptance:** `npm run verify` passed; the drill passed and its metrics are reported against the old figure; the user's playtest observations are recorded; if anything failed or reads badly, it is reported rather than hidden.

### Step 36.6 - Record The Change

Status: complete. Dependencies: 36.5.

**Implementation prompt**

Update the records; this step changes documentation only.

- `docs/mechanics.md`: replace the stale statement that the pilot makes no cadence recommendation and retuning remains D13. Record that V9 retuned phase 3 from the tagged evidence, list the seven attacks' measured periods and counts, the ±37.5°/s 0°/60° blue model and its 1.6 s beat, the new `video-observation` source, the v7 → v8 rules version, the white-bomb 4-vs-8 conflict, and the 60-arm glaive note. State that D13 is resolved for phase 3 and other phases remain under D22.
- `docs/deferred-work.md`: amend D13 to record the phase-3 retune with its evidence and mark the remaining scope deferred under D22. Do not delete the entry; do not rewrite its history.
- `README.md`: update the phase-3 drill measurements and frame-timing figures with the numbers from 36.5, and replace the "Retuning is deliberately deferred as D13" sentence with a link to this plan and the mechanics record. Leave unrelated sections alone.
- `docs/plan-v8.md`: append a dated correction stating that the tagged measurement puts the Red Glaive wave at 6.02 s and the user confirmed the footage, superseding the 7.0 s figure. Leave the original figure, the phase-33 archive and the T36 waiver text in place; do not edit them. Plan-v8.md stays in `docs/` after V8 is archived, so the note belongs there rather than in an archived phase file.
- Record any user playtest decision from 36.5 that changes a value. If a value changes, stop: that is a new approved decision, not a docs edit.

Confirm no file under `app/` changed in this step with `git status --short app/`.

**Focused checks:** grep each updated file for the new cadence values and the v8 version; confirm the 7.0 s original still appears alongside its correction in the V8 record; confirm the observation files are untouched.

**Acceptance:** mechanics, deferred register, README, V8 record and plan v9 agree with the shipped data and with each other; the evidence files are unmodified; the correction is additive; no code or authored data changed in this step.

### Step 36.7 - Archive V9

Status: complete. Dependencies: 36.6.

**Implementation prompt**

Archive per [the implementation plan](../../implementation-plan.md)'s Phase Lifecycle And Archiving section:

- Move `docs/plan/phase-36.md` to `docs/plan-archive/phase-36.md`.
- In `docs/plan-v9.md`, mark phase 36 complete, replace the phase section with a one-sentence outcome and link the archived steps file.
- In `implementation-plan.md`'s Current Plan table, confirm V8 is archived and mark V9 archived with its final range and decision prefix. V9's row was added when the plan was drafted.
- Leave both plan files in `docs/` as the archive convention requires.

Stop after this step and report; do not begin another phase, commit, push or deploy.

**Focused checks:** the archived file exists at the new path and the old path is gone; the plan and table link to it; `npm run verify` is not re-run because no code changed.

**Acceptance:** V9's phase 36 is recorded complete with its evidence and outcomes; the lifecycle table is accurate; no work beyond phase 36 was started.

### Execution record

Completed 2026-11-03 to 2026-11-04. No commit, push or deployment was performed.

- **36.1.** `validTuningSources` gained `"video-observation"` and its rejection message lists it. The new `validateAttack` test was watched failing with the old message, then passing; `data.test.ts` reports 158 passed.
- **36.2.** The blue test now pins ±37.5°/s, 0°/60°, arms 3, 0.40 s and the 120/(2×37.5) = 1.6 s beat (first coincidence at 0.8 s). The phase-3 test now pins red at 0.40 s, yellow at 8 arms / 2.50 s, bee at 4 / 3.04 s, white bomb at 4 / 3.23 s, the glaive at 60 / 6.02 s and `video-observation`, all seven delays at 0, and seven attacks. Both tests were watched failing against the old values. `enemies.json` then took the target table and a measured phase comment.
- **36.4, executed before 36.3 by ruling.** After 36.2 the only red test was the 24.2 guard's glaive block, whose fix is 36.4; running 36.3 first would have left the file red for an unrelated reason. The guard's history comment and its phase-7/projectile assertions stay; the glaive block moved to a new test, "every phase-3 attack cites the tagged video observation". `config.test.ts` then reported 147 passed.
- **36.3.** The v8 literals were written first in `config.test.ts` (the default-selection assertion, and the older-record test now using a v7 record against the v8 config) and in the Home drill's `app.spec.ts` literal. They were watched failing, then `encounter.json` bumped to `killer-bee-queen-nest-paladin-v8`. The focused Vitest file passed, and the named Home drill Playwright case passed (1 passed, 5.6 s).
- **36.5.** `npm run verify` passed lint, typecheck, test (879) and build; the headless full fight still clears at 373.43 s with peak 119 shards and 1,906 parts, inside the derived bound, so no expectation was edited.
- **36.5 finding and fix.** The first drill run reported 26 peak shards, and a probe showed the run was in `phase-1-honey-pond`: the performance drill's URL-based phase selection was not applied after the encounter switch. The test was corrected to select the phase through the Home panel and to assert `enemyPhaseIds[0]`, then both drills were rerun. Real phase 3 now peaks at **112 live shards / 1,256 collision parts**, median 16 ms, p95 22 ms, maximum 76 ms; phase 6 peaks at 56 / 1,416, median 16 ms, p95 23 ms, maximum 70 ms. The V6 phase-3 figure of 50-52 shards / 416 parts is consistent with the pre-retune phase-3 data (its old derived bound was 60), so it is treated as the comparable baseline: the retune is about 2.2x that figure in live shards and raises the measured maximum frame gap from 44-51 ms to 76 ms. The V9 pre-fix 26-shard run was phase 1 and is not the baseline. The README records the corrected figures without rewriting the V6 paragraph, and adds the V9 comparison beside it.
- **Playtest.** Not supplied. The phase is not claimed as fairly tuned or the glaive wave as unavoidable; both await the user's playtest.
- **36.6.** The mechanics contract gained "The Phase-3 Retune (Plan V9)" and the stale "retuning remains D13" sentence was replaced; D13 records phase 3 resolved and the remaining seven phases blocked on D22; the README records the corrected drill figures and the retune; `plan-v8.md` carries the dated 6.02 s correction; the design doc carries a dated frame-rate correction (the `frameRate: 60` field is the tagger's step setting, not the video's presented rate).
- **Final checks.** `npm run verify` was rerun after the drill-test change and passed all four gates. The committed export still matches the source file's SHA-256. No deferred item other than D13's phase-3 scope was promoted.

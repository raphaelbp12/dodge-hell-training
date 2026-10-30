# Phase 28: Performance, Difficulty And Handoff

> This phase belongs to [plan V6](../implementation-plan-v6.md). Read [the implementation plan](../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 28 proves the compound hitboxes and pixel rendering do not break the performance or determinism contracts, records the difficulty shift, and closes the plan's documentation.

### Step 28.1 - Re-Derive And Measure The Performance Bound

Status: complete. Dependencies: 27.4.

**Implementation prompt.** Re-derive the performance limits for the new bodies rather than reusing the old assumption:

- Add a derived **live collision-part bound**: the existing live-shard bound multiplied by the largest `collisionPartsTiles` length across the catalog. Assert it in the headless Queen drill alongside the existing shard bound.
- Keep the existing live-shard count bound unless a derivation shows it must change. Do not widen a bound to make a run pass; report the derivation if the old bound is wrong.
- Run the existing 60-second Queen drill in the browser and record peak shards, peak live parts, frame count and frame timing. Compare the frame timing with the V5 baseline captured in step 26.3. A material regression is a defect to fix in this step, not a reason to relax the bound.
- Update `app/tests/app.spec.ts` and any headless assertion that encodes the bound, plus the plan's execution record with the measured numbers and the derivation.

**Focused checks.** Run the targeted Queen drill Playwright case, the headless full-fight clear, and the existing 30/60/120 Hz determinism test. Confirm the peak live-part count never exceeds the derived bound.

**Acceptance.** The live-part bound is derived and asserted, the browser measurement is recorded, and no bound was widened without a derivation.

### Step 28.2 - Measure And Record The Difficulty Shift

Status: complete. Dependencies: 28.1.

**Implementation prompt.** Repeat the exact fixed-seed scenario captured in step 26.3 under the new hitboxes and unchanged V5 cadences. Record accepted hits, survival time, peak live shards and the browser drill result next to the baseline. State the direction and magnitude of the change plainly.

Do not retune a cadence, damage value, speed or condition as part of this step. The measured shift is the evidence for D13; if it is large enough to need correction, say so and leave the correction to that deferred item.

**Focused checks.** The repeated fixed-seed run must be identical to itself, and the comparison must use the same scenario and input sequence as the baseline.

**Acceptance.** The baseline and post-change results are recorded side by side, the shift is stated without a fidelity claim, and no gameplay value was retuned.

### Step 28.3 - Verify And Hand Off

Status: complete. Dependencies: 28.2.

**Implementation prompt.** Finish the plan's documentation and run the full gate:

- Update [the mechanics contract](../mechanics.md) with the 12.8 native-pixels-per-tile conversion, the opaque-pixel compound hitbox interpretation, the `killer-bee-queen-nest-paladin-v7` identity, the appearance catalog and the fact that the wiki publishes no projectile hitbox. Mark the conversion as a trainer interpretation, not verified client data.
- Update [the appearance source record](../projectile-appearance-source.md) if any grid or palette changed during implementation, and keep its URLs and retrieval date current.
- Update the README where it states the Queen's rules identity, projectile visuals or the rules comparison. Do not add a new tuning UI or a sprite gallery.
- Confirm [the deferred register](../deferred-work.md) still carries D13, D14 and D15 with accurate wording. Do not mark any of them complete.
- Update the phase index and phase files according to [the implementation plan](../implementation-plan.md) as phases 25-28 complete, and record the execution evidence in each phase file.
- Run `npm run verify` from `app/` and the targeted Playwright cases for shard rendering, the bomb detonation and the Queen drill. Do not run the full Playwright suite unless the user asks for an acceptance run.
- Report the checks actually run, the difficulty shift, any approved deviations and any blocker. Do not commit, push or deploy.

**Focused checks.** `npm run verify` must print a pass for lint, typecheck, test and build. The targeted Playwright cases must pass. The documentation must contain no claim that the hitbox is wiki- or client-verified.

**Acceptance.** All gates pass, the documentation and rules identity are consistent, the difficulty shift is recorded, and no deferred item was silently implemented or marked done.

## Execution Record - 2026-10-29

- **28.1:** added `liveCollisionPartBoundForEncounter(config)` (live-shard bound times the largest compound body) and asserted it at `1571 * 58 = 91,118`. The full fight measured peak **1,906** live collision parts, well inside the bound. The god-mode browser Queen drills measured phase 3 at peak **50-52** shards / **416** parts and phase 6 at peak **56** shards / **1,416** parts, with median 16 ms / p95 21-24 ms and a maximum gap that varied 44-51 ms across runs over 60 seconds. The shard count bound remains 1,571 and was not widened.
- **28.2:** recorded the hitbox-only difficulty comparison from step 26.3: phase 1 unchanged, phase 3 fewer hits but a shorter survival time, phase 6 unchanged. No cadence, damage, speed or condition was retuned. D13 remains the follow-up.
- **28.3:** ran `npm run verify` (lint, typecheck, test, build all pass). Targeted Chromium cases pass: Crystal Worm shard render, direct Queen `?phase=` link, Queen per-family pixel shards, Queen bomb detonation, Queen phase-3 drill and Queen phase-6 drill. The full Playwright suite was not run. Updated the README, the mechanics contract, the appearance source record and the deferred register. No commit, push or deploy was made.
- **Documentation consistency:** the wiki has no projectile-hitbox column; the 12.8 native-pixels-per-tile conversion is recorded as a trainer interpretation. The Queen identity is `killer-bee-queen-nest-paladin-v7`. D13 (retuning), D14 (Crystal Worm) and D15 (licensing) remain open.
- **Independent review:** the Adversarial QA Auditor and Strict Code Reviewer both returned **HAPPY** after the final fixes. The QA pass compared all 16 non-bomb grids cell-by-cell with the reference PNGs and verified the compound hitboxes, rendering, bomb documentation and drill behavior. The code review pass verified the runtime, compound-collision tests, exact 44-family mapping, loader rejections, live-part bound and the god-mode drill path.

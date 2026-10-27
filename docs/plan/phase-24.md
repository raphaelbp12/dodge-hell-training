# Phase 24: Bounds, Tuning, Regression And Handoff

> Step prompts and execution records for phase 24 of [the implementation plan](../../implementation-plan.md), whose general sections stay the authority for how to work. Read only this introduction and the requested step: grep `^### Step 24.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-24.md` and replace the plan's step lines with one-sentence outcomes.

### Step 24.1 - Re-Derive And Re-Measure The Performance Bounds

Status: pending. Dependencies: 23.10.

**Implementation prompt**

The v4 bound was derived for one archetype with one attack: `liveShardBoundPerEnemy(archetype)` computed `emitterCount * shotsPerEmitter * ceil(lifetimeSeconds / burstGroupSeconds)`, giving 66 per enemy and a measured peak of 264 with four enemies. The Queen has up to eight concurrent attacks, several minions each with their own attacks, and projectile lifetimes up to 4.252 seconds. That formula no longer describes the system.

Re-derive the bound from configuration, never from a literal:

- Per attack: `shotsPerVolley * shotsPerBurst * ceil(projectileLifetimeSeconds / burstGroupSeconds)`, where `shotsPerVolley` comes from the attack's pattern - `arms` for a `ring`, `shots` for a `spread` or `scatter` - and `burstGroupSeconds` is the existing `(shotsPerBurst - 1) * shotIntervalSeconds + cooldownAfterLastShotSeconds`.
- Per phase: the sum over the phase's attacks plus the maximum over its sub-phases, since only one sub-phase is ever active.
- Per archetype: the maximum over its phases.
- Per encounter: the archetype bound times `maxConcurrent`, plus each possible minion's bound times `maxConcurrentMinions`.

Replace `liveShardBoundPerEnemy` with this derivation, keeping it a function rather than a stored field so it cannot go stale. Assert the Crystal Worm still derives **66**, which proves the generalisation is a superset rather than a replacement.

Then measure, in the browser, at the pinned toolchain, and report real numbers rather than estimates:

- Peak live shards and peak live enemies over a full Queen fight from phase 1 to cleared, and separately over a 60-second drill of phase 3 and a drill of phase 6, which are the two densest phases.
- Sustained frame timing over each of those runs, compared against the v4 figures recorded in step 17.4's execution record in [the v4 archive](../implementation-plan-v4.md).
- Whether `maxStepsPerUpdate` of 8 is still sufficient, or whether the catch-up path now discards time during the dense phases. If it discards, report it as a finding with the measurement; do not raise the limit as a fix without the user's approval, because a higher limit changes the simulation's timing guarantees.

If a measured peak exceeds the derived bound, the derivation is wrong - fix the derivation. **Never widen or delete a bound to make a run pass.** If the frame timing is materially worse than v4, report it with numbers and a diagnosis; a renderer optimisation is a separate, approved step, not something to bundle here.

**Focused checks:** focused failing test on the per-attack derivation first. Then: the Crystal Worm still derives 66; a two-attack archetype's bound is the sum of its attacks; a phase with sub-phases uses the maximum rather than the sum across them; the encounter bound includes minions; and a measured run's peak never exceeds the derived bound, asserted as a test rather than only reported. All four routine gates, plus the full `npm run test:e2e` since this step is explicitly a measurement step.

**Acceptance:** the shard bound is derived from configuration for multi-attack, multi-phase and minion-bearing archetypes, the Crystal Worm still derives 66, measured peaks and frame timings for the full fight and both dense drills are reported against the v4 baseline, any catch-up discarding is reported rather than papered over, and all gates pass.

### Step 24.2 - Tune The Fight For Trainability

Status: pending. Dependencies: 24.1.

**Implementation prompt**

Every cadence authored in phase 23 was deliberately generous. This is the step K04 reserved for tightening them, now that every mechanic exists and can be measured together.

This is a **tuning** step, not a feature step. Change only `trainer-authored` values: shot counts, shot intervals, cooldowns, arc widths, gap widths, bomb travel times, sub-phase durations, minion counts and the progression rate. Do **not** change a value marked `wiki-prose` or `approved-v3`, do not add an attack, a projectile, a pattern field or a motion kind, and do not change any sourced projectile stat. If a phase cannot be made trainable without one of those, that is a finding to report, not a licence.

Tune toward stated targets rather than feel, and record the measurement for each:

- Every phase must be survivable by a competent player with correct movement, and must not be survivable by standing still. Demonstrate both ends with scripted runs.
- Phase 6's machinegun gaps must leave a provably survivable opening for the full 29 seconds, which step 23.8 already asserts; tightening them must not break that assertion.
- The full fight's total length should land where K15's 375 HP per second implies, within a few seconds. If tuning the cadences changes the natural length, adjust the progression rate rather than distorting individual phases.
- No phase should be trivially survivable by standing in one place away from the Queen, which is the failure mode a static 19.2-tile arena invites given D01.

Present the before-and-after value for every number you change, in a table, with the reason. A tuning step whose record is "adjusted for difficulty" is not acceptable; each change needs a measurement or an observation behind it.

Bump the Queen's encounter `rulesVersion` if and only if tuning changes gameplay enough to invalidate comparison with attempts recorded before this step. Given that this is the first tuning pass over a brand-new encounter, it almost certainly does: use `killer-bee-queen-nest-paladin-v5` through step 23 and advance the suffix here, retaining earlier records and excluding them from the new bests exactly as G19 did for v4.

**Focused checks:** the scripted survivable and non-survivable runs per phase, each asserted; the phase 6 gap-survivability assertion unchanged; the measured full-fight length; a test that no `wiki-prose` or `approved-v3` value changed, implemented by asserting the sourced projectile stats against the source extract's table; and the retained-best exclusion for the previous rules version. All four routine gates, plus the full `npm run test:e2e`.

**Acceptance:** every phase is demonstrably survivable with correct play and lethal when stationary, only `trainer-authored` values changed, each change is justified with a measurement in a before-and-after table, the rules version is advanced with history retained and excluded, and all gates pass.

### Step 24.3 - Run The Full Acceptance Matrix

Status: pending. Dependencies: 24.2.

**Implementation prompt**

Verify the whole product, not just the new encounter. Add no features. Fix only defects this step finds, and report anything that needs a design decision rather than deciding it.

Run and record, on the pinned toolchain in `.node-version` (24.22.1) with `npm@12.2.1`:

- All four routine gates, with the actual test count and timing.
- The full `npm run test:e2e` suite in Chromium, with its case count and timing.
- **Crystal Worm regression.** Its encounter must behave exactly as the v4 release did: same cadence, same positions, same death times, the 671-volley assertion, and the 30/60/120 Hz equivalence. This is the proof that nineteen steps of engine generalisation cost the existing content nothing.
- **Determinism.** The same seed and input sequence reproduces a full Queen fight identically, including every scatter bearing, every wander target and every spawn placement, at 30, 60 and 120 Hz and under both one-step and multi-step updates.
- **Storage compatibility.** A v1, v2, v3 and v4 attempt record each still load, appear under the Crystal Worm encounter, and are excluded from the Queen's bests. A Queen record and a drill record round-trip correctly. Corrupt and absent records still degrade safely through the existing adapter.
- **Session safety.** Pause, resume, retry with R, the Controls dialog, zoom persistence and the countdown all behave identically in both encounters and in drill mode, with no background time catch-up while paused.
- **Both encounters end to end in a browser**, including a cleared Queen run reaching the win screen and a death run reaching the results screen.

Then collect the honest limitations in one place: every fidelity gap from phase 23's records, every unsourced interpretation, every deferred item that affects this encounter, and anything the acceptance run could not verify. Name what is unverified rather than omitting it.

**Focused checks:** the full matrix above. Report each item's actual outcome with numbers. A blocked item is reported as blocked, never as passed.

**Acceptance:** every item in the matrix has a recorded outcome with real figures, the Crystal Worm encounter is proven unchanged from v4, determinism and storage compatibility hold, both encounters complete in a browser, and the consolidated limitations list is written down.

### Step 24.4 - Update The Handoff Documentation

Status: pending. Dependencies: 24.3.

**Implementation prompt**

Documentation only. Make the repository describe what now exists, for a reader arriving with no knowledge of this plan.

- **`README.md`.** Replace the "Current V4 State" section with a "Current V5 State" section covering both encounters, the Queen's eight phases and what each teaches, drill mode with its `?phase=` and `?loop=` parameters, encounter selection, the condition model with its active and inert split, and the per-encounter comparison identities. Extend the "Authored Data" subsection to table all six JSON files - `shapes.json`, `arena.json`, `projectiles.json`, `enemies.json`, `encounter.json` and whatever 23.1 added - saying which file to edit for the arena, a projectile, an enemy's phases, and spawning. Add a "V5 Verification" subsection recording step 24.3's gate run and measurements. Preserve the existing v1-v4 history sections.
- **A new "Fidelity And Limitations" section in `README.md`**, published from step 24.3's consolidated list: what this trainer does not reproduce and why, each item linked to its deferred register id. State plainly that phases 2 and 5 are easier than the live fight because the arena does not flood, and that phases 1, 3 and 8 are harder because a real group suppresses attacks by stunning. A training tool that misrepresents its own fidelity is worse than one that admits the gap.
- **The Home changelog.** Add an entry in player-facing language: a new boss with eight phases, status effects that change how you move, single-phase practice, and the ability to choose which encounter to train. Preserve every earlier entry.
- **[The mechanics contract](../mechanics.md).** Append the implemented-V5 handoff beside the V5 contract that step 19.1 recorded, covering the final tuned values, the sourced-versus-authored split, and the two unsourced interpretations. Do not alter the v1-v4 provenance.
- **[The deferred register](../deferred-work.md).** Update it to reflect reality: items that shipped move out, items this work revealed move in, and D09's F5 entry is marked fixed by step 23.1 with the other findings left open.
- **Archive this plan.** Copy it to `docs/implementation-plan-v5.md` with an archive header in the style of the v2 and v4 archives, rewrite its relative links for the new directory depth, move any remaining `docs/plan/phase-<n>.md` files (including this one) to `docs/plan-archive/` and point the archived plan's links at them, and leave `implementation-plan.md` holding whatever work is genuinely pending. Verify every relative link in every file you touched resolves on disk.

Do not claim a deployment. Publication remains a separately authorized step.

**Focused checks:** structural only. Every relative link in every touched file resolves; the README's v1-v4 history sections and the Home changelog's earlier entries are intact, confirmed by comparing before and after; the mechanics contract retains every pre-existing heading; the archived plan's links resolve from `docs/`; and the six authored JSON files listed in the README all exist. Run all four routine gates to prove nothing was disturbed.

**Acceptance:** the README describes the V5 state and publishes the fidelity limitations, the changelog gains a player-facing entry with history intact, the mechanics contract and deferred register are current, this plan is archived with working links, and all four gates pass.

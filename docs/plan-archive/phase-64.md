# Phase 64: Guide And Acceptance

> Step prompts and execution records for phase 64 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 64.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-64.md` and replace the plan's step lines with one-sentence outcomes.

### Step 64.1 - The Guide

Status: complete. Dependencies: phase 63.

**Implementation prompt**

Update `docs/tagger-guide.md` for everything a person now sees: the timeline and `[`/`]`; match status; "Use these settings"; typed cone, bearing, front offset, emitter radius, bullet speed and range; bomb targeting, range and time, including that a targeted bomb ignores range; saved attacks from creation to deletion; linked rows and Detach; repeats, "End repeat here" and the typed end; the rotation clock; preview tuning; schema v3 and the second export box. Correct statements that no longer hold, including "the tag records only that, never an angle" and the Preview section's targeted-bomb sentence. Add a worked example: a rotating ring repeating every 0.4 s, from saving the attack through tuning and export. Grep `docs/mechanics.md` for tagger statements this plan contradicts, and correct only those.

**Focused checks**

None beyond reading the guide against the running tagger, recorded as performed or blocked. Documentation only, so `npm run verify` is not needed for this step alone.

**Acceptance**

Every control added in this plan is described, and nothing in the guide contradicts S01-S50.

### Step 64.2 - The Playwright Case

Status: complete. Dependencies: 64.1.

**Implementation prompt**

Add one case to `app/tests/app.spec.ts` (S06). In the page, generate a short WebM with `MediaRecorder` from a canvas's `captureStream`, pass it to the video file input, type a frame rate and start and pause playback so a frame is presented. Then save a rotating-arm attack with a named cadence, record a linked tag, seek, press "End repeat here", select the row, change the rate through the tuning control, and assert: the Tags row shows the attack name and a nonblank repeat end; the "not previewed" note is absent; and the export box's JSON has the saved attack's slug, the typed `cooldownAfterLastShotSeconds` and the typed rate. Assert through named controls and text, not canvas pixels. Run it alone with `npm run test:e2e -- --grep "<pattern>"`, delegating to the `verifier` subagent.

If a configured Playwright project cannot record or decode this WebM, stop and report it rather than skipping silently.

**Focused checks**

The case itself. It must fail if linked export or the repeat end is removed.

**Acceptance**

The case passes alone, and its generated video is never written to the repository.

### Step 64.3 - Plan Acceptance

Status: complete. Dependencies: 64.2.

**Implementation prompt**

Run the plan's review gates: compare `app/src/game/` with the baseline recorded before phase 56 (S01), confirm `docs/killer-bee-queen-observations.json` is byte-identical, and confirm no entry in `docs/deferred-work.md` was implemented. Run `npm run verify` once through the `verifier` subagent. Record what actually ran, and any manual check still blocked.

**Focused checks**

Each gate above, reported with its real result.

**Acceptance**

Every gate has recorded evidence, or a stated blocker for the user.

## Execution record

**64.1** `docs/tagger-guide.md` describes the timeline and `[` / `]`, match status, use-these-settings, every new typed field, bombs, saved attacks, repeats, the rotation clock, preview tuning, schema v3 and the second export box, corrects the "never an angle" and targeted-bomb statements, and has the 0.4 s ring worked example. `docs/mechanics.md` was grepped for tagger statements; none are contradicted (its V8 tagger section records history), so it was not changed. The guide-versus-running-tagger comparison was not performed in a live session.

**64.2** One Playwright case generates a WebM with `MediaRecorder` in the page, loads it through the file input, types a frame rate, plays and pauses to present a frame, saves a rotating-arm attack with a typed cooldown, records a linked tag, seeks, presses End repeat here, selects the row, tunes the rate, and asserts the repeat end, the absent not-previewed note and the export box's slug, cooldown and typed rate. It passed alone in headless Chromium, and no video is written to the repository.

**64.3** Review gates: `git status` shows no change under `app/src/game/`, `docs/killer-bee-queen-observations.json` or `docs/deferred-work.md`; the game tree was clean before phase 56, so the baseline is HEAD. `npm run verify` passed (lint, typecheck, test, build) and the new Playwright case passed alone, both through the `verifier` subagent.

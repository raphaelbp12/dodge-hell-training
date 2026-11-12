# Phase 82: Test Clip And Guide

> Step prompts and execution records for phase 82 of [plan V19](../plan-v19.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 82.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-82.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 82.1 - The Test Clip And One Case

Status: complete. Dependencies: phase 81.

**Implementation prompt**

Move the in-page WebM generator from `app/tests/app.spec.ts:2811` into one shared Playwright helper under `app/tests/`. The helper builds the clip, loads it into the tagger's video input, and enters the presented frame rate. Make the existing case at that line use the helper, with no change to what it checks (J15).

Add one new case using the helper:
1. Open `./?tagger=1` and load the clip.
2. Press Load from game on the Queen and choose phase 2 in the draft panel.
3. Check that only phase 2's blocks are listed.
4. Press Starts here on one of them, and see its anchor time shown.

No video file is committed and the app gains no test-clip control (J14).

**Focused checks**

Run only the changed and new cases: `npm run test:e2e -- --grep "<pattern>"`, through the `verifier` subagent.

**Acceptance**

Both cases pass locally, and the generator exists once.

**Execution record - 2026-11-12.** The generator moved into `app/tests/tagger-clip.ts` (`loadTestClip`), used by the existing linked-repeat case and the new case "the draft panel shows one phase and Starts here anchors a block". No video file is committed and the app gained no control. Playwright results are in the report of this run.


### Step 82.2 - The Guide

Status: complete. Dependencies: 82.1.

**Implementation prompt**

Update `docs/tagger-guide.md` (J17) to say that every monster's study has tags, saved attacks and the Draft/Tags switch. Also update the "Correcting a monster from video" section for these behaviours:
- the one Phase select shared with the Tag panel
- the panel showing only the selected phase
- Load from game replacing only the selected phase once a draft exists
- the preview drawing only the selected phase, while other phases' anchors still end its blocks
- the export replacing only the selected phase in the whole file
- the `?` help marks

Correct the worked example's first step, which now says to press Starts here "when its telegraph ends". It must say to press Starts here on the frame the block is entered, before its telegraph (J09, L20). Remove the sentences that say tags exist only in the primary monster's study.

**Focused checks**

Grep the guide for "primary monster's study" and "telegraph ends", and confirm neither matches. Every control the guide names exists under that name.

**Acceptance**

The guide matches the running tagger. This step is documentation only, so `npm run verify` is not needed for it. The phase's last code step has already passed verify.

**Execution record - 2026-11-12.** `docs/tagger-guide.md` now says every monster's study has tags, saved attacks and the switch, describes the shared Phase select, the one-phase panel, phase-scoped load, preview and export, the `?` marks, and the corrected worked example (press Starts here on the frame the block is entered, before its telegraph). Neither "primary monster's study" nor "telegraph ends" matches the guide.

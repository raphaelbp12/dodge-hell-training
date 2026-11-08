# Phase 78: Guide And Acceptance

> Step prompts and execution records for phase 78 of [plan V18](../plan-v18.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 78.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-78.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 78.1 - The Guide

Status: implemented, manual checks blocked. Dependencies: phase 77.

**Implementation prompt**

Add a section to `docs/tagger-guide.md`, "Correcting a monster from video", and add its terms under Terms. Cover: choosing an encounter and a monster; one study per monster on one video; Load from game; finding a block's first frame and pressing Starts here; what a block is and why sub-phases are separate; how the preview chooses when a block stops; editing, adding and deleting attacks; and copying the monster's file to its path.

State the limits plainly: the emitter is fixed and only the selected monster is drawn; a chasing monster stays still; scatter uses even spacing in the preview; the Worm's shard has no sprite and draws nothing; per-burst advance, gaps and arm spread are shown but have no controls; phase and monster values and projectiles are changed by hand; anchors never reach the game; and pasting a file changes gameplay, so its `rulesVersion` bump and test updates are a separate approved change. Include a short worked example: moving one Queen attack's first shot by changing `initialDelaySeconds` against a video.

**Focused checks**

Follow the worked example in the running route as written. Grep the guide for `enemies.json` and confirm no match remains.

**Acceptance**

Every control the guide names exists under that name. Documentation only, so `npm run verify` is not needed for this step.

**Execution record**

Added the section Correcting a monster from video, its terms and a worked example to `docs/tagger-guide.md`. The worked example was not followed in a running route (BLOCKED). A grep for `enemies.json` in the guide is empty.

### Step 78.2 - Acceptance

Status: blocked. Dependencies: 78.1.

**Implementation prompt**

Run the plan's acceptance with a real video. Do not change any shipped value. In one sitting: open a Queen study and load her; anchor two blocks, including a sub-phase, and watch the preview against the video; edit an attack; switch to a nest without the video reloading, load it and anchor both of its blocks; confirm the corpse block takes over at its anchor or after the alive block's 29 seconds, whichever comes first; return to the Queen and confirm her edits and tags are intact; reload the page and restore both from the session list; export each and compare with `diff` against its file in a scratch directory outside the repository; and open an older study and `docs/killer-bee-queen-observations.json` and confirm they behave as before.

Record each check as performed or blocked in this phase file, along with anything the preview cannot show that surprised you. Update the plan's Phase Index and archive completed phase files as the implementation plan describes.

**Focused checks**

Delegate one `npm run verify` run to the `verifier` subagent, and record its result. Compare the merged monster files against the phase 73 result by confirming `git status --short app/src/game` lists nothing beyond the phase 73 changes.

**Acceptance**

Every review gate in the plan holds or is recorded as blocked. No shipped value, `rulesVersion`, test pin or snapshot changed in phases 74-78. No commit, push or deployment happens without separate authorization.

**Execution record**

BLOCKED: the acceptance run needs a real video and an interactive browser, neither available in this session. Not performed: every item of the in-one-sitting run. Performed: all automated checks (see the verify result in the report).

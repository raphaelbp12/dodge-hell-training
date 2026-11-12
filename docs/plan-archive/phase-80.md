# Phase 80: The Phase-Scoped Draft

> Step prompts and execution records for phase 80 of [plan V19](../plan-v19.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 80.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-80.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 80.1 - Phase-Scoped Load, Export And Preview

Status: complete. Dependencies: phase 79.

**Implementation prompt**

Add a required `phaseId` to three pure functions, with the shapes in the plan's Target Data Shapes.

- `loadMonsterDraft` in `research/monsterDraft.ts` (J07): with `previous` null, it copies the whole monster as today. With `previous` present, it keeps every other phase's attacks from `previous` and replaces only `phaseId`'s phase-level and sub-phase attacks from the file. Anchors are kept or dropped as today.
- `monsterFileText` (J04, J05): it starts from the current file and replaces only `phaseId`'s attack lists from the draft. It refuses, naming the id, only when that phase or one of its sub-phases is on one side only.
- `draftPreviewAt` in `research/draftPreview.ts` (J06): it draws only blocks whose `phaseId` matches, while `blockWindows` still receives every block of the monster, so another phase's anchor still ends a window.

No file under `app/src/game/` changes.

**Focused checks**

Failing first:
- Load with a previous draft keeps an edit in phase A when phase B is reloaded.
- Load with no draft equals today's whole load.
- For each of the 12 monsters and each of its phases, an untouched draft exports byte-identically to the file.
- An edit in phase A does not appear in phase B's export.
- A phase removed from the file refuses only that phase's export.
- The preview of phase A draws nothing from phase B's anchored blocks.
- A phase-A block with no duration stops at phase B's anchor.

**Acceptance**

The functions are pure, and existing draft tests pass with `phaseId` passed. No help or UI change yet.

**Execution record - 2026-11-12.** `loadMonsterDraft(rawFile, previous, phaseId)`, `monsterFileText(archetypeId, draft, currentRawFile, config, phaseId)` and `draftPreviewAt({... phaseId})` are phase-scoped as the plan's Target Data Shapes give. Tests: reloading phase B keeps an edit in phase A; reloading A replaces its own edit; an untouched draft exports byte-identical text for every phase of all 12 monsters; an edit in phase A is absent from phase B's export; a phase removed from the file refuses only that phase's export; the preview of one phase draws nothing from another's anchored block; another phase's anchor still ends a block with no duration. No file under `app/src/game/` changed.


### Step 80.2 - The Draft Panel Shows One Phase

Status: complete. Dependencies: 80.1.

**Implementation prompt**

In `research/DraftPanel.tsx`, add a Phase select bound to the study's one `sticky.phaseIndex`, which the Tag panel's Phase select also edits (J02). The route passes the value and its setter. Show only the selected phase's blocks, anchors and attack lists (J01), and clear the attack editor's selection when the phase changes.

Pass the selected phase's id to `loadMonsterDraft`, `monsterFileText` and `draftPreviewAt`. When a draft exists, the existing inline load confirmation names the phase and says only its attacks are replaced (J07). The export box names the phase it replaces. Do not list anchors of hidden phases (J08).

**Focused checks**

Manually, with a video, on the Queen:
1. Choose phase 2 in the draft panel, and see the Tag panel's select follow.
2. Anchor `red`, and see only phase 2's blocks listed.
3. Edit a phase-2 attack, switch to phase 3, and press Load from game. Read the confirmation, which names phase 3.
4. Confirm the phase-2 edit survives.
5. Copy phase 3's export, and confirm it does not contain the phase-2 edit.

**Acceptance**

The panel shows one phase, both selects stay in step, and a reopened study restores its phase (J03). `npm run verify` passes. Manual checks are recorded as performed or blocked.

**Execution record - 2026-11-12.** `DraftPanel` gained a Phase select (accessible name "Phase of the monster draft") bound to the study's `sticky.phaseIndex`, shared with the Tag panel's select, and shows only the selected phase's blocks, anchors and attack lists; a phase change from either select clears the attack selection. The load confirmation names the phase and says only its attacks are replaced; the export label names the phase; the preview source carries `phaseId`. Component test: only the selected phase's heading shows and the select reports a change. Manual checks 1-5 on the Queen with a video: blocked, no real video available to this run.

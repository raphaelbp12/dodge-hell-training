# Phase 79: Every Monster Can Be Tagged

> Step prompts and execution records for phase 79 of [plan V19](../plan-v19.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 79.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-79.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 79.1 - Tag Readers Follow The Selected Monster

Status: complete. Dependencies: none.

**Implementation prompt**

Make every tag reader take the selected monster's archetype id explicitly, with no default, so a tag's phase indexes that monster's top-level phases (J18). Today they reach the boss through `primaryArchetype(config)`: `phaseOptions` in `research/taggingOptions.ts` and `resolveTagMatch` in `research/previewModel.ts`, and through them `matchTagAttack`, `tagMatchStatus`, `authoredAttackFromTag` in `research/exportAttack.ts`, the tag preview frame, and `restoreSticky` in `research/taggerSessions.ts`. Resolve the archetype from `config` by id, and pass the id through every caller in `TaggerRoute.tsx`. Leave `emitterTilesOf` and `initialHeadingSliderDegrees` reading the encounter, as J21 records. Do not change any tag rule, match order (M03), status text or export shape. No file under `app/src/game/` changes.

**Focused checks**

Failing first, in the existing test files of each module: a tag on a minion's phase 0 matches that minion's first attack firing its sprite, not the boss's; `phaseOptions` for a minion lists its phases; a tag whose phase index exists on the boss but not on the minion reports `unknown-phase`; `restoreSticky` with a minion and a phase index beyond its phases reports `phase-missing` and opens phase 0 (J23); every existing boss test passes with the primary id passed explicitly.

**Acceptance**

No tag reader under `app/src/research/` calls `primaryArchetype` for a tag's phase or match. Boss behaviour is unchanged, shown by the existing tests passing with only their call sites updated.

**Execution record - 2026-11-12.** Tag readers take the selected monster's archetype id explicitly with no default: `phaseOptions`, `matchTagAttack`, `tagMatchStatus`, `matchesLinearBullet`, `countUnmatchedTags`, `previewAt` (input `archetypeId`), `authoredAttackFromTag` and `restoreSticky`. No tag reader under `app/src/research/` calls `primaryArchetype` for a tag's phase or match; `emitterTilesOf` and `initialHeadingSliderDegrees` stay on the encounter (J21). Tests added: a minion tag matches the minion's attack and not the boss's; `phaseOptions` lists a minion's phases; a boss-only phase index is `unknown-phase` on a minion; `restoreSticky` for a minion falls back to phase 0 with `phase-missing` (J23). Existing boss tests pass with the primary id passed. No file under `app/src/game/` changed.


### Step 79.2 - Tagging In Every Study

Status: complete. Dependencies: 79.1.

**Implementation prompt**

Show tagging in every monster's study (J18, J19). In `research/studyLoad.ts`, `studyMonsterProblem` keeps refusing an unknown monster but no longer refuses tags or saved attacks on a minion, and `studySections` returns `tagging: true` and `sourceSwitch: true` for every monster, with `previewTuning` following the source switch alone. In `TaggerRoute.tsx`, remove the minion-only branches this leaves dead, and make switching monsters (L08) restore the opened study's sticky phase through `restoreSticky` for the selected monster, or phase 0 for an empty study (J03). The schema stays v4 and autosave keys stay as L33 set them (J22). When the step is complete, remove the D38 entry from `docs/deferred-work.md`, because J18 promotes it.

**Focused checks**

Failing first: `studyMonsterProblem` accepts a minion study with tags and still refuses an unknown archetype id; `studySections(true, "tags")` shows tagging, the source switch and tuning; a session written for a minion with a sticky phase restores that phase. Manually, with a video: on a nest, record a tag, see its match status name a nest attack, switch to the Queen and back, and confirm the tag and phase are restored.

**Acceptance**

A minion study shows the Tag panel, saved attacks and the Draft/Tags switch. `docs/killer-bee-queen-observations.json` and older studies load as before. `npm run verify` passes. Manual checks are recorded as performed or blocked.

**Execution record - 2026-11-12.** `studyMonsterProblem` refuses only an unknown monster. `studySections` is now `studySections(previewSource)` (the `isMinion` parameter and the `tagging` field were dropped as dead, since every monster shows tagging and the source switch); `previewTuning` follows the source alone. `TaggerRoute.tsx` lost its minion-only branches, passes `archetypeId` to every tag reader and to `PreviewPanel`, and monster switching restores the slot's sticky through `restoreSticky` for the selected monster, or phase 0 for an empty study (J03). The D38 entry was removed from `docs/deferred-work.md`. Manual check with a video (record a tag on a nest, switch to the Queen and back): blocked, no browser session with a real video was available to this run; the generated-clip Playwright case covers loading a clip and the draft panel only.

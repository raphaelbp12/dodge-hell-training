# Phase 56: Schema V3 And Stored Tags

> Step prompts and execution records for phase 56 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 56.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-56.md` and replace the plan's step lines with one-sentence outcomes.

### Step 56.1 - Stored Tags And Schema V3

Status: complete. Dependencies: V15 phase 55.

**Implementation prompt**

In `research/tagging.ts`, add the plan's Target Data Shapes: `TagAttackFields`, `UnlinkedTag`, `LinkedTag`, `StoredTag`, `SavedAttack` and `ObservationExportV3`, keeping `Tag` as the fully resolved shape every existing reader already uses (S29). Add `resolveTags(tags, savedAttacks)`, which fills a linked tag's attack fields from its saved attack and passes an unlinked tag through.

Extend `validateObservationExport` and `studyFromExport` for `schemaVersion: 3` (S04):

- `StudyState` gains `savedAttacks` and its `tags` become `StoredTag[]`. v1 and v2 upgrade in memory with an empty `savedAttacks`.
- Saved attacks: a nonblank unique `name`, a unique `id`, the attack-field rules `validateTag` already applies, and the S28 cadence rule (`shotsPerBurst` a positive integer; `shotIntervalSeconds` positive and required above 1, absent at 1; `cooldownAfterLastShotSeconds` positive).
- A linked tag's `savedAttackId` must name a saved attack in the same file, and it must not carry attack fields. `repeatEndSeconds` must be after `timeSeconds`, `repeatEndSource` requires `repeatEndSeconds`, and `burstId` excludes `repeatEndSeconds` (S42).
- New optional attack fields follow the plan's comments: `emitterRadiusTiles` on rings, `coneDegrees` on spread and scatter using `armArcProblem`'s ranges, `fixedBearingDegrees` with aim `fixed`, `frontOffsetDegrees` with aim `front`, and `target` only on a one-shot `spread` with aim `player`, excluding `bombRangeTiles`. Numbers are positive where a game validator requires it (`bombRangeTiles`, `bombTravelSeconds`, `bulletSpeedTilesPerSecond`, `bulletRangeTiles`) and finite otherwise. Whether a sprite is a bomb is referential and stays out of the structural validator (T31).

`assembleExport` writes `schemaVersion: 3` with the study's saved attacks and stored tags.

**Focused checks**

Write failing `tagging.test.ts` cases first: v1 and v2 files load with empty saved attacks; the committed `docs/killer-bee-queen-observations.json` still validates; a v3 file round-trips; and each rule above rejects with its path. `resolveTags` fills a linked tag, leaves an unlinked one unchanged, and throws on an unknown id.

**Acceptance**

Export always writes v3, every older file still loads, and the committed evidence file is byte-identical.

### Step 56.2 - Draft Version 2

Status: complete. Dependencies: 56.1.

**Implementation prompt**

In `research/taggerSessions.ts`, write `draftVersion: 2`, whose study holds `savedAttacks` and whose sticky may hold `savedAttackId` (S05). `validateSessionDraft` accepts versions 1 and 2, upgrading a version 1 draft to an empty `savedAttacks`. `restoreSticky` clears a `savedAttackId` naming a missing attack and adds an `attack-missing` notice.

**Focused checks**

Extend `taggerSessions.test.ts` first: a version 1 draft restores with its tags intact; a version 2 draft round-trips; a missing chosen attack gives the notice; and the session list still reads both versions.

**Acceptance**

No existing draft becomes unreadable, and no version 1 draft is rewritten until the session is next dirty.

### Step 56.3 - The Route Holds Stored Tags

Status: complete. Dependencies: 56.2.

**Implementation prompt**

In `research/TaggerRoute.tsx`, hold `tags` as `StoredTag[]` and add `savedAttacks` state, passing `resolveTags(tags, savedAttacks)` to every reader, memoized on those two values, and the stored form to autosave and export (S29, S30). `applyStudy` restores saved attacks. Choosing a new video without keeping tags and changing encounter both clear them, as they clear tags. Index-based row edits keep addressing the stored array, which stays index-aligned with the resolved one. No new UI appears here.

**Focused checks**

No new behaviour is visible, so `npm run verify` is the check. Manual, recorded as performed or blocked: record, edit, export, reload a study and restore a session, and confirm each behaves as before.

**Acceptance**

Export differs from before only by `schemaVersion` and an empty `savedAttacks`.

## Execution record

**56.1** Added `TagAttackFields`, `UnlinkedTag`, `LinkedTag`, `StoredTag`, `SavedAttack`, `ObservationExportV3` and `resolveTags` in `research/tagging.ts`; `validateObservationExport` and `studyFromExport` accept schema 1, 2 and 3 (older files load with empty `savedAttacks`), with the saved-attack, link, repeat-end, burst-exclusion and new typed-field rules; `assembleExport` writes `schemaVersion: 3`. The committed `docs/killer-bee-queen-observations.json` still validates and is unchanged.

**56.2** Drafts are `draftVersion: 2` with `study.savedAttacks`; version 1 drafts upgrade in memory with empty saved attacks and are not rewritten until next dirty; `restoreSticky` clears a missing chosen attack with an `attack-missing` notice.

**56.3** `TaggerRoute` holds `StoredTag[]` plus `savedAttacks`, passes `resolveTags` output (memoised) to every reader, and autosaves and exports the stored form. Export differs from before only by `schemaVersion` and an empty `savedAttacks`.

`npm run verify` passed (lint, typecheck, test, build). The record, edit, export, reload and restore manual check was not performed: no interactive browser session was available; the Playwright case (step 64.2) drove record, edit and export in headless Chromium.

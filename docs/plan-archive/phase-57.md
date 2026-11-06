# Phase 57: Tagger Housekeeping

> Step prompts and execution records for phase 57 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 57.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-57.md` and replace the plan's step lines with one-sentence outcomes.

### Step 57.1 - Title And Encounter Confirmation

Status: complete. Dependencies: phase 56.

**Implementation prompt**

In `research/TaggerRoute.tsx`, make the heading read the selected encounter's `displayName` plus "tagger" rather than the hard-coded Killer Bee Queen (S21). `chooseEncounter` uses the existing `confirmation` banner whenever tags or saved attacks exist, naming how many of each will be cleared, and changes nothing on Cancel (S19). The encounter `<select>` must show the current encounter again after a Cancel. Add a pure `encounterChangeDecision({ tagCount, savedAttackCount })` beside `videoChoiceDecision`.

**Focused checks**

Write the failing `taggingRoute.test.ts` case first: no tags and no attacks changes immediately, and either one asks. Manual, recorded as performed or blocked: confirm and cancel both behave, including what the select shows after Cancel.

**Acceptance**

An encounter change can no longer clear tags without a confirmation.

### Step 57.2 - Use These Settings

Status: complete. Dependencies: 57.1.

**Implementation prompt**

Add a pure `stickyFromTag(tag, current)` in `research/taggingOptions.ts` that copies a resolved tag's phase and attack fields into a new sticky selection, keeping fields the tag's pattern ignores from `current`, so a choice survives a pattern switch as it does today. Add a "Use these settings" button to each row's actions (S20).

**Focused checks**

Write failing `taggingOptions.test.ts` cases first: a composite ring and a player-aimed spread round-trip through `stickyFromTag` then `createTag`, giving the same fields at a new time.

**Acceptance**

Recording after pressing the button produces a row equal to the source except for time and burst.

### Step 57.3 - Labels And Width

Status: complete. Dependencies: 57.2.

**Implementation prompt**

In `research/TaggerRoute.tsx` and `TaggerRoute.module.css`, give every geometry input in a row a visible short label, keeping the existing `aria-label`s (S20). Compact the table's cells and make the actions column sticky on the right so Go to and Delete stay visible at 1440 pixels wide without horizontal scrolling. The time column stays reachable. The table keeps its own `overflow-x` container. Nothing is added per projectile.

**Focused checks**

Manual, recorded as performed or blocked: at 1440x900, with a composite rotating-arm row present, every action button is visible with the table unscrolled, and each input's meaning can be read without hovering. Existing Playwright cases that read these rows keep their `aria-label`s, so they need no change.

**Acceptance**

No row's meaning depends on an unlabelled input, and no action needs horizontal scrolling at 1440 pixels.

## Execution record

**57.1** The heading names the selected encounter's display name. `chooseEncounter` confirms through the existing banner whenever tags or saved attacks exist, naming both counts, and changes nothing on Cancel (the controlled `<select>` keeps the current encounter). `encounterChangeDecision` lives beside `videoChoiceDecision` in `studyLoad.ts` with its case in `studyLoad.test.ts`, not in `taggingRoute.test.ts` as the prompt named.

**57.2** `stickyFromTag` copies a resolved tag's phase and attack fields (and its saved attack) into the sticky selection, keeping fields the tag's shape ignores from the current selection; a composite ring and a player-aimed spread round-trip through `createTag`. Each row has a "Use these settings" button.

**57.3** Row geometry inputs carry short visible captions while keeping their `aria-label`s; the Tags table is compacted and its actions column is sticky at the right. The 1440x900 manual check was not performed (no interactive browser session).

`npm run verify` passed.

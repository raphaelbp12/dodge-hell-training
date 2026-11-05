# Phase 44: Load And Edit A Study

> Step prompts and execution records for phase 44 of [plan V13](../plan-v13.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 44.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-44.md` and replace the plan's step lines with one-sentence outcomes.

### Step 44.1 - Parse A Study File

Status: implemented, manual checks pending. Dependencies: phase 43.

**Implementation prompt**

Create `app/src/research/studyLoad.ts` with a pure `parseStudyFile(text, knownEncounterIds)`. It parses JSON, calls `validateObservationExport`, and returns `studyFromExport`'s result. It throws a readable error for invalid JSON, invalid shape, or an unknown encounter that names the id (Z19). The encounter check lives here and not in the validator (T31). Sprite and phase values are not checked (Z18).

**Focused checks**

Write failing tests first for: the committed JSON parsing and upgrading; invalid JSON; invalid shape; an unknown encounter naming its id; and an unknown sprite and out-of-range phase being accepted.

**Acceptance**

Parsing is pure, and all refusals are readable and leave no state behind.

### Step 44.2 - Load In Either Order

Status: implemented, manual checks pending. Dependencies: 44.1.

**Implementation prompt**

Add a "Load study" file input to `TaggerRoute.tsx`. It works with or without a video (Z13). Add pure decision helpers to `studyLoad.ts` so the route only applies their results:

- **Load.** If tags exist, an inline confirmation precedes replacing them, and cancelling changes nothing (Z17). A load sets the encounter without using `chooseEncounter`'s clearing path, restores `sourceUrl`, `frameRate` and `tags`, and resets the sticky phase to index 0.
- **Video choice (Z15).** The first video chosen after a load keeps the tags, `sourceUrl` and `frameRate`. Any later video choice with tags present requires an inline confirmation and then resets as today. With no tags, it resets as today.
- **Mismatch (Z16).** When the study's `fileName` differs from the chosen video, or a loaded study differs from the open video, show a non-blocking warning.
- **Provenance.** With a video open, export uses that video's `fileName` and `durationSeconds` and the study's `sourceUrl`. Without one, it uses the study's stored values (Z14, Z16).

Without a video, disable recording, stepping and jumps, with visible text saying why. Editing, deleting and export remain available (Z14). A blank frame rate blocks export with the existing error, which is how a v1 study gets its rate (Z27). `recordedAt` is set at export (Z25). Replace the tag list note that says there is no import or resume.

Changing the encounter selector still clears tags as T16 records.

**Focused checks**

Write failing tests first for the pure helpers: the confirmation decision with and without tags; the first and later video choices after a load; a mismatch and a match; provenance selected with and without a video; and an export with a blank frame rate being blocked.

**Acceptance**

Video and study load correctly in both orders, and a v1 study exports as v2 only after a presented rate is entered. Manual check: load `docs/killer-bee-queen-observations.json` in both orders, enter 30, export without a video, and confirm that the committed file is unchanged.

### Step 44.3 - Edit Tag Rows

Status: implemented, manual checks pending. Dependencies: 44.2.

**Implementation prompt**

Make each tag row editable (Z20) using selects and number inputs, which `isEditableTarget` already protects from tagger shortcuts. Add a pure `editTag(tag, change, durationSeconds)` in `taggingOptions.ts`:

- A time change must fall within 0 and the current duration (Z21). A valid change sets `timeSource: "typed"`, and no later edit clears it.
- A pattern change to `spread` or `scatter` sets `aim` to `player` when absent, which the row visibly shows. A change to any other pattern removes `aim` (Z05).
- A row can leave `volley` for an offerable pattern, but no row can be changed to `volley` (Z04).
- An unknown sprite or phase is shown as its raw value and selected in that row's control until changed (Z18).
- A blank burst field removes `burstId`. Any other value must be a positive integer (Z08).
- Invalid input leaves the tag unchanged and shows an error.

Row delete stays, and no undo is added (Z24).

**Focused checks**

Write failing tests first for: every editable field; both limits of the time range; `timeSource` being set and then persisting through a later non-time edit; aim being added and removed; `volley` being kept but not assignable; raw unknown values being preserved through an unrelated edit; burst removal and invalid burst values; and the input tag not being mutated.

**Acceptance**

Every field can be edited, invalid input changes nothing, and every edited tag still passes the v2 validator.

### Step 44.4 - Time Sorting And Row Seeking

Status: implemented, manual checks pending. Dependencies: 44.3.

**Implementation prompt**

Sort the tag list by `timeSeconds`, newest first, with a stable tie-break, re-sorting after a time edit (Z23). Replace the current index-based row identity so that a re-sort cannot edit or delete the wrong tag, and update the note about deleting the newest row.

Add a "Go to" control on each row which seeks to that tag's time through the existing seek path (Z22). It seeks to an absolute time, so give `seekBy`'s internals one absolute-target path rather than a second implementation. The pending-seek behaviour and `mediaTime` rule stay in place. Without a video the control is disabled (Z14).

**Focused checks**

Write failing tests first for the pure sort helper: order, ties, re-sorting after an edit, and no mutation of its input. Test any pure target-clamping helper used by the seek path.

**Acceptance**

The list follows footage time after loading and editing, and edit or delete always acts on the intended row. Manual check: seek from a row, then confirm that a new recorded tag uses the presented frame's `mediaTime`. Run `npm run verify` once at the end of the phase.

## Execution record

Implemented 2026-11-05: `studyLoad.ts` (`parseStudyFile`, `loadDecision`, `videoChoiceDecision`, `fileNameMismatch`, `resolveProvenance`, `currentDuration`), `editTag` and `sortNewestFirst` in `taggingOptions.ts`, `clampSeekTarget` in `taggingRoute.ts`, and the route wiring in `TaggerRoute.tsx` (load study input, inline confirmations, mismatch warning, in-place row editing, row "Go to" through the single `seekTo` path, newest-footage-first list keyed by array index). Pure helpers were written test-first.

Manual checks (load the committed JSON in both orders, enter 30, export without a video, seek from a row) were NOT performed: no browser was available. They remain for the user.

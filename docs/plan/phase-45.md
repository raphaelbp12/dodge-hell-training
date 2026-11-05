# Phase 45: Autosaved Sessions

> Step prompts and execution records for phase 45 of [plan V13](../plan-v13.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 45.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-45.md` and replace the plan's step lines with one-sentence outcomes.

### Step 45.1 - Draft Model And Storage Adapter

Status: implemented, manual checks pending. Dependencies: phase 44.

**Implementation prompt**

Create `app/src/research/taggerSessions.ts` with the `SessionDraft` shape from [plan V13](../plan-v13.md) and a structural `validateSessionDraft`. A draft may have a null `frameRate` (Z27), and its tags follow the v2 tag rules; reuse the validator's tag check rather than duplicating it.

Add a `TaggerSessions` adapter that takes a `() => Storage` accessor, following the `ZoomPreference` pattern. Use one key per file name under a named `TAGGER_SESSION_KEY_PREFIX` constant (Z28). It provides:

- `list()`, returning readable entries with file name, tag count and `savedAt`, plus unreadable entries holding only their storage key (Z32).
- `read(key)`, `write(draft)` and `discard(key)`.

Storage access is wrapped so an unavailable or full store returns a failure value instead of throwing (Z31). Nothing is ever removed automatically.

**Focused checks**

Write failing tests first with a fake `Storage` for: a write and read round trip; one slot per file name; an existing unrelated key being ignored; corrupt JSON and an invalid draft listing as unreadable; discard; a null frame rate being accepted; and read, write and quota failures returning failure values.

**Acceptance**

The adapter is independent of React, and no storage failure can throw into the route.

### Step 45.2 - When To Write

Status: implemented, manual checks pending. Dependencies: 45.1.

**Implementation prompt**

Add a pure `shouldWriteDraft({ dirty, tagCount })` and wire autosave in `TaggerRoute.tsx`. A tag record, edit or delete marks the session dirty. When the session is dirty and has at least one tag, any change to tags, provenance or sticky selection writes its draft with the current ISO time as `savedAt` (Z28, Z33).

Loading or restoring clears the dirty flag and writes nothing, so a slot is replaced only by a first tag or edit (Z30). A video reset writes nothing. Deleting the final tag writes nothing, so the slot keeps its last non-empty session. Export leaves the slot intact. After a mismatched video is accepted, later writes use the new file name and the old slot remains (Z16).

A failed write shows a visible autosave error, and tagging continues (Z31).

**Focused checks**

Write failing tests first for `shouldWriteDraft` and any helper that builds the draft: not dirty; dirty with zero tags; dirty with tags; and draft contents, including sticky selection and a null frame rate.

**Acceptance**

Each slot follows Z30's lifetime rules. Manual check: record tags, reload, and confirm the slot exists; choose another video and confirm the slot remains until that session records a tag.

### Step 45.3 - Saved-Session List And Restore

Status: implemented, manual checks pending. Dependencies: 45.2.

**Implementation prompt**

Opening the route shows a saved-session list when any slots exist (Z29). Each readable row shows file name, tag count and last-saved time, with restore and discard. Each unreadable row is marked as unreadable, with discard only (Z32). The list stays available until dismissed, and dismissing it deletes nothing.

Restoring follows the same path as loading: Z17's inline confirmation when tags exist, Z19's refusal for an unknown encounter, and Z15's rule that the first video chosen afterwards keeps the tags. A mismatch warns under Z16. Restoring also applies the sticky selection through a pure `restoreSticky(sticky, config)`. A missing sprite or phase falls back to the tagger's normal default, with a notice, and the tags stay as saved (Z33).

Discard removes only that slot, after an inline confirmation.

**Focused checks**

Write failing tests first for `restoreSticky`: valid values kept; a missing sprite; a missing phase; a notice being reported for each fallback; and no change to tags.

**Acceptance**

A session can be recovered after a reload, with or without its video, and carries on autosaving under its file name. Manual check: restore, choose the video, seek from a row, and record a tag; then discard a slot and confirm the other slots remain. Run `npm run verify` once at the end of the phase.

## Execution record

Implemented 2026-11-05: `taggerSessions.ts` (`SessionDraft`, `validateSessionDraft`, `buildDraft`, `shouldWriteDraft`, `restoreSticky`, `TaggerSessions` over an injected storage accessor under `TAGGER_SESSION_KEY_PREFIX`) with `taggerSessions.test.ts` using a fake storage, and the route wiring (dirty-flag autosave, visible autosave error, saved-session list with restore/discard and inline confirmations, unreadable slots, dismiss).

Manual checks (reload and confirm the slot, restore then choose the video, discard one of several slots) were NOT performed: no browser was available. They remain for the user.

# Phase 85: The Structure Step

> Step prompts and execution records for phase 85 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 85.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-85.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase moves the route onto the v5 study, makes sessions and study files carry it, and builds the Structure step: the multi-row timeline, boundaries, telegraph ends and invulnerable spans (E02, E04, E05, E10, E11, E14, E20). The old Tag, Review and Draft panels keep rendering from a legacy `StudyState` derived view until phase 86 replaces them; this phase must not break them. Nothing under `app/src/game/` changes.

### Step 85.1 - The Route Holds A V5 Study

Status: pending. Dependencies: phase 84.

**Implementation prompt**

In `app/src/research/TaggerRoute.tsx`, replace the separate `storedTags`, `savedAttacks`, `monsterDraft` and `sticky.phaseIndex` state with one `study: StudyV5 | null` and one `selectedTrackId: string | null`. Keep the video, seek, frame and session plumbing as they are. Concretely:

- On choosing a monster or opening a video with no study, build the study with `emptyStudy` from `studyMigrate.ts`, using `AUTHORED_MONSTER_FILES[archetypeId]` as `rawFile`, `new Date().toISOString()` as `recordedAt`, and the current provenance.
- On loading a study JSON (`parseStudyFile`) and on restoring a session, pass the result through `studyV5FromLegacy` when it is a `StudyState`, and show each notice once through the existing `notice` line, joined by spaces.
- Every edit goes through `studyEdits.ts`; the route only calls `setStudy(result.value)` or `setError(result.error)` and sets `dirty`.
- Keep the old panels compiling by deriving a `StudyState` view for them with a small local adapter `legacyViewOf(study)` that returns empty `tags` and `savedAttacks` and `monsterDraft: null`. They render empty until phase 86 removes them. Do not port their behaviour.

In `app/src/research/tagging.ts`, add `ObservationExportV5 = StudyV5` to the export union, make `validateObservationExport` accept `schemaVersion: 5` by delegating to `validateStudyV5`, and make `studyFromExport` return the v5 study unchanged for that version (type the return as `StudyState | StudyV5` and let `studyLoad.ts`'s `parseStudyFile` return the same union). The export button writes the v5 study with `recordedAt` refreshed.

In `app/src/research/taggerSessions.ts`, change `SessionDraft` to the plan file's shape (`draftVersion: 4`, `study: StudyV5`, `selectedTrackId`). `validateSessionDraft` accepts versions 1-4; for 1-3 it returns the legacy draft and the route converts it with `studyV5FromLegacy` on restore. `buildDraft` takes `{ study, selectedTrackId, savedAt }`. `shouldWriteDraft` takes `{ dirty, markCount, boundaryCount }` and writes when dirty and either count is positive. The list entry's `tagCount` becomes `markCount`: the sum of marks over tracks and scratch.

**Focused checks**

Update `taggerSessions.test.ts` and `studyLoad.test.ts` first: a version 4 draft round-trips; a version 3 draft is returned as legacy; `parseStudyFile` accepts a v5 file and a v2 file; `shouldWriteDraft` is false with no marks and no boundaries. Then make them pass.

**Acceptance**

The route compiles with one study state, a page reload restores a v5 session, loading `docs/killer-bee-queen-observations.json` shows the conversion notice and no error, and the old panels still render without throwing.

### Step 85.2 - The Multi-Row Timeline

Status: pending. Dependencies: 85.1.

**Implementation prompt**

In `app/src/research/timelineModel.ts` add:

```ts
export const TIMELINE_ROW_HEIGHT_PX = 14;

export type TimelineRow = Readonly<{
  /** "structure", "status", "scratch", or a track id. */
  id: string;
  label: string;
  ticks: readonly Readonly<{ fraction: number; style: "solid" | "hollow" | "faint" | "boundary" }>[];
  bars: readonly Readonly<{ fromFraction: number; toFraction: number }>[];
  /** A boundary tick's segment label, keyed by fraction. */
  labels: readonly Readonly<{ fraction: number; text: string }>[];
}>;

export function timelineRows(input: Readonly<{
  study: StudyV5;
  segments: readonly Segment[];
  durationSeconds: number;
  /** Predicted volley times per track id, from phase 86; empty until then. */
  predicted: Readonly<Record<string, readonly number[]>>;
}>): readonly TimelineRow[];
```

Rows, in order: structure (boundary ticks with the segment label, telegraph ends as hollow ticks), status (invulnerable spans as bars; an open span runs to the end), one row per track in study order (volley marks solid, detonation marks hollow, predicted volleys faint, an end mark as a bar from the end mark to the window end), scratch (solid ticks). Fractions come from `markerFractions`.

In `app/src/research/TaggerTimeline.tsx`, draw the rows on one canvas whose height is `rows.length * TIMELINE_ROW_HEIGHT_PX`, label each row at its left edge, draw a faint tick at 40 % alpha, a hollow tick as a 1-pixel outline, and a boundary tick full height with its label beside it. Add props `rows`, `selectedRowId` and `onSelectRow(id)`; a click in a row's band selects it, and a click elsewhere seeks as today. Keep the goto field and the playhead.

**Focused checks**

Failing-first tests in `timelineModel.test.ts`: a study with two boundaries, one open span, one track with two marks and one scratch mark yields four rows with the expected tick styles and the open span's bar ending at fraction 1.

**Acceptance**

The timeline shows one row per track, selecting a row sets `selectedTrackId` in the route, and the tests pass.

### Step 85.3 - The Structure Panel And Its Keys

Status: pending. Dependencies: 85.2.

**Implementation prompt**

Create `app/src/research/StructurePanel.tsx`, rendered in the Structure step. It receives `study`, `segments`, `windows`, `mediaTime`, `frameRate` and callbacks, and shows:

- A button "Segment starts here" (key `S`) with a help mark; a table of boundaries, newest footage first, each row showing the time, a `<select>` of every segment label (changing it calls `setBoundarySegment`), the measured telegraph when a telegraph end exists, a "Telegraph ends here" button (key `T` acts on the latest boundary at or before the playhead), a "Remove" button, and a click on the time that seeks there.
- A button "Invulnerable starts here" that turns into "Invulnerable ends here" while a span is open (key `I`); a list of spans with their in, out and duration, each removable.
- One sentence under the heading: "Mark the frame each phase or sub-phase is entered. Every later mark takes its segment from these."

In `app/src/research/taggingRoute.ts`, change `actionForKey` to the E10 map: remove the `b`/`B`, Shift+Enter and digit shot-count cases; add `{ kind: "boundary" }` for `s`/`S`, `{ kind: "telegraph-end" }` for `t`/`T`, `{ kind: "invulnerable" }` for `i`/`I`, `{ kind: "end-mark" }` for `x`/`X`, `{ kind: "detonation" }` for `e`/`E`, `{ kind: "remove-mark" }` for `Delete` and `Backspace`, `{ kind: "select-track", position: n }` for `1`-`9` and `{ kind: "select-track", position: 0 }` for `0`; keep `{ kind: "record" }` for Enter without a mode. Update `taggingRoute.test.ts` first. The route wires `boundary`, `telegraph-end` and `invulnerable` in this step; the others are wired in phases 86 and 87 and are no-ops until then.

Add help texts to `helpText.ts`: `HELP_SEGMENT_STARTS_HERE`, `HELP_TELEGRAPH_ENDS_HERE`, `HELP_INVULNERABLE`, `HELP_BOUNDARY_SEGMENT`, each one sentence using glossary words.

**Focused checks**

`taggingRoute.test.ts` covers every key in the E10 map and asserts `b` and Shift+Enter now return null. A new `StructurePanel.test.tsx` renders two boundaries and asserts the select shows every segment label and that "Remove" calls back with the row's index.

**Acceptance**

Pressing `S`, `T` and `I` with a video open edits the study as E04 and E05 describe, the boundary table reflects it, and the tests pass. Record the manual check.

### Step 85.4 - Steps And Guide Text

Status: pending. Dependencies: 85.3.

**Implementation prompt**

Change `TaggerStep` in `TaggerControls.tsx` to `"setup" | "structure" | "attacks" | "reconcile"` and the route's step bar to those four, with statuses "<n> boundaries", "<n> marks on <m> tracks" and "<n> warnings" (warnings count comes in phase 88; show "not yet checked" until then). Rewrite `STEP_GUIDES` in `stepGuide.ts` for the four steps using only glossary words:

- setup: open the video, enter or detect the frame rate, choose the monster, restore or load; the monster's attacks load as tracks automatically.
- structure: play to each segment entry and press Segment starts here; fix the segment in the table if the guess is wrong; press Telegraph ends here when the warning ends; press Invulnerable starts here and ends here around any invulnerable stretch.
- attacks: select a track with its number, mark every volley with Enter, mark where it stops with X, read the fit; use the scratch track for anything unidentified.
- reconcile: read the warnings, accept the measured values you trust, copy the monster file.

Keep the Attacks and Reconcile panels as placeholders that show their guide text until phases 86 and 88 fill them.

**Focused checks**

`StepGuidePanel.test.tsx` renders every step's guide. A grep of `stepGuide.ts` for "block", "sticky", "anchor" and "typed estimate" is empty.

**Acceptance**

The four steps show, each with its guide, and `npm run verify` passes once at the end of the phase.

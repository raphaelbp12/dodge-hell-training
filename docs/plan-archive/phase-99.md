# Phase 99: One Preview, The Timeline And The Parity Panel

> Step prompts and execution records for phase 99 of [plan v23](../plan-v23.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 99.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-99.md` and replace the plan's step lines with one-sentence outcomes.

### Step 99.1 - The Preview Draws The Game's Volleys

Status: pending. Dependencies: phase 98.

**Implementation prompt**

Make the tagger preview draw exactly what the game will fire (Q17). In `app/src/research/draftPreview.ts`, replace `observedPreviewAt` and `fittedPreviewAt` with one `previewAt(input)`. For each track that 98.2 would export with marks, build the same `marks` object (share the builder with `studyExport.ts`; do not copy it) and, for each window of the track, draw the volleys `markedVolleysBetween` returns for that window from its start up to the current time, using each volley's `burstIndex` and `shotIndex`. Ring rotation and arm spread keep counting from the window's epoch, as they do today. Every window replays the first window's marks (Q04). A track 98.2 would drop draws nothing.

In `app/src/research/PreviewPanel.tsx`, remove the Observed/Fitted/Both toggle and the ghost drawing; keep the sliders, sizes and view controls. Remove `draftVolleysLiveAt`, `windowsFromBoundaries` and the ghost fields of `previewModel.ts` once nothing uses them, with their tests.

**Focused checks:** failing tests first in `draftPreview.test.ts`: a marked track draws its volleys at the marked times in its first window and the same offsets in a later window; a periodic track draws its repeats and stops as Q07 says; a mark during the telegraph is drawn; a dropped track draws nothing. A component test shows the panel without the toggle. Manual check: the committed study's phase 6 in the preview still matches the video, recorded as performed or blocked.

**Acceptance:** one preview path, built on the game's schedule; the toggle and the fitted path are gone; `npm run verify` and the mutation diff pass.

### Step 99.2 - Remove The Fit And Accept, Add Periodic Controls

Status: pending. Dependencies: 99.1.

**Implementation prompt**

Remove the cadence fit and every Accept control (Q17), and add the periodic controls (Q06, Q18).

Delete `app/src/research/FitPanel.tsx`, `fitCadence`, `maxResidual`, `predictedTimesInWindows` and `predictedVolleyTime` from `cadenceFit.ts` (keep `splitGaps`, `pairDetonations` and `medianOf`), their tests, the accept edits in `studyEdits.ts` (`acceptSegmentValue`, the cadence accept and the bomb override accept), the Accept buttons in `ReconcilePanel.tsx`, and the residual and null-cadence warnings in `studyWarnings.ts`. Remove the glossary and help entries for removed words, keeping `REQUIRED_TERMS` consistent with what the interface still shows. `ReconcilePanel` keeps showing measured values, now as what export writes.

In the track panel, add a "Periodic" checkbox and a "Period (seconds)" number field for the selected track, calling `setTrackPeriod`. Add `periodic` and `period` to the glossary.

In `app/src/research/timelineModel.ts` and `TaggerTimeline.tsx`, replace the predicted-volley faint ticks with a periodic track's repeated volleys after its first cycle, from `markedVolleysBetween`, up to its stop mark's effect or its window's end (Q18).

**Focused checks:** failing tests first: the timeline rows of a periodic track carry faint ticks at its repeats and none for a non-periodic track; the period controls set and clear `periodSeconds`; no component renders an Accept control; the glossary test passes. Manual check of the Attacks and Reconcile steps, recorded as performed or blocked.

**Acceptance:** no fit and no Accept remain; periodic tracks can be set in the tagger and their repeats show on the timeline; `npm run verify` and the mutation diff pass.

### Step 99.3 - The Parity Panel

Status: pending. Dependencies: 99.2.

**Implementation prompt**

Add the read-only parity panel (Q19). Create `app/src/research/parity.ts`, pure, returning for a study and the exported file:

- per exported track: whether `markedVolleysBetween` over its first window reproduces its volley marks within one video frame, and if not, the first mismatching mark time (a guard against an export or schedule bug);
- the tracks export drops, by id and segment;
- the segment values export changes from the shipped file, with both values;
- the later windows whose marks differ from the first window's offsets beyond one frame, with the first differing time.

Create `app/src/research/ParityPanel.tsx` and show it in the Reconcile step beside the existing panel. It never blocks export. Move the comparison helpers of `app/src/research/study-game-parity.test.ts` into `parity.ts` where they fit, so the test and the panel share them.

**Focused checks:** failing tests first for `parity.ts` on hand-built studies, one per list above; a component test renders each list and an empty state. Manual check on the committed study, recorded as performed or blocked.

**Acceptance:** the panel shows the four lists; the parity test uses `parity.ts`; `npm run verify` and the mutation diff pass.

## Execution Record - 2026-11-19

Status: complete; manual checks blocked (no browser or video in the agent session).

- 99.1: `draftPreview.ts` `previewAt` and `previewVolleysOf` draw `markedVolleysBetween` per window from `trackMarksOf`; measured bomb values apply. The Observed/Fitted/Both toggle, ghost drawing, `draftVolleysLiveAt`, `windowsFromBoundaries` and `BlockWindow` are removed. A test compares preview volley times with the simulation's.
- 99.2: `FitPanel.tsx`, `fitCadence` and the prediction helpers, their tests (`cadenceFit.property.test.ts`), the accept, threshold and override edits, the Accept buttons and the fit warnings are removed. New `TimingPanel.tsx` holds the Periodic checkbox, the period field (`CommitInput`) and the bomb rows that `FitPanel` used to show (range measuring kept). Timeline faint ticks are `repeatTimesOf`. Glossary and help updated (`Periodic`, `Period`, `Repeat tick`, `Parity`).
- 99.3: `parity.ts` (`parityReport`, `firstMismatch`, `scheduledTimesInWindow`) and `ParityPanel.tsx` inside the Reconcile panel; the parity test uses `firstMismatch`.
- Manual checks (phase 6 preview against the video, Attacks and Reconcile steps): blocked, for the user.
- Checks: as recorded for phase 97; `trackMarks.ts` 90.74, `parity.ts` 77.06, `draftPreview.ts` 55.00 percent mutation score (research break 70 met as a shard).

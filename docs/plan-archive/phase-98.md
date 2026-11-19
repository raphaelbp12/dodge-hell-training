# Phase 98: Study Version 6 And The Measured Export

> Step prompts and execution records for phase 98 of [plan v23](../plan-v23.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 98.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-98.md` and replace the plan's step lines with one-sentence outcomes.

### Step 98.1 - Study Version 6

Status: pending. Dependencies: phase 97.

**Implementation prompt**

Move the study to `schemaVersion: 6` (Q15), with the track shape of plan V23's Target Data Shapes. In `app/src/research/study.ts`, define `StudyV6` and its validator: tracks lose `cadenceSource`, `burstGapThresholdSeconds` and `projectileOverride`, gain an optional `periodSeconds` (finite, greater than 0), and the study loses `acceptedSegmentValues`. `attack.cadence` stays in each track unchanged.

In `app/src/research/studyMigrate.ts`, convert a version 5 study (and, through the existing chain, every older one) to version 6 by dropping those fields; the discarded accepted values are not kept anywhere. In `app/src/research/taggerSessions.ts`, move session drafts to `draftVersion: 5` carrying a version 6 study, converting version 1-4 drafts on restore. Every reader and editor of the dropped fields (`studyEdits.ts`, `FitPanel.tsx`, `ReconcilePanel.tsx`, `TaggerRoute.tsx`, `studyWarnings.ts`) stops reading them; their removal from the UI is step 99.2, so here they only stop compiling against fields that no longer exist. Add `setTrackPeriod(study, trackId, seconds | undefined)` to `studyEdits.ts`.

The frozen fixtures of V22 A14 must still load. `app/src/research/study-game-parity.test.ts` must still run on the committed study through the conversion.

**Focused checks:** failing tests first: a version 5 study with accepted values, a cadence source, a threshold and a bomb override converts to version 6 without them; a version 6 study round-trips; an invalid `periodSeconds` is rejected with a readable path; a version 4 session draft restores as version 5; `setTrackPeriod` sets and clears the field. The persistence contract tests over every frozen fixture pass.

**Acceptance:** every saved study and draft format loads as version 6; nothing reads a dropped field; `npx tsc -b` passes; the mutation diff (by the `verifier` subagent) passes.

### Step 98.2 - Export Marks

Status: pending. Dependencies: 98.1.

**Implementation prompt**

Make `monsterFileTextFromStudy` (`app/src/research/studyExport.ts`) write each track's marks into the monster file (Q02-Q07, Q09, Q16).

For each segment of the file:

- If the segment has no window in the study, leave its attack list and values exactly as the current file has them (Q16).
- Otherwise its attack list is its tracks that have at least one volley mark in the track's first window (`windowsForTrack(...)[0]`), in study order. A track with no volley mark there is dropped.

For each kept track, write its `attack` with `cadence` removed and `marks` added. `marks.bursts` is that window's volley marks as offsets from the window's start (Q03), sorted, grouped into bursts by `splitGaps` with its automatic threshold exactly as `observedPreviewAt` groups them today (Q09), duplicates kept (Q08). When the track has `periodSeconds`, write it, and when it also has an end mark inside the first window, write `stopAfterSeconds` as the end mark's offset from that window's start (Q07). Round every offset to the millisecond so the file stays readable.

A bomb track's projectile variant is handled in 98.3; keep `bombVariantOf` working on the new track shape for now. The validation at the end of `monsterFileTextFromStudy` stays and must accept the new `marks` attacks.

`studyExport.test.ts` asserts that the committed study exports to the shipped Queen file. That stops being true here, by design, until step 100.1 pastes the new export. Mark that test `test.fails` with a comment citing plan V23 Q22 and step 100.1; step 100.1 removes the marker.

**Focused checks:** failing tests first, on small hand-built studies: a track's marks become `marks.bursts` offsets from the window start; a mark during the telegraph gives an offset below the telegraph; a burst split by `splitGaps` gives nested lists; duplicates survive; a periodic track with and without a stop mark; a track with no marks in an observed segment is dropped; a segment with no window keeps its shipped attacks byte-identical; a track in two windows exports its first window's marks only. Every other monster loaded with no marks exports byte-identical to its file, except that segments with a window drop unmarked tracks: assert both cases explicitly.

**Acceptance:** export writes marks as specified; unobserved segments are untouched; the exported text passes the game's validators; `npm run verify` and the mutation diff pass.

### Step 98.3 - Export Measured Segment And Bomb Values

Status: pending. Dependencies: 98.2.

**Implementation prompt**

Write the measured segment and bomb values into the export with no Accept (Q13, Q14).

For each segment with at least one window, set, when a measurement exists, the median over its windows of:

- `telegraphSeconds`: `telegraphEndSeconds - timeSeconds` over boundaries that have a telegraph end;
- `durationSeconds` on a sub-phase: the window's length, over windows whose next boundary is another segment of the same phase;
- `exitAfterSeconds` on a phase that already authors one: the window's length, over windows that end at a boundary rather than the video end;
- `invulnerableOnEnterSeconds`: the span's length, over invulnerable spans attributable to the segment under E05 (opening within one frame of its boundary and closed).

A value with no measurement keeps the file's value. Round to the millisecond.

For a bomb track, build the projectile variant from the measurements instead of `projectileOverride`: `travelSeconds` is the median gap of `pairDetonations(track.marks)`, and `rangeTiles` is the median of the track's non-null `measuredRangeTiles`, with the targeted-bomb rule of `bombVariantOf` unchanged. A bomb track with neither measurement exports no variant.

**Focused checks:** failing tests first: each of the four segment values is written from its measurement; a sub-phase window cut by the next phase is excluded from its duration; a phase without `exitAfterSeconds` gains none; a segment with no telegraph end keeps its shipped telegraph; a bomb variant from pairs and ranges; a targeted bomb keeps the authored range. The committed study's phase 6 exports a 4.067-second telegraph and a 33.133-second `exitAfterSeconds`.

**Acceptance:** export writes every measured value as specified and nothing else; `app/src/research/study-game-parity.test.ts`'s telegraph cases, run against the exported file rather than the shipped one, pass; `npm run verify` and the mutation diff pass.

## Execution Record - 2026-11-19

Status: complete (steps 98.1-98.3).

- 98.1: `StudyV6` (renamed from `StudyV5` everywhere) with optional `periodSeconds`; `studyV6FromV5` drops the four fields. Recorded deviation: it lives in `study.ts`, not `studyMigrate.ts`, because `tagging.ts` (the legacy loader) must call it and `studyMigrate.ts` imports `tagging.ts`. Session drafts are `draftVersion: 5`; a version 4 draft converts on restore. New frozen fixture `study.v6.json`; every older fixture still loads. `setTrackPeriod` added. Legacy conversion drops typed bomb values (no home in v6).
- 98.2/98.3: shared builder `app/src/research/trackMarks.ts` (`trackMarksOf`, `trackWindowsOf`); `studyExport.ts` writes marks, drops unmarked tracks of observed segments, keeps unobserved segments, writes `measuredSegmentValues` medians and measured bomb variants (`exportedVariantsOf`). The committed study's phase 6 measures 4.067 s telegraph and 33.133 s exit.
- `studyExport.test.ts` asserts the committed study exports to the shipped file; it passes after step 100.1, so no `test.fails` marker remains.
- Checks: as recorded for phase 97 (verify passed; whole-suite Stryker above every break; `studyExport.ts` 82.05, `study.ts` 76.17, `taggerSessions.ts` 78.31 percent).

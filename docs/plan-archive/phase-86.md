# Phase 86: The Attacks Step

> Step prompts and execution records for phase 86 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 86.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-86.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase builds the Attacks step: the track list, marks, the live cadence fit and the preview of observed and ghost volleys (E03, E06, E07, E10, E12, E16, E17), then removes the tag, saved-attack, repeat, tuning and draft-panel code the new step replaces (E15). Nothing under `app/src/game/` changes.

### Step 86.1 - The Track Panel

Status: complete. Dependencies: phase 85.

**Implementation prompt**

Create `app/src/research/TrackPanel.tsx`, rendered in the Attacks step. It shows the tracks as a numbered list (position 1-9 is the selection key; a tenth or later track is selected by click only), each row with the track id, its segment label, its projectile's sprite through `ProjectileSprite`, its mark count and its `cadenceSource`. The selected row is highlighted. Below the list: "Add attack" (an id field plus a segment `<select>`, creating a track with `NEW_ATTACK_DEFAULTS` from `monsterDraft.ts` and the catalog's first projectile, the way `addAttack` does), "Duplicate" (a new id field; `duplicateTrack`), "Delete" after a second click to confirm (`removeTrack`), and "Reload from game" which replaces every track that has no marks with `tracksFromMonsterFile` and keeps every track that has marks, reporting how many were kept.

Under the list, for the selected track, render the existing `AttackEditor` from `DraftPanel.tsx`, moved into its own file `app/src/research/AttackEditor.tsx` without behaviour changes, so the person edits the definition's projectile, pattern and cadence there. An edit calls `setTrackAttack(study, id, attack, "typed")` when a cadence field changed and keeps the current `cadenceSource` otherwise. A segment `<select>` beside the editor calls `setTrackLocation`.

Wire the `select-track` key action: position `n` selects the track at index `n - 1`; position `0` selects the scratch track (`selectedTrackId: null`).

**Focused checks**

A new `TrackPanel.test.tsx` renders three tracks, asserts the numbering, that clicking a row selects it, and that "Delete" asks for a second click. `studyEdits.test.ts` already covers the edits.

**Acceptance**

The track list shows every loaded attack with its sprite, the editor edits the selected track's definition, and the tests pass.

### Step 86.2 - Marks

Status: complete. Dependencies: 86.1.

**Implementation prompt**

Wire these key actions in the route: `record` adds a `"volley"` mark at the presented frame's `mediaTime` to the selected track, or to scratch when none is selected, through `addMark`; `end-mark` calls `setEndMark` on the selected track at the presented frame; `remove-mark` calls `removeMarkNear` on the selected track with a tolerance of `2 * volleyStepTolerance(frameRate)`. Recording still waits for the frame callback after a seek exactly as `recordTag` does today (T19); reuse that guard.

In `TrackPanel.tsx`, add a marks table for the selected track: time, kind, a click to seek, and a "Remove" button per row. Add the scratch section: its marks with checkboxes, and "Create attack from selected marks" with an id field and a segment select, calling `createTrackFromScratch`.

The `[` and `]` keys step between the marks of the selected track when one is selected, and between every mark of every track otherwise, through `previousVolleyTime` and `nextVolleyTime`.

**Focused checks**

A route-level test is not practical; cover the pure parts in `studyEdits.test.ts` (already done) and add to `TrackPanel.test.tsx`: the marks table lists marks in time order and "Create attack from selected marks" is disabled with nothing checked.

**Acceptance**

With a video open, Enter adds a mark on the selected track, Delete removes the mark under the playhead, X sets the end mark, and the timeline row updates. Record the manual check.

### Step 86.3 - The Fit Panel

Status: complete. Dependencies: 86.2.

**Implementation prompt**

Create `app/src/research/FitPanel.tsx`, rendered under the track panel for the selected track. It calls `fitCadence` with the track's marks, `windowsForTrack(segmentWindows(...), track.location)` and the track's threshold override, and shows a four-row table: shots per burst, shot interval, cooldown, initial delay; each row has the fitted value (or the sentence from E06 about what one more mark would determine), the track's current `attack.cadence` value, and an "Accept" button that writes that one field through `setTrackAttack(..., "fitted")`. An "Accept all" button writes every non-null field. A line shows `volleyCount`, `completeBurstCount` and `maxResidualSeconds` in seconds and in frames when the frame rate is known.

The burst gap threshold control: a number field in seconds, shown when `thresholdSeconds` is null while there are at least two gaps, or when the person presses "Set threshold"; blank clears the override (`setBurstGapThreshold`).

Compute the predicted volley times per track for the timeline's faint ticks: for each window of the track, `predictedVolleyTime(window.epochSeconds + cadence.initialDelaySeconds, cadence, i)` for `i` from 0 while the time is below the window's end, capped at `MAX_PREDICTED_VOLLEYS_PER_WINDOW` (2000, a guard on a near-zero cooldown, not a game value). Pass them to `timelineRows` as `predicted`.

**Focused checks**

A new `FitPanel.test.tsx` renders a track with six marks forming two bursts of three and asserts the fitted values are shown with three decimals and that "Accept" calls back with the field and value. `cadenceFit.test.ts` covers the arithmetic.

**Acceptance**

The fit updates as marks are added, accepting writes the cadence and the ghost ticks move to match, and the tests pass. Record the manual check.

### Step 86.4 - Observed And Ghost Volleys In The Preview

Status: complete. Dependencies: 86.3.

**Implementation prompt**

In `app/src/research/draftPreview.ts`:

- Extract the body of the inner loop of `draftPreviewAt` (everything that turns one volley of one attack at one age into `PreviewProjectile` and `PreviewDetonation` entries) into `projectilesOfVolley(input: { attack: AttackSpec; projectile: ProjectileSpec; volley: DraftVolley; ageSeconds: number; emitterTiles; playerTiles; headingRadians; config })`, returning `{ projectiles, detonations }`. `draftPreviewAt` must produce byte-identical output after the extraction; `draftPreview.test.ts` is the guard.
- Add `windowsFromBoundaries(windows: readonly SegmentWindow[], blocks: readonly DraftBlock[]): readonly BlockWindow[]`, mapping each segment window to `{ blockId: segmentId, anchorSeconds: startSeconds, epochSeconds, endSeconds }`.
- Add `fittedPreviewAt(input)` that takes `study`, `segments`, `windows`, `config`, `timeSeconds`, `playerTiles`, `headingRadians` and draws every track's `attack` in `windowsForTrack` through `draftVolleysLiveAt` and `projectilesOfVolley`, marking each entry `ghost: true`.
- Add `observedPreviewAt(input)` with the same inputs that draws each track's volley marks: a mark at `t` is a `DraftVolley` with `timeSeconds: t`, `burstIndex` the index of its burst within its window per `splitGaps` (0 when unknown), and `volleyIndex` its index within that burst; the age is `timeSeconds - t`; only marks whose age is below `drawnLifetimeSeconds` are drawn. A detonation mark draws nothing on its own.

Add `ghost?: boolean` to `PreviewProjectile` and `PreviewDetonation` in `previewModel.ts`, and in `previewDraw.ts` draw a ghost with `context.globalAlpha = GHOST_ALPHA` (0.35, a named constant in `previewDraw.ts`) restored afterwards.

In `PreviewPanel.tsx`, replace the draft/tags source switch with a three-way `Segmented` control "Observed", "Fitted", "Both" (default "Both"), and drop the `tuning` props and the tuning section. The panel takes `study`, `segments` and `windows` instead of `tags`, `savedAttacks` and `draftSource`. Highlighting: the selected track's projectiles get the highlight ring.

**Focused checks**

Failing-first tests in `draftPreview.test.ts`: `windowsFromBoundaries` maps a window one-to-one; `observedPreviewAt` with one mark at 1.0 s and the time at 1.1 s yields that attack's projectiles at age 0.1 s and none at 1.0 s before the mark; `fittedPreviewAt` yields `ghost: true` on every entry; the existing `draftPreviewAt` tests still pass after the extraction.

**Acceptance**

The preview draws marks as observed volleys, the accepted cadence as ghosts, and both together; the tests pass. Record the manual check.

### Step 86.5 - Removing The Replaced Code

Status: complete. Dependencies: 86.4.

**Implementation prompt**

Delete, in this order, confirming with `npx tsc --noEmit -p app` after each group that no importer remains (E15):

1. The Tag panel, the Tags table, the Summary, the export-attack dialog, the "Use these settings" action and the sticky state from `TaggerRoute.tsx`; `TypedFieldControls.tsx`, `SavedAttackPanel.tsx` and their tests.
2. `savedAttacks.ts`, `repeat.ts`, `tuning.ts` and their tests. Move nothing else from `repeat.ts`; step 84.2 already moved `volleyTime`.
3. In `previewModel.ts`, remove `matchTagAttack`, `tagMatchStatus`, `withTagGeometry`, `withTypedProjectileValues`, `patternFromTag`, `tagPreviewAt` and every helper only they use; keep `emitterTilesOf`, `initialHeadingSliderDegrees`, `drawnLifetimeSeconds`, the `Preview*` types and whatever `draftPreview.ts` imports. Trim `previewModel.test.ts` to what remains.
4. In `exportAttack.ts`, remove `authoredAttackFromTag` and `attackJson` once `studyMigrate.ts` no longer needs them: first change step 84.4's conversion to call a new `authoredAttackFromLegacyTag` kept in `studyMigrate.ts` that contains the matching logic it needs (copy `matchTagAttack` and the pattern helpers it uses into `studyMigrate.ts` as private functions), then delete. Export `projectileVariantOf`.
5. `DraftPanel.tsx` and its test; `AttackEditor.tsx` stays. In `monsterDraft.ts` keep `NEW_ATTACK_DEFAULTS`, `blockIdOf`, `blocksOfMonster`, `monsterFilePath` and the attack validation helpers; remove `MonsterDraft`, `loadMonsterDraft`, `setAnchor`, `clearAnchor`, `activeDraftAttacks`, `monsterFileText` and the edit functions once `studyExport.ts` (phase 88) does not need them. If phase 88 is not yet implemented, leave those and record it in the execution record.
6. In `tagging.ts`, keep `validateObservationExport`, `studyFromExport`, the v1-v4 types and validators, `TagAttackFields`, `StoredTag`, `SavedAttack` and `attackFieldsOf` (needed by the conversion), and remove `IntervalScope`, the interval derivation, `groupKey` and `resolveTags` if nothing imports them.

Update `app/tests/app.spec.ts`: remove the tagger cases that drive the removed controls; phase 88 writes the new ones.

**Focused checks**

`npx tsc --noEmit -p app` after each group. `npx vitest run src/research` at the end.

**Acceptance**

Every listed module is removed or trimmed, no dead export remains in `research/` (check with `npx oxlint` through `npm run verify`), the Queen observation file still loads, and `npm run verify` passes once at the end of the phase.

## Execution Record

Status: complete (2026-11-13), except one blocked visual check (see Manual checks). `npm run verify` is deferred to the end of plan V20 on the coordinator's instruction.

**86.1.** `TrackPanel.tsx` renders the Attacks step: a numbered track list (positions 1-9 show their digit, a tenth or later track shows a dot and is selected by click) with id, segment label, `ProjectileSprite`, mark count and `cadenceSource`; "Add attack" (id plus segment select), "Duplicate", "Delete" with a second-click confirmation, and "Reload from game". "Reload from game" reports how many tracks with marks it kept. `AttackEditor` moved to `AttackEditor.tsx`, and `CommitInput` moved to `CommitInput.tsx` so the editor no longer depends on `TypedFieldControls.tsx`. The route applies an editor change through the new pure `changedAttack` in `monsterDraft.ts` and then `setTrackAttack`, with `"typed"` for a cadence field and the current source otherwise. A segment select beside the editor calls `setTrackLocation`. Digit keys select a track, and `0` selects scratch. `monsterDraft.ts` gains `changedAttack` and `newAttack`; `editAttack` and `addAttack` now delegate to them. `studyEdits.ts` gains `reloadTracks`.

**86.2.** The route wires three keys: Enter (`addMark` of kind `"volley"`, on the selected track or on scratch), X (`setEndMark`) and Delete/Backspace (`removeMarkNear` with a tolerance of `2 * volleyStepTolerance(frameRate)`). All three pass the existing presented-frame guard (`markAtFrame`, T19), and X ignores auto-repeat like Enter. `TrackPanel` shows the selected track's marks table in time order (the time seeks, and each row has Remove), a line for the end mark, and the scratch section. That section has checkboxes and "Create attack from selected marks", which calls `createTrackFromScratch`. `[` and `]` step between the selected track's marks, or between every mark when no track is selected.

**86.3.** `FitPanel.tsx` shows the four-row fit table. Each row has the fitted value (a time to three decimals, or an E06 sentence when null), the current value and Accept. Below it are Accept all, a line with the volley and complete-burst counts and the largest residual (in frames when the rate is known), and the threshold field. The field shows when the automatic split is ambiguous, when an override is set, or after "Set threshold"; a blank clears the override. `cadenceFit.ts` gains `MAX_PREDICTED_VOLLEYS_PER_WINDOW` (2000, a guard, not a game value) and `predictedTimesInWindows`, which the route passes to `timelineRows` as `predicted`.

**86.4.** `draftPreview.ts` gains `projectilesOfVolley`, `windowsFromBoundaries`, `observedPreviewAt` and `fittedPreviewAt`. `draftPreviewAt` now draws through `projectilesOfVolley`, and its existing tests, including the simulation comparisons, pass unchanged. `PreviewProjectile` and `PreviewDetonation` gain `ghost?`. `previewDraw.ts` draws a ghost at `GHOST_ALPHA` (0.35) and restores the alpha afterwards. `PreviewPanel.tsx` now takes `study`, `segments`, `windows` and `selectedTrackIndex`. It has an Observed/Fitted/Both `Segmented` control (default Both) and no tuning section. A drawn projectile's `tagIndex` is its track's index in the study, so the selected track's projectiles get the highlight ring.

**86.5.**

- Deleted, with their tests where they had any: `TypedFieldControls.tsx`, `SavedAttackPanel.tsx`, `savedAttacks.ts`, `repeat.ts`, `tuning.ts` and `DraftPanel.tsx`.
- The route no longer has the Tag panel, the Tags table, the Summary, the sticky state or the tuning props.
- `previewModel.ts` keeps only `emitterTilesOf`, `initialHeadingSliderDegrees`, `poseAtAge`, `evenDrawsFor`, `drawnLifetimeSeconds` and the `Preview*` types, and its test covers only those.
- `matchTagAttack` and the pattern helpers it uses were copied into `studyMigrate.ts` as private functions. A new private `authoredAttackFromLegacyTag` there now does the legacy conversion's matching. `authoredAttackFromTag` and `attackJson` were then removed from `exportAttack.ts`.
- `projectileVariantOf` is exported, and `exportAttack.test.ts` now tests it directly.
- `tagging.ts` lost `IntervalScope`, `IntervalSummary` and `summarizeTags`; `taggingOptions.ts` lost `formatSummaryRow`. Their tests were trimmed to match.
- Eleven help texts and `studySections`, which nothing used any more, were removed.

Decisions:

- `windowsFromBoundaries` takes only the windows. The prompt's `blocks` parameter had no use, and an unused parameter would be lint noise.
- `projectilesOfVolley` also takes `epochSeconds`, because the ring phase and `secondsSinceEpoch` count from the window epoch. It also takes `tagIndex` and an optional `ghost`.
- An observed mark outside every window of its track draws with burst and volley index 0, counted from the mark itself.
- A track made by "Add attack" or from scratch marks uses `NEW_ATTACK_DEFAULTS` and starts with `cadenceSource: "typed"`. Those defaults are an input convenience for the person, not authored values.
- The track delete button sits below the track list. `AttackEditor` renders its own delete only when `onDelete` is passed, and `TrackPanel` does not pass it. This is the only change to the editor.
- `reloadTracks` puts a kept marked track at the file's position for its id. A marked track whose id the file no longer has goes at the end.
- `attackFieldsOf` moved to `taggingOptions.ts`, beside `conformAttackFields`, which it uses. Moving it to `tagging.ts` would have created an import cycle.
- `groupKey` and `resolveTags` stay, because `taggingOptions.ts` and the legacy conversion still import them.
- Phase 88 (`studyExport.ts`) is not implemented, so the monster-draft functions stay as rule 5 of step 86.5 says. These are `MonsterDraft`, `loadMonsterDraft`, `setAnchor`, `clearAnchor`, `activeDraftAttacks`, `monsterFileText` and the edit functions. `draftPreviewAt` stays for the same reason.
- Some tag-era helpers stay in `taggingOptions.ts`; only the legacy session code and their own tests use them, and this phase does not list them. CSS classes of the removed panels stay in `TaggerRoute.module.css`.
- `app/tests/app.spec.ts` had no tagger test left that drove a removed control, because phase 85 had already replaced them. One test was added for this phase's manual checks: "the attacks step marks volleys by key, fits them and accepts the fit".

**Checks.**

- The new tests were seen failing first: `TrackPanel.test.tsx`, `FitPanel.test.tsx`, the step 86.4 cases in `draftPreview.test.ts`, `reloadTracks`, `changedAttack` and `newAttack`, and `predictedTimesInWindows`.
- `npx vitest run src/research`: 411 passed.
- `npx tsc --noEmit -p tsconfig.app.json` passed after each removal group. Note that `-p app` (the root `tsconfig.json`) checks nothing because it uses project references.
- `npx oxlint src/research tests`: no findings.
- `npx vite build`: passed.
- Playwright (`--grep`): the new Attacks-step test and the three existing tagger tests passed, 4 of 4.
- `npm run verify`: not run. On the coordinator's instruction it is deferred to the end of plan V20.
- Nothing under `app/src/game/` changed, and `docs/killer-bee-queen-observations.json` is unchanged.

**Manual checks.**

- 86.2, performed through Playwright on the generated test clip. Key 1 selects the first track. Enter at three frames adds three rows to the marks table. X shows the end mark. Delete at the playhead removes the latest mark. The step status reads "2 marks on 1 tracks".
- 86.3, performed through Playwright. The fit line updates to "3 volleys" as marks are added, and Accept all sets the track's cadence source to "fitted".
- 86.4, partly performed. Observed and ghost drawing is covered by unit tests, and the preview renders during the Playwright runs.
- Blocked: nobody looked at the canvas or the timeline by eye, so the ghost alpha and the ghost ticks moving after an accept are unchecked.

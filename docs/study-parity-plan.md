# Study-To-Game Parity - Draft Plan

Status: **draft, not approved, not registered.** This file is the input to a later `/brainstorm`. That run settles the open decisions below, assigns the plan number, phase numbers and decision prefix, and adds the row to `implementation-plan.md`. The user ranked this work ahead of [the custom content plan](custom-content-plan.md) on 2026-11-18. Nothing here may be implemented until the plan is approved. Process rules live in [`implementation-plan.md`](../implementation-plan.md) and [`AGENTS.md`](../AGENTS.md).

## Goal

What the tagger preview draws in Observed mode for [the solo-nest study](killer-bee-queen-study-TFclwuPtC94.json) is what the game fires: the same volleys at the same times, measured from the same phase start. The scope is shot timing and cadence only. Monster positioning and movement are out of scope.

## How the gap was found

`app/src/research/study-game-parity.test.ts` measures three things on the committed study and the shipped Queen file:

1. **Guard: the game fires the fitted preview's volleys.** For each track whose segment the video shows, the test drills the track's phase in the real simulation (seed 1, god mode, its sub-phase forced active) and records each volley's time after the attack clock's epoch. These times equal the timeline's predicted ticks (`predictedTimesInWindows`, the same formula as `draftVolleysLiveAt`) for the track's `attack.cadence`. 60 of 60 pass.
2. **Telegraph parity.** Each boundary's measured telegraph (`telegraphEndSeconds - timeSeconds`) against the shipped segment's `telegraphSeconds`. 14 of 14 fail, kept as `test.fails`.
3. **Cadence parity.** For each track with volley marks, the marks in its first window, as seconds after that window's epoch, against the game's volleys after its own epoch. The tolerance is one video frame plus one simulation step. 46 of 46 fail, kept as `test.fails`. Each failure message prints both lists as the counterexample.

The guard passing means the simulation, the fitted preview and the export are consistent with each other. The shipped Queen file is also byte-equal to the study's export (`studyExport.test.ts`). **The loss happens before export:** the Observed preview draws the marks, but the game only ever receives `track.attack.cadence` and the authored segment values, and neither one encodes the marks.

## Findings

Each finding is a recorded failing contract test (plan V22 A10): seed 1, path `app/src/research/study-game-parity.test.ts`.

### P01 - The measured telegraph never reaches the game

The preview anchors each window at the boundary's `telegraphEndSeconds` (`segmentWindows`, `study.ts:166`). The game anchors each attack clock at phase entry plus the authored `telegraphSeconds` (`createAttackClocks`, `phases.ts:32`). The export copies a telegraph only from `acceptedSegmentValues`, and this study accepts none, so every attack in the game fires early or late by the difference:

| Segment | Measured telegraph (s) | Shipped (s) | Game offset (s) |
| --- | --- | --- | --- |
| phase-1/circle-room | 0.033 | 1 | +0.97 late |
| phase-2/yellow, red, yellow | 1.77, 1.80, 1.83 | 1 | about 0.8 early |
| phase-3 | 1.467 | 2 | +0.53 late |
| phase-4 | 3.067 | 2 | 1.07 early |
| phase-5/red, yellow | 5.233, 2.233 | 1 | 4.23 and 1.23 early |
| phase-6 | 4.067 | 2 | 2.07 early |
| phase-7/blue, red, blue, yellow | 5.0, 3.23, 3.27, 4.53 | 1 | 2.2 to 4.0 early |
| phase-8 | 1.033 | 2 | +0.97 late |

The cadence test removes this offset by measuring each side from its own epoch. The players' experience includes it.

### P02 - Marks are tagged but the cadence is never refitted

Most tracks still carry the cadence they had before tagging. 37 of the 46 tracked attacks are `cadenceSource: "authored"`. The other 9 are `"typed"`, and 6 of those, the phase 6 machine-gun tracks, hold the placeholder `cooldown 1 s, delay 0`. The Observed preview draws the marks, so the preview looks right while the game runs the stale values. Examples (marks against the shipped values):

- phase 6 `machine-gun-10-shots`: 133 marks every 0.2 s starting 2.0 s after the epoch. The game fires every 1 s from 0.
- phase 3 spirals: marks every 0.4 s starting 2.367 s after the epoch. The game fires every 0.4 s from 0.
- phase 1 `blue-bomb-ring`: marks every 0.8 s. The game fires every 2.8 s.
- phase 2 `yellow-ball-spiral`: marks every 0.4 s. The game fires every 1.28 s.

Nothing in the tagger or the export says that a track's cadence disagrees with its own marks.

### P03 - The fit is not good enough to rely on

The fit in `cadenceFit.ts` would fix only 6 of the 46 tracks within two frames if every value were accepted: `red-glaive-wave`, `bee-shot-burst-occasional`, `red-glaive-ring`, `red-stinger-large-ring`, `yellow-glaive-ring` and `yellow-stinger-large-ring`. Two defects in the fit itself:

1. **The period is the median of gaps quantised to frames.** A 30 fps video gives gaps of 0.2 and 0.233 s for a true period near 0.207 s. The median picks 0.2, and the error accumulates over a long stream. `machine-gun-10-shots` (133 marks) drifts until 14 marks are more than two frames off. The phase 3 spirals (36 marks, median 0.4 s) leave 27 marks unmatched. A least-squares fit of time against volley index has no such drift.
2. **The residual is measured from each group's first mark, not from the epoch plus the initial delay.** `maxResidual` (`cadenceFit.ts:146`) restarts at `times[0]`, and `initialDelaySeconds` is clamped to at least 0. A fit can therefore show a residual of 0 and still fire offset in the game. The residual that matters is the one the game will produce.

### P04 - An attack cannot stop before its segment ends

The game fires every attack from its epoch until the segment ends. The shipped phase 6 comment already says so: *"All seven attacks fire for the whole phase, because an authored attack has no start or end time within its phase."* The video shows attacks that start late and stop early:

- phase 6: `machine-gun` (1 shot per arm), `-9-shots` (3), `-5-shots` (5), `-7-shots` (7) and `-9true-shots` (9) each fire two volleys 0.2 s apart, staggered 0.4 s apart. `-10-shots` then streams for the rest of the phase. The game fires all six every second for the whole phase, so the escalation becomes a wall of stingers. This is the "completely off" phase 6.
- phase 1 stinger spreads, phase 2 `yellow-stinger-spread-2`, phase 7 `red-ball-ring`, `hive-spiral-ring`, `hive-range-ring` and the blue stinger spreads: the marks match a period, but the attack stops well before its window ends, and the game keeps firing (between 1 and 19 extra volleys per window).

The study already holds an end mark per track (`AttackTrack.endSeconds`). The export drops it, and `AuthoredAttackCadence` has no field to receive it.

### P05 - Some observed schedules are not periodic at all

No single `shotsPerBurst`, `shotIntervalSeconds` or `cooldownAfterLastShotSeconds` reproduces these within two frames, whatever the fit:

- phase 5 `red-ball-stream-scatter`, `ccw-red-ball-stream-scatter`, `yellow-bee-shot-spiral`: bursts of uneven length (fit residual 0.43 to 0.67 s).
- phase 3 `white-bomb-compass-ring` (residual 0.9 s), phase 5 `red-hive-spiral-shotgun` (1.47 s), `yellow-hive-shot-ring` (0.38 s), phase 7 `red-bomb-ring-2` (0.7 s).
- tracks with two windows that do not share one cadence: phase 2 `yellow-ball-spiral`, `white-bomb-ring`, phase 7 `blue-glaive-spiral`, `blue-ball-ring`.

### P06 - Study data the game cannot express

These need re-tagging or a decision, not code:

- **Duplicate marks** (two marks in the same frame): `red-stinger-spread`, `blue-stinger-spread`, `machine-gun-9-shots`. The Observed preview draws the volley twice.
- `target-white-bomb`: 6 marks, 4 of them in the same frame as another. This is several bombs in one volley, which is a pattern count, not a cadence. The fit returns a cooldown of 0.
- **Marks before the epoch**: `red-stinger-wide-spread` and `red-bomb-ring-2` each have a mark one frame before their window's telegraph end. The game cannot fire during a telegraph, because `initialDelaySeconds` is at least 0.

### P07 - Segment timing and order differ from the video

These change when attacks fire, but no test covers them yet:

- **Segment length.** Phase 6 runs for 29.07 s after its epoch in the video. The game exits it 29 s after entry, which is 27 s after its 2 s telegraph, so the last 10 `machine-gun-10-shots` volleys never fire. Sub-phase durations are 10 s and 15 s in the game. In the video they last 6.5 to 22.4 s.
- **Sub-phase order.** The game cycles sub-phases in authored order: red, blue, yellow. The video shows phase 2 as yellow, red, yellow; phase 5 as red, yellow; and phase 7 as blue, red, blue, yellow.
- **Unobserved segments.** The blue sub-phases of phases 2 and 5 never appear in this video. Their 8 tracks ship authored values that no measurement supports.
- **Tracks with no marks.** 22 tracks have no marks, but the game fires them. The Observed preview draws nothing for them. In phase 6 this includes `stinger-machinegun`, which fires every 0.1 s for the whole phase.

## Decisions (user, 2026-11-19)

1. **Schedule (P04, P05): both, per track.** An attack keeps its periodic cadence plus an optional `cadence.stopAfterSeconds`, counted from the epoch and exported from the track's end mark. A track whose periodic fit misses its marks by more than the parity tolerance (about two frames) exports an explicit `cadence.volleyOffsetsSeconds` instead: the volley times after the epoch, taken from the marks, replacing the periodic fields. This is a gameplay schema change that needs a `rulesVersion` bump and a new rules fingerprint (plan V22 A12).
2. **Segment values (P01, P07): apply automatically.** Export always writes the measured telegraph, sub-phase duration and phase `exitAfterSeconds` from the boundaries, as the median across a segment's windows. An accepted value still wins over the measurement. The parity report shows each change so a misplaced boundary is visible.
3. **Sub-phase order (P07): keep the authored cycle.** No rule change. Only timing inside each sub-phase is fixed. Following the video's order is recorded for the deferred register when this plan is registered; one video is weak evidence for a fixed order.
4. **Tracks with no marks (P07): drop from export.** Export writes only tracks with at least one volley mark. This includes phase 6 `stinger-machinegun`. A segment the video never shows (the blue sub-phases of phases 2 and 5) then exports with no attacks; see Risks.
5. **Phase 6 stays six tracks.** Under decision 1 the six machine-gun tracks, each with its own start delay and stop time, reproduce the escalation. A per-volley shot count is not proposed.

## Phases

### Phase A - Tests (done in the working tree, uncommitted)

`study-game-parity.test.ts`, as described above. When a phase below fixes a finding, its `test.fails` entries flip to passing, and the `test.fails` marker is removed in the same change.

### Phase B - Parity report in the tagger (pure, no game change)

Move `observedOffsets`, `gameOffsets`' expected-times half and `firstMismatch` into a pure `research/parity.ts`. It compares each track's marks against the predicted volleys of its current cadence, measured from the window epoch, and does the same for each boundary's telegraph against its segment's. The test then calls it. The Export step shows the report: the segment values export will change (decision 2), the tracks it drops (decision 4), and which tracks export as scripted (decision 1). After phases D and E a mismatch can only come from bad study data (P06), so export refuses while one remains. This turns "make sure the JSON is implemented one to one" into a check that runs on every export, not only in this one test.

### Phase C - Fit corrections (pure, research only)

Fix P03: fit the period by least squares over volley index, and measure the residual from the window epoch plus the initial delay, with the same tolerance as the report. Add property tests: a synthetic periodic stream quantised to 30 fps refits within one frame over 200 volleys, and a residual of 0 implies the parity report passes.

### Phase D - Segment values (decision 2)

Per decision 2, export writes each segment's measured telegraph, sub-phase `durationSeconds` and phase `exitAfterSeconds` (the median across that segment's windows) unless an accepted value overrides it. Per decision 4, export drops tracks with no volley marks. This flips the 14 telegraph tests. It changes gameplay data, so the `rulesVersion` and fingerprint change here too.

### Phase E - Game data schema (decision 1)

Add the chosen cadence field or fields to `AuthoredAttackCadence`, `validateAttack`, `attackSpecFromAuthored`, `updateAttackClock` (`simulation.ts:873`), `draftVolleysLiveAt` and `predictedTimesInWindows`, so the guard test keeps the game and the preview on one formula. Export it from `track.endSeconds` and the marks. Bump `rulesVersion` and the fingerprint. Run `npm run bench`, because `simulation.ts` is on the hot path.

### Phase F - Re-tag and re-export the study (user work)

Remove the duplicate marks, resolve `target-white-bomb` and the pre-epoch marks (P06), accept or script every track, then export. The cadence tests for this study should then pass, and the shipped Queen file is replaced by the export.

## Not in this plan

Monster positioning and movement; the order of attacks inside one volley; scatter randomness, which the preview draws evenly and the game draws from its generator; and projectile motion, which an existing preview test already shares with the game.

## Risks

- The parity test runs the simulation for every track: about 16 s alone and 43.5 s inside the full `npm run verify` run, the slowest file in the suite. The slow-test gate did not flag it on 2026-11-18. If it does later, or CI time matters, cap the drill span or split the file.
- A scripted track (decision 1) makes that attack video-specific. A second video of the same fight with different timing cannot be merged into one script.
- Dropping unmarked tracks (decision 4) leaves the blue sub-phases of phases 2 and 5 with no attacks, so the game fires nothing for 10 to 15 s in each. A later video that shows them must be tagged before the next export, or the export must keep the shipped attacks of a segment that has no window. That choice is for the `/brainstorm` run.
- Applying measured values automatically (decision 2) means one misplaced boundary changes the game on the next export without a prompt.
- Moving telegraphs and durations changes how hard every phase is. The difficulty of the Queen changes, and saved best attempts stop being comparable across the `rulesVersion` bump.

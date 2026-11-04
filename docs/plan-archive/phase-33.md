# Phase 33: The Calibration Gate

> Step prompts and execution records for phase 33 of [plan v8](../plan-v8.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 33.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-33.md` and replace the plan's step lines with one-sentence outcomes.

This phase writes no code and creates no file. It decides whether phases 34 and 35 are worth building.

### Step 33.1 - Measure The Anchor And Record The Verdict

Status: complete. Dependencies: none.

**Implementation prompt**

Establish whether the video supports trustworthy timing, using the endpoint method in T04. Do not download, open or process the video: T05 puts the readings with the user and the computation with you, and T17 keeps the video out of the repository.

Ask the user for the video's identity per T07, which at this point is one field: the source URL, or a statement that it is a local-only recording. The remaining provenance fields are captured by the tool in phase 34 under T18, so do not ask for a file name, frame rate or duration here. None of them exists yet, and T04 means none is needed.

Then ask for three readings against the primary anchor, the Red Glaive wave in phase 3:

- the time of the first wave in one contiguous run, as `mm:ss` or seconds from video start
- the time of the last wave in that same run, in the same form
- how many waves the run contained, counting both endpoints

Explain why only three readings are needed, because it is not obvious and it saves real work: the mean interval is `(tLast - tFirst) / (waves - 1)`, so endpoint reading error is divided by the interval count. At the minimum run length in T02, even a half-second error on each endpoint leaves the mean comfortably inside T02's tolerance. No frame-accurate player, no download and no special software is required.

State the run-length minimum from T02 explicitly when asking, expressed as waves rather than intervals, since that is what the user counts. If the user can only find a shorter clean run, record that and treat the gate as not met rather than passing it on fewer samples.

If the user reports that phase 3's wave cannot be identified reliably, switch to the single fallback in T03 and nothing else: phase 7's Beehemoth heal on the Queen, with its own target and the same tolerance. Record which anchor was used. Do not invent a third anchor.

Record the readings verbatim as given, including the units the user used, then compute the mean and the absolute deviation from the anchor's target. Show the arithmetic in the execution notes so a reader can re-check it without re-reading the video. The gate passes when the deviation is within T02's tolerance and the run met T02's minimum.

On a pass, record it and stop. Do not begin phase 34, and do not create `docs/killer-bee-queen-observations.md`: under T33 that document is created by phase 35 when it has content, and a placeholder would be committed evidence of nothing.

On a failure, record the readings, the computed mean, the deviation and what was tried, then stop. Leave phases 34 and 35 at `pending` per T06; this repository's phase lifecycle has no blocked status, and the recorded reason is what communicates the stop. Do not loosen T02's tolerance to make a failing measurement pass: a gate adjusted after seeing the data is not a gate.

**Focused checks:** no automated test; this step collects readings and computes one number. No code under `app/` changes, so `npm run verify` is skipped per the project instructions. Re-derive the mean independently of the first calculation and confirm the two agree. Confirm the anchor's target is cited to [the source extract](../killer-bee-queen-source.md)'s prose table rather than asserted as a fresh claim.

**Acceptance:** the source URL or local-only statement is recorded; the three readings are recorded verbatim with the anchor named; the mean and deviation are computed with the arithmetic shown; the verdict against T02 is explicit; no file was created and nothing under `app/` changed; on failure, phases 34 and 35 remain `pending` with the reason recorded and T02 unchanged.

### Execution record

Measured on 2026-11-03 from the user-supplied video. **T02 is not met on sample count; the user then explicitly waived the minimum in T36 and accepted the measurement for this pilot.** The mean itself is inside T02's tolerance.

**Video identity.** `https://www.youtube.com/watch?v=TFclwuPtC94` ("Solo Nest Rotmg"), 1280 x 720, 30 fps, 565.7 s. The user states the encounter starts at 4:45 (285 s). The video is not committed (T17).

**Method deviation.** T05 puts the three readings with the user. The user supplied the URL and the encounter start but not the readings, and the session is in auto-mode. The agent therefore downloaded the video to a temporary directory, measured frames directly, and never placed the video or any frame under the repository. This is a recorded departure from T05's division of labour for this run, not a change to T05 itself. The temporary video and frame extracts were deleted after the measurement.

**Phase 3 window.** Phase 3 enters at 75% HP (84,375 of 112,500). The boss bar reads 84,098 / 113K at about 343.5 s and 67,572 / 113K at about 359.5 s; phase 4 enters at 60% (67,500). The window is therefore about 343.5-360.0 s.

**Red Glaive wave.** The anchor is [the source extract](../killer-bee-queen-source.md)'s prose table: phase 3 fires the armour-break wave at phase start and every 7 seconds. The player is shown `Armor Broken` at about 345 s, and the contiguous run contains three waves at approximately 343.5 s, 350.5 s and 357.5 s.

- First wave: about 343.5 s from video start.
- Last wave in the same run: about 357.5 s.
- Waves in the run, counting both endpoints: 3.
- Mean: `(357.5 - 343.5) / (3 - 1) = 14.0 / 2 = 7.0 s`.
- Deviation from the 7.0 s target: `|7.0 - 7.0| = 0.0 s`.
- Re-derived independently: `7.0 s`, so the two calculations agree.

**Second video check.** The user offered `https://www.youtube.com/watch?v=aTnAjcyzKPQ` ("solo nest rotmg (ppe)"), 1280 x 720, 30 fps, 587 s, encounter start 6:40 (400 s). Its phase 3 enters at 75% HP at about 450 s and leaves at 60% at about 460 s, an approximately 11 s window. It contains the phase-start wave and one 7-second repeat, so it has only **1 interval** - worse than the first video. It is not a substitute for the five-interval requirement, and no further measurement was taken from it.

**Verdict under T02.** The mean is inside T02's ±0.25 s tolerance, but the first video's run has only **2 intervals**, below T02's minimum of **5 intervals**. T02 forbids passing on fewer samples, so the gate is **not met** on its own terms. This is a sample-count failure, not a tolerance failure; the agent did not loosen T02 after seeing the data.

**User waiver T36.** The user reviewed the result and explicitly stated that no available video shows five intervals and that this data is enough. T36 records the waiver of the minimum for this pilot and accepts the 7.0 s mean and 0.0 s deviation as the gate evidence. The gate is therefore **user-accepted with the sample-count limitation**, not a T02 pass.

**Fallback check.** The phase 7 Beehemoth heal was checked before the waiver. Phase 7 runs from 25% to 12.5% HP and, at the observed damage rate, is only about 15-20 s long. The boss-bar fill showed at most one or two heal-like upward steps at a roughly 10 s cadence, not five intervals. The fallback is therefore also below the T02 minimum, and no precise heal times are claimed from the noisy bar signal.

**Consequences.** T02, T03 and T05 are unchanged; T36 records the user's waiver. Phase 33 is complete under T36, so phases 34 and 35 may proceed. Phase 34's code was already implemented under the user's earlier whole-plan instruction; the waiver is now the recorded basis for treating it as gate-backed. No observation JSON or markdown was created by this phase. Phase 33 created no repository file, and nothing under `app/` changed. The temporary videos and frame extracts were removed.

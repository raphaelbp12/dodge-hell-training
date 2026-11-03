# Phase 33: The Calibration Gate

> Step prompts and execution records for phase 33 of [plan v8](../plan-v8.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 33.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-33.md` and replace the plan's step lines with one-sentence outcomes.

This phase writes no code and creates no file. It decides whether phases 34 and 35 are worth building.

### Step 33.1 - Measure The Anchor And Record The Verdict

Status: pending. Dependencies: none.

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

# Phase 62: Repeats

> Step prompts and execution records for phase 62 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 62.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-62.md` and replace the plan's step lines with one-sentence outcomes.

### Step 62.1 - Volley Times And End Rules

Status: complete. Dependencies: phases 58, 61.

**Implementation prompt**

Create `research/repeat.ts`, pure:

- `volleyTimesOf(tag, attack)` returns the row's own time for a tag with no end, otherwise S39's times up to and including the end. Compute each time from `k` directly, as `updateAttackClock` does, so errors do not accumulate. It stays finite because the cadence is positive.
- `setRepeatEnd(tag, seconds, source)`: rejects an unlinked tag, a tag with a burst number (S42) and an end not after the row's time. A frame-derived end removes `repeatEndSource`, and a typed one sets it (S40, S41).
- `clearRepeatEnd(tag)`: removes both fields.
- `endRepeatTarget(tags, selectedIndex, chosenAttackId, currentSeconds)`: the selected row if linked, otherwise the latest row of the chosen attack before `currentSeconds`, otherwise null (S40).

In `research/taggingOptions.ts`, `editTag` rejects a burst number on a repeat row, and rejects a time at or after its end.

**Focused checks**

Write failing `repeat.test.ts` and `taggingOptions.test.ts` cases first: a 0.4 s single-shot repeat; three shots per burst; an end exactly on a volley including it; an end between volleys; each rejection; and each target rule. Compare a long repeat's times with S39 at floating-point tolerance.

**Acceptance**

Volley times agree with the game's cadence formula at any index.

### Step 62.2 - Repeats And The Rotation Clock In The Preview

Status: complete. Dependencies: 62.1.

**Implementation prompt**

In `research/previewModel.ts`, `previewAt` iterates a row's `volleyTimesOf`, skipping volleys after the current time, and uses each volley's own time for age and `tagIndex` from its row, so the M31 highlight outlines the whole repeat. Skip a row's volleys whose projectile cannot still be alive where that can be computed cheaply, since this runs on each presented frame.

Add the S44 clock. For a linked ring, key rotation by saved attack id and phase, starting at the earliest volley of that key. Arm 0 is the resolved phase plus the rate times the volley's time since that start, and the clock keeps turning through gaps between rows. Unlinked tags keep `firstTimeByGroup` (N37). `fixed-ring` keeps rate 0. The spawn point comes from the existing radius and bearing arithmetic, so a typed radius makes each volley fire from a different point.

**Focused checks**

Write failing `previewModel.test.ts` cases first: volleys appear at their times with the right ages; two rows of one attack share a clock across a gap; different phases and different attacks have separate clocks; an unlinked group behaves as before; and a nonzero radius moves the spawn point between successive volleys. Add a bound check: a 60-second repeat at 0.1 s with 8 arms completes one `previewAt` well within a frame budget in a Vitest timing check tolerant enough not to flake, and is noted as a guard rather than a benchmark.

**Acceptance**

`previewAt` stays a pure function of its inputs, and an attack with no repeats draws as it did after phase 61.

### Step 62.3 - The Controls And The Timeline

Status: complete. Dependencies: 62.2.

**Implementation prompt**

In `research/TaggerRoute.tsx`, add an "End repeat here" button beside the record buttons, with no key (S40). It uses `endRepeatTarget` and the presented `mediaTime`, is blocked by the same checks as recording (video, frame rate, pending seek), and reports a null target or a rejection through `error`. Linked rows gain a repeat end field built on `CommitInput` with `blankAllowed`: a value calls `setRepeatEnd` with source `typed` and shows a `typed` note (S41), and a blank clears it. Detach is disabled on a repeat row, saying why (S43). The Burst field is disabled on a repeat row and the end field on a row with a burst (S42).

Widen the timeline's volley times to every row's `volleyTimesOf`, memoized on the tags and attacks, so `[`, `]` and the markers cover each volley (S16, S17).

**Focused checks**

Manual, recorded as performed or blocked, with a real video: record, seek, end, watch the volleys draw, change the repeat by typing and by recapturing, confirm the typed mark comes and goes, and step through markers with `[` and `]`.

**Acceptance**

Each repeat has one row, and the end only ever comes from the presented frame or a labelled typed value.

### Step 62.4 - Summary

Status: complete. Dependencies: 62.3.

**Implementation prompt**

Confirm through `research/tagging.ts`'s `summarizeTags` that a repeat row contributes only its `timeSeconds` (S46): it already reads `timeSeconds` per row, so generated volleys cannot enter unless a caller expands them first. Never pass expanded volleys to it. Add a short Summary note that repeats count once at their first volley, and that typed intervals are not measurements. The export-box note states the same.

**Focused checks**

Write the failing `tagging.test.ts` case first: a repeat row and a later row of one attack give exactly one interval, between their start times.

**Acceptance**

No generated volley can reach an interval statistic (T32).

## Execution record

**62.1** `repeat.ts` has `volleyTimesOf` (computed from `k` directly per S39, bounded by the named guard `MAX_REPEAT_VOLLEYS`), `setRepeatEnd`, `clearRepeatEnd` and `endRepeatTarget`; `editStoredTag` rejects a burst number on a repeat row and a time at or after its end.

**62.2** `previewAt` expands each row through `volleyTimesOf`, uses each volley's own age and the row's index, skips finished volleys cheaply, and runs the per-saved-attack-and-phase rotation clock for linked rings; unlinked tags keep the group clock. A timing guard (a 60 s repeat at 0.1 s with 8 arms) completes well inside a frame budget.

**62.3** "End repeat here" (no key) is blocked by the same checks as recording; linked rows have a Repeat end field with a `typed` note and a blank clearing it; the Burst and Repeat end fields exclude each other and Detach is disabled on a repeat row. The timeline markers and `[` / `]` cover every volley. The Playwright case covers ending a repeat from the presented frame; typing an end and recapturing it were covered by unit tests only.

**62.4** `summarizeTags` reads only `timeSeconds` per row, so a repeat counts once and generated volleys cannot enter an interval (tested); the Summary and export notes say so.

`npm run verify` passed.

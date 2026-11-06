# Phase 58: The Timeline

> Step prompts and execution records for phase 58 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 58.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-58.md` and replace the plan's step lines with one-sentence outcomes.

### Step 58.1 - The Pure Model And Keys

Status: pending. Dependencies: phase 56.

**Implementation prompt**

Create `research/timelineModel.ts` with pure functions over a sorted list of volley times: `markerFractions(times, durationSeconds)`, `previousVolleyTime(times, currentSeconds, toleranceSeconds)` and `nextVolleyTime(...)`, each returning null at the ends. The tolerance is half a frame step when a frame rate is set, so a press from a marker's own frame moves on rather than landing on it again. For now volley times are the resolved tags' `timeSeconds`; phase 62 widens this.

In `research/taggingRoute.ts`, `actionForKey` returns a new `{ kind: "step-volley", direction }` for `[` and `]` (S17). These keys need no frame rate, and they are ignored while an editable field is focused, like every other key. Update the function's doc comment.

**Focused checks**

Write failing `timelineModel.test.ts` and `taggingRoute.test.ts` cases first: empty lists, both ends, ties at one time, and pressing from exactly on a marker.

**Acceptance**

The model depends on no DOM or React, and `[`/`]` work with no frame rate typed.

### Step 58.2 - The Bar

Status: pending. Dependencies: 58.1.

**Implementation prompt**

Create `research/TaggerTimeline.tsx`, rendered beside the transport row of `TaggerRoute`:

- An `<input type="range">` scrubs across the video's full duration, with a single canvas behind it drawing one marker per volley (S15, S16). No DOM element per marker. Scrubbing calls the route's one seek path, `seekTo` (Z22), which keeps recording blocked until the frame appears (T19).
- A go-to-time number field commits on Enter or blur through the same seek path and restores its text on rejection, using the existing `CommitInput`.
- The route's `step-volley` action seeks to the model's result and does nothing at the ends.

The playhead is the range input's value, which reads the presented `mediaTime`, never a seek target. The bar is disabled with no video open. No zoom (S15).

**Focused checks**

Manual, recorded as performed or blocked, with a real video: scrub, go to a typed time, step with `[` and `]`, and record straight after a scrub, confirming the recorded time is the presented frame's. Confirm markers line up with their rows' times.

**Acceptance**

Tag times are still only ever taken from the presented frame, and no element is created per marker.

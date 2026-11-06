# Phase 59: Typed Geometry And Match Status

> Step prompts and execution records for phase 59 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 59.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-59.md` and replace the plan's step lines with one-sentence outcomes.

### Step 59.1 - Typed Fields

Status: pending. Dependencies: phase 57.

**Implementation prompt**

In `research/taggingOptions.ts` and `research/TaggerRoute.tsx`, add sticky controls and row edits for `coneDegrees`, `fixedBearingDegrees`, `frontOffsetDegrees` and `emitterRadiusTiles` (S22, S25), all optional and labelled as typed estimates. Follow the existing patterns: `createTag` applies a field only where the sticky pattern and aim allow it, a sticky value survives a pattern switch, `editTag` drops fields the new pattern or aim disallows, and a blank field removes the value. A cone uses `armArcProblem`'s ranges against the tag's own `spread` or `scatter`. Bearings and offsets are finite degrees, and the radius is nonnegative tiles.

**Focused checks**

Write failing `taggingOptions.test.ts` cases first: each field's creation rule, edit rule, drop on a pattern or aim change, and rejection of an out-of-range value leaving the tag unchanged.

**Acceptance**

No selection can produce a tag `validateTag` rejects.

### Step 59.2 - Geometry In The Preview And Export

Status: pending. Dependencies: 59.1.

**Implementation prompt**

In `research/previewModel.ts`, extend `withTagGeometry`:

- A typed `coneDegrees` replaces a spread's `arcDegrees` or a scatter's `coneDegrees`. A typed `emitterRadiusTiles` replaces a ring's radius.
- A tag's aim now always wins. `fixed` uses the typed bearing, otherwise the matched attack's bearing when that attack is fixed, otherwise the tag is not drawn (S23). This replaces N39's "a `fixed` tag changes nothing", which is half of the S02 bug. `front` uses the typed offset, else N39's authored offset, else 0.

`matchTagAttack` stays pure, and a tag needing a bearing returns no pattern. `authoredAttackFromTag` then cannot export it, because the export uses the same path (N43).

**Focused checks**

Write failing `previewModel.test.ts` and `exportAttack.test.ts` cases first: each typed field's effect on `resolveBearings`; a `fixed` tag on a player-aimed attack with and without a bearing; a `fixed` tag on a fixed attack; a typed front offset; and every exported result passing the game's `validateAttack`.

**Acceptance**

A `fixed` tag can never draw or export as player-aimed.

### Step 59.3 - Match Status

Status: pending. Dependencies: 59.2.

**Implementation prompt**

Add a pure `tagMatchStatus(tag, config)` in `research/previewModel.ts` returning the plan's `TagMatchStatus` (S18). `countUnmatchedTags` is reimplemented on it so the two can never disagree. In `research/TaggerRoute.tsx`:

- The Tag panel shows the status of a tag built from the current sticky selection, for example "Plays as `white-bomb-targeted`" or "Won't preview: no attack in this phase fires this sprite in this pattern".
- Each row shows the same as a short badge.
- The export box's refusal shows the same reason in place of its fixed sentence.

The sprite picker is not filtered.

**Focused checks**

Write failing `previewModel.test.ts` cases first, one per status and reason, and one asserting `countUnmatchedTags` equals the count of `wont-preview` statuses across a mixed study. Manual, recorded as performed or blocked: change sprite, pattern and phase and watch the status follow.

**Acceptance**

A person can tell before recording whether a tag will draw, and which tag is the "not previewed" one.

# Phase 54: Previewing Composites, Rotation And Front

> Step prompts and execution records for phase 54 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 54.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-54.md` and replace the plan's step lines with one-sentence outcomes.

### Step 54.1 - The Tag Wins

Status: complete. Dependencies: phases 50, 53.

**Implementation prompt**

In `research/previewModel.ts`, replace `withShots` with an exported `withTagGeometry(pattern, tag)` that `matchTagAttack` uses. Matching itself does not change (N36).

For rings:

- `arms` is the tag's `shots`.
- `armPattern` is built from the tag: absent means single, even on an authored composite; `spread` and `scatter` use `shotsPerArm` and `armArcDegrees`; `ring` uses `shotsPerArm` as its arms.
- `rotating-arm`: `clockwiseDegreesPerSecond` and `initialPhaseRadians` take the tag's typed value where present, else the authored one.
- `fixed-ring`: rate is 0.

For spread and scatter, `shots` is the tag's, and aim follows N39: a tag's `player` becomes `aim: "player"`; a tag's `front` becomes `aim: "front"` with the attack's authored offset, or 0; a tag's `fixed` changes nothing.

**Focused checks**

Write failing `previewModel.test.ts` cases first: each override; a composite tag on a plain ring; a plain tag on a composite attack; `fixed-ring` rate 0; typed versus authored fallback, each field independently; and all three aim overrides. Existing preview tests for plain tags pass, except any that encoded M05's narrower behaviour, each of which is named in the execution record.

**Acceptance**

`withTagGeometry` is pure, and M03's matching is unchanged.

### Step 54.2 - Rotation, Composite Draws And Bomb Landing

Status: complete. Dependencies: 54.1.

**Implementation prompt**

In `previewAt`:

- Compute each `groupKey` group's first tag time once per call. Set `ringPhaseRadians` to the pattern's phase + its rate × (tag time − group first time) (N37). `burstsFired` and `secondsSinceEpoch` stay 0 (N38).
- Replace the scatter draw expression with a helper that gives even draws `(i + 0.5) / shots` for each scatter instance in a pattern, in depth-first arm order, covering an outer scatter and any nested one (M09).
- Add `headingRadians` to the input and pass it as `enemyHeadingRadians`.
- For a bomb attack with `target: "player"` whose resolved pattern is one shot, land on `playerTiles` (N40). Every other bomb uses `rangeTiles`. Use `resolveBombDestination` in both `poseAtAge` and the detonation branch, removing the `undefined` argument.

**Focused checks**

Write failing cases first: two tags of one group at different times fire on rotated bearings; the first tag fires on its phase; a typed correction shifts only that tag; legacy `rotating-arm` tags now rotate at the authored rate; a `white-bomb-advance` tag draws at one angle; 12 projectiles for a 4 × 3 composite with the right tag index; even draws for a nested scatter; a front tag following the heading input; a targeted bomb and its detonation on the player point; a 3-shot tag on a targeted attack using range.

**Acceptance**

`previewAt` remains a pure function of its inputs, with no clock and no state between calls.

### Step 54.3 - The Heading Slider

Status: complete. Dependencies: 54.2.

**Implementation prompt**

In `research/PreviewPanel.tsx`, add a heading slider beside the player sliders, in degrees from 0 to 360, using a named step constant of 1 degree with its source recorded as this plan's approval. It starts at the primary archetype's `initialHeadingDegrees`, or 0, resets with the view on reload, and does not join the persisted preference (N20, M24). Pass its value to `previewAt`.

In `research/previewDraw.ts`, draw a short arrow from the emitter along the heading, in a named `PREVIEW_COLORS` entry. Keep the redraw keyed on inputs in the existing effect, so React still holds only inputs.

Update `docs/mechanics.md`, and run `npm run verify` through the `verifier` subagent.

**Focused checks**

Add a pure test for the initial value. Manual, recorded as performed or blocked, using the Queen's phase index 0 footage: a `front` tag follows the slider while a ring and a `fixed` tag do not; a composite and a rotating tag draw beside the video; and a targeted bomb lands on the player point. The existing `tagger preview panel` Playwright case still passes when run alone: `npm run test:e2e -- --grep "tagger preview panel"`.

**Acceptance**

The slider changes only `front`-aimed shots and the arrow, and `npm run verify` passes.

## Execution record

Added `withTagGeometry` (the tag wins over the matched attack: arms, arm pattern, cone, typed rotation, aim override, `fixed-ring` rate 0), group-relative rotation from the first tag of each `groupKey` group, even scatter draws for nested scatters, a `headingRadians` input with front aim, targeted bombs landing on the player point for one-shot patterns, `initialHeadingSliderDegrees`, the heading slider (1-degree step) and an emitter arrow. One existing preview test that encoded M05's narrower behaviour (`tag shots replace arms and shots`) now expects the fixed-ring's rate 0. The `tagger preview panel` Playwright case is run alone by the verifier. Manual footage checks blocked: no browser or video is available in this environment. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

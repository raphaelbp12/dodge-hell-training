# Phase 53: Tagging Composites And Typed Geometry

> Step prompts and execution records for phase 53 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 53.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-53.md` and replace the plan's step lines with one-sentence outcomes.

### Step 53.1 - The Tag Shape

Status: complete. Dependencies: phase 52.

**Implementation prompt**

In `research/tagging.ts`, add `front` to `TagAim`, and add `armPattern`, `shotsPerArm`, `armArcDegrees`, `clockwiseDegreesPerSecond` and `initialPhaseDegrees` to `Tag` (N19, N31, N34, N35). The schema version stays 2 (N32). Extend the shared `validateTag`, staying structural (T31):

- `armPattern`, if present, is `spread`, `scatter` or `ring`, and only on `rotating-arm` or `fixed-ring`.
- `shotsPerArm` is a positive integer, required with `armPattern` and absent without it.
- `armArcDegrees` is a nonnegative finite number, required when `armPattern` is `spread` or `scatter`, and absent otherwise.
- `clockwiseDegreesPerSecond` and `initialPhaseDegrees` are finite, each optional, and only on `rotating-arm`.

Add `armPattern` to `groupKey`, `MutableGroup`, `IntervalSummary` and `compareSummaries`, so a composite and a plain ring of one sprite summarize separately (N31). Rotation and arc values do not join the key.

**Focused checks**

Write failing `tagging.test.ts` cases first for each rule above, including negative rotation accepted; v1 upgrade unchanged; a v2 file without the new fields still valid and exported identically; saved-session validation picking up the rules through `validateTag`; and the grouping split. The schema test over `docs/killer-bee-queen-observations.json` passes with that file byte-identical.

**Acceptance**

Old studies load and re-export unchanged, and no reference to the encounter configuration enters the validator.

### Step 53.2 - Options, Edits And Sticky Values

Status: complete. Dependencies: 53.1.

**Implementation prompt**

In `research/taggingOptions.ts`:

- Add `front` to `TAG_AIMS`. `patternTakesAim` does not change.
- Add `armPatternAllowed(pattern)` for the two ring patterns and `rotationAllowed(pattern)` for `rotating-arm`.
- Extend `TagChange` and `editTag` with `armPattern` (null removes it and its dependants), `shotsPerArm`, `armArcDegrees`, `clockwiseDegreesPerSecond` and `initialPhaseDegrees` (null removes each). Invalid input returns an error and keeps the old tag.
- Changing `pattern` drops fields the new pattern disallows, as the aim rule does today. Changing `armPattern` to `ring` drops `armArcDegrees`, and changing it to `spread` or `scatter` without an arc returns an error asking for one.
- Add the five fields to `StickySelection`, applied to new tags only when the sticky pattern allows them (N35).

**Focused checks**

Write failing `taggingOptions.test.ts` cases first for each edit, each drop rule, the sticky copying, and a sticky rotation not reaching a `fixed-ring` tag.

**Acceptance**

No tag can be produced that `validateTag` rejects.

### Step 53.3 - Controls

Status: complete. Dependencies: 53.2.

**Implementation prompt**

In `research/TaggerRoute.tsx`, add to the sticky label controls and each row editor: an arm-pattern choice with none, `spread`, `scatter` and `ring`; shots per arm; a cone-width field labelled as a typed estimate; and rate and phase fields labelled as typed estimates, shown only when allowed. Keep the existing control style. Show `armPattern` in the live summary panel's group label.

Run `npm run verify` through the `verifier` subagent.

**Focused checks**

Manual, recorded as performed or blocked: tag a 4-arm ring of 3-shot spreads with a typed cone; add rate and phase and see them carry to the next tag; edit a row; export; reload the file; and confirm a saved session restores the fields. No Playwright case is added.

**Acceptance**

A composite with typed geometry survives export, load and autosave, and `npm run verify` passes.

## Execution record

Added the optional v2 tag fields (`armPattern`, `shotsPerArm`, `armArcDegrees`, `clockwiseDegreesPerSecond`, `initialPhaseDegrees`) and `front` aim with structural validation, `armPattern` in the grouping key, `armPatternAllowed`/`rotationAllowed`, row edits with drop rules, sticky values that never produce a tag `validateTag` rejects, saved-session validation of the new sticky fields, and tagger controls (sticky fieldsets, a Geometry column, a summary column). Schema stays 2 and `docs/killer-bee-queen-observations.json` is unchanged. Manual tagger checks blocked: no browser or video is available in this environment. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

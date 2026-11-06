# Phase 55: Export A Tag As An Attack

> Step prompts and execution records for phase 55 of [plan V15](../plan-v15.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 55.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-55.md` and replace the plan's step lines with one-sentence outcomes.

### Step 55.1 - The Conversion

Status: complete. Dependencies: phase 54.

**Implementation prompt**

Create `research/exportAttack.ts` with a pure `authoredAttackFromTag(tag, config)` returning an `AuthoredAttack`, or null for an unmatched tag (N42). It uses `matchTagAttack`, so the exported pattern is exactly what the preview draws (N43):

- `id` is the matched attack's id plus the named suffix `-tagged`.
- `projectile` and `cadence` come from the matched attack, with its target if any. `tuningSource` is `video-observation`.
- `pattern` is the resolved pattern in authored form, converting `initialPhaseRadians` back to `initialPhaseDegrees`.
- The result reports whether it aims `front`, so the caller can show N43's note.

**Focused checks**

Write failing `exportAttack.test.ts` cases first: an unmatched tag gives null; a plain tag; a composite with typed cone; typed rotation; `fixed-ring` rate 0; a front tag; and every result passing the game's exported `validateAttack`, so an exported snippet is always valid JSON for `enemies.json`.

**Acceptance**

The conversion depends on no DOM or React, and no value is invented: every field traces to the tag or the matched attack.

### Step 55.2 - The Export Box

Status: complete. Dependencies: 55.1.

**Implementation prompt**

In `research/TaggerRoute.tsx`, add an "export as attack" action on a selected row. It shows the pretty-printed JSON in a read-only text box with a copy button using `navigator.clipboard.writeText`, wrapped so a failure only leaves the box for manual copying (N41). An unmatched tag shows why it cannot export. A front-aimed export shows the note that the archetype needs `initialHeadingDegrees`. Nothing is written to any file.

**Focused checks**

Manual, recorded as performed or blocked: export a composite, paste it into a local copy of `enemies.json`, confirm the game loads it and the preview draws it, then revert the paste. The revert matters, because no shipped attack may change here (N01).

**Acceptance**

The route never writes a file, and a failed clipboard call produces no error.

### Step 55.3 - The Guide

Status: complete. Dependencies: 55.2.

**Implementation prompt**

Update `docs/tagger-guide.md`: terms for arm pattern, shots per arm and typed estimates; `front` aim; the heading slider and that it turns only front-aimed shots; how rotation is computed from the first tag in a group; why a targeted bomb lands on the player point; that per-burst advance and arm spread are not drawn; and the export flow, including that exported phase is measured at the first tag. Run `npm run verify` through the `verifier` subagent.

**Focused checks**

`npm run verify` passes. The guide's instructions match the controls as built.

**Acceptance**

A person can tag, preview and export a ring of spreads using only the guide.

## Execution record

Added the pure `authoredAttackFromTag` (id plus `-tagged`, projectile and cadence from the matched attack, `video-observation`, the preview's resolved pattern with the phase back in degrees, target kept only while still a single player-aimed shot, `aimsFront`), `attackJson`, an Export as attack action with a read-only box, a copy button whose clipboard failure only leaves the box, and the front note; every export passes `validateAttack`. Nothing is written to a file. docs/tagger-guide.md documents arm patterns, typed estimates, `front`, the heading slider, group-relative rotation, targeted bombs, excluded per-burst advance and the export flow. The paste-into-enemies.json manual check is blocked: no browser is available here, and no shipped attack was changed. `npm run verify` passed (lint, typecheck, test, build). Critic review: approved with three minor findings; the cone-range one (a scatter cone of 0 or an arc of 360 or more passing the tag check but failing `validateAttack` on export) was fixed.

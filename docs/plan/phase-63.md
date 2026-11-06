# Phase 63: Tuning In The Preview

> Step prompts and execution records for phase 63 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 63.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-63.md` and replace the plan's step lines with one-sentence outcomes.

### Step 63.1 - The Boundary And The Pure Mapping

Status: pending. Dependencies: phase 62.

**Implementation prompt**

In `AGENTS.md`'s Scope and design section, keep "a tuning UI" in the out-of-scope list and add one sentence: a development-only tagger control that edits only a study's typed estimates and never game data is not a tuning UI (S47). Make no other change to that file.

Create `research/tuning.ts`, pure: `tunableValuesFor(tag, attack)` returns the S49 values that apply, and `applyTuning(study, tagIndex, change)` routes the change (S48): a linked row edits its saved attack, and an unlinked row edits only that row through `editTag`. A `fixed-ring` has no rate. Cadence values exist only for a linked row. The S28 cadence rule applies, and a change from 1 to 3 shots per burst with no interval yet is rejected until one is typed. Add the named constant `TUNING_RATE_SLIDER_MAX_DEGREES_PER_SECOND = 720`, documented as an input convenience with no gameplay meaning, approved in S50.

**Focused checks**

Write failing `tuning.test.ts` cases first: each pattern's values; a linked edit reaching every resolved tag of that attack and no other; an unlinked edit reaching one row; a rejected value leaving the study unchanged; and values beyond the slider's bound accepted.

**Acceptance**

The mapping depends on no DOM or React, and nothing here imports a game data writer.

### Step 63.2 - The Controls

Status: pending. Dependencies: 63.1.

**Implementation prompt**

In `research/PreviewPanel.tsx`, add a tuning section under the sliders, fed by props from `TaggerRoute`: the selected row's `tunableValuesFor` plus an `onChange`. It states what it edits ("Tuning saved attack `<name>`: 12 tags" or "Tuning this tag only"), labels values as typed estimates, and shows a hint when no row is selected (S48). Every value is a number field. The rate also gets a range slider bounded by the named constant (S50), and a typed number outside the bound leaves the slider at its end. Each change updates React state, autosave and the preview on the next render. The preview keeps reading `mediaTime` as its only clock, so tuning while paused redraws the frozen frame with no second clock (M01).

**Focused checks**

Extend `tuning.test.ts` for anything pure added here. Manual, recorded as performed or blocked: with a repeat paused mid-pattern, drag the rate and watch every arm move; change the phase, radius and cadence; select an unlinked row and confirm only it changes; reload and confirm the values were saved.

**Acceptance**

Tuning redraws only through the existing preview effect, adds no per-projectile React state, and changes no file under `app/src/game/`.

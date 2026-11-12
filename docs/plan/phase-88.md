# Phase 88: Reconcile, Export And Guide

> Step prompts and execution records for phase 88 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 88.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-88.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase builds the Reconcile step and the export (E13, E18), writes the Playwright coverage and the guide, and runs the acceptance. Nothing under `app/src/game/` changes.

### Step 88.1 - The Reconcile Panel

Status: pending. Dependencies: phase 87.

**Implementation prompt**

Create `app/src/research/ReconcilePanel.tsx`, rendered in the Reconcile step, with three sections:

1. **Warnings.** `studyWarnings(...)` as a list, each row naming `where` and `text`; clicking a row whose text contains a time seeks there. The step bar's Reconcile status shows the count.
2. **Segments.** One row per segment that has at least one boundary: its label; measured telegraph (median of `telegraphEndSeconds - timeSeconds` over its boundaries that have one, else "not measured"); measured invulnerable (median of span durations whose in is within one frame of one of its boundaries, else "not measured"); measured duration (median window length over its boundaries, for a sub-phase only); the authored value of each beside it; and an "Accept" per measured value calling `acceptSegmentValue`, plus "Clear" when accepted. A `durationSeconds` accept is offered for sub-phases only (E13).
3. **Attacks.** One row per track: id, segment, `cadenceSource`, the four cadence values, and for a bomb the override's flight time and range. This section is read-only; the Attacks step edits them.

Add help texts for each section in `helpText.ts` using glossary words.

**Focused checks**

A new `ReconcilePanel.test.tsx` renders a study with one boundary carrying a telegraph end and asserts the measured telegraph shows with three decimals and "Accept" calls back with `("telegraphSeconds", value)`; a phase-level segment shows no duration Accept.

**Acceptance**

The panel shows the warnings and the measured values, accepting records them in the study, and the tests pass.

### Step 88.2 - Export

Status: pending. Dependencies: 88.1.

**Implementation prompt**

Create `app/src/research/studyExport.ts`:

```ts
/** E13: the monster's whole file with every attack list replaced from the tracks and the accepted segment values applied. */
export function monsterFileTextFromStudy(input: Readonly<{
  archetypeId: string;
  study: StudyV5;
  currentRawFile: unknown;
  config: EncounterConfig;
}>): DraftResult<string>;

/** E08, E09: a projectile variant entry for a bomb track with an override, or null without one. */
export function bombVariantOf(track: AttackTrack): Readonly<{ id: string; entry: Record<string, unknown> }> | null;

/** The study JSON text, with `recordedAt` refreshed. */
export function studyExportJson(study: StudyV5, recordedAt: string): string;
```

`monsterFileTextFromStudy` follows `monsterFileText` in `monsterDraft.ts`: `structuredClone` the raw file; for each raw phase set `phase.attacks` to the `attack` of every track whose location is `{ phaseId, subPhaseId: null }`, in track order, and each raw sub-phase's `attacks` likewise; a track whose location names a phase or sub-phase missing from the file fails with "Track <id> is in segment <label>, which is not in the file."; then for each `acceptedSegmentValues` entry, set `telegraphSeconds` and `invulnerableOnEnterSeconds` on the phase or sub-phase it names and `durationSeconds` on a sub-phase only, ignoring a `durationSeconds` on a phase. A track with a `projectileOverride` exports its attack with `projectile` set to `bombVariantOf(track).id`, which is `<attack id>-measured`. Validate with `validateArchetypes` and `validateAttackSpec` exactly as `monsterFileText` does, and return the pretty JSON with a trailing newline.

`bombVariantOf` builds the entry from `AUTHORED_PROJECTILES[track.attack.projectile]` the way `projectileVariantOf` in `exportAttack.ts` does for a bomb, with `source: "measured from video (tagger)"` as a named constant `MEASURED_VARIANT_SOURCE`, and `rangeTiles` omitted for a targeted bomb.

In `ReconcilePanel.tsx`, add the export section: the monster file text in a read-only box with "Copy file" (copy behaviour as `DraftPanel` had), one "Projectile variant" box per bomb track with an override, with its own "Copy", and "Export study JSON" that downloads the v5 study as today's export does. Then finish step 86.5's item 5: remove `monsterFileText` and the other draft-only functions from `monsterDraft.ts`.

**Focused checks**

Failing-first tests in `studyExport.test.ts`: for each of the 12 monsters, `monsterFileTextFromStudy` on `emptyStudy` is byte-identical to the file's text as `JSON.stringify(raw, null, 2) + "\n"`; an accepted `telegraphSeconds` on a sub-phase lands on that sub-phase only; an accepted `durationSeconds` on a phase changes nothing; a bomb track with an override exports the `-measured` projectile id and a variant entry; a targeted bomb's variant has no `rangeTiles`.

**Acceptance**

The 12-monster identity test passes, the copy boxes show the texts, and the tests pass.

### Step 88.3 - Playwright And The Guide

Status: pending. Dependencies: 88.2.

**Implementation prompt**

In `app/tests/app.spec.ts`, using the generated clip from `app/tests/tagger-clip.ts`, add cases: open the tagger, load the clip, press `S` twice and see two boundary rows; press `1` then Enter three times and see three marks on the first track's row; press `I` twice and see one span; switch to Reconcile and see the warnings list; copy the file text and assert it contains the monster's first attack id. Run only these: `npm run test:e2e -- --grep "timeline tagger"`.

Rewrite `docs/tagger-guide.md` for the four steps, using only glossary words, with: Open it; Terms (as step 83.2 left it); Set up; Structure (boundaries, telegraph ends, invulnerable spans, scale calibration); Attacks (tracks, marks, the fit, the threshold, scratch); Bombs (throw and detonation marks, flight time, range); Reconcile (warnings, accepting, export); Keys (the E10 table); Limits (the emitter is fixed; one monster is drawn; an attack cannot stop before its segment ends; the detonation radius is a catalog value; the game never reads a study; pasting a file changes gameplay and is a separate approved change); and one worked example: measuring a ring's cadence from six marks and accepting it.

**Focused checks**

The targeted Playwright cases pass. A grep of the guide for "block", "sticky", "anchor" and "typed estimate" is empty.

**Acceptance**

The cases pass, every control the guide names exists under that name, and `npm run verify` passes.

### Step 88.4 - Acceptance

Status: pending. Dependencies: 88.3.

**Implementation prompt**

Run the plan's acceptance with a real video. Do not change any shipped value. In one sitting: open a Queen study from a v4 session and confirm the conversion notice and that its marks sit on tracks; mark the boundaries of two sub-phases of one phase and confirm the second was guessed; mark six volleys of one attack and accept its fit; mark a bomb's throw and detonation, calibrate the scale, measure one range; accept a telegraph on one segment; read the warnings; copy the file and compare it with `diff` against the monster's file in a scratch directory outside the repository, confirming only the accepted values and the edited attacks differ; reload and restore the session; and load `docs/killer-bee-queen-observations.json` and confirm it opens with its notice.

Record each check as performed or blocked in this phase file. Update the plan's Phase Index and archive completed phase files as the implementation plan describes.

**Focused checks**

Delegate one `npm run verify` run to the `verifier` subagent and record its result. Confirm `git status --short app/src/game docs/killer-bee-queen-observations.json` lists nothing.

**Acceptance**

Every review gate in the plan holds or is recorded as blocked. No shipped value, `rulesVersion`, test pin or snapshot changed in phases 83-88. No commit, push or deployment happens without separate authorization.

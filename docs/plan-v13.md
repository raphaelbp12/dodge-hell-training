# Plan V13: A Tagger That Can Describe And Reopen A Study

Phases 43-45. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 43-45 build and why. It is not authorization to implement a phase by itself.

The development-only video tagger can currently record only `volley` or `rotating-arm`, which merges where shots go with when they fire. It therefore cannot record a burst fired by rotating arms, which is what the user reads the Killer Bee Queen's phase-3 `bee-shot` to be. A study also cannot be reopened: an unexported session is lost and an exported one cannot be corrected. This plan separates pattern from firing timing, adds the engine's other shot patterns, and makes a study loadable, editable and recoverable. No game code, authored value, gameplay rule or rules version changes.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 43-45. Later explicit user decisions override older statements; record changes here.
- [Plan V8](plan-v8.md): the tagger's original decisions T13-T37. This plan supersedes only the ones named under Confirmed Design; all others stand.
- [The phase-3 observations](killer-bee-queen-observations.md): the pilot's "Was This Worth Repeating" verdict, which identified the burst ambiguity, the misleading frame-rate field and the loss of unexported work.
- [The phase-3 retune design](superpowers/specs/2026-11-03-killer-bee-queen-phase-3-retune-design.md): records the single-volley reading of `bee-shot` and names the three-volley alternative.
- [`app/src/game/config/data.ts`](../app/src/game/config/data.ts): the engine vocabulary this plan mirrors - the `ring`, `spread` and `scatter` patterns, and the `shotsPerBurst`, `shotIntervalSeconds` and `cooldownAfterLastShotSeconds` cadence.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): D19, D20 and D22 stay deferred. This plan adds D25.
- The user's answers on 2026-11-05 to the numbered `/brainstorm` questions 1-48, recorded below under the Z prefix.

## Completed Baseline

Phases 1-36 and 41 are complete, and the status of V10 and V12 stands as recorded in [the implementation plan](../implementation-plan.md). This plan depends only on the tagger delivered by V8 and does not depend on V10 or V12 being finished.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V10](plan-v10.md) | 37-40 | World-scale re-anchor, octagonal boss room, Killer Honey, centre spawn |
| [V11](plan-v11.md) | 41 | The player's true body, plus its recorded follow-up |
| [V12](plan-v12.md) | 42 | The dev container |

The situation this plan addresses:

- `kind` allows only `volley` or `rotating-arm`, while the engine treats pattern and burst timing as independent.
- The 11 committed `bee-shot` tags sit one tagger frame (33 ms) apart in clusters about 3 s apart. `summarizeTags` reports them as a 1.220 s mean with a 1.453 s deviation, which describes neither interval.
- `bee-shot-burst-occasional` is authored as one 4-arm volley with `clockwiseDegreesPerSecond: 0`, which conflicts with the user's reading. This plan does not change it (Z34).
- Choosing a video always clears tags, and T30 excluded import and resume.
- `frameRate` defaults to 60 and records the step setting, while the pilot video presents at 30 fps.

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), no Playwright coverage (T15), one video per fight (T16), the video never being committed (T17), `mediaTime` as the source of recorded times (T19), sprite-level tagging (T20), sticky label-then-tag (T22), top-level phase attribution (T25), spawn tags only (T26), no pattern geometry (T27), shape-only validation (T31), no cadence mapping in derivation (T32), committed raw evidence (T33) and the schema test over committed JSON (T34).

This plan's delta:

- **Pattern is separate from timing.** `pattern` replaces `kind` and holds where shots go. An optional `burstId` holds firing timing. This supersedes T24.
- **Export schema v2.** Exports carry `schemaVersion: 2`. Version 1 files stay valid and upgrade in memory on load. The committed v1 evidence is not edited.
- **Bursts are measurable.** Each volley is its own tag, and burst groups summarize between-burst and within-burst intervals separately.
- **A live summary panel.** It sits beside T28's readout, which remains one number. This partly supersedes T28's exclusion of means and sample counts from the UI.
- **Load, edit and autosave.** This supersedes T30's "no import or resume" and T35's "per-row delete is the single correction mechanism". T35's other exclusions stand, including no undo.
- **Typed times are the disclosed exception to T19.** Recorded times still come from `mediaTime`. A time the user types is permanently marked `timeSource: "typed"`.
- **`frameRate` means the presented rate.** It is a provenance fact as well as the step size, typed by the user with no default. This amends T19 only for `frameRate`, and it still derives no recorded time.

Explicitly not added: projectile motion, fixed-bearing numbers, sub-phase attribution, rotation direction or rate, undo, merging studies, automatic burst detection, automatic removal of saved sessions, Playwright coverage, and any retune.

## Recorded User Decisions - 2026-11-05

- **Z01 - Engine terms.** A volley is one firing whose projectiles leave together. A burst is several volleys close together followed by a pause. The tagger uses these meanings, which match `shotsPerBurst`, `shotIntervalSeconds` and `cooldownAfterLastShotSeconds`.
- **Z02 - `pattern` replaces `kind` under a schema version.** Exports written by this plan carry `schemaVersion: 2`; a file without the field is v1.
- **Z03 - Pattern values.** `rotating-arm`, `fixed-ring`, `spread` and `scatter`, plus load-only `volley`.
- **Z04 - `volley` is load-only.** It stays valid in files and on loaded rows, but is not offered for new tags or as a new choice on another row.
- **Z05 - `aim` on `spread` and `scatter`.** The values are `player` and `fixed`. It is required on those two patterns and absent on all others. No fixed-bearing number is recorded, so `fixedBearingDegrees` remains authored.
- **Z06 - `aim` joins the grouping key.** Summary and readout groups are keyed by phase, sprite, pattern and aim.
- **Z07 - Projectile motion is not recorded.** It belongs to the projectile variant, which stays under D19.
- **Z08 - One tag per volley.** Volleys in a burst share a positive-integer `burstId`, which preserves the times needed to measure `shotIntervalSeconds`.
- **Z09 - Explicit burst keys.** `B` records a volley and starts a new burst. `Shift+Enter` adds a volley to the latest burst of the current phase, sprite, pattern and aim. `Enter` records a standalone tag. `Shift+Enter` with no matching burst shows an error and records nothing.
- **Z10 - Burst groups summarize separately.** They report between-burst-start intervals and within-burst intervals as separate results, with no cadence mapping (T32 stands).
- **Z11 - Live summary panel.** It covers the whole study, updates live, and lists one row per result with sample count, mean, deviation and the raw intervals.
- **Z12 - The committed v1 evidence stays unedited.** The validator accepts v1 and v2, loading upgrades v1 in memory, and export always writes v2.
- **Z13 - Video and study load in either order.**
- **Z14 - A study without a video can be edited and exported.** It uses the study's stored provenance. Recording and row seeking are disabled until a video opens.
- **Z15 - Video choice and existing tags.** The first video chosen after a load or restore keeps the tags. Any later video choice with tags present clears them as today, after an inline confirmation.
- **Z16 - File-name mismatch warns and allows.** After a mismatch, export writes the open video's `fileName` and `durationSeconds` and keeps the study's `sourceUrl`.
- **Z17 - Loading replaces.** A load replaces existing tags after an inline confirmation. Studies are not merged.
- **Z18 - Unknown sprites and phases load.** The raw value is shown and can be edited (T31 stands).
- **Z19 - An unknown encounter is refused.** The tool reports the id and changes nothing. The file itself remains valid under T31.
- **Z20 - Editable tag fields.** Time, phase, sprite, pattern, aim, shots and burst group can all be edited in a row.
- **Z21 - Typed time rules.** A typed time sets `timeSource: "typed"` on that tag, and no later edit clears it; deleting and retagging produces a frame-derived tag. The accepted range is 0 to the current duration, from the open video or else the study's provenance.
- **Z22 - Row click seeks.** Clicking a row seeks the video to that tag's time, reusing the existing seek path.
- **Z23 - The tag list is time-sorted.** It lists newest first and re-sorts after a time edit.
- **Z24 - No undo.** Row edit and delete remain the corrections.
- **Z25 - `recordedAt` is the latest export time.** Git holds earlier versions.
- **Z26 - `frameRate` is the presented rate.** One typed field is the provenance value and the step size, with no default. It is required to step frames, record a tag and export.
- **Z27 - v1 upgrades to an unknown frame rate.** The v1 value is not carried over. The field is blank after load and must be entered before exporting as v2.
- **Z28 - Autosave per file name.** Each video file name has one `localStorage` slot.
- **Z29 - Saved-session list.** Opening the route lists saved sessions with file name, tag count and last-saved time. Each has restore and discard actions, and the list stays available until dismissed. Restoring follows Z17's confirmation when tags exist.
- **Z30 - Slot lifetime.** A slot is removed only by discarding it and replaced only when a new session for that file name records its first tag or edit. Exports and video resets leave it intact.
- **Z31 - Manual cleanup only.** Nothing is removed automatically. A failed write shows a visible autosave error.
- **Z32 - Unreadable slots are listed.** A slot that cannot be read or validated appears as unreadable, with discard as its only action.
- **Z33 - Sticky selection is saved.** If a restored sticky value names a missing sprite or phase, that value falls back to the tagger's normal default with a notice. Tags remain as saved.
- **Z34 - Tool only.** This plan does not re-tag `bee-shot`, retune the encounter or change a rules version. See D25.
- **Z35 - No sub-phase attribution.** T25 stands; the capability stays under D22.
- **Z36 - No rotation direction or rate.** T27 stands; the capability stays under D20.
- **Z37 - No Playwright coverage.** T15 stands. New logic lives in pure helpers tested with Vitest, and the route is checked by manual use.

## Architecture

Everything stays under `app/src/research/`, behind the existing development-only guard. Nothing under `game/` imports from it.

| Module | Responsibility |
| ------ | -------------- |
| `tagging.ts` | v1 and v2 types, shape-only validation, the v1 upgrade and `summarizeTags` |
| `taggingOptions.ts` | Pattern and aim options, tag creation, row edits, burst assignment, sorting and export assembly |
| `taggingRoute.ts` | Key map, including `B` and `Shift+Enter` |
| `studyLoad.ts` (new) | Pure parsing of a study file against known encounter ids, and pure video-choice decisions |
| `taggerSessions.ts` (new) | The saved-session draft shape and validator, the write decision, and the storage adapter over an injected `Storage` accessor, following the `ZoomPreference` pattern |
| `TaggerRoute.tsx` | Wiring and UI only |

## Target Data Shapes

```ts
export type TagPattern =
  | "rotating-arm" | "fixed-ring" | "spread" | "scatter"
  | "volley"; // load-only (Z04)

export type TagAim = "player" | "fixed";

export type Tag = Readonly<{
  timeSeconds: number;
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  /** Required on spread and scatter, absent on every other pattern (Z05). */
  aim?: TagAim;
  /** Projectiles in the volley, or arms for a ring. */
  shots: number;
  /** Shared by every volley of one burst; a positive integer (Z08). */
  burstId?: number;
  /** Present only when a person typed this time (Z21). */
  timeSource?: "typed";
}>;

export type ObservationExport = Readonly<{
  schemaVersion: 2;
  encounterId: string;
  /** frameRate is the video's presented rate (Z26). */
  provenance: VideoProvenance;
  recordedAt: string;
  tags: readonly Tag[];
}>;

/** A loaded or restored study, before it can be exported. */
export type StudyState = Readonly<{
  encounterId: string;
  provenance: Readonly<{
    sourceUrl: string | null;
    fileName: string;
    /** Null until entered: a v1 upgrade carries no presented rate (Z27). */
    frameRate: number | null;
    durationSeconds: number;
  }>;
  tags: readonly Tag[];
}>;

export type IntervalScope = "all" | "between-bursts" | "within-bursts";

export type IntervalSummary = Readonly<{
  phaseIndex: number;
  spriteId: string;
  pattern: TagPattern;
  aim?: TagAim;
  scope: IntervalScope;
  sampleCount: number;
  meanSeconds: number;
  stdevSeconds: number;
  intervalsSeconds: readonly number[];
}>;

export type SessionDraft = Readonly<{
  draftVersion: 1;
  /** ISO-8601 time of this write. */
  savedAt: string;
  study: StudyState;
  sticky: StickySelection;
}>;
```

Burst derivation:

- A group with no `burstId` emits one `all` result, computed as today.
- A group with any `burstId` emits `between-bursts` and `within-bursts` results.
- A burst's start is its earliest tag time. A standalone tag in that group counts as its own start.
- `within-bursts` pools the consecutive intervals inside each burst.

## Approved Scope And Review Gates

- Only `app/src/research/` changes. No file under `app/src/game/`, no authored data, no rules version and no route outside the tagger is touched.
- `docs/killer-bee-queen-observations.json` stays byte-identical, and its schema test keeps passing as v1.
- `validateObservationExport` stays structural and gains no reference to the encounter configuration. Encounter checks happen in the tool at load time.
- Every recorded time without `timeSource: "typed"` comes from `mediaTime`.
- No fidelity claim is made about `bee-shot`. Re-tagging is user work after this plan, and any retune needs its own plan under D25.
- New testable behaviour is written test-first in pure helpers. No Playwright case is added.
- `npm run verify` passes at the end of each phase, and the phase's manual checks are recorded as actually performed or as blocked.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 43 | Shot Patterns And Burst Tagging | implemented, manual checks pending | V8 phase 34 |
| 44 | Load And Edit A Study | implemented, manual checks pending | Phase 43 |
| 45 | Autosaved Sessions | implemented, manual checks pending | Phase 44 |

## Phase 43: Shot Patterns And Burst Tagging

Status: implemented, manual checks pending. Dependencies: V8 phase 34. Steps in [`docs/plan/phase-43.md`](plan/phase-43.md).

Introduces schema v2, the pattern and aim vocabulary, burst recording, burst-aware derivation, the presented frame rate and the live summary panel.

## Phase 44: Load And Edit A Study

Status: implemented, manual checks pending. Dependencies: phase 43. Steps in [`docs/plan/phase-44.md`](plan/phase-44.md).

Loads v1 and v2 studies in either order relative to the video, supports working without a video, and adds row editing, typed times, row seeking and time sorting.

## Phase 45: Autosaved Sessions

Status: implemented, manual checks pending. Dependencies: phase 44. Steps in [`docs/plan/phase-45.md`](plan/phase-45.md).

Saves each session per video file name and offers a saved-session list for restoring or discarding them.

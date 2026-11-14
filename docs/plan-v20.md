# Plan V20: The Timeline Tagger

Phases 83-88. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 83-88 build and why. It is not authorization to implement a phase by itself.

The tagger grew one feature at a time: tags, bursts, saved attacks, repeats, typed estimates, a sticky selection, and a separate monster draft with anchors. A person now meets three objects that describe one attack (the sticky selection, the saved attack and the draft attack), types a cadence by hand and then checks it by eye, must choose a phase before tagging, cannot tag a sub-phase, types a bomb's flight time although the video shows it, and has no way to record when a monster is invulnerable. This plan replaces that accumulation with one model: a multi-track timeline over the video, where structure, attacks and status are marked where they are seen and every number the game needs is derived from the marks and then accepted by the person.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 83-88. Later explicit user decisions override older statements; record changes here.
- [Plan V19](plan-v19.md), [plan V18](plan-v18.md), [plan V16](plan-v16.md), [plan V15](plan-v15.md), [plan V14](plan-v14.md), [plan V13](plan-v13.md) and [the plan V8 archive](plan-v8.md): the tagger's existing decisions (J, L, S, N, M, Z, T). This plan supersedes the ones named under Confirmed Design; all others stand.
- The user's request on 2026-11-12: evaluate and reimagine the tagging workflow; make attacks reusable; make it clear when an attack starts, how often it repeats and when it ends; derive a bomb's time from a mark on its explosion; record when a monster is invulnerable; put every project-specific word in the glossary. The user asked for every design choice to be decided in this plan without further questions; the decisions below are recorded under the E prefix on that authority.
- A code audit on 2026-11-12. Its findings: `TaggerRoute.tsx` is 90 KB and owns the sticky selection, the saved-attack link state, the repeat targeting and the draft anchors; `tagging.ts` stores a tag as either an unlinked field set or a link to a saved attack plus an optional repeat end; `repeat.ts` expands a repeat from a typed cadence with `volleyTime`; `draftPreview.ts` already draws an `AuthoredAttack` at computed volley times from a `BlockWindow`; `DraftPanel.tsx` already has an `AttackEditor` for an `AuthoredAttack`; `exportAttack.ts` already builds a projectile variant entry for a bomb's typed values; and the engine (`phases.ts`) resets every attack clock at each phase and sub-phase entry, runs an attack until its segment ends, and models invulnerability only as `invulnerableOnEnterSeconds` on a phase or sub-phase.
- [The tagger guide](tagger-guide.md): rewritten by step 88.3.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): this plan promotes the measured-time and invulnerable parts of D39 (E13) and the bomb part of geometry measurement (E09, amending T27 for bombs only), and adds D44 and D45. D26, D32, D34, D35, D37, D40, D41 and D42 stay deferred.

No value here is a ROTMG fidelity claim. Every measured number is a measurement of one video; every estimate is marked as such.

## Completed Baseline

Phases 1-36, 41, 46-64, 73-75 and 79-82 are complete; phases 43-45 and 76-78 are implemented with manual checks pending; V10, V12 and V17 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the tagger as V19 leaves it.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |
| [V14](plan-v14.md) | 46-48 | The live tag preview beside the video |
| [V15](plan-v15.md) | 49-55 | Composite patterns, bombs as their own shot, front aim, typed geometry, tag export |
| [V16](plan-v16.md) | 56-64 | Bomb throws, saved attacks, repeats and tuning in the tagger |
| [V17](plan-v17.md) | 65-72 | Interface redesign |
| [V18](plan-v18.md) | 73-78 | One file per monster, monster drafts, the draft preview and its export |
| [V19](plan-v19.md) | 79-82 | Every monster can be tagged, the phase-scoped draft, hover help, the test clip |

## Confirmed Design

Carried forward unchanged: the one-way `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the only clock (T19, M01, L32), one fixed emitter and one monster in the preview (L16), the copy box writing no file (L23), applying an export as a separate approved change (L25), one autosave slot per video file and monster (Z28, L33), the hover help mark (J12), the generated test clip (J15), the glossary dialog, and every rule under `app/src/game/`.

Superseded by this plan: the tag as the unit of a study (T22, Z04-Z08), bursts recorded by key (Z08), the sticky selection (T22, S20), saved attacks and linked tags (S27-S37), repeats (S38-S42), typed cadence (S45), tuning in the preview (S48, S49), typed bomb time (S11), the match status and first-match preview (M03-M06, L31), the separate monster draft with anchors (L04, L17-L22) and the selected phase (J02-J06). The data those decisions produced stays readable: every study and session written under them converts on load (E02).

This plan adds, as a delta:

- **One vocabulary (E01).** The tagger uses plain words, the same word in the interface, the code, the guide and the glossary, and every project-specific word is in the glossary. "Segment" replaces "block". "Selected attack" replaces the sticky selection. "Estimate" replaces "typed estimate", and its opposite is "measured".
- **A study is a timeline (E02, E04, E16, E20).** A study holds a structure track of boundaries, a status track of spans, one attack track per attack, and a scratch track. A boundary is the frame a segment is entered. A segment's window runs from its boundary to the next boundary or the video end. A mark's segment is derived from its time; nothing stores a phase index.
- **One attack identity (E03).** An attack track's definition is an `AuthoredAttack`, the shape the game runs. The tracks are the draft. Loading a monster creates one track per authored attack; export rewrites the monster's file from the tracks. No tag vocabulary, no matching, no sprite-level ids.
- **Measured, then accepted (E05, E06, E13).** Telegraph end, invulnerable spans, segment durations, cadence and bomb flight time are measured from marks. A measurement is shown beside the authored value and becomes part of the export only when the person accepts it. A typed value keeps the "typed" provenance.
- **An attack runs until its segment ends (E07).** The engine cannot stop an attack early, so an end mark is a diagnostic that raises a warning, never an exported value.
- **Bombs are marked twice (E08, E09).** A throw mark and a detonation mark form a pair. Flight time is the median pair gap. Range is measured from one scale calibration per video and two clicks per pair, the only geometry in the tagger.
- **Four steps (E11).** Set up, Structure, Attacks, Reconcile.

## Recorded User Decisions - 2026-11-12

Recorded on the user's authority to decide every design choice in this plan.

### Vocabulary

- **E01.** One glossary, `research/glossary.ts`, is the single list of project-specific terms, and a unit test asserts that every term in `REQUIRED_TERMS` has an entry. Interface labels, help texts, the step guide and the tagger guide use the glossary's words and no others. Renames: "block" becomes "segment"; "sticky selection" becomes "selected attack"; "typed estimate" becomes "estimate" and its opposite "measured"; "anchor" becomes "boundary"; "Starts here" becomes "Segment starts here". "Telegraph" stays, defined as the warning time. "Volley" stays, defined as one firing.

### The study

- **E02.** Study schema v5 (`schemaVersion: 5`) is a timeline: `boundaries`, `statusSpans`, `tracks`, `scratch`, `acceptedSegmentValues` and an optional `scale`. Tags, saved attacks, repeats, bursts, the sticky selection and the separate monster draft are removed from the model. `validateObservationExport` keeps accepting v1-v4, and `studyV5FromLegacy` converts a loaded or restored legacy study in memory: linked tags become marks on their saved attack's track, unlinked tags are grouped by identical attack fields into one track each, a repeat end becomes an end mark, a burst id is dropped, a tag's phase index becomes a boundary at the earliest tag of that phase, a draft's anchors become boundaries, and a draft's attacks become tracks. `docs/killer-bee-queen-observations.json` stays byte-identical and loads through that conversion.
- **E03.** An attack track is `{ id, location, attack, cadenceSource, marks, endSeconds?, burstGapThresholdSeconds?, projectileOverride?, measuredRangeTiles? }` where `attack` is an `AuthoredAttack` and `location` is `{ phaseId, subPhaseId | null }`, the attack list the export writes it to. A phase-level track fires in every window of that phase; a sub-phase track fires only in that sub-phase's windows. Track ids are the attack ids and are unique within a study.
- **E04.** A boundary is `{ timeSeconds, segmentId, telegraphEndSeconds? }`. The same segment may be entered many times, so sub-phase cycling is recorded as it happens. Segment windows are derived: each boundary's window ends at the next boundary's time or the video end, and the authored duration never ends a window (a measured duration is the window itself). Pressing `S` adds a boundary whose segment is the authored segment after the previous boundary's segment, wrapping within the previous segment's phase when that phase has sub-phases; the structure panel lets the person change it.
- **E05.** A boundary's telegraph end (`T`) and an invulnerable span (`I` opens, `I` closes) are observations. A measured telegraph is the telegraph end minus the boundary; a measured invulnerable duration is the span's out minus its in, and it is attributable to a segment only when the span's in is within one frame of a boundary. A span still open at the video end has `outSeconds: null`.
- **E16.** The scratch track takes marks that belong to no attack yet (Enter with no selected attack, or key `0` then Enter). "Create attack from scratch marks" moves the selected scratch marks onto a new track.

### Cadence

- **E06.** `fitCadence` derives a cadence from a track's marks. Gaps are computed only between consecutive marks inside one window of the track. Gaps are split into within-burst and cooldown gaps at a threshold: the track's `burstGapThresholdSeconds` when set, otherwise automatically, at the largest ratio between consecutive sorted gaps when that ratio is at least `BURST_GAP_SPLIT_RATIO` (3), and otherwise every gap is a cooldown. `shotsPerBurst` is the most common size among complete bursts (a burst followed by a cooldown gap), `shotIntervalSeconds` is the median within-burst gap, `cooldownAfterLastShotSeconds` is the median cooldown gap, and `initialDelaySeconds` is the median over windows of the first mark in the window minus the window start minus the segment's telegraph (measured when the boundary has a telegraph end, authored otherwise), clamped at zero. A value that cannot be determined is `null` and the panel says what one more mark would determine. The fit's `maxResidualSeconds` is the largest distance between a mark and the nearest predicted volley. Accepting a fit copies its non-null values into `attack.cadence` and sets `cadenceSource: "fitted"`; typing a value sets `"typed"`.
- **E17.** The burst gap threshold is an override per track, shown only when the automatic split is ambiguous (the largest ratio is below `BURST_GAP_SPLIT_RATIO`) or when the person opens it.
- **E07.** An end mark (`X`) records where an attack visibly stops. It is never exported. `studyWarnings` reports an end mark earlier than the end of its window, with the text that a sub-phase boundary may be missing. Recorded as D45.

### Bombs

- **E08.** On a bomb track, Enter adds a throw mark (`kind: "volley"`) and `E` adds a detonation mark (`kind: "detonation"`). `pairDetonations` pairs each throw with the first detonation after it and before the next throw. The measured flight time is the median pair gap. Accepting it writes `projectileOverride.travelSeconds`, which the export emits as a projectile variant entry to paste by hand, exactly as `projectileVariantOf` does today. The detonation radius stays a catalog value (D40 stands).
- **E09.** Range is measured, amending T27 for bombs only. One scale calibration per video: the person drags across the monster's body on the video at a frame where it is fully visible, and `scale.tileWidthFraction` is the drag length divided by the video's displayed width divided by the monster's `body.widthTiles`. For one pair, the person clicks the monster's centre at the throw frame and the explosion's centre at the detonation frame; both are stored as fractions of the displayed width and height, and the pair's range in tiles is their distance divided by `tileWidthFraction`. The measured range is the median over pairs and is accepted into `projectileOverride.rangeTiles`. A targeted bomb (`target: "player"`) keeps its measurement as evidence and exports no range.

### Interface

- **E10.** Keys, outside editable fields: Enter adds a volley mark on the selected attack track (scratch when none); `E` adds a detonation mark; `S` adds a boundary; `T` sets the latest boundary's telegraph end; `I` opens or closes an invulnerable span; `X` sets the selected track's end mark; Delete or Backspace removes the mark on the selected track within one frame of the playhead; `1`-`9` select the attack track at that position; `0` selects the scratch track; arrows, Shift+arrows, PageUp, PageDown, `[`, `]` and space keep their meanings. `B`, Shift+Enter and the shot-count digits are removed.
- **E11.** Steps: Set up, Structure, Attacks, Reconcile. Every panel stays mounted; the numbers show the usual order, not a gate.
- **E20.** The timeline is one canvas with one row per track: the structure row (boundaries as labelled ticks, invulnerable spans as bars), one row per attack track (volley marks as ticks, detonation marks as hollow ticks, predicted volleys as faint ticks, the end mark as a bar end) and the scratch row. Clicking a row selects its track. Rows are `TIMELINE_ROW_HEIGHT_PX` (14) tall.
- **E12.** The preview draws the observed volleys (every mark fired as its track's attack), the fitted volleys (the tracks' accepted cadences in their windows), or both, with the fitted ones as ghosts at `GHOST_ALPHA` (0.35). No match status exists: every track has a projectile.
- **E14.** A session draft is `draftVersion: 4` and carries a v5 study and `selectedTrackId`. Drafts of version 1-3 convert on restore. The storage key is unchanged.

### Export

- **E13.** `monsterFileTextFromStudy` rewrites every attack list of the monster's file from the tracks and applies `acceptedSegmentValues`: `telegraphSeconds` and `invulnerableOnEnterSeconds` on a phase or sub-phase, and `durationSeconds` on a sub-phase. It never touches `exitAfterSeconds`, `enterAtHpFraction`, movement, spawns, health or body. This is the only part of D39 promoted. A loaded monster with no marks, no edits and nothing accepted exports text byte-identical to its file.
- **E18.** `studyWarnings` is pure and reports: a mark outside every window of its track's location; an end mark before its window's end; an invulnerable span whose in is not within one frame of a boundary; a cadence with a null value; a fit whose residual exceeds `RESIDUAL_WARNING_FRAMES` (2) frames; and consecutive boundaries inside one phase that do not follow the authored sub-phase cycle.
- **E15.** When no importer remains, delete `savedAttacks.ts`, `repeat.ts`, `tuning.ts`, `SavedAttackPanel.tsx`, `TypedFieldControls.tsx`, the tag path of `previewModel.ts`, and the tags table, summary and export-attack dialogs of `TaggerRoute.tsx`, with their tests. `exportAttack.ts` keeps `slugOf`, `projectileVariantOf` (made public) and `EXPORT_TUNING_SOURCE`.
- **E19.** No file under `app/src/game/` changes. `docs/killer-bee-queen-observations.json` stays byte-identical.

## Architecture

Additions and replacements. The one-way `research/` boundary (T13) stands.

| Module | Role | Must not |
| ------ | ---- | -------- |
| `research/glossary.ts` | Every project-specific term; `REQUIRED_TERMS` | Import anything |
| `research/study.ts` (new) | Study v5 types, `segmentsOfMonster`, `segmentWindows`, `windowsForTrack`, `validateStudyV5` | Import React, the DOM, storage or the simulation |
| `research/cadenceFit.ts` (new) | `fitCadence`, `predictedVolleyTimes`, `pairDetonations`, `medianOf` | Read the video or the DOM |
| `research/studyEdits.ts` (new) | Pure edits returning a new study: boundaries, spans, marks, tracks | Mutate its input |
| `research/studyMigrate.ts` (new) | `tracksFromMonsterFile`, `studyV5FromLegacy` | Change the legacy validators |
| `research/studyWarnings.ts` (new) | `studyWarnings` | Block an export |
| `research/studyExport.ts` (new) | `monsterFileTextFromStudy`, `bombVariantOf`, `studyExportJson` | Write a file |
| `research/draftPreview.ts` | Gains `windowsFromBoundaries`, `observedPreviewAt`, `projectilesOfVolley` | Own a clock |
| `research/previewDraw.ts` | Draws ghost projectiles at `GHOST_ALPHA` | Change the arena drawing |
| `research/timelineModel.ts` | Gains `timelineRows` | Draw |
| `research/TaggerTimeline.tsx` | One row per track | Seek outside the route's seek path |
| `research/StructurePanel.tsx`, `research/TrackPanel.tsx`, `research/FitPanel.tsx`, `research/ReconcilePanel.tsx`, `research/ScalePanel.tsx` (new) | The step panels | Hold study state; the route holds it |
| `research/TaggerRoute.tsx` | Holds one `StudyV5`, the selected track id and the video | Store a phase index |

## Target Data Shapes

```ts
// research/study.ts
export type SegmentRef = Readonly<{ phaseId: string; subPhaseId: string | null }>;

/** `phaseId`, or `phaseId/subPhaseId`; the same text `blockIdOf` produces today. */
export function segmentIdOf(ref: SegmentRef): string;

export type Segment = Readonly<{
  id: string;
  ref: SegmentRef;
  label: string;
  telegraphSeconds: number;
  invulnerableOnEnterSeconds: number;
  /** A sub-phase's authored duration; null for a phase. */
  durationSeconds: number | null;
}>;

export type Boundary = Readonly<{
  timeSeconds: number;
  segmentId: string;
  telegraphEndSeconds?: number;
}>;

export type StatusSpan = Readonly<{
  kind: "invulnerable";
  inSeconds: number;
  outSeconds: number | null;
}>;

export type Mark = Readonly<{ timeSeconds: number; kind: "volley" | "detonation" }>;

export type CadenceSource = "authored" | "fitted" | "typed";

export type AttackTrack = Readonly<{
  id: string;
  location: SegmentRef;
  attack: AuthoredAttack;
  cadenceSource: CadenceSource;
  marks: readonly Mark[];
  endSeconds?: number;
  burstGapThresholdSeconds?: number;
  projectileOverride?: Readonly<{ travelSeconds?: number; rangeTiles?: number }>;
  /** E09: one entry per measured pair, as evidence. */
  measuredRangeTiles?: readonly number[];
}>;

export type AcceptedSegmentValues = Readonly<{
  telegraphSeconds?: number;
  invulnerableOnEnterSeconds?: number;
  durationSeconds?: number;
}>;

export type StudyV5 = Readonly<{
  schemaVersion: 5;
  encounterId: string;
  archetypeId: string;
  recordedAt: string;
  provenance: Readonly<{
    sourceUrl: string | null;
    fileName: string;
    frameRate: number | null;
    durationSeconds: number;
  }>;
  boundaries: readonly Boundary[];
  statusSpans: readonly StatusSpan[];
  tracks: readonly AttackTrack[];
  scratch: readonly Mark[];
  acceptedSegmentValues: Readonly<Record<string, AcceptedSegmentValues>>;
  scale?: Readonly<{ tileWidthFraction: number }>;
}>;

export type SegmentWindow = Readonly<{
  segmentId: string;
  startSeconds: number;
  /** The boundary's telegraph end, or start plus the authored telegraph. */
  epochSeconds: number;
  endSeconds: number;
}>;

// research/cadenceFit.ts
export type CadenceFit = Readonly<{
  shotsPerBurst: number | null;
  shotIntervalSeconds: number | null;
  cooldownAfterLastShotSeconds: number | null;
  initialDelaySeconds: number | null;
  thresholdSeconds: number | null;
  maxResidualSeconds: number | null;
  volleyCount: number;
  completeBurstCount: number;
}>;

// research/taggerSessions.ts
export type SessionDraft = Readonly<{
  draftVersion: 4;
  savedAt: string;
  study: StudyV5;
  selectedTrackId: string | null;
}>;
```

## Approved Scope And Review Gates

- No file under `app/src/game/` changes. Both `rulesVersion` values and every simulation snapshot stay as they are.
- `docs/killer-bee-queen-observations.json` stays byte-identical and loads into a v5 study through `studyV5FromLegacy`.
- For each of the 12 monsters, loading it into tracks and exporting with no marks, edits or accepted values produces text byte-identical to its file.
- Every number added is a named constant with units. No text makes a fidelity claim. Every measured value is labelled measured; every typed value is labelled typed.
- New behaviour is written test-first in pure modules. UI steps record their manual checks as performed or blocked.
- Every project-specific word shown in the interface, the step guide or the tagger guide has a glossary entry; the `REQUIRED_TERMS` test enforces the list.
- `npm run verify` passes at the end of each phase.
- No commit, push, deployment, change to shipped tuning or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 83 | Vocabulary And Glossary | complete | None |
| 84 | The Study Model | complete | Phase 83 |
| 85 | The Structure Step | complete | Phase 84 |
| 86 | The Attacks Step | complete | Phase 85 |
| 87 | Bombs | complete | Phase 86 |
| 88 | Reconcile, Export And Guide | complete | Phase 87 |

## Phase 83: Vocabulary And Glossary

Status: complete. Dependencies: none. Outcome: the tagger glossary holds the plan's 56 required terms and the interface, help, step-guide and guide-terms text no longer use block, anchor, sticky or typed estimate; record in [`plan-archive/phase-83.md`](plan-archive/phase-83.md).

## Phase 84: The Study Model

Status: complete. Dependencies: phase 83. Steps and execution record in [`plan-archive/phase-84.md`](plan-archive/phase-84.md). Outcome: the pure v5 study model (types, segments and windows, the cadence fit, pure edits, monster loading and legacy conversion, and warnings) exists under `app/src/research/` with tests, and no interface changed.

## Phase 85: The Structure Step

Status: complete. Dependencies: phase 84. Steps and execution record in [`plan-archive/phase-85.md`](plan-archive/phase-85.md). Outcome: the route holds one v5 study, sessions and study files carry it, and the Structure step marks boundaries, telegraph ends and invulnerable spans on a multi-row timeline.

## Phase 86: The Attacks Step

Status: complete. Dependencies: phase 85. Steps and execution record in [`plan-archive/phase-86.md`](plan-archive/phase-86.md). Outcome: the Attacks step lists the tracks, records volley and end marks by key, fits and accepts cadences with ghost ticks on the timeline, and previews observed and fitted volleys, and the tag, saved-attack, repeat, tuning and draft-panel code is gone.

## Phase 87: Bombs

Status: complete. Dependencies: phase 86. Steps and execution record in [`plan-archive/phase-87.md`](plan-archive/phase-87.md). Outcome: a bomb track takes detonation marks by `E`, and its measured flight time and range (after a scale calibration in the Structure step) can be accepted into its projectile override, which the observed preview uses.

## Phase 88: Reconcile, Export And Guide

Status: complete, with the real-video acceptance blocked and `npm run verify` deferred to the end of the plan. Dependencies: phase 87. Steps and execution record in [`plan-archive/phase-88.md`](plan-archive/phase-88.md). Outcome: the Reconcile step shows warnings and measured segment values to accept, and exports the monster file rewritten from the tracks (byte-identical for all 12 untouched monsters), a projectile variant per measured bomb and the study JSON, with Playwright coverage and a rewritten tagger guide.

# Phase 84: The Study Model

> Step prompts and execution records for phase 84 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 84.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-84.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase adds the pure model of a timeline study (E02-E08, E13, E16-E18) as new modules under `app/src/research/`, each with its tests, and changes no interface. Every module here imports nothing from React, the DOM, storage or the simulation; it may import types and pure helpers from `game/config/` one way (T13). The existing tag model keeps working untouched until phase 86 removes it. Nothing under `app/src/game/` changes.

### Step 84.1 - Study Types, Segments And Windows

Status: complete. Dependencies: phase 83.

**Implementation prompt**

Create `app/src/research/study.ts` holding the types under "Target Data Shapes" in the plan file, copied exactly, and these functions:

```ts
import type { EnemyArchetype } from "../game/config/encounter";

export function segmentIdOf(ref: SegmentRef): string {
  return ref.subPhaseId === null ? ref.phaseId : `${ref.phaseId}/${ref.subPhaseId}`;
}

/** One segment per phase without sub-phases and one per sub-phase, in authored order. */
export function segmentsOfMonster(archetype: EnemyArchetype): readonly Segment[];

/** The segment after `segmentId` in authored order (E04): the next sub-phase of the same phase, wrapping to its first; for a phase with no sub-phases, the next segment in the list, wrapping to the first. */
export function nextSegmentId(segments: readonly Segment[], segmentId: string | null): string;

/** Boundaries sorted by time; each window ends at the next boundary or the video end. The authored duration never ends a window (E04). */
export function segmentWindows(
  boundaries: readonly Boundary[],
  segments: readonly Segment[],
  videoEndSeconds: number,
): readonly SegmentWindow[];

/** The windows a track fires in: every window of its phase for a phase-level track, only its sub-phase's windows otherwise (E03). */
export function windowsForTrack(
  windows: readonly SegmentWindow[],
  location: SegmentRef,
): readonly SegmentWindow[];

/** The window containing `timeSeconds`, or null before the first boundary. */
export function windowAt(windows: readonly SegmentWindow[], timeSeconds: number): SegmentWindow | null;

/** Structural check, throwing a readable error at the offending path (T31). Attack contents stay unchecked. */
export function validateStudyV5(value: unknown): StudyV5;
```

`segmentsOfMonster` mirrors `blocksOfMonster` in `monsterDraft.ts`: build it from `archetype.phases`, taking `label` the way `blocksOfMonster` does, `telegraphSeconds` and `invulnerableOnEnterSeconds` from the sub-phase when there is one and from the phase otherwise, and `durationSeconds` from the sub-phase only. In `segmentWindows`, a window's `epochSeconds` is the boundary's `telegraphEndSeconds` when present, otherwise `startSeconds` plus the segment's authored `telegraphSeconds`. Two boundaries at the same time keep their array order and the earlier one gets an empty window. A boundary naming an unknown segment is kept with the phase's authored telegraph treated as zero, so a study never fails to open; phase 88's warnings report it.

`validateStudyV5` follows the style of `validateMonsterDraft` in `tagging.ts`: `record`, `nonEmptyString`, `finite` style helpers (copy the small ones you need into `study.ts` rather than importing from `tagging.ts`, which phase 86 shrinks). It rejects: a `schemaVersion` other than 5; a boundary with a non-finite or negative time; a `telegraphEndSeconds` not after its boundary's time; a span with `outSeconds` not after `inSeconds` unless null; a mark with a kind other than `"volley"` or `"detonation"`; two tracks with the same id; a track whose `location.phaseId` is blank; and an `acceptedSegmentValues` entry with a negative number. It returns the caller's object unchanged.

**Focused checks**

Failing-first tests in `app/src/research/study.test.ts`: `segmentsOfMonster` on the Killer Bee Queen yields the same ids as `blocksOfMonster`; `nextSegmentId` wraps inside a phase with sub-phases and across phases without; `segmentWindows` ends each window at the next boundary and the last at the video end, uses a telegraph end as the epoch when present, and keeps two equal-time boundaries in order; `windowsForTrack` returns every window of a phase for a phase-level location; `validateStudyV5` rejects each listed fault with the offending path in the message and accepts a minimal valid study.

**Acceptance**

Every function listed exists with the given signature and the tests pass. No file outside `study.ts` and its test changes.

### Step 84.2 - The Cadence Fit

Status: complete. Dependencies: 84.1.

**Implementation prompt**

Create `app/src/research/cadenceFit.ts` with the `CadenceFit` type from the plan file and:

```ts
/** E06: the automatic split needs the longest gap to be at least this many times the shortest. */
export const BURST_GAP_SPLIT_RATIO = 3;

export function medianOf(values: readonly number[]): number | null; // null for an empty list

/** The time of volley `index` of a cadence from `startSeconds`; `volleyTime` of repeat.ts, moved here. */
export function predictedVolleyTime(
  startSeconds: number,
  cadence: Readonly<{ shotsPerBurst: number; shotIntervalSeconds: number; cooldownAfterLastShotSeconds: number }>,
  index: number,
): number;

export type GapClass = "within-burst" | "cooldown";

/** Splits sorted gaps at `thresholdSeconds` when given, else automatically (E06). Returns the threshold used, or null when every gap is a cooldown. */
export function splitGaps(
  gaps: readonly number[],
  thresholdSeconds?: number,
): Readonly<{ thresholdSeconds: number | null; classes: readonly GapClass[] }>;

export function fitCadence(input: Readonly<{
  marks: readonly Mark[];
  windows: readonly SegmentWindow[];
  thresholdSeconds?: number;
}>): CadenceFit;

export type DetonationPair = Readonly<{ throwSeconds: number; detonationSeconds: number }>;

/** E08: each throw takes the first detonation after it and before the next throw; unpaired marks are ignored. */
export function pairDetonations(marks: readonly Mark[]): readonly DetonationPair[];
```

`fitCadence`, step by step, so the result is deterministic:

1. Take only `"volley"` marks, sorted by time. `volleyCount` is their number.
2. Group them by the window that contains each (`windowAt`); marks in no window are ignored by the fit (phase 84.5 warns about them).
3. Gaps are the differences between consecutive marks inside one group, concatenated over groups.
4. With no gaps: every numeric field is `null` except `initialDelaySeconds` (step 6) and `shotsPerBurst`, which is `1` when there is exactly one mark in some group and `null` with no marks.
5. `splitGaps`: sort the gaps ascending; with an explicit threshold, a gap below it is within-burst. Otherwise find the largest ratio `sorted[i+1] / sorted[i]`; when that ratio is at least `BURST_GAP_SPLIT_RATIO`, the threshold is the geometric mean `Math.sqrt(sorted[i] * sorted[i+1])`; otherwise every gap is a cooldown and the threshold is `null`. Walk the unsorted gaps of each group: a run of within-burst gaps plus the mark after it is one burst; a burst followed by a cooldown gap is complete. `completeBurstCount` counts them.
6. `shotsPerBurst`: the most common size among complete bursts (ties go to the smaller size); with no complete burst, `1` when every gap is a cooldown, else `null`. `shotIntervalSeconds`: the median within-burst gap, or `null` when `shotsPerBurst` is `1` or unknown. `cooldownAfterLastShotSeconds`: the median cooldown gap, or `null` with none. `initialDelaySeconds`: for each group, the first mark minus the window's `epochSeconds`, clamped at zero; the median of those, or `null` with no groups.
7. `maxResidualSeconds`: when every numeric field is known, for each group predict volleys from the group's first mark with `predictedVolleyTime` up to the group's last mark, and take the largest absolute distance from any mark to its nearest prediction; otherwise `null`.

Delete nothing from `repeat.ts` yet; phase 86 removes it.

**Focused checks**

Failing-first tests in `app/src/research/cadenceFit.test.ts`: marks at 0, 0.1, 0.2, 2.0, 2.1, 2.2 in one window starting at 0 with epoch 0 fit `shotsPerBurst 3`, interval `0.1`, cooldown `1.8`, initial delay `0`, residual `0`; the same marks offset by `0.5` after the epoch fit initial delay `0.5`; marks at 0, 1, 2, 3 fit `shotsPerBurst 1` and cooldown `1` with a `null` interval; a single mark fits `shotsPerBurst 1` and null cooldown; gaps `0.1, 0.1, 0.2` (largest ratio 2) fit every gap as a cooldown with threshold `null`; an explicit threshold of `0.15` on those gaps yields `shotsPerBurst 3`; marks across two windows never produce a gap across the boundary; `pairDetonations` on throw 0, detonation 1.2, throw 3, throw 4, detonation 5 yields two pairs and ignores the unpaired throw at 3.

**Acceptance**

Every function exists with its signature, the algorithm follows the seven numbered steps, and the tests pass.

### Step 84.3 - Pure Study Edits

Status: complete. Dependencies: 84.2.

**Implementation prompt**

Create `app/src/research/studyEdits.ts`. Every function returns a new study and never mutates its input. Every refusal returns `{ ok: false, error }` with a sentence the route can show; successes return `{ ok: true, value }`. Define `export type EditResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: string }>`.

```ts
export function addBoundary(study: StudyV5, timeSeconds: number, segments: readonly Segment[]): EditResult<StudyV5>;
// E04: segmentId = nextSegmentId(segments, <segment of the latest boundary before timeSeconds, or null>). Boundaries stay sorted by time.
export function setBoundarySegment(study: StudyV5, index: number, segmentId: string): EditResult<StudyV5>;
export function removeBoundary(study: StudyV5, index: number): EditResult<StudyV5>;
export function setTelegraphEnd(study: StudyV5, timeSeconds: number): EditResult<StudyV5>;
// E05: on the latest boundary at or before timeSeconds; refused before the first boundary or when timeSeconds <= that boundary's time.
export function toggleInvulnerable(study: StudyV5, timeSeconds: number): EditResult<StudyV5>;
// E05: closes the open span (outSeconds null) at timeSeconds, refused when timeSeconds <= inSeconds; otherwise opens a new one.
export function removeSpan(study: StudyV5, index: number): EditResult<StudyV5>;

export function addMark(study: StudyV5, trackId: string | null, mark: Mark): EditResult<StudyV5>;
// trackId null targets the scratch track, which accepts only "volley" marks. A "detonation" mark is refused on a track whose projectile is not a bomb (the caller passes `isBomb` via a second signature; see below). Marks stay sorted by time.
export function removeMarkNear(study: StudyV5, trackId: string | null, timeSeconds: number, toleranceSeconds: number): EditResult<StudyV5>;
// Removes the single nearest mark within the tolerance; refused with "No mark within one frame of this frame." otherwise.
export function setEndMark(study: StudyV5, trackId: string, timeSeconds: number | null): EditResult<StudyV5>;

export function addTrack(study: StudyV5, track: AttackTrack): EditResult<StudyV5>;           // refused on a duplicate id
export function removeTrack(study: StudyV5, trackId: string): EditResult<StudyV5>;
export function duplicateTrack(study: StudyV5, trackId: string, newId: string): EditResult<StudyV5>; // copies the definition, no marks
export function setTrackAttack(study: StudyV5, trackId: string, attack: AuthoredAttack, cadenceSource: CadenceSource): EditResult<StudyV5>;
export function setTrackLocation(study: StudyV5, trackId: string, location: SegmentRef): EditResult<StudyV5>;
export function setBurstGapThreshold(study: StudyV5, trackId: string, seconds: number | undefined): EditResult<StudyV5>;
export function createTrackFromScratch(study: StudyV5, markIndices: readonly number[], track: AttackTrack): EditResult<StudyV5>;
// E16: moves the listed scratch marks onto the new track, which must have no marks of its own.
export function acceptSegmentValue(study: StudyV5, segmentId: string, field: keyof AcceptedSegmentValues, value: number | undefined): EditResult<StudyV5>;
export function setScale(study: StudyV5, tileWidthFraction: number | undefined): EditResult<StudyV5>;
```

For the detonation rule, make `addMark` take a fourth argument `isBombTrack: (trackId: string) => boolean` so the module stays free of the config. Keep each function short; share one `withTrack(study, trackId, update)` helper.

**Focused checks**

Failing-first tests in `app/src/research/studyEdits.test.ts`, one per function, each asserting the input study is unchanged (deep-equal to a copy taken before the call) and the listed refusal texts. Cover: `addBoundary` guessing the next sub-phase and wrapping; `setTelegraphEnd` refused before the first boundary; `toggleInvulnerable` opening then closing, and refusing a close at or before the in; `addMark` keeping marks sorted and refusing a detonation on a non-bomb track and on scratch; `removeMarkNear` choosing the nearest of two marks inside the tolerance; `createTrackFromScratch` removing exactly the moved marks from scratch.

**Acceptance**

Every function exists with its signature, every refusal text is a full sentence, and the tests pass.

### Step 84.4 - Loading A Monster And Converting Legacy Studies

Status: complete. Dependencies: 84.3.

**Implementation prompt**

Create `app/src/research/studyMigrate.ts`:

```ts
/** E03: one track per authored attack, in file order, with `cadenceSource: "authored"` and no marks. */
export function tracksFromMonsterFile(rawFile: unknown): readonly AttackTrack[];

/** A new, empty v5 study for a monster whose tracks come from its file. */
export function emptyStudy(input: Readonly<{
  encounterId: string;
  archetypeId: string;
  provenance: StudyV5["provenance"];
  recordedAt: string;
  rawFile: unknown;
}>): StudyV5;

export type LegacyConversion = Readonly<{
  study: StudyV5;
  /** One sentence per thing the conversion could not keep, shown once after the load. */
  notices: readonly string[];
}>;

/** E02: converts a `StudyState` (what `studyFromExport` and a session restore produce today). */
export function studyV5FromLegacy(input: Readonly<{
  legacy: StudyState;
  config: EncounterConfig;
  archetypeId: string;
  rawFile: unknown;
  recordedAt: string;
}>): LegacyConversion;
```

`tracksFromMonsterFile` reads `rawFile.phases[*].attacks` and `rawFile.phases[*].subPhases[*].attacks` the way `loadMonsterDraft` does, with `structuredClone` on each attack, and a `location` of `{ phaseId, subPhaseId: null }` or `{ phaseId, subPhaseId }`.

`studyV5FromLegacy`, in this order:

1. Tracks: when `legacy.monsterDraft` is present, one track per draft attack with `cadenceSource: "authored"`; otherwise `tracksFromMonsterFile(rawFile)`.
2. Boundaries: one per draft anchor, `segmentId` equal to the anchor's block id (the same text as `segmentIdOf`). Then, for each distinct `phaseIndex` among the tags that has no boundary of that phase yet, one boundary at the earliest tag time of that phase whose segment is the phase's first segment in `segmentsOfMonster` order, adding the notice "Phase <label> was given a boundary at its first tag; check it." when the phase has sub-phases.
3. Saved attacks: for each, one track whose id is `slugOf(name, id)` from `exportAttack.ts`, made unique with a numeric suffix if taken; `attack` is `authoredAttackFromTag(firstLinkedTag, config, archetypeId, savedAttack).attack` with the typed cadence and `initialDelaySeconds: 0`, `cadenceSource: "typed"`; `location` is the phase of its first linked tag at phase level; marks are the linked tags' times as `"volley"` marks; `endSeconds` is the largest `repeatEndSeconds` among them. A saved attack with no linked tag still becomes a track with no marks, at the first phase. When `authoredAttackFromTag` returns null, the marks go to scratch with the notice "Saved attack <name> matched no attack; its <n> marks went to the scratch track."
4. Unlinked tags: group by `JSON.stringify(attackFieldsOf(tag))` plus `phaseIndex`; each group becomes a track `observed-<n>` built from its first tag the same way; a null match sends the group to scratch with a notice.
5. `burstId` is dropped silently. `timeSource`, `repeatEndSource` and every typed estimate that the exported attack cannot hold are dropped with no notice.
6. `acceptedSegmentValues` is empty and `scale` is absent.

Keep `studyFromExport` and `validateObservationExport` in `tagging.ts` as the only entry for legacy files; this module takes their `StudyState`.

**Focused checks**

Failing-first tests in `app/src/research/studyMigrate.test.ts`: `tracksFromMonsterFile` on the Queen's file yields one track per attack with the right locations; `emptyStudy` has no boundaries, spans or marks; converting `docs/killer-bee-queen-observations.json` (loaded with `studyFromExport(validateObservationExport(...))`) yields a study that `validateStudyV5` accepts, with as many volley marks on tracks plus scratch as the file has tags, and a boundary for phase index 2; a study with one saved attack and two linked tags plus a repeat end yields one track with two marks and that end; a study with two unlinked tags of identical fields yields one `observed-1` track with two marks; a draft anchor takes precedence over a tag-derived boundary for the same phase.

**Acceptance**

Every function exists with its signature, the six numbered conversion rules are implemented, and the tests pass. `docs/killer-bee-queen-observations.json` is byte-identical.

### Step 84.5 - Warnings

Status: complete. Dependencies: 84.4.

**Implementation prompt**

Create `app/src/research/studyWarnings.ts`:

```ts
/** E18: a fit whose residual is above this many frames is reported. */
export const RESIDUAL_WARNING_FRAMES = 2;

export type StudyWarning = Readonly<{
  /** "structure", "status", or a track id. */
  where: string;
  text: string;
}>;

export function studyWarnings(input: Readonly<{
  study: StudyV5;
  segments: readonly Segment[];
  videoEndSeconds: number;
  /** Half a frame; from `volleyStepTolerance`. Zero without a frame rate. */
  frameToleranceSeconds: number;
}>): readonly StudyWarning[];
```

Report, in this order, with these exact sentence shapes:

1. A boundary naming a segment not in `segments`: "Boundary at <t> s names an unknown segment <id>."
2. Consecutive boundaries inside one phase whose segment is not `nextSegmentId` of the previous: "Boundary at <t> s enters <id>; the authored cycle expects <expected>."
3. A span whose `inSeconds` is not within `2 * frameToleranceSeconds` of any boundary: "Invulnerable from <t> s starts away from every boundary; the game can only start invulnerability when a segment is entered."
4. For each track: a volley mark outside every window of `windowsForTrack`: "<id>: mark at <t> s is outside every window of <segment label>."
5. For each track with an end mark earlier than the end of the window containing it: "<id>: ends at <t> s but its window runs to <end> s; the game runs an attack until its segment ends, so a sub-phase boundary may be missing." (E07)
6. For each track with at least one mark whose `fitCadence` has a null `cooldownAfterLastShotSeconds`: "<id>: the fit needs one more burst to measure the cooldown." A null `shotsPerBurst` with marks: "<id>: the fit cannot tell bursts apart; set a burst gap threshold."
7. For each track whose `maxResidualSeconds` exceeds `RESIDUAL_WARNING_FRAMES * 2 * frameToleranceSeconds` when that tolerance is positive: "<id>: a mark lies <r> s from the fitted cadence."

Times are printed with three decimals.

**Focused checks**

Failing-first tests in `app/src/research/studyWarnings.test.ts`, one per numbered rule, plus one asserting a clean study yields an empty list.

**Acceptance**

The seven rules produce the given sentences and nothing else, and the tests pass. `npm run verify` passes once at the end of the phase.

## Execution Record

Status: complete (2026-11-13).

Added five pure modules under `app/src/research/`, each with its test file: `study.ts` (v5 types copied from the plan, `segmentIdOf`, `segmentsOfMonster`, `nextSegmentId`, `segmentWindows`, `windowsForTrack`, `windowAt`, `validateStudyV5`), `cadenceFit.ts` (`BURST_GAP_SPLIT_RATIO`, `medianOf`, `predictedVolleyTime`, `splitGaps`, `fitCadence`, `pairDetonations`), `studyEdits.ts` (every listed edit, sharing one `withTrack` helper), `studyMigrate.ts` (`tracksFromMonsterFile`, `emptyStudy`, `studyV5FromLegacy`) and `studyWarnings.ts` (`RESIDUAL_WARNING_FRAMES`, `studyWarnings`). No existing file changed; `repeat.ts`, `tagging.ts` and the tag model are untouched, nothing under `app/src/game/` changed, and `docs/killer-bee-queen-observations.json` is byte-identical.

Decisions made under the user's grant of autonomy:

- The Queen's file repeats five attack ids across attack lists (for example `blue-bomb-ring`), so "track id equals attack id" cannot hold with unique track ids. A repeated attack id gets a numeric suffix (`-2`, `-3`) on the track id only; the attack itself stays byte-identical so phase 88's round-trip export holds. Tracks created from legacy saved attacks and unlinked tags set `attack.id` to the track id.
- `nextSegmentId` with null or an unknown id returns the first segment. `addBoundary` takes the latest boundary at or before the new time, so pressing `S` twice on one frame keeps cycling.
- `windowAt` uses half-open windows, so an empty window from two equal-time boundaries never contains a time; a time exactly at the video end belongs to the last window.
- `fitCadence` computes the residual when the fields a prediction needs are known: the shot interval is required only above one shot per burst. The prediction walk runs to the first predicted volley after the group's last mark, so the last mark's nearest prediction is fair.
- In the legacy conversion, a typed bomb time or range moves to the track's `projectileOverride` (a bomb track only, range dropped for a targeted bomb) and the attack keeps the catalog projectile id, because the variant id `authoredAttackFromTag` writes names no catalog entry. Typed bullet speed and range have no home in a track and drop silently (rule 5). A saved attack with no linked tag is built from its own fields at the first phase; if that matches no attack it is dropped with the notice "Saved attack <name> matched no attack and was dropped." An unmatched unlinked group's notice is "<n> tags matched no attack and went to the scratch track."
- `studyEdits` refusals added beyond the listed ones: a non-finite or negative time, an unknown track, an out-of-range boundary or span index, a blank segment or phase, a non-positive threshold or scale, a negative accepted value, and an empty or stale scratch selection. `duplicateTrack` drops the end mark and the measured ranges with the marks. Undefined withdraws a threshold, accepted value or scale.
- `studyWarnings` lists warnings rule by rule (all of rule 4, then all of rule 5, and so on). Rule 5 allows one frame of slack before the window end. Each test file keeps its own small study fixture rather than adding a shared helper module.

**Checks.** Focused: `npx vitest run` on the five new test files passed (60 tests). `npm run verify` (via the verifier subagent): lint PASS, typecheck PASS, test FAIL on exactly one test, the known pre-existing snapshot mismatch in `src/game/simulation/bomb-split-characterization.test.ts`, which also fails on a clean `main` and is unrelated (1555 of 1556 passed). The gate therefore skipped build; `npm run build` was run on its own and passed. The phase names no Playwright test and changes no interface, so none was run.

# Plan V8: A Measured-Cadence Pilot For Phase 3

Phases 33-35. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 33-35 build and why. It is not authorization to implement a phase by itself.

This plan builds a measurement capability and produces evidence for one phase of one encounter. It changes no gameplay value.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 33-35. Later explicit user decisions override older statements; record changes here.
- [The V7 archive](implementation-plan-v7.md): the completed phase-selector and drill work. Its confirmed design stands in every respect not listed below.
- [The source extract](killer-bee-queen-source.md): the wiki evidence for the Killer Bee Queen. This plan does not change it. Its "Quantitative Facts Present In The Prose" table supplies the calibration anchors, and its "Known ambiguity" note on phase-to-projectile binding is what this plan's measurements begin to narrow.
- [The mechanics contract](mechanics.md): the encounter and phase-machine rules in force. This plan records its tooling addition there during phase 35.
- [The deferred register](deferred-work.md): D13 records the cadence retuning this plan does not perform. D19, D20, D21 and D22 record the measurement scope it declines.
- [The project instructions](../AGENTS.md): architecture boundaries, the TDD rule and the verification policy.

## Completed Baseline

Phases 1-32 are complete. The deployed runtime is the V7 release: the Crystal Worm, the Killer Bee Queen under `killer-bee-queen-nest-paladin-v7`, the projectile appearance catalog with compound hitboxes, and the phase selector with drill sets.

The authored cadence situation this plan addresses:

- `app/src/game/data/enemies.json` carries 79 authored attacks. Their `tuningSource` split is 58 `trainer-authored`, 20 `wiki-prose`, 1 `approved-v3`. The 58 are invented values with no external source.
- The wiki supplies damage, speed, range, derived lifetime and condition effects per projectile, and only eight scattered timing facts. It supplies no cadence, no shot count and no phase-to-projectile binding.
- `app/src/game/data/projectile-appearances.json` already holds 19 sprite-level appearances with resolved pixel grids, each citing the wiki rows it covers. `red-stinger-large`, for example, covers rows 2, 21 and 23.
- `phase-3-pond-barrage` authors 7 attacks. It is this plan's entire measurement target.

## Approaches Considered

- **Server-side behaviour files.** Datamined behaviour definitions would give exact millisecond cooldowns. Researched on 2026-11-03 and rejected as unavailable: no public repository defines behaviour for the Queen, whose internal object id is `EH King Bee`. The full private-server sources that exist carry a 23-line `BehaviorDb.Nest.cs` implementing one charging minion, and no recent content at all. GitHub code search has indexing blind spots, so this is strong evidence rather than proof.
- **Current client XML.** Located and verified: `HiddenElementGames/RotmgVersionRepo`, `TextAsset/epicHiveObjects`, last commit 2025-09-30. Its Queen block reports 112,500 HP, matching the wiki, and 43 of its 44 projectile rows match the committed table on sprite, damage and speed. It contains no cadence, because cadence lives server-side. Adopting its additional fields is deferred as D21.
- **Automatic sprite detection in video.** Deferred as too large for a first measurement, and dependent on calibration that hand tagging establishes more cheaply.
- **Frame-accurate hand tagging, fight-wide.** Drafted and then cut. A first draft of this plan covered all eight phases in five phases of work and 13 steps, carrying a fight-wide tag target of roughly 250 tags, import/resume, outlier detection, phase-entry inference, sub-phase attribution and several speculative data fields. An audit against YAGNI, DRY and SOLID found six internal contradictions and fourteen elements nothing consumed. The plan was reduced to the pilot below rather than patched.
- **A single-phase pilot.** Approved. Phase 3 carries a wiki-verifiable anchor, exercises both tag kinds, has no sub-phases, and is one contiguous window of footage. It answers whether the write-up format is decision-useful before any fight-wide effort is committed.

## Confirmed Design

The V7 confirmed design stands in every respect not listed here. No gameplay value, projectile, condition, hitbox, encounter, authored phase or cadence changes in this plan.

Phases 33-35 add exactly these elements, and nothing else:

- **A calibration gate, first, with no code.** The video is checked against a known number before anything is built: the wiki's Red Glaive wave "every 7 seconds" in phase 3, measured by the endpoint method from three readings the user supplies. If it fails, the phase-7 Beehemoth heal is the one named fallback. If that fails too, the result is recorded and the plan stops.
- **A dev-only tagging route** under a new `app/src/research/` boundary, excluded from the production bundle by an `import.meta.env.DEV` guard. It loads a local video file chosen at runtime and timestamps tags from `requestVideoFrameCallback`'s `mediaTime`.
- **A sprite-level projectile picker** of exactly the 19 existing appearance ids, with thumbnails rendered from the pixel grids already in `projectile-appearances.json`. Bomb entries render as a label plus their `bodyColor` swatch.
- **Sticky selection.** Projectile, phase, kind and shot count persist across tags, so a run of volleys is one keypress each.
- **Two tag kinds.** `volley` means shots fired together, where `shots` counts projectiles. `rotating-arm` means one arm of a ring or spiral, where `shots` counts arms. Explicit on every tag, never inferred.
- **Pure interval derivation,** tested with Vitest: grouping by phase, sprite and kind, then sample count, mean and standard deviation.
- **A minimal readout:** the interval since the previous tag in the current group, which is what catches a missed tag or a double-tap at the moment it happens.
- **A phase-3 pilot measurement** covering every attack identifiable in that phase, including a re-tag of the glaive wave as a tool-versus-hand cross-check.
- **Committed evidence.** `docs/killer-bee-queen-observations.json` holds the raw tags and provenance; `docs/killer-bee-queen-observations.md`, created when it has content, holds the summaries and the reading of them.

Nothing else is added. In particular: no video file is committed; no automatic sprite detection; no angle, arm-position or rotation-rate measurement; no despawn or lifetime tagging; no sub-phase attribution; no phase-entry inference; no outlier detection; no import or resume; no schema version, format id or shot-count mode; no playback-rate control, frame-index display, one-second jumps, undo or unload guard; no simulation-versus-video comparison; no Playwright coverage; no edit to any file under `app/src/game/data/`; and no cadence retuning.

## Named Constants

Stated once here. Phase files reference the decision id rather than repeating the value.

| Value | Constant | Decision |
| ----- | -------- | -------- |
| Gate anchor target | 7.0 s | T02 |
| Gate tolerance | ±0.25 s | T02 |
| Gate minimum intervals | 5 | T02 |
| Fallback anchor target | 10.0 s, same tolerance | T03 |
| Picker entries | 19 | T20 |

## Calibration Anchors

Timing facts from [the source extract](killer-bee-queen-source.md)'s prose table, usable as independent checks. Only the first two are used by the gate.

| Phase | Anchor | Role |
| ----- | ------ | ---- |
| 3 | Red Glaive armour-break wave at phase start and every 7 seconds | Primary gate (T02) |
| 7 | Beehemoths heal the Queen every 10 seconds | Named fallback (T03) |

## Recorded User Decisions - 2026-11-03

- **T01 - Calibrate before building.** The gate is a no-code phase. The tool is built only if it passes.
- **T02 - Gate threshold.** See Named Constants. Passing on fewer than the minimum intervals is not permitted; the gate is recorded as not met instead.
- **T03 - Fallback anchor.** Phase 7's Beehemoth heal is the single named fallback. No third anchor may be substituted.
- **T04 - Endpoint measurement method.** The user reports the time of the first and last wave in one contiguous run plus the wave count; the mean is `(tLast - tFirst) / (waves - 1)`. This divides reading error by the interval count and needs no frame-accurate player or download.
- **T05 - Division of labour for the gate.** The user reports readings; the agent computes and records. The agent does not require the video file.
- **T06 - Gate failure is recorded, not discarded, and introduces no new status.** On failure the result is recorded in the step's execution notes and the plan stops. Phases 34 and 35 stay `pending`; there is no `blocked` status in this repository's phase lifecycle.
- **T07 - The gate records the video's identity.** The source URL is the one identifying field available before the tool exists, so the gate records it and phase 35 checks the tagged file against it.
- **T08 - No authored-data writes.** V8 never edits anything under `app/src/game/data/`. Cadence retuning stays deferred as D13.
- **T09 - Client-XML findings are out of scope.** Recorded as D21.
- **T10 - Pilot scope: phase 3 only.** The remaining seven phases are deferred as D22.
- **T11 - Pilot breadth: every attack identifiable in phase 3.** Phase 3 is one window of footage and the marginal cost per attack is small; a write-up covering one attack could not show whether the format is decision-useful.
- **T12 - The glaive wave is re-tagged with the tool,** giving a tool-versus-hand cross-check against the gate's independent measurement. Both numbers and their difference are reported. No new tolerance is defined for the comparison.
- **T13 - A new research boundary.** `app/src/research/` owns the tag model, the pure derivation and the route. It depends one-way on `game/config/`; nothing under `game/` may import from `research/`.
- **T14 - Production exclusion by guard.** The route is behind `import.meta.env.DEV`. No second Vite entry point and no build-configuration change.
- **T15 - No Playwright coverage** for the route. Vitest on the pure derivation plus manual use.
- **T16 - Encounter-generic.** Phase and projectile lists come from the existing encounter configuration by id.
- **T17 - The video is never committed.** It is chosen at runtime through a file picker.
- **T18 - Provenance is captured once, in the tool:** source URL, file name, frame rate and duration. A pasted URL cannot be tagged directly, because the IFrame player exposes no frame callback and a cross-origin iframe yields no video element.
- **T19 - Frame rate is a convenience, not a correctness input.** It sets the step size only; recorded timestamps come from `requestVideoFrameCallback`'s `mediaTime`.
- **T20 - Sprite-level tagging with thumbnails.** The picker lists exactly the existing appearance ids, rendered from their resolved pixel grids. Variants sharing a sprite are never distinguished by eye.
- **T21 - Bomb entries render as a label plus `bodyColor` swatch,** not an animation frame.
- **T22 - Label, then tag.** Selection is sticky and a single key records a tag at the current frame.
- **T23 - A sticky `shots` integer per tag.**
- **T24 - An explicit `kind` field,** `volley` or `rotating-arm`, so `shots` is never ambiguous in committed evidence.
- **T25 - Top-level phase attribution only.** No `subPhaseIndex` field: phase 3 has no sub-phases, so it would be unexercised. Adding it later is purely additive.
- **T26 - Spawn tags only.** No despawn or lifetime tagging. Recorded as D19.
- **T27 - No pattern geometry.** No angle, cone, arm-position or rotation-rate measurement. Recorded as D20.
- **T28 - The readout is one number:** the interval since the previous tag in the current group. No running mean, sample count or flag in the UI.
- **T29 - No outlier detection anywhere.** The write-up reports the raw interval list and the standard deviation; a reader scanning ten intervals does not need an algorithm to see which one is doubled.
- **T30 - No import or resume, and no unload guard.** The pilot is a single sitting and the measurement step instructs exporting before stopping.
- **T31 - Shape-only validation.** `validateObservationExport` checks structure and nothing else. It must not check sprite ids or phase indices against the encounter configuration: committed evidence of what a video showed must not be invalidated by a later configuration change. Referential checks belong in the tool at tag time, where a bad selection is actionable.
- **T32 - Derivation stops at sample count, mean and standard deviation.** It does not emit `shotsPerBurst`, `shotIntervalSeconds` or `cooldownAfterLastShotSeconds`; that mapping is the tuning decision held under D13.
- **T33 - Committed evidence in `docs/`,** created when it has content. No placeholder sections.
- **T34 - A schema test over the committed JSON,** mirroring how the runtime data files are validated. Durable because T31 keeps validation structural.
- **T35 - Excluded UI.** No frame-index display, no playback-rate control, no one-second jumps and no undo. Per-row delete on the tag list is the single correction mechanism.
- **T36 - User waiver of the interval minimum (2026-11-03, after the gate measurement).** The user reviewed the 2-interval result and states that no available video shows five wave intervals and that this data is enough. The five-interval minimum is waived for this pilot; the 7.0 s mean and 0.0 s deviation are accepted as the gate evidence. This is an explicit user override of T02's consequence, not a claim that T02 was met. The second video the user offered (`https://www.youtube.com/watch?v=aTnAjcyzKPQ`, encounter at 6:40) was checked and its phase 3 is shorter - about 11 s, one interval - so it is not a substitute.
- **T37 - Coarse transport jumps (2026-11-03, after phase 34).** The user asked for buttons that make bigger jumps because frame stepping through a nine-minute video is too slow. Add -5 s/+5 s and -30 s/+30 s buttons, with Shift+ArrowLeft/Right jumping 5 s and PageUp/PageDown jumping 30 s. This overrides T35's exclusion of larger transport for navigation; frame stepping remains the tagging step. A jump changes only the presented frame: recorded times still come from the `mediaTime` frame callback, and a jump marks the seek pending exactly as a frame step does.

## Architecture

The V7 boundary table stands. This plan adds one row:

| Boundary | Home under `app/src` | Owns |
| -------- | -------------------- | ---- |
| Research tooling | `research/` | The tag model, pure interval derivation, the export schema and its validator, and the dev-only tagger route |

Constraints on the new boundary:

- It depends one-way on `game/config/` for the encounter's phases and the appearance catalog. Nothing under `game/` may import from `research/`. There is no path from `research/` into the simulation, the session or Phaser.
- `research/tagging.ts` is pure: no React, no DOM, no video API, no file access. The route owns everything impure.
- The route is reachable only when `import.meta.env.DEV` is true and is absent from the production bundle.
- The tool writes nothing into `app/`. Its only output is a downloaded file the user places under `docs/`.

## Target Data Shapes

```ts
// research/tagging.ts
export type TagKind = "volley" | "rotating-arm";

export type Tag = Readonly<{
  /** Seconds from video start, from requestVideoFrameCallback's mediaTime (T19). */
  timeSeconds: number;
  /** Authored top-level phase index. No sub-phase field, per T25. */
  phaseIndex: number;
  /** A sprite-level appearance id. Never a variant id (T20). */
  spriteId: string;
  kind: TagKind;
  /** Projectiles in the volley, or arms for a rotating attack (T23, T24). */
  shots: number;
}>;

export type VideoProvenance = Readonly<{
  /** The public source URL, or null for a local-only recording. */
  sourceUrl: string | null;
  fileName: string;
  frameRate: number;
  durationSeconds: number;
}>;

export type ObservationExport = Readonly<{
  /** One video is one fight, so the encounter is recorded once here (T16). */
  encounterId: string;
  provenance: VideoProvenance;
  /** ISO date the export was written. */
  recordedAt: string;
  tags: readonly Tag[];
}>;

export type IntervalSummary = Readonly<{
  phaseIndex: number;
  spriteId: string;
  kind: TagKind;
  /** Intervals observed, one fewer than the group's tag count. */
  sampleCount: number;
  meanSeconds: number;
  stdevSeconds: number;
}>;

/** Structural validation only; throws on malformed input, never coerces (T31). */
export function validateObservationExport(value: unknown): ObservationExport;

/** Groups by phase, sprite and kind, then derives statistics (T32). */
export function summarizeTags(tags: readonly Tag[]): readonly IntervalSummary[];
```

## Approved Scope And Review Gates

- No file under `app/src/game/data/` changes. No cadence, projectile, hitbox, condition, phase or encounter value is added or retuned. D13 stays deferred.
- Phase 33 is a gate, not a formality. If it and its fallback fail, the result is recorded and the plan stops with phases 34 and 35 left `pending`.
- `research/tagging.ts` stays pure and is covered by focused Vitest tests written failing-first. The route is not unit-tested beyond that derivation.
- Validation is structural only, per T31. No step may add a referential check against the encounter configuration to the validator.
- Nothing under `game/` imports from `research/`. The dependency is one-way.
- Recorded timestamps come from `mediaTime`. No step may derive a tag time from the frame-rate field or from `currentTime` sampled outside a frame callback.
- Tagging is sprite-level and spawn-only, with top-level phase attribution. No step may add a variant picker, a despawn or lifetime tag, an angle measurement, a sub-phase field or phase-entry inference; see D19, D20 and D22.
- The committed JSON carries raw tags and provenance; summaries live in the markdown. Do not store derived statistics in the JSON.
- The video is never committed, and no step may add it to the repository or to `.gitignore` as though it belonged there.
- Measurement covers phase 3 only. No step may extend it to another phase; that is D22.
- Focused Vitest per step; `npm run verify` once per phase that changes code under `app/`. Phase 33 changes no code and skips it, per the project instructions. No Playwright. The production build's exclusion of the route is confirmed once, by hand, and recorded in the step's execution notes rather than asserted by a test.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 33 | The Calibration Gate | complete | none |
| 34 | The Tagger | complete | 33 |
| 35 | The Phase-3 Measurement And Write-Up | complete | 34 |

> Phase 33's measurement found only 2 intervals in the first video's phase 3, below T02's minimum of 5, and the second video is shorter still. The user explicitly waived the minimum in T36 and accepted the 7.0 s mean and 0.0 s deviation. Phase 33 is complete under that waiver, not a T02 pass; phases 34 and 35 proceed on that recorded basis.

## Recorded Correction - 2026-11-03

The phase 35 tagged run measures the Red Glaive wave at **6.017 s** over two intervals (6.000 and 6.033, standard deviation 0.017) from 98 phase-3 tags. That is **0.983 s** below phase 33's approximate 7.0 s endpoint reading. The user re-watched the footage after the tagging run and confirms the waves are about 6 seconds apart. The tagged intervals agree to 33 ms, the tagger's resolution, so the reading points at the value taken from the wiki's prose, not at the tagger's clock.

This is a correction to the calibration record, not a retroactive failure: phase 33's gate remains user-accepted under T36 at its recorded 7.0 s, and its archive is unchanged. Applying the measured value to the encounter is V9's decision, not V8's, and V8's T08 still forbids authored-data writes.

## Phase 33: The Calibration Gate

Status: complete (user-accepted under T36). Dependencies: none. Steps in [`docs/plan-archive/phase-33.md`](plan-archive/phase-33.md).

Establishes whether the video can yield trustworthy timings at all, by measuring phase 3's Red Glaive wave against the wiki's 7-second fact. No code. Complete: the first video's three-wave run gives a 7.0 s mean and a 0.0 s deviation; the run has only 2 intervals, below T02's minimum, and the user waived the minimum in T36. The second video is shorter and is not a substitute.

## Phase 34: The Tagger

Status: complete. Dependencies: 33. Steps in [`docs/plan-archive/phase-34.md`](plan-archive/phase-34.md).

The `research/` boundary, the tag model and pure derivation, the dev-only route with frame-accurate timestamping, and the tagging surfaces. Complete: the pure model, structural validator and interval derivation, the `?tagger=1` development route with `mediaTime` timestamps, the 19-entry sprite picker, sticky tagging, readout and validated export were built and their four gates pass, and the route is absent from the production bundle. The phase rests on phase 33's user-accepted (T36) gate.

## Phase 35: The Phase-3 Measurement And Write-Up

Status: complete. Dependencies: 34. Steps in [`docs/plan-archive/phase-35.md`](plan-archive/phase-35.md).

Measured phase 3, committed the 98-tag export and its script-generated summaries, added the schema guard, and recorded the tooling addition. Complete: `docs/killer-bee-queen-observations.json` is the unedited export and passes structural validation; its markdown sibling has the seven sections and the T12 cross-check (tool 6.017 s, hand 7.0 s, difference 0.983 s); the schema test protects the committed file; `npm run verify` passed and the production build excludes the tagger.

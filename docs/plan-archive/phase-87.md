# Phase 87: Bombs

> Step prompts and execution records for phase 87 of [plan V20](../plan-v20.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 87.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-87.md` and replace the phase's line in the plan file with a one-sentence outcome.

This phase gives a bomb track its detonation marks and measured flight time (E08), and the one piece of geometry this plan allows: a scale calibration and a measured range (E09). Nothing under `app/src/game/` changes; the detonation radius stays a catalog value (D40).

### Step 87.1 - Detonation Marks And Flight Time

Status: complete. Dependencies: phase 86.

**Implementation prompt**

Wire the `detonation` key action: `addMark(study, selectedTrackId, { timeSeconds, kind: "detonation" }, isBombTrack)` where `isBombTrack` is true when `config.projectiles[track.attack.projectile]?.type === "bomb"`. Show the refusal on a non-bomb track through the error line.

In `FitPanel.tsx`, for a bomb track, add a "Flight time" row: `pairDetonations(track.marks)` gives the pairs; the measured value is `medianOf(pairs.map(p => p.detonationSeconds - p.throwSeconds))`; the authored value is the projectile's `travelSeconds`; "Accept" writes `projectileOverride: { ...current, travelSeconds }` through a new `setProjectileOverride(study, trackId, override)` in `studyEdits.ts`. Show the pair count and the unpaired throw count.

Make the timeline draw a detonation mark as a hollow tick (already specified in `timelineRows`), and make `observedPreviewAt` use a track's `projectileOverride.travelSeconds` in place of the catalog's when present, so a drawn bomb explodes where the marks say.

**Focused checks**

`studyEdits.test.ts`: `setProjectileOverride` merges fields and clears with `undefined`. `FitPanel.test.tsx`: a bomb track with throws at 0 and 3 and detonations at 1.5 and 4.5 shows a flight time of `1.500 s` and two pairs.

**Acceptance**

Pressing `E` on a bomb track adds a detonation mark, the flight time row shows the median gap, accepting it changes where the preview's bombs explode, and the tests pass. Record the manual check.

### Step 87.2 - Scale Calibration

Status: complete. Dependencies: 87.1.

**Implementation prompt**

Create `app/src/research/ScalePanel.tsx` and a pure `app/src/research/scale.ts`:

```ts
/** A point on the video as fractions of its displayed width and height. */
export type VideoPoint = Readonly<{ xFraction: number; yFraction: number }>;

/** E09: the drag length over the monster's body, as a fraction of the displayed width, divided by the body's width in tiles. */
export function tileWidthFractionOf(dragFrom: VideoPoint, dragTo: VideoPoint, bodyWidthTiles: number, aspectRatio: number): number;

/** E09: the distance between two points in tiles; `aspectRatio` is displayed height over width, so vertical fractions scale correctly. */
export function distanceTiles(from: VideoPoint, to: VideoPoint, tileWidthFraction: number, aspectRatio: number): number;
```

Both functions convert `yFraction` to width units by multiplying by `aspectRatio` before taking the Euclidean length, so a point is independent of the displayed size. They throw a `RangeError` on a zero-length drag, a non-positive body width or a non-positive scale.

`ScalePanel.tsx` sits in the Structure step. "Calibrate scale" arms a drag on a transparent overlay placed over the `<video>` element (the overlay is only mounted while armed, so the video's own controls keep working otherwise); pointer down and up give the two points as fractions of the overlay's `getBoundingClientRect`. The body width comes from `config.archetypes[archetypeId].body.widthTiles` (verify the field path in `encounter.ts`; `bodyVertices` reads `body.widthTiles`). The result is stored with `setScale`. The panel shows the stored value as "1 tile = <n> % of the video width" and a "Clear" button. One help text: "Drag across the monster's body at a frame where it is fully visible. This lets bomb ranges be read in tiles."

**Focused checks**

Failing-first tests in `scale.test.ts`: a horizontal drag of 0.2 of the width over a 2-tile body gives `0.1`; a vertical drag uses the aspect ratio; `distanceTiles` of two points 0.1 apart horizontally with scale `0.1` is `1`; the three `RangeError` cases.

**Acceptance**

A drag over the video stores a scale that survives a reload through the session, and the tests pass. Record the manual check.

### Step 87.3 - Measured Range

Status: complete. Dependencies: 87.2.

**Implementation prompt**

In `FitPanel.tsx`, for a bomb track with a stored scale, add a "Range" row with a per-pair measurement flow: a "Measure" button beside each pair seeks to the throw frame and arms a click on the same overlay as 87.2 for the monster's centre, then seeks to the detonation frame and arms a second click for the explosion's centre; `distanceTiles` of the two points is appended to `track.measuredRangeTiles` through `setMeasuredRange(study, trackId, pairIndex, tiles)` in `studyEdits.ts` (a new function; the list is indexed by pair position, with `null` for an unmeasured pair, so change the type to `readonly (number | null)[]`). The row shows each pair's tiles, the median as the measured value, the projectile's authored `rangeTiles`, and "Accept" writing `projectileOverride.rangeTiles`. For a targeted bomb (`attack.target === "player"`), the row shows the measurements and the sentence "A targeted bomb lands on the player, so its range is evidence only." with no Accept button. Without a scale, the row shows "Calibrate the scale in the Structure step to measure range."

**Focused checks**

`studyEdits.test.ts`: `setMeasuredRange` writes at the pair index and leaves earlier entries. `FitPanel.test.tsx`: a targeted bomb shows no Accept button on the Range row.

**Acceptance**

Measuring a pair stores its tiles, the median accepts into the override on a non-targeted bomb, and `npm run verify` passes once at the end of the phase. Record the manual check.

## Execution Record

Status: complete (2026-11-13). The manual checks were not performed (see Manual checks). `npm run verify` is deferred to the end of plan V20 on the coordinator's instruction.

**87.1.** The `E` key action (`detonation`) now calls `addMark` with kind `"detonation"` through the presented-frame guard. `isBombTrack` is true when the track's catalog projectile has `type === "bomb"`. On a non-bomb track, or on scratch, the refusal from `studyEdits.ts` shows on the error line. `studyEdits.ts` gains `setProjectileOverride(study, trackId, override)`. It replaces the override, and the caller spreads the current one to merge; `undefined`, or an override with no fields, removes it; a non-positive value is refused. `FitPanel.tsx` gains a Bomb section for a bomb track. It shows the pair count and unpaired throw count from `pairDetonations`, and a "Flight time" row with the median pair gap, the catalog `travelSeconds` (plus the accepted value once set) and "Accept flight time". `observedPreviewAt` swaps a bomb track's `projectileOverride.travelSeconds` and `rangeTiles` in for the catalog's before drawing. This also changes the bomb's lifetime, so an observed bomb explodes at the override's time. `fittedPreviewAt` keeps the catalog values. The timeline already drew a detonation mark as a hollow tick (`timelineRows`, phase 85), so it did not change.

**87.2.** `scale.ts` holds `VideoPoint`, `tileWidthFractionOf` and `distanceTiles`. Both functions convert `yFraction` to width units by the aspect ratio before taking the Euclidean length. Both throw `RangeError` on a zero-length drag, a non-positive body width, a non-positive scale or a non-positive aspect ratio. `ScalePanel.tsx` sits in the Structure step below `StructurePanel`. It has "Calibrate scale" (which pauses the video and arms the overlay), the help text `HELP_CALIBRATE_SCALE`, "Clear", and a status line "1 tile = <n> % of the video width, measured.". The route wraps `<video>` in a `.videoFrame` and mounts the transparent `.videoOverlay` only while a gesture is armed. Pointer down and up give fractions of the overlay's `getBoundingClientRect`, and the aspect ratio is the rect's height over its width. A prompt line with Cancel shows under the video while a gesture is armed. The scale is stored with `setScale`. It persists through the session because `StudyV5.scale` was already saved and validated (phase 84).

**87.3.** The Bomb section has a "Range" row. The measured value is the median of the non-null `measuredRangeTiles` over the current pairs; the authored value is the catalog `rangeTiles` (plus the accepted value once set); "Accept range" writes `projectileOverride.rangeTiles`. On a targeted bomb (`attack.target === "player"`) the row has no Accept button, and the sentence "A targeted bomb lands on the player, so its range is evidence only." is shown. Without a scale, the row reads "Calibrate the scale in the Structure step to measure range.". With a scale, a list of pairs shows each pair's times, its measured tiles or "not measured", and a "Measure pair <n>" button. That button seeks to the throw and arms a click for the monster's centre. That click seeks to the detonation and arms a second click for the explosion's centre. `distanceTiles` of the two points is written by `setMeasuredRange(study, trackId, pairIndex, tiles)`, which pads unmeasured earlier pairs with `null`. `AttackTrack.measuredRangeTiles` is now `readonly (number | null)[]`.

Decisions:

- The body width is read as `bodyExtentTiles(archetype.verticesTiles, "x")`. `EnemyArchetype` has no `body` field; it has `verticesTiles`, which `bodyVertices` scales so that its x extent equals the authored `body.widthTiles`. This gives the same number without reaching into the raw monster file.
- `setProjectileOverride` replaces rather than merges inside the function. The route's `acceptOverride` spreads the current override, which matches the prompt's `{ ...current, travelSeconds }` and makes clearing a single field possible.
- The observed preview applies the override's `rangeTiles` as well as `travelSeconds`, so an accepted range also moves where an observed bomb lands. The fitted preview stays on catalog values.
- The per-pair Measure buttons sit in a list below the Bomb table rather than inside the Range row, because a row with one cell per pair would not fit the inspector width.
- Both new rows sit in a separate Bomb table below the cadence table, with an "Authored" column, so the cadence table's "Current" column keeps its meaning.
- An overlay gesture that fails (for example a zero-length drag) shows the `RangeError` message on the error line and disarms the overlay.
- No new glossary term was needed: "Detonation mark", "Scale calibration", "Range" and "Flight time" were already entries (phase 83).

**Checks.**

- The new tests were seen failing first: `scale.test.ts` (module missing), the three bomb-override cases in `studyEdits.test.ts`, the four bomb cases in `FitPanel.test.tsx` and the override case in `draftPreview.test.ts`.
- `npx vitest run src/research`: 26 files, 423 tests passed.
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npx oxlint src/research`: no findings.
- Playwright: none run, because this phase names no Playwright test.
- `npm run verify`: not run; deferred to the end of plan V20.

**Manual checks.** Not performed: this run had no interactive browser session. Still to confirm by hand:

- `E` on a bomb track adds a hollow tick, and on a bullet track it shows the refusal.
- The Flight time row shows the median, and accepting it moves the observed bomb's explosion in the preview.
- A calibration drag stores a scale that survives a reload through the session.
- Measure pair stores its tiles, and Accept range writes the override on a non-targeted bomb.

No file under `app/src/game/` changed.

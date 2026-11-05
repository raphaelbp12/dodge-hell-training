# Plan V14: A Live Tag Preview Beside The Video

Phases 46-48. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 46-48 build and why. It is not authorization to implement a phase by itself.

The development-only video tagger records when volleys fire, but the user cannot see what those tags would look like as game state. This plan adds a preview canvas beside the video. At the presented video time it draws every tagged volley's projectiles where the game's own motion maths would put them. Tags record only time, phase, sprite, pattern, aim, shots and burst, so every other value (speed, motion, range, pattern shape and emitter offset) is borrowed from the matching authored attack. The preview is therefore "these tags, played with the game's current authored geometry", not an independent reading of the footage. No gameplay rule, authored value or rules version changes.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 46-48. Later explicit user decisions override older statements; record changes here.
- [Plan V13](plan-v13.md) and [plan V8](plan-v8.md): the tagger's existing decisions (T and Z). This plan supersedes only the ones named under Confirmed Design; all others stand.
- [`app/src/game/simulation/projectiles.ts`](../app/src/game/simulation/projectiles.ts) and [`app/src/game/simulation/patterns.ts`](../app/src/game/simulation/patterns.ts): the closed-form motion and bearing maths the preview reuses.
- [`app/src/game/phaser/encounter.ts`](../app/src/game/phaser/encounter.ts): the bomb-explosion frame time, a trainer-authored placeholder of 0.04 s per frame, which the preview reuses for how long a detonation stays visible.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): D19 and D20 stay deferred. This plan adds D26.
- The user's answers on 2026-11-05 to the numbered `/brainstorm` questions 1-37, recorded below under the M prefix.

## Completed Baseline

Phases 1-36 and 41 are complete. Phases 43-45 of V13 are implemented with manual checks pending, and V10 and V12 stand as recorded in [the implementation plan](../implementation-plan.md). This plan builds on the tagger as V13 leaves it, and does not depend on V10 or V12.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V10](plan-v10.md) | 37-40 | World-scale re-anchor, octagonal boss room, Killer Honey, centre spawn |
| [V11](plan-v11.md) | 41 | The player's true body, plus its recorded follow-up |
| [V12](plan-v12.md) | 42 | The dev container |
| [V13](plan-v13.md) | 43-45 | Shot patterns, burst tagging, study load and edit, autosaved sessions |

## Approaches Considered

The user asked for the cheapest way to preview tags, with the alternatives compared against it. Four were evaluated:

- **A. Embed the game in drill mode** (`?phase=N&loop=1`) beside the video. Cheapest, with no new simulation code, but it shows the authored attack rather than the tags, does not react to a new tag, is not synchronised to the video, and the drill ends if the player dies. Rejected: it does not meet the need.
- **C. A synchronised pure function (chosen, M01).** `previewAt(tags, timeSeconds, ...)` computes each live projectile's position directly from its age, using the engine's existing closed-form maths. The video's presented `mediaTime` is the clock, so play, pause, frame step, jumps and seeks all work with no extra code. The cheapest option that meets the need.
- **B. An on-demand simulation** with its own play/pause clock. It needs the same function as C plus its own transport, and gives up frame alignment with the footage. Its only advantage is working without a video, which is recorded as D26.
- **D. Run the real engine** on a synthetic configuration built from the tags. The most expensive: tags are discrete events while the engine fires on cadences, so it needs a scripted-spawn concept under `game/`; seeking backwards re-simulates from zero; and it needs a second Phaser instance. Its extra fidelity (rotation, boss movement) depends on inputs that tags do not record.

## Confirmed Design

Carried forward unchanged: the `research/` boundary (T13), the development-only guard (T14), `mediaTime` as the source of recorded times (T19), sprite-level tagging (T20), top-level phase attribution (T25), no pattern geometry measurement (T27), and every V13 Z decision not named below.

This plan's delta:

- **A preview panel** sits to the right of the video. It draws the arena outline, a fixed emitter, an adjustable player point and every live tagged projectile at the current `mediaTime`.
- **Geometry is borrowed, never invented.** Each tag is matched to one authored attack. A tag with no match is not drawn and is counted instead.
- **The preview is a 2D canvas, not Phaser.** This is a recorded exception to the project rule that Phaser owns drawing, limited to `app/src/research/` (M10, M33).
- **`game/` gains exports only.** Existing private motion helpers become exported, and the bomb-explosion frame time moves to a Phaser-free exported constant, with no behaviour change (M20, M29).
- **Playwright covers the preview's no-video behaviour.** This supersedes T15 and Z37 for the preview only; the rest of the tagger stays without Playwright coverage (M21, M30).
- **The panel's shown state and size persist in `localStorage`** (M18, M24).

Explicitly not added: an on-demand clock or a preview without a video (D26), placeholder geometry for unmatched tags, ring rotation, per-burst advance or arm spread over time, enemy movement, minion emitters, random scatter, terrain, a boss sprite, collision or hit boxes, phase filtering, numeric player-position fields, a drag-resizable panel, and any retune or rules-version change.

## Recorded User Decisions - 2026-11-05

- **M01 - The clock is the video's `mediaTime`.** Option C is chosen. The preview redraws whenever `mediaTime` or the tags change; pause, step, jump and seek need no preview-specific transport.
- **M02 - Geometry comes from the matching authored attack.** Speed, motion, range or lifetime, pattern shape, arc, cone, emitter radius and fixed bearing come from the encounter configuration, never from invented values.
- **M03 - Matching rule.** A tag matches an attack in the same top-level phase of the primary archetype whose projectile's appearance id equals the tag's `spriteId` and whose pattern family matches: `rotating-arm` and `fixed-ring` match `ring`; `spread` matches `spread`; `scatter` matches `scatter`. The first match in authored order wins.
- **M04 - Unmatched tags are not drawn.** A tag with no match, an unknown sprite or phase, or the load-only `volley` pattern draws nothing. The panel shows how many of the study's tags are not previewed.
- **M05 - The tag's `shots` wins.** The matched pattern is copied with `arms` (ring) or `shots` (spread, scatter) replaced by the tag's `shots`; every other authored field is kept.
- **M06 - No ring rotation.** Every ring volley is resolved at its authored initial phase with zero bursts fired and zero seconds since the clock epoch, so per-burst advance and arm spread contribute nothing. Rotation is not measured (T27, D20).
- **M07 - A fixed emitter.** Every volley fires from the primary archetype's authored `spawnTiles`, offset by each bearing's `emitterRadiusTiles` exactly as the simulation offsets a spawned shard.
- **M07 amendment - 2026-11-05.** The emitter is the arena centre when the encounter's spawn rule is `arena-center` (as `resolveSpawnPosition` places the boss), and the archetype's `spawnTiles` otherwise. The Killer Bee Queen's `spawnTiles` lie outside the arena, so the original rule drew every projectile off canvas.
- **M08 - An adjustable player point.** Player-aimed spread and scatter, and player-aimed lob destinations, aim at one point. It starts at the encounter's `player.spawnTiles`, is drawn as a marker, and can be moved with sliders (M23).
- **M09 - Scatter is spread evenly.** The preview passes `drawnUnitRandoms` of `(i + 0.5) / shots` for shot `i`, which spreads shots evenly across the authored cone with no randomness.
- **M10 - A plain 2D canvas.** The preview is drawn imperatively onto an HTML canvas from a research-only React component. No React element is created per projectile, and no second Phaser instance is created.
- **M11 - Sprites are drawn as pixel art.** Each non-bomb projectile is drawn from its appearance's pixel grid, rotated by its orientation in radians as the game rotates shard images, and sized to its `visualWidthTiles` and `visualHeightTiles`.
- **M12 - Lob projectiles are drawn with their detonation.** A lob shard travels in a straight line to its destination over `travelSeconds`; at landing a ring of `detonationRadiusTiles` is drawn (M29).
- **M13 - A minimal scene.** Only the arena outline, the emitter dot and the player dot are drawn besides projectiles. No terrain or boss sprite is drawn.
- **M14 - Every tag is previewed.** The preview does not filter by the selected phase.
- **M15 - No video, black canvas.** Without an open video, including a study opened without one (Z14), the canvas is black with a note to open a video.
- **M16 - `mediaTime` during a seek.** The preview uses the same `mediaTime` as recorded tags, so while a seek is pending it keeps showing the previous presented frame.
- **M17 - Side by side, with show/hide and resizing.** The panel is a square to the right of the video, with a show/hide toggle and size presets (M25).
- **M18 - Persistence in `localStorage` only.** The panel's preference is stored under its own `localStorage` key, not in the V13 session draft.
- **M19 - Zoom and pan exist.** See M26, M27 and M34.
- **M20 - `game/` changes are export-only.** The private helpers in `projectiles.ts` that the preview needs are exported unchanged. No simulation behaviour, authored value or rules version changes.
- **M21 - Vitest and Playwright.** Pure helpers are tested with Vitest. Playwright gains coverage for the preview (M30), which supersedes T15 and Z37 for the preview only.
- **M22 - Row highlight exists.** See M31 and M32.
- **M23 - Player sliders.** Two range sliders, x and y in tiles, each spanning the arena's axis-aligned bounding box, step 0.1 tile, starting at `player.spawnTiles`. No numeric fields.
- **M24 - Persisted fields.** Only whether the panel is shown and its size preset persist. Zoom, pan and the player point reset to their defaults on reload.
- **M25 - Size presets.** Small 320 px, medium 480 px and large 720 px square canvases, approved by the user. No drag handle.
- **M26 - Wheel zoom and drag pan.** The mouse wheel over the canvas steps the zoom about the cursor; dragging on the canvas pans; a reset button returns to 1× fitted.
- **M27 - Zoom levels.** Fixed steps of 1×, 2× and 4×, where 1× fits the whole arena bounding box in the canvas.
- **M28 - Bombs are circles.** A projectile whose appearance has a `bomb` spec is drawn in flight as a filled circle in that spec's `bodyColor`, with diameter `visualWidthTiles`.
- **M29 - Detonation duration.** The detonation ring is visible for the bomb spec's frame count (`frameOuterPixels.length`) times the game's bomb-explosion frame time, starting at the landing time, matching the game's rule of showing an explosion only for an appearance with a `bomb` spec. The frame time moves from the Phaser scene's private `presentation` to an exported, Phaser-free `BOMB_EXPLOSION_FRAME_SECONDS` constant, which the scene then uses. Its value stays the trainer-authored 0.04 s placeholder.
- **M30 - Playwright covers the no-video preview only.** With a loaded study and no video, it checks the panel, the black canvas and its note, show/hide, the size presets and persistence across a reload. It runs only against the development server and is skipped under `PLAYWRIGHT_LIVE_URL` and excluded from the production-assets project. No video fixture is committed (T17 stands).
- **M31 - A highlight covers the whole burst.** Clicking a row highlights every tag sharing that row's `burstId`, or just that row's tag when it has none.
- **M32 - Highlight lifecycle.** Highlighted projectiles get an outline ring. The highlight survives scrubbing; clicking another row moves it; clicking the same row again clears it; deleting a highlighted row clears it. A row click still seeks as Z22 requires. No key clears it.
- **M33 - The drawing exception is recorded here only.** `AGENTS.md` is not changed; the exception applies only to `app/src/research/`.
- **M34 - Pan is clamped.** The view never leaves the arena's bounding box; at 1× there is nothing to pan.
- **M35 - The default size is medium.** Before any preference is saved, the panel is shown at 480 px.
- **M36 - The tagger guide documents the preview.** `docs/tagger-guide.md` gains a short Preview section.
- **M37 - Preview colours are research constants.** The arena outline, emitter, player, highlight, background and note colours are named constants in the research preview drawing module. They are presentation choices, not gameplay values, and nothing under `game/` changes for them.

## Architecture

Everything new lives under `app/src/research/`, behind the existing development-only guard. Nothing under `game/` imports from it.

| Module | Responsibility |
| ------ | -------------- |
| `game/simulation/projectiles.ts` | Exports `resolveShardLifetime`, `curvedShardPositionAtAge`, `curvedShardOrientationAtAge` and `resolveLobDestination` unchanged (M20) |
| `game/phaser/appearance-pixels.ts` | Exports `BOMB_EXPLOSION_FRAME_SECONDS`; `phaser/encounter.ts` reads it instead of its own literal (M29) |
| `research/previewModel.ts` (new) | Pure: `matchTagAttack` and `previewAt`. Imports from `game/config` and `game/simulation` only |
| `research/previewView.ts` (new) | Pure view maths: arena bounds, fit scale, zoom steps about a point, pan clamp, tile-to-pixel transform |
| `research/previewDraw.ts` (new) | Canvas 2D drawing of one `PreviewFrame` through a `PreviewView`; owns the M37 colour constants |
| `research/previewPreference.ts` (new) | `localStorage` adapter for `{ shown, size }` over an injected `Storage` accessor, following the `ZoomPreference` pattern |
| `research/PreviewPanel.tsx` (new) | The panel: canvas, controls, sliders, wheel and drag input, no-video note, unmatched count |
| `research/TaggerRoute.tsx` | Layout, wiring of `mediaTime`, tags, config and the highlight |

The canvas is redrawn in an effect keyed on `mediaTime`, tags, view, player point, highlight and size. React holds only the inputs, never one element per projectile, so the "never update React per projectile per frame" rule holds. There is no second simulation clock: the only clock is the video's presented `mediaTime`.

## Target Data Shapes

```ts
/** M03/M05/M06: the matched attack plus the pattern the preview resolves. */
export type PreviewMatch = Readonly<{
  attack: AttackSpec;
  projectile: ProjectileSpec;
  /** The authored pattern with arms or shots replaced by the tag's shots. */
  pattern: AttackPattern;
}>;

export type PreviewProjectile = Readonly<{
  /** Index into the study's tag array, for the M31 highlight. */
  tagIndex: number;
  appearance: ProjectileAppearanceSpec;
  positionTiles: Vector2;
  orientationRadians: number;
}>;

export type PreviewDetonation = Readonly<{
  tagIndex: number;
  positionTiles: Vector2;
  radiusTiles: number;
}>;

export type PreviewFrame = Readonly<{
  timeSeconds: number;
  arena: ArenaShape;
  emitterTiles: Vector2;
  playerTiles: Vector2;
  projectiles: readonly PreviewProjectile[];
  detonations: readonly PreviewDetonation[];
  /** M04: study tags with no match, independent of time. */
  unmatchedTagCount: number;
}>;

export type PreviewZoom = 1 | 2 | 4;

export type PreviewView = Readonly<{
  zoom: PreviewZoom;
  /** World point at the canvas centre, clamped per M34. */
  centerTiles: Vector2;
}>;

export type PreviewSize = "small" | "medium" | "large";

/** M25: canvas side in CSS pixels. */
export const PREVIEW_SIZE_PIXELS: Readonly<Record<PreviewSize, number>> = {
  small: 320,
  medium: 480,
  large: 720,
};

export type PreviewPreferenceValue = Readonly<{
  shown: boolean;
  size: PreviewSize;
}>;
```

Per-shard pose at age `a` (zero at the tag's time), with `lifetime` from `resolveShardLifetime`:

- A shard is live for `0 <= a < lifetime`.
- `linear`: spawn plus heading times speed times `a`.
- `boomerang`: as `linear` until `reversalAgeSeconds`, then travelling back along the same line, exactly as `advanceShard` reverses velocity.
- `turning` and `wavy`: `curvedShardPositionAtAge` and `curvedShardOrientationAtAge`.
- `lob`: linear interpolation from spawn to `resolveLobDestination` over `travelSeconds`, then a detonation for `frameOuterPixels.length * BOMB_EXPLOSION_FRAME_SECONDS` seconds when the appearance has a `bomb` spec.

## Approved Scope And Review Gates

- Changes under `app/src/game/` are limited to M20's exports and M29's constant move. Every existing game test passes unchanged, and no rules version, authored value or simulation behaviour changes.
- No placeholder geometry is invented. A value the preview needs comes from the matched authored attack, the encounter configuration or an existing named constant.
- The preview never creates its own clock; its only time input is `mediaTime`.
- New testable behaviour is written test-first in pure helpers. The single new Playwright case follows M30 and runs alone with `npm run test:e2e -- --grep "<pattern>"`.
- `npm run verify` passes at the end of each phase, and the phase's manual checks are recorded as actually performed or as blocked.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 46 | The Preview Model | complete | V13 phase 43 |
| 47 | The Preview Panel | complete | Phase 46, V13 phase 44 |
| 48 | Panel Size, Persistence And Coverage | complete | Phase 47, V13 phase 45 |

## Phase 46: The Preview Model

Status: complete. Dependencies: V13 phase 43. Outcome: Exported the engine helpers and `BOMB_EXPLOSION_FRAME_SECONDS`; added `matchTagAttack`, `countUnmatchedTags` and the pure `previewAt` (research/previewModel.ts). Archive: [`phase-46.md`](plan-archive/phase-46.md).

Exports the engine helpers the preview needs, matches each tag to an authored attack, and computes a pure preview frame for any time.

## Phase 47: The Preview Panel

Status: complete. Dependencies: phase 46, V13 phase 44. Outcome: Added view maths, canvas drawing, `PreviewPanel` with wheel zoom, drag pan, reset, player sliders, and the burst highlight with selection adjustment on delete; wired beside the video in TaggerRoute.. Archive: [`phase-47.md`](plan-archive/phase-47.md).

Draws the frame on a canvas beside the video, with zoom and pan, the player sliders and the burst highlight.

## Phase 48: Panel Size, Persistence And Coverage

Status: complete. Dependencies: phase 47, V13 phase 45. Outcome: Added the localStorage preference adapter, show/hide and size presets, the no-video Playwright case (`tagger preview panel`, chromium project only) and the tagger-guide Preview section.. Archive: [`phase-48.md`](plan-archive/phase-48.md).

Adds show/hide and size presets with a persisted preference, the no-video Playwright case and the tagger-guide section.

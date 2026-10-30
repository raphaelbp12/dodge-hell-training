# V6 Implementation Plan Archive

Historical v6 design and completed phases 25-28, archived on 2026-10-29. Read [the implementation plan](../implementation-plan.md) for pending work and current decisions. This archive is evidence, not a queue of steps to rerun.

Phases 25-28 replaced the Killer Bee Queen's single gold projectile rendering with code-generated pixel appearances transcribed from the wiki sprites, and replaced the authored convex projectile bodies with compound hitboxes derived from the same pixels. The Queen now ships as `killer-bee-queen-nest-paladin-v7`; the Crystal Worm is unchanged. Decisions P01-P15 below remain in force wherever a later plan does not supersede them.

# Plan V6: Projectile Appearance And Sprite-Derived Hitboxes

This is the plan-specific record for the current planning effort. [`implementation-plan.md`](../implementation-plan.md) holds the reusable process (execution modes, phase lifecycle, how to read a phase prompt) that governs every plan version, including this one; read it first if you have not already this session.

Phases 25-28 replace the Killer Bee Queen's single gold projectile rendering and authored convex bodies with **code-generated pixel appearances** transcribed from the wiki's projectile sprite images, and with **compound collision bodies derived from those same pixel grids**. They add no new encounter, projectile, condition or motion kind. The Queen currently ships `killer-bee-queen-nest-paladin-v6`; this plan bumps her to `killer-bee-queen-nest-paladin-v7` because hitbox geometry changes.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process. It is not authorization to implement a phase by itself.
- This file: the decisions and approved technical approach for phases 25-28. Later explicit user decisions override older statements; record changes here.
- [The Killer Bee Queen source extract](killer-bee-queen-source.md): the verified projectile table, derived lifetimes, source rows and minion extracts. It records that the wiki projectile table has **Aesthetics, Damage, Condition effects, Speed, Range and Comments** columns, and no hitbox or size column.
- [The projectile appearance source record](projectile-appearance-source.md): created by step 25.1. It holds the 19 sprite families, their wiki image URLs, native pixel grids, palettes and the 12.8-native-pixels-per-tile derivation.
- [The fixes plan](fixes-plan.md): Q03 ("use our own simple art or code-generated shapes, not the same sprites") and Q11 (collision matches the visible body using simple shapes of at most eight sides). Q03's no-image-asset intent stands; Q11 is extended by compound parts rather than replaced.
- [The deferred register](deferred-work.md): D13, D14 and D15 record the retuning, Crystal Worm and licensing work this plan deliberately leaves out.
- [The v5 archive](implementation-plan-v5.md): decisions K01-K18 and phases 19-24. They stand except where a P-numbered decision supersedes them. K10's `...v5` identity wording was already superseded by the shipped `...v6`; this plan's next identity is `...v7`.

## Completed Baseline

Phases 1-24 are complete. The deployed runtime is the verified V5 release: the Crystal Worm under `crystal-worm-child-swarm-paladin-v4`, and the Killer Bee Queen under `killer-bee-queen-nest-paladin-v6`, with a 45-entry projectile catalog, five motion kinds, emission patterns, player conditions and the eight-phase Queen.

| Archive | Phases | Contents |
| ------- | ------ | -------- |
| [V1 archive](implementation-plan-v1.md) | 1-7 | Mechanics contract, generated foundation, testable simulation, playable engine, practice interface, delivery and handoff |
| [V2 archive](implementation-plan-v2.md) | 8-14 | V2 contract and geometry, continuous collision, persisted zoom, hit feedback and audio, Controls and pause safety, verified release |
| [V4 archive](implementation-plan-v4.md) | 15-18 | Retired geometry study, JSON data layer, many-enemy generalization, timed spawning, regression and handoff |
| [V5 archive](implementation-plan-v5.md) | 19-24 | Projectile catalog, motion kinds, patterns, conditions, phase machine, the Killer Bee Queen, acceptance and handoff |

## Approaches Considered

1. **Ship the wiki PNG sprites.** Exact art with a background-keying and crop pipeline, but it reverses fixes Q03 and commits third-party image files to the repository. Rejected by the user because the project is non-commercial and the artwork can be recreated.
2. **Keep one convex hitbox per projectile and only change the drawing.** Smallest change, but the glaive X, bee wings, large stinger barbs and hive notches would either be covered by a fat convex hull or lose visible parts, so the visible body and the hitbox would disagree. Rejected after the user made hitbox fidelity the priority.
3. **Code-generated pixel grids with compound hitboxes.** Transcribe each native sprite grid and palette, draw it, and derive several convex rectangles from the opaque pixel runs at one documented scale. This is the chosen approach: no image files, exact visible silhouette, and hitbox equals drawing.

The chosen approach keeps every projectile's motion, damage, conditions, cadence and once-only hit rule unchanged; only its visible pixels and collision geometry change.

## Confirmed Design

The V5 confirmed design stands unchanged in every respect not listed here. In particular, the Crystal Worm encounter, the Queen's phases, attacks, cadences, damage, conditions, telegraphs, simulated-DPS progression and attempt flow are untouched.

Phases 25-28 add exactly these elements, and nothing else:

- **A projectile appearance catalog.** Nineteen appearance families cover the 44 Killer Bee Queen projectile entries; seven code-generated pixel templates cover their shapes. Each appearance carries the exact native pixel grid, palette, wiki source and bomb metadata.
- **Pixel-accurate drawing.** Each Queen shard is drawn from its family's pixel grid and palette instead of the single gold `presentation.shard`. A spent shard uses a dimmed shade of its own palette. The lob telegraph stays warning red.
- **Sprite-derived compound hitboxes.** A projectile's collision body is the union of convex rectangles derived from its opaque pixel runs. The conversion is **12.8 native sprite pixels per world tile**, derived from the 16x16 player sprite and the 1.25-tile player body. Every opaque pixel is hittable, including wings, tails and the full glaive X.
- **A new Queen rules identity.** `killer-bee-queen-nest-paladin-v7`, so V5/V6 attempts are not compared with the corrected hitboxes.
- **Bomb detonation visuals.** A bomb keeps its coloured in-flight body; at detonation it plays a one-shot five-frame explosion in its family palette. Its hitbox is still the sourced detonation radius (2 or 3 tiles), not its sprite body.

Nothing else is added. In particular: no green or Plagued Nest rows, no `white-bomb-v3`, no new projectiles or conditions, no captured PNG assets, no Crystal Worm appearance or hitbox change, and no cadence retuning.

### Supersessions And Amendments

- **Fixes Q03 is satisfied in asset form.** The trainer ships no third-party image file; the exact pixel grids are code and data. The visual result is intentionally close to the wiki sprite. The user accepted the copyright/distribution risk for this non-commercial trainer and deferred a licensing review as D15.
- **Fixes Q11 is extended, not abandoned.** Each collision part remains a convex body with at most eight vertices; several parts together match the visible pixel silhouette instead of one coarse outline.
- **The deferred register's out-of-scope artwork bullet is amended.** Original PNG redistribution stays forbidden; code-generated pixel-grid recreations derived from the wiki sprites are approved by P01 and P02.
- **V5's protected Crystal Worm values stand.** The Crystal Worm shard keeps its gold drawing and its 1.45 x 0.65 tile hitbox.

## Recorded User Decisions - 2026-10-29

- **P01 - Use code-generated pixel art, not the wiki PNG files.** The 44 Killer Bee Queen projectiles draw from transcribed native pixel grids and palettes. No third-party image file is committed or shipped. The result is intentionally near-identical. The user accepted the copyright risk for a non-commercial trainer and said licensing can be addressed later; D15 records that review.
- **P02 - One shared appearance catalog.** Nineteen families cover the 44 entries, with seven shape templates. Each projectile references an appearance by id; no palette or grid is duplicated across projectile entries.
- **P03 - One pixel grid drives both drawing and collision.** There is no separate hidden hitbox artwork. The same opaque cells that are drawn are converted into collision parts.
- **P04 - Convert at 12.8 native sprite pixels per world tile.** The derivation is the 16x16 player sprite over the 1.25-tile player body. This is a trainer interpretation; the wiki publishes no projectile hitbox value. It is recorded as an approximation, not a fidelity claim.
- **P05 - Use compound collision bodies.** Each opaque horizontal run becomes a convex rectangle; the union exactly covers the silhouette. Each part stays within the existing 3-to-8-vertex convex contract. The simulation tests every part.
- **P06 - Every opaque pixel is hittable.** Wings, tails, black pixels and the full glaive X count. No decorative mask is authored, because the wiki does not identify which pixels are decorative.
- **P07 - Visual size equals collision size.** The drawing is neither shrunk to fit the old body nor enlarged to cover it. The old `body` box no longer constrains a Queen projectile.
- **P08 - Per-family colour, with a dimmed spent state.** The body uses the family palette. A shard that has hit the player uses a dimmed version of the same palette, not one global spent colour. The lob telegraph remains warning red so danger keeps one meaning.
- **P09 - Bombs keep their in-flight body and gain a detonation animation.** The in-flight body stays the existing coloured octagon; a one-shot five-frame explosion plays at the detonation target in the family palette. The detonation radius remains the sourced 2 or 3 tiles and is the only bomb hitbox.
- **P10 - Scope is the existing 44 Queen entries.** The 20 green Plagued rows and `white-bomb-v3` stay out, consistent with D02. No projectile is added.
- **P11 - Leave the Crystal Worm shard alone.** It keeps its gold appearance and 1.45 x 0.65 tile hitbox, preserving V5's protected Crystal Worm behaviour. D14 records the resulting gap.
- **P12 - Bump the Queen to `killer-bee-queen-nest-paladin-v7`.** The current shipped identity is `...v6`; v6 attempts remain stored and are shown separately. The earlier v6 example in the conversation is not reusable because that identity already exists.
- **P13 - Keep V5 cadences and measure the difficulty shift.** No retuning is part of this plan. The shift is recorded against a pre-change baseline; retuning is deferred as D13.
- **P14 - Queen `body` fields are replaced by appearance-derived collision.** The loader accepts exactly one of `body` or `appearance`; the Crystal Worm keeps `body`.
- **P15 - Every appearance carries provenance.** `docs/projectile-appearance-source.md` records each family's wiki sprite title, image URL, native grid and palette, plus the 12.8 derivation. An appearance without a source is a loader error.

## Appearance Families

| Family | Wiki sprite | Projectile ids |
| ------ | ----------- | -------------- |
| `red-stinger-small` | EH Queen Red Stinger Small | `red-stinger-small`, `red-killer-bee-stinger` |
| `red-stinger-large` | EH Queen Red Stinger Large | `red-stinger-large-v1`, `red-stinger-large-v2`, `red-stinger-large-v3`, `beehemoth-red-stinger-large` |
| `yellow-stinger-small` | EH Queen Yellow Stinger Small | `yellow-stinger-small-v1`, `yellow-stinger-small-v2`, `yellow-killer-bee-stinger` |
| `yellow-stinger-large` | EH Queen Yellow Stinger Large | `yellow-stinger-large`, `beehemoth-yellow-stinger-large` |
| `blue-stinger-small` | EH Queen Blue Stinger Small | `blue-stinger-small-v1`, `blue-stinger-small-v2`, `blue-killer-bee-stinger` |
| `blue-stinger-large` | EH Queen Blue Stinger Large | `blue-stinger-large`, `beehemoth-blue-stinger-large` |
| `red-ball` | EH Red Ball | `red-ball`, `beehemoth-red-ball`, `nest-red-ball` |
| `yellow-ball` | EH Yellow Ball | `yellow-ball-v1`, `yellow-ball-v2`, `nest-yellow-ball` |
| `blue-ball` | EH Blue Ball | `blue-ball-v1`, `blue-ball-v2`, `blue-ball-v3`, `nest-blue-ball` |
| `red-glaive` | EH Red Glaive | `red-glaive-v1`, `red-glaive-v2` |
| `yellow-glaive` | EH Yellow Glaive | `yellow-glaive-v1`, `beehemoth-yellow-glaive` |
| `blue-glaive` | EH Blue Glaive | `blue-glaive-v1`, `beehemoth-blue-glaive` |
| `hive-spiral-shot` | EH Hive Spiral Shot | `hive-spiral-shot-v1`, `nest-hive-spiral-shot-red` |
| `hive-range-shot` | EH Hive Range Shot | `hive-range-shot-v1`, `nest-hive-range-shot-blue` |
| `hive-shot` | EH Hive Shot | `hive-shot-v1`, `nest-hive-shot-yellow` |
| `bee-shot` | EH Bee Shot | `bee-shot` |
| `red-bomb` | Red Bomb | `red-bomb-v1`, `red-bomb-v2` |
| `white-bomb` | White Bomb | `white-bomb-v1`, `white-bomb-v2` |
| `blue-bomb` | Blue Bomb | `blue-bomb` |

## Derived Hitbox Sizes

Native grids are the wiki sprite artwork at 1x. Sizes are the grid divided by 12.8. They are authored by derivation, not hand-tuned.

| Template | Native grid | Size in tiles | Used by |
| -------- | ----------- | ------------- | ------- |
| stinger small | 7 x 1 | 0.547 x 0.078 | Three colours |
| stinger large | 8 x 5 | 0.625 x 0.391 | Three colours |
| ball | 8 x 8 | 0.625 x 0.625 | Three colours |
| glaive | 8 x 8 | 0.625 x 0.625 | Three colours |
| hive shot | 49 x 28 | 3.828 x 2.188 | Three colours |
| bee shot | 8 x 6 | 0.625 x 0.469 | One colour |
| bomb explosion | Five frames | Detonation radius 2 or 3 | Three colours |

## Architecture

The V5 boundary table stands. Ownership for the new concepts:

| Boundary | Home under `app/src` | Owns |
| -------- | -------------------- | ---- |
| Authored appearance data | `game/data/projectile-appearances.json` | Templates, palettes, sources, bomb metadata |
| Authored projectile data | `game/data/projectiles.json` | The 44 Queen `appearance` references and the Crystal Worm `body` |
| Configuration/data | `game/config/data.ts` | Validation of appearance grids, palettes, references and sources; the `body`-or-`appearance` rule |
| Configuration/derivation | `game/config/encounter.ts` | The runtime appearance spec, visual size, anchor and compound collision parts |
| Simulation/geometry | `game/simulation/geometry.ts` | Compound convex-part transforms, swept overlap and bounding radius |
| Simulation/projectiles | `game/simulation/projectiles.ts` | Collision against every projectile part; the detonation event list for lob shards |
| Simulation loop | `game/simulation/simulation.ts` | Broadphase using the appearance hull; detonation events at the step boundary |
| Engine adapter | `game/phaser/` | Pre-rendered appearance textures, pooled shard images, spent shading and the bomb explosion effect |
| Source record | `docs/projectile-appearance-source.md` | Wiki URLs, native grids, palettes and the 12.8 derivation |

The appearance data and collision parts are plain data; no simulation or configuration module imports Phaser, React or the DOM. The renderer receives the appearance palette as strings and converts to Phaser colours. There is no per-projectile React state and no second clock.

## Target Data Shapes

```jsonc
// app/src/game/data/projectile-appearances.json
{
  "comment": "Code-generated pixel appearances transcribed from RealmEye wiki sprites. Provenance: docs/projectile-appearance-source.md.",
  "pixelsPerTile": 12.8,
  "templates": {
    "stinger-small": {
      "widthPixels": 7,
      "heightPixels": 1,
      "rows": ["AAABCDE"]
    }
  },
  "appearances": {
    "red-stinger-small": {
      "template": "stinger-small",
      "palette": {
        "A": "#191919",
        "B": "#333333",
        "C": "#A60F0F",
        "D": "#C32416",
        "E": "#F75B28"
      },
      "source": "row 1; EH Queen Red Stinger Small; https://www.realmeye.com/wiki/killer-bee-queen"
    }
  }
}
```

```jsonc
// app/src/game/data/projectiles.json
"red-stinger-small": {
  "source": "killer-bee-queen-source.md row 1",
  "damageHp": 100,
  "speedTilesPerSecond": 8.5,
  "armorPiercing": true,
  "conditions": [],
  "appearance": "red-stinger-small",
  "expiration": "lifetime-only",
  "hitPolicy": "once-per-shard",
  "motion": { "kind": "linear", "rangeTiles": 9.5 }
},
"crystal-worm-child-shard": {
  "body": { "shape": "shard-hexagon", "widthTiles": 1.45, "heightTiles": 0.65 }
}
```

```ts
// Runtime shapes in game/config/encounter.ts
type ProjectileAppearanceSpec = Readonly<{
  id: string;
  nativeWidthPixels: number;
  nativeHeightPixels: number;
  pixels: readonly (readonly (number | null)[])[]; // palette indices, null transparent
  palette: readonly string[]; // hex strings, Phaser-independent
  visualWidthTiles: number;
  visualHeightTiles: number;
  partsTiles: readonly (readonly Vector2[])[]; // convex rectangles
  source: string;
  bomb?: Readonly<{ frameCount: number; colors: readonly string[] }>;
}>;

type ProjectileSpec = Readonly<{
  // existing fields unchanged
  appearance: ProjectileAppearanceSpec | null;
  verticesTiles: readonly Vector2[]; // hull for broadphase and the Crystal Worm body
  collisionPartsTiles: readonly (readonly Vector2[])[]; // one part for a body entry
}>;
```

```ts
// Presentation event at the simulation boundary
type DetonationEvent = Readonly<{
  projectileId: string;
  positionTiles: Vector2;
  radiusTiles: number;
}>;
```

The `bomb-explosion` template uses a `frames` list instead of a single `rows` list; a bomb appearance carries a `bomb` block with its frame colours. Its in-flight body is the existing 0.6 x 0.6 octagon and is visual-only.

The simulation step result gains `detonations: readonly DetonationEvent[]`, carrying only events produced by this step. The Phaser adapter consumes them to start one-shot explosions; they never affect damage or hit resolution.

## Approved Scope And Review Gates

- Visual and collision correction only. Motion, damage, conditions, cadence, progression, telegraph timing and the once-only hit rule are unchanged.
- The Wiki publishes no projectile hitbox. The 12.8 conversion and the opaque-pixel hitbox are documented trainer interpretations, never described as verified client values.
- Every appearance has a source URL, native grid and palette. An appearance without provenance is a loader error.
- Every opaque cell is covered by exactly one collision part, and every part is a convex body of 3 to 8 vertices. A gap or double-covered cell is a defect, not a tolerance.
- The Crystal Worm shard keeps its gold drawing and its 1.45 x 0.65 tile hitbox.
- The Queen's rules identity becomes `killer-bee-queen-nest-paladin-v7`. V6 records stay stored and separate; no storage schema change.
- No third-party image file is added to the repository. Recreated pixel grids are data and code; licensing review is D15.
- No cadence retuning. The pre-change difficulty baseline is captured before the hitbox switch, and the post-change shift is measured and documented as D13.
- The live-shard performance bound is re-derived from the new compound bodies and measured in the browser. It is never widened to make a run pass.
- Focused checks run per step; `npm run verify` runs at the end of each phase. Playwright runs only for the targeted shard/rendering cases, not the full suite unless requested.
- No green or Plagued Nest content, no `white-bomb-v3`, and no Crystal Worm change; see D02, D14 and P10.

## Phase Index

| Phase | Steps | Outcome | Gate |
| ----- | ----- | ------- | ---- |
| 25 | 25.1-25.3 | Appearance source record, catalog and links; no behaviour change | G11 | Complete: 19 families over 7 templates, exact reference grids, 44 links. |
| 26 | 26.1-26.4 | Compound collision, sprite-derived hitboxes and rules identity `v7` | G12 | Complete: 58-part cap, exact pixel runs, v7 identity, full fight still 373.43 s. |
| 27 | 27.1-27.4 | Pixel-art rendering, spent shading and bomb detonation | G13 | Complete: pooled textures, bomb effect, targeted Playwright cases, visual comparison sheet. |
| 28 | 28.1-28.3 | Performance, difficulty measurement, verification and handoff | G14 | Complete: collision-part bound 91,118, peak 1,906, real Queen drills median 16 ms, docs updated. |

## Phase 25: The Projectile Appearance Catalog

Status: complete.

- [Step 25.1 - Record The Appearance Source](plan-archive/phase-25.md#step-251---record-the-appearance-source)
- [Step 25.2 - Author And Validate The Appearance Catalog](plan-archive/phase-25.md#step-252---author-and-validate-the-appearance-catalog)
- [Step 25.3 - Link The Queen Projectiles](plan-archive/phase-25.md#step-253---link-the-queen-projectiles)

## Phase 26: Sprite-Derived Compound Hitboxes

Status: complete.

- [Step 26.1 - Extend Geometry To Compound Bodies](plan-archive/phase-26.md#step-261---extend-geometry-to-compound-bodies)
- [Step 26.2 - Derive Collision Parts From Pixels](plan-archive/phase-26.md#step-262---derive-collision-parts-from-pixels)
- [Step 26.3 - Capture The V5 Difficulty Baseline](plan-archive/phase-26.md#step-263---capture-the-v5-difficulty-baseline)
- [Step 26.4 - Switch The Hitboxes And The Rules Identity](plan-archive/phase-26.md#step-264---switch-the-hitboxes-and-the-rules-identity)

## Phase 27: Pixel-Art Rendering And Bomb Detonation

Status: complete.

- [Step 27.1 - Pre-Render Appearance Textures](plan-archive/phase-27.md#step-271---pre-render-appearance-textures)
- [Step 27.2 - Draw Shards From Pooled Images](plan-archive/phase-27.md#step-272---draw-shards-from-pooled-images)
- [Step 27.3 - Add The Bomb Detonation Effect](plan-archive/phase-27.md#step-273---add-the-bomb-detonation-effect)
- [Step 27.4 - Visual Acceptance By Template](plan-archive/phase-27.md#step-274---visual-acceptance-by-template)

## Phase 28: Performance, Difficulty And Handoff

Status: complete.

- [Step 28.1 - Re-Derive And Measure The Performance Bound](plan-archive/phase-28.md#step-281---re-derive-and-measure-the-performance-bound)
- [Step 28.2 - Measure And Record The Difficulty Shift](plan-archive/phase-28.md#step-282---measure-and-record-the-difficulty-shift)
- [Step 28.3 - Verify And Hand Off](plan-archive/phase-28.md#step-283---verify-and-hand-off)

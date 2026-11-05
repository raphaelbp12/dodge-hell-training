# Plan V11: The Player's True Body

Phase 41. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phase 41 builds and why. It is not authorization to implement a phase by itself.

This plan corrects the player's body footprint and hitbox to the Paladin class sprite's 6 x 8 body-and-arm mask, replacing the 0.889 x 0.889 beveled octagon with a sprite-derived convex outline. It changes no cadence, projectile, condition, phase, arena, terrain or spawn rule.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phase 41. Later explicit user decisions override older statements; record changes here.
- [Plan V10](plan-v10.md): its world scale stands. `pixelsPerTile: 9.0`, the 8x8 native frame, the octagonal Nest room, its hazards and its centre spawn are not reopened. Its player-body value of 0.889 x 0.889 tiles is superseded for the **body** by this plan; the 8x8 **frame** remains 0.889.
- [The geometry evidence record](killer-bee-queen-geometry-source.md): the measured 51.5 px tile and the resulting 9.0 native-pixels-per-tile scale. Step 41.1 appends one dated note; it rewrites nothing.
- RealmEye, retrieved 2026-11-05 with `curl` and a desktop user agent:
  - `https://www.realmeye.com/wiki/paladin` - the Paladin class page.
  - `https://www.realmeye.com/s/a/img/wiki/i/caT4rO5.png` - the Paladin class image. A 190 x 190 PNG: a 3 px border around an 8 x 8 grid of 23 px cells, with a real alpha channel. Its decode is the size evidence for this plan.
- [The player body source record](player-body-source.md): written by step 41.1. It is the citation for the selected body cells, the derived hull and the normalized vertices. The image itself is reference-only and is not committed, matching the project's third-party-art policy.
- [The mechanics contract](mechanics.md): the encounter rules in force. Step 41.3 records this plan's change there.
- [The deferred register](deferred-work.md): D24 records the player-sprite appearance this plan does not render. D15 stays unchanged because this plan renders no recreated sprite.
- [The project instructions](../AGENTS.md): ownership, test discipline and verification.
- Community evidence, **not used as a value**: ROTMG players report the real player hitbox as a 1 x 1-tile square (a player comment on the official Remaster post `https://remaster.realmofthemadgod.com/?p=3144`). It is not a wiki stat and is not verified here. The trainer keeps decision Q11 - collision matches the visible body - and therefore does not adopt it.

## Completed Baseline

Phases 1-40 are complete. The deployed runtime is the V10 release: `pixelsPerTile: 9.0`, the 19-family projectile appearance catalog with sprite-derived hitboxes, the octagonal Nest boss room with Killer Honey, the Queen spawning at the arena centre, and a player body of 0.889 x 0.889 tiles drawn as the same white beveled octagon used for collision.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V10](plan-v10.md) | 37-40 | World-scale re-anchor, octagonal boss room, Killer Honey, centre spawn |

The situation this plan addresses:

- `app/src/game/data/encounter.json` authors one shared player body, `beveled-octagon` at `0.889 x 0.889` tiles. The same `verticesTiles` is drawn and collided with, so the white marker is the hitbox.
- V10's geometry record measures the real player at `43 x 44 px` at 51.5 px/tile, `0.835 x 0.854` tiles, and authors `0.889 x 0.889` as the 8 x 8 frame. That record describes the **frame**, not the character's body.
- The RealmEye Paladin class image's 8 x 8 grid has a real body-and-arm mask of **6 x 8** native pixels. At 9 native pixels per tile that is `0.667 x 0.889` tiles. The extra frame width is the separate sword and a white outer prop, not body.
- The visible gap the user measured is the **width**: a square 0.889 body is too wide for a character whose body is 6/8 of its frame. The height is the frame's 8 native pixels and does not change.

## Approaches Considered

- **Keep the 0.889 square beveled octagon.** Rejected: the sprite's body-and-arm is 6 x 8, so the width remains visibly too large and the non-square body is not represented at all.
- **Use the side-by-side image's ratio alone.** Rejected: that image has no tile reference, its real-character bounds include glow, sword and ground, and its width ratio disagrees with V10's recorded measurement. The user chose the Paladin image as the authority instead.
- **Use the full opaque 8 x 8 sprite bounds, including sword and outer prop.** Rejected: the width would stay 0.889, and the hitbox would include a sword and a prop that are not body.
- **Derive the body from the Paladin image's 6 x 8 body-and-arm mask, with a new convex outline.** Chosen. It is the only approach that uses the source the user selected and produces a body that matches both the 6 x 8 footprint and the sprite's actual silhouette.
- **Render the actual Paladin pixel sprite as the player.** Declined on 2026-11-05 (X03) in favour of keeping the white body marker. Recorded as D24, not implemented here.

## Confirmed Design

The V10 confirmed design stands in every respect not listed here. No cadence, projectile stat, condition, phase, sub-phase, telegraph, threshold, progression value, arena, hazard, spawn, zoom or health-bar rule changes.

Phase 41 adds exactly these elements, and nothing else:

- **A player body of 0.667 x 0.889 tiles.** The width is 6 native pixels at 9 pixels/tile (6/9); the height is the untouched 8 native pixels (8/9). The 8 x 8 frame remains 0.889 x 0.889 and is not the body.
- **A sprite-derived player outline.** A new named shape, `paladin-body`, is the convex hull of the Paladin class image's body-and-arm cells, simplified to at most eight vertices, normalized to the body's 1 x 1 box and scaled by the new width and height. It replaces `beveled-octagon` for the player only. The head and every enemy keep their existing shapes.
- **The outline is asymmetric**, following the sprite's one-sided arm (X05). It is a deliberate exception to the centrally symmetric bodies in G01/G02; no simulation change is needed because the convex-body path already works for any convex polygon.
- **The hitbox is that same polygon.** Drawing and collision continue to share `config.player.verticesTiles`, so the white marker remains honest: what is drawn is what is hit.
- **The white marker is kept.** No Paladin pixel grid is authored, rendered or shipped.
- **Both encounters share the new body**, because the player body is encounter-wide. Both rules versions bump once, in phase 41: `crystal-worm-child-swarm-paladin-v6` and `killer-bee-queen-nest-paladin-v10`.
- **No retune.** A narrower, asymmetric hitbox makes both fights easier in some approach directions. That shift is accepted and recorded; no attack, cadence or speed is compensated.

Nothing else is added. In particular: no change to `pixelsPerTile`, any projectile appearance, any enemy or head shape, any health-bar geometry, the debug `matchPlayerToHead` behaviour, the arena, hazards, honey, spawns, the phase selector or the storage schema.

## Measurement Evidence

Transcribed here so it is durable; step 41.1 writes the full method into [the player body source record](player-body-source.md) and appends the dated note to [the geometry record](killer-bee-queen-geometry-source.md).

**The image.** `caT4rO5.png` is `190 x 190`: a 3 px border around an `8 x 8` grid of `23 x 23` cells. The alpha channel is meaningful. Decoded cell colours, row 0 at the top:

| Row | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | - | - | - | - | - | - | - | - |
| 0 | W | . | Y | Y | Y | . | W | G |
| 1 | W | O | Y | Y | Y | O | W | G |
| 2 | . | T | K | T | K | T | . | G |
| 3 | . | T | P | P | P | T | . | G |
| 4 | O | O | Y | Y | Y | O | O | L |
| 5 | L | B | H | G | H | B | . | B |
| 6 | . | O | O | O | O | O | . | . |
| 7 | . | B | . | . | . | B | . | . |

Legend: `W` white, `G` grey, `Y` bright yellow, `O` gold, `T` tan, `P` pale, `K` black, `L` pale yellow, `B` brown, `H` light brown, `.` transparent.

**The body.** The character's body and sword arm are the opaque character cells in **columns 1-6, rows 0-7**: a 6 x 8 native block. The white and grey cells in columns 0 and 7 are the separate sword and outer prop, and the white cells at column 6 rows 0-1 are the prop's edge, not body. The body's core is columns 1-5; the gold cell at column 6 row 4 is the sword arm, which is included. The body is therefore 6 native pixels wide and 8 native pixels tall.

**The scale.** V10's `9.0` native sprite pixels per world tile stands. The frame is `8/9 = 0.889` tiles on each axis; the body is `6/9 = 0.667` tiles wide and `8/9 = 0.889` tiles tall. The body's aspect is `6/8 = 0.75`.

**The outline.** Step 41.1 takes the convex hull of the selected body cells' pixel squares, removes collinear points, simplifies to at most eight vertices while preserving the extents, and normalizes the body's bounding box to `[-0.5, 0.5]` on both axes. The arm makes the right-hand extent reach `+0.5` at mid-height while the opposite side does not; the hull is therefore asymmetric and its 180-degree rotation is not itself. The exact ordered vertices are recorded in step 41.1's evidence file and authored in step 41.2; this plan fixes the rule and the extents, not an invented vertex list.

**What this evidence does not establish.** The class image is a single front-facing frame, not a client hitbox or an animation. The body mask is a trainer's reading of that frame; it is not a verified ROTMG player hitbox. The real game's reported 1 x 1-tile square hitbox is deliberately not adopted (Q11).

## Named Constants

| Value | Constant | Decision |
| ----- | -------- | -------- |
| Native sprite pixels per tile | 9.0 (unchanged) | V10 W17 |
| Paladin frame | 8 x 8 native px = 0.889 x 0.889 tiles | X01 |
| Player body and sword arm | 6 x 8 native px = 0.667 x 0.889 tiles | X01 |
| Player body aspect | 0.75 | X01 |
| Player body shape | `paladin-body`, convex hull of the body cells, at most 8 vertices, asymmetric | X04, X05 |
| Crystal Worm rules version | `crystal-worm-child-swarm-paladin-v6` | X06 |
| Queen rules version | `killer-bee-queen-nest-paladin-v10` | X06 |

Derived, not authored: the body's width shrinks by `0.667 / 0.889 = 0.75` while its height is unchanged. The non-rectangular hull means its area is about 73% of the old beveled octagon's, not 75%.

## Recorded User Decisions - 2026-11-05

- **X01 - The player's footprint is the Paladin class image's body and sword arm.** 6 x 8 native pixels = `0.667 x 0.889` tiles. The separate sword and outer prop are excluded, and the frame's 8 x 8 size is not the body.
- **X02 - The hitbox is the same visible body polygon.** Decision Q11 stands: collision matches the drawn body, and the white marker is not a separate visual layer. The real game's reported 1 x 1-tile hitbox is not adopted.
- **X03 - The player remains a white body marker.** The Paladin pixel art is not rendered; the marker is resized to the new body. The declined sprite appearance is deferred as D24.
- **X04 - The body shape is derived from the sprite silhouette.** It is the convex hull of the selected body cells, simplified to at most eight vertices, normalized to the body box and scaled to `0.667 x 0.889`. It replaces `beveled-octagon` for the player only.
- **X05 - The outline is asymmetric.** It follows the sprite's actual one-sided arm rather than being mirrored or centrally symmetrised. This is a deliberate exception to the centrally symmetric player/head bodies approved in G01/G02.
- **X06 - Both encounters share the body and take one comparison break.** The Crystal Worm becomes `crystal-worm-child-swarm-paladin-v6` and the Queen becomes `killer-bee-queen-nest-paladin-v10`. No later step bumps either again.
- **X07 - No retune.** No cadence, speed, damage or pattern is compensated for the smaller body. The resulting difficulty shift is accepted and recorded.
- **X08 - The evidence is the RealmEye Paladin class image.** Step 41.1 records the image provenance, the 8 x 8 decode, the selected 6 x 8 body cells, the hull and the normalization in a new `docs/player-body-source.md`, and appends a dated note to the geometry record without rewriting it. The image is reference-only and is not committed.
- **X09 - Verification.** Failing-first focused Vitest for every behaviour change; `npm run verify` once at the end of phase 41; no new Playwright case and no full e2e run as part of the phase. The user's separate post-review acceptance run is recorded in the phase archive: the full existing Playwright suite passed 45/45 on 2026-11-05. No commit, push or deployment without explicit authorization.

## Architecture

The V10 boundary table stands. This plan adds one named shape and no module:

| Concern | Home under `app/src` | Owns |
| ------- | -------------------- | ---- |
| Authored body shapes (widened) | `game/data/shapes.json` | The `paladin-body` normalized convex outline beside the existing `beveled-octagon` and `shard-hexagon` |
| Authored encounter values (changed) | `game/data/encounter.json` | The player body's shape name and its `0.667 x 0.889` dimensions; both rules versions |

Constraints:

- No simulation change. `loadOutline`, `scaleBody`, `constrainBodyToArena`, `pursueBody`/`convexContactDistance` and `sweptConvexOverlap` already accept any convex polygon with 3-8 vertices, including an asymmetric one.
- The player's drawing and collision keep the single `config.player.verticesTiles` source. Do not add a separate visual body.
- The head and every enemy keep their existing shape names and vertices byte-for-byte.
- `pixelsPerTile: 9.0` and every projectile appearance stay untouched.
- No new module may read `ENCOUNTER_CONFIG` at module level; the player body continues to come from `state.config`.

## Target Data Shapes

`app/src/game/data/shapes.json` gains one normalized outline. Its vertices are produced by step 41.1 and authored by step 41.2. They must be clockwise, convex, between 3 and 8 in count, inside `[-0.5, 0.5]` on both axes, and asymmetric:

```json
{
  "comment": "Convex body outlines normalized to a 1x1 tile box, scaled to authored dimensions by the loader. Provenance: docs/mechanics.md step 8.2. paladin-body is derived from the body-and-arm mask of the RealmEye Paladin class image; see docs/player-body-source.md.",
  "shapes": {
    "beveled-octagon": ["... unchanged ..."],
    "shard-hexagon": ["... unchanged ..."],
    "paladin-body": [
      { "x": "...", "y": "..." }
    ]
  }
}
```

`app/src/game/data/encounter.json` changes its one shared player body and both rules versions:

```json
{
  "player": {
    "spawnTiles": { "x": 0, "y": 0 },
    "body": {
      "shape": "paladin-body",
      "widthTiles": 0.667,
      "heightTiles": 0.889
    }
  },
  "encounters": {
    "crystal-worm": { "rulesVersion": "crystal-worm-child-swarm-paladin-v6" },
    "killer-bee-queen": { "rulesVersion": "killer-bee-queen-nest-paladin-v10" }
  }
}
```

The file keeps every other field unchanged.

## Review Focus

- **The 0.889 frame is not the body.** The most likely mistake is to set the body back to `0.889 x 0.889` because the frame is 8 x 8. The body is the 6 x 8 mask; the frame is only the scale convenience.
- **Asymmetry must be real and visible in the data.** Do not mirror the hull or average it with its 180-degree rotation. The test must prove `paladin-body` is not centrally symmetric, and the containment/collision tests must exercise the arm side and the opposite side separately.
- **The hitbox must actually shrink.** A test that only asserts the authored numbers would not catch a renderer that still draws the old square. Add a collision case that hits the old 0.889 square but misses the new body on the narrow side, and a containment case on the arm side.
- **No decoupling.** The player has no separate visual body. `drawEntities` and `constrainBodyToArena` must keep reading `config.player.verticesTiles`; a second shape would be a new architecture.
- **One comparison break.** Both rules versions bump once in step 41.2. A later bump, or a bump in a docs-only step, is a defect.
- **The source is a class icon, not a hitbox.** Every record must call `paladin-body` a trainer reading of the sprite's body mask, never a verified client hitbox.

## Approved Scope And Review Gates

- Only the shared player body's shape and dimensions, the `paladin-body` shape entry, both rules versions, the new player-body evidence record, the geometry record's dated note, the mechanics/changelog/deferred-work updates and the tests that follow from them change.
- `pixelsPerTile: 9.0` stays. No appearance, projectile, enemy, head, arena, hazard, spawn, cadence, damage, speed, range, condition, telegraph, threshold, progression, zoom or health-bar value changes.
- The player body is exactly `0.667 x 0.889` tiles, its shape is the recorded `paladin-body` hull, the hull is convex with 3-8 vertices, it is asymmetric, and the drawing and collision use the same vertices.
- Both rules versions bump exactly once, in step 41.2. Pre-break records are retained but excluded from the new bests; the Crystal Worm and Queen records still never compare.
- Evidence files are never rewritten in place. The geometry record gets an appended dated note; `docs/player-body-source.md` is new; the Paladin image is not committed.
- Tests that encode the old 0.889 x 0.889 player body are rewritten to the new values and relationships, never deleted.
- Focused Vitest per step, written failing-first. `npm run verify` once at the end of phase 41. No new Playwright case and no full e2e suite as part of the phase unless reproducing a CI failure; the user's separate acceptance run is recorded in the phase archive (45/45 on 2026-11-05).
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 41 | The Player's True Body | complete | V10 phase 40 |

## Phase 41: The Player's True Body

Status: complete. Dependencies: V10 phase 40. Steps archived in [`docs/plan-archive/phase-41.md`](plan-archive/phase-41.md).

Measures the Paladin class image's 6 x 8 body-and-arm mask, derives the asymmetric convex `paladin-body` outline, authors it beside the existing shapes, and changes the shared player body to `0.667 x 0.889` tiles with one comparison break for both encounters.

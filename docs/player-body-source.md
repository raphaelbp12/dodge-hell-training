# Player Body Source

Evidence record for the player body authored by plan V11 (phase 41). It derives the `paladin-body` shape from the RealmEye Paladin class image and records the exact vertices, normalization and limitations. It is the citation for `app/src/game/data/shapes.json` and the player body in `app/src/game/data/encounter.json`.

> **Post-V11 follow-up (2026-11-05):** the shipped body is now the symmetric 5 x 7 core at `0.556 x 0.778` tiles, using the beveled octagon; the `paladin-body` hull is superseded and no longer authored. See the follow-up section below.

| Field | Value |
| ----- | ----- |
| Page | `https://www.realmeye.com/wiki/paladin` |
| Image | `https://www.realmeye.com/s/a/img/wiki/i/caT4rO5.png` |
| Retrieved | 2026-11-05, with `curl` and a desktop user agent |
| Image SHA-256 | `28A53AF0574D58F28A46B0D8BB1BADDEB9299D137E1E251F1F9A66F13E194F1E` |
| Image size | 369 bytes, 190 x 190 PNG with an alpha channel |
| Local reference | Not committed. The image stays reference-only under the project's third-party-art policy. |
| Scale | 9.0 native sprite pixels per world tile, from [the geometry record](killer-bee-queen-geometry-source.md) |

## Decode

The 190 x 190 image is a 3 px border around an **8 x 8 grid of 23 px cells**. Each cell was decoded at its centre from the RGBA channels. The alpha channel is meaningful. Row 0 is the top.

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

## Body Selection

The character's body and sword arm are the opaque character cells in columns 1-6. The white and grey cells in columns 0 and 7 are the separate sword and outer prop; the white cells at column 6 rows 0-1 are the prop's edge. Both are excluded. The gold cell at column 6 row 4 is the sword arm and is included.

The selected cells are:

- column 1, rows 1-7 (7 cells)
- columns 2-4, rows 0-6 (21 cells)
- column 5, rows 1-7 (7 cells)
- column 6, row 4 (1 cell)

That is 36 cells with a bounding box of **x 1-7, y 0-8**: **6 native pixels wide and 8 native pixels tall**. At 9 native pixels per world tile the body is `6/9 = 0.667` tiles wide and `8/9 = 0.889` tiles tall, aspect `0.75`. The full 8 x 8 frame remains `0.889 x 0.889`; it is not the body.

## Outline Derivation

The four corners of every selected cell square were fed into a monotone-chain convex hull. The hull is exactly eight vertices, so no edge removal or simplification was needed; eight is the project's maximum. The hull is not mirrored, averaged with its 180-degree rotation, or otherwise symmetrised (decision X05).

The hull in pixel coordinates, clockwise:

| # | Pixel x | Pixel y | Normalized x | Normalized y | World x (tiles) | World y (tiles) |
| - | ------: | ------: | -----------: | -----------: | --------------: | --------------: |
| 1 | 1 | 1 | -0.5 | -0.375 | -0.333500 | -0.333375 |
| 2 | 2 | 0 | -0.333333 | -0.5 | -0.222333 | -0.444500 |
| 3 | 5 | 0 | 0.166667 | -0.5 | 0.111167 | -0.444500 |
| 4 | 6 | 1 | 0.333333 | -0.375 | 0.222333 | -0.333375 |
| 5 | 7 | 4 | 0.5 | 0.0 | 0.333500 | 0.000000 |
| 6 | 7 | 5 | 0.5 | 0.125 | 0.333500 | 0.111125 |
| 7 | 6 | 8 | 0.333333 | 0.5 | 0.222333 | 0.444500 |
| 8 | 1 | 8 | -0.5 | 0.5 | -0.333500 | 0.444500 |

Normalization uses the body's 6 x 8 bounding box:

```
x = (pixelX - 1) / 6 - 0.5
y = (pixelY - 0) / 8 - 0.5
```

The normalized extents are exactly `[-0.5, 0.5]` on both axes. Scaling by the authored `0.667` and `0.889` tiles gives extents `[-0.3335, 0.3335]` and `[-0.4445, 0.4445]`, so the body is `0.667 x 0.889` tiles.

The hull is convex: every consecutive triple has the same cross-product sign. It is **not centrally symmetric**: the arm's extreme vertices at `(0.5, 0.0)` and `(0.5, 0.125)` rotate to `(-0.5, 0.0)` and `(-0.5, -0.125)`, which are not vertices. The left side is the single straight edge from `(-0.5, -0.375)` to `(-0.5, 0.5)`.

## Authored Shape

`app/src/game/data/shapes.json` carries this clockwise vertex list:

```json
"paladin-body": [
  { "x": -0.5, "y": -0.375 },
  { "x": -0.333333, "y": -0.5 },
  { "x": 0.166667, "y": -0.5 },
  { "x": 0.333333, "y": -0.375 },
  { "x": 0.5, "y": 0 },
  { "x": 0.5, "y": 0.125 },
  { "x": 0.333333, "y": 0.5 },
  { "x": -0.5, "y": 0.5 }
]
```

## Post-V11 Follow-Up - 2026-11-05

The user superseded the asymmetric 6 x 8 hull for the shipped body. The player now uses the **symmetric 5 x 7 body core** at `0.556 x 0.778` tiles with the approved `beveled-octagon` silhouette, removing the lateral sword-arm bump and shortening the height by one native pixel. The `paladin-body` shape is no longer authored; this record remains the evidence for the V11 attempt and the reason the body was later simplified. Both encounters take the follow-up comparison break: `crystal-worm-child-swarm-paladin-v7` and `killer-bee-queen-nest-paladin-v11`.

## What This Record Does Not Establish

- The Paladin class image is a single front-facing frame. It is not an animation, a facing model or a client hitbox.
- The selected body cells are a trainer's reading of that frame, not a recovered client hitbox or a verified ROTMG player size.
- ROTMG players report the real player hitbox as a 1 x 1-tile square. That is community evidence, not a wiki stat, and is deliberately not adopted: decision Q11 keeps collision on the visible body.
- The body's shape is a convex approximation. The sprite's non-convex details (the gap between the feet, the bent arm) are inside the hull and are not modelled.

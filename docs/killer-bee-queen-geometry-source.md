# Killer Bee Queen Geometry Source

Evidence record for the arena geometry, floor zones and entity scale measured from user-supplied screenshots of the Killer Bee Queen encounter, feeding plan V10's sprite-scale re-anchor.

| Field | Value |
| ----- | ----- |
| Provenance | Six screenshots supplied by the user on 2026-11-04. Images 1, 2, 11, 12 and 13 share one zoom. Image 9 is camera-rotated and was discarded. Image 10 is a thumbnail. |
| Image files | **None committed.** This record carries only the derived measurements. |

## Method

The screenshots were PNG-decoded and measured with four independent techniques:

- (a) **Horizontal constant-colour run-length histograms** over clean floor patches, to find the native sprite pixel.
- (b) **Detrended autocorrelation** of floor brightness profiles, to find periodic structure.
- (c) **Per-row first/last walkable-floor scans** with a blue-channel threshold, to exclude the waxy wall band.
- (d) **Connected-component bounding boxes** with per-sprite colour predicates, for entity sizes.

## Tile Derivation

Run-length peaks land at 5-6 px with harmonics at 11-13 and 18-19, across three independent screenshots (means 6.25, 6.49 and 6.31 px over runs of 3-12 px). This gives a 6.44 px native sprite pixel and a 51.5 px ground tile at 8 native pixels.

The 25.75 px period also present is the half-tile pattern inside each ground tile sprite and is **not** the tile.

## Room Table

The walkable span runs from x=104 to x=1081, centre x=592.5, giving 9.49 tiles.

Three-row chamfer table:

| Row | Left edge | Half-width (tiles) | \|y\| (tiles) | Sum |
| --- | --------- | ------------------- | -------------- | --- |
| 78  | 208       | 7.46                | 6.81           | 14.28 |
| 130 | 156       | 8.48                | 5.80           | 14.28 |
| 182 | 104       | 9.49                | 4.79           | 14.28 |

A circle fit over the same rows drifts from R=9.8 to R=11.5 and cannot produce the straight sides.

## Floor-Zone Table

| Zone | Tiles | Appearance | User count |
| ---- | ----- | ---------- | ---------- |
| A | 0-2.65 | darker orange honey | 0-3 |
| B | 2.65-5.45 | pale broken tiles, safe | 4-7 |
| C | 5.55-7.65 | bright orange honeycomb, safe | 4-7 |
| D | 7.8-9.49 | darker orange honey | 8-10 |
| wall | 9.49-10.6 | waxy yellow, not walkable | - |

Zones B and C differ in look only.

## Entity Table

| Entity | Native | Measured | Tiles | Authored |
| ------ | ------ | -------- | ----- | -------- |
| Yellow/blue/red ball | 8x8 | 45-48px over 13 instances | 0.87-0.93 | 0.889x0.889 |
| Player body | 8x8 | 43x44px | 0.835x0.854 | 0.889x0.889 |
| Player health bar | - | 48px | 0.93 | not modelled |
| Hive shots | 12.25x7 native after the 4x fix | 55-74px rotated | 1.07-1.44 | 1.361x0.778 |
| Killer Bee Queen | - | 2.2-2.9 across | - | unchanged at 2x2 per wiki "Hitbox Size 2" |

`49 x 28 = 4 x (12.25 x 7)`.

## Addenda

**2026-11-05 - the 0.889 player body is the frame, not the character's body.** The entity table's `Player body` row describes the full 8 x 8 frame and its visible mask. The current player's **body** is the 6 x 8 body-and-arm mask of the RealmEye Paladin class image, `0.667 x 0.889` tiles, recorded in [the player body source record](player-body-source.md). The `9.0` native-pixels-per-tile scale and the 8 x 8 frame are unchanged; the old `0.889 x 0.889` value stands only as the frame derivation, not as the current body.

## What This Record Does Not Establish

- The pond's radius is the user's in-game tile count, not a measurement, because the Queen's sprite covers the pond in every centre screenshot.
- The vertical flat half-width is inferred from symmetry and the chamfer constant, because image 12's top is under the boss bar and its bottom under the chat log.
- No honey band boundary was measurable to better than about two tiles, so W07's radii are the user's counts.

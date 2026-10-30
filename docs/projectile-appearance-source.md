# Killer Bee Queen Projectile Appearance Source

Evidence record for the code-generated projectile pixel art in plan V6. It is the single source for the 19 appearance families and their seven shape templates.

| Field | Value |
| ----- | ----- |
| Page | `https://www.realmeye.com/wiki/killer-bee-queen` |
| Retrieved | 2026-10-29 |
| Method | `curl` with a desktop user agent; the RealmEye projectile table was then parsed from the rendered HTML |
| Table columns | Aesthetics, Damage, Condition effects, Speed (tiles/sec), Range (tiles), Comments |
| Hitbox data | **None.** The table publishes no projectile hitbox or size column. The sprite image is the only size evidence. |
| Local reference copies | `docs/reference/projectile-sprites/` (gitignored; not shipped) |

## Scale Derivation

The ROTMG player character sprite is 16 x 16 native pixels. This project's player body is 1.25 x 1.25 tiles. The conversion used by plan V6 is therefore:

```
16 native pixels / 1.25 tiles = 12.8 native sprite pixels per world tile
```

This is a **trainer interpretation for P04**, not a wiki-published hitbox. The wiki gives no projectile hitbox value.

The wiki renders small sprites upscaled 5x for visibility. The stingers, balls, glaives and bee therefore have native grids of 7 x 1, 8 x 5, 8 x 8, 8 x 8 and 8 x 6. The hive images are rendered at 1x and their native grid is **49 x 28**; they must not be divided by a cell size.

## Templates

Palette letters are per appearance. `.` is transparent.

### stinger-small (7 x 1)

```text
AAABCDE
```

### stinger-large (8 x 5)

```text
AB......
.CDEA...
..CCDEAB
.CDEA...
AB......
```

### ball (8 x 8)

```text
...AA...
..ABBA..
.ABCCBA.
ABCDDCBA
ABCDDCBA
.ABCCBA.
..ABBA..
...AA...
```

### glaive (8 x 8)

```text
A......A
.BC..CB.
.CB..DC.
...DB...
...BD...
.CD..BC.
.BC..CB.
A......A
```

### hive-shot (49 x 28)

```text
...............................A......A..........
..............................AAA....AAA.........
.............................AAAAA..AAAAA........
............................AAAAAAAAAAAAAA.......
.............AA.....AA.....BBAAAAABBAAAAAAA......
............AAAA...AAAA...BBBBAAABBBBAAAAAAA.....
...........AAAAAA.AAAAAA.BBBBBBABBBBBBAAAAAAA....
..........BAAAAAABAAAAAABBBBBBBBBBBBBBBAAAAAAA...
.........BBBAAAABBBAAAABBBBBBBBBBBBBBBBBAAAAAAA..
........BBBBBAABBBBBAABBBBBBBBBBBBBBBBBBBAAAAAAA.
.......BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAAAA
........BBBBB..BBBBBCCBBBBBCCBBBBBBBBBBBBAAAAAAA.
.........BBB....BBBCCCCBBBCCCCBBBBBBBBBBAAAAAAA..
..........B......BCCCCCCBCCCCCCBBBBBBBBAAAAAAA...
...A......A......ACCCCCCACCCCCCBBBBBBBBAAAAAAA...
..AAA....AAA....AAACCCCAAACCCCBBBBBBBBBBAAAAAAA..
.AAAAA..AAAAA..AAAAACCAAAAACCBBBBBBBBBBBBAAAAAAA.
AAAAAAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBAAAAAAA
.AAAAA..AAAAA..AAAAABBAAAAABBBBBBBBBBBBBBAAAAAAA.
..AAA....AAA....AAABBBBAAABBBBBBBBBBBBBBAAAAAAA..
...A......A......ABBBBBBABBBBBBBBBBBBBBAAAAAAA...
..................BBBBBB.BBBBBBABBBBBBAAAAAAA....
...................BBBB...BBBBAAABBBBAAAAAAA.....
....................BB.....BBAAAAABBAAAAAAA......
............................AAAAAAAAAAAAAA.......
.............................AAAAA..AAAAA........
..............................AAA....AAA.........
...............................A......A..........
```

### bee-shot (8 x 6)

```text
AA.AA...
AABCA...
.DBD....
...AA.AA
...AABCA
....DBD.
```

### bomb-explosion (five frames)

The wiki bomb image is a five-frame explosion strip, not an in-flight bomb body. The strip's frames measure **4 x 4, 5 x 5, 7 x 8, 9 x 10 and 13 x 12 pixels**, each with a one-pixel black border and a solid family fill. The runtime deliberately uses square **4/5/7/9/13** frames as a decorative simplification, because the effect is scaled to the 2/3-tile detonation radius and the one-to-two-pixel height difference is not visible. Do not record the wiki frames themselves as square. Palette letter `A` is the black outline, `B` is the family fill colour.

There is no wiki in-flight bomb body. The in-flight body keeps this project's existing 0.6 x 0.6 octagon, coloured with the family fill. The detonation radius remains the sourced 2 or 3 tiles.

## Appearances

| Family | Sprite alt | Image | Local file | Template | Palette | Source row |
| ------ | ---------- | ----- | ---------- | -------- | ------- | ---------- |
| `red-stinger-small` | EH Queen Red Stinger Small | `/s/a/img/wiki/i/04dTdIt.png` | `EH-Queen-Red-Stinger-Small_04dTdIt.png` | stinger-small | A `#191919`, B `#333333`, C `#A60F0F`, D `#C32416`, E `#F75B28` | 1 |
| `red-stinger-large` | EH Queen Red Stinger Large | `/s/a/img/wiki/i/iDHw2HV.png` | `EH-Queen-Red-Stinger-Large_iDHw2HV.png` | stinger-large | A `#C32416`, B `#F75B28`, C `#191919`, D `#333333`, E `#A60F0F` | 2, 21, 23 |
| `yellow-stinger-small` | EH Queen Yellow Stinger Small | `/s/a/img/wiki/i/Do9AeD5.png` | `EH-Queen-Yellow-Stinger-Small_Do9AeD5.png` | stinger-small | A `#191919`, B `#333333`, C `#CC9220`, D `#FFCF3F`, E `#FFE9AA` | 3, 22 |
| `yellow-stinger-large` | EH Queen Yellow Stinger Large | `/s/a/img/wiki/i/KPmpzqM.png` | `EH-Queen-Yellow-Stinger-Large_KPmpzqM.png` | stinger-large | A `#FFCF3F`, B `#FFE9AA`, C `#191919`, D `#333333`, E `#E5B42D` | 4 |
| `blue-stinger-small` | EH Queen Blue Stinger Small | `/s/a/img/wiki/i/kplyeum.png` | `EH-Queen-Blue-Stinger-Small_kplyeum.png` | stinger-small | A `#191919`, B `#333333`, C `#002E8C`, D `#004C99`, E `#006599` | 5, 18 |
| `blue-stinger-large` | EH Queen Blue Stinger Large | `/s/a/img/wiki/i/1kpmZbT.png` | `EH-Queen-Blue-Stinger-Large_1kpmZbT.png` | stinger-large | A `#004C99`, B `#006599`, C `#191919`, D `#333333`, E `#002E8C` | 6 |
| `red-ball` | EH Red Ball | `/s/a/img/wiki/i/NdTEate.png` | `EH-Red-Ball_NdTEate.png` | ball | A `#84000B`, B `#BE000E`, C `#F1442E`, D `#EE773D` | 14 |
| `yellow-ball` | EH Yellow Ball | `/s/a/img/wiki/i/h9uxKqq.png` | `EH-Yellow-Ball_h9uxKqq.png` | ball | A `#FFE97F`, B `#FFE9AA`, C `#FFBA20`, D `#FFFFFF` | 10, 19 |
| `blue-ball` | EH Blue Ball | `/s/a/img/wiki/i/vSjo4WL.png` | `EH-Blue-Ball_vSjo4WL.png` | ball | A `#00143C`, B `#0025B4`, C `#157EA2`, D `#1EAAA1` | 8, 9, 20 |
| `red-glaive` | EH Red Glaive | `/s/a/img/wiki/i/tKtZKn2.png` | `EH-Red-Glaive_tKtZKn2.png` | glaive | A `#84000B`, B `#F1442E`, C `#BE000E`, D `#FFCEC9` | 7, 12 |
| `yellow-glaive` | EH Yellow Glaive | `/s/a/img/wiki/i/HPORFx7.png` | `EH-Yellow-Glaive_HPORFx7.png` | glaive | A `#FFBA20`, B `#FFE9AA`, C `#FFDF7F`, D `#FFFFFF` | 11 |
| `blue-glaive` | EH Blue Glaive | `/s/a/img/wiki/i/0fb10hx.png` | `EH-Blue-Glaive_0fb10hx.png` | glaive | A `#00143C`, B `#157EA2`, C `#0025B4`, D `#CCF2FF` | 13 |
| `hive-spiral-shot` | EH Hive Spiral Shot | `/s/a/img/wiki/i/RYiXLpd.png` | `EH-Hive-Spiral-Shot_RYiXLpd.png` | hive-shot | A `#84000B`, B `#F1442E`, C `#ED7842` | 15 |
| `hive-range-shot` | EH Hive Range Shot | `/s/a/img/wiki/i/ZZXKmbz.png` | `EH-Hive-Range-Shot_ZZXKmbz.png` | hive-shot | A `#00143C`, B `#004F9F`, C `#1EA9A1` | 16 |
| `hive-shot` | EH Hive Shot | `/s/a/img/wiki/i/ng5PN7f.png` | `EH-Hive-Shot_ng5PN7f.png` | hive-shot | A `#FFBA20`, B `#FFDF7F`, C `#FFFFFF` | 17 |
| `bee-shot` | EH Bee Shot | `/s/a/img/wiki/i/1r68C02.png` | `EH-Bee-Shot_1r68C02.png` | bee-shot | A `#F2F2F2`, B `#0C0C0C`, C `#FF9B18`, D `#E57711` | 24 |
| `red-bomb` | Red Bomb | `/s/a/img/wiki/i/TU4xQap.png` | `Red-Bomb_TU4xQap.png` | bomb-explosion | A `#000000`, B `#FF0000` | 25, 26 |
| `white-bomb` | White Bomb | `/s/a/img/wiki/i/xlsPmeL.png` | `White-Bomb_xlsPmeL.png` | bomb-explosion | A `#000000`, B `#FFFFFF` | 27, 28 |
| `blue-bomb` | Blue Bomb | `/s/a/img/wiki/i/K1fBe65.png` | `Blue-Bomb_K1fBe65.png` | bomb-explosion | A `#000000`, B `#0000FF` | 30 |

Image URLs are relative to `https://www.realmeye.com`.

## Projectile Mapping

The mapping from family to projectile id is recorded in [plan V6](implementation-plan-v6.md#appearance-families). It covers 44 Queen entries. The Crystal Worm's `crystal-worm-child-shard` is deliberately excluded (P11).

## Provenance And Distribution

The original PNGs are not committed or shipped. The local copies exist only for visual QA and are gitignored. The recreated pixel grids are data and code, not image assets. Licensing review is deferred as D15 in [the deferred register](deferred-work.md).

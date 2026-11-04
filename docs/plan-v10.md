# Plan V10: The Boss Room's True Scale, Its Octagon And Killer Honey

Phases 37-40. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phases 37-40 build and why. It is not authorization to implement a phase by itself.

This plan corrects the project's world scale, replaces the Killer Bee Queen's circular arena with the real boss room's octagon, adds Killer Honey as a floor hazard, and makes the Queen spawn at the arena centre. It changes no cadence, no projectile stat, no condition and no phase structure.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phases 37-40. Later explicit user decisions override older statements; record changes here.
- [The V9 archive](plan-v9.md): the phase-3 retune. Its confirmed design stands in every respect not listed below.
- [The source extract](killer-bee-queen-source.md): the wiki evidence for the Queen. Unchanged by this plan.
- [The appearance source record](projectile-appearance-source.md): the pixel-art provenance. This plan appends two dated corrections to it and edits none of its existing text (W22).
- [The geometry evidence record](killer-bee-queen-geometry-source.md): written by step 37.1 from the Measurement Evidence section below. It is the citation for every measured number here.
- RealmEye, retrieved 2026-11-04 with `curl` and a desktop user agent:
  - `https://www.realmeye.com/wiki/killer-honey` - "Killer Honey combines the effects of Honey / Quicksand and Evil Water. The longer players stand in Killer Honey, the slower they become. In addition, Killer Honey deals 60 armor piercing damage and reduces player's movement speed by 25%." Page states "Last updated: Exalt Version 5.14.0.0 (July 2025)".
  - `https://www.realmeye.com/wiki/the-nest` - "Rooms consist of orange honeycomb tiles and pools of Killer Honey scattered throughout. Killer Honey deals 60 armor piercing damage to players in it and slows them down more the longer they stand in the honey. Broken yellow tiles form pathways on top of the Killer Honey."
  - `https://www.realmeye.com/wiki/evil-water` - "Evil Water does 55 armor piercing damage per every second you are in Evil Water." The only per-second phrasing in the family; it is the basis of W11's inferred interval and is **not** a Killer Honey fact.
  - `https://www.realmeye.com/wiki/honey` and `.../quicksand` - the progressive slow is described qualitatively with no numbers anywhere, which is why W09's ramp is trainer-authored.
- [The mechanics contract](mechanics.md): the encounter rules in force. Phase 40 records this plan's additions there.
- [The deferred register](deferred-work.md): D01 is partially pre-empted by W32 and otherwise stays deferred; D23 records the hive sizing this plan does not split per variant.
- [The project instructions](../AGENTS.md): ownership, test discipline and verification.

## Completed Baseline

Phases 1-36 are complete. The deployed runtime is the V9 release: the Crystal Worm, the Killer Bee Queen under `killer-bee-queen-nest-paladin-v8` with its video-measured phase 3, the 19-family pixel-art appearance catalog with sprite-derived hitboxes, and the phase selector with drill sets.

The geometry situation this plan addresses:

- `arena.json` holds **one shared circular arena** at radius 19.2 tiles, used by both encounters under decision K05. The real boss room is an octagon of half-width 9.5 tiles, so the trainer's arena is about four times the real area.
- `projectile-appearances.json` sets a single global `pixelsPerTile: 12.8`, derived in the appearance source record from the claim "the ROTMG player character sprite is 16 x 16 native pixels" over a 1.25-tile player body. The screenshots contradict that claim (see Measurement Evidence).
- The same record states the hive sprite grids are "rendered at 1x" at 49 x 28 native pixels. The screenshots contradict that too: 49 x 28 is a 4x render of a roughly 12 x 7 native grid.
- The Queen's encounter spawn placement is `arena-ring` at `ringRadiusFraction: 0.84375`, so starting a phase-3 drill puts her 16.2 tiles out and walks her to the centre at 3 tiles/s over about 5.4 seconds.
- `drawGround` draws a flat circle with a tile grid. There is no terrain model of any kind: no floor region ever changes a rule.

## Approaches Considered

- **Keep the 19.2-tile circle and only resize sprites.** Rejected: the user's floor tile counts cannot be reconciled with a 19.2-tile radius, and a four-times-too-large arena makes every sourced projectile range (1.875-11.05 tiles) cover a quarter of the arena instead of the whole of it.
- **Hand-trace the room's stepped tile outline.** Rejected after measurement. The staircase in the screenshots is the tile rasterisation of two straight lines: flat sides at 9.5 tiles and 45-degree corners at `|x| + |y| = 14.25` tiles, which reproduce it from two sourced numbers instead of a hundred authored vertices that no screenshot can fully source (W03).
- **A general convex-polygon arena.** Rejected as the first step. An eight-half-plane octagon is a small, closed-form extension; a general polygon type rewrites the circle path the Crystal Worm still uses and widens its comparison break for no gain (W04).
- **Reuse the `slowed` condition for honey.** Rejected: the wiki defines Slowed as SPD to 0, which is 4.0 tiles/s for this Paladin, a 43% cut. Killer Honey is a flat 25% cut. Reusing the condition would both misreport the HUD chip and apply the wrong number (W10).
- **Promote D01 in full.** Rejected. The static outer honey rim is adopted because it is what every one of the user's screenshots shows, and that is recorded as a deliberate partial pre-emption of D01 (W32); the mid-fight flooding and the phase-5 hardening stay deferred.

## Confirmed Design

The V9 confirmed design stands in every respect not listed here. No cadence, projectile stat, condition, phase, sub-phase, telegraph, threshold or progression value changes in this plan.

Phases 37-40 add exactly these elements, and nothing else:

- **One world scale, re-anchored on measurement.** A ground tile is 51.5 screen pixels in the user's screenshots, so the native sprite pixel is 6.44 screen pixels. Entity sprites draw at 0.889 tiles per 8 native pixels, which fixes `pixelsPerTile` at **9.0**. Every appearance rescales from that single value; the three hive appearances additionally divide by a recorded `sourceUpscale: 4`.
- **A player body of 0.889 tiles**, the same 8 x 8 native grid at the same scale as every projectile, replacing the 1.25 tiles that the corrected 16 x 16 claim had produced.
- **Arena definitions keyed by id.** `arena.json` becomes a map of named arenas and each encounter references one by `arenaId`. The Crystal Worm keeps a circle at radius 19.2 and no terrain; the Queen gets the Nest boss room. This supersedes K05's single shared arena.
- **An octagonal arena shape** for the Queen: flat sides at 9.5 tiles, 45-degree corners at `|x| + |y| = 14.25` tiles, symmetric in x and y. Containment becomes an eight-half-plane test; the circle path stays for the Crystal Worm.
- **Killer Honey as authored hazard regions** on an arena: the centre pond as a diamond of 7-tile diagonals, and an outer ring from 7.5 to 9.5 tiles. Everything an arena does not list as hazard is safe floor. There are exactly two behavioural floor kinds.
- **Honey movement penalty**: a flat 0.75 multiplier from the wiki, plus a trainer-authored ramp of a further 0.05 per second of continuous contact, floored at a 0.50 total multiplier, reset to zero the instant the player leaves honey.
- **Honey damage**: 60 armor-piercing HP on a 1.0-second per-player clock while the player's body centre is inside a hazard region, counted in `hitsTaken`, the hit log and the hit audio like any other damage, and inert until the attempt is `playing`.
- **Player only.** No enemy, minion or projectile is affected by terrain.
- **Procedural floor art**: a two-tone honeycomb cell pattern for safe floor, an amber fill with a lighter rim for honey, and the octagon drawn as its tile staircase. No transcribed tile pixel grids and no image asset.
- **Two retuned radii**, and only two: the Queen's phase-1 orbit from 10 to 8.0 tiles and the yellow Adolescent Beehemoth's orbit from 16 to 8.0 tiles, because those are the only authored radii that fall outside a 9.5-tile arena.
- **Arena-centre spawn placement** for the Queen, and a drill phase switch that repositions her there.
- **One comparison break for the whole plan**: `crystal-worm-child-swarm-paladin-v5` and `killer-bee-queen-nest-paladin-v9`, both bumped once in phase 37.

Nothing else is added. In particular: no change to any attack cadence, pattern, arm count or rotation; no change to any projectile's damage, speed, range, motion kind or conditions; no change to the bomb detonation radii; no new `tuningSource` literal; no HUD honey indicator; no separate environmental-damage counter; no mid-fight terrain mutation; no wall entities, Maggot Eggs, pet, player weapon or player ability; no change to `cssPixelsPerTile`; and no per-variant hive sizes.

## Measurement Evidence

Transcribed here so it is durable; step 37.1 writes it into [the geometry evidence record](killer-bee-queen-geometry-source.md) with the method. Source: six user screenshots supplied 2026-11-04, decoded and measured directly. Images 1, 2, 11, 12 and 13 share one zoom; image 9 is camera-rotated and was discarded; image 10 is a thumbnail.

**The tile.** Horizontal constant-colour run lengths in clean floor peak at 5-6 px with harmonics at 11-13 and 18-19, in three independent screenshots (means 6.25, 6.49, 6.31 px over runs of 3-12 px). The native sprite pixel is therefore 6.44 screen px and a ground tile, at 8 native pixels, is **51.5 screen px**. A 25.75 px period also exists; it is the half-tile pattern inside each ground tile sprite and is not the tile.

**The room.** Image 12, horizontal scanline at the room's vertical centre: void, then the waxy wall band, then walkable floor from x 104 to x 1081, then the wall band, then void. Centre x = 592.5, half-width 488.5 px = **18.97 half-tiles = 9.49 tiles**. The upper-left corner staircase steps exactly 2 tiles across per 2 tiles down, and its three frame-clean rows give a constant diagonal sum:

| row y | left edge x | half-width | `|y|` from centre | sum |
| ----: | ----------: | ---------: | ----------------: | --: |
| 78 | 208 | 7.46 t | 6.81 t | 14.28 |
| 130 | 156 | 8.48 t | 5.80 t | 14.28 |
| 182 | 104 | 9.49 t | 4.79 t | 14.28 |

A circle fit over the same rows drifts from R = 9.8 to R = 11.5 and cannot produce the long straight sides, so the room is an octagon, not a rasterised circle.

**The floor zones.** Image 2, same scanline method, centre x = 617:

| Zone | radius (tiles) | look | user's tile count |
| ---- | -------------- | ---- | ----------------- |
| A | 0 - 2.65 (obscured by the Queen) | darker orange | 0-3, honey |
| B | 2.65 - 5.45 | pale broken tiles | 4-7, safe |
| C | 5.55 - 7.65 | bright orange honeycomb | 4-7, safe |
| D | 7.8 - 9.49 | darker orange | 8-10, honey |
| wall | 9.49 - 10.6 | waxy yellow blocks | not walkable |

Image 12 gives D's thickness independently as 3.7 half-tiles = 1.85 tiles. B and C differ in look only; W06 makes them one behavioural kind.

**Entities**, at 51.5 px per tile:

| Sprite | Native grid | Measured | In tiles | Authored at `pixelsPerTile: 9.0` |
| ------ | ----------- | -------- | -------- | -------------------------------- |
| Yellow / blue / red ball | 8 x 8 | 45-48 px, 13 instances | 0.87-0.93 | 0.889 x 0.889 |
| Player body | 8 x 8 | 43 x 44 px | 0.835 x 0.854 | 0.889 x 0.889 |
| Player health bar | - | 48 px | 0.93 | not modelled |
| Hive shots | 12.25 x 7 after the 4x fix | 55-74 px wide, rotated | 1.07-1.44 | 1.361 x 0.778 |
| Killer Bee Queen | - | 2.2-2.9 across | - | unchanged at 2 x 2 (wiki "Hitbox Size 2") |

The hive figure is the evidence for W18's `sourceUpscale`: 49 x 28 is 4 x (12.25 x 7), and the uncorrected grid would make a hive shot 5.44 tiles wide, four times what every screenshot shows.

## Named Constants

Stated once here. Phase files reference the decision id rather than repeating the value.

| Value | Constant | Decision |
| ----- | -------- | -------- |
| Native sprite pixels per tile | 9.0 | W17 |
| Hive appearance source upscale | 4 | W18 |
| Player body | 0.889 x 0.889 tiles | W20 |
| Queen body | 2 x 2 tiles (unchanged) | W21 |
| Nest arena flat half-width | 9.5 tiles | W03 |
| Nest arena corner sum | 14.25 tiles | W03 |
| Crystal Worm arena radius | 19.2 tiles (unchanged) | W05 |
| Centre honey pond half-diagonal | 3.5 tiles | W07 |
| Outer honey ring | 7.5 to 9.5 tiles | W07 |
| Honey flat speed multiplier | 0.75 | W09 |
| Honey ramp per second of contact | 0.05 | W09 |
| Honey total multiplier floor | 0.50 | W09 |
| Honey damage | 60 HP, armor piercing | W11 |
| Honey damage interval | 1.0 s | W11 |
| Queen phase-1 orbit radius | 8.0 tiles (was 10) | W27 |
| Yellow Beehemoth orbit radius | 8.0 tiles (was 16) | W27 |
| Crystal Worm rules version | `crystal-worm-child-swarm-paladin-v5` | W28 |
| Queen rules version | `killer-bee-queen-nest-paladin-v9` | W28 |

Derived, not authored: the Paladin's unimpeded speed is 7.061 tiles/s, so honey gives 5.296 tiles/s on entry and 3.531 tiles/s at the ramp floor, reached after 5.0 seconds of continuous contact.

## Recorded User Decisions - 2026-11-04

- **W01 - One plan, not two.** Sprite scale, the arena and the spawn fix ship together, because they share one comparison break and one verification run.
- **W02 - A ground tile is 51.5 screen pixels.** Established by the run-length evidence above and confirmed by the user counting floor squares. This supersedes the 25.75 px figure used in earlier rounds of this brainstorm and every number derived from it.
- **W03 - The arena is an axis-aligned octagon**: flat sides at 9.5 tiles, 45-degree corners at `|x| + |y| = 14.25` tiles, symmetric in x and y. The tile staircase the screenshots show is produced by rasterising it for drawing, not authored.
- **W04 - Containment gains an arena `kind` union, `circle | octagon`.** The circle path is untouched and the Crystal Worm keeps using it.
- **W05 - Arenas are keyed by id and referenced per encounter.** Supersedes K05's single shared `arena.json`.
- **W06 - Two behavioural floor kinds only**, honey and safe floor. The wiki gives no behavioural difference between orange honeycomb and the broken-tile pathways, so the B/C look difference is cosmetic.
- **W07 - The hazard regions.** Centre pond honey, a diamond of 7-tile diagonals (3.5-tile half-diagonal); outer honey ring from 7.5 to 9.5 tiles. The user's count of a 3-tile rim includes the wall's first row, which is not walkable, so the authored rim is 2 tiles and the arena half-width stays 9.5.
- **W08 - The pond is a diamond; the ring is an annulus.** Mixed region shapes are deliberate: the pond's shape is a direct observation, the ring follows the wall.
- **W09 - The movement penalty, and its invented part.** The flat 0.75 is from the wiki. The further 0.05 per second of continuous contact and the 0.50 floor are **trainer-authored**: no published number for the progressive slow exists on any of the Honey, Quicksand or Killer Honey pages. The ramp resets to zero on leaving honey; there is no decay rate, which would be a second invented number.
- **W10 - A terrain speed multiplier, not the `slowed` condition.** Honey never sets a condition and never lights a HUD chip.
- **W11 - Honey damage is 60 armor-piercing HP on a 1.0-second clock.** The 60 and the armor piercing are wiki facts. The 1.0-second interval is an **inference** from Evil Water's published "55 armor piercing damage per every second", recorded as an inference and never as a Killer Honey fact.
- **W12 - The occupancy test is the player body's centre**, not a convex overlap, matching the tile-under-your-feet rule and adding no geometry.
- **W13 - Player only, and only while playing.** No enemy, minion or projectile is affected; honey is inert until the attempt is `playing`, so the start countdown cannot damage the player.
- **W14 - Honey damage uses the existing hit path.** It appears in `hitsTaken`, the hit log and the hit audio. There is no separate environmental counter.
- **W15 - No honey indicator in the HUD.** The region is visible and the speed change is felt.
- **W16 - Procedural floor art, deliberately not one-to-one.** A two-tone honeycomb cell pattern and an amber honey fill with a lighter rim. No tile pixel grids are authored and no asset is shipped.
- **W17 - `pixelsPerTile` becomes 9.0**, derived as 8 native pixels over the measured 0.889-tile ball.
- **W18 - Every appearance rescales from that one value**, and the three hive appearances carry `sourceUpscale: 4`. The hive grids are not resampled; only their world size is divided, so the art is unchanged.
- **W19 - Hitboxes scale with sprites**, keeping the existing sprite-derived-hitbox rule as the single source of truth. The ball hitbox grows about 1.42x against the tile; that is accepted.
- **W20 - The player body becomes 0.889 x 0.889 tiles**, the shared 8 x 8 derivation rather than the 0.835 direct measurement, so no body uses its own scale.
- **W21 - The Queen's body stays 2 x 2 tiles.** Her wiki-cited "Hitbox Size 2" is already consistent once the tile is 51.5 px, and the measured sprite (2.2-2.9 tiles) brackets it. This reverses an earlier round's answer to re-derive it, now that the scale is corrected.
- **W22 - Corrections to the appearance source record are appended, never rewritten.** Two dated notes: the player sprite is not 16 x 16 native, and the hive grids are a 4x render.
- **W23 - No new `tuningSource` literal.** `validTuningSources` is untouched. Sizes are cited in each appearance's existing `source` string and in the geometry evidence record. This plan tunes nothing; it corrects scale and adds an arena.
- **W24 - The geometry evidence is committed** as `docs/killer-bee-queen-geometry-source.md`, with the method, the screenshot provenance and every table above.
- **W25 - The Queen's encounter spawn placement becomes `arena-center`.** One field, covering the full fight and every drill.
- **W26 - A live drill phase switch repositions the primary enemy** to the encounter spawn placement, so switching to phase 3 mid-run puts her at the centre exactly as a fresh drill start does.
- **W27 - Exactly two radii are retuned**, the only two that fall outside a 9.5-tile arena: the Queen's phase-1 orbit 10 to 8.0 and the yellow Adolescent Beehemoth's orbit 16 to 8.0. 8.0 is 0.84 of the new half-width, preserving each one's "circling the room" and "along the edges of the room" reading. Every other authored radius (3, 4, 5, 6) already fits.
- **W28 - One comparison break for the whole plan, taken in phase 37.** Both encounters bump once; phases 38-40 do not bump again, because V10 ships as one rules identity.
- **W29 - `cssPixelsPerTile` stays 32.** With the arena at 9.5 tiles the whole room fits in about 608 px at zoom 1, which suits a dodge trainer; the zoom control covers taste.
- **W30 - Verification.** Focused Vitest per step; `npm run verify` once at the end of each phase that changes code under `app/`; one new Playwright case in phase 40. No full e2e suite. No commit, push or deployment without explicit authorization.
- **W31 - Out of scope.** The pet, the player's shot, the player's ability, Maggot Eggs, wall entities, transcribed floor pixel art, and D01's mid-fight flooding and phase-5 hardening.
- **W32 - The static outer honey rim is an approved partial pre-emption of D01.** Every screenshot the user supplied shows the rim, including at 74% HP, so the trainer authors it in every phase. D01's *mutation* - the progressive flood at 90% HP, the hardening at 45% and the disconnect-on-changing-tile - stays deferred, as does its interaction with a time-varying arena. `AGENTS.md`'s shrinking-arena exclusion is not touched: the arena is static and honey never blocks movement.

## Architecture

The V9 boundary table stands. This plan adds one row and widens two existing ones:

| Concern | Home under `app/src` | Owns |
| ------- | -------------------- | ---- |
| Terrain rules (new) | `game/simulation/terrain.ts` | Pure hazard occupancy, the honey speed multiplier and the honey damage clock |
| Arena geometry (widened) | `game/simulation/geometry.ts` | The octagon containment variant beside the existing circle one |
| Authored arenas (widened) | `game/data/arena.json`, `game/config/data.ts` | The keyed arena map, the shape union and the hazard regions |

Constraints:

- `terrain.ts` is pure: no React, no Phaser, no DOM, no clock. It takes an arena and a position and returns facts. The simulation owns when it is called and what it does with the answer.
- The octagon variant lives beside `maximumBodyCenterDistance`, not instead of it. `constrainBodyToArena` dispatches on `arena.shape.kind` and nothing else in the simulation learns about shapes.
- Rendering reads the authored arena and derives the tile staircase at draw time. No rasterised outline is stored in authored data or in simulation state.
- No new module may read `ENCOUNTER_CONFIG` at module level; the arena and its hazards come from `state.config`, as step 23.1 established.

## Target Data Shapes

`app/src/game/data/arena.json` becomes a keyed map. Both arenas are authored in this plan:

```json
{
  "comment": "Named arenas (W05, superseding K05). Each encounter references one by arenaId.",
  "arenas": {
    "crystal-worm-circle": {
      "kind": "circle",
      "centerTiles": { "x": 0, "y": 0 },
      "radiusTiles": 19.2,
      "hazards": []
    },
    "nest-boss-room": {
      "kind": "octagon",
      "centerTiles": { "x": 0, "y": 0 },
      "flatHalfWidthTiles": 9.5,
      "cornerSumTiles": 14.25,
      "hazards": [
        { "kind": "honey", "region": { "shape": "diamond", "halfDiagonalTiles": 3.5 } },
        { "kind": "honey", "region": { "shape": "annulus", "innerRadiusTiles": 7.5, "outerRadiusTiles": 9.5 } }
      ]
    }
  }
}
```

Runtime types in `models.ts`:

```ts
export type ArenaShape =
  | Readonly<{ kind: "circle"; centerTiles: Vector2; radiusTiles: number }>
  | Readonly<{
      kind: "octagon";
      centerTiles: Vector2;
      /** Distance from centre to each of the four axis-aligned flat sides. */
      flatHalfWidthTiles: number;
      /** The 45-degree corner faces, as |x| + |y| measured from centre (W03). */
      cornerSumTiles: number;
    }>;

/** Everything an arena does not list is safe floor (W06). */
export type TerrainRegion =
  | Readonly<{ shape: "diamond"; halfDiagonalTiles: number }>
  | Readonly<{ shape: "annulus"; innerRadiusTiles: number; outerRadiusTiles: number }>;

export type HazardBand = Readonly<{ kind: "honey"; region: TerrainRegion }>;

export type Arena = Readonly<{ shape: ArenaShape; hazards: readonly HazardBand[] }>;

/** `CircularArena` remains, as the shape union's circle member, so the Crystal Worm path is unchanged. */
export type CircularArena = Extract<ArenaShape, { kind: "circle" }>;
```

`PlayerState` gains exactly two fields:

```ts
  /** Seconds of unbroken honey contact; drives the W09 ramp, reset to 0 on leaving. */
  honeyContactSeconds: number;
  /** Simulation time the next honey tick is due; 0 means "due immediately" (W11). */
  nextHoneyDamageAtSeconds: number;
```

`projectile-appearances.json`: `pixelsPerTile` becomes `9.0`, and the three hive appearances gain one optional field:

```json
    "hive-shot": {
      "template": "hive-shot",
      "sourceUpscale": 4,
      "palette": { "A": "#FFBA20", "B": "#FFDF7F", "C": "#FFFFFF" },
      "source": "row 17; EH Hive Shot; https://www.realmeye.com/wiki/killer-bee-queen; grid is a 4x render, see docs/killer-bee-queen-geometry-source.md (W18)"
    }
```

`encounter.json`: each encounter entry gains `arenaId`, and the per-encounter `spawns.placement` becomes a rule union:

```json
      "arenaId": "nest-boss-room",
      "spawns": {
        "archetype": "killer-bee-queen",
        "firstSpawnSeconds": 0,
        "everySeconds": null,
        "maxConcurrent": 1,
        "placement": { "rule": "arena-center" }
      }
```

The Crystal Worm keeps `{ "rule": "farthest-from-player", "ringRadiusFraction": 0.84375, "goldenAngleDegrees": 137.5 }`, and the validator rejects `ringRadiusFraction` or `goldenAngleDegrees` alongside `arena-center`.

`terrain.ts`:

```ts
/** True when the position lies in any of the arena's hazard regions (W12 uses the body centre). */
export function honeyAt(arena: Arena, positionTiles: Vector2): boolean;

/** 0.75 at zero contact, falling 0.05 per second, floored at 0.50 (W09). */
export function honeySpeedMultiplier(contactSeconds: number): number;

/** True when the arena contains the position at all; the octagon and circle forms (W03, W04). */
export function arenaContains(shape: ArenaShape, positionTiles: Vector2): boolean;
```

## Review Focus

- **The scale change touches every hitbox at once.** `pixelsPerTile` 12.8 to 9.0 grows every non-bomb projectile hitbox by about 1.42x while the player body shrinks from 1.25 to 0.889 tiles and the arena halves. Phase 37 must assert the derived sizes directly, not just that the file parses.
- **The hive correction is the one place where a wrong sign is invisible.** Without `sourceUpscale`, a hive shot becomes 5.44 tiles wide and would still render and collide. Phase 37 pins its derived width against the measured range.
- **Octagon containment must not let a body cross a corner.** The eroded region is the arena octagon shrunk by the body's support along each of the eight normals; clamping must land inside it for a body approaching a 45-degree face, which a naive per-axis clamp does not. Phase 38 tests the four corner bearings explicitly.
- **The two retuned radii are the only ones.** A third edit here would silently change a fight the user did not ask to change. Phase 38 asserts that every authored movement and placement radius fits inside its arena, so a future addition that does not fit fails loudly.
- **Honey's ordering inside the fixed step.** Occupancy is evaluated after movement; the multiplier a step uses comes from the contact accumulated before it. A reversed order makes the first honey step full-speed-and-undamaged or slow-before-entry, and both look plausible in play. Phase 39 pins the exact step the first damage and the first slow land on.
- **Honey must not fire during the countdown.** `regeneratePlayer` and the hit path both run in `playing` only today; phase 39 must not widen that.
- **Arena area versus shard density.** The arena loses about three quarters of its area while every attack keeps its authored shot count, so the per-frame live-shard figures from V9's phase-3 drill (112 shards, 1,256 parts) now occupy a quarter of the space. No bound may be widened to accommodate it; phase 40's Playwright case records the figures.

## Approved Scope And Review Gates

- Only the scale, the arena, the terrain, the two W27 radii, the spawn placement, the drill reposition, the two rules versions and their records change. No cadence, pattern, arm count, rotation, damage, speed, range, motion kind, condition, telegraph, threshold, progression or bomb detonation radius is touched.
- Wiki-sourced values stay as authored: every `rangeTiles` (1.875-11.05) and both `detonationRadiusTiles` (2 and 3) are already in real tiles and must not be rescaled. Several ranges now exceed the arena radius; that is correct, and `lifetime-only` expiration already handles it.
- The ramp in W09 and the interval in W11 are labelled in code comments as trainer-authored and inferred respectively. No step may present either as a wiki fact.
- Evidence files are never edited in place. Corrections to the appearance source record are appended with a date (W22).
- Terrain affects the player only, through `terrain.ts`, which stays pure. No step may give an enemy, minion or projectile a terrain interaction.
- Nothing under `game/` may gain a second arena shape beyond `circle | octagon` in this plan, and no rasterised outline may be stored in authored data or simulation state.
- Both rules versions bump exactly once, in phase 37. No later phase in this plan bumps either again.
- Tests that encode the old scale are rewritten to the new values and relationships, never deleted.
- Focused Vitest per step, written failing-first. `npm run verify` once at the end of each of phases 37, 38, 39 and 40. One new Playwright case in phase 40, run with `--grep`. No full Playwright suite unless reproducing a CI failure.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 37 | The Sprite Scale Re-Anchor | complete | V9 phase 36 |
| 38 | The Octagonal Boss Room | complete | 37 |
| 39 | Killer Honey | complete | 38 |
| 40 | Centre Spawn And Release | complete | 39 |

## Phase 37: The Sprite Scale Re-Anchor

Status: complete. Dependencies: V9 phase 36. Steps in [`docs/plan-archive/phase-37.md`](plan-archive/phase-37.md).

Committed the geometry evidence, corrected `pixelsPerTile` to 9.0, added the hive `sourceUpscale` of 4 on the three hive-grid appearances, shrank the player body to 0.889 tiles and took the plan's single comparison break (both rules versions to `-v5`/`-v9`).

## Phase 38: The Octagonal Boss Room

Status: complete. Dependencies: 37. Steps in [`docs/plan-archive/phase-38.md`](plan-archive/phase-38.md).

Turned `arena.json` into a keyed map with a circle/octagon shape union, added octagon containment via half-plane clamping, pointed each encounter at its own named arena (`nest-boss-room` at `flatHalfWidthTiles` 9.5 / `cornerSumTiles` 14.25), and retuned the Queen's phase-1 orbit and the yellow Beehemoth's orbit to 8.0 tiles for the smaller room.

## Phase 39: Killer Honey

Status: complete. Dependencies: 38. Steps in [`docs/plan-archive/phase-39.md`](plan-archive/phase-39.md).

Added the hazard-region model (diamond/annulus regions on an arena), authored the Nest boss room's static centre pond and outer-ring Killer Honey, and implemented honey's two player-only effects: the 0.75x speed multiplier (ramping 0.05/s to a 0.50 floor) and the 60 HP/1.0s armor-piercing damage clock, plus the honey floor art.

## Phase 40: Centre Spawn And Release

Status: complete. Dependencies: 39. Steps in [`docs/plan-archive/phase-40.md`](plan-archive/phase-40.md).

Turned the encounter-level opening-spawn placement into a `farthest-from-player`/`arena-center` rule union, moved the Killer Bee Queen onto `arena-center` so she no longer walks in from 16.2 tiles out on a phase-3 drill while the Crystal Worm's spawns stayed byte-for-byte unchanged, exported the shared placement-resolution and primary-enemy-reposition helpers for reuse, added one browser case covering the centre spawn and the already-implemented pond speed/damage effects, and updated the mechanics contract, README and deferred register. The full fight still clears at 373.43 s, unchanged from the V9 baseline.

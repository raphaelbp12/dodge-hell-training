# Phase 38: The Octagonal Boss Room

> Step prompts and execution records for phase 38 of [plan v10](../plan-v10.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 38.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-38.md` and replace the plan's step lines with one-sentence outcomes.

### Step 38.1 - Keyed Arenas And The Shape Union

Status: pending. Dependencies: 37.3.

**Implementation prompt**

Give each encounter its own arena and give an arena a shape. This step is data and types only: no containment behaviour changes yet, and the Queen still runs on a circle until 38.2 lands. It traces to W03, W04 and W05, and supersedes K05.

Rewrite `app/src/game/data/arena.json` into the keyed map in [plan v10](../plan-v10.md)'s Target Data Shapes section, with both arenas authored: `crystal-worm-circle` as `kind: "circle"` at centre 0,0 and radius 19.2 with an empty `hazards` array, and `nest-boss-room` as `kind: "octagon"` at centre 0,0 with `flatHalfWidthTiles: 9.5` and `cornerSumTiles: 14.25` and its two honey hazards. Author the hazards now even though nothing reads them until phase 39 - they belong to the arena, and authoring them here keeps the validator and its tests in one step. Cite `docs/killer-bee-queen-geometry-source.md` in the file's `comment` and state there that 14.25 is `1.5 * 9.5`, the measured diagonal sum.

In `app/src/game/models.ts`, add `ArenaShape`, `TerrainRegion`, `HazardBand` and `Arena` exactly as the plan's Target Data Shapes section gives them, and redefine `CircularArena` as `Extract<ArenaShape, { kind: "circle" }>` so the ten existing call sites keep compiling against the circle member. Nothing in this step may widen a signature that currently takes `CircularArena` except where the arena is read from configuration.

In `app/src/game/config/data.ts`, replace `validateArena` with a validator for the map: at least one arena; each key a nonempty string; each entry dispatched on `kind`; `circle` requiring a positive `radiusTiles`; `octagon` requiring a positive `flatHalfWidthTiles` and a `cornerSumTiles` strictly greater than it and strictly less than twice it, because at or below the flat half-width the corner cut would swallow the flat sides and at or above twice it the corner faces would never touch the octagon. Validate `hazards` as an array of `{ kind: "honey", region }`, with `diamond` requiring a positive `halfDiagonalTiles` and `annulus` requiring `0 <= innerRadiusTiles < outerRadiusTiles`. Reject an unknown `kind`, an unknown region `shape`, and an `annulus` whose outer radius exceeds the arena's own inradius.

In `app/src/game/data/encounter.json`, add `"arenaId": "crystal-worm-circle"` and `"arenaId": "nest-boss-room"` to the two encounter entries. In `app/src/game/config/encounter.ts`, resolve `arenaId` against the arena map when building each `EncounterConfig` and reject an unknown id at load. `buildEncounterConfig` keeps exposing the arena on `config.arena`; it is now an `Arena` rather than a bare `CircularArena`, so update the simulation's reads to `config.arena.shape` where they want the circle. Keep `AUTHORED_ARENA` only if something still needs a default; if nothing does, remove it rather than leaving an unused export.

**Focused checks:** failing validator test first. Then: both arenas load with their authored values; the Crystal Worm resolves to the circle and the Queen to the octagon; an unknown `arenaId` throws at load; an empty arena map throws; a `circle` with radius 0 or negative throws; an `octagon` with `cornerSumTiles` equal to, below, or at twice the flat half-width throws while 14.25 over 9.5 passes; an unknown shape `kind` throws; a `diamond` with a zero half-diagonal throws; an `annulus` with inner greater than or equal to outer throws; an `annulus` whose outer radius exceeds the inradius throws; and `nest-boss-room` parses its two hazards in authored order. Confirm no gameplay changed: every pre-existing simulation assertion passes unchanged, because the Queen is still contained by a circle at this point. Focused Vitest only.

**Acceptance:** `arena.json` is a keyed map of two arenas with a shape union and authored hazards; `Arena`, `ArenaShape`, `TerrainRegion` and `HazardBand` exist in `models.ts` with `CircularArena` as the circle member; each encounter resolves its arena by id and rejects an unknown one; the validator covers every case above; and no simulation behaviour changed.

### Step 38.2 - Octagon Containment

Status: pending. Dependencies: 38.1.

**Implementation prompt**

Contain a convex body inside the octagon. This traces to W03, W04 and W12's neighbour: containment is a body test, unlike terrain occupancy, which is a centre test.

Represent the octagon as eight half-planes with unit normals and offsets, derived from the authored pair: the four axis normals `(1,0), (-1,0), (0,1), (0,-1)` at offset `flatHalfWidthTiles`, and the four diagonal normals `(+/-1/sqrt2, +/-1/sqrt2)` at offset `cornerSumTiles / sqrt2`. Derive these once per arena, not per call, and put the derivation next to the shape type so a reader sees where 14.25 becomes 10.0762.

In `app/src/game/simulation/geometry.ts`, add beside the existing circle helpers:

- `convexBodyFitsOctagon(orientedLocalVerticesTiles, octagon)`: for each of the eight normals, the body's support `s(n) = max(v . n)` over its oriented local vertices must be strictly less than that normal's offset. This is the octagon analogue of `convexBodyFitsCircle` and it is the precondition the clamp needs.
- The eroded region: clip a square of side `4 * cornerSumTiles` successively by each of the eight half-planes moved inward to `offset - s(n)`, with Sutherland-Hodgman. Clipping handles a half-plane that has become redundant for a wide body, which an eight-vertex closed form does not, and it yields the eroded convex polygon's vertices in order.
- The clamp: if the candidate centre satisfies every eroded half-plane, return it unchanged; otherwise return the nearest point on the eroded polygon's boundary, taken as the minimum over its edge segments. Do **not** project radially from the arena centre: that is the circle's behaviour and on a flat side it would slide the body along the wrong bearing. Nearest-point is what makes a body slide along a straight wall, which is what the real room does.

Then make `constrainBodyToArena` dispatch on `arena.shape.kind`, keeping the existing circle branch byte-for-byte: the Crystal Worm's containment must not change by a single tile. Throw the same `RangeError` shape as the circle path when the body does not fit at the centre.

Keep every assertion the circle path already makes (finite vectors, convex axes, representable geometry) and apply them to the octagon path too.

**Focused checks:** failing test first on a point outside a 45-degree face. Then, with the authored 9.5 / 14.25 octagon and a 0.889-tile beveled-octagon body: a centre at the origin is unchanged; a candidate far out along +x clamps to `9.5 - s((1,0))` on the x axis with y preserved; the same along each of the four axes; a candidate far out along each of the four 45-degree bearings clamps to a point satisfying every eroded half-plane, which a per-axis clamp fails - assert containment in all eight eroded half-planes, not just a coordinate; a candidate just inside the corner's start (`|x| = 9.5, |y| = 4.79`) is unchanged; a candidate sliding along a flat wall keeps its tangential coordinate, proving nearest-point rather than radial projection; a body too large to fit at the centre throws; `convexBodyFitsOctagon` is false for a body of half-extent above the inradius and true for the player body; and the Crystal Worm's circle containment produces identical results to before this step for a sample of bearings. Focused Vitest only.

**Acceptance:** the octagon is derived as eight half-planes from the authored pair; `convexBodyFitsOctagon` and the eroded-polygon clamp exist beside their circle counterparts; `constrainBodyToArena` dispatches on shape kind with the circle branch unchanged; a body approaching any of the four corner faces lands inside every eroded half-plane; and the Crystal Worm's containment is numerically identical to before.

### Step 38.3 - Retune The Two Out-Of-Arena Radii And Guard The Rest

Status: pending. Dependencies: 38.2.

**Implementation prompt**

Fix the only two authored radii that no longer fit, and make a third one impossible to add silently. This traces to W27.

In `app/src/game/data/enemies.json`, change exactly these values and no others:

- `killer-bee-queen` phase 1 `movement.radiusTiles` from `10` to `8`.
- `killer-bee-queen` phase 1 sub-phase 0 `movement.radiusTiles` from `10` to `8`.
- `adolescent-yellow-beehemoth` phase 0 `movement.radiusTiles` from `16` to `8`.
- `adolescent-yellow-beehemoth` phase 1 `movement.radiusTiles` from `16` to `8`.

8.0 is 0.84 of the new 9.5-tile half-width, which preserves phase 1's "circling the room" and the Beehemoth's "circle along the edges of the room". Add a comment at each site citing W27 and saying the previous value was calibrated against the old 19.2-tile circle. Leave every radius of 3, 4, 5 and 6 alone: they already fit, and rescaling them would change fights the user did not ask to change.

Then add the guard. Write a configuration test that, for each encounter, walks every archetype reachable from it and asserts that each `orbit` and `wander` movement radius, plus the moving body's support along the worst-case bearing, fits inside that encounter's arena - for the octagon, inside the inradius; for the circle, inside the radius. Skip `ring-around-owner` placements: they are relative to a moving owner and are already clamped by containment. Make the failure message name the archetype, the phase or sub-phase id and the offending radius, so a future addition that does not fit fails legibly instead of silently riding the wall.

**Focused checks:** write the guard test first and watch it fail on the pre-edit `10` and `16`, then make it pass with the four edits. Then: the Queen's phase-1 orbit settles at 8.0 tiles from the centre rather than being clamped, asserted by running the simulation into phase 1 and checking her distance from the arena centre; the yellow Beehemoth does the same in phase 7-yellow; every other authored radius is unchanged, asserted by a snapshot of the sorted radius multiset; and the full Killer Bee Queen fight still clears through all eight phases, which `app/src/game/config/config.test.ts` already covers - rewrite its expected clear time if it moved, do not delete the assertion. Then `npm run verify` once for the whole phase after 38.4.

**Acceptance:** exactly four radius values changed, each with a W27 comment; the guard test names archetype, phase and radius on failure and passes for both encounters; the Queen's phase-1 orbit and the yellow Beehemoth's orbit both settle inside the arena instead of clamping; every other radius is untouched; and the full-fight clear still passes.

### Step 38.4 - Draw The Room As Its Tile Staircase

Status: pending. Dependencies: 38.3.

**Implementation prompt**

Make the octagon visible, and visible the way the real room is: as whole tiles. This traces to W03 and W16, and it is drawing only - no rule depends on it.

In `app/src/game/phaser/encounter.ts`, replace `drawGround`'s hard-coded circle with a shape-driven draw that reads `this.state.config.arena.shape`:

- For `circle`, keep today's behaviour exactly: filled circle, the per-tile grid lines clipped to the circle, and the boundary stroke. The Crystal Worm must look unchanged.
- For `octagon`, fill the octagon, draw the same per-tile grid clipped to it, and stroke the boundary as the **tile staircase**: for each tile row the octagon covers, compute the half-width at that row as `min(flatHalfWidthTiles, cornerSumTiles - |rowCentreTiles|)`, round outward to a whole tile, and stroke the resulting stepped outline. Derive the staircase at draw time from the authored pair; per [plan v10](../plan-v10.md)'s Architecture section no rasterised outline may be stored in authored data or in simulation state.

`drawGround` currently reads the module-level `ENCOUNTER_CONFIG`; change it to read `this.state.config` like the rest of the scene already does, which is the same correction step 23.1 made elsewhere. Leave `presentation.ground`, `presentation.grid` and `presentation.boundary` as the colours; phase 39 adds the honeycomb pattern and the honey fills on top.

Nothing else in the scene changes. `centerCamera` already centres on the arena centre, and `cssPixelsPerTile` stays 32 per W29, so the 19-tile-wide room now fits in about 608 px at zoom 1.

**Focused checks:** the staircase derivation is the testable part, so extract it as a pure exported helper - rows to half-widths - and test that, not the Phaser calls. Assert: for the authored 9.5 / 14.25 octagon the half-width is 9.5 for every row inside `|y| <= 4.79` and falls by one tile per tile row beyond it, reaching its last nonzero row at `|y| = 14.25`; the sequence is symmetric about the centre row in both axes; each step is a whole number of tiles; and the outermost step never exceeds the flat half-width. Then confirm by hand, in the running app, that the Queen's room draws as a stepped octagon and the Crystal Worm's as the unchanged circle, and record that in the execution notes - the drawing itself is not asserted by a test. Then `npm run verify` once for the whole phase, and read `app/test-results/verification/<gate>.log` only if a printed excerpt is not enough.

**Acceptance:** `drawGround` dispatches on the arena shape and reads `state.config` rather than the module-level config; the circle path is visually unchanged; the octagon draws as a whole-tile staircase derived at draw time from `flatHalfWidthTiles` and `cornerSumTiles`; the staircase helper is pure and tested; the two encounters were each confirmed by hand in the app; and `npm run verify` passes all four gates.

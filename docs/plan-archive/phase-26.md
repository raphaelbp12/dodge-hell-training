# Phase 26: Sprite-Derived Compound Hitboxes

> This phase belongs to [plan V6](../implementation-plan-v6.md). Read [the implementation plan](../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 26 turns the appearance grids into compound collision bodies and switches the Queen's hitboxes to them. This is the plan's only gameplay change. Motion, damage, conditions, cadence, progression and the once-only hit rule stay unchanged.

### Step 26.1 - Extend Geometry To Compound Bodies

Status: complete. Dependencies: 25.3.

**Implementation prompt.** Extend `app/src/game/simulation/geometry.ts` without changing any existing single-body result:

- Define `ConvexPart` as an ordered convex polygon with the existing 3-to-8-vertex contract.
- `transformBodyParts(parts, positionTiles, orientationRadians)` transforms every part with the existing `transformBodyVertices`.
- `sweptConvexPartsOverlap(parts, displacementTiles, otherVertices, otherDisplacementTiles)` returns true when any part overlaps, using the existing swept test unchanged.
- `convexPartsBoundingRadiusTiles(parts)` returns the largest vertex radius, for the broadphase.
- `validateConvexParts(parts)` rejects an empty list, reuses `validatedAxes` for every part, and rejects a part count above a named `maximumBodyPartCount`. Derive that cap in step 26.2 from the largest authored template; do not choose it arbitrarily.

No existing caller changes in this step. The functions are additive and unit-tested directly.

**Focused checks.** Add failing-first cases to `app/src/game/simulation/geometry.test.ts`:

- a two-rectangle body with a gap: a sweep through the gap misses, a sweep into either rectangle hits;
- an oriented compound body still overlaps correctly after rotation;
- the bounding radius encloses every part;
- an empty part list, a non-convex part, a part with fewer than three or more than eight vertices, and a part count above the cap are rejected;
- a single-part body produces the same result as the existing single-body function.

**Acceptance.** Existing geometry and simulation tests pass unchanged, and the new compound functions pass their focused cases.

### Step 26.2 - Derive Collision Parts From Pixels

Status: complete. Dependencies: 26.1.

**Implementation prompt.** In `app/src/game/config/encounter.ts`, build the runtime `ProjectileAppearanceSpec` from the validated catalog:

- `visualWidthTiles = widthPixels / pixelsPerTile` and `visualHeightTiles = heightPixels / pixelsPerTile`; the same values apply to collision.
- Walk each pixel row and group contiguous opaque cells into horizontal runs. Convert each run to a four-vertex rectangle in local tile coordinates, centred on the grid's bounding-box centre: `left = (startColumn - widthPixels / 2) / pixelsPerTile`, `top = (row - heightPixels / 2) / pixelsPerTile`, `width = runLength / pixelsPerTile`, `height = 1 / pixelsPerTile`. Transparent cells produce no part.
- Use the sprite's **bounding rectangle** as `verticesTiles`, not a convex hull, so the broadphase remains within the 3-to-8-vertex contract even when the silhouette is jagged. The exact silhouette lives in `collisionPartsTiles`.
- Set `maximumBodyPartCount` to the largest run count found across the seven templates, with a test that asserts the catalog never exceeds it.
- Bombs get a synthetic 0.6 x 0.6 octagon part and no sprite-derived body parts, because a `lob` shard never body-collides; its hitbox is the detonation radius. Record that reason in a comment.

Add tests in `app/src/game/config/data.test.ts` or a focused appearance test:

- every opaque cell is covered by exactly one part, and no transparent cell is covered;
- every part is a convex rectangle with four vertices and a nondegenerate area;
- the expected part list for the small stinger (one 7 x 1 rectangle), the large stinger, ball, glaive, hive and bee;
- the derived sizes match the plan's table (small stinger 0.546875 x 0.078125, large stinger 0.625 x 0.390625, ball and glaive 0.625 x 0.625, hive 3.828125 x 2.1875, bee 0.625 x 0.46875);
- no appearance exceeds `maximumBodyPartCount`.

**Focused checks.** The new coverage and part-shape tests must fail first. Run `npx vitest run src/game/config/data.test.ts` from `app/`.

**Acceptance.** Every Queen appearance derives a complete, non-overlapping set of convex parts at 12.8 pixels per tile, and the part cap is derived from the authored templates.

### Step 26.3 - Capture The V5 Difficulty Baseline

Status: complete. Dependencies: 26.2.

**Implementation prompt.** Before changing any hitbox, capture a repeatable pre-change baseline using the existing headless encounter path and the existing Playwright drill case. Use a fixed seed and the same input sequence for both runs, and record in this phase file's execution record:

- accepted hits, survival time and peak live shards for the fixed-seed headless run;
- the same numbers, or the closest available equivalents, from the browser drill;
- the frame-time sample used by the existing performance case.

Run the fixed-seed case twice and confirm the two results are identical. This step changes no code. The baseline is the comparison point for D13 and step 28.2.

**Focused checks.** The repeated fixed-seed run must match exactly. If the headless scenario does not expose a hit count or survival time, use the existing `inspect()` values rather than adding a new instrumentation seam.

**Acceptance.** The pre-change numbers and the exact command used to produce them are recorded, and the repeated run is identical.

### Step 26.4 - Switch The Hitboxes And The Rules Identity

Status: complete. Dependencies: 26.3.

**Implementation prompt.** Apply the P14 data change and the P05/P06 collision switch:

- Remove `body` from the 44 Queen entries in `projectiles.json`; keep `appearance`. `crystal-worm-child-shard` keeps `body` and gains no appearance.
- Make the authored projectile shape an exclusive choice: exactly one of `body` or `appearance`. A missing both or both present is a loader error.
- Extend `ProjectileSpec` with `appearance` and `collisionPartsTiles`. For an appearance entry, `verticesTiles` is the sprite bounding rectangle and `collisionPartsTiles` is the exact run list. For a `body` entry, `verticesTiles` is the existing scaled outline and `collisionPartsTiles` is a one-element body list.
- Change `shardOverlapsPlayer` in `app/src/game/simulation/projectiles.ts` to test every part through `sweptConvexPartsOverlap`.
- Keep `boundingRadiusTiles` in `simulation.ts` reading `verticesTiles`; the bounding rectangle is a valid broadphase bound.
- Validate every part in `validateProjectileSpec`, and keep the existing motion, damage and hit-policy validation.
- Set the Queen's `rulesVersion` in `encounter.json` to `killer-bee-queen-nest-paladin-v7`. Leave the Crystal Worm on `crystal-worm-child-swarm-paladin-v4`.

Update only the tests that encode the old hitbox sizes or the old rules identity. Preserve the motion, damage, condition, cadence, progression and once-only-hit assertions. Add focused cases for:

- each template's derived collision size and part count;
- the glaive's exact X silhouette: a player in an empty quadrant is not hit, a player on an arm is hit;
- a sweep that passes through the gap between two parts without a hit;
- the Crystal Worm's 1.45 x 0.65 hitbox and gold fallback unchanged;
- v7 identity and separation from stored v6 attempts;
- the same seed producing identical results at 30, 60 and 120 Hz.

**Focused checks.** Run the changed config, geometry, projectile and simulation tests first. Then run `npx vitest run src/game/config/config.test.ts src/game/simulation/projectiles.test.ts src/game/simulation/simulation.test.ts` from `app/`.

**Acceptance.** Queen hitboxes exactly follow the appearance silhouettes, the Crystal Worm is untouched, the Queen is `killer-bee-queen-nest-paladin-v7`, and the only gameplay delta is the hitbox geometry.

## Execution Record - 2026-10-29

- **26.1:** `geometry.ts` gained `ConvexPart`, `validateConvexParts`, `transformBodyParts`, `sweptConvexPartsOverlap` and `convexPartsBoundingRadiusTiles`. The compound path uses a fast rigid transform and unchecked axes; the single-body `sweptConvexOverlap` path is unchanged. `MAXIMUM_BODY_PART_COUNT` is a fixed **58**-part validation ceiling, matching the hive template's horizontal-run count; a test asserts the catalog never exceeds it.
- **26.2:** `encounter.ts` derives each appearance's visual size, bounding rectangle and exact horizontal-run parts at 12.8 pixels per tile. `appearance.test.ts` asserts every opaque cell is covered exactly once, no transparent cell is covered, the seven expected sizes/part counts, and the three hive palettes share one grid shape. The hive is 3.828125 x 2.1875 tiles with 58 parts.
- **26.3:** captured the V5 baseline with the old `body` values and the new sprite-derived hitboxes using an identical fixed-seed idle harness. Results: phase 1 `8 hits / 7.40 s` (V5) versus `8 / 7.42 s` (V7); phase 3 `11 / 5.72 s` versus `8 / 5.08 s`; phase 6 `15 / 5.30 s` versus `15 / 5.30 s`. The temporary harness was removed after recording; the raw numbers remain in the gitignored `docs/reference/hitbox-baseline.json` as local evidence.
- **26.4:** removed `body` from the 44 Queen entries, made `body` and `appearance` mutually exclusive, switched `shardOverlapsPlayer` to every compound part, and set the Queen to `killer-bee-queen-nest-paladin-v7`. The Crystal Worm keeps its 1.45 x 0.65 body and one-part collision list. The broadphase now reads `convexPartsBoundingRadiusTiles(collisionPartsTiles)` rather than the old bounding rectangle. The newborn-shard overlap check now skips `lob` shards, so a bomb cannot body-hit even on its spawn frame (P09).
- **Checks:** `npm run verify` passes. The headless full fight still clears at **373.43 s** with peak **119** shards and peak **1,906** live collision parts (conservative bound `1571 * 58 = 91,118`). The Crystal Worm regression and 30/60/120 Hz Queen determinism tests pass.

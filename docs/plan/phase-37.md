# Phase 37: The Sprite Scale Re-Anchor

> Step prompts and execution records for phase 37 of [plan v10](../plan-v10.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 37.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-37.md` and replace the plan's step lines with one-sentence outcomes.

### Step 37.1 - Commit The Geometry Evidence And Correct The Appearance Record

Status: pending. Dependencies: none.

**Implementation prompt**

No code changes. This step makes the measurement durable before anything depends on it, and corrects two claims in the existing record that the measurement contradicts. It traces to W02, W22 and W24.

Create `docs/killer-bee-queen-geometry-source.md`. Follow the shape of [the appearance source record](../projectile-appearance-source.md): a provenance table, then the derivation, then the measured tables. It must carry, verbatim from [plan v10](../plan-v10.md)'s Measurement Evidence section:

- The provenance: six screenshots supplied by the user on 2026-11-04; images 1, 2, 11, 12 and 13 share one zoom; image 9 is camera-rotated and was discarded; image 10 is a thumbnail. State that no image file is committed.
- The method, in enough detail that a reader can repeat it: PNG decode, then (a) horizontal constant-colour run-length histograms over clean floor patches to find the native sprite pixel, (b) detrended autocorrelation of floor brightness profiles to find periodic structure, (c) per-row first/last walkable-floor scans with a blue-channel threshold to exclude the waxy wall band, and (d) connected-component bounding boxes with per-sprite colour predicates for entity sizes.
- The tile derivation: run-length peaks at 5-6 px with harmonics at 11-13 and 18-19 across three independent screenshots (means 6.25, 6.49 and 6.31 px over runs of 3-12 px), giving a 6.44 px native sprite pixel and a **51.5 px** ground tile at 8 native pixels. Record explicitly that the 25.75 px period also present is the half-tile pattern inside each ground tile sprite and is **not** the tile, because that is the mistake this record exists to prevent.
- The room table: the x = 104 to x = 1081 walkable span at centre x = 592.5 giving 9.49 tiles, and the three-row chamfer table whose diagonal sum is 14.28 tiles. Include the note that a circle fit over the same rows drifts from R = 9.8 to R = 11.5 and cannot produce the straight sides.
- The floor-zone table (A to D plus the wall) with the user's own tile counts beside it, and the sentence that zones B and C differ in look only.
- The entity table, including the hive row and the arithmetic `49 x 28 = 4 x (12.25 x 7)`.
- A closing "What this record does not establish" section: the pond's radius is the user's in-game tile count, not a measurement, because the Queen's sprite covers the pond in every centre screenshot; the vertical flat half-width is inferred from symmetry and the chamfer constant, because image 12's top is under the boss bar and its bottom under the chat log; and no honey band boundary was measurable to better than about two tiles, so W07's radii are the user's counts.

Then append two dated corrections to `docs/projectile-appearance-source.md`. Append only - do not edit, reword or delete any existing line, including the Scale Derivation section's 12.8 arithmetic, which stays as the record of what V6 did and why:

- **2026-11-04 - the player sprite is not 16 x 16 native.** The balls are native 8 x 8 and measure 45-48 px where a tile is 51.5 px; the player measures 43 x 44 px. The player therefore draws at the same per-native-pixel scale as an 8 x 8 ball, so the 16 x 16 premise behind `12.8` is wrong. The corrected conversion is 8 native pixels over a measured 0.889-tile ball, giving `pixelsPerTile: 9.0` (W17).
- **2026-11-04 - the hive grids are a 4x render, not 1x.** Measured hive shots are 1.07-1.44 tiles wide; the recorded 49 x 28 grid at any single global scale predicts four times that. `49 x 28` is `4 x (12.25 x 7)`. The grids are kept as authored and divided by a per-appearance `sourceUpscale: 4` (W18).

**Focused checks:** none - this step changes no code, so per the project instructions `npm run verify` is skipped. Confirm by hand that both new corrections are appended below the existing content, that no pre-existing line in the appearance record changed (`git diff` shows additions only for that file), and that every number in the new record matches the plan's Measurement Evidence section exactly.

**Acceptance:** `docs/killer-bee-queen-geometry-source.md` exists with the provenance, method, tile derivation, room, zone and entity tables and the limits section; `docs/projectile-appearance-source.md` has exactly two appended dated corrections and no modified line; no file under `app/` changed.

### Step 37.2 - Re-Anchor `pixelsPerTile` And Add The Hive Upscale

Status: pending. Dependencies: 37.1.

**Implementation prompt**

Correct the one global scale and the one family it cannot describe. This traces to W17 and W18.

In `app/src/game/data/projectile-appearances.json`, change `pixelsPerTile` from `12.8` to `9.0`, and update its `comment` to cite `docs/killer-bee-queen-geometry-source.md` as the derivation. Add `"sourceUpscale": 4` to exactly the three hive appearances - `hive-spiral-shot`, `hive-range-shot` and `hive-shot` - and extend each of their `source` strings with `grid is a 4x render, see docs/killer-bee-queen-geometry-source.md`. Add the field to no other appearance.

In `app/src/game/config/data.ts`, extend appearance validation: `sourceUpscale` is optional, and when present must be a positive safe integer. Reject zero, a negative, a non-integer and a non-number. Default it to `1` when absent so every downstream consumer reads one field.

Wherever an appearance's world size is derived from its pixel grid, divide by `sourceUpscale` as well as by `pixelsPerTile`, so an appearance's tile size is `gridPixels / (pixelsPerTile * sourceUpscale)`. Query the codegraph index for the symbol that builds `visualWidthTiles`, `visualHeightTiles` and `partsTiles` from a resolved grid and change it in that one place; do not scatter the division. The collision parts must use the same divisor as the visual extent, because W19 keeps sprite-derived hitboxes as one source of truth.

The bomb appearances keep their sourced detonation-radius bodies and are unaffected: `projectileFromAuthored` already branches on `appearance.bomb` before reading any grid.

**Focused checks:** write the failing test first on the derived sizes, not on the file contents. Then assert, from the loaded config: a `ball`-template appearance (8 x 8) derives 0.889 x 0.889 tiles to within 1e-9 of `8 / 9`; `stinger-small` (7 x 1) derives `7 / 9` x `1 / 9`; `stinger-large` (8 x 5) derives `8 / 9` x `5 / 9`; `bee-shot` (8 x 6) derives `8 / 9` x `6 / 9`; each hive appearance (49 x 28, upscale 4) derives `49 / 36` x `28 / 36`, which is 1.361 x 0.778 tiles and lands inside the 1.07-1.44 measured width range once rotation is allowed for; a bomb projectile's body is unchanged at its authored detonation radius; and every non-bomb projectile's collision parts scale by the same factor as its visual extent. Add validator cases for `sourceUpscale` of 0, -1, 1.5 and `"4"`, and one asserting the default of 1 when the field is absent. Rewrite, do not delete, any existing assertion that encodes a 12.8-derived size. Run `npx vitest run` on the touched files only; the phase's single `npm run verify` comes at the end of 37.3.

**Acceptance:** `pixelsPerTile` is 9.0; exactly three appearances carry `sourceUpscale: 4`; every appearance's visual extent and collision parts derive from `gridPixels / (pixelsPerTile * sourceUpscale)` computed in one place; the hive families derive 1.361 x 0.778 tiles; bombs are unchanged; the validator rejects a non-positive-integer upscale; and the focused tests pass.

### Step 37.3 - Shrink The Player Body And Take The Comparison Break

Status: pending. Dependencies: 37.2.

**Implementation prompt**

Bring the player body onto the same derivation as every sprite, and take this plan's single rules break. This traces to W20, W21 and W28.

In `app/src/game/data/encounter.json`, change `player.body.widthTiles` and `heightTiles` from `1.25` to `0.889`, keeping `shape: "beveled-octagon"`. Update the file's `comment` to cite the geometry record and to say the figure is `8 / 9` tiles, the shared 8 x 8 native derivation, not a separate measurement.

Leave `killer-bee-queen.body` at 2 x 2 tiles and leave its existing comment in place: W21 keeps the wiki's "Hitbox Size 2" because the measured sprite brackets it. Do not touch any other archetype body.

Bump both encounters' rules versions in the same edit: `crystal-worm` from `crystal-worm-child-swarm-paladin-v4` to `...-v5`, and `killer-bee-queen` from `killer-bee-queen-nest-paladin-v8` to `...-v9`. Both encounters break because the player body is shared. Per W28 this is the only bump in plan V10; phases 38-40 must not bump either again.

Then find and rewrite every test that encodes the old player body or the old appearance scale. Expect at least: body-geometry fixtures built from 1.25 tiles, containment tests whose expected stop distance derives from the player's half-extent, and any hit-geometry test whose overlap threshold was tuned to a 0.625-tile shard. Rewrite each to the new value or, better, to the relationship it was really checking.

**Focused checks:** failing test first on the loaded player body. Then: the player body is 0.889 x 0.889 tiles; its outline is still the beveled octagon and still convex; the Queen's body is still exactly 2 x 2; a record written under `killer-bee-queen-nest-paladin-v8` is retained in history and excluded from the `...-v9` personal best, and the same for the Crystal Worm across v4 and v5; and the two encounters' records still never compare against each other. Then `npm run verify` once for the whole phase, and read `app/test-results/verification/<gate>.log` only if a printed excerpt is not enough.

**Acceptance:** the player body is 0.889 tiles on both axes; the Queen's body is untouched; both rules versions are bumped exactly once; pre-break records are retained but excluded from the new bests; every test that encoded the old scale is rewritten rather than removed; and `npm run verify` passes all four gates.

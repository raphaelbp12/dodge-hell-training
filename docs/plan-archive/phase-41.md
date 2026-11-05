# Phase 41: The Player's True Body

> Step prompts and execution records for phase 41 of [plan v11](../plan-v11.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 41.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-41.md` and replace the plan's step lines with one-sentence outcomes.

### Step 41.1 - Decode The Paladin Body And Derive The Outline

Status: complete. Dependencies: 40.

**Implementation prompt**

Measure the body of the Paladin class sprite and produce the exact shape this plan authors. This step changes documentation only; do not edit anything under `app/`.

Fetch `https://www.realmeye.com/s/a/img/wiki/i/caT4rO5.png` with `curl` and a desktop user agent. The copy used for this plan was 369 bytes with SHA-256 `28A53AF0574D58F28A46B0D8BB1BADDEB9299D137E1E251F1F9A66F13E194F1E`; if the fetched bytes differ, record the new hash and re-check the decode below before using it. The image is reference-only: do not commit it, copy it into `docs/`, or ship it.

The PNG is `190 x 190`: a 3 px border around an `8 x 8` grid of `23 px` cells. Decode every cell's RGBA at the cell centre. The alpha channel is meaningful. The decode used for this plan is:

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

Legend: `W` white, `G` grey, `Y` bright yellow, `O` gold, `T` tan, `P` pale, `K` black, `L` pale yellow, `B` brown, `H` light brown, `.` transparent. If the decode differs, record what the image shows and explain the difference; do not force it into this table.

Select the **body and sword arm**: the opaque character cells in **columns 1-6, rows 0-7**. The white and grey cells in columns 0 and 7 are the separate sword and outer prop and are excluded. The white cells at column 6 rows 0-1 are the prop's edge and are excluded; the gold cell at column 6 row 4 is the sword arm and is included. The body's core is columns 1-5. The selected cells' bounding box is exactly **6 x 8 native pixels**.

Derive the outline:

1. Take the convex hull of the selected cells' **pixel squares**, not their centres, so the hull's extents are the mask's true pixel extents.
2. Remove collinear vertices. If more than eight remain, remove the shortest edges one at a time until eight remain, preserving the left, right, top, bottom and arm extents; record every removal.
3. Do **not** mirror the hull or average it with its 180-degree rotation. Decision X05 keeps the sprite's one-sided arm.
4. Normalize the body's `6 x 8` bounding box to `[-0.5, 0.5]` on both axes: `x = (pixelX - bodyLeft) / 6 - 0.5`, `y = (pixelY - bodyTop) / 8 - 0.5`.
5. List the resulting vertices in clockwise order, ready to paste into `shapes.json`.

Write `docs/player-body-source.md` with:

- the image URL, retrieval date `2026-11-05`, SHA-256, dimensions and the `3 + 8 x 23 + 3` decode;
- the full 8 x 8 colour/alpha matrix and the legend;
- the selected body cells, the excluded sword/prop cells and the 6 x 8 bounding box;
- the hull in pixel coordinates and in normalized coordinates, in clockwise order, plus the exact JSON array for `shapes.json`;
- the extents in native pixels and in tiles: `6/9 = 0.667` wide, `8/9 = 0.889` tall, aspect `0.75`;
- a one-line asymmetry proof (the 180-degree rotation is not the same vertex set);
- the method, the simplification record and the limitations: a single front-facing class frame, not a client hitbox or animation; the body mask is a trainer reading; the real game's reported 1 x 1-tile hitbox is not adopted (Q11).

Append one dated note to `docs/killer-bee-queen-geometry-source.md` after its entity table. Do not rewrite any existing text. The note says that the table's `Player body` row describes the full `8 x 8` frame and its visible mask; the current player's **body** is the Paladin class image's `6 x 8` body-and-arm mask, `0.667 x 0.889` tiles, recorded in `docs/player-body-source.md`; the `9.0` native-pixels-per-tile scale and the `8 x 8` frame are unchanged, and the old `0.889 x 0.889` value stands only as the frame derivation.

**Focused checks:** re-decode the PNG and confirm `190 x 190`, the 3 px border and the `8 x 8` grid at 23 px; confirm the selected body cells' bounding box is exactly 6 x 8; confirm the hull is convex, has 3 to 8 vertices and every vertex lies inside the body bounding box; confirm the normalized extents are exactly `[-0.5, 0.5]` on both axes within `1e-12`; confirm scaling by `0.667` and `0.889` gives `0.667 x 0.889` within `1e-9`; confirm the 180-degree rotation is not the same vertex set; confirm the recorded JSON vertices reproduce the recorded hull; confirm no file under `app/` changed.

**Acceptance:** `docs/player-body-source.md` exists and is internally consistent, cites the image and records the 8 x 8 decode, the 6 x 8 body cells, the hull, the normalization and the limitations; the geometry record has the appended dated note and no rewritten text; no application file changed.

**Execution and verification - 2026-11-05**

Decoded the RealmEye Paladin class image (SHA-256 `28A53AF0574D58F28A46B0D8BB1BADDEB9299D137E1E251F1F9A66F13E194F1E`, 190 x 190, 3 px border, 8 x 8 grid at 23 px). Selected the 36 body-and-arm cells in columns 1-6 (the white/grey sword and outer prop excluded), computed the monotone-chain convex hull of their pixel squares, and confirmed it is exactly eight vertices, convex and asymmetric. Normalized the 6 x 8 bounding box to `[-0.5, 0.5]` on both axes and recorded the hull, its pixel and world coordinates, the method and the limitations in `docs/player-body-source.md`. Appended the dated frame-versus-body note to `docs/killer-bee-queen-geometry-source.md` without rewriting any existing text.

Checks: re-decoded the PNG and confirmed the grid; the selected cells' bounding box is 6 x 8; the hull is convex, eight vertices, every vertex inside the box; normalized extents exactly `[-0.5, 0.5]` on both axes; the 180-degree rotation is not the same vertex set; no file under `app/` changed. No application test belongs to this docs-only step.

### Step 41.2 - Author The Player Body, Shape And Comparison Break

Status: complete. Dependencies: 41.1.

**Implementation prompt**

Author the measured body and take the plan's single comparison break.

In `app/src/game/data/shapes.json`, add `paladin-body` with the clockwise normalized vertices from [the player body source record](../player-body-source.md). Keep `beveled-octagon` and `shard-hexagon` unchanged. Update the file's top-level `comment` to cite `docs/player-body-source.md`. The outline must remain convex, have 3 to 8 vertices, span exactly `[-0.5, 0.5]` on both axes, and stay asymmetric.

In `app/src/game/data/encounter.json`, change the one shared player body from `beveled-octagon` at `0.889 x 0.889` to:

```json
"body": {
  "shape": "paladin-body",
  "widthTiles": 0.667,
  "heightTiles": 0.889
}
```

Keep `spawnTiles` unchanged. Update the file's comment to say the frame is `8/9` and the body is `6/9 x 8/9`, citing the player body source record.

Bump both encounter rules versions exactly once: the Crystal Worm from `crystal-worm-child-swarm-paladin-v5` to `crystal-worm-child-swarm-paladin-v6`, and the Queen from `killer-bee-queen-nest-paladin-v9` to `killer-bee-queen-nest-paladin-v10`. Update every literal that follows from them, including `app/tests/app.spec.ts`. Do not add a new Playwright case; update only the existing version literals.

Rewrite, do not delete, every test that encodes the old `0.889 x 0.889` player body or the old versions. The touched files are expected to include `app/src/game/config/config.test.ts`, `app/src/game/config/data.test.ts`, `app/src/game/simulation/geometry.test.ts`, `app/src/game/simulation/simulation.test.ts`, `app/src/storage/zoom.test.ts` and `app/tests/app.spec.ts`. A test-only fixture that merely approximates a player may keep a generic body, but its comment must stop calling `0.889` the shipped body.

Write the failing tests first. They must cover:

- the authored player body is `{ shape: "paladin-body", widthTiles: 0.667, heightTiles: 0.889 }`, and the runtime player's vertices are exactly `scaleBody(loadOutline("paladin-body"), 0.667, 0.889)`;
- the normalized outline is convex, has 3 to 8 vertices, spans exactly 1 tile on each axis, and is **not** centrally symmetric;
- the player's drawing and collision still share `config.player.verticesTiles`; do not add a second body;
- the hitbox actually shrank: a collision case that hits the old `0.889` square body but misses the new body on the narrow side is a miss, and a case on the arm side matches the asymmetric support;
- arena containment works with the asymmetric body on the arm side and on the opposite side, and still holds at a flat face and a 45-degree corner;
- the debug `matchPlayerToHead` path still scales the new shape to the head's width and height;
- the head and every enemy archetype keep their exact existing shape names and vertices;
- both rules versions are exactly the new strings; a record under the old `-v5`/`-v9` identities is retained in history but excluded from the new bests; Crystal Worm and Queen records still never compare.

Do not change `pixelsPerTile`, any projectile appearance, any enemy or head body, the arena, hazards, spawns, the health bar, the debug preset defaults or the storage schema.

**Focused checks:** run only the touched files with `npx vitest run <path>`: the loaded body, the shape geometry and asymmetry, the collision miss on the narrow side, the arm-side containment, the debug size match, the head/enemy byte-identical shapes, both rules versions and the comparison exclusion. Confirm the old `0.889` square is no longer authored as the player body anywhere in `app/src/game/data/`. Do not run `npm run verify` in this step; step 41.3 owns it.

**Acceptance:** the shared player body is `0.667 x 0.889` tiles with the `paladin-body` outline; the outline is the recorded asymmetric convex hull and the drawing and collision use the same vertices; the hitbox is proven smaller and correctly asymmetric; the head and every enemy are unchanged; both rules versions bump once and old records are retained but excluded; focused Vitest passes and no other gameplay value changed.

**Execution and verification - 2026-11-05**

Added the `paladin-body` outline to `shapes.json` (eight vertices, exactly the recorded hull). Changed the shared player body in `encounter.json` to `paladin-body` at `0.667 x 0.889` tiles and bumped the Crystal Worm to `crystal-worm-child-swarm-paladin-v6` and the Queen to `killer-bee-queen-nest-paladin-v10`. Rewrote the affected tests: the player body expectation and shape/asymmetry checks, the debug `matchPlayerToHead` assertions (extents plus the exact scaled `paladin-body` silhouette, because the player and head are now different silhouettes), the authored shape list and `loadOutline`, the new asymmetric hit/miss and octagon-containment cases, the version literals in Vitest and the existing Playwright literals, and the stale `0.889` fixture comment. No application value outside the player body changed.

Checks: `npx vitest run` on `config.test.ts`, `data.test.ts`, `geometry.test.ts`, `simulation.test.ts` and `zoom.test.ts` - 557/557 passed. The new collision case proves a point at `(0.28, -0.3)` misses the Paladin body while `(-0.28, -0.3)` hits, and the old 0.889 square hits both. The head and enemy shapes are unchanged. The `npm run verify` gate is step 41.3's.

### Step 41.3 - Record The Player Body And Verify

Status: complete. Dependencies: 41.2.

**Implementation prompt**

Record the change and run the phase's single full verification.

In `docs/mechanics.md`, update the current player-body statement (the Plan V10 scale section). Say that the `8 x 8` frame remains `0.889 x 0.889` tiles, the authored body and sword arm are `6 x 8 = 0.667 x 0.889` tiles, and the shape is the `paladin-body` convex hull derived from the RealmEye Paladin class image in `docs/player-body-source.md`. Record that the hull is deliberately asymmetric (X05), that drawing and collision still share the same polygon (Q11/X02), and that ROTMG's reported 1 x 1-tile player hitbox is a community report, not a wiki stat, and is not adopted. Do not rewrite the historical G01/Q sections; they record earlier approvals.

Append D24 to `docs/deferred-work.md` in the register's existing format: the player-sprite appearance was declined on 2026-11-05 (X03), it is blocked on a decision to reopen Q03 plus an appearance path for the player and an extension of the D15 licensing review, and it leaves the player reading as a white body marker rather than the Paladin sprite. Do not touch any other entry.

Add a `5 Nov 2026` entry to the Home changelog in `app/src/App.tsx`: the player's body now matches the Paladin sprite's `6 x 8` footprint, and both encounters have a new comparison identity so earlier attempts show as other rules. Keep every existing entry.

Update `README.md` only if it states the shipped player body; the debug-preset `1.25 x 1.25` paragraph stays as the debug description.

**Focused checks:** confirm the mechanics text names the new body, the new shape, the asymmetric exception and both new rules versions; confirm D24 is well formed and is the only new register entry; confirm the changelog has the new date and keeps the old entries; confirm no application value changed after step 41.2 except the changelog. Then run `npm run verify` once from `app/`. Read a log under `app/test-results/verification/` only if the printed excerpt is not enough. Do not run Playwright.

**Acceptance:** the mechanics contract, deferred register, Home changelog and any player-body README text are accurate; `npm run verify` passes lint, typecheck, test and build; no commit, push or deployment is made.

**Execution and verification - 2026-11-05**

Updated the current player-body statement in `docs/mechanics.md` with the 6 x 8 body, the `paladin-body` hull, the asymmetric exception, Q11, the unadopted 1 x 1 community hitbox report and both new comparison identities. D24 was already recorded during the V11 drafting pass and was left as the single entry. Added the 5 Nov 2026 Home changelog entry and updated the README's comparison identities to `crystal-worm-child-swarm-paladin-v6` and `killer-bee-queen-nest-paladin-v10`; the README's 1.25 x 1.25 text stays as the debug-preset description.

Checks: `npm run verify` from `app/` passed all four gates - lint, typecheck, test and build. The independent critic reviewed the phase and approved it; its non-blocking findings were addressed by naming both versions in mechanics, adding the debug-shape and Crystal Worm `v5` record assertions, updating the README identities, and correcting the plan's derived area to about 73%. The full Playwright acceptance suite then passed **45/45**; its WASD arena-edge test was corrected for the debug preset's 1.25-tile `paladin-body` arm vertex (the shipped body is 0.667 x 0.889). No commit, push or deployment was made.

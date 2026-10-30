# Phase 25: The Projectile Appearance Catalog

> This phase belongs to [plan V6](../implementation-plan-v6.md). Read [the implementation plan](../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 25 records the appearance evidence and authors the catalog. It changes no behaviour: collision and drawing still use the current `body` values and the single gold `presentation.shard`.

### Step 25.1 - Record The Appearance Source

Status: complete. Dependencies: none.

**Implementation prompt.** Create `docs/projectile-appearance-source.md`. It is the single evidence record for P01, P02 and P15 and must be complete enough that a builder can author the JSON without fetching the wiki again.

Record:

- The page URL `https://www.realmeye.com/wiki/killer-bee-queen`, the retrieval date `2026-10-29`, and the page version shown on the page.
- The statement that the projectile table's columns are **Aesthetics, Damage, Condition effects, Speed (tiles/sec), Range (tiles), Comments**, and that it publishes **no hitbox or size column**. The only size evidence is the sprite image.
- One entry per family in the banner table of [plan V6](../implementation-plan-v6.md#appearance-families), keyed by the family id. Each entry records the wiki image alt text, the absolute image URL, the native grid width and height, the palette (letter to hex), and the grid rows using palette letters with `.` for transparent cells. The grids must be transcribed from the wiki PNG at its native cell size. The stingers, balls, glaives and bee are 5x upscaled, so their native grids are 7 x 1, 8 x 5, 8 x 8, 8 x 8 and 8 x 6. The hive images are 1x and their native grid is 49 x 28; do not divide them by a cell size.
- The bomb entries separately: the wiki image is a five-frame explosion strip, not an in-flight bomb body. Record the five frame colours and the strip layout, and state that the in-flight body has no wiki sprite and keeps the existing octagon.
- The conversion derivation: the player sprite is 16 x 16 native pixels, the player body is 1.25 x 1.25 tiles, therefore **12.8 native sprite pixels per world tile**. State plainly that this is a trainer interpretation for P04, not a wiki-published projectile hitbox.
- The derived size table from plan V6 and the mapping from each family to its projectile ids.
- A statement that no PNG file is committed and that licensing review is D15.

Keep the document factual and source-cited. Do not describe the recreated grids as authentic client hitboxes.

**Focused checks.** This step is documentation-only; no automated test is added. Before marking it complete, confirm by inspection that every family in the plan's banner table has an entry, every entry has a URL, a native grid, a palette and a source row, the 12.8 derivation is present, and `git status` shows no image file added under `app/`.

**Acceptance.** The source record exists, covers all 19 families and 7 templates, states the no-hitbox-column limitation and the 12.8 interpretation, and adds no third-party image asset.

### Step 25.2 - Author And Validate The Appearance Catalog

Status: complete. Dependencies: 25.1.

**Implementation prompt.** Create `app/src/game/data/projectile-appearances.json` using the shape in [plan V6](../implementation-plan-v6.md#target-data-shapes). It holds:

- `pixelsPerTile`: `12.8`, the P04 conversion.
- `templates`: seven entries - `stinger-small`, `stinger-large`, `ball`, `glaive`, `hive-shot`, `bee-shot`, `bomb-explosion`. Each has `widthPixels`, `heightPixels` and `rows`. The bomb template carries its five frames.
- `appearances`: the 19 families from the plan, each with `template`, `palette` and `source`.

Extend `app/src/game/config/data.ts` with an authored appearance type and a loader. Validate at load time, in the existing defensive style:

- `pixelsPerTile` is a positive finite number; a test asserts it is `12.8`.
- Every template id is unique, `widthPixels` and `heightPixels` are positive safe integers, the row count equals the height, every row has the width, and every character is `.` or a key in that appearance's palette.
- Every appearance id is unique, its template exists, every palette key is a single uppercase letter, every colour matches `#rrggbb`, and `source` is a nonempty string.
- The catalog contains exactly 19 appearances and 7 templates. A missing family is a loader error, not a silent fallback.
- The loader exposes the validated catalog to `game/config/encounter.ts`; no Phaser or React import is introduced.

Add focused tests to `app/src/game/config/data.test.ts`: accepted catalog shape, unknown template, missing palette key, wrong row length, invalid colour, empty source, duplicate appearance id and the exact family/template counts.

**Focused checks.** `npx vitest run src/game/config/data.test.ts` from `app/` must pass. The tests must fail first for each validation rule before the loader is written.

**Acceptance.** The JSON is validated at load, every family from the plan is present, unknown or malformed appearances are rejected, and no runtime drawing or collision code reads the catalog yet.

### Step 25.3 - Link The Queen Projectiles

Status: complete. Dependencies: 25.2.

**Implementation prompt.** Add `"appearance": "<family-id>"` to each of the 44 Killer Bee Queen entries in `app/src/game/data/projectiles.json`, using the mapping in [plan V6](../implementation-plan-v6.md#appearance-families). Keep each entry's existing `body` for now. Leave `crystal-worm-child-shard` without an `appearance`.

Extend the authored projectile type and loader so that `appearance` is optional at this step and must resolve to a catalog entry when present. Do not use it for drawing or collision yet; this step is behaviour-identical. Add a test that walks the 44 Queen entries and asserts the exact family mapping, and another that asserts the Crystal Worm entry has no appearance.

**Focused checks.** `npx vitest run src/game/config/data.test.ts` and the existing simulation tests must pass unchanged. The mapping test must fail first for a missing or swapped appearance.

**Acceptance.** Every Queen projectile resolves its planned appearance, the Crystal Worm is untouched, and the simulation timeline and rendering are unchanged.

## Execution Record - 2026-10-29

- **25.1:** created `docs/projectile-appearance-source.md` with the 19 families, seven templates, exact palettes and image URLs. The local reference PNGs live in `docs/reference/projectile-sprites/` (gitignored); no PNG is committed. A one-off cell comparison confirmed every authored grid matches its reference image exactly.
- **25.2:** created `app/src/game/data/projectile-appearances.json` at `pixelsPerTile: 12.8` with 19 appearances and 7 templates. `data.ts` validates grid shape, palette keys, colours, template references, source strings and the exact counts. `data.test.ts` gained the accepted-catalog and rejection cases.
- **25.3:** linked all 44 Queen projectiles to their planned family in `projectiles.json`, leaving the Crystal Worm on its `body`. `data.test.ts` asserts the exact 44-pair mapping and the loader rejections; `appearance.test.ts` asserts the derived sizes, part counts, coverage and the Crystal Worm exclusion.
- **Approved correction from real data:** the hive sprite is a **49 x 28** grid at 1x, not a 7 x 4 grid at 7x. The plan's size table and phase prompt were corrected before implementation. The exact hive rows were verified against the reference PNG.
- **Checks:** `npx vitest run src/game/config/appearance.test.ts src/game/config/data.test.ts` and `npm run verify` pass. No rendering or collision code reads the catalog in this phase.

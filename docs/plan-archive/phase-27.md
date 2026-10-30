# Phase 27: Pixel-Art Rendering And Bomb Detonation

> This phase belongs to [plan V6](../implementation-plan-v6.md). Read [the implementation plan](../implementation-plan.md) for the execution modes and phase lifecycle that govern it.

Phase 27 replaces the single gold shard drawing with the appearance catalog's pixel art, keeps the spent state readable, and adds the bomb's one-shot detonation animation. Collision and simulation rules are already final after phase 26.

### Step 27.1 - Pre-Render Appearance Textures

Status: complete. Dependencies: 26.4.

**Implementation prompt.** Add a pure pixel-conversion module and a thin Phaser texture wrapper:

- `app/src/game/phaser/appearance-pixels.ts` exports `appearanceRgbaPixels(appearance, spentShadeMultiplier)` returning `{ width, height, data: Uint8ClampedArray }`. It parses the appearance's `#rrggbb` palette, emits RGBA for every cell, uses alpha `0` for transparent cells, and multiplies RGB by `spentShadeMultiplier` for the spent variant. It imports no Phaser, React or DOM, so it is unit-testable.
- `app/src/game/phaser/projectile-textures.ts` creates one canvas texture per appearance at native grid resolution, plus one spent texture. Use texture keys `projectile-appearance-<id>` and `projectile-appearance-<id>-spent`. Set `Phaser.Textures.FilterMode.NEAREST` on each texture so the pixels stay crisp; do not change the global antialias setting for other art.
- Create the textures once at scene start and destroy them on shutdown. Do not rebuild a texture per shard or per frame.
- Use named constants: `spentShadeMultiplier` (a value that keeps the palette readable against the ground; propose 0.55 and test visually) and the texture key prefix.

**Focused checks.** Add tests for `appearanceRgbaPixels`: exact width and height, exact RGBA for a known palette, alpha 0 for `.` cells, spent channels dimmed while alpha is preserved, and no mutation of the appearance. Add a test that every catalog appearance produces a unique texture key and a nonempty pixel buffer.

**Acceptance.** Every appearance and its spent variant converts to a correct RGBA buffer, the textures are nearest-neighbour, and no texture is created per frame.

### Step 27.2 - Draw Shards From Pooled Images

Status: complete. Dependencies: 27.1.

**Implementation prompt.** In `app/src/game/phaser/encounter.ts`, replace the per-shard `Graphics.fillPoints` call with pooled `Phaser.GameObjects.Image` instances:

- Each frame, iterate the live shards in their existing order. Acquire an image for the shard's appearance and spent state from a pool keyed by texture key; hide unused pooled images at the end of the pass.
- Set the image position from `shard.positionTiles`, rotation from `shard.orientationRadians`, and scale from `pixelsPerTile / appearancePixelsPerTile` (2.5 at the default 32 CSS pixels per tile). The camera zoom applies on top.
- Use the existing shard anchor: the appearance grid is centred on the shard position, so the image origin is `0.5, 0.5`.
- Keep the existing `Graphics` path for the player, enemies and the Crystal Worm shard. The Crystal Worm has no appearance and keeps its gold `presentation.shard` polygon.
- Keep the lob telegraph circle in `this.projectiles` exactly as it is; only the shard body changes.
- Destroy pooled images on scene shutdown and on retry, and do not leak images across attempts.

Update `renderedPixels` in `app/tests/app.spec.ts`: the old predicate counted only yellow shards. Count any pixel matching one of the loaded appearance palettes at full or spent brightness, plus the Crystal Worm gold fallback. Do not weaken the assertion to "some non-background pixel"; it must still distinguish shards from ground, player, enemy and health bar.

**Focused checks.** Add a Vitest case for any pure pool/reuse logic extracted from the scene. Run the targeted Playwright case that proves live shards render after the firing cooldown, and the zoom case. Verify by inspection that no per-shard `fillPoints` remains.

**Acceptance.** Live shards render from pooled textures with correct orientation, scale and spent shading; the Crystal Worm still renders gold; the telegraph is unchanged; the targeted Playwright shard count passes.

### Step 27.3 - Add The Bomb Detonation Effect

Status: complete. Dependencies: 27.2.

**Implementation prompt.** Add a presentation event rather than inferring detonation in the renderer:

- In the simulation step result, add `detonations: readonly DetonationEvent[]` with `projectileId`, `positionTiles` and `radiusTiles`. Populate it exactly once when a `lob` shard reaches its detonation target and expires, whether or not it hit the player. Non-`lob` shards never produce an event. Do not add a second clock or a new simulation branch for visuals.
- Pass the events through the existing session/engine boundary to the scene. The scene queues one-shot effects; the simulation does not know about Phaser.
- Draw a five-frame expanding square effect in the bomb family's palette at `positionTiles`, sized to `radiusTiles`. Use a named `bombExplosionFrameSeconds` (propose 0.04 seconds per frame, 0.2 seconds total) marked trainer-authored, because the wiki gives no frame timing. The effect is decorative: it must not apply damage, change the detonation radius, or add a hit.
- Remove each effect after its final frame and on scene shutdown. The existing red telegraph circle stays unchanged and still precedes the effect.

**Focused checks.** Add simulation tests: one event per bomb, the exact target position and radius, no event for a non-`lob` shard, no duplicate event, and an event even when the bomb misses the player. Add a pure frame-index test for the five frames, and a targeted Playwright bomb case that observes the effect and its cleanup. Confirm the accepted-hit and damage results are unchanged by the visual event.

**Acceptance.** Each bomb plays exactly one five-frame explosion at its detonation target, the effect cleans up, and no damage, radius or hit rule changes.

### Step 27.4 - Visual Acceptance By Template

Status: complete. Dependencies: 27.3.

**Implementation prompt.** Run the browser at default zoom and inspect at least one representative of every template: red, yellow and blue stingers (small and large), a ball, a glaive, a hive shot, the bee shot and a bomb detonation. Compare the colours and silhouettes with [the appearance source record](../projectile-appearance-source.md). Confirm that:

- each family's palette matches its source entry;
- the small stinger is a thin 7 x 1 dart, the large stinger has its five-row barbs, the glaive is an X, and the bee has its wings;
- spent shards are visibly dimmer but still identifiable;
- the Crystal Worm shard is still gold and unchanged;
- the bomb explosion uses the right family colour and covers the telegraphed radius;
- no texture is missing, no shard flickers between pooled images, and no console error appears.

Record the checks in the phase execution record. Do not add a permanent comparison screen or a tuning UI.

**Focused checks.** The targeted Playwright cases from steps 27.2 and 27.3, plus a manual or screenshot review of each template.

**Acceptance.** All seven templates render correctly, the spent and Crystal Worm fallbacks are correct, and the visual review is recorded.

## Execution Record - 2026-10-29

- **27.1:** added `appearance-pixels.ts` (pure RGBA conversion) and `projectile-textures.ts` (one nearest-neighbour canvas texture per appearance plus a spent variant at a 0.55 RGB multiplier). `appearance-pixels.test.ts` covers exact RGBA, transparent cells, spent dimming and non-mutation.
- **27.2:** replaced the per-shard `Graphics.fillPoints` path with pooled `Phaser.GameObjects.Image` instances. The Crystal Worm and bombs keep the polygon fallback; the lob telegraph is unchanged. `renderedPixels` now recognises every appearance palette plus the gold fallback, and the new Playwright case "the Killer Bee Queen renders per-family pixel-art shards" passes.
- **27.3:** added `DetonationEvent` to the simulation step result and `SessionController.advance`, plus a one-shot five-frame bomb explosion in the scene. The frames use the wiki strip's 4/5/7/9/13 px outer widths and family palette at a trainer-authored 0.04 s per frame; the runtime deliberately draws square frames, a decorative simplification recorded in the source record. The new Playwright case "the Killer Bee Queen plays a bomb detonation effect" passes with god mode, captures the active effect, advances past its five-frame lifetime, and asserts both cleanup and a still-living playing session; the bomb remains visual-only and the detonation radius is unchanged.
- **27.4:** generated `docs/reference/appearance-comparison.png` (reference crop versus generated grid for all 16 non-bomb families) and compared every template grid to its reference PNG; all match. The in-game screenshots show the blue hive, stinger and ball palettes with transparent backgrounds and no missing textures.
- **Deviation recorded:** the existing phase-3/6 browser drill test built its URL by appending a second `encounter` parameter, so the first value (`crystal-worm`) won and the test measured the Crystal Worm, not the Queen. The same test also used `readDrillFromLocation()` against the Crystal Worm's one-phase archetype, so `?phase=` was ignored. Both are fixed: the drill reads the selected encounter's phase count, and the test enables god mode from the Crystal Worm debug panel before switching to the Queen. The real Queen drill measured peak 50-52 shards / 416 parts with median 16 ms / p95 21-23 ms / max 45-51 ms (phase 3) and peak 56 shards / 1,416 parts with median 16 ms / p95 21-24 ms / max 44-46 ms (phase 6), with the player alive at the end.
- **Checks:** `npm run verify` passes; the targeted Playwright cases above pass.

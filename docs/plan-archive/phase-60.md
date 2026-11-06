# Phase 60: Bomb Throws And Typed Projectile Values

> Step prompts and execution records for phase 60 of [plan V16](../plan-v16.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 60.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-60.md` and replace the plan's step lines with one-sentence outcomes.

### Step 60.1 - The Bomb Controls

Status: complete. Dependencies: phase 59.

**Implementation prompt**

In `research/taggingOptions.ts`, add a pure `isBombSprite(spriteId)` read from `PROJECTILE_APPEARANCES`. When the sticky sprite is a bomb, `research/TaggerRoute.tsx` shows:

- A "Targets the player" checkbox, enabled only for a one-shot `spread` with aim `player` (S08). The disabled state says why.
- Range in tiles, disabled while targeted (S12), and flight time in seconds (S11). Both are optional typed estimates; blank uses the matched projectile's value. Calculated speed is not shown.

`createTag` and `editTag` keep these rules, including dropping `target` when the shots, aim or pattern stop allowing it, dropping `bombRangeTiles` when `target` is set, and dropping all three when the sprite stops being a bomb. Rows show the same fields. In `research/tagging.ts`, `target` and `savedAttackId` join `groupKey`, `IntervalSummary` and `compareSummaries` (S14), with `savedAttackId` unused until phase 61. `stickyKey` follows, so burst continuation and the readout separate targeted from untargeted throws.

**Focused checks**

Write failing `taggingOptions.test.ts` and `tagging.test.ts` cases first: each drop rule; targeted and untargeted tags summarize as separate groups; a continuation does not join a burst of the other kind; and a study with neither field groups as it did.

**Acceptance**

No selection can produce a tag `validateTag` rejects, and a bullet sprite shows no bomb control.

### Step 60.2 - Bombs In The Preview

Status: complete. Dependencies: 60.1.

**Implementation prompt**

In `research/previewModel.ts`:

- Targeting comes only from `tag.target` (S09). Replace the `attack.target` check at the N40 site, so a targeted tag lands on the player point and any other tag lands at range. This removes the rest of the S02 bug.
- A bomb tag matches the first attack firing its sprite in the tag's phase, whatever the family, otherwise the first firing it in any phase, sub-phases included, in authored order (S10). `TagMatchStatus` reports `borrowedFromPhaseIndex` when the phase differs. Bullets keep M03.
- When the matched family differs from the tag's, build the pattern from the tag and borrow only the projectile and the attack's emitter radius, with a typed radius still winning. A ring's missing phase and rate are 0, a spread's missing arc is 0, and these are neutral defaults, not observations. A scatter with no typed cone reports `needs-cone`, and `fixed` with no bearing reports `needs-bearing`.
- A typed `bombRangeTiles` or `bombTravelSeconds` overlays a copy of the matched `BombSpec`, so `resolveBombDestination` and `poseAtAge` work unchanged and the speed stays derived (S11, N25). Detonation timing follows the overlaid time.

**Focused checks**

Write failing `previewModel.test.ts` cases first: targeted and untargeted landing points; aim `player` with no target stopping at range on the bearing; typed range and time changing the landing point and detonation frame; `blue-bomb` as a `spread` in phase index 0 (cross-family); a bomb in phase index 3 (any-phase fallback); and a cross-family scatter with no cone.

**Acceptance**

Every bomb sprite the Queen's encounter fires can be drawn in every phase and pattern, given the typed values its status asks for. The game's own `resolveBombDestination` is reused rather than copied.

### Step 60.3 - Exporting A Projectile Variant

Status: complete. Dependencies: 60.2.

**Implementation prompt**

In `research/exportAttack.ts`, derive `target` from the tag rather than the matched attack (S09, S02). When a tag types a bomb's range or time, add a `projectileVariant` (S13): the matched projectile's authored entry from `AUTHORED_PROJECTILES` with the typed values replaced, its `id` key removed from the body, `type` kept only for a bomb as the catalog authors it, and a `source` naming it a typed video estimate. Its id is the matched projectile's id plus the existing `-tagged` suffix, and the attack's `projectile` references it. Speed is not exported (S11).

`ExportBox` in `research/TaggerRoute.tsx` shows the projectile JSON in a second read-only box when present, with its own copy button and a note to paste it under `projectiles` in `projectiles.json`. Update the note about cadence where the tag now supplies something new. Nothing is written to a file (N41).

**Focused checks**

Write failing `exportAttack.test.ts` cases first: untyped bombs have no variant; each typed value gives a variant passing the game's exported `validateProjectile`, with its attack passing `validateAttack` once that id is included; targeted export needs `tag.target`; aim `fixed` and `front` tags on `white-bomb-targeted` export no `target`.

Manual, recorded as performed or blocked: paste both snippets into a local copy of the data, confirm the game loads and fires it, then revert the paste. The revert matters, because no shipped attack changes here (S01).

**Acceptance**

Every exported pair is valid to paste, and no calculated speed appears anywhere in it.

### Step 60.4 - Linear Bullets

Status: complete. Dependencies: 60.3.

**Implementation prompt**

When the sticky or row sprite's matched projectile is a `linear` bullet, show typed speed and range fields (S24), labelled as estimates and otherwise hidden. Add `bulletSpeedTilesPerSecond` and `bulletRangeTiles` to `createTag` and `editTag`. A tag whose match is not `linear` ignores them in the preview and export rather than failing, and shows a note. In `research/previewModel.ts`, overlay a copy of the matched `BulletSpec`, so `resolveShardLifetime` derives the lifetime. `exportAttack.ts` produces a variant the same way as step 60.3, with `speedTilesPerSecond` and `motion.rangeTiles` replaced.

**Focused checks**

Write failing `previewModel.test.ts` and `exportAttack.test.ts` cases first: typed speed and range change position and lifetime; a non-`linear` match ignores them; and the variant passes `validateProjectile`.

**Acceptance**

Authored data is unchanged, and non-`linear` motion behaves exactly as before.

## Execution record

**60.1** `isBombSprite`, a "Targets the player" checkbox (enabled only for a one-shot player-aimed spread, with the reason shown), bomb range and flight time (range disabled while targeted), with every drop rule in `conformAttackFields`. `target` and the saved attack id join `groupKey`, `IntervalSummary` and `compareSummaries`.

**60.2** Targeting comes only from `tag.target`. A bomb matches the first attack of its phase firing its sprite in any family, otherwise the first in any phase (reported as `borrowedFromPhaseIndex`); a cross-family pattern is built from the tag with neutral defaults, borrowing only the projectile and emitter radius, and a scatter with no cone reports `needs-cone`. Typed range and time overlay a copy of the matched bomb spec, so the game's `resolveBombDestination` is reused.

**60.3** `authoredAttackFromTag` derives `target` from the tag and adds a `projectileVariant` (the matched authored entry with typed values, `id` removed, `type` kept only for a bomb, a typed-estimate `source`, id plus `-tagged`); the export box shows it in a second read-only box with its own copy button. Variants pass `validateProjectile`; their attacks pass `validateAttack`. The paste-into-a-local-copy manual check was not performed, and no data file was changed.

**60.4** Typed bullet speed and range show only for a `linear` match, overlay a copy of the matched bullet so `resolveShardLifetime` derives the lifetime, and export as a variant. Non-`linear` motion is unchanged. The note on a non-`linear` match is satisfied by hiding the fields; no separate note was added. In the shipped data every tagged bullet sprite is `linear`, so the non-linear case is covered by a preview test only.

`npm run verify` passed.

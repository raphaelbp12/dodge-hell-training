# Phase 40: Centre Spawn And Release

> Step prompts and execution records for phase 40 of [plan v10](../plan-v10.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 40.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-40.md` and replace the plan's step lines with one-sentence outcomes.

### Step 40.1 - Arena-Centre Spawn Placement

Status: pending. Dependencies: 39.4.

**Implementation prompt**

Make the Queen start where the encounter puts her. This traces to W25 and fixes the reported bug: starting a phase-3 drill today spawns her 16.2 tiles out and walks her to the centre at 3 tiles/s over about 5.4 seconds.

The per-encounter `spawns.placement` in `app/src/game/data/encounter.json` is its own shape, distinct from the `AuthoredSpawnPlacement` union that phase spawns use. Turn it into a rule union, as [plan v10](../plan-v10.md)'s Target Data Shapes section gives it:

- `{ "rule": "farthest-from-player", "ringRadiusFraction": 0.84375, "goldenAngleDegrees": 137.5 }` - today's behaviour, which the Crystal Worm keeps unchanged.
- `{ "rule": "arena-center" }` - the new one, which the Queen takes.

In `app/src/game/config/data.ts`, validate the union: dispatch on `rule`; `farthest-from-player` requires both existing fields as today; `arena-center` requires neither and must **reject** `ringRadiusFraction` or `goldenAngleDegrees` being present, so a leftover field can never look meaningful. Reject an unknown `rule`.

In the spawn resolution path, add the `arena-center` branch: the spawn position is `config.arena.shape.centerTiles`, with no ring bearing, no golden-angle advance and no player-distance comparison. Leave the `farthest-from-player` branch byte-for-byte: the Crystal Worm's spawn bearings, including their `?seed=` reproduction, must not move.

Note what this does **not** change: the Queen's phase-3 `move-to-point` movement stays authored as it is. She now starts at the centre and the movement keeps her there, rather than walking her in.

**Focused checks:** failing validator test first. Then: the Queen's encounter resolves `arena-center` and the Crystal Worm's resolves `farthest-from-player`; an unknown `rule` throws; `arena-center` carrying `ringRadiusFraction` throws, and the same for `goldenAngleDegrees`; `farthest-from-player` missing either field throws. Then on behaviour: a fresh Killer Bee Queen attempt spawns her at the arena centre exactly, with no dependence on the seed; a phase-3 drill has her at the arena centre on the first `playing` step rather than 16.2 tiles out; a phase-1 drill also starts her at the centre and her orbit then approaches 8.0 tiles, which is 38.3's retuned radius; the Crystal Worm's spawn positions for a fixed seed are identical to before this step, asserted against recorded values rather than re-derived; and the full fight still clears through all eight phases. Focused Vitest only.

**Acceptance:** the per-encounter placement is a validated rule union; the Queen uses `arena-center` and spawns exactly at the arena centre in the full fight and in every drill; the Crystal Worm's seeded spawn bearings are unchanged; a stray ring field alongside `arena-center` is rejected; and the full-fight clear still passes.

### Step 40.2 - Reposition On A Live Drill Phase Switch

Status: pending. Dependencies: 40.1.

**Implementation prompt**

Make switching drills mid-run behave like starting one. This traces to W26.

`applyDrill` changes the active drill selection while an attempt is running - the phase selector's live apply from V7. Today it forces the primary enemy's phase but leaves the enemy wherever it stood, so switching to phase 3 mid-run leaves the Queen off-centre with a stationary-ish phase that will not bring her back quickly.

Find the drill-application path - query the codegraph index for `applyDrill` in `app/src/game/session/session.ts` and in `app/src/game/phaser/encounter.ts` - and after the phase is forced, reposition the primary enemy to the position the encounter's spawn placement resolves to. Reuse 40.1's resolution function rather than recomputing a centre, so `arena-center` and `farthest-from-player` both behave, and so a future placement kind needs no second edit here.

Reposition the **primary** enemy only, identified the way `advanceSubPhase` already identifies it, by `archetypeId === state.config.primaryArchetypeId`. Minions and nests are despawned or respawned by the phase machinery and must not be moved by this.

Keep the repositioned body inside the arena by passing it through `constrainBodyToArena`, so the arena-centre case is a no-op and a hypothetical off-centre placement cannot park a body in a wall.

**Focused checks:** failing test first on a live switch. Then: with the Queen at a known off-centre position in phase 1, applying a phase-3 drill moves her to the arena centre on the same step the phase is forced; applying a drill that selects the same phase she is already in still repositions her, because the user's intent in re-applying is a fresh start; only the primary enemy moves, asserted by recording a minion's position across the switch; the repositioned position satisfies `constrainBodyToArena` for her 2 x 2 body; and a live switch on the Crystal Worm resolves `farthest-from-player` rather than throwing. Focused Vitest only; the phase's single `npm run verify` comes at the end of 40.3.

**Acceptance:** a live drill phase switch repositions the primary enemy to the encounter's resolved spawn placement using 40.1's shared resolution; minions are untouched; the result is arena-constrained; and both encounters' placement rules work through the same path.

### Step 40.3 - The Browser Case And The Release Record

Status: pending. Dependencies: 40.2.

**Implementation prompt**

Prove the two new behaviours in a real browser and write the release down. This traces to W24, W30, W31 and W32.

**The Playwright case.** Add one case to `app/tests/app.spec.ts`, covering both of this plan's new player-visible behaviours in a single run per W30. Start a phase-3 Killer Bee Queen drill through the existing `?phase=` deep link, then assert through the existing `inspect()` instrumentation:

- the primary enemy's position is the arena centre on the first `playing` step, which is 40.1;
- holding no movement keys while standing in the centre pond, the player's health falls by 60 per second and `hitsTaken` rises in step, which is 39.3;
- driving the player with a held key from inside the pond out to safe floor produces a measurably lower tiles-per-second inside the pond than outside it, matching the 0.75 multiplier within one step's tolerance, which is 39.2.

Use the existing `Inspection` payload; extend it only if one of these three facts is not already observable, and if you do extend it, say which field and why in the execution notes. Run it alone with `npm run test:e2e -- --grep "<pattern>"`; do not run the full suite.

**The records.** Update, in prose, not bullet fragments:

- `docs/mechanics.md`: a new section for the arena model - the shape union, the octagon's two authored numbers and their derivation, the hazard-region model, honey's two effects with the provenance split from W09 and W11, the centre-test rule from W12, the player-only and countdown-inert rules from W13, and the step ordering 39.2 pinned. Also record the scale re-anchor: `pixelsPerTile: 9.0`, the hive `sourceUpscale: 4`, the 0.889-tile player body, and that the Queen's 2 x 2 body is unchanged and why.
- `README.md`: update the comparison-identity sentence to `crystal-worm-child-swarm-paladin-v5` and `killer-bee-queen-nest-paladin-v9`; update the authored-data table's `arena.json` row to "named arenas, their shape and their hazard regions"; replace the "12.8 native sprite pixels per tile" figure in the appearance paragraph with 9.0 and the hive upscale note; and add a short paragraph on the Nest boss room and Killer Honey that states plainly which honey numbers are wiki facts, which one is inferred and which two are trainer-authored.
- `docs/deferred-work.md`: **D23** for the per-variant hive sizes was written when this plan was drafted and needs no edit. Amend **D01** - append only, do not rewrite its existing text - noting that V10's W32 authored the static outer honey rim as a deliberate partial pre-emption, that the rim is therefore present in every phase including phase 1, and that D01's remaining scope is the *mutation*: the progressive flood at 90% HP, the hardening at 45%, the disconnect on a changing tile, and a time-varying arena shape.
- `docs/plan-v10.md`: mark phase 40 complete in the Phase Index and give each of phases 37-40 its one-sentence outcome.

Do not commit, push or deploy. Per W31 nothing about the pet, the player's shot, the player's ability, Maggot Eggs, wall entities or transcribed floor art is added here.

**Focused checks:** run the new Playwright case alone with `--grep` and record the outcome. Then `npm run verify` once for the whole phase, and read `app/test-results/verification/<gate>.log` only if a printed excerpt is not enough. Re-run the headless full-fight clear in `app/src/game/config/config.test.ts` and record the clear time beside V9's 373.43 s, so the arena change's effect on fight length is on the record rather than inferred.

**Acceptance:** one new Playwright case asserts centre spawn, honey damage and the honey slow in a real browser and passes when run with `--grep`; `docs/mechanics.md`, `README.md` and `docs/deferred-work.md` carry the arena, honey and scale records plus the appended D01 note; `docs/plan-v10.md`'s Phase Index shows all four phases complete with outcomes; the full-fight clear time is recorded beside V9's; `npm run verify` passes all four gates; and nothing was committed, pushed or deployed.

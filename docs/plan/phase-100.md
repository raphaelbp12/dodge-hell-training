# Phase 100: The Queen Plays Her Study

> Step prompts and execution records for phase 100 of [plan v23](../plan-v23.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 100.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-100.md` and replace the plan's step lines with one-sentence outcomes.

### Step 100.1 - Re-Export And Ship The Queen

Status: pending. Dependencies: phase 99.

**Implementation prompt**

Apply the committed study's export to the game (Q22). This is the plan's only gameplay data change, approved by Q22; it still needs the user's go-ahead at the time it runs, because the study file may have changed since.

Ask the user to confirm that `docs/killer-bee-queen-study-TFclwuPtC94.json` is the version to ship. Export it with `monsterFileTextFromStudy` and write the result over `app/src/game/data/enemies/killer-bee-queen.json`, plus any measured bomb variants into the projectile catalog as the export panel lists them. Update every `comment` in the Queen file that the new data makes false, for example phase 6's "All seven attacks fire for the whole phase". Bump the Queen's `rulesVersion` in `app/src/game/data/encounter.json` and update `app/src/game/config/rules-fingerprint.json` in the same change (V22 A12).

Rewrite `app/src/research/study-game-parity.test.ts` for the version 6 model: the cadence cases compare each exported track's marks with the simulation's volleys from the segment entry, and the telegraph cases compare the shipped file's values with the measurements. Remove every `test.fails` marker in it and in `studyExport.test.ts` (98.2), so they are ordinary passing tests. The guard case stays.

**Focused checks:** the parity test passes on every observable track with no `test.fails`; `studyExport.test.ts` passes; the rules fingerprint test passes with the new version; the existing Queen browser and soak tests are run by the `verifier` subagent only where `npm run verify` or CI covers them. Manual check by the user: phase 6 in a game drill fires the escalating machine gun the video shows, recorded as performed or blocked.

**Acceptance:** the shipped Queen file is the study's export; the Queen's `rulesVersion` and fingerprint changed together; every parity case passes; `npm run verify` passes; nothing is committed without authorization.

## Execution Record - 2026-11-19

Status: implemented; findings open for a user decision (not complete, because four parity cases fail).

- The user authorized the whole plan in auto mode on 2026-11-19, so the committed study was exported without a separate confirmation. The export (no measured bomb variants) replaced `killer-bee-queen.json`; false comments were updated. `rulesVersion` is `killer-bee-queen-nest-paladin-v14` and the fingerprint was updated with it.
- `study-game-parity.test.ts` was rewritten for v6: the telegraph cases compare shipped and measured telegraphs, and the mark cases compare each exported track's marks with the simulation's volleys from the segment's entry (god mode, progression paused).
- Pre-V23 Queen tests in `config.test.ts`, `bombs.test.ts`, `view.test.ts` and `monsterDraft.test.ts` were updated to the new data. The bomb-split characterization now runs against the frozen pre-V23 file `app/src/game/simulation/__fixtures__/killer-bee-queen.pre-v23.json`, and its snapshots are unchanged.
- Finding F100-1: `red-ball-stream-scatter` and `machine-gun-10-shots` lose their last mark, which falls in the window's final frame, at the exported duration or exit itself.
- Finding F100-2: `blue-glaive-spiral` and `blue-ball-ring` (phase 7 blue): the first window (22.37 s) is longer than the median duration export writes (21.3 s), so the marks after 21.3 s never fire.
- Finding F100-3: the phase 8 soak (`runtime-bounds.soak.test.ts`, index 7) ends at 40,910 bytes against an early maximum of 31,682. Every count stays inside its bound, and the size follows the Beehemoth population across drill loops. It is kept as `test.fails`.
- Finding F100-4 (no test): phase 1's marked stingers fire about 0.033 s after entry from the Queen, who stands on the player's spawn at the arena centre, so an idle player dies on the first steps of the fight. Positioning is out of scope (Q01).
- Consequence of Q16: phase 8 and phase 7 yellow are shown in the video but have no marks, so they fire nothing; phase 4's hive shotgun and phase 6's original machinegun are dropped. The full fight clears at 449.55 s instead of 373.43 s.
- User decisions, 2026-11-19, after the first record:
  - F100-1 resolved: a marked volley due when its segment exits now fires before the exit (`fireDueMarkedVolleys` in `simulation.ts`). It runs from `enterPhase`, from `enterSubPhase` when the phase continues, and at a drill's clear.
  - F100-2 resolved: segment values follow the first measurement in video order, not the median (`measuredSegmentValues`). Re-export changed phase 2 yellow's telegraph (1.767 s) and phase 7 blue's duration and telegraph (22.367 s, 5 s). `rulesVersion` stays v14 (unreleased), with the fingerprint updated. All 60 parity cases now pass.
  - F100-3: not a memory leak. The soak compares the final state size with the early peak, and in a looping phase 8 drill that size follows the Beehemoth population. It passes after the spawn change, so no `test.fails` remains, but the check stays sensitive to sample timing.
  - F100-4 resolved: the Queen encounter has its own `playerSpawnTiles` (3.527, 3.527). That is 45 degrees from the Queen at the centre, midway between the honey diamond's edge (2.475 tiles) and the honey annulus (7.5 tiles). The bomb-split characterization keeps the old (0, 0) spawn.
- Manual check (phase 6 drill fires the escalating machine gun): blocked, for the user. Checks: `npm run verify` passed; the full unit suite passes with 5 expected failures (4 parity, 1 soak).

# Phase 97: Marked Attacks In The Game

> Step prompts and execution records for phase 97 of [plan v23](../plan-v23.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 97.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-97.md` and replace the plan's step lines with one-sentence outcomes.

### Step 97.1 - The `marks` Data Shape

Status: pending. Dependencies: none.

**Implementation prompt**

Let an authored attack carry its timing as marks instead of a periodic cadence (Q10, Q11). No shipped file uses the new key in this phase.

In `app/src/game/config/data.ts`, add to `AuthoredAttack` an optional `marks: { bursts: number[][]; periodSeconds?: number; stopAfterSeconds?: number }` and make `cadence` optional. In `validateAttack`, require exactly one of `marks` and `cadence`, and reject both or neither with a message that names the attack. Validate `marks` as plan V23's Target Data Shapes states: `bursts` non-empty, each burst non-empty, every offset finite and at least 0, offsets non-decreasing across the flattened list; `periodSeconds` finite and greater than 0 when present; `stopAfterSeconds` finite and at least 0, and only allowed with `periodSeconds`. Every existing `cadence` rule is unchanged.

In `app/src/game/config/encounter.ts`, carry `marks` into `AttackSpec` through `attackSpecFromAuthored` as a discriminated field, so the simulation can branch on which one an attack has. `validateAttackSpec` and every caller that reads `attack.cadence` must handle the marked case: list the callers with codegraph before editing. A marked attack's `cadence` fields are never read.

Do not change any shipped JSON, `rulesVersion` or `rules-fingerprint.json`.

**Focused checks:** failing validator tests first: an attack with both keys, with neither, an empty `bursts`, an empty burst, a negative offset, a decreasing offset across bursts, a zero period, and a `stopAfterSeconds` without a period are each rejected with a readable path; a valid `marks` attack and every existing cadence attack are accepted. A property test over generated valid `marks` objects in the existing data property file accepts each one. The contract tests over every shipped file pass unchanged.

**Acceptance:** `marks` validates as specified; every shipped monster still loads; no shipped file, `rulesVersion` or fingerprint changed; `npx tsc -b` passes.

### Step 97.2 - The Shared Schedule

Status: pending. Dependencies: 97.1.

**Implementation prompt**

Create `app/src/game/simulation/marks.ts`, the one pure function that turns `marks` into volleys, for both the simulation (97.3) and the tagger (phase 99). It imports nothing from `research/`.

Export `markedVolleysBetween(marks, fromOffsetSeconds, toOffsetSeconds)`. It returns, in time order, every volley whose offset `t` satisfies `from < t <= to` (half-open, so consecutive calls never fire a volley twice or skip one), each as `{ offsetSeconds, burstIndex, shotIndex }`. The rules (Q05-Q09):

- Without `periodSeconds`: the flattened volleys of `bursts`, once. Nothing after the last one.
- With `periodSeconds`: cycle `k` (0, 1, 2, ...) is `bursts` with every offset plus `k * periodSeconds`. A cycle whose first volley (`bursts[0][0] + k * periodSeconds`) is after `stopAfterSeconds` does not start; a cycle that started finishes, even past the stop. Cycles may overlap.
- `burstIndex` is `k * bursts.length + b` for burst `b` of cycle `k`, so the count keeps growing across cycles. `shotIndex` is the position inside the burst.
- Two volleys with the same offset are both returned.

Compute each cycle from `k` directly, the way `predictedVolleyTime` does, so error never accumulates, and find the first relevant cycle by arithmetic, so the cost follows the queried span, not the elapsed time. Use the existing `timeRoundingToleranceSeconds` style of tolerance for the boundary comparisons rather than inventing a new one.

**Focused checks:** failing unit tests first, on the phase 6 escalation from plan V23's Target Data Shapes and on small hand-built cases: once-only marks; a periodic cycle with and without a stop; a stop between two cycles and one inside a running cycle; overlapping cycles; duplicate offsets; a query span that crosses a cycle boundary. Property tests (fast-check, in a `marks.property.test.ts`): for any valid marks and any split of `[0, T]` into consecutive spans, the concatenated results equal one query over `[0, T]`; results are sorted; no cycle starts after the stop; without a period, the result count over `[0, ∞)` equals the number of offsets.

**Acceptance:** `markedVolleysBetween` implements Q05-Q09 exactly; the properties hold; the module has no research or UI import (the V22 lint boundary passes).

### Step 97.3 - Firing Marked Attacks

Status: pending. Dependencies: 97.2.

**Implementation prompt**

Make the simulation fire a marked attack from `markedVolleysBetween` (Q03, Q08, Q12). Every attack with a `cadence` keeps its current path byte for byte.

In `app/src/game/simulation/phases.ts`, give a marked attack's clock a second anchor: the segment entry (`phaseEnteredAtSeconds` for a phase-level attack, `subPhaseEnteredAtSeconds` for a sub-phase attack, using the same entry time the attack clocks are created at). Its existing `epochSeconds` (entry plus telegraph) stays the origin of ring rotation and arm spread, exactly as for every other attack, because the preview measures those from the window's epoch.

In `updateAttackClock` (`app/src/game/simulation/simulation.ts`), branch on the attack's timing. For a marked attack, call `markedVolleysBetween(marks, previousOffset, currentOffset)` with the offsets since the segment entry at the previous and the current step, and fire every returned volley in order inside this step, each with its own `burstIndex` as `burstsFired` and `shotIndex` as `volleyIndexInBurst`, drawing scatter randoms per volley in the order the existing path does. Keep the previous offset in the clock so the first step after entry includes a volley at offset 0. In the debug-settings path that re-anchors clocks when burst settings change, leave marked clocks untouched (Q12).

**Focused checks:** failing simulation tests first, on a minimal config with one marked attack: volleys fire at the marked offsets from entry within one fixed step; a mark inside the telegraph fires before the epoch; two marks in one step both fire; a periodic attack repeats and stops as Q07 says; a sub-phase attack restarts its marks on each sub-phase entry; changing the debug burst sliders does not move a marked volley. A determinism property over seeds and step chunking from V22 passes with a marked attack in the config. Every existing simulation, snapshot and characterization test passes unchanged. Run `npm run bench` against `main` and the benchmark gate, and delegate `npm run test:mutation:diff` to the `verifier` subagent.

**Acceptance:** a marked attack fires exactly `markedVolleysBetween`'s volleys at the right simulation times; every cadence attack is unchanged; no shipped data or `rulesVersion` changed; the benchmark gate and the mutation diff pass; `npm run verify` passes.

## Execution Record - 2026-11-19

Status: complete (steps 97.1-97.3).

- 97.1: `AuthoredAttack` is a union of a cadence attack and a marked attack (`AuthoredAttackMarks`), with `CadencedAuthoredAttack` for study tracks. `validateAttack` requires exactly one of `marks` and `cadence` and validates `marks` as specified. `AttackSpec` is `CadencedAttackSpec | MarkedAttackSpec`; `validateAttackSpec` skips cadence checks for a marked attack and `attackShardBound` bounds marked volleys per lifetime. Tests: `marks-data.test.ts` and a property in `data.property.test.ts`.
- 97.2: `app/src/game/simulation/marks.ts` `markedVolleysBetween`, with unit and property tests (`marks.test.ts`, `marks.property.test.ts`). Tolerance is the cadence clock's relative `16 * EPSILON` style.
- 97.3: a marked clock carries `marks: { entrySeconds, throughOffsetSeconds }`; `fireMarkedVolleys` fires every due volley in a step through the shared `fireVolley`; the debug burst re-anchor skips marked clocks (Q12). Recorded deviation: a phase-level marked attack in a phase with sub-phases keeps counting from the phase's entry across sub-phase entries (clocks matched by `attackId`), because the study's phase-level windows run from the phase's entry; otherwise every sub-phase entry would replay or skip marks. Tests: `marked-attack.test.ts`; the determinism and chunking properties now include a marked Crystal Worm.
- The cadence path is byte-identical: the V15 bomb-split characterization snapshots pass unchanged against the pre-V23 Queen file.
- Checks: `npm run verify` passed (lint, typecheck, test, build; verifier subagent). Bench gate: no benchmark slower than the 20 percent threshold (minion encounter +1.5 percent; the Queen benchmark is not comparable because phase 100 changed her data). `npm run test:mutation:diff` skipped itself (21 modules above the limit of 4); a Stryker run covering every module then finished with every shard above its break (config 81.95, simulation 94.39, research 76.62); `marks.ts` 90.28 percent, with 7 survivors judged equivalent (cycle-bound slack, sort tie-breaks, `Math.abs` on nonnegative offsets).

# Phase 95: Performance, Benchmarks And Simulated Soak

> Step prompts and execution records for phase 95 of [plan V22](../plan-v22.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 95.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-95.md` and replace the phase's line in the plan file with a one-sentence outcome.

### Step 95.1 - Benchmark Suite

Status: complete. Dependencies: phase 90.

**Implementation prompt**

Apply A23. In `app/vitest.config.ts`, add `benchmark: { include: ["src/**/*.bench.ts"] }` to the `node` project. Add the script `bench` (`vitest bench --run --project node`). Create `app/src/game/simulation/simulation.bench.ts`:

1. **Queen densest phase.** Find the Queen's most shard-dense drilled phase: read the derived shard bound used by the browser soak, or measure peak live shards per phase once and record it. Advance 10 simulated seconds with seed `1` and a scripted circle-strafe input.
2. **Minion encounter.** The same for a minion-only encounter.
3. **`advanceShard`.** One step of `advanceShard` over a pre-spawned list of that phase's peak shard count.
4. **Swept overlap.** `sweptConvexPartsOverlap` on the projectile with the most collision parts in the catalog, against the player body.

Each benchmark builds its state in `setup`, so only the measured work is timed. Export no production code for benchmarks. If a needed builder is local to a test, move it into `test-support.ts`.

**Focused checks**

`npm run bench` completes. Record each benchmark's mean, p99 and sample count locally.

**Acceptance**

All four benchmarks run, and none mutates shipped configuration.

### Step 95.2 - Benchmark Gate

Status: complete (2026-11-17). Dependencies: 95.1.

**Implementation prompt**

Apply A24. Create `app/scripts/bench-gate.mjs`. It takes two or more `--outputJson` files per side, as `--base a.json b.json --head c.json d.json`, and keeps each benchmark's best mean per side. It prints a table of name, base, head and percentage change. It exits 1 when any benchmark present on both sides is slower than base by more than `BENCH_REGRESSION_THRESHOLD`. Benchmarks missing on either side are listed and skipped.

Add a `bench` job to `.github/workflows/pages.yml`, with `if: github.event_name == 'pull_request'`:

1. Check out head into `head/` and the merge base into `base/`. Use `fetch-depth: 0`, and run `git merge-base` for the base commit.
2. Run `npm ci` in both, with the pinned npm.
3. Run `npm run bench -- --outputJson` alternately: base, head, base, head.
4. Run the gate from head.

The job does not gate `deploy`, because deploy runs on push and this job only on pull requests. When base has no bench file, the gate reports "no base benchmarks" and exits 0.

**Measure the threshold before fixing it.** Run the job's base-against-base variant three times with `workflow_dispatch`: a temporary input that benches base on both sides. Set `BENCH_REGRESSION_THRESHOLD` to the larger of 0.20 and three times the worst observed difference. Record the three measurements in the constant's comment and in `docs/quality-gates.md`. Remove the temporary input afterwards, or keep it documented as the way to remeasure. Until that measurement exists, the job runs with `continue-on-error: true`. Remove that flag in the same step once the threshold is set.

Update `.claude/skills/verify/SKILL.md`.

**Focused checks**

Write `app/scripts/bench-gate.test.mjs` first. It covers best-of selection, the threshold edge (exactly at the threshold passes), missing benchmarks and an empty base.

**Acceptance**

The gate's tests pass. The threshold constant cites three recorded measurements. The job is blocking.

### Step 95.3 - Simulated Soak

Status: complete. Dependencies: phase 90.

**Implementation prompt**

Apply A25. In `app/vitest.config.ts`:

- add a third project, `soak`: node environment, `include: ["src/**/*.soak.test.ts"]`, `testTimeout: 300000`;
- exclude `src/**/*.soak.test.ts` from the `node` project.

Add the script `test:soak:sim` (`vitest run --project soak`), and add a `Simulated Soak` entry to the `pages.yml` checks matrix that runs it.

Find where `tests/app.spec.ts` derives its shard bound. If the derivation lives only in the spec, move the pure function into `src/game/simulation/` with a unit test, and import it from both places. That is a test-support move, not a gameplay change.

Create `app/src/game/simulation/runtime-bounds.soak.test.ts`. Through `session.ts`, for each Queen phase drilled and looped, advance 10 simulated minutes in fixed steps with a scripted moving input, then run 25 retries. Sample once per simulated second, and assert:

- live shards are at most the derived bound;
- bombs, enemies and condition entries are at most bounds derived the same way, or a recorded constant with its source;
- the `JSON.stringify(state).length` at minute 10 is at most 1.1 times its maximum over minutes 1-2;
- history length is at most `historyLimit`.

Report the peak of each measure in the test output.

**Focused checks**

`npm run test:soak:sim` passes. Record its runtime; it must stay under 5 minutes, or the drilled phases are sampled, not exhaustive, and the choice is recorded.

**Acceptance**

The soak passes, runs in CI, and is not part of `npm test`.

### Step 95.4 - Phase Gate

Status: complete (2026-11-17). Dependencies: 95.1-95.3.

**Implementation prompt**

Delegate one `npm run verify` run to the `verifier` subagent, and record its lines. Confirm with the verifier that the `test` gate no longer runs the soak file. The Playwright `@soak` tests are unchanged (A26), so do not run them. Update the Phase Index and archive this file.

**Focused checks**

None beyond the gate run.

**Acceptance**

All four gates pass. No production behaviour changed. The browser soaks are untouched.

## Execution Record

Implemented 2026-11-16 in auto mode.

- **95.1** `simulation.bench.ts`. Vitest 5 replaced the old `bench` import with a test-context `bench` function and has no `--outputJson`: results are written per benchmark with `writeResult` to `reports/bench/*.json`, and the script is `vitest bench --run --project "node (bench)"`. Local results (mean ms, p99 ms, samples): Queen densest drilled phase, 10 simulated seconds 6.087, 7.361, 165; minion encounter 8.982, 10.378, 112; `advanceShard` over the densest phase's peak shard count 0.0098, 0.0209, 101,632; `sweptConvexPartsOverlap` on the largest compound hitbox 0.0453, 0.0934, 22,062.
- **95.2** `scripts/bench-gate.mjs` (reads result directories) with eight tests, and the `bench` job in `pages.yml`. **Not done:** the three base-against-base CI measurements for `BENCH_REGRESSION_THRESHOLD` need CI runs I cannot make, so the constant is the plan's 20 percent floor, the job keeps `continue-on-error: true`, and the constant's comment says so.
- **95.3** `runtime-bounds.soak.test.ts` in its own `soak` project, `npm run test:soak:sim`, a `Simulated Soak` matrix entry. `npm test` now runs `--project node --project dom`, which keeps the soak out (the verifier found `vitest run` included it). The soak keeps the player alive by resetting health each step. Runtime 22 s; all eight phases for 10 simulated minutes plus 25 retries pass. The shard bound is `liveShardBoundForEncounter`, already exported from source, so nothing moved. Peaks (shards of 1,571): phase 1 9, 2 28, 3 80, 4 119, 5 47, 6 56, 7 63, 8 117.
- **95.2 update (2026-11-17)** The base-against-base variant is a separate manual workflow, `.github/workflows/bench-calibrate.yml` (`workflow_dispatch` only, so adding a trigger to `pages.yml` cannot reach its deploy job), kept as the documented way to remeasure. It benches one commit four times, alternating, and runs `scripts/bench-gate.mjs --calibrate`, which prints the table, the worst difference in either direction and the implied threshold (the larger of 0.20 and three times it) and exits 0. `calibration()` has two new tests, written first (ten pass); `action-validator` printed `ok` for the workflow. A local smoke pair gave a worst difference of 13.7 percent on `advance-shard` (implied 41.1 percent); that is not one of the three CI measurements. **Still open:** the three CI runs need a push, after which the threshold, its comment, `docs/quality-gates.md` and the removal of `continue-on-error: true` land in one change.
- **95.2 completed (2026-11-17)** After plan V22 merged to `main` (pull request 7), with the gate at five rounds a side, three manual `Benchmark Calibration` runs on `main` (Actions runs 44183948084, 44183953428 and 44183958126) measured a worst base-against-base difference of 0.5 percent (`minion-encounter`), 1.5 percent (`minion-encounter`) and 3.7 percent (`advance-shard`). Three times the worst, 11.1 percent, is under the 20 percent floor, so `BENCH_REGRESSION_THRESHOLD` stays 0.20, now as a measured value. `continue-on-error` is removed from the `bench` job, which is now blocking on pull requests.
- **95.4** `npm run verify`: lint PASS, typecheck PASS, test PASS (114 files before the `test` script change, 1,819 passed and 2 expected failures, 47.6 s), build PASS.

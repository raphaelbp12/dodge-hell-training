---
name: verify
description: "Run the Pages CI validation gates locally, in CI order. Use only when the user runs /verify, optionally with a gate name or 'browser <pattern>'."
argument-hint: "Optional: lint | typecheck | test | build | browser [pattern] (default: lint+typecheck+test+build)"
disable-model-invocation: true
---

<!-- Mirrors .github/workflows/pages.yml: same scripts, same order. Only deviation: the build skip below. -->

Delegate the run to the `verifier` subagent (Haiku, `.claude/agents/verifier.md`), passing the gate or browser pattern, and relay its report. The notes below describe what it runs. Reproduce the `Validate And Deploy Pages` workflow locally for the gate(s) the user named: `$ARGUMENTS` (if that reads as a literal placeholder, use the words the user typed after `/verify`; none means the default). Run everything from `app/`.

- **Default (no arguments):** `npm run verify`. It runs `lint`, `typecheck` and `test` (CI's independent, non-fail-fast checks matrix; all three always run), then `build` (CI's build job, which produces `app/dist`). It prints one `PASS`/`FAIL`/`SKIP` line per gate, adds a tail excerpt for each failure, writes full logs to `app/test-results/verification/<gate>.log`, and exits nonzero on any failure. Read a full log only when the excerpt is not enough.
- **Deliberate deviation:** CI runs build regardless of the checks, but `npm run verify` skips build when any check fails, because `build` repeats `tsc -b` and would only duplicate the failure. Report a skipped build as skipped, not passed.
- **Audit (CI only):** `npm run audit` (`npm audit --omit=dev --audit-level=high`) is the `Audit` entry of CI's checks matrix. It needs the network, so `npm run verify` does not run it; run it on request.
- **Simulated soak (CI checks matrix, `Simulated Soak`):** `npm run test:soak:sim` runs the Node soak in its own Vitest project; `npm run verify` and `npm test` skip it. Run it on request or after a change to the simulation or session.
- **Benchmarks (CI `bench` job, pull requests only):** `npm run bench` runs the Vitest benchmarks; the job alternates base and head runs on one runner and fails through `scripts/bench-gate.mjs`. Run it locally only after a change to the simulation's hot path. `.github/workflows/bench-calibrate.yml` is a manual-only base-against-base run that measures runner noise for the gate's threshold.
- **Mutation tests (`.github/workflows/mutation.yml`):** `npm run test:mutation` is the weekly full run and `npm run test:mutation:diff` is the informational pull-request run. Neither is part of `npm run verify`. They rewrite sources in place while they run, so edit nothing until they exit. Locally, only the `verifier` subagent runs the diff run; the full run is never started from an agent session (see `AGENTS.md`).
- **A single named gate:** run `npm run <gate>` directly.
- **`browser`** needs a successful build. Run it only to reproduce a CI-reported failure (full suite: `CI=true npm run test:e2e`) or to confirm newly authored or changed coverage (`CI=true npm run test:e2e -- --grep "<pattern>"`). Ask first if neither case clearly applies. `CI=true` includes the three 60-second `@soak` tests; without it they are skipped unless `PLAYWRIGHT_SOAK=1`. CI splits the suite into six parallel jobs: three shards of the main tests (`--grep-invert @soak --shard=<n>/3`) and one job per soak test (`--grep @soak --shard=<n>/3`). If Chromium is missing, run `npx playwright install --with-deps chromium`. Evidence lands in `app/test-results/`.
- **deploy** never runs locally.

CI pins Node from `.node-version` and npm 12.2.1, installing with `npm ci`. Only if a gate fails in a way that suggests a toolchain problem, check `node --version` and `npm --version` and report any mismatch.

Report which gates passed, failed, were skipped or were not run. Do not fix unrelated failures as part of this command.

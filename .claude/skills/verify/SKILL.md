---
name: verify
description: "Run the Pages CI validation gates locally, in CI order. Use only when the user runs /verify, optionally with a gate name or 'browser <pattern>'."
argument-hint: "Optional: lint | typecheck | test | build | browser [pattern] (default: lint+typecheck+test+build)"
disable-model-invocation: true
---

<!-- Mirrors .github/workflows/pages.yml: same scripts, same order. Only deviation: the build skip below. -->

Reproduce the `Validate And Deploy Pages` workflow locally for the gate(s) the user named: `$ARGUMENTS` (if that reads as a literal placeholder, use the words the user typed after `/verify`; none means the default). Run everything from `app/`.

- **Default (no arguments):** `npm run verify`. It runs `lint`, `typecheck` and `test` (CI's independent, non-fail-fast checks matrix; all three always run), then `build` (CI's build job, which produces `app/dist`). It prints one `PASS`/`FAIL`/`SKIP` line per gate, adds a tail excerpt for each failure, writes full logs to `app/test-results/verification/<gate>.log`, and exits nonzero on any failure. Read a full log only when the excerpt is not enough.
- **Deliberate deviation:** CI runs build regardless of the checks, but `npm run verify` skips build when any check fails, because `build` repeats `tsc -b` and would only duplicate the failure. Report a skipped build as skipped, not passed.
- **A single named gate:** run `npm run <gate>` directly.
- **`browser`** needs a successful build. Run it only to reproduce a CI-reported failure (full suite: `CI=true npm run test:e2e`) or to confirm newly authored or changed coverage (`CI=true npm run test:e2e -- --grep "<pattern>"`). Ask first if neither case clearly applies. If Chromium is missing, run `npx playwright install --with-deps chromium`. Evidence lands in `app/test-results/`.
- **deploy** never runs locally.

CI pins Node from `.node-version` and npm 12.2.1, installing with `npm ci`. Only if a gate fails in a way that suggests a toolchain problem, check `node --version` and `npm --version` and report any mismatch.

Report which gates passed, failed, were skipped or were not run. Do not fix unrelated failures as part of this command.

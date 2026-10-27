---
description: "Run the same validation gates as the Pages CI workflow, locally and in CI order."
argument-hint: "Optional: lint | typecheck | test | build | browser [pattern] (default: lint+typecheck+test+build)"
---

<!-- Mirror of .github/workflows/pages.yml. Keep both in sync: same scripts, same order, same gating. -->

Reproduce the `Validate And Deploy Pages` workflow locally for the gate(s) named in `$ARGUMENTS`. Run everything from `app/`.

**Default scope.** With no arguments, run `lint`, `typecheck`, `test`, and `build` only - not `browser`. CI already runs the full Playwright suite on every push, so re-running it locally as routine verification of an unrelated change duplicates that work for no benefit. Run `browser` only in one of these two cases:

- **Reproducing a pipeline-reported failure.** Run the full suite (no pattern) to reproduce what CI saw.
- **Confirming newly authored or changed coverage.** Pass a pattern to scope the run to just those test(s), for example `/verify browser "renders readable nonblank arena"`. This maps to `npm run test:e2e -- --grep "<pattern>"`.

Do not run the unscoped full `browser` gate as routine verification of an unrelated change; use the four gates above for that, and ask before running the full suite if it is unclear which case applies.

Environment the workflow pins — report a mismatch instead of silently continuing:

- Node from `.node-version` (currently 24.22.1)
- npm 12.2.1 (`packageManager` in `app/package.json`)
- Install with `npm ci`, never `npm install`, so `app/package-lock.json` is preserved.

Gates, in workflow order:

1. **checks** — independent, non-fail-fast matrix. Run all three and report each separately even when an earlier one fails:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
2. **build** — `npm run build`. Produces `app/dist`, which the browser gate consumes.
3. **browser** — needs a successful build, and runs only per the scope rule above. Full run: `CI=true npm run test:e2e` against the production build in `app/dist`. Scoped run: `CI=true npm run test:e2e -- --grep "<pattern>"`. If Chromium is missing, run `npx playwright install --with-deps chromium` first. Evidence lands in `app/test-results/`; mention it when a test fails.
4. **deploy** — never run locally. In CI it only runs on a push to `main` after `checks` and `browser` pass. Do not deploy, and do not claim a live deployment without authorization and evidence.

Report the actual command output per gate: which passed, which failed, and which you did not run. Do not fix unrelated failures as part of this command.

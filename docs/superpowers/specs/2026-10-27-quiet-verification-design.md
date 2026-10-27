# Quiet Verification Script Design

## Intent

Reduce tool-call and console-output overhead during local development while preserving the repository's existing validation gates and honest failure reporting.

## Goals

- Provide `npm run verify` from `app/` using a committed, dependency-free Node script.
- Run `lint`, `typecheck`, and `test` in workflow order, continuing through all three even when one fails.
- Run `build` only when all three checks pass.
- Write complete output to ignored files under `app/test-results/verification/`.
- Print one concise line per successful gate; print a useful failure excerpt and the full-log path on failure.
- Exit nonzero when any gate fails and report gates not run.

## Non-goals

- No Playwright/browser gate, deployment, dependency installation, or new runtime application feature.
- No suppression of failure details, retries, parallelism, or changes to existing gate commands.
- No new shell framework or third-party package.

## Approaches

- **Chosen: Node (`app/scripts/verify.mjs`).** Cross-platform through the project's pinned Node runtime; works from PowerShell, Git Bash, and CI without extra dependencies.
- PowerShell: concise on the current Windows machine but not portable to Linux CI.
- Bash: portable across Unix/Git Bash but less convenient from native Windows PowerShell.

## Implementation Shape

Add `app/scripts/verify.mjs` and the `verify` package script. The runner uses the platform-appropriate npm executable, captures each gate's combined stdout/stderr into `lint.log`, `typecheck.log`, `test.log`, and `build.log`, and bounds only the console failure excerpt (the complete log remains available). It returns a failing exit status if any executed gate fails.

## Verification

Use focused script checks for successful execution, independent failure handling, build skipping, concise output, log creation, and exit statuses, followed by a real successful `npm run verify` run. Existing application tests and gameplay files remain unchanged.

# Quiet Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a dependency-free `npm run verify` command that runs the existing gates quietly while preserving complete logs and reliable failures.

**Architecture:** One Node CLI script spawns the platform-appropriate npm executable synchronously, redirects each gate's stdout/stderr to an ignored log, and prints only status lines on success or a bounded excerpt on failure. A Node built-in test suite exercises the CLI through a fake npm executable, with no application-runtime dependency.

**Tech Stack:** Node 24.22.1 built-ins (`node:child_process`, `node:fs`, `node:path`, `node:test`), npm 12.2.1.

**Spec:** `docs/superpowers/specs/2026-10-27-quiet-verification-design.md`

## Global Constraints

- Run from `app/`; no new dependencies, browser gate, deployment, or gameplay changes.
- Preserve gate order: lint, typecheck, test; build only if all three pass.
- Store complete logs under ignored `app/test-results/verification/`.
- Do not commit or push without separate authorization.

## Review Focus

- Any failed preliminary gate: later preliminary gates still run, build is skipped, and the exit is nonzero.
- Missing npm executable: record a useful failure rather than hanging or reporting success.
- Large gate output: complete log survives while console failure output remains bounded.
- Paths containing spaces: npm, working-directory, and log paths still work.
- Successful gates: all four run in order, concise status is printed, and each log exists.

---

### Task 1: Add And Verify The Quiet Gate Runner

**Files:**
- Create: `app/scripts/verify.mjs`
- Create: `app/scripts/verify.test.mjs`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: existing npm scripts `lint`, `typecheck`, `test`, and `build`.
- Produces: `npm run verify`; runtime logs `app/test-results/verification/<gate>.log`.

- [x] **Step 1: Write failing CLI tests**

Create `app/scripts/verify.test.mjs` using `node:test` and `node:assert/strict`. Each test copies the current `verify.mjs` into a temporary `app/scripts` directory whose path contains a space, prepends a fake npm executable to `PATH`, and runs the copy with `process.execPath`. The fake npm records its arguments, emits configurable output, and fails only the gate named by the test environment.

Tests and required assertions:
- `runs all gates quietly and writes complete logs`: exit 0; calls equal `run lint`, `run typecheck`, `run test`, `run build`; stdout has one `PASS` line per gate; every gate log contains its fake output.
- `continues preliminary failures and skips build` (parameterize lint, typecheck, and test): nonzero exit; all three preliminary calls occur; no build call; failed gate prints `FAIL`; stdout reports `SKIP build`.
- `bounds failure excerpts without truncating logs`: fake a failing gate with 200 output lines; stderr contains the failure and final line but not the first line; the log contains all 200 lines.
- `reports a missing npm executable`: use a PATH with no npm; nonzero exit, a useful `FAIL` and spawn error, later preliminary checks attempted, build skipped.

- [x] **Step 2: Run the tests to verify RED**

Run: `node --test scripts/verify.test.mjs` from `app/`.
Expected: FAIL because `scripts/verify.mjs` does not exist.

- [x] **Step 3: Implement `app/scripts/verify.mjs`**

Use only Node built-ins. Resolve the app root from `import.meta.url`, choose `npm.cmd` on Windows and `npm` elsewhere, and create the log directory recursively. For each gate, spawn npm with `run <gate>`, `cwd` set to the app root, and one writable file descriptor assigned to both stdout and stderr so output is complete without an in-memory buffer. Close the descriptor, append any spawn error to the log, and treat a nonzero/null status or spawn error as failure. Print `PASS <gate>` or `FAIL <gate>` with the relative log path. On failure, print at most the final 80 log lines. Always attempt lint/typecheck/test; run build only when all three pass, otherwise print `SKIP build`; set `process.exitCode` accordingly.

- [x] **Step 4: Run the tests to verify GREEN**

Run: `node --test scripts/verify.test.mjs` from `app/`.
Expected: all tests PASS with concise output and no application test involvement.

- [x] **Step 5: Add the package command**

Add `"verify": "node scripts/verify.mjs"` to `app/package.json` without changing dependencies or the lockfile.

- [x] **Step 6: Run real verification**

Run with the pinned toolchain from `app/`: `fnm exec --using=24.22.1 npm.cmd run verify` (use `npm run verify` outside this Windows/fnm environment).
Expected: exit 0; concise PASS lines for lint, typecheck, test, and build; complete logs under `app/test-results/verification/`; existing bundle-size warning remains only in `build.log`, not the console.

- [x] **Step 7: Inspect the final diff**

Run: `git status --short` and a targeted diff of the three owned files.
Expected: only the script, its tests, package command, and pre-existing unrelated worktree changes are present; no generated logs are tracked. Do not commit.

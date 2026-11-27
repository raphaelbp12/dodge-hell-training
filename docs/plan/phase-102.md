# Phase 102: Per-Worktree Dev Server

> Step prompts and execution records for phase 102 of [plan v25](../plan-v25.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 102.`

### Step 102.1 - Free-Port Helper And `dev:worktree`

Status: pending. Dependencies: none.

**Implementation prompt**

Create `app/scripts/free-port.mjs`, exporting an async function that returns a free TCP port by listening on port 0 and closing the server (D-25-3). Create `app/scripts/dev-worktree.mjs`: get a free port, start Vite (`node_modules/vite/bin/vite.js --host 0.0.0.0 --port <port> --strictPort`) with the app directory as its working directory, write the port to `app/.dev-port` (D-25-6), print the URL with the Vite `base` from `vite.config.ts`, and delete `.dev-port` when the process exits or is signalled. Add `"dev:worktree": "node scripts/dev-worktree.mjs"` to `app/package.json` (D-25-4) and `.dev-port` to `app/.gitignore`. Do not touch the `dev` script, run no `npm ci` (D-25-8), add no Multica environment entry (D-25-7). The script must start with no argument or prompt (D-25-1).

**Focused checks:** a failing-first test file `app/scripts/free-port.test.mjs` covering: the returned port is a valid unused port; two calls while the first port is still held return different ports. A test of the port-file logic (written, then removed on exit) with Vite replaced by a stub.

**Acceptance:** the focused tests pass; `npx tsc -b` and lint pass; two worktrees run `npm run dev:worktree` at once on different ports and each URL serves the page; `npm run dev` still binds 5173 unchanged.

### Step 102.2 - Random Playwright Ports

Status: pending. Dependencies: 102.1.

**Implementation prompt**

In `app/playwright.config.ts`, replace the constants `testPort` and `previewPort` (4173, 4174) with free ports from the helper (D-25-5). The config is evaluated again in each worker, so choose the ports once in the parent process, store them in environment variables, and have every later evaluation read them. Keep the `--strictPort` flags, `reuseExistingServer: false` and the `PLAYWRIGHT_LIVE_URL` path unchanged. Confirm no spec, workflow or document hard-codes 4173 or 4174 and update any that does, reading the value from the config.

**Focused checks:** a unit test of the parent/worker port-sharing logic (first call draws, later calls read the environment). One Playwright test run alone with `--grep` passes.

**Acceptance:** two worktrees run `CI=true npm run test:e2e -- --grep "<one test>"` at the same time without a port clash; the `verifier` ran the full non-soak suite before the branch is pushed; `npm run verify` passes.

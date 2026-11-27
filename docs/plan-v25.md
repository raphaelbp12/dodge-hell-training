# Plan V25: Per-Worktree Dev Server

Phase 102. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work. This file is the authority for what phase 102 builds and why. It is not authorization to implement the phase by itself.

`npm run dev` binds the fixed port 5173 with `--strictPort`, and the Playwright config binds the fixed ports 4173 and 4174. A second worktree on the same VM therefore cannot start a server, so a change in a worktree cannot be tried in a browser while another is running. This plan adds a script that serves the app on a random free port, tells the agent or user the URL, and makes the Playwright ports random as well.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved approach for phase 102. Later explicit user decisions override older statements; record changes here.
- The user's issue text (SAFE-12, 2026-11-27): the need to test code in a worktree in the VM, one server per worktree, a randomized port.
- The user's answers of 2026-11-27 to the `/brainstorm` questions 1-8, recorded below as D-25-1 to D-25-8.

## Completed Baseline

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V24](plan-v24.md) | 101 | Camera rotation (drafted) |

## Confirmed Design

Carried forward unchanged: every gameplay rule, the simulation, the rules fingerprint and every `rulesVersion`; the one-way boundaries; `npm run dev` and its port 5173; the devcontainer's forwarded port.

This plan adds, as a delta:

- **A `dev:worktree` script** that serves the app on a random free port and prints the URL (D-25-3, D-25-4, D-25-6).
- **Random Playwright ports** for the test server and the preview server (D-25-5).
- **No change to any game file, data file, rule or the simulation.**

## Recorded User Decisions - 2026-11-27

- **D-25-1. Reaching the server.** The solution must need no extra steps from the user: an agent runs one script and the page is served. No tunnel or forwarding procedure is documented or built. (Question 1; the user's own words: "any solution that don't need extra steps ... something that the agent can run over a script to serve the page".) The server binds `0.0.0.0`, as `dev` does.
- **D-25-2. No port range.** The VM firewall is not a constraint; any port may be chosen. (Question 2a.)
- **D-25-3. Random port.** A free port is chosen at random on each start; the URL changes every run. No hash-derived stable port. (Question 3a.)
- **D-25-4. New script.** `npm run dev:worktree` is added; `npm run dev` stays as it is. (Question 4a.)
- **D-25-5. E2E ports too.** The Playwright test-server and preview-server ports (now 4173 and 4174) are chosen at random as well, so end-to-end runs can proceed in parallel across worktrees. (Question 5b.)
- **D-25-6. Port file.** The chosen port is printed by the server and also written to a file in the worktree, `app/.dev-port`, which is git-ignored. (Question 6b.)
- **D-25-7. No Multica environment.** No `.multica/environments.toml` entry; the npm script only. (Question 7a.)
- **D-25-8. Dependencies assumed.** The script does not run `npm ci`; `app/node_modules` must already exist. (Question 8a.)

## Architecture

- A script `app/scripts/dev-worktree.mjs` finds a free port by asking the OS for one (listening on port 0), starts Vite with `--host 0.0.0.0 --port <port> --strictPort`, writes the port to `app/.dev-port` and prints the URL including the Vite `base`. It removes the file on exit.
- A small shared helper (`app/scripts/free-port.mjs`) returns a free port; the dev script and the Playwright config both use it.
- `app/playwright.config.ts` takes its two ports from the helper instead of constants. The config is loaded again in every worker process, so the ports are chosen once in the parent process and handed on through environment variables; a worker reads them rather than drawing new ones.
- `app/package.json` gains `"dev:worktree": "node scripts/dev-worktree.mjs"`. `app/.gitignore` gains `.dev-port`.

## Target Data Shapes

- `app/.dev-port`: one line, the decimal port number.
- Environment variables carrying the Playwright ports between the parent and its workers (names chosen in step 102.2 and recorded in its execution record).

## Approved Scope And Review Gates

In scope: D-25-1 to D-25-8 only.

Out of scope: any change to `npm run dev`; the devcontainer's port forwarding; a stable per-worktree port; a port range setting; tunnel or SSH procedures; a Multica environment entry; installing dependencies; any game, data, rules or simulation change; every deferred-register entry.

Review gates:

- No data file, `rulesVersion`, fingerprint or simulation file changes; existing tests pass unchanged.
- Each step's focused test runs alone with `npx vitest run <path>`; `npx tsc -b` passes.
- `npm run verify` from `app/` at the end of the phase, by the `verifier` subagent.
- The full non-soak Playwright suite, run by the `verifier` before the branch is pushed, passes with the random ports (`playwright.config.ts` changes).
- A browser spec that reads a port or URL gets it from the config, never a literal (AGENTS.md).
- Stryker mutate globs do not cover `app/scripts/`; confirm before skipping the mutation diff.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 102 | Per-Worktree Dev Server | complete | None |

## Phase 102: Per-Worktree Dev Server

[Step prompts](plan/phase-102.md).

- 102.1 - Free-Port Helper And `dev:worktree`: complete. Dependencies: none.
- 102.2 - Random Playwright Ports: complete. Dependencies: 102.1.

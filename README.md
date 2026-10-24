# Dodge Hell Training

A pure-frontend bullet-hell practice game targeting repeated survival training against the Crystal Worm Child Head from Realm of the Mad God.

## Current State

Step 2.2 is complete: `app/` contains the command-generated React + TypeScript + Vite starter, Phaser dependency, and unit/browser testing tools. It still displays the Vite starter screen and counter, not a playable encounter. Game logic, Phaser integration, and GitHub Pages deployment belong to later plan steps.

## Prerequisites

- Use Node.js 24.22.1 LTS and npm 12.2.1. The root [.node-version](.node-version) selects the exact Node version; app package metadata records npm and supported Node/npm ranges.
- Node 24 is LTS; Node 26 is still Current as of 2026-10-24. See [Node release status](https://nodejs.org/en/about/previous-releases). The selected runtime satisfies the [Vite requirements](https://vite.dev/guide/) and npm 12's engine requirements.
- Keep `app/package-lock.json` in version control. Use `npm ci` for an existing checkout; use npm commands to change dependencies.

## Windows Toolchain Setup

fnm 1.39.0 was installed as a per-user portable package. The existing system Node installation was left untouched, and no PowerShell profile was modified. Install fnm if needed:

```powershell
winget install --id Schniz.fnm --exact --source winget --scope user --accept-source-agreements --accept-package-agreements --disable-interactivity
```

After installation, restart VS Code so it inherits the updated user PATH. From the repository root, initialize fnm for the current PowerShell session and install/select the pinned Node version:

```powershell
fnm env --shell powershell | Out-String | Invoke-Expression
fnm install (Get-Content .node-version)
fnm use
```

Node 24.22.1 bundles npm 11.19.1. Upgrade npm inside the selected fnm-managed installation, not inside the system Node installation:

```powershell
$managedNodeDirectory = Split-Path (Get-Command node.exe).Source
if ($managedNodeDirectory -notlike '*fnm*') { throw 'Select fnm-managed Node before upgrading npm.' }
npm install --global --prefix $managedNodeDirectory npm@12.2.1
node --version
npm --version
```

Expected versions: `v24.22.1` and `12.2.1`. In each new terminal, initialize fnm and run `fnm use` from the repository root before working in `app/`. Profile integration is optional and has not been enabled automatically. Do not uninstall or replace the system Node installation merely to use this project.

## Current Toolchain

Updated and validated on 2026-10-24:

| Tool | Current version |
| --- | --- |
| fnm | 1.39.0 |
| Node.js / npm | 24.22.1 / 12.2.1 |
| React / React DOM | 19.3.1 / 19.3.1 |
| TypeScript | 7.0.2 |
| Node type definitions | 24.19.2; intentionally aligned to Node 24 rather than latest major 26 |
| Vite / React plugin | 8.3.5 / 6.1.2 |
| Oxlint | 1.89.0 |
| Phaser | 4.2.1; installed, not integrated yet |
| Vitest / jsdom | 5.0.5 / 30.1.3 |
| React Testing Library / jest-dom / user-event | 16.3.3 / 7.0.1 / 14.6.8 |
| Playwright Test / create-playwright | 1.64.1 / 1.17.139 |

TypeScript was upgraded through npm; other compatible packages were refreshed and were already current within their supported ranges. A clean `npm ci`, lint, and the TypeScript/production build pass with this toolchain. The original bootstrap record below is historical, not the current runtime requirement.

The project's Chromium smoke test now verifies the starter heading, a normal mouse click updating its counter, all starter images, and absence of uncaught page errors. This supersedes step 2.1's limited editor-browser automation check; no application component was changed to accommodate automation.

## Local Development

After selecting the pinned toolchain above, from the repository root:

```powershell
cd app
npm ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

On Windows, stop this project's dev/test servers before running `npm ci`: a loaded Vite native module can otherwise cause an `EPERM` file-lock error. Retry after stopping the server; elevation is not the remedy for that lock.

Open the URL printed by Vite, normally http://127.0.0.1:5173/. If that port is occupied, Vite chooses another available port. The server is local-only with this command. Stop it with Ctrl+C in its terminal.

In Windows PowerShell 5.1, use `npm.cmd` when forwarding flags after `--`: npm 12's PowerShell entry point did not preserve the separator in the checked environment. On other platforms, use `npm` instead of `npm.cmd`.

## Validation And Build

Run these from `app/`:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The generated lint script uses Oxlint. Typecheck uses the generated TypeScript project references (`tsc -b`), including test/tooling files. The build script runs that same check followed by the Vite production build, producing ignored output in `app/dist/`. All five commands passed on 2026-10-24 (two Vitest tests and one Chromium smoke test).

Use `npm run test:watch` during development. Vitest runs `src/**/*.test.ts` in Node without DOM setup; reserve that convention for pure models, configuration, simulation, and adapters. React tests use `src/**/*.test.tsx` in jsdom with jest-dom matchers and automatic cleanup. Only CSS Modules are processed in jsdom; a test-only stylesheet verifies scoped class names and computed styles. Full page styles run in Chromium, not jsdom.

Install the required browser on each new machine or after a Playwright browser-version upgrade, from `app/`:

```powershell
npx.cmd playwright install chromium
```

On other platforms, use `npx` instead of `npx.cmd`; Linux may also need Playwright's [browser system dependencies](https://playwright.dev/docs/browsers#install-system-dependencies). Browser binaries are cached outside the repository. `npm ci` alone does not install them.

Playwright starts the local Vite CLI from `app/` using the current Node executable at http://127.0.0.1:4173/. Keep that test port free: `reuseExistingServer: false` and Vite's `--strictPort` intentionally reject an occupied port instead of testing an unrelated server. The runner stops its own server afterward. Tests never navigate to external websites; traces on failure live in ignored `app/test-results/`. No CI workflow is introduced in this step.

To serve the production build locally, run:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

Use the URL printed by the preview command. Preview also defaults to port 4173, so stop it before running browser tests.

## Bootstrap Record

Generated on 2026-10-24 from the repository root using the official CLI, without hand-writing bootstrap files:

```powershell
npm --yes create vite@latest app -- --template react-ts --no-interactive
npm --prefix app install
npm --prefix app run lint
npm --prefix app run build
```

`--yes` accepts npm's generator-package installation; `--no-interactive` selects noninteractive scaffolding. Do not rerun the generator over the existing app. No nested Git repository was created.

| Tool | Original bootstrap version |
| --- | --- |
| Node.js / npm | 22.20.0 / 11.7.0 |
| create-vite | 9.3.1 |
| React / React DOM | 19.3.1 / 19.3.1 |
| TypeScript | 6.0.3 |
| Vite / React plugin | 8.3.5 / 6.1.2 |
| Oxlint | 1.89.0 |

The lockfile records installed dependency versions. The initial installation reported zero vulnerabilities; that result is specific to the installation date and is not a continuing security guarantee.

## Project Documents

- [Implementation plan](implementation-plan.md): phased prompts, dependencies, acceptance criteria, and execution records. Next: step 3.1.
- [Mechanics contract](docs/mechanics.md): sourced rules, delegated decisions, and explicit fidelity limitations.
- [Original draft](first-draft.md): initial design intent.
- [Generated template notes](app/README.md): upstream starter documentation, retained unchanged.

Implement one step at a time with `/implement-step <step-id>`. Completing a step does not automatically authorize later steps, a commit, or a push.
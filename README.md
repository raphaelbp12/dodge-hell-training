# Dodge Hell Training

A pure-frontend bullet-hell practice game targeting repeated survival training against the Crystal Worm Child Head from Realm of the Mad God.

## Current State

Step 2.1 is complete: `app/` contains the command-generated React + TypeScript + Vite starter. It still displays the Vite starter screen and counter, not a playable encounter. Game logic, Phaser integration, test tooling, and GitHub Pages deployment belong to later plan steps.

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

TypeScript was upgraded through npm; other compatible packages were refreshed and were already current within their supported ranges. A clean `npm ci`, lint, and the TypeScript/production build pass with this toolchain. The original bootstrap record below is historical, not the current runtime requirement.

The restarted development server rendered the starter and all images, and a DOM click event verified the React counter update. The editor browser's normal mouse-actionability checks timed out, so they are not reported as passing. Manually check the counter with a mouse when reviewing the page; no application code was changed to accommodate the automation.

## Local Development

After selecting the pinned toolchain above, from the repository root:

```powershell
cd app
npm ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Open the URL printed by Vite, normally http://127.0.0.1:5173/. If that port is occupied, Vite chooses another available port. The server is local-only with this command. Stop it with Ctrl+C in its terminal.

In Windows PowerShell 5.1, use `npm.cmd` when forwarding flags after `--`: npm 12's PowerShell entry point did not preserve the separator in the checked environment. On other platforms, use `npm` instead of `npm.cmd`.

## Validation And Build

Run these from `app/`:

```powershell
npm run lint
npm run build
```

The generated lint script uses Oxlint. The build script runs TypeScript project checking (`tsc -b`) followed by the Vite production build, producing ignored output in `app/dist/`.

To serve the production build locally, run:

```powershell
npm.cmd run preview -- --host 127.0.0.1
```

Use the URL printed by the preview command. Unit/browser test scripts and a standalone typecheck script do not exist yet; step 2.2 will add them. The browser check in step 2.1 was performed through the editor's browser tools, not through a committed test suite.

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

- [Implementation plan](implementation-plan.md): phased prompts, dependencies, acceptance criteria, and execution records. Next: step 2.2.
- [Mechanics contract](docs/mechanics.md): sourced rules, delegated decisions, and explicit fidelity limitations.
- [Original draft](first-draft.md): initial design intent.
- [Generated template notes](app/README.md): upstream starter documentation, retained unchanged.

Implement one step at a time with `/implement-step <step-id>`. Completing a step does not automatically authorize later steps, a commit, or a push.
# Plan V12: The Dev Container

Phase 42. [The implementation plan](../implementation-plan.md) is the reusable process and the authority for how to work; this file is the authority for what phase 42 builds and why. It is not authorization to implement a phase by itself.

Phase 42 moves all development of this project into a VS Code dev container that runs identically on Windows, Linux and macOS. The container builds the pinned Node toolchain, runs the dev server, `npm run verify` and the Playwright suite, and ships Claude Code with auto-update enabled and GitHub CLI ready for a one-time device login. No game code, test, authored value or gameplay rule changes.

## Sources And Decision Authority

- [The implementation plan](../implementation-plan.md): the reusable process.
- This file: the decisions and approved technical approach for phase 42. Later explicit user decisions override older statements; record changes here.
- [Plan V11](plan-v11.md): its completed phase 41 and every earlier confirmed design stand. Nothing in this plan reopens a gameplay decision.
- [The project instructions](../AGENTS.md): ownership, scope, test discipline and verification.
- [The deferred register](deferred-work.md): no deferred item is promoted, and none collides with this plan.
- [`.node-version`](../.node-version): the exact Node pin, `24.22.1`.
- [`app/package.json`](../app/package.json): `npm@12.2.1`, the `dev`, `verify` and `test:e2e` scripts, and the Playwright and Vite versions.
- [`app/vite.config.ts`](../app/vite.config.ts): the base path `/dodge-hell-training/`, which the container URL must keep.
- [`app/playwright.config.ts`](../app/playwright.config.ts): headless Chromium, the preview server on 4174 and the dev server on 4173.
- [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): the CI baseline this container must match - Ubuntu 24.04, Node 24.22.1, npm 12.2.1, and `npx playwright install --with-deps chromium`.
- Anthropic, retrieved 2026-11-05:
  - [Development containers](https://code.claude.com/docs/en/devcontainer) - the feature, the `~/.claude` volume with `CLAUDE_CONFIG_DIR`, the headless sign-in flow, and the reference firewall.
  - [Authentication](https://code.claude.com/docs/en/authentication) - Linux credentials live in `~/.claude/.credentials.json` with mode `0600`.
  - [Network access requirements](https://code.claude.com/docs/en/network-config) - the required hosts, including `claude.ai`, `claude.com`, `platform.claude.com`, `downloads.claude.ai` and `registry.npmjs.org`.
  - [The Claude Code dev container feature](https://github.com/anthropics/devcontainer-features/tree/main/src/claude-code) - `ghcr.io/anthropics/devcontainer-features/claude-code` installs the latest CLI through npm, enables auto-update and adds the `anthropic.claude-code` VS Code extension.
  - [The reference firewall](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh) - the default-deny script, its `NET_ADMIN`/`NET_RAW` requirement and its IP-based allowlist.
- Docker Hub, retrieved 2026-11-05: the `library/node:24.22.1-bookworm` tag exists for `amd64` and `arm64`, so the image is multi-arch.

## Completed Baseline

Phases 1-41 are complete. The deployed runtime is the V11 release: the V10 world scale and Nest room, plus the player body follow-up recorded at the end of plan V11. Development currently runs on the host with Node 24.22.1 and npm 12.2.1.

| Plan | Phases | Contents |
| ---- | ------ | -------- |
| [V8 archive](plan-v8.md) | 33-35 | Measured-cadence pilot: the video tagger and the phase-3 measurement |
| [V9 archive](plan-v9.md) | 36 | Phase-3 cadence retune from tagged video evidence |
| [V10](plan-v10.md) | 37-40 | World-scale re-anchor, octagonal boss room, Killer Honey, centre spawn |
| [V11](plan-v11.md) | 41 | The player's true body, plus its recorded follow-up |

The situation this plan addresses:

- There is no `.devcontainer/` today. Nothing in the repository pins a development OS, a Chromium build or an agent toolchain.
- `npm run dev` runs plain `vite`, which binds localhost inside a container and is unreachable from the host browser.
- `node_modules` would otherwise live on the host's bind mount, which is slow on Windows and inconsistent across Windows, Linux and macOS.
- Claude Code and GitHub CLI have no persisted state inside a container, so a rebuild would discard both logins.

## Approaches Considered

- **Base the container on `mcr.microsoft.com/playwright:v1.64.1-noble`.** Rejected: it preinstalls browser libraries but its Node version moves with Playwright releases, so the exact `24.22.1` and `12.2.1` pins would have to be layered on and would still drift with the image.
- **Add a Docker Compose file and start the environment from a terminal.** Rejected: VS Code builds a dev container directly, and Compose would add a second launch path with no user.
- **Mount the host's `~/.claude`, `.gitconfig` or `~/.ssh` into the container.** Rejected by the cross-platform requirement. A Windows, Linux and macOS host each has a different path, and the mount would couple the container to host state and secrets.
- **Pin Claude Code in the Dockerfile with `DISABLE_AUTOUPDATER=1`.** Rejected by the user in favour of the official feature's auto-update and its VS Code extension.
- **Keep `node_modules` inside the bind-mounted repository.** Rejected: tens of thousands of files on a Windows bind mount make `npm ci`, Vite and Playwright noticeably slower.
- **Keep `npm run dev` localhost-only and add a second `dev:container` script.** Rejected: the container is the only place the project is expected to run, so a second entry point would never be used.
- **Run without an egress firewall.** Rejected by the user in favour of the reference allowlist, because the container is trusted with Claude Code and repository write access.
- **Chosen shape: one pinned Node image, the official Claude Code feature, named volumes for all mutable state, a forwarded Vite port, and a fail-closed allowlist firewall.**

## Confirmed Design

The V11 confirmed design stands in every respect. This plan adds infrastructure only and changes no game code.

Phase 42 adds exactly these elements, and nothing else:

- **One dev container**, built from `.devcontainer/Dockerfile` on `node:24.22.1-bookworm` with npm pinned to `12.2.1`, running as the existing non-root `node` user. It is the only development environment for the project; a host Node install is no longer supported.
- **The full workflow inside the container**: `npm run dev`, `npm run verify` (lint, typecheck, unit test, build) and `npm run test:e2e` with headless Chromium.
- **Playwright Chromium installed at image build time**, at the version resolved by `app/package-lock.json` (`@playwright/test` `1.64.1`), with its Debian libraries. Browsers live in the shared image path `/ms-playwright`.
- **Claude Code through the official feature** `ghcr.io/anthropics/devcontainer-features/claude-code:1.0`. The feature installs the latest CLI through npm, is left to auto-update, and adds the `anthropic.claude-code` VS Code extension. The CLI version is deliberately not pinned; Node and npm are.
- **Claude state in a named volume** at `/home/node/.claude`, with `CLAUDE_CONFIG_DIR` pointing there. The OAuth login, credentials, settings and session history survive rebuilds. Sign-in is the container flow: `claude` prints a URL, the browser on the host approves it, and the code is pasted back into the container terminal.
- **`node_modules` in a named volume** at `/workspaces/<repository>/app/node_modules`, populated once by `npm --prefix app ci` in `postCreateCommand`. It is not visible on the host.
- **Git and GitHub state in a named volume** at `/home/node/.config`, with `GIT_CONFIG_GLOBAL=/home/node/.config/git/config`. GitHub CLI is installed in the image; one `gh auth login` device flow persists across rebuilds and covers HTTPS pushes through `gh auth setup-git`. Git identity is set once with `git config --global`.
- **No host bind mount except VS Code's automatic workspace mount.** No `${localEnv:HOME}`, `${localEnv:USERPROFILE}` or host path appears in any container file.
- **`npm run dev` binds `0.0.0.0:5173` with `strictPort`**, and VS Code forwards 5173. The URL stays `http://localhost:5173/dodge-hell-training/`.
- **A fail-closed egress firewall**, copied from Anthropic's reference script, extended with the Claude sign-in and update hosts, and started on every container start before the terminal is available. It requires `NET_ADMIN` and `NET_RAW`, and a standard rootful Docker engine.
- **Volume names scoped with `${devcontainerId}`**, so two repositories on the same host never share Claude trust, GitHub credentials or `node_modules`.
- **A short `.devcontainer/README.md`** with the first-open steps, the URL, both one-time logins, the rebuild-versus-reset distinction and the firewall's allowlist rule.
- **A root `.dockerignore`** so the build context excludes `node_modules`, `.git`, build output and local reference images.

Nothing else is added. In particular: no application source, test, authored data, game rule, arena, projectile or tuning value changes; no CI workflow change; no Docker Compose file; no host development path; no pinned Claude Code version; no host secrets mounted; and no second Vite config.

## Pinned Values

| Value | Pin | Source |
| ----- | --- | ------ |
| Host Node | `24.22.1` | [`.node-version`](../.node-version) |
| npm | `12.2.1` | `app/package.json`, CI |
| Base image | `node:24.22.1-bookworm` | Docker Hub, multi-arch |
| Playwright | `1.64.1`, from the lockfile | `app/package.json`, `app/package-lock.json` |
| Claude Code feature | `ghcr.io/anthropics/devcontainer-features/claude-code:1.0` | Anthropic feature README |
| Claude Code CLI | unpinned, auto-updating | plan decision Y03 |
| Dev port | `5173`, `strictPort` | Vite default, now explicit |
| Base path | `/dodge-hell-training/` | `app/vite.config.ts` |

## Recorded User Decisions - 2026-11-05

- **Y01 - Use the pinned Node image.** `node:24.22.1-bookworm` is the base, npm is pinned to `12.2.1`, and Playwright's Chromium and Debian libraries are installed in the Dockerfile. The Playwright base image is not used.
- **Y02 - The container runs the whole workflow.** The dev server, `npm run verify` and `npm run test:e2e` all run inside it, and development on the host is no longer supported.
- **Y03 - Claude Code is installed by Anthropic's dev container feature.** The feature installs the latest CLI, auto-update stays enabled, and the feature's VS Code extension is included. The CLI is intentionally not pinned.
- **Y04 - Claude state is a named volume.** `/home/node/.claude` is a volume and `CLAUDE_CONFIG_DIR` points at it, so one OAuth sign-in per host survives rebuilds.
- **Y05 - `node_modules` is a named volume.** `npm ci` populates it once on container creation, and the host never sees it.
- **Y06 - The dev server binds the container network.** `npm run dev` becomes `vite --host 0.0.0.0 --port 5173 --strictPort`, and VS Code forwards 5173.
- **Y07 - GitHub CLI and git state persist without host binds.** `gh` is installed in the image, `/home/node/.config` is a volume, `GIT_CONFIG_GLOBAL` points inside it, and the user signs in and sets identity once per host.
- **Y08 - The container is fully cross-platform.** Windows, Linux and macOS must build and run the same files, on `amd64` and `arm64`, with no host-specific path, shell, credential or bind mount. The workspace mount is the only bind.
- **Y09 - The egress firewall is enabled.** Anthropic's reference allowlist is copied, extended with Claude's sign-in and update hosts, run on every start, and requires `NET_ADMIN`, `NET_RAW` and a standard rootful Docker engine. The user confirmed all three hosts use rootful Docker.
- **Y10 - Mutable state is scoped per project.** Volume names include `${devcontainerId}`.
- **Y11 - VS Code Dev Containers is the only supported entry point.** No Compose file, no terminal-first workflow.
- **Y12 - A short `.devcontainer/README.md` is part of the deliverable.** It documents first open, the URL, the two one-time logins, rebuilds and the firewall.
- **Y13 - Playwright uses the lockfile version and runs headless.** The image installs Chromium at the locked version. The full suite is run once per host as the acceptance check; it is not added to routine CI or run during ordinary steps.
- **Y14 - No CI or application changes.** No workflow job builds the dev container and no game code changes. Acceptance is manual on Windows, Linux and macOS and is recorded in the phase execution record.

## Architecture

This plan adds no module under `app/src`. Ownership for the new boundaries:

| Concern | Home | Owns |
| ------- | ---- | ---- |
| Container image | `.devcontainer/Dockerfile` | Base image, Node/npm pins, Chromium and its libraries, GitHub CLI, firewall tools, the restricted sudo rule |
| Dev container definition | `.devcontainer/devcontainer.json` | Remote user, Claude feature, volumes, environment, capabilities, forwarded port, create/start commands, VS Code customizations |
| Egress policy | `.devcontainer/init-firewall.sh` | Default-deny rules, the domain allowlist, and the start-time self-check |
| Build context filter | `.dockerignore` | What is not sent to the Docker daemon |
| Dev command | `app/package.json` | The `dev` script only |
| Operator notes | `.devcontainer/README.md` | First-run, login and reset instructions |

Constraints:

- No file under `app/src`, no test, no authored JSON, no rules version and no gameplay constant changes.
- The only application file touched is `app/package.json`, and only its `dev` value.
- `node` remains the runtime user. The sudo rule allows that user to run only `/usr/local/bin/init-firewall.sh`, not arbitrary root commands.
- The firewall is default-deny for output. It is IP-based and resolved at each container start, so it is coarser than a domain proxy; adding a host requires editing the script and restarting the container.
- An early firewall failure must not leave egress open. The copied script sets its policies late, so the adaptation adds an error trap that applies the default-deny policies before exiting non-zero; a failed start is visible and closed.
- `postCreateCommand` runs `npm ci` before `postStartCommand` starts the firewall, so the first install has registry access. Later installs rely on the allowlist.
- `PLAYWRIGHT_BROWSERS_PATH` is `/ms-playwright` in the image and the container environment, so the browser is shared and never downloaded into the `node_modules` volume.
- No credential or token is baked into the image. Claude's and GitHub's credentials exist only in their named volumes.

## Target Files

`.devcontainer/devcontainer.json` carries these keys. The exact comments and ordering are the implementer's, but the keys and values are fixed:

```jsonc
{
  "name": "Dodge Hell Training",
  "build": { "dockerfile": "Dockerfile", "context": ".." },
  "remoteUser": "node",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  },
  "mounts": [
    "source=claude-config-${devcontainerId},target=/home/node/.claude,type=volume",
    "source=user-config-${devcontainerId},target=/home/node/.config,type=volume",
    "source=app-node-modules-${devcontainerId},target=/workspaces/${localWorkspaceFolderBasename}/app/node_modules,type=volume"
  ],
  "containerEnv": {
    "CLAUDE_CONFIG_DIR": "/home/node/.claude",
    "GIT_CONFIG_GLOBAL": "/home/node/.config/git/config",
    "PLAYWRIGHT_BROWSERS_PATH": "/ms-playwright"
  },
  "postCreateCommand": "mkdir -p /home/node/.config/git && npm --prefix app ci",
  "postStartCommand": "sudo /usr/local/bin/init-firewall.sh",
  "waitFor": "postStartCommand",
  "runArgs": ["--cap-add=NET_ADMIN", "--cap-add=NET_RAW"],
  "forwardPorts": [5173],
  "portsAttributes": {
    "5173": { "label": "Vite dev server", "onAutoForward": "notify" }
  }
}
```

`.devcontainer/Dockerfile` follows this shape:

```dockerfile
FROM node:24.22.1-bookworm
RUN npm install --global npm@12.2.1

# sudo (restricted to the firewall script), firewall tools, gh dependencies
# GitHub CLI from its official apt repository (amd64 and arm64)

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# install Chromium at the lockfile version with --with-deps, then delete the
# temporary node_modules and npm cache so the layer keeps only the browser

COPY .devcontainer/init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh
```

`.devcontainer/init-firewall.sh` is a copy of Anthropic's reference script with these recorded deltas:

- add `claude.ai`, `claude.com`, `platform.claude.com`, `sso.claude.com`, `downloads.claude.ai`, `storage.googleapis.com`, `raw.githubusercontent.com`, `code.claude.com` and `mcp-proxy.anthropic.com` to its domain loop;
- keep `registry.npmjs.org`, `api.anthropic.com`, `sentry.io`, `statsig.com` and the three VS Code hosts it already resolves;
- add the error trap described in Architecture, so a failed start is closed rather than open;
- keep its own verification: `https://example.com` must fail and `https://api.github.com/zen` must succeed.

`app/package.json` changes one line:

```json
"dev": "vite --host 0.0.0.0 --port 5173 --strictPort",
```

## Review Focus

- **No host path may survive review.** Search the finished `.devcontainer/` for `USERPROFILE`, `HOME`, `/Users/`, `C:\` and `localEnv`; the only allowed bind is the automatic workspace mount.
- **Post-create must run before post-start.** If the firewall starts first, the first `npm ci` cannot reach the registry. Keep `postCreateCommand` for install and `postStartCommand` for the firewall.
- **The firewall is the security boundary and must fail closed.** Do not move the default-deny policies back to the end without the error trap, and do not remove the script's own negative test.
- **Claude is deliberately unpinned; Node and npm are deliberately pinned.** Do not add `DISABLE_AUTOUPDATER`, and do not replace the feature with a pinned npm install.
- **The credential volumes are the only credential store.** No token, `.credentials.json`, `hosts.yml` or git credential may enter the image or the repository.
- **The port and base path are both required.** Forwarding 5173 is not enough if Vite binds localhost, and `localhost:5173/` is not the app; the URL is `http://localhost:5173/dodge-hell-training/`.
- **Do not change application behaviour to make the container work.** If Chromium's sandbox cannot start under Docker's default seccomp policy, the approved fallback is a `DEVCONTAINER`-gated `--no-sandbox` launch argument in `playwright.config.ts`, recorded as a deviation; do not relax the container's seccomp profile and do not edit game code.
- **The firewall is not a domain proxy.** Its allowlist is IP-based and resolved at start; a host that moves IPs mid-session needs a restart, and this limitation must be stated in the README.

## Approved Scope And Review Gates

- Only `.devcontainer/Dockerfile`, `.devcontainer/devcontainer.json`, `.devcontainer/init-firewall.sh`, `.devcontainer/README.md`, the root `.dockerignore` and the `dev` value in `app/package.json` change. No `app/src`, test, authored data, CI workflow, lockfile or rules version is touched.
- The `node:24.22.1-bookworm` base, npm `12.2.1` and the lockfile's Playwright version are exact. Claude Code is the only intentionally unpinned tool.
- The Claude feature is `ghcr.io/anthropics/devcontainer-features/claude-code:1.0`; auto-update stays on.
- The three volumes are `/home/node/.claude`, `/home/node/.config` and the workspace's `app/node_modules`, each scoped by `${devcontainerId}`. No other volume is added.
- No host configuration or credential file is mounted. The workspace bind is automatic and is not authored as a `mounts` entry.
- The firewall's allowlist contains only the reference hosts plus the Claude and GitHub entries listed above. It is default-deny, starts on every container start, and its failure is visible.
- The dev server is reachable on `0.0.0.0:5173`, and the URL keeps the `/dodge-hell-training/` base.
- `npm run verify` runs inside the container at the end of 42.1 and 42.2. The full `npm run test:e2e` runs once per host in 42.3 as the acceptance run; no step adds a new Playwright case.
- Acceptance is manual on Windows, Linux and macOS. The phase is not complete until each host builds, serves the app, passes `npm run verify`, passes the full e2e suite, and keeps both logins across a rebuild. A host that fails is recorded as incomplete, not waived.
- No commit, push, deployment or later phase without explicit authorization.

## Phase Index

| Phase | Title | Status | Dependencies |
| ----- | ----- | ------ | ------------ |
| 42 | The Dev Container | pending | V11 phase 41 |

## Phase 42: The Dev Container

Status: pending. Dependencies: V11 phase 41. Steps in [`docs/plan/phase-42.md`](plan/phase-42.md).

Builds the pinned image and dev container definition, moves `node_modules`, Claude state and GitHub state into named volumes, binds Vite to the forwarded port, adds the fail-closed allowlist firewall and documents the one-time logins, then proves the environment on Windows, Linux and macOS.

Step 42.1 is complete. Step 42.2 is implemented but incomplete pending the user's real Claude OAuth and `gh` device login, and step 42.3 is pending the native Linux and macOS runs; the execution records and the Windows evidence table are in the phase file.

## Implementation Addendum - 2026-11-05

The first build exposed four things the target files did not anticipate. Each is recorded in the phase execution records and is inside the same `.devcontainer` boundary:

- **`prepare-devcontainer-volumes.sh` is added.** Docker creates the bind-mounted `app/node_modules` volume as root, and the `/home/node/.config` volume is not writable by `node` until it is chowned. The helper runs from `postCreateCommand` through the restricted sudo rule, chowns the volumes, records the mounted repository as a git `safe.directory`, and sets `core.autocrlf=input` so a Windows CRLF checkout is not reported as every file being modified.
- **The firewall is installed as `/usr/local/bin/init-devcontainer-firewall.sh`.** The Claude Code feature installs its own `/usr/local/bin/init-firewall.sh` after the Dockerfile, so the project's extended script uses a distinct path and a distinct sudoers rule.
- **npm lifecycle scripts are allowed for Claude Code only.** npm 12 blocks package install scripts by default; without `allow-scripts=@anthropic-ai/claude-code`, the feature installs the CLI but not its native binary. The setting is global to the image but scoped to that one package.
- **`iproute2` is installed.** The firewall reads `ip route` to allow the Docker host network; the reference environment provides it, but the Node image does not.

None of these changes the approved behaviour, the pinned versions or the decision set. The devcontainer CLI also generated `.devcontainer/devcontainer-lock.json`, which pins the Claude feature package to 1.0.5 and its digest; it is committed so a rebuild uses the same feature install script. The Claude Code CLI itself remains auto-updating.

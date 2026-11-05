# Phase 42: The Dev Container

> Step prompts and execution records for phase 42 of [plan v12](../plan-v12.md), whose general sections stay the authority for how to work; [the implementation plan](../../implementation-plan.md) covers the reusable process. Read only this introduction and the requested step: grep `^### Step 42.` and read that section. When every step here is complete, move this file to `docs/plan-archive/phase-42.md` and replace the plan's line with a one-sentence outcome.

### Step 42.1 - Build The Image And Define The Container

Status: complete. Dependencies: 41.

**Implementation prompt**

Create the container that runs the project. This step gets a working VS Code dev container with the pinned toolchain, the Claude Code feature, the `node_modules` volume and the forwarded dev server. It does not add GitHub CLI or the firewall yet; step 42.2 does that after the environment is proven usable.

Create `.devcontainer/Dockerfile`:

- Base it on `node:24.22.1-bookworm`. Pin npm with `npm install --global npm@12.2.1`, matching [`.node-version`](../../.node-version), `app/package.json` and CI.
- Install the packages the image itself needs now: `sudo`, `curl`, `ca-certificates`, `git` and `procps`. Keep the apt lists out of the final layer.
- Install Playwright Chromium at the version resolved by `app/package-lock.json` (`@playwright/test` `1.64.1`). Because the build context is the repository root, copy `app/package.json` and `app/package-lock.json` into a temporary directory, run `npm ci`, then `./node_modules/.bin/playwright install --with-deps chromium`. Set `ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` before the install, make the browser directory readable and executable by `node`, and delete the temporary `node_modules` and npm cache so the layer keeps the browser, not a second copy of the dependencies.
- Do not install GitHub CLI, `iptables`, `ipset`, `dnsutils`, `jq` or `aggregate` in this step; step 42.2 adds them with the firewall.
- Do not install or pin Claude Code in the Dockerfile. The feature in `devcontainer.json` owns it.

Create `.devcontainer/devcontainer.json`:

- Use `"build": { "dockerfile": "Dockerfile", "context": ".." }` and `"remoteUser": "node"`.
- Add the official feature `ghcr.io/anthropics/devcontainer-features/claude-code:1.0`. Do not add `DISABLE_AUTOUPDATER`; auto-update and the `anthropic.claude-code` extension are wanted.
- Add a named volume for Claude state at `/home/node/.claude` and set `CLAUDE_CONFIG_DIR` to that path. Use a volume name containing `${devcontainerId}`.
- Add a named volume at `/workspaces/${localWorkspaceFolderBasename}/app/node_modules`, again scoped with `${devcontainerId}`. This is the only `node_modules` the container uses.
- Set `PLAYWRIGHT_BROWSERS_PATH` to `/ms-playwright` in `containerEnv` as well, so the runtime and the build agree.
- Set `postCreateCommand` to `npm --prefix app ci`. Do not add a post-start command in this step.
- Forward port `5173` and label it `Vite dev server` with `onAutoForward: "notify"`.
- Do not add `runArgs` capabilities or a workspace mount; the default workspace mount is required and is the only bind.

Create a root `.dockerignore` that excludes at least `.git`, `**/node_modules`, `app/dist`, `app/test-results`, `app/.vitest`, `.superpowers`, `docs/reference` and `image.png`. Do not exclude `.devcontainer/`, `app/package.json` or `app/package-lock.json`.

Change exactly one value in `app/package.json`: `"dev"` becomes `"vite --host 0.0.0.0 --port 5173 --strictPort"`. Do not touch any other script, dependency or field.

**Focused checks:** this step changes no application behaviour, so it adds no Vitest or Playwright test. Build and open the container with **Dev Containers: Reopen in Container**, then run inside it: `node -v` prints `v24.22.1`; `npm -v` prints `12.2.1`; `npx playwright --version` prints `Version 1.64.1`; `/ms-playwright` contains a Chromium build; `claude --version` succeeds and `printenv DISABLE_AUTOUPDATER` is empty; `npm --prefix app ls vite` resolves from the volume; `git status` on the host shows no change outside `app/package.json` and the new `.devcontainer` and `.dockerignore` files. Run `npm run dev` and open `http://localhost:5173/dodge-hell-training/` from the host browser; the game must load. Run `npm run verify` inside the container and record the four gate results.

**Acceptance:** the container builds from the pinned Node image; Node, npm, Playwright and the Claude CLI report the expected versions; Claude auto-update is not disabled; `npm ci` populated the volume; the dev server is reachable from the host on the base-path URL; `npm run verify` passes; and no host path or host bind was introduced.

**Execution and verification - 2026-11-05**

Built and opened the container with `@devcontainers/cli` 0.90.0 on Windows 11 against Docker 29.9.2's `linux/amd64` engine. Both `docker build -f .devcontainer/Dockerfile .` and `devcontainer up --workspace-folder . --remove-existing-container` succeeded.

Versions inside: Node v24.22.1, npm 12.2.1, Playwright 1.64.1, Chromium 1248 at `/ms-playwright`, GitHub CLI 2.103.3, Claude Code 2.1.318, and Vite 8.3.5 from the `app/node_modules` volume. `DISABLE_AUTOUPDATER` is absent. `npm ci` installed 118 packages into that volume.

The dev server returned HTTP 200 for `http://127.0.0.1:5173/dodge-hell-training/` inside the container. A temporary published-port container using the same image and volume returned HTTP 200 for `http://localhost:5173/dodge-hell-training/` from the Windows host, proving the `0.0.0.0` bind and the base path. VS Code's own port-forwarding UI was not exercised; the devcontainer CLI path was.

`npm run verify` passed all four gates: lint, typecheck, test and build.

**Deviations recorded:** npm 12 blocks lifecycle scripts, so the Dockerfile sets `allow-scripts=@anthropic-ai/claude-code` globally and the feature's postinstall fetches the native binary. The Claude feature installs its own `/usr/local/bin/init-firewall.sh`, so this project's script is installed as `/usr/local/bin/init-devcontainer-firewall.sh`. `iproute2` was added because the firewall reads `ip route`. A volume-preparation script chowns the bind-mounted `app/node_modules` volume, which Docker creates as root. These are implementation details inside the approved `.devcontainer` scope; no host path or host bind was introduced.

### Step 42.2 - Add GitHub CLI, Persistent Git State And The Egress Firewall

Status: incomplete - blocked on the real Claude OAuth and GitHub device-login checks. Dependencies: 42.1.

**Implementation prompt**

Make the container the only place git and Claude need to authenticate, then close its egress to the documented allowlist.

Extend `.devcontainer/Dockerfile`:

- Install `iptables`, `ipset`, `dnsutils`, `jq` and `aggregate` from Debian.
- Install GitHub CLI from its official apt repository. The repository serves both `amd64` and `arm64`; do not hardcode an architecture. Record the installed `gh --version` in the execution record.
- Copy `.devcontainer/init-firewall.sh` to `/usr/local/bin/init-firewall.sh` and make it executable.
- Add a sudoers rule that lets `node` run **only** `/usr/local/bin/init-firewall.sh` as root, with no password. Do not grant general sudo.

Adapt Anthropic's reference `init-firewall.sh` (retrieved 2026-11-05 from the `anthropics/claude-code` repository, `.devcontainer/init-firewall.sh`) and record the source commit in the execution record. Keep its structure: flush, restore Docker DNS, allow DNS/SSH/localhost, create the `allowed-domains` ipset, add GitHub's `api.github.com/meta` ranges through `aggregate`, resolve the domain list, allow the host network, set default-deny, then verify that `https://example.com` fails and `https://api.github.com/zen` succeeds.

Recorded deltas from the reference:

- Add `claude.ai`, `claude.com`, `platform.claude.com`, `sso.claude.com`, `downloads.claude.ai`, `storage.googleapis.com`, `raw.githubusercontent.com`, `code.claude.com` and `mcp-proxy.anthropic.com` to the domain loop, because Claude's sign-in and update requirements include hosts the reference script predates. Keep `registry.npmjs.org`, `api.anthropic.com`, `sentry.io`, `statsig.com`, `marketplace.visualstudio.com`, `vscode.blob.core.windows.net` and `update.code.visualstudio.com`.
- Add an `ERR`/`EXIT` trap that applies default-deny to `INPUT`, `FORWARD` and `OUTPUT` before the script exits non-zero. The reference sets those policies near the end, so without the trap an early failure (for example a GitHub API timeout) would leave egress unrestricted. A failed start must be closed and visible, not silently open.
- Keep the script's own positive and negative checks. Do not weaken or skip them.

Extend `.devcontainer/devcontainer.json`:

- Add a named volume at `/home/node/.config`, scoped with `${devcontainerId}`, and set `GIT_CONFIG_GLOBAL` to `/home/node/.config/git/config`.
- Change `postCreateCommand` to `mkdir -p /home/node/.config/git && npm --prefix app ci`, so git's global config has a writable directory.
- Add `"runArgs": ["--cap-add=NET_ADMIN", "--cap-add=NET_RAW"]`.
- Add `"postStartCommand": "sudo /usr/local/bin/init-firewall.sh"` and `"waitFor": "postStartCommand"`, so the firewall is in place before the terminal is offered.

Create `.devcontainer/README.md` with a short operator guide:

- prerequisites: VS Code with Dev Containers, a standard rootful Docker engine, and `NET_ADMIN`/`NET_RAW` support;
- first open, and the fact that `npm ci` and the firewall run automatically;
- the URL `http://localhost:5173/dodge-hell-training/`;
- Claude sign-in: run `claude`, open the printed URL in the host browser, sign in, paste the code back; the login is in the volume and survives **Rebuild Container**;
- GitHub sign-in: `gh auth login --web --git-protocol https`, then `gh auth setup-git`; set identity once with `git config --global user.name` and `git config --global user.email`; the state is in the `/home/node/.config` volume;
- the difference between rebuilding (keeps volumes) and deleting the volumes (resets both logins and `node_modules`);
- that each Docker host has its own volumes, so the first open on Windows, Linux and macOS each needs one sign-in;
- that the firewall is allow-by-IP, resolved at each start, so a new destination needs a script edit and a container restart;
- how to run `npm run verify` and `npm run test:e2e`.

Do not add host credential mounts, a Compose file, a second Vite config or any application source change.

**Focused checks:** no Vitest or Playwright test is added, because no application behaviour changes. Inside a rebuilt container: `gh --version`, `iptables --version`, `ipset --version`, `dig -v` and `jq --version` succeed. Run `sudo /usr/local/bin/init-firewall.sh` and confirm it exits zero. Then confirm `curl --connect-timeout 5 https://example.com` fails, while `curl --connect-timeout 5 https://api.github.com/zen`, `curl --connect-timeout 5 https://registry.npmjs.org`, `curl --connect-timeout 5 https://claude.ai` and `curl --connect-timeout 5 https://platform.claude.com` succeed. Run `npm pack vite@8.3.4 --dry-run` in a temporary directory outside the repository to prove npm can still fetch through the firewall without touching the lockfile. Have the user complete the Claude OAuth flow and `gh auth login`, then run **Dev Containers: Rebuild Container** and confirm `claude --version` still works, `gh auth status` still reports the account, and `git config --global user.name` still returns the configured value. Confirm VS Code reconnects after the firewall starts, then run `npm run verify` and record the gates. Do not run the full Playwright suite in this step; step 42.3 does that.

**Acceptance:** GitHub CLI is installed from the official repository on the host architecture; the firewall starts on every container start, is default-deny, fails closed, and allows exactly the documented destinations; Claude and GitHub logins plus git identity survive a rebuild; VS Code reconnects; `npm run verify` passes; the README documents first open, both logins, rebuilds and the firewall; and no host bind or application source change exists.

**Execution and verification - 2026-11-05**

GitHub CLI 2.103.3 is installed from its official apt repository. The firewall starts on every container start and its own checks passed: `https://example.com` was unreachable and `https://api.github.com/zen` returned 200. Manual checks inside the container: `https://registry.npmjs.org` 200, `https://claude.ai` 403 while the connection itself succeeded, `https://platform.claude.com` 200, and `npm view vite version` succeeded through the registry allowlist.

Volume persistence was exercised by writing a git identity, a `/home/node/.claude` marker and a `/home/node/.config/gh` marker, removing the container without removing the volumes, and recreating it. All three survived; `git config --global user.name` still returned the probe value and both marker files remained.

Git inside the bind-mounted workspace needed two container-side settings, both applied by `/usr/local/bin/prepare-devcontainer-volumes.sh`: `safe.directory` for the mounted repository, because git rejected the different owner, and `core.autocrlf=input`, because the Windows host checks files out with CRLF and the container otherwise reported every file as modified. With both applied, `git rev-parse HEAD` succeeds and `git status --short` matches the host; this also fixed the two footer commit-link e2e failures.

**Not verified:** the real Claude OAuth sign-in, the real `gh auth login` device flow, and a positive `gh auth status`. These require the user's accounts and are deliberately left to the first interactive session. The fail-closed trap was not exercised by inducing a failure; the normal start path and its built-in negative check passed.

### Step 42.3 - Prove The Container On Windows, Linux And macOS

Status: pending - blocked on native Linux and macOS acceptance and the same interactive logins. Dependencies: 42.2.

**Implementation prompt**

Prove the same files work on all three hosts, and record the evidence. This step is an acceptance run, not new configuration: change a file only when a host exposes a real defect, and record every such change as a deviation.

For each host - Windows with Docker Desktop, Linux with rootful Docker Engine, and macOS on Apple Silicon - perform the same sequence:

1. Remove any previous container and its named volumes for this repository, so the run starts from a fresh build.
2. **Dev Containers: Reopen in Container** and let the image build, `npm ci` populate the volume and the firewall start.
3. Record `node -v`, `npm -v`, `npx playwright --version`, `gh --version`, `claude --version`, `docker version` and the host OS and CPU architecture.
4. Open `http://localhost:5173/dodge-hell-training/` and confirm the game serves and hot-reloads.
5. Run `npm run verify` and record all four gate results.
6. Run the full `npm run test:e2e` inside the container. This is the approved acceptance run; do not replace it with a single grep. If Chromium cannot start under Docker's default seccomp policy, apply the approved fallback from the plan's Review Focus - a `DEVCONTAINER`-gated `--no-sandbox` launch argument in `playwright.config.ts` - record the failure and the deviation, and rerun the suite. Do not relax the container's seccomp profile.
7. Complete the Claude OAuth and `gh auth login` flows, rebuild the container, and confirm both logins and the git identity survive.
8. Search inside the container and on the host repository for `USERPROFILE`, `localEnv`, `C:\\`, `/Users/` and `HOME=` in `.devcontainer/`; report any hit as a defect.

The current session can drive the Windows host if Docker and VS Code are available there. The user runs the Linux and macOS sequences and reports the results. Record every host in a table in the execution record: host, architecture, Docker version, Node/npm/Playwright/`gh`/Claude versions, URL result, `npm run verify` result, e2e count, Claude persistence, GitHub persistence, firewall result, and any deviation. Do not mark the phase complete until all three rows are present and passing; a host that cannot run is an incomplete row, not a waiver.

**Focused checks:** the two commands that must pass on every host are `npm run verify` and `npm run test:e2e`, both inside the container. The firewall check is the script's own verification plus `curl https://example.com` failing; the login check is a rebuild followed by `claude --version`, `gh auth status` and `git config --global user.name`. No new Vitest or Playwright case is authored: the suite that must pass is the existing one.

**Acceptance:** Windows, Linux and macOS each build the container from the same files; the base-path URL serves from the host; `npm run verify` and the full e2e suite pass on each; Claude, GitHub and git identity persist across a rebuild on each; the firewall is active and default-deny on each; no host-specific path or bind exists; and the per-host evidence table is complete with deviations recorded rather than hidden.

**Execution and verification - 2026-11-05**

Windows 11 (10.0.26200, x64) with Docker Desktop 29.9.2, Linux engine, `amd64`: the container built, `npm ci` completed, the firewall started, the base-path URL served, `npm run verify` passed 4/4, the full `npm run test:e2e` passed 45/45, and the two commit-link-dependent `renders readable nonblank arena` tests passed 2/2 again after the final `.git`-file robustness change, with `git rev-parse HEAD` still succeeding. Volume persistence across container recreation passed for git identity and the Claude and `gh` marker files.

| Host | Architecture | Docker | Node/npm | Playwright | gh | Claude | URL | verify | e2e | Logins | Firewall | Status |
| ---- | ------------ | ------ | -------- | ---------- | -- | ------ | --- | ------ | --- | ------ | -------- | ------ |
| Windows 11 | x64 | 29.9.2, linux/amd64 | 24.22.1 / 12.2.1 | 1.64.1 | 2.103.3 | 2.1.318 | 200 | 4/4 | 45/45 | volume persistence verified; real OAuth/device login not performed | pass | partial |
| Linux | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| macOS | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |

**Not run:** native Linux and macOS (including Apple Silicon/arm64) acceptance, the VS Code Dev Containers UI path, and the real Claude and GitHub sign-ins. Those require the other two hosts, VS Code, and the user's accounts. The phase therefore remains pending and this file stays under `docs/plan/` rather than moving to the archive.

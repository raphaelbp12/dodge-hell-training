# Dev container

This is the only supported development environment for the project. It runs on Windows, Linux and macOS with a standard rootful Docker engine and VS Code's Dev Containers extension.

## First open

1. Install VS Code, the Dev Containers extension and Docker.
2. Open the repository and run **Dev Containers: Reopen in Container**.
3. The image builds Node 24.22.1, npm 12.2.1, Playwright Chromium, GitHub CLI, Claude Code, CodeGraph and RTK. `npm ci` fills the `app/node_modules` volume, `codegraph init` builds the container's code index, and the egress firewall starts.
4. Open `http://localhost:5173/dodge-hell-training/`.

The base path is part of the URL. `http://localhost:5173/` alone is not the app.

## One-time sign-ins

Each Docker host has its own named volumes, so the first open on each machine needs one sign-in for Claude and one for GitHub.

**Claude Code**

Run `claude` in the container terminal. It prints a URL. Open that URL in the browser on the host, approve the login, and paste the code back into the container prompt. The credentials, settings and session history live in the `~/.claude` volume and survive **Rebuild Container**. Claude Code auto-updates; do not pin or disable the updater.

**GitHub CLI**

```bash
gh auth login --web --git-protocol https
gh auth setup-git
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The `gh` credentials and git global config live in the `/home/node/.config` volume and survive a rebuild.

## Tools

**CodeGraph 1.6.2** is installed globally. A per-container `.codegraph-container` volume is initialized by `codegraph init` when the container is created, so the index is built against the container's Linux paths and never mixes with a host index; the host's `.codegraph/` stays separate. Telemetry is disabled with `CODEGRAPH_TELEMETRY=0`. Use `codegraph status`, `codegraph explore <query>`, or the `codegraph_explore` MCP tool. The VS Code MCP configuration uses the workspace rather than a host-specific path.

**Caveman** (terse-reply plugin, `JuliusBrussee/caveman`) is installed as a Claude Code plugin by `postCreateCommand` (`claude plugin marketplace add` then `claude plugin install caveman@caveman`). It is stored in the `~/.claude` volume, so it survives rebuilds; if the install fails (for example offline) the container still starts and prints a warning. `DO_NOT_TRACK=1` disables its usage stats. Claude Code loads CodeGraph through the committed `.mcp.json` and `.claude/settings.json` (`enabledMcpjsonServers`), so no approval prompt appears.

**RTK 1.1.0** is installed globally and initialized for Claude Code with a hook-only global config. `rtk init -g --hook-only --auto-patch` writes the `PreToolUse` hook to the `~/.claude` volume, so it survives rebuilds; running it again is idempotent. The hook rewrites Bash commands for Claude Code, so restart an already-open Claude session after a rebuild. `rtk --version` checks the binary.

## Rebuild versus reset

- **Dev Containers: Rebuild Container** rebuilds the image and keeps the named volumes. Both logins and `node_modules` survive.
- Removing the named volumes (`docker volume rm ...`) resets both logins and forces `npm ci` to run again on the next create.

## Firewall

The container starts with default-deny egress. Only the destinations in `.devcontainer/init-firewall.sh` are allowed: the npm registry, Claude Code's documented hosts, GitHub, and VS Code's update hosts. The allowlist is resolved to IP addresses at each container start, so it is not a domain proxy. Adding a destination means editing the script and restarting the container. A failed firewall start leaves the container closed and reports the failure; do not bypass it.

## Checks

Run these inside the container from the repository root:

```bash
npm --prefix app run verify
npm --prefix app run test:e2e
```

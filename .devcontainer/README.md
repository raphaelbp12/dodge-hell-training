# Dev container

This is the only supported development environment for the project. It runs on Windows, Linux and macOS with a standard rootful Docker engine and VS Code's Dev Containers extension.

## First open

1. Install VS Code, the Dev Containers extension and Docker.
2. Open the repository and run **Dev Containers: Reopen in Container**.
3. The image builds Node 24.22.1, npm 12.2.1, Playwright Chromium, GitHub CLI, Claude Code, graphify and RTK. `npm ci` fills the `app/node_modules` volume, `graphify extract` builds the container's code graph, and the egress firewall starts.
4. Open `http://localhost:5173/dodge-hell-training/`.

The base path is part of the URL. `http://localhost:5173/` alone is not the app.

## One-time sign-ins

Each Docker host has its own named volumes, so the first open on each machine needs one sign-in for Claude and one for GitHub.

**Claude Code**

Run `claude` in the container terminal. It prints a URL. Open that URL in the browser on the host, approve the login, and paste the code back into the container prompt. The credentials, settings and session history live in the `~/.claude` volume and survive **Rebuild Container**. The CLI is installed globally as root, so the built-in updater cannot replace it; instead `postStartCommand` runs `sudo /usr/local/bin/update-claude.sh` after the firewall starts, which installs the latest `@anthropic-ai/claude-code` from npm on every container start. A failed upgrade prints a warning and keeps the previous version. Do not pin the version.

**GitHub CLI**

```bash
gh auth login --web --git-protocol https
gh auth setup-git
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

The `gh` credentials and git global config live in the `/home/node/.config` volume and survive a rebuild.

## Tools

**graphify 0.9.103** (PyPI package `graphifyy`, `Graphify-Labs/graphify`) is installed in the image with uv 0.13.6, under `/opt/uv` with its launcher at `/usr/local/bin/graphify`. The firewall blocks PyPI at runtime, so upgrading means changing the pin in the `Dockerfile` and rebuilding. Debian's Python 3.11.2 is below graphify's minimum, so uv brings its own Python 3.12.

Each dev container has its own graph. `graphify-out/` is gitignored and lives in that container's checkout; `postCreateCommand` builds it with `graphify extract . --code-only` (tree-sitter AST only; `GRAPHIFY_BACKEND=none` stops it calling any model). Upstream's way to share one graph is to commit `graphify-out/graph.json` with a union merge driver, but GitHub does not run custom merge drivers, so every pull request would touch the file and conflict with every other open one. A code-only rebuild takes seconds, so each container builds its own instead.

`postCreateCommand` then runs two installs. `graphify hook install` writes `post-commit`, `post-checkout`, `post-merge` and `post-rewrite` hooks into `.git/hooks`, which rebuild the graph in the background (log: `~/.cache/graphify-rebuild.log`; skip once with `GRAPHIFY_SKIP_HOOK=1`). It also registers a merge driver in `.git/config` and wants a `.gitattributes` line, which is committed so the tree stays clean. `.git` is the host's bind mount, so git on the host runs the same hooks; there they find no graphify, print one warning and exit 0. `graphify install` puts the `/graphify` skill in the `~/.claude` volume.

Shared through git: the `PreToolUse` and `SessionStart` hooks in `.claude/settings.json` (`graphify hook-guard search|read|compact`, which nudge Claude towards `graphify query`, `explain` and `path` before a grep or read) and the graph rules in `AGENTS.md`. They are written by hand, so do not run `graphify claude install` or `graphify install --project`: at 0.9.103 the first writes its rules into `CLAUDE.md`, which must only import `AGENTS.md`. Use `graphify hook status` to check the git hooks and `graphify update .` to refresh the graph by hand.

**Caveman** (terse-reply plugin, `JuliusBrussee/caveman`) and **Ponytail** (minimal-code plugin, `DietrichGebert/ponytail`) are installed as Claude Code plugins by `postCreateCommand`, which runs `.devcontainer/install-claude-plugins.sh` (`claude plugin marketplace add` then `claude plugin install caveman@caveman` and `ponytail@ponytail`). They are stored in the `~/.claude` volume, so they survive rebuilds; the script is idempotent, and if an install fails (for example offline) the container still starts and prints a warning. Both start active in every session at full strength: `CAVEMAN_DEFAULT_MODE=caveman` (the old `full` level) and `PONYTAIL_DEFAULT_MODE=full`. `DO_NOT_TRACK=1` disables caveman's usage stats.

**RTK 1.1.0** is installed globally and initialized for Claude Code with a hook-only global config. `rtk init -g --hook-only --auto-patch` writes the `PreToolUse` hook to the `~/.claude` volume, so it survives rebuilds; running it again is idempotent. The hook rewrites Bash commands for Claude Code, so restart an already-open Claude session after a rebuild. `rtk --version` checks the binary.

`configure-rtk.sh` (run from `postCreateCommand` after `rtk init`) sets `exclude_commands = ["npm", "npx", "git"]` in the `[hooks]` section of `~/.config/rtk/config.toml`, so the hook leaves those commands alone. Reason: auto mode refuses a Bash call the hook rewrote (`npm run verify` becomes `rtk npm run verify`) until it is issued again, which left subagent checks partial; `npm` and `npx` are everything the `verifier` runs, and `git` keeps `git diff` complete for `commit-drafter`. The main session can still type `rtk git ...` itself. Trap: the file must have exactly one `[hooks]` header. A second one fails the parse ("duplicate key `hooks`") and rtk silently uses its defaults, so the script edits the existing section and never appends a header. `rtk config --create` overwrites an existing file, so the script calls it only when the file is missing.

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

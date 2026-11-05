# Dev container

This is the only supported development environment for the project. It runs on Windows, Linux and macOS with a standard rootful Docker engine and VS Code's Dev Containers extension.

## First open

1. Install VS Code, the Dev Containers extension and Docker.
2. Open the repository and run **Dev Containers: Reopen in Container**.
3. The image builds Node 24.22.1, npm 12.2.1, Playwright Chromium, GitHub CLI and Claude Code. `npm ci` fills the `app/node_modules` volume, then the egress firewall starts.
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

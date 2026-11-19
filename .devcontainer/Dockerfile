FROM node:24.22.1-bookworm

# Match the npm version used by CI and pinned in package.json.
RUN npm install --global npm@12.2.1

# npm 12 blocks lifecycle scripts unless a package is explicitly allowed. The
# Claude Code feature installs the CLI as root through npm; without this, its
# postinstall never fetches the native binary. Allow only that package.
RUN npm config set allow-scripts=@anthropic-ai/claude-code --location=global

# sudo and the firewall tools. The node user may run only the two helper
# scripts as root; the rules are written below. The remaining packages are
# the GitHub CLI's prerequisites.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      sudo curl ca-certificates git procps iproute2 \
      iptables ipset dnsutils jq aggregate \
 && rm -rf /var/lib/apt/lists/*

# GitHub CLI from its official apt repository. dpkg resolves the host
# architecture, so the same Dockerfile serves amd64 and arm64.
RUN mkdir -p -m 755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends gh \
 && rm -rf /var/lib/apt/lists/*

# graphify (PyPI package graphifyy) through uv, its recommended installer. The
# runtime firewall blocks PyPI, so it is installed here, at build time. Debian
# bookworm's Python 3.11.2 is below graphify's minimum, so uv installs its own
# managed Python. Tool, Python and launcher live outside /home/node so every
# rebuild gets the same paths, which the git hooks and merge driver pin.
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
RUN UV_TOOL_DIR=/opt/uv/tools UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PYTHON_INSTALL_DIR=/opt/uv/python UV_PYTHON_PREFERENCE=only-managed UV_NO_CACHE=1 \
    uv tool install --python 3.12 graphifyy==0.9.103 \
 && UV_TOOL_DIR=/opt/uv/tools uv tool list | grep -F 'graphifyy v0.9.103' \
 && command -v graphify

# RTK's official installer verifies the pinned release checksum and selects the
# matching Linux target for the build architecture.
RUN curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh \
      -o /tmp/rtk-install.sh \
 && RTK_VERSION=v1.1.0 RTK_INSTALL_DIR=/usr/local/bin sh /tmp/rtk-install.sh \
 && rtk --version \
 && rm -f /tmp/rtk-install.sh

# Chromium is installed at the lockfile's Playwright version and kept outside
# node_modules, so the volume that holds the dependencies stays clean.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /tmp/playwright-install
COPY app/package.json app/package-lock.json ./
RUN npm ci \
 && ./node_modules/.bin/playwright install --with-deps chromium \
 && chmod -R 755 /ms-playwright \
 && rm -rf /tmp/playwright-install /root/.npm

# The Claude Code feature also installs its own /usr/local/bin/init-firewall.sh.
# Use a distinct path so our extended, fail-closed policy is the one that runs.
COPY .devcontainer/init-firewall.sh /usr/local/bin/init-devcontainer-firewall.sh
COPY .devcontainer/prepare-devcontainer-volumes.sh /usr/local/bin/prepare-devcontainer-volumes.sh
COPY .devcontainer/update-claude.sh /usr/local/bin/update-claude.sh
COPY .devcontainer/install-claude-plugins.sh /usr/local/bin/install-claude-plugins.sh
COPY .devcontainer/configure-rtk.sh /usr/local/bin/configure-rtk.sh
RUN chmod 755 /usr/local/bin/init-devcontainer-firewall.sh /usr/local/bin/prepare-devcontainer-volumes.sh \
      /usr/local/bin/update-claude.sh /usr/local/bin/install-claude-plugins.sh /usr/local/bin/configure-rtk.sh \
 && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-devcontainer-firewall.sh" > /etc/sudoers.d/node-firewall \
 && chmod 0440 /etc/sudoers.d/node-firewall \
 && echo "node ALL=(root) NOPASSWD: /usr/local/bin/prepare-devcontainer-volumes.sh" > /etc/sudoers.d/node-volumes \
 && chmod 0440 /etc/sudoers.d/node-volumes \
 && echo "node ALL=(root) NOPASSWD: /usr/local/bin/update-claude.sh" > /etc/sudoers.d/node-claude-update \
 && chmod 0440 /etc/sudoers.d/node-claude-update

# Create the volume mount points with node ownership before Docker initializes
# the named volumes from this image. Without this, an empty volume is owned by
# root and the node user cannot write Claude's or gh's state into it.
RUN mkdir -p /home/node/.config/git /home/node/.claude \
 && chown -R node:node /home/node/.config /home/node/.claude

WORKDIR /workspaces

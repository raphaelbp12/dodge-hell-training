#!/bin/bash
# Named volumes are mounted over directories that Docker creates as root when
# the target is nested inside the workspace bind mount. Give the remote user
# ownership before npm ci runs. This is idempotent and safe on existing volumes.
set -euo pipefail

mkdir -p /home/node/.config/git /home/node/.claude

# The host may check the repository out with CRLF (Windows' autocrlf=true).
# Normalize on commit and keep the Linux/macOS working tree LF, so git does
# not report every bind-mounted file as modified inside the container.
git config --file /home/node/.config/git/config core.autocrlf input

# The workspace is a host bind mount, so git sees a different owner and refuses
# to read the repository. Record each mounted repository as safe for the node
# user. The file is chowned below after it is created.
for repo in /workspaces/*; do
    if [ -e "$repo/.git" ]; then
        if ! git config --file /home/node/.config/git/config --get-all safe.directory 2>/dev/null | grep -qxF "$repo"; then
            git config --file /home/node/.config/git/config --add safe.directory "$repo"
        fi
    fi
done

chown -R node:node /home/node/.config /home/node/.claude

for modules in /workspaces/*/app/node_modules; do
    if [ -d "$modules" ]; then
        chown -R node:node "$modules"
    fi
done

# The per-container CodeGraph index lives in its own volume for the same reason.
for codegraph in /workspaces/*/.codegraph-container; do
    if [ -d "$codegraph" ]; then
        chown -R node:node "$codegraph"
    fi
done

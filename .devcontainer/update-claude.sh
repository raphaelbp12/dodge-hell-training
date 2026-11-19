#!/bin/bash
# Upgrade Claude Code to the latest npm release on every container start.
#
# The Claude Code dev container feature installs the CLI globally as root, so
# the node user cannot write /usr/local/lib/node_modules and the built-in
# updater cannot replace it. The node user may run only this script as root
# (see the sudoers rule in the Dockerfile); it takes no arguments.
#
# A failed upgrade (for example offline) must not block the container, so the
# script reports the failure and exits 0 with the previous version in place.
set -uo pipefail

before=$(claude --version 2>/dev/null || echo "none")
if npm install --global @anthropic-ai/claude-code@latest --no-fund --no-audit --loglevel=error; then
    echo "Claude Code: ${before} -> $(claude --version 2>/dev/null)"
else
    echo "WARNING: Claude Code upgrade failed; keeping ${before}"
fi
exit 0

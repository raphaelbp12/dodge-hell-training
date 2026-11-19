#!/bin/bash
# Keep rtk's hook from rewriting the commands the verifier and commit-drafter
# subagents run (npm, npx, git): auto mode refuses a call the hook changed.
# Runs as the node user from postCreateCommand, and is idempotent. The config
# lives in the ~/.config volume. A failure prints a warning and still exits 0
# so the container starts.
set -uo pipefail

EXCLUDE='exclude_commands = ["npm", "npx", "git"]'
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/rtk/config.toml"

# `rtk config --create` overwrites an existing file, so call it only when missing.
if [ ! -f "$CONFIG" ]; then
    rtk config --create >/dev/null \
        || { echo "WARNING: rtk config --create failed; set $EXCLUDE under [hooks] in $CONFIG manually"; exit 0; }
fi
[ -f "$CONFIG" ] \
    || { echo "WARNING: $CONFIG not found; set $EXCLUDE under [hooks] manually"; exit 0; }

# A second [hooks] header makes the file unparsable and rtk silently falls back
# to its defaults, so edit the existing section and never append a header.
if grep -q '^exclude_commands[[:space:]]*=' "$CONFIG"; then
    sed -i "s|^exclude_commands[[:space:]]*=.*|$EXCLUDE|" "$CONFIG"
elif grep -q '^\[hooks\]' "$CONFIG"; then
    sed -i "/^\[hooks\]/a $EXCLUDE" "$CONFIG"
else
    printf '\n[hooks]\n%s\n' "$EXCLUDE" >>"$CONFIG"
fi || echo "WARNING: could not update $CONFIG; set $EXCLUDE under [hooks] manually"

rtk config >/dev/null 2>&1 || echo "WARNING: rtk could not read $CONFIG; check it for a duplicate [hooks] header"
exit 0

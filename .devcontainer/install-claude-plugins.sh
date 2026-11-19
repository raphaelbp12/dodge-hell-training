#!/bin/bash
# Install the Claude Code plugins this container uses. Runs as the node user
# from postCreateCommand. The plugins live in the ~/.claude volume, so on a
# rebuild they are already present; each step is independent and idempotent,
# and a failure (for example offline) prints a warning without failing the
# container.
set -uo pipefail

install_plugin() {
    local repo="$1" plugin="$2"
    local marketplace="${plugin#*@}"
    if ! claude plugin marketplace list 2>/dev/null | grep -qw "$marketplace"; then
        claude plugin marketplace add "$repo" \
            || { echo "WARNING: marketplace $repo add failed; rerun it manually"; return; }
    else
        claude plugin marketplace update "$marketplace" >/dev/null 2>&1 || true
    fi
    claude plugin install "$plugin" \
        || echo "WARNING: plugin $plugin install failed; rerun it manually"
}

install_plugin JuliusBrussee/caveman caveman@caveman
install_plugin DietrichGebert/ponytail ponytail@ponytail
exit 0

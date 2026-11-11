#!/usr/bin/env bash
# ============================================================================
# Sandbox-side helper: gh CLI install + auth from .ghtoken (reset-safe).
# Codespace ssh/cp commands ke liye chahiye. Idempotent hai — har turn chalao.
#   bash tools/codespace-gh.sh
# NOTE: gh ke saath hamesha aise chalao (keyring se behtar, reset-proof):
#   GH_TOKEN=$(tr -d '[:space:]' < .ghtoken) gh codespace ssh -c <name> -- 'cmd'
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# gh-generated ssh key permissions fix (snapshot/restore ke baad 0644 ho jati hai,
# jisse ssh "UNPROTECTED PRIVATE KEY FILE" bol kar refuse karta hai)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
[ -f ~/.ssh/codespaces.auto ] && chmod 600 ~/.ssh/codespaces.auto

GH_VER=2.63.2   # pinned — URL stable, codespace ssh ke liye kaafi

if ! command -v gh >/dev/null 2>&1; then
  echo "[gh] installing gh $GH_VER ..."
  curl -fsSL --retry 3 -o /tmp/gh.deb \
    "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_linux_amd64.deb"
  if command -v sudo >/dev/null 2>&1; then sudo dpkg -i /tmp/gh.deb; else dpkg -i /tmp/gh.deb; fi
fi

# keyring auth try karo; fail ho to GH_TOKEN env pattern hi use hota hai
if ! gh auth status >/dev/null 2>&1; then
  tr -d '[:space:]' < .ghtoken | gh auth login --with-token 2>/dev/null \
    && echo "[gh] keyring auth OK" \
    || echo "[gh] keyring auth skip — GH_TOKEN env pattern use karo (README dekho)"
fi
gh --version | head -1

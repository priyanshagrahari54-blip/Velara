#!/usr/bin/env bash
# tools/git-push.sh — sab kuch commit + GitHub pe push (token .ghtoken se padhta hai)
# Usage: bash tools/git-push.sh "commit message"
echo "[dev-team guard]"; bash tools/dev-verify.sh || { echo "GUARD FAIL — push rukka"; exit 1; }
set -e
cd "$(dirname "$0")/.."
[ -f .ghtoken ] || { echo "ERROR: .ghtoken file missing"; exit 1; }
git check-ignore -q .ghtoken || { echo "SAFETY ABORT: .ghtoken gitignored nahi hai"; exit 1; }
TOKEN=$(tr -d '[:space:]' < .ghtoken)
# sandbox reset ke baad git config wipe hota hai — dobara set karo
git config user.name >/dev/null 2>&1 || git config user.name "priyanshagrahari54-blip"
git config user.email >/dev/null 2>&1 || git config user.email "priyanshagrahari54-blip@users.noreply.github.com"
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/priyanshagrahari54-blip/Velara.git
git remote set-url origin "https://${TOKEN}@github.com/priyanshagrahari54-blip/Velara.git"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "update: ${1:-game pass}"
fi
git push origin main
echo "PUSH OK"

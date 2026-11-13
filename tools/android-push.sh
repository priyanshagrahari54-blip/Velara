#!/usr/bin/env bash
# VELARA — Android release push (overcast redesign v0.3.0)
# Sandbox recover hone par ye ek command: commit + push + CI trigger + monitor.
set -e
cd "$(dirname "$0")/.."

echo "== strays clean =="
pkill -9 -f headless_shell 2>/dev/null || true
pkill -9 -f chromium 2>/dev/null || true

echo "== syntax gate =="
node --check src/ui/ui.js
node --check src/engine/input.js
node --check src/engine/quality.js
node --check src/core/game.js
node --check src/world/city.js
node --check src/world/environment.js
node --check src/gameplay/vehicle.js

echo "== git =="
git add -A src public index.html package.json tools/IconGen.java .github/workflows/apk.yml references/mobile references/mobile2 tools/build-mobile-refs.py tools/build-mobile-refs2.py
git add references/MOBILE-REFS.html references/MOBILE-REFS-2.html 2>/dev/null || true
git commit -m "v0.3.0 MOBILE: overcast-moody redesign (no neon) + driving touch controls + mobile tier + APK pipeline" || echo "nothing new to commit"
git push origin main

echo "== CI =="
TOKEN=$(git config --get remote.origin.url | sed -n 's|.*://\([^@]*\)@.*|\1|p')
for i in $(seq 1 60); do
  sleep 15
  RUN=$(curl -s -H "Authorization: token $TOKEN" \
    "https://api.github.com/repos/priyanshagrahari54-blip/Velara/actions/runs?per_page=1" \
    | python3 -c "import json,sys; r=json.load(sys.stdin)['workflow_runs'][0]; print(r['status'], r['conclusion'], r['html_url'])")
  echo "[$i] $RUN"
  STATUS=$(echo "$RUN" | cut -d' ' -f1)
  if [ "$STATUS" = "completed" ]; then
    echo "$RUN" | grep -q "success" && echo "APK READY: https://github.com/priyanshagrahari54-blip/Velara/releases/tag/android-latest" && exit 0
    echo "BUILD FAILED — logs: $(echo $RUN | cut -d' ' -f3)"; exit 1
  fi
done
echo "CI still running — link: https://github.com/priyanshagrahari54-blip/Velara/actions"

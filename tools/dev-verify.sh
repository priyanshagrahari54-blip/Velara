#!/usr/bin/env bash
# DEV-TEAM GUARD: push se pehle 30 second mein poora sanity check.
set -e; cd "$(dirname "$0")/.."
echo "== dev-verify: syntax =="
for f in src/**/*.js src/*.js; do node --check "$f" 2>/dev/null || true; done
find src -name '*.js' | xargs -n1 node --check && echo "  src OK"
echo "== dev-verify: node tests =="
node test/g560-draws.mjs 2>&1 | tail -2
node test/g560-check.mjs 2>&1 | tail -1
echo "== dev-verify: python jobs =="
python3 -m py_compile factory/jobs/*.py && echo "  factory jobs OK"
echo "== dev-verify: JSON + YAML =="
python3 - <<'PY'
import json, glob, sys
try:
    import yaml
except ImportError:
    yaml = None
for f in glob.glob('factory/queue/*.json') + ['factory/team.json']:
    json.load(open(f))
for f in glob.glob('.github/workflows/*.yml'):
    if yaml: yaml.safe_load(open(f))
print('  JSON/YAML OK (%d queue files)' % len(glob.glob('factory/queue/*.json')))
PY
echo "== dev-verify: ALL GREEN =="

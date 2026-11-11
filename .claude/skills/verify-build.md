# Skill: verify-build

**Use jab bhi:** code change hua hai aur "done" bolna hai.

## Steps
1. `npm run build` — zero errors chahiye.
2. `npm run test:physics` — vehicle/cone/player invariants green.
3. `npm run test:browser` — end-to-end: spawn → walk → car → 110 km/h →
   missions 1→2→3→free-roam → pause/resume → restart. **0 console errors.**
4. Dev server restart karo (stale module cache ka dhyan — vite watcher sandbox
   mein unreliable hai).
5. Report format: kaunsa test, kya result, kaunsa risk open hai.

## Fail → Fix protocol
- Fail hone par: reproduce chhota test mein, root cause likho (5-why),
  fix karo, full suite dobara chalao. Symptom-patch mana hai.

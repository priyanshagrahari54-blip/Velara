# Skill: add-feature

**Use jab bhi:** naya gameplay system add karna ho (weapons, police, vehicle…).

## Protocol (Ask → Options → Decide → Draft → Approve)
1. **Design note** — `design/` mein 1-page: kya, kyun, kaise, kya risk.
   Game-director pillar check: Fun? Physics-real? City-alive?
2. **Options user ko do** (2-4) pros/cons ke saath — user decide kare.
3. **Tests pehle likho** (jo define karta hai "done"):
   - physics behaviour → node test
   - gameplay flow → smoke test steps
4. **Implement** rules follow karke (`.claude/rules/`).
5. `verify-build` skill chalao.
6. Docs update: GDD section + ROADMAP tick + naya ADR agar architectural.

## Definition of Done
- [ ] Tests green (0 console errors)
- [ ] Perf budget intact (quality tiers chal rahe)
- [ ] Win7 low-tier check (agar heavy feature)
- [ ] Docs + roadmap updated

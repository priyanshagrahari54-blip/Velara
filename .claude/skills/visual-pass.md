# Skill: visual-pass
Repeatable procedure for raising visual fidelity ONE measurable step at a time.

## Steps
1. **Reference first**: state which look we chase (approved style board in `references/`).
2. **One asset batch**: generate ≤4 tileable 1024px textures (seamless, flat light, no
   markings/objects) via image gen. Save to `public/textures/`.
3. **Apply**: materials in `src/world/*` — `map` + `emissiveMap` (night glow),
   `colorSpace: SRGBColorSpace`, `RepeatWrapping`, anisotropy 4, repeat sized to meters.
4. **Budget check**: texture memory ≤ 12MB total; G560 profile must stay ≥25 FPS.
5. **Verify**: `npx vite build` + screenshot via `test/debug-phase2.mjs` pattern; compare
   against the style board. No console errors.
6. **Log**: one line in `design/02-ART-DIRECTION.md` change log.

## Rules
- Never ship a pass without the 0-error QA gate.
- Gameplay code untouched during a visual pass (separation of concerns).
- Every pass must survive `?profile=g560` (low tier) — no low-tier-only breakage.

# 🔬 VELARA — TESTER TEAM REPORT
**Date:** 13 Nov 2026 · **Build under test:** v0.3.0 APK (user-tested) → fixes → v0.3.1
**Tester methods:** (1) User phone test report, (2) Automated Mobile-Emulation QA (Playwright, phone viewport + touch, software-GL), (3) Physics suite, (4) Cloud CI smoke.

---

## 1. USER-REPORTED BUGS → ROOT CAUSE → STATUS

| # | User Report | Root Cause (verified) | Fix | Status |
|---|---|---|---|---|
| 1 | **"Car ka tyre hi nahi hai"** | GLB wheel nodes car-group ke ANDAR nested the, par unhe WORLD position se sync kiya jata tha → double-transform → **tyres car se ~14m door ud rahe the** (QA proof: wheel (11.7, 24.9) vs body (7, 12)) | Wheels ab `scene.attach()` — scene-level sync, single transform | ✅ FIXED — QA: wheel (8.3, 10.9) body ke saath |
| 2 | **"Sky kuch hai hi nahi"** | Sky RENDER ho raha tha (pixel-test: RGB [87,91,94]) par **flat boring gray** — koi clouds/detail nahi | Procedural cloud shader — 2-layer fbm noise, dheere drift karte hain, sky-brightness follow | ✅ UPGRADED |
| 3 | **"HUD bahut bekar / overlay"** | QA-confirmed: **minimap steering pads ke upar tha, speedo GAS/BRAKE pedals ke upar** — mobile layout desktop wala tha | Mobile layout: minimap top-left, speedo bottom-center, money top-right, health minimap ke neeche | ✅ FIXED — overlap test false×3 |
| 4 | **"Fire karne pe kuch hota hi nahi"** | Bullet chalti thi (ammo 12→11) par VFX invisible: tracer = 1px line (phone par dikhta hi nahi), flash 30ms | Tracer = visible glowing streak (cylinder), muzzle flash sprite, impact flash + sparks, flash light 2.2× | ✅ FIXED — QA: tracer+muzzle+flash sab active |
| 5 | **"Player/car movement bekar"** | Digital touch input = instant 0→1 jump (robotic feel) | Throttle ramp (real-car pickup), steering attack/return rates, touch sprint (full stick deflection) | ✅ IMPROVED |
| 6 | **"Smooth curves nahi hai"** | Procedural bodies = sharp boxes | RoundedBoxGeometry (body/cabin/nose), wheels 28-seg | ⚠️ PARTIAL — asli fix = factory high-detail models (agla phase) |

## 2. AUTOMATED MOBILE QA (phone emulation, touch)

| Check | v0.3.0 | v0.3.1 |
|---|---|---|
| Start screen + boot | ✅ | ✅ |
| Sky visible (pixel-test, top 30%) | ✅ | ✅ |
| Sky dome config | ✅ | ✅ |
| Hero GLB loaded + 4 wheels | ✅ | ✅ |
| **GLB wheels car se attached** | ❌ (14m door) | ✅ |
| Procedural wheels attached | ✅ | ✅ |
| Enter car → touch mode switch | ✅ | ✅ |
| **HUD ↔ controls no-overlap** | ❌ (3 overlap) | ✅ |
| GAS pad → accelerate | ✅ 51 kmh | ✅ 39 kmh (ramp = smoother) |
| STEER pad → yaw change | ✅ 0.95 rad | ✅ 1.07 rad |
| **FIRE → shots + tracer + flash** | ❌ (invisible) | ✅ |
| Console errors | 0 | **0** |
| **TOTAL** | **7/11** | **11/11** ✅ |

## 3. OTHER SUITES
- Physics suite (drift/cone/player/vehicle): ✅ PASS (post-fix re-run)
- Cloud CI Build+Smoke: running (v0.3.1) — last green on v0.3.0
- Local desktop smoke: ⚠️ sandbox 2GB RAM par renderer crash (environment issue — mobile QA + cloud CI cover it)

## 4. KNOWN LIMITS / NEXT (priority order)
1. **3D model detail (GTA-level)** — factory (Blender) pipeline se subdivision-smoothed, beveled, detailed bodies + normal-mapped surfaces. Note: 1M faces/model phone par 10-15 FPS dega; GTA-5 bhi ~100-300k tris/car use karta hai. Target = **1M jaisa LOOK, 60fps price**.
2. **"Tech-veh" Claude prompt** — user se dobara chahiye (paste karwana hai).
3. Movement further tuning — real-device feedback ke baad (camera, grip curves).
4. Icon AI-refs (5-6 options) — user pick kare.

---

## v0.3.2 — LOFTED v2 cars + cinematic grade (commit 7291e3b)

**Kya badla:** 5 vehicles ab REAL lofted surfaces hain (46 stations × 24-point superellipse
rings, wheel-arch carve, glass canopy, splitter/diffuser/lightbar/detail-kit) — bevel-box
khatam. In-game cinematic grade pass (contrast, split-tone, vignette, film-grain).

| Check | Result |
|---|---|
| Mobile QA | **11/11 PASS**, console errors 0 |
| Physics (gas/steer, game-time) | 33 kmh / 1.74 rad — PASS |
| Fire (tracer+flash+muzzle) | PASS (deterministic sampling) |
| CI Build+Smoke | SUCCESS |
| apk workflow | SUCCESS (5,362,999 B) |
| Heavy Parallel QA | SUCCESS |

**Is round ke fixes (QA ne pakde):**
1. Composer low-tier crawl — render-target ab drawing-buffer size par banta hai (pehle
   CSS size → emergency tier 4× overdraw).
2. VFX spawn-opacity — muzzle/impact/tracer ab spawn par hi opacity reset karte hain
   (pehle next-tick par set hoti thi → pehla frame invisible).
3. QA deterministic — physics/fire assertions ab game-time stepping se (SwiftShader
   rAF-jitter se immune).

**Known:** v2 GLB ~88KB/car (subsurf-1 export + HIGH-baked normals). Studio previews:
`factory/out/<car>_studio.png`.

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

---

## v0.4.0 — Golden Hour + Day-Night + Full Green City (commit 243201f)

**User ke choices (refs/quality-refs.jpg se):** Style **B — Golden Hour** + **day-night
cycle** + **full green city** (har sidewalk pe trees + bushes + grass).

| Check | Result |
|---|---|
| Mobile QA | **11/11 PASS**, console errors 0 |
| Car paint (TRUE colors) | velara-gt RED (0.66,0.04,0.055) — GLB factor verified |
| Foliage in-scene | 441 street + 21 park trees, 173 bushes, 375 tufts, 7 lawns (instanced) |
| Tree asset render | isolated test 18.9% green pixels |
| Day-night cycle | dusk(16:30) boot, clock chip live, 4 phases × 2.5 min |
| CI Build+Smoke / apk / Heavy QA | sab SUCCESS |

**Is round ke ROOT-CAUSE fixes:**
1. **BLACK-TEXTURE BUG (sab vehicles affected since v1):** Cycles headless bake
   silently black/magenta textures produce karta tha — normal/AO/rough sab — aur GLB
   mein embed ho jaate the (cars kaali dikhti thi!). FIX: poora bake pipeline hata;
   paint colors ab direct material + AO vertex-colors se (bake-free). Cars 88→68KB.
2. Foliage GLB trunk/canopy alag primitives — pehla-mesh grab sirf trunk deta;
   ab merge-with-groups.
3. Blender `--python` exception par exit-0 — workflow failed jobs "done" mark karta
   tha; ab scripts failure par sys.exit(1).
4. Duplicate clock system (static "23:40 · RAAT" placeholder + gameMinutes wala)
   hata — ab env-cycle-driven top-center chip.

**Bugs in factory scripts (round-2):** ico_sphere operator naam, Glass-mesh lookup,
dono fix + re-render 9 assets cloud par.

**Known:** cycle sirf gameplay ke da advance hota hai (menu/pause par frozen —
intentional). Emergency tier par foliage density half + tree shadows off.

---

## v0.5.0 — REMASTER: sim-physics + damage + police + hi-detail (commit 679b4d9)

**User directives:** sim-realistic physics (GTA-jaisa), progressive dent damage (image-match),
full police (wanted/chase/BUSTED, spikes/heli baad mein), GTA5-level detail (~500k ask).

| Check | Result |
|---|---|
| Mobile QA | **11/11 PASS**, console errors 0 |
| Crime → wanted | reportCrime(1) → wanted 1, stars "★" UI live |
| Car damage | wall-slam 14m/s → **damage 43.7** (dents + power-loss path) |
| GAS (game-time) | 27 kmh/3s (sim torque curve) · STEER 1.37 rad |
| Hi-detail cars | **102,092 tris/car** (NS64×MR36, subsurf-2, bake-free) |
| CI Build+Smoke / apk / Heavy QA | sab SUCCESS |

**Naya:**
1. **SIM PHYSICS** — torque curve (natural taper, hard governor khatam), brake-dive/
   throttle-squat weight transfer, per-wheel slip (cannon skidInfo) → skidmarks
   (instanced ring-buffer, fade), tyre smoke, screech audio hook.
2. **DAMAGE (GTA5-style progressive)** — collide impulse → vertex dent (contact point
   se car-center ki taraf, falloff smooth, normals recompute), 55%+ power loss, 88%+
   misfire, 72%+ engine smoke, HUD damage bar (speedo ke neeche).
3. **POLICE** — wanted 0-5 ★, crimes: firing (range ke bahar) / traffic-hit / police-ram;
   3 pursuit units max, steer-toward-player AI + stuck-respawn; BUSTED (slow+5.5m+2.5s)
   → fine ₹300 + respawn; evade decay (70m+ 12s → star kam). Lightbar strobe live.
4. **SMALL-OBJECT PHYSICS** — 17 cones + 6 bins (CANNON bodies, knockable).
5. **PLAYER** — momentum movement (accel 8 / stop-slide 4.5).
6. **FACTORY** — hi-detail re-render 5 cars (68KB→236KB, 25k→102k tris).

**Known:** night screenshots sandbox par nahi ban paate (SwiftShader OOM — game theek,
CI smoke green). Police steering-sign: +diff convention (A-key=left mapping se derived).
Concept refs: refs/remaster-damage.jpg, remaster-police.jpg, remaster-street-detail.jpg.

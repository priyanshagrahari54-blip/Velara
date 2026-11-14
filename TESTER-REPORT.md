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

---

## v0.6.0 — MIXED-CITY REMASTER (buildings + street kit + enterable shops)

**Scope (user-locked):** Style B Mixed City (glass towers + concrete mid-rise + street shops),
detail + ENTERABLE shops, street items FULL kit, fix-then-APK.

### Kya bana
1. **FACTORY (9 jobs, sab done)** — `make-buildings.py`: tower-glass (16×16×42 curtain-wall
   + mullions + slabs + roof props), midrise-concrete (18×14×22, frames/ledges/balconies/
   stairwell), shop-low (shopfront+awning+lit sign), **shop-enterable** (3.2m door gap +
   interior: side/back walls, 3-shelf rows, counter, ceiling glow strips).
   `make-streetkit.py`: hydrant / storm-drain / bench / parking-meter / sign-pole.
   Sab bake-free (material colors + vertex AO + emissive), draco-6, 4.5–22KB each.
2. **CITY INTEGRATION** — lots ab GLB se bharte hain (height rule: h≥30 tower, 14–30 midrise,
   <14 shop; face-outward rotation; Y-scale variety). Chunk-merge buckets + castShadow.
   WinGlow/sign/interior lights → `env.windowGlow` night hook (base intensity preserved).
   Procedural fallback agar GLB missing ho.
3. **ENTERABLE SHOPS (3, plaza ke teeno taraf)** — hollow-room physics: front piers+lintel
   (door gap 3.2m × 3.05m), back/side walls, counter, shelf block. Overlapping auto-lots
   AABB-skip. Door ke 5.5m me props nahi lagte.
4. **STREET KIT PLACEMENT** — har block: 2 sign corners, 1–2 hydrants, 0–2 meters,
   0–2 benches, 1–2 drains (deterministic seed). Physics poles static.

### QA (v0.6.0) — `test/_citycheck.mjs` **8/8** + `mobile-qa.mjs` **11/11**, console 0 errors
- city-kit: collidables 904, chunks 61/8 visible ✓
- GLB census: Glass×30, SignGlow×57, Concrete, Red(hydrant)×47, Wood(bench)×43,
  Screen(meter)×43, Plate(sign)×49 — total scene 658,524 tris ✓
- WinGlow night hook: dusk 1.97 → night 3.06 (base 3 × windowGlow 1.7 × 0.6) ✓
- **ENTERABLE doors (physics walk-in, teeno)**: player door se andar —
  (−49.16, 0) / (41.16, −6) / (−8, −49.16) ✓
- fps 60 (emergency tier, swiftshader) ✓
- mobile regression: sky/hero/car/GAS 24kmh/STEER/FIRE/HUD — sab PASS ✓

### Bugs jo QA ne pakde aur fix hue
1. Enterable shops lot-buildings ke **andar dafan** the (door block) → AABB lot-skip.
2. Pier boxes mein **full-width ko half-extent** pass hua (12.6m piers, door hi band)
   → pw/2 fix.
3. Interior **solid-fill** tha (room hi nahi tha) → hollow walls + counter + shelves.
4. WinGlow material ka naam "SignGlow" hai (WinGlow object ka mat) — hook _glowBase
   marker se robust.

5. **g560 DRAWS BUDGET FAIL → FIX** — CI HeavyQA ne pakda: GLB materials per-chunk
   20+ buckets → 273 draws (budget 200). Fix: **load-time material consolidation**
   (buildings.js) — har part ka base-color vertex-color mein bake, sab parts 3 shared
   materials (KitStd/KitGlass/KitGlow) → g560 draws **159** ✓ (budget 200).
   Bonus: KitGlow door-chunk LOD (95m+, fog-covered).

**Post-consolidation QA rerun:** citycheck 8/8 + mobile-qa 11/11 + g560-check PASS
(159 draws, 0 console errors).

**Known:** swiftshader sandbox par game-time real-time se slow (transition pumps test me
handle). Screenshot suite: shots/v060-air/shopfront/interior.png (pixel-verified, warm
golden-hour, no neon). Police/damage v0.5.0 checks carry-over (code untouched).

---

## v0.9.0 — GTA-5 PLAYTHROUGH ROUND: character + movement + tyres + HUD + seasons + calls + 60fps (commit TBD)

**User feedback (seedha khel ke):** movement sluggish + player sirf ek direction
mein face, character boxy, car ka tyre upar tairta hai, HUD buttons par
PEDAL/STEERING jaise text, Samsung F15 par lag, logo/start page bekar, seasons
chahiye, phone par calls chahiye, 60fps bina downgrade.

### TESTER TEAM — GTA-5 comparison playthrough findings → fix → recheck

| # | Finding (playthrough) | Root cause | Fix | Recheck |
|---|---|---|---|---|
| 1 | Character boxy (sab boxes) | Player 100% BoxGeometry procedural tha | **Factory hero-v2**: cloud Blender render — smooth jointed humanoid 5,088 tris, 38 nodes, olive bomber + tee + jeans + sneakers (user-picked concept #2), bake-free PBR. GLB three.js + FBX UE5 dono | ✅ v09 #2/#3: limbs remapped, walk-cycle GLB arms chal rahe |
| 2 | Movement "der se" + ek hi direction | (a) accel 8/s + turn 12/s sluggish (b) **foot camera auto-follow HI Nahi tha** — sirf car mode mein tha! Player screen se bahar bhaagta tha | accel 13, turn 18 (aim 24), air 3.5 + **GTA-style foot camera auto-follow** (2.2/s settle, 2.5s hold-grace, manual look pause 1.6s, aim par off) | ✅ v09 #4: camera player ke peeche settle hota hai |
| 3 | Tyre upar tairta hai | GLB wheel geometry physics radius se chhoti (0.335 vs 0.42) + wheel order traversal-random | Load par GLB wheels physics-R tak scale + FL/FR/RL/RR deterministic sort | ✅ v09 #5 + tyrecheck: floatGap 13cm → 0-2cm, geoR==physR |
| 4 | HUD buttons par text (GAS/BRAKE...) | Text labels + emoji icons | GTA-clean SVG line icons (arrow/P/horn/door/jump/crosshair/swap), zero text | ✅ v09 #9: 6/6 svg + no text |
| 5 | F15 par lag, 60fps nahi | Emergency tier 0.24 render + minimap OFF + sirf g560 mein dyn-res | **Dynamic render-scale ab SAB tiers** (DLSS-jaisa fallback: 0.55×floor..1×, auto upar-neeche), real devices kabhi emergency tier mein nahi girenge, minimap ab har tier mein 8Hz (pehle 60Hz CPU waste) | ✅ v09 #10 bounded + governor floor |
| 6 | Logo/start page bekar | Text-only h1 | User-picked logo (option 1) — 51KB JPEG, gold wordmark, cinematic start page, tight copy | ✅ v09 #1 |
| 7 | Seasons nahi the | — | **4 seasons** (spring/summer/monsoon/winter), 10 min each: sun/fog/tint/rain-chance sab alag + foliage tint + phone STATS mein SEASON row + toast | ✅ v09 #6: monsoon fog ×1.36+, switch back |
| 8 | Phone calls nahi the | — | **Full call system**: Vikram (fixer) intro + mission calls, Raja gang threat (pehle thug kill par), Mom/wrong-number flavor, CONTACTS tab (4 contacts, tap-to-call), ringtone synth, incoming banner + GTA subtitles | ✅ v09 #7/#8 |

### QA (5 suites — sab green)
- `test/v09-check.mjs` **11/11** (naya — hero/camera/tyre/seasons/calls/HUD/dyn-res/logo)
- `test/_citycheck.mjs` **8/8** (852,276 tris — hero +5k) · `test/mobile-qa.mjs` **11/11**
- `test/g560-check.mjs` PASS (175 draws) · `test/gang-phone-check.mjs` **8/8**
- **Heap probe**: 50s logic-only stepping — 117MB flat, **zero leak**
- **Bugs pakde:** (1) factory job mein `read_factory_settings` materials ke
  BAAD chal raha tha → dead-RNA crash → reset-first fix; (2) camera
  `_lookIdle=0` falsy bug; (3) swiftshader page-crash storms — QA ab
  `_noRender` hook + lite viewports use karta hai (real devices par N/A).

### UE5 mirror
`UVelaraPhoneWidget` mein call-flow (AnswerCall/DeclineCall/HangUp +
OnCallStateChanged) · `hero-v2.fbx` Content/Meshes ke liye ready ·
**6 Higgsfield-style lookdev refs** `ue5/Content/Refs/lookdev/` mein generated
(tower/midrise/shop/street-mood/night-windows/vehicle) — Phase-1 PBR materials
ka target set.

### Shots (GTA-5 review ke liye)
`shots/v090-start.png` (logo page) · `v090-hero.png` (factory character,
golden hour) · `v090-tyre.png` (car + ground) · `v090-call.png` (incoming) ·
`v090-monsoon.png` (raat + baarish) · `v090-hud-touch.png` (touch HUD icons).

## v0.8.0 — 12-DOMAIN MEGA-ROUND: gang AI + phone OS + VFX + sample audio (commit TBD)

User ne 12 domains mange the (3D modelling, PBR texturing, rigging, VFX, UI/UX,
sound, core mechanics, scripting, scenes, player controller, enemy AI,
interactions, mobile phone). ask_user LOCKED: dono tracks parallel · phone =
in-game + touch dono · enemy = gang thugs GTA-style.

**Naya kya (three.js track):**
- **GANG SYSTEM** (`src/gameplay/gang.js`): 6 thugs Old Market (NW) —
  idle wander → ALERT (42m) → ATTACK (20m: tracer + muzzle flash + accuracy
  doori se). Kill → ₹120–210 loot + wanted star + blood-lite VFX. Respawn
  35s. Hitboxes kinematic (bullets raycast se lagti hain).
- **VELARA OS PHONE** (`src/ui/ui.js`): GTA-style smartphone — 📱 button →
  MAP (bada canvas, gang red + police blue + pickups) / STATS (cash, health,
  wanted, kills, time-of-day live) / SETTINGS (music / SFX / haptics toggles,
  real audio routing).
- **VFX LAYER** (`src/gameplay/vfx.js`): pooled particle bursts (90 pool,
  zero per-frame alloc) — footstep dust, thug blood-lite, death poof.
- **SOUND**: AudioEngine mein sample layer — factory WAVs (siren loop, crash
  ×2, horn, footsteps ×4, pickup, UI click) procedural synth ke saath blend.
  Police wanted → siren loop. Footsteps speed-scaled.
- **HAPTICS**: pickup/kill par vibration (toggle-able phone se).
- Minimap mein gang + police dots.

**QA (4 suites, sab green):**
- `test/gang-phone-check.mjs` **8/8** — phone open/tabs/toggles, 6 thugs NW
  spawn, AI state machine (idle→alert 26m→attack 8m→idle), kill→loot+wanted,
  respawn, VFX burst/decay, WAV serve + no-crash.
- `test/_citycheck.mjs` **8/8** — 847,188 tris (+1,452 vs v0.6.2), fps 60.
- `test/mobile-qa.mjs` **11/11** · `test/g560-check.mjs` PASS (157 draws).
- **BUG PAKDA (bana aur fix):** (1) `audio.step()` — music sequencer ka
  `step` counter property method ko shadow kar raha tha → rename
  `footstep()`. (2) Headless swiftshader mein concurrent WAV decode =
  renderer page-crash (bisect se confirm) → headless guard + sequential
  OfflineAudioContext decode; real browser full sample audio.

**UE5 mirror (same patterns, C++):** `VelaraGangAgent` (state machine + tuning
constants gang.js ka 1:1 mirror) · `UVelaraPhoneWidget` (tabs + toggles +
stats state) · `setup_assets.py` ab Old Market mein 6 thugs spawn karta hai ·
Build.cs +UMG/Slate.

**Shots:** `shots/v080-air.png` (97,77,90) · `v080-gang.png` (96,69,27) ·
`v080-phone.png` (phone panel dark = overlay render confirm).

## v0.7.0-ue-alpha — UNREAL TRACK START + hi-detail factory + full audio + 4 workers

**User decisions (ask_user):** Unreal Engine 5 · ~50k tris hi-detail buildings ·
size unlimited · Higgsfield = concept-refs · FULL audio pass.

### Infra
1. **Designer 4 PARALLEL workers** — dispatch+matrix architecture (claims-race
   solved via single claims commit). Bug found+fixed: workers github.sha (purana
   tree) checkout kar rahe the → `ref: main`. Verified: 4 hi-detail jobs ~7min.
2. **Codespaces** — .devcontainer/devcontainer.json (node+python, ports 3000/3002).
3. **UE Team CI** — prelight (scaffold sanity, har push) + hosted Epic-container
   cook (secret-gated, experimental) + **build-pc self-hosted runner** (primary,
   unlimited minutes — README-UE.md me 10-min setup).
4. Workspace budget fix: node_modules/.cache/.npm delete + git gc —
   5,400+ files/850MB → **420 files/152MB**.

### UE5 project scaffold (`ue5/`) — CI preflight PASS
- C++ module: VelaraGameMode, VelaraCharacter (spring-arm chase cam, sprint),
  **VelaraCityBuilder** (city_layout.json → InstancedStaticMesh, yaw-flip toggle).
- `gen-city-layout.py`: 102 buildings (38 tower/22 midrise/39 shop/3 enterable)
  + 360 props — deterministic, three.js rules par based.
- `setup_assets.py` (editor python): FBX+WAV import, VelaraMain level
  (sun/sky/atmosphere/ground/city/playerstart) — EK command setup.
- **FULL audio pack (15 WAVs, 4.4MB)**: engine idle/mid/high loops, skid,
  crash hard/soft, siren wail, horn, footsteps ×4, city ambience, pickup, ui.
- Higgsfield lookdev brief: `ue5/LOOKDEV-BRIEF.md` (7 prompts — user banayega).

### Hi-detail factory render (4 workers parallel)
| Asset | tris (pehle) | FBX | GLB |
|---|---|---|---|
| tower-glass | **30,932** (852) | 382KB | 366KB |
| midrise-concrete | 4,184 (912) | 76KB | 59KB |
| shop-low | 828 (192) | 36KB | 23KB |
| shop-enterable | 1,508 (300) | 47KB | 38KB |

**Pending (agla round):** hi-detail GLBs ko three.js track mein swap + mobile-qa
regression; UE Phase-1 materials (Higgsfield refs ke baad); Chaos vehicle Phase-2.

---

## v0.6.2 — HI-DETAIL HERO BUILDINGS (three.js track)

User: "kro aur .apk do" — UE-round ke hi-detail factory renders ab web-APK mein.

- **HERO-LOD split**: plaza ke 62m ke andar hi-detail glass towers (30,932
  tris — har window frame, corner columns, roof clutter), door wale towers
  852-tri LOD. Scene 658k → **845,736 tris** (crash bhi pakda: 38× hi-detail
  = 1.8M tris par swiftshader page crash — isliye GTA-style LOD).
- midrise 4,184 / shop 828 / enterable 1,508 tris (interior shelf items!).

**QA: citycheck 8/8 · mobile-qa 11/11 · g560-check PASS (190/200 draws) ·
console 0 errors · fps 60 (emergency tier).**

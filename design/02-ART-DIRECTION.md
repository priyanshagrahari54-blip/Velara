# VELARA — Art Direction (v0.2)

## Visual Targets (SOURCE OF TRUTH)
Approved concept boards — `references/` folder:
1. `city_world.jpg` — rain-slicked downtown, neon reflections, volumetric fog
2. `main_character.jpg` — hero: leather jacket over hoodie, streetwear
3. `hero_vehicle.jpg` — widebody coupe, glossy dark paint, LED lights

> Har visual pass ka benchmark yehi 3 images hain. Naya art asset in se
> mood/color/language match kare.

## Visual Language
- **Palette:** midnight blues (#0a111e), neon cyan (#35e0ff), magenta (#ff3fd8),
  amber sodium lamps (#ffd9a0), rain-gray asphalt (#1b1d21)
- **Lighting:** single moon/sun key + emissive city (windows, signs, lamps);
  ACES tonemapping; bloom unites emissives (UnrealBloomPass)
- **Materials:** wet-asphalt = low roughness + envMap on rain; car paint =
  clearcoat + metalness; glass = dark + sharp reflections
- **Mood:** raat > shaam > din (default raat — game identity)

## Current vs Target — Gap Analysis
| Area | Abhi | Target | Phase |
|---|---|---|---|
| Post FX | ACES + bloom ✅ | + SSAO, vignette, film grain | 2 |
| Reflections | env-map based ✅ | SSR on wet roads | 2 |
| Characters | stylized primitives | skinned + better materials | 3 |
| City detail | window/lighting language ✅ | decals, clutter, LOD tiers | 2-3 |
| Weather | rain particles + wet mats ✅ | puddle mask, lightning | 2 |

## Asset Rules
- Texture space: canvas-generated PBR-ish maps, 512² max default
- Emissives hamesha `env.windowGlow`/`lampIntensity` se gated (din mein dim)
- Neon signs: bilingual (Latin + Devanagari) — shehar ki identity

## Change Log
- **[DECIDED] Style B — GOLDEN HOUR** (user-approved via style board, 5 options): GTA5-style
  sunset — warm orange haze, low sun, long shadows. Dusk preset retuned, game boots at 17:35
  with cinematic transition. Sky A/night still available via N key cycle.
- Visual pass v1 shipped: photo textures (asphalt/facade/concrete), emissive windows.
- Naming internationalized: Velara GT / Titan RS / Pico S / Colossus V; Vyper .45 / Hornet SMG / Mammoth 12G.
- 3-build system: `package:win [--profile g560]` → PROFILE file read by desktop launcher.
- HUD locked: Cinematic Minimal (user pick) — circular minimap bottom-left, ghost-text mission/speed/weapon, no panels.
- Deep golden-hour pass: low sun (long shadows), amber haze, sun flare sprite, warm vignette grade. Screenshot: references/GOLDEN-HOUR-NOW.png
- Cleanup: normal zip deleted (180MB budget), only G560 build kept. Mission banner auto-dims 5s. Hero car: raked windshield/canopy, mirrors, splitter, exhausts.

## Visual Pass v3 — De-Box the Skyline (2026-11-10)
- Buildings: plain box -> podium (street-retail, glowing storefronts, 3 awning variants) + tower tiers with setbacks + cornice slabs on tall ones.
- Rooftops: parapet rims, water tanks, AC units, access huts, vent pipes, antenna masts (bodyH>48) with aviation beacons.
- Residential variants (1/3): per-floor balconies with rails on front/back faces.
- Corner pilasters on main tier for vertical rhythm.
- All sub-details merged per building via BufferGeometryUtils (vertex colors, 1 shared material) -> single extra draw call per building (G560-safe).
- Physics: podium + tier boxes (2-3 static boxes per building); block loop now fully seeded (ADR-007) — deterministic city.
- Center towers taller (up to ~84m) for skyline drama. Smoke: 0 errors. Screenshot: references/CITY-V2.png.

## Performance Pass — G560 Max-Speed Tier + Camera Fix (2026-11-10)
- New quality tier `g560`: pixelRatio 0.55 (render 55% res), shadows 256/off, no AA (renderer flag at boot), maxLights 8 (street/neon point lights 28->8), distant skyline hidden. Reached via ?profile=g560 OR auto-downgrade when FPS<30 even on low.
- Camera: intro fly-in 3.2s/30m-high -> 2.4s/11m (ground-level swoop), car yaw follow 4.2->6.5/s (snappier), mouse-offset recenter 1.4->2.2/s.
- city.setPerf() perf switch wired into QualityManager onChange; QA ?qa=1 still boots low (full layout).
- Tests: smoke 0 errors (full chain M1-M5); test/g560-check.mjs PASSED (tier/pixelRatio/lights/skyline/camY). Screenshot: references/GROUND-CAM.png.

## World Expansion — Districts + Metro + Signals (2026-11-11)
- City 5x5 → 7x7 (span 276m → 424m): core unchanged (missions/spawn safe), ring = 4 districts.
- Districts: Old Market (low shops + stalls + parked autos, NW/N), Riverside (water + palm promenade, S), Highway + elevated Metro (E), Downtown ring (34-64m glass towers).
- Elevated metro: guideway + pillars over east highway, VELARA CENTRAL station, 4-car train with blue underglow (Image-1 signature), loops ±172m.
- Traffic signals: 4 inner intersections, 8s green/2s amber per axis, canvas-texture heads (3 draw calls total), traffic AI stops at red. Zebra crossings merged (1 draw).
- Chunk streaming: block-level chunk groups, visibility by focus distance; viewDist per tier (260/200/150/120). No loading screens.
- Billboards: VELARA / AURORA / KAZE TECHNOLOGIES on highway towers. Bus stops x3.
- Physics engine decision: KEEP cannon-es (tested; Rapier rewrite = high risk, low user value). Approach: upgrade existing (user-locked). Theme: mixed districts (user-locked).
- Smoke: 0 errors, 15 steps (new: world step — chunks 61/43 visible, metro moving, signals cycling).

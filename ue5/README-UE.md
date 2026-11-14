# VELARA — Unreal Engine 5 Track (v0.7-alpha)

User decision (2026-11-10): **Unreal Engine 5** pivot — AAA visuals, unlimited
APK size, hi-detail (50k-class) buildings, full audio. Ye folder UE project hai.

## Quick start (tumhare PC par — 15 min)

1. **Epic Games Launcher** install → Unreal Engine **5.5+** install (free).
2. Repo clone/pull: `git pull origin main`
3. `ue5/VelaraUE.uproject` double-click → first open me C++ compile hoga
   (Visual Studio 2022 + "Game development with C++" workload chahiye).
4. Editor mein: **Tools > Execute Python Script** >
   `ue5/Content/Python/setup_assets.py` — ye FBX meshes + sounds import
   karke `VelaraMain` level bana dega (sun/sky/ground/city/player start).
5. **Play** dabao — WASD + mouse, Shift = sprint, Space = jump.
6. Android APK: **Platforms > Android > Package** (ya niche CI wala raasta).

## Apna PC build-server banao (self-hosted runner — 10 min, 24/7 team)

GitHub repo > Settings > Actions > Runners > New self-hosted runner (Windows)
> commands follow karo > label `unreal` add karo. Bas — ab `UE Team` workflow
dispatch karo (`build-pc` job) aur APK tumhare PC par cook hoke artifact ban
jayegi. Minutes unlimited, free. (Fork-PR security: repo public hai —
"Require approval for all outside contributors" ON rakho.)

## Kya ready hai

| Cheez | Status |
|---|---|
| C++ module (GameMode, Character w/ chase-cam, CityBuilder) | ✅ |
| City layout JSON (102 buildings + 360 props, deterministic) | ✅ `gen-city-layout.py` |
| Hi-detail FBX buildings (factory, 4 parallel workers) | 🔄 cloud render |
| Full audio pack (15 WAVs — engine/skid/crash/siren/footsteps/ambience) | ✅ |
| Materials/look pass | ⏳ Higgsfield look-dev ke baad |
| Chaos vehicle (car driving) | ⏳ Phase-2 |
| Police/damage systems | ⏳ Phase-3 |
| Android packaging CI | ✅ hosted+PC dono raaste |

## Roadmap (UE-track)

- **Phase 0 (abhi):** scaffold + assets + level — ✅ is commit me
- **Phase 1:** materials pass (Higgsfield refs ke baad), skeletal hero,
  touch controls (EnhancedInput + widgets)
- **Phase 2:** Chaos vehicle — GTA-style driving, camera modes
- **Phase 3:** police wanted system, damage, weapons
- **Phase 4:** day-night (skyphere + lighting scenarios), audio components
  wiring (engine RPM, siren doppler, ambience bed)
- **Phase 5:** packaging polish (ASTC, LODs, Nanite desktop exe bhi)

## Notes

- three.js wala game (`src/`) abhi bhi live hai (v0.6.0, 6MB APK) — parallel
  track, jab UE version usse cross karega tab archive.
- Factory FBX: `factory/out/*.fbx` (designer workflow renders). GLB bhi bante
  hain (three.js track ke liye).
- CityBuilder yaw agar ulta lage: actor select karke `bFlipYaw` toggle.

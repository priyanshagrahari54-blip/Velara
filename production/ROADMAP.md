# Production Roadmap — v2 (Grand Vision Edition)

> **North Star:** GTA6-level detail ka target — har choti se choti cheez
> polished, sab kuch hamesha tested. AAA games se inspiration:
> **GTA5** (3 protagonists + heists) · **RDR2** (world simulation, physics
> detail) · **Black Myth: Wukong** (visual fidelity, boss encounters) ·
> **Wolverine** (brutal, weighty combat) · **Money Heist / cyber-thrillers**
> (mission design).

## Phase 0 — Playable Prototype ✅ (DONE)
City + car + player + physics + 3 missions + traffic + audio. 0-error QA gate.

## Phase 1 — Professional Vertical Slice ✅ (DONE — v0.2 released)
- [x] CCGS-pattern studio structure (AGENTS/rules/skills/docs)
- [x] Module boundaries: engine/world/gameplay/core split
- [x] QualityManager (3 tiers + FPS auto-scaler)
- [x] PostFX: ACES + UnrealBloom
- [x] Speed governor + world bounds + blow-up clamps (ADR-005)
- [x] CSP + offline guarantee + Electron hardening
- [x] **Win7 x86 (32-bit) + x64 desktop builds** — no content downgrade
- [x] Fatal-error guard (WebGL2 missing → friendly screen / safe-mode)

## Phase 2 — Combat & Visual Fidelity ⏸ (APPROVED — user ne "baad me" bola)
*Combat tone: HARDCORE REALISTIC (decided). Dono tracks ek saath.*
- [ ] Pistol v1: OTS aim (RMB), recoil pattern + spread growth, 12-rnd mag,
      reload timing, tracers, muzzle flash light
- [ ] Hardcore health: slow regen (delay + rate), damage direction indicator
- [ ] Police v1: wanted stars, chase cars, escape timer, minimap dots
- [ ] Shooting range targets @ stunt plaza + M4 "Combat Trial"
- [ ] Visual pass 1: SSAO (high tier), vignette, rain puddles (reflective
      mask), asphalt/facade material detail
- Acceptance: 0 errors, high tier 60 FPS, M4 playable, police escape loop fun

## Phase 3 — Three Characters (GTA5-style) + Signature Missions
*Detail: `design/03-CHARACTERS-MISSIONS.md` (DRAFT — approval pending)*
- [ ] Playable trio: **VEER** (ex-cop brawler), **JHANKAR** (hacker),
      **RUHI** (getaway driver) — unique ability + walk/anim/idle per char
- [ ] Character switch wheel (hold Tab) — GTA5 signature feel
- [ ] Mission bank (movie-inspired, unique twists — see design doc):
      "Royal Mint of Velara" heist, "Ghost Signal" city-blackout hack,
      informant/police sting arc, underground fight pit (Wukong-style boss)
- [ ] Character-switch set-pieces: mid-mission switch (driver ↔ shooter ↔ hacker overlay)
- [ ] Wanted/heist economy: crew cuts, upgrades, safehouse
- Acceptance: 3 chars feel different in 10 min play; 1 heist playable start-to-end

## Phase 4 — Android & Mobile Excellence
- [ ] PWA (installable, offline) + Capacitor APK build pipeline
- [ ] Mobile GPU tiers (Adreno/Mali auto-detect), battery-saver 30fps mode
- [ ] Touch-first UI revamp: context buttons, gyro aim option
- [ ] Asset streaming + memory budgets (1.5GB devices)
- Acceptance: mid-range Android pe 30+ FPS, full mission chain playable

## Phase 5 — Living World (RDR2-sim depth)
- [ ] Pedestrians: crowds, daily schedule, flee/react to gunfire
- [ ] Traffic v2: lanes, junction logic, panic driving during wanted
- [ ] Interiors: shops, safehouse (save/load), weapon shop
- [ ] Wildlife/pets easter eggs, district personality (old city vs cyber zone)
- Acceptance: 15-min wander bina repeat feel

## Phase 6 — Polish & Ship
- [ ] Icon, installer, settings menu (graphics/audio/sensitivity/keys)
- [ ] Localization (hi/en), accessibility (remap, colorblind)
- [ ] Save system (localStorage → file in desktop), stats screen

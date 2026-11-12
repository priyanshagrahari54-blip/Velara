# 🏆 VELARA — AAA Playbook (11 areas × hum kahan hain)

> **Master mapping:** industry pipeline (jo tumne bheja) → Velara ka status → kaun karega → kab.
> **Owners:** 🎨 Design team · 🧪 QA team · 🔧 Dev team · 🗺️ Planner · 👔 DM (assistant) · 🎵 Sound team (nayi)
> **Rule:** har nayi cheez pehle PLAYBOOK mein slot leti hai, phir queue — adhoc nahi.

## 1. Pre-production
| Cheez | Status | Notes |
|---|---|---|
| GDD | ✅ | **docs/01-GDD.md** (loop, pillars, economy, controls) |
| Pillars | ✅ | 5 pillars — P1 grounded, P2 zinda shehar, P3 rain+neon, P4 sab par chale, P5 CC0 |
| Art bible | ✅ | design/02-ART-DIRECTION.md + winner board `style-A-neon-noir.jpg` |
| Tech spec | ✅ | **docs/02-TECH-SPEC.md** (platforms, FPS, budgets) |
| Greybox | ✅ | Phase-0/1 boxes — gameplay pehle feel hua |
| Vertical slice | ✅ | Phase-1 (drive+shoot+missions+traffic+peds) live, QA 22/22 |

## 2. Art pipeline (ek asset ka safar)
| Step | Status | Hum kaise |
|---|---|---|
| Concept art | ✅ | AI gallery (6 options → user choose) — `factory/in/concepts/` |
| Blockout | ✅ | make-*.py parametric dims pehle |
| High-poly + sculpt | ✅ | Blender subsurf/bevel high-poly source |
| Retopo (game mesh) | ✅ | LOW mesh ~1.2k tris export |
| UV unwrap | ✅ | smart-project auto |
| Baking (normal/AO) | ✅ | HIGH→LOW Cycles bake 1024px |
| PBR texturing | 🟡 | procedural (noise wear, tinted AO) — Substance-class hand-paint ❌ abhi nahi (CC0-self-made constraint) |
| LODs | ❌ **Phase-3** | LOD1/LOD2 factory mein decimate se + three.js LOD switch |
| Collision mesh | 🟡 | cannon boxes auto — separate convex mesh Phase-3 |
| Engine import | ✅ | Draco GLB + verify-glb + budget guard |

**Environment art:** modular kits 🟡 (facades/chunks), trim sheets ❌, decals ❌ Phase-3,
vertex-blend 🟡 (peds/roads), foliage ❌ Phase-3 (SpeedTree-style nahi — procedural low-poly),
terrain ❌ (flat grid + bridges), set-dressing 🟡 (streetlamps, neon-sign abhi — Wave-1 badhega).

## 3. Lighting + rendering
| Feature | Status |
|---|---|
| Bloom (neon glow) | ✅ UnrealBloom (high tiers) |
| Tone mapping | ✅ ACES filmic + exposure |
| Shadows | ✅ PCFSoft (tier-scaled) |
| Emissive + glow | ✅ signs, lights, lightbars |
| Fog/atmosphere | 🟡 basic fog — volumetric ❌ Phase-5 |
| GI (bounce light) | ❌ Phase-5 — lightmap-bake probes ka plan |
| SSR / reflections | ❌ Phase-5 — cubemap probes pehle |
| Wet surfaces | 🟡 rain mode + roughness — puddle masks Phase-3 |
| Colour grading (LUT) | ❌ Phase-5 |
| Upscaling | 🟡 dynamic-res (0.24-1.0) — TAA/DLSS nahi (WebGL) |

## 4. Open-world technology
| Feature | Status |
|---|---|
| World streaming (chunks) | ✅ chunkStats visible/total |
| Frustum culling | ✅ three.js auto |
| Distance/detail culling | ✅ detailLod, skyline hide, viewDist tiers |
| Occlusion culling | ❌ Phase-4 |
| Instancing/batching | ✅ static merge buckets (roads 16→1), vertex-color peds |
| HLOD (door ka merged) | 🟡 skyline boxes — proper HLOD Phase-4 |
| Memory budgets | ✅ 180MB repo + per-GLB guard + F3 heap readout |
| Procedural gen | ✅ city grid/roads/facades code se |
| Perf budgets | ✅ ≤200 draws guard (155), 16.6ms frame budget F3 live |

## 5. Physics + vehicles
| Feature | Status |
|---|---|
| Rigid bodies + sleeping | ✅ cannon-es |
| Vehicle (suspension, wheels) | ✅ raycast-vehicle, 4 wheelInfos |
| Weight transfer | ✅ brake pe pitch feel |
| Tyre grip model | 🟡 friction-based — Pacejka-style slip Phase-3 |
| Handbrake/drift | ✅ |
| Surface types (wet grip) | 🟡 rain roughness — grip change Phase-3 |
| Damage/deformation | ❌ Phase-3 (detachable parts pehle) |
| Fixed timestep | ✅ 1/60 manual stepping |
| Camera (collision, FOV) | ✅ rig + cycle; speed-FOV Phase-3 |

## 6. Animation
| Feature | Status |
|---|---|
| Wheels spin | ✅ named WheelFL.. nodes |
| Character anim (walk/run) | ❌ **Phase-4** — procedural low-poly rig |
| State machine | ❌ Phase-4 |
| IK | ❌ Phase-4+ |
| Mocap/face | ❌ out of scope (indie-web) |

## 7. AI systems
| Feature | Status |
|---|---|
| Traffic (lane, signal, flee) | ✅ |
| Pedestrians (walk, panic, knockdown) | ✅ |
| Pathfinding (navmesh) | ❌ Phase-3 (grid A* pehle) |
| **Police / wanted system** | ❌ **Phase-3 — user chaaha (police car concept chuna hai)** |
| Perception (sight/hearing) | 🟡 gunfire-panic abhi |
| Crowd sim / schedules | ❌ Phase-4 |
| Dynamic events | 🟡 metro + rain — random incidents Phase-4 |

## 8. Audio 🎵 (nayi team approved)
| Feature | Status |
|---|---|
| Engine + skid (procedural) | ✅ WebAudio |
| SFX library (siren, gunshot, pickup, horn, impact, rain loop) | 🔜 **is saptah** — make-sound.py (numpy→WAV, CC0) |
| 3D positional audio | 🟡 Phase-3 (panner) |
| Reverb zones | ❌ Phase-4 |
| Adaptive music (chase/calm) | ❌ Phase-4 |
| Radio stations | ❌ Phase-5 |
| Voice acting | ❌ out of scope |

## 9. UI/UX
| Feature | Status |
|---|---|
| HUD (minimap, speedo, ammo, money, mission) | ✅ — winner: hud-A-minimal |
| Pause + start screens | ✅ |
| Hints/onboarding | ✅ setHint |
| Menus (map/settings) | 🟡 Phase-3 |
| Accessibility (subtitles, remap, colour-blind) | ❌ Phase-4 |
| Mobile/touch layouts | 🟡 touch live — polish Phase-4 |

## 10. Gameplay + content
| Feature | Status |
|---|---|
| Core loop | ✅ drive→mission→money |
| Mission structure | 🟡 5 linear — checkpoints/fail-retry Phase-3 |
| Side content (races, collectibles, jobs) | 🟡 pickups+plates — races Phase-3 |
| Economy | 🟡 earn-only — sinks (garage) Phase-3 |
| Narrative | ❌ Phase-5 (Story team offer pending) |
| Playtesting | ✅ QA 22-step 6-hourly + user hardware tests |

## 11. Engineering + tools
| Feature | Status |
|---|---|
| Version control | ✅ git + GitHub (protected token flow) |
| Build pipeline | ✅ Actions (CI/QA/designer) + Win packaging |
| Asset pipeline (import, compress, validate) | ✅ Draco + verify-glb + budget guards |
| Profiling | ✅ F3 (draws/tris/heap/GPU/chunks) |
| Debug tools | ✅ ?qa=1, ?profile=g560, free-teleport tests |
| Automated testing | ✅✅ smoke 15 + e2e 22 + g560 guard |
| Data-driven design | 🟡 queue JSON ✅ — missions/vehicles JSON Phase-3 |
| Telemetry | ❌ Phase-5 (local opt-in) |

---

## Roadmap (phases)
| Phase | Focus | Status |
|---|---|---|
| 1 | Vertical slice (drive/shoot/missions/world v1) | ✅ DONE |
| **2** | **World Expansion (Wave-1 props + areas) + Sound team + G560 verify** | 🔴 ACTIVE |
| 3 | LODs + Police/wanted + damage + races + menus + JSON-driven missions | ⏳ |
| 4 | Characters/animation + occlusion + HLOD + accessibility + touch polish | ⏳ |
| 5 | GI probes + reflections + LUT + adaptive music + story + telemetry | ⏳ |

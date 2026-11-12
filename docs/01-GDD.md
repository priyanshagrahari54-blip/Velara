# 🎮 VELARA — Game Design Document (GDD)

> **Version 0.2 · Nov 2026 · Owner: Planner team · Status: APPROVED (Phase-1 live)**

## 1. Elevator pitch
**VELARA — City of Shadows:** rain-soaked neon metropolis mein open-world action-driving.
Har crash, drift aur bullet **real physics** se chalta hai. Web mein khulta hai, 2010 ke
laptop (G560) se lekar modern desktop tak chalta hai — aur Windows 7 ka .exe bhi hai.

## 2. Pillars (har faisla inse hota hai)
| # | Pillar | Matlab |
|---|--------|--------|
| P1 | **Heavy, grounded feel** | Gaadi wazeen lage, crash mein dard dikhe, drift mein tyre chikhe — sab physics se |
| P2 | **Shehar zinda lage** | Traffic signals maane, peds bhaage, metro chale, din-raat badle |
| P3 | **Rain + neon mood** | Neon-noir raat, geeli sadkein, glow — art direction ka dil |
| P4 | **Sab par chale** | G560 (2010, 32-bit Win7) se modern tak — 60fps ka waada, emergency mode ke saath |
| P5 | **100% self-made, CC0** | Koi licensed cheez nahi — har asset humari factory ka, licence-free hamesha |

## 3. Core loop (baar-baar kya karna hai)
```
  DRIVE / EXPLORE  →  MISSION (deliver / speed-run / stunt)  →  PAISA  →  NAYA AREA/ASSET UNLOCK  →  repeat
```
- **Meta loop:** har phase mein shehar badhta hai (naya district, naye vehicles, naye props) — 24/7 design team banati rehti hai.

## 4. Progression + Economy
- Mission chain (5 live): spawn → pickups collect → speed run → stunt plaza → free-roam.
- Paisa: pickups (₹5,000 total) + mission rewards. Kharch: **Phase-3** — garage, vehicle unlocks, paint shop.
- Inflation-free: single-player, sink-only economy (koi market nahi).

## 5. Controls
| Input | Kaam |
|---|---|
| WASD / Arrows | Walk / Drive |
| Shift | Sprint |
| Space | Jump / Handbrake (car) |
| E | Vehicle in/out |
| LMB / RMB | Fire / Aim |
| 1 2 3 / Q | Weapon select / cycle |
| K / N / M / C | Quality / Time-cycle / Music / Camera distance |
| R | Reload (foot) / Rain (car) |
| F3 / P | Debug overlay / Pause |
| Mobile + Gamepad | Touch controls live; gamepad mapping Phase-4 |

## 6. Systems summary
| System | Abhi | Source |
|---|---|---|
| Physics | cannon-es rigid bodies + raycast-vehicle (suspension, weight transfer) | src/engine/physics.js |
| Traffic AI | lane-follow, signal obey, flee on gunfire | src/world/traffic.js |
| Pedestrians | sidewalk walk, panic, knockdown | src/world/pedestrians.js |
| City | 7×7 grid, chunk streaming, metro, facades | src/world/city.js |
| Day/night + rain | time cycle + rain mode | src/core/game.js |
| Audio | procedural engine + skid (WebAudio) | src/audio/audio.js |
| HUD | minimap, speedo, ammo, money, mission, hints | src/ui/ui.js |
| Quality | 5 tiers (emergency→high) + auto-governor | src/engine/quality.js |
| Assets | Blender factory, Draco GLB, ≤1.5MB guard | factory/ |
| QA | 22-step e2e (6-hourly) + smoke (har push) | test/ |

## 7. Out of scope (kya NAHI karna)
- Multiplayer / online · Unreal-jaisi fidelity ka dawa · licensed gaadi/IP · voice acting (abhi)
- Koi bhi asset jo CC0 ya self-made na ho (ASSETS.md rule)

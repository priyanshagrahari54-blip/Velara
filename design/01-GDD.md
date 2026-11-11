# VELARA — Game Design Document (v0.2)

> **Design Pillars** (har feature in 3 se judna chahiye):
> 1. **Physics Sab Kuch Hai** — duniya rules se chalti hai, scripts se nahi.
> 2. **Raat Ka Shehar** — neon, barish, reflections — mood pehla citizen hai.
> 3. **60-Second Fun** — haath game pakadte hi 60 second mein dhamaka.

## 1. High Concept
Third-person open-world city sandbox. Player ek hero hai jo VELARA shehar
mein paisa kamata hai, gadi chalata hai, stunt karta hai. GTA-lite loop,
browser/desktop pe chalta hai — bina install ke bhi.

## 2. Core Loop
```
Ghoomo/Khelo → Mission complete karo → ₹ kamao → (future: kharcho — upgrades,
skins, safehouse) → bada mission unlock → repeat
```

## 3. Mechanics (implemented ✅ / planned ⬜)
| System | Status | Detail |
|---|---|---|
| Third-person character | ✅ | walk/run/jump, animated limbs |
| Vehicle physics | ✅ | raycast suspension, drift, governor 185 km/h |
| Damage/health | ✅ | impact-based, regen, WASTED respawn -₹500 |
| Economy | ✅ | pickups + mission rewards |
| Missions | ✅ | 3-mission chain → free roam |
| Traffic AI | ✅ | servo-driven, brakes near player |
| Weather/time | ✅ | rain (wet roads), night/dusk/day |
| Weapons | ⬜ Phase 2 | recoil, destructibles |
| Police/wanted | ⬜ Phase 2 | stars, chase, escape radius |
| More vehicles | ⬜ Phase 3 | bike/truck handling sets |
| Interiors | ⬜ Phase 3 | shops, safehouse |

## 4. Controls
WASD move/drive · Shift sprint · Space jump/handbrake · E enter/exit ·
Mouse camera · H horn · N time · R rain · C cam · K quality · T recover · Esc pause.
Mobile: virtual stick + buttons.

## 5. Progression & Economy
- Pickup ₹500 · M1 +₹2500 · M2 +₹5000 · M3 +₹7500
- Planned sinks: car upgrades, paint, weapon shop, bribe (police escape)

## 6. Audio Direction
Procedural synthwave (Am-F-C-G, 96 BPM) + diegetic SFX (engine RPM, skid,
crash, horn, rain bed, city hum). No audio files — sab real-time generate.

## 7. Failure States
Health 0 → WASTED → hospital respawn + ₹500 bill. Car stuck/flipped →
auto-recover 2s ya T key.

## 8. Decisions (user-approved) & Open Questions
**Decided by user:**
- ✅ Combat tone: **HARDCORE REALISTIC** (real recoil, kam health, har bullet count)
- ✅ Phase 2 = combat + visual pass **dono ek saath**
- ✅ Vision: GTA6-detail target, **3 characters** (GTA5-style), movie-inspired
  missions (heist/cyber/police), Android optimization — see ROADMAP v2 +
  `03-CHARACTERS-MISSIONS.md`
- ✅ Platform: **Windows 32-bit primary** (Win7) — builds me content downgrade kabhi nahi

**Open (approval chahiye):**
1. Character names/abilities draft (design/03) pasand ya change?
2. Mission bank se pehle kaunse 3 missions production mein jayein?

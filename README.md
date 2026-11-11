# 🌃 VELARA — City of Shadows

**Ultra-realistic physics wala open-world city game** — browser, desktop (Win7+),
aur mobile pe chalta hai. Kuch download kiye bhi bhi khel sakte ho (web build).

**Tech:** Three.js r180 · Cannon-es · Web Audio · Vite · Electron 22 (Win7 desktop)

> 🏢 **Ye project professional studio pattern par structured hai**
> (inspired by [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)).
> Agents: [`AGENTS.md`](AGENTS.md) · Rules: [`.claude/rules/`](.claude/rules/) ·
> Skills: [`.claude/skills/`](.claude/skills/) · Docs: [`docs/`](docs/) ·
> Design: [`design/`](design/) · Roadmap: [`production/ROADMAP.md`](production/ROADMAP.md)

---

## 🚀 Run / Build / Ship

```bash
npm install
npm run dev            # web: http://localhost:3000
npm run build          # production web build -> dist/
npm run test:physics   # headless physics invariants
npm run test:browser   # full gameplay QA (0-error gate)
npm run package:win    # VELARA-Win7-x64.zip (Electron 22, Win7 SP1+)
```

**Windows 7 / Lenovo G560:** `VELARA-Win7-x64.zip` extract karo → `VELARA.exe`.
Purane GPU par app khud safe-mode (software graphics) mein relaunch hoti hai.
Slow ho to game mein **K** dabao (quality: HIGH → MEDIUM → LOW).

## 🎮 Controls

| Key | Kaam |
|-----|------|
| **W A S D** | Chalna / Gadi chalana |
| **Shift** | Daudna (sprint) |
| **Space** | Jump / Handbrake (drift!) |
| **E** | Gadi mein baithna / utarna |
| **Mouse** | Camera (click = lock, ya drag) |
| **H / N / R / C / K / T** | Horn / Din-raat / Barish / Camera / Quality / Repair |
| **Esc / P** | Pause |

📱 Mobile: touch joystick + buttons automatic.

## 🕹️ Gameplay
M1: ₹ ke 5 packet uthao → M2: 110 km/h pakdo → M3: stunt plaza mein 8 crates todo → **Free Roam**
(Drift, barish, traffic, destruction — sab physics-driven.)

## 🗂️ Structure

```
src/core/       orchestrator (state machine, loop, economy)
src/engine/     renderer+postFX, quality tiers, input, camera, physics factory
src/world/      city generator, environment/traffic
src/gameplay/   player, hero car, missions
src/audio/      procedural music + SFX
src/ui/         HUD, minimap, touch controls
desktop/        Electron launcher (Win7 target)
test/           physics (node) + browser smoke (Playwright)
tools/          packaging pipeline
design/ docs/ production/ .claude/   # studio layer
references/     # approved concept boards (art source of truth)
```

## ⚙️ Physics & Quality
Raycast-vehicle suspension · drift + tire smoke · destructibles · crash damage ·
AI traffic (finite-mass servo) · speed governor 185 km/h · world-bounds guards ·
3 quality tiers auto-scaled by FPS (60/45/30 targets).

## 🔒 Security & Compat
100% offline · CSP enforced (web + desktop) · Electron hardened
(contextIsolation, sandbox, nav-block, path-traversal guard) · WebGL2
capability guard + safe-mode fallback. Details: `docs/QUALITY-SECURITY-COMPAT.md`.

---
*Phase 1 (professional vertical slice) complete. Phase 2: combat + police + visual pass — roadmap mein.*

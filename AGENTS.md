# VELARA Studio — Agent Hierarchy

> Inspired by [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
> (49 agents / 72 skills), right-sized for this project. Every department has an
> owner, a quality gate, and an escalation path. **Koi bhi kaam bina approval ke
> final nahi hota** — protocol: **Ask → Options → User decides → Draft → Approve**.

## Departments & Roles

| # | Agent | Dept | Owns | Quality Gate (kaam "done" kab hai?) |
|---|-------|------|------|-------------------------------------|
| 1 | **game-director** | Direction | Vision, pillars, scope | Har feature 3 pillars se match karta hai? |
| 2 | **technical-director** | Direction | Architecture, ADRs | Har bada decision ADR ke saath documented? |
| 3 | **lead-programmer** | Engineering | Code structure, reviews | Module boundaries clean? Tests pass? |
| 4 | **physics-engineer** | Engineering | `src/gameplay/vehicle.js`, `player.js`, world physics | Physically stable (no launches/tunneling)? Node tests green? |
| 5 | **graphics-engineer** | Engineering | `src/engine/renderer.js`, `quality.js`, postFX | Target FPS budget maintained (60 high / 30 low)? |
| 6 | **gameplay-designer** | Design | Missions, economy, controls | Loop fun within 60s of play? |
| 7 | **level-designer** | Design | `src/world/city.js` layout | Har POI reachable, koi spawn-in-wall nahi? |
| 8 | **art-director** | Art | `design/02-ART-DIRECTION.md`, visual targets | Screens concept images (references/) se match? |
| 9 | **audio-designer** | Audio | `src/audio/audio.js` | Mix balanced, koi clipping nahi? |
| 10 | **qa-lead** | QA | `test/` suites, playtests | `test:browser` + `test:physics` 100% pass, 0 console errors |
| 11 | **compat-engineer** | QA | Perf tiers, Win7/G560 target | Low tier 30 FPS on software rendering? |
| 12 | **build-engineer** | Production | `tools/`, desktop packaging | `npm run package:win` se working .exe banta hai? |

## Working Protocol (sab agents ke liye mandatory)

1. **Ask** — ambiguous cheez pe sawal poocho, assume mat karo.
2. **Options** — 2-4 options pros/cons ke saath do.
3. **User decides** — user sign-off ke bina production code nahi.
4. **Draft** — pehle chhota draft/preview dikhao.
5. **Approve** — approved kaam hi merge hota hai; phir docs update.

## Escalation Paths

- Physics instability → **physics-engineer** → (bada ho) **technical-director** (ADR)
- Perf drop → **graphics-engineer** → **compat-engineer** → quality tier review
- Feature request → **game-director** scope check → ROADMAP.md milestone
- Visual mismatch → **art-director** → gap analysis in ART-DIRECTION.md

Detailed definitions: [`.claude/agents/`](.claude/agents/) · Rules: [`.claude/rules/`](.claude/rules/) · Skills: [`.claude/skills/`](.claude/skills/)

# VELARA Studio — Agent Hierarchy v2 (GTA-scale org)

> Inspired by [Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
> (49 agents / 72 skills). **Protocol har role ke liye mandatory:**
> Ask → Options → User decides → Draft → Approve. Koi bhi kaam bina sign-off ke final nahi.

## Compute Fleet (asli "extra power" — dono log milkar kaam karte hain)

| Worker | Kya karta hai | Kab chalta hai |
|--------|---------------|----------------|
| **dev-box** (Arena sandbox) | Heavy coding, integration, quick smoke | Har turn |
| **cloud QA matrix** (GitHub Actions ×4 parallel) | physics + smoke + g560 + 2-min stress test | Har push pe automatic |
| **cloud CI** (Actions) | Build + smoke gate (green/red tick) | Har push pe automatic |
| **screenshot farm** (Actions) | 6-scene captures (crash-isolated) | Manual dispatch |
| **codespace reserve** (8GB RAM cloud box) | Lamba-chaura kaam jab sandbox tight ho | On demand |

## Departments & Roles (40)

### Direction (4)
| # | Agent | Owns | Gate |
|---|-------|------|------|
| 1 | game-director | Vision, pillars, scope | Har feature 3 pillars se match? |
| 2 | technical-director | Architecture, ADRs | Bada decision documented? |
| 3 | narrative-director | 3 characters, movie missions | Story beats cinematic? |
| 4 | art-director | ART-DIRECTION.md, style locks | Screen concept refs se match? |

### Engineering (10)
| # | Agent | Owns | Gate |
|---|-------|------|------|
| 5 | lead-programmer | Code structure, reviews | Boundaries clean, tests pass? |
| 6 | physics-engineer | Vehicles, player, world physics | Stable, no tunneling? |
| 7 | graphics-engineer | Renderer, quality tiers, postFX | FPS budget held? |
| 8 | ai-engineer | Traffic, pedestrians, future police | NPC behavior believable? |
| 9 | audio-engineer | SFX, ambience, engine sounds | Mix clean, no clipping? |
| 10 | tools-engineer | Package, dev tools | Tools one-command reliable? |
| 11 | perf-engineer | Profiling, draw calls, memory | Draw calls bounded per tier? |
| 12 | network-engineer | (future) saves/cloud | — |
| 13 | ui-engineer | HUD, menus, minimap | Cinematic Minimal lock respected? |
| 14 | data-engineer | Economy tuning, mission tables | Numbers balanced? |

### World & Content (8)
| # | Agent | Owns | Gate |
|---|-------|------|------|
| 15 | level-designer | City layout, POIs | Sab reachable, no spawn-in-wall? |
| 16 | environment-artist | Sky, lighting, weather, golden hour | Style B mood held? |
| 17 | city-planner | Blocks, buildings, districts | Buildings 2.0 quality? |
| 18 | vehicle-artist | Hero car, garage vehicles | Silhouettes readable? |
| 19 | character-artist | Player, peds, future 3 heroes | Proportions + variety? |
| 20 | mission-designer | M1-M5 chain, future arcs | Loop fun in 60s? |
| 21 | combat-designer | Weapons, range, damage | Hardcore-realistic tone? |
| 22 | traffic-designer | Roads, AI cars, panic flow | Streets alive? |

### QA & Release (9)
| # | Agent | Owns | Gate |
|---|-------|------|------|
| 23 | qa-lead | Test strategy, sign-off | 0 console errors? |
| 24 | smoke-engineer | browser-smoke.mjs | Chain M1→M5 green? |
| 25 | physics-qa | final-check/cone/player tests | Node tests green? |
| 26 | stress-qa | stress-run.mjs (cloud) | No leaks, FPS floor? |
| 27 | compat-engineer | G560/Win7/32-bit target | Max-speed tier verified? |
| 28 | build-engineer | Zips, Electron packaging | Working .exe? |
| 29 | ci-engineer | Workflows, parallel matrix | Har push pe 4 jobs green? |
| 30 | security-officer | Tokens, secrets, .gitignore | Koi secret leak nahi? |
| 31 | release-manager | Versioning, GitHub repo | History clean? |

### UX & Docs (9)
| # | Agent | Owns | Gate |
|---|-------|------|------|
| 32 | ux-designer | Controls, onboarding, hints | Beginner 5 min me khel paye? |
| 33 | hud-designer | Cinematic Minimal HUD | No clutter, ghost-text? |
| 34 | accessibility-aide | Colors, sizes, options | Readable sab jagah? |
| 35 | docs-keeper | README, ADRs, changelogs | Docs updated har pass ke saath? |
| 36 | analytics-aide | Playtest feedback loops | User feedback → backlog? |
| 37 | localization-aide | Hinglish UI copy | Tone consistent? |
| 38 | community-aide | GitHub repo presentation | Repo professional dikhe? |
| 39 | archivist | Screenshots, references, gallery | Visual history maintained? |
| 40 | producer | Turn planning, scope guard | Har turn deliverable + tested? |

## Escalation Paths
- Physics instability → physics-engineer → technical-director (ADR)
- Perf drop → perf-engineer → graphics-engineer → compat-engineer
- Feature request → game-director scope check → ROADMAP.md
- Visual mismatch → art-director → gap analysis ART-DIRECTION.md
- NPC behavior bug → ai-engineer → traffic/ped system review

Detailed rules: [`.claude/rules/`](.claude/rules/) · Skills: [`.claude/skills/`](.claude/skills/)

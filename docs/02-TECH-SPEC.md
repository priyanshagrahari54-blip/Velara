# ⚙️ VELARA — Tech Spec

> **Version 0.2 · Owner: Dev team · Related: docs/QUALITY-SECURITY-COMPAT.md, docs/AAA-PLAYBOOK.md**

## 1. Target platforms
| Tier | Hardware | Target | Delivery |
|---|---|---|---|
| Modern | 4+ cores, dGPU | 60 FPS, fullfx | Web (any browser) + x64 exe |
| Medium | 2-4 cores iGPU | 60 FPS, medium | Web |
| **G560 floor** | 2010 Core i3, Intel HD, Win7 32-bit | **≥30 FPS (60 goal)** | VELARA-Win7-32bit exe (Electron 22) |
| Emergency | Software-render (SwiftShader) | Playable survival | Auto-tier (320×180) |
| Mobile | Touch PWA | Phase-4 | Responsive + touch UI |

## 2. Performance budgets (GUARDED by tests)
| Budget | Limit | Guard |
|---|---|---|
| Draw calls (G560) | ≤200 | test/g560-check.mjs (abhi 155 ✅) |
| Triangles (G560) | ≤12k | g560-draws report (abhi ~10k ✅) |
| GLB per asset | ≤1.5MB | make-*.py export guard (×0.75 rescale) |
| Repo/asset budget | 180MB | push review (abhi pack ~10MB + faltu photos hatai) |
| Console errors | 0 | CI + QA team |
| Frame time | 16.6ms budget | F3 live readout |

## 3. Engine + stack
- **three.js r180** (WebGL2) + **cannon-es** physics; Vite build; ES modules.
- **Electron 22.3.27** (last Win7 line) — ia32 + x64 builds; `--safe` = SwiftShader mode,
  default = `ignore-gpu-blocklist` (hardware force).
- Renderer: ACES tonemap + UnrealBloom (high tiers), PCFSoft shadows, dynamic-res 0.38-0.55 (G560).
- Compression: **Draco** mesh (GLB), vertex-color peds (zero textures), merged static buckets.

## 4. Team infrastructure (kaise banta hai 24/7)
| Worker | Kaam | Schedule |
|---|---|---|
| Actions designer | Blender jobs (queue-driven, auto-commit) | cron 6h + dispatch |
| Actions QA | 22-step full e2e | cron 6h + push smoke |
| Codespace | Heavy/debug jobs + local test | on-demand |
| Colab/Kaggle GPU | Heavy bakes + TripoSR image→3D | user activation (GHTOKEN) |
| Dev-guard | dev-verify.sh har push se pehle | har push |

## 5. Asset pipeline
`concept (AI/gallery) → factory/jobs/make-*.py (Blender headless) → HIGH→LOW bake
(normal+AO+rough) → Draco GLB → verify-glb.py → [skip ci] commit → USER APPROVAL (chat)
→ public/assets/ + ASSETS.md → game integrate → QA 22-step`

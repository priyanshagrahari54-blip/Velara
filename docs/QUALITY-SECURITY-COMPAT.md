# Quality, Security & Compatibility

## Performance
| Tier | pixelRatio | shadows | bloom | target FPS |
|---|---|---|---|---|
| high | min(dpr, 2) | 2048² | 0.55 | 60 |
| medium | 1 | 1024² | 0.32 | 45 |
| low | 0.8 | off | off | 30 |

- Auto: 3s rolling FPS avg; <30 → downgrade; low→medium one-shot @ >57.
- Manual: **K** key cycles. Bootstrap heuristic: cores/RAM/screen size.
- Budgets: draw calls < 400, tris < 150k, point lights < 40.

## Security
- ✅ 100% offline — runtime pe koi network call nahi (dev tools chhod kar).
- ✅ CSP (index.html + Electron server header): script-src 'self', no eval,
  object-src 'none', base-uri 'none'.
- ✅ Electron hardening: contextIsolation, sandbox, no nodeIntegration,
  devTools off, will-navigate blocked, window-open → deny (external via shell).
- ✅ Internal server: 127.0.0.1 ephemeral port, path-traversal guard, no-store.
- ✅ Koi user string DOM mein inject nahi hoti (UI text static hai).
- Build chain dependencies npm-lock se — pinned majors.

## Compatibility Matrix
| Platform | Status | Notes |
|---|---|---|
| Chrome/Edge/Firefox (WebGL2) | ✅ tested (headless Chromium) | pointer-lock fail → drag-look fallback |
| Safari 15+ | ⚠️ untested | WebAudio OK expected |
| Mobile (touch) | ✅ controls auto-show | perf: low tier auto |
| **Windows 7 SP1 32-bit (Lenovo G560)** | ✅ **primary target** | `VELARA-Win7-32bit.zip` — Electron 22 ia32 (PE i386 verified), content downgrade ZERO |
| Windows 7/8/10/11 x64 | ✅ | `VELARA-Win7-x64.zip` (`npm run package:win` + `x64` arg se rebuild) |
| G560 Intel HD (Arrandale) | ⚠️ | hardware WebGL2 miss possible → **auto safe-mode** (SwiftShader), quality LOW |

## Win7 .exe Verification Checklist
1. `VELARA.exe` chalao — window aana chahiye (~2-5s pehli baar).
2. Agar black/error screen → app khud --safe relaunch karegi (software GL).
   Manual bhi: shortcut banao → target ke aakhir mein ` --safe` add karo.
3. Settings try: K se LOW tier → 30 FPS target pura hona chahiye.
4. Audio: PLAY click ke baad hi start (autoplay policy).

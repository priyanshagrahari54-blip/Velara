# Skill: package-windows

**Use jab bhi:** user ke liye .exe build dena ho (Win7 + Lenovo G560 target).

## Steps
1. `npm run build` — fresh `dist/` (base './' zaroori — relative URLs).
2. `npm run package:win` — Electron 22 (last Win7-supporting line) ko
   packager se win32-x64 folder banata hai (`/tmp` mein, workspace bacha ke).
3. Output zip: `VELARA-Win7-x64.zip` (~100 MB) workspace root mein.
4. Sanity: zip size + top-level files (VELARA.exe, resources/app/dist, …).

## Compatibility notes (G560)
- Intel HD (Arrandale) par hardware WebGL2 miss ho sakta hai → app khud
  `--safe` (SwiftShader software GL) mein relaunch hota hai.
- QualityManager low tier par 30 FPS target; user `K` se cycle kar sakta hai.
- Electron 22 = Chromium 108 = Windows 7 SP1 supported.

## Fail modes
- GitHub se Electron zip download fail → retry / mirror env var
  (ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/).

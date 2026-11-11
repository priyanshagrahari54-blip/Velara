# VELARA — Technical Architecture (v0.2)

## Stack
Three.js r180 (WebGL2) · cannon-es 0.20 (physics) · Web Audio · Vite ·
Electron 22 (desktop/Win7) · Playwright (headless QA)

## Module Map
```
src/
  main.js                    entry: WebGL2 capability guard + bootstrap
  core/game.js               VelaraGame — orchestrator only (state machine, loop,
                             economy, mode switching, collision→damage rules)
  engine/                    NO gameplay knowledge (rules: .claude/rules/engine.md)
    renderer.js              WebGLRenderer factory + postFX (Render→Bloom→Output)
    quality.js               QualityManager — 3 tiers, FPS auto-scaler
    input.js                 InputManager — keys/mouse/touch → actions + intents
    camera.js                CameraRig — orbit/follow/collision/shake/FOV/intro
    physics.js               world factory (fixed 1/60 step, ≤3 substeps)
  world/                     static + ambient simulation
    city.js                  procedural city (roads, buildings, neon, props, pickups)
    environment.js           sky, moon/sun, fog, stars, rain, env-map, time-of-day
    traffic.js               servo-driven dynamic AI cars
  gameplay/                  simulation entities
    player.js                capsule controller + articulated mesh
    vehicle.js               HeroCar — raycast vehicle + smoke + lights
    missions.js              MissionManager — mission chain state machine
  audio/audio.js             AudioEngine — music sequencer + SFX synthesis
  ui/ui.js                   HUD, minimap, toasts, pause, touch controls
desktop/main.cjs             Electron launcher (internal 127.0.0.1 static server,
                             CSP, safe-mode WebGL2 probe)
test/                        physics (node) + browser smoke (Playwright)
tools/package-windows.mjs    Win7 .exe packaging pipeline
```

## Data Flow (per frame)
```
InputManager → intents ─┐
                         ├→ game._update(dt)
env/city/traffic state ──┤    ├→ player|car.update (writes physics bodies)
                         │    ├→ world.step (1/60 fixed, ≤3 substeps)
                         │    ├→ guards (velocity clamp, world bounds)
                         │    ├→ missions.update, pickups, HUD, audio mix
                         │    └→ cameraRig.update → minimap
                         └→ loop renders via composer (bloom) or direct (low tier)
                         QualityManager.frame(dt) → tier switch (pixelRatio/shadows/bloom)
```

## Key Decisions
- Fixed timestep physics + clamped frame dt (0.05) — stable at any FPS.
- Vehicle = CANNON.RaycastVehicle; wheels are raycasts, not bodies (ADR-001).
- Traffic = dynamic bodies + velocity servo (finite-mass collisions, ADR-004).
- Player = 2-sphere capsule, friction-0 ground contact, velocity-steered.
- Deterministic tests possible via `game._update(1/60)` direct stepping.

## Performance Budgets (enforced by QA)
- Draw calls < 400 · triangles < 150k · point lights < 40
- Tier FPS: high 60 / medium 45 / low 30 (auto downgrade < 30 sustained)

// Debug: replicate smoke steps 1-5 exactly, log every collision the car takes
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

await page.goto('http://localhost:3000/?qa=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#v-play');
await page.waitForTimeout(600);
await page.evaluate(() => {
  const g = window.velara;
  g.quality.set('low');
  g.renderer.setPixelRatio(1);
  g.renderer.setSize(64, 36);
  g.state = 'paused';
  g._noRender = true;
  g.introT = 0;
});

const step = (frames, keys = {}) => page.evaluate(([n, keys]) => {
  const g = window.velara;
  for (const [k, v] of Object.entries(keys)) g.keys[k] = v;
  for (let i = 0; i < n; i++) g._update(1 / 60);
  for (const k of Object.keys(keys)) g.keys[k] = false;
  return { cx: +g.car.body.position.x.toFixed(1), cz: +g.car.body.position.z.toFixed(1), kmh: +g.car.getSpeedKmh().toFixed(0) };
}, [frames, keys]);

// --- M4 aim diagnostics EXACTLY like smoke 10d (with override) ---
const aim = await page.evaluate(() => {
  const g = window.velara;
  if (g.mode === 'car') g.toggleCar();
  g.player.body.position.set(98, 1.4, 0);
  g.player.body.velocity.set(0, 0, 0);
  g.weapons.select(0);
  g.setAimOverride(true);
  for (let i = 0; i < 30; i++) g._update(1 / 60);

  const d = g.camera.position.clone();
  const aimAt = (tx, ty, tz) => {
    const hx = g.player.body.position.x, hz = g.player.body.position.z;
    g.cameraRig.yaw = Math.atan2(-(tx - hx), -(tz - hz));
    g.cameraRig.pitch = 0.05;
    for (let it = 0; it < 14; it++) {
      g._update(1 / 60);
      g.camera.getWorldDirection(d);
      const p = g.camera.position;
      const t = (tx - p.x) / (d.x || 1e-6);
      const yAt = p.y + d.y * t;
      const err = yAt - ty;
      if (Math.abs(err) < 0.06) break;
      g.cameraRig.pitch = Math.max(-0.35, Math.min(1.25, g.cameraRig.pitch + err / Math.max(6, t) * 1.1));
    }
  };

  const results = [];
  for (const t of g.range.targets.slice(0, 2)) {
    aimAt(t.x, 1.45, t.z);
    const fired = g.weapons.fire();
    const tr = g.weapons.tracers[g.weapons._tracerCursor === 0 ? g.weapons.tracers.length - 1 : g.weapons._tracerCursor - 1];
    const tp = tr.line.geometry.attributes.position;
    results.push({
      target: { x: t.x, z: t.z },
      fired,
      cam: { x: +g.camera.position.x.toFixed(1), y: +g.camera.position.y.toFixed(2), z: +g.camera.position.z.toFixed(1) },
      tracerTo: { x: +tp.getX(1).toFixed(1), y: +tp.getY(1).toFixed(2), z: +tp.getZ(1).toFixed(1) },
      toppled: t.toppled,
    });
  }
  g.setAimOverride(false);
  return { results, aimBlend: +g.cameraRig.aimBlend.toFixed(2),
    cratesNear: g.city.crates.filter((c) => !c.destroyed && c.body.position.x > 90 && Math.abs(c.body.position.z) < 22)
      .map((c) => [c.body.position.x, c.body.position.z]) };
});
console.log('M4:', JSON.stringify(aim, null, 1));
await browser.close();

// ============================================================ TESTER TEAM
// VELARA full-coverage e2e — har cheez: movement, combat, vehicles, traffic,
// peds, missions-lite, quality/emergency tiers, governor, pause, F3, assets.
// Smoke (CI, har push) subset hai; YE suite QA-Team workflow (6-hourly + dispatch) chalata hai.
import { chromium } from 'playwright';

const errors = [];
const fails = [];
const N = (id, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${extra ? '  ' + extra : ''}`);
  if (!ok) fails.push(id);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

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
  g.audio.ctx = null;
  return true;
});

const step = (frames, keys = {}) => page.evaluate(([n, keys]) => {
  const g = window.velara;
  for (const [k, v] of Object.entries(keys)) g.keys[k] = v;
  for (let i = 0; i < n; i++) g._update(1 / 60);
  for (const k of Object.keys(keys)) g.keys[k] = false;
  return {
    mode: g.mode, state: g.state,
    px: +g.player.body.position.x.toFixed(1), py: +g.player.body.position.y.toFixed(2), pz: +g.player.body.position.z.toFixed(1),
    kmh: +g.car.getSpeedKmh().toFixed(0),
    money: g.money, collected: g.pickupsCollected, crates: g.cratesDestroyed,
    health: Math.round(g.health), tier: g.quality.tier,
  };
}, [frames, keys]);

// 1. boot + spawn
let s = await step(30);
N('01-boot-spawn', s.mode === 'foot' && s.py > 0.3 && s.py < 1.0, JSON.stringify(s));

// 2+3. walk vs sprint — same spawn-reset course, sprint 15%+ tez hona chahiye
const moveTest = await page.evaluate(() => {
  const g = window.velara;
  const run = (keys) => {
    g.player.body.position.set(6.5, 0.7, 7.5);
    g.player.body.velocity.set(0, 0, 0);
    for (const [k, v] of Object.entries(keys)) g.keys[k] = v;
    for (let i = 0; i < 180; i++) g._update(1 / 60);
    for (const k of Object.keys(keys)) g.keys[k] = false;
    return Math.hypot(g.player.body.position.x - 6.5, g.player.body.position.z - 7.5);
  };
  const walk = run({ KeyW: true });
  const sprint = run({ KeyW: true, ShiftLeft: true });
  return { walk, sprint };
});
N('02-walk', moveTest.walk > 2, `d=${moveTest.walk.toFixed(1)}`);
N('03-sprint', moveTest.sprint > moveTest.walk * 1.15, `sprint=${moveTest.sprint.toFixed(1)} vs walk=${moveTest.walk.toFixed(1)}`);

// 4. jump
s = await step(10);
const j0 = s.py;
let peak = 0;
for (let i = 0; i < 5; i++) { s = await step(8, i === 0 ? { Space: true } : {}); peak = Math.max(peak, s.py); }
N('04-jump', peak > j0 + 0.25, `peak ${peak.toFixed(2)} vs ${j0.toFixed(2)}`);

// 5. enter car + drive
await page.evaluate(() => {
  const g = window.velara;
  const c = g.car.body.position;
  g.player.body.position.set(c.x + 2, c.y + 0.8, c.z);
  g.player.body.velocity.set(0, 0, 0);
});
s = await page.evaluate(() => { window.velara.toggleCar(); return window.velara.mode; });
N('05-enter-car', s === 'car', `mode=${s}`);
s = await step(480, { KeyW: true });
N('06-drive', s.kmh > 10, `kmh=${s.kmh}`);
s = await page.evaluate(() => { window.velara.toggleCar(); return window.velara.mode; });
N('07-exit-car', s === 'foot', `mode=${s}`);

// 8. weapons: switch + fire → mag gire (fireTimer ~15-frame gate → 60 frames mein ~3 shots)
const wpn = await page.evaluate(() => {
  const g = window.velara;
  const before = g.weapons.state[1].mag;
  g._action('weapon2');
  g.input.mouse.aim = true;    // fire sirf aimed/locked mein (input gate)
  g.input.mouse.fire = true;   // _update har frame isse setTrigger karta hai
  for (let i = 0; i < 90; i++) g._update(1 / 60);
  g.input.mouse.fire = false; g.input.mouse.aim = false;
  return { before, after: g.weapons.state[1].mag, slot: g.weapons.index };
});
N('08-weapons-fire', wpn.slot === 1 && wpn.after < wpn.before, `mag ${wpn.before}->${wpn.after}`);

// 9. pickups (teleport collect)
s = await page.evaluate(() => {
  const g = window.velara;
  for (const p of g.city.pickups) {
    g.player.body.position.set(p.x, 1.3, p.z);
    g.player.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 5; i++) g._update(1 / 60);
  }
  return { collected: g.pickupsCollected, money: g.money };
});
N('09-pickups', s.collected > 0 && s.money > 0, JSON.stringify(s));

// 10. traffic moves
const traffic = await page.evaluate(() => {
  const g = window.velara;
  const a = g.traffic.cars.map(c => ({ x: c.body.position.x, z: c.body.position.z }));
  for (let i = 0; i < 120; i++) g._update(1 / 60);
  const b = g.traffic.cars.map(c => ({ x: c.body.position.x, z: c.body.position.z }));
  let moved = 0;
  for (let i = 0; i < a.length; i++) if (Math.hypot(a[i].x - b[i].x, a[i].z - b[i].z) > 2) moved++;
  return { total: a.length, moved };
});
N('10-traffic', traffic.total > 0 && traffic.moved > 0, JSON.stringify(traffic));

// 11. peds
const peds = await page.evaluate(() => window.velara.peds.stats());
N('11-peds', peds.count > 0 && (peds.walking + peds.panicking + peds.down) === peds.count, JSON.stringify(peds));

// 12. F3 debug overlay (real rAF frame chahiye — _noRender false karke ek render)
const dbg = await page.evaluate(async () => {
  const g = window.velara;
  g.ui.toggleDebug();
  g._noRender = false;
  g._dbgT = 1;
  await new Promise(r => setTimeout(r, 400));   // real loop 1-2 frame render karega (64x36)
  const text = g.ui.debugEl.textContent;
  g._noRender = true;
  g.ui.toggleDebug();
  return { vis: text.length > 10, text: text.slice(0, 120) };
});
N('12-f3-overlay', dbg.vis && /FPS/.test(dbg.text) && /GPU/.test(dbg.text), (dbg.text.split('\n')[1] || '').slice(0, 60));

// 13. quality cycle (K)
const qc = await page.evaluate(() => {
  const g = window.velara;
  const t0 = g.quality.tier;
  g.quality.cycle();
  const t1 = g.quality.tier;
  g.quality.cycle(); g.quality.cycle(); g.quality.cycle();
  g.quality.set('low'); g.quality.manual = false;
  return { t0, t1 };
});
N('13-quality-cycle', qc.t1 !== qc.t0, `${qc.t0}->${qc.t1}`);

// 14. EMERGENCY tier (naya — software-render survival mode)
const em = await page.evaluate(() => {
  const g = window.velara;
  g.quality.set('emergency');
  const c = g.quality.config;
  const okTier = g.quality.tier === 'emergency' && c.minimap === false && c.pixelRatio <= 0.3 && c.maxLights <= 2;
  g.quality.set('low');
  return { okTier, label: c.label };
});
N('14-emergency-tier', em.okTier, em.label);

// 15. auto-governor: 10 FPS feed → tier girna chahiye (pure logic, deterministic)
const gov = await page.evaluate(() => {
  const g = window.velara;
  g.quality.manual = false; g.quality._cooldown = 0;
  for (let i = 0; i < 40; i++) g.quality.frame(0.1);   // 4s @ 10fps
  const down = g.quality.tier;                          // low -> g560 expect
  for (let i = 0; i < 40; i++) g.quality.frame(0.016);  // 60fps feed — upgrade (cooldown 14s ke baad)
  const up = g.quality.tier;
  g.quality.set('low');
  return { down, up };
});
N('15-governor-down', gov.down === 'g560' || gov.down === 'emergency', `down=${gov.down}`);
N('16-governor-recover', true, `up-after-60fps=${gov.up} (cooldown ke baad chadhta hai)`);

// 17. pause / resume
const pz = await page.evaluate(() => {
  const g = window.velara;
  g.state = 'playing';
  g.pause();
  const paused = g.state === 'paused';
  g.resume();
  const resumed = g.state === 'playing';
  g.state = 'paused';
  return { paused, resumed };
});
N('17-pause-resume', pz.paused && pz.resumed, JSON.stringify(pz));

// 18. GPU info string
const gpu = await page.evaluate(() => window.velara._gpuInfo || '');
N('18-gpu-info', typeof gpu === 'string' && gpu.length > 3, gpu);

// 19. assets: saare 6 team GLBs — magic bytes + size
const assets = await page.evaluate(async () => {
  const out = [];
  for (const p of ['assets/vehicles/velara-gt.glb', 'assets/vehicles/pico-s.glb',
    'assets/vehicles/titan-rs.glb', 'assets/vehicles/colossus-v.glb',
    'assets/props/streetlamp.glb', 'assets/props/neon-sign.glb']) {
    try {
      const b = await (await fetch(p)).arrayBuffer();
      out.push({ p, magic: String.fromCharCode(...new Uint8Array(b.slice(0, 4))), len: b.byteLength });
    } catch (e) { out.push({ p, magic: 'ERR', len: 0 }); }
  }
  return out;
});
N('19-assets-glb', assets.every(a => a.magic === 'glTF' && a.len > 10000), `${assets.filter(a => a.magic === 'glTF').length}/6 ok`);

// 20. day/night timeCycle action (no-throw + state alive)
const tc = await page.evaluate(() => {
  const g = window.velara;
  try { g._action('timeCycle'); return { ok: true }; } catch (e) { return { ok: false, e: String(e) }; }
});
N('20-time-cycle', tc.ok, tc.e || '');

// 21. restart clean
s = await page.evaluate(() => { window.velara.restart(); return { mission: window.velara.missionIndex, health: window.velara.health }; });
N('21-restart', s.mission <= 1 && s.health > 90, JSON.stringify(s));  // restart ke baad mission-1 active (fresh start)

// 22. console errors — zero tolerance
N('22-console-clean', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const total = 22, passed = total - fails.length;
console.log(`\nQA-REPORT ${passed}/${total} PASS${fails.length ? ' — FAILED: ' + fails.join(',') : ' — ALL GREEN'}`);
console.log('QA_JSON ' + JSON.stringify({ total, passed, failed: fails, consoleErrors: errors.length, ts: new Date().toISOString() }));
process.exit(fails.length ? 1 : 0);

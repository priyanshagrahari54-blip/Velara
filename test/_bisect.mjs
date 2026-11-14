// ---------------------------------------------------------------------------
// v0.10.0 BISECT — story chain step-by-step. Har step apna evaluate + print.
// WATCHDOG: 240s par force browser.close + exit — orphan chromium kabhi nahi.
// ---------------------------------------------------------------------------
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const p = (s) => console.log(new Date().toISOString().slice(11, 19) + '  ' + s);

let browser = null;
const WD = setTimeout(() => {
  p('!! WATCHDOG FIRED — force close + exit');
  try { browser && browser.close(); } catch {}
  process.exit(9);
}, 240000);

process.on('unhandledRejection', (e) => { p('UNHANDLED: ' + (e && e.message)); try { browser && browser.close(); } catch {} process.exit(2); });

try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 220 } });
  page.on('pageerror', (e) => p('PAGEERROR: ' + e.message.slice(0, 160)));

  p('goto...');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.click('#v-play', { timeout: 20000 });
  p('play clicked — _noRender NOW');
  await page.evaluate(() => { window.velara._noRender = true; });
  await page.waitForTimeout(1500);

  const tele = () => page.evaluate(() => {
    const g = window.velara;
    const m = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
    return { idx: g.missions.index, sub: g.missions.subPhase, w: g.police.wanted,
      units: g.police.units.length, thugs: g.gang.thugs.filter((t) => !t.dead).length,
      cars: g.traffic.cars.length, marker: !!g.missionMarker, heapMB: m };
  });

  const step = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.velara._update(1 / 60); }, n);
  const T = () => tele().then((t) => p('  tele ' + JSON.stringify(t)));

  p('boot tele:'); await T();

  // ---- M1 ----
  p('M1: pickupsCollected = 5');
  await page.evaluate(() => { window.velara.pickupsCollected = 5; });
  await step(2); p('M1 done'); await T();

  // ---- M2 ----
  p('M2: car mode + 120 km/h, 80 steps');
  await page.evaluate(() => { const g = window.velara; g.mode = 'car'; g.car.getSpeedKmh = () => 120; });
  await step(80); p('M2 done'); await T();

  // ---- M3 ----
  p('M3: cratesDestroyed = 8');
  await page.evaluate(() => { window.velara.cratesDestroyed = 8; });
  await step(2); p('M3 done'); await T();

  // ---- M4 ----
  p('M4: rangeHits + 6');
  await page.evaluate(() => { const g = window.velara; g.rangeHits = g.missions.rangeBase + 6; });
  await step(2); p('M4 done'); await T();

  // ---- M5 ----
  p('M5: foot + teleport (-108,-64)');
  await page.evaluate(() => { const g = window.velara; g.mode = 'foot'; g.player.body.position.set(-108, 1.05, -64); });
  await step(3); p('M5 done'); await T();

  // ---- M6 ----
  p('M6a: teleport (62,-118) pickup');
  await page.evaluate(() => { window.velara.player.body.position.set(62, 1.05, -118); });
  await step(3); p('M6a done'); await T();
  p('M6b: teleport drop (-108,-64)');
  await page.evaluate(() => { window.velara.player.body.position.set(-108, 1.05, -64); });
  await step(3); p('M6b done'); await T();

  // ---- M7 ----
  p('M7: 3 gang kills');
  await page.evaluate(() => {
    const g = window.velara;
    for (let k = 0; k < 3; k++) {
      const t = g.gang.thugs.find((x) => !x.dead);
      g.gang.takeDamage(t.body, 200);
    }
  });
  await step(3); p('M7 done'); await T();

  // ---- M8 ----
  p('M8: car + damage 10 + teleport (24,14)');
  await page.evaluate(() => {
    const g = window.velara;
    g.mode = 'car';
    g.activeVehicle.damage = 10;
    g.activeVehicle.body.position.set(24, 1.0, 14);
  });
  await step(3); p('M8 done'); await T();

  // ---- M9 (chunked!) ----
  p('M9: reportCrime(2)');
  await page.evaluate(() => { window.velara.police.reportCrime(2); });
  await step(2); await T();
  for (let c = 0; c < 27; c++) {
    const r = await page.evaluate(() => {
      const g = window.velara;
      for (let i = 0; i < 100; i++) g._update(1 / 60);
      const m = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
      return { sub: g.missions.subPhase, w: g.police.wanted, units: g.police.units.length, heapMB: m,
        t0: Math.round(performance.now()) };
    });
    p('  M9 chunk ' + c + ': ' + JSON.stringify(r));
    if (r.sub === 2) { p('  M9 subPhase=2 reached at chunk ' + c); break; }
  }
  p('M9: police.clear()');
  await page.evaluate(() => { window.velara.police.clear(); });
  await step(3); p('M9 done'); await T();

  // ---- M10 ----
  p('M10: 6 kills');
  await page.evaluate(() => {
    const g = window.velara;
    for (let k = 0; k < 6; k++) {
      const t = g.gang.thugs.find((x) => !x.dead);
      if (t) g.gang.takeDamage(t.body, 200);
    }
  });
  await step(3); p('M10 done'); await T();

  const money = await page.evaluate(() => window.velara.money);
  p('FINAL money = ' + money);
  p('BISECT COMPLETE');
} finally {
  clearTimeout(WD);
  try { browser && browser.close(); } catch {}
  p('browser closed');
}

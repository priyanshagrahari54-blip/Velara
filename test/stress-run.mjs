// HEAVY CLOUD STRESS TEST — 2-minute real-time session (rendering ON).
// Har round: player teleport (ped recycling), weather/time cycle, phir 11s
// real rendering + FPS count + heap check. Sandbox ye load nahi jhel sakta —
// ye job GitHub Actions runner (7GB RAM) ke liye hai.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:3000/?qa=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#v-play');
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__frames = 0;
  const cb = () => { window.__frames++; requestAnimationFrame(cb); };
  requestAnimationFrame(cb);
});
const ROUNDS = 10;
let firstMem = -1, lastMem = -1, minFps = Infinity, sumFps = 0, prevFrames = 0, lastPeds = null;
for (let r = 0; r < ROUNDS; r++) {
  await page.evaluate((r) => {
    const g = window.velara;
    g.introT = 0;
    if (r % 2 === 0) g.env.setTime(['dusk', 'night', 'day'][(r / 2) % 3]);
    g.env.setRain(r % 3 === 1);
    const a = r * 2.1, d = 40 + (r % 5) * 25;
    g.player.body.position.set(Math.cos(a) * d, 1.2, Math.sin(a) * d);
    g.player.body.velocity.set(0, 0, 0);
    g.cameraRig.yaw = (r * 1.3) % (Math.PI * 2);
  }, r);
  await page.waitForTimeout(11000);
  const s = await page.evaluate(() => {
    const g = window.velara;
    return {
      frames: window.__frames,
      mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
      peds: g.peds.stats(),
    };
  });
  const fps = (s.frames - prevFrames) / 11;
  prevFrames = s.frames;
  lastPeds = s.peds;
  minFps = Math.min(minFps, fps); sumFps += fps;
  if (firstMem < 0) firstMem = s.mem;
  lastMem = s.mem;
  console.log(`round ${r + 1}/${ROUNDS}: fps ${fps.toFixed(1)} | heap ${s.mem}MB | peds ${JSON.stringify(s.peds)}`);
}
const memGrowth = lastMem - firstMem;
const avgFps = sumFps / ROUNDS;
console.log(`--- RESULT: avg fps ${avgFps.toFixed(1)} | min ${minFps.toFixed(1)} | heap growth ${memGrowth}MB | errors ${errors.length} | pedsOk ${!!pedsOk}`);
for (const e of errors.slice(0, 8)) console.log('  ERR:', e.slice(0, 250));
await browser.close();
// NOTE: Actions runners have NO GPU — SwiftShader software rendering gives
// ~3fps at medium. FPS is informational; real gates = errors + leaks + peds.
// avgFps > 1 sirf "page hang" catch karne ke liye hai.
const pedsOk = lastPeds && lastPeds.count > 0
  && (lastPeds.walking + lastPeds.panicking + lastPeds.down) === lastPeds.count;
const ok = errors.length === 0 && memGrowth < 150 && avgFps > 1 && pedsOk;
console.log(ok ? 'STRESS TEST PASSED ✅' : 'STRESS TEST FAILED ❌');
process.exitCode = ok ? 0 : 1;

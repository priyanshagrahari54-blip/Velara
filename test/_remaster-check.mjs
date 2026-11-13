import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 420, height: 194 }, isMobile: true });
await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 60000 });
await page.click('#v-play');
await page.waitForTimeout(4000);
const which = process.env.WHAT || 'police';
if (which === 'police') {
  const r1 = await page.evaluate(() => {
    const g = window.velara;
    g.police.reportCrime(1);
    return { wanted: g.police.wanted, stars: document.getElementById('v-wanted')?.textContent };
  });
  console.log('crime:', JSON.stringify(r1));
  await page.evaluate(() => {
    const g = window.velara;
    g._noRender = true;
    for (let i = 0; i < 240; i++) g._update(1 / 60);
    g._noRender = false;
  });
  const r2 = await page.evaluate(() => {
    const g = window.velara;
    const u = g.police.units[0];
    return { units: g.police.units.length, stars: document.getElementById('v-wanted')?.textContent,
      unitPos: u ? { x: +u.body.position.x.toFixed(0), z: +u.body.position.z.toFixed(0), kmh: +u.getSpeedKmh().toFixed(0) } : null,
      playerPos: { x: +g.player.position.x.toFixed(0), z: +g.player.position.z.toFixed(0) },
      lightbar: u && u.barMats ? 'flashing' : (u ? 'no-mats' : 'no-unit') };
  });
  console.log('chase4s:', JSON.stringify(r2));
} else {
  const r3 = await page.evaluate(() => {
    const g = window.velara;
    const v = g.vehicles.find(x => x.preset.glb && x.preset.glb.includes('velara-gt'));
    // wall-slam: building ki taraf 14 m/s side-velocity
    v.body.position.set(52, 1.0, 34);
    v.body.velocity.set(0, 0, 14);
    g._noRender = true;
    for (let i = 0; i < 100; i++) g._update(1 / 60);
    g._noRender = false;
    return { damage: +v.damage.toFixed(1), kmh: +v.getSpeedKmh().toFixed(0) };
  });
  console.log('crash-damage:', JSON.stringify(r3));
}
await browser.close();

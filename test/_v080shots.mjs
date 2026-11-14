// v0.8.0 screenshots ONLY (fresh page — sandbox-friendly, NOSHOT pattern)
// air + market-district gang + phone UI open
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(9000);
fs.mkdirSync('shots', { recursive: true });

const shots = [
  { path: 'shots/v080-air.png', px: 4, pz: 10, yaw: 2.4, pitch: 0.52, dist: 34 },
  // market district gang: pehla thug (-140,-142) ke paas se dekho
  { path: 'shots/v080-gang.png', px: -128, pz: -128, yaw: Math.PI * 0.75, pitch: 0.1, dist: 7 },
  { path: 'shots/v080-phone.png', openPhone: true, px: -50, pz: 6, yaw: 0.6, pitch: 0.25, dist: 12 },
];
for (const s of shots) {
  await page.evaluate((c) => {
    const g = window.velara;
    g.player.body.position.set(c.px, 1.05, c.pz);
    g.player.body.velocity.set(0, 0, 0);
    g.cameraRig.yaw = c.yaw; g.cameraRig.pitch = c.pitch; g.cameraRig.dist = c.dist;
    if (c.openPhone) g.ui.togglePhone(true);
    for (let i = 0; i < 30; i++) g._update(1 / 60);
  }, s);
  await page.waitForTimeout(800);
  await page.screenshot({ path: s.path, timeout: 60000 });
  console.log('shot:', s.path);
}
await browser.close();
console.log('done');

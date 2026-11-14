// v0.6.0 city screenshots ONLY (fresh page — sandbox-friendly)
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(9000);
fs.mkdirSync('shots', { recursive: true });

const shots = [
  { path: 'shots/v060-air.png', px: 4, pz: 10, yaw: 2.4, pitch: 0.52, dist: 34 },
  { path: 'shots/v060-shopfront.png', px: -36, pz: 3, yaw: -Math.PI / 2 + 0.3, pitch: 0.06, dist: 6.5 },
  { path: 'shots/v060-interior.png', px: -48, pz: 0, yaw: Math.PI / 2, pitch: 0.08, dist: 4.5 },
];
for (const s of shots) {
  await page.evaluate((c) => {
    const g = window.velara;
    g.player.body.position.set(c.px, 1.05, c.pz);
    g.player.body.velocity.set(0, 0, 0);
    g.cameraRig.yaw = c.yaw; g.cameraRig.pitch = c.pitch; g.cameraRig.dist = c.dist;
  }, s);
  await page.waitForTimeout(800);
  await page.screenshot({ path: s.path, timeout: 60000 });
  console.log('shot:', s.path);
}
await browser.close();
console.log('DONE');

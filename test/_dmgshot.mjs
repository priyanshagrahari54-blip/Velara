import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 440, height: 198 } });
await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 60000 });
await page.click('#v-play');
await page.waitForTimeout(5000);
const out = await page.evaluate(() => {
  const g = window.velara;
  const v = g.vehicles.find(x => x.preset.glb && x.preset.glb.includes('velara-gt'));
  v.body.position.set(52, 1.0, 34);
  v.body.velocity.set(0, 0, 16);
  g._noRender = true;
  for (let i = 0; i < 100; i++) g._update(1 / 60);
  g._noRender = false;
  // camera: dented front close-up
  const b = v.body.position;
  g.camera.position.set(b.x + 3.5, 1.6, b.z - 4.5);
  g.camera.lookAt(b.x, 0.8, b.z);
  if (g.postfx) g.postfx.composer.render(); else g.renderer.render(g.scene, g.camera);
  return { damage: +v.damage.toFixed(0) };
});
const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
fs.writeFileSync('shots/09-damage-dent.png', Buffer.from(data.split(',')[1], 'base64'));
console.log('damage-shot:', JSON.stringify(out));
await browser.close();

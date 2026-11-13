// v0.4.0 screenshot suite — har shot FRESH browser (2GB box OOM-safe)
import { chromium } from 'playwright';

const W = 440, H = 198;

const SHOTS = [
  { id: '01-golden-hour-plaza', phase: 'dusk', px: 14, pz: 22, cam: [16, 2.6, 30], look: [6, 1.1, 10] },
  { id: '02-golden-hour-driving', phase: 'dusk', px: 14, pz: 22, enterCar: true, followCar: true },
  { id: '03-night-street', phase: 'night', px: 14, pz: 22, cam: [18, 2.4, 32], look: [4, 1.4, 8] },
  { id: '04-night-car', phase: 'night', px: 10, pz: 18, cam: [12.5, 1.7, 17], look: [7, 0.9, 12], canvasOnly: true },
  { id: '05-morning-trees', phase: 'overcast', px: 40, pz: 48, cam: [52, 3.2, 62], look: [36, 1.6, 40] },
  { id: '06-day-riverside-green', phase: 'day', px: 20, pz: 100, cam: [34, 4.5, 116], look: [16, 1.8, 98], canvasOnly: true },
  { id: '07-day-downtown', phase: 'day', px: 95, pz: 60, cam: [86, 26, 44], look: [122, 22, 86], canvasOnly: true },
  { id: '08-action-fire', phase: 'dusk', px: 14, pz: 22, cam: [12, 2.2, 28], look: [8, 1.4, 14], fire: true, canvasOnly: true },
];

import fs from 'node:fs';
const ONLY = process.env.SHOT;
for (const S of SHOTS) {
  if (ONLY && S.id !== ONLY) continue;
  if (fs.existsSync(`shots/${S.id}.png`)) { console.log('skip:', S.id); continue; }
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.click('#v-play');
  await page.waitForTimeout(4500);
  await page.evaluate((S) => {
    const g = window.velara;
    g._noRender = true;
    // heavy kaam spread: pehle gaadi (dusk default par), phir night transition
    if (S.enterCar && g.mode !== 'car') g.toggleCar();
    if (S.phase === 'night') {
      // SwiftShader 2GB box: transition+PMREM ke DAURAN full lights = OOM.
      // Pehle hi thin kar do (screenshot-only; real GPU par sab chalte hain).
      let li = 0;
      g.scene.traverse((o) => { if (o.isPointLight) { o.visible = (li % 3 === 0); li++; } });
    }
    if (g.env.timeName !== S.phase) {
      g.env.setTime(S.phase);
      for (let i = 0; i < 160; i++) g._update(1 / 60);
    }
    g.player.position.set(S.px, 0.1, S.pz);
    if (g.player.physBody) g.player.physBody.position.set(S.px, 1.5, S.pz);
    for (let i = 0; i < 20; i++) g._update(1 / 60);
    if (S.fire) {
      g.ui.pad.fire = 1;
      for (let i = 0; i < 3; i++) g._update(1 / 60);
    }
    if (S.followCar && g.activeVehicle) {
      const b = g.activeVehicle.body.position;
      g.camera.position.set(b.x - 5.5, 2.8, b.z + 7.5);
      g.camera.lookAt(b.x + 2, 1.2, b.z - 2);
    } else {
      g.camera.position.set(S.cam[0], S.cam[1], S.cam[2]);
      g.camera.lookAt(S.look[0], S.look[1], S.look[2]);
    }
    if (g.postfx) g.postfx.composer.render();
    else g.renderer.render(g.scene, g.camera);
  }, S);
  await page.waitForTimeout(350);
  if (S.canvasOnly) {
    const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(`shots/${S.id}.png`, Buffer.from(data.split(',')[1], 'base64'));
  } else {
    await page.screenshot({ path: `shots/${S.id}.png` });
  }
  console.log('shot:', S.id);
  await browser.close();
}
console.log('ALL DONE');

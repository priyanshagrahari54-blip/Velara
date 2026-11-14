// v0.9.0 GTA-5 playthrough shots — start page, hero, tyre, HUD(touch), call, monsoon
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});

// ---- pass 1: desktop-ish viewport (start/hero/tyre/call/monsoon)
const page = await browser.newPage({ viewport: { width: 480, height: 220 } });   // lite
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

await page.click('#v-play');
await page.waitForTimeout(9000);

const set = (c) => page.evaluate((c) => {
  const g = window.velara;
  if (c.px !== undefined) {
    g.player.body.position.set(c.px, 1.05, c.pz);
    g.player.body.velocity.set(0, 0, 0);
  }
  if (c.yaw !== undefined) { g.cameraRig.yaw = c.yaw; g.cameraRig.pitch = c.pitch; g.cameraRig.dist = c.dist; }
  if (c.season) g.env.setSeason(c.season);
  if (c.rain !== undefined) g.env.setRain(c.rain);
  if (c.time) g.env.setTime(c.time);
  for (let i = 0; i < 8; i++) g._update(1 / 60);
}, c);

// 3. car tyre side view (wheel + ground)
await set({ px: 9.5, pz: 16, yaw: Math.PI + 0.4, pitch: -0.04, dist: 5.5 });
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/v090-tyre.png', timeout: 90000 });
console.log('shot: v090-tyre.png');

// 4. call incoming
await page.evaluate(() => { window.velara.calls.call('mom'); });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/v090-call.png', timeout: 90000 });
console.log('shot: v090-call.png');
await page.evaluate(() => { window.velara.calls.decline(); });

// 5. monsoon (rain + fog)
await set({ season: 'monsoon', rain: true, time: 'night' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/v090-monsoon.png', timeout: 90000 });
console.log('shot: v090-monsoon.png');
await page.close();

// ---- pass 2: touch HUD (fresh context, mobile)
const tctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const tpage = await tctx.newPage();
await tpage.goto(BASE + '/', { waitUntil: 'networkidle' });
await tpage.waitForTimeout(1500);
await tpage.click('#v-play');
await tpage.waitForTimeout(9000);
await tpage.screenshot({ path: 'shots/v090-hud-touch.png', timeout: 90000 });
console.log('shot: v090-hud-touch.png');
await tctx.close();

await browser.close();
console.log('done');

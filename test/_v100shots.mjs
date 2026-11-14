// v0.10.0 playthrough shots — story marker, finale call, night traffic,
// phone map marker, free-roam HUD. Sab 480x220 lite (2GB box safe).
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 480, height: 220 } });
page.setDefaultTimeout(90000);
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#v-play');
await page.waitForTimeout(9000);

const shot = (name) => page.screenshot({ path: 'shots/' + name, timeout: 90000 })
  .then(() => console.log('shot: ' + name));

// helper: teleport + camera + time
const set = (c) => page.evaluate((c) => {
  const g = window.velara;
  if (c.px !== undefined) {
    g.player.body.position.set(c.px, 1.05, c.pz);
    g.player.body.velocity.set(0, 0, 0);
  }
  if (c.yaw !== undefined) { g.cameraRig.yaw = c.yaw; g.cameraRig.pitch = c.pitch; g.cameraRig.dist = c.dist; }
  if (c.time) { g.env.setTime(c.time); g.env.update(3.0, g.camera); }
  for (let i = 0; i < 8; i++) g._update(1 / 60);
}, c);

// ---- 1. M5 goto marker (gold beacon + "The Meet" HUD) ----
await page.evaluate(() => {
  const g = window.velara;
  g.mode = 'foot';
  g.missions.reset();
  g.missions.index = 5;
  g.missions.update(g);          // marker spawn (-108,-64)
  g.player.body.position.set(-94, 1.05, -64);
  g.player.body.velocity.set(0, 0, 0);
});
await set({ px: -94, pz: -64, yaw: Math.PI / 2, pitch: 0.18, dist: 9 });
await page.waitForTimeout(900);
await shot('v100-marker.png');

// ---- 2. M10 finale call (Vikram m10done) + "The Reckoning" HUD ----
await page.evaluate(() => {
  const g = window.velara;
  g.missions.index = 10;
  g.missions.update(g);          // HUD set + Old Market marker
  g.calls.call('m10done');
});
await page.waitForTimeout(1400);
await shot('v100-story-call.png');
await page.evaluate(() => { window.velara.calls.state === 'ringing' && window.velara.calls.decline(); });

// ---- 3. night traffic (55% density + lights) ----
await page.evaluate(() => {
  const g = window.velara;
  g.mode = 'foot';
  g.missions.index = 11;         // free roam — koi mission marker nahi
  g.env.setTime('night');
  g.env.update(3.0, g.camera);
  // teen gaadiyan road par paas laao (deterministic frame)
  const T = g.traffic;
  T.cars.slice(0, 3).forEach((c, i) => {
    c.active = true;
    c.body.position.set(14, 0.85, 6 + i * 11);
    c.body.velocity.set(0, 0, 8);
    c.speed = 8;
  });
  g.player.body.position.set(19.5, 1.05, 18);
  g.player.body.velocity.set(0, 0, 0);
});
await set({ px: 19.5, pz: 18, yaw: Math.PI / 2 + 0.35, pitch: 0.12, dist: 8, time: 'night' });
await page.waitForTimeout(600);
await shot('v100-night-traffic.png');

// ---- 4. phone MAP tab — gold mission marker dot ----
await page.evaluate(() => {
  const g = window.velara;
  g.missions.reset();
  g.missions.index = 5;
  g.missions.update(g);          // marker wapas
  g.ui.togglePhone(true);
  g.ui.$('ph-tab-map') || null;
});
await page.evaluate(() => {
  const g = window.velara;
  const tab = document.querySelector('.ph-tab[data-tab="map"]');
  if (tab) tab.click();
});
await page.waitForTimeout(900);
await shot('v100-phone-map-marker.png');
await page.evaluate(() => { window.velara.ui.togglePhone(false); });

// ---- 5. FREE ROAM finale HUD (₹2.2L+) ----
await page.evaluate(() => {
  const g = window.velara;
  g.missions._clearMarker(g);
  g.missions.index = 11;
  g.money = 225600;
  g.ui.setMission(0, 'FREE ROAM', 'Sheher tera hai — guns, gaadiyan, gang war, pure freedom', '');
  for (let i = 0; i < 8; i++) g._update(1 / 60);
});
await set({ px: -94, pz: -64, yaw: Math.PI / 2 + 0.5, pitch: 0.22, dist: 10 });
await page.waitForTimeout(900);
await shot('v100-freeroam.png');

await browser.close();
console.log('V100 SHOTS DONE');

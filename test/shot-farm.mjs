// Single-scene screenshot capture (SCENE env var) — crash-isolated:
// har scene apna fresh browser process leta hai, ek fail ho toh baaki bachte hain.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const SCENE = process.env.SCENE || 'golden';
const OUT = process.env.OUT || `shots/${SCENE}.png`;
mkdirSync('shots', { recursive: true });

const scenes = {
  golden:  { time: 'dusk',  rain: false, yaw: Math.PI + 0.35, pitch: 0.16, dist: 9  },
  street:  { time: 'dusk',  rain: false, yaw: null,            pitch: null, dist: null }, // default gameplay cam
  night:   { time: 'night', rain: false, yaw: Math.PI + 0.35, pitch: 0.16, dist: 9  },
  rain:    { time: 'night', rain: true,  yaw: Math.PI - 0.5,  pitch: 0.14, dist: 10 },
  day:     { time: 'day',   rain: false, yaw: Math.PI + 0.35, pitch: 0.12, dist: 10 },
  skyline: { time: 'dusk',  rain: false, yaw: Math.PI + 0.35, pitch: 0.5,  dist: 26 },
};
const cfg = scenes[SCENE];
if (!cfg) { console.error('unknown scene:', SCENE); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => window.velara.quality.set('medium'));
await page.click('#v-play');
await page.waitForTimeout(4000); // intro + golden-hour settle
await page.evaluate((c) => {
  const g = window.velara;
  g.introT = 0;
  if (c.time && c.time !== 'dusk') g.env.setTime(c.time);
  if (c.rain) g.env.setRain(true);
  if (c.yaw !== null) g.cameraRig.yaw = c.yaw;
  if (c.pitch !== null) g.cameraRig.pitch = c.pitch;
  if (c.dist !== null) g.cameraRig.dist = c.dist;
}, cfg);
await page.waitForTimeout(3500); // time/rain cinematic transition settle
await page.evaluate(() => {
  const g = window.velara;
  for (let i = 0; i < 40; i++) g._update(1 / 60);
  g._noRender = true;
});
await page.waitForTimeout(600);
await page.screenshot({ path: OUT, timeout: 120000 });
await browser.close();
console.log('farm shot saved:', OUT);

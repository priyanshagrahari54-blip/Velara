import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => window.velara.quality.set('medium'));
await page.click('#v-play');
await page.waitForTimeout(6000);
const shot = async (name) => {
  await page.evaluate(() => { window.velara._noRender = true; });
  await page.waitForTimeout(1200);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.screenshot({ path: 'references/MS-' + name + '.png', timeout: 120000 });
      console.log('captured', name);
      break;
    } catch (e) { console.log('retry', name, attempt + 1); await page.waitForTimeout(2000); }
  }
  await page.evaluate(() => { window.velara._noRender = false; });
  await page.waitForTimeout(600);
};
const live = (ms) => page.waitForTimeout(ms);
const ev = (fn) => page.evaluate(fn);

await ev(() => { const g = window.velara; g.introT = 0; g.cameraRig.yaw = Math.PI + 0.35; g.cameraRig.pitch = 0.1; g.cameraRig.dist = 7.5; for (let i = 0; i < 40; i++) g._update(1 / 60); });
await live(3000); await shot('1-hero-car-goldenhour');

await ev(() => { const g = window.velara; g.cameraRig.dist = 4.2; g.cameraRig.pitch = 0.22; g.cameraRig.yaw = Math.PI + 1.2; for (let i = 0; i < 20; i++) g._update(1 / 60); });
await live(1200); await shot('2-car-closeup');

await ev(() => { const g = window.velara; g.env.setRain(true); for (let i = 0; i < 30; i++) g._update(1 / 60); });
await live(1500); await shot('3-rain-dusk');
await ev(() => { const g = window.velara; g.env.setRain(false); });

await ev(() => { const g = window.velara; if (g.mode === 'car') g.toggleCar(); g.player.body.position.set(98, 1.4, 0); g.weapons.select(2); g.setAimOverride(true); g.cameraRig.yaw = -Math.PI / 2; g.cameraRig.pitch = 0.02; for (let i = 0; i < 40; i++) g._update(1 / 60); });
await live(1200); await shot('4-shotgun-aim-range');
await ev(() => { const g = window.velara; g.setAimOverride(false); g.player.body.position.set(6.5, 1.1, 7.5); for (let i = 0; i < 20; i++) g._update(1 / 60); });

await ev(() => { const g = window.velara; g.env.setTime('night'); });
await live(3500); await shot('5-night-neon');
await ev(() => { const g = window.velara; g.env.setTime('dusk'); });
await live(3500);

await ev(() => { const g = window.velara; g.player.body.position.set(14, 1.2, -6); for (let i = 0; i < 10; i++) g._update(1 / 60); g.toggleCar(); g.cameraRig.yaw = Math.PI + 0.5; for (let i = 0; i < 30; i++) g._update(1 / 60); });
await live(1200); await shot('6-titan-muscle');
await ev(() => { const g = window.velara; g.toggleCar(); g.player.body.position.set(6.5, 1.1, 7.5); });

await ev(() => { const g = window.velara; g.cameraRig.pitch = 0.5; g.cameraRig.dist = 14; g.cameraRig.yaw = Math.PI; for (let i = 0; i < 20; i++) g._update(1 / 60); });
await live(1200); await shot('7-skyline-wide');

await browser.close();
console.log('all shots done');

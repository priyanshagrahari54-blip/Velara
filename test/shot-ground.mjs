import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.evaluate(() => window.velara.quality.set('medium'));
await page.click('#v-play');
await page.waitForTimeout(4000); // new shorter intro (2.4s) + settle
await page.evaluate(() => {
  const g = window.velara;
  g.introT = 0;
  // DEFAULT gameplay camera — no overrides: ground-level chase view
  for (let i = 0; i < 40; i++) g._update(1 / 60);
});
await page.evaluate(() => { window.velara._noRender = true; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'references/GROUND-CAM.png', timeout: 120000 });
await browser.close();
console.log('ground-cam screenshot saved');

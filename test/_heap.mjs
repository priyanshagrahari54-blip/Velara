import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 480, height: 220 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0,150)));
await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
await page.click('#v-play');
await page.waitForTimeout(2500);
await page.evaluate(() => { window.velara._noRender = true; });
await page.waitForTimeout(7000);   // GLB loads complete
const samples = await page.evaluate(async () => {
  const g = window.velara;
  const out = [];
  for (let round = 0; round < 10; round++) {
    for (let i = 0; i < 300; i++) g._update(1 / 60);   // 5s logic per round
    await new Promise((r) => setTimeout(r, 30));
    out.push(Math.round(performance.memory.usedJSHeapSize / 1048576));
  }
  return out;
});
console.log('heap MB over 50s logic:', samples.join(' -> '));
await browser.close();

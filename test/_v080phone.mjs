import { chromium } from 'playwright';
const browser = await chromium.launch({
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
await page.goto('http://localhost:3003/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(9000);
await page.evaluate(() => {
  const g = window.velara;
  g.player.body.position.set(-50, 1.05, 6);
  g.player.body.velocity.set(0, 0, 0);
  g.cameraRig.yaw = 0.6; g.cameraRig.pitch = 0.25; g.cameraRig.dist = 12;
  g.ui.togglePhone(true);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/v080-phone.png', timeout: 120000 });
console.log('phone shot done');
await browser.close();

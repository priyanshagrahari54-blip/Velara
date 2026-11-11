import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:3000/?profile=g560', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#v-play');
await page.waitForTimeout(3500); // intro (2.4s) + settle
const r = await page.evaluate(() => {
  const g = window.velara;
  let pointLights = 0, skylineVisible = 0;
  g.scene.traverse(o => {
    if (o.isPointLight && o.parent) pointLights++;
    if (o.isMesh && o.visible && o.material && o.material.emissiveMap
        && Math.hypot(o.position.x, o.position.z) > 200) skylineVisible++;
  });
  for (let i = 0; i < 40; i++) g._update(1 / 60);
  return {
    tier: g.quality.tier, label: g.quality.config.label,
    pixelRatio: g.renderer.getPixelRatio(),
    pointLights, skylineVisible,
    camY: +g.camera.position.y.toFixed(2),
    profile: g.profile,
  };
});
console.log(JSON.stringify(r));
console.log('console errors:', errors.length, errors.slice(0, 3));
await browser.close();
const ok = r.tier === 'g560' && r.pointLights <= 11 // 8 capped + fountain + muzzle-flash + range sign && r.skylineVisible === 0
  && r.camY < 3.5 && errors.length === 0;
console.log(ok ? 'G560 CHECK PASSED ✅' : 'G560 CHECK FAILED ❌');
process.exit(ok ? 0 : 1);

import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 420, height: 194 }, isMobile: true });
await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => window.velara && window.velara.start && window.velara.start());
await page.waitForTimeout(9000);
const info = await page.evaluate(() => {
  const g = window.velara;
  const inst = [];
  g.scene.traverse(o => { if (o.isInstancedMesh) inst.push({ geo: o.geometry?.attributes?.position?.count || 0, count: o.count, cast: o.castShadow }); });
  return { foliage: g.foliage?.counts, instanced: inst, clock: document.getElementById('v-clock')?.textContent };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

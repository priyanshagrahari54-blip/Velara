import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// G560 draw-call audit — lag diagnosis + optimization verification.
// ?profile=g560 boot -> intro force-finish -> 40 logic steps -> ek manual
// render -> renderer.info se draws/tris/geometries report karta hai.
// Usage: node test/g560-draws.mjs [label]
// ---------------------------------------------------------------------------
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto('http://localhost:3000/?profile=g560', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('#v-play');
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const g = window.velara;
  g.introT = 0;                       // slow cloud runners: dt-clamp intro stretch
  g.quality.set('g560');              // tier explicit (hardware detect 'low' ho sakta hai)
  for (let i = 0; i < 40; i++) g._update(1 / 60);
  const inf = g.renderer.info;
  inf.reset();
  g.renderer.render(g.scene, g.camera);   // manual direct render = scene ka asli cost
  const eff = (o) => { let p = o, v = true; while (p && v) { v = p.visible; p = p.parent; } return v; };
  let meshes = 0;
  g.scene.traverse(o => { if (o.isMesh && eff(o)) meshes++; });
  return {
    tier: g.quality.tier,
    draws: inf.render.calls,
    tris: inf.render.triangles,
    geoms: inf.memory.geometries,
    tex: inf.memory.textures,
    visibleMeshes: meshes,
  };
});
await browser.close();

const label = process.argv[2] || 'run';
console.log(`DRAWS_JSON[${label}] ` + JSON.stringify(r));
console.log('console errors:', errors.length, errors.slice(0, 3));
process.exit(errors.length ? 1 : 0);

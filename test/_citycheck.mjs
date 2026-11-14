// ---------------------------------------------------------------------------
// v0.6.0 CITY-KIT CHECK — mixed-city GLB buildings QA (dev server 3002 chalu)
//   1. kit load + merged buckets + collidables
//   2. GLB material census (Glass/WinGlow/Red/Wood/Screen/Plate)
//   3. WinGlow night hook (emissiveIntensity env.windowGlow se chalta hai?)
//   4. ENTERABLE shop: player door se andar PHYSICS walk (teeno shops)
//   5. FPS
//   6. screenshots (air / shopfront / interior)
// ---------------------------------------------------------------------------
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const errors = [];
const report = { errors, checks: [] };
const log = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${JSON.stringify(detail).slice(0, 260)}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(8000);   // GLB kit async load + bucket finalize

// ---- 1. kit state ----
const st = await page.evaluate(() => {
  const g = window.velara;
  return {
    hasCity: !!g.city,
    collidable: g.city ? g.city.collidableMeshes.length : 0,
    chunks: g.city ? g.city.chunkStats() : null,
  };
});
log('city-kit state', st.hasCity && st.collidable > 20 && st.chunks && st.chunks.total > 20, st);

// ---- 2. GLB material census ----
const census = await page.evaluate(() => {
  const g = window.velara;
  const counts = {};
  let tris = 0;
  g.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) counts[m.name] = (counts[m.name] || 0) + 1;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return { counts, tris: Math.round(tris) };
});
const need = ['Glass', 'SignGlow', 'Concrete', 'Red', 'Wood', 'Screen', 'Plate'];
const missing = need.filter((n) => !census.counts[n]);
log('GLB material census', missing.length === 0,
  { missing, tris: census.tris, Glass: census.counts.Glass, SignGlow: census.counts.SignGlow,
    Red: census.counts.Red, Wood: census.counts.Wood, Screen: census.counts.Screen, Plate: census.counts.Plate });

// ---- 3. WinGlow night hook (material _glowBase marker se — SignGlow winquads) ----
const glow = await page.evaluate(async () => {
  const g = window.velara;
  let mat = null;
  g.scene.traverse((o) => {
    if (mat || !o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.userData && m.userData._glowBase !== undefined) mat = m;
  });
  if (!mat) return { found: false };
  const day = mat.emissiveIntensity;
  g.env.setTime('night');
  // swiftshader par game-time slow — env transition ko DIRECT pump karo (dt/2.5)
  g.env.update(3.0, g.camera);
  g.city.update(0.05, g.env, null);
  const night = mat.emissiveIntensity;
  g.env.setTime('dusk');
  g.env.update(3.0, g.camera);
  g.city.update(0.05, g.env, null);
  return { found: true, name: mat.name, day: +day.toFixed(2), night: +night.toFixed(2), base: mat.userData._glowBase };
});
log('WinGlow night hook', glow.found && glow.night > glow.day + 0.5, glow);

// ---- 4. ENTERABLE shops: physics door-walk (teeno) ----
const walk = await page.evaluate(() => {
  const g = window.velara;
  const p = g.player.body;
  const tryDoor = (sx, sz, vx, vz, passX, passZ, want) => {
    p.position.set(sx, 1.05, sz);
    p.velocity.set(vx, 0, vz);
    p.angularVelocity.set(0, 0, 0);
    // NOTE: body damping velocity ko maar deta hai — har step re-apply
    // (real gameplay me input har frame velocity set karta hai)
    for (let i = 0; i < 110; i++) { p.velocity.set(vx, 0, vz); g.world.step(1 / 60); }
    const x = p.position.x, z = p.position.z;
    return { x: +x.toFixed(2), z: +z.toFixed(2), y: +p.position.y.toFixed(2),
             inside: want === 'x-' ? x < passX : want === 'x+' ? x > passX : want === 'z-' ? z < passZ : z > passZ };
  };
  // shop1: (−50,0) door world (−44,0) +X face — east se andar (x kam hota hai)
  const s1 = tryDoor(-40, 0, -5, 0, -46, 0, 'x-');
  // shop2: (42,−6) door world (36,−6) −X face — west se andar (x badhta hai)
  const s2 = tryDoor(32, -6, 5, 0, 40, 0, 'x+');
  // shop3: (−8,−50) door world (−8,−44) +Z face — north se andar (z kam hota hai)
  const s3 = tryDoor(-8, -40, 0, -5, 0, -48, 'z-');
  p.velocity.set(0, 0, 0);
  return { s1, s2, s3 };
});
log('enterable door 1 (west shop)', walk.s1.inside, walk.s1);
log('enterable door 2 (east shop)', walk.s2.inside, walk.s2)
log('enterable door 3 (south shop)', walk.s3.inside, walk.s3);

// player wapas plaza par (aage ke tests ke liye)
await page.evaluate(() => {
  const p = window.velara.player.body;
  p.position.set(0, 1.05, 6);
  p.velocity.set(0, 0, 0);
});

// ---- 5. FPS (game ka rolling counter — mobile-qa wala proven pattern) ----
const fps = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 2500));   // tier settle hone do
  const g = window.velara;
  return { fps: Math.round(g.quality.fps), tier: g.quality.tier };
});
log('fps (quality counter)', fps.fps >= 20, fps);

// ---- 6. screenshots (user review ke liye) — NOSHOT=1 skip ----
if (!process.env.NOSHOT) {
fs.mkdirSync('shots', { recursive: true });
await page.evaluate(() => {
  const g = window.velara;
  g.player.body.position.set(4, 1.05, 10);
  g.cameraRig.yaw = 2.4; g.cameraRig.pitch = 0.52; g.cameraRig.dist = 34;
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/v060-air.png', timeout: 60000 });

await page.evaluate(() => {
  const g = window.velara;
  g.player.body.position.set(-36, 1.05, 3);
  g.cameraRig.yaw = -Math.PI / 2 + 0.3; g.cameraRig.pitch = 0.06; g.cameraRig.dist = 6.5;
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/v060-shopfront.png', timeout: 60000 });

await page.evaluate(() => {
  const g = window.velara;
  g.player.body.position.set(-48, 1.05, 0);
  g.cameraRig.yaw = Math.PI / 2; g.cameraRig.pitch = 0.08; g.cameraRig.dist = 4.5;
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/v060-interior.png', timeout: 60000 });
}

// console errors (GLB 404 etc.)
log('console clean', errors.length === 0, { n: errors.length, first: errors.slice(0, 3) });

fs.writeFileSync('test/_citycheck.json', JSON.stringify(report, null, 1));
const fails = report.checks.filter((c) => !c.ok).length;
console.log(`\nCITYCHECK: ${report.checks.length - fails}/${report.checks.length} passed`);
await browser.close();
process.exit(fails ? 1 : 0);

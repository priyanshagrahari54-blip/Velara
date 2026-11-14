// door contact diagnostic v2 — collide events suno, blocker body pakdo
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.click('#v-play');
await page.waitForTimeout(7000);

const out = await page.evaluate(() => {
  const g = window.velara;
  const p = g.player.body;
  const hits = [];
  p.addEventListener('collide', (e) => {
    const b = e.body;
    hits.push({
      x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), y: +p.position.y.toFixed(2),
      other: b.shapes.map((s) => s.halfExtents ? `box(${s.halfExtents.x.toFixed(1)},${s.halfExtents.y.toFixed(1)},${s.halfExtents.z.toFixed(1)})` : s.type).join('+'),
      ox: +b.position.x.toFixed(2), oy: +b.position.y.toFixed(2), oz: +b.position.z.toFixed(2),
      qy: +b.quaternion.y.toFixed(3), qa: +Math.acos(b.quaternion.w) * 2 .toFixed?.(2),
    });
  });
  p.position.set(-40, 1.05, 0);
  p.velocity.set(0, 0, 0);
  for (let i = 0; i < 110; i++) {
    p.velocity.set(-5, 0, 0);
    g.world.step(1 / 60);
  }
  return { final: { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), y: +p.position.y.toFixed(2) }, hits: hits.slice(0, 8) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();

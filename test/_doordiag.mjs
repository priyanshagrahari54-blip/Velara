// door-path blocker diagnostic — konsa static body raasta band karta hai
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
  const doors = [
    { label: 'shop1 west', x: -44, z: 0 },
    { label: 'shop2 east', x: 36, z: -6 },
    { label: 'shop3 south', x: -8, z: -44 },
  ];
  const res = [];
  for (const d of doors) {
    const near = [];
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue;
      const dx = b.position.x - d.x, dz = b.position.z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7) {
        let desc = b.shapes.map((s) => s.halfExtents ? `box(${s.halfExtents.x.toFixed(2)},${s.halfExtents.y.toFixed(2)},${s.halfExtents.z.toFixed(2)})` : s.type).join('+');
        near.push({ d: +dist.toFixed(2), x: +b.position.x.toFixed(2), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(2), desc });
      }
    }
    near.sort((a, b) => a.d - b.d);
    res.push({ door: d.label, bodies: near.slice(0, 10) });
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();

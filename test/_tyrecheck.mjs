// v0.9.0 TYRE CHECK — GLB wheel vs physics wheel vs ground measurement
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3003';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(8000);

const m = await page.evaluate(() => {
  const g = window.velara;
  const out = { vehicles: [] };
  for (const v of g.vehicles) {
    const info = {
      name: v.preset.name,
      glb: !!v.glbModel,
      wheelR: v.preset.wheelR,
      bodyY: +v.body.position.y.toFixed(3),
    };
    // physics wheel centers
    v.vehicle.updateWheelTransform(0);
    const wt = v.vehicle.wheelInfos[0].worldTransform;
    info.physWheelY = +wt.position.y.toFixed(3);
    info.physBottom = +(wt.position.y - v.preset.wheelR).toFixed(3);
    // GLB wheel bbox
    const bboxY = (obj) => {
      let miny = Infinity, maxy = -Infinity;
      obj.updateMatrixWorld(true);
      obj.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
        const p = o.geometry.attributes.position;
        const m = o.matrixWorld.elements;
        for (let i = 0; i < p.count; i++) {
          const wy = m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13];
          if (wy < miny) miny = wy;
          if (wy > maxy) maxy = wy;
        }
      });
      return { miny, maxy };
    };
    if (v.glbWheels && v.glbWheels[0]) {
      const gw = v.glbWheels[0];
      const b = bboxY(gw);
      info.glbWheelPos = +gw.position.y.toFixed(3);
      info.glbWheelCenterY = +((b.miny + b.maxy) / 2).toFixed(3);
      info.glbBottom = +b.miny.toFixed(3);
      info.glbTop = +b.maxy.toFixed(3);
      info.originOffsetY = +(info.glbWheelCenterY - info.glbWheelPos).toFixed(3);
    }
    if (v.glbModel) {
      const bb = bboxY(v.glbModel);
      info.glbBodyBottom = +bb.miny.toFixed(3);
    }
    out.vehicles.push(info);
  }
  // road surface: ek road mesh ka top (city chunks se) — ya ground plane y
  out.groundY = 0;
  return out;
});
console.log(JSON.stringify(m, null, 1));
await browser.close();

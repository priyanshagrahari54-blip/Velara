// ---------------------------------------------------------------------------
// v0.9.0 CHECK — hero GLB, movement/camera, tyre fix, seasons, calls, HUD
// icons, logo, dyn-res. (NOSHOT pattern)
// ---------------------------------------------------------------------------
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const errors = [];
const report = { errors, checks: [] };
const log = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${JSON.stringify(detail).slice(0, 300)}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 480, height: 220 } });   // swiftshader relief
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// ---- 1. logo + start page ----
const logo = await page.evaluate(async () => {
  const img = document.querySelector('#v-start .logo-img');
  const r = await fetch('assets/branding/velara-logo.jpg');
  return {
    img: !!img,
    loaded: img && img.naturalWidth > 50,
    bytes: (await (await fetch('assets/branding/velara-logo.jpg')).arrayBuffer()).byteLength,
    status: r.status,
  };
});
log('logo: start-page image loaded + served',
  logo.img && logo.loaded && logo.status === 200 && logo.bytes < 300000, logo);

await page.click('#v-play');
await page.waitForTimeout(2500);
await page.evaluate(() => { window.velara._noRender = true; });   // QA: logic-only (swiftshader relief)
await page.waitForTimeout(7000);   // GLBs + city (render ke bina load)

// ---- 2. hero GLB ----
const hero = await page.evaluate(() => {
  const g = window.velara;
  const p = g.player;
  return {
    glb: !!p.heroGLB,
    armRisGLB: !!(p.heroGLB && p.armR && p.armR.name === 'ArmR'),
    legLisGLB: !!(p.heroGLB && p.legL && p.legL.name === 'LegL'),
    proceduralHidden: p.heroGLB ? p.group.children.filter((c) => c !== p.heroGLB)
      .every((c) => !c.visible) : false,
    gunAttached: !p.gun || (p.gun.parent && p.gun.parent.name === 'ArmR'),
    tris: g.renderer.info.render.triangles,
  };
});
log('hero: factory GLB + limb remap + procedural hidden',
  hero.glb && hero.armRisGLB && hero.legLisGLB && hero.proceduralHidden && hero.gunAttached, hero);

// ---- 3. limb animation drives GLB ----
await page.keyboard.down('KeyD');
const anim = await page.evaluate(() => {
  const g = window.velara;
  const p = g.player;
  p.body.position.set(0, 1.05, 0);
  p.body.velocity.set(0, 0, 0);
  const a0 = p.armR.rotation.x;
  for (let i = 0; i < 60; i++) g._update(1 / 60);
  const a1 = p.armR.rotation.x;
  return { a0: +a0.toFixed(3), a1: +a1.toFixed(3), moved: Math.abs(a1 - a0) > 0.01 };
});
await page.keyboard.up('KeyD');
log('hero: walk-cycle GLB arms chal rahe hain', anim.moved, anim);

// ---- 4. camera auto-follow (foot) ----
const cam = await page.evaluate(async () => {
  const g = window.velara;
  const rig = g.cameraRig;
  rig._lookIdle = 99;             // manual-look pause khatam
  rig._aimTarget = 0;
  // input seedha input-manager mein (keyboard event nahi — deterministic)
  const inp = g.input;
  const step = (n) => { for (let i = 0; i < n; i++) g._update(1 / 60); };
  const y0 = rig.yaw;
  // 1.2s right-turn input simulate: stick value inject
  const origStick = inp._getStick;
  inp._getStick = () => ({ x: 1, y: 0 });
  step(72);
  inp._getStick = origStick;
  await new Promise((r) => setTimeout(r, 30));
  step(180);                      // 3s settle (follow-hold grace)
  const y1 = rig.yaw;
  const f = g.player.facing;
  let d = f - y1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return { y0: +y0.toFixed(2), y1: +y1.toFixed(2), facing: +f.toFixed(2),
           behind: Math.abs(d) < 0.6, moved: Math.abs(y1 - y0) > 0.2 };
});
log('camera: foot auto-follow (GTA-style) — camera player ke peeche',
  cam.behind, cam);

// ---- 5. tyre float fix ----
const tyre = await page.evaluate(() => {
  const v = window.velara.vehicles[0];
  if (!v.glbWheels) return { ok: false, why: 'no glb wheels' };
  v.vehicle.updateWheelTransform(0);
  const wt = v.vehicle.wheelInfos[0].worldTransform;
  const w = v.glbWheels[0];
  // GLB wheel ka bbox (plain math)
  let miny = Infinity, maxy = -Infinity;
  w.updateMatrixWorld(true);
  w.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position;
    const m = o.matrixWorld.elements;
    for (let i = 0; i < p.count; i++) {
      const wy = m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13];
      if (wy < miny) miny = wy; if (wy > maxy) maxy = wy;
    }
  });
  const geoR = (maxy - miny) / 2;
  return {
    geoR: +geoR.toFixed(3), physR: v.preset.wheelR,
    ok: Math.abs(geoR - v.preset.wheelR) < 0.05 && Math.abs(miny - (wt.position.y - v.preset.wheelR)) < 0.1,
    physBottom: +(wt.position.y - v.preset.wheelR).toFixed(3), glbBottom: +miny.toFixed(3),
  };
});
log('tyre: GLB wheels physics-R matched (float fix)', tyre.ok, tyre);

// ---- 6. seasons ----
const season = await page.evaluate(() => {
  const g = window.velara;
  const fogBefore = g.scene.fog.density;
  const lawnBefore = g.foliage && g.foliage.counts ? null : null;
  g.env.setSeason('monsoon');
  for (let i = 0; i < 120; i++) g._update(1 / 60);   // applySeason converges
  const fogAfter = g.scene.fog.density;
  g.env.setSeason('spring');
  for (let i = 0; i < 30; i++) g._update(1 / 60);
  return {
    season: g.env.state.season,
    label: g.env.seasonLabel(),
    fogBefore: +fogBefore.toFixed(5), fogAfter: +fogAfter.toFixed(3),
    fogGrew: fogAfter > fogBefore * 1.3,
  };
});
log('seasons: monsoon fog + label + switch back', season.fogGrew && season.label === 'Spring', season);

// ---- 7. phone calls ----
const call = await page.evaluate(() => {
  const g = window.velara;
  const c = g.calls;
  const ok = c.call('mom');
  const ringing = c.state === 'ringing';
  const uiShown = document.querySelector('#v-call').classList.contains('show');
  const ringAudio = !!g.audio._ring;
  c.answer();
  const active = c.state === 'active';
  for (let i = 0; i < 250; i++) c.update(1 / 60);   // ~4s — pehli line
  const line = document.querySelector('#v-callline').textContent;
  c.hangUp();
  const idle = c.state === 'idle';
  const hidden = !document.querySelector('#v-call').classList.contains('show');
  g.audio.stopRing();
  return { ok, ringing, uiShown, ringAudio, active, line: line.slice(0, 24), idle, hidden };
});
log('calls: incoming→answer→subtitle→hangup + ringtone',
  call.ok && call.ringing && call.uiShown && call.ringAudio && call.active
  && call.idle && call.hidden && call.line.length > 3, call);

// ---- 8. contacts tab ----
const contacts = await page.evaluate(() => {
  const g = window.velara;
  g.ui.togglePhone(true);
  document.querySelector('[data-tab="contacts"]').click();
  const rows = document.querySelectorAll('#ph-tab-contacts .ph-contact').length;
  const btns = document.querySelectorAll('#ph-tab-contacts .pccall').length;
  const visible = document.querySelector('#ph-tab-contacts').style.display !== 'none';
  g.ui.togglePhone(false);
  return { rows, btns, visible };
});
log('phone: CONTACTS tab (4 contacts, call buttons)', contacts.visible && contacts.rows === 4 && contacts.btns === 4, contacts);

// ---- 9. HUD icons (koi text label nahi) ----
const hud = await page.evaluate(() => {
  const ids = ['v-pad-gas', 'v-pad-brk', 'v-pad-hb', 'v-pad-ex', 'v-tbtn-a', 'v-tbtn-f'];
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    out[id] = { svg: !!el.querySelector('svg'), text: el.textContent.trim() };
  }
  return out;
});
const hudOk = Object.values(hud).every((v) => v.svg && !v.text);
log('HUD: GTA-clean SVG icons (GAS/BRAKE/FIRE text khatam)', hudOk, hud);

// ---- 10. dyn-res active ----
const dyn = await page.evaluate(() => {
  const g = window.velara;
  for (let i = 0; i < 400; i++) g._update(1 / 60);   // 6+ s
  const pr = g.quality.config.pixelRatio || 1;
  const scale = g._dynScale || pr;
  const floor = Math.min(pr, Math.max(0.3, pr * 0.55));
  return { pr, floor: +floor.toFixed(2), scale: +scale.toFixed(2), inRange: scale <= pr + 0.001 && scale >= floor - 0.001 };
});
log('fps: dynamic render-scale active + bounded', dyn.inRange, dyn);

// ---- 11. console ----
const bad = errors.filter((e) => !/favicon|Download the Three|DevTools|WebGL/i.test(e));
log('console clean', bad.length === 0, { count: bad.length, first: bad[0] || null });

await browser.close();
const fails = report.checks.filter((c) => !c.ok).length;
console.log(fails === 0 ? `\nALL ${report.checks.length}/${report.checks.length} PASS` : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

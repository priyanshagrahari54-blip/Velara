// ---------------------------------------------------------------------------
// v0.8.0 GANG + PHONE + VFX + AUDIO-SAMPLES CHECK (NOSHOT pattern — no screenshots)
//   1. phone UI: open/close, tabs, toggles
//   2. gang: 6 thugs NW market district, alive, hitboxes in world
//   3. gang AI: player paas → alert/attack state
//   4. combat: takeDamage → kill → loot + wanted
//   5. respawn: timer ke baad wapas
//   6. vfx: burst spawn + update, no crash
//   7. audio: sample layer (10 WAVs) load + sfx() no-crash
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
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('#v-play');
await page.waitForTimeout(6000);   // city load + audio samples fetch

// ---- 1. phone UI ----
const ph = await page.evaluate(() => {
  const r = {};
  r.btn = !!document.querySelector('#v-phonebtn');
  r.el = !!document.querySelector('#v-phone');
  document.querySelector('#v-phonebtn').click();
  r.openAfter = document.querySelector('#v-phone').classList.contains('open');
  document.querySelector('[data-tab="stats"]').click();
  r.statsVisible = document.querySelector('#ph-tab-stats').style.display !== 'none';
  r.mapHidden = document.querySelector('#ph-tab-map').style.display === 'none';
  document.querySelector('[data-tab="settings"]').click();
  const t = document.querySelector('#ph-tgl-music');
  t.click();
  r.toggledOff = !t.classList.contains('on');
  t.click();
  r.toggledOn = t.classList.contains('on');
  document.querySelector('#v-phoneclose').click();
  r.closed = !document.querySelector('#v-phone').classList.contains('open');
  return r;
});
log('phone: open/close/tabs/toggles',
  ph.btn && ph.el && ph.openAfter && ph.statsVisible && ph.mapHidden && ph.toggledOff && ph.toggledOn && ph.closed,
  ph);

// ---- 2. gang spawn state ----
const gs = await page.evaluate(() => {
  const g = window.velara;
  const t = g.gang.thugs;
  return {
    n: t.length,
    alive: t.filter((x) => !x.dead).length,
    nw: t.filter((x) => x.mesh.position.x < -60 && x.mesh.position.z < -60).length,
    bodiesInWorld: t.every((x) => !!x.body.world),
    kills: g.gang.kills,
  };
});
log('gang: 6 thugs NW market, alive, hitboxed',
  gs.n === 6 && gs.alive === 6 && gs.nw >= 3 && gs.bodiesInWorld, gs);

// ---- 3. gang AI states ----
const ai = await page.evaluate(() => {
  const g = window.velara;
  const p = g.player.body;
  const t = g.gang.thugs[0];
  // player ko thug ke paas le jao
  p.position.set(t.mesh.position.x + 26, 1.05, t.mesh.position.z);
  for (let i = 0; i < 30; i++) g._update(1 / 60);
  const near = t.state;
  p.position.set(t.mesh.position.x + 8, 1.05, t.mesh.position.z);
  for (let i = 0; i < 10; i++) g._update(1 / 60);
  const attack = t.state;
  // door le jao — idle wapas
  p.position.set(120, 1.05, 120);
  for (let i = 0; i < 10; i++) g._update(1 / 60);
  const far = t.state;
  return { near, attack, far };
});
log('gang AI: idle→alert(26m)→attack(8m)→idle(far)',
  ai.near === 'alert' && ai.attack === 'attack' && ai.far === 'idle', ai);

// ---- 4. combat: kill → loot + wanted ----
const cb = await page.evaluate(() => {
  const g = window.velara;
  const t = g.gang.thugs[1];
  const m0 = g.money, w0 = g.police.wanted;
  g.player.body.position.set(t.mesh.position.x + 10, 1.05, t.mesh.position.z);
  g._update(1 / 60);
  const r1 = g.gang.takeDamage(t.body, 60);   // flinch — damage
  const hpMid = t.hp;
  const r2 = g.gang.takeDamage(t.body, 80);   // kill
  return {
    dmg1: r1 === true && hpMid <= 40,
    killed: r2 === true && t.dead,
    loot: g.money > m0,
    wanted: g.police.wanted > w0,
    kills: g.gang.kills,
  };
});
log('combat: damage + kill + loot + wanted', cb.dmg1 && cb.killed && cb.loot && cb.wanted && cb.kills === 1, cb);

// ---- 5. respawn ----
const rs = await page.evaluate(() => {
  const g = window.velara;
  const t = g.gang.thugs[1];
  t.respawnT = 0.05;
  for (let i = 0; i < 10; i++) g._update(1 / 60);
  return { alive: !t.dead, hp: t.hp, upright: t.mesh.rotation.z === 0 };
});
log('respawn: 35s timer ke baad wapas', rs.alive && rs.hp === 100 && rs.upright, rs);

// ---- 6. vfx ----
const vf = await page.evaluate(() => {
  const g = window.velara;
  g.vfx.burst(0, 1, 0, 0x9a8a78, 12, 2.5, 0.5);
  g.vfx.update(1 / 60, g.cameraRig.camera || g.camera);
  const vis = g.vfx.parts.filter((p) => p.mesh.visible).length;
  for (let i = 0; i < 60; i++) g.vfx.update(1 / 60, null);
  const gone = g.vfx.parts.filter((p) => p.mesh.visible).length;
  return { vis, gone };
});
log('vfx: burst spawn + decay', vf.vis >= 10 && vf.gone === 0, vf);

// ---- 7. audio sample layer ----
// NOTE: headless QA mein decode skip hota hai (renderer-crash guard) — wahan
// fetch-200 + no-crash assert hota hai; real browser mein 10 samples load.
const au = await page.evaluate(async () => {
  const g = window.velara;
  const names = Object.keys(g.audio.samples || {});
  const res = await fetch('assets/audio/pickup.wav');
  g.audio.sfx('pickup', 0.5);          // no-crash
  g.audio.footstep();                  // no-crash
  g.audio.setSiren(true, 0.3);         // no-crash
  g.audio.setSiren(false);             // no-crash
  return { n: names.length, headless: navigator.webdriver === true, wav200: res.status === 200 };
});
log('audio: WAVs served + sfx/step/siren no-crash (headless=decode-skip)',
  au.wav200 && (au.headless ? true : au.n >= 9), au);

// ---- console errors filter (sirf game-relevant) ----
const bad = errors.filter((e) => !/favicon|Download the Three|DevTools|WebGL/i.test(e));
log('console clean', bad.length === 0, { count: bad.length, first: bad[0] || null });

await browser.close();
const fails = report.checks.filter((c) => !c.ok).length;
console.log(fails === 0 ? `\nALL ${report.checks.length}/${report.checks.length} PASS` : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

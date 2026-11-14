// ---------------------------------------------------------------------------
// v0.10.0 CHECK — story mission chain, markers, traffic overhaul.
// SAFE architecture (2GB box): _noRender turant, har chain-step APNA evaluate
// (koi single mega-evaluate nahi — main-thread block wedge kar deta tha),
// M9 loop chunked (evadeT-freeze + foot mode = no bust), 240s watchdog
// force-close taaki orphan chromium kabhi na bache.
// ---------------------------------------------------------------------------
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const errors = [];
const report = { errors, checks: [] };
const log = (name, ok, detail) => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${JSON.stringify(detail).slice(0, 340)}`);
};
const p = (s) => console.log('.. ' + s);

let browser = null;
const WD = setTimeout(() => {
  console.log('!! WATCHDOG FIRED — force close');
  try { browser && browser.close(); } catch {}
  process.exit(9);
}, 240000);
process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED: ' + (e && e.message));
  try { browser && browser.close(); } catch {}
  process.exit(2);
});

try {
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
  });
  const page = await browser.newPage({ viewport: { width: 480, height: 220 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.click('#v-play', { timeout: 20000 });
  await page.evaluate(() => { window.velara._noRender = true; });   // turant — live render minimal
  await page.waitForTimeout(1500);

  const step = (n) => page.evaluate((n) => {
    for (let i = 0; i < n; i++) window.velara._update(1 / 60);
  }, n);
  const state = () => page.evaluate(() => {
    const g = window.velara;
    return { idx: g.missions.index, sub: g.missions.subPhase, marker: !!g.missionMarker, money: g.money };
  });

  // ---- 1+2. story chain M1→M10, chunked steps ----
  const chain = [];
  const rec = (tag) => state().then((s) => { chain.push([tag, s.idx, s.marker]); p(tag + ' → ' + JSON.stringify(s)); });

  // M1: pickups
  await page.evaluate(() => { window.velara.pickupsCollected = 5; });
  await step(2); await rec('M1→2');
  // M2: speed
  await page.evaluate(() => { const g = window.velara; g.mode = 'car'; g.car.getSpeedKmh = () => 120; });
  await step(80); await rec('M2→3');
  // M3: crates
  await page.evaluate(() => { window.velara.cratesDestroyed = 8; });
  await step(2); await rec('M3→4');
  // M4: range
  await page.evaluate(() => { const g = window.velara; g.rangeHits = g.missions.rangeBase + 6; });
  await step(2); await rec('M4→5');
  // M5: goto meet
  await page.evaluate(() => { const g = window.velara; g.mode = 'foot'; g.player.body.position.set(-108, 1.05, -64); });
  await step(3); await rec('M5→6');
  // M6: pickup + drop
  await page.evaluate(() => { window.velara.player.body.position.set(62, 1.05, -118); });
  await step(3);
  await page.evaluate(() => { window.velara.player.body.position.set(-108, 1.05, -64); });
  await step(3); await rec('M6→7');
  // M7: 3 kills
  await page.evaluate(() => {
    const g = window.velara;
    for (let k = 0; k < 3; k++) {
      const t = g.gang.thugs.find((x) => !x.dead);
      g.gang.takeDamage(t.body, 200);
    }
  });
  await step(3); await rec('M7→8');
  // M8: deliver low-damage
  await page.evaluate(() => {
    const g = window.velara;
    g.mode = 'car';
    g.activeVehicle.damage = 10;
    g.activeVehicle.body.position.set(24, 1.0, 14);
  });
  await step(3); await rec('M8→9');
  // M9: 2-star → 45s survive → evade (foot = no bust; evadeT freeze = no decay)
  await page.evaluate(() => {
    const g = window.velara;
    g.mode = 'foot';
    g.police.clear();            // clean slate (crimeCd bhi reset hota hai)
    g.police.reportCrime(2);     // w = 2
  });
  await step(2);
  let sub = -1, chunks = 0;
  for (let c = 0; c < 30; c++) {
    sub = await page.evaluate(() => {
      const g = window.velara;
      for (let i = 0; i < 100; i++) g._update(1 / 60);
      g.police.evadeT = 0;   // QA: decay freeze — survival timer ka isolated test
      return g.missions.subPhase;
    });
    chunks++;
    if (sub === 2) break;
  }
  await page.evaluate(() => { window.velara.police.clear(); });
  await step(3); await rec('M9→10');
  chain.push(['M9 chunks', chunks, sub]);
  // M10: 6 kills finale
  await page.evaluate(() => {
    const g = window.velara;
    for (let k = 0; k < 6; k++) {
      const t = g.gang.thugs.find((x) => !x.dead);
      if (t) g.gang.takeDamage(t.body, 200);
    }
  });
  await step(3); await rec('M10→free');
  const fin = await state();

  const idx = (n) => chain.find((x) => x[0] === n);
  log('story: M1→M10 chain complete',
    idx('M1→2')[1] === 2 && idx('M2→3')[1] === 3 && idx('M3→4')[1] === 4 &&
    idx('M4→5')[1] === 5 && idx('M5→6')[1] === 6 && idx('M6→7')[1] === 7 &&
    idx('M7→8')[1] === 8 && idx('M8→9')[1] === 9 && idx('M9→10')[1] === 10 &&
    fin.idx === 11 && idx('M4→5')[2] === true && idx('M5→6')[2] === true && fin.marker === false,
    { chain: chain.map((c) => c[0] + ':' + c[1]), sub9: sub, chunks9: chunks });
  log('story: finale payout (₹2.2L+ total)', fin.money >= 220000, { money: fin.money });

  // ---- 3. marker beacon lifecycle ----
  const marker = await page.evaluate(() => {
    const g = window.velara;
    g.mode = 'foot';
    g.player.body.position.set(0, 1.05, 0);   // marker se door — warna same-tick complete
    g._update(1 / 60);                         // mesh sync
    g.missions.reset();
    g.missions.index = 5;
    g.missions.update(g);
    const has = !!g.missionMarker;
    const inScene = has && g.scene.children.includes(g.missionMarker.group);
    g.missions._clearMarker(g);
    return { has, inScene, cleared: !g.missionMarker };
  });
  log('marker: beacon spawn + scene + clear', marker.has && marker.inScene && marker.cleared, marker);

  // ---- 4. traffic: night density + car-ahead spacing ----
  const traffic = await page.evaluate(() => {
    const g = window.velara;
    const T = g.traffic;
    T.update(1 / 60, [], { timeName: 'night' });
    const nightActive = T.cars.filter((c) => c.active).length;
    T.update(1 / 60, [], { timeName: 'day' });
    const dayActive = T.cars.filter((c) => c.active).length;
    const c0 = T.cars[0], c1 = T.cars[1];
    c0.active = true; c1.active = true;
    c0.axis = 'z'; c0.road = T.ROADS[1]; c0.dir = 1; c0.base = 14; c0.speed = 14; c0.blockedT = 0;
    c1.axis = 'z'; c1.road = T.ROADS[1]; c1.dir = 1; c1.base = 14; c1.speed = 14;
    c0.body.position.set(T.ROADS[1] + 3.6, 0.85, 10);
    c1.body.position.set(T.ROADS[1] + 3.6, 0.85, 20);   // c1 10m aage
    for (let i = 0; i < 240; i++) T.update(1 / 60, [], { timeName: 'day' });
    return { nightActive, dayActive, total: T.cars.length, spacing: c0.speed < 13 };
  });
  log('traffic: night density + car-ahead spacing',
    traffic.nightActive < traffic.dayActive && traffic.spacing && traffic.dayActive === traffic.total, traffic);

  // ---- 5. honk trigger (block karke) + game-side wiring ----
  const honk = await page.evaluate(() => {
    const g = window.velara;
    const T = g.traffic;
    const gameWired = typeof T.onHonk === 'function';   // game.js ka dist-falloff sfx hook
    let honks = 0;
    T.onHonk = () => honks++;
    const c = T.cars[2];
    c.active = true; c.base = 14; c.speed = 0; c.blockedT = 0; c.honkCd = 0;
    const fx = c.axis === 'z' ? 0 : c.dir;
    const fz = c.axis === 'z' ? c.dir : 0;
    const av = { x: c.body.position.x + fx * 6, z: c.body.position.z + fz * 6 };
    for (let i = 0; i < 180; i++) T.update(1 / 60, [av], { timeName: 'day' });
    return { honks, speed: +c.speed.toFixed(1), gameWired };
  });
  log('traffic: block → honk (audio hook)', honk.honks >= 1 && honk.speed < 1 && honk.gameWired, honk);

  // ---- 6. calls: story lines wired (queue-flush — m10done tak) ----
  const storyCall = await page.evaluate(() => {
    const g = window.velara;
    let found = null, left = -1;
    for (let i = 0; i < 20; i++) {
      if (g.calls.state === 'ringing') {
        const nm = g.calls.contact ? g.calls.contact.name : '';
        if (/Vikram/i.test(nm)) { found = nm; break; }
        g.calls.decline();
      } else if (g.calls._queue && g.calls._queue.length) {
        g._update(1 / 60);   // dequeue tick
      } else break;
    }
    left = g.calls._queue ? g.calls._queue.length : -1;
    if (found && g.calls.state === 'ringing') g.calls.decline();
    return { found, state: g.calls.state, queueLeft: left };
  });
  log('calls: m10done finale script', !!storyCall.found, storyCall);

  // ---- 7. console ----
  const bad = errors.filter((e) => !/favicon|Download the Three|DevTools|WebGL/i.test(e));
  log('console clean', bad.length === 0, { count: bad.length, first: bad[0] || null });
} finally {
  clearTimeout(WD);
  try { browser && browser.close(); } catch {}
}

const fails = report.checks.filter((c) => !c.ok).length;
console.log(fails === 0 ? `\nALL ${report.checks.length}/${report.checks.length} PASS` : `\n${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);

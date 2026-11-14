// probe: v10-check kahan hang hota hai — stage-wise prints
import { chromium } from 'playwright';

const BASE = process.env.VELARA_BASE || 'http://localhost:3002';
const p = (s) => console.log(new Date().toISOString().slice(11, 19) + '  ' + s);

process.on('unhandledRejection', (e) => { console.error('UNHANDLED', e); process.exit(2); });

p('launching chromium...');
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio'],
});
p('launched OK');
const page = await browser.newPage({ viewport: { width: 480, height: 220 } });
page.on('pageerror', (e) => p('PAGEERROR: ' + e.message.slice(0, 200)));

p('goto...');
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
p('goto done');
await page.waitForTimeout(1500);
p('click #v-play...');
await page.click('#v-play', { timeout: 15000 });
p('clicked');
await page.waitForTimeout(2500);
const hasV = await page.evaluate(() => !!window.velara);
p('window.velara = ' + hasV);
await page.evaluate(() => { window.velara._noRender = true; });
p('_noRender set');
await page.waitForTimeout(3000);
p('wait done — now stepping _update x 60');
const r = await page.evaluate(() => {
  for (let i = 0; i < 60; i++) window.velara._update(1 / 60);
  return window.velara.missions ? window.velara.missions.index : 'NO_MISSIONS';
});
p('60 _update OK, mission index = ' + JSON.stringify(r));

p('stepping _update x 300 (M9-style bulk)...');
const r2 = await page.evaluate(() => {
  for (let i = 0; i < 300; i++) window.velara._update(1 / 60);
  return window.velara.missions.index;
});
p('300 _update OK, index = ' + JSON.stringify(r2));

p('traffic direct update x 240...');
const r3 = await page.evaluate(() => {
  const T = window.velara.traffic;
  for (let i = 0; i < 240; i++) T.update(1 / 60, [], { timeName: 'day' });
  return T.cars.length;
});
p('traffic 240 OK, cars = ' + r3);

p('calls m10done...');
const r4 = await page.evaluate(() => {
  const ok = window.velara.calls.call('m10done');
  const contact = window.velara.calls.contact ? window.velara.calls.contact.name : null;
  window.velara.calls.decline();
  return { ok, contact };
});
p('calls OK ' + JSON.stringify(r4));

await browser.close();
p('PROBE ALL OK');

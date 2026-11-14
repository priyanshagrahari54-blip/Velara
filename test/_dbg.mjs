import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type()==='error') console.log('CERR', m.text().slice(0,150)); });
await page.goto('http://localhost:3003/', { waitUntil: 'networkidle' });
await page.click('#v-play');
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
  const g = window.velara;
  return {
    hasAudio: !!g.audio,
    ctor: g.audio ? g.audio.constructor.name : null,
    step: typeof g.audio.step,
    sfx: typeof g.audio.sfx,
    setSiren: typeof g.audio.setSiren,
    loadSamples: typeof g.audio.loadSamples,
    toggleSfx: typeof g.audio.toggleSfx,
    hasGang: !!g.gang, hasVfx: !!g.vfx,
    gangN: g.gang ? g.gang.thugs.length : -1,
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();

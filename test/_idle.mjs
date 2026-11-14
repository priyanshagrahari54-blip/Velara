import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type()==='error') console.log('CERR', m.text().slice(0,200)); });
await page.goto('http://localhost:3003/', { waitUntil: 'networkidle' });
await page.click('#v-play');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  try {
    const t = await page.evaluate(() => ({ thugs: window.velara?.gang?.thugs.length, alive: window.velara?.gang?.thugs.filter(t=>!t.dead).length }));
    console.log(`t+${i+1}s`, JSON.stringify(t));
  } catch (e) { console.log(`t+${i+1}s CRASH`, e.message.split('\n')[0]); break; }
}
await browser.close();

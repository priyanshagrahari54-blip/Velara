import { chromium } from 'playwright';
const NAMES = ['siren_loop','crash_hard','crash_soft','horn','footstep_01','footstep_02','footstep_03','footstep_04','pickup','ui_click'];
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--mute-audio'] });
const page = await browser.newPage();
await page.goto('http://localhost:3003/', { waitUntil: 'domcontentloaded' });
try {
  const r = await page.evaluate(async (names) => {
    const bufs = await Promise.all(names.map(n => fetch(`assets/audio/${n}.wav`).then(r => r.arrayBuffer())));
    return { fetched: bufs.length, bytes: bufs.reduce((a,b)=>a+b.byteLength,0) };
  }, NAMES);
  console.log('FETCH_ONLY', JSON.stringify(r));
} catch (e) { console.log('FETCH_CRASH', e.message.split('\n')[0]); }
try {
  const r = await page.evaluate(async (names) => {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const bufs = await Promise.all(names.map(n => fetch(`assets/audio/${n}.wav`).then(r => r.arrayBuffer())));
    const out = await Promise.all(bufs.map(b => ctx.decodeAudioData(b)));
    return { decoded: out.length, durs: out.map(x=>+x.duration.toFixed(2)).slice(0,3) };
  }, NAMES);
  console.log('DECODE', JSON.stringify(r));
} catch (e) { console.log('DECODE_CRASH', e.message.split('\n')[0]); }
await page.waitForTimeout(2000);
console.log('SURVIVED');
await browser.close();

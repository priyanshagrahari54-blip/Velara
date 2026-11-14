import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('about:blank');
const check = async (file, pred, label) => {
  const b64 = fs.readFileSync('shots/' + file).toString('base64');
  const r = await page.evaluate(async ({ b64, predSrc }) => {
    const pred = eval('(' + predSrc + ')');
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    return pred(d, c.width, c.height);
  }, { b64, predSrc: pred.toString() });
  console.log((r ? 'PASS' : 'FAIL') + ' | ' + label + ' | ' + JSON.stringify(r));
  return r;
};
// gold beacon: RGB jahan r>170, g>130, b<110 (gold/amber)
await check('v100-marker.png', (d, w, h) => {
  let gold = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i+1] > 130 && d[i+2] < 110) gold++;
  return { gold, ok: gold > 150 };
}, 'marker: gold beacon pixels');
// night: overall dark
await check('v100-night-traffic.png', (d) => {
  let s = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i+1] + d[i+2]) / 3;
  const mean = s / n;
  return { mean: Math.round(mean), ok: mean < 90 };
}, 'night traffic: dark scene');
// call UI: koi bhot bright panel (phone card white-ish)
await check('v100-story-call.png', (d) => {
  let bright = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i+1] > 200 && d[i+2] > 200) bright++;
  return { bright, ok: bright > 400 };
}, 'story call: bright call-card pixels');
await browser.close();

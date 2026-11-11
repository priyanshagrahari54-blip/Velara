#!/usr/bin/env node
// ---------------------------------------------------------------------------
// fetch-assets.mjs — licence-safe CC0 asset pipeline (master-spec rule 5b)
// ambientCG ke official download URL se asset laata hai, Color map ko game
// texture banata hai, aur ASSETS.md mein licence entry append karta hai.
// Rule: sirf CC0/permissive sources — kabhi bhi licence-unknown file nahi.
// Usage: node scripts/fetch-assets.mjs
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process';
import {
  appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MD = 'ASSETS.md';

// Naye assets yahan add karo — script baaki sab handle karta hai.
const JOBS = [
  { id: 'Asphalt007',  res: '1K-JPG', map: 'Color', out: 'public/textures/asphalt.jpg',  use: 'Road + ground albedo' },
  { id: 'Concrete034', res: '1K-JPG', map: 'Color', out: 'public/textures/concrete.jpg', use: 'Sidewalk / podium albedo' },
];

const mdHas = (id) => existsSync(MD) && readFileSync(MD, 'utf8').includes(`| ${id} `);
mkdirSync('public/textures', { recursive: true });

let ok = 0;
for (const j of JOBS) {
  const zip = `${j.id}_${j.res}.zip`;
  const url = `https://ambientcg.com/get?file=${zip}`;
  const dir = join(tmpdir(), `velara-asset-${j.id}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  console.log(`\u2193 ${j.id}  (${url})`);
  try {
    execSync(`curl -sL --fail --max-time 120 -o "${join(dir, zip)}" "${url}"`, { stdio: 'inherit' });
    execSync(`unzip -oq "${join(dir, zip)}" -d "${dir}"`, { stdio: 'inherit' });
    const found = execSync(`find "${dir}" -name "${j.id}*_${j.map}.jpg" | head -1`).toString().trim();
    if (!found) throw new Error(`${j.map} map zip mein nahi mila`);
    copyFileSync(found, j.out);
    console.log(`  \u2713 ${j.out} saved`);
    if (!mdHas(j.id)) {
      appendFileSync(MD, `| ${j.id} (${j.res}) | [ambientCG](https://ambientcg.com/view?id=${j.id}) | Lennart Demes (ambientCG) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | ${j.use} |\n`);
      console.log('  \u2713 ASSETS.md entry added');
    }
    ok++;
  } catch (err) {
    console.error(`  \u2717 FAILED: ${err.message} — ${j.id} skip (purana file rahega)`);
  } finally {
    rmSync(dir, { recursive: true, force: true }); // tmp saaf (RAM-safe)
  }
}
console.log(`\nDONE: ${ok}/${JOBS.length} assets fetched`);
process.exitCode = ok === JOBS.length ? 0 : 1;

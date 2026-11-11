// ---------------------------------------------------------------------------
// tools/package-windows.mjs — Win7-compatible Electron package pipeline.
// Electron 22 = last line supporting Windows 7/8 (Chromium 108).
//
// Usage:
//   node tools/package-windows.mjs           -> ia32 (32-bit Windows)  [default]
//   node tools/package-windows.mjs ia32      -> 32-bit
//   node tools/package-windows.mjs x64       -> 64-bit
//
// NOTE: 32-bit build is the SAME game — no content/graphics downgrade.
// Sirf exe ka CPU format alag hai (32-bit Windows ke liye zaroori).
//
// Note: electron-packager wants Wine for exe metadata editing on Linux; we
// don't need it — we assemble manually (download zip -> inject app -> rename).
// Portable-app layout; taskbar shows the window title from desktop/main.cjs.
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const TMP = path.join(os.tmpdir(), 'velara-release');
const ELECTRON_VERSION = '22.3.27';
const ARCH = (process.argv[2] || 'ia32').toLowerCase();
// 3-build system: --profile normal|g560 (mobile = Phase 4 PWA)
const PROFILE = (process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'normal');
if (!['ia32', 'x64'].includes(ARCH)) throw new Error('arch must be ia32 or x64');
const ZIP_LABEL = (ARCH === 'ia32' ? 'Win7-32bit' : 'Win7-x64') + (PROFILE === 'g560' ? '-G560' : '');

function run(cmd) {
  console.log('> ' + cmd.slice(0, 120) + (cmd.length > 120 ? '…' : ''));
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// 1. fresh web build
run('npx vite build');

// 2. download Electron 22 (win32, chosen arch) — GitHub with npmmirror fallback
console.log(`\n⬇️  Downloading Electron ${ELECTRON_VERSION} (win32-${ARCH})…`);
const ZIP_NAME = `electron-v${ELECTRON_VERSION}-win32-${ARCH}.zip`;
const electronZip = path.join(TMP, ZIP_NAME);
fs.mkdirSync(TMP, { recursive: true });
if (!fs.existsSync(electronZip)) {
  const urls = [
    `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${ZIP_NAME}`,
    `https://npmmirror.com/mirrors/electron/${ELECTRON_VERSION}/${ZIP_NAME}`,
  ];
  let ok = false;
  for (const u of urls) {
    try { run(`curl -L --fail --retry 3 -o "${electronZip}" "${u}"`); ok = true; break; }
    catch (e) { console.log(`   mirror failed: ${u}`); }
  }
  if (!ok) throw new Error('Electron download failed from all mirrors');
}

// 3. assemble the portable app (only wipe APP_DIR, NOT TMP — the electron
//    zip is cached there)
const APP_DIR = path.join(TMP, `VELARA-win32-${ARCH}`);
fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.mkdirSync(APP_DIR, { recursive: true });
run(`unzip -q "${electronZip}" -d "${APP_DIR}"`);

// 3a. app payload: trimmed package.json + desktop/ + dist/ + win readme
const resources = path.join(APP_DIR, 'resources');
fs.rmSync(path.join(resources, 'default_app.asar'), { force: true });
const appRes = path.join(resources, 'app');
fs.mkdirSync(appRes, { recursive: true });
fs.cpSync(path.join(ROOT, 'desktop'), path.join(appRes, 'desktop'), { recursive: true });
fs.cpSync(path.join(ROOT, 'dist'), path.join(appRes, 'dist'), { recursive: true });
fs.writeFileSync(path.join(appRes, 'package.json'), JSON.stringify({
  name: 'velara-city-of-shadows',
  productName: 'VELARA — City of Shadows',
  version: '0.2.0',
  description: 'VELARA: open-world city game prototype (Three.js + Cannon-es)',
  main: 'desktop/main.cjs',
  license: 'MIT',
}, null, 2));
fs.copyFileSync(path.join(ROOT, 'tools', 'WIN7-README.txt'), path.join(APP_DIR, 'WIN7-README.txt'));
  fs.writeFileSync(path.join(appRes, 'PROFILE'), PROFILE); // desktop launcher reads this

// 3b. rename exe
fs.renameSync(path.join(APP_DIR, 'electron.exe'), path.join(APP_DIR, 'VELARA.exe'));

// 4. verify
const exe = path.join(APP_DIR, 'VELARA.exe');
if (!fs.existsSync(exe)) throw new Error('VELARA.exe missing!');
for (const f of ['resources/app/dist/index.html', 'resources/app/desktop/main.cjs']) {
  if (!fs.existsSync(path.join(APP_DIR, f))) throw new Error(`missing: ${f}`);
}

// 5. zip (Windows opens .zip natively)
const zipPath = path.join(ROOT, `VELARA-${ZIP_LABEL}.zip`);
fs.rmSync(zipPath, { force: true });
run(`python3 -c "import shutil; shutil.make_archive('${zipPath.replace(/\.zip$/, '')}', 'zip', root_dir='${APP_DIR}')"`);

const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`\n✅ Package ready: ${zipPath} (${sizeMB} MB) — ${ARCH === 'ia32' ? '32-bit' : '64-bit'} Windows, profile: ${PROFILE}`);
console.log('   Extract karke VELARA.exe chalao — Windows 7 SP1+ supported.');

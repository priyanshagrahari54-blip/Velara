// ---------------------------------------------------------------------------
// VELARA desktop launcher (Electron 22 — last line supporting Windows 7).
// CommonJS on purpose: Electron < 28 main process has no ESM support.
//
// Security posture (docs/QUALITY-SECURITY-COMPAT.md):
//   - contextIsolation + sandbox + no nodeIntegration
//   - game served from an internal 127.0.0.1 static server, never remote
//   - navigation & window-open blocked
// ---------------------------------------------------------------------------

const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');

// G560-class Intel iGPU: Chromium usse blacklist kar deta hai -> SwiftShader (1-2 FPS!).
// Default ab PEHLE hardware force karta hai; --safe = purana software fallback.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (process.argv.includes('--angle9')) app.commandLine.appendSwitch('use-angle', 'd3d9'); // purane Win7 drivers

const IS_SAFE_MODE = process.argv.includes('--safe');

if (IS_SAFE_MODE) {
  // Software rendering for old / driverless GPUs (Lenovo G560 class)
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

function createServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        const file = path.normalize(path.join(DIST, urlPath));
        if (!file.startsWith(DIST)) { // path traversal guard
          res.writeHead(403); res.end('Forbidden'); return;
        }
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.writeHead(404); res.end('Not found'); return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Security-Policy': CSP,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(file).pipe(res);
      } catch (err) {
        res.writeHead(500); res.end('Server error');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#05070f',
    autoHideMenuBar: true,
    title: 'VELARA — City of Shadows',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  });
  // hardware profile (3-build system): resources/app/PROFILE file decides
  let profile = 'normal';
  try {
    profile = require('fs').readFileSync(require('path').join(__dirname, '../PROFILE'), 'utf8').trim() || 'normal';
  } catch (_) {}
  const qs = profile === 'normal' ? '' : `?profile=${profile}`;
  win.loadURL(`http://127.0.0.1:${port}/index.html${qs}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1')) return { action: 'deny' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  return win;
}

// Probe WebGL2 capability; if missing and not already in safe mode, relaunch
// with software rendering so old GPUs can still play.
async function webgl2Available() {
  return new Promise((resolve) => {
    const probe = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    probe.loadURL('data:text/html,<canvas id="c"></canvas>');
    probe.webContents.executeJavaScript('!!document.getElementById("c").getContext("webgl2")')
      .then((ok) => { probe.destroy(); resolve(ok); })
      .catch(() => { probe.destroy(); resolve(false); });
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length) { wins[0].focus(); }
  });

  app.whenReady().then(async () => {
    let port;
    try { port = await createServer(); } catch (err) {
      console.error('VELARA: internal server failed:', err);
      app.quit(); return;
    }

    if (!IS_SAFE_MODE && !(await webgl2Available())) {
      app.relaunch({ args: [...process.argv.slice(1), '--safe'] });
      app.exit(0);
      return;
    }

    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  });

  app.on('window-all-closed', () => app.quit());
}

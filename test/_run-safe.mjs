// ---------------------------------------------------------------------------
// _run-safe.mjs — kisi bhi test suite ko orphan-proof chalao.
// 280s watchdog: hung child + saare chrome processes SIGKILL — box kabhi
// wedge nahi hoga (2GB sandbox).
// Usage: node test/_run-safe.mjs <suite-file.mjs>
// ---------------------------------------------------------------------------
import { spawn } from 'child_process';

const file = process.argv[2];
if (!file) { console.error('usage: _run-safe.mjs <suite>'); process.exit(1); }

const child = spawn('node', ['test/' + file.replace(/^test\//, '')], {
  env: { ...process.env, VELARA_BASE: process.env.VELARA_BASE || 'http://localhost:3002' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

const wd = setTimeout(() => {
  console.log('\n!! WATCHDOG FIRED — nuking ' + file + ' + chrome orphans');
  try { spawn('pkill', ['-9', '-f', 'headless_shell']); } catch {}
  try { spawn('pkill', ['-9', '-f', 'chrome']); } catch {}
  child.kill('SIGKILL');
  setTimeout(() => process.exit(9), 1500);
}, Number(process.env.SAFE_TIMEOUT_MS || 280000));

child.on('exit', (c) => { clearTimeout(wd); process.exit(c ?? 1); });
child.on('error', (e) => { console.error('SPAWN ERROR: ' + e.message); process.exit(1); });

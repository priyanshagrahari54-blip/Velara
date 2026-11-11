import { VelaraGame } from './core/game.js';

const app = document.getElementById('app');

// Fatal-error guard: if WebGL is unavailable (old GPU / no driver), show a
// friendly message instead of a black screen. See docs/QUALITY-SECURITY-COMPAT.md
try {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    app.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
        background:#05070f;color:#cfe0ff;font-family:Segoe UI,system-ui,sans-serif;padding:24px;">
        <div style="max-width:520px;text-align:center;line-height:1.7;">
          <div style="font-size:42px;">😕</div>
          <h2 style="margin:12px 0 8px;">WebGL2 available nahi hai</h2>
          <p style="color:#9fb4d8;font-size:14px;">
            VELARA ko WebGL2 chahiye. Desktop app ko <b>safe mode</b> mein chalayein
            (VELARA.exe --safe) ya apna graphics driver update karein.
          </p>
        </div>
      </div>`;
  } else {
    const game = new VelaraGame(app);
    window.addEventListener('resize', () => game.onResize());
    window.velara = game; // debug handle
  }
} catch (err) {
  console.error('[VELARA] fatal:', err);
  app.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:#05070f;color:#cfe0ff;font-family:Segoe UI,system-ui,sans-serif;padding:24px;">
      <div style="max-width:520px;text-align:center;">
        <div style="font-size:42px;">💥</div>
        <h2 style="margin:12px 0;">Game start nahi ho paya</h2>
        <p style="color:#9fb4d8;font-size:13px;word-break:break-all;">${String(err.message || err)}</p>
      </div>
    </div>`;
}

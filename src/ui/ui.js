// ---------------------------------------------------------------------------
// VELARA UI: start screen, HUD, minimap, toasts, pause menu, touch controls
// ---------------------------------------------------------------------------

const CSS = `
  #v-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10;
    font-family: 'Segoe UI', system-ui, sans-serif; color: #e8eef7;
    -webkit-user-select: none; user-select: none; }
  .v-panel { background: rgba(8, 12, 20, 0.55); border: 1px solid rgba(120, 180, 255, 0.18);
    border-radius: 10px; backdrop-filter: blur(6px); }

  /* ---------- start screen ---------- */
  #v-start { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; pointer-events: auto;
    background: radial-gradient(ellipse at center, rgba(10,16,30,0.88) 0%, rgba(4,6,12,0.97) 75%); }
  #v-start h1 { font-size: clamp(44px, 9vw, 96px); letter-spacing: 0.22em; font-weight: 800;
    margin: 0; color: #eaf2ff; text-shadow: 0 0 28px rgba(90,140,255,0.8), 0 0 90px rgba(255,80,200,0.35); }
  #v-start h1 span { color: #7fd7ff; }
  #v-start .sub { margin-top: 6px; font-size: clamp(12px, 2vw, 17px); letter-spacing: 0.5em;
    color: #9fb4d8; text-transform: uppercase; }
  #v-start .story { max-width: 620px; text-align: center; margin: 26px 20px 8px; color: #c4d2e8;
    font-size: 14.5px; line-height: 1.65; }
  #v-play { pointer-events: auto; margin-top: 26px; padding: 15px 58px; font-size: 19px;
    letter-spacing: 0.25em; font-weight: 700; color: #04101c; cursor: pointer;
    background: linear-gradient(135deg, #6ee7ff, #4f8cff);
    border: none; border-radius: 999px; box-shadow: 0 0 34px rgba(80,160,255,0.55);
    transition: transform 0.12s ease, box-shadow 0.12s ease; }
  #v-play:hover { transform: scale(1.05); box-shadow: 0 0 50px rgba(120,190,255,0.8); }
  #v-start .keys { display: flex; flex-wrap: wrap; gap: 8px 18px; justify-content: center;
    margin-top: 26px; max-width: 720px; padding: 0 16px; }
  #v-start .key { background: rgba(20,30,48,0.7); border: 1px solid rgba(130,180,255,0.25);
    border-radius: 8px; padding: 7px 12px; font-size: 12.5px; color: #b9c9e2; }
  #v-start .key b { color: #7fd7ff; font-weight: 700; }

  /* ---------- HUD ---------- */
  #v-hud { position: absolute; inset: 0; display: none; }
  #v-brand { display: none; } /* cinematic minimal */
  #v-clock { position: absolute; left: 20px; bottom: 148px; font-size: 11.5px; color: #cfd8e8;
    letter-spacing: 0.08em; text-shadow: 0 1px 3px rgba(0,0,0,0.9); }
  #v-mission { position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
    text-align: center; max-width: 72vw; background: none; border: none;
    box-shadow: none; backdrop-filter: none; }
  #v-mission .mt { font-size: 10px; letter-spacing: 0.34em; color: #e6d9bc; text-transform: uppercase;
    text-shadow: 0 1px 3px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.85); }
  #v-mission .md { font-size: 14px; margin-top: 2px; color: #ffffff; font-weight: 700;
    text-shadow: 0 1px 3px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1); }
  #v-mission .mp { font-size: 11px; color: #ffe3a1; margin-top: 1px;
    text-shadow: 0 1px 3px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.85); }
  #v-money { position: absolute; top: 16px; right: 20px; font-size: 12.5px; color: #bfeec9;
    font-weight: 700; letter-spacing: 0.1em; text-shadow: 0 1px 4px rgba(0,0,0,0.9); }

  #v-speedo { position: absolute; right: 22px; bottom: 20px; width: 150px; padding: 0;
    text-align: right; display: none; background: none; border: none;
    box-shadow: none; backdrop-filter: none; }
  #v-speedo .kmh { font-size: 34px; font-weight: 800; line-height: 1; color: #f2f0ea;
    font-variant-numeric: tabular-nums; text-shadow: 0 2px 8px rgba(0,0,0,0.85); }
  #v-speedo .unit { font-size: 10px; letter-spacing: 0.3em; color: #c9bfa8; margin-top: 1px; }
  #v-speedo .gear { font-size: 12px; color: #ffd9a0; margin-top: 3px; font-weight: 700;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9); }
  #v-speedbar { height: 3px; border-radius: 2px; margin-top: 7px;
    background: rgba(255,255,255,0.16); overflow: hidden; }
  #v-speedfill { height: 100%; width: 0%; border-radius: 2px;
    background: linear-gradient(90deg, #ffd9a0, #ff8c4f); transition: width 0.08s linear; }
  #v-healthbar { position: absolute; left: 20px; bottom: 144px; width: 114px; height: 4px;
    border-radius: 3px; background: rgba(255,255,255,0.16); overflow: hidden; }
  #v-healthbar { height: 5px; border-radius: 4px; margin-top: 9px;
    background: rgba(255,255,255,0.12); overflow: hidden; }
  #v-healthfill { height: 100%; width: 100%; border-radius: 4px;
    background: linear-gradient(90deg, #54e08a, #a8f5c0); transition: width 0.25s ease; }

  #v-minimap { position: absolute; left: 18px; bottom: 18px; width: 118px; height: 118px;
    border-radius: 50%; overflow: hidden; border: 1.5px solid rgba(240,230,210,0.35);
    box-shadow: 0 4px 18px rgba(0,0,0,0.55); }

  #v-hint { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
    text-align: center; font-size: 11px; color: #b9c4d8; line-height: 1.7; max-width: 560px;
    transition: opacity 1s ease; text-shadow: 0 1px 4px rgba(0,0,0,0.9); }
  #v-hint b { color: #cfe4ff; }
  #v-prompt { position: absolute; bottom: 26%; left: 50%; transform: translateX(-50%);
    padding: 10px 24px; font-size: 15px; font-weight: 600; display: none; }
  #v-prompt b { color: #7fd7ff; }
  #v-toasts { position: absolute; bottom: 34%; left: 50%; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .v-toast { padding: 9px 26px; border-radius: 999px; font-size: 14.5px; font-weight: 600;
    background: rgba(10, 18, 30, 0.82); border: 1px solid rgba(130,190,255,0.35);
    color: #eaf6ff; animation: vpop 0.25s ease; text-align: center;
    box-shadow: 0 0 18px rgba(80,160,255,0.22), inset 3px 0 0 rgba(110,231,255,0.8); }
  .v-toast.gold { border-color: rgba(255,210,110,0.6); color: #ffe3a1;
    box-shadow: 0 0 24px rgba(255,190,80,0.25); }
  @keyframes vpop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  #v-grade { position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 52%, rgba(46,18,4,0.34) 100%); }
  #v-damage { position: absolute; inset: 0; opacity: 0; pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 40%, rgba(255,30,30,0.45) 100%);
    transition: opacity 0.15s ease; }

  /* ---------- pause ---------- */
  #v-debug { position: absolute; top: 8px; left: 10px; font: 10px/1.55 monospace;
    color: #9fe8b0; background: rgba(4,10,8,0.74); padding: 6px 10px; border-radius: 6px;
    white-space: pre; display: none; pointer-events: none; z-index: 40; }
  #v-pause { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    pointer-events: auto; background: rgba(4, 7, 13, 0.78); backdrop-filter: blur(4px); }
  #v-pause .box { text-align: center; }
  #v-pause h2 { letter-spacing: 0.3em; font-size: 34px; color: #eaf2ff; margin-bottom: 26px; }
  #v-pause button { display: block; width: 260px; margin: 10px auto; padding: 13px;
    font-size: 15px; letter-spacing: 0.15em; color: #dcecff; cursor: pointer;
    background: rgba(20, 32, 52, 0.8); border: 1px solid rgba(130,180,255,0.35);
    border-radius: 10px; transition: background 0.12s; }
  #v-pause button:hover { background: rgba(40, 70, 110, 0.9); }

  /* ---------- touch controls ---------- */
  #v-touch { position: absolute; inset: 0; display: none; }
  #v-stick { position: absolute; left: 22px; bottom: 26px; width: 124px; height: 124px;
    border-radius: 50%; background: rgba(20,30,48,0.35); border: 1px solid rgba(130,180,255,0.3);
    pointer-events: auto; }
  #v-stick .nub { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px;
    border-radius: 50%; background: rgba(127,215,255,0.45); transform: translate(-50%, -50%); }
  .v-tbtn { position: absolute; pointer-events: auto; border-radius: 50%;
    background: rgba(20,32,52,0.55); border: 1px solid rgba(130,180,255,0.4);
    color: #cfe4ff; font-weight: 700; display: flex; align-items: center; justify-content: center;
    font-size: 13px; letter-spacing: 0.06em; }
  #v-tbtn-a { right: 24px; bottom: 160px; width: 74px; height: 74px; }
  #v-tbtn-e { right: 112px; bottom: 66px; width: 64px; height: 64px; }
  #v-tbtn-h { right: 24px; bottom: 66px; width: 60px; height: 60px; font-size: 20px; }
  #v-tbtn-f { right: 118px; bottom: 160px; width: 78px; height: 78px; background: rgba(120,32,32,0.6);
    border-color: rgba(255,120,120,0.5); font-size: 14px; }
  #v-tbtn-aim { right: 24px; bottom: 252px; width: 58px; height: 58px; font-size: 20px; }
  #v-tbtn-w { right: 112px; bottom: 252px; width: 50px; height: 50px; font-size: 18px; }

  /* ---------- weapon HUD ---------- */
  #v-weapon { position: absolute; right: 22px; bottom: 20px; width: 190px; padding: 0;
    text-align: right; display: none; background: none; border: none;
    box-shadow: none; backdrop-filter: none; }
  #v-weapon .wname { font-size: 13px; font-weight: 700; color: #f2f0ea; letter-spacing: 0.1em;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9); }
  #v-weapon .wslots { display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px; }
  #v-weapon .wslot { width: 22px; height: 20px; border-radius: 5px; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.08); color: #7d92b5; border: 1px solid rgba(130,180,255,0.18); }
  #v-weapon .wslot.on { background: rgba(110,231,255,0.22); color: #dff6ff;
    border-color: rgba(110,231,255,0.55); }
  #v-weapon .wammo { font-size: 21px; font-weight: 800; margin-top: 4px; color: #ffe9c2;
    font-variant-numeric: tabular-nums; text-shadow: 0 2px 8px rgba(0,0,0,0.85); }
  #v-weapon .wammo .res { font-size: 13px; color: #9fb4d8; font-weight: 600; }
  #v-weapon .wammo.low { color: #ff8d7a; }
  #v-weapon .wreload { height: 3px; border-radius: 2px; margin-top: 6px;
    background: rgba(255,255,255,0.16); overflow: hidden; }
  #v-weapon .wreloadfill { height: 100%; width: 0%; background: linear-gradient(90deg, #ffd9a0, #ff8c4f); }

  /* ---------- crosshair + hitmarker ---------- */
  #v-crosshair { position: absolute; left: 50%; top: 50%; width: 0; height: 0; display: none; }
  #v-crosshair .dot { position: absolute; left: -1.5px; top: -1.5px; width: 3px; height: 3px;
    border-radius: 50%; background: #eaf6ff; box-shadow: 0 0 4px rgba(0,0,0,0.8); }
  #v-crosshair .l { position: absolute; background: rgba(234,246,255,0.92);
    box-shadow: 0 0 3px rgba(0,0,0,0.7); }
  #v-crosshair .lt, #v-crosshair .lb { width: 2px; height: 9px; left: -1px; }
  #v-crosshair .ll, #v-crosshair .lr { width: 9px; height: 2px; top: -1px; }
  #v-hitmarker { position: absolute; left: 50%; top: 50%; width: 0; height: 0; opacity: 0; }
  #v-hitmarker .h { position: absolute; width: 2.5px; height: 11px; background: #ff5d5d;
    left: -1px; top: -5px; box-shadow: 0 0 4px rgba(255,60,60,0.8); }
`;

export class UI {
  constructor(root, hooks) {
    this.hooks = hooks;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'v-ui';
    wrap.innerHTML = `
      <div id="v-start">
        <h1>VELARA<span>.</span></h1>
        <div class="sub">City of Shadows</div>
        <div class="story">
          Welcome to <b>VELARA</b> — a rain-soaked neon metropolis where every
          crash, drift and bullet obeys real physics. Tonight your story begins:
          money to earn, machines to master, and a city to shake.
        </div>
        <button id="v-play">PLAY</button>
        <div class="keys">
          <div class="key"><b>W A S D</b> — Move / Drive</div>
          <div class="key"><b>Shift</b> — Sprint</div>
          <div class="key"><b>Space</b> — Jump / Handbrake</div>
          <div class="key"><b>E</b> — Enter / exit vehicle</div>
          <div class="key"><b>Mouse</b> — Camera (drag/lock)</div>
          <div class="key"><b>RMB</b> — Aim · <b>LMB</b> — Fire</div>
          <div class="key"><b>1 / 2 / 3</b> — Pistol / SMG / Shotgun</div>
          <div class="key"><b>R</b> — Reload (foot) / Rain (car)</div>
          <div class="key"><b>H</b> — Horn</div>
          <div class="key"><b>N</b> — Day-night cycle</div>
          <div class="key"><b>R</b> — Barish on/off</div>
          <div class="key"><b>C</b> — Camera near/far</div>
          <div class="key"><b>M</b> — Music on/off</div>
          <div class="key"><b>Esc</b> — Pause</div>
        </div>
      </div>

      <div id="v-hud">
        <div id="v-brand">VELARA<small>CITY OF SHADOWS</small></div>
        <div id="v-clock">23:40 · RAAT</div>
        <div id="v-mission" class="v-panel">
          <div class="mt">MISSION 1</div>
          <div class="md">Welcome to Velara</div>
          <div class="mp"></div>
        </div>
        <div id="v-money">₹ 0</div>
        <canvas id="v-minimap" width="336" height="336"></canvas>
        <div id="v-healthbar"><div id="v-healthfill"></div></div>
        <div id="v-speedo" class="v-panel">
          <div class="kmh">0</div>
          <div class="unit">KM/H</div>
          <div class="gear">N</div>
          <div id="v-speedbar"><div id="v-speedfill"></div></div>
        </div>
        <div id="v-hint"></div>
        <div id="v-prompt" class="v-panel"></div>
        <div id="v-toasts"></div>
        <div id="v-damage"></div>
        <div id="v-grade"></div>
        <div id="v-weapon" class="v-panel">
          <div class="wname">Taar .45</div>
          <div class="wslots"><div class="wslot on">1</div><div class="wslot">2</div><div class="wslot">3</div></div>
          <div class="wammo">12 <span class="res">/ 60</span></div>
          <div class="wreload"><div class="wreloadfill"></div></div>
        </div>
        <div id="v-crosshair">
          <div class="dot"></div>
          <div class="l lt"></div><div class="l lb"></div><div class="l ll"></div><div class="l lr"></div>
        </div>
        <div id="v-hitmarker">
          <div class="h"></div><div class="h"></div><div class="h"></div><div class="h"></div>
        </div>
      </div>

      <div id="v-pause">
        <div class="box">
          <h2>PAUSE</h2>
          <button id="v-resume">RESUME</button>
          <button id="v-restart">RESTART GAME</button>
          <div style="margin-top:18px;font-size:10px;color:#8fa3bf;letter-spacing:.08em">
            ASSETS: ambientCG (CC0) + procedural — poora list: ASSETS.md
          </div>
        </div>
      </div>

      <div id="v-touch">
        <div id="v-stick"><div class="nub"></div></div>
        <div class="v-tbtn" id="v-tbtn-a">JUMP</div>
        <div class="v-tbtn" id="v-tbtn-e">E</div>
        <div class="v-tbtn" id="v-tbtn-h">📣</div>
        <div class="v-tbtn" id="v-tbtn-f">FIRE</div>
        <div class="v-tbtn" id="v-tbtn-aim"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg></div>
        <div class="v-tbtn" id="v-tbtn-w">🔄</div>
      </div>
    `;
    root.appendChild(wrap);
    this.el = wrap;

    this.$ = (id) => wrap.querySelector('#' + id);
    this.startEl = this.$('v-start');
    this.hudEl = this.$('v-hud');
    this.speedoEl = this.$('v-speedo');
    this.kmhEl = this.speedoEl.querySelector('.kmh');
    this.gearEl = this.speedoEl.querySelector('.gear');
    this.healthEl = this.$('v-healthfill');
    this.missionEl = this.$('v-mission');
    this.clockEl = this.$('v-clock');
    this.moneyEl = this.$('v-money');
    this.promptEl = this.$('v-prompt');
    this.toastBox = this.$('v-toasts');
    this.hintEl = this.$('v-hint');
    this.pauseEl = this.$('v-pause');
    this.damageEl = this.$('v-damage');
    this.minimap = this.$('v-minimap');
    this.debugEl = this.$('v-debug');
    this.mctx = this.minimap.getContext('2d');
    this.touchEl = this.$('v-touch');
    this.weaponEl = this.$('v-weapon');
    this.wnameEl = this.weaponEl.querySelector('.wname');
    this.wslotsEl = this.weaponEl.querySelectorAll('.wslot');
    this.wammoEl = this.weaponEl.querySelector('.wammo');
    this.wreloadFill = this.weaponEl.querySelector('.wreloadfill');
    this.crosshairEl = this.$('v-crosshair');
    this.hitmarkerEl = this.$('v-hitmarker');
    // hitmarker X shape
    this.hitmarkerEl.querySelectorAll('.h').forEach((h, i) => {
      h.style.transform = `rotate(${45 + i * 90}deg) translateY(-9px)`;
    });
    this._hitmarkT = null;

    this.$('v-play').addEventListener('click', () => hooks.onPlay());
    this.$('v-resume').addEventListener('click', () => hooks.onResume());
    this.$('v-restart').addEventListener('click', () => hooks.onRestart());

    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.isTouch) {
      this.touchEl.style.display = 'block';
      this.touchEl.style.pointerEvents = 'none';
      this._setupTouch();
    }
  }

  showStart() { this.startEl.style.display = 'flex'; }
  hideStart() { this.startEl.style.display = 'none'; }
  showHUD() { this.hudEl.style.display = 'block'; }
  showSpeedo(on) { this.speedoEl.style.display = on ? 'block' : 'none'; }
  showPause(on) { this.pauseEl.style.display = on ? 'flex' : 'none'; }

  setSpeed(kmh, gear) {
    const fill = this.el.querySelector('#v-speedfill');
    if (fill) fill.style.width = Math.min(100, (kmh / 220) * 100) + '%';
    this.kmhEl.textContent = Math.round(kmh);
    this.gearEl.textContent = gear;
  }

  setHealth(pct) {
    this.healthEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
    this.healthEl.style.background = pct > 50
      ? 'linear-gradient(90deg,#54e08a,#a8f5c0)'
      : pct > 25
        ? 'linear-gradient(90deg,#e0b254,#f5dca8)'
        : 'linear-gradient(90deg,#e05454,#f5a8a8)';
  }

  setClock(text) { this.clockEl.textContent = text; }
  setMoney(v) { this.moneyEl.textContent = '₹ ' + v.toLocaleString('en-IN'); }

  setMission(index, title, desc, progress) {
    if (title !== this._lastMissionTitle) {           // cinematic: show 5s, then dim
      this._lastMissionTitle = title;
      this.missionEl.style.transition = 'none';
      this.missionEl.style.opacity = '1';
      clearTimeout(this._missionFadeT);
      this._missionFadeT = setTimeout(() => {
        this.missionEl.style.transition = 'opacity 1.2s ease';
        this.missionEl.style.opacity = '0.45';
      }, 5000);
    }
    this.missionEl.querySelector('.mt').textContent = index ? 'MISSION ' + index : 'FREE ROAM';
    this.missionEl.querySelector('.md').textContent = title;
    this.missionEl.querySelector('.mp').textContent = progress || '';
  }

  setHint(html) {
    this.hintEl.innerHTML = html;
    this.hintEl.style.opacity = '1';
  }
  fadeHint() { this.hintEl.style.opacity = '0'; }

  prompt(text) {
    if (text) {
      this.promptEl.style.display = 'block';
      this.promptEl.innerHTML = text;
    } else {
      this.promptEl.style.display = 'none';
    }
  }

  toast(text, gold, ms) {
    const t = document.createElement('div');
    t.className = 'v-toast' + (gold ? ' gold' : '');
    t.innerHTML = text;
    this.toastBox.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.5s ease';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 550);
    }, ms || 2600);
  }

  flashDamage() {
    this.damageEl.style.opacity = '1';
    setTimeout(() => { this.damageEl.style.opacity = '0'; }, 160);
  }

  // ------------------------------------------------------ weapon HUD
  showWeapon(on) { this.weaponEl.style.display = on ? 'block' : 'none'; }

  setWeapon(index, names) {
    this.wnameEl.textContent = names[index];
    this.wslotsEl.forEach((s, i) => s.classList.toggle('on', i === index));
  }

  setAmmo(mag, reserve) {
    this.wammoEl.innerHTML = `${mag} <span class="res">/ ${reserve}</span>`;
    this.wammoEl.classList.toggle('low', mag <= Math.ceil(3));
  }

  setReload(pct) {
    this.wreloadFill.style.width = pct == null ? '0%' : `${Math.round(pct * 100)}%`;
  }

  setCrosshair(spread, visible) {
    this.crosshairEl.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    // spread (radians) -> pixel gap; ~1600px focal length assumption
    const gap = Math.min(46, 6 + spread * 1600);
    this.crosshairEl.querySelector('.lt').style.top = `${-gap - 9}px`;
    this.crosshairEl.querySelector('.lb').style.top = `${gap}px`;
    this.crosshairEl.querySelector('.ll').style.left = `${-gap - 9}px`;
    this.crosshairEl.querySelector('.lr').style.left = `${gap}px`;
  }

  hitmarker() {
    this.hitmarkerEl.style.opacity = '1';
    clearTimeout(this._hitmarkT);
    this._hitmarkT = setTimeout(() => { this.hitmarkerEl.style.opacity = '0'; }, 110);
  }

  // ------------------------------------------------------------- debug overlay (F3)
  toggleDebug() {
    this.debugEl.style.display = this.debugEl.style.display === 'block' ? 'none' : 'block';
  }

  updateDebug(lines) {
    if (this.debugEl.style.display === 'block') this.debugEl.textContent = lines.join('\n');
  }

  // ------------------------------------------------------------- minimap
  drawMinimap(data) {
    const c = this.mctx;
    const W = this.minimap.width, H = this.minimap.height;
    const { extent, roadsX, roadsZ, player, car, traffic, pickups } = data;
    const scale = W / (extent * 2 + 80);

    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(8,12,20,0.82)';
    c.fillRect(0, 0, W, H);

    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];

    // roads
    c.strokeStyle = 'rgba(140,170,210,0.35)';
    c.lineWidth = 16 * ROAD_W * scale / ROAD_W; // road width scaled
    c.lineWidth = Math.max(4, 16 * scale);
    for (const rx of roadsX) {
      const [mx] = toMap(rx, 0);
      c.beginPath(); c.moveTo(mx, 0); c.lineTo(mx, H); c.stroke();
    }
    for (const rz of roadsZ) {
      const [, mz] = toMap(0, rz);
      c.beginPath(); c.moveTo(0, mz); c.lineTo(W, mz); c.stroke();
    }

    // pickups
    c.fillStyle = '#ffd66e';
    for (const p of pickups) {
      if (p.taken) continue;
      const [mx, mz] = toMap(p.x, p.z);
      c.beginPath(); c.arc(mx, mz, 4, 0, Math.PI * 2); c.fill();
    }

    // traffic
    c.fillStyle = 'rgba(255,140,90,0.9)';
    for (const t of traffic) {
      const [mx, mz] = toMap(t.x, t.z);
      c.beginPath(); c.arc(mx, mz, 5, 0, Math.PI * 2); c.fill();
    }

    // range targets (red dots)
    if (data.targets) {
      c.fillStyle = '#ff5d6e';
      for (const t of data.targets) {
        const [mx, mz] = toMap(t.x, t.z);
        c.beginPath(); c.arc(mx, mz, 3.5, 0, Math.PI * 2); c.fill();
      }
    }

    // player vehicles (cyan dots; driven one gets the ring)
    if (data.vehicles) {
      for (const v of data.vehicles) {
        const [mx, mz] = toMap(v.x, v.z);
        c.fillStyle = '#6ee7ff';
        c.beginPath(); c.arc(mx, mz, v.active ? 7 : 4.5, 0, Math.PI * 2); c.fill();
        if (v.active) {
          c.strokeStyle = 'rgba(110,231,255,0.5)';
          c.lineWidth = 2;
          c.beginPath(); c.arc(mx, mz, 12, 0, Math.PI * 2); c.stroke();
        }
      }
    } else if (car) {
      const [mx, mz] = toMap(car.x, car.z);
      c.fillStyle = '#6ee7ff';
      c.beginPath(); c.arc(mx, mz, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(110,231,255,0.5)';
      c.lineWidth = 2;
      c.beginPath(); c.arc(mx, mz, 12, 0, Math.PI * 2); c.stroke();
    }

    // player arrow
    const [px, pz] = toMap(player.x, player.z);
    c.save();
    c.translate(px, pz);
    c.rotate(player.yaw);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8);
    c.closePath(); c.fill();
    c.restore();
  }

  // -------------------------------------------------------- touch input
  _setupTouch() {
    const stick = this.$('v-stick');
    const nub = stick.querySelector('.nub');
    this.stick = { x: 0, y: 0 };
    let sid = null;

    const setStick = (tx, ty) => {
      const r = stick.getBoundingClientRect();
      let dx = (tx - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (ty - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.stick.x = dx; this.stick.y = dy;
      nub.style.transform = `translate(calc(-50% + ${dx * 36}px), calc(-50% + ${dy * 36}px))`;
    };

    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      sid = t.identifier;
      setStick(t.clientX, t.clientY);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === sid) setStick(t.clientX, t.clientY);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === sid) {
        sid = null; this.stick.x = 0; this.stick.y = 0;
        nub.style.transform = 'translate(-50%, -50%)';
      }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);

    const bind = (id, name) => {
      const el = this.$(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); this.hooks.onTouchBtn(name, true); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); this.hooks.onTouchBtn(name, false); }, { passive: false });
    };
    bind('v-tbtn-a', 'a');
    bind('v-tbtn-e', 'e');
    bind('v-tbtn-h', 'h');
    bind('v-tbtn-f', 'f');
    bind('v-tbtn-aim', 'aim');
    bind('v-tbtn-w', 'w');
  }
}

const ROAD_W = 16; // must match city.js

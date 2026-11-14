// ---------------------------------------------------------------------------
// VELARA audio: procedural synthwave music + gameplay SFX (Web Audio)
// ---------------------------------------------------------------------------

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this._hornOn = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = noiseBuf;

    this._buildEngine();
    this._buildSkid();
    this._buildRain();
    this._buildAmbience();

    // music sequencer state
    this.bpm = 96;
    this.stepDur = 60 / this.bpm / 2; // 8th notes
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.musicPlaying = true;
  }

  // -------------------------------------------------------------- engine
  _buildEngine() {
    const ctx = this.ctx;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 400;
    this.engFilter.Q.value = 2;

    this.engOsc1 = ctx.createOscillator(); this.engOsc1.type = 'sawtooth';
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.4;

    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(g2); g2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.sfxGain);
    this.engOsc1.start(); this.engOsc2.start();
  }

  setEngine(rpm, throttle, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = active ? 0.028 + throttle * 0.075 : 0;
    this.engGain.gain.setTargetAtTime(target, t, 0.08);
    const f = 55 + rpm * 165;
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(280 + rpm * 1400 + throttle * 500, t, 0.08);
  }

  // ----------------------------------------------------------------- skid
  _buildSkid() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 900; this.skidFilter.Q.value = 1.2;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    src.connect(this.skidFilter); this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxGain);
    src.start();
  }

  setSkid(amount) {
    if (!this.ctx) return;
    this.skidGain.gain.setTargetAtTime(Math.min(amount, 1) * 0.22, this.ctx.currentTime, 0.05);
  }

  // ----------------------------------------------------------------- rain
  _buildRain() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    src.connect(f); f.connect(this.rainGain); this.rainGain.connect(this.sfxGain);
    src.start();
  }

  setRainLevel(v) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(v * 0.055, this.ctx.currentTime, 0.4);
  }

  _buildAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
  }

  // ------------------------------------------------------------ one-shots
  thud(strength) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = Math.min(1, strength / 14);
    // body
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * s + 0.05, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.25);
    // crunch noise
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4 * s, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
    n.start(t); n.stop(t + 0.2);
  }

  blip() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1420, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.32);
  }

  // ------------------------------------------------------ weapon sounds
  shot(type) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // per-gun character: crack (osc) + blast (filtered noise)
    const cfg = {
      pistol:   { f0: 2400, f1: 300, dur: 0.14, vol: 0.5, nf: 3400, nd: 0.11, nv: 0.42 },
      smg:      { f0: 2100, f1: 380, dur: 0.09, vol: 0.38, nf: 2900, nd: 0.08, nv: 0.32 },
      shotgun:  { f0: 1300, f1: 140, dur: 0.3,  vol: 0.7,  nf: 1600, nd: 0.28, nv: 0.65 },
    }[type] || { f0: 2000, f1: 300, dur: 0.12, vol: 0.4, nf: 3000, nd: 0.1, nv: 0.35 };

    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(cfg.f0, t);
    o.frequency.exponentialRampToValueAtTime(cfg.f1, t + cfg.dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(cfg.vol, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur + 0.03);
    o.connect(og); og.connect(this.sfxGain);
    o.start(t); o.stop(t + cfg.dur + 0.05);

    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = cfg.nf; nf.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(cfg.nv, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + cfg.nd);
    n.connect(nf); nf.connect(ng); ng.connect(this.sfxGain);
    n.start(t); n.stop(t + cfg.nd + 0.03);
  }

  emptyClick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = 1650;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.05);
  }

  reloadClick() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const dt2 of [0, 0.07]) {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = 900 + dt2 * 3000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t + dt2);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt2 + 0.035);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t + dt2); o.stop(t + dt2 + 0.045);
    }
  }

  hitmark() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2300, t);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + 0.08);
  }

  horn(on, freqs = [392, 494]) {
    if (!this.ctx || on === this._hornOn) return;
    this._hornOn = on;
    const ctx = this.ctx, t = ctx.currentTime;
    if (on) {
      this.hornOscs = [];
      freqs.forEach((f) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.05;
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1600;
        o.connect(flt); flt.connect(g); g.connect(this.sfxGain);
        o.start(t);
        this.hornOscs.push({ o, g });
      });
    } else if (this.hornOscs) {
      this.hornOscs.forEach(({ o, g }) => {
        g.gain.setTargetAtTime(0, t, 0.03);
        o.stop(t + 0.15);
      });
      this.hornOscs = null;
    }
  }

  // ----------------------------------------------------------- music loop
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.34 : 0, this.ctx.currentTime, 0.2);
    return this.musicOn;
  }

  // chords: Am  F  C  G  (synthwave staple)
  _chordForStep(step) {
    const chords = [
      [110.0, 220.0, 261.63, 329.63],   // Am
      [87.31, 174.61, 220.0, 349.23],   // F
      [130.81, 196.0, 261.63, 329.63],  // C
      [98.0, 196.0, 246.94, 293.66],    // G
    ];
    return chords[Math.floor(step / 16) % 4];
  }

  _scheduleStep(step, t) {
    const ctx = this.ctx;
    const chord = this._chordForStep(step);
    const bar8 = step % 16;

    // pad at chord start
    if (bar8 === 0) {
      chord.forEach((f, i) => {
        [0, 0.4].forEach((detune) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = f; o.detune.value = detune ? 7 : -7;
          const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 750;
          const g = ctx.createGain();
          const dur = this.stepDur * 16;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(i === 0 ? 0.05 : 0.032, t + 0.5);
          g.gain.setValueAtTime(i === 0 ? 0.05 : 0.032, t + dur - 0.7);
          g.gain.linearRampToValueAtTime(0, t + dur);
          o.connect(flt); flt.connect(g); g.connect(this.musicGain);
          o.start(t); o.stop(t + dur + 0.05);
        });
      });
    }

    // bass 8ths
    const root = chord[0];
    const mult = [1, 1, 2, 1, 1, 2, 1, 1.5][bar8 % 8];
    {
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.value = root * mult;
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + this.stepDur * 0.95);
      o.connect(flt); flt.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + this.stepDur);
    }

    // kick (quarters)
    if (bar8 % 2 === 0) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + 0.25);
    }

    // hat (offbeat 8ths)
    if (bar8 % 2 === 1) {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      n.playbackRate.value = 1.6;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      n.connect(f); f.connect(g); g.connect(this.musicGain);
      n.start(t); n.stop(t + 0.07);
    }

    // snare beats 2 & 4
    if (bar8 % 4 === 2) {
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      n.connect(f); f.connect(g); g.connect(this.musicGain);
      n.start(t); n.stop(t + 0.16);
    }
  }

  update() {
    if (!this.ctx || !this.musicOn) return;
    const now = this.ctx.currentTime;
    while (this.nextTime < now + 0.15) {
      this._scheduleStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += this.stepDur;
    }
  }
  // ================================================================ v0.8.0
  // SAMPLE LAYER — factory-designed WAVs (sound team pack). Procedural synth
  // (engine/skid/music) ke saath blend hota hai; jo cheez synth me missing
  // thi (siren, crash crunch, footsteps, UI) wo samples se aati hai.
  // ================================================================
  async loadSamples() {
    if (this._samplesLoading) return;
    this._samplesLoading = true;
    this.samples = this.samples || {};
    const NAMES = ['siren_loop', 'crash_hard', 'crash_soft', 'horn',
      'footstep_01', 'footstep_02', 'footstep_03', 'footstep_04',
      'pickup', 'ui_click'];
    if (!this.ctx || !window.fetch) { this._samplesLoading = false; return; }
    // HEADLESS GUARD: QA swiftshader mein concurrent decode + running context
    // renderer crash karta hai (bisect confirmed). Real browsers theek chalte
    // hain — bare-page decode test (test/_ab.mjs) se verified.
    const headless = navigator.webdriver === true;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const dctx = OAC ? new OAC(1, 1, 44100) : this.ctx;
    for (const n of NAMES) {
      if (this.samples[n]) continue;
      if (headless) continue;
      try {
        const res = await fetch(`assets/audio/${n}.wav`);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        // sequential — audio thread par ek-ek file, pressure kam
        this.samples[n] = await dctx.decodeAudioData(buf);
        await new Promise((r) => setTimeout(r, 80));
      } catch (e) { /* sample missing — synth fallback chalta rahega */ }
    }
    this._samplesLoading = false;
  }

  sfx(name, vol = 1.0, rate = 1.0) {
    if (!this.ctx || !this.samples || !this.samples[name]) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.samples[name];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + src.buffer.duration);
    src.connect(g); g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + src.buffer.duration + 0.05);
  }

  // police siren loop — wanted > 0 par ON (gain ramp, click nahi hota)
  setSiren(on, vol = 0.5) {
    if (!this.ctx || !this.samples || !this.samples.siren_loop) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (on && !this._sirenSrc) {
      const src = ctx.createBufferSource();
      src.buffer = this.samples.siren_loop;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      src.connect(g); g.connect(this.sfxGain);
      src.start(t);
      this._sirenSrc = src; this._sirenGain = g;
      g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
    } else if (!on && this._sirenSrc) {
      const g = this._sirenGain, src = this._sirenSrc;
      g.gain.setTargetAtTime(0.0001, t, 0.25);
      src.stop(t + 1.0);
      this._sirenSrc = null; this._sirenGain = null;
    }
  }

  // v0.9.0 — phone ringtone (classic dual-tone, LFO square gate)
  startRing() {
    if (!this.ctx || this._ring) return;
    const ctx = this.ctx;
    const mix = ctx.createGain(); mix.gain.value = 0.11;
    const o1 = ctx.createOscillator(); o1.frequency.value = 440;
    const o2 = ctx.createOscillator(); o2.frequency.value = 480;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1 / 3.2;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.055;
    lfo.connect(lfoG); lfoG.connect(mix.gain);
    o1.connect(mix); o2.connect(mix); mix.connect(this.sfxGain);
    o1.start(); o2.start(); lfo.start();
    this._ring = { o1, o2, lfo, mix };
  }

  stopRing() {
    if (!this._ring) return;
    const { o1, o2, lfo, mix } = this._ring;
    try { o1.stop(); o2.stop(); lfo.stop(); mix.disconnect(); } catch (e) { /* already */ }
    this._ring = null;
  }

  footstep() {   // footstep — 4 variations random ("step" sequencer counter se clash)
    const n = 'footstep_0' + (1 + Math.floor(Math.random() * 4));
    this.sfx(n, 0.55, 0.9 + Math.random() * 0.2);
  }

  toggleSfx() {
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxOn = !this.sfxOn ? 1 : 0;
    return this.sfxOn;
  }
}

// ---------------------------------------------------------------------------
// QualityManager — scalable graphics tiers + automatic FPS-driven switching.
// Target hardware ranges from a modern desktop (high) down to a 2010-era
// laptop (Lenovo G560 / Win7 class — see docs/QUALITY-SECURITY-COMPAT.md).
// ---------------------------------------------------------------------------

const TIERS = {
  high: {
    label: 'HIGH',
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    shadowMapSize: 2048,
    shadows: true,
    bloom: 0.55,
    viewDist: 260,
    far: 2200, trafficCap: 10, aniso: 4, viewPad: 45,
  },
  medium: {
    label: 'MEDIUM',
    pixelRatio: 1,
    shadowMapSize: 1024,
    shadows: true,
    bloom: 0.32,
    maxLights: 22,
    viewDist: 200,
    far: 1600, trafficCap: 10, aniso: 4, viewPad: 45,
  },
  low: {
    label: 'LOW (fast)',
    pixelRatio: 0.8,
    shadowMapSize: 512,
    shadows: false,
    bloom: 0,
    maxLights: 14,
    viewDist: 150,
    far: 900, trafficCap: 8, aniso: 2, viewPad: 36,
  },
  mobile: {
    label: 'MOBILE',
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    shadowMapSize: 1024,
    shadows: true,
    bloom: 0,
    maxLights: 14,
    viewDist: 190,
    far: 1400, trafficCap: 8, aniso: 2, viewPad: 36,
  },
  g560: {
    label: 'G560 (max speed)',
    pixelRatio: 0.55,      // render at 55% resolution - huge win on old iGPUs
    shadowMapSize: 256,
    shadows: false,
    bloom: 0,
    maxLights: 5,          // cap street-lamp/neon point lights (fragment sasta)
    detailLod: true,        // 95m+ door chunk-details hide (fog cover karta hai)
    skyline: false,        // hide the 34 distant skyline boxes
    viewDist: 120,
    far: 520, trafficCap: 6, aniso: 1, viewPad: 24,
  },
  emergency: {
    label: 'EMERGENCY (software-render survival)',
    pixelRatio: 0.24,      // 1366x768 screen -> ~320x180 internal render
    shadowMapSize: 128,
    shadows: false,
    bloom: 0,
    maxLights: 2,          // ambient + sun only
    detailLod: true,
    skyline: false,
    viewDist: 70,
    far: 350, trafficCap: 3, aniso: 1, viewPad: 12,
    minimap: false,        // 8Hz canvas bhi band — CPU ke liye
  },
};

const ORDER = ['emergency', 'g560', 'low', 'mobile', 'medium', 'high'];

export class QualityManager {
  constructor() {
    this.tier = 'high';
    this.manual = false;
    this.onChange = null;       // (tierCfg, tierName) => void
    this._samples = [];
    this._window = 0;
    this._cooldown = 0;
    this._fps = 60;
  }

  get config() { return TIERS[this.tier]; }
  get fps() { return this._fps; }

  /** Software-rendering (SwiftShader/llvmpipe) detect — ek baar, sasta. */
  static detectSoftwareGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { webgl: false, sw: true, name: 'no-webgl' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : (gl.getParameter(gl.RENDERER) || 'unknown');
      return { webgl: true, sw: /swiftshader|software|llvmpipe|basic render/i.test(name), name };
    } catch (e) { return { webgl: false, sw: true, name: 'error' }; }
  }

  /** Auto-detect a starting tier from hardware hints. */
  bootstrap(isSmallScreen) {
    // profile/qa pehle se set kiya hai to usi ko ceiling maano
    if (this.tier !== 'high' || this.manual) { this._ceil = this.tier; return this.apply(); }
    const cores = navigator.hardwareConcurrency || 2;
    const mem = navigator.deviceMemory || 4;
    const glInfo = QualityManager.detectSoftwareGL();
    this.glInfo = glInfo;
    if (glInfo.sw) this.tier = 'emergency';           // CPU rendering -> survival mode
    else if (isSmallScreen) this.tier = 'mobile';     // touch phone — dedicated tier
    else if (cores <= 2 || mem <= 2) this.tier = 'g560';
    else if (cores <= 4 || mem <= 4) this.tier = 'medium';
    this._ceil = this.tier;
    return this.apply();
  }

  /** Apply current tier to renderer + lights + postFX. */
  apply() {
    if (this.onChange) this.onChange(this.config, this.tier);
    return this.config;
  }

  set(tier) {
    if (!TIERS[tier] || tier === this.tier) return this.config;
    this.tier = tier;
    if (!this.manual) this._ceil = tier;   // external set = naya ceiling (governor isse upar nahi jayega)
    return this.apply();
  }

  /** Governor ka internal switch — ceiling ko hilaata nahi. */
  _applyTier(tier) {
    if (!TIERS[tier] || tier === this.tier) return this.config;
    this.tier = tier;
    return this.apply();
  }

  /** Manual cycle (K key). */
  cycle() {
    this.manual = true;
    const i = ORDER.indexOf(this.tier);
    this.set(ORDER[(i + 1) % ORDER.length]);
    return this.config;
  }

  /** Called every frame; auto downgrades after sustained poor FPS. */
  frame(dt) {
    if (dt <= 0) return;
    this._samples.push(1 / dt);
    this._window += dt;
    this._cooldown -= dt;
    if (this._samples.length > 240) this._samples.shift();
    if (this._window < 3) return;
    this._window = 0;
    const avg = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
    this._fps = avg;
    if (this.manual || this._cooldown > 0) return;
    const i = ORDER.indexOf(this.tier);
    const ceil = ORDER.indexOf(this._ceil || this.tier);
    if (avg < 30 && i > 0) {                 // giravat — emergency floor tak
      this._applyTier(ORDER[i - 1]);
      this._cooldown = 10;
    } else if (avg > 50 && i < ceil) {       // wapas chadhavat — ceiling tak (hysteresis 30/50)
      this._applyTier(ORDER[i + 1]);
      this._cooldown = 14;
    }
  }
}

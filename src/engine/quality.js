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
  },
  medium: {
    label: 'MEDIUM',
    pixelRatio: 1,
    shadowMapSize: 1024,
    shadows: true,
    bloom: 0.32,
    maxLights: 22,
    viewDist: 200,
  },
  low: {
    label: 'LOW (fast)',
    pixelRatio: 0.8,
    shadowMapSize: 512,
    shadows: false,
    bloom: 0,
    maxLights: 14,
    viewDist: 150,
  },
  g560: {
    label: 'G560 (max speed)',
    pixelRatio: 0.55,      // render at 55% resolution - huge win on old iGPUs
    shadowMapSize: 256,
    shadows: false,
    bloom: 0,
    maxLights: 8,          // cap street-lamp/neon point lights (28 -> 8)
    skyline: false,        // hide the 34 distant skyline boxes
    viewDist: 120,
  },
};

const ORDER = ['g560', 'low', 'medium', 'high'];

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

  /** Auto-detect a starting tier from hardware hints. */
  bootstrap(isSmallScreen) {
    const cores = navigator.hardwareConcurrency || 2;
    const mem = navigator.deviceMemory || 4;
    if (isSmallScreen || cores <= 2 || mem <= 2) this.tier = 'low';
    else if (cores <= 4 || mem <= 4) this.tier = 'medium';
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
    if (avg < 30 && this.tier !== 'g560') { // g560 is the floor tier
      const i = ORDER.indexOf(this.tier);
      this.set(ORDER[i - 1]);
      this._cooldown = 10;
    } else if (avg > 57 && this.tier === 'low') {
      // only recover one notch, once, and only if we never chose low manually
      this.set('medium');
      this._cooldown = 15;
    }
  }
}

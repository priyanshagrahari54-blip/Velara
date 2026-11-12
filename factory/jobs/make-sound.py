"""
VELARA Sound Team — Job: make-sound (v2 — layered synthesis)
============================================================
v1 "0 rating" tha. v2: biquad filters + Schroeder reverb + tanh saturation
+ stereo Haas + multi-layer design. numpy only, plain python3 ya blender dono.
    python3 factory/jobs/make-sound.py [preset ...]
Presets: siren horn gunshot pickup impact engine-idle rain-loop skid
Output: factory/out/<preset>.wav  (16-bit PCM STEREO)
"""
import json
import os
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)

SR_HI = 44100
SR_LO = 22050


# ------------------------------------------------------------ DSP core
def biquad(x, b0, b1, b2, a1, a2):
    y = np.empty_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xn = x[i]
        yn = b0 * xn + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, xn
        y2, y1 = y1, yn
        y[i] = yn
    return y


def lp(x, fc, sr, q=0.707):
    w = 2 * np.pi * fc / sr
    al = np.sin(w) / (2 * q)
    c, s = np.cos(w), np.sin(w)
    b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al
    return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def hp(x, fc, sr, q=0.707):
    w = 2 * np.pi * fc / sr
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al
    return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def bp(x, fc, sr, q=2.0):
    w = 2 * np.pi * fc / sr
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    b0 = al; b1 = 0; b2 = -al
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al
    return biquad(x, b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)


def sat(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def reverb(x, sr, mix=0.22, decay=0.75):
    """Schroeder-lite: 3 comb + 1 allpass."""
    out = x.copy()
    for d_ms in (29.7, 37.1, 41.1):
        d = int(sr * d_ms / 1000)
        buf = np.zeros(len(x) + d * 8)
        buf[:len(x)] += x * 0.33
        for i in range(d, len(buf)):
            buf[i] += decay * buf[i - d]
        out = out + buf[:len(x)] * 0.33
    a = int(sr * 0.005)
    ap = np.zeros(len(out))
    g = 0.7
    for i in range(len(ap)):
        xn = out[i] if i < len(out) else 0.0
        xd = ap[i - a] if i >= a else 0.0
        ap[i] = -g * xn + xd + g * ap[i - a] if i >= a else xn
    return x * (1 - mix) + ap * mix


def stereoize(x, sr, haas_ms=0.35, pan=0.06):
    """Haas + halka pan — headphone par bhi depth."""
    d = int(sr * haas_ms / 1000)
    L = x.copy()
    Rr = np.concatenate([np.zeros(d), x[:-d]]) if d else x.copy()
    return np.stack([(1 - pan) * L, (1 + pan) * Rr], axis=1)


def loopify(x, sr, xf_sec=0.05):
    n = len(x)
    w = min(n // 2, int(xf_sec * sr))
    ramp = np.linspace(0, 1, w, dtype=np.float32)
    head = x[:w].copy()
    x[:w] = head * ramp + x[-w:] * (1 - ramp)
    return x[:n - w] if n > w * 2 else x


def adsr(n, sr, a=0.005, d=0.1, s_level=0.7, r=0.2, hold=None):
    e = np.full(n, s_level, dtype=np.float32)
    na, nd = int(a * sr), int(d * sr)
    nr = int(r * sr)
    if hold is None:
        hold = max(0, n - na - nd - nr)
    ns = hold
    i = 0
    e[i:i + na] = np.linspace(0, 1, min(na, n)); i += na
    e[i:i + nd] = np.linspace(1, s_level, min(nd, max(0, n - i))); i += nd
    i = max(i, ns)
    if nr and i < n:
        e[i:] = np.linspace(e[i - 1] if i else s_level, 0, n - i)
    return e


def sweep_phase(f_from, f_to, n, sr):
    t = np.arange(n) / sr
    f = f_from + (f_to - f_from) * (t / (t[-1] + 1e-9))
    return 2 * np.pi * np.cumsum(f) / sr


def saw(ph):
    return ((ph / (2 * np.pi)) % 1.0) * 2.0 - 1.0


def sq(ph):
    return np.sign(np.sin(ph)) * 0.9


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n).astype(np.float32)


# ------------------------------------------------------------ presets
def p_siren():
    sr = SR_HI
    sec = 2.6
    n = int(sr * sec)
    ph = sweep_phase(560, 1180, n // 2, sr)
    ph = np.concatenate([ph, sweep_phase(1180, 560, n - n // 2, sr)])
    vib = 2 * np.pi * np.arange(n) / sr * 6.0          # 6Hz FM wobble
    ph = ph + 14.0 * np.sin(vib)
    x = saw(ph) * 0.6 + sq(ph) * 0.4
    x = sat(x, 1.6)
    x = bp(x, 700, sr, 0.9)
    x = lp(x, 3600, sr, 0.8)
    x *= adsr(n, sr, 0.04, 0.1, 0.95, 0.3)
    x = reverb(x, sr, 0.16, 0.7)
    return stereoize(x, sr), sr


def p_horn():
    sr = SR_HI
    sec = 0.9
    n = int(sr * sec)
    t = np.arange(n) / sr
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    x = (sq(2 * np.pi * 400 * t * vib) * 0.5
         + sq(2 * np.pi * 505 * t * vib) * 0.45
         + saw(2 * np.pi * 800 * t) * 0.12
         + saw(2 * np.pi * 1010 * t) * 0.1)
    x = sat(x, 2.4)
    x = lp(x, 2900, sr, 0.9)
    x = bp(x, 450, sr, 0.5) * 0.3 + x          # cabin resonance
    x *= adsr(n, sr, 0.012, 0.06, 0.9, 0.22)
    x = reverb(x, sr, 0.1, 0.65)
    return stereoize(x, sr, haas_ms=0.2), sr


def p_gunshot():
    sr = SR_HI
    sec = 0.6
    n = int(sr * sec)
    t = np.arange(n) / sr
    # L1: click transient
    c = np.zeros(n, dtype=np.float32); c[:30] = np.linspace(1, 0, 30)
    c = hp(c, 2200, sr)
    # L2: crack
    crack = bp(noise(n, 7), 1900, sr, 0.9) * np.exp(-t / 0.02)
    # L3: body boom
    body = lp(noise(n, 11), 420, sr) * np.exp(-t / 0.13)
    thump = np.sin(2 * np.pi * 118 * t).astype(np.float32) * np.exp(-t / 0.09) * 0.9
    # L4: mech re-rack (90ms baad chhota click)
    mech = np.zeros(n, dtype=np.float32)
    m0 = int(0.09 * sr)
    mech[m0:m0 + 25] = np.linspace(0.5, 0, 25)
    mech = bp(mech, 3000, sr, 2.0)
    x = sat(c * 0.8 + crack * 1.2 + body * 1.0 + thump + mech * 0.5, 1.8)
    x = reverb(x, sr, 0.3, 0.68)
    x *= 0.9
    return stereoize(x, sr, haas_ms=0.6), sr


def p_pickup():
    sr = SR_HI
    sec = 0.7
    n = int(sr * sec)
    t = np.arange(n) / sr
    x = np.zeros(n, dtype=np.float32)
    for k, (fc, dec, amp) in enumerate(((1174.66, 0.30, 0.8), (1567.98, 0.22, 0.55),
                                        (3248, 0.14, 0.3))):
        s = int(k * 0.05 * sr)
        tt = t[:n - s]
        mod = np.sin(2 * np.pi * fc * tt) * (1 + 0.6 * np.sin(2 * np.pi * fc * 2.76 * tt))
        x[s:] += (mod.astype(np.float32) * np.exp(-tt / dec) * amp)
    x += hp(noise(n, 21), 4200, sr) * np.exp(-t / 0.05) * 0.15   # sparkle
    x = reverb(x, sr, 0.24, 0.72)
    return stereoize(x, sr), sr


def p_impact():
    sr = SR_HI
    sec = 0.8
    n = int(sr * sec)
    t = np.arange(n) / sr
    x = np.zeros(n, dtype=np.float32)
    for off, amp, tau in ((0.0, 1.0, 0.10), (0.045, 0.6, 0.08), (0.105, 0.4, 0.06)):
        s = int(off * sr)
        tt = t[:n - s]
        x[s:] += lp(noise(n - s, int(off * 100) + 3), 950, sr) * np.exp(-tt / tau) * amp
    x += np.sin(2 * np.pi * 72 * t).astype(np.float32) * np.exp(-t / 0.3) * 0.9
    x += bp(noise(n, 31), 3300, sr, 8) * np.exp(-t / 0.09) * 0.22   # metal ring
    x = sat(x, 1.7)
    x = reverb(x, sr, 0.26, 0.7)
    return stereoize(x, sr, haas_ms=0.8), sr


def p_engine_idle():
    sr = SR_LO
    sec = 2.4
    n = int(sr * sec)
    t = np.arange(n) / sr
    ph = np.linspace(0, 2 * np.pi * round(46 * sec), n)   # loop-exact
    x = (saw(ph) * 0.5 + saw(ph * 2) * 0.28 + saw(ph * 3) * 0.14 + saw(ph * 4) * 0.08)
    fire = 0.7 + 0.3 * np.sin(2 * np.pi * 9.2 * t).astype(np.float32)
    jit = 1 + 0.05 * np.sin(2 * np.pi * 2.7 * t + 1.3)
    x *= fire * jit
    burble = lp(noise(n, 3), 420, sr) * (0.5 + 0.5 * np.sin(2 * np.pi * 4.6 * t + 0.7))
    x = sat(x * 0.8 + burble * 0.35, 1.5)
    x = lp(x, 900, sr)
    x = loopify(x, sr, 0.06)
    return stereoize(x, sr, haas_ms=0.4), sr


def p_rain():
    sr = SR_LO
    sec = 4.0
    n = int(sr * sec)
    x = lp(noise(n, 5), 1100, sr) * 0.8 + bp(noise(n, 55), 2800, sr, 1.2) * 0.25
    rng = np.random.default_rng(77)
    for _ in range(46):                      # droplets — leaf/e-shed patter
        p0 = rng.integers(0, n - 600)
        f = rng.uniform(900, 3800)
        d = rng.integers(90, 380)
        tt = np.arange(d) / sr
        x[p0:p0 + d] += np.sin(2 * np.pi * f * tt).astype(np.float32) * np.exp(-tt / 0.006) * 0.3
    x = lp(x, 3400, sr)
    x = loopify(x, sr, 0.12)
    return stereoize(x, sr, haas_ms=1.2), sr


def p_skid():
    sr = SR_HI
    sec = 1.3
    n = int(sr * sec)
    t = np.arange(n) / sr
    wob = 2 * np.pi * np.arange(n) / sr * 7.0
    x = bp(noise(n, 9), 1750, sr, 7.0) + 0.3 * bp(noise(n, 9), 2130, sr, 7.0)
    x = x * (0.55 + 0.45 * np.sin(2 * np.pi * 23 * t).astype(np.float32)
             * np.sin(wob) * 0.3 + 0.7)
    x = sat(x, 1.9)
    x = hp(x, 900, sr)
    x *= adsr(n, sr, 0.02, 0.08, 0.85, 0.35)
    x = reverb(x, sr, 0.08, 0.6)
    return stereoize(x, sr, haas_ms=0.25), sr


PRESETS = {
    "siren": p_siren,
    "horn": p_horn,
    "gunshot": p_gunshot,
    "pickup": p_pickup,
    "impact": p_impact,
    "engine-idle": p_engine_idle,
    "rain-loop": p_rain,
    "skid": p_skid,
}


def write_wav(path, x, sr):
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767).astype('<i2').tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)
    return os.path.getsize(path)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    picked = [a for a in args if a in PRESETS] or list(PRESETS)
    R = {"job": "sound-v2", "steps": []}
    for name in picked:
        try:
            xs, sr = PRESETS[name]()
            path = os.path.join(OUT, f"{name}.wav")
            sz = write_wav(path, xs, sr)
            R["steps"].append({"step": name, "ok": True, "detail": f"{sz}B stereo @{sr}Hz"})
            print(f"[OK] {name} -> {sz} bytes (stereo @{sr}Hz)", flush=True)
        except Exception as e:
            import traceback
            traceback.print_exc()
            R["steps"].append({"step": name, "ok": False, "error": str(e)})
            print(f"[FAIL] {name} — {e}", flush=True)
    print("JOB_RESULT " + json.dumps(R), flush=True)

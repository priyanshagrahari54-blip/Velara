"""
VELARA Sound Team — Job: make-sound
===================================
numpy se game-ready WAV SFX (CC0 self-made). Blender ya plain python3 — dono chalta hai.
    python3 factory/jobs/make-sound.py <preset> [| more presets]
Presets: siren horn gunshot pickup impact engine-idle rain-loop skid
Output: factory/out/<preset>.wav  (16-bit PCM mono)
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


def n_t(sr, sec):
    return int(sr * sec)


def lowpass(x, cutoff, sr):
    a = 1.0 - np.exp(-2.0 * np.pi * cutoff / sr)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff, sr):
    return x - lowpass(x, cutoff, sr)


def env_ad(n, attack, decay, sr):
    e = np.ones(n, dtype=np.float32)
    na = max(1, int(attack * sr))
    nd = max(1, int(decay * sr))
    e[:na] = np.linspace(0, 1, na)
    if nd < n:
        e[-nd:] *= np.linspace(1, 0, nd)
    return e


def sweep(freq_from, freq_to, n, sr):
    t = np.arange(n) / sr
    f = freq_from + (freq_to - freq_from) * (t / t[-1])
    phase = 2 * np.pi * np.cumsum(f) / sr
    return phase


def sine(phase):
    return np.sin(phase)


def saw(phase):
    return ((phase / (2 * np.pi)) % 1.0) * 2.0 - 1.0


def saw_harm(phase, k=3):
    s = saw(phase).astype(np.float32)
    for i in range(2, k + 1):
        s += saw(phase * i).astype(np.float32) / i
    return s / 2.2


# ---------------------------------------------------------------- presets
def p_siren():
    """Indian police wail: 520->1150->520 sweep x2, harmonic bhari."""
    sr, sec = SR_HI, 2.4
    n = n_t(sr, sec)
    ph = sweep(520, 1150, n // 2, sr)
    ph2 = sweep(1150, 520, n - n // 2, sr)
    phase = np.concatenate([ph, ph2])
    x = saw_harm(phase, 3)
    x = lowpass(x, 3800, sr) * 0.8
    return x * env_ad(n, 0.05, 0.25, sr), sr


def p_horn():
    """Dual-tone 400+505Hz, thoda square feel."""
    sr, sec = SR_HI, 0.8
    n = n_t(sr, sec)
    t = np.arange(n) / sr
    x = np.sign(np.sin(2 * np.pi * 400 * t)) * 0.5 + np.sign(np.sin(2 * np.pi * 505 * t)) * 0.5
    x = lowpass(x.astype(np.float32), 2400, sr)
    return x * env_ad(n, 0.015, 0.18, sr), sr


def p_gunshot():
    """Noise burst + 150Hz thump + click."""
    sr, sec = SR_HI, 0.4
    n = n_t(sr, sec)
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n).astype(np.float32)
    t = np.arange(n) / sr
    burst = lowpass(noise, 3000, sr) * np.exp(-t / 0.055)
    thump = sine(2 * np.pi * 150 * t + 0.0).astype(np.float32) * np.exp(-t / 0.09) * 0.8
    click = np.zeros(n, dtype=np.float32)
    click[:40] = np.linspace(1, 0, 40)
    x = burst * 1.1 + thump + click * 0.6
    return x * 0.85, sr


def p_pickup():
    """Teeno-note chime: 880/1174/1568."""
    sr, sec = SR_HI, 0.55
    n = n_t(sr, sec)
    x = np.zeros(n, dtype=np.float32)
    for k, f in enumerate((880, 1174.66, 1567.98)):
        s = int(k * 0.09 * sr)
        e = min(n, s + n_t(sr, 0.35))
        t = np.arange(e - s) / sr
        x[s:e] += (sine(2 * np.pi * f * t).astype(np.float32) * 0.8
                   + sine(2 * np.pi * f * 2 * t).astype(np.float32) * 0.25
                   ) * np.exp(-t / 0.13) * 0.7
    return x, sr


def p_impact():
    """Crash: harsh noise + 80Hz dhuan."""
    sr, sec = SR_HI, 0.55
    n = n_t(sr, sec)
    rng = np.random.default_rng(11)
    t = np.arange(n) / sr
    noise = lowpass(rng.standard_normal(n).astype(np.float32), 1800, sr)
    thump = sine(2 * np.pi * 80 * t).astype(np.float32)
    x = noise * np.exp(-t / 0.14) + thump * np.exp(-t / 0.22) * 0.9
    return x * 0.9, sr


def p_engine_idle():
    """45Hz saw + 90Hz + 8Hz firing AM + halka noise. Seamless loop."""
    sr, sec = SR_LO, 2.4
    n = n_t(sr, sec)
    t = np.arange(n) / sr
    cycles = 45 * sec
    ph = 2 * np.pi * t * 45
    ph = np.linspace(0, 2 * np.pi * round(cycles), n)  # exact loop phase
    x = saw_harm(ph, 4) * 0.6
    x += sine(2 * np.pi * 90 * t + ph * 0).astype(np.float32) * 0.3
    x *= (0.75 + 0.25 * sine(2 * np.pi * 8 * t).astype(np.float32))   # firing throb
    rng = np.random.default_rng(3)
    x += lowpass(rng.standard_normal(n).astype(np.float32), 500, sr) * 0.22
    xf = 0.04 * sr
    w = np.ones(n, dtype=np.float32)
    w[:int(xf)] = np.linspace(0, 1, int(xf))
    x = x * w + np.roll(x, 1) * (1 - w)   # crossfade loop seam
    return x * 0.55, sr


def p_rain():
    """Pink-ish noise, seamless loop."""
    sr, sec = SR_LO, 4.0
    n = n_t(sr, sec)
    rng = np.random.default_rng(5)
    x = lowpass(rng.standard_normal(n).astype(np.float32), 1500, sr)
    x = lowpass(x, 1500, sr) * 1.4
    xf = 0.12 * sr
    w = np.ones(n, dtype=np.float32)
    w[:int(xf)] = np.linspace(0, 1, int(xf))
    x = x * w + np.roll(x, 1) * (1 - w)
    return x * 0.5, sr


def p_skid():
    """Tyre squeal: ~1.8kHz band noise + 28Hz AM."""
    sr, sec = SR_HI, 1.2
    n = n_t(sr, sec)
    rng = np.random.default_rng(9)
    noise = rng.standard_normal(n).astype(np.float32)
    x = highpass(lowpass(noise, 2600, sr), 1100, sr)
    t = np.arange(n) / sr
    x *= (0.6 + 0.4 * sine(2 * np.pi * 28 * t).astype(np.float32))
    return x * env_ad(n, 0.03, 0.3, sr) * 0.8, sr


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
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767).astype('<i2').tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm)
    return os.path.getsize(path)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    picked = [a for a in args if a in PRESETS] or list(PRESETS)
    R = {"job": "sound", "steps": []}
    for name in picked:
        try:
            x, sr = PRESETS[name]()
            path = os.path.join(OUT, f"{name}.wav")
            sz = write_wav(path, x, sr)
            dur = len(x) / sr
            R["steps"].append({"step": name, "ok": True, "detail": f"{sz}B {dur:.2f}s @{sr}Hz"})
            print(f"[OK] {name} -> {sz} bytes ({dur:.2f}s @ {sr}Hz)", flush=True)
        except Exception as e:
            R["steps"].append({"step": name, "ok": False, "error": str(e)})
            print(f"[FAIL] {name} — {e}", flush=True)
    print("JOB_RESULT " + json.dumps(R), flush=True)

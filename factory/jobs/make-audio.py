#!/usr/bin/env python3
"""
VELARA sound team — FULL procedural SFX pack (koi dependency nahi, sirf math).
Output: ue5/Content/Audio/RAW/*.wav (44.1kHz 16-bit mono — UE import-ready).
Sounds: engine loops (idle/high), skid, crash x2, siren, horn, footsteps x4,
city ambience, pickup, ui-click. Sab loop-friendly (crossfade-safe edges).
"""
import math
import os
import random
import struct
import wave

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "ue5", "Content", "Audio", "RAW"))
os.makedirs(OUT, exist_ok=True)
rng = random.Random(0x501D)


def write_wav(name, samples, gain=1.0):
    # clip + normalize-ish
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = min(1.0, 0.92 / peak) * gain
    path = os.path.join(OUT, name)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s * scale)) * 32767))
            for s in samples)
        w.writeframes(frames)
    print(f"  {name}: {len(samples)/SR:.2f}s {os.path.getsize(path)}B")


def sec(t):
    return int(SR * t)


def fade_edges(samples, ms=12):
    n = int(SR * ms / 1000)
    for i in range(n):
        f = i / n
        samples[i] *= f
        samples[-1 - i] *= f
    return samples


# ---------------------------------------------------------------- engine loops
def engine(fbase, harm, noise_amt, dur=2.4):
    n = sec(dur)
    out = []
    for i in range(n):
        t = i / SR
        s = 0.0
        for k in range(1, 5):
            s += (harm ** (k - 1)) * math.sin(2 * math.pi * fbase * k * t + k)
        # firing pulse roughness
        s += noise_amt * (rng.random() * 2 - 1)
        # slow RPM wobble (loop-safe: pura cycle)
        s *= 0.85 + 0.15 * math.sin(2 * math.pi * t / dur * 4)
        out.append(s * 0.25)
    return fade_edges(out)


write_wav("engine_idle_loop.wav", engine(28, 0.55, 0.16))
write_wav("engine_mid_loop.wav", engine(65, 0.5, 0.22))
write_wav("engine_high_loop.wav", engine(115, 0.45, 0.3))

# ---------------------------------------------------------------- skid loop
n = sec(1.6)
skid = []
lp = 0.0
for i in range(n):
    white = rng.random() * 2 - 1
    # bandpass feel: lowpass + highpass mix
    lp = lp * 0.91 + white * 0.09
    bp = white - lp
    t = i / SR
    skid.append(bp * (0.7 + 0.3 * math.sin(2 * math.pi * t * 9)) * 1.8)
write_wav("skid_loop.wav", fade_edges(skid))

# ---------------------------------------------------------------- crashes
def crash(dur=0.9, thump=True):
    n = sec(dur)
    out = []
    for i in range(n):
        t = i / SR
        env = math.exp(-t * 6.5)
        s = (rng.random() * 2 - 1) * env
        if thump:
            s += math.sin(2 * math.pi * 55 * t) * math.exp(-t * 9) * 1.2
            s += math.sin(2 * math.pi * 90 * t) * math.exp(-t * 12) * 0.6
        # metal ring
        s += math.sin(2 * math.pi * 1750 * t + 1) * math.exp(-t * 14) * 0.25
        out.append(s)
    return out


write_wav("crash_hard.wav", crash())
write_wav("crash_soft.wav", crash(0.55, thump=False))

# ---------------------------------------------------------------- siren (wail)
n = sec(4.0)
siren = []
for i in range(n):
    t = i / SR
    f = 700 + 250 * math.sin(2 * math.pi * t / 2.0)   # 2s up-down, loop 4s
    ph = 2 * math.pi * (f * t - 700 * t / 2)          # phase-integrated approx
    s = 0.6 * math.sin(ph) + 0.25 * math.sin(2 * ph) + 0.1 * math.sin(3 * ph)
    siren.append(s * 0.7)
write_wav("siren_loop.wav", fade_edges(siren, 25))

# ---------------------------------------------------------------- horn
n = sec(0.7)
horn = []
for i in range(n):
    t = i / SR
    env = min(1.0, t * 40) * min(1.0, (0.7 - t) * 14)
    s = 0.5 * math.sin(2 * math.pi * 340 * t) + 0.4 * math.sin(2 * math.pi * 425 * t) \
        + 0.12 * (rng.random() * 2 - 1)
    horn.append(s * env)
write_wav("horn.wav", horn)

# ---------------------------------------------------------------- footsteps
for k in range(4):
    n = sec(0.22)
    fs = []
    lp = 0.0
    for i in range(n):
        t = i / SR
        env = math.exp(-t * 42)
        white = rng.random() * 2 - 1
        lp = lp * 0.72 + white * 0.28
        fs.append(lp * env * 2.2)
    write_wav(f"footstep_0{k+1}.wav", fs)

# ---------------------------------------------------------------- city ambience
n = sec(9.0)
amb = []
brown = 0.0
events = [rng.uniform(1.0, 8.0) for _ in range(5)]     # bird chirp times
for i in range(n):
    t = i / SR
    white = rng.random() * 2 - 1
    brown = (brown + 0.018 * white) / 1.018
    s = brown * 2.2                                    # distant traffic bed
    s += 0.05 * math.sin(2 * math.pi * 120 * t)        # grid hum
    s += 0.03 * math.sin(2 * math.pi * 47 * t + 1.3)   # sub rumble
    for et in events:                                   # birds
        dt = t - et
        if 0 <= dt < 0.35:
            f = 2600 + 900 * math.sin(2 * math.pi * dt * 18)
            s += 0.16 * math.sin(2 * math.pi * f * dt) * math.exp(-dt * 9) \
                * math.sin(math.pi * dt / 0.35)
    amb.append(s)
write_wav("ambience_city_loop.wav", fade_edges(amb, 60))

# ---------------------------------------------------------------- pickup + ui
n = sec(0.5)
pick = []
for i in range(n):
    t = i / SR
    env = math.exp(-t * 5.5)
    s = 0.0
    for k, f in enumerate((620, 830, 1240)):
        if t > k * 0.07:
            s += math.sin(2 * math.pi * f * (t - k * 0.07)) * math.exp(-(t - k * 0.07) * 9)
    pick.append(s * 0.8)
write_wav("pickup.wav", pick)

n = sec(0.09)
click = []
for i in range(n):
    t = i / SR
    click.append(math.sin(2 * math.pi * 1800 * t) * math.exp(-t * 70))
write_wav("ui_click.wav", click)

print("\nAUDIO PACK DONE ->", OUT)

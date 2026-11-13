#!/usr/bin/env python3
"""Build self-contained MOBILE-REFS.html gallery (base64-embedded JPGs)."""
import base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "references", "mobile")
OUT = os.path.join(ROOT, "references", "MOBILE-REFS.html")

def b64(name):
    with open(os.path.join(IMG, name), "rb") as f:
        return base64.b64encode(f.read()).decode()

CTRL = [
    ("ctrl-1-wheel.jpg",   "A1 — STEERING WHEEL + PEDALS",
     "Bada neon wheel ghumao aur gaadi mode (Asphalt-style racing feel). Right side GAS/BRAKE pedals."),
    ("ctrl-2-buttons.jpg", "A2 — ARROW BUTTONS + PEDALS",
     "Left/right arrow buttons — sabse simple, reliable, galti se dabne ka risk kam."),
    ("ctrl-3-joystick.jpg","A3 — GAMEPAD JOYSTICK",
     "Console-style floating joystick + GAS/BRAKE/HANDBRAKE buttons — gamer wala feel."),
    ("ctrl-4-tilt.jpg",    "A4 — TILT STEERING",
     "Phone ko ghumao = steering. Screen par sirf pedals — sabse saaf view, immersive."),
    ("ctrl-5-slider.jpg",  "A5 — SLIDER STEERING",
     "Horizontal slider se precise steering angle — smooth, controlled driving."),
]

ICON = [
    ("icon-1-v.jpg",       "B1 — NEON V EMBLEM",
     "Bold letter V neon light-trails mein — premium minimal logo."),
    ("icon-2-car.jpg",     "B2 — NEON CAR SILHOUETTE",
     "Sports car front-view neon outline — classic racing icon."),
    ("icon-3-city.jpg",    "B3 — NEON CITY + SPEED STREAK",
     "Skyline + light streak — game ke 'City of Shadows' mood ka icon."),
    ("icon-4-chevron.jpg", "B4 — MINIMAL SPEED CHEVRON",
     "Flat V-chevron gradient — ultra-minimal modern tech look."),
    ("icon-5-retro.jpg",   "B5 — RETRO ARCADE PIXEL",
     "16-bit pixel car + trail — nostalgia, arcade vibe."),
]

def card(num, title, desc, img64):
    return f'''
<div style="background:#0c0e16;border:1px solid #1e2436;border-radius:16px;overflow:hidden;width:420px;max-width:100%;box-shadow:0 4px 24px rgba(0,0,0,.5)">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #1e2436">
    <span style="background:linear-gradient(135deg,#00e5ff,#ff2d95);color:#05060a;font-weight:800;font-size:18px;padding:4px 12px;border-radius:8px;letter-spacing:1px">{num}</span>
    <span style="font-weight:700;font-size:15px;color:#9fe8ff;letter-spacing:.5px">{title}</span>
  </div>
  <img src="data:image/jpeg;base64,{img64}" style="width:100%;display:block" alt="{title}">
  <div style="padding:10px 14px;font-size:13.5px;line-height:1.5;color:#aab3cc">{desc}</div>
</div>'''

def section(letter, heading, sub, items):
    cards = "".join(card(f"{letter}{i+1}", t, d, b64(f)) for i, (f, t, d) in enumerate(items))
    return f'''
<div style="margin:34px 16px">
  <div style="border-left:4px solid #00e5ff;padding-left:14px;margin-bottom:6px">
    <div style="font-size:26px;font-weight:800;letter-spacing:2px;color:#fff">SECTION {letter} — {heading}</div>
    <div style="font-size:14px;color:#7a86a3;margin-top:4px">{sub}</div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:16px">{cards}</div>
</div>'''

html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VELARA Mobile — Reference Picks</title></head>
<body style="margin:0;background:#07080d;color:#e8eaf2;font-family:'Segoe UI',Arial,sans-serif">
<div style="text-align:center;padding:30px 16px 6px">
  <div style="font-size:34px;font-weight:900;letter-spacing:6px;background:linear-gradient(90deg,#00e5ff,#ff2d95);-webkit-background-clip:text;background-clip:text;color:transparent">VELARA MOBILE</div>
  <div style="font-size:16px;color:#8b94ad;margin-top:8px">Android .apk aa raha hai — pehle style choose karo 👇</div>
</div>
{section("A", "TOUCH CONTROLS", "Phone par gaadi kaise chalaoge? (landscape game)" , CTRL)}
{section("B", "APP ICON", "APK ka icon / logo kaunsa look?", ICON)}
<div style="text-align:center;padding:26px 16px 40px;color:#7a86a3;font-size:14px">
  Answer mein number batao (jaise: <b style="color:#9fe8ff">A3 + B1</b>) — usi hisaab se game banaunga 🎮
</div>
</body></html>'''

with open(OUT, "w") as f:
    f.write(html)
print(f"Wrote {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)")

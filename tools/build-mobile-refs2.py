#!/usr/bin/env python3
"""Build self-contained MOBILE-REFS-2.html — AAA realistic style picks (no neon)."""
import base64, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "references", "mobile2")
OUT = os.path.join(ROOT, "references", "MOBILE-REFS-2.html")

def b64(name):
    with open(os.path.join(IMG, name), "rb") as f:
        return base64.b64encode(f.read()).decode()

STYLE = [
    ("s1-day.jpg",      "S1 — DOWNTOWN DAY",
     "Dopahar ka saaf din — glass towers, concrete buildings, white lane markings, soft shadows. GTA-jaisa clean realistic."),
    ("s2-golden.jpg",   "S2 — GOLDEN HOUR",
     "Sunset ka warm orange light, lambe soft shadows, glass buildings mein reflection. Cinematic feel."),
    ("s3-overcast.jpg", "S3 — OVERCAST MOODY",
     "Cloudy diffused light — muted gray-blue palette, thodi wet asphalt reflections. Serious grounded mood."),
    ("s4-night.jpg",    "S4 — REALISTIC NIGHT",
     "Raat par sirf warm street lamps + headlights — dark PAR READABLE. Neon zero, GTA-night jaisa."),
    ("s5-coastal.jpg",  "S5 — COASTAL CLEAN",
     "Bright coastal city — white/glass buildings, palm trees, samudar. Fresh aur halka feel."),
]

CTRL = [
    ("c1-wheel.jpg",    "C1 — STEERING WHEEL + PEDALS",
     "Bada realistic wheel — thumb se ghumao. Right side GAS/BRAKE pedals. Racing feel."),
    ("c2-arrows.jpg",   "C2 — ARROW BUTTONS + PEDALS",
     "Left/right white arrows — simple, reliable, galti se dabne ka risk kam."),
    ("c3-joystick.jpg", "C3 — GAMEPAD JOYSTICK",
     "Console-style joystick + GAS/BRAKE/HANDBRAKE arc mein — gamer wala feel."),
    ("c4-tilt.jpg",     "C4 — TILT STEERING",
     "Phone ghumao = steering. Screen par sirf pedals — sabse saaf view."),
    ("c5-slider.jpg",   "C5 — SLIDER STEERING",
     "Horizontal slider — precise steering angle, smooth control."),
]

def card(num, title, desc, img64):
    return f'''
<div style="background:#101318;border:1px solid #2a2f3a;border-radius:16px;overflow:hidden;width:420px;max-width:100%;box-shadow:0 4px 24px rgba(0,0,0,.5)">
  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #2a2f3a">
    <span style="background:#e8eaef;color:#101318;font-weight:800;font-size:18px;padding:4px 12px;border-radius:8px;letter-spacing:1px">{num}</span>
    <span style="font-weight:700;font-size:15px;color:#dfe3ec;letter-spacing:.5px">{title}</span>
  </div>
  <img src="data:image/jpeg;base64,{img64}" style="width:100%;display:block" alt="{title}">
  <div style="padding:10px 14px;font-size:13.5px;line-height:1.5;color:#a8b0c0">{desc}</div>
</div>'''

def section(letter, heading, sub, items):
    cards = "".join(card(f"{letter}{i+1}", t, d, b64(f)) for i, (f, t, d) in enumerate(items))
    return f'''
<div style="margin:34px 16px">
  <div style="border-left:4px solid #e8eaef;padding-left:14px;margin-bottom:6px">
    <div style="font-size:26px;font-weight:800;letter-spacing:2px;color:#fff">SECTION {letter} — {heading}</div>
    <div style="font-size:14px;color:#7a8296;margin-top:4px">{sub}</div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:16px">{cards}</div>
</div>'''

html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VELARA Mobile v2 — AAA Realistic Picks</title></head>
<body style="margin:0;background:#0b0d10;color:#e8eaf2;font-family:'Segoe UI',Arial,sans-serif">
<div style="text-align:center;padding:30px 16px 6px">
  <div style="font-size:34px;font-weight:900;letter-spacing:6px;color:#fff">VELARA <span style="color:#7a8296">MOBILE</span></div>
  <div style="font-size:15px;color:#8b94ad;margin-top:8px">Naya direction: AAA realistic, NO NEON — style choose karo 👇</div>
</div>
{section("S", "CITY / GRAPHICS STYLE", "Poore game ka look aur mood badal jayega", STYLE)}
{section("C", "TOUCH CONTROLS", "Phone par gaadi kaise chalaoge? (landscape)", CTRL)}
<div style="text-align:center;padding:20px 16px 40px;color:#7a86a3;font-size:14px">
  Answer mein batao (jaise: <b style="color:#dfe3ec">S2 + C1</b>) — icon ke AI refs agle message mein aayenge 🎮
</div>
</body></html>'''

with open(OUT, "w") as f:
    f.write(html)
print(f"Wrote {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)")

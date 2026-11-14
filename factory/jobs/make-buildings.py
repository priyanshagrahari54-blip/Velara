"""
VELARA Design Team — Job: "make-buildings" (MIXED CITY kit, bake-free)
======================================================================
User-picked Style B: glass towers + concrete mid-rise + street-level shops,
AUR kuch enterable shops (interior + counter + shelves). Sab bake-free
(Cycles headless bake black-texture bug — v2 cars mein root-fix hua tha):
material colors direct + vertex-color AO + 'WinGlow' emissive windows
(raat mein city.js env.windowGlow se intensity chalti hai).

  - tower-glass      16x16 footprint, ~42m — curtain wall, mullions,
                     floor slabs, parapet, water tank + AC, canopy
  - midrise-concrete 18x14, ~22m — frames, ledges, balconies, stairwell
  - shop-low         16x12, ~7m — shopfront glass + awning + sign + upper floor
  - shop-enterable   same + CENTER DOOR GAP + interior (shelves/counter/lights)

    blender --background --python factory/jobs/make-buildings.py -- tower-glass
"""
import json
import math
import os
import random
import sys
import traceback

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)

PRESETS = {
    "tower-glass": dict(seed=11),
    "midrise-concrete": dict(seed=23),
    "shop-low": dict(seed=31),
    "shop-enterable": dict(seed=47),
}

A = {"rx": 720, "ry": 500}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PRESET = argv[0] if argv else "tower-glass"
assert PRESET in PRESETS, f"unknown preset {PRESET}"
P = dict(PRESETS[PRESET])
GLB = os.path.join(OUT, f"{PRESET}.glb")
FBX = os.path.join(OUT, f"{PRESET}.fbx")
PNG = os.path.join(OUT, f"{PRESET}_preview.png")

R = {"job": f"building-{PRESET}", "steps": [], "cfg": {"preset": PRESET}}


def step(name, required=True):
    def wrap(fn):
        def run():
            try:
                detail = fn() or ""
                R["steps"].append({"step": name, "ok": True, "detail": str(detail)})
                print(f"[OK] {name} {detail}", flush=True)
            except Exception as e:
                R["steps"].append({"step": name, "ok": False,
                                   "detail": f"{e}\n{traceback.format_exc()[-600:]}"})
                print(f"[FAIL] {name} {e}", flush=True)
                if required:
                    raise
        return run
    return wrap


def set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return
    raise KeyError(names[0])


def principled(mat, base, rough, metallic=0.0, emission=None, emi_strength=0.0):
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    set_input(b, ["Base Color"], (*base, 1.0))
    set_input(b, ["Roughness"], rough)
    set_input(b, ["Metallic"], metallic)
    if emission:
        set_input(b, ["Emission Color", "Emission"], (*emission, 1.0))
        set_input(b, ["Emission Strength"], emi_strength)
    return mat


def box(parts, mat, sx, sy, sz, px, py, pz, ry=0.0):
    # CONVENTION: (sx, sy, sz) = (X-width, HEIGHT, Z-depth); pos (px, py, pz)
    # = (X, height, depth). Blender Z-up hai isliye map: blender(x, depth, height)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(px, pz, py), rotation=(0, 0, ry))
    o = bpy.context.active_object
    o.scale = (sx / 2, sz / 2, sy / 2)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.data.materials.append(mat)
    parts.append(o)
    return o


def cyl(parts, mat, r0, r1, h, px, py, pz, seg=12):
    # cylinder Blender me Z-aligned (vertical) — height seedha; pos map jaise box
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1, depth=h, location=(px, pz, py))
    o = bpy.context.active_object
    o.scale = (r0, r0, 1)
    bpy.ops.object.transform_apply(scale=True)
    parts.append(o)
    o.data.materials.append(mat)
    return o


# NOTE: Blender default Z-up hai; glTF export Y-up convert karta hai.
# Buildings ko X-Y footprint + Z height par model karte hain (city ROTATION
# export ke baad seedha khada hota hai — three.js mein Y-up ground XZ).

# ================================================================ BUILDERS
def build_tower(parts, M, rng):
    # HI-DETAIL (v0.6.2 UE-track): ~30k+ tris — har window cell me frame
    # (jambs/head/sill) + recess glass, corner columns, roof clutter, lobby
    W, D, H = 16.0, 16.0, 42.0
    floors = 12
    fh = H / floors
    cols = 10                     # curtain-wall module ~1.6m
    cw = W / cols
    # main glass volume
    box(parts, M["glass"], W, H, D, 0, 0, 0)
    # floor slabs (protruding trim)
    for i in range(floors + 1):
        z = -H / 2 + i * fh
        box(parts, M["trim"], W + 0.5, 0.28, D + 0.5, 0, z, 0)
    # curtain wall cells: 4 faces (fx/fz normal, off = half-extent us axis ka)
    faces = [(0, 1, D / 2), (0, -1, D / 2), (1, 0, W / 2), (-1, 0, W / 2)]
    for fx, fz, off in faces:
        for c in range(cols + 1):           # mullion verticals
            t = -W / 2 + c * cw
            if fx == 0:
                box(parts, M["trim"], 0.14, H, 0.16, t, 0, fz * (off + 0.05))
            else:
                box(parts, M["trim"], 0.16, H, 0.14, fx * (off + 0.05), 0, t)
        for i in range(floors):             # per-cell: recess + head + sill + jambs
            z = -H / 2 + (i + 0.5) * fh
            for c in range(cols):
                t = -W / 2 + (c + 0.5) * cw
                hw = cw / 2 - 0.08
                if fx == 0:
                    box(parts, M["lobby"], cw - 0.16, fh - 0.55, 0.06, t, z, fz * (off - 0.05))
                    box(parts, M["trim"], hw * 2, 0.1, 0.12, t, z + fh / 2 - 0.14, fz * (off + 0.02))
                    box(parts, M["trim"], hw * 2, 0.16, 0.16, t, z - fh / 2 + 0.16, fz * (off + 0.03))
                    box(parts, M["trim"], 0.09, fh - 0.55, 0.12, t - hw, z, fz * (off + 0.02))
                    box(parts, M["trim"], 0.09, fh - 0.55, 0.12, t + hw, z, fz * (off + 0.02))
                else:
                    box(parts, M["lobby"], 0.06, fh - 0.55, cw - 0.16, fx * (off - 0.05), z, t)
                    box(parts, M["trim"], 0.12, 0.1, hw * 2, fx * (off + 0.02), z + fh / 2 - 0.14, t)
                    box(parts, M["trim"], 0.16, 0.16, hw * 2, fx * (off + 0.03), z - fh / 2 + 0.16, t)
                    box(parts, M["trim"], 0.12, fh - 0.55, 0.09, fx * (off + 0.02), z, t - hw)
                    box(parts, M["trim"], 0.12, fh - 0.55, 0.09, fx * (off + 0.02), z, t + hw)
    # corner columns
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(parts, M["trim"], 0.7, H, 0.7, sx * (W / 2 + 0.15), 0, sz * (D / 2 + 0.15))
    # parapet + coping
    for (sx, sz, bw, bd) in [(0, 1, W + 0.4, 0.25), (0, -1, W + 0.4, 0.25), (1, 0, 0.25, D + 0.4), (-1, 0, 0.25, D + 0.4)]:
        box(parts, M["trim"], bw, 0.9, bd, sx * (W / 2 if sx else 0), H / 2 + 0.45, sz * (D / 2 if sz else 0))
        box(parts, M["metal"], bw + 0.12 if bw > 1 else bw, 0.14, bd + 0.12 if bd > 1 else bd,
            sx * (W / 2 if sx else 0), H / 2 + 0.95, sz * (D / 2 if sz else 0))
    # roof: water tank + legs + cap
    tx, tz = W / 2 - 3.0, -1.5
    cyl(parts, M["metal"], 1.4, 1.4, 2.6, tx, H / 2 + 1.8, tz, seg=24)
    cyl(parts, M["metal"], 1.48, 1.48, 0.18, tx, H / 2 + 3.2, tz, seg=24)
    for lx, lz in [(-0.9, -0.9), (0.9, -0.9), (-0.9, 0.9), (0.9, 0.9)]:
        box(parts, M["metal"], 0.12, 0.6, 0.12, tx + lx, H / 2 + 0.3, tz + lz)
    # AC units with grill slats
    for k in range(4):
        ax = -W / 2 + 3 + (k % 2) * 4.5
        az = -D / 2 + 3.5 + (k // 2) * 5.5
        box(parts, M["metal"], 1.8, 1.0, 1.4, ax, H / 2 + 0.5, az)
        for s in range(6):
            box(parts, M["trim"], 1.5, 0.07, 0.09, ax, H / 2 + 0.85, az - 0.55 + s * 0.22)
    # mast + dishes + vents
    cyl(parts, M["metal"], 0.09, 0.14, 6.0, -W / 2 + 2, H / 2 + 3.0, D / 2 - 2.5, seg=12)
    box(parts, M["metal"], 0.9, 0.6, 0.08, -W / 2 + 2.6, H / 2 + 4.4, D / 2 - 2.5)
    for vx, vz in [(-5, -4.2), (5, -4.2), (-5, 4.2)]:
        cyl(parts, M["trim"], 0.2, 0.27, 1.0, vx, H / 2 + 0.5, vz, seg=12)
    # entrance: canopy + rods + pilasters + lobby glass + steps (front +Z)
    box(parts, M["trim"], 7.0, 0.35, 2.6, 0, -H / 2 + 3.2, D / 2 + 1.1)
    for rx in (-3.0, 3.0):
        cyl(parts, M["metal"], 0.06, 0.06, 3.0, rx, -H / 2 + 1.6, D / 2 + 2.0, seg=8)
    box(parts, M["lobby"], 6.0, 6.0, 0.15, 0, -H / 2 + 3.0, D / 2 + 0.02)
    for px in (-3.4, 3.4):
        box(parts, M["trim"], 0.5, 6.4, 0.4, px, -H / 2 + 3.2, D / 2 + 0.1)
    box(parts, M["concrete2"], 8.0, 0.24, 1.0, 0, -H / 2 - 0.12, D / 2 + 1.4)
    box(parts, M["concrete2"], 6.4, 0.24, 0.6, 0, -H / 2 - 0.34, D / 2 + 1.8)
    return W, D, H


def build_midrise(parts, M, rng):
    # HI-DETAIL: window jambs har floor, baluster-wali balconies, string
    # courses, pilasters, cornice, roof clutter — ~20k+ tris
    W, D, H = 18.0, 14.0, 22.0
    floors = 6
    fh = H / floors
    box(parts, M["concrete"], W, H, D, 0, 0, 0)
    # stairwell strip + roof-box
    box(parts, M["concrete2"], 3.2, H + 0.3, 0.35, -W / 2 + 2.2, 0, D / 2 + 0.1)
    box(parts, M["concrete2"], 3.4, 0.6, 1.6, -W / 2 + 2.2, H / 2 + 0.3, D / 2 - 0.6)
    # pilasters (front corners + mid)
    for px in (-W / 2 + 0.45, W / 2 - 0.45, -1.5, 3.8):
        box(parts, M["concrete2"], 0.55, H, 0.28, px, 0, D / 2 + 0.06)
    for i in range(floors):
        z = -H / 2 + (i + 0.5) * fh
        # string course (front + back)
        box(parts, M["trim"], W + 0.35, 0.2, D + 0.35, 0, z - fh / 2 + 0.1, 0)
        # windows (front + back): jambs + head + sill + glass inset
        for wx in [-5.5, -1.2, 3.1]:
            for sgn in (1, -1):
                zf = sgn * (D / 2 + 0.06)
                box(parts, M["frame"], 2.1, 1.5, 0.12, wx, z, zf)
                box(parts, M["trim"], 2.3, 0.14, 0.18, wx, z + 0.8, zf + sgn * 0.02)
                box(parts, M["trim"], 2.35, 0.16, 0.22, wx, z - 0.8, zf + sgn * 0.03)
        # side windows (left + right)
        for wz in (-4.5, 0, 4.5):
            for sgn in (1, -1):
                xf = sgn * (W / 2 + 0.06)
                box(parts, M["frame"], 0.12, 1.5, 2.1, xf, z, wz)
                box(parts, M["trim"], 0.22, 0.16, 2.35, xf + sgn * 0.03, z - 0.8, wz)
        # balconies front par (alternate floors) — slab + balusters + rails
        if i % 2 == 1:
            for bx in (-4.6, 1.6):
                box(parts, M["trim"], 3.2, 0.18, 1.15, bx, z - fh / 2 + 0.05, D / 2 + 0.52)
                box(parts, M["rail"], 3.2, 0.09, 0.09, bx, z - fh / 2 + 0.92, D / 2 + 1.04)
                for b in range(13):
                    box(parts, M["rail"], 0.07, 0.72, 0.07, bx - 1.5 + b * 0.25,
                        z - fh / 2 + 0.49, D / 2 + 1.04)
                box(parts, M["rail"], 0.09, 0.92, 0.09, bx - 1.58, z - fh / 2 + 0.5, D / 2 + 0.55)
                box(parts, M["rail"], 0.09, 0.92, 0.09, bx + 1.58, z - fh / 2 + 0.5, D / 2 + 0.55)
                for br in (-1.2, 1.2):
                    box(parts, M["trim"], 0.14, 0.14, 0.7, bx + br, z - fh / 2 - 0.02, D / 2 + 0.25)
    # cornice 2-layer + parapet
    box(parts, M["trim"], W + 0.5, 0.35, D + 0.5, 0, H / 2 - 0.2, 0)
    box(parts, M["trim"], W + 0.3, 0.7, 0.2, 0, H / 2 + 0.35, D / 2)
    box(parts, M["trim"], 0.2, 0.7, D + 0.3, W / 2, H / 2 + 0.35, 0)
    box(parts, M["trim"], 0.2, 0.7, D + 0.3, -W / 2, H / 2 + 0.35, 0)
    # roof: tank + 3 AC (grills) + vents
    cyl(parts, M["metal"], 1.0, 1.0, 1.9, W / 2 - 2.5, H / 2 + 0.95, -D / 2 + 2.5, seg=20)
    for k in range(3):
        ax = -W / 2 + 3 + k * 3.6
        box(parts, M["metal"], 1.6, 0.9, 1.2, ax, H / 2 + 0.45, D / 2 - 2.2)
        for s in range(5):
            box(parts, M["trim"], 1.3, 0.06, 0.08, ax, H / 2 + 0.75, D / 2 - 2.75 + s * 0.28)
    for vx in (-6, 6):
        cyl(parts, M["trim"], 0.18, 0.24, 0.9, vx, H / 2 + 0.45, 0, seg=12)
    return W, D, H


def build_shop(parts, M, rng, enterable=False):
    # HI-DETAIL: shopfront mullion grid, awning ribs + valance, framed upper
    # windows, cornice, roof clutter; enterable me shelf ITEMS bhi
    W, D, H = 16.0, 12.0, 7.0
    # neeche 3.4 shopfront, upar residential mass
    shopH = 3.4
    upH = H - shopH
    box(parts, M["concrete"], W, upH, D, 0, shopH + upH / 2, 0)
    # shopfront: piers + glass + spandrel (front +Z)
    # (enterable: Beech ka pier NAHI — wahi darwaza hai)
    piers = [-W / 2 + 0.9, W / 2 - 0.9] if enterable else [-W / 2 + 0.9, 0, W / 2 - 0.9]
    for px in piers:
        box(parts, M["frame"], 0.55, shopH, 0.3, px, shopH / 2, D / 2 + 0.05)
    doorW = 3.0 if enterable else 0.0
    glassSpans = [(-W / 2 + 1.6, -doorW / 2 - 0.4), (doorW / 2 + 0.4, W / 2 - 1.6)] \
        if enterable else [(-W / 2 + 1.6, W / 2 - 1.6)]
    for gx0, gx1 in glassSpans:
        gw = gx1 - gx0
        if gw > 0.3:
            gcx = (gx0 + gx1) / 2
            box(parts, M["shopglass"], gw, shopH - 0.9, 0.1, gcx, shopH / 2 + 0.2, D / 2 + 0.05)
            # mullion grid: verticals har ~1.6m + 2 transoms
            nm = max(1, int(gw / 1.6))
            for m in range(1, nm):
                box(parts, M["frame"], 0.09, shopH - 0.9, 0.14,
                    gx0 + gw * m / nm, shopH / 2 + 0.2, D / 2 + 0.09)
            for ty in (1.1, 2.2):
                box(parts, M["frame"], gw, 0.09, 0.14, gcx, ty, D / 2 + 0.09)
    if enterable:
        # door frame + kick plates
        box(parts, M["frame"], 0.22, 3.0, 0.34, -doorW / 2 - 0.08, 1.5, D / 2 + 0.1)
        box(parts, M["frame"], 0.22, 3.0, 0.34, doorW / 2 + 0.08, 1.5, D / 2 + 0.1)
        box(parts, M["frame"], doorW + 0.5, 0.24, 0.34, 0, 3.05, D / 2 + 0.1)
    # awning: slab + ribs + valance (colored)
    aw = W - 1.0
    box(parts, M["awning"], aw, 0.22, 1.5, 0, shopH + 0.15, D / 2 + 0.7)
    for r in range(9):
        box(parts, M["trim"], 0.1, 0.26, 1.62, -aw / 2 + 0.6 + r * (aw - 1.2) / 8,
            shopH + 0.17, D / 2 + 0.72)
    box(parts, M["awning"], aw, 0.3, 0.08, 0, shopH - 0.02, D / 2 + 1.42)
    # sign board + lit strip + side returns
    box(parts, M["sign"], W - 2.0, 0.9, 0.25, 0, shopH + 0.95, D / 2 + 0.12)
    box(parts, M["signglow"], W - 2.6, 0.28, 0.06, 0, shopH + 0.95, D / 2 + 0.28)
    box(parts, M["sign"], 0.25, 0.9, 0.9, -W / 2 + 0.95, shopH + 0.95, D / 2 + 0.35)
    box(parts, M["sign"], 0.25, 0.9, 0.9, W / 2 - 0.95, shopH + 0.95, D / 2 + 0.35)
    # upper windows + ledges (framed)
    for wx in (-4.5, 0, 4.5):
        box(parts, M["frame"], 1.9, 1.4, 0.12, wx, shopH + upH / 2, D / 2 + 0.06)
        box(parts, M["trim"], 2.15, 0.12, 0.16, wx, shopH + upH / 2 + 0.78, D / 2 + 0.08)
        box(parts, M["trim"], 2.2, 0.14, 0.2, wx, shopH + upH / 2 - 0.78, D / 2 + 0.09)
    box(parts, M["trim"], W + 0.2, 0.18, D + 0.2, 0, shopH + 0.02, 0)
    # cornice + parapet + finials
    box(parts, M["trim"], W + 0.35, 0.3, D + 0.35, 0, H + 0.05, 0)
    box(parts, M["trim"], W + 0.2, 0.5, 0.18, 0, H + 0.25, D / 2)
    box(parts, M["trim"], 0.18, 0.5, D + 0.2, W / 2, H + 0.25, 0)
    box(parts, M["trim"], 0.18, 0.5, D + 0.2, -W / 2, H + 0.25, 0)
    for fx2 in (-W / 2 + 0.9, W / 2 - 0.9):
        cyl(parts, M["metal"], 0.16, 0.22, 0.5, fx2, H + 0.6, D / 2, seg=12)
    # roof: 2 AC + vents
    for k in range(2):
        ax = -3.5 + k * 6.5
        box(parts, M["metal"], 1.5, 0.85, 1.2, ax, H + 0.42, -D / 2 + 2.0)
        for s in range(5):
            box(parts, M["trim"], 1.2, 0.06, 0.08, ax, H + 0.72, -D / 2 + 1.45 + s * 0.28)
    cyl(parts, M["trim"], 0.16, 0.2, 0.8, 5.5, H + 0.4, 1.5, seg=12)
    if enterable:
        # ---- INTERIOR: floor already sidewalk (y=0). walls + shelves + counter
        iw, idp = W - 1.2, D - 1.6
        # side walls interior trim (visual)
        box(parts, M["interior"], 0.18, shopH - 0.2, idp, -iw / 2, (shopH - 0.2) / 2, 0)
        box(parts, M["interior"], 0.18, shopH - 0.2, idp, iw / 2, (shopH - 0.2) / 2, 0)
        # back wall with shelf blocks
        box(parts, M["interior"], iw, shopH - 0.2, 0.18, 0, (shopH - 0.2) / 2, -idp / 2)
        for sy in [0.55, 1.35, 2.15]:
            box(parts, M["shelf"], iw - 2.5, 0.07, 0.55, 0, sy, -idp / 2 + 0.45)
            # HI-DETAIL: shelf par ITEM boxes (rand-size/color mix)
            nitems = 14
            for it in range(nitems):
                ix = -(iw - 3.0) / 2 + it * ((iw - 3.0) / (nitems - 1))
                ih = 0.18 + rng.random() * 0.22
                iw2 = 0.28 + rng.random() * 0.25
                mat = M["shelf"] if (it + int(sy * 10)) % 3 else M["counter"]
                box(parts, mat, iw2, ih, 0.3 + rng.random() * 0.15,
                    ix, sy + ih / 2 + 0.04, -idp / 2 + 0.42)
        # counter (right side) — top + body + front panels
        cx0 = iw / 2 - 2.6
        box(parts, M["counter"], 3.6, 0.12, 0.9, cx0, 1.06, 0.8)
        box(parts, M["counter"], 3.4, 0.95, 0.7, cx0, 0.5, 0.8)
        for p in range(4):
            box(parts, M["interior"], 0.06, 0.7, 0.05, cx0 - 1.5 + p, 0.55, 1.2)
        # display case on counter
        box(parts, M["shopglass"], 1.4, 0.55, 0.7, cx0 - 0.8, 1.4, 0.8)
        # ceiling light strips (emissive) + hanging pendant on door
        box(parts, M["ceilglow"], iw - 3.0, 0.08, 0.3, 0, shopH - 0.15, -0.8)
        box(parts, M["ceilglow"], iw - 3.0, 0.08, 0.3, 0, shopH - 0.15, 1.6)
        cyl(parts, M["metal"], 0.03, 0.03, 0.5, 0, shopH - 0.4, D / 2 - 1.2, seg=6)
        box(parts, M["ceilglow"], 0.5, 0.18, 0.5, 0, shopH - 0.55, D / 2 - 1.2)
    return W, D, H


# ================================================================ 1. MODEL
@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(P["seed"])

    M = {
        "glass": principled(bpy.data.materials.new("Glass"), (0.16, 0.20, 0.24), 0.14, 0.85),
        "lobby": principled(bpy.data.materials.new("Lobby"), (0.20, 0.26, 0.30), 0.10, 0.8),
        "trim": principled(bpy.data.materials.new("Trim"), (0.52, 0.53, 0.55), 0.75),
        "concrete": principled(bpy.data.materials.new("Concrete"), (0.55, 0.52, 0.48), 0.88),
        "concrete2": principled(bpy.data.materials.new("Concrete2"), (0.42, 0.40, 0.38), 0.9),
        "metal": principled(bpy.data.materials.new("Metal"), (0.35, 0.37, 0.40), 0.55, 0.6),
        "frame": principled(bpy.data.materials.new("Frame"), (0.10, 0.11, 0.12), 0.6),
        "rail": principled(bpy.data.materials.new("Rail"), (0.14, 0.15, 0.16), 0.5, 0.4),
        "shopglass": principled(bpy.data.materials.new("ShopGlass"), (0.12, 0.16, 0.18), 0.08, 0.8),
        "awning": principled(bpy.data.materials.new("Awning"), (0.55, 0.22, 0.16), 0.8),
        "sign": principled(bpy.data.materials.new("Sign"), (0.18, 0.19, 0.21), 0.7),
        "signglow": principled(bpy.data.materials.new("SignGlow"), (0.9, 0.88, 0.8), 0.4,
                               emission=(1.0, 0.92, 0.78), emi_strength=3.0),
        "interior": principled(bpy.data.materials.new("Interior"), (0.60, 0.57, 0.52), 0.9),
        "shelf": principled(bpy.data.materials.new("Shelf"), (0.40, 0.30, 0.20), 0.85),
        "counter": principled(bpy.data.materials.new("Counter"), (0.30, 0.32, 0.34), 0.65),
        "ceilglow": principled(bpy.data.materials.new("CeilGlow"), (0.95, 0.93, 0.88), 0.4,
                               emission=(1.0, 0.97, 0.9), emi_strength=4.0),
    }
    parts = []
    if PRESET == "tower-glass":
        W, D, H = build_tower(parts, M, rng)
    elif PRESET == "midrise-concrete":
        W, D, H = build_midrise(parts, M, rng)
    else:
        W, D, H = build_shop(parts, M, rng, enterable=(PRESET == "shop-enterable"))

    # ---------------- WinGlow: random window quads (raat ki roshni) ----------
    glow_parts = []
    if PRESET == "tower-glass":
        for i in range(12):
            z = -H / 2 + (i + 0.5) * (H / 12)
            for face in (1, -1):
                for x in [-5.0, -1.0, 3.0]:
                    if rng.random() < 0.45:
                        box(glow_parts, M["signglow"], 1.6, 1.1, 0.03,
                            x + (0 if face == 1 else 0), z, face * (D / 2 + 0.03))
        for y in [-4.5, 0, 4.5]:
            if rng.random() < 0.4:
                box(glow_parts, M["signglow"], 0.03, 1.1, 1.6, (W / 2 + 0.03), -H / 2 + 3.5, y)
    elif PRESET == "midrise-concrete":
        for i in range(6):
            z = -H / 2 + (i + 0.5) * (H / 6)
            for wx in [-5.5, -1.2, 3.1]:
                if rng.random() < 0.4:
                    box(glow_parts, M["signglow"], 1.7, 1.0, 0.03, wx, z, D / 2 + 0.09)
    else:
        for wx in [-4.5, 0, 4.5]:
            if rng.random() < 0.5:
                box(glow_parts, M["signglow"], 1.5, 1.0, 0.03, wx, 3.4 + (H - 3.4) / 2, D / 2 + 0.09)

    # ---------------- join per material group ----------------
    # tower/midrise centered hain (-H/2..H/2) — base ko z=0 par le aao
    # (shop pehle se 0..H hai)
    if PRESET in ("tower-glass", "midrise-concrete"):
        for o in parts:
            o.location.z += H / 2
        for o in glow_parts:
            o.location.z += H / 2

    def join_all(parts_list, name):
        if not parts_list:
            return None
        bpy.ops.object.select_all(action="DESELECT")
        for o in parts_list:
            o.select_set(True)
        bpy.context.view_layer.objects.active = parts_list[0]
        bpy.ops.object.join()
        obj = bpy.context.active_object
        obj.name = name
        return obj

    body = join_all(parts, "Building")
    glow = join_all(glow_parts, "WinGlow")
    globals()["BUILDING"] = body
    globals()["GLOW"] = glow
    tris = sum(len(p.vertices) - 2 for o in ([body] if body else []) + ([glow] if glow else [])
               for p in o.data.polygons)
    return f"parts={len(parts)} glow={len(glow_parts)} tris~{tris}"


# ================================================================ 2. VERTEX AO
@step("vertex_ao")
def vertex_ao():
    import random
    rng = random.Random(P["seed"] + 7)
    out = []
    for nm in ("BUILDING", "GLOW"):
        obj = globals().get(nm)
        if not obj:
            continue
        col = obj.data.attributes.new("ao", "BYTE_COLOR", "POINT")
        zs = [v.co.z for v in obj.data.vertices]
        zmin, zmax = min(zs), max(zs)
        for i, v in enumerate(obj.data.vertices):
            t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
            g = 0.72 + 0.28 * (t ** 0.7)          # neeche darker (grime)
            g *= 0.96 + 0.07 * rng.random()        # plaster mottling
            g = max(0.3, min(1.0, g))
            col.data[i].color = (g, g, g, 1.0)
        out.append(nm)
    return f"{out} verts={len(globals()['BUILDING'].data.vertices)}"


# ================================================================ 3. PREVIEW
@step("preview_render", required=False)
def preview():
    scene = bpy.context.scene
    obj = globals()["BUILDING"]
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    scene.cycles.samples = 32
    bpy.context.view_layer.cycles.use_denoising = True
    dims = obj.dimensions
    hgt = max(dims)
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    d = hgt * 1.35
    cam.location = (d * 0.75, -d, hgt * 0.55)
    cam.rotation_euler = (math.radians(70), 0, math.radians(40))
    cam_data.lens = 50
    scene.camera = cam
    for pos, e in (((d, -d * 0.4, hgt), 1500), ((-d, -d * 0.2, hgt * 0.6), 400), ((0, d, hgt), 300)):
        l = bpy.data.lights.new(f"L{e}", "AREA")
        l.energy = e * max(1.0, hgt / 20)
        l.size = 8
        lo = bpy.data.objects.new(f"L{e}", l)
        lo.location = pos
        scene.collection.objects.link(lo)
    bg = bpy.data.worlds.new("Bg")
    bg.use_nodes = True
    set_input(bg.node_tree.nodes["Background"], ["Color"], (0.58, 0.60, 0.64, 1.0))
    scene.world = bg
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PNG
    bpy.ops.render.render(write_still=True)
    return PNG


# ================================================================ 4. EXPORT
@step("glb_export")
def export_glb():
    objs = [globals()["BUILDING"]] + ([globals()["GLOW"]] if globals().get("GLOW") else [])
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    return f"{os.path.getsize(GLB)} bytes (bake-free)"


@step("fbx_export")
def export_fbx():
    # UE-track: Unreal Engine ke liye FBX (Y-up, cm-scale, unit scale on)
    objs = [globals()["BUILDING"]] + ([globals()["GLOW"]] if globals().get("GLOW") else [])
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.fbx(
        filepath=FBX,
        use_selection=True,
        apply_unit_scale=True,
        global_scale=1.0,
        apply_scale_options="FBX_SCALE_NONE",
        axis_forward="-Z",
        axis_up="Y",
        bake_space_transform=True,
        mesh_smooth_type="OFF",
        add_leaf_bones=False,
        object_types={"MESH"},
    )
    return f"{os.path.getsize(FBX)} bytes"


# ---------------------------------------------------------------- main
try:
    build()
    vertex_ao()
    preview()
    export_glb()
    export_fbx()
except Exception:
    traceback.print_exc()

obj = globals().get("BUILDING")
if obj:
    R["verts"] = len(obj.data.vertices)
    R["tris"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
if os.path.exists(GLB):
    R["glb_bytes"] = os.path.getsize(GLB)
    R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)
if any(not s["ok"] for s in R["steps"]):
    print("JOB_FAILED — nonzero exit", flush=True)
    sys.exit(1)

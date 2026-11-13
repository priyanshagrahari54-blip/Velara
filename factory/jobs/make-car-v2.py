"""
VELARA Design Team — Job: "make-car-v2" (ULTRA-DETAIL lofted vehicle designer)
==============================================================================
v1 (make-car.py) = beveled boxes. v2 = REAL car surfaces:

  - Lofted body: 46 cross-section stations x 24-pt superellipse rings,
    style profiles (belt/plan/tumblehome) + wheel arches math se carved,
    subdivision-smoothed => asli car silhouette, dabbe khatam.
  - Lofted glass canopy (panorama roof), tumblehome ke saath.
  - Detail: splitter, diffuser, grille slats, door seams, mirrors,
    DRL strips, full-width rear lightbar, exhausts, window trim.
  - Wheels v2: tire + rim + 5 spokes + hub + brake disc (vertex-color).
  - Contract SAME: WheelFL/FR/RL/RR nodes + LightRear mesh + Draco GLB.

    blender --background --python factory/jobs/make-car-v2.py -- velara-gt
"""
import json
import math
import os
import sys
import traceback

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)

PRESETS = {
    "velara-gt":   dict(L=4.42, W=1.94, H=1.24, wheelR=0.335, wheelbase=2.72,
                        cabinH=0.46, cabinLen=1.55, clearance=0.13,
                        paint=(0.66, 0.04, 0.055), spoiler=True,  style="sports"),
    "titan-rs":    dict(L=4.75, W=1.90, H=1.44, wheelR=0.35, wheelbase=2.85,
                        cabinH=0.58, cabinLen=1.95, clearance=0.17,
                        paint=(0.07, 0.11, 0.34), spoiler=False, style="muscle"),
    "pico-s":      dict(L=3.65, W=1.74, H=1.56, wheelR=0.31, wheelbase=2.45,
                        cabinH=0.72, cabinLen=1.85, clearance=0.18,
                        paint=(0.86, 0.78, 0.18), spoiler=False, style="hatch"),
    "colossus-v":  dict(L=5.05, W=2.02, H=1.86, wheelR=0.42, wheelbase=3.0,
                        cabinH=0.78, cabinLen=2.1, clearance=0.30,
                        paint=(0.10, 0.19, 0.15), spoiler=False, style="suv", rails=True),
    "police":      dict(L=4.90, W=1.92, H=1.50, wheelR=0.34, wheelbase=2.95,
                        cabinH=0.62, cabinLen=1.95, clearance=0.16,
                        paint=(0.90, 0.90, 0.92), spoiler=False, style="muscle",
                        lightbar=True, police=True),
}

A = {"bake": 1024, "ao": 512, "rough": 512, "samples": 72, "rx": 896, "ry": 608}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PRESET = argv[0] if argv else "velara-gt"
assert PRESET in PRESETS, f"unknown preset {PRESET}"
i = 1
while i + 1 <= len(argv):
    k = argv[i].lstrip("-")
    if i + 1 < len(argv):
        try:
            A[k] = int(argv[i + 1])
        except ValueError:
            A[k] = argv[i + 1]
    i += 2
P = PRESETS[PRESET]
GLB = os.path.join(OUT, f"{PRESET}.glb")
PNG = os.path.join(OUT, f"{PRESET}_preview.png")
STUDIO_PNG = os.path.join(OUT, f"{PRESET}_studio.png")
AO_PNG = os.path.join(OUT, f"{PRESET}_ao.png")
N_PNG = os.path.join(OUT, f"{PRESET}_normal.png")
R_PNG = os.path.join(OUT, f"{PRESET}_rough.png")

GLOW_F = ((0.95, 0.97, 1.0, 1.0), 6.0, 40.0)
GLOW_R = ((1.0, 0.05, 0.08, 1.0), 4.0, 26.0)

R = {"job": f"car-v2-{PRESET}", "steps": [], "cfg": {**A, "preset": PRESET}}


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


def setup_cycles(samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    scene.cycles.samples = samples
    try:
        scene.cycles.use_denoising = True
    except AttributeError:
        try:
            bpy.context.view_layer.cycles.use_denoising = True
        except Exception:
            pass
    return "cpu"


# ================================================================ 1. MODEL (v2)
NS, MR = 64, 36          # body stations x ring points (REMASTER hi-detail)
PROFILES = {
    "sports": dict(
        belt=[(0.0, 0.93), (0.10, 0.97), (0.30, 1.0), (0.55, 1.01), (0.70, 0.86),
              (0.85, 0.72), (1.0, 0.58)],
        plan=[(0.0, 0.78), (0.14, 0.92), (0.5, 1.0), (0.82, 0.95), (1.0, 0.70)],
        round=2.7, tumble=0.84),
    "muscle": dict(
        belt=[(0.0, 0.95), (0.15, 1.0), (0.55, 1.02), (0.75, 0.94), (0.90, 0.85),
              (1.0, 0.76)],
        plan=[(0.0, 0.86), (0.2, 0.95), (0.5, 1.0), (0.85, 0.97), (1.0, 0.84)],
        round=2.5, tumble=0.87),
    "hatch": dict(
        belt=[(0.0, 1.0), (0.30, 1.02), (0.60, 1.03), (0.82, 0.97), (1.0, 0.84)],
        plan=[(0.0, 0.93), (0.3, 0.98), (0.6, 1.0), (1.0, 0.88)],
        round=2.4, tumble=0.9),
    "suv": dict(
        belt=[(0.0, 1.0), (0.25, 1.02), (0.65, 1.02), (0.85, 0.96), (1.0, 0.86)],
        plan=[(0.0, 0.92), (0.3, 0.98), (0.65, 1.0), (1.0, 0.9)],
        round=2.35, tumble=0.9),
    "bus": dict(
        belt=[(0.0, 1.0), (0.5, 1.0), (1.0, 0.92)],
        plan=[(0.0, 0.95), (0.5, 1.0), (1.0, 0.95)],
        round=2.2, tumble=0.94),
}


def curve(u, pts):
    if u <= pts[0][0]:
        return pts[0][1]
    if u >= pts[-1][0]:
        return pts[-1][1]
    for k in range(len(pts) - 1):
        u0, v0 = pts[k]
        u1, v1 = pts[k + 1]
        if u0 <= u <= u1:
            t = (u - u0) / (u1 - u0 + 1e-9)
            t = 0.5 - 0.5 * math.cos(t * math.pi)
            return v0 + (v1 - v0) * t
    return pts[-1][1]


def spow(v, p):
    return math.copysign(abs(v) ** p, v)


@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    L, W, H = P["L"], P["W"], P["H"]
    cl = P["clearance"]
    bodyH = H - P["cabinH"] - cl
    style = P.get("style", "sports")
    prof = PROFILES.get(style, PROFILES["sports"])

    # ---------------- materials ----------------
    paint = bpy.data.materials.new("Paint")
    paint.use_nodes = True
    pb = paint.node_tree.nodes["Principled BSDF"]
    set_input(pb, ["Base Color"], (*P["paint"], 1.0))
    set_input(pb, ["Metallic"], 0.75)
    set_input(pb, ["Roughness"], 0.30)
    try:
        set_input(pb, ["Clearcoat"], 0.9)
        set_input(pb, ["Clearcoat Roughness"], 0.08)
    except KeyError:
        pass

    glass = bpy.data.materials.new("Glass")
    glass.use_nodes = True
    gb = glass.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.02, 0.03, 0.05, 1.0))
    set_input(gb, ["Metallic"], 0.9)
    set_input(gb, ["Roughness"], 0.08)

    trim = bpy.data.materials.new("Trim")
    trim.use_nodes = True
    tb = trim.node_tree.nodes["Principled BSDF"]
    set_input(tb, ["Base Color"], (0.05, 0.055, 0.065, 1.0))
    set_input(tb, ["Metallic"], 0.3)
    set_input(tb, ["Roughness"], 0.6)

    def mk_light(name, color, strength):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        set_input(b, ["Emission Color", "Emission"], color)
        set_input(b, ["Emission Strength"], strength)
        return m

    lightF = mk_light("LightFront", GLOW_F[0], GLOW_F[1])
    lightR = mk_light("LightRear", GLOW_R[0], GLOW_R[1])

    def box(sx, sy, sz, loc, mat, name, rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if rot:
            o.rotation_euler = rot
        o.data.materials.append(mat)
        return o

    # ---------------- generic loft (smooth surfaces ka engine) ----------------
    def loft(name, mat, stations, subsurf=2):
        """stations: list of (y, wHalf, zBot, zTop, e, tumble)."""
        verts, faces = [], []

        def ring(st):
            y, wHalf, zBot, zTop, e, tum = st
            zc = (zTop + zBot) / 2
            zh = (zTop - zBot) / 2
            pts = []
            for j in range(MR):
                t = 2 * math.pi * j / MR
                c, s = math.cos(t), math.sin(t)
                x = wHalf * spow(c, 2.0 / e)
                z = zc + zh * spow(s, 2.0 / e)
                k = max(0.0, min(1.0, (z - zBot) / max(1e-6, zTop - zBot)))
                x *= 1.0 - (1.0 - tum) * k      # tumblehome: upar squeezed
                pts.append((x, y, z))
            return pts

        base = 0
        for st in stations:
            for p in ring(st):
                verts.append(p)
            base += MR
        n = len(stations)
        for i in range(n - 1):
            for j in range(MR):
                j2 = (j + 1) % MR
                a = i * MR + j
                b = i * MR + j2
                c2 = (i + 1) * MR + j2
                d = (i + 1) * MR + j
                faces.append((a, b, c2, d))
        # end caps (fan)
        for i, idx in ((0, 0), (n - 1, 1)):
            st = stations[i]
            cy = (st[2] + st[3]) / 2
            ci = len(verts)
            verts.append((0.0, st[0], cy))
            for j in range(MR):
                j2 = (j + 1) % MR
                if idx == 0:
                    faces.append((ci, j, j2))
                else:
                    faces.append((ci, i * MR + j2, i * MR + j))
        me = bpy.data.meshes.new(name)
        me.from_pydata(verts, [], faces)
        me.update()
        o = bpy.data.objects.new(name, me)
        scene.collection.objects.link(o)
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        bpy.ops.object.shade_smooth()
        if subsurf:
            sub = o.modifiers.new("Sub", "SUBSURF")
            sub.levels = subsurf
            sub.render_levels = subsurf
        o.data.materials.append(mat)
        return o

    # ---------------- body stations (arches math-se carved) ----------------
    belt = cl + bodyH
    wheelYs = (P["wheelbase"] / 2, -P["wheelbase"] / 2)
    archR = P["wheelR"] * 1.18
    archCz = P["wheelR"] + 0.02
    body_st = []
    for i in range(NS):
        u = i / (NS - 1)
        y = -L / 2 + u * L
        topZ = belt * curve(u, prof["belt"])
        wHalf = (W / 2) * curve(u, prof["plan"])
        e = prof["round"] + (0.55 if (u < 0.07 or u > 0.93) else 0.0)
        # floor: ends par approach-angle lift
        lift = 0.09 * max(0.0, (abs(u - 0.5) - 0.36) / 0.14) ** 1.4
        botZ = cl + lift
        for wy in wheelYs:                      # wheel arches
            dy = y - wy
            if abs(dy) < archR:
                az = archCz + math.sqrt(archR * archR - dy * dy)
                botZ = max(botZ, min(az, topZ - 0.16))
        # nose/tail pinch
        if u > 0.96:
            wHalf *= 1.0 - (u - 0.96) / 0.04 * 0.55
        if u < 0.04:
            wHalf *= 1.0 - (0.04 - u) / 0.04 * 0.45
        body_st.append((y, wHalf, botZ, topZ, e, prof["tumble"]))
    body = loft("Body", paint, body_st, subsurf=2)

    # ---------------- glass canopy (panorama) ----------------
    cLen = P["cabinLen"]
    cCy = -L * 0.05
    roof_pts = [(0.0, 0.34), (0.18, 0.78), (0.45, 1.0), (0.72, 0.90), (1.0, 0.42)]
    cab_st = []
    NC = 22
    for i in range(NC):
        t = i / (NC - 1)                      # 0=rear, 1=front
        y = cCy - cLen / 2 + t * cLen
        u = (y + L / 2) / L
        beltZ = belt * curve(u, prof["belt"])
        topZ = beltZ - 0.06 + P["cabinH"] * curve(t, roof_pts)
        botZ = beltZ - 0.05
        wHalf = (W / 2) * curve(u, prof["plan"]) * 0.82
        cab_st.append((y, wHalf, botZ, topZ, 2.3, 0.70))
    canopy = loft("Glass", glass, cab_st, subsurf=2)

    paint_parts, trim_parts, glass_parts, lf_parts, lr_parts = [body], [], [canopy], [], []

    # ---------------- detail kit ----------------
    noseY = L / 2 - 0.10
    tailY = -L / 2 + 0.10
    # splitter + diffuser
    trim_parts.append(box(W * 0.86, 0.30, 0.07, (0, L / 2 - 0.12, cl + 0.02), trim, "Splitter"))
    trim_parts.append(box(W * 0.86, 0.26, 0.08, (0, -L / 2 + 0.12, cl + 0.03), trim, "Diffuser"))
    # grille slats
    for gx in (-0.22, -0.11, 0.0, 0.11, 0.22):
        trim_parts.append(box(0.035, 0.05, belt * 0.16,
                              (gx, noseY + 0.02, cl + belt * 0.34), trim, "GrilleSlat"))
    # DRL strips (front) + full-width rear lightbar
    for sx in (-1, 1):
        lf_parts.append(box(0.30, 0.06, 0.045,
                            (sx * W * 0.30, noseY - 0.02, cl + belt * 0.60), lightF, "LightF"))
    lr_parts.append(box(W * 0.66, 0.05, 0.06,
                        (0, tailY + 0.01, cl + belt * 0.62), lightR, "LightRear"))
    # door seams + handles + skirts
    seamX = W / 2 - 0.012
    for sx in (-1, 1):
        for dy in (cCy - 0.25, cCy + 0.42):
            trim_parts.append(box(0.012, 0.012, P["cabinH"] * 0.9,
                                  (sx * seamX, dy, cl + belt * 0.55), trim, "Seam"))
        trim_parts.append(box(0.05, 0.16, 0.025,
                              (sx * (W / 2 - 0.03), cCy + 0.08, cl + belt * 0.72), trim, "Handle"))
        trim_parts.append(box(0.04, L * 0.55, 0.05,
                              (sx * (W / 2 - 0.04), 0, cl + 0.035), trim, "Skirt"))
        # mirrors (stalk + cap)
        trim_parts.append(box(0.10, 0.03, 0.025,
                              (sx * (W / 2 + 0.03), L * 0.16, cl + belt * 0.88), trim, "MirStalk"))
        trim_parts.append(box(0.09, 0.06, 0.07,
                              (sx * (W / 2 + 0.09), L * 0.16, cl + belt * 0.90), paint, "Mirror"))
        # exhausts
        ex = bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.045, depth=0.14,
                                                 location=(sx * W * 0.30, -L / 2 + 0.04, cl + 0.06))
        exo = bpy.context.active_object
        exo.rotation_euler[0] = math.pi / 2
        exo.data.materials.append(trim)
        trim_parts.append(exo)
    # window trim line (canopy base)
    for sx in (-1, 1):
        trim_parts.append(box(0.02, cLen * 0.88, 0.02,
                              (sx * (W / 2 * 0.78), cCy, cl + belt - 0.02), trim, "WinTrim"))
    # spoiler / lightbar / rails
    if P.get("spoiler"):
        trim_parts.append(box(W * 0.70, 0.22, 0.04,
                              (0, -L * 0.42, cl + belt + P["cabinH"] * 0.55), trim, "SpoilerWing"))
        for sx in (-1, 1):
            trim_parts.append(box(0.04, 0.13, 0.14,
                                  (sx * W * 0.26, -L * 0.42, cl + belt + P["cabinH"] * 0.42), trim, "SpoilerStand"))
    if P.get("lightbar"):
        bar_z = cl + belt + P["cabinH"] + 0.035
        lf_parts.append(box(W * 0.28, 0.15, 0.08,
                            (0, -L * 0.02, bar_z), mk_light("BarBlue", (0.05, 0.15, 1.0, 1.0), 6.0), "BarBlue"))
        lf_parts.append(box(W * 0.28, 0.15, 0.08,
                            (0, -L * 0.02 + 0.17, bar_z), mk_light("BarRed", (1.0, 0.05, 0.05, 1.0), 6.0), "BarRed"))
        trim_parts.append(box(W * 0.32, 0.40, 0.03,
                              (0, -L * 0.02 + 0.08, bar_z - 0.05), trim, "BarBase"))
    if P.get("rails"):
        for sx in (-1, 1):
            trim_parts.append(box(0.05, cLen * 0.5, 0.05,
                                  (sx * W * 0.24, cCy, cl + belt + P["cabinH"] + 0.02), trim, "Rail"))

    # ---------------- wheels v2 (vertex color, spin contract) ----------------
    wheel_mat = bpy.data.materials.new("Wheel")
    wheel_mat.use_nodes = True
    wb = wheel_mat.node_tree.nodes["Principled BSDF"]
    set_input(wb, ["Roughness"], 0.85)
    nvc = None
    try:
        nvc = wheel_mat.node_tree.nodes.new("ShaderNodeColorAttribute")
        if "Attribute" in nvc.inputs:
            nvc.inputs["Attribute"].default_value = "Col"
        else:
            nvc.attribute_name = "Col"
    except RuntimeError:
        nvc = wheel_mat.node_tree.nodes.new("ShaderNodeVertexColor")
        nvc.layer_name = "Col"
    wheel_mat.node_tree.links.new(nvc.outputs["Color"], wb.inputs["Base Color"])

    def col_geo(mesh, rgb255):
        n = len(mesh.vertices)
        arr = np.zeros((n, 4), dtype=np.float32)
        arr[:, 0] = rgb255[0] / 255.0
        arr[:, 1] = rgb255[1] / 255.0
        arr[:, 2] = rgb255[2] / 255.0
        arr[:, 3] = 1.0
        ca = mesh.attributes.new("Col", 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', arr.ravel())
        return mesh

    def wheel_at(name, x, y):
        parts = []
        wr = P["wheelR"]
        # tire
        bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=wr, depth=0.27, location=(0, 0, 0))
        o = bpy.context.active_object
        o.rotation_euler[1] = math.pi / 2
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        col_geo(o.data, (14, 14, 15))
        parts.append(o)
        # rim ring + hub
        for verts, r, d, colr in ((20, wr * 0.60, 0.29, (168, 176, 190)),
                                  (12, wr * 0.13, 0.30, (205, 210, 220)),
                                  (20, wr * 0.44, 0.03, (120, 125, 130))):   # brake disc
            bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=(0, 0, 0))
            o = bpy.context.active_object
            o.rotation_euler[1] = math.pi / 2
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            col_geo(o.data, colr)
            parts.append(o)
        # 5 spokes
        for k in range(5):
            ang = 2 * math.pi * k / 5
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, math.sin(ang) * wr * 0.32,
                                                                math.cos(ang) * wr * 0.32))
            o = bpy.context.active_object
            o.scale = (0.05, 0.07, wr * 0.30)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            o.rotation_euler[0] = ang
            col_geo(o.data, (185, 192, 205))
            parts.append(o)
        bpy.ops.object.select_all(action="DESELECT")
        for o in parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        w = bpy.context.active_object
        w.name = name
        w.location = (x, y, P["wheelR"])
        w.data.materials.append(wheel_mat)
        return w

    wheels = []
    for name, sx, sy in (("WheelFL", -1, 1), ("WheelFR", 1, 1),
                         ("WheelRL", -1, -1), ("WheelRR", 1, -1)):
        wheels.append(wheel_at(name, sx * (W / 2 - 0.10), sy * P["wheelbase"] / 2))

    # ---------------- merge per-material ----------------
    def merge_join(parts, name):
        if not parts:
            return None
        bpy.ops.object.select_all(action="DESELECT")
        for p in parts:
            p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        if len(parts) > 1:
            bpy.ops.object.join()
        o = bpy.context.active_object
        o.name = name
        return o

    body_m = merge_join(paint_parts, "Body")
    glass_m = merge_join(glass_parts, "Glass")
    trim_m = merge_join(trim_parts, "Trim")
    lf_m = merge_join(lf_parts, "LightFront")
    lr_m = merge_join(lr_parts, "LightRear")

    others = [o for o in (glass_m, trim_m, lf_m, lr_m) if o]
    globals().update(BODY=body_m, PAINT=paint, LIGHTF=lightF, LIGHTR=lightR,
                     WHEELS=wheels, OTHERS=others, GLASS_M=glass)
    tris = sum(len(p.vertices) - 2 for o in [body_m] + wheels + others for p in o.data.polygons)
    return f"LOFTED verts={len(body_m.data.vertices)} wheels={len(wheels)} tris~{tris}"


# ---------------------------------------------------------------- 2. high-poly
# ---------------------------------------------------------------- 2. VERTEX AO
# BAKE-FREE: Cycles headless bake silently BLACK textures de raha tha (normal/AO/
# rough sab 0,0,0 — GLB mein embedded, cars kaali dikhti thi!). Ab: paint color
# direct material mein + AO vertex-colors se (geometry-driven, deterministic).
@step("vertex_ao")
def vertex_ao():
    import random
    rng = random.Random(47)
    body = globals()["BODY"]
    L, W, cl = P["L"], P["W"], P["clearance"]
    wheelR = P["wheelR"]
    archR = wheelR * 1.18
    archCz = P["wheelbase"] / 2.0
    wheelY = cl + wheelR
    mesh = body.data
    n = len(mesh.vertices)
    col = mesh.attributes.new("ao", "BYTE_COLOR", "POINT")
    zs = [v.co.z for v in mesh.vertices]
    zmin, zmax = min(zs), max(zs)
    for i, v in enumerate(mesh.vertices):
        # 1) vertical gradient — neeche darker (underbody shadow)
        t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
        g = 0.62 + 0.38 * (t ** 0.8)
        # 2) wheel-arch proximity — arch ke aas-pass dusky
        for cz in (-archCz, archCz):
            r = math.hypot(v.co.y - cz, v.co.z - wheelY)
            if r < archR * 1.3 and abs(v.co.x) > W * 0.18:
                g *= 0.55 + 0.45 * min(1.0, r / (archR * 1.3))
        # 3) nose/tail pinch thode darker (panel-gap feel)
        pn = abs(v.co.y) / (L / 2)
        g *= 1.0 - 0.10 * (pn ** 6)
        # 4) micro paint mottling
        g *= 0.97 + 0.06 * rng.random()
        g = max(0.35, min(1.0, g))
        col.data[i].color = (g, g, g, 1.0)
    # glass canopy: halka top-light gradient (GLASS_M material hota hai —
    # MESH by-name dhoondo)
    gm = next((o for o in bpy.data.objects if o.name == "Glass" and o.type == "MESH"), None)
    if gm:
        gcol = gm.data.attributes.new("ao", "BYTE_COLOR", "POINT")
        for i, v in enumerate(gm.data.vertices):
            t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
            g = 0.80 + 0.20 * t
            gcol.data[i].color = (g, g, g, 1.0)
    return f"verts={n} (bake-free, paint=material+vertexAO)"

@step("night_render", required=False)
def render_preview():
    scene = bpy.context.scene
    lightF, lightR = globals()["LIGHTF"], globals()["LIGHTR"]
    helpers = []
    L, W = P["L"], P["W"]

    bpy.ops.mesh.primitive_plane_add(size=26, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("Asphalt")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.035, 0.035, 0.04, 1.0))
    set_input(gb, ["Roughness"], 0.85)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (4.6, L * 0.85, 1.5)
    cam_data.lens = 34
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.6
    tgt = bpy.data.objects.new("Tgt", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, L * 0.1, P["clearance"] + (P["H"] - P["cabinH"]) * 0.5)
    cam_data.dof.focus_object = tgt
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    moon_data = bpy.data.lights.new("Moon", "SUN")
    moon = bpy.data.objects.new("Moon", moon_data)
    scene.collection.objects.link(moon)
    moon_data.energy = 0.5
    moon_data.color = (0.7, 0.8, 1.0)
    moon.rotation_euler = (1.1, 0.2, 0.6)
    helpers.append(moon)

    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    wout = next(n for n in world.node_tree.nodes if n.type == "OUTPUT_WORLD")
    wbg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    set_input(wbg, ["Color"], (0.004, 0.005, 0.009, 1.0))
    vol = world.node_tree.nodes.new("ShaderNodeVolumePrincipled")
    set_input(vol, ["Density"], 0.008)
    world.node_tree.links.new(vol.outputs["Volume"], wout.inputs["Volume"])
    scene.world = world

    dev = setup_cycles(samples=A["samples"])
    R["device"] = dev
    try:
        scene.cycles.use_denoising = True
    except AttributeError:
        try:
            bpy.context.view_layer.cycles.use_denoising = True
        except Exception:
            pass
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.filepath = PNG
    scene.render.image_settings.file_format = "PNG"

    set_input(lightF.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_F[2])
    set_input(lightR.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_R[2])
    bpy.ops.render.render(write_still=True)
    set_input(lightF.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_F[1])
    set_input(lightR.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_R[1])

    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return f"{PNG} ({dev})"



# ---------------------------------------------------------------- 3b. STUDIO render
# (user feedback: night previews andhere mein the — ab bright 3-light studio bhi)
@step("studio_render", required=False)
def render_studio():
    scene = bpy.context.scene
    lightF, lightR = globals()["LIGHTF"], globals()["LIGHTR"]
    helpers = []
    L = P["L"]

    bpy.ops.mesh.primitive_plane_add(size=18, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("ShowroomFloor")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.03, 0.03, 0.045, 1.0))
    set_input(gb, ["Roughness"], 0.12)      # glossy — neon reflections
    set_input(gb, ["Metallic"], 0.6)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("CamS")
    cam = bpy.data.objects.new("CamS", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (2.9, L * 0.9, 1.3)
    cam_data.lens = 38
    tgt = bpy.data.objects.new("TgtS", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, 0, 0.6)
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    # NEON SHOWROOM (concept-image mood): cyan + magenta rim, white key
    for nm, col, en, rot in (("Key", (1.0, 0.97, 0.92), 2.6, (0.9, 0.4, 0.8)),
                             ("RimCyan", (0.15, 0.85, 1.0), 4.5, (1.25, 2.4, 0.9)),
                             ("RimMag", (1.0, 0.15, 0.65), 4.0, (1.25, 2.4, -0.9)),
                             ("Fill", (0.6, 0.7, 0.9), 0.8, (0.9, -0.7, 0.5))):
        ld = bpy.data.lights.new(nm, "SUN")
        lo = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo)
        ld.energy = en
        ld.color = col
        lo.rotation_euler = rot   # OBJECT ghumao, light-data nahi!
        helpers.append(lo)

    world = bpy.data.worlds.new("ShowroomW")
    world.use_nodes = True
    wbg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    set_input(wbg, ["Color"], (0.015, 0.018, 0.03, 1.0))
    scene.world = world   # NO volume — sun + world-volume = black render bug!

    dev = setup_cycles(samples=max(48, A["samples"] // 2))
    try:
        scene.view_settings.exposure = 1.1
    except Exception:
        pass
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.filepath = STUDIO_PNG
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return STUDIO_PNG


# ---------------------------------------------------------------- 4. export
def do_export():
    body = globals()["BODY"]
    wheels = globals()["WHEELS"]
    high = globals().get("HIGH")
    if high:
        bpy.ops.object.select_all(action="DESELECT")
        high.select_set(True)
        bpy.ops.object.delete()
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    for o in wheels + globals().get("OTHERS", []):   # Glass/Trim/Lights bhi!
        o.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format="AUTO",
    )
    return os.path.getsize(GLB)


@step("glb_export")
def export_glb():
    size = do_export()
    return f"{size} bytes (bake-free)"


# ---------------------------------------------------------------- main
# NOTE: blender --python exception par bhi exit-0 de sakta hai — workflow
# galat "done" mark kar deta tha. Isliye: try/except + failure par sys.exit(1).
try:
    build()
    vertex_ao()
    render_preview()
    render_studio()
    export_glb()
except Exception:
    traceback.print_exc()

body = globals().get("BODY")
if body:
    R["verts"] = len(body.data.vertices)
    R["tris"] = sum(len(p.vertices) - 2 for p in body.data.polygons)
if os.path.exists(GLB):
    R["glb_bytes"] = os.path.getsize(GLB)
    R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)
if any(not s["ok"] for s in R["steps"]):
    print("JOB_FAILED — nonzero exit", flush=True)
    sys.exit(1)

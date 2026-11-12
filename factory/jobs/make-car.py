"""
VELARA Design Team — Job: "make-car" (parametric vehicle designer)
===================================================================
Ek script, char presets — dabbe khatam, real car shapes:

    blender --background --python factory/jobs/make-car.py -- velara-gt
    blender --background --python factory/jobs/make-car.py -- pico-s bake 2048 samples 256   (GPU)

Presets: velara-gt (sports), titan-rs (muscle sedan), pico-s (hatchback),
         colossus-v (SUV)
Pipeline: parametric body (tapered cabin + bevels) -> wheel w/ rims ->
          HIGH->LOW normal bake + tinted AO + roughness wear ->
          night preview render (headlight glow) -> Draco GLB.

Orientation: front = Blender +Y (glTF/three.js -Z front), up = +Z,
             origin ground-center, meters. Wheels named WheelFL/FR/RL/RR
             (in-game spin ke liye alag nodes).
Output: factory/out/<preset>.glb (+ _preview.png)   Licence: CC0 (self-made)
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
    "city-bus":    dict(L=10.2, W=2.50, H=3.00, wheelR=0.52, wheelbase=5.6,
                        cabinH=1.05, cabinLen=7.2, clearance=0.28,
                        paint=(0.16, 0.34, 0.55), spoiler=False, style="bus",
                        bus=True),
}

# CLI: preset + overrides (bake/ao/rough/samples/rx/ry)
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

GLOW_F = ((0.95, 0.97, 1.0, 1.0), 6.0, 40.0)   # color, export strength, render boost
GLOW_R = ((1.0, 0.05, 0.08, 1.0), 4.0, 26.0)

R = {"job": f"car-{PRESET}", "steps": [], "cfg": {**A, "preset": PRESET}}


def step(name, required=True):
    def wrap(fn):
        def run():
            try:
                detail = fn() or ""
                R["steps"].append({"step": name, "ok": True, "detail": str(detail)})
                print(f"[OK] {name} {detail}", flush=True)
                return True
            except Exception as e:
                R["steps"].append({"step": name, "ok": False, "error": str(e)})
                print(f"[FAIL] {name} — {e}", flush=True)
                traceback.print_exc()
                if required:
                    raise
                return False
        return run
    return wrap


def set_input(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return
    raise KeyError(f"no input among {names}")


def setup_cycles(samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    dev = "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for ctype in ("OPTIX", "CUDA", "HIP"):
            try:
                prefs.compute_device_type = ctype
                prefs.get_devices()
                n = sum(1 for d in prefs.devices if d.type == ctype)
                if n:
                    for d in prefs.devices:
                        if d.type == ctype:
                            d.use = True
                    dev = f"GPU({ctype}x{n})"
                    break
            except Exception:
                continue
    except Exception:
        pass
    scene.cycles.device = "GPU" if dev.startswith("GPU") else "CPU"
    scene.cycles.samples = samples
    return dev


def taper_top(obj, sx=0.72, sy=0.86, shift_y=0.0):
    """Cabin ko dabbe se car-banata hai: upar ke vertices andar + peeche."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x *= sx
            v.co.y = v.co.y * sy + shift_y
    bm.to_mesh(obj.data)
    bm.free()


# ---------------------------------------------------------------- 1. model
@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    L, W, H = P["L"], P["W"], P["H"]
    cl = P["clearance"]

    paint = bpy.data.materials.new("Paint")
    paint.use_nodes = True
    pb = paint.node_tree.nodes["Principled BSDF"]
    set_input(pb, ["Base Color"], (*P["paint"], 1.0))
    set_input(pb, ["Metallic"], 0.72)
    set_input(pb, ["Roughness"], 0.32)
    try:
        set_input(pb, ["Clearcoat"], 0.7)      # MeshPhysical jaisa feel
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

    def box(sx, sy, sz, loc, mat, name, taper=None):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if taper:
            taper_top(o, *taper)
        o.data.materials.append(mat)
        return o

    paint_parts, trim_parts, glass_parts, lf_parts, lr_parts = [], [], [], [], []

    # ---- lower body (bevel = soft car curves, dabba nahi) ----
    bodyH = H - P["cabinH"] - cl
    body = box(W, L * 0.985, bodyH, (0, 0, cl + bodyH / 2), paint, "Body")
    bv = body.modifiers.new("BevelBody", "BEVEL")
    bv.segments = 3
    bv.width = 0.075
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(55)
    bpy.ops.object.modifier_apply(modifier="BevelBody")
    paint_parts.append(body)

    # ---- cabin (tapered = windshield rake + curve) + roof cap ----
    cabZ = cl + bodyH
    cabin = box(W * 0.86, P["cabinLen"], P["cabinH"],
                (0, -L * 0.06, cabZ + P["cabinH"] / 2), glass, "Glass",
                taper=(0.68, 0.80, -0.16))
    glass_parts.append(cabin)
    roof = box(W * 0.60, P["cabinLen"] * 0.52, 0.035,
               (0, -L * 0.06 - 0.05, cabZ + P["cabinH"] - 0.005), paint, "Roof")
    paint_parts.append(roof)

    # ---- bumpers / grille / skirts (trim) ----
    for y, ln in ((L * 0.5 - 0.09, 0.22), (-L * 0.5 + 0.09, 0.22)):
        trim_parts.append(box(W * 0.99, ln, bodyH * 0.42,
                              (0, y, cl + bodyH * 0.22), trim, "Bumper"))
    trim_parts.append(box(W * 0.42, 0.06, bodyH * 0.26,
                          (0, L * 0.5 - 0.02, cl + bodyH * 0.52), trim, "Grille"))
    for sx in (-1, 1):
        trim_parts.append(box(0.045, L * 0.62, 0.06,
                              (sx * (W / 2 - 0.02), 0, cl + bodyH * 0.18), trim, "Skirt"))
        # side mirrors
        trim_parts.append(box(0.16, 0.07, 0.09,
                              (sx * (W / 2 + 0.06), L * 0.13, cl + bodyH * 0.86), trim, "Mirror"))
        # exhausts
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.045, depth=0.12,
                                            location=(sx * W * 0.30, -L / 2 + 0.03, cl + 0.05))
        ex = bpy.context.active_object
        ex.rotation_euler[0] = math.pi / 2
        ex.data.materials.append(trim)
        trim_parts.append(ex)

    # ---- lights ----
    for sx in (-1, 1):
        lf_parts.append(box(0.34, 0.07, 0.10,
                            (sx * W * 0.30, L * 0.5 - 0.015, cl + bodyH * 0.62), lightF, "LightF"))
        lr_parts.append(box(0.30, 0.06, 0.09,
                            (sx * W * 0.30, -L * 0.5 + 0.015, cl + bodyH * 0.66), lightR, "LightR"))

    # ---- spoiler (sports) / roof rails (suv) ----
    if P.get("spoiler"):
        trim_parts.append(box(W * 0.72, 0.24, 0.045,
                              (0, -L * 0.44, cl + bodyH + 0.16), trim, "SpoilerWing"))
        for sx in (-1, 1):
            trim_parts.append(box(0.045, 0.14, 0.15,
                                  (sx * W * 0.26, -L * 0.44, cl + bodyH + 0.07), trim, "SpoilerStand"))
    if P.get("lightbar"):
        bar_y = -L * 0.02
        bar_z = cl + bodyH + P["cabinH"] + 0.035
        lf_parts.append(box(W * 0.30, 0.16, 0.09,
                            (0, bar_y, bar_z), mk_light("BarBlue", (0.05, 0.15, 1.0, 1.0), 6.0), "BarBlue"))
        lf_parts.append(box(W * 0.30, 0.16, 0.09,
                            (0, bar_y + 0.18, bar_z), mk_light("BarRed", (1.0, 0.05, 0.05, 1.0), 6.0), "BarRed"))
        trim_parts.append(box(W * 0.34, 0.42, 0.03,
                              (0, bar_y + 0.09, bar_z - 0.05), trim, "BarBase"))
    if P.get("rails"):
        for sx in (-1, 1):
            trim_parts.append(box(0.05, P["cabinLen"] * 0.5, 0.05,
                                  (sx * W * 0.24, -L * 0.06, cl + bodyH + P["cabinH"] + 0.02), trim, "Rail"))

    # ---- wheels: tire + rim vertex-color merge, spin nodes ----
    wheel_mat = bpy.data.materials.new("Wheel")
    wheel_mat.use_nodes = True
    wb = wheel_mat.node_tree.nodes["Principled BSDF"]
    set_input(wb, ["Base Color"], (1, 1, 1, 1))
    set_input(wb, ["Roughness"], 0.85)
    try:
        wheel_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"]  # noqa
    except Exception:
        pass
    # vertex colors: tire=dark, rim=silver, hub=bright
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
    except RuntimeError:   # 4.5: purana naam
        nvc = wheel_mat.node_tree.nodes.new("ShaderNodeVertexColor")
        nvc.layer_name = "Col"
    wheel_mat.node_tree.links.new(nvc.outputs["Color"], wb.inputs["Base Color"])

    def col_geo(mesh, rgb255):
        """Mesh par 'Col' float-color attribute (RGBA) — tire/rim ke liye."""
        n = len(mesh.vertices)
        arr = np.zeros((n, 4), dtype=np.float32)
        arr[:, 0] = rgb255[0] / 255.0
        arr[:, 1] = rgb255[1] / 255.0
        arr[:, 2] = rgb255[2] / 255.0
        arr[:, 3] = 1.0
        ca = mesh.attributes.new("Col", 'FLOAT_COLOR', 'POINT')
        ca.data.foreach_set('color', arr.ravel())   # color-attrs: 'color', 'value' nahi
        return mesh

    def wheel_at(name, x, y):
        """tire + rim + hub -> ek vertex-color mesh (axle X, spin node)."""
        parts = []
        for verts, r, d, colr in ((24, P["wheelR"], 0.26, (14, 14, 15)),
                                  (18, P["wheelR"] * 0.60, 0.27, (168, 176, 190)),
                                  (10, P["wheelR"] * 0.18, 0.29, (205, 210, 220))):
            bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d,
                                                location=(0, 0, 0))
            o = bpy.context.active_object
            o.rotation_euler[1] = math.pi / 2          # cylinder axis Z -> X (axle)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            col_geo(o.data, colr)
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

    # merge per-material parts (DESELECT pehle — warna join wheels ko nigal jaata hai!)
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

    body_m = merge_join(paint_parts, "Body")          # paint (bake target)
    glass_m = merge_join(glass_parts, "Glass")
    trim_m = merge_join(trim_parts, "Trim")
    lf_m = merge_join(lf_parts, "LightFront")
    lr_m = merge_join(lr_parts, "LightRear")

    others = [o for o in (glass_m, trim_m, lf_m, lr_m) if o]
    globals().update(BODY=body_m, PAINT=paint, LIGHTF=lightF, LIGHTR=lightR,
                     WHEELS=wheels, OTHERS=others, GLASS_M=glass)
    tris = sum(len(p.vertices) - 2 for o in [body_m] + wheels + others for p in o.data.polygons)
    return f"verts={len(body_m.data.vertices)} wheels={len(wheels)} tris~{tris}"


# ---------------------------------------------------------------- 2. UV + bake
@step("uv")
def uv_unwrap():
    body = globals()["BODY"]
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return "smart-project"


@step("high_poly")
def make_high():
    body = globals()["BODY"]
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.duplicate()
    high = bpy.context.active_object
    high.name = "Body_HIGH"
    sub = high.modifiers.new("S", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    bpy.ops.object.modifier_apply(modifier="S")
    bv = high.modifiers.new("B", "BEVEL")
    bv.width = 0.012
    bv.segments = 3
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="B")
    globals()["HIGH"] = high
    return f"verts={len(high.data.vertices)}"


@step("normal_bake")
def bake_normal():
    body, high, paint = globals()["BODY"], globals()["HIGH"], globals()["PAINT"]
    setup_cycles(samples=16)
    img = bpy.data.images.new("N_bake", A["bake"], A["bake"], alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    nt = paint.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.bake(type="NORMAL", use_selected_to_active=True,
                        max_ray_distance=0.08, margin=8, use_clear=True)
    img.filepath = N_PNG
    img.save()
    globals()["IMG_N"] = img
    return f"{A['bake']}px tangent normal (HIGH->LOW)"


@step("ao_bake", required=False)
def bake_ao():
    body, high, paint = globals()["BODY"], globals()["HIGH"], globals()["PAINT"]
    img = bpy.data.images.new("AO_bake", A["ao"], A["ao"], alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    nt = paint.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.bake(type="AO", use_selected_to_active=True,
                        max_ray_distance=1.2, margin=8, use_clear=True)
    arr = np.asarray(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    arr[:, 0] *= 0.9
    arr[:, 1] *= 0.9
    arr[:, 2] *= 0.92
    img.pixels = arr.ravel().tolist()
    img.filepath = AO_PNG
    img.save()
    globals()["IMG_AO"] = img
    return f"{A['ao']}px AO (tinted)"


@step("roughness_noise", required=False)
def make_roughness():
    size = A["rough"]
    rng = np.random.default_rng(23)
    layers = []
    for cell, w in ((64, 0.5), (16, 0.3), (4, 0.2)):
        g = rng.random((cell, cell)).astype(np.float32)
        rep = max(1, size // cell)
        layers.append(w * np.repeat(np.repeat(g, rep, axis=0), rep, axis=1))
    arr = np.clip(sum(layers) / 1.0, 0, 1)
    arr = 0.18 + 0.22 * (arr - arr.min()) / (np.ptp(arr) + 1e-6)   # 0.18..0.40 glossy paint
    img = bpy.data.images.new("R_bake", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    px = np.dstack([arr, arr, arr, np.ones_like(arr)]).ravel()
    img.pixels = px.tolist()
    img.filepath = R_PNG
    img.save()
    globals()["IMG_R"] = img
    return f"{size}px paint roughness wear"


@step("wire_material")
def wire():
    paint = globals()["PAINT"]
    nt = paint.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    ao_node = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image
                   and n.image.name == "AO_bake")
    nt.links.new(ao_node.outputs["Color"], bsdf.inputs["Base Color"])
    rn = nt.nodes.new("ShaderNodeTexImage")
    rn.image = globals()["IMG_R"]
    nt.links.new(rn.outputs["Color"], bsdf.inputs["Roughness"])
    nn = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image
              and n.image.name == "N_bake")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    set_input(nm, ["Strength"], 1.0)
    nt.links.new(nn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return "AO->base, wear->rough, normal->bump"


# ---------------------------------------------------------------- 3. night render
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
    gm = bpy.data.materials.new("StudioFloor")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.55, 0.57, 0.60, 1.0))
    set_input(gb, ["Roughness"], 0.45)
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

    # 3-point studio: key (warm) + fill (cool) + rim
    for nm, col, en, rot in (("Key", (1.0, 0.96, 0.9), 3.2, (0.9, 0.4, 0.8)),
                             ("Fill", (0.85, 0.92, 1.0), 1.3, (0.9, -0.7, 0.5)),
                             ("Rim", (1.0, 1.0, 1.0), 2.6, (1.3, 2.6, -0.4))):
        ld = bpy.data.lights.new(nm, "SUN")
        lo = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo)
        ld.energy = en
        ld.color = col
        lo.rotation_euler = rot   # OBJECT ghumao, light-data nahi!
        helpers.append(lo)

    world = bpy.data.worlds.new("StudioW")
    world.use_nodes = True
    wbg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    set_input(wbg, ["Color"], (0.38, 0.40, 0.44, 1.0))
    scene.world = world

    dev = setup_cycles(samples=max(48, A["samples"] // 2))
    try:
        scene.view_settings.exposure = 1.25
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
    if size > 1_500_000:   # budget guard: textures 25% chhote
        for img in (globals().get("IMG_N"), globals().get("IMG_AO"), globals().get("IMG_R")):
            if img:
                img.scale(max(384, img.size[0] * 3 // 4), max(384, img.size[1] * 3 // 4))
        size = do_export()
        R["texture_downscaled"] = True
    return f"{size} bytes"


# ---------------------------------------------------------------- main
build()
uv_unwrap()
make_high()
bake_normal()
bake_ao()
make_roughness()
wire()
render_preview()
render_studio()
export_glb()

body = globals()["BODY"]
R["verts"] = len(body.data.vertices)
R["tris"] = sum(len(p.vertices) - 2 for p in body.data.polygons)
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

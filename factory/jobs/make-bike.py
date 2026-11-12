"""
VELARA Design Team — Job: bikes (parametric motorcycle designer)
===============================================================
User-chosen concepts (gallery): #1 sports bike (red-black) + #6 cafe-racer (black-gold).
Front=+Y, up=+Z, origin ground-center, meters. Wheels = named spin nodes
(WheelF/WheelR) vertex-color, tank+fairing HIGH->LOW bake (normal+AO+rough).
    blender --background --python factory/jobs/make-bike.py -- <preset> [bake N] [ao N] [rough N] [samples N] [rx N] [ry N]
Output: factory/out/<preset>.glb (+ _preview.png)   Licence: CC0 (self-made)
"""
import json
import math
import os
import sys
import traceback

import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)

PRESETS = {
    "velara-bike": dict(L=2.05, W=0.72, H=1.10, wheelR=0.31, wheelbase=1.42,
                        paint=(0.72, 0.05, 0.05), style="sports",
                        fairing=True, belly=True, clipon=True),
    "cafe-racer":  dict(L=1.95, W=0.70, H=1.02, wheelR=0.32, wheelbase=1.35,
                        paint=(0.05, 0.045, 0.04), style="cafe",
                        fairing=False, belly=False, clipon=False, gold=True),
}

A = {"bake": 1024, "ao": 512, "rough": 512, "samples": 72, "rx": 896, "ry": 608}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PRESET = argv[0] if argv else "velara-bike"
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

R = {"job": f"bike-{PRESET}", "steps": [], "cfg": {**A, "preset": PRESET}}


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
    wb, wr = P["wheelbase"], P["wheelR"]

    paint = bpy.data.materials.new("Paint")
    paint.use_nodes = True
    pb = paint.node_tree.nodes["Principled BSDF"]
    set_input(pb, ["Base Color"], (*P["paint"], 1.0))
    set_input(pb, ["Metallic"], 0.75)
    set_input(pb, ["Roughness"], 0.28)
    try:
        set_input(pb, ["Clearcoat"], 0.8)
    except KeyError:
        pass

    trim = bpy.data.materials.new("Trim")
    trim.use_nodes = True
    tb = trim.node_tree.nodes["Principled BSDF"]
    set_input(tb, ["Base Color"], (0.04, 0.04, 0.05, 1.0))
    set_input(tb, ["Metallic"], 0.85)
    set_input(tb, ["Roughness"], 0.35)

    if P.get("gold"):   # cafe-racer: gold accents
        set_input(tb, ["Base Color"], (0.55, 0.42, 0.18, 1.0))
        set_input(tb, ["Metallic"], 1.0)
        set_input(tb, ["Roughness"], 0.25)

    seatm = bpy.data.materials.new("Seat")
    seatm.use_nodes = True
    sb = seatm.node_tree.nodes["Principled BSDF"]
    set_input(sb, ["Base Color"], (0.03, 0.03, 0.035, 1.0))
    set_input(sb, ["Roughness"], 0.9)

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

    def rod(radius, length, loc, rot_x, rot_y, mat, name):
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=radius, depth=length,
                                            location=loc)
        o = bpy.context.active_object
        o.name = name
        o.rotation_euler = (rot_x, rot_y, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        o.data.materials.append(mat)
        return o

    paint_parts, trim_parts, lf_parts, lr_parts, seat_parts = [], [], [], [], []

    # ---- geometry ke reference points ----
    head_z = wr + 0.62            # steering head height
    head_y = wb / 2 - 0.32
    pivot_y, pivot_z = -wb / 2 + 0.16, wr + 0.24
    tank_z = wr + 0.52
    seat_z = wr + 0.50

    # ---- frame: spine + swingarm (trim) ----
    trim_parts.append(rod(0.035, math.hypot(head_y - pivot_y, head_z - pivot_z) * 1.02,
                          ((head_y + pivot_y) / 2, 0, (head_z + pivot_z) / 2),
                          math.atan2(head_y - pivot_y, head_z - pivot_z) * -1, 0,
                          trim, "Spine"))
    trim_parts.append(box(0.05, wb / 2 + 0.02, 0.045,
                          (0.0, (pivot_y - wb / 2) / 2, pivot_z), trim, "Swingarm"))
    # engine block
    trim_parts.append(box(0.30, 0.42, 0.30, (0, 0.05, wr + 0.16), trim, "Engine"))

    # ---- forks (do, angled) + handlebar ----
    fork_len = math.hypot(0.30, 0.62) * 1.05
    for sx in (-1, 1):
        trim_parts.append(rod(0.022, fork_len,
                              (sx * 0.09, wb / 2 - 0.20, wr + 0.36),
                              math.radians(27), 0, trim, f"Fork{sx}"))
    if P.get("clipon"):   # sports: low clip-ons
        trim_parts.append(rod(0.016, W * 0.94, (0, wb / 2 - 0.30, head_z - 0.06),
                              0, math.radians(90), trim, "Clipon"))
    else:                 # cafe: upright bar
        trim_parts.append(rod(0.016, W * 0.96, (0, wb / 2 - 0.26, head_z + 0.06),
                              0, math.radians(90), trim, "Handlebar"))
        for sx in (-1, 1):
            trim_parts.append(rod(0.014, 0.10, (sx * W * 0.42, wb / 2 - 0.26, head_z + 0.03),
                                  0, math.radians(90), trim, f"Grip{sx}"))
    # mirrors (sports)
    if P.get("fairing"):
        for sx in (-1, 1):
            trim_parts.append(rod(0.008, 0.12, (sx * 0.16, wb / 2 - 0.34, head_z + 0.08),
                                  0, 0, trim, f"MirrorStalk{sx}"))
            trim_parts.append(box(0.09, 0.03, 0.06,
                                  (sx * 0.22, wb / 2 - 0.34, head_z + 0.14), trim, f"Mirror{sx}"))

    # ---- tank (paint, bake target) ----
    tank = box(W * 0.62, 0.46, 0.24, (0, 0.10, tank_z), paint, "Tank",
               taper=(0.68, 0.80, -0.02))
    paint_parts.append(tank)

    # ---- seat (+ cowl sports / flat cafe) ----
    if P.get("fairing"):   # sports: seat + rear cowl (paint)
        seat_parts.append(box(W * 0.40, 0.34, 0.07, (0, -0.32, seat_z), seatm, "Seat"))
        paint_parts.append(box(W * 0.44, 0.42, 0.16, (0, -0.62, seat_z + 0.03),
                               paint, "Cowl", taper=(0.55, 0.62, 0.10)))
    else:                  # cafe: lamba flat seat
        seat_parts.append(box(W * 0.42, 0.62, 0.07, (0, -0.42, seat_z), seatm, "Seat"))

    # ---- fairing (sports) / headlight (cafe round) ----
    if P.get("fairing"):
        nose = box(W * 0.58, 0.34, 0.30, (0, wb / 2 - 0.18, head_z - 0.10), paint, "Nose",
                   taper=(0.45, 0.55, 0.16))
        paint_parts.append(nose)
        for sx in (-1, 1):
            paint_parts.append(box(0.05, 0.52, 0.26,
                                   (sx * (W * 0.30), wb / 2 - 0.42, head_z - 0.22),
                                   paint, f"SideFair{sx}"))
        lf_parts.append(box(0.24, 0.06, 0.12, (0, wb / 2 - 0.02, head_z - 0.04),
                            lightF, "Headlight"))
    else:
        # round headlight: torus ring (trim) + emissive lens disc
        bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.018,
                                         location=(0, wb / 2 - 0.04, head_z - 0.02))
        ring = bpy.context.active_object
        ring.name = "HLRing"
        ring.rotation_euler[0] = math.radians(90)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        ring.data.materials.append(trim)
        trim_parts.append(ring)
        bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=0.082, depth=0.03,
                                            location=(0, wb / 2 - 0.04, head_z - 0.02))
        lens = bpy.context.active_object
        lens.name = "HLLens"
        lens.rotation_euler[0] = math.radians(90)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        lens.data.materials.append(lightF)
        lf_parts.append(lens)

    # ---- exhaust ----
    if P.get("belly"):    # sports: under-belly angled
        trim_parts.append(rod(0.045, 0.55, (0.10, -0.28, wr + 0.10),
                              math.radians(78), 0, trim, "Exhaust"))
    else:                 # cafe: high right pipe
        trim_parts.append(rod(0.040, 0.80, (0.17, -0.35, seat_z - 0.10),
                              math.radians(94), 0, trim, "Exhaust"))

    # ---- taillight + plate ----
    lr_parts.append(box(0.14, 0.04, 0.07, (0, -L / 2 + 0.03, seat_z - 0.06),
                        lightR, "Taillight"))

    # ---- fenders ----
    trim_parts.append(box(W * 0.30, 0.30, 0.035, (0, wb / 2 - 0.02, wr * 1.72),
                          trim, "FrontFender", taper=(0.6, 0.7, 0.06)))
    trim_parts.append(box(W * 0.34, 0.34, 0.035, (0, -wb / 2 + 0.04, wr * 1.68),
                          trim, "RearFender", taper=(0.65, 0.7, -0.05)))

    # ---- kickstand ----
    trim_parts.append(rod(0.012, 0.26, (0.14, -0.10, wr * 0.55),
                          math.radians(18), 0, trim, "Kickstand"))

    # ---- wheels (2, vertex-color, X axle, spin nodes) ----
    wheel_mat = bpy.data.materials.new("Wheel")
    wheel_mat.use_nodes = True
    wmb = wheel_mat.node_tree.nodes["Principled BSDF"]
    set_input(wmb, ["Roughness"], 0.85)
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
    wheel_mat.node_tree.links.new(nvc.outputs["Color"], wmb.inputs["Base Color"])

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

    def wheel_at(name, y):
        parts = []
        for verts, r, d, colr in ((22, wr, 0.13, (14, 14, 15)),
                                  (16, wr * 0.58, 0.14, (170, 178, 192)),
                                  (10, wr * 0.16, 0.16, (205, 210, 220))):
            bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d,
                                                location=(0, 0, 0))
            o = bpy.context.active_object
            o.rotation_euler[1] = math.pi / 2
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
        w.location = (0, y, wr)
        w.data.materials.append(wheel_mat)
        return w

    wheels = [wheel_at("WheelF", wb / 2), wheel_at("WheelR", -wb / 2)]

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
    trim_m = merge_join(trim_parts, "Trim")
    seat_m = merge_join(seat_parts, "Seat")
    lf_m = merge_join(lf_parts, "LightFront")
    lr_m = merge_join(lr_parts, "LightRear")

    others = [o for o in (trim_m, seat_m, lf_m, lr_m) if o]
    globals().update(BODY=body_m, PAINT=paint, LIGHTF=lightF, LIGHTR=lightR,
                     WHEELS=wheels, OTHERS=others)
    tris = sum(len(p.vertices) - 2 for o in [body_m] + wheels + others for p in o.data.polygons)
    return f"verts={len(body_m.data.vertices)} wheels=2 tris~{tris}"


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
    bv.width = 0.010
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
                        max_ray_distance=0.06, margin=8, use_clear=True)
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
                        max_ray_distance=1.0, margin=8, use_clear=True)
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
    arr = 0.15 + 0.22 * (arr - arr.min()) / (np.ptp(arr) + 1e-6)
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
    L = P["L"]

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.01))
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
    cam.location = (2.8, L * 0.95, 1.1)
    cam_data.lens = 40
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.4
    tgt = bpy.data.objects.new("Tgt", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, 0, 0.55)
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
    vol = world.node_tree.nodes.new("ShaderNodeVolumePrincipled")
    set_input(vol, ["Density"], 0.006)
    wout = next(n for n in world.node_tree.nodes if n.type == "OUTPUT_WORLD")
    world.node_tree.links.new(vol.outputs["Volume"], wout.inputs["Volume"])
    scene.world = world

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
    for o in wheels + globals().get("OTHERS", []):
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
    if size > 1_500_000:
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
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

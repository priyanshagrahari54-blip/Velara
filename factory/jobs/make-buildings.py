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
    W, D, H = 16.0, 16.0, 42.0
    floors = 12
    fh = H / floors
    # main glass volume
    box(parts, M["glass"], W, H, D, 0, 0, 0)
    # floor slabs (protruding trim) + mullions har face par
    for i in range(floors + 1):
        z = -H / 2 + i * fh
        box(parts, M["trim"], W + 0.5, 0.28, D + 0.5, 0, z, 0)
    for x in [-W / 2 + 2, 0, W / 2 - 2]:
        box(parts, M["trim"], 0.16, H, 0.16, x, 0, D / 2 + 0.05)
        box(parts, M["trim"], 0.16, H, 0.16, x, 0, -D / 2 - 0.05)
    for y in [-D / 2 + 2, 0, D / 2 - 2]:
        box(parts, M["trim"], 0.16, H, 0.16, W / 2 + 0.05, 0, y)
        box(parts, M["trim"], 0.16, H, 0.16, -W / 2 - 0.05, 0, y)
    # parapet + roof props
    box(parts, M["trim"], W + 0.4, 0.9, 0.25, 0, H / 2 + 0.45, D / 2)
    box(parts, M["trim"], W + 0.4, 0.9, 0.25, 0, H / 2 + 0.45, -D / 2)
    box(parts, M["trim"], 0.25, 0.9, D + 0.4, W / 2, H / 2 + 0.45, 0)
    box(parts, M["trim"], 0.25, 0.9, D + 0.4, -W / 2, H / 2 + 0.45, 0)
    cyl(parts, M["metal"], 1.4, 1.4, 2.6, W / 2 - 3, H / 2 + 1.3, 0, seg=10)
    box(parts, M["metal"], 1.8, 1.0, 1.4, -W / 2 + 3, H / 2 + 0.5, 2.5)
    box(parts, M["metal"], 1.8, 1.0, 1.4, -W / 2 + 3, H / 2 + 0.5, -2.5)
    # entrance canopy + lobby strip (front = +Z face)
    box(parts, M["trim"], 7.0, 0.35, 2.6, 0, -H / 2 + 3.2, D / 2 + 1.1)
    box(parts, M["lobby"], 6.0, 6.0, 0.15, 0, -H / 2 + 3.0, D / 2 + 0.02)
    return W, D, H


def build_midrise(parts, M, rng):
    W, D, H = 18.0, 14.0, 22.0
    floors = 6
    fh = H / floors
    box(parts, M["concrete"], W, H, D, 0, 0, 0)
    # stairwell strip
    box(parts, M["concrete2"], 3.2, H + 0.3, 0.35, -W / 2 + 2.2, 0, D / 2 + 0.1)
    # windows + ledges har floor (front + back)
    for i in range(floors):
        z = -H / 2 + (i + 0.5) * fh
        box(parts, M["trim"], W + 0.3, 0.2, D + 0.3, 0, z - fh / 2 + 0.1, 0)
        for wx in [-5.5, -1.2, 3.1]:
            box(parts, M["frame"], 2.1, 1.5, 0.12, wx, z, D / 2 + 0.06)
            box(parts, M["frame"], 2.1, 1.5, 0.12, wx, z, -D / 2 - 0.06)
        # balconies front par (2 floors ko chhod kar)
        if i % 2 == 1 and wx is not None:
            for bx in [-3.4, 1.6]:
                box(parts, M["trim"], 2.8, 0.18, 1.1, bx, z - fh / 2 + 0.05, D / 2 + 0.5)
                box(parts, M["rail"], 2.8, 0.9, 0.08, bx, z - fh / 2 + 0.5, D / 2 + 1.0)
                box(parts, M["rail"], 0.08, 0.9, 1.05, bx - 1.36, z - fh / 2 + 0.5, D / 2 + 0.5)
                box(parts, M["rail"], 0.08, 0.9, 1.05, bx + 1.36, z - fh / 2 + 0.5, D / 2 + 0.5)
    # parapet + AC
    box(parts, M["trim"], W + 0.3, 0.7, 0.2, 0, H / 2 + 0.35, D / 2)
    box(parts, M["metal"], 1.6, 0.9, 1.2, W / 2 - 3, H / 2 + 0.45, 0)
    return W, D, H


def build_shop(parts, M, rng, enterable=False):
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
            box(parts, M["shopglass"], gw, shopH - 0.9, 0.1, (gx0 + gx1) / 2, shopH / 2 + 0.2, D / 2 + 0.05)
    # awning (angled nahi — flat slab look, colored)
    box(parts, M["awning"], W - 1.0, 0.22, 1.5, 0, shopH + 0.15, D / 2 + 0.7)
    # sign board + lit strip
    box(parts, M["sign"], W - 2.0, 0.9, 0.25, 0, shopH + 0.95, D / 2 + 0.12)
    box(parts, M["signglow"], W - 2.6, 0.28, 0.06, 0, shopH + 0.95, D / 2 + 0.28)
    # upper windows + ledges
    for wx in [-4.5, 0, 4.5]:
        box(parts, M["frame"], 1.9, 1.4, 0.12, wx, shopH + upH / 2, D / 2 + 0.06)
    box(parts, M["trim"], W + 0.2, 0.18, D + 0.2, 0, shopH + 0.02, 0)
    # parapet
    box(parts, M["trim"], W + 0.2, 0.5, 0.18, 0, H + 0.25, D / 2)
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
        # counter (right side)
        box(parts, M["counter"], 3.6, 1.05, 0.8, iw / 2 - 2.6, 0.52, 0.8)
        # ceiling light strips (emissive)
        box(parts, M["ceilglow"], iw - 3.0, 0.08, 0.3, 0, shopH - 0.15, -0.8)
        box(parts, M["ceilglow"], iw - 3.0, 0.08, 0.3, 0, shopH - 0.15, 1.6)
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


# ---------------------------------------------------------------- main
try:
    build()
    vertex_ao()
    preview()
    export_glb()
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

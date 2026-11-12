"""
VELARA Design Team — Job: character (parametric humanoid designer)
==================================================================
User demand: "character ki rating 0 — koi character hi nahi".
T-pose humanoid 1.78m: hoodie-jacket, jeans, sneakers, hair, skin.
HIGH->LOW bake (normal+AO+rough) + studio/night render + Draco GLB.
    blender --background --python factory/jobs/make-character.py
Output: factory/out/character.glb (+ _studio/_preview.png)   Licence: CC0 (self-made)
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
PRESET = "character"
GLB = os.path.join(OUT, f"{PRESET}.glb")
PNG = os.path.join(OUT, f"{PRESET}_preview.png")
STUDIO_PNG = os.path.join(OUT, f"{PRESET}_studio.png")
AO_PNG = os.path.join(OUT, f"{PRESET}_ao.png")
N_PNG = os.path.join(OUT, f"{PRESET}_normal.png")
R_PNG = os.path.join(OUT, f"{PRESET}_rough.png")

A = {"bake": 1024, "ao": 512, "rough": 512, "samples": 72, "rx": 768, "ry": 1024}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
i = 0
while i + 1 <= len(argv):
    k = argv[i].lstrip("-")
    if i + 1 < len(argv):
        try:
            A[k] = int(argv[i + 1])
        except ValueError:
            A[k] = argv[i + 1]
    i += 2

R = {"job": "character", "steps": [], "cfg": {**A, "preset": PRESET}}


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

    jacket = bpy.data.materials.new("Jacket")
    jacket.use_nodes = True
    jb = jacket.node_tree.nodes["Principled BSDF"]
    set_input(jb, ["Base Color"], (0.09, 0.16, 0.19, 1.0))
    set_input(jb, ["Roughness"], 0.72)

    pants = bpy.data.materials.new("Pants")
    pants.use_nodes = True
    pb = pants.node_tree.nodes["Principled BSDF"]
    set_input(pb, ["Base Color"], (0.13, 0.13, 0.15, 1.0))
    set_input(pb, ["Roughness"], 0.8)

    skin = bpy.data.materials.new("Skin")
    skin.use_nodes = True
    skb = skin.node_tree.nodes["Principled BSDF"]
    set_input(skb, ["Base Color"], (0.72, 0.52, 0.38, 1.0))
    set_input(skb, ["Roughness"], 0.55)
    try:
        set_input(skb, ["Subsurface Weight"], 0.15)
    except KeyError:
        pass

    hair = bpy.data.materials.new("Hair")
    hair.use_nodes = True
    hb = hair.node_tree.nodes["Principled BSDF"]
    set_input(hb, ["Base Color"], (0.05, 0.04, 0.035, 1.0))
    set_input(hb, ["Roughness"], 0.45)

    shoes = bpy.data.materials.new("Shoes")
    shoes.use_nodes = True
    shb = shoes.node_tree.nodes["Principled BSDF"]
    set_input(shb, ["Base Color"], (0.82, 0.82, 0.84, 1.0))
    set_input(shb, ["Roughness"], 0.6)

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

    def rod(radius, length, loc, rot, mat, name, rx=0, ry=0, rz=0):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=length,
                                            location=loc)
        o = bpy.context.active_object
        o.name = name
        o.rotation_euler = (rx, ry, rz)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        o.data.materials.append(mat)
        return o

    def ball(radius, loc, mat, name, scale=(1, 1, 1)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14,
                                             radius=radius, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat)
        return o

    jacket_parts, pants_parts, skin_parts, hair_parts, shoe_parts = [], [], [], [], []

    # ---- torso (jacket) ----
    chest = box(0.40, 0.24, 0.34, (0, 0, 1.32), jacket, "Chest", taper=(0.86, 0.9, 0.0))
    jacket_parts.append(chest)
    jacket_parts.append(box(0.34, 0.20, 0.26, (0, 0, 1.06), jacket, "Abdomen",
                            taper=(0.92, 0.92, 0.0)))
    # hood (peeche girri hui)
    jacket_parts.append(ball(0.13, (0, -0.16, 1.46), jacket, "Hood",
                             scale=(1.0, 0.6, 1.1)))
    # shoulder caps
    for sx in (-1, 1):
        jacket_parts.append(ball(0.085, (sx * 0.22, 0, 1.44), jacket, f"Shoulder{sx}"))

    # ---- hips (pants) ----
    pants_parts.append(box(0.34, 0.22, 0.16, (0, 0, 0.90), pants, "Hips"))

    # ---- head + neck (skin) + hair ----
    skin_parts.append(rod(0.055, 0.10, (0, 0, 1.56), None, skin, "Neck"))
    head = ball(0.105, (0, 0.01, 1.70), skin, "Head", scale=(0.92, 1.05, 1.12))
    skin_parts.append(head)
    hair_parts.append(ball(0.112, (0, -0.005, 1.72), hair, "HairCap",
                           scale=(0.95, 1.02, 1.05)))
    # aankhon ke liye chhota dark visor-strip (stylish, no face rig abhi)
    hair_parts.append(box(0.15, 0.02, 0.035, (0, 0.095, 1.715), hair, "Shades"))

    # ---- arms: T-pose (X-axis rods) ----
    for sx in (-1, 1):
        jacket_parts.append(rod(0.055, 0.28, (sx * 0.36, 0, 1.44), None, jacket,
                                f"UpperArm{sx}", ry=math.radians(90)))
        jacket_parts.append(rod(0.048, 0.26, (sx * 0.63, 0, 1.44), None, jacket,
                                f"ForeArm{sx}", ry=math.radians(90)))
        skin_parts.append(ball(0.045, (sx * 0.79, 0, 1.44), skin, f"Hand{sx}",
                               scale=(1.2, 0.55, 1.05)))

    # ---- legs (pants) + shoes ----
    for sx in (-1, 1):
        pants_parts.append(rod(0.072, 0.42, (sx * 0.10, 0, 0.62), None, pants,
                               f"Thigh{sx}"))
        pants_parts.append(rod(0.058, 0.40, (sx * 0.10, 0, 0.22), None, pants,
                               f"Shin{sx}"))
        shoe_parts.append(box(0.095, 0.26, 0.075, (sx * 0.10, 0.05, 0.045), shoes,
                              f"Shoe{sx}"))

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

    body_m = merge_join(jacket_parts, "Body")            # bake target (jacket)
    pants_m = merge_join(pants_parts, "Pants")
    skin_m = merge_join(skin_parts, "Skin")
    hair_m = merge_join(hair_parts, "Hair")
    shoe_m = merge_join(shoe_parts, "Shoes")

    others = [o for o in (pants_m, skin_m, hair_m, shoe_m) if o]
    globals().update(BODY=body_m, PAINT=jacket, LIGHTF=None, LIGHTR=None,
                     WHEELS=[], OTHERS=others)
    tris = sum(len(p.vertices) - 2 for o in [body_m] + others for p in o.data.polygons)
    return f"verts={len(body_m.data.vertices)} parts=5 tris~{tris}"


# ---------------------------------------------------------------- 2. UV + bake (jacket par)
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
    bpy.ops.object.modifier_apply(modifier="S")
    bv = high.modifiers.new("B", "BEVEL")
    bv.width = 0.008
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
                        max_ray_distance=0.05, margin=8, use_clear=True)
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
    arr = 0.5 + 0.25 * (arr - arr.min()) / (np.ptp(arr) + 1e-6)   # cloth: 0.5..0.75
    img = bpy.data.images.new("R_bake", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    px = np.dstack([arr, arr, arr, np.ones_like(arr)]).ravel()
    img.pixels = px.tolist()
    img.filepath = R_PNG
    img.save()
    globals()["IMG_R"] = img
    return f"{size}px cloth roughness"


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
    set_input(nm, ["Strength"], 0.8)
    nt.links.new(nn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return "AO->base, cloth-rough, normal->bump"


# ---------------------------------------------------------------- 3. renders
def render_cam(scene, cam_loc, tgt_loc, lens, filepath, samples, exposure, ground_col,
               world_col, rim=True):
    helpers = []
    bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("Floor")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (*ground_col, 1.0))
    set_input(gb, ["Roughness"], 0.5)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("CamR")
    cam = bpy.data.objects.new("CamR", cam_data)
    scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam_data.lens = lens
    tgt = bpy.data.objects.new("TgtR", None)
    scene.collection.objects.link(tgt)
    tgt.location = tgt_loc
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    for nm, col, en, rot in (("Key", (1.0, 0.95, 0.9), 3.0, (0.9, 0.4, 0.8)),
                             ("Fill", (0.85, 0.9, 1.0), 1.2, (0.9, -0.7, 0.5)),
                             ("Rim", (1.0, 1.0, 1.0), 2.8, (1.3, 2.6, -0.4))):
        if nm == "Rim" and not rim:
            continue
        ld = bpy.data.lights.new(nm, "SUN")
        lo = bpy.data.objects.new(nm, ld)
        scene.collection.objects.link(lo)
        ld.energy = en
        ld.color = col
        lo.rotation_euler = rot   # OBJECT ghumao, light-data nahi!
        helpers.append(lo)

    world = bpy.data.worlds.new("RW")
    world.use_nodes = True
    wbg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    set_input(wbg, ["Color"], (*world_col, 1.0))
    scene.world = world

    dev = setup_cycles(samples=samples)
    try:
        scene.view_settings.exposure = exposure
    except Exception:
        pass
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.filepath = filepath
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)

    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return dev


@step("studio_render", required=False)
def render_studio():
    dev = render_cam(bpy.context.scene, (2.1, 2.0, 1.5), (0, 0, 0.95), 42,
                     STUDIO_PNG, max(48, A["samples"] // 2), 1.25,
                     (0.55, 0.57, 0.60), (0.38, 0.40, 0.44))
    return f"{STUDIO_PNG} ({dev})"


@step("night_render", required=False)
def render_preview():
    dev = render_cam(bpy.context.scene, (2.3, -1.9, 1.6), (0, 0, 1.0), 40,
                     PNG, A["samples"], 1.15,
                     (0.05, 0.05, 0.06), (0.006, 0.008, 0.014))
    return f"{PNG} ({dev})"


# ---------------------------------------------------------------- 4. export
def do_export():
    body = globals()["BODY"]
    high = globals().get("HIGH")
    if high:
        bpy.ops.object.select_all(action="DESELECT")
        high.select_set(True)
        bpy.ops.object.delete()
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    for o in globals().get("OTHERS", []):
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
render_studio()
render_preview()
export_glb()
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

"""
VELARA Asset Factory — Job: "streetlamp ULTRA" (v2 — AAA bake pipeline)
=======================================================================
Run (codespace CPU ya Colab GPU — same script):
    blender --background --python factory/make-streetlamp-ultra.py
    blender --background --python factory/make-streetlamp-ultra.py -- --bake 2048 --samples 256

v1 ("basic") se upgrades:
  - Design  : curved cobra arm (bezier bevel), tapered pole, bolted base plate,
              handhole + screws, pole caps — international modern streetlight
  - Bake    : HIGH->LOW selected-to-active bake — 1024px TANGENT NORMAL
              + 512px AO (yehi asli AAA depth-trick hai)
  - Material: procedural powder-coat roughness noise (512px, Non-Color)
  - Render  : night shot — emission boost, DOF, volume haze, light pool
  - GPU     : auto-detect OptiX/CUDA (Colab T4) with CPU fallback
  - Budget  : GLB 1.2MB se bada hua to textures auto-downscale

Output: factory/out/streetlamp.glb (+ streetlamp_ultra_preview.png + bake PNGs)
Licence: self-made (CC0) — ASSETS.md entry ke saath.
Optional steps fail-safe hain; export required hai.
"""
import json
import math
import os
import sys
import traceback

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
GLB = os.path.join(OUT, "streetlamp.glb")
PNG = os.path.join(OUT, "streetlamp_ultra_preview.png")
AO_PNG = os.path.join(OUT, "streetlamp_ultra_ao.png")
N_PNG = os.path.join(OUT, "streetlamp_ultra_normal.png")
R_PNG = os.path.join(OUT, "streetlamp_ultra_rough.png")

BASE_COLOR = (0.055, 0.06, 0.068, 1.0)   # graphite powder-coat
GLOW_COLOR = (0.92, 0.94, 1.0, 1.0)      # cool-white LED
GLOW_EXPORT = 6.0
GLOW_RENDER = 60.0                        # night render ke liye drama

# ---- CLI overrides (GPU worker pe badha sakte ho) ----
A = {"bake": 1024, "ao": 512, "rough": 512, "samples": 72, "rx": 896, "ry": 608}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
i = 0
while i + 1 < len(argv) + 1 and i < len(argv):
    k = argv[i].lstrip("-")
    if i + 1 < len(argv):
        try:
            A[k] = int(argv[i + 1])
        except ValueError:
            A[k] = argv[i + 1]
    i += 2
print(f"[cfg] {A}", flush=True)

R = {"job": "streetlamp-ultra", "steps": [], "cfg": A}


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
    """GPU (OptiX/CUDA) try karo, warna CPU — same script dono workers pe chalti hai."""
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


# ---------------------------------------------------------------- 1. model
@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    metal = bpy.data.materials.new("MetalDark")
    metal.use_nodes = True
    b = metal.node_tree.nodes["Principled BSDF"]
    set_input(b, ["Base Color"], BASE_COLOR)
    set_input(b, ["Metallic"], 0.9)
    set_input(b, ["Roughness"], 0.5)

    glow = bpy.data.materials.new("LampGlow")
    glow.use_nodes = True
    g = glow.node_tree.nodes["Principled BSDF"]
    set_input(g, ["Emission Color", "Emission"], GLOW_COLOR)
    set_input(g, ["Emission Strength"], GLOW_EXPORT)

    def cyl(r, h, loc, seg, name, mat, rot=None):
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h,
                                            location=loc, rotation=rot or (0, 0, 0))
        o = bpy.context.active_object
        o.name = name
        o.data.materials.append(mat)
        return o

    def cone(r1, r2, h, loc, seg, name, mat):
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2,
                                        depth=h, location=loc)
        o = bpy.context.active_object
        o.name = name
        o.data.materials.append(mat)
        return o

    def box(sx, sy, sz, loc, rot, name, mat):
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
        o = bpy.context.active_object
        o.name = name
        o.scale = (sx, sy, sz)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat)
        return o

    parts = []
    # --- base assembly (bolted, real-world style) ---
    parts.append(cyl(0.14, 0.05, (0, 0, 0.025), 32, "BasePlate", metal))
    parts.append(cyl(0.115, 0.22, (0, 0, 0.16), 32, "Skirt", metal))
    for k in range(4):  # anchor bolts
        a = math.radians(45 + 90 * k)
        parts.append(cyl(0.013, 0.025, (0.081 * math.cos(a), 0.081 * math.sin(a), 0.062),
                         8, f"Bolt{k}", metal))
    # --- tapered pole + caps ---
    parts.append(cone(0.062, 0.042, 4.25, (0, 0, 0.27 + 2.125), 32, "Pole", metal))
    parts.append(cyl(0.048, 0.025, (0, 0, 4.525), 24, "PoleCap", metal))
    # --- handhole + screws ---
    parts.append(box(0.085, 0.055, 0.012, (0.048, 0, 0.85), (0, 0, 0), "Handhole", metal))
    parts.append(cyl(0.007, 0.012, (0.052, 0.018, 0.85), 8, "ScrewA", metal,
                     rot=(0, math.pi / 2, 0)))
    parts.append(cyl(0.007, 0.012, (0.052, -0.018, 0.85), 8, "ScrewB", metal,
                     rot=(0, math.pi / 2, 0)))
    # --- curved cobra arm (bezier -> bevel -> mesh) ---
    cd = bpy.data.curves.new("ArmCurve", type="CURVE")
    cd.dimensions = "3D"
    cd.fill_mode = "FULL"
    cd.bevel_depth = 0.034
    cd.bevel_resolution = 4
    sp = cd.splines.new("BEZIER")
    sp.bezier_points.add(2)
    for p, co in zip(sp.bezier_points, [(0, 0, 4.52), (0.30, 0, 4.78), (0.74, 0, 4.66)]):
        p.co = co
        p.handle_left_type = p.handle_right_type = "AUTO"
    arm = bpy.data.objects.new("Arm", cd)
    scene.collection.objects.link(arm)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.convert(target="MESH")
    arm.data.materials.append(metal)
    parts.append(arm)
    # --- cobra head + lens + junction cap ---
    parts.append(box(0.52, 0.16, 0.11, (1.02, 0, 4.60), (0, -0.16, 0), "Head", metal))
    parts.append(box(0.44, 0.11, 0.015, (1.04, 0, 4.545), (0, -0.16, 0), "Lens", glow))
    parts.append(cyl(0.05, 0.05, (0.79, 0, 4.64), 16, "JunctionCap", metal,
                     rot=(0, math.pi / 2, 0)))

    # join -> ek mesh (2 material slots)
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    lamp = bpy.context.active_object
    lamp.name = "StreetLamp"
    bpy.context.scene.cursor.location = (0, 0, 0)   # 4.5: scene.cursor
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

    bv = lamp.modifiers.new("BevelSoft", "BEVEL")
    bv.segments = 2
    bv.width = 0.006
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="BevelSoft")

    lamp.active_material = metal
    globals()["LAMP"] = lamp
    globals()["METAL"] = metal
    globals()["GLOW"] = glow
    return f"verts={len(lamp.data.vertices)}"


# ---------------------------------------------------------------- 2. UV
@step("uv")
def uv_unwrap():
    lamp = globals()["LAMP"]
    bpy.ops.object.select_all(action="DESELECT")
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return "smart-project"


# ---------------------------------------------------------------- 3. HIGH poly
@step("high_poly")
def make_high():
    lamp = globals()["LAMP"]
    bpy.ops.object.select_all(action="DESELECT")
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
    bpy.ops.object.duplicate()
    high = bpy.context.active_object
    high.name = "StreetLamp_HIGH"
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


# ---------------------------------------------------------------- 4. bakes
@step("normal_bake")
def bake_normal():
    lamp, high, metal = globals()["LAMP"], globals()["HIGH"], globals()["METAL"]
    setup_cycles(samples=16)
    img = bpy.data.images.new("N_bake", A["bake"], A["bake"], alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    nt = metal.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
    bpy.ops.object.bake(type="NORMAL", use_selected_to_active=True,
                        max_ray_distance=0.06, margin=8, use_clear=True)
    img.filepath = N_PNG
    img.save()
    globals()["IMG_N"] = img
    return f"{A['bake']}px tangent normal (HIGH->LOW)"


@step("ao_bake", required=False)
def bake_ao():
    lamp, high, metal = globals()["LAMP"], globals()["HIGH"], globals()["METAL"]
    img = bpy.data.images.new("AO_bake", A["ao"], A["ao"], alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    nt = metal.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
    bpy.ops.object.bake(type="AO", use_selected_to_active=True,
                        max_ray_distance=0.9, margin=8, use_clear=True)
    # AO ko base-color se tint karo -> seedha Base Color wire (exporter-clean)
    arr = np.asarray(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    arr[:, 0] *= BASE_COLOR[0]
    arr[:, 1] *= BASE_COLOR[1]
    arr[:, 2] *= BASE_COLOR[2]
    img.pixels = arr.ravel().tolist()
    img.filepath = AO_PNG
    img.save()
    globals()["IMG_AO"] = img
    return f"{A['ao']}px AO (HIGH->LOW, tinted)"


@step("roughness_noise", required=False)
def make_roughness():
    """Powder-coat wear: multi-octave value noise -> roughnessTexture."""
    size = A["rough"]
    rng = np.random.default_rng(11)
    layers = []
    for cell, w in ((64, 0.5), (16, 0.3), (4, 0.2)):
        g = rng.random((cell, cell)).astype(np.float32)
        rep = max(1, size // cell)
        layers.append(w * np.repeat(np.repeat(g, rep, axis=0), rep, axis=1))
    arr = np.clip(sum(layers) / sum(w for _, w in ((64, .5), (16, .3), (4, .2))), 0, 1)
    arr = 0.35 + 0.30 * (arr - arr.min()) / (np.ptp(arr) + 1e-6)   # 0.35..0.65
    img = bpy.data.images.new("R_bake", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    px = np.dstack([arr, arr, arr, np.ones_like(arr)]).ravel()
    img.pixels = px.tolist()
    img.filepath = R_PNG
    img.save()
    globals()["IMG_R"] = img
    return f"{size}px roughness noise"


# ---------------------------------------------------------------- 5. wire material
@step("wire_material")
def wire():
    metal = globals()["METAL"]
    nt = metal.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    # base color = tinted AO
    ao_node = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image
                   and n.image.name == "AO_bake")
    nt.links.new(ao_node.outputs["Color"], bsdf.inputs["Base Color"])
    # roughness
    rn = nt.nodes.new("ShaderNodeTexImage")
    rn.image = globals()["IMG_R"]
    nt.links.new(rn.outputs["Color"], bsdf.inputs["Roughness"])
    # normal map
    nn = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image
              and n.image.name == "N_bake")
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.strength = 1.0
    nt.links.new(nn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return "AO->base, noise->rough, normal->bump"


# ---------------------------------------------------------------- 6. night render
@step("night_render", required=False)
def render_preview():
    scene = bpy.context.scene
    lamp, glow = globals()["LAMP"], globals()["GLOW"]
    helpers = []

    bpy.ops.mesh.primitive_plane_add(size=22, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    ground.name = "Ground"
    gm = bpy.data.materials.new("Asphalt")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.04, 0.04, 0.045, 1.0))
    set_input(gb, ["Roughness"], 0.85)
    set_input(gb, ["Metallic"], 0.0)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (3.2, -6.8, 2.6)
    cam_data.lens = 28
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.8
    tgt = bpy.data.objects.new("Tgt", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0.55, 0, 2.5)
    cam_data.dof.focus_object = tgt
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    # dim moonlight rim
    moon_data = bpy.data.lights.new("Moon", "SUN")
    moon = bpy.data.objects.new("Moon", moon_data)
    scene.collection.objects.link(moon)
    moon_data.energy = 0.35
    moon_data.color = (0.7, 0.8, 1.0)
    moon.rotation_euler = (1.0, 0.2, 0.7)
    helpers.append(moon)

    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    wout = next(n for n in world.node_tree.nodes if n.type == "ShaderNodeOutputWorld")
    wbg = next(n for n in world.node_tree.nodes if n.type == "Background")
    set_input(wbg, ["Color"], (0.004, 0.005, 0.009, 1.0))
    vol = world.node_tree.nodes.new("ShaderNodeVolumePrincipled")
    set_input(vol, ["Density"], 0.010)
    world.node_tree.links.new(vol.outputs["Volume"], wout.inputs["Volume"])
    scene.world = world

    dev = setup_cycles(samples=A["samples"])
    R["device"] = dev
    scene.cycles.use_denoising = True
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.filepath = PNG
    scene.render.image_settings.file_format = "PNG"

    set_input(glow.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_RENDER)
    bpy.ops.render.render(write_still=True)
    set_input(glow.node_tree.nodes["Principled BSDF"], ["Emission Strength"], GLOW_EXPORT)

    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return f"{PNG} ({dev})"


# ---------------------------------------------------------------- 7. export
def do_export():
    lamp = globals()["LAMP"]
    bpy.ops.object.select_all(action="DESELECT")
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
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
    # HIGH prop hatao pehle
    high = globals().get("HIGH")
    if high:
        bpy.ops.object.select_all(action="DESELECT")
        high.select_set(True)
        bpy.ops.object.delete()
    size = do_export()
    # G560 budget guard: 1.2MB se bada to textures 25% chhote karke dobara
    if size > 1_200_000:
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
export_glb()

lamp = globals()["LAMP"]
R["verts"] = len(lamp.data.vertices)
R["tris"] = sum(len(p.vertices) - 2 for p in lamp.data.polygons)
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

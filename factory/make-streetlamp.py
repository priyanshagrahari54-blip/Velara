"""
VELARA Asset Factory — Job: "streetlamp"
========================================
Codespace ke Blender (headless) mein chalne ke liye:
    blender --background --python factory/make-streetlamp.py

Pipeline (ye hi "heavy kaam" hai jo codespace karta hai):
  1. Model   : primitives (base/pole/arm/head/lens) + bevel -> single mesh
  2. UV      : smart project
  3. Bake    : Cycles CPU AO bake (512px), base-color tint ke saath wire
  4. Preview : Cycles CPU render 640px (user visual-QA ke liye PNG)
  5. Export  : Draco-compressed GLB (three.js GLTFLoader-ready, meters, Y-up)

Output: factory/out/streetlamp.glb (+ streetlamp_preview.png + streetlamp_ao.png)
Licence: self-made (CC0) — ASSETS.md entry ke saath commit hota hai.
Agar bake ya render fail ho (optional steps), GLB phir bhi export hota hai.
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
PNG = os.path.join(OUT, "streetlamp_preview.png")
AO_PNG = os.path.join(OUT, "streetlamp_ao.png")

BASE_COLOR = (0.06, 0.065, 0.07, 1.0)   # dark metal
GLOW_COLOR = (1.0, 0.82, 0.55, 1.0)     # warm white lens
GLOW_STRENGTH = 6.0

R = {"job": "streetlamp", "steps": []}


def step(name, required=True):
    """Decorator: har step ka PASS/FAIL capture karo (optional steps fail-safe)."""
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
    """Version-safe input setter (4.0 ne 'Emission' -> 'Emission Color' kiya)."""
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return
    raise KeyError(f"no input among {names}")


# ---------------------------------------------------------------- 1. model
@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    def cyl(r, h, loc, seg, name, mat):
        bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=loc)
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

    metal = bpy.data.materials.new("MetalDark")
    metal.use_nodes = True
    b = metal.node_tree.nodes["Principled BSDF"]
    set_input(b, ["Base Color"], BASE_COLOR)
    set_input(b, ["Metallic"], 0.85)
    set_input(b, ["Roughness"], 0.45)

    glow = bpy.data.materials.new("LampGlow")
    glow.use_nodes = True
    g = glow.node_tree.nodes["Principled BSDF"]
    set_input(g, ["Emission Color", "Emission"], GLOW_COLOR)
    set_input(g, ["Emission Strength"], GLOW_STRENGTH)

    # ---- geometry (meters, origin ground-centre; X axis = arm side) ----
    base = cyl(0.13, 0.50, (0, 0, 0.25), 24, "Base", metal)
    pole = cyl(0.05, 4.30, (0, 0, 0.50 + 2.15), 24, "Pole", metal)
    arm = cyl(0.035, 0.95, (0.475, 0, 4.76), 16, "Arm", metal)
    arm.rotation_euler[1] = math.pi / 2          # cylinder axis Z -> X (horizontal)
    head = box(0.46, 0.20, 0.10, (0.98, 0, 4.70), (0, -0.14, 0), "Head", metal)
    lens = box(0.38, 0.14, 0.02, (0.98, 0, 4.635), (0, -0.14, 0), "Lens", glow)
    jbox = box(0.14, 0.14, 0.16, (0.09, 0, 0.58), (0, 0, 0), "Junction", metal)

    # join -> single draw call ke liye ek hi mesh (2 material slots)
    for o in (base, pole, arm, head, lens, jbox):
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    lamp = bpy.context.active_object
    lamp.name = "StreetLamp"

    # origin ground par (three.js placement easy)
    bpy.context.scene.cursor.location = (0, 0, 0)   # 4.5: scene.cursor (context.cursor nahi)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

    # soft edges (AAA-feel detail)
    bv = lamp.modifiers.new("BevelSoft", "BEVEL")
    bv.segments = 2
    bv.width = 0.008
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="BevelSoft")

    lamp.active_material = metal
    globals()["LAMP"] = lamp
    globals()["METAL"] = metal
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


# ---------------------------------------------------------------- 3. AO bake
@step("ao_bake", required=False)
def bake_ao():
    scene = bpy.context.scene
    lamp = globals()["LAMP"]
    metal = globals()["METAL"]

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    try:
        scene.cycles.samples = 32
    except Exception:
        pass  # newer samplers — default chalne do

    img = bpy.data.images.new("AO", 512, 512, alpha=False, float_buffer=False)
    nt = metal.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    node.select = True
    nt.nodes.active = node  # <- bake target

    bpy.ops.object.select_all(action="DESELECT")
    lamp.select_set(True)
    bpy.context.view_layer.objects.active = lamp
    bpy.ops.object.bake(type="AO", use_clear=True, margin=16)

    # AO ko base-color se tint karo, phir seedhe Base Color pe wire karo —
    # isse glTF exporter use baseColorTexture ki tarah clean export karta hai
    # (constant*mix ka node-graph exporter confuse kar sakta hai).
    arr = np.asarray(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    arr[:, 0] *= BASE_COLOR[0]
    arr[:, 1] *= BASE_COLOR[1]
    arr[:, 2] *= BASE_COLOR[2]
    img.pixels = arr.ravel().tolist()

    img.filepath = AO_PNG
    img.save()

    bsdf = nt.nodes["Principled BSDF"]
    nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    return "512px AO baked + tinted + wired"


# ---------------------------------------------------------------- 4. preview
@step("preview_render", required=False)
def render_preview():
    scene = bpy.context.scene
    helpers = []

    bpy.ops.mesh.primitive_plane_add(size=16, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    ground.name = "Ground"
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.18, 0.18, 0.20, 1.0))
    set_input(gb, ["Roughness"], 0.9)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (5.2, -6.0, 3.0)
    cam_data.lens = 28
    tgt = bpy.data.objects.new("Tgt", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0.4, 0, 2.4)
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun = bpy.data.objects.new("Sun", sun_data)
    scene.collection.objects.link(sun)
    sun_data.energy = 3.5
    sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    helpers.append(sun)

    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.02, 0.03, 1.0)
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    try:
        scene.cycles.samples = 96
        scene.cycles.use_denoising = True
    except Exception:
        pass
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.filepath = PNG
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)

    # helpers hatao — GLB mein sirf lamp jani chahiye
    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return PNG


# ---------------------------------------------------------------- 5. export
@step("glb_export")
def export_glb():
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
        export_draco_mesh_compression_enable=True,   # G560 budget ke liye zaroori
        export_draco_mesh_compression_level=6,
        export_image_format="AUTO",
    )
    return f"{os.path.getsize(GLB)} bytes"


# ---------------------------------------------------------------- main
build()
uv_unwrap()
bake_ao()
render_preview()
export_glb()

lamp = globals()["LAMP"]
tris = sum(len(p.vertices) - 2 for p in lamp.data.polygons)
R["verts"] = len(lamp.data.vertices)
R["tris"] = tris
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

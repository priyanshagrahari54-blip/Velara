"""
VELARA Design Team — Job: "neon-sign"
======================================
Night-phase prop: neon signboard — dark backboard + emissive extruded
text (built-in font) + glow render + Draco GLB.
    blender --background --python factory/jobs/make-neon-sign.py
Output: factory/out/neon-sign.glb (+ _preview.png)   Licence: CC0 (self-made)
"""
import json
import math
import os
import sys
import traceback

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)
GLB = os.path.join(OUT, "neon-sign.glb")
PNG = os.path.join(OUT, "neon-sign_preview.png")
STUDIO_PNG = os.path.join(OUT, "neon-sign_studio.png")

NEON = (1.0, 0.15, 0.45, 1.0)     # hot pink
EXPORT_STRENGTH = 8.0
RENDER_STRENGTH = 60.0

R = {"job": "neon-sign", "steps": []}


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


@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    board = bpy.data.materials.new("Board")
    board.use_nodes = True
    bb = board.node_tree.nodes["Principled BSDF"]
    set_input(bb, ["Base Color"], (0.03, 0.03, 0.04, 1.0))
    set_input(bb, ["Metallic"], 0.4)
    set_input(bb, ["Roughness"], 0.6)

    neon = bpy.data.materials.new("Neon")
    neon.use_nodes = True
    nb = neon.node_tree.nodes["Principled BSDF"]
    set_input(nb, ["Emission Color", "Emission"], NEON)
    set_input(nb, ["Emission Strength"], EXPORT_STRENGTH)

    # ---- backboard (thoda rounded) ----
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 1.8))
    b = bpy.context.active_object
    b.name = "Board"
    b.scale = (2.6, 0.12, 1.1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bv = b.modifiers.new("Bevel", "BEVEL")
    bv.segments = 3
    bv.width = 0.04
    bpy.ops.object.modifier_apply(modifier="Bevel")
    b.data.materials.append(board)

    # ---- neon text (built-in font, extruded tube look) ----
    cd = bpy.data.curves.new("NeonText", type="FONT")
    cd.body = "VELARA"
    cd.extrude = 0.045
    cd.bevel_depth = 0.012
    cd.bevel_resolution = 2
    cd.size = 0.62
    cd.space_character = 1.15
    cd.align_x = "CENTER"
    txt = bpy.data.objects.new("NeonText", cd)
    scene.collection.objects.link(txt)
    txt.location = (0, 0.10, 1.8)
    txt.rotation_euler = (0, 0, 0)
    txt.data.materials.append(neon)

    # ---- wall-mount brackets ----
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1.0,
                                        location=(sx * 2.1, -0.16, 1.8))
        br = bpy.context.active_object
        br.name = f"Bracket{sx}"
        br.scale = (0.08, 0.26, 0.08)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        br.data.materials.append(board)

    globals()["PARTS"] = [b, txt]
    return "board + VELARA neon + brackets"


@step("night_render", required=False)
def render_preview():
    scene = bpy.context.scene
    helpers = []
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("Wall")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.05, 0.05, 0.06, 1.0))
    set_input(gb, ["Roughness"], 0.9)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (3.4, -4.4, 2.2)
    cam_data.lens = 32
    tgt = bpy.data.objects.new("Tgt", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, 0, 1.8)
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    scene.camera = cam
    helpers += [cam, tgt]

    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    wout = next(n for n in world.node_tree.nodes if n.type == "OUTPUT_WORLD")
    wbg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    set_input(wbg, ["Color"], (0.003, 0.003, 0.006, 1.0))
    vol = world.node_tree.nodes.new("ShaderNodeVolumePrincipled")
    set_input(vol, ["Density"], 0.012)
    world.node_tree.links.new(vol.outputs["Volume"], wout.inputs["Volume"])
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    try:
        scene.cycles.samples = 96
        scene.cycles.use_denoising = True
    except Exception:
        pass
    scene.render.resolution_x = 896
    scene.render.resolution_y = 608
    scene.render.filepath = PNG
    scene.render.image_settings.file_format = "PNG"

    set_input(bpy.data.materials["Neon"].node_tree.nodes["Principled BSDF"],
              ["Emission Strength"], RENDER_STRENGTH)
    bpy.ops.render.render(write_still=True)
    set_input(bpy.data.materials["Neon"].node_tree.nodes["Principled BSDF"],
              ["Emission Strength"], EXPORT_STRENGTH)

    bpy.ops.object.select_all(action="DESELECT")
    for o in helpers:
        o.select_set(True)
    bpy.ops.object.delete()
    return PNG




# ---------------------------------------------------------------- 3b. STUDIO render
# (user feedback: night previews andhere mein the — ab bright 3-light studio bhi)
@step("studio_render", required=False)
def render_studio():
    scene = bpy.context.scene
    lightF, lightR = globals()["LIGHTF"], globals()["LIGHTR"]
    helpers = []
    L = 2.6

    bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.01))
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("StudioFloor")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    set_input(gb, ["Base Color"], (0.35, 0.36, 0.40, 1.0))
    set_input(gb, ["Roughness"], 0.45)
    ground.data.materials.append(gm)
    helpers.append(ground)

    cam_data = bpy.data.cameras.new("CamS")
    cam = bpy.data.objects.new("CamS", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (3.0, -4.6, 2.3)
    cam_data.lens = 38
    tgt = bpy.data.objects.new("TgtS", None)
    scene.collection.objects.link(tgt)
    tgt.location = (0, 0, 1.8)
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
        ld.rotation_euler = rot
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


@step("glb_export")
def export_glb():
    parts = globals()["PARTS"]
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    return f"{os.path.getsize(GLB)} bytes"


build()
render_preview()
render_studio()
export_glb()
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

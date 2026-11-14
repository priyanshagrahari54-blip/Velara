"""
VELARA Design Team — Job: "make-streetkit" (street micro-detail, bake-free)
==========================================================================
refs/remaster-street-detail.jpg jaisa: hydrant, storm-drain, bench,
parking meter, sign pole. Sab bake-free (material colors + vertex AO).
Origin har asset ka base par (y=0 ground).

    blender --background --python factory/jobs/make-streetkit.py -- hydrant
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

PRESETS = ["hydrant", "drain", "bench", "meter", "sign"]

A = {"rx": 480, "ry": 360}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PRESET = argv[0] if argv else "hydrant"
assert PRESET in PRESETS, f"unknown preset {PRESET}"
GLB = os.path.join(OUT, f"{PRESET}.glb")
PNG = os.path.join(OUT, f"{PRESET}_preview.png")

R = {"job": f"streetkit-{PRESET}", "steps": [], "cfg": {"preset": PRESET}}


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


# convention: (sx, HEIGHT, sz) sizes; (px, height, pz) pos — blender Z-up map
def box(parts, mat, sx, sy, sz, px, py, pz):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(px, pz, py))
    o = bpy.context.active_object
    o.scale = (sx / 2, sz / 2, sy / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    parts.append(o)
    return o


def cyl(parts, mat, r, h, px, py, pz, seg=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=1, depth=h, location=(px, pz, py))
    o = bpy.context.active_object
    o.scale = (r, r, 1)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    parts.append(o)
    return o


@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(hash(PRESET) % 9999)

    M = {
        "red": principled(bpy.data.materials.new("Red"), (0.62, 0.08, 0.06), 0.6),
        "dark": principled(bpy.data.materials.new("Dark"), (0.16, 0.17, 0.18), 0.8),
        "metal": principled(bpy.data.materials.new("Metal"), (0.38, 0.40, 0.43), 0.5, 0.6),
        "wood": principled(bpy.data.materials.new("Wood"), (0.42, 0.30, 0.18), 0.85),
        "green": principled(bpy.data.materials.new("ParkGreen"), (0.10, 0.32, 0.14), 0.8),
        "screen": principled(bpy.data.materials.new("Screen"), (0.05, 0.06, 0.07), 0.3,
                             emission=(0.55, 0.95, 0.65), emi_strength=1.6),
        "plate": principled(bpy.data.materials.new("Plate"), (0.75, 0.72, 0.30), 0.5),
    }
    parts = []

    if PRESET == "hydrant":
        # base + barrel + dome + side caps + top nut
        cyl(parts, M["red"], 0.16, 0.10, 0, 0.05, 0, seg=10)
        cyl(parts, M["red"], 0.11, 0.62, 0, 0.41, 0, seg=10)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.11, location=(0, 0, 0.75))
        d = bpy.context.active_object
        d.scale = (1, 1, 0.7)
        bpy.ops.object.transform_apply(scale=True)
        d.data.materials.append(M["red"]); parts.append(d)
        cyl(parts, M["red"], 0.05, 0.09, 0, 0.82, 0, seg=6)
        for sx in (-0.14, 0.14):
            cyl(parts, M["dark"], 0.045, 0.10, sx, 0.48, 0, seg=8)

    elif PRESET == "drain":
        # curb-side storm drain: frame + grate slats + slope
        box(parts, M["dark"], 1.1, 0.05, 0.7, 0, 0.025, 0)
        for i in range(6):
            box(parts, M["metal"], 0.95, 0.04, 0.06, 0, 0.07, -0.25 + i * 0.1)
        box(parts, M["dark"], 1.1, 0.09, 0.08, 0, 0.06, 0.36)

    elif PRESET == "bench":
        # slats + legs + armrests
        for i in range(4):
            box(parts, M["wood"], 0.11, 0.04, 1.7, -0.36 + i * 0.24, 0.45, 0)
        box(parts, M["wood"], 0.11, 0.04, 1.7, -0.36 + 0.72, 0.45, 0)
        for i in range(3):
            box(parts, M["wood"], 0.11, 0.04, 1.7, -0.36 + i * 0.24 + 0.12, 0.72, -0.42)  # backrest tilt nahi — flat
        for sz in (-0.7, 0.7):
            box(parts, M["metal"], 0.7, 0.05, 0.05, 0, 0.42, sz)
            box(parts, M["metal"], 0.05, 0.45, 0.05, -0.3, 0.22, sz)
            box(parts, M["metal"], 0.05, 0.45, 0.05, 0.3, 0.22, sz)

    elif PRESET == "meter":
        cyl(parts, M["dark"], 0.045, 1.1, 0, 0.55, 0, seg=8)
        box(parts, M["dark"], 0.30, 0.42, 0.14, 0, 1.28, 0)
        box(parts, M["screen"], 0.16, 0.10, 0.02, 0, 1.33, 0.08)
        box(parts, M["green"], 0.34, 0.05, 0.18, 0, 1.02, 0)

    else:  # sign
        cyl(parts, M["metal"], 0.05, 2.6, 0, 1.3, 0, seg=8)
        box(parts, M["plate"], 0.75, 0.55, 0.03, 0, 2.25, 0)
        box(parts, M["dark"], 0.79, 0.59, 0.02, 0, 2.25, -0.01)

    # join sab — single mesh multi-material
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "Prop"
    obj.data.validate()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    globals()["PROP"] = obj
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return f"parts={len(parts)} tris~{tris}"


@step("vertex_ao")
def vertex_ao():
    rng = random.Random(99)
    obj = globals()["PROP"]
    col = obj.data.attributes.new("ao", "BYTE_COLOR", "POINT")
    zs = [v.co.z for v in obj.data.vertices]
    zmin, zmax = min(zs), max(zs)
    for i, v in enumerate(obj.data.vertices):
        t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
        g = 0.78 + 0.22 * t
        g *= 0.96 + 0.07 * rng.random()
        g = max(0.35, min(1.0, g))
        col.data[i].color = (g, g, g, 1.0)
    return f"verts={len(obj.data.vertices)}"


@step("preview_render", required=False)
def preview():
    scene = bpy.context.scene
    obj = globals()["PROP"]
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    scene.cycles.samples = 32
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (2.2, -2.6, 1.4)
    cam.rotation_euler = (math.radians(72), 0, math.radians(40))
    cam_data.lens = 45
    scene.camera = cam
    l = bpy.data.lights.new("L", "AREA")
    l.energy = 120; l.size = 4
    lo = bpy.data.objects.new("L", l)
    lo.location = (3, -2, 4)
    scene.collection.objects.link(lo)
    bg = bpy.data.worlds.new("Bg")
    bg.use_nodes = True
    set_input(bg.node_tree.nodes["Background"], ["Color"], (0.55, 0.58, 0.62, 1.0))
    scene.world = bg
    scene.render.resolution_x = A["rx"]
    scene.render.resolution_y = A["ry"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PNG
    bpy.ops.render.render(write_still=True)
    return PNG


@step("glb_export")
def export_glb():
    obj = globals()["PROP"]
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
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


try:
    build()
    vertex_ao()
    preview()
    export_glb()
except Exception:
    traceback.print_exc()

obj = globals().get("PROP")
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

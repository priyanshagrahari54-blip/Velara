"""
VELARA Design Team — Job: "make-foliage" (ULTRA-REAL vegetation, bake-free)
===========================================================================
User demand: "grass tree ye sab kuch nhi hai" — full green city. Har asset
BAKE-FREE hai (Cycles headless bake black textures de raha tha — v2 cars
mein wahi bug mila): material colors direct + realism VERTEX COLORS se.

  - tree-street : ~5.4m linden-jaisa street tree (trunk + 6-blob canopy,
                  per-blob brightness variation = natural mottling)
  - tree-park   : ~7.2m broad park tree (thicker trunk, 8 blobs)
  - bush        : ground mound cluster
  - grass-tuft  : 16 tapered blades, dark-base→bright-tip gradient

    blender --background --python factory/jobs/make-foliage.py -- tree-street
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
    "tree-street": dict(kind="tree", H=5.4, trunk_r0=0.16, trunk_r1=0.07,
                        canopy_y=3.7, canopy_rx=1.7, canopy_ry=1.25,
                        canopy_rz=2.1, blobs=6, blob_sub=1, seed=11),
    "tree-park":   dict(kind="tree", H=7.2, trunk_r0=0.26, trunk_r1=0.10,
                        canopy_y=5.0, canopy_rx=2.6, canopy_ry=1.9,
                        canopy_rz=3.2, blobs=8, blob_sub=2, seed=23),
    "bush":        dict(kind="bush", H=1.0, blobs=4, blob_sub=2, seed=31),
    "grass-tuft":  dict(kind="grass", blades=16, H=0.30, seed=47),
}

A = {"samples": 48, "rx": 720, "ry": 500}
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PRESET = argv[0] if argv else "tree-street"
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

R = {"job": f"foliage-{PRESET}", "steps": [], "cfg": {**A, "preset": PRESET}}


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


def principled(mat, base, rough, metallic=0.0, double_sided=False):
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    set_input(b, ["Base Color"], (*base, 1.0))
    set_input(b, ["Roughness"], rough)
    set_input(b, ["Metallic"], metallic)
    if double_sided:
        mat.use_backface_culling = False
    return mat


# ================================================================ 1. MODEL
@step("model")
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(P["seed"])
    kind = P["kind"]

    bark = principled(bpy.data.materials.new("Bark"), (0.14, 0.10, 0.06), 0.85)
    leaf = principled(bpy.data.materials.new("Leaf"), (0.075, 0.20, 0.062), 0.55)
    grass_mat = principled(bpy.data.materials.new("Grass"), (0.11, 0.27, 0.09),
                           0.60, double_sided=True)

    parts = []          # (obj, material)

    def add(obj, mat):
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        parts.append(obj)
        return obj

    if kind in ("tree", "bush"):
        if kind == "tree":
            # ---- trunk: tapered, halka bend (4 segments)
            H = P["H"]
            segs, sides = 5, 8
            bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=1,
                                                depth=1, location=(0, 0, 0))
            tr = bpy.context.active_object
            tr.name = "Trunk"
            tr.scale = (P["trunk_r0"], P["trunk_r0"], H)
            bpy.ops.object.transform_apply(scale=True)
            m = tr.data
            taper0, taper1 = P["trunk_r0"], P["trunk_r1"]
            for v in m.vertices:
                t = (v.co.z + H / 2) / H          # 0 neeche..1 upar
                r = taper0 + (taper1 - taper0) * t
                v.co.x *= r / taper0
                v.co.y *= r / taper0
                v.co.x += 0.22 * math.sin(t * 2.1) * (1 - t)   # gentle S-bend
                v.co.y += 0.15 * math.cos(t * 1.7) * (1 - t)
            add(tr, bark)
            # ---- 2 low branches
            for bi, (ang, h0, ln) in enumerate(((0.8, 0.45, 1.1), (3.6, 0.58, 0.9))):
                bx = math.cos(ang) * 0.5 * h0 * P["trunk_r0"] * 4
                by = math.sin(ang) * 0.5 * h0 * P["trunk_r0"] * 4
                bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1,
                                                    depth=ln, location=(bx, by, h0 * H))
                br = bpy.context.active_object
                br.name = f"Branch{bi}"
                br.rotation_euler = (math.cos(ang) * 0.55, -math.sin(ang) * 0.55, 0)
                br.scale = (0.05, 0.05, 1)
                bpy.ops.object.transform_apply(rotation=True, scale=True)
                add(br, bark)
        # ---- canopy blobs (icospheres, jittered = organic silhouette)
        blobs = P["blobs"]
        sub = P.get("blob_sub", 2)
        if kind == "bush":
            cy, rx, ry, rz = P["H"] * 0.45, 0.55, 0.38, 0.62
        else:
            cy, rx, ry, rz = P["canopy_y"], P["canopy_rx"], P["canopy_ry"], P["canopy_rz"]
        for bi in range(blobs):
            a = rng.random() * math.tau
            rad = rng.random() ** 0.6
            off = (math.cos(a) * rad * rx * 0.8,
                   math.sin(a) * rad * rz * 0.8,
                    cy + (rng.random() - 0.45) * ry * 0.9)
            br_ = rx * (0.42 + 0.20 * rng.random())
            bpy.ops.mesh.primitive_icosphere_add(subdivisions=sub, radius=br_,
                                                 location=off)
            blob = bpy.context.active_object
            blob.name = f"Canopy{bi}"
            blob.scale = (1.0, 1.25, 0.85)
            bpy.ops.object.transform_apply(scale=True)
            for v in blob.data.vertices:
                v.co.x += 0.16 * br_ * math.sin(v.co.x * 5.1 + bi) * math.cos(v.co.y * 4.3)
                v.co.y += 0.12 * br_ * math.sin(v.co.y * 4.7 + bi * 1.3)
                v.co.z += 0.10 * br_ * math.sin(v.co.x * 3.7 + v.co.z * 5.9)
            add(blob, leaf)
    else:
        # ---- grass tuft: tapered blades, bent
        n = P["blades"]
        H = P["H"]
        for bi in range(n):
            a = (bi / n) * math.tau + rng.random() * 0.35
            rr = 0.02 + 0.07 * rng.random()
            w0 = 0.018 + 0.010 * rng.random()
            bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
            bl = bpy.context.active_object
            bl.name = f"Blade{bi}"
            m = bl.data
            # 2-quad strip: (0,0) (w,0) (0,H) (w,H) segments
            m.clear_geometry()
            pts = [((rr * math.cos(a)), (rr * math.sin(a)), 0.0),
                   (rr * math.cos(a) + w0 * math.cos(a + 1.57),
                    rr * math.sin(a) + w0 * math.sin(a + 1.57), 0.0)]
            m.from_pydata(
                [pts[0], pts[1],
                 (pts[1][0] * 0.7, pts[1][1] * 0.7, H * 0.55),
                 (pts[0][0] * 0.7, pts[0][1] * 0.7, H * 0.55),
                 ((pts[0][0] + pts[1][0]) * 0.30, (pts[0][1] + pts[1][1]) * 0.30, H)],
                [], [(0, 1, 2, 3), (3, 2, 4, 4)])
            add(bl, grass_mat)

    # join per material group -> final single object per asset
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = "Foliage"
    obj.data.validate()
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    globals()["FOL"] = obj
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return f"parts={len(parts)} tris~{tris}"


# ================================================================ 2. VERTEX COLOR
@step("vertex_color")
def vertex_color():
    """Realism without textures: bark gradient, leaf mottling, grass tip-bright."""
    rng = random.Random(P["seed"] + 7)
    obj = globals()["FOL"]
    m = obj.data
    col = m.attributes.new("shade", "BYTE_COLOR", "POINT")
    zs = [v.co.z for v in m.vertices]
    zmin, zmax = min(zs), max(zs)
    kind = P["kind"]
    for i, v in enumerate(m.vertices):
        t = (v.co.z - zmin) / max(1e-6, zmax - zmin)
        if kind == "grass":
            g = 0.35 + 0.75 * t            # dark base -> bright tip
        elif kind == "bush":
            g = 0.70 + 0.35 * t
        else:
            # canopy blobs: mottling (per-vertex noise, low freq) + bottom darker
            mot = 0.82 + 0.26 * math.sin(v.co.x * 2.3) * math.cos(v.co.y * 2.1)
            g = (0.55 + 0.5 * t) * mot
            if v.co.z < 0.4:               # trunk base ao
                g *= 0.6 + v.co.z
        g *= 0.96 + 0.08 * rng.random()
        g = max(0.25, min(1.0, g))
        col.data[i].color = (g, g, g, 1.0)
    return f"verts={len(m.vertices)}"


# ================================================================ 3. PREVIEW RENDER
@step("preview_render", required=False)
def preview():
    scene = bpy.context.scene
    obj = globals()["FOL"]
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    scene.cycles.samples = A["samples"]
    bpy.context.view_layer.cycles.use_denoising = True
    obj.rotation_euler = (math.radians(12), 0, math.radians(28))
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    d = max(6.0, P["H"] * 1.9)
    cam.location = (d * 0.8, -d, P["H"] * 0.62)
    cam.rotation_euler = (math.radians(72), 0, math.radians(38))
    cam_data.lens = 60
    scene.camera = cam
    # key + fill + rim (overcast-soft)
    for pos, e in (((6, -4, 9), 900), ((-8, -2, 5), 250), ((2, 6, 4), 200)):
        l = bpy.data.lights.new(f"L{e}", "AREA")
        l.energy = e
        l.size = 5
        lo = bpy.data.objects.new(f"L{e}", l)
        lo.location = pos
        scene.collection.objects.link(lo)
    bg = bpy.data.worlds.new("Bg")
    bg.use_nodes = True
    set_input(bg.node_tree.nodes["Background"], ["Color"], (0.62, 0.65, 0.70, 1.0))
    set_input(bg.node_tree.nodes["Background"], ["Strength"], 1.0)
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
    obj = globals()["FOL"]
    obj.rotation_euler = (0, 0, 0)
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


# ---------------------------------------------------------------- main
build()
vertex_color()
preview()
export_glb()

obj = globals()["FOL"]
R["verts"] = len(obj.data.vertices)
R["tris"] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

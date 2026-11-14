"""
VELARA Design Team — Job: "hero-v2" (player character, user-picked concept)
===========================================================================
v0.9.0: user ne character "boxy" bola + concept ref #2 pick kiya
(olive bomber jacket, charcoal tee, dark jeans, white sneakers, short black
hair, stubble). Ye job SMOOTH jointed humanoid banata hai:

  - koi box nahi — cylinders (16-24 seg) + UV spheres + subsurf sneakers
  - JOINT-PIVOT RIG: har limb object ka origin uske joint par
    (three.js mein limb.rotation se walk-cycle chalta hai):
      HeroRoot > Hips > Torso/Head, ArmL/R > ForeL/R > HandL/R
                 Hips > LegL/R > ShinL/R > FootL/R
  - bake-free (Cycles black-bake trap) — PBR principled values direct
  - GLB (three.js) + FBX (UE5 track) + studio/preview renders

    blender --background --python factory/jobs/make-hero-v2.py
Output: factory/out/hero-v2.glb / .fbx / _studio.png / _preview.png
Licence: CC0 (self-made)
"""
import json
import math
import os
import sys
import traceback

import bmesh
import bpy
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)
PRESET = "hero-v2"
GLB = os.path.join(OUT, f"{PRESET}.glb")
FBX = os.path.join(OUT, f"{PRESET}.fbx")
STUDIO_PNG = os.path.join(OUT, f"{PRESET}_studio.png")
PREVIEW_PNG = os.path.join(OUT, f"{PRESET}_preview.png")

R = {"job": PRESET, "steps": [], "tris": 0, "nodes": []}


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


def mat(name, hexcol, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes["Principled BSDF"]
    bs.inputs["Base Color"].default_value = (*[int(hexcol[i:i + 2], 16) / 255 for i in (0, 2, 4)], 1.0)
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    return m


M = {}


def mesh_edit(o, fn):
    """ops-free mesh surgery (headless-safe)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    fn(bm)
    bm.to_mesh(o.data)
    bm.free()


def add_cyl(name, r_top, r_bot, h, loc, m, seg=20, cap=True):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=seg, radius=r_top, depth=h, location=(0, 0, 0),
        end_fill_type='NGON' if cap else 'NOTHING')
    o = bpy.context.active_object
    o.name = name
    if abs(r_top - r_bot) > 1e-4:
        k = r_bot / r_top
        mesh_edit(o, lambda bm: [setattr(v.co, 'x', v.co.x * k) or
                                 setattr(v.co, 'y', v.co.y * k)
                                 for v in bm.verts if v.co.z < -h / 2 + 1e-3])
    o.data.materials.append(m)
    o.location = loc
    return o


def add_sphere(name, r, loc, m, seg=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
                                         radius=r, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(m)
    o.location = loc
    return o


def hang_below(o, drop):
    """geometry ko origin ke niche latakao (joint origin)."""
    mesh_edit(o, lambda bm: [setattr(v.co, 'z', v.co.z - drop) for v in bm.verts])


def parent(child, parent_obj):
    child.parent = parent_obj
    child.matrix_parent_inverse = parent_obj.matrix_world.inverted()


@step("materials")
def build_materials():
    M.update(
        jacket=mat("JacketOlive", "4a5236", rough=0.88),
        jacket_dark=mat("JacketOliveDark", "3a4129", rough=0.9),
        tee=mat("TeeCharcoal", "2b2d31", rough=0.92),
        jeans=mat("JeansIndigo", "232733", rough=0.95),
        belt=mat("BeltBlack", "17181c", rough=0.6),
        shoe=mat("SneakerWhite", "e8e6e0", rough=0.5),
        sole=mat("SoleRubber", "c9c4b8", rough=0.8),
        skin=mat("Skin", "b5876a", rough=0.62),
        hair=mat("HairBlack", "181614", rough=0.45),
        eye=mat("EyeDark", "0d0d10", rough=0.25),
        stubble=mat("Stubble", "6d5240", rough=0.8),
        zipper=mat("Zipper", "8f8f96", rough=0.35, metal=0.8),
    )
    return f"{len(M)} PBR materials"


@step("reset_scene")
def reset_scene():
    # IMPORTANT: fresh scene PEHLE — materials iske BAAD bante hain (warna
    # read_factory_settings sab data-blocks wipe kar deta hai → dead RNA).
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return "fresh scene"


@step("rig+mesh")
def build_body():
    root = bpy.data.objects.new("HeroRoot", None)
    root.empty_display_size = 0.1
    bpy.context.collection.objects.link(root)
    hips = bpy.data.objects.new("Hips", None)
    hips.empty_display_size = 0.08
    hips.location = (0, 0, 1.00)
    bpy.context.collection.objects.link(hips)
    parent(hips, root)

    # ---- TORSO (jacket)
    torso = add_cyl("Torso", 0.185, 0.16, 0.58, (0, 0, 1.30), M["jacket"], seg=24)
    torso.scale = (1.0, 0.78, 1.0)
    parent(torso, hips)
    hem = add_cyl("Hem", 0.172, 0.172, 0.09, (0, 0, 1.07), M["jacket_dark"], seg=24)
    parent(hem, hips)
    zip_ = add_cyl("Zipper", 0.008, 0.008, 0.5, (0, 0.145, 1.31), M["zipper"], seg=8)
    parent(zip_, hips)
    collar = add_cyl("Collar", 0.105, 0.115, 0.07, (0, 0, 1.62), M["jacket_dark"], seg=20)
    parent(collar, hips)
    tee = add_cyl("TeePanel", 0.15, 0.14, 0.16, (0, 0.02, 1.56), M["tee"], seg=20)
    parent(tee, hips)
    for s, nm in ((1, "ShoulderL"), (-1, "ShoulderR")):
        sh = add_sphere(nm, 0.075, (0.21 * s, 0, 1.55), M["jacket"], seg=16, rings=12)
        parent(sh, hips)
    belt = add_cyl("Belt", 0.172, 0.172, 0.045, (0, 0, 1.02), M["belt"], seg=24)
    parent(belt, hips)

    # ---- HEAD (origin neck ke paas hips-space me)
    head = add_sphere("Head", 0.115, (0, 0, 1.755), M["skin"], seg=24, rings=18)
    head.scale = (0.92, 0.98, 1.12)
    parent(head, hips)
    hair = add_sphere("Hair", 0.121, (0, 0.004, 1.782), M["hair"], seg=20, rings=14)
    hair.scale = (0.94, 1.0, 1.0)
    parent(hair, hips)
    for s, nm in ((1, "EyeL"), (-1, "EyeR")):
        e = add_sphere(nm, 0.014, (0.041 * s, 0.104, 1.77), M["eye"], seg=10, rings=8)
        parent(e, hips)
    for s, nm in ((1, "BrowL"), (-1, "BrowR")):
        b = add_cyl(nm, 0.006, 0.006, 0.045, (0.043 * s, 0.106, 1.792), M["hair"], seg=6)
        b.rotation_euler = (0, 0, math.radians(80))
        parent(b, hips)
    st = add_cyl("Stubble", 0.104, 0.096, 0.05, (0, 0.008, 1.70), M["stubble"], seg=20)
    parent(st, hips)
    nose = add_sphere("Nose", 0.016, (0, 0.112, 1.752), M["skin"], seg=10, rings=8)
    nose.scale = (0.7, 1.1, 1.0)
    parent(nose, hips)

    # ---- ARMS: Arm(shoulder pivot) > Fore(elbow) > Hand
    for s, L in ((1, "L"), (-1, "R")):
        sx = 0.21 * s
        arm = add_cyl(f"Arm{L}", 0.052, 0.047, 0.30, (sx, 0, 1.55), M["jacket"], seg=16)
        hang_below(arm, 0.15)
        parent(arm, hips)
        elb = add_sphere(f"Elbow{L}", 0.045, (sx, 0, 1.25), M["jacket"], seg=12, rings=10)
        parent(elb, arm)
        fore = add_cyl(f"Fore{L}", 0.044, 0.038, 0.27, (sx, 0, 1.25), M["skin"], seg=16)
        hang_below(fore, 0.135)
        parent(fore, arm)
        hand = add_sphere(f"Hand{L}", 0.042, (sx, 0, 0.99), M["skin"], seg=12, rings=10)
        hand.scale = (0.85, 1.0, 1.15)
        parent(hand, fore)
        cuff = add_cyl(f"Cuff{L}", 0.049, 0.049, 0.05, (sx, 0, 1.27), M["jacket_dark"], seg=14)
        parent(cuff, fore)

    # ---- LEGS: Leg(hip pivot 0.96) > Shin(knee) > Foot(ankle)
    for s, L in ((1, "L"), (-1, "R")):
        sx = 0.105 * s
        leg = add_cyl(f"Leg{L}", 0.083, 0.070, 0.44, (sx, 0, 0.96), M["jeans"], seg=18)
        hang_below(leg, 0.22)
        parent(leg, hips)
        knee = add_sphere(f"Knee{L}", 0.066, (sx, 0, 0.52), M["jeans"], seg=12, rings=10)
        parent(knee, leg)
        shin = add_cyl(f"Shin{L}", 0.066, 0.052, 0.42, (sx, 0, 0.52), M["jeans"], seg=18)
        hang_below(shin, 0.21)
        parent(shin, leg)
        # sneaker (subsurf cube = smooth rounded)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, 0.02, 0.065))
        foot = bpy.context.active_object
        foot.name = f"Foot{L}"
        foot.scale = (0.085, 0.26, 0.075)
        bpy.ops.object.modifier_add(type='SUBSURF')
        foot.modifiers["Subdivision"].levels = 3
        bpy.ops.object.shade_smooth()
        foot.data.materials.append(M["shoe"])
        parent(foot, shin)
        sole = add_cyl(f"Sole{L}", 0.083, 0.083, 0.035, (sx, 0.025, 0.028), M["sole"], seg=16)
        sole.scale = (1.0, 1.55, 1.0)
        parent(sole, shin)

    R["nodes"] = [o.name for o in bpy.data.objects]
    return f"{len(R['nodes'])} nodes (joint-pivot rig)"


@step("pose")
def pose():
    bpy.data.objects["ArmL"].rotation_euler = (0.18, 0, 0.10)
    bpy.data.objects["ArmR"].rotation_euler = (0.18, 0, -0.10)
    bpy.data.objects["ForeL"].rotation_euler = (-0.35, 0, 0)
    bpy.data.objects["ForeR"].rotation_euler = (-0.35, 0, 0)
    return "A-pose relaxed"


@step("tris")
def count_tris():
    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    R["tris"] = tris
    assert 1500 < tris < 16000, f"tri budget fail: {tris}"
    return f"{tris} base tris"


def _cam_look(cam, target):
    direction = mathutils.Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


@step("render_studio")
def render_studio():
    bpy.ops.object.light_add(type='SUN', location=(3, -4, 6))
    sun = bpy.context.active_object
    sun.name = "Sun"
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(55), math.radians(15), math.radians(-30))
    bpy.ops.object.light_add(type='AREA', location=(-3, -2, 2))
    fill = bpy.context.active_object
    fill.name = "Fill"
    fill.data.energy = 200
    fill.data.size = 4
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.045, 0.05, 0.065, 1)
    bpy.context.scene.world = w
    cam_data = bpy.data.cameras.new("Cam")
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.6, -2.4, 1.55)
    cam_data.lens = 60
    _cam_look(cam, (0, 0, 1.05))
    sc = bpy.context.scene
    sc.render.resolution_x = 768
    sc.render.resolution_y = 1024
    sc.render.filepath = STUDIO_PNG
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    bpy.ops.render.render(write_still=True)
    return STUDIO_PNG


@step("render_preview")
def render_preview():
    for o in bpy.context.scene.objects:
        if o.type == 'LIGHT' and o.name == "Sun":
            o.data.energy = 4.5
            o.rotation_euler = (math.radians(12), math.radians(35), math.radians(115))
    cam = bpy.context.scene.camera
    cam.location = (1.9, -3.2, 1.3)
    _cam_look(cam, (0, 0, 1.1))
    sc = bpy.context.scene
    sc.render.filepath = PREVIEW_PNG
    sc.cycles.samples = 32
    bpy.ops.render.render(write_still=True)
    return PREVIEW_PNG


@step("export")
def export():
    bpy.ops.object.select_all(action='SELECT')   # empties bhi — rig hierarchy
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=True,
        export_apply=False, export_yup=True)
    bpy.ops.export_scene.fbx(
        filepath=FBX, use_selection=True, apply_scale_options='FBX_SCALE_ALL')
    return f"{os.path.getsize(GLB)}B glb + {os.path.getsize(FBX)}B fbx"


reset_scene()
build_materials()
build_body()
pose()
count_tris()
render_studio()
render_preview()
export()

json.dump(R, open(os.path.join(OUT, f"{PRESET}_result.json"), "w"), indent=1)
print("HERO_V2_DONE " + json.dumps({"tris": R["tris"], "nodes": len(R["nodes"])}))

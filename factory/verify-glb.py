"""
VELARA Asset Factory — GLB round-trip verifier.
    blender --background --python factory/verify-glb.py -- factory/out/streetlamp.glb
Export kiye hue GLB ko wapas Blender mein import karke stats print karta hai
(valid GLB + sane mesh/material count = pipeline proof).
"""
import json
import os
import sys

import bpy

argv = sys.argv
path = argv[argv.index("--") + 1] if "--" in argv else argv[-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

objs = [o for o in bpy.data.objects if o.type == "MESH"]
tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
mats = sorted({m.name for o in objs for m in o.data.materials if m})

print("VERIFY_JSON " + json.dumps({
    "file": os.path.basename(path),
    "objects": len(objs),
    "verts": sum(len(o.data.vertices) for o in objs),
    "tris": tris,
    "materials": mats,
    "size_bytes": os.path.getsize(path),
}), flush=True)

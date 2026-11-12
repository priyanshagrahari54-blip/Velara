"""
VELARA 3D ARTIST (image->3D) — TripoSR worker script (CPU-safe)
================================================================
User demand: "image jaisa nahi hai" — ye script IMAGE se asli 3D shape banati hai
(TripoSR AI, vertex-colors ke saath — image ke rang mesh par hi paint hote hain).
    python3 factory/jobs/make-img23d.py -- <image_key_or_url> <out_name> [mc_res]
Output: factory/out/<out_name>.glb (+ _preview.png)   Licence: CC0 (AI self-made)
"""
import json
import os
import sys
import types
import urllib.request

import numpy as np


def _patch_torchmcubes():
    """torchmcubes CUDA-compile hota hai (CPU runner pe fail) — PyMCubes se shim."""
    try:
        import torchmcubes  # noqa: F401
        return
    except ImportError:
        pass
    import torch
    from mcubes import marching_cubes as _pmc

    tm = types.ModuleType("torchmcubes")

    def marching_cubes(vert_values, iso_value=0.0):
        v = vert_values.detach().cpu().numpy().astype(np.float32)
        verts, faces = _pmc(v, float(iso_value))
        return (torch.from_numpy(verts.astype(np.float32)),
                torch.from_numpy(faces.astype(np.int64)))

    tm.marching_cubes = marching_cubes
    sys.modules["torchmcubes"] = tm


_patch_torchmcubes()

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out"))
os.makedirs(OUT, exist_ok=True)

RAW = "https://raw.githubusercontent.com/priyanshagrahari54-blip/Velara/main/factory/in/concepts/"
IMAGE_MAP = {
    "bike": RAW + "bike.jpg",
    "police": RAW + "police.jpg",
    "bus": RAW + "bus.jpg",
    "cafe-racer": RAW + "superbike-black.jpg",
}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC = argv[0] if argv else "police"
NAME = argv[1] if len(argv) > 1 else ("img23d-" + SRC)
MC_RES = int(argv[2]) if len(argv) > 2 else 196
URL = IMAGE_MAP.get(SRC, SRC if SRC.startswith("http") else RAW + SRC)

GLB = os.path.join(OUT, f"{NAME}.glb")
PNG = os.path.join(OUT, f"{NAME}_preview.png")
R = {"job": f"img23d-{NAME}", "steps": [], "cfg": {"src": SRC, "name": NAME, "mc_res": MC_RES}}


def step(name, required=True):
    def wrap(fn):
        def run():
            try:
                detail = fn() or ""
                R["steps"].append({"step": name, "ok": True, "detail": str(detail)})
                print(f"[OK] {name} {detail}", flush=True)
                return True
            except Exception as e:
                import traceback
                traceback.print_exc()
                R["steps"].append({"step": name, "ok": False, "error": str(e)})
                print(f"[FAIL] {name} — {e}", flush=True)
                if required:
                    raise
                return False
        return run
    return wrap


@step("fetch_image")
def fetch():
    urllib.request.urlretrieve(URL, "/tmp/img23d_in.png")
    return f"{URL} -> /tmp/img23d_in.png ({os.path.getsize('/tmp/img23d_in.png')//1024}KB)"


@step("load_model")
def load():
    import torch
    if os.path.isdir("/tmp/TripoSR") and "/tmp/TripoSR" not in sys.path:
        sys.path.insert(0, "/tmp/TripoSR")
    from tsr.system import TSR
    R["device"] = "cpu"
    m = TSR.from_pretrained("stabilityai/TripoSR",
                            config_name="config.yaml", weight_name="model.ckpt")
    m.renderer.set_chunk_size(4096)          # CPU: chhota chunk = kam RAM
    m.to("cpu")
    globals()["MODEL"] = m
    return "TripoSR on CPU ready"


@step("reconstruct")
def recon():
    import torch
    from PIL import Image
    from tsr.utils import remove_background, resize_foreground
    import rembg

    img = Image.open("/tmp/img23d_in.png").convert("RGB")
    img = remove_background(img, rembg.new_session())
    img = resize_foreground(img, 0.9)
    a = np.asarray(img).astype(np.float32) / 255.0
    a = a[:, :, :3] * a[:, :, 3:4] + (1 - a[:, :, 3:4]) * 0.5
    img = Image.fromarray((a * 255).astype(np.uint8))
    img.save("/tmp/img23d_clean.png")

    m = globals()["MODEL"]
    with torch.no_grad():
        codes = m([img], device="cpu")
    globals()["CODES"] = codes
    return "scene codes ready"


@step("extract_mesh")
def extract():
    m = globals()["MODEL"]
    mesh = m.extract_mesh(globals()["CODES"], has_vertex_color=True,
                          resolution=MC_RES)[0]
    globals()["MESH"] = mesh
    return f"verts={len(mesh.vertices)} faces={len(mesh.faces)} + vertex colors"


@step("decimate")
def decimate():
    mesh = globals()["MESH"]
    if len(mesh.faces) > 25000:
        try:
            import fast_simplification
            v, f = fast_simplification.simplify(mesh.vertices, mesh.faces,
                                                target_count=25000)
            import trimesh
            colors = mesh.visual.vertex_colors
            mesh2 = trimesh.Trimesh(v, f, process=False)
            # vertices préservé nahi hote — nearest-color re-map (sasta)
            try:
                from scipy.spatial import cKDTree
                idx = cKDTree(mesh.vertices).query(mesh2.vertices)[1]
                mesh2.visual.vertex_colors = colors[idx]
            except Exception:
                pass
            globals()["MESH"] = mesh2
            return f"{len(mesh.faces)} -> {len(mesh2.faces)} faces"
        except Exception as e:
            return f"decimation skip ({e}) — full mesh rakhi"
    return "already <=25k faces"


@step("preview_render", required=False)
def preview():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    mesh = globals()["MESH"]
    v, f = mesh.vertices, mesh.faces
    try:
        cols = (mesh.visual.vertex_colors[:, :3] / 255.0)[f].mean(axis=1)
    except Exception:
        cols = None
    fig = plt.figure(figsize=(8, 8), facecolor="#0a0e16")
    ax = fig.add_subplot(111, projection="3d", facecolor="#0a0e16")
    pc = Poly3DCollection(v[f], facecolors=np.clip(cols, 0, 1) if cols is not None else "viridis",
                          edgecolor="none")
    ax.add_collection3d(pc)
    ax.set_xlim(v[:, 0].min(), v[:, 0].max())
    ax.set_ylim(v[:, 1].min(), v[:, 1].max())
    ax.set_zlim(v[:, 2].min(), v[:, 2].max())
    ax.set_axis_off()
    ax.view_init(elev=12, azim=-60)
    plt.tight_layout()
    plt.savefig(PNG, dpi=110)
    return PNG


@step("glb_export")
def export():
    mesh = globals()["MESH"]
    mesh.export(GLB)
    sz = os.path.getsize(GLB)
    if sz > 3_000_000:
        return f"WARN: {sz} bytes — bada hai, DM review karega"
    return f"{sz} bytes"


fetch()
load()
recon()
extract()
decimate()
preview()
export()
R["glb_bytes"] = os.path.getsize(GLB)
R["glb"] = GLB
print("JOB_RESULT " + json.dumps(R), flush=True)

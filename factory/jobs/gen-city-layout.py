#!/usr/bin/env python3
"""
VELARA city-layout generator (UE-track) — three.js city ke rules par
based, FRESH deterministic seed. Output: ue5/Content/Data/city_layout.json
CityBuilder (UE C++) isse InstancedStaticMesh spawn karta hai.

Rules (mixed-city Style B):
  - GRID 7x7 blocks, BLOCK 36, ROAD 16, CELL 52, EXTENT 190
  - core (1..5): towers center ke paas, midrise ring, shops street-facing
  - h >= 30 -> tower | 14..30 -> midrise | < 14 -> shop
  - 3 enterable shops plaza ke teeno taraf (AABB lot-skip)
  - street kit: signs corners, hydrants/meters/benches/drains edges
"""
import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "ue5", "Content", "Data",
                                    "city_layout.json"))
os.makedirs(os.path.dirname(OUT), exist_ok=True)

GRID, BLOCK, ROAD = 7, 36, 16
CELL = BLOCK + ROAD
EXTENT = (GRID * BLOCK + (GRID + 1) * ROAD) / 2

rng = random.Random(0x5EED0606)   # UE-track fresh seed


def rand(a, b):
    return a + rng.random() * (b - a)


def face_outward(cx, cz):
    dx = cx - round(cx / CELL) * CELL
    dz = cz - round(cz / CELL) * CELL
    if abs(dx) > abs(dz):
        return math.pi / 2 if dx > 0 else -math.pi / 2
    return 0.0 if dz > 0 else math.pi


enterable = [
    {"kind": "shop-enterable", "x": -50.0, "z": 0.0, "ry": math.pi / 2},
    {"kind": "shop-enterable", "x": 42.0, "z": -6.0, "ry": -math.pi / 2},
    {"kind": "shop-enterable", "x": -8.0, "z": -50.0, "ry": 0.0},
]
doors = []
aabb = []
for e in enterable:
    c = math.cos(e["ry"])
    rot = abs(c) < 0.5
    hx = (6 if rot else 8) + 1.2
    hz = (8 if rot else 6) + 1.2
    aabb.append({"minX": e["x"] - hx, "maxX": e["x"] + hx,
                 "minZ": e["z"] - hz, "maxZ": e["z"] + hz})
    doors.append({"x": e["x"] + 6.5 * math.sin(e["ry"]),
                  "z": e["z"] + 6.5 * math.cos(e["ry"])})


def near_door(x, z, r=5.5):
    return any(math.hypot(x - d["x"], z - d["z"]) < r for d in doors)


buildings = list(enterable)
props = []

for bx in range(GRID):
    for bz in range(GRID):
        ox = -EXTENT + ROAD + bx * CELL
        oz = -EXTENT + ROAD + bz * CELL
        cx, cz = ox + BLOCK / 2, oz + BLOCK / 2
        is_core = 1 <= bx <= 5 and 1 <= bz <= 5
        is_special = (bx == 3 and bz == 3) or (bx == 5 and bz == 3)  # plazas

        E = BLOCK / 2 - 0.9

        # ---- lots
        if is_special:
            pass  # plaza/stunt blocks khali
        elif is_core:
            cols = 1 if rng.random() < 0.5 else 2
            rows = 1 if rng.random() < 0.5 else 2
            lw = (BLOCK - 6) / cols
            ld = (BLOCK - 6) / rows
            dist_c = math.hypot(bx - 3, bz - 3) / 3.6
            for i in range(cols):
                for j in range(rows):
                    inset = rand(2.5, 5)
                    w = lw - inset
                    d = ld - inset
                    low = rng.random() < 0.16
                    h = rand(7, 13) if low else rand(18, 34) + max(0, 1 - dist_c) * rand(16, 50)
                    lx = ox + 3 + lw * (i + 0.5)
                    lz = oz + 3 + ld * (j + 0.5)
                    if any(a["minX"] - 9 < lx < a["maxX"] + 9 and a["minZ"] - 9 < lz < a["maxZ"] + 9 for a in aabb):
                        continue
                    if h >= 30:
                        kind = "tower-glass"
                        sy = max(0.85, min(1.5, h / 42))
                        sxz = max(0.72, min(1.15, min(w, d) / 16))
                    elif h >= 14:
                        kind = "midrise-concrete"
                        sy = max(0.8, min(1.4, h / 22))
                        sxz = max(0.68, min(1.05, min(w / 18, d / 14)))
                    else:
                        kind = "shop-low"
                        sy = max(0.9, min(1.25, h / 7))
                        sxz = max(0.62, min(0.92, min(w / 16, d / 12)))
                    buildings.append({"kind": kind, "x": round(lx, 2), "z": round(lz, 2),
                                      "ry": round(face_outward(lx, lz), 4),
                                      "sxz": round(sxz, 3), "sy": round(sy, 3)})
        else:
            # ring districts
            if (bz == 0 and bx <= 3) or (bx == 0 and bz <= 2):
                for i in range(2):
                    for j in range(2):
                        lx = ox + 3 + 15 * (i + 0.5)
                        lz = oz + 3 + 15 * (j + 0.5)
                        h = rand(7.5, 12)
                        buildings.append({"kind": "shop-low", "x": round(lx, 2), "z": round(lz, 2),
                                          "ry": round(face_outward(lx, lz), 4),
                                          "sxz": round(rand(0.68, 0.8), 3),
                                          "sy": round(max(0.9, min(1.25, h / 7)), 3)})
            elif bz == GRID - 1:
                for (px, pz, kind, hbase) in ((cx - 8, cz, "midrise-concrete", 22),
                                              (cx + 9, cz + 4, "shop-low", 9)):
                    if kind == "midrise-concrete":
                        buildings.append({"kind": kind, "x": round(px, 2), "z": round(pz, 2),
                                          "ry": round(face_outward(px, pz), 4), "sxz": 0.95, "sy": 1.0})
                    else:
                        buildings.append({"kind": kind, "x": round(px, 2), "z": round(pz, 2),
                                          "ry": round(face_outward(px, pz), 4), "sxz": 0.8, "sy": 1.1})
            elif bx == GRID - 1:
                for (px, pz) in ((cx - 6, cz - 8), (cx + 4, cz + 10)):
                    buildings.append({"kind": "midrise-concrete", "x": round(px, 2), "z": round(pz, 2),
                                      "ry": round(face_outward(px, pz), 4),
                                      "sxz": round(rand(0.8, 1.0), 3),
                                      "sy": round(rand(0.85, 1.2), 3)})
            else:
                buildings.append({"kind": "tower-glass", "x": round(cx, 2), "z": round(cz, 2),
                                  "ry": round(rand(0, 6.283), 4),
                                  "sxz": round(rand(0.95, 1.15), 3),
                                  "sy": round(rand(0.9, 1.4), 3)})

        # ---- street kit (special blocks par sirf signs)
        def prop(kind, x, z, ry=0.0):
            if near_door(x, z):
                return
            props.append({"kind": kind, "x": round(x, 2), "z": round(z, 2), "ry": round(ry, 4)})

        prop("sign", cx - E, cz - E, rand(0, 6.283))
        prop("sign", cx + E, cz + E, rand(0, 6.283))
        if not is_special:
            if rng.random() < 0.85:
                prop("hydrant", cx, cz - E + 0.4)
            if rng.random() < 0.85:
                prop("hydrant", cx + E - 0.4, cz)
            if rng.random() < 0.75:
                prop("meter", cx - E + 0.6, cz + rand(-7, 7))
            if rng.random() < 0.6:
                prop("meter", cx + rand(-8, 8), cz - E + 0.6)
            if rng.random() < 0.65:
                prop("bench", cx + E - 0.7, cz + rand(-7, 7), math.pi / 2)
            if rng.random() < 0.5:
                prop("bench", cx + rand(-8, 8), cz + E - 0.7, 0.0)
            prop("drain", cx - E - 0.2, cz - E - 0.2)
            if rng.random() < 0.6:
                prop("drain", cx + E + 0.2, cz + E + 0.2, math.pi)

layout = {
    "version": "0.7.0-ue-alpha",
    "grid": GRID, "block": BLOCK, "road": ROAD, "cell": CELL, "extent": EXTENT,
    "playerSpawn": {"x": 0.0, "z": 6.0},
    "buildings": buildings,
    "props": props,
    "enterableDoors": [{"x": round(d["x"], 2), "z": round(d["z"], 2)} for d in doors],
}

with open(OUT, "w") as f:
    json.dump(layout, f, indent=1)

counts = {}
for b in buildings:
    counts[b["kind"]] = counts.get(b["kind"], 0) + 1
print("city_layout.json:", OUT)
print("buildings:", len(buildings), counts)
print("props:", len(props))

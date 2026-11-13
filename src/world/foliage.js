import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, BLOCK, ROAD, CELL, EXTENT } from './city.js';

// ---------------------------------------------------------------------------
// VELARA foliage — FULL GREEN CITY (user demand: "grass tree ye sab kuch nhi hai")
// Factory-designed GLBs (tree-street / tree-park / bush / grass-tuft) ko
// InstancedMesh se poore shehar mein bichhata hai. GLB na mile to chup-chaap
// skip (procedural city phir bhi khadi hai) — kabhi crash nahi.
// ---------------------------------------------------------------------------

let _loader = null;
function foliageLoader() {
  if (!_loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('draco/');
    _loader = new GLTFLoader();
    _loader.setDRACOLoader(draco);
  }
  return _loader;
}

const SOURCES = {
  street: 'assets/props/tree-street.glb',
  park: 'assets/props/tree-park.glb',
  bush: 'assets/props/bush.glb',
  tuft: 'assets/props/grass-tuft.glb',
};

const SIDEWALK_Y = 0.185;   // city sidewalk platform ka top (0.36/2 + epsilon)

export function createFoliage(scene, opts = {}) {
  const lowTier = !!opts.lowTier;

  // ---------------- deterministic scatter plan ----------------
  let seed = 20261113;
  const srand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const plan = { street: [], park: [], bush: [], tuft: [] };
  const lawns = [];          // {x, z, w, d} — riverside green belt + plaza edge

  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const ox = -EXTENT + ROAD + bx * CELL;
      const oz = -EXTENT + ROAD + bz * CELL;
      const cx = ox + BLOCK / 2, cz = oz + BLOCK / 2;
      const isCore = bx >= 1 && bx <= 5 && bz >= 1 && bz <= 5;
      const isSpecial = (bx === 3 && bz === 3) || (bx === 5 && bz === 3); // plaza/stunt

      if (isSpecial) {
        // central plaza: char corner tuft-clusters (spawn area clear rakhta hai)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = cx + sx * (BLOCK / 2 - 3.2), pz = cz + sz * (BLOCK / 2 - 3.2);
          for (let k = 0; k < 4; k++) {
            plan.tuft.push({ x: px + (srand() - 0.5) * 2.6, z: pz + (srand() - 0.5) * 2.6,
              ry: srand() * 6.283, s: 0.9 + srand() * 0.5 });
          }
        }
        continue;
      }

      // sidewalk perimeter trees — core blocks 2 edges, ring blocks charo
      const edges = isCore ? (srand() < 0.5 ? [0, 1] : [2, 3]) : [0, 1, 2, 3];
      const inset = 1.7;
      for (const e of edges) {
        for (let t = -BLOCK / 2 + 4.5; t <= BLOCK / 2 - 4; t += 8.5 + srand() * 2.5) {
          let x, z;
          if (e === 0) { x = cx + t; z = cz - BLOCK / 2 + inset; }
          else if (e === 1) { x = cx + t; z = cz + BLOCK / 2 - inset; }
          else if (e === 2) { x = cx - BLOCK / 2 + inset; z = cz + t; }
          else { x = cx + BLOCK / 2 - inset; z = cz + t; }
          plan.street.push({ x, z, ry: srand() * 6.283, s: 0.85 + srand() * 0.3 });
          if (srand() < 0.4) {
            plan.bush.push({ x: x + (srand() - 0.5) * 2.6, z: z + (srand() - 0.5) * 2.6,
              ry: srand() * 6.283, s: 0.8 + srand() * 0.5 });
          }
          if (srand() < 0.65) {
            plan.tuft.push({ x: x + (srand() - 0.5) * 3.2, z: z + (srand() - 0.5) * 3.2,
              ry: srand() * 6.283, s: 0.9 + srand() * 0.5 });
          }
        }
      }

      // RIVERSIDE = green belt: park trees + lawn + tuft clusters
      if (bz === GRID - 1) {
        lawns.push({ x: cx, z: cz, w: BLOCK - 4, d: BLOCK - 4 });
        for (let k = 0; k < 3; k++) {
          plan.park.push({ x: ox + 5 + srand() * (BLOCK - 10), z: oz + 4 + srand() * (BLOCK - 8),
            ry: srand() * 6.283, s: 0.9 + srand() * 0.35 });
        }
        for (let k = 0; k < 8; k++) {
          plan.tuft.push({ x: ox + 3 + srand() * (BLOCK - 6), z: oz + 3 + srand() * (BLOCK - 6),
            ry: srand() * 6.283, s: 1.0 + srand() * 0.6 });
        }
      }
    }
  }

  // ---------------- lawns (simple green planes, tufts upar se) ----------------
  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x3a6b33, roughness: 0.95 });
  for (const L of lawns) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.d), lawnMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(L.x, SIDEWALK_Y + 0.004, L.z);
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---------------- GLB -> InstancedMesh ----------------
  const place = (inst, list) => {
    const M = new THREE.Matrix4();
    const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    const n = lowTier ? Math.floor(list.length / 2) : list.length;   // emergency: aadhi density
    for (let i = 0; i < n; i++) {
      const t = list[i];
      P.set(t.x, SIDEWALK_Y, t.z);
      Q.setFromAxisAngle(UP, t.ry);
      S.setScalar(t.s);
      M.compose(P, Q, S);
      inst.setMatrixAt(i, M);
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;      // instances poore shehar mein phaile hain
  };

  const shadows = !lowTier;
  const build = (key) => new Promise((resolve) => {
    const list = plan[key];
    if (!list.length) return resolve(null);
    foliageLoader().load(SOURCES[key], (gltf) => {
      // GLB mein trunk/canopy ALAG meshes hote hain (per-material primitives)
      // — sab ko groups ke saath merge karo, warna sirf pehla part instanced hota.
      const geos = [];
      const mats = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        geos.push(g);
        mats.push(...(Array.isArray(o.material) ? o.material : [o.material]));
      });
      if (!geos.length) return resolve(null);
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, true);
      if (!geo) return resolve(null);
      const inst = new THREE.InstancedMesh(geo, mats, list.length);
      inst.castShadow = shadows && key !== 'tuft';
      inst.receiveShadow = true;
      place(inst, list);
      scene.add(inst);
      resolve(inst);
    }, undefined, () => resolve(null));   // load fail = silent skip
  });

  build('street');
  build('park');
  build('bush');
  build('tuft');

  return {
    counts: {
      street: plan.street.length, park: plan.park.length,
      bush: plan.bush.length, tuft: plan.tuft.length, lawns: lawns.length,
    },
  };
}

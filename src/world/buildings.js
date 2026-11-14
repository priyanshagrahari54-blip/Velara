import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---------------------------------------------------------------------------
// VELARA mixed-city kit loader (v0.6.0 REMASTER — Style B)
// Factory-designed bake-free GLBs: 4 building types + street micro-detail.
//
// LOAD-TIME MATERIAL CONSOLIDATION (60fps mission / g560 draws-budget):
// har GLB part ka base-color vertex-color mein bake hota hai aur sab parts
// sirf 3 shared materials use karte hain —
//   KitStd  (opaque, vertexColors)   — concrete/trim/wood/red/...
//   KitGlass(shiny dark, vertexColors) — tower glass / shopfront glass
//   KitGlow (emissive warm, env.windowGlow se raat mein intensity)
// Isse per-chunk bucket-merge sirf 3 draw-call tiers karta hai (20+ nahi).
// ---------------------------------------------------------------------------

let _loader = null;
function kitLoader() {
  if (!_loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('draco/');
    _loader = new GLTFLoader();
    _loader.setDRACOLoader(draco);
  }
  return _loader;
}

const SRC = {
  tower: 'assets/buildings/tower-glass.glb',
  midrise: 'assets/buildings/midrise-concrete.glb',
  shop: 'assets/buildings/shop-low.glb',
  shopIn: 'assets/buildings/shop-enterable.glb',
  hydrant: 'assets/props/hydrant.glb',
  drain: 'assets/props/drain.glb',
  bench: 'assets/props/bench.glb',
  meter: 'assets/props/meter.glb',
  sign: 'assets/props/sign.glb',
};

// shared kit materials (sab instances me ek hi — bucket-merge friendly)
function makeKitMaterials() {
  const std = new THREE.MeshStandardMaterial({
    name: 'KitStd', vertexColors: true, roughness: 0.82, metalness: 0.18,
  });
  const glass = new THREE.MeshStandardMaterial({
    name: 'KitGlass', vertexColors: true, roughness: 0.15, metalness: 0.85,
  });
  const glow = new THREE.MeshStandardMaterial({
    name: 'KitGlow', vertexColors: true, color: 0x141210,
    emissive: 0xffe9c4, emissiveIntensity: 3.0, roughness: 0.4,
  });
  glow.userData._glowBase = 3.0;   // city.js env.windowGlow hook base
  return { std, glass, glow };
}

// GLTF material -> kit material class
function kitClassFor(mat) {
  if (mat && mat.emissive && mat.emissive.getHex() !== 0x000000) return 'glow';
  const n = (mat && mat.name || '').toLowerCase();
  if (n === 'glass' || n === 'shopglass') return 'glass';
  return 'std';
}

// material ka base-color existing vertex-AO (COLOR_0) mein bake karo
function bakeVertexColors(geometry, mat) {
  const base = mat && mat.color ? mat.color : new THREE.Color(0xffffff);
  const pos = geometry.attributes.position;
  const n = pos.count;
  const out = new Float32Array(n * 3);
  const prev = geometry.getAttribute('color') || geometry.getAttribute('COLOR_0');
  for (let i = 0; i < n; i++) {
    const r = prev ? prev.getX(i) : 1;
    const g = prev ? prev.getY(i) : 1;
    const b = prev ? prev.getZ(i) : 1;
    out[i * 3] = r * base.r;
    out[i * 3 + 1] = g * base.g;
    out[i * 3 + 2] = b * base.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
  if (geometry.getAttribute('COLOR_0')) geometry.deleteAttribute('COLOR_0');
}

export async function loadBuildingKit() {
  const kit = { glowMats: [] };
  const MATS = makeKitMaterials();
  kit.glowMats.push(MATS.glow);

  const entries = await Promise.all(Object.entries(SRC).map(async ([name, url]) => {
    try {
      const gltf = await kitLoader().loadAsync(url);
      const parts = [];
      gltf.scene.updateMatrixWorld(true);
      const inv = gltf.scene.matrixWorld.clone().invert();
      gltf.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        // local matrix (root ke relative) — city.js placement pre-multiply karega
        const matrix = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const src = Array.isArray(o.material) ? o.material[0] : o.material;
        const cls = kitClassFor(src);
        // geometry SHARED hai loader-cache me — clone karke bake karo
        const geo = o.geometry.clone();
        bakeVertexColors(geo, src);
        parts.push({ geometry: geo, material: MATS[cls], matrix, name: o.name || '', cls });
      });
      return [name, { parts }];
    } catch (e) {
      console.warn('[city] kit asset missing, fallback:', name, url);
      return [name, null];
    }
  }));

  for (const [n, v] of entries) kit[n] = v;
  kit.loaded = entries.filter(([, v]) => v).length;
  kit.mats = MATS;
  return kit;
}

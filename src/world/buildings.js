import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---------------------------------------------------------------------------
// VELARA mixed-city kit loader (v0.6.0 REMASTER — Style B)
// Factory-designed bake-free GLBs: 4 building types + street micro-detail.
// loadBuildingKit() ek hi baar sab 9 assets load karta hai (parallel) aur
// { parts:[{geometry, material, matrix, name}], glowMats } flat list deta hai
// — city.js unhe apne chunk-merge buckets mein place karta hai.
// Koi asset missing ho to chup-chaap null — procedural fallback city khadi.
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

export async function loadBuildingKit() {
  const kit = { glowMats: [] };

  // emissive materials (WinGlow / sign strips / interior lights) —
  // raat ko env.windowGlow se intensity chalti hai (city.js update hook)
  const trackGlow = (o) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && m.emissive && m.emissive.getHex() !== 0x000000 && !kit.glowMats.includes(m)) {
        m.userData._glowBase = m.emissiveIntensity;  // factory-baked base intensity
        kit.glowMats.push(m);
      }
    }
  };

  const entries = await Promise.all(Object.entries(SRC).map(async ([name, url]) => {
    try {
      const gltf = await kitLoader().loadAsync(url);
      const parts = [];
      gltf.scene.updateMatrixWorld(true);
      const inv = gltf.scene.matrixWorld.clone().invert();
      gltf.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        // local matrix (root ke relative) — placement city.js mein pre-multiply hota hai
        const matrix = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        parts.push({ geometry: o.geometry, material: o.material, matrix, name: o.name || '' });
        trackGlow(o);
      });
      return [name, { parts }];
    } catch (e) {
      console.warn('[city] kit asset missing, fallback:', name, url);
      return [name, null];
    }
  }));

  for (const [n, v] of entries) kit[n] = v;
  kit.loaded = entries.filter(([, v]) => v).length;
  return kit;
}

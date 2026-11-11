import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Renderer factory — owns WebGL context + post-processing chain.
// Engine module: NO gameplay/world logic here (see .claude/rules/engine.md)
// ---------------------------------------------------------------------------

export function createRenderer(container, { antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

/**
 * Post-processing chain: RenderPass -> UnrealBloom -> OutputPass.
 * Neon signs / headlights / wet-street reflections get a cinematic glow,
 * matching the approved art direction (design/02-ART-DIRECTION.md).
 * Returns null if WebGL2 features are unavailable (low tier renders direct).
 */
export function createPostFX(renderer, scene, camera) {
  try {
    const size = renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(size.clone(), 0.55, 0.75, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom };
  } catch (err) {
    console.warn('[renderer] post-processing unavailable:', err.message);
    return null;
  }
}

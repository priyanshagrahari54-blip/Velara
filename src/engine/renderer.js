import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
// CINEMATIC GRADE — AAA look: contrast, split-tone (cool shadows / warm
// highlights), saturation, vignette, halke film grain. Ultra-real feel,
// ek hi cheap full-screen pass mein.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // contrast + hint of lift
      c.rgb = (c.rgb - 0.5) * 1.065 + 0.503;
      // split-tone grade
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += (1.0 - lum) * vec3(-0.014, -0.007, 0.016);   // cool shadows
      c.rgb += lum * vec3(0.012, 0.005, -0.007);            // warm highlights
      // saturation
      c.rgb = mix(vec3(lum), c.rgb, 1.10);
      // vignette
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.58;
      // film grain (subtle, animated)
      float g = fract(sin(dot(vUv + fract(uTime * 0.37), vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * 0.012;
      gl_FragColor = c;
    }`,
};

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
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    return { composer, bloom, grade };
  } catch (err) {
    console.warn('[renderer] post-processing unavailable:', err.message);
    return null;
  }
}

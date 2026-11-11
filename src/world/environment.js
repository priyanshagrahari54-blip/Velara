import * as THREE from 'three';

// ---------------------------------------------------------------------------
// VELARA environment: sky dome, moon/sun, fog, stars, rain, time-of-day
// ---------------------------------------------------------------------------

const PRESETS = {
  night: {
    skyTop: 0x05070f, skyBottom: 0x0e1830,
    fogColor: 0x0a111e, fogDensity: 0.0040,
    sunColor: 0xbdd4ff, sunIntensity: 2.1, sunPos: [140, 240, 90],
    hemiSky: 0x24344f, hemiGround: 0x0b0d12, hemiIntensity: 0.55,
    stars: 0.95, lampIntensity: 44, windowGlow: 1.35, exposure: 1.15,
    moonVisible: true, envStrip: 0x1b2b4a,
  },
  dusk: { // GOLDEN HOUR — user-approved art direction (Style B, GTA5 sunset)
    // deep pass: sun更低 => lambi chhayaayein; amber haze; warm bounce
    skyTop: 0x3d2a63, skyBottom: 0xffa64d,
    fogColor: 0x9a5c30, fogDensity: 0.0022,
    sunColor: 0xff9840, sunIntensity: 4.1, sunPos: [320, 42, -100],
    hemiSky: 0x9a7a92, hemiGround: 0x4a3018, hemiIntensity: 0.82,
    stars: 0.05, lampIntensity: 15, windowGlow: 0.42, exposure: 1.12,
    moonVisible: false, envStrip: 0xb06434,
  },
  day: {
    skyTop: 0x5f9fd8, skyBottom: 0xdfeaf2,
    fogColor: 0xc9dbe8, fogDensity: 0.0016,
    sunColor: 0xfff2dd, sunIntensity: 3.1, sunPos: [180, 320, 120],
    hemiSky: 0xbcd6ea, hemiGround: 0x59616b, hemiIntensity: 1.0,
    stars: 0.0, lampIntensity: 0, windowGlow: 0.06, exposure: 1.0,
    moonVisible: false, envStrip: 0x7fa8cf,
  },
};

const TIME_ORDER = ['night', 'dusk', 'day'];

function lerp(a, b, t) { return a + (b - a) * t; }

export function createEnvironment(scene, renderer) {
  // ---------------- fog ----------------
  scene.fog = new THREE.FogExp2(PRESETS.night.fogColor, PRESETS.night.fogDensity);

  // ---------------- sky dome ----------------
  const skyUniforms = {
    topColor: { value: new THREE.Color(PRESETS.night.skyTop) },
    bottomColor: { value: new THREE.Color(PRESETS.night.skyBottom) },
    exponent: { value: 0.7 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 24, 12), skyMat);
  scene.add(sky);

  // ---------------- stars ----------------
  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95); // upper hemisphere
    const r = 900;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.4, sizeAttenuation: false,
    transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---------------- moon ----------------
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), moonMat);
  moon.position.set(280, 420, 180);
  scene.add(moon);

  // ---------------- lights ----------------
  const sun = new THREE.DirectionalLight(PRESETS.night.sunColor, PRESETS.night.sunIntensity);
  sun.position.set(...PRESETS.night.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  const S = 175;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // golden-hour SUN FLARE — additive sprite that fades when sun leaves view
  const flareCanvas = document.createElement('canvas');
  flareCanvas.width = flareCanvas.height = 256;
  {
    const c = flareCanvas.getContext('2d');
    const g1 = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g1.addColorStop(0, 'rgba(255,240,210,1)');
    g1.addColorStop(0.18, 'rgba(255,190,110,0.85)');
    g1.addColorStop(0.5, 'rgba(255,140,60,0.22)');
    g1.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g1;
    c.fillRect(0, 0, 256, 256);
  }
  const flareTex = new THREE.CanvasTexture(flareCanvas);
  flareTex.colorSpace = THREE.SRGBColorSpace;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false,
  }));
  flare.scale.set(360, 360, 1);
  scene.add(flare);
  const flareDir = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(
    PRESETS.night.hemiSky, PRESETS.night.hemiGround, PRESETS.night.hemiIntensity);
  scene.add(hemi);

  // ---------------- rain ----------------
  const RAIN_COUNT = 2600;
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 130;
    rainPos[i * 3 + 1] = Math.random() * 60;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 130;
    rainSpeed[i] = 38 + Math.random() * 26;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0x9db8d8, size: 0.13, transparent: true, opacity: 0.0,
    depthWrite: false, sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  scene.add(rain);

  // ---------------- environment map (reflections) ----------------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  // NOTE: PMREMGenerator.fromScene renders with far=100 — keep everything close
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), skyMat); // shares uniforms
  envScene.add(envSky);
  const stripMat = new THREE.MeshBasicMaterial({ color: PRESETS.night.envStrip, side: THREE.DoubleSide });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(90, 8), stripMat);
  strip.position.set(0, 2, -40);
  envScene.add(strip);
  const strip2 = strip.clone();
  strip2.position.set(-40, 3, 0);
  strip2.rotation.y = Math.PI / 2;
  envScene.add(strip2);
  let envRT = null;
  function rebuildEnvMap() {
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0.06);
    scene.environment = envRT.texture;
  }
  rebuildEnvMap();

  // ---------------- state / transition ----------------
  const state = {
    timeName: 'night',
    raining: false,
    rainAmount: 0,        // 0..1 smoothed
    lampIntensity: PRESETS.night.lampIntensity,
    windowGlow: PRESETS.night.windowGlow,
    listeners: [],
  };

  let cur = { ...PRESETS.night };
  let from = { ...PRESETS.night };
  let target = { ...PRESETS.night };
  let transition = 1; // done

  function setTime(name) {
    if (!PRESETS[name] || name === state.timeName) return;
    from = snapshotCurrent();
    target = PRESETS[name];
    state.timeName = name;
    transition = 0;
  }
  function snapshotCurrent() {
    return {
      ...cur,
      skyTop: cur.skyTop, // colors already THREE.Color below
    };
  }
  function cycleTime() {
    const i = TIME_ORDER.indexOf(state.timeName);
    const next = TIME_ORDER[(i + 1) % TIME_ORDER.length];
    setTime(next);
    return next;
  }

  function setRain(on) {
    state.raining = on;
    rain.visible = true; // opacity fades in/out
  }
  function toggleRain() { setRain(!state.raining); return state.raining; }

  // color lerp helper
  const tmpA = new THREE.Color();
  function lerpColor(cTarget, a, b, t) {
    tmpA.setHex(a);
    cTarget.copy(tmpA).lerp(new THREE.Color(b), t);
  }

  const fogColor = new THREE.Color();

  function applyMixture(t) {
    const tg = target;
    skyUniforms.topColor.value.setHex(from.skyTop).lerp(new THREE.Color(tg.skyTop), t);
    skyUniforms.bottomColor.value.setHex(from.skyBottom).lerp(new THREE.Color(tg.skyBottom), t);
    fogColor.setHex(from.fogColor).lerp(new THREE.Color(tg.fogColor), t);
    scene.fog.color.copy(fogColor);
    scene.fog.density = lerp(from.fogDensity, tg.fogDensity, t);
    sun.color.setHex(from.sunColor).lerp(new THREE.Color(tg.sunColor), t);
    sun.intensity = lerp(from.sunIntensity, tg.sunIntensity, t);
    sun.position.set(
      lerp(from.sunPos[0], tg.sunPos[0], t),
      lerp(from.sunPos[1], tg.sunPos[1], t),
      lerp(from.sunPos[2], tg.sunPos[2], t));
    hemi.color.setHex(from.hemiSky).lerp(new THREE.Color(tg.hemiSky), t);
    hemi.groundColor.setHex(from.hemiGround).lerp(new THREE.Color(tg.hemiGround), t);
    hemi.intensity = lerp(from.hemiIntensity, tg.hemiIntensity, t);
    starMat.opacity = lerp(from.stars, tg.stars, t);
    moon.visible = lerp(from.moonVisible ? 1 : 0, tg.moonVisible ? 1 : 0, t) > 0.5;
    renderer.toneMappingExposure = lerp(from.exposure, tg.exposure, t);
    stripMat.color.setHex(from.envStrip).lerp(new THREE.Color(tg.envStrip), t);
    state.lampIntensity = lerp(from.lampIntensity, tg.lampIntensity, t);
    state.windowGlow = lerp(from.windowGlow, tg.windowGlow, t);
    cur = {
      skyTop: skyUniforms.topColor.value.getHex(),
      skyBottom: skyUniforms.bottomColor.value.getHex(),
      fogColor: scene.fog.color.getHex(),
      fogDensity: scene.fog.density,
      sunColor: sun.color.getHex(),
      sunIntensity: sun.intensity,
      sunPos: [sun.position.x, sun.position.y, sun.position.z],
      hemiSky: hemi.color.getHex(),
      hemiGround: hemi.groundColor.getHex(),
      hemiIntensity: hemi.intensity,
      stars: starMat.opacity,
      lampIntensity: state.lampIntensity,
      windowGlow: state.windowGlow,
      exposure: renderer.toneMappingExposure,
      moonVisible: moon.visible,
      envStrip: stripMat.color.getHex(),
    };
  }

  // ---------------- per-frame update ----------------
  function update(dt, camera) {
    // sun flare: follow the sun, fade by view alignment (golden hour only)
    flare.position.copy(sun.position).multiplyScalar(3.2);
    camera.getWorldDirection(camDir);
    flareDir.copy(sun.position).normalize();
    const align = camDir.dot(flareDir);
    const golden = state.timeName === 'dusk' ? 1 : 0;
    flare.material.opacity = Math.max(0, (align - 0.55) / 0.45) * 0.85 * golden;
    if (transition < 1) {
      transition = Math.min(1, transition + dt / 2.5);
      applyMixture(transition === 1 ? 1 : (1 - Math.cos(transition * Math.PI)) / 2);
      if (transition === 1) rebuildEnvMap();
    }

    // rain fade
    const targetRain = state.raining ? 1 : 0;
    state.rainAmount = lerp(state.rainAmount, targetRain, 1 - Math.exp(-dt * 1.5));
    rainMat.opacity = state.rainAmount * 0.42;
    rain.visible = state.rainAmount > 0.01;

    if (rain.visible) {
      const pos = rain.geometry.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 3 + 1] -= rainSpeed[i] * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 55 + Math.random() * 8;
          arr[i * 3] = (Math.random() - 0.5) * 130;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 130;
        }
      }
      pos.needsUpdate = true;
      rain.position.set(camera.position.x, 0, camera.position.z);
    }

    // slow star drift
    stars.rotation.y += dt * 0.004;
    moon.position.set(camera.position.x + 260, 400, camera.position.z + 160);
    sky.position.copy(camera.position);
  }

  applyMixture(1);

  return {
    scene, sun, state, update, setTime, cycleTime, setRain, toggleRain,
    get raining() { return state.raining; },
    get timeName() { return state.timeName; },
    get rainAmount() { return state.rainAmount; },
    get lampIntensity() { return state.lampIntensity; },
    get windowGlow() { return state.windowGlow; },
  };
}

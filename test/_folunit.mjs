import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 360, height: 240 } });
await page.goto('http://localhost:3002/', { waitUntil: 'networkidle', timeout: 60000 });
const out = await page.evaluate(async () => {
  const THREE = await import('/node_modules/three/build/three.module.js');
  const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
  const { mergeGeometries } = await import('/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');
  const draco = new DRACOLoader(); draco.setDecoderPath('draco/');
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync('assets/props/tree-street.glb');
  const geos = [], mats = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    geos.push(g); mats.push(...(Array.isArray(o.material) ? o.material : [o.material]));
  });
  const geo = mergeGeometries(geos, true);
  const inst = new THREE.InstancedMesh(geo, mats, 12);
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    P.set((i % 4) * 3 - 4.5, 0, Math.floor(i / 4) * 3 - 3);
    Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3);
    S.setScalar(1);
    M.compose(P, Q, S); inst.setMatrixAt(i, M);
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x808890);
  scene.add(inst);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(4, 8, 6); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(50, 360 / 240, 0.1, 100);
  cam.position.set(0, 3.2, 12); cam.lookAt(0, 2, 0);
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setSize(360, 240); r.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.innerHTML = ''; document.body.appendChild(r.domElement);
  r.render(scene, cam);
  return 'rendered';
});
await page.screenshot({ path: 'test/_tree-unit.png' });
console.log(out);
await browser.close();

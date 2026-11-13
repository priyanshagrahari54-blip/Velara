import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// VELARA city generator: roads, buildings, neon, lamps, props, pickups
// ---------------------------------------------------------------------------

export const GRID = 7;      // city blocks per axis (5x5 core + district ring)
export const BLOCK = 36;    // block size (m)
export const ROAD = 16;     // road width (m)
export const CELL = BLOCK + ROAD;
export const EXTENT = (GRID * BLOCK + (GRID + 1) * ROAD) / 2; // 138

function roadCoords() {
  const arr = [];
  for (let i = 0; i <= GRID; i++) arr.push(-EXTENT + ROAD / 2 + i * CELL);
  return arr;
}

function canvasTexture(w, h, draw, repeatWrap = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeatWrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

function noise(ctx, w, h, amount, alpha) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

function scaleBoxUVs(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
}

// --- architectural detail helpers (visual pass v3: de-box the skyline) ---
// Small sub-geometries carry per-vertex colors and merge into ONE mesh per
// building, so rooftops/balconies/pilasters cost a single draw call each.
const detailMat = new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.86, metalness: 0.12,
});
function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const boxAt = (w, h, d, x, y, z, hex) => colored(new THREE.BoxGeometry(w, h, d), hex).translate(x, y, z);
const cylAt = (rt, rb, h, seg, x, y, z, hex) => colored(new THREE.CylinderGeometry(rt, rb, h, seg), hex).translate(x, y, z);

export function buildCity(scene, world, opts = {}) {
  const g560build = opts.profile === 'g560'; // build-time cuts (approved: G560 aggressive)
  const ROADS = roadCoords(); // shared for X and Z axes
  const collidableMeshes = [];

  // ---------------------------------------------------- chunk streaming
  // Har block apne chunk-group me jaata hai; player se door chunks hide ho
  // jaate hain — draw calls bounded, koi loading screen nahi (visibility only).
  const chunks = new Map();
  const chunkAt = (x, z) => {
    const ix = Math.round(x / CELL), iz = Math.round(z / CELL);
    const k = ix + ',' + iz;
    let g = chunks.get(k);
    if (!g) {
      g = new THREE.Group();
      g.userData.cx = ix * CELL; g.userData.cz = iz * CELL;
      chunks.set(k, g);
      scene.add(g);
    }
    return g;
  };
  let ADD = scene;                 // current static-add target (block chunk)
  let viewDist = 260;              // quality tier se override (setPerf)
  let viewPad = 45;                // chunk visibility padding (g560: 24)
  let detailLod = false;           // g560: door chunks ke detail-props hide

  // ---- STATIC MERGE BUCKETS (60fps mission) ----
  // Har chunk ka static geometry per-(material, attribute-set, shadow/collide
  // flags) bucket mein jaata hai; build ke end par ek hi merged mesh banta hai.
  // 314 draws ka ilaaj. Runtime-referenced cheezein userData.noMerge se bypass.
  const buckets = new Map();       // chunkGroup -> Map(key -> entry)
  const _bucket = (chunk, mesh) => {
    mesh.updateMatrix();
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    const attrs = Object.keys(geo.attributes).sort().join('+');
    const key = mesh.material.uuid + '|' + attrs + '|'
      + (mesh.castShadow ? 1 : 0) + (mesh.receiveShadow ? 1 : 0)
      + (mesh.userData.collidable ? 1 : 0);
    let per = buckets.get(chunk);
    if (!per) { per = new Map(); buckets.set(chunk, per); }
    let e = per.get(key);
    if (!e) {
      e = { mat: mesh.material, geos: [], cast: mesh.castShadow,
            receive: mesh.receiveShadow, col: !!mesh.userData.collidable };
      per.set(key, e);
    }
    e.geos.push(geo);
  };
  const _addOne = (o) => {
    if (o && o.isMesh && !o.userData.noMerge && o.geometry && o.geometry.attributes.position) {
      _bucket(ADD, o);
      return;
    }
    ADD.add(o);
  };
  const add = (...os) => os.forEach(_addOne);   // variadic — bridge water/pillar bug bhi fix

  // ---------------------------------------------------------- physics mats
  const groundMat = new CANNON.Material('ground');

  // ---------------------------------------------------------- ground body
  // NOTE: a big BOX, not an infinite Plane — raycast vehicles misbehave
  // against Plane shapes (wheels lose traction for several seconds).
  const groundBody = new CANNON.Body({
    mass: 0, material: groundMat,
    shape: new CANNON.Box(new CANNON.Vec3(700, 1, 700)),
    position: new CANNON.Vec3(0, -1, 0),
  });
  world.addBody(groundBody);

  // ------------------------------------------------------------ textures
  // PHOTO TEXTURES (visual pass v1): real tileable art beats flat canvas noise.
  const texLoader = new THREE.TextureLoader();
  const realTex = (file, rx, ry) => {
    const t = texLoader.load('textures/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const asphaltTex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#191b1f'; c.fillRect(0, 0, w, h);
    noise(c, w, h, 2600, 0.35);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.moveTo(Math.random() * w, Math.random() * h);
      c.lineTo(Math.random() * w, Math.random() * h);
      c.stroke();
    }
  });
  asphaltTex.repeat.set(40, 40);

  const roadTex = canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#1b1d21'; c.fillRect(0, 0, w, h);
    noise(c, w, h, 2200, 0.32);
    // edge lines
    c.fillStyle = 'rgba(210,210,215,0.55)';
    c.fillRect(16, 0, 6, h); c.fillRect(w - 22, 0, 6, h);
    // dashed center
    c.fillStyle = 'rgba(230,230,235,0.75)';
    for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });

  const sidewalkTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#63666c'; c.fillRect(0, 0, w, h);
    noise(c, w, h, 900, 0.25);
    c.strokeStyle = 'rgba(30,32,36,0.6)'; c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke();
      c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke();
    }
  });
  sidewalkTex.repeat.set(9, 9);

  const stripeTex = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c8a12e'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#15151a';
    for (let i = -2; i < 6; i++) {
      c.save(); c.translate(i * 32, 0); c.rotate(Math.PI / 4);
      c.fillRect(0, -40, 14, 220); c.restore();
    }
  });

  const woodTex = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#7a5a34'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(40,25,10,0.8)'; c.lineWidth = 4;
    c.strokeRect(4, 4, w - 8, h - 8);
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    noise(c, w, h, 300, 0.18);
  });

  const moneyTex = canvasTexture(128, 96, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd977'); g.addColorStop(1, '#c9973a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5d431a';
    c.font = 'bold 58px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('₹', w / 2, h / 2 + 4);
    c.strokeStyle = 'rgba(60,40,10,0.8)'; c.lineWidth = 6;
    c.strokeRect(3, 3, w - 6, h - 6);
  }, false);

  // facade variants (map + emissive)
  const facades = [];
  const baseColors = ['#232a36', '#2b2622', '#1e2430', '#302a33'];
  for (let v = 0; v < 4; v++) {
    const cols = 6, rows = 12, W = 256, H = 512;
    const cw = W / cols, ch = H / rows;
    const mapC = document.createElement('canvas'); mapC.width = W; mapC.height = H;
    const emiC = document.createElement('canvas'); emiC.width = W; emiC.height = H;
    const mc = mapC.getContext('2d'), ec = emiC.getContext('2d');
    mc.fillStyle = baseColors[v]; mc.fillRect(0, 0, W, H);
    noise(mc, W, H, 500, 0.15);
    ec.fillStyle = '#000'; ec.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      mc.fillStyle = 'rgba(0,0,0,0.35)';
      mc.fillRect(0, r * ch + ch - 4, W, 4); // floor ledge
      for (let col = 0; col < cols; col++) {
        const x = col * cw + 7, y = r * ch + 8, ww = cw - 14, wh = ch - 20;
        const lit = Math.random() < 0.34;
        mc.fillStyle = '#0b0e14';
        mc.fillRect(x, y, ww, wh);
        if (lit) {
          const warm = Math.random();
          const color = warm < 0.55 ? '#ffd9a0' : warm < 0.8 ? '#b8d4ff' : '#9fffe0';
          mc.fillStyle = color; mc.globalAlpha = 0.85;
          mc.fillRect(x + 2, y + 2, ww - 4, wh - 4);
          mc.globalAlpha = 1;
          ec.fillStyle = color;
          ec.fillRect(x + 2, y + 2, ww - 4, wh - 4);
        } else {
          const g = mc.createLinearGradient(x, y, x + ww, y + wh);
          g.addColorStop(0, '#141a26'); g.addColorStop(0.5, '#1d2635'); g.addColorStop(1, '#10141d');
          mc.fillStyle = g;
          mc.fillRect(x, y, ww, wh);
        }
      }
    }
    // licence-clean procedural facade (master-spec rule 5c): canvas map +
    // alag emissive canvas — raat mein sirf khidkiyan jalti hain, deewar nahi.
    const mkTex = (cnv) => {
      const t = new THREE.CanvasTexture(cnv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, Math.max(3, Math.round(rows / 2)));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const map = mkTex(mapC);
    const emissive = mkTex(emiC);
    const mat = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0.95,
      roughness: 0.82, metalness: 0.12,
    });
    facades.push(mat);
  }

  // Podium (street-retail base) materials - storefront glass glowing at dusk
  const podiumMats = [];
  for (const awning of ['#8a2f2f', '#2f5a8a', '#3f6b4a']) {
    const W = 512, H = 192;
    const mapC = document.createElement('canvas'); mapC.width = W; mapC.height = H;
    const emiC = document.createElement('canvas'); emiC.width = W; emiC.height = H;
    const mc = mapC.getContext('2d'), ec = emiC.getContext('2d');
    mc.fillStyle = '#262b33'; mc.fillRect(0, 0, W, H);
    noise(mc, W, H, 320, 0.14);
    ec.fillStyle = '#000'; ec.fillRect(0, 0, W, H);
    mc.fillStyle = awning; mc.fillRect(0, 8, W, 26);
    mc.fillStyle = 'rgba(0,0,0,0.28)'; mc.fillRect(0, 30, W, 6);
    const shops = 5, sw = W / shops;
    for (let s = 0; s < shops; s++) {
      const x = s * sw + 10, gw = sw - 20, gh = H - 72, y = 46;
      mc.fillStyle = '#0a0d13'; mc.fillRect(x, y, gw, gh);
      if (Math.random() < 0.5) {
        mc.fillStyle = '#ffd9a0'; mc.fillRect(x + 3, y + 3, gw - 6, gh - 6);
        ec.fillStyle = '#ffcf8a'; ec.fillRect(x + 3, y + 3, gw - 6, gh - 6);
        mc.fillStyle = 'rgba(80,55,25,0.55)'; mc.fillRect(x + 8, y + gh * 0.5, gw - 16, 7);
      } else {
        const g2 = mc.createLinearGradient(x, y, x, y + gh);
        g2.addColorStop(0, '#1a2130'); g2.addColorStop(1, '#0c1017');
        mc.fillStyle = g2; mc.fillRect(x, y, gw, gh);
      }
      mc.fillStyle = '#11151c'; mc.fillRect(x + gw * 0.42, y + gh - 2, 16, 26);
    }
    const mkTex = (cnv) => {
      const t = new THREE.CanvasTexture(cnv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    podiumMats.push(new THREE.MeshStandardMaterial({
      map: mkTex(mapC), emissiveMap: mkTex(emiC), emissive: 0xffffff,
      emissiveIntensity: 0.95, roughness: 0.78, metalness: 0.1,
    }));
  }

  // ------------------------------------------------------------- meshes
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ map: realTex('asphalt.jpg', 100, 100), roughness: 0.85, metalness: 0.05 }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex, color: 0xa8adb5, roughness: 0.8, metalness: 0.08,
    envMapIntensity: 0.5,
  });
  const LEN = EXTENT * 2 + 30;
  // 60fps: saare 16 road-planes ek hi merged geometry (16 draws -> 1)
  const roadGeos = [];
  const tileUV = (g) => {
    const uv = g.attributes.uv;   // texture tile = 16m
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (LEN / 16));
    return g;
  };
  for (const rx of ROADS) {
    roadGeos.push(tileUV(new THREE.PlaneGeometry(ROAD, LEN)
      .rotateX(-Math.PI / 2).translate(rx, 0.02, 0)));
  }
  for (const rz of ROADS) {
    roadGeos.push(tileUV(new THREE.PlaneGeometry(ROAD, LEN)
      .rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.021, rz)));
  }
  const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos, false), roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // ------------------------------------------------------- helpers
  const staticBox = (hx, hy, hz, x, y, z, quat) => {
    const body = new CANNON.Body({
      mass: 0, material: groundMat,
      shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
      position: new CANNON.Vec3(x, y, z),
    });
    if (quat) body.quaternion.copy(quat);
    world.addBody(body);
    return body;
  };

  // Deterministic world generation (ADR-007): mulberry32 seeded PRNG instead of
  // Math.random() — same city every load (GTA-style fixed map) and reproducible
  // QA runs. Texture-canvas noise above stays random (cosmetic only).
  let _seed = 0xC17E5EED;
  const srand = () => {
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rand = (a, b) => a + srand() * (b - a);
  const pick = (arr) => arr[Math.floor(srand() * arr.length)];

  // --------------------------------------------- dynamic props (declared early
  // because buildStuntPlaza runs inside the block loop below)
  const crates = [];
  const coneMeshes = [];
  const initialTransforms = [];

  function addCrate(x, y, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.1, 1.1),
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 }));
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass: 7,
      shape: new CANNON.Box(new CANNON.Vec3(0.55, 0.55, 0.55)),
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.05, angularDamping: 0.2,
    });
    world.addBody(body);
    crates.push({ mesh, body, destroyed: false });
    initialTransforms.push({ body, pos: body.position.clone(), quat: body.quaternion.clone() });
  }

  function addCone(x, z) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.36, 0.85, 10),
      new THREE.MeshStandardMaterial({ color: 0xff6a1f, roughness: 0.6 }));
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.26, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    band.position.y = 0.08;
    g.add(cone); g.add(band);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    chunkAt(x, z).add(g);
    const body = new CANNON.Body({
      mass: 2,
      shape: new CANNON.Cylinder(0.05, 0.36, 0.85, 8),
      position: new CANNON.Vec3(x, 0.5, z),
      angularDamping: 0.3,
    });
    world.addBody(body);
    coneMeshes.push({ mesh: g, body });
    initialTransforms.push({ body, pos: body.position.clone(), quat: body.quaternion.clone() });
  }

  // ------------------------------------------------------- blocks & buildings
  const beacons = [];
  const sideMat = new THREE.MeshStandardMaterial({
    map: realTex('concrete.jpg', 6, 6), roughness: 0.9, metalness: 0.03,
  });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });

  // parapet rim around a roof edge
  function parapet(list, cx, cz, topY, rw, rd) {
    const t = 0.45, ph = 0.8;
    list.push(
      boxAt(rw * 2 + t * 2, ph, t, cx, topY + ph / 2, cz - rd - t / 2, 0x3a3f47),
      boxAt(rw * 2 + t * 2, ph, t, cx, topY + ph / 2, cz + rd + t / 2, 0x3a3f47),
      boxAt(t, ph, rd * 2, cx - rw - t / 2, topY + ph / 2, cz, 0x353a42),
      boxAt(t, ph, rd * 2, cx + rw + t / 2, topY + ph / 2, cz, 0x353a42)
    );
  }

  // rooftop clutter: water tank, AC units, access hut, vent pipes
  function roofProps(list, cx, cz, topY, rw, rd) {
    if (srand() < 0.6) {
      const tx = cx + rand(-rw * 0.45, rw * 0.45), tz = cz + rand(-rd * 0.45, rd * 0.45);
      list.push(cylAt(1.0, 1.0, 2.0, 10, tx, topY + 1.0, tz, 0x49525c));
      list.push(cylAt(0.45, 0.45, 0.5, 8, tx, topY + 2.25, tz, 0x39424c));
    }
    const nAC = 2 + Math.floor(srand() * 3);
    for (let i = 0; i < nAC; i++) {
      list.push(boxAt(rand(1.2, 1.9), rand(0.7, 1.0), rand(1.0, 1.5),
        cx + rand(-rw + 1.5, rw - 1.5), topY + 0.42, cz + rand(-rd + 1.5, rd - 1.5), 0x666d76));
    }
    if (srand() < 0.45) {
      list.push(boxAt(2.6, 2.2, 2.2,
        cx + rand(-1, 1) * Math.max(0, rw - 2.2), topY + 1.1, cz + rand(-1, 1) * Math.max(0, rd - 2.2), 0x565d66));
    }
    for (let i = 0; i < 2; i++) {
      list.push(cylAt(0.14, 0.14, 1.1, 6,
        cx + rand(-rw + 1, rw - 1), topY + 0.55, cz + rand(-rd + 1, rd - 1), 0x70767e));
    }
  }

  function addBuilding(cx, cz, w, d, h, variant, pad) {
    const y0 = 0.18;
    const geos = [];
    const bodyMat = facades[g560build ? variant & 1 : variant]; // g560: 2 materials

    // ---- podium: street-retail base, wider than the tower ----
    const podH = Math.min(h * 0.3, rand(5.5, 8.5));
    const e = Math.max(0, Math.min(2.2, (pad ?? 1.4) - 0.25));
    const podW = w + e * 2, podD = d + e * 2;
    const podGeo = new THREE.BoxGeometry(podW, podH, podD);
    scaleBoxUVs(podGeo, Math.max(podW, podD) / 12, 1);
    const pod = new THREE.Mesh(podGeo, podiumMats[g560build ? 0 : Math.floor(srand() * podiumMats.length)]);
    pod.position.set(cx, y0 + podH / 2, cz);
    pod.castShadow = true; pod.receiveShadow = true;
    pod.userData.collidable = true;   // bucket finalize collidable list mein daalega
    add(pod);

    // ---- tower tiers (setbacks on tall buildings) ----
    const bodyH = h - podH;
    const tall = bodyH > 32 && srand() < 0.85;
    const t1H = tall ? bodyH * rand(0.58, 0.7) : bodyH;
    const t2H = bodyH - t1H;
    const mkTier = (tw, td, th, baseY) => {
      const g = new THREE.BoxGeometry(tw, th, td);
      scaleBoxUVs(g, Math.max(tw, td) / 13, th / 33);
      const m = new THREE.Mesh(g, bodyMat);
      m.position.set(cx, baseY + th / 2, cz);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.collidable = true;
      add(m);
      return baseY + th;
    };
    let topY = mkTier(w, d, t1H, y0 + podH);
    parapet(geos, cx, cz, topY, w / 2, d / 2);
    staticBox(podW / 2, podH / 2, podD / 2, cx, y0 + podH / 2, cz);
    staticBox(w / 2, t1H / 2, d / 2, cx, y0 + podH + t1H / 2, cz);

    // corner pilasters - vertical rhythm on the main tier (g560: skip, tris bachao)
    if (!g560build) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      geos.push(boxAt(0.5, t1H, 0.5, cx + sx * (w / 2 + 0.12), y0 + podH + t1H / 2, cz + sz * (d / 2 + 0.12), 0x3d434c));
    }

    // balconies on residential variants
    if (!g560build && (variant === 1 || variant === 3) && bodyH > 12 && bodyH < 42) {
      const floors = Math.floor(bodyH / 3.1);
      for (let f = 1; f <= floors; f++) {
        const by = y0 + podH + f * 3.1 - 0.45;
        for (const s of [-1, 1]) {
          geos.push(boxAt(w * 0.94, 0.16, 1.0, cx, by, cz + s * (d / 2 + 0.5), 0x4a5058));
          geos.push(boxAt(w * 0.94, 0.5, 0.1, cx, by + 0.3, cz + s * (d / 2 + 0.97), 0x3a4048));
        }
      }
    }

    let beaconY = topY + 1.2;
    if (tall && t2H > 4) {
      // cornice slab at the setback
      geos.push(boxAt(w + 1.1, 0.7, d + 1.1, cx, topY + 0.32, cz, 0x414750));
      const s = rand(0.72, 0.85);
      const w2 = w * s, d2 = d * s;
      topY = mkTier(w2, d2, t2H, topY);
      parapet(geos, cx, cz, topY, w2 / 2, d2 / 2);
      roofProps(geos, cx, cz, topY, w2 / 2, d2 / 2);
      staticBox(w2 / 2, t2H / 2, d2 / 2, cx, topY - t2H / 2, cz);
      if (bodyH > 48) {
        const mastH = rand(5, 8);
        geos.push(cylAt(0.09, 0.16, mastH, 6, cx, topY + mastH / 2, cz, 0x2a2e33));
        geos.push(cylAt(0.05, 0.05, 1.4, 6, cx, topY + mastH + 0.6, cz, 0x2a2e33));
        beaconY = topY + mastH + 1.5;
      }
    } else {
      roofProps(geos, cx, cz, topY, w / 2, d / 2);
    }

    // aviation beacon on tall ones
    if (h > 44) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), beaconMat);
      b.position.set(cx, beaconY, cz);
      b.userData.noMerge = true;   // beacon animate hota hai — alag mesh raho
      add(b);
      beacons.push(b);
    }

    // merge all sub-details into ONE mesh (single draw call)
    if (geos.length) {
      const dm = new THREE.Mesh(mergeGeometries(geos, false), detailMat);
      dm.castShadow = true; dm.receiveShadow = true;
      add(dm);
    }
  }

  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const ox = -EXTENT + ROAD + bx * CELL;
      const oz = -EXTENT + ROAD + bz * CELL;
      const cx = ox + BLOCK / 2, cz = oz + BLOCK / 2;
      const isCore = bx >= 1 && bx <= 5 && bz >= 1 && bz <= 5;

      // is block ka saara static geometry uske chunk-group me
      ADD = chunkAt(cx, cz);

      // sidewalk platform
      const sw = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.36, BLOCK), sideMat);
      sw.position.set(cx, 0, cz);
      sw.receiveShadow = true;
      add(sw);
      staticBox(BLOCK / 2, 0.18, BLOCK / 2, cx, 0, cz);

      if (isCore) {
        // guaranteed-clear special blocks (positions core ke andar shift-safe)
        if (bx === 3 && bz === 3) { buildCentralPlaza(cx, cz); ADD = scene; continue; } // spawn plaza
        if (bx === 5 && bz === 3) { buildStuntPlaza(cx, cz); ADD = scene; continue; }   // stunt plaza

        const distC = Math.hypot(bx - 3, bz - 3) / 3.6; // 0 center -> ~1 corner
        const cols = srand() < 0.5 ? 1 : 2;
        const rows = srand() < 0.5 ? 1 : 2;
        const lw = (BLOCK - 6) / cols, ld = (BLOCK - 6) / rows;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const inset = rand(2.5, 5);
            const w = lw - inset, d = ld - inset;
            const h = srand() < 0.16
              ? rand(7, 13) // low shops
              : rand(18, 34) + Math.max(0, 1 - distC) * rand(16, 50);
            const lx = ox + 3 + lw * (i + 0.5);
            const lz = oz + 3 + ld * (j + 0.5);
            addBuilding(lx, lz, w, d, h, Math.floor(srand() * 4), inset / 2);
          }
        }
      } else {
        buildRingBlock(districtOf(bx, bz), cx, cz, ox, oz);
      }
      ADD = scene;
    }
  }

  // ================================================== RING DISTRICTS + WORLD
  function districtOf(bx, bz) {
    if ((bz === 0 && bx <= 3) || (bx === 0 && bz <= 2)) return 'market';   // Old Market
    if (bz === GRID - 1) return 'riverside';                                // Riverside
    if (bx === GRID - 1) return 'highway';                                  // Highway + Metro
    return 'downtown';                                                      // glass towers
  }

  function buildRingBlock(district, cx, cz, ox, oz) {
    if (district === 'market') {
      // Old Market: 2x2 low shops (podium storefronts) + stalls + parked autos
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const lx = ox + 3 + 15 * (i + 0.5), lz = oz + 3 + 15 * (j + 0.5);
        addBuilding(lx, lz, rand(9, 12), rand(9, 12), rand(7.5, 12), Math.floor(srand() * 4), 2.4);
      }
      for (let s = 0; s < 3; s++) {
        makeStall(ox + 8 + srand() * 20, oz + 30 + (s - 1) * 3.2, srand() < 0.5 ? 0 : Math.PI / 2);
      }
      if (srand() < 0.8) makeAuto(ox + 28, oz + 8, rand(0, Math.PI * 2));
    } else if (district === 'riverside') {
      addBuilding(cx - 8, cz, rand(14, 18), rand(16, 22), rand(9, 18), 2, 3);
      addBuilding(cx + 9, cz + 4, rand(12, 16), rand(12, 16), rand(9, 16), 1, 3);
      for (let p = 0; p < 3; p++) makePalm(ox + 6 + p * 12, oz + BLOCK - 3, rand(0.85, 1.2));
    } else if (district === 'highway') {
      addBuilding(cx - 6, cz - 8, rand(16, 20), rand(14, 18), rand(14, 26), 3, 3);
      addBuilding(cx + 4, cz + 10, rand(14, 18), rand(14, 18), rand(14, 26), 0, 3);
    } else { // downtown expansion — tall glass towers
      addBuilding(cx, cz, rand(20, 26), rand(20, 26), rand(34, 64), Math.floor(srand() * 4), 4);
    }
  }

  function makePalm(x, z, s) {
    const geos = [cylAt(0.12 * s, 0.22 * s, 5.0 * s, 7, 0, (5.0 * s) / 2, 0, 0x6b4a2f)];
    for (let i = 0; i < 7; i++) {
      const fr = colored(new THREE.BoxGeometry(0.09, 0.05, 2.7 * s), i % 2 ? 0x2e7d46 : 0x3f9c5b);
      fr.translate(0, 0, 1.35 * s);
      fr.rotateX(-0.5);
      fr.rotateY((i / 7) * Math.PI * 2);
      fr.translate(0, 5.0 * s, 0);
      geos.push(fr);
    }
    const m = new THREE.Mesh(mergeGeometries(geos, false), detailMat);
    m.castShadow = true;
    m.position.set(x, 0.19, z);
    add(m);
    staticBox(0.25, 2.4, 0.25, x, 2.4, z);
  }

  function makeStall(x, z, ry) {
    const cols = [0xd8443c, 0x3c78d8, 0xd8a83c, 0x3ca85c];
    const cc = cols[Math.floor(srand() * cols.length)];
    const geos = [
      boxAt(2.2, 0.85, 1.2, 0, 0.55, 0, 0x7a5a34),
      boxAt(2.6, 0.1, 1.7, 0, 2.15, 0, cc),
    ];
    for (const px of [-1.1, 1.1]) for (const pz of [-0.7, 0.7])
      geos.push(boxAt(0.07, 2.1, 0.07, px, 1.05, pz, 0x5a4a3a));
    const goods = [0xc9c9c9, 0xe0a030, 0xb04040];
    for (let i = 0; i < 3; i++)
      geos.push(boxAt(0.4, 0.25, 0.4, -0.7 + i * 0.7, 1.1, 0, goods[i]));
    const m = new THREE.Mesh(mergeGeometries(geos, false), detailMat);
    m.rotation.y = ry;
    m.position.set(x, 0.19, z);
    m.castShadow = true;
    add(m);
    staticBox(1.2, 1.0, 0.7, x, 1.0, z);
  }

  function makeAuto(x, z, ry) {
    const wheel = (wx, wz) => {
      const g = colored(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 10), 0x111111);
      g.rotateZ(Math.PI / 2);
      g.translate(wx, 0.3, wz);
      return g;
    };
    const geos = [
      boxAt(1.25, 0.65, 1.9, 0, 0.62, 0, 0x2f8f4f),
      boxAt(1.3, 0.55, 1.15, 0, 1.2, -0.1, 0xe8c832),
      boxAt(1.32, 0.08, 0.08, 0, 1.5, 0.45, 0x2a2a2a),
      wheel(0, 0.95), wheel(-0.62, -0.7), wheel(0.62, -0.7),
    ];
    const m = new THREE.Mesh(mergeGeometries(geos, false), detailMat);
    m.rotation.y = ry;
    m.position.set(x, 0.19, z);
    add(m);
    staticBox(0.75, 0.8, 1.0, x, 0.9, z);
  }

  function makeBusStop(x, z, ry) {
    const geos = [
      boxAt(3.6, 0.12, 1.6, 0, 2.6, 0, 0x35506e),
      boxAt(3.4, 1.0, 0.12, 0, 1.5, -0.7, 0x4a6a8a),
      boxAt(0.12, 2.6, 0.12, -1.7, 1.3, 0.6, 0x2a2f36),
      boxAt(0.12, 2.6, 0.12, 1.7, 1.3, 0.6, 0x2a2f36),
      boxAt(2.8, 0.1, 0.5, 0, 0.55, -0.3, 0x6a5a3a),
    ];
    const m = new THREE.Mesh(mergeGeometries(geos, false), detailMat);
    m.rotation.y = ry;
    m.position.set(x, 0.19, z);
    m.castShadow = true;
    add(m);
    staticBox(1.8, 1.3, 0.8, x, 1.3, z);
  }

  function makeBillboard(text, color, x, y, z, ry) {
    const tex = canvasTexture(256, 512, (c, w, h) => {
      c.fillStyle = '#070a12'; c.fillRect(0, 0, w, h);
      c.strokeStyle = color; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = color; c.textAlign = 'center';
      c.shadowColor = color; c.shadowBlur = 30;
      const words = text.split(' ');
      const fs = words.length > 1 ? 64 : 84;
      c.font = `bold ${fs}px Arial`;
      words.forEach((word, i) =>
        c.fillText(word, w / 2, h / 2 + (i - (words.length - 1) / 2) * (fs + 16) + fs * 0.35));
    }, false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    add(m);
  }

  // ---------------- elevated metro (highway ke upar, Image-1 signature) ----
  let metro = null;
  function buildMetro() {
    const MX = ROADS[ROADS.length - 1]; // east highway centerline
    const pil = [];
    for (let z = -182; z <= 182; z += 28) pil.push(boxAt(0.9, 8.8, 0.9, MX, 4.4, z, 0x3a4148));
    scene.add(new THREE.Mesh(mergeGeometries(pil, false), detailMat));
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 420),
      new THREE.MeshStandardMaterial({ color: 0x454c54, roughness: 0.7, metalness: 0.4 }));
    beam.position.set(MX, 8.85, 0);
    scene.add(beam);
    // station platform (core ke paas, z=26)
    const stMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.85 });
    const rfMat = new THREE.MeshStandardMaterial({ color: 0x2f3844, roughness: 0.6, metalness: 0.5 });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 26), stMat);
    plat.position.set(MX - 6.4, 8.35, 26);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 28), rfMat);
    roof.position.set(MX - 6.4, 12.2, 26);
    scene.add(plat, roof);
    for (const [px, pz] of [[-4, -12], [-4, 12], [4, -12], [4, 12]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 0.4), rfMat);
      c.position.set(MX - 6.4 + px, 10.3, 26 + pz);
      scene.add(c);
    }
    const signTex = canvasTexture(512, 128, (c, w, h) => {
      c.fillStyle = 'rgba(6,10,18,0.95)'; c.fillRect(0, 0, w, h);
      c.font = 'bold 60px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#35e0ff'; c.shadowBlur = 24; c.fillStyle = '#35e0ff';
      c.fillText('VELARA CENTRAL — METRO', w / 2, h / 2);
    }, false);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(MX - 11.4, 10.6, 26);
    sign.rotation.y = -Math.PI / 2;
    scene.add(sign);
    // train: 4 cars, glowing windows + blue underglow strips
    const train = new THREE.Group();
    const carBody = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.35, metalness: 0.6 });
    const carGlass = new THREE.MeshStandardMaterial({ color: 0x0a1420, emissive: 0x9fd8ff, emissiveIntensity: 1.6, roughness: 0.2 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x081018, emissive: 0x37b6ff, emissiveIntensity: 2.4 });
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.5, 10.5), carBody);
      b.position.y = 1.45;
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.8, 9.2), carGlass);
      w.position.y = 1.9;
      const g = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 10.0), glow);
      g.position.y = 0.12;
      car.add(b, w, g);
      car.position.z = i * 11.2;
      train.add(car);
    }
    train.position.set(MX, 9.2, -120);
    scene.add(train);
    metro = { train, z: -120, dir: 1, x: MX };
  }

  // ---------------- traffic signals (inner ±26 intersections) -------------
  const signalState = { ns: 'green', ew: 'red' };
  let nsTex = null, ewTex = null, nsCtx = null, ewCtx = null;
  function drawSignalHead(ctx, tex, state) {
    const w = 64, h = 176;
    ctx.fillStyle = '#101318'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
    const lamps = [['red', '#ff4444'], ['amber', '#ffb340'], ['green', '#54ff7a']];
    const lit = { red: state === 'red', amber: state === 'amber', green: state === 'green' };
    lamps.forEach(([name, color], i) => {
      ctx.beginPath();
      ctx.arc(w / 2, 32 + i * 56, 20, 0, Math.PI * 2);
      ctx.fillStyle = lit[name] ? color : 'rgba(255,255,255,0.06)';
      ctx.shadowColor = color; ctx.shadowBlur = lit[name] ? 22 : 0;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    tex.needsUpdate = true;
  }
  function buildSignals() {
    const SIG = [-26, 26];
    const poleGeos = [], nsHeads = [], ewHeads = [];
    for (const X of SIG) for (const Z of SIG) {
      const mkPole = (px, pz, headAxis, faceRy) => {
        poleGeos.push(cylAt(0.09, 0.12, 4.8, 8, px, 2.4, pz, 0x2a2f36));
        const hg = new THREE.PlaneGeometry(0.62, 1.66);
        hg.translate(0, 4.6, 0.12);
        hg.rotateY(faceRy);
        hg.translate(px, 0, pz);
        (headAxis === 'ns' ? nsHeads : ewHeads).push(hg);
      };
      mkPole(X - 10.5, Z - 10.5, 'ns', Math.PI);
      mkPole(X + 10.5, Z + 10.5, 'ns', 0);
      mkPole(X - 10.5, Z + 10.5, 'ew', Math.PI / 2);
      mkPole(X + 10.5, Z - 10.5, 'ew', -Math.PI / 2);
    }
    scene.add(new THREE.Mesh(mergeGeometries(poleGeos, false), detailMat));
    const mkCanvas = () => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 176;
      return cv;
    };
    const nsC = mkCanvas(), ewC = mkCanvas();
    nsCtx = nsC.getContext('2d'); ewCtx = ewC.getContext('2d');
    nsTex = new THREE.CanvasTexture(nsC); ewTex = new THREE.CanvasTexture(ewC);
    nsTex.colorSpace = THREE.SRGBColorSpace; ewTex.colorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.Mesh(mergeGeometries(nsHeads, false), new THREE.MeshBasicMaterial({ map: nsTex })));
    scene.add(new THREE.Mesh(mergeGeometries(ewHeads, false), new THREE.MeshBasicMaterial({ map: ewTex })));
    drawSignalHead(nsCtx, nsTex, 'green');
    drawSignalHead(ewCtx, ewTex, 'red');
  }

  // ---------------- zebra crossings at signalized intersections -----------
  function buildZebras() {
    const geos = [];
    for (const X of [-26, 26]) for (const Z of [-26, 26]) {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          geos.push(boxAt(1.15, 0.05, 9.5, X + (k - 2) * 2.2, 0.045, Z + s * 11.5, 0xcfd4da));
          geos.push(boxAt(9.5, 0.05, 1.15, X + s * 11.5, 0.045, Z + (k - 2) * 2.2, 0xcfd4da));
        }
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(geos, false), detailMat));
  }

  // ---------------- riverside: water + palm promenade ---------------------
  function buildRiversideEdge() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(460, 210),
      new THREE.MeshStandardMaterial({
        color: 0x0f4a5a, roughness: 0.18, metalness: 0.55, envMapIntensity: 1.3,
        emissive: 0x06222c, emissiveIntensity: 0.4,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, EXTENT + 105);
    scene.add(water);
    for (let x = -170; x <= 170; x += 22) makePalm(x, EXTENT + 4, rand(0.9, 1.25));
  }

  buildMetro();
  buildSignals();
  buildZebras();
  buildRiversideEdge();
  makeBusStop(-16.2, -64, Math.PI / 2);
  makeBusStop(64, -15.8, 0);
  makeBusStop(15.8, 78, -Math.PI / 2);
  makeBillboard('VELARA', '#35e0ff', ROADS[ROADS.length - 1] - 9, 22, -60, -Math.PI / 2);
  makeBillboard('AURORA', '#ff5fd8', ROADS[ROADS.length - 1] - 9, 20, 20, -Math.PI / 2);
  makeBillboard('KAZE TECHNOLOGIES', '#7dff9a', ROADS[ROADS.length - 1] - 9, 26, 90, -Math.PI / 2);

  // ---------------------------------------------------------- street lamps
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6, metalness: 0.7 });
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0x33363c, emissive: 0xffd9a0, emissiveIntensity: 2.2, roughness: 0.5,
  });
  const lampLights = [];
  const lampGlowPos = [];
  let lampIndex = 0;
  function addLamp(x, z, dirX, dirZ) {
    // 60fps: lamp group nahi — parts seedha chunk bucket mein merge
    const lampChunk = chunkAt(x, z);
    const put = (geo, mat, px, py, pz, ry, rz, cast) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      if (ry || rz) m.rotation.set(0, ry || 0, rz || 0);
      m.castShadow = !!cast;
      _bucket(lampChunk, m);
    };
    put(new THREE.CylinderGeometry(0.09, 0.13, 5.6, 8), poleMat, x, 2.8, z, 0, 0, true);
    const ay = Math.atan2(dirX, dirZ) - Math.PI / 2;
    put(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 6), poleMat,
      x + Math.cos(ay) * 0.9, 5.5, z - Math.sin(ay) * 0.9, ay, Math.PI / 2, false);
    put(new THREE.BoxGeometry(0.66, 0.2, 0.3), lampHeadMat, x + dirX * 1.7, 5.45, z + dirZ * 1.7, 0, 0, false);
    lampGlowPos.push(x + dirX * 1.7, 5.45, z + dirZ * 1.7);
    staticBox(0.14, 2.8, 0.14, x, 2.8, z);
    if (lampIndex % 3 === 0) {
      const l = new THREE.PointLight(0xffd9a0, 40, 42, 1.8);
      l.position.set(x + dirX * 1.7, 5.2, z + dirZ * 1.7);
      scene.add(l);
      lampLights.push(l);
    }
    lampIndex++;
  }
  for (const rx of ROADS) {
    for (let k = 0; k < 6; k++) {
      const z = -EXTENT + 26 + k * (CELL);
      const side = (k % 2 === 0) ? 1 : -1;
      addLamp(rx + side * (ROAD / 2 + 1.2), z, -side, 0);
    }
  }
  for (const rz of ROADS) {
    for (let k = 0; k < 6; k++) {
      const x = -EXTENT + 26 + k * (CELL) + CELL / 2;
      const side = (k % 2 === 0) ? 1 : -1;
      addLamp(x, rz + side * (ROAD / 2 + 1.2), 0, -side);
    }
  }

  // --------------------------------------------- lamp GLOW (sab lamps = 1 draw!)
  // bloom-off tiers (g560/low) par bhi lamps glow karein — additive Points sprite
  {
    const n = lampGlowPos.length / 3;
    if (n > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(lampGlowPos, 3));
      const cnv = document.createElement('canvas');
      cnv.width = cnv.height = 64;
      const c2 = cnv.getContext('2d');
      const grd = c2.createRadialGradient(32, 32, 2, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,216,164,0.95)');
      grd.addColorStop(0.35, 'rgba(255,190,110,0.30)');
      grd.addColorStop(1, 'rgba(255,170,80,0)');
      c2.fillStyle = grd;
      c2.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cnv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const gmat = new THREE.PointsMaterial({
        map: tex, size: 7.5, sizeAttenuation: true, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(geo, gmat));
    }
  }

  // ----------------------------------------------------------- neon signs
  const NEON_TEXTS = [
    ['VELARA', '#35e0ff'], ['CLUB 24/7', '#ff3fd8'], ['HOTEL', '#ffb545'],
    ['NEON', '#57ff9a'], ['बार BAR', '#ff4455'], ['PAAN', '#8affd7'],
    ['MASALA CHAI', '#ffd166'], ['OPEN 24H', '#35e0ff'], ['GARAGE', '#9d7bff'],
    ['DINER', '#ff7a45'], ['रात्रि', '#ff3fd8'], ['CASINO', '#ffd166'],
  ];
  const neonSigns = [];
  const neonLights = [];
  function addNeon(i, x, y, z, ry) {
    const [text, color] = NEON_TEXTS[i % NEON_TEXTS.length];
    const tex = canvasTexture(512, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(5,7,10,0.9)';
      c.fillRect(0, 0, w, h);
      c.font = 'bold 76px Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = color; c.shadowBlur = 26;
      c.fillStyle = color;
      c.fillText(text, w / 2, h / 2 + 4);
      c.shadowBlur = 8;
      c.fillStyle = '#ffffff';
      c.fillText(text, w / 2, h / 2 + 4);
    }, false);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const wMesh = 7 + Math.min(6, text.length * 0.35);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(wMesh, wMesh / 4), mat);
    plane.position.set(x, y, z);
    plane.rotation.y = ry;
    chunkAt(x, z).add(plane);
    neonSigns.push({ mat, phase: Math.random() * 10, flickery: Math.random() < 0.25 });
    if (i % 3 === 0) {
      const l = new THREE.PointLight(new THREE.Color(color), 26, 34, 1.9);
      const off = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      l.position.set(x + off.x * 1.2, y, z + off.z * 1.2);
      scene.add(l);
      neonLights.push(l);
    }
  }
  let neonI = 0;
  for (let b = 0; b < 12; b++) {
    const rx = ROADS[1 + (b % 5)];
    const along = -EXTENT + 30 + ((b * 47) % 200);
    const side = (b % 2 === 0) ? 1 : -1;
    // face the road: sign plane on building wall
    const x = rx + side * (ROAD / 2 + 4.6);
    const z = along;
    const ry = side === 1 ? -Math.PI / 2 : Math.PI / 2;
    addNeon(neonI++, x, rand(9, 16), z, ry);
  }
  for (let b = 0; b < 6; b++) {
    const rz = ROADS[2 + (b % 4)];
    const along = -EXTENT + 40 + ((b * 61) % 190);
    const side = (b % 2 === 0) ? 1 : -1;
    const z = rz + side * (ROAD / 2 + 4.6);
    const x = along;
    const ry = side === 1 ? Math.PI : 0;
    addNeon(neonI++, x, rand(9, 16), z, ry);
  }

  // --------------------------------------------------------- distant skyline
  const skyMat = new THREE.MeshStandardMaterial({
    color: 0x11141c, roughness: 0.9,
    emissive: 0xffffff, emissiveMap: facades[0].emissiveMap, emissiveIntensity: 0.7,
  });
  const skylineMeshes = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rand(-0.06, 0.06);
    const r = rand(240, 330);
    const w = rand(24, 55), h = rand(45, 150);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * rand(0.7, 1.2)), skyMat);
    scaleBoxUVs(m.geometry, 2 + Math.random() * 2, 2 + Math.random() * 3);
    m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    scene.add(m);
    skylineMeshes.push(m);
  }

  // -------------------------------------------------------------- props
  function buildCentralPlaza(cx, cz) {
    // fountain centerpiece
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.75, 20), concrete);
    base.position.set(cx, 0.55, cz);
    base.castShadow = true; base.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.85, 2.85, 0.12, 20),
      new THREE.MeshStandardMaterial({
        color: 0x0e3a4a, emissive: 0x2fd7c8, emissiveIntensity: 0.55,
        roughness: 0.15, metalness: 0.4,
      }));
    water.position.set(cx, 0.94, cz);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 12), concrete);
    pillar.position.set(cx, 1.9, cz);
    pillar.castShadow = true;
    add(base, water, pillar);
    staticBox(3.3, 0.38, 3.3, cx, 0.56, cz);
    staticBox(0.5, 1.2, 0.5, cx, 1.9, cz);
    const l = new THREE.PointLight(0x3fd7c8, 26, 38, 1.8);
    l.position.set(cx, 2.6, cz);
    scene.add(l);
  }

  function buildStuntPlaza(cx, cz) {
    // ramps facing each other
    const rampMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 });
    for (const [dz, ang] of [[-9, 0.2], [9, -0.2]]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 11), rampMat);
      mesh.position.set(cx, 0.55, cz + dz);
      mesh.rotation.x = ang;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.collidable = true;
      add(mesh);
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), ang);
      staticBox(4.5, 0.25, 5.5, cx, 0.55, cz + dz, q);
    }
    // crate pyramid
    const px = cx - 12, pz = cz + 13;
    const layout = [
      [0, 0.75], [1.2, 0.75], [2.4, 0.75], [0.6, 1.9], [1.8, 1.9], [1.2, 3.05],
    ];
    for (const [ox, oy] of layout) addCrate(px + ox, 0.18 + oy, pz);
    // scattered crates
    addCrate(cx + 13, 0.8, cz - 12);
    addCrate(cx + 14.3, 0.8, cz - 11);
    addCrate(cx - 2, 0.8, cz - 14);
    // cone ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addCone(cx + Math.cos(a) * 7, cz + Math.sin(a) * 7 - 0.0);
    }
    // barriers on avenue edge
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.85 });
    for (const [bx2, bz2] of [[cx + 18, cz + 20], [cx + 18, cz + 24]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 0.7), barMat);
      m.position.set(bx2, 0.68, bz2);
      m.castShadow = true;
      add(m);
      staticBox(1.6, 0.5, 0.35, bx2, 0.68, bz2);
    }
  }

  // cones on a street near spawn
  for (let i = 0; i < 6; i++) addCone(-46 + i * 2.4, -26 + 2.2);
  // couple of crates on the roadside
  addCrate(-13, 0.8, 27);
  addCrate(-11.8, 0.8, 27.6);

  // ------------------------------------------------------------- pickups
  const pickups = [];
  const pickupSpots = [
    [-10, -6], [12, 16], [-20, -20], [30, -20], [-72, 44],
  ];
  for (const [x, z] of pickupSpots) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.42),
      new THREE.MeshStandardMaterial({
        map: moneyTex, emissive: 0xffcf5e, emissiveIntensity: 0.85, roughness: 0.4,
      }));
    mesh.position.set(x, 1.15, z);
    scene.add(mesh);
    pickups.push({ mesh, x, z, y: 1.15, taken: false, phase: Math.random() * 6 });
  }

  // ---------------------------------------------------------- wet-look mats
  const wetMats = [groundMesh.material, roadMat, sideMat];

  // ------------------------------------------------------------- update
  let t = 0;
  function update(dt, env, focus) {
    t += dt;

    // ---- chunk streaming: door wale chunks hide (draw calls bounded) ----
    if (focus) {
      const vd = viewDist + viewPad;
      for (const g of chunks.values()) {
        const d = Math.hypot(g.userData.cx - focus.x, g.userData.cz - focus.z);
        g.visible = d < vd;
        // g560 detail-LOD: 95m se door chunk-details chhupo (fog cover karta hai)
        if (detailLod) {
          const far = d > 95;
          for (const ch of g.children) if (ch.userData.isDetail) ch.visible = !far;
        }
      }
    }

    // ---- metro train loop ----
    if (metro) {
      metro.z += metro.dir * 17 * dt;
      if (metro.z > 172) metro.dir = -1;
      else if (metro.z < -172) metro.dir = 1;
      metro.train.position.z = metro.z;
      metro.train.rotation.y = metro.dir === 1 ? 0 : Math.PI;
    }

    // ---- traffic signal phase (8s green / 2s amber per axis) ----
    const ph = t % 20;
    const ns = ph < 8 ? 'green' : ph < 10 ? 'amber' : 'red';
    const ew = ph < 10 ? 'red' : ph < 18 ? 'green' : 'amber';
    if (ns !== signalState.ns) { signalState.ns = ns; drawSignalHead(nsCtx, nsTex, ns); }
    if (ew !== signalState.ew) { signalState.ew = ew; drawSignalHead(ewCtx, ewTex, ew); }

    // lamps
    const headGlow = 0.15 + (env.lampIntensity / 44) * 2.4;
    lampHeadMat.emissiveIntensity = headGlow;
    for (let i = 0; i < lampLights.length; i++) {
      lampLights[i].intensity = env.lampIntensity * (0.92 + 0.08 * Math.sin(t * 11 + i * 2.4));
    }
    // windows
    for (const m of facades) m.emissiveIntensity = env.windowGlow;
    for (const m of podiumMats) m.emissiveIntensity = env.windowGlow * 1.1;
    skyMat.emissiveIntensity = env.windowGlow * 0.55;
    // beacons
    const blink = (Math.sin(t * 2.2) > 0.6) ? 1 : 0.06;
    for (const b of beacons) b.material.color.setRGB(1 * blink + 0.1, 0.15, 0.25);
    // neon flicker
    for (const s of neonSigns) {
      let k = 1;
      if (s.flickery) {
        k = 0.75 + 0.25 * Math.sin(t * 9 + s.phase);
        if (Math.sin(t * 2.3 + s.phase * 3) > 0.985) k = 0.15;
      } else {
        k = 0.92 + 0.08 * Math.sin(t * 1.7 + s.phase);
      }
      s.mat.color.setScalar(k);
    }
    for (let i = 0; i < neonLights.length; i++) {
      neonLights[i].intensity = (env.timeName === 'day' ? 0 : 26) * (0.9 + 0.1 * Math.sin(t * 3 + i));
    }
    // wet streets
    const wet = env.rainAmount;
    for (const m of wetMats) {
      m.roughness = 0.85 - 0.55 * wet;
      m.envMapIntensity = 0.45 + 1.35 * wet;
    }
    // pickups bob
    for (const p of pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2.4;
      p.mesh.position.y = p.y + Math.sin(t * 2 + p.phase) * 0.16;
    }
    // sync dynamic props
    for (const c of crates) {
      c.mesh.position.copy(c.body.position);
      c.mesh.quaternion.copy(c.body.quaternion);
    }
    for (const c of coneMeshes) {
      c.mesh.position.copy(c.body.position);
      c.mesh.quaternion.copy(c.body.quaternion);
    }
  }

  function resetProps() {
    for (const it of initialTransforms) {
      it.body.position.copy(it.pos);
      it.body.quaternion.copy(it.quat);
      it.body.velocity.set(0, 0, 0);
      it.body.angularVelocity.set(0, 0, 0);
      it.body.wakeUp();
    }
    for (const c of crates) c.destroyed = false;
    for (const p of pickups) { p.taken = false; p.mesh.visible = true; }
  }

  // perf switching for weak hardware (g560 tier): cap dynamic lights, hide skyline
  function setPerf({ maxLights = Infinity, skyline = true, viewDist: vd, aniso, viewPad: vp, detailLod: dl } = {}) {
    if (dl !== undefined) detailLod = dl;
    if (vp !== undefined) viewPad = vp;
    if (aniso !== undefined) {
      // g560: anisotropic filtering band — old GPUs pe free bandwidth bachao
      scene.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mm of mats) {
          for (const k of ['map', 'emissiveMap', 'roughnessMap', 'normalMap', 'aoMap']) {
            const t = mm[k];
            if (t && t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; }
          }
        }
      });
    }
    if (vd) viewDist = vd;
    let n = 0;
    for (const l of [...lampLights, ...neonLights]) {
      const on = n < maxLights;
      if (on) n++;
      if (on && !l.parent) scene.add(l);
      else if (!on && l.parent) scene.remove(l);
    }
    for (const m of skylineMeshes) m.visible = skyline;
  }

  function metroPos() { return metro ? metro.z : 0; }
  function trafficLightGo(axis) {
    return axis === 'z' ? signalState.ns === 'green' : signalState.ew === 'green';
  }
  function chunkStats() {
    let vis = 0;
    for (const g of chunks.values()) if (g.visible) vis++;
    return { total: chunks.size, visible: vis };
  }

  // ---- finalize: per-(chunk, material, flags) merged meshes ----
  for (const [chunkGrp, per] of buckets) {
    for (const e of per.values()) {
      const mm = new THREE.Mesh(mergeGeometries(e.geos, false), e.mat);
      mm.castShadow = e.cast;
      mm.receiveShadow = e.receive;
      mm.userData.isDetail = e.mat === detailMat; // g560 LOD target
      chunkGrp.add(mm);
      if (e.col) collidableMeshes.push(mm);
    }
  }

  return {
    ROADS, EXTENT, collidableMeshes, update, resetProps, setPerf,
    metroPos, trafficLightGo, chunkStats,
    pickups, crates, coneMeshes, groundMat,
  };
}

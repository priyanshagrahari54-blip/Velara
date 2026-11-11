import * as THREE from 'three';

// ---------------------------------------------------------------------------
// VELARA pedestrians — sidewalk NPCs (visual-only, no physics bodies).
// - Walk sidewalk lines along road edges (grid math from city.ROADS)
// - Panic: gunfire (shared _panicPoints list) ya tez gaadi dikhe to bhaagte hain
// - Knockdown: tez car se takraaye to gir jaate hain, uth ke phir bhaagte hain
// - Recycling: player se 85m door wale ped player ke paas shift ho jaate hain
//   (GTA-style density hamesha action ke aas-paas rehti hai)
// Performance: 6 chhote meshes per ped, shared materials, zero physics cost.
// ---------------------------------------------------------------------------

const SKIN = [0xc9a07a, 0x8a5f3f, 0xe0b48f, 0x6e4a2f]
  .map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
const SHIRT = [0xb03a3a, 0x3a5fb0, 0x3ab06a, 0xc9c9c9, 0x2a2a2a, 0xd8b04a, 0x7a4a9a, 0x357a7a]
  .map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const PANTS = [0x2a3040, 0x30302a, 0x1f2430, 0x4a3a2a]
  .map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));

const SIDE = 9.5; // sidewalk offset from road centerline (ROAD/2 + 1.5m)

export class PedestrianSystem {
  constructor(scene, ROADS, EXTENT, panicPoints, getFocus, count = 22) {
    this.scene = scene;
    this.ROADS = ROADS;
    this.EXTENT = EXTENT;
    this.panicPoints = panicPoints;
    this.getFocus = getFocus;
    this.peds = [];
    for (let i = 0; i < count; i++) this.peds.push(this._makePed());
    this.reset();
  }

  _makePed() {
    const group = new THREE.Group();
    const skin = SKIN[(Math.random() * SKIN.length) | 0];
    const shirt = SHIRT[(Math.random() * SHIRT.length) | 0];
    const pants = PANTS[(Math.random() * PANTS.length) | 0];

    const mkLimb = (w, h, d, mat, px, py) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(0, -h / 2, 0); // pivot at top (hip / shoulder)
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, 0);
      return m;
    };
    const legL = mkLimb(0.13, 0.55, 0.15, pants, 0.10, 0.55);
    const legR = mkLimb(0.13, 0.55, 0.15, pants, -0.10, 0.55);
    const armL = mkLimb(0.10, 0.48, 0.12, shirt, 0.27, 1.12);
    const armR = mkLimb(0.10, 0.48, 0.12, shirt, -0.27, 1.12);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.60, 0.24), shirt);
    torso.position.y = 0.85;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 6), skin);
    head.position.y = 1.31;
    head.castShadow = true;
    group.add(legL, legR, armL, armR, torso, head);
    this.scene.add(group);
    return {
      group, legL, legR, armL, armR,
      pos: new THREE.Vector3(),
      axis: 'z', line: 0, sign: 1,
      speed: 1.1 + Math.random() * 0.5,
      phase: Math.random() * 10,
      panic: 0, fleeX: 0, fleeZ: 0,
      down: 0, downDir: 1,
      scanT: Math.random() * 0.25,
      crossing: false, wasInBand: false,
    };
  }

  /** Platform top ~0.18, road ~0.02 — crossing ke waqt y dip hota hai. */
  _groundY(x, z) {
    for (const r of this.ROADS) {
      if (Math.abs(x - r) < 8.4 || Math.abs(z - r) < 8.4) return 0.03;
    }
    return 0.19;
  }

  /** Focus ke aas-paas random sidewalk spot (minD..maxM doori). */
  _placeNear(fx, fz, minD, maxD) {
    let spot = null;
    for (let t = 0; t < 14; t++) {
      const axis = Math.random() < 0.5 ? 'z' : 'x';
      const r = this.ROADS[(Math.random() * this.ROADS.length) | 0];
      const side = Math.random() < 0.5 ? 1 : -1;
      const along = (Math.random() * 2 - 1) * (this.EXTENT - 4);
      const line = r + side * SIDE;
      const x = axis === 'z' ? line : along;
      const z = axis === 'z' ? along : line;
      spot = { axis, line, side, x, z };
      const d = Math.hypot(x - fx, z - fz);
      if (d >= minD && d <= maxD) return spot;
    }
    return spot; // fallback: koi bhi valid sidewalk spot
  }

  update(dt) {
    const f = this.getFocus();
    for (const p of this.peds) {
      // ---- knocked down: girna, laitna, uthna ----
      if (p.down > 0) {
        p.down -= dt;
        const fall = Math.min(1, (3.5 - p.down) * 6);
        p.group.rotation.z = p.downDir * Math.PI * 0.5 * fall;
        p.group.position.y = this._groundY(p.pos.x, p.pos.z) + 0.18 * fall;
        if (p.down <= 0) { p.group.rotation.z = 0; p.panic = 3; }
        continue;
      }

      // ---- threat scan (staggered, har 0.2s) ----
      p.scanT -= dt;
      if (p.scanT <= 0) {
        p.scanT = 0.2 + Math.random() * 0.1;
        for (const pp of this.panicPoints) {
          if (Math.hypot(pp.x - p.pos.x, pp.z - p.pos.z) < 20) {
            p.panic = Math.max(p.panic, 3.5);
            p.fleeX = pp.x; p.fleeZ = pp.z;
            break;
          }
        }
        const fd = Math.hypot(f.x - p.pos.x, f.z - p.pos.z);
        if (f.speedKmh > 15 && fd < 5) { p.panic = Math.max(p.panic, 2.5); p.fleeX = f.x; p.fleeZ = f.z; }
        if (f.speedKmh > 25 && fd < 1.8) { p.down = 3.5; p.downDir = Math.random() < 0.5 ? 1 : -1; }
      }

      // ---- speed & direction (panic = axis ke saath bhaagna, walls se safe) ----
      let speed = p.speed;
      if (p.panic > 0) {
        p.panic -= dt;
        speed = 3.4;
        const away = p.axis === 'z' ? (p.pos.z - p.fleeZ) : (p.pos.x - p.fleeX);
        if (Math.abs(away) > 0.5) p.sign = away > 0 ? 1 : -1;
      }

      const step = speed * dt;
      if (p.axis === 'z') p.pos.z += p.sign * step; else p.pos.x += p.sign * step;

      // ---- intersection: cross ya reverse (edge-triggered) ----
      const along = p.axis === 'z' ? p.pos.z : p.pos.x;
      let inBand = false;
      for (const r of this.ROADS) { if (Math.abs(along - r) < 9) { inBand = true; break; } }
      if (inBand && !p.wasInBand) {
        if (Math.random() < 0.35) p.crossing = true; else p.sign *= -1;
      } else if (!inBand) p.crossing = false;
      p.wasInBand = inBand;
      if (Math.abs(along) > this.EXTENT + 6) p.sign *= -1;

      // ---- recycling: door wale peds focus ke paas shift ----
      if (Math.hypot(p.pos.x - f.x, p.pos.z - f.z) > 85) {
        const s = this._placeNear(f.x, f.z, 25, 60);
        p.axis = s.axis; p.line = s.line; p.sign = s.side;
        p.pos.set(s.x, 0, s.z);
        p.panic = 0; p.wasInBand = false;
      }

      // ---- walk animation ----
      p.phase += dt * speed * 3.2;
      const amp = p.panic > 0 ? 0.85 : 0.55;
      const sw = Math.sin(p.phase);
      p.legL.rotation.x = sw * amp;
      p.legR.rotation.x = -sw * amp;
      p.armL.rotation.x = -sw * amp * 0.8;
      p.armR.rotation.x = sw * amp * 0.8;
      p.group.position.set(p.pos.x, this._groundY(p.pos.x, p.pos.z), p.pos.z);
      p.group.rotation.y = p.axis === 'z'
        ? (p.sign > 0 ? 0 : Math.PI)
        : (p.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }

  stats() {
    let walking = 0, panicking = 0, down = 0;
    for (const p of this.peds) {
      if (p.down > 0) down++;
      else if (p.panic > 0) panicking++;
      else walking++;
    }
    return { count: this.peds.length, walking, panicking, down };
  }

  reset() {
    const f = this.getFocus();
    for (const p of this.peds) {
      const s = this._placeNear(f.x, f.z, 6, 55);
      p.axis = s.axis; p.line = s.line; p.sign = s.side;
      p.pos.set(s.x, 0, s.z);
      p.panic = 0; p.down = 0; p.wasInBand = false;
      p.group.rotation.z = 0;
      p.group.position.set(p.pos.x, this._groundY(p.pos.x, p.pos.z), p.pos.z);
    }
  }
}

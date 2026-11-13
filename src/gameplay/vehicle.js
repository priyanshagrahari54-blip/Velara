import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// designed-model loader (factory assets: velara-gt/titan-rs/... Draco GLBs)
let _loader = null;
function designedLoader() {
  if (!_loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath('draco/');

    _loader = new GLTFLoader();
    _loader.setDRACOLoader(draco);
  }
  return _loader;
}

// ---------------------------------------------------------------------------
// VELARA vehicles: raycast-vehicle physics + procedural mesh + lights + smoke.
// One class, MANY personalities — every preset drives a different feel
// (ADR-006: per-vehicle governor/dynamics, shared physics material).
// ---------------------------------------------------------------------------

// Presets: each vehicle must FEEL different in 10 seconds of driving.
export const VEHICLE_PRESETS = {
  police: {
    id: 'police', name: 'Police Interceptor', shape: 'muscle',
    desc: 'Chase machine — lightbar ke saath',
    glb: 'assets/vehicles/police.glb',
    paint: 0xe8eaee, glow: 0x35e0ff, tail: 0xff2233,
    mass: 1300, engine: 5000, reverse: 2200, brake: 36, steer: 0.52, topKmh: 195,
    slip: 2.8, wheelR: 0.34, width: 1.92, length: 4.9, cabinL: 1.95, cabinH: 0.62,
    horn: [392, 494], spotI: 90,
  },
  coupe: {
    id: 'coupe',
    glb: 'assets/vehicles/velara-gt.glb', name: 'Velara GT', shape: 'coupe',
    desc: 'Drift king — balanced and playful',
    paint: 0x10151d, glow: 0xff2fd8, tail: 0xff2233,
    mass: 950, engine: 4200, reverse: 2100, brake: 32, steer: 0.55, topKmh: 185,
    slip: 2.5, wheelR: 0.42, width: 1.96, length: 4.5, cabinL: 2.05, cabinH: 0.46,
    horn: [392, 494], spotI: 85,
  },
  muscle: {
    id: 'muscle',
    glb: 'assets/vehicles/titan-rs.glb', name: 'Titan RS', shape: 'muscle',
    desc: 'Heavy muscle — brutal straight-line power',
    paint: 0x571016, glow: 0xff7a00, tail: 0xff3311,
    mass: 1250, engine: 5600, reverse: 2400, brake: 36, steer: 0.5, topKmh: 210,
    slip: 3.1, wheelR: 0.45, width: 2.06, length: 4.9, cabinL: 1.85, cabinH: 0.42,
    horn: [220, 277], spotI: 95,
  },
  hatch: {
    id: 'hatch',
    glb: 'assets/vehicles/pico-s.glb', name: 'Pico S', shape: 'hatch',
    desc: 'Nimble city runabout — quick and flickable',
    paint: 0xd9a514, glow: 0x35e0ff, tail: 0xff2233,
    mass: 760, engine: 2500, reverse: 1300, brake: 30, steer: 0.62, topKmh: 150,
    slip: 2.2, wheelR: 0.38, width: 1.78, length: 3.6, cabinL: 1.7, cabinH: 0.52,
    horn: [523, 659], spotI: 70,
  },
  van: {
    id: 'van',
    glb: 'assets/vehicles/colossus-v.glb', name: 'Colossus V', shape: 'van',
    desc: 'A 2800-pound battering ram — nothing survives',
    paint: 0x2a6f97, glow: 0x9fe8ff, tail: 0xff2233,
    mass: 1750, engine: 3900, reverse: 2000, brake: 40, steer: 0.48, topKmh: 125,
    slip: 2.8, wheelR: 0.46, width: 2.1, length: 5.2, cabinL: 4.4, cabinH: 1.05,
    horn: [165, 208], spotI: 100,
  },
};

// ONE shared contact material for every player vehicle (contact rules once).
let SHARED_MAT = null;
export function getVehiclePhysMat() {
  if (!SHARED_MAT) SHARED_MAT = new CANNON.Material('playerVehicle');
  return SHARED_MAT;
}

export class GameVehicle {
  constructor(scene, world, spawn, preset = VEHICLE_PRESETS.coupe) {
    this.scene = scene;
    this.world = world;
    this.preset = preset;
    this.spawn = { x: spawn.x, z: spawn.z, yaw: spawn.yaw || 0 };
    const P = preset;

    // ---------------------------------------------------------- physics
    this.physMat = getVehiclePhysMat();
    const chassisBody = new CANNON.Body({
      mass: P.mass,
      material: this.physMat,
      position: new CANNON.Vec3(spawn.x, spawn.y, spawn.z),
    });
    chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(P.width / 2 - 0.02, 0.4, P.length / 2 - 0.02)));
    if (P.shape === 'van') {
      chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(P.width / 2 - 0.12, 0.5, P.length / 2 - 0.6)), new CANNON.Vec3(0, 0.85, 0.1));
    } else {
      chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(P.width / 2 - 0.15, 0.32, P.cabinL / 2)), new CANNON.Vec3(0, 0.55, 0.2));
    }
    chassisBody.angularDamping = 0.4;
    chassisBody.linearDamping = 0.03;
    this.body = chassisBody;

    const vehicle = new CANNON.RaycastVehicle({
      chassisBody,
      indexRightAxis: 0,
      indexForwardAxis: 2,
      indexUpAxis: 1,
    });
    this.vehicle = vehicle;

    const wheelOptions = {
      radius: P.wheelR,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: P.shape === 'van' ? 150 : P.shape === 'muscle' ? 175 : 160,
      suspensionRestLength: P.wheelR,
      frictionSlip: P.slip,
      dampingRelaxation: 4.0,
      dampingCompression: 6.4,
      maxSuspensionForce: 250000,
      rollInfluence: P.shape === 'van' ? 0.06 : 0.04,
      axleLocal: new CANNON.Vec3(1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
      maxSuspensionTravel: 0.35,
      customSlidingRotationalSpeed: -32,
      useCustomSlidingRotationalSpeed: true,
    };

    const cx = P.width / 2 - 0.06;
    const czf = -(P.length / 2 - 0.83);
    const czr = P.length / 2 - 0.81;
    const cy = -0.02;
    wheelOptions.chassisConnectionPointLocal.set(cx, cy, czf);
    vehicle.addWheel(wheelOptions); // FL
    wheelOptions.chassisConnectionPointLocal.set(-cx, cy, czf);
    vehicle.addWheel(wheelOptions); // FR
    wheelOptions.chassisConnectionPointLocal.set(cx, cy, czr);
    vehicle.addWheel(wheelOptions); // RL
    wheelOptions.chassisConnectionPointLocal.set(-cx, cy, czr);
    vehicle.addWheel(wheelOptions); // RR

    vehicle.addToWorld(world);

    // ------------------------------------------------------------- mesh
    this.group = new THREE.Group();
    this._buildMesh(P);
    scene.add(this.group);

    // ------------------------------------------------------------- wheels
    this.wheelMeshes = [];
    const tireGeo = new THREE.CylinderGeometry(P.wheelR, P.wheelR, 0.33, 20);
    tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(P.wheelR * 0.62, P.wheelR * 0.62, 0.35, 12);
    rimGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.25, metalness: 0.95 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      tire.castShadow = true;
      g.add(tire); g.add(rim);
      scene.add(g);
      this.wheelMeshes.push(g);
    }

    // -------------------------------------------------------------- smoke
    this._initSmoke();
    this.smokeTimer = 0;

    this.steerCurrent = 0;
    this.driftAmount = 0;

    // ---------------------------------------- designed model (factory GLB)
    this.glbModel = null;
    this.glbWheels = null;
    this.glbTail = null;
  }

  /** Designed GLB load (ek baar) — procedural body/wheels chhup jaate hain. */
  ensureGLB() {
    if (this.glbModel !== null || !this.preset.glb) return;
    this.glbModel = false;                     // loading marker
    designedLoader().load(this.preset.glb, (gltf) => {
      const m = gltf.scene;
      const wheels = [];
      let tail = null;
      m.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = false;
        }
        if (o.name === 'WheelFL' || o.name === 'WheelFR'
            || o.name === 'WheelRL' || o.name === 'WheelRR') wheels.push(o);
        if (o.name === 'LightRear') tail = o;
      });
      this.group.add(m);
      // procedural body chhupao (group children pehle se the)
      for (const c of this.group.children) {
        if (c !== m) c.visible = false;
      }
      for (const w of this.wheelMeshes) w.visible = false;
      this.glbModel = m;
      this.glbWheels = wheels.length === 4 ? wheels : null;
      this.glbTail = tail;
    }, undefined, () => { this.glbModel = null; });   // fail = procedural pe raho
  }

  _buildMesh(P) {
    const paint = new THREE.MeshPhysicalMaterial({
      color: P.paint, metalness: 0.85, roughness: 0.3,
      clearcoat: 1.0, clearcoatRoughness: 0.12, envMapIntensity: 1.4,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x05070c, metalness: 0.9, roughness: 0.06, envMapIntensity: 1.8,
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.7, metalness: 0.4 });
    const g = this.group;
    const W = P.width, L = P.length;
    const cast = [];

    const addBox = (mat, w, h, l, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z);
      if (shadow) { m.castShadow = true; cast.push(m); }
      g.add(m);
      return m;
    };

    // body core
    addBox(paint, W, 0.52, L, 0, 0.02, 0);
    addBox(paint, W - 0.1, 0.3, 0.7, 0, 0.16, -(L / 2 + 0.07)); // nose

    if (P.shape === 'van') {
      addBox(paint, W - 0.14, 0.98, L - 0.9, 0, 0.75, 0.25);        // tall cargo box
      addBox(glass, W - 0.34, 0.4, 0.1, 0, 0.86, -(L / 2 - 0.18));  // windshield
      addBox(trim, W - 0.2, 0.09, L - 1.3, 0, 1.28, 0.3);           // roof rack
      addBox(trim, 0.08, 0.5, 0.08, W / 2 - 0.3, 0.9, 1.4);         // rack posts
      addBox(trim, 0.08, 0.5, 0.08, -(W / 2 - 0.3), 0.9, 1.4);
      addBox(trim, 0.08, 0.5, 0.08, W / 2 - 0.3, 0.9, -0.8);
      addBox(trim, 0.08, 0.5, 0.08, -(W / 2 - 0.3), 0.9, -0.8);
    } else if (P.shape === 'hatch') {
      addBox(glass, W - 0.3, P.cabinH, P.cabinL, 0, 0.52, 0.15);
      addBox(paint, W - 0.44, 0.08, P.cabinL - 0.7, 0, 0.52 + P.cabinH / 2, 0.18);
      addBox(trim, 0.1, 0.14, P.cabinL - 0.6, W / 2 - 0.12, 0.62 + P.cabinH / 2, 0.18); // roof rails
      addBox(trim, 0.1, 0.14, P.cabinL - 0.6, -(W / 2 - 0.12), 0.62 + P.cabinH / 2, 0.18);
    } else if (P.shape === 'muscle') {
      addBox(glass, W - 0.3, P.cabinH, P.cabinL, 0, 0.52, 0.38);
      addBox(paint, W - 0.46, 0.08, P.cabinL - 0.8, 0, 0.78, 0.4);
      addBox(trim, 0.5, 0.12, 0.8, 0, 0.62, -(L / 2 - 1.1));        // hood scoop
      addBox(trim, W - 0.18, 0.09, 0.5, 0, 0.72, L / 2 - 0.25);     // big spoiler
      addBox(trim, 0.09, 0.3, 0.09, W / 2 - 0.25, 0.56, L / 2 - 0.25);
      addBox(trim, 0.09, 0.3, 0.09, -(W / 2 - 0.25), 0.56, L / 2 - 0.25);
    } else { // coupe (hero) — sports silhouette: wedge nose, tapered canopy
      const cab = addBox(glass, W - 0.3, P.cabinH * 0.62, P.cabinL * 0.86, 0, 0.5, 0.3);
      cab.scale.set(1, 1, 1);
      const roof = addBox(paint, W - 0.62, 0.09, P.cabinL * 0.55, 0, 0.5 + P.cabinH * 0.62 + 0.04, 0.42);
      roof.scale.z = 1;
      const wsF = addBox(glass, W - 0.4, 0.09, 0.9, 0, 0.72, 0.3 - P.cabinL * 0.5 - 0.1);
      wsF.rotation.x = -0.62;                                     // raked windshield
      const wsR = addBox(glass, W - 0.4, 0.09, 0.7, 0, 0.72, 0.3 + P.cabinL * 0.5 + 0.06);
      wsR.rotation.x = 0.55;                                      // raked rear glass
      addBox(trim, 0.16, 0.07, 0.1, W / 2 - 0.18, 0.78, 0.3 - P.cabinL * 0.5 + 0.18);  // mirrors
      addBox(trim, 0.16, 0.07, 0.1, -(W / 2 - 0.18), 0.78, 0.3 - P.cabinL * 0.5 + 0.18);
      addBox(trim, W - 0.18, 0.07, 0.45, 0, 0.68, L / 2 - 0.05);  // spoiler
      addBox(trim, 0.08, 0.24, 0.08, W / 2 - 0.28, 0.55, L / 2 - 0.05);
      addBox(trim, 0.08, 0.24, 0.08, -(W / 2 - 0.28), 0.55, L / 2 - 0.05);
      addBox(trim, W - 0.5, 0.07, 0.5, 0, -0.26, -(L / 2 - 0.15)); // front splitter
      addBox(trim, 0.09, 0.09, 0.3, 0.42, -0.1, L / 2 - 0.02);     // exhausts
      addBox(trim, 0.09, 0.09, 0.3, -0.42, -0.1, L / 2 - 0.02);
    }

    // side skirts
    addBox(trim, 0.12, 0.16, L - 1.1, W / 2 - 0.02, -0.18, 0);
    addBox(trim, 0.12, 0.16, L - 1.1, -(W / 2 - 0.02), -0.18, 0);

    // lights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xd8ecff });
    addBox(hlMat, 0.44, 0.13, 0.08, 0.62, 0.22, -(L / 2 + 0.02), false);
    addBox(hlMat, 0.44, 0.13, 0.08, -0.62, 0.22, -(L / 2 + 0.02), false);
    this.tailMat = new THREE.MeshBasicMaterial({ color: P.tail });
    addBox(this.tailMat, W - 0.26, 0.11, 0.07, 0, 0.3, L / 2 + 0.02, false);

    // underglow (fake light pool)
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.6, L + 0.5),
      new THREE.MeshBasicMaterial({
        color: P.glow, transparent: true, opacity: 0.30,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.52;
    g.add(glow);

    // headlight spots
    this.spots = [];
    for (const sx of [0.62, -0.62]) {
      const spot = new THREE.SpotLight(0xcfe0ff, P.spotI, 60, 0.5, 0.45, 1.6);
      spot.position.set(sx, 0.25, -(L / 2 - 0.1));
      const tgt = new THREE.Object3D();
      tgt.position.set(sx * 1.6, -0.6, -14);
      g.add(tgt);
      spot.target = tgt;
      g.add(spot);
      this.spots.push(spot);
    }
  }

  _initSmoke() {
    const N = this.smokeCount = 240;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const alpha = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -999; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0x9fa8b5) } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying float vA;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (170.0 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.08, d) * vA;
          if (a < 0.003) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.smoke = new THREE.Points(geo, mat);
    this.smoke.frustumCulled = false;
    this.scene.add(this.smoke);
    this.smokeData = { life: new Float32Array(N), vel: new Float32Array(N * 3), max: new Float32Array(N), cursor: 0 };
  }

  spawnSmoke(x, y, z, strength) {
    const d = this.smokeData;
    const i = d.cursor; d.cursor = (d.cursor + 1) % this.smokeCount;
    const pos = this.smoke.geometry.attributes.position;
    const size = this.smoke.geometry.attributes.aSize;
    const alpha = this.smoke.geometry.attributes.aAlpha;
    pos.setXYZ(i, x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
    d.vel[i * 3] = (Math.random() - 0.5) * 1.2;
    d.vel[i * 3 + 1] = 0.8 + Math.random() * 1.0;
    d.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    d.life[i] = d.max[i] = 0.7 + Math.random() * 0.5;
    size.setX(i, 0.9 + strength * 1.2);
    alpha.setX(i, 0.3 * strength);
  }

  _updateSmoke(dt) {
    const d = this.smokeData;
    const pos = this.smoke.geometry.attributes.position;
    const size = this.smoke.geometry.attributes.aSize;
    const alpha = this.smoke.geometry.attributes.aAlpha;
    for (let i = 0; i < this.smokeCount; i++) {
      if (d.life[i] <= 0) continue;
      d.life[i] -= dt;
      if (d.life[i] <= 0) { pos.setY(i, -999); alpha.setX(i, 0); continue; }
      pos.setXYZ(i,
        pos.getX(i) + d.vel[i * 3] * dt,
        pos.getY(i) + d.vel[i * 3 + 1] * dt,
        pos.getZ(i) + d.vel[i * 3 + 2] * dt);
      size.setX(i, size.getX(i) + 2.6 * dt);
      alpha.setX(i, 0.32 * (d.life[i] / d.max[i]));
    }
    pos.needsUpdate = true; size.needsUpdate = true; alpha.needsUpdate = true;
  }

  // ------------------------------------------------------------------ api
  getForwardVector(out) {
    out.set(0, 0, -1).applyQuaternion(this.group.quaternion);
    return out;
  }

  getForwardSpeed() {
    const v = this.body.velocity;
    const f = this.getForwardVector(new THREE.Vector3());
    return v.x * f.x + v.y * f.y + v.z * f.z;
  }

  getSpeedKmh() { return this.body.velocity.length() * 3.6; }

  getGear() {
    const fs = this.getForwardSpeed() * 3.6;
    if (fs < -0.5) return 'R';
    if (Math.abs(fs) < 0.5) return 'N';
    const th = [0, 22, 42, 66, 96, 132];
    for (let i = th.length - 1; i >= 0; i--) if (fs > th[i]) return String(i + 1);
    return '1';
  }

  getRpm(throttle) {
    const top = this.preset.topKmh * 0.86;
    const kmh = Math.min(Math.abs(this.getForwardSpeed() * 3.6), top);
    return Math.min(1, 0.1 + (kmh / top) * 0.75 + Math.abs(throttle) * 0.2);
  }

  reset(x, z, yaw = 0) {
    this.body.position.set(x, 1.2, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw);
    this.body.quaternion.copy(q);
  }

  resetToSpawn() { this.reset(this.spawn.x, this.spawn.z, this.spawn.yaw); }

  isFlipped() {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
    return up.y < 0.25;
  }

  update(dt, input, env) {
    const v = this.vehicle;
    const P = this.preset;
    const massK = P.mass / 950;

    // steering with speed-sensitive limit
    const kmh = this.getSpeedKmh();
    const maxNow = P.steer / (1 + kmh * 0.014);
    const target = input.steer * maxNow;
    this.steerCurrent += (target - this.steerCurrent) * Math.min(1, dt * 9);
    v.setSteeringValue(this.steerCurrent, 0);
    v.setSteeringValue(this.steerCurrent, 1);

    // throttle / brake / reverse — per-vehicle speed limiter (ADR-005/006)
    const fs = this.getForwardSpeed();
    let engine = 0, brake = 0;
    const governed = fs * 3.6 > P.topKmh;
    if (input.throttle > 0.02) {
      if (fs < -1.2) brake = P.brake;
      else engine = governed ? 0 : P.engine * input.throttle;
    } else if (input.throttle < -0.02) {
      if (fs > 1.2) brake = P.brake * 0.9;
      else engine = P.reverse * input.throttle; // negative => reverse
    } else {
      brake = 2.2; // engine drag
    }

    const handbrake = input.handbrake;
    v.applyEngineForce(engine * 0.42, 0);
    v.applyEngineForce(engine * 0.42, 1);
    v.applyEngineForce(engine * 0.58, 2);
    v.applyEngineForce(engine * 0.58, 3);

    const parked = input.parked ? 20 : 0;
    v.setBrake(brake * 0.55 + parked, 0);
    v.setBrake(brake * 0.55 + parked, 1);
    v.setBrake(brake + (handbrake ? 26 : 0) + parked, 2);
    v.setBrake(brake + (handbrake ? 26 : 0) + parked, 3);

    // grip: handbrake releases rear grip => drift
    const rearSlip = handbrake ? 1.05 : P.slip;
    v.wheelInfos[2].frictionSlip = rearSlip;
    v.wheelInfos[3].frictionSlip = rearSlip;

    // downforce at speed (applied at center of mass — no lever arm! ADR-001)
    if (kmh > 30) {
      const f = -Math.min(kmh, 160) * 26 * massK;
      this.body.applyForce(new CANNON.Vec3(0, f, 0));
    }

    // arcade self-righting when tipped over at low speed
    this._up = this._up || new THREE.Vector3();
    this._up.set(0, 1, 0).applyQuaternion(this.group.quaternion);
    if (this._up.y < 0.65 && this.body.velocity.length() < 6) {
      const k = 2600 * (1 - this._up.y) * massK;
      this.body.applyTorque(new CANNON.Vec3(-this._up.z * k, 0, this._up.x * k));
    }

    // tame physics blow-ups: clamp wild spinning
    {
      const av = this.body.angularVelocity;
      const am = Math.hypot(av.x, av.y, av.z);
      if (am > 7) { const s = 7 / am; av.x *= s; av.y *= s; av.z *= s; }
    }

    // drift detection (lateral slip)
    const vel = this.body.velocity;
    const fwd = this.getForwardVector(new THREE.Vector3());
    const lat = new THREE.Vector3(vel.x, 0, vel.z);
    const f2 = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
    const along = lat.dot(f2);
    const latSpeed = Math.sqrt(Math.max(0, lat.lengthSq() - along * along));
    const drifting = latSpeed > 3.4 && Math.abs(along) > 4;
    this.driftAmount = drifting ? Math.min(1, latSpeed / 10) : Math.max(0, this.driftAmount - dt * 3);

    // tire smoke
    this.smokeTimer -= dt;
    if ((drifting || (handbrake && kmh > 12)) && this.smokeTimer <= 0) {
      this.smokeTimer = 0.016;
      for (const wi of [2, 3]) {
        v.updateWheelTransform(wi);
        const wt = v.wheelInfos[wi].worldTransform;
        this.spawnSmoke(wt.position.x, wt.position.y + 0.15, wt.position.z,
          drifting ? this.driftAmount : 0.5);
      }
    }

    // sync meshes
    this.group.position.copy(this.body.position);
    this.group.quaternion.copy(this.body.quaternion);
    for (let i = 0; i < 4; i++) {
      v.updateWheelTransform(i);
      const wt = v.wheelInfos[i].worldTransform;
      const m = this.wheelMeshes[i];
      m.position.copy(wt.position);
      m.quaternion.copy(wt.quaternion);
      if (this.glbWheels) {
        const g = this.glbWheels[i];
        g.position.copy(wt.position);
        g.quaternion.copy(wt.quaternion);
      }
    }
    if (this.glbTail && this.glbTail.material && this.glbTail.material.emissiveIntensity !== undefined) {
      const hot = brake > 5 || handbrake;
      this.glbTail.material.emissiveIntensity = hot ? 8 : 4;
    }

    // brake lights
    this.tailMat.color.setHex(brake > 5 || handbrake ? 0xff5566 : this.preset.tail);

    // headlights dim in daytime
    const day = env.timeName === 'day';
    for (const s of this.spots) s.intensity = day ? 12 : this.preset.spotI;

    this._updateSmoke(dt);

    return { drifting, kmh, brake, engine };
  }
}

// Back-compat alias (older imports / tests).
export const HeroCar = GameVehicle;

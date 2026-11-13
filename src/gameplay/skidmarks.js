import * as THREE from 'three';

// ---------------------------------------------------------------------------
// SKIDMARKS — tyre slip marks on asphalt (remaster: sim-physics ka visual proof)
// Ek InstancedMesh + ring buffer; instanceColor se fade (asphalt ki taraf lerp).
// ---------------------------------------------------------------------------

let _singleton = null;
export function getSkidMarks(scene) {
  if (!_singleton) _singleton = new SkidMarks(scene);
  return _singleton;
}

export class SkidMarks {
  constructor(scene, max = 300) {
    this.max = max;
    this.cursor = 0;
    this.life = new Float32Array(max);
    this.strength = new Float32Array(max);
    const geo = new THREE.PlaneGeometry(0.3, 0.85);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2,
      transparent: true, opacity: 0.9, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    // init: sab invisible
    const M = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, M);
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);

    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._up = new THREE.Vector3(0, 1, 0);
    this._road = new THREE.Color(0x33363b);   // asphalt base — fade target
  }

  add(x, y, z, yaw, strength = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this._p.set(x, y + 0.025, z);
    this._q.setFromAxisAngle(this._up, yaw);
    this._s.set(0.8 + strength * 0.5, 1, 1.15);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
    this.life[i] = 8 + strength * 3;
    this.strength[i] = strength;
    this._c.setRGB(0.05, 0.05, 0.06);       // fresh rubber — dark
    this.mesh.setColorAt(i, this._c);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / 11);       // 1 → 0
      // fade: rubber color → asphalt
      const k = 0.05 + (1 - t) * (this._road.r - 0.05);
      this._c.setRGB(k, k, k + 0.01);
      this.mesh.setColorAt(i, this._c);
      if (this.life[i] <= 0) {
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
      }
      dirty = true;
    }
    if (dirty) {
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

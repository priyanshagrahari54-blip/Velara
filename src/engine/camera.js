import * as THREE from 'three';

// ---------------------------------------------------------------------------
// CameraRig — third-person camera for foot & car modes.
// Handles orbit, follow, collision, screen shake, speed-FOV, intro fly-in.
// Engine module: reads player/car state, never mutates it.
// ---------------------------------------------------------------------------

export class CameraRig {
  constructor(camera, { player, car, getCollidibles, getMode }) {
    this.camera = camera;
    this.player = player;
    this.car = car;
    this.getCollidibles = getCollidibles;
    this.getMode = getMode;

    this.yaw = Math.PI;
    this.pitch = 0.16;
    this.dist = 4.6;
    this.distToggle = 0;
    this.mouseYawOffset = 0;
    this.smoothCarYaw = 0;
    this.shake = 0;
    this.introT = 0;
    this.fovCurrent = 62;

    // aim mode (over-the-shoulder) + recoil spring
    this.aimBlend = 0;
    this._aimTarget = 0;
    this._recoil = 0;

    this.raycaster = new THREE.Raycaster();
    this._v1 = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
  }

  startIntro() { this.introT = 2.4; }

  addShake(v) { this.shake = Math.min(1, this.shake + v); }

  /** Weapon recoil: view kicks up instantly, springs back over ~0.3s. */
  addRecoil(k) {
    this.pitch = Math.max(-0.35, this.pitch - k);
    this._recoil = Math.min(0.25, this._recoil + k);
  }

  setAiming(v) { this._aimTarget = v ? 1 : 0; }

  applyLook(dx, dy) {
    const sens = 0.0023;
    if (this.getMode() === 'car') {
      this.mouseYawOffset = Math.max(-2.6, Math.min(2.6, this.mouseYawOffset - dx * sens));
    } else {
      this.yaw -= dx * sens;
    }
    this.pitch = Math.max(-0.35, Math.min(1.25, this.pitch + dy * sens));
  }

  zoom(dir) {
    this.dist = Math.max(3, Math.min(16, this.dist + dir * 0.8));
  }

  cycleDist() {
    this.distToggle = (this.distToggle + 1) % 2;
    this.dist = this.getMode() === 'car'
      ? [8.2, 12.5][this.distToggle]
      : [4.6, 7.5][this.distToggle];
  }

  update(dt) {
    const cam = this.camera;
    const mode = this.getMode();

    // ---------------- intro cinematic ----------------
    if (this.introT > 0) {
      this.introT -= dt;
      const t = 1 - Math.max(0, this.introT) / 2.4;
      const e = 1 - Math.pow(1 - t, 3);
      this.player.headPosition(this._v1);
      this._v2.set(
        this._v1.x + 16 * (1 - e) + Math.sin(this.yaw) * 4.6 * e,
        this._v1.y + 11 * (1 - e) + Math.sin(this.pitch) * 4.6 * e,
        this._v1.z + 16 * (1 - e) + Math.cos(this.yaw) * 4.6 * e);
      cam.position.copy(this._v2);
      cam.lookAt(this._v1);
      return;
    }

    // ---------------- anchor & framing ----------------
    let target, dist, yaw;
    if (mode === 'car') {
      const c = this.car.body.position;
      const f = this.car.getForwardVector(this._v2);
      const carYaw = Math.atan2(-f.x, -f.z);
      let diff = carYaw - this.smoothCarYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.smoothCarYaw += diff * Math.min(1, dt * 6.5); // snappier follow
      this.mouseYawOffset *= Math.max(0, 1 - dt * 2.2);
      yaw = this.smoothCarYaw + this.mouseYawOffset;
      target = this._v1.set(c.x, c.y + 1.1, c.z);
      dist = this.dist + Math.min(this.car.getSpeedKmh(), 150) * 0.014;
    } else {
      yaw = this.yaw;
      this.player.headPosition(this._v1);
      target = this._v1;
      dist = this.dist;
    }

    // ---------------- aim mode (OTS shoulder + zoom) ----------------
    this.aimBlend += (this._aimTarget - this.aimBlend) * Math.min(1, dt * 11);
    if (mode !== 'car' && this.aimBlend > 0.002) {
      const a = this.aimBlend;
      dist = dist + (1.85 - dist) * a;
      // camera-right vector for the shoulder offset
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      target.x += rx * 0.55 * a;
      target.z += rz * 0.55 * a;
      target.y += 0.1 * a;
    }

    // ---------------- recoil recovery ----------------
    if (this._recoil > 0) {
      const r = Math.min(this._recoil, dt * (this._recoil * 9 + 0.03));
      this.pitch = Math.min(1.25, this.pitch + r);
      this._recoil -= r;
    }

    // ---------------- orbit position ----------------
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const desired = this._v2.set(
      target.x + Math.sin(yaw) * cp * dist,
      target.y + sp * dist + 0.25,
      target.z + Math.cos(yaw) * cp * dist);

    // ---------------- collision (never clip walls) ----------------
    this.raycaster.set(target, desired.clone().sub(target).normalize());
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.getCollidibles(), false);
    let d = dist;
    if (hits.length > 0 && hits[0].distance < dist) d = Math.max(1.2, hits[0].distance * 0.88);
    const dirx = desired.x - target.x, diry = desired.y - target.y, dirz = desired.z - target.z;
    const dl = Math.hypot(dirx, diry, dirz) || 1;
    cam.position.set(
      target.x + (dirx / dl) * d,
      Math.max(0.35, target.y + (diry / dl) * d),
      target.z + (dirz / dl) * d);

    // ---------------- shake ----------------
    if (this.shake > 0.002) {
      cam.position.x += (Math.random() - 0.5) * 0.3 * this.shake;
      cam.position.y += (Math.random() - 0.5) * 0.3 * this.shake;
      this.shake *= Math.max(0, 1 - dt * 3.4);
    }

    // ---------------- look target ----------------
    if (mode === 'car') {
      const f = this.car.getForwardVector(this._v2);
      cam.lookAt(target.x + f.x * 2.5, target.y + 0.1, target.z + f.z * 2.5);
    } else if (this.aimBlend > 0.002) {
      // AIM: yaw/pitch directly drive the view — the crosshair IS the bullet
      // direction (a lookAt-head scheme inverts control when the camera dips
      // below head height — bullets would fly up; found via smoke-test M4).
      this._euler = this._euler || new THREE.Euler();
      this._q1 = this._q1 || new THREE.Quaternion();
      this._euler.set(-this.pitch, this.yaw, 0, 'YXZ');
      this._q1.setFromEuler(this._euler);
      if (this.aimBlend >= 0.999) {
        cam.quaternion.copy(this._q1);
      } else {
        cam.lookAt(target.x, target.y + 0.1, target.z);
        cam.quaternion.slerp(this._q1, this.aimBlend);
      }
    } else {
      cam.lookAt(target.x, target.y + 0.1, target.z);
    }

    // ---------------- speed FOV (+ aim zoom) ----------------
    const targetFov = 62 + (mode === 'car'
      ? Math.min(this.car.getSpeedKmh(), 160) * 0.055
      : -this.aimBlend * 14);
    if (Math.abs(targetFov - this.fovCurrent) > 0.05) {
      this.fovCurrent += (targetFov - this.fovCurrent) * Math.min(1, dt * 4);
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
    }
  }
}

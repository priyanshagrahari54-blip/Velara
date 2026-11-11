import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// VELARA player: capsule physics body + articulated hero mesh
// ---------------------------------------------------------------------------

const WALK = 4.3;
const RUN = 7.4;
const JUMP_V = 7.0;

export class Player {
  constructor(scene, world, groundMat, spawn) {
    this.scene = scene;
    this.world = world;

    // ------------------------------------------------------------ physics
    this.physMat = new CANNON.Material('player');
    const body = this.body = new CANNON.Body({
      mass: 78,
      material: this.physMat,
      position: new CANNON.Vec3(spawn.x, spawn.y, spawn.z),
      fixedRotation: true,
      linearDamping: 0.02,
      collisionFilterGroup: 2,
      collisionFilterMask: -1,
    });
    body.addShape(new CANNON.Sphere(0.42), new CANNON.Vec3(0, 0, 0));
    body.addShape(new CANNON.Sphere(0.34), new CANNON.Vec3(0, 0.8, 0));
    body.allowSleep = false;
    world.addBody(body);

    this.grounded = false;
    this.phase = 0;
    this.facing = 0;
    this.speed2d = 0;

    // weapon pose state (driven by WeaponManager via game)
    this.aiming = false;
    this.aimPitch = 0;
    this.gun = null;

    this._buildMesh();
    this.group.position.set(spawn.x, spawn.y - 0.42, spawn.z);
    scene.add(this.group);
  }

  _buildMesh() {
    const g = this.group = new THREE.Group();

    const jacket = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.72, metalness: 0.05 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x28324a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.6 });
    const hairM = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.55 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.5 });
    const hoodM = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.85 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0x35e0ff });

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.24), jeans);
    pelvis.position.y = 1.02;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.28), jacket);
    torso.position.y = 1.38;
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.32), hoodM);
    collar.position.set(0, 1.63, 0.01);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.02), glowM);
    strip.position.set(0, 1.5, -0.155);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
    head.position.y = 1.79;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.158, 14, 10), hairM);
    hair.position.set(0, 1.83, 0.03);
    hair.scale.set(1, 0.95, 1);
    g.add(pelvis, torso, collar, strip, head, hair);

    // arms (pivot at shoulder)
    this.armL = new THREE.Group(); this.armL.position.set(0.27, 1.58, 0);
    this.armR = new THREE.Group(); this.armR.position.set(-0.27, 1.58, 0);
    for (const [arm, side] of [[this.armL, 1], [this.armR, -1]]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.13), jacket);
      up.position.y = -0.17;
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.11), jacket);
      fore.position.y = -0.49;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skin);
      hand.position.y = -0.68;
      arm.add(up, fore, hand);
      g.add(arm);
    }

    // legs (pivot at hip)
    this.legL = new THREE.Group(); this.legL.position.set(0.11, 1.0, 0);
    this.legR = new THREE.Group(); this.legR.position.set(-0.11, 1.0, 0);
    for (const leg of [this.legL, this.legR]) {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.17), jeans);
      thigh.position.y = -0.21;
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.14), jeans);
      shin.position.y = -0.61;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.3), shoe);
      foot.position.set(0, -0.85, -0.05);
      leg.add(thigh, shin, foot);
      g.add(leg);
    }

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  }

  removeFromWorld() { this.world.removeBody(this.body); }
  addToWorld() { this.world.addBody(this.body); }

  get position() { return this.body.position; }

  /** Attach a weapon mesh to the right hand (null = holstered/none). */
  setGun(gun) {
    if (this.gun) this.armR.remove(this.gun);
    this.gun = gun;
    if (gun) {
      gun.position.set(0, -0.66, -0.03);
      gun.rotation.set(-Math.PI / 2, 0, 0); // barrel along the arm
      this.armR.add(gun);
    }
  }

  /** World-space muzzle position for tracers/flash. */
  getMuzzleWorld(out) {
    if (this.gun && this.gun.userData.muzzle) {
      return this.gun.userData.muzzle.getWorldPosition(out);
    }
    this.armR.getWorldPosition(out);
    return out;
  }

  headPosition(out) {
    return out.set(this.body.position.x, this.body.position.y + 1.35, this.body.position.z);
  }

  respawn(x, y, z) {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
  }

  update(dt, input, camYaw) {
    // ground ray (ignores player's own body via collision filters)
    const p = this.body.position;
    const from = new CANNON.Vec3(p.x, p.y, p.z);
    const to = new CANNON.Vec3(p.x, p.y - 0.62, p.z);
    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(from, to, {
      collisionFilterGroup: 4, collisionFilterMask: 1 | 8, skipBackfaces: true,
    }, result);
    this.grounded = result.hasHit;

    // movement basis from camera yaw
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    let dx = input.x * c - input.z * s;
    let dz = -input.x * s - input.z * c;
    const len = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (len > 0.01) {
      dx /= len; dz /= len;
      let spd = input.sprint ? RUN : WALK;
      if (this.aiming) spd *= 0.55; // aimed movement is deliberate (hardcore tone)
      vx = dx * spd; vz = dz * spd;
    }
    this.speed2d = Math.hypot(vx, vz);

    const vel = this.body.velocity;
    if (this.grounded) {
      const k = Math.min(1, dt * 14);
      vel.x += (vx - vel.x) * k;
      vel.z += (vz - vel.z) * k;
      if (input.jump) {
        vel.y = JUMP_V;
        this.grounded = false;
      }
    } else {
      const k = Math.min(1, dt * 2.2);
      vel.x += (vx - vel.x) * k * 0.5;
      vel.z += (vz - vel.z) * k * 0.5;
    }

    // facing — while aiming, always face the camera direction (strafe)
    {
      const target = this.aiming ? camYaw : (len > 0.01 ? Math.atan2(-dx, -dz) : this.facing);
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * (this.aiming ? 16 : 12));
    }
    this.group.rotation.y = this.facing;

    // animate
    const speedRatio = Math.min(1, this.speed2d / RUN);
    if (this.aiming) {
      // two-hand aim pose: arms raise toward the camera pitch
      const pitch = this.aimPitch || 0;
      this.armR.rotation.x = Math.PI / 2 - pitch * 0.9;
      this.armR.rotation.z = 0.12;
      this.armL.rotation.x = Math.PI / 2 * 0.94 - pitch * 0.8;
      this.armL.rotation.z = -0.35;
      if (this.grounded) {
        this.phase += this.speed2d * dt * 2.35;
        const amp = speedRatio * 0.6;
        this.legL.rotation.x = Math.sin(this.phase) * amp;
        this.legR.rotation.x = Math.sin(this.phase + Math.PI) * amp;
      }
    } else if (this.grounded) {
      this.phase += this.speed2d * dt * 2.35;
      const amp = speedRatio * 0.85;
      this.legL.rotation.x = Math.sin(this.phase) * amp;
      this.legR.rotation.x = Math.sin(this.phase + Math.PI) * amp;
      this.armL.rotation.x = Math.sin(this.phase + Math.PI) * amp * 0.8;
      this.armR.rotation.x = Math.sin(this.phase) * amp * 0.8;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
    } else {
      this.legL.rotation.x = 0.45;
      this.legR.rotation.x = -0.3;
      this.armL.rotation.x = -0.5;
      this.armR.rotation.x = -0.5;
    }

    // sync
    this.group.position.set(p.x, p.y - 0.42, p.z);
    this.group.quaternion.set(0, 0, 0, 1);
  }
}

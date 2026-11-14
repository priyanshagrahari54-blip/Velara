import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// GANG SYSTEM (v0.8.0) — user-picked "Gang thugs (GTA-style)"
// Old Market district (northwest) mein thugs: idle wander → player ke paas
// aane par ALERT → ATTACK (tracer shots, player damage) → killable.
// Kill: +₹ loot + wanted star. Respawn 35s baad naye spot par.
// Thugs CANNON kinematic sphere bodies hain — player ki bullets raycast se
// lagti hain (weapons onHit → game._onBulletHit → gang.takeDamage).
// ---------------------------------------------------------------------------

const MAX_THUGS = 6;
const ALERT_DIST = 42;
const ATTACK_DIST = 20;
const RESPAWN_S = 35;

// Old Market (district 'market' = bz 0 && bx<=3 | bx 0 && bz<=2) sidewalk spots
const SPOTS = [
  [-140, -142], [-88, -148], [-40, -146], [-8, -138], [-150, -88], [-144, -40],
];

function yawTo(fx, fz, tx, tz) {
  return Math.atan2(tx - fx, tz - fz);
}

export class GangSystem {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.thugs = [];
    this.kills = 0;
    this.onKill = null;        // (n) => ui/stats
    this._spawnQueue = [...SPOTS];
    for (let i = 0; i < MAX_THUGS; i++) this._spawnThug();
  }

  _nextSpot() {
    if (!this._spawnQueue.length) this._spawnQueue = [...SPOTS];
    return this._spawnQueue.pop();
  }

  _buildThugMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshStandardMaterial({ color: 0x5a1e1e, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xa8765a, roughness: 0.7 });
    const gunM = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), jacket);
    body.position.y = 1.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
    head.position.y = 1.62;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.32), pants);
    cap.position.y = 1.74;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
    legL.position.set(-0.14, 0.36, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.16), jacket);
    armR.position.set(0.34, 1.12, 0.12);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.34), gunM);
    gun.position.set(0.34, 1.2, 0.36);
    g.add(body, head, cap, legL, legR, armR, gun);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    g.userData.legs = [legL, legR];
    return g;
  }

  _spawnThug() {
    const [x, z] = this._nextSpot();
    const mesh = this._buildThugMesh();
    mesh.position.set(x, 0.18, z);
    this.scene.add(mesh);

    // kinematic hitbox — bullets raycast se lagengi, impulse nahi (by design)
    const body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(0.62),
      position: new CANNON.Vec3(x, 1.0, z),
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2 | 4,
    });
    body.gameTag = 'gang';
    this.world.addBody(body);

    this.thugs.push({
      mesh, body, hp: 100, dead: false, respawnT: 0,
      state: 'idle', shootCd: 1.2 + Math.random(),
      wanderT: Math.random() * 3, wanderDir: Math.random() * Math.PI * 2,
      walkT: 0, home: [x, z],
    });
  }

  takeDamage(body, dmg) {
    const t = this.thugs.find((th) => th.body === body && !th.dead);
    if (!t) return false;
    t.hp -= dmg;
    if (t.hp > 0) {
      // flinch + turant aggressive
      t.state = 'attack';
      t.shootCd = Math.min(t.shootCd, 0.4);
      return true;
    }
    this._killThug(t);
    return true;
  }

  _killThug(t) {
    t.dead = true;
    t.respawnT = RESPAWN_S;
    t.mesh.rotation.z = Math.PI / 2;       // gira diya
    t.mesh.position.y = 0.42;
    t.body.collisionResponse = false;
    this.kills++;
    const loot = Math.round(120 + Math.random() * 90);
    if (this.game) {
      this.game.addMoney(loot);
      this.game.police && this.game.police.reportCrime(1);
      this.game.ui && this.game.ui.toast(`💀 Thug down &nbsp; +₹${loot}`, false, 2200);
      this.game.vfx && this.game.vfx.burst(t.mesh.position.x, 1.0, t.mesh.position.z,
        0x3a2a20, 14, 2.2, 0.5);
      this.game.audio && this.game.audio.sfx('crash_soft', 0.5, 0.7);
    }
    if (this.onKill) this.onKill(this.kills);
  }

  _respawn(t) {
    const [x, z] = this._nextSpot();
    t.dead = false;
    t.hp = 100;
    t.state = 'idle';
    t.shootCd = 1.5 + Math.random();
    t.home = [x, z];
    t.mesh.rotation.z = 0;
    t.mesh.position.set(x, 0.18, z);
    t.body.collisionResponse = true;
    t.body.position.set(x, 1.0, z);
  }

  update(dt) {
    const g = this.game;
    if (!g) return;
    const px = g.player.position.x, pz = g.player.position.z;

    for (const t of this.thugs) {
      if (t.dead) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) this._respawn(t);
        continue;
      }
      const dx = px - t.mesh.position.x;
      const dz = pz - t.mesh.position.z;
      const d = Math.hypot(dx, dz);

      // ---- state machine ----
      if (d <= ATTACK_DIST) t.state = 'attack';
      else if (d <= ALERT_DIST) t.state = 'alert';
      else t.state = 'idle';

      t.walkT += dt * 8;
      const legs = t.mesh.userData.legs;
      const moving = t.state !== 'attack';

      if (t.state === 'idle') {
        // wander: home ke 6m ke andar mulayam ghumna
        t.wanderT -= dt;
        if (t.wanderT <= 0) {
          t.wanderT = 2 + Math.random() * 3;
          t.wanderDir = Math.random() * Math.PI * 2;
        }
        const hx = t.home[0] - t.mesh.position.x;
        const hz = t.home[1] - t.mesh.position.z;
        if (Math.hypot(hx, hz) > 6) t.wanderDir = Math.atan2(hx, hz);
        const s = dt * 1.1;
        t.mesh.position.x += Math.sin(t.wanderDir) * s;
        t.mesh.position.z += Math.cos(t.wanderDir) * s;
        t.mesh.rotation.y = t.wanderDir;
        legs[0].rotation.x = Math.sin(t.walkT) * 0.5;
        legs[1].rotation.x = -Math.sin(t.walkT) * 0.5;

      } else if (t.state === 'alert') {
        // player ki taraf dheere badho + dekho
        const dir = yawTo(t.mesh.position.x, t.mesh.position.z, px, pz);
        t.mesh.rotation.y = dir;
        const s = dt * 2.0;
        t.mesh.position.x += Math.sin(dir) * s;
        t.mesh.position.z += Math.cos(dir) * s;
        legs[0].rotation.x = Math.sin(t.walkT) * 0.7;
        legs[1].rotation.x = -Math.sin(t.walkT) * 0.7;

      } else {
        // attack: khada ho kar face + shoot cooldown
        t.mesh.rotation.y = yawTo(t.mesh.position.x, t.mesh.position.z, px, pz);
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        t.shootCd -= dt;
        if (t.shootCd <= 0 && g.health > 0) {
          t.shootCd = 1.3 + Math.random() * 1.1;
          this._thugShoot(t, px, pz, d);
        }
      }

      // sync hitbox
      t.body.position.set(t.mesh.position.x, 1.0, t.mesh.position.z);
    }
  }

  _thugShoot(t, px, pz, dist) {
    const g = this.game;
    // muzzle flash quick light
    g.weapons && g.weapons._impactFlash &&
      g.weapons._impactFlash(new THREE.Vector3(
        t.mesh.position.x + Math.sin(t.mesh.rotation.y) * 0.5, 1.3,
        t.mesh.position.z + Math.cos(t.mesh.rotation.y) * 0.5), 0.5);
    // tracer thug → player
    g.weapons && g.weapons._spawnTracer &&
      g.weapons._spawnTracer(
        { x: t.mesh.position.x, y: 1.3, z: t.mesh.position.z },
        { x: px, y: 1.2, z: pz });
    g.audio && g.audio.shot && g.audio.shot('pistol');
    // accuracy: doori ke hisaab se
    const hitChance = Math.max(0.25, 0.9 - dist / 45);
    if (Math.random() < hitChance) {
      const dmg = 6 + Math.random() * 7;
      if (g.damagePlayer) {
        g.damagePlayer(dmg, 'gang');
      } else if (g.health !== undefined) {
        g.health -= dmg;
        if (g.health <= 0 && g._wasted) g._wasted();
      }
    }
  }
}

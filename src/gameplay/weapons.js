import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// VELARA weapons — hardcore-realistic tone (user decision):
// real recoil, spread bloom, magazine reloads, limited reserve ammo.
// Hitscan via cannon raycast from the CAMERA (crosshair-accurate),
// muzzle only feeds tracer/flash visuals.
// ---------------------------------------------------------------------------

export const WEAPONS = [
  {
    id: 'pistol', slot: 1, name: 'Vyper .45',
    auto: false, rpm: 320, magSize: 12, reserveMax: 60, dmg: 34, pellets: 1,
    spreadHip: 0.030, spreadAds: 0.004, bloomPerShot: 0.007, bloomMax: 0.028,
    recoilKick: 0.013, reloadTime: 1.5, impulse: 9, flash: 26, sfx: 'pistol',
  },
  {
    id: 'smg', slot: 2, name: 'Hornet SMG',
    auto: true, rpm: 750, magSize: 30, reserveMax: 150, dmg: 15, pellets: 1,
    spreadHip: 0.040, spreadAds: 0.012, bloomPerShot: 0.0045, bloomMax: 0.034,
    recoilKick: 0.0075, reloadTime: 2.2, impulse: 6, flash: 30, sfx: 'smg',
  },
  {
    id: 'shotgun', slot: 3, name: 'Mammoth 12G',
    auto: false, rpm: 68, magSize: 6, reserveMax: 30, dmg: 12, pellets: 8,
    spreadHip: 0.052, spreadAds: 0.032, bloomPerShot: 0.02, bloomMax: 0.05,
    recoilKick: 0.034, reloadTime: 2.6, impulse: 3.5, flash: 60, sfx: 'shotgun',
  },
];

// ---------------------------------------------------------------- gun meshes
function buildGunMesh(id) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.35, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.7, metalness: 0.05 });
  const add = (mat, w, h, l, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (id === 'pistol') {
    add(steel, 0.045, 0.07, 0.24, 0, 0.02, -0.1);   // slide
    add(dark, 0.04, 0.13, 0.06, 0, -0.07, 0.03);    // grip
  } else if (id === 'smg') {
    add(steel, 0.055, 0.08, 0.42, 0, 0.02, -0.16);  // receiver
    add(dark, 0.04, 0.16, 0.05, 0, -0.09, 0.02);    // grip
    add(dark, 0.035, 0.18, 0.05, 0, -0.06, -0.12);  // mag
    add(steel, 0.03, 0.03, 0.16, 0, 0.03, -0.4);    // barrel
    add(dark, 0.04, 0.05, 0.16, 0, 0.0, 0.16);      // stock
  } else { // shotgun
    add(steel, 0.05, 0.06, 0.72, 0, 0.03, -0.3);    // long barrel
    add(steel, 0.045, 0.05, 0.6, 0, -0.02, -0.26);  // tube
    add(wood, 0.05, 0.07, 0.2, 0, -0.02, -0.18);    // pump
    add(wood, 0.045, 0.1, 0.24, 0, -0.03, 0.12);    // stock
  }
  // muzzle marker (tracer/flash origin)
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, id === 'shotgun' ? -0.66 : id === 'smg' ? -0.5 : -0.22);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

export class WeaponManager {
  constructor(scene, world, { camera, player, cameraRig, audio, ui, onHit }) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.player = player;
    this.cameraRig = cameraRig;
    this.audio = audio;
    this.ui = ui;
    this.onHit = onHit;         // (body, point, dir, dmg, weapon) => void

    this.index = 0;
    this.state = WEAPONS.map((w) => ({ mag: w.magSize, reserve: w.reserveMax }));
    this.fireTimer = 0;
    this.bloom = 0;
    this.aiming = false;
    this.reloading = false;
    this.reloadT = 0;
    this.trigger = false;       // current hold state
    this._prevTrigger = false;
    this.enabled = false;       // foot mode only

    // gun meshes attach to the player's right arm
    this.gunMeshes = WEAPONS.map((w) => buildGunMesh(w.id));
    this.player.setGun(this.gunMeshes[0]);

    this._initEffects();
    this._syncUI();
  }

  // -------------------------------------------------------------- effects
  _initEffects() {
    // muzzle flash light (shared, intensity spikes then decays)
    this.flashLight = new THREE.PointLight(0xffc98a, 0, 10, 2);
    this.scene.add(this.flashLight);

    // tracer pool — VISIBLE streaks (1px lines phone par dikhte hi nahi the)
    this.tracers = [];
    const tracerGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 5, 1, true);
    tracerGeo.translate(0, 0.5, 0); // base at origin — scale.y = length, oriented along +Y
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe2a8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    this._tracerCursor = 0;

    // muzzle + impact flash sprites (additive)
    const mkFlashTex = (c0, c1) => {
      const cnv = document.createElement('canvas');
      cnv.width = cnv.height = 64;
      const c = cnv.getContext('2d');
      const g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
      g.addColorStop(0, c0);
      g.addColorStop(0.35, c1);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(cnv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this._muzzleTex = mkFlashTex('rgba(255,246,220,1)', 'rgba(255,190,90,0.85)');
    this._impactTex = mkFlashTex('rgba(255,255,255,1)', 'rgba(255,170,80,0.8)');
    const mkSpritePool = (tex, n) => {
      const pool = [];
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, transparent: true, opacity: 0, depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        s.visible = false;
        this.scene.add(s);
        pool.push({ sprite: s, life: 0, max: 1 });
      }
      return pool;
    };
    this.muzzleFlashes = mkSpritePool(this._muzzleTex, 3);
    this.impactFlashes = mkSpritePool(this._impactTex, 5);
    this._muzzleCursor = 0;
    this._impactCursor = 0;

    // spark pool (points, like tire smoke but hot orange)
    {
      const N = this._sparkCount = 160;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color(0xffb268) } },
        vertexShader: `
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 130.0 / max(-mv.z, 0.1);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.05, d);
            if (a < 0.01) discard;
            gl_FragColor = vec4(uColor, a);
          }`,
      });
      this.sparks = new THREE.Points(geo, mat);
      this.sparks.frustumCulled = false;
      this.scene.add(this.sparks);
      this.sparkData = { life: new Float32Array(N), vel: new Float32Array(N * 3), cursor: 0 };
    }

    // bullet-hole decal pool
    this.decals = [];
    const decalGeo = new THREE.CircleGeometry(0.055, 8);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({
        color: 0x0d0d0f, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.visible = false;
      this.scene.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
    this._decalCursor = 0;
  }

  _spawnTracer(from, to) {
    const t = this.tracers[this._tracerCursor];
    this._tracerCursor = (this._tracerCursor + 1) % this.tracers.length;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.01) return;
    dir.normalize();
    t.mesh.position.copy(from);
    t.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    t.mesh.scale.set(1, len, 1);
    t.mesh.material.opacity = 0.85;   // spawn par hi reset
    t.mesh.visible = true;
    t.life = 0.16;
  }

  _muzzleFlash(pos, size) {
    const f = this.muzzleFlashes[this._muzzleCursor];
    this._muzzleCursor = (this._muzzleCursor + 1) % this.muzzleFlashes.length;
    f.sprite.position.copy(pos);
    f.sprite.scale.set(size, size, 1);
    f.sprite.material.rotation = Math.random() * Math.PI * 2;
    f.sprite.material.opacity = 1;   // spawn par hi reset (QA: pehle sirf next-tick par set hoti thi)
    f.sprite.visible = true;
    f.life = f.max = 0.07;
  }

  _impactFlash(pos, size) {
    const f = this.impactFlashes[this._impactCursor];
    this._impactCursor = (this._impactCursor + 1) % this.impactFlashes.length;
    f.sprite.position.copy(pos);
    f.sprite.scale.set(size, size, 1);
    f.sprite.material.opacity = 1;   // spawn par hi reset
    f.sprite.visible = true;
    f.life = f.max = 0.12;
  }

  _spawnSparks(point, normal) {
    const d = this.sparkData;
    const pos = this.sparks.geometry.attributes.position;
    for (let k = 0; k < 6; k++) {
      const i = d.cursor; d.cursor = (d.cursor + 1) % this._sparkCount;
      pos.setXYZ(i, point.x, point.y, point.z);
      d.vel[i * 3] = normal.x * 2 + (Math.random() - 0.5) * 3;
      d.vel[i * 3 + 1] = normal.y * 2 + Math.random() * 2.5;
      d.vel[i * 3 + 2] = normal.z * 2 + (Math.random() - 0.5) * 3;
      d.life[i] = 0.22 + Math.random() * 0.18;
    }
  }

  _spawnDecal(point, normal) {
    const d = this.decals[this._decalCursor];
    this._decalCursor = (this._decalCursor + 1) % this.decals.length;
    d.mesh.position.set(point.x + normal.x * 0.012, point.y + normal.y * 0.012, point.z + normal.z * 0.012);
    d.mesh.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    d.mesh.visible = true;
    d.mesh.material.opacity = 0.85;
    d.life = 20;
  }

  _updateEffects(dt) {
    // dt clamp — low-fps frames par quick VFX (muzzle 70ms) ek hi frame
    // mein nahi marna chahiye (QA ne pakda: dt 0.1s => sprite gayab)
    const edt = Math.min(dt, 0.05);
    // flash light decay (thoda der tak — visible recoil feedback)
    this.flashLight.intensity *= Math.exp(-edt * 16);
    if (this.flashLight.intensity < 0.3) this.flashLight.intensity = 0;

    // tracers
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= edt;
      const k = Math.max(0, t.life / 0.16);
      t.mesh.material.opacity = k * 0.85;
      t.mesh.scale.x = t.mesh.scale.z = 0.5 + k * 0.5;
      if (t.life <= 0) t.mesh.visible = false;
    }

    // muzzle + impact flash sprites
    for (const pool of [this.muzzleFlashes, this.impactFlashes]) {
      for (const f of pool) {
        if (f.life <= 0) continue;
        f.life -= edt;
        const k = Math.max(0, f.life / f.max);
        f.sprite.material.opacity = k;
        f.sprite.scale.multiplyScalar(1 + edt * 6); // quick expand
        if (f.life <= 0) f.sprite.visible = false;
      }
    }

    // sparks
    {
      const d = this.sparkData;
      const pos = this.sparks.geometry.attributes.position;
      let any = false;
      for (let i = 0; i < this._sparkCount; i++) {
        if (d.life[i] <= 0) continue;
        any = true;
        d.life[i] -= dt;
        if (d.life[i] <= 0) { pos.setY(i, -999); continue; }
        d.vel[i * 3 + 1] -= 9.8 * dt;
        pos.setXYZ(i,
          pos.getX(i) + d.vel[i * 3] * dt,
          pos.getY(i) + d.vel[i * 3 + 1] * dt,
          pos.getZ(i) + d.vel[i * 3 + 2] * dt);
      }
      if (any) pos.needsUpdate = true;
    }

    // decals
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life < 5) d.mesh.material.opacity = Math.max(0, d.life / 5) * 0.85;
      if (d.life <= 0) d.mesh.visible = false;
    }
  }

  // ------------------------------------------------------------- controls
  get weapon() { return WEAPONS[this.index]; }
  get ammoState() { return this.state[this.index]; }

  select(i) {
    if (i < 0 || i >= WEAPONS.length || i === this.index) return;
    this.index = i;
    this.reloading = false;
    this.reloadT = 0;
    this.ui.setReload(null);
    this.player.setGun(this.gunMeshes[i]);
    this.audio.reloadClick();
    this._syncUI();
  }

  cycle() { this.select((this.index + 1) % WEAPONS.length); }

  setAim(v) { this.aiming = !!v; }

  setEnabled(v) { this.enabled = !!v; }

  setTrigger(v) { this.trigger = !!v; }

  startReload() {
    const w = this.weapon, a = this.ammoState;
    if (this.reloading || a.mag >= w.magSize || a.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    this.audio.reloadClick();
  }

  refillReserve() {
    for (let i = 0; i < WEAPONS.length; i++) this.state[i].reserve = WEAPONS[i].reserveMax;
    this._syncUI();
  }

  currentSpread() {
    const w = this.weapon;
    const base = this.aiming ? w.spreadAds : w.spreadHip;
    return base + Math.min(this.bloom, w.bloomMax);
  }

  // ---------------------------------------------------------------- fire
  fire() {
    const w = this.weapon, a = this.ammoState;
    if (this.fireTimer > 0 || this.reloading) return false;
    if (a.mag <= 0) {
      this.audio.emptyClick();
      this.fireTimer = 0.25;
      this.startReload(); // tactical auto-reload
      return false;
    }
    a.mag--;
    this.fireTimer = 60 / w.rpm;
    this.bloom = Math.min(w.bloomMax, this.bloom + w.bloomPerShot);
    this.audio.shot(w.sfx);

    // camera recoil (view kicks up, recovers)
    this.cameraRig.addRecoil(w.recoilKick);
    this.cameraRig.addShake(w.recoilKick * 2.2);

    // muzzle world position (for visuals)
    const muzzleWorld = this.player.getMuzzleWorld(new THREE.Vector3());
    this.flashLight.position.copy(muzzleWorld);
    this.flashLight.intensity = w.flash * 2.2;
    this._muzzleFlash(muzzleWorld, 0.42 + w.flash * 0.012);

    // ray origin = camera (crosshair-accurate), dir = camera forward + spread
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const spread = this.currentSpread();

    const from = new CANNON.Vec3(origin.x, origin.y, origin.z);
    const _v = new THREE.Vector3();

    for (let p = 0; p < w.pellets; p++) {
      const rx = (Math.random() + Math.random() - 1) * spread;
      const ry = (Math.random() + Math.random() - 1) * spread;
      _v.copy(dir).addScaledVector(right, rx).addScaledVector(up, ry).normalize();
      const to = new CANNON.Vec3(origin.x + _v.x * 160, origin.y + _v.y * 160, origin.z + _v.z * 160);

      const result = new CANNON.RaycastResult();
      this.world.raycastClosest(from, to, {
        collisionFilterGroup: -1,
        collisionFilterMask: -3,      // everything except the player's own body (group 2)
        skipBackfaces: true,
      }, result);

      let end;
      if (result.hasHit) {
        end = result.hitPointWorld;
        const n = result.hitNormalWorld;
        this._spawnSparks(
          { x: end.x, y: end.y, z: end.z },
          { x: n.x, y: n.y, z: n.z });
        this._impactFlash(new THREE.Vector3(end.x, end.y, end.z), 0.34);
        this._spawnDecal({ x: end.x, y: end.y, z: end.z }, { x: n.x, y: n.y, z: n.z });

        // physical impulse at the hit point (relative to CoM — ADR-001 lesson)
        const b = result.body;
        if (b && b.type === CANNON.Body.DYNAMIC) {
          const rel = new CANNON.Vec3(end.x - b.position.x, end.y - b.position.y, end.z - b.position.z);
          b.applyImpulse(new CANNON.Vec3(_v.x * w.impulse, _v.y * w.impulse, _v.z * w.impulse), rel);
        }
        if (this.onHit) this.onHit(b, { x: end.x, y: end.y, z: end.z }, { x: _v.x, y: _v.y, z: _v.z }, w.dmg, w);
      } else {
        end = { x: to.x, y: to.y, z: to.z };
      }
      // tracer from muzzle to impact
      this._spawnTracer(muzzleWorld, end);
    }

    this._syncUI();
    return true;
  }

  // --------------------------------------------------------------- update
  update(dt) {
    const w = this.weapon;

    if (this.fireTimer > 0) this.fireTimer -= dt;

    // spread bloom recovery
    this.bloom = Math.max(0, this.bloom - dt * 0.05);

    // reload progress
    if (this.reloading) {
      this.reloadT += dt;
      const pct = Math.min(1, this.reloadT / w.reloadTime);
      this.ui.setReload(pct);
      if (pct >= 1) {
        const a = this.ammoState;
        const take = Math.min(w.magSize - a.mag, a.reserve);
        a.mag += take;
        a.reserve -= take;
        this.reloading = false;
        this.ui.setReload(null);
        this.audio.reloadClick();
        this._syncUI();
      }
    }

    // trigger handling (semi needs an edge, auto holds)
    if (this.enabled && this.trigger) {
      if (w.auto || !this._prevTrigger) this.fire();
    }
    this._prevTrigger = this.trigger;

    // crosshair spread feedback
    this.ui.setCrosshair(this.currentSpread(), this.enabled && !this.reloading);

    this._updateEffects(dt);
  }

  _syncUI() {
    const w = this.weapon, a = this.ammoState;
    this.ui.setWeapon(this.index, WEAPONS.map((x) => x.name));
    this.ui.setAmmo(a.mag, a.reserve);
  }
}

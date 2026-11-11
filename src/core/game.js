import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { createRenderer, createPostFX } from '../engine/renderer.js';
import { QualityManager } from '../engine/quality.js';
import { createPhysicsWorld, FIXED_STEP, MAX_SUBSTEPS } from '../engine/physics.js';
import { InputManager } from '../engine/input.js';
import { CameraRig } from '../engine/camera.js';

import { createEnvironment } from '../world/environment.js';
import { buildCity, EXTENT } from '../world/city.js';
import { TrafficSystem } from '../world/traffic.js';

import { Player } from '../gameplay/player.js';
import { GameVehicle, VEHICLE_PRESETS, getVehiclePhysMat } from '../gameplay/vehicle.js';
import { WeaponManager, WEAPONS } from '../gameplay/weapons.js';
import { buildRange } from '../gameplay/range.js';
import { MissionManager } from '../gameplay/missions.js';

import { AudioEngine } from '../audio/audio.js';
import { UI } from '../ui/ui.js';

const PLAYER_SPAWN = { x: 6.5, y: 1.1, z: 7.5 };

// the garage: 4 vehicles on the spawn plaza, each a different personality
const VEHICLE_SPAWNS = [
  { p: 'coupe', x: 7, y: 1.15, z: 12, yaw: -0.3 },
  { p: 'muscle', x: -11, y: 1.15, z: 10, yaw: 2.6 },
  { p: 'hatch', x: 12, y: 1.15, z: -8, yaw: -0.4 },
  { p: 'van', x: -9, y: 1.15, z: -11, yaw: 0.3 },
];

export class VelaraGame {
  constructor(container) {
    this.container = container;
    this.state = 'start';          // start | playing | paused
    this.mode = 'foot';            // foot | car
    this.money = 0;
    this.health = 100;
    this.pickupsCollected = 0;
    this.cratesDestroyed = 0;
    this.rangeHits = 0;
    this.gameMinutes = 17 * 60 + 35; // golden hour start (Style B)
    this._flipTimer = 0;
    this._touchJump = false;
    this._touchHorn = false;
    this._touchFire = false;
    this._touchAim = false;
    this._aimOverride = false;    // test/debug aim hook
    this._panicPoints = [];        // gunfire positions traffic flees from

    // hardware profile (?profile=g560 - Lenovo G560 2GB aggressive tier)
    this.profile = new URLSearchParams(location.search).get('profile') || 'normal';

    // ------------------------------------------------------- engine layer
    this.renderer = createRenderer(container, { antialias: this.profile !== 'g560' });
    this.canvas = this.renderer.domElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070f);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

    this.quality = new QualityManager();
    this.postfx = createPostFX(this.renderer, this.scene, this.camera);

    // -------------------------------------------------------- physics
    this.world = createPhysicsWorld();

    // -------------------------------------------------------- world
    this.env = createEnvironment(this.scene, this.renderer);
    this.env.setTime('dusk'); // boot into GOLDEN HOUR with a cinematic 2.5s transition
    this.city = buildCity(this.scene, this.world);
    this.player = new Player(this.scene, this.world, this.city.groundMat, PLAYER_SPAWN);
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.player.physMat, this.city.groundMat, { friction: 0.0, restitution: 0.0 }));

    // the garage (ADR-006: per-vehicle dynamics, shared contact material)
    this.vehicles = VEHICLE_SPAWNS.map((s) => {
      const v = new GameVehicle(this.scene, this.world, s, VEHICLE_PRESETS[s.p]);
      v.reset(s.x, s.z, s.yaw);
      return v;
    });
    this.activeVehicle = this.vehicles[0];
    // only the ACTIVE vehicle's headlight spots render — 8 live spotlights
    // would explode the shader cost (SwiftShader OOM in smoke test)
    this._applyActiveVehicle();

    this.traffic = new TrafficSystem(this.scene, this.world, this.city.ROADS, EXTENT);
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      getVehiclePhysMat(), this.traffic.trafficMat, { friction: 0.2, restitution: 0.05 }));

    // shooting range (stunt plaza east side)
    this.range = buildRange(this.scene, this.world);

    // ---------------------------------------------------- ui / audio / meta
    this.audio = new AudioEngine();
    this.ui = new UI(container, {
      onPlay: () => this.startGame(),
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onTouchBtn: (name, down) => this._touchBtn(name, down),
    });
    this.missions = new MissionManager(this.ui);
    this.input = new InputManager({
      canvas: this.canvas,
      isTouch: this.ui.isTouch,
      isPlaying: () => this.state === 'playing',
      onAction: (a) => this._action(a),
      onLook: (dx, dy) => this.cameraRig.applyLook(dx, dy),
      onZoom: (dir) => this.cameraRig.zoom(dir),
    });
    this.input.bindStick(() => this.ui.stick || { x: 0, y: 0 });
    this.cameraRig = new CameraRig(this.camera, {
      player: this.player,
      car: this.activeVehicle,
      getCollidibles: () => this.city.collidableMeshes,
      getMode: () => this.mode,
    });

    // weapons (created after camera rig + ui exist)
    this.weapons = new WeaponManager(this.scene, this.world, {
      camera: this.camera,
      player: this.player,
      cameraRig: this.cameraRig,
      audio: this.audio,
      ui: this.ui,
      onHit: (body, point, dir, dmg, w) => this._onBulletHit(body, point, dir, dmg, w),
    });

    this._setupQuality();
    // Hardware profiles (?qa=1 tests / ?profile=g560 max-speed tier).
    // QA mode (?qa=1): boot straight into the low tier — keeps software
    // renderers (SwiftShader / old iGPUs) alive during headless test runs.
    // g560: dedicated MAX-SPEED tier (0.55 pixel ratio, 8-light cap, skyline
    // off, no AA) — also reached automatically if FPS stays <30 even on low.
    if (new URLSearchParams(location.search).has('qa')) this.quality.set('low');
    else if (this.profile === 'g560') this.quality.set('g560');
    this._setupCollisions();

    this.ui.setMoney(0);
    this.ui.setHealth(100);
    this.ui.setHint('<b>WASD</b> move · <b>RMB</b> aim · <b>LMB</b> fire · <b>1/2/3</b> weapons · <b>E</b> vehicle · <b>K</b> quality');

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    this._loop();
  }

  // ------------------------------------------------------------ aliases
  // (kept stable for tests + debug console)
  get keys() { return this.input.keys; }
  get missionIndex() { return this.missions.index; }
  get car() { return this.activeVehicle; }
  set introT(v) { this.cameraRig.introT = v; }
  get introT() { return this.cameraRig.introT; }

  // ============================================================ quality
  _setupQuality() {
    this.quality.onChange = (cfg) => {
      this.renderer.setPixelRatio(cfg.pixelRatio);
      const sun = this.env.sun;
      sun.castShadow = cfg.shadows;
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
      if (this.postfx) {
        this.postfx.bloom.enabled = cfg.bloom > 0;
        this.postfx.bloom.strength = cfg.bloom;
      }
      if (this.city && this.city.setPerf) {
        this.city.setPerf({ maxLights: cfg.maxLights, skyline: cfg.skyline });
      }
      this._resize();
    };
    this.quality.bootstrap(this.ui.isTouch);
    this.ui.toast(`⚙️ Graphics: ${this.quality.config.label}`, false, 2200);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.postfx) this.postfx.composer.setSize(w, h);
  }

  onResize() { this._resize(); }

  // ============================================================ actions
  _action(name) {
    switch (name) {
      case 'enterCar': this.toggleCar(); break;
      case 'timeCycle': {
        const t = this.env.cycleTime();
        this.ui.toast(t === 'night' ? '🌙 Raat' : t === 'dusk' ? '🌇 Shaam' : '☀️ Din');
        break;
      }
      case 'reloadOrRain': {
        if (this.mode === 'foot') this.weapons.startReload();
        else {
          const on = this.env.toggleRain();
          this.ui.toast(on ? '🌧️ Rain incoming — roads are slick' : '🌈 Rain stopped');
        }
        break;
      }
      case 'camDist': this.cameraRig.cycleDist(); break;
      case 'musicToggle': {
        const on = this.audio.toggleMusic();
        this.ui.toast(on ? '🔊 Music on' : '🔇 Music off');
        break;
      }
      case 'recoverCar': this.recoverCar(); break;
      case 'qualityCycle': {
        const cfg = this.quality.cycle();
        this.ui.toast(`⚙️ Graphics: ${cfg.label}`);
        break;
      }
      case 'weapon1': if (this.mode === 'foot') this.weapons.select(0); break;
      case 'weapon2': if (this.mode === 'foot') this.weapons.select(1); break;
      case 'weapon3': if (this.mode === 'foot') this.weapons.select(2); break;
      case 'weaponCycle': if (this.mode === 'foot') this.weapons.cycle(); break;
      case 'pause': this.pause(); break;
    }
  }

  _touchBtn(name, down) {
    if (this.state !== 'playing') return;
    if (name === 'a') this._touchJump = down;
    if (name === 'h') this._touchHorn = down;
    if (name === 'f') this._touchFire = down;
    if (name === 'aim') this._touchAim = down;
    if (name === 'w' && down && this.mode === 'foot') this.weapons.cycle();
    if (name === 'e' && down) this.toggleCar();
  }

  /** Test/debug hook: force aim mode on/off (bypasses mouse/touch). */
  setAimOverride(v) { this._aimOverride = !!v; }

  _applyActiveVehicle() {
    for (const v of this.vehicles) {
      const on = v === this.activeVehicle;
      for (const s of v.spots) s.visible = on;
    }
    if (this.cameraRig) this.cameraRig.car = this.activeVehicle;
  }

  // ========================================================== collisions
  _setupCollisions() {
    let lastCarThud = 0, lastPlayerThud = 0;
    for (const veh of this.vehicles) {
      veh.body.addEventListener('collide', (e) => {
        const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
        const now = performance.now();
        const crate = this.city.crates.find((c) => c.body === e.body);
        if (crate && impact > 4.2 && !crate.destroyed) {
          crate.destroyed = true;
          crate.mesh.material.color.setHex(0x241a12);
          this.cratesDestroyed++;
          this.audio.thud(impact);
          return;
        }
        if (impact > 3 && now - lastCarThud > 130) {
          lastCarThud = now;
          this.audio.thud(impact);
          if (impact > 7 && veh === this.activeVehicle && this.mode === 'car') {
            this.health -= (impact - 7) * 2.0;
            this.ui.flashDamage();
            this.cameraRig.addShake(impact / 16);
            if (this.health <= 0) this._wasted();
          }
        }
      });
    }
    this.player.body.addEventListener('collide', (e) => {
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const now = performance.now();
      if (impact > 5 && now - lastPlayerThud > 200) {
        lastPlayerThud = now;
        this.audio.thud(impact * 0.6);
        this.ui.flashDamage();
      }
    });
  }

  // ======================================================= bullet hits
  _onBulletHit(body, point, dir, dmg, weapon) {
    // shooting range plates
    const t = this.range.targetByBody.get(body);
    if (t) {
      if (this.range.hit(t)) {
        this.rangeHits++;
        this.addMoney(100);
        this.ui.hitmarker();
        this.audio.hitmark();
      }
      return;
    }
    // crates shoot bhi toot jaate hain
    const crate = this.city.crates.find((c) => c.body === body);
    if (crate && !crate.destroyed) {
      crate.destroyed = true;
      crate.mesh.material.color.setHex(0x241a12);
      this.cratesDestroyed++;
      this.ui.hitmarker();
      this.audio.thud(6);
      return;
    }
    // traffic — bullet se ghabra ke bhaagti hai
    const tcar = this.traffic.cars.find((c) => c.body === body);
    if (tcar) {
      this.ui.hitmarker();
      this._panicPoints.push({ x: point.x, z: point.z, t: 4 });
      return;
    }
    // our garage vehicles
    if (this.vehicles.some((v) => v.body === body)) {
      this.ui.hitmarker();
      return;
    }
    // any other dynamic prop (cones etc.)
    if (body && body.type === CANNON.Body.DYNAMIC) this.ui.hitmarker();
  }

  // ============================================================= economy
  addMoney(v) {
    this.money += v;
    this.ui.setMoney(this.money);
  }

  // =========================================================== car / mode
  nearestVehicle(maxDist = 4.8) {
    const p = this.player.position;
    let best = null, bestD = maxDist;
    for (const v of this.vehicles) {
      const c = v.body.position;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < bestD) { best = v; bestD = d; }
    }
    return best;
  }

  toggleCar() {
    if (this.mode === 'foot') {
      const v = this.nearestVehicle();
      if (!v) {
        this.ui.toast('No vehicle nearby — follow the cyan dots');
        return;
      }
      this.activeVehicle = v;
      this._applyActiveVehicle();
      this.mode = 'car';
      this.player.removeFromWorld();
      this.player.group.visible = false;
      this.weapons.setEnabled(false);
      this.weapons.setTrigger(false);
      this.cameraRig.setAiming(false);
      this.player.aiming = false;
      this.ui.showSpeedo(true);
      this.ui.showWeapon(false);
      this.ui.setCrosshair(0, false);
      this.ui.toast(`🔑 ${v.preset.name} — ${v.preset.desc}`, false, 2200);
      this.cameraRig.dist = 8.2;
    } else {
      const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.car.group.quaternion);
      const c = this.car.body.position;
      this.mode = 'foot';
      this.player.respawn(c.x + r.x * 2.4, c.y + 0.8, c.z + r.z * 2.4);
      this.player.addToWorld();
      this.player.group.visible = true;
      this.weapons.setEnabled(true);
      this.weapons._syncUI();
      this.ui.showSpeedo(false);
      this.ui.showWeapon(true);
      this.cameraRig.dist = 4.6;
    }
  }

  recoverCar() {
    if (this.mode !== 'car') return;
    const c = this.car.body.position;
    const f = this.car.getForwardVector(new THREE.Vector3());
    this.car.reset(c.x, c.z, Math.atan2(-f.x, -f.z) + Math.PI);
    this.car.body.position.y = c.y + 1.0;
    this.ui.toast('🔧 Vehicle recovered');
  }

  _wasted() {
    this.health = 100;
    this.money = Math.max(0, this.money - 500);
    this.ui.setMoney(this.money);
    this.ui.toast('💀 WASTED — hospital bill ₹500', false, 3200);
    if (this.mode === 'car') this.toggleCar();
    this.player.respawn(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
    for (const v of this.vehicles) v.resetToSpawn();
    this.activeVehicle = this.vehicles[0];
    this._applyActiveVehicle();
    this.ui.setHealth(100);
  }

  // ================================================================ flow
  startGame() {
    this.audio.init();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
    this.ui.hideStart();
    this.ui.showHUD();
    this.ui.showWeapon(true);
    this.state = 'playing';
    this.cameraRig.startIntro();
    this.clock.getDelta();
    this.input.tryLock();
    setTimeout(() => this.ui.fadeHint(), 4000);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showPause(true);
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setEngine(0, 0, false);
    this.audio.setSkid(0);
    this.audio.horn(false);
    this.weapons.setTrigger(false);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showPause(false);
    this.clock.getDelta();
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
  }

  restart() {
    this.ui.showPause(false);
    this.state = 'playing';
    this.money = 0; this.health = 100;
    this.pickupsCollected = 0; this.cratesDestroyed = 0; this.rangeHits = 0;
    this.city.resetProps();
    this.range.reset();
    this.weapons.state.forEach((s, i) => { s.mag = WEAPONS[i].magSize; s.reserve = WEAPONS[i].reserveMax; });
    this.weapons.index = -1;            // force re-select to slot 1
    this.weapons.select(0);
    if (this.mode === 'car') {
      this.player.addToWorld();
      this.player.group.visible = true;
      this.mode = 'foot';
      this.ui.showSpeedo(false);
    }
    this.weapons.setEnabled(true);
    this.ui.showWeapon(true);
    this.player.respawn(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
    for (const v of this.vehicles) v.resetToSpawn();
    this.activeVehicle = this.vehicles[0];
    this._applyActiveVehicle();
    this.ui.setMoney(0); this.ui.setHealth(100);
    this.missions.reset();
    this.clock.getDelta();
  }

  // ================================================================ loop
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'playing') {
      this._update(dt);
      this.quality.frame(dt);
    }
    if (this._noRender) return; // test hook: logic-only stepping (no GPU work)
    // start screen: the 3D backdrop renders at ~20fps (saves battery /
    // keeps weak GPUs alive); gameplay always renders full rate.
    if (this.state === 'start' && ((this._bgFrame = (this._bgFrame || 0) + 1) % 3) !== 1) return;
    if (this.postfx && this.quality.config.bloom > 0) {
      this.postfx.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _update(dt) {
    // ------------------------------------------------------ player / car
    if (this.mode === 'foot') {
      const input = this.input.footInput();
      input.jump = input.jump || this._touchJump;

      // weapon aiming state feeds player pose + camera
      const aiming = !!(this.input.mouse.aim || this._touchAim || this._aimOverride);
      this.weapons.setAim(aiming);
      this.cameraRig.setAiming(aiming);
      this.player.aiming = aiming;
      this.player.aimPitch = this.cameraRig.pitch;

      this.player.update(dt, input, this.cameraRig.yaw);

      // trigger: mouse fire (only while locked/aiming — input gates) or touch
      this.weapons.setTrigger(!!(this.input.mouse.fire || this._touchFire));
      this.weapons.setEnabled(true);
      this.weapons.update(dt);

      // parked cars still simulate (handbrake on)
      for (const v of this.vehicles) {
        v.update(dt, { throttle: 0, steer: 0, handbrake: true, parked: true }, this.env);
      }
      this.ui.setSpeed(0, '—');

      const near = this.nearestVehicle();
      let promptTxt = null;
      if (near) promptTxt = `Press <b>E</b> — enter the ${near.preset.name} 🚗`;
      else {
        for (const c of this.range.ammoCrates) {
          if (c.cooldown <= 0 &&
            Math.hypot(this.player.position.x - c.x, this.player.position.z - c.z) < 2.2) {
            promptTxt = '<b>🧰 Ammo crate</b> — walk over for a free refill';
            break;
          }
        }
      }
      this.ui.prompt(promptTxt);
    } else {
      const input = this.input.driveInput(this._touchJump);
      const res = this.activeVehicle.update(dt, input, this.env);
      for (const v of this.vehicles) {
        if (v !== this.activeVehicle) {
          v.update(dt, { throttle: 0, steer: 0, handbrake: true, parked: true }, this.env);
        }
      }
      this.ui.setSpeed(res.kmh, this.activeVehicle.getGear());
      this.ui.prompt(null);
      const anyWheel = this.activeVehicle.vehicle.wheelInfos.some((w) => w.isInContact);
      if (res.kmh < 3 && (!anyWheel || this.activeVehicle.isFlipped())) {
        this._flipTimer += dt;
        if (this._flipTimer > 2) { this.recoverCar(); this._flipTimer = 0; }
      } else this._flipTimer = 0;
    }

    // ------------------------------------------------------------- physics
    this.world.step(FIXED_STEP, dt, MAX_SUBSTEPS);

    // safety: clamp freak physics blow-ups on EVERY vehicle (ADR-005)
    for (const v of this.vehicles) {
      const vel = v.body.velocity;
      const sp = Math.hypot(vel.x, vel.y, vel.z);
      if (sp > 55) { const s = 55 / sp; vel.x *= s; vel.y *= s; vel.z *= s; }
      const cp = v.body.position;
      if (Math.abs(cp.x) > 520 || Math.abs(cp.z) > 520 || cp.y < -15 || cp.y > 400) {
        v.resetToSpawn();
        if (v === this.activeVehicle && this.mode === 'car') {
          this.ui.toast('🗺️ City limits — turned you around');
        }
      }
    }
    // world bounds: never let the player fall off the map
    if (this.mode === 'foot') {
      const pp = this.player.body.position;
      if (Math.abs(pp.x) > 520 || Math.abs(pp.z) > 520 || pp.y < -10) {
        this.player.respawn(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z);
        this.ui.toast('🗺️ City limits — turned you around');
      }
    }

    if (this.mode === 'foot') {
      const p = this.player.body.position;
      this.player.group.position.set(p.x, p.y - 0.42, p.z);
      this.player.group.quaternion.set(0, 0, 0, 1);

      // walk-over ammo refill
      for (const c of this.range.ammoCrates) {
        if (c.cooldown > 0) continue;
        if (Math.hypot(p.x - c.x, p.z - c.z) < 1.7) {
          c.cooldown = 25;
          this.weapons.refillReserve();
          this.ui.toast('🧰 Ammo restocked — reserves full!', true, 2000);
          this.audio.blip();
        }
      }
    }

    // ------------------------------------------------------------- traffic
    const avoid = [{ x: this.activeVehicle.body.position.x, z: this.activeVehicle.body.position.z }];
    if (this.mode === 'foot') avoid.push({ x: this.player.position.x, z: this.player.position.z });
    for (let i = this._panicPoints.length - 1; i >= 0; i--) {
      const pp = this._panicPoints[i];
      pp.t -= dt;
      if (pp.t <= 0) this._panicPoints.splice(i, 1);
      else avoid.push({ x: pp.x, z: pp.z });
    }
    this.traffic.update(dt, avoid);

    // -------------------------------------------------------- environment
    this.env.update(dt, this.camera);
    this.city.update(dt, this.env);
    this.range.update(dt);

    // -------------------------------------------------------------- clock
    this.gameMinutes = (this.gameMinutes + dt * 0.5) % 1440;
    const hh = String(Math.floor(this.gameMinutes / 60)).padStart(2, '0');
    const mm = String(Math.floor(this.gameMinutes % 60)).padStart(2, '0');
    const label = this.env.timeName === 'night' ? 'RAAT' : this.env.timeName === 'dusk' ? 'SHAAM' : 'DIN';
    this.ui.setClock(`${hh}:${mm} · ${label}${this.env.raining ? ' · 🌧️' : ''}`);

    // ------------------------------------------------------------ pickups
    const px = this.mode === 'foot' ? this.player.position.x : this.activeVehicle.body.position.x;
    const pz = this.mode === 'foot' ? this.player.position.z : this.activeVehicle.body.position.z;
    for (const p of this.city.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - px, p.z - pz) < 1.7) {
        p.taken = true;
        p.mesh.visible = false;
        this.pickupsCollected++;
        this.addMoney(500);
        this.ui.toast('💰 +₹500', true, 1400);
        this.audio.blip();
      }
    }

    // ------------------------------------------------------------ missions
    this.missions.update(this);

    // ---------------------------------------------------------- health fx
    this.health = Math.min(100, this.health + dt * 2.2);
    this.ui.setHealth(this.health);

    // --------------------------------------------------------------- horn
    this.audio.horn(!!(this.input.isDown('KeyH') || this._touchHorn) && this.mode === 'car',
      this.activeVehicle.preset.horn);

    // ---------------------------------------------------------- audio mix
    const thr = this.mode === 'car' ? Math.abs(this.input.driveInput(this._touchJump).throttle) : 0;
    this.audio.setEngine(this.mode === 'car' ? this.activeVehicle.getRpm(thr) : 0, thr, this.mode === 'car');
    this.audio.setSkid(this.mode === 'car' ? this.activeVehicle.driftAmount : 0);
    this.audio.setRainLevel(this.env.rainAmount);
    this.audio.update();

    // ------------------------------------------------------------- camera
    this.cameraRig.update(dt);

    // ------------------------------------------------------------ minimap
    this.ui.drawMinimap({
      extent: EXTENT,
      roadsX: this.city.ROADS,
      roadsZ: this.city.ROADS,
      player: { x: px, z: pz, yaw: this._mapYaw() },
      car: null,
      vehicles: this.vehicles.map((v) => ({
        x: v.body.position.x, z: v.body.position.z, active: v === this.activeVehicle && this.mode === 'car',
      })),
      traffic: this.traffic.minimapData(),
      pickups: this.city.pickups.map((p) => ({ x: p.x, z: p.z, taken: p.taken })),
      targets: this.range.minimapData(),
    });
  }

  _mapYaw() {
    let fx, fz;
    if (this.mode === 'car') {
      const f = this.activeVehicle.getForwardVector(new THREE.Vector3());
      fx = f.x; fz = f.z;
    } else {
      fx = -Math.sin(this.player.facing); fz = -Math.cos(this.player.facing);
    }
    return Math.atan2(fx, -fz);
  }
}

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GameVehicle, VEHICLE_PRESETS } from './vehicle.js';

// ---------------------------------------------------------------------------
// POLICE SYSTEM (remaster) — wanted stars + pursuit AI + BUSTED
// - crime report → stars up (max 5) → interceptor units spawn
// - pursuit: player ki taraf steer/throttle, ram karne aati hai
// - BUSTED: player slow + police 5.5m ke andar 2.5s
// - evade: koi unit 70m+ door 12s → star decay
// - spikes/helicopter: base yahan hai, baad mein add honge (user-approved)
// ---------------------------------------------------------------------------

const MAX_UNITS = 3;
const SPAWN_DIST = [55, 75];

function yawOf(q) {
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class PoliceSystem {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.wanted = 0;
    this.units = [];
    this.crimeCd = 0;
    this.evadeT = 0;
    this.bustedT = 0;
    this.onWanted = null;     // (n) => ui
    this.onBusted = null;     // () => game
  }

  /** crime sev: 1 = halka (shot / hit), 2 = bada (police ram) */
  reportCrime(sev = 1) {
    if (this.crimeCd > 0) return;
    this.crimeCd = 5;
    this._setWanted(Math.min(5, this.wanted + (sev >= 2 ? 2 : 1)));
  }

  clear() {
    this._setWanted(0);
    this.bustedT = 0;
    this.evadeT = 0;
  }

  _setWanted(n) {
    n = Math.max(0, Math.min(5, n));
    if (n === this.wanted) return;
    const up = n > this.wanted;
    this.wanted = n;
    if (this.onWanted) this.onWanted(n);
    if (up) this.evadeT = 0;
    this._syncUnits();
  }

  _syncUnits() {
    const want = Math.min(MAX_UNITS, this.wanted);
    while (this.units.length > want) this._removeUnit(this.units.pop());
    while (this.units.length < want) this._spawnUnit();
  }

  _spawnUnit() {
    // player ke SPAWN_DIST par random road-ish jagah
    const g = this.game;
    const px = g ? (g.activeVehicle ? g.activeVehicle.body.position.x : g.player.position.x) : 0;
    const pz = g ? (g.activeVehicle ? g.activeVehicle.body.position.z : g.player.position.z) : 0;
    const a = Math.random() * Math.PI * 2;
    const d = SPAWN_DIST[0] + Math.random() * (SPAWN_DIST[1] - SPAWN_DIST[0]);
    const x = Math.max(-130, Math.min(130, px + Math.cos(a) * d));
    const z = Math.max(-130, Math.min(130, pz + Math.sin(a) * d));
    const u = new GameVehicle(this.scene, this.world, { x, y: 1.2, z }, VEHICLE_PRESETS.police);
    u.ensureGLB();
    u.policeUnit = true;
    u.body.gameTag = 'police';
    u._stuckT = 0;
    this.units.push(u);
  }

  _removeUnit(u) {
    try { u.vehicle.removeFromWorld(this.world); } catch (e) { /* already */ }
    this.world.removeBody(u.body);
    this.scene.remove(u.group);
    if (u.glbWheels) for (const w of u.glbWheels) if (w.parent) w.parent.remove(w);
    if (u.wheelMeshes) for (const w of u.wheelMeshes) if (w.parent) w.parent.remove(w);
  }

  update(dt, player, activeVehicle, env, mode) {
    this.crimeCd -= dt;
    if (this.wanted === 0) return;

    // player target position
    const tp = activeVehicle && mode === 'car'
      ? activeVehicle.body.position
      : player.body.position;
    const tSpeed = activeVehicle && mode === 'car'
      ? Math.abs(activeVehicle.getForwardSpeed()) * 3.6 : 0;

    let nearest = 1e9;
    for (const u of this.units) {
      const b = u.body;
      const dx = tp.x - b.position.x, dz = tp.z - b.position.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);

      // pursuit steering — target ki taraf
      const desired = Math.atan2(dx, dz);
      const diff = wrapAngle(desired - yawOf(b.quaternion));
      const steer = Math.max(-1, Math.min(1, diff * 1.7));
      let throttle = dist > 16 ? 1 : dist > 8 ? 0.5 : 0.3;
      const handbrake = Math.abs(diff) > 2.1 && dist < 22 && tSpeed > 30;

      // stuck detection — 4s slow => respawn edge se
      if (Math.abs(u.getForwardSpeed()) < 1.5 && throttle > 0.4) {
        u._stuckT += dt;
        if (u._stuckT > 4) {
          u._stuckT = 0;
          const a = Math.atan2(b.position.z - tp.z, b.position.x - tp.x);
          b.position.set(
            Math.max(-130, Math.min(130, tp.x + Math.cos(a) * 60)), 1.2,
            Math.max(-130, Math.min(130, tp.z + Math.sin(a) * 60)));
          b.velocity.setZero();
          b.angularVelocity.setZero();
        }
      } else u._stuckT = 0;

      u.update(dt, { throttle, steer, handbrake, parked: false }, env);
    }

    // BUSTED: player car slow + police paas
    if (mode === 'car' && tSpeed < 7) {
      if (nearest < 5.5) {
        this.bustedT += dt;
        if (this.bustedT > 2.5 && this.onBusted) { this.onBusted(); this.bustedT = 0; }
      } else this.bustedT = Math.max(0, this.bustedT - dt * 2);
    } else this.bustedT = 0;

    // EVADE: sab units door + player chhupa nahi... distance-based decay
    if (this.wanted > 0 && nearest > 70) {
      this.evadeT += dt;
      if (this.evadeT > 12) { this.evadeT = 0; this._setWanted(this.wanted - 1); }
    } else if (nearest < 40) this.evadeT = 0;
  }
}

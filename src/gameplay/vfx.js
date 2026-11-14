import * as THREE from 'three';

// ---------------------------------------------------------------------------
// VELARA ParticleFX (v0.8.0) — pooled additive sprites, ZERO per-frame alloc.
// burst(x, y, z, color, count, speed, life) — dust/smoke/puff/spark sab isi se.
// Usage: game.vfx.burst(...) — footstep dust, crash smoke, thug-death poof.
// ---------------------------------------------------------------------------

const POOL = 90;

export class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.parts.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, grow: 1 });
    }
    this._cursor = 0;
  }

  burst(x, y, z, color = 0x9a8a78, count = 10, speed = 2.5, life = 0.55, grow = 2.2) {
    const col = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const p = this.parts[this._cursor];
      this._cursor = (this._cursor + 1) % POOL;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = up * sp * 0.8;
      p.life = p.maxLife = life * (0.7 + Math.random() * 0.5);
      p.grow = grow;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.copy(col);
      p.mesh.material.opacity = 0.75;
      p.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
      p.mesh.rotation.z = Math.random() * Math.PI;
      p.mesh.visible = true;
    }
  }

  update(dt, camera) {
    for (const p of this.parts) {
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      const k = p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 1.4 * dt;                       // halka gravity
      p.mesh.material.opacity = 0.7 * k;
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      if (camera) p.mesh.rotation.y = Math.atan2(   // billboard
        camera.position.x - p.mesh.position.x,
        camera.position.z - p.mesh.position.z);
    }
  }
}

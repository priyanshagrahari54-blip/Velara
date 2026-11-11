import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// VELARA traffic: dynamic servo-driven AI cars on the road grid.
// Heavy dynamic bodies whose velocity is steered every frame — finite-mass
// collisions (no more kinematic infinity-launches), and they never collide
// with each other (only with the player, hero car and statics).
// ---------------------------------------------------------------------------

const PALETTE = [0x8a2f2f, 0x2f4d8a, 0x3a6b46, 0x777d88, 0x4b3a6e, 0x9a7b2f, 0x24313d, 0x6b6b3a];

function buildCarMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.7, roughness: 0.35, clearcoat: 0.8, envMapIntensity: 1.1,
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x070a10, metalness: 0.9, roughness: 0.08 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.55, 4.35), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), glass);
  cabin.position.set(0, 1.08, 0.15);
  cabin.castShadow = true;
  const hl = new THREE.MeshBasicMaterial({ color: 0xd8ecff });
  const tl = new THREE.MeshBasicMaterial({ color: 0xdd1122 });
  for (const sx of [0.58, -0.58]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), hl);
    h.position.set(sx, 0.66, -2.18);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.06), tl);
    t.position.set(sx, 0.68, 2.18);
    g.add(t);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[0.86, -1.4], [-0.86, -1.4], [0.86, 1.4], [-0.86, 1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.37, wz);
    g.add(w);
    wheels.push(w);
  }
  g.add(body, cabin);
  return { g, wheels };
}

export class TrafficSystem {
  constructor(scene, world, ROADS, EXTENT) {
    this.ROADS = ROADS;
    this.EXTENT = EXTENT;
    this.cars = [];
    this.trafficMat = new CANNON.Material('traffic');

    const count = 7;
    for (let i = 0; i < count; i++) {
      const axis = i % 2 === 0 ? 'z' : 'x';
      const road = ROADS[1 + Math.floor(Math.random() * (ROADS.length - 2))];
      const dir = Math.random() < 0.5 ? 1 : -1;
      const lane = 3.6 * dir;
      const base = 8 + Math.random() * 7;
      const { g, wheels } = buildCarMesh(PALETTE[i % PALETTE.length]);

      const body = new CANNON.Body({
        mass: 1500,
        material: this.trafficMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.95, 0.7, 2.2)),
        fixedRotation: true,
        collisionFilterGroup: 8,      // traffic group
        collisionFilterMask: 1 | 2,   // statics + player + hero car, NOT other traffic
      });
      const x = axis === 'z' ? road + lane : (Math.random() - 0.5) * 2 * EXTENT;
      const z = axis === 'z' ? (Math.random() - 0.5) * 2 * EXTENT : road - lane;
      body.position.set(x, 0.85, z);
      world.addBody(body);

      const yaw = axis === 'z'
        ? (dir === 1 ? Math.PI : 0)
        : (dir === 1 ? -Math.PI / 2 : Math.PI / 2);

      this.cars.push({
        axis, road, dir, lane, base, speed: base, mesh: g, body, wheels, yaw,
      });
      scene.add(g);
    }
  }

  update(dt, avoidList) {
    for (const car of this.cars) {
      const fx = car.axis === 'z' ? 0 : car.dir;
      const fz = car.axis === 'z' ? car.dir : 0;

      // desired speed, slowing near the hero / player
      let target = car.base;
      for (const av of avoidList) {
        const dx = av.x - car.body.position.x;
        const dz = av.z - car.body.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 900) {
          const ahead = dx * fx + dz * fz;
          const side = Math.abs(car.axis === 'z' ? dx : dz);
          if (ahead > 0 && ahead < 20 && side < 4.5) target = 0;
          // predictive: where will we be in ~1.2s vs the avoider?
          const tfx = car.body.position.x + fx * car.speed * 1.2;
          const tfz = car.body.position.z + fz * car.speed * 1.2;
          if (Math.hypot(tfx - av.x, tfz - av.z) < 7) target = Math.min(target, 2);
        }
        // full stop if the obstacle is basically on top of us (any direction)
        if (d2 < 12.25) target = 0;
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2.2);

      // velocity servo (keeps them driving; collisions stay finite-mass)
      const k = Math.min(1, dt * 2);
      car.body.velocity.x += (fx * car.speed - car.body.velocity.x) * k;
      car.body.velocity.z += (fz * car.speed - car.body.velocity.z) * k;
      car.body.velocity.y = -1.5;
      car.body.position.y = 0.85;

      // wrap around
      const lim = this.EXTENT + 30;
      if (car.body.position.x > lim) car.body.position.x = -lim;
      if (car.body.position.x < -lim) car.body.position.x = lim;
      if (car.body.position.z > lim) car.body.position.z = -lim;
      if (car.body.position.z < -lim) car.body.position.z = lim;

      // sync mesh
      car.mesh.position.copy(car.body.position);
      car.mesh.position.y = 0;
      car.mesh.rotation.y = car.yaw;
      const spin = (car.speed * dt) / 0.37;
      for (const w of car.wheels) w.rotation.x += spin;
    }
  }

  minimapData() {
    return this.cars.map((c) => ({ x: c.body.position.x, z: c.body.position.z }));
  }
}

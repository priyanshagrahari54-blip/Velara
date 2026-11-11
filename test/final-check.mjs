import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -13.8, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(700, 1, 700)), position: new CANNON.Vec3(0, -1, 0) });
world.addBody(ground);

const chassis = new CANNON.Body({ mass: 950, position: new CANNON.Vec3(0, 1.15, 0) });
chassis.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.4, 2.28)));
chassis.angularDamping = 0.25;
const vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexForwardAxis: 2, indexUpAxis: 1 });
const wo = {
  radius: 0.42, directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 160, suspensionRestLength: 0.42, frictionSlip: 2.5,
  dampingRelaxation: 4, dampingCompression: 6.4,
  maxSuspensionForce: 250000, rollInfluence: 0.04,
  axleLocal: new CANNON.Vec3(1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(1, -0.02, 1),
  maxSuspensionTravel: 0.35, customSlidingRotationalSpeed: -32, useCustomSlidingRotationalSpeed: true,
};
for (const [x, z] of [[0.92, -1.42], [-0.92, -1.42], [0.92, 1.44], [-0.92, 1.44]]) {
  wo.chassisConnectionPointLocal.set(x, -0.02, z);
  vehicle.addWheel(wo);
}
vehicle.addToWorld(world);

// accelerate hard for 4s, then steer left for 2s at speed
for (let i = 1; i <= 360; i++) {
  const sec = i / 60;
  for (let w = 0; w < 4; w++) vehicle.applyEngineForce(3500, w);
  if (sec > 4) {
    vehicle.setSteeringValue(0.35, 0);
    vehicle.setSteeringValue(0.35, 1);
  }
  world.step(1 / 60);
  if (i % 60 === 0) {
    const q = chassis.quaternion;
    console.log(`t=${sec.toFixed(0)}s pos=(${chassis.position.x.toFixed(1)}, ${chassis.position.y.toFixed(2)}, ${chassis.position.z.toFixed(1)}) kmh=${(chassis.velocity.length()*3.6).toFixed(0)} yawOk=${(1 - 2*(q.x*q.x + q.y*q.y)).toFixed(2)}`);
  }
}
vehicle.updateWheelTransform(0);
console.log('front-left wheel y:', vehicle.wheelInfos[0].worldTransform.position.y.toFixed(2), '(expect ~0.42)');

// handbrake drift test: turn + rear friction low
for (let i = 1; i <= 240; i++) {
  vehicle.applyEngineForce(2000, 2); vehicle.applyEngineForce(2000, 3);
  vehicle.setSteeringValue(0.5, 0); vehicle.setSteeringValue(0.5, 1);
  vehicle.wheelInfos[2].frictionSlip = 1.05; vehicle.wheelInfos[3].frictionSlip = 1.05;
  vehicle.setBrake(26, 2); vehicle.setBrake(26, 3);
  world.step(1 / 60);
  if (i % 80 === 0) {
    const v = chassis.velocity;
    const f = new CANNON.Vec3(0, 0, -1);
    chassis.quaternion.vmult(f, f);
    const along = v.x*f.x + v.z*f.z;
    const lat = Math.sqrt(Math.max(0, v.x*v.x + v.z*v.z - along*along));
    console.log(`drift t=${(i/60).toFixed(1)}s kmh=${(v.length()*3.6).toFixed(0)} lateral=${lat.toFixed(1)} m/s ${lat > 3 ? '(DRIFTING!)' : ''}`);
  }
}

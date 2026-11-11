import * as CANNON from 'cannon-es';

function run(label, split, stiff, dampC) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -13.8, 0) });
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(400, 1, 400)), position: new CANNON.Vec3(0, -1, 0) });
  world.addBody(ground);
  const chassis = new CANNON.Body({ mass: 950, position: new CANNON.Vec3(0, 1.15, 0) });
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.4, 2.28)));
  chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.82, 0.32, 1.0)), new CANNON.Vec3(0, 0.55, 0.2));
  chassis.angularDamping = 0.4;
  const vehicle = new CANNON.RaycastVehicle({ chassisBody: chassis, indexRightAxis: 0, indexForwardAxis: 2, indexUpAxis: 1 });
  const wo = {
    radius: 0.42, directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: stiff, suspensionRestLength: 0.42, frictionSlip: 2.5,
    dampingRelaxation: 4, dampingCompression: dampC,
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
  const ys = [];
  for (let i = 1; i <= 360; i++) {
    vehicle.applyEngineForce(4200 * split[0], 0);
    vehicle.applyEngineForce(4200 * split[0], 1);
    vehicle.applyEngineForce(4200 * split[1], 2);
    vehicle.applyEngineForce(4200 * split[1], 3);
    world.step(1 / 60);
    if (i % 45 === 0) ys.push(chassis.position.y.toFixed(2) + '/' + (chassis.velocity.length() * 3.6).toFixed(0));
  }
  console.log(`${label}: y/kmh over 6s: ${ys.join('  ')}`);
}
run('42/58 split', [0.42, 0.58], 160, 6.4);
run('50/50 split', [0.5, 0.5], 160, 6.4);
run('42/58 stiff 220', [0.42, 0.58], 220, 8);
run('50/50 stiff 220', [0.5, 0.5], 220, 8);

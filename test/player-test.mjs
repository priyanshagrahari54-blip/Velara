import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -13.8, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);

const groundMat = new CANNON.Material('ground');
const ground = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Box(new CANNON.Vec3(700, 1, 700)), position: new CANNON.Vec3(0, -1, 0) });
world.addBody(ground);
const sidewalk = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Box(new CANNON.Vec3(18, 0.18, 18)), position: new CANNON.Vec3(0, 0, 0) });
world.addBody(sidewalk);

const playerMat = new CANNON.Material('player');
const body = new CANNON.Body({
  mass: 78, material: playerMat, position: new CANNON.Vec3(-10, 1.1, -10),
  fixedRotation: true, linearDamping: 0.02,
  collisionFilterGroup: 2, collisionFilterMask: -1,
});
body.addShape(new CANNON.Sphere(0.42), new CANNON.Vec3(0, 0, 0));
body.addShape(new CANNON.Sphere(0.34), new CANNON.Vec3(0, 0.8, 0));
body.allowSleep = false;
world.addBody(body);

world.addContactMaterial(new CANNON.ContactMaterial(playerMat, groundMat, { friction: 0.0, restitution: 0.0 }));

for (let i = 1; i <= 120; i++) {
  world.step(1 / 60);
  if (i % 30 === 0) console.log(`t=${(i/60).toFixed(1)}s y=${body.position.y.toFixed(3)} contacts=${world.contacts.length}`);
}

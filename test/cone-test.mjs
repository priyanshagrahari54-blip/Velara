import * as CANNON from 'cannon-es';
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(50, 1, 50)), position: new CANNON.Vec3(0, -1, 0) });
world.addBody(ground);
const cone = new CANNON.Body({ mass: 2, shape: new CANNON.Cylinder(0.05, 0.36, 0.85, 8), position: new CANNON.Vec3(0, 3, 0), angularDamping: 0.3 });
world.addBody(cone);
for (let i = 0; i < 240; i++) world.step(1 / 60);
console.log('cone settled: y=' + cone.position.y.toFixed(3) + ' (expect ~0.43 if Y-aligned) xz drift=' + Math.hypot(cone.position.x, cone.position.z).toFixed(3));

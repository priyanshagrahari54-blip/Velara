import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// STREET PROPS (remaster) — "even of smaller thing proper physics":
// traffic cones + litter bins — halki CANNON bodies, takkar par udte hain.
// ---------------------------------------------------------------------------

export function spawnStreetProps(scene, world) {
  const props = [];

  const coneMat = new THREE.MeshStandardMaterial({ color: 0xd8551e, roughness: 0.7 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.6 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2e4a36, roughness: 0.8, metalness: 0.2 });

  const mkCone = (x, z) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 10), coneMat);
    c.position.y = 0.28; c.castShadow = true;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.145, 0.09, 10), bandMat);
    b.position.y = 0.3;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), coneMat);
    base.position.y = 0.03;
    g.add(c, b, base);
    g.position.set(x, 0, z);
    scene.add(g);
    const body = new CANNON.Body({
      mass: 3.5,
      shape: new CANNON.Box(new CANNON.Vec3(0.17, 0.28, 0.17)),
      position: new CANNON.Vec3(x, 0.3, z),
      linearDamping: 0.15, angularDamping: 0.25,
    });
    world.addBody(body);
    props.push({ mesh: g, body });
  };

  const mkBin = (x, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 10), binMat);
    m.position.set(x, 0.45, z);
    m.castShadow = true;
    scene.add(m);
    const body = new CANNON.Body({
      mass: 14,
      shape: new CANNON.Cylinder(0.3, 0.26, 0.85, 8),
      position: new CANNON.Vec3(x, 0.45, z),
      linearDamping: 0.2, angularDamping: 0.4,
    });
    world.addBody(body);
    props.push({ mesh: m, body });
  };

  // plaza ke aas-paas cones ki line + kuch street corners par bins
  for (let i = 0; i < 7; i++) mkCone(-10 + i * 1.6, 2.5);
  for (let i = 0; i < 5; i++) mkCone(24 + i * 1.6, 36);
  for (let i = 0; i < 5; i++) mkCone(-40 + i * 1.6, -30);
  const bins = [[8, 34], [-18, 26], [42, 62], [-52, -44], [30, -60], [-8, 74]];
  for (const [x, z] of bins) mkBin(x, z);

  return {
    props,
    update() {
      for (const p of this.props) {
        p.mesh.position.copy(p.body.position);
        p.mesh.quaternion.copy(p.body.quaternion);
      }
    },
  };
}

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// VELARA shooting range — stunt plaza ke east side (block bx=4,bz=2, cx=104).
// 6 knock-down plate targets + walk-over ammo crates.
// Targets: static hit-sensor bodies + purely visual topple/rise animation
// (robust — koi ragdoll physics nahi jo tod sakta hai).
// ---------------------------------------------------------------------------

const RANGE = { cx: 104, cz: 0, targetX: 116, shooterX: 98 };

export function buildRange(scene, world) {
  // ------------------------------------------------------------- floor pad
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(26, 0.06, 34),
    new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.9 }));
  pad.position.set(RANGE.cx + 4, 0.4, RANGE.cz);
  pad.receiveShadow = true;
  scene.add(pad);
  // walkable physics for the pad (so feet/cars sit ON it, not in it)
  world.addBody(new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(13, 0.03, 17)),
    position: new CANNON.Vec3(RANGE.cx + 4, 0.4, RANGE.cz),
  }));

  // glowing range sign board
  const signMat = new THREE.MeshStandardMaterial({
    color: 0x0d1420, emissive: 0xff4444, emissiveIntensity: 0.9, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 0.24), signMat);
  sign.position.set(RANGE.cx + 4, 3.4, RANGE.cz - 15.5);
  sign.castShadow = true;
  scene.add(sign);
  const signLight = new THREE.PointLight(0xff5555, 14, 20, 2);
  signLight.position.set(RANGE.cx + 4, 3.6, RANGE.cz - 14);
  scene.add(signLight);

  // lane stripes on the pad (shooter line)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.07, 30),
    new THREE.MeshBasicMaterial({ color: 0xffd257 }));
  stripe.position.set(RANGE.shooterX, 0.44, RANGE.cz);
  scene.add(stripe);

  // ------------------------------------------------------------- targets
  const targets = [];
  const targetByBody = new Map();

  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.6, metalness: 0.5 });
  const plateRed = new THREE.MeshStandardMaterial({ color: 0xb3242c, roughness: 0.55 });
  const plateWhite = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.55 });

  for (let i = 0; i < 6; i++) {
    const tz = RANGE.cz - 12.5 + i * 5;
    const tx = RANGE.targetX;

    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(tx, 1.05, tz);
    post.castShadow = true;
    scene.add(post);

    // plate group pivots at its bottom edge so it can topple backward (+x)
    const pivot = new THREE.Group();
    pivot.position.set(tx, 0.85, tz);
    const plateG = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 22), plateRed);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.065, 20), plateWhite);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 14), plateRed);
    for (const m of [outer, inner, center]) {
      m.rotation.z = Math.PI / 2;   // cylinder axis along X => plate faces -x
      m.castShadow = true;
      plateG.add(m);
    }
    plateG.position.y = 0.62;       // plate center above the pivot
    pivot.add(plateG);
    scene.add(pivot);

    // static hit sensor (always standing; visual topple is cosmetic)
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      collisionFilterGroup: 1,
      shape: new CANNON.Box(new CANNON.Vec3(0.06, 0.6, 0.6)),
      position: new CANNON.Vec3(tx, 1.45, tz),
    });
    world.addBody(body);

    const t = {
      x: tx, z: tz,
      pivot, body,
      toppled: false,
      animT: 0,      // 0 = standing, 1 = flat
      respawnT: 0,
    };
    targets.push(t);
    targetByBody.set(body, t);
  }

  // ---------------------------------------------------------- ammo crates
  const ammoCrates = [];
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x1d5c2e, roughness: 0.6, metalness: 0.2,
    emissive: 0x1f8f45, emissiveIntensity: 0.25 });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x164a24, roughness: 0.55 });
  for (const [ax, az] of [[RANGE.shooterX - 3, RANGE.cz + 6], [RANGE.shooterX - 3, RANGE.cz - 6]]) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.6), crateMat);
    box.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.65), lidMat);
    lid.position.y = 0.3;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xaef5c6 }));
    mark.position.set(0, 0.12, 0.31);
    g.add(box, lid, mark);
    g.position.set(ax, 0.72, az);
    scene.add(g);
    ammoCrates.push({ x: ax, z: az, group: g, cooldown: 0 });
  }

  // ------------------------------------------------------------- update
  function update(dt) {
    for (const t of targets) {
      if (t.toppled) {
        // fall animation then timed respawn
        t.animT = Math.min(1, t.animT + dt * 3.2);
        t.pivot.rotation.z = -t.animT * (Math.PI / 2) * 0.96;
        if (t.animT >= 1) {
          t.respawnT -= dt;
          if (t.respawnT <= 0) t.toppled = false;
        }
      } else if (t.animT > 0) {
        // rise animation
        t.animT = Math.max(0, t.animT - dt * 1.8);
        t.pivot.rotation.z = -t.animT * (Math.PI / 2) * 0.96;
      }
    }
    for (const c of ammoCrates) {
      if (c.cooldown > 0) {
        c.cooldown -= dt;
        const ready = c.cooldown <= 0;
        c.group.children[0].material.emissiveIntensity = ready ? 0.25 : 0.02;
        if (ready) c.cooldown = 0;
      }
    }
  }

  function hit(t) {
    if (t.toppled) return false;
    t.toppled = true;
    t.respawnT = 6;
    return true;
  }

  function reset() {
    for (const t of targets) {
      t.toppled = false;
      t.animT = 0;
      t.respawnT = 0;
      t.pivot.rotation.z = 0;
    }
    for (const c of ammoCrates) { c.cooldown = 0; c.group.children[0].material.emissiveIntensity = 0.25; }
  }

  return {
    targets, ammoCrates, targetByBody,
    RANGE,
    update, hit, reset,
    minimapData: () => targets.filter((t) => !t.toppled).map((t) => ({ x: t.x, z: t.z })),
  };
}

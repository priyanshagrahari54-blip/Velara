import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------------------
// Physics world factory. Fixed timestep 1/60, max 3 substeps.
// NOTE (ADR-002): the static ground is a big BOX, not an infinite Plane —
// raycast vehicles lose wheel traction against Plane shapes.
// ---------------------------------------------------------------------------

export const FIXED_STEP = 1 / 60;
export const MAX_SUBSTEPS = 3;
export const GRAVITY = -13.8;

export function createPhysicsWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.defaultContactMaterial.friction = 0.25;
  world.defaultContactMaterial.restitution = 0.05;
  return world;
}

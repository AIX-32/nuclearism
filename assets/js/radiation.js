// Directional radiation.
//
// Radiation arrives from a source spot in the world, so it has a direction:
// the ambient field comes from the world's fallout point, machines radiate from
// their own block. Anything solid between the player and that direction
// absorbs part of it.
//
// Shadowing is a fixed-step near-field march, not raytracing: one sample per
// metre over the first 24 metres only. Walls close to the player matter,
// distant hills do not.

export const RAD_OCCL = {
  samples: 24,   // steps along the ray (1 per metre)
  range: 24,     // metres of near field sampled
  solid: 0.62,   // transmission kept per solid metre sampled
};

function hash01(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

// The fallout spot: a fixed world point derived from the world seed, so the
// source of the ambient field is the same every time a world is loaded.
export function sourcePoint(seed, dist = 240) {
  const a = hash01(seed | 0) * Math.PI * 2;
  return { x: Math.cos(a) * dist, z: Math.sin(a) * dist };
}

// Transmission (0..1) of radiation travelling along the unit direction
// (dx,dy,dz) from (px,py,pz). `factorAt(x,y,z)` returns the transmission kept
// at that point: 1 for open air, less for anything solid. Later a lead wall
// can simply return a smaller factor.
export function transmission(factorAt, px, py, pz, dx, dy, dz, o = RAD_OCCL) {
  let t = 1;
  for (let i = 1; i <= o.samples; i++) {
    const d = (i / o.samples) * o.range;
    t *= factorAt(px + dx * d, py + dy * d, pz + dz * d);
  }
  return t;
}

// Screen-relative bearing of a world direction: 0 = ahead, +90 = to the right.
export function relativeBearing(dx, dz, yaw) {
  const fwd = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, fwd) * 180 / Math.PI;
}

// Compass label of a world direction, north = -Z.
export function compass(dx, dz) {
  const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

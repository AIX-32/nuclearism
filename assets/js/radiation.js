










export const RAD_OCCL = {
  samples: 24,
  range: 24,
  solid: 0.62,
};

function hash01(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}



export function sourcePoint(seed, dist = 240) {
  const a = hash01(seed | 0) * Math.PI * 2;
  return { x: Math.cos(a) * dist, z: Math.sin(a) * dist };
}





export function transmission(factorAt, px, py, pz, dx, dy, dz, o = RAD_OCCL) {
  let t = 1;
  for (let i = 1; i <= o.samples; i++) {
    const d = (i / o.samples) * o.range;
    t *= factorAt(px + dx * d, py + dy * d, pz + dz * d);
  }
  return t;
}




export function shaftBurial(depth, up, built = 1) {
  if (depth <= 0.5) return 1;
  const buried = Math.pow(0.45, Math.min(depth, 40));
  return Math.max(buried, Math.min(1, up * built));
}


export function relativeBearing(dx, dz, yaw) {
  const fwd = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  return Math.atan2(right, fwd) * 180 / Math.PI;
}


export function compass(dx, dz) {
  const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

import { anySupport, baseAt } from './placement.js';

const H = 3;

function cells(x, y, z) {
  const out = [];
  for (let j = 0; j < H; j++) {
    out.push([`${x},${y + j},${z}`, {
      minX: x + 0.3, maxX: x + 0.7,
      minY: y + j, maxY: y + j + 1,
      minZ: z + 0.4, maxZ: z + 0.6,
    }]);
  }
  return out;
}

function geometry(THREE) {
  const pos = [], nrm = [], uv = [];
  const quad = (a, b, c, d, n) => {
    for (const [p, t] of [[a, [0, 0]], [b, [1, 0]], [c, [1, 1]], [a, [0, 0]], [c, [1, 1]], [d, [0, 1]]]) {
      pos.push(p[0], p[1], p[2]);
      nrm.push(n[0], n[1], n[2]);
      uv.push(t[0] * 3, t[1] * 3);
    }
  };
  const box = (x0, y0, z0, x1, y1, z1) => {
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  };
  box(-0.42, 0, -0.06, -0.34, 1, 0.06);
  box(0.34, 0, -0.06, 0.42, 1, 0.06);
  for (let i = 0; i < 10; i++) {
    const y = (i + 0.5) / 10;
    box(-0.38, y - 0.035, -0.045, 0.38, y + 0.035, 0.045);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export const KIND = {
  name: 'ladder',
  rot: 1,
  solid: false,          // the player climbs through it, not into it
  attenuate: true,
  geom: 'ladder',
  geometry,
  cells,
  center(x, y, z) { return { x: x + 0.5, y, z: z + 0.5 }; },
  scale() { return { x: 1, y: H, z: 1 }; },
  base(sys, x, z) { return baseAt(sys, cells(x, 0, z)); },
  support(sys, x, y, z) { return anySupport(sys, cells(x, y, z), y); },
};

export const ITEMS = {
  ladder_wood: { code: 'LD', name: 'WOOD LADDER BB', stack: 16, rad: 0, block: false, building: { kind: 'ladder', tier: 'wood' }, table: true, desc: 'A three-metre climbing ladder. Stand against it and walk forward/back to climb.' },
  ladder_brick: { code: 'LB', name: 'BRICK LADDER BB', stack: 16, rad: 0, block: false, building: { kind: 'ladder', tier: 'brick' }, desc: 'A heavier three-metre ladder. Walk forward/back against it to climb.' },
  ladder_concrete: { code: 'LC', name: 'CONCRETE LADDER BB', stack: 16, rad: 0, block: false, building: { kind: 'ladder', tier: 'concrete' }, desc: 'A poured three-metre ladder. Walk forward/back against it to climb.' },
  ladder_shielded: { code: 'LS', name: 'SHIELDED LADDER BB', stack: 16, rad: 0, block: false, building: { kind: 'ladder', tier: 'shielded' }, desc: 'A lead-lined three-metre ladder. Walk forward/back against it to climb.' },
};

export const RECIPES = [
  { out: { ladder_wood: 1 }, needs: { wood: 8, iron_ingot: 2 } },
  { out: { ladder_brick: 1 }, needs: { stone: 12, sand: 4, wood: 6, iron_ingot: 3 } },
  { out: { ladder_concrete: 1 }, needs: { stone: 16, gravel: 6, sand: 5, iron_ingot: 4, steel_ingot: 1 } },
  { out: { ladder_shielded: 1 }, needs: { stone: 16, gravel: 6, sand: 5, iron_ingot: 4, lead_plate: 1, lead_ingot: 1 } },
];

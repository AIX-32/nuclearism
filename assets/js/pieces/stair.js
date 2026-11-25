import { anySupport, baseAt } from './placement.js';

// A 3 m wide stair climbing 2 m over a 3 m run in ten 0.2 m risers. 0.2 m is
// one rate-limited ground-follow step at 60 fps, so walking down stays smooth,
// and the top tread reaches the next cell exactly so a floor can rest on it.
const W = 3, D = 3, RISE = 2, STEP = 0.2;
const STEPS_PER_CELL = [3, 3, 4];

const STEPS = [];
for (let i = 0, n = 0; i < D; i++) {
  const c = STEPS_PER_CELL[i];
  for (let j = 0; j < c; j++, n++) {
    STEPS.push({ v0: i + j / c, v1: i + (j + 1) / c, h: (n + 1) * STEP });
  }
}

function turn(u, v, rot) {
  switch (rot % 4) {
    case 0: return [u, v];
    case 1: return [v, D - u];
    case 2: return [D - u, D - v];
    default: return [D - v, u];
  }
}

function cells(x, y, z, rot) {
  const out = [];
  for (const st of STEPS) {
    const layers = Math.ceil(st.h - 1e-9);
    for (let xi = 0; xi < W; xi++) {
      for (let layer = 0; layer < layers; layer++) {
        const top = Math.min(st.h, layer + 1);
        if (top - layer < 1e-9) continue;
        const pts = [[xi, st.v0], [xi + 1, st.v0], [xi, st.v1], [xi + 1, st.v1]]
          .map(([u, v]) => turn(u, v, rot));
        const minX = Math.min(...pts.map((p) => p[0]));
        const maxX = Math.max(...pts.map((p) => p[0]));
        const minZ = Math.min(...pts.map((p) => p[1]));
        const maxZ = Math.max(...pts.map((p) => p[1]));
        out.push([`${x + Math.floor(minX + 1e-9)},${y + layer},${z + Math.floor(minZ + 1e-9)}`, {
          minX: x + minX, maxX: x + maxX,
          minY: y + layer, maxY: y + top,
          minZ: z + minZ, maxZ: z + maxZ,
        }]);
      }
    }
  }
  return out;
}

function geometry(THREE) {
  const pos = [], nrm = [], uv = [];
  const quad = (a, b, c, d, n, ta, tb, tc, td) => {
    for (const [p, t] of [[a, ta], [b, tb], [c, tc], [a, ta], [c, tc], [d, td]]) {
      pos.push(p[0], p[1], p[2]);
      nrm.push(n[0], n[1], n[2]);
      uv.push(t[0] * 3, t[1] * 3);
    }
  };
  const zOf = (v) => v / D - 0.5;
  const yOf = (h) => h / RISE;
  const x0 = -0.5, x1 = 0.5;

  for (let i = 0; i < STEPS.length; i++) {
    const st = STEPS[i];
    const z0 = zOf(st.v0), z1 = zOf(st.v1);
    const yTop = yOf(st.h), yPrev = i ? yOf(STEPS[i - 1].h) : 0;
    quad([x0, yTop, z0], [x0, yTop, z1], [x1, yTop, z1], [x1, yTop, z0], [0, 1, 0],
      [x0 + 0.5, z0 + 0.5], [x0 + 0.5, z1 + 0.5], [x1 + 0.5, z1 + 0.5], [x1 + 0.5, z0 + 0.5]);
    quad([x1, yPrev, z0], [x0, yPrev, z0], [x0, yTop, z0], [x1, yTop, z0], [0, 0, -1],
      [x1 + 0.5, yPrev], [x0 + 0.5, yPrev], [x0 + 0.5, yTop], [x1 + 0.5, yTop]);
    quad([x0, 0, z0], [x0, 0, z1], [x0, yTop, z1], [x0, yTop, z0], [-1, 0, 0],
      [z0 + 0.5, 0], [z1 + 0.5, 0], [z1 + 0.5, yTop], [z0 + 0.5, yTop]);
    quad([x1, 0, z1], [x1, 0, z0], [x1, yTop, z0], [x1, yTop, z1], [1, 0, 0],
      [z1 + 0.5, 0], [z0 + 0.5, 0], [z0 + 0.5, yTop], [z1 + 0.5, yTop]);
  }
  quad([x0, 0, -0.5], [x1, 0, -0.5], [x1, 0, 0.5], [x0, 0, 0.5], [0, -1, 0],
    [0, 0], [1, 0], [1, 1], [0, 1]);
  quad([x0, 0, 0.5], [x1, 0, 0.5], [x1, 1, 0.5], [x0, 1, 0.5], [0, 0, 1],
    [0, 0], [1, 0], [1, 1], [0, 1]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export const KIND = {
  name: 'stair',
  rot: 4,
  solid: true,
  attenuate: true,
  geom: 'stair',
  geometry,
  rotY(rot) { return (rot % 4) * Math.PI / 2; },
  cells,
  center(x, y, z) { return { x: x + W / 2, y, z: z + D / 2 }; },
  scale() { return { x: W, y: RISE, z: D }; },
  base(sys, x, z, rot) { return baseAt(sys, cells(x, 0, z, rot)); },
  support(sys, x, y, z, rot) { return anySupport(sys, cells(x, y, z, rot), y); },
};

export const ITEMS = {
  stair_wood: { code: 'STA', name: 'WOOD STAIR BB', stack: 99, rad: 0, block: false, building: { kind: 'stair', tier: 'wood' }, table: true, desc: 'A timber staircase that climbs two metres.' },
  stair_brick: { code: 'STB', name: 'BRICK STAIR BB', stack: 99, rad: 0, block: false, building: { kind: 'stair', tier: 'brick' }, desc: 'A fired clay staircase.' },
  stair_concrete: { code: 'STC', name: 'CONCRETE STAIR BB', stack: 99, rad: 0, block: false, building: { kind: 'stair', tier: 'concrete' }, desc: 'A poured concrete staircase.' },
  stair_shielded: { code: 'STD', name: 'SHIELDED CONCRETE STAIR BB', stack: 99, rad: 0, block: false, building: { kind: 'stair', tier: 'shielded' }, desc: 'A lead lined staircase.' },
};

export const RECIPES = [
  { out: { stair_wood: 1 }, needs: { wood: 6 } },
  { out: { stair_brick: 1 }, needs: { stone: 12, sand: 4, wood: 2 } },
  { out: { stair_concrete: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1 } },
  { out: { stair_shielded: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1, lead_plate: 1, lead_ingot: 1 } },
];

// Door: a 3 m wide wall panel with a doorway cutout in the middle (1 m wide,
// 2 m tall at the bottom). It places and snaps like a wall segment so runs stay
// flush, but the opening is always passable.
//
// `rot` matches the wall: direction the panel runs and which side of its cell
// it hugs, so a doorway sits flush in a wall line.

import { anySupport, baseAt } from './placement.js';

const W = 3, H = 3, TH = 0.25;
const OPEN_W = 1; // middle column
const OPEN_H = 2; // bottom 2 m

function isOpening(i, j) {
  const mid = Math.floor((W - OPEN_W) / 2);
  return i >= mid && i < mid + OPEN_W && j < OPEN_H;
}

function cells(x, y, z, rot) {
  const r = rot % 4;
  const out = [];
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (isOpening(i, j)) continue;
      if (r < 2) {
        const minZ = r === 0 ? z + 1 - TH : z;
        const maxZ = r === 0 ? z + 1 : z + TH;
        out.push([`${x + i},${y + j},${z}`, {
          minX: x + i, maxX: x + i + 1,
          minY: y + j, maxY: y + j + 1,
          minZ, maxZ,
        }]);
      } else {
        const minX = r === 2 ? x + 1 - TH : x;
        const maxX = r === 2 ? x + 1 : x + TH;
        out.push([`${x},${y + j},${z + i}`, {
          minX, maxX,
          minY: y + j, maxY: y + j + 1,
          minZ: z + i, maxZ: z + i + 1,
        }]);
      }
    }
  }
  return out;
}

function frameGeometry(THREE) {
  const parts = [];
  const add = (cx, cy, cz, sx, sy, sz) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(cx, cy, cz);
    parts.push(g);
  };
  // Unit-sized frame (scaled by KIND.scale to 3x3x0.25): left post, right post, top lintel.
  const pw = (W - OPEN_W) / 2 / W; // 1/3
  const ph = H / H;                // 1
  const lw = OPEN_W / W;           // 1/3
  const lh = (H - OPEN_H) / H;     // 1/3
  add(-0.5 + pw / 2, 0, 0, pw, ph, 1);
  add(0.5 - pw / 2, 0, 0, pw, ph, 1);
  add(0, 0.5 - lh / 2, 0, lw, lh, 1);
  const pos = [], uv = [], norm = [];
  for (const g of parts) {
    const idx = g.index ? g.index.array : null;
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), u = g.getAttribute('uv');
    const pa = p.array, na = n.array, ua = u.array;
    if (idx) {
      for (let i = 0; i < idx.length; i++) {
        const vi = idx[i];
        pos.push(pa[vi * 3], pa[vi * 3 + 1], pa[vi * 3 + 2]);
        norm.push(na[vi * 3], na[vi * 3 + 1], na[vi * 3 + 2]);
        uv.push(ua[vi * 2] * 3, ua[vi * 2 + 1] * 3);
      }
    } else {
      for (let i = 0; i < pa.length; i++) pos.push(pa[i]);
      for (let i = 0; i < na.length; i++) norm.push(na[i]);
      for (let i = 0; i < ua.length; i += 2) uv.push(ua[i] * 3, ua[i + 1] * 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

export const KIND = {
  name: 'door',
  rot: 4,
  solid: true,
  attenuate: true,
  dynamicSolid: false,
  geom: 'door_frame',
  geometry(THREE) { return frameGeometry(THREE); },

  cells,
  center(x, y, z, rot) {
    const r = rot % 4;
    if (r < 2) {
      const c = r === 0 ? z + 1 - TH / 2 : z + TH / 2;
      return { x: x + W / 2, y: y + H / 2, z: c };
    }
    const c = r === 2 ? x + 1 - TH / 2 : x + TH / 2;
    return { x: c, y: y + H / 2, z: z + W / 2 };
  },
  scale(x, y, z, rot) {
    return rot % 4 < 2 ? { x: W, y: H, z: TH } : { x: TH, y: H, z: W };
  },
  base(sys, x, z, rot) {
    return baseAt(sys, cells(x, 0, z, rot));
  },
  support(sys, x, y, z, rot) {
    return anySupport(sys, cells(x, y, z, rot), y);
  },
};

// No swinging leaf any more; kept as a no-op for callers that still import it.
export function swingFrame() { return null; }

export const ITEMS = {
  door_wood: { code: 'DW', name: 'WOOD DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'wood' }, table: true, desc: 'A timber wall with a doorway cutout in the middle.' },
  door_brick: { code: 'DB', name: 'BRICK DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'brick' }, desc: 'A heavy fired clay wall with a doorway cutout in the middle.' },
  door_concrete: { code: 'DC', name: 'CONCRETE DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'concrete' }, desc: 'A poured wall with a doorway cutout in the middle.' },
  door_shielded: { code: 'DS', name: 'SHIELDED CONCRETE DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'shielded' }, desc: 'A lead lined wall with a doorway cutout. Almost nothing gets through the frame.' },
};

export const RECIPES = [
  { out: { door_wood: 1 }, needs: { wood: 14 } },
  { out: { door_brick: 1 }, needs: { stone: 24, sand: 8, wood: 4 } },
  { out: { door_concrete: 1 }, needs: { stone: 30, gravel: 12, sand: 10, iron_ingot: 2 } },
  { out: { door_shielded: 1 }, needs: { stone: 30, gravel: 12, sand: 10, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

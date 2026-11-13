// Floor panels: a 3 x 3 m slab that closes a level of a base.
//
// Stub geometry: a 3 x 3 x 0.25 m slab whose walking surface is the top of the
// cell it sits in.

import { BUILD_TIERS } from '../build-tiers.js';

const W = 3, D = 3, TH = 0.25;

export const KIND = {
  name: 'floor',
  rot: 1,
  solid: true,
  attenuate: true,

  cells(x, y, z) {
    const out = [];
    for (let i = 0; i < W; i++) {
      for (let k = 0; k < D; k++) {
        out.push([`${x + i},${y},${z + k}`, {
          minX: x + i, maxX: x + i + 1,
          minY: y, maxY: y + TH,
          minZ: z + k, maxZ: z + k + 1,
        }]);
      }
    }
    return out;
  },
  center(x, y, z) {
    return { x: x + W / 2, y: y + TH / 2, z: z + D / 2 };
  },
  scale(x, y, z) {
    return { x: W, y: TH, z: D };
  },
  base(sys, x, z) {
    const top = sys.topAt(x, z);
    return top !== null ? top : sys.surfaceHeight(x, z);
  },
  support(sys, x, y, z) {
    return sys.groundAt(x, y - 1, z) || sys.occupied(x, y - 1, z);
  },
};

export const ITEMS = {
  floor_wood: { code: 'FW', name: 'WOOD FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'wood' }, table: true, desc: 'A timber deck. Closes a level and keeps some of the field out from above.' },
  floor_brick: { code: 'FB', name: 'BRICK FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'brick' }, desc: 'A fired clay deck.' },
  floor_concrete: { code: 'FC', name: 'CONCRETE FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'concrete' }, desc: 'A poured deck.' },
  floor_shielded: { code: 'FS', name: 'SHIELDED FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'shielded' }, desc: 'A lead lined deck. Almost nothing gets through it.' },
};

export const RECIPES = [
  { out: { floor_wood: 1 }, needs: { wood: 10 } },
  { out: { floor_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { floor_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { floor_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

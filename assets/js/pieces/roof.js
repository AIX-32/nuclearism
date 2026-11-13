// Roof panels: cap a level of a base.
//
// Stub geometry: a 3 x 3 x 0.25 m slab sitting on top of its cell, so a roof
// closes the level below it.

import { BUILD_TIERS } from '../build-tiers.js';

const W = 3, D = 3, TH = 0.25;

export const KIND = {
  name: 'roof',
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
  roof_wood: { code: 'RW', name: 'WOOD ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'wood' }, table: true, desc: 'A timber cap. Keeps the sky out, barely keeps the field out.' },
  roof_brick: { code: 'RB', name: 'BRICK ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'brick' }, desc: 'A fired clay cap.' },
  roof_concrete: { code: 'RC', name: 'CONCRETE ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'concrete' }, desc: 'A poured cap.' },
  roof_shielded: { code: 'RS', name: 'SHIELDED ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'shielded' }, desc: 'A lead lined cap. Almost nothing gets through it.' },
};

export const RECIPES = [
  { out: { roof_wood: 1 }, needs: { wood: 10 } },
  { out: { roof_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { roof_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { roof_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

// Roof panels: same thin 3 m x 3 m deck as a floor, used to cap a level.

import { baseAt, edgeSupport } from './placement.js';

const W = 3, D = 3, TH = 0.25;

export const KIND = {
  name: 'roof',
  rot: 1,
  solid: true,
  attenuate: true,

  cells(x, y, z) {
    const out = [];
    const minY = y + 1 - TH, maxY = y + 1;
    for (let i = 0; i < W; i++) {
      for (let k = 0; k < D; k++) {
        out.push([`${x + i},${y},${z + k}`, {
          minX: x + i, maxX: x + i + 1,
          minY, maxY,
          minZ: z + k, maxZ: z + k + 1,
        }]);
      }
    }
    return out;
  },
  center(x, y, z) {
    return { x: x + W / 2, y: y + 1 - TH / 2, z: z + D / 2 };
  },
  scale() {
    return { x: W, y: TH, z: D };
  },
  base(sys, x, z) {
    return baseAt(sys, KIND.cells(x, 0, z));
  },
  support(sys, x, y, z) {
    return edgeSupport(sys, KIND.cells(x, y, z), y);
  },
};

export const ITEMS = {
  roof_wood: { code: 'RW', name: 'WOOD ROOF BB', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'wood' }, table: true, desc: 'A thin timber cap, the same as a floor. Closes a level and shields some fallout.' },
  roof_brick: { code: 'RB', name: 'BRICK ROOF BB', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'brick' }, desc: 'A thin fired clay cap, the same as a floor.' },
  roof_concrete: { code: 'RC', name: 'CONCRETE ROOF BB', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'concrete' }, desc: 'A thin poured cap, the same as a floor.' },
  roof_shielded: { code: 'RS', name: 'SHIELDED CONCRETE ROOF BB', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'shielded' }, desc: 'A thin lead lined cap, the same as a floor. Almost nothing gets through it.' },
};

export const RECIPES = [
  { out: { roof_wood: 1 }, needs: { wood: 10 } },
  { out: { roof_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { roof_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { roof_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

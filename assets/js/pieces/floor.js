



import { baseAt, edgeSupport } from './placement.js';

const W = 3, D = 3, TH = 1;

export const KIND = {
  name: 'floor',
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
  floor_wood: { code: 'FW', name: 'WOOD FLOOR BB', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'wood' }, table: true, desc: 'A thin timber deck. Closes a level and shields some fallout from above.' },
  floor_brick: { code: 'FB', name: 'BRICK FLOOR BB', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'brick' }, desc: 'A thin fired clay slab that shields fallout from above.' },
  floor_concrete: { code: 'FC', name: 'CONCRETE FLOOR BB', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'concrete' }, desc: 'A thin poured slab that shields most fallout from above.' },
  floor_shielded: { code: 'FS', name: 'SHIELDED CONCRETE FLOOR BB', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'shielded' }, desc: 'A thin lead lined slab. Almost nothing gets through it.' },
};

export const RECIPES = [
  { out: { floor_wood: 1 }, needs: { wood: 25 } },
  { out: { floor_brick: 1 }, needs: { stone: 40, sand: 12, wood: 8 } },
  { out: { floor_concrete: 1 }, needs: { stone: 60, gravel: 24, sand: 16, iron_ingot: 4 } },
  { out: { floor_shielded: 1 }, needs: { stone: 60, gravel: 24, sand: 16, iron_ingot: 4, lead_plate: 3, lead_ingot: 2 } },
];

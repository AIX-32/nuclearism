// Wall panels: a 3 m x 3 m x 0.25 m slab snapped to the 1 m world grid,
// running along X or Z.

import { BUILD_TIERS } from '../build-tiers.js';

const W = 3, H = 3, TH = 0.25;

function cells(x, y, z, rot) {
  const out = [];
  const half = TH / 2;
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (rot === 0) {
        out.push([`${x + i},${y + j},${z}`, {
          minX: x + i, maxX: x + i + 1,
          minY: y + j, maxY: y + j + 1,
          minZ: z + 0.5 - half, maxZ: z + 0.5 + half,
        }]);
      } else {
        out.push([`${x},${y + j},${z + i}`, {
          minX: x + 0.5 - half, maxX: x + 0.5 + half,
          minY: y + j, maxY: y + j + 1,
          minZ: z + i, maxZ: z + i + 1,
        }]);
      }
    }
  }
  return out;
}

export const KIND = {
  name: 'wall',
  rot: 2,
  solid: true,
  attenuate: true,

  cells,
  center(x, y, z, rot) {
    return rot === 0
      ? { x: x + W / 2, y: y + H / 2, z: z + 0.5 }
      : { x: x + 0.5, y: y + H / 2, z: z + W / 2 };
  },
  scale(x, y, z, rot) {
    return rot === 0 ? { x: W, y: H, z: TH } : { x: TH, y: H, z: W };
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
  wall_wood: { code: 'WW', name: 'WOOD WALL', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'wood' }, table: true, desc: 'A timber panel. Stops about 14% of the radiation coming through it — barely worth the wood.' },
  wall_brick: { code: 'WB', name: 'BRICK WALL', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'brick' }, desc: 'Fired clay panel. Stops about 29% of the radiation coming through it.' },
  wall_concrete: { code: 'WC', name: 'CONCRETE WALL', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'concrete' }, desc: 'Poured concrete. Stops about half of the radiation coming through it.' },
  wall_shielded: { code: 'WS', name: 'SHIELDED CONCRETE WALL', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'shielded' }, desc: 'Concrete with a lead lining. Stops 99% of the radiation coming through it. Almost nothing gets past.' },
};

export const RECIPES = [
  { out: { wall_wood: 1 }, needs: { wood: 10 } },
  { out: { wall_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { wall_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { wall_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

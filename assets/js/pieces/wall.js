// Wall panels: a 3 m x 3 m x 0.25 m slab that snaps flush against floors,
// decks and other walls.
//
// `rot` picks the direction the panel runs and which side of its cell it
// hugs, so a panel can sit flush against the edge of a floor instead of
// floating a quarter metre off it:
//   rot 0: runs along X, hugs the +Z side of its cell
//   rot 1: runs along X, hugs the -Z side of its cell
//   rot 2: runs along Z, hugs the +X side of its cell
//   rot 3: runs along Z, hugs the -X side of its cell
// The band always ends on a cell boundary, so two panels that share an edge
// share it exactly and a run of panels is one straight line.

import { BUILD_TIERS } from '../build-tiers.js';
import { anySupport, baseAt } from './placement.js';

const W = 3, H = 3, TH = 0.25;

function cells(x, y, z, rot) {
  const r = rot % 4;
  const out = [];
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
      if (r < 2) {
        // runs along x, thin on z
        const minZ = r === 0 ? z + 1 - TH : z;
        const maxZ = r === 0 ? z + 1 : z + TH;
        out.push([`${x + i},${y + j},${z}`, {
          minX: x + i, maxX: x + i + 1,
          minY: y + j, maxY: y + j + 1,
          minZ, maxZ,
        }]);
      } else {
        // runs along z, thin on x
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

export const KIND = {
  name: 'wall',
  rot: 4,
  solid: true,
  attenuate: true,

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

export const ITEMS = {
  wall_wood: { code: 'WW', name: 'WOOD WALL BB', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'wood' }, table: true, desc: 'A timber panel. Stops about 14% of the radiation coming through it — barely worth the wood.' },
  wall_brick: { code: 'WB', name: 'BRICK WALL BB', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'brick' }, desc: 'Fired clay panel. Stops about 29% of the radiation coming through it.' },
  wall_concrete: { code: 'WC', name: 'CONCRETE WALL BB', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'concrete' }, desc: 'Poured concrete. Stops about half of the radiation coming through it.' },
  wall_shielded: { code: 'WS', name: 'SHIELDED CONCRETE WALL BB', stack: 99, rad: 0, block: false, building: { kind: 'wall', tier: 'shielded' }, desc: 'Concrete with a lead lining. Stops 99% of the radiation coming through it. Almost nothing gets past.' },
};

export const RECIPES = [
  { out: { wall_wood: 1 }, needs: { wood: 10 } },
  { out: { wall_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { wall_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { wall_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

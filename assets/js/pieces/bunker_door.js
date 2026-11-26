import { baseAt } from './placement.js';



const W = 3, H = 3, TH = 0.25;
export const SLIDE_DIST = W;
export const SLIDE_TIME = 0.55;

function cells(x, y, z, rot) {
  const r = rot % 4;
  const out = [];
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) {
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

function floorSupport(sys, x, y, z, rot) {
  for (const [key, box] of cells(x, y, z, rot)) {
    const [cx, cy, cz] = key.split(',').map(Number);
    if (cy !== y) continue;
    const below = sys.cells.get(`${cx},${y - 1},${cz}`);
    const list = Array.isArray(below) ? below : (below ? [below] : []);
    if (list.some((c) => c.piece?.kind === 'floor' && Math.abs(c.box.maxY - box.minY) < 1e-6)) return true;
  }
  return false;
}

export function mateOf(sys, piece) {
  if (!sys || !piece || piece.kind !== KIND.name) return null;
  const axis = piece.rot % 4 < 2 ? 'x' : 'z';
  const other = axis === 'x' ? 'z' : 'x';
  for (const q of sys.pieces.values()) {
    if (q === piece || q.kind !== piece.kind || q.y !== piece.y || q.rot !== piece.rot) continue;
    if (q[other] !== piece[other]) continue;
    if (Math.abs(q[axis] - piece[axis]) === W) return q;
  }
  return null;
}

export function slideOffset(sys, piece, amount = piece.slide || 0) {
  if (!amount) return { x: 0, y: 0, z: 0 };
  const axis = piece.rot % 4 < 2 ? 'x' : 'z';
  const mate = mateOf(sys, piece);
  const dir = mate ? (Math.sign(piece[axis] - mate[axis]) || 1) : 1;
  const d = dir * amount * SLIDE_DIST;
  return axis === 'x' ? { x: d, y: 0, z: 0 } : { x: 0, y: 0, z: d };
}

export const KIND = {
  name: 'bunker_door',
  rot: 4,
  solid: true,
  attenuate: true,
  dynamicSolid: true,
  materialShade: 0.68,
  slideOffset,
  slideTime: SLIDE_TIME,

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
  support: floorSupport,
};

export const ITEMS = {
  bunker_door_wood: { code: 'BD', name: 'WOOD SLIDING DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'bunker_door', tier: 'wood' }, table: true, desc: 'One full-width leaf of a sliding blast door. Put two beside each other on floor BBs and right-click to slide them apart.' },
  bunker_door_brick: { code: 'BB', name: 'BRICK SLIDING DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'bunker_door', tier: 'brick' }, desc: 'One leaf of a heavier sliding blast door.' },
  bunker_door_concrete: { code: 'BC', name: 'CONCRETE SLIDING DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'bunker_door', tier: 'concrete' }, desc: 'One leaf of a poured sliding blast door.' },
  bunker_door_shielded: { code: 'BS', name: 'SHIELDED SLIDING DOOR BB', stack: 16, rad: 0, block: false, building: { kind: 'bunker_door', tier: 'shielded' }, desc: 'One leaf of a lead-lined sliding blast door. Almost nothing gets through while shut.' },
};

export const RECIPES = [
  { out: { bunker_door_wood: 1 }, needs: { wood: 18, iron_ingot: 2 } },
  { out: { bunker_door_brick: 1 }, needs: { stone: 30, sand: 10, wood: 6, iron_ingot: 3 } },
  { out: { bunker_door_concrete: 1 }, needs: { stone: 36, gravel: 16, sand: 12, iron_ingot: 5, steel_ingot: 2 } },
  { out: { bunker_door_shielded: 1 }, needs: { stone: 36, gravel: 16, sand: 12, iron_ingot: 5, lead_plate: 3, lead_ingot: 2 } },
];

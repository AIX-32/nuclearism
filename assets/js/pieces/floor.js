// Floor panels: a 3 m x 3 m deck that closes a level of a base.
//
// The deck is exactly one grid cell thick. That is what makes the geometry
// line up: the walking surface is the TOP of the cell the deck occupies, so a
// wall standing on it (the runtime starts a wall on the top of the tallest
// piece in the column, which is that same cell top) and a floor laid on top of
// it both begin exactly where the player walks - no gap, no overlap.
//
// A deck rests on whatever is below it: the ground, or the top of a wall or of
// another floor. It lands in the cell directly above that support, so it never
// overlaps the piece it stands on and never floats.

const W = 3, D = 3, TH = 1;   // the deck fills one whole 1 m cell

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
  scale(x, y, z, rot) {
    return { x: W, y: TH, z: D };
  },
  // The deck lands on the highest thing under its 3 x 3 footprint: the top of
  // a wall or of another floor, or the ground. Aiming at a wall column there-
  // fore snaps the deck onto the top of that wall.
  base(sys, x, z) {
    let top = null;
    for (let i = 0; i < W; i++) {
      for (let k = 0; k < D; k++) {
        const piece = sys.topAt(x + i, z + k);
        const ground = sys.surfaceHeight(x + i, z + k);
        const h = piece === null ? ground : Math.max(piece, ground);
        if (top === null || h > top) top = h;
      }
    }
    return top;
  },
  // Something holds the deck up: a piece under it, or solid ground.
  support(sys, x, y, z) {
    for (let i = 0; i < W; i++) {
      for (let k = 0; k < D; k++) {
        if (sys.occupied(x + i, y - 1, z + k) || sys.groundAt(x + i, y - 1, z + k)) return true;
      }
    }
    return false;
  },
};

export const ITEMS = {
  floor_wood: { code: 'FW', name: 'WOOD FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'wood' }, table: true, desc: 'A timber deck. Closes a level and stops about 45% of the fallout coming down through it.' },
  floor_brick: { code: 'FB', name: 'BRICK FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'brick' }, desc: 'A fired clay slab. Stops about 75% of the radiation from above.' },
  floor_concrete: { code: 'FC', name: 'CONCRETE FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'concrete' }, desc: 'A poured slab. Stops about 94% of the radiation from above.' },
  floor_shielded: { code: 'FS', name: 'SHIELDED FLOOR', stack: 99, rad: 0, block: false, building: { kind: 'floor', tier: 'shielded' }, desc: 'A lead lined slab. Almost nothing gets through it.' },
};

export const RECIPES = [
  { out: { floor_wood: 1 }, needs: { wood: 30 } },
  { out: { floor_brick: 1 }, needs: { stone: 40, sand: 12, wood: 8 } },
  { out: { floor_concrete: 1 }, needs: { stone: 60, gravel: 24, sand: 16, iron_ingot: 4 } },
  { out: { floor_shielded: 1 }, needs: { stone: 60, gravel: 24, sand: 16, iron_ingot: 4, lead_plate: 3, lead_ingot: 2 } },
];

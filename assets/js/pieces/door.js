// Doors: a 1 m wide, 3 m tall, 0.25 m thick panel that fills a gap in a wall
// run. It is solid while closed and passable while open, and it shields
// radiation while closed (the runtime handles both).

const W = 1, H = 3, TH = 0.25;

function cells(x, y, z, rot) {
  const out = [];
  const half = TH / 2;
  for (let j = 0; j < H; j++) {
    if (rot === 0) {
      out.push([`${x},${y + j},${z}`, {
        minX: x, maxX: x + 1,
        minY: y + j, maxY: y + j + 1,
        minZ: z + 0.5 - half, maxZ: z + 0.5 + half,
      }]);
    } else {
      out.push([`${x},${y + j},${z}`, {
        minX: x + 0.5 - half, maxX: x + 0.5 + half,
        minY: y + j, maxY: y + j + 1,
        minZ: z, maxZ: z + 1,
      }]);
    }
  }
  return out;
}

export const KIND = {
  name: 'door',
  rot: 2,
  solid: true,
  attenuate: true,
  dynamicSolid: true,

  // Its own geometry key, so the doors get their own mesh: game.js animates
  // the swing by rewriting the instance matrices of that mesh alone.
  geom: 'door',
  geometry(THREE) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * H);
    uv.needsUpdate = true;
    return g;
  },

  cells,
  center(x, y, z) {
    return { x: x + 0.5, y: y + H / 2, z: z + 0.5 };
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

// The swing: the panel turns about one vertical edge. The runtime only draws
// one axis aligned box per piece, so game.js rotates that box around the
// hinge itself. `sign` is the rotation direction about Y.
export function swingFrame(x, y, z, rot) {
  const c = { x: x + 0.5, y: y + H / 2, z: z + 0.5 };
  const hinge = rot === 0
    ? { x: x, y: c.y, z: c.z }        // panel runs along x, hinge on its low x edge
    : { x: c.x, y: c.y, z: z };       // panel runs along z, hinge on its low z edge
  return { center: c, hinge, sign: rot === 0 ? -1 : 1 };
}

export const ITEMS = {
  door_wood: { code: 'DW', name: 'WOOD DOOR', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'wood' }, table: true, desc: 'A timber door. Right click it with an empty hand to swing it open.' },
  door_brick: { code: 'DB', name: 'BRICK DOOR', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'brick' }, desc: 'A heavy fired clay door. Right click it with an empty hand to swing it open.' },
  door_concrete: { code: 'DC', name: 'CONCRETE DOOR', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'concrete' }, desc: 'A poured door. Right click it with an empty hand to swing it open.' },
  door_shielded: { code: 'DS', name: 'SHIELDED DOOR', stack: 16, rad: 0, block: false, building: { kind: 'door', tier: 'shielded' }, desc: 'A lead lined door. Almost nothing gets through it while it is shut.' },
};

export const RECIPES = [
  { out: { door_wood: 1 }, needs: { wood: 14 } },
  { out: { door_brick: 1 }, needs: { stone: 24, sand: 8, wood: 4 } },
  { out: { door_concrete: 1 }, needs: { stone: 30, gravel: 12, sand: 10, iron_ingot: 2 } },
  { out: { door_shielded: 1 }, needs: { stone: 30, gravel: 12, sand: 10, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

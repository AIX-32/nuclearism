// Roof panels: a 3 x 3 m cap that closes the top of a level of a base.
//
// A roof lands in the cell that is directly above whatever it is aimed at: a
// wall standing on the cells y..y+2 has its top surface at y + 3, so a roof
// aimed at that wall occupies the cell y + 3 and rests flush on the wall's top.
// The panel is a solid barn roof - flat soffit, eaves, and a flat ridge strip
// along the middle - so it reads as a roof and not as a floor. Its whole metre
// of material is what shields the fallout coming down from above, and the
// ridge strip is the flat bit the player walks on.

const W = 3, D = 3, TH = 1;
const EAVE = 0.35;   // how high the eaves sit, as a fraction of the panel height
const RIDGE = 0.3;   // the width of the flat ridge strip, as a fraction of the panel

// Unit barn roof: a cross section in (z, y), extruded along x. The runtime
// hands its THREE namespace in, so this module stays importable in node.
function gable(THREE) {
  const P = [
    [0, 0], [1, 0], [1, EAVE],
    [0.5 + RIDGE / 2, 1], [0.5 - RIDGE / 2, 1], [0, EAVE],
  ];
  const pos = [];
  const uv = [];

  const face = (pts) => {
    // Flat normal of the polygon, used to pick the uv projection.
    const ax = pts[1][0] - pts[0][0], ay = pts[1][1] - pts[0][1], az = pts[1][2] - pts[0][2];
    const bx = pts[2][0] - pts[0][0], by = pts[2][1] - pts[0][1], bz = pts[2][2] - pts[0][2];
    const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
    const proj = (p) => {
      let u, v;
      if (nx >= ny && nx >= nz) { u = p[2]; v = p[1]; }
      else if (ny >= nz) { u = p[0]; v = p[2]; }
      else { u = p[0]; v = p[1]; }
      return [u * 3, v * 3]; // tile like the runtime's box geometry
    };
    for (let i = 1; i + 1 < pts.length; i++) {
      for (const p of [pts[0], pts[i], pts[i + 1]]) {
        pos.push(p[0], p[1], p[2]);
        const [u, v] = proj(p);
        uv.push(u, v);
      }
    }
  };

  // Sides: one quad per profile edge, from x = 0 to x = 1.
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    face([[0, a[1], a[0]], [1, a[1], a[0]], [1, b[1], b[0]], [0, b[1], b[0]]]);
  }
  // End caps.
  face(P.map(([z, y]) => [0, y, z]));
  face(P.slice().reverse().map(([z, y]) => [1, y, z]));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Something holds this cell up: a piece below it, solid ground, or terrain
// that reaches the level of the roof.
function held(sys, x, y, z) {
  return sys.occupied(x, y - 1, z) || sys.groundAt(x, y - 1, z) || sys.surfaceHeight(x, z) >= y - 1;
}

export const KIND = {
  name: 'roof',
  rot: 2,
  solid: true,
  attenuate: true,
  geom: 'roof_gable',
  geometry(THREE) { return gable(THREE); },
  // rot 0 lays the ridge along X, rot 1 along Z.
  rotY(rot) { return rot % 2 ? Math.PI / 2 : 0; },

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
  scale() {
    return { x: W, y: TH, z: D };
  },
  // The roof drops onto the top of whatever stands under it. It looks at the
  // whole 3 x 3 footprint, not just its own column: a roof that hangs over a
  // wall has to rest on that wall, which stands at the edge of its footprint.
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
    return top === null ? 0 : top;
  },
  // A panel may overhang the base it caps, but it must never float: one whole
  // row or column of the panel has to rest on the wall or floor below it.
  support(sys, x, y, z) {
    for (let k = 0; k < D; k++) {
      let row = true, col = true;
      for (let i = 0; i < W; i++) {
        if (!held(sys, x + i, y, z + k)) row = false;
        if (!held(sys, x + k, y, z + i)) col = false;
      }
      if (row || col) return true;
    }
    return false;
  },
};

export const ITEMS = {
  roof_wood: { code: 'RW', name: 'WOOD ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'wood' }, table: true, desc: 'A timber cap. Keeps the sky out, stops less than half of the fallout.' },
  roof_brick: { code: 'RB', name: 'BRICK ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'brick' }, desc: 'A fired clay cap. Stops three quarters of the fallout.' },
  roof_concrete: { code: 'RC', name: 'CONCRETE ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'concrete' }, desc: 'A poured cap. Almost nothing gets through it.' },
  roof_shielded: { code: 'RS', name: 'SHIELDED ROOF', stack: 99, rad: 0, block: false, building: { kind: 'roof', tier: 'shielded' }, desc: 'A lead lined cap. Nothing gets through it - this is what keeps the fallout out of the base.' },
};

export const RECIPES = [
  { out: { roof_wood: 1 }, needs: { wood: 10 } },
  { out: { roof_brick: 1 }, needs: { stone: 20, sand: 6, wood: 4 } },
  { out: { roof_concrete: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2 } },
  { out: { roof_shielded: 1 }, needs: { stone: 25, gravel: 10, sand: 8, iron_ingot: 2, lead_plate: 2, lead_ingot: 1 } },
];

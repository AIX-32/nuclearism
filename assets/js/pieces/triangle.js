// Triangle panels: half of a 3 x 3 m square, so a base can be shaped into
// corners, wedges and honeycomb cells instead of only squares.
//
// Stub geometry: a right triangle prism, the right angle at one corner of a
// 3 x 3 m square, 0.25 m thick. `rot` turns the diagonal through four
// directions.

const W = 3, TH = 0.25;

// Unit prism: a right triangle in XZ (0,0) (1,0) (0,1), extruded in Y.
// THREE is handed in by the runtime so this module stays importable in node.
function prism(THREE) {
  const v = [
    // bottom (y = 0)
    0, 0, 0, 1, 0, 0, 0, 0, 1,
    // top (y = 1)
    0, 1, 0, 1, 1, 0, 0, 1, 1,
  ];
  const idx = [
    0, 2, 1,          // bottom
    3, 4, 5,          // top
    0, 1, 4, 0, 4, 3, // z = 0 edge
    0, 3, 5, 0, 5, 2, // x = 0 edge
    1, 2, 5, 1, 5, 4, // hypotenuse
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const KIND = {
  name: 'triangle',
  rot: 4,
  solid: true,
  attenuate: true,
  geom: 'triangle',
  geometry(THREE) { return prism(THREE); },

  cells(x, y, z, rot) {
    const out = [];
    for (let i = 0; i < W; i++) {
      for (let k = 0; k < W; k++) {
        out.push([`${x + i},${y},${z + k}`, {
          minX: x + i, maxX: x + i + 1,
          minY: y, maxY: y + TH,
          minZ: z + k, maxZ: z + k + 1,
        }]);
      }
    }
    return out;
  },
  center(x, y, z, rot) {
    // The prism's right angle sits at the corner that the rotation points to.
    const c = [
      { x: x + W / 2, z: z + W / 2 },      // rot 0: right angle at (x, z)
      { x: x + W / 2, z: z + W / 2 },      // rot 1
      { x: x + W / 2, z: z + W / 2 },      // rot 2
      { x: x + W / 2, z: z + W / 2 },      // rot 3
    ][rot % 4];
    return { x: c.x, y: y + TH / 2, z: c.z };
  },
  scale(x, y, z) {
    return { x: W, y: TH, z: W };
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
  triangle_wood: { code: 'TW', name: 'WOOD WEDGE', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'wood' }, table: true, desc: 'A triangular timber panel. Fills the corners of a base.' },
  triangle_brick: { code: 'TB', name: 'BRICK WEDGE', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'brick' }, desc: 'A fired clay wedge.' },
  triangle_concrete: { code: 'TC', name: 'CONCRETE WEDGE', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'concrete' }, desc: 'A poured wedge.' },
  triangle_shielded: { code: 'TS', name: 'SHIELDED WEDGE', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'shielded' }, desc: 'A lead lined wedge.' },
};

export const RECIPES = [
  { out: { triangle_wood: 1 }, needs: { wood: 6 } },
  { out: { triangle_brick: 1 }, needs: { stone: 12, sand: 4, wood: 2 } },
  { out: { triangle_concrete: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1 } },
  { out: { triangle_shielded: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1, lead_plate: 1, lead_ingot: 1 } },
];

// Triangle wedges: half of a 3 x 3 m square, so a base can be shaped into
// corners, wedges and honeycomb cells instead of only squares.
//
// A wedge is a right triangle prism: the right angle sits in one corner of the
// square, the legs run along the two edges that meet there, and the
// hypotenuse runs corner to corner across the square. `rot` turns the whole
// square by 90 degrees, so the diagonal can point any way.
//
// The mesh is a real prism (see `geometry`), built in a local frame whose
// right angle is at the (0,0) corner, and turned by `rotY`. The cell boxes
// are derived from the same local frame, so the solid cells always line up
// with the mesh.

const W = 3, D = 3, TH = 0.25;

// --- the local frame ------------------------------------------------------
//
// In local coordinates the square runs from (0,0) to (3,3), the right angle
// is at (0,0) and the wedge covers u + v <= 3. Local cell (i,k) is:
//   i + k <= 1  fully inside the wedge
//   i + k == 2  cut in half by the diagonal (the hypotenuse runs through it)
//   i + k >= 3  outside the wedge
//
// One 90 degree turn about the centre of the square maps a point (u,v) to
// (v, W - u), which is the same rotation three.js applies for a positive
// rotation about Y. So the local frame turned `rot` times is exactly what
// `rotY(rot)` does to the mesh.
function turn(u, v) { return [v, W - u]; }

// Where local cell (i,k) ends up after `rot` turns.
const CELL_OF = [
  (i, k) => [i, k],
  (i, k) => [k, 2 - i],
  (i, k) => [2 - i, 2 - k],
  (i, k) => [2 - k, i],
];

// The solid part of a local cell, as [x0, x1, z0, z1].
// A cut cell is approximated by a half cell rectangle: the diagonal runs
// through the cell from corner to corner, so no axis aligned box can follow
// it exactly. The rectangle keeps the whole solid half of the cell covered
// (the player cannot walk into the wedge) at the price of also covering a
// quarter of the open half of that cell. Three cells of the wedge are cut
// this way, so the error is a thin staircase along the diagonal.
function localBox(i, k) {
  if (i + k <= 1) return [i, i + 1, k, k + 1];       // fully solid
  if (i + k === 2) return [i, i + 1, k, k + 0.5];   // half solid
  return [i, i, k, k];                              // empty: a bare point
}

// Turn a local box into its world box.
function turnBox(box, rot) {
  let [x0, x1, z0, z1] = box;
  for (let r = 0; r < rot; r++) {
    const p = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([u, v]) => turn(u, v));
    x0 = Math.min(...p.map((q) => q[0])); x1 = Math.max(...p.map((q) => q[0]));
    z0 = Math.min(...p.map((q) => q[1])); z1 = Math.max(...p.map((q) => q[1]));
  }
  return [x0, x1, z0, z1];
}

function cells(x, y, z, rot) {
  const r = rot % 4;
  const out = [];
  for (let i = 0; i < W; i++) {
    for (let k = 0; k < D; k++) {
      const [wi, wk] = CELL_OF[r](i, k);
      const [bx0, bx1, bz0, bz1] = turnBox(localBox(i, k), r);
      out.push([`${x + wi},${y},${z + wk}`, {
        minX: x + bx0, maxX: x + bx1,
        minY: y, maxY: y + TH,
        minZ: z + bz0, maxZ: z + bz1,
      }]);
    }
  }
  return out;
}

// The prism: a unit right triangle (right angle at (-0.5,-0.5) in XZ) with a
// unit height, so scaling it by (W, TH, D) gives the wedge. THREE is handed
// in by the runtime so this module stays importable in node.
function prism(THREE) {
  const A = [-0.5, -0.5], B = [0.5, -0.5], C = [-0.5, 0.5];
  const LO = -0.5, HI = 0.5;
  const pos = [], nrm = [], uv = [];
  const tri = (p, q, r, n, up, uq, ur) => {
    for (const [v, t] of [[p, up], [q, uq], [r, ur]]) {
      pos.push(v[0], v[1], v[2]);
      nrm.push(n[0], n[1], n[2]);
      uv.push(t[0], t[1]);
    }
  };
  const V = (p, y) => [p[0], y, p[1]];
  const s = 3;                       // texture repeats, like the runtime box
  const hyp = Math.SQRT1_2;         // outward normal of the hypotenuse
  // top and bottom
  tri(V(A, HI), V(C, HI), V(B, HI), [0, 1, 0],
    [0, 0], [0, s], [s, 0]);
  tri(V(A, LO), V(B, LO), V(C, LO), [0, -1, 0],
    [0, 0], [s, 0], [0, s]);
  // leg along z = -0.5
  tri(V(A, LO), V(B, HI), V(B, LO), [0, 0, -1],
    [0, 0], [s, s], [s, 0]);
  tri(V(A, LO), V(A, HI), V(B, HI), [0, 0, -1],
    [0, 0], [0, s], [s, s]);
  // leg along x = -0.5
  tri(V(A, LO), V(C, LO), V(C, HI), [-1, 0, 0],
    [0, 0], [s, 0], [s, s]);
  tri(V(A, LO), V(C, HI), V(A, HI), [-1, 0, 0],
    [0, 0], [s, s], [0, s]);
  // hypotenuse from B to C
  tri(V(B, LO), V(C, HI), V(C, LO), [hyp, 0, hyp],
    [0, 0], [s, s], [s, 0]);
  tri(V(B, LO), V(B, HI), V(C, HI), [hyp, 0, hyp],
    [0, 0], [0, s], [s, s]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export const KIND = {
  name: 'triangle',
  rot: 4,
  solid: true,
  attenuate: true,
  geom: 'triangle',
  geometry(THREE) { return prism(THREE); },
  // The mesh is turned about the middle of the square, so the right angle
  // walks through the four corners of the square as rot goes 0..3.
  rotY(rot) { return (rot % 4) * Math.PI / 2; },

  cells,
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
  triangle_wood: { code: 'TW', name: 'WOOD WEDGE', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'wood' }, table: true, desc: 'A triangular timber deck. Fills the corners of a base.' },
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














import { anySupport, baseAt } from './placement.js';

const W = 3, D = 3, TH = 0.25;













function turn(u, v) { return [v, W - u]; }


const CELL_OF = [
  (i, k) => [i, k],
  (i, k) => [k, 2 - i],
  (i, k) => [2 - i, 2 - k],
  (i, k) => [2 - k, i],
];




function localBox(i, k) {
  if (i + k <= 1) return [i, i + 1, k, k + 1];
  if (i + k === 2) return i === 0
    ? [i, i + 0.5, k, k + 1]
    : [i, i + 1, k, k + 0.5];
  return null;
}


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
      const local = localBox(i, k);
      if (!local) continue;
      const [wi, wk] = CELL_OF[r](i, k);
      const [bx0, bx1, bz0, bz1] = turnBox(local, r);
      out.push([`${x + wi},${y},${z + wk}`, {
        minX: x + bx0, maxX: x + bx1,

        minY: y + 1 - TH, maxY: y + 1,
        minZ: z + bz0, maxZ: z + bz1,
      }]);
    }
  }
  return out;
}




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
  const s = 3;
  const hyp = Math.SQRT1_2;

  tri(V(A, HI), V(C, HI), V(B, HI), [0, 1, 0],
    [0, 0], [0, s], [s, 0]);
  tri(V(A, LO), V(B, LO), V(C, LO), [0, -1, 0],
    [0, 0], [s, 0], [0, s]);

  tri(V(A, LO), V(B, HI), V(B, LO), [0, 0, -1],
    [0, 0], [s, s], [s, 0]);
  tri(V(A, LO), V(A, HI), V(B, HI), [0, 0, -1],
    [0, 0], [0, s], [s, s]);

  tri(V(A, LO), V(C, LO), V(C, HI), [-1, 0, 0],
    [0, 0], [s, 0], [s, s]);
  tri(V(A, LO), V(C, HI), V(A, HI), [-1, 0, 0],
    [0, 0], [s, s], [0, s]);

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


  rotY(rot) { return (rot % 4) * Math.PI / 2; },

  cells,
  center(x, y, z) {
    return { x: x + W / 2, y: y + 1 - TH / 2, z: z + D / 2 };
  },
  scale(x, y, z) {
    return { x: W, y: TH, z: D };
  },
  base(sys, x, z, rot) {
    return baseAt(sys, cells(x, 0, z, rot));
  },
  support(sys, x, y, z, rot) {
    return anySupport(sys, cells(x, y, z, rot), y);
  },
};

export const ITEMS = {
  triangle_wood: { code: 'TW', name: 'WOOD WEDGE BB', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'wood' }, table: true, desc: 'A triangular timber deck. Fills the corners of a base.' },
  triangle_brick: { code: 'TB', name: 'BRICK WEDGE BB', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'brick' }, desc: 'A fired clay wedge.' },
  triangle_concrete: { code: 'TC', name: 'CONCRETE WEDGE BB', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'concrete' }, desc: 'A poured wedge.' },
  triangle_shielded: { code: 'TS', name: 'SHIELDED CONCRETE WEDGE BB', stack: 99, rad: 0, block: false, building: { kind: 'triangle', tier: 'shielded' }, desc: 'A lead lined wedge.' },
};

export const RECIPES = [
  { out: { triangle_wood: 1 }, needs: { wood: 6 } },
  { out: { triangle_brick: 1 }, needs: { stone: 12, sand: 4, wood: 2 } },
  { out: { triangle_concrete: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1 } },
  { out: { triangle_shielded: 1 }, needs: { stone: 15, gravel: 6, sand: 5, iron_ingot: 1, lead_plate: 1, lead_ingot: 1 } },
];

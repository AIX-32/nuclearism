// Self-checks for the triangle wedge: node assets/js/pieces/triangle.check.mjs
//
// The wedge is half of a 3 x 3 m square. These checks prove that the mesh
// really is a right triangle prism, that its right angle walks through the
// four corners of the square as it rotates, and that the cell boxes line up
// with the mesh they claim to describe.

import { KIND as TRI, ITEMS as TRI_ITEMS, RECIPES as TRI_RECIPES } from './triangle.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const W = 3, D = 3, TH = 0.25;
const X0 = 4, Y0 = 10, Z0 = 7;   // an arbitrary anchor for the piece

// --- the kind ----------------------------------------------------------------
check(TRI.name === 'triangle', 'the kind is called triangle');
check(TRI.rot === 4, 'the wedge has four rotations');
check(TRI.solid === true, 'the wedge is solid');
check(TRI.attenuate === true, 'the wedge attenuates radiation');
check(TRI.geom === 'triangle', 'the wedge uses the custom triangle geometry');
check(typeof TRI.geometry === 'function', 'the wedge builds its own geometry');
check(typeof TRI.rotY === 'function', 'the wedge rotates with rotY');

// --- the cells ---------------------------------------------------------------
for (let rot = 0; rot < 4; rot++) {
  const cells = TRI.cells(X0, Y0, Z0, rot);
  check(cells.length === 9, `rot ${rot} claims 9 cells`);
  check(new Set(cells.map(([k]) => k)).size === 9, `rot ${rot} claims 9 distinct cells`);
  check(cells.every(([k]) => k.split(',').length === 3), `rot ${rot} cell keys are x,y,z`);
  check(cells.every(([, b]) => b.minY >= Y0 && b.maxY <= Y0 + 1), `rot ${rot} cell boxes stay in their layer`);
  check(cells.every(([, b]) => b.maxY - b.minY === TH), `rot ${rot} cell boxes are one slab thick`);
  // Every box has to sit inside the cell it names.
  const inside = cells.every(([k, b]) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    return b.minX >= cx && b.maxX <= cx + 1 && b.minZ >= cz && b.maxZ <= cz + 1
      && b.minY >= cy && b.maxY <= cy + 1;
  });
  check(inside, `rot ${rot} cell boxes are inside their cells`);
}

// The four rotations must not all look the same.
const layouts = [0, 1, 2, 3].map((r) => TRI.cells(X0, Y0, Z0, r).map(([k, b]) =>
  `${k}:${b.minX},${b.maxX},${b.minZ},${b.maxZ}`).sort().join('|'));
check(new Set(layouts).size === 4, 'the four rotations give four different cell layouts');
check(layouts[0] !== layouts[1], 'rot 0 and rot 1 differ (the diagonal really moves)');
check(layouts[1] !== layouts[2], 'rot 1 and rot 2 differ');
check(layouts[2] !== layouts[3], 'rot 2 and rot 3 differ');

// --- the mesh ----------------------------------------------------------------
// A tiny three.js stand in: the runtime hands its own THREE to the kind.
const THREE = {
  BufferGeometry: class {
    constructor() { this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    setIndex(i) { this.index = i; return this; }
    computeVertexNormals() {}
  },
  Float32BufferAttribute: class {
    constructor(array, itemSize) { this.array = Array.from(array); this.itemSize = itemSize; }
  },
};

const geom = TRI.geometry(THREE);
const pos = geom.attributes.position.array;
const nrm = geom.attributes.normal.array;
check(pos.length % 9 === 0 && pos.length > 0, 'the geometry is made of triangles');
check(geom.attributes.uv && geom.attributes.uv.array.length / 2 === pos.length / 3,
  'every vertex has a texture coordinate');

// The prism is a unit right triangle in XZ, right angle at (-0.5,-0.5).
const corners = new Set();
for (let i = 0; i < pos.length; i += 3) corners.add(`${pos[i].toFixed(3)},${pos[i + 2].toFixed(3)}`);
check(corners.size === 3, 'the prism has three corners in XZ');
check(corners.has('-0.500,0.500') && corners.has('0.500,-0.500') && corners.has('-0.500,-0.500'),
  'the prism corners are the right angle and the two ends of the hypotenuse');
const half = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
check(Math.abs(half([-0.5, -0.5], [0.5, -0.5]) - 1) < 1e-9, 'the first leg is one unit');
check(Math.abs(half([-0.5, -0.5], [-0.5, 0.5]) - 1) < 1e-9, 'the second leg is one unit');
check(Math.abs(half([0.5, -0.5], [-0.5, 0.5]) - Math.SQRT2) < 1e-9, 'the hypotenuse is the diagonal');

// The normals must point out of the prism.
const mid = [0, 0, 0];
for (let i = 0; i < pos.length; i += 3) { mid[0] += pos[i]; mid[1] += pos[i + 1]; mid[2] += pos[i + 2]; }
for (let i = 0; i < mid.length; i++) mid[i] /= pos.length / 3;
let outward = true;
for (let t = 0; t < pos.length; t += 9) {
  const a = [pos[t], pos[t + 1], pos[t + 2]];
  const b = [pos[t + 3], pos[t + 4], pos[t + 5]];
  const c = [pos[t + 6], pos[t + 7], pos[t + 8]];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  const face = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  const dot = (n[0] * (face[0] - mid[0]) + n[1] * (face[1] - mid[1]) + n[2] * (face[2] - mid[2])) / len;
  if (dot <= 0) outward = false;
  for (let k = 0; k < 3; k++) {
    const nl = Math.hypot(nrm[t + k], nrm[t + k + 1], nrm[t + k + 2]);
    if (Math.abs(nl - 1) > 1e-6) outward = false;
  }
}
check(outward, 'every face of the prism faces outwards');

// --- the mesh in world space ------------------------------------------------
// The mesh is scaled by (W, TH, D), turned by rotY(rot) and moved to center().
function worldCorners(rot) {
  const c = TRI.center(X0, Y0, Z0, rot);
  const s = TRI.scale(X0, Y0, Z0, rot);
  const th = TRI.rotY(rot);
  const cos = Math.cos(th), sin = Math.sin(th);
  const local = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]];
  return local.map(([u, v]) => {
    const x = u * s.x, z = v * s.z;
    return { x: c.x + x * cos + z * sin, z: c.z - x * sin + z * cos };
  });
}

// The right angle of the wedge: where does it point for each rotation?
const RIGHT_ANGLE = [
  [X0, Z0], [X0, Z0 + 3], [X0 + 3, Z0 + 3], [X0 + 3, Z0],
];
for (let rot = 0; rot < 4; rot++) {
  const c = worldCorners(rot);
  const ra = c[0];   // the right angle of the unit prism
  const [ex, ez] = RIGHT_ANGLE[rot];
  check(Math.abs(ra.x - ex) < 1e-9 && Math.abs(ra.z - ez) < 1e-9,
    `rot ${rot} puts the right angle at (${ex}, ${ez})`);
  // The hypotenuse runs corner to corner of the square.
  const h = Math.hypot(c[1].x - c[2].x, c[1].z - c[2].z);
  check(Math.abs(h - 3 * Math.SQRT2) < 1e-9, `rot ${rot} has a corner to corner hypotenuse`);
  // The three corners are three corners of the 3 x 3 square.
  const cornersOfSquare = [[X0, Z0], [X0 + 3, Z0], [X0, Z0 + 3], [X0 + 3, Z0 + 3]];
  check(c.every((p) => cornersOfSquare.some(([qx, qz]) =>
    Math.abs(p.x - qx) < 1e-9 && Math.abs(p.z - qz) < 1e-9)),
    `rot ${rot} sits on the corners of its square`);
}

// --- the cells against the mesh ----------------------------------------------
// Sample the square and compare the wedge (from the mesh) with the cell boxes.
function pointInTriangle(p, tri) {
  const sign = (a, b) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
  const s1 = sign(tri[0], tri[1]), s2 = sign(tri[1], tri[2]), s3 = sign(tri[2], tri[0]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}
function covered(p, boxes) {
  return boxes.some(([, b]) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ);
}

for (let rot = 0; rot < 4; rot++) {
  const tri = worldCorners(rot);
  const boxes = TRI.cells(X0, Y0, Z0, rot);
  const step = 0.02;
  let inWedge = 0, inWedgeCovered = 0, outside = 0, outsideCovered = 0;
  for (let u = X0 + step / 2; u < X0 + 3; u += step) {
    for (let v = Z0 + step / 2; v < Z0 + 3; v += step) {
      const p = { x: u, z: v };
      const inside = pointInTriangle(p, tri);
      const cov = covered(p, boxes);
      if (inside) { inWedge++; if (cov) inWedgeCovered++; }
      else { outside++; if (cov) outsideCovered++; }
    }
  }
  check(inWedgeCovered / inWedge > 0.85,
    `rot ${rot} covers most of the wedge with solid cells (${(100 * inWedgeCovered / inWedge).toFixed(0)}%)`);
  check(outsideCovered / outside < 0.12,
    `rot ${rot} does not block much of the open half (${(100 * outsideCovered / outside).toFixed(0)}%)`);
}

// The player must be able to stand in the open half of a cut cell and must
// be stopped by the solid half of the same cell.
for (let rot = 0; rot < 4; rot++) {
  const tri = worldCorners(rot);
  const boxes = TRI.cells(X0, Y0, Z0, rot);
  let openFree = true, solidBlocked = true;
  for (const [key, b] of boxes) {
    const [cx, , cz] = key.split(',').map(Number);
    // The corners of the cell.
    const pts = [[cx, cz], [cx + 1, cz], [cx, cz + 1], [cx + 1, cz + 1]];
    // The hypotenuse runs from the second to the third corner of the prism,
    // so the sign against that edge says which side of the diagonal a point
    // is on: positive is the solid side of the wedge.
    const side = ([px, pz]) => {
      const a = tri[1], c = tri[2];
      const s = (c.x - a.x) * (pz - a.z) - (c.z - a.z) * (px - a.x);
      return s > 0 ? 1 : s < 0 ? -1 : 0;
    };
    const inside = pts.filter((p) => side(p) === 1);
    const onEdge = pts.filter((p) => side(p) === 0);
    const outside = pts.filter((p) => side(p) === -1);
    if (outside.length === 0) {
      // A fully solid cell must block the player.
      if (!covered({ x: cx + 0.5, z: cz + 0.5 }, boxes)) solidBlocked = false;
      continue;
    }
    if (inside.length === 0) {
      // An empty cell must not block the player.
      if (covered({ x: cx + 0.5, z: cz + 0.5 }, boxes)) solidBlocked = false;
      continue;
    }
    // A cut cell: the middle of the solid half is blocked, the middle of the
    // open half is free.
    const mid = (list) => ({
      x: list.reduce((a, p) => a + p[0], 0) / list.length,
      z: list.reduce((a, p) => a + p[1], 0) / list.length,
    });
    const solidMid = mid([inside[0], ...onEdge]);
    const openMid = mid([outside[0], ...onEdge]);
    if (!covered(solidMid, boxes)) solidBlocked = false;
    if (covered(openMid, boxes)) openFree = false;
  }
  check(solidBlocked, `rot ${rot} blocks the solid half of every cell it covers`);
  check(openFree, `rot ${rot} leaves the open half of the cut cells walkable`);
}

// --- the items ---------------------------------------------------------------
for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const id = `triangle_${tier}`;
  check(!!TRI_ITEMS[id], `item "${id}" exists`);
  check(TRI_ITEMS[id]?.building?.kind === 'triangle', `item "${id}" builds a triangle`);
  check(TRI_ITEMS[id]?.building?.tier === tier, `item "${id}" is a ${tier} piece`);
  check(TRI_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
}
check(TRI_ITEMS.triangle_wood?.table === true, 'the wood wedge is craftable at the pocket table');
check(Object.keys(TRI_ITEMS).length === 4, 'there are four wedge items');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`triangle check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`triangle OK — ${ok.length} assertions`);

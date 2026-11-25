import assert from 'node:assert/strict';
import { KIND as STAIR, ITEMS, RECIPES } from './stair.js';

const X0 = 4, Y0 = 10, Z0 = 7;

assert.equal(STAIR.name, 'stair');
assert.equal(STAIR.rot, 4, 'four climb directions');
assert.equal(STAIR.solid, true, 'a stair blocks the body');
assert.equal(STAIR.attenuate, true, 'a stair shields radiation');
assert.equal(STAIR.geom, 'stair', 'custom stepped mesh');
assert.equal(typeof STAIR.geometry, 'function');
assert.equal(STAIR.rotY(1), Math.PI / 2, 'mesh rotates a quarter turn per rot');

for (let rot = 0; rot < 4; rot++) {
  const boxes = STAIR.cells(X0, Y0, Z0, rot);
  assert.equal(boxes.length, 45, `rot ${rot} has ten steps across three cells`);
  assert.ok(boxes.every(([k]) => k.split(',').length === 3), `rot ${rot} keys are x,y,z`);
  assert.ok(boxes.every(([k, b]) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    return b.minX >= cx && b.maxX <= cx + 1 && b.minY >= cy && b.maxY <= cy + 1
      && b.minZ >= cz && b.maxZ <= cz + 1;
  }), `rot ${rot} every box stays inside its cell`);
  assert.ok(boxes.every(([, b]) => b.minX >= X0 && b.maxX <= X0 + 3
    && b.minZ >= Z0 && b.maxZ <= Z0 + 3), `rot ${rot} stays in the 3x3 footprint`);
  assert.ok(boxes.every(([, b]) => b.maxY - b.minY <= 1 + 1e-9), `rot ${rot} boxes never exceed one level`);

  // The highest tread reaches the next cell exactly, so a floor can rest on it.
  assert.equal(Math.max(...boxes.map(([, b]) => b.maxY)), Y0 + 2, `rot ${rot} top lands on the next cell`);

  // Every riser is 0.2 m: small enough to step up (0.6 m cap) and to follow
  // down at the 12 m/s ground-follow rate at 60 fps.
  const tops = [...new Set(boxes.map(([, b]) => Math.round(b.maxY * 100) / 100))].sort((a, b) => a - b);
  for (let i = 1; i < tops.length; i++) {
    assert.ok(Math.abs(tops[i] - tops[i - 1] - 0.2) < 1e-9, `rot ${rot} treads are 0.2 m apart`);
  }
}

const layouts = [0, 1, 2, 3].map((r) => STAIR.cells(X0, Y0, Z0, r).map(([k, b]) =>
  `${k}:${b.minX},${b.maxX},${b.minZ},${b.maxZ}`).sort().join('|'));
assert.equal(new Set(layouts).size, 4, 'the four rotations give four distinct layouts');
assert.deepEqual(STAIR.cells(X0, Y0, Z0, 4), STAIR.cells(X0, Y0, Z0, 0), 'rot wraps at four');

const THREE = {
  BufferGeometry: class {
    constructor() { this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  },
  Float32BufferAttribute: class {
    constructor(array, itemSize) { this.array = Array.from(array); this.itemSize = itemSize; }
  },
};
const geom = STAIR.geometry(THREE);
const pos = geom.attributes.position.array;
const nrm = geom.attributes.normal.array;
const uv = geom.attributes.uv.array;
assert.ok(pos.length > 0 && pos.length % 9 === 0, 'the mesh is made of triangles');
assert.equal(uv.length / 2, pos.length / 3, 'every vertex has a UV');
assert.equal(nrm.length, pos.length, 'every vertex has a normal');
assert.ok(nrm.every((v) => Number.isFinite(v)), 'normals are finite');
for (let i = 0; i < pos.length; i += 3) {
  assert.ok(pos[i] >= -0.5 - 1e-9 && pos[i] <= 0.5 + 1e-9, 'mesh x matches the 3 m width');
  assert.ok(pos[i + 1] >= -1e-9 && pos[i + 1] <= 1 + 1e-9, 'mesh y is normalised to the 2 m rise');
  assert.ok(pos[i + 2] >= -0.5 - 1e-9 && pos[i + 2] <= 0.5 + 1e-9, 'mesh z matches the 3 m run');
}
const center = STAIR.center(X0, Y0, Z0, 0), scale = STAIR.scale(X0, Y0, Z0, 0);
assert.equal(center.y, Y0, 'the mesh pivot sits at the piece base');
assert.deepEqual(scale, { x: 3, y: 2, z: 3 }, 'scaling the mesh fills the footprint and the rise');

// base/support use the shared helpers with the real cell list.
const sys = {
  surfaceHeight: () => 6,
  topAt: () => null,
  groundAt: (x, y, z) => y === 9,
  cells: new Map(),
};
assert.equal(STAIR.base(sys, X0, Z0, 0), 6, 'base uses the terrain under the footprint');
assert.equal(STAIR.support(sys, X0, Y0, Z0, 0), true, 'ground under the bottom row supports the stair');
assert.equal(STAIR.support(sys, X0, Y0 + 5, Z0, 0), false, 'a floating stair is refused');

// Content: four tiers, wood on the pocket table, all recipes spend known items.
assert.equal(Object.keys(ITEMS).length, 4, 'one item per tier');
assert.ok(Object.values(ITEMS).every((it) => it.building?.kind === 'stair'));
assert.equal(ITEMS.stair_wood.table, true, 'the wood stair is a bootstrap craft');
assert.equal(RECIPES.length, 4);
assert.ok(RECIPES.every((r) => Object.keys(r.out).length === 1 && Object.keys(r.needs).length > 0));

// Real runtime: place it, block the body, refuse overlap, survive a save/load.
const { BuildingSystem } = await import('../building.js');
const { stubThree, flatWorld } = await import('../three-stub.mjs');
const makeWorld = () => ({ THREE: stubThree(), scene: { add() {} }, world: flatWorld() });
const B = new BuildingSystem(makeWorld());
const piece = B.place('stair', 'wood', X0, 0, Z0, 0);
assert.ok(piece, 'the stair can be placed on flat ground');
assert.equal(B.pieceTop(piece), 2, 'the runtime reports a two metre climb');
assert.equal(B.canPlace('stair', 'wood', X0, 0, Z0, 0), false, 'a second stair cannot overlap the first');
assert.equal(B.collidesBody(X0 + 1.5, 0.1, Z0 + 0.1, 0.35, 1.72), true, 'the lower tread blocks the body');
assert.equal(B.collidesBody(X0 + 1.5, 2.2, Z0 + 0.1, 0.35, 1.72), false, 'the space above the stair is clear');
const B2 = new BuildingSystem(makeWorld());
B2.restore(B.serialize());
assert.equal(B2.pieces.size, 1, 'the stair survives serialize/restore');

console.log('stair check passed: ten 0.2 m treads, four rotations, closed mesh, tiered items');

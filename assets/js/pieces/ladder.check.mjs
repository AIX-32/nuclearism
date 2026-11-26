import assert from 'node:assert/strict';
import { ITEM_DEFS, CRAFT_RECIPES } from '../content.js';
import { BuildingSystem } from '../building.js';
import { stubThree, flatWorld } from '../three-stub.mjs';
import { KIND, ITEMS, RECIPES } from './ladder.js';
import { KINDS } from './registry.js';

const X0 = 4, Y0 = 10, Z0 = 7;

assert.equal(KIND.name, 'ladder');
assert.equal(KIND.rot, 1, 'a ladder has one fixed facing');
assert.equal(KIND.solid, false, 'the player climbs through the ladder');
assert.equal(KIND.attenuate, true, 'the ladder rails shade the field a little');
assert.equal(KIND.geom, 'ladder', 'custom ladder mesh');

const boxes = KIND.cells(X0, Y0, Z0);
assert.equal(boxes.length, 3, 'the ladder spans three stacked cells');
assert.deepEqual(boxes.map(([k]) => k), [`${X0},${Y0},${Z0}`, `${X0},${Y0 + 1},${Z0}`, `${X0},${Y0 + 2},${Z0}`]);
assert.ok(boxes.every(([k, b]) => {
  const [cx, cy, cz] = k.split(',').map(Number);
  return b.minX >= cx && b.maxX <= cx + 1 && b.minY >= cy && b.maxY <= cy + 1
    && b.minZ >= cz && b.maxZ <= cz + 1;
}), 'every slice stays inside its cell');

const THREE = {
  BufferGeometry: class {
    constructor() { this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  },
  Float32BufferAttribute: class {
    constructor(array, itemSize) { this.array = Array.from(array); this.itemSize = itemSize; }
  },
};
const geom = KIND.geometry(THREE);
const pos = geom.attributes.position.array, nrm = geom.attributes.normal.array, uv = geom.attributes.uv.array;
assert.equal(pos.length / 3, 12 * 36, 'two rails and ten rungs');
assert.equal(nrm.length, pos.length, 'every vertex has a normal');
assert.equal(uv.length / 2, pos.length / 3, 'every vertex has a UV');
assert.ok(pos.every((v) => Number.isFinite(v)), 'mesh vertices are finite');
for (let i = 1; i < pos.length; i += 3) assert.ok(pos[i] >= -1e-9 && pos[i] <= 1 + 1e-9, 'mesh height is normalised to the 3 m rise');

const center = KIND.center(X0, Y0, Z0), scale = KIND.scale(X0, Y0, Z0);
assert.deepEqual(center, { x: X0 + 0.5, y: Y0, z: Z0 + 0.5 });
assert.deepEqual(scale, { x: 1, y: 3, z: 1 });

const sys = {
  surfaceHeight: () => 6,
  topAt: () => null,
  groundAt: (x, y, z) => y === Y0 - 1,
  cells: new Map(),
};
assert.equal(KIND.base(sys, X0, Z0), 6, 'base uses the ground under the ladder');
assert.equal(KIND.support(sys, X0, Y0, Z0), true, 'ground under the bottom rung supports it');
assert.equal(KIND.support(sys, X0, Y0 + 5, Z0), false, 'a floating ladder is refused');

assert.equal(Object.keys(ITEMS).length, 4, 'one item per tier');
assert.ok(Object.values(ITEMS).every((it) => it.building?.kind === 'ladder'));
assert.equal(ITEMS.ladder_wood.table, true, 'the wood ladder is a bootstrap craft');
assert.equal(RECIPES.length, 4);
for (const id of Object.keys(ITEMS)) {
  assert.ok(ITEM_DEFS[id], `item "${id}" is in the catalogue`);
  assert.ok(CRAFT_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
}

const makeWorld = () => ({ THREE: stubThree(), scene: { add() { } }, world: flatWorld() });
const B = new BuildingSystem(makeWorld());
const piece = B.place('ladder', 'wood', X0, 0, Z0, 0);
assert.ok(piece, 'the ladder can be placed on flat ground');
assert.equal(B.pieceTop(piece), 3, 'the runtime reports a three metre climb');
assert.equal(B.collidesBody(X0 + 0.5, 1, Z0 + 0.5, 0.35, 1.72), false, 'the body can stand inside the ladder');
assert.equal(B.canPlace('ladder', 'wood', X0, 0, Z0, 0), false, 'a second ladder cannot overlap the first');
assert.ok(B.shadow(X0 + 0.5, 1.5, Z0 + 8, 0, 0, -1, 16) < 1, 'the rails shade the field');
const B2 = new BuildingSystem(makeWorld());
B2.restore(B.serialize());
assert.equal(B2.pieces.size, 1, 'the ladder survives serialize/restore');

assert.equal(Object.keys(KINDS).indexOf('ladder'), 7, 'ladders keep their save index');
const B3 = new BuildingSystem(makeWorld());
B3.restore([[7, 0, X0, 0, Z0, 0, 100, 0]]);
assert.equal([...B3.pieces.values()][0]?.kind, 'ladder', 'an old save restores index 7 as a ladder');

console.log('ladder check passed: three stacked cells, ten rungs, climbable body, four tiered items');

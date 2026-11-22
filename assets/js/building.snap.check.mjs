





import { BuildingSystem, snapPlan } from './building.js';
import { stubThree, flatWorld } from './three-stub.mjs';
import { KIND as WALL } from './pieces/wall.js';
import { KIND as FLOOR } from './pieces/floor.js';
import { KIND as ROOF } from './pieces/roof.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const B = new BuildingSystem({ THREE: stubThree(), scene: { add() { } }, world: flatWorld() });


function footprint(kind, rot) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
  const ys = new Set();
  for (const [key, b] of kind.cells(0, 0, 0, rot)) {
    const [cx, cy, cz] = key.split(',').map(Number);
    x0 = Math.min(x0, b.minX); x1 = Math.max(x1, b.maxX);
    z0 = Math.min(z0, b.minZ); z1 = Math.max(z1, b.maxZ);
    cx0 = Math.min(cx0, cx); cx1 = Math.max(cx1, cx);
    cz0 = Math.min(cz0, cz); cz1 = Math.max(cz1, cz);
    ys.add(cy);
  }
  return { ox: x0, sx: x1 - x0, oz: z0, sz: z1 - z0, cx0, cx1, cz0, cz1, layers: ys.size };
}
const fps = (kind) => Array.from({ length: kind.rot }, (_, r) => ({ rot: r, ...footprint(kind, r) }));


const wall = B.place('wall', 'wood', 10, 0, 30, 0);
check(!!wall, 'the wall is placed');
check(B.pieceTop(wall) === 3, 'the wall is three metres tall');
const af = B.pieceFootprint(wall);
check(af.y1 - af.y0 === 3, 'the wall is three metres of boxes');
check(af.cz0 === 30 && af.cz1 === 30, 'the wall stands in a single z row');


const roofPlan = snapPlan(fps(ROOF), af, { x: 11.5, y: 3, z: 30.875 }, { x: 0, y: 0, z: -1 }, 0);
check(roofPlan.length > 0, 'the roof finds a place over the wall');
const p = roofPlan[0];
check(p.z === 28, `the roof reaches out past the wall (z=${p?.z})`);
check(p.x === 10, 'the roof lines up with the wall');



const other = snapPlan(fps(ROOF), af, { x: 11.5, y: 3, z: 30.875 }, { x: 0, y: 0, z: 1 }, 0);
check(other.length > 0 && other[0].z === 30, `from the other side it reaches the other way (z=${other[0]?.z})`);


const floorPlan = snapPlan(fps(FLOOR), af, { x: 11.5, y: 3, z: 30.875 }, { x: 0, y: 0, z: -1 }, 0);
check(floorPlan.length > 0 && floorPlan[0].z === 28, 'a floor lies over the wall the same way');



const wallPlan = snapPlan(fps(WALL), af, { x: 11.5, y: 3, z: 30.875 }, { x: 0, y: 0, z: -1 }, 0);
check(wallPlan.length > 0 && wallPlan[0].z !== 28, 'a wall is not laid over the wall');


const onGround = snapPlan(fps(ROOF), af, { x: 11.5, y: 1, z: 30.875 }, { x: 0, y: 0, z: -1 }, 0);
check(onGround.length > 0 && onGround[0].z !== 28,
  'aiming at the middle of the wall puts the roof beside it, not on it');



const y = ROOF.base(B, p.x, p.z, p.rot);
check(y === 3, `the roof rests on the top of the wall (y=${y})`);
check(ROOF.support(B, p.x, y, p.z, p.rot), 'the roof is held up by the wall');
check(FLOOR.base(B, floorPlan[0].x, floorPlan[0].z, floorPlan[0].rot) === 3, 'the floor rests on the wall');
check(ROOF.base(B, other[0].x, other[0].z, other[0].rot) === 3, 'the roof rests on the wall from the other side');

const roof = B.place('roof', 'wood', p.x, y, p.z, p.rot);
check(!!roof, 'the roof is placed over the wall');
const roofCells = new Set(roof.cells.map(([k]) => k));
const wallCells = new Set(wall.cells.map(([k]) => k));
check([...roofCells].some((k) => {
  const [cx, cy, cz] = k.split(',').map(Number);
  return cz === 30 && cy === 3;
}), 'the roof lies over the wall, one level above it');
check(![...roofCells].some((k) => wallCells.has(k)), 'the roof does not share a cell with the wall');



const body = { x: 3.5, y: 0.5, z: 3.5, radius: 0.3, height: 1.8 };
check(B.overlapsBody('floor', 3, 0, 3, 0, body), 'a new deck cannot be placed through a body');
check(!!B.place('floor', 'wood', 3, 0, 3, 0), 'the collision-test deck is placed');
check(B.collidesBody(3.5, 0.5, 3.5, 0.3, 1.8), 'body collision does not miss a low deck');
check(!B.collidesBody(3.5, 1, 3.5, 0.3, 1.8), 'standing on a deck is not penetration');
check(!B.collidesBody(12.7, 0.5, 30.5, 0.3, 1.8), 'touching a wall end is not penetration');
check(B.collidesBody(12.7001, 0.5, 30.5, 0.3, 1.8), 'a cylinder edge cannot enter the wall');


const saved = B.serialize();
const restored = new BuildingSystem({ THREE: stubThree(), scene: { add() { } }, world: flatWorld() });
restored.restore(saved);
check(restored.pieces.size === B.pieces.size, 'strict placement does not discard saved pieces');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`building snap check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`building snap OK: ${ok.length} assertions`);

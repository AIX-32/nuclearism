
import { BUILD_TIERS } from '../build-tiers.js';
import { ITEM_DEFS, CRAFT_RECIPES } from '../content.js';
import { BuildingSystem, shadowCells } from '../building.js';
import { stubThree, flatWorld } from '../three-stub.mjs';
import { KIND, ITEMS, mateOf, slideOffset, SLIDE_DIST } from './bunker_door.js';
import { KIND as FLOOR } from './floor.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const rot of [0, 1, 2, 3]) {
  const cells = KIND.cells(4, 10, 7, rot);
  check(cells.length === 9, `a bunker door leaf owns a full 3x3 wall of cells (rot ${rot})`);
  check(new Set(cells.map(([k]) => k.split(',')[0])).size === (rot < 2 ? 3 : 1), 'a leaf runs three cells along its wide axis');
  check(new Set(cells.map(([k]) => k.split(',')[2])).size === (rot < 2 ? 1 : 3), 'a leaf is one cell thick along the other axis');
  check(cells.every(([k, b]) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    return b.minX >= cx && b.maxX <= cx + 1 && b.minY >= cy && b.maxY <= cy + 1
      && b.minZ >= cz && b.maxZ <= cz + 1;
  }), 'every box lies inside its own cell');

  const s = KIND.scale(4, 10, 7, rot);
  check(near(s.y, 3), 'a leaf is three metres tall');
  const wide = rot < 2 ? s.x : s.z;
  const thin = rot < 2 ? s.z : s.x;
  check(near(wide, 3) && near(thin, 0.25), 'a leaf is a full 3 m door width and a quarter metre thick');
  const c = KIND.center(4, 10, 7, rot);
  check(near(c.y, 11.5), 'the mesh is centred on its height');
  check(near((rot < 2 ? c.x : c.z) - (rot < 2 ? 4 : 7), 1.5), 'the mesh is centred along its three-cell run');
}
check(KIND.rot === 4, 'four rotations: two directions, two sides to hug');
check(KIND.solid === true && KIND.attenuate === true, 'a closed leaf blocks the player and shields');
check(KIND.dynamicSolid === true, 'an open leaf is passable');
check(!!KIND.slideOffset && KIND.slideTime > 0, 'the kind declares its slide animation');

function piece(kind, tier, x, y, z, rot, open = false) {
  const p = { id: x * 100 + z, kind, tier, x, y, z, rot, open, slide: open ? 1 : 0 };
  p.cells = kind === 'floor' ? FLOOR.cells(x, y, z, rot) : KIND.cells(x, y, z, rot);
  return p;
}
function makeSys(pieces) {
  const cells = new Map();
  for (const p of pieces.values()) {
    for (const [k, box] of p.cells) {
      const entry = { piece: p, tier: p.tier, box };
      const list = cells.get(k);
      if (Array.isArray(list)) list.push(entry);
      else if (list) cells.set(k, [list, entry]);
      else cells.set(k, [entry]);
    }
  }
  return { pieces, cells };
}

const floorA = piece('floor', 'concrete', 4, 9, 7, 0);
const floorB = piece('floor', 'concrete', 7, 9, 7, 0);
const leafA = piece('bunker_door', 'shielded', 4, 10, 7, 0);
const leafB = piece('bunker_door', 'shielded', 7, 10, 7, 0);
const sys = makeSys(new Map([[1, floorA], [2, floorB], [3, leafA], [4, leafB]]));

check(KIND.support(sys, 4, 10, 7, 0) === true, 'a leaf sits on a floor BB');
check(KIND.support(sys, 10, 10, 7, 0) === false, 'a leaf refuses bare ground');
check(KIND.support(sys, 4, 10, 10, 0) === false, 'a leaf refuses a spot with no floor');

check(mateOf(sys, leafA) === leafB, 'the left leaf finds its mate');
check(mateOf(sys, leafB) === leafA, 'the right leaf finds its mate');
const lone = piece('bunker_door', 'wood', 13, 10, 7, 0);
sys.pieces.set(5, lone);
check(mateOf(sys, lone) === null, 'a lone leaf has no mate');
const offsetLeaf = piece('bunker_door', 'wood', 4, 11, 7, 0);
sys.pieces.set(6, offsetLeaf);
check(mateOf(sys, offsetLeaf) === null, 'a leaf on another level is not a mate');
sys.pieces.delete(6);

const offA = slideOffset(sys, leafA, 1);
const offB = slideOffset(sys, leafB, 1);
check(offA.x < 0 && offB.x > 0, 'the leaves slide away from each other');
check(near(Math.abs(offA.x - offB.x), SLIDE_DIST * 2), 'the gap opens by two full leaf widths');
check(slideOffset(sys, leafA, 0).x === 0, 'a shut leaf has no visual offset');
const zLeaf = piece('bunker_door', 'wood', 4, 10, 12, 2);
const zMate = piece('bunker_door', 'wood', 4, 10, 15, 2);
const zSys = makeSys(new Map([[1, zLeaf], [2, zMate]]));
check(slideOffset(zSys, zLeaf, 1).z < 0 && slideOffset(zSys, zMate, 1).z > 0,
  'z-running leaves slide apart along z');

const doorMap = (open) => {
  const m = new Map();
  for (const [k, box] of KIND.cells(4, 10, 7, 0)) m.set(k, { piece: { open }, tier: 'shielded', box });
  return m;
};
const closed = shadowCells(doorMap(false), 4.5, 11.5, 15.5, 0, 0, -1, 24);
const openT = shadowCells(doorMap(true), 4.5, 11.5, 15.5, 0, 0, -1, 24);
check(closed < 0.02, `a closed shielded leaf blocks the field (${closed.toFixed(4)} left)`);
check(near(openT, 1), 'an open leaf shields nothing');
const woodClosed = shadowCells((() => {
  const m = new Map();
  for (const [k, box] of KIND.cells(4, 10, 7, 0)) m.set(k, { piece: { open: false }, tier: 'wood', box });
  return m;
})(), 4.5, 11.5, 15.5, 0, 0, -1, 24);
check(woodClosed > closed && near(woodClosed, Math.pow(BUILD_TIERS.wood.transmission, 0.25)),
  'a wood leaf attenuates by its tier and thickness');

for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const id = `bunker_door_${tier}`;
  check(!!ITEM_DEFS[id], `item "${id}" exists`);
  check(ITEM_DEFS[id]?.building?.kind === 'bunker_door', `item "${id}" builds a bunker door`);
  check(ITEM_DEFS[id]?.building?.tier === tier, `item "${id}" is a ${tier} bunker door`);
  check(CRAFT_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
}
check(ITEM_DEFS.bunker_door_wood?.table === true, 'the wood leaf is a pocket-table craft');
check(!ITEM_DEFS.bunker_door_brick?.table, 'the brick leaf is not a pocket-table craft');

const B = new BuildingSystem({ THREE: stubThree(), scene: { add() { } }, world: flatWorld() });
B.place('floor', 'wood', 4, 0, 7, 0);
B.place('floor', 'wood', 7, 0, 7, 0);
const liveA = B.place('bunker_door', 'wood', 4, 1, 7, 0);
const liveB = B.place('bunker_door', 'wood', 7, 1, 7, 0);
check(!!liveA && !!liveB, 'a pair of leaves places on two inline floor BBs');
const mesh = B.meshes.get('wood|bunker_door');
check(!!mesh && mesh.count === 2, 'both leaves share one tier+kind mesh');
check(KIND.materialShade > 0 && KIND.materialShade < 1, 'bunker doors declare a darker material shade');
B.place('wall', 'wood', 20, 0, 7, 0);
const wallMat = B.meshes.get('wood|wall').material;
check(mesh.material !== wallMat, 'bunker doors do not share the plain wall material');
check((mesh.material.color.value & 255) < (wallMat.color.value & 255),
  'the bunker door material is a darker shade of the same tier');
check(B.shadow(4.5, 2.5, 15, 0, 0, -1, 24) < 1, 'shut leaves shield through the runtime');
check(B.toggle(liveA) && B.toggle(liveB), 'right-clicking one leaf toggles the pair');
B.update(0.1);
check(liveA.slide > 0 && liveB.slide > 0, 'the leaves begin sliding apart');
B.update(1);
check(near(liveA.slide, 1) && near(liveB.slide, 1), 'the leaves finish fully open');
check(near(Math.abs(slideOffset(B, liveA).x - slideOffset(B, liveB).x), SLIDE_DIST * 2),
  'the finished leaves sit one full leaf width apart from where they started');
check(near(B.shadow(4.5, 2.5, 15, 0, 0, -1, 24), 1), 'open leaves let the field through the runtime');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`bunker door check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`bunker door OK: ${ok.length} assertions`);

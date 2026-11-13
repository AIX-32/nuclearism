// Self-checks for the roof piece: node assets/js/pieces/roof.check.mjs

import { BUILD_TIERS } from '../build-tiers.js';
import { KIND as WALL } from './wall.js';
import { KIND as FLOOR } from './floor.js';
import { KIND as ROOF, ITEMS as ROOF_ITEMS, RECIPES as ROOF_RECIPES } from './roof.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

// The thickness of a roof, in metres: it is the roof's own half metre of
// material that stops the fallout coming down from above.
const TH = ROOF.cells(0, 0, 0)[0][1].maxY;
const W = 3, D = 3;

// --- the roof cells ---------------------------------------------------------
const X = 4, Y = 10, Z = 7;
const cells = ROOF.cells(X, Y, Z);
check(cells.length === W * D, `a roof owns ${W * D} cells`);
check(new Set(cells.map(([k]) => k)).size === W * D, 'the roof cells are all different');
check(cells.every(([k]) => k.split(',').length === 3), 'cell keys are x,y,z');
check(cells.every(([k, b]) => {
  const [cx, cy, cz] = k.split(',').map(Number);
  return b.minX >= cx && b.maxX <= cx + 1 && b.minY >= cy && b.maxY <= cy + 1
    && b.minZ >= cz && b.maxZ <= cz + 1;
}), 'every roof cell box stays inside its cell');
check(cells.every(([, b]) => Math.abs((b.maxY - b.minY) - TH) < 1e-9), `every roof cell slice is ${TH} m thick`);
check(new Set(cells.map(([k]) => k.split(',')[0])).size === W, 'the roof spans three x cells');
check(new Set(cells.map(([k]) => k.split(',')[2])).size === D, 'the roof spans three z cells');
check(cells.every(([k]) => k.split(',')[1] === String(Y)), 'the roof sits in a single level');

// A roof is twice as thick as a wall, so it shields better than one.
const wallTH = WALL.cells(0, 0, 0, 0)[0][1].maxZ - WALL.cells(0, 0, 0, 0)[0][1].minZ;
check(TH > wallTH, `a roof is thicker than a wall (${TH} m > ${wallTH} m)`);
for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const roofBlock = 1 - Math.pow(BUILD_TIERS[tier].transmission, TH);
  const wallBlock = 1 - Math.pow(BUILD_TIERS[tier].transmission, wallTH);
  check(roofBlock > wallBlock, `a ${tier} roof shields better than a ${tier} wall`);
}
check(1 - Math.pow(BUILD_TIERS.shielded.transmission, TH) > 0.99, 'a shielded roof stops essentially everything');
check(1 - Math.pow(BUILD_TIERS.concrete.transmission, TH) > 0.7, 'a concrete roof stops most of the fallout');
check(1 - Math.pow(BUILD_TIERS.wood.transmission, TH) < 0.5, 'a wood roof only helps a little');

// --- a fake building system, with the same rules as the runtime -------------
function makeSys(pieces = [], ground = new Set(), height = -100) {
  const map = new Map();
  const sys = {
    occupied: (x, y, z) => map.has(`${x},${y},${z}`),
    groundAt: (x, y, z) => ground.has(`${x},${y},${z}`),
    surfaceHeight: () => height,
    topAt(x, z) {
      let top = null;
      for (const p of pieces) {
        let hit = false;
        for (const [k] of p) {
          const [cx, , cz] = k.split(',').map(Number);
          if (cx === x && cz === z) { hit = true; break; }
        }
        if (!hit) continue;
        for (const [k] of p) {
          const t = Number(k.split(',')[1]) + 1;
          if (top === null || t > top) top = t;
        }
      }
      return top;
    },
  };
  for (const p of pieces) for (const [k, b] of p) map.set(k, b);
  return sys;
}

// --- a roof on a wall -------------------------------------------------------
const wall = WALL.cells(X, Y, Z, 0);          // the wall stands on the cells y..y+2
const wallTop = Y + 3;                        // its top surface
const wallCells = new Set(wall.map(([k]) => k));
const sys = makeSys([wall]);

check(wall.length === 9, 'the reference wall owns nine cells');
check(wall.every(([k]) => Number(k.split(',')[1]) >= Y && Number(k.split(',')[1]) <= Y + 2),
  'the wall stands on the cells y..y+2');
check(Math.abs(Math.max(...wall.map(([, b]) => b.maxY)) - wallTop) < 1e-9, 'the top of the wall is at the top of its top cell');

const roofBase = ROOF.base(sys, X, Z);
check(roofBase === wallTop, `a roof aimed at a wall drops onto its top (cell ${roofBase})`);

const roofCells = ROOF.cells(X, roofBase, Z);
const roofKeys = new Set(roofCells.map(([k]) => k));
check(roofCells.every(([k]) => !wallCells.has(k)), 'the roof does not overlap the wall');
check(roofCells.every(([k]) => Number(k.split(',')[1]) === wallTop), 'the roof sits directly above the wall');
check(Math.abs(roofCells[0][1].minY - wallTop) < 1e-9, 'the roof rests flush on the top of the wall');
check(Math.abs(roofCells[0][1].maxY - (wallTop + TH)) < 1e-9,
  `the top of the roof is ${TH} m above the top of the wall`);
check(ROOF.support(sys, X, roofBase, Z), 'a roof on a wall is supported');

// The same for a wall that runs the other way.
const wallZ = WALL.cells(X, Y, Z, 1);
const sysZ = makeSys([wallZ]);
check(ROOF.base(sysZ, X, Z) === wallTop, 'a roof aimed at a z wall drops onto its top');
check(ROOF.support(sysZ, X, wallTop, Z), 'a roof on a z wall is supported');

// --- a roof on a floor ------------------------------------------------------
const floor = FLOOR.cells(X, Y, Z);
const sysF = makeSys([floor]);
check(ROOF.base(sysF, X, Z) === Y + 1, 'a roof aimed at a floor drops onto its top');
check(ROOF.support(sysF, X, Y + 1, Z), 'a roof on a floor is supported');

// --- a roof must never float ------------------------------------------------
const empty = makeSys();
check(!ROOF.support(empty, X, Y + 5, Z), 'a roof with nothing under it is refused');
const oneBlock = makeSys([], new Set([`${X},${Y + 4},${Z}`]));
check(!ROOF.support(oneBlock, X, Y + 5, Z), 'a roof held by a single block is refused');
const row = makeSys([], new Set(Array.from({ length: 3 }, (_, i) => `${X + i},${Y + 4},${Z}`)));
check(ROOF.support(row, X, Y + 5, Z), 'a roof on a single row of ground is supported');

// Nothing under the panel at all.
const bare = makeSys([], new Set(), -100);
check(!ROOF.support(bare, X, Y + 5, Z), 'a floating roof is refused');

// --- the mesh ---------------------------------------------------------------
const FAKE_THREE = {
  BufferGeometry: class {
    constructor() { this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; return this; }
    computeVertexNormals() {}
  },
  Float32BufferAttribute: class {
    constructor(array, size) { this.array = Float32Array.from(array); this.itemSize = size; }
  },
};
const geom = ROOF.geometry(FAKE_THREE);
const pos = geom.attributes.position.array;
check(!!geom.attributes.uv, 'the roof geometry carries uvs for the tier texture');
let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (let i = 0; i < pos.length; i += 3) {
  minX = Math.min(minX, pos[i]); maxX = Math.max(maxX, pos[i]);
  minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]);
  minZ = Math.min(minZ, pos[i + 2]); maxZ = Math.max(maxZ, pos[i + 2]);
}
check(Math.abs(minY) < 1e-9 && Math.abs(maxY - 1) < 1e-9, 'the roof mesh runs from its soffit to its ridge');
check(Math.abs(minX) < 1e-9 && Math.abs(maxX - 1) < 1e-9, 'the roof mesh spans its unit box in x');
check(Math.abs(minZ) < 1e-9 && Math.abs(maxZ - 1) < 1e-9, 'the roof mesh spans its unit box in z');
check(pos.length % 9 === 0, 'the roof mesh is made of whole triangles');
check(pos.length / 9 >= 8, 'the roof mesh has a body, not just a slab');
// The ridge is a flat strip, so there is something to stand on.
const ridgeZ = new Set();
for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i + 1] - 1) < 1e-9) ridgeZ.add(pos[i + 2].toFixed(3));
check(ridgeZ.size === 2, 'the roof has a flat ridge along the middle');
check((Math.max(...[...ridgeZ].map(Number)) - Math.min(...[...ridgeZ].map(Number))) * 3 >= 0.9,
  'the ridge strip is wide enough for the player to stand on');
const eaveZ = new Set();
for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i + 1] - 0) < 1e-9) eaveZ.add(pos[i + 2].toFixed(3));
check(eaveZ.size === 2, 'the roof has a flat soffit to sit on');
const scale = ROOF.scale(X, Y, Z);
check(Math.abs(scale.y - TH) < 1e-9, 'the mesh is scaled to the thickness of the roof');
const center = ROOF.center(X, Y, Z);
check(Math.abs(center.y - (Y + TH / 2)) < 1e-9, 'the mesh sits on the cell it belongs to');

// --- the items --------------------------------------------------------------
for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const id = `roof_${tier}`;
  check(ROOF_ITEMS[id]?.building?.kind === 'roof', `item "${id}" builds a roof`);
  check(ROOF_ITEMS[id]?.building?.tier === tier, `item "${id}" is a ${tier} roof`);
  check(ROOF_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
}
check(ROOF_ITEMS.roof_wood.table === true, 'the wood roof is craftable at the pocket table');
check(ROOF.solid === true, 'the roof is solid: the player can stand on it');
check(ROOF.attenuate === true, 'the roof takes part in the radiation shadow');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`roof check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`roof OK — ${ok.length} assertions`);

// Self-checks for the door piece: node assets/js/pieces/door.check.mjs

import { BUILD_TIERS } from '../build-tiers.js';
import { ITEM_DEFS, CRAFT_RECIPES } from '../content.js';
import { shadowCells } from '../building.js';
import { KIND as DOOR, swingFrame } from './door.js';
import { KIND as WALL } from './wall.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const W = 1, H = 3, TH = 0.25;

// --- geometry ---------------------------------------------------------------
for (const rot of [0, 1, 2, 3]) {
  const cells = DOOR.cells(4, 10, 7, rot);
  check(cells.length === H, `a door owns ${H} cells (rot ${rot})`);
  check(cells.every(([k]) => k.split(',').length === 3), 'cell keys are x,y,z');
  check(new Set(cells.map(([k]) => k.split(',')[0])).size === 1, 'a door sits in a single x column');
  check(new Set(cells.map(([k]) => k.split(',')[2])).size === 1, 'a door sits in a single z column');
  check(new Set(cells.map(([k]) => k.split(',')[1])).size === H, 'a door stacks three cells high');
  // every box stays inside the cell it belongs to
  check(cells.every(([k, b]) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    return b.minX >= cx && b.maxX <= cx + 1
      && b.minY >= cy && b.maxY <= cy + 1
      && b.minZ >= cz && b.maxZ <= cz + 1;
  }), 'every box lies inside its own cell');
  check(cells.every(([, b]) => Math.abs((b.maxY - b.minY) - 1) < 1e-9), 'each cell slice is one metre tall');
  const s = DOOR.scale(4, 10, 7, rot);
  check(Math.abs(s.y - H) < 1e-9, 'the door is three metres tall');
  const wide = rot < 2 ? s.x : s.z;
  const thin = rot < 2 ? s.z : s.x;
  check(Math.abs(wide - W) < 1e-9, 'the door is one metre wide');
  check(Math.abs(thin - TH) < 1e-9, 'the door is a quarter metre thick');
  // The panel hugs one side of its cell, so the mesh centre is not the cell
  // centre: it sits a quarter metre off it.
  const c = DOOR.center(4, 10, 7, rot);
  check(Math.abs(c.y - 11.5) < 1e-9, 'the door mesh sits in the middle of its height');
  if (rot < 2) {
    check(Math.abs(c.x - 4.5) < 1e-9, 'the wide side is centred on the cell');
    const want = rot === 0 ? 7 + 1 - TH / 2 : 7 + TH / 2;
    check(Math.abs(c.z - want) < 1e-9, 'the panel hugs the side of its cell');
  } else {
    check(Math.abs(c.z - 7.5) < 1e-9, 'the wide side is centred on the cell');
    const want = rot === 2 ? 4 + 1 - TH / 2 : 4 + TH / 2;
    check(Math.abs(c.x - want) < 1e-9, 'the panel hugs the side of its cell');
  }
}
check(DOOR.rot === 4, 'a door has four rotations (two directions, two sides to hug)');

// --- the door fills a gap in a wall run ------------------------------------
const wallCells = new Set(WALL.cells(4, 10, 7, 0).map(([k]) => k));
// column 6 is the third column of the wall run: leave it out as the doorway.
const run = WALL.cells(4, 10, 7, 0).filter(([k]) => k.split(',')[0] !== '6');
const doorCells = DOOR.cells(6, 10, 7, 0);
check(run.length === 2 * H, 'the wall run around the gap keeps its cells');
check(doorCells.every(([k]) => !run.some(([rk]) => rk === k)), 'the door does not overlap the wall');
const runCells = new Set(run.map(([k]) => k));
check(new Set([...runCells, ...doorCells.map(([k]) => k)]).size === runCells.size + doorCells.length,
  'the door and the wall share no cell at all');
// the other rotation runs along z, so it must not touch the x wall
const doorZ = DOOR.cells(9, 10, 7, 1);
check(doorZ.every(([k]) => !wallCells.has(k)), 'a z door does not overlap an x wall');

// --- the runtime flags ------------------------------------------------------
check(DOOR.dynamicSolid === true, 'a door is only solid while it is closed');
check(DOOR.solid === true, 'a door blocks the player');
check(DOOR.attenuate === true, 'a door takes part in the radiation shadow');
check(!!DOOR.support && !!DOOR.base, 'a door declares base() and support()');

// --- radiation --------------------------------------------------------------
function doorCellsFor(tier, x, y, z, rot, open) {
  const m = new Map();
  for (const [k, box] of DOOR.cells(x, y, z, rot)) m.set(k, { piece: { open }, tier, box });
  return m;
}
// shoot straight through the door, along z
const closed = shadowCells(doorCellsFor('shielded', 4, 10, 7, 0, false), 4.5, 11.5, 15.5, 0, 0, -1, 24);
const open = shadowCells(doorCellsFor('shielded', 4, 10, 7, 0, true), 4.5, 11.5, 15.5, 0, 0, -1, 24);
check(closed < 0.02, `a closed shielded door blocks the field (${closed.toFixed(4)} left)`);
check(Math.abs(open - 1) < 1e-9, 'an open door shields nothing');
const woodClosed = shadowCells(doorCellsFor('wood', 4, 10, 7, 0, false), 4.5, 11.5, 15.5, 0, 0, -1, 24);
check(woodClosed > closed, 'a wood door shields worse than a shielded one');
check(Math.abs(woodClosed - Math.pow(BUILD_TIERS.wood.transmission, TH)) < 1e-6,
  `a closed wood door transmits ${woodClosed.toFixed(3)}`);

// --- the swing --------------------------------------------------------------
for (const rot of [0, 1, 2, 3]) {
  const fr = swingFrame(4, 10, 7, rot);
  check(Math.abs(fr.center.y - 11.5) < 1e-9, 'the hinge is at the middle of the panel');
  check(Math.abs(fr.hinge.x - fr.center.x) < 1e-9 || Math.abs(fr.hinge.z - fr.center.z) < 1e-9,
    'the hinge sits on the edge of the panel');
  check(fr.sign === 1 || fr.sign === -1, 'the swing turns one way or the other');
  // the hinge is half a panel away from the centre, on the axis the panel runs along
  const dx = Math.abs(fr.hinge.x - fr.center.x), dz = Math.abs(fr.hinge.z - fr.center.z);
  check(Math.abs((rot < 2 ? dx : dz) - 0.5) < 1e-9, 'the hinge is half a metre from the middle');
}

// --- items ------------------------------------------------------------------
for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const id = `door_${tier}`;
  check(!!ITEM_DEFS[id], `item "${id}" exists`);
  check(ITEM_DEFS[id]?.building?.kind === 'door', `item "${id}" builds a door`);
  check(ITEM_DEFS[id]?.building?.tier === tier, `item "${id}" is a ${tier} door`);
  check(CRAFT_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
}
check(ITEM_DEFS.door_wood?.table === true, 'the wooden door is craftable at the pocket table');
check(!ITEM_DEFS.door_brick?.table, 'the brick door is not a pocket table craft');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`door check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`door OK — ${ok.length} assertions`);

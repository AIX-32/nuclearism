// Self-checks for the base building pieces: node assets/js/building.check.mjs

import { BUILD_TIERS, BUILD_TIER_ORDER, BUILD_UPGRADES, TUNING, ITEM_DEFS, CRAFT_RECIPES } from './content.js';
import { shadowCells, snapPlan, meshKey } from './building.js';
import { KIND as WALL } from './pieces/wall.js';
import { KIND as FLOOR } from './pieces/floor.js';
import { KINDS } from './pieces/registry.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const TH = TUNING.BUILD_WALL_T;
const W = TUNING.BUILD_WALL_W;
const H = TUNING.BUILD_WALL_H;

// --- piece geometry -------------------------------------------------------
const cells = WALL.cells(4, 10, 7, 0);
check(cells.length === W * H, `an x wall owns ${W * H} cells`);
check(cells.every(([k]) => k.split(',').length === 3), 'cell keys are x,y,z');
check(cells.every(([, b]) => b.maxY - b.minY === 1), 'each cell slice is one metre tall');
check(cells.every(([, b]) => Math.abs((b.maxZ - b.minZ) - TH) < 1e-9), 'each cell slice is one panel thick');
const zCells = new Set(cells.map(([k]) => k.split(',')[2]));
check(zCells.size === 1, 'an x wall sits in a single z column');
const xCells = new Set(cells.map(([k]) => k.split(',')[0]));
check(xCells.size === W, 'an x wall runs over three x cells');
const zRun = WALL.cells(4, 10, 7, 2);
check(zRun.every(([, b]) => Math.abs((b.maxX - b.minX) - TH) < 1e-9), 'a z wall is thin on x');
check(new Set(zRun.map(([k]) => k.split(',')[0])).size === 1, 'a z wall sits in a single x column');
check(WALL.rot === 4, 'a wall has four rotations (two directions, two sides to hug)');
for (const rot of [0, 1, 2, 3]) {
  const c = WALL.cells(4, 10, 7, rot);
  check(c.every(([k, b]) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    return b.minX >= cx && b.maxX <= cx + 1 && b.minY >= cy && b.maxY <= cy + 1
      && b.minZ >= cz && b.maxZ <= cz + 1;
  }), `a wall panel (rot ${rot}) stays inside its own cells`);
  // The panel hugs one side of its cell exactly, so two panels that share an
  // edge share it exactly.
  const thin = rot < 2 ? 'z' : 'x';
  const box = c[0][1];
  const lo = thin === 'z' ? box.minZ : box.minX;
  const hi = thin === 'z' ? box.maxZ : box.maxX;
  check(Math.abs(lo - Math.floor(lo)) < 1e-9 || Math.abs(hi - Math.floor(hi)) < 1e-9,
    `a wall panel (rot ${rot}) hugs one side of its cell exactly`);
  check(Math.abs((hi - lo) - TH) < 1e-9, `a wall panel (rot ${rot}) is one panel thick`);
}

// --- the meshes ------------------------------------------------------------
// Two kinds of the same tier are drawn in different meshes: sharing one would
// draw a wall with the floor's shape (flat) and a floor with the wall's.
check(meshKey({ tier: 'wood', kind: 'wall' }) !== meshKey({ tier: 'wood', kind: 'floor' }),
  'a wall and a floor of the same tier do not share a mesh');
check(meshKey({ tier: 'wood', kind: 'wall' }) !== meshKey({ tier: 'brick', kind: 'wall' }),
  'two tiers of the same kind do not share a mesh');
for (const kind of Object.keys(KINDS)) {
  const keys = new Set();
  for (const tier of BUILD_TIER_ORDER) keys.add(meshKey({ tier, kind }));
  check(keys.size === BUILD_TIER_ORDER.length, `every tier of the ${kind} gets its own mesh`);
}

// --- snapping --------------------------------------------------------------
// The footprint of a kind inside its cell, for every rotation.
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
const union = (kind, x, y, z, rot) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [, b] of kind.cells(x, y, z, rot)) {
    x0 = Math.min(x0, b.minX); x1 = Math.max(x1, b.maxX);
    z0 = Math.min(z0, b.minZ); z1 = Math.max(z1, b.maxZ);
  }
  return { x0, x1, z0, z1 };
};

// A floor deck, and a wall that is aimed at its -Z edge from outside.
const deck = { x0: 10, x1: 13, z0: 30, z1: 33 };
const side = snapPlan(fps(WALL), deck, { x: 11.5, y: 21, z: 30 }, { x: 0, y: 0, z: 1 }, 0);
check(side.length > 0, 'a wall aimed at a floor finds a place to go');
check(side[0].z === 29, `the wall lands right outside the deck (z=${side[0]?.z})`);
check(side[0].x === 10, 'the wall lines up with the deck');
const wallBox = union(WALL, side[0].x, 20, side[0].z, side[0].rot);
check(Math.abs(wallBox.z1 - deck.z0) < 1e-9, 'the wall sits flush against the edge of the deck');
check(Math.abs(wallBox.x0 - deck.x0) < 1e-9 && Math.abs(wallBox.x1 - deck.x1) < 1e-9,
  'the wall is exactly as long as the deck');

// Looking down at the deck near its -X edge: the wall hugs that edge.
const top = snapPlan(fps(WALL), deck, { x: 10.2, y: 21, z: 31.5 }, { x: 0, y: -1, z: 0 }, 0);
check(top.length > 0, 'a wall aimed down at a floor finds a place to go');
const topBox = union(WALL, top[0].x, 20, top[0].z, top[0].rot);
check(Math.abs(topBox.x0 - deck.x0) < 1e-9, 'the wall hugs the edge that is looked at');
check(top[0].x >= deck.x0 && top[0].x + 1 <= deck.x1, 'the wall stands on the deck');

// A second deck flush against the first one.
const nextDeck = snapPlan(fps(FLOOR), deck, { x: 13, y: 20.5, z: 31.5 }, { x: -1, y: 0, z: 0 }, 0);
check(nextDeck.length > 0, 'a floor aimed at a floor finds a place to go');
const deckBox = union(FLOOR, nextDeck[0].x, 20, nextDeck[0].z, nextDeck[0].rot);
check(Math.abs(deckBox.x0 - deck.x1) < 1e-9, 'the second deck is flush with the first');
check(Math.abs(deckBox.z0 - deck.z0) < 1e-9 && Math.abs(deckBox.z1 - deck.z1) < 1e-9,
  'the second deck lines up with the first');

// A wall that continues a wall run.
const run = union(WALL, 10, 20, 30, 0);
const next = snapPlan(fps(WALL), run, { x: 13, y: 21, z: 30.9 }, { x: -1, y: 0, z: 0 }, 0);
check(next.length > 0, 'a wall aimed at the end of a wall run finds a place to go');
check(next[0].x === 13, 'the next panel continues the run');
const nextBox = union(WALL, next[0].x, 20, next[0].z, next[0].rot);
check(Math.abs(nextBox.x0 - run.x1) < 1e-9, 'the panels meet end to end');
check(Math.abs(nextBox.z0 - run.z0) < 1e-9 && Math.abs(nextBox.z1 - run.z1) < 1e-9,
  'the panels are in the same plane');
check(Math.abs((next[0].x - 10) - 3) < 1e-9, 'the run is three metres long');

for (const kind of Object.keys(KINDS)) {
  const k = KINDS[kind];
  const plan = snapPlan(fps(k), deck, { x: 11, y: 21, z: 30.5 }, { x: 0, y: 0, z: 1 }, 0);
  check(plan.every((c) => Number.isInteger(c.x) && Number.isInteger(c.z)),
    `a ${kind} always snaps to whole cells`);
}

// A roof aimed at the top edge of a wall lies over it and reaches out in the
// direction that is looked at.
const wallRun = union(WALL, 10, 20, 30, 0);          // a wall along x
const wallCells = { x0: 10, x1: 13, y0: 20, y1: 23, z0: 30.75, z1: 31, cx0: 10, cx1: 12, cz0: 30, cz1: 30 };
const overWall = snapPlan(fps(FLOOR), wallCells,
  { x: 11.5, y: 23, z: 30.875 }, { x: 0, y: 0, z: -1 }, 0);
check(overWall.length > 0, 'a roof aimed at the top of a wall finds a place to go');
// looking from +z, so the roof reaches out towards -z, over the wall's row
check(overWall[0].z === 28, `the roof reaches out past the wall (z=${overWall[0]?.z})`);
check(overWall[0].x === 10, 'the roof lines up with the wall');
check(overWall[0].z <= 30 && overWall[0].z + 2 >= 30, 'the roof still lies over the wall');
// and the other way round
const overWall2 = snapPlan(fps(FLOOR), wallCells,
  { x: 11.5, y: 23, z: 30.875 }, { x: 0, y: 0, z: 1 }, 0);
check(overWall2.length > 0 && overWall2[0].z === 30,
  `looking from the other side, the roof reaches out the other way (z=${overWall2[0]?.z})`);

// --- the attenuation law ---------------------------------------------------
const blocked = (tier) => 1 - Math.pow(BUILD_TIERS[tier].transmission, TH);
check(blocked('wood') < 0.2, `wood blocks only a little (${(blocked('wood') * 100).toFixed(0)}%)`);
check(blocked('brick') > blocked('wood'), 'brick beats wood');
check(blocked('brick') < 0.4, `brick blocks a small amount (${(blocked('brick') * 100).toFixed(0)}%)`);
check(blocked('concrete') > 0.4, `concrete blocks a decent amount (${(blocked('concrete') * 100).toFixed(0)}%)`);
check(blocked('shielded') > 0.95, `shielded concrete blocks almost everything (${(blocked('shielded') * 100).toFixed(1)}%)`);
for (let i = 1; i < BUILD_TIER_ORDER.length; i++) {
  check(blocked(BUILD_TIER_ORDER[i]) > blocked(BUILD_TIER_ORDER[i - 1]),
    `${BUILD_TIER_ORDER[i]} shields better than ${BUILD_TIER_ORDER[i - 1]}`);
}

// --- the shadow march ------------------------------------------------------
function cellsFor(tier, x, y, z, rot) {
  const m = new Map();
  for (const [k, box] of WALL.cells(x, y, z, rot)) m.set(k, { tier, box });
  return m;
}

// The player stands off the wall and shoots at it head on (perpendicular).
function shoot(cells, from = [4.5, 11.5, 15.5], dir = [0, 0, -1]) {
  return shadowCells(cells, from[0], from[1], from[2], dir[0], dir[1], dir[2], 24);
}

check(Math.abs(shoot(new Map()) - 1) < 1e-9, 'an empty world blocks nothing');
const woodCells = cellsFor('wood', 4, 10, 7, 0);
const woodT = shoot(woodCells);
check(Math.abs(woodT - Math.pow(BUILD_TIERS.wood.transmission, TH)) < 1e-6,
  `a wood wall in the ray transmits ${woodT.toFixed(3)}`);
const shieldedCells = cellsFor('shielded', 4, 10, 7, 0);
check(shoot(shieldedCells) < 0.02, `a shielded wall in the ray transmits ${shoot(shieldedCells).toFixed(4)}`);
// Shooting along the wall crosses its full length, so it is shielded harder.
// The panel hugs the +Z side of its cell, so the ray runs down its middle.
const lengthwise = shoot(woodCells, [0.5, 11.5, 7.875], [1, 0, 0]);
check(Math.abs(lengthwise - Math.pow(BUILD_TIERS.wood.transmission, TUNING.BUILD_WALL_W)) < 1e-6,
  `a lengthwise shot transmits ${lengthwise.toFixed(3)}`);
check(Math.abs(shoot(woodCells, [0.5, 11.5, 7.875], [-1, 0, 0]) - 1) < 1e-9,
  'a wall behind you does not shield you');
check(Math.abs(shoot(woodCells, [30.5, 11.5, 15.5], [0, 0, -1]) - 1) < 1e-9,
  'a wall off to the side does not shield you');
// Two layers multiply.
const two = new Map([...woodCells, ...cellsFor('wood', 4, 10, 12, 0)]);
check(Math.abs(shoot(two) - woodT * woodT) < 1e-6, 'two layers multiply');
// A wall high above the ray is missed.
const high = cellsFor('wood', 4, 20, 7, 0);
check(Math.abs(shoot(high) - 1) < 1e-9, 'a wall above the ray does not shield you');

// --- content ---------------------------------------------------------------
for (const kind of Object.keys(KINDS)) {
  check(!!KINDS[kind]?.name, `kind "${kind}" is registered`);
  check(!!KINDS[kind]?.cells, `kind "${kind}" declares cells()`);
  check(!!KINDS[kind]?.center && !!KINDS[kind]?.scale, `kind "${kind}" declares a mesh shape`);
  check(!!KINDS[kind]?.base && !!KINDS[kind]?.support, `kind "${kind}" declares base() and support()`);
}
for (const tier of BUILD_TIER_ORDER) {
  for (const kind of Object.keys(KINDS)) {
    const id = `${kind}_${tier}`;
    if (!ITEM_DEFS[id]) continue;
    check(ITEM_DEFS[id]?.building?.kind === kind, `item "${id}" builds a ${kind}`);
    check(ITEM_DEFS[id]?.building?.tier === tier, `item "${id}" is a ${tier} piece`);
    check(CRAFT_RECIPES.some((r) => r.out[id]), `item "${id}" is craftable`);
  }
}
check(!!ITEM_DEFS.hammer, 'the hammer exists');
check(CRAFT_RECIPES.some((r) => r.out.hammer), 'the hammer is craftable');
for (const tier of BUILD_TIER_ORDER.slice(0, -1)) {
  const cost = BUILD_UPGRADES[tier];
  check(!!cost && Object.keys(cost).length > 0, `upgrading from ${tier} costs something`);
  for (const id of Object.keys(cost || {})) check(!!ITEM_DEFS[id], `upgrade material "${id}" exists`);
}
check(Object.keys(BUILD_UPGRADES).length === BUILD_TIER_ORDER.length - 1, 'every tier but the top can be upgraded');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`building check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`building OK — ${ok.length} assertions`);

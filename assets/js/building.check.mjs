// Self-checks for the base building pieces: node assets/js/building.check.mjs

import { BUILD_TIERS, BUILD_TIER_ORDER, BUILD_UPGRADES, TUNING, ITEM_DEFS, CRAFT_RECIPES } from './content.js';
import { shadowCells } from './building.js';
import { KIND as WALL } from './pieces/wall.js';
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
const zRun = WALL.cells(4, 10, 7, 1);
check(zRun.every(([, b]) => Math.abs((b.maxX - b.minX) - TH) < 1e-9), 'a z wall is thin on x');
check(new Set(zRun.map(([k]) => k.split(',')[0])).size === 1, 'a z wall sits in a single x column');

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
const lengthwise = shoot(woodCells, [0.5, 11.5, 7.5], [1, 0, 0]);
check(Math.abs(lengthwise - Math.pow(BUILD_TIERS.wood.transmission, TUNING.BUILD_WALL_W)) < 1e-6,
  `a lengthwise shot transmits ${lengthwise.toFixed(3)}`);
check(Math.abs(shoot(woodCells, [0.5, 11.5, 7.5], [-1, 0, 0]) - 1) < 1e-9,
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

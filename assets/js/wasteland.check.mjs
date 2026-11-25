import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MACHINE_BY_ID, BARREL_LOOT, SCRAP_RECYCLE_TABLE, rollWeighted } from './content.js';

const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');


function functionOf(name) {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is present in game.js`);
  const open = src.indexOf('{', at);
  let depth = 0, quote = '', escape = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
}

let seed = 1234;

const hash3 = (x, y, z) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2246822519) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const game = new Function('hash3', 'WORLD_SEED', 'BARREL_CELL', 'BARREL_CHANCE',
  `let _barrelCells = new Map(), _barrelSeed = null;\n${functionOf('barrelHash')}\n${functionOf('barrelCell')}\nreturn { barrelCell };`)(hash3, seed, 24, 0.75);

const first = game.barrelCell(3, -7);
assert.deepEqual(game.barrelCell(3, -7), first, 'a barrel cell is deterministic');
assert.ok(first.every((b) => b.key.startsWith('3,-7:') && b.x >= 3 * 24 && b.x < 4 * 24 && b.z >= -7 * 24 && b.z < -6 * 24),
  'barrels stay inside their cell');
assert.ok(first.length >= 1 && first.length <= 4, 'a barrel cell holds 1..4 barrels');
assert.equal(new Set(first.map((b) => b.key)).size, first.length, 'keys are unique');

let filled = 0;
for (let cz = -12; cz < 12; cz++) for (let cx = -12; cx < 12; cx++) if (game.barrelCell(cx, cz).length) filled++;
const ratio = filled / (24 * 24);
assert.ok(ratio > 0.6 && ratio < 0.9, `barrels are common but not universal (${ratio.toFixed(2)})`);


const rec = MACHINE_BY_ID.recycler;
assert.equal(rec.kind, 'processor', 'recycler uses the existing processor runtime');
assert.ok(rec.randomOut === SCRAP_RECYCLE_TABLE && rec.recipes[0].in.scrap > 0, 'recycler consumes scrap and rolls the recycle table');
const machineSrc = readFileSync(new URL('./machines.js', import.meta.url), 'utf8');
assert.ok(machineSrc.includes('m.def.randomOut') && machineSrc.includes('rollWeighted(m.def.randomOut)'),
  'the machine runtime rolls randomOut at completion');


const common = SCRAP_RECYCLE_TABLE.filter(([id]) => id.endsWith('_ingot')).reduce((s, [, w]) => s + w, 0);
const rare = SCRAP_RECYCLE_TABLE.filter(([id]) => ['electric_motor', 'linear_actuator', 'machine_chassis'].includes(id)).reduce((s, [, w]) => s + w, 0);
assert.ok(common > rare * 10, 'ingots dominate the recycler, motors and actuators are rare');
assert.ok(BARREL_LOOT.length >= 20, 'barrels draw from a wide loot pool');
for (let i = 0; i < 200; i++) {
  const id = rollWeighted(BARREL_LOOT);
  assert.ok(BARREL_LOOT.some(([entry]) => entry === id), 'barrel roll is a pool item');
}

console.log('wasteland check passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_DEFS, MACHINE_BY_ID, BARREL_LOOT, SCRAP_RECYCLE_TABLE, rollWeighted } from './content.js';
import { MachineSystem } from './machines.js';

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
assert.equal(rec.kind, 'slot', 'recycler is a slot machine, not a workbench');
assert.ok(rec.energy?.use > 0, 'recycler needs power');
assert.ok(rec.randomOut === SCRAP_RECYCLE_TABLE && rec.recipes[0].in.scrap > 0, 'recycler consumes scrap and rolls the recycle table');
const machineSrc = readFileSync(new URL('./machines.js', import.meta.url), 'utf8');
assert.ok(machineSrc.includes('m.def.randomOut') && machineSrc.includes('rollWeighted(m.def.randomOut)'),
  'the machine runtime rolls randomOut at completion');
assert.ok(machineSrc.includes('this.startJobFromSlots(m, m.def.recipes[0])'),
  'the recycler runs straight from the scrap in its own slots');


const common = SCRAP_RECYCLE_TABLE.filter(([id]) => id.endsWith('_ingot')).reduce((s, [, w]) => s + w, 0);
const rare = SCRAP_RECYCLE_TABLE.filter(([id]) => ['electric_motor', 'linear_actuator', 'machine_chassis'].includes(id)).reduce((s, [, w]) => s + w, 0);
assert.ok(common > rare * 10, 'ingots dominate the recycler, motors and actuators are rare');
const chips = SCRAP_RECYCLE_TABLE.filter(([id]) => id.startsWith('circuit_')).reduce((s, [, w]) => s + w, 0);
assert.ok(chips > rare, 'chips turn up more often than motors');
assert.ok(BARREL_LOOT.length >= 20, 'barrels draw from a wide loot pool');
for (let i = 0; i < 200; i++) {
  const id = rollWeighted(BARREL_LOOT);
  assert.ok(BARREL_LOOT.some(([entry]) => entry === id), 'barrel roll is a pool item');
}

const sys = new MachineSystem({
  THREE: { Group: class { constructor() { this.children = []; } add(o) { this.children.push(o); } } },
  ITEMS: ITEM_DEFS, inv: { hot: [], main: [], sel: 0 }, scene: { add() {} }, ui: { setBridge() {} },
});
const machine = () => ({
  def: rec,
  state: { slots: { input0: { id: 'scrap', n: 2 } }, job: null, queue: [], progress: 0, status: 'IDLE', buffer: 1000 },
});
sys.openInst = machine();
assert.equal(sys.slotAccepts('input0', { id: 'scrap', n: 1 }), true, 'the recycler accepts scrap');
assert.equal(sys.slotAccepts('input0', { id: 'iron_ingot', n: 1 }), false, 'the recycler refuses everything but scrap');
const run = machine();
assert.equal(sys.startJobFromSlots(run, rec.recipes[0]), true, 'a job starts from the scrap in the slot');
assert.equal(run.state.slots.input0, null, 'starting a job consumes the scrap');
sys.tickProcessor(run, 5.1, null);
assert.equal(run.state.job, null, 'the job finishes');
assert.ok(run.state.slots.output0 && SCRAP_RECYCLE_TABLE.some(([id]) => id === run.state.slots.output0.id),
  'a pool item lands in an output slot');
assert.ok(run.state.buffer < 1000, 'the recycler draws power while running');
const stalled = machine();
stalled.state.job = { recipe: rec.recipes[0], t: 0 };
stalled.state.buffer = 0;
sys.tickProcessor(stalled, 0.5, null);
assert.equal(stalled.state.status, 'NO POWER', 'an unpowered recycler stalls');
assert.equal(stalled.state.slots.output0, undefined, 'a stalled recycler pays out nothing');

console.log('wasteland check passed');

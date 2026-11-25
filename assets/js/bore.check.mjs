

import { readFileSync } from 'node:fs';

const results = [];
function check(cond, msg) { results.push([!!cond, msg]); }

const src = readFileSync(new URL('./machines.js', import.meta.url), 'utf8');
const needle = 'if (this.ctx.mineDrops && this.ctx.groundBand) {';
const at = src.indexOf(needle, src.indexOf('tickBore(m, dt, net)'));
if (at < 0) throw new Error(`not found in machines.js: ${needle}`);
let depth = 0, quote = '', escape = false, end = -1;
for (let i = src.indexOf('{', at); i < src.length; i++) {
  const c = src[i];
  if (quote) {
    if (escape) escape = false;
    else if (c === '\\') escape = true;
    else if (c === quote) quote = '';
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
  if (c === '{') depth++;
  else if (c === '}' && --depth === 0) { end = i + 1; break; }
}
if (end < 0) throw new Error('unterminated drop block');
const collect = new Function('m', 'removed', 'st', 'fuelDef', src.slice(at, end));

function run(drops, count = 7, state = {}) {
  const system = {
    ctx: { groundBand: () => 'stone', mineDrops: drops },
    out: [],
    addOutput(m, id, n) { this.out.push([id, n]); },
  };
  collect.call(system, {}, Array.from({ length: count }, (_, i) => [i, 10, i]), state, { carbon: 12 });
  return system.out;
}

check(run(() => [['stone', 1], ['iron', 1]]).every(([id, n], i, a) => a.length === 7 && id === 'iron' && n === 1),
  'every carved voxel rolls its ore');
check(run(() => [['stone', 1]]).length === 0, 'stone is never stored');
check(run(() => [['dirt', 1]]).length === 0, 'dirt is never stored');
check(run(() => [['basalt', 1], ['uranium', 2]]).every(([id, n]) => id === 'uranium' && n === 2),
  'only ore amounts are kept');
check(run(() => [['stone', 1], ['copper', 1]], 1).length === 1, 'one voxel yields one ore, not a random sample');
check(run(() => [['stone', 1], ['iron', 2]], 2, { collect: false }).length === 0, 'pick-up off keeps nothing');
const fuelState = { burnCarbon: true };
const mixed = run(() => [['stone', 1], ['carbon', 3], ['iron', 2]], 1, fuelState);
check(mixed.length === 1 && mixed[0][0] === 'iron', 'carbon used as fuel is not stored as ore');
check(fuelState.fuelBuf === 36, 'carbon found becomes fuel');
const quiet = { collect: false, burnCarbon: true };
check(run(() => [['stone', 1], ['carbon', 2], ['copper', 1]], 1, quiet).length === 0 && quiet.fuelBuf === 24,
  'carbon still fuels the bore while pick-up is off');

let failed = 0;
for (const [ok, msg] of results) { if (!ok) failed++; console.log(`${ok ? 'ok' : 'FAIL'} ${msg}`); }
if (failed) process.exit(1);

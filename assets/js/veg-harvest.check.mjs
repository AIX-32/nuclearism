import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
function extract(name) {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is present in game.js`);
  const open = source.indexOf('{', at);
  let depth = 0, quote = '', escape = false, end = -1;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
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
  assert.ok(end > 0, `${name} closes`);
  return source.slice(at, end);
}

const finish = new Function('task', 'deps', `
  const { vegPickupIndex, worldPickups, outlineTargets, vegRemove, _vegHarvested } = deps;
  ${extract('_vegFinishLayer')}
  _vegFinishLayer(task);
`);

const sp = { n: 'grass_tall', pickup: { itemId: 'herb' } };
const pl = { sp };
const pickup = {
  __vegKey: '1,2:grass_tall',
  mesh: { parent: { remove() {} }, userData: { outlineRoot: null } },
};
const deps = {
  vegPickupIndex: () => new Map([[pickup.__vegKey, pickup]]),
  worldPickups: [pickup],
  outlineTargets: [],
  vegRemove: () => {},
  _vegHarvested: new Set(),
};
finish({ active: new Map([['1,2', pl]]), keep: new Set(), pickups: null }, deps);

assert.equal(deps.worldPickups.length, 0, 'the stale pickup is removed when the cell streams out');
assert.equal(deps._vegHarvested.size, 0, 'streaming out of range must not harvest the cell');


const kept = { ...pickup, mesh: { parent: { remove() {} }, userData: { outlineRoot: null } } };
const keptDeps = { ...deps, worldPickups: [kept], _vegHarvested: new Set() };
keptDeps.vegPickupIndex = () => new Map([[kept.__vegKey, kept]]);
finish({ active: new Map([['1,2', pl]]), keep: new Set(['1,2']), pickups: null }, keptDeps);
assert.equal(keptDeps.worldPickups.length, 1, 'a cell still in range keeps its pickup');


const cards = source.slice(source.indexOf('async function loadCardModel('), source.indexOf('async function loadVegModel('));
assert.match(cards, /mesh\.frustumCulled = false;/, 'card meshes must not be frustum culled after instances move');

console.log('veg-harvest check ok: streamed-out plants regrow and card layers stay visible');

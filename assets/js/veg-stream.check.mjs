import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Pull the real functions out of game.js rather than copying their logic.
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

// --- a stream is never restarted while one is still running -----------------
const beginCalls = [], steps = [];
let completeOnStep = false;
const vegUpdate = new Function(`${extract('vegUpdate')}\nreturn vegUpdate;`)();

globalThis._vegGX = NaN;
globalThis._vegGZ = NaN;
globalThis._vegPendingX = NaN;
globalThis._vegPendingZ = NaN;
globalThis._vegStreamTask = null;
globalThis._vegBeginStream = (x, z) => {
  beginCalls.push([x, z]);
  globalThis._vegStreamTask = { layer: 'canopy' };
};
globalThis.vegStreamStep = (ms) => {
  steps.push(ms);
  if (completeOnStep) globalThis._vegStreamTask = null;
};
globalThis.VEG_SPECIES = [];
globalThis.vegUpdateInstances = () => {};
globalThis.vegPerf = { inst: 0 };

vegUpdate(0, 0);
assert.equal(beginCalls.length, 1, 'the first update starts a stream');
assert.equal(steps.length, 0, 'the new stream is stepped on the next frame, not twice in one');

// Moving within one 16 m cell changes nothing.
vegUpdate(9, 0);
assert.equal(beginCalls.length, 1, 'a short move does not queue a restart');
assert.equal(steps.length, 1, 'the running stream gets one step');

// Crossing while a stream runs records the position but does not discard work.
vegUpdate(17, 0);
vegUpdate(33, 0);
assert.equal(beginCalls.length, 1, 'no restart while the current stream is active');

// Once it finishes, the latest pending position is used, not the first one.
completeOnStep = true;
vegUpdate(49, 0);
assert.equal(beginCalls.length, 2, 'a finished stream is followed by a new one');
assert.deepEqual(beginCalls[1], [49, 0], 'the newest position wins');
assert.ok(steps.every((ms) => ms <= 3), 'the per-frame stream budget stays small');

// --- pickups are found by key, not by a linear scan -------------------------
const vegPickupIndex = new Function(`${extract('vegPickupIndex')}\nreturn vegPickupIndex;`)();
globalThis.worldPickups = [
  { __vegKey: '0,0:1', n: 1 },
  { __vegKey: '1,0:1', n: 1 },
  { __vegKey: '0,0:1', n: 1 },
];
const idx = vegPickupIndex();
assert.equal(idx.size, 2, 'one entry per distinct key');
assert.equal(idx.get('1,0:1').n, 1);
assert.ok(!source.slice(source.indexOf('function _vegFinishLayer('), source.indexOf('function vegStreamStep(')).includes('worldPickups.find'), 'culling does not linearly search pickups');
const regAt = source.indexOf('function registerPickup(');
const regBody = source.slice(regAt, source.indexOf('function registerMachine('));
assert.ok(!regBody.includes('scene.add(pickup.mesh)'), 'invisible pickup hit targets are kept out of the scene graph');
assert.ok(regBody.includes('updateMatrixWorld()'), 'detached hit targets still get their raycast matrix updated');

// --- vegetation resolves against the cached analytic surface ----------------
let surface = 10;
globalThis.WORLD_SEED = 0;
globalThis.groundYAt = () => surface;
globalThis.terrainTrend = () => surface;
globalThis.world = {
  field: { sample: (x, y, z) => (y <= surface ? 1 : -1) },
  surfaceY: (x, z, fromY) => surface,
};
const vegSurfaceY = new Function(`${extract('vegSurfaceY')}\nreturn vegSurfaceY;`)();
assert.ok(Math.abs(vegSurfaceY(3, 4) - 10) < 0.3, 'refines the cached height onto the real surface');

// A raised fill outside the narrow band still falls back to the full march.
globalThis.groundYAt = () => 10;
globalThis.world.field.sample = (x, y, z) => (y <= 20 ? 1 : -1);
globalThis.world.surfaceY = () => 20;
assert.equal(vegSurfaceY(3, 4), 20, 'an edited surface outside the band uses the full march');

console.log('veg-stream check passed');

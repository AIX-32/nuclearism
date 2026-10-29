

import assert from 'node:assert/strict';
import { MAP_CHUNK, chunkCoord, chunkKey, keyToChunk, worldToScreen, screenToWorld, gridStep } from './map.js';

assert.equal(MAP_CHUNK, 16);
assert.equal(chunkCoord(0), 0);
assert.equal(chunkCoord(15.99), 0);
assert.equal(chunkCoord(16), 1);
assert.equal(chunkCoord(-0.1), -1);
assert.equal(chunkCoord(-16), -1);
assert.equal(chunkCoord(-16.1), -2);

for (const [cx, cz] of [[0, 0], [1, -1], [-32768, 32767], [32767, -32768], [-1234, 9876]]) {
  assert.deepEqual(keyToChunk(chunkKey(cx, cz)), [cx, cz], `chunk key round-trip ${cx},${cz}`);
}


const high = chunkKey(1, 0);
assert.ok(high > 0x7fffffff, 'chunk keys span uint32, not int32');
assert.deepEqual(keyToChunk(high >>> 0), [1, 0], 'unsigned restore keeps east chunks');

const view = { x: 123.5, z: -88.25, scale: 1.4 };
const w = 1180, h = 780;
for (const [x, z] of [[0, 0], [123.5, -88.25], [-2000, 3000]]) {
  const s = worldToScreen(x, z, view, w, h);
  const back = screenToWorld(s.x, s.y, view, w, h);
  assert.ok(Math.abs(back.x - x) < 1e-9 && Math.abs(back.z - z) < 1e-9, `projection round-trip ${x},${z}`);
}
const centre = worldToScreen(view.x, view.z, view, w, h);
assert.deepEqual(centre, { x: w / 2, y: h / 2 });


for (const scale of [0.04, 0.2, 0.6, 1.4, 3, 8, 10]) {
  const step = gridStep(scale);
  assert.ok(step * scale >= 44 || step === 4096, `grid step readable at ${scale}`);
  assert.ok(step >= gridStep(scale * 2), `grid step shrinks when zooming in at ${scale}`);
}
assert.equal(gridStep(10), 8);

console.log('map.check: ok');

import assert from 'node:assert/strict';
import { createRealisticTerrain } from './terrain-realistic.js';

const a = createRealisticTerrain(42);
const b = createRealisticTerrain(42);
const c = createRealisticTerrain(43);

assert.equal(a.height(123.5, -456.25), b.height(123.5, -456.25), 'same seed is deterministic');
assert.notEqual(a.height(123.5, -456.25), c.height(123.5, -456.25), 'seed changes the terrain');

let min = Infinity, max = -Infinity;
for (let i = 0; i < 4000; i++) {
  const h = a.height(i * 7.3 - 8000, i * 11.7 + 3000);
  assert.ok(Number.isFinite(h), `finite at sample ${i}`);
  min = Math.min(min, h);
  max = Math.max(max, h);
}
assert.ok(min > 0 && max < 400, `height bounds ${min.toFixed(1)}..${max.toFixed(1)}`);

let worst = 0;
for (let x = -1000; x < 1000; x += 2) worst = Math.max(worst, Math.abs(a.height(x, 40) - a.height(x + 2, 40)));
assert.ok(worst < 20, `continuity: ${worst.toFixed(1)} m per 2 m step`);

a.recenter(1000, 1000);
assert.equal(a.height(1000, 1000), a.height(1000, 1000), 'height is stable after recenter');
const h = a.height(1000, 1000);
for (const surf of ['grass', 'snow', 'sand', 'dry', 'ash']) {
  const m = a.surface(1000, 1000, h, surf);
  for (const k of ['rock', 'snow']) assert.ok(m[k] >= 0 && m[k] <= 1, `${k} in range for ${surf}`);
}
const color = a.mapColor(1000, 1000, h, { top: [0.1, 0.2, 0.3] });
assert.equal(color.length, 3);
assert.ok(color.every((v) => v >= 0 && v <= 1), 'map colour in range');

console.log(`terrain realistic OK (height ${min.toFixed(1)}..${max.toFixed(1)} m, max step ${worst.toFixed(1)} m)`);

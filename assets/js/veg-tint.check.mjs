import assert from 'node:assert/strict';
import { VEG_TINT_SOURCE, normalizedTint, srgbToLinear, vegTint } from './veg-tint.js';


const src = VEG_TINT_SOURCE.savanna;
const tint = vegTint('savanna');
assert.ok(tint, 'the savanna has a vegetation tint');
assert.equal(src.length, 3, 'the source colour is rgb');


assert.ok(Math.abs(srgbToLinear(255) - 1) < 1e-6, 'white stays white');
assert.ok(Math.abs(srgbToLinear(0) - 0) < 1e-9, 'black stays black');
assert.ok(srgbToLinear(128) < 0.3, 'a mid grey is much darker in linear space');



assert.ok(Math.abs(Math.max(...tint) - 1) < 1e-9, 'the strongest tint channel is 1');
assert.ok(tint.every((c) => c > 0 && c <= 1), 'a tint never brightens a plant');


assert.ok(Math.abs(tint[0] / tint[2] - srgbToLinear(src[0]) / srgbToLinear(src[2])) < 1e-9,
  'the tint keeps the source hue');
assert.ok(tint[0] > tint[1] && tint[1] > tint[2], 'dry grass is warm: red > green > blue');
assert.ok(tint[2] < 0.3, 'dry grass kills the blue in a plant');


assert.equal(vegTint('plains'), null);


assert.deepEqual(normalizedTint([0, 0, 0]), [1, 1, 1]);

console.log('veg-tint.check: ok');

import assert from 'node:assert/strict';
import { VEG_TINT_SOURCE, normalizedTint, srgbToLinear, vegTint } from './veg-tint.js';

// The savanna tint exists and comes from the dry grass texture.
const src = VEG_TINT_SOURCE.savanna;
const tint = vegTint('savanna');
assert.ok(tint, 'the savanna has a vegetation tint');
assert.equal(src.length, 3, 'the source colour is rgb');

// The source is an sRGB pixel and the shader multiplies in linear space.
assert.ok(Math.abs(srgbToLinear(255) - 1) < 1e-6, 'white stays white');
assert.ok(Math.abs(srgbToLinear(0) - 0) < 1e-9, 'black stays black');
assert.ok(srgbToLinear(128) < 0.3, 'a mid grey is much darker in linear space');

// It shifts the hue only: the strongest channel is untouched, so the tint can
// never brighten a plant, and the luminance barely moves.
assert.ok(Math.abs(Math.max(...tint) - 1) < 1e-9, 'the strongest tint channel is 1');
assert.ok(tint.every((c) => c > 0 && c <= 1), 'a tint never brightens a plant');

// The tint keeps the hue of the source colour it was taken from.
assert.ok(Math.abs(tint[0] / tint[2] - srgbToLinear(src[0]) / srgbToLinear(src[2])) < 1e-9,
  'the tint keeps the source hue');
assert.ok(tint[0] > tint[1] && tint[1] > tint[2], 'dry grass is warm: red > green > blue');
assert.ok(tint[2] < 0.3, 'dry grass kills the blue in a plant');

// A biome with no entry keeps the plant's own colours.
assert.equal(vegTint('plains'), null);

// A black or empty source cannot tint anything.
assert.deepEqual(normalizedTint([0, 0, 0]), [1, 1, 1]);

console.log('veg-tint.check: ok');

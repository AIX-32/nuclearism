
import assert from 'node:assert/strict';
import { RAD_OCCL, sourcePoint, transmission, shaftBurial, relativeBearing, compass } from './radiation.js';


const a = sourcePoint(1234);
const b = sourcePoint(1234);
assert.deepEqual(a, b, 'source point is deterministic');
assert.ok(Math.abs(Math.hypot(a.x, a.z) - 240) < 1e-9, 'source sits at the tuned distance');
const c = sourcePoint(9999);
assert.ok(a.x !== c.x || a.z !== c.z, 'a different seed moves the source');


const open = () => 1;
assert.equal(transmission(open, 0, 0, 0, 1, 0, 0), 1, 'open air transmits fully');


const wall = (x) => (x > 4 && x < 12 ? RAD_OCCL.solid : 1);
const t = transmission(wall, 0, 0, 0, 1, 0, 0);
assert.ok(t < 1 && t > 0, 'a wall reduces transmission without blocking it entirely');
assert.equal(transmission(open, 0, 0, 0, 1, 0, 0, { samples: 4, range: 10, solid: 0.5 }), 1);


const behind = transmission((x) => (x < -4 && x > -12 ? RAD_OCCL.solid : 1), 0, 0, 0, 1, 0, 0);
assert.equal(behind, 1, 'only the direction of the source is shadowed');


const buried = transmission(() => RAD_OCCL.solid, 0, 0, 0, 1, 0, 0);
assert.ok(buried > 0 && buried < 0.2, 'solid rock shields most of the field');

const near = (x, y) => Math.abs(x - y) < 1e-6;
assert.equal(shaftBurial(0, 1, 1), 1, 'an open-air player gets the full field');
assert.ok(near(shaftBurial(10, 1e-12, 1), Math.pow(0.45, 10)), 'a sealed hole keeps the depth shield');
assert.equal(shaftBurial(10, 1, 1), 1, 'an open shaft sweeps the field down to the player');
assert.ok(near(shaftBurial(10, 1, 1e-8), Math.pow(0.45, 10)), 'a roof or closed door over the hole keeps the depth shield');
assert.ok(near(shaftBurial(10, 1, 0.55), 0.55), 'a weak cover gives a weak shield');
assert.ok(shaftBurial(50, 1, 1) === 1 && shaftBurial(10, 1.5, 2) === 1, 'exposure is clamped to the full field');


assert.ok(near(relativeBearing(0, -1, 0), 0), 'source straight ahead reads 0');
assert.ok(near(relativeBearing(1, 0, 0), 90), 'source to the east reads +90');
assert.ok(near(relativeBearing(0, 1, 0), 180), 'source behind reads 180');


assert.equal(compass(0, -1), 'N');
assert.equal(compass(1, 0), 'E');
assert.equal(compass(0, 1), 'S');
assert.equal(compass(-1, 0), 'W');

assert.ok(RAD_OCCL.samples > 0 && RAD_OCCL.range > 0 && RAD_OCCL.solid > 0 && RAD_OCCL.solid < 1);

console.log('radiation.check: ok');

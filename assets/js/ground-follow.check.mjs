import fs from 'node:fs';
import assert from 'node:assert/strict';


const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const speed = src.match(/const GROUND_FOLLOW_SPEED = ([\d.]+);/);
const snap = src.match(/const gy = groundY\(\);[\s\S]*?if \(gy !== null && player\.pos\.y - gy <= GROUND_FOLLOW_SPEED \* dt\) \{[\s\S]*?\n        \}/);
assert(speed && snap, 'rate-limited ground follow not found in game.js');

const frame = new Function('player', 'dt', 'groundY', `
  const GROUND_FOLLOW_SPEED = ${speed[1]};
  player.onGround = false; // movePlayer clears this before the branch runs
  ${snap[0]}
`);
const body = (y) => ({ pos: { y }, onGround: false, vel: { y: -0.4 } });


let p = body(1);
frame(p, 1 / 60, () => 0.95);
assert.equal(p.pos.y, 0.95, 'a small drop snaps to the ground');
assert.equal(p.onGround, true, 'a followed step is grounded');
assert.equal(p.vel.y, 0, 'a followed step cancels vertical speed');


p = body(1);
frame(p, 1 / 60, () => 0.4);
assert.equal(p.pos.y, 1, 'a big drop is not snapped down');
assert.equal(p.onGround, false, 'a big drop leaves the body airborne');
assert.equal(p.vel.y, -0.4, 'a big drop keeps falling speed');


p = body(1);
frame(p, 1 / 60, () => 0.8);
assert.equal(p.pos.y, 0.8, 'a drop at the cap still follows');
p = body(1);
frame(p, 0.05, () => 0.5);
assert.equal(p.pos.y, 0.5, 'a longer frame allows a longer step');
p = body(1);
frame(p, 1 / 60, () => null);
assert.equal(p.pos.y, 1, 'no ground means no snap');

console.log('ground-follow check ok: short steps follow, big drops fall');

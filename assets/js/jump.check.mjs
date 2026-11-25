import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const rearm = src.match(/if \(!keys\.Space\) jumpUsed = false;/);
const jump = src.match(/if \(!inWater && keys\.Space && !jumpUsed && player\.onGround\) \{[\s\S]*?sliding = false;\s*\}/);
assert(rearm && jump, 'jump charge logic not found in game.js');


const frame = new Function('state', 'space', 'onGround', `
  const keys = { Space: space };
  const vitals = state.vitals;
  const player = { onGround, vel: { y: 0 } };
  const inWater = false;
  let sliding = false;
  let jumpUsed = state.jumpUsed;
  ${rearm[0]}
  ${jump[0]}
  state.jumpUsed = jumpUsed;
`);

const state = { jumpUsed: false, vitals: { hunger: 100 } };
for (let i = 0; i < 120; i++) frame(state, true, true);
assert.equal(state.vitals.hunger, 99, 'holding Space must charge only one jump');

for (let i = 0; i < 5; i++) frame(state, false, true);
assert.equal(state.vitals.hunger, 99, 'releasing Space must not charge a jump');
frame(state, true, true);
assert.equal(state.vitals.hunger, 98, 'a new hold charges one jump');

console.log('jump check ok: one hunger charge per Space hold');

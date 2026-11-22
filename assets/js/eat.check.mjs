import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';



const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');

assert.match(src, /const EAT_TIME = [\d.]+;/, 'eating has a duration');
assert.ok(
  /def\.consumable\.food && !propModels\.has\(s\.id\)[\s\S]{0,80}startEat\(/.test(src),
  'a flat-icon food is eaten over time, not instantly',
);
assert.ok(
  /eat\.t >= EAT_TIME[\s\S]{0,160}applyConsumable\(/.test(src),
  'the food effects land when the last bite is gone',
);
assert.match(src, /heldIconU\.uCut\.value = 1\.15 - u \* 1\.3/, 'the cut sweeps the whole icon');
assert.match(src, /vUv\.y > edge/, 'the top of the icon is the part that disappears');
assert.match(src, /jag \* 0\.14/, 'the cut line is jagged, not straight');

console.log('eat check passed');

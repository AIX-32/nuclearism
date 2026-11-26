import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const climb = src.match(/const onLadder = !inWater && ladderUnderBody\(\);[\s\S]*?fallPeak = 0;\s*\}/);
assert(climb, 'ladder climb branch not found in game.js');

const frame = new Function('ladderNear', 'w', 's', `
  const inWater = false;
  const keys = { KeyW: w, KeyS: s };
  const player = { vel: { y: -8 } };
  let fallPeak = 7;
  const ladderUnderBody = () => ladderNear;
  const LADDER_SPEED = 3.2;
  ${climb[0]}
  return { y: player.vel.y, fallPeak };
`);

assert.deepEqual(frame(true, true, false), { y: 3.2, fallPeak: 0 }, 'W climbs up and cancels fall damage');
assert.deepEqual(frame(true, false, true), { y: -3.2, fallPeak: 0 }, 'S climbs down slowly without fall damage');
assert.deepEqual(frame(true, false, false), { y: 0, fallPeak: 0 }, 'letting go holds on the ladder');
assert.deepEqual(frame(false, true, false), { y: -8, fallPeak: 7 }, 'away from a ladder gravity is untouched');

const detect = src.match(/function ladderUnderBody\(\) \{[\s\S]*?\n    \}/);
assert(detect, 'ladderUnderBody not found in game.js');

const detectFrame = new Function('pieces', 'px', 'py', 'pz', 'yaw', `
  const buildingSystem = { pieces: new Map(pieces.map((p, i) => [i, p])) };
  const player = { pos: { x: px, y: py, z: pz }, yaw, radius: 0.35, height: 1.72 };
  ${detect[0]}
  return ladderUnderBody();
`);
const ladder = { kind: 'ladder', x: 4, y: 0, z: 7 };
assert.equal(detectFrame([ladder], 4.5, 1, 8.3, 0), true, 'facing a nearby ladder grabs it');
assert.equal(detectFrame([ladder], 4.5, 1, 8.3, Math.PI), false, 'a ladder behind you does not hijack movement');
assert.equal(detectFrame([ladder], 10, 1, 8.3, 0), false, 'a distant ladder is ignored');
assert.equal(detectFrame([ladder], 4.5, 3.1, 8.3, 0), false, 'the ladder ends at three metres');
assert.equal(detectFrame([{ kind: 'wall', x: 4, y: 0, z: 7 }], 4.5, 1, 8.3, 0), false, 'other pieces are not ladders');

console.log('ladder climb OK: W up, S down, no fall damage, facing gate, gravity off-ladder intact');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transmission } from './radiation.js';

// Extract the real occlusion helper from game.js rather than copying its maths.
const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const at = source.indexOf('function wrapperSoundBlocked(');
assert.ok(at >= 0, 'wrapperSoundBlocked is present in game.js');
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
assert.ok(end > 0, 'wrapperSoundBlocked closes');

const player = { pos: { x: 0, y: 0, z: 0 } };
let solid = () => -1;
const world = { field: { get: (x, y, z) => solid(x, y, z) } };
let shadow = () => 1;
const buildingSystem = { shadow: (...a) => shadow(...a) };
const solidAt = (field, x, y, z) => field.get(Math.round(x), Math.round(y), Math.round(z)) > 0;
const blocked = new Function('player', 'world', 'buildingSystem', 'solidAt', 'transmission',
  `${source.slice(at, end)}\nreturn wrapperSoundBlocked;`)(player, world, buildingSystem, solidAt, transmission);

// A wrapper on the surface directly overhead is audible with clear sky.
const above = { x: 0, y: 3, z: 0 };
assert.equal(blocked(above), false, 'clear line of sight is audible');

// Dirt between the player and the wrapper mutes it.
solid = (x, y) => y >= 1 && y <= 2 ? 1 : -1;
assert.equal(blocked(above), true, 'dirt roof blocks the sound');
solid = () => -1;

// A bunker piece between them mutes it too, even with clear sky.
shadow = () => 0.01;
assert.equal(blocked(above), true, 'bunker roof blocks the sound');
assert.equal(blocked({ x: 0, y: 0, z: 5 }), true, 'bunker wall blocks the sound');

// Open air again: no mute.
shadow = () => 1;
assert.equal(blocked(above), false, 'clear sky is audible again');
assert.equal(blocked({ x: 0, y: 0, z: 5 }), false, 'clear ground path is audible');

console.log('wrapper-sound check passed');

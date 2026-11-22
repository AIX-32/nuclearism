import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';



const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const at = source.indexOf('function structureCollidesBody(');
assert.ok(at >= 0, 'structureCollidesBody is present in game.js');
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
assert.ok(end > 0, 'structureCollidesBody closes');
const structureCollidesBody = new Function(`${source.slice(at, end)}\nreturn structureCollidesBody;`)();

const R = 0.35, H = 1.72;
const machine = { x: 0, y: 0, z: 0, top: 1.45, hx: 1, hz: 0.6 };
const hitMachine = (x, y, z, machines = [machine]) =>
  structureCollidesBody(x, y, z, R, H, machines, []);


assert.equal(hitMachine(0, 1.4, 0), true, 'feet below the top collide');

assert.equal(hitMachine(0, 1.45, 0), false, 'feet at the top do not collide');
assert.equal(hitMachine(0, 2.0, 0), false, 'body above the top is clear');
assert.equal(hitMachine(0, 0, 0), true, 'body inside the footprint collides');


assert.equal(hitMachine(1.3, 0, 0), true, 'a radius crossing the face collides');
assert.equal(hitMachine(1.4, 0, 0), false, 'a body past radius + face is clear');


const overhead = { x: 0, y: 3, z: 0, top: 4, hx: 1, hz: 1 };
assert.equal(hitMachine(0, 2.5, 0, [overhead]), true, 'head hits a machine above');
assert.equal(hitMachine(0, 1.0, 0, [overhead]), false, 'body under a high machine is clear');


const box = { kind: 'box', x: 10, z: 0, base: 0, top: 3, hx: 2, hz: 1 };
const hitBox = (x, y, z) => structureCollidesBody(x, y, z, R, H, [], [box]);
assert.equal(hitBox(10, 0, 0), true, 'industrial box blocks through the body');
assert.equal(hitBox(10, 3, 0), false, 'standing on an industrial box is clear');


const mask = { minX: 0, minZ: 0, cell: 1, rows: 2, cols: 2, data: [1, 0, 0, 0] };
const wall = { kind: 'mask', x: 20, z: 0, s: 1, base: 0, top: 3, cos: 1, sin: 0, mask };
const hitWall = (x, y, z) => structureCollidesBody(x, y, z, R, H, [], [wall]);
assert.equal(hitWall(20.5, 0, 0.5), true, 'an occupied mask cell blocks');
assert.equal(hitWall(22.5, 0, 0.5), false, 'an empty mask cell does not');
assert.equal(hitWall(20.5, 3, 0.5), false, 'above the mask height is clear');

console.log('collision check passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const source = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const at = source.indexOf('function terrainBlockLift(');
assert.ok(at >= 0, 'terrainBlockLift is present in game.js');
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
assert.ok(end > 0, 'terrainBlockLift closes');

let ceiling = null;
const world = { field: { sample: (x, y, z) => {
  if (ceiling && y >= ceiling[0] && y <= ceiling[1]) return 1;
  return y <= 0.05 ? 1 : -1;
} } };
const player = { pos: { x: 0, y: 0, z: 0 }, radius: 0.35, height: 1.72 };
const lift = new Function('player', 'world', `${source.slice(at, end)}\nreturn terrainBlockLift;`)(player, world);



const centred = lift({ x: 0, y: 0, z: 0 }, 2);
assert.ok(centred > 1.2 && centred < 1.7, 'lifts to the filled surface, not the sphere edge');
assert.ok(centred < 2.05, 'does not over-lift to the geometric top');
assert.equal(player.pos.y, 0, 'the helper does not move the player itself');


assert.equal(lift({ x: 10, y: 0, z: 0 }, 2), 0, 'a distant block needs no lift');


const edge = lift({ x: 1.5, y: 0, z: 0 }, 2);
assert.ok(edge > 0.6 && edge < 1.0, 'lifts only as far as the overlapping column fills');
assert.ok(edge < centred, 'an offset block lifts less than a centred one');



ceiling = [2, 2.5];
assert.equal(lift({ x: 0, y: 0, z: 0 }, 2), null, 'a ceiling above the block refuses it');
assert.equal(player.pos.y, 0, 'a refused lift restores the player');

console.log('terrain-place check passed');

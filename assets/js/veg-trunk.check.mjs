import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';


const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const at = src.indexOf('function vegTrunkRadius(');
assert.ok(at >= 0, 'vegTrunkRadius is present in game.js');
const open = src.indexOf('{', at);
let depth = 0, quote = '', escape = false, end = -1;
for (let i = open; i < src.length; i++) {
  const c = src[i];
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
assert.ok(end > 0, 'vegTrunkRadius closes');
const vegTrunkRadius = new Function(`${src.slice(at, end)}\nreturn vegTrunkRadius;`)();


const ring = (radius, y, count, cx = 0, cz = 0) => {
  const a = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    a.push(cx + Math.cos(t) * radius, y, cz + Math.sin(t) * radius);
  }
  return a;
};
const part = (arr) => ({ geo: { attributes: { position: { array: new Float32Array(arr) } } } });


const bark = part([...ring(0.05, 0, 20), ...ring(0.05, 0.03, 20)]);
const roots = part([...ring(0.5, 0.1, 8), ...ring(0.5, 0.14, 8)]);
assert.ok(Math.abs(vegTrunkRadius([bark, roots], 0, 0, 0, 1) - 0.05) < 0.002,
  'flared roots and low branches do not inflate the bark radius');


const stray = part([...ring(0.05, 0, 24), 0.6, 0, 0]);
assert.ok(Math.abs(vegTrunkRadius([stray], 0, 0, 0, 1) - 0.05) < 0.002,
  'one far-out vertex at the base does not inflate the bark radius');


const thick = part(ring(0.22, 0, 40));
assert.ok(Math.abs(vegTrunkRadius([thick], 0, 0, 0, 1) - 0.22) < 0.002,
  'a genuinely thick trunk keeps its radius');


assert.equal(vegTrunkRadius([part(ring(0.3, 0.5, 20))], 0, 0, 0, 1), 0,
  'a model with no base vertices yields radius zero');

console.log('veg trunk radius check passed');

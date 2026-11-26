import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('./settings.js', import.meta.url), 'utf8');
const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
assert.match(settings, /id: 'laptopMode'[^\n]*type: 'toggle'[^\n]*def: false/);
assert.match(src, /getSetting\('laptopMode'\)/);
assert.match(src, /id === 'laptopMode'\) laptopMode = v/);
assert.match(src, /e\.code === 'KeyQ' \|\| \(laptopMode && e\.code === 'KeyX'\)/);

function block(start) {
  const i = src.indexOf(start);
  assert.notEqual(i, -1, `missing: ${start}`);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error('unbalanced block');
}

const events = [];
globalThis.MouseEvent = class { constructor(type, init) { this.type = type; this.button = init.button; } };
const renderer = { domElement: { dispatchEvent: (ev) => events.push(ev) } };
globalThis.window = { dispatchEvent: (ev) => events.push(ev) };
const down = new Function('e', 'locked', 'laptopMode', 'renderer', block('if (laptopMode && locked && !e.repeat &&'));
const up = new Function('e', 'laptopMode', 'window', block('if (laptopMode && (e.code ==='));

down({ code: 'KeyQ', repeat: false }, true, true, renderer);
down({ code: 'KeyE', repeat: false }, true, true, renderer);
down({ code: 'KeyE', repeat: true }, true, true, renderer);
down({ code: 'KeyQ', repeat: false }, true, false, renderer);
down({ code: 'KeyQ', repeat: false }, false, true, renderer);
up({ code: 'KeyQ' }, true, window);
up({ code: 'KeyE' }, true, window);
assert.deepEqual(events.map((e) => [e.type, e.button]), [
  ['mousedown', 0], ['mousedown', 2], ['mouseup', 0], ['mouseup', 2],
]);

console.log(`laptop-mode: ${events.length} key/click mappings ok`);

// node assets/js/settings.check.mjs
// Self-checks for the shared settings store: defaults, legacy stores, clamping,
// persistence and reset. The DOM parts of settings.js are exercised in-browser.

import assert from 'node:assert/strict';

const store = { data: {} };
globalThis.localStorage = {
  getItem: (k) => (k in store.data ? store.data[k] : null),
  setItem: (k, v) => { store.data[k] = String(v); },
  removeItem: (k) => { delete store.data[k]; },
};
globalThis.document = { addEventListener() {} };

let n = 0;
async function load(seed) {
  store.data = seed ? { 'idte.settings.v1': JSON.stringify(seed) } : {};
  return import(`./settings.js?case=${n++}`);
}

// defaults
{
  const S = await load(null);
  assert.equal(S.getSetting('renderDistance'), 3);
  assert.equal(S.getSetting('resolution'), 3);
  assert.equal(S.getSetting('colorLevels'), 32);
  assert.equal(S.getSetting('fov'), 72);
  assert.equal(S.getSetting('vsync'), true);
  assert.equal(S.getSetting('infoHud'), false);
  assert.equal(S.getSetting('sensitivity'), 1);
  assert.equal(S.getSetting('invertY'), false);
  assert.equal(S.getSetting('volume'), 1);
}

// a store written by the old (pre-shared-module) settings menu still loads
{
  const S = await load({ renderDistance: 6, infoHud: true, vsync: false, volume: 0.5 });
  assert.equal(S.getSetting('renderDistance'), 6);
  assert.equal(S.getSetting('infoHud'), true);
  assert.equal(S.getSetting('vsync'), false);
  assert.equal(S.getSetting('volume'), 0.5);
}

// ranges clamp and snap to the step; choices fall back to the default
{
  const S = await load(null);
  S.setSetting('volume', 5);
  assert.equal(S.getSetting('volume'), 1);
  S.setSetting('volume', -2);
  assert.equal(S.getSetting('volume'), 0);
  S.setSetting('volume', 0.37);
  assert.equal(S.getSetting('volume'), 0.35);
  S.setSetting('fov', 500);
  assert.equal(S.getSetting('fov'), 110);
  S.setSetting('renderDistance', 5);
  assert.equal(S.getSetting('renderDistance'), 3);
}

// changes persist and reach the listeners
{
  const S = await load(null);
  const seen = [];
  S.onSettingsChange((id, v) => seen.push([id, v]));
  S.setSetting('invertY', true);
  assert.deepEqual(seen, [['invertY', true]]);
  assert.equal(JSON.parse(store.data['idte.settings.v1']).invertY, true);
}

// a slider drag applies without writing, and persists when asked
{
  const S = await load(null);
  S.setSetting('sensitivity', 1.5, false);
  assert.equal(S.getSetting('sensitivity'), 1.5);
  assert.equal(store.data['idte.settings.v1'], undefined);
  S.setSetting('sensitivity', 1.5, true);
  assert.equal(JSON.parse(store.data['idte.settings.v1']).sensitivity, 1.5);
}

// reset restores the defaults and notifies
{
  const S = await load(null);
  S.setSetting('volume', 0.2);
  S.setSetting('renderDistance', 64);
  S.resetSettings();
  assert.equal(S.getSetting('volume'), 1);
  assert.equal(S.getSetting('renderDistance'), 3);
  assert.equal(JSON.parse(store.data['idte.settings.v1']).volume, 1);
}

console.log('settings.check: ok');

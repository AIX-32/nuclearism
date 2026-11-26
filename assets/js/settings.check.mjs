



import assert from 'node:assert/strict';

const mem = { kv: {} };

function makeReq(result) {
  const req = { result, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
  return req;
}

function makeTx() {
  const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
  queueMicrotask(() => tx.oncomplete && tx.oncomplete());
  return tx;
}

globalThis.indexedDB = {
  open() {
    const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    queueMicrotask(() => {
      const db = {
        objectStoreNames: { contains: (n) => n === 'kv' },
        createObjectStore() {},
        onversionchange: null,
        close() {},
        transaction() {
          const tx = makeTx();
          return {
            objectStore() {
              return {
                get(key) { return makeReq(Object.prototype.hasOwnProperty.call(mem.kv, key) ? mem.kv[key] : undefined); },
                put(val, key) { mem.kv[key] = val; return makeReq(key); },
                delete(key) { delete mem.kv[key]; return makeReq(undefined); },
              };
            },
            set oncomplete(fn) { tx.oncomplete = fn; },
            get oncomplete() { return tx.oncomplete; },
            set onerror(fn) { tx.onerror = fn; },
            get onerror() { return tx.onerror; },
            set onabort(fn) { tx.onabort = fn; },
            get onabort() { return tx.onabort; },
          };
        },
      };
      req.result = db;
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      req.onsuccess && req.onsuccess({ target: req });
    });
    return req;
  },
};

globalThis.document = { addEventListener() {} };

const flush = () => new Promise((r) => setTimeout(r, 10));

let n = 0;
async function load(seed) {
  mem.kv = seed ? { 'idte.settings.v1': seed } : {};
  return import(`./settings.js?case=${n++}`);
}


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
  assert.equal(S.getSetting('laptopMode'), false);
  assert.equal(S.getSetting('volume'), 1);
}


{
  const S = await load({ renderDistance: 6, infoHud: true, vsync: false, volume: 0.5 });
  assert.equal(S.getSetting('renderDistance'), 6);
  assert.equal(S.getSetting('infoHud'), true);
  assert.equal(S.getSetting('vsync'), false);
  assert.equal(S.getSetting('volume'), 0.5);
}


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


{
  const S = await load(null);
  const seen = [];
  S.onSettingsChange((id, v) => seen.push([id, v]));
  S.setSetting('invertY', true);
  assert.deepEqual(seen, [['invertY', true]]);
  await flush();
  assert.equal(mem.kv['idte.settings.v1'].invertY, true);
}


{
  const S = await load(null);
  S.setSetting('sensitivity', 1.5, false);
  assert.equal(S.getSetting('sensitivity'), 1.5);
  await flush();
  assert.equal(mem.kv['idte.settings.v1'], undefined);
  S.setSetting('sensitivity', 1.5, true);
  await flush();
  assert.equal(mem.kv['idte.settings.v1'].sensitivity, 1.5);
}


{
  const S = await load(null);
  S.setSetting('volume', 0.2);
  S.setSetting('renderDistance', 64);
  await flush();
  S.resetSettings();
  assert.equal(S.getSetting('volume'), 1);
  assert.equal(S.getSetting('renderDistance'), 3);
  await flush();
  assert.equal(mem.kv['idte.settings.v1'], undefined);
}

console.log('settings.check: ok');

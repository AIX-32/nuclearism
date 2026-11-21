const DB_NAME = 'nuclearism';
const DB_VERSION = 1;
const STORE = 'kv';

let dbp = null;

function open() {
  if (dbp) return dbp;
  if (typeof indexedDB === 'undefined') {
    dbp = Promise.reject(new Error('indexedDB unavailable'));
    return dbp;
  }
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('idb open failed'));
    req.onblocked = () => console.warn('[idb] open blocked');
  }).catch((e) => {
    dbp = null;
    throw e;
  });
  return dbp;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('idb tx failed'));
    tx.onabort = () => reject(tx.error || new Error('idb tx aborted'));
  });
}

export async function idbGet(key) {
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    const val = await reqToPromise(req);
    return val === undefined ? null : val;
  } catch (e) {
    console.warn('[idb] get failed', key, e);
    return null;
  }
}

export async function idbSet(key, value) {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(value, key);
  await txDone(tx);
}

export async function idbRemove(key) {
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    await txDone(tx);
  } catch (e) {
    console.warn('[idb] remove failed', key, e);
  }
}

export async function idbEntries(prefix = '') {
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    if (typeof store.getAllKeys === 'function' && typeof store.getAll === 'function') {
      const [keys, vals] = await Promise.all([reqToPromise(store.getAllKeys()), reqToPromise(store.getAll())]);
      const out = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (typeof k === 'string' && k.startsWith(prefix)) out.push([k, vals[i]]);
      }
      return out;
    }
    return await new Promise((resolve, reject) => {
      const out = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve(out);
        if (typeof cur.key === 'string' && cur.key.startsWith(prefix)) out.push([cur.key, cur.value]);
        cur.continue();
      };
      req.onerror = () => reject(req.error || new Error('idb cursor failed'));
    });
  } catch (e) {
    console.warn('[idb] entries failed', prefix, e);
    return [];
  }
}

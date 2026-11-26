
export const REPLAY_VERSION = 3;
export const REPLAY_RATE = 30;
export const REPLAY_MIN_INTERVAL = 1 / REPLAY_RATE;
export const REPLAY_FRAME_STRIDE = 10;
export const REPLAY_FRAME_STRIDE_V1 = 8;
export const REPLAY_EDIT_STRIDE = 5;
export const REPLAY_STATE_KEYFRAME = 40;

export function createReplay(meta = {}) {
  return {
    v: REPLAY_VERSION,
    stride: REPLAY_FRAME_STRIDE,
    name: meta.name || 'REPLAY',
    created: meta.created || Date.now(),
    world: meta.world || '',
    seed: meta.seed ?? 0,
    day: meta.day ?? 1,
    dur: 0,
    held: [],
    f: [],
    e: [],
    s: [],
    a: [],
  };
}

function strideOf(r) { return r.stride || (r.v === 1 ? REPLAY_FRAME_STRIDE_V1 : REPLAY_FRAME_STRIDE); }

export function frameCount(r) {
  return (r.f.length / strideOf(r)) | 0;
}

export function editCount(r) {
  return (r.e.length / REPLAY_EDIT_STRIDE) | 0;
}

export function duration(r) {
  return r.dur || 0;
}

function heldIndex(r, id) {
  if (!id) return -1;
  let i = r.held.indexOf(id);
  if (i < 0) { i = r.held.length; r.held.push(id); }
  return i;
}



export function pushFrame(r, t, x, y, z, yaw, pitch, clockT, heldId, eye = 1.62, slideP = 0) {
  const n = r.f.length;
  const stride = strideOf(r);


  if (n >= stride && t - r.f[n - stride] < REPLAY_MIN_INTERVAL - 1e-6) return false;
  r.f.push(t, x, y, z, yaw, pitch, clockT, heldIndex(r, heldId), eye, slideP);
  if (t > r.dur) r.dur = t;
  return true;
}


export function pushEdit(r, t, x, y, z, v) {
  r.e.push(t, x, y, z, v);
  if (t > r.dur) r.dur = t;
}

// State snapshots are diffed against the previous one; a full keyframe every
// REPLAY_STATE_KEYFRAME entries keeps seeking cheap without storing the whole
// world state four times a second.
export function pushState(r, t, snap, full = false) {
  if (!r.s) r.s = [];
  const prev = r._lastState || {};
  const diff = {};
  for (const k of Object.keys(snap)) {
    if (snap[k] === undefined) continue;
    if (JSON.stringify(prev[k]) !== JSON.stringify(snap[k])) diff[k] = snap[k];
  }
  const keys = Object.keys(diff);
  const isFull = full || r.s.length === 0 || r.s.length % REPLAY_STATE_KEYFRAME === 0 || keys.length > 12;
  r.s.push([t, isFull ? { full: true, ...snap } : { d: diff }]);
  r._lastState = snap;
  if (t > r.dur) r.dur = t;
  return true;
}

export function pushEvent(r, t, type, data = null) {
  if (!r.a) r.a = [];
  r.a.push([t, type, data]);
  if (t > r.dur) r.dur = t;
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}



export function lerpAngle(a, b, k) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}


export function sampleAt(r, t) {
  const n = frameCount(r);
  if (!n) return null;
  const f = r.f;
  const stride = strideOf(r);
  if (t <= f[0]) return frame(r, 0);
  if (t >= f[(n - 1) * stride]) return frame(r, n - 1);

  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid * stride] <= t) lo = mid; else hi = mid;
  }
  const a = lo * stride, b = hi * stride;
  const t0 = f[a], t1 = f[b];
  const k = t1 - t0 > 1e-6 ? (t - t0) / (t1 - t0) : 0;
  return {
    x: lerp(f[a + 1], f[b + 1], k),
    y: lerp(f[a + 2], f[b + 2], k),
    z: lerp(f[a + 3], f[b + 3], k),
    yaw: lerpAngle(f[a + 4], f[b + 4], k),
    pitch: lerp(f[a + 5], f[b + 5], k),
    clockT: lerp(f[a + 6], f[b + 6], k),
    heldIdx: k < 0.5 ? f[a + 7] : f[b + 7],
    eye: stride >= 10 ? lerp(f[a + 8], f[b + 8], k) : 1.62,
    slideP: stride >= 10 ? lerp(f[a + 9], f[b + 9], k) : 0,
  };
}

function frame(r, i) {
  const stride = strideOf(r), a = i * stride, f = r.f;
  return {
    x: f[a + 1], y: f[a + 2], z: f[a + 3],
    yaw: f[a + 4], pitch: f[a + 5], clockT: f[a + 6], heldIdx: f[a + 7],
    eye: stride >= 10 ? f[a + 8] : 1.62,
    slideP: stride >= 10 ? f[a + 9] : 0,
  };
}



export function editIndexAt(r, t) {
  const n = editCount(r);
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r.e[mid * REPLAY_EDIT_STRIDE] <= t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function editAt(r, i) {
  const a = i * REPLAY_EDIT_STRIDE, e = r.e;
  return { t: e[a], x: e[a + 1], y: e[a + 2], z: e[a + 3], v: e[a + 4] };
}

export function heldId(r, idx) {
  return idx >= 0 && idx < r.held.length ? r.held[idx] : null;
}

function countAt(arr, t, stride) {
  const n = (arr.length / stride) | 0;
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid * stride] <= t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function pairIndexAt(arr, t) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid][0] <= t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function stateIndexAt(r, t) {
  return pairIndexAt(r.s || [], t);
}

export function stateAt(r, t) {
  const s = r.s || [];
  if (!s.length) return null;
  let idx = stateIndexAt(r, t) - 1;
  if (idx < 0) return null;
  let start = idx;
  while (start > 0 && !s[start][1].full) start--;
  let out = {};
  for (let i = start; i <= idx; i++) {
    const entry = s[i][1];
    if (entry.full) {
      out = { ...entry };
      delete out.full;
    } else if (entry.d) {
      for (const k of Object.keys(entry.d)) {
        if (entry.d[k] === null) delete out[k]; else out[k] = entry.d[k];
      }
    }
  }
  return out;
}

export function eventIndexAt(r, t) {
  return pairIndexAt(r.a || [], t);
}

export function eventAt(r, i) {
  const e = (r.a || [])[i];
  return e ? { t: e[0], type: e[1], data: e[2] } : null;
}



const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : B64[b2 & 63];
  }
  return out;
}

export function b64ToBytes(str) {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
  const n = (clean.length * 3) >> 2;
  const out = new Uint8Array(n);
  let acc = 0, bits = 0, p = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[p++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

function floatsToB64(arr) {
  const f = new Float32Array(arr);
  return bytesToB64(new Uint8Array(f.buffer));
}

function b64ToFloats(str) {
  const bytes = b64ToBytes(str);
  const f = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
  return Array.from(f);
}

function textToB64(str) {
  return bytesToB64(new TextEncoder().encode(str));
}

function b64ToText(str) {
  return new TextDecoder().decode(b64ToBytes(str));
}



export function packReplay(r) {
  return {
    v: r.v || REPLAY_VERSION,
    name: r.name,
    created: r.created,
    world: r.world,
    seed: r.seed,
    day: r.day,
    dur: r.dur,
    held: r.held.slice(),
    fb: floatsToB64(r.f),
    eb: floatsToB64(r.e),
    sb: r.s && r.s.length ? textToB64(JSON.stringify(r.s)) : '',
    ab: r.a && r.a.length ? textToB64(JSON.stringify(r.a)) : '',
  };
}

export function unpackReplay(o) {
  if (!o || (o.v !== 1 && o.v !== 2 && o.v !== REPLAY_VERSION)) return null;
  const r = createReplay(o);
  r.v = o.v;
  r.stride = o.v === 1 ? REPLAY_FRAME_STRIDE_V1 : REPLAY_FRAME_STRIDE;
  r.held = Array.isArray(o.held) ? o.held.slice() : [];
  r.f = o.fb ? b64ToFloats(o.fb) : [];
  r.e = o.eb ? b64ToFloats(o.eb) : [];
  r.dur = o.dur || 0;
  try { r.s = o.sb ? JSON.parse(b64ToText(o.sb)) : []; } catch { r.s = []; }
  try { r.a = o.ab ? JSON.parse(b64ToText(o.ab)) : []; } catch { r.a = []; }
  if (!Array.isArray(r.s)) r.s = [];
  if (!Array.isArray(r.a)) r.a = [];
  return r;
}


export function replayBytes(packed) {
  if (!packed) return 0;
  return (packed.fb?.length || 0) + (packed.eb?.length || 0)
    + (packed.sb?.length || 0) + (packed.ab?.length || 0)
    + JSON.stringify(packed.held || []).length + 200;
}

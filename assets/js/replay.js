// Replay data model: recording, sampling, packing.
//
// Pure: no DOM, no three.js, so `node assets/js/replay.check.mjs` can
// exercise every rule. The game wires it to the camera, the density field
// and the renderer; this file only knows what a replay *is*.
//
// A replay holds two flat float arrays:
//   frames: t, x, y, z, yaw, pitch, clockT, heldIdx, eye, slideP  (stride)
//   edits:  t, x, y, z, density                                   (REPLAY_EDIT_STRIDE)
// plus a small table of held item ids, so the viewmodel can be reproduced.
// eye/slideP keep the crouch/slide camera height and tilt (v2; v1 defaults).

export const REPLAY_VERSION = 2;
export const REPLAY_RATE = 30;            // recorded frames per second
export const REPLAY_MIN_INTERVAL = 1 / REPLAY_RATE;
export const REPLAY_FRAME_STRIDE = 10;
export const REPLAY_FRAME_STRIDE_V1 = 8;
export const REPLAY_EDIT_STRIDE = 5;

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

// Records one camera sample. Samples closer together than the replay rate are
// dropped, so a 144 fps game still records 30 fps of motion.
export function pushFrame(r, t, x, y, z, yaw, pitch, clockT, heldId, eye = 1.62, slideP = 0) {
  const n = r.f.length;
  const stride = strideOf(r);
  // The epsilon keeps a timer that ticks exactly on the interval from being
  // dropped by floating point drift (which would halve the effective rate).
  if (n >= stride && t - r.f[n - stride] < REPLAY_MIN_INTERVAL - 1e-6) return false;
  r.f.push(t, x, y, z, yaw, pitch, clockT, heldIndex(r, heldId), eye, slideP);
  if (t > r.dur) r.dur = t;
  return true;
}

// Records one density edit (a mined or placed voxel).
export function pushEdit(r, t, x, y, z, v) {
  r.e.push(t, x, y, z, v);
  if (t > r.dur) r.dur = t;
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

// Yaw is an angle: interpolate the short way round so a turn past +/-PI does
// not spin the camera the long way.
export function lerpAngle(a, b, k) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// The camera state at time t. Frames are linearly interpolated.
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

// How many edits have happened at or before time t. Edits are pushed in
// chronological order, so this is a binary search.
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

/* ---------- packing ---------- */

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

// A replay is stored packed: the float arrays become base64 so a ten minute
// recording is a few hundred KB instead of a few MB of JSON numbers.
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
  };
}

export function unpackReplay(o) {
  if (!o || (o.v !== 1 && o.v !== REPLAY_VERSION)) return null;
  const r = createReplay(o);
  r.v = o.v;
  r.stride = o.v === 1 ? REPLAY_FRAME_STRIDE_V1 : REPLAY_FRAME_STRIDE;
  r.held = Array.isArray(o.held) ? o.held.slice() : [];
  r.f = o.fb ? b64ToFloats(o.fb) : [];
  r.e = o.eb ? b64ToFloats(o.eb) : [];
  r.dur = o.dur || 0;
  return r;
}

// Rough stored size in bytes, for the replay list.
export function replayBytes(packed) {
  if (!packed) return 0;
  return (packed.fb?.length || 0) + (packed.eb?.length || 0) + JSON.stringify(packed.held || []).length + 200;
}

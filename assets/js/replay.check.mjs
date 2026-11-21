// Self-check for the replay data model. Run: node assets/js/replay.check.mjs
import {
  createReplay, pushFrame, pushEdit, frameCount, editCount, duration,
  sampleAt, editIndexAt, editAt, heldId, packReplay, unpackReplay,
  replayBytes, lerpAngle, REPLAY_MIN_INTERVAL,
} from './replay.js';

let fails = 0;
function ok(cond, why) {
  if (!cond) { fails++; console.error('FAIL:', why); }
}
function near(a, b, eps = 1e-4) { return Math.abs(a - b) <= eps; }

const r = createReplay({ name: 'T', world: 'w', seed: 7, day: 3 });

// --- frame rate limiting ---
ok(pushFrame(r, 0, 0, 0, 0, 0, 0, 0, 'pick'), 'first frame accepted');
ok(!pushFrame(r, 0.001, 0, 0, 0, 0, 0, 0, 'pick'), 'sub-interval frame dropped');
ok(pushFrame(r, REPLAY_MIN_INTERVAL, 1, 0, 0, 0, 0, 0, 'pick'), 'frame at interval accepted');
ok(frameCount(r) === 2, 'frame count');
ok(duration(r) > 0, 'duration tracks the last frame');

// --- sampling ---
const s = createReplay();
pushFrame(s, 0, 0, 10, 0, 0, 0, 0, 'axe');
pushFrame(s, 1, 10, 20, 0, Math.PI / 2, 0, 100, 'axe');
const mid = sampleAt(s, 0.5);
ok(near(mid.x, 5), 'x interpolated');
ok(near(mid.y, 15), 'y interpolated');
ok(near(mid.yaw, Math.PI / 4), 'yaw interpolated');
ok(near(mid.clockT, 50), 'clock interpolated');
ok(sampleAt(s, -1).x === 0, 'before start clamps');
ok(sampleAt(s, 99).x === 10, 'after end clamps');
ok(sampleAt(createReplay(), 0) === null, 'empty replay has no sample');

// --- slide/crouch camera state (v2) ---
const cam = createReplay();
pushFrame(cam, 0, 0, 0, 0, 0, 0, 0, 'pick', 1.62, 0);
pushFrame(cam, 1, 0, 0, 0, 0, 0, 0, 'pick', 1.02, 0.14);
const cs = sampleAt(cam, 0.5);
ok(near(cs.eye, 1.32), 'eye height interpolated');
ok(near(cs.slideP, 0.07), 'slide pitch interpolated');
ok(near(sampleAt(s, 0.5).eye, 1.62), 'missing eye defaults to standing');
ok(near(sampleAt(s, 0.5).slideP, 0), 'missing slide pitch defaults to 0');

// --- yaw takes the short way round ---
ok(near(lerpAngle(3.0, -3.0, 0.5), Math.PI, 1e-3), 'yaw wraps the short way');

// --- edits ---
const e = createReplay();
pushEdit(e, 0.5, 1, 2, 3, -1);
pushEdit(e, 1.5, 4, 5, 6, 0.9);
pushEdit(e, 2.5, 7, 8, 9, 0.25);
ok(editCount(e) === 3, 'edit count');
ok(editIndexAt(e, 0.4) === 0, 'no edits at 0.4');
ok(editIndexAt(e, 0.5) === 1, 'one edit at 0.5');
ok(editIndexAt(e, 9) === 3, 'all edits at the end');
ok(editAt(e, 1).x === 4, 'edit payload');
ok(duration(e) === 2.5, 'duration tracks edits too');

// --- held item table ---
const h = createReplay();
pushFrame(h, 0, 0, 0, 0, 0, 0, 0, 'pick');
pushFrame(h, 1, 0, 0, 0, 0, 0, 0, 'axe');
pushFrame(h, 2, 0, 0, 0, 0, 0, 0, 'pick');
ok(h.held.length === 2, 'held ids are deduplicated');
ok(heldId(h, 0) === 'pick' && heldId(h, 1) === 'axe', 'held id lookup');
ok(heldId(h, 99) === null, 'unknown held id is null');
ok(sampleAt(h, 1.4).heldIdx === 1, 'held id follows the nearest frame');

// --- pack / unpack round trip ---
const packed = packReplay(h);
ok(typeof packed.fb === 'string' && packed.fb.length > 0, 'frames are packed');
const back = unpackReplay(packed);
ok(back && back.f.length === h.f.length, 'frame count survives packing');
ok(near(back.f[1], 0, 1e-6), 'frame values survive packing');
ok(back.held.join(',') === h.held.join(','), 'held table survives packing');
ok(unpackReplay({ v: 99 }) === null, 'a foreign version is rejected');
ok(replayBytes(packed) > 0, 'size estimate');

// --- v1 replays still play (standing defaults) ---
const v1r = createReplay();
v1r.v = 1; v1r.stride = 8; v1r.held = ['pick'];
v1r.f = [0, 1, 2, 3, 0, 0, 0, 0, 1, 4, 5, 6, 0, 0, 0, 0];
v1r.dur = 1;
const v1p = packReplay(v1r);
ok(v1p.v === 1, 'v1 packs as v1');
const v1b = unpackReplay(v1p);
ok(v1b && frameCount(v1b) === 2, 'v1 unpacks');
ok(near(sampleAt(v1b, 0).eye, 1.62) && near(sampleAt(v1b, 0).slideP, 0), 'v1 defaults eye/slide');

// a long replay stays small: 10 minutes of frames is ~720 KB of floats
const big = createReplay();
for (let i = 0; i < 30 * 600; i++) pushFrame(big, i / 30, i * 0.01, 0, 0, 0, 0, 0, 'pick');
ok(frameCount(big) === 30 * 600, 'ten minutes records at the replay rate');
const bigPacked = packReplay(big);
ok(bigPacked.fb.length < 1100000, 'a ten minute replay packs under ~1.1 MB');

console.log(fails ? `replay.check FAIL (${fails})` : 'replay.check PASS');
process.exit(fails ? 1 : 0);

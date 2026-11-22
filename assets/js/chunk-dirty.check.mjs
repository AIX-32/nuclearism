




import { readFileSync } from 'node:fs';

const results = [];
function check(cond, msg) { results.push([!!cond, msg]); }

const src = readFileSync(new URL('./game.js', import.meta.url), 'utf8');


function bodyOf(needle) {
  const at = src.indexOf(needle);
  if (at < 0) throw new Error(`not found in game.js: ${needle}`);
  const open = src.indexOf('{', at + needle.length - 1);
  let depth = 0, quote = '', escape = false;
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
    else if (c === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  throw new Error(`unterminated body: ${needle}`);
}


const CHUNK_SIZE = 16;
const dirtyRange = new Function('CHUNK_SIZE', `return function dirtyRange(lo, hi, pad) {${bodyOf('dirtyRange(lo, hi, pad) {')}};`)(CHUNK_SIZE);




function affectedChunks(lo, hi) {
  const out = [];
  for (let c = Math.floor((lo - 1) / CHUNK_SIZE); c <= Math.floor((hi + 1) / CHUNK_SIZE); c++) out.push(c);
  return out;
}
function rangeOf(lo, hi, pad = 0) {
  const [a, b] = dirtyRange(lo, hi, pad);
  const out = [];
  for (let c = a; c <= b; c++) out.push(c);
  return out;
}
function sameSet(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

for (const [lo, hi] of [[20, 20], [16, 16], [15, 15], [31, 31], [0, 0], [12, 34], [-3, 5], [100, 100]]) {
  check(sameSet(rangeOf(lo, hi), affectedChunks(lo, hi)),
    `dirty range ${lo}..${hi} matches the chunk frame rule`);
}



check(rangeOf(20, 20).length === 1, 'a block in the middle of a chunk dirties one chunk');
check(rangeOf(16, 16).length === 2, 'a block on a chunk border dirties the neighbour too');
check(rangeOf(20, 20).length < 9, 'a single block no longer dirties 27 chunks');


check(rangeOf(0, 32, 1).length > rangeOf(0, 32, 0).length, 'the padded range is wider than the exact one');


const SAMPLE_SIZE = CHUNK_SIZE + 2;
const S2 = SAMPLE_SIZE * SAMPLE_SIZE;
const TOTAL = SAMPLE_SIZE * SAMPLE_SIZE * SAMPLE_SIZE;

const loadSlice = new Function('SAMPLE_SIZE', 'S2', 'industrialPadAt',
  `return function loadSlice(count) {${bodyOf('loadSlice(count) {')}};`)(SAMPLE_SIZE, S2, () => null);
const refreshPending = new Function('SAMPLE_SIZE', 'S2', 'CHUNK_SIZE',
  `return function refreshPending() {${bodyOf('refreshPending() {')}};`)(SAMPLE_SIZE, S2, CHUNK_SIZE);


const density = (x, y, z) => x * 1000 + y * 7 + z * 0.5;

function fakeChunk() {
  return {
    samples: new Float32Array(TOTAL),
    world: { field: { valueAtPadded: (x, y, z) => density(x, y, z), valueAt: (x, y, z) => density(x, y, z) } },
    ox: 32, oy: -16, oz: 48,
    samplePos: 0, samplesLoaded: false, pending: [],
    updateSurface() {
      let mn = Infinity, mx = -Infinity;
      for (const v of this.samples) { if (v < mn) mn = v; if (v > mx) mx = v; }
      this.hasSurface = !(mn > 0 || mx < 0);
    },
  };
}


function referenceGrid() {
  const s = new Float32Array(TOTAL);
  const { ox, oy, oz } = fakeChunk();
  for (let k = -1; k <= CHUNK_SIZE; k++)
    for (let j = -1; j <= CHUNK_SIZE; j++)
      for (let i = -1; i <= CHUNK_SIZE; i++)
        s[(i + 1) + (j + 1) * SAMPLE_SIZE + (k + 1) * S2] = density(ox + i, oy + j, oz + k);
  return s;
}

const oneShot = fakeChunk();
while (!loadSlice.call(oneShot, TOTAL)) {                                }
check(oneShot.samplesLoaded, 'the sample grid reports itself loaded');
let same = oneShot.samples.length === referenceGrid().length;
for (let i = 0; same && i < oneShot.samples.length; i++) {
  if (oneShot.samples[i] !== referenceGrid()[i]) same = false;
}
check(same, 'the sliced loader fills the same grid as the nested loop');

const sliced = fakeChunk();
let guard = 0;
while (!sliced.samplesLoaded && guard++ < 100) loadSlice.call(sliced, 1200);
let same2 = true;
const ref = referenceGrid();
for (let i = 0; i < sliced.samples.length; i++) if (sliced.samples[i] !== ref[i]) { same2 = false; break; }
check(same2 && sliced.samplesLoaded, 'the grid is the same when it is loaded in slices');
check(guard > 1, 'the load really is spread over several slices');



const racing = fakeChunk();
racing.pending.push([36, 38, -14, -12, 51, 53]);
while (!racing.samplesLoaded && guard++ < 200) loadSlice.call(racing, 600);
check(racing.pending.length === 1, 'an edit that lands during the load is not dropped');


const edited = fakeChunk();
while (!loadSlice.call(edited, TOTAL)) {                 }
const before = Float32Array.from(edited.samples);
edited.pending.push([32 + 4, 32 + 6, -16 + 2, -16 + 4, 48 + 3, 48 + 5]);
edited.world.field.valueAt = (x, y, z) => density(x, y, z) + 1000;
edited.world.field.valueAtPadded = (x, y, z) => density(x, y, z) + 1000;
refreshPending.call(edited);
let touched = 0, wrong = 0;
for (let k = -1; k <= CHUNK_SIZE; k++)
  for (let j = -1; j <= CHUNK_SIZE; j++)
    for (let i = -1; i <= CHUNK_SIZE; i++) {
      const at = (i + 1) + (j + 1) * SAMPLE_SIZE + (k + 1) * S2;
      const inBox = 32 + i >= 36 && 32 + i <= 38 && -16 + j >= -14 && -16 + j <= -12
        && 48 + k >= 51 && 48 + k <= 53;
      if (edited.samples[at] !== before[at]) {
        touched++;
        if (!inBox) wrong++;
      }
    }
check(touched > 0, 'an edit re-reads the edited voxels');
check(wrong === 0, 'an edit leaves the rest of the grid alone');
check(edited.pending.length === 0, 'the pending edit list is cleared after the refresh');

let pass = 0;
for (const [ok, msg] of results) {
  if (ok) pass++;
  else console.log(`FAIL: ${msg}`);
}
console.log(`chunk dirty check ${results.length === pass ? 'OK' : 'failed'}: ${pass}/${results.length}`);
if (pass !== results.length) process.exit(1);

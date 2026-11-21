// Far-terrain seam checks: node assets/js/far-terrain.check.mjs
// The fake horizon rings have to continue the ground the player is standing
// on. They used to sit a flat 6 m under the terrain trend, so where the
// detailed chunks ended the world visibly dropped off in a straight line in
// front of the player, and a cliff down to a smoothed world sat just beyond
// it. These checks run the real game.js helpers against the real chunk
// layout.

import { readFileSync } from 'node:fs';

const results = [];
function check(cond, msg) { results.push([!!cond, msg]); }

const gameSource = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
function gameFunction(name) {
  const at = gameSource.indexOf(`function ${name}(`);
  if (at < 0) return '';
  const open = gameSource.indexOf('{', at);
  let depth = 0, quote = '', escape = false;
  for (let i = open; i < gameSource.length; i++) {
    const c = gameSource[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return gameSource.slice(at, i + 1);
  }
  throw new Error(`unterminated game function ${name}`);
}
function gameConst(name) {
  const m = gameSource.match(new RegExp(`const ${name} = ([^;]+);`));
  if (!m) throw new Error(`missing game const ${name}`);
  return m[1].trim();
}
function gameRuntime(names, scope) {
  const keys = Object.keys(scope);
  const body = names.map(gameFunction).join('\n');
  return new Function(...keys, `${body}\nreturn { ${names.join(',')} };`)(...keys.map((k) => scope[k]));
}

const CHUNK_SIZE = Number(gameConst('CHUNK_SIZE'));
const DETAIL_CHUNK_RADIUS = Number(gameConst('DETAIL_CHUNK_RADIUS'));
const FAR_RING_BLEND = Number(gameConst('FAR_RING_BLEND'));
const FAR_HAZE_REACH = Number(gameConst('FAR_HAZE_REACH'));

const { farRingEdge, farRingBeyond, farRingBlendWeight } = gameRuntime(
  ['farRingEdge', 'farRingBeyond', 'farRingBlendWeight'],
  { DETAIL_CHUNK_RADIUS, CHUNK_SIZE, FAR_RING_BLEND },
);

// The detailed chunks span centre-96 .. centre+112 in both axes: the chunk
// columns are pcx-6 .. pcx+6 and the chunk next to the player's own starts
// at the player's chunk origin.
const EDGE_NEG = DETAIL_CHUNK_RADIUS * CHUNK_SIZE;
const EDGE_POS = (DETAIL_CHUNK_RADIUS + 1) * CHUNK_SIZE;
check(EDGE_NEG === 96 && EDGE_POS === 112, `detail square is -96..+112 (got -${EDGE_NEG}..+${EDGE_POS})`);

const centre = 0;
// Inside the detail square the ring keeps the real ground.
check(farRingEdge(-16, centre) === EDGE_NEG, `near side of the detail square ends at ${EDGE_NEG}`);
check(farRingEdge(16, centre) === EDGE_POS, `far side of the detail square ends at ${EDGE_POS}`);
check(farRingBeyond(0, 0, centre, centre) < 0, 'the player stands inside the detail square');
check(farRingBeyond(-EDGE_NEG + 1, 0, centre, centre) < 0, 'a cell inside the detail square is inside it');
check(farRingBeyond(EDGE_POS - 1, 0, centre, centre) < 0, 'the far cell of the detail square is inside it');
check(farRingBeyond(EDGE_POS + 1, 0, centre, centre) === 1, 'a cell past the detail edge is 1 m outside it');
check(farRingBeyond(-EDGE_NEG - 1, 0, centre, centre) === 1,
  'a cell past the near edge is outside it (the square is asymmetric)');

// The blend: at the edge the ring is still the real ground, and it eases into
// the smooth trend over the next 48 m. No jump at the edge, no cliff.
check(farRingBlendWeight(0) === 0, 'the ring keeps the real ground at the detail edge');
check(farRingBlendWeight(-40) === 0, 'the ring keeps the real ground inside the detail square');
check(farRingBlendWeight(FAR_RING_BLEND) === 1, 'the ring is fully on the trend at the end of the blend');
let prev = -Infinity, monotone = true;
for (let d = 0; d <= FAR_RING_BLEND; d += 2) {
  const w = farRingBlendWeight(d);
  if (w < prev) monotone = false;
  prev = w;
}
check(monotone, 'the blend weight rises monotonically, so the seam cannot jump');

// The haze has to finish at the outer edge of the visible range, or the fake
// terrain ends on a hard line, but it must not swallow the middle of the
// horizon: the fade is a fourth power over the range.
check(FAR_HAZE_REACH >= 5, `far haze reaches the rim (FAR_HAZE_REACH=${FAR_HAZE_REACH})`);

// The far plane only reaches the screen if the projection matrix is rebuilt
// when it changes. The camera is built with a 400 m plane; the game sets
// camera.far every frame, and without the rebuild the world is clipped a few
// hundred metres out (which is why changing the FOV "fixed" the horizon:
// that path rebuilds the projection).
const farAssign = gameSource.indexOf('camera.far = far;');
check(farAssign > 0, 'the frame loop sets the camera far plane');
check(farAssign > 0 && gameSource.slice(farAssign, farAssign + 200).includes('updateProjectionMatrix'),
  'the projection matrix is rebuilt when the far plane changes');

let failed = 0;
for (const [ok, msg] of results) {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
}
console.log(`${results.length - failed}/${results.length} far-terrain checks passed`);
process.exit(failed ? 1 : 0);

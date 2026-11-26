
// Self-check for the large hadron collider: the real tick body is extracted from
// machines.js and run in node, so the 4%-per-minute rule is checked against the
// shipped code, not a copy of it.
import { existsSync, readFileSync } from 'node:fs';
import { MACHINE_BY_ID, ITEM_DEFS, GUIDE_STEPS, ACHIEVEMENT_TYPES } from './content.js';

const results = [];
function check(cond, msg) { results.push([!!cond, msg]); }

const src = readFileSync(new URL('./machines.js', import.meta.url), 'utf8');
const start = src.indexOf('tickCollider(m, dt, net) {');
check(start >= 0, 'tickCollider is present in machines.js');
let depth = 0, quote = '', escape = false, body = '';
const open = src.indexOf('{', start);
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
  else if (c === '}') { depth--; if (!depth) { body = src.slice(open + 1, i); break; } }
}
check(!!body, 'tickCollider body extracted from source');
const tick = body ? new Function('m', 'dt', 'net', body) : () => {};

function rig(opts = {}) {
  const st = {
    slots: opts.feed === null ? {} : { fuel: { id: opts.feed || 'proton_canister', n: 10 } },
    burnT: 0, progress: 0, status: '', burning: false,
    buffer: opts.buffer === undefined ? 1e9 : opts.buffer,
  };
  const m = {
    state: st, spinNodes: [],
    def: { kind: 'collider', spinRate: 12, collider: { period: 60, chance: 0.04, feed: 'proton_canister', out: 'antimatter', startPower: 5000 } },
  };
  const sys = {
    ITEMS: { antimatter: { name: 'ANTIMATTER' } },
    notices: [], crafts: [], outputs: [],
    powered: opts.powered !== false,
    room: opts.room !== false,
    notice(s) { this.notices.push(s); },
    onCraft(id, n) { this.crafts.push([id, n]); },
    useRate() { return 12000; },
    drawPower() { return this.powered; },
    outputsHaveRoom() { return this.room; },
    addOutput(mm, id, n) { this.outputs.push([id, n]); },
  };
  sys.ctx = sys;
  return { st, sys, run: (dt = 1) => tick.call(sys, m, dt, {}) };
}

function withRoll(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = original; }
}

let t = rig();
for (let i = 0; i < 59; i++) t.run();
check(t.sys.outputs.length === 0 && t.st.slots.fuel.n === 10 && Math.abs(t.st.burnT - 59) < 1e-6,
  '59 powered seconds do not roll and keep the feed');
check(t.st.burning && /NEXT ROLL 1S/.test(t.st.status), 'running collider reports the next roll');
t.run();
check(t.st.burnT === 0 && t.st.slots.fuel.n === 9 && t.sys.outputs.length === 0,
  'a miss consumes one canister and resets the minute');

withRoll(0.01, () => {
  const hit = rig();
  for (let i = 0; i < 60; i++) hit.run();
  check(hit.sys.outputs.length === 1 && hit.sys.outputs[0][0] === 'antimatter' && hit.sys.outputs[0][1] === 1,
    'a hit adds exactly one antimatter to its own output slots');
  check(hit.st.status === 'ANTIMATTER PRODUCED' && hit.sys.crafts.length === 1 && hit.sys.notices.length === 1,
    'a hit reports the craft and notices the player');
  check(hit.st.slots.fuel.n === 9 && hit.st.burnT === 0, 'a hit still eats one canister per minute');
});

withRoll(0.04, () => {
  const edge = rig();
  for (let i = 0; i < 60; i++) edge.run();
  check(edge.sys.outputs.length === 0, '4% exactly is a miss (chance < 0.04)');
});
withRoll(0.03999, () => {
  const edge = rig();
  for (let i = 0; i < 60; i++) edge.run();
  check(edge.sys.outputs.length === 1, 'just under 4% is a hit');
});

const dark = rig({ powered: false });
withRoll(0.01, () => { for (let i = 0; i < 120; i++) dark.run(); });
check(dark.st.burnT === 0 && dark.st.status === 'NO POWER' && !dark.st.burning && dark.st.slots.fuel.n === 10,
  'unpowered time never accrues a roll or eats feed');

const empty = rig({ feed: null });
withRoll(0.01, () => { for (let i = 0; i < 120; i++) empty.run(); });
check(empty.st.burnT === 0 && empty.st.status === 'NO PROTON FEED', 'no feed stops the clock');

const wrong = rig({ feed: 'water' });
wrong.run();
check(wrong.st.status === 'NO PROTON FEED' && wrong.st.burnT === 0, 'only proton canisters feed the beam');

const full = rig({ room: false });
withRoll(0.01, () => { for (let i = 0; i < 120; i++) full.run(); });
check(full.st.status === 'OUTPUT FULL' && full.st.burnT === 0 && full.st.slots.fuel.n === 10 && full.sys.outputs.length === 0,
  'a full output pauses the clock without wasting feed');

const low = rig({ buffer: 4999 });
withRoll(0.01, () => { for (let i = 0; i < 120; i++) low.run(); });
check(low.st.burnT === 0 && low.st.status === 'NEEDS 5000 POWER' && !low.st.burning
  && low.st.slots.fuel.n === 10 && low.sys.outputs.length === 0,
  'below 5000 PU it does not start, advance the clock or eat feed');
const charged = rig({ buffer: 5000 });
withRoll(0.99, () => { for (let i = 0; i < 60; i++) charged.run(); });
check(charged.st.status === 'NO ANTIMATTER · FEED SPENT' && charged.st.slots.fuel.n === 9 && charged.sys.outputs.length === 0,
  'exactly 5000 PU is enough to start and run a full minute');

const def = MACHINE_BY_ID.lhc;
check(!!def && def.kind === 'collider', 'the collider is registered as its own machine kind');
check(def?.collider?.period === 60 && def?.collider?.chance === 0.04, 'the data says one roll per 60 s at 4%');
check(def?.collider?.feed === 'proton_canister' && def?.collider?.out === 'antimatter', 'data feed and product match the run');
check((def?.energy?.use || 0) >= 10000, 'the collider draws an endgame amount of power');
check(def?.collider?.startPower === 5000, 'the collider needs 5000 PU before it starts');
const modelPath = new URL('../../assets/models/workbenches/lhc.gltf', import.meta.url);
check(existsSync(modelPath), 'the collider ships a real glTF model');
if (existsSync(modelPath)) {
  const gltf = JSON.parse(readFileSync(modelPath, 'utf8'));
  const torus = gltf.nodes?.find((n) => n.name === 'torus');
  check(!!torus && def?.spin === 'torus', 'the named ring node spins while running');
  if (torus) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const node of gltf.nodes.filter((n) => n.mesh !== undefined)) {
      const pos = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], pos.min[i] + (node.translation?.[i] || 0));
        hi[i] = Math.max(hi[i], pos.max[i] + (node.translation?.[i] || 0));
      }
    }
    const pos = gltf.accessors[gltf.meshes[torus.mesh].primitives[0].attributes.POSITION];
    const scale = (def.height * 1.45) / (hi[1] - lo[1]);
    const width = (pos.max[0] - pos.min[0]) * scale;
    check(Math.abs(width - 100) < 1, `the model scales to a 100 m ring (${width.toFixed(1)} m)`);
  }
}
check(!!ITEM_DEFS.antimatter && !!ITEM_DEFS.proton_canister && ITEM_DEFS.lhc?.workbench === 'lhc',
  'antimatter, the feedstock and the placeable block exist');
check(MACHINE_BY_ID.research_lab?.recipes?.some((r) => r.out?.blueprint_lhc), 'the collider blueprint is researched');
check(MACHINE_BY_ID.assembler?.recipes?.some((r) => r.out?.lhc && r.in?.blueprint_lhc), 'the assembler build needs the blueprint');
check(MACHINE_BY_ID.assembler?.recipes?.some((r) => r.out?.proton_canister), 'proton canisters are craftable');
check(GUIDE_STEPS[GUIDE_STEPS.length - 2]?.id === 'antimatter', 'antimatter is the last real guide step');
check(ACHIEVEMENT_TYPES.find((a) => a.id === 'atomics')?.tiers.some((tier) => tier.built === 'lhc'),
  'building the collider is an atomics achievement');
check(src.includes("def.kind === 'collider'") && src.includes('T.TorusGeometry'),
  'the placeholder builds a ring, not a box');
check(readFileSync(new URL('./map.js', import.meta.url), 'utf8').includes('collider:'),
  'the collider has a map colour');

let failed = 0;
for (const [ok, msg] of results) { if (!ok) failed++; console.log(`${ok ? 'ok' : 'FAIL'} ${msg}`); }
if (failed) process.exit(1);

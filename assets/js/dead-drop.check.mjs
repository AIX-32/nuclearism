import assert from 'node:assert/strict';
import { ITEM_DEFS, MACHINE_DEFS, MACHINE_BY_ID, offerPrice, rialValue } from './content.js';
import { MachineSystem } from './machines.js';


const known = new Set(['iron_ingot', 'iron_plate', 'rials']);
const made = new Set();
const drops = [], removed = [], notices = [], flybys = [];
const sys = Object.create(MachineSystem.prototype);
sys.ITEMS = ITEM_DEFS;
sys.templates = new Map(MACHINE_DEFS.map((d) => [d.id, { def: d }]));
sys.ctx = { notice: (m) => notices.push(m), hasItem: (id) => known.has(id), hasMachine: (id) => made.has(id), planeFlyby: () => flybys.push(1) };
sys.instances = [];
sys.inv = { hot: [], main: [] };
sys.ui = { refresh() {} };
sys.at = () => null;
sys.place = (id, x, z, opts = {}) => {
  const inst = { id, def: MACHINE_BY_ID[id], x, z, rot: opts.rot || 0, state: { slots: {}, status: 'IDLE' } };
  drops.push(inst);
  return inst;
};
sys.remove = (m) => { removed.push(m.id); sys.instances = sys.instances.filter((i) => i !== m); };

const box = (id, slots = {}, want) => ({
  id, def: MACHINE_BY_ID[id], x: 100, z: 100, rot: 0,
  state: { slots, status: 'IDLE', want: want || [null, null, null] },
});
const run = () => { flybys.length = 0; const before = sys.instances.length; sys.nightfall(); assert.equal(sys.instances.length, before - removed.length); };


let b = box('pickup_box', { input0: { id: 'iron_ingot', n: 5 }, input1: { id: 'iron_ingot', n: 5 } });
sys.instances = [b]; removed.length = 0; drops.length = 0;
sys.tickOffer(b);
assert.equal(b.state.status, '10 ITEMS · 80 RIALS');
run();
assert.deepEqual(removed, ['pickup_box']);
assert.equal(drops.length, 1);
assert.equal(drops[0].id, 'dropbox');
assert.deepEqual(drops[0].state.slots.output0, { id: 'rials', n: 80 });
assert.match(notices.at(-1), /IRGC PLANE DROPPED 80 RIALS/);
assert.ok(Math.hypot(drops[0].x - 100, drops[0].z - 100) >= 5);
assert.equal(flybys.length, 1);


b = box('pickup_box', { input0: { id: 'rials', n: 9000 } });
sys.instances = [b]; removed.length = 0; drops.length = 0;
sys.tickOffer(b);
assert.equal(b.state.status, 'NO BUYER');
run();
assert.equal(removed.length, 0);
assert.equal(flybys.length, 0);


const d = drops.length ? drops[0] : sys.place('dropbox', 0, 0, {});
d.state.slots = {};
assert.equal(sys.addOutput(d, 'rials', 12000), 0);
assert.deepEqual(d.state.slots.output0, { id: 'rials', n: 9000 });
assert.deepEqual(d.state.slots.output1, { id: 'rials', n: 3000 });


const want = [{ id: 'iron_ingot', n: 2 }, { id: 'iron_plate', n: 1 }, null];
known.delete('iron_plate');
const offer = offerPrice(want, sys.ctx.hasItem, sys.ctx.hasMachine);
assert.equal(offer.price, 2 * 8 + 1 * 10 * 8);
const a = box('ask_box', { pay0: { id: 'rials', n: offer.price } }, want);
sys.instances = [a]; removed.length = 0; drops.length = 0;
sys.tickOffer(a);
assert.equal(a.state.status, `READY · ${offer.price.toLocaleString()} RIALS`);
run();
assert.deepEqual(removed, ['ask_box']);
assert.equal(drops[0].id, 'drop_pod');
assert.deepEqual(drops[0].state.slots.output0, { id: 'iron_ingot', n: 2 });
assert.deepEqual(drops[0].state.slots.output1, { id: 'iron_plate', n: 1 });
assert.equal(a.state.slots.pay0, null);
assert.equal(flybys.length, 1);


const batch1 = box('pickup_box', { input0: { id: 'iron_ingot', n: 1 } });
const batch2 = box('pickup_box', { input0: { id: 'iron_ingot', n: 1 } });
batch2.x = 300; batch2.z = 300;
sys.instances = [batch1, batch2]; removed.length = 0; drops.length = 0;
run();
assert.equal(drops.length, 2);
assert.equal(flybys.length, 1);


const locked = [{ id: 'pickup_box', n: 1 }, null, null];
const a2 = box('ask_box', { pay0: { id: 'rials', n: 9000 } }, locked);
sys.instances = [a2]; removed.length = 0; drops.length = 0;
sys.tickOffer(a2);
assert.equal(a2.state.status, 'NOT AVAILABLE · MAKE IT FIRST');
run();
assert.equal(removed.length, 0);
assert.equal(a2.state.slots.pay0.n, 9000);
made.add('pickup_box'); known.add('pickup_box');
assert.equal(offerPrice(locked, sys.ctx.hasItem, sys.ctx.hasMachine).price, rialValue('pickup_box'));


const a3 = box('ask_box', { pay0: { id: 'rials', n: 10 } }, [{ id: 'iron_ingot', n: 2 }, null, null]);
sys.instances = [a3]; removed.length = 0; drops.length = 0;
sys.tickOffer(a3);
assert.equal(a3.state.status, 'NEED 6 RIALS');
run();
assert.equal(removed.length, 0);
assert.equal(flybys.length, 0);


const st = { slots: { pay0: { id: 'rials', n: 9000 }, pay1: { id: 'rials', n: 9000 } } };
assert.equal(sys.paidRials(st), 18000);
assert.equal(sys.spendRials(st, 10000), 0);
assert.deepEqual(st.slots.pay0, null);
assert.deepEqual(st.slots.pay1, { id: 'rials', n: 8000 });


sys.instances = [box('manufactory')];
assert.equal(sys.placementBlocked(101, 100, 'pickup_box'), true);
assert.equal(sys.placementBlocked(200, 200, 'pickup_box'), false);
assert.equal(sys.placementBlocked(101, 100, 'manufactory'), false);
sys.instances = [box('ask_box')];
assert.equal(sys.placementBlocked(101, 100, 'manufactory'), true);
assert.equal(sys.placementBlocked(200, 200, 'manufactory'), false);


const near = box('pickup_box', { input0: { id: 'iron_ingot', n: 1 } });
const far = box('pickup_box', { input0: { id: 'iron_ingot', n: 5 } });
far.x = 500; far.z = 500;
sys.instances = [near, far]; removed.length = 0; drops.length = 0;
sys.nightfall([near]);
assert.equal(removed.length, 1);
assert.equal(drops.length, 1);
assert.deepEqual(drops[0].state.slots.output0, { id: 'rials', n: 8 });
assert.ok(sys.instances.includes(far));
assert.equal(flybys.length, 1);


const order = [{ id: 'iron_ingot', n: 2 }, null, null];
const payer = box('ask_box', {}, order);
sys.instances = [payer];
sys.openInst = payer;
sys.inv.hot = [{ id: 'rials', n: 9000 }, { id: 'iron_ingot', n: 5 }];
sys.inv.main = [];
notices.length = 0;
assert.equal(sys.payExact(), true);
assert.deepEqual(payer.state.slots.pay0, { id: 'rials', n: 16 });
assert.deepEqual(sys.inv.hot[0], { id: 'rials', n: 8984 });
assert.deepEqual(sys.inv.hot[1], { id: 'iron_ingot', n: 5 });
assert.match(notices.at(-1), /PAID 16 RIALS/);
assert.equal(sys.payExact(), false);
assert.equal(sys.inv.hot[0].n, 8984);
assert.match(notices.at(-1), /ALREADY PAID/);


const short = box('ask_box', {}, order);
sys.openInst = short;
sys.inv.hot = [{ id: 'rials', n: 5 }];
notices.length = 0;
assert.equal(sys.payExact(), false);
assert.equal(short.state.slots.pay0, undefined);
assert.equal(sys.inv.hot[0].n, 5);
assert.match(notices.at(-1), /NEED 11 MORE RIALS/);

console.log('dead drop OK');

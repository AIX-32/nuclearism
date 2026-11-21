// The skyline loop, end to end, on the tiny three.js stand in: a pod leaves
// the source, rides the wire and lands in the destination's input slots.

import { stubThree } from './three-stub.mjs';
import { SkylineSystem, SKYLINE_MODE, machineKey } from './skyline.js';
import { ITEM_DEFS } from './content.js';

const ok = [];
const check = (cond, name) => ok.push([!!cond, name]);

const THREE = stubThree();
const scene = { children: [], add(c) { this.children.push(c); }, remove(c) { this.children = this.children.filter((x) => x !== c); } };

const machine = (id, kind, x, z, extra = {}) => ({
  def: { id, kind, outputs: 4, storageSlots: 14, ...extra },
  x, y: 0, z, top: 5,
  state: { slots: {}, job: null, queue: [], progress: 0, status: 'IDLE' },
});

const pylon = machine('skyline_pylon', 'pylon', 0, 0);
const pylon2 = machine('skyline_pylon', 'pylon', 40, 0);
const crate = machine('simple_container', 'storage', 4, 0);
const furnace = machine('electric_furnace', 'processor', 36, 0, {
  recipes: [{ in: { iron_ore: 1 }, out: { iron_ingot: 1 }, time: 2 }],
});

crate.state.slots.slot0 = { id: 'iron_ore', n: 5 };

const started = [];
const machines = {
  instances: [pylon, pylon2, crate, furnace],
  startJobFromSlots: (m, recipe) => { started.push(['slots', m.def.id, recipe]); return false; },
  startJob: (m, recipe) => { started.push(['bag', m.def.id, recipe]); return false; },
};

const sys = new SkylineSystem({
  THREE, scene, items: ITEM_DEFS, machines, craftRecipes: [],
  notice: () => { },
});

check(sys.pylonFor(crate) === pylon, 'a container picks the pylon next to it');
check(sys.pylonFor(furnace) === pylon2, 'the furnace picks the pylon next to it');
check(sys.pylonFor(machine('x', 'processor', 200, 200)) === null, 'a machine with no pylon nearby has none');

// A route from the crate to the furnace.
sys.addRoute(crate, furnace, 'iron_ore', SKYLINE_MODE.RECIPE, 0);
check(sys.routes.length === 1, 'the route exists');
check(sys.routes[0].needs.iron_ore === 1, 'the route knows what the recipe needs');

// The pod leaves with the ore and the destination is asked to craft.
sys.logic();
check(started.some((s) => s[1] === 'electric_furnace'), 'the destination is asked to craft');
check(sys.pods.length === 1, 'a pod is sent');
check(crate.state.slots.slot0 === null, 'the crate gave the ore up');

// Ride the wire.
for (let i = 0; i < 200 && sys.pods.length; i++) sys.update(0.05);
check(sys.pods.length === 0, 'the pod arrived');
check(furnace.state.slots.input0?.id === 'iron_ore', 'the ore landed in the machine input');
check(furnace.state.slots.input0.n === 5, 'the whole stack came along');

// A second route to the same destination with another ingredient of the same
// recipe connects without asking.
const coal = machine('coal_machine', 'processor', 30, 2, {
  recipes: [{ in: { iron_ore: 1, coal: 1 }, out: { steel: 1 }, time: 2 }],
});
machines.instances.push(coal);
sys.addRoute(coal, coal, 'iron_ore', SKYLINE_MODE.RECIPE, 0);
const before = sys.routes.length;
sys.pending = { src: coal, item: 'coal' };
const linksBefore = sys.routes.length;
check(linksBefore === 2, 'the second route was added');

// The auto-connect rule: a destination that already runs a recipe that eats
// the item is found without a menu.
sys.routes.push({ id: 99, srcKey: machineKey(crate), dstKey: machineKey(coal), item: 'iron_ore', mode: SKYLINE_MODE.RECIPE, idx: 0, needs: { iron_ore: 1, coal: 1 } });
const auto = (await import('./skyline.js')).matchRoute(sys.routes, machineKey(coal), 'coal');
check(!!auto, 'the destination that already runs the recipe is matched');
check(auto.idx === 0, 'the matched route keeps its recipe');

// A route survives a save and load.
const saved = sys.serialize();
const sys2 = new SkylineSystem({ THREE, scene, items: ITEM_DEFS, machines, craftRecipes: [] });
sys2.restore(saved);
check(sys2.routes.length === saved.length, 'the routes are restored');
check(sys2.routes[0].srcKey === sys.routes[0].srcKey, 'the restored route keeps its source');

// One machine, two routes: the route whose item is missing gets the machine.
const multi = machine('multi', 'processor', 4, 2);
multi.state.slots.output0 = { id: 'beta', n: 1 };
check(sys.prefers(multi, { item: 'alpha' }, { item: 'beta' }), 'the route whose item is missing wins the machine');
check(!sys.prefers(multi, { item: 'beta' }, { item: 'alpha' }), 'the route whose item is already there waits');

// A destination with no room: the pod waits at the end of the line and keeps
// its load.
const full = machine('full_machine', 'processor', 36, 0, { recipes: [] });
for (let i = 0; i < 4; i++) full.state.slots[`input${i}`] = { id: 'iron_ore', n: 99 };
crate.state.slots.slot1 = { id: 'iron_ore', n: 5 };
machines.instances.push(full);
const sys3 = new SkylineSystem({ THREE, scene, items: ITEM_DEFS, machines, craftRecipes: [] });
sys3.addRoute(crate, full, 'iron_ore', SKYLINE_MODE.STORE, -1);
sys3.logic();
for (let i = 0; i < 200 && sys3.pods.length; i++) sys3.update(0.05);
check(sys3.pods.length === 1, 'the pod waits when the destination is full');
check(sys3.pods[0].n === 5, 'the pod keeps the whole load');
check(full.state.slots.input0.n === 99, 'the full slot did not overflow');

let failed = 0;
for (const [pass, name] of ok) {
  if (!pass) { failed++; console.error(`FAIL  ${name}`); }
}
console.log(`skyline.run.check: ${ok.length - failed}/${ok.length} passed`);
if (failed) process.exit(1);

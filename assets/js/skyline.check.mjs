

import {
  recipeNeeds, recipeOutputs, recipeList, machineKey, outputRoles, storageRoles,
  inputRoles, deliveryRoles, sourceItems, destItems, matchRoute,
  pushIntoSlots, takeFromSlots, skylineStorages, stockedItems, pullItems, SKYLINE_MODE,
} from './skyline.js';

const ok = [];
const check = (cond, name) => ok.push([!!cond, name]);



const inRecipe = { in: { iron: 2, carbon: 1 }, out: { steel_ingot: 1 }, time: 5 };
const outRecipe = { out: { plate: 1 }, needs: { steel_ingot: 1 } };

check(JSON.stringify(recipeNeeds(inRecipe)) === JSON.stringify({ iron: 2, carbon: 1 }), 'in recipe keeps its needs');
check(JSON.stringify(recipeNeeds(outRecipe)) === JSON.stringify({ steel_ingot: 1 }), 'out recipe reads needs');
check(recipeOutputs(inRecipe).steel_ingot === 1, 'in recipe keeps its output');
check(recipeOutputs(outRecipe).plate === 1, 'out recipe reads out');

const netted = { in: { iron: 1 }, out: { iron: 1, dust: 2 }, time: 2 };
check(recipeNeeds(netted).iron === undefined, 'an in recipe nets its own output out of the needs');
check(recipeOutputs(netted).iron === undefined, 'an in recipe nets its own input out of the output');



const machine = (kind, extra = {}) => ({
  def: { id: kind, kind, outputs: 4, storageSlots: 14, ...extra },
  x: 1, y: 2, z: 3,
  state: { slots: {} },
});

const crusher = machine('processor', {
  recipes: [
    { in: { copper: 1 }, out: { crushed_copper: 1 }, time: 2 },
    { in: { iron: 1 }, out: { crushed_iron: 1 }, time: 2 },
  ],
});
const bench = machine('crafting');
const crate = machine('storage');

check(recipeList(crusher, []).length === 2, 'a processor lists its recipes');
check(recipeList(bench, [{ out: { plate: 1 } }]).length === 1, 'a crafting bench lists the bag recipes');
check(recipeList(crate, []).length === 0, 'a container has no recipes');

check(machineKey(crusher) === 'processor@1.00,2.00,3.00', 'a machine key is stable');
check(outputRoles(crusher).join(',') === 'output0,output1,output2,output3', 'output roles follow def.outputs');
check(storageRoles(crate).length === 14, 'a container has its own storage roles');
check(inputRoles().length === 4, 'a machine has four input slots');



check(sourceItems(crusher, []).length === 2, 'a processor offers what it can make');
check(sourceItems(crusher, []).some((o) => o.id === 'crushed_copper'), 'the processor offers crushed copper');
crate.state.slots.slot0 = { id: 'iron', n: 12 };
crate.state.slots.slot3 = { id: 'copper', n: 3 };
const fromCrate = sourceItems(crate, []);
check(fromCrate.length === 2, 'a container offers what it holds');
check(fromCrate.find((o) => o.id === 'iron').n === 12, 'a container reports the stack size');



const furnace = machine('processor', {
  recipes: [
    { in: { crushed_iron: 1 }, out: { iron_ingot: 1 }, time: 2 },
    { in: { crushed_copper: 1 }, out: { copper_ingot: 1 }, time: 2 },
  ],
});
const dest = destItems(furnace, 'crushed_iron', []);
check(dest.length === 1, 'only the recipe that eats the item is offered');
check(dest[0].mode === SKYLINE_MODE.RECIPE, 'a recipe destination is a recipe link');
check(dest[0].idx === 0, 'the recipe index points at the smelting recipe');
check(dest[0].label.includes('iron_ingot'), 'the option is named after what it makes');

const storeDest = destItems(crate, 'iron', []);
check(storeDest.length === 1 && storeDest[0].mode === SKYLINE_MODE.STORE, 'a container just stores the item');
check(destItems(furnace, 'unobtainium', [])[0].mode === SKYLINE_MODE.STORE, 'a machine with no recipe for it stores it too');



const routes = [{
  id: 1, srcKey: 'a@0,0,0', dstKey: machineKey(furnace), item: 'crushed_iron',
  mode: SKYLINE_MODE.RECIPE, idx: 0, needs: { crushed_iron: 1 },
}];
check(!!matchRoute(routes, machineKey(furnace), 'crushed_iron'), 'a destination that already runs the recipe is found');
check(!matchRoute(routes, machineKey(furnace), 'crushed_copper'), 'another item does not match the route');
check(!matchRoute(routes, 'other@0,0,0', 'crushed_iron'), 'a route belongs to its own destination');



check(deliveryRoles(furnace, 'crushed_iron', {}).join(',') === 'input0,input1,input2,input3', 'a machine takes deliveries in its inputs');
check(deliveryRoles(crate, 'iron', {})[0] === 'slot0', 'a container takes deliveries in its storage');
const reactor = machine('reactor', { rodSlots: 5 });
check(deliveryRoles(reactor, 'control_rod', { control_rod: { rod: true } })[0] === 'rod0', 'a rod goes into a cooling slot');
check(deliveryRoles(reactor, 'tbu_fuel', { tbu_fuel: { fuel: true } })[0] === 'fuel', 'fuel goes into the fuel slot');



const slots = {};
const left = pushIntoSlots(slots, inputRoles(), { id: 'iron', n: 5 });
check(!left, 'a stack that fits leaves nothing behind');
check(slots.input0.id === 'iron' && slots.input0.n === 5, 'the stack lands in the first free slot');

const merged = pushIntoSlots(slots, inputRoles(), { id: 'iron', n: 3 });
check(!merged && slots.input0.n === 8, 'the same item merges into the slot it is in');
check(slots.input1 === undefined, 'a merge does not open a second slot');

const overflow = pushIntoSlots(slots, inputRoles(), { id: 'iron', n: 200 });
check(!overflow, 'a big stack is spread over the free slots');
check(slots.input0.n === 99, 'the first slot fills up');
check(slots.input1.n === 99, 'the second slot fills up');
check(slots.input2.n === 10, 'the rest lands in the third slot');

const taken = takeFromSlots(slots, inputRoles(), 'iron', 10);
check(taken === 10, 'taking moves the requested count');
check(slots.input0.n === 89, 'the slot keeps the rest');
check(takeFromSlots(slots, inputRoles(), 'copper', 5) === 0, 'a wrong item is not taken');

const pyl = { def: { id: 'skyline_pylon', kind: 'pylon' }, x: 0, y: 0, z: 0 };
const depot = {
  def: { id: 'massive_container', kind: 'storage', storageSlots: 112, skylineStorage: true },
  state: { slots: { slot0: { id: 'iron', n: 120 }, slot1: { id: 'stone', n: 10 } }, skylineStorage: true },
};
const unticked = {
  def: { id: 'massive_container', kind: 'storage', storageSlots: 112, skylineStorage: true },
  state: { slots: { slot0: { id: 'copper', n: 7 } }, skylineStorage: false },
};
const req = { def: { id: 'requester', kind: 'storage', storageSlots: 8, requester: true }, state: { slots: {} } };
const inRange = (m) => m === pyl || m === depot || m === req ? pyl : null;
const linked = (a, b) => a === b || (a === pyl && b === pyl);
const storages = skylineStorages([depot, unticked, req], req, inRange, linked);
check(storages.length === 1 && storages[0] === depot, 'only ticked containers in the pylon network are visible to the requester');
const stock = stockedItems(storages);
check(stock.find((o) => o.id === 'iron')?.n === 120, 'the requester lists what the containers hold');
check(!stock.some((o) => o.id === 'copper'), 'an unticked container stays private');
const moved = pullItems(req, storages, 'iron', () => 50);
check(moved === 120 && req.state.slots.slot0.n === 50 && req.state.slots.slot1.n === 50 && req.state.slots.slot2.n === 20, 'a request fills slots up to the stack cap');
check(!depot.state.slots.slot0, 'requested stacks leave the container');
for (const role of storageRoles(req)) if (!req.state.slots[role]) req.state.slots[role] = { id: 'iron', n: 50 };
check(pullItems(req, storages, 'stone', () => 50) === 0 && depot.state.slots.slot1.n === 10, 'a full requester leaves the stock in the container');
const flask = { id: 'jerry_can_black', n: 1, liquid: { id: 'water', amount: 5 } };
depot.state.slots.slot2 = flask;
const emptyReq = { def: { id: 'requester', kind: 'storage', storageSlots: 8 }, state: { slots: {} } };
check(pullItems(emptyReq, storages, 'jerry_can_black', () => 10) === 1 && emptyReq.state.slots.slot0 === flask && !depot.state.slots.slot2, 'a filled container moves whole and keeps its liquid');

let failed = 0;
for (const [pass, name] of ok) {
  if (!pass) { failed++; console.error(`FAIL  ${name}`); }
}
console.log(`skyline.check: ${ok.length - failed}/${ok.length} passed`);
if (failed) process.exit(1);

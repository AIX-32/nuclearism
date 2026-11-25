

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { ITEM_DEFS, itemModelIcon, ITEM_MODEL_ICON_EXCLUDE, MACHINE_DEFS, MACHINE_BY_ID, CRAFT_RECIPES, TABLE_RECIPES, DEPLETED_OF, layoutFor, TUNING, regionOre, ORE_REGION_SIZE, REGION_ORE_IDS, REACTOR_ROD_SLOTS, formatRad, formatRadRate, STARTER_GUIDE, STARTER_GUIDE_SECONDS, ACHIEVEMENT_TYPES, COOKED_DISHES, BARREL_LOOT, SCRAP_RECYCLE_TABLE, rollWeighted, RIAL_VALUE, rialValue, saleValue, offerPrice, LORE_POD_LOOT, LORE_BOOKS } from './content.js';
import * as Liquid from './liquids.js';
import { MachineSystem } from './machines.js';

const ok = [];
const TYPES = new Set(['label', 'slot', 'progress', 'arrow', 'power', 'recipes', 'bwe', 'bore', 'batteryPie', 'input', 'orders', 'button']);
const KINDS = new Set(['crafting', 'armor', 'processor', 'reactor', 'generator', 'excavator', 'bwe', 'absorber', 'cable', 'starter_cable', 'storage', 'geiger', 'cleaner', 'scrubber', 'pump', 'pylon', 'bed', 'vehicle', 'bore', 'pickup', 'askbox', 'drop']);

function has(id) { return Object.prototype.hasOwnProperty.call(ITEM_DEFS, id); }

for (const [id, def] of Object.entries(ITEM_DEFS)) {
  if (!id.endsWith('_ingot')) continue;
  ok.push([def.icon === 'assets/images/items/ingot.png', `ingot "${id}" uses the shared base texture`]);
  ok.push([typeof def.tint === 'number', `ingot "${id}" has a tint color`]);
}


for (const [id, def] of Object.entries(ITEM_DEFS)) {
  if (!id.endsWith('_plate')) continue;
  ok.push([def.icon === 'assets/images/items/sheet.png', `plate "${id}" uses the shared sheet texture`]);
  ok.push([typeof def.tint === 'number', `plate "${id}" has a tint color`]);
}

for (const r of CRAFT_RECIPES) {
  for (const id of Object.keys(r.out)) ok.push([has(id), `craft out "${id}"`]);
  for (const id of Object.keys(r.needs)) ok.push([has(id), `craft need "${id}"`]);
}

for (const [seedId, d] of Object.entries(ITEM_DEFS).filter(([, d]) => d.seed)) {
  ok.push([CRAFT_RECIPES.some((r) => r.out[seedId] === 2 && r.needs[d.seed] === 1),
    `"${d.seed}" turns into 2 "${seedId}" at the manufactory`]);
}


ok.push([TABLE_RECIPES.length >= 5, `pocket table has recipes (${TABLE_RECIPES.length})`]);
for (const r of TABLE_RECIPES) {
  ok.push([CRAFT_RECIPES.includes(r), 'table recipe is in CRAFT_RECIPES']);
  ok.push([Object.keys(r.needs).length <= 6, `table recipe "${Object.keys(r.out)[0]}" has a compact ingredient list`]);
  for (const id of Object.keys(r.out)) ok.push([has(id), `table out "${id}"`]);
  for (const id of Object.keys(r.needs)) ok.push([has(id), `table need "${id}"`]);
}

ok.push([STARTER_GUIDE_SECONDS === 1800, `starter guide lasts 30 real minutes (${STARTER_GUIDE_SECONDS}s)`]);
for (const id of STARTER_GUIDE) {
  ok.push([has(id), `starter guide item "${id}" exists`]);

  ok.push([TABLE_RECIPES.some((r) => r.out[id]) || ['carbon', 'iron', 'copper', 'apple', 'orange', 'pear'].includes(id), `starter guide item "${id}" is obtainable at the table or by hand`]);
}
ok.push([STARTER_GUIDE.includes('hand_crank'), 'starter guide points at the hand crank']);
ok.push([MACHINE_BY_ID.hand_crank?.manual === true, 'hand crank is a manual generator']);
ok.push([!MACHINE_DEFS.some((d) => d.kind === 'generator' && d.capacity), 'generators do not store network energy']);
ok.push([MACHINE_BY_ID.water_pump?.kind === 'pump', 'water pump exists']);
ok.push([TABLE_RECIPES.some((r) => r.out.water_pump), 'water pump is craftable at the table']);


const seen = new Set();
for (const m of MACHINE_DEFS) {
  ok.push([!seen.has(m.id), `machine id unique "${m.id}"`]);
  seen.add(m.id);
  ok.push([KINDS.has(m.kind), `machine kind "${m.kind}" (${m.id})`]);
  for (const r of (m.recipes || [])) {
    for (const id of Object.keys(r.in || {})) ok.push([has(id), `${m.id} in "${id}"`]);
    for (const id of Object.keys(r.out || {})) ok.push([has(id), `${m.id} out "${id}"`]);
  }
}


for (const m of MACHINE_DEFS) {
  ok.push([Object.values(ITEM_DEFS).some((d) => d.workbench === m.id), `block item for "${m.id}"`]);
}
for (const [id, d] of Object.entries(ITEM_DEFS)) {
  if (d.workbench) ok.push([!!MACHINE_BY_ID[d.workbench], `item "${id}" -> machine "${d.workbench}"`]);
}



const gridOut = new Set();
for (const r of CRAFT_RECIPES) for (const id of Object.keys(r.out)) gridOut.add(id);
const machineOut = new Set();
for (const m of MACHINE_DEFS) for (const r of (m.recipes || [])) for (const id of Object.keys(r.out || {})) machineOut.add(id);
for (const m of MACHINE_DEFS) {
  if (m.id === 'infinite_battery' || m.kind === 'drop') continue;
  const blockId = Object.keys(ITEM_DEFS).find((k) => ITEM_DEFS[k].workbench === m.id);
  if (blockId) ok.push([gridOut.has(blockId) || machineOut.has(blockId), `machine "${m.id}" is obtainable`]);
}
for (const id of ['manufactory', 'armor_workbench', 'crusher', 'electric_furnace', 'wooden_powerpole', 'assembler']) {
  ok.push([gridOut.has(id), `bootstrap block "${id}" is grid-craftable`]);
}




const gun = MACHINE_BY_ID.gun_workbench;
ok.push([!!gun, 'gun_workbench exists']);
if (gun) {
  const subset = (a, b) => Object.entries(a).every(([k, v]) => (b[k] || 0) >= v);
  gun.recipes.forEach((ri, i) => {
    for (const id of Object.keys(ri.in)) ok.push([has(id), `gun in "${id}"`]);
    for (const id of Object.keys(ri.out)) ok.push([has(id), `gun out "${id}"`]);
    gun.recipes.forEach((rj, j) => {
      if (j <= i) return;
      ok.push([!subset(ri.in, rj.in), `gun recipe ${j} not shadowed by ${i}`]);
    });
  });
  for (const id of ['gun_barrel', 'gun_stock', 'gun_parts']) {
    ok.push([gridOut.has(id), `gun part "${id}" grid-craftable`]);
  }
}


const c4 = ITEM_DEFS.c4;
ok.push([!!c4?.c4, 'c4 is a placeable timed charge']);
ok.push([MACHINE_BY_ID.chemical_reactor.recipes.some((r) => r.out?.rdx), 'chemical reactor makes rdx']);
const gunRec = MACHINE_BY_ID.gun_workbench.recipes;
ok.push([gunRec.some((r) => r.out?.detonator), 'gun workbench makes a detonator']);
const c4Rec = gunRec.find((r) => r.out?.c4);
ok.push([!!c4Rec, 'gun workbench makes c4']);
ok.push([!!c4Rec?.in.detonator && !!c4Rec?.in.rdx && !!c4Rec?.in.plastic,
  'c4 needs a detonator, rdx and plastic']);


const machineIn = new Set();
for (const m of MACHINE_DEFS) for (const r of (m.recipes || [])) for (const id of Object.keys(r.in || {})) machineIn.add(id);
for (const id of ['circuit_board', 'memory_module', 'data_drive', 'data_disk', 'cooling_fan', 'card_reader', 'optic_lens', 'timer_module']) {
  ok.push([has(id), `chip "${id}"`]);
  ok.push([gridOut.has(id), `chip "${id}" grid-craftable`]);
  ok.push([machineIn.has(id), `chip "${id}" used by a machine`]);
}


for (const [fuel, dep] of Object.entries(DEPLETED_OF)) {
  ok.push([has(fuel), `fuel "${fuel}"`]);
  ok.push([has(dep), `depleted "${dep}"`]);
}
for (const [id, d] of Object.entries(ITEM_DEFS)) {
  if (d.fuel) ok.push([!!DEPLETED_OF[id], `fuel "${id}" has a depleted form`]);
}


for (const m of MACHINE_DEFS) {
  const l = layoutFor(m);
  ok.push([l && Array.isArray(l.elements) && l.elements.length > 0, `layout "${m.id}" non-empty`]);
  for (const e of l.elements) {
    ok.push([TYPES.has(e.type), `layout "${m.id}" element type ${e.type}`]);
    if (e.type === 'slot') ok.push([typeof e.role === 'string' && e.role.length > 0, `layout "${m.id}" slot ${e.id} role`]);
    ok.push([e.x >= 0 && e.y >= 0 && e.x + e.w <= l.grid.cols && e.y + e.h <= l.grid.rows, `layout "${m.id}" element ${e.id} in bounds`]);
  }
}



const craftLayout = layoutFor(MACHINE_BY_ID.manufactory);
ok.push([!craftLayout.elements.some((e) => e.type === 'recipes'), 'manufactory recipe list lives in the side rail']);
ok.push([!craftLayout.elements.some((e) => e.type === 'slot'), 'manufactory has no craft-grid slots']);
ok.push([craftLayout.elements.some((e) => e.id === 'progress'), 'manufactory has a craft progress bar']);
ok.push([CRAFT_RECIPES.every((r) => r.time > 0), 'every bag recipe has a craft time']);
ok.push([CRAFT_RECIPES.find((r) => r.out.manufactory).time > CRAFT_RECIPES.find((r) => r.out.iron_ingot).time, 'machine blocks take longer to craft than simple items']);
for (const id of ['crusher', 'gun_workbench', 'medicine_workbench', 'liquid_mixer', 'assembler']) {
  const l = layoutFor(MACHINE_BY_ID[id]);
  ok.push([!l.elements.some((e) => e.type === 'recipes'), `"${id}" recipe list lives in the side rail`]);
  ok.push([!l.elements.some((e) => e.type === 'slot'), `"${id}" uses the bag-based craft list`]);
}


const nz = ITEM_DEFS.neurozam_9;
ok.push([!!nz?.consumable?.intake, 'neurozam_9 damps rad intake']);
ok.push([nz.consumable.intake > 0 && nz.consumable.intake < 1, 'neurozam_9 intake < 1']);
ok.push([nz.consumable.intakeTime === 1800, 'neurozam_9 lasts 30 real minutes']);
const med = MACHINE_BY_ID.medicine_workbench;
ok.push([!!med, 'medicine_workbench exists']);
ok.push([!!gridOut.has('medicine_workbench'), 'medicine_workbench grid-craftable']);
ok.push([(med.recipes || []).some((r) => r.out.neurozam_9), 'medicine_workbench makes neurozam_9']);


const cans = Object.entries(ITEM_DEFS).filter(([, d]) => d.container && !d.container.medical)
  .map(([id, d]) => ({ id, ...d })).sort((a, b) => a.container.tier - b.container.tier);
ok.push([cans.length === 6, `six container tiers (${cans.length})`]);
for (let i = 1; i < cans.length; i++) {
  ok.push([cans[i].container.capacity > cans[i - 1].container.capacity,
    `${cans[i].id} holds more than ${cans[i - 1].id}`]);
}
const acidCans = cans.filter((c) => Liquid.accepts(c, 'acid')).map((c) => c.id);
ok.push([acidCans.length === 1, `only one can is acid-proof (${acidCans.join(',')})`]);
ok.push([acidCans[0] === 'jerry_can_white', 'hazmat can is the acid-proof one']);
for (const c of cans) {
  if (!c.container.filter) ok.push([Liquid.accepts(c, 'water'), `${c.id} holds water`]);
  ok.push([gridOut.has(c.id), `${c.id} is craftable`]);
}
ok.push([Liquid.accepts(ITEM_DEFS.fuel_carton, 'gasoline') && !Liquid.accepts(ITEM_DEFS.fuel_carton, 'water'),
  'fuel carton takes gasoline only']);

const canStack = { id: 'jerry_can_black', n: 1 };
ok.push([Liquid.fill(canStack, ITEM_DEFS.jerry_can_black, 'water', 999) === 10, 'fill clamps to capacity']);
ok.push([Liquid.volume(canStack) === 10, 'volume after fill']);
ok.push([Liquid.fill(canStack, ITEM_DEFS.jerry_can_black, 'acid', 5) === 0, 'wrong liquid refused while full']);
ok.push([Liquid.drain(canStack, 4) === 4 && Liquid.volume(canStack) === 6, 'drain']);
ok.push([Liquid.fill(canStack, ITEM_DEFS.jerry_can_black, 'acid', 5) === 0, 'non-acid can refuses acid']);
ok.push([Liquid.fill(canStack, ITEM_DEFS.jerry_can_black, 'water', 5) === 4, 'fill stops at capacity']);
ok.push([Liquid.drain(canStack, 999) === 10 && !canStack.liquid, 'empty clears liquid field']);


const produced = new Set();
const used = new Set();
for (const m of MACHINE_DEFS) {
  for (const r of (m.recipes || [])) {
    for (const l of (r.liquidOut ? [r.liquidOut] : [])) produced.add(l.id);
    for (const l of (r.liquidIn || [])) used.add(l.id);
  }
}
for (const [id, d] of Object.entries(Liquid.LIQUIDS)) {
  ok.push([typeof d.name === 'string' && d.color >= 0, `liquid "${id}" has name/colour`]);
  if (id !== 'water') ok.push([produced.has(id), `liquid "${id}" is produced by a machine`]);
  if (id !== 'water') ok.push([used.has(id) || produced.has(id), `liquid "${id}" has a use`]);
}
ok.push([Liquid.LIQUIDS.ethanol && Liquid.LIQUIDS.heavy_water && Liquid.LIQUIDS.nuclear_waste,
  'the extra liquids exist']);
const gen = MACHINE_BY_ID.fuel_generator;
ok.push([!!gen?.liquidFuel?.burn?.gasoline, 'gas generator burns gasoline']);
ok.push([!!gen?.liquidFuel?.burn?.ethanol, 'gas generator burns ethanol']);
ok.push([gen.liquidFuel.burn.ethanol > gen.liquidFuel.burn.gasoline, 'ethanol is the weaker fuel']);
ok.push([Liquid.accepts(ITEM_DEFS.jerry_can_white, 'nuclear_waste'), 'hazmat can holds nuclear waste']);
ok.push([!Liquid.accepts(ITEM_DEFS.jerry_can_black, 'nuclear_waste'), 'plain can refuses nuclear waste']);
ok.push([Liquid.LIQUIDS.nuclear_waste.rad > 0, 'nuclear waste is radioactive']);

const iv = ITEM_DEFS.radaway_iv;
ok.push([!iv?.container, 'radaway_iv is not a container']);
ok.push([!!iv, 'radaway_iv exists']);
ok.push([MACHINE_BY_ID.liquid_mixer.recipes.some((r) => r.out?.radaway_iv), 'liquid mixer makes radaway_iv']);
ok.push([MACHINE_BY_ID.chemical_reactor.recipes.some((r) => r.out?.chelating_agent), 'chemical reactor makes chelating agent']);
const unradRec = MACHINE_BY_ID.medicine_workbench.recipes.find((r) => r.out?.unrad_juice);
ok.push([!!unradRec, 'medicine workbench makes unrad_juice']);
ok.push([!has('unrad_juice_strong'), 'concentrated unrad was removed']);
for (const m of MACHINE_DEFS) {
  for (const r of (m.recipes || [])) {
    ok.push([!r.out?.unrad_juice || (r.in?.radaway_iv > 0), `${m.id} unrad recipe needs radaway_iv`]);
  }
}
const reac = MACHINE_BY_ID.fission_reactor;
ok.push([reac?.coolPerHeavy > reac?.coolPerWater, 'heavy water cools better than water']);
ok.push([layoutFor(reac).elements.some((e) => e.type === 'slot' && e.role === 'coolant'), 'reactor has a coolant slot']);
ok.push([MACHINE_BY_ID.isotope_separator.recipes.some((r) => r.liquidOut?.id === 'heavy_water'),
  'isotope separator makes heavy water']);

const rodEls = layoutFor(reac).elements.filter((e) => e.type === 'slot' && /^rod\d+$/.test(e.role));
ok.push([rodEls.length === REACTOR_ROD_SLOTS, `reactor shows all ${REACTOR_ROD_SLOTS} cooling-rod slots (${rodEls.length})`]);
const RODS = Object.entries(ITEM_DEFS).filter(([, d]) => d.rod);
ok.push([RODS.length >= 6, `at least six cooling-rod types (${RODS.length})`]);
const rodOut = new Set([
  ...CRAFT_RECIPES.flatMap((r) => Object.keys(r.out)),
  ...MACHINE_DEFS.flatMap((m) => (m.recipes || []).flatMap((r) => Object.keys(r.out || {}))),
]);
for (const [id, d] of RODS) {
  ok.push([d.rod.cool > 0, `rod "${id}" cools`]);
  ok.push([d.rod.absorb >= 0 && d.rod.absorb <= 1, `rod "${id}" absorption 0..1`]);
  ok.push([d.rod.mod >= 0, `rod "${id}" moderation non-negative`]);
  ok.push([rodOut.has(id), `rod "${id}" is craftable`]);
}
const rodCools = RODS.map(([, d]) => d.rod.cool);
function coolingReachable(target) {
  let reach = new Set([0]);
  for (let i = 0; i < REACTOR_ROD_SLOTS; i++) {
    const next = new Set(reach);
    for (const v of reach) for (const c of rodCools) next.add(v + c);
    reach = next;
  }
  return reach.has(target);
}
for (const [id, d] of Object.entries(ITEM_DEFS)) {
  if (!d.fuel) continue;
  ok.push([d.fuel.cool > 0, `fuel "${id}" has a cooling target`]);
  ok.push([coolingReachable(d.fuel.cool), `fuel "${id}" target ${d.fuel.cool} is reachable with ${REACTOR_ROD_SLOTS} rods`]);
}


const mix = MACHINE_BY_ID.liquid_mixer;
ok.push([!!mix, 'liquid_mixer exists']);
ok.push([!!gridOut.has('liquid_mixer'), 'liquid_mixer grid-craftable']);
for (const r of (mix?.recipes || [])) {
  for (const l of (r.liquidIn || [])) ok.push([!!Liquid.liquidDef(l.id), `mixer liquidIn "${l.id}"`]);
  if (r.liquidOut) {
    ok.push([!!Liquid.liquidDef(r.liquidOut.id), `mixer liquidOut "${r.liquidOut.id}"`]);
    ok.push([!!ITEM_DEFS[r.liquidOut.container]?.container, `mixer container "${r.liquidOut.container}"`]);
  }
}


const cig = ITEM_DEFS.cigarette_pack;
ok.push([!!cig?.consumable?.smoke, 'cigarette_pack is smokeable']);
ok.push([cig.consumable.smoke === 240, 'cigarette lasts 240s']);
ok.push([Math.abs((cig.consumable.speed || 1) - 1.10) < 1e-9, 'cigarette speed +10%']);
ok.push([gridOut.has('cigarette_pack'), 'cigarette_pack grid-craftable']);
for (const f of ['apple', 'orange', 'pear']) {
  ok.push([!!ITEM_DEFS[f]?.consumable?.food, `${f} is edible`]);
  ok.push([ITEM_DEFS[f].icon === `assets/images/items/${f}.png`, `${f} uses its fruit icon`]);
}

ok.push([!!ITEM_DEFS.lighter, 'lighter exists']);
ok.push([!ITEM_DEFS.lighter.consumable, 'lighter is reusable']);
ok.push([gridOut.has('lighter'), 'lighter grid-craftable']);


const WOUND_TYPES = ['bleeding', 'infection', 'burn', 'poison', 'pain', 'eye', 'respiratory', 'bloodloss'];
const meds = Object.entries(ITEM_DEFS).filter(([, d]) => d.consumable?.cures);
for (const w of WOUND_TYPES) {
  ok.push([meds.some(([, d]) => d.consumable.cures.includes(w)), `wound "${w}" has a cure`]);
}
for (const [id, d] of meds) {
  for (const w of d.consumable.cures) ok.push([WOUND_TYPES.includes(w), `"${id}" cures known wound "${w}"`]);
  ok.push([itemModelIcon(id) === `assets/models/items/${id}.glb`, `"${id}" has a model icon`]);
}
ok.push([TUNING.HUNGER_DRAIN > 0, 'hunger drains']);


let prev = -1;
for (const s of TUNING.RAD_STAGES) {
  ok.push([s.at > prev, `stage ${s.name} ascending`]);
  ok.push([s.speed > 0 && s.speed <= 1, `stage ${s.name} speed`]);
  prev = s.at;
}
ok.push([TUNING.RAD_STAGES.at(-1).at === TUNING.RAD_LETHAL_DOSE, 'last stage is the lethal dose']);
ok.push([TUNING.RAD_STAGES[0].at === TUNING.RAD_ARS_DOSE, 'first stage is ARS onset']);
ok.push([TUNING.RAD_STAGES.some((s) => s.at === TUNING.RAD_LD50), 'LD50 has a dose stage']);
ok.push([TUNING.RAD_LD50 > 0 && TUNING.RAD_LD50 < TUNING.RAD_LETHAL_DOSE, 'LD50 sits below the lethal dose']);
ok.push([TUNING.RAD_ARS_DOSE > 0 && TUNING.RAD_ARS_DOSE < TUNING.RAD_LD50, 'ARS onset precedes LD50']);
ok.push([formatRad(0) === '0 rad', `zero dose formats in rad (${formatRad(0)})`]);
ok.push([formatRad(600) === '600 rad', `whole-body dose formats in rad (${formatRad(600)})`]);
ok.push([formatRad(0.6) === '600 mrad', `sub-rad doses use mrad (${formatRad(0.6)})`]);
ok.push([formatRadRate(0.000000015) === '15 nrad/s', `background rates use nrad/s (${formatRadRate(0.000000015)})`]);
ok.push([formatRadRate(0.02) === '20 mrad/s', `ambient rates use mrad/s (${formatRadRate(0.02)})`]);
ok.push([formatRadRate(TUNING.WASTELAND_RAD) === '350 mrad/s', `wasteland rate formats (${formatRadRate(TUNING.WASTELAND_RAD)})`]);




const RAW_ORES = new Set(['stone', 'carbon', 'copper', 'tin', 'iron', 'lead', 'uranium',
  'lithium', 'boron', 'magnesium', 'zirconium', 'beryllium', 'thorium', 'wood']);
const pocketOut = new Set(TABLE_RECIPES.flatMap((r) => Object.keys(r.out)));
const bootable = MACHINE_DEFS.filter((m) => m.kind === 'generator').some((m) => {
  const blockId = Object.keys(ITEM_DEFS).find((k) => ITEM_DEFS[k].workbench === m.id);
  const rec = CRAFT_RECIPES.find((r) => r.out[blockId]);
  return !!rec && Object.keys(rec.needs).every((id) => pocketOut.has(id) || RAW_ORES.has(id));
});
ok.push([!MACHINE_BY_ID.manufactory?.energy || bootable, 'a generator is bootstrappable without power']);


for (const id of ITEM_MODEL_ICON_EXCLUDE) {
  ok.push([has(id), `excluded model icon "${id}" is an item`]);
  ok.push([itemModelIcon(id) === null, `excluded model icon "${id}" resolves to null`]);
}
for (const [id, def] of Object.entries(ITEM_DEFS)) {
  if (!def.workbench) continue;
  const m = MACHINE_BY_ID[def.workbench];
  ok.push([!!m, `workbench item "${id}" has a machine`]);
  if (m) ok.push([itemModelIcon(id) === m.model, `workbench icon "${id}" uses the machine model`]);
}

const itemsDir = new URL('../../assets/models/items/', import.meta.url);
if (existsSync(itemsDir)) {
  for (const f of readdirSync(itemsDir)) {
    if (!f.endsWith('.glb') || !has(f.slice(0, -4))) continue;
    ok.push([itemModelIcon(f.slice(0, -4)) === `assets/models/items/${f}`, `item model file ${f} maps to its id`]);
  }
}


for (const [id, d] of Object.entries(ITEM_DEFS)) {
  if (!d.light) continue;
  if (d.light.mount === 'held') {
    ok.push([d.tool?.flashlight === true, `light "${id}" is a held light`]);
    ok.push([d.light.range > 0 && d.light.power > 0, `light "${id}" range/power positive`]);
    continue;
  }
  ok.push([d.torch === true, `light "${id}" is placeable`]);
  ok.push([['wall', 'floor'].includes(d.light.mount), `light "${id}" mount known`]);
  ok.push([d.light.range > 0 && d.light.power > 0, `light "${id}" range/power positive`]);
  ok.push([gridOut.has(id), `light "${id}" is craftable`]);
}
ok.push([ITEM_DEFS.lantern.light.range > ITEM_DEFS.torch.light.range, 'lantern outranges torch']);
ok.push([ITEM_DEFS.floodlight.light.range > ITEM_DEFS.lantern.light.range, 'floodlight outranges lantern']);
ok.push([ITEM_DEFS.lantern.light.mount === 'floor', 'lantern stands on floors']);
ok.push([ITEM_DEFS.floodlight.light.mount === 'wall', 'floodlight mounts on walls']);


for (const id of REGION_ORE_IDS) ok.push([has(id), `region ore "${id}"`]);
const seams = new Map();
for (let rx = -20; rx < 20; rx++) {
  for (let rz = -20; rz < 20; rz++) {
    const x0 = rx * ORE_REGION_SIZE, z0 = rz * ORE_REGION_SIZE;
    const a = regionOre(x0, z0), b = regionOre(x0 + ORE_REGION_SIZE - 1, z0 + ORE_REGION_SIZE - 1);
    ok.push([a === b, `chunk corners share a seam (${a} vs ${b} at ${rx},${rz})`]);
    ok.push([a === regionOre(x0 + 5.9, z0 + 2), 'seam is stable inside its chunk']);
    seams.set(a, (seams.get(a) || 0) + 1);
  }
}
ok.push([seams.size >= 8, `seams vary across the world (${seams.size} kinds found)`]);
ok.push([(seams.get('stone') || 0) > 100, 'barren chunks are common']);


const exc = MACHINE_BY_ID.excavator;
ok.push([exc?.outputs >= 9, `excavator storage slots (${exc?.outputs})`]);
ok.push([exc?.drillRate >= 1, `excavator drill rate (${exc?.drillRate})`]);
ok.push([!!exc?.spin, 'excavator spins a named node']);

for (const m of MACHINE_DEFS) {
  const shown = layoutFor(m).elements.filter((e) => e.type === 'slot' && /^output\d+$/.test(e.role)).length;
  ok.push([!shown || shown === (m.outputs || 4), `"${m.id}" layout shows all ${m.outputs || 4} output slots`]);
}
const excRec = MACHINE_BY_ID.assembler.recipes.find((r) => r.out.excavator);
ok.push([Object.keys(excRec.in).length >= 6, 'excavator recipe is expensive']);
for (const id of Object.keys(excRec.in)) ok.push([has(id), `excavator ingredient "${id}"`]);
for (const id of Object.keys(excRec.in)) {
  ok.push([gridOut.has(id) || machineOut.has(id), `excavator ingredient "${id}" is obtainable`]);
}


const bwe = MACHINE_BY_ID.bucket_wheel_excavator;
ok.push([!!bwe, 'bucket wheel excavator exists']);
ok.push([bwe?.kind === 'bwe', 'bucket wheel excavator has its own machine kind']);
ok.push([bwe?.outputs === 64, `bucket wheel excavator has 64 hold slots (${bwe?.outputs})`]);
ok.push([layoutFor(bwe).elements.some((e) => e.type === 'bwe'), 'bucket wheel excavator uses the scrollable BWE panel']);
const bweRec = MACHINE_BY_ID.assembler.recipes.find((r) => r.out.bucket_wheel_excavator);
ok.push([!!bweRec, 'assembler makes the bucket wheel excavator']);
ok.push([bweRec && Object.keys(bweRec.in).length >= 10, 'bucket wheel excavator recipe is enormous']);
ok.push([!!bweRec?.in.blueprint_excavator, 'bucket wheel excavator needs its blueprint']);
for (const id of Object.keys(bweRec?.in || {})) {
  ok.push([has(id), `bucket wheel excavator ingredient "${id}"`]);
  ok.push([gridOut.has(id) || machineOut.has(id), `bucket wheel excavator ingredient "${id}" is obtainable`]);
}
ok.push([has('bwe_controller'), 'bwe controller item exists']);
const ctrlRec = MACHINE_BY_ID.assembler.recipes.find((r) => r.out.bwe_controller);
ok.push([!!ctrlRec, 'assembler makes the bwe controller']);


const tb = MACHINE_BY_ID.test_bench;
ok.push([!!tb?.battery, 'test_bench runs on batteries']);
ok.push([tb?.energy?.gen > 0, 'test_bench generates power']);
ok.push([!!tb?.battery?.life, 'test_bench battery life set']);
ok.push([gridOut.has('test_bench'), 'test_bench grid-craftable']);
ok.push([TABLE_RECIPES.some((r) => r.out.test_bench), 'test_bench in the pocket table']);
ok.push([!!ITEM_DEFS.car_battery.battery, 'car battery is a battery']);
ok.push([layoutFor(tb).elements.some((e) => e.type === 'slot' && e.role === 'fuel'), 'test_bench has a battery slot']);
const bs = MACHINE_BY_ID.battery_stack;
const bsRec = MACHINE_BY_ID.assembler.recipes.find((r) => r.out.battery_stack);
ok.push([bs?.kind === 'storage' && bs.capacity > 0, 'battery stack stores grid power']);
ok.push([ITEM_DEFS.battery_stack?.workbench === 'battery_stack', 'battery stack has a placeable block']);
ok.push([bsRec && Object.keys(bsRec.in).length === 3 && bsRec.in.car_battery === 6 && bsRec.in.iron_plate === 5 && bsRec.in.cable === 4, 'battery stack costs 6 car batteries, 5 iron plates and 4 cable in the assembler']);
const bsLayout = JSON.parse(readFileSync(new URL('../../assets/ui/battery_stack.json', import.meta.url), 'utf8'));
ok.push([bsLayout.id === 'battery_stack' && !bsLayout.elements.some((e) => e.type === 'slot')
  && bsLayout.elements.some((e) => e.id === 'status') && bsLayout.elements.some((e) => e.type === 'batteryPie')
  && bsLayout.elements.every((e) => TYPES.has(e.type)), 'battery stack panel is a clean charge readout with a machine-drain square chart']);
for (const id of ['battery_stack', 'bed', 'pickup_box', 'ask_box', 'dropbox']) {
  ok.push([existsSync(new URL(`../../assets/models/workbenches/${id}.gltf`, import.meta.url)), `${id} has its own model`]);
}
const bedRec = CRAFT_RECIPES.find((r) => r.out.bed);
ok.push([MACHINE_BY_ID.bed?.sleep === true, 'bed lets you sleep']);
ok.push([bedRec && Object.keys(bedRec.needs).length === 2 && bedRec.needs.iron_ingot === 2 && bedRec.needs.herb === 5, 'bed costs 2 iron ingots and 5 herb']);
ok.push([TABLE_RECIPES.some((r) => r.out.bed), 'bed stays in the pocket table']);


const sys = new MachineSystem({
  THREE: { Group: class { constructor() { this.children = []; } add(o) { this.children.push(o); } } },
  ITEMS: ITEM_DEFS, inv: { hot: [], main: [], sel: 0 }, scene: { add() {} }, ui: { setBridge() {} },
});
ok.push([sys.powerCap({ def: {} }) === 400, 'every machine keeps at least 400 PU internally']);
ok.push([sys.powerCap({ def: { capacity: 2000 } }) === 2000, 'a storage machine keeps its own capacity']);
const drawM = { def: { energy: { use: 50 } }, state: { buffer: 0 }, netDraw: 0 };
sys.chargePower(drawM, 1, { pool: 100 });
ok.push([drawM.netDraw === 100 && drawM.state.buffer === 100, 'machines record what they drew from the grid']);
const drainBat = { def: bs, state: { usage: {} } };
sys.attributeDrain(drainBat, { members: [drainBat, { def: { id: 'electric_furnace' }, netDraw: 30 }, { def: { id: 'crusher' }, netDraw: 10 }] }, 40);
ok.push([drainBat.state.usage.electric_furnace === 30 && drainBat.state.usage.crusher === 10 && Object.keys(drainBat.state.usage).length === 2, 'battery drain is split among the drawing machines']);



sys.openInst = { def: { kind: 'storage' }, state: { slots: { slot0: { id: 'stone', n: 5 } } } };
sys.inv.hot = [{ id: 'stone', n: 10 }, { id: 'wood', n: 3 }];
ok.push([sys.drop(0, 'slot0') && sys.openInst.state.slots.slot0.n === 15 && !sys.inv.hot[0], 'shift deposit merges into the same item']);
ok.push([sys.drop(1, 'slot0') === false && sys.inv.hot[1]?.id === 'wood' && sys.openInst.state.slots.slot0.id === 'stone', 'shift deposit never swaps a different item out']);
sys.openInst = null;
const spinNode = { turns: 0, rotateY(a) { this.turns += a; } };
const mkExc = (x, z) => ({
  def: exc, x, z, spinNode,
  state: { slots: {}, progress: 0, heat: 0, buffer: 0, status: '' },
});
function findRegion(want) {
  for (let rx = 0; rx < 400; rx++) for (let rz = 0; rz < 400; rz++) {
    if (regionOre(rx * ORE_REGION_SIZE + 5, rz * ORE_REGION_SIZE + 5) === want) {
      return mkExc(rx * ORE_REGION_SIZE + 5, rz * ORE_REGION_SIZE + 5);
    }
  }
  return null;
}
const iron = findRegion('iron');
ok.push([!!iron, 'an iron seam exists somewhere']);
const net = { pool: 1e6, cap: 1e6 };
const tickExc = (m, dt, n) => { sys.chargePower(m, dt, n); sys.tickExcavator(m, dt, n); };
tickExc(iron, 1, net);
ok.push([iron.state.slots.output0?.id === 'iron', `excavator yields its seam (${iron.state.slots.output0?.id})`]);
ok.push([spinNode.turns > 0, 'digger wheel turns while working']);
ok.push([net.pool < 1e6, 'excavator draws power']);
const spun = spinNode.turns;
tickExc({ ...iron, state: { slots: {}, progress: 0, status: '' } }, 1, { pool: 0, cap: 0 });
ok.push([spinNode.turns === spun, 'digger wheel is still when unpowered']);
const barren = findRegion('stone');
tickExc(barren, 1, net);
ok.push([barren.state.status === 'BARREN GROUND', `barren seam says so (${barren.state.status})`]);
const full = mkExc(iron.x, iron.z);
for (let i = 0; i < exc.outputs; i++) full.state.slots[`output${i}`] = { id: 'iron', n: 99 };
sys.tickExcavator(full, 5, net);
ok.push([full.state.status === 'OUTPUT FULL', 'full storage stops the drill']);

const bench = { def: tb, x: 0, z: 0, state: { slots: { fuel: { id: 'car_battery', n: 2 } }, burnT: 0, status: '' } };
const bnet = { pool: 0, cap: 1e6 };
sys.tickBattery(bench, tb.battery.life, bnet);
ok.push([bnet.pool > 0, 'test bench powers a network from a battery']);
ok.push([bench.state.slots.fuel.n === 1, 'spent battery is consumed']);
sys.tickBattery({ ...bench, state: { slots: {}, burnT: 0, status: '' } }, 1, bnet);

sys.ctx.world = { waterAt: () => 0, useWater() {} };
const mkReactor = (rodIds) => {
  const slots = { fuel: { id: 'leu_235_fuel', n: 4 } };
  rodIds.forEach((id, i) => { slots[`rod${i}`] = { id, n: 1 }; });
  return {
    def: reac, x: 0, y: 0, z: 0,
    state: { slots, heat: 0, burning: false, burnT: 0, buffer: 0, status: '', progress: 0 },
  };
};
const runReactor = (rodIds) => {
  const m = mkReactor(rodIds);
  const n = { pool: 0, cap: 1e6 };
  sys.tickReactor(m, 1, n);
  return { m, power: n.pool };
};

const matched = runReactor(['control_rod', 'control_rod', 'control_rod', 'control_rod']);
const over = runReactor(new Array(REACTOR_ROD_SLOTS).fill('heavy_water_rod'));
const under = runReactor([]);
ok.push([matched.power > over.power, `matched cooling out-produces over-cooling (${matched.power.toFixed(0)} vs ${over.power.toFixed(0)})`]);
ok.push([matched.m.state.heat <= 0.001, 'matched cooling holds the core at temperature']);
ok.push([under.m.state.heat > 0, 'an uncooled core heats up']);
ok.push([under.m.state.status.startsWith('NO COOLANT'), 'an empty core reports no coolant']);
ok.push([matched.m.state.coolMatch > 0.99, 'matched layout reports a full cooling match']);


const asm = MACHINE_BY_ID.assembler.recipes;
const lab = MACHINE_BY_ID.research_lab;
ok.push([!!lab, 'research_lab exists']);
for (const bp of ['blueprint_reactor', 'blueprint_fusion', 'blueprint_scrubber', 'blueprint_containment']) {
  ok.push([has(bp), `blueprint "${bp}" exists`]);
  ok.push([(lab.recipes || []).some((r) => r.out[bp]), `research lab makes ${bp}`]);
}
for (const id of ['blueprint_fusion', 'blueprint_scrubber', 'blueprint_containment']) {
  const rec = lab.recipes.find((r) => r.out[id]);
  ok.push([!!rec && Object.keys(rec.in).length >= 3, `${id} needs a real sample set`]);
}
const fissRec = asm.find((r) => r.out.fission_reactor);
ok.push([!!fissRec?.in.blueprint_reactor, 'fission reactor requires the reactor blueprint']);
const fusionRec = asm.find((r) => r.out.fusion_reactor);
ok.push([!!fusionRec?.in.blueprint_fusion, 'fusion reactor requires the fusion blueprint']);
const scrubRec = asm.find((r) => r.out.atmospheric_scrubber);
ok.push([!!scrubRec?.in.blueprint_scrubber, 'scrubber requires the scrubber blueprint']);
const suitRec = asm.find((r) => r.out.containment_chestplate);
ok.push([!!suitRec && ['containment_helmet', 'containment_chestplate', 'containment_leggings', 'containment_boots', 'containment_gloves'].every((id) => suitRec.out[id]),
  'one blueprint builds the whole containment suit']);

const fus = ITEM_DEFS.fusion_fuel;
ok.push([!!fus?.fuel, 'fusion fuel exists']);
ok.push([fus.fuel.power > ITEM_DEFS.hep_239_fuel.fuel.power, 'fusion out-powers the best fission fuel']);
ok.push([!!DEPLETED_OF.fusion_fuel && has(DEPLETED_OF.fusion_fuel), 'fusion fuel has a depleted form']);
ok.push([MACHINE_BY_ID.isotope_separator.recipes.some((r) => r.out?.fusion_fuel), 'isotope separator makes fusion fuel']);
ok.push([MACHINE_BY_ID.fuel_reprocessor.recipes.some((r) => r.in?.depleted_fusion), 'reprocessor recycles fusion fuel']);

const scrubDef = MACHINE_BY_ID.atmospheric_scrubber;
ok.push([scrubDef?.kind === 'scrubber' && scrubDef.ambientCut > 0, 'scrubber cuts ambient dose']);
ok.push([!!scrubDef.filter && has(scrubDef.filter.item), 'scrubber filter is an item']);
ok.push([asm.some((r) => r.out?.[scrubDef.filter.item]), 'scrubber filters are craftable']);
const scrub = { def: scrubDef, x: 0, y: 0, z: 0, state: { slots: { fuel: { id: scrubDef.filter.item, n: 2 } }, buffer: 1000, status: '', progress: 0, burnT: 0 } };
sys.tickScrubber(scrub, 1, { pool: 1000, cap: 1000 });
ok.push([sys.scrubbers.length === 1, 'a powered scrubber registers as active']);
ok.push([Math.abs(sys.ambientCut() - scrubDef.ambientCut) < 1e-9, 'active scrubbers reduce ambient dose']);
const dry = { def: scrubDef, x: 0, y: 0, z: 0, state: { slots: {}, buffer: 1000, status: '', progress: 0, burnT: 0 } };
sys.scrubbers.length = 0;
sys.tickScrubber(dry, 1, { pool: 1000, cap: 1000 });
ok.push([sys.scrubbers.length === 0 && dry.state.status === 'NO FILTER', 'a scrubber without a filter does nothing']);
ok.push([!!ITEM_DEFS.plasma_drill?.tool, 'plasma drill is a tool']);
ok.push([asm.some((r) => r.out?.plasma_drill), 'plasma drill is assembler-made']);



sys.absorbers.length = 0;
ok.push([sys.absorbFactor(0, 0) === 1, 'no absorbers means no field cut']);
sys.absorbers.push({ def: MACHINE_BY_ID.radiation_absorber, x: 0, z: 0 });
ok.push([Math.abs(sys.absorbFactor(0, 0) - 0.65) < 1e-9, 'one absorber cuts 35% at its center']);
for (let i = 0; i < 6; i++) sys.absorbers.push({ def: MACHINE_BY_ID.radiation_absorber, x: 0, z: 0 });
ok.push([sys.absorbFactor(0, 0) === TUNING.ABSORB_FLOOR, 'stacked absorbers stop at the floor']);
sys.absorbers.length = 0;
sys.inv.armor = {};
ok.push([sys.radProtect() === 0, 'no armor means no ambient protection']);
sys.inv.armor = { head: { id: 'containment_helmet' } };
const protect = sys.radProtect();
ok.push([protect > 0 && protect < 0.8, `worn armor protects ambient below the cap (${protect.toFixed(2)})`]);

const ACH_STATS = new Set(['mined', 'placed', 'crafted', 'machines', 'kills', 'dosePeak', 'research', 'fuel', 'walked', 'days', 'chopped', 'blasts', 'harvested', 'cooked', 'eaten', 'read']);
const achIds = new Set();
for (const type of ACHIEVEMENT_TYPES) {
  ok.push([!achIds.has(type.id) && !!type.name, `achievement type "${type.id}" is unique and named`]);
  achIds.add(type.id);
  ok.push([type.tiers.length >= 4 || type.tiers.some((t) => t.secret), `"${type.id}" has at least four tiers (${type.tiers.length})`]);
  let prevNeed = -1;
  for (const tier of type.tiers) {
    ok.push([has(tier.icon), `"${type.id}" tier "${tier.name}" icon "${tier.icon}" is an item`]);
    if (tier.stat) {
      ok.push([ACH_STATS.has(tier.stat) && Number.isFinite(tier.need) && tier.need > prevNeed,
        `"${type.id}" tier "${tier.name}" has a rising, tracked stat`]);
      prevNeed = tier.need;
    } else {
      ok.push([!!(tier.built ? MACHINE_BY_ID[tier.built] : tier.started), `"${type.id}" tier "${tier.name}" has a real goal`]);
    }
  }
}
for (const id of ['lumberjack', 'demolition', 'forager', 'chef', 'gourmet']) {
  ok.push([achIds.has(id), `new achievement category "${id}" exists`]);
}
ok.push([COOKED_DISHES.size >= 6, `the cooking machines make at least six distinct dishes (${COOKED_DISHES.size})`]);
for (const id of COOKED_DISHES) ok.push([has(id), `dish "${id}" is a real item`]);
const foodCount = Object.values(ITEM_DEFS).filter((d) => d.consumable && d.consumable.food).length;
for (const type of ACHIEVEMENT_TYPES) for (const tier of type.tiers) {
  if (tier.stat === 'cooked') ok.push([tier.need <= COOKED_DISHES.size, `chef tier "${tier.name}" is reachable`]);
  if (tier.stat === 'eaten') ok.push([tier.need <= foodCount, `gourmet tier "${tier.name}" is reachable`]);
}

for (const [name, table] of [['barrel loot', BARREL_LOOT], ['scrap recycle', SCRAP_RECYCLE_TABLE]]) {
  ok.push([table.length >= 15, `${name} has a wide pool (${table.length} entries)`]);
  for (const [id, w] of table) {
    ok.push([has(id) && w > 0, `${name} entry "${id}" is a real item with positive weight`]);
  }
  for (let i = 0; i < 200; i++) ok.push([has(rollWeighted(table)), `${name} rolls a real item`]);
}


ok.push([ITEM_DEFS.rials?.stack === 9000, 'rials stack to 9000 per slot']);
ok.push([RIAL_VALUE.rials === undefined && rialValue('rials') === 0, 'rials cannot be resold']);
for (const id of Object.keys(RIAL_VALUE)) ok.push([has(id) && RIAL_VALUE[id] > 0, `price list entry "${id}" is a real item with a positive price`]);
for (const id of ['servo', 'not_an_item']) ok.push([rialValue(id) > 0, `unlisted item "${id}" still has a fallback price`]);
const pickup = MACHINE_BY_ID.pickup_box, ask = MACHINE_BY_ID.ask_box;
const dropbox = MACHINE_BY_ID.dropbox, pod = MACHINE_BY_ID.drop_pod;
ok.push([pickup?.kind === 'pickup' && pickup.solo >= 8, 'pickup box keeps its distance from workbenches']);
ok.push([ask?.kind === 'askbox' && ask.solo >= 8, 'ask box keeps its distance from workbenches']);
ok.push([dropbox?.kind === 'drop' && pod?.kind === 'drop' && dropbox.model === pod.model, 'both deliveries share one model']);
ok.push([!!CRAFT_RECIPES.find((r) => r.out?.pickup_box) && !!CRAFT_RECIPES.find((r) => r.out?.ask_box), 'both boxes are craftable']);
const pickLayout = layoutFor(pickup), askLayout = layoutFor(ask), dropLayout = layoutFor(dropbox);
ok.push([pickLayout.elements.filter((e) => e.type === 'slot' && /^input\d+$/.test(e.role)).length === 8, 'pickup box has eight stock slots']);
ok.push([dropLayout.elements.filter((e) => e.type === 'slot' && /^output\d+$/.test(e.role)).length === 8, 'drop box has eight collection slots']);
ok.push([askLayout.elements.some((e) => e.type === 'orders') && askLayout.elements.some((e) => e.role === 'pay0'), 'ask box has the order picker and a rial slot']);
ok.push([askLayout.elements.some((e) => e.type === 'button' && e.action === 'payExact'), 'ask box has a pay-exact button']);
const stock = {}; for (let i = 0; i < 8; i++) stock[`input${i}`] = i < 2 ? { id: 'iron_ingot', n: 5 } : null;
const sale = saleValue(stock);
ok.push([sale.count === 10 && sale.total === 80, 'pickup box prices its stock']);
const known = () => true, none = () => false;
const plain = offerPrice([{ id: 'iron_ingot', n: 2 }], known, known);
const unseen = offerPrice([{ id: 'iron_ingot', n: 2 }], none, known);
ok.push([plain.price === 16 && unseen.price === 128, 'an item never held costs eight times more']);
const locked = offerPrice([{ id: 'pickup_box', n: 1 }], known, none);
ok.push([locked.blocked && !Object.keys(locked.out).length, 'a workbench never made cannot be ordered']);
for (const id of ['rials', 'dropbox', 'drop_pod']) {
  const cheat = offerPrice([{ id, n: 9000 }], known, known);
  ok.push([cheat.price === 0 && !Object.keys(cheat.out).length, `"${id}" cannot be ordered from the IRGC`]);
}
ok.push([ITEM_DEFS.flare?.flare === true && ITEM_DEFS.flare.stack === 16, 'flare is a stackable IRGC signal']);
ok.push([!!CRAFT_RECIPES.find((r) => r.out?.flare) && TABLE_RECIPES.some((r) => r.out?.flare), 'a flare is craftable in the field']);
for (const id of ['rials', 'flare', 'crowbar']) {
  const p = ITEM_DEFS[id]?.icon;
  ok.push([p === `assets/images/items/${id}.png` && existsSync(new URL(`../../${p}`, import.meta.url)), `"${id}" uses a real item icon`]);
}
ok.push([LORE_BOOKS.every((id) => ITEM_DEFS[id]?.icon === 'assets/images/items/book.png')
  && existsSync(new URL('../../assets/images/items/book.png', import.meta.url)), 'all field notes share one real book icon']);
ok.push([LORE_BOOKS.length >= 4 && LORE_BOOKS.every((id) => ITEM_DEFS[id]?.book && ITEM_DEFS[id].lore?.title && ITEM_DEFS[id].lore?.text), 'every lore book is a readable document']);
ok.push([LORE_POD_LOOT.length >= 8 && LORE_POD_LOOT.every(([id, w]) => has(id) && w > 0), 'the pod loot pool is a thin pool of real items']);
for (let i = 0; i < 100; i++) ok.push([has(rollWeighted(LORE_POD_LOOT)), 'pod loot rolls a real item']);
const secret = ACHIEVEMENT_TYPES.find((t) => t.id === 'archivist');
ok.push([secret?.tiers.length === 1 && secret.tiers[0].secret && secret.tiers[0].stat === 'read' && secret.tiers[0].need === LORE_BOOKS.length, 'reading every note unlocks one hidden achievement']);

const bad = ok.filter(([p]) => !p);
if (bad.length) { for (const [, msg] of bad) console.error('FAIL:', msg); process.exit(1); }
console.log(`content OK: ${ok.length} assertions`);

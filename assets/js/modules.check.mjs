import { readFileSync, existsSync } from 'node:fs';
import { ITEM_DEFS, CRAFT_RECIPES, TABLE_RECIPES } from './content.js';
import { MODULE_MAX, MODULE_ROLES, moduleCounts, powerMult, speedMult, moduleAllowed, modulePut, formatPower } from './modules.js';

const results = [];
const check = (cond, msg) => results.push([!!cond, msg]);
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const role of MODULE_ROLES) {
  const d = ITEM_DEFS[role];
  check(!!d, `${role} exists in ITEM_DEFS`);
  check(d?.stack === MODULE_MAX, `${role} stack is capped at ${MODULE_MAX}`);
  check(!!d?.module, `${role} has a module flag`);
  check(!!d?.icon && existsSync(new URL(`../../${d.icon}`, import.meta.url)), `${role} icon file exists`);
  check(CRAFT_RECIPES.some((r) => r.out?.[role] === 1), `${role} has a craft recipe`);
  check(TABLE_RECIPES.some((r) => r.out?.[role] === 1), `${role} is on the pocket table`);
  const recipe = CRAFT_RECIPES.find((r) => r.out?.[role] === 1);
  check(!!recipe && Object.keys(recipe.needs || {}).every((id) => !!ITEM_DEFS[id]), `${role} recipe ingredients all exist`);
}

check(near(powerMult({}), 1), 'bare machine uses base power');
check(near(powerMult({ speed_module: { id: 'speed_module', n: 1 } }), 1.5), 'one speed module = 1.5x power');
check(near(powerMult({ speed_module: { id: 'speed_module', n: MODULE_MAX } }), Math.pow(1.5, MODULE_MAX)), 'fifty speed modules compound');
check(near(powerMult({ efficiency_module: { id: 'efficiency_module', n: MODULE_MAX } }), 0.7), 'efficiency trims at most 30%');
check(powerMult({ speed_module: { id: 'speed_module', n: 1 }, efficiency_module: { id: 'efficiency_module', n: MODULE_MAX } }) > 1, 'efficiency cannot outrun speed');
check(near(speedMult({ speed_module: { id: 'speed_module', n: 1 } }), 2), 'one speed module doubles output speed');
check(near(speedMult({ speed_module: { id: 'speed_module', n: 4 } }), 16), 'speed compounds');
check(moduleCounts({ speed_module: { n: 999 } }).speed === MODULE_MAX, 'speed count is capped at 50');
check(moduleCounts({ efficiency_module: { n: -5 } }).efficiency === 0, 'negative counts clamp to zero');

const speedRecipe = CRAFT_RECIPES.find((r) => r.out?.speed_module === 1);
const effRecipe = CRAFT_RECIPES.find((r) => r.out?.efficiency_module === 1);
check(speedRecipe?.needs.electric_motor === 1 && speedRecipe?.needs.iron_plate === 15, 'speed module costs 1 motor + 15 iron plates');
check(effRecipe?.needs.circuit_basic === 2 && effRecipe?.needs.copper_solenoid === 5, 'efficiency module costs 2 basic circuits + 5 copper solenoids');

check(!moduleAllowed({ id: 'fission_reactor', kind: 'reactor' }), 'reactors have no module box');
check(!moduleAllowed({ id: 'fusion_reactor', kind: 'reactor' }), 'fusion reactors have no module box');
check(!moduleAllowed({ id: 'greenhouse', kind: 'processor' }), 'greenhouse has no module box');
check(moduleAllowed({ id: 'electric_furnace', kind: 'processor' }), 'processors get the module box');
check(moduleAllowed({ id: 'excavator', kind: 'excavator' }), 'excavators get the module box');
check(!moduleAllowed({ id: 'battery_stack', kind: 'storage' }), 'storage has no module box');
check(!moduleAllowed({ id: 'solar_panel', kind: 'generator' }), 'generators have no module box');

const put = modulePut('speed_module', { id: 'speed_module', n: 60 }, null, 50);
check(put?.slot.n === 50 && put.left === 10, 'slot put caps at 50 and returns the rest');
const merged = modulePut('speed_module', { id: 'speed_module', n: 10 }, { id: 'speed_module', n: 45 }, 50);
check(merged?.slot.n === 50 && merged.left === 5, 'slot merge respects the cap');
check(modulePut('efficiency_module', { id: 'speed_module', n: 1 }, null) === null, 'wrong module refused');
check(modulePut('speed_module', { id: 'speed_module', n: 1, liquid: { id: 'water', amount: 1 } }, null) === null, 'liquid stack refused');

const machineSource = readFileSync(new URL('./machines.js', import.meta.url), 'utf8');
check(/craftCost\(m\).*powerMult/s.test(machineSource), 'craft cost uses the module multiplier');
check(machineSource.includes('this.useRate(m) * dt'), 'processor power draw uses the module multiplier');
check(machineSource.includes('d.energy.use * 3 * powerMult(m.state.slots)'), 'local buffer cap scales so modded machines can be fed');
check(machineSource.includes('formatPower(buf)} / ${formatPower(cap)}'), 'power meter formats large figures');
check(formatPower(80340309027) === '80.3B', 'huge power figures display compactly');
check(formatPower(1800) === '1800', 'ordinary power figures are unchanged');
check(machineSource.includes("if (m.state.status === 'NO POWER') return { value: 0, text: 'NO POWER' };"), 'power meter says NO POWER when the machine stalls');
check(machineSource.includes('this.productionRate(m)'), 'production speed uses the module multiplier');
check(machineSource.includes('if (MODULE_ROLES.includes(key)) continue;'), 'module slots survive restore');

let failed = 0;
for (const [ok, msg] of results) {
  if (!ok) { failed++; console.error(`FAIL: ${msg}`); }
}
console.log(`${results.length - failed}/${results.length} module checks passed`);
if (failed) process.exit(1);

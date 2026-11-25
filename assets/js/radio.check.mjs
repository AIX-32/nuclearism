import { existsSync } from 'node:fs';
import { RADIO_STATIC, RADIO_SIGNAL, secondsUntilStrike, radioTrack, nextStrikeDay } from './radio.js';
import { ITEM_DEFS, CRAFT_RECIPES, TABLE_RECIPES } from './content.js';

const ok = [];
const check = (cond, msg) => ok.push([!!cond, msg]);

check(existsSync(RADIO_STATIC), 'static clip exists');
check(existsSync(RADIO_SIGNAL), 'websdr clip exists');
check(!!ITEM_DEFS.radio?.radio, 'radio is a held item');
check(CRAFT_RECIPES.some((r) => r.out.radio === 1), 'radio is craftable');
check(TABLE_RECIPES.some((r) => r.out.radio === 1), 'radio is on the pocket table');

check(radioTrack('radio', true, 181) === RADIO_SIGNAL, 'warning plays while a strike is pending');
check(radioTrack('radio', true, 180) === RADIO_STATIC, 'warning cuts to static at T-3min');
check(radioTrack('radio', true, -5) === RADIO_STATIC, 'static after impact');
check(radioTrack('radio', false, 500) === RADIO_STATIC, 'static when no strike is scheduled');
check(radioTrack('pick', true, 500) === null, 'silent unless the radio is held');
check(secondsUntilStrike({ day: 9, t: 800 }, 10, 900) === 100, 'day/clock countdown');
check(secondsUntilStrike({ day: 9, t: 0 }, 10, 900) === 900, 'countdown at day start');
check(nextStrikeDay(1, 10) === 10, 'first strike is day 10');
check(nextStrikeDay(10, 10) === 20, 'next window after a strike');
check(nextStrikeDay(35, 10) === 40, 'old save backfill');

const failed = ok.filter(([pass]) => !pass);
if (failed.length) {
  for (const [, msg] of failed) console.error('FAIL:', msg);
  process.exit(1);
}
console.log(`radio: ${ok.length} assertions ok`);

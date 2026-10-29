







import { LIQUID_DEFS } from './content.js';

export const LIQUIDS = LIQUID_DEFS;

export const liquidDef = (id) => LIQUIDS[id] || null;
export const containerDef = (itemDef) => (itemDef && itemDef.container) || null;


export function volume(stack) {
  return stack && stack.liquid ? stack.liquid.amount : 0;
}

export function capacity(itemDef) {
  return itemDef && itemDef.container ? itemDef.container.capacity : 0;
}



export function accepts(itemDef, liquidId) {
  const c = containerDef(itemDef);
  const L = liquidDef(liquidId);
  if (!c || !L) return false;
  if (L.acidic && !c.acidProof) return false;
  if (c.filter && !c.filter.includes(liquidId)) return false;
  return true;
}



export function fill(stack, itemDef, liquidId, amount) {
  if (!stack || !accepts(itemDef, liquidId) || !(amount > 0)) return 0;
  const cur = stack.liquid;
  if (cur && cur.id !== liquidId) return 0;
  const room = capacity(itemDef) - (cur ? cur.amount : 0);
  const add = Math.min(amount, room);
  if (add <= 0) return 0;
  stack.liquid = { id: liquidId, amount: (cur ? cur.amount : 0) + add };
  return add;
}


export function drain(stack, amount) {
  if (!stack || !stack.liquid) return 0;
  const take = Math.min(amount, stack.liquid.amount);
  stack.liquid.amount -= take;
  if (stack.liquid.amount <= 1e-6) delete stack.liquid;
  return take;
}


export function transfer(fromStack, fromDef, toStack, toDef, amount = Infinity) {
  if (!fromStack || !fromStack.liquid) return 0;
  const moved = fill(toStack, toDef, fromStack.liquid.id, Math.min(amount, fromStack.liquid.amount));
  if (moved) drain(fromStack, moved);
  return moved;
}



export function sanitize(stack, itemDef) {
  if (!stack || !stack.liquid) return;
  const L = liquidDef(stack.liquid.id);
  if (!L || !accepts(itemDef, stack.liquid.id)) { delete stack.liquid; return; }
  stack.liquid.amount = Math.max(0, Math.min(capacity(itemDef), +stack.liquid.amount || 0));
  if (stack.liquid.amount <= 1e-6) delete stack.liquid;
}

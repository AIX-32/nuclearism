

export const MODULE_MAX = 50;
export const MODULE_ROLES = ['speed_module', 'efficiency_module'];

export function moduleCounts(slots) {
  return {
    speed: Math.min(MODULE_MAX, Math.max(0, slots?.speed_module?.n | 0)),
    efficiency: Math.min(MODULE_MAX, Math.max(0, slots?.efficiency_module?.n | 0)),
  };
}

export function powerMult(slots) {
  const { speed, efficiency } = moduleCounts(slots);
  return Math.pow(1.5, speed) * Math.max(0.7, 1 - efficiency * 0.01);
}

export function speedMult(slots) {
  return Math.pow(2, moduleCounts(slots).speed);
}

const MAKER_KINDS = new Set(['crafting', 'processor', 'excavator', 'bwe', 'scrubber', 'pump']);

export function moduleAllowed(def) {
  return !!def && def.kind !== 'reactor' && def.id !== 'greenhouse' && MAKER_KINDS.has(def.kind);
}


export function formatPower(n) {
  n = Math.round(n || 0);
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${n}`;
}


export function modulePut(role, stack, cur, cap = MODULE_MAX) {
  if (!stack || stack.id !== role || stack.liquid || !MODULE_ROLES.includes(role)) return null;
  if (cur && cur.id !== role) return null;
  const held = cur?.n || 0;
  const n = Math.min(cap, held + (stack.n || 0));
  return { slot: { id: role, n }, left: (stack.n || 0) - (n - held) };
}

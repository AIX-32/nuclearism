// Skyline logistics.
//
// A pylon is a tall mast near a group of machines. With the zipline wrench
// the player picks an item up from one workbench and sends it to another: the
// item rides the wire between the two pylons in a cargo pod and lands in the
// destination's input slots, where the machine picks it up and crafts on its
// own.
//
// Nothing in here needs art: a pod is a small box and a wire is a line.

import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CraftOptions } from './craft-options.js';
import { TUNING } from './content.js';

const MAXSTACK = 99;
const POD_CAP = 32;

export const SKYLINE_MODE = { RECIPE: 'recipe', STORE: 'store' };

// --- pure helpers -----------------------------------------------------------

// A recipe's real ingredient list. `in` recipes net their own output out of
// the inputs, the same way the crafting bench does.
export function recipeNeeds(recipe) {
  if (!recipe) return {};
  const needs = { ...(recipe.in || recipe.needs || {}) };
  if (recipe.in) {
    for (const [id, n] of Object.entries(recipe.out || {})) {
      if (!needs[id]) continue;
      needs[id] = Math.max(0, needs[id] - n);
      if (!needs[id]) delete needs[id];
    }
  }
  return needs;
}

// What a recipe actually hands over.
export function recipeOutputs(recipe) {
  if (!recipe) return {};
  const out = { ...(recipe.out || {}) };
  if (!recipe.in) return out;
  for (const [id, n] of Object.entries(recipe.in || {})) {
    if (!out[id]) continue;
    out[id] = Math.max(0, out[id] - n);
    if (!out[id]) delete out[id];
  }
  return out;
}

// The recipes a machine can run. Crafting benches use the bag recipes.
export function recipeList(machine, craftRecipes) {
  if (!machine) return [];
  if (machine.def.kind === 'crafting') return craftRecipes || [];
  if (machine.def.kind === 'processor') return machine.def.recipes || [];
  return [];
}

// A stable name for a placed machine, so a route survives a save/load.
export function machineKey(machine) {
  if (!machine) return '';
  return `${machine.def.id}@${machine.x.toFixed(2)},${machine.y.toFixed(2)},${machine.z.toFixed(2)}`;
}

export function outputRoles(machine) {
  const n = machine?.def?.outputs || 4;
  const roles = [];
  for (let i = 0; i < n; i++) roles.push(`output${i}`);
  return roles;
}

export function storageRoles(machine) {
  const n = machine?.def?.storageSlots || 14;
  const roles = [];
  for (let i = 0; i < n; i++) roles.push(`slot${i}`);
  return roles;
}

export function inputRoles() { return ['input0', 'input1', 'input2', 'input3']; }

// Where a delivered item belongs in the destination.
export function deliveryRoles(machine, itemId, items) {
  if (!machine) return [];
  const def = machine.def;
  if (def.kind === 'storage') return storageRoles(machine);
  if (def.kind === 'reactor') {
    const it = items?.[itemId];
    if (it?.rod) {
      const n = def.rodSlots || 5;
      const roles = [];
      for (let i = 0; i < n; i++) roles.push(`rod${i}`);
      return roles;
    }
    if (it?.fuel) return ['fuel'];
    return [];
  }
  return inputRoles();
}

// Everything a machine could hand to a pod: what it holds right now plus
// whatever it is able to make.
export function sourceItems(machine, craftRecipes) {
  const out = new Map();
  const add = (id, n) => {
    if (!id || !n) return;
    const cur = out.get(id) || { id, n: 0 };
    cur.n += n;
    out.set(id, cur);
  };
  if (!machine) return [];
  const slots = machine.state.slots || {};
  const held = machine.def.kind === 'storage' ? storageRoles(machine) : outputRoles(machine);
  for (const role of held) {
    const s = slots[role];
    if (s?.id) add(s.id, s.n || 1);
  }
  for (const r of recipeList(machine, craftRecipes)) {
    for (const [id, n] of Object.entries(recipeOutputs(r))) add(id, n);
  }
  return [...out.values()];
}

// What the destination can do with the item: every recipe that eats it.
// A container has no recipes, so it just stores the item.
export function destItems(machine, itemId, craftRecipes) {
  const opts = [];
  const list = recipeList(machine, craftRecipes);
  list.forEach((r, i) => {
    const needs = recipeNeeds(r);
    if (!needs[itemId]) return;
    const outs = recipeOutputs(r);
    const names = Object.entries(outs).map(([id, n]) => `${n}× ${id}`).join(' + ');
    opts.push({
      mode: SKYLINE_MODE.RECIPE, idx: i, recipe: r,
      label: names || itemId,
      needs,
      time: r.time || 0,
      outId: Object.keys(outs)[0] || itemId,
      outCount: Object.values(outs)[0] || 1,
    });
  });
  if (!opts.length) {
    opts.push({
      mode: SKYLINE_MODE.STORE, idx: -1, recipe: null,
      label: machine?.def?.kind === 'storage' ? 'STORE IN CONTAINER' : 'DELIVER ONLY',
      needs: { [itemId]: 1 }, time: 0, outId: itemId, outCount: 1,
    });
  }
  return opts;
}

// The auto-connect rule: a destination that already runs a recipe does not
// need to be asked again when another source feeds that same recipe.
export function matchRoute(routes, dstKey, itemId) {
  if (!Array.isArray(routes)) return null;
  const hits = routes.filter((r) => r.dstKey === dstKey && r.mode === SKYLINE_MODE.RECIPE
    && r.needs && r.needs[itemId]);
  return hits.length ? hits[0] : null;
}

// --- slot helpers -----------------------------------------------------------

// Put a stack into the first roles that take it. Returns what did not fit.
export function pushIntoSlots(slots, roles, stack) {
  if (!stack || !stack.n) return null;
  let rest = { ...stack };
  for (const role of roles) {
    if (!rest) break;
    const cur = slots[role];
    if (cur && cur.id === rest.id && !cur.liquid && !rest.liquid && cur.n < MAXSTACK) {
      const move = Math.min(MAXSTACK - cur.n, rest.n);
      cur.n += move;
      rest = rest.n > move ? { ...rest, n: rest.n - move } : null;
    }
  }
  for (const role of roles) {
    if (!rest) break;
    if (slots[role]) continue;
    const take = Math.min(MAXSTACK, rest.n);
    slots[role] = { ...rest, n: take };
    rest = rest.n > take ? { ...rest, n: rest.n - take } : null;
  }
  return rest;
}

// Take up to n of one item out of the given roles. Returns how much moved.
export function takeFromSlots(slots, roles, id, n) {
  let left = n, taken = 0;
  for (const role of roles) {
    if (left <= 0) break;
    const s = slots[role];
    if (!s || s.id !== id || s.liquid) continue;
    const take = Math.min(s.n, left);
    s.n -= take; left -= take; taken += take;
    if (s.n <= 0) slots[role] = null;
  }
  return taken;
}

// --- the panel --------------------------------------------------------------

class SkylineUI {
  constructor(system) {
    this.system = system;
    this.opened = false;
    this.onPick = null;
    this.root = document.createElement('section');
    this.root.className = 'skyline-screen';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="skyline-window">
        <header class="skyline-heading">
          <div><h1></h1><p class="skyline-sub"></p></div>
          <button type="button" class="skyline-close">ESC&nbsp; / &nbsp;CLOSE</button>
        </header>
        <div class="skyline-list"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.title = this.root.querySelector('h1');
    this.sub = this.root.querySelector('.skyline-sub');
    this.listNode = this.root.querySelector('.skyline-list');
    this.list = new CraftOptions({
      item: (id) => this.system.ctx.items?.[id],
      icon: (id) => this.system.ctx.icon?.(id),
      showTip: (s, x, y) => this.system.ctx.showTip?.(s, x, y),
      hideTip: () => this.system.ctx.hideTip?.(),
      emptyText: 'NOTHING TO MOVE',
      onCraft: (option) => { this.system.ctx.hideTip?.(); this.onPick?.(option); },
    });
    this.listNode.appendChild(this.list.el);
    this.root.querySelector('.skyline-close').addEventListener('click', () => this.close());
    this._key = (e) => {
      if (this.opened && e.code === 'Escape') { e.preventDefault(); this.close(); }
    };
    window.addEventListener('keydown', this._key);
  }

  open(title, sub, options, onPick) {
    this.onPick = onPick;
    this.title.textContent = title;
    this.sub.textContent = sub;
    this.list.set(options);
    this.root.hidden = false;
    this.opened = true;
    this.system.ctx.onOpen?.();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.onPick = null;
    this.root.hidden = true;
    this.system.ctx.onClosed?.();
  }
}

// --- the system -------------------------------------------------------------

export class SkylineSystem {
  constructor(ctx) {
    this.ctx = ctx;                 // { THREE, scene, items, machines, craftRecipes, notice, ... }
    this.T = ctx.THREE;
    this.routes = [];
    this.pods = [];
    this.nextId = 1;
    this.pending = null;            // { src, item } while a destination is picked
    this.acc = 0;
    this.now = 0;
    this.lastDispatch = new Map();
    this.group = new this.T.Group();
    this.group.name = 'skyline';
    ctx.scene.add(this.group);
    this.podGeo = new this.T.BoxGeometry(0.55, 0.42, 0.55);
    this.podMats = new Map();
    this.podTemplate = null;
    this.wireMat = new LineMaterial({ color: 0x000000, linewidth: 3, worldUnits: false });
    this.wireMat.resolution.set(window.innerWidth, window.innerHeight);
    this.networkWires = [];
    this._pylonSig = '';
    this._ui = null;

    if (ctx.GLTFLoader) {
      new ctx.GLTFLoader().load('assets/models/items/zipline_box.gltf', (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) return;
        const box = new this.T.Box3().setFromObject(root);
        const size = box.getSize(new this.T.Vector3());
        const max = Math.max(size.x, size.y, size.z) || 1;
        const s = 0.55 / max;
        root.scale.multiplyScalar(s);
        const c = box.getCenter(new this.T.Vector3());
        root.position.sub(c.multiplyScalar(s));
        this.podTemplate = root;
      });
    }
  }

  isOpen() { return !!this._ui?.opened; }

  closeUI() { this._ui?.close(); }

  // The panel is built the first time it is needed, so the system can also
  // run headless (the node check does).
  get ui() {
    if (!this._ui) this._ui = new SkylineUI(this);
    return this._ui;
  }

  get items() { return this.ctx.items || {}; }
  get craftRecipes() { return this.ctx.craftRecipes || []; }
  get machines() { return this.ctx.machines; }

  // --- pylons ---------------------------------------------------------------

  pylons() {
    if (!this.machines) return [];
    return this.machines.instances.filter((m) => m.def.kind === 'pylon');
  }

  accessRange(p) {
    const base = TUNING.SKYLINE_RANGE;
    return p?.def?.id === 'short_skyline_pylon' ? base / 2 : base;
  }

  pylonLinkRange(p) {
    const base = Math.max(TUNING.SKYLINE_RANGE * 8, 96);
    return p?.def?.id === 'short_skyline_pylon' ? base / 2 : base;
  }

  pylonFor(machine) {
    if (!machine || !this.machines) return null;
    let best = null, bestD = Infinity;
    for (const m of this.machines.instances) {
      if (m.def.kind !== 'pylon') continue;
      const d = Math.hypot(m.x - machine.x, m.z - machine.z);
      const r = this.accessRange(m);
      if (d <= r && d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  // Pylons always connect to nearby pylons, forming one network.
  rebuildNetwork() {
    this.wireMat.resolution.set(window.innerWidth, window.innerHeight);
    const list = this.pylons();
    const sig = list.map((p) => machineKey(p)).sort().join('|');
    if (sig === this._pylonSig) return;
    this._pylonSig = sig;
    for (const w of this.networkWires) {
      this.group.remove(w);
      w.geometry?.dispose?.();
    }
    this.networkWires = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const range = Math.min(this.pylonLinkRange(a), this.pylonLinkRange(b));
        if (Math.hypot(a.x - b.x, a.z - b.z) > range) continue;
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const p = this.wirePoint(a, b, k / 16);
          pts.push(p.x, p.y, p.z);
        }
        const geo = new LineGeometry();
        geo.setPositions(pts);
        const line = new Line2(geo, this.wireMat);
        this.group.add(line);
        this.networkWires.push(line);
      }
    }
  }

  pylonPath(from, to) {
    if (!from || !to) return null;
    if (from === to) return [from];
    const list = this.pylons();
    if (!list.includes(from) || !list.includes(to)) return null;
    const adj = new Map(list.map((p) => [p, []]));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const range = Math.min(this.pylonLinkRange(a), this.pylonLinkRange(b));
        if (Math.hypot(a.x - b.x, a.z - b.z) > range) continue;
        adj.get(a).push(b); adj.get(b).push(a);
      }
    }
    const prev = new Map([[from, null]]);
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      if (cur === to) break;
      for (const nb of (adj.get(cur) || [])) {
        if (prev.has(nb)) continue;
        prev.set(nb, cur);
        q.push(nb);
      }
    }
    if (!prev.has(to)) return null;
    const path = [];
    for (let cur = to; cur; cur = prev.get(cur)) path.push(cur);
    path.reverse();
    return path;
  }

  // --- the wrench ------------------------------------------------------------

  // Right-click a machine with the zipline wrench. The first click asks what
  // to take, the second asks where to put it.
  useWrenchOn(machine) {
    if (!machine) return true;
    if (!this.pylonFor(machine)) { this.ctx.notice?.('NO PYLON IN RANGE'); return true; }
    if (!this.pending) {
      const items = sourceItems(machine, this.craftRecipes);
      if (!items.length) { this.ctx.notice?.('NOTHING TO PICK UP'); return true; }
      const options = items.map((it) => ({
        key: it.id, id: it.id, count: it.n, label: this.items[it.id]?.name || it.id,
        needs: { [it.id]: it.n },
      }));
      this.ui.open(
        `PICK UP FROM ${(machine.def.name || machine.def.id).toUpperCase()}`,
        'Choose the item to send down the line. A bench with nothing feeding it keeps working from your bag.',
        options,
        (option) => this.chooseSource(machine, option.id),
      );
      return true;
    }
    const src = this.pending.src;
    const item = this.pending.item;
    if (machine === src) { this.ctx.notice?.('PICK ANOTHER MACHINE'); return true; }
    if (this.routes.some((r) => r.srcKey === machineKey(src) && r.dstKey === machineKey(machine) && r.item === item)) {
      this.ctx.notice?.('ALREADY LINKED');
      this.pending = null;
      this.closeUI();
      return true;
    }
    // The destination already runs a recipe that eats this item: no menu.
    const auto = matchRoute(this.routes, machineKey(machine), item);
    if (auto) {
      this.addRoute(src, machine, item, auto.mode, auto.idx);
      this.pending = null;
      this.closeUI();
      this.ctx.notice?.(`LINKED · ${item.toUpperCase()}`);
      return true;
    }
    const opts = destItems(machine, item, this.craftRecipes);
    if (!opts.length) { this.ctx.notice?.('NO RECIPE FOR ' + item.toUpperCase()); this.pending = null; this.closeUI(); return true; }
    const options = opts.map((o, i) => ({
      key: `${o.mode}:${i}`, id: o.outId, count: o.outCount, label: o.label,
      needs: o.needs, time: o.time,
    }));
    this.ui.open(
      `SEND ${(this.items[item]?.name || item).toUpperCase()} TO ${(machine.def.name || machine.def.id).toUpperCase()}`,
      opts.length > 1 ? 'Choose the recipe it should feed.' : 'This machine has no recipe for it: it will be stored.',
      options,
      (option) => {
        const chosen = opts.find((o, i) => `${o.mode}:${i}` === option.key) || opts[0];
        this.addRoute(src, machine, item, chosen.mode, chosen.idx);
        this.pending = null;
        this.closeUI();
        this.ctx.notice?.(`LINKED · ${item.toUpperCase()}`);
      },
    );
    return true;
  }

  chooseSource(machine, item) {
    this.pending = { src: machine, item };
    this.closeUI();
    this.ctx.notice?.(`NOW RIGHT-CLICK A DESTINATION`);
  }

  addRoute(src, dst, item, mode, idx) {
    const route = {
      id: this.nextId++,
      srcKey: machineKey(src),
      dstKey: machineKey(dst),
      item,
      mode,
      idx,
      needs: {},
      endWires: [],
    };
    const recipe = this.resolveRecipe(route, dst);
    if (recipe) route.needs = recipeNeeds(recipe);
    this.routes.push(route);
    this._pylonSig = '';
    this.rebuildNetwork();
    this.rebuildRouteWires();
    return route;
  }

  resolveRecipe(route, dst) {
    if (!route || route.mode !== SKYLINE_MODE.RECIPE) return null;
    const list = recipeList(dst, this.craftRecipes);
    return list[route.idx] || null;
  }

  // --- the wire --------------------------------------------------------------

  wirePoint(a, b, t) {
    const attachY = (p) => {
      if (p?.def?.kind === 'pylon') return p.y + (p.top - p.y) * (3.125 / 3.4);
      if (p?.top != null) return p.top + 0.45;
      return (p?.y ?? 0) + 1.2;
    };
    const A = new this.T.Vector3(a.x, attachY(a), a.z);
    const B = new this.T.Vector3(b.x, attachY(b), b.z);
    const p = A.clone().lerp(B, t);
    const sag = Math.min(2.5, A.distanceTo(B) * 0.06);
    p.y -= sag * 4 * t * (1 - t);
    return p;
  }

  buildLine(a, b) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const p = this.wirePoint(a, b, k / 16);
      pts.push(p.x, p.y, p.z);
    }
    const geo = new LineGeometry();
    geo.setPositions(pts);
    const line = new Line2(geo, this.wireMat);
    this.group.add(line);
    return line;
  }

  rebuildRouteWires() {
    this.wireMat.resolution.set(window.innerWidth, window.innerHeight);
    for (const route of this.routes) {
      for (const w of (route.endWires || [])) { this.group.remove(w); w.geometry?.dispose?.(); }
      route.endWires = [];
      const src = this.byKey(route.srcKey), dst = this.byKey(route.dstKey);
      if (!src || !dst) continue;
      const a = this.pylonFor(src), b = this.pylonFor(dst);
      if (a) route.endWires.push(this.buildLine(src, a));
      if (b) route.endWires.push(this.buildLine(b, dst));
    }
  }

  // --- the tick --------------------------------------------------------------

  dropRoute(route) {
    const i = this.routes.indexOf(route);
    if (i >= 0) this.routes.splice(i, 1);
    for (const w of (route.endWires || [])) { this.group.remove(w); w.geometry?.dispose?.(); }
    route.endWires = [];
  }

  byKey(key) {
    if (!this.machines) return null;
    for (const m of this.machines.instances) if (machineKey(m) === key) return m;
    return null;
  }

  hasIncoming(machine) {
    const key = machineKey(machine);
    return this.routes.some((r) => r.dstKey === key);
  }

  // The recipe at the source that makes the routed item.
  sourceRecipe(src, item) {
    for (const r of recipeList(src, this.craftRecipes)) {
      const outs = recipeOutputs(r);
      if (outs[item]) return r;
    }
    return null;
  }

  update(dt) {
    this.now += dt;
    const prevSig = this._pylonSig;
    this.rebuildNetwork();
    if (this._pylonSig !== prevSig) this.rebuildRouteWires();
    this.acc += dt;
    if (this.acc >= TUNING.SKYLINE_TICK) { this.acc = 0; this.logic(); }
    this.movePods(dt);
  }

  logic() {
    const live = [];
    for (const route of this.routes) {
      const src = this.byKey(route.srcKey);
      const dst = this.byKey(route.dstKey);
      // A machine or its access pylon went away: the line is dead.
      const a = src && this.pylonFor(src), b = dst && this.pylonFor(dst);
      if (!src || !dst || !a || !b || !this.pylonPath(a, b)) {
        this.dropRoute(route);
        continue;
      }
      live.push({ route, src, dst });
    }

    // The destination crafts what it was given.
    for (const { route, dst } of live) {
      if (route.mode !== SKYLINE_MODE.RECIPE) continue;
      const recipe = this.resolveRecipe(route, dst);
      if (recipe && !dst.state.job && !(dst.state.queue || []).length) {
        this.machines.startJobFromSlots(dst, recipe);
      }
    }

    // One source makes one thing at a time: the route that is still missing
    // its item gets the machine.
    const producer = new Map();
    for (const { route, src } of live) {
      const prev = producer.get(route.srcKey);
      if (!prev || this.prefers(src, route, prev.route)) producer.set(route.srcKey, { route, src });
    }
    for (const { route, src } of producer.values()) {
      if (src.def.kind !== 'processor' && src.def.kind !== 'crafting') continue;
      const recipe = this.sourceRecipe(src, route.item);
      if (!recipe || src.state.job || (src.state.queue || []).length) continue;
      const fed = this.machines.startJobFromSlots(src, recipe);
      // Nothing feeds the machine yet: fall back to the bag so a lone bench
      // still keeps working.
      if (!fed && !this.hasIncoming(src)) this.machines.startJob(src, recipe);
    }

    // Pick the item up and send it down the line.
    for (const { route, src, dst } of live) {
      if (this.podFor(route)) continue;
      const srcKey = route.srcKey;
      if (this.now - (this.lastDispatch.get(srcKey) || -Infinity) < 1) continue;
      const stack = this.takeFromSource(src, route.item);
      if (stack) {
        this.lastDispatch.set(srcKey, this.now);
        this.spawnPod(route, stack, src, dst);
      }
    }
  }

  // Does the source already hold the item of this route?
  holds(src, id) {
    for (const role of outputRoles(src)) if (src.state.slots[role]?.id === id) return true;
    return false;
  }

  // The route whose item the source does not have yet wins the machine.
  prefers(src, route, current) {
    const a = this.holds(src, route.item);
    const b = this.holds(src, current.item);
    if (a === b) return false;
    return !a;
  }

  takeFromSource(src, item) {
    const slots = src.state.slots || {};
    const roles = src.def.kind === 'storage' ? storageRoles(src) : outputRoles(src);
    const n = takeFromSlots(slots, roles, item, POD_CAP);
    return n ? { id: item, n } : null;
  }

  podFor(route) {
    return this.pods.find((p) => p.routeId === route.id) || null;
  }

  podMaterial(id) {
    const tint = this.items[id]?.tint;
    const key = tint == null ? 'plain' : String(tint);
    if (!this.podMats.has(key)) {
      this.podMats.set(key, new this.T.MeshLambertMaterial({
        color: tint == null ? 0xb8bec6 : tint,
        emissive: 0x111418,
        emissiveIntensity: 0.3,
      }));
    }
    return this.podMats.get(key);
  }

  spawnPod(route, stack, src, dst) {
    src = src || this.byKey(route.srcKey);
    dst = dst || this.byKey(route.dstKey);
    if (!src || !dst) return;
    const a = this.pylonFor(src), b = this.pylonFor(dst);
    const mid = this.pylonPath(a, b);
    if (!mid) return;
    const path = [src, ...mid, dst];
    if (path.length < 2) return;
    const mesh = this.podTemplate ? this.podTemplate.clone(true) : new this.T.Mesh(this.podGeo, this.podMaterial(stack.id));
    this.group.add(mesh);
    const pod = {
      routeId: route.id, dstKey: route.dstKey, item: stack.id, n: stack.n,
      path, seg: 0, t: 0, mesh, len: 0, v: 0,
      swing: (Math.random() - 0.5) * 0.5, swingVel: (Math.random() - 0.5) * 1.5,
      sway: (Math.random() - 0.5) * 0.25, swayVel: 0,
      bob: Math.random() * Math.PI * 2,
    };
    this.setPodSegment(pod);
    pod.v = TUNING.SKYLINE_SPEED * 0.15;
    this.placePod(pod);
    this.pods.push(pod);
  }

  setPodSegment(pod) {
    const a = pod.path[pod.seg], b = pod.path[pod.seg + 1];
    if (!a || !b) { pod.len = 0; return; }
    pod.len = Math.max(0.001, this.wirePoint(a, b, 0).distanceTo(this.wirePoint(a, b, 1)));
  }

  placePod(pod) {
    const a = pod.path[pod.seg], b = pod.path[pod.seg + 1];
    if (!a || !b) return;
    const p = this.wirePoint(a, b, pod.t);
    const p2 = this.wirePoint(a, b, Math.min(1, pod.t + 0.02));
    const dx = p2.x - p.x, dz = p2.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len, fz = dz / len; // forward along wire (XZ)
    const px = -fz, pz = fx;            // sideways
    const hang = 0.58 + Math.sin(pod.bob) * 0.04;
    pod.mesh.position.set(
      p.x + px * pod.swing * 0.24 + fx * pod.sway * 0.14,
      p.y - hang,
      p.z + pz * pod.swing * 0.24 + fz * pod.sway * 0.14,
    );
    pod.mesh.rotation.order = 'YXZ';
    pod.mesh.rotation.y = Math.atan2(fx, fz);
    pod.mesh.rotation.z = pod.swing * 0.45;
    pod.mesh.rotation.x = -pod.sway * 0.4;
  }

  movePods(dt) {
    const maxSpeed = TUNING.SKYLINE_SPEED;
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const pod = this.pods[i];
      if (!pod.path || pod.seg >= pod.path.length - 1) { this.group.remove(pod.mesh); this.pods.splice(i, 1); continue; }

      const a = pod.path[pod.seg], b = pod.path[pod.seg + 1];
      const p0 = this.wirePoint(a, b, pod.t);
      const aheadT = Math.min(1, pod.t + 0.03);
      const p1 = this.wirePoint(a, b, aheadT);
      const slope = (p1.y - p0.y) / Math.max(0.001, p0.distanceTo(p1)); // negative = going down

      // accelerate from slow to fast on every wire
      pod.v = Math.min(maxSpeed, (pod.v || maxSpeed * 0.15) + maxSpeed * 1.4 * dt);
      // downhill pulls you faster, uphill slows a bit
      pod.v = Math.max(maxSpeed * 0.12, Math.min(maxSpeed * 1.15, pod.v + (-slope) * 6 * dt));

      pod.swingVel += ((Math.random() - 0.5) * 14 - pod.swing * 22 - pod.swingVel * 2.2) * dt;
      pod.swing += pod.swingVel * dt;
      pod.swing = Math.max(-1.1, Math.min(1.1, pod.swing));

      // swing forward when going down, back when going up
      pod.swayVel += ((-slope) * 18 + (Math.random() - 0.5) * 6 - pod.sway * 18 - pod.swayVel * 2.6) * dt;
      pod.sway += pod.swayVel * dt;
      pod.sway = Math.max(-1.0, Math.min(1.0, pod.sway));

      pod.bob += dt * (7 + Math.abs(pod.swingVel) * 0.5 + Math.abs(pod.v) * 0.4);

      const step = (pod.v * dt) / Math.max(0.001, pod.len);
      pod.t = Math.min(1, pod.t + step);
      this.placePod(pod);
      if (pod.t < 1) continue;

      pod.seg++; pod.t = 0;
      pod.v = maxSpeed * 0.15;
      pod.swingVel += (Math.random() - 0.5) * 6 + (-slope) * 1.5;
      pod.swayVel += (Math.random() - 0.5) * 4 + (-slope) * 4;
      if (pod.seg < pod.path.length - 1) { this.setPodSegment(pod); this.placePod(pod); continue; }

      const dst = this.byKey(pod.dstKey);
      const roles = deliveryRoles(dst, pod.item, this.items);
      if (!dst || !roles.length) {
        pod.seg = pod.path.length - 2; pod.t = 1; pod.v = 0; this.placePod(pod);
        continue;
      }
      const slots = dst.state.slots || {};
      const rest = pushIntoSlots(slots, roles, { id: pod.item, n: pod.n });
      if (rest) {
        pod.n = rest.n;
        pod.seg = pod.path.length - 2; pod.t = 1; pod.v = 0; this.placePod(pod);
        continue;
      }
      this.group.remove(pod.mesh);
      this.pods.splice(i, 1);
    }
  }

  // --- persistence -----------------------------------------------------------

  serialize() {
    return this.routes.map((r) => ({
      s: r.srcKey, d: r.dstKey, i: r.item, m: r.mode, x: r.idx,
    }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!e || !e.s || !e.d) continue;
      const route = {
        id: this.nextId++,
        srcKey: e.s, dstKey: e.d, item: e.i, mode: e.m || SKYLINE_MODE.STORE,
        idx: e.x == null ? -1 : e.x,
        needs: {},
        endWires: [],
      };
      const dst = this.byKey(route.dstKey);
      const recipe = this.resolveRecipe(route, dst);
      if (recipe) route.needs = recipeNeeds(recipe);
      this.routes.push(route);
    }
    this._pylonSig = '';
    this.rebuildNetwork();
    this.rebuildRouteWires();
  }
}

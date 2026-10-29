













import { DEPLETED_OF, regionOre, REACTOR_ROD_SLOTS, formatRadRate } from './content.js';
import { drain, fill } from './liquids.js';

export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet', 'hands'];

const ORE_TABLE = [
  ['stone', 26], ['carbon', 10], ['copper', 14], ['tin', 10], ['iron', 14], ['lead', 8],
  ['uranium', 7], ['lithium', 4], ['boron', 3], ['magnesium', 3], ['zirconium', 2],
  ['beryllium', 2], ['thorium', 3],
];

const MAXSLOT = 99;
const MACHINE_SCALE = 1.45;
const RTG_RATE = 4;
const NET_RANGE = 6;
const POLE_RANGE = 24;
const TOUCH_RANGE = 2.2;

export class MachineSystem {
  constructor(ctx) {
    this.ctx = ctx;
    const T = ctx.THREE;
    this.T = T;
    this.ITEMS = ctx.ITEMS;
    this.inv = ctx.inv;
    this.templates = new Map();
    this.instances = [];
    this.uidSeq = 1;
    this.emitList = [];
    this.absorbers = [];
    this.cleaners = [];
    this.bursts = [];
    this.smokeParts = [];
    this.smoke = null;
    this.openInst = null;
    this.baseCap = 500;
    this.cableDirty = true;
    this.cableGroup = new T.Group();
    ctx.scene.add(this.cableGroup);
    this.cableLines = null;
    this.ui = ctx.ui;
    this.ui.setBridge(this.bridge());
  }


  async load() {
    const Loader = this.ctx.GLTFLoader;
    const loader = new Loader();
    await Promise.all(this.ctx.defs.map(async (def) => {
      let layout = this.ctx.layoutFor(def);
      try {
        const r = await fetch(def.layout);
        if (r.ok) { const j = await r.json(); if (j && j.elements) layout = j; }
      } catch {                                                            }
      let model = null, animations = [];
      try {
        const g = await loader.loadAsync(def.model);
        model = g.scene;
        model.updateMatrixWorld(true);
        const size = new this.T.Box3().setFromObject(model).getSize(new this.T.Vector3());
        model.scale.setScalar((def.height * MACHINE_SCALE) / Math.max(size.y, 0.001));


        model.position.y = -new this.T.Box3().setFromObject(model).min.y
          - (def.sink || 0) * def.height * MACHINE_SCALE;
        animations = g.animations || [];
      } catch {
        model = this.placeholderModel(def);
      }
      const bounds = new this.T.Box3().setFromObject(model);
      const footprint = bounds.getSize(new this.T.Vector3());

      if (this.ctx.patchMachineMaterial) {
        model.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const mt of mats) this.ctx.patchMachineMaterial(mt);
        });
      }
      this.templates.set(def.id, { def, model, layout, animations, size: footprint });
    }));
    return this;
  }

  placeholderModel(def) {
    const T = this.T;
    const g = new T.Group();
    const colors = {
      reactor: 0xb06060, generator: 0x6fb0a0, storage: 0x7f7f9f, cable: 0xd0b060,
      excavator: 0xa08040, crafting: 0x8aa0c0, armor: 0x90a0a0,
    };
    const col = colors[def.kind] || 0x8090a8;
    const h = def.height * MACHINE_SCALE;
    const box = new T.Mesh(new T.BoxGeometry(0.92, h, 0.92), new T.MeshLambertMaterial({ color: col, emissive: 0x101418, emissiveIntensity: 0.3 }));
    box.position.y = h / 2;
    g.add(box);
    if (def.kind === 'cable') {
      const wire = new T.Mesh(new T.BoxGeometry(1.0, 0.08, 0.08), new T.MeshBasicMaterial({ color: 0xffd070 }));
      wire.position.y = 0.25;
      g.add(wire);
    }
    return g;
  }




  flattenPad(x, y, z, radius) {
    const world = this.ctx.world;
    if (!world || !world.field || !world.markRegionDirty) return;
    const field = world.field;



    const flat = radius + 0.75;
    const R = flat + 0.9;
    const x0 = Math.floor(x - R), x1 = Math.ceil(x + R);
    const z0 = Math.floor(z - R), z1 = Math.ceil(z + R);
    const y0 = Math.floor(y - 5), y1 = Math.ceil(y + 5);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const d = Math.hypot(ix - x, iz - z);
        const w = Math.max(0, Math.min(1, (R - d) / Math.max(0.001, R - flat)));
        if (w <= 0) continue;
        for (let iy = y0; iy <= y1; iy++) {
          const cur = field.get(ix, iy, iz);
          const plane = y - iy;
          field.set(ix, iy, iz, cur + (plane - cur) * w);
        }
      }
    }
    world.markRegionDirty(x0, x1, y0, y1, z0, z1);
  }

  place(id, x, z, opts = {}) {
    const tpl = this.templates.get(id);
    if (!tpl) return null;
    const size = tpl.size || { x: 1, z: 1 };
    const rot = (opts.rot || 0) % (Math.PI * 2);
    const quarter = Math.round(rot / (Math.PI / 2)) % 2;
    const hx = Math.max(0.4, (quarter ? size.z : size.x) / 2);
    const hz = Math.max(0.4, (quarter ? size.x : size.z) / 2);
    const player = this.ctx.player;
    if (player && Math.abs(player.pos.x - x) < hx + player.radius + 0.1
      && Math.abs(player.pos.z - z) < hz + player.radius + 0.1) return null;
    const y = opts.y !== undefined ? opts.y : this.ctx.world.getSurfaceHeight(x, z, 90);
    this.flattenPad(x, y, z, Math.max(hx, hz));
    const mesh = tpl.model.clone(true);
    const spinNode = tpl.def.spin ? mesh.getObjectByName(tpl.def.spin) : null;


    mesh.position.set(x, y + mesh.position.y, z);
    mesh.rotation.y = rot;
    this.ctx.scene.add(mesh);
    const inst = {
      uid: this.uidSeq++, def: tpl.def, x, y, z, rot, mesh, layout: tpl.layout,
      top: y + tpl.def.height * MACHINE_SCALE, hx, hz,
      spinNode,
      state: { slots: {}, progress: 0, heat: 0, recipe: null, job: null, queue: [], burning: false, burnT: 0, buffer: 0, status: 'IDLE' },
      mixer: null, action: null, net: null,
    };
    if (tpl.animations.length) {
      const mixer = new this.T.AnimationMixer(mesh);
      const action = mixer.clipAction(tpl.animations[0]);
      action.play(); action.paused = true;
      inst.mixer = mixer; inst.action = action;
    }
    inst.machine = this.ctx.registerMachine({
      x, y: y + tpl.def.height * MACHINE_SCALE / 2, z, radius: tpl.def.reach || Math.max(1.6, tpl.def.height * MACHINE_SCALE * 0.9),
      label: tpl.def.label, mesh,
      onActivate: () => this.open(inst),
    });
    this.instances.push(inst);
    this.cableDirty = true;
    this.ctx.syncBars?.();
    return inst;
  }

  remove(inst, refund = true) {
    const i = this.instances.indexOf(inst);
    if (i < 0) return;
    this.instances.splice(i, 1);
    if (inst.mesh.parent) inst.mesh.parent.remove(inst.mesh);
    const ma = this.ctx.machineActivators;
    if (ma) { const j = ma.indexOf(inst.machine); if (j >= 0) ma.splice(j, 1); }
    if (refund) {
      for (const s of Object.values(inst.state.slots)) if (s && s.id) this.giveBack(s);
      this.giveBack({ id: inst.def.id, n: 1 });
    }
    this.cableDirty = true;
  }

  at(x, z, pad = 1.2) {
    for (const m of this.instances) if (Math.hypot(m.x - x, m.z - z) < pad) return m;
    return null;
  }





  powerCap(m) {
    const d = m.def;
    if (d.capacity) return d.capacity;
    if (d.energy?.use) return Math.max(40, d.energy.use * 3);
    return 40;
  }

  hasPowerPort(m) {
    const d = m.def;
    return !!(d.energy || d.capacity || d.kind === 'reactor');
  }

  chargePower(m, dt, net) {
    if (!this.hasPowerPort(m)) return;
    const cap = this.powerCap(m);
    const cur = m.state.buffer || 0;
    if (m.def.capacity) { m.state.buffer = Math.min(cap, cur); return; }
    if (cur >= cap || net.pool <= 0) { m.state.buffer = Math.min(cap, cur); return; }
    const want = Math.min(cap - cur, net.pool, cap * dt);
    net.pool -= want;
    m.state.buffer = cur + want;
  }

  drawPower(m, cost) {
    const b = m.state.buffer || 0;
    if (b < cost) return false;
    m.state.buffer = b - cost;
    return true;
  }


  bridge() {
    return {
      inventory: () => this.inv.hot.concat(this.inv.main),
      item: (id) => this.ITEMS[id],
      icon: (id) => this.ctx.icon(id),
      selectedHotbar: () => this.inv.sel,
      selectHotbar: (i) => { this.inv.sel = i; this.ctx.syncBars(); },
      showTip: (stack, x, y) => this.ctx.showTip?.(stack, x, y),
      hideTip: () => this.ctx.hideTip?.(),
      layout: () => this.openInst?.layout,
      slotView: (role) => this.slotView(role),
      drop: (i, role) => this.drop(i, role),
      take: (role) => this.take(role),
      collect: (role) => this.take(role),
      craftOptions: () => this.craftOptions(),
      craftRecipe: (recipe, mods) => this.craftRecipe(recipe, mods),
      hasCraftList: () => !!this.openInst && (this.openInst.def.kind === 'crafting' || this.openInst.def.kind === 'processor'),
      statusText: () => this.statusText(),
      progressValue: () => this.openInst ? this.openInst.state.progress : 0,
      powerView: () => {
        const m = this.openInst; if (!m || !this.hasPowerPort(m)) return null;
        const cap = this.powerCap(m), buf = Math.min(cap, m.state.buffer || 0);
        return { value: cap ? buf / cap : 0, text: `${Math.round(buf)} / ${Math.round(cap)}` };
      },
      heatValue: () => { const m = this.openInst; return m && m.def.heatMax ? m.state.heat / m.def.heatMax : null; },
      matchValue: () => { const m = this.openInst; return m && m.def.kind === 'reactor' ? (m.state.coolMatch || 0) : null; },
      onActive: (active) => {
        const m = this.openInst; if (!m || !m.action) return;
        if (active) { m.action.reset(); m.action.play(); m.action.paused = false; }
        else { m.action.paused = true; }
      },
    };
  }

  slotView(role) {
    const m = this.openInst; if (!m) return null;
    const s = m.state.slots[role];
    if (role === 'armor') return { item: s?.id, count: s ? 1 : 0 };
    return { item: s?.id, count: s?.n || 0 };
  }

  invStack(i) {
    const hot = i < 7;
    const idx = hot ? i : i - 7;
    const grid = hot ? this.inv.hot : this.inv.main;
    return { grid, idx, stack: grid[idx] };
  }

  giveBack(stack) {
    if (!stack) return;
    if (stack.plates && stack.plates.length) { this.ctx.giveStack(stack); return; }
    stack.n = this.ctx.give(stack.id, stack.n);
  }

  drop(i, role) {
    const m = this.openInst; if (!m) return false;
    const { grid, idx, stack } = this.invStack(i);
    if (!stack) return false;
    const item = this.ITEMS[stack.id] || {};

    if (role === 'armor') {
      if (!item.armor) return false;
      const cur = m.state.slots.armor;
      m.state.slots.armor = stack;
      grid[idx] = cur || null;
      this.ctx.syncBars();
      return true;
    }
    if (role.startsWith('plate')) {
      const armor = m.state.slots.armor;
      if (!armor || !item.plate) return false;
      const a = this.ITEMS[armor.id]?.armor;
      if (!a) return false;
      armor.plates = armor.plates || [];
      if (armor.plates.length >= a.plateSlots) return false;
      armor.plates.push(stack.id);
      stack.n--;
      if (stack.n <= 0) grid[idx] = null;
      this.ctx.syncBars();
      return true;
    }
    if (role.startsWith('output')) return false;
    if (role.startsWith('rod') && !item.rod) return false;
    if (m.def.kind === 'reactor' && role === 'fuel' && !item.fuel) return false;

    // One physical rod per cooling slot: swapping never merges stacks.
    if (role.startsWith('rod')) {
      const cur = m.state.slots[role];
      m.state.slots[role] = stack;
      grid[idx] = cur || null;
      this.ctx.syncBars();
      return true;
    }

    const cur = m.state.slots[role];
    if (cur && cur.id === stack.id && cur.n < MAXSLOT) {
      const mv = Math.min(MAXSLOT - cur.n, stack.n);
      cur.n += mv; stack.n -= mv;
      if (stack.n <= 0) grid[idx] = null;
    } else {
      m.state.slots[role] = stack;
      grid[idx] = cur || null;
    }
    this.ctx.syncBars();
    return true;
  }

  take(role) {
    const m = this.openInst; if (!m) return false;
    const s = m.state.slots[role];
    if (!s) return false;
    if (role === 'armor') { if (this.ctx.giveStack(s)) { m.state.slots[role] = null; return true; } return false; }
    if (s.liquid) {
      if (!this.ctx.giveStack(s)) return false;
      m.state.slots[role] = null;
      return true;
    }
    const left = this.ctx.give(s.id, s.n);
    if (left > 0) { s.n = left; } else m.state.slots[role] = null;
    return true;
  }



  tickLiquidGenerator(m, dt, net) {
    const st = m.state, lf = m.def.liquidFuel;
    const s = st.slots.fuel;
    const rate = s?.liquid ? lf.burn[s.liquid.id] : 0;
    if (!rate || !s.liquid || s.liquid.amount <= 1e-6) {
      st.status = s?.liquid?.id ? 'WRONG FUEL' : 'NO FUEL';
      return false;
    }
    s.liquid.amount = Math.max(0, s.liquid.amount - rate * dt);
    if (s.liquid.amount <= 1e-6) delete s.liquid;
    net.pool = Math.min(net.cap, net.pool + m.def.energy.gen * dt);
    st.status = 'GENERATING';
    if (m.def.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: m.def.rad });
    return true;
  }






  invCounts() {
    const counts = {};
    for (const g of [this.inv.hot, this.inv.main]) {
      for (const s of g) if (s) counts[s.id] = (counts[s.id] || 0) + s.n;
    }
    return counts;
  }

  takeInv(id, n) {
    let left = n;
    for (const g of [this.inv.hot, this.inv.main]) {
      for (let i = 0; i < g.length && left > 0; i++) {
        const s = g[i];
        if (!s || s.id !== id) continue;
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) g[i] = null;
      }
    }
    return left;
  }


  bagLiquids() {
    const counts = {};
    for (const g of [this.inv.hot, this.inv.main]) {
      for (const s of g) if (s?.liquid) counts[s.liquid.id] = (counts[s.liquid.id] || 0) + s.liquid.amount;
    }
    return counts;
  }

  takeBagLiquid(id, amount) {
    let left = amount;
    for (const g of [this.inv.hot, this.inv.main]) {
      for (let i = 0; i < g.length && left > 0; i++) {
        const s = g[i];
        if (!s?.liquid || s.liquid.id !== id) continue;
        left -= drain(s, left);
      }
    }
    return left;
  }




  recipeNeeds(r) {
    const needs = { ...(r.in || r.needs || {}) };
    if (!r.in) return needs;
    for (const [id, n] of Object.entries(r.out || {})) {
      if (!needs[id]) continue;
      needs[id] = Math.max(0, needs[id] - n);
      if (!needs[id]) delete needs[id];
    }
    return needs;
  }

  recipeOut(r) {
    const out = { ...(r.out || {}) };
    if (!r.in) return out;
    for (const [id, n] of Object.entries(r.in || {})) {
      if (!out[id]) continue;
      out[id] = Math.max(0, out[id] - n);
      if (!out[id]) delete out[id];
    }
    return out;
  }


  bagRoomForRecipe(r, spend = true) {
    const slots = [];
    for (const g of [this.inv.hot, this.inv.main]) for (const s of g) slots.push(s ? { id: s.id, n: s.n } : null);
    if (spend) {
      for (const [id, n] of Object.entries(this.recipeNeeds(r))) {
        let left = n;
        for (const s of slots) {
          if (!s || s.id !== id || left <= 0) continue;
          const take = Math.min(s.n, left);
          s.n -= take; left -= take;
        }
      }
    }
    for (const [id, n] of Object.entries(this.recipeOut(r))) {
      if (!(n > 0)) continue;
      const cap = this.ITEMS[id]?.stack || MAXSLOT;
      let left = n;
      for (let i = 0; i < slots.length && left > 0; i++) {
        let s = slots[i];
        if (!s || s.n <= 0) s = slots[i] = { id, n: 0 };
        if (s.id !== id) continue;
        const add = Math.min(cap - s.n, left);
        s.n += add; left -= add;
      }
      if (left > 0) return false;
    }
    if (r.liquidOut && !slots.some((s) => s && s.id === r.liquidOut.container)) return false;
    return true;
  }


  bagLiquidRoom(lo) {
    let left = lo.amount;
    for (const g of [this.inv.hot, this.inv.main]) {
      for (const s of g) {
        if (left <= 0) break;
        if (!s || s.id !== lo.container) continue;
        if (s.liquid && s.liquid.id !== lo.id) continue;
        const cap = this.ITEMS[s.id]?.container?.capacity || 0;
        left -= Math.max(0, cap - (s.liquid?.amount || 0));
      }
    }
    return left <= 0;
  }

  giveBagOutputs(r) {
    for (const [id, n] of Object.entries(this.recipeOut(r))) if (n > 0) this.ctx.give(id, n);
    const lo = r.liquidOut;
    if (!lo) return;
    let left = lo.amount;
    for (const g of [this.inv.hot, this.inv.main]) {
      for (const s of g) {
        if (left <= 0) break;
        if (!s || s.id !== lo.container) continue;
        left -= fill(s, this.ITEMS[s.id], lo.id, left);
      }
    }
  }

  craftCost(m) { return m?.def.energy?.craft || 0; }

  bagOptions(m, recipes, { powerCost = 0 } = {}) {
    const counts = this.invCounts();
    const liqs = this.bagLiquids();
    const power = m?.state.buffer || 0;
    const out = [];
    recipes.forEach((recipe, i) => {
      const outs = this.recipeOut(recipe);
      const outIds = Object.keys(outs).filter((id) => outs[id] > 0);
      let displayId, displayCount;
      if (outIds.length) {
        displayId = outIds[0]; displayCount = outs[outIds[0]];
      } else if (recipe.liquidOut) {

        displayId = recipe.liquidOut.container; displayCount = 1;
      } else return;
      let crafts = Infinity;
      const needs = Object.entries(this.recipeNeeds(recipe));
      for (const [id, n] of needs) crafts = Math.min(crafts, Math.floor((counts[id] || 0) / n));
      for (const l of (recipe.liquidIn || [])) crafts = Math.min(crafts, Math.floor((liqs[l.id] || 0) / l.amount));
      if (!isFinite(crafts) || crafts < 1) return;
      const noPower = powerCost > 0 && power < powerCost;
      out.push({
        key: `r${i}`, recipe, id: displayId, count: displayCount, crafts, needs,
        liquidNeeds: (recipe.liquidIn || []).map((l) => ({ id: l.id, amount: l.amount })),
        disabled: noPower,
        note: noPower ? 'NO POWER' : '',
      });
    });
    return out;
  }

  craftOptions(m = this.openInst) {
    if (!m) return [];
    if (m.def.kind === 'crafting') {
      return this.bagOptions(m, this.ctx.craftRecipes || [], { powerCost: this.craftCost(m) });
    }
    if (m.def.kind === 'processor') {
      return this.bagOptions(m, m.def.recipes || []);
    }
    return [];
  }



  startJob(m, recipe, mods = {}) {
    if (!m || !recipe) return false;
    const limit = mods.shift ? Infinity : 1;
    let started = 0;
    for (let i = 0; i < limit; i++) {
      const counts = this.invCounts();
      let affordable = true;
      for (const [id, n] of Object.entries(this.recipeNeeds(recipe))) {
        if ((counts[id] || 0) < n) { affordable = false; break; }
      }
      if (!affordable) { if (!started) m.state.status = 'NO MATERIALS'; break; }
      const liqs = this.bagLiquids();
      let wet = true;
      for (const l of (recipe.liquidIn || [])) {
        if ((liqs[l.id] || 0) < l.amount) { wet = false; break; }
      }
      if (!wet) { if (!started) m.state.status = 'NO LIQUID'; break; }
      if (!this.bagRoomForRecipe(recipe)) {
        if (!started) {
          m.state.status = 'INVENTORY FULL';
          this.ctx.notice?.('INVENTORY FULL');
        }
        break;
      }
      for (const [id, n] of Object.entries(this.recipeNeeds(recipe))) this.takeInv(id, n);
      for (const l of (recipe.liquidIn || [])) this.takeBagLiquid(l.id, l.amount);
      const job = { recipe, t: 0 };
      if (!m.state.job) m.state.job = job;
      else (m.state.queue ||= []).push(job);
      started++;
    }
    if (started) {
      m.state.progress = 0;
      m.state.status = 'STARTED';
      this.ctx.syncBars?.();
    }
    return started > 0;
  }

  craftRecipe(recipe, mods = {}) {
    const m = this.openInst;
    if (!m || !recipe) return false;
    if (m.def.kind === 'processor') return this.startJob(m, recipe, mods);


    const cost = this.craftCost(m);
    const outs = this.recipeOut(recipe);
    const outIds = Object.keys(outs);
    if (outIds.length !== 1) return false;
    const outId = outIds[0], outN = outs[outId];
    const needs = this.recipeNeeds(recipe);
    const limit = mods.shift ? Infinity : 1;
    let made = 0;

    for (let i = 0; i < limit; i++) {
      if (cost && (m.state.buffer || 0) < cost) { m.state.status = 'NO POWER'; break; }
      const counts = this.invCounts();
      let affordable = true;
      for (const [id, n] of Object.entries(needs)) {
        if ((counts[id] || 0) < n) { affordable = false; break; }
      }
      if (!affordable) break;

      if (this.ctx.bagRoomFor && !this.ctx.bagRoomFor(outId, outN, needs)) {
        m.state.status = 'INVENTORY FULL';
        this.ctx.notice?.('INVENTORY FULL');
        break;
      }
      for (const [id, n] of Object.entries(needs)) this.takeInv(id, n);
      if (cost) {
        m.state.buffer = Math.max(0, (m.state.buffer || 0) - cost);
        if (m.net) m.net.pool = Math.max(0, m.net.pool - cost);
      }
      this.ctx.give(outId, outN);
      made++;
    }

    if (made) m.state.status = 'CRAFTED';
    this.ctx.syncBars?.();
    return made > 0;
  }


  inputCounts(m) {
    const counts = {};
    for (let i = 0; i < 4; i++) {
      const s = m.state.slots[`input${i}`];
      if (s) counts[s.id] = (counts[s.id] || 0) + s.n;
    }
    return counts;
  }

  liquidCounts(m) {
    const counts = {};
    for (let i = 0; i < 4; i++) {
      const s = m.state.slots[`input${i}`];
      if (s?.liquid) counts[s.liquid.id] = (counts[s.liquid.id] || 0) + s.liquid.amount;
    }
    return counts;
  }

  findRecipe(m) {
    const rec = m.def.recipes; if (!rec) return null;
    const have = this.inputCounts(m);
    const liq = this.liquidCounts(m);
    for (const r of rec) {
      let ok = true;
      for (const [id, n] of Object.entries(r.in)) if ((have[id] || 0) < n) { ok = false; break; }
      if (ok) for (const l of (r.liquidIn || [])) if ((liq[l.id] || 0) < l.amount) { ok = false; break; }
      if (ok && (Object.keys(r.in).length || (r.liquidIn || []).length)) return r;
    }
    return null;
  }

  consumeInputs(m, r) {
    for (const [id, n] of Object.entries(r.in)) {
      let left = n;
      for (let i = 0; i < 4 && left > 0; i++) {
        const s = m.state.slots[`input${i}`];
        if (!s || s.id !== id) continue;
        const take = Math.min(s.n, left);
        s.n -= take; left -= take;
        if (s.n <= 0) m.state.slots[`input${i}`] = null;
      }
    }
    for (const l of (r.liquidIn || [])) {
      let left = l.amount;
      for (let i = 0; i < 4 && left > 0; i++) {
        const s = m.state.slots[`input${i}`];
        if (!s?.liquid || s.liquid.id !== l.id) continue;
        left -= drain(s, left);
      }
    }
  }

  outputsHaveRoom(m, r) {
    const slots = [];
    const n = m.def.outputs || 4;
    for (let i = 0; i < n; i++) slots.push(m.state.slots[`output${i}`] || null);
    for (const [id, count] of Object.entries(r.out)) {
      let left = count;
      for (let i = 0; i < n && left > 0; i++) {
        const s = slots[i];
        if (s && s.id === id) left -= (MAXSLOT - s.n);
        else if (!s) { slots[i] = { id, n: Math.min(left, MAXSLOT) }; left -= Math.min(left, MAXSLOT); }
      }
      if (left > 0) return false;
    }
    return true;
  }

  addOutput(m, id, n) {
    const slots = m.def.outputs || 4;
    let left = n;
    for (let i = 0; i < slots && left > 0; i++) {
      const s = m.state.slots[`output${i}`];
      if (s && s.id === id) { const t = Math.min(MAXSLOT - s.n, left); s.n += t; left -= t; }
      else if (!s) { const t = Math.min(MAXSLOT, left); m.state.slots[`output${i}`] = { id, n: t }; left -= t; }
    }
    return left;
  }

  giveOutputs(m, r) {
    for (const [id, n] of Object.entries(r.out)) if (n > 0) this.addOutput(m, id, n);
    const lo = r.liquidOut;
    if (!lo) return;

    for (let i = 0; i < 4; i++) {
      const s = m.state.slots[`output${i}`];
      if (!s || s.id !== lo.container) continue;
      const cap = this.ITEMS[s.id]?.container?.capacity || 0;
      const cur = s.liquid?.amount || 0;
      const add = Math.min(lo.amount, cap - cur);
      if (add > 0) s.liquid = { id: lo.id, amount: cur + add };
      break;
    }
  }


  buildNetworks() {
    const ins = this.instances;
    const parent = ins.map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    const edges = [];
    for (let i = 0; i < ins.length; i++) {
      for (let j = i + 1; j < ins.length; j++) {
        const a = ins[i], b = ins[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        const cable = a.def.kind === 'cable' || b.def.kind === 'cable';
        const poles = a.def.kind === 'cable' && b.def.kind === 'cable';
        const reach = poles ? POLE_RANGE : NET_RANGE;
        if (d <= TOUCH_RANGE || (cable && d <= reach)) {
          uni(i, j);
          if (cable && d <= reach) edges.push([a, b]);
        }
      }
    }
    const groups = new Map();
    ins.forEach((m, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(m); });
    const nets = [...groups.values()].map((members) => ({ members, pool: 0, cap: 0 }));
    return { nets, edges };
  }

  reactorRods(m) {
    let cool = 0, mod = 0, absorb = 0, used = 0;
    const slots = m.def.rodSlots || REACTOR_ROD_SLOTS;
    for (let i = 0; i < slots; i++) {
      const s = m.state.slots[`rod${i}`];
      const r = s && this.ITEMS[s.id]?.rod;
      if (!r) continue;
      used++;
      cool += r.cool || 0;
      mod += r.mod || 0;
      absorb += r.absorb || 0;
    }
    return { cool, mod, absorb, used };
  }

  reactorCooling(m, dt = 0) {
    const rods = this.reactorRods(m);
    let cool = rods.cool;
    let water = false, heavy = false;

    const w = this.ctx.world;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, 3], [3, -3], [-3, -3]]) {
      if (w.waterAt(m.x + dx, m.y + 1, m.z + dz) > 0) { cool += m.def.coolPerWater * 0.5; water = true; break; }
    }
    if (water && Math.random() < 0.5) w.useWater(m.x, m.y + 1, m.z, 0.25, 3);

    const tank = m.state.slots.coolant;
    if (tank?.liquid?.id === 'heavy_water' && m.def.coolPerHeavy) {
      cool += m.def.coolPerHeavy;
      heavy = true;
      tank.liquid.amount -= 0.25 * dt;
      if (tank.liquid.amount <= 1e-6) delete tank.liquid;
    }
    return { ...rods, cool, water, heavy };
  }

  meltdown(m) {
    const r = 6;
    const f = this.ctx.world.field;
    for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++)
      for (let y = Math.floor(m.y - r); y <= Math.ceil(m.y + r); y++)
        for (let z = Math.floor(m.z - r); z <= Math.ceil(m.z + r); z++) {
          const d = Math.hypot(x - m.x, y - m.y, z - m.z);
          if (d <= r) f.set(x, y, z, -1);
        }
    this.ctx.world.markRegionDirty(Math.floor(m.x - r), Math.ceil(m.x + r), Math.floor(m.y - r), Math.ceil(m.y + r), Math.floor(m.z - r), Math.ceil(m.z + r));
    this.bursts.push({ x: m.x, y: m.y + 1, z: m.z, rad: 60, life: 60 });
    this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: 40 });
    this.ctx.explode?.(m.x, m.y, m.z, r);
    this.remove(m, false);
  }


  update(dt) {
    this.emitList.length = 0;
    this.absorbers.length = 0;
    this.cleaners.length = 0;
    for (const b of this.bursts) { this.emitList.push({ x: b.x, y: b.y, z: b.z, rad: b.rad }); b.life -= dt; }
    this.bursts = this.bursts.filter((b) => b.life > 0);

    if (this.cableDirty) { this.rebuildCables(); this.cableDirty = false; }

    const { nets } = this.buildNetworks();
    for (const net of nets) {
      let cap = this.baseCap, pool = 0;
      for (const m of net.members) {
        if (m.def.capacity) { cap += m.def.capacity; pool += m.state.buffer || 0; }
      }
      net.cap = cap; net.pool = Math.min(cap, pool);
      for (const m of net.members) m.net = net;
    }

    for (const net of nets) {
      for (const m of net.members) {
        const def = m.def;
        if (def.kind === 'generator') {
          if (def.rtg) { this.tickRtg(m, dt, net); continue; }
          if (def.battery) { this.tickBattery(m, dt, net); continue; }
          if (def.energy?.dayOnly && !this.ctx.isDay()) { m.state.status = 'NIGHT'; continue; }
          if (def.liquidFuel) { this.tickLiquidGenerator(m, dt, net); continue; }
          if ((def.recipes || []).some((r) => r.fuel) && !this.tickFuelGenerator(m, dt)) { continue; }
          net.pool = Math.min(net.cap, net.pool + def.energy.gen * dt);
          m.state.status = 'GENERATING';
          if (def.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: def.rad });
        } else if (def.kind === 'reactor') {
          this.tickReactor(m, dt, net);
        }
      }
    }
    for (const net of nets) {
      for (const m of net.members) this.chargePower(m, dt, net);
      for (const m of net.members) {
        const k = m.def.kind;
        if (k === 'processor') this.tickProcessor(m, dt, net);
        else if (k === 'excavator') this.tickExcavator(m, dt, net);
        else if (k === 'absorber') this.tickAbsorber(m, dt, net);
        else if (k === 'geiger') {
          const r = this.localRad(m.x, m.y + 1, m.z);
          m.state.status = `FIELD ${formatRadRate(r)}`;
        } else if (k === 'cable') m.state.status = 'LINKED';
        else if (k === 'storage') m.state.status = `${Math.round(net.pool)} / ${net.cap}`;
      }
    }

    for (const net of nets) {
      let left = net.pool;
      for (const m of net.members) { if (m.def.capacity) { const t = Math.min(m.def.capacity, left); m.state.buffer = t; left -= t; } }
    }
    for (const m of this.instances) m.mixer?.update(m.action && !m.action.paused ? dt : 0);
    for (const m of this.instances) if (m.def.smoke) this.emitSmoke(m, dt);
    this.updateSmoke(dt);
  }





  emitSmoke(m, dt) {
    const cfg = m.def.smoke;
    const active = m.state.burning || (m.def.kind === 'reactor' && m.state.heat > 1);
    m._smokeAcc = (m._smokeAcc || 0) + dt * (active ? (cfg.rate || 12) : 0);
    if (m._smokeAcc < 1) return;
    if (!this.smoke) this.initSmoke();
    m.mesh.updateMatrixWorld(true);
    const T = this.T, v = new T.Vector3();
    const dir = new T.Vector3(...(cfg.dir || [0, 0, -1])).applyQuaternion(m.mesh.quaternion).normalize();
    const spread = cfg.spread ?? 0.6;
    while (m._smokeAcc >= 1 && this.smokeParts.length < this.smoke.max) {
      m._smokeAcc -= 1;
      v.set(
        cfg.at[0] + (Math.random() - 0.5) * 2 * spread,
        cfg.at[1] + (Math.random() - 0.5) * 2 * spread,
        cfg.at[2],
      );
      m.mesh.localToWorld(v);
      const speed = (cfg.speed ?? 0.7) * (0.7 + Math.random() * 0.6);
      this.smokeParts.push({
        x: v.x, y: v.y, z: v.z,
        vx: dir.x * speed + (Math.random() - 0.5) * 0.25,
        vy: dir.y * speed + 0.5 + Math.random() * 0.3,
        vz: dir.z * speed + (Math.random() - 0.5) * 0.25,
        age: 0,
        ttl: (cfg.life ?? 3) * (0.7 + Math.random() * 0.6),
        size: cfg.size ?? 0.5,
      });
    }
    if (m._smokeAcc > 1) m._smokeAcc = 0;
  }

  initSmoke() {
    const T = this.T;
    const max = 600;
    const geo = new T.BufferGeometry();
    const pos = new Float32Array(max * 3), life = new Float32Array(max), size = new Float32Array(max);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aLife', new T.BufferAttribute(life, 1).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('aSize', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `
        attribute float aLife;
        attribute float aSize;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (320.0 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vLife;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.1, r) * vLife * 0.45;
          gl_FragColor = vec4(0.42, 0.42, 0.44, a);
        }`,
    });
    const pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    this.ctx.scene.add(pts);
    this.smoke = { max, pts, pos, life, size, geo };
  }

  updateSmoke(dt) {
    if (!this.smoke) return;
    const { max, pos, life, size, geo } = this.smoke;
    const parts = this.smokeParts;
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.ttl) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy += 0.35 * dt;
      const drag = Math.max(0, 1 - 0.9 * dt);
      p.vx *= drag; p.vz *= drag;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      const k = p.age / p.ttl;
      life[n] = 1 - k;
      size[n] = p.size * (0.8 + k * 1.8);
      n++;
    }
    parts.length = n;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  tickRtg(m, dt, net) {
    const s = m.state.slots.input0;
    const rad = s ? (this.ITEMS[s.id]?.rad || 0) : 0;
    if (!rad) { m.state.status = 'NO SOURCE'; return; }
    if (m.def.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: m.def.rad });
    net.pool = Math.min(net.cap, net.pool + rad * RTG_RATE * dt);
    m.state.status = `SOURCING ${(rad * RTG_RATE).toFixed(1)}/s`;
  }

  tickFuelGenerator(m, dt) {
    const s = m.state.slots.input0;
    if (!s) { m.state.status = 'NO FUEL'; return false; }
    if (s.id === 'depleted_tbu' || s.id === 'depleted_leu' || s.id === 'depleted_heu') {
      m.state.status = 'GENERATING';
      if (m.def.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: m.def.rad });
      m.state.burnT = (m.state.burnT || 0) + dt;
      if (m.state.burnT > 60) { m.state.burnT = 0; s.n--; if (s.n <= 0) m.state.slots.input0 = null; }
      return true;
    }
    m.state.status = 'NO FUEL';
    return false;
  }

  tickProcessor(m, dt, net) {
    const st = m.state;
    if (!st.job && st.queue?.length) st.job = st.queue.shift();
    const job = st.job;
    if (!job) {
      st.progress = 0;
      const n = this.craftOptions(m).length;
      st.status = n ? `${n} RECIPE${n === 1 ? '' : 'S'} READY` : 'NO MATERIALS';
      return;
    }
    const r = job.recipe;
    const dur = Math.max(0.001, r.time || 1);
    const cost = (m.def.energy?.use || 0) * dt;
    if (!this.drawPower(m, cost)) {
      st.progress = Math.min(1, job.t / dur);
      st.status = 'NO POWER';
      return;
    }
    job.t += dt;
    st.progress = Math.min(1, job.t / dur);
    st.status = 'RUNNING';
    if (r.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: r.rad });
    if (m.def.id === 'decontaminator'
      && Math.hypot(this.ctx.player.pos.x - m.x, this.ctx.player.pos.z - m.z) < 3) {
      this.cleaners.push(m);
    }
    if (job.t >= dur) {
      if (!this.bagRoomForRecipe(r, false) || (r.liquidOut && !this.bagLiquidRoom(r.liquidOut))) {
        st.status = 'INVENTORY FULL';
        return;
      }
      this.giveBagOutputs(r);
      st.job = null;
      st.progress = 0;
      st.status = st.queue?.length ? `CRAFTED · ${st.queue.length} QUEUED` : 'CRAFTED';
    }
  }

  tickReactor(m, dt, net) {
    const st = m.state, def = m.def;
    const fuel = st.slots.fuel;
    const fd = fuel && this.ITEMS[fuel.id]?.fuel;
    const rodCool = this.reactorRods(m).cool;
    if (!fd) {
      st.burning = false;
      st.heat = Math.max(0, st.heat - 40 * dt);
      st.coolTotal = rodCool;
      st.coolTarget = 0;
      st.coolMatch = 0;
      st.match = 0;
      st.power = 0;
      st.status = st.heat > 1 ? 'COOLING' : 'NO FUEL';
      return;
    }
    if (!st.burning) { st.burning = true; st.burnT = fd.lifetime; st.fuelId = fuel.id; }

    const rc = this.reactorCooling(m, dt);
    const target = fd.cool || fd.heat;
    const ratio = target > 0 ? rc.cool / target : 1;

    // Perfect cooling is the sweet spot: too little lets heat climb and saps output,
    // too much drags the core below its design point and quietly costs power.
    const dev = Math.max(0, Math.abs(ratio - 1) - 0.05);
    const coolFactor = ratio >= 1
      ? Math.max(0.15, 1 - dev * 1.2)
      : Math.max(0.20, 1 - dev * 0.85);
    const neutron = Math.max(0.55, Math.min(1.35, 1 + rc.mod * 0.5 - rc.absorb * 0.2));
    const match = coolFactor * neutron;

    st.heat = Math.max(0, st.heat + (fd.heat - rc.cool) * dt * 0.12);
    net.pool = Math.min(net.cap, net.pool + fd.power * match * dt);
    this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: (def.radActive || 0) + fd.rad });

    st.coolTotal = rc.cool;
    st.coolTarget = target;
    st.coolMatch = Math.max(0, 1 - Math.abs(ratio - 1));
    st.match = match;
    st.power = fd.power * match;

    if (st.heat > def.heatMax * 0.8) st.status = 'OVERHEATING';
    else if (!rc.used && !rc.heavy && !rc.water) st.status = 'NO COOLANT';
    else if (ratio > 1.1) st.status = `OVERCOOLED ${Math.round(match * 100)}%`;
    else if (ratio < 0.9) st.status = `UNDERCOOLED ${Math.round(match * 100)}%`;
    else st.status = `OPTIMAL ${Math.round(match * 100)}%`;
    st.progress = Math.min(1, st.heat / def.heatMax);
    st.burnT -= dt;
    if (st.burnT <= 0) {
      fuel.n--; if (fuel.n <= 0) st.slots.fuel = null;
      this.addOutput(m, DEPLETED_OF[st.fuelId] || 'depleted_leu', 1);
      st.burning = false; st.burnT = 0; st.fuelId = null;
    }
    if (st.heat >= def.heatMax) this.meltdown(m);
  }

  tickBattery(m, dt, net) {
    const st = m.state;
    const s = st.slots.fuel || st.slots.input0;
    if (!s || !this.ITEMS[s.id]?.battery) { st.burnT = 0; st.status = 'NO BATTERY'; return; }
    net.pool = Math.min(net.cap, net.pool + m.def.energy.gen * dt);
    st.burnT = (st.burnT || 0) + dt;
    const left = Math.max(0, Math.ceil(m.def.battery.life - st.burnT));
    st.status = `BATTERY ${left}s`;
    if (st.burnT >= m.def.battery.life) {
      st.burnT = 0; s.n--;
      if (s.n <= 0) { st.slots.fuel = null; st.slots.input0 = null; }
      st.status = 'BATTERY SPENT';
    }
  }



  seamAt(m) {
    const r = regionOre(m.x, m.z);
    return r === 'stone' ? null : r;
  }

  tickExcavator(m, dt, net) {
    const st = m.state;
    const seam = this.seamAt(m);
    const cost = (m.def.energy?.use || 0) * dt;
    if (!this.hasOutputRoom(m)) { st.status = 'OUTPUT FULL'; return; }
    if (!this.drawPower(m, cost)) { st.status = 'NO POWER'; return; }
    st.progress += dt * (m.def.drillRate || 0.3);
    st.status = seam ? `DRILLING ${this.ITEMS[seam]?.name || seam}` : 'BARREN GROUND';
    m.spinNode?.rotateY(dt * (m.def.spinRate || 6));
    if (st.progress >= 1) {
      st.progress = 0;
      this.addOutput(m, seam || this.rollOre(), 1);
    }
  }

  hasOutputRoom(m) {
    const n = m.def.outputs || 6;
    for (let i = 0; i < n; i++) { const s = m.state.slots[`output${i}`]; if (!s || s.n < MAXSLOT) return true; }
    return false;
  }

  rollOre() {
    let total = 0; for (const [, w] of ORE_TABLE) total += w;
    let r = Math.random() * total;
    for (const [id, w] of ORE_TABLE) { r -= w; if (r <= 0) return id; }
    return 'stone';
  }

  tickAbsorber(m, dt, net) {
    const cost = (m.def.energy?.use || 0) * dt;
    if (!this.drawPower(m, cost)) { m.state.status = 'NO POWER'; return; }
    m.state.status = 'ABSORBING';
    this.absorbers.push(m);
  }

  localRad(x, y, z) {
    let r = 0;
    for (const e of this.emitList) {
      const d = Math.hypot(e.x - x, e.y - y, e.z - z);
      r += e.rad / (1 + d * d * 0.25);
    }
    return r;
  }




  cableAnchor(m) {
    const v = new this.T.Vector3();
    if (m.def.kind === 'cable' && m.mesh) {
      m.mesh.updateMatrixWorld(true);
      const node = m.mesh.getObjectByName(`wa${1 + Math.floor(Math.random() * 4)}`);
      if (node) return node.getWorldPosition(v);
    }
    v.set(m.x, m.y + (m.top - m.y) * 0.7, m.z);
    return v;
  }

  rebuildCables() {
    const { edges } = this.buildNetworks();
    if (this.cableLines) {
      for (const lines of [].concat(this.cableLines)) {
        this.cableGroup.remove(lines);
        lines.geometry.dispose();
      }
      this.cableLines = null;
    }
    if (!edges.length) return;

    const C = this.T.Color;
    const rows = [
      { off: -0.09, color: new C(0x6b3a1f) },
      { off: 0, color: new C(0xa8382e) },
      { off: 0.09, color: new C(0x2e8f4e), stripe: new C(0xd4c02a) },
    ];
    const ptsPer = [[], [], []];
    const colsPer = [[], [], []];
    for (const [a, b] of edges) {

      const p0 = this.cableAnchor(a), p1 = this.cableAnchor(b);
      const y0 = p0.y, y1 = p1.y;
      const sag = 0.12 + p0.distanceTo(p1) * 0.06;
      const N = 8;
      for (let r2 = 0; r2 < 3; r2++) {
        const off = rows[r2].off;
        const { color, stripe } = rows[r2];
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const py = (t) => (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (Math.min(y0, y1) - sag) + t * t * y1;
          ptsPer[r2].push(
            p0.x + (p1.x - p0.x) * t0, py(t0) + off, p0.z + (p1.z - p0.z) * t0,
            p0.x + (p1.x - p0.x) * t1, py(t1) + off, p0.z + (p1.z - p0.z) * t1
          );
          if (stripe) {
            const c = i % 2 ? color : stripe;
            colsPer[r2].push(c.r, c.g, c.b, c.r, c.g, c.b);
          }
        }
      }
    }
    this.cableLines = [];
    for (let r2 = 0; r2 < 3; r2++) {
      const geo = new this.T.BufferGeometry();
      geo.setAttribute('position', new this.T.Float32BufferAttribute(ptsPer[r2], 3));
      const mat = new this.T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      if (rows[r2].stripe) {
        geo.setAttribute('color', new this.T.Float32BufferAttribute(colsPer[r2], 3));
        mat.vertexColors = true;
      } else {
        mat.color.copy(rows[r2].color);
      }
      const lines = new this.T.LineSegments(geo, mat);
      this.cableGroup.add(lines);
      this.cableLines.push(lines);
    }
  }


  statusText() {
    const m = this.openInst; if (!m) return '';
    if (m.def.kind === 'armor') {
      const a = m.state.slots.armor;
      if (!a) return 'INSERT ARMOR';
      const plates = (a.plates || []).length;
      return `PLATES ${plates}/${this.ITEMS[a.id]?.armor?.plateSlots || 0} · DROP PLATES TO INSTALL`;
    }
    if (m.def.kind === 'crafting') {
      const n = this.craftOptions(m).length;
      const cost = this.craftCost(m);
      const head = `${n} RECIPE${n === 1 ? '' : 'S'} AVAILABLE`;
      return cost ? `${head} · CRAFT COST ${cost} PU` : head;
    }
    if (m.def.kind === 'processor') {
      if (m.state.job) {
        const outs = Object.entries(this.recipeOut(m.state.job.recipe))
          .map(([id, n]) => `${n}x ${this.ITEMS[id]?.name || id}`)
          .join(' + ');
        const queued = m.state.queue?.length ? ` · ${m.state.queue.length} QUEUED` : '';
        return `${m.state.status}${outs ? ` | ${outs}` : ''}${queued}`;
      }
      if (m.state.queue?.length) return `${m.state.queue.length} QUEUED`;
      const n = this.craftOptions(m).length;
      if (n) return `${n} RECIPE${n === 1 ? '' : 'S'} READY`;
      return m.state.status || 'NO MATERIALS';
    }
    if (m.def.kind === 'reactor') {
      const head = m.state.status || 'NO FUEL';
      if (!m.state.coolTarget) return head;
      return `${head} · COOL ${Math.round(m.state.coolTotal || 0)}/${Math.round(m.state.coolTarget)} · ${Math.round(m.state.power || 0)} PU`;
    }
    const rec = this.findRecipe(m);
    if (rec) return `${m.state.status} | ${Object.entries(rec.in).map(([k, v]) => `${v}x ${this.ITEMS[k]?.name || k}`).join(' + ')}`;
    return m.state.status;
  }

  totalArmorRadShield() {
    let s = 0;
    const a = this.inv.armor || {};
    for (const slot of ARMOR_SLOTS) {
      const it = a[slot]; if (!it) continue;
      const def = this.ITEMS[it.id]?.armor; if (!def) continue;
      s += def.radShield || 0;
      for (const p of (it.plates || [])) s += this.ITEMS[p]?.plate?.radShield || 0;
    }
    return s;
  }


  carryShield() {
    const it = this.inv.armor?.hands; if (!it) return 0;
    let f = this.ITEMS[it.id]?.armor?.carry || 0;
    for (const p of (it.plates || [])) f += (this.ITEMS[p]?.plate?.carry || 0);
    return Math.min(0.95, f);
  }


  serialize() {
    return this.instances.map((m) => ({
      id: m.def.id, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2), r: +(m.rot || 0).toFixed(3),
      s: {
        slots: m.state.slots, progress: +m.state.progress.toFixed(3), heat: +m.state.heat.toFixed(2),
        burning: m.state.burning, burnT: +m.state.burnT.toFixed(2), buffer: Math.round(m.state.buffer || 0),
        job: m.state.job ? { i: (m.def.recipes || []).indexOf(m.state.job.recipe), t: +(m.state.job.t || 0).toFixed(2) } : null,
        queue: (m.state.queue || [])
          .map((q) => ({ i: (m.def.recipes || []).indexOf(q.recipe), t: +(q.t || 0).toFixed(2) }))
          .filter((q) => q.i >= 0),
      },
    }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!e || !this.templates.has(e.id)) continue;
      const inst = this.place(e.id, e.x, e.z, { y: e.y, rot: e.r || 0 });
      if (!inst || !e.s) continue;
      inst.state.slots = e.s.slots || {};
      inst.state.progress = e.s.progress || 0;
      inst.state.heat = e.s.heat || 0;
      inst.state.burning = !!e.s.burning;
      inst.state.burnT = e.s.burnT || 0;
      inst.state.buffer = e.s.buffer || 0;

      if (inst.def.kind === 'processor') {
        const job = e.s.job;
        if (job && inst.def.recipes?.[job.i]) {
          inst.state.job = { recipe: inst.def.recipes[job.i], t: job.t || 0 };
          const dur = Math.max(0.001, inst.state.job.recipe.time || 1);
          inst.state.progress = Math.min(1, inst.state.job.t / dur);
        }
        inst.state.queue = (e.s.queue || [])
          .map((q) => inst.def.recipes?.[q.i])
          .filter(Boolean)
          .map((recipe) => ({ recipe, t: 0 }));

        for (const key of Object.keys(inst.state.slots)) {
          const s = inst.state.slots[key];
          if (!s) { delete inst.state.slots[key]; continue; }
          const left = this.ctx.give(s.id, s.n);
          if (left > 0) inst.state.slots[key] = { id: s.id, n: left };
          else delete inst.state.slots[key];
        }
      }


      if (inst.def.kind === 'crafting') {
        for (const key of Object.keys(inst.state.slots)) {
          if (!key.startsWith('grid')) continue;
          const s = inst.state.slots[key];
          if (!s) { delete inst.state.slots[key]; continue; }
          const left = this.ctx.give(s.id, s.n);
          if (left > 0) inst.state.slots[key] = { id: s.id, n: left };
          else delete inst.state.slots[key];
        }
      }
    }
    this.cableDirty = true;
  }

  open(inst) {
    this.openInst = inst;
    this.ctx.onOpen?.();
    this.ui.open(inst, () => { this.openInst = null; this.ctx.onClosed?.(); });
  }
}

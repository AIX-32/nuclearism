













import { DEPLETED_OF, regionOre, REACTOR_ROD_SLOTS, formatRadRate, TUNING, rollWeighted } from './content.js';
import { inventoryAdapter } from './drag-drop.js';
import { accepts, drain, fill } from './liquids.js';

export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet', 'hands'];

const ORE_TABLE = [
  ['stone', 26], ['carbon', 10], ['copper', 14], ['tin', 10], ['iron', 14], ['lead', 8],
  ['uranium', 7], ['lithium', 4], ['boron', 3], ['magnesium', 3], ['zirconium', 2],
  ['beryllium', 2], ['thorium', 3],
];

const MAXSLOT = 99;
const MACHINE_SCALE = 1.45;
const RTG_RATE = 4;
const POWER_FLOW = 50;
const POWER_REFILL_SECONDS = 15;
const NET_RANGE = 6;
const POLE_RANGE = 24;
const TOUCH_RANGE = 2.2;

function boreMaskFromModel(model, T, cell = 0.5) {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const box = new T.Box3().setFromObject(model);
  const size = box.getSize(new T.Vector3());
  if (size.x < 0.01 || size.y < 0.01) return { mask: [[0, 0.5]], frontZ: 0, backZ: 0 };
  const ray = new T.Raycaster();
  const dir = new T.Vector3(0, 0, 1);
  const mask = [];
  const seen = new Set();
  const x0 = Math.floor(box.min.x / cell) * cell;
  const x1 = Math.ceil(box.max.x / cell) * cell;
  const y0 = Math.floor(box.min.y / cell) * cell;
  const y1 = Math.ceil(box.max.y / cell) * cell;
  const zStart = box.min.z - 0.5;
  const far = (box.max.z - box.min.z) + 1;
  for (let x = x0 + cell / 2; x < x1; x += cell) {
    for (let y = y0 + cell / 2; y < y1; y += cell) {
      ray.set(new T.Vector3(x, y, zStart), dir);
      ray.far = far;
      const hits = ray.intersectObject(model, true);
      if (!hits.length) continue;
      const p = new T.Vector3(x, y, 0).applyMatrix4(inv);
      const k = `${Math.round(p.x / cell)},${Math.round(p.y / cell)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      mask.push([p.x, p.y]);
    }
  }

  const frontLocal = new T.Vector3(0, 0, box.min.z).applyMatrix4(inv).z;
  const backLocal = new T.Vector3(0, 0, box.max.z).applyMatrix4(inv).z;
  return { mask: mask.length ? mask : [[0, (box.min.y + box.max.y) / 2]], frontZ: Math.min(frontLocal, backLocal), backZ: Math.max(frontLocal, backLocal) };
}

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
    this.scrubbers = [];
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
        if (def.modelRotY) model.rotation.y += def.modelRotY;
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
      const bore = (def.kind === 'bore' || def.bore) ? boreMaskFromModel(model, this.T, 0.5) : null;

      this.templates.set(def.id, { def, model, layout, animations, size: footprint, bore });
    }));
    return this;
  }

  placeholderModel(def) {
    const T = this.T;
    const g = new T.Group();
    const colors = {
      reactor: 0xb06060, generator: 0x6fb0a0, storage: 0x7f7f9f, cable: 0xd0b060, starter_cable: 0xc7883f,
      excavator: 0xa08040, crafting: 0x8aa0c0, armor: 0x90a0a0,
    };
    const col = colors[def.kind] || 0x8090a8;
    const h = def.height * MACHINE_SCALE;
    if (def.kind === 'pylon') {


      const mast = new T.Mesh(new T.BoxGeometry(0.32, h, 0.32), new T.MeshLambertMaterial({ color: 0x8d97a4 }));
      mast.position.y = h / 2;
      g.add(mast);
      const arm = new T.Mesh(new T.BoxGeometry(1.5, 0.16, 0.16), new T.MeshLambertMaterial({ color: 0xb9c2cc }));
      arm.position.y = h - 0.2;
      g.add(arm);
      return g;
    }
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
    if (!world || !world.field || !world.markEdited) return;
    const field = world.field;


    const roofY = Math.ceil(y + 2.2);
    let covered = 0;
    for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      if (field.get(Math.floor(x + dx), roofY, Math.floor(z + dz)) > 0) covered++;
    }
    if (covered >= 3) return;

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
    world.markEdited(x0, x1, y0, y1, z0, z1);
  }






  setupBwe(mesh, def) {
    const T = this.T;
    const cfg = def.bwe || {};
    const front = mesh.getObjectByName('frontboom');
    const bw = mesh.getObjectByName('bw');
    const wheel = mesh.getObjectByName('wheel');
    const rope = mesh.getObjectByName('ropetofrontboom');
    if (!front || !bw || !wheel) return null;

    const pivotPos = cfg.boomPivot || [5.375, 4.375, 0];
    const pivot = new T.Group();
    pivot.position.set(pivotPos[0], pivotPos[1], pivotPos[2]);
    mesh.add(pivot);
    mesh.updateMatrixWorld(true);
    pivot.attach(front);
    pivot.attach(bw);
    mesh.updateMatrixWorld(true);

    let radiusLocal = 6.938, halfWidthLocal = 0.875;
    if (wheel.geometry) {
      if (!wheel.geometry.boundingBox) wheel.geometry.computeBoundingBox();
      const bb = wheel.geometry.boundingBox;
      radiusLocal = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
      halfWidthLocal = (bb.max.y - bb.min.y) / 2;
    }

    const mast = new T.Vector3(...(cfg.mast || [3.8, 14.07, 0]));
    const anchor = new T.Vector3(...(cfg.boomAnchor || [16.38, 7.29, 0])).sub(pivot.position);
    return {
      pivot, wheel, rope, radiusLocal, halfWidthLocal,
      mast, boomAnchorLocal: anchor,
      ropeSpan: cfg.ropeSpan || 14,
      ropeCenter: cfg.ropeCenter ?? 0.25,


      yaw: 0, boom: 0, yawCur: 0, boomCur: 0,
      wheelOn: false, spinVel: 0, digT: 0,
    };
  }

  updateBweRope(m) {
    const b = m.bwe;
    if (!b || !b.rope) return;
    const T = this.T;
    const angle = -(b.boomCur ?? b.boom);
    const c = Math.cos(angle), s = Math.sin(angle);
    const a = b.boomAnchorLocal;
    const bx = b.pivot.position.x + a.x * c - a.y * s;
    const by = b.pivot.position.y + a.x * s + a.y * c;
    const B = new T.Vector3(bx, by, b.pivot.position.z + a.z);
    const dir = B.clone().sub(b.mast);
    const len = Math.max(0.001, dir.length());
    const scaleY = len / Math.max(0.001, b.ropeSpan);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.clone().normalize());
    const centre = new T.Vector3(0, b.ropeCenter * scaleY, 0).applyQuaternion(q);
    b.rope.quaternion.copy(q);
    b.rope.scale.set(1, scaleY, 1);
    b.rope.position.copy(b.mast).addScaledVector(dir, 0.5).sub(centre);
  }

  controlBwe(inst, action) {
    const b = inst && inst.bwe;
    if (!b) return false;


    if (action === 'yawLeft') b.yaw += 0.015;
    else if (action === 'yawRight') b.yaw -= 0.015;
    else if (action === 'boomUp') b.boom = Math.max(-0.16, b.boom - 0.005);
    else if (action === 'boomDown') b.boom = Math.min(0.55, b.boom + 0.005);
    else if (action === 'wheel') b.wheelOn = !b.wheelOn;
    else return false;
    if (action.startsWith('yaw')) {


      const twoPi = Math.PI * 2;
      if (b.yaw > Math.PI) { b.yaw -= twoPi; b.yawCur -= twoPi; }
      else if (b.yaw < -Math.PI) { b.yaw += twoPi; b.yawCur += twoPi; }
    }
    return true;
  }

  controlBore(inst, action) {
    if (!inst || inst.def.kind !== 'bore') return false;
    const step = Math.PI / 36;
    let pitch = inst.state.pitch || 0;
    if (action === 'pitchDown') pitch -= step;
    else if (action === 'pitchUp') pitch += step;
    else if (action === 'pitchLevel') pitch = 0;
    else return false;
    inst.state.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, pitch));
    return true;
  }

  tickBwe(m, dt, net) {
    const b = m.bwe, st = m.state;
    if (!b) { st.status = 'IDLE'; return; }


    const yawK = 1 - Math.exp(-dt / 1.2);
    const boomK = 1 - Math.exp(-dt / 1.6);
    b.yawCur += (b.yaw - b.yawCur) * yawK;
    b.boomCur += (b.boom - b.boomCur) * boomK;
    if (Math.abs(b.yaw - b.yawCur) < 0.0003) b.yawCur = b.yaw;
    if (Math.abs(b.boom - b.boomCur) < 0.0003) b.boomCur = b.boom;
    m.mesh.rotation.y = (m.rot || 0) + b.yawCur;
    b.pivot.rotation.z = -b.boomCur;

    const cost = (m.def.energy?.use || 0) * dt;
    const powered = !b.wheelOn || this.drawPower(m, cost);
    if (b.wheelOn && powered) {
      b.spinVel = Math.min(2.8, b.spinVel + dt * 1.8);
      b.wheel.rotateY(b.spinVel * dt);
      st.status = this.hasOutputRoom(m) ? 'MINING' : 'OUTPUT FULL';
    } else {
      b.spinVel = Math.max(0, b.spinVel - dt * 3.2);
      if (b.spinVel > 0) b.wheel.rotateY(b.spinVel * dt);
      st.status = b.wheelOn ? 'NO POWER' : 'WHEEL OFF';
    }

    this.updateBweRope(m);
    m.mesh.updateMatrixWorld(true);

    if (!b.wheelOn || !powered || !this.hasOutputRoom(m)) return;
    b.digT = (b.digT || 0) - dt;
    if (b.digT > 0) return;
    b.digT = 0.16;
    this.digBwe(m);
  }

  digBwe(m) {
    const T = this.T, b = m.bwe, world = this.ctx.world;
    if (!world || !world.field) return;
    const W = b.wheel.getWorldPosition(new T.Vector3());
    const q = b.wheel.getWorldQuaternion(new T.Quaternion());
    const scale = Math.max(...b.wheel.getWorldScale(new T.Vector3()).toArray());
    const R = b.radiusLocal * scale;
    const rr = Math.max(0.9, Math.min(2.2, R * 0.18));
    const u = new T.Vector3(1, 0, 0).applyQuaternion(q).normalize();
    const v = new T.Vector3(0, 0, 1).applyQuaternion(q).normalize();

    const seen = new Set();
    const removed = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const field = world.field;

    for (let a = 0; a < 28; a++) {
      const ang = (a / 28) * Math.PI * 2;
      const px = W.x + (u.x * Math.cos(ang) + v.x * Math.sin(ang)) * R;
      const py = W.y + (u.y * Math.cos(ang) + v.y * Math.sin(ang)) * R;
      const pz = W.z + (u.z * Math.cos(ang) + v.z * Math.sin(ang)) * R;
      const ground = world.getSurfaceHeight(px, pz, 90);
      if (py > ground + 0.35 || py < ground - rr * 3) continue;

      const cx0 = Math.floor(px - rr), cx1 = Math.ceil(px + rr);
      const cy0 = Math.floor(py - rr), cy1 = Math.ceil(py + rr);
      const cz0 = Math.floor(pz - rr), cz1 = Math.ceil(pz + rr);
      for (let ix = cx0; ix <= cx1; ix++) {
        for (let iy = cy0; iy <= cy1; iy++) {
          if (iy < 1) continue;
          for (let iz = cz0; iz <= cz1; iz++) {
            const d = Math.hypot(ix - px, iy - py, iz - pz);
            if (d > rr) continue;
            const key = `${ix},${iy},${iz}`;
            if (seen.has(key)) continue;
            if (field.get(ix, iy, iz) <= 0) continue;
            seen.add(key);
            field.set(ix, iy, iz, 0);
            removed.push([ix, iy, iz]);
            if (ix < x0) x0 = ix; if (ix > x1) x1 = ix;
            if (iy < y0) y0 = iy; if (iy > y1) y1 = iy;
            if (iz < z0) z0 = iz; if (iz > z1) z1 = iz;
            if (removed.length >= 260) break;
          }
          if (removed.length >= 260) break;
        }
        if (removed.length >= 260) break;
      }
      if (removed.length >= 260) break;
    }

    if (!removed.length) return;
    world.markEdited(x0, x1, y0, y1, z0, z1);

    if (this.ctx.mineDrops && this.ctx.groundBand) {
      const events = Math.min(10, Math.max(1, Math.round(removed.length * 0.09)));
      for (let i = 0; i < events; i++) {
        const [x, y, z] = removed[Math.floor(Math.random() * removed.length)];
        const band = this.ctx.groundBand(x, y, z);
        for (const [id, n] of this.ctx.mineDrops(band, y, x, z)) {
          if (n > 0) this.addOutput(m, id, n);
        }
      }
    }
  }

  place(id, x, z, opts = {}) {
    const tpl = this.templates.get(id);
    if (!tpl) return null;
    const size = tpl.def.footprint ? { x: tpl.def.footprint[0], z: tpl.def.footprint[1] } : (tpl.size || { x: 1, z: 1 });
    const rot = (opts.rot || 0) % (Math.PI * 2);
    const quarter = Math.round(rot / (Math.PI / 2)) % 2;
    const hx = Math.max(0.4, (quarter ? size.z : size.x) / 2);
    const hz = Math.max(0.4, (quarter ? size.x : size.z) / 2);
    const player = this.ctx.player;
    if (!opts.restore && player && Math.abs(player.pos.x - x) < hx + player.radius + 0.1
      && Math.abs(player.pos.z - z) < hz + player.radius + 0.1) return null;
    const y = opts.y !== undefined ? opts.y : this.ctx.world.getSurfaceHeight(x, z, 90);
    if (!tpl.def.noPad && !opts.onBuilding && !opts.restore) this.flattenPad(x, y, z, Math.max(hx, hz));
    const mesh = tpl.model.clone(true);
    const spinNames = tpl.def.spin ? [].concat(tpl.def.spin) : [];
    const spinNodes = [];
    for (const name of spinNames) mesh.traverse((o) => { if (o.name === name && !spinNodes.includes(o)) spinNodes.push(o); });
    for (const spinNode of spinNodes) {


      if (spinNode.children.length && spinNode.position.lengthSq() > 0.0001) {
        const pivotOffset = spinNode.position.clone();
        spinNode.position.set(0, 0, 0);
        for (const child of spinNode.children) {
          if (child.isObject3D) child.position.add(pivotOffset);
        }
      }
    }

    mesh.position.set(x, y + mesh.position.y, z);
    mesh.rotation.y = rot + (tpl.def.modelRotY || 0);
    if (tpl.def.kind === 'bore') mesh.rotation.order = 'YXZ';
    const bwe = tpl.def.kind === 'bwe' ? this.setupBwe(mesh, tpl.def) : null;
    this.ctx.scene.add(mesh);
    const inst = {
      uid: this.uidSeq++, def: tpl.def, x, y, z, rot, mesh, layout: tpl.layout,
      top: y + tpl.def.height * MACHINE_SCALE, hx, hz,
      spinNode: spinNodes[0] || null, spinNodes, bwe, boreMask: tpl.bore || null,
      state: { slots: {}, progress: 0, heat: 0, recipe: null, job: null, queue: [], burning: false, burnT: 0, buffer: (tpl.def.coolingPower ? (tpl.def.capacity || 0) : 0), genRate: (tpl.def.infinite ? 1000 : 0), status: 'IDLE', fuelBuf: 0, boreProg: 0, pitch: 0, pitchCur: 0, usage: {} },
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
      onActivate: () => (tpl.def.kind === 'pump' ? this.pump(inst) : tpl.def.manual ? this.crank(inst) : this.open(inst)),
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
      const at = { x: inst.x, y: inst.y + 0.5, z: inst.z };
      for (const s of Object.values(inst.state.slots)) if (s && s.id) this.giveBack(s, at);
      this.giveBack({ id: inst.def.id, n: 1 }, at);
    }
    this.cableDirty = true;
  }

  at(x, z, pad = 1.2) {
    for (const m of this.instances) if (Math.hypot(m.x - x, m.z - z) < pad) return m;
    return null;
  }





  powerCap(m) {
    const d = m.def;
    if (d.capacity) return Math.max(400, d.capacity);
    return Math.max(400, d.energy?.use ? d.energy.use * 3 : 0);
  }

  hasPowerPort(m) {
    const d = m.def;
    return !!(d.energy || d.capacity || d.kind === 'reactor');
  }

  chargeRate(m) {
    const cap = this.powerCap(m);
    return Math.max(POWER_FLOW, (m.def.energy?.use || 0) * 2, cap / POWER_REFILL_SECONDS);
  }

  chargePower(m, dt, net) {
    if (!this.hasPowerPort(m)) return;


    if (m.def.kind === 'generator') return;


    if (m.def.capacity) return;
    const cap = this.powerCap(m);
    const cur = m.state.buffer || 0;
    if (cur >= cap || net.pool <= 0) {
      m.state.buffer = Math.min(cap, cur);
      return;
    }
    const want = Math.min(cap - cur, net.pool, this.chargeRate(m) * dt);
    net.pool -= want;
    m.state.buffer = cur + want;
    m.netDraw = want;
  }

  drawPower(m, cost) {
    const b = m.state.buffer || 0;
    if (b < cost) return false;
    m.state.buffer = b - cost;
    return true;
  }

  attributeDrain(m, net, give) {
    const users = net.members.filter((o) => (o.netDraw || 0) > 0);
    let total = 0;
    for (const u of users) total += u.netDraw;
    if (!total || give <= 0) return;
    const usage = m.state.usage || (m.state.usage = {});
    for (const u of users) {
      const id = u.def.id;
      usage[id] = (usage[id] || 0) + give * (u.netDraw / total);
    }
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
      invAdapter: (i) => this.invAdapter(i),
      slotAdapter: (role) => this.slotAdapter(role),
      take: (role) => this.take(role),
      collect: (role) => this.take(role),
      sortContainer: () => this.sortContainer(),
      sortInventory: () => this.sortInventory(),
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
      bweState: () => {
        const m = this.openInst;
        if (!m || m.def.kind !== 'bwe' || !m.bwe) return null;
        const used = Object.values(m.state.slots).filter((s) => s && s.id && s.n > 0).length;
        return {
          yaw: m.bwe.yawCur, boom: m.bwe.boomCur, wheel: m.bwe.wheelOn,
          spin: m.bwe.spinVel, status: m.state.status, used, total: m.def.outputs || 64,
        };
      },
      bweControl: (action) => this.controlBwe(this.openInst, action),
      boreState: () => {
        const m = this.openInst;
        if (!m || m.def.kind !== 'bore') return null;
        return { pitch: m.state.pitch || 0, status: m.state.status };
      },
      boreControl: (action) => this.controlBore(this.openInst, action),
      batteryUsage: () => {
        const m = this.openInst;
        return m && m.def.capacity ? (m.state.usage || {}) : null;
      },
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

  giveBack(stack, at) {
    if (!stack) return;
    if (stack.plates && stack.plates.length) {
      if (!this.ctx.giveStack(stack) && this.ctx.spawnDrop) {
        this.ctx.spawnDrop(stack.id, stack.n || 1, at || { x: this.ctx.player?.pos.x, y: this.ctx.player?.pos.y, z: this.ctx.player?.pos.z }, stack.liquid, stack.plates);
      }
      return;
    }
    const left = this.ctx.give(stack.id, stack.n);
    if (left > 0 && this.ctx.spawnDrop) {
      this.ctx.spawnDrop(stack.id, left, at || { x: this.ctx.player?.pos.x, y: this.ctx.player?.pos.y, z: this.ctx.player?.pos.z }, stack.liquid, stack.plates);
    }
  }

  invAdapter(i) {
    const { grid, idx } = this.invStack(i);
    return inventoryAdapter(grid, idx, this.ITEMS);
  }

  slotAccepts(role, stack) {
    const m = this.openInst;
    if (!m || !stack) return false;
    if (role === 'armor') return !!this.ITEMS[stack.id]?.armor;
    if (role.startsWith('output')) return false;
    if (role.startsWith('plate')) {
      const armor = m.state.slots.armor;
      const a = armor && this.ITEMS[armor.id]?.armor;
      return !!this.ITEMS[stack.id]?.plate && !!a && (armor.plates || []).length < (a.plateSlots || 0);
    }
    if (role.startsWith('rod')) return !!this.ITEMS[stack.id]?.rod;
    if (m.def.kind === 'reactor' && role === 'fuel') return !!this.ITEMS[stack.id]?.fuel;
    if ((m.def.drive || m.def.bore) && role.startsWith('fuel')) {
      if (stack.id === 'carbon' || stack.id === 'heavy_fuel_oil') return true;
      return !!(stack.liquid && stack.liquid.id === 'gasoline' && (stack.liquid.amount || 0) > 0);
    }
    if (role === 'upgrade0') return !!this.ITEMS[stack.id]?.boreUpgrade;
    return true;
  }

  slotTake(role) {
    const m = this.openInst;
    if (!m) return null;
    const s = m.state.slots[role] || null;
    m.state.slots[role] = null;
    return s;
  }

  slotRestore(role, stack) {
    const m = this.openInst;
    if (m) m.state.slots[role] = stack;
  }

  slotPut(role, stack) {
    const m = this.openInst;
    if (!m || !stack) return stack;
    const item = this.ITEMS[stack.id] || {};

    if (role === 'armor') {
      if (!item.armor) return stack;
      const cur = m.state.slots.armor || null;
      m.state.slots.armor = stack;
      return cur;
    }
    if (role.startsWith('plate')) {
      const armor = m.state.slots.armor;
      const a = armor && this.ITEMS[armor.id]?.armor;
      if (!a || !item.plate) return stack;
      armor.plates = armor.plates || [];
      if (armor.plates.length >= (a.plateSlots || 0)) return stack;
      armor.plates.push(stack.id);
      stack.n--;
      return stack.n > 0 ? stack : null;
    }
    if (role.startsWith('output')) return stack;
    if (role.startsWith('rod') && !item.rod) return stack;
    if (m.def.kind === 'reactor' && role === 'fuel' && !item.fuel) return stack;

    const cur = m.state.slots[role] || null;

    if (role.startsWith('rod')) {
      m.state.slots[role] = stack;
      return cur;
    }
    if (cur && cur.id === stack.id && !cur.liquid && !stack.liquid && cur.n < MAXSLOT) {
      const mv = Math.min(MAXSLOT - cur.n, stack.n);
      cur.n += mv;
      stack.n -= mv;
      return stack.n > 0 ? stack : null;
    }
    m.state.slots[role] = stack;
    return cur;
  }

  slotAdapter(role) {
    return {
      stack: () => this.openInst?.state.slots[role] || null,
      accepts: (stack) => this.slotAccepts(role, stack),
      take: () => this.slotTake(role),
      put: (stack) => this.slotPut(role, stack),
      restore: (stack) => this.slotRestore(role, stack),
    };
  }

  sortCategory(id) {
    const d = this.ITEMS[id];
    if (!d) return 7;
    if (d.workbench) return 8;
    if (d.tool || d.torch || d.geiger) return 0;
    if (d.armor || d.plate) return 1;
    if (d.consumable) return 2;
    if (d.container) return 3;
    if (d.fuel) return 9;
    if (/ ORE$/.test(d.name)) return 5;
    if (/ (INGOT|DUST|PLATE|SOLENOID)$/.test(d.name)) return 6;
    if (d.block) return 4;
    return 7;
  }

  sortedStacks(src) {
    const stacks = [];
    for (const s of src) {
      if (!s) continue;
      const cap = this.ITEMS[s.id]?.stack || 64;
      const prev = stacks.find((x) => x.id === s.id && !x.liquid && !s.liquid && !x.plates?.length && !s.plates?.length && x.n < cap);
      if (prev) {
        const mv = Math.min(cap - prev.n, s.n);
        prev.n += mv;
        if (s.n - mv > 0) stacks.push({ ...s, n: s.n - mv });
      } else stacks.push({ ...s, plates: s.plates ? [...s.plates] : undefined, liquid: s.liquid ? { ...s.liquid } : undefined });
    }
    stacks.sort((a, b) => {
      const ca = this.sortCategory(a.id), cb = this.sortCategory(b.id);
      if (ca !== cb) return ca - cb;
      const na = (this.ITEMS[a.id]?.name || a.id).toLowerCase();
      const nb = (this.ITEMS[b.id]?.name || b.id).toLowerCase();
      if (na !== nb) return na < nb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return stacks;
  }

  sortContainer() {
    const m = this.openInst;
    if (!m || m.def.kind !== 'storage') return;
    const roles = Object.keys(m.state.slots).filter((r) => /^slot\d+$/.test(r)).sort((a, b) => +a.slice(4) - +b.slice(4));
    if (!roles.length) return;
    const stacks = this.sortedStacks(roles.map((r) => m.state.slots[r]));
    for (let i = 0; i < roles.length; i++) m.state.slots[roles[i]] = stacks[i] || null;
    this.ui.refresh();
    this.ctx.syncBars();
  }

  sortInventory() {
    const stacks = this.sortedStacks(this.inv.main);
    for (let i = 0; i < this.inv.main.length; i++) this.inv.main[i] = stacks[i] || null;
    this.ui.refresh();
    this.ctx.syncBars();
  }

  drop(i, role) {
    const m = this.openInst; if (!m) return false;
    const { grid, idx, stack } = this.invStack(i);
    if (!stack) return false;



    const cur = m.state.slots[role] || null;
    if (cur && (cur.id !== stack.id || cur.liquid || stack.liquid || cur.n >= MAXSLOT)) return false;
    const before = stack.n;
    grid[idx] = null;
    const left = this.slotPut(role, stack);
    grid[idx] = left || null;
    const changed = left !== stack || stack.n !== before;
    if (changed) this.ctx.syncBars?.();
    return changed;
  }

  take(role) {
    const m = this.openInst;
    if (!m) return false;
    const s = this.slotTake(role);
    if (!s) return false;
    if (s.liquid || s.plates) {
      if (this.ctx.giveStack(s)) return true;
      this.slotRestore(role, s);
      return false;
    }
    const left = this.ctx.give(s.id, s.n);
    if (left > 0) { s.n = left; this.slotRestore(role, s); }
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




  recipeNeeds(r, m = null) {
    let needs = { ...(r.in || r.needs || {}) };
    if (r.in) {
      for (const [id, n] of Object.entries(r.out || {})) {
        if (!needs[id]) continue;
        needs[id] = Math.max(0, needs[id] - n);
        if (!needs[id]) delete needs[id];
      }
    }
    if (m?.def.id === 'manufactory') {
      const outId = Object.keys(r.out || {})[0];
      if (outId && this.ITEMS[outId]?.building?.tier === 'wood' && needs.wood) {
        needs = { ...needs, wood: Math.max(1, Math.floor(needs.wood / 2)) };
      }
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


  craftCost(m) { return m?.def.energy?.craft || 0; }

  bagOptions(m, recipes, { powerCost = 0 } = {}) {
    const counts = this.invCounts();
    const liqs = this.bagLiquids();
    const power = m?.state.buffer || 0;
    const out = [];
    recipes.forEach((recipe, i) => {
      const outs = this.recipeOut(recipe);
      const outIds = Object.keys(outs).filter((id) => outs[id] > 0);
      let displayId, displayCount, label;
      if (outIds.length) {
        displayId = outIds[0]; displayCount = outs[outIds[0]];
        if (outIds.length > 1) {
          label = outIds.map((id) => `${outs[id]}× ${this.ITEMS[id]?.name || id}`).join(' + ');
        }
      } else if (recipe.liquidOut) {

        displayId = recipe.liquidOut.container; displayCount = 1;
      } else return;
      let crafts = Infinity;
      const needs = Object.entries(this.recipeNeeds(recipe, m));
      for (const [id, n] of needs) crafts = Math.min(crafts, Math.floor((counts[id] || 0) / n));
      for (const l of (recipe.liquidIn || [])) crafts = Math.min(crafts, Math.floor((liqs[l.id] || 0) / l.amount));
      if (!isFinite(crafts) || crafts < 1) return;
      const noPower = powerCost > 0 && power < powerCost;
      out.push({
        key: `r${i}`, recipe, id: displayId, count: displayCount, label, crafts, needs,
        liquidNeeds: (recipe.liquidIn || []).map((l) => ({ id: l.id, amount: l.amount })),
        time: recipe.time || 0,
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
    const cost = m.def.kind === 'crafting' ? this.craftCost(m) : 0;
    let started = 0;
    for (let i = 0; i < limit; i++) {
      if (cost && (m.state.buffer || 0) < cost) { if (!started) m.state.status = 'NO POWER'; break; }
      const counts = this.invCounts();
      let affordable = true;
      for (const [id, n] of Object.entries(this.recipeNeeds(recipe, m))) {
        if ((counts[id] || 0) < n) { affordable = false; break; }
      }
      if (!affordable) { if (!started) m.state.status = 'NO MATERIALS'; break; }
      const liqs = this.bagLiquids();
      let wet = true;
      for (const l of (recipe.liquidIn || [])) {
        if ((liqs[l.id] || 0) < l.amount) { wet = false; break; }
      }
      if (!wet) { if (!started) m.state.status = 'NO LIQUID'; break; }
      if (!this.outputsHaveRoom(m, recipe)) {
        if (!started) {
          m.state.status = 'OUTPUT FULL';
          this.ctx.notice?.('OUTPUT FULL');
        }
        break;
      }
      for (const [id, n] of Object.entries(this.recipeNeeds(recipe, m))) this.takeInv(id, n);
      for (const l of (recipe.liquidIn || [])) this.takeBagLiquid(l.id, l.amount);
      if (cost) m.state.buffer = Math.max(0, (m.state.buffer || 0) - cost);
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
    return this.startJob(m, recipe, mods);
  }




  startJobFromSlots(m, recipe) {
    if (!m || !recipe) return false;
    const cost = m.def.kind === 'crafting' ? this.craftCost(m) : 0;
    if (cost && (m.state.buffer || 0) < cost) { m.state.status = 'NO POWER'; return false; }
    const needs = this.recipeNeeds(recipe, m);
    const have = this.inputCounts(m);
    for (const [id, n] of Object.entries(needs)) if ((have[id] || 0) < n) return false;
    const liq = this.liquidCounts(m);
    for (const l of (recipe.liquidIn || [])) if ((liq[l.id] || 0) < l.amount) return false;
    if (!this.outputsHaveRoom(m, recipe)) { m.state.status = 'OUTPUT FULL'; return false; }
    for (const [id, n] of Object.entries(needs)) this.takeFromInputs(m, id, n);
    for (const l of (recipe.liquidIn || [])) this.drainInputs(m, l.id, l.amount);
    if (cost) m.state.buffer = Math.max(0, (m.state.buffer || 0) - cost);
    const job = { recipe, t: 0 };
    if (!m.state.job) m.state.job = job;
    else (m.state.queue ||= []).push(job);
    m.state.progress = 0;
    m.state.status = 'STARTED';
    this.ctx.syncBars?.();
    return true;
  }

  takeFromInputs(m, id, n) {
    let left = n;
    for (let i = 0; i < 4 && left > 0; i++) {
      const s = m.state.slots[`input${i}`];
      if (!s || s.id !== id || s.liquid) continue;
      const take = Math.min(s.n, left);
      s.n -= take; left -= take;
      if (s.n <= 0) m.state.slots[`input${i}`] = null;
    }
    return left;
  }

  drainInputs(m, liquidId, amount) {
    let left = amount;
    for (let i = 0; i < 4 && left > 0; i++) {
      const s = m.state.slots[`input${i}`];
      if (!s?.liquid || s.liquid.id !== liquidId) continue;
      left -= drain(s, left);
    }
    return left;
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


    const ins = this.instances.filter((m) => m.def.kind !== 'pylon' && !(m.def.kind === 'storage' && !m.def.capacity));
    const parent = ins.map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    const edges = [];
    for (let i = 0; i < ins.length; i++) {
      for (let j = i + 1; j < ins.length; j++) {
        const a = ins[i], b = ins[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        const cable = a.def.kind === 'cable' || a.def.kind === 'starter_cable' || b.def.kind === 'cable' || b.def.kind === 'starter_cable';
        const poles = (a.def.kind === 'cable' && b.def.kind === 'cable');
        const starter = (a.def.kind === 'starter_cable' || b.def.kind === 'starter_cable');
        const reach = poles ? POLE_RANGE : starter ? 4 : NET_RANGE;
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
    const slots = (m.def.rodSlots === 0) ? 0 : (m.def.rodSlots || REACTOR_ROD_SLOTS);
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
    const r = m.def.meltdownRadius || 6;
    const f = this.ctx.world.field;
    for (let x = Math.floor(m.x - r); x <= Math.ceil(m.x + r); x++)
      for (let y = Math.floor(m.y - r); y <= Math.ceil(m.y + r); y++)
        for (let z = Math.floor(m.z - r); z <= Math.ceil(m.z + r); z++) {
          const d = Math.hypot(x - m.x, y - m.y, z - m.z);
          if (d <= r) f.set(x, y, z, -1);
        }
    this.ctx.world.markEdited(Math.floor(m.x - r), Math.ceil(m.x + r), Math.floor(m.y - r), Math.ceil(m.y + r), Math.floor(m.z - r), Math.ceil(m.z + r));
    this.bursts.push({ x: m.x, y: m.y + 1, z: m.z, rad: r * 10, life: 60 });
    this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: Math.round(r * 6.666) });
    this.ctx.explode?.(m.x, m.y, m.z, r);
    this.remove(m, false);
  }


  update(dt) {
    this.emitList.length = 0;
    this.absorbers.length = 0;
    this.cleaners.length = 0;
    this.scrubbers.length = 0;
    for (const b of this.bursts) { this.emitList.push({ x: b.x, y: b.y, z: b.z, rad: b.rad }); b.life -= dt; }
    this.bursts = this.bursts.filter((b) => b.life > 0);
    for (const m of this.instances) m.netDraw = 0;

    if (this.cableDirty) { this.rebuildCables(); this.cableDirty = false; }

    const { nets } = this.buildNetworks();
    for (const net of nets) {
      let cap = this.baseCap, pool = 0;
      for (const m of net.members) {
        if (m.def.capacity) { cap += m.def.capacity; pool += m.state.buffer || 0; }
      }
      net.cap = cap; net.pool = Math.min(cap, pool); net.stored = net.pool;
      for (const m of net.members) m.net = net;
    }

    for (const net of nets) {
      for (const m of net.members) {
        const def = m.def;
        if (def.kind === 'generator') {
          if (def.rtg) { this.tickRtg(m, dt, net); continue; }
          if (def.battery) { this.tickBattery(m, dt, net); continue; }
          if (def.manual) {
            const spinTime = Math.max(0, (m.state.spin || 0) - dt);
            m.state.spin = spinTime;
            m.state.spinBoost = Math.max(0, (m.state.spinBoost || 0) - dt * 0.45);

            if (spinTime > 0) {
              const spinBoost = m.state.spinBoost || 0;
              const powerRate = (def.energy?.gen || 45) * (1 + spinBoost * 0.45);

              net.pool = Math.min(net.cap, net.pool + powerRate * dt);
              for (const node of (m.spinNodes || (m.spinNode ? [m.spinNode] : []))) node.rotateY(dt * (m.def.spinRate || 8) * (1 + spinBoost * 0.8));
              m.state.status = 'CRANKING';
            } else {
              m.state.status = 'IDLE';
            }
            continue;
          }
          if (def.infinite) {
             const gen = Math.max(0, Number(m.state.genRate) || 0);
             net.pool = Math.min(net.cap, net.pool + gen * dt);
             m.state.status = `GENERATING ${gen}`;
             continue;
           }
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
        if (k === 'processor' || k === 'crafting') this.tickProcessor(m, dt, net);
        else if (k === 'excavator') this.tickExcavator(m, dt, net);
        else if (k === 'bwe') this.tickBwe(m, dt, net);
        else if (k === 'bore') this.tickBore(m, dt, net);
        else if (k === 'absorber') this.tickAbsorber(m, dt, net);
        else if (k === 'scrubber') this.tickScrubber(m, dt, net);
        else if (k === 'geiger') {
          const r = this.localRad(m.x, m.y + 1, m.z);
          m.state.status = `FIELD ${formatRadRate(r)}`;
        } else if (k === 'cable') m.state.status = 'LINKED';
        else if (k === 'pylon') m.state.status = 'STANDING';
        else if (k === 'storage') m.state.status = `${Math.round(net.pool)} / ${net.cap}`;
      }
    }

    for (const net of nets) {




      let left = net.pool - net.stored;
      for (const m of net.members) {
        if (!m.def.capacity) continue;
        const cur = m.state.buffer || 0;
        if (left >= 0) {
          const take = Math.min(Math.max(0, m.def.capacity - cur), left, this.chargeRate(m) * dt);
          m.state.buffer = cur + take;
          left -= take;
        } else {
          const give = Math.min(cur, -left);
          m.state.buffer = cur - give;
          left += give;
          this.attributeDrain(m, net, give);
        }
      }
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


      if (m.def.kind === 'crafting') return;
      const n = this.craftOptions(m).length;
      st.status = n ? `${n} RECIPE${n === 1 ? '' : 'S'} READY` : 'NO MATERIALS';
      return;
    }
    const r = job.recipe;
    const dur = Math.max(0.001, r.time || 1);
    const cost = m.def.kind === 'crafting' ? 0 : (m.def.energy?.use || 0) * dt;
    if (cost && !this.drawPower(m, cost)) {
      st.progress = Math.min(1, job.t / dur);
      st.status = 'NO POWER';
      return;
    }
    job.t += dt;
    st.progress = Math.min(1, job.t / dur);
    st.status = m.def.kind === 'crafting' ? 'CRAFTING' : 'RUNNING';
    for (const node of (m.spinNodes || (m.spinNode ? [m.spinNode] : []))) node.rotateY(dt * (m.def.spinRate || 6));
    if (r.rad) this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: r.rad });
    if (m.def.id === 'decontaminator'
      && Math.hypot(this.ctx.player.pos.x - m.x, this.ctx.player.pos.z - m.z) < 3) {
      this.cleaners.push(m);
    }
    if (job.t >= dur) {
      const out = m.def.randomOut ? { [rollWeighted(m.def.randomOut)]: 1 } : r.out;
      const result = { ...r, out };
      if (!this.outputsHaveRoom(m, result)) {
        st.status = 'OUTPUT FULL';
        return;
      }
      this.giveOutputs(m, result);
      for (const [id, n] of Object.entries(out || {})) if (n > 0) this.ctx.onCraft?.(id, n);
      st.job = null;
      st.progress = 0;
      st.status = st.queue?.length ? `CRAFTED · ${st.queue.length} QUEUED` : 'CRAFTED';
    }
  }

  tickReactor(m, dt, net) {
    const st = m.state, def = m.def;
    const fuel = st.slots.fuel;
    const fd = fuel && this.ITEMS[fuel.id]?.fuel;
    const powerCooling = def.coolingPower || 0;
    let powerOk = true;
    if (powerCooling > 0) {
      const cost = powerCooling * dt;
      if ((m.state.buffer || 0) >= cost) { m.state.buffer -= cost; powerOk = true; }
      else if (net.pool >= cost) { net.pool -= cost; powerOk = true; }
      else powerOk = false;
    }

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
    if (!st.burning) {
      if (powerCooling > 0 && (m.state.buffer || 0) < 10000) { st.status = 'NEEDS 10K POWER'; return; }
      st.burning = true; st.burnT = fd.lifetime; st.fuelId = fuel.id;
    }

    const rc = this.reactorCooling(m, dt);
    let cool = rc.cool;
    if (powerCooling > 0 && powerOk) cool += (def.cooling || 0);
    const target = fd.cool || fd.heat;
    const ratio = target > 0 ? cool / target : 1;



    const dev = Math.max(0, Math.abs(ratio - 1) - 0.05);
    const coolFactor = ratio >= 1
      ? Math.max(0.15, 1 - dev * 1.2)
      : Math.max(0.20, 1 - dev * 0.85);
    const neutron = Math.max(0.55, Math.min(1.35, 1 + rc.mod * 0.5 - rc.absorb * 0.2));
    const match = coolFactor * neutron;

    st.heat = Math.max(0, st.heat + (fd.heat - cool) * dt * 0.12);
    net.pool = Math.min(net.cap, net.pool + fd.power * match * dt);
    this.emitList.push({ x: m.x, y: m.y + 1, z: m.z, rad: (def.radActive || 0) + fd.rad });

    st.coolTotal = cool;
    st.coolTarget = target;
    st.coolMatch = Math.max(0, 1 - Math.abs(ratio - 1));
    st.match = match;
    st.power = fd.power * match;

    if (powerCooling > 0 && !powerOk) st.status = 'NO POWER';
    else if (st.heat > def.heatMax * 0.8) st.status = 'OVERHEATING';
    else if (!rc.used && !rc.heavy && !rc.water && !powerCooling) st.status = 'NO COOLANT';
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
    const savanna = this.ctx.biomeAt?.(m.x, m.z) === this.ctx.savannaBiome;
    const r = regionOre(m.x, m.z, savanna);
    return r === 'stone' ? null : r;
  }

  tickExcavator(m, dt, net) {
    const st = m.state;
    const savanna = this.ctx.biomeAt?.(m.x, m.z) === this.ctx.savannaBiome;
    const seam = this.seamAt(m);
    const cost = (m.def.energy?.use || 0) * dt;
    if (!this.hasOutputRoom(m)) { st.status = 'OUTPUT FULL'; return; }
    if (!this.drawPower(m, cost)) { st.status = 'NO POWER'; return; }
    st.progress += dt * (m.def.drillRate || 0.3);
    st.status = seam ? `DRILLING ${this.ITEMS[seam]?.name || seam}` : 'BARREN GROUND';
    for (const node of (m.spinNodes || (m.spinNode ? [m.spinNode] : []))) node.rotateY(dt * (m.def.spinRate || 6));
    if (st.progress >= 1) {
      st.progress = 0;
      const n = savanna && seam === 'iron' ? 2 : 1;
      this.addOutput(m, seam || this.rollOre(), n);
    }
  }

  tickBore(m, dt, net) {
    const st = m.state;
    const def = m.def.bore || {};
    const upg = m.state.slots.upgrade0;
    const speed = (def.speed || 0.003) * ((upg && this.ITEMS[upg.id]?.boreUpgrade?.speed) || 1);
    const step = def.step || 0.35;
    const fuelDef = def.fuel || { carbon: 12, heavy_fuel_oil: 576, gasoline: 18 };
    const T = this.T;
    const targetPitch = st.pitch || 0;
    if (st.pitchCur == null) st.pitchCur = targetPitch;
    st.pitchCur += (targetPitch - st.pitchCur) * (1 - Math.exp(-dt * 2.5));
    m.mesh.rotation.order = 'YXZ';
    m.mesh.rotation.x = 0;
    m.mesh.rotation.z = -st.pitchCur;

    const fuelValue = (s) => {
      if (!s) return 0;
      if (s.id === 'carbon') return (fuelDef.carbon || 12) * (s.n || 0);
      if (s.id === 'heavy_fuel_oil') return (fuelDef.heavy_fuel_oil || 576) * (s.n || 0);
      if (s.liquid?.id === 'gasoline') return (fuelDef.gasoline || 18) * (s.liquid.amount || 0);
      return 0;
    };
    const slots = st.slots || {};
    const hasFuel = () => { if ((st.fuelBuf || 0) > 0.01) return true; for (let i = 0; i < 5; i++) if (fuelValue(slots[`fuel${i}`]) > 0.01) return true; return false; };
    const pullFuel = () => {
      for (let i = 0; i < 5; i++) {
        const k = `fuel${i}`, s = slots[k]; if (!s) continue;
        if (s.id === 'carbon') { s.n--; if (s.n <= 0) delete slots[k]; st.fuelBuf = (st.fuelBuf || 0) + (fuelDef.carbon || 12); return true; }
        if (s.id === 'heavy_fuel_oil') { s.n--; if (s.n <= 0) delete slots[k]; st.fuelBuf = (st.fuelBuf || 0) + (fuelDef.heavy_fuel_oil || 576); return true; }
        if (s.liquid?.id === 'gasoline' && (s.liquid.amount || 0) > 0.001) {
          const take = Math.min(1, s.liquid.amount);
          s.liquid.amount -= take; if (s.liquid.amount <= 0.001) delete s.liquid;
          st.fuelBuf = (st.fuelBuf || 0) + take * (fuelDef.gasoline || 18); return true;
        }
      }
      return false;
    };
    const burn = (amt) => {
      let left = amt;
      while (left > 0.001) {
        if ((st.fuelBuf || 0) >= left) { st.fuelBuf -= left; left = 0; break; }
        left -= (st.fuelBuf || 0); st.fuelBuf = 0;
        if (!pullFuel()) break;
      }
      return amt - left;
    };

    if (!this.hasOutputRoom(m)) { st.status = 'OUTPUT FULL'; return; }
    if (!hasFuel()) { st.status = 'NO FUEL'; return; }

    const burnNeed = dt * 0.5;
    const burned = burn(burnNeed);
    if (burned <= 0.0001) { st.status = 'NO FUEL'; return; }

    const rot = m.rot || 0;
    const fx = Math.sin(rot), fz = Math.cos(rot);
    const advance = speed * dt * (burned / burnNeed);
    st.boreProg = (st.boreProg || 0) + advance;
    const boreDeg = Math.round((st.pitchCur || 0) * 180 / Math.PI);
    st.status = `BORING ${boreDeg > 0 ? '+' : ''}${boreDeg}°`;
    for (const node of (m.spinNodes || (m.spinNode ? [m.spinNode] : []))) node.rotateY(dt * (m.def.spinRate || 10));


    const pitch = st.pitchCur || 0;
    const hAdvance = advance * Math.cos(pitch);
    const dy = advance * Math.sin(pitch);
    m.x += fx * hAdvance;
    m.z += fz * hAdvance;
    m.y += dy;
    m.mesh.position.x = m.x;
    m.mesh.position.y += dy;
    m.mesh.position.z = m.z;
    m.mesh.rotation.z = -pitch;
    m.mesh.updateMatrixWorld(true);
    m.top = m.y + m.def.height * MACHINE_SCALE;
    if (m.machine) { m.machine.x = m.x; m.machine.y = m.y + (m.def.height * MACHINE_SCALE) / 2; m.machine.z = m.z; }
    this.cableDirty = true;


    for (let i = this.instances.length - 1; i >= 0; i--) {
      const other = this.instances[i];
      if (other === m) continue;
      if (Math.abs(other.x - m.x) < (m.hx + other.hx) && Math.abs(other.z - m.z) < (m.hz + other.hz) && Math.abs(other.y - m.y) < 2) {
        this.remove(other, false);
      }
    }

    st.progress = Math.min(1, st.boreProg / step);
    const world = this.ctx.world;
    if (!world || !world.field) return;
    const mask = m.boreMask?.mask || [[0, 1]];
    const field = world.field;


    m.mesh.updateMatrixWorld(true);
    const seen = new Set();
    const removed = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const localStep = step / Math.max(0.001, m.mesh.scale.x);
    const zA = (m.boreMask?.frontZ ?? -0.5) - localStep;
    const zB = m.boreMask?.backZ ?? 0.5;
    const zSteps = Math.max(2, Math.ceil((zB - zA) / 0.4));
    for (let d = 0; d <= zSteps; d++) {
      const lz = zA + (zB - zA) * (d / zSteps);
      for (let i = 0; i < mask.length; i++) {
        const lx = mask[i][0], ly = mask[i][1];
        const wp = new T.Vector3(lx, ly, lz).applyMatrix4(m.mesh.matrixWorld);
        const ix = Math.floor(wp.x), iy = Math.floor(wp.y), iz = Math.floor(wp.z);
        if (iy < 1) continue;
        const key = `${ix},${iy},${iz}`;
        if (seen.has(key)) continue;
        if (field.get(ix, iy, iz) <= 0) continue;
        seen.add(key);
        field.set(ix, iy, iz, 0);
        removed.push([ix, iy, iz]);
        if (ix < x0) x0 = ix; if (ix > x1) x1 = ix;
        if (iy < y0) y0 = iy; if (iy > y1) y1 = iy;
        if (iz < z0) z0 = iz; if (iz > z1) z1 = iz;
      }
    }

    for (const node of (m.spinNodes || (m.spinNode ? [m.spinNode] : []))) {
      const box = new T.Box3().setFromObject(node);
      for (let x = Math.floor(box.min.x); x <= Math.floor(box.max.x); x++) {
        for (let y = Math.max(1, Math.floor(box.min.y)); y <= Math.floor(box.max.y); y++) {
          for (let z = Math.floor(box.min.z); z <= Math.floor(box.max.z); z++) {
            const key = `${x},${y},${z}`;
            if (seen.has(key)) continue;
            if (field.get(x, y, z) <= 0) continue;
            seen.add(key);
            field.set(x, y, z, 0);
            removed.push([x, y, z]);
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
            if (z < z0) z0 = z; if (z > z1) z1 = z;
          }
        }
      }
    }
    if (removed.length) {
      world.markEdited(x0, x1, y0, y1, z0, z1);
      while (st.boreProg >= step) st.boreProg -= step;
      if (this.ctx.mineDrops && this.ctx.groundBand) {
        for (const [x, y, z] of removed) {
          const band = this.ctx.groundBand(x, y, z);
          // mineDrops puts the base block first; only the ore after it is collected
          for (const [id, n] of this.ctx.mineDrops(band, y, x, z).slice(1)) {
            if (n > 0) this.addOutput(m, id, n);
          }
        }
      }
    } else {
      while (st.boreProg >= step) st.boreProg -= step;
    }
    st.progress = Math.min(1, st.boreProg / step);
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




  tickScrubber(m, dt, net) {
    const st = m.state;
    const filter = m.def.filter;
    const s = st.slots.fuel;
    if (!filter || !s || s.id !== filter.item) {
      st.status = 'NO FILTER';
      st.progress = 0;
      return;
    }
    const cost = (m.def.energy?.use || 0) * dt;
    if (!this.drawPower(m, cost)) { st.status = 'NO POWER'; return; }
    st.burnT = (st.burnT || 0) + dt;
    st.progress = Math.min(1, st.burnT / Math.max(1, filter.seconds));
    st.status = `SCRUBBING ${Math.round(st.progress * 100)}%`;
    this.scrubbers.push(m);
    if (st.burnT >= filter.seconds) {
      st.burnT = 0;
      st.progress = 0;
      s.n--;
      if (s.n <= 0) st.slots.fuel = null;
      st.status = 'FILTER SPENT';
    }
  }

  ambientCut() {
    let cut = 0;
    for (const m of this.scrubbers) cut += m.def.ambientCut || 0;
    return Math.min(0.85, cut);
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
    if ((m.def.kind === 'cable' || m.def.kind === 'starter_cable') && m.mesh) {
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
    const industrialRows = [
      { off: -0.09, color: new C(0x6b3a1f) },
      { off: 0, color: new C(0xa8382e) },
      { off: 0.09, color: new C(0x2e8f4e), stripe: new C(0xd4c02a) },
    ];
    const copperRows = [
      { off: -0.04, color: new C(0x9b4a1d) },
      { off: 0.04, color: new C(0xd9762b) },
    ];
    const buckets = {
      industrial: { pts: [[], [], []], cols: [[], [], []] },
      copper: { pts: [[], []], cols: [[], []] },
    };
    for (const [a, b] of edges) {
      const isStarter = a.def.kind === 'starter_cable' || b.def.kind === 'starter_cable';
      const rows = isStarter ? copperRows : industrialRows;
      const bucket = isStarter ? buckets.copper : buckets.industrial;
      const p0 = this.cableAnchor(a), p1 = this.cableAnchor(b);
      const y0 = p0.y, y1 = p1.y;
      const sag = 0.12 + p0.distanceTo(p1) * 0.06;
      const N = 8;
      for (let r2 = 0; r2 < rows.length; r2++) {
        const off = rows[r2].off;
        const { color, stripe } = rows[r2];
        for (let i = 0; i < N; i++) {
          const t0 = i / N, t1 = (i + 1) / N;
          const py = (t) => (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (Math.min(y0, y1) - sag) + t * t * y1;
          bucket.pts[r2].push(
            p0.x + (p1.x - p0.x) * t0, py(t0) + off, p0.z + (p1.z - p0.z) * t0,
            p0.x + (p1.x - p0.x) * t1, py(t1) + off, p0.z + (p1.z - p0.z) * t1
          );
          if (stripe) {
            const c = i % 2 ? color : stripe;
            bucket.cols[r2].push(c.r, c.g, c.b, c.r, c.g, c.b);
          }
        }
      }
    }
    this.cableLines = [];
    const emitSets = [
      { rows: industrialRows, bucket: buckets.industrial },
      { rows: copperRows, bucket: buckets.copper },
    ];
    for (const { rows, bucket } of emitSets) {
      for (let r2 = 0; r2 < rows.length; r2++) {
        const pts = bucket.pts[r2];
        if (!pts.length) continue;
        const geo = new this.T.BufferGeometry();
        geo.setAttribute('position', new this.T.Float32BufferAttribute(pts, 3));
        const mat = new this.T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        if (rows[r2].stripe) {
          geo.setAttribute('color', new this.T.Float32BufferAttribute(bucket.cols[r2], 3));
          mat.vertexColors = true;
        } else {
          mat.color.copy(rows[r2].color);
        }
        const lines = new this.T.LineSegments(geo, mat);
        this.cableGroup.add(lines);
        this.cableLines.push(lines);
      }
    }
  }


  statusText() {
    const m = this.openInst; if (!m) return '';
    if (m.def.kind === 'bwe') {
      const b = m.bwe || {};
      return `${m.state.status || 'IDLE'} · YAW ${Math.round((b.yawCur || 0) * 180 / Math.PI)}° · BOOM ${Math.round((b.boomCur || 0) * 180 / Math.PI)}°`;
    }
    if (m.def.kind === 'armor') {
      const a = m.state.slots.armor;
      if (!a) return 'INSERT ARMOR';
      const plates = (a.plates || []).length;
      return `PLATES ${plates}/${this.ITEMS[a.id]?.armor?.plateSlots || 0} · DROP PLATES TO INSTALL`;
    }
    if (m.def.kind === 'crafting') {
      if (m.state.job) {
        const outs = Object.entries(this.recipeOut(m.state.job.recipe))
          .map(([id, n]) => `${n}x ${this.ITEMS[id]?.name || id}`)
          .join(' + ');
        const queued = m.state.queue?.length ? ` · ${m.state.queue.length} QUEUED` : '';
        return `${m.state.status}${outs ? ` | ${outs}` : ''}${queued}`;
      }
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



  radProtect() {
    const s = this.totalArmorRadShield();
    return Math.min(0.8, s / (s + 60));
  }



  absorbFactor(x, z) {
    let f = 1;
    for (const a of this.absorbers) {
      const rad = a.def.absorbRadius || 12;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < rad) f *= 1 - (a.def.absorbRate || 0.35) * (1 - d / rad);
    }
    return Math.max(TUNING.ABSORB_FLOOR, f);
  }


  serialize() {
    return this.instances.map((m) => ({
      id: m.def.id, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2), r: +(m.rot || 0).toFixed(3),
      s: {
        slots: m.state.slots, progress: +m.state.progress.toFixed(3), heat: +m.state.heat.toFixed(2),
        genRate: m.state.genRate || 0, burning: m.state.burning, burnT: +m.state.burnT.toFixed(2), buffer: Math.round(m.state.buffer || 0),
        job: m.state.job ? { i: (m.def.kind === 'crafting' ? (this.ctx.craftRecipes || []) : (m.def.recipes || [])).indexOf(m.state.job.recipe), t: +(m.state.job.t || 0).toFixed(2) } : null,
        queue: (m.state.queue || [])
          .map((q) => ({ i: (m.def.kind === 'crafting' ? (this.ctx.craftRecipes || []) : (m.def.recipes || [])).indexOf(q.recipe), t: +(q.t || 0).toFixed(2) }))
          .filter((q) => q.i >= 0),
        bwe: m.bwe ? { yaw: +(m.bwe.yawCur ?? m.bwe.yaw).toFixed(3), boom: +(m.bwe.boomCur ?? m.bwe.boom).toFixed(3), wheel: !!m.bwe.wheelOn } : null,
        bore: m.def.bore ? { fb: +(m.state.fuelBuf || 0).toFixed(3), bp: +(m.state.boreProg || 0).toFixed(3), pitch: +(m.state.pitch || 0).toFixed(3) } : null,
        usage: m.def.capacity ? m.state.usage || {} : null,
      },
    }));
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!e || !this.templates.has(e.id)) continue;
      const inst = this.place(e.id, e.x, e.z, { y: e.y, rot: e.r || 0, restore: true });
      if (!inst || !e.s) continue;
      inst.state.slots = e.s.slots || {};
      inst.state.progress = e.s.progress || 0;
      inst.state.heat = e.s.heat || 0;
      inst.state.burning = !!e.s.burning;
      inst.state.burnT = e.s.burnT || 0;
      inst.state.buffer = e.s.buffer || 0;
       inst.state.genRate = e.s.genRate || 0;
      if (inst.def.capacity && e.s.usage) inst.state.usage = e.s.usage;
      if (inst.bwe && e.s.bwe) {
        const yaw = +e.s.bwe.yaw || 0;
        const boom = +e.s.bwe.boom || 0;
        inst.bwe.yaw = yaw;
        inst.bwe.boom = boom;
        inst.bwe.yawCur = yaw;
        inst.bwe.boomCur = boom;
        inst.bwe.wheelOn = !!e.s.bwe.wheel;
      }
      if (inst.def.bore && e.s.bore) {
        inst.state.fuelBuf = +e.s.bore.fb || 0;
        inst.state.boreProg = +e.s.bore.bp || 0;
        inst.state.pitch = +e.s.bore.pitch || 0;
        inst.state.pitchCur = inst.state.pitch;
        inst.mesh.rotation.order = 'YXZ';
        inst.mesh.rotation.z = -inst.state.pitch;
      }

      if (inst.def.kind === 'processor' || inst.def.kind === 'crafting') {
        const recipes = inst.def.kind === 'crafting' ? (this.ctx.craftRecipes || []) : (inst.def.recipes || []);
        const job = e.s.job;
        if (job && recipes[job.i]) {
          inst.state.job = { recipe: recipes[job.i], t: job.t || 0 };
          const dur = Math.max(0.001, inst.state.job.recipe.time || 1);
          inst.state.progress = Math.min(1, inst.state.job.t / dur);
        }
        inst.state.queue = (e.s.queue || [])
          .map((q) => recipes[q.i])
          .filter(Boolean)
          .map((recipe) => ({ recipe, t: 0 }));
      }

      if (inst.def.kind === 'processor') {
        for (const key of Object.keys(inst.state.slots)) {
          if (key.startsWith('output')) continue;


          if (key.startsWith('input')) continue;
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

    if (inst.def.manual) { this.crank(inst); return; }

    if (inst.def.kind === 'pump') { this.pump(inst); return; }
    if (inst.def.sleep) { this.ctx.startSleep?.(inst); return; }
    if (inst.def.drive && !inst._drive) { this.ctx.startDrive?.(inst); return; }
    this.openInst = inst;
    this.ctx.onOpen?.();
    this.ui.open(inst, () => {
      this.openInst = null;
      this.ctx.onClosed?.();
    });
  }

  pump(inst) {
    if (!inst || inst.def.kind !== 'pump') return;
    const amount = inst.def.pump?.amount ?? 5;
    const cost = inst.def.pump?.cost ?? 30;
    const stack = this.inv.hot[this.inv.sel];
    const def = stack && this.ITEMS[stack.id];
    if (!def?.container) { this.ctx.notice?.('HOLD A JERRY CAN'); inst.state.status = 'HOLD A JERRY CAN'; return; }
    if (!accepts(def, 'water')) { this.ctx.notice?.('CANNOT HOLD WATER'); return; }
    const room = def.container.capacity - (stack.liquid?.amount || 0);
    if (room <= 0) { this.ctx.notice?.('CONTAINER FULL'); return; }
    if (!this.drawPower(inst, cost)) { this.ctx.notice?.('NO POWER'); inst.state.status = 'NO POWER'; return; }
    const added = fill(stack, def, 'water', amount);
    inst.state.status = 'PUMPING';
    this.ctx.notice?.(`PUMPED ${Math.round(added)} WATER`);
    this.ctx.syncBars?.();
  }

  crank(inst) {
    if (!inst || !inst.def.manual) return;
    const spinBoost = Math.min(2.5, (inst.state.spinBoost || 0) + 0.35);
    inst.state.spinBoost = spinBoost;
    inst.state.spin = 2;
    inst.state.status = 'CRANKING';
    this.ctx.syncBars?.();
    const powerBoost = Math.round((inst.def.energy?.gen || 45) * (1 + spinBoost * 0.3));
    this.ctx.notice?.(`HAND CRANK +${powerBoost} PU/s`);
  }
}

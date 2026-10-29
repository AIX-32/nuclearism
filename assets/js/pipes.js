








const DIRS = [
  { bit: 1, dx: 1, dz: 0, angle: 0 },
  { bit: 2, dx: 0, dz: 1, angle: -Math.PI / 2 },
  { bit: 4, dx: -1, dz: 0, angle: Math.PI },
  { bit: 8, dx: 0, dz: -1, angle: Math.PI / 2 },
];


const CORNER_ROT = { '2,3': 0, '1,2': Math.PI / 2, '0,1': Math.PI, '0,3': Math.PI * 1.5 };

const TEE_ROT = { 0: Math.PI, 1: Math.PI / 2, 2: 0, 3: Math.PI * 1.5 };

export class PipeSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.THREE;
    this.cells = new Map();
    this.tpl = {};
    this.group = new this.T.Group();
    ctx.scene.add(this.group);
  }

  async load() {
    const loader = new this.ctx.GLTFLoader();
    const base = 'assets/models/pipes/';
    const [long, short, corner, tee] = await Promise.all([
      loader.loadAsync(base + 'long.glb'),
      loader.loadAsync(base + 'short.glb'),
      loader.loadAsync(base + 'corner.glb'),
      loader.loadAsync(base + 'tee.glb'),
    ]);




    long.scene.position.set(-0.994, -0.0145, 0.712);
    this.tpl.arm = new this.T.Group();
    this.tpl.arm.add(long.scene);
    this.tpl.arm.scale.set(0.5 / 0.994, 1, 1);


    short.scene.position.set(-0.247, 0.002, -0.0145);
    this.tpl.short = new this.T.Group();
    this.tpl.short.add(short.scene);



    corner.scene.position.set(-0.316, -0.0145, 2.084);
    const cornerX = new this.T.Group();
    cornerX.rotation.x = Math.PI / 2;
    cornerX.add(corner.scene);
    this.tpl.corner = new this.T.Group();
    this.tpl.corner.add(cornerX);


    tee.scene.position.set(-0.135, -0.0145, 1.36);
    this.tpl.tee = new this.T.Group();
    this.tpl.tee.add(tee.scene);
    return this;
  }

  key(x, y, z) { return `${x},${y},${z}`; }

  at(x, y, z) { return this.cells.get(this.key(x, y, z)) || null; }

  place(x, y, z) {
    if (this.at(x, y, z)) return false;
    const cell = { x, y, z, mesh: null };
    this.cells.set(this.key(x, y, z), cell);
    this.refresh(cell);
    for (const d of DIRS) {
      const n = this.at(x + d.dx, y, z + d.dz);
      if (n) this.refresh(n);
    }
    return true;
  }

  removeAt(x, y, z, refund = true) {
    const cell = this.at(x, y, z);
    if (!cell) return false;
    this.cells.delete(this.key(x, y, z));
    if (cell.mesh) {
      this.group.remove(cell.mesh);
      cell.mesh = null;
    }
    if (refund) this.ctx.give('pipe', 1);
    for (const d of DIRS) {
      const n = this.at(x + d.dx, y, z + d.dz);
      if (n) this.refresh(n);
    }
    return true;
  }

  maskOf(cell) {
    let mask = 0;
    for (const d of DIRS) if (this.at(cell.x + d.dx, cell.y, cell.z + d.dz)) mask |= d.bit;
    return mask;
  }

  refresh(cell) {
    if (cell.mesh) { this.group.remove(cell.mesh); cell.mesh = null; }
    const mask = this.maskOf(cell);
    const g = new this.T.Group();
    g.position.set(cell.x + 0.5, cell.y + 0.15, cell.z + 0.5);
    g.userData.cellKey = this.key(cell.x, cell.y, cell.z);

    if (!mask) {
      g.add(this.tpl.short.clone(true));
    } else {
      const connected = DIRS.filter((d) => mask & d.bit);
      for (const d of connected) {
        const arm = this.tpl.arm.clone(true);
        arm.rotation.y = d.angle + Math.PI;
        g.add(arm);
      }
      const fit = this.fitting(connected, mask);
      if (fit) g.add(fit);
    }
    this.group.add(g);
    cell.mesh = g;
  }

  fitting(connected, mask) {
    if (connected.length === 2) {
      const a = DIRS.indexOf(connected[0]), b = DIRS.indexOf(connected[1]);
      if ((a === 0 && b === 2) || (a === 2 && b === 0) ||
          (a === 1 && b === 3) || (a === 3 && b === 1)) return null;
      const pair = [a, b].sort().join(',');
      const f = this.tpl.corner.clone(true);
      f.rotation.y = CORNER_ROT[pair] ?? 0;
      return f;
    }
    if (connected.length === 3) {
      const missing = DIRS.findIndex((d) => !(mask & d.bit));
      const f = this.tpl.tee.clone(true);
      f.rotation.y = TEE_ROT[missing] ?? 0;
      return f;
    }
    if (connected.length === 4) {
      const f = this.tpl.tee.clone(true);
      f.rotation.y = 0;
      return f;
    }
    return null;
  }


  pick(origin, dir, maxDist = 6) {
    if (!this.group.children.length) return null;
    const ray = new this.T.Raycaster(origin, dir, 0, maxDist);
    const hits = ray.intersectObjects(this.group.children, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.cellKey) o = o.parent;
    if (!o) return null;
    const cell = this.cells.get(o.userData.cellKey);
    return cell ? { cell, distance: hits[0].distance } : null;
  }

  serialize() {
    return [...this.cells.values()].map((c) => [c.x, c.y, c.z]);
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 3) continue;
      const [x, y, z] = e.map((v) => Math.round(v));
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) this.place(x, y, z);
    }
  }
}

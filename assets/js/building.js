// Base building: placeable pieces that shield radiation directionally.
//
// A piece is a shape from `assets/js/pieces/` (see pieces/README.md for the
// contract). Every piece owns a block of 1 m grid cells and every cell carries
// a slice of the piece's box, so the radiation shadow march can attenuate per
// slice instead of missing a 25 cm panel between two sample points.

import { BUILD_TIERS, BUILD_TIER_ORDER } from './build-tiers.js';
import { KINDS } from './pieces/registry.js';

const KEY = (x, y, z) => `${x},${y},${z}`;

// Length of the ray segment that lies inside an axis-aligned box.
function boxLen(ox, oy, oz, dx, dy, dz, box, maxD) {
  let t0 = 0, t1 = maxD;
  const axes = [[ox, dx, box.minX, box.maxX], [oy, dy, box.minY, box.maxY], [oz, dz, box.minZ, box.maxZ]];
  for (const [o, d, min, max] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < min || o > max) return 0;
      continue;
    }
    let a = (min - o) / d, b = (max - o) / d;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t1 <= t0) return 0;
  }
  return t1 - t0;
}

// Directional shadow over a cell map: 1 = clear line, ~0 = fully shielded.
export function shadowCells(cells, px, py, pz, dx, dy, dz, maxDist = 24) {
  let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const invX = stepX ? 1 / Math.abs(dx) : Infinity;
  const invY = stepY ? 1 / Math.abs(dy) : Infinity;
  const invZ = stepZ ? 1 / Math.abs(dz) : Infinity;
  let tMaxX = stepX ? ((stepX > 0 ? (x + 1 - px) : (px - x)) * invX) : Infinity;
  let tMaxY = stepY ? ((stepY > 0 ? (y + 1 - py) : (py - y)) * invY) : Infinity;
  let tMaxZ = stepZ ? ((stepZ > 0 ? (z + 1 - pz) : (pz - z)) * invZ) : Infinity;

  let t = 1;
  for (let i = 0; i < 256; i++) {
    if (tMaxX > maxDist && tMaxY > maxDist && tMaxZ > maxDist) break;
    const cell = cells.get(KEY(x, y, z));
    if (cell) {
      const len = boxLen(px, py, pz, dx, dy, dz, cell.box, maxDist);
      if (len > 0) {
        // A swung open door is out of the way: it shields nothing.
        if (!cell.piece?.open) {
          t *= Math.pow(BUILD_TIERS[cell.tier].transmission, len);
          if (t <= 0) return 0;
        }
      }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; tMaxX += invX; }
    else if (tMaxY < tMaxZ) { y += stepY; tMaxY += invY; }
    else { z += stepZ; tMaxZ += invZ; }
  }
  return t;
}

export class BuildingSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.T = ctx.THREE;
    this.world = ctx.world || null;
    this.pieces = new Map();   // id -> piece
    this.cells = new Map();     // cell key -> { piece, tier, box }
    this.group = new this.T.Group();
    ctx.scene.add(this.group);
    this.meshes = new Map();    // "tier|geom" -> InstancedMesh
    this.meshPieces = new Map();// "tier|geom" -> [piece]
    this.nextId = 1;
  }

  kind(name) { return KINDS[name] || null; }

  // Textures are optional: a missing file just leaves the flat tier colour.
  load() {
    for (const [tier, def] of Object.entries(BUILD_TIERS)) {
      const mat = new this.T.MeshLambertMaterial({ color: def.color });
      this._materials = this._materials || new Map();
      this._materials.set(tier, mat);
      try {
        new this.T.TextureLoader().load(def.texture, (tex) => {
          tex.wrapS = tex.wrapT = this.T.RepeatWrapping;
          tex.magFilter = this.T.NearestFilter;
          tex.minFilter = this.T.LinearMipmapLinearFilter;
          mat.map = tex;
          mat.needsUpdate = true;
        }, undefined, () => { /* no texture: keep the flat colour */ });
      } catch (e) { /* no loader: keep the flat colour */ }
    }
    return this;
  }

  material(tier) {
    this._materials = this._materials || new Map();
    if (!this._materials.has(tier)) {
      this._materials.set(tier, new this.T.MeshLambertMaterial({ color: BUILD_TIERS[tier].color }));
    }
    return this._materials.get(tier);
  }

  // The unit box every piece is scaled from.
  boxGeometry() {
    if (this._geo) return this._geo;
    const g = new this.T.BoxGeometry(1, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
    uv.needsUpdate = true;
    this._geo = g;
    return g;
  }

  geometryFor(kind) {
    if (!kind.geom || kind.geom === 'box') return this.boxGeometry();
    this._geoms = this._geoms || new Map();
    if (!this._geoms.has(kind.geom)) {
      this._geoms.set(kind.geom, kind.geometry ? kind.geometry(this.T) : this.boxGeometry());
    }
    return this._geoms.get(kind.geom);
  }

  // --- world helpers the piece kinds use -------------------------------
  surfaceHeight(x, z) {
    if (!this.world) return 0;
    // getSurfaceHeight rounds to the column centre, so feed it integers.
    return Math.floor(this.world.getSurfaceHeight(x, z, 90));
  }
  groundAt(x, y, z) {
    if (!this.world) return false;
    return this.world.field.get(x, y, z) > 0;
  }
  occupied(x, y, z) {
    return this.cells.has(KEY(x, y, z));
  }
  // The top cell (exclusive) of the tallest piece standing in this column.
  topAt(x, z) {
    let top = null;
    for (const p of this.pieces.values()) {
      let hit = false;
      for (const [key] of p.cells) {
        const [cx, , cz] = key.split(',').map(Number);
        if (cx === x && cz === z) { hit = true; break; }
      }
      if (!hit) continue;
      const t = this.pieceTop(p);
      if (top === null || t > top) top = t;
    }
    return top;
  }
  // The exclusive top cell of a piece (a floor at cell y tops out at y + 1).
  pieceTop(piece) {
    let top = piece.y;
    for (const [key] of piece.cells) {
      const cy = Number(key.split(',')[1]);
      if (cy + 1 > top) top = cy + 1;
    }
    return top;
  }

  // --- placement --------------------------------------------------------
  canPlace(kindName, x, y, z, rot) {
    const kind = this.kind(kindName);
    if (!kind) return false;
    for (const [key] of kind.cells(x, y, z, rot)) {
      if (this.cells.has(key)) return false;
    }
    return true;
  }

  place(kindName, tier, x, y, z, rot = 0) {
    const kind = this.kind(kindName);
    if (!kind || !BUILD_TIERS[tier]) return null;
    if (!this.canPlace(kindName, x, y, z, rot)) return null;
    if (kind.support && !kind.support(this, x, y, z, rot)) return null;
    const piece = {
      id: this.nextId++, kind: kindName, tier, rot, x, y, z,
      hp: BUILD_TIERS[tier].hp,
      open: false,
      geom: kind.geom || 'box',
    };
    piece.cells = kind.cells(x, y, z, rot);
    this.pieces.set(piece.id, piece);
    for (const [key, box] of piece.cells) this.cells.set(key, { piece, tier, box });
    this.rebuild();
    return piece;
  }

  remove(piece) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    for (const [key] of piece.cells) this.cells.delete(key);
    this.pieces.delete(piece.id);
    this.rebuild();
    return true;
  }

  upgrade(piece, tier) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    if (!BUILD_TIERS[tier]) return false;
    piece.tier = tier;
    piece.hp = BUILD_TIERS[tier].hp;
    for (const [key, box] of piece.cells) this.cells.set(key, { piece, tier, box });
    this.rebuild();
    return true;
  }

  damage(piece, amount) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    piece.hp -= amount;
    if (piece.hp <= 0) { this.remove(piece); return true; }
    return false;
  }

  // Open or close a swinging piece (doors).
  toggle(piece) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    const kind = this.kind(piece.kind);
    if (!kind?.dynamicSolid) return false;
    piece.open = !piece.open;
    this.rebuild();
    return true;
  }

  // True when the point is inside a solid piece.
  // A piece's box reaches the far edge of its cell, so a point sitting exactly
  // on that edge belongs to the next cell: the neighbours are checked too, or
  // a player standing on a deck would fall through it.
  solidAt(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          const cell = this.cells.get(KEY(fx - i, fy - j, fz - k));
          if (!cell) continue;
          const kind = this.kind(cell.piece.kind);
          if (kind?.dynamicSolid && cell.piece.open) continue;
          const b = cell.box;
          if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) return true;
        }
      }
    }
    return false;
  }

  // Directional shadow: 1 = clear line, ~0 = fully behind shielding.
  shadow(px, py, pz, dx, dy, dz, maxDist = 24) {
    return shadowCells(this.cells, px, py, pz, dx, dy, dz, maxDist);
  }

  pick(origin, dir, maxDist = 7) {
    if (!this.group.children.length) return null;
    const ray = new this.T.Raycaster(origin, dir, 0, maxDist);
    const hits = ray.intersectObjects(this.group.children, false);
    if (!hits.length) return null;
    const hit = hits[0];
    const list = this.meshPieces.get(hit.object.userData.key);
    const piece = list && hit.instanceId != null ? list[hit.instanceId] : null;
    return piece ? { piece, distance: hit.distance } : null;
  }

  rebuild() {
    const groups = new Map();
    for (const p of this.pieces.values()) {
      const key = `${p.tier}|${p.geom}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    for (const [key, list] of groups) {
      const [tier, geom] = key.split('|');
      let mesh = this.meshes.get(key);
      const kind = this.kind(list[0].kind);
      if (!mesh) {
        mesh = new this.T.InstancedMesh(this.geometryFor(kind), this.material(tier), Math.max(16, list.length * 2));
        mesh.userData.key = key;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        this.meshes.set(key, mesh);
      }
      if (mesh.instanceMatrix.count < list.length) {
        const bigger = new this.T.InstancedMesh(this.geometryFor(kind), this.material(tier), list.length * 2);
        bigger.userData.key = key;
        bigger.frustumCulled = false;
        this.group.remove(mesh);
        this.group.add(bigger);
        mesh = bigger;
        this.meshes.set(key, mesh);
      }
      mesh.count = list.length;
      this.meshPieces.set(key, list);
      const m = new this.T.Matrix4();
      const pos = new this.T.Vector3();
      const scl = new this.T.Vector3();
      const q = new this.T.Quaternion();
      const e = new this.T.Euler();
      list.forEach((p, i) => {
        const c = kind.center(p.x, p.y, p.z, p.rot);
        const s = kind.scale(p.x, p.y, p.z, p.rot);
        pos.set(c.x, c.y, c.z);
        scl.set(s.x, s.y, s.z);
        e.set(0, kind.rotY ? kind.rotY(p.rot) : 0, 0);
        q.setFromEuler(e);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    for (const [key, mesh] of this.meshes) {
      if (!groups.has(key)) { mesh.count = 0; this.meshPieces.set(key, []); }
    }
  }

  serialize() {
    const kinds = Object.keys(KINDS);
    const out = [];
    for (const p of this.pieces.values()) {
      out.push([
        kinds.indexOf(p.kind), BUILD_TIER_ORDER.indexOf(p.tier),
        p.x, p.y, p.z, p.rot, Math.round(p.hp), p.open ? 1 : 0,
      ]);
    }
    return out;
  }

  restore(list) {
    if (!Array.isArray(list)) return;
    const kinds = Object.keys(KINDS);
    for (const e of list) {
      if (!Array.isArray(e) || e.length < 3) continue;
      const [ki, ti, x, y, z, rot, hp, open] = e.map((v) => (typeof v === 'number' ? Math.round(v) : v));
      const kind = kinds[ki];
      const tier = BUILD_TIER_ORDER[ti];
      if (!kind || !tier) continue;
      const piece = this.place(kind, tier, x, y, z, rot || 0);
      if (piece) {
        if (hp) piece.hp = hp;
        if (open) piece.open = true;
      }
    }
  }
}

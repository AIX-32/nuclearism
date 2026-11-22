






import { BUILD_TIERS, BUILD_TIER_ORDER } from './build-tiers.js';
import { KINDS } from './pieces/registry.js';

const KEY = (x, y, z) => `${x},${y},${z}`;



export function meshKey(piece) { return `${piece.tier}|${piece.kind}`; }


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













export function snapPlan(fps, af, p, dir, wantRot = 0, face = null) {
  if (!fps || !fps.length) return [];


  const fp = fps.find((f) => f.rot === ((wantRot % fps.length + fps.length) % fps.length)) || fps[0];
  const ax = Math.abs(dir.x), ay = Math.abs(dir.y), az = Math.abs(dir.z);
  const fromAbove = face ? face.y > 0.45 : ay > ax && ay > az;
  let axis, side;
  if (fromAbove) {
    const ox = p.x - (af.x0 + af.x1) / 2;
    const oz = p.z - (af.z0 + af.z1) / 2;
    axis = Math.abs(ox) > Math.abs(oz) ? 'x' : 'z';
    side = (axis === 'x' ? ox : oz) < 0 ? -1 : 1;
  } else {


    axis = face ? (Math.abs(face.x) > Math.abs(face.z) ? 'x' : 'z') : (ax > az ? 'x' : 'z');
    side = face ? Math.sign(face[axis]) : (dir[axis] > 0 ? -1 : 1);
  }
  const overTop = fp.layers <= 1 && af.y1 - af.y0 > 1.2 && p.y >= af.y1 - 0.4;
  if (overTop) {

    const thinX = (af.x1 - af.x0) < (af.z1 - af.z0);
    axis = thinX ? 'x' : 'z';
    const overOther = axis === 'x' ? 'z' : 'x';
    const cellsA = (axis === 'x' ? fp.cx1 - fp.cx0 : fp.cz1 - fp.cz0) + 1;
    const aMin = axis === 'x' ? af.cx0 : af.cz0;
    const aMax = axis === 'x' ? af.cx1 : af.cz1;
    let ext = dir[axis] !== 0 ? -Math.sign(dir[axis]) : 0;
    if (!ext) ext = p[axis] < (af[axis + '0'] + af[axis + '1']) / 2 ? -1 : 1;
    const idealA = ext < 0 ? aMax - cellsA + 1 : aMin;
    const idealB = overOther === 'x' ? af.cx0 : af.cz0;
    const x = axis === 'x' ? Math.round(idealA) : Math.round(idealB);
    const z = axis === 'x' ? Math.round(idealB) : Math.round(idealA);
    return [{ x, z, rot: fp.rot }];
  }

  const other = axis === 'x' ? 'z' : 'x';
  const sizeA = axis === 'x' ? fp.sx : fp.sz;
  const offA = axis === 'x' ? fp.ox : fp.oz;
  const offB = other === 'x' ? fp.ox : fp.oz;
  const cellsA = (axis === 'x' ? fp.cx1 - fp.cx0 : fp.cz1 - fp.cz0) + 1;
  const aMin = axis === 'x' ? af.cx0 : af.cz0;
  const aMax = axis === 'x' ? af.cx1 : af.cz1;
  let idealA, idealB;
  if (fromAbove) {
    idealA = side < 0 ? af[axis + '0'] - offA : af[axis + '1'] - offA - sizeA;
  } else {
    const facePos = side < 0 ? af[axis + '0'] : af[axis + '1'];
    idealA = facePos - offA - (side < 0 ? sizeA : 0);
  }
  idealB = af[other + '0'] - offB;
  const x = axis === 'x' ? Math.round(idealA) : Math.round(idealB);
  const z = axis === 'x' ? Math.round(idealB) : Math.round(idealA);
  return [{ x, z, rot: fp.rot }];
}


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
    const entry = cells.get(KEY(x, y, z));
    if (entry) {
      const list = Array.isArray(entry) ? entry : [entry];
      for (const cell of list) {
        const len = boxLen(px, py, pz, dx, dy, dz, cell.box, maxDist);
        if (len <= 0) continue;
        if (cell.piece?.open) continue;
        t *= Math.pow(BUILD_TIERS[cell.tier].transmission, len);
        if (t <= 0) return 0;
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
    this.patchMaterial = ctx.patchMaterial || null;
    this.pieces = new Map();
    this.cells = new Map();
    this.group = new this.T.Group();
    ctx.scene.add(this.group);
    this.meshes = new Map();
    this.meshPieces = new Map();
    this.nextId = 1;
  }

  kind(name) { return KINDS[name] || null; }


  load() {
    for (const [tier, def] of Object.entries(BUILD_TIERS)) {
      const mat = new this.T.MeshLambertMaterial({ color: def.color });
      if (this.patchMaterial) this.patchMaterial(mat);
      this._materials = this._materials || new Map();
      this._materials.set(tier, mat);
      try {
        new this.T.TextureLoader().load(def.texture, (tex) => {
          tex.wrapS = tex.wrapT = this.T.RepeatWrapping;
          tex.magFilter = this.T.NearestFilter;
          tex.minFilter = this.T.LinearMipmapLinearFilter;
          if (this.T.SRGBColorSpace) tex.colorSpace = this.T.SRGBColorSpace;
          mat.map = tex;



          mat.color.setHex(0xffffff);
          mat.needsUpdate = true;
        }, undefined, () => {                                        });
      } catch (e) {                                       }
    }
    return this;
  }

  material(tier) {
    this._materials = this._materials || new Map();
    if (!this._materials.has(tier)) {
      const mat = new this.T.MeshLambertMaterial({ color: BUILD_TIERS[tier].color });
      if (this.patchMaterial) this.patchMaterial(mat);
      this._materials.set(tier, mat);
    } else if (this.patchMaterial) {
      this.patchMaterial(this._materials.get(tier));
    }
    return this._materials.get(tier);
  }


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


  surfaceHeight(x, z, fromY = 90) {
    if (!this.world) return 0;

    return Math.floor(this.world.getSurfaceHeight(x, z, fromY));
  }
  groundAt(x, y, z) {
    if (!this.world) return false;
    return this.world.field.get(x, y, z) > 0;
  }
  occupied(x, y, z) {
    const e = this.cells.get(KEY(x, y, z));
    return Array.isArray(e) ? e.length > 0 : !!e;
  }

  _cellEntries(key) {
    const e = this.cells.get(key);
    if (!e) return [];
    return Array.isArray(e) ? e : [e];
  }

  _boxesOverlap(a, b) {
    const eps = 1e-4;
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    if (ox <= eps || oy <= eps || oz <= eps) return false;

    const thin = (v) => v <= 0.3 + eps;
    const aThinX = thin(a.maxX - a.minX), aThinZ = thin(a.maxZ - a.minZ);
    const bThinX = thin(b.maxX - b.minX), bThinZ = thin(b.maxZ - b.minZ);
    if ((aThinX && bThinZ || aThinZ && bThinX) && ox <= 0.3 + eps && oz <= 0.3 + eps) return false;
    return true;
  }

  _cellOverlaps(key, box) {
    for (const c of this._cellEntries(key)) if (this._boxesOverlap(c.box, box)) return true;
    return false;
  }

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

  pieceTop(piece) {
    let top = piece.y;
    for (const [key] of piece.cells) {
      const cy = Number(key.split(',')[1]);
      if (cy + 1 > top) top = cy + 1;
    }
    return top;
  }




  groundBase(kindName, x, z, rot, fromY = 90) {
    const kind = this.kind(kindName);
    if (!kind) return 0;
    let top = -Infinity;
    for (const [key] of kind.cells(x, 0, z, rot)) {
      const [cx, , cz] = key.split(',').map(Number);
      top = Math.max(top, this.surfaceHeight(cx + 0.5, cz + 0.5, fromY));
    }
    return top === -Infinity ? 0 : top;
  }

  terrainOverlap(box, sweep = 0) {
    const f = this.world?.field;
    if (!f) return false;
    const e = 0.001;
    const minY = box.minY + Math.max(0, sweep);


    if (!f.sample) {
      for (let x = Math.floor(box.minX + e); x < box.maxX - e; x++) {
        for (let y = Math.ceil(minY + e); y < box.maxY - e; y++) {
          for (let z = Math.floor(box.minZ + e); z < box.maxZ - e; z++) {
            if (f.get(x, y, z) > 0) return true;
          }
        }
      }
      return false;
    }
    const inset = 0.025;
    if (box.maxX - box.minX <= inset * 2 || box.maxY - box.minY <= inset * 2 || box.maxZ - minY <= inset * 2) return false;
    const xs = [box.minX + inset, (box.minX + box.maxX) / 2, box.maxX - inset];
    const midY = Math.min(box.maxY - inset, Math.max(minY + inset, (minY + box.maxY) / 2));
    const ys = [minY + inset, midY, box.maxY - inset].filter((v, i, a) => a.indexOf(v) === i && v < box.maxY);
    const zs = [box.minZ + inset, (box.minZ + box.maxZ) / 2, box.maxZ - inset];
    for (const x of xs) for (const y of ys) for (const z of zs) {
      if (f.sample(x, y, z) > 0) return true;
    }
    return false;
  }


  _allowedClip(kindName, otherKind) {
    const slab = kindName === 'floor' || kindName === 'roof' || kindName === 'triangle';
    const wall = otherKind === 'wall' || otherKind === 'door';
    const otherSlab = otherKind === 'floor' || otherKind === 'roof' || otherKind === 'triangle';
    const isWall = kindName === 'wall' || kindName === 'door';
    return (slab && wall) || (isWall && otherSlab);
  }

  canPlace(kindName, x, y, z, rot, sweep = 0) {
    const kind = this.kind(kindName);
    if (!kind || !Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return false;
    for (const [key, box] of kind.cells(x, y, z, rot)) {
      if (this.terrainOverlap(box, sweep)) return false;
      for (const c of this._cellEntries(key)) {
        if (this._boxesOverlap(c.box, box) && !this._allowedClip(kindName, c.piece.kind)) return false;
      }
    }
    return true;
  }

  place(kindName, tier, x, y, z, rot = 0, restoring = false, sweep = 0) {
    const kind = this.kind(kindName);
    if (!kind || !BUILD_TIERS[tier]) return null;
    if (restoring) {
      for (const [key, box] of kind.cells(x, y, z, rot)) {
        for (const c of this._cellEntries(key)) {
          if (this._boxesOverlap(c.box, box) && !this._allowedClip(kindName, c.piece.kind)) return null;
        }
      }
    } else {
      if (!this.canPlace(kindName, x, y, z, rot, sweep)) return null;
      if (kind.support && !kind.support(this, x, y, z, rot)) return null;
    }
    const piece = {
      id: this.nextId++, kind: kindName, tier, rot, x, y, z,
      hp: BUILD_TIERS[tier].hp,
      open: false,
      geom: kind.geom || 'box',
    };
    piece.cells = kind.cells(x, y, z, rot);
    this.pieces.set(piece.id, piece);
    for (const [key, box] of piece.cells) {
      const list = this.cells.get(key);
      const entry = { piece, tier, box };
      if (Array.isArray(list)) list.push(entry);
      else if (list) this.cells.set(key, [list, entry]);
      else this.cells.set(key, [entry]);
    }
    this.rebuild();
    return piece;
  }

  remove(piece) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    for (const [key] of piece.cells) {
      const list = this._cellEntries(key).filter((c) => c.piece !== piece);
      if (list.length) this.cells.set(key, list);
      else this.cells.delete(key);
    }
    this.pieces.delete(piece.id);
    this.rebuild();
    return true;
  }

  upgrade(piece, tier) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    if (!BUILD_TIERS[tier]) return false;
    piece.tier = tier;
    piece.hp = BUILD_TIERS[tier].hp;
    for (const [key, box] of piece.cells) {
      const list = this._cellEntries(key).map((c) => c.piece === piece ? { piece, tier, box } : c);
      if (list.length) this.cells.set(key, list);
    }
    this.rebuild();
    return true;
  }

  damage(piece, amount) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    piece.hp -= amount;
    if (piece.hp <= 0) { this.remove(piece); return true; }
    return false;
  }


  toggle(piece) {
    if (!piece || !this.pieces.has(piece.id)) return false;
    const kind = this.kind(piece.kind);
    if (!kind?.dynamicSolid) return false;
    piece.open = !piece.open;
    this.rebuild();
    return true;
  }





  solidAt(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          for (const cell of this._cellEntries(KEY(fx - i, fy - j, fz - k))) {
            const kind = this.kind(cell.piece.kind);
            if (kind?.dynamicSolid && cell.piece.open) continue;
            const b = cell.box;
            if (x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY && z >= b.minZ && z <= b.maxZ) return true;
          }
        }
      }
    }
    return false;
  }



  boxHitsBody(box, x, y, z, radius, height) {
    if (y + height <= box.minY + 0.0001 || y >= box.maxY - 0.0001) return false;
    const qx = Math.max(box.minX, Math.min(x, box.maxX));
    const qz = Math.max(box.minZ, Math.min(z, box.maxZ));
    return (x - qx) ** 2 + (z - qz) ** 2 < radius ** 2 - 1e-9;
  }

  collidesBody(x, y, z, radius, height) {
    for (let cx = Math.floor(x - radius); cx <= Math.floor(x + radius); cx++) {
      for (let cy = Math.floor(y); cy <= Math.floor(y + height); cy++) {
        for (let cz = Math.floor(z - radius); cz <= Math.floor(z + radius); cz++) {
          for (const cell of this._cellEntries(KEY(cx, cy, cz))) {
            const kind = this.kind(cell.piece.kind);
            if (!kind?.solid || (kind.dynamicSolid && cell.piece.open)) continue;
            if (this.boxHitsBody(cell.box, x, y, z, radius, height)) return true;
          }
        }
      }
    }
    return false;
  }

  overlapsBody(kindName, x, y, z, rot, body) {
    const kind = this.kind(kindName);
    if (!kind?.solid) return false;
    for (const [, box] of kind.cells(x, y, z, rot)) {
      if (this.boxHitsBody(box, body.x, body.y, body.z, body.radius, body.height)) return true;
    }
    return false;
  }


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
    if (!piece) return null;
    let normal = null;
    const n = hit.face?.normal;
    if (n) {


      const kind = this.kind(piece.kind);
      const a = kind?.rotY ? kind.rotY(piece.rot) : 0;
      const c = Math.cos(a), s = Math.sin(a);
      normal = { x: c * n.x + s * n.z, y: n.y, z: c * n.z - s * n.x };
    } else {
      const af = this.pieceFootprint(piece);
      const faces = [
        { d: Math.abs(hit.point.x - af.x0), x: -1, y: 0, z: 0 },
        { d: Math.abs(hit.point.x - af.x1), x: 1, y: 0, z: 0 },
        { d: Math.abs(hit.point.y - af.y0), x: 0, y: -1, z: 0 },
        { d: Math.abs(hit.point.y - af.y1), x: 0, y: 1, z: 0 },
        { d: Math.abs(hit.point.z - af.z0), x: 0, y: 0, z: -1 },
        { d: Math.abs(hit.point.z - af.z1), x: 0, y: 0, z: 1 },
      ].sort((a, b) => a.d - b.d);
      normal = faces[0];
    }
    return { piece, distance: hit.distance, point: hit.point, normal };
  }








  pieceFootprint(piece) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    let z0 = Infinity, z1 = -Infinity;
    let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
    for (const [key, box] of piece.cells) {
      const [cx, cy, cz] = key.split(',').map(Number);
      x0 = Math.min(x0, box.minX); x1 = Math.max(x1, box.maxX);
      y0 = Math.min(y0, box.minY); y1 = Math.max(y1, box.maxY);
      z0 = Math.min(z0, box.minZ); z1 = Math.max(z1, box.maxZ);
      cx0 = Math.min(cx0, cx); cx1 = Math.max(cx1, cx);
      cz0 = Math.min(cz0, cz); cz1 = Math.max(cz1, cz);
    }
    if (!isFinite(x0)) return null;
    return { x0, x1, y0, y1, z0, z1, cx0, cx1, cz0, cz1 };
  }



  kindFootprint(kindName, rot) {
    const kind = this.kind(kindName);
    if (!kind) return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
    const ys = new Set();
    for (const [key, box] of kind.cells(0, 0, 0, rot)) {
      const [cx, cy, cz] = key.split(',').map(Number);
      x0 = Math.min(x0, box.minX); x1 = Math.max(x1, box.maxX);
      z0 = Math.min(z0, box.minZ); z1 = Math.max(z1, box.maxZ);
      cx0 = Math.min(cx0, cx); cx1 = Math.max(cx1, cx);
      cz0 = Math.min(cz0, cz); cz1 = Math.max(cz1, cz);
      ys.add(cy);
    }
    if (!isFinite(x0)) return null;
    return { ox: x0, sx: x1 - x0, oz: z0, sz: z1 - z0, cx0, cx1, cz0, cz1, layers: ys.size };
  }



  snap(kindName, origin, dir, wantRot = 0, maxDist = 6) {
    const kind = this.kind(kindName);
    if (!kind) return null;
    const o = new this.T.Vector3(origin.x, origin.y, origin.z);
    const d = new this.T.Vector3(dir.x, dir.y, dir.z).normalize();
    const hit = this.pick(o, d, maxDist);
    if (!hit || !hit.piece) return null;
    const af = this.pieceFootprint(hit.piece);
    if (!af) return null;
    const fps = [];
    for (let r = 0; r < (kind.rot || 1); r++) {
      const fp = this.kindFootprint(kindName, r);
      if (fp) fps.push({ rot: r, ...fp });
    }
    const vertical = fps[0]?.layers > 1;
    const anchorVertical = hit.piece.kind === 'wall' || hit.piece.kind === 'door';
    const topFace = hit.normal?.y > 0.45
      || (!hit.normal && hit.point.y >= af.y1 - 0.06 && dir.y < -0.15);
    const nearTop = anchorVertical && hit.point.y >= af.y1 - 0.4;
    const onTop = topFace || nearTop;
    let candidate;
    if (onTop && vertical) {


      candidate = anchorVertical
        ? { x: hit.piece.x, z: hit.piece.z, rot: wantRot }
        : snapPlan(fps, af, hit.point, dir, wantRot, hit.normal)[0];
    } else {
      candidate = snapPlan(fps, af, hit.point, dir, wantRot, hit.normal)[0];
    }
    if (!candidate) return null;
    const y = onTop && (vertical || anchorVertical) ? this.pieceTop(hit.piece) : hit.piece.y;


    return { x: candidate.x, z: candidate.z, rot: candidate.rot, y, anchored: true };
  }

  rebuild() {
    const groups = new Map();
    for (const p of this.pieces.values()) {



      const key = meshKey(p);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    for (const [key, list] of groups) {
      const [tier] = key.split('|');
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


      const piece = this.place(kind, tier, x, y, z, rot || 0, true);
      if (piece) {
        if (hp) piece.hp = hp;
        if (open) piece.open = true;
      }
    }
  }
}

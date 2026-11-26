// Generates the 3D icon models for the building pieces.
//
//   node tools/gen_building_models.mjs
//
// Every building item gets assets/models/items/<id>.glb: the piece's shape
// (a small chunk of it, so the icon reads well) with the tier's texture
// embedded. The game's icon renderer picks them up automatically — it looks
// for assets/models/items/<id>.glb — and renders them isometrically into the
// inventory icons (and the in-hand prop).

import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets/models/items');
const TEX = resolve(ROOT, 'assets/textures/buildings');

const TIERS = ['wood', 'brick', 'concrete', 'shielded'];
const KINDS = ['wall', 'floor', 'roof', 'door', 'triangle', 'stair', 'bunker_door', 'ladder'];

// --- tiny glTF writer ------------------------------------------------------

function chunk(type, data) {
  const len = data.length;
  const out = Buffer.alloc(8 + len + ((4 - (len % 4)) % 4));
  out.writeUInt32LE(len, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  return out;
}

function glb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
  const binPad = Buffer.alloc((4 - (bin.length % 4)) % 4, 0);
  const jsonChunk = chunk('JSON', Buffer.concat([jsonBuf, jsonPad]));
  const binChunk = chunk('BIN\0', Buffer.concat([bin, binPad]));
  const total = 12 + jsonChunk.length + binChunk.length;
  const head = Buffer.alloc(12);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  return Buffer.concat([head, jsonChunk, binChunk]);
}

function buildGlb(geo, jpeg) {
  const pos = Buffer.from(new Float32Array(geo.positions).buffer);
  const nrm = Buffer.from(new Float32Array(geo.normals).buffer);
  const uv = Buffer.from(new Float32Array(geo.uvs).buffer);
  const idx = Buffer.from(new Uint16Array(geo.indices).buffer);
  const parts = [pos, nrm, uv, idx, jpeg];
  const views = [];
  let off = 0;
  for (const p of parts) {
    views.push({ buffer: 0, byteOffset: off, byteLength: p.length });
    off += p.length;
  }
  const bin = Buffer.concat(parts);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geo.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = geo.positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const json = {
    asset: { version: '2.0', generator: 'gen_building_models' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: geo.name }],
    meshes: [{
      name: geo.name,
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
        mode: 4,
      }],
    }],
    materials: [{
      name: geo.name,
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 0.95,
      },
      doubleSided: true,
    }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    images: [{ bufferView: 4, mimeType: 'image/jpeg' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: geo.positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: geo.normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: geo.uvs.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: geo.indices.length, type: 'SCALAR' },
    ],
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
  return glb(json, bin);
}

// --- geometry --------------------------------------------------------------

function pushQuad(g, a, b, c, d, n, uvScale) {
  const base = g.positions.length / 3;
  for (const p of [a, b, c, d]) {
    g.positions.push(p[0], p[1], p[2]);
    g.normals.push(n[0], n[1], n[2]);
  }
  const uvs = [[0, 0], [uvScale[0], 0], [uvScale[0], uvScale[1]], [0, uvScale[1]]];
  uvs.forEach(([u, v]) => g.uvs.push(u, v));
  g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

// A box with one texture tile per metre on every face.
function boxGeo(w, h, d, name) {
  const g = { name, positions: [], normals: [], uvs: [], indices: [] };
  const x = w / 2, y = h / 2, z = d / 2;
  pushQuad(g, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1], [w, h]);
  pushQuad(g, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1], [w, h]);
  pushQuad(g, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0], [d, h]);
  pushQuad(g, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0], [d, h]);
  pushQuad(g, [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0], [w, d]);
  pushQuad(g, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0], [w, d]);
  return g;
}

// A prism with a triangular cross section: the roof gable and the wedge.
function prismGeo(profile, length, axis, name) {
  // profile: [[u, v], ...] around the cross section, closed.
  const g = { name, positions: [], normals: [], uvs: [], indices: [] };
  const n = profile.length;
  const half = length / 2;
  const at = (u, v, t) => (axis === 'x' ? [t, u, v] : [u, v, t]);
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    const p0 = at(a[0], a[1], -half), p1 = at(b[0], b[1], -half);
    const p2 = at(b[0], b[1], half), p3 = at(a[0], a[1], half);
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const base = g.positions.length / 3;
    for (const p of [p0, p1, p2, p3]) {
      g.positions.push(p[0], p[1], p[2]);
      g.normals.push(nx, ny, nz);
    }
    g.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // The two end caps, fanned from the profile centroid.
  for (const side of [-1, 1]) {
    const cx = profile.reduce((s, p) => s + p[0], 0) / n;
    const cy = profile.reduce((s, p) => s + p[1], 0) / n;
    const base = g.positions.length / 3;
    const nrm = axis === 'x' ? [side, 0, 0] : [0, 0, side];
    for (const p of profile) {
      const q = at(p[0], p[1], side * half);
      g.positions.push(q[0], q[1], q[2]);
      g.normals.push(nrm[0], nrm[1], nrm[2]);
      g.uvs.push(p[0] - cx + 0.5, p[1] - cy + 0.5);
    }
    for (let i = 1; i + 1 < n; i++) {
      if (side > 0) g.indices.push(base, base + i, base + i + 1);
      else g.indices.push(base, base + i + 1, base + i);
    }
  }
  return g;
}

// --- the piece shapes ------------------------------------------------------
// Small chunks of the real pieces: the icon frames the model's bounds, so a
// full 3 m panel would read as a flat card.

function movedGeo(g, dx, dy, dz) {
  for (let i = 0; i < g.positions.length; i += 3) {
    g.positions[i] += dx; g.positions[i + 1] += dy; g.positions[i + 2] += dz;
  }
  return g;
}

function mergeGeo(parts, name) {
  const g = { name, positions: [], normals: [], uvs: [], indices: [] };
  for (const p of parts) {
    const base = g.positions.length / 3;
    g.positions.push(...p.positions);
    g.normals.push(...p.normals);
    g.uvs.push(...p.uvs);
    g.indices.push(...p.indices.map((i) => i + base));
  }
  return g;
}

function shapeGeo(kind) {
  switch (kind) {
    case 'wall': return boxGeo(0.9, 0.9, 0.22, 'wall');
    case 'floor': return boxGeo(0.9, 0.22, 0.9, 'floor');   // a flat deck, not a panel
    case 'roof': {
      // a small gable: eaves at 0, ridge in the middle
      const p = [[-0.45, 0], [0.45, 0], [0.45, 0.22], [0.12, 0.5], [-0.12, 0.5], [-0.45, 0.22]];
      return prismGeo(p, 0.9, 'x', 'roof');
    }
    case 'door': return boxGeo(0.55, 1.0, 0.14, 'door');  // a tall narrow panel
    case 'triangle': {
      const p = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45]];
      return prismGeo(p, 0.22, 'y', 'triangle');
    }
    case 'stair': {
      // four rising treads, like the real ten-tread piece in miniature
      const steps = [];
      for (let i = 0; i < 4; i++) {
        const h = 0.16 * (i + 1);
        const run = 0.22;
        steps.push(movedGeo(boxGeo(0.9, h, run, 'tread'), 0, h / 2 - 0.4, -0.44 + run * (i + 0.5)));
      }
      return mergeGeo(steps, 'stair');
    }
    case 'bunker_door': {
      // two full-width leaves, one slid forward so the icon reads as sliding
      return mergeGeo([
        movedGeo(boxGeo(0.44, 0.9, 0.16, 'leaf'), -0.23, 0, 0),
        movedGeo(boxGeo(0.44, 0.9, 0.16, 'leaf'), 0.23, 0, 0.1),
      ], 'bunker_door');
    }
    case 'ladder': {
      const parts = [
        movedGeo(boxGeo(0.09, 0.95, 0.09, 'rail'), -0.24, 0, 0),
        movedGeo(boxGeo(0.09, 0.95, 0.09, 'rail'), 0.24, 0, 0),
      ];
      for (let i = 0; i < 5; i++) parts.push(movedGeo(boxGeo(0.5, 0.07, 0.07, 'rung'), 0, -0.38 + i * 0.19, 0));
      return mergeGeo(parts, 'ladder');
    }
    default: return boxGeo(0.6, 0.6, 0.3, kind);
  }
}

// --- run -------------------------------------------------------------------

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// Smaller textures for the icons: 256 px is plenty at 128 px icon size.
const ICON_TEX = resolve('/tmp/opencode/icontex');
if (!existsSync(ICON_TEX)) mkdirSync(ICON_TEX, { recursive: true });

const wanted = process.argv.slice(2);
let made = 0;
for (const kind of KINDS.filter((k) => !wanted.length || wanted.includes(k))) {
  const geo = shapeGeo(kind);
  for (const tier of TIERS) {
    const src = resolve(TEX, `${tier}.jpg`);
    const small = resolve(ICON_TEX, `${tier}.jpg`);
    if (!existsSync(src)) { console.warn('missing texture', src); continue; }
    execFileSync('convert', [src, '-resize', '256x256', '-quality', '72', small]);
    const jpeg = readFileSync(small);
    const id = `${kind}_${tier}`;
    writeFileSync(resolve(OUT, `${id}.glb`), buildGlb(geo, jpeg));
    made++;
  }
}
console.log(`wrote ${made} building icon models to assets/models/items/`);

// Self-checks for the meshes the building pieces are drawn in:
//   node assets/js/building.mesh.check.mjs
//
// Two kinds of the same tier must never share an InstancedMesh: the mesh
// draws every instance with the shape of its first piece, so a wall in a
// floor's mesh would lie flat like a floor and a floor in a wall's mesh
// would stand up like a wall.

import { BuildingSystem, meshKey } from './building.js';

// A tiny three.js stand in: just enough for the runtime to build meshes.
function stubThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Quaternion { setFromEuler(e) { this.euler = e; return this; } }
  class Euler { set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  class Matrix4 { compose(pos, rot, scl) { this.pos = pos; this.rot = rot; this.scl = scl; return this; } }
  class Group { constructor() { this.children = []; } add(c) { this.children.push(c); } }
  class BoxGeometry {
    constructor() {
      const n = 24;
      this.attributes = { uv: { count: n, getX: () => 0, getY: () => 0, setXY() {}, needsUpdate: false } };
    }
  }
  class InstancedMesh {
    constructor(geometry, material, count) {
      this.geometry = geometry; this.material = material; this.count = count;
      this.instanceMatrix = { count, needsUpdate: false };
      this.matrices = []; this.userData = {};
    }
    setMatrixAt(i, m) { this.matrices[i] = m; }
    computeBoundingSphere() { }
  }
  class MeshLambertMaterial { constructor() { this.color = { setHex() { } }; this.map = null; } }
  class TextureLoader { load() { return {}; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(n, a) { this.attributes[n] = a; return this; }
    setIndex(i) { this.index = i; return this; }
    computeVertexNormals() { }
  }
  class Float32BufferAttribute { constructor(array, itemSize) { this.array = Array.from(array); this.itemSize = itemSize; } }
  return {
    Vector3, Quaternion, Euler, Matrix4, Group, BoxGeometry, InstancedMesh,
    MeshLambertMaterial, TextureLoader, BufferGeometry, Float32BufferAttribute,
  };
}

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const world = {
  field: { get: (x, y, z) => (y <= 0 ? 1 : 0) },   // solid ground up to y = 0
  getSurfaceHeight: () => 0,
};
const B = new BuildingSystem({ THREE: stubThree(), scene: { add() { } }, world });

B.place('floor', 'wood', 0, 0, 0, 0);
B.place('wall', 'wood', 0, 0, 6, 0);
B.place('door', 'wood', 0, 0, 12, 0);
B.place('triangle', 'wood', 0, 0, 18, 0);

check(B.meshes.size === 4, `four kinds of one tier make four meshes (${B.meshes.size})`);
check(B.pieces.size === 4, 'all four pieces were placed');
for (const kind of ['floor', 'wall', 'door', 'triangle']) {
  check(B.meshes.has(`wood|${kind}`), `the ${kind} has its own mesh`);
}

const scales = {
  floor: [3, 1, 3],
  wall: [3, 3, 0.25],
  door: [1, 3, 0.25],
  triangle: [3, 0.25, 3],
};
for (const [kind, want] of Object.entries(scales)) {
  const mesh = B.meshes.get(`wood|${kind}`);
  const m = mesh && mesh.matrices[0];
  const got = m ? [m.scl.x, m.scl.y, m.scl.z] : null;
  check(got && Math.abs(got[0] - want[0]) < 1e-9 && Math.abs(got[1] - want[1]) < 1e-9
    && Math.abs(got[2] - want[2]) < 1e-9,
  `the ${kind} is drawn at its own size (${got ? got.join(',') : 'none'} vs ${want.join(',')})`);
}

// A wall and a floor of the same tier are different meshes.
check(meshKey({ tier: 'wood', kind: 'wall' }) !== meshKey({ tier: 'wood', kind: 'floor' }),
  'a wall and a floor of the same tier do not share a mesh');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`building mesh check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`building mesh OK — ${ok.length} assertions`);

// A tiny three.js stand in, so the building runtime can be exercised in node
// without a browser: enough for the meshes, the placement and the shadow.

export function stubThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
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

// A flat world: solid ground up to y = 0, and nothing above it.
export function flatWorld() {
  return {
    field: { get: (x, y, z) => (y <= 0 ? 1 : 0) },
    getSurfaceHeight: () => 0,
  };
}

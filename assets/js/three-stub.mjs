


export function stubThree() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    distanceTo(v) { return Math.hypot(v.x - this.x, v.y - this.y, v.z - this.z); }
  }
  class Quaternion { setFromEuler(e) { this.euler = e; return this; } }
  class Euler { set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
  class Matrix4 { compose(pos, rot, scl) { this.pos = pos; this.rot = rot; this.scl = scl; return this; } }
  class Group { constructor() { this.children = []; } add(c) { this.children.push(c); } remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); } }
  class Mesh {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = new Vector3(); }
  }
  class Line {
    constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = new Vector3(); }
  }
  class BoxGeometry {
    constructor(sx = 1, sy = 1, sz = 1) {
      const n = 24;
      const uvArr = new Float32Array(n * 2);


      this.attributes = {
        position: { array: new Float32Array(n * 3), itemSize: 3 },
        normal: { array: new Float32Array(n * 3), itemSize: 3 },
        uv: {
          array: uvArr, itemSize: 2, count: n,
          getX: (i) => uvArr[i * 2], getY: (i) => uvArr[i * 2 + 1],
          setXY(i, x, y) { uvArr[i * 2] = x; uvArr[i * 2 + 1] = y; },
          needsUpdate: false,
        },
      };
      this.index = null;
      this.size = { x: sx, y: sy, z: sz };
    }
    translate(x, y, z) {
      const p = this.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) { p[i] += x; p[i + 1] += y; p[i + 2] += z; }
      return this;
    }
    getAttribute(name) { return this.attributes[name]; }
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
  class LineBasicMaterial { constructor() { this.color = { value: 0, setHex(v) { this.value = v; } }; this.opacity = 1; } }
  class EdgesGeometry { constructor(geometry) { this.source = geometry; } }
  class LineSegments {
    constructor(geometry, material) {
      this.geometry = geometry; this.material = material; this.children = [];
      this.position = { set() { } };
      this.scale = { set() { }, setScalar() { } };
      this.rotation = { y: 0 };
    }
    add(c) { this.children.push(c); }
  }
  class TextureLoader { load() { return {}; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(n, a) { this.attributes[n] = a; return this; }
    setIndex(i) { this.index = i; return this; }
    computeVertexNormals() { }
    static setFromPoints(points) { const g = new BufferGeometry(); g.points = points; return g; }
  }
  class Float32BufferAttribute { constructor(array, itemSize) { this.array = Array.from(array); this.itemSize = itemSize; } }
  return {
    Vector3, Quaternion, Euler, Matrix4, Group, BoxGeometry, InstancedMesh,
    MeshLambertMaterial, TextureLoader, BufferGeometry, Float32BufferAttribute,
    LineBasicMaterial, EdgesGeometry, LineSegments, Mesh, Line,
  };
}


export function flatWorld() {
  return {
    field: { get: (x, y, z) => (y <= 0 ? 1 : 0) },
    getSurfaceHeight: () => 0,
  };
}



const EPS = 1e-9;
const KEY = (x, y, z) => `${x},${y},${z}`;

function xyz(key) { return key.split(',').map(Number); }
function cellList(sys, key) {
  const e = sys.cells.get(key);
  if (!e) return [];
  return Array.isArray(e) ? e : [e];
}


export function baseAt(sys, cells) {
  let top = null;
  const seen = new Set();
  for (const [key] of cells) {
    const [x, , z] = xyz(key);
    const column = `${x},${z}`;
    if (seen.has(column)) continue;
    seen.add(column);
    const piece = sys.topAt(x, z);
    const ground = sys.surfaceHeight(x, z);
    const h = piece === null ? ground : Math.max(piece, ground);
    if (top === null || h > top) top = h;
  }
  return top === null ? 0 : top;
}

function held(sys, x, y, z, box) {
  if (sys.groundAt(x, y - 1, z)) return true;
  for (const below of cellList(sys, KEY(x, y - 1, z))) {
    if (Math.abs(below.box.maxY - y) > EPS) continue;
    const b = below.box;
    if (Math.min(box.maxX, b.maxX) - Math.max(box.minX, b.minX) > EPS
      && Math.min(box.maxZ, b.maxZ) - Math.max(box.minZ, b.minZ) > EPS) return true;
  }
  return false;
}


export function anySupport(sys, cells, y) {
  return cells.some(([key, box]) => {
    const [x, cy, z] = xyz(key);
    return cy === y && held(sys, x, y, z, box);
  });
}


export function edgeSupport(sys, cells, y) {
  const at = new Map();
  const xs = new Set(), zs = new Set();
  for (const [key, box] of cells) {
    const [x, cy, z] = xyz(key);
    if (cy !== y) continue;
    at.set(`${x},${z}`, { x, z, box });
    xs.add(x);
    zs.add(z);
  }
  const row = (x, z) => {
    const c = at.get(`${x},${z}`);
    return !!c && held(sys, x, y, z, c.box);
  };
  for (const z of zs) if ([...xs].every((x) => row(x, z))) return true;
  for (const x of xs) if ([...zs].every((z) => row(x, z))) return true;


  const hasFloor = (x, z) => cellList(sys, KEY(x, y, z)).some((c) => c.piece && ['floor', 'roof', 'triangle'].includes(c.piece.kind));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  if ([...xs].every((x) => hasFloor(x, minZ - 1))) return true;
  if ([...xs].every((x) => hasFloor(x, maxZ + 1))) return true;
  if ([...zs].every((z) => hasFloor(minX - 1, z))) return true;
  if ([...zs].every((z) => hasFloor(maxX + 1, z))) return true;

  return false;
}

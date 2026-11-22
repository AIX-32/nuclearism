







import { BuildingSystem, meshKey } from './building.js';
import { stubThree, flatWorld } from './three-stub.mjs';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const B = new BuildingSystem({ THREE: stubThree(), scene: { add() { } }, world: flatWorld() });

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


check(meshKey({ tier: 'wood', kind: 'wall' }) !== meshKey({ tier: 'wood', kind: 'floor' }),
  'a wall and a floor of the same tier do not share a mesh');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`building mesh check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`building mesh OK: ${ok.length} assertions`);

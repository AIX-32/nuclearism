// Intent preserving placement checks: node assets/js/building.intent.check.mjs
// Real BuildingSystem/piece code runs on the normal node THREE stub. The small
// game.js extracts at the end run its actual target/preview/place/mine bodies
// without starting the browser game.

import { readFileSync } from 'node:fs';
import { BuildingSystem, snapPlan } from './building.js';
import { stubThree, flatWorld } from './three-stub.mjs';
import { KIND as WALL } from './pieces/wall.js';
import { KIND as DOOR } from './pieces/door.js';
import { KIND as FLOOR } from './pieces/floor.js';
import { KIND as ROOF } from './pieces/roof.js';
import { BUILD_TIERS } from './build-tiers.js';

const results = [];
function check(cond, msg) { results.push([!!cond, msg]); }
function samePlace(got, want) {
  return !!got && ['x', 'y', 'z', 'rot'].every((k) => got[k] === want[k]);
}
function showPlace(p) { return p ? `{${p.x},${p.y},${p.z},r${p.rot}}` : 'null'; }

const THREE = stubThree();
Object.assign(THREE.Vector3.prototype, {
  normalize() { const n = Math.hypot(this.x, this.y, this.z) || 1; this.x /= n; this.y /= n; this.z /= n; return this; },
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); },
  addScaledVector(v, n) { this.x += v.x * n; this.y += v.y * n; this.z += v.z * n; return this; },
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; },
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; },
  length() { return Math.hypot(this.x, this.y, this.z); },
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
  applyQuaternion() { return this; },
});
THREE.MeshBasicMaterial = class {
  constructor() { this.color = { value: 0, setHex(v) { this.value = v; } }; }
};
THREE.Mesh = class {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material;
    this.position = { set() {} }; this.scale = { set() {} }; this.rotation = { y: 0 };
    this.children = [];
  }
  add(child) { this.children.push(child); }
};

function system(world = flatWorld()) {
  return new BuildingSystem({ THREE, scene: { add() {} }, world });
}
function fps(B, kindName) {
  const kind = B.kind(kindName);
  return Array.from({ length: kind.rot || 1 }, (_, rot) => ({ rot, ...B.kindFootprint(kindName, rot) }));
}
function exactHit(B, piece, point, normal, distance = 1) {
  B.pick = () => ({ piece, point, normal, distance });
}
const ORIGIN = { x: 1.5, y: 2, z: 5 };

// R is an instruction, including when its footprint is not the planner's
// automatic best fit. Exercise both the pure plan and the placed-piece path.
for (const kindName of ['wall', 'door']) {
  const B = system();
  const anchor = B.place('floor', 'wood', 0, 0, 0, 0);
  const point = { x: 1.5, y: 1, z: 0 };
  const dir = { x: 0, y: 0, z: 1 };
  const plan = snapPlan(fps(B, kindName), B.pieceFootprint(anchor), point, dir, 2);
  check(plan[0]?.rot === 2, `${kindName}: pure snap keeps selected R=2 (got r${plan[0]?.rot})`);
  exactHit(B, anchor, point, { x: 0, y: 0, z: -1 });
  const got = B.snap(kindName, ORIGIN, dir, 2);
  check(got?.rot === 2, `${kindName}: runtime snap never auto-rotates selected R=2 (got ${showPlace(got)})`);
}

// The exact struck face beats the dominant ray component. Nearby points on
// the same +X face also resolve to the one stable socket.
{
  const B = system();
  const anchor = B.place('floor', 'wood', 0, 0, 0, 0);
  const dir = { x: -0.4, y: 0, z: -0.9 };
  for (const z of [0.4, 2.6]) {
    exactHit(B, anchor, { x: 3, y: 0.5, z }, { x: 1, y: 0, z: 0 });
    const got = B.snap('wall', ORIGIN, dir, 2);
    check(samePlace(got, { x: 2, y: 1, z: 0, rot: 2 }),
      `exact +X face controls wall snap (aim z=${z}; got ${showPlace(got)}, want {2,1,0,r2})`);
  }
}

// A side face near the top is still a side face. Only the actual top may put a
// 3x3 slab over the supporting wall and let it cantilever.
{
  const B = system();
  const anchor = B.place('wall', 'wood', 0, 0, 0, 0);
  const af = B.pieceFootprint(anchor);
  for (const kindName of ['floor', 'roof']) {
    const plan = snapPlan(fps(B, kindName), af, { x: 1.5, y: 2.9, z: 1 }, { x: 0, y: 0, z: -1 }, 0);
    check(plan[0]?.z === 1,
      `${kindName}: upper SIDE hit does not cantilever (got z=${plan[0]?.z}, want z=1)`);
    const top = snapPlan(fps(B, kindName), af, { x: 1.5, y: 3, z: 0.875 }, { x: 0, y: 0, z: -1 }, 0);
    check(top[0]?.z === -2, `${kindName}: exact TOP hit still cantilevers (got z=${top[0]?.z})`);
  }
}

// The selected socket is blocked on purpose. A different rotation/location is
// not an alternative: return that rejected socket so the game can show it red.
for (const kindName of ['wall', 'door']) {
  const B = system();
  const anchor = B.place('floor', 'wood', 0, 0, 0, 0);
  check(!!B.place(kindName, 'wood', 0, 0, -1, 0), `${kindName}: blocker fixture occupies intended socket`);
  const point = { x: 1.5, y: 1, z: 0 };
  exactHit(B, anchor, point, { x: 0, y: 0, z: -1 });
  const got = B.snap(kindName, ORIGIN, { x: 0, y: 0, z: 1 }, 0);
  check(samePlace(got, { x: 0, y: 0, z: -1, rot: 0 }),
    `${kindName}: blocked intended socket does not hop elsewhere (got ${showPlace(got)})`);
  check(!B.canPlace(kindName, 0, 0, -1, 0), `${kindName}: intended socket really is occupied`);
}

// Each shape has a genuinely solid terrain voxel inside one of its own cell
// boxes. Ground at y=-1 supports the piece; it must not excuse the intruder.
function voxelWorld(solid) {
  return {
    field: { get: (x, y, z) => (solid.has(`${x},${y},${z}`) || y < 0 ? 1 : 0) },
    getSurfaceHeight: () => 0,
  };
}
const terrainCases = {
  wall: [0, 0, 0, 0, '1,1,0'],
  door: [0, 0, 0, 0, '0,1,0'],
  floor: [0, 0, 0, 0, '1,0,1'],
};
for (const [kindName, args] of Object.entries(terrainCases)) {
  const [x, y, z, rot, key] = args;
  const B = system(voxelWorld(new Set([key])));
  const allowed = B.canPlace(kindName, x, y, z, rot);
  const placed = B.place(kindName, 'wood', x, y, z, rot);
  check(!allowed && !placed, `${kindName}: terrain inside piece refuses canPlace/place (allowed=${allowed}, placed=${!!placed})`);
}

// Continuous body checks cover a tall panel/door and a low deck, including a
// body centre outside a thin panel but its radius crossing it.
for (const [kindName, body] of Object.entries({
  wall: { x: 1.5, y: 0, z: -0.1, radius: 0.3, height: 1.8 },
  door: { x: 0.5, y: 0, z: -0.1, radius: 0.3, height: 1.8 },
  floor: { x: 1.5, y: 0.2, z: 1.5, radius: 0.3, height: 1.8 },
})) {
  const B = system();
  const hit = B.overlapsBody?.(kindName, 0, 0, 0, 0, body);
  check(hit === true, `${kindName}: proposed cells overlap the player cylinder (got ${hit})`);
}

// Run the real inner game functions, with only their enclosing browser state
// injected. Optional extracts let this check run against both sides of the fix.
const gameSource = readFileSync(new URL('./game.js', import.meta.url), 'utf8');
function gameFunction(name) {
  const at = gameSource.indexOf(`function ${name}(`);
  if (at < 0) return '';
  // Skip the parameter list: a default like `opts = {}` must not be read as
  // the start of the body.
  let params = 0, p = at;
  for (; p < gameSource.length; p++) {
    if (gameSource[p] === '(') params++;
    else if (gameSource[p] === ')' && --params === 0) break;
  }
  const open = gameSource.indexOf('{', p);
  let depth = 0, quote = '', escape = false;
  for (let i = open; i < gameSource.length; i++) {
    const c = gameSource[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    // A comment can hold an apostrophe or a brace; it must not reach the
    // quote and depth scan.
    if (c === '/' && gameSource[i + 1] === '/') {
      const nl = gameSource.indexOf('\n', i);
      i = nl < 0 ? gameSource.length : nl;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return gameSource.slice(at, i + 1);
  }
  throw new Error(`unterminated game function ${name}`);
}
function gameRuntime(names, scope) {
  const keys = Object.keys(scope);
  const body = names.map(gameFunction).join('\n');
  return new Function(...keys, `${body}\nreturn { ${names.join(',')} };`)(...keys.map((k) => scope[k]));
}

// An occupied anchor must survive buildingTarget: terrain behind it is not a
// licence to throw the ghost onto an unrelated world-grid cell.
{
  const B = system();
  const anchor = B.place('floor', 'wood', 0, 0, 0, 0);
  B.place('wall', 'wood', 0, 0, -1, 0);
  exactHit(B, anchor, { x: 1.5, y: 1, z: 0 }, { x: 0, y: 0, z: -1 });
  const { buildingTarget } = gameRuntime(['buildingTarget'], {
    buildingSystem: B, THREE, placeRot: 0, REACH: 7,
    player: { pos: { x: 4, y: 2, z: 6 }, eye: 1.62 },
  });
  const dir = new THREE.Vector3(0, 0, 1);
  const hit = new THREE.Vector3(4.5, 0, -4.1);
  const t = buildingTarget({ kind: 'wall' }, { dir, hit });
  check(t && t.gx === 0 && t.gz === -1 && t.base === 0 && t.rot === 0,
    `game buildingTarget keeps blocked anchor instead of terrain fallback (got ${JSON.stringify(t)})`);
}

// The production ghost and placement path must agree for terrain and player
// overlap. B.snap is fixed only to isolate validation from planner ordering.
function gamePlacementCase(kindName, world, player) {
  const B = system(world);
  B.pick = () => ({ piece: { id: -1 }, point: { x: 0, y: 0, z: 0 }, distance: 1 });
  B.snap = () => ({ x: 0, y: 0, z: 0, rot: 0, anchored: true });
  const itemId = `${kindName}_wood`;
  const ITEMS = { [itemId]: { building: { kind: kindName, tier: 'wood' } } };
  const scene = { last: null, add(v) { this.last = v; }, remove() {} };
  const dir = new THREE.Vector3(0, 0, -1), hit = new THREE.Vector3(0, 0, 10);
  const scope = {
    buildingSystem: B, THREE, placeRot: 0, REACH: 7, player, ITEMS, scene,
    inv: { sel: 0, hot: [{ id: itemId, n: 1 }] },
    locked: true, invOpen: false, cmdOpen: false, workbenchUI: { opened: false },
    wallGhost: null, wallGhostKey: '', wallGhostEdges: null, BUILD_TIERS,
    pieceEdgeGeoms: new Map(),
    mineAim: () => ({ dir, hit }),
    achBump() {}, triggerSwing() {}, syncBars() {}, notice() {},
    tryTorchPlace() {}, pipeSystem: null, machineSystem: null,
  };
  const names = ['buildingTarget', 'groundSweep', 'buildingPlaceIssue', 'buildingBlocked', 'hideWallGhost', 'pieceEdgeGeometry', 'updateWallPreview', 'doPlace'];
  const rt = gameRuntime(names, scope);
  rt.updateWallPreview(0, itemId);
  const placed = rt.doPlace();
  return { B, placed, tint: scene.last?.material.color.value };
}
const away = { pos: { x: 50, y: 0, z: 50 }, eye: 1.62, radius: 0.3, height: 1.8 };
for (const [kindName, args] of Object.entries(terrainCases)) {
  const result = gamePlacementCase(kindName, voxelWorld(new Set([args[4]])), away);
  check(result.tint === 0xff5555 && result.placed === null && result.B.pieces.size === 0,
    `game ${kindName}: terrain-overlap ghost is red and doPlace refuses (tint=${result.tint?.toString(16)}, placed=${result.placed?.type})`);
}
for (const [kindName, body] of Object.entries({
  wall: { x: 1.5, y: 0, z: 0.85, radius: 0.3, height: 1.8 },
  door: { x: 0.5, y: 0, z: 0.85, radius: 0.3, height: 1.8 },
  floor: { x: 1.5, y: 0.2, z: 1.5, radius: 0.3, height: 1.8 },
})) {
  const player = { pos: { x: body.x, y: body.y, z: body.z }, eye: 1.62, radius: body.radius, height: body.height };
  const result = gamePlacementCase(kindName, voxelWorld(new Set()), player);
  check(result.tint === 0xff5555 && result.placed === null && result.B.pieces.size === 0,
    `game ${kindName}: player-overlap ghost is red and doPlace refuses (tint=${result.tint?.toString(16)}, placed=${result.placed?.type})`);
}

// raycastTerrain returns an exact point, not a voxel coordinate. doMine must
// compare its actual distance with the building hit: adding 0.5 to each axis
// can promote a wall behind the hill ahead of the terrain.
function mineCase(buildingDistance) {
  const B = system();
  const wall = B.place('wall', 'wood', 0, 0, 0, 0);
  B.pick = () => ({ piece: wall, point: { x: 0, y: 0, z: 0 }, distance: buildingDistance });
  let terrainMined = 0;
  const tool = { build: true, rate: 1, good: ['stone'], yield: 1, radius: 1 };
  const scope = {
    buildingSystem: B, THREE, REACH: 7, wrappers: [], BARE_HANDS: {},
    player: { pos: { x: 0, y: 0, z: 0 }, eye: 0 }, camera: { quaternion: {} },
    ITEMS: { wall_wood: { building: { kind: 'wall', tier: 'wood' } } },
    heldTool: () => tool, mineAim: () => ({ dir: new THREE.Vector3(0, 0, 1), hit: new THREE.Vector3(0, 0, 3) }),
    tryChopTree: () => false, shakeTreeForFruit: () => false,
    triggerSwing() {}, machineSystem: null, pipeSystem: null,
    groundBand: () => 'stone', world: { mineAnimated() { terrainMined++; } },
    achBump() {}, give() {}, notice() {}, mineDrops: () => [],
  };
  gameRuntime(['doMine'], scope).doMine();
  return { hp: wall.hp, pieces: B.pieces.size, terrainMined };
}
{
  const behind = mineCase(3.2);
  check(behind.pieces === 1 && behind.terrainMined === 1,
    `doMine leaves a building behind nearer terrain alone (${JSON.stringify(behind)})`);
  const front = mineCase(2);
  check(front.pieces === 0 && front.terrainMined === 0,
    `doMine still breaks a building in front of terrain (${JSON.stringify(front)})`);
}

let failed = 0;
for (const [ok, msg] of results) if (!ok) { failed++; console.error('FAIL:', msg); }
if (failed) { console.error(`building intent check failed: ${failed}/${results.length}`); process.exit(1); }
console.log(`building intent OK — ${results.length} assertions`);









import { KIND as FLOOR, ITEMS, RECIPES } from './floor.js';
import { KIND as WALL } from './wall.js';

const ok = [];
function check(cond, msg) { ok.push([!!cond, msg]); }

const W = 3, D = 3;


const X = 4, Y = 10, Z = 7;
const cells = FLOOR.cells(X, Y, Z);
check(cells.length === W * D, `a floor owns ${W * D} cells`);
check(new Set(cells.map(([k]) => k.split(',')[1])).size === 1, 'a floor sits in a single level');
check(new Set(cells.map(([k]) => k.split(',')[0])).size === W, 'a floor runs over three x cells');
check(new Set(cells.map(([k]) => k.split(',')[2])).size === D, 'a floor runs over three z cells');
check(cells.every(([k]) => k.split(',').length === 3), 'cell keys are x,y,z');
check(cells.every(([, b]) => b.minX >= X && b.maxX <= X + W), 'every cell slice stays inside the deck');
check(cells.every(([, b]) => b.minZ >= Z && b.maxZ <= Z + D), 'every cell slice stays inside the deck');
check(cells.every(([, b]) => b.minY === Y && b.maxY === Y + 1), 'the deck fills its cell');


const surface = Math.max(...cells.map(([, b]) => b.maxY));
check(surface === Y + 1, `the walking surface is the cell top (${surface})`);

const center = FLOOR.center(X, Y, Z);
const scale = FLOOR.scale(X, Y, Z, 0);
check(center.x === X + W / 2 && center.z === Z + D / 2, 'the mesh sits in the middle of the deck');
check(center.y === Y + 0.5, 'the mesh sits in the middle of the cell');
check(scale.x === W && scale.y === 1 && scale.z === D, 'the mesh is the deck, one cell thick');
check(FLOOR.solid === true, 'a floor is solid: the player can stand on it');
check(FLOOR.attenuate === true, 'a floor takes part in the radiation shadow');


const wall = { kind: 'wall', y: Y, cells: WALL.cells(X, Y, Z, 0) };
const wallCells = new Set(wall.cells.map(([k]) => k));
const wallTop = Y + 3;



const deck = FLOOR.cells(X, wallTop, Z);
check(deck.every(([k]) => !wallCells.has(k)), 'a deck on a wall never overlaps the wall cells');
const deckCells = new Set(deck.map(([k]) => k));
check(!deckCells.has(`${X},${Y + 2},${Z}`), 'a deck on a wall leaves the wall top cell alone');


check(deck.every(([, b]) => b.minY === wallTop), 'a deck on a wall starts at the wall top');
check(wall.cells.every(([, b]) => b.maxY <= wallTop), 'the wall and the deck do not overlap');


const wallOnDeck = WALL.cells(X, surface, Z, 0);
check(wallOnDeck.every(([, b]) => b.minY >= surface), 'a wall on a deck starts on the walking surface');
check(wallOnDeck.some(([, b]) => b.minY === surface), 'a wall on a deck touches the walking surface');
check(!deckCells.has(`${X},${surface},${Z}`), 'a wall on a deck does not share a cell with the deck');





function fakeSys(pieces = [], opts = {}) {
  const ground = opts.ground || new Set();
  const heights = opts.heights || new Map();
  const cellsMap = new Map();
  for (const p of pieces) for (const [k, box] of p.cells) cellsMap.set(k, { piece: p, box });
  const key = (x, y, z) => `${x},${y},${z}`;
  return {
    cells: cellsMap,
    occupied: (x, y, z) => cellsMap.has(key(x, y, z)),
    groundAt: (x, y, z) => ground.has(key(x, y, z)),
    surfaceHeight: (x, z) => (heights.has(key(x, 0, z)) ? heights.get(key(x, 0, z)) : 0),
    topAt(x, z) {
      let top = null;
      for (const p of pieces) {
        let hit = false;
        for (const [k] of p.cells) {
          const [cx, , cz] = k.split(',').map(Number);
          if (cx === x && cz === z) { hit = true; break; }
        }
        if (!hit) continue;
        let t = p.y;
        for (const [k] of p.cells) {
          const cy = Number(k.split(',')[1]);
          if (cy + 1 > t) t = cy + 1;
        }
        if (top === null || t > top) top = t;
      }
      return top;
    },
  };
}


const onWall = fakeSys([wall]);
check(FLOOR.base(onWall, X, Z) === wallTop, `a deck aimed at a wall lands on its top (${FLOOR.base(onWall, X, Z)})`);
check(FLOOR.support(onWall, X, wallTop, Z) === true, 'a deck on a wall is supported');


const groundCells = new Set();
for (let i = -1; i <= 4; i++) for (let k = -1; k <= 4; k++) groundCells.add(`${X + i},${Y - 1},${Z + k}`);
const onGround = fakeSys([], { ground: groundCells, heights: new Map([[`${X},0,${Z}`, Y]]) });
check(FLOOR.base(onGround, X, Z) === Y, `a deck with nothing under it lands on the ground (${FLOOR.base(onGround, X, Z)})`);
check(FLOOR.support(onGround, X, Y, Z) === true, 'a deck on the ground is supported');


const floating = fakeSys([]);
check(FLOOR.base(floating, X, Z) === 0, 'a deck over empty ground lands on the ground level');
check(FLOOR.support(floating, X, 40, Z) === false, 'a deck with nothing under it is refused');
const oneBlock = fakeSys([], { ground: new Set([`${X},${Y - 1},${Z}`]) });
check(FLOOR.support(oneBlock, X, Y, Z) === false, 'one block cannot balance the whole deck');
const oneRow = fakeSys([], {
  ground: new Set(Array.from({ length: W }, (_, i) => `${X + i},${Y - 1},${Z}`)),
});
check(FLOOR.support(oneRow, X, Y, Z) === true, 'a fully supported edge holds the deck');


const deckPiece = { kind: 'floor', y: Y, cells: FLOOR.cells(X, Y, Z) };
const onDeck = fakeSys([deckPiece]);
check(FLOOR.base(onDeck, X, Z) === Y + 1, 'a deck on a deck lands on the deck top');
check(FLOOR.support(onDeck, X, Y + 1, Z) === true, 'a deck on a deck is supported');


for (const tier of ['wood', 'brick', 'concrete', 'shielded']) {
  const id = `floor_${tier}`;
  check(!!ITEMS[id], `the item "${id}" exists`);
  check(ITEMS[id]?.building?.kind === 'floor', `the item "${id}" builds a floor`);
  check(ITEMS[id]?.building?.tier === tier, `the item "${id}" is a ${tier} floor`);
  check(RECIPES.some((r) => r.out?.[id] === 1), `the item "${id}" is craftable`);
}
check(ITEMS.floor_wood?.table === true, 'a wood floor is craftable at the pocket table');

let failed = 0;
for (const [cond, msg] of ok) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
}
if (failed) { console.error(`floor check failed: ${failed}/${ok.length}`); process.exit(1); }
console.log(`floor OK: ${ok.length} assertions`);

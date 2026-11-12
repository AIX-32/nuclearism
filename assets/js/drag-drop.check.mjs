import assert from 'node:assert/strict';
import { inventoryAdapter } from './drag-drop.js';

const ITEMS = { stone: { stack: 64 }, ore: { stack: 16 } };
const grid = [null, null, null];

let a = inventoryAdapter(grid, 0, ITEMS);

grid[0] = { id: 'stone', n: 50 };
assert.equal(a.take().n, 50);
assert.equal(grid[0], null, 'take clears the slot');

a.put({ id: 'stone', n: 20 });
assert.deepEqual(grid[0], { id: 'stone', n: 20 }, 'put fills an empty slot');

a.put({ id: 'stone', n: 60 });
assert.equal(grid[0].n, 64, 'same item merges up to the stack cap');

grid[0] = { id: 'stone', n: 50 };
const left = a.put({ id: 'stone', n: 20 });
assert.equal(left.n, 6, 'merge returns the remainder');
assert.equal(grid[0].n, 64, 'merge tops up the existing stack');

grid[1] = { id: 'ore', n: 5 };
const b = inventoryAdapter(grid, 1, ITEMS);
const swapped = b.put({ id: 'stone', n: 2 });
assert.deepEqual(swapped, { id: 'ore', n: 5 }, 'different item swaps out');
assert.deepEqual(grid[0], { id: 'stone', n: 64 }, 'source slot keeps its stack');
b.restore(swapped);
assert.deepEqual(grid[1], { id: 'ore', n: 5 }, 'restore puts a stack back');

console.log('drag-drop.check: ok');

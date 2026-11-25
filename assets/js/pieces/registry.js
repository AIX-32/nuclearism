import { KIND as WALL } from './wall.js';
import { KIND as FLOOR } from './floor.js';
import { KIND as ROOF } from './roof.js';
import { KIND as DOOR } from './door.js';
import { KIND as TRIANGLE } from './triangle.js';
import { KIND as BUNKER_DOOR } from './bunker_door.js';
import { KIND as STAIR } from './stair.js';

// Save files store kinds as indices into this table. Append new kinds only —
// reordering here silently reinterprets old bunker doors as other pieces.
export const KINDS = {
  wall: WALL,
  floor: FLOOR,
  roof: ROOF,
  door: DOOR,
  triangle: TRIANGLE,
  bunker_door: BUNKER_DOOR,
  stair: STAIR,
};

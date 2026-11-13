# Building piece contract

Every placeable building shape is a **kind**: a small module in `assets/js/pieces/`
that owns its geometry, its items and its recipes. `building.js` (the runtime)
knows only this contract, so a new shape never needs a runtime change.

A kind module exports three things:

```js
export const KIND = { ... };   // the geometry
export const ITEMS = { ... };  // ITEM_DEFS entries (building: { kind, tier })
export const RECIPES = [ ... ]; // CRAFT_RECIPES entries (option based bag crafts)
```

`content.js` spreads `ITEMS` into `ITEM_DEFS` and `RECIPES` into `CRAFT_RECIPES`,
so **a kind module never edits `content.js`**. Set `table: true` on an item to make
it craftable at the pocket table.

## KIND

```js
{
  name: 'wall',            // unique kind id
  rot: 2,                 // how many rotations (1, 2 or 4)
  solid: true,            // the piece blocks the player
  attenuate: true,        // the piece takes part in the radiation shadow
  dynamicSolid: false,    // true = solid only while closed (doors)

  // The cells the piece occupies on the 1 m world grid, and the box each cell
  // occupies in world space. Cells are the unit of collision, of the shadow
  // march and of the save file.
  cells(x, y, z, rot) -> [[ 'x,y,z', {minX,maxX,minY,maxY,minZ,maxZ} ], ...],

  // Where the mesh goes.
  center(x, y, z, rot) -> { x, y, z },
  scale(x, y, z, rot) -> { x, y, z },

  // Optional: a custom mesh geometry (a prism, a wedge...). The runtime passes
  // its THREE namespace in, so a kind module never imports three itself.
  geom: 'box',                 // geometry key; a tier+geom pair shares one mesh
  geometry(THREE) -> BufferGeometry,

  // The cell the piece lands on. `sys` is the BuildingSystem.
  base(sys, x, z, rot) -> y,

  // True when the piece has something to sit on. `y` is the base cell.
  support(sys, x, y, z, rot) -> bool,
}
```

### Helpers the runtime gives a kind (`sys`)

- `sys.surfaceHeight(x, z)` — terrain cell height at that column
- `sys.groundAt(x, y, z)` — true when the terrain voxel is solid
- `sys.occupied(x, y, z)` — true when a piece already occupies that cell
- `sys.topAt(x, z)` — top cell (exclusive) of the tallest piece in that column
- `sys.pieces` — every placed piece
- `sys.cells` — the cell map (`'x,y,z' -> { piece, tier, box }`)

### Rules

- `cells()` must return every cell the piece occupies, and the boxes must be
  **inside** those cells.
- A piece never overlaps another piece: the runtime refuses a placement whose
  cells are already taken.
- Solid cells block the player (`playerCollides()`), attenuating cells take
  part in the radiation shadow (`shadowCells()`).
- The mesh is one box per piece, so `scale()` is the box size in metres and
  `center()` its middle. Use a texture from `assets/textures/buildings/`, or a
  plain colour (the runtime falls back to the tier colour when the file is
  missing).

## Checklist for a new kind

1. `assets/js/pieces/<name>.js` with `KIND`, `ITEMS`, `RECIPES`.
2. `node assets/js/pieces/<name>.check.mjs` — pure geometry assertions.
3. Add the kind to `assets/js/pieces/registry.js` (one import, one entry).
4. Never edit `building.js` or `content.js`.

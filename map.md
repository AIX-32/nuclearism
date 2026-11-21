# Nuclearism Project Map

## Project purpose
This project is a browser voxel survival game built with Three.js. The world is generated procedurally from a signed-distance style density field, with chunk streaming, mining/placement, lighting and a first-person controller. It is a dry world: there is no surface water, ocean or beach, and water exists only in containers (filled from industrial tanks or a powered water pump).

On top of that engine sits a NuclearCraft-style progression: a 15-minute day clock with ambient radiation that escalates over time, dose stages that debuff you until they kill you, mining by depth for ore, a pocket crafting table, armor and shielding plates, and power-networked machines — up to reactors that melt down and irradiate the area.

The goal of the codebase is to let you survive an increasingly hostile world by mining, crafting and building out machines to shield yourself, without a heavy build step.

## Main files

### Content, machines and workbench interfaces
- `assets/js/content.js` is the data catalogue: `ITEM_DEFS` (items), `LIQUID_DEFS` (liquid types), `MACHINE_DEFS` (machines), `MACHINE_BY_ID`, `CRAFT_RECIPES`, `TABLE_RECIPES` / `TABLE_OUTPUTS`, `DEPLETED_OF`, `layoutFor(def)` fallback layouts, `STARTER_GUIDE` / `GUIDE_STEPS` (opening build order), `ACHIEVEMENT_TYPES` (achievement categories/tiers), and `TUNING`.
- `assets/js/liquids.js` is the global liquid/container system: pure helpers over `stack.liquid` (`fill`, `drain`, `transfer`, `accepts`, `sanitize`, `volume`). Acid liquids require an acid-proof container.
- `assets/js/radiation.js` is the directional radiation model: `sourcePoint()` (the world's fallout spot), `transmission()` (near-field shadow march), `relativeBearing()` / `compass()` (HUD direction). `radiation.check.mjs` self-checks it.
- `assets/js/building.js` is the base building system: `BuildingSystem` (wall panels, placement, upgrades, collision, radiation shadow, snapping) plus the pure helpers `shadowCells()` / `snapPlan()` / `meshKey()`. `building.check.mjs` self-checks the geometry, the attenuation law and the snapping; `building.mesh.check.mjs` and `building.snap.check.mjs` cover the meshes and the placements (both run on the tiny three.js stand in `assets/js/three-stub.mjs`); `building.intent.check.mjs` extracts game.js's own target/preview/place/mine bodies and runs them in node, so the placement *intent* is checked against the real code, not a copy of it.
- `assets/js/machines.js` is the machine runtime: placement, power networks and auto-linking cables, reactors and meltdowns, the excavator, bucket wheel excavator, radiation emission, save/restore.
- `assets/js/workbench-ui.js` renders JSON-described machine panels as an HTML overlay with a fixed power meter mirroring the RAD bar (bridge-driven, works for every machine).
- `assets/js/craft-options.js` is the shared option-based crafting widget: a small scrollable list of recipe cards (title left, icon right, inventory tooltip on hover) used by both the pocket table and the manufactory.
- `assets/js/drag-drop.js` is the shared pointer drag-and-drop controller for every item slot (inventory, armor, workbench sidebar, machine/storage slots, BWE hold). Slots supply `stack`/`take`/`put`/`restore`; the controller owns the ghost, hover highlight, merge/swap rules and suppresses the click that follows a drag. `inventoryAdapter()` is the standard grid-slot adapter.
- `assets/ui/furnace.json` is an example layout; `ble.html` is the grid editor for authoring them.
- `assets/js/content.check.mjs` validates the catalogue (`node assets/js/content.check.mjs`, 6,000+ assertions: recipes, machine/block pairing, fuel depletion, layout bounds, craft times, radiation curve, progression deadlock guards).
- `assets/js/package.json` is just `{"type":"module"}` so node can import the ES modules for the checker above.
- `assets/js/footsteps.js` is the footstep audio player: preloaded clip pools, `surfToCategory()`, `createFootsteps()`.
- `assets/js/game.js` also holds the first-person **held-tool viewmodel** (§9d) and **tree chopping** (§10c).
- `assets/js/terrain-realistic.js` is the optional **Realistic** heightfield (`createRealisticTerrain(seed)`): the Ported Pinwheel Vista mountain graph, a baked droplet-erosion field that recentres on the player, slope/altitude surface masks and map colours. Self-contained, no Unity or graph-editor code; `terrain-realistic.check.mjs` verifies it (`node assets/js/terrain-realistic.check.mjs`).
- `assets/js/menu.js` is the main menu + world select. It runs before game.js is imported: world list (`idte.worlds.v1`), create/rename/play, the animated panorama backdrop (one of `assets/images/menu/panorama-1.png` … `panorama-3.png` picked at random per launch), the clickable splash line under the title (`SPLASHES`, re-rolled on click), and the main-menu settings view (`#menuSettings`, rendered from the shared `settings.js` schema, stored in `idte.settings.v1`).
- `assets/js/pipes.js` is the grid-snapped decorative pipe system: `PipeSystem` (place, pick, removeAt, serialize/restore), one 1 m XZ cell per pipe, models `assets/models/pipes/{long,short,corner,tee}.glb`.
- `assets/js/map.js` is the map system: `MapSystem` (corner minimap + fullscreen map), per-chunk terrain tile cache, fog-of-war `seen` set, bookmarks and death spots, layer toggles, pan/zoom and marker management. Pure helpers (`chunkKey`, `worldToScreen`, `screenToWorld`) are exported; `map.check.mjs` self-checks them. The map is a **flat pixel map**: tiles are 1 texel per metre (`TILE_PX = 16`), drawn nearest-neighbour with chunk edges snapped to whole pixels, terrain is flat biome colour in stepped height bands, and buildings/containers/tanks/machines/markers are pixel blocks.
- `assets/js/block-layout-editor.js` is the grid editor (`ble.html`) for authoring machine panel layouts.
- `WORKBENCHES.md` explains items, machines and layout extension points.

### Asset conventions (all fallback-safe)
The game never breaks on a missing asset — each has a code-generated substitute:
- machine models `assets/models/workbenches/<machineId>.gltf` → missing = placeholder box
- item models `assets/models/items/<itemId>.glb` (source art; icons rendered offline)
- item icons: **any item with a model gets a rendered icon automatically** — `itemModelIcon()` in content.js resolves `<id>.glb`, workbench items use their machine's model; `ITEM_MODEL_ICON_EXCLUDE` (a blacklist, currently empty) opts an item back to its flat/generated icon. Missing files fall back to `assets/images/items/<itemId>.png`, else a generated tile. The same path is reused for the **in-hand prop** viewmodel.
  - **Gotcha:** the `<id>.png` fallback is *not* auto-discovered. If an item has no `.glb`, you must set `icon: 'assets/images/items/<id>.png'` in its `ITEM_DEFS` entry or it renders the generated code tile. (The ore icons — uranium, copper, tin, lithium, boron, beryllium — and `shotgun_shell` needed this.)
  - like ingots, items can share a base icon with a per-item `tint`; crop seeds use `assets/images/items/seed.png` tinted by their outcome
  - **plates/sheets share one texture**: every `*_plate` item (lead, copper, iron, steel, boron, zirconium and the three shielding plates) uses `assets/images/items/sheet.png` and is told apart by its `tint` — no per-plate PNG, no per-plate GLB
- machine panel layouts `assets/ui/<machineId>.json` → missing = `layoutFor(def)`
- held tool models `assets/models/tools/<tool>/<Tool>.obj` (+ `.mtl`, `Tools_Texture.png`) → missing = no viewmodel (the item still works)
- footstep clips `assets/audio/footsteps/<family>-N.ogg` (concrete/dirt/grass/gravel/metal/stairs/stone/wood) → missing = silent step
- ambient music `assets/audio/music/*.ogg` (handpicked Abstraction CC0 day tracks) → missing/broken track = skipped; MUSIC toggle and VOLUME apply
- wall panel textures `assets/textures/buildings/<tier>.jpg` (wood/brick/concrete/shielded) → missing = flat tier colour
- the building pieces ship their own icon models: `assets/models/items/{wall,floor,roof,door,triangle}_<tier>.glb`, generated by `node tools/gen_building_models.mjs` (the piece shape with the tier texture embedded). The icon renderer picks them up with no code change; bump `ICON_CACHE_KEY` in game.js after regenerating them

Real art can be dropped in later without touching code.

### index.html
Entry page for the game.
- loads the stylesheet
- loads `assets/js/main.js`, which imports `menu.js` (the main menu); `game.js` is only imported once a world is played
- contains the canvas, HUD (health/hunger/RAD/wounds), inventory, recipe browser (`#recipePanel`) with its **START HERE** strip, recipe-tree popup (`#treePanel`), the **NEXT STEP** objective card (`#objective`), the achievements panel (`#achievePanel`), the first-run field manual (`#intro`), command line, corner minimap (`#minimap`), fullscreen map (`#mapPanel`) and the menu/pause-overlay markup (including the settings rows and the **FIELD MANUAL** button)

### assets/css/styles.css
Contains the game UI styling: HUD (health/hunger/RAD/wounds), inventory, menus, workbench panels, the recipe browser, the START HERE strip, the NEXT STEP objective card, the achievements panel/grid, the bwe full and mini control cards, the recipe tree popup and the minimap/fullscreen map. All chrome uses one pure-black alpha token (`rgba(0,0,0,.55)`) with no borders, outlines, radii or bevel shadows, so stacked elements darken by alpha compositing. Active/selected states get a 50%-white outline offset 2px. The recipe tree draws its connectors as 45%-white lines (vertical per indent level + elbow into each child icon).

**Motion layer** (end of the file): every overlay panel (`#invPanel`, `#recipePanel`, `#treePanel`, `#mapPanel`, `#achievePanel`, `#intro`, `#cmd`, `#menu`, `.workbench-screen`) fades in and out. A hidden panel keeps its layout — `visibility:hidden` + `opacity:0` instead of `display:none` — so the transition can play in reverse, and the panel content slides up 12px while the backdrop fades. `#overlay` (the pause menu) fades through the `.closing` class, driven by `setOverlay()` in game.js, which delays `display:none` by the fade length. The same block adds the micro-interaction rules: hover/press feedback (45%-white outline on slots, 3px nudge on recipe cards), `:focus-visible` rings, one scrollbar look and `user-select:none` on the panels. `prefers-reduced-motion` collapses every transition.

### assets/js/main.js
Minimal loader/entry bridge that imports the main menu (`menu.js`), which in turn lazy-imports the game.

### assets/js/game.js
This is the main gameplay and world-generation file. It contains most of the logic.

### assets/images/
Texture assets used by terrain surfaces, plus `assets/images/items/<itemId>.png` item icons (missing icon = generated tile) and `assets/images/menu/panorama-{1..5}.png` main-menu panoramas (one picked at random per launch).

### assets/models/
3D model assets such as torches or other static meshes, plus `assets/models/workbenches/<machineId>.gltf` machine models (missing model = placeholder box).

## High-level structure of the game logic

### 1. Constants and world config
Relevant area in game.js:
- around the top of the file, from the constants block to lighting

Key things:
- CHUNK_SIZE
- SEA_LEVEL (kept as the terrain base-height datum; it is no longer a water level)
- WATER_OVERSHOOT (legacy water-mesh extent; unused with no surface water)
- WORLD_SEED
- SUN_DIR and global lighting

These values control map scale, terrain base height and lighting setup.

### 2. Noise and climate generation
Relevant area:
- hash3, noise3, fbm3
- climateAt()
- biomeWeights()
- biomeAt()

What this does:
- creates pseudo-random procedural noise
- computes climate bands (temperature, humidity, continentality, erosion)
- maps those values into biome weights and dominant biome IDs (ocean/shallow/beach IDs are no longer assigned; every column picks a land biome)

This is the foundation of the terrain shape and biome distribution.

### 3. Terrain generation
Relevant functions:
- terrainTrend()
- pondHere()
- terrainDensity()

What this does:
- defines the large-scale heightfield of the world
- generates the signed density field used by the terrain mesh

This is where the heightmap is shaped. There are no coastlines or ocean floor: `terrainTrend()` always builds the land plate, and `pondHere()` always returns `false` so nothing can seed surface water. Broad warped mountain belts add connected, folded ridgelines and valley incisions; exposed high mountain surfaces switch directly to stone without biome snow caps or a grass blend, and vegetation is rejected on that same rocky terrain.

World creation offers two terrain modes (`#createTerrain`, stored as `terrain` on the world record and in the save):

- **Legacy** (default) is the generator above, unchanged.
- **Realistic** replaces only `terrainTrend()`'s height source with `terrain-realistic.js`: mostly open meadow with rare, steep massifs up to ~160 m, erosion-carved valleys, and irregular groves of trees instead of uniform tree scatter. On the surface, rock comes from slope (24–40°) and snow from altitude (112–150 m), not from the old `> 30 m above sea` rule; below ground the material is banded by depth under the solved terrain surface (dirt, then stone), so caves and underground faces are not grass. The tree line is 112 m. The erosion field is baked once at spawn and rebuilt only when the player walks more than ~360 m from its centre. Map tiles use `mapColor()` so massifs read as grey rock and snow. Old worlds and saves without `terrain` load as Legacy.

### 3b. Cave systems (mouths → tunnels → caverns + buried noodles)
Relevant parts in game.js (right after `columnDensity()`):
- `CAVE_CELL` (80 m candidate grid), `CAVE_CHANCE` (0.62), `CAVE_REACH`, `CAVE_SINK` (density removed at the core)
- `NOODLE_CHANCE` (0.68), `NOODLE_REACH`, `NOODLE_DEPTH` (rock kept above a tunnel), `NOODLE_FLOOR`
- `caveHash()` / `caveSite()` / `buildCaveSite()` — one deterministic site per grid cell, generated lazily and cached; each cell rolls a sinkhole and a noodle network independently
- `caveSitesAt()` — per-column list of cave sites whose AABB covers that column
- `caveCarveAt()` — smooth 0..1 carve value (capsule tunnels + ellipsoid chambers, with rock-spike suppression)
- integration: `terrainDensity()` subtracts `carve * CAVE_SINK` inside the near-surface band

What this does:
- a sinkhole cave is a real destination instead of noise: a mouth on dry, gentle land, a near-vertical shaft, a winding tunnel, and a chamber that is a proper cavern ~38% of the time (big rooms flatten when the land is low so they never breach the surface or bedrock)
- ~45% of sinkhole caves fork into a side passage ending in a small pocket
- big caverns (room `rx >= 6.5`) grow rock spikes: 1–4 stalactites hanging from the ceiling and, about half the time, 1–3 shorter stalagmites. They are not extra meshes — `caveCarveAt()` multiplies the carve down inside each hashed cone, so a spike is simply rock the cave did not remove (deterministic, save-free, and visible to mining/collision automatically)
- **noodle caves** are closed-off networks of narrow (1.3–2.2 m radius) winding tunnels buried at least `NOODLE_DEPTH` (9 m) under the surface, with no opening: a hub chamber, 3–5 kinked arms up to `NOODLE_REACH` (26 m), occasional loops between neighbouring arms and small end pockets. They roll independently of the mouths, so they exist even where a mouth is rejected (steep cliffs, industrial pads) and make the underground much denser than the visible sinkholes
- mouths are rejected on slopes > 5 m and under industrial pads; the biome's `cave` bias thins them out (savanna = 0.35)
- the old per-voxel fbm "worm" caves are gone — they perforated the whole underground instead of making readable caves
- the shape is hashed from the cell, so it lines up across chunk borders and is never stored in the save
- cave digging is part of the density field, so mining, collision and raycasts all see it automatically; map tiles are base-terrain only and do not show caves

### 3c. Industrial sites (buildings, containers, wall masks)
Relevant parts in game.js (after the cave system):
- `IND_CELL` (96 m candidate grid), `IND_MAX_R`, `IND_FADE`, `IND_DIMS`, `INDUSTRIAL_MODELS`
- `industrialSite()` / `buildIndustrialSite()` — one deterministic site (or none) per cell, generated lazily and cached
- `industrialPadAt()` / `industrialInside()` — smooth pad weight and footprint test
- `DensityField.base()` blends the density toward `site.y0` by the pad weight, so every site sits on a perfectly flat pad
- `industrialUpdate()` / `industrialCreate()` — streams whole sites in and out around the player and rebuilds colliders
- `buildWallMask()` / `parseWallMask()` / `indApplyMaskEdits()` — 15 cm wall-occupancy mask derived from the model's near-vertical triangles (or read from `assets/models/industrial/03_garage.mask.txt`); manual edits persist in `idte.ind.masks.v1`
- `structureCollidesBody()` — continuous body-vs-box collision for industrial parts and machines (base-to-top, not just XZ)

What this does:
- about 55% of 96 m cells that are flat enough (≤ 6.5 m relief), well above the terrain datum and at least plains biome contain a site: a `building_a` or `garage` (sometimes with a `liquid_tank`) or 1–4 shipping containers, snapped to quarter turns
- pads are flattened into the density field (mining/building there persists like any terrain edit), cave mouths are rejected on them, and vegetation is suppressed inside the footprint
- sites are not saved: they are hashed from the seed + cell coordinates and rebuilt as the player streams, so they line up across reloads
- buildings collide per wall via the mask, so doorways are walkable; containers and tanks use simple boxes
- a `liquid_tank` is a **water source**: aim at it and right-click with a jerry can to fill it (`FILL CONTAINER` prompt); tanks are otherwise decorative and unlimited
- `/tp building` / `garage` / `container` / `tank` / `industrial` lands on the pad just outside a site; the map draws pad outlines and type labels

### 3d. Vegetation and harvestables
Relevant parts in game.js:
- `VEG_DIR`, `VEG_LAYERS` (`canopy` 6 m, `ground` / `floor` 2 m, `cover` / `aquatic` 3 m cells), `VEG_SPECIES`
- `vegCell()` / `vegResolve()` / `vegStream()` / `vegUpdate()` / `vegAnimate()` / `vegUpdateInstances()` / `vegRebuildTrunks()` / `vegFalling()`
- `_vegHarvested`, `vegParentNear()`, `groundDepth()`
- pickups through `registerPickup()` and the `pickup` field on a species

What this does:
- each grid cell rolls a biome-weighted species from the list: PS1 trees and dead trees, grass, herbs, flowers, ferns, moss, bamboo, reeds, duckweed and leaf litter
- placements are deterministic from seed + cell, then resolved against live terrain (surface normal slope, cave intersection, industrial pads); rejected spots are cached so they are not retried every frame
- the `aquatic` layer and its species (reeds, duckweed, iris) are still defined but never place: they require a water surface, and the world has none
- rendering is instanced and streamed in species-sized rings; trees keep real trunks for chopping and collision, and litter only appears under suitable parent trees
- ground plants with `pickup` register crosshair pickups (`herb`, `flower`) gated by gardening gloves; harvested cells are remembered in `_vegHarvested` so they do not respawn
- mining dirt while wearing gardening gloves has a luck-based chance to drop a random crop seed (herb, flower, wheat, potato, carrot, tomato, corn, cabbage, onion, peas, spinach, cucumber, eggplant, bell pepper, rice) for the greenhouse
- hitting a tree can shake loose fruit (`TREE_FRUITS` = apple/orange/pear, `TREE_FRUIT_CHANCE` = 10%)
- **savanna plants wear the colour of the ground they grow on**: the textured plants get a per-instance tint (`instanceColor` on the card mesh) taken from the mean pixel of the biome's dry grass texture (`assets/images/dry.jpg`), converted to linear space and scaled so its strongest channel is 1 — a hue shift towards the dry grass, not a dimming (`assets/js/veg-tint.js`, `node assets/js/veg-tint.check.mjs`). Model vegetation (trees, ferns) keeps its own art
- streaming is budgeted: at most 6 species' instance buffers are refreshed per frame

### 4. Density field and chunk mesh generation
Relevant classes:
- DensityField
- Chunk

What this does:
- stores procedural and edited density data
- rebuilds chunk meshes for terrain blocks
- updates the visible geometry for each loaded region around the player

The world is broken into chunks so only nearby regions are processed.

**Rebuilding a chunk** (game.js):
- a chunk mesh is built from the chunk's own voxels plus the **one voxel frame** it samples around itself, so an edit only dirties the chunks the edited box overlaps plus the neighbour chunk on each side where the box reaches a chunk border (`dirtyRange()`); the old code padded every axis by a whole chunk and queued up to 27 rebuilds for one mined block
- the **sample grid** (18³ density values) is the expensive part: it is loaded in **slices** of `SAMPLE_SLICE` samples (`Chunk.loadSlice()`), so one chunk build can never eat a whole frame; chunks that are still filling their grid wait in `world.loading`
- an edit only changes a few voxels, so a chunk that is already loaded re-reads just the edited ones (`Chunk.refreshPending()`, fed by `markEdited()` / `noteEdited()`) instead of the whole grid
- `DensityField.valueAtPadded()` reads the density without the shared base cache: the chunk's own grid is the cache, and the industrial pad (which only depends on x and z) is looked up once per column of the grid
- `terrainDensity()` only evaluates the detail noise inside the band it can actually move the surface in; outside it the sign of the density is fixed by the trend alone, which is what made a chunk build cost 12 ms
- a chunk that sits entirely above the surface of its column is plain air and produces no mesh, so it is never loaded (`canHaveMesh()`)
- check: `node assets/js/chunk-dirty.check.mjs` (the dirty range against the chunk frame rule, the sliced loader against the plain nested loop, the incremental refresh)

### 5. Surface water (disabled)
Relevant parts:
- WaterSim class
- pondAt(), surfaceOf(), floorAt(), canHold()
- update(), step(), seed()

What this does:
- the finite-volume water simulation still exists in the code but is dormant: `pondHere()` always returns `false`, so no column is ever seeded, and nothing can add water to the world (pouring discards it)
- `waterAt()` therefore always returns 0; swimming, underwater fog and the reactor's adjacent-water cooling never trigger
- **water is a container resource only**: fill a jerry can from an industrial `liquid_tank` or from the powered `water_pump` machine

### 6. Water rendering (dormant)
Relevant parts:
- waterMaterial shader
- rebuildWater() in Chunk
- waterUniforms

What this does:
- the water mesh path still exists (`Chunk.rebuildWater()` is called for low chunks), but with no simulated water columns it always produces an empty mesh
- `assets/js/map.js` no longer paints water tiles and the fullscreen map has no WATER layer

### 7. World streaming and updates
Relevant parts:
- World.update()
- World.processDirty()
- World.processWaterDirty()
- World.markRegionDirty(), markColumnDirty(), markWaterDirty()

What this does:
- loads nearby chunks around the player
- unloads distant ones
- rebuilds terrain meshes in bounded work budgets to keep the game performant (the water rebuild queue stays empty)

This is how the world feels continuous without having to build everything at once.

### 8. Player, spawn, and input
Relevant parts:
- player object
- movePlayer()
- spawnOnGround()
- validSpawnPos()
- playerCollides() — samples the full body height, including eye level and the top of the head, so cave ceilings cannot be jumped through

What this does:
- handles movement and camera behavior
- ensures player spawn points are valid on solid ground (nothing is underwater any more)
- keeps the player standing on solid ground

### 9. Mining / placing / world edits
Relevant parts:
- mine(), place(), mineAnimated()
- density field edits and markRegionDirty()
- `mineAim()` (terrain ray, `REACH` = 7 m), `raycastTerrain()`
- `resolveInteractTarget()` / `useInteractable()` / `refreshInteractPrompt()` — opening machines and pickups
- `raySphereHit()` — ray/sphere test behind the interact prompt

What this does:
- lets the player carve blocks into the terrain
- lets the player place items or terrain blocks
- marks affected regions dirty so chunk geometry rebuilds
- right-click opens whichever machine/pickup the crosshair hits, up to the same `REACH` as mining (7 m)
- while a workbench item is held, `updatePlacePreview()` shows a translucent, flashing ghost of the machine at the target spot (red where placement is blocked)

### 10. Rendering and frame loop
Relevant section:
- frame() function
- camera setup
- world.updateWater()
- world.processDirty()
- underwater fog / color blending

What this does:
- executes the main game loop
- updates movement, world generation and chunks (the water sim tick is still called but has nothing to simulate)
- keeps the camera synced with the current world state; the underwater fog checks are unreachable

### 11. Item and machine catalogue
Relevant parts in content.js:
- `ITEM_DEFS`, `MACHINE_DEFS`, `MACHINE_BY_ID`
- `CRAFT_RECIPES`, `TABLE_RECIPES`, `TABLE_OUTPUTS`
- `DEPLETED_OF`, `layoutFor()`, `TUNING`

What this does:
- defines every item and machine as plain data (no per-machine code)
- pairs each machine with a placeable block item (`item.workbench -> machine.id`)
- declares recipes: `CRAFT_RECIPES` are option-based (available as soon as the bag has the ingredients) and carry a `time` — machine blocks craft in 10 s, everything else in 2 s, tunable per recipe; machine `recipes` run inside the machine
- `TABLE_OUTPUTS` is the whitelist of recipes the pocket table can make
- maps spent fuel to its depleted form for the reactor
- content tiers: firearms (fast AR, SMG, shotgun shells), electronics chips (craftable in the bag, consumed by the assembler tier), consumables (juice, iodine, NEUROZAM-9, cigarette packs, oven dishes), liquids, wood tools and the water pump
- **farming and cooking**: the `greenhouse` (unpowered processor) grows seeds into crops (herb, flower, wheat, potato, carrot, tomato, corn, cabbage, onion, peas, spinach, cucumber, eggplant, bell pepper, rice; 2 min for herb/flower, 12 min for the rest, 1 seed → 2 produce); seeds are a lucky drop from mining dirt with gardening gloves. The `oven` (powered processor) cooks dishes such as chicken soup, roasted bowl of veg, ratatouille, herbed flatbread, stuffed bell peppers and rice bowl. Seed items use the shared base icon `assets/images/items/seed.png` with an outcome-based `tint` (ingot-style)
- **water sources**: industrial `liquid_tank` parts (unlimited, fill a held can) and the powered `water_pump` machine (`kind: 'pump'`, right-click a held can to pump 5 L for 30 PU)
- late-game tiers: **research blueprints** gate the reactor/fusion/scrubber/containment tier, **fusion fuel** burns in a second reactor, and the **atmospheric scrubber** is a powered ambient-dose sink

Changing gameplay content means editing this file, not game.js.

### 12. Day clock and ambient radiation
Relevant parts in game.js:
- `clock = { day, t }`, `TUNING.DAY_SECONDS` (900s = 15 real minutes/day)
- `ambientRad()`, `radStage()`, `isDay()`
- `radField()` / `radTransmission()` — directional field (§12c)
- `doseRate()`, `paintRad()`, radiation post-FX uniforms (`uRadBlur`, `uRadDark`, `uTime`)
- `die()`, `deathT`, `#deathBanner`

What this does:
- advances day/time and, from day 3 (`TUNING.RAD_START_DAY`), ramps ambient radiation continuously and superlinearly; dose also decays very slowly (`0.05 rad/s`) after 30 s with no intake
- tracks **absorbed dose in rad** (1 rad = 0.01 Gy); rates use real SI-prefixed units (`nrad/s`, `µrad/s`, `mrad/s`, `rad/s`) through `formatRad()` / `formatRadRate()` in content.js
- scales the RAD meter to the human whole-body lethal dose: `TUNING.RAD_LETHAL_DOSE` (600 rad) is 100%, with an **LD50 tick at 450 rad** and ARS onset at 100 rad
- turns accumulated dose into a stage (`SLOWED / BLURRED / CRITICAL / FATAL` at 100/250/450/600 rad) that scales move speed and drives lens blur/darkening
- kills the player at the lethal dose: **everything carried drops where you died**, then you respawn at 0,0

This is the core pressure loop — the reason shielding and machines matter.

### 12b. Vitals, wounds and hunger
Relevant parts in game.js:
- `vitals = { hp, maxHp, hunger, maxHunger, wounds, infectionImmunity }`
- `WOUNDS`, `addWound()`, `cureWounds()`, `hurt(amount, type)`, `woundSpeed()`, `updateVitals(dt)`
- HUD meters `#hpFill` / `#hpNum`, `#hungerFill` / `#hungerNum`, wound chips `#wounds`; `paintVitals()`
- `TUNING.HUNGER_DRAIN` (0.07/s); consumable fields `food`, `heal`, `cures`, `immunity`
- `updateHungerSmile(dt)`, `spawnHungerSmile()`, `removeHungerSmile()` and the smile billboard (`assets/images/smile.webp`)

What this does:
- health and hunger are real survival meters: hunger drains continuously, at 0 it deals 0.6 dps, and above 40 with no active damage the player regenerates 0.6 hp/s
- wound/status types are `bleeding`, `infection`, `burn`, `poison`, `pain`, `eye`, `respiratory`, `bloodloss`, `paranoia`; the physical wounds carry dps, a speed multiplier and/or a blur amount, while `paranoia` is a status card with no direct damage
- wounds stack; bleeding/burn lasting over 30 s can roll an infection, which `infectionImmunity` blocks; hits of 12+ damage also add pain
- wounds slow movement (`woundSpeed()`) and some blur the view; consumables can heal, feed, cure specific wounds or grant temporary infection immunity
- **night hunger / paranoia:** while it is night and hunger is below 50, `PARANOIA` is shown and a glowing billboard face (`smile.webp`, unlit, spawned above terrain/trees in front of the player) can appear; it stays until day (or until a jumpscare). Staring at it for ~6 seconds triggers a jumpscare (it dashes through the camera) and it will not auto-respawn that night
- sandbox mode pins health/hunger full and clears wounds; survival death still routes through `die()` and the drop-everything respawn
- vitals are saved with the world and exposed on the debug handle as `vitals` / `hurt` / `addWound`

### 12d. Base building: wall panels that shield radiation

Relevant parts:
- `assets/js/building.js` — `BuildingSystem` (pieces, cells, meshes, collision, shadow march, snapping) plus the pure helpers `shadowCells()`, `snapPlan()` and `meshKey()`
- `assets/js/build-tiers.js` — `BUILD_TIERS` (wood / brick / concrete / shielded concrete), `BUILD_TIER_ORDER`, `BUILD_UPGRADES` (the material cost of upgrading one tier)
- `assets/js/pieces/` — **one module per piece kind** (`wall.js`, `floor.js`, `roof.js`, `door.js`, `triangle.js`); each exports `KIND` (the geometry), `ITEMS` (the item defs) and `RECIPES`. `pieces/README.md` is the contract, `pieces/registry.js` maps kind names to kinds, and each kind has its own `pieces/<name>.check.mjs`
- `assets/js/pieces/registry.js` — `KINDS`, the name → kind table the runtime uses
- `assets/js/pieces/placement.js` — the shared placement maths: `baseAt()` (the highest cell base under the columns a shape really occupies), `anySupport()` (any bottom cell with real face contact holds a vertical or partial piece) and `edgeSupport()` (a full straight edge, not one arbitrary block, holds a 3 × 3 slab). Cell occupancy alone is not support: a thin panel may sit on the other side of its cell, and a short slab may not reach its top.
- content.js spreads the piece `ITEMS` into `ITEM_DEFS` and the piece `RECIPES` into `CRAFT_RECIPES`, so **a kind module never edits content.js**; an item with `table: true` joins the pocket table automatically
- items: `{wall,floor,roof,door,triangle}_{wood,brick,concrete,shielded}` (field `building: { kind, tier }`) and the `hammer`
- game.js: the `building` branch of `doPlace()`, `buildingTarget()` (the snapped target, shared by the ghost and the placement), `buildingBlocked()` (canPlace + support + machines + the player body), `useBuildingUpgrade()`, the wall branch of `doMine()`, `updateWallPreview()`, `playerCollides()`, `radTransmission()`, the `buildings` save field
- textures: `assets/textures/buildings/{wood,brick,concrete,shielded}.jpg` (missing file = flat tier colour)
- map.js: a **WALLS** layer draws every piece in its tier colour on the minimap and the fullscreen map
- checks: `assets/js/building.check.mjs` (the planner), `assets/js/building.mesh.check.mjs` (one mesh per kind), `assets/js/building.snap.check.mjs` (the pieces really placed), `assets/js/building.intent.check.mjs` (game.js's own placement bodies, extracted from the source and run in node) — all `node` only, no browser; `assets/js/three-stub.mjs` is the three.js stand in the last three use

What this does:
- a **wall panel** is a 3 m × 3 m × 0.25 m slab that snaps to the pieces around it (`R` rotates through the four flush layouts), not to the world grid. It is its own geometry, not terrain: one `InstancedMesh` per (tier, **kind**) pair, textured with the tier photo, and it blocks the player (`playerCollides()` asks `buildingSystem.collidesBody()`, a cylinder against the piece boxes — eight point samples used to slip between a thin panel and a low deck)
- a piece owns a block of grid cells and every cell carries a **slice of the piece's box**, so the shadow march can attenuate per slice instead of stepping over a 25 cm panel
- **the attenuation law** is exponential per metre of material (`BUILD_TIERS[tier].transmission`): wood 0.55, brick 0.25, concrete 0.06, shielded 1e-8 (lead lined). One 0.25 m panel therefore blocks 14% / 29% / 50% / 99% of the field
- because the law is exponential the *fraction* blocked is constant while the absolute rad saved scales with the field — shielding buys margin, it never switches radiation off, and `TUNING.RAD_OCCL_FLOOR` still applies
- **honeycomb is free**: stacked layers multiply, so two concrete layers block 75% and three shielded layers block 99.99%
- `shadowCells()` is a 3D-DDA over the cell grid that intersects the ray with each piece's box and multiplies `transmission ^ length`. `radTransmission()` multiplies it with the terrain march, so **pieces shield the ambient field and every machine emitter alike**
- the Rust-like verbs: **build** (hold a piece item, a ghost preview snaps to the target cell, red where refused), **upgrade in place** (right-click a piece with the `hammer`, the next tier's materials are taken from the bag, never downgrade), **demolish** (hammer left-click removes it and refunds the item). Pieces stack on other pieces; a piece on the ground needs solid ground under it
- the preview is the piece's own shape (`updateWallPreview()`) in its tier colour with the silhouette outlined in white — the same `pieceEdgeGeometry()` outline, red when refused, traces the piece under the crosshair while a BB item or the hammer is held, so a wedge previews as a wedge and a doorway as a doorway instead of a solid box
- pieces are saved with the world (`buildings` in the save file) and restored on load

### 12d-b. The piece kinds (wall, floor, roof, door, triangle)

Each kind is one module in `assets/js/pieces/`, and each is its own shape, support rule and mesh:

| kind | file | shape | notes |
|---|---|---|---|
| `wall` | `wall.js` | 3 m × 3 m × 0.25 m slab, runs along X or Z (`rot: 4`) | the reference implementation; one `InstancedMesh` per tier. The four rotations are two directions × two sides to hug, and the panel always ends on a cell boundary so it sits flush |
| `floor` | `floor.js` | 3 m × 3 m deck, **one whole cell thick** (9 cells) | its walking surface is the top of its cell, so a wall on a deck and a deck on a deck are flush. `base()` snaps onto the highest base under the columns it occupies (`baseAt`); `support()` needs a **full straight edge** under it (`edgeSupport`) — one block cannot balance a 3 × 3 deck — and refuses a floating deck |
| `roof` | `roof.js` | 3 m × 3 m **barn roof** (flat soffit, eaves, flat ridge strip) | custom geometry `geom: 'roof_gable'` + `rotY(rot)` (ridge along X or Z); a whole row or column of the panel must rest on something below, so it may overhang but never float (`edgeSupport`). `base()` takes the highest thing under its whole 3 × 3 footprint, so a roof that hangs over a wall rests on that wall |
| `door` | `door.js` | 1 m wide × 3 m tall × 0.25 m thick | `dynamicSolid: true`: solid while shut, passable while open, and it only shields radiation while shut. Own geometry key `door` so the swing can be animated on its own mesh |
| `triangle` | `triangle.js` | **half** of a 3 m × 3 m square, 0.25 m thick | a real triangular prism (`geom: 'triangle'`), the right angle walks through the four corners as `rot` goes 0..3 (`rot: 4`, `rotY(rot)`). Cell boxes come from the same local frame as the mesh, so they cannot drift apart |

Item ids: `wall_*`, `floor_*`, `roof_*`, `door_*`, `triangle_*` × the four tiers. The wood one of each is `table: true` (pocket table); the rest are manufactory crafts.

**Doors** (game.js): `doorHit()` / `doorUnderCrosshair()` ray-test the door's own cells (a shut door is hit by its panel, an open one by the whole doorway so it can always be shut again); `handFreeForDoor()` refuses when a tool or consumable is in hand, so the hammer (which upgrades and demolishes) never opens a door; `toggleDoor()` flips `piece.open` and `updateDoorSwings(dt)` rewrites the door mesh's instance matrices every frame, turning the panel about its hinge (`swingFrame()` in `door.js` gives the hinge edge) and updating its bounding sphere so the raycast still finds it. The crosshair prompt reads `DOOR · RIGHT CLICK / OPEN / CLOSE DOOR`.

**Triangle collision** is an approximation: the diagonal cuts three cells corner to corner and no axis-aligned box can follow it, so a cut cell gets a half-cell rectangle — the solid half is fully covered (the player cannot walk into the wedge) at the price of over-covering a sliver of the open half.

### 12d-b-b. Snapping: pieces line up with each other, not with the world grid

The piece you aim at is the **anchor**, and the new piece is laid flush against it on the anchor's own lattice:

- `snapPlan(fps, af, p, dir, wantRot, face)` (building.js) is the pure planner: it takes the anchor's footprint, the aim point, the ray and the **hit face**, and returns the candidate cells in order of preference. `BuildingSystem.snap()` adds the raycast against the placed meshes and the placement checks.
- `BuildingSystem.pick()` is that raycast: it returns the piece, the hit point and the **face normal** (the instanced mesh's local normal, rotated by the piece's own yaw — the mesh's quaternion is shared, the instance's is not).
- the **abutment axis** comes from the face that was hit, not from the camera: looking at a face puts the new piece flush against that face, on the side the player stands on; looking down puts it **on top** of the anchor, hugging the edge that is looked at. A diagonal glance therefore stays on the surface the player targeted instead of sliding onto the camera's dominant axis.
- **R is an instruction, not a preference**: the planner never rotates or relocates a piece to a different socket because the requested one is inconvenient. An occupied socket stays occupied and the ghost turns red there.
- a **flat piece aimed at the top of a wall lies over it**: a roof or a floor looked at along the top edge of a wall rests on that wall and reaches out in the direction that is looked at (the wall's own cells carry its edge). The roof's `base()` therefore looks at its whole 3 × 3 footprint, not just its own column, or it would drop to the ground.
- the **rotation** is picked so the new piece is as wide as the anchor along the other axis (a panel lies along a floor's edge, a panel continues a panel run), and so it lands exactly on a cell boundary — that is what makes the joint flush instead of a quarter metre off.
- `kindFootprint()` / `pieceFootprint()` give the offset and the size of a kind inside its cell, so the planner needs nothing from the kind module but its `cells()`.
- on bare ground (no anchor) the placement falls back to the world grid, using `groundBase()` — the terrain height only, so an unrelated nearby wall cannot lift a ground placement onto its roof.

**Flush sides**: the wall and door kinds have four rotations — two directions × the side of the cell the panel hugs — and the panel always ends exactly on a cell boundary (`wall.js` / `door.js`). That is what lets a wall sit flush against the edge of a deck.

**One mesh per kind**: `meshKey(piece)` is `tier|kind`, so a wall and a floor of the same tier are drawn in **different** `InstancedMesh`es. A mesh draws every instance with the shape of its first piece, so a shared mesh would draw a wall flat like a floor — and the raycast the snapping depends on would hit the wrong geometry.

**Checks**: `node assets/js/building.check.mjs` (the planner), `node assets/js/building.mesh.check.mjs` (one mesh per kind), `node assets/js/building.snap.check.mjs` (the pieces really placed: a roof over a wall, its base and its support) and `node assets/js/building.intent.check.mjs` (game.js's own `buildingTarget` / `buildingBlocked` / `updateWallPreview` / `doPlace` bodies, extracted from the source and run in node). `assets/js/three-stub.mjs` is the tiny three.js stand in the last two use.

### 12d-c. Adding a new piece kind

1. write `assets/js/pieces/<name>.js` exporting `KIND`, `ITEMS` and `RECIPES` (the contract is `assets/js/pieces/README.md`)
2. add it to `assets/js/pieces/registry.js` (one import, one entry)
3. write `assets/js/pieces/<name>.check.mjs` — pure geometry assertions, `node` only
4. never touch `building.js` or `content.js`: the runtime is kind-agnostic

### 12c. Directional radiation (a source spot, and walls in the way)

Relevant parts:
- `assets/js/radiation.js`: `sourcePoint(seed)`, `transmission(factorAt, …)`, `RAD_OCCL` (`samples` 24, `range` 24 m, `solid` 0.62), `relativeBearing()`, `compass()`
- game.js: `radSource()`, `radFactor()`, `radTransmission()`, `radField()`; `doseRate()` now reads `radField().ambient` + `radField().machine` instead of a flat `ambientRad()` + `localRad()`
- content.js `TUNING`: `RAD_SOURCE_DIST` (240 m from the world origin), `RAD_OCCL_FLOOR` (0.2 — terrain alone never shields more than 80% of a field)
- `assets/js/radiation.check.mjs` (`node assets/js/radiation.check.mjs`)

What this does:
- radiation has a direction: the ambient field is attributed to a fixed **fallout spot** derived from the world seed, and every radiating machine is its own point source, so dose always comes *from* somewhere
- shadowing is **not raytracing**: a fixed 24-step march over the first 24 m toward the source (one sample per metre), each solid metre keeping 62% of the radiation
- the march reads the density field, so terrain **and placed blocks** already shield the player: a wall between you and the source cuts the dose, a wall behind you does nothing. `radFactor()` is the hook future wall materials plug into (return a smaller factor for lead or concrete)
- machine radiation is shadowed **per emitter**, so a reactor behind a wall — or a floor between you and it — radiates far less than one in the open
- the RAD meter shows an arrow pointing at the dominant source with its compass bearing and distance; the arrow hides while nothing radiates
- the field is cached for 100 ms, so the march costs one sample set per tenth of a second, not one per frame

### 13. Mining, ore bands and hand tools
Relevant parts:
- `BARE_HANDS` (radius/rate/yield, can only break dirt/grass/stone)
- `mineOreDrop(band, y)` — depth-dependent ore table
- `hasGardeningGloves()` — gates plant pickups
- `doMine()`, `resolveInteractTarget()`, `activate()`, `heldTool()`
- `ITEM_DEFS` tools in content.js: `pick`, `shovel`, `drill`, plus the steel woodsman's tools `axe`, `hatchet`, `hoe`

What this does:
- lets a cold start bootstrap: bare hands mine enough to gather the first ore and carbon
- yields different ores by depth band
- requires gloves for vegetables, and refuses the pickup (with a notice) otherwise
- mining dirt while wearing gardening gloves has a luck-based chance to drop a random crop seed (greenhouse crops)
- `pick` also carries a weak `chop` so wood is obtainable before the steel axe; its `tool.stone: 3` triples the stone dropped per hit (ores keep their normal rate)
- `axe` / `hatchet` are steel (steel ingot + wood) and chop trees; `hoe` is steel with no special function yet

### 13b. Held tool viewmodel
Relevant parts in game.js §9d:
- `TOOL_MODELS` (item id → PS1 OBJ + MTL), `orientTool()` (grip at origin, head forward)
- `viewScene` / `viewCam`, `vmRig` / `vmSwing`
- `updateViewmodel(dt)`, `triggerSwing()`, `vmSwingCurve()`

What this does:
- shows the held `pick` / `shovel` / `axe` / `hatchet` / `hoe` as a first-person model
- sway/bob while walking, smoothed look sway, equip raise, and a windup→strike→recover swing tied to `tool.rate`
- rendered in a separate depth-cleared pass so terrain never clips through the tool; still gets the PS1 post-FX

### 13c. Tree chopping
Relevant parts in game.js §10c:
- `chopTarget()` (analytic ray-vs-trunk-cylinder, reach from `tool.chop`)
- `chopTree()` — splits the model at the struck height with `clipPiece()`
- `updateChop(dt)` — topple physics, ground contact, settle, shrink-out, wood drops
- `despawnTree()`, `removeDyn()`, `chopFall[]`

What this does:
- an axe/hatchet/pick hit cuts the trunk where you struck it
- the part above the cut becomes a rigid piece hinged at the cut, topples away from the player, bounces once and settles
- after a short rest it shrinks out and drops `wood` on the ground
- the remaining lower section becomes a shorter, recuttable stump; chopped cells are added to `_vegHarvested` so they don't respawn
- the stump is removed when the player travels far away; all cutting is geometry-based on the tree's normalized model

### 13d. Item icons and held props
Relevant parts in game.js:
- `itemModelIcon()` (content.js), `modelIconSource()`, `renderModelIcon()`, `initModelIcons()`
- `ICON_CACHE_KEY` (`idte.icon.v3.`), `modelIconCache` (data URL / `''` = tried-no-model / `null` = untried)
- `itemIconUrl()`, `propModelUrl()`, `loadPropModel()`, `PROP_POS` / `PROP_SIZE`
- `vmHeld` / `heldIconTexture()` / `showHeldIcon()` — two-handed flat-icon fallback for items with no model
- `TOOL_MODELS` still overrides for hand tools (OBJ + MTL, §13b)

What this does:
- **no whitelist**: every item resolves an icon source automatically (`assets/models/items/<id>.glb`, workbenches use the machine model); render once isometrically and cache the PNG in IndexedDB
- a failed load is cached as `''` so the item falls back to its PNG/generated tile and isn't re-probed; bump `ICON_CACHE_KEY` to re-render after adding art
- non-tool items with a model are shown **in hand** as a spinning/bobbing prop on the viewmodel rig; tools use the swing rig instead
- non-tool items **without** a model are still held: a flat icon sits low and centred as if gripped in both hands, bobbing with movement but never spinning (it also covers the short window while a real model loads)

### 13e. Placeable lights
Relevant parts in game.js:
- `torches` registry (torch / lantern / floodlight entries; each carries `light { mount, range, power, color }`)
- `torchLights` / `TORCH_LIGHTS` / `TORCH_LIGHT_GAIN` / `refreshTorchLights()` — a fixed pool of real `THREE.PointLight`s
- `torchMesh()` / `addTorch()` / `tryTorchPlace()` / `updateTorches()` / `solidAt()`

What this does:
- item defs opt into `torch: true` + `light` (content.js); `mount` is `wall` (side faces only) or `floor` (ground only)
- torches, lanterns and floodlights all use the same placement, save/load and despawn path; only their light numbers differ
- lighting is standard three.js: 8 `PointLight`s exist from boot (`distance` = `light.range`, `decay` 2, `intensity` = `light.power × TORCH_LIGHT_GAIN`) and are moved onto the nearest 8 torches, so terrain, machine models, building pieces, vegetation and enemies are all lit by the same lights with no per-material shaders
- unused pool lights stay visible with intensity 0, so the light count never changes and materials are not recompiled when a torch comes into range
- the pool is the nearest 8 lights to the player; raise `TORCH_LIGHTS` only if more torches than that need to be lit at once

### 13f. Ore regions (one seam per chunk)
Relevant parts:
- `content.js`: `ORE_REGION_SIZE` (16 = one chunk), `regionOre(x, z)`, `REGION_ORE_IDS` / `REGION_ORE_WEIGHT`
- game.js `mineDrops(band, y, x, z)` and machines.js `seamAt(m)`

What this does:
- ore is not spread evenly: every 16×16 patch has one dominant ore, hashed from its chunk coords (deterministic, no storage)
- hand mining always yields the block itself (stone/dirt) and rolls the local seam on top — 30% (`MINE_ORE_CHANCE`), half that on barren ground via the depth table
- the excavator yields **only** its seam, so you sample a chunk (mine a block) and build the excavator on the good one

### 13g. Excavator, its storage and animation
Relevant parts:
- `MACHINE_DEFS.excavator`: `outputs: 9` (internal storage), `drillRate`, `spin: 'cylinder'`, `spinRate`, `sink`
- machines.js `tickExcavator()`, `hasOutputRoom()`, `addOutput()` (both honour `def.outputs`), `place()` (`inst.spinNode`)

What this does:
- the digger wheel (`cylinder` node in `excavator.gltf`) **only turns while the machine is drilling** — it spins on its own axle, `def.spin` names the node so any model can opt in
- ore falls straight into the machine's own 9 slots (no chest, no cables needed to collect); a full storage reads `OUTPUT FULL` and stops the wheel
- the panel reports the seam being cut (`DRILLING IRON ORE` / `BARREN GROUND`)

### 13g-b. Bucket wheel excavator (BWE)
Relevant parts:
- `MACHINE_DEFS.bucket_wheel_excavator` (`kind: 'bwe'`, `outputs: 64`, `energy.use: 350`, `bwe: { boomPivot, mast, boomAnchor, ropeSpan, ropeCenter }`) and `assets/models/workbenches/bucket_wheel_excavator.gltf`
- item defs `bucket_wheel_excavator` (workbench item) and `bwe_controller`; recipes live in the assembler, the blueprint in the research lab
- machines.js `setupBwe()`, `updateBweRope()`, `tickBwe()`, `digBwe()`, `controlBwe()`; workbench-ui.js `buildBwe()` / `renderBweDynamic()`; layout type `bwe`

What this does:
- the GLTF's `frontboom` and bucket-wheel group (`bw`) are re-parented under one pivot at the boom root, so boom up/down carries the wheel; `wheel.rotateY()` spins the buckets; yaw rotates the whole house
- `ropetofrontboom` is re-stretched every frame between the fixed mast and the moving boom tip, so it stays visually attached while the boom moves (`ropeSpan` / `ropeCenter` match the model's 14-unit rope)
- right-clicking with `bwe_controller` links to the nearest BWE within 128 m and opens its panel; controls are yaw, boom up/down and a wheel on/off toggle
- `MINIMIZE` hides the full panel and leaves a compact bottom-right control card visible over the world (yaw/boom/spin, live readouts); `EXPAND` returns to the full hold UI and `×` closes the controls and returns to play
- yaw and boom use a target pose plus a heavily smoothed render pose (`yawCur` / `boomCur`): inputs are tiny nudges, the house turns at roughly 12°/s and the boom at roughly 4°/s, and it eases to a stop like a machine with real mass
- a spinning, powered wheel samples 28 rim points, carves the terrain they touch and rolls `mineDrops()` for the removed voxels (same drops as hand mining), capped at 260 voxels per 0.16 s tick
- loot lands in the BWE's own 64-slot hold, shown as an 8-column scrollable grid; a full hold shows `OUTPUT FULL` and stops digging
- no flatten pad: the machine is placed on the surface as-is, so the huge tracks sit on uneven ground

### 13h. Test bench (portable battery power)
Relevant parts:
- `MACHINE_DEFS.test_bench` (`kind: 'generator'`, `battery: { life }`), `ITEM_DEFS.car_battery.battery`
- machines.js `tickBattery()`; `layoutFor()` `def.battery` branch

What this does:
- no cables, no fuel chain: drop a car battery in the slot and it outputs 150/s for 180 s, then the cell is spent
- stackable/pickable, so you can carry power to a test site (auto-links to machines within 2.2 m) and craftable from the pocket table

### 13h-b. Hand crank (manual bootstrap power)
Relevant parts:
- `MACHINE_DEFS.hand_crank` (`kind: 'generator'`, `manual: true`, `energy.gen`, no `capacity`), `ITEM_DEFS.hand_crank`
- machines.js manual-generator branch in `update()`; `crank()` spins the handle for 2 s on right-click (`open()` never opens a panel for manual machines)
- recipe: iron ingots + copper ingot + wood, available from the pocket table

What this does:
- the first non-radioactive power source: no fuel, no battery, no rad
- power is only made by right-clicking the machine: each click is one turn of the handle and the crank **feeds the grid while it spins** — it has no buffer of its own, so unused power is not banked; machines keep only their own small local buffers
- shows `CRANKING` / `IDLE`

### 13i. The Wrapper (night enemy) and wasteland radiation
Relevant parts:
- `assets/models/enemies/wrapper.glb` — rigged monster with six clips (`idle`, `walk`, `run`, `attack`, `scream`, `slam`); `wrapper_diffuse.png` is the source texture (the GLB embeds it)
- game.js `WRAPPER` / `Wrapper` class (extends `Walker`), `wrapperTemplate`, `cloneSkeleton` (SkeletonUtils)
- game.js `WRAPPER_SPAWN` / `spawnWrapper()` / `updateWrapperSpawns()`
- `TUNING.WASTELAND_RAD` in content.js; biome check in `doseRate()`
- `doMine()` wrapper hit test; **G** spawns one for debugging

What this does:
- the Wrapper reuses the Walker's ground-following movement and adds a skinned model, animation mixer, yaw-facing and a distance state machine (walk > 18 m, run < 18 m, attack < 2.2 m, occasional distant scream); the model is authored Z-up at ~175 units, so it is scaled 0.01 and stands 1.75 m
- spawning is rolled on a timer, not per frame: normal biomes only at night (`isDay()` false), 35% per 9 s, capped at 2; the wasteland spawns them 24/7 every 6 s, capped at 5 (they stay in wasteland when you are in wasteland)
- they claw for bleeding damage, are despawned beyond 96 m, and take tool hits (a swing aimed at one hits it before terrain; ~5 hits kills it)
- standing on wasteland ground adds `WASTELAND_RAD` (0.35 rad/s) on top of ambient, day or night, with a one-time `WASTELAND · HOT GROUND` notice when crossing the biome edge

### 13j. C4 demolition
Relevant parts:
- `ITEM_DEFS.c4` (`c4: true`, stack 8); assembler recipe (`rdx`, detonator, plastic, timer module, card reader)
- game.js `C4_FUSE` (5 s), `C4_RADIUS` (3.4 m), `C4_BLAST` (12 m), `c4Charges`, `c4Mesh()`
- `useC4()` / `placeC4()` / `detonateC4()` / `updateC4()`, `beep()` / `boom()` / `c4Audible()`

What this does:
- right-click with C4 places a charge on any ground-ish surface within reach, then it beeps with an accelerating cadence for 5 s
- detonation carves a 3.4 m sphere out of the density field, rolls the normal mining drops for every removed voxel, and spawns them on the crater floor
- machines within the blast are removed, nearby charges chain-detonate, and the player takes up to 70 damage (burn) plus 45 rad at point blank, falling off to 12 m; the blast also shakes the camera
- sandbox mode still places and detonates C4, but `hurt()` leaves health at max

### 13k. Ambient day music
Relevant parts:
- game.js `AMBIENT_TRACKS` / `AMBIENT_FADE` / `AMBIENT_LEVEL` / `AMBIENT_GAP` / `AMBIENT_SILENCE` / `AMBIENT_SILENCE_CHANCE`
- `startAmbientTrack()` / `updateAmbientMusic()` / `ambientCooldown` / `ambientAudio`
- `#nowPlaying` / `#nowPlayingName` now-playing card
- `assets/audio/music/*.ogg` (handpicked Abstraction CC0 tracks; license note in settings)
- `music` and `volume` settings in `assets/js/settings.js`

What this does:
- plays handpicked day-only ambient tracks (`AMBIENT_TRACKS`, 5 Abstraction CC0 OGGs) at `AMBIENT_LEVEL` with a 12 s day/night fade
- picks a random track, avoiding the immediate repeat when possible, and shows the now-playing card for 4.5 s
- after a track ends, waits `AMBIENT_GAP` (10 s); with `AMBIENT_SILENCE_CHANCE` (35%) it also adds `AMBIENT_SILENCE` (240 s) of quiet so music does not feel spammed
- the MUSIC toggle disables ambient playback; VOLUME scales it with the rest of the game audio

### 14. Inventory and pocket crafting table
Relevant parts:
- `inv = { hot, main, armor, dose, sel }`, `giveStack()`, `spawnDrop()`
- drag & drop through `DragDrop` (drag-drop.js): every slot supports dragging out and in; shift-click still quick-moves/equips, and clicks on hotbar slots select them
- pocket table: `CraftOptions` (craft-options.js), `tableOptions()`, `tableCraft()`, `invCounts()`, `takeInv()`, `bagRoomFor()`, `buildTable()`
- `toggleInv()`; markup in `index.html`, styling in `assets/css/styles.css`
- `setOverlay()`: fades the pause overlay in and out (`.closing` class, delayed `display:none`) instead of popping it

What this does:
- a hotbar + storage grid inventory, plus a small always-available option-based crafting table
- the table only accepts `TABLE_OUTPUTS` recipes, giving a bootstrap route before any machine exists
- no grid: every affordable recipe appears as a card in a small scrollable container (title left, icon right, inventory tooltip on hover); clicking spends ingredients straight from the bag, shift-click crafts as many as fit

### 14a. Option-based crafting (pocket table + every recipe machine)
Relevant parts:
- `assets/js/craft-options.js` — `CraftOptions`, the shared scrollable card list
- `content.js` `CRAFT_RECIPES` / `TABLE_RECIPES`; machine `recipes` (in/out, optional liquidIn/liquidOut)
- `machines.js` `bagOptions()` / `startJob()` / `craftRecipe()` / `invCounts()` / `takeInv()` / `takeBagLiquid()` / `outputsHaveRoom()` / `giveOutputs()` / `addOutput()`
- workbench-ui.js bridge hooks `craftOptions()` / `craftRecipe()` / `hasCraftList()` / `collect()`, the fixed craft rail and the `renderMachineWorkflow()` card
- `layoutFor()` for `kind: 'crafting' | 'processor'` (no input slots)

What this does:
- replaces the old 5×4 / 3×2 shape grids: a recipe is offered as soon as the bag holds every ingredient (containers a recipe returns are netted out)
- the list lives in a fixed vertical rail beside the machine window — same `CraftOptions` cards as the pocket table, presented like the power meter but wider. `hasCraftList()` shows it for the manufactory and every processor
- the machine card's **ACTIVE / OUTPUTS / PROCESS / QUEUE** workflow is the crafting surface: the active recipe, the progress bar and the queued jobs are shown live, and finished items land in the machine's own 4 output slots — click one (or drag it) to collect
- the manufactory runs a timed job: ingredients and `energy.craft` are spent up front, then `recipe.time` (10 s for machine blocks, 2 s for everything else) elapses before the output goes to an output slot
- processors start a timed job: ingredients and liquid inputs are spent up front, the machine draws `energy.use` while the progress bar runs, and outputs (including `liquidOut` fills) land in the output slots on completion
- a full output blocks the job (`OUTPUT FULL`) until the player collects; shift-click queues as many crafts as the bag and power allow
- skyline automation can still deliver items into a machine's internal `input0..3` slots and run jobs from them, but those input slots are not shown in the workbench workflow UI (crafting is done from the recipe rail)

### 14b. Global liquid system and containers
Relevant parts:
- `LIQUID_DEFS` in content.js (registry: `water`, `acid`, `gasoline`, `ethanol`, `heavy_water`, `nuclear_waste`, `radaway`; each has `name`, `color`, `acidic`, `rad`)
- `assets/js/liquids.js` (`fill`, `drain`, `transfer`, `accepts`, `sanitize`, `volume`)
- container items in `ITEM_DEFS` with `container: { capacity, tier, acidProof }`
- `useLiquidContainer()` in game.js; water-filling now goes through the industrial tank activator and `MachineSystem.pump()`
- `WATER_PUMP` in `MACHINE_DEFS` (`kind: 'pump'`, `pump: { amount, cost }`) and its `pump()` method in machines.js
- `World.addWater()` / `World.useWater()` still exist but have no natural source and are unused by pouring
- mixer/separator/reprocessor `liquidIn` / `liquidOut` recipes in content.js

What this does:
- a liquid lives on the stack (`stack.liquid = { id, amount }`), so a container carries its contents through slots, saves and ground drops
- five tiered jerry cans (black → white) hold increasing volumes; each is `stack: 1` so one item = one tank
- `accepts()` enforces the acid rule: acidic liquids only fit a container with `acidProof` (the white hazmat can); everything else is refused, so a wrong can can never be corroded
- **water has only two sources**: target an industrial `liquid_tank` and right-click with a jerry can (`FILL CONTAINER`), or right-click a placed, powered `water_pump` while holding a can (5 L per 30 PU). There are no ponds, lakes, rivers, oceans or beaches to fill from
- right-clicking with a filled can discards water (it cannot be poured onto the ground); acid/waste pours burn and dose you (`LIQUID_DEFS[id].acidic` / `.rad`), everything else just empties
- the HUD paints a liquid level bar on container slots and the tooltip reports litres/capacity and the liner rating
- the can's `.glb` is shown in first person (`loadContainerModel()` reuses the tool viewmodel rig)
- **ethanol** (herb + water, liquid mixer) is a weaker generator fuel; the gas generator's `liquidFuel.burn` maps liquid id → litres/sec, so adding a fuel is one line
- **heavy water** (isotope separator: lithium + water) is the reactor coolant — a can in the reactor's `coolant` slot adds `coolPerHeavy` cooling while draining
- **nuclear waste** (fuel reprocessor, corrosive + hot) only fits the hazmat can, so spent-fuel work needs the white liner

### 14c. Consumables and the cigarette viewmodel
Relevant parts in game.js:
- `useConsumable()` — right-click applies `consumable.dose`, `shieldTime`, `intake`/`intakeTime`, and `smoke`/`speed`; `applyConsumable()` is the effect body
- `EAT_TIME` / `eat` / `startEat()` / `updateEat()` — food with no 3D model is chewed down over time
- `smokeTime` / `smokeSpeed` state; decremented in the frame loop
- `movePlayer()` speed line multiplies by `smokeSpeed` while `smokeTime > 0`
- cigarette viewmodel loaded from `assets/models/items/cigarette.glb`, parented to the camera and toggled visible

What this does:
- a food item shown as a flat icon (no 3D model, e.g. apple/orange/pear) is **eaten over `EAT_TIME` (1.4 s)**: the held icon is discarded from the top down along a jagged, hashed bite line (shader `uCut`), and the effects only apply when the last bite is gone. Switching the held item or opening a panel cancels the meal; food with a model still applies instantly
- using a **cigarette pack** lights a cigarette for 4 real minutes (240s) and grants +10% walk speed
- the pack is the inventory item (`cigarette_pack`, icon from `cigarette_pack.glb`); the cigarette itself is a first-person model attached to the camera, positioned at the mouth and drawn over the world (`depthTest:false`)
- re-using while smoking refreshes the timer and consumes another pack
- **rad-intake drugs** use one non-stacking multiplier (`radIntakeMult` / `radIntakeTimer`, applied once in `doseRate()`): `neurozam_9` = 20% damping for 30 real minutes, `stim` = 75% for 4 minutes (short burn, expensive recipe on the medicine workbench)
- `iodine_pill` clears 10 rad of absorbed dose; `unrad_juice` / `cup_noodles` clear dose outright
- unrad is made from RadAway fluid: `chemical_reactor` makes `chelating_agent` (herb + carbon + iodine), the `liquid_mixer` dissolves it in water into a `radaway_iv` bag, and the `medicine_workbench` bottles it with plastic into `unrad_juice`

### 14d. Recipe browser and recipe tree
Relevant parts in game.js:
- recipe browser: `recipePanel` markup in index.html; `RECIPE_MAKES` / `RECIPE_USES` maps, `addRecipe()`, `itemFilter()`, `RECIPE_FILTERS`
- `paintRecipeFilters()` (buttons carry item counts), `paintRecipeList()`, `paintRecipeDetail()`, `selectRecipe()`, `toggleRecipes()`
- recipe tree: `treePanel` / `treeBody` markup; `treeNodes()`, `treeStationTag()`, `openTree()`, `toggleTree()`, header drag handlers
- pointer-lock integration: `toggleInv(force, relink)` — recipes close the inventory with `relink = false`; `visibleTree()` gates the pause overlay

What this does:
- a JEI-style look-up: item grid on the left (8 columns, filter counts, search), item detail on the right with "how to obtain" and "used in" recipe cards
- a **START HERE** strip sits above the filter buttons for the first 30 real minutes of a world: it lists the opening build order (`STARTER_GUIDE` in content.js — carbon, ores, ingots, pick, hand crank, first machines) and each icon jumps to that item. Play time is stored in the save as `playTime`, so the strip stays gone once the opening is over
- every grid icon has a station dot strip: green = pocket table, yellow = crafting bench, blue = machine
- search: Enter selects the first match; Escape clears the search before it closes the panel
- the detail header has a **TREE** button that opens a large draggable popup (`#treePanel`, drag its header) rendering the full dependency tree downward: each item expands into one row per recipe (station label, fuel flag), ingredients recurse to mined/found leaves; cycles (self-feeding fuel) break instead of looping; hovering follows the house white-outline style and clicking a node opens that item's detail in the browser
- `T` in gameplay re-opens/toggles the tree of the last selected item (unlocks the pointer while open); Escape closes the tree first, then the browser

### 14e. Minimap and fullscreen map
Relevant parts in game.js / map.js:
- `MapSystem` (map.js): tile cache, `revealAround()`, `drawMini()`, `drawFull()`, `serialize()` / `restore()`, `addBookmark()`, `noteDeath()`
- wiring in game.js after the save is loaded: `mapSystem = new MapSystem({...})` with terrain/biome samplers, player/clock getters, machine list, industrial sites, save/notice and pointer-lock callbacks
- keys: **B** drops a bookmark at the player's feet, **M** toggles the fullscreen map (also closes inventory/recipes/workbench)
- `die()` calls `mapSystem.noteDeath(at.x, at.z)` before respawning

What this does:
- the corner minimap is north-up, 200 m across, and shows only chunks the player has seen (fog of war); it adds a 64 m reference grid, a flat facing wedge, a small scale bar and edge arrows for the nearest off-map bookmarks/deaths, so distant marks are never lost
- terrain tiles are 16 m chunks rendered once from `terrainTrend` + `biomeAt` at **1 texel per metre** (`TILE_PX = 16`): flat land colour from `BIOME_DEFS[id].top` (exposed mountain rock overrides it with stone grey) shaded by one of 8 discrete 10 m height bands, so the map reads as stepped pixel contours with no smooth relief. Tile edges are snapped to whole pixels and drawn nearest-neighbour, so the map stays blocky at every zoom. Water tiles are never painted (the world is dry)
- layers: terrain, industrial sites, machines, death spots and bookmarks; every structure is a flat pixel block (buildings/garages concrete grey, containers rust/blue/olive, tanks steel, reactors orange, generators yellow, scrubbers cyan), machines are 3-4 px squares and markers are pixel X / diamond marks with a 1 px shadow. There is no WATER layer
- the fullscreen map adds an adaptive world grid (`gridStep()`), a player→selection dashed line, and hover names for machines/markers — there are no permanent on-map labels and no header readouts
- fullscreen map: drag to pan, wheel/+/−/arrow keys/Home/F for zoom, pan, recenter and fit-explored, double-click to drop a bookmark at the cursor, PLAYER recenters, ADD HERE creates a bookmark at the map centre, FIT frames all seen chunks, click a marker to select it, rename bookmarks inline, delete selected markers, layer toggles persist per world
- seen chunks, bookmarks, death spots and layer flags are saved in the world save (`map`); uncovering new ground or editing markers triggers a save
- map tiles are a base-terrain approximation: player mining/building edits and cave voids are not re-baked into cached tiles (the tile cache is the performance ceiling; invalidate tiles if live edits must show)

### 14f. Achievements and the NEXT STEP objective
Relevant parts:
- `content.js` `GUIDE_STEPS` (the opening build order) and `ACHIEVEMENT_TYPES` (10 categories with 4–13 tiers each: miner, builder, craftsman, engineer, machinist, survivor, irradiated, hunter, researcher, atomics)
- `index.html` `#objective` (step counter, title, hint, requirement chips) and `#achievePanel` (header count, horizontally scrolling category grid, detail footer, hover tip)
- game.js `playTime`, `guideIndex`, `paintGuide()`, `updateGuide()`, `migrateGuideFromMachines()`, `guideStepDone()`
- `freshAchievements()`, `loadAchievements()`, `backfillAchievements()`, `achBump()`, `achCraft()`, `achievementValue()` / `achievementDone()` / `achievementProgress()`
- `buildAchievements()`, `paintAchievements()`, `paintAchievementDetail()`, `updateAchievements()`, `openAchievements()` / `closeAchievements()`
- pause-overlay `#achievementsBtn`

What this does:
- the **NEXT STEP** panel is a live objective tracker: every 0.2 s it checks the current `GUIDE_STEPS` entry against the bag or placed machines, paints `have/need` chips and auto-advances. It is hidden in sandbox and once the guide is finished, and progresses by id (`save.guide`) so a save can skip completed steps
- the guide is separate from the recipe browser's **START HERE** strip: the strip is time-based (`playTime < STARTER_GUIDE_SECONDS`), while NEXT STEP is state-based
- achievements track lifetime stats: `mined`, `placed`, `crafted`, `machines`, `kills`, `dosePeak`, `research` (blueprints), `fuel`, `walked`, plus `built.<machineId>` and `started.fission` / `started.fusion`
- tiers are defined purely in data (`stat`/`need`, `built`, or `started`); the panel builds the category columns on first open, paints progress and unlock counts, shows a hover tooltip and a detail line for the selected tier
- existing machines backfill `built`/`machines` on load, and unlocking or closing the panel saves the world
- both systems survive save/load via `playTime`, `guide` and `achievements`; the achievements handle is `openAchievements()` from the pause overlay

### 14g. Drag-and-drop item slots (shared across the whole UI)
Relevant parts:
- `assets/js/drag-drop.js` — `DragDrop` controller and `inventoryAdapter(grid, idx, items)`
- game.js: the single `dragDrop` instance (`workbenchUI.dragDrop`), `buildSlots()` binding, `armorAdapter(slot)`, `quickMove()`, `showTip()` drag guard
- workbench-ui.js: binds the workbench inventory sidebar, every layout `slot`, and the BWE hold; `refresh()` repaints after a drag
- machines.js: `invAdapter(i)`, `slotAdapter(role)`, `slotAccepts()` / `slotTake()` / `slotPut()` / `slotRestore()`, and `drop()` / `take()` rebuilt on top of them
- styles.css: `.dd-ghost`, `.dd-over`, `.dd-bad`, `.dd-dragging`

What this does:
- **one pointer drag system for every storage slot in the game**: inventory hotbar + storage, armor paper-doll, workbench inventory sidebar, every machine layout slot (inputs, fuel, rods, coolant, output, storage), and the BWE 64-slot hold
- a slot is an adapter: `stack()` reads it, `take()` removes and returns the stack, `put(stack)` places it and returns leftovers (or the swapped-out stack), `restore(stack)` puts a stack back, and optional `accepts(stack)` gates highlighting. `DragDrop` owns the ghost, hit-testing, merge/swap rules and repaint callback
- drag starts only after a 5 px move, so plain clicks still run the slot's own click handler (hotbar select, machine slot take/collect, shift-click quick move). The click that follows an actual drag is swallowed by a capture listener
- merging respects each item's `stack` cap and never merges liquid containers; a swap is only allowed when the source slot would accept the displaced item, so dragging a rod/fuel/armor out onto a full grid slot refuses instead of corrupting the source
- Escape, `pointercancel` and window blur cancel an active drag and restore the stack; closing the inventory or a workbench also cancels
- after every take/drop the controller calls `onChange` → `syncBars()` plus `workbenchUI.refresh()`, so the source empties instantly and both UIs repaint without polling
- the old click-to-carry cursor stack (`#cursorGhost`, `cursorStack`, `onSlotClick`) is gone; shift-click still quick-moves between bags and auto-equips armor
- to add a new slot UI: call `dragDrop.bind(node, adapter)` with `{ stack, take, put, restore, accepts }`; for grid storage use `inventoryAdapter(grid, idx, ITEMS)`. Run `node assets/js/drag-drop.check.mjs` after changing adapter rules

### 15. Armor and shielding plates
Relevant parts:
- `ARMOR_SLOTS` (`head/chest/legs/feet/hands`) exported from machines.js
- `carryShield()` in machines.js
- armor paper-doll strip in `index.html` / `styles.css`

What this does:
- five armor slots, shift-equipped from the inventory or drag-equipped onto the matching slot
- armor pieces can hold shielding plates; drag a plate onto a worn piece (or onto a plate slot in the armor workbench) to install it
- total shielding attenuates dose intake (`carryShield`)

### 16. Machines, power networks and reactors
Relevant parts in machines.js:
- `MachineSystem` (construct, place, serialize, restore, load)
- power network resolution and auto-linking cables; `rebuildCables()` draws each linked edge as three sagging strands (brown live, red neutral, green/yellow-striped earth; 8-segment quadratic droop, `LineSegments` per colour)
- processor ticks (crusher, furnaces, former, press, assembler, crystallizer, …): every recipe machine crafts from the bag as an option-list job, with power drawn over the recipe's `time`; finished items go to the machine's own output slots (`outputsHaveRoom()` / `giveOutputs()` / `addOutput()`), where the player collects them from the panel
- hand-cranked benches (no `energy` field, so zero power draw): gun_workbench, medicine_workbench
- electronics chips (circuit_board, memory_module, data_drive, data_disk, cooling_fan, card_reader, optic_lens, timer_module) consumed by assembler recipes for the advanced machines
- `tickReactor`, meltdown; `DEPLETED_OF[st.fuelId]` fuel mapping; `reactorRods()` / `reactorCooling()` for the five fuel-matched cooling-rod slots
- excavator, radiation absorbers, geiger, machine storage
- local power cells: `powerCap()` / `hasPowerPort()` / `chargeRate()` / `chargePower()` / `drawPower()` — every machine keeps a local buffer of at least 400 PU (3 × `energy.use` when that is larger) topped up from the network at a finite flow (`max(50 PU/s, use × 2, capacity / 15 s)`), never in a single tick; storage/battery machines use their `capacity` instead
- network energy does not teleport: generators add to the shared pool and machines charge from it over time; capacity machines fill from the frame's surplus (generation minus what the rest of the net drew) at their own flow rate, and a shortfall drains their buffers
- powered machines draw from that local buffer, not directly from the shared network pool

What this does:
- places machine blocks in the world and wires them into power networks automatically
- runs recipes on a tick, consuming/producing items from each machine's local power buffer
- the local buffer is what the workbench power meter shows, and it persists in saves
- reactors generate power from fuel; on meltdown they **explode and radiate** the area
- the excavator mines and the absorbers/geiger let the player fight radiation
- placement calls `flattenPad()` first: it levels a small blended pad into the density field so the machine sits on the ground instead of hovering on a slope (persists like any terrain edit), then bounds the pad/`hx`/`hz`/`top` from the model's bbox
- machines are **solid**: `structureCollidesBody()` (game.js) blocks the player's body against each instance's box from base to top, so you can stand on one instead of falling inside it; placement is refused if the footprint would overlap the player

### 16a. Reactor cooling rods and fuel matching
Relevant parts:
- `REACTOR_ROD_SLOTS` (5) in content.js; `ITEM_DEFS[*].rod` (`cool`, `absorb`, `mod`)
- fuel `fuel.cool` — the core's ideal cooling target (a multiple of 10, reachable with ≤5 rods)
- machines.js `reactorRods()` / `reactorCooling()` / `tickReactor()`
- layoutFor() reactor branch: fuel + 5 `rod0..rod4` slots + liquid coolant + heat/match bars

What this does:
- the reactor has **five interchangeable cooling-rod slots**; each rod item adds `cool` to the core and may add `mod` (moderation) or `absorb` (neutron poison)
- seven real-world-style rods exist: **graphite control** (`control_rod`, cheap, low cooling, +8% moderation), **beryllium reflector** (+12% moderation, 30 cool), **cadmium control** (50 cool, 22% absorption), **zirconium coolant** (70 cool, only 5% absorption), **hafnium control** (100 cool, 16% absorption), **boron carbide control** (150 cool, 28% absorption) and **heavy water coolant** (320 cool, +10% moderation, made in the assembler from a heavy-water can)
- each fuel declares `fuel.cool`: TBU 20, TBU oxide 30, LEU-235 80, LEU-233 90, LEU-235 oxide 100, LEP-239 200, MOX-239 240, HEU-235 650, HEU-235 oxide 800, HEP-239 1600. Building a rod layout whose total cooling matches the fuel is the point of the machine
- power is `fuel.power × coolingFactor × neutronFactor`: the first is ~1 inside ±5% of the target and falls off both ways, so **over-cooling costs power just like under-cooling**; the second rewards moderation and punishes absorber-heavy layouts. Heat gain is `fuel.heat − totalCool`; too little cooling climbs to `heatMax` and melts down
- heavy water in the liquid coolant slot adds `coolPerHeavy` (and drains), so a can can act as a temporary trim rod. The old "water adjacent to the reactor" bonus is inert because there is no surface water any more
- the panel shows `HEAT` and `COOLING MATCH` bars; status reads `OPTIMAL / OVERCOOLED / UNDERCOOLED <efficiency>%`, `NO COOLANT` or `OVERHEATING`, plus total cooling and live PU
- recipes make sense: cadmium and hafnium are centrifuge by-products of lead/zirconium ore, boron carbide comes from boron + carbon in the alloy furnace, and rods are pressed with steel/zirconium cladding; the heavy-water rod is assembled with 8 L of heavy water
- content.check verifies every fuel's target is reachable with the five slots, that rods are craftable, and that a matched layout out-produces an over-cooled one

### 16b. Research blueprints (the mid/late-game gate)
Relevant parts:
- `MACHINE_DEFS.research_lab` (processor) and its recipes
- `blueprint_reactor` / `blueprint_fusion` / `blueprint_scrubber` / `blueprint_containment` in `ITEM_DEFS`
- `assembler` recipes for `research_lab`, `fission_reactor`, `fusion_reactor`, `atmospheric_scrubber`, the containment suit and the plasma drill

What this does:
- the lab turns **hot samples** into one-use blueprints: enriched uranium (`u235`) for the fission reactor, reactor-derived plutonium (`pu239`) for fusion, `polonium` for the scrubber, and a shielding plate for the containment suit
- the fission reactor recipe now also needs `blueprint_reactor`, so the reactor can no longer be rushed straight off the assembler
- fusion is deliberately chained behind a *running* fission reactor: `pu239` only comes from reprocessing/centrifuging spent fuel, so the fusion blueprint cannot be made before the fission tier has been operated
- the containment suit is a single assembler job that outputs all five armour pieces from one blueprint, and the same blueprint unlocks the plasma drill
- the lab is itself an assembler build, so the progression is: assembler → centrifuge → lab → reactor → reprocessing → fusion/scrubber/containment

### 16c. Fusion reactor and the atmospheric scrubber (endgame)
Relevant parts:
- `MACHINE_DEFS.fusion_reactor` (`kind: 'reactor'`, `heatMax: 2000`, `coolPerHeavy: 600`)
- `fusion_fuel` (isotope separator) and `depleted_fusion` (fuel reprocessor)
- `MACHINE_DEFS.atmospheric_scrubber` (`kind: 'scrubber'`, `ambientCut`, `filter`)
- machines.js `tickScrubber()` / `ambientCut()`; game.js `doseRate()` uses `machineSystem.ambientCut()`

What this does:
- **fusion fuel** is made in the isotope separator from lithium, boron, a fuel casing and 12 L of heavy water; it burns for 3200 PU but wants the full 1600 cooling (all five heavy-water coolant rods)
- **depleted fusion fuel** is recycled in the fuel reprocessor back into lithium and boron, closing the loop
- the **atmospheric scrubber** burns 450 PU/s and one `filter_cartridge` every 120 s, and cuts 15% off the ambient dose rate while running; the total cut is capped at 85%, so a scrubber farm makes the late ambient ramp survivable but never free
- filters are assembler-made from carbon mesh, lead plates and plastic; scrubbers are a large power sink for a fusion grid
- the reactor panel already shows heat/cooling match for both reactor kinds, and the scrubber panel shows its filter slot, status and filter progress

### 16d. Water sources: tanks and the water pump
Relevant parts:
- `MACHINE_DEFS.water_pump` (`kind: 'pump'`, `energy.use: 30`, `pump: { amount: 5, cost: 30 }`); item `water_pump` (`workbench: 'water_pump'`)
- pocket-table recipe: 4 iron ingots + 2 copper ingots + 2 wood (`TABLE_OUTPUTS` includes `water_pump`)
- machines.js `pump(inst)`; `open()` and the placed activator both route a pump right-click straight to it (it never opens a panel)
- industrial `liquid_tank` parts: the `industrialCreate()` activator with the `FILL CONTAINER` label

What this does:
- the **water pump** draws groundwater into the jerry can currently in the selected hotbar slot: one right-click = 5 L, costing 30 PU from the machine's local power buffer (so it must be on a powered network)
- it refuses when no container is held, the can cannot hold water (e.g. a fuel carton), or the can is full
- **industrial tanks** are the free but location-bound source: they spawn beside some buildings/garages and fill a held can to capacity on right-click
- no other water source exists: there is no surface water to collect, and pouring a can only discards the water

### 16e. Skyline logistics (ziplines between workbenches)

Relevant parts:
- `assets/js/skyline.js` — the whole system: `SkylineSystem` (routes, pods, wires, pylon network/pathfinding), the pure helpers (`recipeNeeds` / `recipeOutputs` / `recipeList` / `sourceItems` / `destItems` / `matchRoute` / `pushIntoSlots` / `takeFromSlots` / `deliveryRoles`) and `SkylineUI` (the pick-item / pick-destination panel)
- `assets/js/content.js` — `MACHINE_DEFS.skyline_pylon` / `short_skyline_pylon` (kind `pylon`), `ITEM_DEFS.skyline_pylon` / `short_skyline_pylon` / `ITEM_DEFS.zipline_wrench` (a `tool` with `wrench: true`), their `CRAFT_RECIPES`, the `pylon` branch of `layoutFor()` and `TUNING.SKYLINE_SPEED` / `SKYLINE_RANGE` / `SKYLINE_TICK`
- `assets/js/machines.js` — `startJobFromSlots()` / `takeFromInputs()` / `drainInputs()` (a job that runs on what the machine holds instead of the player's bag); pylons are kept out of the power network
- `assets/js/game.js` — the system (passes `GLTFLoader`), `useSkylineWrench()` on right-click, the frame tick and the `skyline` save field
- `assets/js/workbench-ui.js` — recipe machines craft via the recipe rail/workflow card (no INPUTS card shown); skyline still delivers into internal `input0..3` slots and jobs can run from them
- `assets/js/skyline.check.mjs` / `assets/js/skyline.run.check.mjs` — `node assets/js/skyline.check.mjs` (the pure rules) and `node assets/js/skyline.run.check.mjs` (a pod leaves, rides the wire and lands in the destination's input slots)

What this does:
- **pylons** are tall masts (machines, saved with machines and drawn on the map): `skyline_pylon` (full height, model `assets/models/workbenches/skyline_pylon.gltf`, 2 steel + 2 copper + 2 wood) and `short_skyline_pylon` (half height, same model scaled, 1 steel + 1 copper + 2 wood). A workbench within a pylon's access range can be linked (`TUNING.SKYLINE_RANGE`, 12 m for full / 6 m for short)
- the **zipline wrench** (`assets/images/items/zipline_wrench.png`, tool) does the linking: right-click a workbench to pick an item up, then right-click another one to send it there
  - the first panel lists what the machine can supply: what it holds right now plus everything it is able to make
  - the second panel lists **every recipe the destination can make with that item**; a container has no recipes, so it just stores the item
  - if the destination **already runs a recipe that eats that item**, the link is made without asking — the second panel is skipped
- **network:** pylons auto-connect to nearby pylons into a network (pylon-pylon links, range `max(SKYLINE_RANGE*8, 96)` scaled per pylon; short pylons have half link range). Network wires are black fat lines (Line2) attached at the pylon ring, and each route also draws endpoint wires from the source/destination machines to their closest pylons
- **routes and pods:** a route is one item, one source and one destination. Cargo pods use `assets/models/items/zipline_box.gltf` (fallback box) and travel the full path — source machine → pylon network (BFS path) → destination machine — hanging below the cable with swing/wiggle and slope-driven forward/back motion, accelerating from slow on every segment
- limits: **32 items max per pod** and **one pod dispatched per second per source workbench** (`POD_CAP` / dispatch cooldown)
- the pod delivers into the destination's internal input slots. The destination then **crafts on its own**: `startJobFromSlots()` runs the route's recipe from what the machine holds, and the result lands in its output slots for the next route to pick up
- the source keeps making what it owes: it runs the recipe that outputs the routed item, from its input slots. With nothing feeding it yet it falls back to the player's bag, so a lone bench still works
- a machine that is fed by the sky (it has an incoming route) never touches the bag: the chain is a real factory — container → crusher → furnace → assembler
- speed is `TUNING.SKYLINE_SPEED` (7 m/s), and a pod that arrives with no room to unload waits at the end of the line instead of losing the load

### 17. Workbench UI panels
Relevant parts in workbench-ui.js:
- bridge-driven `WorkbenchUI` (HTML panel, inventory sidebar)
- element types `label` / `slot` / `progress` / `arrow` / `bwe`; legacy `recipes` / `power` elements are skipped
- layouts from `assets/ui/<id>.json`, else `layoutFor(def)`
- fixed `#powerMeter` meter (RAD-bar markup/styles) in the flex frame left of the panel, stretching to the panel's height
- fixed `.workbench-craft-rail` immediately beside the meter: the shared vertical `CraftOptions` card list for every option-based workbench (`hasCraftList()`)
- `renderMachineWorkflow()` — the machine card for `crafting` / `processor` benches: **ACTIVE** (job + icon), **OUTPUTS** (the machine's `outputN` slots; click or drag to collect), the **PROCESS** bar and the **QUEUE** list. This card is the crafting surface for these machines, so their layouts only need labels/progress
- `renderPower()` / `renderDynamic()` / `renderCraftRail()` drive the meter, process bars and the recipe rail
- slot elements and the sidebar are bound to the shared `DragDrop`; the workflow output cells use the same `slotAdapter`; `refresh()` forces an inventory + dynamic repaint after a drag

What this does:
- renders a machine's interface as an HTML overlay driven by the JSON layout
- one generic implementation serves every machine; the duplicated layout `header` and `power` elements are skipped
- every layout slot and sidebar slot accepts drag-in and drag-out through the same controller as the inventory; workflow output cells are take-only and click-to-collect
- the inventory sidebar grid keeps fixed-size slots and adapts by wrapping to fewer columns/more rows (`repeat(auto-fill, var(--slot, 46px))`) to avoid modal overflow
- shift-click in the sidebar deposits into the machine (`depositFrom()`): it merges with the same item or fills the first empty accepting slot and never swaps a different item out
- crafting and processor panels show the **ACTIVE / OUTPUTS / PROCESS / QUEUE** workflow card; finished jobs wait in the output slots (a full output reports `OUTPUT FULL` and pauses the job)
- empty item slots render blank (no `EMPTY` text)
- the power meter reads the open machine's local buffer through `powerView()` and is hidden for machines without a power port
- `ble.html` is the grid editor for authoring new layouts

### 18. Persistence, death and debug hook
Relevant parts:
- `SAVE_KEY` (`idte.save.v1`, or `idte.save.v2.<worldId>` for worlds created in the main menu), `World.save(player)` / `World.load()`
- stored fields: `seed`, density `edits`, `player`, `inv` (hot/main/sel/dose/armor), `vitals` (hp/hunger/wounds/immunity), `playTime`, `guide`, `achievements`, `day`/`dayT`/`timeLock`, `machines`, `pipes`, `map` (seen chunks + bookmarks + death spots + layers), `torches`
- `window.NUCLEARISM = { ITEMS, inv, vitals, hurt, addWound, clock, machineSystem, pipeSystem, mapSystem, give, giveStack, Liquid, LIQUIDS, caveAt }` debug handle

What this does:
- serialises terrain edits, inventory, clock (including `/time allday` lock), machines, pipes and torches to IndexedDB and restores them (old saves without `inv` start empty)
- the debug handle exposes the catalogue and live state for console testing; it is removable if unwanted

### 18b. Developer command line
Relevant parts in game.js / index.html / styles.css:
- `#cmd`, `#cmdInput`, `#cmdSug` markup and styles; `cmdOpen` state
- `openCmd()` / `closeCmd()`, `runCmd()`, `resolveItem()`, `nearestItems()`, `editDist()`
- `/tp` finder: `TP_TARGETS`, `TP_RINGS`, `nearestCaveOf()`, `nearestIndustrialOf()`, `nearestMachineTarget()`, `caveLanding()` / `industrialLanding()` / `standYAt()`, `nearestTargets()`, `resolveTarget()`, `teleportTo()`
- `timeLock` — `/time allday` freeze value (null = clock running)

What this does:
- pressing `'` or `` ` `` opens a small bottom console (and releases pointer lock / pauses movement); sandbox worlds only
- closes via Escape, Enter on an empty box, or clicking outside — Enter/click are real gestures so pointer lock resumes instead of falling into the pause overlay
- `/give <item> [count]` adds items; `<item>` accepts an id, an exact name, or the closest fuzzy match
- `/tp <type>` (alias `/goto`) teleports to the nearest deterministic world feature and closes the console: `cave` / `cavern` / `noodle` (lands on the cave floor), `building` / `garage` / `container` / `tank` / `industrial` (lands on the flat pad just outside it), or `machine` (next to the nearest placed machine). Types also match by name/alias/fuzzy spelling, so `/tp liquid tank` works
- `/time` reports the day + clock; `/time set <day> [t]` (or `/time <day>`) changes them (and releases any lock)
- `/time allday` toggles a freeze at noon (`clock.t = DAY_SECONDS * (DAY_FRACTION / 2)`); `/time night` jumps to mid-night (`clock.t = DAY_SECONDS * (DAY_FRACTION + (1 - DAY_FRACTION) / 2)`) and releases any lock. The frame loop holds `clock.t` and stops advancing the day while locked
- `/sm` spawns the hunger-smile billboard in front of the player (night only); it stays until day or until a jumpscare, and night hunger < 50 can also trigger it automatically with `PARANOIA`
- ArrowUp/Down walk command history; the dropdown shows the closest item or `/tp` destination names while typing, click or Tab to complete (an empty `/tp ` lists every destination)

### 18c. Settings (main menu + pause overlay)
Relevant parts:
- `assets/js/settings.js` — the whole settings system: `SETTING_DEFS` (the schema), `getSetting()` / `setSetting()` / `resetSettings()` / `onSettingsChange()`, `renderSettings(container)`, `SETTINGS_KEY` (`idte.settings.v1`)
- main menu: `#menuSettings`, pause overlay: `#overlaySettings` — both are empty containers the shared renderer fills, so the two screens can never drift apart
- game.js reads the values at boot (`getSetting(...)`) and applies changes live through `onSettingsChange(...)`; `assets/js/settings.check.mjs` self-checks the store (`node assets/js/settings.check.mjs`)

What this does:
- one schema drives both screens: a `choice` row is a set of buttons, a `toggle` is an ON/OFF button, a `range` is a slider with a live readout; rows are grouped (DISPLAY / CONTROLS / AUDIO) and a `hint` line explains the odd ones
- **render distance** (2/3/4/6/16/64/2000/10000 chunk columns, labelled in metres/km) applies live; editable terrain stops at 96 m, the rest is visual only
- **resolution** (100/67/50/33 %) sets the render scale (`PIXEL`), **color depth** (16/32/64) sets the PS1 colour quantisation, **field of view** (60–110°) sets `camera.fov`
- **INFO HUD** (fps/frame breakdown/position/dose line in `#hud`) is **off by default**; when off the stats are hidden but gameplay notices (`noticeMsg`) still show. Hiding also resets the perf counters so they don't accumulate
- **VSYNC** toggles the `requestAnimationFrame` gate, **VOLUME** scales game audio (footsteps, ambient music, tool/veg sounds), **MUSIC** toggles ambient day music, **mouse sensitivity** (0.2–3×) and **invert Y** apply to the pointer-lock look, and **REPLAY RECORDER** adds the replay button to the pause menu
- every setting persists globally (not per-world) in IndexedDB; a slider applies while dragging and only writes to the store on release; `RESET DEFAULTS` restores the schema defaults

## Important code anchors

### Survival layer
- `TUNING`, `ITEM_DEFS`, `MACHINE_DEFS`, `CRAFT_RECIPES`, `TABLE_OUTPUTS`, `DEPLETED_OF`, `layoutFor()`: content.js
- `MachineSystem`: placement, power, reactor meltdown, excavator, serialize/restore
- `clock` / `ambientRad()` / `radStage()` / `doseRate()` / `paintRad()` / `die()`: day, radiation (dose in rad), death
- `RAD_LETHAL_DOSE` / `RAD_LD50` / `formatRad()` / `formatRadRate()`: human lethal-dose meter scale and real-unit readouts
- `sourcePoint()` / `transmission()` / `RAD_OCCL` (radiation.js): the fallout spot and the near-field shadow march that lets walls block radiation
- `BuildingSystem` / `shadowCells()` / `snapPlan()` / `meshKey()` (building.js): wall panels, their per-slice attenuation, the DDA shadow march, the piece-to-piece snapping and the mesh a piece is drawn in; `pick()` / `kindFootprint()` / `pieceFootprint()` / `groundBase()` (building.js) place a piece against the anchor and report the hit face, and `collidesBody()` / `overlapsBody()` / `boxHitsBody()` do the continuous cylinder-vs-box collision; `baseAt()` / `anySupport()` / `edgeSupport()` (pieces/placement.js) decide what a piece may stand on; `BUILD_TIERS` / `BUILD_UPGRADES` (build-tiers.js, re-exported by content.js) hold the four shielding tiers
- `KINDS` / `pieces/*.js` (pieces/registry.js): the five piece kinds (wall, floor, roof, door, triangle) — geometry, support rules, items and recipes, one module each
- `doorHit()` / `toggleDoor()` / `updateDoorSwings()` / `swingFrame()` (game.js + pieces/door.js): opening and shutting a door, and the swing animation
- `radField()` / `radTransmission()` / `radFactor()`: directional field rate, the source the HUD arrow points at, and the per-voxel transmission hook
- `BARE_HANDS` / `mineOreDrop()` / `hasGardeningGloves()`: mining and gating
- `torches` / `torchLights` / `refreshTorchLights()` / `addTorch()` / `tryTorchPlace()`: placeable lights (torch, lantern, floodlight), drawn by a shared point-light pool
- `TOOL_MODELS` / `updateViewmodel()` / `triggerSwing()`: held tool viewmodel and swing animation
- `chopTarget()` / `chopTree()` / `updateChop()`: tree chopping, toppling and wood drops
- `createFootsteps()` / `surfToCategory()` (footsteps.js): surface-mapped step audio
- `AMBIENT_TRACKS` / `startAmbientTrack()` / `updateAmbientMusic()` / `ambientCooldown`: day-only ambient music with gap/silence scheduling and MUSIC toggle
- `inv` / `tableCraft()` / `buildTable()` / `toggleInv()`: inventory and option-based pocket table
- `DragDrop` / `inventoryAdapter()` / `canDrop()`: shared pointer drag-and-drop for every slot (ghost, merge/swap, click suppression)
- `CraftOptions` / `craftOptions()` / `startJob()` / `craftRecipe()`: shared scrollable recipe-card list for the pocket table and every recipe machine (fixed side rail), with timed jobs and the ACTIVE/OUTPUTS/PROCESS/QUEUE machine card
- `outputsHaveRoom()` / `giveOutputs()` / `addOutput()` / `renderMachineWorkflow()` / `collect`: machine output slots and click-to-collect
- `ARMOR_SLOTS` / `carryShield()`: armor and shielding
- `LIQUID_DEFS` / `liquids.js` (fill/drain/accepts/transfer): liquid types and container rules
- `useLiquidContainer()`: acid refusal and discarding water; water is filled from tanks/pumps instead
- `water_pump` / `MACHINE_DEFS.water_pump` / `pump()`: powered groundwater pump (5 L per 30 PU into the held can)
- `liquid_tank` / `industrialCreate()`: industrial water tank with the `FILL CONTAINER` activator
- `useConsumable()` / `smokeTime` / `smokeSpeed`: consumable effects and the cigarette buff/viewmodel
- `radIntakeMult` / `radIntakeTimer` / `doseRate()`: NEUROZAM-9 and STIM intake damping
- `itemModelIcon()` / `ITEM_MODEL_ICON_EXCLUDE`: automatic 3D icon/prop source (blacklist)
- `flattenPad()` / `structureCollidesBody()`: machine ground pad and continuous machine/industrial body collision
- `updatePlacePreview()` / `buildPlaceGhost()` / `hidePlaceGhost()`: flashing translucent workbench place-preview
- `resolveInteractTarget()` / `useInteractable()` / `raySphereHit()`: crosshair interact prompt + open (REACH-limited)
- `timeLock` / `/time allday`: frozen-clock sandbox command
- `TP_TARGETS` / `nearestCaveOf()` / `nearestIndustrialOf()` / `teleportTo()`: `/tp` destination finder + dropdown (`cave`, `cavern`, `noodle`, `building`, `garage`, `container`, `tank`, `industrial`, `machine`)
- `RECIPE_MAKES` / `paintRecipeList()` / `paintRecipeDetail()`: recipe browser (station dot strips, filter counts, Enter/Escape search)
- `treeNodes()` / `openTree()` / `treePanel` / `T` key: draggable recursive recipe tree with white connector lines
- `rebuildCables()`: sagging three-strand cable rendering in machines.js
- `REACTOR_ROD_SLOTS` / `reactorRods()` / `reactorCooling()` / `fuel.cool`: five fuel-matched cooling-rod slots, over/under-cooling power curve and heat balance
- `research_lab` / `blueprint_*` / assembler gates: blueprints gate the reactor, fusion, scrubber and containment tiers
- `fusion_reactor` / `fusion_fuel` / `depleted_fusion` / isotope separator recipe: post-fission fuel tier
- `atmospheric_scrubber` / `tickScrubber()` / `ambientCut()` / `filter_cartridge`: powered endgame ambient-dose reduction
- `hand_crank` / `crank()` / `open()`: manual bootstrap generator (right-click spins the handle for 2 s and feeds the grid directly, no stored charge; it never opens a panel)
- `STARTER_GUIDE` / `STARTER_GUIDE_SECONDS` / `paintStarterGuide()` / `playTime`: 30-minute opening build-order strip above the recipe filters
- `GUIDE_STEPS` / `guideIndex` / `paintGuide()` / `updateGuide()` / `migrateGuideFromMachines()`: state-driven NEXT STEP objective card (inventory/machine checks, auto-advance, saved by id)
- `ACHIEVEMENT_TYPES` / `freshAchievements()` / `achBump()` / `achCraft()` / `achievementProgress()` / `paintAchievements()` / `openAchievements()`: lifetime-stat achievements panel with data-defined tiers
- `vitals` / `WOUNDS` / `hurt()` / `addWound()` / `cureWounds()` / `updateVitals()` / `paintVitals()`: health, hunger, wound effects and HUD meters
- `industrialSite()` / `industrialPadAt()` / `industrialUpdate()` / `buildWallMask()` / `structureCollidesBody()`: deterministic industrial buildings, flattened pads and per-wall/per-box body collision
- `VEG_SPECIES` / `VEG_LAYERS` / `vegCell()` / `vegResolve()` / `vegStream()` / `vegUpdate()` / `_vegHarvested`: deterministic instanced vegetation, pickups and harvesting
- `useC4()` / `placeC4()` / `detonateC4()` / `updateC4()` / `C4_FUSE` / `C4_RADIUS`: armed demolition charges, crater carving and blast damage
- `idte.settings.v1` / `SETTING_DEFS` / `renderSettings()` / `onSettingsChange()`: the shared settings schema, store and UI (render distance, resolution, color depth, FOV, VSYNC, INFO HUD, sensitivity, invert Y, volume, music, replay)
- `intro` / `maybeShowIntro()` / `openIntro()` / `closeIntro()`: one-time field-manual modal on the first survival load (points at the NEXT STEP card; reopenable from the pause overlay via `manualBtn`); seen state lives in `idte.intro.v1.<worldId>`
- `World.save()` / `World.load()`: persistence (including `map`)
- `MapSystem` / `revealAround()` / `addBookmark()` / `noteDeath()` / `drawMini()` / `drawFull()`: minimap and fullscreen map (B = bookmark, M = map)
- `map.check.mjs`: pure coordinate/chunk-key assertions (`node assets/js/map.check.mjs`)

### Terrain / climate
- climateAt(): noise-driven climate values
- biomeWeights(): land biome assignment (no ocean/shallow/beach IDs)
- terrainTrend(): overall world heightfield (land plate, broad massif belts, folded ridges and drainage cuts)
- pondHere(): always `false`; surface water cannot seed
- terrainDensity(): density field for solid/air decisions
- caveSite() / buildCaveSite() / caveCarveAt(): deterministic sinkhole → tunnel → cavern caves plus buried noodle networks and hashed ceiling/floor spikes (tuning: `CAVE_CELL`, `CAVE_CHANCE`, `CAVE_SINK`, `NOODLE_CHANCE`, `NOODLE_DEPTH`)
- `FarTerrainRenderer` / `farTerrain.prewarm()` / `farTerrain.setHaze()` (game.js): the LOD rings beyond the interactive radius, their own distance haze and the per-vertex rock mask (`aFarRock`) that keeps distant mountains stone instead of grass

### Water (dormant)
- WaterSim class: retained finite-volume sim, never seeded
- step(): one relaxation pass for a water column set (unused)
- update(): runs water settling while honoring budgets (no-op)
- rebuildWater(): creates the visible water mesh (always empty)

### World logic
- World constructor
- World.update(): streaming around the player
- World.processDirty(): terrain mesh rebuild budget
- World.processWaterDirty(): water rebuild budget (stays empty)
- World.waterAt(), World.isUnderwater(): return 0 / false with no surface water

### Render tuning
- waterMaterial: transparent water shader (dormant)
- material.onBeforeCompile: terrain surface shader and underwater fog blending (fog unreachable)

## Design notes

- The terrain is not handcrafted; it is generated from noise and climate functions.
- The world uses chunk streaming so the game can stay open and performant.
- Water is derived from terrain and pond rules rather than stored as a giant static ocean map.
- The code is organized around a procedural terrain engine, not a conventional static level layout.

## Practical workflow for editing
If you want to change the world feel, the best places to start are:
1. climateAt() / biomeWeights() for biome distribution
2. terrainTrend() for coastline and world heights
3. `CAVE_CELL` / `CAVE_CHANCE` / `CAVE_SINK` and `buildCaveSite()` for sinkhole frequency, tunnel shape and cavern size; `NOODLE_CHANCE` / `NOODLE_DEPTH` / `NOODLE_REACH` for the buried closed-off tunnel networks; the spike block in `buildCaveSite()` for stalactite counts/sizes; `terrainDensity()` for overhang/underwater volume behavior
4. WaterSim.update() / step() for water performance and motion
5. rebuildWater() for water edge shape and shoreline visibility

For the survival/gameplay layer:
1. `content.js` (`ITEM_DEFS` / `MACHINE_DEFS` / recipes / `TUNING`) for anything data-shaped — content, costs, radiation curve, day length
2. `TABLE_OUTPUTS` + `CRAFT_RECIPES` to move a recipe between the pocket table and the crafting bench
3. `LIQUID_DEFS` + `container` item fields to add liquid types or new containers; `liquids.js` holds the rules
4. `ambientRad()` / `radStage()` / `doseRate()` for the radiation pressure curve; dose is in rad and the meter is scaled to `RAD_LETHAL_DOSE` (600 rad, with LD50 at 450)
5. `machines.js` processor/reactor/excavator ticks for machine behaviour; tune reactor balance with `fuel.cool` and `rod.cool/absorb/mod` in content.js (targets must stay multiples of 10 reachable with 5 rods)
5b. the late tier is data-driven too: blueprint recipes live in `research_lab`, the assembler recipes consume them, `fusion_fuel` is an ordinary `fuel` item and the scrubber is just a machine with `ambientCut` + `filter`
6. machine JSON layouts (or `layoutFor()`) for a machine's panel — power is not a layout element; the meter is automatic and shows the machine's local buffer. Recipe machines keep their options in the fixed craft rail and render their ACTIVE/OUTPUTS/PROCESS/QUEUE card, so their layouts only need labels/progress, never input/output slots
7. drop item art at `assets/models/items/<id>.glb` and it becomes both the icon and the held prop — no list to edit; add to `ITEM_MODEL_ICON_EXCLUDE` only to opt out, and bump `ICON_CACHE_KEY` after changing art. For a flat PNG instead, `assets/images/items/<id>.png` **must** be referenced via `icon:` in that item's `ITEM_DEFS` entry.
8. always re-run `node assets/js/content.check.mjs` after touching the catalogue — it fails on unobtainable machine blocks, bad recipes, out-of-bounds layouts, or a model file that doesn't map to its item
8b. `node assets/js/drag-drop.check.mjs` self-checks the shared slot adapter's take/merge/swap/restore rules
8c. `node assets/js/settings.check.mjs` self-checks the settings store (defaults, legacy stores, clamping, persistence, reset) — add a new setting to `SETTING_DEFS` in `assets/js/settings.js` and both the menu and the pause overlay pick it up
8d. `node assets/js/radiation.check.mjs` self-checks the directional radiation helpers (source point, shadow march, bearing, compass) — shielding tuning lives in `RAD_OCCL` in `assets/js/radiation.js` and the floors in `TUNING`
8e. `node assets/js/building.check.mjs` self-checks the wall geometry (a 3×3 cell panel), the attenuation law per tier, the DDA shadow march and the snapping planner — wall tuning lives in `BUILD_TIERS` (content.js), panel size in `TUNING.BUILD_WALL_*`
8f. every piece kind has its own check: `node assets/js/pieces/{wall,floor,roof,door,triangle}.check.mjs` — pure geometry and support assertions, `node` only, no browser
8g. the runtime has three more: `node assets/js/building.mesh.check.mjs` (one `InstancedMesh` per kind — a shared mesh would draw a wall flat like a floor), `node assets/js/building.snap.check.mjs` (pieces really placed on the tiny three.js stand in `assets/js/three-stub.mjs`) and `node assets/js/building.intent.check.mjs` (game.js's own `buildingTarget` / `buildingBlocked` / `updateWallPreview` / `doPlace` bodies, extracted from the source and run in node, so the placement intent is checked against the real code)
8h. `node assets/js/collision.check.mjs` extracts `structureCollidesBody()` from game.js and checks that machine/industrial bodies block from base to top (you stand on a workbench instead of falling into it)
8i. `node assets/js/far-terrain.check.mjs` checks the far-horizon seam: the ring must meet the detailed terrain at the detail edge (no step in front of the player), stay under the chunks where they overlap, and the far haze must still finish at the rim
8i. `node assets/js/chunk-dirty.check.mjs` extracts the chunk rebuild bodies from game.js and checks the dirty range against the chunk frame rule, the sliced sample loader against the plain nested loop, and the incremental refresh
8j. `node assets/js/skyline.check.mjs` self-checks the zipline rules (what a machine can supply, what a destination can do with an item, the auto-connect rule, where a delivery lands) and `node assets/js/skyline.run.check.mjs` runs a whole delivery: a pod leaves the source, rides the wire and lands in the destination's input slots. Tuning lives in `TUNING.SKYLINE_*` and the pylon's range in `SKYLINE_RANGE`
9. a new light source is just `torch: true` + `light: { mount, range, power, color }` on an `ITEM_DEFS` entry (see torch/lantern/floodlight) — the placement and point-light pool pick it up automatically, and every lit material (terrain, machines, building pieces, models) reacts with no extra work
10. map visuals live in `assets/js/map.js`: `_renderTile()` owns the flat terrain colouring (`BAND_SHADE` height steps, `surfaceColor()` from the game's context) and `drawFull()` owns markers/layers; `SITE_COLORS` / `MACHINE_COLORS` hold the pixel palette and `industrialDims` in the `MapSystem` options sizes the structure blocks. Run `node assets/js/map.check.mjs` after touching its coordinate helpers.

## Summary
This project is a browser voxel survival game built on a Three.js engine with a custom chunked terrain and finite-volume water simulation, wrapped in a NuclearCraft-style radiation progression. Two layers:

1. **Engine** — procedural world generation, deterministic cave systems (surface sinkholes → tunnels → caverns), chunk streaming, terrain density, water sim and rendering (game.js), plus the main menu/world select (menu.js) and pipes (pipes.js).
2. **Survival layer** — data-driven items/machines/recipes (content.js), a day clock with escalating ambient radiation (dose in real rad units, metered against the human lethal dose) that arrives from a fixed fallout spot and is shadowed by walls, and dose stages, health/hunger/wound vitals, mining and ore bands, steel hand tools and model-backed held items, tree chopping, deterministic industrial sites and instanced vegetation, C4 demolition, surface-mapped footstep audio, a pocket crafting table, timed machine crafting with an ACTIVE/OUTPUTS/PROCESS/QUEUE card, drag-and-drop item management on every slot, consumables (rad-intake drugs), armor with shielding plates, power-networked machines with local buffers, reactors whose five cooling-rod slots must be matched to the fuel (over-cooling costs power), a **blueprint-gated research tier** leading to a fusion reactor and an atmospheric scrubber, a NEXT STEP objective guide, lifetime achievements, and IndexedDB persistence. On top of that sits **base building**: Rust-like placeable pieces (walls, floors, gable roofs, openable doors and triangular wedges) in four material tiers, each piece its own module behind a small kind contract, built cheaply and upgraded in place with a hammer, and every piece shades the radiation that comes from its direction (wood 14%, brick 29%, concrete 50%, shielded concrete 99% of one panel). The pieces snap to **each other**, not to the world grid: the piece you aim at is the anchor and the new one is laid flush against it on the anchor's own lattice — a wall sits exactly against the edge of a deck, a deck butts up to a deck, and a roof laid over a wall's top edge hangs out in the direction you are looking. The whole UI shares one black-alpha, borderless skin.

Most important files:
- [index.html](index.html)
- [assets/css/styles.css](assets/css/styles.css)
- [assets/js/game.js](assets/js/game.js) — engine + survival integration
- [assets/js/content.js](assets/js/content.js) — all game content data
- [assets/js/menu.js](assets/js/menu.js) — main menu, world select, settings
- [assets/js/drag-drop.js](assets/js/drag-drop.js) — shared drag-and-drop for every item slot
- [assets/js/liquids.js](assets/js/liquids.js) — global liquid/container rules
- [assets/js/radiation.js](assets/js/radiation.js) — radiation source spot, shadowing, direction readouts
- [assets/js/building.js](assets/js/building.js) — wall panels, tiers, upgrades, the radiation shadow and the piece-to-piece snapping
- [assets/js/pieces/README.md](assets/js/pieces/README.md) — the piece-kind contract (wall, floor, roof, door, triangle)
- [assets/js/machines.js](assets/js/machines.js) — machine/power/reactor runtime
- [assets/js/pipes.js](assets/js/pipes.js) — decorative pipe grid
- [assets/js/skyline.js](assets/js/skyline.js) — zipline logistics: pylons, wires and the cargo pods that move items between workbenches
- [assets/js/settings.js](assets/js/settings.js) — shared settings schema, store and UI
- [assets/js/map.js](assets/js/map.js) — minimap, fullscreen map, bookmarks and death spots
- [assets/js/workbench-ui.js](assets/js/workbench-ui.js) — machine panel renderer
- [WORKBENCHES.md](WORKBENCHES.md) — extension guide for content and layouts

## Long-distance rendering plan (up to 10000 chunks)

The render-distance setting is measured in 16 m chunks. A value of 10000 means
a 160 km radius. Do not use this value to allocate interactive `Chunk` objects:
the existing square streamer would otherwise request 16,008,001 XZ columns and
over 64 million chunk meshes across its four baseline vertical layers.

### Target architecture

Keep three distances separate:

- **Interactive radius:** at most 6 chunks. These are existing editable,
  collidable, fully shaded chunks, with vegetation and nearby site interaction.
- **Terrain LOD radius:** a separately streamed coarse terrain representation.
  It is visual only: no mining, collision, water simulation, lighting bake,
  vegetation, or machine interaction.
- **View horizon:** user setting, 2–10000 chunks (32 m–160 km), used for camera
  clipping and atmospheric fog. This is not a promise of full detail.

The implemented far representation uses nested square rings sampled from the
same deterministic terrain height function. Each ring is one 64×64 grid;
grid spacing grows by 4× per ring, covering the selected horizon with a fixed
small mesh count. Far surfaces use the same tiled grass texture as nearby
terrain. Ring samples are built in batches between animation frames,
stale builds are canceled after the player crosses a chunk, and old meshes stay
visible until replacements are ready. The shared terrain caches are bounded,
and terrain-density keys retain distinct coordinates beyond the original local
16-bit key range. The nearest ring begins 80 m from its snapped center, overlaps
the detailed chunk area, and matches the live surface along its inner boundary.
64 m skirts hide cracks at the boundaries between coarse rings. The nearest
ring also approximates industrial pad flattening. Far terrain does not contain
caves, vegetation, machines, or saved edits away from the inner boundary.

Ring skirts and an overlapping, surface-matched inner edge close cracks between
LOD rings and the interactive terrain. The main remaining work is propagating
persistent terrain edits into outer far meshes and profiling re-sampling cost
while walking. The active six-chunk world remains the only editable and
collidable terrain.

**The far plane has to reach the projection matrix.** The camera is built with a
400 m far plane (`new THREE.PerspectiveCamera(fov, aspect, 0.08, 400)`) and the
frame loop raises `camera.far` to the horizon every frame — but a changed
`near`/`far` does nothing until `updateProjectionMatrix()` is called, so the
world was clipped at 400 m and the fake rings beyond that were never drawn.
Changing the FOV or resizing the window rebuilds the projection, which is why
"max out the FOV" appeared to fix the horizon, and why the panorama (which
builds its own camera) always showed the full range. The frame loop now
rebuilds the projection whenever the far plane changes; `far-terrain.check.mjs`
guards it.

**The seam with the detailed terrain** is the ring's height, not its skirt. The
ring used to sit a flat 6 m under the terrain trend, so where the real chunks
ended (the detail square, -96 m .. +112 m around the player's chunk origin) the
world dropped off in a straight line in front of the player, and a cliff down
to a smoothed world sat just beyond it. The ring now **follows the real
ground**: inside the detail square it samples the density field's own surface
0.75 m under it (the chunk mesh hides it there, and it must not fight the
mesh for the depth buffer), and over the next 48 m it eases into the smooth
trend (`FAR_RING_BLEND`, `farRingBeyond()`, `farRingBlendWeight()` in game.js),
so the seam is a continuation of the ground, never a step. The far rings are
also sampled at the column height, not the trend, so they sit on the same
ground as the chunks. `node assets/js/far-terrain.check.mjs` checks that seam.

The far rings carry their own distance haze instead of the scene fog: the ring
material runs `fog: false` and mixes toward the sky colour with a fourth-power
falloff over the visible extent (`FAR_HAZE_REACH` in game.js) — the outer ring
edge or the camera far plane, whichever comes first. The fourth power keeps the
middle of the horizon readable (a 160 km range still shows its mountains)
while the fade still completes where the fake terrain stops, so its border and
the LOD ring seams fade out instead of showing as hard lines. `scene.fog` now
only covers the editable terrain, and `camera.far` stops at the ring edge. The
panorama capture (`capturePanorama()`) uses the game's own far plane, so a
panorama shows the same horizon the player sees.

Industrial structures remain fully streamed only nearby. At mid range,
low-cost site impostors are a possible follow-up; vegetation stays out of the
far horizon. Keep far terrain out of collision and gameplay queries. Profile
fog, camera depth precision, draw calls, and memory on integrated graphics
before changing the default horizon.

Far terrain samples the same mountain heightfield and carries biome surface
weights for grass, sand, dry ground, snow and ash. These match the textures
used by nearby terrain; mountain stone overrides them with the **same rock mask
the near terrain uses**, sampled per vertex from the heightfield (slope driven
in Realistic, the height cut-off in Legacy) and carried in the `aFarRock`
attribute. The mask must not come from the ring's own normal: the far grid is
16–1024 m per cell, so its normals flatten every cliff face and the mountains
come out grass. Legacy applies no snow cap to high mountain surfaces (Realistic
keeps a coarse altitude snow term above 112 m), and trees, shrubs
and ground cover do not spawn on mountain stone.

### Build sequence

1. Done: decouple the user horizon from the interactive chunk radius.
2. Done: add batched deterministic terrain rings and bounded terrain caches.
3. Done: overlap the near terrain and skirt LOD boundaries. Follow up: propagate
   saved terrain edits into far rings.
4. Follow up: add distant industrial site impostors if the cost fits the budget.
5. Profile generation time, draw calls, memory, and seams at horizons up to
   10000 while moving across chunk boundaries.

The detailed streamer extends each column's vertical range to cover its local
terrain peak, with a small headroom chunk above it. This keeps high mountain
surfaces in editable, collidable terrain chunks while ordinary columns retain
the original four-layer baseline. World startup pre-generates the 3×3 chunk
columns around spawn in short 8 ms slices. The loading screen then
tracks far-ring sampling when the selected horizon exceeds 6 chunks. It becomes
clickable after the requested terrain work finishes; the remaining detailed
radius continues streaming during play.



# Machines & workbench interfaces may be outdated.

All content is data. `assets/js/content.js` holds the item catalogue, the machine
definitions and their recipes. `assets/js/machines.js` is the runtime (placement,
power networks, reactors, the excavator, persistence). `assets/js/workbench-ui.js`
renders whatever layout a machine points at. `assets/js/game.js` supplies the
world, player, inventory and radiation model through the machine system's `ctx`.

## Add an item

Add an entry to `ITEM_DEFS` in `content.js`:

```js
my_item: { code: 'MI', name: 'MY ITEM', stack: 99, rad: 0.2, block: false },
```

Useful fields: `block`, `tool`, `torch`, `plate` (`radShield`), `armor`
(`slot`, `radShield`, `plateSlots`), `consumable` (`dose`, `shieldTime`),
`fuel` (`power`, `heat`, `cool`, `lifetime`, `rad`), `rod` (`cool`, `absorb`,
`mod`), `workbench` (makes it placeable as that machine), `icon` (real PNG
path), `harvested`.

`fuel.cool` is the reactor's ideal total cooling for that fuel; `rod.cool` is
what the rod contributes per slot, `rod.absorb` is neutron poison (0..1) and
`rod.mod` is moderation. Rod items are the only things accepted by the reactor's
`rod0..rod4` slots.

Icons: `assets/images/items/<id>.png`. Missing files fall back to a generated
code tile, so the game runs before any art exists.

## Add a machine

1. Add a `MACHINE_DEFS` entry: `id`, `kind`, `name`, `model`, `layout`, `label`,
   `height`, plus `energy` and `recipes` where relevant.
2. Optionally drop a real model at `assets/models/workbenches/<id>.gltf` and a
   layout at `assets/ui/<id>.json`. Both are optional: a missing model becomes a
   placeholder box, a missing layout is generated by `layoutFor(def)`.
3. Add the matching block item with `workbench: '<id>'` so it can be placed.

`kind` drives the runtime: `crafting`, `armor`, `processor`, `reactor`,
`generator`, `excavator`, `absorber`, `scrubber`, `cable`, `storage`, `geiger`.

Recipes are shapeless maps:

```js
recipes: [ { in: { uranium: 1 }, out: { crushed_uranium: 2 }, time: 3, rad: 0.4 } ]
```

`time` is seconds, `rad` is emitted while running, `fuel: true` marks a fuel-burn
recipe. Bag crafting recipes live in `CRAFT_RECIPES` (`{ out:{id:n}, needs:{id:n} }`)
and are option-based: the recipe appears as a card the moment every ingredient is
in the bag. Every `CRAFT_RECIPES` entry also gets a `time` at load (10 s when the
output is a machine block, 2 s otherwise); the manufactory runs it as a timed job
and drops the result into its output slots.

The inventory's **pocket crafting table** (always available) matches the subset
listed in `TABLE_OUTPUTS` — the bootstrap recipes: primitive smelting, torch,
graphite, first tools/gloves, and the first machine blocks (manufactory, armor
workbench, crusher, electric furnace, cable). Add an id there to make a
`CRAFT_RECIPES` entry craftable from the inventory.

Progression rule: a machine block is **never** only craftable inside another
machine. The bootstrap blocks (and the assembler itself) live in `CRAFT_RECIPES`
so they can always be made from the bag; the assembler handles the advanced tier.
Bare hands can mine dirt/grass/stone, so a fresh world can gather the ore and
carbon for the first ingots. `content.check.mjs` fails if any machine block
becomes unobtainable.

## Design a layout

Open `ble.html` through the project's web server, place elements, export JSON into
`assets/ui/<id>.json`. Element types are `label` (`text`, `size`), `slot` (`role`,
`label`), `progress` (`label`, `color`), `power`, `recipes` and `arrow`. Slot roles
the runtime understands: `armor`, `plate0..3`, `input0..3`, `fuel`, `output0..N`,
`coolant` and `rod0..rod4` (reactor cooling rods). A reactor progress element with
id `match` reads the cooling-match value instead of the process bar.
A `recipes` element (e.g. `{ type: 'recipes', x: 0, y: 1, w: 12, h: 5 }`) renders
the scrollable option-based crafting list for `kind: 'crafting'` benches.

Crafting/processor panels ignore their layout `status`/`progress` elements and
show the generated ACTIVE/OUTPUTS/PROCESS/QUEUE workflow card instead. Their
outputs live in `output0..N` machine slots (4 by default) and are collected from
the OUTPUTS card; layout `output` slots are only needed for machines that draw
their own panel (e.g. the excavator).

## Radiation model

Carried hot items, running machines and the day-based ambient pressure add dose.
Worn armor turns its flat `radShield` into a bounded fraction (≤80%) that now
applies to ambient and machine fields as well as carried items; powered
absorbers cut a field multiplicatively (35% at their center, 75% max when
stacked). Dose only decays while intake is essentially zero for 30 s, at a
deliberately slow 0.05 rad/s. The curve lives in `TUNING.RAD_STAGES` in
`content.js` (slow → blur → death at 600). Death drops everything the player
carried.

## Check your content

```
node assets/js/content.check.mjs
```

Validates every recipe item, machine/block pairing, fuel depletion, layout bounds
and the radiation curve.


Dont test with browser testing.
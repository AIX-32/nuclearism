// Building tiers: the material data for every placeable building piece.
//
// `transmission` is the fraction of radiation that survives ONE METRE of the
// material, so a thin wall only blocks what its thickness times that factor
// allows. Wood barely helps, shielded concrete almost stops the field (but
// never all of it).

export const BUILD_TIERS = {
  wood: { name: 'WOOD', transmission: 0.55, hp: 100, color: 0x8a5a33, texture: 'assets/textures/buildings/wood.jpg' },
  brick: { name: 'BRICK', transmission: 0.25, hp: 300, color: 0x9a4a3a, texture: 'assets/textures/buildings/brick.jpg' },
  concrete: { name: 'CONCRETE', transmission: 0.06, hp: 600, color: 0x9a9a96, texture: 'assets/textures/buildings/concrete.jpg' },
  shielded: { name: 'SHIELDED CONCRETE', transmission: 1e-8, hp: 1200, color: 0x6e7a86, texture: 'assets/textures/buildings/shielded.jpg' },
};

export const BUILD_TIER_ORDER = ['wood', 'brick', 'concrete', 'shielded'];

// What an upgrade costs, keyed by the tier being upgraded FROM.
export const BUILD_UPGRADES = {
  wood: { stone: 10, sand: 4, wood: 2 },
  brick: { stone: 15, gravel: 6, sand: 4, iron_ingot: 1 },
  concrete: { lead_plate: 1, lead_ingot: 1, iron_ingot: 4 },
};

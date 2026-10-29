







// `rad` on items/machines is a dose rate in rad/s while carried or running.
const I = (code, name, extra = {}) => ({ code, name, stack: 99, rad: 0, ...extra });
const ORE = (mat, code, extra = {}) => I(code, mat.toUpperCase() + ' ORE', { block: true, ...extra });
const DUST = (mat, code) => I(code, mat.toUpperCase() + ' DUST', { block: false });
const INGOT = (mat, code, extra = {}) => I(code, mat.toUpperCase() + ' INGOT', { block: true, ...extra });
const PLATE = (mat, code) => I(code, mat.toUpperCase() + ' PLATE', { block: false });

const CIRCUIT_MODEL = 'assets/models/items/circuit_board.glb';

// A reactor core has this many interchangeable cooling-rod slots.
export const REACTOR_ROD_SLOTS = 5;





export const LIQUID_DEFS = {
  water: { name: 'WATER', color: 0x3f7fd6, acidic: false, rad: 0 },
  acid: { name: 'ACID', color: 0x9be23a, acidic: true, rad: 0.4 },
  gasoline: { name: 'GASOLINE', color: 0xb07830, acidic: false, rad: 0 },

  ethanol: { name: 'ETHANOL', color: 0xe0d060, acidic: false, rad: 0 },

  heavy_water: { name: 'HEAVY WATER', color: 0x2a4fa8, acidic: false, rad: 0 },

  nuclear_waste: { name: 'NUCLEAR WASTE', color: 0x2fd06a, acidic: true, rad: 2.5 },

  radaway: { name: 'RADAWAY', color: 0xbfe3e8, acidic: false, rad: 0, icon: 'assets/images/liquids/radaway.png' },
};


export const ITEM_DEFS = {
  stone: { code: 'ST', name: 'STONE', stack: 99, rad: 0, block: true, icon: 'assets/images/items/stone.png' },
  dirt: { code: 'DI', name: 'DIRT', stack: 99, rad: 0, block: true, icon: 'assets/images/items/dirt.png' },
  carbon: { code: 'C+', name: 'CARBON', stack: 99, rad: 0, block: true, icon: 'assets/images/items/carbon.png' },
  flower: { code: 'FL', name: 'FLOWER', stack: 99, rad: 0, block: false, icon: 'assets/images/vegetation/tall_flower.png' },
  herb: { code: 'HB', name: 'HERB', stack: 99, rad: 0, block: false, icon: 'assets/images/vegetation/grass_tall.png' },
  flour: { code: 'WH', name: 'FLOUR', stack: 99, rad: 0, block: false, icon: 'assets/images/items/flour.png' },
  wood: { code: 'WD', name: 'WOOD', stack: 99, rad: 0, block: false, icon: 'assets/images/items/wood.png' },
  sand: { code: 'SD', name: 'SAND', stack: 99, rad: 0, block: true, desc: 'Fine silica grit for glass and concrete work.' },
  gravel: { code: 'GV', name: 'GRAVEL', stack: 99, rad: 0, block: true, desc: 'Crushed rock used for fill, paths and cement mixes.' },
  glass: { code: 'GL', name: 'GLASS', stack: 99, rad: 0, block: true, desc: 'Melted silica, made by heating the clean mineral feedstock.' },
  silica: { code: 'SX', name: 'SILICA', stack: 99, rad: 0, block: false, desc: 'Pure silica powder from crushed stone.' },

  uranium: ORE('uranium', 'U!', { rad: 0.6, harvested: 'uranium', icon: 'assets/images/items/uranium.png' }),
  thorium: ORE('thorium', 'T!', { rad: 0.4 }),
  lead: ORE('lead', 'PB', { rad: 0.05, icon: 'assets/images/items/lead.png' }),
  copper: ORE('copper', 'CU', { icon: 'assets/images/items/copper.png' }),
  tin: ORE('tin', 'SN'),
  iron: ORE('iron', 'FE'),
  lithium: ORE('lithium', 'LI', { icon: 'assets/images/items/lithium.png' }),
  boron: ORE('boron', 'BO', { icon: 'assets/images/items/boron.png' }),
  magnesium: ORE('magnesium', 'MG'),
  zirconium: ORE('zirconium', 'ZR'),
  beryllium: ORE('beryllium', 'BE', { rad: 0.1, icon: 'assets/images/items/beryllium.png' }),
  polonium: ORE('polonium', 'PO', { rad: 0.7, icon: 'assets/images/items/polonium.png', desc: '*what did cw stand for again*' }),


  crushed_uranium: DUST('uranium', 'u1'),
  crushed_thorium: DUST('thorium', 't1'),
  crushed_lead: DUST('lead', 'p1'),
  crushed_copper: DUST('copper', 'c1'),
  crushed_tin: DUST('tin', 's1'),
  crushed_iron: DUST('iron', 'f1'),
  crushed_lithium: DUST('lithium', 'l1'),
  crushed_boron: DUST('boron', 'b1'),
  crushed_magnesium: DUST('magnesium', 'm1'),
  crushed_zirconium: DUST('zirconium', 'z1'),
  crushed_beryllium: DUST('beryllium', 'e1'),


  uranium_ingot: INGOT('uranium', 'U█', { rad: 0.5 }),
  thorium_ingot: INGOT('thorium', 'T█', { rad: 0.3 }),
  lead_ingot: INGOT('lead', 'P█'),
  copper_ingot: INGOT('copper', 'C█'),
  tin_ingot: INGOT('tin', 'S█'),
  iron_ingot: INGOT('iron', 'F█'),
  lithium_ingot: INGOT('lithium', 'L█'),
  boron_ingot: INGOT('boron', 'B█'),
  magnesium_ingot: INGOT('magnesium', 'M█'),
  zirconium_ingot: INGOT('zirconium', 'Z█'),
  beryllium_ingot: INGOT('beryllium', 'E█'),
  bronze_ingot: INGOT('bronze', 'BR'),
  steel_ingot: INGOT('steel', 'SL'),


  lead_plate: PLATE('lead', 'P▭'),
  copper_plate: PLATE('copper', 'C▭'),
  iron_plate: PLATE('iron', 'F▭'),
  steel_plate: PLATE('steel', 'S▭'),
  boron_plate: PLATE('boron', 'B▭'),
  zirconium_plate: PLATE('zirconium', 'Z▭'),


  plastic: I('PL', 'PLASTIC', { block: false, icon: 'assets/images/items/plastic.png' }),
  car_battery: I('BA', 'CAR BATTERY', { block: false, battery: true }),
  graphite: I('GR', 'GRAPHITE', { block: false }),
  carbon_mesh: I('CM', 'CARBON MESH', { block: false }),
  copper_solenoid: I('CS', 'COPPER SOLENOID', { block: false }),
  electric_motor: I('EM', 'ELECTRIC MOTOR', { block: false }),
  linear_actuator: I('LA', 'LINEAR ACTUATOR', { block: false }),

  circuit_basic: I('c1', 'BASIC CIRCUIT', { block: false, model: CIRCUIT_MODEL, tint: 0x58d06a }),
  circuit_mid: I('c3', 'MID CIRCUIT', { block: false, model: CIRCUIT_MODEL, tint: 0xd9a441 }),
  circuit_advanced: I('c2', 'ADVANCED CIRCUIT', { block: false, model: CIRCUIT_MODEL, tint: 0xd9534f }),
  machine_chassis: I('MC', 'MACHINE CHASSIS', { block: false }),
  reactor_casing: I('RC', 'REACTOR CASING', { block: false, rad: 0.05 }),
  control_rod: I('CR', 'GRAPHITE CONTROL ROD', { block: false, rod: { cool: 20, absorb: 0, mod: 0.08 }, desc: 'Steel-clad graphite. Moderates neutrons for a small output gain, but barely cools the core.' }),
  fuel_rod_casing: I('FC', 'FUEL ROD CASING', { block: false }),

  hafnium: I('HF', 'HAFNIUM', { block: false, rad: 0.2, desc: 'Neutron-hungry metal separated from zirconium; the basis of long-life control rods.' }),
  cadmium: I('CD', 'CADMIUM', { block: false, rad: 0.3, desc: 'Soft, toxic metal recovered from lead-zinc smelting. A classic thermal-neutron absorber.' }),
  boron_carbide: I('B4', 'BORON CARBIDE', { block: false, desc: 'B4C ceramic: boron and carbon fused into a hard, cheap neutron poison.' }),

  beryllium_rod: I('eC', 'BERYLLIUM REFLECTOR ROD', { block: false, rod: { cool: 30, absorb: 0, mod: 0.12 }, desc: 'Beryllium reflects neutrons back into the core. Weak cooling, strong reactivity gain.' }),
  cadmium_rod: I('cC', 'CADMIUM CONTROL ROD', { block: false, rod: { cool: 50, absorb: 0.22, mod: 0 }, desc: 'Cadmium soaks up thermal neutrons. Cheap and effective, but it poisons the reaction.' }),
  zirconium_rod: I('zC', 'ZIRCONIUM COOLANT ROD', { block: false, rod: { cool: 70, absorb: 0.05, mod: 0.02 }, desc: 'Zircaloy coolant channel: very low neutron cost for its cooling.' }),
  hafnium_rod: I('hR', 'HAFNIUM CONTROL ROD', { block: false, rod: { cool: 100, absorb: 0.16, mod: 0 }, desc: 'Hafnium absorbs neutrons without cadmium corrosion problems. A long-lived control rod.' }),
  boron_rod: I('bC', 'BORON CARBIDE CONTROL ROD', { block: false, rod: { cool: 150, absorb: 0.28, mod: 0 }, desc: 'B4C in zircaloy cladding: the workhorse absorber for high-power cores. Strong cooling, strong poisoning.' }),
  heavy_water_rod: I('dC', 'HEAVY WATER COOLANT ROD', { block: false, rod: { cool: 320, absorb: 0.04, mod: 0.10 }, desc: 'Sealed D2O channel. Best cooling in the game with a moderation bonus; needs heavy water to build.' }),
  drill_bit: I('DB', 'DRILL BIT', { block: false }),



  radiation_shielding_plate: I('rP', 'SHIELDING PLATE', { block: false, plate: { radShield: 2, defense: 1, carry: 0.1 }, icon: 'assets/images/items/radiation_shielding_plate.png' }),
  heavy_shielding_plate: I('hP', 'HEAVY SHIELDING PLATE', { block: false, plate: { radShield: 5, defense: 2, carry: 0.2 }, icon: 'assets/images/items/heavy_shielding_plate.png' }),
  advanced_shielding_plate: I('aP', 'ADVANCED SHIELDING PLATE', { block: false, plate: { radShield: 10, defense: 3, carry: 0.3 }, icon: 'assets/images/items/advanced_shielding_plate.png' }),


  u235: I('2U', 'URANIUM-235', { block: false, rad: 1.2 }),
  u238: I('8U', 'URANIUM-238', { block: false, rad: 0.2 }),
  u233: I('3U', 'URANIUM-233', { block: false, rad: 1.4 }),
  pu239: I('9P', 'PLUTONIUM-239', { block: false, rad: 2.5 }),
  th232: I('2T', 'THORIUM-232', { block: false, rad: 0.3 }),


  tbu_fuel: I('TB', 'TBU FUEL', { block: false, rad: 0.4, fuel: { power: 60, heat: 18, cool: 20, lifetime: 240, rad: 1 }, icon: 'assets/images/items/tbu_fuel.png' }),
  leu_235_fuel: I('L5', 'LEU-235 FUEL', { block: false, rad: 0.6, fuel: { power: 200, heat: 80, cool: 80, lifetime: 120, rad: 2 }, icon: 'assets/images/items/leu_235_fuel.png' }),
  heu_235_fuel: I('H5', 'HEU-235 FUEL', { block: false, rad: 1.2, fuel: { power: 800, heat: 640, cool: 650, lifetime: 120, rad: 5 }, icon: 'assets/images/items/heu_235_fuel.png' }),
  leu_233_fuel: I('L3', 'LEU-233 FUEL', { block: false, rad: 0.8, fuel: { power: 200, heat: 80, cool: 90, lifetime: 120, rad: 3 }, icon: 'assets/images/items/leu_233_fuel.png' }),
  lep_239_fuel: I('LP', 'LEP-239 FUEL', { block: false, rad: 1.0, fuel: { power: 400, heat: 200, cool: 200, lifetime: 60, rad: 4 }, icon: 'assets/images/items/lep_239_fuel.png' }),
  hep_239_fuel: I('HP', 'HEP-239 FUEL', { block: false, rad: 2.0, fuel: { power: 1600, heat: 1600, cool: 1600, lifetime: 60, rad: 8 }, icon: 'assets/images/items/hep_239_fuel.png' }),
  mox_239_fuel: I('MX', 'MOX-239 FUEL', { block: false, rad: 1.6, fuel: { power: 500, heat: 240, cool: 240, lifetime: 78, rad: 6 }, icon: 'assets/images/items/mox_239_fuel.png' }),
  leu_235_oxide: I('o5', 'LEU-235 OXIDE FUEL', { block: false, rad: 0.7, fuel: { power: 300, heat: 100, cool: 100, lifetime: 120, rad: 3 }, icon: 'assets/images/items/leu_235_oxide.png' }),
  heu_235_oxide: I('O5', 'HEU-235 OXIDE FUEL', { block: false, rad: 1.4, fuel: { power: 1200, heat: 800, cool: 800, lifetime: 120, rad: 6 }, icon: 'assets/images/items/heu_235_oxide.png' }),
  tbu_oxide: I('oB', 'TBU OXIDE FUEL', { block: false, rad: 0.5, fuel: { power: 90, heat: 25, cool: 30, lifetime: 240, rad: 2 }, icon: 'assets/images/items/tbu_oxide.png' }),


  depleted_tbu: I('dT', 'DEPLETED TBU', { block: false, rad: 1.5 }),
  depleted_leu: I('dL', 'DEPLETED LEU', { block: false, rad: 2.5 }),
  depleted_heu: I('dH', 'DEPLETED HEU', { block: false, rad: 5.0 }),
  depleted_lep: I('dP', 'DEPLETED LEP', { block: false, rad: 4.0 }),


  unrad_juice: I('UJ', 'UNRAD JUICE', { block: false, stack: 16, consumable: { dose: -120 }, icon: 'assets/images/items/unrad_juice.png' }),
  chelating_agent: I('CA', 'CHELATING AGENT', { block: false, stack: 99 }),
  iodine_pill: I('IP', 'IODINE PILL', { block: false, stack: 16, consumable: { dose: -40, shieldTime: 60 } }),


  neurozam_9: I('NZ', 'NEUROZAM-9', { block: false, stack: 8, consumable: { intake: 0.8, intakeTime: 1800 }, icon: 'assets/images/items/neurozam_9.png' }),

  stim: I('SI', 'STIM', { block: false, stack: 8, consumable: { intake: 0.25, intakeTime: 240 } }),


  cigarette_pack: I('CP', 'CIGARETTE PACK', { block: false, stack: 8, consumable: { smoke: 120, speed: 1.02 }, icon: 'assets/images/items/cigarette_pack.png' }),

  lighter: I('LT', 'LIGHTER', { block: false, stack: 1, icon: 'assets/images/items/lighter.png' }),

  cup_noodles: I('CN', 'CUP OF NOODLES', { block: false, stack: 8, consumable: { dose: -10, food: 35 }, icon: 'assets/images/items/cup_noodles.png' }),

  apple: I('AP', 'APPLE', { block: false, stack: 16, consumable: { food: 15 }, icon: 'assets/images/items/apple.png' }),
  orange: I('OR', 'ORANGE', { block: false, stack: 16, consumable: { food: 12 }, icon: 'assets/images/items/orange.png' }),
  pear: I('PR', 'PEAR', { block: false, stack: 16, consumable: { food: 12 }, icon: 'assets/images/items/pear.png' }),







  sugar: I('SG', 'SUGAR', { block: false }),
  noodles: I('ND', 'NOODLES', { block: false }),
  broth: I('BH', 'RAMEN BROTH', { block: false }),
  soda_can: I('SC', 'EMPTY SODA CAN', { block: false, stack: 64 }),


  jp_soy_sauce: I('JS', 'SOY SAUCE', { block: false, stack: 16, consumable: { food: 4 } }),
  jp_mirin: I('JM', 'MIRIN', { block: false, stack: 16, consumable: { food: 3 } }),
  jp_ponzu: I('JP', 'YUZU PONZU', { block: false, stack: 16, consumable: { food: 4 } }),
  jp_mayonnaise: I('JY', 'JAPANESE MAYONNAISE', { block: false, stack: 16, consumable: { food: 5 } }),
  jp_mustard: I('JU', 'JAPANESE MUSTARD', { block: false, stack: 16, consumable: { food: 3 } }),
  jp_chili_oil: I('JL', 'CHILI OIL', { block: false, stack: 16, consumable: { food: 4 } }),
  jp_wasabi: I('JW', 'WASABI PASTE', { block: false, stack: 16, consumable: { food: 4 } }),
  jp_ramune: I('JR', 'RAMUNE', { block: false, stack: 16, consumable: { food: 12 } }),


  ramen_shio: I('R1', 'SHIO RAMEN', { block: false, stack: 8, consumable: { food: 42, heal: 4, dose: -4 }, desc: 'A light salt-broth bowl.' }),
  ramen_miso: I('R2', 'MISO RAMEN', { block: false, stack: 8, consumable: { food: 46, heal: 5, dose: -5 }, desc: 'A rich fermented-soy bowl.' }),
  ramen_spicy: I('R3', 'SPICY RAMEN', { block: false, stack: 8, consumable: { food: 44, heal: 4, dose: -4 }, desc: 'Chili oil and a lot of red.' }),
  ramen_curry: I('R4', 'CURRY RAMEN', { block: false, stack: 8, consumable: { food: 50, heal: 5, dose: -5 }, desc: 'Curry powder in a noodle bowl. It works.' }),


  soda_poprosh: I('S1', 'POPRUSH COLA', { block: false, stack: 16, consumable: { food: 14 } }),
  soda_poprosh_light: I('S2', 'POPRUSH LIGHT', { block: false, stack: 16, consumable: { food: 12 } }),
  soda_poprosh_zero: I('S3', 'POPRUSH ZERO', { block: false, stack: 16, consumable: { food: 10 } }),
  soda_freshi: I('S4', 'FRESHI', { block: false, stack: 16, consumable: { food: 13 } }),
  soda_dr_elmer: I('S5', 'DR. ELMER', { block: false, stack: 16, consumable: { food: 13 } }),
  soda_ninfa_kola: I('S6', 'NINFA KOLA', { block: false, stack: 16, consumable: { food: 14 } }),
  soda_8_down: I('S7', '8 DOWN', { block: false, stack: 16, consumable: { food: 13 } }),
  soda_chanta: I('S8', 'CHANTA', { block: false, stack: 16, consumable: { food: 12 } }),
  soda_spike: I('S9', 'SPIKE', { block: false, stack: 16, consumable: { food: 16 } }),
  soda_hill_crew: I('S0', 'HILL CREW', { block: false, stack: 16, consumable: { food: 12 } }),





  astomeniuphen: I('AT', 'ASTOMENIUPHEN', { block: false, stack: 8, consumable: { cures: ['pain'], heal: 5 } }),
  bandage: I('BN', 'BANDAGE', { block: false, stack: 16, consumable: { cures: ['bleeding'], heal: 15 } }),
  band_aid: I('BD', 'BAND-AID', { block: false, stack: 16, consumable: { cures: ['bleeding'], heal: 5 } }),
  blood_pouch: I('BL', 'BLOOD POUCH', { block: false, stack: 4, consumable: { cures: ['bloodloss'], heal: 30 } }),
  blood_stim: I('BS', 'BLOOD STIM', { block: false, stack: 4, consumable: { cures: ['bloodloss', 'pain'], heal: 15 } }),
  eyedrops: I('EY', 'EYEDROPS', { block: false, stack: 8, consumable: { cures: ['eye'] } }),
  eyedrops_t2: I('E2', 'EYEDROPS T2', { block: false, stack: 8, consumable: { cures: ['eye', 'pain'] } }),
  recovery_pills: I('RP', 'FAST RECOVERY PILLS', { block: false, stack: 8, consumable: { cures: ['pain'], heal: 25 } }),
  first_aid_kit: I('FA', 'FIRST AID KIT', { block: false, stack: 4, consumable: { cures: ['bleeding', 'infection'], heal: 35 } }),
  first_aid_kit_t2: I('F2', 'FIRST AID KIT T2', { block: false, stack: 4, consumable: { cures: ['bleeding', 'infection', 'burn'], heal: 60 } }),
  irritation_cream: I('IR', 'IRRITATION CREAM', { block: false, stack: 8, consumable: { cures: ['burn'], heal: 5 } }),
  med_5: I('M5', 'MED-5', { block: false, stack: 8, consumable: { cures: ['poison', 'infection'], heal: 10 } }),
  mouthwash: I('MO', 'MOUTHWASH', { block: false, stack: 8, consumable: { cures: ['infection'] } }),
  povidone_iodine: I('PV', 'POVIDONE IODINE', { block: false, stack: 8, consumable: { cures: ['infection'], heal: 5 } }),
  ratiseptic: I('RS', 'ALUMINUM MAGNESIUM SYRUP', { block: false, stack: 8, consumable: { cures: ['infection'], heal: 10 } }),
  skin_recovery: I('SK', 'SKIN RECOVERY', { block: false, stack: 8, consumable: { cures: ['burn'], heal: 15 } }),
  inhaler: I('IH', 'INHALER', { block: false, stack: 8, consumable: { cures: ['respiratory'], heal: 10 } }),
  vaccine: I('VX', 'VACCINE', { block: false, stack: 4, consumable: { cures: ['infection'], immunity: 600 } }),





  jerry_can_black: I('JC', 'SMALL JERRY CAN', { block: false, stack: 1, container: { capacity: 10, tier: 1 }, icon: 'assets/images/items/jerry_can_black.png' }),
  jerry_can_green: I('JC+', 'JERRY CAN', { block: false, stack: 1, container: { capacity: 20, tier: 2 }, icon: 'assets/images/items/jerry_can_green.png' }),
  jerry_can_olive: I('JC++', 'LARGE JERRY CAN', { block: false, stack: 1, container: { capacity: 35, tier: 3 }, icon: 'assets/images/items/jerry_can_olive.png' }),
  jerry_can_red: I('JC#', 'FUEL JERRY CAN', { block: false, stack: 1, container: { capacity: 50, tier: 4 }, icon: 'assets/images/items/jerry_can_red.png' }),
  jerry_can_white: I('JCH', 'HAZMAT JERRY CAN', { block: false, stack: 1, container: { capacity: 75, tier: 5, acidProof: true }, icon: 'assets/images/items/jerry_can_white.png' }),

  fuel_carton: I('GA', 'GASOLINE CARTON', { block: false, stack: 1, container: { capacity: 5, tier: 0, filter: ['gasoline'] } }),

  radaway_iv: I('IV', 'RADAWAY IV BAG', { block: false, stack: 1, container: { capacity: 4, tier: 1, filter: ['radaway'], medical: true }, icon: 'assets/images/liquids/radaway.png' }),


  pipe: I('PI', 'PIPE', { block: false, stack: 64, pipeGrid: true }),
  fuel_generator: I('GG', 'GAS GENERATOR', { block: false, stack: 4, workbench: 'fuel_generator', desc: 'Burns gasoline or ethanol to make power. Fill it from a jerry can.' }),




  pick: { code: 'PK', name: 'PICKAXE', stack: 1, rad: 0, tool: { radius: 1.6, rate: 0.4, yield: 1.25, stone: 3, weak: 0.12, good: ['stone'], chop: { reach: 3.6, power: 0.45 } } },
  drill: { code: 'DR', name: 'DRILL', stack: 1, rad: 0.5, tool: { radius: 2.6, rate: 0.14, yield: 2, good: ['stone', 'dirt', 'grass'] } },
  shovel: { code: 'SH', name: 'SHOVEL', stack: 1, rad: 0, tool: { radius: 1.8, rate: 0.26, yield: 1, good: ['dirt', 'grass'] } },

  axe: { code: 'AX', name: 'STEEL AXE', stack: 1, rad: 0, tool: { radius: 1.5, rate: 0.42, yield: 1, weak: 0.1, good: [], chop: { reach: 5.0, power: 1 } } },

  hatchet: { code: 'HX', name: 'STEEL HATCHET', stack: 1, rad: 0, tool: { radius: 1.2, rate: 0.32, yield: 1, weak: 0.1, good: [] } },
  hoe: { code: 'HO', name: 'STEEL HOE', stack: 1, rad: 0, tool: { radius: 1.4, rate: 0.3, yield: 1, weak: 0.15, good: ['dirt', 'grass'] } },


  torch: { code: 'TO', name: 'TORCH', stack: 16, rad: 0, torch: true, light: { mount: 'wall', range: 12, power: 1.2, color: 0xff9d1f } },
  lantern: { code: 'LN', name: 'LANTERN', stack: 16, rad: 0, torch: true, light: { mount: 'floor', range: 18, power: 2.0, color: 0xffb454 } },
  floodlight: { code: 'FD', name: 'FLOODLIGHT', stack: 8, rad: 0, torch: true, light: { mount: 'wall', range: 30, power: 2.8, color: 0xd8e8ff } },
  geiger_counter: I('GC', 'GEIGER COUNTER', { block: false, stack: 1, geiger: true, icon: 'assets/images/items/geiger_counter.png' }),


  hazmat_helmet: I('hH', 'HAZMAT HELMET', { block: false, stack: 1, armor: { slot: 'head', defense: 1, radShield: 2, plateSlots: 1 } }),
  hazmat_chestplate: I('hC', 'HAZMAT CHESTPLATE', { block: false, stack: 1, armor: { slot: 'chest', defense: 2, radShield: 3, plateSlots: 2 } }),
  hazmat_leggings: I('hL', 'HAZMAT LEGGINGS', { block: false, stack: 1, armor: { slot: 'legs', defense: 2, radShield: 2, plateSlots: 1 } }),
  hazmat_boots: I('hB', 'HAZMAT BOOTS', { block: false, stack: 1, armor: { slot: 'feet', defense: 1, radShield: 2, plateSlots: 1 } }),
  lead_helmet: I('lH', 'LEAD HELMET', { block: false, stack: 1, armor: { slot: 'head', defense: 2, radShield: 4, plateSlots: 2 } }),
  lead_chestplate: I('lC', 'LEAD CHESTPLATE', { block: false, stack: 1, armor: { slot: 'chest', defense: 3, radShield: 6, plateSlots: 3 } }),
  lead_leggings: I('lL', 'LEAD LEGGINGS', { block: false, stack: 1, armor: { slot: 'legs', defense: 3, radShield: 4, plateSlots: 2 } }),
  lead_boots: I('lB', 'LEAD BOOTS', { block: false, stack: 1, armor: { slot: 'feet', defense: 2, radShield: 4, plateSlots: 2 } }),
  heavy_helmet: I('HH', 'HARDENED HELMET', { block: false, stack: 1, armor: { slot: 'head', defense: 3, radShield: 8, plateSlots: 3 } }),
  heavy_chestplate: I('HC', 'HARDENED CHESTPLATE', { block: false, stack: 1, armor: { slot: 'chest', defense: 4, radShield: 12, plateSlots: 4 } }),
  heavy_leggings: I('HL', 'HARDENED LEGGINGS', { block: false, stack: 1, armor: { slot: 'legs', defense: 4, radShield: 8, plateSlots: 3 } }),
  heavy_boots: I('HB', 'HARDENED BOOTS', { block: false, stack: 1, armor: { slot: 'feet', defense: 3, radShield: 8, plateSlots: 3 } }),

  hazmat_gloves: I('hG', 'HAZMAT GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 1, radShield: 1, carry: 0.4, plateSlots: 1 } }),
  lead_gloves: I('lG', 'LEAD-LINED GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 2, radShield: 2, carry: 0.7, plateSlots: 2 } }),
  heavy_gloves: I('HG', 'HARDENED GAUNTLETS', { block: false, stack: 1, armor: { slot: 'hands', defense: 3, radShield: 3, carry: 0.9, plateSlots: 3 } }),

  gardening_gloves: I('gG', 'GARDENING GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 0, radShield: 0, gardening: true, plateSlots: 1 } }),



  gun_barrel: I('Gb', 'GUN BARREL', { block: false }),
  gun_stock: I('Gs', 'GUN STOCK', { block: false }),
  gun_parts: I('Gp', 'GUN PARTS', { block: false }),
  shotgun_shell: I('Sh', 'SHOTGUN SHELL', { block: false }),

  ammo_9mm: I('9m', '9MM AMMO', { block: false, icon: 'assets/images/items/ammo_9mm.png' }),
  ammo_12g: I('12', '12 GAUGE SHELLS', { block: false, icon: 'assets/images/items/ammo_12g.png' }),
  ammo_38_special: I('38', '.38 SPECIAL AMMO', { block: false, icon: 'assets/images/items/ammo_38_special.png' }),
  ammo_50ae: I('50', '.50 AE AMMO', { block: false, icon: 'assets/images/items/ammo_50ae.png' }),
  ammo_auto: I('Au', 'AUTOMATIC AMMO', { block: false, icon: 'assets/images/items/ammo_auto.png' }),
  ammo_rifle: I('Rf', 'RIFLE AMMO', { block: false, icon: 'assets/images/items/ammo_rifle.png' }),
  ammo_hunting: I('Hu', 'HUNTING AMMO', { block: false, icon: 'assets/images/items/ammo_hunting.png' }),


  fast_ar: I('FA', 'FAST AR', { block: false, stack: 1, icon: 'assets/images/items/fast_ar.png' }),
  smg: I('SM', 'SMG', { block: false, stack: 1, icon: 'assets/images/items/smg.png' }),



  circuit_board: I('MB', 'CIRCUIT BOARD', { block: false, model: CIRCUIT_MODEL, tint: 0x4f8fe0, icon: 'assets/images/items/circuit_board.png' }),
  memory_module: I('MM', 'MEMORY MODULE', { block: false, icon: 'assets/images/items/memory_module.png' }),
  data_drive: I('DD', 'DATA DRIVE', { block: false, icon: 'assets/images/items/data_drive.png' }),
  data_disk: I('DK', 'DATA DISK', { block: false, icon: 'assets/images/items/data_disk.png' }),
  cooling_fan: I('FN', 'COOLING FAN', { block: false, icon: 'assets/images/items/cooling_fan.png' }),
  card_reader: I('RD', 'CARD READER', { block: false, icon: 'assets/images/items/card_reader.png' }),
  optic_lens: I('OL', 'OPTIC LENS', { block: false, icon: 'assets/images/items/optic_lens.png' }),
  timer_module: I('TM', 'TIMER MODULE', { block: false, icon: 'assets/images/items/timer_module.png' }),




  rdx: I('RDX', 'RDX', { block: false, desc: 'A high-explosive compound. Handle carefully.' }),

  detonator: I('DT', 'DETONATOR', { block: false, desc: 'Blasting cap wired to an arming circuit.' }),

  c4: I('C4', 'C4 CHARGE', { block: false, stack: 8, c4: true, desc: 'Place on the ground. Arms and detonates in 5 seconds.' }),


  manufactory: { code: 'MF', name: 'MANUFACTORY', stack: 16, rad: 0, block: false, workbench: 'manufactory', desc: 'A powered crafting bench. Each craft pulls power from the grid.' },
  crusher: { code: 'CR', name: 'CRUSHER', stack: 16, rad: 0, block: false, workbench: 'crusher', desc: 'Turns raw ore into dust so it can be smelted.' },
  electric_furnace: { code: 'EF', name: 'ELECTRIC FURNACE', stack: 16, rad: 0, block: false, workbench: 'electric_furnace', desc: 'Smelts crushed ore into ingots.' },
  ingot_former: { code: 'IF', name: 'INGOT FORMER', stack: 16, rad: 0, block: false, workbench: 'ingot_former', desc: 'Rolls ingots into flat plates.' },
  press: { code: 'PR', name: 'PRESS', stack: 16, rad: 0, block: false, workbench: 'press', desc: 'Stamps graphite, machine frames and other solid parts.' },
  alloy_furnace: { code: 'AF', name: 'ALLOY FURNACE', stack: 16, rad: 0, block: false, workbench: 'alloy_furnace', desc: 'Mixes metals into steel, bronze and other alloys.' },
  assembler: { code: 'AS', name: 'ASSEMBLER', stack: 16, rad: 0, block: false, workbench: 'assembler', desc: 'Builds machines from frames, circuits and motors.' },
  centrifuge: { code: 'CF', name: 'CENTRIFUGE', stack: 16, rad: 0.2, block: false, workbench: 'centrifuge', desc: 'Spins crushed fuel apart into isotopes.' },
  isotope_separator: { code: 'IS', name: 'ISOTOPE SEPARATOR', stack: 16, rad: 0.4, block: false, workbench: 'isotope_separator', desc: 'Packs isotopes into fuel rods. Also makes heavy water.' },
  fuel_reprocessor: { code: 'FR', name: 'FUEL REPROCESSOR', stack: 16, rad: 0.6, block: false, workbench: 'fuel_reprocessor', desc: 'Breaks spent fuel down and pulls usable material back out. It is hot.' },
  chemical_reactor: { code: 'Ch', name: 'CHEMICAL REACTOR', stack: 16, rad: 0, block: false, workbench: 'chemical_reactor', desc: 'Brews chemicals for medicine and chelating agents.' },
  crystallizer: { code: 'CY', name: 'CRYSTALLIZER', stack: 16, rad: 0, block: false, workbench: 'crystallizer', desc: 'Grows shielding plates out of boron and lead.' },
  decay_generator: { code: 'DG', name: 'DECAY GENERATOR', stack: 16, rad: 0.3, block: false, workbench: 'decay_generator', desc: 'Burns depleted fuel for steady power. It gives off a little radiation.' },
  fission_reactor: { code: 'RX', name: 'FISSION REACTOR', stack: 4, rad: 0, block: false, workbench: 'fission_reactor', desc: 'Burns fuel rods for real power. Keep it cool or it blows.' },
  solar_panel: { code: 'SP', name: 'SOLAR PANEL', stack: 16, rad: 0, block: false, workbench: 'solar_panel', desc: 'Makes a little power in daylight. No fuel needed.' },
  energy_storage: { code: 'ES', name: 'ENERGY STORAGE', stack: 16, rad: 0, block: false, workbench: 'energy_storage', desc: 'Holds a large charge for when generation dips.' },
  cable: { code: 'CB', name: 'POWER CABLE', stack: 64, rad: 0, block: false, icon: 'assets/images/items/cable.png' },
  wooden_powerpole: { code: 'WP', name: 'WOODEN POWERPOLE', stack: 16, rad: 0, block: false, workbench: 'cable', desc: 'Links nearby machines into one power grid.' },
  excavator: { code: 'EX', name: 'EXCAVATOR', stack: 4, rad: 0, block: false, workbench: 'excavator', desc: 'Drills the ore seam under it and keeps what it finds.' },
  armor_workbench: { code: 'AW', name: 'ARMOR WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'armor_workbench', desc: 'Fits shielding plates into armor. Drop a plate on the piece.' },
  geiger_block: { code: 'GB', name: 'GEIGER BLOCK', stack: 16, rad: 0, block: false, workbench: 'geiger_block', desc: 'Reads the radiation around it.' },
  radiation_absorber: { code: 'RA', name: 'RADIATION ABSORBER', stack: 16, rad: 0, block: false, workbench: 'radiation_absorber', desc: 'Pulls radiation out of the air. Eats lead plates.' },
  decontaminator: { code: 'DC', name: 'DECONTAMINATOR', stack: 16, rad: 0, block: false, workbench: 'decontaminator', desc: 'Turns spent fuel into iodine pills.' },
  gun_workbench: { code: 'GW', name: 'GUN WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'gun_workbench', desc: 'Hand cranked bench for guns and ammo. No power needed.' },
  medicine_workbench: { code: 'MW', name: 'MEDICINE WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'medicine_workbench', desc: 'Makes anti rad drugs and medical supplies.' },
  liquid_mixer: { code: 'LM', name: 'LIQUID MIXER', stack: 16, rad: 0, block: false, workbench: 'liquid_mixer', desc: 'Refines and blends liquids like gasoline, ethanol and RadAway.' },
  rtg: { code: 'RT', name: 'RTG', stack: 16, rad: 0, block: false, workbench: 'rtg', desc: 'Makes power from whatever radioactive item sits in its slot.' },
  test_bench: { code: 'T#', name: 'TEST BENCH', stack: 16, rad: 0, block: false, workbench: 'test_bench', desc: 'Drop in a car battery for a quick burst of power.' },
};








export const ITEM_MODEL_ICON_EXCLUDE = new Set([
]);







export const ORE_REGION_SIZE = 16;
const REGION_ORES = [
  ['stone', 30], ['carbon', 6], ['copper', 9], ['tin', 6], ['iron', 11], ['lead', 7],
  ['uranium', 5], ['lithium', 5], ['boron', 6], ['magnesium', 5], ['zirconium', 3],
  ['beryllium', 3], ['thorium', 2], ['polonium', 2],
];
export const REGION_ORE_WEIGHT = REGION_ORES.reduce((s, [, w]) => s + w, 0);
export const REGION_ORE_IDS = REGION_ORES.map(([id]) => id);

function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function regionOre(x, z) {
  let r = hash2(Math.floor(x / ORE_REGION_SIZE), Math.floor(z / ORE_REGION_SIZE)) * REGION_ORE_WEIGHT;
  for (const [id, w] of REGION_ORES) { r -= w; if (r <= 0) return id; }
  return 'stone';
}








const MODEL = (id) => `assets/models/workbenches/${id}.gltf`;
const LAYOUT = (id) => `assets/ui/${id}.json`;

export const MACHINE_DEFS = [

  { id: 'manufactory', kind: 'crafting', name: 'MANUFACTORY', model: MODEL('manufactory'), layout: LAYOUT('manufactory'), label: 'Use manufactory', height: 1.2, dx: 2.8, dz: 1.8, energy: { craft: 40 }, capacity: 2000 },
  { id: 'armor_workbench', kind: 'armor', name: 'ARMOR WORKBENCH', model: MODEL('armor_workbench'), layout: LAYOUT('armor_workbench'), label: 'Use armor workbench', height: 1.2, dx: 2.8, dz: 1.8 },



  { id: 'gun_workbench', kind: 'processor', name: 'GUN WORKBENCH', model: MODEL('gun_workbench'), layout: LAYOUT('gun_workbench'), label: 'Use gun workbench', height: 1.2, dx: 2.8, dz: 1.8,
    recipes: [
      { in: { gun_barrel: 3, gun_stock: 2, gun_parts: 2, steel_plate: 2 }, out: { fast_ar: 1 }, time: 12 },
      { in: { gun_barrel: 1, gun_stock: 1, gun_parts: 3, iron_plate: 2 }, out: { smg: 1 }, time: 10 },
      { in: { lead_ingot: 1, carbon: 1, copper_ingot: 1 }, out: { shotgun_shell: 4 }, time: 3 },

      { in: { lead_ingot: 4, copper_ingot: 2, gun_parts: 1 }, out: { ammo_50ae: 4 }, time: 5 },
      { in: { lead_ingot: 3, copper_ingot: 2, steel_plate: 1 }, out: { ammo_rifle: 6 }, time: 4 },
      { in: { lead_ingot: 2, copper_ingot: 2, gun_parts: 2 }, out: { ammo_auto: 12 }, time: 5 },
      { in: { lead_ingot: 2, copper_ingot: 1, gun_parts: 1 }, out: { ammo_38_special: 6 }, time: 3 },
      { in: { lead_ingot: 1, copper_ingot: 1, gun_parts: 1 }, out: { ammo_9mm: 8 }, time: 3 },
      { in: { lead_ingot: 3, carbon: 2, steel_plate: 1 }, out: { ammo_hunting: 6 }, time: 4 },
      { in: { lead_ingot: 1, carbon: 3 }, out: { ammo_12g: 6 }, time: 3 },

      { in: { copper_solenoid: 1, circuit_basic: 1, graphite: 2 }, out: { detonator: 1 }, time: 6 },
      { in: { rdx: 2, detonator: 1, plastic: 2, timer_module: 1, card_reader: 1 }, out: { c4: 2 }, time: 12 },
    ] },

  { id: 'crusher', kind: 'processor', name: 'CRUSHER', model: MODEL('crusher'), layout: LAYOUT('crusher'), label: 'Use crusher', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 20 },
    recipes: [
      { in: { uranium: 1 }, out: { crushed_uranium: 2 }, time: 3, rad: 0.4 },
      { in: { thorium: 1 }, out: { crushed_thorium: 2 }, time: 3, rad: 0.2 },
      { in: { lead: 1 }, out: { crushed_lead: 2 }, time: 2 },
      { in: { copper: 1 }, out: { crushed_copper: 2 }, time: 2 },
      { in: { tin: 1 }, out: { crushed_tin: 2 }, time: 2 },
      { in: { iron: 1 }, out: { crushed_iron: 2 }, time: 2 },
      { in: { lithium: 1 }, out: { crushed_lithium: 2 }, time: 2 },
      { in: { boron: 1 }, out: { crushed_boron: 2 }, time: 2 },
      { in: { magnesium: 1 }, out: { crushed_magnesium: 2 }, time: 2 },
      { in: { zirconium: 1 }, out: { crushed_zirconium: 2 }, time: 2 },
      { in: { beryllium: 1 }, out: { crushed_beryllium: 2 }, time: 3, rad: 0.1 },
      { in: { stone: 1 }, out: { gravel: 2 }, time: 2 },
      { in: { gravel: 1 }, out: { sand: 2 }, time: 2 },
      { in: { stone: 2 }, out: { sand: 2 }, time: 3 },
      { in: { sand: 2 }, out: { silica: 1 }, time: 3 },
      { in: { stone: 1 }, out: { carbon: 1 }, time: 4 },
      { in: { herb: 1 }, out: { flour: 3 }, time: 2 },
    ] },
  { id: 'electric_furnace', kind: 'processor', name: 'ELECTRIC FURNACE', model: MODEL('electric_furnace'), layout: LAYOUT('electric_furnace'), label: 'Use electric furnace', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 30 },
    recipes: [
      { in: { crushed_uranium: 1 }, out: { uranium_ingot: 1 }, time: 3, rad: 0.3 },
      { in: { crushed_thorium: 1 }, out: { thorium_ingot: 1 }, time: 3, rad: 0.15 },
      { in: { crushed_lead: 1 }, out: { lead_ingot: 1 }, time: 2 },
      { in: { crushed_copper: 1 }, out: { copper_ingot: 1 }, time: 2 },
      { in: { crushed_tin: 1 }, out: { tin_ingot: 1 }, time: 2 },
      { in: { crushed_iron: 1 }, out: { iron_ingot: 1 }, time: 2 },
      { in: { crushed_lithium: 1 }, out: { lithium_ingot: 1 }, time: 2 },
      { in: { crushed_boron: 1 }, out: { boron_ingot: 1 }, time: 2 },
      { in: { crushed_magnesium: 1 }, out: { magnesium_ingot: 1 }, time: 2 },
      { in: { crushed_zirconium: 1 }, out: { zirconium_ingot: 1 }, time: 2 },
      { in: { crushed_beryllium: 1 }, out: { beryllium_ingot: 1 }, time: 3, rad: 0.1 },
    ] },
  { id: 'ingot_former', kind: 'processor', name: 'INGOT FORMER', model: MODEL('ingot_former'), layout: LAYOUT('ingot_former'), label: 'Use ingot former', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 25 },
    recipes: [
      { in: { lead_ingot: 1 }, out: { lead_plate: 1 }, time: 2 },
      { in: { copper_ingot: 1 }, out: { copper_plate: 1 }, time: 2 },
      { in: { iron_ingot: 1 }, out: { iron_plate: 1 }, time: 2 },
      { in: { steel_ingot: 1 }, out: { steel_plate: 1 }, time: 2.5 },
      { in: { boron_ingot: 1 }, out: { boron_plate: 1 }, time: 2.5 },
      { in: { zirconium_ingot: 1 }, out: { zirconium_plate: 1 }, time: 2.5 },
    ] },
  { id: 'press', kind: 'processor', name: 'PRESS', model: MODEL('press'), layout: LAYOUT('press'), label: 'Use press', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 40 },
    recipes: [
      { in: { carbon: 2 }, out: { graphite: 1 }, time: 3 },
      { in: { graphite: 2, iron_plate: 1 }, out: { machine_chassis: 1 }, time: 6 },
      { in: { copper_ingot: 2, iron_ingot: 1 }, out: { copper_solenoid: 1 }, time: 4 },
      { in: { steel_plate: 2, iron_ingot: 1 }, out: { fuel_rod_casing: 1 }, time: 5 },
      { in: { steel_plate: 3, lead_plate: 2 }, out: { radiation_shielding_plate: 1 }, time: 8 },
      { in: { beryllium_ingot: 3, steel_plate: 1 }, out: { beryllium_rod: 1 }, time: 6 },
      { in: { cadmium: 3, steel_plate: 1 }, out: { cadmium_rod: 1 }, time: 6 },
      { in: { zirconium_plate: 3, steel_plate: 1 }, out: { zirconium_rod: 1 }, time: 6 },
      { in: { hafnium: 3, steel_plate: 1 }, out: { hafnium_rod: 1 }, time: 7 },
      { in: { boron_carbide: 2, zirconium_plate: 2, steel_plate: 1 }, out: { boron_rod: 1 }, time: 8 },
    ] },
  { id: 'alloy_furnace', kind: 'processor', name: 'ALLOY FURNACE', model: MODEL('alloy_furnace'), layout: LAYOUT('alloy_furnace'), label: 'Use alloy furnace', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 45 },
    recipes: [
      { in: { iron_ingot: 1, carbon: 1 }, out: { steel_ingot: 1 }, time: 5 },
      { in: { copper_ingot: 3, tin_ingot: 1 }, out: { bronze_ingot: 4 }, time: 4 },
      { in: { carbon: 2, iron_ingot: 1 }, out: { carbon_mesh: 1 }, time: 6 },
      { in: { steel_ingot: 2, graphite: 1 }, out: { control_rod: 1 }, time: 6 },
      { in: { boron_ingot: 2, carbon: 1 }, out: { boron_carbide: 1 }, time: 6 },
    ] },
  { id: 'assembler', kind: 'processor', name: 'ASSEMBLER', model: MODEL('assembler'), layout: LAYOUT('assembler'), label: 'Use assembler', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 60 },
    recipes: [
      { in: { machine_chassis: 6, circuit_advanced: 4, electric_motor: 4, timer_module: 2, data_drive: 2, drill_bit: 8, steel_plate: 6 }, out: { excavator: 1 }, time: 45 },
      { in: { machine_chassis: 3, circuit_board: 3, control_rod: 4, reactor_casing: 4 }, out: { fission_reactor: 1 }, time: 30 },
      { in: { zirconium_plate: 2, steel_plate: 1, jerry_can_green: 1 }, liquidIn: [{ id: 'heavy_water', amount: 8 }],
        out: { jerry_can_green: 1, heavy_water_rod: 1 }, time: 14 },
      { in: { machine_chassis: 1, circuit_board: 1, electric_motor: 2, memory_module: 1 }, out: { centrifuge: 1 }, time: 12 },
      { in: { machine_chassis: 2, circuit_board: 2, copper_solenoid: 4, memory_module: 2 }, out: { isotope_separator: 1 }, time: 18 },
      { in: { machine_chassis: 2, circuit_board: 2, lead_plate: 8, data_drive: 1 }, out: { fuel_reprocessor: 1 }, time: 18 },
      { in: { machine_chassis: 1, copper_solenoid: 2, circuit_basic: 2, card_reader: 1 }, out: { chemical_reactor: 1 }, time: 12 },
      { in: { machine_chassis: 2, circuit_board: 1, copper_plate: 4, data_disk: 2 }, out: { energy_storage: 1 }, time: 10 },
      { in: { copper_plate: 2, iron_plate: 1 }, out: { cable: 8 }, time: 3 },
      { in: { machine_chassis: 1, circuit_basic: 2, iron_plate: 4, optic_lens: 1 }, out: { solar_panel: 1 }, time: 10 },
      { in: { machine_chassis: 1, circuit_board: 1, lead_plate: 8, timer_module: 1 }, out: { decay_generator: 1 }, time: 14 },
      { in: { machine_chassis: 1, copper_solenoid: 2, carbon: 2, cooling_fan: 1 }, out: { crystallizer: 1 }, time: 8 },
      { in: { machine_chassis: 1, circuit_basic: 1, lead_plate: 4, cooling_fan: 1 }, out: { radiation_absorber: 1 }, time: 8 },
      { in: { machine_chassis: 1, circuit_board: 1, lead_plate: 4, optic_lens: 1 }, out: { decontaminator: 1 }, time: 12 },
      { in: { machine_chassis: 1, circuit_advanced: 2, lead_plate: 4, memory_module: 1 }, out: { geiger_block: 1 }, time: 10 },
      { in: { circuit_advanced: 1, copper_plate: 1, graphite: 1 }, out: { circuit_basic: 2 }, time: 4 },
      { in: { circuit_mid: 2, circuit_board: 1, lead_plate: 1 }, out: { circuit_advanced: 1 }, time: 8 },
      { in: { lead_plate: 4, steel_plate: 4, carbon_mesh: 1 }, out: { advanced_shielding_plate: 1 }, time: 12 },
      { in: { steel_plate: 2, lead_plate: 2, iron_plate: 2 }, out: { heavy_shielding_plate: 1 }, time: 8 },
    ] },
  { id: 'centrifuge', kind: 'processor', name: 'CENTRIFUGE', model: MODEL('centrifuge'), layout: LAYOUT('centrifuge'), label: 'Use centrifuge', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 55 }, rad: 0.2,
    recipes: [
      { in: { crushed_uranium: 1 }, out: { u235: 1, u238: 3 }, time: 8, rad: 0.5 },
      { in: { crushed_thorium: 1 }, out: { th232: 1 }, time: 8, rad: 0.3 },
      { in: { crushed_zirconium: 2 }, out: { hafnium: 1 }, time: 10, rad: 0.1 },
      { in: { crushed_lead: 2 }, out: { cadmium: 1 }, time: 8, rad: 0.2 },
      { in: { depleted_leu: 1 }, out: { u238: 2, pu239: 1 }, time: 10, rad: 1 },
      { in: { depleted_heu: 1 }, out: { u235: 1, pu239: 2 }, time: 10, rad: 2 },
    ] },
  { id: 'isotope_separator', kind: 'processor', name: 'ISOTOPE SEPARATOR', model: MODEL('isotope_separator'), layout: LAYOUT('isotope_separator'), label: 'Use isotope separator', height: 1.6, dx: 2.8, dz: 1.8, energy: { use: 90 }, rad: 0.4,
    recipes: [
      { in: { fuel_rod_casing: 1, u235: 1, u238: 4 }, out: { leu_235_fuel: 1 }, time: 12, rad: 1 },
      { in: { fuel_rod_casing: 1, u235: 4, u238: 1 }, out: { heu_235_fuel: 1 }, time: 16, rad: 2 },
      { in: { fuel_rod_casing: 1, u233: 1, th232: 4 }, out: { leu_233_fuel: 1 }, time: 12, rad: 1 },
      { in: { fuel_rod_casing: 1, pu239: 1, u238: 4 }, out: { lep_239_fuel: 1 }, time: 14, rad: 2 },
      { in: { fuel_rod_casing: 1, pu239: 4, u238: 1 }, out: { hep_239_fuel: 1 }, time: 18, rad: 3 },
      { in: { fuel_rod_casing: 1, pu239: 1, u238: 1, th232: 3 }, out: { mox_239_fuel: 1 }, time: 14, rad: 2 },
      { in: { fuel_rod_casing: 1, th232: 1, u238: 4 }, out: { tbu_fuel: 1 }, time: 10, rad: 0.5 },
      { in: { leu_235_fuel: 1, carbon: 1 }, out: { leu_235_oxide: 1 }, time: 8 },
      { in: { heu_235_fuel: 1, carbon: 1 }, out: { heu_235_oxide: 1 }, time: 8 },
      { in: { tbu_fuel: 1, carbon: 1 }, out: { tbu_oxide: 1 }, time: 8 },

      { in: { lithium: 4, jerry_can_green: 1 }, liquidIn: [{ id: 'water', amount: 20 }],
        out: { jerry_can_green: 1 }, liquidOut: { id: 'heavy_water', amount: 12, container: 'jerry_can_green' }, time: 14 },
    ] },
  { id: 'fuel_reprocessor', kind: 'processor', name: 'FUEL REPROCESSOR', model: MODEL('fuel_reprocessor'), layout: LAYOUT('fuel_reprocessor'), label: 'Use fuel reprocessor', height: 1.6, dx: 2.8, dz: 1.8, energy: { use: 80 }, rad: 0.8,
    recipes: [
      { in: { depleted_tbu: 1 }, out: { th232: 1 }, time: 12, rad: 2 },
      { in: { depleted_leu: 1 }, out: { u238: 2, pu239: 1 }, time: 14, rad: 3 },
      { in: { depleted_heu: 1, jerry_can_white: 1 }, out: { u235: 1, pu239: 2, jerry_can_white: 1 }, liquidOut: { id: 'nuclear_waste', amount: 6, container: 'jerry_can_white' }, time: 14, rad: 4 },
      { in: { depleted_lep: 1 }, out: { pu239: 2, u238: 1 }, time: 14, rad: 3 },
    ] },
  { id: 'chemical_reactor', kind: 'processor', name: 'CHEMICAL REACTOR', model: MODEL('chemical_reactor'), layout: LAYOUT('chemical_reactor'), label: 'Use chemical reactor', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 35 },
    recipes: [

      { in: { herb: 3, carbon: 2, iodine_pill: 1 }, out: { chelating_agent: 2 }, time: 10 },
      { in: { herb: 1, carbon: 1 }, out: { iodine_pill: 2 }, time: 6 },

      { in: { carbon: 3, plastic: 2, magnesium: 1 }, out: { rdx: 2 }, time: 14 },
    ] },
  { id: 'crystallizer', kind: 'processor', name: 'CRYSTALLIZER', model: MODEL('crystallizer'), layout: LAYOUT('crystallizer'), label: 'Use crystallizer', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 40 },
    recipes: [
      { in: { crushed_boron: 2, lead_ingot: 1 }, out: { heavy_shielding_plate: 1 }, time: 10 },
    ] },


  { id: 'liquid_mixer', kind: 'processor', name: 'LIQUID MIXER', model: MODEL('liquid_mixer'), layout: LAYOUT('liquid_mixer'), label: 'Use liquid mixer', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 25 },
    recipes: [

      { in: { carbon: 6, iron_plate: 1, jerry_can_red: 1 }, liquidIn: [{ id: 'water', amount: 6 }],
        out: { iron_plate: 1, jerry_can_red: 1 }, liquidOut: { id: 'gasoline', amount: 6, container: 'jerry_can_red' }, time: 12 },

      { in: { plastic: 2, jerry_can_red: 1 }, out: { jerry_can_red: 1 },
        liquidOut: { id: 'gasoline', amount: 3, container: 'jerry_can_red' }, time: 6 },

      { in: { herb: 6, jerry_can_black: 1 }, liquidIn: [{ id: 'water', amount: 4 }],
        out: { jerry_can_black: 1 }, liquidOut: { id: 'ethanol', amount: 8, container: 'jerry_can_black' }, time: 8 },

      { in: { chelating_agent: 2, radaway_iv: 1 }, liquidIn: [{ id: 'water', amount: 4 }],
        out: { radaway_iv: 1 }, liquidOut: { id: 'radaway', amount: 4, container: 'radaway_iv' }, time: 10 },
      { in: { jerry_can_white: 1, jerry_can_green: 1 }, liquidIn: [{ id: 'acid', amount: 1 }, { id: 'water', amount: 4 }], out: { jerry_can_white: 1, jerry_can_green: 1 }, liquidOut: { id: 'acid', amount: 5, container: 'jerry_can_white' }, time: 8 },
    ] },


  { id: 'solar_panel', kind: 'generator', name: 'SOLAR PANEL', model: MODEL('solar_panel'), layout: LAYOUT('solar_panel'), label: 'Open solar panel', height: 0.9, dx: 2.8, dz: 1.8, energy: { gen: 12, dayOnly: true } },


  { id: 'rtg', kind: 'generator', name: 'RTG', model: MODEL('rtg'), layout: LAYOUT('rtg'), label: 'Open RTG', height: 1.0, dx: 2.8, dz: 1.8, rtg: true, rad: 0.05 },

  { id: 'test_bench', kind: 'generator', name: 'TEST BENCH', model: MODEL('test_bench'), layout: LAYOUT('test_bench'), label: 'Open test bench', height: 1.2, dx: 2.8, dz: 1.8, energy: { gen: 150 }, battery: { life: 180 } },

  { id: 'fuel_generator', kind: 'generator', name: 'GAS GENERATOR', model: 'assets/models/workbenches/fuel_generator.glb', layout: LAYOUT('fuel_generator'), label: 'Open gas generator', height: 1.7, dx: 2.8, dz: 1.8, energy: { gen: 60 }, liquidFuel: { burn: { gasoline: 0.02, ethanol: 0.035 } } },
  { id: 'decay_generator', kind: 'generator', name: 'DECAY GENERATOR', model: MODEL('decay_generator'), layout: LAYOUT('decay_generator'), label: 'Open decay generator', height: 1.3, dx: 2.8, dz: 1.8, energy: { gen: 25 }, rad: 0.3,
    recipes: [ { in: { depleted_tbu: 1 }, out: {}, time: 120, fuel: true, rad: 0.4, power: 25 } ] },
  { id: 'fission_reactor', kind: 'reactor', name: 'FISSION REACTOR', model: MODEL('fission_reactor'), layout: LAYOUT('fission_reactor'), label: 'Open fission reactor', height: 2.2, dx: 3.2, dz: 2.2,
    heatMax: 1000, coolPerWater: 120, coolPerHeavy: 320, rodSlots: REACTOR_ROD_SLOTS, radActive: 3,
    smoke: { at: [0, 4, -1.9], dir: [0, 0, -1], rate: 14, spread: 0.75, speed: 0.7, life: 3.2, size: 0.55 } },
  { id: 'energy_storage', kind: 'storage', name: 'ENERGY STORAGE', model: MODEL('energy_storage'), layout: LAYOUT('energy_storage'), label: 'Open energy storage', height: 1.3, dx: 2.8, dz: 1.8, capacity: 20000 },
  { id: 'cable', kind: 'cable', name: 'WOODEN POWERPOLE', model: MODEL('cable'), layout: LAYOUT('cable'), label: 'Wooden powerpole', height: 3.2, reach: 1.6, dx: 2.8, dz: 1.8 },


  { id: 'excavator', kind: 'excavator', name: 'EXCAVATOR', model: MODEL('excavator'), layout: LAYOUT('excavator'), label: 'Open excavator', height: 3.0, dx: 3.2, dz: 2.2, sink: 0.083, energy: { use: 120 },
    outputs: 9, drillRate: 1.2, spin: 'cylinder', spinRate: 7 },
  { id: 'geiger_block', kind: 'geiger', name: 'GEIGER BLOCK', model: MODEL('geiger_block'), layout: LAYOUT('geiger_block'), label: 'Read geiger block', height: 1.0, dx: 2.8, dz: 1.8 },
  { id: 'radiation_absorber', kind: 'absorber', name: 'RADIATION ABSORBER', model: MODEL('radiation_absorber'), layout: LAYOUT('radiation_absorber'), label: 'Open radiation absorber', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 50 }, absorbRadius: 12, absorbRate: 0.6,
    recipes: [ { in: { lead_plate: 1 }, out: {}, time: 30, fuel: true } ] },
  { id: 'decontaminator', kind: 'processor', name: 'DECONTAMINATOR', model: MODEL('decontaminator'), layout: LAYOUT('decontaminator'), label: 'Use decontaminator', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 40 },
    recipes: [
      { in: { depleted_leu: 1 }, out: { iodine_pill: 3 }, time: 10, rad: 1 },
    ] },

  { id: 'medicine_workbench', kind: 'processor', name: 'MEDICINE WORKBENCH', model: MODEL('medicine_workbench'), layout: LAYOUT('medicine_workbench'), label: 'Use medicine workbench', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 30 },
    recipes: [


      { in: { first_aid_kit: 1, skin_recovery: 1, ratiseptic: 1 }, out: { first_aid_kit_t2: 1 }, time: 10 },
      { in: { bandage: 2, povidone_iodine: 1, plastic: 1 }, out: { first_aid_kit: 1 }, time: 8 },
      { in: { med_5: 1, povidone_iodine: 1, plastic: 2 }, out: { vaccine: 1 }, time: 10 },
      { in: { blood_pouch: 1, iodine_pill: 1 }, out: { blood_stim: 1 }, time: 6 },
      { in: { eyedrops: 2, iodine_pill: 1 }, out: { eyedrops_t2: 1 }, time: 6 },
      { in: { herb: 3, plastic: 2, iodine_pill: 1 }, out: { ratiseptic: 2 }, time: 7 },
      { in: { herb: 3, plastic: 1, iodine_pill: 1 }, out: { recovery_pills: 2 }, time: 6 },
      { in: { herb: 2, plastic: 2, iodine_pill: 1 }, out: { povidone_iodine: 2 }, time: 6 },
      { in: { herb: 2, plastic: 1, iodine_pill: 1 }, out: { med_5: 2 }, time: 5 },
      { in: { herb: 2, plastic: 1, carbon: 2 }, out: { inhaler: 2 }, time: 5 },
      { in: { herb: 3, plastic: 1, carbon: 1 }, out: { astomeniuphen: 2 }, time: 5 },
      { in: { herb: 2, plastic: 1, carbon: 1 }, out: { irritation_cream: 2 }, time: 5 },
      { in: { herb: 1, plastic: 1, carbon: 1 }, out: { mouthwash: 2 }, time: 4 },
      { in: { herb: 3, plastic: 2, unrad_juice: 1 }, out: { blood_pouch: 1 }, time: 8 },
      { in: { herb: 3, plastic: 1, unrad_juice: 1 }, out: { skin_recovery: 1 }, time: 7 },
      { in: { herb: 2, plastic: 1, unrad_juice: 1 }, out: { eyedrops: 2 }, time: 5 },
      { in: { herb: 2, plastic: 1 }, out: { bandage: 2 }, time: 4 },
      { in: { herb: 1, plastic: 1 }, out: { band_aid: 2 }, time: 3 },
      { in: { herb: 2, carbon: 1 }, out: { iodine_pill: 2 }, time: 5 },
      { in: { herb: 4, unrad_juice: 1, lead_ingot: 1 }, out: { neurozam_9: 2 }, time: 12 },

      { in: { radaway_iv: 1, plastic: 1 }, liquidIn: [{ id: 'radaway', amount: 1 }],
        out: { radaway_iv: 1, unrad_juice: 1 }, time: 6 },
      { in: { unrad_juice: 2, iodine_pill: 3, lead_plate: 2, herb: 6 }, out: { stim: 1 }, time: 20 },
    ] },
];

export const MACHINE_BY_ID = Object.fromEntries(MACHINE_DEFS.map((m) => [m.id, m]));



export function itemModelIcon(id) {
  const def = ITEM_DEFS[id];
  if (!def || ITEM_MODEL_ICON_EXCLUDE.has(id)) return null;
  if (def.workbench && MACHINE_BY_ID[def.workbench]) return MACHINE_BY_ID[def.workbench].model;
  return def.model || `assets/models/items/${id}.glb`;
}


export function modelTint(id) {
  return ITEM_DEFS[id]?.tint ?? null;
}


export const DEPLETED_OF = {
  tbu_fuel: 'depleted_tbu', tbu_oxide: 'depleted_tbu',
  leu_235_fuel: 'depleted_leu', leu_235_oxide: 'depleted_leu', leu_233_fuel: 'depleted_leu',
  heu_235_fuel: 'depleted_heu', heu_235_oxide: 'depleted_heu',
  lep_239_fuel: 'depleted_lep', hep_239_fuel: 'depleted_lep', mox_239_fuel: 'depleted_lep',
};






export const CRAFT_RECIPES = [






  { out: { jp_soy_sauce: 1 }, needs: { herb: 2, carbon: 2, plastic: 1 } },
  { out: { jp_wasabi: 1 }, needs: { herb: 1, carbon: 1, plastic: 1, sugar: 1 } },
  { out: { jp_mirin: 1 }, needs: { sugar: 1, herb: 1, plastic: 1 } },
  { out: { jp_ramune: 1 }, needs: { sugar: 1, carbon: 1, plastic: 1 } },
  { out: { jp_mayonnaise: 1 }, needs: { flour: 1, herb: 1, plastic: 1 } },
  { out: { jp_mustard: 1 }, needs: { flower: 1, sugar: 1, plastic: 1 } },
  { out: { jp_chili_oil: 1 }, needs: { carbon: 1, flower: 1, plastic: 1 } },
  { out: { jp_ponzu: 1 }, needs: { jp_soy_sauce: 1, orange: 1, plastic: 1 } },

  { out: { soda_ninfa_kola: 1 }, needs: { soda_can: 1, carbon: 2, sugar: 1, herb: 1 } },
  { out: { soda_spike: 1 }, needs: { soda_can: 1, herb: 2, carbon: 3 } },
  { out: { soda_poprosh: 1 }, needs: { soda_can: 1, sugar: 2, carbon: 1 } },
  { out: { soda_poprosh_light: 1 }, needs: { soda_can: 1, sugar: 1, herb: 1 } },
  { out: { soda_poprosh_zero: 1 }, needs: { soda_can: 1, herb: 2, carbon: 2 } },
  { out: { soda_freshi: 1 }, needs: { soda_can: 1, apple: 1, sugar: 1 } },
  { out: { soda_dr_elmer: 1 }, needs: { soda_can: 1, herb: 3, carbon: 1 } },
  { out: { soda_8_down: 1 }, needs: { soda_can: 1, orange: 1, sugar: 1 } },
  { out: { soda_chanta: 1 }, needs: { soda_can: 1, pear: 1, sugar: 1 } },
  { out: { soda_hill_crew: 1 }, needs: { soda_can: 1, flower: 1, sugar: 1 } },

  { out: { ramen_curry: 1 }, needs: { noodles: 1, broth: 1, jp_soy_sauce: 1, jp_chili_oil: 1 } },
  { out: { ramen_miso: 1 }, needs: { noodles: 1, broth: 1, jp_mirin: 1, sugar: 1 } },
  { out: { ramen_shio: 1 }, needs: { noodles: 1, broth: 1, jp_wasabi: 1 } },
  { out: { ramen_spicy: 1 }, needs: { noodles: 1, broth: 1, jp_chili_oil: 1 } },

  { out: { broth: 1 }, needs: { herb: 2, carbon: 1, plastic: 1 } },
  { out: { noodles: 1 }, needs: { flour: 2, carbon: 1 } },
  { out: { soda_can: 6 }, needs: { tin_ingot: 3 } },



  { out: { iron_ingot: 1 }, needs: { iron: 2, carbon: 1 } },
  { out: { copper_ingot: 1 }, needs: { copper: 2, carbon: 1 } },
  { out: { tin_ingot: 1 }, needs: { tin: 2, carbon: 1 } },
  { out: { bronze_ingot: 2 }, needs: { copper_ingot: 1, tin_ingot: 1 } },
  { out: { circuit_basic: 1 }, needs: { copper_plate: 1, graphite: 1 } },
  { out: { circuit_mid: 1 }, needs: { circuit_basic: 2, graphite: 1 } },
  { out: { circuit_advanced: 1 }, needs: { circuit_mid: 2, graphite: 1, lead_plate: 1 } },
  { out: { electric_motor: 1 }, needs: { copper_solenoid: 1, steel_ingot: 2 } },
  { out: { copper_solenoid: 1 }, needs: { copper_ingot: 2, iron_ingot: 1 } },
  { out: { linear_actuator: 1 }, needs: { copper_solenoid: 1, iron_plate: 2 } },
  { out: { machine_chassis: 1 }, needs: { steel_plate: 2, iron_plate: 2 } },
  { out: { fuel_rod_casing: 1 }, needs: { steel_plate: 1, lead_plate: 1, iron_ingot: 1 } },
  { out: { reactor_casing: 1 }, needs: { steel_plate: 2, lead_plate: 2, graphite: 1 } },
  { out: { control_rod: 1 }, needs: { steel_ingot: 1, graphite: 1, boron_ingot: 1 } },
  { out: { radiation_shielding_plate: 1 }, needs: { lead_plate: 2, steel_plate: 1 } },
  { out: { heavy_shielding_plate: 1 }, needs: { radiation_shielding_plate: 1, lead_plate: 2, carbon_mesh: 1 } },
  { out: { drill_bit: 1 }, needs: { steel_ingot: 2, iron_ingot: 1 } },
  { out: { hazmat_helmet: 1 }, needs: { iron_plate: 1, carbon_mesh: 1 } },
  { out: { hazmat_chestplate: 1 }, needs: { iron_plate: 2, carbon_mesh: 1 } },
  { out: { hazmat_leggings: 1 }, needs: { iron_plate: 2, carbon_mesh: 1 } },
  { out: { hazmat_boots: 1 }, needs: { iron_plate: 1, carbon_mesh: 1 } },
  { out: { lead_helmet: 1 }, needs: { lead_plate: 3, steel_ingot: 1 } },
  { out: { lead_chestplate: 1 }, needs: { lead_plate: 6, steel_ingot: 2 } },
  { out: { lead_leggings: 1 }, needs: { lead_plate: 5, steel_ingot: 2 } },
  { out: { lead_boots: 1 }, needs: { lead_plate: 3, steel_ingot: 1 } },
  { out: { heavy_helmet: 1 }, needs: { lead_plate: 3, steel_plate: 2, advanced_shielding_plate: 1 } },
  { out: { heavy_chestplate: 1 }, needs: { lead_plate: 6, steel_plate: 4, advanced_shielding_plate: 2 } },
  { out: { heavy_leggings: 1 }, needs: { lead_plate: 5, steel_plate: 3, advanced_shielding_plate: 1 } },
  { out: { heavy_boots: 1 }, needs: { lead_plate: 3, steel_plate: 2, advanced_shielding_plate: 1 } },
  { out: { gardening_gloves: 1 }, needs: { carbon_mesh: 2, iron_ingot: 1 } },
  { out: { hazmat_gloves: 1 }, needs: { iron_plate: 1, carbon_mesh: 1 } },
  { out: { lead_gloves: 1 }, needs: { lead_plate: 2, steel_ingot: 1 } },
  { out: { heavy_gloves: 1 }, needs: { lead_plate: 2, steel_plate: 2, advanced_shielding_plate: 1 } },


  { out: { cigarette_pack: 1 }, needs: { herb: 3, carbon: 2 } },


  { out: { sugar: 1 }, needs: { herb: 2, carbon: 1 } },

  { out: { lighter: 1 }, needs: { plastic: 2, iron_ingot: 1, carbon: 1 } },

  { out: { car_battery: 1 }, needs: { plastic: 4, lead_plate: 3 } },

  { out: { plastic: 2 }, needs: { carbon: 2 } },
  { out: { flour: 1 }, needs: { herb: 1 } },
  { out: { cup_noodles: 1 }, needs: { plastic: 1, flour: 2 } },


  { out: { floodlight: 1 }, needs: { steel_ingot: 2, copper_plate: 1, circuit_basic: 1 } },
  { out: { lantern: 2 }, needs: { iron_ingot: 2, carbon: 2 } },
  { out: { torch: 4 }, needs: { carbon: 1 } },


  { out: { jerry_can_black: 1 }, needs: { iron_ingot: 2 } },
  { out: { jerry_can_green: 1 }, needs: { iron_ingot: 4, copper_plate: 1 } },
  { out: { jerry_can_olive: 1 }, needs: { steel_ingot: 3, copper_plate: 2 } },
  { out: { jerry_can_red: 1 }, needs: { steel_ingot: 5, copper_plate: 2, lead_plate: 1 } },
  { out: { jerry_can_white: 1 }, needs: { steel_ingot: 4, lead_plate: 4, carbon_mesh: 2 } },
  { out: { radaway_iv: 1 }, needs: { plastic: 2 } },
  { out: { fuel_carton: 2 }, needs: { carbon: 1, iron_plate: 2 } },
  { out: { pipe: 8 }, needs: { iron_ingot: 1 } },
  { out: { fuel_generator: 1 }, needs: { machine_chassis: 1, copper_solenoid: 1, circuit_basic: 1, iron_plate: 4 } },
  { out: { pick: 1 }, needs: { iron_ingot: 3, carbon: 1 } },
  { out: { shovel: 1 }, needs: { iron_ingot: 1, carbon: 1 } },

  { out: { axe: 1 }, needs: { steel_ingot: 3, wood: 2 } },
  { out: { hatchet: 1 }, needs: { steel_ingot: 2, wood: 2 } },
  { out: { hoe: 1 }, needs: { steel_ingot: 2, wood: 2 } },
  { out: { drill: 1 }, needs: { steel_ingot: 3, circuit_basic: 1, electric_motor: 1 } },
  { out: { geiger_counter: 1 }, needs: { circuit_basic: 1, lead_plate: 1, copper_plate: 1 } },
  { out: { graphite: 1 }, needs: { carbon: 2 } },
  { out: { carbon_mesh: 1 }, needs: { carbon: 3 } },


  { out: { gun_barrel: 1 }, needs: { steel_ingot: 2, iron_plate: 1 } },
  { out: { gun_stock: 1 }, needs: { steel_plate: 1, carbon_mesh: 1 } },
  { out: { gun_parts: 1 }, needs: { iron_ingot: 1, iron_plate: 1, copper_plate: 1 } },



  { out: { circuit_board: 1 }, needs: { copper_plate: 2, carbon_mesh: 1, lead_plate: 1 } },
  { out: { memory_module: 1 }, needs: { circuit_board: 1, copper_plate: 2 } },
  { out: { data_drive: 1 }, needs: { circuit_board: 1, steel_plate: 1, copper_solenoid: 1 } },
  { out: { data_disk: 1 }, needs: { circuit_board: 1, carbon_mesh: 1, copper_plate: 1 } },
  { out: { cooling_fan: 1 }, needs: { circuit_board: 1, iron_plate: 2, tin_ingot: 1 } },
  { out: { card_reader: 1 }, needs: { circuit_board: 1, iron_plate: 1, copper_plate: 1 } },
  { out: { optic_lens: 1 }, needs: { circuit_board: 1, graphite: 2 } },
  { out: { timer_module: 1 }, needs: { circuit_board: 1, copper_solenoid: 1, lead_plate: 1 } },





  { out: { manufactory: 1 }, needs: { iron_ingot: 3, carbon: 2 } },
  { out: { rtg: 1 }, needs: { iron_ingot: 4, lead: 3, copper_ingot: 1 } },
  { out: { armor_workbench: 1 }, needs: { iron_ingot: 2, carbon: 2 } },
  { out: { gun_workbench: 1 }, needs: { iron_ingot: 5, carbon: 3 } },
  { out: { medicine_workbench: 1 }, needs: { iron_ingot: 4, carbon: 2, copper_plate: 1 } },
  { out: { liquid_mixer: 1 }, needs: { iron_ingot: 4, copper_ingot: 2, carbon: 2 } },
  { out: { crusher: 1 }, needs: { iron_ingot: 5, carbon: 2 } },
  { out: { electric_furnace: 1 }, needs: { iron_ingot: 5, carbon: 3 } },
  { out: { cable: 6 }, needs: { copper_ingot: 2, iron_ingot: 1 } },
  { out: { wooden_powerpole: 1 }, needs: { cable: 5, wood: 3 } },
  { out: { ingot_former: 1 }, needs: { iron_ingot: 4, copper_ingot: 2 } },
  { out: { press: 1 }, needs: { iron_ingot: 4, tin_ingot: 2 } },
  { out: { alloy_furnace: 1 }, needs: { iron_ingot: 6, carbon: 4 } },
  { out: { assembler: 1 }, needs: { machine_chassis: 2, circuit_advanced: 1, electric_motor: 1 } },

  { out: { test_bench: 1 }, needs: { iron_ingot: 2, car_battery: 1, copper_plate: 2 } },
];





const TABLE_OUTPUTS = new Set([

  'iron_ingot', 'copper_ingot', 'tin_ingot', 'torch', 'lantern', 'graphite', 'carbon_mesh',
  'cigarette_pack', 'lighter', 'jerry_can_black', 'plastic', 'flour', 'cup_noodles',

  'sugar', 'noodles', 'broth', 'soda_can',
  'jp_soy_sauce', 'jp_mirin', 'jp_ponzu', 'jp_mayonnaise', 'jp_mustard', 'jp_chili_oil',
  'jp_wasabi', 'jp_ramune',
  'ramen_shio', 'ramen_miso', 'ramen_spicy', 'ramen_curry',
  'soda_poprosh', 'soda_poprosh_light', 'soda_poprosh_zero', 'soda_freshi',
  'soda_dr_elmer', 'soda_ninfa_kola', 'soda_8_down', 'soda_chanta', 'soda_spike',
  'soda_hill_crew',
  'bronze_ingot', 'circuit_basic', 'pick', 'shovel', 'copper_solenoid',
  'drill_bit', 'gardening_gloves', 'test_bench',

  'manufactory', 'armor_workbench', 'gun_workbench', 'crusher', 'electric_furnace', 'cable', 'wooden_powerpole', 'liquid_mixer',
  'rtg',
  'pipe', 'fuel_carton',
]);
export const TABLE_RECIPES = CRAFT_RECIPES.filter((r) => TABLE_OUTPUTS.has(Object.keys(r.out)[0]));






export function layoutFor(def) {
  const theme = { background: '#0b0d0c', panel: '#111111', line: '#ffffff', accent: '#ffffff', text: '#ffffff' };
  const el = [];
  const title = (def.name || def.id).toUpperCase();
  const grid = { cols: 12, rows: 7, cell: 64 };
  const S = (id, x, y, w, h, role, label) => el.push({ id, type: 'slot', x, y, w, h, role, label });
  el.push({ id: 'header', type: 'label', x: 0, y: 0, w: 12, h: 1, text: title, size: 19 });

  if (def.kind === 'crafting' || def.kind === 'processor') {


    if (def.kind === 'processor' && (def.recipes || []).some((r) => r.time)) {
      el.push({ id: 'progress', type: 'progress', x: 0, y: 2, w: 12, h: 1, label: 'PROCESS' });
    }
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.kind === 'armor') {
    S('armor', 0, 1, 2, 2, 'armor', 'ARMOR');
    for (let i = 0; i < 4; i++) S(`p${i}`, 3 + i * 2, 1, 2, 2, `plate${i}`, 'PLATE');
    el.push({ id: 'status', type: 'label', x: 0, y: 3, w: 12, h: 1, text: 'DROP PLATES TO INSTALL', size: 12 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.rtg) {
    S('input0', 0, 1, 2, 2, 'input0', 'SOURCE');
    el.push({ id: 'info', type: 'label', x: 3, y: 1, w: 9, h: 2, text: 'INSERT A RADIOACTIVE ITEM', size: 12 });
    el.push({ id: 'status', type: 'label', x: 0, y: 4, w: 12, h: 1, text: 'NO SOURCE', size: 12 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.battery) {
    S('fuel', 0, 1, 2, 2, 'fuel', 'BATTERY');
    el.push({ id: 'info', type: 'label', x: 3, y: 1, w: 9, h: 2, text: 'INSERT A CAR BATTERY', size: 12 });
    el.push({ id: 'status', type: 'label', x: 0, y: 4, w: 12, h: 1, text: 'NO BATTERY', size: 12 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.liquidFuel) {
    S('fuel', 0, 1, 2, 2, 'fuel', 'FUEL');
    el.push({ id: 'info', type: 'label', x: 3, y: 1, w: 9, h: 2, text: 'INSERT A FUEL CAN (GASOLINE / ETHANOL)', size: 12 });
    el.push({ id: 'status', type: 'label', x: 0, y: 4, w: 12, h: 1, text: 'NO FUEL', size: 12 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.kind === 'cable' || def.kind === 'storage' || def.kind === 'geiger' || (def.kind === 'generator' && !def.recipes)) {
    el.push({ id: 'status', type: 'label', x: 0, y: 2, w: 12, h: 2, text: 'IDLE', size: 13 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.kind === 'excavator') {
    const n = def.outputs || 6;
    for (let i = 0; i < n; i++) S(`o${i}`, (i % 3) * 2, 1 + Math.floor(i / 3) * 2, 2, 2, `output${i}`, 'ORE');
    el.push({ id: 'status', type: 'label', x: 7, y: 1, w: 5, h: 2, text: 'IDLE', size: 12 });
    el.push({ id: 'progress', type: 'progress', x: 7, y: 5, w: 5, h: 1, label: 'DRILL' });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.kind === 'reactor') {
    grid.cols = 14;
    grid.rows = 9;
    const rods = def.rodSlots || REACTOR_ROD_SLOTS;
    S('fuel', 0, 1, 2, 2, 'fuel', 'FUEL');
    for (let i = 0; i < rods; i++) S(`rod${i}`, 4 + i * 2, 1, 2, 2, `rod${i}`, 'ROD');
    for (let i = 0; i < 4; i++) S(`output${i}`, (i % 2) * 2, 3 + Math.floor(i / 2) * 2, 2, 2, `output${i}`, 'OUT');
    S('coolant', 9, 3, 4, 2, 'coolant', 'COOL');
    el.push({ id: 'status', type: 'label', x: 0, y: 7, w: 14, h: 1, text: 'NO FUEL', size: 12 });
    el.push({ id: 'heat', type: 'progress', x: 0, y: 8, w: 7, h: 1, label: 'HEAT' });
    el.push({ id: 'match', type: 'progress', x: 7, y: 8, w: 7, h: 1, label: 'COOLING MATCH' });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }


  const hasInputs = def.kind !== 'reactor' && def.kind !== 'absorber';
  if (hasInputs) {
    S('input0', 0, 1, 2, 2, 'input0', 'IN');
    S('input1', 2, 1, 2, 2, 'input1', 'IN');
    S('input2', 0, 3, 2, 2, 'input2', 'IN');
    S('input3', 2, 3, 2, 2, 'input3', 'IN');
  }
  const needsFuel = (def.recipes || []).some((r) => r.fuel) || def.kind === 'reactor' || def.kind === 'absorber';

  if (def.coolPerHeavy) S('coolant', 0, 1, 2, 2, 'coolant', 'COOLANT');
  if (needsFuel) S('fuel', 5, 1, 2, 2, 'fuel', def.kind === 'reactor' ? 'FUEL ROD' : 'FUEL');
  el.push({ id: 'arrow', type: 'arrow', x: 4, y: 2, w: 1, h: 2, color: '#ffffff' });
  for (let i = 0; i < 4; i++) S(`o${i}`, 7 + (i % 2) * 2, 1 + Math.floor(i / 2) * 2, 2, 2, `output${i}`, 'OUT');
  el.push({ id: 'status', type: 'label', x: 0, y: 5, w: 12, h: 1, text: 'IDLE', size: 12 });
  if (def.kind === 'reactor') el.push({ id: 'heat', type: 'progress', x: 6, y: 6, w: 6, h: 1, label: 'HEAT' });
  else if ((def.recipes || []).some((r) => r.time)) el.push({ id: 'progress', type: 'progress', x: 6, y: 6, w: 6, h: 1, label: 'PROCESS' });
  return { version: 1, id: def.id, title, grid, theme, elements: el };
}


// Radiation is tracked in rad (absorbed dose), where 1 rad = 0.01 Gy.
// The meter is scaled to the human whole-body lethal dose: ~450 rad is LD50/60
// (50% die within 60 days without treatment) and ~600 rad is almost always fatal.
export const TUNING = {
  DAY_SECONDS: 900,
  HUNGER_DRAIN: 0.07,
  RAD_RAMP_DAY: 10,
  AMBIENT_BASE: 0.02,
  AMBIENT_EXP: 1.7,
  WASTELAND_RAD: 0.35,
  RAD_ARS_DOSE: 100,
  RAD_LD50: 450,
  RAD_LETHAL_DOSE: 600,
  RAD_STAGES: [
    { at: 100, name: 'SLOWED', speed: 0.7, blur: 0.15, dark: 0.0 },
    { at: 250, name: 'BLURRED', speed: 0.5, blur: 0.45, dark: 0.15 },
    { at: 450, name: 'CRITICAL', speed: 0.3, blur: 0.85, dark: 0.35 },
    { at: 600, name: 'FATAL', speed: 0.2, blur: 1.2, dark: 0.6 },
  ],
};

// Format a dose (rad) or dose rate (rad/s) with a real SI prefix, so a
// background-level reading shows as nrad/s and a hot machine as mrad/s or rad/s.
const RAD_UNITS = [
  [1e9, 'Grad'], [1e6, 'Mrad'], [1e3, 'krad'], [1, 'rad'],
  [1e-3, 'mrad'], [1e-6, 'µrad'], [1e-9, 'nrad'], [1e-12, 'prad'],
];

export function formatRad(value, rate = false) {
  const n = Number(value) || 0;
  if (n === 0) return `0 rad${rate ? '/s' : ''}`;
  const abs = Math.abs(n);
  let unit = RAD_UNITS[RAD_UNITS.length - 1];
  if (abs > 0) unit = RAD_UNITS.find(([scale]) => abs >= scale) || unit;
  const mantissa = n / unit[0];
  const digits = Math.abs(mantissa) >= 100 ? 0 : Math.abs(mantissa) >= 10 ? 1 : 2;
  const num = parseFloat(mantissa.toFixed(digits));
  return `${num} ${unit[1]}${rate ? '/s' : ''}`;
}

export const formatRadRate = (value) => formatRad(value, true);

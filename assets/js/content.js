







// `rad` on items/machines is a dose rate in rad/s while carried or running.
const I = (code, name, extra = {}) => ({ code, name, stack: 99, rad: 0, ...extra });
const ORE = (mat, code, extra = {}) => I(code, mat.toUpperCase() + ' ORE', { block: true, ...extra });
const DUST = (mat, code) => I(code, mat.toUpperCase() + ' DUST', { block: false });
const INGOT = (mat, code, extra = {}) => I(code, mat.toUpperCase() + ' INGOT', { block: true, icon: 'assets/images/items/ingot.png', ...extra });
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
  lead: ORE('lead', 'PB', { icon: 'assets/images/items/lead.png' }),
  copper: ORE('copper', 'CU', { icon: 'assets/images/items/copper.png' }),
  tin: ORE('tin', 'SN'),
  iron: ORE('iron', 'FE', { icon: 'assets/images/items/ironore.png' }),
  lithium: ORE('lithium', 'LI', { icon: 'assets/images/items/lithium.png' }),
  boron: ORE('boron', 'BO', { icon: 'assets/images/items/boron.png' }),
  magnesium: ORE('magnesium', 'MG', { icon: 'assets/images/items/magnesiumore.png' }),
  zirconium: ORE('zirconium', 'ZR', { icon: 'assets/images/items/zirconiumore.png' }),
  beryllium: ORE('beryllium', 'BE', { icon: 'assets/images/items/beryllium.png' }),
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


  uranium_ingot: INGOT('uranium', 'UIn', { rad: 0.5, tint: 0x5fcf76 }),
  thorium_ingot: INGOT('thorium', 'TIn', { rad: 0.3, tint: 0x7dbd9a }),
  lead_ingot: INGOT('lead', 'PIn', { tint: 0x9aa2b0 }),
  copper_ingot: INGOT('copper', 'CIn', { tint: 0xd66d3f }),
  tin_ingot: INGOT('tin', 'SIn', { tint: 0xc5d3dd }),
  iron_ingot: INGOT('iron', 'FIn', { tint: 0x9aa3a9 }),
  lithium_ingot: INGOT('lithium', 'LIn', { tint: 0xe5d7bb }),
  boron_ingot: INGOT('boron', 'BIn', { tint: 0x53d8a0 }),
  magnesium_ingot: INGOT('magnesium', 'MIn', { tint: 0xc7dfe6 }),
  zirconium_ingot: INGOT('zirconium', 'ZIn', { tint: 0x88d8d8 }),
  beryllium_ingot: INGOT('beryllium', 'EIn', { tint: 0x91d4ff }),
  bronze_ingot: INGOT('bronze', 'BR', { tint: 0xc98f44 }),
  steel_ingot: INGOT('steel', 'SL', { tint: 0xb4bec8 }),


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

  hafnium: I('HF', 'HAFNIUM', { block: false, desc: 'Neutron-hungry metal separated from zirconium; the basis of long-life control rods.' }),
  cadmium: I('CD', 'CADMIUM', { block: false, desc: 'Soft, toxic metal recovered from lead-zinc smelting. A classic thermal-neutron absorber.' }),
  boron_carbide: I('B4', 'BORON CARBIDE', { block: false, desc: 'B4C ceramic: boron and carbon fused into a hard, cheap neutron poison.' }),

  beryllium_rod: I('eC', 'BERYLLIUM REFLECTOR ROD', { block: false, rod: { cool: 30, absorb: 0, mod: 0.12 }, desc: 'Beryllium reflects neutrons back into the core. Weak cooling, strong reactivity gain.' }),
  cadmium_rod: I('cC', 'CADMIUM CONTROL ROD', { block: false, rod: { cool: 50, absorb: 0.22, mod: 0 }, desc: 'Cadmium soaks up thermal neutrons. Cheap and effective, but it poisons the reaction.' }),
  zirconium_rod: I('zC', 'ZIRCONIUM COOLANT ROD', { block: false, rod: { cool: 70, absorb: 0.05, mod: 0.02 }, desc: 'Zircaloy coolant channel: very low neutron cost for its cooling.' }),
  hafnium_rod: I('hR', 'HAFNIUM CONTROL ROD', { block: false, rod: { cool: 100, absorb: 0.16, mod: 0 }, desc: 'Hafnium absorbs neutrons without cadmium corrosion problems. A long-lived control rod.' }),
  boron_rod: I('bC', 'BORON CARBIDE CONTROL ROD', { block: false, rod: { cool: 150, absorb: 0.28, mod: 0 }, desc: 'B4C in zircaloy cladding: the workhorse absorber for high-power cores. Strong cooling, strong poisoning.' }),
  heavy_water_rod: I('dC', 'HEAVY WATER COOLANT ROD', { block: false, rod: { cool: 320, absorb: 0.04, mod: 0.10 }, desc: 'Sealed D2O channel. Best cooling in the game with a moderation bonus; needs heavy water to build.' }),
  drill_bit: I('DB', 'DRILL BIT', { block: false }),


  // Research tier: late recipes are gated behind blueprints studied in the lab.
  blueprint_reactor: I('BR', 'REACTOR BLUEPRINT', { block: false, stack: 8, desc: 'A fission core design. Requires a sample of enriched uranium to copy.' }),
  blueprint_fusion: I('BF', 'FUSION BLUEPRINT', { block: false, stack: 8, desc: 'A magnetic-confinement design. The sample has to come from spent reactor fuel.' }),
  blueprint_scrubber: I('SB', 'SCRUBBER BLUEPRINT', { block: false, stack: 8, desc: 'A high-volume atmospheric filter design for cleaning up the wasteland.' }),
  blueprint_containment: I('KB', 'CONTAINMENT BLUEPRINT', { block: false, stack: 8, desc: 'A sealed suit pattern rated for the inside of a hot cell.' }),
  blueprint_excavator: I('XB', 'BWE BLUEPRINT', { block: false, stack: 8, desc: 'A continuous bucket-wheel mining plan. The frame alone needs a small foundry.' }),
  filter_cartridge: I('FT', 'SCRUBBER FILTER', { block: false, stack: 16, desc: 'A pleated carbon-and-lead cartridge. Consumed by the atmospheric scrubber.' }),



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
  fusion_fuel: I('FF', 'FUSION FUEL', { block: false, rad: 1.4, fuel: { power: 3200, heat: 1200, cool: 1600, lifetime: 180, rad: 3 }, desc: 'A deuterium-tritium pellet in a heavy-water jacket. Burns far hotter than any fission rod.' }),


  depleted_tbu: I('dT', 'DEPLETED TBU', { block: false, rad: 1.5 }),
  depleted_leu: I('dL', 'DEPLETED LEU', { block: false, rad: 2.5 }),
  depleted_heu: I('dH', 'DEPLETED HEU', { block: false, rad: 5.0 }),
  depleted_lep: I('dP', 'DEPLETED LEP', { block: false, rad: 4.0 }),
  depleted_fusion: I('dF', 'DEPLETED FUSION FUEL', { block: false, rad: 3.0, desc: 'A spent pellet. Still worth cracking for the lithium and boron jacket.' }),


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




  pick: { code: 'PK', name: 'PICKAXE', stack: 1, rad: 0, tool: { radius: 1.6, rate: 0.4, yield: 1.25, stone: 3, weak: 0.12, good: ['stone'], chop: { reach: 3.6, power: 0.45, hits: 6 } }, icon: 'assets/images/items/pickaxe.png' },
  drill: { code: 'DR', name: 'DRILL', stack: 1, rad: 0.5, tool: { radius: 2.6, rate: 0.14, yield: 2, good: ['stone', 'dirt', 'grass'] } },
  shovel: { code: 'SH', name: 'SHOVEL', stack: 1, rad: 0, tool: { radius: 1.8, rate: 0.26, yield: 1, good: ['dirt', 'grass'] } },

  axe: { code: 'AX', name: 'STEEL AXE', stack: 1, rad: 0, tool: { radius: 1.5, rate: 0.42, yield: 1, weak: 0.1, good: [], chop: { reach: 5.0, power: 1, hits: 3 } }, icon: 'assets/images/items/axe.png' },

  hatchet: { code: 'HX', name: 'STEEL HATCHET', stack: 1, rad: 0, tool: { radius: 1.2, rate: 0.32, yield: 1, weak: 0.1, good: [] } },
  hoe: { code: 'HO', name: 'STEEL HOE', stack: 1, rad: 0, tool: { radius: 1.4, rate: 0.3, yield: 1, weak: 0.15, good: ['dirt', 'grass'] } },
  plasma_drill: { code: 'PD', name: 'PLASMA DRILL', stack: 1, rad: 0.2, tool: { radius: 3.2, rate: 0.09, yield: 2.5, stone: 2, weak: 0.2, good: ['stone', 'dirt', 'grass'], chop: { reach: 5, power: 0.8 } }, desc: 'A containment-blueprint mining head. Cuts a much wider bite than a hand drill.' },


  torch: { code: 'TO', name: 'TORCH', stack: 16, rad: 0, torch: true, light: { mount: 'wall', range: 12, power: 1.2, color: 0xff9d1f } },
  lantern: { code: 'LN', name: 'LANTERN', stack: 16, rad: 0, torch: true, light: { mount: 'floor', range: 18, power: 2.0, color: 0xffb454 } },
  floodlight: { code: 'FD', name: 'FLOODLIGHT', stack: 8, rad: 0, torch: true, light: { mount: 'wall', range: 30, power: 2.8, color: 0xd8e8ff } },
  flashlight: { code: 'FL', name: 'FLASHLIGHT', stack: 1, rad: 0, tool: { flashlight: true, radius: 0.1, rate: 0.1, yield: 0, good: [] }, light: { mount: 'held', range: 18, power: 2.8, color: 0xdfefff }, icon: 'assets/images/items/flashlight.png' },
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

  containment_helmet: I('kH', 'CONTAINMENT HELMET', { block: false, stack: 1, armor: { slot: 'head', defense: 5, radShield: 12, plateSlots: 3 } }),
  containment_chestplate: I('kC', 'CONTAINMENT SUIT', { block: false, stack: 1, armor: { slot: 'chest', defense: 6, radShield: 18, plateSlots: 4 } }),
  containment_leggings: I('kL', 'CONTAINMENT LEGGINGS', { block: false, stack: 1, armor: { slot: 'legs', defense: 5, radShield: 12, plateSlots: 3 } }),
  containment_boots: I('kB', 'CONTAINMENT BOOTS', { block: false, stack: 1, armor: { slot: 'feet', defense: 5, radShield: 12, plateSlots: 3 } }),

  hazmat_gloves: I('hG', 'HAZMAT GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 1, radShield: 1, carry: 0.4, plateSlots: 1 } }),
  lead_gloves: I('lG', 'LEAD-LINED GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 2, radShield: 2, carry: 0.7, plateSlots: 2 } }),
  heavy_gloves: I('HG', 'HARDENED GAUNTLETS', { block: false, stack: 1, armor: { slot: 'hands', defense: 3, radShield: 3, carry: 0.9, plateSlots: 3 } }),
  containment_gloves: I('kG', 'CONTAINMENT GLOVES', { block: false, stack: 1, armor: { slot: 'hands', defense: 3, radShield: 5, carry: 1.0, plateSlots: 3 } }),

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
  copper_director: { code: 'CD', name: 'COPPER DIRECTOR', stack: 32, rad: 0, block: false, workbench: 'copper_director', desc: 'A cheap starter connector for linking nearby machines without a full power pole.' },
  simple_container: { code: 'SCN', name: 'SIMPLE CONTAINER', stack: 1, rad: 0, block: false, workbench: 'simple_container', model: 'assets/models/items/simple_container.gltf', desc: 'A basic storage vessel made from stone and wood.' },
  wooden_powerpole: { code: 'WP', name: 'WOODEN POWERPOLE', stack: 16, rad: 0, block: false, workbench: 'cable', desc: 'Links nearby machines into one power grid.' },
  excavator: { code: 'EX', name: 'EXCAVATOR', stack: 4, rad: 0, block: false, workbench: 'excavator', desc: 'Drills the ore seam under it and keeps what it finds.' },
  bucket_wheel_excavator: { code: 'BW', name: 'BUCKET WHEEL EXCAVATOR', stack: 1, rad: 0, block: false, workbench: 'bucket_wheel_excavator', desc: 'A colossal mobile mining machine. Rotate the house, lower the boom and run the wheel through the ground.' },
  bwe_controller: { code: 'BC', name: 'BWE CONTROLLER', stack: 4, rad: 0, block: false, desc: 'Right-click to link to the nearest bucket wheel excavator and take the controls.' },
  armor_workbench: { code: 'AW', name: 'ARMOR WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'armor_workbench', desc: 'Fits shielding plates into armor. Drop a plate on the piece.' },
  geiger_block: { code: 'GB', name: 'GEIGER BLOCK', stack: 16, rad: 0, block: false, workbench: 'geiger_block', desc: 'Reads the radiation around it.' },
  radiation_absorber: { code: 'RA', name: 'RADIATION ABSORBER', stack: 16, rad: 0, block: false, workbench: 'radiation_absorber', desc: 'Pulls radiation out of the air. Eats lead plates.' },
  decontaminator: { code: 'DC', name: 'DECONTAMINATOR', stack: 16, rad: 0, block: false, workbench: 'decontaminator', desc: 'Turns spent fuel into iodine pills.' },
  gun_workbench: { code: 'GW', name: 'GUN WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'gun_workbench', desc: 'Hand cranked bench for guns and ammo. No power needed.' },
  medicine_workbench: { code: 'MW', name: 'MEDICINE WORKBENCH', stack: 16, rad: 0, block: false, workbench: 'medicine_workbench', desc: 'Makes anti rad drugs and medical supplies.' },
  liquid_mixer: { code: 'LM', name: 'LIQUID MIXER', stack: 16, rad: 0, block: false, workbench: 'liquid_mixer', desc: 'Refines and blends liquids like gasoline, ethanol and RadAway.' },
  rtg: { code: 'RT', name: 'RTG', stack: 16, rad: 0, block: false, workbench: 'rtg', desc: 'Makes power from whatever radioactive item sits in its slot.' },
  hand_crank: { code: 'HC', name: 'HAND CRANK', stack: 16, rad: 0, block: false, workbench: 'hand_crank', desc: 'A hand-turned generator. Right-click it to turn the handle and charge the local grid.' },
  water_pump: { code: 'PU', name: 'WATER PUMP', stack: 16, rad: 0, block: false, workbench: 'water_pump', desc: 'Draws groundwater into the jerry can you are holding. Right-click to pump. Needs grid power.' },
  test_bench: { code: 'T#', name: 'TEST BENCH', stack: 16, rad: 0, block: false, workbench: 'test_bench', desc: 'Drop in a car battery for a quick burst of power.' },
  research_lab: { code: 'RL', name: 'RESEARCH LAB', stack: 16, rad: 0, block: false, workbench: 'research_lab', desc: 'Studies hot samples and turns them into blueprints for the next tier.' },
  fusion_reactor: { code: 'FX', name: 'FUSION REACTOR', stack: 4, rad: 0, block: false, workbench: 'fusion_reactor', desc: 'Burns fusion pellets for enormous power. Even less forgiving of a cooling mismatch than fission.' },
  atmospheric_scrubber: { code: 'SR', name: 'ATMOSPHERIC SCRUBBER', stack: 8, rad: 0, block: false, workbench: 'atmospheric_scrubber', desc: 'Filters the air around you. Enough of them make the late-game ambient dose survivable.' },
};








export const ITEM_MODEL_ICON_EXCLUDE = new Set([
  'flashlight',
  'pick',
  'axe',
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



  {
    id: 'gun_workbench', kind: 'processor', name: 'GUN WORKBENCH', model: MODEL('gun_workbench'), layout: LAYOUT('gun_workbench'), label: 'Use gun workbench', height: 1.2, dx: 2.8, dz: 1.8,
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
    ]
  },

  {
    id: 'crusher', kind: 'processor', name: 'CRUSHER', model: MODEL('crusher'), layout: LAYOUT('crusher'), label: 'Use crusher', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 20 },
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
    ]
  },
  {
    id: 'electric_furnace', kind: 'processor', name: 'ELECTRIC FURNACE', model: MODEL('electric_furnace'), layout: LAYOUT('electric_furnace'), label: 'Use electric furnace', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 30 },
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
      { in: { silica: 1, carbon: 1 }, out: { glass: 1 }, time: 3 },
    ]
  },
  {
    id: 'ingot_former', kind: 'processor', name: 'INGOT FORMER', model: MODEL('ingot_former'), layout: LAYOUT('ingot_former'), label: 'Use ingot former', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 25 },
    recipes: [
      { in: { lead_ingot: 1 }, out: { lead_plate: 1 }, time: 2 },
      { in: { copper_ingot: 1 }, out: { copper_plate: 1 }, time: 2 },
      { in: { iron_ingot: 1 }, out: { iron_plate: 1 }, time: 2 },
      { in: { steel_ingot: 1 }, out: { steel_plate: 1 }, time: 2.5 },
      { in: { boron_ingot: 1 }, out: { boron_plate: 1 }, time: 2.5 },
      { in: { zirconium_ingot: 1 }, out: { zirconium_plate: 1 }, time: 2.5 },
    ]
  },
  {
    id: 'press', kind: 'processor', name: 'PRESS', model: MODEL('press'), layout: LAYOUT('press'), label: 'Use press', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 40 },
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
    ]
  },
  {
    id: 'alloy_furnace', kind: 'processor', name: 'ALLOY FURNACE', model: MODEL('alloy_furnace'), layout: LAYOUT('alloy_furnace'), label: 'Use alloy furnace', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 45 },
    recipes: [
      { in: { iron_ingot: 1, carbon: 1 }, out: { steel_ingot: 1 }, time: 5 },
      { in: { copper_ingot: 3, tin_ingot: 1 }, out: { bronze_ingot: 4 }, time: 4 },
      { in: { carbon: 2, iron_ingot: 1 }, out: { carbon_mesh: 1 }, time: 6 },
      { in: { steel_ingot: 2, graphite: 1 }, out: { control_rod: 1 }, time: 6 },
      { in: { boron_ingot: 2, carbon: 1 }, out: { boron_carbide: 1 }, time: 6 },
    ]
  },
  {
    id: 'assembler', kind: 'processor', name: 'ASSEMBLER', model: MODEL('assembler'), layout: LAYOUT('assembler'), label: 'Use assembler', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 60 },
    recipes: [
      { in: { machine_chassis: 6, circuit_advanced: 4, electric_motor: 4, timer_module: 2, data_drive: 2, drill_bit: 8, steel_plate: 6 }, out: { excavator: 1 }, time: 45 },
      {
        in: { machine_chassis: 32, steel_plate: 96, iron_plate: 128, circuit_advanced: 20, electric_motor: 20, copper_solenoid: 32, linear_actuator: 16, drill_bit: 40, cable: 48, heavy_shielding_plate: 8, advanced_shielding_plate: 4, blueprint_excavator: 1 },
        out: { bucket_wheel_excavator: 1 }, time: 180
      },
      { in: { circuit_advanced: 2, circuit_board: 2, data_drive: 1, copper_solenoid: 2, glass: 2, iron_plate: 4 }, out: { bwe_controller: 1 }, time: 30 },
      { in: { machine_chassis: 3, circuit_board: 3, control_rod: 4, reactor_casing: 4, blueprint_reactor: 1 }, out: { fission_reactor: 1 }, time: 30 },
      { in: { machine_chassis: 6, circuit_advanced: 6, heavy_water_rod: 2, reactor_casing: 8, blueprint_fusion: 1, data_drive: 4 }, out: { fusion_reactor: 1 }, time: 90 },
      { in: { machine_chassis: 2, circuit_board: 2, glass: 4, data_disk: 2 }, out: { research_lab: 1 }, time: 20 },
      { in: { machine_chassis: 4, circuit_advanced: 4, lead_plate: 12, cooling_fan: 4, blueprint_scrubber: 1 }, out: { atmospheric_scrubber: 1 }, time: 45 },
      { in: { carbon_mesh: 2, lead_plate: 2, plastic: 4 }, out: { filter_cartridge: 4 }, time: 6 },
      {
        in: { lead_plate: 20, steel_plate: 20, advanced_shielding_plate: 8, carbon_mesh: 8, blueprint_containment: 1 },
        out: { containment_helmet: 1, containment_chestplate: 1, containment_leggings: 1, containment_boots: 1, containment_gloves: 1 }, time: 60
      },
      { in: { drill_bit: 4, circuit_advanced: 2, electric_motor: 2, steel_plate: 4, blueprint_containment: 1 }, out: { plasma_drill: 1 }, time: 30 },
      {
        in: { zirconium_plate: 2, steel_plate: 1, jerry_can_green: 1 }, liquidIn: [{ id: 'heavy_water', amount: 8 }],
        out: { jerry_can_green: 1, heavy_water_rod: 1 }, time: 14
      },
      { in: { machine_chassis: 1, circuit_board: 1, electric_motor: 2, memory_module: 1 }, out: { centrifuge: 1 }, time: 12 },
      { in: { machine_chassis: 2, circuit_board: 2, copper_solenoid: 4, memory_module: 2 }, out: { isotope_separator: 1 }, time: 18 },
      { in: { machine_chassis: 2, circuit_board: 2, lead_plate: 8, data_drive: 1 }, out: { fuel_reprocessor: 1 }, time: 18 },
      { in: { machine_chassis: 1, copper_solenoid: 2, circuit_basic: 2, card_reader: 1 }, out: { chemical_reactor: 1 }, time: 12 },
      { in: { machine_chassis: 2, circuit_board: 1, copper_plate: 4, data_disk: 2 }, out: { energy_storage: 1 }, time: 10 },
      { in: { copper_plate: 2, iron_plate: 1 }, out: { cable: 8 }, time: 3 },
      { in: { machine_chassis: 1, circuit_basic: 2, iron_plate: 4, optic_lens: 1, glass: 6 }, out: { solar_panel: 1 }, time: 10 },
      { in: { machine_chassis: 1, circuit_board: 1, lead_plate: 8, timer_module: 1 }, out: { decay_generator: 1 }, time: 14 },
      { in: { machine_chassis: 1, copper_solenoid: 2, carbon: 2, cooling_fan: 1 }, out: { crystallizer: 1 }, time: 8 },
      { in: { machine_chassis: 1, circuit_basic: 1, lead_plate: 4, cooling_fan: 1 }, out: { radiation_absorber: 1 }, time: 8 },
      { in: { machine_chassis: 1, circuit_board: 1, lead_plate: 4, optic_lens: 1 }, out: { decontaminator: 1 }, time: 12 },
      { in: { machine_chassis: 1, circuit_advanced: 2, lead_plate: 4, memory_module: 1 }, out: { geiger_block: 1 }, time: 10 },
      { in: { circuit_advanced: 1, copper_plate: 1, graphite: 1 }, out: { circuit_basic: 2 }, time: 4 },
      { in: { circuit_mid: 2, circuit_board: 1, lead_plate: 1 }, out: { circuit_advanced: 1 }, time: 8 },
      { in: { lead_plate: 4, steel_plate: 4, carbon_mesh: 1 }, out: { advanced_shielding_plate: 1 }, time: 12 },
      { in: { steel_plate: 2, lead_plate: 2, iron_plate: 2 }, out: { heavy_shielding_plate: 1 }, time: 8 },
    ]
  },
  {
    id: 'research_lab', kind: 'processor', name: 'RESEARCH LAB', model: MODEL('research_lab'), layout: LAYOUT('research_lab'), label: 'Use research lab', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 45 }, rad: 0.1,
    recipes: [
      { in: { data_disk: 1, circuit_advanced: 1, u235: 2, lead_plate: 2 }, out: { blueprint_reactor: 1 }, time: 20, rad: 0.4 },
      { in: { data_drive: 1, circuit_advanced: 2, pu239: 2, carbon_mesh: 1 }, out: { blueprint_fusion: 1 }, time: 32, rad: 0.8 },
      { in: { data_disk: 2, circuit_advanced: 1, polonium: 2, lead_plate: 4 }, out: { blueprint_scrubber: 1 }, time: 26, rad: 0.6 },
      { in: { data_drive: 2, circuit_advanced: 2, beryllium_ingot: 4, advanced_shielding_plate: 1 }, out: { blueprint_containment: 1 }, time: 30, rad: 0.2 },
      { in: { data_drive: 2, circuit_advanced: 3, polonium: 2, advanced_shielding_plate: 2 }, out: { blueprint_excavator: 1 }, time: 34, rad: 0.8 },
    ]
  },
  {
    id: 'centrifuge', kind: 'processor', name: 'CENTRIFUGE', model: MODEL('centrifuge'), layout: LAYOUT('centrifuge'), label: 'Use centrifuge', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 55 }, rad: 0.2,
    recipes: [
      { in: { crushed_uranium: 1 }, out: { u235: 1, u238: 3 }, time: 8, rad: 0.5 },
      { in: { crushed_thorium: 1 }, out: { th232: 1 }, time: 8, rad: 0.3 },
      { in: { crushed_zirconium: 2 }, out: { hafnium: 1 }, time: 10, rad: 0.1 },
      { in: { crushed_lead: 2 }, out: { cadmium: 1 }, time: 8, rad: 0.2 },
      { in: { depleted_leu: 1 }, out: { u238: 2, pu239: 1 }, time: 10, rad: 1 },
      { in: { depleted_heu: 1 }, out: { u235: 1, pu239: 2 }, time: 10, rad: 2 },
    ]
  },
  {
    id: 'isotope_separator', kind: 'processor', name: 'ISOTOPE SEPARATOR', model: MODEL('isotope_separator'), layout: LAYOUT('isotope_separator'), label: 'Use isotope separator', height: 1.6, dx: 2.8, dz: 1.8, energy: { use: 90 }, rad: 0.4,
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

      {
        in: { fuel_rod_casing: 2, lithium: 8, boron: 3, jerry_can_green: 1 }, liquidIn: [{ id: 'heavy_water', amount: 12 }],
        out: { jerry_can_green: 1, fusion_fuel: 1 }, time: 24, rad: 2
      },

      {
        in: { lithium: 4, jerry_can_green: 1 }, liquidIn: [{ id: 'water', amount: 20 }],
        out: { jerry_can_green: 1 }, liquidOut: { id: 'heavy_water', amount: 12, container: 'jerry_can_green' }, time: 14
      },
    ]
  },
  {
    id: 'fuel_reprocessor', kind: 'processor', name: 'FUEL REPROCESSOR', model: MODEL('fuel_reprocessor'), layout: LAYOUT('fuel_reprocessor'), label: 'Use fuel reprocessor', height: 1.6, dx: 2.8, dz: 1.8, energy: { use: 80 }, rad: 0.8,
    recipes: [
      { in: { depleted_tbu: 1 }, out: { th232: 1 }, time: 12, rad: 2 },
      { in: { depleted_leu: 1 }, out: { u238: 2, pu239: 1 }, time: 14, rad: 3 },
      { in: { depleted_heu: 1, jerry_can_white: 1 }, out: { u235: 1, pu239: 2, jerry_can_white: 1 }, liquidOut: { id: 'nuclear_waste', amount: 6, container: 'jerry_can_white' }, time: 14, rad: 4 },
      { in: { depleted_lep: 1 }, out: { pu239: 2, u238: 1 }, time: 14, rad: 3 },
      { in: { depleted_fusion: 1 }, out: { lithium: 2, boron: 1 }, time: 16, rad: 2 },
    ]
  },
  {
    id: 'chemical_reactor', kind: 'processor', name: 'CHEMICAL REACTOR', model: MODEL('chemical_reactor'), layout: LAYOUT('chemical_reactor'), label: 'Use chemical reactor', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 35 },
    recipes: [

      { in: { herb: 3, carbon: 2, iodine_pill: 1 }, out: { chelating_agent: 2 }, time: 10 },
      { in: { herb: 1, carbon: 1 }, out: { iodine_pill: 2 }, time: 6 },

      { in: { carbon: 3, plastic: 2, magnesium: 1 }, out: { rdx: 2 }, time: 14 },
    ]
  },
  {
    id: 'crystallizer', kind: 'processor', name: 'CRYSTALLIZER', model: MODEL('crystallizer'), layout: LAYOUT('crystallizer'), label: 'Use crystallizer', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 40 },
    recipes: [
      { in: { crushed_boron: 2, lead_ingot: 1 }, out: { heavy_shielding_plate: 1 }, time: 10 },
    ]
  },


  {
    id: 'liquid_mixer', kind: 'processor', name: 'LIQUID MIXER', model: MODEL('liquid_mixer'), layout: LAYOUT('liquid_mixer'), label: 'Use liquid mixer', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 25 },
    recipes: [

      {
        in: { carbon: 6, iron_plate: 1, jerry_can_red: 1 }, liquidIn: [{ id: 'water', amount: 6 }],
        out: { iron_plate: 1, jerry_can_red: 1 }, liquidOut: { id: 'gasoline', amount: 6, container: 'jerry_can_red' }, time: 12
      },

      {
        in: { plastic: 2, jerry_can_red: 1 }, out: { jerry_can_red: 1 },
        liquidOut: { id: 'gasoline', amount: 3, container: 'jerry_can_red' }, time: 6
      },

      {
        in: { herb: 6, jerry_can_black: 1 }, liquidIn: [{ id: 'water', amount: 4 }],
        out: { jerry_can_black: 1 }, liquidOut: { id: 'ethanol', amount: 8, container: 'jerry_can_black' }, time: 8
      },

      {
        in: { chelating_agent: 2, radaway_iv: 1 }, liquidIn: [{ id: 'water', amount: 4 }],
        out: { radaway_iv: 1 }, liquidOut: { id: 'radaway', amount: 4, container: 'radaway_iv' }, time: 10
      },
      { in: { jerry_can_white: 1, jerry_can_green: 1 }, liquidIn: [{ id: 'acid', amount: 1 }, { id: 'water', amount: 4 }], out: { jerry_can_white: 1, jerry_can_green: 1 }, liquidOut: { id: 'acid', amount: 5, container: 'jerry_can_white' }, time: 8 },
    ]
  },


  { id: 'solar_panel', kind: 'generator', name: 'SOLAR PANEL', model: MODEL('solar_panel'), layout: LAYOUT('solar_panel'), label: 'Open solar panel', height: 0.9, dx: 2.8, dz: 1.8, energy: { gen: 12, dayOnly: true } },


  { id: 'rtg', kind: 'generator', name: 'RTG', model: MODEL('rtg'), layout: LAYOUT('rtg'), label: 'Open RTG', height: 1.0, dx: 2.8, dz: 1.8, rtg: true, rad: 0.05 },

  { id: 'hand_crank', kind: 'generator', name: 'HAND CRANK', model: MODEL('hand_crank'), layout: LAYOUT('hand_crank'), label: 'Turn the hand crank', height: 1.0, dx: 2.8, dz: 1.8, energy: { gen: 45 }, capacity: 900, manual: true, spin: 'spin', spinRate: 8 },

  { id: 'water_pump', kind: 'pump', name: 'WATER PUMP', model: MODEL('water_pump'), layout: LAYOUT('water_pump'), label: 'Pump water', height: 1.2, dx: 2.8, dz: 1.8, energy: { use: 30 }, pump: { amount: 5, cost: 30 } },

  { id: 'test_bench', kind: 'generator', name: 'TEST BENCH', model: MODEL('test_bench'), layout: LAYOUT('test_bench'), label: 'Open test bench', height: 1.2, dx: 2.8, dz: 1.8, energy: { gen: 150 }, battery: { life: 180 } },

  { id: 'fuel_generator', kind: 'generator', name: 'GAS GENERATOR', model: 'assets/models/workbenches/fuel_generator.glb', layout: LAYOUT('fuel_generator'), label: 'Open gas generator', height: 1.7, dx: 2.8, dz: 1.8, energy: { gen: 60 }, liquidFuel: { burn: { gasoline: 0.02, ethanol: 0.035 } } },
  {
    id: 'decay_generator', kind: 'generator', name: 'DECAY GENERATOR', model: MODEL('decay_generator'), layout: LAYOUT('decay_generator'), label: 'Open decay generator', height: 1.3, dx: 2.8, dz: 1.8, energy: { gen: 25 }, rad: 0.3,
    recipes: [{ in: { depleted_tbu: 1 }, out: {}, time: 120, fuel: true, rad: 0.4, power: 25 }]
  },
  {
    id: 'fission_reactor', kind: 'reactor', name: 'FISSION REACTOR', model: MODEL('fission_reactor'), layout: LAYOUT('fission_reactor'), label: 'Open fission reactor', height: 2.2, dx: 3.2, dz: 2.2,
    heatMax: 1000, coolPerWater: 120, coolPerHeavy: 320, rodSlots: REACTOR_ROD_SLOTS, radActive: 3,
    smoke: { at: [0, 4, -1.9], dir: [0, 0, -1], rate: 14, spread: 0.75, speed: 0.7, life: 3.2, size: 0.55 }
  },
  {
    id: 'fusion_reactor', kind: 'reactor', name: 'FUSION REACTOR', model: MODEL('fusion_reactor'), layout: LAYOUT('fusion_reactor'), label: 'Open fusion reactor', height: 2.5, dx: 3.4, dz: 2.4,
    heatMax: 2000, coolPerWater: 160, coolPerHeavy: 600, rodSlots: REACTOR_ROD_SLOTS, radActive: 1.2,
    smoke: { at: [0, 4.4, -2.1], dir: [0, 0, -1], rate: 9, spread: 0.6, speed: 0.55, life: 3.6, size: 0.45 }
  },
  {
    id: 'atmospheric_scrubber', kind: 'scrubber', name: 'ATMOSPHERIC SCRUBBER', model: MODEL('atmospheric_scrubber'), layout: LAYOUT('atmospheric_scrubber'), label: 'Open atmospheric scrubber', height: 1.8, dx: 2.8, dz: 1.8,
    energy: { use: 200 }, ambientCut: 0.15, filter: { item: 'filter_cartridge', seconds: 120 }
  },
  { id: 'energy_storage', kind: 'storage', name: 'ENERGY STORAGE', model: MODEL('energy_storage'), layout: LAYOUT('energy_storage'), label: 'Open energy storage', height: 1.3, dx: 2.8, dz: 1.8, capacity: 20000 },
  { id: 'simple_container', kind: 'storage', name: 'SIMPLE CONTAINER', model: 'assets/models/items/simple_container.gltf', label: 'Open simple container', height: 0.675, dx: 1.125, dz: 1.125, storageSlots: 14 },
  { id: 'cable', kind: 'cable', name: 'WOODEN POWERPOLE', model: MODEL('cable'), layout: LAYOUT('cable'), label: 'Wooden powerpole', height: 3.2, reach: 1.6, dx: 2.8, dz: 1.8 },
  { id: 'copper_director', kind: 'starter_cable', name: 'COPPER DIRECTOR', model: MODEL('copper_director'), layout: LAYOUT('cable'), label: 'Copper director', height: 0.325, reach: 0.15, dx: 0.55, dz: 0.55 },

  {
    id: 'excavator', kind: 'excavator', name: 'EXCAVATOR', model: MODEL('excavator'), layout: LAYOUT('excavator'), label: 'Open excavator', height: 3.0, dx: 3.2, dz: 2.2, sink: 0.083, energy: { use: 120 },
    outputs: 9, drillRate: 1.2, spin: 'cylinder', spinRate: 7
  },
  {
    id: 'bucket_wheel_excavator', kind: 'bwe', name: 'BUCKET WHEEL EXCAVATOR', model: MODEL('bucket_wheel_excavator'), layout: LAYOUT('bucket_wheel_excavator'), label: 'Control bucket wheel excavator',
    height: 14, dx: 8, dz: 5, energy: { use: 350 }, outputs: 64, noPad: true, footprint: [9, 5],
    bwe: { boomPivot: [5.375, 4.375, 0], mast: [3.8, 14.07, 0], boomAnchor: [16.38, 7.29, 0], ropeSpan: 14, ropeCenter: 0.25 }
  },
  { id: 'geiger_block', kind: 'geiger', name: 'GEIGER BLOCK', model: MODEL('geiger_block'), layout: LAYOUT('geiger_block'), label: 'Read geiger block', height: 1.0, dx: 2.8, dz: 1.8 },
  {
    id: 'radiation_absorber', kind: 'absorber', name: 'RADIATION ABSORBER', model: MODEL('radiation_absorber'), layout: LAYOUT('radiation_absorber'), label: 'Open radiation absorber', height: 1.5, dx: 2.8, dz: 1.8, energy: { use: 50 }, absorbRadius: 12, absorbRate: 0.6,
    recipes: [{ in: { lead_plate: 1 }, out: {}, time: 30, fuel: true }]
  },
  {
    id: 'decontaminator', kind: 'processor', name: 'DECONTAMINATOR', model: MODEL('decontaminator'), layout: LAYOUT('decontaminator'), label: 'Use decontaminator', height: 1.4, dx: 2.8, dz: 1.8, energy: { use: 40 },
    recipes: [
      { in: { depleted_leu: 1 }, out: { iodine_pill: 3 }, time: 10, rad: 1 },
    ]
  },

  {
    id: 'medicine_workbench', kind: 'processor', name: 'MEDICINE WORKBENCH', model: MODEL('medicine_workbench'), layout: LAYOUT('medicine_workbench'), label: 'Use medicine workbench', height: 1.3, dx: 2.8, dz: 1.8, energy: { use: 30 },
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

      {
        in: { radaway_iv: 1, plastic: 1 }, liquidIn: [{ id: 'radaway', amount: 1 }],
        out: { radaway_iv: 1, unrad_juice: 1 }, time: 6
      },
      { in: { unrad_juice: 2, iodine_pill: 3, lead_plate: 2, herb: 6 }, out: { stim: 1 }, time: 20 },
    ]
  },
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
  fusion_fuel: 'depleted_fusion',
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
  { out: { flashlight: 1 }, needs: { plastic: 2, copper_plate: 1, circuit_basic: 1 } },

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
  { out: { hand_crank: 1 }, needs: { iron_ingot: 2, copper_ingot: 1, wood: 2 } },
  { out: { rtg: 1 }, needs: { iron_ingot: 4, lead: 3, copper_ingot: 1 } },
  { out: { armor_workbench: 1 }, needs: { iron_ingot: 2, carbon: 2 } },
  { out: { gun_workbench: 1 }, needs: { iron_ingot: 5, carbon: 3 } },
  { out: { medicine_workbench: 1 }, needs: { iron_ingot: 4, carbon: 2, copper_plate: 1 } },
  { out: { liquid_mixer: 1 }, needs: { iron_ingot: 4, copper_ingot: 2, carbon: 2 } },
  { out: { crusher: 1 }, needs: { iron_ingot: 5, carbon: 2 } },
  { out: { electric_furnace: 1 }, needs: { iron_ingot: 5, carbon: 3 } },
  { out: { cable: 6 }, needs: { copper_ingot: 2, iron_ingot: 1 } },
  { out: { simple_container: 1 }, needs: { stone: 20, wood: 1 } },
  { out: { copper_director: 3 }, needs: { copper_ingot: 1, wood: 1 } },
  { out: { wooden_powerpole: 1 }, needs: { cable: 5, wood: 3 } },
  { out: { ingot_former: 1 }, needs: { iron_ingot: 4, copper_ingot: 2 } },
  { out: { press: 1 }, needs: { iron_ingot: 4, tin_ingot: 2 } },
  { out: { alloy_furnace: 1 }, needs: { iron_ingot: 6, carbon: 4 } },
  { out: { assembler: 1 }, needs: { machine_chassis: 2, circuit_advanced: 1, electric_motor: 1 } },

  { out: { test_bench: 1 }, needs: { iron_ingot: 2, car_battery: 1, copper_plate: 2 } },
  { out: { water_pump: 1 }, needs: { iron_ingot: 4, copper_ingot: 2, wood: 2 } },
];

// Machine benches craft over time; machine blocks are a real build, everything else is quick.
const CRAFT_TIME_ITEM = 2;
const CRAFT_TIME_BLOCK = 10;
for (const r of CRAFT_RECIPES) {
  if (r.time == null) r.time = Object.keys(r.out).some((id) => ITEM_DEFS[id]?.workbench) ? CRAFT_TIME_BLOCK : CRAFT_TIME_ITEM;
}


const TABLE_OUTPUTS = new Set([

  'iron_ingot', 'copper_ingot', 'tin_ingot', 'torch', 'lantern', 'flashlight', 'graphite', 'carbon_mesh',
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

  'manufactory', 'armor_workbench', 'gun_workbench', 'crusher', 'electric_furnace', 'cable', 'simple_container', 'copper_director', 'wooden_powerpole', 'liquid_mixer',
  'rtg', 'hand_crank', 'water_pump',
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


    if (def.kind === 'crafting' || (def.recipes || []).some((r) => r.time)) {
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

  if (def.manual) {
    el.push({ id: 'info', type: 'label', x: 0, y: 1, w: 12, h: 2, text: 'RIGHT-CLICK THE MACHINE TO TURN THE CRANK', size: 12 });
    el.push({ id: 'status', type: 'label', x: 0, y: 4, w: 12, h: 1, text: 'IDLE', size: 12 });
    return { version: 1, id: def.id, title, grid, theme, elements: el };
  }

  if (def.kind === 'storage') {
    const cols = 4;
    const slotCount = def.storageSlots || 14;
    for (let i = 0; i < slotCount; i++) {
      S(`slot${i}`, i % cols, 1 + Math.floor(i / cols), 1, 1, `slot${i}`, '');
    }
    return { version: 1, id: def.id, title, grid: { cols, rows: Math.max(5, Math.ceil(slotCount / cols) + 1), cell: 64 }, theme, elements: el };
  }

  if (def.kind === 'cable' || def.kind === 'starter_cable' || def.kind === 'geiger' || (def.kind === 'generator' && !def.recipes)) {
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

  if (def.kind === 'bwe') {
    // The BWE panel is built by WorkbenchUI: it needs a scrollable 64-slot
    // hold plus the yaw / boom / wheel controls.
    grid.rows = 8;
    el.push({ id: 'bwe', type: 'bwe', x: 0, y: 1, w: 12, h: 7, label: title });
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


  if (def.kind === 'scrubber') {
    S('fuel', 0, 1, 2, 2, 'fuel', 'FILTER');
    el.push({ id: 'info', type: 'label', x: 3, y: 1, w: 9, h: 2, text: 'INSERT A SCRUBBER FILTER', size: 12 });
    el.push({ id: 'status', type: 'label', x: 0, y: 4, w: 12, h: 1, text: 'NO FILTER', size: 12 });
    el.push({ id: 'progress', type: 'progress', x: 0, y: 5, w: 12, h: 1, label: 'FILTER' });
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

// The opening build order shown above the recipe filters. It walks the player
// from bare hands to the first powered machines, then hides itself after
// STARTER_GUIDE_SECONDS of real play time.
export const STARTER_GUIDE_SECONDS = 30 * 60;
export const STARTER_GUIDE = [
  'carbon', 'apple', 'pick',
  'hand_crank', 'manufactory',
  'crusher', 'electric_furnace', 'armor_workbench',
];

// The bottom-left NEXT STEP card walks the player through the full progression.
// A step completes from real state: items in the bag (`need`), a placed machine
// (`place`), or a running machine (`active`). Only the current step is shown.
export const GUIDE_STEPS = [
  { id: 'carbon', title: 'GATHER 4 CARBON', hint: 'Punch grass or stone with your bare hands.', need: { carbon: 4 } },
  { id: 'fruit', title: 'PUNCH TREES FOR 4 FRUIT', hint: 'Shake a tree for apples, oranges or pears.', need: { fruit: 4 } },
  { id: 'pick', title: 'FIND 1 PICKAXE', hint: 'Search the container ruins for a dropped pickaxe.', need: { pick: 1 } },
  { id: 'wood', title: 'CHOP 2 WOOD', hint: 'Hit a tree with the pickaxe you found.', need: { wood: 2 } },
  { id: 'hand_crank', title: 'BUILD A HAND CRANK', hint: '2 iron ingots, 1 copper ingot, 2 wood.', place: 'hand_crank' },
  { id: 'manufactory', title: 'BUILD A MANUFACTORY', hint: '3 iron ingots + 2 carbon.', place: 'manufactory' },
  { id: 'crusher', title: 'BUILD A CRUSHER', hint: '5 iron ingots + 2 carbon. Crushes ore for more yield.', place: 'crusher' },
  { id: 'electric_furnace', title: 'BUILD AN ELECTRIC FURNACE', hint: '5 iron ingots + 3 carbon. Smelts crushed ore.', place: 'electric_furnace' },
  { id: 'press', title: 'BUILD A PRESS', hint: '4 iron ingots + 2 tin ingots. Makes plates and chassis.', place: 'press' },
  { id: 'ingot_former', title: 'BUILD AN INGOT FORMER', hint: '4 iron ingots + 2 copper ingots. Turns ingots into plates.', place: 'ingot_former' },
  { id: 'alloy_furnace', title: 'BUILD AN ALLOY FURNACE', hint: '6 iron ingots + 4 carbon. Makes steel.', place: 'alloy_furnace' },
  { id: 'chassis', title: 'MAKE 2 MACHINE CHASSIS', hint: 'Press: 2 graphite + 1 iron plate each.', need: { machine_chassis: 2 } },
  { id: 'assembler', title: 'BUILD AN ASSEMBLER', hint: '2 machine chassis, an advanced circuit and an electric motor.', place: 'assembler' },
  { id: 'uranium', title: 'CRUSH 2 URANIUM ORE', hint: 'Use the crusher on uranium from a uranium seam.', need: { crushed_uranium: 2 } },
  { id: 'centrifuge', title: 'BUILD A CENTRIFUGE', hint: 'Assembler: chassis, circuit board, 2 motors, memory module.', place: 'centrifuge' },
  { id: 'u235', title: 'SEPARATE 2 URANIUM-235', hint: 'Run crushed uranium through the centrifuge.', need: { u235: 2 } },
  { id: 'research_lab', title: 'BUILD A RESEARCH LAB', hint: 'Assembler: 2 chassis, 2 circuit boards, 4 glass, 2 data disks.', place: 'research_lab' },
  { id: 'blueprint_reactor', title: 'RESEARCH THE REACTOR BLUEPRINT', hint: 'Lab: 2 U-235, a data disk, an advanced circuit and 2 lead plates.', need: { blueprint_reactor: 1 } },
  { id: 'isotope_separator', title: 'BUILD AN ISOTOPE SEPARATOR', hint: 'Assembler: 2 chassis, 2 circuit boards, 4 solenoids, 2 memory modules.', place: 'isotope_separator' },
  { id: 'fuel', title: 'CRAFT LEU-235 FUEL', hint: 'Separator: a fuel rod casing, 1 U-235 and 4 U-238.', need: { leu_235_fuel: 1 } },
  { id: 'fission_reactor', title: 'BUILD A FISSION REACTOR', hint: 'Assembler: 3 chassis, 3 circuit boards, 4 control rods, 4 reactor casings.', place: 'fission_reactor' },
  { id: 'reactor_on', title: 'START THE FISSION REACTOR', hint: 'Insert fuel and match the cooling rods to its target.', active: 'fission_reactor' },
  { id: 'reprocessor', title: 'BUILD A FUEL REPROCESSOR', hint: 'Assembler: 2 chassis, 2 circuit boards, 8 lead plates and a data drive.', place: 'fuel_reprocessor' },
  { id: 'pu239', title: 'EXTRACT 2 PLUTONIUM-239', hint: 'Reprocess or centrifuge spent LEU fuel.', need: { pu239: 2 } },
  { id: 'blueprint_fusion', title: 'RESEARCH THE FUSION BLUEPRINT', hint: 'Lab: 2 Pu-239, a data drive, 2 advanced circuits and carbon mesh.', need: { blueprint_fusion: 1 } },
  { id: 'fusion_reactor', title: 'BUILD A FUSION REACTOR', hint: 'Assembler: 6 chassis, 6 advanced circuits, 2 heavy-water rods, 8 reactor casings.', place: 'fusion_reactor' },
  { id: 'blueprint_scrubber', title: 'RESEARCH THE SCRUBBER BLUEPRINT', hint: 'Lab: 2 polonium, 2 data disks, an advanced circuit and 4 lead plates.', need: { blueprint_scrubber: 1 } },
  { id: 'scrubber', title: 'BUILD AN ATMOSPHERIC SCRUBBER', hint: 'Assembler: 4 chassis, 4 advanced circuits, 12 lead plates, 4 cooling fans.', place: 'atmospheric_scrubber' },
];

// Achievement columns. Each type owns one vertical column and every tier is
// another cell below it, so a type with five tiers fills five rows. Tiers are
// completed from counters in the world save (`stat`), a placed machine
// (`built`), or a machine that has actually run (`started`).
export const ACHIEVEMENT_TYPES = [
  {
    id: 'miner', name: 'MINER',
    tiers: [
      { name: 'FIRST SCRATCH', icon: 'dirt', req: 'Break 10 blocks.', stat: 'mined', need: 10 },
      { name: 'ORE HUNTER', icon: 'stone', req: 'Break 100 blocks.', stat: 'mined', need: 100 },
      { name: 'DEEP DIGGER', icon: 'iron', req: 'Break 500 blocks.', stat: 'mined', need: 500 },
      { name: 'SEAM BREAKER', icon: 'uranium', req: 'Break 2,500 blocks.', stat: 'mined', need: 2500 },
      { name: 'HOLLOW EARTH', icon: 'polonium', req: 'Break 10,000 blocks.', stat: 'mined', need: 10000 },
    ],
  },
  {
    id: 'builder', name: 'BUILDER',
    tiers: [
      { name: 'FIRST BLOCK', icon: 'dirt', req: 'Place 10 blocks.', stat: 'placed', need: 10 },
      { name: 'FOUNDATION', icon: 'stone', req: 'Place 100 blocks.', stat: 'placed', need: 100 },
      { name: 'CONCRETE JUNGLE', icon: 'glass', req: 'Place 500 blocks.', stat: 'placed', need: 500 },
      { name: 'WASTELAND ARCHITECT', icon: 'carbon', req: 'Place 2,500 blocks.', stat: 'placed', need: 2500 },
    ],
  },
  {
    id: 'craftsman', name: 'CRAFTSMAN',
    tiers: [
      { name: 'HANDMADE', icon: 'wood', req: 'Craft 1 item.', stat: 'crafted', need: 1 },
      { name: 'WORKSHOP', icon: 'iron_ingot', req: 'Craft 10 items.', stat: 'crafted', need: 10 },
      { name: 'ASSEMBLY LINE', icon: 'circuit_board', req: 'Craft 50 items.', stat: 'crafted', need: 50 },
      { name: 'INDUSTRIAL SCALE', icon: 'machine_chassis', req: 'Craft 200 items.', stat: 'crafted', need: 200 },
      { name: 'MASS PRODUCTION', icon: 'circuit_advanced', req: 'Craft 1,000 items.', stat: 'crafted', need: 1000 },
    ],
  },
  {
    id: 'engineer', name: 'ENGINEER',
    tiers: [
      { name: 'FIRST MACHINE', icon: 'hand_crank', req: 'Build 1 machine.', stat: 'machines', need: 1 },
      { name: 'SMALL FACTORY', icon: 'crusher', req: 'Build 5 machines.', stat: 'machines', need: 5 },
      { name: 'INDUSTRIAL PARK', icon: 'assembler', req: 'Build 15 machines.', stat: 'machines', need: 15 },
      { name: 'PRODUCTION EMPIRE', icon: 'centrifuge', req: 'Build 30 machines.', stat: 'machines', need: 30 },
      { name: 'ATOMIC INDUSTRY', icon: 'fission_reactor', req: 'Build 60 machines.', stat: 'machines', need: 60 },
    ],
  },
  {
    id: 'machinist', name: 'MACHINIST',
    tiers: [
      { name: 'CRANK IT', icon: 'hand_crank', req: 'Build a hand crank.', built: 'hand_crank' },
      { name: 'BENCH WORK', icon: 'manufactory', req: 'Build a manufactory.', built: 'manufactory' },
      { name: 'CRUSH HOUR', icon: 'crusher', req: 'Build a crusher.', built: 'crusher' },
      { name: 'ELECTRIC HEAT', icon: 'electric_furnace', req: 'Build an electric furnace.', built: 'electric_furnace' },
      { name: 'PRESSURE', icon: 'press', req: 'Build a press.', built: 'press' },
      { name: 'ALLOY AGE', icon: 'alloy_furnace', req: 'Build an alloy furnace.', built: 'alloy_furnace' },
      { name: 'PUT TOGETHER', icon: 'assembler', req: 'Build an assembler.', built: 'assembler' },
      { name: 'SPIN CYCLE', icon: 'centrifuge', req: 'Build a centrifuge.', built: 'centrifuge' },
      { name: 'SMART WORK', icon: 'research_lab', req: 'Build a research lab.', built: 'research_lab' },
      { name: 'ISOTOPES', icon: 'isotope_separator', req: 'Build an isotope separator.', built: 'isotope_separator' },
      { name: 'CRITICAL', icon: 'fission_reactor', req: 'Build a fission reactor.', built: 'fission_reactor' },
      { name: 'STARFIRE', icon: 'fusion_reactor', req: 'Build a fusion reactor.', built: 'fusion_reactor' },
      { name: 'CLEAN AIR', icon: 'atmospheric_scrubber', req: 'Build an atmospheric scrubber.', built: 'atmospheric_scrubber' },
    ],
  },
  {
    id: 'survivor', name: 'SURVIVOR',
    tiers: [
      { name: 'ONE MORE DAY', icon: 'apple', req: 'Survive to day 2.', stat: 'days', need: 2 },
      { name: 'SETTLED', icon: 'cup_noodles', req: 'Survive to day 5.', stat: 'days', need: 5 },
      { name: 'WASTELANDER', icon: 'iodine_pill', req: 'Survive to day 10.', stat: 'days', need: 10 },
      { name: 'LONG HAUL', icon: 'stim', req: 'Survive to day 20.', stat: 'days', need: 20 },
      { name: 'OLD GHOST', icon: 'radaway_iv', req: 'Survive to day 40.', stat: 'days', need: 40 },
    ],
  },
  {
    id: 'irradiated', name: 'IRRADIATED',
    tiers: [
      { name: 'HOT POCKET', icon: 'uranium', req: 'Reach 25 rad.', stat: 'dosePeak', need: 25 },
      { name: 'DANGER ZONE', icon: 'lead', req: 'Reach 100 rad.', stat: 'dosePeak', need: 100 },
      { name: 'HALF DEAD', icon: 'iodine_pill', req: 'Reach 450 rad.', stat: 'dosePeak', need: 450 },
      { name: 'WALKING CORE', icon: 'radaway_iv', req: 'Reach 1,000 rad.', stat: 'dosePeak', need: 1000 },
    ],
  },
  {
    id: 'hunter', name: 'HUNTER',
    tiers: [
      { name: 'FIRST BLOOD', icon: 'smg', req: 'Kill 1 wrapper.', stat: 'kills', need: 1 },
      { name: 'CLEAR THE YARD', icon: 'ammo_auto', req: 'Kill 10 wrappers.', stat: 'kills', need: 10 },
      { name: 'EXTERMINATOR', icon: 'fast_ar', req: 'Kill 50 wrappers.', stat: 'kills', need: 50 },
      { name: 'NOTHING LEFT', icon: 'ammo_rifle', req: 'Kill 200 wrappers.', stat: 'kills', need: 200 },
    ],
  },
  {
    id: 'researcher', name: 'RESEARCHER',
    tiers: [
      { name: 'BLUEPRINT', icon: 'data_disk', req: 'Research 1 blueprint.', stat: 'research', need: 1 },
      { name: 'REACTOR THEORY', icon: 'blueprint_reactor', req: 'Research 2 blueprints.', stat: 'research', need: 2 },
      { name: 'FUSION THEORY', icon: 'blueprint_fusion', req: 'Research 4 blueprints.', stat: 'research', need: 4 },
      { name: 'CLEANUP PLAN', icon: 'blueprint_scrubber', req: 'Research 6 blueprints.', stat: 'research', need: 6 },
    ],
  },
  {
    id: 'atomics', name: 'ATOMICS',
    tiers: [
      { name: 'CRITICAL ASSEMBLY', icon: 'fission_reactor', req: 'Build a fission reactor.', built: 'fission_reactor' },
      { name: 'CHAIN REACTION', icon: 'leu_235_fuel', req: 'Start a fission reactor.', started: 'fission' },
      { name: 'BOTTLE A STAR', icon: 'fusion_reactor', req: 'Build a fusion reactor.', built: 'fusion_reactor' },
      { name: 'SUNLIGHT', icon: 'fusion_fuel', req: 'Start a fusion reactor.', started: 'fusion' },
    ],
  },
  {
    id: 'fuel', name: 'FUEL CYCLE',
    tiers: [
      { name: 'ROD RUNNER', icon: 'leu_235_fuel', req: 'Craft 1 fuel rod.', stat: 'fuel', need: 1 },
      { name: 'ENRICHED', icon: 'heu_235_fuel', req: 'Craft 5 fuel rods.', stat: 'fuel', need: 5 },
      { name: 'BREEDER', icon: 'tbu_fuel', req: 'Craft 15 fuel rods.', stat: 'fuel', need: 15 },
      { name: 'PLUTONIUM ECONOMY', icon: 'mox_239_fuel', req: 'Craft 40 fuel rods.', stat: 'fuel', need: 40 },
    ],
  },
  {
    id: 'explorer', name: 'EXPLORER',
    tiers: [
      { name: 'STRETCH LEGS', icon: 'flower', req: 'Walk 500 blocks.', stat: 'walked', need: 500 },
      { name: 'LONG WALK', icon: 'herb', req: 'Walk 2,500 blocks.', stat: 'walked', need: 2500 },
      { name: 'TRAILBLAZER', icon: 'stone', req: 'Walk 10,000 blocks.', stat: 'walked', need: 10000 },
      { name: 'WASTELAND NOMAD', icon: 'glass', req: 'Walk 50,000 blocks.', stat: 'walked', need: 50000 },
    ],
  },
];

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

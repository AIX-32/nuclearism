    import * as THREE from 'three';
    import { WorkbenchUI } from './workbench-ui.js';
    import { CraftOptions } from './craft-options.js';
    import { DragDrop, inventoryAdapter } from './drag-drop.js';
    import { ITEM_DEFS, ITEM_MODEL_ICON_EXCLUDE, TERRAIN_BLOCKS, itemModelIcon, modelTint, MACHINE_DEFS, MACHINE_BY_ID, CRAFT_RECIPES, TABLE_RECIPES, layoutFor, TUNING, LIQUID_DEFS, regionOre, formatRad, formatRadRate, STARTER_GUIDE, STARTER_GUIDE_SECONDS, GUIDE_STEPS, ACHIEVEMENT_TYPES, BUILD_TIERS, BUILD_TIER_ORDER, BUILD_UPGRADES, BARREL_LOOT, rollWeighted } from './content.js';
    import * as Liquid from './liquids.js';
    import { MachineSystem } from './machines.js';
    import { PipeSystem } from './pipes.js';
    import { SkylineSystem } from './skyline.js';
    import { BuildingSystem, snapPlan } from './building.js';
    import { swingFrame } from './pieces/door.js';
    import { mateOf } from './pieces/bunker_door.js';
    import { MapSystem } from './map.js';
    import { createFootsteps, surfToCategory } from './footsteps.js';
    import { sourcePoint, transmission, relativeBearing, compass, shaftBurial, RAD_OCCL } from './radiation.js';
    import { vegTint } from './veg-tint.js';
    import { getSetting, renderSettings, onSettingsChange } from './settings.js';
    import { createReplay, pushFrame, pushEdit, sampleAt, editIndexAt, editAt, heldId, packReplay, unpackReplay, replayBytes, frameCount, editCount } from './replay.js';
    import { createReplayUI, formatTime } from './replay-ui.js';
    import { createRealisticTerrain } from './terrain-realistic.js';
    import { idbGet, idbSet, idbRemove, idbEntries } from './idb-store.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
    import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
    import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
    import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';





    const CHUNK_SIZE = 16;



    const MAX_RENDER_DISTANCE = 10000;
    const DETAIL_CHUNK_RADIUS = 6;




    const FAR_HAZE_REACH = 6;





    const FAR_RANGE_AMP = 900;
    const FAR_RANGE_REF = 30000;
    const FAR_RANGE_START = 3000;
    const FAR_RANGE_FULL = 8000;
    const SAMPLE_SIZE = CHUNK_SIZE + 2;
    const VERTEX_SIZE = CHUNK_SIZE + 1;
    const S2 = SAMPLE_SIZE * SAMPLE_SIZE;
    const V2 = VERTEX_SIZE * VERTEX_SIZE;



    const SAMPLE_SLICE = 600;


    const MENU_WORLD = window.__NUCLEARISM_WORLD__ || null;
    const WORLD_MODE = MENU_WORLD?.mode === 'sandbox' ? 'sandbox' : 'survival';
    const WORLD_TERRAIN = MENU_WORLD?.terrain === 'realistic' ? 'realistic' : 'legacy';
    const WORLD_FALLOUT = MENU_WORLD?.fallout === 'calm' ? 0.5 : MENU_WORLD?.fallout === 'severe' ? 1.75 : 1;
    const WORLD_START = MENU_WORLD?.start || 'dawn';
    const WORLD_NAME = MENU_WORLD?.name || 'WORLD';
    document.title = `NUCLEARISM: ${WORLD_NAME}`;

    let viewRadius = Math.min(MAX_RENDER_DISTANCE, getSetting('renderDistance'));
    let showInfoHud = getSetting('infoHud');
    let masterVolume = getSetting('volume');
    let musicEnabled = getSetting('music');
    let vsync = getSetting('vsync');
    let mouseSens = getSetting('sensitivity');
    let invertY = getSetting('invertY');
    const CHUNK_Y_MIN = -8;
    const CHUNK_Y_MAX = 2;

    const SAVE_KEY = MENU_WORLD ? `idte.save.v2.${MENU_WORLD.id}` : 'idte.save.v1';
    const ICON_CACHE_KEY = 'idte.icon.v24.';

    async function readSaveData(key = SAVE_KEY) {
      try {
        let raw = await idbGet(key);
        if (!raw) {
          console.info(`[save] no save found key=${key}`);
          return null;
        }
        if (typeof raw !== 'string') raw = JSON.stringify(raw);
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.edits)) {
          console.warn(`[save] invalid save data key=${key}`);
          return null;
        }
        console.info(`[save] loaded key=${key} bytes=${raw.length} edits=${data.edits.length / 2} machines=${Array.isArray(data.machines) ? data.machines.length : 0} play=${data.playTime ?? 0}s`);
        return data;
      } catch (e) {
        console.error(`[save] load failed key=${key}`, e);
        return null;
      }
    }

    const savedData = await readSaveData(SAVE_KEY);
    const _iconCachePreload = new Map(
      (await idbEntries(ICON_CACHE_KEY)).map(([k, v]) => [k.slice(ICON_CACHE_KEY.length), v ?? null])
    );


    let WORLD_SEED = Number.isFinite(MENU_WORLD?.seed) ? MENU_WORLD.seed | 0 : (Math.random() * 100000) | 0;
    let REALISTIC = null;
    let _realisticSeed = null;

    function realisticTerrain() {
      if (!REALISTIC || _realisticSeed !== WORLD_SEED) {
        REALISTIC = createRealisticTerrain(WORLD_SEED);
        _realisticSeed = WORLD_SEED;
      }
      return REALISTIC;
    }



    const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.35).normalize();
    const MOON_DIR = new THREE.Vector3(-0.55, 0.62, -0.35).normalize();
    const SUN_COL = new THREE.Color(0xfff2dd);
    const SKY_COL = new THREE.Color(0xbfd9ff);
    const UNDERWATER_COL = new THREE.Color(0x0a1e3a);





    const SEA_LEVEL = 20;
    const WATER_MIN_DEPTH = 0.5;
    const WATER_MIN_RENDER = 0.02;
    let WATER_OVERSHOOT = 22;
    const WATER_COVER_MIN = 0.18;
    const WATER_FADE = 2.4;



    const waterNormals = new THREE.TextureLoader().load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg',
      (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
    const waterUniforms = {
      uNormal: { value: waterNormals },
      uSize: { value: 40 },
      uTime: { value: 0 },
      uFade: { value: WATER_FADE },
      uSunDir: { value: SUN_DIR },
      uSunCol: { value: SUN_COL },
      uSkyCol: { value: SKY_COL },
      uUnderCol: { value: UNDERWATER_COL },
      uFogColor: { value: new THREE.Color(0xbfd9ff) },
      uFogNear: { value: 30 },
      uFogFar: { value: 90 },
    };





    function hash3(x, y, z) {
      let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

    function noise3(x, y, z) {
      const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
      const fx = x - ix, fy = y - iy, fz = z - iz;
      const ux = fade(fx), uy = fade(fy), uz = fade(fz);

      const c000 = hash3(ix, iy, iz), c100 = hash3(ix + 1, iy, iz);
      const c010 = hash3(ix, iy + 1, iz), c110 = hash3(ix + 1, iy + 1, iz);
      const c001 = hash3(ix, iy, iz + 1), c101 = hash3(ix + 1, iy, iz + 1);
      const c011 = hash3(ix, iy + 1, iz + 1), c111 = hash3(ix + 1, iy + 1, iz + 1);

      const x00 = c000 + (c100 - c000) * ux;
      const x10 = c010 + (c110 - c010) * ux;
      const x01 = c001 + (c101 - c001) * ux;
      const x11 = c011 + (c111 - c011) * ux;

      const y0 = x00 + (x10 - x00) * uy;
      const y1 = x01 + (x11 - x01) * uy;

      return y0 + (y1 - y0) * uz;
    }

    function fbm3(x, y, z, octaves) {
      let amp = 0.5, freq = 1, sum = 0, norm = 0;
      for (let i = 0; i < octaves; i++) {
        sum += amp * noise3(x * freq, y * freq, z * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
      }
      return sum / norm;
    }











    function climateAt(sx, sz) {
      return {
        t: fbm3(sx * 0.0008, 100.0, sz * 0.0008, 4) * 2 - 1,
        h: fbm3(sx * 0.0011, 200.0, sz * 0.0011, 4) * 2 - 1,
        c: fbm3(sx * 0.0005, 300.0, sz * 0.0005, 3) * 2 - 1,
        e: fbm3(sx * 0.0017, 400.0, sz * 0.0017, 3) * 2 - 1,
      };
    }


    const B = {
      DEEP_OCEAN: 0, OCEAN: 1, SHALLOW: 2, BEACH: 3,
      PLAINS: 4, FOREST: 5, JUNGLE: 6, SAVANNA: 7, DESERT: 8,
      TUNDRA: 11, SNOWY_PEAKS: 12, WASTELAND: 14, FLOWER_PLAINS: 15,
    };





    const BIOME_DEFS = {
      [B.DEEP_OCEAN]: { name: 'DEEP OCEAN', base: -16, amp: 3.0, rough: 1.5, top: [0.20, 0.22, 0.26], surf: 'rock' },
      [B.OCEAN]: { name: 'OCEAN', base: -9, amp: 2.5, rough: 1.2, top: [0.72, 0.66, 0.48], surf: 'sand' },
      [B.SHALLOW]: { name: 'SHALLOW', base: -3.5, amp: 2.0, rough: 1.0, top: [0.82, 0.76, 0.55], surf: 'sand' },
      [B.BEACH]: { name: 'BEACH', base: 0.8, amp: 1.2, rough: 0.6, top: [0.84, 0.78, 0.58], surf: 'sand' },
      [B.PLAINS]: { name: 'PLAINS', base: 3.0, amp: 2.5, rough: 1.0, top: [0.34, 0.62, 0.24], surf: 'grass' },
      [B.FOREST]: { name: 'FOREST', base: 4.5, amp: 4.0, rough: 1.2, top: [0.24, 0.50, 0.20], surf: 'grass' },
      [B.JUNGLE]: { name: 'JUNGLE', base: 6.0, amp: 5.0, rough: 1.6, top: [0.18, 0.55, 0.18], surf: 'grass' },
      [B.SAVANNA]: { name: 'SAVANNA', base: 4.0, amp: 1.2, rough: 0.4, top: [0.64, 0.58, 0.28], surf: 'dry', cave: 0.35 },
      [B.DESERT]: { name: 'DESERT', base: 3.5, amp: 3.5, rough: 0.8, top: [0.84, 0.72, 0.44], surf: 'sand' },
      [B.TUNDRA]: { name: 'TUNDRA', base: 4.0, amp: 2.0, rough: 0.8, top: [0.74, 0.76, 0.73], surf: 'snow' },
      [B.SNOWY_PEAKS]: { name: 'SNOWY PEAKS', base: 22.0, amp: 16.0, rough: 3.0, top: [0.92, 0.94, 0.97], surf: 'snow' },
      [B.WASTELAND]: { name: 'WASTELAND', base: 4.0, amp: 3.0, rough: 1.0, top: [0.18, 0.17, 0.15], surf: 'ash' },
      [B.FLOWER_PLAINS]: { name: 'FLOWER PLAINS', base: 3.2, amp: 2.0, rough: 0.8, top: [0.28, 0.56, 0.20], surf: 'grass' },
    };


    const LAND_ANCHORS = [
      [B.TUNDRA, -0.80, 0.10],
      [B.SNOWY_PEAKS, -0.45, -0.55],
      [B.PLAINS, 0.00, -0.10],
      [B.FLOWER_PLAINS, 0.08, 0.18],
      [B.FOREST, 0.15, 0.50],
      [B.JUNGLE, 0.75, 0.70],
      [B.SAVANNA, 0.50, -0.15],
      [B.DESERT, 0.80, -0.80],
      [B.WASTELAND, 0.05, -0.70],
    ];






    const _colKey = (a, b) => (
      a >= -1048576 && a <= 1048575 && b >= -1048576 && b <= 1048575
    ) ? ((a + 1048576) * 2097152 + (b + 1048576)) : `w${a},${b}`;
    const _trendCache = new Map();
    const _biomeCache = new Map();

    function cacheTerrainValue(cache, key, value) {
      cache.set(key, value);


      if (cache.size > 160000) {
        const it = cache.keys();
        for (let i = 0; i < 24000; i++) {
          const first = it.next();
          if (first.done) break;
          cache.delete(first.value);
        }
      }
      return value;
    }

    function biomeWeights(sx, sz) {
      const k = _colKey(Math.floor(sx), Math.floor(sz));
      let w = _biomeCache.get(k);
      if (w) return w;

      const { t, h } = climateAt(sx, sz);


      const scored = LAND_ANCHORS.map(([id, at, ah]) => {
        const dt = t - at, dh = h - ah;
        return [id, 1 / (dt * dt + dh * dh + 0.02)];
      }).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const sum = scored[0][1] + scored[1][1] + scored[2][1];
      w = scored.map(([id, s]) => ({ id, w: s / sum }));
      cacheTerrainValue(_biomeCache, k, w);
      return w;
    }


    function biomeAt(x, z) {
      const w = biomeWeights(x + WORLD_SEED, z + WORLD_SEED);
      let best = w[0];
      for (const e of w) if (e.w > best.w) best = e;
      return best.id;
    }













    function terrainTrend(sx, sz) {
      const k = _colKey(Math.floor(sx), Math.floor(sz));
      let v = _trendCache.get(k);
      if (v !== undefined) return v;

      if (WORLD_TERRAIN === 'realistic') {
        v = realisticTerrain().height(sx, sz);
      } else {
        v = legacyTerrainTrend(sx, sz);
      }
      cacheTerrainValue(_trendCache, k, v);
      return v;
    }

    function legacyTerrainTrend(sx, sz) {
      const { e } = climateAt(sx, sz);
      const w = biomeWeights(sx, sz);

      let base = 0, amp = 0, rough = 0, land = false;
      for (const { id, w: wt } of w) {
        const d = BIOME_DEFS[id];
        base += d.base * wt; amp += d.amp * wt; rough += d.rough * wt;
        if (id >= B.PLAINS) land = true;
      }



      const beltWarpX = fbm3(sx * 0.0017, 31.7, sz * 0.0017, 3) * 2 - 1;
      const beltWarpZ = fbm3(sx * 0.0017, 47.1, sz * 0.0017, 3) * 2 - 1;
      const belt = fbm3((sx + beltWarpX * 180) * 0.0024, 13.9, (sz + beltWarpZ * 180) * 0.0024, 3) * 2 - 1;
      const massif = Math.max(0, (belt - 0.04) / 0.72);
      const spineNoise = fbm3((sx + beltWarpX * 95) * 0.008, 21.3, (sz + beltWarpZ * 95) * 0.008, 4) * 2 - 1;
      const spines = Math.pow(Math.max(0, 1 - Math.abs(spineNoise)), 1.25);
      const drainage = Math.max(0, 1 - Math.abs(fbm3(sx * 0.017, 63.4, sz * 0.017, 3) * 2 - 1) * 4);
      const mountainLift = land
        ? Math.max(0, e - 0.22) * 20 + massif * (42 + 66 * spines) - drainage * massif * 18
        : 0;
      const hills = fbm3(sx * 0.0042, 0.0, sz * 0.0042, 4) * 2 - 1;
      const detail = fbm3(sx * 0.018, 5.5, sz * 0.018, 3) * 2 - 1;
      const ridge = fbm3(sx * 0.009, 9.3, sz * 0.009, 3) * 2 - 1;

      const raw = base
        + amp * 1.7 * hills
        + rough * 1.8 * detail
        + amp * 1.1 * (0.5 - Math.abs(ridge));


      return SEA_LEVEL + 26 * Math.tanh(raw / 26) + mountainLift;
    }




    function pondHere() { return false; }











    const _groundYCache = new Map();
    function groundYAt(sx, sz) {
      const qx = Math.floor(sx * 2), qz = Math.floor(sz * 2);
      const k = qx + ',' + qz;
      let v = _groundYCache.get(k);
      if (v !== undefined) return v;
      const info = columnDensity(sx, sz);
      const amp = info.underOcean ? 1.8 : 4.5;
      const dens = (y) => (info.h - y) + amp * (fbm3(sx * 0.035, y * 0.035, sz * 0.035, 2) * 2 - 1) * info.seaFade;

      let y0 = Math.floor(info.h);
      let d0 = dens(y0);
      v = y0 + amp;
      if (d0 > 0) {
        for (let y = y0; y < y0 + 12; y++) {
          const d = dens(y);
          if (d <= 0) { v = y - 1 + d0 / (d0 - d); break; }
          d0 = d;
        }
      } else {
        for (let y = y0; y > y0 - 12; y--) {
          const d = dens(y);
          if (d > 0) { v = y + d / (d - d0); break; }
          d0 = d;
        }
      }
      _groundYCache.set(k, v);
      if (_groundYCache.size > 160000) {
        const it = _groundYCache.keys();
        for (let i = 0; i < 24000; i++) {
          const first = it.next();
          if (first.done) break;
          _groundYCache.delete(first.value);
        }
      }
      return v;
    }

    const _colDensityCache = new Map();
    function columnDensity(sx, sz) {
      const k = _colKey(Math.floor(sx), Math.floor(sz));
      let v = _colDensityCache.get(k);
      if (v) return v;

      const w = biomeWeights(sx, sz);
      const underOcean = !!(w[0] && w[0].id <= B.BEACH);
      const h = terrainTrend(sx, sz)
        + (underOcean ? 0.45 : 1.8) * (noise3(sx * 0.09, 11.0, sz * 0.09) * 2 - 1);
      let caveBias = 0;
      for (const e of w) caveBias += (BIOME_DEFS[e.id].cave ?? 1) * e.w;

      v = {
        h, underOcean, caveBias,
        seaFade: Math.min(1, Math.max(0, (h - SEA_LEVEL) / 6)),
      };
      _colDensityCache.set(k, v);
      if (_colDensityCache.size > 160000) {
        const it = _colDensityCache.keys();
        for (let i = 0; i < 24000; i++) {
          const first = it.next();
          if (first.done) break;
          _colDensityCache.delete(first.value);
        }
      }
      return v;
    }






















    const CAVE_CELL = 80;
    const CAVE_CHANCE = 0.62;
    const CAVE_REACH = 48;
    const CAVE_SINK = 110;


    const NOODLE_CHANCE = 0.68;
    const NOODLE_REACH = 26;
    const NOODLE_DEPTH = 9;
    const NOODLE_FLOOR = 7;

    const _caveSites = new Map();
    const _caveCols = new Map();
    let _caveSeed = null;

    function caveHash(cx, cz, n) {
      return hash3(cx * 149 + WORLD_SEED + n * 811, n * 41 + 13, cz * 199 + WORLD_SEED + n * 607);
    }

    function buildCaveSite(cx, cz, px, pz, info, withMouth, withNoodle) {
      const y0 = info.h;
      const h = (n) => caveHash(cx, cz, n);
      const drift = (n, amt) => (h(n) - 0.5) * 2 * amt;
      const segs = [];
      const rooms = [];
      let hub = null;

      if (withMouth) {

        const big = h(4) < 0.38;
        const maxRY = Math.max(2.5, (y0 - 10) * 0.5);
        const rx = big ? 9 + 9 * h(5) : 4.2 + 2.4 * h(5);
        const ry = Math.min(rx * (big ? 0.5 + 0.18 * h(6) : 0.8), maxRY);
        const rz = rx * (0.8 + 0.45 * h(7));
        const roomX = px + drift(8, big ? 4 : 2);
        const roomZ = pz + drift(9, big ? 4 : 2);
        const depth = Math.max(13 + 12 * h(10), ry + 7);
        const roomY = Math.max(ry + 4, y0 - depth);

        const endX = roomX + drift(11, rx * 0.25);
        const endZ = roomZ + drift(12, rz * 0.25);
        const endY = roomY + ry * 0.35;




        const pts = [
          { x: px, y: y0 + 1.8, z: pz, r: 3.1 },
          { x: px + drift(7, 0.8), y: y0 - 4, z: pz + drift(8, 0.8), r: 2.5 },
        ];
        const steps = 4;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const ease = t * t * (3 - 2 * t);
          const wander = Math.sin(t * Math.PI) * Math.min(1, t * 2.5) * (big ? 7 : 4.5);
          pts.push({
            x: px + (endX - px) * ease + drift(20 + i * 3, wander),
            y: y0 - 4 + (endY - (y0 - 4)) * t,
            z: pz + (endZ - pz) * ease + drift(21 + i * 3, wander),
            r: 2.3 + t * 0.7 + (i === steps ? 0.6 : 0),
          });
        }

        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          segs.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, r: (a.r + b.r) * 0.5 });
        }
        rooms.push({ x: roomX, y: roomY, z: roomZ, rx, ry, rz });


        if (h(30) < 0.45) {
          const src = pts[2];
          const ang = h(31) * Math.PI * 2;
          const len = 7 + 10 * h(32);
          const bx = src.x + Math.cos(ang) * len;
          const bz = src.z + Math.sin(ang) * len;
          const by = Math.max(ry + 4, src.y - 1.5 - 1.5 * h(33));
          segs.push({ ax: src.x, ay: src.y, az: src.z, bx, by, bz, r: 2.1 + 0.8 * h(34) });
          rooms.push({
            x: bx, y: by, z: bz,
            rx: 3.4 + 1.8 * h(35), ry: 2.4 + h(36), rz: 3.4 + 1.8 * h(37),
          });
        }
      }

      if (withNoodle) {
        const top = info.h - NOODLE_DEPTH;
        if (top >= NOODLE_FLOOR + 8) {
          const hubX = px + drift(60, 10);
          const hubZ = pz + drift(61, 10);
          const midY = NOODLE_FLOOR + (top - NOODLE_FLOOR) * (0.35 + 0.5 * h(62));
          const arms = 3 + Math.floor(h(63) * 3);
          const ends = [];

          for (let i = 0; i < arms; i++) {
            const n = 64 + i * 12;
            const a = (i / arms) * Math.PI * 2 + drift(n, 0.55);
            const len = 9 + NOODLE_REACH * 0.7 * h(n + 1);
            const ex = hubX + Math.cos(a) * len;
            const ez = hubZ + Math.sin(a) * len;
            const ey = Math.max(NOODLE_FLOOR, Math.min(top, midY + drift(n + 2, 6)));


            const a1 = a + drift(n + 3, 0.9), a2 = a + drift(n + 4, 0.9);
            const k1x = hubX + Math.cos(a1) * len * 0.36;
            const k1z = hubZ + Math.sin(a1) * len * 0.36;
            const k1y = Math.max(NOODLE_FLOOR, Math.min(top, midY + (ey - midY) * 0.36 + drift(n + 5, 3)));
            const k2x = hubX + Math.cos(a2) * len * 0.68;
            const k2z = hubZ + Math.sin(a2) * len * 0.68;
            const k2y = Math.max(NOODLE_FLOOR, Math.min(top, midY + (ey - midY) * 0.68 + drift(n + 6, 3)));

            segs.push({ ax: hubX, ay: midY, az: hubZ, bx: k1x, by: k1y, bz: k1z, r: 1.8 + 0.4 * h(n + 7) });
            segs.push({ ax: k1x, ay: k1y, az: k1z, bx: k2x, by: k2y, bz: k2z, r: 1.5 + 0.5 * h(n + 8) });
            segs.push({ ax: k2x, ay: k2y, az: k2z, bx: ex, by: ey, bz: ez, r: 1.3 + 0.5 * h(n + 9) });
            ends.push({ x: ex, y: ey, z: ez, n });
          }


          for (let i = 0; i < ends.length; i++) {
            const a = ends[i], b = ends[(i + 1) % ends.length];
            if (h(a.n + 10) > 0.45) continue;
            segs.push({
              ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z,
              r: 1.2 + 0.4 * h(a.n + 11),
            });
          }


          hub = { x: hubX, y: midY, z: hubZ };
          rooms.push({
            x: hubX, y: midY, z: hubZ,
            rx: 2.8 + 1.8 * h(160), ry: 2.2 + 1.2 * h(161), rz: 2.8 + 1.8 * h(162),
          });
          for (const e of ends) {
            if (h(e.n + 10) < 0.45) continue;
            rooms.push({
              x: e.x, y: e.y, z: e.z,
              rx: 2.4 + 1.4 * h(e.n + 11), ry: 1.9 + 1.2 * h(e.n + 12), rz: 2.4 + 1.4 * h(e.n + 11),
            });
          }
        }
      }





      const spikes = [];
      for (let ri = 0; ri < rooms.length; ri++) {
        const r = rooms[ri];
        if (r.rx < 6.5) continue;
        const base = 200 + ri * 40;
        const count = 1 + Math.floor(h(base) * 4);

        for (let i = 0; i < count; i++) {
          const n = base + 4 + i * 4;
          const a = h(n) * Math.PI * 2;
          const rad = Math.sqrt(h(n + 1)) * 0.58;
          const bx = r.x + Math.cos(a) * r.rx * rad;
          const bz = r.z + Math.sin(a) * r.rz * rad;
          const q = ((bx - r.x) ** 2) / (r.rx * r.rx) + ((bz - r.z) ** 2) / (r.rz * r.rz);
          const ceil = r.y + r.ry * Math.sqrt(Math.max(0, 1 - q));
          const len = r.ry * (0.30 + 0.32 * h(n + 2));
          spikes.push({
            x: bx, y: ceil + 0.8, z: bz,
            tx: bx + drift(n + 3, 1.2), ty: ceil - len, tz: bz + drift(n + 4, 1.2),
            r: 0.8 + 1.5 * h(n + 5) + r.rx * 0.035,
          });
        }


        if (h(base + 2) < 0.5) {
          const up = 1 + Math.floor(h(base + 3) * 3);
          for (let i = 0; i < up; i++) {
            const n = base + 24 + i * 4;
            const a = h(n) * Math.PI * 2;
            const rad = Math.sqrt(h(n + 1)) * 0.55;
            const bx = r.x + Math.cos(a) * r.rx * rad;
            const bz = r.z + Math.sin(a) * r.rz * rad;
            const q = ((bx - r.x) ** 2) / (r.rx * r.rx) + ((bz - r.z) ** 2) / (r.rz * r.rz);
            const floorY = r.y - r.ry * Math.sqrt(Math.max(0, 1 - q));
            const len = r.ry * (0.18 + 0.22 * h(n + 2));
            spikes.push({
              x: bx, y: floorY - 0.8, z: bz,
              tx: bx + drift(n + 3, 0.9), ty: floorY + len, tz: bz + drift(n + 4, 0.9),
              r: 0.7 + 1.1 * h(n + 5) + r.rx * 0.02,
            });
          }
        }
      }

      if (!segs.length && !rooms.length) return null;


      const pad = 1.6;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      const grow = (x, y, z, ex, ey, ez) => {
        if (x - ex < minX) minX = x - ex;
        if (x + ex > maxX) maxX = x + ex;
        if (y - ey < minY) minY = y - ey;
        if (y + ey > maxY) maxY = y + ey;
        if (z - ez < minZ) minZ = z - ez;
        if (z + ez > maxZ) maxZ = z + ez;
      };
      for (const s of segs) {
        const r = s.r + pad;
        grow(s.ax, s.ay, s.az, r, r, r);
        grow(s.bx, s.by, s.bz, r, r, r);
      }
      for (const r of rooms) grow(r.x, r.y, r.z, r.rx + pad, r.ry + pad, r.rz + pad);




      for (const s of segs) {
        s.y0 = Math.min(s.ay, s.by) - s.r;
        s.y1 = Math.max(s.ay, s.by) + s.r;
      }
      for (const r of rooms) {
        r.y0 = r.y - r.ry;
        r.y1 = r.y + r.ry;
      }
      for (const sp of spikes) {
        sp.y0 = Math.min(sp.y, sp.ty) - sp.r;
        sp.y1 = Math.max(sp.y, sp.ty) + sp.r;
      }

      return {
        x: px, z: pz, y0, segs, rooms, spikes, hub,
        mouth: withMouth, noodle: withNoodle,
        minX, maxX, minY, maxY, minZ, maxZ,
      };
    }

    function caveSite(cx, cz) {
      if (_caveSeed !== WORLD_SEED) {
        _caveSeed = WORLD_SEED;
        _caveSites.clear();
        _caveCols.clear();
      }
      const k = (cx + 32768) * 65536 + (cz + 32768);
      if (_caveSites.has(k)) return _caveSites.get(k);

      let site = null;
      const mouthRoll = caveHash(cx, cz, 0) < CAVE_CHANCE;
      const noodleRoll = caveHash(cx, cz, 50) < NOODLE_CHANCE;

      if (mouthRoll || noodleRoll) {
        const px = (cx + 0.15 + 0.70 * caveHash(cx, cz, 1)) * CAVE_CELL;
        const pz = (cz + 0.15 + 0.70 * caveHash(cx, cz, 2)) * CAVE_CELL;
        const info = columnDensity(px, pz);

        let mouth = false;
        if (mouthRoll) {


          let mn = info.h, mx = info.h;
          for (const [ox, oz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
            const c = columnDensity(px + ox, pz + oz);
            if (c.h < mn) mn = c.h;
            if (c.h > mx) mx = c.h;
          }



          mouth = !info.underOcean && info.h > SEA_LEVEL + 2.5 && mx - mn <= 5
            && caveHash(cx, cz, 3) <= info.caveBias
            && !industrialPadAt(px - WORLD_SEED, pz - WORLD_SEED);
        }

        if (mouth || noodleRoll) site = buildCaveSite(cx, cz, px, pz, info, mouth, noodleRoll);
      }
      _caveSites.set(k, site);
      return site;
    }


    function caveSitesAt(sx, sz) {
      if (_caveSeed !== WORLD_SEED) {
        _caveSeed = WORLD_SEED;
        _caveSites.clear();
        _caveCols.clear();
      }
      const k = _colKey(Math.floor(sx), Math.floor(sz));
      let list = _caveCols.get(k);
      if (list) return list;

      list = [];
      const c0x = Math.floor((sx - CAVE_REACH) / CAVE_CELL);
      const c1x = Math.floor((sx + CAVE_REACH) / CAVE_CELL);
      const c0z = Math.floor((sz - CAVE_REACH) / CAVE_CELL);
      const c1z = Math.floor((sz + CAVE_REACH) / CAVE_CELL);
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const s = caveSite(cx, cz);
          if (!s) continue;
          if (sx < s.minX || sx > s.maxX || sz < s.minZ || sz > s.maxZ) continue;
          list.push(s);
        }
      }
      _caveCols.set(k, list);
      if (_caveCols.size > 160000) {
        const it = _caveCols.keys();
        for (let i = 0; i < 24000; i++) {
          const first = it.next();
          if (first.done) break;
          _caveCols.delete(first.value);
        }
      }
      return list;
    }



    function caveCarveAt(sx, y, sz) {
      const sites = caveSitesAt(sx, sz);
      let best = 0;
      let rock = 1;
      for (const s of sites) {
        if (y < s.minY || y > s.maxY) continue;

        for (const g of s.segs) {
          if (y < g.y0 || y > g.y1) continue;
          const abx = g.bx - g.ax, aby = g.by - g.ay, abz = g.bz - g.az;
          const apx = sx - g.ax, apy = y - g.ay, apz = sz - g.az;
          const len2 = abx * abx + aby * aby + abz * abz;
          let t = len2 > 1e-6 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
          const q2 = (dx * dx + dy * dy + dz * dz) / (g.r * g.r);
          if (q2 >= 1) continue;
          const w = 1 - Math.sqrt(q2);
          const cw = w * w * (3 - 2 * w);
          if (cw > best) best = cw;
        }

        for (const r of s.rooms) {
          if (y < r.y0 || y > r.y1) continue;
          const dx = (sx - r.x) / r.rx, dy = (y - r.y) / r.ry, dz = (sz - r.z) / r.rz;
          const q2 = dx * dx + dy * dy + dz * dz;
          if (q2 >= 1) continue;
          const w = 1 - Math.sqrt(q2);
          const cw = w * w * (3 - 2 * w);
          if (cw > best) best = cw;
        }



        for (const sp of s.spikes) {
          if (y < sp.y0 || y > sp.y1) continue;
          const ax = sp.tx - sp.x, ay = sp.ty - sp.y, az = sp.tz - sp.z;
          const len2 = ax * ax + ay * ay + az * az;
          if (len2 < 1e-6) continue;
          const px2 = sx - sp.x, py2 = y - sp.y, pz2 = sz - sp.z;
          const t = (px2 * ax + py2 * ay + pz2 * az) / len2;
          if (t <= 0 || t >= 1) continue;
          const cr = sp.r * (1 - t);
          const dx = px2 - ax * t, dy = py2 - ay * t, dz = pz2 - az * t;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const edge = 0.9;
          if (d >= cr + edge) continue;
          let w = d <= cr ? 1 : 1 - (d - cr) / edge;
          w = w * w * (3 - 2 * w);
          rock *= 1 - w;
        }
      }
      return best * rock;
    }

    function terrainDensity(x, y, z) {
      const sx = x + WORLD_SEED;
      const sz = z + WORLD_SEED;


      if (y <= 1) return 1000 + (1 - y) * 50;

      const info = columnDensity(sx, sz);
      const d = info.h - y;








      const amp = info.underOcean ? 1.8 : 4.5;

      if (d > 42 || d < -6) return d;

      let v = d;
      if (d >= -amp && d <= amp) {
        v = d + amp * (fbm3(sx * 0.035, y * 0.035, sz * 0.035, 2) * 2 - 1) * info.seaFade;
      }

      const cave = caveCarveAt(sx, y, sz);
      if (cave > 0) v -= cave * CAVE_SINK;

      return v;
    }






    const IND_CELL = 96;
    const IND_FADE = 8;
    const IND_MAX_R = 40;
    const IND_DIMS = {
      building_a:   { hx: 8.77,  hz: 12.50, h: 11.55 },
      garage:       { hx: 14.86, hz: 9.60,  h: 10.19 },
      container_01: { hx: 2.57,  hz: 6.46,  h: 4.57 },
      container_02: { hx: 2.57,  hz: 6.46,  h: 4.57 },
      container_03: { hx: 2.58,  hz: 6.46,  h: 4.57 },
      liquid_tank:  { hx: 4.42,  hz: 4.39,  h: 19.47 },
    };
    const _indSites = new Map();
    let _indSeed = null;

    function indHash(cx, cz, n) {
      return hash3(cx * 131 + WORLD_SEED + n * 977, n * 37 + 5, cz * 197 + WORLD_SEED + n * 613);
    }


    function indPadWeight(site, x, z) {
      const dx = Math.abs(x - site.x), dz = Math.abs(z - site.z);
      const wx = 1 - Math.max(0, dx - site.padX) / IND_FADE;
      const wz = 1 - Math.max(0, dz - site.padZ) / IND_FADE;
      if (wx <= 0 || wz <= 0) return 0;
      const w = Math.min(wx, wz);
      return w * w * (3 - 2 * w);
    }

    function industrialSite(cx, cz) {
      if (_indSeed !== WORLD_SEED) { _indSeed = WORLD_SEED; _indSites.clear(); }
      const k = (cx + 32768) * 65536 + (cz + 32768);
      if (_indSites.has(k)) return _indSites.get(k);

      let site = null;
      if (indHash(cx, cz, 1) < 0.55) {
        const px = (cx + 0.25 + 0.5 * indHash(cx, cz, 2)) * IND_CELL;
        const pz = (cz + 0.25 + 0.5 * indHash(cx, cz, 3)) * IND_CELL;



        let mn = Infinity, mx = -Infinity;
        for (const [ox, oz] of [[-18, -18], [18, -18], [-18, 18], [18, 18], [0, 0], [0, -18], [0, 18]]) {
          const t = terrainTrend(px + ox + WORLD_SEED, pz + oz + WORLD_SEED);
          if (t < mn) mn = t;
          if (t > mx) mx = t;
        }
        if (mx - mn <= 6.5 && mx > SEA_LEVEL + 2.0 && biomeAt(px, pz) >= B.PLAINS) {
          site = buildIndustrialSite(cx, cz, px, pz, mx + 0.1);
        }
      }
      _indSites.set(k, site);
      return site;
    }

    function industrialLootPoolForPlayer() {
      const slots = allSlots();
      const hasPick = slots.some((s) => s && s.id === 'pick');
      const hasAxe = slots.some((s) => s && s.id === 'axe');

      if (!hasPick && !hasAxe) {
        return ['pick', 'pick', 'pick', 'axe', 'axe', 'wood', 'carbon', 'wood', 'carbon'];
      }
      if (!hasPick) {
        return ['pick', 'pick', 'pick', 'pick', 'wood', 'carbon', 'axe', 'wood', 'carbon'];
      }
      if (!hasAxe) {
        return ['axe', 'axe', 'axe', 'axe', 'wood', 'carbon', 'pick', 'wood', 'carbon'];
      }
      return ['wood', 'carbon', 'wood', 'carbon', 'wood', 'carbon'];
    }

    function buildIndustrialSite(cx, cz, px, pz, y0) {
      const parts = [];
      let padX = 0, padZ = 0;

      if (indHash(cx, cz, 4) < 0.5) {

        const ids = ['building_a', 'garage'];
        const id = ids[Math.min(1, Math.floor(indHash(cx, cz, 6) * 2))];
        const dim = IND_DIMS[id];
        const s = id === 'garage' ? 0.5625 : 1;
        const turn = Math.floor(indHash(cx, cz, 7) * 4);
        const yaw = turn * Math.PI / 2;
        const ex = ((turn & 1) ? dim.hz : dim.hx) * s;
        const ez = ((turn & 1) ? dim.hx : dim.hz) * s;
        parts.push({ id, dx: 0, dz: 0, yaw, scale: s });
        padX = ex + 1.5;
        padZ = ez + 1.5;

        if (indHash(cx, cz, 8) < 0.35) {
          const t = IND_DIMS.liquid_tank;
          const tx = t.hx * 0.5, tz = t.hz * 0.5;
          const dx = ex + tx + 2.5;
          const dz = (indHash(cx, cz, 9) - 0.5) * ez * 0.8;
          parts.push({
            id: 'liquid_tank', dx, dz, scale: 0.5,
            yaw: Math.floor(indHash(cx, cz, 10) * 4) * Math.PI / 2,
          });
          padX = Math.max(padX, dx + tx + 1.5);
          padZ = Math.max(padZ, Math.abs(dz) + tz + 1.5);
        }
      } else {
        const ids = ['container_01', 'container_02', 'container_03'];
        const id = ids[Math.min(2, Math.floor(indHash(cx, cz, 15) * 3))];
        const dim = IND_DIMS[id];
        const turn = Math.floor(indHash(cx, cz, 11) * 4);
        const yaw = turn * Math.PI / 2;
        const ex = ((turn & 1) ? dim.hz : dim.hx) * 0.75;
        const ez = ((turn & 1) ? dim.hx : dim.hz) * 0.75;
        const slots = (turn & 1)
          ? [[0, 0], [0, 8], [16, 0], [16, 8]]
          : [[0, 0], [8, 0], [0, 16], [8, 16]];

        let count = 1;
        if (indHash(cx, cz, 12) < 0.50) count++;
        if (indHash(cx, cz, 13) < 0.25) count++;
        if (indHash(cx, cz, 14) < 0.10) count++;

        for (let i = 0; i < count; i++) {
          const [dx, dz] = slots[i];
          const partYaw = yaw + (indHash(cx, cz, 20 + i) < 0.5 ? 0 : Math.PI);
          const itemPool = industrialLootPoolForPlayer();
          const itemId = itemPool[Math.min(itemPool.length - 1, Math.floor(indHash(cx, cz, 25 + i) * itemPool.length))];
          const countRoll = itemId === 'carbon' ? 1 + (indHash(cx, cz, 40 + i) < 0.5 ? 1 : 0) : itemId === 'pick' ? 1 : 1 + (indHash(cx, cz, 45 + i) < 0.35 ? 1 : 0);
          parts.push({
            id,
            dx,
            dz,
            yaw: partYaw,
            scale: 0.75,
            loot: [{ id: itemId, n: countRoll }],
          });
          padX = Math.max(padX, Math.abs(dx) + ex + 1.5);
          padZ = Math.max(padZ, Math.abs(dz) + ez + 1.5);
        }
      }

      return { x: px, z: pz, y0, padX, padZ, parts };
    }


    function industrialPadAt(x, z) {
      const c0x = Math.floor((x - IND_MAX_R) / IND_CELL), c1x = Math.floor((x + IND_MAX_R) / IND_CELL);
      const c0z = Math.floor((z - IND_MAX_R) / IND_CELL), c1z = Math.floor((z + IND_MAX_R) / IND_CELL);
      let best = null, bw = 0;
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const s = industrialSite(cx, cz);
          if (!s) continue;
          if (Math.abs(x - s.x) > s.padX + IND_FADE || Math.abs(z - s.z) > s.padZ + IND_FADE) continue;
          const w = indPadWeight(s, x, z);
          if (w > bw) { bw = w; best = s; }
        }
      }
      return best ? { site: best, w: bw } : null;
    }

    function industrialInside(x, z) {
      const p = industrialPadAt(x, z);
      return !!(p && p.w >= 0.999);
    }



    function waterTable(x, z) { return SEA_LEVEL; }





    class DensityField {
      constructor() {
        this.edits = new Map();
        this.baseCache = new Map();
        this.onEdit = null;
      }

      static key(x, y, z) {
        if (x >= -32768 && x <= 32767 && y >= -32768 && y <= 32767 && z >= -32768 && z <= 32767) {
          return ((x + 32768) * 65536 + (y + 32768)) * 65536 + (z + 32768);
        }
        return `world:${x},${y},${z}`;
      }

      base(x, y, z) {
        const k = DensityField.key(x, y, z);
        let v = this.baseCache.get(k);
        if (v === undefined) {
          v = terrainDensity(x, y, z);


          const pad = industrialPadAt(x, z);
          if (pad) v += (pad.site.y0 - y - v) * pad.w;



          if (this.baseCache.size > 400000) {
            const it = this.baseCache.keys();
            for (let i = 0; i < 40000; i++) {
              const first = it.next();
              if (first.done) break;
              this.baseCache.delete(first.value);
            }
          }
          this.baseCache.set(k, v);
        }
        return v;
      }

      get(x, y, z) {
        const k = DensityField.key(x, y, z);
        const e = this.edits.get(k);
        return e !== undefined ? e : this.base(x, y, z);
      }




      valueAt(x, y, z) {
        return this.valueAtPadded(x, y, z, industrialPadAt(x, z));
      }




      valueAtPadded(x, y, z, pad) {
        const k = DensityField.key(x, y, z);
        const e = this.edits.get(k);
        if (e !== undefined) return e;
        let v = terrainDensity(x, y, z);
        if (pad) v += (pad.site.y0 - y - v) * pad.w;
        return v;
      }
      set(x, y, z, v) {
        this.edits.set(DensityField.key(x, y, z), v);
        if (this.onEdit) this.onEdit(x, y, z, v);
      }

      hasEdit(x, y, z) {
        return this.edits.has(DensityField.key(x, y, z));
      }


      sample(x, y, z) {
        const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
        const fx = x - ix, fy = y - iy, fz = z - iz;

        const c000 = this.get(ix, iy, iz);
        const c100 = this.get(ix + 1, iy, iz);
        const c010 = this.get(ix, iy + 1, iz);
        const c110 = this.get(ix + 1, iy + 1, iz);
        const c001 = this.get(ix, iy, iz + 1);
        const c101 = this.get(ix + 1, iy, iz + 1);
        const c011 = this.get(ix, iy + 1, iz + 1);
        const c111 = this.get(ix + 1, iy + 1, iz + 1);

        const x00 = c000 + (c100 - c000) * fx;
        const x10 = c010 + (c110 - c010) * fx;
        const x01 = c001 + (c101 - c001) * fx;
        const x11 = c011 + (c111 - c011) * fx;

        const y0 = x00 + (x10 - x00) * fy;
        const y1 = x01 + (x11 - x01) * fy;

        return y0 + (y1 - y0) * fz;
      }


      mineSphere(px, py, pz, r) {
        const x0 = Math.floor(px - r), x1 = Math.ceil(px + r);
        const y0 = Math.floor(py - r), y1 = Math.ceil(py + r);
        const z0 = Math.floor(pz - r), z1 = Math.ceil(pz + r);
        const r2 = r * r;

        for (let x = x0; x <= x1; x++) {
          const dx = x - px;
          for (let y = y0; y <= y1; y++) {
            const dy = y - py;
            for (let z = z0; z <= z1; z++) {
              const dz = z - pz;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > r2) continue;
              const falloff = 1 - Math.sqrt(d2) / r;
              const cur = this.get(x, y, z);
              this.set(x, y, z, cur - falloff * r * 1.8);
            }
          }
        }
        return { x0, x1, y0, y1, z0, z1 };
      }


      addSphere(px, py, pz, r) {
        const x0 = Math.floor(px - r), x1 = Math.ceil(px + r);
        const y0 = Math.floor(py - r), y1 = Math.ceil(py + r);
        const z0 = Math.floor(pz - r), z1 = Math.ceil(pz + r);
        const r2 = r * r;

        for (let x = x0; x <= x1; x++) {
          const dx = x - px;
          for (let y = y0; y <= y1; y++) {
            const dy = y - py;
            for (let z = z0; z <= z1; z++) {
              const dz = z - pz;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > r2) continue;
              const falloff = 1 - Math.sqrt(d2) / r;
              const cur = this.get(x, y, z);
              this.set(x, y, z, cur + falloff * r * 1.8);
            }
          }
        }
        return { x0, x1, y0, y1, z0, z1 };
      }


      snapshotBox(x0, x1, y0, y1, z0, z1) {
        const m = new Map();
        for (let x = x0; x <= x1; x++)
          for (let y = y0; y <= y1; y++)
            for (let z = z0; z <= z1; z++)
              m.set(DensityField.key(x, y, z), this.get(x, y, z));
        return m;
      }
    }







    const EDGE_A = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3];
    const EDGE_B = [1, 3, 0, 2, 5, 7, 4, 6, 4, 5, 6, 7];


    const _corners = [0, 0, 0, 0, 0, 0, 0, 0];
    const _wsurfCol = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE);

    class Chunk {
      constructor(world, cx, cy, cz) {
        this.world = world;
        this.cx = cx; this.cy = cy; this.cz = cz;
        this.ox = cx * CHUNK_SIZE;
        this.oy = cy * CHUNK_SIZE;
        this.oz = cz * CHUNK_SIZE;

        this.samples = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE * SAMPLE_SIZE);
        this.mesh = null;
        this.waterMesh = null;
        this.queued = false;
        this.wQueued = false;
        this.dead = false;
        this.hasSurface = true;
        this.built = false;
        this.samplesLoaded = false;
        this.samplePos = 0;
        this.pending = [];
      }






      loadSlice(count) {
        const s = this.samples;
        const field = this.world.field;
        const ox = this.ox, oy = this.oy, oz = this.oz;
        const S = SAMPLE_SIZE;
        const total = S * S * S;
        let c = this.samplePos;
        const end = Math.min(total, c + count);
        const t0 = performance.now();
        if (c === 0) { this._sMin = Infinity; this._sMax = -Infinity; }
        let sMin = this._sMin, sMax = this._sMax;
        let pk = NaN, pi = NaN, px = 0, pz = 0, pad = null;
        while (c < end) {
          const k = ((c / (S * S)) | 0) - 1;
          const i = ((c / S) | 0) % S - 1;
          const j = (c % S) - 1;
          if (k !== pk || i !== pi) {
            pk = k; pi = i;
            px = ox + i; pz = oz + k;
            pad = industrialPadAt(px, pz);
          }
          const v = field.valueAtPadded(px, oy + j, pz, pad);
          s[(i + 1) + (j + 1) * S + (k + 1) * S2] = v;
          if (v < sMin) sMin = v;
          if (v > sMax) sMax = v;
          c++;
          if ((c & 63) === 0 && performance.now() - t0 > 6) break;
        }
        this.samplePos = c;
        this._sMin = sMin; this._sMax = sMax;
        if (c < total) return false;
        this.samplesLoaded = true;
        this.hasSurface = !(sMin > 0 || sMax < 0);
        return true;
      }





      refreshPending() {
        if (!this.pending.length) return;
        const s = this.samples;
        const field = this.world.field;
        const ox = this.ox, oy = this.oy, oz = this.oz;
        const N = CHUNK_SIZE;
        let mn = this._sMin ?? Infinity, mx = this._sMax ?? -Infinity;
        for (const [x0, x1, y0, y1, z0, z1] of this.pending) {
          const i0 = Math.max(x0, ox - 1), i1 = Math.min(x1, ox + N);
          const j0 = Math.max(y0, oy - 1), j1 = Math.min(y1, oy + N);
          const k0 = Math.max(z0, oz - 1), k1 = Math.min(z1, oz + N);
          for (let k = k0; k <= k1; k++) {
            const kOff = (k - oz + 1) * S2;
            for (let j = j0; j <= j1; j++) {
              const jOff = kOff + (j - oy + 1) * SAMPLE_SIZE;
              for (let i = i0; i <= i1; i++) {
                const v = field.valueAt(i, j, k);
                s[(i - ox + 1) + jOff] = v;
                if (v < mn) mn = v;
                if (v > mx) mx = v;
              }
            }
          }
        }
        this.pending.length = 0;
        this._sMin = mn; this._sMax = mx;
        this.hasSurface = !(mn > 0 || mx < 0);
      }


      updateSurface() {
        const s = this.samples;
        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < s.length; i++) {
          const v = s[i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        this.hasSurface = !(mn > 0 || mx < 0);
      }












      buildMesh() {
        const N = CHUNK_SIZE;
        const S = SAMPLE_SIZE;
        const S2l = S2;
        const V = VERTEX_SIZE;
        const V2l = V2;
        const s = this.samples;
        const ox = this.ox, oy = this.oy, oz = this.oz;
        const field = this.world.field;

        const positions = [];
        const colors = [];
        const normals = [];
        const indices = [];
        const adata = [];
        const surfArr = [];
        const submArr = [];
        const basaltArr = [];

        const vg = new Int32Array(V * V * V).fill(-1);

        const samp = (i, j, k) => s[(i + 1) + (j + 1) * S + (k + 1) * S2l];
        const sampleAt = (rx, ry, rz) => {
          const lx = rx - ox + 1, ly = ry - oy + 1, lz = rz - oz + 1;
          if ((lx | ly | lz) >= 0 && lx < S && ly < S && lz < S) return s[lx + ly * S + lz * S2l];
          return field.get(rx, ry, rz);
        };
        const solidFn = (x, y, z) => {
          const rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
          const lx = rx - ox + 1, ly = ry - oy + 1, lz = rz - oz + 1;
          if ((lx | ly | lz) >= 0 && lx < S && ly < S && lz < S) return s[lx + ly * S + lz * S2l] > 0;
          return field.get(rx, ry, rz) > 0;
        };



        const c = _corners;
        const wsurfCol = _wsurfCol.fill(NaN);

        for (let k = -1; k <= N - 1; k++) {
          for (let j = -1; j <= N - 1; j++) {
            for (let i = -1; i <= N - 1; i++) {

              const d0 = samp(i, j, k);
              const d1 = samp(i + 1, j, k);
              const d2 = samp(i, j + 1, k);
              const d3 = samp(i + 1, j + 1, k);
              const d4 = samp(i, j, k + 1);
              const d5 = samp(i + 1, j, k + 1);
              const d6 = samp(i, j + 1, k + 1);
              const d7 = samp(i + 1, j + 1, k + 1);

              let mask = 0;
              if (d0 > 0) mask |= 1;
              if (d1 > 0) mask |= 2;
              if (d2 > 0) mask |= 4;
              if (d3 > 0) mask |= 8;
              if (d4 > 0) mask |= 16;
              if (d5 > 0) mask |= 32;
              if (d6 > 0) mask |= 64;
              if (d7 > 0) mask |= 128;
              if (mask === 0 || mask === 255) continue;

              c[0] = d0; c[1] = d1; c[2] = d2; c[3] = d3;
              c[4] = d4; c[5] = d5; c[6] = d6; c[7] = d7;


              let px = 0, py = 0, pz = 0, count = 0;
              for (let e = 0; e < 12; e++) {
                const a = EDGE_A[e], b = EDGE_B[e];
                const da = c[a], db = c[b];
                if ((da > 0) === (db > 0)) continue;

                const t = da / (da - db);
                const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
                const bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;

                px += ax + (bx - ax) * t;
                py += ay + (by - ay) * t;
                pz += az + (bz - az) * t;
                count++;
              }
              if (count === 0) continue;

              const wx = ox + i + px / count;
              const wy = oy + j + py / count;
              const wz = oz + k + pz / count;

              const vi = positions.length / 3;
              positions.push(wx, wy, wz);

              const rx = Math.round(wx), ry = Math.round(wy), rz = Math.round(wz);
              let nx = sampleAt(rx - 1, ry, rz) - sampleAt(rx + 1, ry, rz);
              let ny = sampleAt(rx, ry - 1, rz) - sampleAt(rx, ry + 1, rz);
              let nz = sampleAt(rx, ry, rz - 1) - sampleAt(rx, ry, rz + 1);
              const nl = Math.hypot(nx, ny, nz);
              if (nl > 1e-6) normals.push(nx / nl, ny / nl, nz / nl);
              else normals.push(0, 1, 0);

              const col = surfaceColor(wx, wy, wz);
              const occ = occlusionScale(field, wx, wy, wz, sampleAt, solidFn);
              colors.push(col[0], col[1], col[2]);
              adata.push(stoneMask, dirtMask, grassMask, occ);
              surfArr.push(_surf[0], _surf[1], _surf[2], _surf[3]);
              basaltArr.push(basaltMask);




              let subm = -1000;
              if (wy < SEA_LEVEL) {
                const ci = (i + 1) + (k + 1) * S;
                let sc = wsurfCol[ci];
                if (Number.isNaN(sc)) {
                  sc = this.world.surfaceAt(this.ox + i, this.oz + k);
                  if (sc === -Infinity) sc = -1000;
                  wsurfCol[ci] = sc;
                }
                subm = sc;
              }
              submArr.push(subm);

              vg[(i + 1) + (j + 1) * V + (k + 1) * V2l] = vi;
            }
          }
        }

        if (positions.length === 0) {
          return { positions: null, colors: null, indices: null };
        }

        const vidx = (i, j, k) => vg[(i + 1) + (j + 1) * V + (k + 1) * V2l];


        for (let k = 0; k < N; k++) {
          for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {

              const d = samp(i, j, k);
              const solid = d > 0;


              {
                const d1 = samp(i + 1, j, k);
                if ((d > 0) !== (d1 > 0)) {
                  const a = vidx(i, j - 1, k - 1);
                  const b = vidx(i, j, k - 1);
                  const cc = vidx(i, j, k);
                  const e = vidx(i, j - 1, k);
                  if (a >= 0 && b >= 0 && cc >= 0 && e >= 0) {
                    if (solid) indices.push(a, b, cc, a, cc, e);
                    else indices.push(a, cc, b, a, e, cc);
                  }
                }
              }


              {
                const d1 = samp(i, j + 1, k);
                if ((d > 0) !== (d1 > 0)) {
                  const a = vidx(i - 1, j, k - 1);
                  const b = vidx(i - 1, j, k);
                  const cc = vidx(i, j, k);
                  const e = vidx(i, j, k - 1);
                  if (a >= 0 && b >= 0 && cc >= 0 && e >= 0) {
                    if (solid) indices.push(a, b, cc, a, cc, e);
                    else indices.push(a, cc, b, a, e, cc);
                  }
                }
              }


              {
                const d1 = samp(i, j, k + 1);
                if ((d > 0) !== (d1 > 0)) {
                  const a = vidx(i - 1, j - 1, k);
                  const b = vidx(i, j - 1, k);
                  const cc = vidx(i, j, k);
                  const e = vidx(i - 1, j, k);
                  if (a >= 0 && b >= 0 && cc >= 0 && e >= 0) {
                    if (solid) indices.push(a, b, cc, a, cc, e);
                    else indices.push(a, cc, b, a, e, cc);
                  }
                }
              }
            }
          }
        }

        return {
          positions: new Float32Array(positions),
          colors: new Float32Array(colors),
          normals: new Float32Array(normals),
          indices: new Uint32Array(indices),
          data: new Float32Array(adata),
          surf: new Float32Array(surfArr),
          subm: new Float32Array(submArr),
          basalt: new Float32Array(basaltArr),
        };
      }


      rebuild() {
        if (!this.samplesLoaded) return;
        this.refreshPending();
        this.rebuildTerrain();
        if (this.oy <= SEA_LEVEL) this.rebuildWater();
        this.built = true;
      }

      rebuildTerrain() {
        if (!this.hasSurface) {
          if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
          }
          return;
        }

        const data = this.buildMesh();

        if (!data.positions) {
          if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
          }
          return;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
        if (data.normals) geo.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
        geo.setAttribute('aData', new THREE.BufferAttribute(data.data, 4));
        geo.setAttribute('aSurf', new THREE.BufferAttribute(data.surf, 4));
        geo.setAttribute('aSubm', new THREE.BufferAttribute(data.subm, 1));
        geo.setAttribute('aBasalt', new THREE.BufferAttribute(data.basalt, 1));
        geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
        if (!data.normals) geo.computeVertexNormals();
        geo.computeBoundingSphere();

        if (this.mesh) {
          this.mesh.geometry.dispose();
          this.mesh.geometry = geo;
        } else {
          this.mesh = new THREE.Mesh(geo, this.world.material);
          this.mesh.name = 'chunk';
          this.mesh.frustumCulled = true;
          this.world.scene.add(this.mesh);
        }
      }








      rebuildWater() {
        const world = this.world;
        const wsim = world.water;
        const N = CHUNK_SIZE;
        const pos = [], idx = [];

        const dropMesh = () => {
          if (this.waterMesh) {
            world.scene.remove(this.waterMesh);
            this.waterMesh.geometry.dispose();
            this.waterMesh = null;
          }
        };



        if (!wsim.depth.size) { dropMesh(); return; }



        const P = WATER_OVERSHOOT;
        const W = N + 2 * P;
        const level = new Float32Array(W * W).fill(NaN);
        const cellDepth = new Float32Array(W * W);

        for (let z = 0; z < W; z++) {
          for (let x = 0; x < W; x++) {
            const wx = this.ox - P + x, wz = this.oz - P + z;
            const d = wsim.depth.get(World.wk(wx, wz));
            if (!d || d < WATER_MIN_RENDER) continue;



            const s = wsim.pondAt(wx, wz) ? wsim.table(wx, wz) : wsim.floorAt(wx, wz) + d;
            if (s < this.oy || s >= this.oy + N) continue;
            level[z * W + x] = s;
            cellDepth[z * W + x] = d;
          }
        }




        for (let r = 0; r < P; r++) {
          let grew = false;
          for (let z = 0; z < W; z++) {
            for (let x = 0; x < W; x++) {
              const i = z * W + x;
              if (!Number.isNaN(level[i])) continue;
              let lv = NaN;
              if (x > 0 && !Number.isNaN(level[i - 1])) lv = level[i - 1];
              else if (x < W - 1 && !Number.isNaN(level[i + 1])) lv = level[i + 1];
              else if (z > 0 && !Number.isNaN(level[i - W])) lv = level[i - W];
              else if (z < W - 1 && !Number.isNaN(level[i + W])) lv = level[i + W];
              if (Number.isNaN(lv)) continue;


              const sx = this.ox - P + x + 0.5;
              const sz = this.oz - P + z + 0.5;
              const shoreY = world.getSurfaceHeight(sx, sz, lv + 8);


              if (shoreY >= lv - 8 || world.field.sample(sx, lv + 0.5, sz) <= 0) {
                level[i] = lv; grew = true;
              }
            }
          }
          if (!grew) break;
        }




        const CS = new Float32Array((N + 1) * (N + 1)).fill(NaN);
        const CD = new Float32Array((N + 1) * (N + 1));
        const CI = (x, z) => x + z * (N + 1);
        for (let gz = 0; gz <= N; gz++) {
          for (let gx = 0; gx <= N; gx++) {
            let sum = 0, n = 0, dep = 0;
            for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
              const pi = (P + gz + oz) * W + (P + gx + ox);
              const lv = level[pi];
              if (!Number.isNaN(lv)) { sum += lv; n++; if (cellDepth[pi] > dep) dep = cellDepth[pi]; }
            }
            if (n) { CS[CI(gx, gz)] = sum / n; CD[CI(gx, gz)] = dep; }
          }
        }


        const cell = (dx, dz) => level[(P + dz) * W + (P + dx)];
        const dep = [];
        let any = false;
        const vert = new Int32Array((N + 1) * (N + 1)).fill(-1);
        for (let dz = 0; dz < N; dz++) {
          for (let dx = 0; dx < N; dx++) {
            if (Number.isNaN(cell(dx, dz))) continue;
            any = true;
            for (const [ox2, oz2] of [[dx, dz], [dx + 1, dz], [dx, dz + 1], [dx + 1, dz + 1]]) {
              const k = CI(ox2, oz2);
              if (vert[k] < 0) {
                vert[k] = pos.length / 3;
                pos.push(this.ox + ox2, CS[k], this.oz + oz2);
                dep.push(CD[k]);
              }
            }
          }
        }
        if (!any) { dropMesh(); return; }

        for (let dz = 0; dz < N; dz++) {
          for (let dx = 0; dx < N; dx++) {
            if (Number.isNaN(cell(dx, dz))) continue;
            const a = vert[CI(dx, dz)], b = vert[CI(dx + 1, dz)],
              c = vert[CI(dx + 1, dz + 1)], d = vert[CI(dx, dz + 1)];
            idx.push(a, b, c, a, c, d);
          }
        }

        if (pos.length === 0) { dropMesh(); return; }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
        geo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(dep), 1));
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
        geo.computeBoundingSphere();

        if (this.waterMesh) {
          this.waterMesh.geometry.dispose();
          this.waterMesh.geometry = geo;
        } else {
          this.waterMesh = new THREE.Mesh(geo, world.waterMaterial);
          this.waterMesh.name = 'water';
          this.waterMesh.renderOrder = 2;
          world.scene.add(this.waterMesh);
        }
      }

      dispose() {
        this.dead = true;
        if (this.mesh) {
          this.world.scene.remove(this.mesh);
          this.mesh.geometry.dispose();
          this.mesh = null;
        }
        if (this.waterMesh) {
          this.world.scene.remove(this.waterMesh);
          this.waterMesh.geometry.dispose();
          this.waterMesh = null;
        }
      }
    }





    const _col = [0, 0, 0];
    let stoneMask = 0;
    let grassMask = 0;
    let dirtMask = 0;
    let basaltMask = 0;
    const _surf = [0, 0, 0, 0];
    function mountainRockAt(x, z) {
      if (WORLD_TERRAIN === 'realistic') {


        return realisticTerrain().slopeDeg(x + WORLD_SEED, z + WORLD_SEED) > 38;
      }
      return terrainTrend(x + WORLD_SEED, z + WORLD_SEED) - SEA_LEVEL > 30;
    }

    function surfaceColor(wx, wy, wz) {
      const n = (noise3(wx * 0.15, wy * 0.15, wz * 0.15) - 0.5) * 4.0;
      const def = BIOME_DEFS[biomeAt(wx, wz)];

      if (WORLD_TERRAIN === 'realistic') return realisticSurfaceColor(wx, wy, wz, def, n);


      const depth = terrainTrend(wx + WORLD_SEED, wz + WORLD_SEED) - wy + n;
      const top = def.top;

      let r, g, b;
      if (depth > 28) {
        r = 0.22; g = 0.22; b = 0.24;
      } else if (depth > 6) {
        const u = Math.min(1, (depth - 6) / 22);
        r = 0.33 + (0.22 - 0.33) * u;
        g = 0.32 + (0.22 - 0.32) * u;
        b = 0.36 + (0.24 - 0.36) * u;
      } else if (depth > 2) {
        const u = (6 - depth) / 4;
        r = 0.33 + (0.47 - 0.33) * u;
        g = 0.32 + (0.37 - 0.32) * u;
        b = 0.36 + (0.25 - 0.36) * u;
      } else if (depth > 0) {
        const u = 1 - depth / 2;
        r = 0.47 + (top[0] - 0.47) * u;
        g = 0.37 + (top[1] - 0.37) * u;
        b = 0.25 + (top[2] - 0.25) * u;
      } else {
        r = top[0]; g = top[1]; b = top[2];
      }


      const grain = (hash3(Math.floor(wx * 6.7), Math.floor(wy * 6.7), Math.floor(wz * 6.7)) - 0.5) * 0.07;

      _col[0] = r + grain;
      _col[1] = g + grain;
      _col[2] = b + grain;



      const exposedMountain = mountainRockAt(wx, wz) ? 1 : 0;
      basaltMask = depth >= 28 ? 1 : 0;
      grassMask = (def.surf !== 'rock' && depth < 1.2) ? 1 - exposedMountain : 0;
      dirtMask = (depth >= 1.2 && depth < 3.0) ? 1 : 0;
      stoneMask = depth >= 3.0 && depth < 28 ? 1 : (depth < 3.0 ? exposedMountain : 0);
      _surf[0] = def.surf === 'sand' ? 1 - exposedMountain : 0;
      _surf[1] = def.surf === 'dry' ? 1 - exposedMountain : 0;
      _surf[2] = def.surf === 'snow' ? 1 - exposedMountain : 0;
      _surf[3] = def.surf === 'ash' ? 1 - exposedMountain : 0;
      return _col;
    }






    function realisticSurfaceColor(wx, wy, wz, def, n) {
      const sx = wx + WORLD_SEED, sz = wz + WORLD_SEED;
      const s = realisticTerrain().surface(sx, sz, wy, def.surf);
      const rock = s.rock;
      const snow = s.snow;
      const depth = groundYAt(sx, sz) - wy;

      basaltMask = depth >= 28 ? 1 : 0;
      if (depth < 1.2) {
        grassMask = 1 - rock;
        dirtMask = 0;
        stoneMask = rock;
      } else if (depth < 3.0) {
        grassMask = 0;
        dirtMask = 1 - rock;
        stoneMask = rock;
      } else if (depth < 28) {
        grassMask = 0;
        dirtMask = 0;
        stoneMask = 1;
      } else {
        grassMask = 0;
        dirtMask = 0;
        stoneMask = 0;
      }
      _surf[0] = def.surf === 'sand' ? 1 - rock : 0;
      _surf[1] = def.surf === 'dry' ? 1 - rock : 0;
      _surf[2] = snow;
      _surf[3] = def.surf === 'ash' ? 1 - rock : 0;

      const top = def.top;
      let r, g, b;
      if (depth > 28) {
        r = 0.22; g = 0.22; b = 0.24;
      } else if (depth > 6) {
        const u = Math.min(1, (depth - 6) / 22);
        r = 0.33 + (0.22 - 0.33) * u;
        g = 0.32 + (0.22 - 0.32) * u;
        b = 0.36 + (0.24 - 0.36) * u;
      } else if (depth > 2) {
        const u = (6 - depth) / 4;
        r = 0.33 + (0.47 - 0.33) * u;
        g = 0.32 + (0.37 - 0.32) * u;
        b = 0.36 + (0.25 - 0.36) * u;
      } else if (depth > 0) {
        const u = 1 - depth / 2;
        r = 0.47 + (top[0] - 0.47) * u;
        g = 0.37 + (top[1] - 0.37) * u;
        b = 0.25 + (top[2] - 0.25) * u;
      } else {
        r = top[0]; g = top[1]; b = top[2];
      }
      const rockCol = [0.60, 0.58, 0.55];
      const snowCol = [0.95, 0.96, 0.99];
      for (let i = 0; i < 3; i++) {
        let c = [r, g, b][i] + (rockCol[i] - [r, g, b][i]) * rock;
        c += (snowCol[i] - c) * snow;
        c += (hash3(Math.floor(wx * 6.7) + i, Math.floor(wy * 6.7), Math.floor(wz * 6.7)) - 0.5) * 0.06;
        _col[i] = Math.min(1, Math.max(0, c));
      }
      return _col;
    }




    function surfTexture(seed, base, contrast) {
      const S = 64, c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const img = g.createImageData(S, S);
      const h = (a, b, P) => hash3(((a % P) + P) % P, ((b % P) + P) % P, seed);
      const w = (t) => t * t * (3 - 2 * t);
      const tile = (u, v, P) => {
        const ix = Math.floor(u), iy = Math.floor(v), ux = w(u - ix), uy = w(v - iy);
        const a = h(ix, iy, P), b = h(ix + 1, iy, P), c = h(ix, iy + 1, P), d = h(ix + 1, iy + 1, P);
        return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let v = 0, amp = 0.5, P = 4;
        for (let o = 0; o < 3; o++) { v += amp * tile(x / S * P, y / S * P, P); amp *= 0.5; P *= 2; }
        const d = (v - 0.5) * contrast;
        const i = (y * S + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, base[0] * (1 + d)));
        img.data[i + 1] = Math.max(0, Math.min(255, base[1] * (1 + d)));
        img.data[i + 2] = Math.max(0, Math.min(255, base[2] * (1 + d)));
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      return t;
    }








    function solidAt(field, x, y, z, solidFn) {
      if (solidFn) return solidFn(x, y, z);
      return field.get(Math.round(x), Math.round(y), Math.round(z)) > 0;
    }





    function occlusionScale(field, x, y, z, sampleFn, solidFn) {
      const val = (rx, ry, rz) => sampleFn ? sampleFn(rx, ry, rz) : field.get(rx, ry, rz);

      let skyVis = 1;
      for (let i = 1; i <= 6; i++) {
        const d = val(Math.round(x), Math.round(y + i * 1.6), Math.round(z));
        if (d > 0) { skyVis = i <= 2 ? 0.12 : 0.2; break; }
        if (d > -0.4) skyVis -= 0.1;
      }
      skyVis = Math.max(0.12, Math.min(1, skyVis));


      let sunVis = 1;
      const sx = 0.611, sy = 0.689, sz = 0.389;
      for (let i = 1; i <= 8; i++) {
        const t = i * 1.6;
        if (solidAt(field, x + sx * t, y + sy * t, z + sz * t, solidFn)) { sunVis = 0; break; }
      }


      return (0.06 + 0.94 * skyVis) * (sunVis > 0.5 ? 1.0 : 0.55);
    }













    class WaterSim {
      constructor(world) {
        this.world = world;
        this.depth = new Map();
        this.floor = new Map();
        this.tbl = new Map();
        this.pond = new Map();
        this.open = new Set();
        this.seeded = new Set();
        this.queued = new Set();
        this.seedQueue = [];
        this.active = new Set();
      }

      static ux(k) { return Math.floor(k / 65536) - 32768; }
      static uz(k) { return (k % 65536) - 32768; }

      pondAt(cx, cz) {
        const k = World.wk(cx, cz);
        let p = this.pond.get(k);
        if (p === undefined) { p = pondHere(cx, cz); this.pond.set(k, p); }
        return p;
      }




      canHold(cx, cz) {
        return this.open.has(World.wk(cx, cz)) || this.pondAt(cx, cz);
      }


      table(cx, cz) {
        const k = World.wk(cx, cz);
        let t = this.tbl.get(k);
        if (t === undefined) { t = waterTable(cx, cz); this.tbl.set(k, t); }
        return t;
      }

      floorAt(cx, cz) {
        const k = World.wk(cx, cz);
        let f = this.floor.get(k);
        if (f === undefined) {


          f = this.world.getSurfaceHeight(cx, cz, Math.ceil(this.table(cx, cz)) + 6);
          this.floor.set(k, f);
        }
        return f;
      }


      surfaceOf(cx, cz) {
        const d = this.depth.get(World.wk(cx, cz));
        return d > 0 ? this.floorAt(cx, cz) + d : -Infinity;
      }

      enqueue(x0, x1, z0, z1) {
        for (let x = x0; x <= x1; x++)
          for (let z = z0; z <= z1; z++) {
            const k = World.wk(x, z);
            if (this.seeded.has(k) || this.queued.has(k)) continue;
            this.queued.add(k);
            this.seedQueue.push(k);
          }
      }


      waken(x0, x1, z0, z1) {
        x0 = Math.floor(x0) - 1; x1 = Math.ceil(x1) + 1;
        z0 = Math.floor(z0) - 1; z1 = Math.ceil(z1) + 1;
        for (let x = x0; x <= x1; x++)
          for (let z = z0; z <= z1; z++) {
            const k = World.wk(x, z);
            this.floor.delete(k);
            this.tbl.delete(k);
            this.open.add(k);
            if (this.depth.has(k)) this.active.add(k);
          }
      }

      seed(k) {
        this.seeded.add(k);
        const cx = WaterSim.ux(k), cz = WaterSim.uz(k);
        if (!this.pondAt(cx, cz)) return;
        const d = this.table(cx, cz) - this.floorAt(cx, cz);
        if (d <= WATER_MIN_DEPTH) return;
        this.depth.set(k, d);
        this.active.add(k);

        this.world.markColumnDirty(cx, cz);
      }


      step(limit = Infinity) {
        if (!this.active.size) return null;
        const FLOW = 0.25, EPS = 0.001;
        const deltas = new Map();
        let processed = 0;

        for (const k of this.active) {
          if (processed++ >= limit) break;
          const d = this.depth.get(k);
          if (!d) continue;
          const cx = WaterSim.ux(k), cz = WaterSim.uz(k);
          const sa = this.floorAt(cx, cz) + d;
          let out = 0, flows = null;
          for (let n = 0; n < 4; n++) {
            const nx = cx + (n === 0 ? 1 : n === 1 ? -1 : 0);
            const nz = cz + (n === 2 ? 1 : n === 3 ? -1 : 0);
            if (!this.canHold(nx, nz)) continue;
            const nk = World.wk(nx, nz);
            const fb = this.floorAt(nx, nz);
            if (fb >= sa - EPS) continue;
            const sb = fb + (this.depth.get(nk) || 0);
            if (sa <= sb + EPS) continue;
            const f = (sa - sb) * FLOW;
            if (f <= 0.0004) continue;
            (flows || (flows = [])).push(nk, f);
            out += f;
          }
          if (!out) continue;
          const scale = out > d ? d / out : 1;
          for (let i = 0; i < flows.length; i += 2)
            deltas.set(flows[i], (deltas.get(flows[i]) || 0) + flows[i + 1] * scale);
          deltas.set(k, (deltas.get(k) || 0) - out * scale);
        }

        this.active = new Set();
        if (!deltas.size) return null;

        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, moved = false;
        for (const [k, dd] of deltas) {
          const cx = WaterSim.ux(k), cz = WaterSim.uz(k);
          const nd = (this.depth.get(k) || 0) + dd;
          if (nd > 0.004) {
            this.depth.set(k, nd);
            this.seeded.add(k);
            this.active.add(k);
            for (let n = 0; n < 4; n++) {
              const nx = cx + (n === 0 ? 1 : n === 1 ? -1 : 0);
              const nz = cz + (n === 2 ? 1 : n === 3 ? -1 : 0);
              this.active.add(World.wk(nx, nz));
            }
          } else {
            this.depth.delete(k);
          }
          if (Math.abs(dd) > 0.02) {
            if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
            if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
            moved = true;
          }
        }
        return moved ? { x0, x1, z0, z1 } : null;
      }

      update(submerged = false) {



        let budget = submerged ? 300 : 1500;
        while (this.seedQueue.length && budget-- > 0) {
          const k = this.seedQueue.pop();
          this.queued.delete(k);
          if (!this.seeded.has(k)) this.seed(k);
        }
        const stepBudget = submerged ? 1 : 3;
        const stepLimit = submerged ? 200 : 800;
        for (let i = 0; i < stepBudget; i++) {
          const box = this.step(stepLimit);
          if (!box) break;
          this.world.markWaterDirty(box.x0, box.x1, box.z0, box.z1);
        }
      }
    }





    class World {
      constructor(scene) {
        this.scene = scene;
        this.field = new DensityField();
        this.chunks = new Map();
        this.columnTopChunks = new Map();
        this.dirty = [];
        this.loading = [];
        this.waterDirty = [];
        this.columnHeightCache = new Map();
        this.water = new WaterSim(this);
        this.builtCount = 0;
        this.jobs = [];
        this.jobTick = 0;

        this.material = new THREE.MeshLambertMaterial({
          vertexColors: true,
          flatShading: false,
        });



        const stoneTex = new THREE.TextureLoader().load('assets/images/stone.jpg');
        stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
        stoneTex.colorSpace = THREE.SRGBColorSpace;
        stoneTex.anisotropy = 4;
        this.stoneTexture = stoneTex;
        const grassTex = new THREE.TextureLoader().load('assets/images/grass.jpg');
        grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.colorSpace = THREE.SRGBColorSpace;
        grassTex.anisotropy = 4;
        this.farGrassTexture = grassTex;
        const dirtTex = new THREE.TextureLoader().load('assets/images/dirt.jpg');
        dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
        dirtTex.colorSpace = THREE.SRGBColorSpace;
        dirtTex.anisotropy = 4;
        this.dirtTexture = dirtTex;
        const basaltTex = new THREE.TextureLoader().load('assets/images/basalt.jpg');
        basaltTex.wrapS = basaltTex.wrapT = THREE.RepeatWrapping;
        basaltTex.colorSpace = THREE.SRGBColorSpace;
        basaltTex.anisotropy = 4;
        this.basaltTexture = basaltTex;


        const sandTex = surfTexture(11, [214, 196, 140], 0.28);
        const dryTex = new THREE.TextureLoader().load('assets/images/dry.jpg');
        dryTex.wrapS = dryTex.wrapT = THREE.RepeatWrapping;
        dryTex.colorSpace = THREE.SRGBColorSpace;
        dryTex.anisotropy = 4;
        const snowTex = surfTexture(33, [236, 242, 250], 0.14);
        const ashTex = new THREE.TextureLoader().load('assets/images/ash.jpg');
        ashTex.wrapS = ashTex.wrapT = THREE.RepeatWrapping;
        ashTex.colorSpace = THREE.SRGBColorSpace;
        ashTex.anisotropy = 4;
        this.farBiomeTextures = { grass: grassTex, sand: sandTex, dry: dryTex, snow: snowTex, ash: ashTex };
        this.material.onBeforeCompile = (shader) => {
          shader.uniforms.stoneMap = { value: stoneTex };
          shader.uniforms.grassMap = { value: grassTex };
          shader.uniforms.dirtMap = { value: dirtTex };
          shader.uniforms.basaltMap = { value: basaltTex };
          shader.uniforms.sandMap = { value: sandTex };
          shader.uniforms.dryMap = { value: dryTex };
          shader.uniforms.snowMap = { value: snowTex };
          shader.uniforms.ashMap = { value: ashTex };
          shader.uniforms.uUnderwaterCol = { value: UNDERWATER_COL };
          shader.uniforms.uForceStoneY = { value: WORLD_TERRAIN === 'realistic' ? 1e6 : 50 };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
          attribute vec4 aData;
          attribute vec4 aSurf;
          attribute float aSubm;
          attribute float aBasalt;
          varying vec3 vWPos; varying vec3 vWNorm;
          varying float vStone; varying float vDirt; varying float vTop; varying float vOcc;
          varying vec4 vSurf;
          varying float vSubm;
          varying float vBasalt;`)
            .replace('#include <fog_vertex>', `#include <fog_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNorm = normalize(mat3(modelMatrix) * objectNormal);
          vStone = aData.x; vDirt = aData.y; vTop = aData.z; vOcc = aData.w;
          vSurf = aSurf;
          vSubm = aSubm;
          vBasalt = aBasalt;`);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
          uniform sampler2D stoneMap; uniform sampler2D grassMap; uniform sampler2D dirtMap; uniform sampler2D basaltMap;
          uniform sampler2D sandMap; uniform sampler2D dryMap; uniform sampler2D snowMap; uniform sampler2D ashMap;
          uniform vec3 uUnderwaterCol;
          uniform float uForceStoneY;
          varying vec3 vWPos; varying vec3 vWNorm;
          varying float vStone; varying float vDirt; varying float vTop; varying float vOcc;
          varying vec4 vSurf;
          varying float vSubm;
          varying float vBasalt;
          vec3 triplanar(sampler2D m, vec3 p, vec3 n, float sc) {
            vec3 an = pow(abs(n), vec3(4.0));
            an /= (an.x + an.y + an.z);
            return texture2D(m, p.zy * sc).rgb * an.x
                 + texture2D(m, p.xz * sc).rgb * an.y
                 + texture2D(m, p.xy * sc).rgb * an.z;
          }
          vec3 rotY(vec3 p, float a) {
            float c = cos(a), s = sin(a);
            return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
          }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 tn = normalize(vWNorm);
          vec3 tBase = mix(diffuseColor.rgb, triplanar(stoneMap, vWPos, tn, 0.08), vStone);
          tBase = mix(tBase, triplanar(basaltMap, vWPos, tn, 0.08), vBasalt);
          tBase = mix(tBase, triplanar(dirtMap, vWPos, tn, 0.1), vDirt);
          // surface layer: grass by default, swapped per-biome by vSurf, using real textures with no tinting. blend lets biome borders soften.
          vec3 topTex = triplanar(grassMap, vWPos, tn, 0.4);
          topTex = mix(topTex, triplanar(sandMap, vWPos, tn, 0.30), vSurf.x);
          topTex = mix(topTex, triplanar(dryMap,  vWPos, tn, 0.40), vSurf.y);
          topTex = mix(topTex, triplanar(snowMap, vWPos, tn, 0.22), vSurf.z);
          // wasteland: blend three pseudo-random rotations so the tile grid never
          // lines up and reads as a repeat. Averaged → continuous, no seams.
          vec3 ashT = (triplanar(ashMap, rotY(vWPos, 0.0),    tn, 0.35)
                     + triplanar(ashMap, rotY(vWPos, 2.0944), tn, 0.35)
                     + triplanar(ashMap, rotY(vWPos, 4.1888), tn, 0.35)) * (1.0 / 3.0);
          topTex = mix(topTex, ashT, vSurf.w);
          tBase = mix(tBase, topTex, vTop);
          // Apply a fragment-level cutoff so interpolated vertex masks cannot
          // leave a green halo between the grass foothills and exposed stone.
          tBase = mix(tBase, triplanar(stoneMap, vWPos, tn, 0.08), step(uForceStoneY, vWPos.y));
          diffuseColor.rgb = tBase * vOcc;`)
            .replace('#include <fog_fragment>', `
          // underwater haze: ground deeper under its local water surface fades to
          // the water tint, so submerged terrain reads smoggy even seen from above.
          // vSubm carries this vertex's water surface (-1000 when dry).
          float wDepth = vSubm - vWPos.y;
          if (wDepth > 0.0) {
            float haze = 1.0 - exp(-wDepth * 0.1);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uUnderwaterCol, haze * 0.95);
          }
          #include <fog_fragment>`);
        };
        this.material.customProgramCacheKey = () => 'terrain-surface-v3';






        this.waterMaterial = new THREE.ShaderMaterial({
          uniforms: waterUniforms,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          vertexShader: `
        uniform float uTime;
        attribute float aDepth;
        varying vec3 vWorld;
        varying float vDepth;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += 0.04 * sin(wp.x * 0.5 + uTime * 0.8)
                + 0.04 * sin(wp.z * 0.6 - uTime * 0.7);
          vWorld = wp.xyz;
          vDepth = aDepth;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
          fragmentShader: `
        uniform sampler2D uNormal;
        uniform float uSize, uTime, uFade;
        uniform vec3 uSunDir, uSunCol, uSkyCol, uUnderCol;
        uniform vec3 uFogColor; uniform float uFogNear, uFogFar;
        varying vec3 vWorld;
        varying float vDepth;
        vec4 getNoise(vec2 uv) {
          vec2 uv0 = uv / 103.0 + vec2(uTime / 17.0, uTime / 29.0);
          vec2 uv1 = uv / 107.0 - vec2(uTime / -19.0, uTime / 31.0);
          vec2 uv2 = uv / vec2(8907.0, 9803.0) + vec2(uTime / 101.0, uTime / 97.0);
          vec2 uv3 = uv / vec2(1091.0, 1027.0) - vec2(uTime / 109.0, uTime / -113.0);
          return (texture2D(uNormal, uv0) + texture2D(uNormal, uv1)
                + texture2D(uNormal, uv2) + texture2D(uNormal, uv3)) * 0.5 - 1.0;
        }
        void main() {
          vec4 noise = getNoise(vWorld.xz * uSize);
          vec3 n = normalize(noise.xzy * vec3(2.5, 1.0, 2.5));
          if (!gl_FrontFacing) n.y = -n.y;               // seen from underwater

          vec3 eyeDir = normalize(cameraPosition - vWorld);

          vec3 refl = normalize(reflect(-uSunDir, n));      // sun mirror dir
          float theta = max(dot(eyeDir, n), 0.0);
          float reflectance = 0.3 + 0.7 * pow(1.0 - theta, 5.0);

          // dark base for contrast, then each ripple facet brightens within the
          // SAME blue hue (not toward the pale sky, which desaturates it), so
          // the chop reads as moving texture; the sun adds crisp sparkle.
          vec3 glintBlue = uUnderCol * 4.0;
          vec3 albedo = uUnderCol * (0.6 + 0.6 * max(dot(uSunDir, n), 0.0));
          albedo = mix(albedo, glintBlue, clamp(reflectance * 0.6, 0.0, 1.0));
          albedo += uSunCol * pow(max(dot(eyeDir, refl), 0.0), 120.0) * 0.8;

          float fogF = smoothstep(uFogNear, uFogFar, distance(cameraPosition, vWorld));
          albedo = mix(albedo, uFogColor, fogF);

          // Fade the shore to a gentle tint: more transparent at the edge, but still
          // opaque enough to read the water plane and preserve its silhouette.
          float shore = smoothstep(0.0, uFade, vDepth);
          if (shore < 0.02) discard;
          float alpha = 0.45 + 0.25 * shore;
          gl_FragColor = vec4(albedo, alpha);
        }`,
        });


        this.playerPos = new THREE.Vector3(0, 40, 0);
      }


      static ck(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }
      static wk(x, z) { return (x + 32768) * 65536 + (z + 32768); }

      getChunk(cx, cy, cz) {
        return this.chunks.get(World.ck(cx, cy, cz));
      }



      columnMaxHeight(cx, cz) {
        const key = World.wk(cx, cz);
        let v = this.columnHeightCache.get(key);
        if (v !== undefined) return v;
        let maxHeight = -Infinity;
        for (let z = 0; z <= CHUNK_SIZE; z += 4) {
          for (let x = 0; x <= CHUNK_SIZE; x += 4) {
            maxHeight = Math.max(maxHeight, terrainTrend(
              cx * CHUNK_SIZE + x + WORLD_SEED,
              cz * CHUNK_SIZE + z + WORLD_SEED,
            ));
          }
        }
        this.columnHeightCache.set(key, maxHeight);
        if (this.columnHeightCache.size > 20000) {
          const oldest = this.columnHeightCache.keys().next().value;
          this.columnHeightCache.delete(oldest);
        }
        return maxHeight;
      }


      topChunkForColumn(cx, cz) {
        const key = World.wk(cx, cz);
        let top = this.columnTopChunks.get(key);
        if (top !== undefined) return top;
        top = Math.max(CHUNK_Y_MAX, Math.floor(this.columnMaxHeight(cx, cz) / CHUNK_SIZE) + 1);
        this.columnTopChunks.set(key, top);
        if (this.columnTopChunks.size > 20000) {
          const oldest = this.columnTopChunks.keys().next().value;
          this.columnTopChunks.delete(oldest);
        }
        return top;
      }


      update(px, py, pz) {
        this.playerPos.set(px, py, pz);

        const pcx = Math.floor(px / CHUNK_SIZE);
        const pcz = Math.floor(pz / CHUNK_SIZE);
        const detailRadius = Math.min(viewRadius, DETAIL_CHUNK_RADIUS);
        if (pcx !== this._pcx || pcz !== this._pcz || detailRadius !== this._detailRadius) {
          this._pcx = pcx; this._pcz = pcz; this._detailRadius = detailRadius;
          this._streamDZ = -detailRadius;
          this._streamDX = -detailRadius;
          this._streamCY = null;
          this._unloadNeeded = true;
          this._unloadIter = null;
        }

        if (this._streamDZ != null) {
          let budget = 48;
          outer: for (let dz = this._streamDZ; dz <= detailRadius; dz++) {
            let dxStart = (dz === this._streamDZ) ? this._streamDX : -detailRadius;
            for (let dx = dxStart; dx <= detailRadius; dx++) {
              const cx = pcx + dx, cz = pcz + dz;
              const top = this.topChunkForColumn(cx, cz);
              let cyStart = (dz === this._streamDZ && dx === this._streamDX && this._streamCY != null) ? this._streamCY : CHUNK_Y_MIN;
              for (let cy = cyStart; cy <= top; cy++) {
                if (budget-- <= 0) {
                  this._streamDZ = dz; this._streamDX = dx; this._streamCY = cy;
                  break outer;
                }
                const key = World.ck(cx, cy, cz);
                if (!this.chunks.has(key)) {
                  const c = new Chunk(this, cx, cy, cz);
                  this.chunks.set(key, c);


                  if (this.canHaveMesh(c)) this.markDirty(c);
                  else c.built = true;

                  this.water.enqueue(cx * CHUNK_SIZE, cx * CHUNK_SIZE + CHUNK_SIZE - 1,
                    cz * CHUNK_SIZE, cz * CHUNK_SIZE + CHUNK_SIZE - 1);
                }
              }
              this._streamCY = null;
              if (budget <= 0) { this._streamDZ = dz; this._streamDX = dx + 1; break outer; }
            }
            this._streamDX = -detailRadius;
            if (dz === detailRadius && budget > 0) { this._streamDZ = null; }
          }
          if (this._streamDZ != null && this._streamDZ > detailRadius) this._streamDZ = null;
        } else if (this._unloadNeeded) {
          if (!this._unloadIter) this._unloadIter = this.chunks.entries();
          let n = 80;
          const unloadR = detailRadius + 2;
          while (n-- > 0) {
            const it = this._unloadIter.next();
            if (it.done) { this._unloadIter = null; this._unloadNeeded = false; break; }
            const [key, c] = it.value;
            const dx = c.cx - pcx, dz = c.cz - pcz;
            if (Math.abs(dx) > unloadR || Math.abs(dz) > unloadR
              || c.cy > this.topChunkForColumn(c.cx, c.cz) || c.cy < CHUNK_Y_MIN) {
              c.dispose();
              this.chunks.delete(key);
            }
          }
        }
      }

      async prewarm(px, py, pz, onProgress = () => {}) {
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        const pcx = Math.floor(px / CHUNK_SIZE);
        const pcz = Math.floor(pz / CHUNK_SIZE);
        const detailRadius = Math.min(viewRadius, DETAIL_CHUNK_RADIUS);


        for (let pass = 0; pass < 2000; pass++) {
          this.update(px, py, pz);
          let want = 0, done = 0;
          for (let dz = -detailRadius; dz <= detailRadius; dz++) {
            for (let dx = -detailRadius; dx <= detailRadius; dx++) {
              if (Math.abs(dx) + Math.abs(dz) > detailRadius + 1) continue;
              const cx = pcx + dx, cz = pcz + dz;
              const top = this.topChunkForColumn(cx, cz);
              for (let cy = CHUNK_Y_MIN; cy <= top; cy++) {
                const c = this.getChunk(cx, cy, cz);
                if (!c) { want++; continue; }
                want++;
                if (c.built) done++;
              }
            }
          }
          onProgress(want ? done / want : 1);
          if (this._streamDZ == null && this.loading.length === 0 && this.dirty.length === 0 && done >= want) break;
          this.processDirty(12);
          await nextFrame();
        }

        for (let i = 0; i < 400 && (this.loading.length || this.dirty.length); i++) {
          this.processDirty(12);
          if ((i & 1) === 0) await nextFrame();
        }
        onProgress(1);
      }

      markDirty(c) {
        if (c.queued) return;
        c.queued = true;
        this.dirty.push(c);
      }








      canHaveMesh(c) {
        if (c.oy <= this.columnMaxHeight(c.cx, c.cz) + 16) return true;

        return this.chunkHasCave(c);
      }


      chunkHasCave(c) {
        for (const s of caveSitesAt(c.ox + 8, c.oz + 8)) {
          if (s.minY - 4 <= c.oy + CHUNK_SIZE && s.maxY + 4 >= c.oy) return true;
        }
        return false;
      }






      dirtyRange(lo, hi, pad) {
        return [Math.floor((lo - 1) / CHUNK_SIZE) - pad, Math.floor((hi + 1) / CHUNK_SIZE) + pad];
      }

      markRegionDirty(x0, x1, y0, y1, z0, z1, pad = 0) {
        const [cx0, cx1] = this.dirtyRange(x0, x1, pad);
        const [cy0, cy1] = this.dirtyRange(y0, y1, pad);
        const [cz0, cz1] = this.dirtyRange(z0, z1, pad);

        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (c) this.markDirty(c);
            }
        this.water.waken(x0, x1, z0, z1);
      }





      markEdited(x0, x1, y0, y1, z0, z1) {
        const [cx0, cx1] = this.dirtyRange(x0, x1, 0);
        const [cy0, cy1] = this.dirtyRange(y0, y1, 0);
        const [cz0, cz1] = this.dirtyRange(z0, z1, 0);

        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (!c) continue;
              c.pending.push([x0, x1, y0, y1, z0, z1]);
              this.markDirty(c);
            }
        this.water.waken(x0, x1, z0, z1);
      }



      noteEdited(x0, x1, y0, y1, z0, z1) {
        const [cx0, cx1] = this.dirtyRange(x0, x1, 0);
        const [cy0, cy1] = this.dirtyRange(y0, y1, 0);
        const [cz0, cz1] = this.dirtyRange(z0, z1, 0);

        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (c) c.pending.push([x0, x1, y0, y1, z0, z1]);
            }
      }



      markColumnDirty(cx, cz) {
        const ccx = Math.floor(cx / CHUNK_SIZE), ccz = Math.floor(cz / CHUNK_SIZE);
        for (let cy = CHUNK_Y_MIN; cy <= this.topChunkForColumn(ccx, ccz); cy++) {
          const c = this.getChunk(ccx, cy, ccz);
          if (c && !c.queued) this.markDirty(c);
        }
      }

      markWaterDirty(x0, x1, z0, z1) {
        const cx0 = Math.floor(x0 / CHUNK_SIZE) - 1, cx1 = Math.floor(x1 / CHUNK_SIZE) + 1;
        const cz0 = Math.floor(z0 / CHUNK_SIZE) - 1, cz1 = Math.floor(z1 / CHUNK_SIZE) + 1;
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cz = cz0; cz <= cz1; cz++)
            for (let cy = CHUNK_Y_MIN; cy <= this.topChunkForColumn(cx, cz); cy++) {
              const c = this.getChunk(cx, cy, cz);
              if (c && !c.wQueued) { c.wQueued = true; this.waterDirty.push(c); }
            }
      }

      updateWater() { this.water.update(); }

      processWaterDirty(budgetMs) {
        const t0 = performance.now();
        while (this.waterDirty.length && performance.now() - t0 < budgetMs) {
          const c = this.waterDirty.pop();
          c.wQueued = false;
          if (!c.dead) c.rebuildWater();
        }
      }


      processDirty(budgetMs) {
        const t0 = performance.now();
        const deadline = t0 + budgetMs;
        const px = this.playerPos.x, py = this.playerPos.y, pz = this.playerPos.z;
        const perf = window.__chunkPerf || (window.__chunkPerf = { loadMs: 0, loadN: 0, rebuildMs: 0, rebuildN: 0, sortMs: 0, calls: 0 });
        perf.calls++;

        const loadSliceSome = (until) => {
          let i = 0;
          while (i < this.loading.length && performance.now() < until) {
            const c = this.loading[i];
            if (c.dead) { this.loading.splice(i, 1); continue; }
            const tl = performance.now();
            const done = c.loadSlice(SAMPLE_SLICE);
            perf.loadMs += performance.now() - tl; perf.loadN++;
            if (done) {
              this.loading.splice(i, 1);
              c.queued = false;
              this.markDirty(c);
            } else i++;
          }
        };


        const loadShare = this.loading.length > 30 ? 0.75 : (this.loading.length > 10 ? 0.6 : 0.5);
        loadSliceSome(t0 + budgetMs * loadShare);
        if (performance.now() >= deadline) return;




        const needSort = this.dirty.length > 1 && (!this._dirtySortedAt || this._dirtySortedAt.x !== Math.floor(px / 16) || this._dirtySortedAt.z !== Math.floor(pz / 16) || (this._dirtySortTick = (this._dirtySortTick || 0) + 1) % 30 === 0);
        if (needSort) {
          const ts = performance.now();
          for (let i = 0; i < this.dirty.length; i++) {
            const c = this.dirty[i];
            const dx = c.ox + 8 - px, dy = c.oy + 8 - py, dz = c.oz + 8 - pz;
            c._sortD2 = dx * dx + dy * dy + dz * dz;
          }

          this.dirty.sort((a, b) => b._sortD2 - a._sortD2);
          perf.sortMs += performance.now() - ts;
          this._dirtySortedAt = { x: Math.floor(px / 16), z: Math.floor(pz / 16) };
        }

        let rebuilt = 0;
        while (this.dirty.length > 0 && performance.now() < deadline) {
          const elapsed = performance.now() - t0;
          const c = this.dirty[this.dirty.length - 1];
          if (c.dead) { this.dirty.pop(); c.queued = false; continue; }


          if (!c.samplesLoaded) {
            this.dirty.pop();
            c.queued = true;
            this.loading.push(c);
            continue;
          }
          const est = this._avgRebuildMs || 4;
          if (elapsed + est > budgetMs + 1 && rebuilt >= 1) break;
          this.dirty.pop();
          c.queued = false;
          const tr = performance.now();
          c.rebuild();
          const dur = performance.now() - tr;
          perf.rebuildMs += dur; perf.rebuildN++;
          this._avgRebuildMs = this._avgRebuildMs ? this._avgRebuildMs * 0.7 + dur * 0.3 : dur;
          if (++rebuilt >= 3) break;
        }


        if (performance.now() < deadline) loadSliceSome(deadline);
      }


      mine(x, y, z, r) {
        const box = this.field.mineSphere(x, y, z, r);
        this.markEdited(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1);
      }

      place(x, y, z, r) {
        const box = this.field.addSphere(x, y, z, r);
        this.markEdited(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1);
      }









      surfaceAt(x, z) {
        return this.water.surfaceOf(Math.floor(x), Math.floor(z));
      }

      waterAt(x, y, z) {
        const cx = Math.floor(x), cz = Math.floor(z);
        const s = this.water.surfaceOf(cx, cz);
        if (s === -Infinity || y >= s) return 0;
        if (y < this.water.floorAt(cx, cz)) return 0;
        if (this.field.sample(x, y, z) > 0) return 0;
        return s - y;
      }

      isUnderwater(x, y, z) {
        return this.waterAt(x, y, z) > 0;
      }

      useWater(x, y, z, amount = 0.6, radius = 2) {
        if (this.waterAt(x, y, z) <= 0) return 0;
        const ix = Math.floor(x), iz = Math.floor(z);
        let removed = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const d = Math.hypot(dx, dz);
            if (d > radius) continue;
            const k = World.wk(ix + dx, iz + dz);
            const dep = this.water.depth.get(k);
            if (!dep) continue;
            const take = Math.min(dep, amount * (1 - d / radius));
            const nd = dep - take;
            if (nd > 0.004) this.water.depth.set(k, nd); else this.water.depth.delete(k);
            removed += take;
            this.water.active.add(k);
            this.water.active.add(World.wk(ix + dx + 1, iz + dz));
            this.water.active.add(World.wk(ix + dx - 1, iz + dz));
            this.water.active.add(World.wk(ix + dx, iz + dz + 1));
            this.water.active.add(World.wk(ix + dx, iz + dz - 1));
          }
        }
        if (removed > 0) this.markWaterDirty(ix - radius, ix + radius, iz - radius, iz + radius);
        return removed;
      }



      addWater(x, z, amount, radius = 1.5) {
        if (!(amount > 0)) return 0;
        const ix = Math.floor(x), iz = Math.floor(z);
        const cells = [];
        let totalW = 0;
        const r = Math.ceil(radius);
        for (let dx = -r; dx <= r; dx++)
          for (let dz = -r; dz <= r; dz++) {
            const d = Math.hypot(dx, dz);
            if (d > radius) continue;
            const w = 1 - d / radius;
            cells.push([ix + dx, iz + dz, w]);
            totalW += w;
          }
        if (!totalW) return 0;
        for (const [cx, cz, w] of cells) {
          const k = World.wk(cx, cz);
          this.water.open.add(k);
          this.water.seeded.add(k);
          this.water.depth.set(k, (this.water.depth.get(k) || 0) + amount * w / totalW);
          this.water.active.add(k);
          this.markColumnDirty(cx, cz);
        }
        this.markWaterDirty(ix - r - 1, ix + r + 1, iz - r - 1, iz + r + 1);
        return amount;
      }





      mineAnimated(px, py, pz, r, str, yieldFn) {
        const x0 = Math.floor(px - r - 1), x1 = Math.ceil(px + r + 1);
        const y0 = Math.floor(py - r - 1), y1 = Math.ceil(py + r + 1);
        const z0 = Math.floor(pz - r - 1), z1 = Math.ceil(pz + r + 1);
        this.jobs.push({
          sign: -1, str, base: this.field.snapshotBox(x0, x1, y0, y1, z0, z1),
          c0: { x: px, y: py, z: pz }, c1: { x: px, y: py, z: pz },
          r, t: 0, dur: 0.35, box: { x0, x1, y0, y1, z0, z1 }, yieldFn,
        });
        if (this.jobs.length > 8) this.jobs.shift();
      }

      placeAnimated(p, r, dir) {
        const c1 = { x: p.x, y: p.y, z: p.z };
        const c0 = { x: p.x + dir.x * 1.6, y: p.y + dir.y * 1.6, z: p.z + dir.z * 1.6 };
        const x0 = Math.floor(Math.min(c0.x, c1.x) - r - 1), x1 = Math.ceil(Math.max(c0.x, c1.x) + r + 1);
        const y0 = Math.floor(Math.min(c0.y, c1.y) - r - 1), y1 = Math.ceil(Math.max(c0.y, c1.y) + r + 1);
        const z0 = Math.floor(Math.min(c0.z, c1.z) - r - 1), z1 = Math.ceil(Math.max(c0.z, c1.z) + r + 1);
        this.jobs.push({
          sign: 1, base: this.field.snapshotBox(x0, x1, y0, y1, z0, z1),
          c0, c1, r, t: 0, dur: 0.28, box: { x0, x1, y0, y1, z0, z1 },
        });
        if (this.jobs.length > 8) this.jobs.shift();
      }

      updateJobs(dt) {
        if (!this.jobs.length) return;
        const f = this.field;
        let ux0 = Infinity, ux1 = -Infinity, uy0 = Infinity, uy1 = -Infinity, uz0 = Infinity, uz1 = -Infinity;
        for (let i = this.jobs.length - 1; i >= 0; i--) {
          const j = this.jobs[i];
          j.t += dt / j.dur;
          const t = Math.min(1, j.t);
          const e = t * t * (3 - 2 * t);
          const cx = j.c0.x + (j.c1.x - j.c0.x) * e;
          const cy = j.c0.y + (j.c1.y - j.c0.y) * e;
          const cz = j.c0.z + (j.c1.z - j.c0.z) * e;
          const r2 = j.r * j.r, mag = j.sign * (j.str || 1) * j.r * 1.8 * e;
          const b = j.box;
          for (let x = b.x0; x <= b.x1; x++) {
            const ddx = x - cx;
            for (let y = b.y0; y <= b.y1; y++) {
              const ddy = y - cy;
              for (let z = b.z0; z <= b.z1; z++) {
                const ddz = z - cz;
                const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
                if (d2 > r2) continue;
                const bv = j.base.get(DensityField.key(x, y, z));
                if (bv === undefined) continue;
                f.set(x, y, z, bv + mag * (1 - Math.sqrt(d2) / j.r));
              }
            }
          }
          if (b.x0 < ux0) ux0 = b.x0; if (b.x1 > ux1) ux1 = b.x1;
          if (b.y0 < uy0) uy0 = b.y0; if (b.y1 > uy1) uy1 = b.y1;
          if (b.z0 < uz0) uz0 = b.z0; if (b.z1 > uz1) uz1 = b.z1;


          this.noteEdited(b.x0, b.x1, b.y0, b.y1, b.z0, b.z1);
          if (t >= 1) {
            if (j.yieldFn) j.yieldFn();
            this.jobs.splice(i, 1);
          }
        }

        this.water.waken(ux0, ux1, uz0, uz1);




        this.jobTick = (this.jobTick + 1) & 1;
        if (this.jobTick) return;
        const cx0 = Math.floor((ux0 - 1) / CHUNK_SIZE), cx1 = Math.floor((ux1 + 1) / CHUNK_SIZE);
        const cy0 = Math.floor((uy0 - 1) / CHUNK_SIZE), cy1 = Math.floor((uy1 + 1) / CHUNK_SIZE);
        const cz0 = Math.floor((uz0 - 1) / CHUNK_SIZE), cz1 = Math.floor((uz1 + 1) / CHUNK_SIZE);
        // Animated edits go through the budgeted queue like every other edit; rebuilding
        // the whole mining box here used to stall a frame by tens of milliseconds.
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (c) this.markDirty(c);
            }
      }







      isSolid(x, y, z) {
        return this.field.sample(x, y, z) > 0;
      }








      isWalkable(x, y, z, radius = 0.35, height = 1.7, maxSlope = 1.4) {
        const ground = this.field.sample(x, y - 0.05, z);
        if (ground <= 0) return false;


        for (let h = 0.3; h <= height; h += 0.5) {
          if (this.field.sample(x, y + h, z) > 0) return false;
          if (this.field.sample(x + radius, y + h, z) > 0) return false;
          if (this.field.sample(x - radius, y + h, z) > 0) return false;
          if (this.field.sample(x, y + h, z + radius) > 0) return false;
          if (this.field.sample(x, y + h, z - radius) > 0) return false;
        }


        const e = 0.6;
        const gx = this.field.sample(x + e, y, z) - this.field.sample(x - e, y, z);
        const gz = this.field.sample(x, y, z + e) - this.field.sample(x, y, z - e);
        const slope = Math.hypot(gx, gz) / (2 * e);
        return slope < maxSlope;
      }


      getSurfaceHeight(x, z, fromY = 60) {
        const ix = Math.round(x), iz = Math.round(z);
        for (let y = fromY; y > -8; y--) {
          if (this.field.get(ix, y, iz) > 0) return y + 1;
        }
        return -8;
      }



      surfaceY(x, z, fromY = 120) {
        const step = 0.5;
        let prev = this.field.sample(x, fromY, z);
        for (let y = fromY - step; y > -8; y -= step) {
          const cur = this.field.sample(x, y, z);
          if (prev <= 0 && cur > 0) {
            const f = prev / (prev - cur);
            return (y + step) - step * f;
          }
          prev = cur;
        }
        return fromY;
      }


      getSurfaceNormal(x, y, z) {
        const e = 0.7;
        const nx = this.field.sample(x - e, y, z) - this.field.sample(x + e, y, z);
        const ny = this.field.sample(x, y - e, z) - this.field.sample(x, y + e, z);
        const nz = this.field.sample(x, y, z - e) - this.field.sample(x, y, z + e);
        const len = Math.hypot(nx, ny, nz) || 1;
        return new THREE.Vector3(nx / len, ny / len, nz / len);
      }


      static neighbours(x, y, z) {
        return [
          [x + 1, y, z], [x - 1, y, z],
          [x, y, z + 1], [x, y, z - 1],
          [x, y + 1, z], [x, y - 1, z],
        ];
      }


      buildSave(player) {
        const key = SAVE_KEY;
        try {
          const arr = [];
          for (const [k, v] of this.field.edits) arr.push(k, Math.round(v * 1000) / 1000);
          const data = {
            seed: WORLD_SEED,
            terrain: WORLD_TERRAIN,
            edits: arr,
            player: [player.pos.x, player.pos.y, player.pos.z, player.yaw, player.pitch],
            inv: { hot: inv.hot, main: inv.main, sel: inv.sel, dose: Math.round(inv.dose * 10) / 10, armor: inv.armor },
            vitals: { hp: vitals.hp, hunger: vitals.hunger, wounds: vitals.wounds, immunity: vitals.infectionImmunity, foodNumb: vitals.foodNumb },
            day: clock.day, dayT: +clock.t.toFixed(1),
            playTime: +playTime.toFixed(1),
            guide: GUIDE_STEPS[guideIndex]?.id ?? null,
            achievements: ach,
            timeLock: timeLock !== null,
            prayReadyAt: +prayReadyAt.toFixed(1),
            nuclearStrikes: nuclearStrikes.map((s) => ({ x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), day: s.day | 0, r: +s.r.toFixed(2), radMult: +(s.radMult ?? 1).toFixed(4) })),
            lastNukeCheckDay: lastNukeCheckDay | 0,
            nukeRadMult: +nukeRadMult.toFixed(4),
            machines: machineSystem ? machineSystem.serialize() : [],
            pipes: pipeSystem ? pipeSystem.serialize() : [],
            skyline: skylineSystem ? skylineSystem.serialize() : [],
            buildings: buildingSystem ? buildingSystem.serialize() : [],
            map: mapSystem ? mapSystem.serialize() : null,
            openedBarrels: [...openedBarrels],
            torches: torches.map(t => [
              Math.round(t.pos.x * 100) / 100, Math.round(t.pos.y * 100) / 100, Math.round(t.pos.z * 100) / 100,
              Math.round((t.pos.x - t.ax) * 100) / 100, Math.round((t.pos.y - t.ay) * 100) / 100, Math.round((t.pos.z - t.az) * 100) / 100,
              t.id,
            ]),
          };
          const json = JSON.stringify(data);
          return { key, data, json };
        } catch (e) {
          console.error(`[save] build failed key=${SAVE_KEY}`, e);
          return { key, data: null, json: null, error: e };
        }
      }

      async save(player) {



        if (typeof replayPlay !== 'undefined' && replayPlay) return false;
        const payload = this.buildSave(player);
        this.lastSavePayload = payload;
        this.lastSaveError = payload?.error || null;
        const { key, data, json } = payload;
        if (!json) {
          try { notice('SAVE FAILED'); } catch { }
          return false;
        }
        try {
          await idbSet(key, json);
          this.lastSaveError = null;
          console.info(`[save] ok key=${key} bytes=${json.length} edits=${(data.edits.length / 2)} machines=${data.machines.length} buildings=${data.buildings.length} play=${data.playTime}s`);
          return true;
        } catch (e) {
          this.lastSaveError = e;
          const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '') || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
          const msg = quota
            ? 'save failed: storage full'
            : `save failed: ${e && e.message ? e.message : e}`;
          console.error(`[save] ${msg}`, { key, e });
          try { notice(quota ? 'SAVE FAILED · STORAGE FULL' : 'SAVE FAILED'); } catch { }
          return false;
        }
      }

      async readSave() {
        return readSaveData(SAVE_KEY);
      }

      applySave(data) {
        if (!data) return null;
        for (let i = 0; i < data.edits.length; i += 2) {
          this.field.edits.set(data.edits[i], data.edits[i + 1]);
        }
        if (data.inv) {
          const clean = (arr, len) => {
            const out = Array(len).fill(null);
            if (Array.isArray(arr)) for (let i = 0; i < Math.min(len, arr.length); i++) {
              const s = arr[i];
              if (s && ITEMS[s.id] && Number.isFinite(s.n)) {
                const stack = { id: s.id, n: Math.max(1, Math.min(ITEMS[s.id].stack, s.n | 0)) };
                if (Array.isArray(s.plates)) stack.plates = s.plates.filter((p) => ITEMS[p]?.plate);
                if (ITEMS[s.id]?.container && s.liquid) {
                  stack.liquid = { id: s.liquid.id, amount: +s.liquid.amount || 0 };
                  Liquid.sanitize(stack, ITEMS[s.id]);
                }
                out[i] = stack;
              }
            }
            return out;
          };
          inv.hot = clean(data.inv.hot, 7);
          inv.main = clean(data.inv.main, 28);
          if (Number.isInteger(data.inv.sel)) inv.sel = Math.max(0, Math.min(6, data.inv.sel));
          if (Number.isFinite(data.inv.dose)) inv.dose = Math.max(0, data.inv.dose);
          if (data.inv.armor) {
            for (const slot of ['head', 'chest', 'legs', 'feet', 'hands']) {
              const s = data.inv.armor[slot];
              if (s && ITEMS[s.id]?.armor) {
                inv.armor[slot] = { id: s.id, n: 1 };
                if (Array.isArray(s.plates)) inv.armor[slot].plates = s.plates.filter((p) => ITEMS[p]?.plate);
              }
            }
          }
        }
        if (data.vitals) {
          if (Number.isFinite(data.vitals.hp)) vitals.hp = Math.max(0, Math.min(100, data.vitals.hp));
          if (Number.isFinite(data.vitals.hunger)) vitals.hunger = Math.max(0, Math.min(100, data.vitals.hunger));
          if (Number.isFinite(data.vitals.immunity)) vitals.infectionImmunity = Math.max(0, data.vitals.immunity);
          if (data.vitals.foodNumb && typeof data.vitals.foodNumb === 'object') {
            for (const [id, n] of Object.entries(data.vitals.foodNumb)) {
              if (ITEMS[id]?.consumable?.food && Number.isFinite(n)) vitals.foodNumb[id] = Math.max(-2, Math.min(2, n));
            }
          }
          for (const t of Object.keys(WOUNDS)) {
            if (data.vitals.wounds && Number.isFinite(data.vitals.wounds[t])) vitals.wounds[t] = Math.max(0, data.vitals.wounds[t]);
          }
        }
        if (Number.isInteger(data.day) && data.day > 0) clock.day = data.day;
        if (Number.isFinite(data.dayT)) clock.t = Math.max(0, Math.min(TUNING.DAY_SECONDS - 1, data.dayT));
        if (data.timeLock === true) {
          timeLock = TUNING.DAY_SECONDS * ((TUNING.DAY_FRACTION ?? 0.5) / 2);
          clock.t = timeLock;
        }
        if (Number.isFinite(data.prayReadyAt)) prayReadyAt = Math.max(0, data.prayReadyAt);
        if (Array.isArray(data.nuclearStrikes)) {
          nuclearStrikes = data.nuclearStrikes.filter((s) => s && [s.x, s.y, s.z, s.r].every(Number.isFinite))
            .map((s) => ({ x: s.x, y: s.y, z: s.z, day: s.day | 0, r: Math.max(8, s.r), radMult: Number.isFinite(s.radMult) ? Math.max(1, s.radMult) : 1 }));
        }
        if (Number.isFinite(data.lastNukeCheckDay)) lastNukeCheckDay = Math.max(0, data.lastNukeCheckDay | 0);
        if (Number.isFinite(data.nukeRadMult)) nukeRadMult = Math.max(1, data.nukeRadMult);
        if (Array.isArray(data.openedBarrels)) {
          for (const k of data.openedBarrels) if (typeof k === 'string') openedBarrels.add(k);
        }
        if (Array.isArray(data.torches)) {
          for (const t of data.torches) {
            if (Array.isArray(t) && t.length >= 6 && t.slice(0, 6).every(Number.isFinite)) {
              const id = t[6] || 'torch';
              const dx = t[3], dy = t[4], dz = t[5];
              const len = Math.hypot(dx, dy, dz) || 1;
              const nx = dx / len, ny = dy / len, nz = dz / len;


              const floor = ITEMS[id]?.light?.mount === 'floor';
              const depth = floor ? 0.09 : 0.38;
              addTorch(t[0], t[1], t[2], nx, ny, nz, id, t[0] - nx * depth, t[1] - ny * depth, t[2] - nz * depth);
            }
          }
        }
        return data;
      }

      async load() {
        const data = await this.readSave();
        if (!data) return null;
        return this.applySave(data);
      }
    }
















    const FAR_RING_BLEND = 48;





    function farRingEdge(coord, centre) {
      return coord >= centre ? (DETAIL_CHUNK_RADIUS + 1) * CHUNK_SIZE : DETAIL_CHUNK_RADIUS * CHUNK_SIZE;
    }
    function farRingBeyond(wx, wz, centerX, centerZ) {
      return Math.max(Math.abs(wx - centerX) - farRingEdge(wx, centerX),
        Math.abs(wz - centerZ) - farRingEdge(wz, centerZ));
    }
    function farRingBlendWeight(beyond) {
      const t = Math.max(0, Math.min(1, beyond / FAR_RING_BLEND));
      return t * t * (3 - 2 * t);
    }

    function farRidge(sx, sz) {
      const belt = fbm3(sx * 0.00008, 91.3, sz * 0.00008, 2) * 2 - 1;
      const warp = fbm3(sx * 0.00013, 12.7, sz * 0.00013, 2) * 2 - 1;
      const ridge = 1 - Math.abs(fbm3((sx + warp * 900) * 0.00011, 55.1, (sz + warp * 900) * 0.00011, 2) * 2 - 1);
      return Math.max(0, belt - 0.12) * (0.4 + 0.6 * ridge * ridge);
    }

    class FarTerrainRenderer {
      constructor(scene, biomeTextures, stoneTexture, world) {
        this.scene = scene;
        this.world = world;
        this.outer = 0;
        this.shader = null;
        this.material = new THREE.MeshLambertMaterial({
          side: THREE.DoubleSide,
          flatShading: false,
          fog: false,
        });
        this.material.onBeforeCompile = (shader) => {
          this.shader = shader;
          shader.uniforms.farGrassMap = { value: biomeTextures.grass };
          shader.uniforms.farSandMap = { value: biomeTextures.sand };
          shader.uniforms.farDryMap = { value: biomeTextures.dry };
          shader.uniforms.farSnowMap = { value: biomeTextures.snow };
          shader.uniforms.farAshMap = { value: biomeTextures.ash };
          shader.uniforms.farStoneMap = { value: stoneTexture };
          shader.uniforms.farDirtMap = { value: world.dirtTexture };
          shader.uniforms.farBasaltMap = { value: world.basaltTexture };
          shader.uniforms.uHazeColor = { value: new THREE.Color(0x9ec9e8) };
          shader.uniforms.uHazeStart = { value: DETAIL_CHUNK_RADIUS * CHUNK_SIZE };
          shader.uniforms.uHazeEnd = { value: 1 };
          shader.uniforms.uHazeReach = { value: FAR_HAZE_REACH };
          shader.uniforms.uFarStoneY = { value: WORLD_TERRAIN === 'realistic' ? 1e6 : 50 };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec4 aFarSurf; attribute vec3 aFarCol; attribute vec3 aFarData; attribute float aFarY; attribute float aFarBasalt; varying vec4 vFarSurf; varying vec3 vFarCol; varying vec3 vFarData; varying float vFarY; varying float vFarBasalt; varying vec3 vFarPos; varying vec3 vFarNormal; varying float vFarDepth;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFarPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFarNormal = normalize(mat3(modelMatrix) * objectNormal);');
          shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\nvFarSurf = aFarSurf;\nvFarCol = aFarCol;\nvFarData = aFarData;\nvFarY = aFarY;\nvFarBasalt = aFarBasalt;\nvFarDepth = -mvPosition.z;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
            uniform sampler2D farGrassMap; uniform sampler2D farSandMap; uniform sampler2D farDryMap;
            uniform sampler2D farSnowMap; uniform sampler2D farAshMap; uniform sampler2D farStoneMap;
            uniform sampler2D farDirtMap; uniform sampler2D farBasaltMap;
            uniform vec3 uHazeColor; uniform float uHazeStart; uniform float uHazeEnd;
            uniform float uHazeReach;
            uniform float uFarStoneY;
            varying vec3 vFarCol; varying vec3 vFarData; varying float vFarY; varying float vFarBasalt;
            varying vec4 vFarSurf; varying vec3 vFarPos; varying vec3 vFarNormal; varying float vFarDepth;
            vec3 farTri(sampler2D m, vec3 p, vec3 n, float s) {
              vec3 w = pow(abs(n), vec3(4.0)); w /= w.x + w.y + w.z;
              return texture2D(m, p.zy * s).rgb * w.x + texture2D(m, p.xz * s).rgb * w.y + texture2D(m, p.xy * s).rgb * w.z;
            }
            vec3 farRotY(vec3 p, float a) {
              float c = cos(a), s = sin(a);
              return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
            }`)




            .replace('#include <map_fragment>', `#include <map_fragment>
            vec3 farN = normalize(vFarNormal);
            vec3 farStone = farTri(farStoneMap, vFarPos, farN, 0.08);
            vec3 farBase = mix(vFarCol, farStone, vFarData.x);
            farBase = mix(farBase, farTri(farBasaltMap, vFarPos, farN, 0.08), vFarBasalt);
            farBase = mix(farBase, farTri(farDirtMap, vFarPos, farN, 0.1), vFarData.y);
            vec3 farTop = farTri(farGrassMap, vFarPos, farN, 0.4);
            farTop = mix(farTop, farTri(farSandMap, vFarPos, farN, 0.30), vFarSurf.x);
            farTop = mix(farTop, farTri(farDryMap,  vFarPos, farN, 0.40), vFarSurf.y);
            farTop = mix(farTop, farTri(farSnowMap, vFarPos, farN, 0.22), vFarSurf.z);
            vec3 farAsh = (farTri(farAshMap, farRotY(vFarPos, 0.0),    farN, 0.35)
                         + farTri(farAshMap, farRotY(vFarPos, 2.0944), farN, 0.35)
                         + farTri(farAshMap, farRotY(vFarPos, 4.1888), farN, 0.35)) * (1.0 / 3.0);
            farTop = mix(farTop, farAsh, vFarSurf.w);
            farBase = mix(farBase, farTop, vFarData.z);
            farBase = mix(farBase, farStone, step(uFarStoneY, vFarY));
            diffuseColor.rgb = farBase;`)


            .replace('#include <fog_fragment>', `
            float hazeD = vFarDepth;
            float hazeU = clamp((hazeD - uHazeStart) / max(1.0, uHazeEnd - uHazeStart), 0.0, 1.0);
            float hazeF = 1.0 - exp(-uHazeReach * hazeU * hazeU * hazeU * hazeU);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, hazeF);`);
        };
        this.meshes = [];
        this.treeMeshes = [];
        this.treeGeo = this._makeTreeGeo();
        this.treeMat = this._makeTreeMat();
        this.treeShader = null;
        this.centerKey = '';
        this.token = 0;
      }

      _makeTreeGeo() {
        const w = 0.55, h = 1;
        const pos = new Float32Array([
          -w, 0, 0,  w, 0, 0,  w, h, 0,  -w, h, 0,
           0, 0,-w,  0, 0, w,  0, h, w,   0, h,-w,
        ]);
        const uv = new Float32Array([
          0,0, 1,0, 1,1, 0,1,
          0,0, 1,0, 1,1, 0,1,
        ]);
        const idx = [0,1,2, 0,2,3, 4,5,6, 4,6,7];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      }

      _makeTreeMat() {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 32;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 16, 32);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(8, 11, 7, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8d8d8';
        ctx.beginPath(); ctx.ellipse(8, 9, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b0b0b0';
        ctx.fillRect(6, 18, 4, 14);
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, fog: false, vertexColors: true });
        mat.onBeforeCompile = (shader) => {
          this.treeShader = shader;
          shader.uniforms.uHazeColor = { value: new THREE.Color(0x9ec9e8) };
          shader.uniforms.uHazeStart = { value: DETAIL_CHUNK_RADIUS * CHUNK_SIZE };
          shader.uniforms.uHazeEnd = { value: 1 };
          shader.uniforms.uHazeReach = { value: FAR_HAZE_REACH };
          shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\nvFarDepth = -mvPosition.z;');
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vFarDepth;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHazeColor; uniform float uHazeStart; uniform float uHazeEnd; uniform float uHazeReach;\nvarying float vFarDepth;');
          shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
            float hazeD = vFarDepth;
            float hazeU = clamp((hazeD - uHazeStart) / max(1.0, uHazeEnd - uHazeStart), 0.0, 1.0);
            float hazeF = 1.0 - exp(-uHazeReach * hazeU * hazeU * hazeU * hazeU);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, hazeF);`);
        };
        return mat;
      }

      _vegModelColor(sp) {
        if (sp._farCol) return sp._farCol;
        let r = 0, g = 0, b = 0, n = 0;
        if (sp.parts) {
          for (const part of sp.parts) {
            const m = part.mat || (part.mesh && part.mesh.material);
            if (!m) continue;
            let cr = m.color ? m.color.r : 1, cg = m.color ? m.color.g : 1, cb = m.color ? m.color.b : 1;
            const img = m.map && m.map.image;
            if (img && (img.width || img.naturalWidth)) {
              try {
                const cw = 8, ch = 8;
                const cv = document.createElement('canvas');
                cv.width = cw; cv.height = ch;
                const cx = cv.getContext('2d');
                cx.drawImage(img, 0, 0, cw, ch);
                const d = cx.getImageData(0, 0, cw, ch).data;
                let tr = 0, tg = 0, tb = 0, tn = 0;
                for (let i = 0; i < d.length; i += 4) {
                  if (d[i + 3] < 40) continue;
                  tr += d[i]; tg += d[i + 1]; tb += d[i + 2]; tn++;
                }
                if (tn) { cr *= tr / (tn * 255); cg *= tg / (tn * 255); cb *= tb / (tn * 255); }
              } catch (e) {}
            }
            r += cr; g += cg; b += cb; n++;
          }
        }
        if (!n) sp._farCol = (/dead|waste/i.test(sp.n)) ? new THREE.Color(0.38, 0.33, 0.27) : new THREE.Color(0.24, 0.42, 0.18);
        else {
          const c = new THREE.Color(r / n, g / n, b / n);
          const m = Math.max(c.r, c.g, c.b);
          if (m > 0 && m < 0.22) c.multiplyScalar(0.22 / m);
          sp._farCol = c;
        }
        return sp._farCol;
      }

      _farCanopyResolve(pl) {
        const sp = pl.sp;
        if (industrialInside(pl.x, pl.z)) return null;
        const wsurf = this.world.surfaceAt(pl.x, pl.z);
        const wet = wsurf !== -Infinity;
        if (wet) return null;
        const fromY = Math.ceil(terrainTrend(pl.x + WORLD_SEED, pl.z + WORLD_SEED)) + 12;
        const y = this.world.surfaceY(pl.x, pl.z, fromY);
        if (y <= -8) return null;
        if (mountainRockAt(pl.x, pl.z)) return null;
        if (WORLD_TERRAIN === 'realistic' && y > 112) return null;
        if (caveCarveAt(pl.x + WORLD_SEED, y + 0.4, pl.z + WORLD_SEED) > 0.02) return null;
        if (groundDepth(pl.x, y, pl.z) >= 1.2) return null;
        const n = this.world.getSurfaceNormal(pl.x, y, pl.z);
        if (n.y < sp.slope) return null;
        const root = (sp.trunk && sp.align === 'upright') ? 0.7 : 0;
        pl.y = y - (sp.sink + root) + 0.02;
        return pl;
      }

      disposeMeshes(meshes = this.meshes, trees = this.treeMeshes) {
        for (const mesh of meshes) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
        }
        for (const mesh of trees) {
          this.scene.remove(mesh);
          if (mesh.instanceMatrix) mesh.instanceMatrix = null;
          if (mesh.instanceColor) mesh.instanceColor = null;
        }
      }

      ringSteps(radius) {
        const steps = [];
        let step = CHUNK_SIZE;
        while (step * 32 < radius && steps.length < 7) {
          steps.push(step);
          step *= 4;
        }
        if (!steps.length && radius > DETAIL_CHUNK_RADIUS * CHUNK_SIZE) steps.push(CHUNK_SIZE);
        if (steps.length && steps[steps.length - 1] * 32 < radius) steps.push(steps[steps.length - 1] * 4);
        return steps;
      }

      async rebuild(px, pz, progress = () => {}) {
        const radius = viewRadius * CHUNK_SIZE;
        const steps = radius > DETAIL_CHUNK_RADIUS * CHUNK_SIZE ? this.ringSteps(radius) : [];
        const centerX = Math.floor(px / CHUNK_SIZE) * CHUNK_SIZE;
        const centerZ = Math.floor(pz / CHUNK_SIZE) * CHUNK_SIZE;
        const key = `${centerX},${centerZ},${steps.join(':')}`;
        if (key === this.centerKey) { progress(1); return; }
        this.centerKey = key;
        const token = ++this.token;
        const nextMeshes = [];
        const nextTreeMeshes = [];

        if (!steps.length) {
          this.disposeMeshes(this.meshes, this.treeMeshes);
          this.meshes = [];
          this.treeMeshes = [];
          progress(1);
          return;
        }

        const side = radius > 4096 ? 32 : 48;
        const row = side + 1;
        const vertexCount = row * row;
        const totalSamples = steps.length * vertexCount;
        let sampled = 0;
        let batch = 0;
        let tBuild = performance.now();
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

        for (let level = 0; level < steps.length; level++) {
          const step = steps[level];


          const innerCells = level === 0 ? Math.ceil(((DETAIL_CHUNK_RADIUS + 1) * CHUNK_SIZE) / step) : side / 8;
          const positions = new Float32Array(vertexCount * 3);
          const uvs = new Float32Array(vertexCount * 2);
          const farSurf = new Float32Array(vertexCount * 4);
          const farCol = new Float32Array(vertexCount * 3);
          const farData = new Float32Array(vertexCount * 3);
          const farBasalt = new Float32Array(vertexCount);
          const farHeight = new Float32Array(vertexCount);
          const indices = [];

          for (let z = 0; z <= side; z++) {
            for (let x = 0; x <= side; x++) {
              const i = z * row + x;
              const lx = (x - side / 2) * step;
              const lz = (z - side / 2) * step;
              positions[i * 3] = lx;
              positions[i * 3 + 2] = lz;
              uvs[i * 2] = (centerX + lx) * 0.4;
              uvs[i * 2 + 1] = (centerZ + lz) * 0.4;

              if (Math.abs(x - side / 2) >= innerCells || Math.abs(z - side / 2) >= innerCells) {
                const wx = centerX + lx, wz = centerZ + lz;
                const baseY = terrainTrend(wx + WORLD_SEED, wz + WORLD_SEED);





                const colY = columnDensity(wx + WORLD_SEED, wz + WORLD_SEED).h;


                const surfY = WORLD_TERRAIN === 'realistic'
                  ? groundYAt(wx + WORLD_SEED, wz + WORLD_SEED)
                  : colY;
                const col = surfaceColor(wx, surfY, wz);
                farCol[i * 3] = col[0]; farCol[i * 3 + 1] = col[1]; farCol[i * 3 + 2] = col[2];
                farData[i * 3] = stoneMask; farData[i * 3 + 1] = dirtMask; farData[i * 3 + 2] = grassMask;
                farBasalt[i] = basaltMask;
                farSurf[i * 4] = _surf[0]; farSurf[i * 4 + 1] = _surf[1];
                farSurf[i * 4 + 2] = _surf[2]; farSurf[i * 4 + 3] = _surf[3];
                farHeight[i] = colY;
                const pad = level === 0 ? industrialPadAt(wx, wz) : null;
                const terrainY = pad ? baseY + (pad.site.y0 - baseY) * pad.w : baseY;



                const dist = Math.hypot(wx - px, wz - pz);
                let fade = (dist - FAR_RANGE_START) / (FAR_RANGE_FULL - FAR_RANGE_START);
                fade = fade < 0 ? 0 : fade > 1 ? 1 : fade;
                const backdrop = FAR_RANGE_AMP * (dist / FAR_RANGE_REF) * fade * fade * (3 - 2 * fade)
                  * farRidge(wx + WORLD_SEED, wz + WORLD_SEED);
                const farY = (pad ? terrainY : colY) + backdrop;







                const beyond = farRingBeyond(wx, wz, centerX, centerZ);
                let y = farY;
                if (level === 0 && beyond <= FAR_RING_BLEND) {
                  const realY = this.world.getSurfaceHeight(wx, wz, Math.ceil(Math.max(terrainY, colY) + 24)) - 0.75;
                  y = realY + (farY - realY) * farRingBlendWeight(beyond);
                }
                positions[i * 3 + 1] = y;
              }
              sampled++;
              if (++batch >= 32) {
                const _tb = (batch & 31) === 0;
                if (batch >= 256 || (_tb && performance.now() - tBuild > 6)) {
                  batch = 0;
                  progress(sampled / totalSamples);
                  await nextFrame();
                  tBuild = performance.now();
                  if (token !== this.token) {
                    this.disposeMeshes(nextMeshes, nextTreeMeshes);
                    return;
                  }
                }
              }
            }
          }

          for (let z = 0; z < side; z++) {
            for (let x = 0; x < side; x++) {
              const inHole = x >= side / 2 - innerCells && x < side / 2 + innerCells
                && z >= side / 2 - innerCells && z < side / 2 + innerCells;
              if (inHole) continue;
              const a = z * row + x;
              const b = a + 1;
              const c = a + row;
              const d = c + 1;
              indices.push(a, c, b, b, c, d);
            }
          }

          const perimeter = (min, max) => {
            const out = [];
            for (let x = min; x < max; x++) out.push(min * row + x);
            for (let z = min; z < max; z++) out.push(z * row + max);
            for (let x = max; x > min; x--) out.push(max * row + x);
            for (let z = max; z > min; z--) out.push(z * row + min);
            return out;
          };
          const boundaries = [perimeter(0, side)];
          if (level > 0) boundaries.push(perimeter(side / 2 - innerCells, side / 2 + innerCells));
          let skirtCount = 0;
          for (const edge of boundaries) skirtCount += edge.length;
          const meshPositions = new Float32Array((vertexCount + skirtCount) * 3);
          meshPositions.set(positions);
          const meshUvs = new Float32Array((vertexCount + skirtCount) * 2);
          meshUvs.set(uvs);
          const meshFarSurf = new Float32Array((vertexCount + skirtCount) * 4);
          meshFarSurf.set(farSurf);
          const meshFarCol = new Float32Array((vertexCount + skirtCount) * 3);
          meshFarCol.set(farCol);
          const meshFarData = new Float32Array((vertexCount + skirtCount) * 3);
          meshFarData.set(farData);
          const meshFarBasalt = new Float32Array(vertexCount + skirtCount);
          meshFarBasalt.set(farBasalt);
          const meshFarHeight = new Float32Array(vertexCount + skirtCount);
          meshFarHeight.set(farHeight);
          let skirtIndex = vertexCount;
          for (const edge of boundaries) {
            const lower = [];
            for (const top of edge) {
              const bottom = skirtIndex++;
              meshPositions[bottom * 3] = positions[top * 3];
              meshPositions[bottom * 3 + 1] = positions[top * 3 + 1] - 64;
              meshPositions[bottom * 3 + 2] = positions[top * 3 + 2];
              meshUvs[bottom * 2] = uvs[top * 2];
              meshUvs[bottom * 2 + 1] = uvs[top * 2 + 1];
              for (let channel = 0; channel < 4; channel++) {
                meshFarSurf[bottom * 4 + channel] = farSurf[top * 4 + channel];
              }
              for (let c = 0; c < 3; c++) {
                meshFarCol[bottom * 3 + c] = farCol[top * 3 + c];
                meshFarData[bottom * 3 + c] = farData[top * 3 + c];
              }
              meshFarBasalt[bottom] = farBasalt[top];
              meshFarHeight[bottom] = farHeight[top];
              lower.push(bottom);
            }
            for (let i = 0; i < edge.length; i++) {
              const j = (i + 1) % edge.length;
              indices.push(edge[i], edge[j], lower[i], edge[j], lower[j], lower[i]);
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(meshPositions, 3));
          geometry.setAttribute('uv', new THREE.BufferAttribute(meshUvs, 2));
          geometry.setAttribute('aFarSurf', new THREE.BufferAttribute(meshFarSurf, 4));
          geometry.setAttribute('aFarCol', new THREE.BufferAttribute(meshFarCol, 3));
          geometry.setAttribute('aFarData', new THREE.BufferAttribute(meshFarData, 3));
          geometry.setAttribute('aFarBasalt', new THREE.BufferAttribute(meshFarBasalt, 1));
          geometry.setAttribute('aFarY', new THREE.BufferAttribute(meshFarHeight, 1));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, this.material);
          mesh.position.set(centerX, 0, centerZ);
          mesh.frustumCulled = true;
          nextMeshes.push(mesh);

          const treeMesh = this._buildFarTrees(level, step, innerCells, side, centerX, centerZ);
          if (treeMesh) nextTreeMeshes.push(treeMesh);
        }

        if (token !== this.token) {
          this.disposeMeshes(nextMeshes, nextTreeMeshes);
          return;
        }
        for (const mesh of nextMeshes) this.scene.add(mesh);
        for (const mesh of nextTreeMeshes) this.scene.add(mesh);
        this.disposeMeshes(this.meshes, this.treeMeshes);
        this.meshes = nextMeshes;
        this.treeMeshes = nextTreeMeshes;
        progress(1);
      }

      _buildFarTrees(level, step, innerCells, side, centerX, centerZ) {
        if (typeof VEG_LAYERS === 'undefined' || typeof vegCell !== 'function') return null;

        if (level < 2) return null;
        if (viewRadius * CHUNK_SIZE > 8192 && level > 2) return null;
        const cell = VEG_LAYERS.canopy.cell;
        const half = (side / 2) * step;
        const hole = innerCells * step;
        const stride = level <= 0 ? 1 : (level === 1 ? 2 : (level === 2 ? 3 : 4));
        const gx0 = Math.floor((centerX - half) / cell);
        const gx1 = Math.floor((centerX + half) / cell);
        const gz0 = Math.floor((centerZ - half) / cell);
        const gz1 = Math.floor((centerZ + half) / cell);
        const cap = viewRadius * CHUNK_SIZE > 4096 ? 450 : 900;
        const mats = [];
        const cols = [];
        let n = 0;
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        for (let gz = gz0; gz <= gz1 && n < cap; gz += stride) {
          for (let gx = gx0; gx <= gx1 && n < cap; gx += stride) {
            const base = vegCell('canopy', gx, gz);
            if (!base) continue;
            const lx = base.x - centerX, lz = base.z - centerZ;
            if (Math.abs(lx) > half || Math.abs(lz) > half) continue;
            if (Math.abs(lx) < hole && Math.abs(lz) < hole) continue;
            if (level === 0 && farRingBeyond(base.x, base.z, centerX, centerZ) <= 24) continue;
            const pl = this._farCanopyResolve({ ...base, sp: base.sp, x: base.x, z: base.z, b: base.b, scale: base.scale, yaw: base.yaw, gx: base.gx, gz: base.gz });
            if (!pl) continue;
            p.set(base.x - centerX, pl.y, base.z - centerZ);
            q.setFromAxisAngle(up, base.yaw);
            s.set(base.scale, base.scale, base.scale);
            m.compose(p, q, s);
            mats.push(m.clone());
            cols.push(this._vegModelColor(base.sp));
            n++;
          }
        }
        if (!n) return null;
        const mesh = new THREE.InstancedMesh(this.treeGeo, this.treeMat, n);
        mesh.count = n;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.position.set(centerX, 0, centerZ);
        if (!mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        for (let i = 0; i < n; i++) {
          mesh.setMatrixAt(i, mats[i]);
          mesh.setColorAt(i, cols[i]);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        return mesh;
      }

      update(px, pz) {
        const radius = viewRadius * CHUNK_SIZE;
        const steps = radius > DETAIL_CHUNK_RADIUS * CHUNK_SIZE ? this.ringSteps(radius) : [];


        this.outer = steps.length ? steps[steps.length - 1] * 32 : 0;
        const centerX = Math.floor(px / CHUNK_SIZE) * CHUNK_SIZE;
        const centerZ = Math.floor(pz / CHUNK_SIZE) * CHUNK_SIZE;
        const key = `${centerX},${centerZ},${steps.join(':')}`;
        if (key === this.centerKey) return;
        this.rebuild(px, pz).catch((e) => console.warn('far terrain build failed', e));
      }




      setHaze(visFar) {
        const col = this.scene.fog ? this.scene.fog.color : null;
        if (this.shader) {
          if (col) this.shader.uniforms.uHazeColor.value.copy(col).convertLinearToSRGB();
          this.shader.uniforms.uHazeEnd.value = Math.max(1, visFar);
        }
        if (this.treeShader) {
          if (col) this.treeShader.uniforms.uHazeColor.value.copy(col).convertLinearToSRGB();
          this.treeShader.uniforms.uHazeEnd.value = Math.max(1, visFar);
        }
      }

      async prewarm(px, pz, progress = () => {}) {
        await this.rebuild(px, pz, progress);
      }
    }



    function entityBlocked(x, y, z, r, h) {
      const f = world.field;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dx = Math.cos(ang) * r, dz = Math.sin(ang) * r;
        for (let yy = 0.2; yy <= h; yy += 0.5) {
          if (f.sample(x + dx, y + yy, z + dz) > 0) return true;
        }
      }
      for (let yy = 0.2; yy <= h; yy += 0.5) {
        if (f.sample(x, y + yy, z) > 0) return true;
      }
      if (buildingSystem?.collidesBody(x, y, z, r, h)) return true;
      if (structureCollidesBody(x, y, z, r, h)) return true;
      return false;
    }

    function entityGroundY(x, z, hintY) {
      // shortcut: voxel-height snap instead of smooth surfaceY, cheaper for many entities; standY still corrects small steps
      const fromY = hintY + 6;
      const gy = world.getSurfaceHeight(x, z, Math.max(fromY, 90));
      if (!Number.isFinite(gy) || gy < hintY - 40) return world.getSurfaceHeight(x, z, 90);
      return gy;
    }

    function entityStandY(x, z, hintY, r, h) {
      const gy = entityGroundY(x, z, hintY);
      if (!Number.isFinite(gy)) return null;

      for (let up = 0; up <= 1.25; up += 0.25) {
        const y = gy + up;
        if (!entityBlocked(x, y, z, r, h)) return y;
      }

      for (let up = 1.5; up <= 3.0; up += 0.5) {
        const y = gy + up;
        if (!entityBlocked(x, y, z, r, h)) return y;
      }
      return null;
    }

    function entityPath(sx, sz, sy, tx, tz, r, h) {
      const step = 1;
      const maxStep = 1.15;
      const ox = Math.floor(sx), oz = Math.floor(sz);
      const gx = Math.floor(tx), gz = Math.floor(tz);
      const key = (x, z) => `${x},${z}`;

      const stand = new Map();
      const getStand = (x, z, hint) => {
        const k = key(x, z);
        if (stand.has(k)) return stand.get(k);
        const wy = entityStandY(x + 0.5, z + 0.5, hint, r, h);
        stand.set(k, wy);
        return wy;
      };

      const sy0 = getStand(ox, oz, sy);
      const gy0 = getStand(gx, gz, sy);
      if (sy0 == null) return null;
      const goalY = gy0 == null ? sy : gy0;

      const open = [{ x: ox, z: oz, y: sy0, g: 0, f: 0, p: null }];
      const gScore = new Map([[key(ox, oz), 0]]);
      const closed = new Set();
      const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
      let best = open[0], bestH = Infinity;
      let expanded = 0;

      while (open.length && expanded < 500) {

        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
        const cur = open.splice(bi, 1)[0];
        const ck = key(cur.x, cur.z);
        if (closed.has(ck)) continue;
        closed.add(ck);
        expanded++;

        const hdist = Math.hypot(gx - cur.x, gz - cur.z);
        if (hdist < bestH) { bestH = hdist; best = cur; }
        if (cur.x === gx && cur.z === gz) { best = cur; break; }

        for (const [dx, dz, cost] of dirs) {
          const nx = cur.x + dx, nz = cur.z + dz;
          const nk = key(nx, nz);
          if (closed.has(nk)) continue;

          if (Math.abs(nx - ox) > 28 || Math.abs(nz - oz) > 28) continue;
          if (dx && dz) {
            const ay = getStand(cur.x + dx, cur.z, cur.y);
            const by = getStand(cur.x, cur.z + dz, cur.y);
            if (ay == null || by == null) continue;
            if (Math.abs(ay - cur.y) > maxStep || Math.abs(by - cur.y) > maxStep) continue;
          }
          const ny = getStand(nx, nz, cur.y);
          if (ny == null) continue;
          if (Math.abs(ny - cur.y) > maxStep) continue;

          const mx = (cur.x + nx) * 0.5 + 0.5, mz = (cur.z + nz) * 0.5 + 0.5;
          const my = Math.max(cur.y, ny);
          if (entityBlocked(mx, my, mz, r, h)) continue;

          const ng = cur.g + cost;
          if (ng >= (gScore.get(nk) ?? Infinity)) continue;
          gScore.set(nk, ng);
          const nh = Math.hypot(gx - nx, gz - nz);
          open.push({ x: nx, z: nz, y: ny, g: ng, f: ng + nh, p: cur });
        }
      }


      const path = [];
      let n = best;
      while (n && n.p) { path.push({ x: n.x + 0.5, z: n.z + 0.5, y: n.y }); n = n.p; }
      path.reverse();
      if (!path.length) return null;

      const end = path[path.length - 1];
      end.x = tx; end.z = tz;
      if (gy0 != null) end.y = gy0; else end.y = goalY;
      return path;
    }

    class Walker {
      constructor(world, x, z) {
        this.world = world;
        this.speed = 3.2;
        this.radius = 0.4;
        this.height = 1.6;
        this.vy = 0;
        this.onGround = false;

        const y = entityStandY(x, z, world.getSurfaceHeight(x, z, 90), this.radius, this.height);
        this.pos = new THREE.Vector3(x, Number.isFinite(y) ? y : world.getSurfaceHeight(x, z, 90), z);

        const geo = new THREE.SphereGeometry(0.55, 12, 10);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff5f7a, emissive: 0x330011 });
        this.mesh = new THREE.Mesh(geo, mat);
        world.scene.add(this.mesh);
        this.syncMesh();

        this.path = null;
        this.pathIdx = 0;
        this.repathT = 0;
        this.lastGoal = new THREE.Vector3();
        this.stuckT = 0;
        this.lastMove = new THREE.Vector3(x, this.pos.y, z);
      }

      syncMesh() {
        this.mesh.position.copy(this.pos);
        this.mesh.position.y += 0.55;
      }

      update(dt, playerPos) {
        this.moveToward(dt, playerPos);
        this.syncMesh();
      }

      moveToward(dt, targetPos) {
        const dtStep = Math.min(dt, 0.05);
        const tx = targetPos.x, tz = targetPos.z;
        const dx = tx - this.pos.x, dz = tz - this.pos.z;
        const dist = Math.hypot(dx, dz);

        this.repathT -= dtStep;
        const goalMoved = Math.hypot(tx - this.lastGoal.x, tz - this.lastGoal.z);
        if (!this.path || this.repathT <= 0 || goalMoved > 2.5 || this.pathIdx >= this.path.length) {
          this.path = entityPath(this.pos.x, this.pos.z, this.pos.y, tx, tz, this.radius, this.height);
          this.pathIdx = 0;
          this.repathT = this.path ? 0.6 : 0.3;
          this.lastGoal.set(tx, 0, tz);
        }

        let mx = 0, mz = 0;
        if (dist > 0.8) {
          let wx = tx, wz = tz;
          if (this.path && this.pathIdx < this.path.length) {
            const wp = this.path[this.pathIdx];
            wx = wp.x; wz = wp.z;
            if (Math.hypot(wx - this.pos.x, wz - this.pos.z) < 0.7) {
              this.pathIdx++;
              if (this.pathIdx < this.path.length) { wx = this.path[this.pathIdx].x; wz = this.path[this.pathIdx].z; }
              else { wx = tx; wz = tz; }
            }
          } else {
            wx = tx; wz = tz;
          }
          const sdx = wx - this.pos.x, sdz = wz - this.pos.z;
          const sl = Math.hypot(sdx, sdz);
          if (sl > 1e-4) { mx = sdx / sl; mz = sdz / sl; }
        }


        this.vy -= 26 * dtStep;
        if (this.vy < -40) this.vy = -40;

        const ground = entityGroundY(this.pos.x, this.pos.z, this.pos.y);
        const tryMoveY = (ny) => {
          if (entityBlocked(this.pos.x, ny, this.pos.z, this.radius, this.height)) return false;
          this.pos.y = ny; return true;
        };

        let ny = this.pos.y + this.vy * dtStep;
        if (!tryMoveY(ny)) {
          if (this.vy < 0) {

            for (let i = 0; i < 8; i++) {
              const mid = (this.pos.y + ny) * 0.5;
              if (entityBlocked(this.pos.x, mid, this.pos.z, this.radius, this.height)) ny = mid; else this.pos.y = mid;
            }
            if (entityBlocked(this.pos.x, ny, this.pos.z, this.radius, this.height)) {                  } else this.pos.y = ny;
            this.vy = 0;
            this.onGround = true;
          } else {
            this.vy = 0;
          }
        } else {
          this.onGround = false;
        }

        if (this.onGround || (Number.isFinite(ground) && this.pos.y <= ground + 0.05 && this.vy <= 0)) {
          if (Number.isFinite(ground) && !entityBlocked(this.pos.x, ground, this.pos.z, this.radius, this.height)) {
            if (this.pos.y - ground < 1.2 || this.vy <= 0) {
              this.pos.y = ground;
              this.vy = 0;
              this.onGround = true;
            }
          }
        }

        if (Number.isFinite(ground) && this.pos.y < ground - 0.5) {
          if (!entityBlocked(this.pos.x, ground, this.pos.z, this.radius, this.height)) this.pos.y = ground;
        }


        const speed = Math.max(0, this.speed);
        if ((mx || mz) && speed > 0) {
          const stepLen = speed * dtStep;
          const tryMoveXZ = (nx, nz) => {
            const gy = entityGroundY(nx, nz, this.pos.y);

            const tries = [this.pos.y];
            if (Number.isFinite(gy)) {
              const rise = gy - this.pos.y;
              if (rise > 0.05 && rise <= 1.1) tries.unshift(gy);

              if (rise < -0.05 && rise >= -1.5 && !entityBlocked(nx, this.pos.y, nz, this.radius, this.height)) {

              } else if (rise < -0.05 && rise >= -1.5) {
                tries.push(gy);
              }
            }
            for (const ty of tries) {
              if (!Number.isFinite(ty)) continue;
              if (entityBlocked(nx, ty, nz, this.radius, this.height)) continue;
              this.pos.x = nx; this.pos.z = nz;
              if (ty > this.pos.y) this.pos.y = ty;
              return true;
            }
            return false;
          };

          let moved = tryMoveXZ(this.pos.x + mx * stepLen, this.pos.z + mz * stepLen);
          if (!moved) {

            moved = tryMoveXZ(this.pos.x + mx * stepLen, this.pos.z) || tryMoveXZ(this.pos.x, this.pos.z + mz * stepLen);
          }
          if (!moved) {

            const angs = [0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
            for (const a of angs) {
              const ca = Math.cos(a), sa = Math.sin(a);
              const rx = mx * ca - mz * sa, rz = mx * sa + mz * ca;
              if (tryMoveXZ(this.pos.x + rx * stepLen, this.pos.z + rz * stepLen)) { moved = true; break; }
            }
          }
          if (!moved) {
            this.stuckT += dtStep;
            if (this.stuckT > 0.8) { this.path = null; this.repathT = 0; this.stuckT = 0; }
          } else {
            this.stuckT = 0;
          }
        } else {
          this.stuckT = 0;
        }


        if (this.pos.y < CHUNK_Y_MIN * CHUNK_SIZE - 20) this.pos.y = entityGroundY(this.pos.x, this.pos.z, 60) || 0;
      }

      dispose() {
        this.world.scene.remove(this.mesh);
        this.mesh.geometry?.dispose?.();
        this.mesh.material?.dispose?.();
      }
    }







    const WRAPPER = {
      url: 'assets/models/enemies/wrapper.glb',
      scale: 0.01,
      speedWalk: 1.8,
      speedRun: 4.3,
      wasteSpeed: 1.4,
      wasteDamage: 20,
      wasteHitCd: 0.9,
      attackRange: 2.2,
      hp: 120,
      despawn: 96,
    };
    const WRAPPER_SOUND_POOLS = {
      attack: ['attack-1.ogg', 'attack-2.ogg', 'attack-3.ogg'],
      hurt: ['hurt-1.ogg', 'hurt-2.ogg', 'hurt-3.ogg', 'hurt-4.ogg', 'hurt-5.ogg'],
      approach: ['approach-1.ogg', 'approach-2.ogg', 'approach-3.ogg', 'approach-4.ogg', 'approach-5.ogg', 'approach-6.ogg'],
    };
    const _wrapperSoundLast = {};
    function playWrapperSound(name, pos) {
      const pool = WRAPPER_SOUND_POOLS[name];
      if (!pool || !pool.length) return;
      const dx = pos.x - player.pos.x, dz = (pos.z ?? 0) - (player.pos.z ?? 0);
      const dy = (pos.y ?? 0) - (player.pos.y ?? 0);
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 40) return;
      const vol = Math.max(0, 1 - dist / 40) * 0.85 * (typeof masterVolume === 'number' ? masterVolume : 1);
      if (vol <= 0.01) return;
      let pick = pool[(Math.random() * pool.length) | 0];
      if (pool.length > 1 && pick === _wrapperSoundLast[name]) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
      _wrapperSoundLast[name] = pick;
      try {
        const a = new Audio(`assets/audio/enemies/wrapper/${pick}`);
        a.volume = Math.min(1, vol);
        a.play().catch(() => {});
      } catch {}
    }
    let wrapperTemplate = null;

    class Wrapper extends Walker {
      constructor(world, x, z, tpl) {
        super(world, x, z);
        world.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();


        this.radius = 0.45;
        this.height = 1.75;
        const sy = entityStandY(x, z, this.pos.y, this.radius, this.height);
        if (Number.isFinite(sy)) this.pos.y = sy;

        this.root = cloneSkeleton(tpl.scene);
        this.root.scale.setScalar(WRAPPER.scale);
        this.root.traverse((o) => {
          if (!o.isMesh) return;
          o.frustumCulled = false;
          o.castShadow = false;
          const m = o.material;
          if (m?.map) {
            m.map.magFilter = THREE.NearestFilter;
            m.map.minFilter = THREE.NearestFilter;
            m.map.generateMipmaps = false;
            m.map.needsUpdate = true;
          }
        });

        this.mixer = new THREE.AnimationMixer(this.root);
        this.actions = {};
        for (const clip of tpl.clips) {
          const a = this.mixer.clipAction(clip);
          a.enabled = true;
          this.actions[clip.name] = a;
        }
        this.clip = null;
        this.hp = WRAPPER.hp;
        this.dying = 0;
        this.dead = false;
        this.screamCd = 8 + Math.random() * 12;
        this.approachCd = 4 + Math.random() * 8;
        this.speed = WRAPPER.speedWalk;
        this.mesh = this.root;
        world.scene.add(this.mesh);
        this.syncMesh();
        this.play('walk', 0);
      }

      syncMesh() {
        this.mesh.position.copy(this.pos);
      }

      play(name, fade = 0.25) {
        const next = this.actions[name];
        if (!next || next === this.clip) return;
        next.reset().setEffectiveWeight(1).fadeIn(fade).play();
        if (this.clip) this.clip.fadeOut(fade);
        this.clip = next;
      }

      update(dt, playerPos) {
        if (this.dying > 0) {
          this.dying -= dt;
          this.mixer.update(dt);
          if (this.dying <= 0) { this.dead = true; this.dispose(); }
          return;
        }

        const d = Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
        if (d < WRAPPER.attackRange) {
          this.speed = 0;
          this.play('attack', 0.12);
        } else if (d < 18) {
          this.speed = this.speedRun || WRAPPER.speedRun;
          this.play('run', 0.2);
        } else {
          this.speed = this.speedWalk || WRAPPER.speedWalk;
          this.play('walk', 0.3);
        }

        this.screamCd -= dt;
        if (this.screamCd <= 0) {
          this.screamCd = 14 + Math.random() * 16;
          if (d > 12) this.play('scream', 0.2);
        }

        this.approachCd -= dt;
        if (this.approachCd <= 0 && d < 30 && d >= WRAPPER.attackRange) {
          this.approachCd = 6 + Math.random() * 12;
          playWrapperSound('approach', this.pos);
        }

        super.update(dt, playerPos);

        const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
        if (Math.hypot(dx, dz) > 0.5) {
          const yaw = Math.atan2(dx, dz);
          let diff = yaw - this.mesh.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.mesh.rotation.y += diff * Math.min(1, dt * 8);
        }

        this.mixer.update(dt);
      }

      hurtBy(amount) {
        if (this.dying > 0) return;
        this.hp -= amount;
        playWrapperSound('hurt', this.pos);
        if (this.hp <= 0) {
          this.dying = 0.9;
          this.play('scream', 0.05);
        }
      }

      dispose() {
        this.world.scene.remove(this.mesh);
        this.mixer?.stopAllAction();
        this.mixer = null;
      }
    }





    const CHICKEN = {
      url: 'assets/models/animals/chicken.gltf',
      height: 0.38,
      speed: 1.05,
      despawn: 80,
    };
    let chickenTemplate = null;
    let chickenLoading = false;
    let chickenSummonPending = false;

    function loadChickenTemplate(onLoad, onError) {
      if (chickenTemplate) { onLoad?.(chickenTemplate); return; }
      if (chickenLoading) return;
      chickenLoading = true;
      new GLTFLoader().load(CHICKEN.url, (gltf) => {
        chickenTemplate = { scene: gltf.scene, clips: gltf.animations };
        chickenLoading = false;
        if (chickenSummonPending) {
          chickenSummonPending = false;
          notice(trySummonEntity('chicken'));
        }
        onLoad?.(chickenTemplate);
      }, undefined, (err) => {
        chickenLoading = false;
        if (chickenSummonPending) {
          chickenSummonPending = false;
          notice('CHICKEN NOT READY');
        }
        console.warn('chicken model failed to load', err);
        onError?.(err);
      });
    }

    function loadChickenForSummon() {
      if (chickenTemplate) return trySummonEntity('chicken');
      chickenSummonPending = true;
      loadChickenTemplate();
      return chickenLoading || chickenTemplate ? 'LOADING CHICKEN...' : 'CHICKEN NOT READY';
    }

    loadChickenTemplate();

    class Chicken {
      constructor(world, x, z, tpl) {
        this.world = world;
        this.radius = 0.18;
        this.height = CHICKEN.height;
        this.speed = CHICKEN.speed * (0.85 + Math.random() * 0.3);
        this.hp = 20;
        this.dead = false;

        const y = entityStandY(x, z, world.getSurfaceHeight(x, z, 90), this.radius, this.height);
        this.pos = new THREE.Vector3(x, Number.isFinite(y) ? y : world.getSurfaceHeight(x, z, 90), z);

        this.root = cloneSkeleton(tpl.scene);


        const box = new THREE.Box3().setFromObject(this.root);
        const size = box.getSize(new THREE.Vector3());
        const h = Math.max(0.001, size.y);
        this.root.scale.setScalar(CHICKEN.height / h);
        box.setFromObject(this.root);
        this.footOffset = -box.min.y;

        this.root.traverse((o) => {
          if (!o.isMesh) return;
          o.frustumCulled = false;
          o.castShadow = false;
          const m = o.material;
          if (m?.map) {
            m.map.magFilter = THREE.NearestFilter;
            m.map.minFilter = THREE.NearestFilter;
            m.map.generateMipmaps = false;
            m.map.needsUpdate = true;
          }
        });

        this.legs = this.findLegs();
        this.legBase = this.legs.map((l) => ({ x: l.rotation.x, y: l.rotation.y, z: l.rotation.z }));
        this.legVerts = this.findLegVerts();
        this.walkPhase = Math.random() * Math.PI * 2;
        this.walkAmt = 0;
        this.bob = 0;

        this.wanderTarget = null;
        this.wanderT = 0;
        this.idle = 0.5 + Math.random() * 1.5;
        this.stuckT = 0;

        this.mesh = this.root;
        this.modelYawOffset = -Math.PI / 2;
        this.mesh.rotation.y = this.modelYawOffset;
        world.scene.add(this.mesh);
        this.syncMesh();
      }

      hurtBy(amount) {
        if (this.dead) return;
        this.hp -= amount;
        if (this.hp <= 0) {
          this.dead = true;
          spawnDrop('raw_chicken', 1, { x: this.pos.x, y: this.pos.y + 0.2, z: this.pos.z });
        }
      }

      findLegs() {
        const legs = [];
        this.root.traverse((o) => {
          if (/leg|foot|thigh|shin|ankle/i.test(o.name || '')) legs.push(o);
        });
        return legs;
      }

      findLegVerts() {
        let mesh = null;
        this.root.traverse((o) => {
          if (!mesh && o.isMesh && o.geometry?.attributes?.position) mesh = o;
        });
        if (!mesh) return null;
        const pos = mesh.geometry.attributes.position;
        const base = Float32Array.from(pos.array);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        const cx = (minX + maxX) * 0.5;
        const h = Math.max(1e-6, maxY - minY);
        const legY = minY + h * 0.45;
        const left = [], right = [];
        for (let i = 0; i < pos.count; i++) {
          const x = base[i * 3], y = base[i * 3 + 1];
          if (y > legY) continue;
          if (x < cx - 1e-5) left.push(i);
          else if (x > cx + 1e-5) right.push(i);
        }
        if (!left.length || !right.length) return null;
        return { mesh, pos, base, left, right, swing: h * 0.18, lift: h * 0.08 };
      }

      applyLegVerts(phase, amt) {
        const lv = this.legVerts;
        if (!lv) return false;
        const arr = lv.pos.array;
        arr.set(lv.base);
        const lStep = Math.sin(phase);
        const rStep = Math.sin(phase + Math.PI);
        for (const i of lv.left) {
          const o = i * 3;
          arr[o + 1] += Math.max(0, lStep) * lv.lift * amt;
          arr[o + 2] += lStep * lv.swing * amt;
        }
        for (const i of lv.right) {
          const o = i * 3;
          arr[o + 1] += Math.max(0, rStep) * lv.lift * amt;
          arr[o + 2] += rStep * lv.swing * amt;
        }
        lv.pos.needsUpdate = true;
        return true;
      }

      inWater(x, y, z) {
        return this.world.waterAt(x, y + 0.15, z) > 0;
      }

      pickWanderTarget() {
        for (let t = 0; t < 10; t++) {
          const a = Math.random() * Math.PI * 2;
          const d = 2 + Math.random() * 6;
          const x = this.pos.x + Math.cos(a) * d;
          const z = this.pos.z + Math.sin(a) * d;
          if (biomeAt(x, z) !== B.PLAINS) continue;
          const y = entityStandY(x, z, this.pos.y, this.radius, this.height);
          if (y == null) continue;
          if (Math.abs(y - this.pos.y) > 1.4) continue;
          if (this.inWater(x, y, z)) continue;
          this.wanderTarget = new THREE.Vector3(x, y, z);
          this.wanderT = 3 + Math.random() * 5;
          return;
        }
        this.wanderTarget = null;
        this.wanderT = 1 + Math.random() * 2;
        this.idle = 0.5 + Math.random() * 1.5;
      }

      applyWalk(phase, amt) {
        const swing = Math.sin(phase) * 0.6 * amt;
        if (this.legs.length) {
          for (let i = 0; i < this.legs.length; i++) {
            const b = this.legBase[i], l = this.legs[i];
            const dir = (i % 2 === 0 ? 1 : -1);
            l.rotation.x = b.x + swing * dir;
          }
          this.bob = Math.abs(Math.sin(phase)) * 0.012 * amt;
        } else if (this.applyLegVerts(phase, amt)) {
          this.bob = Math.abs(Math.sin(phase)) * 0.01 * amt;
        } else {

          this.bob = Math.abs(Math.sin(phase)) * 0.02 * amt;
          this.root.rotation.z = Math.sin(phase) * 0.06 * amt;
        }
      }

      syncMesh() {
        this.mesh.position.set(this.pos.x, this.pos.y + this.footOffset + this.bob, this.pos.z);
      }

      update(dt) {
        if (this.dead) return;
        const dtStep = Math.min(dt, 0.05);
        this.wanderT -= dtStep;

        let moving = false, vx = 0, vz = 0;

        if (this.idle > 0) {
          this.idle -= dtStep;
        } else {
          if (!this.wanderTarget || this.wanderT <= 0) this.pickWanderTarget();
          if (this.wanderTarget) {
            const dx = this.wanderTarget.x - this.pos.x;
            const dz = this.wanderTarget.z - this.pos.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) {
              this.wanderTarget = null;
              this.idle = 0.6 + Math.random() * 2.4;
            } else {
              vx = dx / d; vz = dz / d;
              const step = this.speed * dtStep;
              const nx = this.pos.x + vx * step;
              const nz = this.pos.z + vz * step;
              let ny = entityStandY(nx, nz, this.pos.y, this.radius, this.height);
              if (ny == null || this.inWater(nx, ny, nz)) {
                const nyx = entityStandY(nx, this.pos.z, this.pos.y, this.radius, this.height);
                const nyz = entityStandY(this.pos.x, nz, this.pos.y, this.radius, this.height);
                if (nyx != null && !this.inWater(nx, nyx, this.pos.z)) {
                  this.pos.x = nx; this.pos.y = nyx; moving = true; ny = nyx; vx = Math.sign(vx) || 0; vz = 0;
                } else if (nyz != null && !this.inWater(this.pos.x, nyz, nz)) {
                  this.pos.z = nz; this.pos.y = nyz; moving = true; ny = nyz; vx = 0; vz = Math.sign(vz) || 0;
                } else {
                  ny = null;
                }
              } else {
                this.pos.x = nx; this.pos.z = nz; this.pos.y = ny; moving = true;
              }
              if (ny == null) {
                this.stuckT += dtStep;
                if (this.stuckT > 0.4) { this.wanderTarget = null; this.stuckT = 0; }
              } else {
                this.stuckT = 0;
              }
            }
          }
        }

        if (moving && (vx || vz)) {
          const yaw = Math.atan2(vx, vz) + this.modelYawOffset;
          let diff = yaw - this.mesh.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.mesh.rotation.y += diff * Math.min(1, dtStep * 10);
        }

        const targetAmt = moving ? 1 : 0;
        this.walkAmt += (targetAmt - this.walkAmt) * Math.min(1, dtStep * 10);
        if (this.walkAmt > 0.01) this.walkPhase += dtStep * (7 + this.speed * 2) * this.walkAmt;
        this.applyWalk(this.walkPhase, this.walkAmt);
        // shortcut: idle chickens resnap ground every 2s, terrain edits under one can take 2s to settle
        this.groundSnapT = (this.groundSnapT || 0) - dtStep;
        if (moving || this.walkAmt > 0.02 || this.groundSnapT <= 0) {
          const gy = entityStandY(this.pos.x, this.pos.z, this.pos.y, this.radius, this.height);
          if (gy != null) this.pos.y = gy;
          this.groundSnapT = 2;
        }

        if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y) || !Number.isFinite(this.pos.z)) {
          console.warn('[chicken] invalid position', this.pos.x, this.pos.y, this.pos.z);
          this.dead = true;
          this.syncMesh();
          return;
        }

        this.syncMesh();
      }

      dispose() {
        this.world.scene.remove(this.mesh);
      }
    }





    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });

    let PIXEL = getSetting('resolution');
    renderer.setPixelRatio(1);
    let postTarget = null;



    let exportRes = null;
    function applyPixelSize() {
      const ex = exportRes;
      const w = ex ? (ex.pixels ? Math.ceil(ex.w / PIXEL) : ex.w) : Math.ceil(innerWidth / PIXEL);
      const h = ex ? (ex.pixels ? Math.ceil(ex.h / PIXEL) : ex.h) : Math.ceil(innerHeight / PIXEL);
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100vw';
      renderer.domElement.style.height = '100vh';
      if (postTarget) postTarget.setSize(w, h);
    }
    applyPixelSize();



    let COLOR_LEVELS = getSetting('colorLevels');
    postTarget = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true, samples: 0 });
    postTarget.texture.minFilter = THREE.NearestFilter;
    postTarget.texture.magFilter = THREE.NearestFilter;
    applyPixelSize();
    const postMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: postTarget.texture },
        uLevels: { value: COLOR_LEVELS },
        uRadBlur: { value: 0 },
        uRadDark: { value: 0 },
        uDriveRed: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse; uniform float uLevels;
    uniform float uRadBlur; uniform float uRadDark; uniform float uDriveRed; uniform float uTime;
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      int i = y * 4 + x;
      if (i == 0) return 0.0625; if (i == 1) return 0.5625; if (i == 2) return 0.1875; if (i == 3) return 0.6875;
      if (i == 4) return 0.8125; if (i == 5) return 0.3125; if (i == 6) return 0.9375; if (i == 7) return 0.4375;
      if (i == 8) return 0.25; if (i == 9) return 0.75; if (i == 10) return 0.125; if (i == 11) return 0.625;
      if (i == 12) return 1.0; if (i == 13) return 0.5; if (i == 14) return 0.875; if (i == 15) return 0.375;
      return 0.5;
    }
    void main() {
      vec2 uv = vUv;
      // radiation sickness: radial blur + throbbing darken as the dose climbs
      if (uRadBlur > 0.001) {
        vec2 dir = uv - vec2(0.5);
        float pulse = 0.5 + 0.5 * sin(uTime * 2.2);
        float amt = uRadBlur * 0.02 * (0.6 + 0.6 * pulse);
        vec3 sum = vec3(0.0);
        sum += texture2D(tDiffuse, uv).rgb * 0.4;
        sum += texture2D(tDiffuse, uv + dir * amt).rgb * 0.2;
        sum += texture2D(tDiffuse, uv - dir * amt).rgb * 0.2;
        sum += texture2D(tDiffuse, uv + dir * amt * 2.0).rgb * 0.1;
        sum += texture2D(tDiffuse, uv - dir * amt * 2.0).rgb * 0.1;
        vec3 c = sum;
        float vig = 1.0 - uRadDark * smoothstep(0.35, 0.85, length(dir));
        c *= mix(1.0, vig, 0.85) * (1.0 - uRadDark * 0.35);
        c += (bayer(gl_FragCoord.xy) - 0.5) * (1.5 / uLevels);
        c = floor(c * uLevels + 0.5) / uLevels;
        if (uDriveRed > 0.5) c = vec3(c.r * 1.35, 0.0, 0.0);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        return;
      }
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c += (bayer(gl_FragCoord.xy) - 0.5) * (1.5 / uLevels); // 1.5 LSB dither kills banding
      c = floor(c * uLevels + 0.5) / uLevels;
      if (uDriveRed > 0.5) c = vec3(c.r * 1.35, 0.0, 0.0);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    });
    const postScene = new THREE.Scene();
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    window.__NUCLEARISM_GAME_CANVAS__ = renderer.domElement;
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const SKY = new THREE.Color(0x9ec9e8);
    scene.background = SKY.clone();
    scene.fog = new THREE.Fog(SKY, 55, 130);

    const camera = new THREE.PerspectiveCamera(getSetting('fov'), innerWidth / innerHeight, 0.08, 400);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    const flashlightLight = new THREE.SpotLight(0xf4f9ff, 0, 270, Math.PI / 7, 0.2, 1);
    flashlightLight.position.set(0.18, -0.18, -0.12);
    flashlightLight.target.position.set(0, 0, -16);
    flashlightLight.castShadow = true;
    flashlightLight.shadow.mapSize.set(1024, 1024);
    flashlightLight.shadow.camera.far = 270;
    flashlightLight.shadow.camera.updateProjectionMatrix();
    flashlightLight.shadow.bias = -0.0005;
    flashlightLight.shadow.normalBias = 0.05;
    flashlightLight.visible = false;
    camera.add(flashlightLight);
    camera.add(flashlightLight.target);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a4438, 0.75);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
    scene.add(sun);
    scene.add(sun.target);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.18);
    fill.position.set(-0.6, 0.4, -0.5).multiplyScalar(100);
    scene.add(fill);






    function radialSprite(stops, size = 256) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const [o, col] of stops) grad.addColorStop(o, col);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }



    const sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({
        map: radialSprite([
          [0.0, 'rgba(255,255,252,1)'],
          [0.52, 'rgba(255,250,228,1)'],
          [0.72, 'rgba(255,231,168,0.96)'],
          [0.86, 'rgba(255,196,110,0.42)'],
          [1.0, 'rgba(255,170,90,0)'],
        ]),
        color: 0xfff6d8, fog: false, transparent: true, opacity: 0.95, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(sunDisc);
    const sunGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 56),
      new THREE.MeshBasicMaterial({
        map: radialSprite([
          [0.0, 'rgba(255,240,190,0.85)'],
          [0.30, 'rgba(255,214,140,0.34)'],
          [0.84, 'rgba(255,178,104,0.10)'],
          [1.0, 'rgba(255,160,90,0)'],
        ]),
        color: 0xfff2c0, fog: false, transparent: true, opacity: 0.25, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(sunGlow);
    const sunHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshBasicMaterial({
        map: radialSprite([
          [0.0, 'rgba(255,214,160,0.30)'],
          [0.40, 'rgba(255,186,130,0.11)'],
          [1.0, 'rgba(255,160,110,0)'],
        ]),
        color: 0xffd9a8, fog: false, transparent: true, opacity: 0.18, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(sunHalo);



    function moonTexture(size = 256) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const R = size / 2;
      g.fillStyle = '#c9cdd4';
      g.fillRect(0, 0, size, size);

      g.fillStyle = 'rgba(120,128,140,0.55)';
      const patches = [[0.30, 0.34, 0.20], [0.62, 0.28, 0.16], [0.45, 0.66, 0.24], [0.72, 0.58, 0.12]];
      for (const [px, py, pr] of patches) {
        g.beginPath();
        g.arc(R + (px - 0.5) * size, R + (py - 0.5) * size, pr * R, 0, Math.PI * 2);
        g.fill();
      }

      let seed = 1337;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 42; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R * 0.94;
        const cx = R + Math.cos(a) * r, cy = R + Math.sin(a) * r;
        const cr = (0.02 + rnd() * 0.075) * size;
        g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2);
        g.fillStyle = 'rgba(96,102,112,0.5)'; g.fill();
        g.beginPath(); g.arc(cx - cr * 0.18, cy - cr * 0.18, cr * 0.86, 0, Math.PI * 2);
        g.fillStyle = 'rgba(214,218,226,0.45)'; g.fill();
      }

      const shade = g.createRadialGradient(R, R, R * 0.45, R, R, R);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = shade;
      g.fillRect(0, 0, size, size);

      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      g.arc(R, R, R, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();

      g.globalCompositeOperation = 'destination-out';
      const feather = g.createRadialGradient(R, R, R * 0.88, R, R, R);
      feather.addColorStop(0, 'rgba(0,0,0,0)');
      feather.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = feather;
      g.fillRect(0, 0, size, size);
      g.globalCompositeOperation = 'source-over';
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    const moonDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ map: moonTexture(), fog: false, transparent: true, opacity: 0, depthWrite: false })
    );
    scene.add(moonDisc);
    const moonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({
        map: radialSprite([
          [0.0, 'rgba(200,214,255,0.42)'],
          [0.42, 'rgba(170,190,240,0.16)'],
          [1.0, 'rgba(140,160,220,0)'],
        ]),
        color: 0xc8d6ff, fog: false, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(moonGlow);

    const moonLight = new THREE.DirectionalLight(0xaec4ff, 0);
    scene.add(moonLight);
    scene.add(moonLight.target);


    for (const m of [sunDisc, sunGlow, sunHalo, moonDisc, moonGlow]) m.renderOrder = -1;



    const cloudUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR },
      uCoverage: { value: 0.52 },
      uDay: { value: 1 },
    };
    const cloudMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
      uniforms: cloudUniforms,
      vertexShader: `
    varying vec2 vUv; varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
      fragmentShader: `
    varying vec2 vUv; varying vec3 vWorld;
    uniform float uTime; uniform vec3 uSunDir; uniform float uCoverage; uniform float uDay;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
    }
    float fbm(vec2 p){
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
      return s;
    }
    void main() {
      vec2 p = vWorld.xz * 0.008;
      float t = uTime * 0.015;
      // domain warp + two drift layers for parallax
      vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t * 0.7));
      float d = fbm(p + 1.8 * q + vec2(t, t * 0.3));
      float cov = smoothstep(1.0 - uCoverage - 0.35, 1.0 - uCoverage + 0.35, d);
      if (cov < 0.01) discard;
      // sun silver-lining: bright rim toward sun azimuth
      vec2 sunXZ = normalize(uSunDir.xz + vec2(1e-4));
      vec2 grad = vec2(dFdx(d), dFdy(d)) * 40.0;
      float rim = clamp(1.0 - length(grad), 0.0, 1.0);
      vec3 base = mix(vec3(0.72,0.76,0.82), vec3(1.05,1.03,0.98), rim);
      float edge = smoothstep(0.0, 0.45, cov) * (1.0 - smoothstep(0.45, 1.0, cov));
      base += vec3(1.0,0.9,0.7) * pow(edge, 2.0) * 0.55; // sunlit edges
      float shade = 0.75 + 0.45 * cov;
      // dissolve the layer with distance so its far edge never shows (the plane
      // is huge; this fades it out well before the camera far clip).
      float hd = length(vWorld.xz - cameraPosition.xz);
      float fade = 1.0 - smoothstep(250.0, 380.0, hd);
      if (fade < 0.01) discard;
      base = mix(vec3(0.05, 0.06, 0.10), base, uDay);   // night clouds go dark
      gl_FragColor = vec4(base * shade, cov * 0.88 * fade * (0.25 + 0.75 * uDay));
    }`,
    });
    const clouds = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), cloudMat);
    clouds.rotation.x = -Math.PI / 2;
    scene.add(clouds);








    const ITEMS = { ...ITEM_DEFS };


    const BARE_HANDS = { radius: 1.1, rate: 0.6, yield: 1, damage: 15, good: ['dirt', 'grass', 'stone', 'basalt'] };

    const itemIconCache = new Map();
    const itemSpriteCache = new Map();

    function buildItemIconCanvas(id, size = 64) {
      const def = ITEMS[id] || { code: '?', name: id };
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#e9f6ff');
      grad.addColorStop(1, '#9dc2ff');
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      g.strokeStyle = '#000000';
      g.lineWidth = 6;
      g.strokeRect(4, 4, size - 8, size - 8);
      g.fillStyle = '#000';
      g.font = '700 18px "Quantico", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(def.code || '?', size / 2, size / 2 + 8);
      return c;
    }

    function applyAlphaOutline(canvas, padding = 0) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const out = new Uint8ClampedArray(d);
      const thickness = 2;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const a = d[i + 3];
          if (a <= 0) continue;

          let edge = false;
          for (let yy = -thickness; yy <= thickness && !edge; yy++) {
            for (let xx = -thickness; xx <= thickness && !edge; xx++) {
              if (!xx && !yy) continue;
              const nx = x + xx;
              const ny = y + yy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) { edge = true; continue; }
              const j = (ny * w + nx) * 4;
              if (d[j + 3] <= 0) edge = true;
            }
          }

          if (edge) {
            out[i] = 0;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = 255;
          }
        }
      }

      const overlay = new ImageData(out, w, h);
      ctx.putImageData(overlay, 0, 0);
      return canvas;
    }





    const modelIconCache = new Map(_iconCachePreload);


    function loadModelIcon(id) {
      return modelIconCache.has(id) ? modelIconCache.get(id) : null;
    }

    function cachedModelIcon(id) {
      return loadModelIcon(id) || null;
    }

    function modelIconTried(id) {
      return loadModelIcon(id) !== null;
    }

    function modelIconSource(id) {
      const t = TOOL_MODELS[id];
      if (t) return { dir: t.dir, obj: t.obj };
      const glb = itemModelIcon(id);
      return glb ? { glb, tint: modelTint(id) } : null;
    }

    let iconGL = null;

    function tintModel(root, color) {
      const c = new THREE.Color(color);
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const one = !Array.isArray(o.material);
        const mats = (one ? [o.material] : o.material).map((m) => {
          const n = m.clone();
          if (n.color) n.color.multiply(c);
          return n;
        });
        o.material = one ? mats[0] : mats;
      });
    }

    function renderModelIcon(source) {
      if (!iconGL) {
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1);
        renderer.setSize(128, 128, false);
        renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0x39424f, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.4);
        key.position.set(4, 7, 6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x9db8ff, 1.1);
        rim.position.set(-5, 2, -4);
        scene.add(rim);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
        iconGL = { renderer, scene, camera };
      }
      const { renderer, scene, camera } = iconGL;
      const load = source.glb
        ? new GLTFLoader().loadAsync(source.glb).then((g) => g.scene)
        : new MTLLoader().setPath(source.dir).loadAsync(source.obj + '.mtl').then((mats) => {
            mats.preload();
            return new OBJLoader().setMaterials(mats).setPath(source.dir).loadAsync(source.obj + '.obj');
          });

      return load.then((root) => {
        if (source.tint) tintModel(root, source.tint);
        root.updateMatrixWorld(true);
        const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
        const centre = sphere.center;
        const radius = Math.max(sphere.radius, 1e-3);
        const dir = new THREE.Vector3(1, 0.85, 1).normalize();
        camera.position.copy(centre).addScaledVector(dir, radius * 4);
        camera.lookAt(centre);
        camera.left = -radius * 1.04; camera.right = radius * 1.04;
        camera.top = radius * 1.04; camera.bottom = -radius * 1.04;
        camera.near = 0.01; camera.far = radius * 10;
        camera.updateProjectionMatrix();
        scene.add(root);
        renderer.render(scene, camera);
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        c.getContext('2d').drawImage(renderer.domElement, 0, 0);
        scene.remove(root);
        applyAlphaOutline(c);
        return c.toDataURL('image/png');
      });
    }

    function initModelIcons() {
      const ids = [...new Set([...Object.keys(ITEMS), ...Object.keys(TOOL_MODELS)])]
        .filter((id) => ITEMS[id] && !ITEM_MODEL_ICON_EXCLUDE.has(id) && modelIconSource(id) && !modelIconTried(id));
      let i = 0;
      const next = () => {
        if (i >= ids.length) { syncBars(); return; }
        const id = ids[i++];
        renderModelIcon(modelIconSource(id)).then((url) => {
          modelIconCache.set(id, url);
          idbSet(ICON_CACHE_KEY + id, url).catch(() => { });
          if (i % 4 === 0) syncBars();
        }).catch(() => {

          modelIconCache.set(id, '');
          idbSet(ICON_CACHE_KEY + id, '').catch(() => { });
        }).finally(next);
      };
      next();
    }

    function tintCanvasToColor(canvas, tint) {
      if (!tint) return;
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = (tint >> 16) & 255;
      const g = (tint >> 8) & 255;
      const b = tint & 255;

      for (let i = 0; i < data.data.length; i += 4) {
        const a = data.data[i + 3];
        if (a === 0) continue;
        data.data[i] = (data.data[i] * r) / 255;
        data.data[i + 1] = (data.data[i + 1] * g) / 255;
        data.data[i + 2] = (data.data[i + 2] * b) / 255;
      }

      ctx.putImageData(data, 0, 0);
    }

    function itemIconUrl(id) {
      const def = ITEMS[id];
      if (!def) return '';
      if (ITEM_MODEL_ICON_EXCLUDE.has(id) && def.icon && def.icon.startsWith('assets/')) {
        return def.icon;
      }
      const modelIcon = cachedModelIcon(id);
      if (modelIcon) return modelIcon;
      if (itemIconCache.has(id)) return itemIconCache.get(id);
      if (def.icon && def.icon.startsWith('assets/')) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        const img = new Image();
        img.onload = () => {
          g.clearRect(0, 0, c.width, c.height);

          const scale = Math.min(c.width / img.width, c.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (c.width - w) / 2;
          const y = (c.height - h) / 2;

          g.drawImage(img, x, y, w, h);
          tintCanvasToColor(c, def.tint);
          applyAlphaOutline(c);
          itemIconCache.set(id, c.toDataURL('image/png'));
        };
        img.src = def.icon;
        return def.icon;
      }
      const c = buildItemIconCanvas(id);
      const url = c.toDataURL('image/png');
      itemIconCache.set(id, url);
      return url;
    }

    function itemSpriteTexture(id) {
      if (itemSpriteCache.has(id)) return itemSpriteCache.get(id);
      const def = ITEMS[id];
      if (!def) return null;
      let tex;
      if (def.icon && def.icon.startsWith('assets/')) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#dfeeff';
        g.fillRect(0, 0, c.width, c.height);
        g.strokeStyle = '#000000';
        g.lineWidth = 8;
        g.strokeRect(6, 6, c.width - 12, c.height - 12);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min((c.width - 24) / img.width, (c.height - 24) / img.height);
          const w = img.width * scale, h = img.height * scale;
          const x = (c.width - w) / 2, y = (c.height - h) / 2;
          g.drawImage(img, x, y, w, h);
          tintCanvasToColor(c, def.tint);
          tex.needsUpdate = true;
        };
        img.src = def.icon;
        tex = new THREE.CanvasTexture(c);
      } else {
        const c = buildItemIconCanvas(id, 128);
        tex = new THREE.CanvasTexture(c);
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      itemSpriteCache.set(id, tex);
      return tex;
    }

    const inv = {
      hot: Array(7).fill(null), main: Array(28).fill(null), sel: 0, dose: 0,
      armor: { head: null, chest: null, legs: null, feet: null, hands: null },
    };
    if (!savedData) {
      inv.hot[0] = { id: 'flashlight', n: 1 };
    }



    const vitals = {
      hp: 100, maxHp: 100, hunger: 100, maxHunger: 100,
      wounds: Object.create(null), infectionImmunity: 0,
      foodNumb: Object.create(null),
    };

    function foodNumb(id) {
      const n = vitals.foodNumb[id];
      return Number.isFinite(n) ? Math.max(-2, Math.min(2, n)) : 2;
    }
    function foodFactor(id) {
      const n = foodNumb(id);
      return n >= 0 ? 1 + n / 2 : 0.01 + (1 + n / 2) * 0.99;
    }
    function effectiveFood(id, base) {
      return base * foodFactor(id);
    }
    const WOUNDS = {
      bleeding: { name: 'BLEEDING', dps: 1.1, color: '#e2453c' },
      infection: { name: 'INFECTION', dps: 0.35, color: '#9acd32' },
      burn: { name: 'BURNS', dps: 0.5, color: '#f08a24' },
      poison: { name: 'POISON', dps: 0.7, color: '#7fbf3f' },
      pain: { name: 'PAIN', speed: 0.88, color: '#c79bff' },
      eye: { name: 'EYE IRRITATION', blur: 0.45, color: '#7ec8ff' },
      respiratory: { name: 'RESPIRATORY', dps: 0.6, color: '#8fd6e8' },
      bloodloss: { name: 'BLOOD LOSS', dps: 0.9, speed: 0.82, color: '#d23b3b' },
      paranoia: { name: 'PARANOIA', color: '#b06cff' },
    };

    function addWound(type) {
      if (!WOUNDS[type]) return;
      if (type === 'infection' && vitals.infectionImmunity > 0) return;
      if (!(type in vitals.wounds)) vitals.wounds[type] = 0;
    }

    function cureWounds(types) {
      for (const t of types || []) delete vitals.wounds[t];
    }

    function hurt(amount, type) {
      if (WORLD_MODE === 'sandbox') {
        vitals.hp = vitals.maxHp;
        return;
      }
      if (!(amount > 0) || vitals.hp <= 0) return;
      if (type) addWound(type);
      if (amount >= 12) addWound('pain');
      vitals.hp = Math.max(0, vitals.hp - amount);
      if (vitals.hp <= 0) die();
    }

    function woundSpeed() {
      let m = 1;
      for (const t of Object.keys(vitals.wounds)) m *= WOUNDS[t]?.speed || 1;
      return m;
    }

    function updateVitals(dt) {
      if (WORLD_MODE === 'sandbox') {
        vitals.hp = vitals.maxHp;
        vitals.hunger = vitals.maxHunger;
        vitals.wounds = Object.create(null);
        vitals.infectionImmunity = 0;
        vitals.foodNumb = Object.create(null);
        const cap = ITEMS.fuel_carton.container?.capacity || 5;
        for (const g of [inv.hot, inv.main]) for (const s of g) if (s && s.id === 'fuel_carton' && (!s.liquid || s.liquid.amount < cap)) s.liquid = { id: 'gasoline', amount: cap };
        return;
      }

      vitals.hunger = Math.max(0, vitals.hunger - TUNING.HUNGER_DRAIN * dt);
      if (vitals.infectionImmunity > 0) vitals.infectionImmunity = Math.max(0, vitals.infectionImmunity - dt);
      for (const id of Object.keys(vitals.foodNumb)) {
        if (!Number.isFinite(vitals.foodNumb[id])) delete vitals.foodNumb[id];
        else if (vitals.foodNumb[id] >= 1.999) vitals.foodNumb[id] = 2;
      }

      let dps = 0;
      for (const t of Object.keys(vitals.wounds)) {
        const w = WOUNDS[t];
        if (!w) { delete vitals.wounds[t]; continue; }
        dps += w.dps || 0;
        vitals.wounds[t] += dt;

        if ((t === 'bleeding' || t === 'burn') && vitals.wounds[t] > 30 && Math.random() < dt * 0.02) addWound('infection');
      }
      if (dps) hurt(dps * dt, null);
      if (vitals.hunger <= 0) hurt(0.6 * dt, null);
      else if (!dps && vitals.hp < vitals.maxHp && vitals.hunger > 40) vitals.hp = Math.min(vitals.maxHp, vitals.hp + 0.6 * dt);
    }
    let invOpen = false;
    let cmdOpen = false;
    let timeLock = null;
    const workbenchUI = new WorkbenchUI();
    workbenchUI.dragDrop = new DragDrop({
      icon: (s) => itemIconUrl(s.id),
      count: (s) => s.n || 1,
      onChange: () => { syncBars(); workbenchUI.refresh(); },
    });
    const dragDrop = workbenchUI.dragDrop;


    function fillGasCarton(stack) {
      if (WORLD_MODE !== 'sandbox' || !stack || stack.id !== 'fuel_carton') return stack;
      stack.liquid = { id: 'gasoline', amount: (ITEMS.fuel_carton.container?.capacity || 5) };
      return stack;
    }
    function giveStack(stack) {
      if (!stack || !stack.id) return false;
      fillGasCarton(stack);
      for (const g of [inv.hot, inv.main]) {
        for (let i = 0; i < g.length; i++) if (!g[i]) { g[i] = stack; syncBars(); return true; }
      }
      return false;
    }







    const dayFrac0 = TUNING.DAY_FRACTION ?? 0.5;
    const START_TIMES = { dawn: 0, noon: 0.25, dusk: dayFrac0, night: dayFrac0 + (1 - dayFrac0) / 2 };
    const clock = { day: 1, t: (START_TIMES[WORLD_START] ?? 0) * TUNING.DAY_SECONDS };
    let nuclearStrikes = [];
    let lastNukeCheckDay = 0;
    let nukeRadMult = 1;
    const nukeFx = [];
    let playTime = 0;
    function formatPlayTime(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m ${s % 60}s`;
    }
    let prayReadyAt = 0;
    let guideIndex = 0;
    let guidePaintSig = '';
    let guideTick = 0;

    function freshAchievements() {
      return {
        mined: 0, placed: 0, crafted: 0, machines: 0, kills: 0,
        dosePeak: 0, research: 0, fuel: 0, walked: 0,
        chopped: 0, blasts: 0, harvested: 0,
        built: Object.create(null), started: Object.create(null),
      };
    }
    let ach = freshAchievements();
    let achTick = 0;
    let achPaintSig = '';
    let achLastPos = null;
    let achBuilt = false;
    let achSelected = null;
    let achieveOpen = false;
    let achUnlocked = -1;
    let starterUiTimer = 0;
    let armorShieldTimer = 0;
    let radIntakeTimer = 0;
    let radIntakeMult = 1;
    let radFreeT = 0;
    let smokeTime = 0;
    let smokeSpeed = 1;
    let wasInWaste = false;
    let fallPeak = 0;
    let machineSystem = null;
    let mapSystem = null;



    function ambientRad() {
      const tiers = Math.max(0, clock.day - TUNING.RAD_START_DAY + 1) / TUNING.RAD_RAMP_DAY;
      return tiers <= 0 ? 0 : TUNING.AMBIENT_BASE * Math.pow(tiers, TUNING.AMBIENT_EXP) * WORLD_FALLOUT;
    }



    function radSource() {
      return sourcePoint(WORLD_SEED, TUNING.RAD_SOURCE_DIST);
    }
    function radFactor(x, y, z) {
      return solidAt(world.field, x, y, z) ? RAD_OCCL.solid : 1;
    }



    function radTransmission(dx, dy, dz) {
      if (!world) return 1;
      const t = transmission(radFactor, player.pos.x, player.pos.y + 1, player.pos.z, dx, dy, dz);
      const w = buildingSystem ? buildingSystem.shadow(player.pos.x, player.pos.y + 1, player.pos.z, dx, dy, dz, RAD_OCCL.range) : 1;
      return Math.max(TUNING.RAD_OCCL_FLOOR, t * w);
    }

    function nukeStrikeActive() { return nuclearStrikes.length > 0; }
    function nukeStrikeExclusion(r) { return r + (TUNING.NUKE_GAP || 180); }
    function nukeSiteClear(x, z, r) {
      const ex = nukeStrikeExclusion(r);
      if (machineSystem) for (const m of machineSystem.instances) if (Math.hypot(m.x - x, m.z - z) < ex) return false;
      if (buildingSystem) for (const p of buildingSystem.pieces.values()) if (Math.hypot(p.x - x, p.z - z) < ex) return false;
      for (const s of nuclearStrikes) if (Math.hypot(s.x - x, s.z - z) < s.r + r + 40) return false;
      return true;
    }
    function findNukeSite() {
      const r = TUNING.NUKE_RADIUS || 28;
      const px = player.pos.x, pz = player.pos.z;
      for (let attempt = 0; attempt < 80; attempt++) {
        const dist = 320 + attempt * 18 + Math.random() * 420;
        const a = Math.random() * Math.PI * 2;
        const x = px + Math.cos(a) * dist;
        const z = pz + Math.sin(a) * dist;
        if (Math.hypot(x - px, z - pz) < 220) continue;
        if (nukeSiteClear(x, z, r)) return { x, z, r };
      }
      return null;
    }
    function carveNukeCrater(x, y, z, r) {
      const f = world.field;
      const minY = CHUNK_Y_MIN * CHUNK_SIZE + 2;
      const x0 = Math.floor(x - r), x1 = Math.ceil(x + r);
      const y0 = Math.max(minY, Math.floor(y - r)), y1 = Math.ceil(y + r * 0.45);
      const z0 = Math.floor(z - r), z1 = Math.ceil(z + r);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iy = y0; iy <= y1; iy++) {
          for (let iz = z0; iz <= z1; iz++) {
            const dx = ix - x, dy = (iy - y) * 1.15, dz = iz - z;
            if (dx * dx + dy * dy + dz * dz <= r * r) f.set(ix, iy, iz, -1);
          }
        }
      }
      world.markEdited(x0, x1, y0, y1, z0, z1);
    }
    function spawnNukeFx(x, y, z, r) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.frustumCulled = false;
      const mat = (color, opts = {}) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, fog: false, depthWrite: false, ...opts });
        return m;
      };
      const lambert = (color, opts = {}) => {
        const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1, fog: false, flatShading: true, ...opts });
        return m;
      };

      const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat(0xfff6c8, { blending: THREE.AdditiveBlending }));
      flash.scale.setScalar(r * 0.7);
      flash.position.y = r * 0.2;
      group.add(flash);

      const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat(0xff5a00, { blending: THREE.AdditiveBlending }));
      fire.scale.set(r * 0.55, r * 0.45, r * 0.55);
      fire.position.y = r * 0.15;
      group.add(fire);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.45, 1, 6, 1, true), lambert(0x5a5248));
      stem.position.y = r * 0.5;
      stem.scale.y = r * 0.8;
      group.add(stem);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), lambert(0x7a7268));
      cap.scale.set(r * 1.1, r * 0.55, r * 1.1);
      cap.position.y = r * 1.6;
      group.add(cap);

      const capTop = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), lambert(0x9a9288));
      capTop.scale.set(r * 0.75, r * 0.35, r * 0.75);
      capTop.position.y = r * 1.95;
      group.add(capTop);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.12, 5, 10), lambert(0x8a8072));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = r * 0.25;
      group.add(ring);

      const dust = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 1.4, r * 0.35, 8, 1, true), lambert(0xb8aa90));
      dust.position.y = r * 0.18;
      group.add(dust);

      group.traverse((o) => { o.frustumCulled = false; });
      scene.add(group);
      nukeFx.push({ group, x, y, z, r, age: 0, life: 90, parts: { flash, fire, stem, cap, capTop, ring, dust } });
    }

    function updateNukeFx(dt) {
      for (let i = nukeFx.length - 1; i >= 0; i--) {
        const fx = nukeFx[i];
        fx.age += dt;
        const t = fx.age;
        const r = fx.r;
        const p = fx.parts;
        const blast = Math.max(0, 1 - t / 2.8);
        const rise = Math.min(1, t / 6);
        const settle = Math.min(1, Math.max(0, (t - 8) / 25));
        const fade = t > fx.life - 12 ? Math.max(0, (fx.life - t) / 12) : 1;

        p.flash.scale.setScalar(r * (0.7 + (1 - blast) * 2.4));
        p.flash.material.opacity = blast * 0.95 * fade;
        p.flash.position.y = r * (0.2 + (1 - blast) * 0.4);

        p.fire.scale.set(r * (0.55 + (1 - blast) * 1.5), r * (0.45 + (1 - blast) * 1.2), r * (0.55 + (1 - blast) * 1.5));
        p.fire.material.opacity = blast * 0.85 * fade;
        p.fire.material.color.setHex(t < 0.8 ? 0xfff0a0 : t < 2 ? 0xff6a00 : 0xff3a00);
        p.fire.position.y = r * (0.15 + rise * 0.8);

        const stemH = r * (0.8 + rise * 5.5);
        p.stem.scale.set(1, stemH, 1);
        p.stem.position.y = stemH * 0.5;
        p.stem.material.opacity = (0.85 - settle * 0.35) * fade;
        p.stem.material.color.setHex(t < 3 ? 0x7a5a3a : 0x5a5248);

        const capY = r * (1.6 + rise * 5.2);
        const capS = 1 + rise * 1.8 + settle * 0.8;
        p.cap.position.y = capY;
        p.cap.scale.set(r * 1.1 * capS, r * 0.55 * capS, r * 1.1 * capS);
        p.cap.material.opacity = (0.88 - settle * 0.25) * fade;
        p.capTop.position.y = capY + r * 0.35 * capS;
        p.capTop.scale.set(r * 0.75 * capS, r * 0.35 * capS, r * 0.75 * capS);
        p.capTop.material.opacity = (0.82 - settle * 0.3) * fade;

        p.ring.scale.setScalar(1 + (1 - blast) * 3.5);
        p.ring.material.opacity = blast * 0.55 * fade;
        p.ring.position.y = r * (0.25 + (1 - blast) * 0.1);

        p.dust.scale.set(1 + (1 - blast) * 2.2, 1 + (1 - blast) * 0.8, 1 + (1 - blast) * 2.2);
        p.dust.material.opacity = blast * 0.45 * fade;

        if (t >= fx.life) {
          scene.remove(fx.group);
          fx.group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
          nukeFx.splice(i, 1);
        }
      }
    }

    let nukeBoomAudio = null;
    function playNukeBoom() {
      try {
        if (!nukeBoomAudio) {
          nukeBoomAudio = new Audio('assets/audio/nuke-explosion.mp3');
          nukeBoomAudio.preload = 'auto';
        }
        nukeBoomAudio.pause();
        nukeBoomAudio.currentTime = 0;
        nukeBoomAudio.volume = Math.max(0, Math.min(1, typeof masterVolume === 'number' ? masterVolume : 1));
        void nukeBoomAudio.play();
      } catch { }
    }

    function spawnNuclearStrike() {
      const site = findNukeSite();
      if (!site) return false;
      const ground = Math.ceil(terrainTrend(site.x + WORLD_SEED, site.z + WORLD_SEED));
      const y = world.surfaceY(site.x, site.z, ground + 30);
      carveNukeCrater(site.x, y, site.z, site.r);
      nuclearStrikes.push({ x: site.x, y, z: site.z, day: clock.day, r: site.r, radMult: nukeRadMult });
      nukeRadMult *= 1.5;
      shakeT = Math.max(shakeT, 2.5);
      playNukeBoom();
      spawnNukeFx(site.x, y, site.z, site.r);
      mapSystem?.noteStrike(site.x, site.z, clock.day, site.r);
      notice(`NUCLEAR STRIKE · ${Math.round(site.x)}, ${Math.round(site.z)} · SEEK COVER`);
      return true;
    }
    function maybeNuclearStrike() {
      if (clock.day <= 0) return;
      if (clock.day === lastNukeCheckDay) return;
      if (clock.day % (TUNING.NUKE_DAY_INTERVAL || 10) !== 0) return;
      lastNukeCheckDay = clock.day;
      if (Math.random() < (TUNING.NUKE_CHANCE ?? 0.5)) spawnNuclearStrike();
    }



    let _radField = null, _radFieldAt = -1e9;
    function radField() {
      const now = performance.now();
      if (_radField && now - _radFieldAt < 100) return _radField;
      _radFieldAt = now;
      const px = player.pos.x, py = player.pos.y + 1, pz = player.pos.z;

      const src = radSource();
      let dx = src.x - px, dz = src.z - pz;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;


      const surfY = world.surfaceY(px, pz, Math.ceil(terrainTrend(px + WORLD_SEED, pz + WORLD_SEED)) + 30);
      const depth = Math.max(0, surfY - py);
      const upRange = depth <= 0.5 ? 0 : Math.min(depth + 1, 48);
      const up = upRange
        ? transmission(radFactor, px, py, pz, 0, 1, 0, { samples: Math.ceil(upRange), range: upRange, solid: RAD_OCCL.solid })
        : 1;
      const built = upRange && buildingSystem ? buildingSystem.shadow(px, py, pz, 0, 1, 0, upRange) : 1;
      const burial = shaftBurial(depth, up, built);
      const ambient = ambientRad() * radTransmission(dx, 0, dz) * burial;

      let machine = 0, best = ambient, bx = dx, bz = dz, bdist = d;
      if (machineSystem) {
        for (const e of machineSystem.emitList) {
          const ex = e.x - px, ey = e.y - py, ez = e.z - pz;
          const ed = Math.hypot(ex, ey, ez);
          const r = e.rad / (1 + ed * ed * 0.25);
          if (r < 1e-4) continue;
          const k = 1 / (ed || 1);
          const ux = ex * k, uy = ey * k, uz = ez * k;
          const contrib = r * radTransmission(ux, uy, uz);
          machine += contrib;
          if (contrib > best) { best = contrib; bx = ux; bz = uz; bdist = ed; }
        }
      }
      for (const s of nuclearStrikes) {
        const ex = s.x - px, ey = (s.y + 1) - py, ez = s.z - pz;
        const ed = Math.hypot(ex, ey, ez);
        const r = (TUNING.NUKE_RAD || 500) * (s.radMult ?? 1) / (1 + ed * ed * 0.004);
        if (r < 1e-4) continue;
        const k = 1 / (ed || 1);
        const ux = ex * k, uy = ey * k, uz = ez * k;
        const contrib = r * radTransmission(ux, uy, uz);
        machine += contrib;
        if (contrib > best) { best = contrib; bx = ux; bz = uz; bdist = ed; }
      }
      _radField = { ambient, machine, dx: bx, dz: bz, dist: bdist };
      return _radField;
    }

    function radStage() {
      let stage = { name: 'SAFE', speed: 1, blur: 0, dark: 0 };
      for (const s of TUNING.RAD_STAGES) if (inv.dose >= s.at) stage = s;
      return stage;
    }
    function dayFrac() { return TUNING.DAY_FRACTION ?? 0.5; }
    function isDay() { return clock.t < TUNING.DAY_SECONDS * dayFrac(); }
    function sunCycleT() {
      const df = dayFrac();
      const f = (clock.t % TUNING.DAY_SECONDS) / TUNING.DAY_SECONDS;
      return f < df ? (f / df) * 0.5 : 0.5 + ((f - df) / (1 - df)) * 0.5;
    }


    const DAY_SKY = new THREE.Color(0x9ec9e8);
    const DUSK_SKY = new THREE.Color(0xd97a48);
    const NIGHT_SKY = new THREE.Color(0x070b17);
    const skyNow = new THREE.Color(DAY_SKY);
    let sunVis = 1;
    let moonVis = 0;

    function updateDaylight() {
      const a = sunCycleT() * Math.PI * 2;
      const elev = Math.sin(a);
      SUN_DIR.set(Math.cos(a) * 0.82, elev, 0.38 + Math.cos(a) * 0.22).normalize();


      const ma = (sunCycleT() + 0.44) * Math.PI * 2;
      MOON_DIR.set(Math.cos(ma) * 0.82, Math.sin(ma), 0.38 + Math.cos(ma) * 0.22).normalize();

      const day = Math.max(0, Math.min(1, elev * 2.2 + 0.12));
      const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (elev > -0.25 ? 1 : 0);

      skyNow.copy(NIGHT_SKY).lerp(DAY_SKY, day).lerp(DUSK_SKY, dusk * 0.5);
      sun.intensity = 1.35 * day;
      sun.color.copy(SUN_COL).lerp(DUSK_SKY, dusk * 0.6);
      sunDisc.material.color.copy(sun.color);
      sunGlow.material.color.copy(sun.color);
      sunHalo.material.color.copy(sun.color);
      hemi.intensity = 0.22 + 0.53 * day;
      hemi.color.copy(NIGHT_SKY).lerp(SKY_COL, day);
      fill.intensity = 0.10 + 0.08 * day;
      cloudUniforms.uDay.value = day;
      sunVis = Math.max(0, Math.min(1, elev * 8 + 0.15));



      const moonUp = Math.max(0, Math.min(1, (MOON_DIR.y - 0.02) * 6 + 0.15));
      moonVis = moonUp * (0.30 + 0.70 * (1 - day));
      moonLight.intensity = 0.16 * (1 - day) * moonUp;
      moonLight.color.setHex(0xaec4ff);
    }


    let noticeMsg = '', noticeT = 0;
    function notice(msg) { noticeMsg = msg; noticeT = 1.8; }

    const gainCard = document.getElementById('gainCard');
    let gainEvents = [];
    function showGain(id, n = 1, kind = 'PICKED UP') {
      if (!gainCard || !id || n <= 0) return;
      const now = performance.now();
      const last = gainEvents[gainEvents.length - 1];
      if (last && last.id === id && last.kind === kind && now - last.t < 1200) {
        last.n += n;
        last.t = now;
      } else {
        gainEvents.push({ id, n, kind, t: now });
        if (gainEvents.length > 4) gainEvents.shift();
      }
      paintGainCard(now);
    }
    let _gainCardKey = '';
    function paintGainCard(now = performance.now()) {
      if (!gainCard) return;
      gainEvents = gainEvents.filter((e) => now - e.t < 2200);
      if (!gainEvents.length) {
        if (_gainCardKey) { gainCard.classList.remove('show'); gainCard.innerHTML = ''; _gainCardKey = ''; }
        return;
      }
      const e = gainEvents[gainEvents.length - 1];
      const key = e.t + ':' + e.kind + ':' + e.id + ':' + e.n;
      if (key === _gainCardKey) return;
      const name = ITEMS[e.id]?.name || e.id;
      gainCard.innerHTML = `<span class="gk">${e.kind}</span><span class="gi">+${e.n} ${name}</span>`;
      gainCard.classList.add('show');
      _gainCardKey = key;
    }
    function hasGardeningGloves() {
      const g = inv.armor.hands;
      return !!(g && ITEMS[g.id]?.armor?.gardening);
    }
    function hasLighter() {
      return [inv.hot, inv.main].some((g) => g.some((s) => s && s.id === 'lighter'));
    }

    function give(id, n = 1) {
      const def = ITEMS[id];
      if (!def) return n;
      const grids = [inv.hot, inv.main];
      for (const g of grids)
        for (let i = 0; i < g.length && n > 0; i++) {
          const s = g[i];
          if (s && s.id === id && s.n < def.stack) {
            const take = Math.min(n, def.stack - s.n);
            s.n += take; n -= take;
            fillGasCarton(s);
          }
        }
      for (const g of grids)
        for (let i = 0; i < g.length && n > 0; i++) {
          if (!g[i]) {
            const take = Math.min(n, def.stack);
            g[i] = fillGasCarton({ id, n: take }); n -= take;
          }
        }
      syncBars();
      return n;
    }

    function heldTool() {
      const s = inv.hot[inv.sel];
      return (s && ITEMS[s.id].tool) || BARE_HANDS;
    }

    function allSlots() { return inv.hot.concat(inv.main); }








    const TOOL_MODELS = {
      pick:    { dir: 'assets/models/tools/pickaxe/', obj: 'Pickaxe', len: 1.02, swing: { x: 0.95, y: 0.20, z: 0.55, reach: 0.24, dur: 0.46 } },
      shovel:  { dir: 'assets/models/tools/shovel/',  obj: 'Shovel',  len: 1.10, swing: { x: 0.30, y: 0.05, z: 0.05, reach: 0.24 } },
      axe:     { dir: 'assets/models/tools/axe/',     obj: 'Axe',     len: 1.00, swing: { poseWind: 24, poseStrike: -46, dur: 0.44 } },
      hatchet: { dir: 'assets/models/tools/hatchet/', obj: 'Hatchet', len: 0.82, swing: { poseWind: 20, poseStrike: -38, dur: 0.40 } },
      hoe:     { dir: 'assets/models/tools/hoe/',     obj: 'Hoe',     len: 1.04, swing: { x: 0.55, y: 0.14, z: 0.10, reach: 0.12 } },
      fast_ar: { dir: 'assets/models/tools/fast_ar/', obj: 'fast_ar', len: 1.05, swing: { x: 0.16, y: 0.03, z: 0.04, reach: 0.04 } },
      smg:     { dir: 'assets/models/tools/smg/',     obj: 'smg',     len: 0.95, swing: { x: 0.14, y: 0.03, z: 0.04, reach: 0.04 } },
    };



    const toolPosesPromise = fetch('assets/tool-poses.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));

    const viewScene = new THREE.Scene();
    const viewCam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.01, 10);
    viewScene.add(new THREE.HemisphereLight(0xdceaff, 0x3a342c, 1.0));
    {
      const key = new THREE.DirectionalLight(0xfff2dd, 1.25);
      key.position.copy(SUN_DIR).multiplyScalar(6);
      viewScene.add(key);
      const rim = new THREE.DirectionalLight(0x88aaff, 0.35);
      rim.position.set(-3, 1, 3);
      viewScene.add(rim);
    }

    const vmRig = new THREE.Group();
    const vmSwing = new THREE.Group();
    vmRig.add(vmSwing);
    viewScene.add(vmRig);

    const vmModels = new Map();
    const vmLoading = new Set();


    function orientTool(root, cfg, pose) {      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const length = Math.max(1e-3, size.z);
      const cx = (box.min.x + box.max.x) * 0.5;
      const cy = (box.min.y + box.max.y) * 0.5;
      const gripZ = box.min.z + length * 0.16;

      const inner = new THREE.Group();
      inner.add(root);
      inner.position.set(-cx, -cy, -gripZ);


      const poseGrp = new THREE.Group();
      poseGrp.add(inner);
      const rot = (pose && pose.rot) || {};
      poseGrp.rotation.set(
        THREE.MathUtils.degToRad(rot.x || 0),
        THREE.MathUtils.degToRad(rot.y || 0),
        THREE.MathUtils.degToRad(rot.z || 0)
      );
      poseGrp.userData.restRotX = poseGrp.rotation.x;

      const oriented = new THREE.Group();
      oriented.add(poseGrp);
      oriented.userData.poseGrp = poseGrp;
      oriented.rotation.y = Math.PI;
      oriented.scale.setScalar(cfg.len / length);
      const pos = (pose && pose.pos) || {};
      oriented.position.set(pos.x || 0, pos.y || 0, pos.z || 0);
      return oriented;
    }

    function loadToolModel(id) {
      if (vmModels.has(id) || vmLoading.has(id)) return;
      const cfg = TOOL_MODELS[id];
      if (!cfg) return;
      vmLoading.add(id);
      (async () => {
        const mats = await new MTLLoader().setPath(cfg.dir).loadAsync(cfg.obj + '.mtl');
        mats.preload();
        const root = await new OBJLoader().setMaterials(mats).setPath(cfg.dir).loadAsync(cfg.obj + '.obj');
        const poses = await toolPosesPromise;
        const oriented = orientTool(root, cfg, poses[id]);
        oriented.visible = false;
        vmSwing.add(oriented);
        vmModels.set(id, oriented);
        if (vm.item === id) { vm.model = oriented; oriented.visible = true; vm.equipT = 0; }
      })().catch((e) => console.warn('tool model failed', id, e))
        .finally(() => vmLoading.delete(id));
    }


    function orientProp(root, target) {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      const inner = new THREE.Group();
      inner.add(root);
      inner.position.copy(centre).multiplyScalar(-1);
      const oriented = new THREE.Group();
      oriented.add(inner);
      oriented.scale.setScalar(target / Math.max(size.x, size.y, size.z, 1e-3));
      return oriented;
    }



    const vmPropGroup = new THREE.Group();
    vmRig.add(vmPropGroup);
    const propModels = new Map();
    const propLoading = new Set();
    const PROP_POS = new THREE.Vector3(0, -0.22, -0.55);
    const PROP_SIZE = 0.32;
    let propAngle = 0;
    let propItem = null;



    const vmHeld = new THREE.Group();
    vmHeld.visible = false;
    vmRig.add(vmHeld);
    const heldIconGeo = new THREE.PlaneGeometry(1, 1);
    const heldIconTex = new Map();

    const heldIconU = {
      uMap: { value: null },
      uCut: { value: 1.2 },
      uSeed: { value: 0 },
    };
    const heldIconMesh = new THREE.Mesh(heldIconGeo, new THREE.ShaderMaterial({
      uniforms: heldIconU,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap;
        uniform float uCut;
        uniform float uSeed;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uMap, vUv);
          // Blocky hash + a wobble so the cut is chewed, not a straight slice.
          float jag = fract(sin(dot(floor(vUv * vec2(37.0, 19.0)), vec2(12.9898, 78.233)) + uSeed) * 43758.5453) - 0.5;
          float edge = uCut + jag * 0.14 + 0.03 * sin(vUv.x * 43.0 + uSeed * 2.7);
          if (c.a < 0.05 || vUv.y > edge) discard;
          gl_FragColor = c;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    heldIconMesh.scale.setScalar(0.34);
    vmHeld.add(heldIconMesh);
    let heldIconItem = null;
    let heldIconBob = 0;

    function heldIconTexture(id) {
      if (heldIconTex.has(id)) return heldIconTex.get(id);
      const url = itemIconUrl(id);
      if (!url) return null;
      const tex = new THREE.TextureLoader().load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      heldIconTex.set(id, tex);
      return tex;
    }

    function showHeldIcon(id, dt) {
      if (id === 'flashlight') return;
      const tex = heldIconTexture(id);
      if (!tex) return;
      if (heldIconItem !== id) {
        heldIconItem = id;
        heldIconBob = 0;
        heldIconU.uMap.value = tex;
      }
      const speed = Math.hypot(player.vel.x, player.vel.z);
      heldIconBob += dt * (speed > 0.3 ? 6.0 + speed * 0.7 : 1.6);
      const bob = Math.sin(heldIconBob) * (0.006 + Math.min(speed, 9) * 0.0025);
      const sway = Math.sin(heldIconBob * 0.5) * 0.0035;
      vmHeld.visible = true;
      vmHeld.position.set(sway, -0.17 + bob, -0.50);
      vmHeld.rotation.set(0.14, 0, 0);
    }

    function propModelUrl(id) {
      if (id === 'flashlight') return null;
      if (TOOL_MODELS[id]) return null;


      if (modelIconTried(id) && !cachedModelIcon(id)) return null;
      return itemModelIcon(id);
    }

    function loadPropModel(id) {
      if (propModels.has(id) || propLoading.has(id)) return;
      propLoading.add(id);
      new GLTFLoader().load(propModelUrl(id), (gltf) => {
        const tint = modelTint(id);
        if (tint) tintModel(gltf.scene, tint);
        const oriented = orientProp(gltf.scene, PROP_SIZE);
        oriented.visible = false;
        vmPropGroup.add(oriented);
        propModels.set(id, oriented);
        propLoading.delete(id);
      }, undefined, (e) => { console.warn('prop model failed', id, e); propLoading.delete(id); });
    }

    const vm = {
      item: null, model: null,
      swingT: 1e9, swingDur: 0.3,
      equipT: 1e9,
      _lastHeld: null,
      bob: 0, swayX: 0, swayY: 0,
      prevYaw: null, prevPitch: null,
    };


    const VM_REST_POS = new THREE.Vector3(0.30, -0.30, -0.52);
    const VM_REST_ROT = new THREE.Euler(0.22, 0.34, -0.10);





    const vmDrink = new THREE.Group();
    vmRig.add(vmDrink);
    const drinkModels = {};
    let drink = null;

    function loadDrinkModels() {
      if (drinkModels.unopened) return;
      const files = { unopened: 'cup_noodles', open: 'cup_noodles_open', empty: 'cup_noodles_empty' };
      const loader = new GLTFLoader();
      for (const [stage, file] of Object.entries(files)) {
        loader.load(`assets/models/items/${file}.glb`, (gltf) => {
          const holder = new THREE.Group();
          holder.add(orientProp(gltf.scene, 0.22));
          holder.visible = false;
          vmDrink.add(holder);
          drinkModels[stage] = holder;
        }, undefined, (e) => console.warn('drink model failed', stage, e));
      }
    }

    function startDrink() {
      loadDrinkModels();
      drink = { t: 0 };
    }

    function endDrink() {
      drink = null;
      for (const h of Object.values(drinkModels)) h.visible = false;
    }





    const EAT_TIME = 1.4;
    const EAT_REST = { x: 0.02, y: -0.15, z: -0.50 };
    let eat = null;

    function stopEat() {
      eat = null;
      heldIconU.uCut.value = 1.2;
      vmHeld.visible = false;
    }

    function startEat(s, def) {
      const tex = heldIconTexture(s.id);
      if (tex) { heldIconU.uMap.value = tex; heldIconItem = s.id; }
      eat = { id: s.id, stack: s, def, t: 0 };
      heldIconU.uSeed.value = Math.random() * 100;
      heldIconU.uCut.value = 1.15;
    }

    function updateEat(dt) {
      eat.t += dt;
      const show = !invOpen && !workbenchUI.opened && locked
        && inv.hot[inv.sel] === eat.stack && heldIconItem === eat.id;
      vmRig.visible = show;
      vmRig.position.set(0, 0, 0);
      vmRig.rotation.set(0, 0, 0);
      vmHeld.visible = show;
      for (const m of propModels.values()) m.visible = false;
      if (!show) { stopEat(); return; }
      const u = Math.min(1, eat.t / EAT_TIME);
      heldIconU.uCut.value = 1.15 - u * 1.3;
      const nibble = Math.sin(eat.t * 9) * 0.004 * u;
      vmHeld.position.set(EAT_REST.x + nibble, EAT_REST.y + Math.sin(eat.t * 4) * 0.004, EAT_REST.z);
      vmHeld.rotation.set(0.22 + u * 0.35, 0, -0.08 + Math.sin(eat.t * 3.5) * 0.05 * u);
      if (eat.t >= EAT_TIME) {
        const e = eat;
        stopEat();
        applyConsumable(e.stack, e.def);
      }
    }


    const DRINK_T1 = 0.30, DRINK_T2 = 0.55, DRINK_T3 = 1.85, DRINK_T4 = 2.15, DRINK_T5 = 2.45;
    const DRINK_REST = { x: 0.26, y: -0.32, z: -0.50 };
    const DRINK_CHUG = { x: 0.04, y: -0.04, z: -0.24 };

    function updateDrink(dt) {
      drink.t += dt;
      const t = drink.t;
      vmRig.visible = !invOpen && !workbenchUI.opened && locked;
      vmHeld.visible = false;
      for (const h of propModels.values()) h.visible = false;
      if (t >= DRINK_T5 || !vmRig.visible) { endDrink(); return; }

      const stage = t < DRINK_T2 ? 'unopened' : t < DRINK_T4 ? 'open' : 'empty';
      for (const h of Object.values(drinkModels)) h.visible = false;

      let x = DRINK_REST.x, y = DRINK_REST.y, z = DRINK_REST.z;
      let rotX = 0.10, rotZ = -0.10, scale = 1;

      if (t < DRINK_T1) {
        const u = t / DRINK_T1;
        y = DRINK_REST.y - (1 - u) * 0.25;
      } else if (t < DRINK_T2) {
        const u = (t - DRINK_T1) / (DRINK_T2 - DRINK_T1);
        x = DRINK_REST.x + Math.sin(u * Math.PI) * 0.03;
        rotX = 0.10 + Math.sin(u * Math.PI) * 0.12;
      } else if (t < DRINK_T3) {
        const u = (t - DRINK_T2) / (DRINK_T3 - DRINK_T2);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        x = DRINK_REST.x + (DRINK_CHUG.x - DRINK_REST.x) * e;
        y = DRINK_REST.y + (DRINK_CHUG.y - DRINK_REST.y) * e;
        z = DRINK_REST.z + (DRINK_CHUG.z - DRINK_REST.z) * e;
        rotX = 0.10 + e * 1.35 + Math.sin(u * Math.PI * 6) * 0.05 * e;
        rotZ = -0.10 * (1 - e);
      } else if (t < DRINK_T4) {
        const u = (t - DRINK_T3) / (DRINK_T4 - DRINK_T3);
        x = DRINK_CHUG.x + (DRINK_REST.x - DRINK_CHUG.x) * u;
        y = DRINK_CHUG.y + (DRINK_REST.y - DRINK_CHUG.y) * u;
        z = DRINK_CHUG.z + (DRINK_REST.z - DRINK_CHUG.z) * u;
        rotX = 1.45 + (0.10 - 1.45) * u;
        rotZ = -0.10 * u;
      } else {
        const u = (t - DRINK_T4) / (DRINK_T5 - DRINK_T4);
        y = DRINK_REST.y - u * 0.35;
        rotX = 0.10 + u * 0.6;
        scale = Math.max(0, 1 - u);
      }

      const holder = drinkModels[stage];
      if (!holder) return;
      holder.visible = true;
      holder.position.set(x, y, z);
      holder.rotation.set(rotX, 0, rotZ);
      holder.scale.setScalar(scale);
    }



    function vmSwingLift(p) {
      if (p < 0.34) { const u = p / 0.34; return 1 - Math.pow(1 - u, 2.2); }
      if (p < 0.62) { const u = (p - 0.34) / 0.28; const s = u * u * (3 - 2 * u); return 1 - 2.15 * s; }
      const u = (p - 0.62) / 0.38;
      const e = 1 - Math.pow(1 - u, 3);
      return -1.15 * (1 - e) + Math.sin(u * Math.PI * 2) * (1 - u) * 0.16;
    }

    function vmSwingReach(p) {
      if (p < 0.34) return -0.28 * (p / 0.34);
      if (p < 0.62) { const u = (p - 0.34) / 0.28; const s = u * u * (3 - 2 * u); return -0.28 + 1.38 * s; }
      const u = (p - 0.62) / 0.38;
      const e = 1 - Math.pow(1 - u, 3);
      return 1.10 * (1 - e);
    }

    const TREE_CHOP_SOUND = 'assets/audio/axe-hit.mp3';
    let treeChopSound = null;

    function playTreeChopSound() {
      if (!TREE_CHOP_SOUND) return;
      if (!treeChopSound) {
        treeChopSound = new Audio(TREE_CHOP_SOUND);
        treeChopSound.preload = 'auto';
      }
      try {
        treeChopSound.volume = 0.75 * masterVolume;
        treeChopSound.currentTime = 0;
        treeChopSound.play().catch(() => {});
      } catch (e) {

      }
    }

    function triggerSwing(dur) {
      const cfg = (TOOL_MODELS[vm.item] || {}).swing;
      vm.swingDur = (cfg && cfg.dur) || THREE.MathUtils.clamp(dur || 0.3, 0.22, 0.6);
      vm.swingT = 0;
    }

    function heldFlashlight() {
      const s = inv.hot[inv.sel];
      const id = replayHeld ? replayHeld.id : (s ? s.id : null);
      const ok = !invOpen && !workbenchUI.opened && (locked || !!replayHeld);
      return !!(id && ITEMS[id]?.tool?.flashlight && ok);
    }

    function updateViewmodel(dt) {
      if (eat) { updateEat(dt); return; }
      if (drink) { updateDrink(dt); return; }

      const s = inv.hot[inv.sel];

      const held = replayHeld ? replayHeld.id : (s ? s.id : null);
      const showingHeld = !!(held && !invOpen && !workbenchUI.opened && (locked || !!replayHeld));
      if (showingHeld !== !!vm._showingHeld || held !== vm._lastHeld) {
        vm._showingHeld = showingHeld;
        if (held !== vm._lastHeld) { vm._lastHeld = held; if (showingHeld) vm.equipT = 0; }
        else if (showingHeld) vm.equipT = 0;
      }
      vmHeld.visible = false;
      flashlightLight.visible = heldFlashlight();
      if (flashlightLight.visible) {
        flashlightLight.intensity = 18;
        flashlightLight.distance = 270;
        flashlightLight.decay = 1;
        flashlightLight.angle = Math.PI / 7;
        flashlightLight.penumbra = 0.18;
      }

      let equipDrop = 0, equipRot = 0;
      if (vm.equipT < 1e8) {
        vm.equipT += dt / 0.35;
        const e = Math.min(1, vm.equipT);
        const ease = 1 - Math.pow(1 - e, 3);
        equipDrop = -(1 - ease) * 1.15;
        equipRot = -(1 - ease) * 0.18;
        if (e >= 1) vm.equipT = 1e9;
      }

      if (held && propModelUrl(held)) {
        if (propItem !== held) { propItem = held; loadPropModel(held); }
        if (vm.model) { vm.model.visible = false; vm.model = null; vm.item = null; }
        const show = !invOpen && !workbenchUI.opened && (locked || !!replayHeld) && !drive;
        vmRig.visible = show;
        if (!show) return;
        for (const m of propModels.values()) m.visible = false;
        const model = propModels.get(held);
        if (!model) {
          vmRig.position.set(0, equipDrop, 0);
          vmRig.rotation.set(equipRot * 0.4, 0, 0);
          showHeldIcon(held, dt);
          return;
        }
        const speed = Math.hypot(player.vel.x, player.vel.z);
        vm.bob += dt * (speed > 0.3 ? 6.0 + speed * 0.7 : 1.6);
        const bob = Math.sin(vm.bob) * (0.004 + Math.min(speed, 9) * 0.002);
        propAngle += dt * 0.55;
        model.visible = true;
        model.position.set(PROP_POS.x, PROP_POS.y + bob, PROP_POS.z);
        model.rotation.set(0.12, propAngle, 0);
        vmRig.position.set(0, equipDrop, 0);
        vmRig.rotation.set(equipRot * 0.4, 0, 0);
        return;
      }
      if (propItem) { const m = propModels.get(propItem); if (m) m.visible = false; propItem = null; }

      const id = s && TOOL_MODELS[s.id] ? s.id : null;

      if (id !== vm.item) {
        vm.item = id;
        if (vm.model) vm.model.visible = false;
        vm.model = null;
        if (id) {
          loadToolModel(id);
          if (vmModels.has(id)) {
            vm.model = vmModels.get(id);
            vm.model.visible = true;
            vm.equipT = 0;
          }
        }
      }

      vmRig.visible = !!vm.model && !invOpen && !workbenchUI.opened && locked && !drive;
      if (!vm.model) {
        if (s && ITEMS[s.id] && !TOOL_MODELS[s.id] && !invOpen && !workbenchUI.opened && locked && !drive) {
          vmRig.visible = true;
          vmRig.position.set(0, equipDrop, 0);
          vmRig.rotation.set(equipRot * 0.4, 0, 0);
          showHeldIcon(s.id, dt);
        }
        return;
      }


      const speed = Math.hypot(player.vel.x, player.vel.z);
      vm.bob += dt * (speed > 0.3 ? 6.0 + speed * 0.7 : 1.6);
      const amp = 0.004 + Math.min(speed, 9) * 0.0022;
      const bobY = Math.sin(vm.bob) * amp;
      const bobX = Math.sin(vm.bob * 0.5) * amp * 0.9;


      let dyaw = 0, dpitch = 0;
      if (vm.prevYaw !== null) {
        dyaw = THREE.MathUtils.clamp(player.yaw - vm.prevYaw, -0.2, 0.2);
        dpitch = THREE.MathUtils.clamp(player.pitch - vm.prevPitch, -0.2, 0.2);
      }
      vm.prevYaw = player.yaw; vm.prevPitch = player.pitch;
      const k = Math.min(1, dt * 9);
      vm.swayX += (-dyaw * 0.55 - vm.swayX) * k;
      vm.swayY += (dpitch * 0.45 - vm.swayY) * k;


      const swingCfg = (TOOL_MODELS[vm.item] || {}).swing || { x: 0.62, y: 0.10, z: 0.07, reach: 0.10 };
      const poseGrp = vm.model.userData.poseGrp;
      const restRotX = poseGrp ? poseGrp.userData.restRotX : 0;
      let lift = 0, lag = 0, reach = 0, poseX = null;
      if (vm.swingT < 1e8) {
        vm.swingT += dt;
        const p = vm.swingT / vm.swingDur;
        if (p >= 1) vm.swingT = 1e9;
        else if (swingCfg.poseWind != null && swingCfg.poseStrike != null && poseGrp) {
          const wind = restRotX + THREE.MathUtils.degToRad(swingCfg.poseWind);
          const strike = restRotX + THREE.MathUtils.degToRad(swingCfg.poseStrike);
          if (p < 0.32) {
            const u = p / 0.32;
            const e = 1 - Math.pow(1 - u, 2);
            poseX = restRotX + (wind - restRotX) * e;
          } else if (p < 0.58) {
            const u = (p - 0.32) / 0.26;
            const e = u * u * (3 - 2 * u);
            poseX = wind + (strike - wind) * e;
          } else {
            const u = (p - 0.58) / 0.42;
            const e = 1 - Math.pow(1 - u, 3);
            poseX = strike + (restRotX - strike) * e;
          }
        } else if (swingCfg.toX != null && poseGrp) {
          const to = THREE.MathUtils.degToRad(swingCfg.toX);
          poseX = restRotX + (to - restRotX) * Math.sin(p * Math.PI);
        } else {
          lift = vmSwingLift(p);
          lag = vmSwingLift(Math.max(0, p - 0.05));
          reach = vmSwingReach(p);
        }
      }
      if (poseGrp) poseGrp.rotation.x = poseX == null ? restRotX : poseX;


      const idle = Math.sin(vm.bob * 0.5) * 0.006;

      vmRig.position.set(
        VM_REST_POS.x + bobX + vm.swayX - reach * (swingCfg.reach || 0) * 0.35,
        VM_REST_POS.y + bobY + vm.swayY + equipDrop - reach * (swingCfg.reach || 0) * 0.30,
        VM_REST_POS.z - reach * (swingCfg.reach || 0)
      );

      vmSwing.rotation.set(
        VM_REST_ROT.x + lift * (swingCfg.x || 0) + equipRot + idle * 0.4,
        VM_REST_ROT.y + lag * (swingCfg.y || 0) + idle,
        VM_REST_ROT.z + lag * (swingCfg.z || 0)
      );
    }






    const torches = [];
    const TORCH_MAX = 64;
    const _tn = new THREE.Vector3(0, 1, 0);
  const DEFAULT_LIGHT = { mount: 'wall', range: 9, power: 0.7, color: 0xff7a1a };
  const torchStickGeo = new THREE.BoxGeometry(0.09, 0.5, 0.09);
  const torchStickMat = new THREE.MeshLambertMaterial({ color: 0x4a2f18 });
  const torchFlameGeo = new THREE.SphereGeometry(0.11, 8, 6);
  const torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    let torchTemplate = null;





    const TORCH_LIGHTS = 8;
    const TORCH_LIGHT_GAIN = 16;
    const torchLights = Array.from({ length: TORCH_LIGHTS }, () => {
      const l = new THREE.PointLight(0xffffff, 0, 9, 2);
      l.position.set(0, -999, 0);
      scene.add(l);
      return l;
    });







    const world = new World(scene);
    const farTerrain = new FarTerrainRenderer(scene, world.farBiomeTextures, world.stoneTexture, world);










    const VEG_DIR = 'assets/models/trees/';
    const _vegLoader = new GLTFLoader();
    const _fbxLoader = new FBXLoader();
    const _up = new THREE.Vector3(0, 1, 0);
    const _v = new THREE.Vector3(), _sc = new THREE.Vector3();
    const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();





    const _vegWhite = new THREE.Color(1, 1, 1);
    const VEG_BIOME_TINT = new Map([[B.SAVANNA, new THREE.Color(...vegTint('savanna'))]]);


    const VEG_LAYERS = {
      canopy: { cell: 6.0, size: 1.5, fill: { [B.FOREST]: 0.75, [B.JUNGLE]: 0.80, [B.PLAINS]: 0.16, [B.SAVANNA]: 0.16, [B.TUNDRA]: 0.28, [B.SNOWY_PEAKS]: 0.12, [B.WASTELAND]: 0.35 } },
      ground: { cell: 2.0, size: 1.0, fill: { [B.FOREST]: 0.62, [B.JUNGLE]: 0.60, [B.PLAINS]: 0.72, [B.SAVANNA]: 0.55, [B.TUNDRA]: 0.30, [B.SNOWY_PEAKS]: 0.10, [B.WASTELAND]: 0.30, [B.BEACH]: 0.05 } },
      cover: { cell: 3.0, size: 1.2, fill: { [B.FOREST]: 0.55, [B.JUNGLE]: 0.60, [B.PLAINS]: 0.38, [B.SAVANNA]: 0.26, [B.TUNDRA]: 0.30, [B.SNOWY_PEAKS]: 0.14, [B.WASTELAND]: 0.08 } },
      floor: { cell: 2.0, size: 1.0, fill: { [B.FOREST]: 0.50, [B.PLAINS]: 0.32, [B.JUNGLE]: 0.46, [B.SAVANNA]: 0.30, [B.TUNDRA]: 0.24 } },
      // 1.2 m still reads as a flower field; 0.72 m made ~14k cells a 48 m radius.
      flowers: { cell: 1.2, size: 1.0, fill: { [B.FLOWER_PLAINS]: 1.0, [B.PLAINS]: 0.35, [B.FOREST]: 0.28 } },
      aquatic: { cell: 3.0, size: 1.0, fill: { [B.SHALLOW]: 0.50, [B.BEACH]: 0.40, [B.OCEAN]: 0.06 } },
    };




    const VEG_SPECIES = [


      { n: 'tree01', dir: 'assets/models/ps1/', file: 'tree01.glb', norm: true, layer: 'canopy', dist: 64, scale: [6.5, 9.5], sink: 0.25, slope: 0.55, trunk: true, align: 'upright', weights: { [B.FOREST]: 2.2, [B.PLAINS]: 0.7, [B.SAVANNA]: 0.5 } },
      { n: 'tree02', dir: 'assets/models/ps1/', file: 'tree02.glb', norm: true, layer: 'canopy', dist: 60, scale: [6.0, 9.0], sink: 0.25, slope: 0.55, trunk: true, align: 'upright', weights: { [B.SAVANNA]: 2.0 } },
      { n: 'tree03', dir: 'assets/models/ps1/', file: 'tree03.glb', norm: true, layer: 'canopy', dist: 58, scale: [5.0, 8.0], sink: 0.20, slope: 0.55, trunk: true, align: 'upright', weights: { [B.SAVANNA]: 2.0 } },
      { n: 'tree05', dir: 'assets/models/ps1/', file: 'tree05.glb', norm: true, layer: 'canopy', dist: 56, scale: [5.0, 7.5], sink: 0.20, slope: 0.55, trunk: true, align: 'upright', weights: { [B.FOREST]: 1.2, [B.TUNDRA]: 1.0, [B.PLAINS]: 0.5 } },
      { n: 'tree06', dir: 'assets/models/ps1/', file: 'tree06.glb', norm: true, layer: 'canopy', dist: 62, scale: [6.5, 9.5], sink: 0.25, slope: 0.55, trunk: true, align: 'upright', litter: 5, weights: { [B.FOREST]: 1.6, [B.JUNGLE]: 2.2 } },
      { n: 'tree07', dir: 'assets/models/ps1/', file: 'tree07.glb', norm: true, layer: 'canopy', dist: 60, scale: [6.5, 9.5], sink: 0.25, slope: 0.55, trunk: true, align: 'upright', litter: 5, weights: { [B.SAVANNA]: 2.0 } },
      { n: 'tree08', dir: 'assets/models/ps1/', file: 'tree08.glb', norm: true, layer: 'canopy', dist: 66, scale: [7.0, 10.0], sink: 0.30, slope: 0.55, trunk: true, align: 'upright', litter: 5, weights: { [B.FOREST]: 2.4, [B.PLAINS]: 0.6 } },
      { n: 'dead_tree_rt_1', dir: 'assets/models/ps1/', file: 'dead_tree_rt_1.glb', norm: true, layer: 'canopy', dist: 60, scale: [5.5, 8.5], sink: 0.25, slope: 0.50, trunk: true, align: 'upright', weights: { [B.WASTELAND]: 2.5 } },
      { n: 'dead_tree_rt_2', dir: 'assets/models/ps1/', file: 'dead_tree_rt_2.glb', norm: true, layer: 'canopy', dist: 60, scale: [4.5, 7.0], sink: 0.25, slope: 0.50, trunk: true, align: 'upright', weights: { [B.WASTELAND]: 2.0 } },

      { n: 'grass_tall', layer: 'ground', tex: 'assets/images/vegetation/grass_tall.png', dist: 34, scale: [1.1, 1.8], sink: 0.05, slope: 0.55, trunk: false, align: 'upright', pickup: { itemId: 'herb', count: 1 }, weights: { [B.PLAINS]: 2.5, [B.FOREST]: 1.6, [B.JUNGLE]: 0.8, [B.SAVANNA]: 0.8 } },
      { n: 'grass_weeds', layer: 'ground', tex: 'assets/images/vegetation/grass_weeds.png', dist: 32, scale: [0.8, 1.5], sink: 0.04, slope: 0.55, trunk: false, align: 'upright', pickup: { itemId: 'herb', count: 1 }, weights: { [B.PLAINS]: 1.6, [B.FOREST]: 1.0, [B.SAVANNA]: 0.6 } },
      { n: 'plant03', layer: 'ground', tex: 'assets/images/vegetation/plant03.png', dist: 30, scale: [0.5, 1.0], sink: 0.03, slope: 0.50, trunk: false, align: 'upright', pickup: { itemId: 'flower', count: 1 }, weights: { [B.PLAINS]: 1.0, [B.FOREST]: 0.9, [B.JUNGLE]: 0.6 } },
      { n: 'plant05', layer: 'ground', tex: 'assets/images/vegetation/plant05.png', dist: 30, scale: [0.6, 1.1], sink: 0.03, slope: 0.50, trunk: false, align: 'upright', pickup: { itemId: 'flower', count: 1 }, weights: { [B.PLAINS]: 0.9, [B.FOREST]: 0.7, [B.SAVANNA]: 0.8 } },
      { n: 'savanna_grass', layer: 'ground', tex: 'assets/images/vegetation/savanna_grass.png', dist: 34, scale: [0.7, 1.2], sink: 0.04, slope: 0.55, trunk: false, align: 'upright', pickup: { itemId: 'herb', count: 1 }, weights: { [B.SAVANNA]: 3.0 } },
      { n: 'tall_flower', layer: 'ground', tex: 'assets/images/vegetation/tall_flower.png', dist: 34, scale: [0.8, 1.4], sink: 0.04, slope: 0.50, trunk: false, align: 'upright', pickup: { itemId: 'flower', count: 1 }, weights: { [B.PLAINS]: 1.2, [B.SAVANNA]: 1.0, [B.FOREST]: 0.5 } },
      { n: 'wasteland_grass', layer: 'ground', tex: 'assets/images/vegetation/wasteland_grass.png', dist: 32, scale: [0.8, 1.5], sink: 0.04, slope: 0.50, trunk: false, align: 'upright', pickup: { itemId: 'herb', count: 1 }, weights: { [B.WASTELAND]: 3.0 } },
      { n: 'Baby_Bamboo_2', layer: 'cover', dist: 32, scale: [0.60, 1.70], sink: 0.03, slope: 0.40, trunk: false, align: 'surface', weights: { [B.JUNGLE]: 2.5, [B.FOREST]: 0.5 } },
      { n: 'MH_Fern01_01', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 1, [B.PLAINS]: 0.8, [B.SAVANNA]: 0.6 } },
      { n: 'MH_Fern01_02', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 1 } },
      { n: 'MH_Fern01_03', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 0.8 } },
      { n: 'MH_Fern01_04', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 0.8 } },
      { n: 'MH_Fern01_05', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 1 } },
      { n: 'MH_Fern01_06', layer: 'cover', dist: 30, scale: [0.60, 1.80], sink: 0.02, slope: 0.35, trunk: false, align: 'surface', weights: { [B.FOREST]: 1, [B.JUNGLE]: 1 } },
      { n: 'MH_Moss01_01', layer: 'cover', dist: 26, scale: [0.55, 1.90], sink: 0.01, slope: 0.30, trunk: false, align: 'surface', weights: { [B.FOREST]: 1.5, [B.TUNDRA]: 1, [B.SNOWY_PEAKS]: 0.8 } },
      { n: 'MH_Moss01_02', layer: 'cover', dist: 26, scale: [0.55, 1.90], sink: 0.01, slope: 0.30, trunk: false, align: 'surface', weights: { [B.FOREST]: 1.5, [B.TUNDRA]: 1, [B.SNOWY_PEAKS]: 0.8 } },
      { n: 'MH_Moss01_03', layer: 'cover', dist: 26, scale: [0.55, 1.90], sink: 0.01, slope: 0.30, trunk: false, align: 'surface', weights: { [B.FOREST]: 1.5, [B.TUNDRA]: 1, [B.SNOWY_PEAKS]: 0.8 } },
      { n: 'Fallen_Maple_Leaf', layer: 'floor', dist: 22, scale: [0.90, 1.30], sink: 0.00, slope: 0.40, trunk: false, align: 'surface', parentOnly: true, weights: { [B.FOREST]: 3, [B.PLAINS]: 1.5, [B.SAVANNA]: 1 } },
      { n: 'Azalea_Litter_1', layer: 'floor', dist: 22, scale: [0.90, 1.30], sink: 0.00, slope: 0.40, trunk: false, align: 'surface', parentOnly: true, weights: { [B.FOREST]: 2, [B.JUNGLE]: 2 } },
      { n: 'Flag_Iris', layer: 'aquatic', dist: 40, scale: [0.90, 1.20], sink: 0.05, slope: 0.20, trunk: false, align: 'surface', water: 'margin', weights: { [B.SHALLOW]: 3, [B.BEACH]: 1.5 } },
      { n: 'Duckweed', layer: 'aquatic', dist: 46, scale: [0.90, 1.40], sink: 0.00, slope: 0.00, trunk: false, align: 'surface', water: 'surface', weights: { [B.SHALLOW]: 1.5, [B.BEACH]: 1, [B.OCEAN]: 0.5 } },

      { n: 'flower_field', layer: 'flowers', atlas: [
        'assets/images/vegetation/flowers/avens_pink.png',
        'assets/images/vegetation/flowers/babysbreath_white.png',
        'assets/images/vegetation/flowers/bellflower_blue.png',
        'assets/images/vegetation/flowers/bellflower_purple.png',
        'assets/images/vegetation/flowers/chamomile_white.png',
        'assets/images/vegetation/flowers/deadnettle_pink.png',
        'assets/images/vegetation/flowers/geranium_pink.png',
        'assets/images/vegetation/flowers/kalanchoe_red.png',
        'assets/images/vegetation/flowers/ragwort_yellow.png',
        'assets/images/vegetation/flowers/smartweed_pink.png',
        'assets/images/vegetation/flowers/foxtail_green.png',
        'assets/images/vegetation/flowers/wheatgrass_green.png',
      ], dist: 48, distKeep: true, capOverride: 6000, scale: [0.40, 0.95], sink: 0.03, slope: 0.55, trunk: false, align: 'upright', pickup: { itemId: 'flower', count: 1 }, weights: { [B.FLOWER_PLAINS]: 1, [B.PLAINS]: 1, [B.FOREST]: 1 } },
    ];




    for (const sp of VEG_SPECIES) {
      if (!sp.distKeep) sp.dist = sp.layer === 'canopy' ? 100 : Math.min(sp.dist, 52);
    }

    function _vegHash(gx, gz, salt) {
      return hash3(gx * 131 + salt * 17 + WORLD_SEED, salt * 7 + 3, gz * 197 + salt * 13 + WORLD_SEED);
    }
    function _pickWeighted(cand, r) {
      let sum = 0;
      for (const c of cand) sum += c.w;
      let t = r * sum;
      for (const c of cand) { t -= c.w; if (t <= 0) return c.s; }
      return cand[cand.length - 1].s;
    }

    function flowerPatchIndex(x, z, n) {
      if (n < 2) return 0;
      const sx = x + WORLD_SEED, sz = z + WORLD_SEED;
      const wx = sx + (fbm3(sx * 0.011, 73.1, sz * 0.011, 2) - 0.5) * 28;
      const wz = sz + (fbm3(sx * 0.011, 91.7, sz * 0.011, 2) - 0.5) * 28;
      const v = fbm3(wx * 0.018, 12.3, wz * 0.018, 3);
      const w2 = fbm3(wx * 0.034, 54.7, wz * 0.034, 2);
      let best = 0, bestD = 1e9, second = 0, secondD = 1e9;
      for (let i = 0; i < n; i++) {
        const center = (i + 0.5) / n;
        const dv = Math.abs(v - center);
        const dw = Math.abs(w2 - hash3(i * 97, 41, 17)) * 0.35;
        const d = dv + dw;
        if (d < bestD) { secondD = bestD; second = best; bestD = d; best = i; }
        else if (d < secondD) { secondD = d; second = i; }
      }
      const gap = secondD - bestD;
      if (gap < 0.035) {
        const mix = fbm3(sx * 0.09 + 7.3, 33.5, sz * 0.09 - 4.1, 2);
        if (mix > 0.5 + gap / 0.07) best = second;
      }
      return best;
    }




    function canopyFill(x, z, b, base) {
      if (b === B.FOREST || b === B.JUNGLE) return base;
      const sx = x + WORLD_SEED, sz = z + WORLD_SEED;
      const broad = fbm3(sx * 0.008, 51.7, sz * 0.008, 3);
      const local = fbm3(sx * 0.035, 18.3, sz * 0.035, 2);
      const grove = smoothstep01(0.47, 0.61, broad);
      const clump = 0.4 + 1.4 * smoothstep01(0.44, 0.66, local);
      return base * (0.12 + 3.2 * grove * clump);
    }

    function smoothstep01(a, b, x) {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }

    function vegCell(layer, gx, gz) {
      const cell = VEG_LAYERS[layer].cell;
      const x = (gx + 0.12 + 0.76 * _vegHash(gx, gz, 1)) * cell;
      const z = (gz + 0.12 + 0.76 * _vegHash(gx, gz, 2)) * cell;
      const b = biomeAt(x, z);
      let fill = VEG_LAYERS[layer].fill[b];
      if (!fill) return null;
      if (layer === 'canopy' && WORLD_TERRAIN === 'realistic') fill = Math.min(1, canopyFill(x, z, b, fill));
      // wildflowers leak out of the flower plains into small, rare patches in plains/forest
      if (layer === 'flowers' && b !== B.FLOWER_PLAINS) {
        const sx = x + WORLD_SEED, sz = z + WORLD_SEED;
        fill *= smoothstep01(0.66, 0.74, fbm3(sx * 0.02, 63.7, sz * 0.02, 2));
      }
      if (_vegHash(gx, gz, 3) >= fill) return null;
      const cand = [];
      for (const sp of VEG_SPECIES) {
        if (sp.layer !== layer) continue;
        const w = sp.weights[b];
        if (w) cand.push({ s: sp, w });
      }
      if (!cand.length) return null;
      let sp, flowerType = -1;
      if (layer === 'flowers') {
        sp = cand[0].s;
        const spot = _vegHash(gx, gz, 77);
        flowerType = spot < 0.035 ? 10 : spot < 0.07 ? 11 : flowerPatchIndex(x, z, 10);
      } else {
        sp = _pickWeighted(cand, _vegHash(gx, gz, 4));
      }
      return {
        sp, x, z, b,
        scale: (sp.scale[0] + (sp.scale[1] - sp.scale[0]) * _vegHash(gx, gz, 5)) * VEG_LAYERS[layer].size,
        yaw: _vegHash(gx, gz, 6) * Math.PI * 2,
        gx, gz, flowerType,
      };
    }


    function vegParentNear(x, z) {
      const cell = VEG_LAYERS.canopy.cell;
      for (let gz = Math.floor((z - 6) / cell); gz <= Math.floor((z + 6) / cell); gz++) {
        for (let gx = Math.floor((x - 6) / cell); gx <= Math.floor((x + 6) / cell); gx++) {
          const c = vegCell('canopy', gx, gz);
          if (c && c.sp.litter && Math.hypot(c.x - x, c.z - z) < c.sp.litter) return true;
        }
      }
      return false;
    }



    function groundDepth(x, y, z) {
      const n = (noise3(x * 0.15, y * 0.15, z * 0.15) - 0.5) * 4.0;
      return terrainTrend(x + WORLD_SEED, z + WORLD_SEED) - y + n;
    }




    function vegResolve(pl) {
      const sp = pl.sp;
      if (!sp.ready) return null;
      if (industrialInside(pl.x, pl.z)) return null;
      if (sp.parentOnly && !vegParentNear(pl.x, pl.z)) return null;




      const wsurf = world.surfaceAt(pl.x, pl.z);
      const wet = wsurf !== -Infinity;

      if (sp.water === 'surface') {
        if (!wet) return null;
        pl.y = wsurf + 0.02;
        pl.n = _up;
      } else {
        const fromY = Math.ceil(terrainTrend(pl.x + WORLD_SEED, pl.z + WORLD_SEED)) + 12;
        const y = world.surfaceY(pl.x, pl.z, fromY);
        if (y <= -8) return null;

        if (mountainRockAt(pl.x, pl.z)) return null;
        if (WORLD_TERRAIN === 'realistic' && y > 112) return null;

        if (caveCarveAt(pl.x + WORLD_SEED, y + 0.4, pl.z + WORLD_SEED) > 0.02) return null;
        if ((sp.layer === 'canopy' || sp.layer === 'ground' || sp.layer === 'cover' || sp.layer === 'floor' || sp.layer === 'flowers') && groundDepth(pl.x, y, pl.z) >= 1.2) return null;
        if (sp.water === 'margin') {
          if (!wet || y > SEA_LEVEL + 0.4) return null;
        } else if (wet) {
          return null;
        }
        const n = world.getSurfaceNormal(pl.x, y, pl.z);
        if (n.y < sp.slope) return null;
        pl.n = n;



        const root = (sp.trunk && sp.align === 'upright') ? 0.7 : 0;
        pl.y = y - (sp.sink + root) + 0.02;
      }

      if (sp.align === 'upright') {
        const lean = 0.06;
        _q1.setFromEuler(new THREE.Euler(
          (_vegHash(pl.gx, pl.gz, 8) - 0.5) * 2 * lean, 0,
          (_vegHash(pl.gx, pl.gz, 9) - 0.5) * 2 * lean));
        _q2.setFromAxisAngle(_up, pl.yaw);
        pl.q = _q1.clone().multiply(_q2);
      } else {
        _q1.setFromUnitVectors(_up, pl.n.clone().normalize());
        _q2.setFromAxisAngle(_up, pl.yaw);
        pl.q = _q1.clone().multiply(_q2);
      }
      return pl;
    }



    function dilateAlpha(tex) {
      const img = tex.image;
      if (!img || !img.width) return;
      const w = img.width, h = img.height;
      const pad = document.createElement('canvas');
      pad.width = w; pad.height = h;
      const g = pad.getContext('2d');
      const r = 8;
      for (let dy = -r; dy <= r; dy += 2) for (let dx = -r; dx <= r; dx += 2) g.drawImage(img, dx, dy);
      g.drawImage(img, 0, 0);
      tex.image = pad;
      tex.needsUpdate = true;
    }

    async function loadAtlasTexture(paths) {
      const imgs = await Promise.all(paths.map((p) => new Promise((res, rej) => {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => res(img); img.onerror = rej; img.src = p;
      })));
      const cols = 4, rows = Math.ceil(imgs.length / cols);
      const cellW = Math.max(...imgs.map((i) => i.width));
      const cellH = Math.max(...imgs.map((i) => i.height));
      const c = document.createElement('canvas');
      c.width = cellW * cols; c.height = cellH * rows;
      const g = c.getContext('2d');
      const rects = [];
      imgs.forEach((img, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = col * cellW, y = row * cellH;
        const dw = cellW, dh = cellH;
        const sw = img.width, sh = img.height;
        const s = Math.min(dw / sw, dh / sh);
        const rw = sw * s, rh = sh * s;
        const ox = x + (dw - rw) * 0.5, oy = y + (dh - rh);
        g.drawImage(img, ox, oy, rw, rh);
        rects.push([ox / c.width, 1 - (oy + rh) / c.height, rw / c.width, rh / c.height]);
      });
      let outC = c;
      if (c.width > 2048) {
        const s = 2048 / c.width;
        outC = document.createElement('canvas');
        outC.width = 2048; outC.height = Math.round(c.height * s);
        outC.getContext('2d').drawImage(c, 0, 0, outC.width, outC.height);
      }
      const tex = new THREE.CanvasTexture(outC);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipMapLinearFilter;
      return { tex, rects, aspect: cellW / cellH };
    }

    async function loadCardModel(sp) {
      let tex, atlasRects = null, atlasAspect = 1;
      if (sp.atlas) {
        const a = await loadAtlasTexture(sp.atlas);
        tex = a.tex; atlasRects = a.rects; atlasAspect = a.aspect;
        dilateAlpha(tex);
      } else {
        tex = await new THREE.TextureLoader().loadAsync(sp.tex);
        if (sp.layer === 'flowers') dilateAlpha(tex);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
      }
      const w = sp.atlas ? atlasAspect : (tex.image.width / tex.image.height);
      const pos = [], nor = [], uv = [], idx = [];
      const planes = sp.atlas
        ? [[[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 1, 0], [-w / 2, 1, 0]]]
        : [
          [[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 1, 0], [-w / 2, 1, 0]],
          [[0, 0, -w / 2], [0, 0, w / 2], [0, 1, w / 2], [0, 1, -w / 2]],
        ];
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const p of planes) {
        const b = pos.length / 3;
        for (let i = 0; i < 4; i++) { pos.push(...p[i]); nor.push(0, 1, 0); uv.push(...uvs[i]); }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));


      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
      geo.setIndex(idx);
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide, vertexColors: true });
      if (sp.atlas) {
        mat.onBeforeCompile = (shader) => {
          shader.vertexShader = 'attribute vec4 aFlowerUv;\nvarying vec4 vFlowerUv;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec3 iPos = instanceMatrix[3].xyz;
            float iScale = length(instanceMatrix[0].xyz);
            float fd = length((modelViewMatrix * vec4(iPos, 1.0)).xyz);
            float fs = 1.0 + smoothstep(16.0, 46.0, fd) * 0.8;
            vec2 toCam = normalize(cameraPosition.xz - iPos.xz + vec2(0.0001));
            vec3 right = vec3(toCam.y, 0.0, -toCam.x);
            vec3 up = vec3(0.0, 1.0, 0.0);
            transformed = iPos + right * (transformed.x * iScale * fs) + up * (transformed.y * iScale * (1.0 + smoothstep(16.0, 46.0, fd) * 0.3));
            objectNormal = vec3(0.0, 1.0, 0.0);`
          ).replace(
            '#include <project_vertex>',
            `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            vViewPosition = - mvPosition.xyz;`
          ).replace(
            '#include <worldpos_vertex>',
            'vec4 worldPosition = vec4( transformed, 1.0 );'
          ).replace(
            '#include <defaultnormal_vertex>',
            'vec3 transformedNormal = normalMatrix * objectNormal;'
          ).replace(
            '#include <uv_vertex>',
            '#include <uv_vertex>\nvFlowerUv = aFlowerUv;'
          );
          shader.fragmentShader = 'varying vec4 vFlowerUv;\n' + shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec2 fUv = vFlowerUv.xy + vMapUv * vFlowerUv.zw;
              vec4 sampledDiffuseColor = texture2D( map, fUv );
              #ifdef DECODE_VIDEO_TEXTURE
                sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
              #endif
              diffuseColor *= sampledDiffuseColor;
            #endif`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <alphatest_fragment>',
            `#ifdef USE_ALPHATEST
              float d = length(vViewPosition);
              float at = mix(alphaTest, alphaTest * 0.25, smoothstep(18.0, 55.0, d));
              if ( diffuseColor.a < at ) discard;
            #endif`
          );
        };
        mat.customProgramCacheKey = () => 'flower-atlas-billboard';
      } else if (sp.layer === 'flowers') {
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <alphatest_fragment>',
            `#ifdef USE_ALPHATEST
              float d = length(vViewPosition);
              float at = mix(alphaTest, alphaTest * 0.25, smoothstep(18.0, 55.0, d));
              if ( diffuseColor.a < at ) discard;
            #endif`
          );
        };
        mat.customProgramCacheKey = () => 'flower-card';
      }

      const cell = VEG_LAYERS[sp.layer].cell;
      const cap = sp.capOverride || Math.min(900, Math.ceil(Math.PI * sp.dist * sp.dist / (cell * cell)) + 16);
      const group = new THREE.Group();
      group.name = 'veg:' + sp.n;
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = !atlasRects;
      mesh.matrixAutoUpdate = false;
      if (atlasRects) {
        mesh.geometry.setAttribute('aFlowerUv', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4));
      }
      group.add(mesh);
      scene.add(group);

      sp.parts = [{ mesh }];
      sp.cap = cap;
      sp.trunkR = 0;
      sp.placements = new Map();
      sp.atlasRects = atlasRects;
      sp.ready = true;
      _vegGX = NaN;
      return sp;
    }

    // The bottom band includes flared roots and low branches; a max over it makes the collider
    // far wider than the bark. Sample only the lowest slice and take a high percentile of it.
    function vegTrunkRadius(parts, cx, cz, mny, mxy) {
      const barkTop = mny + (mxy - mny) * 0.06;
      const radii = [];
      for (const p of parts) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i + 1] <= barkTop) radii.push(Math.hypot(a[i] - cx, a[i + 2] - cz));
        }
      }
      if (!radii.length) return 0;
      radii.sort((a, b) => a - b);
      return radii[Math.floor((radii.length - 1) * 0.75)];
    }

    async function loadVegModel(sp) {
      if (sp.tex || sp.atlas) return loadCardModel(sp);
      const isFbx = sp.file === 'scene.fbx';
      const file = sp.file || 'scene.gltf';
      const root = await new Promise((resolve, reject) => {
        const loader = isFbx ? _fbxLoader : _vegLoader;
        const attempt = (tries) => loader.load((sp.dir || VEG_DIR) + sp.n + '/' + file,
          (o) => resolve(isFbx ? o : o.scene), undefined,
          (e) => tries > 0 ? setTimeout(() => attempt(tries - 1), 150) : reject(e));
        attempt(2);
      });
      root.updateMatrixWorld(true);


      const byMat = new Map();
      root.traverse((o) => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const src = o.geometry;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', src.attributes.position.clone());
        if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone());
        if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv.clone());
        if (src.index) g.setIndex(src.index.clone());
        else {
          const idx = new Uint32Array(src.attributes.position.count);
          for (let i = 0; i < idx.length; i++) idx[i] = i;
          g.setIndex(new THREE.BufferAttribute(idx, 1));
        }
        g.applyMatrix4(o.matrixWorld);
        if (!g.attributes.normal) g.computeVertexNormals();
        const key = o.material.uuid;
        if (!byMat.has(key)) byMat.set(key, { mat: o.material, geos: [] });
        byMat.get(key).geos.push(g);
      });
      if (!byMat.size) return null;

      const parts = [];
      for (const { mat, geos } of byMat.values()) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (!merged) continue;
        mat.side = THREE.DoubleSide;


        mat.vertexColors = false;
        if (isFbx) mat.color.setRGB(1, 1, 1);
        if (isFbx || mat.transparent || mat.alphaTest > 0) {
          mat.transparent = false;
          mat.alphaTest = Math.max(mat.alphaTest || 0, 0.5);
          mat.depthWrite = true;
        }
        parts.push({ geo: merged, mat });
      }



      if (isFbx || sp.norm) {
        let mn = Infinity, mx = -Infinity;
        for (const p of parts) { const a = p.geo.attributes.position.array; for (let i = 1; i < a.length; i += 3) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; } }
        const k = mx - mn > 1e-3 ? 1 / (mx - mn) : 1;
        for (const p of parts) p.geo.scale(k, k, k);
      }


      let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
      for (const p of parts) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i] < mnx) mnx = a[i]; if (a[i] > mxx) mxx = a[i];
          if (a[i + 1] < mny) mny = a[i + 1]; if (a[i + 1] > mxy) mxy = a[i + 1];
          if (a[i + 2] < mnz) mnz = a[i + 2]; if (a[i + 2] > mxz) mxz = a[i + 2];
        }
      }
      const band = mny + Math.max(0.15, (0.15 * (mxz - mnz)));
      let cx = 0, cz = 0, cn = 0;
      for (const p of parts) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i + 1] <= band) { cx += a[i]; cz += a[i + 2]; cn++; }
        }
      }
      if (cn > 0) { cx /= cn; cz /= cn; } else { cx = (mnx + mxx) / 2; cz = (mnz + mxz) / 2; }


      const trunkR = vegTrunkRadius(parts, cx, cz, mny, mxy);
      for (const p of parts) p.geo.translate(-cx, -mny, -cz);

      const cell = VEG_LAYERS[sp.layer].cell;
      const cap = sp.capOverride || Math.min(900, Math.ceil(Math.PI * sp.dist * sp.dist / (cell * cell)) + 16);
      const group = new THREE.Group();
      group.name = 'veg:' + sp.n;
      const built = parts.map((p) => {
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, cap);
        mesh.count = 0;
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        return { mesh, geo: p.geo, mat: p.mat };
      });
      scene.add(group);

      sp.parts = built;
      sp.cap = cap;
      sp.trunkR = Math.min(trunkR, 1.5);
      sp.placements = new Map();
      sp.ready = true;
      _vegGX = NaN;
      return sp;
    }




    const INDUSTRIAL_MODELS = {
      building_a:   'assets/models/industrial/01_building_a.glb',
      garage:       'assets/models/industrial/03_garage.glb',
      container_01: 'assets/models/industrial/04_container_01.glb',
      container_02: 'assets/models/industrial/04_container_02.glb',
      container_03: 'assets/models/industrial/04_container_03.glb',
      liquid_tank:  'assets/models/industrial/05_liquid_tank.glb',
    };
    const _indLoader = new GLTFLoader();
    const _indTemplates = new Map();
    const _indMasks = new Map();
    const _indActive = new Map();
    const industrialColliders = [];
    let _indGX = NaN, _indGZ = NaN;



    function buildWallMask(group) {
      const CELL = 0.15, WALL_R = 0.11, Y0 = 0.25, Y1 = 2.0;
      let mnx = Infinity, mxx = -Infinity, mnz = Infinity, mxz = -Infinity;
      for (const m of group.children) {
        const a = m.geometry.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i] < mnx) mnx = a[i];
          if (a[i] > mxx) mxx = a[i];
          if (a[i + 2] < mnz) mnz = a[i + 2];
          if (a[i + 2] > mxz) mxz = a[i + 2];
        }
      }
      const cols = Math.max(1, Math.ceil((mxx - mnx) / CELL));
      const rows = Math.max(1, Math.ceil((mxz - mnz) / CELL));
      const data = new Uint8Array(cols * rows);

      const mark = (ax, az, bx, bz) => {
        const gx0 = Math.max(0, Math.floor((Math.min(ax, bx) - WALL_R - mnx) / CELL));
        const gx1 = Math.min(cols - 1, Math.floor((Math.max(ax, bx) + WALL_R - mnx) / CELL));
        const gz0 = Math.max(0, Math.floor((Math.min(az, bz) - WALL_R - mnz) / CELL));
        const gz1 = Math.min(rows - 1, Math.floor((Math.max(az, bz) + WALL_R - mnz) / CELL));
        const dx = bx - ax, dz = bz - az;
        const len2 = dx * dx + dz * dz;
        for (let gz = gz0; gz <= gz1; gz++) {
          const pz = mnz + (gz + 0.5) * CELL;
          for (let gx = gx0; gx <= gx1; gx++) {
            const px = mnx + (gx + 0.5) * CELL;
            let t = 0;
            if (len2 > 1e-9) t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
            const qx = ax + dx * t, qz = az + dz * t;
            const ddx = px - qx, ddz = pz - qz;
            if (ddx * ddx + ddz * ddz <= WALL_R * WALL_R) data[gz * cols + gx] = 1;
          }
        }
      };

      for (const m of group.children) {
        const pos = m.geometry.attributes.position;
        const idx = m.geometry.index;
        const count = idx ? idx.count : pos.count;
        for (let t = 0; t < count; t += 3) {
          const i0 = idx ? idx.getX(t) : t;
          const i1 = idx ? idx.getX(t + 1) : t + 1;
          const i2 = idx ? idx.getX(t + 2) : t + 2;
          const ax = pos.getX(i0), ay = pos.getY(i0), az = pos.getZ(i0);
          const bx = pos.getX(i1), by = pos.getY(i1), bz = pos.getZ(i1);
          const cx = pos.getX(i2), cy = pos.getY(i2), cz = pos.getZ(i2);
          const ymin = Math.min(ay, by, cy), ymax = Math.max(ay, by, cy);
          if (ymax < Y0 || ymin > Y1) continue;

          const ux = bx - ax, uy = by - ay, uz = bz - az;
          const vx = cx - ax, vy = cy - ay, vz = cz - az;
          const nx = uy * vz - uz * vy;
          const ny = uz * vx - ux * vz;
          const nz = ux * vy - uy * vx;
          const nl = Math.hypot(nx, ny, nz) || 1;
          if (Math.abs(ny) / nl > 0.75) continue;
          mark(ax, az, bx, bz);
          mark(bx, bz, cx, cz);
          mark(cx, cz, ax, az);
        }
      }
      return { cell: CELL, minX: mnx, minZ: mnz, cols, rows, data };
    }

    function parseWallMask(text) {
      const lines = text.split(/\r?\n/);
      const num = (k) => {
        const l = lines.find((x) => x.startsWith(k + ':'));
        return l ? parseFloat(l.slice(k.length + 1)) : NaN;
      };
      const cell = num('cell'), minX = num('minX'), minZ = num('minZ');
      const cols = num('cols'), rows = num('rows');
      const start = lines.findIndex((l) => l.startsWith('mask'));
      const data = new Uint8Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        const line = lines[start + 1 + r] || '';
        for (let c = 0; c < cols; c++) data[r * cols + c] = line[c] === '1' ? 1 : 0;
      }
      return { cell, minX, minZ, cols, rows, data };
    }

    async function loadIndustrialTemplate(id) {
      const gltf = await _indLoader.loadAsync(INDUSTRIAL_MODELS[id]);
      const root = gltf.scene;
      root.updateMatrixWorld(true);
      const group = new THREE.Group();
      root.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const geo = o.geometry.clone();
        geo.applyMatrix4(o.matrixWorld);


        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!mat) continue;
          mat.metalness = 0;
          mat.roughness = Math.max(0.85, mat.roughness ?? 1);
          if (mat.color) mat.color.setScalar(0.33);
        }
        group.add(new THREE.Mesh(geo, o.material));
      });
      const box = new THREE.Box3().setFromObject(group);
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      for (const m of group.children) m.geometry.translate(-cx, -box.min.y, -cz);
      _indTemplates.set(id, group);
      if (id === 'garage') {
        let mask = null;
        try {
          const res = await fetch('assets/models/industrial/03_garage.mask.txt');
          if (res.ok) mask = parseWallMask(await res.text());
        } catch (e) {                                               }
        if (!mask) mask = buildWallMask(group);
        indApplyMaskEdits(id, mask);
        _indMasks.set(id, mask);
      } else if (id === 'building_a') {
        const mask = buildWallMask(group);
        indApplyMaskEdits(id, mask);
        _indMasks.set(id, mask);
      }
    }

    const industrialPreload = Promise.all(Object.keys(INDUSTRIAL_MODELS).map((id) =>
      loadIndustrialTemplate(id).catch((e) => console.warn('industrial model failed', id, e))));


    function industrialCreate(site, key) {
      const group = new THREE.Group();
      for (const p of site.parts) {
        const t = _indTemplates.get(p.id);
        if (!t) continue;
        const inst = t.clone(true);
        inst.position.set(site.x + p.dx, site.y0 + 0.01, site.z + p.dz);
        inst.rotation.y = p.yaw;
        if (p.scale) inst.scale.setScalar(p.scale);
        group.add(inst);

        const isContainer = /^container_/.test(p.id);
        if (isContainer && p.loot?.length) {
          const dims = IND_DIMS[p.id];
          const s = p.scale || 1;
          const worldX = site.x + p.dx;
          const worldZ = site.z + p.dz;
          const centerY = site.y0 + (dims.h || 4.5) * s * 0.5;
          const interactRadius = Math.max(4.0, Math.max(dims.hx, dims.hz) * s * 1.2);
          addOutlineToMesh(inst, 1.03, 0xffffff);
          const machine = {
            x: worldX,
            y: centerY,
            z: worldZ,
            radius: interactRadius,
            label: 'OPEN CONTAINER',
            mesh: inst,
            activate() {
              if (p._opened) return;
              p._opened = true;
              const loot = p.loot || [];
              const dir = new THREE.Vector3(Math.cos(p.yaw), 0, Math.sin(p.yaw));
              for (let i = 0; i < loot.length; i++) {
                const item = loot[i];
                const left = give(item.id, item.n);
                if (left > 0) {
                  const outX = worldX + dir.x * (2.5 + i * 0.7);
                  const outZ = worldZ + dir.z * (2.5 + i * 0.7);
                  const outY = world.getSurfaceHeight(outX, outZ, 12) + 0.5;
                  spawnDrop(item.id, left, { x: outX, y: outY, z: outZ });
                }
              }
              notice('CONTAINER OPENED');
              const root = inst.userData.outlineRoot;
              if (root && root.parent) root.parent.remove(root);
              const rIdx = outlineTargets.indexOf(root);
              if (rIdx >= 0) outlineTargets.splice(rIdx, 1);
              const idx = machineActivators.indexOf(machine);
              if (idx >= 0) machineActivators.splice(idx, 1);
            },
          };
          bindInteractEntry(inst, { target: machine, type: 'machine', label: machine.label, activate: () => machine.activate() });
          machineActivators.push(machine);
        }

        if (p.id === 'liquid_tank') {
          const dims = IND_DIMS[p.id];
          const s = p.scale || 1;
          const worldX = site.x + p.dx;
          const worldZ = site.z + p.dz;
          addOutlineToMesh(inst, 1.02, 0xffffff);
          const tank = {
            x: worldX,
            y: site.y0 + (dims.h || 19) * s * 0.5,
            z: worldZ,
            radius: Math.max(4.0, Math.max(dims.hx, dims.hz) * s * 1.2),
            label: 'FILL CONTAINER',
            mesh: inst,
            activate() {
              const stack = inv.hot[inv.sel];
              const def = stack && ITEMS[stack.id];
              if (!def?.container) { notice('HOLD A JERRY CAN'); return; }
              if (!Liquid.accepts(def, 'water')) { notice('CANNOT HOLD WATER'); return; }
              const room = def.container.capacity - Liquid.volume(stack);
              if (room <= 0) { notice('CONTAINER FULL'); return; }
              Liquid.fill(stack, def, 'water', room);
              notice(`${def.name} · ${Math.round(Liquid.volume(stack))}/${def.container.capacity} WATER`);
              syncBars();
            },
          };
          bindInteractEntry(inst, { target: tank, type: 'machine', label: tank.label, activate: () => tank.activate() });
          machineActivators.push(tank);
        }
      }
      if (!group.children.length) return null;
      scene.add(group);
      return group;
    }

    function industrialUpdate(px, pz) {
      if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
      const gx = Math.floor(px / 8), gz = Math.floor(pz / 8);
      if (gx === _indGX && gz === _indGZ) return;
      _indGX = gx; _indGZ = gz;

      const reach = Math.min(viewRadius, DETAIL_CHUNK_RADIUS) * 16 + 24;
      const rc = Math.ceil((reach + IND_MAX_R) / IND_CELL);
      const ccx = Math.floor(px / IND_CELL), ccz = Math.floor(pz / IND_CELL);
      const keep = new Set();
      for (let dz = -rc; dz <= rc; dz++) {
        for (let dx = -rc; dx <= rc; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const site = industrialSite(cx, cz);
          if (!site) continue;
          if (Math.hypot(site.x - px, site.z - pz) > reach + Math.max(site.padX, site.padZ)) continue;
          const key = cx + ',' + cz;
          keep.add(key);
          if (_indActive.has(key)) continue;
          const group = industrialCreate(site, key);
          if (group) _indActive.set(key, { group, site });
        }
      }
      for (const [key, rec] of _indActive) {
        if (keep.has(key)) continue;
        scene.remove(rec.group);
        _indActive.delete(key);
      }


      industrialColliders.length = 0;
      for (const { site } of _indActive.values()) {
        for (const p of site.parts) {
          const dim = IND_DIMS[p.id];
          const s = p.scale || 1;
          const top = site.y0 + dim.h * s;
          const x = site.x + p.dx, z = site.z + p.dz;
          const mask = _indMasks.get(p.id);
          if (mask) {
            industrialColliders.push({
              kind: 'mask', mask, x, z, s, top, base: site.y0,
              cos: Math.cos(p.yaw), sin: Math.sin(p.yaw),
            });
          } else {
            const swap = Math.abs(Math.sin(p.yaw)) > 0.5;
            industrialColliders.push({
              kind: 'box', x, z, top, base: site.y0,
              hx: (swap ? dim.hz : dim.hx) * s,
              hz: (swap ? dim.hx : dim.hz) * s,
            });
          }
        }
      }
    }

    // Wasteland barrels: deterministic per-cell salvage, streamed like industrial sites.
    const BARREL_CELL = 24;
    const BARREL_CHANCE = 0.75;
    const _barrelCells = new Map();
    const _barrelActive = new Map();
    const openedBarrels = new Set();
    let _barrelSeed = null, _barrelGX = NaN, _barrelGZ = NaN;

    function barrelHash(cx, cz, n) {
      return hash3(cx * 151 + WORLD_SEED + n * 911, n * 41 + 7, cz * 211 + WORLD_SEED + n * 677);
    }

    function barrelCell(cx, cz) {
      if (_barrelSeed !== WORLD_SEED) { _barrelSeed = WORLD_SEED; _barrelCells.clear(); }
      const k = (cx + 32768) * 65536 + (cz + 32768);
      if (_barrelCells.has(k)) return _barrelCells.get(k);
      let list = [];
      if (barrelHash(cx, cz, 0) < BARREL_CHANCE) {
        const count = 1 + Math.floor(barrelHash(cx, cz, 1) * 4);
        for (let i = 0; i < count; i++) {
          list.push({
            key: `${cx},${cz}:${i}`,
            x: (cx + 0.12 + barrelHash(cx, cz, 2 + i * 3) * 0.76) * BARREL_CELL,
            z: (cz + 0.12 + barrelHash(cx, cz, 3 + i * 3) * 0.76) * BARREL_CELL,
            yaw: barrelHash(cx, cz, 4 + i * 3) * Math.PI * 2,
          });
        }
      }
      _barrelCells.set(k, list);
      return list;
    }

    function barrelDespawn(rec) {
      scene.remove(rec.mesh);
      const ai = machineActivators.indexOf(rec.activator);
      if (ai >= 0) machineActivators.splice(ai, 1);
      const root = rec.mesh.userData.outlineRoot;
      if (root && root.parent) root.parent.remove(root);
      const oi = outlineTargets.indexOf(root);
      if (oi >= 0) outlineTargets.splice(oi, 1);
      rec.mesh.geometry.dispose();
      rec.mesh.material.dispose();
    }

    function barrelCreate(b, y) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10),
        new THREE.MeshLambertMaterial({ color: 0x7a5b3c, emissive: 0x140d05 })
      );
      mesh.position.set(b.x, y + 0.53, b.z);
      mesh.rotation.y = b.yaw;
      scene.add(mesh);
      const rec = { key: b.key, y, mesh, activator: null };
      rec.activator = registerMachine({
        x: b.x, y: y + 0.6, z: b.z, radius: 1.3, label: 'PRY OPEN BARREL', mesh,
        onActivate: () => {
          const held = inv.hot[inv.sel];
          if (!held || !ITEMS[held.id]?.tool?.crowbar) { notice('NEED CROWBAR'); return; }
          openedBarrels.add(b.key);
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            const id = Math.random() < TUNING.BARREL_SCRAP_CHANCE ? 'scrap' : rollWeighted(BARREL_LOOT);
            const left = give(id, 1);
            if (left > 0) {
              const a = b.yaw + (i / n) * Math.PI * 2;
              spawnDrop(id, left, { x: b.x + Math.cos(a) * 1.2, y: y + 0.4, z: b.z + Math.sin(a) * 1.2 });
            }
          }
          notice(`BARREL OPENED · ${n} ITEMS`);
          barrelDespawn(rec);
          _barrelActive.delete(b.key);
        },
      });
      return rec;
    }

    function barrelUpdate(px, pz) {
      if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
      const gx = Math.floor(px / 8), gz = Math.floor(pz / 8);
      if (gx === _barrelGX && gz === _barrelGZ) return;
      _barrelGX = gx; _barrelGZ = gz;
      const reach = Math.min(viewRadius, DETAIL_CHUNK_RADIUS) * 16 + 24;
      const rc = Math.ceil(reach / BARREL_CELL);
      const ccx = Math.floor(px / BARREL_CELL), ccz = Math.floor(pz / BARREL_CELL);
      const keep = new Set();
      for (let dz = -rc; dz <= rc; dz++) {
        for (let dx = -rc; dx <= rc; dx++) {
          for (const b of barrelCell(ccx + dx, ccz + dz)) {
            if (Math.hypot(b.x - px, b.z - pz) > reach) continue;
            if (openedBarrels.has(b.key) || biomeAt(b.x, b.z) !== B.WASTELAND) continue;
            const fromY = Math.ceil(terrainTrend(b.x + WORLD_SEED, b.z + WORLD_SEED)) + 12;
            const y = world.surfaceY(b.x, b.z, fromY);
            if (!Number.isFinite(y) || y <= -8) continue;
            keep.add(b.key);
            if (!_barrelActive.has(b.key)) _barrelActive.set(b.key, barrelCreate(b, y));
          }
        }
      }
      for (const [key, rec] of _barrelActive) {
        if (keep.has(key)) continue;
        barrelDespawn(rec);
        _barrelActive.delete(key);
      }
    }

    const IND_MASK_KEY = 'idte.ind.masks.v1';
    let _indMaskData = await idbGet(IND_MASK_KEY);
    if (typeof _indMaskData === 'string') { try { _indMaskData = JSON.parse(_indMaskData); } catch { _indMaskData = {}; } }
    if (!_indMaskData || typeof _indMaskData !== 'object') _indMaskData = {};

    function indMaskStore() {
      return _indMaskData;
    }

    function indApplyMaskEdits(id, mask) {
      const edits = indMaskStore()[id];
      if (!edits) return;
      for (const k in edits) {
        const i = +k;
        if (i >= 0 && i < mask.data.length) mask.data[i] = edits[k] ? 1 : 0;
      }
    }

    let vegReady = 0;
    const vegPreload = (async () => {
      const playBtnEl = document.getElementById('playBtn');
      const introBtnEl = document.getElementById('introBegin');
      const total = VEG_SPECIES.length;
      let i = 0, active = 0;
      await new Promise((done) => {
        const next = () => {
          if (i >= total && active === 0) return done();
          while (active < 6 && i < total) {
            const sp = VEG_SPECIES[i++];
            active++;
            loadVegModel(sp)
              .catch((e) => console.warn('veg model failed', sp.n, e))
              .then(() => {
                active--; vegReady++;
                const pct = Math.round(100 * vegReady / total);
                if (playBtnEl) playBtnEl.textContent = `LOADING ${pct}%`;
                if (introBtnEl && introBtnEl.disabled) introBtnEl.textContent = `LOADING ${pct}%`;
                next();
              });
          }
        };
        next();
      });
      await industrialPreload;
      if (playBtnEl) { playBtnEl.textContent = 'RESUME'; playBtnEl.disabled = false; }


      if (introBtnEl && window.__NUCLEARISM_READY_COMPLETE__) { introBtnEl.textContent = 'ENTER THE ZONE'; introBtnEl.disabled = false; }
    })();
    {
      const pb = document.getElementById('playBtn');
      if (pb) { pb.disabled = true; pb.textContent = 'LOADING 0%'; }
    }

    const _vegActive = { canopy: new Map(), ground: new Map(), cover: new Map(), floor: new Map(), flowers: new Map(), aquatic: new Map() };
    const _vegHarvested = new Set();
    const trunkColliders = [];
    let _vegGX = NaN, _vegGZ = NaN;

    const vegPerf = { stream: 0, inst: 0, trunks: 0, collide: 0, anim: 0, frames: 0 };

    const perf = { move: 0, jobs: 0, drops: 0, world: 0, water: 0, dirty: 0, wdirty: 0, entities: 0, render: 0, misc: 0 };
    window.__framePerf = perf;

    function vegAdd(sp, key, pl) { if (!sp.ready) return; sp.placements.set(key, pl); sp.dirty = true; }
    function vegRemove(sp, key) { if (!sp.placements) return; sp.placements.delete(key); sp.dirty = true; }

    function vegSupportY(pl) {
      if (pl.sp.water === 'surface' || pl.sp.water === 'margin') {
        return world.surfaceAt(pl.x, pl.z);
      }
      const fromY = Math.ceil(terrainTrend(pl.x + WORLD_SEED, pl.z + WORLD_SEED)) + 12;
      return world.surfaceY(pl.x, pl.z, fromY);
    }





    const VEG_CHECK_STEP = 128;
    const _vegFallingPlants = new Set();
    let _vegCheckFrame = 0;
    const _vegTumble = new THREE.Quaternion(), _vegEuler = new THREE.Euler();

    function vegAnimate(dt) {

      for (const pl of _vegFallingPlants) {
        pl.fallT += dt;
        pl.vel.y -= 8.5 * dt;
        pl.x += pl.vel.x * dt;
        pl.y += pl.vel.y * dt;
        pl.z += pl.vel.z * dt;
        _vegTumble.setFromEuler(_vegEuler.set(pl.spin * dt * 1.8, pl.spin * dt * 0.7, pl.spin * 0.8 * dt));
        pl.q.premultiply(_vegTumble);

        if (pl.y < -10 || pl.fallT > 1.75) {
          _vegFallingPlants.delete(pl);
          const active = _vegActive[pl.__layer];
          if (active) active.set(pl.__key, null);
          vegRemove(pl.sp, pl.__key);
        }
      }


      if ((_vegCheckFrame++ & 3) === 0) {
        const phase = (_vegCheckFrame >>> 2) % VEG_CHECK_STEP;
        let i = 0;
        for (const layer of ['canopy', 'ground', 'cover', 'floor', 'flowers', 'aquatic']) {
          const active = _vegActive[layer];
          for (const [key, pl] of active) {
            if (!pl || pl.sp.trunk || pl.falling) continue;
            if ((i++ % VEG_CHECK_STEP) !== phase) continue;
            const support = vegSupportY(pl);
            if (support === -Infinity || support < pl.y - 0.18) {
              pl.falling = true;
              pl.fallT = 0;
              pl.__layer = layer;
              pl.__key = key;
              pl.vel = new THREE.Vector3((Math.random() - 0.5) * 0.4, -(0.5 + Math.random() * 0.7), (Math.random() - 0.5) * 0.4);
              pl.spin = (Math.random() - 0.5) * 1.8;
              _vegFallingPlants.add(pl);
            }
          }
        }
      }
    }

    function vegUpdateInstances(sp) {
      if (!sp.parts) return;
      let i = 0;
      for (const pl of sp.placements.values()) {
        if (i >= sp.cap) break;
        _v.set(pl.x, pl.y, pl.z);
        _sc.setScalar(pl.scale);
        _m.compose(_v, pl.q, _sc);
        for (const part of sp.parts) {
          part.mesh.setMatrixAt(i, _m);
          const tint = VEG_BIOME_TINT.get(pl.b);
          if (tint) { part.mesh.setColorAt(i, tint); part.__tintDirty = true; }
          if (sp.atlasRects) {
            const uv = part.mesh.geometry.getAttribute('aFlowerUv');
            const r = sp.atlasRects[Math.max(0, pl.flowerType | 0)] || sp.atlasRects[0];
            uv.setXYZW(i, r[0], r[1], r[2], r[3]);
          }
        }
        i++;
      }
      for (const part of sp.parts) {
        part.mesh.count = i;
        part.mesh.visible = i > 0;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.__tintDirty && part.mesh.instanceColor) { part.mesh.instanceColor.needsUpdate = true; part.__tintDirty = false; }
        const uv = part.mesh.geometry.getAttribute('aFlowerUv');
        if (uv) uv.needsUpdate = true;
        if (sp.atlasRects) {
          const c = part.mesh.boundingSphere || new THREE.Sphere();
          c.center.set(player.pos.x, player.pos.y, player.pos.z);
          c.radius = sp.dist + 12;
          part.mesh.boundingSphere = c;
        }
      }
      sp.visible = i;
    }

    function vegRebuildTrunks() {
      trunkColliders.length = 0;
      for (const pl of _vegActive.canopy.values()) {
        if (!pl || !pl.sp.trunk) continue;
        const r = Math.max(0.12, pl.sp.trunkR * pl.scale * 1.35);

        if (Number.isFinite(r) && Number.isFinite(pl.x) && Number.isFinite(pl.z)) trunkColliders.push({ x: pl.x, z: pl.z, r });
      }
    }

    let _vegStreamTask = null;

    function _vegBeginStream(px, pz) {
      _vegStreamTask = {
        px, pz, li: 0,
        layers: ['canopy', 'ground', 'cover', 'floor', 'flowers', 'aquatic'],
        layer: null, L: null, maxD: 0, r: 0, ccx: 0, ccz: 0, active: null, keep: null, dz: 0, dx: 0, phase: 0,
      };
    }

    function _vegInitLayer(task) {
      const layer = task.layers[task.li];
      const L = VEG_LAYERS[layer];
      let maxD = 0;
      for (const sp of VEG_SPECIES) if (sp.layer === layer) maxD = Math.max(maxD, sp.dist);
      task.layer = layer; task.L = L; task.maxD = maxD;
      task.r = Math.ceil(maxD / L.cell);
      task.ccx = Math.floor(task.px / L.cell); task.ccz = Math.floor(task.pz / L.cell);
      task.active = _vegActive[layer];
      task.keep = new Set();
      task.dz = -task.r; task.dx = -task.r; task.phase = 1;
    }

    function _vegFinishLayer(task) {
      const layer = task.layer, active = task.active, keep = task.keep;
      for (const [key, pl] of active) {
        if (keep.has(key)) continue;
        if (pl && pl.sp.pickup) {
          const pickupKey = key + ':' + pl.sp.n;
          const pickup = worldPickups.find((p) => p.__vegKey === pickupKey);
          if (pickup) {
            _vegHarvested.add(`${layer}:${key}`);
            if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
            if (pickup.mesh.userData.outlineRoot && pickup.mesh.userData.outlineRoot.parent) {
              pickup.mesh.userData.outlineRoot.parent.remove(pickup.mesh.userData.outlineRoot);
            }
            const outIdx = outlineTargets.indexOf(pickup.mesh.userData.outlineRoot);
            if (outIdx >= 0) outlineTargets.splice(outIdx, 1);
            worldPickups.splice(worldPickups.indexOf(pickup), 1);
          }
        }
        if (pl) vegRemove(pl.sp, key);
        active.delete(key);
      }
    }

    function vegStreamStep(budgetMs) {
      const task = _vegStreamTask;
      if (!task) return false;
      const t0 = performance.now();
      if (!task.layer) _vegInitLayer(task);
      while (performance.now() - t0 < budgetMs) {
        if (task.phase === 1) {
          if (task.dz > task.r) { task.phase = 2; continue; }
          const cx = task.ccx + task.dx, cz = task.ccz + task.dz;
          const dd = Math.hypot((cx + 0.5) * task.L.cell - task.px, (cz + 0.5) * task.L.cell - task.pz);
          const key = cx + ',' + cz;
          if (dd <= task.maxD + task.L.cell) {
            task.keep.add(key);
            const layer = task.layer, active = task.active;
            if (_vegHarvested.has(`${layer}:${key}`)) {
              if (active.has(key)) {
                const pl = active.get(key);
                if (pl && pl.sp.pickup) {
                  const pickup = worldPickups.find((p) => p.__vegKey === `${key}:${pl.sp.n}`);
                  if (pickup) {
                    if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
                    if (pickup.mesh.userData.outlineRoot && pickup.mesh.userData.outlineRoot.parent) {
                      pickup.mesh.userData.outlineRoot.parent.remove(pickup.mesh.userData.outlineRoot);
                    }
                    const outIdx = outlineTargets.indexOf(pickup.mesh.userData.outlineRoot);
                    if (outIdx >= 0) outlineTargets.splice(outIdx, 1);
                    worldPickups.splice(worldPickups.indexOf(pickup), 1);
                  }
                }
                if (pl) vegRemove(pl.sp, key);
                active.delete(key);
              }
            } else if (!active.has(key)) {
              const pl = vegCell(layer, cx, cz);
              if (pl && pl.sp.ready) {
                let skip = false;
                if (pl.sp.layer === 'flowers' && dd > 18) {
                  const keep = 1 - smoothstep01(18, pl.sp.dist, dd) * 0.72;
                  if (_vegHash(cx, cz, 71) > keep) skip = true;
                }
                const rp = (!skip && dd <= pl.sp.dist) ? vegResolve(pl) : null;
                if (!rp) { if (dd <= pl.sp.dist) active.set(key, null); }
                else {
                  active.set(key, rp);
                  if (rp.sp.pickup) {
                    const pickupKey = key + ':' + rp.sp.n;
                    const pickup = worldPickups.find((p) => p.__vegKey === pickupKey);
                    if (!pickup) {
                      const p = registerPickup({
                        x: rp.x, y: rp.y + 0.6, z: rp.z,
                        itemId: rp.sp.pickup.itemId || 'flower',
                        count: rp.sp.pickup.count || 1,
                        radius: rp.sp.pickup.radius ? rp.sp.pickup.radius * 2 : Math.max(2.4, (rp.sp.scale?.[0] || 1) * 3.2),
                        label: rp.sp.pickup.label || `Pick ${rp.sp.pickup.itemId || 'flower'}`,
                      });
                      p.__vegKey = pickupKey; p.__vegCellKey = key; p.__vegLayer = layer;
                    } else {
                      pickup.x = rp.x; pickup.y = rp.y + 0.6; pickup.z = rp.z;
                      pickup.__vegCellKey = key; pickup.__vegLayer = layer;
                      pickup.mesh.position.set(pickup.x, pickup.y, pickup.z);
                      if (pickup.mesh.userData.outlineRoot) pickup.mesh.userData.outlineRoot.position.copy(pickup.mesh.position);
                    }
                  }
                  vegAdd(rp.sp, key, rp);
                }
              }
            }
          }
          task.dx++;
          if (task.dx > task.r) { task.dx = -task.r; task.dz++; }
        } else {
          _vegFinishLayer(task);
          task.li++;
          if (task.li >= task.layers.length) {
            const tt = performance.now();
            vegRebuildTrunks();
            vegPerf.trunks += performance.now() - tt;
            _vegStreamTask = null;
            vegPerf.stream += performance.now() - t0;
            return false;
          }
          _vegInitLayer(task);
        }
      }
      vegPerf.stream += performance.now() - t0;
      return true;
    }

    function vegUpdate(px, pz) {
      if (Number.isFinite(px) && Number.isFinite(pz)) {
        const gx = Math.floor(px / 8), gz = Math.floor(pz / 8);
        if (gx !== _vegGX || gz !== _vegGZ) {
          _vegGX = gx; _vegGZ = gz;
          _vegBeginStream(px, pz);
        }
      }
      if (_vegStreamTask) {
        const l = _vegStreamTask.layer;
        vegStreamStep(l === 'flowers' || l === 'flower_spots' ? 4.0 : 2.0);
      }


      const ti = performance.now();
      let budget = 2;
      for (const sp of VEG_SPECIES) {
        if (!sp.dirty) continue;
        if (budget-- <= 0) break;
        vegUpdateInstances(sp);
        sp.dirty = false;
      }
      vegPerf.inst += performance.now() - ti;
    }

    function vegFalling(dt) {
      vegAnimate(dt);
      vegUpdate(player.pos.x, player.pos.z);
    }










    const chopFall = [];
    const _chopRay = new THREE.Raycaster();
    const _chopOrigin = new THREE.Vector3();
    const _chopDir = new THREE.Vector3();
    const _chopMat4 = new THREE.Matrix4();
    const _chopInv = new THREE.Matrix4();
    const _chopQ = new THREE.Quaternion();
    const _chopSc = new THREE.Vector3();
    const _chopA = new THREE.Vector3();
    const _chopB = new THREE.Vector3();

    function disposeGroup(g) {
      g.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    }


    function clipPiece(parts, cutY, above) {
      const grp = new THREE.Group();
      for (const part of parts) {
        const src = part.geo.index ? part.geo.toNonIndexed() : part.geo;
        const pos = src.attributes.position;
        const nor = src.attributes.normal;
        const uv = src.attributes.uv;
        const P = [], N = [], U = [];
        for (let i = 0; i + 2 < pos.count; i += 3) {
          const y0 = pos.getY(i), y1 = pos.getY(i + 1), y2 = pos.getY(i + 2);
          if (above ? (y0 < cutY && y1 < cutY && y2 < cutY) : (y0 > cutY && y1 > cutY && y2 > cutY)) continue;
          for (let k = 0; k < 3; k++) {
            const j = i + k;
            const yj = pos.getY(j);


            P.push(pos.getX(j), above ? Math.max(yj, cutY) : Math.min(yj, cutY), pos.getZ(j));
            if (nor) N.push(nor.getX(j), nor.getY(j), nor.getZ(j));
            if (uv) U.push(uv.getX(j), uv.getY(j));
          }
        }
        if (src !== part.geo) src.dispose();
        if (!P.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        if (N.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        else g.computeVertexNormals();
        if (U.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        grp.add(new THREE.Mesh(g, part.mat));
      }
      return grp;
    }

    const _chopLo = new THREE.Vector3();
    const _chopLd = new THREE.Vector3();
    const _chopV4 = new THREE.Vector4();



    const logInsideTex = new THREE.TextureLoader().load('assets/images/log_insides.jpg');
    logInsideTex.colorSpace = THREE.SRGBColorSpace;
    const logInsideMat = new THREE.MeshLambertMaterial({ map: logInsideTex, side: THREE.DoubleSide });



    function cutRing(grp, cutY, maxR) {
      const pts = [], seen = new Set(), r2 = maxR * maxR;
      for (const m of grp.children) {
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(pos.getY(i) - cutY) > 1e-4) continue;
          const x = pos.getX(i), z = pos.getZ(i);
          if (x * x + z * z > r2) continue;
          const k = x.toFixed(3) + ',' + z.toFixed(3);
          if (seen.has(k)) continue;
          seen.add(k);
          pts.push([x, z]);
        }
      }
      return pts;
    }



    function cutCap(ring, y, fallbackR) {
      let pos = [], uv = [];
      if (ring.length >= 3) {
        const p = ring.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], up = [];
        for (const q of p) {
          while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
          lo.push(q);
        }
        for (let i = p.length - 1; i >= 0; i--) {
          const q = p[i];
          while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
          up.push(q);
        }
        lo.pop(); up.pop();
        const hull = lo.concat(up);
        let r = 0.01;
        for (const q of hull) r = Math.max(r, Math.hypot(q[0], q[1]));
        for (let i = 0; i < hull.length; i++) {
          const a = hull[i], b = hull[(i + 1) % hull.length];
          for (const [qx, qz] of [[0, 0], a, b]) {
            pos.push(qx, y, qz);
            uv.push(0.5 + qx / (2 * r), 0.5 + qz / (2 * r));
          }
        }
      }
      let g;
      if (pos.length) {
        g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        const n = new Float32Array(pos.length);
        for (let i = 1; i < n.length; i += 3) n[i] = 1;
        g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
      } else {
        g = new THREE.CircleGeometry(fallbackR * 1.02, 16);
        g.rotateX(-Math.PI / 2);
        g.translate(0, y, 0);
      }
      return new THREE.Mesh(g, logInsideMat);
    }




    function rayCylinder(ox, oy, oz, dx, dy, dz, r, y0, y1) {
      const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
      const a = dx * dx + dz * dz;
      if (a < 1e-9) {
        if (ox * ox + oz * oz > r * r || Math.abs(dy) < 1e-9) return null;
        const y = THREE.MathUtils.clamp(oy, lo, hi);
        const t = (y - oy) / dy;
        return t > 0.12 ? { t, y } : null;
      }
      const b = 2 * (ox * dx + oz * dz);
      const c = ox * ox + oz * oz - r * r;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      const t0 = (-b - sq) / (2 * a), t1 = (-b + sq) / (2 * a);
      for (const t of [t0, t1]) {
        if (t <= 0.12) continue;
        const y = oy + t * dy;
        if (y >= lo && y <= hi) return { t, y };
      }
      return null;
    }



    function chopTarget() {
      const ro = _chopRay.ray.origin, rd = _chopRay.ray.direction, far = _chopRay.far;
      let best = null, bestT = far + 1;

      const test = (pos, quat, scale, trunkR, topY, extra) => {
        _chopSc.setScalar(scale);
        _chopMat4.compose(pos, quat, _chopSc);
        const inv = _chopInv.copy(_chopMat4).invert();
        _chopLo.copy(ro).applyMatrix4(inv);
        _chopV4.set(rd.x, rd.y, rd.z, 0).applyMatrix4(inv);
        _chopLd.set(_chopV4.x, _chopV4.y, _chopV4.z);
        const hit = rayCylinder(_chopLo.x, _chopLo.y, _chopLo.z, _chopLd.x, _chopLd.y, _chopLd.z,
          trunkR * 1.4, 0, topY);
        if (!hit || hit.t >= bestT) return;
        bestT = hit.t;
        best = { ...extra, pos: pos.clone(), quat: quat.clone(), scale, topY, trunkR, cutLocalY: hit.y };
      };

      _chopA.set(0, 0, 0);
      for (const pl of _vegActive.canopy.values()) {
        if (!pl || !pl.sp.trunk) continue;
        _chopA.set(pl.x, pl.y, pl.z);
        test(_chopA, pl.q, pl.scale, pl.sp.trunkR, 1, { pl, sp: pl.sp, dyn: null, parts: pl.sp.parts });
      }
      for (const rec of chopFall) {
        if (rec.state !== 'stump') continue;
        _chopA.copy(rec.pos);
        test(_chopA, rec.quat, rec.scale, rec.trunkR, rec.topY, { pl: null, sp: null, dyn: rec, parts: rec.parts });
      }
      return best;
    }

    function removeDyn(rec) {
      scene.remove(rec.group);
      disposeGroup(rec.group);
      const i = chopFall.indexOf(rec);
      if (i >= 0) chopFall.splice(i, 1);
    }

    function despawnTree(pl, sp) {
      const key = `${pl.gx},${pl.gz}`;
      treeChopState.delete('veg:' + key);
      _vegHarvested.add('canopy:' + key);
      _vegActive.canopy.delete(key);
      vegRemove(sp, key);
      vegRebuildTrunks();
    }

    const TREE_CHOP_RADIUS = 2.0;
    const treeChopState = new Map();

    function treeChopKey(t) {
      if (t.pl) return `veg:${t.pl.gx},${t.pl.gz}`;
      if (t.dyn) return `dyn:${t.dyn.group.uuid}`;
      return `pos:${Math.round(t.pos.x * 10)},${Math.round(t.pos.y * 10)},${Math.round(t.pos.z * 10)}`;
    }

    function registerTreeChopHit(t, tool) {
      const required = tool.chop.hits ?? 3;
      const key = treeChopKey(t);
      const record = treeChopState.get(key) || { hits: 0, pos: t.pos.clone() };
      const sameArea = record.hits > 0 && record.pos.distanceTo(t.pos) <= TREE_CHOP_RADIUS;
      record.hits = sameArea ? record.hits + 1 : 1;
      record.pos.copy(t.pos);
      treeChopState.set(key, record);

      if (record.hits >= required) {
        treeChopState.delete(key);
        return true;
      }
      return false;
    }

    function chopTree(t, power = 1) {
      const cutY = THREE.MathUtils.clamp(t.cutLocalY, 0.06, t.topY - 0.04);
      if (!(cutY > 0.02) || cutY >= t.topY) return;
      achBump('chopped');

      const topGrp = clipPiece(t.parts, cutY, true);
      const stumpGrp = clipPiece(t.parts, cutY, false);


      const ring = cutRing(topGrp, cutY, t.trunkR * 1.02);


      if (t.dyn) removeDyn(t.dyn);
      else despawnTree(t.pl, t.sp);


      if (cutY > 0.10 && stumpGrp.children.length) {
        const sg = new THREE.Group();
        sg.position.copy(t.pos);
        sg.quaternion.copy(t.quat);
        sg.scale.setScalar(t.scale);
        sg.add(stumpGrp, cutCap(ring, cutY, t.trunkR * 0.8));
        scene.add(sg);
        const rec = {
          state: 'stump', group: sg, meshes: stumpGrp.children,
          parts: stumpGrp.children.map((m) => ({ geo: m.geometry, mat: m.material })),
          pos: t.pos.clone(), quat: t.quat.clone(), scale: t.scale,
          topY: cutY, trunkR: t.trunkR,
          __fruit: (t.dyn || t.pl)?.__fruit,
          __fruitDrops: (t.dyn || t.pl)?.__fruitDrops || 0,
        };
        chopFall.push(rec);
      } else {
        disposeGroup(stumpGrp);
      }


      const pivot = new THREE.Group();
      const cutWorld = _chopA.set(0, cutY, 0).applyQuaternion(t.quat).multiplyScalar(t.scale).add(t.pos);
      pivot.position.copy(cutWorld);
      pivot.quaternion.copy(t.quat);
      pivot.scale.setScalar(t.scale);
      topGrp.position.y = -cutY;
      if (topGrp.children.length) topGrp.add(cutCap(ring, cutY, t.trunkR * 0.8));
      pivot.add(topGrp);
      scene.add(pivot);

      const fallDir = _chopB.set(t.pos.x - player.pos.x, 0, t.pos.z - player.pos.z);
      if (fallDir.lengthSq() < 1e-4) fallDir.set(Math.sin(player.yaw + Math.PI), 0, Math.cos(player.yaw + Math.PI));
      fallDir.normalize();
      const axis = new THREE.Vector3(0, 1, 0).cross(fallDir).normalize();
      const len = Math.max(1e-3, (t.topY - cutY) * t.scale);
      const cosMax = THREE.MathUtils.clamp(-(cutY * t.scale) / len, -1, 1);
      const angMax = Math.min(Math.PI * 0.64, Math.acos(cosMax));

      chopFall.push({
        state: 'falling', pivot, baseQ: t.quat.clone(), axis,
        ang: 0.05, angVel: 0.25 + Math.random() * 0.2, angMax,
        baseScale: t.scale, len, pos: t.pos.clone(),
        wood: Math.max(1, Math.round((t.topY - cutY) * t.scale * 0.85 * power)),
        settleT: 0, vanishT: 0,
      });
    }




    const TREE_FRUITS = ['apple', 'orange', 'pear'];
    const TREE_FRUIT_CHANCE = 0.10;
    const TREE_SHAKE_SOUND = 'assets/audio/tree-shake.flac';
    const TREE_SHAKE_HOLD = 0.35;
    const TREE_SHAKE_FADE = 0.1;
    let treeShakeAudio = null;
    let treeShakeIdle = 0;

    function playTreeShakeSound() {
      if (!TREE_SHAKE_SOUND) return;
      try {
        if (!treeShakeAudio) {
          treeShakeAudio = new Audio(TREE_SHAKE_SOUND);
          treeShakeAudio.preload = 'auto';
        }
        treeShakeAudio.volume = 0.5 * masterVolume;
        if (treeShakeAudio.paused || treeShakeAudio.ended) {
          treeShakeAudio.currentTime = 0;
          treeShakeAudio.play().catch(() => {});
        }
        treeShakeIdle = 0;
      } catch (e) {}
    }

    function tickTreeShake(dt) {
      if (!treeShakeAudio) return;
      treeShakeIdle += dt;
      if (treeShakeAudio.paused) return;
      const want = treeShakeIdle < TREE_SHAKE_HOLD ? 0.5 * masterVolume : 0;
      const v = treeShakeAudio.volume + (want - treeShakeAudio.volume) * Math.min(1, dt / (want > 0 ? 0.04 : TREE_SHAKE_FADE));
      treeShakeAudio.volume = Math.max(0, v);
      if (want === 0 && v <= 0.002) { treeShakeAudio.pause(); treeShakeAudio.currentTime = 0; }
    }

    function shakeTreeForFruit() {
      _chopOrigin.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
      _chopDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _chopRay.set(_chopOrigin, _chopDir);
      _chopRay.far = REACH;
      const t = chopTarget();
      if (!t) return false;

      playTreeShakeSound();

      const owner = t.dyn || t.pl;
      owner.__fruit = owner.__fruit || TREE_FRUITS[(Math.random() * TREE_FRUITS.length) | 0];
      owner.__fruitDrops = owner.__fruitDrops || 0;
      if (owner.__fruitDrops < 2 && Math.random() < TREE_FRUIT_CHANCE) {
        owner.__fruitDrops++;
        _chopA.set(t.pos.x, t.pos.y + 0.3, t.pos.z);
        spawnDrop(owner.__fruit, 1, _chopA);
      }
      return true;
    }

    function tryChopTree(tool) {
      if (!tool.chop) return false;
      _chopOrigin.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
      _chopDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
      _chopRay.set(_chopOrigin, _chopDir);
      _chopRay.far = tool.chop.reach;
      const t = chopTarget();
      if (!t) return false;

      playTreeChopSound();
      const canCut = registerTreeChopHit(t, tool);
      triggerSwing(Math.min(0.5, Math.max(0.26, tool.rate * 0.9)));
      if (!canCut) return true;

      chopTree(t, tool.chop.power);
      return true;
    }

    function updateChop(dt) {
      for (let i = chopFall.length - 1; i >= 0; i--) {
        const r = chopFall[i];
        if (r.state === 'stump') {
          if (Math.hypot(r.pos.x - player.pos.x, r.pos.z - player.pos.z) > 90) removeDyn(r);
          continue;
        }
        if (r.state === 'falling') {

          const alpha = 9.0 / Math.max(0.35, r.len) * Math.sin(Math.min(Math.PI * 0.5, r.ang + 0.12));
          r.angVel += alpha * dt;
          r.ang += r.angVel * dt;
          const landed = r.ang >= r.angMax;
          if (landed) {
            r.ang = r.angMax;
            if (r.angVel > 1.1) r.angVel *= -0.22;
            else {
              r.angVel = 0; r.state = 'settle'; r.settleT = 0.9;
              shakeT = Math.max(shakeT, 0.16);
            }
          }
          _chopQ.setFromAxisAngle(r.axis, r.ang);
          r.pivot.quaternion.copy(r.baseQ).premultiply(_chopQ);
        } else if (r.state === 'settle') {
          r.settleT -= dt;
          if (r.settleT <= 0) { r.state = 'vanish'; r.vanishT = 0; }
        } else {
          r.vanishT += dt;
          const k = Math.max(0, 1 - r.vanishT / 0.35);
          r.pivot.scale.setScalar(r.baseScale * k);
          if (k <= 0.001) {
            scene.remove(r.pivot);
            disposeGroup(r.pivot);
            _chopA.set(r.pos.x, r.pos.y + 0.3, r.pos.z);
            spawnDrop('wood', r.wood, _chopA);
            chopFall.splice(i, 1);
          }
        }
      }
    }

    function vegCount() {
      let n = 0;
      for (const sp of VEG_SPECIES) n += sp.visible || 0;
      return n;
    }

    const player = {
      pos: new THREE.Vector3(0, 40, 0),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: -0.25,
      onGround: false,
      radius: 0.35,
      height: 1.72,
      eye: 1.62,
      oxygen: 1,
    };



    let flying = false;
    let lastSpaceTap = 0;

    const footsteps = createFootsteps();
    let stepAccum = 0;


    const AMBIENT_TRACKS = [
      'Sketchbook 2025-11-23.ogg',
      'Sketchbook 2025-11-26.ogg',
      'Sketchbook 2025-12-03.ogg',
      'Sketchbook 2025-12-17_CHILL.ogg',
      'Sketchbook 2025-12-17_SOFT.ogg',
    ].map((file) => ({
      src: `assets/audio/music/${encodeURIComponent(file)}`,
      name: file.replace(/\.ogg$/i, '').replace(/_/g, ' '),
      loops: /^Sketchbook 2025-12-17_(CHILL|SOFT)\.ogg$/i.test(file) ? 3 : 1,
    }));
    const AMBIENT_FADE = 12;
    const AMBIENT_LEVEL = 0.28;
    const AMBIENT_GAP = 10;
    const AMBIENT_SILENCE = 240;
    const AMBIENT_SILENCE_CHANCE = 0.35;
    const ambientAudio = new Audio();
    ambientAudio.preload = 'auto';
    ambientAudio.volume = 0;
    let ambientVol = 0;
    let ambientTrack = -1;
    let ambientWant = 0;
    let ambientCardTimer = 0;
    let ambientRetry = 0;
    let ambientCooldown = 0;
    let ambientLoopsLeft = 0;
    const nowPlayingEl = document.getElementById('nowPlaying');
    const nowPlayingNameEl = document.getElementById('nowPlayingName');

    function ambientTrackName(i) { return AMBIENT_TRACKS[i]?.name || 'UNKNOWN'; }
    function pickAmbientTrack() {
      if (AMBIENT_TRACKS.length < 2) return 0;
      let i = ambientTrack;
      for (let tries = 0; tries < 8 && i === ambientTrack; tries++) i = Math.floor(Math.random() * AMBIENT_TRACKS.length);
      if (i === ambientTrack) i = (ambientTrack + 1) % AMBIENT_TRACKS.length;
      return i;
    }
    function showNowPlaying(name) {
      if (!nowPlayingEl || !nowPlayingNameEl) return;
      nowPlayingNameEl.textContent = name;
      nowPlayingEl.classList.add('show');
      ambientCardTimer = 4.5;
    }
    function startAmbientTrack() {
      ambientTrack = pickAmbientTrack();
      const track = AMBIENT_TRACKS[ambientTrack];
      if (!track) return;
      ambientLoopsLeft = Math.max(0, (track.loops || 1) - 1);
      ambientAudio.src = track.src;
      ambientAudio.currentTime = 0;
      ambientAudio.volume = Math.max(0, Math.min(1, ambientVol * masterVolume));
      const p = ambientAudio.play();
      if (p && typeof p.then === 'function') p.then(() => showNowPlaying(track.name)).catch(() => {});
      else showNowPlaying(track.name);
    }
    ambientAudio.addEventListener('ended', () => {
      if (!isDay()) return;
      if (ambientLoopsLeft > 0) {
        ambientLoopsLeft -= 1;
        ambientAudio.currentTime = 0;
        const p = ambientAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
        return;
      }
      ambientCooldown = AMBIENT_GAP + (Math.random() < AMBIENT_SILENCE_CHANCE ? AMBIENT_SILENCE : 0);
    });
    function updateAmbientMusic(dt) {
      const want = isDay() && musicEnabled ? AMBIENT_LEVEL : 0;
      ambientWant = want;
      if (ambientRetry > 0) ambientRetry -= dt;
      if (want > 0) {
        if (ambientCooldown > 0) ambientCooldown -= dt;
        if (ambientAudio.paused && ambientRetry <= 0 && ambientCooldown <= 0) {
          ambientRetry = 1.5;
          startAmbientTrack();
        }
      } else {
        ambientCooldown = 0;
      }
      const step = dt / AMBIENT_FADE;
      if (ambientVol < want) ambientVol = Math.min(want, ambientVol + step);
      else if (ambientVol > want) ambientVol = Math.max(want, ambientVol - step);
      ambientAudio.volume = Math.max(0, Math.min(1, ambientVol * masterVolume));
      if (ambientVol <= 0.001 && want === 0 && !ambientAudio.paused) {
        ambientAudio.pause();
        ambientAudio.currentTime = 0;
      }
      if (ambientCardTimer > 0) {
        ambientCardTimer -= dt;
        if (ambientCardTimer <= 0 && nowPlayingEl) nowPlayingEl.classList.remove('show');
      }
    }

    const MACHINE_LOCKERS = new Set(['armor_workbench', 'gun_workbench', 'medicine_workbench']);
    const MACHINE_AMBIENT_VOL = 0.12;
    const MACHINE_REACTOR_VOL = 0.14;
    const MACHINE_SOUND_RANGE = 35;
    const machineAmbientAudio = new Audio('assets/audio/machines/industrial-ambience.mp3');
    machineAmbientAudio.loop = true;
    machineAmbientAudio.preload = 'auto';
    machineAmbientAudio.volume = 0;
    const machineReactorAudio = new Audio('assets/audio/machines/reactor-cycle.mp3');
    machineReactorAudio.loop = true;
    machineReactorAudio.preload = 'auto';
    machineReactorAudio.volume = 0;
    let machineAmbientVol = 0;
    let machineReactorVol = 0;

    function machineWorkKind(m) {
      if (!m?.def || MACHINE_LOCKERS.has(m.def.id)) return null;
      const st = m.state?.status || '';
      const busy = /^(GENERATING|RUNNING|CRAFTING|DRILLING|MINING|ABSORBING|SCRUBBING|CRANKING|PUMPING|STARTED|BATTERY\b|OPTIMAL|OVERCOOLED|UNDERCOOLED|OVERHEATING|NO COOLANT|COOLING)/.test(st);
      if (!busy) return null;
      return m.def.kind === 'reactor' ? 'reactor' : 'industrial';
    }

    function updateMachineSounds(dt) {
      let wantIndustrial = 0;
      let wantReactor = 0;
      if (machineSystem && player?.pos) {
        const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
        for (const m of machineSystem.instances) {
          const k = machineWorkKind(m);
          if (!k) continue;
          const dx = m.x - px, dy = (m.y || 0) - py, dz = m.z - pz;
          const gain = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / MACHINE_SOUND_RANGE);
          if (gain <= 0) continue;
          if (k === 'reactor') wantReactor = Math.max(wantReactor, MACHINE_REACTOR_VOL * gain);
          else wantIndustrial = Math.max(wantIndustrial, MACHINE_AMBIENT_VOL * gain);
        }
      }
      const step = dt / 0.8;
      if (machineAmbientVol < wantIndustrial) machineAmbientVol = Math.min(wantIndustrial, machineAmbientVol + step);
      else if (machineAmbientVol > wantIndustrial) machineAmbientVol = Math.max(wantIndustrial, machineAmbientVol - step);
      if (machineReactorVol < wantReactor) machineReactorVol = Math.min(wantReactor, machineReactorVol + step);
      else if (machineReactorVol > wantReactor) machineReactorVol = Math.max(wantReactor, machineReactorVol - step);
      machineAmbientAudio.volume = Math.max(0, Math.min(1, machineAmbientVol * masterVolume));
      machineReactorAudio.volume = Math.max(0, Math.min(1, machineReactorVol * masterVolume));
      for (const [a, vol, want] of [[machineAmbientAudio, machineAmbientVol, wantIndustrial], [machineReactorAudio, machineReactorVol, wantReactor]]) {
        if (want > 0 && a.paused) { const p = a.play(); if (p?.catch) p.catch(() => {}); }
        else if (want <= 0 && vol <= 0.001 && !a.paused) { a.pause(); a.currentTime = 0; }
      }
    }

    const stepPrev = new THREE.Vector3().copy(player.pos);

    function validSpawnPos(x, y, z) {
      if (Number.isNaN(y) || !Number.isFinite(y)) return false;
      if (biomeAt(x, z) !== B.PLAINS) return false;
      if (industrialInside(x, z)) return false;
      if (world.isUnderwater(x, y + 0.2, z)) return false;
      if (world.surfaceAt(x, z) > y + 0.1) return false;
      return world.field.sample(x, y + 0.5, z) <= 0;
    }

    const worldPickups = [];
    const machineActivators = [];
    let activeInteractTarget = null;
    let pendingInteractTarget = null;
    let pendingInteractSince = 0;
    const outlineTargets = [];
    const INTERACT_PROMPT_DELAY_MS = 220;
    const REACH = 7;




    const interactRay = new THREE.Raycaster();
    const _interactNdc = new THREE.Vector2(0, 0);

    function bindInteractEntry(mesh, entry) {
      if (!mesh || !entry) return mesh;

      mesh.userData.interactEntry = entry;
      return mesh;
    }

    function findInteractEntry(object) {
      for (let o = object; o; o = o.parent) {
        if (o.userData && o.userData.interactEntry) return o.userData.interactEntry;
      }
      return null;
    }

    function addOutlineToMesh(mesh, scale = 1.08, color = 0xffffff) {
      if (!mesh || mesh.userData.outlineRoot) return mesh;
      const root = new THREE.Group();
      root.visible = false;
      root.userData.outlineRoot = true;
      root.userData.owner = mesh;
      mesh.userData.outlineRoot = root;

      const pushOutline = (source) => {
        if (!source) return;
        if (source.isSprite) {
          const outline = new THREE.Sprite(new THREE.SpriteMaterial({
            map: source.material.map,
            color,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            depthTest: true,
          }));
          outline.position.copy(source.position);
          outline.center.copy(source.center);
          outline.scale.copy(source.scale).multiplyScalar(scale);
          outline.renderOrder = 100;


          outline.raycast = () => {};
          root.add(outline);
          return;
        }
        if (!source.isMesh || !source.geometry) return;
        const outline = new THREE.Mesh(
          source.geometry,
          new THREE.MeshBasicMaterial({
            color,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            depthTest: true,
          })
        );
        outline.position.copy(source.position);
        outline.rotation.copy(source.rotation);
        outline.quaternion.copy(source.quaternion);
        outline.scale.copy(source.scale).multiplyScalar(scale);
        outline.renderOrder = 100;


        outline.raycast = () => {};
        root.add(outline);
      };

      if (mesh.isSprite) pushOutline(mesh);
      else if (mesh.isMesh) pushOutline(mesh);
      else mesh.traverse((child) => pushOutline(child));
      if (mesh.parent) mesh.parent.add(root);
      outlineTargets.push(root);
      return mesh;
    }

    function setOutlineVisible(target, visible) {
      if (!target) return;
      const root = target.mesh ? target.mesh.userData.outlineRoot : target.userData?.outlineRoot;
      if (root) root.visible = !!visible;
    }

    function hideAllOutlines() {
      for (const root of outlineTargets) root.visible = false;
    }

    const _pickupGeo = new THREE.SphereGeometry(0.28, 10, 10);
    const _pickupMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
    function makePickupMesh(itemId) {
      const mesh = new THREE.Mesh(_pickupGeo, _pickupMat);
      // Hit target only: it has no visible surface, so keep it out of the render list.
      // Raycaster ignores `visible`, so the interact prompt still works.
      mesh.visible = false;
      mesh.userData.itemId = itemId;
      // No outline: the root was never parented to the scene, so it could never draw.
      return mesh;
    }

    function registerPickup({ x, y, z, itemId = 'flower', count = 1, radius = 0.9, label = 'Pick flower' }) {
      const pickup = {
        x, y, z,
        itemId,
        count,
        radius,
        label,
        mesh: makePickupMesh(itemId),
        activate() {

          if (pickup.__vegLayer && !hasGardeningGloves()) { notice('NEED GARDENING GLOVES'); return; }

          if (!bagRoomFor(itemId, count)) { notice('INVENTORY FULL'); return; }
          give(itemId, count);
          achBump('harvested');

          if (pickup.__vegLayer && pickup.__vegCellKey) {
            const layerMap = _vegActive[pickup.__vegLayer];
            const pl = layerMap && layerMap.get(pickup.__vegCellKey);
            if (pl) {
              layerMap.delete(pickup.__vegCellKey);
              vegRemove(pl.sp, pickup.__vegCellKey);
            }
            _vegHarvested.add(`${pickup.__vegLayer}:${pickup.__vegCellKey}`);
          }

          const idx = worldPickups.indexOf(pickup);
          if (idx >= 0) worldPickups.splice(idx, 1);
          if (pickup.mesh.parent) pickup.mesh.parent.remove(pickup.mesh);
          if (pickup.mesh.userData.outlineRoot && pickup.mesh.userData.outlineRoot.parent) {
            pickup.mesh.userData.outlineRoot.parent.remove(pickup.mesh.userData.outlineRoot);
          }
          const outIdx = outlineTargets.indexOf(pickup.mesh.userData.outlineRoot);
          if (outIdx >= 0) outlineTargets.splice(outIdx, 1);
        }
      };
      pickup.mesh.position.set(x, y, z);
      if (pickup.mesh.userData.outlineRoot) {
        pickup.mesh.userData.outlineRoot.position.copy(pickup.mesh.position);
      }
      bindInteractEntry(pickup.mesh, { target: pickup, type: 'pickup', label: pickup.label, activate: () => pickup.activate() });
      scene.add(pickup.mesh);
      worldPickups.push(pickup);
      return pickup;
    }

    function registerMachine({ x, y, z, radius = 1.4, label = 'Open', onActivate, mesh: suppliedMesh }) {
      const mesh = suppliedMesh || new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x8da0ff, emissive: 0x1d2d7a, emissiveIntensity: 0.22 })
      );
      if (!suppliedMesh) mesh.position.set(x, y, z);
      addOutlineToMesh(mesh, 1.08, 0xffffff);
      scene.add(mesh);
      const machine = {
        x, y, z,
        radius,
        label,
        onActivate,
        mesh,
        activate() {
          if (typeof onActivate === 'function') onActivate();
        }
      };
      bindInteractEntry(mesh, { target: machine, type: 'machine', label: machine.label, activate: () => machine.activate() });
      machineActivators.push(machine);
      return machine;
    }

    function resolveInteractTarget() {
      if (!camera) return null;


      interactRay.setFromCamera(_interactNdc, camera);
      interactRay.far = REACH;

      const roots = [];
      const eye = camera.position;
      for (const pickup of worldPickups) {
        if (pickup.__vegLayer && !hasGardeningGloves()) continue;
        const dx = pickup.x - eye.x, dy = pickup.y - eye.y, dz = pickup.z - eye.z;
        const r = REACH + (pickup.radius || 0.9);
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        if (pickup.mesh) roots.push(pickup.mesh);
      }
      for (const machine of machineActivators) {
        if (!machine.mesh) continue;
        const dx = machine.x - eye.x, dy = machine.y - eye.y, dz = machine.z - eye.z;
        const r = REACH + (machine.radius || 1.4);
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        roots.push(machine.mesh);
      }
      if (!roots.length) return null;

      const hits = interactRay.intersectObjects(roots, true);
      for (const hit of hits) {
        const entry = findInteractEntry(hit.object);
        if (!entry) continue;
        return {
          target: entry.target,
          type: entry.type,
          label: entry.label,
          activate: entry.activate,
          screenDist: 0,
          t: hit.distance,
          hitPos: hit.point,
        };
      }
      return null;
    }

    let _interactResolveAt = 0, _interactResolved = null;
    function refreshInteractPrompt() {
      if (sleep || drive) { hideAllOutlines(); activeInteractTarget = null; pendingInteractTarget = null; pendingInteractSince = 0; _interactResolved = null; hideTip(); return; }
      if (mineConfirm && (performance.now() - mineConfirm.t) > MINE_CONFIRM_MS) clearMineConfirm();
      if (player.vel.lengthSq() > 0.1) {
        if (activeInteractTarget || pendingInteractTarget) {
          hideAllOutlines();
          activeInteractTarget = null;
          pendingInteractTarget = null;
          pendingInteractSince = 0;
          hideTip();
        }
        return;
      }
      if (!locked || invOpen || mapSystem?.isOpen()) {
        if (activeInteractTarget || pendingInteractTarget) {
          hideAllOutlines();
          activeInteractTarget = null;
          pendingInteractTarget = null;
          pendingInteractSince = 0;
          hideTip();
        }
        return;
      }
      const _now = performance.now();
      if (_now - _interactResolveAt > 80) { _interactResolved = resolveInteractTarget(); _interactResolveAt = _now; }
      const target = _interactResolved;
      if (!target) {
        if (activeInteractTarget || pendingInteractTarget) {
          hideAllOutlines();
          activeInteractTarget = null;
          pendingInteractTarget = null;
          pendingInteractSince = 0;
          hideTip();
        }
        return;
      }

      if (pendingInteractTarget !== target.target) {
        pendingInteractTarget = target.target;
        pendingInteractSince = performance.now();
        hideAllOutlines();
        hideTip();
        if (activeInteractTarget) activeInteractTarget = null;
        return;
      }

      const dwell = performance.now() - pendingInteractSince;
      if (dwell < INTERACT_PROMPT_DELAY_MS) {
        if (activeInteractTarget) {
          hideAllOutlines();
          activeInteractTarget = null;
        }
        hideTip();
        return;
      }

      if (activeInteractTarget?.target !== target.target) {
        hideAllOutlines();
        setOutlineVisible(target.target, true);
      }
      activeInteractTarget = target;
      tipTitle.textContent = target.label.toUpperCase();
      tipBody.innerHTML = target.type === 'door'
        ? 'RIGHT CLICK<br>OPEN / CLOSE DOOR'
        : 'RIGHT CLICK<br>ACTIVATE / OPEN';
      tipEl.style.display = 'block';
      moveTip(innerWidth * 0.5, innerHeight * 0.72);
    }

    function useInteractable() {
      const target = resolveInteractTarget();
      if (!target) return false;
      const done = target.activate();


      if (target.type === 'door' && done === false) return false;
      activeInteractTarget = null;
      hideTip();
      return true;
    }



    function spawnOnGround(x, z) {




      let found = null;
      if (biomeAt(x, z) === B.PLAINS) {
        let y = world.getSurfaceHeight(x, z, 90);
        for (let i = 0; i < 14 && world.field.sample(x, y + 0.5, z) > 0; i++) y += 1;
        if (validSpawnPos(x, y + 0.2, z)) found = { x, y: y + 0.2, z };
      }
      found = found || findPlainsSpawn(x, z);


      if (!found) return;
      player.pos.set(found.x, found.y, found.z);
      player.vel.set(0, 0, 0);
    }



    function findPlainsSpawn(x, z, maxR = 1024, step = 16) {
      for (let r = 0; r <= maxR; r += step) {
        for (let d = -r; d <= r; d += step) {
          const pts = r === 0 ? [[x, z]] : [[x + d, z - r], [x + d, z + r], [x - r, z + d], [x + r, z + d]];
          for (const [cx, cz] of pts) {
            if (biomeAt(cx, cz) !== B.PLAINS) continue;
            let y = world.getSurfaceHeight(cx, cz, 90);
            for (let i = 0; i < 14 && world.field.sample(cx, y + 0.5, cz) > 0; i++) y += 1;
            if (validSpawnPos(cx, y + 0.2, cz)) return { x: cx, y: y + 0.2, z: cz };
          }
        }
      }
      return null;
    }


    let originSpawn = null;
    function spawnAtOrigin() {
      if (!originSpawn || !validSpawnPos(originSpawn.x, originSpawn.y, originSpawn.z)) {
        originSpawn = findPlainsSpawn(0, 0);
      }
      if (originSpawn) {
        player.pos.set(originSpawn.x, originSpawn.y, originSpawn.z);
        player.vel.set(0, 0, 0);
      } else {
        spawnOnGround(0, 0);
      }
    }


    const saved = savedData;
    if (saved) world.applySave(saved);
    if (mapSystem && nuclearStrikes.length) {
      for (const s of nuclearStrikes) {
        if (!mapSystem.strikes.some((ms) => Math.hypot(ms.x - s.x, ms.z - s.z) < 12)) mapSystem.noteStrike(s.x, s.z, s.day, s.r);
      }
    }
    if (saved && Number.isFinite(saved.playTime)) playTime = Math.max(0, saved.playTime);
    else if (saved) {
      const d = Number.isInteger(saved.day) && saved.day > 0 ? saved.day : 1;
      const t = Number.isFinite(saved.dayT) ? Math.max(0, saved.dayT) : 0;
      playTime = Math.max(0, (d - 1) * TUNING.DAY_SECONDS + t);
    }
    if (saved && saved.guide !== undefined) {
      if (saved.guide === null) guideIndex = GUIDE_STEPS.length;
      else {
        const i = GUIDE_STEPS.findIndex((s) => s.id === saved.guide);
        if (i >= 0) guideIndex = i;
      }
    }
    if (saved && saved.achievements) loadAchievements(saved.achievements);
    if (saved && saved.seed !== undefined) WORLD_SEED = saved.seed;
    if (WORLD_TERRAIN === 'realistic') {


      realisticTerrain().recenter(
        (saved?.player?.[0] ?? 0.5) + WORLD_SEED,
        (saved?.player?.[2] ?? 0.5) + WORLD_SEED,
      );
    }
    if (saved && saved.player && saved.player.slice(0, 3).every(Number.isFinite)) {
      player.pos.set(saved.player[0], saved.player[1], saved.player[2]);
      player.yaw = saved.player[3] || 0;
      player.pitch = saved.player[4] || 0;
      // A saved player may stand in any biome or on any pad; only lift them out of solid ground.
      for (let i = 0; i < 14 && world.field.sample(player.pos.x, player.pos.y + 0.5, player.pos.z) > 0; i++) {
        player.pos.y += 1;
      }
      player.vel.set(0, 0, 0);
    } else {
      if (saved) world.field.edits.clear();
      spawnOnGround(0.5, 0.5);
    }



    mapSystem = new MapSystem({
      player: () => ({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }),
      clock: () => ({ ...clock, daySeconds: TUNING.DAY_SECONDS }),
      seaLevel: SEA_LEVEL,
      sample: (x, z) => ({
        h: terrainTrend(x + WORLD_SEED, z + WORLD_SEED),
        biome: biomeAt(x, z),
      }),

      surfaceColor: (x, z, h) => (
        WORLD_TERRAIN === 'realistic'
          ? realisticTerrain().mapColor(x + WORLD_SEED, z + WORLD_SEED, h, BIOME_DEFS[biomeAt(x, z)])
          : h - SEA_LEVEL > 30
            ? [0.33, 0.32, 0.36]
            : (BIOME_DEFS[biomeAt(x, z)]?.top || [0.4, 0.5, 0.3])
      ),
      industrialCell: IND_CELL,
      industrialDims: IND_DIMS,
      industrialSite,
      machines: () => (machineSystem ? machineSystem.instances : []),
      walls: () => (buildingSystem ? buildingSystem.pieces.values() : []),
      notice: (msg) => notice(msg),
      save: () => queueSave('map'),
      onShow: () => {
        unlockPointer();
        setOverlay(false);
      },
      onHide: (relock) => {
        setOverlay(false);
        if (relock) lockPointer();
        else setOverlay(true);
      },
    });
    if (saved && saved.seed !== undefined) mapSystem.restore(saved.map);


    machineSystem = new MachineSystem({
      THREE, scene, world, player, inv, ITEMS, give, giveStack, spawnDrop,
      icon: (id) => itemIconUrl(id),
      onCraft: (id, n) => achCraft(id, n),
      showTip: (s, x, y) => showTip(s, x, y),
      hideTip: () => hideTip(),
      syncBars,
      bagRoomFor,
      notice: (msg) => notice(msg),
      mineDrops, groundBand, biomeAt, savannaBiome: B.SAVANNA,
      defs: MACHINE_DEFS, byId: MACHINE_BY_ID, craftRecipes: CRAFT_RECIPES, layoutFor,
      GLTFLoader, registerMachine, machineActivators,
      ui: workbenchUI,
      isDay,
      startSleep: (inst) => startSleep(inst),
      startDrive: (inst) => startDrive(inst),
      onOpen: () => { unlockPointer(); setOverlay(false); },
      onClosed: () => { lockPointer(); },
      explode: (x, y, z, r) => {

        inv.dose += 120;
        hurt(30, 'burn');
        shakeT = 1.2;
      },
    });
    machineSystem.load().then(() => {
      if (saved && saved.machines && saved.machines.length) machineSystem.restore(saved.machines);
      if (saved && saved.guide === undefined) migrateGuideFromMachines();
      backfillAchievements();
      if (saved && saved.skyline && saved.skyline.length) skylineSystem.restore(saved.skyline);
    }).catch((e) => console.warn('machine load failed', e));


    const skylineSystem = new SkylineSystem({
      THREE, scene, items: ITEMS, machines: machineSystem, craftRecipes: CRAFT_RECIPES,
      GLTFLoader,
      icon: (id) => itemIconUrl(id),
      showTip: (s, x, y) => showTip(s, x, y),
      hideTip: () => hideTip(),
      notice: (msg) => notice(msg),
      onOpen: () => { unlockPointer(); setOverlay(false); },
      onClosed: () => { lockPointer(); },
    });

    const pipeSystem = new PipeSystem({ THREE, scene, GLTFLoader, give });
    pipeSystem.load().then(() => {
      if (saved && saved.pipes) pipeSystem.restore(saved.pipes);
    }).catch((e) => console.warn('pipe load failed', e));

    const buildingSystem = new BuildingSystem({ THREE, scene, give, world });
    machineSystem.ctx.buildingSystem = buildingSystem;
    buildingSystem.load();
    if (saved && saved.buildings) buildingSystem.restore(saved.buildings);

    window.NUCLEARISM = { ITEMS, inv, vitals, hurt, addWound, clock, get nuclearStrikes() { return nuclearStrikes; }, get machineSystem() { return machineSystem; }, get pipeSystem() { return pipeSystem; }, get mapSystem() { return mapSystem; }, get buildingSystem() { return buildingSystem; }, get player() { return player; }, get camera() { return camera; }, get scene() { return scene; }, get renderer() { return renderer; }, get world() { return world; }, give, giveStack, Liquid, LIQUIDS: LIQUID_DEFS, caveAt: (x, y, z) => caveCarveAt(x + WORLD_SEED, y, z + WORLD_SEED), spawnNuclearStrike, biomeAt, B, get veg() { const f = VEG_SPECIES.find(s => s.n === 'flower_field'); return { ready: VEG_SPECIES.filter(s => s.ready).length, total: VEG_SPECIES.length, flowerReady: !!f?.ready, flowerVisible: f?.visible || 0, flowerPlacements: f?.placements?.size || 0, flowerCap: f?.cap || 0 }; } };





    const keys = Object.create(null);
    let locked = false;



    let lookBlockedUntil = 0;
    let lookSkipEvents = 0;
    function blockLook(ms = 150, events = 1) {
      lookBlockedUntil = Math.max(lookBlockedUntil, performance.now() + ms);
      lookSkipEvents = Math.max(lookSkipEvents, events);
    }
    let wireframe = false;
    let wipeSave = false;

    const overlay = document.getElementById('overlay');
    let overlayTimer = 0;



    function setOverlay(show) {
      clearTimeout(overlayTimer);
      if (show) {
        overlay.style.display = 'flex';
        overlay.classList.add('closing');
        void overlay.offsetWidth;
        overlay.classList.remove('closing');
      } else {
        overlay.classList.add('closing');
        overlayTimer = setTimeout(() => { overlay.style.display = 'none'; }, 190);
      }
    }

    const introEl = document.getElementById('intro');
    const introBtn = document.getElementById('introBegin');
    let introOpen = false;
    let introFirstRun = false;

    function introSeenKey() {
      return MENU_WORLD ? `idte.intro.v1.${MENU_WORLD.id}` : 'idte.intro.v1';
    }

    let _introSeen = (await idbGet(introSeenKey())) === '1';

    function markIntroSeen() {
      _introSeen = true;
      idbSet(introSeenKey(), '1').catch(() => { });
    }

    function flashGuideCard() {
      if (!objectiveEl) return;
      objectiveEl.classList.remove('intro-pulse');
      void objectiveEl.offsetWidth;
      objectiveEl.classList.add('intro-pulse');
      setTimeout(() => objectiveEl.classList.remove('intro-pulse'), 5000);
    }

    function openIntro(firstRun) {
      if (!introEl) return;
      introOpen = true;
      introFirstRun = !!firstRun;
      introEl.classList.remove('hidden');


      if (!overlay.classList.contains('loading-mode')) setOverlay(false);
      unlockPointer();
      if (introBtn) introBtn.textContent = introBtn.disabled ? 'LOADING' : 'ENTER THE ZONE';
    }

    function closeIntro() {
      if (!introOpen) return;
      introOpen = false;
      introEl.classList.add('hidden');
      markIntroSeen();
      const first = introFirstRun;
      introFirstRun = false;
      if (first) flashGuideCard();


      if (overlay.classList.contains('loading-mode') && window.__NUCLEARISM_FINISH_LOADING__) {
        window.__NUCLEARISM_FINISH_LOADING__();
        return;
      }
      if (first) {
        lockPointer();
      } else {
        setOverlay(true);
      }
    }

    function maybeShowIntro() {
      if (!introEl || WORLD_MODE !== 'survival') return;
      if (!_introSeen) openIntro(true);
    }

    introBtn?.addEventListener('click', () => { if (!introBtn.disabled) closeIntro(); });

    const prayModal = document.getElementById('prayModal');
    const prayBtn = document.getElementById('prayBtn');
    const prayStatus = document.getElementById('prayStatus');
    const prayOath = document.getElementById('prayOath');
    const prayOathPrompt = document.getElementById('prayOathPrompt');
    const prayOptions = document.getElementById('prayOptions');
    const prayInput = document.getElementById('prayInput');
    const prayCount = document.getElementById('prayCount');
    const praySug = document.getElementById('praySug');
    let prayOpen = false;
    let praySel = -1;
    let prayMatches = [];
    const PRAY_OATH = 'i swear that i trust 27';

    function praySetOathMode(on) {
      if (prayOath) prayOath.style.display = on ? '' : 'none';
      if (prayOathPrompt) prayOathPrompt.style.display = on ? '' : 'none';
      if (prayOptions) prayOptions.style.display = on ? 'none' : '';
    }

    function formatPrayTime(sec) {
      const s = Math.max(0, Math.ceil(sec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${String(r).padStart(2, '0')}`;
    }

    function paintPray() {
      if (!prayModal) return;
      const left = Math.max(0, prayReadyAt - playTime);
      const ready = left <= 0;
      if (prayBtn) {
        prayBtn.disabled = !ready;
        prayBtn.textContent = ready ? 'PRAY' : 'COOLDOWN';
      }
      if (prayStatus) prayStatus.textContent = ready ? 'READY' : `COOLDOWN ${formatPrayTime(left)}`;
    }

    function renderPraySug() {
      if (!praySug) return;
      praySel = prayMatches.length ? 0 : -1;
      if (!prayMatches.length) { praySug.classList.add('hidden'); praySug.innerHTML = ''; return; }
      praySug.innerHTML = prayMatches.map((id, i) =>
        `<div class="row${i === praySel ? ' sel' : ''}" data-id="${id}"><span>${itemLabel(id)}</span><span class="id">${id}</span></div>`
      ).join('');
      praySug.classList.remove('hidden');
    }

    function updatePraySug() {
      if (!prayInput) return;
      const q = prayInput.value.trim();
      prayMatches = q ? nearestItems(q) : [];
      renderPraySug();
    }

    function completePray(id) {
      if (!prayInput) return;
      prayInput.value = id;
      prayMatches = [];
      if (praySug) { praySug.classList.add('hidden'); praySug.innerHTML = ''; }
      prayInput.focus();
    }

    function openPray() {
      if (!prayModal || prayOpen) return;
      closeAllMenus();
      prayOpen = true;
      prayModal.classList.remove('hidden');
      setOverlay(false);
      unlockPointer();
      if (prayOath) prayOath.value = '';
      if (prayInput) prayInput.value = '';
      if (prayCount) prayCount.value = '1';
      prayMatches = [];
      if (praySug) { praySug.classList.add('hidden'); praySug.innerHTML = ''; }
      praySetOathMode(true);
      paintPray();
      setTimeout(() => prayOath?.focus(), 0);
    }

    function closePray() {
      if (!prayOpen) return;
      prayOpen = false;
      prayModal.classList.add('hidden');
      if (prayInput) prayInput.value = '';
      if (prayCount) prayCount.value = '1';
      if (prayOath) prayOath.value = '';
      prayMatches = [];
      if (praySug) { praySug.classList.add('hidden'); praySug.innerHTML = ''; }
      praySetOathMode(true);
      lockPointer();
    }

    function doGive() {
      const nameQ = (prayInput?.value || '').trim();
      if (!nameQ) return;
      const id = resolveItem(nameQ);
      if (!id) { notice(`NO ITEM "${nameQ}"`); return; }
      let n = parseInt(prayCount?.value || '1', 10);
      if (!Number.isFinite(n) || n < 1) n = 1;
      const left = give(id, n);
      notice(`+${n - (left || 0)} ${itemLabel(id)}`);
      if (prayInput) prayInput.value = '';
      if (prayCount) prayCount.value = '1';
      prayMatches = [];
      if (praySug) { praySug.classList.add('hidden'); praySug.innerHTML = ''; }
      queueSave('pray');
    }

    function doPray() {
      if (playTime < prayReadyAt) { paintPray(); return; }
      const nameQ = (prayInput?.value || '').trim();
      if (nameQ) {
        const id = resolveItem(nameQ);
        if (id) {
          let n = parseInt(prayCount?.value || '1', 10);
          if (!Number.isFinite(n) || n < 1) n = 1;
          const left = give(id, n);
          notice(`+${n - (left || 0)} ${itemLabel(id)}`);
        } else {
          notice(`NO ITEM "${nameQ}"`);
        }
      }
      inv.dose = 0;
      vitals.wounds = Object.create(null);
      prayReadyAt = playTime + 30 * 60;
      if (prayInput) prayInput.value = '';
      if (prayCount) prayCount.value = '1';
      prayMatches = [];
      if (praySug) { praySug.classList.add('hidden'); praySug.innerHTML = ''; }
      paintRad();
      paintVitals();
      syncBars();
      paintPray();
      queueSave('pray');
    }

    prayBtn?.addEventListener('click', doPray);

    prayOath?.addEventListener('input', () => {
      const v = (prayOath.value || '').trim().toLowerCase();
      if (v === PRAY_OATH) {
        praySetOathMode(false);
        setTimeout(() => prayInput?.focus(), 0);
      }
    });
    prayOath?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePray(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = (prayOath.value || '').trim().toLowerCase();
        if (v === PRAY_OATH) {
          praySetOathMode(false);
          setTimeout(() => prayInput?.focus(), 0);
        }
      }
    });

    prayInput?.addEventListener('input', updatePraySug);
    prayInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (praySel >= 0 && prayMatches[praySel]) completePray(prayMatches[praySel]);
        else doGive();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); closePray(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (prayMatches.length) praySel = (praySel + 1) % prayMatches.length;
        renderPraySug();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (prayMatches.length) praySel = (praySel - 1 + prayMatches.length) % prayMatches.length;
        renderPraySug();
      } else if (e.key === 'Tab') {
        if (praySel >= 0 && prayMatches[praySel]) { e.preventDefault(); completePray(prayMatches[praySel]); }
      }
    });
    praySug?.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      e.preventDefault();
      completePray(row.dataset.id);
    });

    document.getElementById('playBtn').addEventListener('click', () => {
      lockPointer();
    });

    document.getElementById('manualBtn')?.remove();

    const saveFailEl = document.getElementById('saveFail');
    const saveFailMsgEl = document.getElementById('saveFailMsg');
    const saveFailDownloadBtn = document.getElementById('saveFailDownload');
    const saveFailRetryBtn = document.getElementById('saveFailRetry');
    const saveFailQuitBtn = document.getElementById('saveFailQuit');
    const saveFailBackBtn = document.getElementById('saveFailBack');
    let saveFailPendingQuit = false;

    function downloadSaveFile() {
      let payload = world.lastSavePayload;
      if (!payload || !payload.json) payload = world.buildSave(player);
      if (!payload || !payload.json) {
        notice('NO SAVE DATA TO DOWNLOAD');
        return false;
      }
      try {
        const name = (WORLD_NAME || 'world').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'world';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([payload.json], { type: 'application/json' }));
        a.download = `${name}-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        notice('SAVE FILE DOWNLOADED');
        return true;
      } catch (e) {
        console.error('[save] download failed', e);
        notice('DOWNLOAD FAILED');
        return false;
      }
    }

    function showSaveFailModal(pendingQuit = false, err) {
      saveFailPendingQuit = !!pendingQuit;
      const quota = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || '') || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      const bytes = world.lastSavePayload?.json?.length;
      const size = Number.isFinite(bytes) ? ` (${Math.ceil(bytes / 1024)} KB)` : '';
      if (saveFailMsgEl) {
        saveFailMsgEl.textContent = quota
          ? `Browser storage is full, so the game could not save${size}.`
          : `The game could not save to browser storage${size}.`;
      }
      if (saveFailQuitBtn) saveFailQuitBtn.style.display = saveFailPendingQuit ? '' : 'none';
      if (saveFailBackBtn) saveFailBackBtn.textContent = saveFailPendingQuit ? 'CANCEL' : 'CLOSE';
      if (saveFailEl) saveFailEl.classList.remove('hidden');
    }

    function hideSaveFailModal() {
      saveFailPendingQuit = false;
      if (saveFailEl) saveFailEl.classList.add('hidden');
    }

    async function trySaveOrWarn(reason, pendingQuit = false) {
      if (wipeSave) return true;
      const ok = await world.save(player);
      console.info(`[save] trigger=${reason} ok=${ok}`);
      if (ok) return true;
      showSaveFailModal(pendingQuit, world.lastSaveError);
      return false;
    }

    saveFailDownloadBtn?.addEventListener('click', () => { downloadSaveFile(); });
    saveFailRetryBtn?.addEventListener('click', async () => {
      const wasQuit = saveFailPendingQuit;
      const ok = await trySaveOrWarn('retry', wasQuit);
      if (ok) {
        hideSaveFailModal();
        if (wasQuit) location.reload();
      }
    });
    saveFailQuitBtn?.addEventListener('click', () => {
      hideSaveFailModal();
      location.reload();
    });
    saveFailBackBtn?.addEventListener('click', () => {
      const wasQuit = saveFailPendingQuit;
      hideSaveFailModal();
      if (wasQuit) setOverlay(true);
    });

    document.getElementById('menuBtn').addEventListener('click', async () => {
      if (wipeSave) { location.reload(); return; }
      const ok = await trySaveOrWarn('menu', true);
      if (ok) location.reload();
    });


    const mainView = document.querySelector('#overlay .view-main');
    const settingsView = document.querySelector('#overlay .view-settings');
    document.getElementById('settingsBtn').addEventListener('click', () => {
      mainView.classList.add('hidden');
      settingsView.classList.remove('hidden');
    });
    document.getElementById('backBtn').addEventListener('click', () => {
      settingsView.classList.add('hidden');
      mainView.classList.remove('hidden');
    });

    renderSettings(document.getElementById('overlaySettings'));
    onSettingsChange((id, v) => {
      if (id === 'renderDistance') viewRadius = Math.min(MAX_RENDER_DISTANCE, v);
      else if (id === 'infoHud') showInfoHud = v;
      else if (id === 'vsync') vsync = v;
      else if (id === 'volume') masterVolume = v;
      else if (id === 'music') musicEnabled = v;
      else if (id === 'sensitivity') mouseSens = v;
      else if (id === 'invertY') invertY = v;
      else if (id === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); }
      else if (id === 'resolution') { PIXEL = v; applyPixelSize(); }
      else if (id === 'colorLevels') { COLOR_LEVELS = v; postMat.uniforms.uLevels.value = v; }
    });

    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === renderer.domElement;
      blockLook();


      if (overlay.classList.contains('loading-mode')) return;
      setOverlay(!locked && !introOpen && !prayOpen && !invOpen && !cmdOpen && !mapSystem?.isOpen() && !recipeOpen && !visibleTree() && !workbenchUI.opened && !skylineSystem?.isOpen() && !achieveOpen);
      if (!locked) {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
      }
    });

    document.addEventListener('pointerlockerror', () => {
      if (overlay.classList.contains('loading-mode')) return;
      if (!introOpen && !prayOpen && !invOpen && !cmdOpen && !mapSystem?.isOpen() && !recipeOpen && !visibleTree() && !workbenchUI.opened && !skylineSystem?.isOpen() && !achieveOpen) setOverlay(true);
    });





    function lockPointer() {
      try {
        const menuEl = document.getElementById('menu');
        if (menuEl) { menuEl.classList.remove('loading-behind'); menuEl.classList.add('hidden'); }
        const p = renderer.domElement.requestPointerLock();
        if (p && p.catch) p.catch(() => { });
      } catch (e) {                                    }
    }



    function unlockPointer() {
      blockLook();
      try {
        if (document.pointerLockElement) document.exitPointerLock();
      } catch (e) { }
    }

    const hotbarEl = document.getElementById('hotbar');
    hotbarEl.style.display = 'flex';
    const invPanel = document.getElementById('invPanel');
    const invMainEl = document.getElementById('invMain');
    const invHotEl = document.getElementById('invHot');
    const tipEl = document.getElementById('tip');
    const tipTitle = tipEl.querySelector('.t');
    const tipBody = tipEl.querySelector('.b');


    const urgentCard = document.getElementById('urgentCard');
    const urgentCardTitle = urgentCard ? urgentCard.querySelector('.urgent-title') : null;
    const urgentCardBody = urgentCard ? urgentCard.querySelector('.urgent-body') : null;
    function showUrgentCard(body = '', title = '') {
      if (!urgentCard) return;
      if (urgentCardTitle) urgentCardTitle.textContent = title || '';
      if (urgentCardBody) urgentCardBody.textContent = body || '';
      urgentCard.hidden = false;
    }
    function hideUrgentCard() {
      if (urgentCard) urgentCard.hidden = true;
    }
    const radFill = document.getElementById('radFill');
    const radNum = document.getElementById('radNum');
    const radMeterEl = document.getElementById('radMeter');
    const radLd50El = document.getElementById('radLd50');
    const radDirEl = document.getElementById('radDir');
    const radDirTxt = document.getElementById('radDirTxt');
    const radDirWrap = document.getElementById('radDirWrap');
    const hpFill = document.getElementById('hpFill');
    const hpNum = document.getElementById('hpNum');
    const hungerFill = document.getElementById('hungerFill');
    const hungerNum = document.getElementById('hungerNum');
    const woundsEl = document.getElementById('wounds');
    const objectiveEl = document.getElementById('objective');
    const objectiveStepEl = document.getElementById('objectiveStep');
    const objectiveTitleEl = document.getElementById('objectiveTitle');
    const objectiveHintEl = document.getElementById('objectiveHint');
    const objectiveNeedsEl = document.getElementById('objectiveNeeds');
    const achievePanelEl = document.getElementById('achievePanel');
    const achieveGridEl = document.getElementById('achieveGrid');
    const achieveCountEl = document.getElementById('achieveCount');
    const achieveTimeEl = document.getElementById('achieveTime');
    const achieveDetailEl = document.getElementById('achieveDetail');
    const achieveNameEl = document.getElementById('achieveName');
    const achieveReqEl = document.getElementById('achieveReq');
    const achieveProgEl = document.getElementById('achieveProg');
    const achieveTipEl = document.getElementById('achieveTip');

    document.getElementById('achievementsBtn').addEventListener('click', openAchievements);
    document.getElementById('achieveClose').addEventListener('click', closeAchievements);

    function achievementCellAt(e) {
      return e.target.closest ? e.target.closest('.achCell') : null;
    }

    achieveGridEl.addEventListener('click', (e) => {
      const cell = achievementCellAt(e);
      if (!cell) return;
      achSelected = { type: cell.dataset.type, tier: +cell.dataset.tier };
      paintAchievements(true);
    });

    achieveGridEl.addEventListener('mousemove', (e) => {
      const cell = achievementCellAt(e);
      if (!cell) { achieveTipEl.classList.add('hidden'); return; }
      const type = ACHIEVEMENT_TYPES.find((t) => t.id === cell.dataset.type);
      const tier = type?.tiers[+cell.dataset.tier];
      if (!type || !tier) return;
      achieveTipEl.textContent = `${type.name} · ${tier.name}`;
      achieveTipEl.classList.remove('hidden');
      achieveTipEl.style.left = `${Math.max(8, Math.min(innerWidth - 280, e.clientX + 14))}px`;
      achieveTipEl.style.top = `${Math.max(8, Math.min(innerHeight - 32, e.clientY + 16))}px`;
    });

    achieveGridEl.addEventListener('mouseleave', () => achieveTipEl.classList.add('hidden'));

    let hoverSlot = -1;

    function slotOf(gi) {
      return gi < 7 ? [inv.hot, gi] : [inv.main, gi - 7];
    }

    function quickMove(gi) {
      const [grid, i] = slotOf(gi);
      const s = grid[i];
      if (!s) return;
      const def = ITEMS[s.id];
      if (def?.armor && !inv.armor[def.armor.slot]) {
        inv.armor[def.armor.slot] = { id: s.id, n: 1, plates: s.plates ? s.plates.slice() : [] };
        grid[i] = null;
        syncBars();
        return;
      }
      shiftMove(gi);
    }


    function shiftMove(gi) {
      const [grid, i] = slotOf(gi);
      const s = grid[i];
      if (!s) return;
      const dest = grid === inv.hot ? inv.main : inv.hot;
      const cap = ITEMS[s.id].stack;
      for (const d of dest) {
        if (s.n <= 0) break;
        if (d && d.id === s.id && d.n < cap) {
          const mv = Math.min(cap - d.n, s.n);
          d.n += mv; s.n -= mv;
        }
      }
      for (let k = 0; k < dest.length && s.n > 0; k++) {
        if (!dest[k]) {
          const mv = Math.min(cap, s.n);
          dest[k] = { id: s.id, n: mv }; s.n -= mv;
        }
      }
      if (s.n <= 0) grid[i] = null;
      syncBars();
    }



    const drops = [];
    const dropIconMats = {};
    const dropIconGeo = new THREE.PlaneGeometry(0.45, 0.45);
    function dropIconMaterial(id) {
      let m = dropIconMats[id];
      if (m) return m;
      const tex = new THREE.TextureLoader().load(itemIconUrl(id));
      tex.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
      dropIconMats[id] = m;
      return m;
    }



    function dropVisual(id) {
      const holder = new THREE.Group();
      const icon = new THREE.Mesh(dropIconGeo, dropIconMaterial(id));
      icon.rotation.x = -Math.PI / 2;
      icon.position.y = 0.012;
      holder.add(icon);
      const tool = TOOL_MODELS[id];
      const glb = tool ? null : itemModelIcon(id);
      if (tool || glb) {
        const load = tool
          ? new MTLLoader().setPath(tool.dir).loadAsync(tool.obj + '.mtl')
              .then((mats) => { mats.preload(); return new OBJLoader().setMaterials(mats).setPath(tool.dir).loadAsync(tool.obj + '.obj'); })
          : new GLTFLoader().loadAsync(glb).then((g) => g.scene);
        load.then((root) => {
          const tint = glb ? modelTint(id) : null;
          if (tint) tintModel(root, tint);
          root.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const centre = box.getCenter(new THREE.Vector3());
          const s = 0.4 / Math.max(size.x, size.y, size.z, 1e-3);
          const inner = new THREE.Group();
          inner.add(root);
          inner.scale.setScalar(s);
          inner.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
          holder.add(inner);
          icon.visible = false;
        }).catch(() => {                               });
      }
      return holder;
    }

    function spawnDrop(id, n, at, liquid, plates, keep) {
      if (drops.length >= 40 && !keep) {
        const old = drops.shift();
        scene.remove(old.mesh);
      }
      const m = dropVisual(id);
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      if (at) {
        m.position.set(at.x + (Math.random() - 0.5) * 0.6, at.y + 0.3, at.z + (Math.random() - 0.5) * 0.6);
        scene.add(m);
        drops.push({
          id, n, liquid, plates, mesh: m, born: performance.now(), ph: Math.random() * 6,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, 2.2 + Math.random(), (Math.random() - 0.5) * 1.6), resting: false
        });
      } else {
        m.position.set(player.pos.x - sy * 1.0, player.pos.y + 1.3, player.pos.z - cy * 1.0);
        scene.add(m);
        drops.push({
          id, n, liquid, plates, mesh: m, born: performance.now(), ph: Math.random() * 6,
          vel: new THREE.Vector3(-sy * 4.5, 2.5, -cy * 4.5), resting: false
        });
      }
    }

    function dropSolidAt(x, y, z) {
      if (world.field.sample(x, y, z) > 0) return true;
      return !!(buildingSystem && buildingSystem.solidAt(x, y, z));
    }

    function updateDrops(dt, now) {
      const pp = player.pos;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d.resting) {
          d.vel.y -= 12 * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          d.mesh.rotation.y += dt * 3;
          if (dropSolidAt(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z)) {
            for (let u = 0; u < 1.2; u += 0.05) {
              d.mesh.position.y += 0.05;
              if (!dropSolidAt(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z)) break;
            }
            d.vel.set(0, 0, 0);
            d.resting = true;
            d.rollT = 0;
          }
        } else {

          d.rollT -= dt;
          if (d.rollT <= 0) {
            d.rollT = 0.2;
            const px = d.mesh.position.x, py = d.mesh.position.y, pz = d.mesh.position.z;
            if (!dropSolidAt(px, py - 0.2, pz)) {
              d.resting = false;
              d.vel.set(0, 0, 0);
            } else if (!buildingSystem || !buildingSystem.solidAt(px, py - 0.2, pz)) {
              let bx = 0, bz = 0, bh = py;
              for (const [ox, oz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
                const h = world.getSurfaceHeight(px + ox, pz + oz, py + 2);
                if (h < bh - 0.12) { bh = h; bx = ox; bz = oz; }
              }
              if (bx || bz) {
                const l = Math.hypot(bx, bz);
                d.vel.set(bx / l * 2.2, 0.5, bz / l * 2.2);
                d.resting = false;
              }
            }
          }
        }
        const dx = d.mesh.position.x - pp.x, dy = d.mesh.position.y - pp.y, dz = d.mesh.position.z - pp.z;
        if (now - d.born > 800 && dx * dx + dy * dy + dz * dz < 4) {

          const left = (d.liquid || d.plates)
            ? (giveStack({ id: d.id, n: d.n, ...(d.liquid ? { liquid: d.liquid } : {}), ...(d.plates ? { plates: d.plates } : {}) }) ? 0 : d.n)
            : give(d.id, d.n);
          if (left < d.n) showGain(d.id, d.n - left, 'PICKED UP');
          if (left <= 0) { scene.remove(d.mesh); drops.splice(i, 1); }
          else d.n = left;
        } else if (now - d.born > 120000) {
          scene.remove(d.mesh);
          drops.splice(i, 1);
        }
      }
    }

    function dropAt(gi, whole) {
      const [grid, i] = slotOf(gi);
      const s = grid[i];
      if (!s) return;
      const n = whole ? s.n : 1;
      s.n -= n;
      if (s.n <= 0) grid[i] = null;
      spawnDrop(s.id, n, null, s.liquid ? { ...s.liquid } : null);
      syncBars();
    }

    const SORT_CAT = ['tools', 'armor', 'consumables', 'containers', 'blocks', 'ores', 'materials', 'components', 'machines', 'fuel'];
    function sortCategory(id) {
      const d = ITEMS[id];
      if (!d) return 'components';
      if (d.workbench) return 'machines';
      if (d.tool || d.torch || d.geiger) return 'tools';
      if (d.armor || d.plate) return 'armor';
      if (d.consumable) return 'consumables';
      if (d.container) return 'containers';
      if (d.fuel) return 'fuel';
      if (/ ORE$/.test(d.name)) return 'ores';
      if (/ (INGOT|DUST|PLATE|SOLENOID)$/.test(d.name)) return 'materials';
      if (d.block) return 'blocks';
      return 'components';
    }
    function sortGrid(grid) {
      const stacks = [];
      for (const s of grid) {
        if (!s) continue;
        const prev = stacks.find((x) => x.id === s.id && !x.liquid && !s.liquid && !x.plates?.length && !s.plates?.length && x.n < (ITEMS[s.id]?.stack || 64));
        if (prev) {
          const cap = ITEMS[s.id]?.stack || 64;
          const mv = Math.min(cap - prev.n, s.n);
          prev.n += mv;
          const left = s.n - mv;
          if (left > 0) stacks.push({ ...s, n: left });
        } else stacks.push({ ...s, plates: s.plates ? [...s.plates] : undefined, liquid: s.liquid ? { ...s.liquid } : undefined });
      }
      stacks.sort((a, b) => {
        const ca = SORT_CAT.indexOf(sortCategory(a.id));
        const cb = SORT_CAT.indexOf(sortCategory(b.id));
        if (ca !== cb) return ca - cb;
        const na = (ITEMS[a.id]?.name || a.id).toLowerCase();
        const nb = (ITEMS[b.id]?.name || b.id).toLowerCase();
        if (na !== nb) return na < nb ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      for (let i = 0; i < grid.length; i++) grid[i] = stacks[i] || null;
    }

    function buildSlots(el, grid, base) {
      el.innerHTML = '';
      for (let i = 0; i < grid.length; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        d.dataset.idx = base + i;
        if (el === hotbarEl) d.dataset.key = String(i + 1);
        dragDrop.bind(d, inventoryAdapter(grid, i, ITEMS));
        d.addEventListener('mousedown', (event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          if (grid === inv.hot) return;
          sortGrid(grid);
          syncBars();
        });
        d.addEventListener('click', (event) => {
          if (invOpen && event.shiftKey) { quickMove(base + i); return; }
          if (el === hotbarEl || el === invHotEl) { inv.sel = i; syncBars(); }
        });
        d.addEventListener('mouseenter', (e) => {
          hoverSlot = base + i;
          if (invOpen && grid[i]) showTip(grid[i], e.clientX, e.clientY);
        });
        d.addEventListener('mouseleave', () => { hoverSlot = -1; hideTip(); });
        el.appendChild(d);
      }
    }




    const invCraftEl = document.getElementById('invCraft');

    function invCounts() {
      const c = {};
      for (const g of [inv.hot, inv.main]) for (const s of g) if (s) c[s.id] = (c[s.id] || 0) + s.n;
      return c;
    }

    function guideNeedCount(id, counts) {
      if (id === 'fruit') {
        return ['apple', 'orange', 'pear'].reduce((sum, fruitId) => sum + (counts[fruitId] || 0), 0);
      }
      return counts[id] || 0;
    }

    function hasGuideMachine(id) {
      return !!machineSystem && machineSystem.instances.some((m) => m.def?.id === id);
    }

    function guideMachineActive(id) {
      return !!machineSystem && machineSystem.instances.some((m) => m.def?.id === id
        && (m.state.burning || (m.def.kind === 'reactor' && m.state.heat > 1)));
    }

    function guideStepDone(step, counts) {
      if (step.place) return hasGuideMachine(step.place);
      if (step.active) return guideMachineActive(step.active);
      if (step.need) return Object.entries(step.need).every(([id, n]) => guideNeedCount(id, counts) >= n);
      return false;
    }

    function guideNeedSignature(step, counts) {
      if (!step?.need) return '';
      return Object.entries(step.need)
        .map(([id, n]) => `${id}:${Math.min(guideNeedCount(id, counts), n)}/${n}`)
        .join(',');
    }

    function paintGuide(force = false) {
      if (!objectiveEl) return;
      if (WORLD_MODE === 'sandbox' || guideIndex >= GUIDE_STEPS.length) {
        objectiveEl.hidden = true;
        guidePaintSig = '';
        return;
      }
      const step = GUIDE_STEPS[guideIndex];
      const counts = invCounts();
      const sig = `${guideIndex}|${guideNeedSignature(step, counts)}`;
      if (!force && sig === guidePaintSig) return;
      guidePaintSig = sig;
      objectiveEl.hidden = false;
      objectiveStepEl.textContent = `${guideIndex + 1} / ${GUIDE_STEPS.length}`;
      objectiveTitleEl.textContent = step.title;
      objectiveHintEl.textContent = step.hint || '';
      if (step.need) {
        objectiveNeedsEl.innerHTML = Object.entries(step.need).map(([id, n]) => {
          const have = Math.min(guideNeedCount(id, counts), n);
          const label = id === 'fruit' ? 'FRUIT' : (ITEMS[id]?.name || id);
          return `<span class="${have >= n ? 'ok' : ''}">${label} <b>${have}/${n}</b></span>`;
        }).join('');
      } else {
        objectiveNeedsEl.innerHTML = '';
      }
    }

    function updateGuide(dt) {
      if (!objectiveEl) return;
      guideTick -= dt;
      if (guideTick > 0) return;
      guideTick = 0.2;
      const counts = invCounts();
      let advanced = false;
      while (guideIndex < GUIDE_STEPS.length && guideStepDone(GUIDE_STEPS[guideIndex], counts)) {
        guideIndex++;
        advanced = true;
      }
      paintGuide(advanced);
      if (advanced) queueSave('guide');
    }

    function migrateGuideFromMachines() {
      if (!machineSystem) return;
      let next = 0;
      for (let i = 0; i < GUIDE_STEPS.length; i++) {
        const step = GUIDE_STEPS[i];
        if (step.place && hasGuideMachine(step.place)) next = i + 1;
      }
      guideIndex = next;
      paintGuide(true);
    }

    function loadAchievements(data) {
      if (!data || typeof data !== 'object') return;
      const next = freshAchievements();
      for (const key of ['mined', 'placed', 'crafted', 'machines', 'kills', 'dosePeak', 'research', 'fuel', 'walked', 'chopped', 'blasts', 'harvested']) {
        if (Number.isFinite(data[key])) next[key] = Math.max(0, data[key]);
      }
      if (data.built && typeof data.built === 'object') {
        for (const id of Object.keys(data.built)) if (data.built[id]) next.built[id] = true;
      }
      if (data.started && typeof data.started === 'object') {
        for (const id of Object.keys(data.started)) if (data.started[id]) next.started[id] = true;
      }
      ach = next;
    }

    function backfillAchievements() {
      if (!machineSystem) return;
      ach.machines = Math.max(ach.machines, machineSystem.instances.length);
      for (const m of machineSystem.instances) {
        const id = m.def?.id;
        if (!id) continue;
        ach.built[id] = true;
        if (id === 'fission_reactor' && (m.state.burning || m.state.heat > 1)) ach.started.fission = true;
        if (id === 'fusion_reactor' && (m.state.burning || m.state.heat > 1)) ach.started.fusion = true;
      }
      achUnlocked = countUnlockedAchievements();
    }

    function achBump(key, n = 1) {
      if (typeof ach[key] === 'number') ach[key] += n;
    }

    function achCraft(id, n = 1) {
      if (!id || n <= 0) return;
      achBump('crafted', n);
      if (id.startsWith('blueprint_')) achBump('research', n);
      if (/_fuel$/.test(id)) achBump('fuel', n);
    }

    function achievementValue(tier) {
      if (!tier) return 0;
      if (tier.stat === 'days') return clock.day;
      if (tier.stat) return Number(ach[tier.stat]) || 0;
      return 0;
    }

    function achievementDone(tier) {
      if (!tier) return false;
      if (tier.built) return !!ach.built[tier.built];
      if (tier.started) return !!ach.started[tier.started];
      if (tier.stat) return achievementValue(tier) >= tier.need;
      return false;
    }

    function achievementProgress(tier) {
      if (!tier) return 0;
      if (tier.built) return ach.built[tier.built] ? 1 : 0;
      if (tier.started) return ach.started[tier.started] ? 1 : 0;
      if (!tier.stat || tier.need <= 0) return 0;
      return Math.max(0, Math.min(1, achievementValue(tier) / tier.need));
    }

    function countUnlockedAchievements() {
      let n = 0;
      for (const type of ACHIEVEMENT_TYPES) for (const tier of type.tiers) if (achievementDone(tier)) n++;
      return n;
    }

    function buildAchievements() {
      if (achBuilt || !achieveGridEl) return;
      const frag = document.createDocumentFragment();
      for (const type of ACHIEVEMENT_TYPES) {
        const col = document.createElement('div');
        col.className = 'achCol';
        type.tiers.forEach((tier, tierIndex) => {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'achCell';
          cell.dataset.type = type.id;
          cell.dataset.tier = String(tierIndex);
          cell.setAttribute('aria-label', `${type.name} · ${tier.name}`);
          const img = document.createElement('img');
          img.src = itemIconUrl(tier.icon) || '';
          img.alt = '';
          img.draggable = false;
          cell.appendChild(img);
          col.appendChild(cell);
        });
        frag.appendChild(col);
      }
      achieveGridEl.appendChild(frag);
      achBuilt = true;
    }

    function paintAchievementDetail() {
      if (!achieveDetailEl) return;
      const kicker = achieveDetailEl.querySelector('.adKicker');
      if (!achSelected) {
        achieveDetailEl.classList.add('empty');
        if (kicker) kicker.textContent = 'SELECT AN ACHIEVEMENT';
        achieveNameEl.textContent = '';
        achieveReqEl.textContent = '';
        achieveProgEl.textContent = '';
        return;
      }
      const type = ACHIEVEMENT_TYPES.find((t) => t.id === achSelected.type);
      const tier = type?.tiers[achSelected.tier];
      if (!type || !tier) return;
      achieveDetailEl.classList.remove('empty');
      if (kicker) kicker.textContent = `${type.name} · TIER ${achSelected.tier + 1} / ${type.tiers.length}`;
      achieveNameEl.textContent = tier.name;
      achieveReqEl.textContent = tier.req;
      if (achievementDone(tier)) {
        achieveProgEl.textContent = 'COMPLETE';
      } else if (tier.stat) {
        const value = Math.min(achievementValue(tier), tier.need);
        achieveProgEl.textContent = `PROGRESS ${value.toLocaleString()} / ${tier.need.toLocaleString()}`;
      } else {
        achieveProgEl.textContent = 'NOT YET COMPLETE';
      }
    }

    function paintAchievements(force = false) {
      if (!achievePanelEl || achievePanelEl.classList.contains('hidden')) return;
      const sig = ACHIEVEMENT_TYPES.map((type) => type.tiers.map((tier) =>
        `${achievementDone(tier) ? 1 : 0}${Math.round(achievementProgress(tier) * 20)}`).join('.')).join('|')
        + `#${achSelected ? `${achSelected.type}:${achSelected.tier}` : ''}#t${Math.floor(playTime)}`;
      if (!force && sig === achPaintSig) return;
      achPaintSig = sig;
      for (const cell of achieveGridEl.querySelectorAll('.achCell')) {
        const type = ACHIEVEMENT_TYPES.find((t) => t.id === cell.dataset.type);
        const tier = type?.tiers[+cell.dataset.tier];
        if (!tier) continue;
        const done = achievementDone(tier);
        const prog = achievementProgress(tier);
        cell.classList.toggle('done', done);
        cell.classList.toggle('partial', !done && prog > 0);
        cell.classList.toggle('selected', !!achSelected && achSelected.type === type.id && achSelected.tier === +cell.dataset.tier);
        cell.style.setProperty('--p', String(done ? 1 : prog));
      }
      const total = ACHIEVEMENT_TYPES.reduce((n, t) => n + t.tiers.length, 0);
      achieveCountEl.textContent = `${countUnlockedAchievements()} / ${total} UNLOCKED`;
       if (achieveTimeEl) achieveTimeEl.textContent = `PLAY TIME ${formatPlayTime(playTime)}`;
      paintAchievementDetail();
    }

    function updateAchievements(dt) {
      if (!achievePanelEl) return;
      achTick -= dt;
      if (achTick > 0) return;
      achTick = 0.2;

      if (inv.dose > ach.dosePeak) ach.dosePeak = inv.dose;
      if (achLastPos) {
        const d = Math.hypot(player.pos.x - achLastPos.x, player.pos.z - achLastPos.z);
        if (d < 8) ach.walked += d;
      }
      achLastPos = { x: player.pos.x, z: player.pos.z };

      if (machineSystem) {
        for (const m of machineSystem.instances) {
          const id = m.def?.id;
          if (!id) continue;
          if (id === 'fission_reactor' && (m.state.burning || m.state.heat > 1)) ach.started.fission = true;
          if (id === 'fusion_reactor' && (m.state.burning || m.state.heat > 1)) ach.started.fusion = true;
        }
      }

      const unlocked = countUnlockedAchievements();
      if (unlocked !== achUnlocked) {
        achUnlocked = unlocked;
        queueSave('achievement');
      }
      if (achieveOpen) paintAchievements();
    }

    function openAchievements() {
      if (!achievePanelEl) return;
      buildAchievements();
      unlockPointer();
      setOverlay(false);
      achievePanelEl.classList.remove('hidden');
      achieveOpen = true;
      paintAchievements(true);
    }

    function closeAchievements() {
      if (!achievePanelEl) return;
      achievePanelEl.classList.add('hidden');
      achieveTipEl.classList.add('hidden');
      achieveOpen = false;
      queueSave('achievements');
      setOverlay(true);
    }

    function takeInv(id, n) {
      let left = n;
      for (const g of [inv.hot, inv.main]) {
        for (let i = 0; i < g.length && left > 0; i++) {
          const s = g[i];
          if (!s || s.id !== id) continue;
          const take = Math.min(s.n, left);
          s.n -= take; left -= take;
          if (s.n <= 0) g[i] = null;
        }
      }
      return left;
    }



    function bagRoomFor(id, n, spend = null) {
      const cap = ITEMS[id].stack;
      const slots = [];
      for (const g of [inv.hot, inv.main]) for (const s of g) slots.push(s ? { id: s.id, n: s.n } : null);
      if (spend) {
        for (const [sid, sn] of Object.entries(spend)) {
          let left = sn;
          for (const s of slots) {
            if (!s || s.id !== sid || left <= 0) continue;
            const take = Math.min(s.n, left);
            s.n -= take; left -= take;
          }
        }
      }
      let room = 0;
      for (const s of slots) {
        if (!s || s.n <= 0) room += cap;
        else if (s.id === id) room += cap - s.n;
        if (room >= n) return true;
      }
      return false;
    }

    function tableOptions() {
      const counts = invCounts();
      const out = [];
      TABLE_RECIPES.forEach((recipe, i) => {
        const ids = Object.keys(recipe.out);
        if (ids.length !== 1) return;
        const id = ids[0], n = recipe.out[id];
        let crafts = Infinity;
        for (const [rid, rn] of Object.entries(recipe.needs)) {
          crafts = Math.min(crafts, Math.floor((counts[rid] || 0) / rn));
        }
        if (!isFinite(crafts) || crafts < 1) return;
        out.push({ key: `t${i}`, recipe, id, count: n, crafts, needs: Object.entries(recipe.needs) });
      });
      return out;
    }

    function tableCraft(option, mods = {}) {
      if (!invOpen || !option) return;
      const recipe = option.recipe;
      const ids = Object.keys(recipe.out);
      if (ids.length !== 1) return;
      const outId = ids[0], outN = recipe.out[outId];
      const limit = mods.shift ? option.crafts : 1;
      let made = 0;
      for (let i = 0; i < limit; i++) {
        const counts = invCounts();
        let ok = true;
        for (const [id, n] of Object.entries(recipe.needs)) {
          if ((counts[id] || 0) < n) { ok = false; break; }
        }
        if (!ok) break;
        if (!bagRoomFor(outId, outN, recipe.needs)) { notice('INVENTORY FULL'); break; }
        for (const [id, n] of Object.entries(recipe.needs)) takeInv(id, n);
        give(outId, outN);
        made++;
      }
      if (made) { achCraft(outId, made); syncBars(); }
    }

    const tableCraftUI = new CraftOptions({
      item: (id) => ITEMS[id],
      icon: (id) => itemIconUrl(id),
      showTip: (s, x, y) => showTip(s, x, y),
      hideTip: () => hideTip(),
      emptyText: 'NO CRAFTABLE RECIPES',
      onCraft: (option, mods) => tableCraft(option, mods),
    });

    function paintTable() { tableCraftUI.set(tableOptions()); }
    function buildTable() { invCraftEl.replaceChildren(tableCraftUI.el); }


    const invArmorEl = document.getElementById('invArmor');
    const ARMOR_ORDER = ['head', 'chest', 'legs', 'feet', 'hands'];
    const ARMOR_SLOT_NAME = { head: 'HELMET', chest: 'CHEST', legs: 'LEGS', feet: 'BOOTS', hands: 'GLOVES' };

    function armorAdapter(slot) {
      return {
        stack: () => inv.armor[slot] || null,
        accepts: (st) => {
          const def = ITEMS[st.id];
          if (!def) return false;
          if (def.armor) return def.armor.slot === slot;
          if (!def.plate) return false;
          const cur = inv.armor[slot];
          const worn = cur && ITEMS[cur.id]?.armor;
          const cap = worn ? (ITEMS[cur.id].armor.plateSlots || 0) : 0;
          return (worn && (cur.plates || []).length < cap) || (!worn && !!def.plate.standalone);
        },
        take: () => { const s = inv.armor[slot]; inv.armor[slot] = null; return s || null; },
        put: (st) => {
          const def = ITEMS[st.id];
          const cur = inv.armor[slot] || null;
          if (def?.plate) {
            const worn = cur && ITEMS[cur.id]?.armor;
            const cap = worn ? (ITEMS[cur.id].armor.plateSlots || 0) : 0;
            if (worn && (cur.plates || []).length < cap) {
              cur.plates = cur.plates || [];
              cur.plates.push(st.id);
              st.n--;
              return st.n > 0 ? st : null;
            }
            if (!worn && def.plate.standalone) { inv.armor[slot] = st; return cur; }
            return st;
          }
          if (def?.armor && def.armor.slot === slot) {
            inv.armor[slot] = { id: st.id, n: 1, plates: st.plates ? st.plates.slice() : [] };
            return cur;
          }
          return st;
        },
        restore: (st) => { inv.armor[slot] = st; },
      };
    }

    function buildArmorSlots() {
      invArmorEl.innerHTML = '';
      for (const slot of ARMOR_ORDER) {
        const d = document.createElement('div');
        d.className = 'slot armorSlot';
        d.dataset.armor = slot;
        dragDrop.bind(d, armorAdapter(slot));
        d.addEventListener('click', (e) => {
          if (!invOpen) return;
          if (e.shiftKey && inv.armor[slot]) {
            if (giveStack(inv.armor[slot])) { inv.armor[slot] = null; syncBars(); }
            return;
          }
          syncBars();
        });
        d.addEventListener('mouseenter', (e) => { const s = inv.armor[slot]; if (invOpen && s) showTip(s, e.clientX, e.clientY); });
        d.addEventListener('mouseleave', hideTip);
        invArmorEl.appendChild(d);
      }
    }

    function paintArmor() {
      for (const el of invArmorEl.children) {
        const slot = el.dataset.armor;
        const s = inv.armor[slot];
        const label = `<small class="slotName">${ARMOR_SLOT_NAME[slot]}</small>`;
        const art = s ? `<div style="width:100%;height:100%;background:url('${itemIconUrl(s.id)}') center/contain no-repeat;border-radius:6px;box-sizing:border-box;"></div>` : '';
        const plates = s && s.plates && s.plates.length ? `<span class="plateTag">${s.plates.length}P</span>` : '';
        el.innerHTML = `${label}${art}${plates}`;
      }
    }

    function paintSlots(el, grid, isHot) {
      const kids = el.children;
      for (let i = 0; i < grid.length; i++) {
        const s = grid[i];
        const art = s ? `<div style="width:100%;height:100%;background:url('${itemIconUrl(s.id)}') center/contain no-repeat;border-radius:6px;box-sizing:border-box;"></div>` : '';
        let liq = '';
        if (s && ITEMS[s.id]?.container) {
          const v = Liquid.volume(s), cap = ITEMS[s.id].container.capacity;
          if (v > 0) {
            const pct = Math.max(0, Math.min(100, (v / cap) * 100));
            const col = '#' + (LIQUID_DEFS[s.liquid.id]?.color || 0x3f7fd6).toString(16).padStart(6, '0');
            liq = `<span class="liq" style="position:absolute;left:0;right:0;bottom:0;height:${pct}%;background:${col};opacity:.5;pointer-events:none"></span>`;
          }
        }
        kids[i].innerHTML = `${isHot ? `<small class="hotkey">${i + 1}</small>` : ''}${s ? `${art}${liq}<span class="n">${s.n > 1 ? s.n : ''}</span>` : ''}`;
        kids[i].classList.toggle('sel', !!isHot && i === inv.sel);
      }
    }

    let _doseFrame = 0, _doseRateFrame = -1, _doseRateVal = 0;
    function syncBars() {
      _doseRateFrame = -1;
      paintSlots(hotbarEl, inv.hot, true);
      if (invOpen) {
        paintSlots(invMainEl, inv.main, false);
        paintSlots(invHotEl, inv.hot, true);
        paintArmor();
        paintTable();
        paintRad();
      }
      paintVitals();
      hideTip();
    }


    const descHtml = (d) => (d.desc || '').replace(/\*([^*]+)\*/g, '<em>$1</em>');


    function tipLines(s) {
      const d = ITEMS[s.id];
      const kind = d.rod ? 'COOLING ROD' : d.tool ? 'TOOL' : d.light ? `LIGHT · ${d.light.mount.toUpperCase()} MOUNT` : d.armor ? 'ARMOR' : d.plate ? 'SHIELDING PLATE' : d.consumable ? (d.consumable.cures ? 'MEDICAL' : 'CONSUMABLE') : d.container ? 'LIQUID CONTAINER' : d.block ? 'BLOCK' : 'GEAR';
      const lines = [kind + (s.n > 1 ? ` x${s.n}` : '')];
      if (d.desc) lines.push(descHtml(d));
      if (d.tool) lines.push(`R ${d.tool.radius} · ${d.tool.rate}S · Yx${d.tool.yield}${d.tool.stone ? ` · STx${d.tool.stone}` : ''}`);
      if (d.tool) lines.push(`DIGS ${d.tool.good.join('/').toUpperCase() || 'NONE'}`);
      if (d.tool?.chop) lines.push('CHOPS TREES');
      if (d.armor) {
        const cap = d.armor.plateSlots || 0;
        const have = (s.plates || []).length;
        lines.push(`${ARMOR_SLOT_NAME[d.armor.slot] || d.armor.slot} · PLATES ${have}/${cap}`);
        if (d.armor.carry) lines.push(`MUTES ${Math.round(d.armor.carry * 100)}% CARRIED RAD`);
        if (d.armor.gardening) lines.push('PICKS FLOWERS & PLANTS');
      }
      if (d.plate) lines.push(`SHIELD ${formatRadRate(d.plate.radShield)}${d.plate.carry ? ` · MUTES ${Math.round(d.plate.carry * 100)}% CARRIED` : ''}`);
      if (d.container) {
        const L = s.liquid ? LIQUID_DEFS[s.liquid.id] : null;
        lines.push(`${L ? L.name : 'EMPTY'} ${Math.round(Liquid.volume(s))}/${d.container.capacity}L`);
        lines.push(d.container.acidProof ? 'ACID-PROOF LINER' : 'ACID WILL CORRODE IT');
        lines.push(d.container.filter
          ? 'ONLY HOLDS ' + d.container.filter.map((f) => LIQUID_DEFS[f]?.name || f).join(' / ')
          : 'RIGHT-CLICK WATER TO FILL');
      }
      if (d.consumable) {
        if (d.consumable.cures) lines.push('TREATS ' + d.consumable.cures.map((t) => WOUNDS[t]?.name || t).join(' / '));
        if (d.consumable.heal) lines.push(`HEAL +${d.consumable.heal}`);
        if (d.consumable.food) {
          const fn = foodNumb(s.id), eff = Math.round(effectiveFood(s.id, d.consumable.food) * 10) / 10;
          lines.push(`FOOD +${eff} (BASE ${d.consumable.food})`);
          lines.push(`NUMBNESS ${fn.toFixed(1)} / 2`);
        }
        if (d.consumable.immunity) lines.push(`INFECTION IMMUNITY ${d.consumable.immunity}s`);
        if (d.consumable.dose) lines.push(`DOSE ${d.consumable.dose > 0 ? '+' : '-'}${formatRad(Math.abs(d.consumable.dose))}`);
        if (d.consumable.shieldTime) lines.push(`SHIELD ${d.consumable.shieldTime}s`);
        if (d.consumable.intake) lines.push(`RAD INTAKE -${Math.round((1 - d.consumable.intake) * 100)}% ${d.consumable.intakeTime}s`);
        if (d.consumable.smoke) lines.push(`SMOKE ${d.consumable.smoke}s · SPEED +${Math.round(((d.consumable.speed || 1) - 1) * 100)}% · NEEDS LIGHTER`);
        lines.push('RIGHT-CLICK TO USE');
      }
      if (d.rod) {
        lines.push(`COOL ${d.rod.cool}${d.rod.absorb ? ` · ABSORB ${Math.round(d.rod.absorb * 100)}%` : ''}`);
        if (d.rod.mod) lines.push(`MODERATION +${Math.round(d.rod.mod * 100)}% · FIT A REACTOR SLOT`);
      }
      if (d.fuel) lines.push(`FUEL · ${d.fuel.lifetime}S · ${d.fuel.power}P · IDEAL COOL ${d.fuel.cool ?? d.fuel.heat}`);
      lines.push(d.rad > 0 ? `+${formatRadRate(d.rad)}` : d.rad < 0 ? `SHIELDS ${formatRadRate(-d.rad)}` : 'INERT');
      return lines;
    }

    function showTip(s, x, y) {
      if (document.body.classList.contains('dd-dragging')) return;
      tipTitle.textContent = ITEMS[s.id].name;
      tipBody.innerHTML = tipLines(s).join('<br>');
      tipEl.style.display = 'block';
      moveTip(x, y);
    }

    function moveTip(x, y) {
      const w = 200;
      tipEl.style.left = (x > innerWidth - w - 20 ? x - w - 14 : x + 14) + 'px';
      tipEl.style.top = Math.min(innerHeight - 100, y + 16) + 'px';
    }

    function hideTip() { tipEl.style.display = 'none'; }

    document.addEventListener('mousemove', (e) => {
      if (tipEl.style.display === 'block') moveTip(e.clientX, e.clientY);
    });


    function closeAllMenus() {
      const any = recipeOpen || workbenchUI.opened || skylineSystem?.isOpen() || invOpen || !!mapSystem?.isOpen() || prayOpen;
      if (prayOpen) closePray();
      if (recipeOpen) toggleRecipes(false);
      if (workbenchUI.opened) workbenchUI.close();
      if (skylineSystem?.isOpen()) skylineSystem.closeUI();
      if (invOpen) toggleInv(false);
      if (mapSystem?.isOpen()) mapSystem.hide();
      hideTip();
      return any;
    }

    function toggleInv(force, relink = true) {
      invOpen = force !== undefined ? force : !invOpen;
      if (!invOpen) {
        dragDrop.cancel();
        if (recipeOpen) toggleRecipes(false);
        hideTip();
      }
      hoverSlot = -1;
      invPanel.classList.toggle('hidden', !invOpen);
      if (invOpen) {
        unlockPointer();
        setOverlay(false);
        syncBars();
      } else {

        if (relink) lockPointer();
        setOverlay(false);
        setTimeout(() => { if (!locked && !invOpen && !recipeOpen && !achieveOpen) setOverlay(true); }, 350);
      }
    }

    buildSlots(hotbarEl, inv.hot, 0);
    buildSlots(invMainEl, inv.main, 7);
    buildSlots(invHotEl, inv.hot, 0);
    buildArmorSlots();
    buildTable();
    syncBars();




    const recipePanelEl = document.getElementById('recipePanel');
    const recipeItemsEl = document.getElementById('recipeItems');
    const recipeDetailEl = document.getElementById('recipeDetail');
    const recipeSearchEl = document.getElementById('recipeSearch');
    const recipeHintEl = document.getElementById('recipeHint');
    const recipeFiltersEl = document.getElementById('recipeFilters');
    const recipeStartEl = document.getElementById('recipeStart');
    const recipeStartItemsEl = document.getElementById('recipeStartItems');
    const recipeStartLeftEl = document.getElementById('recipeStartLeft');
    let recipeOpen = false;
    let recipeSel = null;
    let recipeFilter = 'all';
    const recipeHistory = [];

    const RECIPE_FILTERS = [
      ['all', 'ALL'], ['ores', 'ORES'], ['materials', 'MATERIALS'],
      ['blocks', 'BLOCKS'], ['components', 'COMPONENTS'], ['machines', 'MACHINES'],
      ['tools', 'TOOLS'], ['armor', 'ARMOR'], ['consumables', 'CONSUMABLES'], ['fuel', 'FUEL'],
    ];
    function itemFilter(id) {
      const d = ITEMS[id];
      if (!d) return 'components';
      if (d.workbench) return 'machines';
      if (d.tool || d.torch || d.geiger) return 'tools';
      if (d.armor) return 'armor';
      if (d.consumable) return 'consumables';
      if (d.fuel) return 'fuel';
      if (d.container) return 'materials';
      if (/ ORE$/.test(d.name)) return 'ores';
      if (/ (INGOT|DUST|PLATE|SOLENOID)$/.test(d.name) || d.plate) return 'materials';
      if (d.block) return 'blocks';
      return 'components';
    }

    const RECIPE_MAKES = new Map();
    const RECIPE_USES = new Map();
    const TABLE_OUT = new Set(TABLE_RECIPES.map((r) => Object.keys(r.out)[0]));

    function addRecipe(r) {
      for (const id of Object.keys(r.out)) {
        if (!RECIPE_MAKES.has(id)) RECIPE_MAKES.set(id, []);
        RECIPE_MAKES.get(id).push(r);
      }
      for (const id of Object.keys(r.needs)) {
        if (!RECIPE_USES.has(id)) RECIPE_USES.set(id, []);
        RECIPE_USES.get(id).push(r);
      }
    }
    for (const c of CRAFT_RECIPES) {
      const id = Object.keys(c.out)[0];
      addRecipe({ needs: c.needs, out: c.out, where: 'CRAFTING' + (TABLE_OUT.has(id) ? ' · POCKET TABLE' : ''), liquidNeeds: [] });
    }
    for (const m of MACHINE_DEFS) {
      for (const mr of m.recipes || []) addRecipe({ needs: mr.in || {}, out: mr.out || {}, where: m.name, fuel: mr.fuel, liquidNeeds: mr.liquidIn || [] });
    }

    function recipeSlot(id, n) {
      return `<div class="rslot jump" data-id="${id}"><div style="background:url('${itemIconUrl(id)}') center/contain no-repeat"></div>`
        + (n > 1 ? `<span class="n">${n}</span>` : '') + '</div>';
    }

    function recipeCard(r) {
      const ins = Object.entries(r.needs).map(([id, n]) => recipeSlot(id, n)).join('') || '<div class="rslot"></div>';
      const liqs = (r.liquidNeeds || []).map((l) => `<div class="rslot rliq"><div style="display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700">${String(l.id).toUpperCase()}<br>${l.amount}L</div></div>`).join('');
      const outs = Object.entries(r.out).map(([id, n]) => recipeSlot(id, n)).join('') || '<div class="rslot"></div>';
      return `<div class="rcard"><div class="ring">${ins}${liqs}</div><div class="rarrow"></div>`
        + `<div class="rout">${outs}</div><div class="rwhere">${r.where}${r.fuel ? ' · FUEL' : ''}</div></div>`;
    }

    function paintRecipeFilters() {
      const counts = {};
      for (const id of Object.keys(ITEMS)) counts[itemFilter(id)] = (counts[itemFilter(id)] || 0) + 1;
      recipeFiltersEl.innerHTML = RECIPE_FILTERS.map(([f, label]) =>
        `<button type="button" class="rfilter${f === recipeFilter ? ' on' : ''}" data-filter="${f}">${label}<span class="c">${counts[f] || 0}</span></button>`).join('');
    }

    function paintRecipeDetail() {
      if (!recipeSel) { recipeDetailEl.innerHTML = '<p class="rmuted">SELECT AN ITEM TO SEE HOW IT IS MADE AND USED</p>'; return; }
      const d = ITEMS[recipeSel];
      const makes = RECIPE_MAKES.get(recipeSel) || [];
      const uses = RECIPE_USES.get(recipeSel) || [];
      const kind = d.tool ? 'TOOL' : d.armor ? 'ARMOR' : d.block ? 'BLOCK' : d.workbench ? 'MACHINE' : 'ITEM';
      recipeDetailEl.innerHTML =
        (recipeHistory.length ? '<button type="button" class="rback">← BACK</button>' : '')
        + `<button type="button" class="rback" data-rtree>→ TREE</button>`
        + `<div class="rhead"><div class="rheadIcon" style="background-image:url('${itemIconUrl(recipeSel)}')"></div>`
        + `<div><div class="rheadName">${d.name}</div><div class="rheadSub">${kind}</div></div></div>`
        + (d.desc ? `<p class="rdesc">${descHtml(d)}</p>` : '')
        + `<div class="rsection">HOW TO OBTAIN</div>`
        + (makes.length ? makes.map(recipeCard).join('') : '<p class="rmuted">NOT CRAFTABLE | MINE OR FIND IT IN THE WORLD</p>')
        + `<div class="rsection">USED IN</div>`
        + (uses.length ? uses.map(recipeCard).join('') : '<p class="rmuted">NO KNOWN USES</p>');
      recipeDetailEl.scrollTop = 0;
    }

    function recipeSources(id) {
      const src = new Set();
      for (const r of RECIPE_MAKES.get(id) || []) {
        if (r.where.includes('POCKET TABLE')) src.add('table');
        else if (r.where.includes('CRAFTING')) src.add('grid');
        else src.add('machine');
      }
      return src;
    }

    function starterGuideVisible() { return playTime < STARTER_GUIDE_SECONDS; }

    function paintStarterGuide() {
      const show = starterGuideVisible();
      recipeStartEl.hidden = !show;
      if (!show) return;
      const left = Math.max(0, Math.ceil((STARTER_GUIDE_SECONDS - playTime) / 60));
      recipeStartLeftEl.textContent = `${left} MIN LEFT`;
      recipeStartItemsEl.innerHTML = STARTER_GUIDE.map((id, i) => {
        const name = ITEMS[id]?.name || id;
        return `<button type="button" class="rstartItem${id === recipeSel ? ' sel' : ''}" data-id="${id}" title="${name}" aria-label="${name}">`
          + `<b>${i + 1}</b><div style="background:url('${itemIconUrl(id)}') center/contain no-repeat"></div></button>`;
      }).join('');
    }

    function paintRecipeList() {
      const q = recipeSearchEl.value.trim().toLowerCase();
      const ids = Object.keys(ITEMS)
        .filter((id) => recipeFilter === 'all' || itemFilter(id) === recipeFilter)
        .filter((id) => !q || ITEMS[id].name.toLowerCase().includes(q) || id.includes(q))
        .sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name));
      recipeItemsEl.innerHTML = ids.map((id) => {
        const src = [...recipeSources(id)].map((s) => `<i class="${s}"></i>`).join('');
        return `<div class="ritem${id === recipeSel ? ' sel' : ''}" data-id="${id}">`
          + `<div style="background:url('${itemIconUrl(id)}') center/contain no-repeat"></div>${src}</div>`;
      }).join('');
      paintStarterGuide();
    }

    function selectRecipe(id) {
      if (!ITEMS[id]) return;
      if (id !== recipeSel) recipeHistory.push(recipeSel);
      recipeSel = id;
      paintRecipeList();
      paintRecipeDetail();
    }

    function toggleRecipes(force) {
      recipeOpen = force !== undefined ? force : !recipeOpen;
      if (recipeOpen && invOpen) {


        const saved = recipeOpen;
        recipeOpen = false;
        toggleInv(false, false);
        recipeOpen = saved;
      }
      recipePanelEl.classList.toggle('hidden', !recipeOpen);
      if (recipeOpen) {
        unlockPointer();
        paintRecipeFilters(); paintRecipeList(); paintRecipeDetail(); recipeSearchEl.focus();
      } else {
        lockPointer();
      }
    }

    recipeStartEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.rstartItem');
      if (btn) selectRecipe(btn.dataset.id);
    });

    recipeItemsEl.addEventListener('click', (e) => {
      const el = e.target.closest('.ritem');
      if (!el) return;
      selectRecipe(el.dataset.id);

      if (WORLD_MODE === 'sandbox') {
        const n = e.shiftKey ? ITEMS[recipeSel].stack : 1;
        give(recipeSel, n);
        notice(`TAKEN ${ITEMS[recipeSel].name}${n > 1 ? ` x${n}` : ''}`);
      }
    });
    recipeDetailEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-rtree]')) { if (recipeSel) openTree(recipeSel); return; }
      if (e.target.closest('.rback')) {
        recipeSel = recipeHistory.pop() || recipeSel;
        paintRecipeList();
        paintRecipeDetail();
        return;
      }
      const slot = e.target.closest('.rslot[data-id]');
      if (slot) selectRecipe(slot.dataset.id);
    });
    recipeFiltersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.rfilter');
      if (!btn) return;
      recipeFilter = btn.dataset.filter;
      paintRecipeFilters();
      paintRecipeList();
    });
    recipeSearchEl.addEventListener('input', paintRecipeList);
    recipeSearchEl.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        const first = recipeItemsEl.querySelector('.ritem');
        if (first) selectRecipe(first.dataset.id);
      }
    });
    document.getElementById('invRecipesBtn').addEventListener('click', () => toggleRecipes(true));
    document.getElementById('recipeClose').addEventListener('click', () => toggleRecipes(false));


    const treePanelEl = document.getElementById('treePanel');
    const treeBodyEl = document.getElementById('treeBody');

    function wireItemTips(root) {
      const sel = '.rslot[data-id], .ritem[data-id], .tico[data-id]';
      root.addEventListener('mouseover', (e) => {
        const el = e.target.closest(sel);
        if (!el || !root.contains(el) || el.contains(e.relatedTarget) || !ITEMS[el.dataset.id]) return;
        showTip({ id: el.dataset.id, n: 1 }, e.clientX, e.clientY);
      });
      root.addEventListener('mouseout', (e) => {
        const el = e.target.closest(sel);
        if (el && !el.contains(e.relatedTarget)) hideTip();
      });
    }
    wireItemTips(recipePanelEl);
    wireItemTips(treePanelEl);
    const treeTitleEl = document.getElementById('treeTitle');
    let treeRootId = null;
    const visibleTree = () => !treePanelEl.classList.contains('hidden');

    function treeStationTag(makes) {
      if (!makes) return '';
      const tags = new Set();
      for (const r of makes) {
        if (r.where.includes('POCKET TABLE')) tags.add('table');
        else if (r.where.includes('CRAFTING')) tags.add('grid');
        else tags.add('machine');
      }
      return tags.size ? `<i class="ttag${[...tags].map((t) => ` ${t}`).join('')}"></i>` : '';
    }

    function treeNodes(id, seen) {

      const makes = RECIPE_MAKES.get(id);
      const kids = !makes || seen.has(id) ? '' : makes.map((r) => {
        const ins = Object.entries(r.needs);
        return `<div class="trow"><span class="twhere">${r.where}${r.fuel ? ' · NEEDS FUEL' : ''}</span>${
          ins.length
            ? `<div class="ting">${ins.map(([iid]) => treeNodes(iid, new Set([...seen, id]))).join('')}</div>`
            : '<div class="ting"><span class="tname" style="color:#ffd14d">SPECIAL | SEE MACHINE</span></div>'
        }</div>`;
      }).join('');
      return `
        <div class="tnodeBlock">
          <div class="tnodeRow">
            <span class="ticoWrap"><div class="tico${makes ? ' jump' : ' leaf'}" data-id="${id}"><div style="background:url('${itemIconUrl(id)}') center/contain no-repeat"></div>${treeStationTag(makes)}</div></span>
            <div><span class="tname">${ITEMS[id].name}</span>${!makes ? '<div class="tname" style="color:#8a8a8a">MINED OR FOUND</div>' : ''}</div>
          </div>
          ${kids ? `<div class="tkids">${kids}</div>` : ''}
        </div>`;
    }

    function openTree(id) {
      if (!ITEMS[id]) return;
      treeRootId = id;
      treeTitleEl.textContent = `${ITEMS[id].name} | RECIPE TREE`;
      treeBodyEl.innerHTML = `<div>${treeNodes(id, new Set())}</div>`;
      treePanelEl.classList.remove('hidden');
    }
    function toggleTree(id) {
      if (!treePanelEl.classList.contains('hidden') && (!id || id === treeRootId)) {
        treePanelEl.classList.add('hidden');
        return;
      }
      if (id) openTree(id);
      else if (!treePanelEl.classList.contains('hidden')) treePanelEl.classList.add('hidden');
    }
    document.getElementById('treeClose').addEventListener('click', () => toggleTree(null));
    treeBodyEl.addEventListener('click', (e) => {
      const tico = e.target.closest('.tico');
      if (!tico || !tico.classList.contains('jump')) return;
      const id = tico.dataset.id;
      if (!recipeOpen) toggleRecipes(true);
      selectRecipe(id);
    });


    {
      const box = treePanelEl.querySelector('.treeBox');
      const head = document.getElementById('treeHead');
      let drag = null;
      head.addEventListener('pointerdown', (e) => {
        if (e.target.id === 'treeClose') return;
        drag = { x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop };
        head.setPointerCapture(e.pointerId);
      });
      head.addEventListener('pointermove', (e) => {
        if (!drag) return;
        box.style.left = `${drag.l + (e.clientX - drag.x)}px`;
        box.style.top = `${drag.t + (e.clientY - drag.y)}px`;
      });
      head.addEventListener('pointerup', () => { drag = null; });
    }
    if (WORLD_MODE === 'sandbox') recipeHintEl.textContent = 'CLICK TO TAKE · SHIFT FOR A STACK';

    addEventListener('wheel', (e) => {
      if (!locked || invOpen) return;
      inv.sel = (inv.sel + (e.deltaY > 0 ? 1 : 6)) % 7;
      syncBars();
    }, { passive: true });



    function doseRate() {
      if (_doseRateFrame === _doseFrame) return _doseRateVal;
      let carried = 0;
      for (const s of allSlots()) if (s && ITEMS[s.id]) carried += (ITEMS[s.id].rad || 0);
      let protect = 0;
      if (machineSystem) {
        carried *= 1 - machineSystem.carryShield();
        protect = machineSystem.radProtect();
      }
      let r = carried - (machineSystem ? machineSystem.totalArmorRadShield() : 0);
      if (armorShieldTimer > 0) r -= 3;





      const rf = radField();
      let field = rf.ambient;
      if (machineSystem?.ambientCut) field *= 1 - machineSystem.ambientCut();
      field += rf.machine;
      if (biomeAt(player.pos.x, player.pos.z) === B.WASTELAND) field += TUNING.WASTELAND_RAD;
      if (machineSystem) {
        field *= 1 - protect;
        field *= machineSystem.absorbFactor(player.pos.x, player.pos.z);
      } else {
        field *= 1 - protect;
      }
      r += field;

      if (radIntakeTimer > 0) r *= radIntakeMult;
      _doseRateFrame = _doseFrame;
      _doseRateVal = Math.max(0, r);
      return _doseRateVal;
    }

    function paintRad() {
      const stage = radStage();
      const lethal = TUNING.RAD_LETHAL_DOSE;
      const rate = doseRate();
      const pct = Math.max(0, Math.min(100, (inv.dose / lethal) * 100));
      radFill.style.height = `${pct}%`;
      radNum.textContent = `${stage.name}\n${formatRad(inv.dose)}\n${formatRadRate(rate)}`;
      if (radLd50El) radLd50El.style.bottom = `${(TUNING.RAD_LD50 / lethal) * 100}%`;
      if (radMeterEl) {
        radMeterEl.dataset.stage = stage.name;
        radMeterEl.title = `Dose ${formatRad(inv.dose)} · ARS ${formatRad(TUNING.RAD_ARS_DOSE)} · LD50 ${formatRad(TUNING.RAD_LD50)} · fatal ${formatRad(lethal)}`;
        radMeterEl.setAttribute('aria-valuenow', Math.round(pct));
      }


      if (radDirEl) {
        const rf = radField();
        const on = rf.ambient + rf.machine > 1e-6;
        if (radDirWrap) radDirWrap.style.display = on ? '' : 'none';
        const ang = relativeBearing(rf.dx, rf.dz, player.yaw);
        radDirEl.style.transform = `rotate(${ang}deg)`;
        const label = `${compass(rf.dx, rf.dz)} ${Math.round(rf.dist)}m`;
        if (radDirTxt) radDirTxt.textContent = label;
        radDirEl.title = `Radiation from ${label}`;
      }
    }

    function paintVitals() {
      const hpPct = (vitals.hp / vitals.maxHp) * 100;
      hpFill.style.width = `${hpPct}%`;
      hpNum.textContent = Math.ceil(vitals.hp);
      hungerFill.style.width = `${(vitals.hunger / vitals.maxHunger) * 100}%`;
      hungerNum.textContent = Math.ceil(vitals.hunger);
      woundsEl.innerHTML = Object.keys(vitals.wounds)
        .filter((t) => WOUNDS[t])
        .map((t) => `<span style="--wc:${WOUNDS[t].color}">${WOUNDS[t].name}</span>`).join('');
      document.body.classList.toggle('lowhp', hpPct < 30);
    }




    const deathSpill = [];
    const DEATH_SPILL_PER_FRAME = 5;
    function pumpDeathSpill() {
      for (let k = 0; k < DEATH_SPILL_PER_FRAME && deathSpill.length; k++) {
        const s = deathSpill.shift();
        spawnDrop(s.id, s.n, s.at, s.liquid, s.plates, true);
      }
    }

    function die() {
      if (WORLD_MODE === 'sandbox') {
        vitals.hp = vitals.maxHp;
        vitals.hunger = vitals.maxHunger;
        vitals.wounds = Object.create(null);
        vitals.infectionImmunity = 0;
        vitals.foodNumb = Object.create(null);
        return;
      }

      const at = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
      const spill = (s) => {
        if (s) deathSpill.push({
          id: s.id, n: s.n, at,
          liquid: s.liquid ? { ...s.liquid } : null,
          plates: s.plates ? s.plates.slice() : null,
        });
      };
      deathSpill.length = 0;
      for (const s of inv.hot) spill(s);
      for (const s of inv.main) spill(s);
      for (const slot of ARMOR_ORDER) spill(inv.armor[slot]);
      inv.hot.fill(null);
      inv.main.fill(null);
      inv.armor = { head: null, chest: null, legs: null, feet: null, hands: null };
      inv.dose = 60;
      vitals.hp = vitals.maxHp;
      vitals.hunger = vitals.maxHunger;
      vitals.wounds = Object.create(null);
      vitals.infectionImmunity = 0;
      vitals.foodNumb = Object.create(null);
      fallPeak = 0;
      deathT = 3;
      shakeT = 1.5;
      if (sleep) { sleep = null; if (sleepOverlay) sleepOverlay.style.opacity = '0'; }
      mapSystem?.noteDeath(at.x, at.z);
      spawnAtOrigin();
      syncBars();
    }

    function tuneWaterOvershoot(delta) {
      WATER_OVERSHOOT = Math.max(4, Math.min(40, WATER_OVERSHOOT + delta));
      console.log('WATER_OVERSHOOT', WATER_OVERSHOOT);


      for (const chunk of world.chunks.values()) {
        if (!chunk || chunk.dead) continue;
        chunk.wQueued = false;
        chunk.rebuildWater();
      }
    }

    document.addEventListener('mousemove', (e) => {
      if (!locked) return;
      if (lookSkipEvents > 0) { lookSkipEvents--; return; }
      if (performance.now() < lookBlockedUntil) return;
      if (drive) {
        drive.turnAcc -= e.movementX * 0.0022 * mouseSens;
        return;
      }
      player.yaw -= e.movementX * 0.0022 * mouseSens;
      player.pitch -= e.movementY * 0.0022 * mouseSens * (invertY ? -1 : 1);
      const lim = Math.PI / 2 - 0.02;
      player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
    });

    let shotRequested = false;
    let panoRequested = false;
    document.addEventListener('keydown', (e) => {
      const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (sleep) return;
      if (drive) {
        if (e.code === 'Tab') {
          e.preventDefault();
          if (workbenchUI.opened && machineSystem?.openInst === drive.inst) workbenchUI.close();
          else machineSystem?.open(drive.inst);
          return;
        }
        if (e.code === 'Escape' || e.code === 'KeyE') {
          e.preventDefault();
          if (workbenchUI.opened && machineSystem?.openInst === drive.inst) workbenchUI.close();
          else stopDrive();
          return;
        }
        keys[e.code] = true;
        return;
      }

      if (introOpen || prayOpen) {
        if (prayOpen && e.code === 'Escape') { e.preventDefault(); closePray(); }
        return;
      }

      if (achieveOpen) {
        if (e.code === 'Escape') { e.preventDefault(); closeAchievements(); }
        return;
      }

      if (replayPlay) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) replayPlay.playing = !replayPlay.playing;
        } else if (e.code === 'Escape') {
          e.preventDefault();
          exitReplay();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          seekReplay(replayPlay.t - 5);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          seekReplay(replayPlay.t + 5);
        }
        return;
      }

      if (mapSystem?.isOpen()) {
        if (e.code === 'Escape' || (e.code === 'KeyM' && !typing)) {
          e.preventDefault();
          mapSystem.hide();
        } else if (e.code === 'KeyB' && !typing && !e.repeat) {
          e.preventDefault();
          mapSystem.addBookmark(mapSystem.view.x, mapSystem.view.z);
        } else {
          mapSystem.handleKey(e);
        }
        return;
      }

      if (e.code === 'KeyM' && !e.repeat && !typing && !cmdOpen) {
        e.preventDefault();
        if (invOpen) toggleInv(false, false);
        if (recipeOpen) toggleRecipes(false);
        if (workbenchUI.opened) workbenchUI.close();
        mapSystem?.show();
        return;
      }

      if (e.code === 'KeyB' && !e.repeat && !typing && !cmdOpen) {
        e.preventDefault();
        if (locked) mapSystem?.addBookmark(player.pos.x, player.pos.z);
        return;
      }

      if (e.code === 'KeyT' && recipeSel && e.target.tagName !== 'INPUT' && !cmdOpen) {
        if (visibleTree() && treeRootId === recipeSel) { treePanelEl.classList.add('hidden'); return; }
        treeRootId = recipeSel;
        openTree(recipeSel);
        if (!recipeOpen && document.pointerLockElement) unlockPointer();
        return;
      }
      if (cmdOpen) return;
      if (recipeOpen) {
        if (e.code === 'Escape' && !treePanelEl.classList.contains('hidden')) {
          e.preventDefault();
          treePanelEl.classList.add('hidden');
          return;
        }
        if (e.code === 'Escape' && recipeOpen) {
          e.preventDefault();
          if (recipeSearchEl.value) { recipeSearchEl.value = ''; paintRecipeList(); }
          else toggleRecipes(false);
        }
        else if (e.code === 'Tab') { e.preventDefault(); closeAllMenus(); }
        return;
      }
      keys[e.code] = true;

      if (e.code === 'Space' && !e.repeat && WORLD_MODE === 'sandbox') {
        const now = performance.now();
        if (now - lastSpaceTap < 300) {
          lastSpaceTap = 0;
          flying = !flying;
          if (!flying) player.vel.set(0, 0, 0);
          notice(flying ? 'FLIGHT ON' : 'FLIGHT OFF');
        } else lastSpaceTap = now;
      }

      if (/^Digit[1-7]$/.test(e.code)) {
        inv.sel = +e.code.slice(5) - 1;
        syncBars();
      }

      if (e.code === 'Tab') {
        e.preventDefault();
        if (!closeAllMenus()) toggleInv(true);
      }

      if (e.code === 'Escape' && workbenchUI.opened) workbenchUI.close();
      else if (e.code === 'Escape' && invOpen) toggleInv(false);

      if (e.code === 'KeyF') {
        const held = inv.hot[inv.sel];
        if (held && ITEMS[held.id]?.workbench) {
          machineGridSnap = !machineGridSnap;
          notice(machineGridSnap ? 'WORKBENCH SNAP: GRID' : 'WORKBENCH SNAP: FREE');
        } else {
          wireframe = !wireframe;
          world.material.wireframe = wireframe;
        }
      }

      if (e.code === 'F2') {
        e.preventDefault();
        shotRequested = true;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        panoRequested = true;
      }

      if (e.code === 'KeyO') {        tuneWaterOvershoot(-3);
      }

      if (e.code === 'KeyP' && !e.repeat && e.target.tagName !== 'INPUT' && !cmdOpen) {
        if (prayOpen) closePray();
        else openPray();
      }

      if (e.code === 'KeyV') {
        COLOR_LEVELS = COLOR_LEVELS <= 8 ? 64 : COLOR_LEVELS / 2;
        postMat.uniforms.uLevels.value = COLOR_LEVELS;
      }

      if (e.code === 'KeyI') {
        const nowT = performance.now();
        const windowMs = 8000;
        const frames = (lagSheet.frames || []).filter(f => nowT - f.t <= windowMs);
        const events = (lagSheet.events || []).filter(f => nowT - f.t <= windowMs);
        const worst = [...frames].sort((a, b) => b.ms - a.ms).slice(0, 12);
        const lines = [];
        lines.push('NUCLEARISM LAG TIMESHEET');
        lines.push(`window: last ${(windowMs / 1000) | 0}s  frames: ${frames.length}  events: ${events.length}`);
        const avg = frames.length ? (frames.reduce((a, f) => a + f.ms, 0) / frames.length).toFixed(1) : '0';
        const max = frames.length ? Math.max(...frames.map(f => f.ms)).toFixed(1) : '0';
        lines.push(`avgMs: ${avg}  maxMs: ${max}`);
        lines.push('');
        lines.push('WORST FRAMES (ms, work, idle, other, dirty, loading, rebuild, load, worldMs, renderMs, dirtyMs)');
        for (const f of worst) lines.push(`${f.ms.toFixed ? f.ms.toFixed(1) : f.ms}\t work=${f.workMs ?? ''} idle=${f.idleMs ?? ''} other=${f.otherMs ?? ''} d=${f.dirty} l=${f.loading} rb=${f.rebuild} ld=${f.load} w=${f.worldMs} r=${f.renderMs} pd=${f.dirtyMs}`);
        lines.push('');
        lines.push('EVENTS (>34ms frame or chunk activity)');
        const ev = events.slice(-80);
        for (const f of ev) lines.push(`${f.ms.toFixed ? f.ms.toFixed(1) : f.ms}\t work=${f.workMs ?? ''} idle=${f.idleMs ?? ''} other=${f.otherMs ?? ''} d=${f.dirty} l=${f.loading} rb=${f.rebuild} ld=${f.load} w=${f.worldMs} r=${f.renderMs} pd=${f.dirtyMs}`);
        lines.push('');
        const spans = hudEl.querySelectorAll('.copy');
        const hud = spans.length ? Array.from(spans, (s) => s.innerText).join(' | ') : hudEl.innerText.replace(/\s+/g, ' ').trim();
        lines.push('HUD: ' + hud);
        const text = lines.join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
        notice('LAG TIMESHEET COPIED');
      }

      if (e.code === 'KeyC') {
        if (!player.onGround) slideQueued = true;
        else if (sliding) sliding = false;
      }

      if (e.code === 'KeyR') {
        const held = inv.hot[inv.sel];
        if (held && (ITEMS[held.id].workbench || ITEMS[held.id].building) && !e.repeat) placeRot = (placeRot + Math.PI / 2) % (Math.PI * 2);
      }


      if (e.code === 'KeyE' && (locked || invOpen)) {
        const cx = player.pos.x, cy = player.pos.y + player.eye, cz = player.pos.z;
        if (world.useWater(cx, cy, cz, 0.8, 2.5) > 0) {
          inv.dose = Math.max(0, inv.dose - 6);
          drinkT = 0.9;
          syncBars();
        }
      }

      if (e.code === 'KeyQ' && (locked || invOpen)) {

        let t = -1;
        if (invOpen && hoverSlot >= 0) {
          const [grid, i] = slotOf(hoverSlot);
          if (grid[i]) t = hoverSlot;
        }
        if (t < 0 && inv.hot[inv.sel]) t = inv.sel;
        if (t >= 0) dropAt(t, e.shiftKey);
      }

      if (e.code === 'KeyG') {
        const a = Math.random() * Math.PI * 2;
        const d = 6 + Math.random() * 6;
        const wx = player.pos.x + Math.cos(a) * d;
        const wz = player.pos.z + Math.sin(a) * d;
        if (!spawnWrapper(wx, wz)) notice('WRAPPER NOT READY');
      }

      if (e.code === 'Space') e.preventDefault();
    });

    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    document.addEventListener('contextmenu', (e) => e.preventDefault());






    const cmdEl = document.getElementById('cmd');
    const cmdInput = document.getElementById('cmdInput');
    const cmdSug = document.getElementById('cmdSug');
    let cmdHistory = [], cmdHistIdx = 0, cmdSel = -1, cmdMatches = [];

    const itemLabel = (id) => (ITEMS[id]?.name || id).toUpperCase();

    function editDist(a, b) {
      const m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      let prev = Array.from({ length: n + 1 }, (_, i) => i);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++)
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
      return prev[n];
    }

    function nearestItems(q) {
      q = (q || '').trim().toUpperCase();
      if (!q) return [];
      const out = [];
      for (const id of Object.keys(ITEMS)) {
        const nm = itemLabel(id);
        let s = 99;
        if (nm === q) s = 0;
        else if (nm.startsWith(q)) s = 1;
        else if (id.toUpperCase().startsWith(q)) s = 1.5;
        else if (nm.includes(q)) s = 2.5;
        else {
          let d = Math.min(editDist(q, nm), editDist(q, id.toUpperCase()));
          for (const tok of nm.split(/[^A-Z0-9]+/)) if (tok.length >= 3) d = Math.min(d, editDist(q, tok));
          if (d <= 3) s = 4 + d;
        }
        if (s < 99) out.push([s, id]);
      }
      out.sort((a, b) => a[0] - b[0] || itemLabel(a[1]).localeCompare(itemLabel(b[1])));
      return out.slice(0, 8).map((x) => x[1]);
    }

    const cmdTargetLabel = (id) => TP_TARGETS.find((t) => t.id === id)?.label || id.toUpperCase();

    const SUMMON_ENTITIES = [
      { id: 'chicken', label: 'CHICKEN', aliases: ['chickens'] },
      { id: 'wrapper', label: 'WRAPPER', aliases: ['warped', 'warpper', 'warpped', 'enemy', 'zombie'] },
    ];

    function nearestSummons(q) {
      q = (q || '').trim().toUpperCase();
      if (!q) return SUMMON_ENTITIES.map((e) => e.id);
      const out = [];
      for (const e of SUMMON_ENTITIES) {
        const names = [e.id.toUpperCase(), e.label, ...e.aliases.map((a) => a.toUpperCase())];
        let s = 99;
        for (const nm of names) {
          if (nm === q) s = Math.min(s, 0);
          else if (nm.startsWith(q)) s = Math.min(s, 1);
          else if (nm.includes(q)) s = Math.min(s, 2.5);
          else {
            const d = editDist(q, nm);
            if (d <= 3) s = Math.min(s, 4 + d);
          }
        }
        if (s < 99) out.push([s, e.id]);
      }
      out.sort((a, b) => a[0] - b[0]);
      return out.slice(0, 8).map((x) => x[1]);
    }

    function resolveSummon(q) {
      const Q = (q || '').trim().toUpperCase();
      if (!Q) return null;
      return SUMMON_ENTITIES.find((e) => e.id.toUpperCase() === Q)
        || SUMMON_ENTITIES.find((e) => e.label === Q)
        || SUMMON_ENTITIES.find((e) => e.aliases.some((a) => a.toUpperCase() === Q))
        || SUMMON_ENTITIES.find((e) => e.id === nearestSummons(q)[0])
        || null;
    }

    function cmdEntityLabel(id) {
      return SUMMON_ENTITIES.find((e) => e.id === id)?.label || id.toUpperCase();
    }

    function trySummonEntity(id) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      const pos = player?.pos || camera.position;
      for (const d of [3.5, 2, 4.5, 1, 5.5, 0]) {
        const x = pos.x + dir.x * d;
        const z = pos.z + dir.z * d;
        if (id === 'chicken') {
          if (!chickenTemplate) return 'CHICKEN NOT READY';
          const y = world.getSurfaceHeight(x, z, 90);
          if (!Number.isFinite(y)) continue;
          if (world.waterAt(x, y + 0.3, z) > 0) continue;
          const c = new Chicken(world, x, z, chickenTemplate);
          chickens.push(c);
          return 'SUMMONED CHICKEN';
        }
        if (id === 'wrapper') {
          if (!wrapperTemplate) return 'WRAPPER NOT READY';
          if (spawnWrapper(x, z)) return 'SUMMONED WRAPPER';
        }
      }
      return `CANNOT SUMMON ${cmdEntityLabel(id)} HERE`;
    }

    function summonEntity(id) {
      if (id === 'chicken' && !chickenTemplate) {
        return loadChickenForSummon();
      }
      if (id === 'wrapper' && !wrapperTemplate) {
        return loadWrapperForSummon();
      }
      return trySummonEntity(id);
    }

    function cmdQuery(v) {
      if (/^\s*\/give\b/i.test(v)) {
        const parts = v.replace(/^\s*\/give\s*/i, '').split(/\s+/);
        if (parts.length > 1) return null;
        return { kind: 'item', q: parts[0] || null };
      }
      if (/^\s*\/(?:tp|goto)\b/i.test(v)) {
        const parts = v.replace(/^\s*\/(?:tp|goto)\s*/i, '').split(/\s+/);
        if (parts.length > 1) return null;
        return { kind: 'target', q: parts[0] || '' };
      }
      if (/^\s*\/summon\b/i.test(v)) {
        const parts = v.replace(/^\s*\/summon\s*/i, '').split(/\s+/);
        if (parts.length > 1) return null;
        return { kind: 'entity', q: parts[0] || '' };
      }
      return null;
    }

    let cmdMatchKind = 'item';

    function cmdLabel(id) {
      if (cmdMatchKind === 'target') return cmdTargetLabel(id);
      if (cmdMatchKind === 'entity') return cmdEntityLabel(id);
      return itemLabel(id);
    }

    function renderSuggest(v) {
      const query = cmdQuery(v);
      cmdMatchKind = query ? query.kind : 'item';
      cmdMatches = !query ? []
        : query.kind === 'item' ? (query.q ? nearestItems(query.q) : [])
          : query.kind === 'target' ? nearestTargets(query.q)
            : nearestSummons(query.q);
      cmdSel = cmdMatches.length ? 0 : -1;
      if (!cmdMatches.length) { cmdSug.classList.add('hidden'); cmdSug.innerHTML = ''; return; }
      cmdSug.innerHTML = cmdMatches.map((id, i) =>
        `<div class="row${i === cmdSel ? ' sel' : ''}" data-id="${id}"><span>${cmdLabel(id)}</span><span class="id">${id}</span></div>`
      ).join('');
      cmdSug.classList.remove('hidden');
    }

    function completeCmd(id) {
      const v = cmdInput.value;
      if (/^\s*\/(?:tp|goto)\b/i.test(v)) {
        cmdInput.value = `${/^\s*\/goto\b/i.test(v) ? '/goto' : '/tp'} ${id} `;
      } else if (/^\s*\/summon\b/i.test(v)) {
        cmdInput.value = `/summon ${id} `;
      } else {
        const after = v.replace(/^\s*\/give\s*/i, '').split(/\s+/);
        after[0] = id;
        cmdInput.value = '/give ' + after.join(' ');
      }
      renderSuggest(cmdInput.value);
    }

    function openCmd() {
      cmdOpen = true;
      for (const k of Object.keys(keys)) keys[k] = false;
      cmdEl.classList.remove('hidden');
      cmdInput.value = '';
      renderSuggest('');
      if (document.pointerLockElement) unlockPointer();
      setOverlay(false);
      setTimeout(() => cmdInput.focus(), 0);
    }
    function closeCmd() {
      cmdOpen = false;
      cmdEl.classList.add('hidden');
      cmdSug.classList.add('hidden');
      cmdInput.blur();
      lockPointer();
      setOverlay(false);
      setTimeout(() => { if (!locked && !invOpen && !cmdOpen && !achieveOpen) setOverlay(true); }, 350);
    }

    function resolveItem(q) {
      q = (q || '').trim();
      if (!q) return null;
      if (ITEMS[q]) return q;
      const Q = q.toUpperCase(), ids = Object.keys(ITEMS);
      return ids.find((id) => id.toUpperCase() === Q)
        || ids.find((id) => itemLabel(id) === Q)
        || nearestItems(q)[0]
        || null;
    }





    const TP_RINGS = 10;


    function standYAt(x, z) {
      let y = world.getSurfaceHeight(x, z, 90);
      if (y < 0) return null;
      for (let i = 0; i < 14 && world.field.sample(x, y + 0.5, z) > 0; i++) y += 1;
      return y + 0.2;
    }


    function caveLanding(p) {
      const x = p.x - WORLD_SEED, z = p.z - WORLD_SEED;
      for (let y = Math.floor(p.y); y >= 3; y--) {
        if (world.field.sample(x, y, z) <= 0) continue;
        if (world.field.sample(x, y + 2.2, z) > 0) continue;
        return { x, y: y + 1.15, z };
      }
      return null;
    }

    function nearestCaveOf(kind) {
      const sx = player.pos.x + WORLD_SEED, sz = player.pos.z + WORLD_SEED;
      const cx0 = Math.floor(sx / CAVE_CELL), cz0 = Math.floor(sz / CAVE_CELL);
      for (let r = 0; r <= TP_RINGS; r++) {
        const cands = [];
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const s = caveSite(cx0 + dx, cz0 + dz);
            if (!s) continue;
            let p = null;
            if (kind === 'noodle') {
              if (!s.hub) continue;
              p = s.hub;
            } else {
              if (!s.mouth || !s.rooms.length) continue;
              if (kind === 'cavern' && s.rooms[0].rx < 9) continue;
              p = s.rooms[0];
            }
            cands.push([Math.hypot(p.x - sx, p.z - sz), p]);
          }
        }
        cands.sort((a, b) => a[0] - b[0]);
        for (const [, p] of cands) {
          const at = caveLanding(p);
          if (at) return at;
        }
      }
      return null;
    }


    function industrialLanding(site, part) {
      const x = site.x + part.dx - WORLD_SEED;
      const z = site.z + site.padZ - 0.6 - WORLD_SEED;
      return { x, y: standYAt(x, z), z };
    }

    function nearestIndustrialOf(kind) {
      const sx = player.pos.x + WORLD_SEED, sz = player.pos.z + WORLD_SEED;
      const cx0 = Math.floor(sx / IND_CELL), cz0 = Math.floor(sz / IND_CELL);
      for (let r = 0; r <= TP_RINGS; r++) {
        let best = null, bd = Infinity;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const s = industrialSite(cx0 + dx, cz0 + dz);
            if (!s) continue;
            const part = s.parts.find((p) => (kind === 'any' ? true
              : kind === 'container' ? p.id.startsWith('container') : p.id === kind));
            if (!part) continue;
            const d = Math.hypot(s.x - sx, s.z - sz);
            if (d < bd) { bd = d; best = { site: s, part }; }
          }
        }
        if (best) return industrialLanding(best.site, best.part);
      }
      return null;
    }

    function nearestMachineTarget() {
      if (!machineSystem) return null;
      let best = null, bd = Infinity;
      for (const m of machineSystem.instances) {
        const d = Math.hypot(m.x - player.pos.x, m.z - player.pos.z);
        if (d < bd) { bd = d; best = m; }
      }
      if (!best) return null;
      const x = best.x, z = best.z + best.hz + 2.2;
      return { x, y: standYAt(x, z), z };
    }

    function nearestBiomeOf(id) {
      const sx = player.pos.x, sz = player.pos.z;
      const STEP = 16;
      for (let r = 0; r <= 300; r++) {
        let best = null, bd = Infinity;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (r > 0 && Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const x = sx + dx * STEP, z = sz + dz * STEP;
            if (biomeAt(x, z) !== id) continue;
            let same = 0;
            for (const [ox, oz] of [[8,0],[-8,0],[0,8],[0,-8]]) if (biomeAt(x + ox, z + oz) === id) same++;
            if (same < 2) continue;
            const d = dx * dx + dz * dz;
            if (d < bd) { bd = d; best = { x, z }; }
          }
        }
        if (best) {
          const y = standYAt(best.x, best.z);
          if (y != null) return { x: best.x, y, z: best.z };
        }
      }
      return null;
    }

    const TP_TARGETS = [
      { id: 'cave', label: 'SINKHOLE CAVE', aliases: ['caves', 'sinkhole', 'sinkholes', 'hole'], find: () => nearestCaveOf('cave') },
      { id: 'cavern', label: 'BIG CAVERN', aliases: ['caverns', 'big', 'bigcave'], find: () => nearestCaveOf('cavern') },
      { id: 'noodle', label: 'NOODLE CAVE', aliases: ['noodles', 'worm', 'tunnel'], find: () => nearestCaveOf('noodle') },
      { id: 'building', label: 'INDUSTRIAL BUILDING', aliases: ['house', 'office', 'building_a'], find: () => nearestIndustrialOf('building_a') },
      { id: 'garage', label: 'GARAGE', aliases: ['garages', 'shed'], find: () => nearestIndustrialOf('garage') },
      { id: 'container', label: 'CONTAINER YARD', aliases: ['containers', 'crate', 'crates'], find: () => nearestIndustrialOf('container') },
      { id: 'tank', label: 'LIQUID TANK', aliases: ['tanks', 'liquid_tank'], find: () => nearestIndustrialOf('liquid_tank') },
      { id: 'industrial', label: 'ANY INDUSTRIAL SITE', aliases: ['factory', 'site'], find: () => nearestIndustrialOf('any') },
      { id: 'machine', label: 'NEAREST MACHINE', aliases: ['machines', 'workbench'], find: nearestMachineTarget },
      { id: 'flowers', label: 'FLOWER PLAINS', aliases: ['flower', 'flower_plains', 'flowerplains'], find: () => nearestBiomeOf(B.FLOWER_PLAINS) },
    ];

    function nearestTargets(q) {
      q = (q || '').trim().toUpperCase();
      if (!q) return TP_TARGETS.map((t) => t.id);
      const out = [];
      for (const t of TP_TARGETS) {
        const names = [t.id.toUpperCase(), t.label, ...t.aliases.map((a) => a.toUpperCase())];
        let s = 99;
        for (const nm of names) {
          if (nm === q) s = Math.min(s, 0);
          else if (nm.startsWith(q)) s = Math.min(s, 1);
          else if (nm.includes(q)) s = Math.min(s, 2.5);
          else {
            const d = editDist(q, nm);
            if (d <= 3) s = Math.min(s, 4 + d);
          }
        }
        if (s < 99) out.push([s, t.id]);
      }
      out.sort((a, b) => a[0] - b[0]);
      return out.slice(0, 8).map((x) => x[1]);
    }

    function resolveTarget(q) {
      const Q = (q || '').trim().toUpperCase();
      if (!Q) return null;
      return TP_TARGETS.find((t) => t.id.toUpperCase() === Q)
        || TP_TARGETS.find((t) => t.label === Q)
        || TP_TARGETS.find((t) => t.aliases.some((a) => a.toUpperCase() === Q))
        || TP_TARGETS.find((t) => t.id === nearestTargets(q)[0])
        || null;
    }

    function teleportTo(target) {
      const at = target.find();
      if (!at) return false;
      player.pos.set(at.x, at.y, at.z);
      player.vel.set(0, 0, 0);
      notice(`TP → ${target.label}`);
      return true;
    }

    function clockStr() {
      const f = sunCycleT();
      const hh = Math.floor(f * 24), mm = Math.floor((f * 24 - hh) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    function runCmd(raw) {
      const line = raw.trim();
      if (!line) return;
      cmdHistory.push(line);
      if (cmdHistory.length > 60) cmdHistory.shift();
      cmdHistIdx = cmdHistory.length;
      const m = line.match(/^\/(\w+)\s*(.*)$/);
      if (!m) { notice('COMMANDS: /give, /time, /tp, /summon, /sm, /nuke'); return; }
      const cmd = m[1].toLowerCase(), rest = m[2].trim();

      if (cmd === 'tp' || cmd === 'goto') {
        if (!rest) { notice(`USAGE: /tp <${TP_TARGETS.map((t) => t.id).join('|')}>`); return; }
        const target = resolveTarget(rest);
        if (!target) { notice(`NO DESTINATION "${rest}"`); return; }
        if (!teleportTo(target)) { notice(`NO ${target.label} FOUND NEARBY`); return; }
        closeCmd();
        return;
      }

      if (cmd === 'summon') {
        if (!rest) { notice(`USAGE: /summon <${SUMMON_ENTITIES.map((e) => e.id).join('|')}>`); return; }
        const ent = resolveSummon(rest.split(/\s+/)[0]);
        if (!ent) { notice(`NO ENTITY "${rest}"`); return; }
        const msg = summonEntity(ent.id);
        if (msg) notice(msg);
        closeCmd();
        return;
      }

      if (cmd === 'give') {
        const parts = rest.split(/\s+/);
        const nameQ = parts[0];
        if (!nameQ) { notice('USAGE: /give <item> [count]'); return; }
        const id = resolveItem(nameQ);
        if (!id) { notice(`NO ITEM "${nameQ}"`); return; }
        let n = parts[1] !== undefined ? parseInt(parts[1], 10) : 1;
        if (!Number.isFinite(n) || n < 1) n = 1;
        const left = give(id, n);
        notice(`+${n - (left || 0)} ${itemLabel(id)}`);
        return;
      }

      if (cmd === 'time') {
        const p = rest.split(/\s+/).filter(Boolean);
        if (!p.length) { notice(`DAY ${clock.day} · ${clockStr()}${timeLock !== null ? ' (LOCKED)' : ''}`); return; }
        if (p[0].toLowerCase() === 'allday') {
          if (timeLock === null) { timeLock = TUNING.DAY_SECONDS * ((TUNING.DAY_FRACTION ?? 0.5) / 2); clock.t = timeLock; notice('TIME LOCKED · NOON'); }
          else { timeLock = null; notice('TIME UNLOCKED'); }
          return;
        }
        if (p[0].toLowerCase() === 'night') {
          timeLock = null;
          const f = TUNING.DAY_FRACTION ?? 0.5;
          clock.t = TUNING.DAY_SECONDS * (f + (1 - f) / 2);
          notice(`TIME → DAY ${clock.day} · ${clockStr()}`);
          return;
        }
        const set = p[0].toLowerCase() === 'set';
        if (set || Number.isFinite(parseInt(p[0], 10))) timeLock = null;
        const day = parseInt(set ? p[1] : p[0], 10);
        const tRaw = set ? p[2] : p[1];
        if (Number.isFinite(day) && day >= 1) clock.day = Math.floor(day);
        if (tRaw !== undefined) {
          const t = parseFloat(tRaw);
          if (Number.isFinite(t)) clock.t = Math.max(0, Math.min(TUNING.DAY_SECONDS - 1, t));
        }
        notice(`TIME → DAY ${clock.day} · ${clockStr()}`);
        return;
      }

      if (cmd === 'sm') {
        if (isDay()) { notice('SMILE · ONLY AT NIGHT'); return; }
        spawnHungerSmile();
        notice('SMILE');
        return;
      }

      if (cmd === 'nuke' || cmd === 'strike') {
        if (!spawnNuclearStrike()) notice('NO SAFE STRIKE SITE');
        closeCmd();
        return;
      }

      if (cmd === 'sb') {
        if (WORLD_MODE !== 'sandbox') { notice('SANDBOX ONLY'); return; }
        const left = give('infinite_battery', 1);
        notice(left === 0 ? 'INFINITE BATTERY' : 'NO ROOM');
        return;
      }

      notice(`UNKNOWN COMMAND /${cmd}`);
    }

    document.addEventListener('keydown', (e) => {
      if (sleep) return;
      if (!cmdOpen) {
        if (WORLD_MODE !== 'sandbox') return;
        const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        if (typing) return;
        if (e.code === 'Enter' || e.code === 'Backquote') { e.preventDefault(); openCmd(); }
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); closeCmd(); }
    });

    cmdInput.addEventListener('input', () => renderSuggest(cmdInput.value));
    cmdInput.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        if (!cmdInput.value.trim()) { closeCmd(); return; }
        runCmd(cmdInput.value);
        cmdInput.value = '';
        renderSuggest('');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (cmdSel >= 0 && cmdMatches[cmdSel]) completeCmd(cmdMatches[cmdSel]);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (!cmdHistory.length) return;
        cmdHistIdx = Math.max(0, cmdHistIdx - 1);
        cmdInput.value = cmdHistory[cmdHistIdx] || '';
        renderSuggest(cmdInput.value);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        cmdHistIdx = Math.min(cmdHistory.length, cmdHistIdx + 1);
        cmdInput.value = cmdHistory[cmdHistIdx] || '';
        renderSuggest(cmdInput.value);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        closeCmd();
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (!cmdOpen || cmdEl.contains(e.target)) return;
      closeCmd();
    });
    cmdSug.addEventListener('mousedown', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      e.preventDefault();
      completeCmd(row.dataset.id);
      cmdInput.focus();
    });

    function useMachineTest() {
      const hit = resolveInteractTarget();
      if (hit && hit.type === 'machine') {
        hit.activate();
        return true;
      }
      return false;
    }

    let mining = false, mineTimer = 0;
    let mineConfirm = null;
    const MINE_CONFIRM_MS = 2500;

    function clearMineConfirm() {
      if (!mineConfirm) return;
      mineConfirm = null;
      hideUrgentCard();
    }

    function mineAim() {
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      return { dir, hit: raycastTerrain(origin, dir, REACH) };
    }

    function doMine() {
      const tool = heldTool();
      if (mineConfirm && (performance.now() - mineConfirm.t) > MINE_CONFIRM_MS) clearMineConfirm();
      if (tool.chop && tryChopTree(tool)) { clearMineConfirm(); return; }
      if (tool === BARE_HANDS && shakeTreeForFruit()) { clearMineConfirm(); triggerSwing(0.5); return; }


      {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let best = null, bestT = REACH, bestKind = '';
        for (const w of wrappers) {
          if (w.dying > 0) continue;
          const c = new THREE.Vector3(w.pos.x, w.pos.y + 0.9, w.pos.z);
          const to = c.clone().sub(origin);
          const t = to.dot(dir);
          if (t < 0 || t > bestT) continue;
          if (to.addScaledVector(dir, -t).length() > 0.9) continue;
          best = w; bestT = t; bestKind = 'wrapper';
        }
        for (const ch of chickens) {
          if (ch.dead) continue;
          const c = new THREE.Vector3(ch.pos.x, ch.pos.y + 0.2, ch.pos.z);
          const to = c.clone().sub(origin);
          const t = to.dot(dir);
          if (t < 0 || t > bestT) continue;
          if (to.addScaledVector(dir, -t).length() > 0.35) continue;
          best = ch; bestT = t; bestKind = 'chicken';
        }
        if (best) {
          clearMineConfirm();
          triggerSwing(Math.min(0.5, Math.max(0.2, tool.rate * 0.9)));
          best.hurtBy(tool.damage ?? 15);
          if (bestKind === 'wrapper' && best.dying > 0 && !best._lootDropped) {
            best._lootDropped = true;
            achBump('kills', 1);
            notice('WRAPPER DOWN');
            spawnDrop('forbidden_meat', 1, { x: best.pos.x, y: best.pos.y + 0.5, z: best.pos.z });
          }
          return;
        }
      }

      const { hit } = mineAim();
      triggerSwing(Math.min(0.5, Math.max(0.2, tool.rate * 0.9)));

      if (machineSystem) {
        const aim = resolveInteractTarget();
        if (aim && aim.type === 'machine') {
          const inst = machineSystem.instances.find((i) => i.machine === aim.target);
          const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
          const terrT = hit ? new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5).distanceTo(eye) : Infinity;
          if (inst && aim.t < terrT) {


            const now = performance.now();
            if (mineConfirm && mineConfirm.kind === 'machine' && mineConfirm.uid === inst.uid && (now - mineConfirm.t) <= MINE_CONFIRM_MS) {
              clearMineConfirm();
              machineSystem.remove(inst);
              return;
            }
            mineConfirm = { kind: 'machine', uid: inst.uid, t: now };
            showUrgentCard('HIT AGAIN IF YOU WANT TO MINE IT', (inst.def?.label || 'MACHINE').toUpperCase());
            return;
          }
        }

        if (mineConfirm && mineConfirm.kind === 'machine') clearMineConfirm();
      }

      {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pick = pipeSystem?.pick(origin, dir, 6);
        if (pick) {
          const eye = origin;
          const terrT = hit ? new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5).distanceTo(eye) : Infinity;
          if (pick.distance < terrT) { clearMineConfirm(); pipeSystem.removeAt(pick.cell.x, pick.cell.y, pick.cell.z); return; }
        }
      }
      if (buildingSystem) {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pick = buildingSystem.pick(origin, dir, REACH);
        if (pick) {
          const terrT = hit ? new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5).distanceTo(origin) : Infinity;
          if (pick.distance < terrT) {
            clearMineConfirm();
            const hammer = !!tool.build;
            const broke = buildingSystem.damage(pick.piece, hammer ? 1500 : 30);
            if (broke) {
              const id = Object.keys(ITEMS).find((k) => ITEMS[k].building?.kind === pick.piece.kind
                && ITEMS[k].building?.tier === pick.piece.tier);
              if (id) {
                const left = give(id, 1);
                if (left > 0) {
                  const c = buildingSystem.kind(pick.piece.kind).center(pick.piece.x, pick.piece.y, pick.piece.z, pick.piece.rot);
                  spawnDrop(id, left, { x: c.x, y: c.y, z: c.z });
                }
              }
              notice('WALL DOWN');
            }
            return;
          }
        }
      }
      if (!hit) { clearMineConfirm(); return; }
      clearMineConfirm();
      const band = groundBand(hit.x, hit.y, hit.z);
      footsteps.mine(band === 'grass' ? 'grass' : band === 'dirt' ? 'dirt' : 'stone', 0.55 * masterVolume * 0.7);
      const match = tool.good.includes(band);
      let rateFactor = match ? 1 : (tool.weak || 0.3);
      if (band === 'basalt') rateFactor *= 0.35;
      const hy = hit.y, yy = tool.yield;
      const stoneMult = tool.stone || 1;
      world.mineAnimated(hit.x, hit.y, hit.z, tool.radius, rateFactor, () => {
        achBump('mined', 1);
        if (match && yy > 0) {
          const bonus = yy - 1;
          for (const [id, n] of mineDrops(band, hy, hit.x, hit.z)) {
            const dup = bonus > 0 && Math.random() < bonus ? n : 0;
            let amt = (n + dup) * ((id === 'stone' || id === 'basalt') ? stoneMult : 1);
            if ((id === 'stone' || id === 'basalt') && Math.random() < 0.5) amt = 0;
            if (amt <= 0) continue;
            const left = give(id, amt);
            showGain(id, amt - left, 'MINED');
            if (left > 0) spawnDrop(id, left, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
            if (id === 'uranium' || id === 'thorium' || id === 'beryllium') inv.dose += 2;
          }
        }
        if (band === 'dirt' && hasGardeningGloves() && Math.random() < 0.18) {
          const seeds = ['herb_seed', 'flower_seed', 'wheat_seed', 'potato_seed', 'carrot_seed', 'tomato_seed', 'corn_seed', 'cabbage_seed', 'onion_seed', 'peas_seed', 'spinach_seed', 'cucumber_seed', 'eggplant_seed', 'bell_pepper_seed', 'rice_seed'];
          const sid = seeds[(Math.random() * seeds.length) | 0];
          const left = give(sid, 1);
          showGain(sid, 1 - left, 'FOUND');
          if (left > 0) spawnDrop(sid, left, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
        }
      });
    }


    const MINE_TABLE_SHALLOW = [
      ['carbon', 12], ['copper', 16], ['tin', 12], ['iron', 16], ['lead', 10], ['uranium', 6], ['lithium', 2], ['boron', 1], ['magnesium', 1],
    ];
    const MINE_TABLE_DEEP = [
      ['carbon', 8], ['copper', 10], ['tin', 8], ['iron', 10], ['lead', 8], ['uranium', 11], ['lithium', 5], ['boron', 4], ['magnesium', 4], ['zirconium', 3], ['beryllium', 3], ['thorium', 4], ['polonium', 1],
    ];


    const MINE_ORE_CHANCE = 0.3;
    function mineDrops(band, y, x, z) {
      if (band === 'grass') return [Math.random() < 0.5 ? ['carbon', 1] : ['dirt', 1]];
      if (band === 'dirt') return [['dirt', 1]];
      const base = band === 'basalt' ? 'basalt' : 'stone';
      const savanna = biomeAt(x, z) === B.SAVANNA;
      const seam = regionOre(x, z, savanna);
      if (seam !== 'stone') {
        const chance = MINE_ORE_CHANCE * (savanna && seam === 'iron' ? 1.5 : 1);
        if (Math.random() >= chance) return [[base, 1]];
        const n = savanna && seam === 'iron' ? 2 : 1;
        return [[base, 1], [seam, n]];
      }

      const table = y < 12 ? MINE_TABLE_DEEP : MINE_TABLE_SHALLOW;
      if (Math.random() >= MINE_ORE_CHANCE * 0.5) return [[base, 1]];
      let total = 0; for (const [, w] of table) total += w;
      let r = Math.random() * total;
      for (const [id, w] of table) { r -= w; if (r <= 0) return [[base, 1], [id, savanna && id === 'iron' ? 2 : 1]]; }
      return [[base, 1]];
    }




    function footstepCategory() {
      const p = player.pos;
      if (machineSystem) {
        for (const m of machineSystem.instances) {
          if (Math.abs(p.x - m.x) < m.hx && Math.abs(p.z - m.z) < m.hz
            && Math.abs(p.y - m.top) < 0.7) return 'metal';
        }
      }
      const d = groundDepth(p.x, p.y, p.z);
      if (d >= 3.0) return 'stone';
      if (d >= 1.2) return 'dirt';
      return surfToCategory(BIOME_DEFS[biomeAt(p.x, p.z)].surf);
    }


    function groundBand(x, y, z) {
      const d = groundDepth(x, y, z);
      if (d >= 28) return 'basalt';
      if (d >= 3.0) return 'stone';
      if (d < 3.0 && mountainRockAt(x, z)) return 'stone';
      if (d >= 1.2) return 'dirt';
      return 'grass';
    }



    const holdPlace = { active: false, lastPos: null, lastCell: null, next: 0 };
    function resetHoldPlace() {
      holdPlace.active = false;
      holdPlace.lastPos = null;
      holdPlace.lastCell = null;
      holdPlace.next = 0;
    }




    function coverageSpacing(def) {
      if (!def) return 0;
      if (def.kind === 'cable' || def.kind === 'starter_cable') return 22.5;
      if (def.absorbRadius) return def.absorbRadius * 1.5;
      return 0;
    }



    function uncoveredMachineNear(x, z, r) {
      if (!machineSystem) return false;
      for (const m of machineSystem.instances) {
        if (m.def.kind === 'cable' || m.def.kind === 'starter_cable') continue;
        if (Math.hypot(m.x - x, m.z - z) > r) continue;
        let covered = false;
        for (const p of machineSystem.instances) {
          if ((p.def.kind === 'cable' || p.def.kind === 'starter_cable') && Math.hypot(p.x - m.x, p.z - m.z) <= 6) { covered = true; break; }
        }
        if (!covered) return true;
      }
      return false;
    }


    function pipeCells(x0, z0, x1, z1) {
      const out = [];
      let dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
      let sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1, err = dx - dz;
      let x = x0, z = z0;
      for (;;) {
        if (x !== x0 || z !== z0) out.push([x, z]);
        if (x === x1 && z === z1) break;
        const e2 = err * 2;
        if (e2 > -dz) { err -= dz; x += sx; }
        if (e2 < dx) { err += dx; z += sz; }
      }
      return out;
    }


    function useBuildingUpgrade() {
      const s = inv.hot[inv.sel];
      if (!s || !ITEMS[s.id]?.tool?.build) return false;
      if (!buildingSystem) return false;
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const pick = buildingSystem.pick(origin, dir, REACH);
      if (!pick) return false;
      const piece = pick.piece;
      const idx = BUILD_TIER_ORDER.indexOf(piece.tier);
      if (idx < 0 || idx >= BUILD_TIER_ORDER.length - 1) { notice('ALREADY TOP TIER'); return true; }
      const next = BUILD_TIER_ORDER[idx + 1];
      const cost = BUILD_UPGRADES[piece.tier] || {};
      const counts = invCounts();
      for (const [id, n] of Object.entries(cost)) {
        if ((counts[id] || 0) < n) { notice(`NEED ${n - (counts[id] || 0)} ${id.toUpperCase()}`); return true; }
      }
      for (const [id, n] of Object.entries(cost)) takeInv(id, n);
      buildingSystem.upgrade(piece, next);
      triggerSwing(0.3);
      syncBars();
      notice(`UPGRADED · ${BUILD_TIERS[next].name}`);
      return true;
    }






    function rayBoxT(origin, dir, b) {
      const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
      const mn = [b.minX, b.minY, b.minZ], mx = [b.maxX, b.maxY, b.maxZ];
      let t0 = 0, t1 = Infinity;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return null; continue; }
        let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
        if (a > c) { const t = a; a = c; c = t; }
        if (a > t0) t0 = a;
        if (c < t1) t1 = c;
        if (t1 <= t0) return null;
      }
      return t0;
    }



    function isDoorPiece(p) { return !!p && (p.kind === 'door' || p.kind === 'bunker_door'); }

    function doorBoxes(p) {
      if (!p.open) return p.cells.map(([, b]) => b);
      if (p.kind === 'door') return [{ minX: p.x, maxX: p.x + 1, minY: p.y, maxY: p.y + 3, minZ: p.z, maxZ: p.z + 1 }];
      const kind = buildingSystem.kind(p.kind);
      const off = kind?.slideOffset ? kind.slideOffset(buildingSystem, p, 1) : { x: 0, y: 0, z: 0 };
      return p.cells.map(([, b]) => ({
        minX: b.minX + off.x, maxX: b.maxX + off.x,
        minY: b.minY + off.y, maxY: b.maxY + off.y,
        minZ: b.minZ + off.z, maxZ: b.maxZ + off.z,
      }));
    }

    function doorHit(origin, dir) {
      if (!buildingSystem) return null;
      let best = null, bestT = REACH;
      for (const p of buildingSystem.pieces.values()) {
        if (!isDoorPiece(p)) continue;
        for (const b of doorBoxes(p)) {
          const t = rayBoxT(origin, dir, b);
          if (t !== null && t < bestT) { bestT = t; best = p; }
        }
      }
      return best ? { piece: best, t: bestT } : null;
    }

    function doorUnderCrosshair() {
      if (!buildingSystem) return null;
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const hit = doorHit(origin, dir);
      if (!hit) return null;

      const pick = buildingSystem.pick(origin, dir, REACH);
      if (pick && !isDoorPiece(pick.piece) && pick.distance < hit.t - 0.02) return null;
      const { hit: terr } = mineAim();
      if (terr && origin.distanceTo(terr) < hit.t - 0.02) return null;
      return hit.piece;
    }



    function handFreeForDoor() {
      const s = inv.hot[inv.sel];
      if (!s) return true;
      const d = ITEMS[s.id] || {};
      return !d.consumable && !d.tool;
    }

    function toggleDoor(piece) {
      if (!isDoorPiece(piece) || !buildingSystem) return false;
      const group = piece.kind === 'bunker_door'
        ? [piece, mateOf(buildingSystem, piece)].filter(Boolean)
        : [piece];
      const open = !piece.open;
      if (!open) {
        const body = {
          x: player.pos.x, y: player.pos.y, z: player.pos.z,
          radius: player.radius, height: player.height,
        };
        for (const p of group) {
          if (p.open && buildingSystem.overlapsBody(p.kind, p.x, p.y, p.z, p.rot, body)) {
            notice('DOOR BLOCKED'); return false;
          }
        }
      }
      for (const p of group) if (p.open !== open) buildingSystem.toggle(p);
      triggerSwing(0.25);
      notice(piece.kind === 'bunker_door'
        ? (open ? 'BUNKER DOORS OPEN' : 'BUNKER DOORS CLOSED')
        : (open ? 'DOOR OPEN' : 'DOOR CLOSED'));
      return true;
    }

    function useDoorToggle() {
      if (!handFreeForDoor()) return false;
      const piece = doorUnderCrosshair();
      if (!piece) return false;
      return toggleDoor(piece);
    }


    function updateDoorSwings(dt) {
      buildingSystem?.update(dt || 0);
    }

    function pickItemToHand(id) {
      if (!id || !ITEMS[id]) return false;
      const hot = inv.hot.findIndex((s) => s && s.id === id);
      if (hot >= 0) { inv.sel = hot; syncBars(); return true; }
      const main = inv.main.findIndex((s) => s && s.id === id);
      if (main < 0) return false;
      const prev = inv.hot[inv.sel] || null;
      inv.hot[inv.sel] = inv.main[main];
      inv.main[main] = prev;
      syncBars();
      return true;
    }

    function pickUnderCrosshair() {
      let id = null;
      if (machineSystem) {
        const aim = resolveInteractTarget();
        if (aim?.type === 'machine') {
          const inst = machineSystem.instances.find((i) => i.machine === aim.target);
          if (inst) id = Object.keys(ITEMS).find((k) => ITEMS[k].workbench === inst.def.id) || null;
        }
      }
      if (!id && pipeSystem) {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (pipeSystem.pick(origin, dir, REACH)) id = Object.keys(ITEMS).find((k) => ITEMS[k].pipeGrid) || null;
      }
      if (!id && buildingSystem) {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pick = buildingSystem.pick(origin, dir, REACH);
        if (pick) id = Object.keys(ITEMS).find((k) => ITEMS[k].building?.kind === pick.piece.kind
          && ITEMS[k].building?.tier === pick.piece.tier) || null;
      }
      if (!id) {
        const { hit } = mineAim();
        if (hit) {
          const band = groundBand(hit.x, hit.y, hit.z);
          id = (band === 'stone' || band === 'basalt') ? band : 'dirt';
        }
      }
      if (!pickItemToHand(id)) notice('NOT IN INVENTORY');
    }




    function buildingTarget(b, aim) {
      const kind = buildingSystem?.kind(b.kind);
      if (!kind) return null;
      const { dir, hit } = aim;
      const rot = ((Math.round(placeRot / (Math.PI / 2)) % (kind.rot || 1)) + (kind.rot || 1)) % (kind.rot || 1);
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const groundDistance = hit ? origin.distanceTo(hit) : Infinity;


      if ((b.kind === 'floor' || b.kind === 'roof') && dir.y > 0.35) {
        const px = player.pos.x, pz = player.pos.z, feet = player.pos.y;
        let standingOn = null;
        for (const p of buildingSystem.pieces.values()) {
          if (!['floor', 'roof', 'triangle'].includes(p.kind)) continue;
          const top = buildingSystem.pieceTop(p);
          if (Math.abs(top - feet) > 0.45) continue;
          const fp = buildingSystem.pieceFootprint(p);
          if (!fp || px < fp.x0 - 0.2 || px > fp.x1 + 0.2 || pz < fp.z0 - 0.2 || pz > fp.z1 + 0.2) continue;
          standingOn = { p, top };
          break;
        }
        if (standingOn) {
          const lx = standingOn.p.x + Math.floor((Math.floor(px) - standingOn.p.x) / 3) * 3;
          const lz = standingOn.p.z + Math.floor((Math.floor(pz) - standingOn.p.z) / 3) * 3;

          let wallTop = null;
          for (const p of buildingSystem.pieces.values()) {
            if (!['wall', 'door', 'bunker_door'].includes(p.kind)) continue;
            const fp = buildingSystem.pieceFootprint(p);
            if (!fp) continue;
            if (fp.x1 < lx - 0.5 || fp.x0 > lx + 3.5 || fp.z1 < lz - 0.5 || fp.z0 > lz + 3.5) continue;
            const wt = buildingSystem.pieceTop(p);
            if (wt <= feet + 0.5) continue;
            if (wallTop === null || wt > wallTop) wallTop = wt;
          }

          const base = wallTop !== null ? wallTop - 1 : standingOn.top + 1;
          return { gx: lx, gz: lz, rot, base, anchored: true };
        }
      }

      const pick = buildingSystem.pick(origin, dir, REACH);
      if (pick && pick.distance <= groundDistance + 0.02) {
        const snap = buildingSystem.snap(b.kind, origin, dir, rot, REACH);
        if (snap) return { gx: snap.x, gz: snap.z, rot: snap.rot, base: snap.y, anchored: true };


        const af = buildingSystem.pieceFootprint(pick.piece);
        if (af) {
          const fps = [];
          for (let r = 0; r < (kind.rot || 1); r++) {
            const fp = buildingSystem.kindFootprint(b.kind, r);
            if (fp) fps.push({ rot: r, ...fp });
          }
          const cand = snapPlan(fps, af, pick.point, dir, rot, pick.normal)[0];
          if (cand) {
            const onTop = pick.normal?.y > 0.35 || pick.point.y >= af.y1 - 0.4;
            const base = onTop ? buildingSystem.pieceTop(pick.piece) : pick.piece.y;
            return { gx: cand.x, gz: cand.z, rot: cand.rot, base, anchored: true };
          }
        }
        return null;
      }
      if (!hit) return null;


      const p = hit.clone().addScaledVector(dir, -0.08);
      const fp = buildingSystem.kindFootprint(b.kind, rot);
      const sx = fp.cx1 - fp.cx0 + 1, sz = fp.cz1 - fp.cz0 + 1;
      const gx = Math.floor(p.x / sx) * sx - fp.cx0;
      const gz = Math.floor(p.z / sz) * sz - fp.cz0;


      const base = ['floor', 'roof', 'triangle'].includes(b.kind)
        ? Math.floor(hit.y + 0.01)
        : buildingSystem.groundBase(b.kind, gx, gz, rot, Math.ceil(hit.y + 3));
      return { gx, gz, rot, base, anchored: false };
    }

    function groundSweep(b, t) {

      return !t.anchored && ['floor', 'roof', 'triangle'].includes(b.kind) ? 0.45 : 0;
    }

    function buildingPlaceIssue(b, t) {
      const sweep = groundSweep(b, t);
      if (!buildingSystem.canPlace(b.kind, t.gx, t.base, t.gz, t.rot, sweep)) {
        const kind = buildingSystem.kind(b.kind);
        for (const [key, box] of kind.cells(t.gx, t.base, t.gz, t.rot)) {
          if (buildingSystem.terrainOverlap(box, sweep)) return 'GROUND IS COVERING THIS AREA';
          for (const c of buildingSystem._cellEntries(key)) {
            if (buildingSystem._boxesOverlap(c.box, box) && !buildingSystem._allowedClip(b.kind, c.piece.kind)) return 'ANOTHER BUILDING BLOCK IS HERE';
          }
        }
        return 'CANNOT PLACE HERE';
      }
      const kind = buildingSystem.kind(b.kind);
      if (kind.support && !kind.support(buildingSystem, t.gx, t.base, t.gz, t.rot)) return 'NEEDS SUPPORT UNDER IT';
      if (buildingSystem.overlapsBody(b.kind, t.gx, t.base, t.gz, t.rot, {
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        radius: player.radius, height: player.height,
      })) return 'YOU ARE STANDING IN THE WAY';
      return null;
    }
    function buildingBlocked(b, t) { return !!buildingPlaceIssue(b, t); }

    function doPlace(opts = {}) {
      const drag = !!opts.drag;
      const s = inv.hot[inv.sel];
      if (!s) return null;
      if (ITEMS[s.id].torch) return tryTorchPlace(drag);
      if (ITEMS[s.id].pipeGrid) {
        if (!pipeSystem) return null;
        const { dir, hit } = mineAim();
        if (!hit) return null;
        const gx = Math.floor(hit.x + dir.x * 1.5);
        const gz = Math.floor(hit.z + dir.z * 1.5);
        if (Math.hypot(gx + 0.5 - player.pos.x, gz + 0.5 - player.pos.z) < 1.0) return null;
        const cells = drag && holdPlace.lastCell
          ? pipeCells(holdPlace.lastCell[0], holdPlace.lastCell[1], gx, gz)
          : [[gx, gz]];
        let placed = false;
        for (const [cx, cz] of cells) {
          if (!s.n) break;
          const gy = Math.round(world.getSurfaceHeight(cx + 0.5, cz + 0.5, 90));
          if (!pipeSystem.place(cx, gy, cz)) continue;
          placed = true;
          if (--s.n <= 0) { inv.hot[inv.sel] = null; break; }
        }
        holdPlace.lastCell = [gx, gz];
        if (!placed) return null;
        achBump('placed', 1);
        triggerSwing(0.26);
        syncBars();
        return { type: 'pipe' };
      }
      if (ITEMS[s.id].workbench) {
        if (!machineSystem || !machineSystem.templates.has(ITEMS[s.id].workbench)) return null;
        const { dir, hit } = mineAim();
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const rayDir = new THREE.Vector3(dir.x, dir.y, dir.z);
        const bpick = buildingSystem?.pick(origin, rayDir, REACH);
        let onBuilding = false, placeY;
        let x, z;
        if (bpick && ['floor', 'roof', 'triangle'].includes(bpick.piece.kind) && bpick.normal?.y > 0.4) {
          onBuilding = true;
          placeY = buildingSystem.pieceTop(bpick.piece);
          if (machineGridSnap) { x = Math.floor(bpick.point.x) + 0.5; z = Math.floor(bpick.point.z) + 0.5; }
          else { x = bpick.point.x; z = bpick.point.z; }
        } else {
          if (!hit) return null;
          if (machineGridSnap) { x = Math.floor(hit.x + dir.x * 1.5) + 0.5; z = Math.floor(hit.z + dir.z * 1.5) + 0.5; }
          else { x = hit.x + dir.x * 1.5; z = hit.z + dir.z * 1.5; }
        }
        if (Math.hypot(x - player.pos.x, z - player.pos.z) < 1.4) return null;
        if (machineSystem.at(x, z, 1.4)) return null;
        const def = machineSystem.templates.get(ITEMS[s.id].workbench).def;
        if (drag) {
          const space = coverageSpacing(def);
          if (space && holdPlace.lastPos
            && Math.hypot(x - holdPlace.lastPos.x, z - holdPlace.lastPos.z) < space
            && !(def.kind === 'cable' && uncoveredMachineNear(x, z, 6))) return null;
        }
        if (!machineSystem.place(ITEMS[s.id].workbench, x, z, { rot: placeRot, y: placeY, onBuilding })) return null;
        achBump('machines', 1);
        achBump('placed', 1);
        ach.built[ITEMS[s.id].workbench] = true;
        holdPlace.lastPos = { x, z };
        triggerSwing(0.26);
        if (--s.n <= 0) inv.hot[inv.sel] = null;
        syncBars();
        return { type: 'machine' };
      }
      if (ITEMS[s.id].building) {
        const b = ITEMS[s.id].building;
        const kind = buildingSystem?.kind(b.kind);
        if (!kind) return null;
        const t = buildingTarget(b, mineAim());
        if (!t) return null;
        const { gx, gz, rot, base } = t;
        const issue = buildingPlaceIssue(b, t);
        if (issue) { notice(issue); return null; }
        const piece = buildingSystem.place(b.kind, b.tier, gx, base, gz, rot, false, groundSweep(b, t));
        if (!piece) { notice('CANNOT PLACE HERE'); return null; }
        achBump('placed', 1);
        triggerSwing(0.26);
        if (--s.n <= 0) inv.hot[inv.sel] = null;
        syncBars();
        return { type: 'building' };
      }
      if (!ITEMS[s.id].block) return null;
      if (!TERRAIN_BLOCKS.includes(s.id)) { notice('ONLY DIRT, STONE AND SAND CAN BE PLACED'); return null; }
      const { dir, hit } = mineAim();
      if (!hit) return null;
      const r = Math.min(6, heldTool().radius * 2.2);
      const p = hit.clone().addScaledVector(dir, r * 0.75);
      world.placeAnimated(p, r, dir);
      achBump('placed', 1);
      triggerSwing(0.26);
      if (--s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
      return { type: 'block' };
    }


    let placeGhost = null;
    let placeGhostKey = '';
    let placeRot = 0;
    let machineGridSnap = true;
    let bbEdgeHelper = null;
    let bbEdgeKind = '';
    let _bbEdgePickAt = 0;
    let _bbEdgeLast = null;

    const pieceEdgeGeoms = new Map();
    function pieceEdgeGeometry(kind) {
      if (!pieceEdgeGeoms.has(kind.name)) {
        pieceEdgeGeoms.set(kind.name, new THREE.EdgesGeometry(buildingSystem.geometryFor(kind)));
      }
      return pieceEdgeGeoms.get(kind.name);
    }
    function hidePlaceGhost() {
      if (placeGhost) { scene.remove(placeGhost.group); placeGhost = null; placeGhostKey = ''; }
    }
    function updateBbEdgeHelper(now = 0) {
      const s = inv.hot[inv.sel];
      const relevant = !!(s && (ITEMS[s.id]?.building || s.id === 'hammer'));
      if (!relevant || !buildingSystem || !locked || invOpen || cmdOpen || workbenchUI.opened) {
        if (bbEdgeHelper) bbEdgeHelper.visible = false;
        _bbEdgeLast = null;
        return;
      }
      if (now - _bbEdgePickAt > 80) {
        _bbEdgePickAt = now;
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        _bbEdgeLast = buildingSystem.pick(origin, dir, REACH);
      }
      const pick = _bbEdgeLast;
      if (!pick) { if (bbEdgeHelper) bbEdgeHelper.visible = false; return; }
      const p = pick.piece, kind = buildingSystem.kind(p.kind);
      if (!kind) { if (bbEdgeHelper) bbEdgeHelper.visible = false; return; }
      if (!bbEdgeHelper || bbEdgeKind !== kind.name) {
        if (bbEdgeHelper) scene.remove(bbEdgeHelper);
        bbEdgeHelper = new THREE.LineSegments(
          pieceEdgeGeometry(kind),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })
        );
        bbEdgeHelper.renderOrder = 998;
        bbEdgeKind = kind.name;
        scene.add(bbEdgeHelper);
      }
      const c = kind.center(p.x, p.y, p.z, p.rot);
      const sc = kind.scale(p.x, p.y, p.z, p.rot);
      bbEdgeHelper.position.set(c.x, c.y, c.z);


      bbEdgeHelper.scale.set(sc.x + 0.006, sc.y + 0.006, sc.z + 0.006);
      bbEdgeHelper.rotation.y = kind.rotY ? kind.rotY(p.rot) : 0;
      bbEdgeHelper.visible = true;
    }
    function buildPlaceGhost(model) {
      const group = new THREE.Group();
      group.add(model.clone(true));
      const mats = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        o.material = list.map((m) => {
          const c = m.clone();
          c.transparent = true; c.depthWrite = false;
          c.polygonOffset = true; c.polygonOffsetFactor = -1; c.polygonOffsetUnits = -1;
          mats.push(c); return c;
        });
        if (o.material.length === 1) o.material = o.material[0];
      });
      return { group, mats };
    }
    function updatePlacePreview(now) {
      updateBbEdgeHelper(now);
      const s = inv.hot[inv.sel];
      if (s && ITEMS[s.id].building) { updateWallPreview(now, s.id); return; }
      hideWallGhost();
      if (s && ITEMS[s.id].torch) {
        if (!locked || invOpen || cmdOpen || workbenchUI.opened) { hidePlaceGhost(); return; }
        const t = torchPlaceTarget(s);
        if (!t) { hidePlaceGhost(); return; }
        const key = 'torch:' + s.id;
        if (placeGhostKey !== key) { hidePlaceGhost(); placeGhost = buildPlaceGhost(torchMesh(s.id)); placeGhostKey = key; scene.add(placeGhost.group); }
        const n = new THREE.Vector3(t.nx, t.ny, t.nz);
        orientTorch(placeGhost.group, n, s.id);
        placeGhost.group.position.set(t.x, t.y, t.z);
        const op = 0.22 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.006));
        const tint = t.blocked ? 0xff5555 : 0xffffff;
        for (const m of placeGhost.mats) { m.opacity = op; m.color.setHex(tint); }
        return;
      }
      const wb = s && ITEMS[s.id].workbench;
      if (!wb || !machineSystem || !locked || invOpen || cmdOpen || workbenchUI.opened) { hidePlaceGhost(); return; }
      const tpl = machineSystem.templates.get(wb);
      if (!tpl) { hidePlaceGhost(); return; }
      const { dir, hit } = mineAim();
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const rayDir = new THREE.Vector3(dir.x, dir.y, dir.z);
      const bpick = buildingSystem?.pick(origin, rayDir, REACH);
      let x, z, y;
      if (bpick && ['floor', 'roof', 'triangle'].includes(bpick.piece.kind) && bpick.normal?.y > 0.4) {
        if (machineGridSnap) { x = Math.floor(bpick.point.x) + 0.5; z = Math.floor(bpick.point.z) + 0.5; }
        else { x = bpick.point.x; z = bpick.point.z; }
        y = buildingSystem.pieceTop(bpick.piece);
      } else {
        if (!hit) { hidePlaceGhost(); return; }
        if (machineGridSnap) { x = Math.floor(hit.x + dir.x * 1.5) + 0.5; z = Math.floor(hit.z + dir.z * 1.5) + 0.5; }
        else { x = hit.x + dir.x * 1.5; z = hit.z + dir.z * 1.5; }
        y = world.getSurfaceHeight(x, z, 90);
      }
      const blocked = Math.hypot(x - player.pos.x, z - player.pos.z) < 1.4 || machineSystem.at(x, z, 1.4);
      if (placeGhostKey !== wb) { hidePlaceGhost(); placeGhost = buildPlaceGhost(tpl.model); placeGhostKey = wb; scene.add(placeGhost.group); }
      placeGhost.group.position.set(x, y, z);
      placeGhost.group.rotation.y = placeRot;
      const op = 0.22 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.006));
      const tint = blocked ? 0xff5555 : 0xffffff;
      for (const m of placeGhost.mats) { m.opacity = op; m.color.setHex(tint); }
    }

    let wallGhost = null, wallGhostKey = '', wallGhostEdges = null;
    function hideWallGhost() {
      if (wallGhost) { scene.remove(wallGhost); wallGhost = null; }
      wallGhostKey = '';
      wallGhostEdges = null;
    }
    function updateWallPreview(now, itemId) {
      if (!buildingSystem || !locked || invOpen || cmdOpen || workbenchUI.opened) { hideWallGhost(); return; }
      const b = ITEMS[itemId]?.building;
      const kind = b && buildingSystem.kind(b.kind);
      if (!kind) { hideWallGhost(); return; }
      const aim = mineAim();
      const t = buildingTarget(b, aim);
      if (!t) { hideWallGhost(); return; }
      const { gx, gz, rot, base } = t;
      if (!wallGhost || wallGhostKey !== b.kind) {
        hideWallGhost();



        wallGhost = new THREE.Mesh(
          buildingSystem.geometryFor(kind),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
        );
        wallGhostEdges = new THREE.LineSegments(
          pieceEdgeGeometry(kind),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false })
        );
        wallGhostEdges.scale.setScalar(1.006);
        wallGhost.add(wallGhostEdges);
        wallGhostKey = b.kind;
        scene.add(wallGhost);
      }
      const c = kind.center(gx, base, gz, rot);
      const s = kind.scale(gx, base, gz, rot);
      wallGhost.position.set(c.x, c.y, c.z);
      wallGhost.scale.set(s.x, s.y, s.z);
      wallGhost.rotation.y = kind.rotY ? kind.rotY(rot) : 0;
      const blocked = buildingBlocked(b, t);
      wallGhost.material.opacity = 0.26 + 0.08 * (0.5 + 0.5 * Math.sin(now * 0.006));
      wallGhost.material.color.setHex(blocked ? 0xff5555 : BUILD_TIERS[b.tier].color);
      wallGhostEdges.material.color.setHex(blocked ? 0xff7777 : 0xffffff);
    }



    new GLTFLoader().load('assets/models/torch.gltf',
      (gltf) => {
        const m = gltf.scene;
        const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
        if (size.y > 1e-4) m.scale.multiplyScalar(0.55 / size.y);
        const minY = new THREE.Box3().setFromObject(m).min.y;
        m.position.y -= minY;

        m.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mt) => {
            if (mt && 'emissive' in mt) {
              if (mt.map) mt.emissiveMap = mt.map;
              mt.emissive = new THREE.Color(0xff6a18);
              mt.emissiveIntensity = 0.4;
            }
          });
        });
        torchTemplate = m;
      },
      undefined,
      (e) => console.warn('torch model failed, using fallback', e));


    let cigModel = null;
    new GLTFLoader().load('assets/models/items/cigarette.glb',
      (gltf) => {
        const m = gltf.scene;
        const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
        m.scale.multiplyScalar(0.14 / Math.max(size.x, size.y, size.z, 1e-4));
        const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
        m.position.sub(c);
        m.rotation.z = Math.PI;
        m.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mt) => { if (mt) { mt.depthTest = false; mt.depthWrite = false; } });
          o.renderOrder = 999;
        });
        cigModel = new THREE.Group();
        cigModel.add(m);
        cigModel.position.set(0.09, -0.11, -0.42);
        cigModel.rotation.set(-1.30, 0.15, 0.10);
        cigModel.visible = false;
        camera.add(cigModel);
      },
      undefined,
      (e) => console.warn('cigarette model failed', e));

    function torchMesh(id = 'torch') {
      if (id === 'torch' && torchTemplate) return torchTemplate.clone(true);
      const g = new THREE.Group();
      if (id === 'lantern') {
        const frameMat = new THREE.MeshLambertMaterial({ color: 0x2c2a26 });
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), frameMat);
        base.position.y = 0.03;
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), coreMat);
        core.position.y = 0.16;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.24), frameMat);
        cap.position.y = 0.29;
        g.add(base, core, cap);
      } else if (id === 'floodlight') {
        const caseMat = new THREE.MeshLambertMaterial({ color: 0x3c4148 });
        const lensMat = new THREE.MeshBasicMaterial({ color: 0xd8e8ff });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.2), caseMat);
        body.position.y = 0.14;
        const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), lensMat);
        lens.rotation.x = -Math.PI / 2;
        lens.position.y = 0.285;
        g.add(body, lens);
      } else if (id === 'simple_lamp') {
        const baseMat = new THREE.MeshLambertMaterial({ color: 0x6b5a3a });
        const rimMat = new THREE.MeshLambertMaterial({ color: 0x8a7a55 });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff2cf, side: THREE.DoubleSide });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 18), baseMat);
        base.rotation.x = Math.PI / 2;
        base.position.z = 0.02;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 20), rimMat);
        rim.position.z = 0.045;
        const glow = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), glowMat);
        glow.position.z = 0.05;
        g.add(base, rim, glow);
      } else {
        const stick = new THREE.Mesh(torchStickGeo, torchStickMat);
        stick.position.y = 0.1;
        const flame = new THREE.Mesh(torchFlameGeo, torchFlameMat);
        flame.position.y = 0.44;
        flame.scale.y = 1.35;
        g.add(stick, flame);
      }
      return g;
    }

    function orientTorch(g, n, id) {
      if (id === 'simple_lamp') g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      else g.quaternion.setFromUnitVectors(_tn, n);
    }

    function addTorch(x, y, z, nx, ny, nz, id = 'torch', ax = x - nx * 0.08, ay = y - ny * 0.08, az = z - nz * 0.08) {
      if (torches.length >= TORCH_MAX) return false;
      const type = ITEMS[id]?.light ? id : 'torch';
      const light = ITEMS[type]?.light || DEFAULT_LIGHT;
      const g = torchMesh(type);
      const n = new THREE.Vector3(nx, ny, nz).normalize();
      orientTorch(g, n, type);
      g.position.set(x, y, z);
      scene.add(g);
      torches.push({
        pos: g.position.clone(), grp: g, id: type, light,
        ax, ay, az,
      });
      return true;
    }

    function torchPlaceTarget(s, drag = false) {
      const def = s && ITEMS[s.id];
      if (!def?.light) return null;
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const terr = raycastTerrain(origin, dir, REACH);
      const bpick = buildingSystem?.pick(origin, dir, REACH);
      let best = null;

      if (def.light.mount === 'floor') {
        const cand = [];
        if (terr) {
          const tn = world.getSurfaceNormal(terr.x, terr.y, terr.z);
          if (tn.y >= 0.5) cand.push({ d: terr.distanceTo(origin), x: terr.x, y: terr.y + 0.01, z: terr.z, nx: 0, ny: 1, nz: 0, ax: terr.x, ay: terr.y - 0.08, az: terr.z });
        }
        if (bpick && bpick.normal?.y > 0.4) {
          cand.push({ d: bpick.distance, x: bpick.point.x, y: bpick.point.y + 0.01, z: bpick.point.z, nx: 0, ny: 1, nz: 0, ax: bpick.point.x, ay: bpick.point.y - 0.08, az: bpick.point.z });
        }
        cand.sort((a, b) => a.d - b.d);
        if (!cand.length) return null;
        best = cand[0];
      } else {
        const cand = [];
        if (terr) {
          const tn = world.getSurfaceNormal(terr.x, terr.y, terr.z);
          if (tn.y < 0.45) cand.push({ d: terr.distanceTo(origin), x: terr.x + tn.x * 0.3, y: terr.y + tn.y * 0.3, z: terr.z + tn.z * 0.3, nx: tn.x, ny: tn.y, nz: tn.z, ax: terr.x - tn.x * 0.08, ay: terr.y - tn.y * 0.08, az: terr.z - tn.z * 0.08 });
        }
        if (bpick && bpick.normal && bpick.normal.y < 0.45) {
          const bn = bpick.normal;
          cand.push({ d: bpick.distance, x: bpick.point.x + bn.x * 0.04, y: bpick.point.y + bn.y * 0.04, z: bpick.point.z + bn.z * 0.04, nx: bn.x, ny: bn.y, nz: bn.z, ax: bpick.point.x - bn.x * 0.08, ay: bpick.point.y - bn.y * 0.08, az: bpick.point.z - bn.z * 0.08 });
        }
        cand.sort((a, b) => a.d - b.d);
        if (!cand.length) return null;
        best = cand[0];
      }

      let blocked = torches.length >= TORCH_MAX;
      if (drag && holdPlace.lastPos) {
        const space = def.light.range * 0.85;
        if (Math.hypot(best.x - holdPlace.lastPos.x, best.z - holdPlace.lastPos.z) < space) blocked = true;
      }
      for (const t of torches) {
        if (t.pos.distanceToSquared(new THREE.Vector3(best.x, best.y, best.z)) < 0.36) blocked = true;
      }
      return { x: best.x, y: best.y, z: best.z, nx: best.nx, ny: best.ny, nz: best.nz, ax: best.ax, ay: best.ay, az: best.az, blocked };
    }

    function tryTorchPlace(drag = false) {
      const s = inv.hot[inv.sel];
      const def = s && ITEMS[s.id];
      if (!def?.light) return null;
      const t = torchPlaceTarget(s, drag);
      if (!t || t.blocked) return null;
      if (!addTorch(t.x, t.y, t.z, t.nx, t.ny, t.nz, s.id, t.ax, t.ay, t.az)) return null;
      holdPlace.lastPos = { x: t.x, z: t.z };
      refreshTorchLights();
      triggerSwing(0.24);
      if (--s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
      return { type: 'torch' };
    }


    function refreshTorchLights() {
      const near = torches
        .map((t) => ({ t, d: t.pos.distanceToSquared(player.pos) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, TORCH_LIGHTS);
      for (let i = 0; i < TORCH_LIGHTS; i++) {
        const l = torchLights[i];
        const e = near[i];
        if (!e) { l.intensity = 0; l.position.set(0, -999, 0); continue; }
        const L = e.t.light;
        l.position.set(e.t.pos.x, e.t.pos.y + 0.3, e.t.pos.z);
        l.color.setHex(L.color);
        l.distance = L.range;
        l.intensity = L.power * TORCH_LIGHT_GAIN;
      }
    }

    let torchTimer = 0;

    function updateTorches(dt, now) {
      torchTimer -= dt;
      if (torchTimer > 0) return;
      torchTimer = 0.25;

      for (let i = torches.length - 1; i >= 0; i--) {
        const t = torches[i];
        const dx = t.pos.x - t.ax, dy = t.pos.y - t.ay, dz = t.pos.z - t.az;
        const len = Math.hypot(dx, dy, dz) || 1;
        const ix = dx / len, iy = dy / len, iz = dz / len;
        const sx = t.pos.x - ix * 0.08, sy = t.pos.y - iy * 0.08, sz = t.pos.z - iz * 0.08;
        const supported = world.field.sample(t.ax, t.ay, t.az) > 0
          || world.field.sample(sx, sy, sz) > 0
          || (buildingSystem && (buildingSystem.solidAt(t.ax, t.ay, t.az) || buildingSystem.solidAt(sx, sy, sz)));
        if (!supported) {
          scene.remove(t.grp);
          torches.splice(i, 1);
          give(t.id, 1);
        }
      }
      refreshTorchLights();
    }








    const C4_FUSE = 5;
    const C4_RADIUS = 3.4;
    const C4_BLAST = 12;
    const c4Charges = [];
    let c4Template = null;
    new GLTFLoader().load('assets/models/items/c4.glb',
      (gltf) => {
        const m = gltf.scene;
        const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
        if (Math.max(size.x, size.y, size.z) > 1e-4) m.scale.multiplyScalar(0.30 / Math.max(size.x, size.y, size.z));
        m.position.y -= new THREE.Box3().setFromObject(m).min.y;
        c4Template = m;
      },
      undefined,
      (e) => console.warn('c4 model failed, using fallback', e));

    function c4Mesh() {
      if (c4Template) return c4Template.clone(true);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.20),
        new THREE.MeshLambertMaterial({ color: 0xb0a060 }));
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      led.position.set(0.08, 0.09, 0);
      g.add(body, led);
      return g;
    }

    let beepCtx = null;
    function boom(vol = 0.5) {
      if (vol <= 0.001) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      beepCtx = beepCtx || new C();
      if (beepCtx.state === 'suspended') beepCtx.resume().catch(() => {});
      const t = beepCtx.currentTime;
      const o = beepCtx.createOscillator(), g = beepCtx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g).connect(beepCtx.destination);
      o.start(t); o.stop(t + 0.75);
    }
    function c4Audible(x, z, base) {
      const d = Math.hypot(x - player.pos.x, z - player.pos.z);
      return base * Math.max(0, 1 - d / 40);
    }

    function placeC4(x, y, z) {
      const grp = c4Mesh();
      grp.position.set(x, y, z);
      grp.rotation.y = Math.random() * Math.PI * 2;
      scene.add(grp);
      c4Charges.push({ grp, x, y, z, t: 0, next: 0.05 });
      notice(`C4 ARMED · ${C4_FUSE}s`);
    }

    function useC4() {
      const s = inv.hot[inv.sel];
      if (!s || !ITEMS[s.id]?.c4) return false;
      const { hit } = mineAim();
      if (!hit) return true;
      const n = world.getSurfaceNormal(hit.x, hit.y, hit.z);
      if (n.y < 0.5) { notice('PLACE C4 ON THE GROUND'); return true; }
      placeC4(hit.x, hit.y + 0.02, hit.z);
      triggerSwing(0.26);
      if (--s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
      return true;
    }

    function detonateC4(c) {
      const i = c4Charges.indexOf(c);
      if (i < 0) return;
      c4Charges.splice(i, 1);
      achBump('blasts');
      scene.remove(c.grp);




      const f = world.field, r = C4_RADIUS;
      const mined = new Map();
      for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++)
        for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++)
          for (let z = Math.floor(c.z - r); z <= Math.ceil(c.z + r); z++) {
            if (Math.hypot(x - c.x, y - c.y, z - c.z) > r) continue;
            if (f.get(x, y, z) <= 0) continue;
            for (const [id, n] of mineDrops(groundBand(x, y, z), y, x, z))
              mined.set(id, (mined.get(id) || 0) + n);
            f.set(x, y, z, -1);
          }
      world.markEdited(Math.floor(c.x - r), Math.ceil(c.x + r),
        Math.floor(c.y - r), Math.ceil(c.y + r), Math.floor(c.z - r), Math.ceil(c.z + r));
      const floorY = world.getSurfaceHeight(c.x, c.z, 90);
      let di = 0;
      for (const [id, n] of mined) {
        spawnDrop(id, n, { x: c.x + ((di % 3) - 1) * 0.5, y: floorY, z: c.z + ((((di / 3) | 0) % 3) - 1) * 0.5 });
        di++;
      }


      const d = Math.hypot(player.pos.x - c.x, player.pos.y + player.eye - c.y, player.pos.z - c.z);
      const fall = Math.max(0, 1 - d / C4_BLAST);
      if (fall > 0) { hurt(70 * fall, 'burn'); inv.dose += 45 * fall; }
      shakeT = Math.max(shakeT, 0.3 + 1.2 * fall);
      boom(c4Audible(c.x, c.z, 0.55));


      if (machineSystem) {
        for (const m of machineSystem.instances.slice()) {
          if (Math.hypot(m.x - c.x, m.z - c.z) <= r + 0.5) machineSystem.remove(m, false);
        }
      }


      for (const o of c4Charges.slice()) {
        if (Math.hypot(o.x - c.x, o.y - c.y, o.z - c.z) <= r + 1.5) detonateC4(o);
      }
    }

    function updateC4(dt) {
      for (const c of c4Charges.slice()) {
        c.t += dt;
        if (c.t >= C4_FUSE) detonateC4(c);
      }
    }



    function useBweController() {
      const s = inv.hot[inv.sel];
      if (!s || s.id !== 'bwe_controller') return false;
      if (!machineSystem) return true;
      let best = null, bestD = Infinity;
      for (const m of machineSystem.instances) {
        if (m.def.kind !== 'bwe') continue;
        const d = Math.hypot(m.x - player.pos.x, m.z - player.pos.z);
        if (d < bestD) { bestD = d; best = m; }
      }
      if (!best) { notice('NO BWE FOUND'); return true; }
      if (bestD > 128) { notice(`NEAREST BWE ${Math.round(bestD)}m AWAY`); return true; }
      notice(`BWE LINKED · ${Math.round(bestD)}m`);
      machineSystem.open(best);
      return true;
    }



    function useSkylineWrench() {
      const s = inv.hot[inv.sel];
      if (!s || !ITEMS[s.id]?.tool?.wrench) return false;
      if (!skylineSystem) return true;
      const aim = resolveInteractTarget();
      if (!aim || aim.type !== 'machine') { notice('AIM AT A MACHINE'); return true; }
      const inst = machineSystem.instances.find((i) => i.machine === aim.target);
      if (!inst) return true;
      return skylineSystem.useWrenchOn(inst);
    }

    function useLiquidContainer() {
      const s = inv.hot[inv.sel];
      if (!s) return false;
      const def = ITEMS[s.id];
      if (!def || !def.container) return false;
      const { hit } = mineAim();
      if (!hit) return false;
      const cx = hit.x, cz = hit.z;
      const wy = hit.y + 0.25;
      const cap = def.container.capacity;
      const vol = Liquid.volume(s);

      if (vol <= 0) {
        if (world.waterAt(cx, wy, cz) <= 0 || !Liquid.accepts(def, 'water')) return false;
        const removed = world.useWater(cx, wy, cz, Math.min(cap, 2), 1.4);
        if (removed <= 0) return false;
        const added = Liquid.fill(s, def, 'water', Math.min(removed, cap));
        if (added <= 0) { world.addWater(cx, cz, removed, 1.4); return false; }
        notice(`${def.name} · ${Math.round(Liquid.volume(s))}/${cap} WATER`);
        syncBars();
        return true;
      }

      const id = s.liquid.id;
      const L = LIQUID_DEFS[id] || {};
      const amt = Liquid.drain(s, vol);
      if (id === 'water') { notice(`DISCARDED ${Math.round(amt)} WATER`); }
      else if (L.acidic) {
        inv.dose += (L.rad || 0) * 10;
        hurt(6, 'burn');
        addWound('poison');
        notice(`POURED ${L.name || id} · BURNED`);
      }
      else if (L.rad) { inv.dose += L.rad * 10; notice(`POURED ${L.name || id} · HOT`); }
      else notice(`POURED ${L.name || id}`);
      syncBars();
      return true;
    }


    function applyConsumable(s, def) {
      const c = def.consumable;
      inv.dose = Math.max(0, inv.dose + (c.dose || 0));
      if (c.food) {
        vitals.hunger = Math.min(vitals.maxHunger, vitals.hunger + effectiveFood(s.id, c.food));
        vitals.foodNumb[s.id] = Math.max(-2, foodNumb(s.id) - 0.1);
        for (const id of Object.keys(vitals.foodNumb)) {
          if (id !== s.id) vitals.foodNumb[id] = Math.min(2, foodNumb(id) + 0.1);
        }
      }
      if (c.cures) cureWounds(c.cures);
      if (c.heal) vitals.hp = Math.min(vitals.maxHp, vitals.hp + c.heal);
      if (c.immunity) vitals.infectionImmunity = Math.max(vitals.infectionImmunity, c.immunity);
      if (def.consumable.shieldTime) armorShieldTimer = def.consumable.shieldTime;
      if (def.consumable.intake) { radIntakeMult = def.consumable.intake; radIntakeTimer = def.consumable.intakeTime || 1800; }
      if (def.consumable.wound) addWound(def.consumable.wound);
      if (def.consumable.speedTime) { smokeTime = def.consumable.speedTime; smokeSpeed = def.consumable.speed || 1; }
      if (def.consumable.smoke) {
        if (!hasLighter()) { notice('NEED A LIGHTER'); return; }
        smokeTime = def.consumable.smoke; smokeSpeed = def.consumable.speed || 1;
      }
      if (s.id === 'cup_noodles' && !drink) startDrink();
      s.n--; if (s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
    }

    function useConsumable() {
      const s = inv.hot[inv.sel];
      if (!s) return false;
      const def = ITEMS[s.id];
      if (!def || !def.consumable) return false;
      if (eat) return true;

      if (def.consumable.food && !propModels.has(s.id)) {
        startEat(s, def);
        return true;
      }
      applyConsumable(s, def);
      return true;
    }

    renderer.domElement.addEventListener('mousedown', (e) => {
      if (!locked || invOpen || sleep || drive) return;
      if (e.button === 0) { mining = true; mineTimer = 0; }
      else if (e.button === 1) {
        e.preventDefault();
        pickUnderCrosshair();
      }
      else if (e.button === 2) {
        const held = inv.hot[inv.sel];
        const hd = held && ITEMS[held.id];
        const holdingPlaceable = !!(hd && (hd.torch || hd.pipeGrid || hd.workbench || hd.building || (hd.block && TERRAIN_BLOCKS.includes(held.id))));
        if (!holdingPlaceable) {
          if (useBweController()) return;
          if (useBuildingUpgrade()) return;
          if (useSkylineWrench()) return;
          if (useConsumable()) return;
          if (useDoorToggle()) return;
          if (useInteractable()) return;
          if (useLiquidContainer()) return;
          if (useC4()) return;
        }
        resetHoldPlace();
        doPlace();
        const s = inv.hot[inv.sel];
        if (s && (ITEMS[s.id].torch || ITEMS[s.id].pipeGrid || ITEMS[s.id].workbench || ITEMS[s.id].building || (ITEMS[s.id].block && TERRAIN_BLOCKS.includes(s.id)))) {
          holdPlace.active = true;
          holdPlace.next = performance.now() + 140;
        }
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) mining = false;
      else if (e.button === 2) resetHoldPlace();
    });


    function raycastTerrain(origin, dir, maxDist) {
      const step = 0.18;
      let t = 0;
      let prevSolid = false;
      const p = new THREE.Vector3();

      while (t < maxDist) {
        p.copy(origin).addScaledVector(dir, t);
        const d = world.field.sample(p.x, p.y, p.z);
        const solid = d > 0;

        if (solid && !prevSolid) {
          return p.clone();
        }
        prevSolid = solid;
        t += step;
      }
      return null;
    }





    function playerCollides() {
      const p = player.pos;
      const r = player.radius;
      const h = player.height;



      const ys = [0.25, 0.6, 0.95, 1.3, Math.min(player.eye, h - 0.02), h - 0.02];


      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dx = Math.cos(ang) * r;
        const dz = Math.sin(ang) * r;
        for (const y of ys) {
          if (world.field.sample(p.x + dx, p.y + y, p.z + dz) > 0) return true;
        }
      }

      for (const y of ys) {
        if (world.field.sample(p.x, p.y + y, p.z) > 0) return true;
      }


      if (buildingSystem?.collidesBody(p.x, p.y, p.z, r, h)) return true;


      if (structureCollidesBody(p.x, p.y, p.z, r, h)) return true;
      return false;
    }

    function collidesAtY(y) {
      const saved = player.pos.y;
      player.pos.y = y;
      const hit = playerCollides();
      player.pos.y = saved;
      return hit;
    }






    function groundY(up = 0.3, down = 0.7) {
      if (collidesAtY(player.pos.y + up) || !collidesAtY(player.pos.y - down)) return null;
      let a = player.pos.y - down, b = player.pos.y + up;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) * 0.5;
        if (collidesAtY(m)) a = m; else b = m;
      }
      return b;
    }


    function fits(dx, dz, dy) {
      player.pos.x += dx; player.pos.z += dz; player.pos.y += dy;
      const b = playerCollides();
      player.pos.x -= dx; player.pos.z -= dz; player.pos.y -= dy;
      return !b;
    }




    const MAX_WALK_SLOPE = Math.tan(50 * Math.PI / 180);
    const SLOPE_PROBE = 1.0;
    const STEP_UP_MAX = 0.6;

    function slopeBlocked(dx, dz) {
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return false;
      const reach = Math.max(SLOPE_PROBE, len);
      const from = player.pos.y + 3;
      const y0 = world.surfaceY(player.pos.x, player.pos.z, from);
      const y1 = world.surfaceY(player.pos.x + dx / len * reach, player.pos.z + dz / len * reach, from);
      return y1 - y0 > reach * MAX_WALK_SLOPE;
    }

    function tryStepUp(dx, dz) {
      let lift = -1;
      for (let s = 0.12; s <= STEP_UP_MAX; s += 0.12) {
        if (fits(dx, dz, s)) { lift = s; break; }
      }
      if (lift < 0) return false;
      for (let s = lift - 0.02; s > 0.001; s -= 0.02) {
        if (fits(dx, dz, s)) lift = s; else break;
      }
      lift += 0.02;
      player.pos.y += lift;
      player.pos.x += dx;
      player.pos.z += dz;
      if (playerCollides()) {
        player.pos.x -= dx;
        player.pos.z -= dz;
        player.pos.y -= lift;
        return false;
      }
      if (player.vel.y < 0) player.vel.y = 0;
      player.onGround = true;
      return true;
    }


    let sliding = false, slideT = 0, slideQueued = false;
    const SLIDE_TIME = 1.6;

    function accelerate(wx, wz, wishSpeed, accel, dt) {
      const cur = player.vel.x * wx + player.vel.z * wz;
      const add = wishSpeed - cur;
      if (add <= 0) return;
      const a = Math.min(accel * dt * wishSpeed, add);
      player.vel.x += wx * a;
      player.vel.z += wz * a;
    }

    function friction(dt, coef) {
      const sp = Math.hypot(player.vel.x, player.vel.z);
      if (sp < 0.1) { player.vel.x = 0; player.vel.z = 0; return; }
      const ns = Math.max(0, sp - sp * coef * dt) / sp;
      player.vel.x *= ns;
      player.vel.z *= ns;
    }






    function structureCollidesBody(x, y, z, r, h,
      machines = machineSystem?.instances || [], industries = industrialColliders) {
      if (!machines.length && !industries.length) return false;
      const head = y + h;
      for (const m of machines) {
        if (head <= m.y + 1e-4 || y >= m.top - 1e-4) continue;
        const qx = Math.max(m.x - m.hx, Math.min(x, m.x + m.hx));
        const qz = Math.max(m.z - m.hz, Math.min(z, m.z + m.hz));
        if ((x - qx) ** 2 + (z - qz) ** 2 < r * r) return true;
      }
      for (const c of industries) {
        if (head <= c.base + 1e-4 || y >= c.top - 1e-4) continue;
        if (c.kind === 'box') {
          const qx = Math.max(c.x - c.hx, Math.min(x, c.x + c.hx));
          const qz = Math.max(c.z - c.hz, Math.min(z, c.z + c.hz));
          if ((x - qx) ** 2 + (z - qz) ** 2 < r * r) return true;
          continue;
        }
        const m = c.mask, s = c.s;
        const wx = x - c.x, wz = z - c.z;
        const lx = (wx * c.cos - wz * c.sin) / s;
        const lz = (wx * c.sin + wz * c.cos) / s;
        const rr = r / s, cell = m.cell;
        const gx = Math.floor((lx - m.minX) / cell);
        const gz = Math.floor((lz - m.minZ) / cell);
        const rad = Math.ceil(rr / cell) + 1;
        for (let j = gz - rad; j <= gz + rad; j++) {
          if (j < 0 || j >= m.rows) continue;
          for (let i = gx - rad; i <= gx + rad; i++) {
            if (i < 0 || i >= m.cols) continue;
            if (!m.data[j * m.cols + i]) continue;
            const x0 = m.minX + i * cell, z0 = m.minZ + j * cell;
            const nx = Math.max(x0, Math.min(lx, x0 + cell));
            const nz = Math.max(z0, Math.min(lz, z0 + cell));
            const ddx = lx - nx, ddz = lz - nz;
            if (ddx * ddx + ddz * ddz < rr * rr) return true;
          }
        }
      }
      return false;
    }

    function movePlayer(dt) {
      if (mapSystem?.isOpen()) return;

      if (flying) {
        const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
        const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
        const u = (keys.Space ? 1 : 0) - ((keys.ShiftLeft || keys.ShiftRight) ? 1 : 0);
        const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
        let dx = (-sinY * f) + (cosY * s);
        let dz = (-cosY * f) - (sinY * s);
        const len = Math.hypot(dx, dz);
        if (len > 1e-6) { dx /= len; dz /= len; }
        const sp = 14;
        player.pos.x += dx * sp * dt;
        player.pos.z += dz * sp * dt;
        player.pos.y += u * sp * dt;
        player.vel.set(0, 0, 0);
        player.onGround = false;
        fallPeak = 0;
        return;
      }

      landingCooldown = Math.max(0, landingCooldown - dt);

      const inWater = world.waterAt(player.pos.x, player.pos.y + 0.4, player.pos.z) > 0;


      if (inWater) {
        player.vel.y -= 6 * dt;
        if (player.vel.y < -4) player.vel.y = -4;
        if (keys.Space) player.vel.y = 3.5;
        if (keys.KeyZ) player.vel.y = -3.5;
      } else {
        player.vel.y -= 26 * dt;
        if (player.vel.y < -55) player.vel.y = -55;
        if (player.vel.y < 0) fallPeak = Math.max(fallPeak, -player.vel.y);
      }


      const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
      const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

      let sprint = (keys.ShiftLeft || keys.ShiftRight) && !inWater && (forward !== 0 || strafe !== 0);
      if (sprint && vitals.hunger <= 5) sprint = false;
      if (sprint) vitals.hunger = Math.max(0, vitals.hunger - 0.04 * dt);
      const speed = (inWater ? 2.8 : (sprint ? 7.2 : 4.2)) * radStage().speed * woundSpeed() * (smokeTime > 0 ? smokeSpeed : 1);


      const FWD_MULT = 1, BACK_MULT = 0.45, STRAFE_MULT = 0.65;
      const fW = forward > 0 ? FWD_MULT : BACK_MULT;
      const sW = STRAFE_MULT;

      let wx = 0, wz = 0, speedMul = 1;
      if (forward || strafe) {
        const sinY = Math.sin(player.yaw);
        const cosY = Math.cos(player.yaw);

        const F = forward * fW, S = strafe * sW;
        wx = (-sinY * F) + (cosY * S);
        wz = (-cosY * F) - (sinY * S);
        const len = Math.hypot(wx, wz);
        speedMul = Math.min(1, len);
        wx /= len; wz /= len;
      }


      if (!inWater && keys.Space && player.onGround) {
        if (vitals.hunger >= 1) vitals.hunger -= 1;
        player.vel.y = 8.6;
        player.onGround = false;
        sliding = false;
      }

      const wasGrounded = player.onGround;

      if (sliding) {
        slideT -= dt;
        if (slideT <= 0 || !wasGrounded || Math.hypot(player.vel.x, player.vel.z) < 3) sliding = false;
      }

      if (wasGrounded) {
        if (sliding) {
          friction(dt, 0.6);
          if (wx || wz) accelerate(wx, wz, speed * speedMul, 3, dt);

          const ssp = Math.hypot(player.vel.x, player.vel.z);
          if (ssp > 0.5) {
            const nx = player.vel.x / ssp, nz = player.vel.z / ssp;
            const drop = world.getSurfaceHeight(player.pos.x, player.pos.z, player.pos.y + 3)
              - world.getSurfaceHeight(player.pos.x + nx * 1.4, player.pos.z + nz * 1.4, player.pos.y + 3);
            const sa = Math.max(-9, Math.min(14, drop * 7));
            player.vel.x += nx * sa * dt;
            player.vel.z += nz * sa * dt;
          }
        } else {
          friction(dt, inWater ? 4 : 10);
          if (wx || wz) accelerate(wx, wz, speed * speedMul, inWater ? 8 : 40, dt);
        }
      } else if (wx || wz) {
        accelerate(wx, wz, speed * speedMul, 5, dt);
      }


      const hs = Math.hypot(player.vel.x, player.vel.z);
      if (hs > 16) {
        player.vel.x *= 16 / hs;
        player.vel.z *= 16 / hs;
      }


      const dx = player.vel.x * dt;
      const dy = player.vel.y * dt;
      const dz = player.vel.z * dt;

      player.onGround = false;



      let mx = dx, mz = dz;
      if (wasGrounded) {
        if (dx !== 0 && slopeBlocked(dx, 0)) { mx = 0; player.vel.x = 0; }
        if (dz !== 0 && slopeBlocked(0, dz)) { mz = 0; player.vel.z = 0; }
      }




      const stuckX = playerCollides();
      player.pos.x += mx;
      if (!stuckX && playerCollides()) {
        player.pos.x -= mx;
        if (!(mx !== 0 && player.vel.y <= 0.5 && tryStepUp(mx, 0))) player.vel.x = 0;
      }


      const stuckZ = playerCollides();
      player.pos.z += mz;
      if (!stuckZ && playerCollides()) {
        player.pos.z -= mz;
        if (!(mz !== 0 && player.vel.y <= 0.5 && tryStepUp(0, mz))) player.vel.z = 0;
      }


      player.pos.y += dy;
      if (playerCollides()) {
        player.pos.y -= dy;
        if (player.vel.y < 0) player.onGround = true;
        player.vel.y = 0;
      } else if (wasGrounded && player.vel.y <= 0 && (mx !== 0 || mz !== 0)) {

        const gy = groundY();
        if (gy !== null) {
          player.pos.y = gy;
          player.onGround = true;
          player.vel.y = 0;
        }
      }


      if (trunkColliders.length) {
        const t0 = performance.now();
        const sx = player.pos.x, sz = player.pos.z;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < trunkColliders.length; i++) {
            const t = trunkColliders[i];
            const ddx = player.pos.x - t.x, ddz = player.pos.z - t.z;
            const rr = t.r + player.radius;
            const d2 = ddx * ddx + ddz * ddz;
            if (d2 >= rr * rr || d2 < 1e-8) continue;
            const d = Math.sqrt(d2), nx = ddx / d, nz = ddz / d, push = rr - d;
            player.pos.x += nx * push;
            player.pos.z += nz * push;
            const vn = player.vel.x * nx + player.vel.z * nz;
            if (vn < 0) { player.vel.x -= vn * nx; player.vel.z -= vn * nz; }
          }
        }
        if (playerCollides()) { player.pos.x = sx; player.pos.z = sz; }
        vegPerf.collide += performance.now() - t0;
      }




      if (!wasGrounded && player.onGround) {
        if (landingCooldown <= 0) {
          if (fallPeak > 15) {
            const dmg = (fallPeak - 15) * 3;
            hurt(dmg, 'pain');
            if (dmg > 20) addWound('bleeding');
            notice(`FALL · -${Math.round(dmg)} HP`);
          }
          if (!inWater) footsteps.land(footstepCategory(), Math.min(0.9, 0.62 + fallPeak * 0.012) * masterVolume * 0.7);
          landingVelocity -= Math.min(2.8, 0.9 + fallPeak * 0.035);
          landingCooldown = 0.22;
        }
        fallPeak = 0;
        if (slideQueued) {
          sliding = true;
          slideT = SLIDE_TIME;
          const sp = Math.hypot(player.vel.x, player.vel.z);
          if (sp > 0.5) {
            const b = Math.min(3.5, sp * 0.35);
            player.vel.x += player.vel.x / sp * b;
            player.vel.z += player.vel.z / sp * b;
          }
        } else sliding = false;
        slideQueued = false;
      }


      const steppedDist = Math.hypot(player.pos.x - stepPrev.x, player.pos.z - stepPrev.z);
      stepPrev.copy(player.pos);
      if (player.onGround && !sliding && !inWater && Math.hypot(player.vel.x, player.vel.z) > 0.6) {
        stepAccum += steppedDist;
      } else {
        stepAccum = 0;
      }
      if (stepAccum > 2.2) {
        stepAccum = 0;
        footsteps.step(footstepCategory(), (sprint ? 0.6 : 0.42) * masterVolume * 0.7);
      }


      if (player.pos.y < CHUNK_Y_MIN * CHUNK_SIZE - 20) {
        spawnOnGround(player.pos.x, player.pos.z);
      }
    }



    function updateBreath(dt) {
      const head = world.waterAt(player.pos.x, player.pos.y + player.eye, player.pos.z) > 0;
      player.oxygen = head
        ? Math.max(0, player.oxygen - dt / 12)
        : Math.min(1, player.oxygen + dt / 4);
      if (player.oxygen <= 0) { inv.dose += 25 * dt; hurt(2.5 * dt, 'respiratory'); }
    }





    const walkers = [];







    const wrappers = [];
    const WRAPPER_SPAWN = {
      radius: [26, 52],
      nightCap: 2,
      wasteCap: 5,
      nightRoll: 9,
      wasteRoll: 6,
      nightChance: 0.35,
    };
    let wrapperSpawnT = 8;
    let wrapperLoading = false;
    let wrapperSummonPending = false;

    function loadWrapperTemplate(onLoad, onError) {
      if (wrapperTemplate) { onLoad?.(wrapperTemplate); return; }
      if (wrapperLoading) return;
      wrapperLoading = true;
      new GLTFLoader().load(WRAPPER.url, (gltf) => {
        wrapperTemplate = { scene: gltf.scene, clips: gltf.animations };
        wrapperLoading = false;
        if (wrapperSummonPending) {
          wrapperSummonPending = false;
          notice(trySummonEntity('wrapper'));
        }
        onLoad?.(wrapperTemplate);
      }, undefined, (err) => {
        wrapperLoading = false;
        if (wrapperSummonPending) {
          wrapperSummonPending = false;
          notice('WRAPPER NOT READY');
        }
        console.warn('wrapper model failed to load', err);
        onError?.(err);
      });
    }

    function loadWrapperForSummon() {
      if (wrapperTemplate) return trySummonEntity('wrapper');
      wrapperSummonPending = true;
      loadWrapperTemplate();
      return wrapperLoading || wrapperTemplate ? 'LOADING WRAPPER...' : 'WRAPPER NOT READY';
    }

    loadWrapperTemplate();

    function spawnWrapper(x, z) {
      if (!wrapperTemplate) return null;
      const y = world.getSurfaceHeight(x, z);
      if (!Number.isFinite(y)) return null;
      if (world.waterAt(x, y + 0.8, z) > 0) return null;
      const w = new Wrapper(world, x, z, wrapperTemplate);
      if (biomeAt(x, z) === B.WASTELAND) {
        w.waste = true;
        w.speedWalk *= WRAPPER.wasteSpeed;
        w.speedRun *= WRAPPER.wasteSpeed;
      }
      wrappers.push(w);
      return w;
    }

    function updateWrapperSpawns(dt) {
      if (!wrapperTemplate) return;
      wrapperSpawnT -= dt;
      if (wrapperSpawnT > 0) return;
      const inWaste = biomeAt(player.pos.x, player.pos.z) === B.WASTELAND;
      wrapperSpawnT = inWaste ? WRAPPER_SPAWN.wasteRoll : WRAPPER_SPAWN.nightRoll;
      if (!inWaste && isDay()) return;
      const cap = inWaste ? WRAPPER_SPAWN.wasteCap : WRAPPER_SPAWN.nightCap;
      if (wrappers.length >= cap) return;

      for (let t = 0; t < 10; t++) {
        const a = Math.random() * Math.PI * 2;
        const [r0, r1] = WRAPPER_SPAWN.radius;
        const d = r0 + Math.random() * (r1 - r0);
        const x = player.pos.x + Math.cos(a) * d;
        const z = player.pos.z + Math.sin(a) * d;
        const b = biomeAt(x, z);
        if (inWaste ? b !== B.WASTELAND : b === B.WASTELAND) continue;
        if (!inWaste && Math.random() > WRAPPER_SPAWN.nightChance) continue;
        if (spawnWrapper(x, z)) return;
      }
    }





    const chickens = [];
    const CHICKEN_SPAWN = {
      radius: [30, 55],
      cap: 8,
      roll: 25,
      chance: 0.2,
      cluster: [3, 4],
      spread: 3.5,
    };
    let chickenSpawnT = 18;

    function spawnChicken(x, z) {
      if (!chickenTemplate) return null;
      const y = world.getSurfaceHeight(x, z, 90);
      if (!Number.isFinite(y)) return null;
      if (world.waterAt(x, y + 0.3, z) > 0) return null;
      if (biomeAt(x, z) !== B.PLAINS) return null;
      const c = new Chicken(world, x, z, chickenTemplate);
      chickens.push(c);
      return c;
    }

    function spawnChickenCluster(cx, cz) {
      const [n0, n1] = CHICKEN_SPAWN.cluster;
      const want = n0 + Math.floor(Math.random() * (n1 - n0 + 1));
      let made = 0;
      for (let i = 0; i < want; i++) {
        if (chickens.length >= CHICKEN_SPAWN.cap) break;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * CHICKEN_SPAWN.spread;
        if (spawnChicken(cx + Math.cos(a) * d, cz + Math.sin(a) * d)) made++;
      }
      return made;
    }

    function updateChickenSpawns(dt) {
      if (!chickenTemplate) return;
      chickenSpawnT -= dt;
      if (chickenSpawnT > 0) return;
      chickenSpawnT = CHICKEN_SPAWN.roll;
      if (chickens.length >= CHICKEN_SPAWN.cap) return;
      if (Math.random() > CHICKEN_SPAWN.chance) return;

      for (let t = 0; t < 10; t++) {
        const a = Math.random() * Math.PI * 2;
        const [r0, r1] = CHICKEN_SPAWN.radius;
        const d = r0 + Math.random() * (r1 - r0);
        const x = player.pos.x + Math.cos(a) * d;
        const z = player.pos.z + Math.sin(a) * d;
        if (biomeAt(x, z) !== B.PLAINS) continue;
        if (spawnChickenCluster(x, z) > 0) return;
      }
    }





    const hudEl = document.getElementById('hud');
    const barFill = document.getElementById('barFill');
    const deathBanner = document.getElementById('deathBanner');
    const sleepOverlay = document.getElementById('sleepOverlay');
    let sleep = null;
    let drive = null;

    function startDrive(inst) {
      if (drive || sleep || !inst || !locked || replayPlay || deathT > 0) return;
      if (invOpen || cmdOpen || mapSystem?.isOpen() || recipeOpen || visibleTree() || workbenchUI.opened || skylineSystem?.isOpen() || achieveOpen) return;
      drive = {
        inst,
        speed: 0,
        straightT: 0,
        turnAcc: 0,
        turnSnap: 0,
        heading: inst.rot || 0,
        walk: 0,
        bob: 0,
        bobVel: 0,
        stepKick: 0,
        camRoll: 0,
        camPitch: 0,
        camYaw: 0,
        fuelBuf: 0,
        noFuelT: 0,
        stepWalk: 0,
      };
      inst._drive = drive;
      if (inst._baseYOff == null) inst._baseYOff = inst.mesh.position.y - inst.y;
      inst.mesh.visible = false;
      player.vel.set(0, 0, 0);
      mining = false;
      resetHoldPlace?.();
      notice('RAMMER ONLINE · E TO EXIT');
    }

    function stopDrive(exitMsg = 'DISMOUNTED') {
      if (!drive) return;
      const inst = drive.inst;
      if (inst) {
        inst._drive = null;
        if (inst.mesh) {
          inst.mesh.visible = true;

          const legNames = ['front left', 'front right', 'back left', 'back right'];
          const legs = legNames.map((n) => inst.mesh.getObjectByName(n)).filter(Boolean);
          for (const leg of legs) {
            leg.rotation.x = 0;
            if (leg.userData.baseY != null) leg.position.y = leg.userData.baseY;
          }
          inst.mesh.rotation.set(0, drive.heading, 0);
          inst.mesh.position.set(inst.x, inst.y + (inst._baseYOff ?? 0), inst.z);
          inst.mesh.updateMatrixWorld(true);
          if (legs.length >= 4) {
            const wp = new THREE.Vector3();
            const pts = legs.map((leg) => { leg.getWorldPosition(wp); return { x: wp.x, y: wp.y, z: wp.z }; });
            const grounds = pts.map((p) => {
              const g = world.getSurfaceHeight(p.x, p.z, inst.y + 8);
              return Number.isFinite(g) ? g : inst.y;
            });
            const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
            const frontG = avg([grounds[0], grounds[1]]), backG = avg([grounds[2], grounds[3]]);
            const leftG = avg([grounds[0], grounds[2]]), rightG = avg([grounds[1], grounds[3]]);
            const frontZ = avg([pts[0].z, pts[1].z]), backZ = avg([pts[2].z, pts[3].z]);
            const leftX = avg([pts[0].x, pts[2].x]), rightX = avg([pts[1].x, pts[3].x]);
            const spanZ = Math.max(0.5, Math.abs(frontZ - backZ));
            const spanX = Math.max(0.5, Math.abs(rightX - leftX));
            const pitch = -Math.atan2(backG - frontG, spanZ);
            const roll = Math.atan2(rightG - leftG, spanX);
            inst.mesh.rotation.set(pitch, drive.heading, roll);
            inst.mesh.updateMatrixWorld(true);

            let minDelta = Infinity;
            for (let i = 0; i < pts.length; i++) {
              legs[i].getWorldPosition(wp);
              minDelta = Math.min(minDelta, grounds[i] - wp.y);
            }
            if (Number.isFinite(minDelta)) inst.mesh.position.y += minDelta;
            inst.y = inst.mesh.position.y - (inst._baseYOff ?? 0);
            inst.top = inst.y + inst.def.height * 1.45;
            if (inst.machine) inst.machine.y = inst.y + (inst.def.height * 1.45) / 2;
          }

          inst.mesh.updateMatrixWorld(true);
          const _rb = new THREE.Box3().setFromObject(inst.mesh);
          const _rg = world.getSurfaceHeight(inst.x, inst.z, inst.y + 8);
          if (Number.isFinite(_rg) && _rb.min.y > _rg + 0.03) {
            const drop = _rb.min.y - _rg;
            inst.mesh.position.y -= drop;
            inst.y = inst.mesh.position.y - (inst._baseYOff ?? 0);
            inst.top = inst.y + inst.def.height * 1.45;
            if (inst.machine) inst.machine.y = inst.y + (inst.def.height * 1.45) / 2;
          }
        }
      }

      const side = drive.heading + Math.PI / 2;
      const px = inst ? inst.x + Math.cos(side) * 2.8 : player.pos.x;
      const pz = inst ? inst.z + Math.sin(side) * 2.8 : player.pos.z;
      const py = world.getSurfaceHeight(px, pz, (inst ? inst.y : player.pos.y) + 6);
      player.pos.set(px, Number.isFinite(py) ? py : (inst ? inst.y : player.pos.y), pz);
      player.vel.set(0, 0, 0);
      player.onGround = false;
      drive = null;
      postMat.uniforms.uDriveRed.value = 0;
      notice(exitMsg);
    }

    function updateDrive(dt) {
      if (!drive) return;
      const inst = drive.inst;
      if (!inst || !inst.mesh || !inst.mesh.parent) { stopDrive('RAMMER LOST'); return; }

      if (keys.KeyE || keys.Escape) { keys.KeyE = false; keys.Escape = false; stopDrive(); return; }

      const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
      const turnInput = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);


      const RAMMER_FUEL = { carbon: 12, heavy_fuel_oil: 576 };
      const rammerFuelValue = (s) => {
        if (!s) return 0;
        if (s.id === 'carbon') return RAMMER_FUEL.carbon * (s.n || 0);
        if (s.id === 'heavy_fuel_oil') return RAMMER_FUEL.heavy_fuel_oil * (s.n || 0);
        if (s.liquid?.id === 'gasoline') return 18 * (s.liquid.amount || 0);
        return 0;
      };
      const rammerSlots = () => inst.state?.slots || {};
      const rammerHasFuel = () => { const sl = rammerSlots(); for (let i = 0; i < 5; i++) if (rammerFuelValue(sl[`fuel${i}`]) > 0.01) return true; return false; };
      const rammerPullFuel = () => {
        const sl = rammerSlots();
        for (let i = 0; i < 5; i++) {
          const k = `fuel${i}`; const s = sl[k]; if (!s) continue;
          if (s.id === 'carbon') { s.n--; if (s.n <= 0) delete sl[k]; drive.fuelBuf += RAMMER_FUEL.carbon; return true; }
          if (s.id === 'heavy_fuel_oil') { s.n--; if (s.n <= 0) delete sl[k]; drive.fuelBuf += RAMMER_FUEL.heavy_fuel_oil; return true; }
          if (s.liquid?.id === 'gasoline' && (s.liquid.amount || 0) > 0.001) {
            const take = Math.min(1, s.liquid.amount);
            s.liquid.amount -= take; if (s.liquid.amount <= 0.001) delete s.liquid;
            drive.fuelBuf += take * 18; return true;
          }
        }
        return false;
      };
      const rammerBurn = (amt) => {
        let left = amt;
        while (left > 0.001) {
          if (drive.fuelBuf >= left) { drive.fuelBuf -= left; left = 0; break; }
          left -= drive.fuelBuf; drive.fuelBuf = 0;
          if (!rammerPullFuel()) break;
        }
        return amt - left;
      };
      const hasFuel = (drive.fuelBuf > 0.01) || rammerHasFuel();
      const fwd = hasFuel ? forward : 0;
      if (!hasFuel && forward !== 0) { drive.noFuelT -= dt; if (drive.noFuelT <= 0) { notice('NO FUEL · PRESS TAB'); drive.noFuelT = 2; } } else drive.noFuelT = 0;


      const boosting = (keys.ShiftLeft || keys.ShiftRight) && hasFuel && fwd > 0;
      const boostMul = boosting ? 2 : 1;
      const maxFwd = 28.8 * boostMul;
      const maxBack = 4.5;
      const accel = 2.2 * (boosting ? 2 : 1);
      const brake = 3.5;
      const coast = 1.2;
      const turnRate = 0.55;


      if (fwd > 0 && Math.abs(turnInput) < 0.01 && Math.abs(drive.turnAcc) < 0.01) {
        drive.straightT += dt;
      } else {
        drive.straightT = Math.max(0, drive.straightT - dt * 1.5);
      }
      const ramp = Math.min(1, drive.straightT / 6);
      const targetMax = 7.2 * boostMul + (maxFwd - 7.2 * boostMul) * ramp;

      if (fwd > 0) {
        const cap = targetMax;
        if (drive.speed < cap) drive.speed = Math.min(cap, drive.speed + accel * dt);
        else drive.speed = Math.max(cap, drive.speed - coast * dt);
      } else if (fwd < 0) {
        const cap = -maxBack;
        if (drive.speed > cap) drive.speed = Math.max(cap, drive.speed - accel * 0.7 * dt);
      } else {

        const decel = hasFuel ? coast : brake;
        if (drive.speed > 0) drive.speed = Math.max(0, drive.speed - decel * dt);
        else if (drive.speed < 0) drive.speed = Math.min(0, drive.speed + decel * dt);
      }


      const burn = (Math.abs(drive.speed) / maxFwd * 6 + (Math.abs(turnInput) > 0.01 ? 0.5 : 0) + (fwd !== 0 ? 0.4 : 0)) * dt * boostMul;
      if (burn > 0.001 && (Math.abs(drive.speed) > 0.05 || fwd !== 0 || Math.abs(turnInput) > 0.01)) rammerBurn(burn);
      if (drive.fuelBuf <= 0.01 && !rammerHasFuel() && Math.abs(drive.speed) < 0.1) drive.speed = 0;
      const fuelLeft = drive.fuelBuf + [0,1,2,3,4].reduce((a,i)=>a+rammerFuelValue(rammerSlots()[`fuel${i}`]),0);
      inst.state.status = fuelLeft > 0.01 ? `FUEL ${Math.ceil(fuelLeft)}` : 'NO FUEL';


      const step = THREE.MathUtils.degToRad(4);
      const turnDelta = turnInput * turnRate * dt;
      drive.turnAcc += turnDelta;

      while (drive.turnAcc >= step) { drive.heading += step; drive.turnAcc -= step; drive.stepKick = 1; }
      while (drive.turnAcc <= -step) { drive.heading -= step; drive.turnAcc += step; drive.stepKick = 1; }



      drive.turnSnap += (drive.heading - drive.turnSnap) * (1 - Math.exp(-dt * 18));


      const spd = drive.speed;
      const mx = -Math.sin(drive.heading) * spd * dt;
      const mz = -Math.cos(drive.heading) * spd * dt;
      let nx = inst.x + mx;
      let nz = inst.z + mz;
      let ny = world.getSurfaceHeight(nx, nz, inst.y + 8);
      if (!Number.isFinite(ny)) ny = inst.y;

      const climb = ny - inst.y;
      const blocked = (world.field && world.field.sample(nx, ny + 1.2, nz) > 0) || climb > 1.4;
      if (blocked) {
        drive.speed *= 0.3;
        nx = inst.x; nz = inst.z; ny = inst.y;
      } else {
        inst.x = nx; inst.z = nz; inst.y = ny; inst.top = ny + inst.def.height * 1.45;
      }
      inst.rot = drive.heading;
      inst.mesh.position.set(inst.x, inst.y + (inst._baseYOff ?? 0), inst.z);
      inst.mesh.rotation.y = drive.heading;
      if (inst.machine) { inst.machine.x = inst.x; inst.machine.y = inst.y + (inst.def.height * 1.45) / 2; inst.machine.z = inst.z; }


      if (Math.abs(spd) > 0.5) {
        const _hitTrees = [];
        for (const pl of _vegActive.canopy.values()) {
          if (!pl || !pl.sp || !pl.sp.trunk) continue;
          const dx = pl.x - inst.x, dz = pl.z - inst.z;
          if (dx * dx + dz * dz > 3.5 * 3.5) continue;
          _hitTrees.push(pl);
        }
        for (const pl of _hitTrees) {
          if (!_vegActive.canopy.has(`${pl.gx},${pl.gz}`)) continue;
          chopTree({
            pl, sp: pl.sp, dyn: null, parts: pl.sp.parts,
            pos: new THREE.Vector3(pl.x, pl.y, pl.z),
            quat: pl.q.clone(), scale: pl.scale, topY: 1, trunkR: pl.sp.trunkR, cutLocalY: 0.18,
          }, 1);
        }
      }


      const moving = Math.abs(spd) > 0.2;
      const walkRate = 1.2 + Math.min(1.8, Math.abs(spd) / 8);
      if (moving) {
        const prevStep = Math.floor(drive.stepWalk || 0);
        drive.walk += dt * walkRate;
        drive.stepWalk = (drive.stepWalk || 0) + dt * walkRate * 4;
        const nowStep = Math.floor(drive.stepWalk);
        for (let s = prevStep + 1; s <= nowStep; s++) {
          const pan = ((s % 4) - 1.5) / 1.5 * 0.35;
          footsteps.step(footstepCategory(), 0.45 * masterVolume * 0.7, 0.34 + Math.random() * 0.05, pan, 420);
        }
      }
      drive.stepKick = Math.max(0, drive.stepKick - dt * 3);
      const stepBob = moving ? Math.sin(drive.walk * Math.PI * 2) * 0.18 : 0;
      const stepRoll = moving ? Math.sin(drive.walk * Math.PI * 2 + Math.PI / 2) * 0.015 : 0;
      drive.bob += (stepBob - drive.bob) * Math.min(1, dt * 4);


      const legNames = ['front left', 'front right', 'back left', 'back right'];
      const mesh = inst.mesh;
      if (mesh) {
        for (let i = 0; i < legNames.length; i++) {
          const obj = mesh.getObjectByName(legNames[i]);
          if (!obj) continue;
          const phase = drive.walk * Math.PI * 2 + (i === 1 || i === 2 ? Math.PI : 0);
          const swing = moving ? Math.sin(phase) * 0.35 : 0;
          const lift = moving ? Math.max(0, Math.cos(phase)) * 0.25 : 0;
          obj.rotation.x = swing;
          obj.position.y = (obj.userData.baseY ?? (obj.userData.baseY = obj.position.y)) + lift * 0.15;
        }
      }


      const camBaseY = inst.y + 1.7;
      const bobY = drive.bob + drive.stepKick * 0.08;
      camY = camY === null ? camBaseY : camY + (camBaseY + bobY - camY) * Math.min(1, dt * 5);
      camera.position.set(inst.x, camY, inst.z);


      const sample = 2.2;
      const hL = world.getSurfaceHeight(inst.x + Math.cos(drive.heading) * sample, inst.z - Math.sin(drive.heading) * sample, inst.y + 6);
      const hR = world.getSurfaceHeight(inst.x - Math.cos(drive.heading) * sample, inst.z + Math.sin(drive.heading) * sample, inst.y + 6);
      const fx = -Math.sin(drive.heading), fz = -Math.cos(drive.heading);
      const rx = Math.cos(drive.heading), rz = -Math.sin(drive.heading);
      const hF = world.getSurfaceHeight(inst.x + fx * sample, inst.z + fz * sample, inst.y + 6);
      const hB = world.getSurfaceHeight(inst.x - fx * sample, inst.z - fz * sample, inst.y + 6);
      const hFR = world.getSurfaceHeight(inst.x + (fx + rx) * sample, inst.z + (fz + rz) * sample, inst.y + 6);
      const hFL = world.getSurfaceHeight(inst.x + (fx - rx) * sample, inst.z + (fz - rz) * sample, inst.y + 6);
      const rollTarget = THREE.MathUtils.clamp(Math.atan2((Number.isFinite(hR)?hR:inst.y) - (Number.isFinite(hL)?hL:inst.y), sample * 2) * 2.2, -0.7, 0.7);
      const pitchTarget = -Math.atan2((Number.isFinite(hB)?hB:inst.y) - (Number.isFinite(hF)?hF:inst.y), sample * 2) * 0.4;
      const yawTarget = Math.atan2((Number.isFinite(hFR)?hFR:inst.y) - (Number.isFinite(hFL)?hFL:inst.y), sample * 2) * 0.2;
      drive.camRoll += (rollTarget - drive.camRoll) * (1 - Math.exp(-dt * 6));
      drive.camPitch += (pitchTarget - drive.camPitch) * (1 - Math.exp(-dt * 4));
      drive.camYaw += (yawTarget - drive.camYaw) * (1 - Math.exp(-dt * 4));
      camera.rotation.order = 'YXZ';
      camera.rotation.y = drive.turnSnap + drive.camYaw;
      camera.rotation.x = drive.camPitch;
      camera.rotation.z = drive.camRoll + stepRoll;

      player.pos.set(inst.x, inst.y, inst.z);
      player.vel.set(0, 0, 0);
      postMat.uniforms.uDriveRed.value = 1;
    }

    function startSleep(inst) {
      if (sleep || !inst || !locked || replayPlay || deathT > 0) return;
      if (invOpen || cmdOpen || mapSystem?.isOpen() || recipeOpen || visibleTree() || workbenchUI.opened || skylineSystem?.isOpen() || achieveOpen) return;
      const wakeDay = clock.day + 1;
      const late = Math.random() < 0.35 ? (60 + Math.random() * 180) : (Math.random() * 20);
      const targetT = Math.min(TUNING.DAY_SECONDS - 1, late);
      const remaining = (TUNING.DAY_SECONDS - clock.t) + (wakeDay - clock.day - 1) * TUNING.DAY_SECONDS + targetT;
      sleep = {
        phase: 'down', t: 0, fadeDown: 1.2, fadeUp: 0.9,
        remaining, targetDay: wakeDay, targetT,
        inst, px: player.pos.x, py: player.pos.y, pz: player.pos.z,
        yaw: player.yaw, pitch: player.pitch, eye: eyeCur,
      };
      player.vel.set(0, 0, 0);
      mining = false;
      resetHoldPlace?.();
      if (inst) {
        player.pos.x = inst.x;
        player.pos.z = inst.z;
        player.pos.y = (inst.top || (inst.y + 1.0)) + 0.15;
        player.yaw = inst.rot || player.yaw;
        player.pitch = -(Math.PI / 2 - 0.02);
      }
      if (sleepOverlay) { sleepOverlay.style.transition = 'none'; sleepOverlay.style.opacity = '0'; }
      notice('SLEEPING...');
    }

    function updateSleep(dt) {
      if (!sleep) return;
      if (sleep.phase === 'down') {
        sleep.t += dt;
        const a = Math.min(1, sleep.t / sleep.fadeDown);
        if (sleepOverlay) sleepOverlay.style.opacity = String(a);
        player.vel.set(0, 0, 0);
        if (sleep.inst) { player.pos.x = sleep.inst.x; player.pos.z = sleep.inst.z; player.pitch = -(Math.PI / 2 - 0.02); }
        if (a >= 1) { sleep.phase = 'sleep'; sleep.t = 0; }
        return;
      }
      if (sleep.phase === 'sleep') {
        const step = 0.05;
        const budget = 8;
        let sim = Math.min(sleep.remaining, budget);
        while (sim > 1e-4) {
          const sdt = Math.min(step, sim);
          advanceSleepTime(sdt);
          if (!sleep) return;
          sleep.remaining -= sdt;
          sim -= sdt;
          if (sleep.remaining <= 1e-4) break;
        }
        if (!sleep) return;
        player.vel.set(0, 0, 0);
        if (sleep.inst) { player.pos.x = sleep.inst.x; player.pos.z = sleep.inst.z; player.pitch = -(Math.PI / 2 - 0.02); }
        if (sleep.remaining <= 1e-4) {
          clock.day = sleep.targetDay;
          clock.t = sleep.targetT;
          updateDaylight();
          sleep.phase = 'up'; sleep.t = 0;
          if (sleepOverlay) sleepOverlay.style.opacity = '1';
        }
        return;
      }
      if (sleep.phase === 'up') {
        sleep.t += dt;
        const a = Math.max(0, 1 - sleep.t / sleep.fadeUp);
        if (sleepOverlay) sleepOverlay.style.opacity = String(a);
        player.vel.set(0, 0, 0);
        const k = Math.min(1, sleep.t / sleep.fadeUp);
        if (sleep.inst) { player.pos.x = sleep.inst.x; player.pos.z = sleep.inst.z; player.pos.y = (sleep.inst.top || (sleep.inst.y + 1.0)) + 0.15; }
        player.pitch = (-(Math.PI / 2 - 0.02)) * (1 - k) + sleep.pitch * k;
        if (a <= 0) {
          if (sleepOverlay) sleepOverlay.style.opacity = '0';
          player.pos.x = sleep.px; player.pos.y = sleep.py; player.pos.z = sleep.pz;
          player.yaw = sleep.yaw; player.pitch = sleep.pitch;
          sleep = null;
          notice('WOKE UP');
        }
      }
    }

    function advanceSleepTime(dt) {
      if (timeLock === null) {
        clock.t += dt;
        if (clock.t >= TUNING.DAY_SECONDS) { clock.t -= TUNING.DAY_SECONDS; clock.day++; maybeNuclearStrike(); }
      } else {
        clock.t = timeLock;
      }
      playTime += dt;
      updateDaylight();
      if (armorShieldTimer > 0) armorShieldTimer = Math.max(0, armorShieldTimer - dt);
      if (radIntakeTimer > 0) radIntakeTimer = Math.max(0, radIntakeTimer - dt);
      if (smokeTime > 0) smokeTime = Math.max(0, smokeTime - dt);
      machineSystem?.update(dt);
      skylineSystem?.update(dt);
      if (machineSystem) for (const c of machineSystem.cleaners) inv.dose = Math.max(0, inv.dose - 8 * dt);
      updateVitals(dt);
      if (!sleep) return;
      updateGuide(dt);
      updateAchievements(dt);
      const radRate = doseRate();
      if (radRate <= 0.01) radFreeT += dt; else radFreeT = 0;
      if (radFreeT >= TUNING.RAD_CALM_DELAY) inv.dose = Math.max(0, inv.dose - TUNING.RAD_DECAY * dt);
      inv.dose += radRate * dt;
      if (inv.dose >= TUNING.RAD_LETHAL_DOSE && !replayPlay) { die(); return; }
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (noticeT > 0) noticeT = Math.max(0, noticeT - dt);
      updateDrops(dt, performance.now());
      updateWrapperSpawns(dt);
      updateChickenSpawns(dt);
      for (let i = walkers.length - 1; i >= 0; i--) { const w = walkers[i]; w.update(dt, player.pos); w.hitCd = Math.max(0, (w.hitCd || 0) - dt); if (w.pos.distanceTo(player.pos) > 90) { w.dispose(); walkers.splice(i, 1); } }
      for (let i = wrappers.length - 1; i >= 0; i--) { const w = wrappers[i]; w.update(dt, player.pos); w.hitCd = Math.max(0, (w.hitCd || 0) - dt); if (w.dead || w.pos.distanceTo(player.pos) > WRAPPER.despawn) { if (!w.dead) w.dispose(); wrappers.splice(i, 1); } }
      for (let i = chickens.length - 1; i >= 0; i--) { const c = chickens[i]; c.update(dt, player.pos); if (c.dead || c.pos.distanceTo(player.pos) > CHICKEN.despawn) { c.dispose(); chickens.splice(i, 1); } }
      pumpDeathSpill();
      workbenchUI.update(dt);
    }

    let fpsSmooth = 60;
    let hudTimer = 0;

    let hungerSmile = null;
    let hungerSmileTex = null;
    let smileStare = 0;
    let smileDash = null;
    let smileDoneNight = false;

    function removeHungerSmile() {
      if (!hungerSmile) return;
      scene.remove(hungerSmile);
      hungerSmile.geometry.dispose();
      hungerSmile.material.dispose();
      hungerSmile = null;
      smileStare = 0;
      smileDash = null;
    }

    function spawnHungerSmile() {
      if (hungerSmile) {
        hungerSmile.lookAt(camera.position);
        return hungerSmile;
      }
      if (!hungerSmileTex) hungerSmileTex = new THREE.TextureLoader().load('assets/images/smile.webp');
      const mat = new THREE.MeshBasicMaterial({
        map: hungerSmileTex, transparent: true, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false,
      });
      hungerSmile = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), mat);
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      hungerSmile.position.copy(camera.position).addScaledVector(dir, 10);
      const groundY = (typeof world !== 'undefined' && world.getSurfaceHeight)
        ? world.getSurfaceHeight(hungerSmile.position.x, hungerSmile.position.z, 160)
        : camera.position.y;
      hungerSmile.position.y = Math.max(camera.position.y + 6, groundY + 18);
      hungerSmile.lookAt(camera.position);
      smileStare = 0;
      smileDash = null;
      scene.add(hungerSmile);
      return hungerSmile;
    }

    function updateHungerSmile(dt) {
      const nightHungry = !isDay() && vitals.hunger < 50;
      if (nightHungry) addWound('paranoia');
      else if (vitals.wounds.paranoia !== undefined) delete vitals.wounds.paranoia;

      if (isDay()) {
        removeHungerSmile();
        smileDoneNight = false;
        return;
      }

      if (!hungerSmile) {
        if (nightHungry && !smileDoneNight) spawnHungerSmile();
        return;
      }

      hungerSmile.lookAt(camera.position);

      if (smileDash) {
        smileDash.t += dt;
        const p = Math.min(1, smileDash.t / smileDash.dur);
        hungerSmile.position.lerpVectors(smileDash.from, smileDash.to, p);
        hungerSmile.lookAt(camera.position);
        if (p >= 1) {
          removeHungerSmile();
          smileDoneNight = true;
        }
        return;
      }

      const to = hungerSmile.position.clone().sub(camera.position);
      const dist = to.length() || 1;
      to.divideScalar(dist);
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      const staring = fwd.dot(to) > Math.cos(THREE.MathUtils.degToRad(12));
      smileStare = staring ? smileStare + dt : 0;

      if (smileStare >= 6) {
        const dir = camera.position.clone().sub(hungerSmile.position).normalize();
        smileDash = {
          from: hungerSmile.position.clone(),
          to: camera.position.clone().addScaledVector(dir, 6),
          t: 0,
          dur: 0.25,
        };
      }
    }

    function updateHud(dt) {
      updateHungerSmile(dt);
      hudTimer += dt;
      if (hudTimer < 0.15) return;
      hudTimer = 0;

      if (!showInfoHud) {
        hudEl.innerHTML = noticeT > 0 ? `<b>${noticeMsg}</b>` : '';
        vegPerf.stream = vegPerf.inst = vegPerf.trunks = vegPerf.collide = vegPerf.anim = 0;
        vegPerf.frames = 0;
        for (const k of Object.keys(perf)) perf[k] = 0;
        paintRad();
        paintVitals();
        if (deathBanner) deathBanner.style.opacity = deathT > 0 ? Math.min(1, deathT) : 0;
        return;
      }

      const p = player.pos;
      const solidHere = world.field.sample(p.x, p.y + 1, p.z) > 0;


      const vf = Math.max(1, vegPerf.frames);
      const vegMs = vegPerf.anim / vf;
      const sections = {
        veg: vegMs, move: perf.move / vf, jobs: perf.jobs / vf, drops: perf.drops / vf,
        world: perf.world / vf, water: perf.water / vf, dirty: perf.dirty / vf, wdirty: perf.wdirty / vf,
        ent: perf.entities / vf, render: perf.render / vf, misc: perf.misc / vf,
      };
      const frameMs = Object.values(sections).reduce((s, v) => s + v, 0);
      const frameBreak = Object.entries(sections).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(([n, ms], i) => (i === 0 ? '<b>' : '') + n + ' ' + ms.toFixed(2) + (i === 0 ? '</b>' : '')).join(' · ');
      const vegOther = Math.max(0, vegPerf.anim - vegPerf.stream - vegPerf.inst - vegPerf.trunks - vegPerf.collide);
      const vegBreak = [['stream', vegPerf.stream], ['inst', vegPerf.inst], ['trunk', vegPerf.trunks], ['hit', vegPerf.collide], ['anim', vegOther]]
        .map(([n, ms]) => [n, ms / vf]).sort((a, b) => b[1] - a[1])
        .map(([n, ms], i) => (i === 0 ? '<b>' : '') + n + ' ' + ms.toFixed(2) + (i === 0 ? '</b>' : '')).join(' · ');

      hudEl.innerHTML =
        `<b>${fpsSmooth.toFixed(0)} fps</b> &nbsp; chunks: <b>${world.chunks.size}</b> ` +
        `(${world.dirty.length + world.loading.length} queued, ${world.waterDirty.length}w)<br>` +
        `<span class="k">day</span> <b>${clock.day}</b> ${isDay() ? '(day)' : '(night)'} ` +
        `<span class="k">dose</span> ${formatRad(inv.dose)} <span class="k">rate</span> ${formatRadRate(doseRate())} ` +
        `<span class="k">stage</span> ${radStage().name} ` +
        `<span class="k">hp</span> ${vitals.hp.toFixed(0)} <span class="k">food</span> ${vitals.hunger.toFixed(0)} ` +
        `<span class="k">wounds</span> ${Object.keys(vitals.wounds).join(',') || '--'}<br>` +
        `<span class="k">machines</span> ${machineSystem ? machineSystem.instances.length : 0}` +
        `${machineSystem && machineSystem.instances.some((m) => m.def.kind === 'reactor') ? ` <span class="k">reactors</span> ${machineSystem.instances.filter((m) => m.def.kind === 'reactor').length}` : ''}` +
        `${machineSystem && machineSystem.ambientCut && machineSystem.ambientCut() > 0 ? ` <span class="k">scrub</span> ${Math.round(machineSystem.ambientCut() * 100)}%` : ''}<br>` +
        `<span class="k">pos</span> ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}<br>` +
        `<span class="k">chunk</span> ${Math.floor(p.x / CHUNK_SIZE)}, ` +
        `${Math.floor(p.y / CHUNK_SIZE)}, ${Math.floor(p.z / CHUNK_SIZE)}<br>` +
        `<span class="k">held</span> ${(inv.hot[inv.sel] && ITEMS[inv.hot[inv.sel].id].code) || '--'} &nbsp; ` +
        `<span class="k">edits</span> ${world.field.edits.size}<br>` +
        `<span class="k">ground</span> ${player.onGround ? (sliding ? 'SLIDE' : 'yes') : (slideQueued ? 'QUEUED' : 'no')} ` +
        `<span class="k">spd</span> ${Math.hypot(player.vel.x, player.vel.z).toFixed(1)}<br>` +
        `<span class="k">inside</span> ${solidHere ? 'SOLID' : 'air'}<br>` +
        `<span class="k">biome</span> ${BIOME_DEFS[biomeAt(p.x, p.z)].name} ` +
        `<span class="k">O2</span> ${(player.oxygen * 100).toFixed(0)}%<br>` +
        `<span class="k">water</span> ${world.waterAt(p.x, p.y + player.eye, p.z).toFixed(1)}m ` +
        `${uwT > 0.5 ? '<b>SUBMERGED (E to drink)</b>' : (drinkT > 0 ? '<b>DRANK</b>' : '')}` +
        `${noticeT > 0 ? ` <b>${noticeMsg}</b>` : ''}<br>` +
        `<span class="k">walkers</span> ${walkers.length} ` +
        `<span class="k">veg</span> ${vegCount()} ` +
        `<span class="k">res</span> ${Math.round(100 / PIXEL)}% <span class="k">col</span> ${COLOR_LEVELS} ` +
        `<span class="k">view</span> ${viewRadius} <span class="k">torch</span> ${torches.length}<br>` +
        `<span class="k">far</span> <span class="copy" title="press I to copy">${farTerrain.meshes.length} rings · ${(farTerrain.outer / 1000).toFixed(0)}km out · cfar ${(camera.far / 1000).toFixed(0)}km · fog ${(scene.fog.far / 1000).toFixed(0)}km · fogN ${scene.fog.near.toFixed(0)}m</span><br>` +
        `<span class="k">frame</span> <span class="copy" title="press I to copy">${frameMs.toFixed(2)}ms · ${frameBreak} · q ${world.dirty.length + world.loading.length} · qw ${world.waterDirty.length} · dc ${renderer.info.render.calls} · tri ${(renderer.info.render.triangles / 1000).toFixed(0)}k</span><br>` +
        `<span class="k">veg ms</span> <span class="copy">${vegMs.toFixed(2)} · ${vegBreak} · ${vegCount()} inst · ${trunkColliders.length} hit</span>`;


      const target = world.chunks.size;
      const built = target - world.dirty.length - world.loading.length;
      barFill.style.width = target > 0 ? `${Math.min(100, (built / target) * 100)}%` : '0%';
      paintRad();
      paintVitals();
      if (deathBanner) deathBanner.style.opacity = deathT > 0 ? Math.min(1, deathT) : 0;

      vegPerf.stream = vegPerf.inst = vegPerf.trunks = vegPerf.collide = vegPerf.anim = 0;
      vegPerf.frames = 0;
      for (const k of Object.keys(perf)) perf[k] = 0;
    }





    function capturePanorama() {
      const S = 1024;
      const eye = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const faces = [
        { f: [1, 0, 0], u: [0, 1, 0] },
        { f: [-1, 0, 0], u: [0, 1, 0] },
        { f: [0, 1, 0], u: [0, 0, -1] },
        { f: [0, -1, 0], u: [0, 0, 1] },
        { f: [0, 0, 1], u: [0, 1, 0] },
        { f: [0, 0, -1], u: [0, 1, 0] },
      ];




      const cam = new THREE.PerspectiveCamera(90, 1, camera.near, Math.max(2000, camera.far));
      const rt = new THREE.WebGLRenderTarget(S, S, { depthBuffer: true });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
      const buf = new Uint8Array(S * S * 4);
      const pixels = [];

      for (const face of faces) {
        const [fx, fy, fz] = face.f;
        cam.position.copy(eye);
        cam.up.set(face.u[0], face.u[1], face.u[2]);
        cam.lookAt(eye.x + fx, eye.y + fy, eye.z + fz);
        cam.updateMatrixWorld();
        renderer.setRenderTarget(rt);
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);

        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const img = g.createImageData(S, S);
        for (let y = 0; y < S; y++) {
          const src = (S - 1 - y) * S * 4;
          img.data.set(buf.subarray(src, src + S * 4), y * S * 4);
        }
        g.putImageData(img, 0, 0);
        pixels.push(img.data);

        const fx2 = face.f, ux = face.u;
        const r = [fx2[1] * ux[2] - fx2[2] * ux[1], fx2[2] * ux[0] - fx2[0] * ux[2], fx2[0] * ux[1] - fx2[1] * ux[0]];
        face.r = r;
      }
      renderer.setRenderTarget(null);
      rt.dispose();

      const W = S * 2, H = S;
      const out = document.createElement('canvas');
      out.width = W; out.height = H;
      const ctx = out.getContext('2d');
      const dst = ctx.createImageData(W, H);
      const d = dst.data;

      for (let py = 0; py < H; py++) {
        const lat = Math.PI / 2 - ((py + 0.5) / H) * Math.PI;
        const cl = Math.cos(lat), sl = Math.sin(lat);
        for (let px = 0; px < W; px++) {
          const lon = ((px + 0.5) / W) * Math.PI * 2 - Math.PI;
          const dx = cl * Math.sin(lon), dy = sl, dz = cl * Math.cos(lon);

          let best = 0, bestDot = -2;
          for (let i = 0; i < 6; i++) {
            const f = faces[i].f;
            const dot = dx * f[0] + dy * f[1] + dz * f[2];
            if (dot > bestDot) { bestDot = dot; best = i; }
          }
          const face = faces[best], f = face.f, r = face.r, u = face.u;
          const denom = bestDot;
          const sx = (dx * r[0] + dy * r[1] + dz * r[2]) / denom;
          const sy = (dx * u[0] + dy * u[1] + dz * u[2]) / denom;
          const ix = Math.min(S - 1, Math.max(0, ((sx * 0.5 + 0.5) * S) | 0));
          const iy = Math.min(S - 1, Math.max(0, ((0.5 - sy * 0.5) * S) | 0));
          const si = (iy * S + ix) * 4;
          const di = (py * W + px) * 4;
          const src = pixels[best];
          d[di] = src[si]; d[di + 1] = src[si + 1]; d[di + 2] = src[si + 2]; d[di + 3] = 255;
        }
      }
      ctx.putImageData(dst, 0, 0);

      out.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nuclearism-panorama-day${clock.day}-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        notice('PANORAMA SAVED');
      });
    }





    let last = performance.now();
    let lastFrameAt = performance.now();
    let eyeCur = 1.62;
    let camY = null;
    let slidePitch = 0;
    let cameraRoll = 0;
    let cameraBob = 0;
    let landingOffset = 0;
    let landingVelocity = 0;
    let landingCooldown = 0;
    let uwT = 0;
    let drinkT = 0;
    let shakeT = 0;
    let deathT = 0;
    let waterSimTimer = 0;

    const lagSheet = { frames: [], events: [], lastRebuildN: 0, lastLoadN: 0, lastPerf: null };
    window.__lagSheet = lagSheet;








    const REPLAY_KEY = 'idte.replay.v1.';
    const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4];
    const replayEnabled = () => !!getSetting('replay');

    let replayRec = null;
    let replayRecT0 = 0;
    let replayRecT = 0;
    let replayPlay = null;
    let replayExport = null;
    let replayHeld = null;



    world.field.onEdit = (x, y, z, v) => {
      if (replayRec) pushEdit(replayRec, replayRecT, x, y, z, v);
    };

    function replayNow() { return replayRecT; }

    function startReplayRecording() {
      if (replayRec) return;
      replayRec = createReplay({
        name: `REPLAY ${new Date().toLocaleString()}`,
        world: MENU_WORLD?.id || '',
        seed: WORLD_SEED,
        day: clock.day,
      });
      replayRecT0 = performance.now();
      replayRecT = 0;
      notice('RECORDING STARTED');
    }

    async function stopReplayRecording() {
      if (!replayRec) return;
      const r = replayRec;
      replayRec = null;
      if (frameCount(r) < 2) { notice('RECORDING TOO SHORT'); return; }
      const packed = packReplay(r);
      const id = `${r.created}-${Math.floor(Math.random() * 1e6)}`;
      await idbSet(REPLAY_KEY + id, packed);
      notice('RECORDING SAVED');
      replayUI?.refresh();
    }

    async function listReplays() {
      const entries = await idbEntries(REPLAY_KEY);
      const out = [];
      for (const [key, val] of entries) {
        if (!val) continue;
        out.push({
          id: key.slice(REPLAY_KEY.length),
          name: val.name || 'REPLAY',
          created: val.created || 0,
          dur: val.dur || 0,
          size: replayBytes(val),
        });
      }
      out.sort((a, b) => b.created - a.created);
      return out;
    }



    function beginPlayback(r, opts = {}) {
      stopReplayRecording();
      const saved = new Map();
      for (let i = 0; i < editCount(r); i++) {
        const e = editAt(r, i);
        const k = DensityField.key(e.x, e.y, e.z);
        if (!saved.has(k)) saved.set(k, { v: world.field.edits.get(k), x: e.x, y: e.y, z: e.z });
      }
      replayPlay = {
        replay: r, t: 0, speed: 1, playing: true, editIdx: 0, saved,
        exporting: !!opts.exporting,
      };
      unlockPointer();
      setOverlay(false);
    }

    async function startReplayPlayback(id) {
      const packed = await idbGet(REPLAY_KEY + id);
      const r = packed && unpackReplay(packed);
      if (!r) { notice('REPLAY NOT FOUND'); return; }
      beginPlayback(r);
      notice('REPLAY PLAYBACK');
    }

    function applyReplayEdits(upto) {
      const p = replayPlay;
      if (!p) return;
      const idx = editIndexAt(p.replay, upto);
      while (p.editIdx < idx) {
        const e = editAt(p.replay, p.editIdx++);
        world.field.set(e.x, e.y, e.z, e.v);
        world.markEdited(e.x, e.x, e.y, e.y, e.z, e.z);
      }
    }



    function restoreReplayWorld() {
      const p = replayPlay;
      if (!p) return;
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (const [, s] of p.saved) {
        if (s.v === undefined) world.field.edits.delete(DensityField.key(s.x, s.y, s.z));
        else world.field.edits.set(DensityField.key(s.x, s.y, s.z), s.v);
        if (s.x < x0) x0 = s.x; if (s.x > x1) x1 = s.x;
        if (s.y < y0) y0 = s.y; if (s.y > y1) y1 = s.y;
        if (s.z < z0) z0 = s.z; if (s.z > z1) z1 = s.z;
      }
      if (x0 <= x1) world.markEdited(x0, x1, y0, y1, z0, z1);
    }

    function seekReplay(t) {
      const p = replayPlay;
      if (!p) return;
      restoreReplayWorld();
      p.t = Math.max(0, Math.min(p.replay.dur, t));
      p.editIdx = 0;
      applyReplayEdits(p.t);
    }

    function updateReplayPlayback(dt) {
      const p = replayPlay;
      if (!p) return;


      if (!p.exporting && p.playing) {
        p.t += dt * p.speed;
        if (p.t >= p.replay.dur) {
          p.t = p.replay.dur;
          endPlayback();
          notice('REPLAY ENDED');
          return;
        }
      }
      const s = sampleAt(p.replay, p.t);
      if (s) {
        player.pos.set(s.x, s.y, s.z);
        player.vel.set(0, 0, 0);
        player.yaw = s.yaw;
        player.pitch = s.pitch;


        eyeCur = s.eye ?? player.eye;
        slidePitch = s.slideP ?? 0;
        camY = s.y + eyeCur;
        cameraBob = 0;
        cameraRoll = 0;
        landingOffset = 0;
        landingVelocity = 0;
        const ct = s.clockT;
        if (Number.isFinite(ct) && ct >= 0) clock.t = ct % TUNING.DAY_SECONDS;
        const hid = heldId(p.replay, s.heldIdx);
        replayHeld = hid ? { id: hid } : null;
      }
      applyReplayEdits(p.t);
    }

    function endPlayback() {
      const p = replayPlay;
      if (!p) return;
      restoreReplayWorld();
      replayPlay = null;
      replayHeld = null;
      if (!replayExport) setOverlay(true);
    }

    function exitReplay() {
      if (!replayPlay) return;
      if (replayExport) { cancelReplayExport(); }
      endPlayback();
      notice('REPLAY ENDED');
    }



    function containRect(winW, winH, w, h) {
      const k = Math.min(winW / w, winH / h);
      const cw = Math.floor(w * k), ch = Math.floor(h * k);
      return { x: Math.floor((winW - cw) / 2), y: Math.floor((winH - ch) / 2), w: cw, h: ch };
    }

    function applyExportCanvasStyle(w, h) {
      const r = containRect(innerWidth, innerHeight, w, h);
      const el = renderer.domElement;
      el.style.position = 'absolute';
      el.style.left = `${r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    }

    function clearExportCanvasStyle() {
      const el = renderer.domElement;
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '100vw';
      el.style.height = '100vh';
    }

    async function exportReplayVideo(id, opts) {
      if (replayExport) return;
      const packed = await idbGet(REPLAY_KEY + id);
      const r = packed && unpackReplay(packed);
      if (!r) { notice('REPLAY NOT FOUND'); return; }
      if (typeof MediaRecorder === 'undefined') { notice('VIDEO EXPORT NOT SUPPORTED HERE'); return; }

      const w = opts.w || 1920, h = opts.h || 1080, fps = opts.fps || 30;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const c2d = canvas.getContext('2d');
      c2d.imageSmoothingEnabled = false;



      const stream = canvas.captureStream(fps);
      const track = stream.getVideoTracks()[0] || null;
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(80e6, Math.round(w * h * fps * 0.15)) });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise((res) => { rec.onstop = res; });
      rec.start(250);

      replayExport = { rec, track, canvas, c2d, w, h, chunks, done, mime, fps, step: 1 / fps, needsSim: true };
      exportRes = { w, h, pixels: opts.pixels !== false };
      applyPixelSize();
      applyExportCanvasStyle(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewCam.aspect = camera.aspect;
      viewCam.updateProjectionMatrix();
      beginPlayback(r, { exporting: true });
      notice(`EXPORTING ${w}x${h} @ ${fps}`);
    }

    function finishReplayExport() {
      const ex = replayExport;
      if (!ex) return;
      try { ex.rec.stop(); } catch { }
      ex.done.then(() => {
        const blob = new Blob(ex.chunks, { type: ex.mime });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nuclearism-replay-${Date.now()}.webm`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      replayExport = null;
      exportRes = null;
      applyPixelSize();
      clearExportCanvasStyle();
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      viewCam.aspect = camera.aspect;
      viewCam.updateProjectionMatrix();
      endPlayback();
      notice('EXPORT SAVED');
    }

    function cancelReplayExport() {
      const ex = replayExport;
      if (!ex) return;
      try { ex.rec.stop(); } catch { }
      replayExport = null;
      exportRes = null;
      applyPixelSize();
      clearExportCanvasStyle();
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      viewCam.aspect = camera.aspect;
      viewCam.updateProjectionMatrix();
    }

    function replayExportProgress() {
      if (!replayExport || !replayPlay) return 0;
      const dur = replayPlay.replay.dur || 1;
      return Math.max(0, Math.min(1, replayPlay.t / dur));
    }




    function settleWorldForExport(limitMs = 80) {
      const until = performance.now() + limitMs;
      while (performance.now() < until) {
        world.update(player.pos.x, player.pos.y, player.pos.z);
        farTerrain.update(player.pos.x, player.pos.z);
        if (world.dirty.length) world.processDirty(30);
        if (world.waterDirty.length) world.processWaterDirty(4);
        if (!world.dirty.length && !world.loading.length && !world.waterDirty.length) return true;
      }
      return !world.dirty.length && !world.loading.length && !world.waterDirty.length;
    }

    function replayViewInfo() {
      const p = replayPlay;
      if (p) {
        return `PLAYBACK ${p.t.toFixed(1)}s / ${p.replay.dur.toFixed(1)}s · ${p.speed}×`;
      }
      const x = player.pos.x, y = player.pos.y, z = player.pos.z;
      const dir = ((player.yaw * 180 / Math.PI) % 360 + 360) % 360;
      return `X ${x.toFixed(1)}  Y ${y.toFixed(1)}  Z ${z.toFixed(1)} · ${dir.toFixed(0)}° · DAY ${clock.day}`;
    }

    const replayUI = createReplayUI({
      state: () => ({
        recording: !!replayRec,
        recT: replayRec ? replayNow() : 0,
        playing: !!replayPlay,
        t: replayPlay ? replayPlay.t : 0,
        dur: replayPlay ? replayPlay.replay.dur : 0,
        speed: replayPlay ? replayPlay.speed : 1,
        exporting: !!replayExport,
        exportPct: replayExportProgress(),
      }),
      list: listReplays,
      startRecording: startReplayRecording,
      stopRecording: () => { void stopReplayRecording(); },
      play: (id) => { replayUI.hide(); void startReplayPlayback(id); },
      remove: async (id) => { await idbRemove(REPLAY_KEY + id); replayUI.refresh(); },
      exportVideo: (id, opts) => { replayUI.hide(); void exportReplayVideo(id, opts); },
      close: () => { replayUI.hide(); setOverlay(true); },
      togglePlay: () => { if (replayPlay) replayPlay.playing = !replayPlay.playing; },
      cycleSpeed: () => {
        if (!replayPlay) return;
        const i = REPLAY_SPEEDS.indexOf(replayPlay.speed);
        replayPlay.speed = REPLAY_SPEEDS[(i + 1) % REPLAY_SPEEDS.length];
      },
      seek: (frac) => { if (replayPlay) seekReplay(frac * replayPlay.replay.dur); },
      exit: () => exitReplay(),
      viewInfo: replayViewInfo,
    });

    const replayBtn = document.getElementById('replayBtn');
    const replayRecEl = document.getElementById('replayRec');
    const replayRecTimeEl = document.getElementById('replayRecTime');
    function syncReplayButton() {
      if (!replayBtn) return;
      replayBtn.classList.toggle('hidden', !replayEnabled());
    }
    syncReplayButton();
    onSettingsChange((id) => { if (id === 'replay') syncReplayButton(); });
    replayBtn?.addEventListener('click', () => {
      if (!replayEnabled()) return;
      unlockPointer();
      setOverlay(false);
      replayUI.show();
    });



    const _loopChan = new MessageChannel();
    _loopChan.port1.onmessage = () => frame(performance.now());
    function scheduleNextFrame() {
      if (vsync) requestAnimationFrame(frame);
      else _loopChan.port2.postMessage(0);
    }

    function frame(now) {
      _doseFrame++;
      scheduleNextFrame();
      const _fStart = performance.now();

      renderer.info.autoReset = false;
      renderer.info.reset();
      if (prayOpen) paintPray();


      if (location.search.includes('debug')) {
        window.__game = {
          inv, ITEMS, give, torches, addTorch, tryTorchPlace, doPlace, world, player,
          waterAt: (x, y, z) => world.waterAt(x, y, z), useWater: (x, y, z, a) => world.useWater(x, y, z, a),
          save: () => { void world.save(player); },
          biomeAt, B,
          teleport(x, z) {
            const y = world.surfaceY(x, z, Math.ceil(terrainTrend(x + WORLD_SEED, z + WORLD_SEED)) + 12);
            player.pos.set(x, y + 0.2, z); player.vel.set(0, 0, 0);
            return { x, y, z, biome: biomeAt(x, z) };
          },
          perf: () => ({
            fps: fpsSmooth, calls: renderer.info.render.calls,
            tris: renderer.info.render.triangles,
            frame: Object.values(perf).reduce((a, b) => a + b, 0),
            ...perf, ...vegPerf,
            vegCount: (() => { let n = 0; for (const l of Object.values(_vegActive)) n += l.size; return n; })(),
          })
        };



        window.__gen = {
          terrain: () => WORLD_TERRAIN,
          seed: () => WORLD_SEED,
          setSeed(n) {
            WORLD_SEED = n | 0;
            _trendCache.clear(); _biomeCache.clear(); _colDensityCache.clear();
            _caveSites.clear(); _caveCols.clear(); _indSites.clear(); _groundYCache.clear();
            _caveSeed = null; _indSeed = null; _realisticSeed = null; REALISTIC = null;
            world.field.baseCache.clear();
          },
          recenter(x, z) { if (WORLD_TERRAIN === 'realistic') realisticTerrain().recenter(x, z); },
          hash3, noise3, fbm3, climateAt, biomeWeights, biomeAt, terrainTrend,
          columnDensity, caveCarveAt, terrainDensity,
          caveSite: (cx, cz) => caveSite(cx, cz),
          caveSitesAt: (sx, sz) => caveSitesAt(sx, sz),
          industrialSite: (cx, cz) => {
            const s = industrialSite(cx, cz);
            return s ? { x: s.x, z: s.z, y0: s.y0, padX: s.padX, padZ: s.padZ } : null;
          },
          industrialPad: (x, z) => {
            const p = industrialPadAt(x, z);
            return p ? { x: p.site.x, z: p.site.z, y0: p.site.y0, padX: p.site.padX, padZ: p.site.padZ, w: p.w } : null;
          },
          fieldGet: (x, y, z) => world.field.get(x, y, z),
          fieldSample: (x, y, z) => world.field.sample(x, y, z),
          fieldEdit: (x, y, z, v) => world.field.set(x, y, z, v),
          fieldClearEdits: () => { world.field.edits.clear(); world.field.baseCache.clear(); },
          mineSphere: (x, y, z, r) => world.field.mineSphere(x, y, z, r),
        };

        window.__waterSelfTest = () => {
          const w = world, ws = w.water;
          let col = null;
          outer:
          for (let x = -96; x <= 96; x += 1)
            for (let z = -96; z <= 96; z += 1) {
              const s = w.surfaceAt(x, z);
              if (s !== -Infinity && w.waterAt(x + 0.5, s - 1, z + 0.5) > 0) { col = [x, z]; break outer; }
            }
          if (!col) return { ok: true, note: 'no pond deeper than 1 m in 96 m, nothing to verify' };
          const [x, z] = col;
          const s0 = w.surfaceAt(x, z);
          const d0 = ws.depth.get(World.wk(x, z));
          const before = w.waterAt(x + 0.5, s0 - 1, z + 0.5);
          const removed = w.useWater(x + 0.5, s0 - 1, z + 0.5, 1.0, 2);
          const after = w.waterAt(x + 0.5, s0 - 1, z + 0.5);
          let maxS = s0;
          for (let i = 0; i < 40; i++) { w.updateWater(); maxS = Math.max(maxS, w.surfaceAt(x, z)); }
          const ok = before > 0 && removed > 0 && w.surfaceAt(x, z) < s0 + 1e-6 && after < before && maxS <= s0 + 0.05;
          console[ok ? 'log' : 'error']('water self-test', ok ? 'PASS' : 'FAIL',
            { x, z, surface: s0, d0, before, removed, after, settled: w.surfaceAt(x, z) });
          return { ok, x, z, surface: s0, d0, before, removed, after, settled: w.surfaceAt(x, z) };
        };
        if (!window.__waterSelfTestLogged) {
          window.__waterSelfTestLogged = true;
          console.log('water self-test available: __waterSelfTest()');
        }




        window.__vegSelfTest = () => {
          const fails = [];
          let checked = 0;
          for (const layer of ['canopy', 'ground', 'cover', 'floor', 'flowers', 'aquatic']) {
            for (const pl of _vegActive[layer].values()) {
              if (!pl) continue;
              checked++;
              const sp = pl.sp;
              const b = biomeAt(pl.x, pl.z);
              if (!sp.weights[b]) fails.push({ n: sp.n, why: 'wrong biome', b });
              if (sp.water === 'surface') {
                const wsurf = world.surfaceAt(pl.x, pl.z);
                if (wsurf === -Infinity || Math.abs(pl.y - wsurf - 0.02) > 0.05) fails.push({ n: sp.n, why: 'not on water surface' });
                continue;
              }
              const sy = world.surfaceY(pl.x, pl.z, Math.ceil(terrainTrend(pl.x + WORLD_SEED, pl.z + WORLD_SEED)) + 12);
              const depth = sy - pl.y;
              const root = (sp.trunk && sp.align === 'upright') ? 0.7 : 0;
              if (depth < -0.05) fails.push({ n: sp.n, why: 'floating', depth });
              if (depth > (sp.sink + root) + 0.6) fails.push({ n: sp.n, why: 'sunk', depth });
              if (sp.water === 'none' && world.surfaceAt(pl.x, pl.z) !== -Infinity) fails.push({ n: sp.n, why: 'in water' });
            }
          }
          const ok = fails.length === 0;
          console[ok ? 'log' : 'error']('veg self-test', ok ? 'PASS' : 'FAIL', { checked, fails: fails.slice(0, 8) });
          return { ok, checked, fails };
        };
        if (!window.__vegSelfTestLogged) {
          window.__vegSelfTestLogged = true;
          console.log('veg self-test available: __vegSelfTest()');
        }
      }

      const exporting = !!replayExport;
      const exportSim = exporting && replayExport.needsSim;
      const rawDt = (now - last) / 1000;
      const dt = exporting
        ? (exportSim ? replayExport.step : 0)
        : Math.min(0.05, rawDt);
      if (exporting && exportSim) replayExport.needsSim = false;
      last = now;
      tickTreeShake(dt);
      const paused = !locked && !replayPlay && !introOpen && !prayOpen && !invOpen && !cmdOpen && !mapSystem?.isOpen() && !recipeOpen && !visibleTree() && !workbenchUI.opened && !skylineSystem?.isOpen() && !achieveOpen;
      if (!paused && !sleep) playTime += dt;
      // The sim clamps dt to avoid tunneling; the FPS readout must not, or a stall reads as 20fps.
      fpsSmooth += ((1 / Math.max(exporting ? dt : rawDt, 1e-4)) - fpsSmooth) * 0.08;
      if (sleep) { updateSleep(dt); mining = false; player.vel.set(0, 0, 0); }

      if (!paused && !sleep) {
      const _pMove = performance.now();
      if (drive) {
        updateDrive(dt); updateBreath(dt);
      } else if (!invOpen && !cmdOpen && !workbenchUI.opened && !skylineSystem?.isOpen() && !mapSystem?.isOpen() && !replayPlay) {
        movePlayer(dt); updateBreath(dt);
      } else {
        player.vel.x = 0; player.vel.z = 0;
      }
      perf.move += performance.now() - _pMove;


      if (mining && locked && !invOpen && !cmdOpen && !drive) {
        mineTimer -= dt;
        while (mineTimer <= 0) { doMine(); mineTimer += heldTool().rate; }
      } else mining = false;


      if (timeLock === null) {
        clock.t += dt;
        if (clock.t >= TUNING.DAY_SECONDS) { clock.t -= TUNING.DAY_SECONDS; clock.day++; maybeNuclearStrike(); }
      } else {
        clock.t = timeLock;
      }
      updateDaylight();
      updateAmbientMusic(dt);
      updateMachineSounds(dt);
      if (armorShieldTimer > 0) armorShieldTimer = Math.max(0, armorShieldTimer - dt);
      if (radIntakeTimer > 0) radIntakeTimer = Math.max(0, radIntakeTimer - dt);
      if (smokeTime > 0) smokeTime = Math.max(0, smokeTime - dt);
      if (cigModel) cigModel.visible = smokeTime > 0;
      machineSystem?.update(dt);
      skylineSystem?.update(dt);
      if (machineSystem) for (const c of machineSystem.cleaners) inv.dose = Math.max(0, inv.dose - 8 * dt);
      updateVitals(dt);
      updateGuide(dt);
      updateAchievements(dt);
      const inWaste = biomeAt(player.pos.x, player.pos.z) === B.WASTELAND;
      if (inWaste !== wasInWaste) {
        wasInWaste = inWaste;
        if (inWaste) notice('WASTELAND · HOT GROUND');
      }
      const radRate = doseRate();
      if (radRate <= 0.01) radFreeT += dt; else radFreeT = 0;
      if (radFreeT >= TUNING.RAD_CALM_DELAY) inv.dose = Math.max(0, inv.dose - TUNING.RAD_DECAY * dt);
      inv.dose += radRate * dt;
      if (inv.dose >= TUNING.RAD_LETHAL_DOSE && !replayPlay) die();
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (deathT > 0) deathT = Math.max(0, deathT - dt);
      if (noticeT > 0) noticeT = Math.max(0, noticeT - dt);




      if (replayPlay) updateReplayPlayback(dt);
      else if (replayRec) {
        replayRecT += dt;
        const held = inv.hot[inv.sel];
        pushFrame(replayRec, replayRecT, player.pos.x, player.pos.y, player.pos.z,
          player.yaw, player.pitch, clock.t, held ? held.id : null, eyeCur, slidePitch);
      }

      if (replayPlay) {

      } else {
        eyeCur += ((sliding ? 1.02 : player.eye) - eyeCur) * Math.min(1, dt * 10);
        slidePitch += ((sliding ? 0.14 : 0) - slidePitch) * Math.min(1, dt * 8);
      }
      const speed = Math.hypot(player.vel.x, player.vel.z);
      const localRight = player.vel.x * Math.cos(player.yaw) - player.vel.z * Math.sin(player.yaw);
      const moveLean = Math.max(-1, Math.min(1, localRight / 5.5));
      if (!drive) {
        const leanTarget = -moveLean * (sliding ? 0.16 : 0.12);
        cameraRoll += (leanTarget - cameraRoll) * (1 - Math.exp(-dt * 3.8));
        const movingGrounded = player.onGround && !sliding && speed > 0.65;
        if (movingGrounded) cameraBob += dt * (keys.ShiftLeft || keys.ShiftRight ? 13 : 9);
        const landingSpring = -landingOffset * 88 - landingVelocity * 17;
        landingVelocity += landingSpring * dt;
        landingOffset += landingVelocity * dt;
        if (Math.abs(landingOffset) < 0.0005 && Math.abs(landingVelocity) < 0.005) { landingOffset = 0; landingVelocity = 0; }
        const camTargetY = player.pos.y + eyeCur;
        camY = camY === null ? camTargetY : camY + (camTargetY - camY) * Math.min(1, dt * 22);
        const shake = shakeT > 0 ? shakeT * 0.12 : 0;
        camera.position.set(
          player.pos.x + (Math.random() - 0.5) * shake,
          camY + (movingGrounded ? Math.abs(Math.sin(cameraBob)) * 0.035 : 0) + landingOffset + (Math.random() - 0.5) * shake,
          player.pos.z + (Math.random() - 0.5) * shake);


        if (replayPlay) camera.position.y = Math.max(camera.position.y, player.pos.y + 0.25);
        camera.rotation.y = player.yaw + (Math.random() - 0.5) * shake * 0.5;
        camera.rotation.x = player.pitch + slidePitch - landingOffset * 0.24 + (Math.random() - 0.5) * shake * 0.5;
      }


      const _pJobs = performance.now();
      world.updateJobs(dt);
      perf.jobs += performance.now() - _pJobs;


      const _pDrops = performance.now();
      pumpDeathSpill();
      updateDrops(dt, now);
      workbenchUI.update(dt);
      if (recipeOpen) {
        starterUiTimer += dt;
        if (starterUiTimer >= 1) { starterUiTimer = 0; paintStarterGuide(); }
      }

      perf.drops += performance.now() - _pDrops;


      const _pWorld = performance.now();
      if (WORLD_TERRAIN === 'realistic') realisticTerrain().recenter(player.pos.x + WORLD_SEED, player.pos.z + WORLD_SEED);
      world.update(player.pos.x, player.pos.y, player.pos.z);
      farTerrain.update(player.pos.x, player.pos.z);
      const _worldMs = performance.now() - _pWorld;
      perf.world += _worldMs;
      vegPerf.frames++;
      const _pVeg = performance.now();
      vegFalling(dt);
      vegPerf.anim += performance.now() - _pVeg;
      updateChop(dt);
      industrialUpdate(player.pos.x, player.pos.z);
      barrelUpdate(player.pos.x, player.pos.z);
      } else {
        world.updateJobs(0);
      }

      if (sleep) {

        eyeCur += ((player.eye) - eyeCur) * Math.min(1, dt * 10);
        slidePitch += ((0) - slidePitch) * Math.min(1, dt * 8);
        const camTargetY = player.pos.y + eyeCur;
        camY = camY === null ? camTargetY : camY + (camTargetY - camY) * Math.min(1, dt * 22);
        camera.position.set(player.pos.x, camY, player.pos.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        camera.rotation.z = 0;
      }

      const submerged = world.isUnderwater(camera.position.x, camera.position.y, camera.position.z);
      let _dirtyFrameMs = 0;
      if (!sleep) {
      waterSimTimer += dt;
      const waterStepInterval = submerged ? 0.12 : 0.18;
      if (waterSimTimer >= waterStepInterval) {


        const _pWater = performance.now();
        world.updateWater(submerged);
        perf.water += performance.now() - _pWater;
        waterSimTimer = 0;
      }


      const _pDirty = performance.now();
      world.processDirty(5);
      _dirtyFrameMs = performance.now() - _pDirty;
      perf.dirty += _dirtyFrameMs;
      const _pW = performance.now();
      world.processWaterDirty(1);
      perf.wdirty += performance.now() - _pW;
      }


      const _pEnt = performance.now();
      if (!sleep) {
      updateWrapperSpawns(dt);
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i];
        w.update(dt, player.pos);


        w.hitCd = Math.max(0, (w.hitCd || 0) - dt);
        if (!w.hitCd && w.pos.distanceTo(player.pos) < 1.6) {
          w.hitCd = 1.2;
          hurt(7, 'bleeding');
        }


        if (w.pos.distanceTo(player.pos) > 90) {
          w.dispose();
          walkers.splice(i, 1);
        }
      }


      for (let i = wrappers.length - 1; i >= 0; i--) {
        const w = wrappers[i];
        w.update(dt, player.pos);

        w.hitCd = Math.max(0, (w.hitCd || 0) - dt);
        if (!w.dying && !w.hitCd && w.pos.distanceTo(player.pos) < 1.9) {
          w.hitCd = w.waste ? WRAPPER.wasteHitCd : 1.5;
          playWrapperSound('attack', w.pos);
          hurt(w.waste ? WRAPPER.wasteDamage : 11, 'bleeding');
          if (Math.random() < (w.waste ? 0.55 : 0.35)) addWound('pain');
        }

        if (w.dead || w.pos.distanceTo(player.pos) > WRAPPER.despawn) {
          if (!w.dead) w.dispose();
          wrappers.splice(i, 1);
        }
      }

      updateChickenSpawns(dt);
      for (let i = chickens.length - 1; i >= 0; i--) {
        const c = chickens[i];
        c.update(dt, player.pos);
        if (c.dead || c.pos.distanceTo(player.pos) > CHICKEN.despawn) {
          c.dispose();
          chickens.splice(i, 1);
        }
      }
      }
      perf.entities += performance.now() - _pEnt;



      const _pMisc = performance.now();



      const nominalFar = viewRadius * CHUNK_SIZE;
      const horizon = farTerrain.outer;
      const visFar = horizon > 0 ? Math.min(horizon, nominalFar * 1.1) : nominalFar;




      let far = Math.max(400, horizon > 0 ? Math.min(horizon * 1.02, nominalFar * 1.1) : nominalFar * 1.1);
      for (const fx of nukeFx) far = Math.max(far, Math.hypot(fx.x - camera.position.x, fx.z - camera.position.z) + 700);
      if (far !== camera.far) {
        camera.far = far;
        camera.updateProjectionMatrix();
      }
      const baseFar = visFar;
      const baseNear = horizon > 0 ? DETAIL_CHUNK_RADIUS * CHUNK_SIZE : nominalFar * 0.6;


      uwT += ((submerged ? 1 : 0) - uwT) * Math.min(1, dt * 6);
      scene.fog.near = baseNear + (0.4 - baseNear) * uwT;
      scene.fog.far = baseFar + (22 - baseFar) * uwT;
      scene.fog.color.copy(skyNow).lerp(UNDERWATER_COL, uwT);
      scene.background.copy(skyNow).lerp(UNDERWATER_COL, uwT);
      farTerrain.setHaze(visFar);
      camera.rotation.z = cameraRoll + Math.sin(now * 0.0011) * 0.05 * uwT;
      clouds.visible = uwT < 0.85;
      sunDisc.material.opacity = 0.95 * (1 - uwT) * sunVis;
      sunGlow.material.opacity = 0.25 * (1 - uwT) * sunVis;
      sunHalo.material.opacity = 0.25 * (1 - uwT) * sunVis;
      moonDisc.material.opacity = 0.95 * (1 - uwT) * moonVis;
      moonGlow.material.opacity = 0.7 * (1 - uwT) * moonVis;


      waterUniforms.uTime.value = now / 1000;
      waterUniforms.uFogColor.value.copy(scene.fog.color);
      waterUniforms.uFogNear.value = scene.fog.near;
      waterUniforms.uFogFar.value = scene.fog.far;
      if (drinkT > 0) drinkT -= dt;


      refreshInteractPrompt();


      updatePlacePreview(now);


      if (holdPlace.active) {
        if (!locked || invOpen) resetHoldPlace();
        else if (performance.now() >= holdPlace.next) {
          holdPlace.next = performance.now() + 120;
          doPlace({ drag: true });
        }
      }


      updateTorches(dt, now);
      updateDoorSwings(dt);
      updateC4(dt);
      updateNukeFx(dt);


      updateViewmodel(dt);


      sun.position.copy(camera.position).addScaledVector(SUN_DIR, 80);
      sun.target.position.copy(camera.position);
      sun.target.updateMatrixWorld();



      const skyDist = 280;
      const sunAt = new THREE.Vector3().copy(camera.position).addScaledVector(SUN_DIR, skyDist);
      sunDisc.position.copy(sunAt);
      sunGlow.position.copy(sunAt);
      sunHalo.position.copy(sunAt);
      sunDisc.lookAt(camera.position);
      sunGlow.lookAt(camera.position);
      sunHalo.lookAt(camera.position);
      const moonAt = new THREE.Vector3().copy(camera.position).addScaledVector(MOON_DIR, skyDist);
      moonDisc.position.copy(moonAt);
      moonGlow.position.copy(moonAt);
      moonDisc.lookAt(camera.position);
      moonGlow.lookAt(camera.position);
      moonLight.position.copy(camera.position).addScaledVector(MOON_DIR, 80);
      moonLight.target.position.copy(camera.position);
      moonLight.target.updateMatrixWorld();
      clouds.position.set(player.pos.x, 88, player.pos.z);
      cloudUniforms.uTime.value = now / 1000;


      const stage = radStage();
      const k = Math.min(1, dt * 2);
      const eyeBlur = vitals.wounds.eye ? WOUNDS.eye.blur : 0;

      const blurTarget = workbenchUI.opened ? 0 : stage.blur + eyeBlur;
      postMat.uniforms.uRadBlur.value += (blurTarget - postMat.uniforms.uRadBlur.value) * k;
      postMat.uniforms.uRadDark.value += (stage.dark - postMat.uniforms.uRadDark.value) * k;
      postMat.uniforms.uDriveRed.value = drive ? 1 : 0;
      postMat.uniforms.uTime.value = now / 1000;
      perf.misc += performance.now() - _pMisc;

      const _pRender = performance.now();
      renderer.setRenderTarget(postTarget);
      renderer.render(scene, camera);

      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(viewScene, viewCam);
      renderer.autoClear = true;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
      if (shotRequested) {
        shotRequested = false;
        renderer.domElement.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `nuclearism-day${clock.day}-${Date.now()}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
      }
      if (panoRequested) {
        panoRequested = false;
        capturePanorama();
      }



      if (exporting) {
        const ready = !world.dirty.length && !world.loading.length && !world.waterDirty.length
          ? true : settleWorldForExport(80);
        if (ready && replayExport && replayPlay) {
          const ex = replayExport;
          ex.c2d.drawImage(renderer.domElement, 0, 0, ex.w, ex.h);

          const cx = ex.w / 2, cy = ex.h / 2, g = ex.c2d;
          g.strokeStyle = 'rgba(255,255,255,0.9)';
          g.lineWidth = Math.max(1, Math.round(ex.h / 720));
          const cs = Math.max(6, Math.round(ex.h / 90));
          const gap = Math.max(3, Math.round(cs / 3));
          g.beginPath();
          g.moveTo(cx - cs, cy); g.lineTo(cx - gap, cy);
          g.moveTo(cx + gap, cy); g.lineTo(cx + cs, cy);
          g.moveTo(cx, cy - cs); g.lineTo(cx, cy - gap);
          g.moveTo(cx, cy + gap); g.lineTo(cx, cy + cs);
          g.stroke();
          ex.track?.requestFrame?.();
          if (replayPlay.t >= replayPlay.replay.dur - 1e-6) {
            finishReplayExport();
          } else {
            replayPlay.t = Math.min(replayPlay.replay.dur, replayPlay.t + ex.step);
            ex.needsSim = true;
          }
        }
      }
      const _renderMs = performance.now() - _pRender;
      perf.render += _renderMs;
      mapSystem?.setMinimapVisible(locked && !mapSystem.isOpen());
      mapSystem?.update(dt);
      paintGainCard(now);
      updateHud(dt);
      replayUI?.paint();
      if (replayRecEl) {
        const on = !!replayRec && !replayPlay;
        replayRecEl.classList.toggle('hidden', !on);
        if (on && replayRecTimeEl) replayRecTimeEl.textContent = formatTime(replayNow());
      }

      const _frameMs = now - lastFrameAt;
      lastFrameAt = now;
      const cp = window.__chunkPerf || {};
      const dr = (cp.rebuildN || 0) - lagSheet.lastRebuildN;
      const dlN = (cp.loadN || 0) - lagSheet.lastLoadN;
      lagSheet.lastRebuildN = cp.rebuildN || 0;
      lagSheet.lastLoadN = cp.loadN || 0;
      const wMs = +((typeof _worldMs === 'number' ? _worldMs : 0)).toFixed(1);
      const rMs = +((typeof _renderMs === 'number' ? _renderMs : 0)).toFixed(1);
      const dMs = +((typeof _dirtyFrameMs === 'number' ? _dirtyFrameMs : 0)).toFixed(1);
      const workMs = +(performance.now() - _fStart).toFixed(1);
      const sample = {
        t: +now.toFixed(0),
        ms: +_frameMs.toFixed(1),
        workMs,
        idleMs: +(Math.max(0, _frameMs - workMs)).toFixed(1),
        dirty: world.dirty.length,
        loading: world.loading.length,
        rebuild: dr,
        load: dlN,
        worldMs: wMs,
        renderMs: rMs,
        dirtyMs: dMs,
        otherMs: +(Math.max(0, workMs - wMs - rMs - dMs)).toFixed(1),
      };
      lagSheet.frames.push(sample);
      if (lagSheet.frames.length > 600) lagSheet.frames.splice(0, lagSheet.frames.length - 600);
      if (_frameMs > 34 || dr > 0 || dlN > 5) {
        lagSheet.events.push(sample);
        if (lagSheet.events.length > 400) lagSheet.events.splice(0, lagSheet.events.length - 400);
      }
    }

    async function vegPrewarm(px, pz, onProgress = () => {}) {
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      vegUpdate(px, pz);
      for (let i = 0; i < 4000; i++) {
        if (_vegStreamTask) vegStreamStep(8);
        else { vegUpdate(px, pz); if (!_vegStreamTask) break; }

        for (const sp of VEG_SPECIES) {
          if (!sp.dirty) continue;
          vegUpdateInstances(sp);
          sp.dirty = false;
        }
        if ((i & 3) === 0) {
          onProgress(_vegStreamTask ? 0.5 : 1);
          await nextFrame();
        }
      }
      for (const sp of VEG_SPECIES) {
        if (sp.dirty) { vegUpdateInstances(sp); sp.dirty = false; }
      }
      onProgress(1);
    }

    maybeShowIntro();
    window.__NUCLEARISM_PREGEN_PROGRESS__ = 0;
    window.__NUCLEARISM_READY_COMPLETE__ = false;
    window.__NUCLEARISM_HAS_FAR_TERRAIN__ = viewRadius > DETAIL_CHUNK_RADIUS;
    window.__NUCLEARISM_LOAD_STATUS__ = 'Generating spawn terrain...';
    const hasFarTerrain = window.__NUCLEARISM_HAS_FAR_TERRAIN__;


    const setIntroProgress = (p) => {
      if (!introBtn || !introBtn.disabled) return;
      const pct = Math.max(0, Math.min(99, Math.floor(p * 100)));
      introBtn.textContent = `LOADING ${pct}%`;
    };
    window.__NUCLEARISM_READY__ = world.prewarm(
      player.pos.x,
      player.pos.y,
      player.pos.z,
      (progress) => {
        window.__NUCLEARISM_PREGEN_PROGRESS__ = hasFarTerrain ? progress * 0.15 : progress * 0.7;
        window.__NUCLEARISM_LOAD_STATUS__ = 'Generating spawn terrain...';
        setIntroProgress(window.__NUCLEARISM_PREGEN_PROGRESS__);
      },
    ).then(() => {
      window.__NUCLEARISM_LOAD_STATUS__ = 'Growing vegetation...';
      return vegPrewarm(
        player.pos.x,
        player.pos.z,
        (progress) => {
          window.__NUCLEARISM_PREGEN_PROGRESS__ = hasFarTerrain ? 0.15 + progress * 0.1 : 0.7 + progress * 0.3;
          window.__NUCLEARISM_LOAD_STATUS__ = 'Growing vegetation...';
          setIntroProgress(window.__NUCLEARISM_PREGEN_PROGRESS__);
        },
      );
    }).then(() => {
      window.__NUCLEARISM_LOAD_STATUS__ = hasFarTerrain ? 'Generating distant terrain...' : 'Finalizing world...';
      return farTerrain.prewarm(
        player.pos.x,
        player.pos.z,
        (progress) => {
          window.__NUCLEARISM_PREGEN_PROGRESS__ = hasFarTerrain ? 0.25 + progress * 0.75 : 1;
          window.__NUCLEARISM_LOAD_STATUS__ = hasFarTerrain ? 'Generating distant terrain...' : 'Finalizing world...';
          setIntroProgress(window.__NUCLEARISM_PREGEN_PROGRESS__);
        },
      );
    }).then(() => {
      window.__NUCLEARISM_LOAD_STATUS__ = 'Finalizing world...';
      scheduleNextFrame();
      window.__NUCLEARISM_READY_COMPLETE__ = true;
      if (introBtn && introBtn.disabled) { introBtn.textContent = 'ENTER THE ZONE'; introBtn.disabled = false; }
    });


    initModelIcons();





    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      viewCam.aspect = camera.aspect;
      viewCam.updateProjectionMatrix();
      applyPixelSize();
    });


    const saveNow = async (reason) => {
      if (wipeSave || replayPlay) return false;
      const ok = await world.save(player);
      if (reason) console.info(`[save] trigger=${reason} ok=${ok}`);
      return ok;
    };

    // Serializing a save costs tens of ms. Coalesce the automatic ones and run
    // them in spare idle time so they never sit inside a frame callback.
    let _saveQueued = false;
    function queueSave(reason) {
      if (_saveQueued || wipeSave || replayPlay) return;
      _saveQueued = true;
      const run = (deadline) => {
        if (deadline && typeof deadline.timeRemaining === 'function' &&
            deadline.timeRemaining() < 8 && !deadline.didTimeout) {
          requestIdleCallback(run, { timeout: 1000 });
          return;
        }
        _saveQueued = false;
        void saveNow(reason);
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1000 });
      else setTimeout(run, 0);
    }

    setInterval(() => { queueSave('interval'); }, 12000);

    addEventListener('beforeunload', () => { void saveNow('beforeunload'); });
    addEventListener('pagehide', () => { void saveNow('pagehide'); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void saveNow('hidden');
    });























































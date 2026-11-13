    import * as THREE from 'three';
    import { WorkbenchUI } from './workbench-ui.js';
    import { CraftOptions } from './craft-options.js';
    import { DragDrop, inventoryAdapter } from './drag-drop.js';
    import { ITEM_DEFS, ITEM_MODEL_ICON_EXCLUDE, itemModelIcon, modelTint, MACHINE_DEFS, MACHINE_BY_ID, CRAFT_RECIPES, TABLE_RECIPES, layoutFor, TUNING, LIQUID_DEFS, regionOre, formatRad, formatRadRate, STARTER_GUIDE, STARTER_GUIDE_SECONDS, GUIDE_STEPS, ACHIEVEMENT_TYPES, BUILD_TIERS, BUILD_TIER_ORDER, BUILD_UPGRADES } from './content.js';
    import * as Liquid from './liquids.js';
    import { MachineSystem } from './machines.js';
    import { PipeSystem } from './pipes.js';
    import { BuildingSystem } from './building.js';
    import { swingFrame } from './pieces/door.js';
    import { MapSystem } from './map.js';
    import { createFootsteps, surfToCategory } from './footsteps.js';
    import { sourcePoint, transmission, relativeBearing, compass, RAD_OCCL } from './radiation.js';
    import { getSetting, renderSettings, onSettingsChange } from './settings.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
    import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
    import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
    import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';





    const CHUNK_SIZE = 16;
    // The settings value controls the visible horizon in chunks. Interactive
    // terrain remains tightly bounded until the far-terrain LOD streamer is
    // available; never feed the horizon value directly into chunk allocation.
    const MAX_RENDER_DISTANCE = 10000;
    const DETAIL_CHUNK_RADIUS = 6;
    // Haze strength of the far-terrain rings: the fade reaches ~99.9% at the
    // outer edge of the outermost ring, so its border never shows as a hard line.
    const FAR_HAZE_REACH = 2.6;
    const SAMPLE_SIZE = CHUNK_SIZE + 2;
    const VERTEX_SIZE = CHUNK_SIZE + 1;
    const S2 = SAMPLE_SIZE * SAMPLE_SIZE;
    const V2 = VERTEX_SIZE * VERTEX_SIZE;


    const MENU_WORLD = window.__NUCLEARISM_WORLD__ || null;
    const WORLD_MODE = MENU_WORLD?.mode === 'sandbox' ? 'sandbox' : 'survival';
    const WORLD_NAME = MENU_WORLD?.name || 'WORLD';
    document.title = `NUCLEARISM — ${WORLD_NAME}`;

    let viewRadius = Math.min(MAX_RENDER_DISTANCE, getSetting('renderDistance'));
    let showInfoHud = getSetting('infoHud');
    let masterVolume = getSetting('volume');
    let vsync = getSetting('vsync');
    let mouseSens = getSetting('sensitivity');
    let invertY = getSetting('invertY');
    const CHUNK_Y_MIN = -1;
    const CHUNK_Y_MAX = 2;

    const SAVE_KEY = MENU_WORLD ? `idte.save.v2.${MENU_WORLD.id}` : 'idte.save.v1';


    let WORLD_SEED = (Math.random() * 100000) | 0;



    const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.35).normalize();
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
      TUNDRA: 11, SNOWY_PEAKS: 12, WASTELAND: 14,
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
      [B.WASTELAND]: { name: 'WASTELAND', base: 4.0, amp: 3.0, rough: 1.0, top: [0.42, 0.40, 0.37], surf: 'ash' },
    };


    const LAND_ANCHORS = [
      [B.TUNDRA, -0.80, 0.10],
      [B.SNOWY_PEAKS, -0.45, -0.55],
      [B.PLAINS, 0.00, -0.10],
      [B.FOREST, 0.15, 0.50],
      [B.JUNGLE, 0.75, 0.70],
      [B.SAVANNA, 0.50, -0.15],
      [B.DESERT, 0.80, -0.80],
      [B.WASTELAND, 0.05, -0.70],
    ];


    // Terrain lookups extend far beyond the old signed 16-bit packed-key range.
    // Pack column coords into a NUMBER, not a string: these caches are hit once
    // per voxel sample, so building a string key per lookup was pure overhead.
    // Beyond ±2^20 m (far past any reachable world) fall back to a string key.
    const _colKey = (a, b) => (
      a >= -1048576 && a <= 1048575 && b >= -1048576 && b <= 1048575
    ) ? ((a + 1048576) * 2097152 + (b + 1048576)) : `w${a},${b}`;
    const _trendCache = new Map();
    const _biomeCache = new Map();

    function cacheTerrainValue(cache, key, value) {
      cache.set(key, value);
      // Far-horizon sampling walks through new coordinates over time. Bound the
      // shared procedural caches so exploring the horizon cannot grow them forever.
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

      // No oceans or beaches: every column is land, chosen by climate only.
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

      const { e } = climateAt(sx, sz);
      const w = biomeWeights(sx, sz);

      let base = 0, amp = 0, rough = 0, land = false;
      for (const { id, w: wt } of w) {
        const d = BIOME_DEFS[id];
        base += d.base * wt; amp += d.amp * wt; rough += d.rough * wt;
        if (id >= B.PLAINS) land = true;
      }
      // Mountain belts are broad, linked massifs. A warped ridged field gives
      // them long folded spines; branching drainage incisions cut through those
      // spines like dry watercourses instead of leaving isolated noise peaks.
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

      // Dry world: no ocean plate or shore blend, every column is land.
      v = SEA_LEVEL + 26 * Math.tanh(raw / 26) + mountainLift;
      cacheTerrainValue(_trendCache, k, v);
      return v;
    }



    // Surface water is gone: groundwater is only reachable from tanks and pumps.
    function pondHere() { return false; }





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

      // Per-primitive vertical bounds. A capsule/ellipsoid/cone can only affect
      // the y range it spans, so a voxel far above or below a tunnel never needs
      // to test it. Exact bounds (not approximations) — the result is unchanged.
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



      if (d > 42 || d < -6) return d;


      let v = d + (info.underOcean ? 1.8 : 4.5)
        * (fbm3(sx * 0.035, y * 0.035, sz * 0.035, 2) * 2 - 1) * info.seaFade;


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
          // Bound the cache: every sampled voxel was kept forever, so a long
          // session grew an unbounded Map (slower lookups + growing memory).
          // Evict the oldest entries in bulk, like the terrain caches do.
          if (this.baseCache.size > 400000) {
            const it = this.baseCache.keys();
            for (let i = 0; i < 120000; i++) {
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
      set(x, y, z, v) {
        this.edits.set(DensityField.key(x, y, z), v);
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
      }


      loadSamples() {
        const s = this.samples;
        const field = this.world.field;
        const ox = this.ox, oy = this.oy, oz = this.oz;

        let mn = Infinity, mx = -Infinity;

        for (let k = -1; k <= CHUNK_SIZE; k++) {
          const kOff = (k + 1) * S2;
          const wz = oz + k;
          for (let j = -1; j <= CHUNK_SIZE; j++) {
            const jOff = kOff + (j + 1) * SAMPLE_SIZE;
            const wy = oy + j;
            for (let i = -1; i <= CHUNK_SIZE; i++) {
              const v = field.get(ox + i, wy, wz);
              s[(i + 1) + jOff] = v;
              if (v < mn) mn = v;
              if (v > mx) mx = v;
            }
          }
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

        const positions = [];
        const colors = [];
        const indices = [];
        const adata = [];
        const surfArr = [];
        const submArr = [];
        const torchArr = [];

        const vg = new Int32Array(V * V * V).fill(-1);

        const samp = (i, j, k) => s[(i + 1) + (j + 1) * S + (k + 1) * S2l];



        const c = _corners;
        const wsurfCol = _wsurfCol.fill(NaN);

        // Only torches whose range reaches this chunk can light its vertices.
        // Testing every placed torch for every vertex was the bulk of the cost.
        let chunkTorches = torches;
        if (torches.length) {
          const cx = this.ox + 8, cy = this.oy + 8, cz = this.oz + 8;
          const near = [];
          for (const t of torches) {
            const L = t.light;
            const reach = L.range + CHUNK_SIZE;
            const dx = t.pos.x - cx, dy = t.pos.y - cy, dz = t.pos.z - cz;
            if (dx * dx + dy * dy + dz * dz <= reach * reach) near.push(t);
          }
          chunkTorches = near;
        }


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

              const wx = this.ox + i + px / count;
              const wy = this.oy + j + py / count;
              const wz = this.oz + k + pz / count;

              const vi = positions.length / 3;
              positions.push(wx, wy, wz);

              const col = surfaceColor(wx, wy, wz);
              const occ = occlusionScale(this.world.field, wx, wy, wz);
              colors.push(col[0], col[1], col[2]);
              adata.push(stoneMask, dirtMask, grassMask, occ);
              surfArr.push(_surf[0], _surf[1], _surf[2], _surf[3]);
              const lt = lightAt(this.world.field, wx, wy, wz, chunkTorches);
              torchArr.push(lt[0], lt[1], lt[2]);




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
          indices: new Uint32Array(indices),
          data: new Float32Array(adata),
          surf: new Float32Array(surfArr),
          light: new Float32Array(torchArr),
          subm: new Float32Array(submArr),
        };
      }


      rebuild() {
        this.loadSamples();
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
        geo.setAttribute('aData', new THREE.BufferAttribute(data.data, 4));
        geo.setAttribute('aSurf', new THREE.BufferAttribute(data.surf, 4));
        geo.setAttribute('aLight', new THREE.BufferAttribute(data.light, 3));
        geo.setAttribute('aSubm', new THREE.BufferAttribute(data.subm, 1));
        geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();

        if (this.mesh) {
          this.mesh.geometry.dispose();
          this.mesh.geometry = geo;
        } else {
          this.mesh = new THREE.Mesh(geo, this.world.material);
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

        // No water anywhere in the simulation means there is nothing to build.
        // Bail before allocating the overshoot buffers and walking the grid.
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
    const _surf = [0, 0, 0, 0];
    function mountainRockAt(x, z) {
      return terrainTrend(x + WORLD_SEED, z + WORLD_SEED) - SEA_LEVEL > 30;
    }

    function surfaceColor(wx, wy, wz) {
      const n = (noise3(wx * 0.15, wy * 0.15, wz * 0.15) - 0.5) * 4.0;
      const def = BIOME_DEFS[biomeAt(wx, wz)];



      const depth = terrainTrend(wx + WORLD_SEED, wz + WORLD_SEED) - wy + n;
      const top = def.top;

      let r, g, b;
      if (depth > 6) {
        r = 0.33; g = 0.32; b = 0.36;
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
      grassMask = (def.surf !== 'rock' && depth < 1.2) ? 1 - exposedMountain : 0;
      dirtMask = (depth >= 1.2 && depth < 3.0) ? 1 : 0;
      stoneMask = depth >= 3.0 ? 1 : exposedMountain;
      _surf[0] = def.surf === 'sand' ? 1 - exposedMountain : 0;
      _surf[1] = def.surf === 'dry' ? 1 - exposedMountain : 0;
      _surf[2] = def.surf === 'snow' ? 1 - exposedMountain : 0;
      _surf[3] = def.surf === 'ash' ? 1 - exposedMountain : 0;
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








    function solidAt(field, x, y, z) {
      return field.get(Math.round(x), Math.round(y), Math.round(z)) > 0;
    }

    const _lightOut = [0, 0, 0];
    function lightAt(field, x, y, z, list) {
      let r = 0, g = 0, b = 0;
      const src = list || torches;
      for (const t of src) {
        const L = t.light;
        const dx = t.pos.x - x, dy = t.pos.y - y, dz = t.pos.z - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > L.range * L.range || d2 < 0.04) continue;
        const d = Math.sqrt(d2);
        let blocked = false;
        for (let i = 1; i <= 6; i++) {
          const tt = (i / 7) * (d - 0.4);
          if (tt <= 0.2) continue;
          if (solidAt(field, x + dx / d * tt, y + dy / d * tt, z + dz / d * tt)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        const f = L.power / (1.0 + 0.5 * d + 0.12 * d * d);
        r += f * t.col[0]; g += f * t.col[1]; b += f * t.col[2];
      }
      _lightOut[0] = Math.min(1.5, r);
      _lightOut[1] = Math.min(1.5, g);
      _lightOut[2] = Math.min(1.5, b);
      return _lightOut;
    }




    function occlusionScale(field, x, y, z) {

      let skyVis = 1;
      for (let i = 1; i <= 6; i++) {
        const d = field.get(Math.round(x), Math.round(y + i * 1.4), Math.round(z));
        if (d > 0) { skyVis = i <= 2 ? 0.02 : 0.08; break; }
        if (d > -0.4) skyVis -= 0.12;
      }
      skyVis = Math.max(0.02, Math.min(1, skyVis));


      let sunVis = 1;
      const sx = 0.611, sy = 0.689, sz = 0.389;
      for (let i = 1; i <= 8; i++) {
        const t = i * 1.1;
        if (solidAt(field, x + sx * t, y + sy * t, z + sz * t)) { sunVis = 0; break; }
      }


      return (0.06 + 0.94 * skyVis) * (sunVis > 0.5 ? 1.0 : 0.38);
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
        this.waterDirty = [];
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
          shader.uniforms.sandMap = { value: sandTex };
          shader.uniforms.dryMap = { value: dryTex };
          shader.uniforms.snowMap = { value: snowTex };
          shader.uniforms.ashMap = { value: ashTex };
          shader.uniforms.uUnderwaterCol = { value: UNDERWATER_COL };
          Object.assign(shader.uniforms, torchUniforms);
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
          attribute vec4 aData;
          attribute vec4 aSurf;
          attribute vec3 aLight;
          attribute float aSubm;
          varying vec3 vWPos; varying vec3 vWNorm;
          varying float vStone; varying float vDirt; varying float vTop; varying float vOcc;
          varying vec4 vSurf;
          varying vec3 vLight; varying float vSubm;`)
            .replace('#include <fog_vertex>', `#include <fog_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNorm = normalize(mat3(modelMatrix) * objectNormal);
          vStone = aData.x; vDirt = aData.y; vTop = aData.z; vOcc = aData.w;
          vSurf = aSurf;
          vLight = aLight; vSubm = aSubm;`);
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
          uniform sampler2D stoneMap; uniform sampler2D grassMap; uniform sampler2D dirtMap;
          uniform sampler2D sandMap; uniform sampler2D dryMap; uniform sampler2D snowMap; uniform sampler2D ashMap;
          uniform float torchTime;
          uniform vec3 uUnderwaterCol;
          varying vec3 vWPos; varying vec3 vWNorm;
          varying float vStone; varying float vDirt; varying float vTop; varying float vOcc;
          varying vec4 vSurf;
          varying vec3 vLight; varying float vSubm;
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
          tBase = mix(tBase, triplanar(dirtMap, vWPos, tn, 0.1), vDirt);
          // surface layer: grass by default, swapped per-biome by vSurf — real
          // different textures, no tinting. blend lets biome borders soften.
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
          tBase = mix(tBase, triplanar(stoneMap, vWPos, tn, 0.08), step(50.0, vWPos.y));
          diffuseColor.rgb = tBase * vOcc;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // baked light colour already wall-occluded — rock can't leak, range can't flood.
          // glow follows albedo luminance (pre-occ) so texture detail survives the tint.
          float tgLum = clamp(dot(diffuseColor.rgb / max(vOcc, 0.02), vec3(0.299, 0.587, 0.114)) * 1.4, 0.0, 1.0);
          float tgFl = 0.85 + 0.15 * sin(torchTime * 20.0) * sin(torchTime * 13.0 + 1.7);
          totalEmissiveRadiance += vLight * ((0.3 + 0.7 * tgLum) * tgFl);`)
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
        this.material.customProgramCacheKey = () => 'torch-baked-v2';






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

      topChunkForColumn(cx, cz) {
        const key = `${cx},${cz}`;
        let top = this.columnTopChunks.get(key);
        if (top !== undefined) return top;
        let maxHeight = -Infinity;
        // Sample at 4 m intervals so narrow ridges that cross a 16 m chunk
        // still request the vertical meshes needed to render them.
        for (let z = 0; z <= CHUNK_SIZE; z += 4) {
          for (let x = 0; x <= CHUNK_SIZE; x += 4) {
            maxHeight = Math.max(maxHeight, terrainTrend(
              cx * CHUNK_SIZE + x + WORLD_SEED,
              cz * CHUNK_SIZE + z + WORLD_SEED,
            ));
          }
        }
        top = Math.max(CHUNK_Y_MAX, Math.floor(maxHeight / CHUNK_SIZE) + 1);
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
        for (let dz = -detailRadius; dz <= detailRadius; dz++) {
          for (let dx = -detailRadius; dx <= detailRadius; dx++) {
            const cx = pcx + dx;
            const cz = pcz + dz;
            for (let cy = CHUNK_Y_MIN; cy <= this.topChunkForColumn(cx, cz); cy++) {
              const key = World.ck(cx, cy, cz);
              if (!this.chunks.has(key)) {
                const c = new Chunk(this, cx, cy, cz);
                this.chunks.set(key, c);
                this.markDirty(c);

                this.water.enqueue(cx * CHUNK_SIZE, cx * CHUNK_SIZE + CHUNK_SIZE - 1,
                  cz * CHUNK_SIZE, cz * CHUNK_SIZE + CHUNK_SIZE - 1);
              }
            }
          }
        }


        const unloadR = detailRadius + 2;
        for (const [key, c] of this.chunks) {
          const dx = c.cx - pcx, dz = c.cz - pcz;
          if (Math.abs(dx) > unloadR || Math.abs(dz) > unloadR
            || c.cy > this.topChunkForColumn(c.cx, c.cz) || c.cy < CHUNK_Y_MIN) {
            c.dispose();
            this.chunks.delete(key);
          }
        }
      }

      async prewarm(px, py, pz, onProgress = () => {}) {
        this.update(px, py, pz);
        const pcx = Math.floor(px / CHUNK_SIZE);
        const pcz = Math.floor(pz / CHUNK_SIZE);
        const center = [];
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let cy = CHUNK_Y_MIN; cy <= this.topChunkForColumn(pcx + dx, pcz + dz); cy++) {
              const chunk = this.getChunk(pcx + dx, cy, pcz + dz);
              if (chunk) center.push(chunk);
            }
          }
        }

        const total = center.length;
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
        let built = 0;
        while (built < total) {
          this.processDirty(8);
          built = center.reduce((n, chunk) => n + (chunk.built ? 1 : 0), 0);
          onProgress(total ? built / total : 1);
          if (built < total) await nextFrame();
        }
        onProgress(1);
      }

      markDirty(c) {
        if (c.queued) return;
        c.queued = true;
        this.dirty.push(c);
      }

      markRegionDirty(x0, x1, y0, y1, z0, z1) {
        const cx0 = Math.floor(x0 / CHUNK_SIZE) - 1;
        const cx1 = Math.floor(x1 / CHUNK_SIZE) + 1;
        const cy0 = Math.floor(y0 / CHUNK_SIZE) - 1;
        const cy1 = Math.floor(y1 / CHUNK_SIZE) + 1;
        const cz0 = Math.floor(z0 / CHUNK_SIZE) - 1;
        const cz1 = Math.floor(z1 / CHUNK_SIZE) + 1;

        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (c) this.markDirty(c);
            }
        this.water.waken(x0, x1, z0, z1);
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
        const px = this.playerPos.x, py = this.playerPos.y, pz = this.playerPos.z;

        // Sort the queue by distance to the player once, then rebuild in that
        // order. The old code re-scanned the whole queue for every chunk it
        // rebuilt (O(n^2)) just to pick the nearest one each time.
        if (this.dirty.length > 1) {
          const d2 = (c) => {
            const dx = c.ox + 8 - px, dy = c.oy + 8 - py, dz = c.oz + 8 - pz;
            return dx * dx + dy * dy + dz * dz;
          };
          // Farthest first, so popping off the end yields the nearest next.
          this.dirty.sort((a, b) => d2(b) - d2(a));
        }

        while (this.dirty.length > 0 && performance.now() - t0 < budgetMs) {
          const c = this.dirty.pop();
          c.queued = false;
          if (!c.dead) c.rebuild();
        }
      }


      mine(x, y, z, r) {
        const box = this.field.mineSphere(x, y, z, r);
        this.markRegionDirty(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1);
      }

      place(x, y, z, r) {
        const box = this.field.addSphere(x, y, z, r);
        this.markRegionDirty(box.x0, box.x1, box.y0, box.y1, box.z0, box.z1);
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
        for (let cx = cx0; cx <= cx1; cx++)
          for (let cy = cy0; cy <= cy1; cy++)
            for (let cz = cz0; cz <= cz1; cz++) {
              const c = this.getChunk(cx, cy, cz);
              if (!c) continue;
              if (c.queued) {
                c.queued = false;
                const di = this.dirty.indexOf(c);
                if (di >= 0) {
                  this.dirty[di] = this.dirty[this.dirty.length - 1];
                  this.dirty.pop();
                }
              }
              c.rebuild();
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


      save(player) {
        try {
          const arr = [];
          for (const [k, v] of this.field.edits) arr.push(k, Math.round(v * 1000) / 1000);
          const data = {
            seed: WORLD_SEED,
            edits: arr,
            player: [player.pos.x, player.pos.y, player.pos.z, player.yaw, player.pitch],
            inv: { hot: inv.hot, main: inv.main, sel: inv.sel, dose: Math.round(inv.dose * 10) / 10, armor: inv.armor },
            vitals: { hp: vitals.hp, hunger: vitals.hunger, wounds: vitals.wounds, immunity: vitals.infectionImmunity },
            day: clock.day, dayT: +clock.t.toFixed(1),
            playTime: +playTime.toFixed(1),
            guide: GUIDE_STEPS[guideIndex]?.id ?? null,
            achievements: ach,
            timeLock: timeLock !== null,
            machines: machineSystem ? machineSystem.serialize() : [],
            pipes: pipeSystem ? pipeSystem.serialize() : [],
            buildings: buildingSystem ? buildingSystem.serialize() : [],
            map: mapSystem ? mapSystem.serialize() : null,
            torches: torches.map(t => [
              Math.round(t.pos.x * 100) / 100, Math.round(t.pos.y * 100) / 100, Math.round(t.pos.z * 100) / 100,
              Math.round((t.pos.x - t.ax) * 100) / 100, Math.round((t.pos.y - t.ay) * 100) / 100, Math.round((t.pos.z - t.az) * 100) / 100,
              t.id,
            ]),
          };
          localStorage.setItem(SAVE_KEY, JSON.stringify(data));
          return true;
        } catch (e) {
          console.warn('save failed', e);
          return false;
        }
      }

      load() {
        try {
          const raw = localStorage.getItem(SAVE_KEY);
          if (!raw) return null;
          const data = JSON.parse(raw);
          if (!data || !Array.isArray(data.edits)) return null;
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
            for (const t of Object.keys(WOUNDS)) {
              if (data.vitals.wounds && Number.isFinite(data.vitals.wounds[t])) vitals.wounds[t] = Math.max(0, data.vitals.wounds[t]);
            }
          }
          if (Number.isInteger(data.day) && data.day > 0) clock.day = data.day;
          if (Number.isFinite(data.dayT)) clock.t = Math.max(0, Math.min(900, data.dayT));
          if (data.timeLock === true) {
            timeLock = TUNING.DAY_SECONDS * 0.25;
            clock.t = timeLock;
          }
          if (Array.isArray(data.torches)) {
            for (const t of data.torches) {
              if (Array.isArray(t) && t.length >= 6 && t.slice(0, 6).every(Number.isFinite)) {
                addTorch(t[0], t[1], t[2], t[3], t[4], t[5], t[6] || 'torch');
              }
            }
          }
          return data;
        } catch (e) {
          console.warn('load failed', e);
          return null;
        }
      }
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
          shader.uniforms.uHazeColor = { value: new THREE.Color(0x9ec9e8) };
          shader.uniforms.uHazeStart = { value: DETAIL_CHUNK_RADIUS * CHUNK_SIZE };
          shader.uniforms.uHazeDensity = { value: 0 };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec4 aFarSurf; varying vec4 vFarSurf; varying vec3 vFarPos; varying vec3 vFarNormal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFarPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFarNormal = normalize(mat3(modelMatrix) * objectNormal);');
          shader.vertexShader = shader.vertexShader.replace('#include <fog_vertex>', '#include <fog_vertex>\nvFarSurf = aFarSurf;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
            uniform sampler2D farGrassMap; uniform sampler2D farSandMap; uniform sampler2D farDryMap;
            uniform sampler2D farSnowMap; uniform sampler2D farAshMap; uniform sampler2D farStoneMap;
            uniform vec3 uHazeColor; uniform float uHazeStart; uniform float uHazeDensity;
            varying vec4 vFarSurf; varying vec3 vFarPos; varying vec3 vFarNormal;
            vec3 farTri(sampler2D m, vec3 p, vec3 n, float s) {
              vec3 w = pow(abs(n), vec3(4.0)); w /= w.x + w.y + w.z;
              return texture2D(m, p.zy * s).rgb * w.x + texture2D(m, p.xz * s).rgb * w.y + texture2D(m, p.xy * s).rgb * w.z;
            }`)
            .replace('#include <map_fragment>', `#include <map_fragment>
            vec3 farN = normalize(vFarNormal);
            vec3 farGrass = farTri(farGrassMap, vFarPos, farN, 0.4);
            vec3 farTop = farGrass * max(0.0, 1.0 - dot(vFarSurf, vec4(1.0)))
              + farTri(farSandMap, vFarPos, farN, 0.30) * vFarSurf.x
              + farTri(farDryMap, vFarPos, farN, 0.40) * vFarSurf.y
              + farTri(farSnowMap, vFarPos, farN, 0.22) * vFarSurf.z
              + farTri(farAshMap, vFarPos, farN, 0.35) * vFarSurf.w;
            vec3 farStone = farTri(farStoneMap, vFarPos, farN, 0.08);
            diffuseColor.rgb = mix(farTop, farStone, step(50.0, vFarPos.y));`)
            // Own distance haze: the far rings fade into the sky exactly at the
            // outer edge of the outermost ring, so its border is never visible.
            .replace('#include <fog_fragment>', `
            float hazeD = distance(cameraPosition, vFarPos);
            float hazeF = 1.0 - exp(-pow(max(0.0, hazeD - uHazeStart) * uHazeDensity, 2.0));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeColor, hazeF);`);
        };
        this.meshes = [];
        this.centerKey = '';
        this.token = 0;
      }

      disposeMeshes(meshes = this.meshes) {
        for (const mesh of meshes) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
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

        if (!steps.length) {
          this.disposeMeshes();
          this.meshes = [];
          progress(1);
          return;
        }

        const side = 64;
        const row = side + 1;
        const vertexCount = row * row;
        const totalSamples = steps.length * vertexCount;
        let sampled = 0;
        let batch = 0;
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

        for (let level = 0; level < steps.length; level++) {
          const step = steps[level];
          const innerCells = level === 0 ? 5 : 8;
          const positions = new Float32Array(vertexCount * 3);
          const uvs = new Float32Array(vertexCount * 2);
          const farSurf = new Float32Array(vertexCount * 4);
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
                for (const biome of biomeWeights(wx + WORLD_SEED, wz + WORLD_SEED)) {
                  const surf = BIOME_DEFS[biome.id].surf;
                  const channel = surf === 'sand' ? 0 : surf === 'dry' ? 1 : surf === 'snow' ? 2 : surf === 'ash' ? 3 : -1;
                  if (channel >= 0) farSurf[i * 4 + channel] += biome.w;
                }
                const baseY = terrainTrend(wx + WORLD_SEED, wz + WORLD_SEED);
                const pad = level === 0 ? industrialPadAt(wx, wz) : null;
                const terrainY = pad ? baseY + (pad.site.y0 - baseY) * pad.w : baseY;
                const edgeDistance = Math.max(Math.abs(x - side / 2), Math.abs(z - side / 2)) - innerCells;
                let y = terrainY - 6;
                if (level === 0 && edgeDistance <= 2) {
                  const actualY = this.world.surfaceY(wx, wz, Math.ceil(terrainY + 16));
                  const t = Math.max(0, Math.min(1, edgeDistance / 2));
                  const blend = t * t * (3 - 2 * t);
                  y = actualY + (terrainY - 6 - actualY) * blend;
                }
                positions[i * 3 + 1] = y;
              }
              sampled++;
              if (++batch >= 256) {
                batch = 0;
                progress((sampled - batch) / totalSamples);
                await nextFrame();
                if (token !== this.token) {
                  this.disposeMeshes(nextMeshes);
                  return;
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
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, this.material);
          mesh.position.set(centerX, 0, centerZ);
          mesh.frustumCulled = true;
          nextMeshes.push(mesh);
        }

        if (token !== this.token) {
          this.disposeMeshes(nextMeshes);
          return;
        }
        for (const mesh of nextMeshes) this.scene.add(mesh);
        this.disposeMeshes();
        this.meshes = nextMeshes;
        progress(1);
      }

      update(px, pz) {
        const radius = viewRadius * CHUNK_SIZE;
        const steps = radius > DETAIL_CHUNK_RADIUS * CHUNK_SIZE ? this.ringSteps(radius) : [];
        // Outer edge of the outermost ring: the haze is scaled to it, so the far
        // terrain dissolves into the sky exactly where it stops.
        this.outer = steps.length ? steps[steps.length - 1] * 32 : 0;
        const centerX = Math.floor(px / CHUNK_SIZE) * CHUNK_SIZE;
        const centerZ = Math.floor(pz / CHUNK_SIZE) * CHUNK_SIZE;
        const key = `${centerX},${centerZ},${steps.join(':')}`;
        if (key !== this.centerKey) this.rebuild(px, pz).catch((e) => console.warn('far terrain build failed', e));
      }

      // Fade the rings into the sky. The haze is complete at `visFar` (the outer
      // ring edge or the camera's far plane, whichever comes first), so the fake
      // terrain has no visible border.
      setHaze(visFar) {
        if (!this.shader) return;
        this.shader.uniforms.uHazeColor.value.copy(this.scene.fog.color);
        this.shader.uniforms.uHazeDensity.value = visFar > 0 ? FAR_HAZE_REACH / visFar : 0;
      }

      async prewarm(px, pz, progress = () => {}) {
        await this.rebuild(px, pz, progress);
      }
    }


    class Walker {
      constructor(world, x, z) {
        this.world = world;
        this.speed = 3.2;

        const y = world.getSurfaceHeight(x, z);
        this.pos = new THREE.Vector3(x, y, z);

        const geo = new THREE.SphereGeometry(0.55, 12, 10);
        const mat = new THREE.MeshLambertMaterial({ color: 0xff5f7a, emissive: 0x330011 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.pos);
        this.mesh.position.y += 0.55;
        world.scene.add(this.mesh);

        this.stuckTimer = 0;
      }

      update(dt, playerPos) {
        const dx = playerPos.x - this.pos.x;
        const dz = playerPos.z - this.pos.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.8) {
          const nx = dx / dist;
          const nz = dz / dist;


          let moved = this.tryStep(nx, nz, dt);


          if (!moved) {
            const angles = [0.6, -0.6, 1.2, -1.2];
            for (const a of angles) {
              const ca = Math.cos(a), sa = Math.sin(a);
              const rx = nx * ca - nz * sa;
              const rz = nx * sa + nz * ca;
              if (this.tryStep(rx, rz, dt)) { moved = true; break; }
            }
          }

          if (!moved) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 1.2) {

              this.pos.y += 0.35;
              this.stuckTimer = 0;
            }
          } else {
            this.stuckTimer = 0;
          }
        }


        const ground = this.world.getSurfaceHeight(this.pos.x, this.pos.z, this.pos.y + 4);
        this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 12);

        this.mesh.position.copy(this.pos);
        this.mesh.position.y += 0.55;
      }

      tryStep(nx, nz, dt) {
        const step = this.speed * dt;
        const tx = this.pos.x + nx * step;
        const tz = this.pos.z + nz * step;
        const ground = this.world.getSurfaceHeight(tx, tz, this.pos.y + 3);

        if (Math.abs(ground - this.pos.y) > 1.6) return false;
        if (!this.world.isWalkable(tx, ground, tz, 0.4, 1.6, 1.6)) return false;

        this.pos.x = tx;
        this.pos.z = tz;
        return true;
      }

      dispose() {
        this.world.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
      }
    }







    const WRAPPER = {
      url: 'assets/models/enemies/wrapper.glb',
      scale: 0.01,
      speedWalk: 1.8,
      speedRun: 4.3,
      attackRange: 2.2,
      hp: 120,
      despawn: 96,
    };
    let wrapperTemplate = null;

    class Wrapper extends Walker {
      constructor(world, x, z, tpl) {
        super(world, x, z);
        world.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

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
        this.speed = WRAPPER.speedWalk;
        this.pos.y = world.getSurfaceHeight(x, z);
        this.mesh = this.root;
        world.scene.add(this.mesh);
        this.play('walk', 0);
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
          this.speed = WRAPPER.speedRun;
          this.play('run', 0.2);
        } else {
          this.speed = WRAPPER.speedWalk;
          this.play('walk', 0.3);
        }


        this.screamCd -= dt;
        if (this.screamCd <= 0) {
          this.screamCd = 14 + Math.random() * 16;
          if (d > 12) this.play('scream', 0.2);
        }

        super.update(dt, playerPos);
        this.mesh.position.y = this.pos.y;


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





    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });

    let PIXEL = getSetting('resolution');
    renderer.setPixelRatio(1);
    let postTarget = null;
    function applyPixelSize() {
      const w = Math.ceil(innerWidth / PIXEL), h = Math.ceil(innerHeight / PIXEL);
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
        uTime: { value: 0 },
      },
      vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse; uniform float uLevels;
    uniform float uRadBlur; uniform float uRadDark; uniform float uTime;
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
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        return;
      }
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c += (bayer(gl_FragCoord.xy) - 0.5) * (1.5 / uLevels); // 1.5 LSB dither kills banding
      c = floor(c * uLevels + 0.5) / uLevels;
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

    const flashlightLight = new THREE.SpotLight(0xf4f9ff, 0, 90, Math.PI / 7, 0.2, 2.0);
    flashlightLight.position.set(0.18, -0.18, -0.12);
    flashlightLight.target.position.set(0, 0, -16);
    flashlightLight.castShadow = true;
    flashlightLight.shadow.mapSize.set(1024, 1024);
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


    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(14, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false, transparent: true, opacity: 0.95 })
    );
    scene.add(sunDisc);
    const sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, transparent: true, opacity: 0.25, depthWrite: false })
    );
    scene.add(sunGlow);



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


    const BARE_HANDS = { radius: 1.1, rate: 0.6, yield: 1, good: ['dirt', 'grass', 'stone'] };

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





    const ICON_CACHE_KEY = 'idte.icon.v7.';
    const modelIconCache = new Map();


    function loadModelIcon(id) {
      if (modelIconCache.has(id)) return modelIconCache.get(id);
      let url = null;
      try { url = localStorage.getItem(ICON_CACHE_KEY + id); } catch {                          }
      modelIconCache.set(id, url);
      return url;
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
          try { localStorage.setItem(ICON_CACHE_KEY + id, url); } catch {                                    }
          if (i % 4 === 0) syncBars();
        }).catch(() => {

          modelIconCache.set(id, '');
          try { localStorage.setItem(ICON_CACHE_KEY + id, ''); } catch {                   }
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
    if (!localStorage.getItem(SAVE_KEY)) {
      inv.hot[0] = { id: 'flashlight', n: 1 };
    }



    const vitals = {
      hp: 100, maxHp: 100, hunger: 100, maxHunger: 100,
      wounds: Object.create(null), infectionImmunity: 0,
    };
    const WOUNDS = {
      bleeding: { name: 'BLEEDING', dps: 1.1, color: '#e2453c' },
      infection: { name: 'INFECTION', dps: 0.35, color: '#9acd32' },
      burn: { name: 'BURNS', dps: 0.5, color: '#f08a24' },
      poison: { name: 'POISON', dps: 0.7, color: '#7fbf3f' },
      pain: { name: 'PAIN', speed: 0.88, color: '#c79bff' },
      eye: { name: 'EYE IRRITATION', blur: 0.45, color: '#7ec8ff' },
      respiratory: { name: 'RESPIRATORY', dps: 0.6, color: '#8fd6e8' },
      bloodloss: { name: 'BLOOD LOSS', dps: 0.9, speed: 0.82, color: '#d23b3b' },
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
        return;
      }

      vitals.hunger = Math.max(0, vitals.hunger - TUNING.HUNGER_DRAIN * dt);
      if (vitals.infectionImmunity > 0) vitals.infectionImmunity = Math.max(0, vitals.infectionImmunity - dt);

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


    function giveStack(stack) {
      if (!stack || !stack.id) return false;
      for (const g of [inv.hot, inv.main]) {
        for (let i = 0; i < g.length; i++) if (!g[i]) { g[i] = stack; syncBars(); return true; }
      }
      return false;
    }







    const clock = { day: 1, t: 0 };
    let playTime = 0;
    let guideIndex = 0;
    let guidePaintSig = '';
    let guideTick = 0;

    function freshAchievements() {
      return {
        mined: 0, placed: 0, crafted: 0, machines: 0, kills: 0,
        dosePeak: 0, research: 0, fuel: 0, walked: 0,
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

    // Ambient pressure starts gently on RAD_START_DAY and scales continuously,
    // so the meter moves from the first day instead of waiting for a tier jump.
    function ambientRad() {
      const tiers = Math.max(0, clock.day - TUNING.RAD_START_DAY + 1) / TUNING.RAD_RAMP_DAY;
      return tiers <= 0 ? 0 : TUNING.AMBIENT_BASE * Math.pow(tiers, TUNING.AMBIENT_EXP);
    }
    // Radiation has a direction. The ambient field comes from the world's
    // fallout spot and machines radiate from their own block, so solid ground
    // between the player and that direction absorbs part of the dose.
    function radSource() {
      return sourcePoint(WORLD_SEED, TUNING.RAD_SOURCE_DIST);
    }
    function radFactor(x, y, z) {
      return solidAt(world.field, x, y, z) ? RAD_OCCL.solid : 1;
    }
    // Near-field shadow march toward a source: 1 = clear line, ~0.2 = buried.
    // Walls are shadowed separately: the point march would step straight over a
    // 25 cm panel, so the building system attenuates by material thickness.
    function radTransmission(dx, dy, dz) {
      if (!world) return 1;
      const t = transmission(radFactor, player.pos.x, player.pos.y + 1, player.pos.z, dx, dy, dz);
      const w = buildingSystem ? buildingSystem.shadow(player.pos.x, player.pos.y + 1, player.pos.z, dx, dy, dz, RAD_OCCL.range) : 1;
      return Math.max(TUNING.RAD_OCCL_FLOOR, t * w);
    }

    // Ambient and machine radiation, split so the scrubber only cuts ambient.
    // Cached briefly: the field only has to keep up with the HUD.
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
      const ambient = ambientRad() * radTransmission(dx, 0, 0);

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
      _radField = { ambient, machine, dx: bx, dz: bz, dist: bdist };
      return _radField;
    }

    function radStage() {
      let stage = { name: 'SAFE', speed: 1, blur: 0, dark: 0 };
      for (const s of TUNING.RAD_STAGES) if (inv.dose >= s.at) stage = s;
      return stage;
    }
    function isDay() { return clock.t < TUNING.DAY_SECONDS * 0.5; }


    const DAY_SKY = new THREE.Color(0x9ec9e8);
    const DUSK_SKY = new THREE.Color(0xd97a48);
    const NIGHT_SKY = new THREE.Color(0x070b17);
    const skyNow = new THREE.Color(DAY_SKY);
    let sunVis = 1;

    function updateDaylight() {
      const f = (clock.t % TUNING.DAY_SECONDS) / TUNING.DAY_SECONDS;
      const a = f * Math.PI * 2;
      const elev = Math.sin(a);
      SUN_DIR.set(Math.cos(a) * 0.82, elev, 0.38 + Math.cos(a) * 0.22).normalize();

      const day = Math.max(0, Math.min(1, elev * 2.2 + 0.12));
      const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (elev > -0.25 ? 1 : 0);

      skyNow.copy(NIGHT_SKY).lerp(DAY_SKY, day).lerp(DUSK_SKY, dusk * 0.5);
      sun.intensity = 1.35 * day;
      sun.color.copy(SUN_COL).lerp(DUSK_SKY, dusk * 0.6);
      sunDisc.material.color.copy(sun.color);
      hemi.intensity = 0.22 + 0.53 * day;
      hemi.color.copy(NIGHT_SKY).lerp(SKY_COL, day);
      fill.intensity = 0.10 + 0.08 * day;
      cloudUniforms.uDay.value = day;
      sunVis = Math.max(0, Math.min(1, elev * 8 + 0.15));
    }


    let noticeMsg = '', noticeT = 0;
    function notice(msg) { noticeMsg = msg; noticeT = 1.8; }
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
          }
        }
      for (const g of grids)
        for (let i = 0; i < g.length && n > 0; i++) {
          if (!g[i]) {
            const take = Math.min(n, def.stack);
            g[i] = { id, n: take }; n -= take;
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
      axe:     { dir: 'assets/models/tools/axe/',     obj: 'Axe',     len: 1.00, swing: { toX: -9, dur: 0.5 } },
      hatchet: { dir: 'assets/models/tools/hatchet/', obj: 'Hatchet', len: 0.82, swing: { x: 0.35, y: 0.90, z: 0.55, reach: 0.05 } },
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

    // Items without a 3D model are still held: a flat icon shown low and centre,
    // as if carried in both hands. It bobs with movement but never spins.
    const vmHeld = new THREE.Group();
    vmHeld.visible = false;
    vmRig.add(vmHeld);
    const heldIconGeo = new THREE.PlaneGeometry(1, 1);
    const heldIconTex = new Map();
    const heldIconMesh = new THREE.Mesh(heldIconGeo, new THREE.MeshBasicMaterial({
      transparent: true, alphaTest: 0.05, depthWrite: false, side: THREE.DoubleSide,
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
        heldIconMesh.material.map = tex;
        heldIconMesh.material.needsUpdate = true;
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
      // The icon renderer already probes the model file; if it cached a miss,
      // skip another failed GLB request and go straight to the hand icon.
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
        treeChopSound.volume = 0.75;
      }
      try {
        treeChopSound.currentTime = 0;
        treeChopSound.play().catch(() => {});
      } catch (e) {
        // Audio can fail on some browsers before user interaction; ignore quietly.
      }
    }

    function triggerSwing(dur) {
      const cfg = (TOOL_MODELS[vm.item] || {}).swing;
      vm.swingDur = (cfg && cfg.dur) || THREE.MathUtils.clamp(dur || 0.3, 0.22, 0.6);
      vm.swingT = 0;
    }

    function heldFlashlight() {
      const s = inv.hot[inv.sel];
      return !!(s && ITEMS[s.id]?.tool?.flashlight && !invOpen && !workbenchUI.opened && locked);
    }

    function updateViewmodel(dt) {
      if (drink) { updateDrink(dt); return; }

      const s = inv.hot[inv.sel];
      const held = s ? s.id : null;
      vmHeld.visible = false;
      flashlightLight.visible = heldFlashlight();
      if (flashlightLight.visible) {
        flashlightLight.intensity = 18;
        flashlightLight.distance = 90;
        flashlightLight.angle = Math.PI / 7;
        flashlightLight.penumbra = 0.18;
      }

      if (held && propModelUrl(held)) {
        if (propItem !== held) { propItem = held; loadPropModel(held); }
        if (vm.model) { vm.model.visible = false; vm.model = null; vm.item = null; }
        const show = !invOpen && !workbenchUI.opened && locked;
        vmRig.visible = show;
        if (!show) return;
        for (const m of propModels.values()) m.visible = false;
        const model = propModels.get(held);
        if (!model) {
          // Still loading, or this item has no model file: hold its icon instead.
          vmRig.position.set(0, 0, 0);
          vmRig.rotation.set(0, 0, 0);
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
        vmRig.position.set(0, 0, 0);
        vmRig.rotation.set(0, 0, 0);
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

      vmRig.visible = !!vm.model && !invOpen && !workbenchUI.opened && locked;
      if (!vm.model) {
        if (s && ITEMS[s.id] && !TOOL_MODELS[s.id] && !invOpen && !workbenchUI.opened && locked) {
          vmRig.visible = true;
          vmRig.position.set(0, 0, 0);
          vmRig.rotation.set(0, 0, 0);
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


      let equipDrop = 0, equipRot = 0;
      if (vm.equipT < 1e8) {
        vm.equipT += dt / 0.30;
        const e = Math.min(1, vm.equipT);
        const c1 = 1.70158, c3 = c1 + 1;
        const ease = 1 + c3 * Math.pow(e - 1, 3) + c1 * Math.pow(e - 1, 2);
        equipDrop = -(1 - ease) * 0.42;
        equipRot = -(1 - ease) * 0.7;
        if (e >= 1) vm.equipT = 1e9;
      }


      const swingCfg = (TOOL_MODELS[vm.item] || {}).swing || { x: 0.62, y: 0.10, z: 0.07, reach: 0.10 };
      const poseGrp = vm.model.userData.poseGrp;
      const restRotX = poseGrp ? poseGrp.userData.restRotX : 0;
      let lift = 0, lag = 0, reach = 0, poseX = null;
      if (vm.swingT < 1e8) {
        vm.swingT += dt;
        const p = vm.swingT / vm.swingDur;
        if (p >= 1) vm.swingT = 1e9;
        else if (swingCfg.toX != null && poseGrp) {

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
    const DEFAULT_LIGHT = { mount: 'wall', range: 12, power: 1.2, color: 0xff9d1f };
    const torchStickGeo = new THREE.BoxGeometry(0.09, 0.5, 0.09);
    const torchStickMat = new THREE.MeshLambertMaterial({ color: 0x4a2f18 });
    const torchFlameGeo = new THREE.SphereGeometry(0.11, 8, 6);
    const torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xff9d1f });
    let torchTemplate = null;
    const torchUniforms = {
      torchTime: { value: 0 },
    };
    const rgbOf = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];





    const MACHINE_LIGHT_SLOTS = 8;
    const machineLightPos = Array.from({ length: MACHINE_LIGHT_SLOTS }, () => new THREE.Vector3(0, -999, 0));
    const machineLightCol = Array.from({ length: MACHINE_LIGHT_SLOTS }, () => new THREE.Vector3());
    function patchMachineMaterial(mat) {
      if (!mat || mat.isShaderMaterial || mat.userData.machineLit) return;
      mat.userData.machineLit = true;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uMLPos = { value: machineLightPos };
        shader.uniforms.uMLCol = { value: machineLightCol };
        shader.vertexShader = `varying vec3 vMLWorld;\n` + shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vMLWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
        shader.fragmentShader = `varying vec3 vMLWorld;
          uniform vec3 uMLPos[${MACHINE_LIGHT_SLOTS}];
          uniform vec3 uMLCol[${MACHINE_LIGHT_SLOTS}];
        ` + shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          for (int i = 0; i < ${MACHINE_LIGHT_SLOTS}; i++) {
            float mld = distance(vMLWorld, uMLPos[i]);
            totalEmissiveRadiance += uMLCol[i] / (1.0 + 0.5 * mld + 0.12 * mld * mld);
          }`
        );
      };
      mat.customProgramCacheKey = () => 'machine-light-v1';
      mat.needsUpdate = true;
    }





    const world = new World(scene);
    const farTerrain = new FarTerrainRenderer(scene, world.farBiomeTextures, world.stoneTexture, world);










    const VEG_DIR = 'assets/models/trees/';
    const _vegLoader = new GLTFLoader();
    const _fbxLoader = new FBXLoader();
    const _up = new THREE.Vector3(0, 1, 0);
    const _v = new THREE.Vector3(), _sc = new THREE.Vector3();
    const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();



    const VEG_LAYERS = {
      canopy: { cell: 6.0, size: 1.5, fill: { [B.FOREST]: 0.75, [B.JUNGLE]: 0.80, [B.PLAINS]: 0.16, [B.SAVANNA]: 0.16, [B.TUNDRA]: 0.28, [B.SNOWY_PEAKS]: 0.12, [B.WASTELAND]: 0.35 } },
      ground: { cell: 2.0, size: 1.0, fill: { [B.FOREST]: 0.62, [B.JUNGLE]: 0.60, [B.PLAINS]: 0.72, [B.SAVANNA]: 0.55, [B.TUNDRA]: 0.30, [B.SNOWY_PEAKS]: 0.10, [B.WASTELAND]: 0.30, [B.BEACH]: 0.05 } },
      cover: { cell: 3.0, size: 1.2, fill: { [B.FOREST]: 0.55, [B.JUNGLE]: 0.60, [B.PLAINS]: 0.38, [B.SAVANNA]: 0.26, [B.TUNDRA]: 0.30, [B.SNOWY_PEAKS]: 0.14, [B.WASTELAND]: 0.08 } },
      floor: { cell: 2.0, size: 1.0, fill: { [B.FOREST]: 0.50, [B.PLAINS]: 0.32, [B.JUNGLE]: 0.46, [B.SAVANNA]: 0.30, [B.TUNDRA]: 0.24 } },
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
    ];


    // Trees stay visible across almost the full 6-chunk detailed terrain radius.
    // Low vegetation keeps its shorter range so it does not add distant clutter.
    for (const sp of VEG_SPECIES) {
      sp.dist = sp.layer === 'canopy' ? 100 : Math.min(sp.dist, 52);
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


    function vegCell(layer, gx, gz) {
      const cell = VEG_LAYERS[layer].cell;
      const x = (gx + 0.12 + 0.76 * _vegHash(gx, gz, 1)) * cell;
      const z = (gz + 0.12 + 0.76 * _vegHash(gx, gz, 2)) * cell;
      const b = biomeAt(x, z);
      const fill = VEG_LAYERS[layer].fill[b];
      if (!fill || _vegHash(gx, gz, 3) >= fill) return null;
      const cand = [];
      for (const sp of VEG_SPECIES) {
        if (sp.layer !== layer) continue;
        const w = sp.weights[b];
        if (w) cand.push({ s: sp, w });
      }
      if (!cand.length) return null;
      const sp = _pickWeighted(cand, _vegHash(gx, gz, 4));
      return {
        sp, x, z, b,
        scale: (sp.scale[0] + (sp.scale[1] - sp.scale[0]) * _vegHash(gx, gz, 5)) * VEG_LAYERS[layer].size,
        yaw: _vegHash(gx, gz, 6) * Math.PI * 2,
        gx, gz,
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

        if (caveCarveAt(pl.x + WORLD_SEED, y + 0.4, pl.z + WORLD_SEED) > 0.02) return null;
        if ((sp.layer === 'canopy' || sp.layer === 'ground' || sp.layer === 'cover' || sp.layer === 'floor') && groundDepth(pl.x, y, pl.z) >= 1.2) return null;
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



    async function loadCardModel(sp) {
      const tex = await new THREE.TextureLoader().loadAsync(sp.tex);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const w = tex.image.width / tex.image.height;
      const pos = [], nor = [], uv = [], idx = [];
      const planes = [
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
      geo.setIndex(idx);
      const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide });

      const cell = VEG_LAYERS[sp.layer].cell;
      const cap = Math.min(900, Math.ceil(Math.PI * sp.dist * sp.dist / (cell * cell)) + 16);
      const group = new THREE.Group();
      group.name = 'veg:' + sp.n;
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      scene.add(group);

      sp.parts = [{ mesh }];
      sp.cap = cap;
      sp.trunkR = 0;
      sp.placements = new Map();
      sp.ready = true;
      _vegGX = NaN;
      return sp;
    }

    async function loadVegModel(sp) {
      if (sp.tex) return loadCardModel(sp);
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


      let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxz = -Infinity;
      for (const p of parts) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i] < mnx) mnx = a[i]; if (a[i] > mxx) mxx = a[i];
          if (a[i + 1] < mny) mny = a[i + 1];
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


      let trunkR = 0;
      for (const p of parts) {
        const a = p.geo.attributes.position.array;
        for (let i = 0; i < a.length; i += 3) {
          if (a[i + 1] <= band) trunkR = Math.max(trunkR, Math.hypot(a[i] - cx, a[i + 2] - cz));
        }
      }
      for (const p of parts) p.geo.translate(-cx, -mny, -cz);

      const cell = VEG_LAYERS[sp.layer].cell;
      const cap = Math.min(900, Math.ceil(Math.PI * sp.dist * sp.dist / (cell * cell)) + 16);
      const group = new THREE.Group();
      group.name = 'veg:' + sp.n;
      const built = parts.map((p) => {
        const mesh = new THREE.InstancedMesh(p.geo, p.mat, cap);
        mesh.count = 0;
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
    let starterContainerSpawned = false;

    function spawnStarterContainerNearPlayer(x, z) {
      if (starterContainerSpawned || !Number.isFinite(x) || !Number.isFinite(z)) return;
      const baseX = x + 8;
      const baseZ = z + 6;
      const y0 = world.getSurfaceHeight(baseX, baseZ, 50);
      const pack = [
        { id: 'pick', n: 1 },
        { id: 'wood', n: 2 },
        { id: 'carbon', n: 3 },
      ];
      const t = _indTemplates.get('container_01');
      if (!t) return;
      const inst = t.clone(true);
      inst.position.set(baseX, y0 + 0.02, baseZ);
      inst.rotation.y = 0;
      inst.scale.setScalar(0.75);
      scene.add(inst);
      addOutlineToMesh(inst, 1.04, 0xffffff);
      const machine = {
        x: baseX,
        y: y0 + 1.5,
        z: baseZ,
        radius: 6.0,
        label: 'OPEN CONTAINER',
        mesh: inst,
        activate() {
          if (machine._opened) return;
          machine._opened = true;
          const dir = new THREE.Vector3(1, 0, 0);
          for (let i = 0; i < pack.length; i++) {
            const item = pack[i];
            const left = give(item.id, item.n);
            if (left > 0) {
              const outX = baseX + dir.x * (2.4 + i * 0.7);
              const outZ = baseZ + dir.z * (2.4 + i * 0.7);
              const outY = world.getSurfaceHeight(outX, outZ, 12) + 0.5;
              spawnDrop(item.id, left, { x: outX, y: outY, z: outZ });
            }
          }
          notice('STARTER CONTAINER OPENED');
          const root = inst.userData.outlineRoot;
          if (root && root.parent) root.parent.remove(root);
          const rIdx = outlineTargets.indexOf(root);
          if (rIdx >= 0) outlineTargets.splice(rIdx, 1);
          const idx = machineActivators.indexOf(machine);
          if (idx >= 0) machineActivators.splice(idx, 1);
          scene.remove(inst);
        }
      };
      machineActivators.push(machine);
      starterContainerSpawned = true;
    }

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
              kind: 'box', x, z, top,
              hx: (swap ? dim.hz : dim.hx) * s,
              hz: (swap ? dim.hx : dim.hz) * s,
            });
          }
        }
      }
    }

    const IND_MASK_KEY = 'idte.ind.masks.v1';

    function indMaskStore() {
      try { return JSON.parse(localStorage.getItem(IND_MASK_KEY)) || {}; } catch { return {}; }
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
      if (introBtnEl) { introBtnEl.textContent = 'ENTER THE ZONE'; introBtnEl.disabled = false; }
    })();
    {
      const pb = document.getElementById('playBtn');
      if (pb) { pb.disabled = true; pb.textContent = 'LOADING 0%'; }
    }

    const _vegActive = { canopy: new Map(), ground: new Map(), cover: new Map(), floor: new Map(), aquatic: new Map() };
    const _vegHarvested = new Set();
    const trunkColliders = [];
    let _vegGX = NaN, _vegGZ = NaN;

    const vegPerf = { stream: 0, inst: 0, trunks: 0, collide: 0, anim: 0, frames: 0 };

    const perf = { move: 0, jobs: 0, drops: 0, world: 0, water: 0, dirty: 0, wdirty: 0, entities: 0, render: 0, misc: 0 };

    function vegAdd(sp, key, pl) { if (!sp.ready) return; sp.placements.set(key, pl); sp.dirty = true; }
    function vegRemove(sp, key) { if (!sp.placements) return; sp.placements.delete(key); sp.dirty = true; }

    function vegSupportY(pl) {
      if (pl.sp.water === 'surface' || pl.sp.water === 'margin') {
        return world.surfaceAt(pl.x, pl.z);
      }
      const fromY = Math.ceil(terrainTrend(pl.x + WORLD_SEED, pl.z + WORLD_SEED)) + 12;
      return world.surfaceY(pl.x, pl.z, fromY);
    }





    const VEG_CHECK_STEP = 32;
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


      const phase = _vegCheckFrame++ % VEG_CHECK_STEP;
      let i = 0;
      for (const layer of ['canopy', 'ground', 'cover', 'floor', 'aquatic']) {
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

    function vegUpdateInstances(sp) {
      if (!sp.parts) return;
      let i = 0;
      for (const pl of sp.placements.values()) {
        if (i >= sp.cap) break;
        _v.set(pl.x, pl.y, pl.z);
        _sc.setScalar(pl.scale);
        _m.compose(_v, pl.q, _sc);
        for (const part of sp.parts) part.mesh.setMatrixAt(i, _m);
        i++;
      }
      for (const part of sp.parts) { part.mesh.count = i; part.mesh.instanceMatrix.needsUpdate = true; }
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

    function vegStream(px, pz) {
      const t0 = performance.now();
      for (const layer of ['canopy', 'ground', 'cover', 'floor', 'aquatic']) {
        const L = VEG_LAYERS[layer];
        let maxD = 0;
        for (const sp of VEG_SPECIES) if (sp.layer === layer) maxD = Math.max(maxD, sp.dist);
        const r = Math.ceil(maxD / L.cell);
        const ccx = Math.floor(px / L.cell), ccz = Math.floor(pz / L.cell);
        const active = _vegActive[layer];
        const keep = new Set();

        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const cx = ccx + dx, cz = ccz + dz;
            const dd = Math.hypot((cx + 0.5) * L.cell - px, (cz + 0.5) * L.cell - pz);
            if (dd > maxD + L.cell) continue;
            const key = cx + ',' + cz;
            keep.add(key);
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
              continue;
            }
            if (active.has(key)) continue;
            const pl = vegCell(layer, cx, cz);
            if (pl && !pl.sp.ready) continue;
            const rp = pl && dd <= pl.sp.dist ? vegResolve(pl) : null;


            if (!rp) { if (!pl || dd <= pl.sp.dist) active.set(key, null); continue; }
            active.set(key, rp);
            if (rp.sp.pickup) {
              const pickupKey = key + ':' + rp.sp.n;
              const pickup = worldPickups.find((p) => p.__vegKey === pickupKey);
              if (!pickup) {
                const p = registerPickup({
                  x: rp.x,
                  y: rp.y + 0.6,
                  z: rp.z,
                  itemId: rp.sp.pickup.itemId || 'flower',
                  count: rp.sp.pickup.count || 1,
                  radius: rp.sp.pickup.radius ? rp.sp.pickup.radius * 2 : Math.max(2.4, (rp.sp.scale?.[0] || 1) * 3.2),
                  label: rp.sp.pickup.label || `Pick ${rp.sp.pickup.itemId || 'flower'}`,
                });
                p.__vegKey = pickupKey;
                p.__vegCellKey = key;
                p.__vegLayer = layer;
              } else {
                pickup.x = rp.x;
                pickup.y = rp.y + 0.6;
                pickup.z = rp.z;
                pickup.__vegCellKey = key;
                pickup.__vegLayer = layer;
                pickup.mesh.position.set(pickup.x, pickup.y, pickup.z);
                if (pickup.mesh.userData.outlineRoot) pickup.mesh.userData.outlineRoot.position.copy(pickup.mesh.position);
              }
            }
            vegAdd(rp.sp, key, rp);
          }
        }
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

      const t1 = performance.now();
      vegRebuildTrunks();
      const t2 = performance.now();
      vegPerf.stream += t1 - t0;
      vegPerf.trunks += t2 - t1;
    }

    function vegUpdate(px, pz) {
      if (Number.isFinite(px) && Number.isFinite(pz)) {
        const gx = Math.floor(px / 2), gz = Math.floor(pz / 2);
        if (gx !== _vegGX || gz !== _vegGZ) {
          _vegGX = gx; _vegGZ = gz;
          vegStream(px, pz);
        }
      }


      const ti = performance.now();
      let budget = 6;
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
    let treeShakeAudio = null;

    function playTreeShakeSound() {
      if (!TREE_SHAKE_SOUND) return;
      try {
        if (!treeShakeAudio) {
          treeShakeAudio = new Audio(TREE_SHAKE_SOUND);
          treeShakeAudio.preload = 'auto';
          treeShakeAudio.volume = 0.5;
        }
        if (treeShakeAudio.paused) {
          treeShakeAudio.currentTime = 0;
          treeShakeAudio.play().catch(() => {});
        } else {
          treeShakeAudio.currentTime = 0;
          treeShakeAudio.play().catch(() => {});
        }
      } catch (e) {}
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

    const footsteps = createFootsteps();
    let stepAccum = 0;
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

    function makePickupMesh(itemId) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
      );
      mesh.visible = false;
      mesh.userData.itemId = itemId;
      addOutlineToMesh(mesh, 1.5, 0xffffff);
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
          give(itemId, count);

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
      machineActivators.push(machine);
      return machine;
    }

    function raySphereHit(origin, dir, center, radius) {
      const oc = origin.clone().sub(center);
      const b = oc.dot(dir);
      const c = oc.lengthSq() - radius * radius;
      const disc = b * b - c;
      if (disc < 0) return null;
      const sqrt = Math.sqrt(disc);
      const tA = -b - sqrt;
      const tB = -b + sqrt;
      const pos = [tA, tB].find((t) => Number.isFinite(t) && t >= 0.05);
      return pos === undefined ? null : pos;
    }

    function resolveInteractTarget() {
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const center = new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5);
      let best = null;
      let nearest = null;

      const scoreCandidate = (t) => {
        const hitPos = origin.clone().addScaledVector(dir, t);
        const screen = hitPos.clone().project(camera);
        const px = ((screen.x + 1) * 0.5) * innerWidth;
        const py = ((-screen.y + 1) * 0.5) * innerHeight;
        const screenDist = Math.hypot(px - center.x, py - center.y);
        return { screenDist, t, hitPos };
      };

      const choose = (candidate, record) => {
        if (!candidate) return record;
        if (!record) return candidate;
        if (candidate.screenDist < record.screenDist) return candidate;
        if (Math.abs(candidate.screenDist - record.screenDist) < 0.001 && candidate.t < record.t) return candidate;
        return record;
      };

      for (const pickup of worldPickups) {

        if (pickup.__vegLayer && !hasGardeningGloves()) continue;
        const t = raySphereHit(origin, dir, new THREE.Vector3(pickup.x, pickup.y, pickup.z), pickup.radius + 0.25);
        if (t === null || t > REACH) continue;
        const scored = scoreCandidate(t);
        nearest = choose({ ...scored, target: pickup, type: 'pickup', label: pickup.label, activate: () => pickup.activate() }, nearest);
        if (scored.screenDist <= 340) {
          best = choose({ ...scored, target: pickup, type: 'pickup', label: pickup.label, activate: () => pickup.activate() }, best);
        }
      }

      for (const machine of machineActivators) {
        const t = raySphereHit(origin, dir, new THREE.Vector3(machine.x, machine.y, machine.z), machine.radius);
        if (t === null || t > REACH) continue;
        const scored = scoreCandidate(t);
        nearest = choose({ ...scored, target: machine, type: 'machine', label: machine.label, activate: () => machine.activate() }, nearest);
        if (scored.screenDist <= 340) {
          best = choose({ ...scored, target: machine, type: 'machine', label: machine.label, activate: () => machine.activate() }, best);
        }
      }

      if (buildingSystem) {
        const origin2 = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir2 = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const hit2 = doorHit(origin2, dir2);
        if (hit2) {
          const scored = scoreCandidate(hit2.t);
          const door = hit2.piece;
          const cand = {
            ...scored, target: door, type: 'door', label: 'DOOR',
            activate: () => (handFreeForDoor() ? toggleDoor(door) : false),
          };
          nearest = choose(cand, nearest);
          if (scored.screenDist <= 340) best = choose(cand, best);
        }
      }

      return best || nearest;
    }

    function refreshInteractPrompt() {
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
      const target = resolveInteractTarget();
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
      // A door that could not be swung (the hand was not empty) must not
      // swallow the click.
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


    const saved = world.load();
    if (saved && Number.isFinite(saved.playTime)) playTime = Math.max(0, saved.playTime);
    if (saved && saved.guide !== undefined) {
      if (saved.guide === null) guideIndex = GUIDE_STEPS.length;
      else {
        const i = GUIDE_STEPS.findIndex((s) => s.id === saved.guide);
        if (i >= 0) guideIndex = i;
      }
    }
    if (saved && saved.achievements) loadAchievements(saved.achievements);
    if (saved && saved.player && saved.seed !== undefined) {
      WORLD_SEED = saved.seed;
      player.pos.set(saved.player[0], saved.player[1], saved.player[2]);
      player.yaw = saved.player[3] || 0;
      player.pitch = saved.player[4] || 0;
      if (!validSpawnPos(player.pos.x, player.pos.y, player.pos.z)) {
        spawnOnGround(saved.player[0], saved.player[2]);
      } else {
        for (let i = 0; i < 14 && world.field.sample(player.pos.x, player.pos.y + 0.5, player.pos.z) > 0; i++) {
          player.pos.y += 1;
        }
      }
      player.vel.set(0, 0, 0);
    } else {
      if (saved) world.field.edits.clear();
      spawnOnGround(0.5, 0.5);
    }

    industrialPreload.then(() => {
      spawnStarterContainerNearPlayer(player.pos.x, player.pos.z);
    });

    mapSystem = new MapSystem({
      player: () => ({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }),
      clock: () => ({ ...clock, daySeconds: TUNING.DAY_SECONDS }),
      seaLevel: SEA_LEVEL,
      sample: (x, z) => ({
        h: terrainTrend(x + WORLD_SEED, z + WORLD_SEED),
        biome: biomeAt(x, z),
      }),
      // Flat map colour: exposed mountain rock overrides the biome top colour.
      surfaceColor: (x, z, h) => (
        h - SEA_LEVEL > 30
          ? [0.33, 0.32, 0.36]
          : (BIOME_DEFS[biomeAt(x, z)]?.top || [0.4, 0.5, 0.3])
      ),
      industrialCell: IND_CELL,
      industrialDims: IND_DIMS,
      industrialSite,
      machines: () => (machineSystem ? machineSystem.instances : []),
      notice: (msg) => notice(msg),
      save: () => { if (!wipeSave) world.save(player); },
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
      THREE, scene, world, player, inv, ITEMS, give, giveStack,
      icon: (id) => itemIconUrl(id),
      onCraft: (id, n) => achCraft(id, n),
      showTip: (s, x, y) => showTip(s, x, y),
      hideTip: () => hideTip(),
      syncBars,
      bagRoomFor,
      notice: (msg) => notice(msg),
      mineDrops, groundBand,
      defs: MACHINE_DEFS, byId: MACHINE_BY_ID, craftRecipes: CRAFT_RECIPES, layoutFor,
      GLTFLoader, registerMachine, machineActivators, patchMachineMaterial,
      ui: workbenchUI,
      isDay,
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
    }).catch((e) => console.warn('machine load failed', e));

    const pipeSystem = new PipeSystem({ THREE, scene, GLTFLoader, give });
    pipeSystem.load().then(() => {
      if (saved && saved.pipes) pipeSystem.restore(saved.pipes);
    }).catch((e) => console.warn('pipe load failed', e));

    const buildingSystem = new BuildingSystem({ THREE, scene, give, world });
    buildingSystem.load();
    if (saved && saved.buildings) buildingSystem.restore(saved.buildings);

    window.NUCLEARISM = { ITEMS, inv, vitals, hurt, addWound, clock, get machineSystem() { return machineSystem; }, get pipeSystem() { return pipeSystem; }, get mapSystem() { return mapSystem; }, get buildingSystem() { return buildingSystem; }, get player() { return player; }, get camera() { return camera; }, give, giveStack, Liquid, LIQUIDS: LIQUID_DEFS, caveAt: (x, y, z) => caveCarveAt(x + WORLD_SEED, y, z + WORLD_SEED) };





    const keys = Object.create(null);
    let locked = false;
    // Browsers emit a synthetic mousemove with a huge movement delta when
    // pointer lock is entered or exited. Swallow look input briefly around
    // every transition so the camera never snaps to a random angle.
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

    // The pause overlay fades instead of popping; hiding it is delayed by the
    // fade length so it is still visible while it dissolves.
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

    function markIntroSeen() {
      try { localStorage.setItem(introSeenKey(), '1'); } catch (e) { }
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
      setOverlay(false);
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
      if (first) {
        flashGuideCard();
        lockPointer();
      } else {
        setOverlay(true);
      }
    }

    function maybeShowIntro() {
      if (!introEl || WORLD_MODE !== 'survival') return;
      let seen = false;
      try { seen = localStorage.getItem(introSeenKey()) === '1'; } catch (e) { }
      if (!seen) openIntro(true);
    }

    introBtn?.addEventListener('click', () => { if (!introBtn.disabled) closeIntro(); });

    document.getElementById('playBtn').addEventListener('click', () => {
      lockPointer();
    });

    document.getElementById('manualBtn')?.addEventListener('click', () => {
      openIntro(false);
    });
    if (WORLD_MODE === 'sandbox') document.getElementById('manualBtn')?.remove();

    document.getElementById('menuBtn').addEventListener('click', () => {
      if (!wipeSave) world.save(player);
      location.reload();
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
      else if (id === 'sensitivity') mouseSens = v;
      else if (id === 'invertY') invertY = v;
      else if (id === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); }
      else if (id === 'resolution') { PIXEL = v; applyPixelSize(); }
      else if (id === 'colorLevels') { COLOR_LEVELS = v; postMat.uniforms.uLevels.value = v; }
    });

    document.addEventListener('pointerlockchange', () => {
      locked = document.pointerLockElement === renderer.domElement;
      blockLook();
      setOverlay(!locked && !introOpen && !invOpen && !cmdOpen && !mapSystem?.isOpen() && !recipeOpen && !visibleTree() && !workbenchUI.opened && !achieveOpen);
      if (!locked) {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
      }
    });

    document.addEventListener('pointerlockerror', () => {
      if (!introOpen && !invOpen && !cmdOpen && !mapSystem?.isOpen() && !recipeOpen && !visibleTree() && !workbenchUI.opened && !achieveOpen) setOverlay(true);
    });





    function lockPointer() {
      try {
        const p = renderer.domElement.requestPointerLock();
        if (p && p.catch) p.catch(() => { });
      } catch (e) {                                    }
    }

    // Every pointer-lock release goes through here: block look input before
    // the unlock mousemove can arrive, then actually release the cursor.
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

    function updateDrops(dt, now) {
      const pp = player.pos;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (!d.resting) {
          d.vel.y -= 12 * dt;
          d.mesh.position.addScaledVector(d.vel, dt);
          d.mesh.rotation.y += dt * 3;
          if (world.field.sample(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z) > 0) {
            for (let u = 0; u < 1.2; u += 0.1) {
              d.mesh.position.y += 0.1;
              if (world.field.sample(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z) <= 0) break;
            }
            d.resting = true;
            d.rollT = 0;
          }
        } else {

          d.rollT -= dt;
          if (d.rollT <= 0) {
            d.rollT = 0.2;
            const px = d.mesh.position.x, py = d.mesh.position.y, pz = d.mesh.position.z;
            if (world.field.sample(px, py - 0.25, pz) <= 0) {
              d.resting = false;
              d.vel.set(0, 0, 0);
            } else {
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
          const got = (d.liquid || d.plates)
            ? giveStack({ id: d.id, n: d.n, ...(d.liquid ? { liquid: d.liquid } : {}), ...(d.plates ? { plates: d.plates } : {}) })
            : (give(d.id, d.n), true);
          if (got) { scene.remove(d.mesh); drops.splice(i, 1); }
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

    function buildSlots(el, grid, base) {
      el.innerHTML = '';
      for (let i = 0; i < grid.length; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        d.dataset.idx = base + i;
        if (el === hotbarEl) d.dataset.key = String(i + 1);
        dragDrop.bind(d, inventoryAdapter(grid, i, ITEMS));
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
      if (advanced && !wipeSave) world.save(player);
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
      for (const key of ['mined', 'placed', 'crafted', 'machines', 'kills', 'dosePeak', 'research', 'fuel', 'walked']) {
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
        + `#${achSelected ? `${achSelected.type}:${achSelected.tier}` : ''}`;
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
        if (!wipeSave) world.save(player);
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
      if (!wipeSave) world.save(player);
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

    function syncBars() {
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
        if (d.consumable.food) lines.push(`FOOD +${d.consumable.food}`);
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
      const any = recipeOpen || workbenchUI.opened || invOpen || !!mapSystem?.isOpen();
      if (recipeOpen) toggleRecipes(false);
      if (workbenchUI.opened) workbenchUI.close();
      if (invOpen) toggleInv(false);
      if (mapSystem?.isOpen()) mapSystem.hide();
      return any;
    }

    function toggleInv(force, relink = true) {
      invOpen = force !== undefined ? force : !invOpen;
      if (!invOpen) {
        dragDrop.cancel();
        if (recipeOpen) toggleRecipes(false);
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
      addRecipe({ needs: c.needs, out: c.out, where: 'CRAFTING' + (TABLE_OUT.has(id) ? ' · POCKET TABLE' : '') });
    }
    for (const m of MACHINE_DEFS) {
      for (const mr of m.recipes || []) addRecipe({ needs: mr.in || {}, out: mr.out || {}, where: m.name, fuel: mr.fuel });
    }

    function recipeSlot(id, n) {
      return `<div class="rslot jump" data-id="${id}"><div style="background:url('${itemIconUrl(id)}') center/contain no-repeat"></div>`
        + (n > 1 ? `<span class="n">${n}</span>` : '') + '</div>';
    }

    function recipeCard(r) {
      const ins = Object.entries(r.needs).map(([id, n]) => recipeSlot(id, n)).join('') || '<div class="rslot"></div>';
      const outs = Object.entries(r.out).map(([id, n]) => recipeSlot(id, n)).join('') || '<div class="rslot"></div>';
      return `<div class="rcard"><div class="ring">${ins}</div><div class="rarrow"></div>`
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
      let carried = 0;
      for (const s of allSlots()) if (s && ITEMS[s.id]) carried += (ITEMS[s.id].rad || 0);
      let protect = 0;
      if (machineSystem) {
        carried *= 1 - machineSystem.carryShield();
        protect = machineSystem.radProtect();
      }
      let r = carried - (machineSystem ? machineSystem.totalArmorRadShield() : 0);
      if (armorShieldTimer > 0) r -= 3;

      // Ambient, wasteland ground and machine fields all pass through worn
      // armor, then absorbers. Both are fractions, so neither zeroes the field.
      // The field arrives from a direction, so walls between the player and the
      // source already took a bite out of it.
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
      return Math.max(0, r);
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
      // Arrow points at the source of the radiation, so walls can be built
      // between the player and it.
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
      fallPeak = 0;
      deathT = 3;
      shakeT = 1.5;
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
      player.yaw -= e.movementX * 0.0022 * mouseSens;
      player.pitch -= e.movementY * 0.0022 * mouseSens * (invertY ? -1 : 1);
      const lim = Math.PI / 2 - 0.02;
      player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
    });

    let shotRequested = false;
    let panoRequested = false;
    document.addEventListener('keydown', (e) => {
      const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      if (introOpen) return;

      if (achieveOpen) {
        if (e.code === 'Escape') { e.preventDefault(); closeAchievements(); }
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
        wireframe = !wireframe;
        world.material.wireframe = wireframe;
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

      if (e.code === 'KeyP') {
        tuneWaterOvershoot(3);
      }

      if (e.code === 'KeyV') {
        COLOR_LEVELS = COLOR_LEVELS <= 8 ? 64 : COLOR_LEVELS / 2;
        postMat.uniforms.uLevels.value = COLOR_LEVELS;
      }

      if (e.code === 'KeyI') {
        const spans = hudEl.querySelectorAll('.copy');
        const text = spans.length ? Array.from(spans, (s) => s.innerText).join('\n') : hudEl.innerText;
        if (navigator.clipboard) navigator.clipboard.writeText(text);
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
      return null;
    }

    let cmdMatchKind = 'item';

    function cmdLabel(id) {
      return cmdMatchKind === 'target' ? cmdTargetLabel(id) : itemLabel(id);
    }

    function renderSuggest(v) {
      const query = cmdQuery(v);
      cmdMatchKind = query ? query.kind : 'item';
      cmdMatches = !query ? []
        : query.kind === 'item' ? (query.q ? nearestItems(query.q) : [])
          : nearestTargets(query.q);
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
      cmdInput.focus();
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
      const f = (clock.t % TUNING.DAY_SECONDS) / TUNING.DAY_SECONDS;
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
      if (!m) { notice('COMMANDS: /give, /time, /tp'); return; }
      const cmd = m[1].toLowerCase(), rest = m[2].trim();

      if (cmd === 'tp' || cmd === 'goto') {
        if (!rest) { notice(`USAGE: /tp <${TP_TARGETS.map((t) => t.id).join('|')}>`); return; }
        const target = resolveTarget(rest);
        if (!target) { notice(`NO DESTINATION "${rest}"`); return; }
        if (!teleportTo(target)) { notice(`NO ${target.label} FOUND NEARBY`); return; }
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
          if (timeLock === null) { timeLock = TUNING.DAY_SECONDS * 0.25; clock.t = timeLock; notice('TIME LOCKED · NOON'); }
          else { timeLock = null; notice('TIME UNLOCKED'); }
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

      notice(`UNKNOWN COMMAND /${cmd}`);
    }

    document.addEventListener('keydown', (e) => {
      if (!cmdOpen) {
        if (WORLD_MODE !== 'sandbox') return;
        const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        if (typing) return;
        if (e.code === 'KeyL' || e.code === 'Backquote') { e.preventDefault(); openCmd(); }
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

    function mineAim() {
      const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      return { dir, hit: raycastTerrain(origin, dir, REACH) };
    }

    function doMine() {
      const tool = heldTool();
      if (tool.chop && tryChopTree(tool)) return;
      if (tool === BARE_HANDS && shakeTreeForFruit()) { triggerSwing(0.5); return; }


      {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let best = null, bestT = REACH;
        for (const w of wrappers) {
          if (w.dying > 0) continue;
          const c = new THREE.Vector3(w.pos.x, w.pos.y + 0.9, w.pos.z);
          const to = c.clone().sub(origin);
          const t = to.dot(dir);
          if (t < 0 || t > bestT) continue;
          if (to.addScaledVector(dir, -t).length() > 0.9) continue;
          best = w; bestT = t;
        }
        if (best) {
          triggerSwing(Math.min(0.5, Math.max(0.2, tool.rate * 0.9)));
          best.hurtBy(22 + (tool.chop ? 18 : 0));
          if (best.dying > 0) { achBump('kills', 1); notice('WRAPPER DOWN'); }
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
          if (inst && aim.t < terrT) { machineSystem.remove(inst); return; }
        }
      }

      {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pick = pipeSystem?.pick(origin, dir, 6);
        if (pick) {
          const eye = origin;
          const terrT = hit ? new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5).distanceTo(eye) : Infinity;
          if (pick.distance < terrT) { pipeSystem.removeAt(pick.cell.x, pick.cell.y, pick.cell.z); return; }
        }
      }
      if (buildingSystem) {
        const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eye, player.pos.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const pick = buildingSystem.pick(origin, dir, REACH);
        if (pick) {
          const terrT = hit ? new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5).distanceTo(origin) : Infinity;
          if (pick.distance < terrT) {
            const hammer = !!tool.build;
            const broke = buildingSystem.damage(pick.piece, hammer ? 1500 : 30);
            if (broke) {
              const id = Object.keys(ITEMS).find((k) => ITEMS[k].building?.kind === pick.piece.kind
                && ITEMS[k].building?.tier === pick.piece.tier);
              if (id) give(id, 1);
              notice('WALL DOWN');
            }
            return;
          }
        }
      }
      if (!hit) return;
      const band = groundBand(hit.x, hit.y, hit.z);
      const match = tool.good.includes(band);
      const hy = hit.y, yy = tool.yield;
      const stoneMult = tool.stone || 1;
      world.mineAnimated(hit.x, hit.y, hit.z, tool.radius, match ? 1 : (tool.weak || 0.3), () => {
        achBump('mined', 1);
        if (match && yy > 0) {
          const bonus = yy - 1;
          for (const [id, n] of mineDrops(band, hy, hit.x, hit.z)) {
            const dup = bonus > 0 && Math.random() < bonus ? n : 0;
            const amt = (n + dup) * (id === 'stone' ? stoneMult : 1);
            give(id, amt);
            if (id === 'uranium' || id === 'thorium' || id === 'beryllium') inv.dose += 2;
          }
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
      const seam = regionOre(x, z);
      if (seam !== 'stone') return Math.random() < MINE_ORE_CHANCE ? [['stone', 1], [seam, 1]] : [['stone', 1]];

      const table = y < 12 ? MINE_TABLE_DEEP : MINE_TABLE_SHALLOW;
      if (Math.random() >= MINE_ORE_CHANCE * 0.5) return [['stone', 1]];
      let total = 0; for (const [, w] of table) total += w;
      let r = Math.random() * total;
      for (const [id, w] of table) { r -= w; if (r <= 0) return [['stone', 1], [id, 1]]; }
      return [['stone', 1]];
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
      const t = y + (noise3(x * 0.15, y * 0.15, z * 0.15) - 0.5) * 4.0;
      if (t < 17) return 'stone';
      if (t < 21) return 'dirt';
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

    // Right-click a wall with the hammer: upgrade it to the next tier in place.
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

    // --- doors ---------------------------------------------------------------
    // Right-click a door with an empty hand and it swings. The hammer never
    // opens a door: it upgrades and demolishes, so it goes first.

    // Distance along the ray to an axis aligned box, or null when it misses.
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

    // The nearest door the ray runs into. A shut door is hit by its panel, an
    // open one by the whole doorway, so it can always be shut again.
    function doorHit(origin, dir) {
      if (!buildingSystem) return null;
      let best = null, bestT = REACH;
      for (const p of buildingSystem.pieces.values()) {
        if (p.kind !== 'door') continue;
        const boxes = p.open
          ? [[{
            minX: p.x, maxX: p.x + 1, minY: p.y, maxY: p.y + 3, minZ: p.z, maxZ: p.z + 1,
          }]]
          : p.cells.map(([, b]) => b);
        for (const b of boxes) {
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
      // anything solid in front of the door wins
      const pick = buildingSystem.pick(origin, dir, REACH);
      if (pick && pick.piece.kind !== 'door' && pick.distance < hit.t - 0.02) return null;
      const { hit: terr } = mineAim();
      if (terr && origin.distanceTo(terr) < hit.t - 0.02) return null;
      return hit.piece;
    }

    // An empty hand: nothing consumable and no tool. The hammer is a tool, so
    // it never opens a door.
    function handFreeForDoor() {
      const s = inv.hot[inv.sel];
      if (!s) return true;
      const d = ITEMS[s.id] || {};
      return !d.consumable && !d.tool;
    }

    function toggleDoor(piece) {
      if (!piece || piece.kind !== 'door' || !buildingSystem) return false;
      if (!buildingSystem.toggle(piece)) return false;
      triggerSwing(0.25);
      notice(piece.open ? 'DOOR OPEN' : 'DOOR CLOSED');
      return true;
    }

    function useDoorToggle() {
      if (!handFreeForDoor()) return false;
      const piece = doorUnderCrosshair();
      if (!piece) return false;
      return toggleDoor(piece);
    }

    // The runtime draws one box per piece, so the swing is applied here: the
    // door mesh turns about its hinge edge while it opens.
    const doorAngles = new Map();
    function updateDoorSwings(dt) {
      if (!buildingSystem) return;
      const k = Math.min(1, dt * 9);
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const off = new THREE.Vector3();
      const kind = buildingSystem.kind('door');
      if (!kind) return;
      for (const [key, mesh] of buildingSystem.meshes) {
        if (!key.endsWith('|door')) continue;
        const list = buildingSystem.meshPieces.get(key) || [];
        list.forEach((p, i) => {
          const fr = swingFrame(p.x, p.y, p.z, p.rot);
          const target = p.open ? fr.sign * Math.PI / 2 : 0;
          const cur = doorAngles.has(p.id) ? doorAngles.get(p.id) : target;
          const a = cur + (target - cur) * k;
          doorAngles.set(p.id, a);
          const c = fr.center;
          const s = kind.scale(p.x, p.y, p.z, p.rot);
          q.setFromEuler(e.set(0, a, 0));
          off.set(c.x - fr.hinge.x, c.y - fr.hinge.y, c.z - fr.hinge.z).applyQuaternion(q);
          pos.set(fr.hinge.x + off.x, fr.hinge.y + off.y, fr.hinge.z + off.z);
          scl.set(s.x, s.y, s.z);
          m.compose(pos, q, scl);
          mesh.setMatrixAt(i, m);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
      // forget doors that were mined away
      for (const id of [...doorAngles.keys()]) if (!buildingSystem.pieces.has(id)) doorAngles.delete(id);
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
        if (hit) id = groundBand(hit.x, hit.y, hit.z) === 'stone' ? 'stone' : 'dirt';
      }
      if (!pickItemToHand(id)) notice('NOT IN INVENTORY');
    }

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
        if (!hit) return null;
        const x = Math.floor(hit.x + dir.x * 1.5) + 0.5, z = Math.floor(hit.z + dir.z * 1.5) + 0.5;
        if (Math.hypot(x - player.pos.x, z - player.pos.z) < 1.4) return null;
        if (machineSystem.at(x, z, 1.4)) return null;
        const def = machineSystem.templates.get(ITEMS[s.id].workbench).def;
        if (drag) {
          const space = coverageSpacing(def);
          if (space && holdPlace.lastPos
            && Math.hypot(x - holdPlace.lastPos.x, z - holdPlace.lastPos.z) < space
            && !(def.kind === 'cable' && uncoveredMachineNear(x, z, 6))) return null;
        }
        if (!machineSystem.place(ITEMS[s.id].workbench, x, z, { rot: placeRot })) return null;
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
        const { dir, hit } = mineAim();
        if (!hit) return null;
        const gx = Math.floor(hit.x + dir.x * 1.5);
        const gz = Math.floor(hit.z + dir.z * 1.5);
        const rot = Math.round(placeRot / (Math.PI / 2)) % (kind.rot || 1);
        const base = kind.base(buildingSystem, gx, gz, rot);
        if (!buildingSystem.canPlace(b.kind, gx, base, gz, rot)) return null;
        // Never wall the player in.
        const pr = player.radius, ph = player.height;
        for (const [, box] of kind.cells(gx, base, gz, rot)) {
          if (player.pos.x + pr > box.minX && player.pos.x - pr < box.maxX
            && player.pos.z + pr > box.minZ && player.pos.z - pr < box.maxZ
            && player.pos.y + ph > box.minY && player.pos.y < box.maxY) return null;
        }
        const piece = buildingSystem.place(b.kind, b.tier, gx, base, gz, rot);
        if (!piece) return null;
        achBump('placed', 1);
        triggerSwing(0.26);
        if (--s.n <= 0) inv.hot[inv.sel] = null;
        syncBars();
        return { type: 'building' };
      }
      if (!ITEMS[s.id].block) return null;
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
    function hidePlaceGhost() {
      if (placeGhost) { scene.remove(placeGhost.group); placeGhost = null; placeGhostKey = ''; }
    }
    function buildPlaceGhost(model) {
      const group = new THREE.Group();
      group.add(model.clone(true));
      const mats = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        o.material = list.map((m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; mats.push(c); return c; });
        if (o.material.length === 1) o.material = o.material[0];
      });
      return { group, mats };
    }
    function updatePlacePreview(now) {
      const s = inv.hot[inv.sel];
      if (s && ITEMS[s.id].building) { updateWallPreview(now, s.id); return; }
      hideWallGhost();
      const wb = s && ITEMS[s.id].workbench;
      if (!wb || !machineSystem || !locked || invOpen || cmdOpen || workbenchUI.opened) { hidePlaceGhost(); return; }
      const tpl = machineSystem.templates.get(wb);
      if (!tpl) { hidePlaceGhost(); return; }
      const { dir, hit } = mineAim();
      if (!hit) { hidePlaceGhost(); return; }
      const x = Math.floor(hit.x + dir.x * 1.5) + 0.5, z = Math.floor(hit.z + dir.z * 1.5) + 0.5;
      const blocked = Math.hypot(x - player.pos.x, z - player.pos.z) < 1.4 || machineSystem.at(x, z, 1.4);
      if (placeGhostKey !== wb) { hidePlaceGhost(); placeGhost = buildPlaceGhost(tpl.model); placeGhostKey = wb; scene.add(placeGhost.group); }
      const y = world.getSurfaceHeight(x, z, 90);
      placeGhost.group.position.set(x, y, z);
      placeGhost.group.rotation.y = placeRot;
      const op = 0.22 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.006));
      const tint = blocked ? 0xff5555 : 0xffffff;
      for (const m of placeGhost.mats) { m.opacity = op; m.color.setHex(tint); }
    }

    let wallGhost = null;
    function hideWallGhost() {
      if (wallGhost) { scene.remove(wallGhost); wallGhost = null; }
    }
    function updateWallPreview(now, itemId) {
      if (!buildingSystem || !locked || invOpen || cmdOpen || workbenchUI.opened) { hideWallGhost(); return; }
      const b = ITEMS[itemId]?.building;
      const kind = b && buildingSystem.kind(b.kind);
      if (!kind) { hideWallGhost(); return; }
      const { dir, hit } = mineAim();
      if (!hit) { hideWallGhost(); return; }
      const gx = Math.floor(hit.x + dir.x * 1.5);
      const gz = Math.floor(hit.z + dir.z * 1.5);
      const rot = Math.round(placeRot / (Math.PI / 2)) % (kind.rot || 1);
      const base = kind.base(buildingSystem, gx, gz, rot);
      if (!wallGhost) {
        wallGhost = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })
        );
        scene.add(wallGhost);
      }
      const c = kind.center(gx, base, gz, rot);
      const s = kind.scale(gx, base, gz, rot);
      wallGhost.position.set(c.x, c.y, c.z);
      wallGhost.scale.set(s.x, s.y, s.z);
      let blocked = !buildingSystem.canPlace(b.kind, gx, base, gz, rot);
      if (!blocked && kind.support && !kind.support(buildingSystem, gx, base, gz, rot)) blocked = true;
      const pr = player.radius, ph = player.height;
      if (!blocked) {
        for (const [, box] of kind.cells(gx, base, gz, rot)) {
          if (player.pos.x + pr > box.minX && player.pos.x - pr < box.maxX
            && player.pos.z + pr > box.minZ && player.pos.z - pr < box.maxZ
            && player.pos.y + ph > box.minY && player.pos.y < box.maxY) { blocked = true; break; }
        }
      }
      const op = 0.2 + 0.28 * (0.5 + 0.5 * Math.sin(now * 0.006));
      wallGhost.material.opacity = op;
      wallGhost.material.color.setHex(blocked ? 0xff5555 : 0xffffff);
    }

    const _tn = new THREE.Vector3(0, 1, 0);



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
              mt.emissive = new THREE.Color(0xff8c30);
              mt.emissiveIntensity = 0.55;
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

    function addTorch(x, y, z, nx, ny, nz, id = 'torch') {
      if (torches.length >= TORCH_MAX) return false;
      const type = ITEMS[id]?.light ? id : 'torch';
      const light = ITEMS[type]?.light || DEFAULT_LIGHT;
      const g = torchMesh(type);
      const n = new THREE.Vector3(nx, ny, nz).normalize();
      g.quaternion.setFromUnitVectors(_tn, n);
      g.position.set(x, y, z);
      scene.add(g);
      const floor = light.mount === 'floor';
      torches.push({
        pos: g.position.clone(), grp: g, id: type, light, col: rgbOf(light.color),
        ax: floor ? x : x - nx * 0.3, ay: floor ? y - 0.3 : y - ny * 0.3, az: floor ? z : z - nz * 0.3,
      });
      return true;
    }

    function tryTorchPlace(drag = false) {
      const s = inv.hot[inv.sel];
      const def = s && ITEMS[s.id];
      if (!def?.light) return null;
      const { hit } = mineAim();
      if (!hit) return null;
      const n = world.getSurfaceNormal(hit.x, hit.y, hit.z);
      let px, py, pz, nx, ny, nz;
      if (def.light.mount === 'floor') {
        if (n.y < 0.5) return null;
        px = hit.x; py = hit.y + 0.01; pz = hit.z;
        nx = 0; ny = 1; nz = 0;
      } else {
        if (Math.abs(n.y) > 0.5) return null;
        px = hit.x + n.x * 0.3; py = hit.y + n.y * 0.3; pz = hit.z + n.z * 0.3;
        nx = n.x; ny = n.y; nz = n.z;
      }

      if (drag && holdPlace.lastPos) {
        const space = def.light.range * 0.85;
        if (Math.hypot(px - holdPlace.lastPos.x, pz - holdPlace.lastPos.z) < space) return null;
      }
      for (const t of torches) {
        if (t.pos.distanceToSquared(new THREE.Vector3(px, py, pz)) < 0.36) return null;
      }
      if (!addTorch(px, py, pz, nx, ny, nz, s.id)) return null;
      holdPlace.lastPos = { x: px, z: pz };
      triggerSwing(0.24);
      world.markRegionDirty(px - 12, px + 12, py - 12, py + 12, pz - 12, pz + 12);
      if (--s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
      return { type: 'torch' };
    }


    function refreshMachineLights() {
      const near = torches
        .map((t) => ({ t, d: t.pos.distanceToSquared(player.pos) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, MACHINE_LIGHT_SLOTS);
      for (let i = 0; i < MACHINE_LIGHT_SLOTS; i++) {
        const e = near[i];
        if (!e) { machineLightPos[i].set(0, -999, 0); machineLightCol[i].set(0, 0, 0); continue; }
        machineLightPos[i].copy(e.t.pos);
        machineLightCol[i].set(
          e.t.col[0] * e.t.light.power,
          e.t.col[1] * e.t.light.power,
          e.t.col[2] * e.t.light.power
        );
      }
    }

    let torchTimer = 0;

    function updateTorches(dt, now) {
      torchUniforms.torchTime.value = now / 1000;
      torchTimer -= dt;
      if (torchTimer > 0) return;
      torchTimer = 0.25;

      for (let i = torches.length - 1; i >= 0; i--) {
        const t = torches[i];
        if (world.field.sample(t.ax, t.ay, t.az) <= 0) {
          scene.remove(t.grp);
          torches.splice(i, 1);
          world.markRegionDirty(t.pos.x - 12, t.pos.x + 12, t.pos.y - 12, t.pos.y + 12, t.pos.z - 12, t.pos.z + 12);
          give(t.id, 1);
        }
      }
      refreshMachineLights();
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
    function beep(vol = 0.15, freq = 880) {
      if (vol <= 0.001) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      beepCtx = beepCtx || new C();
      if (beepCtx.state === 'suspended') beepCtx.resume().catch(() => {});
      const t = beepCtx.currentTime;
      const o = beepCtx.createOscillator(), g = beepCtx.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g).connect(beepCtx.destination);
      o.start(t); o.stop(t + 0.1);
    }
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
      world.markRegionDirty(Math.floor(c.x - r), Math.ceil(c.x + r),
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
        if (c.t >= C4_FUSE) { detonateC4(c); continue; }
        c.next -= dt;
        if (c.next <= 0) {
          const rem = C4_FUSE - c.t;
          beep(c4Audible(c.x, c.z, 0.20), rem > 2 ? 880 : 1180);
          c.next = rem > 3 ? 0.7 : rem > 1.2 ? 0.32 : 0.14;
        }
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


    function useConsumable() {
      const s = inv.hot[inv.sel];
      if (!s) return false;
      const def = ITEMS[s.id];
      if (!def || !def.consumable) return false;
      const c = def.consumable;
      inv.dose = Math.max(0, inv.dose + (c.dose || 0));
      if (c.food) vitals.hunger = Math.min(vitals.maxHunger, vitals.hunger + c.food);
      if (c.cures) cureWounds(c.cures);
      if (c.heal) vitals.hp = Math.min(vitals.maxHp, vitals.hp + c.heal);
      if (c.immunity) vitals.infectionImmunity = Math.max(vitals.infectionImmunity, c.immunity);
      if (def.consumable.shieldTime) armorShieldTimer = def.consumable.shieldTime;
      if (def.consumable.intake) { radIntakeMult = def.consumable.intake; radIntakeTimer = def.consumable.intakeTime || 1800; }
      if (def.consumable.smoke) {
        if (!hasLighter()) { notice('NEED A LIGHTER'); return true; }
        smokeTime = def.consumable.smoke; smokeSpeed = def.consumable.speed || 1;
      }
      if (s.id === 'cup_noodles' && !drink) startDrink();
      s.n--; if (s.n <= 0) inv.hot[inv.sel] = null;
      syncBars();
      return true;
    }

    renderer.domElement.addEventListener('mousedown', (e) => {
      if (!locked || invOpen) return;
      if (e.button === 0) { mining = true; mineTimer = 0; }
      else if (e.button === 1) {
        e.preventDefault();
        pickUnderCrosshair();
      }
      else if (e.button === 2) {
        if (useBweController()) return;
        if (useBuildingUpgrade()) return;
        if (useConsumable()) return;
        if (useDoorToggle()) return;
        if (useInteractable()) return;
        if (useLiquidContainer()) return;
        if (useC4()) return;
        resetHoldPlace();
        doPlace();
        const s = inv.hot[inv.sel];
        if (s && (ITEMS[s.id].torch || ITEMS[s.id].pipeGrid || ITEMS[s.id].workbench || ITEMS[s.id].block || ITEMS[s.id].building)) {
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
      // Sample the full body, including eye level and the very top of the head.
      // The old 0.55 m spacing stopped at 1.35 m, so a cave ceiling could sit
      // inside the head while the camera (at 1.62 m) poked through the world.
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
      // Walls are their own geometry, not terrain: they block the player too.
      if (buildingSystem) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const dx = Math.cos(ang) * r;
          const dz = Math.sin(ang) * r;
          for (const y of ys) {
            if (buildingSystem.solidAt(p.x + dx, p.y + y, p.z + dz)) return true;
          }
        }
        for (const y of ys) {
          if (buildingSystem.solidAt(p.x, p.y + y, p.z)) return true;
        }
      }
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

    // Steep ground is not walkable on foot: the ground may not rise faster than
    // this over a 1 m look-ahead, and a walk can only step over a small lip.
    // Jump to get up anything steeper.
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



    function industrialBlockedAt(x, z) {
      const r = player.radius;
      for (const c of industrialColliders) {
        if (player.pos.y > c.top - 0.2) continue;

        if (c.kind === 'box') {
          if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
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

    function machineBlockedAt(x, z) {
      if (!machineSystem) return false;
      const r = player.radius;
      for (const m of machineSystem.instances) {
        if (player.pos.y > m.top - 0.2) continue;
        if (Math.abs(x - m.x) < m.hx + r && Math.abs(z - m.z) < m.hz + r) return true;
      }
      return false;
    }

    function structureBlockedAt(x, z) {
      return industrialBlockedAt(x, z) || machineBlockedAt(x, z);
    }

    function movePlayer(dt) {
      if (mapSystem?.isOpen()) return;
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

      const sprint = keys.ShiftLeft || keys.ShiftRight;
      const speed = (inWater ? 2.8 : (sprint ? 7.2 : 4.2)) * radStage().speed * woundSpeed() * (smokeTime > 0 ? smokeSpeed : 1);

      // Strafing and backpedalling are slower than walking forward.
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

      // Refuse horizontal movement into ground steeper than a walkable slope
      // (checked per axis, so you still slide along the contour of a hill).
      let mx = dx, mz = dz;
      if (wasGrounded) {
        if (dx !== 0 && slopeBlocked(dx, 0)) { mx = 0; player.vel.x = 0; }
        if (dz !== 0 && slopeBlocked(0, dz)) { mz = 0; player.vel.z = 0; }
      }


      const bx = structureBlockedAt(player.pos.x, player.pos.z);
      player.pos.x += mx;
      if (!bx && structureBlockedAt(player.pos.x, player.pos.z)) {
        player.pos.x -= mx;
        player.vel.x = 0;
      } else if (playerCollides()) {
        player.pos.x -= mx;
        if (!(mx !== 0 && player.vel.y <= 0.5 && tryStepUp(mx, 0))) player.vel.x = 0;
      }


      const bz = structureBlockedAt(player.pos.x, player.pos.z);
      player.pos.z += mz;
      if (!bz && structureBlockedAt(player.pos.x, player.pos.z)) {
        player.pos.z -= mz;
        player.vel.z = 0;
      } else if (playerCollides()) {
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
          if (!inWater) footsteps.land(footstepCategory(), Math.min(0.9, 0.62 + fallPeak * 0.012) * masterVolume);
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
        footsteps.step(footstepCategory(), (sprint ? 0.6 : 0.42) * masterVolume);
      }


      if (player.pos.y < -30) {
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

    new GLTFLoader().load(WRAPPER.url, (gltf) => {
      wrapperTemplate = { scene: gltf.scene, clips: gltf.animations };
    }, undefined, (err) => console.warn('wrapper model failed to load', err));

    function spawnWrapper(x, z) {
      if (!wrapperTemplate) return null;
      const y = world.getSurfaceHeight(x, z);
      if (!Number.isFinite(y)) return null;
      if (world.waterAt(x, y + 0.8, z) > 0) return null;
      const w = new Wrapper(world, x, z, wrapperTemplate);
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





    const hudEl = document.getElementById('hud');
    const barFill = document.getElementById('barFill');
    const deathBanner = document.getElementById('deathBanner');

    let fpsSmooth = 60;
    let hudTimer = 0;

    function updateHud(dt) {
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
      const vegMs = (vegPerf.stream + vegPerf.inst + vegPerf.trunks + vegPerf.collide + vegPerf.anim) / vf;
      const sections = {
        veg: vegMs, move: perf.move / vf, jobs: perf.jobs / vf, drops: perf.drops / vf,
        world: perf.world / vf, water: perf.water / vf, dirty: perf.dirty / vf, wdirty: perf.wdirty / vf,
        ent: perf.entities / vf, render: perf.render / vf, misc: perf.misc / vf,
      };
      const frameMs = Object.values(sections).reduce((s, v) => s + v, 0);
      const frameBreak = Object.entries(sections).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(([n, ms], i) => (i === 0 ? '<b>' : '') + n + ' ' + ms.toFixed(2) + (i === 0 ? '</b>' : '')).join(' · ');
      const vegBreak = [['stream', vegPerf.stream], ['inst', vegPerf.inst], ['trunk', vegPerf.trunks], ['hit', vegPerf.collide], ['anim', vegPerf.anim]]
        .map(([n, ms]) => [n, ms / vf]).sort((a, b) => b[1] - a[1])
        .map(([n, ms], i) => (i === 0 ? '<b>' : '') + n + ' ' + ms.toFixed(2) + (i === 0 ? '</b>' : '')).join(' · ');

      hudEl.innerHTML =
        `<b>${fpsSmooth.toFixed(0)} fps</b> &nbsp; chunks: <b>${world.chunks.size}</b> ` +
        `(${world.dirty.length} queued, ${world.waterDirty.length}w)<br>` +
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
        `<span class="k">frame</span> <span class="copy" title="press I to copy">${frameMs.toFixed(2)}ms · ${frameBreak} · q ${world.dirty.length} · qw ${world.waterDirty.length} · dc ${renderer.info.render.calls} · tri ${(renderer.info.render.triangles / 1000).toFixed(0)}k</span><br>` +
        `<span class="k">veg ms</span> <span class="copy">${vegMs.toFixed(2)} · ${vegBreak} · ${vegCount()} inst · ${trunkColliders.length} hit</span>`;


      const target = world.chunks.size;
      const built = target - world.dirty.length;
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
      const cam = new THREE.PerspectiveCamera(90, 1, 0.1, 2000);
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



    const _loopChan = new MessageChannel();
    _loopChan.port1.onmessage = () => frame(performance.now());
    function scheduleNextFrame() {
      if (vsync) requestAnimationFrame(frame);
      else _loopChan.port2.postMessage(0);
    }

    function frame(now) {
      scheduleNextFrame();

      renderer.info.autoReset = false;
      renderer.info.reset();


      if (location.search.includes('debug')) {
        window.__game = {
          inv, ITEMS, give, torches, addTorch, tryTorchPlace, doPlace, world, player,
          waterAt: (x, y, z) => world.waterAt(x, y, z), useWater: (x, y, z, a) => world.useWater(x, y, z, a),
          save: () => world.save(player),
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



        window.__waterSelfTest = () => {
          const w = world, ws = w.water;
          let col = null;
          outer:
          for (let x = -96; x <= 96; x += 1)
            for (let z = -96; z <= 96; z += 1) {
              const s = w.surfaceAt(x, z);
              if (s !== -Infinity && w.waterAt(x + 0.5, s - 1, z + 0.5) > 0) { col = [x, z]; break outer; }
            }
          if (!col) return { ok: true, note: 'no pond deeper than 1 m in 96 m — nothing to verify' };
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
          for (const layer of ['canopy', 'ground', 'cover', 'floor', 'aquatic']) {
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

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      playTime += dt;
      fpsSmooth += ((1 / Math.max(dt, 1e-4)) - fpsSmooth) * 0.08;


      const _pMove = performance.now();
      if (!invOpen && !cmdOpen && !workbenchUI.opened && !mapSystem?.isOpen()) { movePlayer(dt); updateBreath(dt); }
      perf.move += performance.now() - _pMove;


      if (mining && locked && !invOpen && !cmdOpen) {
        mineTimer -= dt;
        while (mineTimer <= 0) { doMine(); mineTimer += heldTool().rate; }
      } else mining = false;


      if (timeLock === null) {
        clock.t += dt;
        if (clock.t >= TUNING.DAY_SECONDS) { clock.t -= TUNING.DAY_SECONDS; clock.day++; }
      } else {
        clock.t = timeLock;
      }
      updateDaylight();
      if (armorShieldTimer > 0) armorShieldTimer = Math.max(0, armorShieldTimer - dt);
      if (radIntakeTimer > 0) radIntakeTimer = Math.max(0, radIntakeTimer - dt);
      if (smokeTime > 0) smokeTime = Math.max(0, smokeTime - dt);
      if (cigModel) cigModel.visible = smokeTime > 0;
      machineSystem?.update(dt);
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
      if (inv.dose >= TUNING.RAD_LETHAL_DOSE) die();
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (deathT > 0) deathT = Math.max(0, deathT - dt);
      if (noticeT > 0) noticeT = Math.max(0, noticeT - dt);


      eyeCur += ((sliding ? 1.02 : player.eye) - eyeCur) * Math.min(1, dt * 10);
      slidePitch += ((sliding ? 0.14 : 0) - slidePitch) * Math.min(1, dt * 8);
      const speed = Math.hypot(player.vel.x, player.vel.z);
      const localRight = player.vel.x * Math.cos(player.yaw) - player.vel.z * Math.sin(player.yaw);
      const moveLean = Math.max(-1, Math.min(1, localRight / 5.5));
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
      camera.rotation.y = player.yaw + (Math.random() - 0.5) * shake * 0.5;
      camera.rotation.x = player.pitch + slidePitch - landingOffset * 0.24 + (Math.random() - 0.5) * shake * 0.5;


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
      world.update(player.pos.x, player.pos.y, player.pos.z);
      farTerrain.update(player.pos.x, player.pos.z);
      perf.world += performance.now() - _pWorld;
      vegPerf.frames++;
      const _pVeg = performance.now();
      vegFalling(dt);
      vegPerf.anim += performance.now() - _pVeg;
      updateChop(dt);
      industrialUpdate(player.pos.x, player.pos.z);

      const submerged = world.isUnderwater(camera.position.x, camera.position.y, camera.position.z);
      waterSimTimer += dt;
      const waterStepInterval = submerged ? 0.12 : 0.18;
      if (waterSimTimer >= waterStepInterval) {


        const _pWater = performance.now();
        world.updateWater(submerged);
        perf.water += performance.now() - _pWater;
        waterSimTimer = 0;
      }


      const _pDirty = performance.now();
      world.processDirty(3);
      perf.dirty += performance.now() - _pDirty;
      const _pW = performance.now();
      world.processWaterDirty(1);
      perf.wdirty += performance.now() - _pW;


      const _pEnt = performance.now();
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
          w.hitCd = 1.5;
          hurt(11, 'bleeding');
          if (Math.random() < 0.35) addWound('pain');
        }

        if (w.dead || w.pos.distanceTo(player.pos) > WRAPPER.despawn) {
          if (!w.dead) w.dispose();
          wrappers.splice(i, 1);
        }
      }
      perf.entities += performance.now() - _pEnt;



      const _pMisc = performance.now();
      // The far rings own their own distance haze, so scene.fog only has to cover
      // the editable terrain. The haze is complete exactly where the fake terrain
      // ends (outer ring edge or camera far plane), so no border of it shows.
      const nominalFar = viewRadius * CHUNK_SIZE;
      const horizon = farTerrain.outer;
      const visFar = horizon > 0 ? Math.min(horizon, nominalFar * 1.1) : nominalFar;
      camera.far = Math.max(400, horizon > 0 ? Math.min(horizon * 1.02, nominalFar * 1.1) : nominalFar * 1.1);
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


      updateViewmodel(dt);


      sun.position.copy(camera.position).addScaledVector(SUN_DIR, 80);
      sun.target.position.copy(camera.position);
      sun.target.updateMatrixWorld();
      const sunAt = new THREE.Vector3().copy(camera.position).addScaledVector(SUN_DIR, 280);
      sunDisc.position.copy(sunAt);
      sunGlow.position.copy(sunAt);
      sunDisc.lookAt(camera.position);
      sunGlow.lookAt(camera.position);
      clouds.position.set(player.pos.x, 88, player.pos.z);
      cloudUniforms.uTime.value = now / 1000;


      const stage = radStage();
      const k = Math.min(1, dt * 2);
      const eyeBlur = vitals.wounds.eye ? WOUNDS.eye.blur : 0;

      const blurTarget = workbenchUI.opened ? 0 : stage.blur + eyeBlur;
      postMat.uniforms.uRadBlur.value += (blurTarget - postMat.uniforms.uRadBlur.value) * k;
      postMat.uniforms.uRadDark.value += (stage.dark - postMat.uniforms.uRadDark.value) * k;
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
      perf.render += performance.now() - _pRender;
      mapSystem?.setMinimapVisible(locked && !mapSystem.isOpen());
      mapSystem?.update(dt);
      updateHud(dt);
    }

    maybeShowIntro();
    window.__NUCLEARISM_PREGEN_PROGRESS__ = 0;
    window.__NUCLEARISM_READY_COMPLETE__ = false;
    window.__NUCLEARISM_HAS_FAR_TERRAIN__ = viewRadius > DETAIL_CHUNK_RADIUS;
    const hasFarTerrain = window.__NUCLEARISM_HAS_FAR_TERRAIN__;
    window.__NUCLEARISM_READY__ = world.prewarm(
      player.pos.x,
      player.pos.y,
      player.pos.z,
      (progress) => { window.__NUCLEARISM_PREGEN_PROGRESS__ = hasFarTerrain ? progress * 0.2 : progress; },
    ).then(() => farTerrain.prewarm(
      player.pos.x,
      player.pos.z,
      (progress) => { window.__NUCLEARISM_PREGEN_PROGRESS__ = hasFarTerrain ? 0.2 + progress * 0.8 : progress; },
    )).then(() => {
      scheduleNextFrame();
      window.__NUCLEARISM_READY_COMPLETE__ = true;
    });


    initModelIcons();





    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      viewCam.aspect = camera.aspect;
      viewCam.updateProjectionMatrix();
      applyPixelSize();
    });


    setInterval(() => {
      if (!wipeSave && (world.field.edits.size > 0 || (mapSystem && mapSystem.seen.size > 0))) world.save(player);
    }, 12000);

    addEventListener('beforeunload', () => {
      if (!wipeSave) world.save(player);
    });


































































export const MAP_CHUNK = 16;
const TILE_PX = 64;
const TILE_STEP = MAP_CHUNK / TILE_PX;
const REVEAL_RADIUS = 3;
const TILE_CACHE_MAX = 1400;
const MINIMAP_RANGE = 200;
const MINIMAP_REDRAW_MS = 90;
const TILE_BUDGET_MS = 4;
const MIN_ZOOM = 0.04;
const MAX_ZOOM = 10;


export function gridStep(scale, minPx = 44) {
  const steps = [8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  return steps.find((s) => s * scale >= minPx) || 4096;
}

export function chunkCoord(v) { return Math.floor(v / MAP_CHUNK); }

export function chunkKey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

export function keyToChunk(key) {
  return [Math.floor(key / 65536) - 32768, (key % 65536) - 32768];
}

export function worldToScreen(x, z, view, w, h) {
  return { x: (x - view.x) * view.scale + w / 2, y: (z - view.z) * view.scale + h / 2 };
}

export function screenToWorld(sx, sy, view, w, h) {
  return { x: (sx - w / 2) / view.scale + view.x, z: (sy - h / 2) / view.scale + view.z };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LAYER_DEFAULTS = {
  terrain: true, water: true, sites: true, machines: true,
  deaths: true, bookmarks: true,
};

const LAYER_NAMES = {
  terrain: 'TERRAIN', water: 'WATER', sites: 'SITES', machines: 'MACHINES',
  deaths: 'DEATHS', bookmarks: 'MARKS',
};

export class MapSystem {
  constructor(opts) {
    this.opts = opts;
    this.seen = new Set();
    this.tiles = new Map();
    this.bookmarks = [];
    this.deaths = [];
    this.layers = { ...LAYER_DEFAULTS };
    this.nextId = 1;
    this.tick = 0;
    this.lastReveal = -1;
    this.open = false;
    this.relock = false;
    this.selected = null;
    this.view = { x: 0, z: 0, scale: 1.4 };
    this.minimapVisible = true;
    this._minimapTimer = 0;
    this._drawQueued = false;
    this._hits = [];
    this._drag = null;
    this._dirty = true;
    this._hover = null;
    this._mouse = null;
    this._labelBoxes = [];

    this._initDom();
  }


  _initDom() {
    this.miniWrap = document.getElementById('minimap');
    this.mini = document.getElementById('minimapCanvas');
    this.miniCtx = this.mini ? this.mini.getContext('2d') : null;

    this.panel = document.getElementById('mapPanel');
    this.canvas = document.getElementById('mapCanvas');
    this.ctx2d = this.canvas ? this.canvas.getContext('2d') : null;
    this.infoEl = document.getElementById('mapInfo');
    this.cursorEl = document.getElementById('mapCursor');
    this.layersEl = document.getElementById('mapLayers');
    this.markersEl = document.getElementById('mapMarkers');
    this.nameInput = document.getElementById('mapName');
    this.renameRow = document.getElementById('mapRenameRow');
    this.deleteBtn = document.getElementById('mapDeleteBtn');

    if (!this.panel || !this.canvas) return;

    document.getElementById('mapClose')?.addEventListener('click', () => this.hide());
    document.getElementById('mapCenterBtn')?.addEventListener('click', () => {
      const p = this.opts.player();
      this.centerOn(p.x, p.z);
    });
    document.getElementById('mapZoomIn')?.addEventListener('click', () => this.zoomAt(1.4));
    document.getElementById('mapZoomOut')?.addEventListener('click', () => this.zoomAt(1 / 1.4));
    document.getElementById('mapAddBtn')?.addEventListener('click', () => {
      this.addBookmark(this.view.x, this.view.z);
    });
    document.getElementById('mapFitBtn')?.addEventListener('click', () => this.fitExplored());
    this.deleteBtn?.addEventListener('click', () => this.deleteSelected());
    document.getElementById('mapSaveName')?.addEventListener('click', () => this.renameSelected());

    this.layersEl?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-layer]');
      if (!b) return;
      const k = b.dataset.layer;
      this.layers[k] = !this.layers[k];
      this._dirty = true;
      this.paintSidebar();
      this.requestDraw();
      this.opts.save?.();
    });

    this.markersEl?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-mark]');
      if (!row) return;
      this.selected = { type: row.dataset.mark, id: +row.dataset.id };
      const m = this._markerById(this.selected);
      if (m) this.centerOn(m.x, m.z);
      this.paintSidebar();
      this.requestDraw();
    });

    this.nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.renameSelected(); }
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this._drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vz: this.view.z, moved: 0 };
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this._paintCursor();
      if (!this._drag) { this._updateHover(); return; }
      const dx = e.clientX - this._drag.x, dy = e.clientY - this._drag.y;
      this._drag.moved = Math.max(this._drag.moved, Math.hypot(dx, dy));
      this.view.x = this._drag.vx - dx / this.view.scale;
      this.view.z = this._drag.vz - dy / this.view.scale;
      this._dirty = true;
      this.requestDraw();
    });
    this.canvas.addEventListener('pointerleave', () => {
      this._mouse = null;
      if (this.cursorEl) this.cursorEl.textContent = '';
      if (this._hover) { this._hover = null; this._dirty = true; this.requestDraw(); }
    });
    const endDrag = (e) => {
      if (!this._drag) return;
      const wasClick = this._drag.moved < 4;
      this._drag = null;
      this.canvas.classList.remove('dragging');
      this.canvas.style.cursor = this._hover ? 'pointer' : 'grab';
      if (wasClick) this._click(e);
      else this._updateHover();
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', () => {
      this._drag = null;
      this.canvas.classList.remove('dragging');
    });


    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const p = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, this.view, this._w, this._h);
      this.addBookmark(p.x, p.z);
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    addEventListener('resize', () => {
      if (this.open) { this._resize(); this._dirty = true; this.requestDraw(); }
    });
  }


  restore(data) {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.seen)) {
      for (const k of data.seen) {


        if (Number.isFinite(k)) this.seen.add(k >>> 0);
      }
    }
    if (Array.isArray(data.bookmarks)) {
      for (const b of data.bookmarks) {
        if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.z)) continue;
        this.bookmarks.push({
          id: Number.isFinite(b.id) ? b.id : this.nextId++,
          name: typeof b.name === 'string' && b.name.trim() ? b.name.slice(0, 24) : 'MARK',
          x: +b.x, z: +b.z, day: Number.isFinite(b.day) ? b.day : 1,
        });
        this.nextId = Math.max(this.nextId, (b.id | 0) + 1);
      }
    }
    if (Array.isArray(data.deaths)) {
      for (const d of data.deaths) {
        if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z)) continue;
        this.deaths.push({
          id: Number.isFinite(d.id) ? d.id : this.nextId++,
          x: +d.x, z: +d.z, day: Number.isFinite(d.day) ? d.day : 1,
          t: Number.isFinite(d.t) ? d.t : 0,
        });
        this.nextId = Math.max(this.nextId, (d.id | 0) + 1);
      }
    }
    if (data.layers && typeof data.layers === 'object') {
      for (const k of Object.keys(LAYER_DEFAULTS)) {
        if (typeof data.layers[k] === 'boolean') this.layers[k] = data.layers[k];
      }
    }
    this._dirty = true;
  }

  serialize() {
    return {
      seen: [...this.seen],
      bookmarks: this.bookmarks.map((b) => ({
        id: b.id, name: b.name, x: +b.x.toFixed(2), z: +b.z.toFixed(2), day: b.day,
      })),
      deaths: this.deaths.map((d) => ({
        id: d.id, x: +d.x.toFixed(2), z: +d.z.toFixed(2), day: d.day, t: +d.t.toFixed(0),
      })),
      layers: { ...this.layers },
    };
  }

  addBookmark(x, z, name) {
    const label = (name || `MARK ${this.bookmarks.length + 1}`).slice(0, 24);
    const mark = { id: this.nextId++, name: label, x: +x, z: +z, day: this.opts.clock().day };
    this.bookmarks.push(mark);
    this.selected = { type: 'bookmark', id: mark.id };
    this._dirty = true;
    this.opts.notice?.(`BOOKMARK ${label} · ${x.toFixed(0)}, ${z.toFixed(0)}`);
    this.opts.save?.();
    this.paintSidebar();
    this.requestDraw();
    return mark;
  }

  noteDeath(x, z) {
    const c = this.opts.clock();
    const near = this.deaths.find((d) => Math.hypot(d.x - x, d.z - z) < 4);
    if (near) { near.day = c.day; near.t = c.t; near.x = +x; near.z = +z; }
    else this.deaths.push({ id: this.nextId++, x: +x, z: +z, day: c.day, t: c.t });
    while (this.deaths.length > 24) this.deaths.shift();
    this.selected = null;
    this._dirty = true;
    this.opts.save?.();
  }

  _markerById(sel) {
    if (!sel) return null;
    const list = sel.type === 'death' ? this.deaths : this.bookmarks;
    return list.find((m) => m.id === sel.id) || null;
  }

  renameSelected() {
    if (!this.selected || this.selected.type !== 'bookmark' || !this.nameInput) return;
    const m = this._markerById(this.selected);
    if (!m) return;
    const name = this.nameInput.value.trim();
    if (!name) return;
    m.name = name.slice(0, 24);
    this._dirty = true;
    this.opts.save?.();
    this.paintSidebar();
    this.requestDraw();
  }

  deleteSelected() {
    if (!this.selected) return;
    const list = this.selected.type === 'death' ? this.deaths : this.bookmarks;
    const i = list.findIndex((m) => m.id === this.selected.id);
    if (i >= 0) list.splice(i, 1);
    this.selected = null;
    this._dirty = true;
    this.opts.save?.();
    this.paintSidebar();
    this.requestDraw();
  }


  centerOn(x, z) {
    this.view.x = x;
    this.view.z = z;
    this._dirty = true;
    this.requestDraw();
  }

  zoomAt(mult, sx, sy) {
    this._resize();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const before = sx !== undefined ? screenToWorld(sx, sy, this.view, w, h) : null;
    this.view.scale = clamp(this.view.scale * mult, MIN_ZOOM, MAX_ZOOM);
    if (before) {
      const after = screenToWorld(sx, sy, this.view, w, h);
      this.view.x += before.x - after.x;
      this.view.z += before.z - after.z;
    }
    this._dirty = true;
    this.requestDraw();
  }

  panBy(dxPx, dyPx) {
    this.view.x += dxPx / this.view.scale;
    this.view.z += dyPx / this.view.scale;
    this._dirty = true;
    this.requestDraw();
  }


  fitExplored() {
    if (!this.seen.size) return;
    this._resize();
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const key of this.seen) {
      const [cx, cz] = keyToChunk(key);
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cz < minZ) minZ = cz;
      if (cz > maxZ) maxZ = cz;
    }
    const w = this._w || 800, h = this._h || 600;
    const worldW = (maxX - minX + 1) * MAP_CHUNK;
    const worldH = (maxZ - minZ + 1) * MAP_CHUNK;
    const pad = Math.min(90, Math.min(w, h) * 0.12);
    this.view.x = ((minX + maxX + 1) * MAP_CHUNK) / 2;
    this.view.z = ((minZ + maxZ + 1) * MAP_CHUNK) / 2;
    this.view.scale = clamp(
      Math.min((w - pad * 2) / worldW, (h - pad * 2) / worldH),
      MIN_ZOOM, MAX_ZOOM,
    );
    this._dirty = true;
    this.paintSidebar();
    this.requestDraw();
  }


  handleKey(e) {
    if (!this.open) return false;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    const step = Math.max(40, Math.min(this._w || 800, this._h || 600) * 0.16);
    switch (e.code) {
      case 'ArrowLeft': this.panBy(-step, 0); break;
      case 'ArrowRight': this.panBy(step, 0); break;
      case 'ArrowUp': this.panBy(0, -step); break;
      case 'ArrowDown': this.panBy(0, step); break;
      case 'Equal':
      case 'NumpadAdd': this.zoomAt(1.25); break;
      case 'Minus':
      case 'NumpadSubtract': this.zoomAt(0.8); break;
      case 'Home':
      case 'KeyC': {
        const p = this.opts.player();
        this.centerOn(p.x, p.z);
        break;
      }
      case 'KeyF': this.fitExplored(); break;
      default: return false;
    }
    e.preventDefault();
    return true;
  }

  isOpen() { return this.open; }

  show() {
    if (this.open || !this.panel) return;
    this.relock = !!document.pointerLockElement;
    this.open = true;
    const p = this.opts.player();
    this.view.x = p.x;
    this.view.z = p.z;
    this.panel.classList.remove('hidden');
    this._resize();
    this._hover = null;
    this._mouse = null;
    if (this.cursorEl) this.cursorEl.textContent = '';
    if (this.canvas) this.canvas.style.cursor = 'grab';
    this.paintSidebar();
    this.opts.onShow?.();
    this._dirty = true;
    this.requestDraw();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.panel.classList.add('hidden');
    this._hover = null;
    this._mouse = null;
    if (this.cursorEl) this.cursorEl.textContent = '';
    this.opts.onHide?.(this.relock);
  }

  toggle() { this.open ? this.hide() : this.show(); }

  setMinimapVisible(v) {
    this.minimapVisible = !!v;
    if (this.miniWrap) this.miniWrap.style.display = v ? 'block' : 'none';
  }

  _resize() {
    if (!this.canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this._dpr = dpr;
    this._w = w;
    this._h = h;
  }


  revealAround(x, z) {
    const pcx = chunkCoord(x), pcz = chunkCoord(z);
    const key = chunkKey(pcx, pcz);
    if (key === this.lastReveal) return;
    this.lastReveal = key;
    for (let dz = -REVEAL_RADIUS; dz <= REVEAL_RADIUS; dz++) {
      for (let dx = -REVEAL_RADIUS; dx <= REVEAL_RADIUS; dx++) {
        this.seen.add(chunkKey(pcx + dx, pcz + dz));
      }
    }
    this._minimapTimer = 0;
  }

  _tileFor(cx, cz) {
    const key = chunkKey(cx, cz);
    let t = this.tiles.get(key);
    if (t) { t.tick = ++this.tick; return t; }
    t = this._renderTile(cx, cz);
    t.tick = ++this.tick;
    this.tiles.set(key, t);
    if (this.tiles.size > TILE_CACHE_MAX) {
      let oldest = null, oldestTick = Infinity;
      for (const [k, v] of this.tiles) {
        if (v.tick < oldestTick) { oldestTick = v.tick; oldest = k; }
      }
      if (oldest !== null) this.tiles.delete(oldest);
    }
    return t;
  }

  _renderTile(cx, cz) {
    const land = document.createElement('canvas');
    const water = document.createElement('canvas');
    land.width = land.height = TILE_PX;
    water.width = water.height = TILE_PX;
    const lctx = land.getContext('2d');
    const wctx = water.getContext('2d');
    const limg = lctx.createImageData(TILE_PX, TILE_PX);
    const wimg = wctx.createImageData(TILE_PX, TILE_PX);

    const S = TILE_PX, W = S + 2;
    const heights = new Float32Array(W * W);
    const biomes = new Uint8Array(W * W);
    const sea = this.opts.seaLevel;

    for (let j = -1; j <= S; j++) {
      const z = cz * MAP_CHUNK + (j + 0.5) * TILE_STEP;
      for (let i = -1; i <= S; i++) {
        const x = cx * MAP_CHUNK + (i + 0.5) * TILE_STEP;
        const s = this.opts.sample(x, z);
        const idx = (j + 1) * W + (i + 1);
        heights[idx] = s.h;
        biomes[idx] = s.biome;
      }
    }


    const lx = -0.50, ly = 0.71, lz = -0.50;
    const at = (i, j) => heights[(j + 1) * W + (i + 1)];
    const bandOf = (h) => Math.floor((h - sea) / 8);

    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const h = at(i, j);
        const o = (j * S + i) * 4;
        const hL = at(i - 1, j), hR = at(i + 1, j);
        const hU = at(i, j - 1), hD = at(i, j + 1);
        const band = bandOf(h);
        const contour = band !== bandOf(hL) || band !== bandOf(hU);

        if (h < sea) {
          const depth = clamp((sea - h) / 26, 0, 1);
          const d = Math.pow(depth, 0.72);
          let r = 88 + (18 - 88) * d;
          let g = 118 + (34 - 118) * d;
          let b = 120 + (58 - 120) * d;
          const wc = this.opts.waterColor?.(depth);
          if (wc) { r = wc[0]; g = wc[1]; b = wc[2]; }
          if (contour) { r += 9; g += 11; b += 12; }
          wimg.data[o] = clamp(Math.round(r), 0, 255);
          wimg.data[o + 1] = clamp(Math.round(g), 0, 255);
          wimg.data[o + 2] = clamp(Math.round(b), 0, 255);
          wimg.data[o + 3] = 250;
          continue;
        }


        const dhdx = (hR - hL) / (2 * TILE_STEP);
        const dhdz = (hD - hU) / (2 * TILE_STEP);
        const il = 1 / Math.hypot(dhdx, 1, dhdz);
        const dot = (-dhdx * lx + ly - dhdz * lz) * il;
        const shade = 0.64 + 0.52 * Math.max(0, dot);


        const t = clamp((h - sea) / 55, 0, 1);
        const lift = 0.80 + 0.36 * Math.pow(t, 0.7);
        let k = shade * lift;

        const c = this.opts.biomeColor(biomes[(j + 1) * W + (i + 1)]) || [0.45, 0.55, 0.35];
        if (contour) k *= 0.87;

        if (hL < sea || hR < sea || hU < sea || hD < sea) k *= 1.09;

        limg.data[o] = clamp(Math.round(c[0] * 255 * k), 0, 255);
        limg.data[o + 1] = clamp(Math.round(c[1] * 255 * k), 0, 255);
        limg.data[o + 2] = clamp(Math.round(c[2] * 255 * k), 0, 255);
        limg.data[o + 3] = 255;
      }
    }
    lctx.putImageData(limg, 0, 0);
    wctx.putImageData(wimg, 0, 0);
    return { land, water };
  }

  _generateNear(cx, cz, radiusChunks, maxTiles) {
    const start = performance.now();
    let made = 0;
    while (made < maxTiles && performance.now() - start < TILE_BUDGET_MS) {
      let bestKey = null, bestTx = 0, bestTz = 0, bestD = Infinity;
      if (radiusChunks <= 12) {

        for (let tz = cz - radiusChunks; tz <= cz + radiusChunks; tz++) {
          for (let tx = cx - radiusChunks; tx <= cx + radiusChunks; tx++) {
            const key = chunkKey(tx, tz);
            if (this.tiles.has(key) || !this.seen.has(key)) continue;
            const d = (tx - cx) * (tx - cx) + (tz - cz) * (tz - cz);
            if (d < bestD) { bestD = d; bestKey = key; bestTx = tx; bestTz = tz; }
          }
        }
      } else {

        for (const key of this.seen) {
          if (this.tiles.has(key)) continue;
          const [tx, tz] = keyToChunk(key);
          if (Math.abs(tx - cx) > radiusChunks || Math.abs(tz - cz) > radiusChunks) continue;
          const d = (tx - cx) * (tx - cx) + (tz - cz) * (tz - cz);
          if (d < bestD) { bestD = d; bestKey = key; bestTx = tx; bestTz = tz; }
        }
      }
      if (bestKey === null) break;
      this._tileFor(bestTx, bestTz);
      made++;
    }
    return made;
  }


  update(dt) {
    if (!this.miniCtx) return;
    const p = this.opts.player();
    this.revealAround(p.x, p.z);

    if (this.open) {
      this._resize();
      const [cx, cz] = [chunkCoord(this.view.x), chunkCoord(this.view.z)];
      const span = Math.ceil(Math.max(this._w, this._h) / this.view.scale / MAP_CHUNK);
      if (this._generateNear(cx, cz, Math.max(4, span), 2)) this._dirty = true;
      if (this._dirty) this.drawFull();
      return;
    }

    if (!this.minimapVisible) return;
    const pcx = chunkCoord(p.x), pcz = chunkCoord(p.z);
    if (this._generateNear(pcx, pcz, 7, 2)) this._minimapTimer = 0;

    this._minimapTimer -= dt;
    if (this._minimapTimer <= 0) {
      this._minimapTimer = MINIMAP_REDRAW_MS / 1000;
      this.drawMini();
    }
  }

  requestDraw() {
    if (this._drawQueued || !this.open) return;
    this._drawQueued = true;
    requestAnimationFrame(() => {
      this._drawQueued = false;
      if (this.open && this._dirty) this.drawFull();
    });
  }


  drawMini() {
    const canvas = this.mini;
    if (!canvas || !this.miniCtx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const css = canvas.clientWidth || 196;
    const size = Math.round(css * dpr);
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = canvas.height = size;
    }
    const ctx = this.miniCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const p = this.opts.player();
    const scale = css / MINIMAP_RANGE;
    const view = { x: p.x, z: p.z, scale };
    const half = MINIMAP_RANGE / 2;
    const c0x = chunkCoord(p.x - half), c1x = chunkCoord(p.x + half);
    const c0z = chunkCoord(p.z - half), c1z = chunkCoord(p.z + half);


    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fillRect(0, 0, css, css);

    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const key = chunkKey(cx, cz);
        if (!this.seen.has(key)) continue;
        const t = this.tiles.get(key);
        if (!t) continue;
        const pt = worldToScreen(cx * MAP_CHUNK, cz * MAP_CHUNK, view, css, css);
        const w = MAP_CHUNK * scale + 0.9;
        if (this.layers.terrain) ctx.drawImage(t.land, pt.x, pt.y, w, w);
        if (this.layers.water) ctx.drawImage(t.water, pt.x, pt.y, w, w);
      }
    }


    const grid = 64;
    const left = p.x - half, right = p.x + half;
    const top = p.z - half, bottom = p.z + half;
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.ceil(left / grid) * grid; gx <= right; gx += grid) {
      const sx = Math.round(worldToScreen(gx, p.z, view, css, css).x) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, css);
    }
    for (let gz = Math.ceil(top / grid) * grid; gz <= bottom; gz += grid) {
      const sy = Math.round(worldToScreen(p.x, gz, view, css, css).y) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(css, sy);
    }
    ctx.stroke();


    if (this.layers.sites) this._drawSites(ctx, view, css, css, true);


    if (this.layers.machines) {
      for (const m of this.opts.machines()) {
        const s = worldToScreen(m.x, m.z, view, css, css);
        if (s.x < -4 || s.y < -4 || s.x > css + 4 || s.y > css + 4) continue;
        ctx.fillStyle = this._machineColor(m, .9);
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      }
    }


    const cx = css / 2, cy = css / 2;
    const vg = ctx.createRadialGradient(cx, cy, css * 0.34, cx, cy, css * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, css, css);


    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const ang = Math.atan2(fz, fx);
    const rad = css * 0.23;
    const cone = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    cone.addColorStop(0, 'rgba(255,255,255,.14)');
    cone.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, ang - 0.5, ang + 0.5);
    ctx.closePath();
    ctx.fill();

    const onMap = (s) => s.x >= 6 && s.y >= 6 && s.x <= css - 6 && s.y <= css - 6;


    if (this.layers.deaths) {
      for (const d of this.deaths) {
        const s = worldToScreen(d.x, d.z, view, css, css);
        if (!onMap(s)) continue;
        ctx.strokeStyle = '#ff4a3a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(s.x - 3, s.y - 3); ctx.lineTo(s.x + 3, s.y + 3);
        ctx.moveTo(s.x + 3, s.y - 3); ctx.lineTo(s.x - 3, s.y + 3);
        ctx.stroke();
      }
    }


    if (this.layers.bookmarks) {
      for (const b of this.bookmarks) {
        const s = worldToScreen(b.x, b.z, view, css, css);
        if (!onMap(s)) continue;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 3.5);
        ctx.lineTo(s.x + 3, s.y);
        ctx.lineTo(s.x, s.y + 3.5);
        ctx.lineTo(s.x - 3, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }


    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + fx * 5.5, cy + fz * 5.5);
    ctx.lineTo(cx - fx * 3 - fz * 3.6, cy - fz * 3 + fx * 3.6);
    ctx.lineTo(cx - fx * 3 + fz * 3.6, cy - fz * 3 - fx * 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();


    if (this.layers.bookmarks) this._drawMiniEdgeMarks(ctx, view, css, this.bookmarks, 'bookmark', 4);
    if (this.layers.deaths) this._drawMiniEdgeMarks(ctx, view, css, this.deaths, 'death', 2);


    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', css / 2, 11);


    const metres = [10, 25, 50, 100].find((m) => m * scale >= 34 && m * scale <= css * 0.42) || 50;
    const len = metres * scale;
    const bx = 6, by = css - 9;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + len, by);
    ctx.moveTo(bx, by - 3); ctx.lineTo(bx, by + 3);
    ctx.moveTo(bx + len, by - 3); ctx.lineTo(bx + len, by + 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${metres} m`, bx, by - 5);


    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${p.x.toFixed(0)} / ${p.z.toFixed(0)}`, css - 5, css - 5);
    ctx.textAlign = 'left';
  }

  _machineColor(m, alpha = 1) {
    const kind = m?.def?.kind;
    if (kind === 'reactor') return `rgba(255,130,108,${alpha})`;
    if (kind === 'generator') return `rgba(255,216,140,${alpha})`;
    return `rgba(255,255,255,${alpha})`;
  }

  _drawMiniEdgeMarks(ctx, view, css, list, type, limit) {
    const cx = css / 2, cy = css / 2, R = css / 2 - 7;
    const out = [];
    for (const m of list) {
      const s = worldToScreen(m.x, m.z, view, css, css);
      if (s.x >= 0 && s.y >= 0 && s.x <= css && s.y <= css) continue;
      out.push({ m, d: Math.hypot(s.x - cx, s.y - cy), a: Math.atan2(s.y - cy, s.x - cx) });
    }
    out.sort((a, b) => a.d - b.d);
    for (const { a } of out.slice(0, limit)) {
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = type === 'death' ? '#ff4a3a' : 'rgba(255,255,255,.88)';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-2.5, -3);
      ctx.lineTo(-2.5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }


  drawFull() {
    if (!this.open) return;
    this._dirty = false;
    this._resize();
    const ctx = this.ctx2d;
    const w = this._w, h = this._h;
    const view = this.view;
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, w, h);

    ctx.imageSmoothingEnabled = view.scale < 2;
    ctx.imageSmoothingQuality = 'high';

    const worldLeft = view.x - w / 2 / view.scale;
    const worldRight = view.x + w / 2 / view.scale;
    const worldTop = view.z - h / 2 / view.scale;
    const worldBottom = view.z + h / 2 / view.scale;
    const c0x = chunkCoord(worldLeft), c1x = chunkCoord(worldRight);
    const c0z = chunkCoord(worldTop), c1z = chunkCoord(worldBottom);

    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const key = chunkKey(cx, cz);
        if (!this.seen.has(key)) continue;
        const t = this.tiles.get(key);
        const pt = worldToScreen(cx * MAP_CHUNK, cz * MAP_CHUNK, view, w, h);
        const size = MAP_CHUNK * view.scale + 0.9;
        if (t) {
          if (this.layers.terrain) ctx.drawImage(t.land, pt.x, pt.y, size, size);
          if (this.layers.water) ctx.drawImage(t.water, pt.x, pt.y, size, size);
        }
      }
    }

    this._labelBoxes = [];
    this._drawGrid(ctx, view, w, h);

    if (this.layers.sites) this._drawSites(ctx, view, w, h, false);

    this._hits = [];

    this._drawSelectionLine(ctx, view, w, h);
    if (this.layers.machines) this._drawMachines(ctx, view, w, h);
    if (this.layers.deaths) this._drawMarkers(ctx, view, w, h, this.deaths, 'death');
    if (this.layers.bookmarks) this._drawMarkers(ctx, view, w, h, this.bookmarks, 'bookmark');

    this._drawPlayer(ctx, view, w, h);
    this._drawScale(ctx, view, w, h);
    this.paintSidebar();
  }

  _visible(x, z, view, w, h, pad = 20) {
    const s = worldToScreen(x, z, view, w, h);
    return s.x > -pad && s.y > -pad && s.x < w + pad && s.y < h + pad ? s : null;
  }

  _drawGrid(ctx, view, w, h) {
    const step = gridStep(view.scale);
    const major = step * 4;
    const left = view.x - w / 2 / view.scale;
    const right = view.x + w / 2 / view.scale;
    const top = view.z - h / 2 / view.scale;
    const bottom = view.z + h / 2 / view.scale;
    ctx.lineWidth = 1;
    for (const [spacing, alpha] of [[step, 0.028], [major, 0.06]]) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      for (let gx = Math.ceil(left / spacing) * spacing; gx <= right; gx += spacing) {
        const sx = Math.round(worldToScreen(gx, view.z, view, w, h).x) + 0.5;
        ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
      }
      for (let gz = Math.ceil(top / spacing) * spacing; gz <= bottom; gz += spacing) {
        const sy = Math.round(worldToScreen(view.x, gz, view, w, h).y) + 0.5;
        ctx.moveTo(0, sy); ctx.lineTo(w, sy);
      }
      ctx.stroke();
    }
  }

  _drawSites(ctx, view, w, h, mini) {
    const cell = this.opts.industrialCell || 96;
    const worldLeft = view.x - w / 2 / view.scale;
    const worldRight = view.x + w / 2 / view.scale;
    const worldTop = view.z - h / 2 / view.scale;
    const worldBottom = view.z + h / 2 / view.scale;
    const x0 = Math.floor(worldLeft / cell), x1 = Math.floor(worldRight / cell);
    const z0 = Math.floor(worldTop / cell), z1 = Math.floor(worldBottom / cell);
    if (x1 - x0 > 30 || z1 - z0 > 30) return;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const site = this.opts.industrialSite?.(cx, cz);
        if (!site) continue;
        if (!this.seen.has(chunkKey(chunkCoord(site.x), chunkCoord(site.z)))) continue;
        const s = worldToScreen(site.x, site.z, view, w, h);
        const hw = site.padX * view.scale, hh = site.padZ * view.scale;
        if (hw < 1.5 || hh < 1.5) {
          ctx.fillStyle = 'rgba(210,205,190,.75)';
          ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
          continue;
        }
        ctx.fillStyle = mini ? 'rgba(210,205,190,.55)' : 'rgba(210,205,190,.18)';
        ctx.fillRect(s.x - hw, s.y - hh, hw * 2, hh * 2);
        if (!mini) {
          ctx.strokeStyle = 'rgba(216,211,196,.32)';
          ctx.lineWidth = 1;
          ctx.strokeRect(s.x - hw, s.y - hh, hw * 2, hh * 2);
        }
      }

      if (!mini && view.scale >= 1.3) {

        for (let cx = x0; cx <= x1; cx++) {
          const site = this.opts.industrialSite?.(cx, cz);
          if (!site) continue;
          if (!this.seen.has(chunkKey(chunkCoord(site.x), chunkCoord(site.z)))) continue;
          if (site.padX * view.scale < 14) continue;
          const s = worldToScreen(site.x, site.z, view, w, h);
          this._label(ctx, this._siteName(site), s.x + 6, s.y - site.padZ * view.scale + 9);
        }
      }
    }
  }

  _siteName(site) {
    const id = site.parts?.[0]?.id || '';
    if (id === 'building_a') return 'BUILDING';
    if (id === 'garage') return 'GARAGE';
    if (id.startsWith('container')) return 'CONTAINER YARD';
    return 'SITE';
  }

  _drawMachines(ctx, view, w, h) {
    for (const m of this.opts.machines()) {
      const s = this._visible(m.x, m.z, view, w, h);
      if (!s) continue;
      const hovered = this._hover?.type === 'machine' && this._hover.id === m.uid;
      ctx.strokeStyle = this._machineColor(m, hovered ? 1 : .78);
      ctx.lineWidth = hovered ? 2 : 1.5;
      const r = hovered ? 4.5 : 3;
      ctx.strokeRect(s.x - r, s.y - r, r * 2, r * 2);
      if (hovered) this._label(ctx, m.def?.name || 'MACHINE', s.x + 8, s.y + 3.5, true);
      this._hits.push({
        type: 'machine', id: m.uid, sx: s.x, sy: s.y,
        label: m.def?.name || 'MACHINE',
      });
    }
  }

  _drawMarkers(ctx, view, w, h, list, type) {
    const selectedId = this.selected?.type === type ? this.selected.id : null;
    const hoverId = this._hover?.type === type ? this._hover.id : null;
    ctx.textAlign = 'left';
    ctx.font = '700 10px ui-monospace, monospace';
    for (const m of list) {
      const s = this._visible(m.x, m.z, view, w, h);
      if (!s) continue;
      const selected = m.id === selectedId;
      const hovered = m.id === hoverId;
      const active = selected || hovered;

      if (selected || hovered) {
        ctx.strokeStyle = selected ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.34)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (type === 'death') {
        ctx.strokeStyle = active ? '#fff' : '#ff4a3a';
        ctx.lineWidth = active ? 2.6 : 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y - 4); ctx.lineTo(s.x + 4, s.y + 4);
        ctx.moveTo(s.x + 4, s.y - 4); ctx.lineTo(s.x - 4, s.y + 4);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 5);
        ctx.lineTo(s.x + 4, s.y);
        ctx.lineTo(s.x, s.y + 5);
        ctx.lineTo(s.x - 4, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      const name = type === 'death' ? `DIED D${m.day}` : m.name;
      const showLabel = active || (type === 'bookmark' && view.scale >= 0.55)
        || (type === 'death' && view.scale >= 1.1);
      if (showLabel) this._label(ctx, name, s.x + 9, s.y + 3.5, active);

      this._hits.push({ type, id: m.id, sx: s.x, sy: s.y, label: name });
    }
  }

  _label(ctx, text, x, y, force = false) {
    if (!text) return false;
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    const pw = ctx.measureText(text).width;
    const box = { x: x - 2, y: y - 9, w: pw + 4, h: 12 };
    if (!force) {
      for (const b of this._labelBoxes) {
        if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) return false;
      }
    }
    this._labelBoxes.push(box);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y);
    return true;
  }

  _drawSelectionLine(ctx, view, w, h) {
    const m = this._markerById(this.selected);
    if (!m) return;
    const p = this.opts.player();
    const a = worldToScreen(p.x, p.z, view, w, h);
    const b = worldToScreen(m.x, m.z, view, w, h);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    const dist = Math.hypot(m.x - p.x, m.z - p.z);
    this._label(ctx, `${dist.toFixed(0)} m`, (a.x + b.x) / 2 + 7, (a.y + b.y) / 2 - 5, true);
  }

  _drawPlayer(ctx, view, w, h) {
    const p = this.opts.player();
    const s = worldToScreen(p.x, p.z, view, w, h);
    if (s.x < -30 || s.y < -30 || s.x > w + 30 || s.y > h + 30) return;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);


    const ang = Math.atan2(fz, fx);
    const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 34);
    grad.addColorStop(0, 'rgba(255,255,255,.12)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.arc(s.x, s.y, 34, ang - 0.5, ang + 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x + fx * 8, s.y + fz * 8);
    ctx.lineTo(s.x - fx * 4 - fz * 5, s.y - fz * 4 + fx * 5);
    ctx.lineTo(s.x - fx * 4 + fz * 5, s.y - fz * 4 - fx * 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _drawScale(ctx, view, w, h) {
    const targetPx = 90;
    const metres = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
      .find((m) => m * view.scale >= targetPx) || 5000;
    const px = metres * view.scale;
    const x = 16, y = h - 26;
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + px, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = '700 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(metres >= 1000 ? `${metres / 1000} km` : `${metres} m`, x, y - 8);
  }

  _click(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null, bd = 14;
    for (const hit of this._hits) {
      const d = Math.hypot(hit.sx - x, hit.sy - y);
      if (d < bd) { bd = d; best = hit; }
    }
    this.selected = best && best.type !== 'machine'
      ? { type: best.type, id: best.id }
      : null;
    this._dirty = true;
    this.paintSidebar();
    this.requestDraw();
  }

  _updateHover() {
    if (!this.open || !this._mouse) return;
    let best = null, bd = 13;
    for (const hit of this._hits) {
      const d = Math.hypot(hit.sx - this._mouse.x, hit.sy - this._mouse.y);
      if (d < bd) { bd = d; best = hit; }
    }
    const key = (h) => (h ? `${h.type}:${h.id}` : '');
    if (key(best) === key(this._hover)) return;
    this._hover = best;
    this.canvas.style.cursor = best ? 'pointer' : 'grab';
    this._dirty = true;
    this.requestDraw();
  }

  _paintCursor() {
    if (!this.cursorEl) return;
    if (!this.open || !this._mouse) { this.cursorEl.textContent = ''; return; }
    const p = screenToWorld(this._mouse.x, this._mouse.y, this.view, this._w, this._h);
    const biome = this.opts.biomeName(this.opts.sample(p.x, p.z).biome);
    this.cursorEl.textContent = `${p.x.toFixed(0)}, ${p.z.toFixed(0)} · ${biome}`;
  }


  paintSidebar() {
    if (!this.infoEl) return;
    const p = this.opts.player();
    const c = this.opts.clock();
    const biome = this.opts.biomeName(this.opts.sample(p.x, p.z).biome);
    this.infoEl.innerHTML =
      `<div>X <b>${p.x.toFixed(1)}</b> · Z <b>${p.z.toFixed(1)}</b></div>` +
      `<div>${biome} · DAY <b>${c.day}</b> · ${this._clockStr(c)}</div>` +
      `<div>CENTRE <b>${this.view.x.toFixed(0)}, ${this.view.z.toFixed(0)}</b> · ZOOM <b>${this.view.scale.toFixed(2)}</b> · SEEN <b>${this.seen.size}</b></div>`;

    if (this.layersEl) {
      this.layersEl.innerHTML = Object.keys(LAYER_NAMES).map((k) =>
        `<button class="mapLayer${this.layers[k] ? ' on' : ''}" data-layer="${k}">${LAYER_NAMES[k]}</button>`).join('');
    }

    if (this.markersEl) {
      const dist = (m) => Math.hypot(m.x - p.x, m.z - p.z);
      const marks = [...this.bookmarks].sort((a, b) => dist(a) - dist(b));
      const deaths = [...this.deaths].sort((a, b) => dist(a) - dist(b));
      const row = (m, type) => {
        const sel = this.selected?.type === type && this.selected.id === m.id;
        const name = type === 'death' ? `DIED · DAY ${m.day}` : m.name;
        return `<div class="mapMark${sel ? ' sel' : ''}" data-mark="${type}" data-id="${m.id}">` +
          `<i class="mi ${type}"></i><span class="mb"><span class="mn">${escapeHtml(name)}</span>` +
          `<span class="md">${m.x.toFixed(0)}, ${m.z.toFixed(0)} · ${dist(m).toFixed(0)} m</span></span></div>`;
      };
      this.markersEl.innerHTML =
        (marks.length ? marks.map((m) => row(m, 'bookmark')).join('') : '<div class="mapEmpty">NO BOOKMARKS · B IN GAME</div>') +
        (deaths.length ? `<div class="mapSectionTitle">DEATH SPOTS</div>${deaths.map((m) => row(m, 'death')).join('')}` : '');
    }

    const selMark = this.selected?.type === 'bookmark' ? this._markerById(this.selected) : null;
    if (this.renameRow) this.renameRow.classList.toggle('hidden', !selMark);
    if (selMark && this.nameInput && this._nameId !== selMark.id) {
      this._nameId = selMark.id;
      this.nameInput.value = selMark.name;
    } else if (!selMark) {
      this._nameId = null;
    }
    if (this.deleteBtn) this.deleteBtn.disabled = !this.selected;
  }

  _clockStr(c) {
    const total = Math.max(0, c.t || 0);
    const hh = Math.floor(total / (c.daySeconds || 900) * 24);
    const mm = Math.floor((total / (c.daySeconds || 900) * 24 - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

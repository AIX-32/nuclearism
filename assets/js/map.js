










export const MAP_CHUNK = 16;

const TILE_PX = 16;
const REVEAL_RADIUS = 3;
const TILE_CACHE_MAX = 1400;
const MINIMAP_RANGE = 200;
const MINIMAP_REDRAW_MS = 90;
const TILE_BUDGET_MS = 4;
const MIN_ZOOM = 0.04;
const MAX_ZOOM = 10;



const BAND_SHADE = [0.76, 0.84, 0.91, 0.97, 1.03, 1.09, 1.15, 1.21];
const BAND_METRES = 10;


const SITE_COLORS = {
  building_a: '#9a968c',
  garage: '#7c7a73',
  container_01: '#a9552e',
  container_02: '#4e7080',
  container_03: '#6f7d43',
  liquid_tank: '#b6c2c9',
};

const MACHINE_COLORS = {
  reactor: '#ff5a3c',
  generator: '#ffd257',
  absorber: '#59e07a',
  scrubber: '#4fc9ff',
  excavator: '#ff9b3d',
  cable: '#7d7d7d',
  storage: '#cfcfcf',
  pylon: '#d8e4ff',
};


const WALL_COLORS = {
  wood: '#8a5a33',
  brick: '#9a4a3a',
  concrete: '#9a9a96',
  shielded: '#6e7a86',
};


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
  terrain: true, sites: true, machines: true, walls: true,
  deaths: true, bookmarks: true, strikes: true,
};

const LAYER_NAMES = {
  terrain: 'TERRAIN', sites: 'SITES', machines: 'MACHINES', walls: 'WALLS',
  deaths: 'DEATHS', bookmarks: 'MARKS', strikes: 'STRIKES',
};

export class MapSystem {
  constructor(opts) {
    this.opts = opts;
    this.seen = new Set();
    this.tiles = new Map();
    this.bookmarks = [];
    this.deaths = [];
    this.strikes = [];
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
    if (Array.isArray(data.strikes)) {
      for (const s of data.strikes) {
        if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
        this.strikes.push({
          id: Number.isFinite(s.id) ? s.id : this.nextId++,
          x: +s.x, z: +s.z, day: Number.isFinite(s.day) ? s.day : 1,
          r: Number.isFinite(s.r) ? +s.r : 28,
        });
        this.nextId = Math.max(this.nextId, (s.id | 0) + 1);
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
      strikes: this.strikes.map((s) => ({
        id: s.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), day: s.day, r: +(+s.r || 28).toFixed(2),
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

  noteStrike(x, z, day, r = 28) {
    const near = this.strikes.find((s) => Math.hypot(s.x - x, s.z - z) < 12);
    if (near) { near.x = +x; near.z = +z; near.day = day; near.r = r; }
    else this.strikes.push({ id: this.nextId++, x: +x, z: +z, day: day | 0, r: +r });
    this._dirty = true;
    this.opts.save?.();
    this.requestDraw();
  }

  _markerById(sel) {
    if (!sel) return null;
    const list = sel.type === 'death' ? this.deaths : sel.type === 'strike' ? this.strikes : this.bookmarks;
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
    const list = this.selected.type === 'death' ? this.deaths : this.selected.type === 'strike' ? this.strikes : this.bookmarks;
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
    const S = TILE_PX;
    const land = document.createElement('canvas');
    land.width = land.height = S;
    const lctx = land.getContext('2d');
    const img = lctx.createImageData(S, S);
    const sea = this.opts.seaLevel;

    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = cx * MAP_CHUNK + i + 0.5;
        const z = cz * MAP_CHUNK + j + 0.5;
        const s = this.opts.sample(x, z);
        const band = clamp(Math.floor((s.h - sea + 5) / BAND_METRES), 0, BAND_SHADE.length - 1);
        const k = BAND_SHADE[band];
        const c = this.opts.surfaceColor(x, z, s.h) || [0.4, 0.5, 0.3];
        const o = (j * S + i) * 4;
        img.data[o] = clamp(Math.round(c[0] * 255 * k), 0, 255);
        img.data[o + 1] = clamp(Math.round(c[1] * 255 * k), 0, 255);
        img.data[o + 2] = clamp(Math.round(c[2] * 255 * k), 0, 255);
        img.data[o + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    return { land };
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

    const p = this.opts.player();
    const scale = css / MINIMAP_RANGE;
    const view = { x: p.x, z: p.z, scale };
    const half = MINIMAP_RANGE / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, css, css);

    if (this.layers.terrain) this._drawTiles(ctx, view, css, css);
    if (this.layers.strikes) this._drawCraters(ctx, view, css, css);

    const grid = 64;
    const left = p.x - half, right = p.x + half;
    const top = p.z - half, bottom = p.z + half;
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
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

    if (this.layers.sites) this._drawSites(ctx, view, css, css);
    if (this.layers.walls) this._drawWalls(ctx, view, css, css, true);
    if (this.layers.machines) this._drawMachines(ctx, view, css, css, true);
    if (this.layers.deaths) this._drawMarkers(ctx, view, css, css, this.deaths, 'death', true);
    if (this.layers.bookmarks) this._drawMarkers(ctx, view, css, css, this.bookmarks, 'bookmark', true);
    if (this.layers.strikes) this._drawMarkers(ctx, view, css, css, this.strikes, 'strike', true);

    this._drawPlayer(ctx, view, css, css);

    if (this.layers.bookmarks) this._drawMiniEdgeMarks(ctx, view, css, this.bookmarks, 'bookmark', 4);
    if (this.layers.deaths) this._drawMiniEdgeMarks(ctx, view, css, this.deaths, 'death', 2);
    if (this.layers.strikes) this._drawMiniEdgeMarks(ctx, view, css, this.strikes, 'strike', 2);

    this._drawScaleBar(ctx, view, css, css, 34);
  }

  _drawTiles(ctx, view, w, h) {
    const left = view.x - w / 2 / view.scale;
    const right = view.x + w / 2 / view.scale;
    const top = view.z - h / 2 / view.scale;
    const bottom = view.z + h / 2 / view.scale;
    const c0x = chunkCoord(left), c1x = chunkCoord(right);
    const c0z = chunkCoord(top), c1z = chunkCoord(bottom);

    const sxp = (wx) => Math.round((wx - view.x) * view.scale + w / 2);
    const szp = (wz) => Math.round((wz - view.z) * view.scale + h / 2);
    ctx.imageSmoothingEnabled = MAP_CHUNK * view.scale < TILE_PX;
    const draw = (cx, cz) => {
      const key = chunkKey(cx, cz);
      if (!this.seen.has(key)) return;
      const t = this.tiles.get(key);
      if (!t) return;
      const x0 = sxp(cx * MAP_CHUNK), y0 = szp(cz * MAP_CHUNK);
      ctx.drawImage(t.land, x0, y0, sxp((cx + 1) * MAP_CHUNK) - x0, szp((cz + 1) * MAP_CHUNK) - y0);
    };
    if (c1x - c0x > 64 || c1z - c0z > 64) {

      for (const key of this.seen) {
        const [cx, cz] = keyToChunk(key);
        if (cx < c0x || cx > c1x || cz < c0z || cz > c1z) continue;
        draw(cx, cz);
      }
    } else {
      for (let cz = c0z; cz <= c1z; cz++) {
        for (let cx = c0x; cx <= c1x; cx++) draw(cx, cz);
      }
    }
    ctx.imageSmoothingEnabled = false;
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
      ctx.fillStyle = type === 'death' ? '#ff4a3a' : type === 'strike' ? '#ffb000' : 'rgba(255,255,255,.88)';
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    this._labelBoxes = [];
    this._hits = [];

    if (this.layers.terrain) this._drawTiles(ctx, view, w, h);
    if (this.layers.strikes) this._drawCraters(ctx, view, w, h);
    this._drawGrid(ctx, view, w, h);

    if (this.layers.sites) this._drawSites(ctx, view, w, h);
    this._drawSelectionLine(ctx, view, w, h);
    if (this.layers.walls) this._drawWalls(ctx, view, w, h);
    if (this.layers.machines) this._drawMachines(ctx, view, w, h);
    if (this.layers.deaths) this._drawMarkers(ctx, view, w, h, this.deaths, 'death');
    if (this.layers.bookmarks) this._drawMarkers(ctx, view, w, h, this.bookmarks, 'bookmark');
    if (this.layers.strikes) this._drawMarkers(ctx, view, w, h, this.strikes, 'strike');

    this._drawPlayer(ctx, view, w, h);
    this._drawScaleBar(ctx, view, w, h, 90);
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

  _drawSites(ctx, view, w, h) {
    const cell = this.opts.industrialCell || 96;
    const worldLeft = view.x - w / 2 / view.scale;
    const worldRight = view.x + w / 2 / view.scale;
    const worldTop = view.z - h / 2 / view.scale;
    const worldBottom = view.z + h / 2 / view.scale;
    const x0 = Math.floor(worldLeft / cell), x1 = Math.floor(worldRight / cell);
    const z0 = Math.floor(worldTop / cell), z1 = Math.floor(worldBottom / cell);
    if (x1 - x0 > 40 || z1 - z0 > 40) return;
    const dims = this.opts.industrialDims || {};
    const sxp = (wx) => Math.round((wx - view.x) * view.scale + w / 2);
    const szp = (wz) => Math.round((wz - view.z) * view.scale + h / 2);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const site = this.opts.industrialSite?.(cx, cz);
        if (!site) continue;
        if (!this.seen.has(chunkKey(chunkCoord(site.x), chunkCoord(site.z)))) continue;
        for (const part of site.parts) {
          const d = dims[part.id];
          if (!d) continue;
          const sc = part.scale || 1;
          const q = ((Math.round((part.yaw || 0) / (Math.PI / 2)) % 4) + 4) % 4;
          const hx = (q % 2 ? d.hz : d.hx) * sc;
          const hz = (q % 2 ? d.hx : d.hz) * sc;
          const wx = site.x + part.dx, wz = site.z + part.dz;
          const px = sxp(wx - hx), py = szp(wz - hz);
          const pw = Math.max(1, sxp(wx + hx) - px);
          const ph = Math.max(1, szp(wz + hz) - py);
          ctx.fillStyle = SITE_COLORS[part.id] || '#b9b4a6';
          ctx.fillRect(px, py, pw, ph);
          if (pw > 2 && ph > 2) {
            ctx.fillStyle = 'rgba(0,0,0,.5)';
            ctx.fillRect(px, py, pw, 1);
            ctx.fillRect(px, py + ph - 1, pw, 1);
            ctx.fillRect(px, py, 1, ph);
            ctx.fillRect(px + pw - 1, py, 1, ph);
          }
        }
      }
    }
  }


  _drawWalls(ctx, view, w, h, mini = false) {
    const list = this.opts.walls?.() || [];
    for (const p of list) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [key] of p.cells) {
        const [cx, , cz] = key.split(',').map(Number);
        if (cx < minX) minX = cx;
        if (cx + 1 > maxX) maxX = cx + 1;
        if (cz < minZ) minZ = cz;
        if (cz + 1 > maxZ) maxZ = cz + 1;
      }
      if (!isFinite(minX)) continue;
      const a = worldToScreen(minX, minZ, view, w, h);
      const b = worldToScreen(maxX, maxZ, view, w, h);
      if (Math.max(b.x, a.x) < 0 || Math.min(b.x, a.x) > w) continue;
      if (Math.max(b.y, a.y) < 0 || Math.min(b.y, a.y) > h) continue;
      const px = Math.round(Math.min(a.x, b.x)), py = Math.round(Math.min(a.y, b.y));
      const pw = Math.max(1, Math.round(Math.abs(b.x - a.x)));
      const ph = Math.max(1, Math.round(Math.abs(b.y - a.y)));
      ctx.fillStyle = WALL_COLORS[p.tier] || '#cfcfcf';
      ctx.fillRect(px, py, pw, ph);
    }
  }

  _drawMachines(ctx, view, w, h, mini = false) {
    for (const m of this.opts.machines()) {
      const s = this._visible(m.x, m.z, view, w, h);
      if (!s) continue;
      const kind = m.def?.kind;
      const size = kind === 'reactor' ? 4 : 3;
      const px = Math.round(s.x - size / 2), py = Math.round(s.y - size / 2);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(px + 1, py + 1, size, size);
      ctx.fillStyle = MACHINE_COLORS[kind] || '#f0f0f0';
      ctx.fillRect(px, py, size, size);
      if (mini) continue;
      const hovered = this._hover?.type === 'machine' && this._hover.id === m.uid;
      if (hovered) {
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 1.5, py - 1.5, size + 3, size + 3);
        this._label(ctx, m.def?.name || 'MACHINE', s.x + 8, s.y + 3.5, true);
      }
      this._hits.push({
        type: 'machine', id: m.uid, sx: s.x, sy: s.y,
        label: m.def?.name || 'MACHINE',
      });
    }
  }

  _drawCraters(ctx, view, w, h) {
    for (const s of this.strikes) {
      if (!this.seen.has(chunkKey(chunkCoord(s.x), chunkCoord(s.z)))) continue;
      const p = this._visible(s.x, s.z, view, w, h, (s.r || 28) * view.scale + 4);
      if (!p) continue;
      const r = Math.max(1, (s.r || 28) * view.scale);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,55,0.55)';
      ctx.lineWidth = Math.max(1, view.scale * 1.5);
      ctx.stroke();
    }
  }

  _drawMarkers(ctx, view, w, h, list, type, mini = false) {
    const selectedId = this.selected?.type === type ? this.selected.id : null;
    const hoverId = this._hover?.type === type ? this._hover.id : null;
    for (const m of list) {
      const s = this._visible(m.x, m.z, view, w, h);
      if (!s) continue;
      const selected = m.id === selectedId;
      const hovered = m.id === hoverId;
      const active = selected || hovered;
      const px = Math.round(s.x), py = Math.round(s.y);

      if (type === 'death') {
        const cross = (ox, oy) => {
          ctx.fillRect(px + ox - 2, py + oy - 2, 1, 1);
          ctx.fillRect(px + ox - 1, py + oy - 1, 1, 1);
          ctx.fillRect(px + ox, py + oy, 1, 1);
          ctx.fillRect(px + ox + 1, py + oy + 1, 1, 1);
          ctx.fillRect(px + ox + 2, py + oy + 2, 1, 1);
          ctx.fillRect(px + ox + 2, py + oy - 2, 1, 1);
          ctx.fillRect(px + ox + 1, py + oy - 1, 1, 1);
          ctx.fillRect(px + ox - 1, py + oy + 1, 1, 1);
          ctx.fillRect(px + ox - 2, py + oy + 2, 1, 1);
        };
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        cross(1, 1);
        ctx.fillStyle = active ? '#fff' : '#ff4a3a';
        cross(0, 0);
      } else if (type === 'strike') {
        const blast = (ox, oy, c) => {
          ctx.fillStyle = c;
          ctx.fillRect(px + ox - 1, py + oy - 3, 3, 1);
          ctx.fillRect(px + ox - 3, py + oy - 1, 7, 3);
          ctx.fillRect(px + ox - 1, py + oy + 2, 3, 1);
          ctx.fillRect(px + ox - 2, py + oy - 2, 1, 1);
          ctx.fillRect(px + ox + 2, py + oy - 2, 1, 1);
          ctx.fillRect(px + ox - 2, py + oy + 2, 1, 1);
          ctx.fillRect(px + ox + 2, py + oy + 2, 1, 1);
        };
        blast(1, 1, 'rgba(0,0,0,.6)');
        blast(0, 0, active ? '#fff' : '#ffb000');
        ctx.fillStyle = active ? '#fff' : '#ff5a00';
        ctx.fillRect(px, py, 1, 1);
      } else {
        const diamond = (ox, oy) => {
          ctx.fillRect(px + ox, py + oy - 2, 1, 1);
          ctx.fillRect(px + ox - 1, py + oy - 1, 3, 1);
          ctx.fillRect(px + ox - 2, py + oy, 5, 1);
          ctx.fillRect(px + ox - 1, py + oy + 1, 3, 1);
          ctx.fillRect(px + ox, py + oy + 2, 1, 1);
        };
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        diamond(1, 1);
        ctx.fillStyle = active ? '#fff' : '#f2f2f2';
        diamond(0, 0);
      }

      if (active && !mini) {
        ctx.strokeStyle = selected ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.45)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 4.5, py - 4.5, 10, 10);
      }

      const name = type === 'death' ? `DIED D${m.day}` : type === 'strike' ? `NUKE D${m.day}` : m.name;
      if (active && !mini) this._label(ctx, name, s.x + 9, s.y + 3.5, true);

      if (!mini) this._hits.push({ type, id: m.id, sx: s.x, sy: s.y, label: name });
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
  }

  _drawPlayer(ctx, view, w, h) {
    const p = this.opts.player();
    const s = worldToScreen(p.x, p.z, view, w, h);
    if (s.x < -30 || s.y < -30 || s.x > w + 30 || s.y > h + 30) return;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const ang = Math.atan2(fz, fx);


    const rad = Math.min(90, Math.min(w, h) * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.arc(s.x, s.y, rad, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();

    const L = Math.min(9, Math.max(5, Math.min(w, h) * 0.045));
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x + fx * L, s.y + fz * L);
    ctx.lineTo(s.x - fx * L * 0.5 - fz * L * 0.45, s.y - fz * L * 0.5 + fx * L * 0.45);
    ctx.lineTo(s.x - fx * L * 0.5 + fz * L * 0.45, s.y - fz * L * 0.5 - fx * L * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  _drawScaleBar(ctx, view, w, h, targetPx = 90) {
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

  paintSidebar() {
    const p = this.opts.player();

    if (this.layersEl) {
      this.layersEl.innerHTML = Object.keys(LAYER_NAMES).map((k) =>
        `<button class="mapLayer${this.layers[k] ? ' on' : ''}" data-layer="${k}">${LAYER_NAMES[k]}</button>`).join('');
    }

    if (this.markersEl) {
      const dist = (m) => Math.hypot(m.x - p.x, m.z - p.z);
      const marks = [...this.bookmarks].sort((a, b) => dist(a) - dist(b));
      const deaths = [...this.deaths].sort((a, b) => dist(a) - dist(b));
      const strikes = [...this.strikes].sort((a, b) => dist(a) - dist(b));
      const row = (m, type) => {
        const sel = this.selected?.type === type && this.selected.id === m.id;
        const name = type === 'death' ? `DIED · DAY ${m.day}` : type === 'strike' ? `NUKE · DAY ${m.day}` : m.name;
        return `<div class="mapMark${sel ? ' sel' : ''}" data-mark="${type}" data-id="${m.id}">` +
          `<i class="mi ${type}"></i><span class="mb"><span class="mn">${escapeHtml(name)}</span>` +
          `<span class="md">${m.x.toFixed(0)}, ${m.z.toFixed(0)} · ${dist(m).toFixed(0)} m</span></span></div>`;
      };
      this.markersEl.innerHTML =
        (marks.length ? marks.map((m) => row(m, 'bookmark')).join('') : '<div class="mapEmpty">NO BOOKMARKS · B IN GAME</div>') +
        (deaths.length ? `<div class="mapSectionTitle">DEATH SPOTS</div>${deaths.map((m) => row(m, 'death')).join('')}` : '') +
        (strikes.length ? `<div class="mapSectionTitle">NUCLEAR STRIKES</div>${strikes.map((m) => row(m, 'strike')).join('')}` : '');
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
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

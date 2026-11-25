


import * as THREE from 'three';
import { renderSettings } from './settings.js';
import { idbGet, idbSet, idbRemove } from './idb-store.js';

const WORLDS_KEY = 'idte.worlds.v1';
const DISCORD_URL = 'https://discord.gg/jX4Nm9Hq8P';

const menu = document.getElementById('menu');
const overlay = document.getElementById('overlay');
const loadingView = document.querySelector('#overlay .view-loading');
const loadingStatus = document.querySelector('#overlay .loading-status');
const loadingHint = document.querySelector('#overlay .loading-hint');
const loadingTip = document.querySelector('#overlay .loading-tip');
const listEl = document.getElementById('worldList');
const playBtn = document.getElementById('worldPlayBtn');
const editBtn = document.getElementById('worldEditBtn');
const createName = document.getElementById('createName');
const createSeed = document.getElementById('createSeed');
const editName = document.getElementById('editName');
const editColor = document.getElementById('editColor');
const editColorClear = document.getElementById('editColorClear');
const createMode = document.getElementById('createMode');
const createTerrain = document.getElementById('createTerrain');
const createStart = document.getElementById('createStart');
const createFallout = document.getElementById('createFallout');
const legacyModal = document.getElementById('legacyModal');

const LOADING_TIPS = [
  'Radiation ramps up from day 3, build shielding before the dose turns lethal at 600 rad.',
  'Water only comes from industrial tanks or a powered water pump; there are no lakes or rivers.',
  'Press M to open the map and B to drop a bookmark where you stand.',
  'Armor and shielding plates cut the radiation dose you take.',
  'Reactor cooling must match the fuel, over-cooling costs power as much as under-cooling.',
  'Mine a chunk to sample its ore seam, then place an excavator on the good ones.',
  'The NEXT STEP card in the corner tracks what to do first and advances as you progress.',
  'Wall panels block radiation from the direction of the source - shielded concrete stops almost all of it.',
  'Put every ore through the crusher, then smelt the powder to get double the ingots.',
  'Mine dirt with gardening gloves to get seeds and plant them in a greenhouse for good food.',
  'Use skylines to connect machines and automate things.',
  'Try to get the "Rammer" it is a good way to get around large areas quickly. Also rams down trees and other obstacles.',
  'Make Unrad to remove radiation from your body.',
  'Blueprints are things you need to research to unlock new more advanced machines and recipes.',
  'Making loading screen tips is fun.',
  'The game is still in development, so expect bugs and missing textures/models.',
  'Paranoia is an effect that makes you see things that are not there. It is caused by hunger and darkness.',
  'The Assembler is a not replacement for the Manufactory, they make different things.',
  'Every 10 days a nuclear strike will happen around you and spread radiation from that direction. Build more shielding to that side to protect yourself.',
  'The bucket wheel excavator is the largest machine in the game, It is used to mine insane amounts of ore and dirt.',
  'Walking directionaly gives you a small speed boost. Use it to get around faster.',
  'You can middle-click an inventory or container to sort items by category, then alphabetically.',
];

async function readJSON(key, fallback) {
  try {
    const val = await idbGet(key);
    if (val == null) return fallback;
    return typeof val === 'string' ? (JSON.parse(val) ?? fallback) : (val ?? fallback);
  } catch { return fallback; }
}
async function writeJSON(key, value) {
  try { await idbSet(key, value); } catch (e) { console.warn('[menu] save failed', key, e); }
}

let worlds = await readJSON(WORLDS_KEY, []);
if (!Array.isArray(worlds)) worlds = [];

const UNKNOWN_VERSION = 'unknown';
let GAME_VERSION = null;
try {
  const res = await fetch('version.json');
  if (res.ok) {
    const data = await res.json();
    if (typeof data?.version === 'string' && data.version) GAME_VERSION = data.version;
  }
} catch (e) { console.warn('[menu] could not read version.json', e); }
const versionEl = document.getElementById('menuVersion');
if (versionEl) versionEl.textContent = GAME_VERSION ? `Preview ${GAME_VERSION}` : '';
const worldVersion = () => GAME_VERSION || UNKNOWN_VERSION;
let versionBackfill = false;
for (const w of worlds) if (!w.version) { w.version = UNKNOWN_VERSION; versionBackfill = true; }
if (versionBackfill) await writeJSON(WORLDS_KEY, worlds);

let selectedId = null;
let newMode = 'survival';
let newTerrain = 'realistic';
let newStart = 'dawn';
let newFallout = 'normal';


function parseSeed(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) return Number(s) | 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

const START_OPTIONS = ['dawn', 'noon', 'dusk', 'night'];
const FALLOUT_OPTIONS = ['calm', 'normal', 'severe'];
function paintCycle(btn, key, value, label) {
  btn.dataset[key] = value;
  btn.textContent = `${label} · ${value.toUpperCase()}`;
  return value;
}
function nextCycle(btn, key, options, label) {
  const i = options.indexOf(btn.dataset[key]);
  return paintCycle(btn, key, options[(i + 1) % options.length], label);
}
function selectTerrain(terrain) {
  newTerrain = terrain;
  for (const b of createTerrain.querySelectorAll('button')) b.classList.toggle('on', b.dataset.terrain === terrain);
}

let pano = null;

const SPLASHES = [
  'Unlimited spicy rocks!',
  'Try nuclarcraft!',
  'shout out @TheCaptainsTV',
  'Now with 600% more dose!',
  'Geiger certified!',
  'Break a tree, get wood. Maybe not.',
  'Water is not a beverage yet.',
  'Reactor cooling is a suggestion.',
  'Radiation builds character.',
  '100% awful models.',
  'Not a replacement for IRL radaway.',
];
function paintSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  el.textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
}
document.getElementById('splash').addEventListener('click', paintSplash);

function startPanorama() {
  const canvas = document.getElementById('menuBg');
  if (!canvas || pano) return;
  canvas.style.opacity = '1';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x111111, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 100);
  const geometry = new THREE.SphereGeometry(40, 64, 32);
  geometry.scale(-1, 1, 1);


  const pool = ['panorama-4.png','panorama-6.png', 'panorama-8.png',]
    .map((f) => `assets/images/menu/${f}`);
  const textures = pool.map((url) => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    return t;
  });
  const index = Math.floor(Math.random() * textures.length);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: textures[index] }));
  scene.add(mesh);

  const clock = new THREE.Clock();
  const frame = () => {
    if (!pano) return;
    pano.raf = requestAnimationFrame(frame);
    mesh.rotation.y = clock.getElapsedTime() * 0.035;
    renderer.render(scene, camera);
  };

  pano = { renderer, scene, camera, geometry, textures, mesh, index, raf: 0 };
  addEventListener('resize', () => {
    if (!pano) return;
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  frame();
}

let panoFade = 0;
function stepPanorama(dir) {
  if (!pano) return;
  const canvas = document.getElementById('menuBg');
  clearTimeout(panoFade);
  canvas.style.opacity = '0';
  panoFade = setTimeout(() => {
    if (!pano) return;
    pano.index = (pano.index + dir + pano.textures.length) % pano.textures.length;
    pano.mesh.material.map = pano.textures[pano.index];
    pano.mesh.material.needsUpdate = true;
    canvas.style.opacity = '1';
  }, 220);
}

function stopPanorama() {
  if (!pano) return;
  cancelAnimationFrame(pano.raf);
  pano.geometry.dispose();
  for (const t of pano.textures) t.dispose();
  pano.renderer.dispose();
  pano = null;
}

overlay.style.display = 'none';
menu.classList.remove('hidden');

let loadingFrame = 0;
let tipTimer = 0;
let tipIdx = -1;

function showRandomTip() {
  if (!loadingTip || !LOADING_TIPS.length) return;
  let next = Math.floor(Math.random() * LOADING_TIPS.length);
  if (LOADING_TIPS.length > 1) while (next === tipIdx) next = Math.floor(Math.random() * LOADING_TIPS.length);
  tipIdx = next;
  loadingTip.textContent = LOADING_TIPS[next];
}

function startTips() {
  clearInterval(tipTimer);
  showRandomTip();
  tipTimer = setInterval(showRandomTip, 7000);
}

function stopTips() {
  clearInterval(tipTimer);
  tipTimer = 0;
}

function setLoadingScreen(active, _value = 0, text = 'Initializing...', ready = false) {
  if (!loadingView || !loadingStatus || !loadingHint) return;
  const viewMain = document.querySelector('#overlay .view-main');
  const viewSettings = document.querySelector('#overlay .view-settings');
  if (active) {
    menu.classList.remove('hidden');
    menu.classList.add('loading-behind');
    overlay.classList.add('loading-mode');
    viewMain?.classList.add('hidden');
    viewSettings?.classList.add('hidden');
    loadingView.classList.remove('hidden');
    const spinnerEl = document.querySelector('#overlay .loading-bottom-right');
    if (spinnerEl) spinnerEl.style.display = '';
    overlay.style.display = 'flex';
    overlay.style.cursor = ready ? 'pointer' : 'default';
  } else {
    stopTips();
    cancelAnimationFrame(loadingFrame);
    loadingFrame = 0;
    loadingView.classList.add('hidden');
    overlay.classList.remove('loading-mode');
    viewMain?.classList.remove('hidden');
    overlay.style.display = 'none';
    overlay.style.cursor = 'default';
  }
  loadingHint.classList.toggle('visible', ready);
  loadingHint.textContent = 'CLICK TO LOCK';
  loadingStatus.textContent = ready ? 'Ready' : text;
}

function animateLoadingScreen() {
  cancelAnimationFrame(loadingFrame);
  startTips();
  const tick = () => {
    const generated = Math.max(0, Math.min(1, Number(window.__NUCLEARISM_PREGEN_PROGRESS__) || 0));
    const ready = !!window.__NUCLEARISM_READY_COMPLETE__;
    loadingHint.classList.toggle('visible', ready);
    overlay.style.cursor = ready ? 'pointer' : 'default';
    const spinnerEl = document.querySelector('#overlay .loading-bottom-right');
    if (spinnerEl) spinnerEl.style.display = ready ? 'none' : '';
    if (!ready) {
      const custom = window.__NUCLEARISM_LOAD_STATUS__;
      if (typeof custom === 'string' && custom) {
        loadingStatus.textContent = custom;
      } else {
        const hasFar = !!window.__NUCLEARISM_HAS_FAR_TERRAIN__;
        if (generated >= 1) loadingStatus.textContent = 'Finalizing world...';
        else if (hasFar && generated >= 0.2) loadingStatus.textContent = `Generating distant terrain... ${Math.floor(((generated - 0.2) / 0.8) * 100)}%`;
        else loadingStatus.textContent = `Generating spawn terrain... ${Math.floor((hasFar ? generated / 0.2 : generated) * 100)}%`;
      }
      loadingFrame = requestAnimationFrame(tick);
    } else {
      loadingStatus.textContent = 'Ready - click to start';
      loadingHint.textContent = 'CLICK TO LOCK';
    }
  };
  loadingFrame = requestAnimationFrame(tick);
}




function finishLoading() {
  stopTips();
  cancelAnimationFrame(loadingFrame);
  loadingFrame = 0;
  setLoadingScreen(false);
  menu.classList.remove('loading-behind');
  menu.classList.add('hidden');
  stopPanorama();
  loadingStatus.textContent = 'Initializing...';
  playBtn.textContent = 'PLAY';
  playBtn.disabled = !worlds.find((w) => w.id === selectedId);
  const canvas = window.__NUCLEARISM_GAME_CANVAS__ || document.querySelector('canvas');
  if (canvas && typeof canvas.requestPointerLock === 'function') {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { });
  }
}
window.__NUCLEARISM_FINISH_LOADING__ = finishLoading;

overlay.addEventListener('click', () => {
  if (!loadingView || loadingView.classList.contains('hidden')) return;
  if (!window.__NUCLEARISM_READY_COMPLETE__) return;
  finishLoading();
});

function show(name) {
  for (const v of menu.querySelectorAll('.menu-view')) {
    v.classList.toggle('hidden', v.dataset.view !== name);
  }
  if (name === 'worlds') paintWorlds();
  if (name === 'home') paintSplash();
}

function paintWorlds() {
  listEl.innerHTML = '';
  if (!worlds.length) {
    listEl.innerHTML = '<div class="world-empty">NO WORLDS</div>';
  }
  for (const w of worlds) {
    const b = document.createElement('button');
    b.className = 'world-item' + (w.id === selectedId ? ' sel' : '');
    b.dataset.id = w.id;
    applyWorldCover(b, w.cover);
    const tag = `${w.mode === 'sandbox' ? 'SANDBOX' : 'SURVIVAL'}${w.terrain === 'realistic' ? ' · REALISTIC' : ''}`;
    b.innerHTML = `<span>${escapeHtml(w.name)}</span><span class="tag">${tag}</span>`;
    b.addEventListener('click', () => { selectedId = w.id; paintWorlds(); });
    b.addEventListener('dblclick', () => beginWorld(w));
    listEl.appendChild(b);
  }
  const on = !!worlds.find((w) => w.id === selectedId);
  playBtn.disabled = !on;
  editBtn.disabled = !on;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mixHex(hex, to, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (to - r) * amt);
  g = Math.round(g + (to - g) * amt);
  b = Math.round(b + (to - b) * amt);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function applyWorldCover(el, cover) {
  if (!cover) {
    el.style.removeProperty('--world-bg');
    el.style.removeProperty('--world-bg-hover');
    el.style.removeProperty('--world-bg-sel');
    return;
  }
  el.style.setProperty('--world-bg', cover);
  el.style.setProperty('--world-bg-hover', mixHex(cover, 255, 0.18) || cover);
  el.style.setProperty('--world-bg-sel', mixHex(cover, 255, 0.32) || cover);
}

function newId() {
  return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function exportWorldFile(w) {
  const raw = await idbGet(`idte.save.v2.${w.id}`);
  if (!raw) { alert('No save data found for this world yet.'); return; }
  const json = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const name = (w.name || 'world').replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'world';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `${name}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function beginWorld(w) {
  window.__NUCLEARISM_WORLD__ = {
    id: w.id, name: w.name,
    mode: w.mode,
    terrain: w.terrain === 'realistic' ? 'realistic' : 'legacy',
    seed: w.seed, start: w.start, fallout: w.fallout,
  };
  window.__NUCLEARISM_LOAD_STATUS__ = '';
  window.__NUCLEARISM_PREGEN_PROGRESS__ = 0;
  window.__NUCLEARISM_READY_COMPLETE__ = false;
  startPanorama();
  setLoadingScreen(true, 0, 'Generating spawn terrain...', false);
  animateLoadingScreen();
  const label = playBtn.textContent;
  playBtn.textContent = 'LOADING';
  playBtn.disabled = true;
  import('./game.js').then(() => window.__NUCLEARISM_READY__).then(() => {

  }).catch((e) => {
    console.error('world failed to load', (e && e.stack) || e);
    setLoadingScreen(false);
    menu.classList.remove('loading-behind');
    menu.classList.remove('hidden');
    playBtn.textContent = label;
    playBtn.disabled = false;
  });
}

menu.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;

  if (act === 'worlds' || act === 'home') show(act);
  else if (act === 'settings') show('settings');
  else if (act === 'discord') window.open(DISCORD_URL, '_blank', 'noopener');
  else if (act === 'create') {
    createName.value = '';
    createSeed.value = '';
    newMode = 'survival';
    newStart = 'dawn';
    newFallout = 'normal';
    for (const b of createMode.querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === newMode);
    selectTerrain('realistic');
    paintCycle(createStart, 'start', newStart, 'START TIME');
    paintCycle(createFallout, 'fallout', newFallout, 'FALLOUT');
    show('create');
    createName.focus();
  } else if (act === 'doCreate') {
    const name = createName.value.trim() || 'NEW WORLD';
    const seed = parseSeed(createSeed.value);
    const w = { id: newId(), name, mode: newMode, terrain: newTerrain, start: newStart, fallout: newFallout, version: worldVersion(), created: Date.now() };
    if (seed !== null) w.seed = seed;
    worlds.push(w);
    await writeJSON(WORLDS_KEY, worlds);
    selectedId = w.id;
    show('worlds');
  } else if (act === 'play') {
    const w = worlds.find((x) => x.id === selectedId);
    if (w) beginWorld(w);
  } else if (act === 'edit') {
    const w = worlds.find((x) => x.id === selectedId);
    if (!w) return;
    editName.value = w.name;
    if (editColor) { editColor.value = w.cover || '#454545'; editColor.dataset.cleared = w.cover ? '' : '1'; }
    show('edit');
    editName.focus();
    editName.select();
  } else if (act === 'doEdit') {
    const w = worlds.find((x) => x.id === selectedId);
    if (!w) return;
    w.name = editName.value.trim() || w.name;
    w.cover = (editColor && editColor.dataset.cleared !== '1') ? editColor.value : null;
    await writeJSON(WORLDS_KEY, worlds);
    show('worlds');
  } else if (act === 'doExport') {
    const w = worlds.find((x) => x.id === selectedId);
    if (w) await exportWorldFile(w);
  } else if (act === 'doDelete') {
    const w = worlds.find((x) => x.id === selectedId);
    if (!w) return;
    if (!confirm(`Delete "${w.name}"? This cannot be undone.`)) return;
    worlds = worlds.filter((x) => x.id !== w.id);
    await writeJSON(WORLDS_KEY, worlds);
    await idbRemove(`idte.save.v2.${w.id}`);
    selectedId = null;
    show('worlds');
  }
});

createMode.addEventListener('click', (e) => {
  const mode = e.target.closest('[data-mode]')?.dataset.mode;
  if (!mode) return;
  newMode = mode;
  for (const b of createMode.querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === mode);
});

createTerrain.addEventListener('click', (e) => {
  const terrain = e.target.closest('[data-terrain]')?.dataset.terrain;
  if (!terrain) return;
  selectTerrain(terrain);
  if (terrain === 'legacy') legacyModal.hidden = false;
});

document.getElementById('legacyKeepBtn').addEventListener('click', () => { legacyModal.hidden = true; });
document.getElementById('legacySwitchBtn').addEventListener('click', () => {
  legacyModal.hidden = true;
  selectTerrain('realistic');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !legacyModal.hidden) legacyModal.hidden = true;
});

createStart.addEventListener('click', () => {
  newStart = nextCycle(createStart, 'start', START_OPTIONS, 'START TIME');
});

createFallout.addEventListener('click', () => {
  newFallout = nextCycle(createFallout, 'fallout', FALLOUT_OPTIONS, 'FALLOUT');
});

for (const field of [createName, createSeed]) {
  field.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') menu.querySelector('[data-act="doCreate"]').click();
  });
}
editName.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') menu.querySelector('[data-act="doEdit"]').click();
});
if (editColor) editColor.addEventListener('input', () => { editColor.dataset.cleared = ''; });
if (editColorClear) editColorClear.addEventListener('click', () => { if (editColor) { editColor.value = '#454545'; editColor.dataset.cleared = '1'; } });

startPanorama();
document.getElementById('panoPrev')?.addEventListener('click', () => stepPanorama(-1));
document.getElementById('panoNext')?.addEventListener('click', () => stepPanorama(1));

const promo = document.getElementById('menuPromo');
const promoItems = promo ? [...promo.querySelectorAll('.menu-promo-item')] : [];
let promoIdx = 0;
let promoTimer = 0;
function showPromo(i) {
  if (!promoItems.length) return;
  promoIdx = (i + promoItems.length) % promoItems.length;
  promoItems.forEach((el, j) => el.classList.toggle('on', j === promoIdx));
}
function startPromo() {
  if (promoTimer || promoItems.length < 2) return;
  promoTimer = setInterval(() => showPromo(promoIdx + 1), 4000);
}
function stopPromo() {
  clearInterval(promoTimer);
  promoTimer = 0;
}
if (promoItems.length) showPromo(0);
promo?.addEventListener('mouseenter', stopPromo);
promo?.addEventListener('mouseleave', startPromo);
startPromo();

const uploadWorldBtn = document.getElementById('uploadWorldBtn');
const uploadWorldFile = document.getElementById('uploadWorldFile');
uploadWorldBtn?.addEventListener('click', () => uploadWorldFile?.click());
uploadWorldFile?.addEventListener('change', async () => {
  const file = uploadWorldFile.files?.[0];
  uploadWorldFile.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !(data.seed !== undefined || data.edits !== undefined || data.player !== undefined)) {
      throw new Error('Invalid save file');
    }
    const base = file.name.replace(/\.json$/i, '').replace(/[^a-z0-9._ -]+/gi, ' ').trim().slice(0, 24) || 'IMPORTED WORLD';
    const terrain = data.terrain === 'realistic' ? 'realistic' : 'legacy';
    const w = { id: newId(), name: base, mode: 'survival', terrain, version: worldVersion(), created: Date.now() };
    worlds.push(w);
    await writeJSON(WORLDS_KEY, worlds);
    await idbSet(`idte.save.v2.${w.id}`, text);
    selectedId = w.id;
    show('worlds');
  } catch (e) {
    console.error('[menu] world import failed', e);
    alert('Could not import world file.');
  }
});

renderSettings(document.getElementById('menuSettings'));
paintSplash();

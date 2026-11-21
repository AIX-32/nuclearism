


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
const editName = document.getElementById('editName');
const createMode = document.getElementById('createMode');
const createTerrain = document.getElementById('createTerrain');

const LOADING_TIPS = [
  'Radiation ramps up from day 3 - build shielding before the dose turns lethal at 600 rad.',
  'Bare hands can mine dirt and stone to get your first ore and carbon.',
  'A hand crank gives bootstrap power with no fuel - right-click it to spin the handle.',
  'Water only comes from industrial tanks or a powered water pump; there are no lakes or rivers.',
  'Press M to open the map and B to drop a bookmark where you stand.',
  'Armor and shielding plates cut the radiation dose you take.',
  'Reactor cooling must match the fuel - over-cooling costs power as much as under-cooling.',
  'Mine a chunk to sample its ore seam, then place an excavator on the good ones.',
  'The NEXT STEP card in the corner tracks what to do first and advances as you progress.',
  'Right-click a placed machine to open it; power it through a connected network.',
  'Wall panels block radiation from the direction of the source - shielded concrete stops almost all of it.',
  'Put every ore through the crusher, then smelt the powder to get double the ingots.',
  'Mine dirt with gardening gloves to get seeds and plant them in a greenhouse for good food.',
  'Use skylines to connect machines and automate things.',
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
let selectedId = null;
let newMode = 'survival';
let newTerrain = 'legacy';

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


  const pool = ['panorama-1.png', 'panorama-2.png', 'panorama-3.png', 'panorama-4.png', 'panorama-5.png', 'panorama-6.png', 'panorama-7.png']
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
let tipIndex = 0;

function showTip(i) {
  if (!loadingTip) return;
  tipIndex = ((i % LOADING_TIPS.length) + LOADING_TIPS.length) % LOADING_TIPS.length;
  loadingTip.textContent = LOADING_TIPS[tipIndex];
}

function startTips() {
  clearInterval(tipTimer);
  showTip(Math.floor(Math.random() * LOADING_TIPS.length));
  tipTimer = setInterval(() => showTip(tipIndex + 1), 7000);
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

// Leaves the loading state: hides the loading screen and the menu, stops the
// panorama and hands the pointer to the game. The game calls this too when the
// first-run intro is dismissed, so both paths end in the same place.
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

function newId() {
  return 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function beginWorld(w) {
  window.__NUCLEARISM_WORLD__ = { id: w.id, name: w.name, mode: w.mode, terrain: w.terrain === 'realistic' ? 'realistic' : 'legacy' };
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
    // ready state handled by animateLoadingScreen tick
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
    newMode = 'survival';
    newTerrain = 'legacy';
    for (const b of createMode.querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === 'survival');
    for (const b of createTerrain.querySelectorAll('button')) b.classList.toggle('on', b.dataset.terrain === 'legacy');
    show('create');
    createName.focus();
  } else if (act === 'doCreate') {
    const name = createName.value.trim() || 'NEW WORLD';
    const w = { id: newId(), name, mode: newMode, terrain: newTerrain, created: Date.now() };
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
    show('edit');
    editName.focus();
    editName.select();
  } else if (act === 'doEdit') {
    const w = worlds.find((x) => x.id === selectedId);
    if (!w) return;
    w.name = editName.value.trim() || w.name;
    await writeJSON(WORLDS_KEY, worlds);
    show('worlds');
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
  newTerrain = terrain;
  for (const b of createTerrain.querySelectorAll('button')) b.classList.toggle('on', b.dataset.terrain === terrain);
});

createName.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') menu.querySelector('[data-act="doCreate"]').click();
});
editName.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') menu.querySelector('[data-act="doEdit"]').click();
});

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

renderSettings(document.getElementById('menuSettings'));
paintSplash();

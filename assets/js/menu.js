


import * as THREE from 'three';
import { renderSettings } from './settings.js';

const WORLDS_KEY = 'idte.worlds.v1';
const DISCORD_URL = 'https://discord.com/';

const menu = document.getElementById('menu');
const overlay = document.getElementById('overlay');
const loadingView = document.querySelector('#overlay .view-loading');
const loadingShell = document.querySelector('#overlay .loading-shell');
const loadingFill = document.querySelector('#overlay .loading-square-fill');
const loadingStatus = document.querySelector('#overlay .loading-status');
const loadingHint = document.querySelector('#overlay .loading-hint');
const listEl = document.getElementById('worldList');
const playBtn = document.getElementById('worldPlayBtn');
const editBtn = document.getElementById('worldEditBtn');
const createName = document.getElementById('createName');
const editName = document.getElementById('editName');
const createMode = document.getElementById('createMode');

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {                   }
};

let worlds = readJSON(WORLDS_KEY, []);
if (!Array.isArray(worlds)) worlds = [];
let selectedId = null;
let newMode = 'survival';

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


  const pool = ['panorama-1.png', 'panorama-2.png', 'panorama-3.png', 'panorama-4.png', 'panorama-5.png']
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

function setLoadingScreen(active, value = 0, text = 'INITIALIZING', ready = false) {
  if (!loadingView || !loadingFill || !loadingStatus || !loadingHint || !loadingShell) return;
  const viewMain = document.querySelector('#overlay .view-main');
  const viewSettings = document.querySelector('#overlay .view-settings');
  if (active) {
    viewMain?.classList.add('hidden');
    viewSettings?.classList.add('hidden');
    loadingView.classList.remove('hidden');
    overlay.style.display = 'flex';
    overlay.style.cursor = 'pointer';
    loadingStatus.textContent = text.toUpperCase();
  } else {
    loadingView.classList.add('hidden');
    viewMain?.classList.remove('hidden');
    overlay.style.display = 'none';
    overlay.style.cursor = 'default';
  }
  loadingShell.classList.toggle('ready', ready);
  loadingHint.classList.toggle('visible', ready);
  loadingHint.textContent = 'CLICK TO LOCK';
  if (ready) {
    loadingStatus.textContent = '';
  } else {
    loadingStatus.textContent = text.toUpperCase();
  }
  loadingFill.style.setProperty('--progress', String(Math.max(0, Math.min(1, value))));
}

function animateLoadingScreen() {
  cancelAnimationFrame(loadingFrame);
  const tick = () => {
    const generated = Math.max(0, Math.min(1, Number(window.__NUCLEARISM_PREGEN_PROGRESS__) || 0));
    const ready = !!window.__NUCLEARISM_READY_COMPLETE__;
    loadingFill.style.setProperty('--progress', String(ready ? 1 : generated));
    loadingShell.classList.toggle('ready', ready);
    loadingHint.classList.toggle('visible', ready);
    if (!ready) {
      const hasFar = !!window.__NUCLEARISM_HAS_FAR_TERRAIN__;
      if (generated >= 1) loadingStatus.textContent = 'FINALIZING WORLD';
      else if (hasFar && generated >= 0.2) loadingStatus.textContent = `GENERATING DISTANT TERRAIN ${Math.floor(((generated - 0.2) / 0.8) * 100)}%`;
      else loadingStatus.textContent = `GENERATING SPAWN TERRAIN ${Math.floor((hasFar ? generated / 0.2 : generated) * 100)}%`;
      loadingFrame = requestAnimationFrame(tick);
    } else {
      loadingStatus.textContent = '';
      loadingHint.textContent = 'CLICK TO LOCK';
    }
  };
  loadingFrame = requestAnimationFrame(tick);
}

overlay.addEventListener('click', () => {
  if (!loadingView || loadingView.classList.contains('hidden')) return;
  if (!window.__NUCLEARISM_READY_COMPLETE__) return;
  setLoadingScreen(false);
  cancelAnimationFrame(loadingFrame);
  loadingStatus.textContent = 'INITIALIZING';
  const canvas = window.__NUCLEARISM_GAME_CANVAS__ || document.querySelector('canvas');
  if (canvas && typeof canvas.requestPointerLock === 'function') {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => { });
  }
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
    b.innerHTML = `<span>${escapeHtml(w.name)}</span><span class="tag">${w.mode === 'sandbox' ? 'SANDBOX' : 'SURVIVAL'}</span>`;
    b.addEventListener('click', () => { selectedId = w.id; paintWorlds(); });
    b.addEventListener('dblclick', () => playWorld(w));
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
  stopPanorama();
  window.__NUCLEARISM_WORLD__ = { id: w.id, name: w.name, mode: w.mode };
  menu.classList.add('hidden');
  setLoadingScreen(true, 0, 'GENERATING SPAWN TERRAIN', false);
  animateLoadingScreen();
  const label = playBtn.textContent;
  playBtn.textContent = 'LOADING';
  playBtn.disabled = true;
  import('./game.js').then(() => window.__NUCLEARISM_READY__).then(() => {
    loadingStatus.textContent = 'READY';
    loadingHint.classList.add('visible');
    loadingHint.textContent = 'CLICK TO LOCK';
    overlay.style.cursor = 'pointer';
  }).catch((e) => {
    console.error('world failed to load', (e && e.stack) || e);
    setLoadingScreen(false);
    playBtn.textContent = label;
    playBtn.disabled = false;
    menu.classList.remove('hidden');
    overlay.style.display = 'none';
  });
}

menu.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;

  if (act === 'worlds' || act === 'home') show(act);
  else if (act === 'settings') show('settings');
  else if (act === 'discord') window.open(DISCORD_URL, '_blank', 'noopener');
  else if (act === 'create') {
    createName.value = '';
    newMode = 'survival';
    for (const b of createMode.querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === 'survival');
    show('create');
    createName.focus();
  } else if (act === 'doCreate') {
    const name = createName.value.trim() || 'NEW WORLD';
    const w = { id: newId(), name, mode: newMode, created: Date.now() };
    worlds.push(w);
    writeJSON(WORLDS_KEY, worlds);
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
    writeJSON(WORLDS_KEY, worlds);
    show('worlds');
  } else if (act === 'doDelete') {
    const w = worlds.find((x) => x.id === selectedId);
    if (!w) return;
    if (!confirm(`Delete "${w.name}"? This cannot be undone.`)) return;
    worlds = worlds.filter((x) => x.id !== w.id);
    writeJSON(WORLDS_KEY, worlds);
    localStorage.removeItem(`idte.save.v2.${w.id}`);
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

createName.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') menu.querySelector('[data-act="doCreate"]').click();
});
editName.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') menu.querySelector('[data-act="doEdit"]').click();
});

startPanorama();
document.getElementById('panoPrev')?.addEventListener('click', () => stepPanorama(-1));
document.getElementById('panoNext')?.addEventListener('click', () => stepPanorama(1));
renderSettings(document.getElementById('menuSettings'));
paintSplash();

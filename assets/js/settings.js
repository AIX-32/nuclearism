



import { idbGet, idbSet, idbRemove } from './idb-store.js';

export const SETTINGS_KEY = 'idte.settings.v1';

export const SETTING_DEFS = [
  {
    id: 'renderDistance', group: 'DISPLAY', label: 'RENDER DISTANCE', type: 'choice', def: 3,
    choices: [
      { v: 2, label: '32 m' }, { v: 3, label: '48 m' }, { v: 4, label: '64 m' }, { v: 6, label: '96 m' },
      { v: 16, label: '256 m' }, { v: 64, label: '1 km' }, { v: 2000, label: '32 km' }, { v: 10000, label: '160 km' },
    ],
  },
  {
    id: 'resolution', group: 'DISPLAY', label: 'RESOLUTION', type: 'choice', def: 1.5,
    choices: [{ v: 1, label: '100%' }, { v: 1.5, label: '67%' }, { v: 2, label: '50%' }, { v: 3, label: '33%' }],
  },
  {
    id: 'colorLevels', group: 'DISPLAY', label: 'COLOR DEPTH', type: 'choice', def: 32,
    choices: [{ v: 16, label: '16' }, { v: 32, label: '32' }, { v: 64, label: '64' }],
  },
  { id: 'fov', group: 'DISPLAY', label: 'FIELD OF VIEW', type: 'range', def: 72, min: 60, max: 110, step: 1, fmt: (v) => `${v}°` },
  { id: 'vsync', group: 'DISPLAY', label: 'VSYNC', type: 'toggle', def: true },
  { id: 'infoHud', group: 'DISPLAY', label: 'INFO HUD', type: 'toggle', def: false },
  { id: 'sensitivity', group: 'CONTROLS', label: 'MOUSE SENSITIVITY', type: 'range', def: 1, min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
  { id: 'invertY', group: 'CONTROLS', label: 'INVERT Y AXIS', type: 'toggle', def: false },
  { id: 'volume', group: 'AUDIO', label: 'VOLUME', type: 'range', def: 1, min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { id: 'music', group: 'AUDIO', label: 'MUSIC', type: 'toggle', def: true },
  {
    id: 'replay', group: 'REPLAY', label: 'REPLAY RECORDER', type: 'toggle', def: false,
  },
  {
    id: 'musicLicense', group: 'LICENSES', label: 'AMBIENT MUSIC', type: 'note',
    text: 'Handpicked tracks from Abstraction - Music Loop Bundle (tallbeard.itch.io/music-loop-bundle). Licensed CC0 / Public Domain. To the extent possible under law, Abstraction Music and Tallbeard Studios have waived all copyright and related or neighboring rights to the music in this bundle. Published from the United States. Not endorsed for use in NFTs, AI/ML, or direct resale of unmodified assets. Credit: "Abstraction" (abstractionmusic.com).',
  },
];

const listeners = new Set();
const views = new Set();

async function readStore() {
  try {
    const raw = await idbGet(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function normalize(def, raw) {
  if (def.type === 'note') return def.def;
  if (def.type === 'toggle') return raw === undefined || raw === null ? def.def : !!raw;
  const v = Number(raw);
  if (def.type === 'choice') return def.choices.some((c) => c.v === v) ? v : def.def;
  if (!Number.isFinite(v)) return def.def;
  const clamped = Math.min(def.max, Math.max(def.min, v));
  const steps = Math.round((clamped - def.min) / def.step);
  const decimals = (String(def.step).split('.')[1] || '').length;
  return Number((def.min + steps * def.step).toFixed(decimals));
}

const store = await readStore();
const values = {};
for (const def of SETTING_DEFS) values[def.id] = normalize(def, store[def.id]);

export const settingsReady = Promise.resolve(values);

export function getSetting(id) {
  return values[id];
}

function writeStore() {
  idbSet(SETTINGS_KEY, values).catch((e) => console.warn('[settings] persist failed', e));
}

export function setSetting(id, raw, persist = true) {
  const def = SETTING_DEFS.find((d) => d.id === id);
  if (!def) return;
  const next = normalize(def, raw);
  if (next === values[id]) {
    if (persist) writeStore();
    return;
  }
  values[id] = next;
  if (persist) writeStore();
  paint();
  for (const fn of listeners) fn(id, next);
}

export function resetSettings() {
  for (const def of SETTING_DEFS) values[def.id] = def.def;
  paint();
  for (const fn of listeners) for (const def of SETTING_DEFS) fn(def.id, def.def);
  idbRemove(SETTINGS_KEY).catch((e) => console.warn('[settings] reset persist failed', e));
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const CAT_ICONS = { DISPLAY: '▣', CONTROLS: '✛', AUDIO: '♪', REPLAY: '▶', LICENSES: '§' };

function buildRow(def) {
  const row = document.createElement('div');
  row.className = 'set-row';
  row.dataset.setting = def.id;

  if (def.type === 'note') {
    const note = document.createElement('details');
    note.className = 'set-note';
    const summary = document.createElement('summary');
    summary.textContent = def.label;
    const body = document.createElement('p');
    body.textContent = def.text || '';
    note.append(summary, body);
    row.appendChild(note);
    return row;
  }

  const label = document.createElement('span');
  label.className = 'set-label';
  label.textContent = def.label;
  row.appendChild(label);

  const ctl = document.createElement('span');
  ctl.className = 'set-ctl';
  if (def.type === 'toggle') {
    const b = document.createElement('button');
    b.className = 'set-switch';
    b.dataset.toggle = def.id;
    b.setAttribute('role', 'switch');
    const state = document.createElement('span');
    state.className = 'set-switch-state';
    b.appendChild(state);
    ctl.appendChild(b);
  } else if (def.type === 'choice') {
    ctl.classList.add('set-seg');
    for (const c of def.choices) {
      const b = document.createElement('button');
      b.dataset.val = String(c.v);
      b.textContent = c.label;
      ctl.appendChild(b);
    }
  } else {
    ctl.classList.add('set-range');
    const input = document.createElement('input');
    input.type = 'range';
    input.dataset.setting = def.id;
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    ctl.appendChild(input);
    const out = document.createElement('b');
    out.className = 'set-val';
    ctl.appendChild(out);
  }
  row.appendChild(ctl);
  return row;
}

function paintView(container) {
  for (const row of container.querySelectorAll('.set-row')) {
    const def = SETTING_DEFS.find((d) => d.id === row.dataset.setting);
    if (!def || def.type === 'note') continue;
    const v = values[def.id];
    if (def.type === 'toggle') {
      const b = row.querySelector('.set-switch');
      if (!b) continue;
      b.classList.toggle('on', !!v);
      b.setAttribute('aria-checked', String(!!v));
      const state = b.querySelector('.set-switch-state');
      if (state) state.textContent = v ? 'ON' : 'OFF';
    } else if (def.type === 'choice') {
      for (const b of row.querySelectorAll('button[data-val]')) {
        b.classList.toggle('on', parseFloat(b.dataset.val) === v);
      }
    } else {
      const input = row.querySelector('input[type=range]');
      if (input) {
        if (input.value !== String(v)) input.value = String(v);
        const pct = def.max === def.min ? 0 : ((v - def.min) / (def.max - def.min)) * 100;
        input.style.setProperty('--fill', `${pct}%`);
      }
      const out = row.querySelector('.set-val');
      if (out) out.textContent = def.fmt(v);
    }
  }
}

function paint() {
  for (const v of views) paintView(v);
}

function setCategory(container, cat) {
  for (const b of container.querySelectorAll('.set-cat')) {
    const on = b.dataset.cat === cat;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  }
  for (const panel of container.querySelectorAll('.set-panel')) {
    panel.classList.toggle('hidden', panel.dataset.cat !== cat);
  }
}

function onClick(e) {
  const cat = e.target.closest?.('.set-cat');
  if (cat && e.currentTarget.contains(cat)) {
    setCategory(e.currentTarget, cat.dataset.cat);
    return;
  }
  const row = e.target.closest?.('.set-row');
  if (!row) return;
  const btn = e.target.closest?.('button');
  if (!btn) return;
  const id = row.dataset.setting;
  if (btn.dataset.toggle) setSetting(id, !values[id]);
  else if (btn.dataset.val !== undefined) setSetting(id, parseFloat(btn.dataset.val));
}

function onInput(e) {
  const input = e.target.closest?.('input[type=range]');
  if (!input) return;
  setSetting(input.dataset.setting, parseFloat(input.value), false);
}

function onChange(e) {
  const input = e.target.closest?.('input[type=range]');
  if (!input) return;
  setSetting(input.dataset.setting, parseFloat(input.value), true);
}

export function renderSettings(container) {
  if (!container) return;
  views.add(container);
  if (!container.__settingsBound) {
    container.__settingsBound = true;
    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);
    container.addEventListener('change', onChange);
  }
  container.innerHTML = '';
  const cats = [...new Set(SETTING_DEFS.map((d) => d.group))];
  const shell = document.createElement('div');
  shell.className = 'set-shell';
  const side = document.createElement('div');
  side.className = 'set-side';
  for (const cat of cats) {
    const b = document.createElement('button');
    b.className = 'set-cat';
    b.dataset.cat = cat;
    const icon = document.createElement('span');
    icon.className = 'set-cat-ico';
    icon.textContent = CAT_ICONS[cat] || '▪';
    const name = document.createElement('span');
    name.textContent = cat;
    b.append(icon, name);
    side.appendChild(b);
  }
  const content = document.createElement('div');
  content.className = 'set-content';
  for (const cat of cats) {
    const panel = document.createElement('div');
    panel.className = 'set-panel hidden';
    panel.dataset.cat = cat;
    for (const def of SETTING_DEFS) if (def.group === cat) panel.appendChild(buildRow(def));
    content.appendChild(panel);
  }
  shell.append(side, content);
  container.appendChild(shell);
  setCategory(container, cats[0]);
  paintView(container);
}

document.addEventListener('click', (e) => {
  if (e.target.closest?.('[data-reset-settings]')) resetSettings();
});

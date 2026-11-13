// Shared settings: one schema, one store, one renderer.
// The main-menu page and the in-game pause overlay both render from this
// module, so a new setting is added here and nowhere else.

export const SETTINGS_KEY = 'idte.settings.v1';

export const SETTING_DEFS = [
  {
    id: 'renderDistance', group: 'DISPLAY', label: 'RENDER DISTANCE', type: 'choice', def: 3,
    choices: [
      { v: 2, label: '32 m' }, { v: 3, label: '48 m' }, { v: 4, label: '64 m' }, { v: 6, label: '96 m' },
      { v: 16, label: '256 m' }, { v: 64, label: '1 km' }, { v: 2000, label: '32 km' }, { v: 10000, label: '160 km' },
    ],
    hint: 'EDITABLE TERRAIN STOPS AT 96 M · BEYOND THAT IT IS VISUAL ONLY',
  },
  {
    id: 'resolution', group: 'DISPLAY', label: 'RESOLUTION', type: 'choice', def: 3,
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
];

const listeners = new Set();
const views = new Set();

const readStore = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
};

function normalize(def, raw) {
  if (def.type === 'toggle') return raw === undefined || raw === null ? def.def : !!raw;
  const v = Number(raw);
  if (def.type === 'choice') return def.choices.some((c) => c.v === v) ? v : def.def;
  if (!Number.isFinite(v)) return def.def;
  const clamped = Math.min(def.max, Math.max(def.min, v));
  const steps = Math.round((clamped - def.min) / def.step);
  const decimals = (String(def.step).split('.')[1] || '').length;
  return Number((def.min + steps * def.step).toFixed(decimals));
}

const store = readStore();
const values = {};
for (const def of SETTING_DEFS) values[def.id] = normalize(def, store[def.id]);

export function getSetting(id) {
  return values[id];
}

function writeStore() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(values)); } catch { }
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
  for (const def of SETTING_DEFS) setSetting(def.id, def.def);
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function buildRow(def) {
  const row = document.createElement('div');
  row.className = 'set-row';
  row.dataset.setting = def.id;

  const label = document.createElement('span');
  label.className = 'set-label';
  label.textContent = def.label;
  row.appendChild(label);

  const ctl = document.createElement('span');
  ctl.className = 'set-ctl opts';
  if (def.type === 'toggle') {
    const b = document.createElement('button');
    b.className = 'set-toggle';
    b.dataset.toggle = def.id;
    b.textContent = 'ON';
    ctl.appendChild(b);
  } else if (def.type === 'choice') {
    for (const c of def.choices) {
      const b = document.createElement('button');
      b.dataset.val = String(c.v);
      b.textContent = c.label;
      ctl.appendChild(b);
    }
  } else {
    ctl.classList.remove('opts');
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

  if (def.hint) {
    const hint = document.createElement('span');
    hint.className = 'set-hint';
    hint.textContent = def.hint;
    row.appendChild(hint);
  }
  return row;
}

function paintView(container) {
  for (const row of container.querySelectorAll('.set-row')) {
    const def = SETTING_DEFS.find((d) => d.id === row.dataset.setting);
    if (!def) continue;
    const v = values[def.id];
    if (def.type === 'toggle') {
      const b = row.querySelector('button[data-toggle]');
      if (!b) continue;
      b.textContent = v ? 'ON' : 'OFF';
      b.classList.toggle('on', !!v);
    } else if (def.type === 'choice') {
      for (const b of row.querySelectorAll('button[data-val]')) {
        b.classList.toggle('on', parseFloat(b.dataset.val) === v);
      }
    } else {
      const input = row.querySelector('input[type=range]');
      if (input && input.value !== String(v)) input.value = String(v);
      const out = row.querySelector('.set-val');
      if (out) out.textContent = def.fmt(v);
    }
  }
}

function paint() {
  for (const v of views) paintView(v);
}

function onClick(e) {
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
  let group = null;
  for (const def of SETTING_DEFS) {
    if (def.group !== group) {
      group = def.group;
      const h = document.createElement('div');
      h.className = 'set-group';
      h.textContent = group;
      container.appendChild(h);
    }
    container.appendChild(buildRow(def));
  }
  paintView(container);
}

document.addEventListener('click', (e) => {
  if (e.target.closest?.('[data-reset-settings]')) resetSettings();
});

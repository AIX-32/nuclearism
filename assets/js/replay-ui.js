// The replay panel: a fullscreen menu with the recorder, the saved replays,
// the export settings and the playback transport.
//
// The module owns the DOM; the game owns the state and does the work. Every
// action is a callback into the game context, so this file stays free of
// three.js and of the renderer.

export const EXPORT_RESOLUTIONS = [
  { v: 1280, h: 720, label: '720p' },
  { v: 1920, h: 1080, label: '1080p' },
  { v: 2560, h: 1440, label: '1440p' },
  { v: 3840, h: 2160, label: '4K' },
];

export const EXPORT_FPS = [30, 60];

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function createReplayUI(ctx) {
  const panel = document.getElementById('replayPanel');
  const statusEl = document.getElementById('replayStatus');
  const listEl = document.getElementById('replayList');
  const recBtn = document.getElementById('replayRecBtn');
  const recInfo = document.getElementById('replayRecInfo');
  const viewEl = document.getElementById('replayView');
  const resEl = document.getElementById('replayRes');
  const fpsEl = document.getElementById('replayFps');
  const pixEl = document.getElementById('replayPix');
  const exportBtn = document.getElementById('replayExportBtn');
  const exportInfo = document.getElementById('replayExportInfo');
  const closeBtn = document.getElementById('replayClose');

  const bar = document.getElementById('replayBar');
  const barToggle = document.getElementById('rbToggle');
  const barTime = document.getElementById('rbTime');
  const barDur = document.getElementById('rbDur');
  const barSeek = document.getElementById('rbSeek');
  const barSpeed = document.getElementById('rbSpeed');
  const barExit = document.getElementById('rbExit');

  const opts = { w: 1920, h: 1080, fps: 30, pixels: true };
  let open = false;
  let selected = null;
  let items = [];

  /* ---------- option rows ---------- */

  function buildOptions(el, list, get, set) {
    if (!el) return;
    el.innerHTML = '';
    for (const opt of list) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.addEventListener('click', () => { set(opt); paintOptions(); });
      b.dataset.opt = String(opt.v);
      el.appendChild(b);
    }
    el.__get = get;
    paintOptions();
  }

  function paintOptions() {
    for (const el of [resEl, fpsEl, pixEl]) {
      if (!el || !el.__get) continue;
      const cur = String(el.__get());
      for (const b of el.querySelectorAll('button')) b.classList.toggle('on', b.dataset.opt === cur);
    }
  }

  buildOptions(resEl, EXPORT_RESOLUTIONS, () => `${opts.w}x${opts.h}`, (o) => { opts.w = o.v; opts.h = o.h; });
  buildOptions(fpsEl, EXPORT_FPS.map((f) => ({ v: f, label: `${f} fps` })), () => opts.fps, (o) => { opts.fps = o.v; });
  buildOptions(pixEl, [{ v: 'ps1', label: 'PS1 PIXELS' }, { v: 'full', label: 'FULL RES' }],
    () => (opts.pixels ? 'ps1' : 'full'), (o) => { opts.pixels = o.v === 'ps1'; });

  /* ---------- the replay list ---------- */

  function paintList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'replayEmpty';
      empty.textContent = 'NO REPLAYS YET · START A RECORDING';
      listEl.appendChild(empty);
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'replayItem' + (selected === it.id ? ' sel' : '');

      const name = document.createElement('b');
      name.textContent = it.name;
      row.appendChild(name);

      const meta = document.createElement('span');
      meta.className = 'replayItemMeta';
      const when = new Date(it.created);
      meta.textContent = `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${formatTime(it.dur)} · ${formatBytes(it.size)}`;
      row.appendChild(meta);

      const acts = document.createElement('span');
      acts.className = 'replayItemActs';

      const play = document.createElement('button');
      play.textContent = 'PLAY';
      play.addEventListener('click', (e) => { e.stopPropagation(); ctx.play(it.id); });
      acts.appendChild(play);

      const exp = document.createElement('button');
      exp.textContent = 'EXPORT';
      exp.addEventListener('click', (e) => { e.stopPropagation(); ctx.exportVideo(it.id, { ...opts }); });
      acts.appendChild(exp);

      const del = document.createElement('button');
      del.textContent = 'DELETE';
      del.addEventListener('click', (e) => { e.stopPropagation(); ctx.remove(it.id); });
      acts.appendChild(del);

      row.appendChild(acts);
      row.addEventListener('click', () => { selected = it.id; paintList(); });
      listEl.appendChild(row);
    }
  }

  async function refresh() {
    items = await ctx.list();
    if (selected && !items.some((i) => i.id === selected)) selected = null;
    paintList();
  }

  /* ---------- transport ---------- */

  function paintBar() {
    const st = ctx.state();
    const show = st.playing || st.exporting;
    if (bar) bar.classList.toggle('hidden', !show);
    if (!show) return;
    if (barTime) barTime.textContent = formatTime(st.t);
    if (barDur) barDur.textContent = formatTime(st.dur);
    if (barSpeed) barSpeed.textContent = `${st.speed}×`;
    if (barToggle) barToggle.textContent = st.playing ? '❚❚' : '▶';
    if (barSeek && document.activeElement !== barSeek) barSeek.value = String(Math.round((st.dur ? st.t / st.dur : 0) * 1000));
  }

  if (barToggle) barToggle.addEventListener('click', () => ctx.togglePlay());
  if (barExit) barExit.addEventListener('click', () => ctx.exit());
  if (barSpeed) barSpeed.addEventListener('click', () => ctx.cycleSpeed());
  if (barSeek) barSeek.addEventListener('input', () => ctx.seek(+barSeek.value / 1000));

  /* ---------- panel ---------- */

  function paintStatus() {
    const st = ctx.state();
    if (statusEl) statusEl.textContent = st.exporting
      ? `EXPORTING ${Math.round(st.exportPct * 100)}%`
      : st.recording ? 'RECORDING' : st.playing ? 'PLAYBACK' : 'READY';
    if (recBtn) {
      recBtn.textContent = st.recording ? 'STOP RECORDING' : 'START RECORDING';
      recBtn.classList.toggle('on', st.recording);
    }
    if (recInfo) recInfo.textContent = st.recording ? `${formatTime(st.recT)} ELAPSED` : '';
    if (viewEl) viewEl.textContent = ctx.viewInfo();
    if (exportInfo) exportInfo.textContent = st.exporting ? `${Math.round(st.exportPct * 100)}%` : '';
    if (exportBtn) exportBtn.disabled = st.exporting;
  }

  function show() {
    if (!panel) return;
    open = true;
    panel.classList.remove('hidden');
    refresh();
    paintStatus();
  }

  function hide() {
    if (!panel) return;
    open = false;
    panel.classList.add('hidden');
  }

  if (closeBtn) closeBtn.addEventListener('click', () => ctx.close());
  if (recBtn) recBtn.addEventListener('click', () => {
    const st = ctx.state();
    if (st.recording) ctx.stopRecording(); else ctx.startRecording();
  });
  if (exportBtn) exportBtn.addEventListener('click', () => {
    if (!selected) { if (exportInfo) exportInfo.textContent = 'PICK A REPLAY FIRST'; return; }
    ctx.exportVideo(selected, { ...opts });
  });

  return {
    show,
    hide,
    isOpen: () => open,
    refresh,
    paint() { paintStatus(); paintBar(); },
    get options() { return { ...opts }; },
    setExportInfo(text) { if (exportInfo) exportInfo.textContent = text; },
  };
}

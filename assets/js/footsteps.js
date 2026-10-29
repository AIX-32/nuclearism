








const CLIP_COUNT = { concrete: 5, dirt: 5, grass: 6, gravel: 5, metal: 5, stairs: 5, stone: 4, wood: 5 };


const TARGET_RMS = 0.16;


export const SURF_CATEGORY = {
  grass: 'grass',
  sand: 'gravel',
  rock: 'stone',
  dry: 'dirt',
  snow: 'gravel',
  ash: 'gravel',
};

export function surfToCategory(surf) {
  return SURF_CATEGORY[surf] || 'dirt';
}

function normalise(buf) {
  let peak = 0, sum = 0, n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
    }
    n += d.length;
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (!peak || !rms) return;
  const g = Math.min(TARGET_RMS / rms, 0.95 / peak);
  if (g === 1) return;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
}

export function createFootsteps(base = 'assets/audio/footsteps') {
  let ctx = null;
  const pools = {};
  let last = null;
  let side = 1;

  function audio() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  (async () => {
    const c = audio();
    if (!c) return;
    await Promise.all(Object.entries(CLIP_COUNT).map(async ([cat, n]) => {
      const list = [];
      for (let i = 1; i <= n; i++) {
        try {
          const res = await fetch(`${base}/${cat}-${i}.ogg`);
          if (!res.ok) continue;
          const buf = await c.decodeAudioData(await res.arrayBuffer());
          normalise(buf);
          list.push(buf);
        } catch {                                                           }
      }
      pools[cat] = list;
    }));
  })();

  return {
    step(category, volume = 0.5) {
      const c = audio();
      if (!c) return;
      const pool = (pools[category] && pools[category].length ? pools[category] : pools.dirt) || [];
      if (!pool.length) return;

      let buf = pool[(Math.random() * pool.length) | 0];
      if (pool.length > 1 && buf === last) buf = pool[(pool.indexOf(buf) + 1) % pool.length];
      last = buf;

      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.94 + Math.random() * 0.12;

      const g = c.createGain();
      g.gain.value = volume * (0.9 + Math.random() * 0.2);

      src.connect(g);
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = 0.1 * side;
        side = -side;
        g.connect(p).connect(c.destination);
      } else {
        g.connect(c.destination);
      }
      src.start();
    },
  };
}


if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('footsteps.js')) {
  const cats = new Set(Object.keys(CLIP_COUNT));
  for (const surf of ['grass', 'sand', 'rock', 'dry', 'snow', 'ash']) {
    if (!cats.has(surfToCategory(surf))) throw new Error(`no clip for surf "${surf}"`);
  }
  if (surfToCategory('nonsense') !== 'dirt') throw new Error('fallback broken');
  console.log('footsteps.check ok');
}

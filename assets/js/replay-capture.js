// Paints the real game UI (the same DOM the player sees) into the export
// canvas. Only the elements passed in `roots` are drawn, so replay chrome and
// the replay panel never leak into a video. No DOM is modified.

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
<path d="M3 2 L3 19 L8 14.5 L11.5 21 L14.5 19.5 L11 13 L18 12.5 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

let cursorImg = null;
export function replayCursorImage() {
  if (!cursorImg) {
    cursorImg = new Image();
    cursorImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CURSOR_SVG);
  }
  return cursorImg;
}

function parseColor(s) {
  if (!s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;
  return s;
}

function ownText(el) {
  let out = '';
  for (const n of el.childNodes) if (n.nodeType === 3) out += n.nodeValue;
  return out.trim();
}

function nodeVisible(el) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0.5 && r.height > 0.5;
}

function paintNode(g, el, sx, sy, budget) {
  if (budget.n++ > budget.max) return;
  if (!nodeVisible(el)) return;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const x = r.left * sx, y = r.top * sy;
  const w = r.width * sx, h = r.height * sy;
  const alpha = Number(cs.opacity) || 1;
  if (alpha <= 0.01) return;

  g.save();
  g.globalAlpha *= alpha;

  const bg = parseColor(cs.backgroundColor);
  if (bg) { g.fillStyle = bg; g.fillRect(x, y, w, h); }

  const imgUrl = cs.backgroundImage || '';
  const m = imgUrl.match(/url\(["']?(data:[^"')]+|[^"')]+\.(?:png|jpg|jpeg|webp|gif))["']?\)/i);
  if (m) {
    const img = new Image();
    img.src = m[1];
    if (img.complete && img.naturalWidth) g.drawImage(img, x, y, w, h);
  }

  const bw = parseFloat(cs.borderTopWidth) || 0;
  if (bw > 0) {
    g.strokeStyle = parseColor(cs.borderTopColor) || '#fff';
    g.lineWidth = Math.max(1, bw * sx);
    g.strokeRect(x, y, w, h);
  }

  if (el.tagName === 'IMG') {
    if (el.complete && el.naturalWidth) g.drawImage(el, x, y, w, h);
  } else if (el.tagName === 'CANVAS') {
    try { g.drawImage(el, x, y, w, h); } catch { }
  } else {
    const text = ownText(el);
    if (text) {
      const size = (parseFloat(cs.fontSize) || 12) * sy;
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily || 'sans-serif'}`;
      g.fillStyle = parseColor(cs.color) || '#fff';
      g.textBaseline = 'top';
      g.textAlign = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left';
      g.save();
      g.beginPath(); g.rect(x, y, w, h); g.clip();
      let tx = x;
      if (g.textAlign === 'center') tx = x + w / 2;
      else if (g.textAlign === 'right') tx = x + w;
      g.fillText(text, tx, y + Math.max(0, (h - size) / 2), w);
      g.restore();
    }
  }

  for (const child of el.children) paintNode(g, child, sx, sy, budget);
  g.restore();
}

export function paintUI(g, roots, sx, sy, maxNodes = 1400) {
  const budget = { n: 0, max: maxNodes };
  for (const root of roots) {
    if (!root) continue;
    if (root.classList?.contains('hidden')) continue;
    paintNode(g, root, sx, sy, budget);
  }
}

export function paintCursor(g, img, x, y, sx, sy) {
  if (!img || !img.complete || !img.naturalWidth) return;
  g.save();
  g.globalAlpha = 1;
  g.drawImage(img, x * sx - 2, y * sy - 2, 24 * sx, 24 * sy);
  g.restore();
}





const DRAG_THRESHOLD = 5;

export function inventoryAdapter(grid, idx, items) {
  const cap = (id) => items?.[id]?.stack || 64;
  return {
    stack: () => grid[idx] || null,
    accepts: () => true,
    take() {
      const s = grid[idx];
      grid[idx] = null;
      return s || null;
    },
    put(st) {
      const cur = grid[idx];
      if (!cur) { grid[idx] = st; return null; }
      if (cur.id === st.id && !cur.liquid && !st.liquid && cur.n < cap(st.id)) {
        const mv = Math.min(cap(st.id) - cur.n, st.n);
        cur.n += mv;
        st.n -= mv;
        return st.n > 0 ? st : null;
      }
      grid[idx] = st;
      return cur;
    },
    restore(st) { grid[idx] = st; },
  };
}

export class DragDrop {
  constructor(opts = {}) {
    this.icon = opts.icon || (() => '');
    this.count = opts.count || ((s) => s?.n || 0);
    this.onChange = opts.onChange || (() => {});
    this.specs = new WeakMap();
    this.drag = null;

    this.ghost = document.createElement('div');
    this.ghost.className = 'dd-ghost';
    this.ghost.hidden = true;
    document.body.appendChild(this.ghost);

    this._move = (e) => this.move(e);
    this._up = (e) => this.end(e);
    this._cancel = () => this.cancel();
    this._key = (e) => { if (e.key === 'Escape') this.cancel(); };
  }

  bind(el, spec) {
    if (!el || !spec) return;
    el.classList.add('dd-slot');
    this.specs.set(el, spec);
    el.addEventListener('pointerdown', (e) => this.start(e, el));
    el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  start(e, el) {
    if (e.button !== 0 || this.drag) return;
    const spec = this.specs.get(el);
    if (!spec || !spec.stack?.()) return;
    this.drag = { el, spec, stack: null, x: e.clientX, y: e.clientY, active: false, over: null };
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._cancel);
    window.addEventListener('keydown', this._key, true);
    window.addEventListener('blur', this._cancel);
  }

  begin(e) {
    const d = this.drag;
    const stack = d.spec.take?.();
    if (!stack) { this.reset(); return; }
    d.stack = stack;
    d.active = true;
    d.el.classList.add('dd-dragging');
    const url = this.icon(stack), n = this.count(stack);
    this.ghost.innerHTML = `${url ? `<img src="${url}" alt="">` : ''}${n > 1 ? `<b>${n}</b>` : ''}`;
    this.ghost.hidden = false;
    document.body.classList.add('dd-dragging');
    this.clearOver();
    this.onChange();
    this.move(e);
  }

  move(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
      this.begin(e);
      return;
    }
    this.ghost.style.transform = `translate3d(${e.clientX + 12}px, ${e.clientY + 12}px, 0)`;
    this.aim(e.clientX, e.clientY);
  }

  aim(x, y) {
    const d = this.drag;
    const el = this.slotAt(x, y);
    if (d.over && d.over !== el) d.over.classList.remove('dd-over', 'dd-bad');
    d.over = el;
    if (!el || el === d.el) return;
    el.classList.add(this.canDrop(d, this.specs.get(el)) ? 'dd-over' : 'dd-bad');
  }

  canDrop(d, target) {
    if (!target || target === d.spec) return false;
    if (target.accepts && !target.accepts(d.stack)) return false;
    const cur = target.stack?.();


    if (cur && cur.id !== d.stack.id && d.spec.accepts && !d.spec.accepts(cur)) return false;
    return true;
  }

  slotAt(x, y) {
    return document.elementFromPoint(x, y)?.closest?.('.dd-slot') || null;
  }

  clearOver() {
    const d = this.drag;
    if (!d || !d.over) return;
    d.over.classList.remove('dd-over', 'dd-bad');
    d.over = null;
  }

  end(e) {
    const d = this.drag;
    if (!d) return;
    const active = d.active;
    const targetEl = active ? this.slotAt(e.clientX, e.clientY) : null;
    const target = targetEl ? this.specs.get(targetEl) : null;
    this.clearOver();
    this.reset();
    if (!active) return;
    this.suppressClick();

    let leftover = d.stack;
    if (target && this.canDrop(d, target) && target.put) {
      try {
        leftover = target.put(d.stack);
        if (leftover === undefined) leftover = d.stack;
      } catch { leftover = d.stack; }
    }
    if (leftover && leftover.n > 0) d.spec.restore?.(leftover);
    this.onChange();
  }

  cancel() {
    const d = this.drag;
    if (!d) return;
    const active = d.active;
    this.clearOver();
    this.reset();
    if (!active) return;
    if (d.stack && d.stack.n > 0) d.spec.restore?.(d.stack);
    this.onChange();
  }

  reset() {
    const d = this.drag;
    this.drag = null;
    if (d) d.el.classList.remove('dd-dragging');
    this.ghost.hidden = true;
    document.body.classList.remove('dd-dragging');
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._cancel);
    window.removeEventListener('keydown', this._key, true);
    window.removeEventListener('blur', this._cancel);
  }

  suppressClick() {
    const kill = (e) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('click', kill, true);
    setTimeout(() => window.removeEventListener('click', kill, true), 0);
  }
}

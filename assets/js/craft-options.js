


















export class CraftOptions {
  constructor(opts = {}) {
    this.item = opts.item || (() => null);
    this.icon = opts.icon || (() => '');
    this.onCraft = opts.onCraft || null;
    this.showTip = opts.showTip || null;
    this.hideTip = opts.hideTip || null;
    this.emptyText = opts.emptyText || 'NO CRAFTABLE RECIPES';
    this._sig = null;

    this.el = document.createElement('div');
    this.el.className = 'craftOptions';
  }

  static needsOf(option) {
    const needs = option.needs || {};
    return Array.isArray(needs) ? needs : Object.entries(needs);
  }

  set(options = []) {
    const sig = options.map((o) => `${o.key}:${o.count}:${o.crafts}:${o.disabled ? 1 : 0}`).join('|');
    if (sig === this._sig) return;
    this._sig = sig;

    const keep = this.el.scrollTop;
    this.el.replaceChildren();
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'craftEmpty';
      empty.textContent = this.emptyText;
      this.el.appendChild(empty);
      return;
    }

    for (const o of options) {
      const def = this.item(o.id) || {};
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `craftCard${o.disabled ? ' is-disabled' : ''}`;
      card.dataset.key = o.key;

      const info = document.createElement('span');
      info.className = 'ccInfo';
      const name = document.createElement('span');
      name.className = 'ccName';
      name.textContent = def.name || o.id;
      const meta = document.createElement('span');
      meta.className = 'ccMeta';
      const parts = CraftOptions.needsOf(o)
        .map(([id, n]) => `${n}× ${this.item(id)?.name || id}`);
      for (const l of (o.liquidNeeds || [])) parts.push(`${l.amount}L ${l.id}`);
      meta.textContent = parts.join('  ·  ') || 'NO MATERIALS';
      info.append(name, meta);

      const iconWrap = document.createElement('span');
      iconWrap.className = 'ccIcon';
      const url = this.icon(o.id);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = '';
        iconWrap.appendChild(img);
      }
      if (o.count > 1) {
        const badge = document.createElement('b');
        badge.className = 'ccBadge';
        badge.textContent = `×${o.count}`;
        iconWrap.appendChild(badge);
      }
      if (o.note) {
        const note = document.createElement('span');
        note.className = 'ccNote';
        note.textContent = o.note;
        iconWrap.appendChild(note);
      }

      card.append(info, iconWrap);

      card.addEventListener('mouseenter', (e) => this.showTip?.({ id: o.id, n: o.count }, e.clientX, e.clientY));
      card.addEventListener('mouseleave', () => this.hideTip?.());
      card.addEventListener('click', (e) => {
        if (o.disabled) return;
        this.hideTip?.();
        this.onCraft?.(o, { shift: e.shiftKey });
      });
      this.el.appendChild(card);
    }
    this.el.scrollTop = keep;
  }
}

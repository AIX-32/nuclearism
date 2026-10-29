
























import { CraftOptions } from './craft-options.js';

export class WorkbenchUI {
  constructor() {
    this.opened = false;
    this.active = false;
    this.bridge = {};
    this.layout = null;
    this.machine = null;
    this.onClose = null;
    this.inventorySignature = '';
    this.root = document.createElement('section');
    this.root.className = 'workbench-screen';
    this.root.hidden = true;
    this.root.innerHTML = '<div class="workbench-frame"><section id="powerMeter" aria-label="Machine power level" hidden><header>POWER</header><div class="track"><div id="powerFill"></div></div><span id="powerNum">0 / 0</span></section><aside class="workbench-craft-rail" hidden><header>CRAFTING</header><div class="workbench-craft-list"></div></aside><div class="workbench-window"><section class="workbench-work-area"><header class="workbench-heading"><div><h1></h1></div><button type="button" class="workbench-close">ESC&nbsp; / &nbsp;CLOSE</button></header><div class="workbench-layout"></div></section><aside class="workbench-inventory"><header><h2>INVENTORY</h2></header><div class="workbench-inventory-grid"></div></aside></div></div>';
    document.body.appendChild(this.root);
    this.workArea = this.root.querySelector('.workbench-layout');
    this.inventoryGrid = this.root.querySelector('.workbench-inventory-grid');
    this.powerPanel = document.getElementById('powerMeter');
    this.powerFill = document.getElementById('powerFill');
    this.powerNum = document.getElementById('powerNum');
    this.craftRail = this.root.querySelector('.workbench-craft-rail');
    this.craftListNode = this.root.querySelector('.workbench-craft-list');
    this.craftList = new CraftOptions({
      item: (id) => this.bridge.item?.(id),
      icon: (id) => this.bridge.icon?.(id),
      showTip: (stack, x, y) => this.bridge.showTip?.(stack, x, y),
      hideTip: () => this.bridge.hideTip?.(),
      emptyText: 'NO CRAFTABLE RECIPES',
      onCraft: (option, mods) => {
        this.bridge.craftRecipe?.(option.recipe, mods);
        this.inventorySignature = '';
        this.renderInventory();
        this.renderDynamic();
      },
    });
    this.craftListNode.appendChild(this.craftList.el);
    this.title = this.root.querySelector('h1');
    this.root.querySelector('.workbench-close').addEventListener('click', () => this.close());
    this._key = (e) => { if (this.opened && e.code === 'Escape') { e.preventDefault(); this.close(); } };
    window.addEventListener('keydown', this._key);



    this._drag = null;
    this._ghost = document.createElement('div');
    this._ghost.className = 'workbench-drag-ghost';
    this._ghost.hidden = true;
    document.body.appendChild(this._ghost);
    this._onMove = (e) => this.dragMove(e);
    this._onUp = (e) => this.dragEnd(e);
  }

  dragStart(e, index, stack) {
    if (e.button !== 0) return;
    this._drag = { index, stack, x: e.clientX, y: e.clientY, active: false, over: null };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
  }

  dragMove(e) {
    const d = this._drag;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      d.active = true;
      const icon = this.bridge.icon?.(d.stack.id);
      this._ghost.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}<b>${d.stack.n}</b>`;
      this._ghost.hidden = false;
      document.body.classList.add('workbench-dragging');
      this.bridge.hideTip?.();
    }
    this._ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY + 8}px)`;
    const el = this.dropTarget(e.clientX, e.clientY);
    if (d.over && d.over !== el) d.over.classList.remove('drag-over');
    d.over = el;
    if (el) el.classList.add('drag-over');
  }

  dragEnd(e) {
    const d = this._drag;
    if (!d) return;
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    this._drag = null;
    this._suppressClick = d.active;
    if (d.active) setTimeout(() => { this._suppressClick = false; }, 0);
    if (d.over) d.over.classList.remove('drag-over');
    this._ghost.hidden = true;
    document.body.classList.remove('workbench-dragging');
    const el = this.dropTarget(e.clientX, e.clientY);
    if (d.active && el) {
      this.bridge.drop?.(d.index, el.dataset.role);
      this.renderInventory();
      this.renderDynamic();
    }
  }

  dropTarget(x, y) {
    const el = document.elementFromPoint(x, y)?.closest('.workbench-slot');
    const role = el?.dataset.role || '';
    return role && role !== 'craftOutput' && !role.startsWith('output') ? el : null;
  }

  setBridge(bridge) { this.bridge = bridge || {}; }

  open(machine, onClose) {
    this.machine = machine;
    this.layout = machine.layout || this.bridge.layout?.() || null;
    if (!this.layout) return;
    this.onClose = onClose;
    this.active = false;
    this.opened = true;
    this.inventorySignature = '';
    this.root.hidden = false;
    this.craftRail.hidden = !this.bridge.hasCraftList?.();
    this.title.textContent = this.layout.title || (machine.def?.name) || machine.def?.id?.toUpperCase() || '';
    this.renderLayout();
    this.renderInventory();
    this.renderDynamic();
  }

  close() {
    if (!this.opened) return;
    if (this._drag) {
      window.removeEventListener('pointermove', this._onMove);
      window.removeEventListener('pointerup', this._onUp);
      if (this._drag.over) this._drag.over.classList.remove('drag-over');
      this._drag = null;
      this._ghost.hidden = true;
      document.body.classList.remove('workbench-dragging');
    }
    this.setActive(false);
    this.opened = false;
    this.root.hidden = true;
    this.bridge.hideTip?.();
    if (this.powerPanel) this.powerPanel.hidden = true;
    const cb = this.onClose; this.onClose = null; this.machine = null;
    if (cb) cb();
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.bridge.onActive?.(active);
  }

  slotView(role) { return this.bridge.slotView?.(role) || null; }

  renderLayout() {
    const isWorkflowOnly = !!this.machine && (this.machine.def.kind === 'processor' || this.machine.def.kind === 'crafting');
    const { cols } = this.layout.grid;
    if (isWorkflowOnly) {
      this.workArea.style.display = 'flex';
      this.workArea.style.flexDirection = 'column';
      this.workArea.style.gridTemplateColumns = '';
      this.workArea.style.gridTemplateRows = '';
      this.workArea.style.gridAutoRows = '';
      this.workArea.style.alignContent = '';
    } else {
      this.workArea.style.display = 'grid';
      this.workArea.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      this.workArea.style.gridTemplateRows = 'auto';
      this.workArea.style.gridAutoRows = 'minmax(48px, auto)';
      this.workArea.style.alignContent = 'start';
      this.workArea.style.flexDirection = '';
    }
    this.workArea.replaceChildren();
    for (const el of this.layout.elements) {

      if (el.type === 'label' && el.id === 'header') continue;


      if ((this.machine?.def?.kind === 'crafting' || this.machine?.def?.kind === 'processor')
        && (el.type === 'label' && (el.id === 'info' || el.id === 'status'))
        || ((this.machine?.def?.kind === 'crafting' || this.machine?.def?.kind === 'processor')
          && el.type === 'progress')) {
        continue;
      }

      if (el.type === 'power') continue;

      if (el.type === 'recipes') continue;
      const node = document.createElement(el.type === 'slot' ? 'button' : 'div');
      node.className = `workbench-component workbench-${el.type}${el.role ? ` role-${el.role}` : ''}`;
      node.style.gridColumn = `${el.x + 1} / span ${el.w}`;
      node.style.gridRow = `${el.y + 1} / span ${el.h}`;
      node.dataset.id = el.id;
      if (el.type === 'label') {
        node.classList.add(`label-${el.id}`);
        node.textContent = el.text || '';
        node.style.fontSize = `${Math.max(12, el.size || 14)}px`;
      } else if (el.type === 'slot') {
        node.type = 'button';
        node.dataset.role = el.role || '';
        node.innerHTML = `<span class="workbench-slot-label">${el.label || el.role || 'SLOT'}</span><span class="workbench-slot-content"><img alt=""><b class="workbench-slot-count"></b></span>`;
        const role = el.role || '';
        node.addEventListener('mouseenter', (e) => {
          const view = this.slotView(role);
          if (view?.item) this.bridge.showTip?.({ id: view.item, n: view.count || 1 }, e.clientX, e.clientY);
        });
        node.addEventListener('mouseleave', () => this.bridge.hideTip?.());
        node.addEventListener('click', () => {
          if (role === 'output' || role.startsWith('output')) this.bridge.collect?.(role);
          else this.bridge.take?.(role);
          this.renderInventory(); this.renderDynamic();
        });
      } else if (el.type === 'progress') {
        node.innerHTML = `<span>${el.label || 'PROCESS'}</span><div class="workbench-progress-track"><i></i></div>`;
      } else if (el.type === 'arrow') node.setAttribute('aria-label', 'Flow direction');
      this.workArea.appendChild(node);
    }
    this.renderMachineWorkflow();
    this.applyTheme();
  }

  recipeIconEntry(recipe) {
    if (!recipe) return null;
    const out = recipe.out && Object.entries(recipe.out).find(([id, n]) => Number(n) > 0);
    if (out) return { id: out[0], count: Number(out[1]) || 1, label: (this.bridge.item?.(out[0])?.name || out[0]).toUpperCase() };
    if (recipe.liquidOut) return { id: recipe.liquidOut.container, count: 1, label: 'LIQUID' };
    return null;
  }

  renderMachineWorkflow() {
    const m = this.machine;
    const isProcessor = !!m && (m.def.kind === 'processor' || m.def.kind === 'crafting');
    if (!isProcessor) {
      const panel = this.workArea.querySelector('.workbench-workflow');
      if (panel) panel.remove();
      return;
    }

    let panel = this.workArea.querySelector('.workbench-workflow');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'workbench-workflow';
      panel.innerHTML = `
        <section class="workbench-work-card">
          <header>ACTIVE</header>
          <div class="workbench-work-grid workbench-current-grid"></div>
        </section>
        <section class="workbench-work-card">
          <header>OUTPUTS</header>
          <div class="workbench-work-grid workbench-output-grid"></div>
        </section>
        <section class="workbench-work-summary">
          <div class="workbench-progress-mini"><div class="workbench-progress-title">PROCESS</div><div class="workbench-progress-track"><i></i></div></div>
          <div class="workbench-queue-panel">
            <div class="workbench-queue-title">QUEUE</div>
            <div class="workbench-queue-items"></div>
          </div>
        </section>
      `;
      this.workArea.appendChild(panel);
    }

    const currentGrid = panel.querySelector('.workbench-current-grid');
    const outputGrid = panel.querySelector('.workbench-output-grid');
    const progressBar = panel.querySelector('.workbench-progress-mini i');
    const queueList = panel.querySelector('.workbench-queue-items');

    const entries = [];
    if (m.state.job?.recipe) entries.push({ recipe: m.state.job.recipe, active: true });
    if (Array.isArray(m.state.queue)) for (const q of m.state.queue) entries.push({ recipe: q.recipe, active: false });
    const activeItems = entries.length ? entries : [];
    currentGrid.replaceChildren();
    if (!activeItems.length) {
      const empty = document.createElement('div');
      empty.className = 'workbench-work-cell empty';
      empty.textContent = 'READY';
      currentGrid.appendChild(empty);
    } else {
      for (const entry of activeItems.slice(0, 6)) {
        const icon = this.recipeIconEntry(entry.recipe);
        const cell = document.createElement('div');
        cell.className = 'workbench-work-cell';
        const img = document.createElement('img');
        const item = icon ? this.bridge.item?.(icon.id) : null;
        const url = icon ? (this.bridge.icon?.(icon.id) || '') : '';
        if (url) { img.src = url; img.alt = item?.name || icon.id; }
        const count = document.createElement('b');
        count.textContent = icon ? `×${icon.count}` : '';
        cell.appendChild(img);
        cell.appendChild(count);
        if (entry.active) cell.classList.add('active');
        currentGrid.appendChild(cell);
      }
    }

    outputGrid.replaceChildren();
    const outputs = [];
    for (let i = 0; i < 8; i++) {
      const a = m.state.slots[`output${i}`] || m.state.slots[`o${i}`];
      if (a) outputs.push(a);
    }
    if (!outputs.length) {
      const empty = document.createElement('div');
      empty.className = 'workbench-work-cell empty';
      empty.textContent = 'NONE';
      outputGrid.appendChild(empty);
    } else {
      for (const slot of outputs) {
        const cell = document.createElement('div');
        cell.className = 'workbench-work-cell';
        const img = document.createElement('img');
        const url = slot?.id ? (this.bridge.icon?.(slot.id) || '') : '';
        if (url) { img.src = url; img.alt = slot.id; }
        const count = document.createElement('b');
        count.textContent = `×${slot.n || 1}`;
        cell.appendChild(img);
        cell.appendChild(count);
        outputGrid.appendChild(cell);
      }
    }

    const pct = Math.max(0, Math.min(1, this.bridge.progressValue?.() ?? 0)) * 100;
    if (progressBar) progressBar.style.width = `${pct}%`;

    queueList.replaceChildren();
    const queued = Array.isArray(m.state.queue) ? m.state.queue.slice(0, 5) : [];
    if (!queued.length && !m.state.job) {
      const row = document.createElement('div');
      row.className = 'workbench-queue-item empty';
      row.textContent = 'NONE';
      queueList.appendChild(row);
    } else {
      const rows = [...(m.state.job ? [{ recipe: m.state.job.recipe, active: true }] : []), ...queued.map((q) => ({ recipe: q.recipe, active: false }))];
      for (const item of rows) {
        const recipe = item.recipe;
        const info = this.recipeIconEntry(recipe);
        const row = document.createElement('div');
        row.className = `workbench-queue-item${item.active ? ' active' : ''}`;
        const label = document.createElement('span');
        label.textContent = info ? (this.bridge.item?.(info.id)?.name || info.id).toUpperCase() : 'RECIPE';
        const tag = document.createElement('b');
        tag.textContent = item.active ? 'NOW' : `${Math.max(1, (info?.count || 1))}×`;
        row.appendChild(label);
        row.appendChild(tag);
        queueList.appendChild(row);
      }
    }
  }

  renderDynamic() {
    if (!this.opened) return;
    this.renderPower();
    for (const el of this.layout.elements) {
      if (el.type === 'slot') {
        const node = this.slotNode(el.role || '');
        if (!node) continue;
        const view = this.slotView(el.role || '');
        const count = node.querySelector('.workbench-slot-count');
        const icon = node.querySelector('.workbench-slot-content img');
        const item = view?.item || null;
        const n = view?.count || 0;
        if (count) count.textContent = n > 0 ? `× ${n}` : '';
        if (icon) {
          const url = item && this.bridge.icon ? this.bridge.icon(item) : '';
          icon.hidden = !url;
          if (url) icon.src = url;
        }
        node.classList.toggle('synthetic', !!(view?.synthetic && item));
      }
      if (el.type === 'label' && el.id === 'status') {
        const node = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"]`);
        if (node) node.textContent = this.bridge.statusText?.() ?? '';
      }
      if (el.type === 'progress') {
        const bar = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"] i`);
        if (bar) {
          let v = null;
          if (el.id === 'heat') v = this.bridge.heatValue?.();
          else if (el.id === 'match') v = this.bridge.matchValue?.();
          else v = this.bridge.progressValue?.();
          const pct = Math.max(0, Math.min(1, v ?? 0)) * 100;
          bar.style.width = `${pct}%`;
        }
      }
      if (el.type === 'power') {
        const bar = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"] i`);
        const v = this.bridge.powerValue?.();
        if (bar) bar.style.width = `${Math.max(0, Math.min(1, v ?? 0)) * 100}%`;
      }
    }
    this.renderMachineWorkflow();
    if (!this.craftRail.hidden) this.renderCraftRail();
    const anyProgress = this.bridge.progressValue?.() ?? 0;
    this.setActive(anyProgress > 0 && anyProgress < 1);
  }

  applyTheme() {
    const th = this.layout.theme;
    if (!th) return;
    if (th.background) this.root.style.setProperty('--wb-bg', th.background);
    if (th.accent) this.root.style.setProperty('--wb-accent', th.accent);
  }

  slotNode(role) { return this.workArea.querySelector(`[data-role="${CSS.escape(role)}"]`); }

  renderPower() {
    const view = this.bridge.powerView?.();
    const show = !!view;
    this.powerPanel.hidden = !show;
    if (!show) return;
    const pct = Math.max(0, Math.min(1, view.value ?? 0)) * 100;
    this.powerFill.style.height = `${pct}%`;
    this.powerNum.textContent = view.text || `${Math.round(pct)}%`;
  }

  renderCraftRail() {
    if (this.craftRail.hidden) return;
    this.craftList.set(this.bridge.craftOptions?.() || []);
  }

  renderDynamic() {
    if (!this.opened) return;
    this.renderPower();
    for (const el of this.layout.elements) {
      if (el.type === 'slot') {
        const node = this.slotNode(el.role || '');
        if (!node) continue;
        const view = this.slotView(el.role || '');
        const count = node.querySelector('.workbench-slot-count');
        const icon = node.querySelector('.workbench-slot-content img');
        const item = view?.item || null;
        const n = view?.count || 0;
        if (count) count.textContent = n > 0 ? `× ${n}` : '';
        if (icon) {
          const url = item && this.bridge.icon ? this.bridge.icon(item) : '';
          icon.hidden = !url;
          if (url) icon.src = url;
        }
        node.classList.toggle('synthetic', !!(view?.synthetic && item));
      }
      if (el.type === 'label' && el.id === 'status') {
        const node = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"]`);
        if (!node) continue;
        if (this.machine?.def?.kind === 'reactor') {
          const m = this.machine;
          const heat = Math.max(0, Math.min(1, this.bridge.heatValue?.() ?? 0));
          const match = Math.max(0, Math.min(1, this.bridge.matchValue?.() ?? 0));
          const rods = m.state?.rodCount ?? 0;
          const total = m.def?.rodSlots || 0;
          const cool = Math.round(m.state?.coolTotal || 0);
          const target = Math.round(m.state?.coolTarget || 0);
          const power = Math.round(m.state?.power || 0);
          node.innerHTML = `
            <div class="workbench-reactor-status">
              <div class="workbench-reactor-head">${this.bridge.statusText?.() || 'NO FUEL'}</div>
              <div class="workbench-reactor-metric"><span>HEAT</span><b>${Math.round(heat * 100)}%</b></div>
              <div class="workbench-reactor-bar"><i style="width:${heat * 100}%"></i></div>
              <div class="workbench-reactor-metric"><span>COOL</span><b>${Math.round(match * 100)}%</b></div>
              <div class="workbench-reactor-bar"><i style="width:${match * 100}%"></i></div>
              <div class="workbench-reactor-footer">RODS ${rods}/${total} · COOL ${cool}/${target} · PU ${power}</div>
            </div>
          `;
        } else {
          node.textContent = this.bridge.statusText?.() ?? '';
        }
      }
      if (el.type === 'progress') {
        const bar = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"] i`);
        if (bar) {
          let v = null;
          if (el.id === 'heat') v = this.bridge.heatValue?.();
          else if (el.id === 'match') v = this.bridge.matchValue?.();
          else v = this.bridge.progressValue?.();
          const pct = Math.max(0, Math.min(1, v ?? 0)) * 100;
          bar.style.width = `${pct}%`;
        }
      }
      if (el.type === 'power') {
        const bar = this.workArea.querySelector(`[data-id="${CSS.escape(el.id)}"] i`);
        const v = this.bridge.powerValue?.();
        if (bar) bar.style.width = `${Math.max(0, Math.min(1, v ?? 0)) * 100}%`;
      }
    }
    if (!this.craftRail.hidden) this.renderCraftRail();
    const anyProgress = this.bridge.progressValue?.() ?? 0;
    this.setActive(anyProgress > 0 && anyProgress < 1);
  }

  renderInventory() {
    const stacks = this.bridge.inventory ? this.bridge.inventory() : [];
    const selected = this.bridge.selectedHotbar ? this.bridge.selectedHotbar() : -1;
    const signature = `${selected}|${stacks.map((s) => s ? `${s.id}:${s.n}` : '-').join('|')}`;
    if (signature === this.inventorySignature) return;
    this.inventorySignature = signature;
    this.inventoryGrid.replaceChildren();
    for (let index = 0; index < 35; index++) {
      const stack = stacks[index], slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `workbench-inventory-slot${index === selected ? ' selected' : ''}${index === 7 ? ' pack-start' : ''}`;
      slot.dataset.index = index;
      if (stack) {
        const item = this.bridge.item ? this.bridge.item(stack.id) : null;
        const icon = this.bridge.icon ? this.bridge.icon(stack.id) : '';
        slot.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}<span class="item-code">${item?.code || stack.id}</span><b>${stack.n}</b>`;
        slot.classList.add('has-item');
        slot.addEventListener('mouseenter', (e) => this.bridge.showTip?.(stack, e.clientX, e.clientY));
        slot.addEventListener('mouseleave', () => this.bridge.hideTip?.());
        slot.addEventListener('pointerdown', (e) => this.dragStart(e, index, stack));
      } else slot.innerHTML = '<span class="item-code"></span>';
      if (index < 7) slot.addEventListener('click', () => { if (this._suppressClick) return; this.bridge.selectHotbar?.(index); this.renderInventory(); });
      this.inventoryGrid.appendChild(slot);
    }
  }

  update() {
    if (!this.opened) return;
    this.renderInventory();
    this.renderDynamic();
  }

  dispose() { window.removeEventListener('keydown', this._key); this.root.remove(); }
}

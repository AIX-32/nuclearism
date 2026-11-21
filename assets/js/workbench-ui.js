
























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
    this.compact = false;
    this.mini = document.createElement('section');
    this.mini.className = 'bwe-mini';
    this.mini.hidden = true;
    this.mini.setAttribute('aria-label', 'Bucket wheel excavator controls');
    this.mini.innerHTML = `<header class="bwe-mini-head"><span>BWE CONTROL</span><b class="bwe-mini-status">WHEEL OFF</b><button type="button" data-mini="expand">EXPAND</button><button type="button" class="bwe-mini-close" data-mini="close" aria-label="Close BWE controls">×</button></header>
      <div class="bwe-mini-body">
        <div class="bwe-mini-group"><span>YAW</span><button type="button" data-bwe-action="yawLeft" aria-label="Rotate left">◀</button><button type="button" data-bwe-action="yawRight" aria-label="Rotate right">▶</button></div>
        <div class="bwe-mini-group"><span>BOOM</span><button type="button" data-bwe-action="boomUp" aria-label="Raise boom">▲</button><button type="button" data-bwe-action="boomDown" aria-label="Lower boom">▼</button></div>
        <div class="bwe-mini-group"><span>WHEEL</span><button type="button" class="bwe-wheel" data-bwe-action="wheel">SPIN</button></div>
      </div>
      <footer class="bwe-mini-foot"><span data-mini="yaw">YAW 0°</span><span data-mini="boom">BOOM 0°</span><span data-mini="hold">HOLD 0 / 64</span></footer>`;
    document.body.appendChild(this.mini);
    this._miniStops = [];
    this.wireBweActions(this.mini, this._miniStops);
    this.mini.querySelector('[data-mini="expand"]').addEventListener('click', () => this.expandBwe());
    this.mini.querySelector('[data-mini="close"]').addEventListener('click', () => this.close());
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
    this.dragDrop = null;
  }

  depositFrom(index) {
    if (!this.layout?.elements || !this.bridge.drop) return false;
    const roles = [];
    for (const el of this.layout.elements) {
      if (el.type !== 'slot' || !el.role || el.role.startsWith('output') || el.role === 'craftOutput') continue;
      roles.push(el.role);
    }
    let moved = false;
    for (let pass = 0; pass <= roles.length; pass++) {
      const stack = this.bridge.inventory?.()[index];
      if (!stack) break;
      let changed = false;
      for (const role of roles) {
        if (this.bridge.drop(index, role)) { moved = true; changed = true; break; }
      }
      if (!changed) break;
    }
    return moved;
  }

  setBridge(bridge) { this.bridge = bridge || {}; }

  refresh() {
    if (!this.opened) return;
    this.inventorySignature = '';
    this.renderInventory();
    this.renderDynamic();
  }

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
    this.dragDrop?.cancel();
    this.setActive(false);
    if (this._bweStops) { for (const stop of this._bweStops) stop(); this._bweStops = []; }
    if (this._miniStops) { for (const stop of this._miniStops) stop(); }
    this.compact = false;
    if (this.mini) this.mini.hidden = true;
    this.bridge.onCompact?.(false);
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
    const isWorkflowOnly = !!this.machine && (this.machine.def.kind === 'processor' || this.machine.def.kind === 'crafting' || this.machine.def.kind === 'bwe');
    const { cols } = this.layout.grid;
    if (isWorkflowOnly) {
      this.workArea.style.display = 'flex';
      this.workArea.style.flexDirection = 'column';
      this.workArea.style.gridTemplateColumns = '';
      this.workArea.style.gridTemplateRows = '';
      this.workArea.style.gridAutoRows = '';
      this.workArea.style.alignContent = '';
      this.workArea.style.justifyContent = '';
    } else {
      const slotSize = 56;
      this.workArea.style.display = 'grid';
      this.workArea.style.gridTemplateColumns = `repeat(${cols}, minmax(0, ${slotSize}px))`;
      this.workArea.style.gridTemplateRows = 'auto';
      this.workArea.style.gridAutoRows = `${slotSize}px`;
      this.workArea.style.alignContent = 'start';
      this.workArea.style.justifyContent = 'start';
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

      if (el.type === 'bwe') {
        const node = document.createElement('div');
        node.className = 'workbench-bwe';
        node.dataset.id = el.id;
        this.buildBwe(node);
        this.workArea.appendChild(node);
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
        node.innerHTML = `<span class="workbench-slot-label">${el.label ?? ''}</span><span class="workbench-slot-content"><img alt=""><b class="workbench-slot-count"></b></span>`;
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
        this.dragDrop?.bind(node, this.bridge.slotAdapter?.(role));
      } else if (el.type === 'progress') {
        node.innerHTML = `<span>${el.label || 'PROCESS'}</span><div class="workbench-progress-track"><i></i></div>`;
      } else if (el.type === 'input') {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = this.machine?.state?.genRate ?? 0;
        inp.style.width = '100%';
        inp.addEventListener('change', () => {
          const v = parseFloat(inp.value);
          if (this.machine?.state) this.machine.state.genRate = Number.isFinite(v) ? Math.max(0, v) : 0;
          this.renderDynamic();
        });
        node.appendChild(inp);
      } else if (el.type === 'arrow') node.setAttribute('aria-label', 'Flow direction');
      this.workArea.appendChild(node);
    }
    this.renderMachineWorkflow();
    this.applyTheme();
  }

  buildBwe(node) {
    const total = this.machine?.def?.outputs || 64;
    node.innerHTML = `
      <section class="bwe-controls">
        <div class="bwe-readout">
          <div class="bwe-status" data-on="0">WHEEL OFF</div>
          <div class="bwe-metrics">
            <div><span>YAW</span><b data-bwe="yaw">0°</b></div>
            <div><span>BOOM</span><b data-bwe="boom">0°</b></div>
            <div><span>HOLD</span><b data-bwe="used">0 / ${total}</b></div>
          </div>
        </div>
        <div class="bwe-keys">
          <div class="bwe-keygroup">
            <span>YAW</span>
            <button type="button" data-bwe-action="yawLeft" aria-label="Rotate left">◀</button>
            <button type="button" data-bwe-action="yawRight" aria-label="Rotate right">▶</button>
          </div>
          <div class="bwe-keygroup">
            <span>BOOM</span>
            <button type="button" data-bwe-action="boomUp" aria-label="Raise boom">▲</button>
            <button type="button" data-bwe-action="boomDown" aria-label="Lower boom">▼</button>
          </div>
          <div class="bwe-keygroup">
            <span>WHEEL</span>
            <button type="button" class="bwe-wheel" data-bwe-action="wheel">SPIN</button>
          </div>
          <div class="bwe-keygroup">
            <span>VIEW</span>
            <button type="button" class="bwe-mini-toggle" title="Hide the panel and keep a compact control card on screen">MINIMIZE</button>
          </div>
        </div>
      </section>
      <section class="bwe-storage">
        <header><span>BWE HOLD</span><b data-bwe="slots">0 / ${total}</b></header>
        <div class="bwe-grid"></div>
      </section>
    `;
    const grid = node.querySelector('.bwe-grid');
    for (let i = 0; i < total; i++) {
      const role = `output${i}`;
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'workbench-slot bwe-slot';
      slot.dataset.role = role;
      slot.innerHTML = '<span class="workbench-slot-content"><img alt=""><b class="workbench-slot-count"></b></span>';
      slot.addEventListener('mouseenter', (e) => {
        const view = this.slotView(role);
        if (view?.item) this.bridge.showTip?.({ id: view.item, n: view.count || 1 }, e.clientX, e.clientY);
      });
      slot.addEventListener('mouseleave', () => this.bridge.hideTip?.());
      slot.addEventListener('click', () => {
        this.bridge.collect?.(role);
        this.renderInventory();
        this.renderBweDynamic();
      });
      this.dragDrop?.bind(slot, this.bridge.slotAdapter?.(role));
      grid.appendChild(slot);
    }

    this._bweStops = [];
    this.wireBweActions(node, this._bweStops);
    node.querySelector('.bwe-mini-toggle')?.addEventListener('click', () => this.minimizeBwe());
    this.renderBweDynamic();
  }

  wireBweActions(root, stops) {
    root.querySelectorAll('[data-bwe-action]').forEach((btn) => {
      const action = btn.dataset.bweAction;
      const fire = () => { this.bridge.bweControl?.(action); this.updateBweUi(); };
      if (action === 'wheel') {
        btn.addEventListener('click', fire);
        return;
      }
      let timer = null;
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      const start = (e) => {
        e.preventDefault();
        if (timer) return;
        fire();
        timer = setInterval(fire, 70);
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
      // Keyboard activation does not emit pointerdown; detail === 0 marks it.
      btn.addEventListener('click', (e) => { if (e.detail === 0) fire(); });
      stops.push(stop);
    });
  }

  updateBweUi() {
    if (this.compact) this.renderBweMini();
    else this.renderBweDynamic();
  }

  minimizeBwe() {
    if (!this.opened || !this.machine || this.machine.def.kind !== 'bwe') return;
    this.compact = true;
    this.root.hidden = true;
    if (this.powerPanel) this.powerPanel.hidden = true;
    this.bridge.hideTip?.();
    if (this._bweStops) { for (const stop of this._bweStops) stop(); this._bweStops = []; }
    this.mini.hidden = false;
    this.renderBweMini();
    this.bridge.onCompact?.(true);
  }

  expandBwe() {
    if (!this.compact) return;
    this.compact = false;
    this.mini.hidden = true;
    if (this._miniStops) { for (const stop of this._miniStops) stop(); }
    this.root.hidden = false;
    this.renderLayout();
    this.renderInventory();
    this.renderDynamic();
    this.bridge.onCompact?.(false);
  }

  renderBweMini() {
    if (!this.compact || !this.mini) return;
    const state = this.bridge.bweState?.();
    if (!state) return;
    const status = this.mini.querySelector('.bwe-mini-status');
    if (status) {
      status.textContent = state.status || 'IDLE';
      status.dataset.on = state.wheel ? '1' : '0';
    }
    const yaw = this.mini.querySelector('[data-mini="yaw"]');
    const boom = this.mini.querySelector('[data-mini="boom"]');
    const hold = this.mini.querySelector('[data-mini="hold"]');
    if (yaw) yaw.textContent = `YAW ${Math.round((state.yaw || 0) * 180 / Math.PI)}°`;
    if (boom) boom.textContent = `BOOM ${Math.round((state.boom || 0) * 180 / Math.PI)}°`;
    if (hold) hold.textContent = `HOLD ${state.used} / ${state.total}`;
    const wheel = this.mini.querySelector('[data-bwe-action="wheel"]');
    if (wheel) {
      wheel.classList.toggle('active', !!state.wheel);
      wheel.textContent = state.wheel ? 'STOP' : 'SPIN';
    }
  }

  renderBweDynamic() {
    if (!this.opened) return;
    const node = this.workArea.querySelector('.workbench-bwe');
    if (!node) return;
    for (const slot of node.querySelectorAll('.bwe-slot')) {
      const role = slot.dataset.role || '';
      const view = this.slotView(role);
      const count = slot.querySelector('.workbench-slot-count');
      const icon = slot.querySelector('img');
      const n = view?.count || 0;
      if (count) count.textContent = n > 0 ? `×${n}` : '';
      if (icon) {
        const url = view?.item ? (this.bridge.icon?.(view.item) || '') : '';
        icon.hidden = !url;
        if (url) icon.src = url;
      }
      slot.classList.toggle('filled', !!view?.item);
    }
    const state = this.bridge.bweState?.();
    if (!state) return;
    const status = node.querySelector('.bwe-status');
    if (status) {
      status.textContent = state.status || 'IDLE';
      status.dataset.on = state.wheel ? '1' : '0';
    }
    const yaw = node.querySelector('[data-bwe="yaw"]');
    const boom = node.querySelector('[data-bwe="boom"]');
    const used = node.querySelector('[data-bwe="used"]');
    const slots = node.querySelector('[data-bwe="slots"]');
    if (yaw) yaw.textContent = `${Math.round((state.yaw || 0) * 180 / Math.PI)}°`;
    if (boom) boom.textContent = `${Math.round((state.boom || 0) * 180 / Math.PI)}°`;
    if (used) used.textContent = `${state.used} / ${state.total}`;
    if (slots) slots.textContent = `${state.used} / ${state.total}`;
    const wheel = node.querySelector('[data-bwe-action="wheel"]');
    if (wheel) {
      wheel.classList.toggle('active', !!state.wheel);
      wheel.textContent = state.wheel ? 'STOP' : 'SPIN';
    }
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
      const grid = panel.querySelector('.workbench-output-grid');
      const slotAt = (e) => {
        const cell = e.target.closest?.('[data-role]');
        return cell ? { cell, slot: this.machine?.state.slots[cell.dataset.role] } : null;
      };
      grid.addEventListener('click', (e) => {
        const hit = slotAt(e);
        if (!hit) return;
        this.bridge.collect?.(hit.cell.dataset.role);
        this.bridge.hideTip?.();
        this.renderInventory();
        this.renderDynamic();
      });
      grid.addEventListener('mouseover', (e) => {
        const hit = slotAt(e);
        if (hit?.slot) this.bridge.showTip?.({ id: hit.slot.id, n: hit.slot.n || 1 }, e.clientX, e.clientY);
      });
      grid.addEventListener('mouseout', () => this.bridge.hideTip?.());
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
    let shown = 0;
    for (let i = 0; i < 8; i++) {
      const role = m.state.slots[`output${i}`] ? `output${i}` : (m.state.slots[`o${i}`] ? `o${i}` : null);
      const slot = role ? m.state.slots[role] : null;
      if (!slot) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'workbench-work-cell';
      cell.dataset.role = role;
      const img = document.createElement('img');
      const url = slot.id ? (this.bridge.icon?.(slot.id) || '') : '';
      if (url) { img.src = url; img.alt = slot.id; }
      const count = document.createElement('b');
      count.textContent = `×${slot.n || 1}`;
      cell.append(img, count);
      this.dragDrop?.bind(cell, this.bridge.slotAdapter?.(role));
      outputGrid.appendChild(cell);
      shown++;
    }
    if (!shown) {
      const empty = document.createElement('div');
      empty.className = 'workbench-work-cell empty';
      empty.textContent = 'NONE';
      outputGrid.appendChild(empty);
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
        if (this.machine?.def?.kind === 'reactor' && !this.machine?.def?.coolingPower) {
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
    this.renderMachineWorkflow();
    this.renderBweDynamic();
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
      slot.className = `workbench-inventory-slot${index === selected ? ' sel' : ''}${index === 7 ? ' pack-start' : ''}`;
      slot.dataset.index = index;
      if (stack) {
        const icon = this.bridge.icon ? this.bridge.icon(stack.id) : '';
        const art = icon ? `<div style="width:100%;height:100%;background:url('${icon}') center/contain no-repeat;border-radius:6px;box-sizing:border-box;"></div>` : '';
        slot.innerHTML = `${art}<span class="n">${stack.n > 1 ? stack.n : ''}</span>`;
        slot.classList.add('has-item');
        slot.addEventListener('mouseenter', (e) => this.bridge.showTip?.(stack, e.clientX, e.clientY));
        slot.addEventListener('mouseleave', () => this.bridge.hideTip?.());
      } else slot.innerHTML = '';
      this.dragDrop?.bind(slot, this.bridge.invAdapter?.(index));
      slot.addEventListener('click', (e) => {
        if (e.shiftKey && stack) {
          e.preventDefault();
          if (this.depositFrom(index)) {
            this.renderInventory();
            this.renderDynamic();
          }
          return;
        }
        if (index < 7) {
          this.bridge.selectHotbar?.(index);
          this.renderInventory();
        }
      });
      this.inventoryGrid.appendChild(slot);
    }
  }

  update() {
    if (!this.opened) return;
    if (this.compact) { this.renderBweMini(); return; }
    this.renderInventory();
    this.renderDynamic();
  }

  dispose() { window.removeEventListener('keydown', this._key); this.root.remove(); }
}

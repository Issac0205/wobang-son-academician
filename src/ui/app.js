/**
 * app.js —— 界面装配：订阅 store → 渲染 → 事件代理
 *
 * 冻结约定（docs/CONTRACT.md §6）：
 *   · UI 只读 buildViewModel 产出的快照，只通过 store.dispatch / store.actions 写。
 *   · 所有交互走「事件代理」：根节点监听 click，找最近的 [data-action]。
 *   · 每个 data-action 都必须在下面 HANDLERS 里注册（scripts/check.mjs 静态校验）。
 *   · 本文件只保存「展示用的本地状态」（当前分栏、弹层、纪事筛选、上一次结算回执），
 *     这些状态不写进 state，也不参与任何游戏计算。
 */

import { $, h, mount, clear, show, button } from './dom.js';
import { uiIcon } from './icons.js';
import { buildViewModel } from '../core/viewmodel.js';
import { renderHud } from './hud.js';
import { renderCrew } from './views/crew.js';
import { renderProjects } from './views/projects.js';
import { renderMarket } from './views/market.js';
import { renderActions } from './views/actions.js';
import { renderChronicleAside, renderChroniclePanel } from './views/chronicle.js';
import { renderModal, renderToast, uiRenameValues } from './modal.js';
import { renderReceiptStrip } from './receipt.js';
import { UI_TAB_IDS, UI_PANEL_IDS, UI_PROJECTS_INTRO } from './copy.js';

/** 标签页图标（t27：全部是内联 SVG，来源与许可证见 docs/ASSETS.md）。 */
const UI_TAB_ICONS = {
  lab: 'flask-conical',
  projects: 'folder-open',
  market: 'users-round',
  actions: 'activity',
  chronicle: 'scroll-text',
};

const UI_RENDERERS = {
  lab: renderCrew,
  projects: renderProjects,
  market: renderMarket,
  actions: renderActions,
};

/** 标签页上的小角标：让玩家一眼看到「哪个页有新东西」。 */
function uiTabBadge(vm, tabId) {
  if (tabId === 'lab') return vm.crew.active.length ? vm.crew.active.length + ' 人' : null;
  if (tabId === 'projects') return vm.projects.list.length ? vm.projects.list.length + ' 个' : null;
  if (tabId === 'market') {
    const n = vm.market.students.length + vm.market.projects.length;
    return n ? n + ' 份' : null;
  }
  if (tabId === 'actions') return vm.actions.energy + '/' + vm.actions.energyMax;
  if (tabId === 'chronicle') return vm.chronicle.length ? String(vm.chronicle.length) : null;
  return null;
}

/**
 * @param {{store:any, io?:{onSave?:Function,onExport?:Function,onImport?:Function,onReset?:Function,hasSave?:Function}}} options
 */
export function createApp(options) {
  const store = options.store;
  const io = options.io || {};
  const root = $('app');
  let unsubscribe = null;
  let lastVm = null;
  const localUi = {
    labSection: 'overview',
    chronicleFilter: 'all',
    modal: null,
    hideEnding: false,
    introDone: false,
    // 抢一作的二次确认（t8 finding）：只记「玩家正在确认哪一篇」，不写 state
    grabConfirm: null,
    // v1.4.0 稀有人才：招走即永不再现，所以招募也要二次确认（只记「正在确认哪个 offer」，不写 state）
    rareConfirm: null,
    // 首次进项目页的一次性引导（t34，DEV §7.4 第 5 条）：同样只存本地状态
    projectsIntroDone: false,
    // 1.1 实验室空间：手上拿着的仪器（{mode:'buy'|'move', id, uid, name, w, h, rot, price, refund}），只存本地
    labPick: null,
  };

  const HANDLERS = {
    'next-month': () => advanceMonth(),
    'save': () => (typeof io.onSave === 'function' ? io.onSave() : null),
    'export': () => (typeof io.onExport === 'function' ? io.onExport() : null),
    'import': () => (typeof io.onImport === 'function' ? io.onImport() : null),
    'reset': () => {
      if (lastVm && lastVm.ending) resetGame();
      else openModal('reset');
    },
    'reset-confirm': () => resetGame(),
    // t8 finding：下海要先确认（不可撤销），确认后才 dispatch
    'resign': () => openModal('resign-confirm'),
    'resign-confirm': () => {
      localUi.modal = null;
      dispatch('game/resign', {});
      render();
    },
    'defer-choice': (el) => dispatch('game/chooseDefer', { studentId: el.dataset.studentId, choice: el.dataset.choice }),
    // 一键分配（t25）：UI 只发动作，分配规则与预览都由 core 算
    'auto-assign': () => dispatch('game/autoAssign', {}),
    // 首次进项目页的引导：点掉就记在本地（不写 state，重开一局不影响）
    'projects-intro-dismiss': () => { localUi.projectsIntroDone = true; render(); },
    'help': () => openModal('help'),
    'modal-close': () => openModal(null),
    'receipt-open': () => openModal('receipt'),
    'ending-hide': () => { localUi.hideEnding = true; render(); },
    'rename-open': () => openModal('rename'),
    'rename-apply': () => applyRename(),
    'tab': (el) => dispatch('ui/setTab', { tab: el.dataset.tab }),
    'goto-tab': (el) => {
      if (el.dataset.section) localUi.labSection = el.dataset.section;
      dispatch('ui/setTab', { tab: el.dataset.tab });
    },
    'lab-section': (el) => { localUi.labSection = el.dataset.section || 'overview'; localUi.labPick = null; render(); },
    'chronicle-filter': (el) => { localUi.chronicleFilter = el.dataset.filter || 'all'; render(); },
    'wage': (el) => dispatch('game/setWage', { studentId: el.dataset.studentId, tier: el.dataset.tier }),
    'buy-equipment': (el) => { localUi.labPick = null; dispatch('game/buyEquipment', { id: el.dataset.id }); },
    // ── 1.1 实验室空间：拿起 / 搬动 / 放下 / 旋转 / 卖掉；落点合法性以 core 为准 ──
    'lab-pick': (el) => {
      const cur = localUi.labPick;
      if (cur && cur.mode === 'buy' && cur.id === el.dataset.id) localUi.labPick = null;
      else localUi.labPick = pickFromShop(el.dataset.id);
      render();
      const held = root && root.querySelector('[data-role=held-bar]');
      if (held && held.scrollIntoView) held.scrollIntoView({ block: 'center' });
    },
    'lab-item': (el) => {
      const cur = localUi.labPick;
      if (cur && cur.mode === 'move' && cur.uid === el.dataset.uid) localUi.labPick = null;
      else localUi.labPick = pickFromItem(el.dataset.uid);
      render();
    },
    'lab-rotate': () => rotatePick(),
    'lab-cancel': () => { localUi.labPick = null; render(); },
    'lab-cell': (el) => placeAt(el.dataset.benchUid, Number(el.dataset.x), Number(el.dataset.y)),
    'lab-sell-item': (el) => { localUi.labPick = null; dispatch('lab/sellItem', { itemUid: el.dataset.uid }); render(); },
    // 1.3 仓库：存入 / 取出（取出进入「拿在手上 → 点台位」流程）/ 直接卖
    'lab-store-item': (el) => { localUi.labPick = null; dispatch('lab/storeItem', { itemUid: el.dataset.uid }); render(); },
    'lab-deploy-item': (el) => { localUi.labPick = pickFromStorage(el.dataset.storageUid); render(); },
    'lab-sell-stored': (el) => { localUi.labPick = null; dispatch('lab/sellStored', { storageUid: el.dataset.storageUid }); render(); },
    'lab-sell-bench': (el) => dispatch('lab/sellBench', { benchUid: el.dataset.benchUid }),
    'lab-buy-bench': (el) => dispatch('lab/buyBench', { type: el.dataset.type, roomIdx: Number(el.dataset.roomIdx), slot: Number(el.dataset.slot) }),
    'lab-buy-room': () => dispatch('lab/buyRoom', {}),
    'accept-project': (el) => dispatch('game/acceptProject', { offerId: el.dataset.offerId, studentIds: pickTeamStudents() }),
    'lock-offer': (el) => dispatch('game/lockOffer', { offerId: el.dataset.offerId }),
    'hire-student': (el) => dispatch('game/hireStudent', { offerId: el.dataset.offerId }),
    // 稀有人才（v1.4.0）：第一次点击只展开确认条（写明「本局只有这一次机会」），确认后才真的 dispatch
    'rare-hire': (el) => { localUi.rareConfirm = { offerId: el.dataset.offerId }; render(); },
    'rare-hire-confirm': (el) => {
      const pending = localUi.rareConfirm;
      localUi.rareConfirm = null;
      const offerId = (pending && pending.offerId) || (el && el.dataset ? el.dataset.offerId : '');
      if (offerId) dispatch('game/hireStudent', { offerId });
      render();
    },
    'rare-hire-cancel': () => { localUi.rareConfirm = null; render(); },
    'assign-student': (el) => dispatch('game/assignStudent', { projectId: el.dataset.projectId, studentId: el.dataset.studentId }),
    'unassign-student': (el) => dispatch('game/unassignStudent', { projectId: el.dataset.projectId, studentId: el.dataset.studentId }),
    'toggle-lead': (el) => dispatch('game/togglePlayerLead', { projectId: el.dataset.projectId }),
    'hardpoint-team': (el) => dispatch('game/resolveHardpoint', {
      projectId: el.dataset.projectId, hardpointId: el.dataset.hardpointId, method: 'team', studentIds: pickedStudents(el, 2),
    }),
    'hardpoint-fake': (el) => dispatch('game/resolveHardpoint', {
      projectId: el.dataset.projectId, hardpointId: el.dataset.hardpointId, method: 'fake',
    }),
    'hardpoint-solo': (el) => dispatch('game/resolveHardpoint', {
      projectId: el.dataset.projectId, hardpointId: el.dataset.hardpointId, method: 'solo', studentIds: pickedStudents(el, 1).slice(0, 1),
    }),
    'buy-first': (el) => {
      const payload = {};
      if (el.dataset.tier) payload.tier = el.dataset.tier;
      dispatch('game/buyFirstAuthor', payload);
    },
    // 抢一作：第一次点击只展开确认条（写明档位/IF/诚信/幸福度），确认后才真的 dispatch
    'grab-first': (el) => {
      localUi.grabConfirm = {
        studentId: el.dataset.studentId,
        paperId: el.dataset.paperId,
        tier: el.dataset.tier,
      };
      render();
    },
    'grab-confirm': () => {
      const pending = localUi.grabConfirm;
      localUi.grabConfirm = null;
      if (pending) dispatch('game/grabFirstAuthor', pending);
      render();
    },
    'grab-cancel': () => { localUi.grabConfirm = null; render(); },
    'consume-mode': (el) => dispatch('game/setConsumeMode', { mode: el.dataset.mode }),
    'buy-consumable': (el) => {
      const amount = Number(el.dataset.amount);
      dispatch('game/buyConsumable', Number.isFinite(amount) && amount > 0 ? { amount } : {});
    },
    'do-action': (el) => dispatch('game/doAction', {
      actionId: el.dataset.actionId,
      studentId: el.dataset.studentId || null,
      projectId: el.dataset.projectId || null,
    }),
    'event-choice': (el) => dispatch('game/resolveEvent', {
      eventId: lastVm && lastVm.pendingEvent ? lastVm.pendingEvent.eventId : null,
      choiceId: el.dataset.choiceId,
    }),
    'dismiss-toast': () => dispatch('ui/dismissToast', {}),
  };

  function dispatch(type, payload) {
    return store.dispatch({ type, payload: payload || {} });
  }

  /* ── 1.1 实验室空间：拿起/放下（全部数据来自上一帧 vm，写操作只走 dispatch） ── */
  function labSpaceVm() {
    return lastVm && lastVm.crew && lastVm.crew.lab ? lastVm.crew.lab : null;
  }

  function pickFromShop(id) {
    const lab = labSpaceVm();
    const e = lab ? lab.equipment.find((x) => x.id === id) : null;
    if (!e) return null;
    return { mode: 'buy', id: e.id, name: e.name, w: e.w, h: e.h, baseW: e.w, baseH: e.h, rot: false, price: e.price };
  }

  function pickFromItem(uid) {
    const lab = labSpaceVm();
    if (!lab) return null;
    for (const room of lab.space.rooms) {
      for (const s of room.slots) {
        if (s.empty) continue;
        const it = s.items.find((x) => x.uid === uid);
        if (it) return { mode: 'move', uid: it.uid, id: it.inst, name: it.name, w: it.w, h: it.h, rot: Boolean(it.rot), refund: it.sellRefund };
      }
    }
    return null;
  }

  /** 仓库条目 → 「拿在手上」状态（取出）；与 pickFromItem 同结构，mode='deploy'。 */
  function pickFromStorage(uid) {
    const lab = labSpaceVm();
    const s = lab ? (lab.storage || []).find((x) => x.uid === uid) : null;
    if (!s) return null;
    return { mode: 'deploy', storageUid: s.uid, id: s.inst, name: s.name, w: s.w, h: s.h, baseW: s.w, baseH: s.h, rot: false };
  }

  function rotatePick() {
    const p = localUi.labPick;
    if (!p || p.w === p.h) return;
    localUi.labPick = { ...p, w: p.h, h: p.w, rot: !p.rot };
    render();
  }

  function placeAt(benchUid, x, y) {
    const p = localUi.labPick;
    if (!p || !benchUid || !Number.isInteger(x) || !Number.isInteger(y)) return;
    const before = store.getState().lab;
    if (p.mode === 'buy') dispatch('lab/buyInstrument', { id: p.id, benchUid, x, y, rot: Boolean(p.rot) });
    else if (p.mode === 'deploy') dispatch('lab/deployItem', { storageUid: p.storageUid, benchUid, x, y, rot: Boolean(p.rot) });
    else dispatch('lab/moveItem', { itemUid: p.uid, benchUid, x, y, rot: Boolean(p.rot) });
    // 放成功（摆放变了）才把手上的东西清掉；放不下时 core 会 toast，手上保持原样方便换位置
    if (store.getState().lab !== before && JSON.stringify(store.getState().lab.rooms) !== JSON.stringify(before.rooms)) localUi.labPick = null;
    render();
  }

  /** 占格预览：只做纯几何（越界/重叠），数据是 bench-grid 上 vm 序列化来的占用表。 */
  function clearPreview() {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    for (const n of root.querySelectorAll('.lab-cell.is-ok, .lab-cell.is-bad')) n.classList.remove('is-ok', 'is-bad');
  }

  function previewAt(cell) {
    clearPreview();
    const p = localUi.labPick;
    if (!p || !cell || typeof cell.closest !== 'function') return;
    const grid = cell.closest('[data-role="bench-grid"]');
    if (!grid) return;
    const bw = Number(grid.dataset.bw);
    const bh = Number(grid.dataset.bh);
    const x0 = Number(cell.dataset.x);
    const y0 = Number(cell.dataset.y);
    const occ = String(grid.dataset.occ || '').split(';').filter(Boolean).map((s) => s.split(','))
      .filter((a) => !(p.mode === 'move' && a[0] === p.uid))
      .map((a) => ({ x: Number(a[1]), y: Number(a[2]), w: Number(a[3]), h: Number(a[4]) }));
    const inBounds = x0 + p.w <= bw && y0 + p.h <= bh;
    const hit = (x, y) => occ.some((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
    let ok = inBounds;
    const cells = [];
    for (let y = y0; y < Math.min(bh, y0 + p.h); y += 1) {
      for (let x = x0; x < Math.min(bw, x0 + p.w); x += 1) {
        if (hit(x, y)) ok = false;
        cells.push(grid.querySelector('[data-action="lab-cell"][data-x="' + x + '"][data-y="' + y + '"]') || null);
      }
    }
    for (const n of cells) if (n) n.classList.add(ok ? 'is-ok' : 'is-bad');
    const bar = root.querySelector('[data-role="held-bar"]');
    if (bar) bar.dataset.fit = ok ? 'ok' : 'bad';
  }

  function cellOf(target) {
    return target && typeof target.closest === 'function' ? target.closest('[data-action="lab-cell"]') : null;
  }

  function onOver(ev) { if (localUi.labPick) previewAt(cellOf(ev.target)); }
  function onLeave(ev) { if (localUi.labPick && !cellOf(ev.relatedTarget)) clearPreview(); }

  function onDragStart(ev) {
    const t = ev.target;
    if (!t || typeof t.closest !== 'function') return;
    const shop = t.closest('[data-role="shop-item"]');
    const item = t.closest('[data-action="lab-item"]');
    const pick = item ? pickFromItem(item.dataset.uid) : (shop ? pickFromShop(shop.dataset.id) : null);
    if (!pick) return;
    localUi.labPick = pick;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', pick.name); } catch (e) { /* 部分浏览器限制 setData */ }
    }
    // 不能在 dragstart 里重渲染（会把拖拽源节点换掉）；下一帧再给台面加「拿着东西」样式
    setTimeout(() => { if (root) for (const b of root.querySelectorAll('.bench, .card-lab')) b.classList.add('is-holding'); }, 0);
  }

  function onDragOver(ev) {
    const cell = cellOf(ev.target);
    if (!cell || !localUi.labPick) return;
    ev.preventDefault();
    previewAt(cell);
  }

  function onDrop(ev) {
    const cell = cellOf(ev.target);
    if (!cell || !localUi.labPick) return;
    ev.preventDefault();
    placeAt(cell.dataset.benchUid, Number(cell.dataset.x), Number(cell.dataset.y));
  }

  function onDragEnd() {
    // 拖到台面外：撤销「拿着」状态，界面回到原样
    setTimeout(() => { clearPreview(); render(); }, 0);
  }

  function onKey(ev) {
    if (!localUi.labPick) return;
    const tag = ev.target && ev.target.tagName ? String(ev.target.tagName).toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return;
    if (ev.key === 'Escape') { localUi.labPick = null; render(); }
    else if (ev.key === 'r' || ev.key === 'R') rotatePick();
  }

  function openModal(kind) {
    localUi.modal = kind ? { kind } : null;
    render();
  }

  function applyRename() {
    const values = uiRenameValues();
    const payload = {};
    const name = String(values.name || '').trim();
    const sonName = String(values.sonName || '').trim();
    if (name) payload.name = name;
    if (sonName) payload.sonName = sonName;
    localUi.modal = null;
    if (Object.keys(payload).length) dispatch('game/setName', payload);
    render();
  }

  function resetGame() {
    if (typeof io.onReset === 'function') io.onReset();
    localUi.modal = null;
    localUi.hideEnding = false;
    localUi.labSection = 'overview';
    localUi.chronicleFilter = 'all';
    localUi.grabConfirm = null;
    localUi.rareConfirm = null;
    localUi.labPick = null;
    lastVm = null;
    render();
  }

  /** 推进一个月：结算明细由 core 写进 vm.receipt，UI 只负责把它摊开。 */
  function advanceMonth() {
    dispatch('game/advanceMonth', {});
    localUi.modal = null;
    localUi.hideEnding = false;
    localUi.grabConfirm = null;
    localUi.rareConfirm = null;
    localUi.labPick = null;
    render();
    if (typeof io.onSave === 'function') io.onSave();
  }

  /** 兜底人选：从上一帧 vm 里取前 N 名在读学生（不直接读 state）。 */
  function pickTeamStudents(count) {
    const list = (lastVm && lastVm.crew && lastVm.crew.active) || [];
    return list.slice(0, count || 2).map((s) => s.id);
  }

  /**
   * 难点抽调的人选：优先用 core 在 vm 里算好的推荐名单（data-student-ids），
   * 这样「按钮上写的成功率」和「真正抽调的人」永远是同一批人。
   */
  function pickedStudents(el, fallbackCount) {
    const raw = el && el.dataset ? el.dataset.studentIds : '';
    if (raw) return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
    return pickTeamStudents(fallbackCount);
  }

  function onClick(ev) {
    let node = ev.target;
    while (node && node !== root) {
      const action = node.dataset && node.dataset.action;
      if (action) {
        const handler = HANDLERS[action];
        if (handler) {
          if (typeof ev.preventDefault === 'function') ev.preventDefault();
          handler(node);
        } else {
          console.warn('[ui] 未注册的 data-action：', action);
        }
        return;
      }
      node = node.parentNode;
    }
  }

  function render() {
    const vm = buildViewModel(store.getState());
    lastVm = vm;
    renderHud(vm);
    renderTabs(vm);
    renderReport(vm);
    renderPanels(vm);
    renderChronicleAside(vm);
    renderChroniclePanel(vm, localUi);
    renderModal(vm, localUi);
    renderToast(vm);
    return vm;
  }

  function renderTabs(vm) {
    const nav = $('tabs');
    if (!nav) return;
    for (const tab of vm.tabs) {
      const btn = $(UI_TAB_IDS[tab.id]);
      if (!btn) continue;
      const badge = uiTabBadge(vm, tab.id);
      mount(btn, [
        uiIcon(UI_TAB_ICONS[tab.id] || 'activity'),
        h('span', { class: 'tab-label', text: tab.label }),
        badge ? h('span', { class: 'tab-badge', text: badge }) : null,
      ]);
      btn.className = tab.active ? 'tab active' : 'tab';
      btn.setAttribute('aria-pressed', tab.active ? 'true' : 'false');
      if (!btn.dataset) continue;
      btn.dataset.action = 'tab';
      btn.dataset.tab = tab.id;
    }
  }

  /** 「上月结算回执」：所有标签页都能看到，推进后立刻更新。 */
  function renderReport(vm) {
    const node = $('month-report');
    if (!node) return;
    mount(node, renderReceiptStrip(vm, vm.receipt, true));
  }

  /**
   * 首次进项目页的一次性引导（t34，DEV §7.4 第 5 条）。
   * 复用开场「怎么玩」的那套本地状态机制：只存 localUi，不写 GameState。
   */
  function uiProjectsIntro() {
    return h('section', { class: 'projects-intro', dataset: { role: 'projects-intro' } }, [
      h('div', { class: 'projects-intro-head' }, [
        h('strong', { class: 'projects-intro-title', text: UI_PROJECTS_INTRO.title }),
        button(UI_PROJECTS_INTRO.dismiss, { action: 'projects-intro-dismiss' }, { class: 'btn-ghost btn-xs' }),
      ]),
      h('p', { class: 'projects-intro-text', text: UI_PROJECTS_INTRO.text }),
      h('p', { class: 'projects-intro-hint', text: UI_PROJECTS_INTRO.hint }),
    ]);
  }

  function renderPanels(vm) {
    for (const tab of Object.keys(UI_PANEL_IDS)) {
      const panel = $(UI_PANEL_IDS[tab]);
      if (!panel) continue;
      const active = vm.tab === tab;
      show(panel, active);
      if (!active) continue;
      if (tab === 'chronicle') continue; // 由 renderChroniclePanel 负责（它需要筛选状态）
      const renderer = UI_RENDERERS[tab];
      if (renderer) {
        const nodes = renderer(vm, localUi) || [];
        // 项目页第一次打开时，先把「晋升看你本人的一作」摊在最上面（点掉就不再出现）
        mount(panel, tab === 'projects' && !localUi.projectsIntroDone ? [uiProjectsIntro()].concat(nodes) : nodes);
      } else clear(panel);
    }
  }

  function start() {
    if (root) {
      root.addEventListener('click', onClick);
      root.addEventListener('mouseover', onOver);
      root.addEventListener('mouseout', onLeave);
      root.addEventListener('dragstart', onDragStart);
      root.addEventListener('dragover', onDragOver);
      root.addEventListener('drop', onDrop);
      root.addEventListener('dragend', onDragEnd);
    }
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', onKey);
    unsubscribe = store.subscribe(() => render(), { immediate: false });
    render();
    // 第一次进游戏（没有存档）时，先把「怎么玩」摊开一次。
    const fresh = lastVm && lastVm.hud.time.monthIndex === 0;
    const hasSave = typeof io.hasSave === 'function' ? io.hasSave() : true;
    if (fresh && !hasSave && !localUi.introDone) {
      localUi.introDone = true;
      localUi.modal = { kind: 'help' };
      render();
    }
    return api;
  }

  function destroy() {
    if (root) {
      root.removeEventListener('click', onClick);
      for (const [k, fn] of [['mouseover', onOver], ['mouseout', onLeave], ['dragstart', onDragStart], ['dragover', onDragOver], ['drop', onDrop], ['dragend', onDragEnd]]) root.removeEventListener(k, fn);
    }
    if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('keydown', onKey);
    if (typeof unsubscribe === 'function') unsubscribe();
  }

  const api = { render, start, destroy, handlers: HANDLERS, localUi };
  return api;
}

/**
 * modal.js —— 弹层集合：随机事件、结局画面、改名、玩法帮助、结算明细、重开确认、toast
 *
 * 只消费 viewmodel（pendingEvent / ending / toast）+ app.js 传进来的「本地 UI 状态」：
 * 本地状态只描述「哪个弹层打开着」，不参与任何游戏逻辑。
 */

import { $, h, mount, clear, button, tag, uiNum1, uiDeltaText } from './dom.js';
import { UI_RNAME, UI_RESET, UI_HELP_SECTIONS, UI_WIKI, UI_DEFER, UI_DEFER_BOSS, UI_RESIGN } from './copy.js';
import { renderReceiptDetail } from './receipt.js';
import { uiWikiView } from './views/wiki.js';

/** 改名输入框的引用（DOM shim 里 querySelector 也能找到，但这里留一份引用更稳）。 */
let uiRenameRefs = { name: null, son: null };

/** app.js 提交改名时读这里。 */
export function uiRenameValues() {
  return {
    name: uiRenameRefs.name ? String(uiRenameRefs.name.value || '') : '',
    sonName: uiRenameRefs.son ? String(uiRenameRefs.son.value || '') : '',
  };
}

function uiModalShell(title, subtitleText, tone, bodyNodes, actions) {
  return h('div', { class: 'modal-backdrop' }, [
    h('div', { class: 'modal tone-' + (tone || 'plain'), attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, dataset: { role: 'modal' } }, [
      h('div', { class: 'modal-head' }, [
        h('h2', { class: 'modal-title', text: title }),
        subtitleText ? h('p', { class: 'modal-sub', text: subtitleText }) : null,
      ]),
      h('div', { class: 'modal-body' }, bodyNodes),
      actions && actions.length ? h('div', { class: 'modal-actions' }, actions) : null,
    ]),
  ]);
}

/** 结局画面：按「最终战绩」把一局的核心账目摊开（字段见 GDD §9）。 */
function uiEndingScreen(vm) {
  const hud = vm.hud;
  const ach = hud.achievements;
  const ending = vm.ending;
  const finished = (vm.projects.archive || []).filter((p) => p.status === 'finished').length;
  const finishedCount = typeof ach.projectsFinished === 'number' ? ach.projectsFinished : finished;
  const papersFirst = ach.ranks.map((r) => r.label + ' ' + ((ach.papersFirst && ach.papersFirst[r.tier]) || 0)).join(' · ');
  const kindTone = ending.kind === 'success' ? 'success' : (ending.kind === 'bad' ? 'bad' : 'neutral');
  const rows = [
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '最终头衔' }), h('span', { class: 'end-v', text: hud.rank.title })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '总影响因子' }), h('span', { class: 'end-v', text: uiNum1(ach.totalIF) })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: 'SCI 一作' }), h('span', { class: 'end-v', text: papersFirst })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '结题项目' }), h('span', { class: 'end-v', text: finishedCount + ' 项' })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '培养毕业' }), h('span', { class: 'end-v', text: '硕士 ' + ach.graduated.master + ' · 博士 ' + ach.graduated.phd })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '诚信' }), h('span', { class: 'end-v', text: String(hud.integrity) })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '年龄' }), h('span', { class: 'end-v', text: hud.ageText })]),
    h('div', { class: 'end-kv' }, [h('span', { class: 'end-k', text: '任职月数' }), h('span', { class: 'end-v', text: ending.monthIndex + ' 个月' })]),
  ];
  const body = [
    h('p', { class: 'end-text', text: ending.text || '（这一局没有留下总结。）' }),
    h('div', { class: 'end-grid' }, rows),
    h('p', { class: 'end-foot', text: '结局编号：' + ending.id + (ending.variant ? ' · ' + ending.variant : '') }),
  ];
  const actions = [
    button('重开一局', { action: 'reset' }, { kind: 'primary' }),
    button('存档留个念', { action: 'save' }, { class: 'btn-ghost' }),
    button('回去看纪事', { action: 'ending-hide' }, { class: 'btn-ghost' }),
  ];
  return uiModalShell('结局 · ' + ending.title, '第 ' + ending.monthIndex + ' 个月', kindTone, body, actions);
}

function uiEventModal(ev) {
  const body = [h('p', { class: 'event-text', text: ev.text })];
  const actions = ev.choices.map((c) => h('div', { class: 'choice' }, [
    button(c.label, { action: 'event-choice', choiceId: c.id }, { kind: 'primary', class: 'choice-btn' }),
    c.hint ? h('span', { class: 'choice-hint', text: c.hint }) : null,
  ]));
  return uiModalShell(ev.title, '本月突发 · 必须做选择', ev.tone || 'warn', body, actions);
}

function uiRenameModal(vm) {
  const hud = vm.hud;
  const nameInput = h('input', {
    class: 'text-input',
    attrs: { type: 'text', id: UI_RNAME.inputId, maxlength: '12', placeholder: '课题组负责人', value: hud.name || '' },
  });
  const sonInput = h('input', {
    class: 'text-input',
    attrs: { type: 'text', id: UI_RNAME.sonInputId, maxlength: '12', placeholder: '儿子', value: hud.sonName || '' },
  });
  nameInput.value = hud.name || '';
  sonInput.value = hud.sonName || '';
  uiRenameRefs = { name: nameInput, son: sonInput };
  const body = [
    h('label', { class: 'field' }, [h('span', { class: 'field-k', text: UI_RNAME.playerLabel }), nameInput, h('span', { class: 'field-hint', text: UI_RNAME.playerHint })]),
    h('label', { class: 'field' }, [h('span', { class: 'field-k', text: UI_RNAME.sonLabel }), sonInput, h('span', { class: 'field-hint', text: UI_RNAME.sonHint })]),
  ];
  const actions = [
    button(UI_RNAME.apply, { action: 'rename-apply' }, { kind: 'primary' }),
    button(UI_RNAME.cancel, { action: 'modal-close' }, { class: 'btn-ghost' }),
  ];
  return uiModalShell(UI_RNAME.title, '署名会出现在纪事、结题报告和结局里', 'plain', body, actions);
}

/**
 * 帮助弹层 = 新手说明 + 游戏内百科（v1.5.0）。
 * 百科放在既有弹层里，不新增第 6 个标签页；数字全部来自 vm.consts.wiki。
 */
function uiHelpModal(vm) {
  const body = UI_HELP_SECTIONS.map((s) => h('div', { class: 'help-block' }, [
    h('h3', { class: 'help-title', text: s.title }),
    h('p', { class: 'help-text', text: s.text }),
  ]));
  const wiki = uiWikiView(vm && vm.consts ? vm.consts.wiki : null);
  if (wiki) body.push(wiki);
  const actions = [button('知道了，开始干', { action: 'modal-close' }, { kind: 'primary' })];
  return uiModalShell(UI_WIKI.entry, '任何时候都能从顶栏「玩法」再打开', 'info', body, actions);
}

function uiResetModal() {
  const body = [h('p', { class: 'event-text', text: UI_RESET.text })];
  const actions = [
    button(UI_RESET.confirm, { action: 'reset-confirm' }, { kind: 'danger' }),
    button(UI_RESET.cancel, { action: 'modal-close' }, { class: 'btn-ghost' }),
  ];
  return uiModalShell(UI_RESET.title, null, 'bad', body, actions);
}

/** 下海确认（t8 finding：先确认再 dispatch，文案写明不可撤销）。 */
function uiResignModal() {
  const body = [h('p', { class: 'event-text', text: UI_RESIGN.text })];
  const actions = [
    button(UI_RESIGN.confirm, { action: 'resign-confirm' }, { kind: 'danger' }),
    button(UI_RESIGN.cancel, { action: 'modal-close' }, { class: 'btn-ghost' }),
  ];
  return uiModalShell(UI_RESIGN.title, '本局立即结束 · 不可撤销 · 结局记进纪事', 'bad', body, actions);
}

/**
 * 延毕决定弹层（t8 finding）：与 pendingEvent 同级的待决状态。
 * 后果里的数字全部来自 vm.consts.defer（core 的数据层），UI 只做拼句。
 */
function uiDeferModal(vm) {
  const consts = (vm.consts && vm.consts.defer) || null;
  const rows = vm.pendingDefer || [];
  const deferTextOf = (s) => {
    if (!consts) return UI_DEFER.noConsts;
    return UI_DEFER.deferEffect
      .replace('{months}', String(consts.months))
      .replace('{happy}', uiDeltaText(consts.happy))
      .replace('{quotaMaster}', String(consts.quotaMaster))
      .replace('{quotaPhd}', String(consts.quotaPhd));
  };
  const giveUpText = consts
    ? UI_DEFER.giveUpEffect.replace('{integrity}', uiDeltaText(consts.giveUpIntegrity))
    : UI_DEFER.noConsts;
  const body = rows.map((s) => {
    const quota = consts ? (s.degree === 'phd' ? consts.quotaPhd : consts.quotaMaster) : 0;
    const usedUp = Boolean(consts) && s.deferMonths >= quota;
    return h('div', { class: 'defer-row', dataset: { role: 'defer', id: s.id } }, [
      h('div', { class: 'defer-head' }, [
        h('strong', { class: 'defer-name', text: s.name }),
        tag(s.degreeLabel, 'info'),
        tag(s.statusLabel, 'warn'),
        h('span', { class: 'muted', text: '在读 ' + (s.monthsInLabText || '') + ' · 毕业进度 ' + s.degreeProgress + '% · 已延毕 ' + s.deferMonths + ' 次' }),
      ]),
      h('div', { class: 'defer-choices' }, [
        h('div', { class: 'defer-choice' }, [
          button(UI_DEFER.deferButton, { action: 'defer-choice', studentId: s.id, choice: 'defer' },
            { kind: 'primary', disabled: usedUp, title: usedUp ? UI_DEFER.quotaUsedUp : deferTextOf(s) }),
          h('span', { class: 'choice-hint', text: usedUp ? UI_DEFER.quotaUsedUp : deferTextOf(s) }),
        ]),
        h('div', { class: 'defer-choice' }, [
          button(UI_DEFER.giveUpButton, { action: 'defer-choice', studentId: s.id, choice: 'giveUp' },
            { kind: 'danger', title: giveUpText }),
          h('span', { class: 'choice-hint', text: giveUpText }),
        ]),
      ]),
    ]);
  });
  body.push(h('p', { class: 'defer-foot', text: UI_DEFER.irreversible }));
  return uiModalShell(UI_DEFER.title, UI_DEFER.subtitle, 'warn', body, []);
}

/**
 * v1.6.0「延毕他」确认弹层：名册密集，先摊开代价再动手（复用 uiModalShell，不新造弹层）。
 * 代价里的数字全部来自 vm.consts.deferByBoss（core 的数据层），UI 只做拼句。
 */
function uiDeferBossModal(vm, ui) {
  const consts = (vm.consts && vm.consts.deferByBoss) || null;
  const id = ui && ui.modal ? ui.modal.studentId : null;
  const rows = (vm.crew && vm.crew.students) || (vm.crew && vm.crew.active) || [];
  const row = rows.filter((s) => s.id === id)[0] || null;
  const costText = consts
    ? UI_DEFER_BOSS.cost.replace('{happy}', uiDeltaText(consts.happy)).replace('{progress}', uiDeltaText(consts.progress))
    : UI_DEFER_BOSS.noConsts;
  const body = [
    h('p', { class: 'event-text', text: UI_DEFER_BOSS.lead }),
    h('p', { class: 'event-text', dataset: { role: 'defer-boss-cost' }, text: costText }),
    row ? h('p', { class: 'muted', text: row.name + ' · 幸福度 ' + row.happiness + ' · 毕业进度 ' + row.degreeProgress + '%' }) : null,
  ];
  const actions = [
    button(UI_DEFER_BOSS.confirm, { action: 'defer-boss-confirm', studentId: id || '' }, { kind: 'danger' }),
    button(UI_DEFER_BOSS.cancel, { action: 'defer-boss-cancel' }, { class: 'btn-ghost' }),
  ];
  return uiModalShell(UI_DEFER_BOSS.title, UI_DEFER_BOSS.subtitle, 'bad', body, actions);
}

/** 主渲染：core 事件/结局优先，其次是玩家自己打开的弹层。 */
export function renderModal(vm, localUi) {
  const root = $('modal-root');
  if (!root) return;
  const ui = localUi || {};
  const localKind = ui.modal ? ui.modal.kind : null;
  clear(root);
  let node = null;
  if (vm.ending && !ui.hideEnding) node = uiEndingScreen(vm);
  else if (localKind === 'help') node = uiHelpModal(vm);
  else if (localKind === 'rename') node = uiRenameModal(vm);
  else if (localKind === 'receipt') node = uiModalShell('结算明细', null, 'plain', renderReceiptDetail(vm, vm.receipt), [button('知道了', { action: 'modal-close' }, { kind: 'primary' })]);
  else if (localKind === 'reset') node = uiResetModal();
  else if (localKind === 'resign-confirm' || localKind === 'resign') node = uiResignModal();
  else if (localKind === 'defer-boss') node = uiDeferBossModal(vm, ui);
  else if (vm.pendingEvent) node = uiEventModal(vm.pendingEvent);
  else if (vm.pendingDefer && vm.pendingDefer.length) node = uiDeferModal(vm);
  if (node) mount(root, [node]);
}

/** toast：core 通过 state.ui.toast 给的一句反馈（失败原因、超额提醒等）。 */
export function renderToast(vm) {
  const root = $('toast-root');
  if (!root) return;
  clear(root);
  if (!vm.toast) return;
  mount(root, [h('div', { class: 'toast', dataset: { role: 'toast' } }, [
    tag('提示', 'warn'),
    h('span', { class: 'toast-text', text: vm.toast }),
    button('知道了', { action: 'dismiss-toast' }, { class: 'btn-ghost btn-xs' }),
  ])]);
}
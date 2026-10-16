/**
 * hud.js —— 顶部资源条（身份 / 资源 / 操作）
 *
 * 只消费 viewmodel.hud：所有挂载点都是 index.html 里已有的 <span>，所以组件必须是行内元素。
 * 交互按钮统一带 data-action，交给 app.js 的事件代理（scripts/check.mjs 会静态校验注册情况）。
 */

import { $, h, mount, show, tag, button, uiInlineStat, uiInlineMeter, uiPaperTiles, uiNum1, uiLevelTone } from './dom.js';
import { uiIcon } from './icons.js';
import { UI_DROUGHT } from './copy.js';
import { UI_RNAME, UI_DEFER, UI_CONSUMABLE_UNIT } from './copy.js';

function uiSetText(id, text) {
  const node = $(id);
  if (node) node.textContent = String(text);
}

function uiSetAction(id, action) {
  const node = $(id);
  if (!node) return null;
  if (node.dataset) node.dataset.action = action;
  return node;
}

/** 玩家姓名 + 改名入口（「总览」卡片里也有一个同样的入口）。 */
function uiNameBlock(name) {
  const display = name === undefined || name === null || name === '' ? '（还没起名）' : name;
  return [
    h('span', { class: 'name-k', text: '负责人' }),
    h('strong', { class: 'name-v', text: display }),
    button('改名', { action: 'rename-open' }, { class: 'btn-ghost btn-xs', title: UI_RNAME.playerHint }),
  ];
}

/** 儿子：对外宣称「都是为了他」。 */
function uiSonBlock(sonName) {
  const son = sonName === undefined || sonName === null || sonName === '' ? '—' : sonName;
  return [
    h('span', { class: 'name-k', text: '儿子' }),
    h('span', { class: 'name-v', text: son }),
  ];
}

/** 顶栏主渲染。 */
export function renderHud(vm) {
  const hud = vm.hud;
  const ach = hud.achievements;

  // 身份行
  const nameRoot = $('hud-name');
  if (nameRoot) mount(nameRoot, uiNameBlock(hud.name || hud.playerName));
  const sonRoot = $('hud-son');
  if (sonRoot) mount(sonRoot, uiSonBlock(hud.sonName));
  const rankRoot = $('hud-rank');
  if (rankRoot) {
    // 一作空窗提示（t35 第 ① 件）：只看 core 的 stuck，阈值/months 都由 core 给
    const drought = hud.firstAuthorDrought || null;
    const droughtStuck = Boolean(drought && drought.stuck);
    mount(rankRoot, [
      h('span', { class: 'rank-block' }, [
        uiIcon('badge-check'),
        tag(hud.rank.title, hud.rank.eligible ? 'good' : 'info'),
        h('span', { class: 'rank-progress-text', text: hud.rank.index + ' / ' + hud.rank.max }),
      ]),
      droughtStuck
        ? h('span', {
          class: 'drought-hint',
          attrs: {
            title: UI_DROUGHT.title
              .replace('{months}', String(drought.months))
              .replace('{threshold}', String(drought.threshold)),
          },
        }, [
          uiIcon('trending-up'),
          h('span', { class: 'drought-hint-v', text: UI_DROUGHT.tag + '（' + drought.months + ' 个月）' }),
        ])
        : null,
    ]);
  }
  // 年月带日历图标（t27：图标全部内联自绘/ISC，见 docs/ASSETS.md）
  const monthRoot = $('hud-month');
  if (monthRoot) mount(monthRoot, [uiIcon('calendar-days'), h('span', { text: hud.time.text })]);
  uiSetText('hud-age', hud.ageText);
  const waitingDefer = (vm.pendingDefer || []).map((s) => s.name);
  const phaseRoot = $('hud-phase');
  if (phaseRoot) {
    const tone = vm.canAdvance ? 'good' : (vm.ending ? 'bad' : 'warn');
    mount(phaseRoot, [
      tag(hud.phase.label, tone),
      waitingDefer.length ? tag(UI_DEFER.pendingTag + '（延毕）', 'bad') : null,
    ]);
  }

  // 资源行
  const moneyRoot = $('hud-money');
  if (moneyRoot) mount(moneyRoot, [uiInlineStat('经费', uiNum1(hud.money) + ' 万', hud.money < 0 ? 'bad' : null, 'coins')]);
  const consumableRoot = $('hud-consumable');
  if (consumableRoot) {
    mount(consumableRoot, [
      uiInlineStat('耗材资金', uiNum1(hud.consumable) + ' 单位', hud.consumable <= 0 ? 'bad' : null, 'flask-conical'),
      hud.consumableLow ? tag('耗材见底', 'bad') : null,
    ]);
    // t8 finding ⑤：耗材资金的「单位」与「万元」的换算，鼠标停在这里就能看到；
    // 见底时优先显示 core 的强提示（hud.consumableHint）。
    const unit = (vm.consts && vm.consts.consumable) || null;
    if (unit) {
      const unitNote = UI_CONSUMABLE_UNIT.note
        .replace('{unit}', uiNum1(unit.pricePerUnit))
        .replace('{yuan}', uiNum1(unit.pricePerUnit));
      consumableRoot.setAttribute('title', hud.consumableHint ? unitNote + ' · ' + hud.consumableHint : unitNote);
    }
  }
  const energyRoot = $('hud-energy');
  if (energyRoot) {
    const pct = hud.energyMax > 0 ? (hud.energy / hud.energyMax) * 100 : 0;
    mount(energyRoot, [uiInlineMeter('精力', hud.energy + ' / ' + hud.energyMax, pct, uiLevelTone(pct), 'zap')]);
  }
  const healthRoot = $('hud-health');
  if (healthRoot) mount(healthRoot, [uiInlineStat('健康', hud.health, uiLevelTone(hud.health), 'heart-pulse')]);
  const integrityRoot = $('hud-integrity');
  if (integrityRoot) mount(integrityRoot, [uiInlineStat('诚信', hud.integrity, uiLevelTone(hud.integrity), 'shield-check')]);
  const ifRoot = $('hud-if');
  if (ifRoot) mount(ifRoot, [uiInlineStat('总 IF', uiNum1(ach.totalIF), null, 'trending-up')]);
  const firstRoot = $('hud-first');
  if (firstRoot) mount(firstRoot, [uiPaperTiles(ach.ranks, ach.papersFirst)]);
  const ticketRoot = $('hud-tickets');
  if (ticketRoot) mount(ticketRoot, [uiInlineStat('推荐票', hud.tickets, null, 'ticket')]);
  const studentsRoot = $('hud-students');
  if (studentsRoot) mount(studentsRoot, [uiInlineStat('名额', hud.slots.text, null, 'graduation-cap')]);
  const electionRoot = $('hud-election');
  if (electionRoot) {
    mount(electionRoot, [tag('增选窗口开放中', 'good')]);
    show(electionRoot, Boolean(hud.election && hud.election.windowOpen));
  }

  // 操作行：按钮文字与可用性都跟着 vm 走，禁用时给出理由。
  const next = uiSetAction('btn-next-month', 'next-month');
  if (next) {
    const blockedReason = vm.ending
      ? '本局已结束'
      : (waitingDefer.length ? ('先做延毕决定：' + waitingDefer.join('、')) : '先处理弹出的事件');
    next.disabled = !hud.canAdvance;
    next.textContent = hud.canAdvance ? '下一个月 ▶' : blockedReason;
    next.className = 'btn btn-primary btn-next' + (hud.canAdvance ? '' : ' is-idle');
    next.setAttribute('title', hud.canAdvance
      ? '进入月末结算（收入、支出、项目进度、幸福度变化都会列在结算回执里）'
      : (waitingDefer.length ? ('本月不能推进：' + blockedReason + '（延毕还是肄业，选完才走时间）') : '本月还不能推进'));
  }
  uiSetAction('btn-help', 'help');
  uiSetAction('btn-save', 'save');
  uiSetAction('btn-export', 'export');
  uiSetAction('btn-import', 'import');
  uiSetAction('btn-resign', 'resign');
  uiSetAction('btn-reset', 'reset');
  const resign = $('btn-resign');
  if (resign) resign.disabled = Boolean(vm.ending);
  const saveBtn = $('btn-save');
  if (saveBtn && saveBtn.dataset) saveBtn.setAttribute('title', '把当前进度写进浏览器存档（每次月末也会自动存）');
  return vm;
}

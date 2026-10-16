/**
 * views/actions.js —— 行动页：4 种行动（精力消耗可见）+ 本月精力预算 + 耗材速览
 *
 * 行动的名称/精力消耗/说明全部来自 vm.consts.actions（core 的 ACTION_DEFS 透传）；
 * consts 缺失时降级成「无数值」的产品文案，绝不把数字写进 UI。
 */

import { h, bar, tag, button, uiCard, uiEmpty, uiNote, uiInlineStat, uiGoto, uiNum1 } from '../dom.js';
import { UI_ACTION_LABELS, UI_ACTION_HINTS, UI_EMPTY } from '../copy.js';

function uiActionDef(vm, id) {
  const list = (vm.consts && vm.consts.actions) || [];
  return list.filter((d) => d.id === id)[0] || null;
}

function uiCostText(def) {
  if (!def) return '消耗精力';
  const bits = [];
  if (typeof def.energyCost === 'number' && def.energyCost > 0) bits.push('精力 −' + def.energyCost);
  if (typeof def.moneyCost === 'number' && def.moneyCost > 0) bits.push('经费 −' + uiNum1(def.moneyCost) + ' 万');
  else if (def.moneyCost === 'perStudent') bits.push('经费按人头计');
  return bits.length ? bits.join(' · ') : '不花精力也不花钱';
}

/**
 * 每月限次文案。t8 finding ⑥：次数必须与 core 的判定一致——
 * engine.reduceDoAction 用 TALK_PER_STUDENT_PER_MONTH（经 vm.consts.limits 透传），
 * 所以 UI 不再写死「每人每月一次」，而是显示 core 给的数字。
 */
function uiLimitText(vm, def) {
  if (!def) return null;
  if (def.limitPerMonth === 'perStudent') {
    const limits = (vm.consts && vm.consts.limits) || null;
    if (!limits || typeof limits.talkPerStudentPerMonth !== 'number') return '每名学生每月限次';
    return '每人每月最多 ' + limits.talkPerStudentPerMonth + ' 次';
  }
  if (typeof def.limitPerMonth === 'number' && def.limitPerMonth < 90) return '每月最多 ' + def.limitPerMonth + ' 次';
  return null;
}

function uiActionCard(vm, id, extras, opts) {
  const def = uiActionDef(vm, id);
  const a = vm.actions;
  const cost = def ? def.energyCost : null;
  const notEnough = typeof cost === 'number' && a.energy < cost;
  const label = (def && def.name) || UI_ACTION_LABELS[id] || id;
  const hint = (def && def.hint) || UI_ACTION_HINTS[id] || '';
  const limit = uiLimitText(vm, def);
  return h('div', { class: 'action-card' + (notEnough ? ' is-locked' : ''), dataset: { role: 'action', id } }, [
    h('div', { class: 'action-head' }, [
      h('strong', { class: 'action-name', text: label }),
      tag(uiCostText(def), notEnough ? 'bad' : 'info'),
      limit ? tag(limit, 'mute') : null,
    ]),
    h('p', { class: 'action-hint', text: hint }),
    extras || null,
    opts && opts.noButton ? null : button('执行 · ' + label, { action: 'do-action', actionId: id }, {
      kind: 'primary',
      class: 'btn-sm',
      disabled: notEnough,
      title: notEnough ? '本月精力不够了，先锻炼或者下个月再来' : '',
    }),
  ]);
}

function uiTalkPicker(vm) {
  const active = vm.crew.active;
  if (!active.length) return uiEmpty(UI_EMPTY.active);
  return h('div', { class: 'talk-picker' }, active.map((s) => h('div', { class: 'talk-row' }, [
    h('div', { class: 'talk-row-head' }, [
      h('strong', { text: s.name }),
      tag('幸福 ' + s.happiness, s.happinessTone),
      tag('毕业 ' + s.degreeProgress + '%', 'mute'),
      s.talkThisMonth ? tag('本月已交流', 'mute') : null,
    ]),
    s.projects.length
      ? h('div', { class: 'talk-projects' }, s.projects.map((p) => button(p.name + ' · ' + p.progressPct + '%', {
        action: 'do-action', actionId: 'talk', studentId: s.id, projectId: p.instanceId,
      }, { class: 'btn-xs' })))
      : h('span', { class: 'muted', text: '没有负责项目：先到「项目」页把他分配给一个本子' }),
  ])));
}

export function renderActions(vm) {
  const a = vm.actions;
  const pct = a.energyMax > 0 ? (a.energy / a.energyMax) * 100 : 0;
  const budget = uiCard('本月精力', '先把精力花在能推动进度的地方，再推进月份', [
    uiGoto('去学生名册', 'lab', { section: 'students' }),
  ], [
    h('div', { class: 'slot-row' }, [
      uiInlineStat('精力', a.energy + ' / ' + a.energyMax),
      uiInlineStat('经费', uiNum1(a.money) + ' 万'),
      uiInlineStat('耗材资金', uiNum1(a.consumable) + ' 单位', a.consumableLow ? 'bad' : null),
    ]),
    bar(pct, a.energy > 0 ? 'good' : 'bad', a.energy + ' / ' + a.energyMax),
    uiNote('精力每月重置，上限由健康决定；精力不够时行动按钮会变灰。'),
  ]);

  const talkCard = uiActionCard(vm, 'talk', uiTalkPicker(vm), { noButton: true });
  const others = ['meeting', 'exercise', 'teambuild'].map((id) => uiActionCard(vm, id, null));

  const consume = uiCard('耗材与消耗模式（速览）', '完整面板在「课题组 · 耗材库」', [
    uiGoto('去耗材库', 'lab', { section: 'consumables' }),
  ], [
    h('div', { class: 'slot-row' }, [
      uiInlineStat('当前模式', (a.consumeModes.filter((m) => m.active)[0] || {}).label || '—'),
      uiInlineStat('可采购', '一批 ' + a.buyPack + ' 单位 / ' + uiNum1(a.buyPackCost) + ' 万', a.canBuyConsumable ? 'good' : 'bad'),
    ]),
  ]);

  return [budget, h('section', { class: 'card' }, [
    h('div', { class: 'card-head' }, [h('div', { class: 'card-title-wrap' }, [
      h('h2', { class: 'card-title', text: '四个行动' }),
      h('p', { class: 'card-sub', text: '耗精力换进度与心情；点按钮立刻生效，进度变化会出现在「上月结算回执」' }),
    ])]),
    h('div', { class: 'action-grid' }, [talkCard].concat(others)),
  ]), consume];
}

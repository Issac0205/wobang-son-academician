/**
 * views/market.js —— 市场页：开放状态 + 保研生池 / 考研生池（差异化展示）
 *
 * 数据全部来自 vm.market；项目市场的本子放在「项目」页（承接入口与在研项目挨着更好用）。
 */

import { h, bar, tag, button, uiCard, uiEmpty, uiKv, uiNote, uiInlineStat, uiGoto, uiNum1 } from '../dom.js';
import { UI_EMPTY } from '../copy.js';

const UI_POOL_META = {
  translate: {
    title: '保研生池',
    subtitle: '推免进来的：能力均值高、门槛高、要花钱办手续，来了就能上手。',
    empty: '这个月没有保研生投简历。',
  },
  exam: {
    title: '考研生池',
    subtitle: '统考进来的：均值一般，但偶尔能捡到黑马；门槛低、手续便宜。',
    empty: '这个月没有考研生投简历。',
  },
};

function uiPoolMonthsText(consts, source) {
  if (!consts || !consts.market) return null;
  const months = source === 'exam' ? consts.market.examMonths : consts.market.translateMonths;
  if (!months || !months.length) return null;
  return '投放月份：' + months.join('、') + ' 月';
}

function uiCandidateCard(vm, o) {
  const consts = vm.consts || {};
  const expected = o.expectedWage || null;
  const wageText = expected ? (expected.label || expected.tier) : null;
  return h('div', { class: 'candidate tone-' + (o.canHire ? 'good' : 'mute'), dataset: { role: 'candidate', id: o.offerId } }, [
    h('div', { class: 'candidate-head' }, [
      h('strong', { class: 'candidate-name', text: o.name }),
      tag(o.degreeLabel, 'info'),
      tag(o.sourceLabel, 'mute'),
      o.canHire ? null : tag('不符合门槛', 'warn'),
    ]),
    h('div', { class: 'candidate-ability' }, [
      h('span', { class: 'candidate-ability-k', text: '天赋 ' + o.abilityPct + '%' }),
      bar(o.abilityPct, o.abilityPct >= 75 ? 'good' : (o.abilityPct >= 55 ? 'warn' : 'bad')),
    ]),
    h('div', { class: 'kv-grid kv-grid-3' }, [
      uiKv('招募成本', uiNum1(o.cost) + ' 万'),
      uiKv('组内 IF 门槛', uiNum1(o.reqIF)),
      uiKv('头衔门槛', '第 ' + o.reqRank + ' 级'),
      uiKv('工资期望', wageText ? wageText : '能力越高越需要高工资'),
    ]),
    h('div', { class: 'candidate-actions' }, [
      button('招进来', { action: 'hire-student', offerId: o.offerId }, { kind: 'primary', class: 'btn-xs', disabled: !o.canHire }),
      o.reason ? h('span', { class: 'muted', text: o.reason }) : null,
    ]),
  ]);
}

function uiPoolCard(vm, source) {
  const meta = UI_POOL_META[source] || UI_POOL_META.translate;
  const all = vm.market.students;
  const mine = all.filter((o) => o.source === source);
  const other = all.filter((o) => o.source !== source);
  const monthsText = uiPoolMonthsText(vm.consts, source);
  const subtitle = meta.subtitle + (monthsText ? ' · ' + monthsText : '');
  const body = [];
  if (mine.length) body.push(h('div', { class: 'candidate-grid' }, mine.map((o) => uiCandidateCard(vm, o))));
  else {
    body.push(uiEmpty(meta.empty + '（' + (vm.market.open ? '市场开着，但这个池子这个月没人' : vm.market.openText) + '）'));
    if (other.length) body.push(uiNote('这个月来投简历的是' + (source === 'exam' ? '保研生' : '考研生') + '池的人，切到另一个池子看。'));
  }
  return uiCard(meta.title + '（' + mine.length + '）', subtitle, null, body);
}

function uiMarketStatusCard(vm) {
  const m = vm.market;
  const consts = vm.consts || {};
  const perMonth = consts.market && consts.market.recruitPerMonth ? consts.market.recruitPerMonth : null;
  return uiCard('人才市场', m.openText, [
    uiGoto('看项目本子', 'projects', { title: '国家/企业项目在「项目」页承揽' }),
  ], [
    h('div', { class: 'slot-row' }, [
      uiInlineStat('开放状态', m.open ? '开放中' : '已关闭', m.open ? 'good' : 'mute'),
      uiInlineStat('市场容量', m.slots.used + ' / ' + m.slots.cap),
      perMonth ? uiInlineStat('每月可招', perMonth + ' 人') : null,
    ]),
    uiNote('招募要花经费（办手续），招进来之后每月要发工资；门槛是组内总 IF 与头衔等级。'),
  ]);
}

export function renderMarket(vm) {
  return [uiMarketStatusCard(vm), uiPoolCard(vm, 'translate'), uiPoolCard(vm, 'exam')];
}

/**
 * receipt.js —— 「上月结算回执」：把 core 产出的月报摊开给玩家看
 *
 * 数据来源：vm.receipt（= core 在月末结算里逐项登记的 state.stats.lastReceipt）。
 * 本文件只做排版与格式化：不计算任何游戏数值，也不自己推导账目。
 * 字段（见 src/core/engine.js 的 newReceipt / finalizeReceipt）：
 *   income[] / expense[] / projects[] / students[] / papers[] / events[]
 *   moneyBefore / moneyAfter / moneyNet / consumableNet / ifDelta / integrityDelta / ticketsDelta
 */

import { h, tag, button, bar, uiNum1, uiDeltaText, uiDeltaTone, uiKv, uiNote, uiCard, uiEmpty } from './dom.js';
import { UI_RECEIPT } from './copy.js';

function uiDeltaChip(labelText, delta, unit, note) {
  const tone = uiDeltaTone(delta);
  return h('span', { class: 'delta-chip tone-' + tone, dataset: { role: 'delta', key: labelText } }, [
    h('span', { class: 'delta-k', text: labelText }),
    h('span', { class: 'delta-v', text: uiDeltaText(delta, unit) }),
    note ? h('span', { class: 'delta-note', text: note }) : null,
  ]);
}

function uiTimeText(r) {
  return '第 ' + r.year + ' 年 ' + r.month + ' 月';
}

/** 分区 id → 中文标签（标签来自 vm.hud.achievements.ranks，避免 UI 自己维护词典）。 */
function uiTierLabel(vm, tier) {
  const ranks = (vm.hud && vm.hud.achievements && vm.hud.achievements.ranks) || [];
  const hit = ranks.filter((r) => r.tier === tier)[0];
  return hit ? hit.label : tier;
}

function uiPaperCount(receipt) {
  return (receipt.papers || []).reduce((sum, p) => sum + (p.count || 0), 0);
}

/**
 * 月报里的「论文」三项（t24 之后的真实口径）：
 *   · all    本月见刊总数（含学生一作那部分）；
 *   · mine   其中你（老板）是一作的篇数 —— 只有这部分进晋升门槛；
 *   · student 挂在学生名下的篇数。
 * 老存档没有 papersAll/papersStudent 时，退回「按分区计数求和」的旧口径（不显示学生那部分）。
 */
function uiPaperSplit(receipt) {
  const mine = uiPaperCount(receipt);
  const all = receipt.papersAll === undefined || receipt.papersAll === null ? mine : receipt.papersAll;
  const student = receipt.papersStudent === undefined || receipt.papersStudent === null
    ? Math.max(0, all - mine)
    : receipt.papersStudent;
  return { all, mine, student };
}

/** 结算回执条（挂在 index.html 的 #month-report 里，所有标签页都能看到）。 */
export function renderReceiptStrip(vm, receipt, openDetail) {
  if (!receipt) {
    return [h('div', { class: 'report report-idle', dataset: { role: 'report' } }, [
      h('div', { class: 'report-head' }, [
        h('strong', { class: 'report-title', text: UI_RECEIPT.title }),
        h('span', { class: 'report-time', text: vm.hud.time.text }),
      ]),
      h('p', { class: 'report-empty', text: UI_RECEIPT.empty }),
    ])];
  }
  const projects = receipt.projects || [];
  const students = receipt.students || [];
  const papers = uiPaperSplit(receipt);
  const events = receipt.events || [];
  return [h('div', { class: 'report', dataset: { role: 'report' } }, [
    h('div', { class: 'report-head' }, [
      h('strong', { class: 'report-title', text: UI_RECEIPT.title }),
      h('span', { class: 'report-time', text: uiTimeText(receipt) }),
      h('span', { class: 'report-total', text: '进项 ' + (receipt.income || []).length + ' 笔 · 出项 ' + (receipt.expense || []).length + ' 笔' }),
      openDetail ? button('看明细', { action: 'receipt-open' }, { class: 'btn-ghost btn-xs' }) : null,
    ]),
    h('div', { class: 'report-chips' }, [
      uiDeltaChip('经费', receipt.moneyNet || 0, '万'),
      // 这里给的是「本月净变化」，后面补上当前库存，避免读成「库存为负」（t6 finding）
      uiDeltaChip(UI_RECEIPT.consumableLabel, receipt.consumableNet || 0, '单位',
        UI_RECEIPT.consumableStock.replace('{stock}', uiNum1(receipt.consumableAfter))),
      uiDeltaChip('总 IF', receipt.ifDelta || 0),
      uiDeltaChip('诚信', receipt.integrityDelta || 0),
      uiDeltaChip('推荐票', receipt.ticketsDelta || 0),
      papers.all ? h('span', { class: 'delta-chip tone-up' }, [
        h('span', { class: 'delta-k', text: '论文' }),
        h('span', { class: 'delta-v', text: papers.all + ' 篇' }),
        h('span', { class: 'delta-note', text: '你的一作 ' + papers.mine + ' 篇' }),
      ]) : null,
      events.length ? h('span', { class: 'delta-chip tone-flat' }, [h('span', { class: 'delta-k', text: '事件' }), h('span', { class: 'delta-v', text: events.length + ' 起' })]) : null,
    ]),
    h('div', { class: 'report-lines' }, [
      projects.length
        ? h('div', { class: 'report-line' }, [h('span', { class: 'report-line-k', text: '项目' })].concat(projects.map((p) => h('span', {
          class: 'report-chip tone-' + (p.starved ? 'down' : (p.progressDelta > 0 ? 'up' : 'flat')),
        }, [
          h('span', { text: p.name }),
          h('span', { class: 'report-chip-v', text: p.starved ? '耗材断供' : uiDeltaText(p.progressDelta, '点') }),
        ]))))
        : h('div', { class: 'report-line muted', text: UI_RECEIPT.noProject }),
      students.length
        ? h('div', { class: 'report-line' }, [h('span', { class: 'report-line-k', text: '学生' })].concat(students.map((s) => h('span', {
          class: 'report-chip tone-' + (s.happyDelta < 0 ? 'down' : (s.happyDelta > 0 ? 'up' : 'flat')),
        }, [
          h('span', { text: s.name }),
          h('span', { class: 'report-chip-v', text: s.note ? s.note : ('心情 ' + uiDeltaText(s.happyDelta)) }),
        ]))))
        : h('div', { class: 'report-line muted', text: UI_RECEIPT.noStudent }),
    ]),
    papers.all ? h('div', { class: 'report-papers', text: '本月见刊 ' + papers.all + ' 篇，其中你的一作 ' + papers.mine + ' 篇'
      + (papers.student ? '（另外 ' + papers.student + ' 篇挂学生名下）' : '')
      + '：' + (receipt.papers || []).map((p) => uiTierLabel(vm, p.tier) + ' ' + p.count + ' 篇').join(' · ') }) : null,
    events.length ? h('div', { class: 'report-events', text: '本月事件：' + events.join('；') }) : null,
  ])];
}

/** 结算明细（弹层内容）：收入/支出逐笔列出。 */
export function renderReceiptDetail(vm, receipt) {
  if (!receipt) return [uiEmpty(UI_RECEIPT.empty)];
  const income = receipt.income || [];
  const expense = receipt.expense || [];
  const projects = receipt.projects || [];
  const students = receipt.students || [];
  const papers = uiPaperSplit(receipt);
  const rows = [
    uiKv('经费（万）', uiNum1(receipt.moneyBefore) + ' → ' + uiNum1(receipt.moneyAfter) + '（' + uiDeltaText(receipt.moneyNet) + '）', uiDeltaTone(receipt.moneyNet)),
    uiKv(UI_RECEIPT.consumableDetailLabel,
      uiDeltaText(receipt.consumableNet) + UI_RECEIPT.consumableStock.replace('{stock}', uiNum1(receipt.consumableAfter)),
      uiDeltaTone(receipt.consumableNet)),
    papers.all ? uiKv('本月见刊（篇）', papers.all + ' 篇（你的一作 ' + papers.mine + ' 篇' + (papers.student ? ' · 学生 ' + papers.student + ' 篇' : '') + '）') : null,
    uiKv('总影响因子', uiDeltaText(receipt.ifDelta), uiDeltaTone(receipt.ifDelta)),
    uiKv('诚信', uiDeltaText(receipt.integrityDelta), uiDeltaTone(receipt.integrityDelta)),
    uiKv('推荐票', uiDeltaText(receipt.ticketsDelta), uiDeltaTone(receipt.ticketsDelta)),
  ];
  const sections = [h('div', { class: 'receipt-time', text: '结算月份：' + uiTimeText(receipt) }), h('div', { class: 'kv-grid' }, rows)];

  sections.push(h('h3', { class: 'receipt-h', text: '进项（' + income.length + '）' }));
  sections.push(income.length
    ? h('ul', { class: 'receipt-list' }, income.map((it) => h('li', {}, [
      h('span', { class: 'receipt-li-name', text: it.label }),
      h('span', { class: 'receipt-li-v tone-up', text: '+' + uiNum1(it.amount) + ' 万' }),
    ])))
    : uiNote('本月没有进项。'));

  sections.push(h('h3', { class: 'receipt-h', text: '出项（' + expense.length + '）' }));
  sections.push(expense.length
    ? h('ul', { class: 'receipt-list' }, expense.map((it) => h('li', {}, [
      h('span', { class: 'receipt-li-name', text: it.label }),
      h('span', { class: 'receipt-li-v tone-down', text: '−' + uiNum1(it.amount) + ' 万' }),
    ])))
    : uiNote('本月没有支出。'));

  sections.push(h('h3', { class: 'receipt-h', text: '项目进度（' + projects.length + '）' }));
  sections.push(projects.length
    ? h('ul', { class: 'receipt-list' }, projects.map((p) => h('li', {}, [
      h('span', { class: 'receipt-li-name', text: p.name }),
      p.starved ? tag('耗材断供，本月几乎白干', 'bad') : tag(uiDeltaText(p.progressDelta, '点'), p.progressDelta > 0 ? 'good' : 'mute'),
      p.status && p.status !== 'active' ? tag(p.status === 'finished' ? '本月结题' : '本月失败', p.status === 'finished' ? 'good' : 'bad') : null,
      h('span', { class: 'receipt-li-v', text: '当前 ' + uiNum1(p.progressPct) + '%' }),
      bar(p.progressPct, p.status === 'failed' ? 'bad' : 'good'),
    ])))
    : uiNote(UI_RECEIPT.noProject));

  sections.push(h('h3', { class: 'receipt-h', text: '学生状态（' + students.length + '）' }));
  sections.push(students.length
    ? h('ul', { class: 'receipt-list' }, students.map((s) => h('li', {}, [
      h('span', { class: 'receipt-li-name', text: s.name }),
      s.note ? tag(s.note, s.happyDelta < 0 ? 'bad' : 'good') : null,
      h('span', { class: 'receipt-li-v', text: '心情 ' + uiDeltaText(s.happyDelta) + '（当前 ' + s.happiness + '）· 毕业进度 ' + uiDeltaText(s.degreeDelta, '%') }),
    ])))
    : uiNote(UI_RECEIPT.noStudent));

  if ((receipt.papers || []).length) {
    sections.push(h('h3', { class: 'receipt-h', text: '本月论文（' + uiPaperCount(receipt) + ' 篇）' }));
    sections.push(h('ul', { class: 'receipt-list' }, receipt.papers.map((p) => h('li', {}, [
      h('span', { class: 'receipt-li-name', text: uiTierLabel(vm, p.tier) }),
      h('span', { class: 'receipt-li-v', text: p.count + ' 篇 · 约 ' + uiNum1(p.if) + ' IF' }),
    ]))));
  }

  if ((receipt.events || []).length) {
    sections.push(h('h3', { class: 'receipt-h', text: '本月事件（' + receipt.events.length + '）' }));
    sections.push(h('ul', { class: 'receipt-list' }, receipt.events.map((title) => h('li', {}, [h('span', { text: title })]))));
  }

  sections.push(uiNote('账目由 core 在结算时逐项登记：进项=校拨/尾款/额外资助等，出项=工资/维护/耗材/事件开销。'));
  return [uiCard(UI_RECEIPT.detailTitle, uiTimeText(receipt), null, sections, { class: 'card-flush' })];
}

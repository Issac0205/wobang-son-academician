/**
 * views/crew.js —— 课题组：总览 / 学生名册 / 仪器台 / 耗材库
 *
 * 全部数据来自 vm.crew、vm.hud、vm.actions；本文件不含任何游戏数值计算。
 * 分栏（学生/仪器/耗材）由 app.js 的本地 UI 状态决定，切换不写入 state。
 */

import { h, bar, tag, button, uiCard, uiDisclosure, uiSubTabs, uiEmpty, uiKv, uiNote, uiInlineStat, uiInlineBar, uiPaperTiles, uiGoto, uiNum1, uiLevelTone, uiDeltaText } from '../dom.js';
import { renderLabSpace } from './lab.js';
import { UI_SUBTABS, UI_EMPTY, UI_WAGE_TIERS, UI_ACTION_LABELS, UI_GRAB, UI_CONSUMABLE_UNIT, UI_DEFER, UI_PAPER_SHOP, UI_PAPER_TILE, UI_RANK_HINT } from '../copy.js';

/** 名单里标出「等老板拍板的延毕决定」（与弹层同一件事）。 */
const UI_DEFER_TAG = UI_DEFER.pendingTag + '：延毕还是肄业';

/* ── 总览：身份 + 资源 + 论文账目 + 晋升进度（验收「总览面板」） ── */
function uiOverviewCard(vm) {
  const hud = vm.hud;
  const ach = hud.achievements;
  const rank = hud.rank;
  const name = hud.name || hud.playerName || '（还没起名）';
  const son = hud.sonName || '—';
  const identity = h('div', { class: 'identity' }, [
    h('div', { class: 'identity-block' }, [
      h('span', { class: 'identity-k', text: '课题组负责人' }),
      h('strong', { class: 'identity-v', text: name }),
      button('改名', { action: 'rename-open' }, { class: 'btn-ghost btn-xs' }),
    ]),
    h('div', { class: 'identity-block' }, [
      h('span', { class: 'identity-k', text: '儿子' }),
      h('strong', { class: 'identity-v', text: son }),
      h('span', { class: 'identity-hint', text: '对外宣称：都是为了他' }),
    ]),
    h('div', { class: 'identity-block' }, [
      h('span', { class: 'identity-k', text: '当前头衔' }),
      h('strong', { class: 'identity-v', text: rank.title }),
      h('span', { class: 'identity-hint', text: '第 ' + rank.index + ' / ' + rank.max + ' 级' }),
    ]),
  ]);

  const stats = [
    uiKv('当前年月', hud.time.text),
    uiKv('年龄', hud.ageText),
    uiKv('阶段', hud.phase.label),
    uiKv('经费', uiNum1(hud.money) + ' 万', hud.money < 0 ? 'bad' : null),
    uiKv('耗材资金', uiNum1(hud.consumable) + ' 单位', hud.consumable <= 0 ? 'bad' : null),
    uiKv('总影响因子', uiNum1(ach.totalIF)),
    uiKv('诚信', hud.integrity, uiLevelTone(hud.integrity)),
    uiKv('精力', hud.energy + ' / ' + hud.energyMax),
    uiKv('健康', hud.health, uiLevelTone(hud.health)),
    uiKv('推荐票', hud.tickets),
    uiKv('招生名额', hud.slots.text),
    uiKv('在研项目', hud.slots.concurrent.used + ' / ' + hud.slots.concurrent.cap),
  ];

  const promote = rank.next
    ? h('div', { class: 'promote' }, [
      h('div', { class: 'promote-head' }, [
        h('span', { class: 'promote-from', text: rank.title }),
        h('span', { class: 'promote-arrow', text: '→' }),
        h('span', { class: 'promote-to', text: rank.next.title }),
        tag(rank.eligible ? '条件已达成，等结算' : '还差条件', rank.eligible ? 'good' : 'warn'),
      ]),
      bar(rank.progress, 'good', rank.index + ' / ' + rank.max),
      rank.missing.length
        ? h('ul', { class: 'req-list' }, rank.missing.map((m) => h('li', { class: 'req-item' }, [
          h('span', { class: 'req-text', text: m.text }),
          h('span', { class: 'req-have', text: '现有 ' + uiNum1(m.have) }),
        ])))
        : h('p', { class: 'req-ok', text: '硬条件都满足了' + (rank.eligible ? '，下一次月末结算就会递材料。' : '，但手续不全：' + (rank.reason || '等增选窗口')) }),
      // 缺口 2（DEV §7.4 第 1 条）：缺的是一作时把「一作从哪来」说清楚。
      // 判定只看 core 给的 key（q1|q2|top），阈值不在这里算。
      rank.missing.some((m) => m.key === 'q1' || m.key === 'q2' || m.key === 'top')
        ? h('div', { class: 'first-author-hint' }, [
          tag(UI_RANK_HINT.tag, 'warn'),
          h('p', { class: 'first-author-hint-v', text: UI_RANK_HINT.missingFirstAuthor }),
          h('p', { class: 'first-author-hint-routes', text: UI_RANK_HINT.routes }),
        ])
        : null,
      rank.next.index === 8 && rank.reason ? uiNote(rank.reason, 'warn') : null,
    ])
    : h('p', { class: 'req-ok', text: '已经是最高头衔：院士。这一局可以结束了。' });

  return uiCard('总览 · 身份与资源', '一行看清「我是谁、有多少钱、离院士还差什么」', [
    button('玩法', { action: 'help' }, { class: 'btn-ghost btn-xs' }),
  ], [
    identity,
    h('div', { class: 'kv-grid' }, stats),
    h('div', { class: 'paper-row' }, [
      h('span', { class: 'paper-row-k', text: 'SCI 一作分区' }),
      uiPaperTiles(ach.ranks, ach.papersFirst),
    ]),
    h('p', { class: 'paper-row-legend', text: UI_PAPER_TILE.legend }),
    h('div', { class: 'kv-grid kv-grid-2' }, [
      uiKv('毕业硕士', ach.graduated.master + ' 人'),
      uiKv('毕业博士', ach.graduated.phd + ' 人'),
    ]),
    promote,
  ], { class: 'card-overview' });
}

/* ── 学生名册 ── */
function uiWageButtons(vm, s) {
  const tiers = UI_WAGE_TIERS;
  return h('div', { class: 'wage-row' }, [
    h('span', { class: 'wage-k', text: '工资档' }),
  ].concat(tiers.map((t) => button(t.label, { action: 'wage', studentId: s.id, tier: t.id }, {
    class: s.wageTier === t.id ? 'active btn-xs' : 'btn-xs',
    title: s.wageTier === t.id && s.wageCost ? '当前：每月 ' + uiNum1(s.wageCost) + ' 万' : '',
  }))).concat([
    h('span', { class: 'wage-cost', text: '当前每月 ' + uiNum1(s.wageCost) + ' 万' }),
  ]));
}

/**
 * 某个学生「结题产出的、他是一作」的论文台帐（含已被抢的记录）。
 * 论文台帐由 core 在结题时写进 project.paperTiers，并通过 vm.projects.*[].papers 原样透传。
 */
function uiStudentPapers(vm, studentId) {
  const all = [].concat((vm.projects && vm.projects.list) || [], (vm.projects && vm.projects.archive) || []);
  const order = (vm.consts && vm.consts.papers && vm.consts.papers.order) || [];
  const out = [];
  for (const p of all) {
    const list = Array.isArray(p.papers) ? p.papers : [];
    for (const paper of list) {
      if (!paper || typeof paper !== 'object' || paper.firstAuthorId !== studentId) continue;
      out.push({ paper, projectName: p.name });
    }
  }
  const rank = (tier) => {
    const i = order.indexOf(tier);
    return i < 0 ? order.length : i;
  };
  return out.sort((x, y) => rank(x.paper.tier) - rank(y.paper.tier));
}

/**
 * 「可抢的一作」区块（t8 finding ①②③）：
 *   · 只在「结题产出的、该生为一作、尚未被抢」的论文上渲染按钮（payload 带 paperId + tier）；
 *   · 点击先展开确认条（档位 / 本篇 IF / 诚信 / 该生幸福度 / 心结），确认后才真的抢；
 *   · 本月已经抢过一篇时，按钮置灰并说明（每生每月最多一次）。
 */
function uiGrabBlock(vm, s, ctx) {
  const papers = (vm.consts && vm.consts.papers) || null;
  const rows = uiStudentPapers(vm, s.id);
  const lockedThisMonth = Boolean(s.grabbedPaperThisMonth);
  const pending = ctx && ctx.grabConfirm ? ctx.grabConfirm : null;
  const body = rows.length ? rows.map(({ paper, projectName }) => {
    const label = (papers && papers.labels && papers.labels[paper.tier]) || paper.tier;
    const common = [
      tag(label, paper.grabbed ? 'bad' : 'info'),
      h('span', { class: 'grab-project', text: projectName }),
      h('span', { class: 'grab-if', text: 'IF ' + uiNum1(paper.if) }),
    ];
    if (paper.grabbed) {
      return h('div', { class: 'grab-row is-done' }, common.concat([
        h('span', { class: 'muted', text: UI_GRAB.grabbedAt.replace('{month}', String((paper.grabbedMonthIndex || 0) + 1)) }),
      ]));
    }
    if (!pending || pending.paperId !== paper.paperId) {
      return h('div', { class: 'grab-row', dataset: { role: 'grab-row', paperId: paper.paperId } }, common.concat([
        button(UI_GRAB.button, { action: 'grab-first', studentId: s.id, paperId: paper.paperId, tier: paper.tier },
          { class: 'btn-xs btn-danger-ghost', disabled: lockedThisMonth, title: lockedThisMonth ? UI_GRAB.grabbedThisMonth : UI_GRAB.sectionHint }),
      ]));
    }
    return h('div', { class: 'grab-row is-confirm', dataset: { role: 'grab-confirm', paperId: paper.paperId } }, [
      h('strong', { class: 'grab-confirm-title', text: UI_GRAB.confirmTitle }),
      h('div', { class: 'kv-grid kv-grid-5' }, [
        uiKv(UI_GRAB.gainTier, label),
        uiKv(UI_GRAB.gainIf, uiDeltaText(paper.if)),
        uiKv(UI_GRAB.loseIntegrity, papers ? uiDeltaText(papers.grabIntegrity) : '—'),
        uiKv(UI_GRAB.loseHappy, papers ? uiDeltaText(papers.grabHappy) : '—'),
        uiKv(UI_GRAB.grudge, papers ? (papers.grabGrudgeMonths + ' ' + UI_GRAB.monthsUnit) : '—'),
      ]),
      h('div', { class: 'grab-buttons' }, [
        button(UI_GRAB.confirm, { action: 'grab-confirm' }, { kind: 'danger', class: 'btn-xs' }),
        button(UI_GRAB.cancel, { action: 'grab-cancel' }, { class: 'btn-ghost btn-xs' }),
      ]),
    ]);
  }) : [uiNote(UI_GRAB.noPaper)];
  return h('div', { class: 'grab-block', dataset: { role: 'grab-block', id: s.id } }, [
    h('div', { class: 'grab-head' }, [
      h('span', { class: 'grab-title', text: UI_GRAB.section }),
      h('span', { class: 'muted', text: UI_GRAB.sectionHint }),
      lockedThisMonth ? tag(UI_GRAB.grabbedThisMonth, 'warn') : null,
    ]),
  ].concat(body));
}

function uiStudentCard(vm, s, ctx) {
  const active = s.statusLabel === '在读' || s.statusLabel === '延毕中';
  const years = typeof s.monthsInLabText === 'string' ? s.monthsInLabText : null;
  const inLab = typeof s.monthsInLab === 'number' ? (years ? '在读 ' + years + '（' + s.monthsInLab + ' 个月）' : '在读 ' + s.monthsInLab + ' 个月') : null;
  const rows = [
    uiKv('在读年份', inLab || '—'),
    uiKv('年限还剩', s.monthsLeftText),
    uiKv('工资档位', s.wageLabel + (s.wageCost ? '（' + uiNum1(s.wageCost) + ' 万/月）' : '')),
    uiKv('负责项目', s.projects.length + ' 个'),
  ];
  return h('div', { class: 'student tone-' + s.happinessTone, dataset: { role: 'student', id: s.id } }, [
    h('div', { class: 'student-head' }, [
      h('strong', { class: 'student-name', text: s.name }),
      tag(s.degreeLabel, 'info'),
      tag(s.sourceLabel, 'mute'),
      tag(s.statusLabel, s.statusLabel === '在读' ? 'good' : (s.statusLabel === '延毕中' ? 'warn' : 'mute')),
      s.grudge ? tag('心结中', 'bad') : null,
      s.deferMonths > 0 ? tag('延毕 ' + s.deferMonths + ' 年', 'bad') : null,
    ]),
    uiDisclosure('student-' + s.id, '能力、工资与论文 · 展开管理', [
    h('div', { class: 'student-bars' }, [
      h('div', { class: 'student-bar' }, [h('span', { class: 'student-bar-k', text: '幸福度 ' + s.happiness }), uiInlineBar(s.happiness, s.happinessTone === 'good' ? 'good' : (s.happinessTone === 'bad' ? 'bad' : 'warn'))]),
      h('div', { class: 'student-bar' }, [h('span', { class: 'student-bar-k', text: '毕业进度 ' + s.degreeProgress + '%' }), uiInlineBar(s.degreeProgress, 'info')]),
      h('div', { class: 'student-bar' }, [h('span', { class: 'student-bar-k', text: '科研能力 ' + s.abilityPct + '%' }), uiInlineBar(s.abilityPct, 'mute')]),
    ]),
    // 2 列：在读年份那一行的值比较长（在读 1 年（12 个月）· 年限还剩 33 个月），3 列会挤到换行
    h('div', { class: 'kv-grid kv-grid-2' }, rows),
    h('div', { class: 'student-projects' }, s.projects.length
      ? s.projects.map((p) => h('span', { class: 'proj-chip' }, [h('span', { text: p.name }), h('span', { class: 'proj-chip-v', text: p.progressPct + '%' })]))
      : [h('span', { class: 'muted', text: '没有负责的项目（闲置会掉心情）' })]),
    active
      ? h('div', { class: 'student-actions' }, [
        uiWageButtons(vm, s),
        s.monthsLeft <= 0 ? tag(UI_DEFER_TAG, 'warn') : null,
        s.monthsLeftText && s.degreeProgress < 100 ? uiGoto('快延毕了？去抢救', 'actions', { title: '毕业进度靠「' + UI_ACTION_LABELS.talk + '」和「开组会」推' }) : null,
        s.deferMonths > 0 ? button('延毕规则', { action: 'help' }, { class: 'btn-ghost btn-xs', title: '延毕要你签字：到期后弹层里二选一' }) : null,
      ])
      : null,
    active ? uiGrabBlock(vm, s, ctx) : null,
    ]),
  ]);
}

function uiStudentsCard(vm, ctx) {
  const crew = vm.crew;
  const active = crew.active;
  const others = crew.students.filter((s) => !active.some((a) => a.id === s.id));
  const slotRow = h('div', { class: 'slot-row' }, [
    uiInlineStat('硕士名额', crew.slots.master.used + ' / ' + crew.slots.master.cap),
    uiInlineStat('博士名额', crew.slots.phd.used + ' / ' + crew.slots.phd.cap),
    uiInlineStat('在研项目', crew.slots.concurrent.used + ' / ' + crew.slots.concurrent.cap),
    uiInlineStat('在读学生', active.length + ' 人'),
  ]);
  const body = [slotRow];
  body.push(active.length
    ? h('div', { class: 'student-list' }, active.map((s) => uiStudentCard(vm, s, ctx)))
    : uiEmpty(UI_EMPTY.students));
  if (others.length) {
    body.push(h('div', { class: 'alumni' }, [
      h('h3', { class: 'alumni-title', text: '已毕业 / 已离组（' + others.length + '）' }),
      h('ul', { class: 'alumni-list' }, others.map((s) => h('li', { text: s.name + ' · ' + s.degreeLabel + ' · ' + s.statusLabel }))),
    ]));
  }
  return uiCard('学生名册', '工资、延毕、一作都在这张表上；招人请去「市场」', null, body);
}

/** 分区计数求和（展示用）。 */
function uiPaperTotal(counts) {
  if (!counts) return 0;
  return Object.keys(counts).reduce((sum, tier) => sum + (Number(counts[tier]) || 0), 0);
}

/* ── 一作交易台 ── */
function uiPaperShopCard(vm) {
  const ach = vm.hud.achievements;
  const consts = vm.consts || {};
  const papers = consts.papers || null;
  // 每个档位都必须带上 tier（t10：引擎删掉了「缺档位默认为二区」的静默默认），
  // 所以这里没有「不带档位」的按钮；价格表缺失时只给一个禁用入口 + 说明。
  const shop = papers && papers.price
    ? h('div', { class: 'shop-row' }, papers.order.map((tier) => {
      const label = (papers.labels && papers.labels[tier]) || tier;
      const price = papers.price[tier];
      const affordable = vm.hud.money >= price;
      return button(label + ' ' + uiNum1(price) + ' 万', { action: 'buy-first', tier }, { class: 'btn-xs', disabled: !affordable, title: affordable ? '' : '经费不足' });
    }))
    : h('div', { class: 'shop-row' }, [
      button(UI_PAPER_SHOP.fallbackButton, { action: 'buy-first' }, { class: 'btn-xs', disabled: true, title: UI_PAPER_SHOP.fallbackNote }),
      h('span', { class: 'muted', text: UI_PAPER_SHOP.fallbackNote }),
    ]);
  const integrityHint = papers && papers.buyIntegrity
    ? '购买一作诚信 ' + papers.buyIntegrity + '；抢一作诚信 ' + papers.grabIntegrity + '。'
    : UI_PAPER_SHOP.integrityHint;
  return uiCard(UI_PAPER_SHOP.title, UI_PAPER_SHOP.subtitle, null, [
    h('p', { class: 'shop-note', text: UI_PAPER_SHOP.honest }),
    h('p', { class: 'shop-note', text: integrityHint }),
    shop,
    h('div', { class: 'kv-grid kv-grid-2' }, [
      uiKv(UI_PAPER_SHOP.kvGrabbed, uiPaperTotal(ach.papersFirst) + ' 篇'),
      uiKv(UI_PAPER_SHOP.kvTotal, uiPaperTotal(ach.papers) + ' 篇'),
    ]),
  ]);
}

/* ── 耗材库 ── */
function uiConsumablesCard(vm) {
  const a = vm.actions;
  const modes = a.consumeModes;
  const head = h('div', { class: 'slot-row' }, [
    uiInlineStat('耗材资金', uiNum1(a.consumable) + ' 单位', a.consumableLow ? 'bad' : null),
    uiInlineStat('当前模式', (modes.filter((m) => m.active)[0] || {}).label || '—'),
    uiInlineStat('经费', uiNum1(a.money) + ' 万'),
  ]);
  const buy = h('div', { class: 'buy-row' }, [
    button('采购一批（' + a.buyPack + ' 单位 / ' + uiNum1(a.buyPackCost) + ' 万）', { action: 'buy-consumable', amount: String(a.buyPack) }, { kind: 'primary', disabled: !a.canBuyConsumable, title: a.canBuyConsumable ? '' : '经费不够，先接个横向' }),
    a.consumableLow ? tag('耗材偏低', 'warn') : null,
  ]);
  const cards = h('div', { class: 'mode-grid' }, modes.map((m) => h('div', { class: 'mode' + (m.active ? ' active' : '') }, [
    h('div', { class: 'mode-head' }, [
      h('strong', { text: m.label }),
      m.active ? tag('当前', 'good') : null,
    ]),
    h('p', { class: 'mode-hint', text: m.hint }),
    m.active ? null : button('切到这个模式', { action: 'consume-mode', mode: m.id }, { class: 'btn-xs' }),
    m.consumeMul !== undefined ? h('div', { class: 'mode-nums' }, [
      uiInlineStat('耗材倍率', uiNum1(m.consumeMul) + '×'),
      uiInlineStat('效率倍率', uiNum1(m.progressMul) + '×'),
      uiInlineStat('心情/月', uiDeltaText(m.happyDelta)),
    ]) : null,
  ])));
  // t8 finding：耗材资金的「单位」与「万元」必须说清楚——这里常驻标注换算关系。
  const unit = (vm.consts && vm.consts.consumable) || null;
  const unitNotes = unit ? [
    uiNote(UI_CONSUMABLE_UNIT.note
      .replace('{unit}', uiNum1(unit.pricePerUnit))
      .replace('{yuan}', uiNum1(unit.pricePerUnit))),
    uiNote(UI_CONSUMABLE_UNIT.packNote
      .replace('{pack}', a.buyPack)
      .replace('{cost}', uiNum1(a.buyPackCost))),
  ] : [];
  return uiCard('耗材库', '三种消耗模式：换效率、换心情、换钱（按万元记账）', null, [
    head,
    buy,
    h('div', { class: 'unit-notes' }, unitNotes),
    cards,
    uiNote('耗材资金见底时，在研项目的进度会停摆；模式切换下个月生效。'),
  ]);
}

/**
 * 课题组页：分栏 = 总览 / 学生名册 / 实验室（空间 + 仪器台）/ 耗材库。
 * 分栏切换只改 app.js 的本地 UI 状态；总览是默认落点，也是「我现在该做什么」的答案页。
 */
export function renderCrew(vm, ctx) {
  const section = (ctx && ctx.labSection) || 'overview';
  const body = [uiSubTabs(UI_SUBTABS, section, 'lab-section')];
  if (section === 'instruments') body.push(renderLabSpace(vm, ctx));
  else if (section === 'consumables') body.push(uiConsumablesCard(vm));
  else if (section === 'students') {
    body.push(uiStudentsCard(vm, ctx));
    body.push(uiPaperShopCard(vm));
  } else {
    body.push(uiOverviewCard(vm));
  }
  return body;
}
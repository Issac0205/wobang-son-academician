/**
 * views/projects.js —— 项目页：在研项目（进度/难点/人员）+ 项目市场（承接）+ 结题档案
 *
 * 数据全部来自 vm.projects 与 vm.market.projects；难点三种处理方式只负责发 action。
 */

import { h, bar, tag, button, uiCard, uiDisclosure, uiEmpty, uiNote, uiInlineStat, uiGoto, uiNum1, uiDeltaText } from '../dom.js';
import { UI_METHOD_LABELS, UI_METHOD_FILE, UI_METHOD_TONE, UI_EMPTY, UI_ATTEMPT, UI_PROJECT_MARKET, UI_AUTO_ASSIGN, UI_LEAD } from '../copy.js';

/** 三种处理方式 → data-action（写成查表，避免字符串拼接被静态检查误判）。 */
const UI_METHOD_ACTION = { team: 'hardpoint-team', fake: 'hardpoint-fake', solo: 'hardpoint-solo' };

function uiHardpointRow(vm, p, hp) {
  const consts = (vm.consts && vm.consts.hardpoints) || null;
  const methods = (consts && consts.methods) || null;
  const order = (consts && consts.order) || ['team', 'fake', 'solo'];
  const isOpen = hp.status === 'open';
  // t8 finding：成功率与「会被抽调的人」都由 core 算好（vm.projects.*[].hardpoints[].attempts），
  // UI 只负责显示；点击时把 core 给的同一批 studentIds 原样传回引擎，做到所见即所得。
  const attempts = (isOpen && hp.attempts) || null;
  const cost = (id) => {
    if (!methods || !methods[id]) return '';
    const penalty = methods[id].penalty || {};
    const bits = [];
    if (penalty.money) bits.push(uiNum1(penalty.money) + ' 万');
    if (penalty.integrity) bits.push('诚信 ' + uiDeltaText(penalty.integrity));
    if (penalty.teamOtherProjectMul) bits.push('其他项目 ' + uiNum1(penalty.teamOtherProjectMul * 100) + '%');
    if (penalty.studentHappyPerPerson) bits.push(UI_ATTEMPT.perPerson.replace('{happy}', uiDeltaText(penalty.studentHappyPerPerson)));
    else if (penalty.studentHappy) bits.push('幸福 ' + uiDeltaText(penalty.studentHappy));
    return bits.join(' · ');
  };
  const detail = (id) => {
    if (!attempts) return '';
    if (id === 'team') {
      const a = attempts.team;
      const names = a.names.length ? a.names.join('、') : UI_ATTEMPT.pulledNone;
      return UI_ATTEMPT.chance + ' ' + a.pct + '% · ' + UI_ATTEMPT.pulled + names;
    }
    if (id === 'solo') {
      const a = attempts.solo;
      return UI_ATTEMPT.chance + ' ' + a.pct + '% · ' + UI_ATTEMPT.pulled + (a.names[0] || UI_ATTEMPT.pulledNone);
    }
    return UI_ATTEMPT.catch + ' ' + attempts.fake.pct + '%';
  };
  const datasetFor = (id) => {
    const ds = { action: UI_METHOD_ACTION[id], projectId: p.instanceId, hardpointId: hp.id };
    if (attempts && id === 'team' && attempts.team.studentIds.length) ds.studentIds = attempts.team.studentIds.join(',');
    if (attempts && id === 'solo' && attempts.solo.studentIds.length) ds.studentIds = attempts.solo.studentIds.join(',');
    return ds;
  };
  const disabledFor = (id) => {
    if (!attempts) return false;
    if (id === 'team') return !attempts.team.enough;
    if (id === 'solo') return attempts.solo.studentIds.length === 0;
    return false;
  };
  return h('div', { class: 'hardpoint tone-' + (isOpen ? 'warn' : 'mute'), dataset: { role: 'hardpoint', id: hp.id } }, [
    h('div', { class: 'hardpoint-head' }, [
      h('strong', { text: '难点 ' + hp.id }),
      tag('难度 ' + hp.hd, hp.hd >= 3 ? 'bad' : 'warn'),
      tag(hp.statusLabel, hp.status === 'solved' ? 'good' : (hp.status === 'faked' ? 'bad' : 'warn')),
      !isOpen && hp.appearText ? h('span', { class: 'muted', text: hp.appearText }) : null,
    ]),
    isOpen
      ? h('div', { class: 'hardpoint-actions' }, order.map((id) => button(
        ((methods && methods[id] && methods[id].label) || UI_METHOD_LABELS[id] || id) + (detail(id) ? ' · ' + detail(id) : ''),
        datasetFor(id),
        {
          class: 'btn-xs' + (id === 'fake' ? ' btn-danger-ghost' : ''),
          disabled: disabledFor(id),
          title: [
            (methods && methods[id] && methods[id].hint) || UI_METHOD_FILE[id] || '',
            detail(id),
            cost(id),
          ].filter(Boolean).join(' · '),
        },
      )).concat([
        h('span', { class: 'hardpoint-cost', text: order.map((id) => cost(id)).filter(Boolean).join(' / ') }),
        attempts ? h('span', { class: 'hardpoint-cost muted', text: UI_ATTEMPT.retry.replace('{pct}', String(Math.round((attempts.retryBonus || 0) * 100))) }) : null,
      ]))
      : h('p', { class: 'hardpoint-done', text: hp.status === 'faked' ? '蒙混过去了，账先记着。' : '这个难点已经处理完，不再拖进度。' }),
  ]);
}

function uiProjectCard(vm, p) {
  const students = vm.crew.active;
  const openHp = p.hardpoints.filter((hp) => hp.status === 'open' || hp.status === 'hidden');
  const shownHp = p.hardpoints.filter((hp) => hp.status !== 'hidden');
  const countdown = typeof p.deadlineInMonths === 'number' ? ('还剩 ' + p.deadlineInMonths + ' 个月') : null;
  return h('div', { class: 'project tone-' + (p.overdue ? 'bad' : 'good'), dataset: { role: 'project', id: p.instanceId } }, [
    h('div', { class: 'project-head' }, [
      h('strong', { class: 'project-name', text: p.name }),
      tag(p.categoryLabel, p.category === 'enterprise' ? 'mute' : 'info'),
      tag(p.tierLabel, 'mute'),
      p.playerLeading ? tag('亲带中', 'good') : null,
      p.overdue ? tag('逾期 ' + p.overdueMonths + ' 个月', 'bad') : null,
    ]),
    bar(p.progressPct, p.overdue ? 'bad' : 'good', p.progressPct + '%'),
    uiDisclosure('project-' + p.instanceId, '管理项目 · 分配学生 / 处理难点（' + p.openHardpoints + '）', [
    h('div', { class: 'project-meta' }, [
      uiInlineStat('工作量', uiNum1(p.progress) + ' / ' + uiNum1(p.workload)),
      uiInlineStat('期限', p.deadlineText + (countdown ? '（' + countdown + '）' : '')),
      uiInlineStat('经费', uiNum1(p.money) + ' 万'),
      uiInlineStat('尾款', p.tailText),
      uiInlineStat('未解决难点', p.openHardpoints),
    ]),
    h('div', { class: 'project-papers' }, [
      h('span', { class: 'muted', text: '结题论文档位：' }),
      (p.papers && p.papers.length)
        ? p.papers.map((x) => tag(typeof x === 'string' ? x : ((x && x.tier) || '—'), 'mute'))
        : [h('span', { class: 'muted', text: '—' })],
    ]),
    h('div', { class: 'hardpoints' }, shownHp.length
      ? shownHp.map((hp) => uiHardpointRow(vm, p, hp))
      : [h('p', { class: 'muted', text: '目前没有暴露出来的难点（难度高的项目会陆续冒出来）。' })]),
    h('div', { class: 'assign-row' }, [
      h('span', { class: 'assign-k', text: '参与学生' }),
      students.length
        ? students.map((s) => {
          const assigned = p.students.some((x) => x.id === s.id);
          return button(s.name, { action: assigned ? 'unassign-student' : 'assign-student', projectId: p.instanceId, studentId: s.id }, { class: 'btn-xs' + (assigned ? ' active' : '') });
        })
        : h('span', { class: 'muted', text: '没有在读学生，去「市场」招人' }),
      button(p.playerLeading ? UI_LEAD.on : UI_LEAD.off, { action: 'toggle-lead', projectId: p.instanceId },
        { class: 'btn-xs', title: p.playerLeading ? UI_LEAD.titleOn : UI_LEAD.titleOff }),
      p.playerLeading ? tag('一作归你', 'good') : null,
    ]),
    uiNote('进度满工作量时自动结题：尾款到账、论文见刊；有未解决难点会按难点数量降档。'),
    h('p', { class: 'lead-note', text: UI_LEAD.note }),
    ]),
  ]);
}

/**
 * 一键分配工作（t25/t26）：按钮 + core 算好的预览 + 上次结果回显 + 边界说明。
 * 只读 vm.autoAssign（canAssign/planCount/plan/feedback/studentsFull/projectsShort/last），
 * 自己不推导任何分配规则，也不给 state 赋值——点一下只发 data-action="auto-assign"。
 */
/**
 * 可接 offer 数（T21-F2 口径）：只有 canAccept 为真的本子才算「你能接的」。
 * 池子里可能有 locked / 够不着的本子，所以列表长度 0 与可接数 0 不是一回事。
 */
function uiAcceptableOffers(vm) {
  const offers = (vm.market && vm.market.projects) || [];
  return offers.filter((o) => o.canAccept === true).length;
}

function uiAutoAssignBlock(vm, acceptable) {
  const aa = vm.autoAssign || null;
  if (!aa) return null;
  const can = Boolean(aa.canAssign);
  const preview = can
    ? UI_AUTO_ASSIGN.previewOn
      .replace('{n}', String(aa.planCount))
      .replace('{s}', String(new Set((aa.plan || []).map((m) => m.studentId)).size))
      .replace('{studentCap}', String(aa.studentCap))
      .replace('{projectCap}', String(aa.projectCap))
    : UI_AUTO_ASSIGN.previewOff.replace('{feedback}', aa.feedback || '');
  const plan = (aa.plan || []).slice(0, 6);
  const last = aa.last || null;
  const chips = (label, items, empty) => h('div', { class: 'auto-assign-chips-row' }, [
    h('span', { class: 'auto-assign-chips-k', text: label }),
    items.length
      ? h('span', { class: 'auto-assign-chips-v' }, items.map((t) => tag(t, 'mute')))
      : h('span', { class: 'muted', text: empty }),
  ]);
  return h('div', { class: 'auto-assign-block' }, [
    h('div', { class: 'auto-assign-row' }, [
      button(UI_AUTO_ASSIGN.button, { action: 'auto-assign' },
        { kind: can ? 'primary' : 'ghost', class: 'btn-sm', disabled: !can, title: preview }),
      h('span', { class: 'auto-assign-preview' + (can ? '' : ' muted'), text: preview }),
    ]),
    plan.length
      ? h('div', { class: 'auto-assign-plan' }, [
        h('span', { class: 'auto-assign-plan-k', text: UI_AUTO_ASSIGN.previewListTitle.replace('{n}', String(plan.length)) }),
        h('span', { class: 'auto-assign-plan-v' }, plan.map((m) => h('span', { class: 'auto-assign-plan-item', text: UI_AUTO_ASSIGN.previewItem.replace('{studentName}', m.studentName).replace('{projectName}', m.projectName) }))),
      ])
      : null,
    last
      ? h('div', { class: 'auto-assign-last' }, [
        h('span', { class: 'auto-assign-last-k', text: UI_AUTO_ASSIGN.lastTitle.replace('{month}', String((last.monthIndex || 0) + 1)) }),
        h('span', { class: 'auto-assign-last-v', text: last.moveCount
          ? UI_AUTO_ASSIGN.lastMoved.replace('{n}', String(last.moveCount)).replace('{s}', String(last.studentsTouched))
          : UI_AUTO_ASSIGN.lastNone }),
        last.moveCount ? null : h('span', { class: 'auto-assign-last-hint', text: UI_AUTO_ASSIGN.lastNoneHint }),
      ])
      : null,
    chips(UI_AUTO_ASSIGN.studentsFullLabel, (aa.studentsFull || []).map((n) => n + ' ' + aa.studentCap + '／' + aa.studentCap), UI_AUTO_ASSIGN.noneLabel),
    chips(UI_AUTO_ASSIGN.projectsShortLabel, (aa.projectsShort || []).map((p) => UI_AUTO_ASSIGN.projectShortItem.replace('{name}', p.name).replace('{members}', String(p.members)).replace('{cap}', String(p.cap))), UI_AUTO_ASSIGN.noneLabel),
    // T21-F2：没有可接本子时，绝不把玩家指向一个接不到东西的市场
    (acceptable === 0 && (vm.projects.list || []).length === 0)
      ? h('p', { class: 'auto-assign-nomarket', text: UI_AUTO_ASSIGN.noMarketNote })
      : null,
    h('p', { class: 'auto-assign-boundary', text: UI_AUTO_ASSIGN.boundary.replace('{studentCap}', String(aa.studentCap)).replace('{projectCap}', String(aa.projectCap)) }),
  ]);
}

function uiProjectsCard(vm) {
  const list = vm.projects.list;
  const acceptable = uiAcceptableOffers(vm);
  return uiCard('在研项目（' + list.length + '）', '进度、期限、难点、人员都在这一张卡上', [
    uiGoto('去项目市场接本子', 'market', { title: '市场页有本月的新本子' }),
  ], [uiAutoAssignBlock(vm, acceptable)].concat(list.length
    ? list.map((p) => uiProjectCard(vm, p))
    : [uiEmpty(acceptable > 0 ? UI_EMPTY.projectsToMarket : UI_EMPTY.projectsNoMarket)]));
}

function uiOfferCard(vm, o) {
  return h('div', { class: 'offer tone-' + (o.canAccept ? 'good' : 'mute'), dataset: { role: 'offer', id: o.offerId } }, [
    h('div', { class: 'offer-head' }, [
      h('strong', { class: 'offer-name', text: o.name }),
      tag(o.categoryLabel, o.category === 'nation' ? 'info' : 'mute'),
      tag(o.tierLabel, 'mute'),
      o.locked ? tag('已锁定', 'good') : null,
      o.expiresText ? tag(o.expiresText, 'warn') : null,
    ]),
    h('div', { class: 'offer-meta' }, [
      uiInlineStat('总经费', uiNum1(o.money) + ' 万'),
      uiInlineStat('定金', uiNum1(o.deposit) + ' 万'),
      uiInlineStat('工期', o.limitMonths + ' 个月'),
      uiInlineStat('工作量', uiNum1(o.workload)),
      uiInlineStat('仪器要求', o.requireText),
    ]),
    h('div', { class: 'offer-actions' }, [
      button('承接这个项目', { action: 'accept-project', offerId: o.offerId }, { kind: 'primary', class: 'btn-xs', disabled: !o.canAccept }),
      button(o.locked ? '解锁' : '锁定观察', { action: 'lock-offer', offerId: o.offerId }, { class: 'btn-ghost btn-xs' }),
      o.reason ? h('span', { class: 'muted', text: o.reason }) : null,
    ]),
  ]);
}

/** 一个已结题项目的论文台帐：档位 / 本篇 IF / 一作是谁 / 是否已被抢走。 */
function uiPaperLedger(vm, p) {
  const papers = (vm.consts && vm.consts.papers) || null;
  const list = (p.papers || []).filter((x) => x && typeof x === 'object');
  if (!list.length) return null;
  return h('ul', { class: 'paper-ledger' }, list.map((paper) => h('li', { class: 'paper-ledger-row', dataset: { role: 'ledger-paper', paperId: paper.paperId } }, [
    tag((papers && papers.labels && papers.labels[paper.tier]) || paper.tier, 'mute'),
    h('span', { class: 'paper-ledger-if', text: 'IF ' + uiNum1(paper.if) }),
    h('span', { class: 'paper-ledger-author', text: '一作 ' + (paper.firstAuthorName || '—') }),
    paper.grabbed
      ? tag('已被抢', 'bad')
      : (paper.byPlayer ? tag('一作在你名下', 'good') : tag('一作还在学生名下 · 可抢', 'info')),
  ])));
}

function uiArchiveCard(vm) {
  const archive = vm.projects.archive;
  if (!archive.length) return null;
  return uiCard('结题档案（' + archive.length + '）', '已经交出去的本子，账都在这儿', null, [
    h('ul', { class: 'archive-list' }, archive.map((p) => h('li', { class: 'archive-item tone-' + (p.status === 'failed' ? 'bad' : 'good') }, [
      h('span', { class: 'archive-name', text: p.name }),
      tag(p.tierLabel, 'mute'),
      tag(p.status === 'failed' ? '失败' : '已结题', p.status === 'failed' ? 'bad' : 'good'),
      h('span', { class: 'archive-meta', text: '经费 ' + uiNum1(p.money) + ' 万 · 尾款 ' + p.tailText }),
      uiPaperLedger(vm, p),
    ]))),
  ]);
}

/**
 * 项目市场卡片（T11-F1 ①②）。
 * 不再引用 vm.market.open / vm.market.openText（人才市场按 MARKET_OPEN_MONTHS 算出的口径），
 * 项目市场按「全年可接 · 每月结算后补充」独立写文案；
 * 列表为空时不给「本月可接的本子」这种承诺式副标题，改成「这个月还没发标」。
 */
function uiProjectMarketCard(vm) {
  const offers = vm.market.projects;
  const acceptable = uiAcceptableOffers(vm);
  // T21-F2：三种状态分开说，且判定看「可接数」而不是列表长度
  const subtitle = acceptable > 0
    ? UI_PROJECT_MARKET.subtitle
    : (offers.length > 0 ? UI_PROJECT_MARKET.lockedOnlySubtitle : UI_PROJECT_MARKET.emptySubtitle);
  return uiCard(
    '项目市场（' + acceptable + ' 可接 / 共 ' + offers.length + '）',
    subtitle,
    [uiGoto('看招募', 'market', { title: UI_PROJECT_MARKET.recruitHint })],
    offers.length
      ? offers.map((o) => uiOfferCard(vm, o)).concat(acceptable === 0 ? [uiNote(UI_PROJECT_MARKET.lockedOnlyNote, 'warn')] : [])
      : [uiEmpty(UI_EMPTY.offers)],
  );
}

export function renderProjects(vm) {
  return [uiProjectsCard(vm), uiProjectMarketCard(vm), uiArchiveCard(vm)];
}
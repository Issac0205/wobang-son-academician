/**
 * rules.js —— 纯判定函数（条件 DSL、承接门槛、市场开放、事件可选性、结局判定）
 *
 * 条件 DSL（docs/CONTRACT.md §4）必须可序列化，因此全部用对象描述，不含函数：
 *   true                                  —— 恒真
 *   { stat:'totalIF', op:'>=', value:300 } —— 玩家数值比较（op: > >= < <= == !=）
 *   { flag:'metThisMonth' }                —— state.flags / state.month.flags 为真
 *   { hasInstrument:'hplc', min:1 }        —— 持有仪器数量
 *   { anyProject:{ active:true, category:'enterprise', tierAtLeast:3 } }
 *   { anyStudent:{ happinessBelow:40, happinessAtLeast:50, abilityAtLeast:0.85, source:'exam' } }
 *   { all:[...] } / { any:[...] } / { not:{...} }
 *   { ctxStudent:{ happinessBelow:30 } }   —— 事件效果里的 if 用：本次事件选中的学生
 */

import { EVENTS, EVENT_COOLDOWN_MONTHS } from '../data/events.js';
import { ENDINGS } from '../data/endings.js';
import { rankOf, MIN_ACADEMICIAN_AGE, ELECTION_WINDOW_INTERVAL } from '../data/ranks.js';
import { MARKET_OPEN_MONTHS, RECRUIT_PER_MONTH, POOL_CAP } from '../data/market.js';
import { BANKRUPT_NEGATIVE_MONTHS, LAB_EMPTY_THRESHOLD } from '../data/tuning.js';
import { missingInstruments, rankStatus, totalStudentsGraduated, activeStudents, activeProjects, ticketRequirement } from './formulas.js';

/* ══ 条件 DSL ══ */
const STAT_GETTERS = {
  totalIF: (s) => s.player.totalIF,
  integrity: (s) => s.player.integrity,
  health: (s) => s.player.health,
  money: (s) => s.player.money,
  consumable: (s) => s.player.consumable,
  energy: (s) => s.player.energy,
  rankIndex: (s) => s.player.rankIndex,
  ageYears: (s) => s.player.age,
  tickets: (s) => s.player.tickets,
  studentsGraduated: (s) => totalStudentsGraduated(s),
  studentCount: (s) => activeStudents(s).length,
  projectCount: (s) => activeProjects(s).length,
  fakesTotal: (s) => s.counters.fakesTotal,
  grabbedPapers: (s) => s.counters.grabbedPapers,
  boughtPapers: (s) => s.counters.boughtPapers,
  recentQ4Papers: (s) => s.player.papers.q4,
  monthIndex: (s) => s.calendar.monthIndex,
  year: (s) => s.calendar.year,
  month: (s) => s.calendar.month,
};

function compare(a, op, b) {
  switch (op) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '==': return a === b;
    case '!=': return a !== b;
    default: return false;
  }
}

function matchProject(p, spec) {
  if (!spec) return true;
  if (spec.active !== undefined && (p.status === 'active') !== spec.active) return false;
  if (spec.category && p.category !== spec.category) return false;
  if (spec.tierAtLeast !== undefined && p.tier < spec.tierAtLeast) return false;
  if (spec.openHardpoint !== undefined && (p.hardpoints || []).some((h) => h.status === 'open') !== spec.openHardpoint) return false;
  return true;
}

function matchStudent(st, spec) {
  if (!spec) return true;
  const active = !st.left && !st.graduated;
  if (spec.active !== undefined && active !== spec.active) return false;
  if (spec.source && st.source !== spec.source) return false;
  if (spec.degree && st.degree !== spec.degree) return false;
  if (spec.happinessBelow !== undefined && !(st.happiness < spec.happinessBelow)) return false;
  if (spec.happinessAtLeast !== undefined && !(st.happiness >= spec.happinessAtLeast)) return false;
  if (spec.abilityAtLeast !== undefined && !(st.ability >= spec.abilityAtLeast)) return false;
  if (spec.grudge !== undefined && (st.grudgeMonths > 0) !== spec.grudge) return false;
  return true;
}

/**
 * 求值条件。
 * @param {any} cond
 * @param {{state:any, student?:any, project?:any}} ctx
 */
export function evaluateCondition(cond, ctx) {
  if (cond === undefined || cond === null || cond === true) return true;
  if (cond === false) return false;
  const state = ctx.state;

  if (Array.isArray(cond)) return cond.every((c) => evaluateCondition(c, ctx));
  if (cond.all) return cond.all.every((c) => evaluateCondition(c, ctx));
  if (cond.any) return cond.any.some((c) => evaluateCondition(c, ctx));
  if (cond.not) return !evaluateCondition(cond.not, ctx);

  if (cond.stat) {
    const getter = STAT_GETTERS[cond.stat];
    if (!getter) return false;
    return compare(getter(state), cond.op || '>=', cond.value);
  }
  if (cond.flag) {
    return Boolean(state.flags[cond.flag] || (state.month && state.month.flags && state.month.flags[cond.flag]));
  }
  if (cond.hasInstrument) {
    const have = Number((state.lab.equipment && state.lab.equipment[cond.hasInstrument]) || 0);
    return have >= (cond.min === undefined ? 1 : cond.min);
  }
  if (cond.anyProject) return state.projects.some((p) => matchProject(p, cond.anyProject));
  if (cond.anyStudent) return state.students.some((st) => matchStudent(st, cond.anyStudent));
  if (cond.ctxStudent) return ctx.student ? matchStudent(ctx.student, cond.ctxStudent) : false;
  if (cond.ctxProject) return ctx.project ? matchProject(ctx.project, cond.ctxProject) : false;
  return false;
}

/* ══ 市场 ══ */
/**
 * 人才市场（招生季）今天开不开。t22（T11-F1）：这里只描述**招生季**，
 * 不再有「第 0 月强行算开放」的特例 —— 那个特例会让第 0 月出现
 * 「open 为真但市场里一个候选人都没有」的自相矛盾状态（MARKET_OPEN_FIRST_MONTH 已删除）。
 * 项目市场不归它管：项目 offer 全年按 PROJECT_SLOTS / REFRESH_MONTHLY 刷新。
 */
export function isMarketOpen(state) {
  return MARKET_OPEN_MONTHS.includes(state.calendar.month);
}

/**
 * 「这个 offer 在头衔与仪器上够得着吗」——不看当前在研项目数。
 * 市场刷新用它保证「池子里永远有可接的项目」；并发上限是玩家侧的临时状态，
 * 不能拿来做市场不变式（在研满了的时候任何 offer 都会被判不可接）。
 */
export function offerReachable(state, offer) {
  if (!offer || offer.kind !== 'project') return false;
  if (missingInstruments(state.lab, offer.require || {}).length > 0) return false;
  return offer.tier <= rankOf(state.player.rankIndex).maxProjectTier;
}

/** 承接一个市场项目是否可行（头衔 + 仪器 + 并发名额）。 */
export function canAcceptOffer(state, offer) {
  const reasons = [];
  const missing = missingInstruments(state.lab, offer.require || {});
  if (missing.length > 0) {
    reasons.push({ code: 'instruments', text: '仪器不足：' + missing.map((m) => m.id + '(' + m.have + '/' + m.need + ')').join('、') });
  }
  const rank = rankOf(state.player.rankIndex);
  if (offer.tier > rank.maxProjectTier) {
    reasons.push({ code: 'rank', text: '当前头衔最高只能承接 T' + rank.maxProjectTier + ' 项目' });
  }
  const cap = rank.concurrentCap;
  if (activeProjects(state).length >= cap) {
    reasons.push({ code: 'concurrent', text: '在研项目已达上限 ' + cap + ' 项' });
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * 「这个候选人我够得着吗」——只看头衔与组内 IF 门槛，不看名额/经费/本月上限。
 * 市场刷新用它保证「招生季里总有至少一个真能招的候选人」：名额/经费不足是玩家侧状态，
 * 不能拿来做市场不变式。
 */
export function recruitReachable(state, offer) {
  if (!offer || offer.kind !== 'student') return false;
  // t30（BALANCE §18.13）：头衔不再参与准入——否则「IF 上万但一作不足卡在 rank1」的存档
  // 会连一个候选人都招不到（t13 实测 0 人），实验室就此断供。reqRank 保留为展示用 titleReq。
  return state.player.totalIF >= (offer.reqIF || 0);
}

/** 招募一个候选人是否可行（头衔 + IF + 名额 + 经费 + 本月上限）。 */
export function canRecruitOffer(state, offer) {
  const reasons = [];
  const rank = rankOf(state.player.rankIndex);
  const cap = offer.degree === 'phd' ? rank.phdCap : rank.masterCap;
  // SPEC：延毕生不占招生名额 → 只统计未延毕的在读生
  const counted = state.students.filter((s) => !s.left && !s.graduated && s.degree === offer.degree && s.deferMonths <= 0).length;
  if (counted >= cap) reasons.push({ code: 'quota', text: '名额已满（' + counted + '/' + cap + '）' });
  if (state.player.money < offer.cost) reasons.push({ code: 'money', text: '经费不足，需要 ' + offer.cost + ' 万' });
  if (state.player.totalIF < offer.reqIF) reasons.push({ code: 'if', text: '组内 IF 门槛 ' + offer.reqIF + '（当前 ' + Math.round(state.player.totalIF) + '）' });
  if (state.market.recruitedThisMonth >= RECRUIT_PER_MONTH) reasons.push({ code: 'monthly', text: '本月招募名额已用完' });
  return { ok: reasons.length === 0, reasons };
}

export function poolCap() {
  return POOL_CAP;
}

/* ══ 事件 ══ */
export function eventCooldownLeft(state, eventId) {
  const last = state.eventState.lastFiredMonth[eventId];
  if (last === undefined) return 0;
  const cd = EVENT_COOLDOWN_MONTHS;
  return Math.max(0, cd - (state.calendar.monthIndex - last));
}

export function availableEvents(state) {
  return EVENTS.filter((ev) => {
    if (ev.once && state.eventState.lastFiredMonth[ev.id] !== undefined) return false;
    if (eventCooldownLeft(state, ev.id) > 0) return false;
    return evaluateCondition(ev.cond, { state });
  });
}

/* ══ 晋升 / 增选 ══ */
export function promotionStatus(state) {
  const status = rankStatus(state);
  if (!status.next) return { ...status, eligible: false, reason: '已是最高头衔' };
  let eligible = status.ok;
  let reason = '';
  if (status.next.index === 8) {
    if (state.player.age < MIN_ACADEMICIAN_AGE) { eligible = false; reason = '年龄不足 ' + MIN_ACADEMICIAN_AGE + ' 岁'; }
    else if (state.player.tickets < ticketRequirement(state)) { const need = ticketRequirement(state); eligible = false; reason = '推荐票不足（' + state.player.tickets + '/' + need + (state.player.missedElectionWindows ? '，已错过 ' + state.player.missedElectionWindows + ' 次窗口，门槛随之上调' : '') + '）'; }
    else if (!state.flags.electionWindowOpen) { eligible = false; reason = '不在增选窗口（每 ' + ELECTION_WINDOW_INTERVAL + ' 个月一次）'; }
  }
  return { ...status, eligible, reason };
}

/* ══ 结局 ══ */
export function endingFor(state) {
  for (const ending of ENDINGS) {
    if (evaluateCondition(ending.cond, { state })) {
      const variant = (ending.variants || []).find((v) => evaluateCondition(v.cond, { state }));
      return { ending, variant: variant || null };
    }
  }
  return null;
}

/** 破产判定（连续 N 个月 money<0 且耗材见底，SPEC 方向）。 */
export function isBankrupt(state) {
  return (state.flags.negativeMoneyMonths || 0) >= BANKRUPT_NEGATIVE_MONTHS;
}

export function isLabEmpty(state) {
  return (state.month.leavesThisMonth || 0) >= LAB_EMPTY_THRESHOLD;
}

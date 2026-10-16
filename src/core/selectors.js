/**
 * selectors.js —— 只读派生数据（纯函数，不改 state）
 *
 * UI 只能通过 selectors / viewmodel 拿数据；不允许 UI 里自己算公式。
 */

import { RANKS, rankOf, MAX_RANK_INDEX } from '../data/ranks.js';
import { INSTRUMENTS, INSTRUMENT_MAP, INST_HOLD_CAP } from '../data/instruments.js';
import { PROJECT_MAP, MARKET_SLOTS, PROJECT_SLOTS, STUDENT_SLOTS, REFRESH_MONTHLY, DEPOSIT_RATE } from '../data/projects.js';
import { PAPER_TIER_LABELS, PAPER_TIER_ORDER, PAPER_BUY_PRICE, GRAB_FIRST_HAPPY, GRAB_GRUDGE_MONTHS, JOURNAL_IF_BASE, PLAYER_AUTHOR_ID } from '../data/papers.js';
import { WAGE, WAGE_TIER_LABELS, DEGREE_LABELS, MASTER_STUDY_MONTHS, PHD_STUDY_MONTHS, DEGREE_PROGRESS_MAX, DEFER_HAPPY, DEFER_MONTHS_SUBTRACT, DEFER_QUOTA_MASTER, DEFER_QUOTA_PHD, DEFER_FREE_QUOTA } from '../data/students.js';
import { MARKET_OPEN_MONTHS, POOL_TRANSLATE_MONTHS, POOL_EXAM_MONTHS, RECRUIT_PER_MONTH } from '../data/market.js';
import { ACTION_DEFS } from '../data/actions.js';
import { HARDPOINT_METHODS, HARDPOINT_METHOD_ORDER, TEAM_MIN_STUDENTS, TEAM_MONEY, SOLO_MONEY, FAKE_MONEY, FAKE_INTEGRITY, MAX_PROJECTS_PER_STUDENT, PROJECT_MAX_STUDENTS } from '../data/hardpoints.js';
import { CONSUME_MODE_ORDER, CONSUME_MODES, PHASE_LABELS, CONSUMABLE_BUY_PACK, CONSUMABLE_PRICE_PER_UNIT, CONSUMABLE_LOW_THRESHOLD, INTEGRITY_DELTA } from '../data/tuning.js';
import {
  rankStatus, equipmentBonus, maintenanceTotal, wageCost, instrumentPrice, projectProgressPct, openHardpointCount,
  projectTail, energyMax, hireCost, expectedWageTier,
  teamSuccessChance, soloSuccessChance, fakeCatchChance, retryBonus, firstAuthorDrought,
} from './formulas.js';
// core 内部的常量复用（engine 不 import selectors，因此无循环依赖）
import { TALK_PER_STUDENT_PER_MONTH, pendingDeferStudents, grabbedPaperThisMonth, autoAssignPlan } from './engine.js';
import { isMarketOpen, canAcceptOffer, canRecruitOffer, promotionStatus } from './rules.js';
import { EVENT_MAP } from '../data/events.js';
import { ENDING_MAP } from '../data/endings.js';

export const GRADE_LABELS = { top: '正刊', q1: '一区', q2: '二区', q3: '三区', q4: '四区' };

export function selectPhase(state) {
  return { id: state.phase, label: PHASE_LABELS[state.phase] || state.phase };
}

export function selectTime(state) {
  return {
    year: state.calendar.year,
    month: state.calendar.month,
    monthIndex: state.calendar.monthIndex,
    text: '第 ' + state.calendar.year + ' 年 ' + state.calendar.month + ' 月',
  };
}

export function selectRankInfo(state) {
  const rank = rankOf(state.player.rankIndex);
  const promotion = promotionStatus(state);
  return {
    index: rank.index,
    title: rank.title,
    max: MAX_RANK_INDEX,
    next: promotion.next ? { index: promotion.next.index, title: promotion.next.title } : null,
    eligible: promotion.eligible,
    reason: promotion.reason,
    missing: promotion.missing,
    progress: Math.round((rank.index / MAX_RANK_INDEX) * 100),
  };
}

export function selectAchievements(state) {
  return {
    totalIF: Math.round(state.player.totalIF * 10) / 10,
    papers: { ...state.player.papers },
    papersFirst: { ...state.player.papersFirst },
    graduated: { ...state.player.graduated },
    tickets: state.player.tickets,
    ranks: PAPER_TIER_ORDER.map((t) => ({ tier: t, label: PAPER_TIER_LABELS[t], count: state.player.papers[t] || 0 })),
  };
}

export function selectSlots(state) {
  const rank = rankOf(state.player.rankIndex);
  const active = state.students.filter((s) => !s.left && !s.graduated);
  const masters = active.filter((s) => s.degree === 'master');
  const phds = active.filter((s) => s.degree === 'phd');
  const counted = (list) => list.filter((s) => s.deferMonths <= 0).length;
  return {
    master: { used: counted(masters), cap: rank.masterCap, total: masters.length },
    phd: { used: counted(phds), cap: rank.phdCap, total: phds.length },
    concurrent: { used: state.projects.filter((p) => p.status === 'active').length, cap: rank.concurrentCap },
    text: '硕 ' + counted(masters) + '/' + rank.masterCap + ' · 博 ' + counted(phds) + '/' + rank.phdCap,
  };
}

export function selectStudentRow(state, st) {
  const projects = st.projectIds.map((id) => state.projects.find((p) => p.instanceId === id)).filter(Boolean);
  return {
    id: st.id,
    name: st.name,
    degree: st.degree,
    degreeLabel: DEGREE_LABELS[st.degree] || st.degree,
    source: st.source,
    sourceLabel: st.source === 'exam' ? '考研' : '保研',
    ability: st.ability,
    abilityPct: Math.round(st.ability * 100),
    happiness: st.happiness,
    happinessTone: st.happiness >= 70 ? 'good' : (st.happiness >= 40 ? 'normal' : 'bad'),
    wageTier: st.wageTier,
    wageLabel: WAGE_TIER_LABELS[st.wageTier] || st.wageTier,
    wageCost: wageCost(st),
    degreeProgress: Math.round(st.degreeProgress),
    monthsInLab: Math.round(st.monthsInLab || 0),
    monthsInLabText: Math.max(1, Math.ceil((st.monthsInLab || 0) / 12)) + ' 年',
    talkThisMonth: Math.round(st.monthTalkCount || 0),
    monthsLeft: Math.max(0, st.studyMonthsLeft),
    monthsLeftText: Math.max(0, st.studyMonthsLeft) + ' 个月',
    deferMonths: st.deferMonths,
    grudge: st.grudgeMonths > 0,
    projects: projects.map((p) => ({ instanceId: p.instanceId, name: p.name, progressPct: projectProgressPct(p) })),
    projectText: projects.length ? projects.map((p) => p.name).join('、') : '没有负责项目',
    statusLabel: st.graduated ? '已毕业' : (st.left ? (st.note || '已离组') : (st.deferMonths > 0 ? '延毕中' : '在读')),
    // 本月是否已经抢过一作（core 的判定，UI 直接显示，不再自己推导）
    grabbedPaperThisMonth: grabbedPaperThisMonth(state, st.id),
  };
}

export function selectStudents(state) {
  return state.students.map((st) => selectStudentRow(state, st));
}

/** 等玩家拍板的延毕决定（判定在 engine.pendingDeferStudents，这里只做行包装）。 */
export function selectPendingDefer(state) {
  return pendingDeferStudents(state).map((st) => selectStudentRow(state, st));
}

export function selectActiveStudents(state) {
  return state.students.filter((s) => !s.left && !s.graduated).map((st) => selectStudentRow(state, st));
}

/**
 * 三种处理方式的推荐人选：先本项目在读学生，不够再从全组按能力补。
 * 纯排序查表、无随机 —— 成功率由 core 算好给 UI 显示，抽调的也是同一批人（所见即所得）。
 */
function suggestedMembers(state, project, limit) {
  const byAbility = (a, b) => (b.ability - a.ability) || (a.id < b.id ? -1 : 1);
  const onProject = (project.assignedStudentIds || [])
    .map((id) => state.students.find((s) => s.id === id))
    .filter((s) => s && !s.left && !s.graduated)
    .sort(byAbility);
  const taken = new Set(onProject.map((s) => s.id));
  const others = state.students
    .filter((s) => !s.left && !s.graduated && !taken.has(s.id))
    .sort(byAbility);
  return onProject.concat(others).slice(0, Math.max(0, limit));
}

export function selectHardpoint(state, project, hp) {
  const statusLabels = { hidden: '未暴露', open: '未解决', solved: '已解决', faked: '已蒙混' };
  const row = {
    id: hp.id,
    hd: hp.hd,
    status: hp.status,
    statusLabel: statusLabels[hp.status] || hp.status,
    method: hp.method,
    appearText: hp.status === 'hidden' ? '第 ' + hp.appearAt + ' 月暴露' : '',
    open: hp.status === 'open' || hp.status === 'hidden',
  };
  if (hp.status !== 'open') return row;
  // t8 finding：每个按钮要显示成功率、列出会被抽调的学生姓名与幸福代价。
  // 概率依赖学生能力与重试加成，必须由 core 算（UI 不许出现公式）。
  const bonus = retryBonus(hp.retries || 0);
  const teamMembers = suggestedMembers(state, project, TEAM_MIN_STUDENTS);
  const soloMembers = suggestedMembers(state, project, 1);
  const teamChance = teamSuccessChance(teamMembers, bonus);
  const soloChance = soloMembers.length ? soloSuccessChance(soloMembers[0].ability, bonus) : 0;
  const catchChance = fakeCatchChance(hp.fakeCount || 0, state.counters.fakesTotal || 0);
  row.attempts = {
    retryBonus: bonus,
    team: {
      studentIds: teamMembers.map((s) => s.id),
      names: teamMembers.map((s) => s.name),
      enough: teamMembers.length >= TEAM_MIN_STUDENTS,
      chance: teamChance,
      pct: Math.round(teamChance * 100),
    },
    solo: {
      studentIds: soloMembers.map((s) => s.id),
      names: soloMembers.map((s) => s.name),
      chance: soloChance,
      pct: Math.round(soloChance * 100),
    },
    fake: { chance: catchChance, pct: Math.round(catchChance * 100) },
  };
  return row;
}

export function selectProjectRow(state, project) {
  const def = PROJECT_MAP[project.defId];
  return {
    instanceId: project.instanceId,
    defId: project.defId,
    name: project.name || (def ? def.name : project.defId),
    category: project.category,
    categoryLabel: project.category === 'enterprise' ? '企业横向' : '国家项目',
    tier: project.tier,
    tierLabel: 'T' + project.tier,
    workload: project.workload,
    progress: project.progress,
    progressPct: projectProgressPct(project),
    deadlineText: '第 ' + project.deadlineMonthIndex + ' 月截止',
    deadlineInMonths: Math.max(0, project.deadlineMonthIndex - state.calendar.monthIndex),
    overdueMonths: project.overdueMonths,
    overdue: project.overdueMonths > 0,
    money: project.money,
    tailText: projectTail(project) + ' 万',
    openHardpoints: openHardpointCount(project),
    hardpoints: (project.hardpoints || []).map((hp) => selectHardpoint(state, project, hp)),
    playerLeading: project.playerLeading,
    students: project.assignedStudentIds.map((id) => {
      const st = state.students.find((s) => s.id === id);
      return st ? { id: st.id, name: st.name } : { id, name: '（已离组）' };
    }),
    // 一作归属的机器可读标记（t24 规则）：亲带项目的论文 firstAuthorId === PLAYER_AUTHOR_ID。
    // UI 必须据 byPlayer 渲染，不得只看 grabbed —— 否则会把老板亲带的论文误标成「一作还在学生名下」。
    papers: (project.paperTiers || []).map((p) => (p && typeof p === 'object'
      ? { ...p, byPlayer: p.firstAuthorId === PLAYER_AUTHOR_ID }
      : p)),
    status: project.status,
  };
}

export function selectProjects(state) {
  return state.projects.map((p) => selectProjectRow(state, p));
}

export function selectEquipment(state) {
  return INSTRUMENTS.map((def) => {
    const owned = state.lab.equipment[def.id] || 0;
    const down = (state.lab.equipmentDown[def.id] || 0) > 0;
    const price = instrumentPrice(def.id, owned);
    const reasons = [];
    if (owned >= INST_HOLD_CAP) reasons.push('已买满');
    if (state.player.rankIndex < def.tierGate) reasons.push('需头衔 ' + def.tierGate);
    if (state.player.money < price) reasons.push('经费不足');
    return {
      id: def.id,
      name: def.name,
      tier: def.tier,
      tierLabel: def.tierLabel,
      bonusPct: Math.round(def.bonus * 100),
      owned,
      holdCap: INST_HOLD_CAP,
      down,
      downMonths: state.lab.equipmentDown[def.id] || 0,
      price,
      maintain: def.maintain,
      reason: reasons[0] || '',
      canBuy: reasons.length === 0,
    };
  });
}

export function selectLab(state) {
  return {
    bonusPct: Math.round(equipmentBonus(state.lab) * 100),
    maintain: maintenanceTotal(state.lab),
    equipment: selectEquipment(state),
  };
}

export function selectMarket(state) {
  // t22（T11-F1）：这里必须分清两件事，否则 UI 会把「招生季关闭」误读成「市场关闭」。
  //   · recruitOpen / openText —— 只描述**人才市场（招生季）**：每年 6–12 月；
  //   · projectsOpenAllYear —— 项目市场全年刷新（每月 REFRESH_MONTHLY 个，上限 PROJECT_SLOTS）。
  // 旧实现的 open 同时表示两者，于是 1–5 月的项目栏被 UI 写成「市场休市」。
  const recruitOpen = isMarketOpen(state);
  const open = recruitOpen;
  const offers = state.market.pool;
  const projectCount = offers.filter((o) => o.kind === 'project').length;
  const studentCount = offers.filter((o) => o.kind === 'student').length;
  const projects = offers.filter((o) => o.kind === 'project').map((o) => {
    const check = canAcceptOffer(state, o);
    return {
      offerId: o.offerId,
      kind: 'project',
      defId: o.defId,
      name: (PROJECT_MAP[o.defId] || {}).name || o.defId,
      category: o.category,
      categoryLabel: o.category === 'enterprise' ? '企业' : '国家',
      tier: o.tier,
      tierLabel: 'T' + o.tier,
      money: o.money,
      deposit: Math.round(o.money * ((PROJECT_MAP[o.defId] || {}).depositRate || DEPOSIT_RATE[o.category] || DEPOSIT_RATE.enterprise) * 10) / 10,
      limitMonths: o.limitMonths,
      workload: o.workload,
      requireText: Object.entries(o.require || {}).map(([id, n]) => (INSTRUMENT_MAP[id] ? INSTRUMENT_MAP[id].name : id) + '×' + n).join('、') || '无',
      locked: Boolean(o.locked),
      canAccept: check.ok,
      reason: check.reasons.length ? check.reasons[0].text : '',
    };
  });
  const students = offers.filter((o) => o.kind === 'student').map((o) => {
    const check = canRecruitOffer(state, o);
    return {
      offerId: o.offerId,
      kind: 'student',
      name: o.name,
      degree: o.degree,
      degreeLabel: DEGREE_LABELS[o.degree] || o.degree,
      source: o.source,
      sourceLabel: o.source === 'exam' ? '考研' : '保研',
      ability: o.ability,
      abilityPct: Math.round(o.ability * 100),
      cost: o.cost,
      reqIF: o.reqIF,
      reqRank: o.reqRank,
      expectedWage: (() => {
        const tier = expectedWageTier(o.ability);
        return { tier, label: WAGE_TIER_LABELS[tier] || tier };
      })(),
      canHire: check.ok,
      reason: check.reasons.length ? check.reasons[0].text : '',
    };
  });
  return {
    open,                                   // 兼容旧 UI：等于 recruitOpen
    recruitOpen,                            // 招生季是否开放（每年 6–12 月）
    openText: recruitOpen
      ? '招生季开放中（每年 ' + MARKET_OPEN_MONTHS.join('、') + ' 月）'
      : '非招生季（每年 ' + MARKET_OPEN_MONTHS.join('、') + ' 月开放）',
    recruitSeasonMonths: MARKET_OPEN_MONTHS.slice(),
    projectsOpenAllYear: true,               // 项目市场全年刷新，不受招生季影响（t22）
    projectRefreshMonthly: REFRESH_MONTHLY,
    projectRefreshText: '项目全年刷新：每月新增 ' + REFRESH_MONTHLY + ' 个，最多同时挂 ' + PROJECT_SLOTS + ' 个',
    slots: {
      used: offers.length,
      cap: MARKET_SLOTS,
      projects: { used: projectCount, cap: PROJECT_SLOTS },
      students: { used: studentCount, cap: STUDENT_SLOTS },
    },
    projects,
    students,
  };
}

/**
 * 展示常量透传（t5 验收：UI 不许硬编码任何数值，数字统一从 core 取）。
 * 纯查表，无计算逻辑。
 */
export function selectUiConstants() {
  return {
    actions: ACTION_DEFS.map((a) => ({
      id: a.id, name: a.name, hint: a.hint, energyCost: a.energyCost, moneyCost: a.moneyCost, limitPerMonth: a.limitPerMonth,
    })),
    hardpoints: {
      order: HARDPOINT_METHOD_ORDER.slice(),
      methods: JSON.parse(JSON.stringify(HARDPOINT_METHODS)),
      teamMin: TEAM_MIN_STUDENTS,
      teamMoney: TEAM_MONEY,
      soloMoney: SOLO_MONEY,
      fakeMoney: FAKE_MONEY,
      fakeIntegrity: FAKE_INTEGRITY,
    },
    papers: {
      order: PAPER_TIER_ORDER.slice(),
      labels: { ...PAPER_TIER_LABELS },
      price: { ...PAPER_BUY_PRICE },
      grabIntegrity: INTEGRITY_DELTA.grabFirst,
      buyIntegrity: INTEGRITY_DELTA.buyFirst,
      grabHappy: GRAB_FIRST_HAPPY,
      grabGrudgeMonths: GRAB_GRUDGE_MONTHS,
      ifBase: { ...JOURNAL_IF_BASE },
    },
    /** 一键分配工作（t25）的两个上限：数字由 core 给出，UI 不写死 */
    autoAssign: { studentCap: MAX_PROJECTS_PER_STUDENT, projectCap: PROJECT_MAX_STUDENTS },
    /** 「与学生交流课题」的次数上限（GDD §8：每名学生每月 2 次） */
    limits: { talkPerStudentPerMonth: TALK_PER_STUDENT_PER_MONTH },
    /** 延毕决定弹层要写的后果（不可逆项全部来自数据层） */
    defer: {
      happy: DEFER_HAPPY,
      months: DEFER_MONTHS_SUBTRACT,
      quotaMaster: DEFER_QUOTA_MASTER,
      quotaPhd: DEFER_QUOTA_PHD,
      degreeProgressMax: DEGREE_PROGRESS_MAX,
      giveUpIntegrity: INTEGRITY_DELTA.giveUpStudent,
      freeQuota: DEFER_FREE_QUOTA,
    },
    /** 耗材资金的单位换算（t8 finding：UI 要说清 1 单位 = 1 万元） */
    consumable: {
      pricePerUnit: CONSUMABLE_PRICE_PER_UNIT,
      pack: CONSUMABLE_BUY_PACK,
      lowThreshold: CONSUMABLE_LOW_THRESHOLD,
    },
    consumeModes: CONSUME_MODE_ORDER.map((id) => ({
      id, label: CONSUME_MODES[id].label, hint: CONSUME_MODES[id].hint,
      consumeMul: CONSUME_MODES[id].consumeMul, progressMul: CONSUME_MODES[id].progressMul, happyDelta: CONSUME_MODES[id].happyDelta,
    })),
    market: {
      openMonths: MARKET_OPEN_MONTHS.slice(),
      translateMonths: POOL_TRANSLATE_MONTHS.slice(),
      examMonths: POOL_EXAM_MONTHS.slice(),
      recruitPerMonth: RECRUIT_PER_MONTH,
    },
    integrity: { ...INTEGRITY_DELTA },
  };
}

export function selectActions(state) {
  const energy = energyMax(state);
  const pack = CONSUMABLE_BUY_PACK;
  const packCost = pack * CONSUMABLE_PRICE_PER_UNIT;
  return {
    energy: state.player.energy,
    energyMax: energy,
    money: state.player.money,
    consumable: state.player.consumable,
    consumableLow: state.player.consumable < CONSUMABLE_LOW_THRESHOLD,
    buyPack: pack,
    buyPackCost: packCost,
    canBuyConsumable: state.player.money >= packCost,
    consumeMode: state.player.consumeMode,
    consumeModes: CONSUME_MODE_ORDER.map((id) => ({
      id,
      label: CONSUME_MODES[id].label,
      hint: CONSUME_MODES[id].hint,
      active: state.player.consumeMode === id,
    })),
    studentOptions: selectActiveStudents(state).map((s) => ({ id: s.id, name: s.name + '（' + s.degreeLabel + '）' })),
    projectOptions: selectProjects(state).filter((p) => p.status === 'active').map((p) => ({ id: p.instanceId, name: p.name })),
    autoAssign: selectAutoAssign(state),
  };
}

/**
 * 一键分配工作（t25）：把引擎的分配计划原样透给 UI——可分配学生数、仍缺人的项目、
 * 上次分配结果摘要、以及「点下去会怎么分」的预览。UI 不需要自己推导任何规则。
 */
export function selectAutoAssign(state) {
  const plan = autoAssignPlan(state);
  const last = state.ui && state.ui.autoAssign ? state.ui.autoAssign : null;
  return {
    canAssign: plan.moves.length > 0,
    planCount: plan.moves.length,
    plan: plan.moves.map((m) => ({ ...m })),
    feedback: plan.summary.feedback,
    availableStudents: plan.summary.availableStudents,
    studentsTotal: plan.summary.studentsTotal,
    projectsTotal: plan.summary.projectsTotal,
    studentsWithoutProject: plan.summary.studentsWithoutProject.slice(),
    studentsFull: plan.summary.studentsFull.slice(),
    projectsShort: plan.summary.projectsShort.map((p) => ({ ...p })),
    studentCap: plan.summary.studentCap,
    projectCap: plan.summary.projectCap,
    last: last ? JSON.parse(JSON.stringify(last)) : null,
  };
}

/** 上月结算回执（state.stats.lastReceipt）：UI 展示「收入/支出/进度/幸福度去哪了」。 */
export function selectReceipt(state) {
  const r = state.stats && state.stats.lastReceipt;
  if (!r) return null;
  return JSON.parse(JSON.stringify(r));
}

export function selectChronicle(state, limit = 60) {
  const list = state.chronicle.slice(-limit).map((c) => ({ ...c, text: c.text }));
  return list.reverse();
}

export function selectPendingEvent(state) {
  if (!state.pendingEvent) return null;
  const ev = EVENT_MAP[state.pendingEvent.eventId];
  if (!ev) return null;
  const choices = Array.isArray(ev.choices) && ev.choices.length
    ? ev.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint || '' }))
    : [{ id: 'ack', label: '知道了', hint: '' }];
  return { eventId: ev.id, title: ev.title, text: ev.text, tone: ev.tone, choices };
}

export function selectEnding(state) {
  if (!state.ending) return null;
  const def = ENDING_MAP[state.ending.id];
  return {
    id: state.ending.id,
    title: state.ending.title || (def ? def.title : state.ending.id),
    kind: def ? def.kind : 'neutral',
    text: state.ending.text || (def ? def.text : ''),
    monthIndex: state.ending.monthIndex,
  };
}

/** 一作空窗（t30）：距最近一次拿到本人一作的月数 + core 判定的 stuck（阈值在 data/tuning.js）。 */
export function selectFirstAuthorDrought(state) {
  return firstAuthorDrought(state);
}

export function selectElection(state) {
  return {
    windowOpen: Boolean(state.flags.electionWindowOpen),
    tickets: state.player.tickets,
  };
}

export { hireCost, WAGE, PROJECT_MAP, PAPER_TIER_LABELS };

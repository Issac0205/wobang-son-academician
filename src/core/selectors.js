/**
 * selectors.js —— 只读派生数据（纯函数，不改 state）
 *
 * UI 只能通过 selectors / viewmodel 拿数据；不允许 UI 里自己算公式。
 */

import { RANKS, rankOf, MAX_RANK_INDEX, PROMOTE_INTEGRITY_BONUS, GOLDEN_AGE_MONEY_MUL, MIN_ACADEMICIAN_AGE, ELECTION_WINDOW_INTERVAL, RECOMMEND_TICKET_REQ, TICKET_REQ_PER_MISSED_WINDOW, TICKET_REQ_MAX, TICKET_PER_T6, TICKET_PER_T5, TICKET_PER_PHD_GRADUATES, TICKET_VISIT_COST } from '../data/ranks.js';
import { INSTRUMENTS, INSTRUMENT_MAP, START_INST_BONUS } from '../data/instruments.js';
import { ROOMS, ROOM_MAX, ROOM_SLOT_COLS, ROOM_SLOTS, BENCHES, BENCH_MAP, SELL_REFUND_RATE, LAB_TEXT, START_BENCHES } from '../data/lab.js';
import { findSpot, findEmptySlot, footprint, spaceSummary } from './lab.js';
import { PROJECTS, PROJECT_MAP, MARKET_SLOTS, PROJECT_SLOTS, STUDENT_SLOTS, REFRESH_MONTHLY, DEPOSIT_RATE, PROJECT_OFFER_TTL_MONTHS, STUDENT_OFFER_TTL_MONTHS, DEPOSIT_TO_CONSUMABLE, UNDERDUE_TAIL_MUL, PER_HARDPOINT_TAIL_MUL, OVERDUE_INTEGRITY_PER_MONTH, OVERDUE_STUDENT_HAPPY, PROJECT_FAIL_INTEGRITY, PROJECT_FAIL_STUDENT_HAPPY, NATION_PROJECT_RATIO } from '../data/projects.js';
import { PAPER_TIER_LABELS, PAPER_TIER_ORDER, PAPER_BUY_PRICE, GRAB_FIRST_HAPPY, GRAB_GRUDGE_MONTHS, GRUDGE_HAPPY_PER_MONTH, JOURNAL_IF_BASE, IF_RANDOM_LOW, IF_RANDOM_HIGH, PLAYER_AUTHOR_ID } from '../data/papers.js';
import {
  WAGE, WAGE_TIER_LABELS, DEGREE_LABELS, MASTER_STUDY_MONTHS, PHD_STUDY_MONTHS, DEGREE_PROGRESS_MAX,
  DEFER_HAPPY, DEFER_HAPPY_PER_MONTH, DEFER_MONTHS_SUBTRACT, DEFER_QUOTA_MASTER, DEFER_QUOTA_PHD, DEFER_FREE_QUOTA,
  DEFER_BY_BOSS_HAPPY, DEFER_BY_BOSS_PROGRESS,
  INITIAL_HAPPINESS, HAPPINESS_MIN, HAPPINESS_MAX, MASTER_GRAD_PAPER_TIER, PHD_GRAD_PAPER_TIER, GRAD_INTEGRITY_BONUS,
  ABILITY_MIN, ABILITY_MAX, ABILITY_MAX_RARE, RARE_SPAWN_RATE, RARE_TALENTS, INITIAL_STUDENT_ABILITY_MEAN_SD,
  ABILITY_TRANSLATE_MEAN_SD, ABILITY_EXAM_MEAN_SD, ABILITY_DARKHORSE_MEAN_SD, ABILITY_DARKHORSE_RATE,
  WAGE_HAPPY, GAP_PENALTY, WAGE_EXPECT_THRESHOLDS, NO_WAGE_MONTHS_THRESHOLD, MULTI_PROJECT_HAPPY_PENALTY,
  PROJECT_STRESS_HARDPOINT, PROJECT_STRESS_IDLE, HAPPY_REGRESSION_THRESHOLD, HAPPY_REGRESSION_SLOPE,
  HAPPY_PROJECT_FINISH, HAPPY_LEAD_BONUS, LEAVE_TRANSFER_PROGRESS_MUL, LEAVE_EXTREME_RATE, LEAVE_EXTREME_INTEGRITY,
  POACH_PROGRESS_MUL, DEGREE_BASE, DEG_HAPPY_COEF_BASE, DEG_HAPPY_COEF_SLOPE, DEG_HAPPY_LOW, DEG_HAPPY_LOW_THRESHOLD,
  DEG_PROJECT_FACTOR, GIVEUP_PROGRESS_MUL,
} from '../data/students.js';
import { MARKET_OPEN_MONTHS, POOL_TRANSLATE_MONTHS, POOL_EXAM_MONTHS, POOL_CAP, RECRUIT_PER_MONTH, RECRUIT_COST, REQ_IF_WEIGHT, REQ_IF_BASE_ABILITY, REQ_RANK_PER_IF, REQ_RANK_CAP } from '../data/market.js';
import {
  ACTION_DEFS, TALK_PROJECT_PROGRESS, TALK_HAPPY, TALK_DEGREE, MEETING_PROJECT_PROGRESS, MEETING_CREW_MUL,
  HAPPY_ACTION_MEETING, EXERCISE_HEALTH, EXERCISE_HEALTH_HIGH_THRESHOLD, EXERCISE_HEALTH_HIGH,
  HAPPY_ACTION_TEAMBUILD, TEAMBUILD_COST_PER_STUDENT,
} from '../data/actions.js';
import {
  HARDPOINT_METHODS, HARDPOINT_METHOD_ORDER, TEAM_MIN_STUDENTS, TEAM_MONEY, SOLO_MONEY, FAKE_MONEY, FAKE_INTEGRITY,
  MAX_PROJECTS_PER_STUDENT, PROJECT_MAX_STUDENTS, hardpointCount, BASE_PROGRESS, ABILITY_DIVISOR,
  PLAYER_LEAD_MUL, PLAYER_LEAD_ENERGY_COST, HARDPOINT_PROGRESS_PENALTY_PER_HD, HARDPOINT_PAPER_DOWNGRADE,
  HARDPOINT_RETRY_BONUS, HARDPOINT_RETRY_CAP, TEAM_MONTHS, TEAM_OTHER_PROJECT_MUL, TEAM_STUDENT_HAPPY,
  TEAM_SUCCESS_BASE, TEAM_SUCCESS_PER_STUDENT, TEAM_SUCCESS_ABILITY_COEF, TEAM_SUCCESS_ABILITY_REF, TEAM_SUCCESS_CLAMP,
  FAKE_STUDENT_HAPPY, FAKE_CATCH_BASE, FAKE_CATCH_PER_PROJECT, FAKE_CATCH_GLOBAL, FAKE_CATCH_CAP,
  FAKE_CAUGHT_INTEGRITY, FAKE_CAUGHT_PROGRESS_MUL, AUDIT_TRIGGER_FAKE_COUNT, AUDIT_MONTHLY_CHANCE, AUDIT_INTEGRITY,
  CAUGHT_BAD_ENDING_INTEGRITY, SOLO_STUDENT_HAPPY, SOLO_SUCCESS_ABILITY_COEF, SOLO_SUCCESS_BASE, SOLO_SUCCESS_CLAMP,
  SOLO_FAIL_HAPPY,
} from '../data/hardpoints.js';
import {
  CONSUME_MODE_ORDER, CONSUME_MODES, PHASE_LABELS, CONSUMABLE_BUY_PACK, CONSUMABLE_PRICE_PER_UNIT, CONSUMABLE_LOW_THRESHOLD,
  INTEGRITY_DELTA, INTEGRITY_MIN, INTEGRITY_MAX, INITIAL_INTEGRITY, INITIAL_MONEY, INITIAL_CONSUMABLE, INITIAL_HEALTH,
  INITIAL_MASTER_COUNT, INITIAL_PHD_COUNT, HEALTH_MAX, HEALTH_DECAY_PER_MONTH, ENERGY_MAX_BASE, ENERGY_PER_HEALTH_10,
  ENERGY_LOW_HEALTH_THRESHOLD, ENERGY_LOW_HEALTH_MUL, MONTHS_PER_YEAR, START_AGE_YEARS, RETIRE_AGE_YEARS, RETIRE_MONTH,
  BANKRUPT_NEGATIVE_MONTHS, LAB_EMPTY_THRESHOLD, RANDOM_EVENTS_PER_MONTH_MIN, RANDOM_EVENTS_PER_MONTH_MAX,
  FIRST_AUTHOR_DROUGHT_MONTHS,
} from '../data/tuning.js';
import {
  rankStatus, equipmentBonus, equipmentBonusSum, maintenanceTotal, wageCost, instrumentPrice, projectProgressPct, openHardpointCount,
  projectTail, energyMax, hireCost, expectedWageTier,
  teamSuccessChance, soloSuccessChance, fakeCatchChance, retryBonus, firstAuthorDrought, schoolFundMonthly,
  activeProjects,
} from './formulas.js';
// core 内部的常量复用（engine 不 import selectors，因此无循环依赖）
import { TALK_PER_STUDENT_PER_MONTH, pendingDeferStudents, grabbedPaperThisMonth, autoAssignPlan } from './engine.js';
import { isMarketOpen, canAcceptOffer, canRecruitOffer, promotionStatus } from './rules.js';
import { EVENT_MAP } from '../data/events.js';
import { ENDINGS, ENDING_MAP } from '../data/endings.js';
import { round } from './rng.js';

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
    rare: st.rare === true,
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
    // v1.6.0：这张学生卡能不能点「延毕他」（判定在 core，UI 不自己推）
    canDeferByBoss: !st.left && !st.graduated,
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

/**
 * 亲带并发状态（v1.7.0）：**上限由头衔决定**，值住在 src/data/ranks.js 的 playerLeadCap。
 * UI 只用这份快照渲染「已亲带 N / 上限 M」和超限提示，不自己算上限、也不写死数字。
 * over=true 表示旧档遗留的超限状态（引擎不追溯取消，但拒绝再新增）。
 */
export function selectPlayerLead(state) {
  const rank = rankOf(state.player.rankIndex);
  const count = activeProjects(state).filter((p) => p.playerLeading).length;
  return {
    cap: rank.playerLeadCap,
    count,
    over: count > rank.playerLeadCap,
    canAdd: count < rank.playerLeadCap,
    rankIndex: rank.index,
    rankTitle: rank.title,
  };
}

export function selectEquipment(state) {
  return INSTRUMENTS.map((def) => {
    const owned = state.lab.equipment[def.id] || 0;
    const down = (state.lab.equipmentDown[def.id] || 0) > 0;
    const price = instrumentPrice(def.id);
    const reasons = [];
    if (state.player.rankIndex < def.tierGate) reasons.push('需头衔 ' + def.tierGate);
    if (state.player.money < price) reasons.push('经费不足');
    // 1.1：没有持有上限，唯一约束是空间（LAB-SPACE §2）
    const spot = findSpot(state.lab, def.id);
    if (!spot) reasons.push('空间不足');
    return {
      id: def.id,
      name: def.name,
      tier: def.tier,
      tierLabel: def.tierLabel,
      bonusPct: Math.round(def.bonus * 100),
      owned,
      holdCap: '∞',                       // 1.1：取消持有上限（展示用）
      w: def.w,
      h: def.h,
      cells: def.w * def.h,
      flavor: def.flavor || '',
      autoSpot: spot,                     // 自动摆放会落在哪（无坐标购买时）
      sellRefund: Math.round(price * SELL_REFUND_RATE * 100) / 100,
      down,
      downMonths: state.lab.equipmentDown[def.id] || 0,
      price,
      maintain: def.maintain,
      reason: reasons[0] || '',
      canBuy: reasons.length === 0,
    };
  });
}

/** 1.1 实验室空间：房间 → 台位 → 台子 → 仪器（LAB-SPACE §10 的 UI 数据源）。 */
export function selectLabSpace(state) {
  const lab = state.lab;
  const money = state.player.money;
  const rank = state.player.rankIndex;
  const rooms = (lab.rooms || []).map((room, roomIdx) => {
    const def = ROOMS[roomIdx] || {};
    return {
      roomIdx, id: room.id, name: def.name || room.id, flavor: def.flavor || '', owned: true,
      cols: ROOM_SLOT_COLS,
      slots: room.slots.map((bench, slot) => {
        if (!bench) return { slot, empty: true };
        const size = BENCH_MAP[bench.type];
        return {
          slot, empty: false, uid: bench.uid, type: bench.type, name: size.name, w: size.w, h: size.h,
          sellRefund: Math.round(size.price * SELL_REFUND_RATE * 100) / 100,
          canSell: bench.items.length === 0,
          items: bench.items.map((it) => {
            const d = INSTRUMENT_MAP[it.inst];
            const fp = footprint(it.inst, it.rot);
            return {
              uid: it.uid, inst: it.inst, name: d.name, tier: d.tier, tierLabel: d.tierLabel, x: it.x, y: it.y, rot: it.rot,
              w: fp.w, h: fp.h, flavor: d.flavor || '', bonusPct: Math.round(d.bonus * 100), maintain: d.maintain,
              down: (lab.equipmentDown[it.inst] || 0) > 0,
              sellRefund: Math.round(instrumentPrice(it.inst) * SELL_REFUND_RATE * 100) / 100,
            };
          }),
        };
      }),
    };
  });
  const nextIdx = rooms.length;
  const nextRoomDef = nextIdx < ROOM_MAX ? ROOMS[nextIdx] : null;
  const nextRoom = nextRoomDef ? (() => {
    const reason = rank < nextRoomDef.rankGate ? '需「' + rankOf(nextRoomDef.rankGate).title + '」' : (money < nextRoomDef.price ? '经费不足' : '');
    return { roomIdx: nextIdx, id: nextRoomDef.id, name: nextRoomDef.name, price: nextRoomDef.price, rankGate: nextRoomDef.rankGate, rankGateTitle: rankOf(nextRoomDef.rankGate).title, flavor: nextRoomDef.flavor, canBuy: !reason, reason };
  })() : null;
  const freeSlot = findEmptySlot(lab);
  const benches = BENCHES.map((b) => {
    const reason = rank < b.rankGate ? '需「' + rankOf(b.rankGate).title + '」' : (!freeSlot ? '没有空台位' : (money < b.price ? '经费不足' : ''));
    return { id: b.id, name: b.name, w: b.w, h: b.h, cells: b.w * b.h, price: b.price, rankGate: b.rankGate, rankGateTitle: rankOf(b.rankGate).title, canBuy: !reason, reason };
  });
  return {
    rooms,
    lockedRooms: ROOMS.slice(nextIdx).map((d) => ({ id: d.id, name: d.name, price: d.price, rankGate: d.rankGate, rankGateTitle: rankOf(d.rankGate).title, flavor: d.flavor })),
    nextRoom,
    benches,
    summary: spaceSummary(lab),
    text: { ...LAB_TEXT },
  };
}

export function selectLab(state) {
  // 1.3：加成不再封顶 → 删掉 bonusCapPct / bonusCapped（没有「已封顶」这回事了）。
  // bonusRawPct 保留为同值，纯为兼容旧调用方。
  const bonusPct = Math.round(equipmentBonus(state.lab) * 100);
  return {
    bonusPct,
    bonusRawPct: Math.round(equipmentBonusSum(state.lab) * 100),
    maintain: maintenanceTotal(state.lab),
    equipment: selectEquipment(state),
    storage: selectStorage(state),
    space: selectLabSpace(state),
  };
}

/**
 * 1.3 仓库（LAB-SPACE §11）：只读元数据，UI 直接渲染。
 * 仓库里的仪器**不提供加成、不收维护费**（口径见 core/lab.js 的 countEquipment）；
 * 卖出退款与台面同口径（SELL_REFUND_RATE）。
 */
export function selectStorage(state) {
  return (state.lab.storage || []).map((s) => {
    const def = INSTRUMENT_MAP[s.inst];
    if (!def) return null;
    return {
      uid: s.uid,
      inst: s.inst,
      name: def.name,
      tier: def.tier,
      tierLabel: def.tierLabel,
      w: def.w,
      h: def.h,
      cells: def.w * def.h,
      flavor: def.flavor || '',
      bonusPct: Math.round(def.bonus * 100),
      maintain: def.maintain,
      down: (state.lab.equipmentDown[def.id] || 0) > 0,
      sellRefund: Math.round(instrumentPrice(def.id) * SELL_REFUND_RATE * 100) / 100,
    };
  }).filter(Boolean);
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
      rare: o.rare === true,
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
export function selectUiConstants(state) {
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
    /** v1.6.0「延毕他」确认弹层的代价（数字来自 src/data，UI 只拼句） */
    deferByBoss: {
      happy: DEFER_BY_BOSS_HAPPY,
      progress: DEFER_BY_BOSS_PROGRESS,
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
    /** v1.5.0 游戏内百科（10 章）：数据表在此从 src/data 组装，UI 只渲染 */
    wiki: selectWiki(state),
  };
}

/* ══ v1.5.0 游戏内百科（10 章） ══
   硬约束（_probe/wiki-1.5-spec.md ①）：百科里出现的每一个数字都在这里从 src/data 取，
   经 viewmodel 暴露给 UI；src/ui/views/wiki.js 只做排版，不出现任何游戏数值字面量。
   key 是对外契约：scripts/ui-smoke.mjs 用 [data-wiki-key] 逐项把页面数字与 core 常量对账。 */

const WIKI_NONE = '—';

/** 最多三位小数的紧凑写法（整数不带 .0；0.85 不会被抹成 0.9，0.004 也不会归零）。 */
function wikiTrim(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return WIKI_NONE;
  return String(Math.round(v * 1000) / 1000);
}

/** 金额统一两位小数：仪器维护费这类 0.08 万的小额不能被抹掉。 */
function wikiTrim2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return WIKI_NONE;
  return String(Math.round(v * 100) / 100);
}

/** 带符号的差值文本：+3 / −8 / 0（负号用 U+2212，与 UI 既有排版一致）。 */
function wikiDeltaOf(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || Math.round(v * 10) === 0) return '0';
  return (v > 0 ? '+' : '−') + wikiTrim(Math.abs(v));
}

function wikiMoneyOf(n) { return wikiTrim2(n) + ' 万'; }
/** 0.4 → 40% */
function wikiPctOf(x) { return Math.round(Number(x) * 100) + '%'; }
/** 0.85 → ×0.85 */
function wikiMulOf(x) { return '×' + wikiTrim(x); }

function wikiRowOf(key, label, value, note) {
  return {
    key,
    label,
    value: value === undefined || value === null ? WIKI_NONE : String(value),
    note: note ? String(note) : '',
  };
}

/** 头衔的项目门槛子句（第 8 级有两条：T6×1 且 T5+×2）。 */
function wikiProjTextOf(rank) {
  const parts = [];
  if (rank.projTierReq) parts.push('T' + rank.projTierReq + ' 结题 ×' + (rank.projCountReq || 1));
  if (rank.projTierReq2) parts.push('T' + rank.projTierReq2 + ' 及以上结题 ×' + rank.projCountReq2);
  return parts.length ? parts.join(' 且 ') : '无';
}

/** 第 2 章逐项表：key 与 ui-smoke 的防漂移表一一对应（缺一个，断言就会红）。 */
const WIKI_INTEGRITY_ROWS = [
  ['grabFirst', '抢学生的一作（每篇）'],
  ['buyFirst', '购买一作（每篇）'],
  ['fake', '造假蒙混过一个难点'],
  ['fakeCaught', '造假被抓（在造假之上再扣）'],
  ['divert', '多人攻坚挪用其他项目'],
  ['audit', '校级审查'],
  ['extreme', '学生极端事件离组'],
  ['finishProject', '国家项目按期结题'],
  ['finishEnterprise', '企业横向按期交付'],
  ['graduate', '学生顺利毕业'],
  ['promote', '晋升一级头衔'],
  ['noWage', '连续 ' + NO_WAGE_MONTHS_THRESHOLD + ' 个月不发工资（每月）'],
  ['overdue', '项目逾期（每月）'],
  ['projectFail', '项目逾期失败'],
  ['giveUpStudent', '学生肄业离组'],
];

export function selectWiki(state) {
  const ranks = RANKS.filter(Boolean);
  const firstRank = ranks[0];
  const lastRank = ranks[ranks.length - 1];
  // v1.7.0：亲带上限随头衔走，词条里的 N 必须是**玩家当前头衔**的真实值（不写死）。
  const leadRank = rankOf(state.player.rankIndex);
  const chapters = [];

  /* ── 第 1 章：经费来源 ── */
  chapters.push({
    id: 'money',
    title: '经费来源',
    intro: '经费是唯一能把学生、仪器、耗材串起来的东西。进项与出项都在「上月结算回执」里逐笔列出。',
    rows: [
      wikiRowOf('money.initial', '开局经费', wikiMoneyOf(INITIAL_MONEY)),
      wikiRowOf('money.schoolFund', '学校月度拨款（按头衔）', wikiMoneyOf(schoolFundMonthly(firstRank.index)) + ' → ' + wikiMoneyOf(schoolFundMonthly(lastRank.index)),
        '各头衔的年度校投 ÷ ' + MONTHS_PER_YEAR + ' 个月；年度校投见「晋升门槛」一章'),
      wikiRowOf('money.goldenAge', '黄金年龄额外资助', wikiMulOf(1 + GOLDEN_AGE_MONEY_MUL),
        '年龄不超过该头衔的黄金年龄线时，当月校投额外 +' + wikiPctOf(GOLDEN_AGE_MONEY_MUL) + '（副研究员没有这条）'),
      wikiRowOf('money.depositNation', '国家项目定金', wikiPctOf(DEPOSIT_RATE.nation), '签约即到账：合同额 × ' + wikiPctOf(DEPOSIT_RATE.nation)),
      wikiRowOf('money.depositEnterprise', '企业横向定金', wikiPctOf(DEPOSIT_RATE.enterprise), '签约即到账：合同额 × ' + wikiPctOf(DEPOSIT_RATE.enterprise)),
      wikiRowOf('money.depositToConsumable', '定金里的耗材资金', wikiPctOf(DEPOSIT_TO_CONSUMABLE), '签约时把定金的这一比例同时记进耗材账'),
      wikiRowOf('money.tailNation', '结题尾款（国家）', wikiPctOf(1 - DEPOSIT_RATE.nation) + ' × ' + wikiMulOf(PER_HARDPOINT_TAIL_MUL) + '^未解决难点', '国家项目：合同额 × 70%，每个未解决难点再打一次折'),
      wikiRowOf('money.tailEnterprise', '结题尾款（企业）', wikiPctOf(1 - DEPOSIT_RATE.enterprise) + ' × ' + wikiMulOf(PER_HARDPOINT_TAIL_MUL) + '^未解决难点', '企业横向：合同额 × 60%，每个未解决难点再打一次折'),
      wikiRowOf('money.overdueTail', '逾期再打折', wikiMulOf(UNDERDUE_TAIL_MUL), '逾期项目的尾款在难点折扣之上再乘这个数'),
      wikiRowOf('money.overdueMonthly', '项目逾期（每月）', '诚信 ' + wikiDeltaOf(OVERDUE_INTEGRITY_PER_MONTH) + ' · 学生幸福 ' + wikiDeltaOf(OVERDUE_STUDENT_HAPPY)),
      wikiRowOf('money.consumableUnit', '耗材资金换算', wikiTrim(CONSUMABLE_PRICE_PER_UNIT) + ' 单位 = ' + wikiMoneyOf(CONSUMABLE_PRICE_PER_UNIT), '交付、消耗都走这一本账'),
      wikiRowOf('money.consumableInitial', '开局耗材资金', wikiTrim(INITIAL_CONSUMABLE) + ' 单位'),
      wikiRowOf('money.consumablePack', '采购一批', wikiTrim(CONSUMABLE_BUY_PACK) + ' 单位 = ' + wikiMoneyOf(CONSUMABLE_BUY_PACK * CONSUMABLE_PRICE_PER_UNIT)),
      wikiRowOf('money.consumableLow', '耗材警戒线', wikiTrim(CONSUMABLE_LOW_THRESHOLD) + ' 单位', '低于这条线，顶栏会提醒你先采购再推进月份'),
    ].concat(CONSUME_MODE_ORDER.map((id) => wikiRowOf(
      'money.consume.' + id,
      '消耗模式：' + CONSUME_MODES[id].label,
      '耗材 ' + wikiMulOf(CONSUME_MODES[id].consumeMul) + ' · 进度 ' + wikiMulOf(CONSUME_MODES[id].progressMul) + ' · 幸福 ' + wikiDeltaOf(CONSUME_MODES[id].happyDelta),
      CONSUME_MODES[id].hint))).concat([
      wikiRowOf('money.bankrupt', '课题组解散条件', '连续 ' + BANKRUPT_NEGATIVE_MONTHS + ' 个月经费为负，且耗材资金见底'),
    ]),
  });

  /* ── 第 2 章：诚信值 ── */
  chapters.push({
    id: 'integrity',
    title: '诚信值',
    intro: '诚信是唯一的死线：归零或当场被抓，本局立刻以「被举报」收场。它涨得很慢（结题、毕业、晋升），掉得很快（抢、买、造、查）。',
    rows: [
      wikiRowOf('integrity.initial', '开局诚信', wikiTrim(INITIAL_INTEGRITY)),
      wikiRowOf('integrity.range', '取值范围', wikiTrim(INTEGRITY_MIN) + ' – ' + wikiTrim(INTEGRITY_MAX)),
    ].concat(WIKI_INTEGRITY_ROWS.map(([k, label]) => wikiRowOf('integrity.' + k, label, wikiDeltaOf(INTEGRITY_DELTA[k]))))
      .concat([
        wikiRowOf('integrity.ending', '归零结局', '诚信 ≤ ' + INTEGRITY_MIN + ' 或当场被抓 → 结局「被举报」，本局结束'),
      ]),
  });

  /* ── 第 3 章：晋升门槛 ── */
  chapters.push({
    id: 'ranks',
    title: '晋升门槛',
    intro: '晋升只认你本人的一作与总影响因子。每升一级，招生名额、校投、可接项目上限都跟着涨。',
    rows: ranks.slice(1).map((r) => wikiRowOf(
      'rank.' + r.index,
      r.title,
      '总IF ' + r.ifReq + ' · 一区 ' + r.q1Req + ' · 二区 ' + r.q2Req + ' · 正刊 ' + r.topReq
      + ' · 项目 ' + wikiProjTextOf(r)
      + ' · 名额 硕 ' + r.masterCap + '/博 ' + r.phdCap
      + ' · 校投 ' + wikiMoneyOf(r.schoolFundYear) + '/年'
      + ' · 在研上限 ' + r.concurrentCap + ' 项 · 最高 T' + r.maxProjectTier
      + ' · 亲带上限 ' + r.playerLeadCap + ' 项'
      + (r.goldenAge ? ' · 黄金年龄 ≤ ' + r.goldenAge + ' 岁' : ''))).concat([
      wikiRowOf('rank.promoteIntegrity', '晋升奖励', '诚信 ' + wikiDeltaOf(PROMOTE_INTEGRITY_BONUS)),
      wikiRowOf('rank.academician.age', '院士：年龄门槛', '≥ ' + MIN_ACADEMICIAN_AGE + ' 岁'),
      wikiRowOf('rank.academician.ticket', '院士：推荐票基准', RECOMMEND_TICKET_REQ + ' 张', '每错过一个增选窗口 +' + TICKET_REQ_PER_MISSED_WINDOW + ' 张，上限 ' + TICKET_REQ_MAX + ' 张'),
      wikiRowOf('rank.academician.window', '增选窗口', '每 ' + ELECTION_WINDOW_INTERVAL + ' 个月一次'),
      wikiRowOf('rank.ticket.t6', '推荐票：T' + lastRank.projTierReq + ' 项目结题', '+' + TICKET_PER_T6 + ' 张'),
      wikiRowOf('rank.ticket.t5', '推荐票：T' + lastRank.projTierReq2 + ' 及以上结题', '+' + TICKET_PER_T5 + ' 张'),
      wikiRowOf('rank.ticket.phd', '推荐票：博士毕业', '每 ' + TICKET_PER_PHD_GRADUATES + ' 名博士毕业 +1 张'),
      wikiRowOf('rank.ticket.visit', '推荐票：拜访同行', wikiMoneyOf(TICKET_VISIT_COST) + '/次'),
    ]),
  });

  /* ── 第 4 章：一作三途径 ── */
  chapters.push({
    id: 'firstAuthor',
    title: '一作三途径',
    intro: '晋升门槛数的是「你署名一作」的那几篇，全组论文再多也只算总影响因子。拿一作只有三条路。',
    rows: [
      wikiRowOf('firstAuthor.lead', '亲带（项目卡片「我亲自带」）', '项目推进 ' + wikiMulOf(PLAYER_LEAD_MUL)
        + ' · 每月多 ' + wikiTrim(PLAYER_LEAD_ENERGY_COST) + ' 点精力'
        + ' · 同时最多 ' + leadRank.playerLeadCap + ' 个（随头衔提升；你当前是「' + leadRank.title + '」）',
      '这个项目的论文一作全部归你'),
      wikiRowOf('firstAuthor.grab', '抢学生的一作', '诚信 ' + wikiDeltaOf(INTEGRITY_DELTA.grabFirst) + ' · 该生幸福 ' + wikiDeltaOf(GRAB_FIRST_HAPPY), '心结 ' + GRAB_GRUDGE_MONTHS + ' 个月，每月该生幸福 ' + wikiDeltaOf(GRUDGE_HAPPY_PER_MONTH) + '；一篇只能抢一次，一个人一个月只能抢一篇'),
      wikiRowOf('firstAuthor.buyIntegrity', '买一作的代价', '诚信 ' + wikiDeltaOf(INTEGRITY_DELTA.buyFirst), '花钱买署名，没有真实产出'),
      wikiRowOf('firstAuthor.drought', '一作空窗提醒', '距上次本人一作 ≥ ' + FIRST_AUTHOR_DROUGHT_MONTHS + ' 个月', '顶栏会提示你该弄一篇了；卡在' + firstRank.title + '时这条最要命'),
      wikiRowOf('firstAuthor.ifRange', '影响因子浮动', wikiTrim(IF_RANDOM_LOW) + ' – ' + wikiTrim(IF_RANDOM_HIGH) + ' 倍', '每篇论文的实际 IF 在基准值上按这个区间随机'),
    ].concat(PAPER_TIER_ORDER.map((tier) => wikiRowOf('firstAuthor.buy.' + tier, '买一篇：' + PAPER_TIER_LABELS[tier], wikiMoneyOf(PAPER_BUY_PRICE[tier]))))
      .concat(PAPER_TIER_ORDER.map((tier) => wikiRowOf('firstAuthor.if.' + tier, '期刊基准影响因子：' + PAPER_TIER_LABELS[tier], wikiTrim(JOURNAL_IF_BASE[tier])))),
  });

  /* ── 第 5 章：学生 ── */
  chapters.push({
    id: 'students',
    title: '学生',
    intro: '学生是唯一能把项目推起来的劳动力。他们的幸福度决定产出、毕业进度，以及会不会在某个周一早上不来。',
    rows: [
      wikiRowOf('students.initialHappiness', '开局幸福度', wikiTrim(INITIAL_HAPPINESS)),
      wikiRowOf('students.happinessRange', '幸福度范围', wikiTrim(HAPPINESS_MIN) + ' – ' + wikiTrim(HAPPINESS_MAX), '归零即离组'),
      wikiRowOf('students.study', '学制', '硕士 ' + MASTER_STUDY_MONTHS + ' 个月 · 博士 ' + PHD_STUDY_MONTHS + ' 个月'),
      wikiRowOf('students.degreeMax', '毕业进度上限', wikiTrim(DEGREE_PROGRESS_MAX)),
      wikiRowOf('students.gradPaper', '毕业论文档位', '硕士 ' + PAPER_TIER_LABELS[MASTER_GRAD_PAPER_TIER] + ' · 博士 ' + PAPER_TIER_LABELS[PHD_GRAD_PAPER_TIER]),
      wikiRowOf('students.gradIntegrity', '毕业奖励', '诚信 ' + wikiDeltaOf(GRAD_INTEGRITY_BONUS)),
      wikiRowOf('students.ability', '能力区间', wikiTrim(ABILITY_MIN) + ' – ' + wikiTrim(ABILITY_MAX), '稀有人才上限 ' + wikiTrim(ABILITY_MAX_RARE)),
      wikiRowOf('students.rareRate', '稀有人才出现率', wikiPctOf(RARE_SPAWN_RATE)),
      wikiRowOf('students.rareNames', '稀有人才名字', RARE_TALENTS.map((t) => t.name).join('、')),
      wikiRowOf('students.initialAbility', '开局学生能力', '硕士 ' + wikiTrim(INITIAL_STUDENT_ABILITY_MEAN_SD.master.mean) + ' ± ' + wikiTrim(INITIAL_STUDENT_ABILITY_MEAN_SD.master.sd) + ' · 博士 ' + wikiTrim(INITIAL_STUDENT_ABILITY_MEAN_SD.phd.mean) + ' ± ' + wikiTrim(INITIAL_STUDENT_ABILITY_MEAN_SD.phd.sd)),
      wikiRowOf('students.wage.high', '工资：高', '硕士 ' + wikiMoneyOf(WAGE.master.high) + '/月 · 博士 ' + wikiMoneyOf(WAGE.phd.high) + '/月 · 幸福 ' + wikiDeltaOf(WAGE_HAPPY.high)),
      wikiRowOf('students.wage.mid', '工资：中', '硕士 ' + wikiMoneyOf(WAGE.master.mid) + '/月 · 博士 ' + wikiMoneyOf(WAGE.phd.mid) + '/月 · 幸福 ' + wikiDeltaOf(WAGE_HAPPY.mid)),
      wikiRowOf('students.wage.low', '工资：低', '硕士 ' + wikiMoneyOf(WAGE.master.low) + '/月 · 博士 ' + wikiMoneyOf(WAGE.phd.low) + '/月 · 幸福 ' + wikiDeltaOf(WAGE_HAPPY.low)),
      wikiRowOf('students.wage.none', '工资：无', '硕士 ' + wikiMoneyOf(WAGE.master.none) + '/月 · 博士 ' + wikiMoneyOf(WAGE.phd.none) + '/月 · 幸福 ' + wikiDeltaOf(WAGE_HAPPY.none)),
      wikiRowOf('students.wageExpect', '期望工资档', '能力 ≥ ' + wikiTrim(WAGE_EXPECT_THRESHOLDS.high) + ' 期望「高」 · ≥ ' + wikiTrim(WAGE_EXPECT_THRESHOLDS.mid) + ' 期望「中」', '每差一档，每月幸福 ' + wikiDeltaOf(-GAP_PENALTY)),
      wikiRowOf('students.noWage', '欠薪', '连续 ' + NO_WAGE_MONTHS_THRESHOLD + ' 个月不发工资：每月诚信 ' + wikiDeltaOf(INTEGRITY_DELTA.noWage)),
      wikiRowOf('students.projectStress', '带项目但难点没解决', '每月幸福 ' + wikiDeltaOf(PROJECT_STRESS_HARDPOINT)),
      wikiRowOf('students.idle', '一个项目都不带', '每月幸福 ' + wikiDeltaOf(PROJECT_STRESS_IDLE)),
      wikiRowOf('students.multiProject', '每多带一个项目', '每月幸福 ' + wikiDeltaOf(-MULTI_PROJECT_HAPPY_PENALTY)),
      wikiRowOf('students.regression', '幸福回归', '幸福 > ' + HAPPY_REGRESSION_THRESHOLD + ' 时，每月再 ' + wikiDeltaOf(-HAPPY_REGRESSION_SLOPE) + ' × 超出部分'),
      wikiRowOf('students.finishBonus', '项目结题', '参与学生幸福 ' + wikiDeltaOf(HAPPY_PROJECT_FINISH)),
      wikiRowOf('students.leadBonus', '你亲带的项目', '该项目学生幸福 ' + wikiDeltaOf(HAPPY_LEAD_BONUS)),
      wikiRowOf('students.degreeFormula', '月毕业进度怎么算', '基准 ' + wikiTrim(DEGREE_BASE) + ' × (能力 ÷ ' + wikiTrim(ABILITY_DIVISOR) + ') × 幸福系数 × 项目系数'),
      wikiRowOf('students.degreeHappyCoef', '幸福系数', '幸福 ≤ ' + DEG_HAPPY_LOW_THRESHOLD + ' 时固定 ' + wikiTrim(DEG_HAPPY_LOW) + '；否则 ' + wikiTrim(DEG_HAPPY_COEF_BASE) + ' + ' + wikiTrim(DEG_HAPPY_COEF_SLOPE) + ' × 幸福'),
      wikiRowOf('students.degreeProject', '项目系数', '带项目 ' + wikiTrim(DEG_PROJECT_FACTOR.withProject) + ' · 不带项目 ' + wikiTrim(DEG_PROJECT_FACTOR.withoutProject)),
      wikiRowOf('students.leave', '幸福归零离组', '带走手上项目进度 ' + wikiMulOf(LEAVE_TRANSFER_PROGRESS_MUL), '即该项目进度 −' + wikiPctOf(1 - LEAVE_TRANSFER_PROGRESS_MUL)),
      wikiRowOf('students.poach', '被挖走', '项目进度 ' + wikiMulOf(POACH_PROGRESS_MUL)),
      wikiRowOf('students.extreme', '极端离组', '每月 ' + wikiPctOf(LEAVE_EXTREME_RATE) + ' 概率 · 诚信 ' + wikiDeltaOf(LEAVE_EXTREME_INTEGRITY)),
      wikiRowOf('students.defer', '延毕一年', '幸福 ' + wikiDeltaOf(DEFER_HAPPY) + ' · 之后每月再 ' + wikiDeltaOf(DEFER_HAPPY_PER_MONTH) + ' · 在读月数 +' + DEFER_MONTHS_SUBTRACT, '不占招生名额；硕士最多 ' + DEFER_QUOTA_MASTER + ' 次、博士 ' + DEFER_QUOTA_PHD + ' 次'),
      wikiRowOf('students.deferByBoss', '延毕他（随时可点）', '幸福 ' + wikiDeltaOf(DEFER_BY_BOSS_HAPPY) + ' · 毕业进度 ' + wikiDeltaOf(DEFER_BY_BOSS_PROGRESS), '你亲手拍的板：他会记恨你；不动学制、也不占延毕次数'),
      wikiRowOf('students.giveUp', '肄业离组', '项目进度 ' + wikiMulOf(GIVEUP_PROGRESS_MUL) + ' · 诚信 ' + wikiDeltaOf(INTEGRITY_DELTA.giveUpStudent)),
    ],
  });

  /* ── 第 6 章：实验室空间 ── */
  chapters.push({
    id: 'lab',
    title: '实验室空间',
    intro: '仪器不是想买就能摆：房间、台位、台面格子决定了你能同时拥有多少设备。',
    rows: [
      wikiRowOf('lab.rooms', '实验室', ROOMS.length + ' 间', '每间 ' + ROOM_SLOTS + ' 个台位（' + ROOM_SLOT_COLS + ' 列平面）'),
      wikiRowOf('lab.start', '开局台面', START_BENCHES.length + ' 张标准实验台', '仪器加成合计 ' + wikiPctOf(START_INST_BONUS)),
      wikiRowOf('lab.sell', '出售退款', wikiPctOf(SELL_REFUND_RATE), '仪器与实验台都按这个比例回收'),
      wikiRowOf('lab.storage', '仓库口径', '不提供加成 · 不收维护费', '仓库里的仪器不参与任何科研计算'),
    ].concat(ROOMS.map((r) => wikiRowOf('lab.room.' + r.id, r.name, r.price ? wikiMoneyOf(r.price) + ' · 需要头衔 ' + rankOf(r.rankGate).title : '开局就有')))
      .concat(BENCHES.map((b) => wikiRowOf('lab.bench.' + b.id, b.name, b.w + '×' + b.h + ' 格 · ' + wikiMoneyOf(b.price) + ' · 需要头衔 ' + rankOf(b.rankGate).title)))
      .concat(INSTRUMENTS.map((it) => wikiRowOf('lab.item.' + it.id, it.name, wikiMoneyOf(it.price) + ' · 维护 ' + wikiMoneyOf(it.maintain) + '/月 · 加成 ' + wikiPctOf(it.bonus) + ' · 占格 ' + it.w + '×' + it.h + ' · 需要头衔 ' + rankOf(it.tierGate).title))),
  });

  /* ── 第 7 章：项目与难点 ── */
  chapters.push({
    id: 'projects',
    title: '项目与难点',
    intro: '项目是经费与论文的来源；难点是项目推进路上的概率题。三处理方式各有一本账。',
    rows: [
      wikiRowOf('projects.slots', '市场席位', '项目 ' + PROJECT_SLOTS + ' 个 · 候选人 ' + STUDENT_SLOTS + ' 个', '合计 ' + MARKET_SLOTS + ' 个席位'),
      wikiRowOf('projects.refresh', '每月刷新', REFRESH_MONTHLY + ' 个新本子', '项目全年可接，不随招生季开关'),
      wikiRowOf('projects.ttl', '挂太久会撤走', '项目 ' + PROJECT_OFFER_TTL_MONTHS + ' 个月 · 候选人 ' + STUDENT_OFFER_TTL_MONTHS + ' 个月'),
      wikiRowOf('projects.nationRatio', '国家项目占比', wikiPctOf(NATION_PROJECT_RATIO)),
      wikiRowOf('projects.concurrent', '在研上限 / 可接最高等级', '在研 ' + firstRank.concurrentCap + '–' + lastRank.concurrentCap + ' 项 · 最高 T' + firstRank.maxProjectTier + '–T' + lastRank.maxProjectTier, '按当前头衔判定，见「晋升门槛」'),
      wikiRowOf('projects.maxPerStudent', '一人最多同时带', MAX_PROJECTS_PER_STUDENT + ' 个项目', '带得越多，单个项目分到的产能越少'),
      wikiRowOf('projects.maxStudents', '一个项目最多收', PROJECT_MAX_STUDENTS + ' 人'),
      wikiRowOf('projects.hardpointCount', '难点数量', hardpointCount(firstRank.projTierReq) + ' – ' + hardpointCount(lastRank.projTierReq) + ' 个', '难度与数量随项目等级上升'),
      wikiRowOf('projects.progressPenalty', '未解决难点：进度惩罚', '每级难度 → 进度 ' + wikiMulOf(1 - HARDPOINT_PROGRESS_PENALTY_PER_HD)),
      wikiRowOf('projects.paperDowngrade', '未解决难点：论文降档', '每个未解决难点降 ' + HARDPOINT_PAPER_DOWNGRADE + ' 档'),
      wikiRowOf('projects.studentProgress', '学生月进度', wikiTrim(BASE_PROGRESS) + ' × (能力 ÷ ' + wikiTrim(ABILITY_DIVISOR) + ') × 幸福系数 ÷ 在研项目数 × 耗材倍率 × (1 + 仪器加成)'),
      wikiRowOf('projects.retry', '难点重试', '每次 +' + wikiPctOf(HARDPOINT_RETRY_BONUS) + '，上限 +' + wikiPctOf(HARDPOINT_RETRY_CAP)),
      wikiRowOf('projects.team', '多人攻坚', '至少 ' + TEAM_MIN_STUDENTS + ' 人 · 花 ' + wikiMoneyOf(TEAM_MONEY) + ' · 耗时 ' + TEAM_MONTHS + ' 个月', '其他项目进度 ' + wikiPctOf(TEAM_OTHER_PROJECT_MUL) + ' · 每人幸福 ' + wikiDeltaOf(TEAM_STUDENT_HAPPY)),
      wikiRowOf('projects.teamChance', '多人攻坚成功率', wikiPctOf(TEAM_SUCCESS_BASE) + ' + ' + wikiPctOf(TEAM_SUCCESS_PER_STUDENT) + ' × 人数 + ' + wikiTrim(TEAM_SUCCESS_ABILITY_COEF) + ' × (平均能力 − ' + wikiTrim(TEAM_SUCCESS_ABILITY_REF) + ')', '夹在 ' + wikiPctOf(TEAM_SUCCESS_CLAMP[0]) + ' – ' + wikiPctOf(TEAM_SUCCESS_CLAMP[1])),
      wikiRowOf('projects.fake', '造假蒙混', '花 ' + wikiMoneyOf(FAKE_MONEY) + ' · 诚信 ' + wikiDeltaOf(FAKE_INTEGRITY) + ' · 该生幸福 ' + wikiDeltaOf(FAKE_STUDENT_HAPPY)),
      wikiRowOf('projects.fakeCatch', '造假被抓概率', wikiPctOf(FAKE_CATCH_BASE) + ' + ' + wikiPctOf(FAKE_CATCH_PER_PROJECT) + ' × 本项目造假次数 + ' + wikiPctOf(FAKE_CATCH_GLOBAL) + ' × 全局造假次数', '上限 ' + wikiPctOf(FAKE_CATCH_CAP)),
      wikiRowOf('projects.fakeCaught', '造假被抓', '诚信 ' + wikiDeltaOf(FAKE_CAUGHT_INTEGRITY) + ' · 该项目进度 ' + wikiMulOf(1 + FAKE_CAUGHT_PROGRESS_MUL), '被抓后诚信 ≤ ' + CAUGHT_BAD_ENDING_INTEGRITY + ' 当场判「被举报」'),
      wikiRowOf('projects.audit', '校级审查', '累计造假 ' + AUDIT_TRIGGER_FAKE_COUNT + ' 次后，每月 ' + wikiPctOf(AUDIT_MONTHLY_CHANCE) + ' 概率 · 诚信 ' + wikiDeltaOf(AUDIT_INTEGRITY)),
      wikiRowOf('projects.solo', '单人猛干', '花 ' + wikiMoneyOf(SOLO_MONEY) + ' · 该生幸福 ' + wikiDeltaOf(SOLO_STUDENT_HAPPY)),
      wikiRowOf('projects.soloChance', '单人猛干成功率', wikiTrim(SOLO_SUCCESS_ABILITY_COEF) + ' × 能力 ' + wikiDeltaOf(SOLO_SUCCESS_BASE), '夹在 ' + wikiPctOf(SOLO_SUCCESS_CLAMP[0]) + ' – ' + wikiPctOf(SOLO_SUCCESS_CLAMP[1])),
      wikiRowOf('projects.soloFail', '单人猛干失败', '该生幸福 ' + wikiDeltaOf(SOLO_FAIL_HAPPY)),
      wikiRowOf('projects.fail', '项目失败', '诚信 ' + wikiDeltaOf(PROJECT_FAIL_INTEGRITY) + ' · 参与学生幸福 ' + wikiDeltaOf(PROJECT_FAIL_STUDENT_HAPPY)),
    ].concat(PROJECTS.map((p) => wikiRowOf('projects.tpl.' + p.id, p.name, 'T' + p.tier + ' · 工作量 ' + p.workload + ' · 期限 ' + p.limitMonths + ' 个月 · 合同 ' + wikiMoneyOf(p.money) + ' · 定金 ' + wikiPctOf(p.depositRate)))),
  });

  /* ── 第 8 章：人才市场 ── */
  chapters.push({
    id: 'market',
    title: '人才市场',
    intro: '招生季一年只开几个月：两条池子、按能力标价的招募费、以及一个只看组内总 IF 的门槛。',
    rows: [
      wikiRowOf('market.season', '招生季', '每年 ' + MARKET_OPEN_MONTHS[0] + '–' + MARKET_OPEN_MONTHS[MARKET_OPEN_MONTHS.length - 1] + ' 月'),
      wikiRowOf('market.pools', '两条池子', '保研生 ' + POOL_TRANSLATE_MONTHS[0] + '–' + POOL_TRANSLATE_MONTHS[POOL_TRANSLATE_MONTHS.length - 1] + ' 月 · 考研生 ' + POOL_EXAM_MONTHS[0] + '–' + POOL_EXAM_MONTHS[POOL_EXAM_MONTHS.length - 1] + ' 月'),
      wikiRowOf('market.poolCap', '池子上限', POOL_CAP + ' 人'),
      wikiRowOf('market.perMonth', '每月最多招', RECRUIT_PER_MONTH + ' 人'),
      wikiRowOf('market.costTranslate', '保研生招募费', wikiMoneyOf(RECRUIT_COST.translate.base) + ' + ' + wikiMoneyOf(RECRUIT_COST.translate.perAbility) + ' × 能力'),
      wikiRowOf('market.costExam', '考研生招募费', wikiMoneyOf(RECRUIT_COST.exam.base) + ' + ' + wikiMoneyOf(RECRUIT_COST.exam.perAbility) + ' × 能力'),
      wikiRowOf('market.reqIfTranslate', '保研生 IF 门槛', '（能力 − ' + wikiTrim(REQ_IF_BASE_ABILITY) + '）× ' + REQ_IF_WEIGHT.translate),
      wikiRowOf('market.reqIfExam', '考研生 IF 门槛', '（能力 − ' + wikiTrim(REQ_IF_BASE_ABILITY) + '）× ' + REQ_IF_WEIGHT.exam),
      wikiRowOf('market.reqRank', '门槛显示的头衔', '每 ' + REQ_RANK_PER_IF + ' 点 IF 折一级', '最多显示到第 ' + REQ_RANK_CAP + ' 级（只影响展示）'),
      wikiRowOf('market.abilityTranslate', '保研生能力分布', wikiTrim(ABILITY_TRANSLATE_MEAN_SD.mean) + ' ± ' + wikiTrim(ABILITY_TRANSLATE_MEAN_SD.sd)),
      wikiRowOf('market.abilityExam', '考研生主群能力', wikiTrim(ABILITY_EXAM_MEAN_SD.mean) + ' ± ' + wikiTrim(ABILITY_EXAM_MEAN_SD.sd)),
      wikiRowOf('market.abilityDarkhorse', '考研生黑马', wikiTrim(ABILITY_DARKHORSE_MEAN_SD.mean) + ' ± ' + wikiTrim(ABILITY_DARKHORSE_MEAN_SD.sd), '占考研生 ' + wikiPctOf(ABILITY_DARKHORSE_RATE)),
      wikiRowOf('market.rare', '稀有人才', '出现率 ' + wikiPctOf(RARE_SPAWN_RATE) + ' · 能力上限 ' + wikiTrim(ABILITY_MAX_RARE), RARE_TALENTS.map((t) => t.name).join('、')),
      wikiRowOf('market.quota', '招生名额（按头衔）', '硕士 ' + firstRank.masterCap + '–' + lastRank.masterCap + ' · 博士 ' + firstRank.phdCap + '–' + lastRank.phdCap),
      wikiRowOf('market.initial', '开局队伍', '硕士 ' + INITIAL_MASTER_COUNT + ' 名 · 博士 ' + INITIAL_PHD_COUNT + ' 名'),
    ],
  });

  /* ── 第 9 章：行动 · 精力 · 健康 ── */
  chapters.push({
    id: 'actions',
    title: '行动 · 精力 · 健康',
    intro: '一个月里你能花的只有精力。精力上限由健康决定；健康只掉不涨，除非你去锻炼。',
    rows: [
      wikiRowOf('actions.initialHealth', '开局健康', wikiTrim(INITIAL_HEALTH), '上限 ' + wikiTrim(HEALTH_MAX)),
      wikiRowOf('actions.healthDecay', '健康每月', wikiDeltaOf(-HEALTH_DECAY_PER_MONTH), '不锻炼就会一路掉到住院'),
      wikiRowOf('actions.energyMax', '精力上限', wikiTrim(ENERGY_MAX_BASE) + ' + 健康档位 × ' + wikiTrim(ENERGY_PER_HEALTH_10), '健康每上一个档位，上限 +' + wikiTrim(ENERGY_PER_HEALTH_10)),
      wikiRowOf('actions.energyLowHealth', '健康 ≤ ' + ENERGY_LOW_HEALTH_THRESHOLD + ' 时', '精力上限 ' + wikiMulOf(ENERGY_LOW_HEALTH_MUL), '带病上阵，能干的事直接减半'),
      wikiRowOf('actions.randomEvents', '每月随机事件', RANDOM_EVENTS_PER_MONTH_MIN + '–' + RANDOM_EVENTS_PER_MONTH_MAX + ' 个'),
      wikiRowOf('actions.lifeSpan', '一局长度', '开局 ' + START_AGE_YEARS + ' 岁 · 第 ' + RETIRE_MONTH + ' 个月（' + RETIRE_AGE_YEARS + ' 岁）强制退休'),
      wikiRowOf('actions.talkEffect', '交流课题的效果', '项目进度 +' + TALK_PROJECT_PROGRESS + ' · 该生幸福 ' + wikiDeltaOf(TALK_HAPPY) + ' · 毕业进度 +' + TALK_DEGREE),
      wikiRowOf('actions.meetingEffect', '开组会的效果', '全组项目 +' + MEETING_PROJECT_PROGRESS + ' · 全组幸福 ' + wikiDeltaOf(HAPPY_ACTION_MEETING), '同月重复开会：每月依次 ' + MEETING_CREW_MUL.map((m) => wikiMulOf(m)).join(' / ')),
      wikiRowOf('actions.exerciseEffect', '锻炼与享乐的效果', '健康 ' + wikiDeltaOf(EXERCISE_HEALTH), '健康 ≥ ' + EXERCISE_HEALTH_HIGH_THRESHOLD + ' 时改为 ' + wikiDeltaOf(EXERCISE_HEALTH_HIGH)),
      wikiRowOf('actions.teambuildEffect', '团建的效果', '全组幸福 ' + wikiDeltaOf(HAPPY_ACTION_TEAMBUILD) + ' · 每人 ' + wikiMoneyOf(TEAMBUILD_COST_PER_STUDENT)),
    ].concat(ACTION_DEFS.map((a) => wikiRowOf(
      'actions.def.' + a.id,
      a.name,
      '精力 ' + a.energyCost + ' · 经费 ' + (a.moneyCost === 'perStudent' ? '每人 ' + wikiMoneyOf(TEAMBUILD_COST_PER_STUDENT) : wikiMoneyOf(a.moneyCost))
      + ' · ' + (a.limitPerMonth === 'perStudent'
        ? '每名学生每月 ' + TALK_PER_STUDENT_PER_MONTH + ' 次'
        : (a.limitPerMonth > ACTION_DEFS.length * TALK_PER_STUDENT_PER_MONTH ? '次数不限' : '每月 ' + a.limitPerMonth + ' 次'))))),
  });

  /* ── 第 10 章：结局 ── */
  const acadHigh = (ENDING_MAP.academician.variants || []).filter((v) => v.id === 'high')[0] || null;
  const acadDark = (ENDING_MAP.academician.variants || []).filter((v) => v.id === 'dark')[0] || null;
  chapters.push({
    id: 'endings',
    title: '结局',
    intro: '这一局只有两种收场：评上，或者以别的方式收摊。坏结局也是结局。',
    rows: [
      wikiRowOf('ending.academician', ENDING_MAP.academician.title, '头衔升到第 ' + MAX_RANK_INDEX + ' 级'),
      wikiRowOf('ending.reported', ENDING_MAP.reported.title, '诚信 ≤ ' + INTEGRITY_MIN + ' 或当场被抓'),
      wikiRowOf('ending.hospital', ENDING_MAP.hospital.title, '健康归零（上限 ' + HEALTH_MAX + ' 掉满即住院）'),
      wikiRowOf('ending.lab_empty', ENDING_MAP.lab_empty.title, '单月离组 ≥ ' + LAB_EMPTY_THRESHOLD + ' 人'),
      wikiRowOf('ending.bankrupt', ENDING_MAP.bankrupt.title, '连续 ' + BANKRUPT_NEGATIVE_MONTHS + ' 个月经费为负且耗材见底'),
      wikiRowOf('ending.industry', ENDING_MAP.industry.title, '主动结束本局（顶栏「下海」，要先确认）'),
      wikiRowOf('ending.almost', ENDING_MAP.almost.title, '卡在' + RANKS[MAX_RANK_INDEX - 1].title + '又错过最后一个增选窗口'),
      wikiRowOf('ending.retire', ENDING_MAP.retire.title, '第 ' + RETIRE_MONTH + ' 个月（' + RETIRE_AGE_YEARS + ' 岁）'),
    ].concat([
      wikiRowOf('ending.count', '结局总数', ENDINGS.length + ' 个'),
      wikiRowOf('ending.variant.high', '院士 · 圆满变体', acadHigh ? '诚信 ≥ ' + acadHigh.cond.all[0].value + ' 且毕业 ≥ ' + acadHigh.cond.all[1].value + ' 人' : WIKI_NONE),
      wikiRowOf('ending.variant.dark', '院士 · 暗线变体', acadDark ? '诚信 < ' + acadDark.cond.value : WIKI_NONE),
    ]),
  });

  const chaptersWithNo = chapters.map((c, i) => ({ no: i + 1, id: c.id, title: c.title, intro: c.intro, rows: c.rows }));
  return { count: chaptersWithNo.length, chapters: chaptersWithNo };
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

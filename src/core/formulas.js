/**
 * formulas.js —— 纯计算函数（无副作用、不改 state、不产生随机）
 *
 * 约定（docs/CONTRACT.md §3.2）：
 *   · 所有函数都是「读参数 → 返回数字/对象」；需要随机时由调用方把 rng 传进来。
 *   · 不允许魔法数字：一切常量从 src/data/ 取。
 */

import {
  ENERGY_MAX_BASE, ENERGY_PER_HEALTH_10, ENERGY_LOW_HEALTH_THRESHOLD, ENERGY_LOW_HEALTH_MUL,
  CONSUME_MODES,
} from '../data/tuning.js';
import { INSTRUMENTS, INSTRUMENT_MAP, INST_PRICE_GROWTH, INST_BONUS_CAP, TEMP_BROKEN_BONUS_MUL } from '../data/instruments.js';
import { PROJECT_MAP, PER_HARDPOINT_TAIL_MUL, UNDERDUE_TAIL_MUL } from '../data/projects.js';
import {
  RECRUIT_COST, REQ_IF_WEIGHT, REQ_RANK_CAP, REQ_IF_BASE_ABILITY, REQ_RANK_PER_IF,
} from '../data/market.js';
import {
  BASE_PROGRESS, ABILITY_DIVISOR, HAPPY_COEF_BASE, HAPPY_COEF_SLOPE,
  PLAYER_LEAD_MUL, PROGRESS_PCT_DENOM_PER_HARDPOINT, HARDPOINT_PROGRESS_PENALTY_PER_HD,
  HARDPOINT_RETRY_BONUS, HARDPOINT_RETRY_CAP, HARDPOINT_HD_DIST,
  TEAM_SUCCESS_BASE, TEAM_SUCCESS_PER_STUDENT, TEAM_SUCCESS_ABILITY_COEF, TEAM_SUCCESS_ABILITY_REF,
  TEAM_SUCCESS_CLAMP, SOLO_SUCCESS_ABILITY_COEF, SOLO_SUCCESS_BASE, SOLO_SUCCESS_CLAMP,
  FAKE_CATCH_BASE, FAKE_CATCH_PER_PROJECT, FAKE_CATCH_GLOBAL, FAKE_CATCH_CAP,
} from '../data/hardpoints.js';
import {
  WAGE, WAGE_INDEX, WAGE_HAPPY, GAP_PENALTY, WAGE_EXPECT_THRESHOLDS,
  DEGREE_BASE, DEG_HAPPY_COEF_BASE, DEG_HAPPY_COEF_SLOPE, DEG_HAPPY_LOW, DEG_HAPPY_LOW_THRESHOLD,
  DEG_PROJECT_FACTOR, HAPPY_REGRESSION_THRESHOLD, HAPPY_REGRESSION_SLOPE, HAPPINESS_MAX, HAPPINESS_MIN,
  PROJECT_STRESS_HARDPOINT, PROJECT_STRESS_IDLE, MULTI_PROJECT_HAPPY_PENALTY,
} from '../data/students.js';
import { RANKS, rankOf, RECOMMEND_TICKET_REQ, TICKET_REQ_PER_MISSED_WINDOW, TICKET_REQ_MAX } from '../data/ranks.js';
import { JOURNAL_IF_BASE, IF_RANDOM_LOW, IF_RANDOM_HIGH, IF_ROUND_DECIMALS } from '../data/papers.js';
import { FIRST_AUTHOR_DROUGHT_MONTHS } from '../data/tuning.js';
import { clamp, round } from './rng.js';

/* ══ 精力 ══ */
export function energyMax(state) {
  const health = state.player.health;
  const bonus = state.player.energyMaxDelta || 0;
  const raw = ENERGY_MAX_BASE + Math.floor(health / 10) * ENERGY_PER_HEALTH_10 + bonus;
  const mult = health <= ENERGY_LOW_HEALTH_THRESHOLD ? ENERGY_LOW_HEALTH_MUL : 1;
  return Math.max(1, Math.floor(raw * mult));
}

/* ══ 耗材模式 ══ */
export function consumeMode(state) {
  return CONSUME_MODES[state.player.consumeMode] || CONSUME_MODES.normal;
}

/* ══ 仪器 ══ */
function instrumentDef(id) {
  return INSTRUMENT_MAP[id];
}

function isDown(lab, id) {
  return (lab.equipmentDown && lab.equipmentDown[id] > 0) || false;
}

/** 单台价：1.1 起固定价（LAB-SPACE §5，INST_PRICE_GROWTH = 1）；ownedCount 仅为兼容旧调用。 */
export function instrumentPrice(id, ownedCount) {
  const def = instrumentDef(id);
  if (!def) return Infinity;
  return round(def.price * Math.pow(INST_PRICE_GROWTH, Math.max(0, Number(ownedCount) || 0)), 2);
}

function bonusRawSum(lab) {
  let sum = 0;
  for (const def of INSTRUMENTS) {
    const count = Number((lab.equipment && lab.equipment[def.id]) || 0);
    if (count <= 0) continue;
    const mul = isDown(lab, def.id) ? TEMP_BROKEN_BONUS_MUL : 1;
    sum += def.bonus * count * mul;
  }
  return sum;
}

/**
 * 全实验室仪器加成的【未截断】总和。
 * 界面必须同时拿到它与 equipmentBonus，才能说清「已经封顶」——
 * 否则玩家买第 9 台仪器时加成不动，会以为新楼层/新仪器没被算进去。
 */
export function equipmentBonusSum(lab) {
  return round(bonusRawSum(lab), 4);
}

/** 全实验室仪器加成（停机仪器按 TEMP_BROKEN_BONUS_MUL 折算），上限 INST_BONUS_CAP。 */
export function equipmentBonus(lab) {
  return round(Math.min(bonusRawSum(lab), INST_BONUS_CAP), 4);
}

/** 每月仪器维护费（停机的仪器不收费：坏了就不用校准）。 */
export function maintenanceTotal(lab) {
  let sum = 0;
  for (const def of INSTRUMENTS) {
    const count = Number((lab.equipment && lab.equipment[def.id]) || 0);
    if (count <= 0 || isDown(lab, def.id)) continue;
    sum += def.maintain * count;
  }
  return round(sum, 3);
}

/** 项目要求是否满足（缺哪些仪器）。 */
export function missingInstruments(lab, require) {
  const missing = [];
  for (const [id, need] of Object.entries(require || {})) {
    const have = Number((lab.equipment && lab.equipment[id]) || 0);
    if (have < need) missing.push({ id, need, have });
  }
  return missing;
}

/** 校投：等级 schoolFundYear 万/年 → 每月。 */
export function schoolFundMonthly(rankIndex) {
  return round(rankOf(rankIndex).schoolFundYear / 12, 3);
}

/* ══ 学生产出 ══ */
export function abilityCoef(ability) {
  return ability / ABILITY_DIVISOR;
}

export function happyCoef(happiness) {
  return HAPPY_COEF_BASE + HAPPY_COEF_SLOPE * happiness;
}

/**
 * 学生对该项目的月进度（未乘耗材/仪器系数）。
 *
 * t30 产出守恒：一个学生的月产能是有限的，被分到 N 个项目时就按 N 等分——
 * 「1 个人做 3 个项目」的总产出 = 「做 1 个项目」的总产出，而不是旧实现的 ×3
 *（旧实现让「把所有人塞进所有项目」成为无脑最优解，也让「多接项目」没有代价）。
 * @param {any} student
 * @param {any} project
 * @param {{projectCount?:number}} [ctx] 该生本月在研项目数（≥1；缺省 1）
 */
export function studentBaseProgress(student, project, ctx) {
  let p = BASE_PROGRESS * abilityCoef(student.ability) * happyCoef(student.happiness);
  if (project && project.playerLeading) p *= PLAYER_LEAD_MUL;
  const n = ctx && Number.isFinite(ctx.projectCount) && ctx.projectCount > 0 ? ctx.projectCount : 1;
  return p / n;
}

/**
 * 月度进度乘子（耗材 + 仪器 + 未解决难点）。
 * @param {{consumable:number, lab:any, project:any, consumeMul:number}} ctx
 */
export function progressMultiplier(ctx) {
  const consumePart = ctx.consumable <= 0 ? 0 : ctx.consumeMul;
  const instPart = 1 + equipmentBonus(ctx.lab);
  const worstHd = worstOpenHardpoint(ctx.project);
  const hpPart = 1 - HARDPOINT_PROGRESS_PENALTY_PER_HD * worstHd;
  return round(Math.max(0, consumePart * instPart * hpPart), 4);
}

/** 未解决难点里「最重的那个」的难度（hd）；没有则 0。 */
export function worstOpenHardpoint(project) {
  if (!project || !Array.isArray(project.hardpoints)) return 0;
  let worst = 0;
  for (const hp of project.hardpoints) {
    if (hp.status === 'open' && hp.hd > worst) worst = hp.hd;
  }
  return worst;
}

export function openHardpointCount(project) {
  if (!project || !Array.isArray(project.hardpoints)) return 0;
  return project.hardpoints.filter((h) => h.status === 'open').length;
}

/** 总进度百分比（分母 = workload × (1 + 0.10 × project.tier)）。 */
export function projectProgressPct(project) {
  const denom = project.workload * (1 + PROGRESS_PCT_DENOM_PER_HARDPOINT * project.tier);
  if (denom <= 0) return 100;
  return round(clamp((project.progress / denom) * 100, 0, 100), 1);
}

export function isProjectComplete(project) {
  return project.progress >= project.workload;
}

/** 结题尾款（未解决难点逐个打折，逾期再打折）。 */
export function projectTail(project) {
  const base = project.money * (1 - project.depositRate);
  const openHp = openHardpointCount(project);
  let tail = base * Math.pow(PER_HARDPOINT_TAIL_MUL, openHp);
  if (project.overdueMonths > 0) tail *= UNDERDUE_TAIL_MUL;
  return round(Math.max(0, tail), 3);
}

/** 学生月毕业进度。 */
export function degreePerMonth(student, hasProject, ctx) {
  const happyFactor = student.happiness < DEG_HAPPY_LOW_THRESHOLD
    ? DEG_HAPPY_LOW
    : DEG_HAPPY_COEF_BASE + DEG_HAPPY_COEF_SLOPE * student.happiness;
  const projFactor = hasProject ? DEG_PROJECT_FACTOR.withProject : DEG_PROJECT_FACTOR.withoutProject;
  const consumePart = ctx && ctx.consumable <= 0 ? 0 : 1;
  return round(DEGREE_BASE * abilityCoef(student.ability) * happyFactor * projFactor * consumePart, 3);
}

/* ══ 幸福度 ══ */
/** 能力对应的「期望工资档」（天赋越高越需要高工资，SPEC 方向）。 */
export function expectedWageTier(ability, shift = 0) {
  let tier = ability >= WAGE_EXPECT_THRESHOLDS.high ? 3 : (ability >= WAGE_EXPECT_THRESHOLDS.mid ? 2 : 1);
  tier = Math.max(0, Math.min(3, tier + Math.round(shift || 0)));
  return ['none', 'low', 'mid', 'high'][tier];
}

export function wageCost(student) {
  const table = WAGE[student.degree] || WAGE.master;
  return Number(table[student.wageTier] || 0);
}

/**
 * 一名学生本月的幸福度变化（不含行动/事件类加成）。
 * @param {any} student
 * @param {{consumeHappy:number, hasProject:boolean, hasOpenHardpoint:boolean, assignedProjectCount?:number}} ctx
 *   assignedProjectCount = 该生本月在研项目数（由 engine 传入 loadByStudent 的同一个计数）。
 */
export function happinessDelta(student, ctx) {
  const expected = expectedWageTier(student.ability, student.wageExpectShift || 0);
  const gap = WAGE_INDEX[expected] - WAGE_INDEX[student.wageTier];
  let d = WAGE_HAPPY[student.wageTier] || 0;
  // t47 修复符号：期望与实际差几档就扣几档（GAP_PENALTY 是「每差一档扣多少」的正数常量）。
  // 旧实现写成 `d += GAP_PENALTY * gap`，等于「欠薪反而更幸福」，与 SPEC「高工资增加幸福度、
  // 低工资降低幸福度、无工资大幅降低」方向相反，还制造了「克扣最好的学生」这一支配策略。
  // 坚持把符号放在**减号**上（而不是把常量改成负数、或翻转 gap 的方向）：常量名 GAP_PENALTY
  // 的语义就是惩罚，`-=` 与它自洽；若常量变成负数，后人看到「PENALTY 是负的」更容易当笔误改回去。
  d -= GAP_PENALTY * gap;
  d += ctx.consumeHappy || 0;
  d += ctx.hasProject ? (ctx.hasOpenHardpoint ? PROJECT_STRESS_HARDPOINT : 0) : PROJECT_STRESS_IDLE;
  // t42（B 方案，主理人拍板）：同一名学生带 n 个在研项目时，每月额外 −(n−1)× 惩罚。
  // n=0（无项目）不吃这条，仍走上面的 PROJECT_STRESS_IDLE；惩罚与 grudge/defer 独立叠加。
  const projectLoad = Number.isFinite(ctx.assignedProjectCount) ? ctx.assignedProjectCount : 0;
  d -= Math.max(0, projectLoad - 1) * MULTI_PROJECT_HAPPY_PENALTY;
  if (student.grudgeMonths > 0) d -= 2;
  if (student.deferMonths > 0) d -= 1;
  if (student.happiness > HAPPY_REGRESSION_THRESHOLD) {
    d -= (student.happiness - HAPPY_REGRESSION_THRESHOLD) * HAPPY_REGRESSION_SLOPE;
  }
  return round(d, 3);
}

export function clampHappiness(v) {
  return Math.round(clamp(v, HAPPINESS_MIN, HAPPINESS_MAX));
}

/* ══ 人才市场 ══ */
export function hireCost(ability, source) {
  const table = RECRUIT_COST[source] || RECRUIT_COST.translate;
  return round(table.base + table.perAbility * ability, 2);
}

/** 招募门槛：reqIF / reqRank（SPEC：越好的学生要求越高）。 */
export function recruitRequirement(ability, source) {
  const w = REQ_IF_WEIGHT[source] || REQ_IF_WEIGHT.translate;
  const reqIF = Math.max(0, Math.round((ability - REQ_IF_BASE_ABILITY) * w));
  const reqRank = Math.min(REQ_RANK_CAP, 1 + Math.floor(reqIF / REQ_RANK_PER_IF));
  return { reqIF, reqRank };
}

/* ══ 难点 ══ */
/** 难度分布采样：返回 hd（1..3）。 */
export function rollHardpointHd(tier, rng) {
  const dist = HARDPOINT_HD_DIST[Math.max(1, Math.min(6, Math.floor(tier)))] || HARDPOINT_HD_DIST[1];
  const entries = dist.map(([hd, w]) => ({ hd, w }));
  const picked = rng.pickWeighted(entries, (e) => e.w);
  return picked ? picked.hd : 1;
}

export function teamSuccessChance(students, retryBonus = 0) {
  const n = students.length;
  const avg = n > 0 ? students.reduce((s, st) => s + st.ability, 0) / n : 0;
  const raw = TEAM_SUCCESS_BASE + TEAM_SUCCESS_PER_STUDENT * n
    + TEAM_SUCCESS_ABILITY_COEF * (avg - TEAM_SUCCESS_ABILITY_REF) + retryBonus;
  return round(clamp(raw, TEAM_SUCCESS_CLAMP[0], TEAM_SUCCESS_CLAMP[1]), 3);
}

export function soloSuccessChance(ability, retryBonus = 0) {
  const raw = SOLO_SUCCESS_ABILITY_COEF * ability + SOLO_SUCCESS_BASE + retryBonus;
  return round(clamp(raw, SOLO_SUCCESS_CLAMP[0], SOLO_SUCCESS_CLAMP[1]), 3);
}

export function fakeCatchChance(fakeCountInProject, fakesTotal) {
  const raw = FAKE_CATCH_BASE + FAKE_CATCH_PER_PROJECT * fakeCountInProject + FAKE_CATCH_GLOBAL * fakesTotal;
  return round(clamp(raw, 0, FAKE_CATCH_CAP), 3);
}

export function retryBonus(retries) {
  return Math.min(HARDPOINT_RETRY_CAP, HARDPOINT_RETRY_BONUS * retries);
}

/* ══ 论文 ══ */
export function paperIF(tier, rng) {
  const base = JOURNAL_IF_BASE[tier] || 0;
  const roll = rng ? rng.float(IF_RANDOM_LOW, IF_RANDOM_HIGH) : 1;
  return round(base * roll, IF_ROUND_DECIMALS);
}

export function paperScore(papers) {
  return round(
    (papers.top || 0) * JOURNAL_IF_BASE.top + (papers.q1 || 0) * JOURNAL_IF_BASE.q1
    + (papers.q2 || 0) * JOURNAL_IF_BASE.q2 + (papers.q3 || 0) * JOURNAL_IF_BASE.q3
    + (papers.q4 || 0) * JOURNAL_IF_BASE.q4, 1);
}

/* ══ 晋升 ══ */
/**
 * 距离下一级还差什么。
 * @returns {{rank:any, next:any|null, ok:boolean, missing:Array<{key:string,need:number,have:number,text:string}>}}
 */
export function rankStatus(state) {
  const rank = rankOf(state.player.rankIndex);
  const next = state.player.rankIndex >= RANKS.length - 1 ? null : rankOf(state.player.rankIndex + 1);
  if (!next) return { rank, next: null, ok: false, missing: [] };
  const missing = [];
  const p = state.player;
  const push = (key, need, have, text) => {
    if (have < need) missing.push({ key, need, have, text });
  };
  push('totalIF', next.ifReq, round(p.totalIF, 1), '总影响因子 ' + next.ifReq);
  push('q1', next.q1Req, p.papers.q1, '一区论文 ' + next.q1Req + ' 篇');
  push('q2', next.q2Req, p.papers.q2, '二区论文 ' + next.q2Req + ' 篇');
  push('top', next.topReq, p.papers.top, '正刊论文 ' + next.topReq + ' 篇');
  // 项目要求：t30 起支持两条子句（BALANCE §18.10 的 r8 = 「T6×1 且 T5+×2」）。
  const finished = state.projects.filter((pr) => pr.status === 'finished');
  const needTier = (tier) => finished.filter((pr) => pr.tier >= tier).length;
  const clauses = [];
  if (Number(next.projTierReq) > 0) clauses.push({ tier: next.projTierReq, count: next.projCountReq || 1 });
  if (Number(next.projTierReq2) > 0) clauses.push({ tier: next.projTierReq2, count: next.projCountReq2 || 1 });
  for (const clause of clauses) {
    if (needTier(clause.tier) < clause.count) {
      missing.push({
        key: 't' + clause.tier,
        need: clause.count,
        have: needTier(clause.tier),
        text: clause.tier >= 6 ? ('T6 结题 ' + clause.count + ' 项') : ('T' + clause.tier + ' 及以上结题 ' + clause.count + ' 项'),
      });
    }
  }
  return { rank, next, ok: missing.length === 0, missing };
}

/** 当前是否处于增选窗口（每 24 个月一次，研究：院士每两年增选一次）。 */
export function isElectionWindow(state, interval = 24) {
  return state.calendar.monthIndex > 0 && state.calendar.monthIndex % interval === 0;
}

/**
 * 院士推荐票门槛（BALANCE §18.6）：基准 3 张，每错过一个增选窗口 +2 张，上限 9 张。
 * 「错过」= 已经到 rank7 且除票数外的门槛都满足，却在窗口开出时票不够（见 engine.checkElectionWindow）。
 */
export function ticketRequirement(state) {
  const missed = Math.max(0, Math.floor(Number(state.player.missedElectionWindows) || 0));
  return Math.min(RECOMMEND_TICKET_REQ + TICKET_REQ_PER_MISSED_WINDOW * missed, TICKET_REQ_MAX);
}

/** 距最近一次拿到「本人署名一作」的月数（本局还没拿到就从第 0 月起算）。 */
export function monthsSinceOwnFirstAuthor(state) {
  const last = Number(state.player.lastFirstAuthorMonthIndex);
  const now = state.calendar.monthIndex;
  if (!Number.isFinite(last) || last < 0) return Math.max(0, now);
  return Math.max(0, now - last);
}

/** 是否处于「一作空窗」（core 判定，UI 只渲染；阈值见 data/tuning.js 的 FIRST_AUTHOR_DROUGHT_MONTHS）。 */
export function firstAuthorDrought(state) {
  const months = monthsSinceOwnFirstAuthor(state);
  return {
    months,
    threshold: FIRST_AUTHOR_DROUGHT_MONTHS,
    stuck: state.player.rankIndex <= 1 && months >= FIRST_AUTHOR_DROUGHT_MONTHS,
  };
}

/* ══ 工具 ══ */
export function totalStudentsGraduated(state) {
  return (state.player.graduated.master || 0) + (state.player.graduated.phd || 0);
}

export function activeStudents(state) {
  return state.students.filter((s) => !s.left && !s.graduated);
}

export function activeProjects(state) {
  return state.projects.filter((p) => p.status === 'active');
}

export function projectDefOf(project) {
  return PROJECT_MAP[project.defId] || null;
}

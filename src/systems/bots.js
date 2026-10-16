/**
 * bots.js —— 无头策略机器人（src/systems 模拟系统层）
 *
 * 用途：
 *   · scripts/simulate.mjs 用它跑「速通院士 / 中庸经营 / 诚信崩盘」三条路线的曲线与锚点；
 *   · tests/ 的平衡回归断言用它做可重复的数值标定。
 *
 * 分层约定：
 *   · 机器人只通过 engine.reduce() 驱动游戏，绝不直接改 state 字段；
 *   · 只读快照走 formulas/rules 的只读函数；
 *   · 所有随机都来自 state.rng，因此「种子 + 策略」完全可复现。
 */

import { ACTIONS, reduce, pendingDeferStudents } from '../core/engine.js';
import { createState } from '../core/state.js';
import { rankOf } from '../data/ranks.js';
import { PROJECT_MAP, PROJECTS } from '../data/projects.js';
import { INSTRUMENTS, INSTRUMENT_MAP, INST_HOLD_CAP } from '../data/instruments.js';
import { HARDPOINT_METHODS, TEAM_MONEY, SOLO_MONEY, TEAM_MIN_STUDENTS, MAX_PROJECTS_PER_STUDENT } from '../data/hardpoints.js';
import { PAPER_TIER_ORDER } from '../data/papers.js';
import { CONSUME_MODES, CONSUMABLE_PRICE_PER_UNIT, CONSUMABLE_BUY_PACK, MAX_MONTHS } from '../data/tuning.js';
import { WAGE } from '../data/students.js';
import { activeProjects, activeStudents, expectedWageTier, energyMax, projectProgressPct, rankStatus } from '../core/formulas.js';
import { round } from '../core/rng.js';
import { canAcceptOffer, canRecruitOffer, offerReachable } from '../core/rules.js';

/** 三条被验收关注的路线（其余参数都在各自的 cfg 里，可单独调）。 */
export const STRATEGIES = {
  /* 速通院士：全力扩招 + 买设备 + 抢高 IF 项目 + 多人攻坚，必要时买正刊凑 top 门槛。 */
  speedrun: {
    id: 'speedrun', label: '速通院士',
    consumeModePolicy: 'tight',       // 先省钱，钱多了自动切 normal/free
    consumableMonths: 8,
    moneyReserve: 12,
    hire: true, hireMinAbility: 0.35,
    buyEquipment: true,
    projectScore: 'ifPerMonth',
    studentsPerProject: 6,
    hardpointMethod: 'team',
    grabFirstAuthors: false,
    usePlayerLead: true,              // t24：老板一作只能来自亲带 / 买 / 抢
    leadMax: 6,
    exerciseHealthFloor: 80,
    teamBuildHappyFloor: 58,
    keepCrewFloor: 6,
    deferHappyFloor: 45,
    buyFirstAuthorTier: 'top',
    buyFirstAuthorTiers: ['top', 'q1', 'q2'],
    buyFirstAuthorMax: 8,
    integrityFloor: 40,
    acceptRiskyWhenIdle: true,        // 见 acceptProjects：零项目时宁可接个要紧的本子，也不空转
  },
  /* 随手玩：BALANCE §15.3 红线「随手玩通关率 85%–95%」的对照路线。
     正常消耗、不买论文、按 IF/工作量挑本子、攻坚用多人，但不做极限运营。 */
  casual: {
    id: 'casual', label: '随手玩',
    consumeModePolicy: 'adaptive',
    consumableMonths: 6,
    moneyReserve: 20,
    hire: true, hireMinAbility: 0.45,
    buyEquipment: true,
    projectScore: 'ifPerWorkload',
    studentsPerProject: 5,
    hardpointMethod: 'team',
    grabFirstAuthors: false,
    usePlayerLead: true,              // t24：随手玩也会点「我亲自带」，否则一作永远凑不齐
    leadMax: 4,
    exerciseHealthFloor: 72,
    teamBuildHappyFloor: 52,
    keepCrewFloor: 5,
    deferHappyFloor: 45,
    // t30：t24 的一作口径下「随手玩」也得有一条供给链——差正刊/一区时花钱买（诚信 −4/篇）。
    buyFirstAuthorTier: 'top',
    buyFirstAuthorTiers: ['top', 'q1'],
    buyFirstAuthorMax: 3,
    integrityFloor: 30,
  },
  /* 保守经营（t41，BALANCE §18.18 裁定 ③）：填上「保守但合规」的版本化对照配置。
     与 casual 只差『一作来源』一个变量：也亲带，但只亲带 T4+ 值得的本子；缺口才出手、最多买 1 篇；
     绝不抢一作（不碰诚信红线）。其余沿用 casual，保证两条路线可比。
     理由引用户 SPEC：亲带与买一作都是玩家正规动作（SPEC 的三条一作来源），不是为区间调参。 */
  conservative: {
    id: 'conservative', label: '保守经营',
    consumeModePolicy: 'adaptive',
    consumableMonths: 6,
    moneyReserve: 20,
    hire: true, hireMinAbility: 0.45,
    buyEquipment: true,
    projectScore: 'ifPerWorkload',
    studentsPerProject: 5,
    hardpointMethod: 'team',
    grabFirstAuthors: false,          // 保守 = 不碰诚信红线
    usePlayerLead: true,
    leadMinTier: 4,                   // ★ 只对 T4+ 在研项目开亲带
    leadMax: 4,
    exerciseHealthFloor: 72,
    teamBuildHappyFloor: 52,
    keepCrewFloor: 5,
    deferHappyFloor: 45,
    buyFirstAuthorTiers: ['top', 'q1'],
    buyFirstAuthorMax: 1,             // ★ 缺口才出手，只买最关键的 1 篇
    integrityFloor: 30,
  },
  /* 中庸经营：正常消耗、不抢不买、项目挑中等的，先保毕业与稳定。 */
  balanced: {
    id: 'balanced', label: '中庸经营',
    consumeModePolicy: 'adaptive',
    consumableMonths: 4,
    moneyReserve: 25,
    hire: true, hireMinAbility: 0.50,
    buyEquipment: true,
    projectScore: 'ifPerWorkload',
    studentsPerProject: 3,
    hardpointMethod: 'adaptive',
    grabFirstAuthors: false,
    usePlayerLead: false,
    exerciseHealthFloor: 70,
    teamBuildHappyFloor: 50,
    keepCrewFloor: 4,
    deferHappyFloor: 45,
    buyFirstAuthorMax: 0,
    integrityFloor: 30,
  },
  /* 诚信崩盘：蒙混过关 + 抢学生一作，压缩成本换短期产出，直到被举报。 */
  cheater: {
    id: 'cheater', label: '诚信崩盘',
    consumeModePolicy: 'tight',
    consumableMonths: 3,
    moneyReserve: 5,
    hire: true, hireMinAbility: 0.40,
    buyEquipment: false,
    projectScore: 'ifPerMonth',
    studentsPerProject: 3,
    hardpointMethod: 'fake',
    grabFirstAuthors: true,
    usePlayerLead: false,
    exerciseHealthFloor: 0,      // 不锻炼：健康自己往下掉
    teamBuildHappyFloor: 0,
    buyFirstAuthorMax: 0,
    integrityFloor: 0,
  },
};

/* ══════════════ 只读快照 ══════════════ */

export function snapshot(state) {
  const crew = activeStudents(state);
  const active = activeProjects(state);
  return {
    monthIndex: state.calendar.monthIndex,
    year: state.calendar.year,
    month: state.calendar.month,
    totalIF: round(state.player.totalIF, 1),
    rankIndex: state.player.rankIndex,
    rank: rankOf(state.player.rankIndex).title,
    tickets: state.player.tickets,
    q1: state.player.papers.q1 || 0,
    q2: state.player.papers.q2 || 0,
    top: state.player.papers.top || 0,
    papersTotal: PAPER_TIER_ORDER.reduce((n, t) => n + (state.player.papers[t] || 0), 0),
    money: round(state.player.money, 1),
    consumable: round(state.player.consumable, 1),
    health: state.player.health,
    integrity: state.player.integrity,
    students: crew.length,
    activeProjects: active.length,
    finished: state.counters.projectsFinished,
    failed: state.counters.projectsFailed,
    overdueProjects: active.filter((p) => p.overdueMonths > 0).length,
    avgHappiness: crew.length ? round(crew.reduce((s, st) => s + st.happiness, 0) / crew.length, 1) : 0,
    ending: state.ending ? state.ending.id : null,
  };
}

/** 项目 IF/工作量比（锚点指标：国家项目应集中在 0.077–0.105，无支配性最优解）。 */
export function ifPerWorkloadTable() {
  return PROJECTS.map((d) => ({
    id: d.id,
    category: d.category,
    tier: d.tier,
    workload: d.workload,
    limitMonths: d.limitMonths,
    expectedIF: d.expectedIF,
    ifPerWorkload: round(d.expectedIF / d.workload, 4),
    ifPerMonth: round(d.expectedIF / d.limitMonths, 4),
    ifPerSlot: round(d.expectedIF / (d.workload * 0.85), 4),
  }));
}

/* ══════════════ 一个月内的「玩家操作」 ══════════════ */

const send = (state, action) => reduce(state, action);

/** 精力够就用；不够就跳过（静默失败）。 */
function tryAction(state, payload) {
  const before = state.player.energy;
  const next = reduce(state, ACTIONS.doAction({ ...payload, silent: true }));
  return next.player.energy < before ? next : null;
}

function consumableBurn(state) {
  const mode = CONSUME_MODES[state.player.consumeMode] || CONSUME_MODES.normal;
  return activeProjects(state).reduce((sum, p) => sum + p.consumablePerMonth, 0) * mode.consumeMul;
}

function pickConsumeMode(state, cfg) {
  const burn = consumableBurn(state);
  const months = burn > 0 ? state.player.consumable / burn : 99;
  const money = state.player.money;
  // 关键教训：长期 tight 会让全组幸福度 -5/月，实验室会烂掉。
  // 经费在中后期是过剩资源（没有别的去处），所以钱一多就大方花：free = +3 幸福 +15% 效率。
  let want;
  if (months < 1.5) want = 'tight';
  else if (cfg.consumeModePolicy === 'free') want = 'free';
  else if (cfg.consumeModePolicy === 'tight') want = (money > 400 || months > 10) ? 'normal' : 'tight';
  else if (money > 400 && months > 4) want = 'free';
  else if (money > 120) want = 'normal';
  else want = 'tight';
  if (want === state.player.consumeMode) return state;
  return send(state, ACTIONS.setConsumeMode({ mode: want }));
}

function buyConsumables(state, cfg) {
  const burn = consumableBurn(state);
  const target = Math.max(burn * cfg.consumableMonths, 20);
  let need = target - state.player.consumable;
  if (need <= 1) return state;
  need = Math.min(need, 240);            // 一次别买太多
  const price = Number(CONSUMABLE_PRICE_PER_UNIT);
  const affordable = Math.floor((state.player.money - cfg.moneyReserve) / price);
  if (affordable <= 0) return state;
  const amount = Math.min(need, affordable);
  if (amount < CONSUMABLE_BUY_PACK * 0.5) return state;
  return send(state, ACTIONS.buyConsumable({ amount: Math.round(amount) }));
}

/** 需要哪些仪器：未来两级会开出的项目所需的仪器里，还缺的那些。 */
function instrumentWishlist(state) {
  const rank = rankOf(state.player.rankIndex);
  const cap = Math.min(6, rank.maxProjectTier + 2);
  const want = new Map();
  for (const d of PROJECTS) {
    if (d.tier > cap) continue;
    for (const [id, n] of Object.entries(d.require || {})) {
      want.set(id, Math.max(want.get(id) || 0, n));
    }
  }
  return want;
}

function buyEquipment(state, cfg) {
  if (!cfg.buyEquipment) return state;
  const want = instrumentWishlist(state);
  let next = state;
  for (const def of INSTRUMENTS) {
    const need = want.get(def.id) || 0;
    const owned = next.lab.equipment[def.id] || 0;
    if (need === 0 || owned >= Math.min(need, INST_HOLD_CAP)) continue;
    if (next.player.rankIndex < def.tierGate) continue;
    if (next.player.money < def.price * Math.pow(1.6, owned) + cfg.moneyReserve) continue;
    next = send(next, ACTIONS.buyEquipment({ id: def.id }));
  }
  return next;
}

function hireStudents(state, cfg) {
  if (!cfg.hire) return state;
  let next = state;
  for (let i = 0; i < 3; i += 1) {
    const offers = next.market.pool
      .filter((o) => o.kind === 'student')
      .map((o) => ({ o, check: canRecruitOffer(next, o) }))
      .filter((e) => e.check.ok && e.o.ability >= cfg.hireMinAbility
        && next.player.money - e.o.cost > Math.min(cfg.moneyReserve, 10))
      .sort((a, b) => b.o.ability - a.o.ability);
    if (offers.length === 0) return next;
    const offer = offers[0].o;
    const wageTier = expectedWageTier(offer.ability);
    const after = send(next, ACTIONS.hireStudent({ offerId: offer.offerId, wageTier }));
    if (after === next) return next;
    next = after;
  }
  return next;
}

function projectScore(def, cfg, state) {
  if (cfg.projectScore === 'ifPerWorkload') return def.expectedIF / def.workload;
  if (cfg.projectScore === 'cashFirst') return (def.money / def.workload) * 2 + def.expectedIF / def.workload;
  // ifPerMonth：占一个在研名额一个月的产出（速通路线用）
  return def.expectedIF / def.limitMonths;
}

/** 课题组当前每月能往一个项目上推多少进度（估算用，宁可保守）。 */
function estimateMonthlyProgress(state) {
  const crew = activeStudents(state);
  if (crew.length === 0) return 0;
  const avg = crew.reduce((sum, st) => sum + 6.0 * (st.ability / 0.5) * (0.6 + 0.004 * st.happiness), 0) / crew.length;
  const inst = 1 + (state.lab ? (state.lab.equipment ? Object.keys(state.lab.equipment).length * 0 : 1) : 1);
  void inst;
  return avg * 1.45;   // 开局仪器加成 0.45 起，留点余量
}

/** 这个本子按当前人手来得及吗？（保守：按最多 4 个人算，并预留 25% 难点损耗） */
function feasibleProject(state, def, cfg) {
  if (!def || !def.workload) return false;
  const crew = Math.max(1, Math.min(activeStudents(state).length, Math.max(cfg.studentsPerProject, cfg.studentsPerProject)));
  const perMonth = estimateMonthlyProgress(state) * 0.75 * crew;
  return def.workload / perMonth <= def.limitMonths;
}

function acceptProjects(state, cfg) {
  let next = state;
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const cap = rankOf(next.player.rankIndex).concurrentCap;
    if (activeProjects(next).length >= cap) break;
    const ranked = next.market.pool
      .filter((o) => o.kind === 'project' && canAcceptOffer(next, o).ok)
      .map((o) => {
        const def = PROJECT_MAP[o.defId] || o;
        return { o, def, score: projectScore(def, cfg, next), ok: feasibleProject(next, def, cfg) };
      })
      .sort((a, b) => (Number(b.ok) - Number(a.ok)) || (b.score - a.score));
    // 只接「来得及做完」的本子：硬接做不完的项目 = 逾期 -1 诚信/月 + 学生 -2 幸福/月，
    // 最后必然变成失败（-5 诚信）→ 诚信螺旋死亡。宁可让名额空着。
    const best = ranked.find((e) => e.ok);
    if (!best) {
      // t22（T11-F1）暴露的极端状态：市场全年都有 5 个 offer，但玩家可能落到
      // 「只剩 1 个学生 + 招不到人（候选人 reqRank/reqIF 门槛）+ 头衔卡在副研究员」，
      // 此时所有 offer 都判「来不及做完」→ 保守规则变成整整几十个月零产出
      // （实测 t4-01 第 44–67 月、t4-03 第 47–53 月零进展，速通路线中期停滞）。
      // 速度优先配置改为：一个在研项目都没有时，也接一个最接近可行的本子 ——
      // 逾期 -1 诚信/月（100 诚信打底）远比 24 个月零产出划算。
      if (!cfg.acceptRiskyWhenIdle) break;
      if (activeProjects(next).length > 0) break;
      const fallback = ranked[0];
      if (!fallback) break;
      const risky = send(next, ACTIONS.acceptProject({ offerId: fallback.o.offerId }));
      if (risky === next) break;
      next = risky;
      continue;                        // 只补一个：够撑到下一轮刷新人手/设备即可
    }
    const after = send(next, ACTIONS.acceptProject({ offerId: best.o.offerId }));
    if (after === next) break;
    next = after;
  }
  return next;
}

/**
 * t30 产出守恒后的分配上限：一个学生的月产出按「在研项目数」等分，
 * 所以「把一个人挂到 3 个项目」只会把产出摊薄成 1/3（项目全拖期、全逾期）。
 * 机器人策略因此收敛为「每人 1 个项目」，用人数（项目 × 人）换速度，而不是用挂名换。
 */
function maxProjectsPerStudent(cfg) {
  const n = Number(cfg && cfg.studentsProjectCap);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function assignStudents(state, cfg) {
  let next = state;
  // 排序依据 = 「每月还差多少进度」：欠得最多的项目先分人，
  // 否则短工期的小项目会把学生抢光，T6 这类大项目永远结不了题（拿不到 top 论文与推荐票）。
  const requiredRate = (p) => {
    const monthsLeft = Math.max(1, p.deadlineMonthIndex - next.calendar.monthIndex + 1);
    return Math.max(0, p.workload - p.progress) / monthsLeft;
  };
  const order = () => activeProjects(next)
    .slice()
    .sort((a, b) => (b.overdueMonths - a.overdueMonths) || (requiredRate(b) - requiredRate(a)) || (b.tier - a.tier));
  const assignOne = (project, pick) => {
    const after = send(next, ACTIONS.assignStudent({ projectId: project.instanceId, studentId: pick.id }));
    if (after !== next) next = after;
    return after !== next ? false : true;
  };
  // ① 把每个项目填到目标人数（多人攻坚需要 ≥2 人）
  for (const project of order()) {
    const want = Math.max(TEAM_MIN_STUDENTS, cfg.studentsPerProject);
    let guard = 0;
    while ((project.assignedStudentIds || []).length < want && guard < 30) {
      guard += 1;
      const crew = activeStudents(next)
        .slice()
        .sort((a, b) => (a.projectIds.length - b.projectIds.length) || (b.ability - a.ability));
      const pick = crew.find((st) => st.projectIds.length < maxProjectsPerStudent(cfg)
        && !st.projectIds.includes(project.instanceId));
      if (!pick) break;
      assignOne(project, pick);
    }
  }
  // ② 没人带的学生会每月掉幸福度（-3），把他们都挂到项目上
  let guard = 0;
  while (guard < 60) {
    guard += 1;
    const idle = activeStudents(next).filter((st) => st.projectIds.length === 0);
    if (idle.length === 0) break;
    let progressed = false;
    for (const st of idle) {
      if (st.projectIds.length > 0) continue;
      const project = order().find((p) => st.projectIds.length < maxProjectsPerStudent(cfg)
        && !st.projectIds.includes(p.instanceId) && !p.assignedStudentIds.includes(st.id));
      if (!project) continue;
      assignOne(project, st);
      progressed = true;
    }
    if (!progressed) break;
  }
  return next;
}

function resolveHardpoints(state, cfg) {
  let next = state;
  const projects = activeProjects(next)
    .slice()
    .sort((a, b) => (a.overdueMonths - b.overdueMonths) || (a.deadlineMonthIndex - b.deadlineMonthIndex));
  for (const project of projects) {
    const open = project.hardpoints.filter((h) => h.status === 'open' || h.status === 'hidden');
    for (const hp of open) {
      const crew = project.assignedStudentIds
        .map((id) => next.students.find((s) => s.id === id))
        .filter((st) => st && !st.left && !st.graduated);
      let method = cfg.hardpointMethod;
      if (method === 'adaptive') method = crew.length >= TEAM_MIN_STUDENTS ? 'team' : 'solo';
      if (method === 'team' && (crew.length < TEAM_MIN_STUDENTS || next.player.money < TEAM_MONEY + cfg.moneyReserve)) {
        method = crew.length >= 1 && next.player.money >= SOLO_MONEY + cfg.moneyReserve ? 'solo' : null;
      }
      if (method === 'fake' && next.player.money < 1) method = null;
      if (method === 'solo' && (crew.length < 1 || next.player.money < SOLO_MONEY + cfg.moneyReserve)) method = null;
      if (!method) continue;
      const payload = { projectId: project.instanceId, hardpointId: hp.id, method };
      if (method === 'team') payload.studentIds = crew.slice(0, 4).map((st) => st.id);
      if (method === 'solo') payload.studentIds = [crew.slice().sort((a, b) => b.ability - a.ability)[0].id];
      const after = send(next, ACTIONS.resolveHardpoint(payload));
      if (after !== next) next = after;
    }
  }
  return next;
}

/** 从结题台帐里找一篇「该生是一作、还没被抢」的论文（t8 finding ④：抢一作必须点名到篇）。 */
function eligiblePaper(state, studentId) {
  for (const project of state.projects) {
    const list = Array.isArray(project.paperTiers) ? project.paperTiers : [];
    for (const paper of list) {
      if (paper && typeof paper === 'object' && paper.firstAuthorId === studentId && !paper.grabbed) return paper;
    }
  }
  return null;
}

/** 抢学生一作（诚信崩盘路线）：按篇抢；每人每月最多一篇由引擎兜底。 */
function grabFirstAuthors(state, cfg) {
  if (!cfg.grabFirstAuthors) return state;
  let next = state;
  for (const st of activeStudents(next)) {
    if (st.grudgeMonths > 0) continue;
    if (next.player.integrity <= cfg.integrityFloor) break;
    const paper = eligiblePaper(next, st.id);
    if (!paper) continue;
    const after = send(next, ACTIONS.grabFirstAuthor({ studentId: st.id, paperId: paper.paperId, tier: paper.tier }));
    if (after === next) break;
    next = after;
  }
  return next;
}

/**
 * 亲带（game/togglePlayerLead）——t24 一作归属模型下，亲带项目的**全部论文一作归玩家**，
 * 因此它是老板凑 q1/q2/正刊一作门槛的主渠道（引擎的并发上限 = max(1, floor(精力/2))）。
 * 策略：优先亲带等级最高、进度最靠前的在研项目，超上限的旧项目主动撤掉。
 */
function toggleLeads(state, cfg) {
  if (!cfg.usePlayerLead) return state;
  let next = state;
  const cap = Math.max(1, Math.min(cfg.leadMax || 99, Math.floor(energyMax(next) / 2)));
  // t41：保守配置只亲带「值得的本子」（T4+），其余在研项目不亲带——只改一作来源这一个变量。
  const minTier = cfg.leadMinTier || 0;
  const targets = activeProjects(next)
    .filter((p) => p.tier >= minTier)
    .slice()
    .sort((a, b) => (b.tier - a.tier) || (projectProgressPct(b) - projectProgressPct(a)))
    .slice(0, cap)
    .map((p) => p.instanceId);
  for (const project of activeProjects(next)) {
    const want = targets.includes(project.instanceId);
    if (Boolean(project.playerLeading) === want) continue;
    const after = send(next, ACTIONS.togglePlayerLead({ projectId: project.instanceId }));
    if (after !== next) next = after;
  }
  return next;
}

/** 缺哪些晋升硬门槛（用于决定「要不要买正刊」）。 */
function missingKeys(state) {
  return rankStatus(state).missing.map((m) => m.key);
}

function buyFirstAuthor(state, cfg) {
  // t24：晋升门槛只认老板一作，所以「买哪一档」要按当前缺什么来定（默认仍只补正刊）。
  const wanted = Array.isArray(cfg.buyFirstAuthorTiers) ? cfg.buyFirstAuthorTiers : [cfg.buyFirstAuthorTier];
  if (!cfg.buyFirstAuthorMax || wanted.length === 0) return state;
  let next = state;
  for (let i = 0; i < cfg.buyFirstAuthorMax; i += 1) {
    const missing = missingKeys(next);
    const tier = wanted.find((t) => t && missing.includes(t));
    if (!tier) return next;
    if (next.player.integrity <= cfg.integrityFloor) return next;
    const after = send(next, ACTIONS.buyFirstAuthor({ tier }));
    if (after === next) return next;
    next = after;
  }
  return next;
}

function spendEnergy(state, cfg) {
  let next = state;
  // ① 锻炼：健康决定精力上限，掉到 0 直接「住院」坏结局（先保命再谈科研）
  let exGuard = 0;
  while (exGuard < 4) {
    exGuard += 1;
    if (next.player.health > cfg.exerciseHealthFloor || next.player.energy < 3 || next.player.money < 2) break;
    const after = tryAction(next, { actionId: 'exercise' });
    if (!after) break;
    next = after;
  }
  // ② 与学生交流：单位精力产出最高的行动（+8 进度 / 2 精力）
  // 注意：交流同时 +2 毕业进度。人手紧张时改成只开组会（不推毕业进度），
  // 否则学生会在招募空窗期集中毕业，全组直接停滞。
  const crewNow = activeStudents(next).length;
  const preferMeeting = crewNow <= (cfg.keepCrewFloor || 5);
  let guard = 0;
  while (!preferMeeting && guard < 12) {
    guard += 1;
    if (next.player.energy < 2) break;
    const projects = activeProjects(next)
      .slice()
      .sort((a, b) => (a.deadlineMonthIndex - b.deadlineMonthIndex));
    let done = false;
    const crewSize = activeStudents(next).length;
    const keepCrew = crewSize <= (cfg.keepCrewFloor || 5);
    for (const project of projects) {
      const crew = project.assignedStudentIds
        .map((id) => next.students.find((s) => s.id === id))
        .filter((st) => st && !st.left && !st.graduated && (st.monthTalkCount || 0) < 2)
        // 人手紧张时，别把毕业进度推过线：毕业即离组，而补人受季节与招募门槛限制
        .filter((st) => !(keepCrew && st.degreeProgress + 2 >= 100));
      if (crew.length === 0) continue;
      const st = crew[0];
      const after = tryAction(next, { actionId: 'talk', studentId: st.id, projectId: project.instanceId });
      if (after) { next = after; done = true; break; }
    }
    if (!done) break;
  }
  // ② 组会：每个在研项目 +3（≥4 精力才划算）
  guard = 0;
  while (guard < 3) {
    guard += 1;
    if (next.player.energy < 4 || activeProjects(next).length === 0) break;
    const after = tryAction(next, { actionId: 'meeting' });
    if (!after) break;
    next = after;
  }
  // ③ 团建：幸福度太低会有人转组（丢进度、丢诚信）
  const crew = activeStudents(next);
  const avg = crew.length ? crew.reduce((s, st) => s + st.happiness, 0) / crew.length : 100;
  if (avg < cfg.teamBuildHappyFloor && next.player.energy >= 5 && crew.length > 0) {
    const after = tryAction(next, { actionId: 'teambuild' });
    if (after) next = after;
  }
  return next;
}

/**
 * 延毕决定（game/chooseDefer）：学制读满的学生会挂起成待决状态，不拍板就不能推进月份。
 * 机器人策略：幸福度还撑得住（> deferHappyFloor）就延毕一年留着干活，否则让他肄业。
 */
function resolveDeferDecisions(state, cfg) {
  let next = state;
  let guard = 0;
  while (guard < 20) {
    guard += 1;
    const waiting = pendingDeferStudents(next);
    if (waiting.length === 0) return next;
    const st = waiting[0];
    const choice = st.happiness > (cfg.deferHappyFloor === undefined ? 45 : cfg.deferHappyFloor) ? 'defer' : 'giveUp';
    const after = send(next, ACTIONS.chooseDefer({ studentId: st.id, choice }));
    if (after === next) return next;
    next = after;
  }
  return next;
}

/** 一个月内的全部玩家操作（顺序即优先级）。 */
export function botTurn(state, cfg) {
  let s = state;
  s = resolveDeferDecisions(s, cfg);
  s = pickConsumeMode(s, cfg);
  s = buyConsumables(s, cfg);
  s = buyEquipment(s, cfg);
  s = hireStudents(s, cfg);
  s = acceptProjects(s, cfg);
  s = toggleLeads(s, cfg);
  s = assignStudents(s, cfg);
  s = resolveHardpoints(s, cfg);
  s = grabFirstAuthors(s, cfg);
  s = spendEnergy(s, cfg);
  s = buyFirstAuthor(s, cfg);
  return s;
}

/* ══════════════ 跑一整局 ══════════════ */

/**
 * @param {{seed?:string|number, months?:number, strategy?:string|object, onMonth?:Function}} opts
 * @returns {{state:any, history:any[], nodes:any[], cfg:any, months:number}}
 */
export function runGame(opts = {}) {
  const cfg = typeof opts.strategy === 'string' ? STRATEGIES[opts.strategy] : (opts.strategy || STRATEGIES.balanced);
  const seed = opts.seed === undefined ? 'sim' : opts.seed;
  const maxMonths = opts.months || MAX_MONTHS;
  let state = reduce(createState({ seed }), ACTIONS.newGame({ seed }));
  const history = [snapshot(state)];
  const nodes = [];

  let promotedAt = state.player.rankIndex;
  const ifMilestones = [30, 80, 180, 320, 600, 950, 1400];
  const hitMilestones = new Set();
  let finishedSeen = 0;

  for (let i = 0; i < maxMonths; i += 1) {
    if (state.ending || state.phase === 'ended') break;
    state = botTurn(state, cfg);
    state = reduce(state, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    const snap = snapshot(state);
    history.push(snap);

    if (snap.rankIndex !== promotedAt) {
      nodes.push({ monthIndex: snap.monthIndex, kind: 'promote', from: promotedAt, to: snap.rankIndex, text: '晋升 → ' + snap.rank });
      promotedAt = snap.rankIndex;
    }
    for (const m of ifMilestones) {
      if (!hitMilestones.has(m) && snap.totalIF >= m) {
        hitMilestones.add(m);
        nodes.push({ monthIndex: snap.monthIndex, kind: 'if', value: m, text: '总 IF 首次 ≥ ' + m + '（实际 ' + snap.totalIF + '）' });
      }
    }
    if (snap.finished >= finishedSeen + 10) {
      finishedSeen = snap.finished - (snap.finished % 10);
      nodes.push({ monthIndex: snap.monthIndex, kind: 'projects', value: snap.finished, text: '累计结题 ' + snap.finished + ' 项' });
    }
    if (snap.monthIndex % 24 === 0) {
      const status = rankStatus(state);
      nodes.push({
        monthIndex: snap.monthIndex, kind: 'window', value: snap.monthIndex,
        text: '增选窗口：IF ' + snap.totalIF + ' / 票 ' + snap.tickets + (status.missing.length ? '，还缺 ' + status.missing.map((m) => m.text).join('、') : '，材料齐备'),
      });
    }
    if (opts.onMonth) opts.onMonth(state, snap);
    if (state.ending) break;
  }

  if (state.ending) {
    nodes.push({ monthIndex: state.ending.monthIndex, kind: 'ending', value: state.ending.id, text: '结局：' + state.ending.title });
  }
  return { state, history, nodes, cfg, months: history[history.length - 1].monthIndex };
}

/** 批量跑种子（固定种子 → 完全可复现）。 */
export function runBatch({ seeds, strategy, months }) {
  return seeds.map((seed) => ({ seed, ...runGame({ seed, strategy, months }) }));
}

export const DEFAULT_SEEDS = ['t4-01', 't4-02', 't4-03', 't4-04', 't4-05', 't4-06', 't4-07', 't4-08',
  't4-09', 't4-10', 't4-11', 't4-12', 't4-13', 't4-14', 't4-15', 't4-16'];

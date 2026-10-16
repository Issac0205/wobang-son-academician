/**
 * engine.js —— 游戏核心：action 定义 + reducer（state 的合法变迁）
 *
 * 架构约定（docs/CONTRACT.md §3.1 / ARCHITECTURE.md §5）：
 *   · reducer 是纯函数：reduce(state, action) → 新 state，绝不原地修改入参。
 *   · 所有随机都来自 state.rng（用 createRng(state.rng) 取），结束时把快照写回。
 *   · 所有数值从 src/data/ 取；本文件里的数字只能是索引/循环/单位换算。
 *   · 一次 reduce 只处理一个 action；月份推进的全部顺序写在 monthTick() 里（可读性优先）。
 */

import {
  MONTHS_PER_YEAR, HEALTH_DECAY_PER_MONTH, HEALTH_MAX, INTEGRITY_MAX, INTEGRITY_MIN,
  ENERGY_MAX_BASE, START_AGE_YEARS, RETIRE_MONTH, RANDOM_EVENTS_PER_MONTH_MIN, RANDOM_EVENTS_PER_MONTH_MAX,
  CONSUME_MODES, INTEGRITY_DELTA, CONSUMABLE_PRICE_PER_UNIT, CONSUMABLE_BUY_PACK, CONSUMABLE_LOW_THRESHOLD, PLAYER_NAME_MAX_LENGTH,
} from '../data/tuning.js';
import { RANKS, rankOf, PROMOTE_INTEGRITY_BONUS, GOLDEN_AGE_MONEY_MUL, ELECTION_WINDOW_INTERVAL, TICKET_PER_T5, TICKET_PER_T6, TICKET_PER_PHD_GRADUATES, RECOMMEND_TICKET_REQ } from '../data/ranks.js';
import { INSTRUMENTS, INSTRUMENT_MAP } from '../data/instruments.js';
import { ROOMS, ROOM_MAX, BENCH_MAP, SELL_REFUND_RATE, LAB_TEXT } from '../data/lab.js';
import { footprint, fits, findSpot, findBench, findItem, findEmptySlot, recountEquipment, newRoom, findStorageItem } from './lab.js';
import { PROJECTS, PROJECT_MAP, PROJECT_SLOTS, STUDENT_SLOTS, REFRESH_MONTHLY, LOCKABLE_SLOTS, TIER_LOOKAHEAD, PROJECT_OFFER_TTL_MONTHS, STUDENT_OFFER_TTL_MONTHS, MIN_ACCEPTABLE_PROJECT_OFFERS, NATION_PROJECT_RATIO, DEPOSIT_TO_CONSUMABLE, DEPOSIT_RATE, OVERDUE_GRACE_MONTHS, OVERDUE_INTEGRITY_PER_MONTH, OVERDUE_STUDENT_HAPPY, PROJECT_FAIL_INTEGRITY, PROJECT_FAIL_STUDENT_HAPPY } from '../data/projects.js';
import { PAPER_PATTERNS, PAPER_TIER_ORDER, PAPER_PATTERN_ORDER, GRAB_FIRST_INTEGRITY, GRAB_FIRST_HAPPY, PAPER_BUY_PRICE, BUY_FIRST_INTEGRITY, GRAB_GRUDGE_MONTHS, MASTER_GRAD_PAPER, PHD_GRAD_PAPER, downgradeTier, PLAYER_AUTHOR_ID } from '../data/papers.js';
import { HARDPOINT_METHODS, TEAM_MIN_STUDENTS, TEAM_MONEY, TEAM_STUDENT_HAPPY, TEAM_OTHER_PROJECT_MUL, FAKE_MONEY, FAKE_INTEGRITY, FAKE_STUDENT_HAPPY, FAKE_CAUGHT_INTEGRITY, FAKE_CAUGHT_PROGRESS_MUL, AUDIT_TRIGGER_FAKE_COUNT, AUDIT_MONTHLY_CHANCE, AUDIT_INTEGRITY, SOLO_MONEY, SOLO_STUDENT_HAPPY, SOLO_FAIL_HAPPY, MAX_PROJECTS_PER_STUDENT, PROJECT_MAX_STUDENTS, hardpointCount } from '../data/hardpoints.js';
import { WAGE, WAGE_TIER_LABELS, LEAVE_TRIGGER_HAPPINESS, LEAVE_TRANSFER_RATE, LEAVE_TRANSFER_PROGRESS_MUL, LEAVE_EXTREME_RATE, LEAVE_EXTREME_INTEGRITY, DEGREE_PROGRESS_MAX, DEFER_HAPPY, DEFER_MONTHS_SUBTRACT, DEFER_QUOTA_PHD, DEFER_QUOTA_MASTER, GRAD_INTEGRITY_BONUS, HAPPY_PROJECT_FINISH, INITIAL_HAPPINESS, ABILITY_MIN, ABILITY_MAX, ABILITY_TRANSLATE_MEAN_SD, ABILITY_EXAM_MEAN_SD, ABILITY_DARKHORSE_MEAN_SD, ABILITY_DARKHORSE_RATE, STUDENT_DEGREE_MASTER_RATE, POACHABLE_ABILITY_MIN, POACHABLE_HAPPY_MAX } from '../data/students.js';
import { POOL_CAP, POOL_TRANSLATE_MONTHS, POOL_EXAM_MONTHS, RECRUIT_PER_MONTH, MIN_RECRUITABLE_STUDENT_OFFERS } from '../data/market.js';
import { ACTION_DEFS, ACTION_MAP, TALK_PER_STUDENT_PER_MONTH, TALK_PROJECT_PROGRESS, TALK_HAPPY, TALK_DEGREE, MEETING_PROJECT_PROGRESS, MEETING_CREW_MUL, HAPPY_ACTION_MEETING, EXERCISE_HEALTH, EXERCISE_HEALTH_HIGH_THRESHOLD, EXERCISE_HEALTH_HIGH, HAPPY_ACTION_TEAMBUILD, TEAMBUILD_COST_PER_STUDENT } from '../data/actions.js';
import { EVENT_MAP, EVENT_WEIGHT_DEFAULT, MACHINE_DOWN_MONTHS } from '../data/events.js';
import { ENDING_MAP } from '../data/endings.js';
import { createState, cloneState, createStudent, createProject, createOffer, createChronicleEntry, advanceCalendar, energyMaxFrom, STATE_VERSION } from './state.js';
import { createRng, clamp, round, hashString } from './rng.js';
import { generateName } from './naming.js';
import {
  energyMax, consumeMode, equipmentBonus, instrumentPrice, maintenanceTotal, missingInstruments,
  schoolFundMonthly, studentBaseProgress, progressMultiplier, projectProgressPct, projectTail,
  degreePerMonth, happinessDelta, clampHappiness, hireCost, recruitRequirement, rollHardpointHd,
  teamSuccessChance, soloSuccessChance, fakeCatchChance, retryBonus, paperIF, worstOpenHardpoint,
  openHardpointCount, rankStatus, ticketRequirement, wageCost, activeStudents, activeProjects, totalStudentsGraduated,
} from './formulas.js';
import { evaluateCondition, availableEvents, promotionStatus, endingFor, isBankrupt, isLabEmpty, offerReachable, recruitReachable } from './rules.js';

/* ════════════════════════════ action 定义 ════════════════════════════ */

/**
 * 所有 UI 能发起的操作都在这里冻结成 action。
 * 命名规范：域/动词（game/advanceMonth）。
 */
export const ACTIONS = {
  newGame: (payload = {}) => ({ type: 'game/newGame', payload }),
  advanceMonth: (payload = {}) => ({ type: 'game/advanceMonth', payload }),
  doAction: (payload) => ({ type: 'game/doAction', payload }),
  setConsumeMode: (payload) => ({ type: 'game/setConsumeMode', payload }),
  buyConsumable: (payload = {}) => ({ type: 'game/buyConsumable', payload }),
  setWage: (payload) => ({ type: 'game/setWage', payload }),
  hireStudent: (payload) => ({ type: 'game/hireStudent', payload }),
  buyEquipment: (payload) => ({ type: 'game/buyEquipment', payload }),   // 1.1：= lab/buyInstrument（无坐标→自动找位）
  buyRoom: (payload = {}) => ({ type: 'lab/buyRoom', payload }),
  buyBench: (payload) => ({ type: 'lab/buyBench', payload }),
  sellBench: (payload) => ({ type: 'lab/sellBench', payload }),
  buyInstrument: (payload) => ({ type: 'lab/buyInstrument', payload }),
  moveItem: (payload) => ({ type: 'lab/moveItem', payload }),
  sellItem: (payload) => ({ type: 'lab/sellItem', payload }),
  // 1.3 仓库：台面 → 仓库 / 仓库 → 台面 / 仓库直接卖
  storeItem: (payload) => ({ type: 'lab/storeItem', payload }),
  deployItem: (payload) => ({ type: 'lab/deployItem', payload }),
  sellStored: (payload) => ({ type: 'lab/sellStored', payload }),
  acceptProject: (payload) => ({ type: 'game/acceptProject', payload }),
  lockOffer: (payload) => ({ type: 'game/lockOffer', payload }),
  assignStudent: (payload) => ({ type: 'game/assignStudent', payload }),
  unassignStudent: (payload) => ({ type: 'game/unassignStudent', payload }),
  autoAssign: (payload = {}) => ({ type: 'game/autoAssign', payload }),
  togglePlayerLead: (payload) => ({ type: 'game/togglePlayerLead', payload }),
  resolveHardpoint: (payload) => ({ type: 'game/resolveHardpoint', payload }),
  buyFirstAuthor: (payload) => ({ type: 'game/buyFirstAuthor', payload }),
  grabFirstAuthor: (payload) => ({ type: 'game/grabFirstAuthor', payload }),
  chooseDefer: (payload) => ({ type: 'game/chooseDefer', payload }),
  resolveEvent: (payload) => ({ type: 'game/resolveEvent', payload }),
  resign: (payload = {}) => ({ type: 'game/resign', payload }),
  setName: (payload = {}) => ({ type: 'game/setName', payload }),
  setTab: (payload) => ({ type: 'ui/setTab', payload }),
  setModal: (payload) => ({ type: 'ui/setModal', payload }),
  selectStudent: (payload) => ({ type: 'ui/selectStudent', payload }),
  selectProject: (payload) => ({ type: 'ui/selectProject', payload }),
  dismissToast: (payload = {}) => ({ type: 'ui/dismissToast', payload }),
};

export const ACTION_TYPES = Object.keys(ACTIONS);

/**
 * 「与学生交流课题」每名学生每月的次数上限（= GDD §8 的「每名学生 2 次」）。
 * t16 F4：数值已移进 src/data/actions.js，这里原样再导出，保持既有 import 路径可用。
 */
export { TALK_PER_STUDENT_PER_MONTH };

/* ════════════════════════════ reducer ════════════════════════════ */

/**
 * @param {any} state
 * @param {{type:string, payload?:any}} action
 * @returns {any} 新 state
 */
export function reduce(state, action) {
  switch (action.type) {
    case 'game/newGame': {
      const next = createState(action.payload || {});
      pushChronicle(next, { kind: 'system', tone: 'system', text: '新的一局：' + next.player.name + ' 的目标是把 ' + next.player.sonName + ' 送上院士。' });
      // t22（T11-F1）：开局就把项目市场填上。项目市场是全年刷新的，跟招生季无关，
      // 不填的话第 0 月会出现「selectMarket().open 为真、但项目 offer 数是 0」的自相矛盾状态。
      const rng0 = createRng(next.rng);
      refreshMarket(next, rng0, (kind, text, tone) => pushChronicle(next, { kind, text, tone: tone || 'system' }));
      next.rng = rng0.snapshot();
      return next;
    }
    case 'game/advanceMonth': return reduceAdvanceMonth(state, action.payload || {});
    case 'game/doAction': return reduceDoAction(state, action.payload || {});
    case 'game/setConsumeMode': return reduceSetConsumeMode(state, action.payload || {});
    case 'game/buyConsumable': return reduceBuyConsumable(state, action.payload || {});
    case 'game/setWage': return reduceSetWage(state, action.payload || {});
    case 'game/hireStudent': return reduceHireStudent(state, action.payload || {});
    case 'game/buyEquipment':
    case 'lab/buyInstrument': return reduceBuyInstrument(state, action.payload || {});
    case 'lab/buyRoom': return reduceBuyRoom(state);
    case 'lab/buyBench': return reduceBuyBench(state, action.payload || {});
    case 'lab/sellBench': return reduceSellBench(state, action.payload || {});
    case 'lab/moveItem': return reduceMoveItem(state, action.payload || {});
    case 'lab/sellItem': return reduceSellItem(state, action.payload || {});
    case 'lab/storeItem': return reduceStoreItem(state, action.payload || {});
    case 'lab/deployItem': return reduceDeployItem(state, action.payload || {});
    case 'lab/sellStored': return reduceSellStored(state, action.payload || {});
    case 'game/acceptProject': return reduceAcceptProject(state, action.payload || {});
    case 'game/lockOffer': return reduceLockOffer(state, action.payload || {});
    case 'game/assignStudent': return reduceAssign(state, action.payload || {}, true);
    case 'game/unassignStudent': return reduceAssign(state, action.payload || {}, false);
    case 'game/autoAssign': return reduceAutoAssign(state);
    case 'game/togglePlayerLead': return reduceToggleLead(state, action.payload || {});
    case 'game/resolveHardpoint': return reduceResolveHardpoint(state, action.payload || {});
    case 'game/buyFirstAuthor': return reduceBuyFirstAuthor(state, action.payload || {});
    case 'game/grabFirstAuthor': return reduceGrabFirstAuthor(state, action.payload || {});
    case 'game/chooseDefer': return reduceChooseDefer(state, action.payload || {});
    case 'game/resolveEvent': return reduceResolveEvent(state, action.payload || {});
    case 'game/resign': return reduceResign(state);
    case 'game/setName': return reduceSetName(state, action.payload || {});
    case 'ui/setTab': return reduceUi(state, { tab: action.payload && action.payload.tab });
    case 'ui/setModal': return reduceUi(state, { modal: action.payload ? action.payload.modal : null });
    case 'ui/selectStudent': return reduceUi(state, { studentId: action.payload && action.payload.studentId });
    case 'ui/selectProject': return reduceUi(state, { projectId: action.payload && action.payload.projectId });
    case 'ui/dismissToast': return reduceUi(state, { toast: null });
    default:
      console.warn('[engine] 未知 action：', action.type);
      return state;
  }
}

/* ════════════════════════════ 月份推进 ════════════════════════════ */

/**
 * 月末结算 + 进入新月份。顺序是契约的一部分（ARCHITECTURE §5）：
 *   体力/健康 → 收入 → 支出 → 项目（消耗/进度/到期/结题）→ 学生（幸福/毕业/离组）
 *   → 市场刷新 → 事件掷点 → 晋升 → 结局 → 记录曲线
 */
export function reduceAdvanceMonth(state, payload) {
  if (state.ending || state.phase === 'ended') return state;
  if (state.pendingEvent) {
    console.warn('[engine] 还有未处理的事件，不能推进月份');
    return state;
  }
  // 延毕决定是「与 pendingEvent 同级的待决状态」：玩家不拍板，时间就不往前走。
  const waitingDefer = pendingDeferStudents(state);
  if (waitingDefer.length > 0) {
    const blocked = cloneState(state);
    blocked.ui.toast = '先做延毕决定：' + waitingDefer.map((s) => s.name).join('、')
      + ' 的学制读满了（延毕一年还是让他肄业）。';
    return blocked;
  }
  const next = cloneState(state);
  const rng = createRng(next.rng);
  const autoResolve = Boolean(payload.autoResolveEvents);

  next.month.leavesThisMonth = 0;
  next.month.flags = {};
  next.market.recruitedThisMonth = 0;

  const log = (kind, text, tone) => pushChronicle(next, { kind, text, tone: tone || 'system' });

  // 月度回执：结算过程中逐项登记，最后落到 state.stats.lastReceipt（UI 展示「钱和进度去哪了」）。
  const receipt = newReceipt(next);
  const papersBefore = { ...next.player.papers };
  const papersAwardedBefore = next.counters.papersAwarded || 0;
  const ifBefore = next.player.totalIF;

  settlePlayer(next, rng, log);
  settleIncome(next, log, receipt);
  // t42：本月「每名学生的在研项目数」只算一次，产出守恒（进度等分）与幸福度惩罚共用同一份计数，
  // 避免 core 里出现两套计数（两套必然漂移）。
  const loadByStudent = projectLoadByStudent(next);
  settleProjects(next, rng, log, receipt, loadByStudent);
  settleStudents(next, rng, log, receipt, loadByStudent);
  refreshMarket(next, rng, log);
  rollEvents(next, rng, log, autoResolve, receipt);

  if (next.month.fakesThisMonth > 0) next.month.fakesThisMonth = 0;
  next.player.monthActions = { talk: 0, meeting: 0, exercise: 0, teambuild: 0 };
  next.player.monthEnergySpent = 0;
  next.player.monthMoneySpent = 0;

  next.calendar = advanceCalendar(next.calendar, 1);
  next.month.index = next.calendar.monthIndex;
  next.player.age = START_AGE_YEARS + (next.calendar.year - 1);
  next.player.energy = energyMax(next);
  finalizeReceipt(next, receipt, papersBefore, ifBefore, papersAwardedBefore);

  checkElectionWindow(next, log);
  checkPromotion(next, log);
  recordHistory(next);
  checkEnding(next, log);

  next.rng = rng.snapshot();
  return next;
}

/* ── 月度回执（t5 验收：收入/支出/进度/幸福度必须可见，不能是黑箱） ── */

/**
 * 新建一张月度回执。字段全部是 plain object，可进存档（state.stats.lastReceipt）。
 * 单位：金额 = 万；进度/幸福度 = 点。
 */
function newReceipt(state) {
  return {
    starvedCount: 0,
    starvedProjects: [],
    starvedHint: '',
    consumableLow: false,
    monthIndex: state.calendar.monthIndex,
    year: state.calendar.year,
    month: state.calendar.month,
    income: [],      // [{ label, amount }] 该月进账明细
    expense: [],     // [{ label, amount }] 该月支出明细（正数）
    projects: [],    // [{ instanceId, name, progressDelta, progressPct, status, starved }]
    students: [],    // [{ id, name, happyDelta, degreeDelta, happiness, note }]
    papers: [],      // [{ tier, count, if }]
    events: [],      // 本月触发的事件标题
    integrityDelta: 0,
    ticketsDelta: 0,
    integrityStart: state.player.integrity,
    ticketsStart: state.player.tickets,
    moneyBefore: state.player.money,
    moneyAfter: state.player.money,
    moneyNet: 0,
    consumableBefore: state.player.consumable,
    consumableAfter: state.player.consumable,
    consumableNet: 0,
  };
}

/** 结算末尾补齐「进项/出项合计 + 净变化 + 论文产出」。 */
function finalizeReceipt(state, receipt, papersBefore, ifBefore, papersAwardedBefore) {
  receipt.moneyAfter = state.player.money;
  receipt.moneyNet = round(receipt.moneyAfter - receipt.moneyBefore, 2);
  receipt.consumableAfter = state.player.consumable;
  receipt.consumableNet = round(receipt.consumableAfter - receipt.consumableBefore, 2);
  receipt.integrityDelta = state.player.integrity - (receipt.integrityStart ?? state.player.integrity);
  receipt.ticketsDelta = state.player.tickets - (receipt.ticketsStart ?? state.player.tickets);
  receipt.integrityAfter = state.player.integrity;
  receipt.ticketsAfter = state.player.tickets;
  receipt.ifDelta = round(state.player.totalIF - ifBefore, 1);
  receipt.consumableLow = state.player.consumable <= Number(CONSUMABLE_LOW_THRESHOLD || 0);
  if (receipt.consumableLow && !receipt.starvedHint) {
    receipt.starvedHint = '耗材只剩 ' + state.player.consumable + ' 单位：低于警戒线，先采购再推进月份';
  }
  // t24：receipt.papers 只列「老板是一作」的篇（晋升门槛口径）。
  // papersAll / papersStudent 补齐学生一作的部分，月报才不会看起来「一篇论文都没有」。
  receipt.papers = PAPER_TIER_ORDER
    .map((tier) => ({ tier, count: (state.player.papers[tier] || 0) - (papersBefore[tier] || 0) }))
    .filter((p) => p.count > 0)
    .map((p) => ({ ...p, if: round(paperIF(p.tier, null) * p.count, 1) }));
  receipt.papersAll = Math.max(0, (state.counters.papersAwarded || 0) - papersAwardedBefore);
  receipt.papersStudent = Math.max(0, receipt.papersAll - receipt.papers.reduce((n, p) => n + p.count, 0));
  delete receipt.integrityStart;
  delete receipt.ticketsStart;
  state.stats.lastReceipt = receipt;
  return receipt;
}

/* ── 玩家自身：健康、精力、亲带消耗 ── */
function settlePlayer(state, rng, log) {
  const leadCount = activeProjects(state).filter((p) => p.playerLeading).length;
  void leadCount;
  state.player.health = Math.round(clamp(state.player.health - HEALTH_DECAY_PER_MONTH, 0, HEALTH_MAX));
  if (state.counters.fakesTotal >= AUDIT_TRIGGER_FAKE_COUNT && rng.chance(AUDIT_MONTHLY_CHANCE)) {
    state.counters.auditsTotal += 1;
    addIntegrity(state, INTEGRITY_DELTA.audit);
    log('audit', '有人把材料递到了校学术委员会：审查开始，诚信 ' + INTEGRITY_DELTA.audit + '。', 'bad');
  }
}

/* ── 收入：校投 ── */
function settleIncome(state, log, receipt) {
  const fund = schoolFundMonthly(state.player.rankIndex);
  state.player.money = round(state.player.money + fund, 2);
  if (receipt) receipt.income.push({ label: '学校拨款（' + rankOf(state.player.rankIndex).title + '）', amount: fund });
  const goldenMul = goldenAgeMul(state);
  if (goldenMul !== 1) {
    const extra = round(fund * (goldenMul - 1), 2);
    state.player.money = round(state.player.money + extra, 2);
    if (extra > 0.001) {
      log('money', '黄金年龄的额外资助到账 ' + extra + ' 万。', 'good');
      if (receipt) receipt.income.push({ label: '黄金年龄额外资助', amount: extra });
    }
  }
  const maintain = maintenanceTotal(state.lab);
  state.player.money = round(state.player.money - maintain, 2);
  if (receipt && maintain > 0) receipt.expense.push({ label: '设备维护费', amount: maintain });
  const crew = activeStudents(state);
  const wages = crew.reduce((sum, st) => sum + wageCost(st), 0);
  if (wages > 0) {
    state.player.money = round(state.player.money - wages, 2);
    if (receipt) receipt.expense.push({ label: '学生补助（' + crew.length + ' 人）', amount: wages });
  }
  void log;
}

/** 黄金年龄：越低越好用（可调数值，来自 ranks.js）。 */
export function goldenAgeMul(state) {
  const rank = rankOf(state.player.rankIndex);
  if (!rank.goldenAge) return 1;
  return state.player.age <= rank.goldenAge ? 1 + GOLDEN_AGE_MONEY_MUL : 1;
}

/**
 * 每名学生本月在研的项目数（只看 active 项目的 assignedStudentIds）。
 * t42：产出守恒与「多项目幸福度惩罚」必须复用这一份计数，不得各算一套。
 */
export function projectLoadByStudent(state) {
  const load = new Map();
  for (const project of activeProjects(state)) {
    for (const id of project.assignedStudentIds) load.set(id, (load.get(id) || 0) + 1);
  }
  return load;
}

/* ── 项目：消耗、进度、逾期、结题 ── */
function settleProjects(state, rng, log, receipt, loadByStudent) {
  const mode = consumeMode(state);
  const consumeMul = mode.consumeMul * (state.lab.consumeMulThisMonth || 1);
  state.lab.consumeMulThisMonth = 1;
  const progressMul = mode.progressMul;
  const contributing = new Map();
  const progressBefore = new Map();
  const starved = new Set();
  // t30 产出守恒 / t42 多项目惩罚：计数来自 reduceAdvanceMonth 传入的同一份 loadByStudent
  //（见 projectLoadByStudent），进度按 N 等分（formulas.studentBaseProgress）。
  for (const project of activeProjects(state)) progressBefore.set(project.instanceId, project.progress);

  for (const project of activeProjects(state)) {
    const require = project.consumablePerMonth * consumeMul;
    let consumablePart = progressMul;
    if (state.player.consumable < require) {
      state.player.consumable = Math.max(0, state.player.consumable);
      consumablePart = 0;
      starved.add(project.instanceId);
    } else {
      state.player.consumable = round(state.player.consumable - require, 2);
    }

    // 到期的「隐藏难点」在本月暴露（hd 由项目等级分布抽样）
    for (const hp of project.hardpoints) {
      if (hp.status === 'hidden' && state.calendar.monthIndex >= hp.appearAt) {
        hp.status = 'open';
        if (!hp.hdRolled) {
          hp.hd = rollHardpointHd(project.tier, rng);
          hp.hdRolled = true;
        }
        log('hardpoint', project.name + ' 冒出一个难点（难度 ' + hp.hd + '）。', 'bad');
      }
    }
    // 本月被抽调去攻坚的乘子（GDD：其他项目本月进度 −25%），用完即还原。
    const distract = Number.isFinite(project.distractMul) ? project.distractMul : 1;
    project.distractMul = 1;
    const mul = progressMultiplier({ consumable: state.player.consumable, lab: state.lab, project, consumeMul: consumablePart }) * distract;
    const students = project.assignedStudentIds
      .map((id) => state.students.find((s) => s.id === id))
      .filter((s) => s && !s.left && !s.graduated);
    let gained = 0;
    for (const st of students) {
      if (st.soloThisMonth) continue;   // 本月单人猛干：产出全部用在难点上，不计入项目
      let p = studentBaseProgress(st, project, { projectCount: loadByStudent.get(st.id) || 1 }) * mul;
      if (st.outputMulMonths > 0) p *= st.outputMul;
      gained += p;
      contributing.set(st.id, (contributing.get(st.id) || 0) + 1);
    }
    project.progress = round(project.progress + Math.max(0, gained), 2);

    if (state.calendar.monthIndex >= project.deadlineMonthIndex) {
      project.overdueMonths += 1;
      addIntegrity(state, INTEGRITY_DELTA.overdue);
      for (const st of students) st.happiness = clampHappiness(st.happiness + OVERDUE_STUDENT_HAPPY);
      if (project.overdueMonths > OVERDUE_GRACE_MONTHS) {
        failProject(state, project, log);
        continue;
      }
      if (project.overdueMonths === 1) log('warn', project.name + ' 逾期了。学校那边的电话开始变多。', 'bad');
    }

    if (project.progress >= project.workload && project.status === 'active') {
      finishProject(state, project, rng, log, receipt);
    }
  }
  // 耗材见底：不再每个项目刷一条（连刷 6 条「这个月基本白干」很劝退），
  // 改成每月一条汇总 + 明确的自救指引，并写进月度回执供 UI 强提示。
  if (starved.size > 0) {
    const names = state.projects.filter((p) => starved.has(p.instanceId)).map((p) => p.name || p.defId);
    log('warn', '耗材见底：' + names.length + ' 个项目（' + names.join('、') + '）本月零进展。'
      + '去「行动」页采购耗材（1 万/单位，一批 20 单位）就能立刻恢复。', 'bad');
  }
  if (receipt) {
    receipt.starvedCount = starved.size;
    receipt.starvedProjects = state.projects.filter((p) => starved.has(p.instanceId)).map((p) => p.name || p.defId);
    receipt.starvedHint = starved.size > 0
      ? '耗材见底，' + starved.size + ' 个项目本月零进展：立即采购耗材（1 万/单位）'
      : '';
    for (const p of state.projects) {
      if (!progressBefore.has(p.instanceId)) continue;
      receipt.projects.push({
        instanceId: p.instanceId,
        name: p.name || p.defId,
        progressDelta: round(p.progress - progressBefore.get(p.instanceId), 2),
        progressPct: projectProgressPct(p),
        status: p.status,
        starved: starved.has(p.instanceId),
      });
    }
  }
  void contributing;
}

function finishProject(state, project, rng, log, receipt) {
  project.status = 'finished';
  state.counters.projectsFinished += 1;
  const def = PROJECT_MAP[project.defId];
  const openHd = openHardpointCount(project);
  // 结题时把「投稿槽位模板」结算成一张**论文台帐**（一篇一条记录）：
  // 档位、实际到手的 IF、一作是谁，全部掷一次点就落在这里。
  // 抢一作（t8 finding ①②④）与存档回读都只看这张台帐，不再事后推导。
  // 一作归属规则（t24）：老板亲带（playerLeading）的项目，论文一作**全部归玩家**（GDD §2.7/§2.8）；
  // 否则由参与该项目的在读学生按科研能力降序轮流署名（能力最高的一作最多）。
  const authors = project.assignedStudentIds
    .map((id) => state.students.find((s) => s.id === id))
    .filter((s) => s && !s.left && !s.graduated)
    .sort((a, b) => (b.ability - a.ability) || (a.id < b.id ? -1 : 1));
  const papers = [];
  for (const entry of project.paperTiers) {
    const patternId = typeof entry === 'string' ? entry : (entry && entry.patternId);
    const pattern = PAPER_PATTERNS[patternId];
    const tier = pattern ? rollPaperTier(pattern, rng) : 'q3';
    let finalTier = tier;
    for (let i = 0; i < openHd; i += 1) finalTier = downgradeTier(finalTier);
    if (!finalTier) continue;
    // t24：一作归属决定这篇进不进老板的晋升台账。亲带的项目全部归玩家；
    // 学生负责的项目记学生 id（totalIF 照加，但 player.papers 不动）。
    const playerFirst = Boolean(project.playerLeading);
    const author = playerFirst ? null : (authors.length ? authors[papers.length % authors.length] : null);
    const if_ = awardPaper(state, finalTier, { rng, playerFirst });
    papers.push({
      paperId: project.instanceId + ':p' + papers.length,
      patternId,
      tier: finalTier,
      if: if_,
      firstAuthorId: playerFirst ? PLAYER_AUTHOR_ID : (author ? author.id : null),
      firstAuthorName: playerFirst ? '（老板亲带）' : (author ? author.name : '（无学生署名）'),
      grabbed: false,
      grabbedMonthIndex: -1,
    });
  }
  project.paperTiers = papers;
  // t30：亲带结题的台帐一作是玩家 → 记下「最近一次拿到本人一作」的月份（顶栏空窗提示用）。
  if (project.playerLeading && papers.length > 0) state.player.lastFirstAuthorMonthIndex = state.calendar.monthIndex;
  const tail = projectTail(project);
  project.tailPaid = true;
  state.player.money = round(state.player.money + tail, 2);
  if (receipt) receipt.income.push({ label: (def ? def.name : project.name) + ' 尾款', amount: tail });
  addIntegrity(state, project.category === 'enterprise' ? INTEGRITY_DELTA.finishEnterprise : INTEGRITY_DELTA.finishProject);
  for (const id of project.assignedStudentIds) {
    const st = state.students.find((s) => s.id === id);
    if (!st) continue;
    // 修复：结题后必须把项目从学生的负责列表里摘掉。
    // 旧实现只给幸福度、不清 projectIds，学生 3 个「负责项目」名额会被已结题项目占满，
    // 从此再也接不了新项目（全组进度停滞的第二个死锁源）。
    st.projectIds = st.projectIds.filter((pid) => pid !== project.instanceId);
    if (!st.left && !st.graduated) st.happiness = clampHappiness(st.happiness + HAPPY_PROJECT_FINISH);
  }
  if (project.tier >= 6) state.player.tickets += TICKET_PER_T6;
  else if (project.tier >= 5) state.player.tickets += TICKET_PER_T5;
  // 契约外字段 papersFromProject 已删除：产出论文的去向由 player.papers（档位计数）与
  // state.stats.lastReceipt.papers（月度回执）表达，不再私开 state 字段。
  log('project', (def ? def.name : project.name) + ' 结题：尾款 ' + tail + ' 万，产出论文 ' + papers.length + ' 篇。', 'good');
  void openHd;
}

function failProject(state, project, log) {
  project.status = 'failed';
  state.counters.projectsFailed += 1;
  addIntegrity(state, PROJECT_FAIL_INTEGRITY);
  for (const id of project.assignedStudentIds) {
    const st = state.students.find((s) => s.id === id);
    if (st && !st.left && !st.graduated) {
      st.happiness = clampHappiness(st.happiness + PROJECT_FAIL_STUDENT_HAPPY);
      st.projectIds = st.projectIds.filter((pid) => pid !== project.instanceId);
    }
  }
  log('project', project.name + ' 逾期太久，被判定失败。', 'bad');
}

/** 抽一篇论文的档位。 */
export function rollPaperTier(pattern, rng) {
  const entries = PAPER_TIER_ORDER.filter((t) => (pattern.weights[t] || 0) > 0).map((t) => ({ tier: t, w: pattern.weights[t] }));
  const picked = rng.pickWeighted(entries, (e) => e.w);
  return picked ? picked.tier : 'q3';
}

/**
 * 记一篇论文。
 * · totalIF：**所有论文**都加（GDD §3.2「所有论文，无论一作归属」），这条口径从不变。
 * · player.papers[tier]：**只有该篇一作是玩家本人**时才 +1（t24）。它才是晋升门槛读的
 *   「一作数」（副研究员→…→院士的 q1/q2/正刊门槛），学生一作与毕业产出都不算。
 * ctx.if 存在时直接沿用这个数值（抢一作要跟结题台帐上的 IF 完全对得上，不重新掷点）。
 * ctx.playerFirst 省略时按 false 处理：宁可少给老板算一篇，也不把学生的一作混进门槛。
 */
function awardPaper(state, tier, ctx) {
  const if_ = ctx && Number.isFinite(ctx.if) ? round(ctx.if, 1) : paperIF(tier, ctx && ctx.rng);
  const playerFirst = Boolean(ctx && ctx.playerFirst);
  if (playerFirst) state.player.papers[tier] = (state.player.papers[tier] || 0) + 1;
  state.player.totalIF = round(state.player.totalIF + if_, 1);
  state.counters.papersAwarded = (state.counters.papersAwarded || 0) + 1;
  pushChronicle(state, {
    kind: 'paper',
    tone: 'good',
    text: '论文见刊（' + tier + '），影响因子 ' + if_ + '。' + (playerFirst ? '' : '（学生一作，你挂通讯）'),
  });
  return if_;
}

/* ── 学生：幸福度、毕业进度、毕业/延毕、离组 ── */
function settleStudents(state, rng, log, receipt, loadByStudent) {
  const mode = consumeMode(state);
  const happyBefore = new Map(state.students.map((st) => [st.id, st.happiness]));
  const degreeBefore = new Map(state.students.map((st) => [st.id, st.degreeProgress]));
  const deferBefore = new Map(state.students.map((st) => [st.id, st.deferMonths]));
  for (const st of state.students) {
    if (st.left || st.graduated) continue;
    st.monthsInLab += 1;
    st.monthTalkCount = 0;
    st.soloThisMonth = false;   // 上个月的「单人猛干」标记用完即清
    const projects = st.projectIds.map((id) => state.projects.find((p) => p.instanceId === id)).filter((p) => p && p.status === 'active');
    const hasProject = projects.length > 0;
    const hasOpenHd = projects.some((p) => openHardpointCount(p) > 0);
    // t42（B 方案）：在研项目数 n≥1 时每月额外 −(n−1)×MULTI_PROJECT_HAPPY_PENALTY；
    // n=0 不吃这条，仍走 PROJECT_STRESS_IDLE。计数复用产出守恒的同一份映射。
    const assignedProjectCount = loadByStudent ? (loadByStudent.get(st.id) || 0) : 0;
    st.happiness = clampHappiness(st.happiness + happinessDelta(st, {
      consumeHappy: mode.happyDelta,
      hasProject,
      hasOpenHardpoint: hasOpenHd,
      assignedProjectCount,
    }));
    st.studyMonthsLeft -= 1;
    st.degreeProgress = round(clamp(st.degreeProgress + degreePerMonth(st, hasProject, { consumable: state.player.consumable }), 0, DEGREE_PROGRESS_MAX), 2);
    if (st.grudgeMonths > 0) st.grudgeMonths -= 1;
    if (st.outputMulMonths > 0) st.outputMulMonths -= 1;
    if (st.wageTier === 'none') {
      st.monthsNoWage += 1;
      if (st.monthsNoWage === 3) {
        addIntegrity(state, INTEGRITY_DELTA.noWage);
        log('warn', st.name + ' 已经三个月没拿到补助了，他找你聊了两次。', 'bad');
      }
    } else {
      st.monthsNoWage = 0;
    }

    if (st.degreeProgress >= DEGREE_PROGRESS_MAX) {
      graduateStudent(state, st, log);
      continue;
    }
    if (st.studyMonthsLeft <= 0) {
      const quota = st.degree === 'phd' ? DEFER_QUOTA_PHD : DEFER_QUOTA_MASTER;
      if (st.deferMonths < quota) {
        // t8 finding：学制读满不再「自动延毕 + 事后扣幸福」，而是挂起成待决状态，
        // 由玩家在「延毕决定」弹层里二选一（game/chooseDefer）。没选之前不能推进月份。
        log('warn', st.name + ' 的学制读满了：延毕一年还是让他肄业，等你拍板。（延毕决定弹层）', 'bad');
      } else {
        giveUpStudent(state, st, log);
        continue;
      }
    }
    if (st.happiness <= LEAVE_TRIGGER_HAPPINESS) {
      leaveStudent(state, st, rng, log);
    }
  }
  if (receipt) {
    for (const st of state.students) {
      if (!happyBefore.has(st.id)) continue;
      const happyDelta = st.happiness - happyBefore.get(st.id);
      const degreeDelta = round(st.degreeProgress - (degreeBefore.get(st.id) || 0), 2);
      let note = '';
      if (st.graduated) note = '毕业';
      else if (st.left) note = st.note || '离组';
      else if (st.deferMonths > (deferBefore.get(st.id) || 0)) note = '延毕';
      if (happyDelta === 0 && degreeDelta === 0 && !note) continue;
      receipt.students.push({
        id: st.id, name: st.name, happyDelta, degreeDelta, happiness: st.happiness, note,
      });
    }
  }
  // 修复：旧实现是 students.slice(0, 60)，它保留「最早创建的 60 条」而把新招的学生删掉
  // （数组按创建顺序排列），于是课题组一到 60 条记录，之后每一次招聘都被静默丢弃，
  // 实验室必然枯竭、项目必然逾期。现在只裁剪「已结束」的历史记录，在读/延毕学生永不裁剪。
  const HISTORY_KEEP = 60;
  const done = state.students.filter((st) => st.left || st.graduated);
  if (done.length > HISTORY_KEEP) {
    const keep = new Set(done.slice(-HISTORY_KEEP).map((st) => st.id));
    state.students = state.students.filter((st) => (!st.left && !st.graduated) || keep.has(st.id));
  }
}

/**
 * 「学制读满、还没到延毕上限」的学生 = 等玩家做延毕决定（state 里不加新字段，
 * 判定完全由 studyMonthsLeft / degreeProgress / deferMonths 推导，所以读档后依然成立）。
 */
export function pendingDeferStudents(state) {
  return state.students.filter((st) => {
    if (st.left || st.graduated) return false;
    if (st.studyMonthsLeft > 0) return false;
    if (st.degreeProgress >= DEGREE_PROGRESS_MAX) return false;
    const quota = st.degree === 'phd' ? DEFER_QUOTA_PHD : DEFER_QUOTA_MASTER;
    return st.deferMonths < quota;
  });
}

function graduateStudent(state, st, log) {
  st.graduated = true;
  st.degreeProgress = DEGREE_PROGRESS_MAX;
  state.player.graduated[st.degree] = (state.player.graduated[st.degree] || 0) + 1;
  addIntegrity(state, INTEGRITY_DELTA.graduate);
  const tier = st.degree === 'phd' ? PHD_GRAD_PAPER : MASTER_GRAD_PAPER;
  // 毕业产出是学生一作：照加总 IF，但不计进老板的一作台账（t24）。
  awardPaper(state, tier, { playerFirst: false });
  if (st.degree === 'phd' && state.player.graduated.phd % TICKET_PER_PHD_GRADUATES === 0) {
    state.player.tickets += 1;
  }
  for (const pid of st.projectIds) {
    const project = state.projects.find((p) => p.instanceId === pid);
    if (project && project.status === 'active') {
      project.assignedStudentIds = project.assignedStudentIds.filter((id) => id !== st.id);
    }
  }
  st.projectIds = [];
  log('student', st.name + '（' + (st.degree === 'phd' ? '博士' : '硕士') + '）毕业了，答辩那天他说了三次「谢谢老师」。', 'good');
}

function giveUpStudent(state, st, log, reason) {
  st.left = true;
  st.note = reason === 'quit' ? '肄业（老板拍的板）' : '肄业';
  addIntegrity(state, INTEGRITY_DELTA.giveUpStudent);
  log('student', reason === 'quit'
    ? st.name + ' 肄业了。他走之前把实验记录本整整齐齐放在了你桌上。'
    : st.name + ' 超过最长年限，退学了。', 'bad');
}

/**
 * 延毕决定（t8 finding）：二选一，不可逆。
 *   choice='defer'  → 在读月数 +DEFER_MONTHS_SUBTRACT、幸福度 +DEFER_HAPPY（负数）、deferMonths +1、不占招生名额
 *   choice='giveUp' → 直接肄业离组（与「超过最长年限」同一条路径，见 giveUpStudent）
 */
function reduceChooseDefer(state, payload) {
  const next = cloneState(state);
  const st = next.students.find((s) => s.id === payload.studentId);
  const choice = payload.choice === 'defer' ? 'defer' : (payload.choice === 'giveUp' ? 'giveUp' : '');
  const reject = (msg) => {
    next.ui.toast = msg;
    return next;
  };
  if (!st || st.left || st.graduated) return state;
  if (!choice) return reject('延毕决定必须二选一：延毕一年，或让他肄业。');
  if (st.studyMonthsLeft > 0 || st.degreeProgress >= DEGREE_PROGRESS_MAX) {
    return reject(st.name + ' 现在还用不着做延毕决定。');
  }
  const quota = st.degree === 'phd' ? DEFER_QUOTA_PHD : DEFER_QUOTA_MASTER;
  const log = (kind, text, tone) => pushChronicle(next, { kind, text, tone: tone || 'system' });
  if (choice === 'defer') {
    if (st.deferMonths >= quota) return reject(st.name + ' 已经延到上限了（最多 ' + quota + ' 次），只能走肄业。');
    st.deferMonths += 1;
    st.studyMonthsLeft += DEFER_MONTHS_SUBTRACT;
    st.happiness = clampHappiness(st.happiness + DEFER_HAPPY);
    next.counters.deferredStudents = (next.counters.deferredStudents || 0) + 1;
    log('student', st.name + ' 延毕了（第 ' + st.deferMonths + ' 年）。他删掉了朋友圈里那张毕业照的草稿。', 'bad');
  } else {
    giveUpStudent(next, st, log, 'quit');
  }
  return next;
}

function leaveStudent(state, st, rng, log) {
  const extreme = rng.chance(LEAVE_EXTREME_RATE);
  st.left = true;
  state.month.leavesThisMonth += 1;
  const mul = extreme ? 0 : LEAVE_TRANSFER_PROGRESS_MUL;
  for (const pid of st.projectIds) {
    const project = state.projects.find((p) => p.instanceId === pid);
    if (project && project.status === 'active') {
      project.progress = round(project.progress * mul, 2);
      project.assignedStudentIds = project.assignedStudentIds.filter((id) => id !== st.id);
    }
  }
  st.projectIds = [];
  if (extreme) {
    addIntegrity(state, LEAVE_EXTREME_INTEGRITY);
    log('student', st.name + ' 转组前把你的数据全删了。诚信 ' + LEAVE_EXTREME_INTEGRITY + '。', 'bad');
  } else {
    log('student', st.name + ' 转组了，项目进度打了 ' + Math.round(LEAVE_TRANSFER_PROGRESS_MUL * 100) + '%。', 'bad');
  }
  void extreme;
}

/* ── 市场刷新与生成 ──
   席位规则（数值实现修订：修复「市场死锁」）：
     · 项目 offer 与学生 offer 各占独立配额 PROJECT_SLOTS / STUDENT_SLOTS，
       不再抢同一个 MARKET_SLOTS；两类 offer 都有 TTL，非锁定的一律按期撤走。
     · 不变式：池子里始终至少有 MIN_ACCEPTABLE_PROJECT_OFFERS 个
       「当前头衔 + 当前仪器条件下真能承接」的项目 offer（offerReachable 判定），
       否则玩家会陷入「永远接不到项目」的死局。
   旧实现的两个 bug：① 过期清理里写 if (o.kind === 'student') return true 让学生 offer 永不过期；
   ② 学生与项目共用 MARKET_SLOTS=5，挂位一满项目 offer 就永久停发。 */
function refreshMarket(state, rng, log) {
  const rank = rankOf(state.player.rankIndex);
  const maxTier = Math.min(6, rank.maxProjectTier + TIER_LOOKAHEAD);
  const now = state.calendar.monthIndex;

  const ttlOf = (o) => (o.kind === 'student'
    ? (o.expiresMonthIndex || ((o.createdMonthIndex || 0) + STUDENT_OFFER_TTL_MONTHS))
    : (o.expiresMonthIndex || 0));
  // 项目有效区间为 [created, expires)：TTL=3 不能在第 3 月继续占位，形成四个月周期。
  // 学生沿用原到期口径；锁定项目仍不自动撤走。
  const alive = (o) => Boolean(o.locked) || ttlOf(o) === 0
    || (o.kind === 'project' ? now < ttlOf(o) : now <= ttlOf(o));
  let pool = state.market.pool.filter(alive);
  state.market.pool = pool;   // 让 createProjectOffer 里的 taken 判定看到最新池子

  // ① 独立配额：超配的非锁定 offer 先淘汰（项目优先留「能接的」，其次留新的）
  const pruneToQuota = (kind, slots) => {
    const list = pool.filter((o) => o.kind === kind);
    const lockedCount = list.filter((o) => o.locked).length;
    const free = list.filter((o) => !o.locked);
    const keep = Math.max(0, slots - lockedCount);
    if (free.length <= keep) return;
    const scored = free.map((o) => ({
      offerId: o.offerId,
      score: (kind === 'project' && offerReachable(state, o) ? 2 : 0) + ((o.createdMonthIndex || 0) % 1000) / 1000,
    }));
    scored.sort((a, b) => b.score - a.score);
    const drop = new Set(scored.slice(keep).map((e) => e.offerId));
    pool = pool.filter((o) => !drop.has(o.offerId));
    state.market.pool = pool;
  };
  pruneToQuota('student', STUDENT_SLOTS);

  const recruitSeason = POOL_TRANSLATE_MONTHS.includes(state.calendar.month)
    || POOL_EXAM_MONTHS.includes(state.calendar.month);
  const countKind = (kind) => pool.filter((o) => o.kind === kind).length;

  // t22（T11-F1）：项目市场与招生季解耦 —— 全年按 GDD §5「槽位 5 / 每月刷新 2」刷新。
  // 旧实现把项目刷新挂在 if (open && now > 0) 里（open = isMarketOpen），
  // 于是 1–5 月只能靠「至少 1 个可接项目」的不变式补到 1 个，6 月一开季跳到 3–5 个：
  // 项目数量被招生月份牵着走，7–12 月之外几乎接不到新项目。
  for (let i = 0; i < REFRESH_MONTHLY; i += 1) {
    if (countKind('project') >= PROJECT_SLOTS) break;
    pool.push(createProjectOffer(state, rng, maxTier));
  }
  pruneToQuota('project', PROJECT_SLOTS);
  {
    // ①-b t30（BALANCE §18.10 第 6 条）：每个刷新周期至少挂 1 个「头衔够得着、仪器还没买齐」的高等级本子。
    // 目的：让玩家看得见目标（差哪台仪器），而不是市场里永远只有现在就能接的小本子。
    const strictTier = Math.min(6, rankOf(state.player.rankIndex).maxProjectTier);
    const looksVisionary = (o) => o.kind === 'project' && (o.tier || 0) <= strictTier
      && missingInstruments(state.lab, o.require || {}).length > 0;
    if (!pool.some(looksVisionary)) {
      const def = PROJECTS
        .filter((d) => d.tier <= strictTier && missingInstruments(state.lab, d.require).length > 0)
        .sort((a, b) => (b.tier - a.tier) || (a.id < b.id ? -1 : 1))[0];
      if (def) {
        if (countKind('project') >= PROJECT_SLOTS) {
          const stale = pool.filter((o) => o.kind === 'project' && !o.locked && !offerReachable(state, o)
            && missingInstruments(state.lab, o.require || {}).length === 0)[0];
          if (stale) {
            pool = pool.filter((o) => o.offerId !== stale.offerId);
            state.market.pool = pool;
          }
        }
        if (countKind('project') < PROJECT_SLOTS && !pool.some((o) => o.kind === 'project' && o.defId === def.id)) {
          pool.push(createProjectOffer(state, rng, maxTier, def.id));
        }
      }
    }
  }
  {
    // 人才市场：只有招生季（MARKET_OPEN_MONTHS = POOL_TRANSLATE/EXAM_MONTHS 的并集）才补候选人。
    if (recruitSeason && pool.length < POOL_CAP) {
      if (countKind('student') < STUDENT_SLOTS) pool.push(createStudentOffer(state, rng));
      // 不变式：招生季里至少要挂一个「头衔 + IF 够得着」的候选人。
      // 否则（例如副研究员碰上 reqRank 2 的保研生）席位会被永远招不起的 offer 占满，
      // 新生代学生进不来 → 实验室枯竭 → 全组停滞。
      const reachableStudents = () => pool.filter((o) => o.kind === 'student' && recruitReachable(state, o)).length;
      let guard = 0;
      while (reachableStudents() < MIN_RECRUITABLE_STUDENT_OFFERS && guard < STUDENT_SLOTS + 2) {
        guard += 1;
        const stale = pool.filter((o) => o.kind === 'student' && !o.locked && !recruitReachable(state, o))
          .sort((a, b) => (a.createdMonthIndex || 0) - (b.createdMonthIndex || 0))[0];
        if (stale) {
          pool = pool.filter((o) => o.offerId !== stale.offerId);
          state.market.pool = pool;
          log('market', '市场里的候选人去了别的组（你看得见，但招不动）。', 'system');
        } else if (countKind('student') >= STUDENT_SLOTS) {
          break;
        }
        pool.push(createStudentOffer(state, rng));
      }
    }
  }

  // ② 不变式：项目席位里必须至少有一个现在真能接的本子（先把接不了的腾走）
  const reachableCount = () => pool.filter((o) => o.kind === 'project' && offerReachable(state, o)).length;
  let guard = 0;
  while (reachableCount() < MIN_ACCEPTABLE_PROJECT_OFFERS && guard < PROJECT_SLOTS + 2) {
    guard += 1;
    const blocked = pool.filter((o) => o.kind === 'project' && !o.locked && !offerReachable(state, o));
    if (blocked.length > 0) {
      const dropId = blocked[0].offerId;
      pool = pool.filter((o) => o.offerId !== dropId);
      state.market.pool = pool;
      log('market', '市场上那份你接不了的本子被别的组拿走了。', 'system');
    } else if (countKind('project') >= PROJECT_SLOTS) {
      break;   // 席位被锁定 offer 占满：下一月再补
    }
    pool.push(createProjectOffer(state, rng, maxTier));
  }

  // ③ 防御性硬上限：绝不超过 POOL_CAP（优先丢未锁定的）
  while (pool.length > POOL_CAP) {
    const idx = pool.findIndex((o) => !o.locked);
    pool.splice(idx < 0 ? pool.length - 1 : idx, 1);
  }

  state.market.pool = pool;
  state.market.refreshedMonthIndex = now;
  void log;
}

function createProjectOffer(state, rng, maxTier, forcedDefId) {
  const wantNation = rng.chance(NATION_PROJECT_RATIO);
  const categories = wantNation ? ['nation', 'enterprise'] : ['enterprise', 'nation'];
  const taken = new Set(state.market.pool.filter((o) => o.kind === 'project').map((o) => o.defId));
  // 优先挂「玩家现在真能接」的项目：严格用 rank.maxProjectTier（而不是 maxTier 的 lookahead），
  // 否则市场会堆一堆当前头衔接不了的本子，「有市场没项目」的死锁会以另一种形式复发。
  const strictTier = Math.min(6, rankOf(state.player.rankIndex).maxProjectTier);
  const usable = (d, cap) => d.tier <= cap && missingInstruments(state.lab, d.require).length === 0;
  const strict = PROJECTS.filter((d) => usable(d, strictTier));
  const loose = PROJECTS.filter((d) => usable(d, maxTier));
  const eligible = strict.length > 0 ? strict : (loose.length > 0 ? loose : PROJECTS.filter((d) => d.tier <= maxTier));
  // 低等级项目权重更高：等级 tier 的权重 = 1/tier（越高端越稀有）
  const tierWeights = {};
  for (const d of eligible) tierWeights[d.tier] = (tierWeights[d.tier] || 0) + 1;
  const tierPool = Object.keys(tierWeights).map((t) => ({ tier: Number(t), w: Number(tierWeights[t]) / Number(t) }));
  let def = forcedDefId ? (PROJECT_MAP[forcedDefId] || PROJECTS.find((d) => d.id === forcedDefId)) : null;
  const pickedTier = def ? { tier: def.tier } : rng.pickWeighted(tierPool, (e) => e.w);
  for (const category of categories) {
    if (def) break;
    const candidates = eligible.filter((d) => d.category === category && d.tier === (pickedTier ? pickedTier.tier : 1) && !taken.has(d.id));
    def = rng.pick(candidates);
    if (def) break;
  }
  if (!def) def = rng.pick(eligible.filter((d) => !taken.has(d.id))) || rng.pick(eligible) || PROJECTS[0];
  // 说明：forcedDefId 只用于「看得见目标」的定向挂单（见 refreshMarket 的 ①-b）。
  const offer = createOffer({
    offerId: 'o' + state.counters.nextOfferId,
    kind: 'project',
    defId: def.id,
    category: def.category,
    tier: def.tier,
    money: def.money,
    limitMonths: def.limitMonths,
    workload: def.workload,
    require: { ...def.require },
    createdMonthIndex: state.calendar.monthIndex,
    expiresMonthIndex: state.calendar.monthIndex + PROJECT_OFFER_TTL_MONTHS,
  });
  state.counters.nextOfferId += 1;
  return offer;
}

function createStudentOffer(state, rng) {
  const translate = POOL_TRANSLATE_MONTHS.includes(state.calendar.month) && !POOL_EXAM_MONTHS.includes(state.calendar.month);
  const source = translate ? 'translate' : 'exam';
  const degree = rng.chance(STUDENT_DEGREE_MASTER_RATE) ? 'master' : 'phd';
  let ability;
  if (source === 'translate') ability = rng.normal(ABILITY_TRANSLATE_MEAN_SD.mean, ABILITY_TRANSLATE_MEAN_SD.sd);
  else {
    ability = rng.chance(ABILITY_DARKHORSE_RATE)
      ? rng.normal(ABILITY_DARKHORSE_MEAN_SD.mean, ABILITY_DARKHORSE_MEAN_SD.sd)
      : rng.normal(ABILITY_EXAM_MEAN_SD.mean, ABILITY_EXAM_MEAN_SD.sd);
  }
  ability = round(clamp(ability, ABILITY_MIN, ABILITY_MAX), 3);
  const { name, gender } = generateName(rng, { used: new Set(state.market.pool.filter((o) => o.kind === 'student').map((o) => o.name)) });
  const req = recruitRequirement(ability, source);
  const offer = createOffer({
    offerId: 'o' + state.counters.nextOfferId,
    kind: 'student',
    degree, source, ability, name, gender,
    cost: hireCost(ability, source),
    reqIF: req.reqIF,
    reqRank: req.reqRank,
    createdMonthIndex: state.calendar.monthIndex,
  });
  state.counters.nextOfferId += 1;
  return offer;
}

/* ── 事件掷点 ── */
function rollEvents(state, rng, log, autoResolve, receipt) {
  const count = rng.int(RANDOM_EVENTS_PER_MONTH_MIN, RANDOM_EVENTS_PER_MONTH_MAX);
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    const pool = availableEvents(state).filter((ev) => !queue.some((q) => q.eventId === ev.id));
    if (pool.length === 0) break;
    const ev = rng.pickWeighted(pool, (e) => e.weight || EVENT_WEIGHT_DEFAULT);
    if (!ev) break;
    queue.push({ eventId: ev.id, monthIndex: state.calendar.monthIndex, choiceId: null });
    state.eventState.lastFiredMonth[ev.id] = state.calendar.monthIndex;
    state.counters.eventsFired += 1;
  }
  state.month.eventQueue = queue.map((q) => q.eventId);
  state.month.eventsResolved = [];
  if (receipt) receipt.events = queue.map((q) => (EVENT_MAP[q.eventId] ? EVENT_MAP[q.eventId].title : q.eventId));
  if (queue.length > 0) {
    state.phase = 'settle';
    state.pendingEvent = queue[0];
    state.month.pendingQueue = queue;
    if (autoResolve) {
      // 无头模式：自动选择第一个选项，把事件一次性结算掉
      let guard = 0;
      while (state.pendingEvent && guard < 10) {
        resolvePendingEvent(state, rng, log, null);
        guard += 1;
      }
    }
  }
  void log;
}

/* ════════════════════════════ 行动 / 购买 / 招募 ════════════════════════════ */

function reduceDoAction(state, payload) {
  const def = ACTION_MAP[payload.actionId];
  if (!def) return state;
  const onError = (msg) => {
    if (payload.silent) return state;
    const next = cloneState(state);
    next.ui.toast = msg;
    return next;
  };
  if (state.player.energy < def.energyCost) return onError('精力不够了，先歇一个月吧。');
  const moneyCost = def.moneyCost === 'perStudent'
    ? TEAMBUILD_COST_PER_STUDENT * activeStudents(state).length
    : Number(def.moneyCost || 0);
  if (state.player.money < moneyCost) return onError('经费不足，这次行动需要 ' + moneyCost + ' 万。');
  // t16 F3：limitPerMonth 是数值时由引擎统一校验（此前只对 talk 的 'perStudent' 生效，
  // 于是 teambuild 的 limitPerMonth: 1 形同虚设，可以一个月团建到把幸福度刷满）。
  if (typeof def.limitPerMonth === 'number') {
    const used = state.player.monthActions[def.id] || 0;
    if (used >= def.limitPerMonth) {
      return onError(def.limitPerMonth === 1
        ? '这个月已经「' + def.name + '」过了，再来一次也没那个心气了。'
        : '这个月「' + def.name + '」最多 ' + def.limitPerMonth + ' 次，已经用完了。');
    }
  }

  const next = cloneState(state);
  next.player.energy = Math.max(0, next.player.energy - def.energyCost);
  next.player.monthEnergySpent += def.energyCost;
  next.player.money = round(next.player.money - moneyCost, 2);
  next.player.monthMoneySpent = round(next.player.monthMoneySpent + moneyCost, 2);
  next.player.monthActions[def.id] = (next.player.monthActions[def.id] || 0) + 1;

  if (def.id === 'talk') {
    const st = next.students.find((s) => s.id === payload.studentId);
    const project = next.projects.find((p) => p.instanceId === payload.projectId);
    if (!st || !project) return onError('要先选一名学生和他负责的项目。');
    if ((st.monthTalkCount || 0) >= TALK_PER_STUDENT_PER_MONTH) {
      return onError(st.name + '这个月已经聊过 ' + TALK_PER_STUDENT_PER_MONTH + ' 次了，再说下去就成唠叨了。');
    }
    st.monthTalkCount = (st.monthTalkCount || 0) + 1;
    project.progress = round(project.progress + TALK_PROJECT_PROGRESS, 2);
    st.happiness = clampHappiness(st.happiness + TALK_HAPPY);
    st.degreeProgress = round(clamp(st.degreeProgress + TALK_DEGREE, 0, DEGREE_PROGRESS_MAX), 2);
  } else if (def.id === 'meeting') {
    const mul = MEETING_CREW_MUL[Math.min(next.player.monthActions.meeting, MEETING_CREW_MUL.length - 1)];
    for (const project of activeProjects(next)) {
      project.progress = round(project.progress + MEETING_PROJECT_PROGRESS * mul, 2);
    }
    for (const st of activeStudents(next)) st.happiness = clampHappiness(st.happiness + HAPPY_ACTION_MEETING);
    if (mul === 0) next.ui.toast = '这个月组会开得太多了，没人再带本子。';
  } else if (def.id === 'exercise') {
    const gain = next.player.health >= EXERCISE_HEALTH_HIGH_THRESHOLD ? EXERCISE_HEALTH_HIGH : EXERCISE_HEALTH;
    next.player.health = Math.round(clamp(next.player.health + gain, 0, HEALTH_MAX));
  } else if (def.id === 'teambuild') {
    for (const st of activeStudents(next)) st.happiness = clampHappiness(st.happiness + HAPPY_ACTION_TEAMBUILD);
  }
  next.player.energy = Math.min(next.player.energy, energyMax(next));
  pushChronicle(next, { kind: 'action', tone: 'system', text: '本月行动：' + def.name + (moneyCost > 0 ? '（花费 ' + moneyCost + ' 万）' : '') + '。' });
  return next;
}

function reduceSetConsumeMode(state, payload) {
  if (!CONSUME_MODES[payload.mode]) return state;
  const next = cloneState(state);
  next.player.consumeMode = payload.mode;
  return next;
}

/** 用经费采购耗材：money → consumable（1:1，见 tuning.CONSUMABLE_PRICE_PER_UNIT）。 */
function reduceBuyConsumable(state, payload) {
  const amount = Math.max(1, Math.round(Number(payload.amount) || CONSUMABLE_BUY_PACK));
  const cost = round(amount * CONSUMABLE_PRICE_PER_UNIT, 2);
  const next = cloneState(state);
  if (next.player.money < cost) {
    next.ui.toast = '经费不够采购 ' + amount + ' 单位耗材（需要 ' + cost + ' 万）。';
    return next;
  }
  next.player.money = round(next.player.money - cost, 2);
  next.player.consumable = round(next.player.consumable + amount, 2);
  pushChronicle(next, { kind: 'lab', tone: 'system', text: '采购耗材 ' + amount + ' 单位（' + cost + ' 万）。' });
  return next;
}

function reduceSetWage(state, payload) {
  const tier = payload.tier;
  if (!WAGE_TIER_LABELS[tier]) return state;
  const next = cloneState(state);
  const st = next.students.find((s) => s.id === payload.studentId);
  if (!st || st.left || st.graduated) return state;
  st.wageTier = tier;
  st.monthsNoWage = tier === 'none' ? st.monthsNoWage : 0;
  return next;
}

function reduceHireStudent(state, payload) {
  const offer = state.market.pool.find((o) => o.offerId === payload.offerId && o.kind === 'student');
  if (!offer) return state;
  const next = cloneState(state);
  const reasons = [];
  const rank = rankOf(next.player.rankIndex);
  const cap = offer.degree === 'phd' ? rank.phdCap : rank.masterCap;
  const counted = next.students.filter((s) => !s.left && !s.graduated && s.degree === offer.degree && s.deferMonths <= 0).length;
  if (counted >= cap) reasons.push('名额已满');
  if (next.player.money < offer.cost) reasons.push('经费不足');
  if (next.player.totalIF < offer.reqIF) reasons.push('组内 IF 不够');
  // t30（§18.13）：reqRank 只做展示（titleReq），招聘准入只看 reqIF —— 否则「IF 够、头衔不够」
  // 的玩家会一个学生都招不到（实验室断供），与 canRecruitOffer 的判定自相矛盾。
  if (next.market.recruitedThisMonth >= RECRUIT_PER_MONTH) reasons.push('本月招募名额用完');
  if (reasons.length > 0) {
    next.ui.toast = '招不了：' + reasons.join('、');
    return next;
  }
  next.player.money = round(next.player.money - offer.cost, 2);
  next.market.recruitedThisMonth += 1;
  const id = 's' + next.counters.nextStudentId;
  next.counters.nextStudentId += 1;
  next.students.push(createStudent({
    id,
    name: offer.name,
    gender: offer.gender,
    degree: offer.degree,
    source: offer.source,
    ability: offer.ability,
    happiness: INITIAL_HAPPINESS,
    wageTier: payload.wageTier || 'mid',
    studyMonthsLeft: offer.degree === 'phd' ? 60 : 36,
    enteredMonthIndex: next.calendar.monthIndex,
  }));
  next.market.pool = next.market.pool.filter((o) => o.offerId !== offer.offerId);
  pushChronicle(next, { kind: 'market', tone: 'good', text: offer.name + '（' + (offer.degree === 'phd' ? '博士' : '硕士') + '）加入了课题组。' });
  return next;
}

/* ── 1.1 实验室空间（LAB-SPACE §8）：买实验室 / 买放实验台 / 摆放·移动·出售仪器 ── */

/** 明确坐标时校验；没给坐标时自动取第一个能放的位置。返回 {benchUid,x,y,rot} 或 {error}。 */
function resolvePlacement(lab, instId, payload, ignoreUid) {
  const hasXY = payload.benchUid !== undefined && payload.x !== undefined && payload.y !== undefined;
  if (!hasXY) {
    if (ignoreUid) return { error: LAB_TEXT.badSpot };
    return findSpot(lab, instId) || { error: LAB_TEXT.full };
  }
  const loc = findBench(lab, payload.benchUid);
  if (!loc) return { error: LAB_TEXT.badSpot };
  const rot = Boolean(payload.rot);
  const fp = footprint(instId, rot);
  const x = Number(payload.x);
  const y = Number(payload.y);
  if (!fits(loc.bench, fp.w, fp.h, x, y, ignoreUid)) return { error: LAB_TEXT.badSpot };
  return { benchUid: loc.bench.uid, x, y, rot };
}

function reduceBuyInstrument(state, payload) {
  const def = INSTRUMENT_MAP[payload.id];
  if (!def) return state;
  const next = cloneState(state);
  if (state.player.rankIndex < def.tierGate) {
    next.ui.toast = '这个等级的仪器要头衔 ' + def.tierGate + ' 才能申购。';
    return next;
  }
  const price = instrumentPrice(def.id);
  if (next.player.money < price) {
    next.ui.toast = '经费不足，' + def.name + ' 报价 ' + price + ' 万。';
    return next;
  }
  const spot = resolvePlacement(next.lab, def.id, payload, null);
  if (spot.error) {
    next.ui.toast = spot.error;
    return next;
  }
  const loc = findBench(next.lab, spot.benchUid);
  loc.bench.items.push({ uid: 'i' + next.lab.nextUid, inst: def.id, x: spot.x, y: spot.y, rot: spot.rot });
  next.lab.nextUid += 1;
  next.player.money = round(next.player.money - price, 2);
  next.lab.purchaseCount[def.id] = (next.lab.purchaseCount[def.id] || 0) + 1;
  recountEquipment(next.lab);
  pushChronicle(next, { kind: 'lab', tone: 'good', text: loc.room.id + ' 新到一台' + def.name + '（' + price + ' 万）。' + (def.flavor || '') });
  return next;
}

function reduceBuyRoom(state) {
  const next = cloneState(state);
  const idx = next.lab.rooms.length;
  const def = ROOMS[idx];
  if (idx >= ROOM_MAX || !def) {
    next.ui.toast = LAB_TEXT.roomsMaxed;
    return next;
  }
  if (next.player.rankIndex < def.rankGate) {
    next.ui.toast = def.name + ' 需要「' + rankOf(def.rankGate).title + '」及以上才批得下来；你现在是「' + rankOf(next.player.rankIndex).title + '」。';
    return next;
  }
  if (next.player.money < def.price) {
    next.ui.toast = '经费不足，' + def.name + ' 要 ' + def.price + ' 万。';
    return next;
  }
  next.player.money = round(next.player.money - def.price, 2);
  next.lab.rooms.push(newRoom(idx));
  pushChronicle(next, { kind: 'lab', tone: 'good', text: '申请到新实验室 ' + def.name + '（' + def.price + ' 万）。' + def.flavor });
  return next;
}

function reduceBuyBench(state, payload) {
  const type = BENCH_MAP[payload.type] ? payload.type : 'bench_std';
  const def = BENCH_MAP[type];
  const next = cloneState(state);
  let target;
  if (payload.roomIdx !== undefined && payload.slot !== undefined) {
    const roomIdx = Number(payload.roomIdx);
    const room = next.lab.rooms[roomIdx];
    const slot = Number(payload.slot);
    if (!room || !Number.isInteger(slot) || slot < 0 || slot >= room.slots.length || room.slots[slot]) {
      next.ui.toast = '这个台位不能放实验台（不存在或已占用）。';
      return next;
    }
    target = { roomIdx, slot };
  } else {
    target = findEmptySlot(next.lab);
    if (!target) {
      next.ui.toast = LAB_TEXT.noSlot;
      return next;
    }
  }
  if (next.player.rankIndex < def.rankGate) {
    next.ui.toast = def.name + '需要「' + rankOf(def.rankGate).title + '」及以上才能申购；你现在是「' + rankOf(next.player.rankIndex).title + '」。';
    return next;
  }
  if (next.player.money < def.price) {
    next.ui.toast = '经费不足，' + def.name + ' 要 ' + def.price + ' 万。';
    return next;
  }
  next.player.money = round(next.player.money - def.price, 2);
  const bench = { uid: 'b' + next.lab.nextUid, type, items: [] };
  next.lab.nextUid += 1;
  next.lab.rooms[target.roomIdx].slots[target.slot] = bench;
  pushChronicle(next, { kind: 'lab', tone: 'system', text: next.lab.rooms[target.roomIdx].id + ' 搬进一张' + def.name + '（' + def.price + ' 万）。' });
  return next;
}

function reduceSellBench(state, payload) {
  const loc = findBench(state.lab, payload.benchUid);
  if (!loc) return state;
  const next = cloneState(state);
  if (loc.bench.items.length > 0) {
    next.ui.toast = LAB_TEXT.benchNotEmpty;
    return next;
  }
  const def = BENCH_MAP[loc.bench.type];
  const refund = round(def.price * SELL_REFUND_RATE, 2);
  next.lab.rooms[loc.roomIdx].slots[loc.slot] = null;
  next.player.money = round(next.player.money + refund, 2);
  pushChronicle(next, { kind: 'lab', tone: 'system', text: '拆掉一张' + def.name + '，回收 ' + refund + ' 万。' });
  return next;
}

function reduceMoveItem(state, payload) {
  const found = findItem(state.lab, payload.itemUid);
  if (!found) return state;
  const next = cloneState(state);
  const spot = resolvePlacement(next.lab, found.item.inst, payload, found.item.uid);
  if (spot.error) {
    next.ui.toast = spot.error;
    return next;
  }
  const from = findItem(next.lab, payload.itemUid);
  from.bench.items = from.bench.items.filter((it) => it.uid !== from.item.uid);
  const to = findBench(next.lab, spot.benchUid);
  to.bench.items.push({ uid: from.item.uid, inst: from.item.inst, x: spot.x, y: spot.y, rot: spot.rot });
  recountEquipment(next.lab);
  return next;
}

function reduceSellItem(state, payload) {
  if (!findItem(state.lab, payload.itemUid)) return state;
  const next = cloneState(state);
  const loc = findItem(next.lab, payload.itemUid);
  const def = INSTRUMENT_MAP[loc.item.inst];
  const refund = round(instrumentPrice(def.id) * SELL_REFUND_RATE, 2);
  loc.bench.items = loc.bench.items.filter((it) => it.uid !== loc.item.uid);
  next.player.money = round(next.player.money + refund, 2);
  recountEquipment(next.lab);
  pushChronicle(next, { kind: 'lab', tone: 'system', text: '把一台' + def.name + '转给了兄弟课题组，回收 ' + refund + ' 万。' });
  return next;
}

/* ── 1.3 仓库（LAB-SPACE §11）：台面 ⇄ 仓库；仓库里的仪器不给加成、不收维护费 ── */

/** 失败一律「克隆 + toast」：不扣钱、不改 lab（只改 ui.toast），与既有 lab/* 动作同风格。 */
function labReject(state, text) {
  const next = cloneState(state);
  next.ui.toast = text;
  return next;
}

/** lab/storeItem { itemUid }：把台面上的某台仪器移入仓库；不在台面上则拒绝。 */
function reduceStoreItem(state, payload) {
  const found = findItem(state.lab, payload.itemUid);
  if (!found) return labReject(state, LAB_TEXT.notOnBench);
  const def = INSTRUMENT_MAP[found.item.inst];
  if (!def) return state;
  const next = cloneState(state);
  const loc = findItem(next.lab, payload.itemUid);
  loc.bench.items = loc.bench.items.filter((it) => it.uid !== loc.item.uid);
  next.lab.storage.push({ uid: loc.item.uid, inst: loc.item.inst });
  recountEquipment(next.lab);
  pushChronicle(next, { kind: 'lab', tone: 'system', text: '把一台' + def.name + '收进仓库（不占台面，也不提供加成）。' });
  return next;
}

/**
 * lab/deployItem { storageUid, benchUid?, x?, y?, rot? }：从仓库取出摆到台面。
 * 没给坐标时自动找第一个能放下的位置；放不下则拒绝，且**保持在仓库里**（不静默吞掉资产）。
 */
function reduceDeployItem(state, payload) {
  const entry = findStorageItem(state.lab, payload.storageUid);
  if (!entry) return labReject(state, LAB_TEXT.noStorageItem);
  const def = INSTRUMENT_MAP[entry.inst];
  if (!def) return state;
  const next = cloneState(state);
  const stored = findStorageItem(next.lab, payload.storageUid);
  const spot = resolvePlacement(next.lab, stored.inst, payload, null);
  if (spot.error) {
    next.ui.toast = spot.error === LAB_TEXT.badSpot ? spot.error : LAB_TEXT.storageDeployFail;
    return next;
  }
  const loc = findBench(next.lab, spot.benchUid);
  loc.bench.items.push({ uid: stored.uid, inst: stored.inst, x: spot.x, y: spot.y, rot: spot.rot });
  next.lab.storage = next.lab.storage.filter((s) => s.uid !== stored.uid);
  recountEquipment(next.lab);
  pushChronicle(next, { kind: 'lab', tone: 'good', text: loc.room.id + ' 从仓库取出一台' + def.name + '摆上了台面。' });
  return next;
}

/** lab/sellStored { storageUid }：从仓库直接卖掉，退款与台面卖出同口径（SELL_REFUND_RATE）。 */
function reduceSellStored(state, payload) {
  const entry = findStorageItem(state.lab, payload.storageUid);
  if (!entry) return labReject(state, LAB_TEXT.noStorageItem);
  const def = INSTRUMENT_MAP[entry.inst];
  if (!def) return state;
  const next = cloneState(state);
  const stored = findStorageItem(next.lab, payload.storageUid);
  const refund = round(instrumentPrice(stored.inst) * SELL_REFUND_RATE, 2);
  next.lab.storage = next.lab.storage.filter((s) => s.uid !== stored.uid);
  next.player.money = round(next.player.money + refund, 2);
  recountEquipment(next.lab);
  pushChronicle(next, { kind: 'lab', tone: 'system', text: '把仓库里的' + def.name + '转给了兄弟课题组，回收 ' + refund + ' 万。' });
  return next;
}

function reduceAcceptProject(state, payload) {
  const offer = state.market.pool.find((o) => o.offerId === payload.offerId && o.kind === 'project');
  if (!offer) return state;
  const next = cloneState(state);
  const missing = missingInstruments(next.lab, offer.require);
  const rank = rankOf(next.player.rankIndex);
  if (missing.length > 0) {
    next.ui.toast = '仪器不足：' + missing.map((m) => INSTRUMENT_MAP[m.id].name).join('、');
    return next;
  }
  if (offer.tier > rank.maxProjectTier) {
    next.ui.toast = '当前头衔最高只能承接 T' + rank.maxProjectTier + '。';
    return next;
  }
  if (activeProjects(next).length >= rank.concurrentCap) {
    next.ui.toast = '在研项目已达上限 ' + rank.concurrentCap + ' 项。';
    return next;
  }
  const def = PROJECT_MAP[offer.defId];
  const deposit = round(offer.money * (def ? def.depositRate : (offer.depositRate || DEPOSIT_RATE[offer.category] || DEPOSIT_RATE.enterprise)), 2);
  const inst = 'p' + next.counters.nextProjectId;
  next.counters.nextProjectId += 1;
  const project = createProject({
    instanceId: inst,
    defId: offer.defId,
    name: def ? def.name : offer.defId,
    category: offer.category,
    tier: offer.tier,
    workload: offer.workload,
    money: offer.money,
    depositRate: def ? def.depositRate : (offer.depositRate || DEPOSIT_RATE[offer.category] || DEPOSIT_RATE.enterprise),
    consumablePerMonth: def ? def.consumablePerMonth : 0,
    paperTiers: def ? def.papers.slice() : [],
    acceptMonthIndex: next.calendar.monthIndex,
    deadlineMonthIndex: next.calendar.monthIndex + offer.limitMonths,
  });
  for (let i = 0; i < hardpointCount(offer.tier); i += 1) {
    // 难点出现在工期前段：第 i 个难点约在 limit × (i+1)/(K+1) 处暴露
    const appearAt = Math.round((next.calendar.monthIndex) + (offer.limitMonths * (i + 1)) / (hardpointCount(offer.tier) + 1));
    project.hardpoints.push({ id: inst + '-h' + (i + 1), hd: 1, hdRolled: false, status: 'hidden', appearAt, retries: 0, method: null });
  }
  next.projects.push(project);
  next.player.money = round(next.player.money + deposit, 2);
  next.player.consumable = round(next.player.consumable + deposit * DEPOSIT_TO_CONSUMABLE, 2);
  next.market.pool = next.market.pool.filter((o) => o.offerId !== offer.offerId);
  const assigned = Array.isArray(payload.studentIds) ? payload.studentIds : [];
  for (const sid of assigned) {
    const st = next.students.find((s) => s.id === sid);
    if (st && !st.left && !st.graduated && st.projectIds.length < MAX_PROJECTS_PER_STUDENT) {
      st.projectIds.push(inst);
      project.assignedStudentIds.push(sid);
    }
  }
  pushChronicle(next, { kind: 'project', tone: 'good', text: '承接「' + project.name + '」，定金 ' + deposit + ' 万到账。' });
  return next;
}

function reduceLockOffer(state, payload) {
  const offer = state.market.pool.find((o) => o.offerId === payload.offerId);
  if (!offer) return state;
  const next = cloneState(state);
  const locked = next.market.pool.filter((o) => o.locked).length;
  if (offer.locked) {
    offer.locked = false;
    next.market.lockedOfferId = null;
    return next;
  }
  if (locked >= LOCKABLE_SLOTS) {
    next.ui.toast = '最多只能锁定 ' + LOCKABLE_SLOTS + ' 个项目。';
    return next;
  }
  offer.locked = true;
  next.market.lockedOfferId = offer.offerId;
  return next;
}

/* ── 一键分配工作（t25） ── */

/**
 * 一键分配的分配计划。**纯推导**：不改 state、不掷点（同一份 state 永远得到同一份计划）。
 * reduceAutoAssign（引擎真做）与 selectors.selectAutoAssign（UI 预览/回显）共用它，
 * 保证「引擎会做的」与「界面上看到的」永远是同一件事，UI 不需要自己推导。
 *
 * 规则（按序）：
 *   ① 先让每一名还有名额的活跃学生至少挂 1 个在研项目；
 *   ② 再把剩下的名额补进「人数不足」的项目（缺人最多的先补，同级看等级高、id 小）。
 * 约束：学生最多 MAX_PROJECTS_PER_STUDENT 个在研项目；单个项目最多 PROJECT_MAX_STUDENTS 人。
 */
export function autoAssignPlan(state) {
  const students = state.students.filter((st) => !st.left && !st.graduated);
  const projects = state.projects.filter((p) => p.status === 'active');
  const members = new Map(projects.map((p) => [p.instanceId, p.assignedStudentIds.length]));
  const sim = students.map((st) => ({ id: st.id, name: st.name, ability: st.ability, ids: st.projectIds.slice() }));
  const moves = [];
  const pick = (st) => projects
    .filter((p) => !st.ids.includes(p.instanceId) && (members.get(p.instanceId) || 0) < PROJECT_MAX_STUDENTS)
    .sort((a, b) => ((members.get(a.instanceId) || 0) - (members.get(b.instanceId) || 0))
      || (b.tier - a.tier) || (a.instanceId < b.instanceId ? -1 : 1))[0] || null;
  const take = (st) => {
    if (st.ids.length >= MAX_PROJECTS_PER_STUDENT) return false;
    const project = pick(st);
    if (!project) return false;
    st.ids.push(project.instanceId);
    members.set(project.instanceId, (members.get(project.instanceId) || 0) + 1);
    moves.push({ studentId: st.id, studentName: st.name, projectId: project.instanceId, projectName: project.name || project.defId });
    return true;
  };
  // 轮转顺序：手上项目少的先照顾，同数量看能力高的（更早把进度推起来）
  const order = sim.slice().sort((a, b) => (a.ids.length - b.ids.length) || (b.ability - a.ability) || (a.id < b.id ? -1 : 1));
  for (const st of order) if (st.ids.length === 0) take(st);   // ① 每人至少一个
  let moving = true;
  let guard = 0;
  const guardMax = students.length * MAX_PROJECTS_PER_STUDENT + 1;
  while (moving && guard < guardMax) {                          // ② 继续铺满（到学生名额或项目人数上限为止）
    moving = false;
    guard += 1;
    for (const st of sim) if (take(st)) moving = true;
  }
  const names = (list) => list.map((st) => st.name);
  const withoutProject = sim.filter((st) => st.ids.length === 0);
  const full = sim.filter((st) => st.ids.length >= MAX_PROJECTS_PER_STUDENT);
  const availableStudents = sim.filter((st) => st.ids.length < MAX_PROJECTS_PER_STUDENT).length;
  const projectsShort = projects
    .map((p) => ({ id: p.instanceId, name: p.name || p.defId, members: members.get(p.instanceId) || 0, cap: PROJECT_MAX_STUDENTS }))
    .filter((p) => p.members < p.cap);
  const touched = new Set(moves.map((m) => m.studentId)).size;
  let feedback;
  if (moves.length > 0) {
    feedback = '一键分配：安排了 ' + moves.length + ' 个岗位给 ' + touched + ' 名学生'
      + (withoutProject.length ? '；还有 ' + withoutProject.length + ' 人排不下（' + names(withoutProject).join('、') + '）' : '')
      + (projectsShort.length ? '；' + projectsShort.length + ' 个项目仍缺人' : '') + '。';
  } else if (students.length === 0) {
    feedback = '课题组里没有在读学生，没人可分。';
  } else if (projects.length === 0) {
    feedback = '现在没有在研项目，先去「项目」页接一个本子。';
  } else if (availableStudents === 0) {
    feedback = '所有在读学生都带满 ' + MAX_PROJECTS_PER_STUDENT + ' 个项目了，腾不出人手。';
  } else if (projectsShort.length === 0) {
    feedback = '所有在研项目都已经满 ' + PROJECT_MAX_STUDENTS + ' 人了，不用再分。';
  } else {
    feedback = '没分出去：' + projectsShort.length + ' 个项目仍缺人，但' + availableStudents
      + ' 名还有名额的学生都已经在这些项目里了。';
  }
  return {
    moves,
    summary: {
      moveCount: moves.length,
      studentsTouched: touched,
      studentsTotal: students.length,
      projectsTotal: projects.length,
      availableStudents,
      studentsWithoutProject: names(withoutProject),
      studentsFull: names(full),
      projectsShort,
      studentCap: MAX_PROJECTS_PER_STUDENT,
      projectCap: PROJECT_MAX_STUDENTS,
      feedback,
    },
  };
}

/**
 * 一键分配工作：把可用学生按 autoAssignPlan 分配进在研项目。
 * 幂等：已经分好的不会再动，连点两次的分配集合完全一致（第二次 moves 为空、只回一句反馈）。
 * 不掷点：同一份 state 的分配结果可复现；也不改任何数值常量。
 */
function reduceAutoAssign(state) {
  const plan = autoAssignPlan(state);
  const next = cloneState(state);
  const summary = { ...plan.summary, monthIndex: next.calendar.monthIndex };
  if (plan.moves.length === 0) {
    next.ui.toast = plan.summary.feedback;
    next.ui.autoAssign = summary;
    return next;
  }
  for (const mv of plan.moves) {
    const st = next.students.find((s) => s.id === mv.studentId);
    const project = next.projects.find((p) => p.instanceId === mv.projectId && p.status === 'active');
    if (!st || !project) continue;
    if (st.projectIds.includes(project.instanceId)) continue;
    if (st.projectIds.length >= MAX_PROJECTS_PER_STUDENT) continue;
    if (project.assignedStudentIds.length >= PROJECT_MAX_STUDENTS) continue;
    st.projectIds.push(project.instanceId);
    project.assignedStudentIds.push(st.id);
  }
  next.ui.toast = plan.summary.feedback;
  next.ui.autoAssign = summary;
  pushChronicle(next, { kind: 'student', tone: 'system', text: plan.summary.feedback });
  return next;
}

function reduceAssign(state, payload, assign) {
  const next = cloneState(state);
  const project = next.projects.find((p) => p.instanceId === payload.projectId && p.status === 'active');
  const st = next.students.find((s) => s.id === payload.studentId);
  if (!project || !st || st.left || st.graduated) return state;
  if (assign) {
    if (st.projectIds.includes(project.instanceId)) return state;
    if (st.projectIds.length >= MAX_PROJECTS_PER_STUDENT) {
      next.ui.toast = st.name + '最多同时负责 ' + MAX_PROJECTS_PER_STUDENT + ' 个项目。';
      return next;
    }
    // t30：手工分配与一键分配同一套约束——项目人数上限取 UI 透传的 projectCap，缺省 PROJECT_MAX_STUDENTS。
    const cap = Number.isFinite(payload.projectCap) && payload.projectCap > 0 ? Math.floor(payload.projectCap) : PROJECT_MAX_STUDENTS;
    if (project.assignedStudentIds.length >= cap) {
      next.ui.toast = '这个项目已经满 ' + cap + ' 人了，再加就成开大会了。';
      return next;
    }
    st.projectIds.push(project.instanceId);
    project.assignedStudentIds.push(st.id);
  } else {
    st.projectIds = st.projectIds.filter((id) => id !== project.instanceId);
    project.assignedStudentIds = project.assignedStudentIds.filter((id) => id !== st.id);
  }
  return next;
}

function reduceToggleLead(state, payload) {
  const next = cloneState(state);
  const project = next.projects.find((p) => p.instanceId === payload.projectId && p.status === 'active');
  if (!project) return state;
  const leading = activeProjects(next).filter((p) => p.playerLeading).length;
  if (!project.playerLeading && leading >= Math.max(1, Math.floor(energyMax(next) / 2))) {
    next.ui.toast = '精力有限，亲带不了更多项目了。';
    return next;
  }
  project.playerLeading = !project.playerLeading;
  return next;
}

function reduceResolveHardpoint(state, payload) {
  const next = cloneState(state);
  const rng = createRng(next.rng);
  const project = next.projects.find((p) => p.instanceId === payload.projectId && p.status === 'active');
  const method = HARDPOINT_METHODS[payload.method];
  if (!project || !method) return state;
  const hp = project.hardpoints.find((h) => h.id === payload.hardpointId)
    || project.hardpoints.find((h) => h.status === 'open' || h.status === 'hidden');
  if (!hp) return state;
  hp.status = 'open';
  if (hp.appearAt > next.calendar.monthIndex) hp.appearAt = next.calendar.monthIndex;
  // 修复：难度必须在「第一次被打开」时掷点。旧实现只在 settleProjects 的 hidden→open
  // 分支里掷 hd，于是提前攻坚的隐藏难点永远保持占位值 hd=1（进度惩罚与论文降档都白送）。
  if (!hp.hdRolled) {
    hp.hd = rollHardpointHd(project.tier, rng);
    hp.hdRolled = true;
  }

  if (payload.method === 'team') {
    const ids = Array.isArray(payload.studentIds) ? payload.studentIds : [];
    if (ids.length < TEAM_MIN_STUDENTS) {
      next.ui.toast = '多人攻坚至少要 ' + TEAM_MIN_STUDENTS + ' 个人。';
      return next;
    }
    if (next.player.money < TEAM_MONEY) {
      next.ui.toast = '经费不足（需要 ' + TEAM_MONEY + ' 万）。';
      return next;
    }
    next.player.money = round(next.player.money - TEAM_MONEY, 2);
    const members = ids.map((id) => next.students.find((s) => s.id === id)).filter((s) => s && !s.left && !s.graduated);
    for (const st of members) st.happiness = clampHappiness(st.happiness + TEAM_STUDENT_HAPPY);
    // GDD §6.3 / BALANCE §4.3：「其他项目**本月**进度 −25%（按抽调比例摊）」。
    // 旧实现写的是 other.progress *= 0.75（扣掉的是**累计**进度），在 4–6 个在研项目下
    // 一次攻坚就要吃掉相当于一整个项目的进度，多人攻坚长期净亏 → 大项目永远结不了题。
    // 现在改成「本月进度乘子」，月底结算时消费一次，与文档口径一致。
    for (const other of activeProjects(next)) {
      if (other.instanceId === project.instanceId) continue;
      const cur = Number.isFinite(other.distractMul) ? other.distractMul : 1;
      other.distractMul = round(cur * (1 + TEAM_OTHER_PROJECT_MUL), 4);
    }
    const chance = teamSuccessChance(members, retryBonus(hp.retries));
    if (rng.chance(chance)) {
      hp.status = 'solved';
      hp.method = 'team';
      pushChronicle(next, { kind: 'hardpoint', tone: 'good', text: project.name + '：多人攻坚成功攻克难点。' });
    } else {
      hp.retries += 1;
      hp.method = 'team';
      pushChronicle(next, { kind: 'hardpoint', tone: 'bad', text: project.name + '：攻坚一个月，难点还在。' });
    }
  } else if (payload.method === 'fake') {
    if (next.player.money < FAKE_MONEY) return state;
    next.player.money = round(next.player.money - FAKE_MONEY, 2);
    const holders = project.assignedStudentIds.map((id) => next.students.find((s) => s.id === id)).filter((s) => s && !s.left && !s.graduated);
    const victim = holders[0];
    if (victim) victim.happiness = clampHappiness(victim.happiness + FAKE_STUDENT_HAPPY);
    hp.status = 'faked';
    hp.method = 'fake';
    next.counters.fakesTotal += 1;
    hp.fakeCount = (hp.fakeCount || 0) + 1;
    addIntegrity(next, FAKE_INTEGRITY);
    const chance = fakeCatchChance(hp.fakeCount, next.counters.fakesTotal);
    if (rng.chance(chance)) {
      addIntegrity(next, FAKE_CAUGHT_INTEGRITY);
      project.progress = round(project.progress * (1 + FAKE_CAUGHT_PROGRESS_MUL), 2);
      if (next.player.integrity <= 25) next.flags.caughtRedHanded = true;
      pushChronicle(next, { kind: 'audit', tone: 'bad', text: '造假被查：诚信 ' + (FAKE_INTEGRITY + FAKE_CAUGHT_INTEGRITY) + '，项目进度回退。', });
    } else {
      pushChronicle(next, { kind: 'hardpoint', tone: 'absurd', text: project.name + '：改了数据，暂时没人发现。' });
    }
  } else if (payload.method === 'solo') {
    // 契约 §3.1：solo 也走 studentIds（取第 1 个）；这里同时容忍 studentId 写法。
    const soloId = Array.isArray(payload.studentIds) ? payload.studentIds[0] : payload.studentId;
    const st = next.students.find((s) => s.id === soloId);
    if (!st) {
      next.ui.toast = '单人猛干要指定一名学生。';
      return next;      // 修复：旧实现在校验前就扣了 5 万，呼叫失败也要付钱
    }
    if (next.player.money < SOLO_MONEY) return state;
    next.player.money = round(next.player.money - SOLO_MONEY, 2);
    st.happiness = clampHappiness(st.happiness + SOLO_STUDENT_HAPPY);
    // GDD §6.3：「该生本月产出全部用于攻坚，不计入任何项目进度」。
    st.soloThisMonth = true;
    const chance = soloSuccessChance(st.ability, retryBonus(hp.retries));
    if (rng.chance(chance)) {
      hp.status = 'solved';
      hp.method = 'solo';
      pushChronicle(next, { kind: 'hardpoint', tone: 'good', text: st.name + '一个人把难点磨过去了。' });
    } else {
      hp.retries += 1;
      hp.method = 'solo';
      st.happiness = clampHappiness(st.happiness + SOLO_FAIL_HAPPY);
      pushChronicle(next, { kind: 'hardpoint', tone: 'bad', text: st.name + '一个人扛了一个月，难点没动，人先垮了。' });
    }
  }
  next.rng = rng.snapshot();
  return next;
}

function reduceBuyFirstAuthor(state, payload) {
  const next = cloneState(state);
  // 与抢一作同类问题（t8 finding ④）：档位必须由 UI 明确给出，不再默认成二区。
  const tier = typeof payload.tier === 'string' ? payload.tier : '';
  const price = PAPER_BUY_PRICE[tier];
  if (!tier || price === undefined) {
    next.ui.toast = '买一作要指定档位（正刊 / 一区 / 二区 / 三区 / 四区）。';
    return next;
  }
  if (next.player.money < price) {
    next.ui.toast = '买一作要 ' + price + ' 万，经费不够。';
    return next;
  }
  next.player.money = round(next.player.money - price, 2);
  next.player.papersFirst[tier] = (next.player.papersFirst[tier] || 0) + 1;
  next.player.lastFirstAuthorMonthIndex = next.calendar.monthIndex;
  next.counters.boughtPapers += 1;
  addIntegrity(next, INTEGRITY_DELTA.buyFirst);
  // 买来的一作：老板一作数恰好 +1（t24 起 awardPaper 只在 playerFirst 时计数）。
  awardPaper(next, tier, { playerFirst: true });
  pushChronicle(next, { kind: 'paper', tone: 'absurd', text: '花钱买了一篇 ' + tier + ' 一作（' + price + ' 万）。', });
  return next;
}

/** 在所有项目（含结题档案）的论文台帐里按 paperId 找一篇。 */
function findPaperRecord(state, paperId) {
  for (const project of state.projects) {
    const list = Array.isArray(project.paperTiers) ? project.paperTiers : [];
    for (const paper of list) {
      if (paper && typeof paper === 'object' && paper.paperId === paperId) return { project, paper };
    }
  }
  return null;
}

/** 该生本月是否已经抢过一作（每生每月最多一次，记录写在论文台帐的 grabbedMonthIndex 上）。 */
export function grabbedPaperThisMonth(state, studentId) {
  return state.projects.some((project) => (Array.isArray(project.paperTiers) ? project.paperTiers : [])
    .some((paper) => paper && typeof paper === 'object'
      && paper.firstAuthorId === studentId
      && paper.grabbed
      && paper.grabbedMonthIndex === state.calendar.monthIndex));
}

/**
 * 抢学生一作（GDD §5.5 / §8）。
 * t8 finding ①②④：
 *   · 只能抢「结题产出的、该生为一作、尚未被抢」的那一篇（payload 必须带 paperId + tier）；
 *   · 一篇只能抢一次（写回台帐 grabbed），每生每月最多一次；
 *   · 档位以台帐为准，缺 tier 直接拒绝——不再有 payload.tier || 'q1' 的静默默认。
 */
function reduceGrabFirstAuthor(state, payload) {
  const next = cloneState(state);
  const st = next.students.find((s) => s.id === payload.studentId);
  if (!st || st.left || st.graduated) return state;
  const reject = (msg) => {
    next.ui.toast = msg;
    return next;
  };
  const tier = typeof payload.tier === 'string' ? payload.tier : '';
  const paperId = typeof payload.paperId === 'string' ? payload.paperId : '';
  if (!tier || !paperId) return reject('抢一作要点具体某一篇（缺 tier / paperId），这次动作被拒绝了。');
  const found = findPaperRecord(next, paperId);
  if (!found) return reject('找不到这篇论文的台帐，动作被拒绝。');
  const paper = found.paper;
  if (paper.firstAuthorId !== st.id) return reject(st.name + ' 不是这篇论文的一作，抢不了。');
  if (paper.grabbed) return reject('这一篇已经抢过了：一篇只能抢一次。');
  if (paper.tier !== tier) return reject('档位和论文台帐对不上，动作被拒绝。');
  if (grabbedPaperThisMonth(next, st.id)) {
    return reject(st.name + ' 这个月已经抢过一篇了，一篇还不够？下个月再来。');
  }
  paper.grabbed = true;
  paper.grabbedMonthIndex = next.calendar.monthIndex;
  st.happiness = clampHappiness(st.happiness + GRAB_FIRST_HAPPY);
  st.grudgeMonths = GRAB_GRUDGE_MONTHS;
  next.player.papersFirst[paper.tier] = (next.player.papersFirst[paper.tier] || 0) + 1;
  next.counters.grabbedPapers += 1;
  addIntegrity(next, INTEGRITY_DELTA.grabFirst);
  // t16 F2（high）：这篇论文的影响因子在结题 awardPaper 时**已经计过**，
  // 抢一作只是把「一作署名」挪到玩家头上（诚信 -8 + 学生记仇），不得再计一次 IF。
  // 仍然记进 papers 计数台账（代表作口径），但不碰 totalIF —— 见 CONTRACT §2 的口径说明。
  // t24：抢到手 = 这篇的一作变成老板本人。结题时它按「学生一作」没进过 papers，
  // 所以这里恰好 +1；不再调 awardPaper——IF 在结题那一刻已经计过，绝不重复计。
  next.player.papers[paper.tier] = (next.player.papers[paper.tier] || 0) + 1;
  next.player.lastFirstAuthorMonthIndex = next.calendar.monthIndex;
  pushChronicle(next, { kind: 'paper', tone: 'bad', text: '把 ' + st.name + ' 的 ' + paper.tier + ' 一作改成了自己的名字。', });
  return next;
}

/* ── 事件结算 ── */
function reduceResolveEvent(state, payload) {
  const next = cloneState(state);
  const rng = createRng(next.rng);
  const pending = next.pendingEvent;
  const log = (kind, text, tone) => pushChronicle(next, { kind, text, tone: tone || 'system' });
  void payload;
  if (!pending) return state;
  resolvePendingEvent(next, rng, log, payload.choiceId);
  next.rng = rng.snapshot();
  checkEnding(next, log);
  return next;
}

function resolvePendingEvent(state, rng, log, choiceId) {
  const pending = state.pendingEvent;
  if (!pending) return;
  const ev = EVENT_MAP[pending.eventId];
  const ctx = { student: null, project: null };
  if (ev) {
    const effects = pickEventEffects(ev, choiceId);
    applyEffects(state, effects, ctx, rng, log);
    state.month.eventsResolved.push(ev.id);
  }
  const queue = Array.isArray(state.month.pendingQueue) ? state.month.pendingQueue.slice(1) : [];
  state.month.pendingQueue = queue;
  state.pendingEvent = queue.length > 0 ? queue[0] : null;
  if (!state.pendingEvent && state.phase === 'settle') state.phase = 'action';
}

function pickEventEffects(ev, choiceId) {
  if (!Array.isArray(ev.choices) || ev.choices.length === 0) return ev.effects || [];
  const choice = choiceId ? ev.choices.find((c) => c.id === choiceId) : null;
  const picked = choice || ev.choices[0];
  return picked.effects || [];
}

/**
 * 事件效果 DSL 求值。支持的 kind：
 *   selectStudent(pick) selectProject(pick) money consumable integrity energy health energyMaxDelta
 *   studentHappy(target,value) studentDegree studentAbility studentOutputMul studentLeave
 *   projectProgress(target,mode,value) projectPaperShift ticket instrumentDown meetingNull
 *   consumeMulNextMonth wageExpectShift if(cond,then)
 */
export function applyEffects(state, effects, ctx, rng, log) {
  for (const eff of effects || []) {
    if (!eff || typeof eff !== 'object') continue;
    switch (eff.kind) {
      case 'selectStudent': {
        ctx.student = pickStudent(state, eff.pick, rng);
        break;
      }
      case 'selectProject': {
        ctx.project = pickProject(state, eff.pick, rng);
        break;
      }
      case 'money': {
        state.player.money = round(state.player.money + Number(eff.value || 0), 2);
        break;
      }
      case 'consumable': {
        // 修复：'mul' 分支原来没有夹到 0，事件（如断电事故 consumable -4）会把耗材资金变成负数，
        // UI 回执上就会显示「-2 单位」。任何路径都不允许出现负的耗材资金。
        const raw = eff.mode === 'mul'
          ? state.player.consumable * Number(eff.value || 1)
          : state.player.consumable + Number(eff.value || 0);
        state.player.consumable = round(Math.max(0, raw), 2);
        break;
      }
      case 'integrity': addIntegrity(state, Number(eff.value || 0)); break;
      case 'energy': state.player.energy = Math.max(0, state.player.energy + Number(eff.value || 0)); break;
      case 'health': state.player.health = Math.round(clamp(state.player.health + Number(eff.value || 0), 0, HEALTH_MAX)); break;
      case 'energyMaxDelta': state.player.energyMaxDelta = (state.player.energyMaxDelta || 0) + Number(eff.value || 0); break;
      case 'ticket': state.player.tickets += Number(eff.value || 0); break;
      case 'instrumentDown': {
        if (state.lab.equipmentDown[eff.instrument] !== undefined) {
          state.lab.equipmentDown[eff.instrument] = Math.max(state.lab.equipmentDown[eff.instrument] || 0, Number(eff.months || MACHINE_DOWN_MONTHS));
        }
        break;
      }
      case 'consumeMulNextMonth': state.lab.consumeMulThisMonth = round((state.lab.consumeMulThisMonth || 1) * Number(eff.value || 1), 3); break;
      case 'meetingNull': break; // 组会白开：UI 层提示，数值上无事发生
      case 'studentHappy': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) st.happiness = clampHappiness(st.happiness + Number(eff.value || 0));
        break;
      }
      case 'studentDegree': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) st.degreeProgress = round(clamp(st.degreeProgress + Number(eff.value || 0), 0, DEGREE_PROGRESS_MAX), 2);
        break;
      }
      case 'studentAbility': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) st.ability = round(clamp(st.ability + Number(eff.value || 0), ABILITY_MIN, ABILITY_MAX), 3);
        break;
      }
      case 'studentOutputMul': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) {
          st.outputMul = Number(eff.value || 1);
          st.outputMulMonths = Number(eff.months || 1);
        }
        break;
      }
      case 'studentLeave': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) {
          st.left = true;
          state.month.leavesThisMonth = (state.month.leavesThisMonth || 0) + 1;
          for (const pid of st.projectIds) {
            const project = state.projects.find((p) => p.instanceId === pid);
            if (project && project.status === 'active') {
              project.progress = round(project.progress * Number(eff.progressMul || 1), 2);
              project.assignedStudentIds = project.assignedStudentIds.filter((id) => id !== st.id);
            }
          }
          st.projectIds = [];
        }
        break;
      }
      case 'projectProgress': {
        const project = eff.target === 'ctx' ? ctx.project : state.projects.find((p) => p.instanceId === eff.target);
        if (project) {
          if (eff.mode === 'mul') project.progress = round(project.progress * Number(eff.value || 1), 2);
          else project.progress = round(Math.max(0, project.progress + Number(eff.value || 0)), 2);
        }
        break;
      }
      case 'projectPaperShift': {
        const project = eff.target === 'ctx' ? ctx.project : state.projects.find((p) => p.instanceId === eff.target);
        if (project && project.paperTiers.length > 0) {
          const shift = Number(eff.value || 0);
          project.paperTiers = project.paperTiers.map((p) => {
            // 已结题项目的 paperTiers 是论文台帐（对象），槽位升降档只对未结题的模板生效
            if (p && typeof p === 'object') return p;
            if (shift < 0) return downgradePaperPattern(p);
            return upgradePaperPattern(p);
          });
        }
        break;
      }
      case 'wageExpectShift': {
        const targets = resolveStudentTargets(state, eff.target, ctx);
        for (const st of targets) st.wageExpectShift = (st.wageExpectShift || 0) + Number(eff.value || 0);
        break;
      }
      case 'if': {
        if (evaluateCondition(eff.cond, { state, student: ctx.student, project: ctx.project })) {
          applyEffects(state, eff.then, ctx, rng, log);
        }
        break;
      }
      default:
        console.warn('[engine] 未知事件效果：', eff.kind);
    }
  }
  if (log && ctx.student) void log;
}

function pickStudent(state, pick, rng) {
  const pool = activeStudents(state);
  if (pool.length === 0) return null;
  switch (pick) {
    case 'lowestHappy': return pool.reduce((a, b) => (a.happiness <= b.happiness ? a : b));
    case 'randomHappyHigh': {
      const high = pool.filter((s) => s.happiness >= 50);
      return rng.pick(high.length ? high : pool);
    }
    case 'randomHappyLow': {
      const low = pool.filter((s) => s.happiness < 60);
      return rng.pick(low.length ? low : pool);
    }
    case 'examSource': {
      const exam = pool.filter((s) => s.source === 'exam');
      return rng.pick(exam.length ? exam : pool);
    }
    case 'hasGrudge': {
      const g = pool.filter((s) => s.grudgeMonths > 0);
      return rng.pick(g.length ? g : pool);
    }
    case 'poachable': {
      const rich = pool.filter((s) => s.ability >= POACHABLE_ABILITY_MIN && s.happiness < POACHABLE_HAPPY_MAX);
      return rng.pick(rich.length ? rich : pool);
    }
    default: return rng.pick(pool);
  }
}

function pickProject(state, pick, rng) {
  const pool = activeProjects(state);
  if (pool.length === 0) return null;
  if (pick === 'enterprise') {
    const ent = pool.filter((p) => p.category === 'enterprise');
    return rng.pick(ent.length ? ent : pool);
  }
  return rng.pick(pool);
}

function resolveStudentTargets(state, target, ctx) {
  if (target === 'ctx') return ctx.student ? [ctx.student] : [];
  if (target === 'ctxStudents') return ctx.project ? ctx.project.assignedStudentIds.map((id) => state.students.find((s) => s.id === id)).filter(Boolean) : [];
  if (target === 'all') return activeStudents(state);
  return [];
}

/** 模板升/降一档：顺序取自 data 层（PAPER_PATTERN_ORDER，按 expectedIF 降序）。 */
function downgradePaperPattern(patternId) {
  const order = PAPER_PATTERN_ORDER;
  const idx = order.indexOf(patternId);
  return order[Math.min(order.length - 1, idx + 1)] || patternId;
}

function upgradePaperPattern(patternId) {
  const order = [...PAPER_PATTERN_ORDER].reverse();
  const idx = order.indexOf(patternId);
  return order[Math.min(order.length - 1, idx + 1)] || patternId;
}

/* ── 头衔与结局 ── */
function checkElectionWindow(state, log) {
  const monthIndex = state.calendar.monthIndex;
  const open = monthIndex > 0 && monthIndex % ELECTION_WINDOW_INTERVAL === 0;
  state.flags.electionWindowOpen = open;
  if (open) {
    state.flags.lastElectionMonthIndex = monthIndex;
    log('system', '增选窗口打开了：每两年一次，推荐票和材料要在这个时候递上去。', 'system');
    // t30（BALANCE §18.6）：已经在 rank7 候选席上、但票不够选不上的，记一次「错过窗口」，
    // 推荐票门槛随之上调（3 + 2×错过数，上限 9）——票因此变成实质机制，而不是叙事装饰。
    if (state.player.rankIndex === RANKS.length - 2) {
      const need = ticketRequirement(state);
      if (state.player.tickets < need) {
        state.player.missedElectionWindows = Math.max(0, Math.floor(Number(state.player.missedElectionWindows) || 0)) + 1;
        log('system', '这一轮增选票不够（' + state.player.tickets + '/' + need + '）。同行说：下一次得再攒两份推荐。', 'warn');
      }
    }
  }
  // GDD §10「准院士」：达到 rank 7 之后触发退休，或票数够了却错过最后一个增选窗口。
  // 修复：旧实现写成「窗口一关就置 almost」，导致 rank7+3 票的玩家在第一个窗口关闭后
  // 立刻被强制结束（最早第 25 月），与 GDD 不符，也让「刷到院士」变得不可能。
  // 现在只在「最后一个增选窗口」（= 退休月的那个窗口，之后不再有窗口）才判 almost。
  const lastWindow = Math.floor(RETIRE_MONTH / ELECTION_WINDOW_INTERVAL) * ELECTION_WINDOW_INTERVAL;
  const missedLastWindow = monthIndex >= lastWindow && state.player.rankIndex === RANKS.length - 2;
  const retiredAtRank7 = monthIndex >= RETIRE_MONTH && state.player.rankIndex === RANKS.length - 2;
  if (missedLastWindow || retiredAtRank7) state.flags.almostAcademician = true;
}

function checkPromotion(state, log) {
  const status = promotionStatus(state);
  if (!status.next) return;
  if (!status.eligible) return;
  state.player.rankIndex = status.next.index;
  addIntegrity(state, INTEGRITY_DELTA.promote);
  log('rank', '晋升：' + status.rank.title + ' → ' + status.next.title + '。', 'good');
  if (status.next.index >= RANKS.length - 1) {
    state.ending = { id: 'academician', title: '院士', monthIndex: state.calendar.monthIndex, text: '' };
    state.phase = 'ended';
  }
}

function checkEnding(state, log) {
  if (state.ending) return;
  if (state.player.money < 0) {
    state.flags.negativeMoneyMonths = (state.flags.negativeMoneyMonths || 0) + 1;
  } else {
    state.flags.negativeMoneyMonths = 0;
  }
  state.flags.bankrupt = isBankrupt(state) && state.player.consumable <= 0;
  state.flags.labEmptyThisMonth = isLabEmpty(state);
  if (state.calendar.monthIndex >= RETIRE_MONTH) state.flags.retired = true;
  const found = endingFor(state);
  if (found) {
    state.ending = {
      id: found.ending.id,
      title: found.variant ? found.variant.id + ' · ' + found.ending.title : found.ending.title,
      text: found.variant ? found.variant.text : found.ending.text,
      monthIndex: state.calendar.monthIndex,
      variant: found.variant ? found.variant.id : 'default',
    };
    state.phase = 'ended';
    log('ending', '结局：' + state.ending.title, found.ending.kind === 'bad' ? 'bad' : 'good');
  }
}

/**
 * 改名字（t5 验收：总览面板姓名可改）。
 * payload: { name?: string, sonName?: string }
 * 规则：trim + 压缩空格 + 截断到 PLAYER_NAME_MAX_LENGTH；空值给 toast 不改 state；
 *       改成功写一条 kind=system 的纪事，便于无头模拟/存档回看。
 */
function reduceSetName(state, payload) {
  const clean = (v) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  const next = cloneState(state);
  const nextName = payload.name === undefined ? next.player.name : clean(payload.name);
  const nextSon = payload.sonName === undefined ? next.player.sonName : clean(payload.sonName);
  const changed = [];
  if (payload.name !== undefined) {
    if (!nextName) { next.ui.toast = '名字不能是空的。'; return next; }
    if (nextName !== next.player.name) {
      changed.push('你自己改名叫「' + nextName + '」（原名 ' + next.player.name + '）');
      next.player.name = nextName;
    }
  }
  if (payload.sonName !== undefined) {
    if (!nextSon) { next.ui.toast = '你儿子的名字不能是空的。'; return next; }
    if (nextSon !== next.player.sonName) {
      changed.push('你儿子改名叫「' + nextSon + '」（原名 ' + next.player.sonName + '）');
      next.player.sonName = nextSon;
    }
  }
  if (changed.length === 0) { next.ui.toast = '名字没变。'; return next; }
  pushChronicle(next, { kind: 'system', tone: 'system', text: '课题组更名：' + changed.join('；') + '。' });
  return next;
}

function reduceResign(state) {
  if (state.ending) return state;
  const next = cloneState(state);
  next.flags.resigned = true;
  const found = endingFor(next);
  next.ending = { id: 'industry', title: '下海', text: found ? (found.variant ? found.variant.text : found.ending.text) : '', monthIndex: next.calendar.monthIndex };
  next.phase = 'ended';
  pushChronicle(next, { kind: 'ending', tone: 'system', text: '你交了辞职报告，去企业做技术副总。' });
  return next;
}

/* ── 工具 ── */
export function addIntegrity(state, delta) {
  state.player.integrity = Math.round(clamp(state.player.integrity + Number(delta || 0), INTEGRITY_MIN, INTEGRITY_MAX));
  return state.player.integrity;
}

export function pushChronicle(state, entry) {
  const record = createChronicleEntry({
    id: 'c' + state.counters.nextChronicleId,
    monthIndex: state.calendar.monthIndex,
    year: state.calendar.year,
    month: state.calendar.month,
    kind: entry.kind || 'note',
    tone: entry.tone || 'system',
    text: entry.text || '',
  });
  state.counters.nextChronicleId += 1;
  state.chronicle.push(record);
  if (state.chronicle.length > 500) state.chronicle.splice(0, state.chronicle.length - 500);
  return record;
}

function recordHistory(state) {
  const students = activeStudents(state);
  const record = {
    monthIndex: state.calendar.monthIndex,
    year: state.calendar.year,
    month: state.calendar.month,
    money: state.player.money,
    consumable: state.player.consumable,
    totalIF: state.player.totalIF,
    rankIndex: state.player.rankIndex,
    health: state.player.health,
    integrity: state.player.integrity,
    students: students.length,
    activeProjects: activeProjects(state).length,
    avgHappiness: students.length ? round(students.reduce((s, st) => s + st.happiness, 0) / students.length, 1) : 0,
    avgDegree: students.length ? round(students.reduce((s, st) => s + st.degreeProgress, 0) / students.length, 1) : 0,
    tickets: state.player.tickets,
    papers: { ...state.player.papers },
  };
  state.stats.history.push(record);
  if (state.stats.history.length > 600) state.stats.history.shift();
  state.stats.peak.totalIF = Math.max(state.stats.peak.totalIF, record.totalIF);
  state.stats.peak.money = Math.max(state.stats.peak.money, record.money);
  state.stats.peak.students = Math.max(state.stats.peak.students, record.students);
  return record;
}

function reduceUi(state, patch) {
  const next = cloneState(state);
  if (patch.tab !== undefined && patch.tab) next.ui.tab = patch.tab;
  if (patch.modal !== undefined) next.ui.modal = patch.modal;
  if (patch.toast !== undefined) next.ui.toast = patch.toast;
  if (patch.studentId !== undefined) next.ui.selectedStudentId = patch.studentId;
  if (patch.projectId !== undefined) next.ui.selectedProjectId = patch.projectId;
  return next;
}

/** 供无头模拟与调试使用：一局从零开始、自动跑 N 个月。 */
export function createGame(opts = {}) {
  return createState(opts);
}

export { STATE_VERSION, hashString, createRng, projectProgressPct, equipmentBonus, energyMax, rankStatus, totalStudentsGraduated, ENDING_MAP, WAGE };

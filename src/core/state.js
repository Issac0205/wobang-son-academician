/**
 * state.js —— 世界状态（GameState）的唯一定义处
 *
 * 冻结约定（docs/CONTRACT.md §2）：
 *   · state 必须是「可 JSON 序列化的纯数据」——不放函数、不放 Map/Set/Date。
 *   · 所有字段都在本文件的工厂函数里出现；新增字段必须同时改 createState +
 *     save.js 的 hydrate 白名单 + docs/ARCHITECTURE.md §3。
 *   · 核心不读 DOM，UI 不写 state（只能通过 store.dispatch）。
 */

import {
  INITIAL_MONEY, INITIAL_CONSUMABLE, INITIAL_INTEGRITY, INITIAL_HEALTH, INITIAL_TOTAL_IF,
  INITIAL_FIRST_TOP, INITIAL_FIRST_Q1, INITIAL_FIRST_Q2, INITIAL_FIRST_Q3, INITIAL_FIRST_Q4,
  INITIAL_RECOMMEND_TICKETS, INITIAL_MASTER_COUNT, INITIAL_PHD_COUNT,
  ENERGY_MAX_BASE, ENERGY_PER_HEALTH_10, START_AGE_YEARS, MONTHS_PER_YEAR,
  ENERGY_LOW_HEALTH_THRESHOLD, ENERGY_LOW_HEALTH_MUL,
  DEFAULT_CONSUME_MODE, SAVE_APP_ID,
} from '../data/tuning.js';
import { INSTRUMENTS, INST_HOLD_CAP } from '../data/instruments.js';
import {
  INITIAL_HAPPINESS, DEFAULT_WAGE_TIER, MASTER_STUDY_MONTHS, PHD_STUDY_MONTHS,
  ABILITY_MIN, ABILITY_MAX, ABILITY_DEFAULT, INITIAL_STUDENT_ABILITY_MEAN_SD, INITIAL_STUDENT_TRANSLATE_RATE,
} from '../data/students.js';
import { DEPOSIT_RATE } from '../data/projects.js';
import { createRng, clamp, round } from './rng.js';
import { generateName, PROTAGONIST } from './naming.js';

/** 存档结构版本：改动 GameState 字段时 +1，并在 save.js 的 MIGRATIONS 里补迁移。 */
// t24：一作归属模型改变了 player.papers 的含义（v1 = 课题组全部产出，v2 = 玩家一作），
// 所以存档口径必须 +1；旧档由 save.js 的 MIGRATIONS[1] 按可核验台账重算。
export const STATE_VERSION = 2;

/** 子对象/数组的工厂：只在 state.js 里出现一次，供 engine 与 save 复用。 */
export function createStudent(overrides = {}) {
  const degree = overrides.degree === 'phd' ? 'phd' : 'master';
  return {
    id: overrides.id || 's0',
    name: overrides.name || '无名',
    gender: overrides.gender || 'male',
    degree,
    source: overrides.source === 'exam' ? 'exam' : 'translate',
    ability: round(clamp(overrides.ability ?? ABILITY_DEFAULT, ABILITY_MIN, ABILITY_MAX), 3),
    happiness: Math.round(clamp(overrides.happiness ?? INITIAL_HAPPINESS, 0, 100)),
    wageTier: overrides.wageTier || DEFAULT_WAGE_TIER,
    studyMonthsLeft: Math.round(overrides.studyMonthsLeft ?? (degree === 'phd' ? PHD_STUDY_MONTHS : MASTER_STUDY_MONTHS)),
    degreeProgress: round(clamp(overrides.degreeProgress ?? 0, 0, 100), 2),
    projectIds: Array.isArray(overrides.projectIds) ? overrides.projectIds.slice() : [],
    monthsNoWage: Math.round(overrides.monthsNoWage ?? 0),
    monthsInLab: Math.round(overrides.monthsInLab ?? 0),
    grudgeMonths: Math.round(overrides.grudgeMonths ?? 0),
    outputMulMonths: Math.round(overrides.outputMulMonths ?? 0),
    outputMul: Number.isFinite(overrides.outputMul) ? overrides.outputMul : 1,
    wageExpectShift: Math.round(overrides.wageExpectShift ?? 0),
    monthTalkCount: Math.round(overrides.monthTalkCount ?? 0),
    soloThisMonth: Boolean(overrides.soloThisMonth),
    deferMonths: Math.round(overrides.deferMonths ?? 0),
    graduated: Boolean(overrides.graduated),
    left: Boolean(overrides.left),
    enteredMonthIndex: Math.round(overrides.enteredMonthIndex ?? 0),
    note: overrides.note || '',
  };
}

export function createProject(overrides = {}) {
  return {
    instanceId: overrides.instanceId || 'p0',
    defId: overrides.defId || 'E1',
    name: overrides.name || '',
    category: overrides.category || 'enterprise',
    tier: Math.round(overrides.tier ?? 1),
    workload: Number(overrides.workload ?? 0),
    // t16 F1：已结题/失败的项目保留「超工作量」的真实进度（结题那个月会冲过 workload）。
    // 旧实现对**所有**项目都夹到 workload，于是读档会把结题项目的进度从 147.86 改成 130 —— 
    // 存档往返不再逐字段一致（这正是 tests/save.test.mjs 抓到的）。
    progress: round(clamp(
      overrides.progress ?? 0,
      0,
      (!overrides.status || overrides.status === 'active') ? (Number(overrides.workload ?? 0) || 1e9) : 1e9,
    ), 2),
    money: Number(overrides.money ?? 0),
    depositRate: Number(overrides.depositRate ?? DEPOSIT_RATE.enterprise),
    consumablePerMonth: Number(overrides.consumablePerMonth ?? 0),
    assignedStudentIds: Array.isArray(overrides.assignedStudentIds) ? overrides.assignedStudentIds.slice() : [],
    playerLeading: Boolean(overrides.playerLeading),
    hardpoints: Array.isArray(overrides.hardpoints) ? overrides.hardpoints.map((h) => ({ ...h })) : [],
    paperTiers: Array.isArray(overrides.paperTiers) ? overrides.paperTiers.slice() : [],
    acceptMonthIndex: Math.round(overrides.acceptMonthIndex ?? 0),
    deadlineMonthIndex: Math.round(overrides.deadlineMonthIndex ?? 0),
    overdueMonths: Math.round(overrides.overdueMonths ?? 0),
    tailPaid: Boolean(overrides.tailPaid),
    distractMul: Number.isFinite(overrides.distractMul) ? overrides.distractMul : 1,
    status: overrides.status || 'active',
  };
}

/**
 * 市场里的一个「商品」：项目 offer（kind='project'）或候选人（kind='student'）。
 * 两种形状的字段互不重叠，UI 按 kind 分派（docs/CONTRACT.md §2.4）。
 */
export function createOffer(overrides = {}) {
  const kind = overrides.kind === 'student' ? 'student' : 'project';
  const base = {
    offerId: overrides.offerId || 'o0',
    kind,
    tier: Math.round(overrides.tier ?? 1),
    locked: Boolean(overrides.locked),
    createdMonthIndex: Math.round(overrides.createdMonthIndex ?? 0),
  };
  if (kind === 'student') {
    return {
      ...base,
      name: overrides.name || '无名',
      gender: overrides.gender === 'female' ? 'female' : 'male',
      degree: overrides.degree === 'phd' ? 'phd' : 'master',
      source: overrides.source === 'exam' ? 'exam' : 'translate',
      ability: Number(overrides.ability ?? ABILITY_DEFAULT),
      cost: Number(overrides.cost ?? 0),
      reqIF: Number(overrides.reqIF ?? 0),
      reqRank: Math.round(overrides.reqRank ?? 1),
    };
  }
  return {
    ...base,
    defId: overrides.defId || 'E1',
    category: overrides.category === 'nation' ? 'nation' : 'enterprise',
    money: Number(overrides.money ?? 0),
    limitMonths: Math.round(overrides.limitMonths ?? 12),
    workload: Number(overrides.workload ?? 0),
    require: overrides.require ? { ...overrides.require } : {},
    expiresMonthIndex: Math.round(overrides.expiresMonthIndex ?? 0),
  };
}

/** 一条「纪事」= chronicle 数组元素。 */
export function createChronicleEntry(overrides = {}) {
  return {
    id: overrides.id || 'c0',
    monthIndex: Math.round(overrides.monthIndex ?? 0),
    year: Math.round(overrides.year ?? 1),
    month: Math.round(overrides.month ?? 1),
    kind: overrides.kind || 'note',
    tone: overrides.tone || 'system',
    text: overrides.text || '',
  };
}

/**
 * 新建一局。
 * @param {{seed?:string|number, playerName?:string, sonName?:string}} [opts]
 */
export function createState(opts = {}) {
  const seedSource = opts.seed === undefined ? Date.now() : opts.seed;
  const rng = createRng(seedSource);
  const state = {
    version: STATE_VERSION,
    appId: SAVE_APP_ID,
    seed: String(seedSource),
    rng: rng.snapshot(),

    calendar: { year: 1, month: 1, monthIndex: 0 },
    phase: 'action',

    player: {
      name: opts.playerName || PROTAGONIST.player,
      sonName: opts.sonName || PROTAGONIST.son,
      age: START_AGE_YEARS,
      health: INITIAL_HEALTH,
      energy: energyMaxFrom({ player: { health: INITIAL_HEALTH, energyMaxDelta: 0 } }),
      energyMaxDelta: 0,
      rankIndex: 1,
      totalIF: INITIAL_TOTAL_IF,
      integrity: INITIAL_INTEGRITY,
      money: INITIAL_MONEY,
      consumable: INITIAL_CONSUMABLE,
      consumeMode: DEFAULT_CONSUME_MODE,
      tickets: INITIAL_RECOMMEND_TICKETS,
      papers: { top: INITIAL_FIRST_TOP, q1: INITIAL_FIRST_Q1, q2: INITIAL_FIRST_Q2, q3: INITIAL_FIRST_Q3, q4: INITIAL_FIRST_Q4 },
      papersFirst: { top: 0, q1: 0, q2: 0, q3: 0, q4: 0 },
      graduated: { master: 0, phd: 0 },
      monthActions: { talk: 0, meeting: 0, exercise: 0, teambuild: 0 },
      monthEnergySpent: 0,
      monthMoneySpent: 0,
      // t30：已错过的增选窗口数（票门槛 = 3 + 2×它，上限 9）；最近一次拿到本人一作的月份（-1 = 还没有过）
      missedElectionWindows: 0,
      lastFirstAuthorMonthIndex: -1,
    },

    lab: {
      // SPEC：开局就有几台老设备（initCount 见 src/data/instruments.js），
      // 这批设备的加成 = START_INST_BONUS（0.45），是初始科研效率的一部分。
      equipment: Object.fromEntries(INSTRUMENTS.map((it) => [it.id, it.initCount])),
      equipmentDown: Object.fromEntries(INSTRUMENTS.map((it) => [it.id, 0])),
      purchaseCount: Object.fromEntries(INSTRUMENTS.map((it) => [it.id, 0])),
      holdCap: INST_HOLD_CAP,
      consumeMulThisMonth: 1,
    },

    students: [],
    projects: [],

    market: { pool: [], refreshedMonthIndex: -1, lockedOfferId: null, recruitedThisMonth: 0 },

    month: {
      index: 0,
      eventQueue: [],
      eventsResolved: [],
      fakesThisMonth: 0,
      flags: {},
      // t16 F1：这两个字段是引擎在运行时写进 month 的，之前没进 createState，
      // 于是 validateState 白名单漏掉它们（读档丢事件队列 / 月末标记）。
      leavesThisMonth: 0,
      pendingQueue: [],
    },

    counters: {
      nextStudentId: 1,
      nextProjectId: 1,
      nextOfferId: 1,
      nextChronicleId: 1,
      fakesTotal: 0,
      auditsTotal: 0,
      grabbedPapers: 0,
      boughtPapers: 0,
      papersAwarded: 0,
      projectsFinished: 0,
      projectsFailed: 0,
      eventsFired: 0,
    },

    eventState: { cooldowns: {}, lastFiredMonth: {} },

    flags: {
      retired: false,
      resigned: false,
      bankrupt: false,
      labEmptyThisMonth: false,
      almostAcademician: false,
      caughtRedHanded: false,
      electionWindowOpen: false,
      lastElectionMonthIndex: -999,
      // t16 F1：破产倒计时。必须出现在 createState 里，否则 validateState 的白名单
      // （按 base.flags 的键逐个拷贝）会把它丢掉 —— 经费为负时第 5 个月存读档即可规避解散。
      negativeMoneyMonths: 0,
    },

    chronicle: [],
    pendingEvent: null,
    ending: null,

    stats: { history: [], peak: { totalIF: 0, money: 0, students: 0 } },

    ui: {
      tab: 'crew',
      modal: null,
      toast: null,
      selectedStudentId: null,
      selectedProjectId: null,
      filter: 'all',
    },
  };

  seedStartingCrew(state);
  return state;
}

/** SPEC：开局 2 硕 1 博；等级 1 名额 硕 4 / 博 1。 */
function seedStartingCrew(state) {
  const rng = createRng(state.rng.seed ^ 0x51ed270b);
  const used = new Set();
  const plan = [
    ...Array.from({ length: INITIAL_MASTER_COUNT }, () => 'master'),
    ...Array.from({ length: INITIAL_PHD_COUNT }, () => 'phd'),
  ];
  for (const degree of plan) {
    const { name, gender } = generateName(rng, { used });
    used.add(name);
    const id = 's' + state.counters.nextStudentId;
    state.counters.nextStudentId += 1;
    state.students.push(createStudent({
      id, name, gender, degree,
      source: rng.chance(INITIAL_STUDENT_TRANSLATE_RATE) ? 'translate' : 'exam',
      ability: round(clamp(
        rng.normal(INITIAL_STUDENT_ABILITY_MEAN_SD[degree].mean, INITIAL_STUDENT_ABILITY_MEAN_SD[degree].sd),
        ABILITY_MIN, ABILITY_MAX,
      ), 3),
      enteredMonthIndex: 0,
    }));
  }
}

/** 精力上限：2 + floor(health/10) + 事件加成；健康 ≤30 时腰斩（SPEC）。 */
export function energyMaxFrom(state) {
  const health = Number(state.player && state.player.health) || 0;
  const bonus = Number(state.player && state.player.energyMaxDelta) || 0;
  let max = ENERGY_MAX_BASE + Math.floor(health / 10) * ENERGY_PER_HEALTH_10 + bonus;
  if (health <= ENERGY_LOW_HEALTH_THRESHOLD) max = max * ENERGY_LOW_HEALTH_MUL;
  return Math.max(1, Math.floor(max));
}

/** 时间推进一个自然月（year/month 联动）。 */
export function advanceCalendar(calendar, months = 1) {
  calendar.monthIndex += months;
  const total = calendar.monthIndex;
  calendar.year = Math.floor(total / MONTHS_PER_YEAR) + 1;
  calendar.month = (total % MONTHS_PER_YEAR) + 1;
  return calendar;
}

/** 深拷贝（状态不可变更新用；state 只含纯数据，structuredClone 是安全的）。 */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

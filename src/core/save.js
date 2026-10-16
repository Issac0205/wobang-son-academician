/**
 * save.js —— localStorage 存档：序列化 / 反序列化 / 版本迁移
 *
 * 冻结约定（docs/CONTRACT.md §5）：
 *   · 存档 key = SAVE_SLOT_KEY（wobang_son_academician_save）。
 *   · 存档内容是 { version, savedAt, state }；version 必须等于 STATE_VERSION。
 *   · 读档必须「宽容」：任何缺字段用默认值补齐、非法值丢弃、越界值夹紧，绝不抛异常。
 *   · 迁移策略：STATE_VERSION 每次 +1 时，在 MIGRATIONS 里加一个 vN→vN+1 的函数；
 *     迁移失败一律回退为「新局」，并向玩家提示存档已损坏。
 */

import { SAVE_SLOT_KEY, AUTOSAVE_ON_MONTH_END } from '../data/tuning.js';
import { STATE_VERSION, createState, createStudent, createProject, createOffer, createChronicleEntry } from './state.js';
import { PAPER_TIER_ORDER, PLAYER_AUTHOR_ID } from '../data/papers.js';
import { clamp, round } from './rng.js';

/** @typedef {{version:number, savedAt:number, state:any}} SaveEnvelope */

export const SAVE_VERSION = STATE_VERSION;

/** t16 F8：契约 §3.5 声称 save.js 也导出 STATE_VERSION，这里显式再导出（读档方要拿它比版本）。 */
export { STATE_VERSION };

/** 版本迁移表：key = 源版本，值 = (state) => state。 */
export const MIGRATIONS = {
  /**
   * v1 → v2（t24 一作归属模型）：v1 的 player.papers 统计的是「课题组全部产出」，
   * v2 起它只统计「玩家是一作」的论文。旧档无法逐篇反推当年的署名，
   * 但两处真实台账可以重算，且重算结果与 v1 的实际行为完全一致：
   *   · v1 里亲带项目并不给老板一作（署名按学生轮流），所以台账里
   *     firstAuthorId === PLAYER_AUTHOR_ID 的篇数为 0（将来再读旧档同样按此规则）；
   *   · 老板真正拿到的一作只有「买一作 / 抢一作」，每篇在 papersFirst 里恰好记一次。
   * totalIF 不动：它从来就是「所有论文」的口径，与本迁移无关。
   */
  1: (state) => {
    const next = { ...state, player: { ...((state && state.player) || {}) } };
    const counts = {};
    for (const tier of PAPER_TIER_ORDER) counts[tier] = 0;
    for (const project of Array.isArray(next.projects) ? next.projects : []) {
      for (const paper of Array.isArray(project && project.paperTiers) ? project.paperTiers : []) {
        if (paper && typeof paper === 'object' && paper.firstAuthorId === PLAYER_AUTHOR_ID
          && PAPER_TIER_ORDER.includes(paper.tier)) counts[paper.tier] += 1;
      }
    }
    const first = (next.player && next.player.papersFirst) || {};
    for (const tier of PAPER_TIER_ORDER) counts[tier] += Math.max(0, Math.floor(Number(first[tier]) || 0));
    next.player.papers = counts;
    return next;
  },
};

/** 包装成存档信封。 */
export function serialize(state) {
  return {
    version: STATE_VERSION,
    savedAt: Date.now(),
    state: JSON.parse(JSON.stringify(state)),
  };
}

/**
 * 把任意输入还原成合法 state；失败返回 null（调用方决定是否开新局）。
 * @param {any} raw 存档信封或裸 state
 */
export function hydrate(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const envelope = raw.state ? raw : { version: raw.version, state: raw };
    if (!envelope.state || typeof envelope.state !== 'object') return null;
    let migrated = envelope.state;
    let version = Math.floor(Number(envelope.version) || STATE_VERSION);
    while (version < STATE_VERSION) {
      const step = MIGRATIONS[version];
      if (typeof step !== 'function') return null;
      migrated = step(migrated);
      version += 1;
    }
    if (version > STATE_VERSION) return null;
    return validateState(migrated);
  } catch (err) {
    console.warn('[save] 读档失败：', err);
    return null;
  }
}

/** 白名单 + 逐字段校验：以一个全新 state 为骨架，把存档里的合法字段合并进来。 */
export function validateState(rawState) {
  const seed = typeof rawState.seed === 'string' || typeof rawState.seed === 'number' ? rawState.seed : Date.now();
  const base = createState({ seed, playerName: rawState.player && rawState.player.name, sonName: rawState.player && rawState.player.sonName });

  const num = (v, fallback, lo, hi) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  };

  // 日历
  const cal = rawState.calendar || {};
  base.calendar.monthIndex = Math.round(num(cal.monthIndex, 0, 0, 1e6));
  base.calendar.year = Math.max(1, Math.round(num(cal.year, 1, 1, 1e5)));
  base.calendar.month = Math.round(num(cal.month, 1, 1, 12));
  base.phase = ['action', 'settle', 'ended'].includes(rawState.phase) ? rawState.phase : 'action';
  base.seed = String(seed);
  base.rng = rawState.rng && Number.isFinite(rawState.rng.seed) ? { seed: rawState.rng.seed >>> 0 } : base.rng;

  // 玩家
  const p = rawState.player || {};
  Object.assign(base.player, {
    name: typeof p.name === 'string' && p.name ? p.name : base.player.name,
    sonName: typeof p.sonName === 'string' && p.sonName ? p.sonName : base.player.sonName,
    age: Math.round(num(p.age, base.player.age, 20, 90)),
    health: Math.round(num(p.health, base.player.health, 0, 100)),
    energy: Math.round(num(p.energy, base.player.energy, 0, 30)),
    // t16 F1：原来的 ±10 太窄（事件加成是累计的，读档会静默截断玩家的既有加成）；
    // 放宽到 ±50，仍然是一个「不可能被刷到」的物理上限。
    energyMaxDelta: Math.round(num(p.energyMaxDelta, 0, -50, 50)),
    rankIndex: Math.round(num(p.rankIndex, 1, 1, 8)),
    totalIF: round(num(p.totalIF, base.player.totalIF, 0, 1e6), 1),
    integrity: Math.round(num(p.integrity, base.player.integrity, 0, 100)),
    money: round(num(p.money, base.player.money, -1e5, 1e6), 2),
    consumable: round(num(p.consumable, base.player.consumable, 0, 1e5), 2),
    consumeMode: ['free', 'normal', 'tight'].includes(p.consumeMode) ? p.consumeMode : 'normal',
    tickets: Math.round(num(p.tickets, 0, 0, 99)),
    // t30：票门槛的「错过窗口」计数与一作空窗时间戳（都是玩家状态，必须随存档走）
    missedElectionWindows: Math.round(num(p.missedElectionWindows, 0, 0, 99)),
    lastFirstAuthorMonthIndex: Math.round(num(p.lastFirstAuthorMonthIndex, -1, -1, 1e6)),
    monthEnergySpent: Math.round(num(p.monthEnergySpent, 0, 0, 999)),
    monthMoneySpent: round(num(p.monthMoneySpent, 0, 0, 1e6), 2),
  });
  // 月度行动计数（talk/meeting/exercise/teambuild 的次数上限要按月重置，
  // 读档后如果丢掉，同一个月就能把限次行动刷第二次 —— t16 F1/F3）。
  for (const id of Object.keys(base.player.monthActions)) {
    base.player.monthActions[id] = Math.round(num(p.monthActions && p.monthActions[id], 0, 0, 999));
  }
  base.player.papers = mergePapers(base.player.papers, p.papers);
  base.player.papersFirst = mergePapers(base.player.papersFirst, p.papersFirst);
  base.player.graduated = {
    master: Math.round(num(p.graduated && p.graduated.master, 0, 0, 999)),
    phd: Math.round(num(p.graduated && p.graduated.phd, 0, 0, 999)),
  };

  // 实验室
  const lab = rawState.lab || {};
  for (const [id, count] of Object.entries(lab.equipment || {})) {
    if (base.lab.equipment[id] !== undefined) base.lab.equipment[id] = Math.round(num(count, 0, 0, 3));
  }
  for (const [id, months] of Object.entries(lab.equipmentDown || {})) {
    if (base.lab.equipmentDown[id] !== undefined) base.lab.equipmentDown[id] = Math.round(num(months, 0, 0, 36));
  }
  for (const [id, count] of Object.entries(lab.purchaseCount || {})) {
    if (base.lab.purchaseCount[id] !== undefined) base.lab.purchaseCount[id] = Math.round(num(count, 0, 0, 3));
  }

  // 学生 / 项目 / 市场
  if (Array.isArray(rawState.students)) {
    base.students = rawState.students
      .filter((s) => s && typeof s === 'object' && typeof s.id === 'string')
      .map((s) => createStudent(s));
  }
  if (Array.isArray(rawState.projects)) {
    base.projects = rawState.projects
      .filter((s) => s && typeof s === 'object' && typeof s.instanceId === 'string')
      .map((s) => createProject(s));
  }
  const mk = rawState.market || {};
  if (Array.isArray(mk.pool)) {
    base.market.pool = mk.pool.filter((o) => o && typeof o === 'object' && typeof o.offerId === 'string').map((o) => createOffer(o));
  }
  base.market.refreshedMonthIndex = Math.round(num(mk.refreshedMonthIndex, -1, -1, 1e6));
  base.market.lockedOfferId = typeof mk.lockedOfferId === 'string' ? mk.lockedOfferId : null;
  base.market.recruitedThisMonth = Math.round(num(mk.recruitedThisMonth, 0, 0, 99));

  // 本月状态（t16 F1）：事件队列、已经结算过的事件、本月造假次数、月末标记。
  // 少了它们，读档会「把本月已经结算过的事件再触发一次」或者让审计计数回到 0。
  const mo = rawState.month || {};
  base.month.index = Math.round(num(mo.index, 0, 0, 1e6));
  base.month.fakesThisMonth = Math.round(num(mo.fakesThisMonth, 0, 0, 999));
  base.month.leavesThisMonth = Math.round(num(mo.leavesThisMonth, 0, 0, 999));
  if (Array.isArray(mo.eventQueue)) base.month.eventQueue = mo.eventQueue.filter((x) => typeof x === 'string').slice(0, 64);
  if (Array.isArray(mo.eventsResolved)) base.month.eventsResolved = mo.eventsResolved.filter((x) => typeof x === 'string').slice(0, 64);
  if (Array.isArray(mo.pendingQueue)) {
    base.month.pendingQueue = mo.pendingQueue
      .filter((q) => q && typeof q === 'object' && typeof q.eventId === 'string')
      .slice(0, 16)
      .map((q) => ({ eventId: q.eventId, monthIndex: Math.round(Number(q.monthIndex) || 0), choiceId: typeof q.choiceId === 'string' ? q.choiceId : null }));
  }
  if (mo.flags && typeof mo.flags === 'object') {
    for (const [k, v] of Object.entries(mo.flags)) {
      if (typeof v === 'boolean' || Number.isFinite(v)) base.month.flags[k] = v;
    }
  }

  // 计数器 / 事件冷却 / flags / 纪事
  for (const key of Object.keys(base.counters)) {
    base.counters[key] = Math.round(num(rawState.counters && rawState.counters[key], base.counters[key], 0, 1e6));
  }
  base.counters.nextStudentId = Math.max(base.counters.nextStudentId, nextIdHint(base.students, 's'));
  base.counters.nextProjectId = Math.max(base.counters.nextProjectId, nextIdHint(base.projects, 'p'));
  if (rawState.eventState && typeof rawState.eventState === 'object') {
    const cooldowns = rawState.eventState.lastFiredMonth || {};
    for (const [id, month] of Object.entries(cooldowns)) {
      if (Number.isFinite(month)) base.eventState.lastFiredMonth[id] = Math.round(month);
    }
  }
  for (const key of Object.keys(base.flags)) {
    const v = rawState.flags && rawState.flags[key];
    if (typeof base.flags[key] === 'boolean') base.flags[key] = Boolean(v);
    else if (typeof base.flags[key] === 'number') base.flags[key] = num(v, base.flags[key]);
  }
  // 白名单之外的数值型 flag 也保留：引擎新加的计数器型 flag（如 negativeMoneyMonths）
  // 一旦被白名单漏掉就会静默归零，等于给玩家一个存读档漏洞（t16 F1）。
  for (const [key, v] of Object.entries(rawState.flags && typeof rawState.flags === 'object' ? rawState.flags : {})) {
    if (key in base.flags) continue;
    if (Number.isFinite(v) && key.length <= 40) base.flags[key] = Math.round(num(v, 0, -1e6, 1e6));
  }
  if (Array.isArray(rawState.chronicle)) {
    base.chronicle = rawState.chronicle.slice(-400).map((c) => createChronicleEntry(c));
  }
  base.ending = rawState.ending && typeof rawState.ending.id === 'string' ? { ...rawState.ending } : null;
  base.pendingEvent = rawState.pendingEvent && typeof rawState.pendingEvent.eventId === 'string' ? { ...rawState.pendingEvent } : null;
  if (rawState.stats && Array.isArray(rawState.stats.history)) {
    base.stats.history = rawState.stats.history
      .filter((h) => h && Number.isFinite(h.monthIndex))
      .map((h) => ({ ...h }));
  }
  // 月度回执（只用于展示，脏数据一律夹掉，不参与任何游戏数值）
  if (rawState.stats && rawState.stats.peak && typeof rawState.stats.peak === 'object') {
    // t16 F1：曲线峰值（历史最高 IF / 经费 / 学生数）也要持久化，否则读档后 UI 的
    // 「历史最高」会掉回 0。
    const pk = rawState.stats.peak;
    base.stats.peak = {
      totalIF: round(num(pk.totalIF, 0, 0, 1e6), 1),
      money: round(num(pk.money, 0, -1e5, 1e6), 2),
      students: Math.round(num(pk.students, 0, 0, 999)),
    };
  }
  if (rawState.stats && rawState.stats.lastReceipt && typeof rawState.stats.lastReceipt === 'object') {
    base.stats.lastReceipt = sanitizeReceipt(rawState.stats.lastReceipt);
  }
  if (rawState.ui && typeof rawState.ui === 'object') {
    base.ui = { ...base.ui, ...pickUi(rawState.ui) };
  }
  return base;
}

/** 月度回执的白名单校验：字段类型不对就丢，数组截断到合理长度。 */
function sanitizeReceipt(raw) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const list = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').slice(0, 64).map((x) => ({ ...x })) : []);
  return {
    monthIndex: num(raw.monthIndex), year: num(raw.year), month: num(raw.month),
    income: list(raw.income),
    expense: list(raw.expense),
    projects: list(raw.projects),
    students: list(raw.students),
    papers: list(raw.papers),
    papersAll: num(raw.papersAll),
    papersStudent: num(raw.papersStudent),
    events: Array.isArray(raw.events) ? raw.events.filter((e) => typeof e === 'string').slice(0, 8) : [],
    integrityDelta: num(raw.integrityDelta),
    ticketsDelta: num(raw.ticketsDelta),
    // t16 F1：回执里的「结算后状态」字段原先没进白名单，读档后 UI 的
    // 「上月结算后诚信 / 票数」会凭空少两项（tests/save.test.mjs 抓到字段数 24 → 22）。
    integrityAfter: num(raw.integrityAfter),
    ticketsAfter: num(raw.ticketsAfter),
    moneyBefore: num(raw.moneyBefore),
    moneyAfter: num(raw.moneyAfter),
    moneyNet: num(raw.moneyNet),
    consumableBefore: num(raw.consumableBefore),
    consumableAfter: num(raw.consumableAfter),
    consumableNet: num(raw.consumableNet),
    ifDelta: num(raw.ifDelta),
    starvedCount: num(raw.starvedCount),
    starvedProjects: Array.isArray(raw.starvedProjects) ? raw.starvedProjects.filter((x) => typeof x === 'string').slice(0, 16) : [],
    starvedHint: typeof raw.starvedHint === 'string' ? raw.starvedHint.slice(0, 200) : '',
    consumableLow: Boolean(raw.consumableLow),
  };
}

function pickUi(ui) {
  const out = {};
  if (['crew', 'projects', 'market', 'actions', 'chronicle'].includes(ui.tab)) out.tab = ui.tab;
  if (ui.modal === null || typeof ui.modal === 'string') out.modal = ui.modal;
  if (ui.toast === null || typeof ui.toast === 'string') out.toast = ui.toast;
  if (typeof ui.selectedStudentId === 'string' || ui.selectedStudentId === null) out.selectedStudentId = ui.selectedStudentId;
  if (typeof ui.selectedProjectId === 'string' || ui.selectedProjectId === null) out.selectedProjectId = ui.selectedProjectId;
  // t25：一键分配的「上次结果摘要」（纯展示用，逐字段白名单校验）
  if (ui.autoAssign && typeof ui.autoAssign === 'object') {
    const texts = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 32) : []);
    const n = (v) => Math.round(Number(v) || 0);
    out.autoAssign = {
      monthIndex: n(ui.autoAssign.monthIndex),
      moveCount: n(ui.autoAssign.moveCount),
      studentsTouched: n(ui.autoAssign.studentsTouched),
      studentsTotal: n(ui.autoAssign.studentsTotal),
      projectsTotal: n(ui.autoAssign.projectsTotal),
      availableStudents: n(ui.autoAssign.availableStudents),
      studentCap: n(ui.autoAssign.studentCap),
      projectCap: n(ui.autoAssign.projectCap),
      studentsWithoutProject: texts(ui.autoAssign.studentsWithoutProject),
      studentsFull: texts(ui.autoAssign.studentsFull),
      projectsShort: Array.isArray(ui.autoAssign.projectsShort)
        ? ui.autoAssign.projectsShort.filter((p) => p && typeof p === 'object').slice(0, 32).map((p) => ({
          id: String(p.id || ''), name: String(p.name || ''), members: n(p.members), cap: n(p.cap),
        }))
        : [],
      feedback: typeof ui.autoAssign.feedback === 'string' ? ui.autoAssign.feedback.slice(0, 300) : '',
    };
  }
  return out;
}

function mergePapers(base, raw) {
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const n = Number(raw && raw[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.round(n);
  }
  return out;
}

function nextIdHint(list, prefix) {
  let max = 1;
  for (const item of list || []) {
    const id = item.id || item.instanceId || '';
    const n = parseInt(String(id).replace(prefix, ''), 10);
    if (Number.isFinite(n) && n >= max) max = n + 1;
  }
  return max;
}

/* ── localStorage 读写（无 DOM 环境自动降级为内存存档） ── */
const memory = {};

function storageOf(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (err) {
    void err;
  }
  return null;
}

export function saveGame(state, storage) {
  const store = storageOf(storage);
  const envelope = serialize(state);
  const text = JSON.stringify(envelope);
  try {
    if (store) store.setItem(SAVE_SLOT_KEY, text);
    else memory[SAVE_SLOT_KEY] = text;
  } catch (err) {
    console.warn('[save] 存档失败（可能是隐私模式或容量超限）：', err);
    return null;
  }
  state.meta = { savedAt: envelope.savedAt, autosave: Boolean(AUTOSAVE_ON_MONTH_END) };
  return envelope;
}

export function loadGame(storage) {
  const store = storageOf(storage);
  let text = null;
  try {
    text = store ? store.getItem(SAVE_SLOT_KEY) : memory[SAVE_SLOT_KEY] || null;
  } catch (err) {
    void err;
    text = null;
  }
  if (!text) return null;
  try {
    return hydrate(JSON.parse(text));
  } catch (err) {
    console.warn('[save] 存档 JSON 解析失败：', err);
    return null;
  }
}

export function hasSave(storage) {
  const store = storageOf(storage);
  try {
    return Boolean(store ? store.getItem(SAVE_SLOT_KEY) : memory[SAVE_SLOT_KEY]);
  } catch (err) {
    void err;
    return false;
  }
}

export function clearSave(storage) {
  const store = storageOf(storage);
  try {
    if (store) store.removeItem(SAVE_SLOT_KEY);
    else delete memory[SAVE_SLOT_KEY];
  } catch (err) {
    void err;
  }
}

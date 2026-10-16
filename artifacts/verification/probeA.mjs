/**
 * probeA.mjs (v2) —— t6 独立验证探针 A：市场不变式 / 耗材经济 / 中期停滞
 * 运行：node 评院士/artifacts/verification/probeA.mjs
 * 说明：v2 改为「边跑边打印」，避免中途异常丢失全部结果。
 */
import { createState } from '../../src/core/state.js';
import { ACTIONS, reduce, pendingDeferStudents } from '../../src/core/engine.js';
import { offerReachable } from '../../src/core/rules.js';
import { activeProjects } from '../../src/core/formulas.js';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
import { PROJECT_SLOTS, STUDENT_SLOTS, MIN_ACCEPTABLE_PROJECT_OFFERS, MARKET_SLOTS, PROJECT_OFFER_TTL_MONTHS, STUDENT_OFFER_TTL_MONTHS } from '../../src/data/projects.js';

const SEEDS = []; for (let i = 1; i <= 8; i += 1) SEEDS.push('t4-0' + i);
const MONTHS = 400;
const f = (n, d = 1) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : String(n));
const say = (s) => { console.log(s); };

say('常量：PROJECT_SLOTS=' + PROJECT_SLOTS + ' STUDENT_SLOTS=' + STUDENT_SLOTS + ' MARKET_SLOTS=' + MARKET_SLOTS + ' 项目 offer TTL=' + PROJECT_OFFER_TTL_MONTHS + ' 学生 offer TTL=' + STUDENT_OFFER_TTL_MONTHS + ' 不变式下限 MIN_ACCEPTABLE_PROJECT_OFFERS=' + MIN_ACCEPTABLE_PROJECT_OFFERS);

/* ══════ 1 市场不变式：400 月 ══════ */
function zeroOp(seed, keepAlive) {
  let st = reduce(createState({ seed }), ACTIONS.newGame({ seed }));
  let minReach = Infinity, minProject = Infinity, maxStudent = 0, maxProjectOffers = 0;
  let onlyStudentMonths = 0, projectOverQuotaMonths = 0, blocked = 0, minConsumable = Infinity, ended = null, months = 0;
  for (let i = 0; i < MONTHS; i += 1) {
    if (st.ending) { ended = st.ending.id; break; }
    if (keepAlive) { st.player.health = 90; if (st.player.money < 50) st.player.money = 200; }
    let guard = 0;
    while (pendingDeferStudents(st).length > 0 && guard < 10) {
      guard += 1;
      const s0 = pendingDeferStudents(st)[0];
      const nx = reduce(st, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' }));
      if (nx === st) break;
      st = nx;
    }
    const before = st.calendar.monthIndex;
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    if (st.calendar.monthIndex === before) { blocked += 1; break; }
    months += 1;
    const pool = (st.market && st.market.pool) || [];
    const proj = pool.filter((o) => o.kind === 'project');
    const stu = pool.filter((o) => o.kind === 'student');
    const reach = proj.filter((o) => offerReachable(st, o)).length;
    if (proj.length === 0 && stu.length > 0) onlyStudentMonths += 1;
    if (proj.length > PROJECT_SLOTS) projectOverQuotaMonths += 1;
    if (stu.length > STUDENT_SLOTS) projectOverQuotaMonths += 1000;
    minReach = Math.min(minReach, reach);
    minProject = Math.min(minProject, proj.length);
    maxStudent = Math.max(maxStudent, stu.length);
    maxProjectOffers = Math.max(maxProjectOffers, proj.length);
    minConsumable = Math.min(minConsumable, st.player.consumable);
  }
  return { seed, minReach, minProject, maxStudent, maxProjectOffers, onlyStudentMonths, projectOverQuotaMonths, blocked, minConsumable, ended, months };
}
say('══════ 1. 市场不变式：连续 400 个月（含玩家零操作）══════');
for (const keepAlive of [false, true]) {
  const label = keepAlive ? '零操作 + 每月保命（health/money 兜住，逼着跑满 400 月）' : '纯零操作（不碰任何数值）';
  say('— 模式：' + label);
  let worstReach = Infinity, viol = 0, early = 0, minCons = Infinity;
  for (const seed of SEEDS) {
    const r = zeroOp(seed, keepAlive);
    worstReach = Math.min(worstReach, r.minReach);
    minCons = Math.min(minCons, r.minConsumable);
    if (r.minReach < MIN_ACCEPTABLE_PROJECT_OFFERS) viol += 1;
    if (r.ended) early += 1;
    say('   ' + r.seed + '：跑了 ' + r.months + ' 月' + (r.ended ? '（提前结束：' + r.ended + '）' : '（跑满）')
      + ' | 最少可承接项目 offer=' + r.minReach + ' | 项目 offer 数范围 0–' + r.maxProjectOffers
      + ' | 学生 offer 最多=' + r.maxStudent + ' | 只有学生 offer 的月份=' + r.onlyStudentMonths
      + ' | 席位超配额标记=' + r.projectOverQuotaMonths + ' | 最低耗材=' + f(r.minConsumable, 2) + ' | 弹层阻塞月=' + r.blocked);
  }
  say('   ⇒ 8 局最少可承接 offer=' + worstReach + '（要求 ≥' + MIN_ACCEPTABLE_PROJECT_OFFERS + '）违反局数=' + viol + '，提前结束局数=' + early + '，最低耗材=' + f(minCons, 2));
  say('');
}

/* ══════ 2/3 一次遍历：耗材最小值 + 停滞段 ══════ */
const HUMAN_BASE = { hire: true, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false, usePlayerLead: false, buyFirstAuthorMax: 0, integrityFloor: 25, deferHappyFloor: 40 };
const PROFILES = {
  speedrun: null,
  casual: null,
  balanced: null,
  cheater: null,
  'human_cashFirst（次优但合理：按钱/工期挑本子、前期多买仪器、幸福度管控一般）': { ...HUMAN_BASE, consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 20, hireMinAbility: 0.45, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4 },
  'human_cashFirst+买正刊（同样次优，但舍得花 120 万买正刊）': { ...HUMAN_BASE, consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 30, hireMinAbility: 0.45, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4, buyFirstAuthorTier: 'top', buyFirstAuthorMax: 3 },
};
say('══════ 2. 耗材资金是否会出现负值（必答 4①）══════');
say('（下面 48 局逐月扫描；章节 3 复用同一批数据看停滞）');
const stallRows = {};
const endings = {};
let globalMinCons = Infinity;
for (const name of Object.keys(PROFILES)) {
  const cfg = PROFILES[name] || STRATEGIES[name];
  const rows = [];
  for (const seed of SEEDS) {
    const progress = [];
    let minC = Infinity, peakOverdue = 0;
    const run = runGame({ seed, strategy: cfg, months: MONTHS, onMonth: (state, snap) => {
      const c = Number(state.player.consumable);
      if (c < minC) minC = c;
      progress.push(activeProjects(state).reduce((n, p) => n + p.progress, 0) + state.counters.projectsFinished * 100000 + state.counters.projectsFailed * 100000);
      peakOverdue = Math.max(peakOverdue, snap.overdueProjects || 0);
    } });
    globalMinCons = Math.min(globalMinCons, minC);
    const spans = []; let stall = 0, at = 0;
    for (let i = 1; i < progress.length; i += 1) {
      if (progress[i] - progress[i - 1] <= 0.0001) { if (stall === 0) at = i; stall += 1; }
      else { if (stall >= 6) spans.push(at + '–' + (at + stall - 1)); stall = 0; }
    }
    if (stall >= 6) spans.push(at + '–' + (at + stall - 1));
    const s = run.state;
    const eid = s.ending ? s.ending.id : 'none';
    endings[name] = endings[name] || {}; endings[name][eid] = (endings[name][eid] || 0) + 1;
    rows.push({ seed, minC, spans, peakOverdue, ending: eid, rank: s.player.rankIndex, month: s.calendar.monthIndex, ifn: s.player.totalIF, top: s.player.papers.top, finished: s.counters.projectsFinished, integrity: s.player.integrity, bought: s.counters.boughtPapers });
  }
  stallRows[name] = rows;
  say('  ▸ ' + name);
  say('     最低耗材 ' + f(Math.min.apply(null, rows.map((r) => r.minC)), 2) + ' | 结局 ' + JSON.stringify(endings[name]));
  for (const r of rows) say('     ' + r.seed + '：终局 ' + r.ending + ' 头衔#' + r.rank + ' 月' + r.month + ' IF=' + f(r.ifn, 0) + ' 正刊=' + r.top + ' 结题=' + r.finished + ' 诚信=' + f(r.integrity, 0) + ' 逾期峰值=' + r.peakOverdue + (r.spans.length ? ' | ≥6月零增长段 ' + r.spans.join('、') : ' | 无 ≥6 月零增长')); 
}
say('⇒ 48 局全月扫描：耗材资金全局最小值 = ' + f(globalMinCons, 2) + '（≥0 表示没有出现负值）');
say('');
say('══════ 3. 连续 ≥6 个月「进度零增长」统计（必答 4②）══════');
for (const name of Object.keys(stallRows)) {
  const rows = stallRows[name];
  const bad = rows.filter((r) => r.spans.length);
  const maxSpan = rows.reduce((m, r) => Math.max(m, r.spans.length), 0);
  say('  ' + name.slice(0, 42).padEnd(44) + ' 有停滞段的局数 ' + bad.length + '/8' + (bad.length ? ' → ' + bad.map((r) => r.seed + ' ' + r.spans.join('、')).join('；') : ''));
}
say('  ⇒ scripts/simulate.mjs 的「不存在连续 ≥6 个月停滞」断言只对 speedrun 生效（simulate.mjs:181），其余路线出现停滞不会被判失败。');

/* ══════ 4 定点单测：耗材 clamp ══════ */
say('');
say('══════ 4. 耗材 clamp 定点单测 ══════');
{
  let st = reduce(createState({ seed: 'neg-probe' }), ACTIONS.newGame({ seed: 'neg-probe' }));
  st.player.consumable = 1;
  const mode = reduce(st, ACTIONS.setConsumeMode({ mode: 'free' }));
  const offers = mode.market.pool.filter((o) => o.kind === 'project');
  say('  起始耗材设为 1 单位，本月项目 offer 数=' + offers.length + '（月度刷新前市场可能为空）');
  let st2 = st;
  for (let i = 0; i < 24; i += 1) {
    if (st2.ending) break;
    const offs = st2.market.pool.filter((o) => o.kind === 'project');
    if (offs.length && activeProjects(st2).length < 2) st2 = reduce(st2, ACTIONS.acceptProject({ offerId: offs[0].offerId }));
    if (pendingDeferStudents(st2).length) { const s0 = pendingDeferStudents(st2)[0]; st2 = reduce(st2, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' })); }
    st2 = reduce(st2, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  }
  const neg = [];
  let st3 = reduce(createState({ seed: 'neg2' }), ACTIONS.newGame({ seed: 'neg2' }));
  st3.player.consumable = 0.5;
  let minSeen = st3.player.consumable;
  for (let i = 0; i < 36; i += 1) {
    if (st3.ending) break;
    const offs = st3.market.pool.filter((o) => o.kind === 'project');
    if (offs.length && activeProjects(st3).length < 2) st3 = reduce(st3, ACTIONS.acceptProject({ offerId: offs[0].offerId }));
    if (pendingDeferStudents(st3).length) { const s0 = pendingDeferStudents(st3)[0]; st3 = reduce(st3, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' })); }
    st3 = reduce(st3, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    minSeen = Math.min(minSeen, st3.player.consumable);
    if (st3.player.consumable < 0) neg.push({ month: st3.calendar.monthIndex, v: st3.player.consumable });
  }
  say('  人为把耗材压到 0.5 单位后跑 36 月：最低耗材 = ' + f(minSeen, 2) + '，负值次数 = ' + neg.length + (neg.length ? ' ' + JSON.stringify(neg) : ''));
  say('  采购接口负值输入测试：' + JSON.stringify(reduce(st, ACTIONS.buyConsumable({ amount: -100 })).player.consumable) + '（应 ≥ 起始值，说明负 amount 被 clamp 到 1 单位起）');
}
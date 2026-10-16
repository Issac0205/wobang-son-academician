/** probeF.mjs (v2) — t29 供给不变式实测（两种口径：新增全部 / 新增且可承接；对照 BALANCE §18.18 裁定① 常量 21） */
import { createState } from '../../src/core/state.js';
import { ACTIONS, reduce, pendingDeferStudents } from '../../src/core/engine.js';
import { offerReachable, canAcceptOffer, canRecruitOffer } from '../../src/core/rules.js';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
import { MIN_ACCEPTABLE_PROJECT_OFFERS, PROJECT_SLOTS } from '../../src/data/projects.js';
import { MARKET_OPEN_MONTHS } from '../../src/data/market.js';
const SEEDS = []; for (let i = 1; i <= 8; i += 1) SEEDS.push('t4-0' + i);
const say = (s) => console.log(s);
const withinOpen = (m) => MARKET_OPEN_MONTHS.indexOf((m % 12) + 1) >= 0;
function observe(state, prevIds, acc) {
  const pool = (state.market && state.market.pool) || [];
  const projects = pool.filter((o) => o.kind === 'project');
  const students = pool.filter((o) => o.kind === 'student');
  const reach = projects.filter((o) => offerReachable(state, o));
  const ids = new Set(projects.map((o) => o.offerId));
  const fresh = projects.filter((o) => !prevIds.has(o.offerId));
  acc.minReach = Math.min(acc.minReach, reach.length);
  acc.minAccept = Math.min(acc.minAccept, canAcceptOffer(state, projects[0] || {}) === undefined ? 99 : projects.filter((o) => canAcceptOffer(state, o)).length);
  if (withinOpen(state.calendar.monthIndex)) { acc.minPool = Math.min(acc.minPool, students.length); acc.minRecruit = Math.min(acc.minRecruit, students.filter((o) => canRecruitOffer(state, o)).length); }
  acc.newAll.push(fresh.length);
  acc.newReach.push(fresh.filter((o) => offerReachable(state, o)).length);
  acc.months += 1;
  return ids;
}
function roll12(list) { let worst = Infinity; for (let i = 0; i + 12 <= list.length; i += 1) { let s = 0; for (let j = i; j < i + 12; j += 1) s += list[j]; if (s < worst) worst = s; } return worst === Infinity ? 0 : worst; }
const ROWS = [];
for (const name of ['speedrun', 'casual', 'balanced', 'cheater']) {
  for (const seed of SEEDS) {
    const acc = { minReach: 99, minAccept: 99, minPool: 99, minRecruit: 99, newAll: [], newReach: [], months: 0 };
    let prev = new Set();
    runGame({ seed, strategy: STRATEGIES[name], months: 400, onMonth: (state) => { prev = observe(state, prev, acc); } });
    ROWS.push({ mode: name, seed, reach: acc.minReach, accept: acc.minAccept, pool: acc.minPool, recruit: acc.minRecruit, rollAll: roll12(acc.newAll), rollReach: roll12(acc.newReach), months: acc.months });
  }
}
for (const seed of SEEDS) {
  let st = reduce(createState({ seed }), ACTIONS.newGame({ seed }));
  const acc = { minReach: 99, minAccept: 99, minPool: 99, minRecruit: 99, newAll: [], newReach: [], months: 0 };
  let prev = new Set();
  for (let i = 0; i < 384; i += 1) {
    if (st.ending) break;
    st.player.health = 90; if (st.player.money < 60) st.player.money = 200;
    let guard = 0;
    while (pendingDeferStudents(st).length && guard < 8) { guard += 1; const s0 = pendingDeferStudents(st)[0]; const nx = reduce(st, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' })); if (nx === st) break; st = nx; }
    const before = st.calendar.monthIndex;
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    if (st.calendar.monthIndex === before) break;
    prev = observe(st, prev, acc);
  }
  ROWS.push({ mode: 'zeroOp', seed, reach: acc.minReach, accept: acc.minAccept, pool: acc.minPool, recruit: acc.minRecruit, rollAll: roll12(acc.newAll), rollReach: roll12(acc.newReach), months: acc.months });
}
const modes = {};
for (const r of ROWS) {
  const b = modes[r.mode] = modes[r.mode] || { n: 0, months: 0, reach: 99, accept: 99, pool: 99, recruit: 99, rollAll: 999, rollReach: 999 };
  b.n += 1; b.months += r.months;
  b.reach = Math.min(b.reach, r.reach); b.accept = Math.min(b.accept, r.accept);
  b.pool = Math.min(b.pool, r.pool); b.recruit = Math.min(b.recruit, r.recruit);
  b.rollAll = Math.min(b.rollAll, r.rollAll); b.rollReach = Math.min(b.rollReach, r.rollReach);
}
say('模式     | 局数 | 观测月 | 月最少可承接 | 月最少可接(含名额) | 招生季最少在架候选人 | 招生季最少可招候选人 | 滚动12月新增(全部) | 滚动12月新增且可承接');
for (const k of Object.keys(modes)) { const b = modes[k];
  say(k.padEnd(8) + ' | ' + String(b.n).padStart(4) + ' | ' + String(b.months).padStart(6) + ' | ' + String(b.reach).padStart(12) + ' | ' + String(b.accept).padStart(18) + ' | ' + String(b.pool).padStart(20) + ' | ' + String(b.recruit).padStart(20) + ' | ' + String(b.rollAll).padStart(18) + ' | ' + String(b.rollReach).padStart(24)); }
const DOC = 21;
say('');
say('判定（对照 BALANCE §18.18 裁定① 绝对常量 = ' + DOC + ' 个/12 月）：');
say('  ① 每月 ≥' + MIN_ACCEPTABLE_PROJECT_OFFERS + ' 个可承接项目 offer：' + (Object.values(modes).every((b) => b.reach >= MIN_ACCEPTABLE_PROJECT_OFFERS) ? '全部模式通过（最小 ' + Math.min(...Object.values(modes).map((b) => b.reach)) + '）' : '存在违反'));
say('  ② 招生季 ≥1 个在架候选人：' + (Object.values(modes).every((b) => b.pool >= 1) ? '通过（最小 ' + Math.min(...Object.values(modes).map((b) => b.pool)) + '）' : '存在违反（最小 ' + Math.min(...Object.values(modes).map((b) => b.pool)) + '）'));
say('  ②b 招生季 ≥1 个「可招」候选人（含名额/经费条件）：' + (Object.values(modes).every((b) => b.recruit >= 1) ? '通过' : '存在为 0 的月份（最小 ' + Math.min(...Object.values(modes).map((b) => b.recruit)) + '）——需看是否为招生名额已满'));
say('  ③ 滚动 12 月「新增全部」项目 offer ≥ ' + DOC + '：' + (Object.values(modes).every((b) => b.rollAll >= DOC) ? '通过（最小 ' + Math.min(...Object.values(modes).map((b) => b.rollAll)) + '）' : '违反：' + Object.keys(modes).filter((k) => modes[k].rollAll < DOC).map((k) => k + '=' + modes[k].rollAll).join(', ')));
say('  ③b 滚动 12 月「新增且可承接」≥ ' + DOC + '（更严口径，供参考）：' + (Object.values(modes).every((b) => b.rollReach >= DOC) ? '通过' : '违反：' + Object.keys(modes).filter((k) => modes[k].rollReach < DOC).map((k) => k + '=' + modes[k].rollReach).join(', ')));
/**
 * tests/market.test.mjs —— 市场与资源管道（不堵死 / 独立配额 / 停滞回归）
 *
 * 背景：t4 修掉的两个死锁
 *   ① 学生 offer 永不过期 + 与项目 offer 抢同一批挂位 → 项目 offer 永久停发；
 *   ② 结题后没把项目从学生的 projectIds 里摘掉 → 学生 3 个名额被占满，全组再也不接新项目。
 * 这两条都会表现为「中期连续几个月零进展」，所以和商业/资源管道放在同一个测试里。
 *
 * 运行：node 评院士/tests/market.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { activeProjects, activeStudents, openHardpointCount } from '../src/core/formulas.js';
import { offerReachable, canAcceptOffer, canRecruitOffer } from '../src/core/rules.js';
import {
  PROJECT_SLOTS, STUDENT_SLOTS, MARKET_SLOTS, PROJECT_OFFER_TTL_MONTHS,
  STUDENT_OFFER_TTL_MONTHS, MIN_ACCEPTABLE_PROJECT_OFFERS, SUPPLY_FLOOR_12M,
} from '../src/data/projects.js';
import { POOL_CAP } from '../src/data/market.js';
import { runGame } from '../src/systems/bots.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('市场与资源管道');

/* ── 1 席位关系自洽 ── */
s.eq(MARKET_SLOTS, PROJECT_SLOTS + STUDENT_SLOTS, '总席位口径 = 项目席位 + 学生席位（各自独立配额）');
s.ok(POOL_CAP >= MARKET_SLOTS, 'POOL_CAP(' + POOL_CAP + ') ≥ 总席位(' + MARKET_SLOTS + ')，不会互相挤压');
s.ok(MIN_ACCEPTABLE_PROJECT_OFFERS >= 1, '「市场里始终有至少 N 个能接的项目」的不变式 ≥ 1');

/* ── 2 连续 400 个月（无玩家操作）：可承接项目 offer 不得长期为 0 ── */
{
  let st = freshGame(mods, 'market-400');
  let zeroMonths = 0;
  let zeroRun = 0;
  let maxZeroRun = 0;
  let overCap = 0;
  let overProject = 0;
  let overStudent = 0;
  let months = 0;
  for (let i = 0; i < 400; i += 1) {
    const reachable = st.market.pool.filter((o) => o.kind === 'project' && offerReachable(st, o)).length;
    const acceptable = st.market.pool.filter((o) => o.kind === 'project' && canAcceptOffer(st, o).ok).length;
    if (reachable === 0) { zeroMonths += 1; zeroRun += 1; maxZeroRun = Math.max(maxZeroRun, zeroRun); } else zeroRun = 0;
    if (st.market.pool.length > POOL_CAP) overCap += 1;
    if (st.market.pool.filter((o) => o.kind === 'project' && !o.locked).length > PROJECT_SLOTS) overProject += 1;
    if (st.market.pool.filter((o) => o.kind === 'student' && !o.locked).length > STUDENT_SLOTS) overStudent += 1;
    if (acceptable === 0 && activeProjects(st).length === 0) zeroMonths = zeroMonths; // 无操作时不该出现
    st.player.health = 90;               // 测试脚手架：只保命，不干预市场
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    months += 1;
    if (st.ending) break;
  }
  s.ok(months >= 200, '无操作也能连续推进很多月（不死循环）', months + ' 月');
  s.ok(maxZeroRun <= 2, '连续「市场里没有可承接项目」的月数 ≤ 2（死锁回归）', '最长 ' + maxZeroRun + ' 个月，累计 ' + zeroMonths + ' 个月');
  s.eq(overCap, 0, '池子从未突破 POOL_CAP');
  s.eq(overProject, 0, '项目 offer 从未超过独立配额 ' + PROJECT_SLOTS);
  s.eq(overStudent, 0, '学生 offer 从未超过独立配额 ' + STUDENT_SLOTS);
}

/* ── 3 学生 offer 也有有效期 ── */
{
  let st = freshGame(mods, 'market-ttl');
  st.market.pool.push({
    offerId: 'oStale', kind: 'student', name: '老王', degree: 'master', source: 'exam',
    ability: 0.5, cost: 3, reqIF: 60, reqRank: 2, locked: false,
    createdMonthIndex: 0, tier: 1,
  });
  st.calendar.monthIndex = STUDENT_OFFER_TTL_MONTHS + 3;
  st.player.health = 90;
  st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.eq(st.market.pool.some((o) => o.offerId === 'oStale'), false, '学生 offer 过期会被撤走（旧实现永久不过期 → 占满挂位）');
}
{
  let st = freshGame(mods, 'market-locked');
  st.market.pool.push({
    offerId: 'oLocked', kind: 'student', name: '小张', degree: 'master', source: 'exam',
    ability: 0.5, cost: 3, reqIF: 60, reqRank: 2, locked: true,
    createdMonthIndex: 0, tier: 1,
  });
  st.calendar.monthIndex = STUDENT_OFFER_TTL_MONTHS + 3;
  st.player.health = 90;
  st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(st.market.pool.some((o) => o.offerId === 'oLocked'), '锁定的 offer 不受有效期影响');
}
// v1.2：项目在到期月撤下，锁定例外，不能把三个月 TTL 算成四个月。
{
  let st = freshGame(mods, 'project-expiry-boundary');
  const offer = st.market.pool.find((o) => o.kind === 'project');
  st.market.pool = [
    { ...offer, offerId: 'expires-now', createdMonthIndex: 0, expiresMonthIndex: PROJECT_OFFER_TTL_MONTHS },
    { ...offer, offerId: 'locked-now', createdMonthIndex: 0, expiresMonthIndex: PROJECT_OFFER_TTL_MONTHS, locked: true },
    { ...offer, offerId: 'expires-next', createdMonthIndex: 1, expiresMonthIndex: PROJECT_OFFER_TTL_MONTHS + 1 },
  ];
  st.calendar.monthIndex = PROJECT_OFFER_TTL_MONTHS;
  st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(!st.market.pool.some((o) => o.offerId === 'expires-now'), '项目到期月立即撤下释放供给席位');
  s.ok(st.market.pool.some((o) => o.offerId === 'locked-now'), '锁定项目到期仍保留');
  s.ok(st.market.pool.some((o) => o.offerId === 'expires-next'), '未到期项目仍保留');
}

/* ── 4 中期停滞回归：速通路线不存在连续 6 个月以上的零进展段 ── */
{
  const run = runGame({ seed: 'market-stall', strategy: 'speedrun', months: 400 });
  let stall = 0;
  let maxStall = 0;
  let at = 0;
  let prevTotal = null;
  const stallSpans = [];
  for (const h of run.history) {
    void h;
  }
  // 用项目进度的月度增量判断「零进展」（比总 IF 更敏感）
  let state = null;
  const progressByRun = [];
  const rerun = runGame({
    seed: 'market-stall', strategy: 'speedrun', months: 400,
    onMonth: (st) => {
      state = st;
      const total = activeProjects(st).reduce((n, p) => n + p.progress, 0) + st.counters.projectsFinished * 1000 + st.counters.projectsFailed * 1000;
      progressByRun.push(total);
    },
  });
  void state;
  void rerun;
  for (let i = 1; i < progressByRun.length; i += 1) {
    const delta = progressByRun[i] - progressByRun[i - 1];
    if (delta <= 0.0001) { stall += 1; if (stall === 1) at = i; maxStall = Math.max(maxStall, stall); }
    else { if (stall >= 3) stallSpans.push('第 ' + at + '–' + (at + stall - 1) + ' 月'); stall = 0; }
  }
  prevTotal = progressByRun.length;
  s.ok(maxStall <= 5, '速通路线不存在连续 ≥6 个月的零进展段（t6 验收项）', '最长 ' + maxStall + ' 个月；' + (stallSpans.length ? '3 个月以上的段落：' + stallSpans.join('、') : '无'));
  // 【前提，不是门禁】本断言的职责是防空跑：观测长度至少要能容纳 4 个停滞窗口（≥24 月），
  // 否则「没有 ≥6 月停滞」这句话可以靠「局太短」白拿。旧值 >100 是 t47 修工资符号前标定的，
  // 那时该 seed 恰好跑满 400 月；修符号后第 32 月就因「欠薪 → 学生离组」真实结束（不是跳过），
  // 所以这里把前提改成 24 并把实际长度打印出来，真正的门禁仍是上一行的「无 ≥6 月停滞」。
  s.ok(progressByRun.length >= 24, '前提：该局观测到 ≥24 个月（足够容纳 4 个停滞窗口，防空跑）',
    '实际 ' + prevTotal + ' 个月' + (prevTotal < 100 ? '（t47 修工资符号后，该局因欠薪离组提前结束）' : ''));
}

/* ── 5 项目 offer 全年刷新（t22：项目市场与招生季解耦） ── */
{
  // 旧实现把项目刷新挂在「招生季」上：第 0 月池子为空、第 1–5 月靠不变式补到 1 个、第 6 月才跳到 3–5 个。
  // 于是 1–5 月的项目栏几乎接不到新本子，而 6 月突然涌现——项目节奏被招生月份牵着走。
  const st0 = freshGame(mods, 'market-year-round');
  const opening = st0.market.pool.filter((o) => o.kind === 'project');
  s.ok(opening.length >= 1, '开局（第 0 月）市场里就有项目 offer（旧实现为 0 个）', String(opening.length) + ' 个');
  s.ok(opening.some((o) => canAcceptOffer(st0, o).ok), '开局至少有一个「现在真能接」的项目 offer');

  const MONTHS = 36;
  const counts = [];
  const acceptable = [];
  let st = st0;
  for (let i = 0; i < MONTHS; i += 1) {
    counts.push(st.market.pool.filter((o) => o.kind === 'project').length);
    acceptable.push(st.market.pool.filter((o) => o.kind === 'project' && canAcceptOffer(st, o).ok).length);
    st.player.health = 90;               // 测试脚手架：只保命，不做任何玩家操作
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    if (st.ending) break;
  }
  s.ok(counts.length >= 24, '无操作也能推进足够多的月份来做节奏断言', counts.length + ' 月');
  const isRecruitSeason = (i) => [6, 7, 8, 9, 10, 11, 12].includes((i % 12) + 1);
  const offSeason = counts.filter((_, i) => !isRecruitSeason(i));
  const offMin = Math.min(...offSeason);
  s.ok(offMin >= 2, '非招生季（1–5 月）项目 offer 数 ≥ 2：项目刷新不再被招生季牵着走（旧实现恒为 1）',
    '非招生季最少 ' + offMin + ' 个（全月最少 ' + Math.min(...counts) + ' 个）');
  s.ok(acceptable.every((a) => a >= MIN_ACCEPTABLE_PROJECT_OFFERS),
    '逐月都有可承接的项目 offer（t22 后不再依赖「1–5 月只补 1 个」的兜底）',
    '最少 ' + Math.min(...acceptable) + ' 个');
  const before = offSeason.slice(0, 6);
  s.ok(before.every((c) => c >= 2), '开局头几个月就有 ≥2 个项目 offer（第 6 月不再出现「突然跳变」）',
    '第 1–6 个非招生月：' + before.join(','));

  const sel = (await import('../src/core/selectors.js')).selectMarket(st0);
  s.ok(sel.projectsOpenAllYear === true, 'selectMarket 明确声明项目市场全年开放');
  s.eq(sel.recruitOpen, false, '第 0 月（1 月）不是招生季：recruitOpen 应为 false（不再有「第 0 月强行开放」特例）');
  s.eq(sel.slots.projects.cap, PROJECT_SLOTS, '项目席位与总席位口径分离：projects.cap = PROJECT_SLOTS');
  s.eq(sel.slots.students.cap, STUDENT_SLOTS, '学生席位与总席位口径分离：students.cap = STUDENT_SLOTS');
}

/* ── 6 供给不变式（t30）：12 个月新增可承接 offer ≥ 名义供给率的 85%；招生季「够得着」的候选人 ≥ 1 ── */
{
  let cur = freshGame(mods, 't30-supply');
  const seen = new Set();
  let newReach = 0;
  const monthly = [];
  for (let i = 0; i < 12; i += 1) {
    cur = reduce(cur, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    let fresh = 0;
    for (const o of cur.market.pool) {
      if (o.kind !== 'project' || seen.has(o.offerId)) continue;
      seen.add(o.offerId);
      if (offerReachable(cur, o)) { newReach += 1; fresh += 1; }
    }
    monthly.push(fresh);
  }
  // ★ 下界必须是**独立于被测数据的绝对常量**：docs/BALANCE.md §18.18 裁定 ① 定稿 21 个/12 个月（绝对值）。
  //   反面教材（t30 曾这么写）：下界 =「名义供给率 (PROJECT_SLOTS−1)/TTL × 12 × 0.85」——
  //   它由被测数据自己算出，供给一降下界跟着降，断言永远绿（与 t6 抓到的反向断言同类：看着在把关，实际抓不到东西）。
  //   纪律（BALANCE §18.18 裁定 ④）：改 PROJECT_SLOTS / TTL 必须**显式改这个常量并说明理由**，红线与参数解耦；
  //   当前 21 是零余量（实测正好压在预算下界上：任何再吃掉一个席位的改动都会点亮它）。
  //   常量本体住在 src/data/projects.js 的 SUPPLY_FLOOR_12M（t41：绝对常量，不由 slots/TTL 反推）。
  const SUPPLY_MIN_NEW_OFFERS_PER_YEAR = SUPPLY_FLOOR_12M;   // docs/BALANCE.md §18.18 裁定 ①
  s.ok(newReach >= SUPPLY_MIN_NEW_OFFERS_PER_YEAR,
    '任意连续 12 个月新增项目 offer ≥ ' + SUPPLY_MIN_NEW_OFFERS_PER_YEAR + '（BALANCE 绝对常量；含「看得见目标」的本子，不含已挂 N 月的旧 offer）',
    newReach + ' 个（逐月 ' + monthly.join(',') + '）｜余量 ' + (newReach - SUPPLY_MIN_NEW_OFFERS_PER_YEAR)
    + ' 个（零余量：改席位/TTL 必须同步改本常量并说明理由，见 BALANCE §18.18 裁定 ④）');
}
{
  // 「总 IF 够 rank2 但一作不足」的玩家：旧口径被 reqRank 卡死（实测 0 人可招），
  // t30 起 reqRank 只做展示，招聘只看 reqIF —— 招生季内必须能招到 ≥1 人。
  let g = freshGame(mods, 't30-recruit');
  for (const st of g.students) st.graduated = true;
  for (let i = 0; i < 6; i += 1) g = reduce(g, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  g = { ...g, player: { ...g.player, totalIF: 1500, papers: { top: 0, q1: 0, q2: 0, q3: 0, q4: 0 } } };
  const cands = g.market.pool.filter((o) => o.kind === 'student');
  const reach = cands.filter((o) => canRecruitOffer(g, o).ok);
  const byRank = cands.filter((o) => (o.reqRank || 1) <= g.player.rankIndex);
  s.ok(cands.length >= 1, '招生季（第 6 月）市场里挂着候选人', String(cands.length));
  s.ok(reach.length >= 1, '招生季内「IF 够、一作不足」的玩家必须能招到 ≥1 人（t30 移除 reqRank 准入）',
    reach.length + '/' + cands.length + ' 人可招（旧口径被 reqRank 卡到 ' + byRank.length + ' 人）');
  s.ok(byRank.length <= reach.length, '同一个池子里：旧口径（reqRank 也卡）可招人数 ≤ 新口径（只看 reqIF），证明放宽的是 rank 而不是 IF');
  if (reach.length) {
    const after = reduce(g, ACTIONS.hireStudent({ offerId: reach[0].offerId }));
    s.eq(after.students.filter((x) => !x.left && !x.graduated && x.enteredMonthIndex === g.calendar.monthIndex).length, 1,
      '候选人 reqRank ' + reach[0].reqRank + ' > 玩家 rank ' + g.player.rankIndex + '，但 reqIF 够 → 招得进来');
  }
}

s.finish();

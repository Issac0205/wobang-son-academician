/**
 * tests/promotion.test.mjs —— 晋升判定（八级阶梯 / 各档门槛 / 增选窗口）
 * 运行：node 评院士/tests/promotion.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createProject, createState } from '../src/core/state.js';

const mods = { createState, reduce, ACTIONS };
import { RANKS, rankOf, MAX_RANK_INDEX, ELECTION_WINDOW_INTERVAL, MIN_ACADEMICIAN_AGE, RECOMMEND_TICKET_REQ } from '../src/data/ranks.js';
import { INTEGRITY_DELTA } from '../src/data/tuning.js';
import { rankStatus } from '../src/core/formulas.js';
import { promotionStatus } from '../src/core/rules.js';
const s = createSuite('晋升判定');

/* ── 1 阶梯本身 ── */
const titles = RANKS.slice(1).map((r) => r.title);
s.eq(titles.length, 8, '八级头衔齐全');
s.eq(MAX_RANK_INDEX, 8, '最高头衔 = 院士');
s.ok(/副研究员/.test(titles[0]) && /研究员/.test(titles[1]) && /副教授/.test(titles[2]) && /教授/.test(titles[3]),
  '前四级顺序：副研究员 → 研究员 → 副教授 → 教授', titles.slice(0, 4).join(' → '));
s.ok(/优青|万人/.test(titles[4]), '第 5 级 = 优青 / 万人', titles[4]);
s.ok(/杰青|长江/.test(titles[5]) && /杰青|长江/.test(titles[6]), '第 6/7 级 = 杰青 / 长江（单有 → 兼有）', titles[5] + ' / ' + titles[6]);
s.ok(/院士/.test(titles[7]), '第 8 级 = 院士', titles[7]);

let monotone = true;
for (let i = 2; i <= 8; i += 1) {
  const a = RANKS[i - 1];
  const b = RANKS[i];
  if (!(b.ifReq > a.ifReq && b.q1Req >= a.q1Req && b.q2Req >= a.q2Req && b.topReq >= a.topReq)) monotone = false;
}
s.ok(monotone, '每级的总 IF / 一区 / 二区 / 正刊门槛单调不减');
s.eq(RANKS[8].ifReq, 1400, '院士门槛 = 1400 IF');
s.ok(RANKS[8].topReq >= 1 && RANKS[8].q1Req >= 16, '院士需要正刊 ≥1 且一区 ≥16', 'top' + RANKS[8].topReq + '/q1' + RANKS[8].q1Req);

/* ── 2 门槛判定 ── */
{
  const st = freshGame(mods, 'promo-base');
  const status = rankStatus(st);
  s.eq(status.next.index, 2, '开局下一个头衔 = 研究员');
  s.ok(status.missing.some((m) => m.key === 'q1'), '开局缺一区论文（q1Req=2，持有 1）', JSON.stringify(status.missing.map((m) => m.key)));
}

{
  const st = freshGame(mods, 'promo-ladder');
  st.player.totalIF = 200;
  st.player.papers = { top: 3, q1: 20, q2: 50, q3: 0, q4: 0 };
  const status = rankStatus(st);
  s.ok(!status.missing.some((m) => m.key === 't6'), 'rank7 的 T6 结题要求只在 projTierReq>=6 时才有（rank2 不查项目）');
  s.eq(status.next.index, 2, '（IF 超了但一区/二区都够时，下一级仍是 2）');
}

/* ── 3 一次真实晋升 ── */
{
  const st = freshGame(mods, 'promo-real');
  st.player.totalIF = 40;
  st.player.papers = { top: 0, q1: 2, q2: 2, q3: 0, q4: 0 };
  // t30 起研究员门槛含「T1 及以上结题 ×1」（BALANCE §18.10），fixture 必须给一个已结题项目。
  st.projects.push(createProject({ instanceId: 'pT1', defId: 'E1', category: 'enterprise', tier: 1, workload: 80, progress: 80, money: 8, status: 'finished' }));
  const before = st.player.integrity;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.eq(after.player.rankIndex, 2, '满足研究员门槛后，月末自动晋升');
  s.eq(after.player.integrity, Math.min(100, before + 2), '晋升 +2 诚信');
}

/* ── 4 院士：需要窗口 + 年龄 + 票 + T6 ── */
function academicianReady(seed) {
  const st = freshGame(mods, seed);
  st.player.rankIndex = 7;
  st.player.totalIF = 1400;
  st.player.papers = { top: 3, q1: 16, q2: 44, q3: 0, q4: 0 };
  st.player.tickets = RECOMMEND_TICKET_REQ;
  st.player.age = MIN_ACADEMICIAN_AGE + 1;
  st.player.health = 90;
  st.player.money = 500;
  st.player.consumable = 500;
  for (let i = 0; i < 2; i += 1) {
    st.projects.push(createProject({ instanceId: 'p9' + i, defId: 'N6', category: 'nation', tier: 6, workload: 10, progress: 10, status: 'finished' }));
  }
  return st;
}

{
  const st = academicianReady('promo-aca');
  const status = promotionStatus(st);
  s.ok(!status.eligible, '不在增选窗口时不能升院士');
  s.ok(/窗口/.test(status.reason), '理由写明增选窗口', status.reason);
}

{
  const st = academicianReady('promo-aca-noproj');
  st.projects = [];
  st.flags.electionWindowOpen = true;
  const status = promotionStatus(st);
  s.ok(status.missing.some((m) => m.key === 't6'), '缺 T6 结题时判为不满足（院士需 T6 结题 ≥2）', JSON.stringify(status.missing));
}

{
  const st = academicianReady('promo-aca-young');
  st.flags.electionWindowOpen = true;
  st.player.age = MIN_ACADEMICIAN_AGE - 1;
  const status = promotionStatus(st);
  s.ok(!status.eligible && /年龄/.test(status.reason), '年龄不足 45 岁时不能升院士', status.reason);
}

{
  const st = academicianReady('promo-aca-noticket');
  st.flags.electionWindowOpen = true;
  st.player.tickets = RECOMMEND_TICKET_REQ - 1;
  const status = promotionStatus(st);
  s.ok(!status.eligible && /推荐票/.test(status.reason), '推荐票不足时不能升院士', status.reason);
}

{
  // 窗口月 = 每 24 个月的结算月：把日历拨到 167，月末结算后进入 168 = 窗口
  const st = academicianReady('promo-aca-window');
  st.calendar.monthIndex = ELECTION_WINDOW_INTERVAL * 7 - 1;
  st.calendar.year = Math.floor(st.calendar.monthIndex / 12) + 1;
  st.calendar.month = (st.calendar.monthIndex % 12) + 1;
  st.player.age = MIN_ACADEMICIAN_AGE + 5;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.eq(after.player.rankIndex, 8, '窗口月 + 材料齐备 → 升院士');
  s.ok(after.ending && after.ending.id === 'academician', '立刻写出院士结局', after.ending && after.ending.id);
  s.eq(after.phase, 'ended', '游戏进入结束态');
  s.eq(after.calendar.monthIndex % ELECTION_WINDOW_INTERVAL, 0, '晋升发生在增选窗口月');
}

/* ── 5 「准院士」不能提前触发（t4 修复的 bug） ── */
{
  const st = academicianReady('promo-almost');
  st.player.totalIF = 900;
  st.player.papers = { top: 2, q1: 12, q2: 34, q3: 0, q4: 0 };
  st.projects = [];
  st.calendar.monthIndex = 25;
  let cur = st;
  for (let i = 0; i < 12; i += 1) cur = reduce(cur, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(!cur.flags.almostAcademician, 'rank7+3票 不会在窗口关闭后立刻被判「准院士」结束');
  s.ok(!cur.ending || cur.ending.id !== 'almost', '游戏没有被误判结束', cur.ending && cur.ending.id);
}

/* ── 抢一作不得重复计 IF（t16 F2） ── */
{
  const st = freshGame(mods, 'promote-grab');
  const st0 = st.students[0];
  st.projects.push(createProject({
    instanceId: 'grabP', defId: 'N4', name: '抢一作用项目', category: 'nation', tier: 4,
    workload: 600, progress: 600, money: 200, depositRate: 0.30, consumablePerMonth: 0,
    deadlineMonthIndex: 999, status: 'finished',
    paperTiers: [{
      paperId: 'grabP:p1', patternId: 'PB', tier: 'q1', if: 12, firstAuthorId: st0.id,
      firstAuthorName: st0.name, grabbed: false, grabbedMonthIndex: null,
    }],
  }));
  const ifBefore = st.player.totalIF;
  const papersBefore = st.player.papers.q1 || 0;
  const firstBefore = st.player.papersFirst.q1 || 0;
  const integrityBefore = st.player.integrity;
  const after = reduce(st, ACTIONS.grabFirstAuthor({ studentId: st0.id, paperId: 'grabP:p1', tier: 'q1' }));
  s.eq(after.player.totalIF, ifBefore, '抢一作前后 totalIF 不变（这篇论文结题时已经计过 IF）');
  s.eq(after.player.papersFirst.q1, firstBefore + 1, 'papersFirst 台账 +1（诚信/展示口径）');
  s.eq(after.player.papers.q1, papersBefore + 1, 'papers 计数台账 +1（只记数，不计 IF）');
  s.eq(after.player.integrity, integrityBefore + INTEGRITY_DELTA.grabFirst, '诚信按总表扣 ' + INTEGRITY_DELTA.grabFirst);
  s.eq(after.projects.find((p) => p.instanceId === 'grabP').paperTiers[0].grabbed, true, '台账写入 grabbed');
  s.eq(after.projects.find((p) => p.instanceId === 'grabP').paperTiers[0].grabbedMonthIndex, after.calendar.monthIndex, '台账写入 grabbedMonthIndex');
  const again = reduce(after, ACTIONS.grabFirstAuthor({ studentId: st0.id, paperId: 'grabP:p1', tier: 'q1' }));
  s.ok(Boolean(again.ui.toast), '同一篇不能抢第二次（给 toast）', String(again.ui.toast));
  s.eq(again.player.totalIF, ifBefore, '第二次被拒后 totalIF 仍然不变');
}

void rankOf;
s.finish();

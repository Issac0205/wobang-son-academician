/**
 * probeB.mjs —— t6 独立验证探针 B：数值一致性 / 次优打法可通关性 / 正刊来源 / 年龄时间线
 * 运行：node 评院士/artifacts/verification/probeB.mjs
 */
import { createState } from '../../src/core/state.js';
import { ACTIONS, reduce } from '../../src/core/engine.js';
import { rankStatus, expectedWageTier } from '../../src/core/formulas.js';
import { promotionStatus, endingFor } from '../../src/core/rules.js';
import { PAPER_PATTERNS, JOURNAL_IF_BASE } from '../../src/data/papers.js';
import { PROJECTS, PROJECT_MAP, OVERDUE_GRACE_MONTHS } from '../../src/data/projects.js';
import { RANKS, MIN_ACADEMICIAN_AGE, RECOMMEND_TICKET_REQ } from '../../src/data/ranks.js';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';

const SEEDS = [];for (let i = 1; i <= 8; i += 1) SEEDS.push('t4-0' + i);
const MONTHS = 400;
const f = (n, d = 1) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : String(n));
const out = []; const say = (s) => out.push(s);
void expectedWageTier;

/* ══ A. 数据一致性：按论文模板权重独立重算项目期望值 ══ */
say('══════ A. 数据一致性：projects.js 声明的期望值 vs 按 papers.js 权重独立重算 ══════');
const PAT = (id) => PAPER_PATTERNS[id] || PAPER_PATTERNS[PAPER_PATTERNS[id] ? id : Object.keys(PAPER_PATTERNS)[0]];
const meanIF = (id) => { const p = PAPER_PATTERNS[id]; return Object.keys(p.weights).reduce((s, t) => s + p.weights[t] * JOURNAL_IF_BASE[t], 0); };
const wOf = (id, t) => (PAPER_PATTERNS[id].weights[t] || 0);
say('  论文模板平均 IF（JOURNAL_IF_BASE 均值 ×U(0.85,1.15)）：' + Object.keys(PAPER_PATTERNS).map((id) => id + '=' + f(meanIF(id), 2) + '（声明 ' + PAPER_PATTERNS[id].expectedIF + '）').join(' / '));
say('');
say('  项目 | 声明 expectedIF | 重算 | 声明 q1Expect | 重算 Σw(q1) | 声明 topExpect | 重算 Σw(top) | 判定');
const mismatch = [];
for (const d of PROJECTS) {
  const pats = d.papers || [];
  const eif = pats.reduce((s, id) => s + meanIF(id), 0);
  const q1 = pats.reduce((s, id) => s + wOf(id, 'q1'), 0);
  const top = pats.reduce((s, id) => s + wOf(id, 'top'), 0);
  const bad = [];
  if (Math.abs(eif - d.expectedIF) > 0.02) bad.push('expectedIF');
  if (Math.abs(q1 - d.q1Expect) > 0.02) bad.push('q1Expect');
  if (Math.abs(top - d.topExpect) > 1e-9) bad.push('topExpect');
  if (bad.length) mismatch.push({ id: d.id, bad, eif, q1, top, d });
  say('  ' + d.id.padEnd(3) + ' | ' + String(d.expectedIF).padStart(7) + ' | ' + f(eif, 2).padStart(6) + ' | ' + String(d.q1Expect).padStart(6) + ' | ' + f(q1, 2).padStart(6) + ' | ' + String(d.topExpect).padStart(5) + ' | ' + f(top, 2).padStart(5) + ' | ' + (bad.length ? '❌ ' + bad.join(',') : '✓'));
}
say('  ⇒ 不一致项：' + (mismatch.length ? mismatch.map((m) => m.id + '(' + m.bad.join('/') + ')').join('、') : '无'));
const zeroTop = PROJECTS.filter((d) => d.topExpect > 0 && (d.papers || []).every((p) => !wOf(p, 'top')));
say('  ⇒ 「声明有正刊、但论文模板里根本没有正刊权重」的模板：' + (zeroTop.length ? zeroTop.map((d) => d.id + '(声明 topExpect ' + d.topExpect + '，实为 0)').join('、') : '无'));
say('  ⇒ 有正刊权重的模板：' + PROJECTS.filter((d) => (d.papers || []).some((p) => wOf(p, 'top'))).map((d) => d.id + '(' + f((d.papers || []).reduce((s, p) => s + wOf(p, 'top'), 0), 2) + ')').join('、'));
say('');

/* ══ B. 「次优但合理」人类打法 ══ */
const BASE = {
  hire: true, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false,
  usePlayerLead: false, buyFirstAuthorMax: 0, integrityFloor: 25, deferHappyFloor: 40,
};
const HUMAN = {
  'human_cashFirst(按钱/工期挑本子)': { ...BASE, id: 'h1', consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 20, hireMinAbility: 0.45, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4 },
  'human_loose(随便玩·买设备优先)': { ...BASE, id: 'h2', consumeModePolicy: 'adaptive', consumableMonths: 4, moneyReserve: 8, hireMinAbility: 0.55, projectScore: 'cashFirst', studentsPerProject: 3, exerciseHealthFloor: 60, teamBuildHappyFloor: 45, keepCrewFloor: 3 },
  'human_weak(最弱·人少+省钱)': { ...BASE, id: 'h3', consumeModePolicy: 'adaptive', consumableMonths: 3, moneyReserve: 30, hireMinAbility: 0.6, projectScore: 'cashFirst', studentsPerProject: 2, exerciseHealthFloor: 55, teamBuildHappyFloor: 40, keepCrewFloor: 3 },
  'human_cashFirst+买正刊': { ...BASE, id: 'h4', consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 30, hireMinAbility: 0.45, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4, buyFirstAuthorTier: 'top', buyFirstAuthorMax: 3 },
  'human_loose+买正刊': { ...BASE, id: 'h5', consumeModePolicy: 'adaptive', consumableMonths: 4, moneyReserve: 15, hireMinAbility: 0.55, projectScore: 'cashFirst', studentsPerProject: 3, exerciseHealthFloor: 60, teamBuildHappyFloor: 45, keepCrewFloor: 3, buyFirstAuthorTier: 'top', buyFirstAuthorMax: 3 },
};
function analyze(cfg) {
  const res = [];
  for (const seed of SEEDS) {
    let peakOverdue = 0, selfStalls = [], last = -1, stall = 0, stallAt = 0;
    const run = runGame({ seed, strategy: cfg, months: MONTHS, onMonth: (state, snap) => {
      peakOverdue = Math.max(peakOverdue, snap.overdueProjects || 0);
      const prog = (state.projects || []).filter((p) => p.status === 'active').reduce((s, p) => s + p.progress, 0) + state.counters.projectsFinished * 100000;
      if (last >= 0) { if (prog - last <= 0.0001) { if (stall === 0) stallAt = snap.monthIndex; stall += 1; } else { if (stall >= 6) selfStalls.push(stallAt + '–' + (stallAt + stall - 1)); stall = 0; } }
      last = prog;
    } });
    if (stall >= 6) selfStalls.push(stallAt + '–' + (stallAt + stall - 1));
    const st = run.state;
    const ps = promotionStatus(st);
    const rs = rankStatus(st);
    const topFromProjects = (st.player.papers.top || 0) - (st.counters.boughtPapers || 0) - (st.counters.grabbedPapers || 0);
    const winMonth = run.history.find((h) => h.rankIndex === 8);
    res.push({ seed, ending: st.ending ? st.ending.id : 'none', title: st.ending ? st.ending.title : '-', rank: st.player.rankIndex, rankTitle: RANKS[st.player.rankIndex].title,
      month: st.calendar.monthIndex, if: f(st.player.totalIF, 1), top: st.player.papers.top || 0, q1: st.player.papers.q1 || 0, tickets: st.player.tickets,
      bought: st.counters.boughtPapers || 0, grabbed: st.counters.grabbedPapers || 0, topFromProjects,
      finished: st.counters.projectsFinished, failed: st.counters.projectsFailed, integrity: f(st.player.integrity, 1), money: f(st.player.money, 1),
      peakOverdue, stalls: selfStalls, missing: rs.missing.map((m) => m.key + ':' + m.have + '/' + m.need), gateReason: ps.eligible ? '可晋升' : (ps.reason || ps.missing.map((m) => m.text).join('、') || '-'),
      winMonth: winMonth ? winMonth.monthIndex : null, ageAtWin: winMonth ? 33 + Math.floor(winMonth.monthIndex / 12) : null });
  }
  return res;
}
say('══════ B. 「次优但合理」人类打法能否摸到院士（必答 2）══════');
const profileResults = {};
for (const name of Object.keys(HUMAN)) {
  const res = analyze(HUMAN[name]);
  profileResults[name] = res;
  const wins = res.filter((r) => r.ending === 'academician' || r.rank === 8);
  const endings = {}; for (const r of res) endings[r.ending] = (endings[r.ending] || 0) + 1;
  say('')
  say('  ◆ ' + name + '：院士 ' + wins.length + '/' + res.length + '   结局分布 ' + JSON.stringify(endings));
  for (const r of res) {
    say('     ' + r.seed + ' 结局=' + r.ending + '(' + r.title + ') 头衔=' + r.rankTitle + '(#' + r.rank + ') 月=' + r.month + ' IF=' + r.if + ' 一区=' + r.q1 + ' 正刊=' + r.top + '(项目来源 ' + r.topFromProjects + '/买 ' + r.bought + '/抢 ' + r.grabbed + ')' + ' 票=' + r.tickets + ' 结题=' + r.finished + ' 逾期峰值=' + r.peakOverdue);
    say('        ↑ 卡点：' + r.gateReason + (r.missing.length ? ' | 缺 ' + r.missing.join(' ') : '') + (r.stalls.length ? ' | ≥6 月零增长段 ' + r.stalls.join('、') : ''));
    if (r.winMonth !== null) say('        ↑ 当选：第 ' + r.winMonth + ' 月，年龄 ' + r.ageAtWin + ' 岁');
  }
}
say('');

/* ══ C. 正刊门槛可达性（rank6/7/8 需要正刊） ══ */
say('══════ C. 正刊来源分解（rank6 需 1 / rank7 需 2 / rank8 需 3，单价 120 万）══════');
for (const name of Object.keys(profileResults)) {
  const res = profileResults[name];
  const withTop = res.filter((r) => r.top >= 1).length;
  const withTop3 = res.filter((r) => r.top >= 3).length;
  const projTop = res.reduce((s, r) => s + r.topFromProjects, 0);
  const bought = res.reduce((s, r) => s + r.bought, 0);
  say('  ' + name.padEnd(30) + ' 有 ≥1 正刊 ' + withTop + '/8，有 ≥3 正刊 ' + withTop3 + '/8；8 局共得正刊 ' + res.reduce((s, r) => s + r.top, 0) + '（项目掷点 ' + projTop + '，购买 ' + bought + '）');
}
say('');

/* ══ D. 年龄时间线 ══ */
say('══════ D. 年龄时间线自洽性（必答 5）══════');
say('  MIN_ACADEMICIAN_AGE=' + MIN_ACADEMICIAN_AGE + '，START_AGE_YEARS=33，RETIRE_AGE_YEARS=65，RETIRE_MONTH=384（age = 33 + (year-1)）');
say('  ⇒ 年龄 45 岁 = 第 ' + ((45 - 33) * 12) + ' 月；年龄 60 岁 = 第 ' + ((60 - 33) * 12) + ' 月；年龄 65 岁 = 第 ' + ((65 - 33) * 12) + ' 月 = 退休月 384');
const fastest = 144;
say('  ⇒ 理论最快当选：第 ' + fastest + ' 月 = ' + (33 + fastest / 12) + ' 岁（speedrun 实测最早 144 月，正好卡在 45 岁门槛上）');
for (const name of Object.keys(profileResults)) {
  const wins = profileResults[name].filter((r) => r.winMonth !== null);
  say('  ' + name.padEnd(30) + ' 当选局数 ' + wins.length + (wins.length ? '，当选月 ' + wins.map((r) => r.winMonth).join('/') + ' ⇔ 年龄 ' + wins.map((r) => r.ageAtWin).join('/') + ' 岁' : ''));
}
// 死常量运行时证明：把 IF 恰好压到 1400、年龄 61 岁，看是否还要 ×1.15
{
  let st = reduce(createState({ seed: 'age-proof' }), ACTIONS.newGame({ seed: 'age-proof' }));
  st.player.rankIndex = 7;
  st.player.totalIF = RANKS[8].ifReq;
  st.player.papers = { top: 3, q1: 99, q2: 99, q3: 99, q4: 99 };
  st.player.tickets = RECOMMEND_TICKET_REQ;
  st.player.age = 61;
  st.flags.electionWindowOpen = true;
  st.projects.push({ instanceId: 'x1', defId: 'N6', status: 'finished', tier: 6 });
  st.projects.push({ instanceId: 'x2', defId: 'N6', status: 'finished', tier: 6 });
  const rs = rankStatus(st);
  const ps = promotionStatus(st);
  say('  运行时证明（年龄 61 岁、IF 恰好 = ' + RANKS[8].ifReq + '）：rankStatus.ok=' + rs.ok + '，promotionStatus.eligible=' + ps.eligible + ' → ' + (ps.eligible ? '通过（说明年龄倍率没被乘，61 岁玩家仍然只需要 1400）' : '不通过：' + (ps.reason || JSON.stringify(rs.missing))));
  say('  t28 处置：死常量 AGE_IF_MUL_60/65 与 GOLDEN_AGE_INTEGRITY_BONUS 已从 src/data/ranks.js 移除'
    + '（65 岁 = 第 384 月 = RETIRE_MONTH，×1.40 结构上不可达；×1.15 只在 324–383 月生效，与 B2 方向相反）。');
}
say('');

/* ══ E. 两条验收路线的关键节点 ══ */
say('══════ E. 关键节点：速通院士 / 诚信崩盘被举报（acceptance ②材料）══════');
for (const [name, seed] of [['speedrun', 't4-01'], ['speedrun', 't4-06'], ['cheater', 't4-01'], ['cheater', 't4-04']]) {
  const run = runGame({ seed, strategy: name, months: MONTHS });
  const st = run.state;
  say('');
  say('  ◆ ' + name + ' / ' + seed + '：结局 ' + (st.ending ? st.ending.id + '(' + st.ending.title + ')' : '无') + '，共 ' + st.calendar.monthIndex + ' 月');
  for (const n of run.nodes) say('     [' + String(n.monthIndex).padStart(3) + '] ' + n.text);
  const mark = [];
  for (const h of run.history) if (h.rankIndex !== (mark.length ? mark[mark.length - 1].rankIndex : 1)) mark.push(h);
  say('     晋升轨迹：' + mark.map((h) => '第' + h.monthIndex + '月→' + h.rank + '(IF ' + h.totalIF + '/一区' + h.q1 + '/正刊' + h.top + '/票' + h.tickets + ')').join('  '));
  say('     终局：IF=' + f(st.player.totalIF, 1) + ' 一区=' + st.player.papers.q1 + ' 正刊=' + st.player.papers.top + ' 票=' + st.player.tickets + ' 诚信=' + f(st.player.integrity, 1) + ' 结题=' + st.counters.projectsFinished + ' 逾期峰值=' + Math.max.apply(null, run.history.map((h) => h.overdueProjects)));
}
void endingFor; void PROJECT_MAP; void OVERDUE_GRACE_MONTHS;
console.log(out.join('\n'));
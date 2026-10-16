/** probeG.mjs — t29 通关率（带尺子纪律）+ 一作供给链（亲带/抢/买）+ 8 级门槛供给 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
import { RANKS } from '../../src/data/ranks.js';
const S = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
const ENGINE = S('D:/harness/评院士/src/core/engine.js');
const BOTS = S('D:/harness/评院士/src/systems/bots.js');
const say = (s) => console.log(s);
const seeds = (n) => { const a = []; for (let i = 1; i <= n; i += 1) a.push('t4-' + String(i).padStart(2, '0')); return a; };
say('尺子纪律：engine.js sha256[:12] = ' + ENGINE + '　bots.js sha256[:12] = ' + BOTS);
say('门槛供给需求（RANKS）：' + RANKS.filter(Boolean).map((r) => '#' + r.index + ' ' + r.title + ' IF' + r.ifReq + ' q1≥' + r.q1Req + ' q2≥' + (r.q2Req || 0) + ' top≥' + (r.topReq || 0) + (r.projTierReq ? ' T' + r.projTierReq + '结题≥' + (r.projCountReq || 1) : '')).join(' | '));
say('');
function tally(runs) {
  const out = { n: runs.length, win: 0, endings: {}, q1: [], q2: [], top: [], ifn: [], papersSum: [], awards: [], bought: [], grabbed: [], lead: [], integrity: [], mismatch: 0, rank: [] };
  for (const r of runs) {
    const s = r.state; const e = s.ending ? s.ending.id : 'none';
    out.endings[e] = (out.endings[e] || 0) + 1;
    if (e === 'academician') out.win += 1;
    const p = s.player.papers || {};
    const sum = (p.q1 || 0) + (p.q2 || 0) + (p.q3 || 0) + (p.q4 || 0) + (p.top || 0);
    const awards = s.counters.papersAwarded || 0; const bought = s.counters.boughtPapers || 0; const grabbed = s.counters.grabbedPapers || 0;
    if (sum > awards + grabbed) out.mismatch += 1;   // 玩家一作数不得超过「亲带+买(计入 awards) + 抢」
    out.q1.push(p.q1 || 0); out.q2.push(p.q2 || 0); out.top.push(p.top || 0);
    out.ifn.push(Math.round(s.player.totalIF)); out.papersSum.push(sum); out.awards.push(awards); out.bought.push(bought); out.grabbed.push(grabbed);
    out.lead.push(Math.max(0, sum - bought - grabbed)); out.integrity.push(Math.round(s.player.integrity)); out.rank.push(s.player.rankIndex);
  }
  return out;
}
const mm = (a) => a.length ? (Math.min.apply(null, a) + '/' + Math.max.apply(null, a)) : '-';
function line(name, t) {
  say('▶ ' + name + '（' + t.n + ' 局，engine ' + ENGINE + ' / bots ' + BOTS + '）');
  say('   通关 ' + t.win + '/' + t.n + ' = ' + (100 * t.win / t.n).toFixed(1) + '%　结局 ' + JSON.stringify(t.endings) + '　末局头衔 #' + mm(t.rank) + '　末局诚信 ' + mm(t.integrity));
  say('   一作来源：亲带 ' + t.lead.reduce((a, b) => a + b, 0) + ' 篇 / 买 ' + t.bought.reduce((a, b) => a + b, 0) + ' 篇 / 抢 ' + t.grabbed.reduce((a, b) => a + b, 0) + ' 篇　（一局区间 亲带 ' + mm(t.lead) + ' 买 ' + mm(t.bought) + ' 抢 ' + mm(t.grabbed) + '）');
  say('   末局玩家一作 q1 ' + mm(t.q1) + '　q2 ' + mm(t.q2) + '　正刊 ' + mm(t.top) + '　总一作篇数 ' + mm(t.papersSum) + '　总 IF ' + mm(t.ifn));
  if (t.mismatch) say('   ⚠ 产出守恒不一致局数 ' + t.mismatch + '（判定：Σplayer.papers ≠ papersAwarded + grabbedPapers）');
}
say('══ 一 · 四条机器人路线的通关率（独立复算，含尺子口径）══');
const runs = {};
for (const [name, n] of [['speedrun', 8], ['casual', 16], ['balanced', 8], ['cheater', 8]]) {
  runs[name] = seeds(n).map((seed) => runGame({ seed, strategy: STRATEGIES[name], months: 400 }));
  line(name, tally(runs[name]));
}
say('');
say('══ 二 · 「次优但合理」人类配置（本探针自建，不引用实施者断言）══');
const BASE = { hire: true, hireMinAbility: 0.45, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false, integrityFloor: 25, deferHappyFloor: 40, consumeModePolicy: 'adaptive', consumableMonths: 6, moneyReserve: 20, projectScore: 'ifPerWorkload', studentsPerProject: 5, exerciseHealthFloor: 72, teamBuildHappyFloor: 52, keepCrewFloor: 5 };
const HUMANS = {
  'H1 只亲带不买不抢（leadMax 4）': { ...BASE, usePlayerLead: true, leadMax: 4, buyFirstAuthorMax: 0 },
  'H2 亲带 + 少量买一作（max 2）': { ...BASE, usePlayerLead: true, leadMax: 4, buyFirstAuthorTier: 'q1', buyFirstAuthorTiers: ['top', 'q1'], buyFirstAuthorMax: 2 },
  'H3 既不亲带也不买不抢（对照：一作供给应为 0）': { ...BASE, usePlayerLead: false, buyFirstAuthorMax: 0 },
};
const humanRuns = {};
for (const name of Object.keys(HUMANS)) {
  humanRuns[name] = seeds(8).map((seed) => runGame({ seed, strategy: HUMANS[name], months: 400 }));
  line(name, tally(humanRuns[name]));
}
say('');
say('══ 三 · 一作三条来源的单独验证（同一种子 t4-01，只开一条来源）══');
const ONLY = {
  '只亲带': { ...BASE, usePlayerLead: true, leadMax: 5, buyFirstAuthorMax: 0 },
  '只买': { ...BASE, usePlayerLead: false, buyFirstAuthorTier: 'q1', buyFirstAuthorTiers: ['top', 'q1'], buyFirstAuthorMax: 6 },
  '只抢': { ...BASE, usePlayerLead: false, buyFirstAuthorMax: 0, grabFirstAuthors: true, integrityFloor: 0 },
};
for (const name of Object.keys(ONLY)) {
  for (const seed of ['t4-01', 't4-03']) {
    const r = runGame({ seed, strategy: ONLY[name], months: 400 });
    const s = r.state; const p = s.player.papers || {};
    const awards = s.counters.papersAwarded || 0; const bought = s.counters.boughtPapers || 0; const grabbed = s.counters.grabbedPapers || 0;
    say('   ' + name.padEnd(6) + ' ' + seed + '：亲带 ' + Math.max(0, awards - bought) + ' / 买 ' + bought + ' / 抢 ' + grabbed + ' 篇 | q1 ' + (p.q1 || 0) + ' q2 ' + (p.q2 || 0) + ' 正刊 ' + (p.top || 0) + ' | 末局头衔 #' + s.player.rankIndex + ' | 结局 ' + (s.ending ? s.ending.id : 'none') + ' | 诚信 ' + Math.round(s.player.integrity));
  }
}
say('');
say('══ 四 · H2 复判（耗材断供 → 被举报 是否仍在未作弊路线上出现）══');
const cas = runs.casual;
const rep = cas.filter((r) => r.state.ending && r.state.ending.id === 'reported').length;
const empty = cas.filter((r) => r.state.ending && r.state.ending.id === 'lab_empty').length;
say('   casual 16 局：被举报 ' + rep + ' 局、实验室空 ' + empty + ' 局、诚信最低 ' + Math.min.apply(null, cas.map((r) => r.state.player.integrity)).toFixed(1) + '、结题失败数 ' + cas.map((r) => r.state.counters.projectsFailed).join(','));
const failRep = cas.filter((r) => r.state.ending && r.state.ending.id === 'reported').map((r) => r.seed);
if (failRep.length) say('   被举报种子：' + failRep.join(','));
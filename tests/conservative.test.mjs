/**
 * tests/conservative.test.mjs —— 「保守经营」对照配置（t41，BALANCE §18.18 裁定 ③）
 *
 * 为什么需要它：t40 指出「目前没有任何版本化配置代表『保守但合规』的玩家」——t6 那 5 组次优人类配置
 * 是手改的、没版本号、不可复跑，不能充当尺子。本文件把该配置钉住（spec 逐项断言），同批实测，
 * 并在 0/8 时给出**能指向可修环节**的诊断（不允许直接写「保守打法不可行」）。
 *
 * 配置理由（引用户 SPEC）：亲带与买一作都是玩家正规动作（SPEC 的三条一作来源：亲带 / 抢 / 买），
 * 「保守玩家也会点我亲自带、缺口时买一篇，但绝不抢」正是 SPEC 语义下的保守合规打法；
 * 新增这条尺子不是为了把区间调好看。
 *
 * 运行：node 评院士/tests/conservative.test.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSuite } from './lib/harness.mjs';
import { runGame, STRATEGIES } from '../src/systems/bots.js';
import { rankStatus } from '../src/core/formulas.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sha12 = (p) => createHash('sha256').update(readFileSync(resolve(HERE, p))).digest('hex').slice(0, 12);
const s = createSuite('保守经营对照配置（t41）');

/** 信息性输出（非门禁）：机器人读数只打印、不判失败（t42 用户决策，原因见 balance.test.mjs §0）。 */
const info = (label, detail) => s.note('【信息性·非门禁】' + label + (detail === undefined ? '' : '：' + detail));
const SEEDS = ['t4-01', 't4-02', 't4-03', 't4-04', 't4-05', 't4-06', 't4-07', 't4-08'];
const cfg = STRATEGIES.conservative;
const ledOf = (r) => r.state.projects
  .flatMap((p) => (Array.isArray(p.paperTiers) ? p.paperTiers : []))
  .filter((x) => x && typeof x === 'object' && x.firstAuthorId === 'player').length;
const supplyOf = (r) => r.state.player.papers.q1 + r.state.player.papers.q2 + r.state.player.papers.top;
const won = (r) => Boolean(r.state.ending && r.state.ending.id === 'academician');

/* ── 1 配置本体：spec 逐项钉住，防止被悄悄简化 ── */
{
  const casual = STRATEGIES.casual;
  s.eq(cfg.id, 'conservative', '配置 id = conservative');
  s.eq(cfg.label, '保守经营', '标签 = 保守经营');
  s.eq(cfg.usePlayerLead, true, 'usePlayerLead = true（保守玩家也亲带）');
  s.eq(cfg.leadMinTier, 4, '只对 T4+ 在研项目开亲带（leadMinTier = 4）');
  s.eq(cfg.grabFirstAuthors, false, '不抢一作（不碰诚信红线）');
  s.eq(cfg.buyFirstAuthorMax, 1, '缺口才出手，最多买 1 篇');
  s.eq(JSON.stringify(cfg.buyFirstAuthorTiers), JSON.stringify(['top', 'q1']), '购买档位按缺档 [top, q1]');
  for (const k of ['consumeModePolicy', 'studentsPerProject', 'hardpointMethod', 'keepCrewFloor']) {
    s.eq(cfg[k], casual[k], '与 casual 只差「一作来源」这一变量：' + k + ' 与 casual 相同');
  }
}

/* ── 2 spec 原样读数 + 启动段死锁签名（8 局） ── */
{
  const runs = SEEDS.map((seed) => runGame({ seed, strategy: cfg, months: 400 }));
  const wins = runs.filter(won);
  const led = runs.map(ledOf);
  const maxTier = runs.map((r) => Math.max(0, ...r.state.projects.map((p) => p.tier)));
  const gaps = runs.map((r) => (rankStatus(r.state).missing || []).map((m) => m.key).join('+') || 'ok');
  const supply = runs.map(supplyOf);
  // t42（用户决策）：机器人读数不再作为发布门禁 —— 以下降级为信息性输出；
  // 诊断结论仍可复跑（见下面两条 note），但不再让 run-all 因机器人表现变红。
  info('spec 原样的 conservative 通关', wins.length + '/8（登记在案的缺陷签名：启动段自锁，见下面诊断）');
  info('亲带篇数', led.join(','));
  info('出现过的最高项目等级', maxTier.join(',') + '（≤ T2 时永远触发不了「只亲带 T4+」）');
  info('末局 rank', runs.map((r) => r.state.player.rankIndex).join(','));
  info('rankStatus 缺口', gaps.join(' | '));
  s.note('诊断（BALANCE §18.18 判定顺序第 1 条 · 一作供给链）：T4+ 项目要 rank3（maxProjectTier 随头衔解锁），rank3 要 q1/q2，q1/q2 要亲带，亲带又要 T4+ —— 启动段自锁，与门槛高低、N5/N6 经济性无关。');
  s.note('末局一作供给（q1+q2+top）= ' + supply.join(',') + '，结局 ' + runs.map((r) => (r.state.ending ? r.state.ending.id : 'none')).join(',') + '。');
}

/* ── 3 与 casual 的区分度：三项都应明显落后 ── */
{
  const cas = SEEDS.map((seed) => runGame({ seed, strategy: 'casual', months: 400 }));
  const casWins = cas.filter(won);
  const cons = SEEDS.map((seed) => runGame({ seed, strategy: cfg, months: 400 }));
  const consWins = cons.filter(won);
  const casLed = cas.reduce((n, r) => n + ledOf(r), 0);
  const consLed = cons.reduce((n, r) => n + ledOf(r), 0);
  const casSupply = casWins.reduce((n, r) => n + supplyOf(r), 0);
  const consSupply = cons.reduce((n, r) => n + supplyOf(r), 0);
  const casFin = casWins.reduce((n, r) => n + r.state.counters.projectsFinished, 0);
  const consFin = cons.reduce((n, r) => n + r.state.counters.projectsFinished, 0);
  info('对照通关数（casual vs conservative）', casWins.length + '/8 vs ' + consWins.length + '/8');
  info('区分度①一作来源（亲带篇数）', casLed + ' vs ' + consLed);
  info('区分度①bis 一作供给', casSupply + ' vs ' + consSupply);
  info('区分度②通关局结题数', 'casual ' + casFin + ' 项 / conservative 无通关局');
  info('区分度③当选月', (casWins.map((r) => r.state.ending.monthIndex).join(',') || '—') + ' vs 无');
  s.note('值得注意：conservative 的**总产出反而更高**（8 局合计结题 ' + consFin + ' 项 vs casual 通关 8 局合计 ' + casFin + ' 项）——它活儿没少干、却一篇署名一作都拿不到，于是整局卡在 rank1。这是「产出 ≠ 晋升」的直接证据，也再次说明卡点不在经济性/门槛。');
}

/* ── 4 诊断的可复跑验证：瓶颈在启动段（不是门槛、也不是 N5/N6 经济性） ── */
{
  const boot = { ...cfg, leadMinTier: 0, leadMax: 2 };   // 候选修法：供给为 0 时允许亲带当前最高等级的在研项目
  const runs = SEEDS.slice(0, 4).map((seed) => runGame({ seed, strategy: boot, months: 400 }));
  const wins = runs.filter(won);
  info('候选修法（leadMinTier=0 + leadMax=2）通关', wins.length + '/4，亲带篇 ' + runs.map(ledOf).join(','));
  const t3 = SEEDS.slice(0, 4).map((seed) => runGame({ seed, strategy: { ...cfg, leadMinTier: 3, leadMax: 3 }, months: 400 }));
  info('对照：门槛降到 T3+ 的通关', t3.filter(won).length + '/4（T3 也要 rank2）');
  s.note('诊断结论（可复跑·不作门禁）：修法必须落在『供给为 0 的启动段』，而不是降等级门槛或动 N5/N6 经济性。');
}

/* ── 5 测量纪律：读数与版本一起留档（BALANCE §18.9） ── */
{
  s.note('本次读数对应的版本：bots.js ' + sha12('../src/systems/bots.js') + ' · engine.js ' + sha12('../src/core/engine.js')
    + '（换配置/引擎后读数不可直接比；新旧读数要并列报）');
}

s.finish();
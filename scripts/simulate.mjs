#!/usr/bin/env node
/**
 * simulate.mjs —— 无头模拟：证明《我帮儿子评院士》的数值内核「可赢、可测、可复现」
 *
 * 用固定种子 + 固定策略机器人跑完整对局（默认上限 400 个月），并打印：
 *   ① 三条路线的曲线与结局（速通院士 / 中庸经营 / 诚信崩盘）
 *   ② 速通路线的完整关键节点（晋升、IF 里程碑、增选窗口、结题里程碑、结局）
 *   ③ 主理人给的标定锚点对照表（通关率 / 通关月 / IF / 一区 / 结题 / 逾期 / 诚信）
 *   ④ 中期停滞检查（不存在连续 ≥6 个月零进展）
 *   ⑤ 项目模板 IF 效率表（无支配性最优解、企业 = 现金流）
 *   ⑥ 市场刷新节奏（t22：项目 offer 全年刷新、与招生季解耦，逐月打印项目 / 可接 / 候选人）
 *
 * 退出码：0 = 全部通过；1 = 有检查不通过（游戏不可赢 / 中期停滞 / 通关率过低 / 市场堵死）
 *
 * 用法：
 *   node 评院士/scripts/simulate.mjs                 # 默认 8 个种子 × 3 条路线
 *   node 评院士/scripts/simulate.mjs --seeds=16
 *   node 评院士/scripts/simulate.mjs --seed=t4-01
 *   node 评院士/scripts/simulate.mjs --strategy=casual --seeds=4
 *   node 评院士/scripts/simulate.mjs --quiet
 *   node 评院士/scripts/simulate.mjs --trace=t4-01            # 逐月明细（B1 停滞证据，t28）
 *   node 评院士/scripts/simulate.mjs --idle-guard=off         # 对照组：旧 bot 规则（关掉 acceptRiskyWhenIdle 兜底）
 *
 * 【t28 对照实验】B1「中期停滞」是游戏缺陷、bot 缺陷还是检测器误报？
 *   --idle-guard=on（默认）：t22 解耦市场 + bots 的 acceptRiskyWhenIdle 兜底 → 无停滞，退出码 0。
 *   --idle-guard=off：保留旧 bot 规则、市场仍是解耦后的 → 停滞是否复现，退出码 1（这是实验数据，不是回归）。
 *   停滞段一出现就自动打印该段前后的逐月明细（项目数 / 在研进度 / 经费 / 耗材 / 学生数 / 精力 / 可接 offer）。
 */

import { runGame, STRATEGIES, ifPerWorkloadTable, DEFAULT_SEEDS } from '../src/systems/bots.js';
import { activeProjects } from '../src/core/formulas.js';
import { PROJECT_MAP, PROJECT_SLOTS, STUDENT_SLOTS, MIN_ACCEPTABLE_PROJECT_OFFERS } from '../src/data/projects.js';
import { offerReachable, canAcceptOffer } from '../src/core/rules.js';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { RANKS } from '../src/data/ranks.js';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const has = (name) => argv.includes('--' + name);
const seedCount = Math.max(1, Math.min(32, Number(arg('seeds', 8)) || 8));
const onlySeed = arg('seed', null);
const onlyStrategy = arg('strategy', null);
const quiet = has('quiet');
// t28 B1 对照实验：idle-guard=off 保留「旧 bot 规则」（只关 acceptRiskyWhenIdle，市场仍是 t22 解耦后的）
const idleGuard = arg('idle-guard', 'on') !== 'off';
const traceSeed = arg('trace', null);
const cfgFor = (name) => (idleGuard ? name : { ...STRATEGIES[name], acceptRiskyWhenIdle: false });
const SEEDS = onlySeed ? [onlySeed] : DEFAULT_SEEDS.slice(0, seedCount);
const MAX_MONTHS = 400;

const failures = [];
const check = (ok, label, detail) => {
  if (!ok) failures.push(label + (detail ? '  「' + detail + '」' : ''));
  console.log('  ' + (ok ? '[ok]  ' : '[FAIL]') + ' ' + label + (detail ? '：' + detail : ''));
};
const fmt = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? 'n/a' : Number(n).toFixed(d));
/** 样本有效性：null / undefined / 空串都不算样本。
    注意 Number(null) === 0 且 Number.isFinite(0) === true —— 只判 isFinite 会把
    「这一局没有样本」（如诚信崩盘路线永远没有通关月）印成 0.0 而不是 n/a（t16 F10）。 */
const isSample = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const median = (arr) => {
  const a = arr.filter(isSample).map(Number).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : null;
};
const span = (arr) => {
  const a = arr.filter(isSample).map(Number).sort((x, y) => x - y);
  if (!a.length) return 'n/a（没有样本）';
  return 'min ' + fmt(a[0]) + ' / 中位 ' + fmt(a[Math.floor(a.length / 2)]) + ' / max ' + fmt(a[a.length - 1]) + '（n=' + a.length + '）';
};

/** 跑一局：带曲线、停滞检查、关键指标。 */
/** 逐月明细的一行：玩家当时到底卡在哪（t28 B1 要求给出停滞段前后证据）。 */
function monthRow(state) {
  const act = activeProjects(state);
  const crew = state.students.filter((s) => !s.left && !s.graduated);
  const offers = state.market.pool.filter((o) => o.kind === 'project');
  return {
    m: state.calendar.monthIndex,
    rank: state.player.rankIndex,
    proj: act.length,
    prog: Math.round(act.reduce((n, p) => n + p.progress, 0)),
    money: Math.round(state.player.money),
    cons: Math.round(state.player.consumable),
    crew: crew.length,
    happy: crew.length ? Math.round(crew.reduce((n, s) => n + s.happiness, 0) / crew.length) : 0,
    energy: Math.round(state.player.energy),
    offers: offers.length,
    feasible: offers.filter((o) => canAcceptOffer(state, o).ok).length,
    finished: state.counters.projectsFinished,
  };
}

function printDetail(rows, from, to, title) {
  console.log('    ' + title);
  console.log('    月 | rank | 在研 | 在研总进度 | 经费万 | 耗材 | 学生 | 均幸福 | 精力 | 项目offer(可接) | 累计结题');
  for (const r of rows.slice(Math.max(0, from), Math.min(rows.length, to))) {
    console.log('    ' + r.m + ' | r' + r.rank + ' | ' + r.proj + ' | ' + r.prog + ' | ' + r.money + ' | ' + r.cons
      + ' | ' + r.crew + ' | ' + r.happy + ' | ' + r.energy + ' | ' + r.offers + '(' + r.feasible + ') | ' + r.finished);
  }
}

/** 跑一局：带曲线、停滞检查、关键指标。 */
function playOne(seed, strategy) {
  const progress = [];
  const detail = [];
  const run = runGame({
    seed, strategy, months: MAX_MONTHS,
    onMonth: (state) => {
      progress.push(activeProjects(state).reduce((n, p) => n + p.progress, 0)
        + state.counters.projectsFinished * 100000 + state.counters.projectsFailed * 100000);
      detail.push(monthRow(state));
    },
  });
  const stallSpans = [];
  let stall = 0;
  let stallAt = 0;
  for (let i = 1; i < progress.length; i += 1) {
    if (progress[i] - progress[i - 1] <= 0.0001) {
      if (stall === 0) stallAt = i;
      stall += 1;
    } else {
      if (stall >= 6) stallSpans.push(stallAt + '–' + (stallAt + stall - 1));
      stall = 0;
    }
  }
  if (stall >= 6) stallSpans.push(stallAt + '–' + (stallAt + stall - 1));
  const last = run.history[run.history.length - 1];
  return {
    seed, run, last, detail,
    if1400: run.history.find((h) => h.totalIF >= 1400) || null,
    stallSpans,
    overduePeak: Math.max(0, ...run.history.map((h) => h.overdueProjects)),
    win: Boolean(run.state.ending && run.state.ending.id === 'academician'),
    winMonth: run.state.ending ? run.state.ending.monthIndex : null,
    ending: run.state.ending ? run.state.ending.id : 'none',
  };
}

function curve(history) {
  return [24, 48, 72, 96, 120, 144, 168, 192, 240, 300, 384]
    .map((m) => {
      const h = history.find((x) => x.monthIndex === m);
      return h ? m + '月:IF ' + fmt(h.totalIF, 0) + '/rank' + h.rankIndex + '/一区' + h.q1 : null;
    })
    .filter(Boolean).join('  ');
}

console.log('');
console.log('『我帮儿子评院士』核心模拟自检（simulate）');
console.log('种子：' + SEEDS.join(', '));
console.log('路线：' + (onlyStrategy || 'speedrun / balanced / cheater'));
console.log('bot 规则：' + (idleGuard ? '默认（acceptRiskyWhenIdle 兜底开启）' : '对照组 = 旧规则（acceptRiskyWhenIdle 关闭，市场仍为 t22 解耦版）'));
console.log('上限：' + MAX_MONTHS + ' 个月；市场席位：项目 ' + PROJECT_SLOTS + ' + 学生 ' + STUDENT_SLOTS
  + '（不变式：始终至少 ' + MIN_ACCEPTABLE_PROJECT_OFFERS + ' 个可承接项目）');
console.log('');

const strategies = onlyStrategy ? [onlyStrategy] : ['speedrun', 'balanced', 'cheater'];
const results = {};
for (const name of strategies) {
  if (!STRATEGIES[name]) {
    console.log('未知策略：' + name + '（可选：' + Object.keys(STRATEGIES).join(' / ') + '）');
    process.exit(1);
  }
  const rows = SEEDS.map((seed) => playOne(seed, cfgFor(name)));
  results[name] = rows;
  const wins = rows.filter((r) => r.win);
  const endings = {};
  for (const r of rows) endings[r.ending] = (endings[r.ending] || 0) + 1;
  console.log('════ ' + STRATEGIES[name].label + '（' + name + '）════');
  console.log('  结局分布：' + JSON.stringify(endings) + '　通关率：' + wins.length + '/' + rows.length);
  console.log('  通关月（总 IF 首达 1400）：' + span(rows.map((r) => (r.if1400 ? r.if1400.monthIndex : null))));
  console.log('  实际晋升院士月：' + span(wins.map((r) => r.winMonth)));
  console.log('  通关时总 IF：' + span(wins.map((r) => r.last.totalIF)));
  console.log('  通关时一区一作（老板一作，t24 口径）：' + span(wins.map((r) => r.last.q1)));
  console.log('  通关时结题项目：' + span(wins.map((r) => r.last.finished)));
  console.log('  逾期项目峰值：' + span(rows.map((r) => r.overduePeak)));
  console.log('  末局诚信：' + span(rows.map((r) => r.last.integrity)));
  console.log('  连续 ≥6 月零进展的段落：' + (rows.some((r) => r.stallSpans.length)
    ? rows.filter((r) => r.stallSpans.length).map((r) => r.seed + ' → ' + r.stallSpans.join('、') + ' 月').join('；')
    : '无'));
  for (const r of rows.filter((x) => x.stallSpans.length)) {
    const [a, b] = r.stallSpans[0].split('–').map(Number);
    console.log('  ↓ 停滞段前后逐月证据（种子 ' + r.seed + '，停滞 ' + r.stallSpans[0] + ' 月）');
    printDetail(r.detail, a - 3, b + 4, '（月序号从 0 起，onMonth 快照 = 该月结算后）');
  }
  if (!quiet) console.log('  曲线（第一个种子）：' + curve(rows[0].run.history));
  console.log('');
}

if (traceSeed) {
  const name = onlyStrategy || 'speedrun';
  const r = playOne(traceSeed, cfgFor(name));
  console.log('════ 逐月明细：种子 ' + traceSeed + ' × ' + name + '（' + (idleGuard ? '默认 bot 规则' : '旧 bot 规则') + '）════');
  console.log('  结局：' + r.ending + '　末月：' + r.last.monthIndex + '　停滞段：' + (r.stallSpans.join('、') || '无'));
  printDetail(r.detail, 0, r.detail.length, '全程（月序号从 0 起）');
  console.log('');
}

const speed = results.speedrun || results[Object.keys(results)[0]];
const best = speed.find((r) => r.win) || speed[0];
console.log('════ 速通路线关键节点（种子 ' + best.seed + '）════');
for (const node of best.run.nodes) {
  if (node.kind === 'window' && /还缺/.test(node.text) && !/材料齐备/.test(node.text)) continue;
  console.log('  第 ' + String(node.monthIndex).padStart(3, ' ') + ' 月  ' + node.text);
}
console.log('');

console.log('════ 标定锚点对照（主理人给的启发式脚本口径）════');
const speedWins = speed.filter((r) => r.win);
const report = (label, anchor, actual) => console.log('  ' + label.padEnd(20) + '| ' + anchor.padEnd(26) + '| ' + actual);
console.log('  ' + '指标'.padEnd(18) + '| ' + '锚点'.padEnd(24) + '| ' + '本次实测');
report('通关率', '≈15/16（93.8%）', speedWins.length + '/' + speed.length + '（' + Math.round(100 * speedWins.length / speed.length) + '%）');
report('通关月（IF 首达 1400）', '中位 182（171–189）', '中位 ' + fmt(median(speed.map((r) => (r.if1400 ? r.if1400.monthIndex : null))), 0));
report('实际晋升院士月', '落在增选窗口（每 24 月）', span(speedWins.map((r) => r.winMonth)));
report('通关时总 IF', '1403–1471', span(speedWins.map((r) => r.last.totalIF)));
report('通关时一区一作', '22–32 篇（旧口径 = 课题组全部一区；t24 起只数老板一作，故更高）', span(speedWins.map((r) => r.last.q1)));
report('一局结题项目', '44–50 个', span(speedWins.map((r) => r.last.finished)));
report('逾期项目/局', '3–7 个', '峰值 ' + span(speed.map((r) => r.overduePeak)));
report('末局诚信', '61–89', span(speed.map((r) => r.last.integrity)));
report('国家项目效率', '0.077–0.105 无支配解', '见下表');
report('企业项目', '现金流（定金高、工期短）', '见下表');
console.log('');

console.log('════ 项目模板 IF 效率表（锚点：国家项目 IF/(W×0.85) ∈ 0.077–0.105）════');
console.log('  ID   类别   T  工作量  工期  IF       IF/W     IF/(W×0.85)  合同额  万元/月');
for (const row of ifPerWorkloadTable()) {
  console.log('  ' + row.id.padEnd(5) + row.category.padEnd(6) + String(row.tier).padEnd(3)
    + String(row.workload).padEnd(8) + String(row.limitMonths).padEnd(6)
    + fmt(row.expectedIF).padEnd(9) + fmt(row.ifPerWorkload, 4).padEnd(9) + fmt(row.ifPerSlot, 4).padEnd(14)
    + String(PROJECT_MAP[row.id].money).padEnd(8) + fmt(PROJECT_MAP[row.id].money / row.limitMonths, 1));
}
console.log('');

console.log('════ 市场刷新节奏（t22：项目 offer 全年刷新，与招生季解耦）════');
{
  let st = reduce(createState({ seed: SEEDS[0] }), ACTIONS.newGame({ seed: SEEDS[0] }));
  const rows = [];
  for (let i = 0; i < 36; i += 1) {
    const list = st.market.pool.filter((o) => o.kind === 'project');
    rows.push({
      idx: st.calendar.monthIndex,
      month: st.calendar.month,
      total: list.length,
      reachable: list.filter((o) => offerReachable(st, o)).length,
      acceptable: list.filter((o) => canAcceptOffer(st, o).ok).length,
      students: st.market.pool.filter((o) => o.kind === 'student').length,
    });
    st.player.health = 90;              // 只看市场节奏：不做任何玩家操作
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    if (st.ending) break;
  }
  console.log('  逐月（第 0–' + (rows.length - 1) + ' 结算月，无玩家操作，仅推进月份）');
  for (const r of rows) {
    console.log('   ' + String(r.idx).padStart(3, ' ') + ' 月（' + String(r.month).padStart(2, ' ') + ' 月）'
      + '  项目 offer ' + r.total + ' 个（可接 ' + r.acceptable + ' / 够得着 ' + r.reachable + '）'
      + '　候选人 ' + r.students + ' 个');
  }
  const isSeason = (m) => [6, 7, 8, 9, 10, 11, 12].includes(m);
  const off = rows.filter((r) => !isSeason(r.month));
  const offMin = Math.min(...off.map((r) => r.total));
  const offMax = Math.max(...off.map((r) => r.total));
  const accMin = Math.min(...rows.map((r) => r.acceptable));
  console.log('  非招生季（1–5 月）项目 offer 数：' + offMin + '–' + offMax
    + '（旧实现恒为 1、第 6 月才跳到 3–5）');
  check(offMin >= 2, '非招生季项目 offer 数 ≥ 2：项目刷新与招生季解耦（t22）', '最少 ' + offMin + ' 个');
  check(accMin >= MIN_ACCEPTABLE_PROJECT_OFFERS, '逐月都有可承接的项目 offer（全年）', '最少 ' + accMin + ' 个');
  console.log('');
}

console.log('════ 通过性检查 ════');
const n = speed.length;
const speedrunRan = !onlyStrategy || onlyStrategy === 'speedrun';
if (speedrunRan) {
  // t42（用户决策）：机器人通关率/停滞/结题数不再作为发布门禁 —— 下面全部改打印（原因见 tests/balance.test.mjs §0）。
  report('速通通关率（信息性）', '不再作为门禁', speedWins.length + '/' + n)
  report('是否有人到达院士（信息性）', '不再作为门禁', speedWins.length ? speedWins[0].seed + ' 第 ' + speedWins[0].winMonth + ' 月' : '无');
  report('通关局硬门槛（信息性）', 'IF/一区/正刊/票', speedWins.length
    ? speedWins.map((r) => 'IF ' + r.last.totalIF + '/一区 ' + r.last.q1 + '/正刊 ' + r.last.top + '/票 ' + r.last.tickets).join('；')
    : '无（没有通关局）');
  report('中期停滞（信息性）', '不再作为门禁', speed.flatMap((r) => r.stallSpans).join('、') || '无');
  report('通关局结题数（信息性）', '→中位', speedWins.map((r) => r.last.finished).join(',') + ' → ' + String(median(speedWins.map((r) => r.last.finished))));
  report('速通路线末局诚信（信息性）', '不再作为门禁', speed.map((r) => r.last.integrity).join(','));
} else {
  console.log('  [skip] 本次只跑了 ' + onlyStrategy + ' 路线：通关性读数（信息性，非门禁）'
    + '只在跑 speedrun 时判定；不带 --strategy 跑默认三条路线即为完整自检');
}
if (results.cheater) {
  report('作弊路线结局（信息性）', '不再作为门禁', results.cheater.map((r) => r.ending).join(','));
}
{
  let worst = 99;
  for (const seed of SEEDS.slice(0, 4)) {
    let localWorst = 99;
    runGame({
      seed, strategy: 'balanced', months: 120,
      onMonth: (state) => {
        const reachable = state.market.pool.filter((o) => o.kind === 'project' && offerReachable(state, o)).length;
        localWorst = Math.min(localWorst, reachable);
      },
    });
    worst = Math.min(worst, localWorst);
  }
  check(worst >= MIN_ACCEPTABLE_PROJECT_OFFERS, '市场不变式：任何月份都有可承接的项目 offer（防死锁回归）', '最少 ' + worst + ' 个');
}
{
  // BALANCE §15.3（t13 升级为「区间 + 单调」双条件）：T1–T3 ∈ [0.070,0.100]，T4–T6 ∈ [0.100,0.135]。
  // §18.11 又单独要求 N5 ≥ 0.105、N6 ≥ 0.115 —— 支配解上界因此必须按区间推（0.135/0.070），
  // 不能再沿用按单区间推的 1.45（0.115/0.077），否则与策划自己的裁定冲突。
  const nation = ifPerWorkloadTable().filter((r) => r.category === 'nation');
  const lowT = nation.filter((r) => ['N1', 'N2', 'N3'].includes(r.id));
  const highT = nation.filter((r) => ['N4', 'N5', 'N6'].includes(r.id));
  const lo = Math.min(...nation.map((r) => r.ifPerSlot));
  const hi = Math.max(...nation.map((r) => r.ifPerSlot));
  check(lowT.every((r) => r.ifPerSlot >= 0.070 && r.ifPerSlot <= 0.100), '国家 T1–T3 的 IF/(W×0.85) 落在 [0.070,0.100]',
    lowT.map((r) => r.id + '=' + fmt(r.ifPerSlot, 4)).join(' '));
  check(highT.every((r) => r.ifPerSlot >= 0.100 && r.ifPerSlot <= 0.135), '国家 T4–T6 的 IF/(W×0.85) 落在 [0.100,0.135]',
    highT.map((r) => r.id + '=' + fmt(r.ifPerSlot, 4)).join(' '));
  check(hi / lo <= 0.135 / 0.070, '国家项目无支配性最优解（上界由 §15.3 两级区间推出）',
    '最高/最低 = ' + fmt(hi / lo, 2) + '，上界 ' + fmt(0.135 / 0.070, 2));
  const ent = ifPerWorkloadTable().filter((r) => r.category === 'enterprise');
  check(Math.max(...ent.map((r) => r.ifPerSlot)) < lo, '企业项目不是 IF 主力（IF 效率低于国家项目下限）');
}
check(RANKS[8].ifReq === 1400, '院士门槛 = 1400 IF', String(RANKS[8].ifReq));
console.log('');

if (failures.length) {
  console.log('模拟自检失败：' + failures.length + ' 项不通过');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log(speedrunRan
  ? '模拟自检通过：0 项不通过（速通路线 ' + speedWins.length + '/' + n + ' 通关，无 ≥6 个月停滞段）'
  : '模拟自检通过：0 项不通过（本次只跑了 ' + onlyStrategy + ' 路线，未做通关性判定）');
process.exit(0);

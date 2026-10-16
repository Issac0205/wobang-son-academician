/**
 * tests/save.test.mjs —— 存档/读档（t16 F1）
 *
 * 为什么要有这个文件：t7 的 review 发现 validateState 的白名单漏了 12 个字段
 * （player.monthActions / month.* / flags.negativeMoneyMonths / stats.peak / lastReceipt ...），
 * 其中 negativeMoneyMonths 漏掉 = 漏洞：经费为负第 5 个月存读档即可规避「课题组解散」结局。
 * 之前 tests/ 里没有任何存档测试，所以这个 bug 活了很久。
 *
 * 断言三件事：
 *   ① 往返一致：serialize → hydrate 后逐字段等于原 state；
 *   ② 继续跑一致：hydrate 出来的存档再跑 N 个月，与不读档直接跑 N 个月逐字段一致
 *      （这条比 ① 强：能抓住「读档后 rng/月度计数/队列丢失」造成的分叉）；
 *   ③ 兜底：篡改、缺字段、超范围、版本过高、缺 localStorage 都不许抛异常、不许读进非法值。
 *
 * 运行：node 评院士/tests/save.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { serialize, hydrate, validateState, saveGame, loadGame, hasSave, clearSave, STATE_VERSION, SAVE_VERSION } from '../src/core/save.js';
import { STRATEGIES, botTurn } from '../src/systems/bots.js';
import { BANKRUPT_NEGATIVE_MONTHS, SAVE_SLOT_KEY } from '../src/data/tuning.js';
import { isBankrupt } from '../src/core/rules.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('存档 / 读档');

/** 用策略机器人推进 n 个月（自动处理延毕待决弹层）。 */
function playMonths(state, n) {
  let st = state;
  for (let i = 0; i < n; i += 1) {
    if (st.ending) break;
    st = botTurn(st, STRATEGIES.balanced);
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  }
  return st;
}

/* ── 0 版本字段 ── */
  s.eq(STATE_VERSION, 2, 'StateVersion 存在且为 2（t24 一作归属模型把口径 +1）');
s.eq(SAVE_VERSION, STATE_VERSION, 'save.js 的 SAVE_VERSION 跟随 STATE_VERSION');
s.eq(typeof STATE_VERSION, 'number', 'save.js 再导出 STATE_VERSION（契约 §3.5）');

/* ── 1 往返一致（用一局「跑过 24 个月」的富状态，覆盖回执/月度计数/flags/峰值） ── */
const played = playMonths(freshGame(mods, 'save-roundtrip'), 24);
{
  const reloaded = hydrate(serialize(played));
  s.ok(reloaded !== null, 'serialize → hydrate 能还原', reloaded ? 'ok' : 'null');
  const a = canon(played);
  const b = canon(reloaded);
  s.ok(a === b, '往返后逐字段一致（规范化 JSON 全等：键序无关，字段名与值全等）',
    a === b ? 'len ' + a.length : 'diff at ' + firstDiff(a, b));
  s.eq(reloaded.calendar.monthIndex, played.calendar.monthIndex, '日历一致');
  s.eq(reloaded.player.monthActions.talk, played.player.monthActions.talk, 'player.monthActions 一致');
  s.eq(reloaded.player.monthEnergySpent, played.player.monthEnergySpent, 'player.monthEnergySpent 一致');
  s.eq(reloaded.month.fakesThisMonth, played.month.fakesThisMonth, 'month.fakesThisMonth 一致');
  s.eq(canon(reloaded.stats.peak), canon(played.stats.peak), 'stats.peak 一致');
  s.eq(Object.keys(reloaded.stats.lastReceipt).length, Object.keys(played.stats.lastReceipt).length,
    'lastReceipt 字段数与存档一致（' + Object.keys(played.stats.lastReceipt).length + ' 个）');
  s.eq(reloaded.rng.seed, played.rng.seed, 'rng 快照一致');
}
/** 规范化序列化：对象键排序（键序不是「字段差异」，但 JSON.stringify 会当成差异）。 */
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) return a.slice(Math.max(0, i - 60), i + 60);
  return 'length ' + a.length + ' vs ' + b.length;
}

/* ── 2 读档后继续跑 24 个月 = 不读档直接跑 24 个月（逐字段一致） ── */
{
  const base = playMonths(freshGame(mods, 'save-continue'), 12);
  const viaSave = playMonths(hydrate(serialize(base)), 24);
  const direct = playMonths(base, 24);
  const a = canon(viaSave);
  const b = canon(direct);
  s.ok(a === b, '读档后继续 24 月与不读档逐字段一致', a === b ? 'ok（' + viaSave.calendar.monthIndex + ' 月）' : 'diff at ' + firstDiff(a, b));
  s.eq(viaSave.player.totalIF, direct.player.totalIF, '两条路径的总 IF 一致');
  s.eq(viaSave.students.length, direct.students.length, '两条路径的学生数一致');
  s.eq(viaSave.counters.fakesTotal, direct.counters.fakesTotal, '两条路径的计数器一致');
}

/* ── 3 F1 漏洞回归：经费为负的连续月数必须跨存档存活 ── */
{
  const st = freshGame(mods, 'save-bankrupt');
  st.player.money = -50;
  st.flags.negativeMoneyMonths = BANKRUPT_NEGATIVE_MONTHS - 1;
  const back = hydrate(serialize(st));
  s.eq(back.flags.negativeMoneyMonths, BANKRUPT_NEGATIVE_MONTHS - 1,
    'flags.negativeMoneyMonths 跨存档存活（否则存读档即可规避解散）');
  s.ok(isBankrupt(back) === false, '还差一个月不算破产');
  const next = reduce(back, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(isBankrupt(next), '读档后再欠一个月即触发破产判定（第 ' + BANKRUPT_NEGATIVE_MONTHS + ' 个月）',
    String(next.flags.negativeMoneyMonths));
  void st;
}

/* ── 4 energyMaxDelta：真实范围 ±50，超范围夹紧 ── */
{
  const st = freshGame(mods, 'save-energy');
  st.player.energyMaxDelta = 40;
  s.eq(hydrate(serialize(st)).player.energyMaxDelta, 40, '±50 以内的 energyMaxDelta 原样保留（旧的 ±10 会截断）');
  st.player.energyMaxDelta = 999;
  s.eq(hydrate(serialize(st)).player.energyMaxDelta, 50, '超范围夹到 50');
  st.player.energyMaxDelta = -999;
  s.eq(hydrate(serialize(st)).player.energyMaxDelta, -50, '超范围夹到 -50');
}

/* ── 5 篡改 / 缺字段 / 脏类型兜底 ── */
{
  s.eq(hydrate(null), null, 'hydrate(null) → null');
  s.eq(hydrate('这不是存档'), null, 'hydrate(字符串) → null');
  s.eq(hydrate({ version: STATE_VERSION + 5, state: {} }), null, '版本高于当前 → null（拒绝读未来存档）');
  const dirty = validateState({
    player: { money: Number.NaN, health: 'abc', integrity: 999, rankIndex: 99, totalIF: -5, consumeMode: 'wild' },
    calendar: { monthIndex: 'x', year: -3, month: 88 },
    students: [{ id: 's1', ability: 5, happiness: -20 }, { bad: true }, null],
    counters: { fakesTotal: 'many' },
    flags: { negativeMoneyMonths: 'lots' },
    stats: { peak: { totalIF: 'x' } },
    chronicle: [{ text: 123 }],
  });
  s.ok(dirty !== null, '脏存档能兜底成合法 state');
  s.eq(dirty.player.health, 80, 'health 非法 → 默认值');
  s.eq(dirty.player.integrity, 100, 'integrity 超范围 → 夹到 100');
  s.eq(dirty.player.rankIndex, 8, 'rankIndex 超范围 → 夹到 8');
  s.eq(dirty.calendar.monthIndex, 0, 'calendar.monthIndex 非法 → 0');
  s.ok(dirty.students.length === 1 && dirty.students[0].ability <= 0.95, '学生数组过滤脏项并夹紧能力值',
    JSON.stringify(dirty.students.map((x) => x.ability)));
  s.eq(dirty.counters.fakesTotal, 0, '计数器非法 → 0');
  s.eq(dirty.flags.negativeMoneyMonths, 0, 'flag 非法 → 0（不是 NaN）');
  s.ok(Number.isFinite(dirty.stats.peak.totalIF), 'stats.peak 非法 → 有限数', String(dirty.stats.peak.totalIF));
  const bare = validateState({});
  s.ok(bare && bare.calendar.year === 1 && bare.player.rankIndex === 1, '空对象 → 一局全新 state');
}

/* ── 6 存储层：saveGame / loadGame / hasSave / clearSave（无 localStorage 时降级为内存） ── */
{
  const mem = (() => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  })();
  const st = playMonths(freshGame(mods, 'save-storage'), 6);
  saveGame(st, mem);
  s.ok(hasSave(mem), 'saveGame 后 hasSave 为真');
  const back = loadGame(mem);
  s.ok(back !== null && back.calendar.monthIndex === st.calendar.monthIndex, 'loadGame 读回同一进度',
    back ? String(back.calendar.monthIndex) : 'null');
  s.ok(String(mem.getItem(SAVE_SLOT_KEY)).includes('"version"'), '存档里带 version 字段');
  clearSave(mem);
  s.eq(hasSave(mem), false, 'clearSave 后 hasSave 为假');
  s.eq(loadGame(mem), null, '无存档时 loadGame → null');
  // 无 storage 参数时走模块内内存降级（无头环境不能炸）
  s.eq(typeof loadGame(), 'object', '不传 storage 时不抛异常（无头内存降级）');
}

/* ── 7 存档口径迁移（t24：STATE_VERSION 1 → 2，player.papers 语义改变） ──
   v1 的 player.papers 是「课题组全部产出」，v2 起只数「老板是一作」。旧档无法逐篇反推署名，
   但可以按可核验台账重算：老板真正拿到的一作只有买/抢（每篇在 papersFirst 里恰好记一次）。 */
{
  s.eq(STATE_VERSION, 2, 'STATE_VERSION 随一作归属模型 +1（1 → 2）');
  const legacy = freshGame(mods, 'save-v1');
  legacy.player.papers = { top: 0, q1: 9, q2: 24, q3: 10, q4: 3 };   // v1 口径：全部产出
  legacy.player.papersFirst = { top: 1, q1: 2, q2: 0, q3: 0, q4: 0 };  // 买/抢来的一作
  legacy.player.totalIF = 777;
  const back = hydrate({ version: 1, savedAt: 1, state: legacy });
  s.ok(back !== null, 'v1 存档仍能读进来（迁移链 1 → 2）');
  s.eq(back.version, 2, '迁移后版本号 = 当前 STATE_VERSION');
  s.eq(back.player.papers.q1, 2, 'v1→v2：一区一作按可核验台账重算（本档只有买来的 2 篇）');
  s.eq(back.player.papers.top, 1, 'v1→v2：正刊一作同样是买来的那 1 篇');
  s.eq(back.player.papers.q2, 0, 'v1→v2：学生一作的 24 篇二区不再计入老板一作');
  s.eq(back.player.totalIF, 777, 'totalIF 口径从未变过，迁移不动它');
  s.note('v1→v2 迁移示例：papers{q1 9,q2 24} + papersFirst{q1 2,top 1} → papers{q1 2,q2 0,top 1}，totalIF 777 不变');
}

s.finish();

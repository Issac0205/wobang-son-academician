/**
 * tests/rare-talent.test.mjs —— v1.4.0 稀有人才彩蛋（规格 5 条断言）
 *
 * 规格（主理人与用户确认的 SPEC）：
 *   · 保研池（POOL_TRANSLATE_MONTHS 6–10 月）刘垚/路遥/林孝义/罗傲；考研池（POOL_EXAM_MONTHS 10–12 月）杨博宁/王雪茹/张慧云/叶展宏；
 *   · 每人每次该池刷新时各 5% 概率出现（RARE_SPAWN_RATE，按人独立判定）；
 *   · 招走即本局永不再现（state.market.rareHired）；
 *   · 天赋 120%（ABILITY_MAX_RARE = 1.2），普通学生上限仍是 ABILITY_MAX（0.95）；
 *   · 随机拼名必须避开这 8 个名字。
 *
 * 断言纪律（check.mjs #12）：这里不写「越差越绿」的反向区间，也不拿被测数据反推阈值。
 * 「必出现 / 必不出现」用的是**固定种子**：本文件里的 rare-probe-N 种子由一次性脚本穷举
 * 'rare-probe-1' … 'rare-probe-1000'（第 6 月 / 第 11 月各跑一遍 advanceMonth）挑出来的，
 * 挑完就写死在这里；每断言都附带「同种子重跑结果一致」的复现性检查，不靠运气。
 *
 * 运行：node 评院士/tests/rare-talent.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { selectMarket, selectStudentRow } from '../src/core/selectors.js';
import { hydrate, serialize } from '../src/core/save.js';
import { generateName } from '../src/core/naming.js';
import { createRng } from '../src/core/rng.js';
import { wageCost } from '../src/core/formulas.js';
import { runGame } from '../src/systems/bots.js';
import { RARE_TALENTS, RARE_SPAWN_RATE, ABILITY_MAX, ABILITY_MAX_RARE } from '../src/data/students.js';
import { POOL_CAP, POOL_TRANSLATE_MONTHS, POOL_EXAM_MONTHS } from '../src/data/market.js';
import { STUDENT_SLOTS } from '../src/data/projects.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('稀有人才彩蛋（v1.4.0）');

const RARE_NAMES = RARE_TALENTS.map((t) => t.name);
const TRANSLATE_NAMES = RARE_TALENTS.filter((t) => t.pool === 'translate').map((t) => t.name);
const EXAM_NAMES = RARE_TALENTS.filter((t) => t.pool === 'exam').map((t) => t.name);

/** 固定种子（穷举挑出，见文件头）：保研池第 6 月 / 考研池第 11 月必出现的种子。 */
const MUST_APPEAR = {
  刘垚: { seed: 'rare-probe-1', month: 6 },
  路遥: { seed: 'rare-probe-16', month: 6 },
  林孝义: { seed: 'rare-probe-7', month: 6 },
  罗傲: { seed: 'rare-probe-13', month: 6 },
  杨博宁: { seed: 'rare-probe-26', month: 11 },
  王雪茹: { seed: 'rare-probe-20', month: 11 },
  张慧云: { seed: 'rare-probe-6', month: 11 },
  叶展宏: { seed: 'rare-probe-29', month: 11 },
};
/** 必不出现的种子：第 6 月与第 11 月各推进一次都一个人都没有（5% ≠ 必出）。 */
const NEVER_SEED = 'rare-probe-2';

/** 把新局挪到指定月份（month 与 monthIndex 成对设置，避免日历自相矛盾）。 */
function gameAt(seed, month) {
  const st = JSON.parse(JSON.stringify(freshGame(mods, seed)));
  st.calendar.monthIndex = month - 1;
  st.calendar.month = month;
  st.calendar.year = 1;
  return st;
}
function advance(st) { return reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true })); }
function rares(st) { return st.market.pool.filter((o) => o.kind === 'student' && o.rare === true); }
function namesOf(st) { return rares(st).map((o) => o.name).sort().join(','); }

/* ── 0 数据口径自检（规格里的池归属） ── */
s.eq(RARE_NAMES.length, 8, '一共 8 位稀有人才');
s.eq(TRANSLATE_NAMES, ['刘垚', '路遥', '林孝义', '罗傲'], '保研池 4 人：刘垚/路遥/林孝义/罗傲');
s.eq(EXAM_NAMES, ['杨博宁', '王雪茹', '张慧云', '叶展宏'], '考研池 4 人：杨博宁/王雪茹/张慧云/叶展宏');
s.eq(RARE_SPAWN_RATE, 0.05, '露面概率 = 5%');
s.eq(ABILITY_MAX_RARE, 1.2, '稀有人才天赋上限 = 1.2（120%）');
s.ok(POOL_TRANSLATE_MONTHS.indexOf(6) >= 0 && POOL_EXAM_MONTHS.indexOf(11) >= 0, '第 6 月属保研窗口、第 11 月属考研窗口（与 data/market.js 一致）');

/* ── 1 固定种子「必出现」× 8 人：天赋 120%、池归属正确、结果可复现 ── */
for (const [name, cfg] of Object.entries(MUST_APPEAR)) {
  const after = advance(gameAt(cfg.seed, cfg.month));
  const hit = rares(after).filter((o) => o.name === name);
  s.eq(hit.length, 1, '固定种子 ' + cfg.seed + ' · 第 ' + cfg.month + ' 月：' + name + ' 必出现');
  if (hit.length === 1) {
    s.eq(hit[0].ability, ABILITY_MAX_RARE, name + ' 的 offer 天赋 = 120%');
    s.eq(hit[0].rare, true, name + ' 的 offer 带 rare 标记（UI 才认得出）');
    s.eq(hit[0].source, cfg.month === 6 ? 'translate' : 'exam', name + ' 的池归属 = ' + (cfg.month === 6 ? '保研' : '考研'));
    s.ok(Number.isFinite(hit[0].cost) && hit[0].cost > 0, name + ' 的招募成本是有限正数（1.2 不产生 NaN）', String(hit[0].cost));
    s.ok(Number.isFinite(hit[0].reqIF) && hit[0].reqIF >= 0, name + ' 的组内 IF 门槛是有限非负数（1.2 不溢出）', String(hit[0].reqIF));
    const vm = selectMarket(after).students.filter((o) => o.name === name)[0];
    s.eq(vm ? vm.abilityPct : null, 120, '人才市场 VM 里 ' + name + ' 的天赋显示为 120%');
    s.eq(vm ? vm.rare : null, true, '人才市场 VM 里 ' + name + ' 带 rare（卡片才挂 ★ 稀有人才）');
    s.eq(vm && vm.expectedWage ? vm.expectedWage.tier : null, 'high', name + ' 的工资期望落在最高档（1.2 → high，不越界）');
  }
  // 可复现：同种子同月份重跑，名单必须逐字一致
  const again = namesOf(advance(gameAt(cfg.seed, cfg.month)));
  s.eq(again, namesOf(after), '同一种子重跑：' + cfg.seed + ' 的出现名单一致（可复现，不靠运气）');
}

/* ── 2 固定种子「必不出现」+ 池隔离（第 6 月不会出考研池的人，反之亦然） ── */
{
  for (const month of [6, 11]) {
    s.eq(rares(advance(gameAt(NEVER_SEED, month))).length, 0,
      '固定种子 ' + NEVER_SEED + ' · 第 ' + month + ' 月：一个人都不出现（5% 不是「必出」）');
  }
  const m6 = advance(gameAt('rare-probe-1', 6));
  s.eq(m6.market.pool.filter((o) => o.rare === true && EXAM_NAMES.indexOf(o.name) >= 0).length, 0, '第 6 月不会冒出考研池的稀有人才');
  const m11 = advance(gameAt('rare-probe-2', 11));
  void m11;
  const m11b = advance(gameAt('rare-probe-26', 11));
  s.eq(m11b.market.pool.filter((o) => o.rare === true && TRANSLATE_NAMES.indexOf(o.name) >= 0).length, 0, '第 11 月不会冒出保研池的稀有人才');
  // 10 月同时属于两张月份表：两组都会掷点（不崩、不越界）
  const m10 = advance(gameAt('rare-probe-7', 10));
  s.ok(m10.market.pool.every((o) => o.kind !== 'student' || o.rare !== true || Number.isFinite(o.ability)),
    '第 10 月（两池交汇月）掷点正常，offer 数值有限');
}

/* ── 3 招走即本局永不再现 + 按人独立判定 ── */
{
  let st = advance(gameAt(MUST_APPEAR['刘垚'].seed, 6));
  const offer = rares(st).filter((o) => o.name === '刘垚')[0];
  s.ok(Boolean(offer), '前置：固定种子下 刘垚 已经挂在市场上');
  if (offer) {
    st = { ...st, player: { ...st.player, money: 9999, totalIF: 99999, rankIndex: 8 } };
    const hired = reduce(st, ACTIONS.hireStudent({ offerId: offer.offerId }));
    const stu = hired.students.filter((x) => x.name === '刘垚')[0];
    s.ok(Boolean(stu), '稀有人才能通过真实 game/hireStudent 招进来');
    s.eq(stu ? stu.ability : null, ABILITY_MAX_RARE, '招进来之后天赋仍是 120%（createStudent 没把他夹回 95%）');
    s.eq(stu ? stu.rare : null, true, '学生对象保留了 rare 标记（读档后仍显示 ★）');
    s.eq(selectStudentRow(hired, stu || { projectIds: [] }).abilityPct, 120, '课题组卡片显示「科研能力 120%」（UI 直接取这个字段）');
    s.eq(hired.market.rareHired, ['刘垚'], '招走后名字写进 state.market.rareHired');
    s.eq(hired.market.pool.some((o) => o.name === '刘垚'), false, '招走后该候选人从市场撤下');
  }

  // 逐个（8 人）：走真实招募路径 → 招募后仍是 120% + 写进 rareHired + 下个月同类刷新不再出现
  for (const [name, cfg] of Object.entries(MUST_APPEAR)) {
    let st0 = advance(gameAt(cfg.seed, cfg.month));
    const one = rares(st0).filter((o) => o.name === name)[0];
    st0 = { ...st0, player: { ...st0.player, money: 9999, totalIF: 99999, rankIndex: 8 } };
    const hiredOne = one ? reduce(st0, ACTIONS.hireStudent({ offerId: one.offerId })) : st0;
    const recruit = hiredOne.students.filter((x) => x.name === name)[0];
    s.eq(recruit ? recruit.ability : null, ABILITY_MAX_RARE, name + ' 走真实招募路径后仍是 120%');
    s.eq(hiredOne.market.rareHired, [name], name + ' 被招走后写进 market.rareHired（只锁本人）');
    const nextMonth = advance(hiredOne);   // 第 6 → 7 月仍属保研池；第 11 → 12 月仍属考研池
    s.eq(rares(nextMonth).some((o) => o.name === name), false, name + ' 被招走后下个月同类刷新不再出现');
  }

  // 已招走的人：60 个固定种子 × 第 6 月，一次都不能再出现
  let reappeared = 0;
  for (let i = 1; i <= 60; i += 1) {
    const st2 = gameAt('rare-hired-' + i, 6);
    st2.market.rareHired = ['刘垚'];
    if (rares(advance(st2)).some((o) => o.name === '刘垚')) reappeared += 1;
  }
  s.eq(reappeared, 0, '本局招走过的人，之后 60 个种子 × 第 6 月都不再出现（永不再现）');

  // 独立性：把 刘垚 标成已招走，另外三人这次中不中签必须逐个一致
  let mismatch = 0;
  let othersSeen = 0;
  for (let i = 1; i <= 60; i += 1) {
    const seed = 'rare-hired-' + i;
    const plain = namesOf(advance(gameAt(seed, 6)));
    const st3 = gameAt(seed, 6);
    st3.market.rareHired = ['刘垚'];
    const after = namesOf(advance(st3));
    const expect = plain.split(',').filter((n) => n && n !== '刘垚').sort().join(',');
    if (after !== expect) mismatch += 1;
    if (after) othersSeen += 1;
  }
  s.eq(mismatch, 0, '招走 刘垚 不改变另外三人这次中不中签（按人独立判定）');
  s.ok(othersSeen >= 1, '招走一个人之后，剩下的人照常出现（不是一票否决全池）', othersSeen + '/60 次有其他人出现');
}

/* ── 4 普通路径仍被夹在 95%（不得为了彩蛋放宽普通学生生成） ── */
{
  let st = freshGame(mods, 'rare-normal-cap');
  let checked = 0;
  let over = 0;
  let maxAbility = 0;
  for (let i = 0; i < 200; i += 1) {
    st.player.health = 90;
    for (const o of st.market.pool) {
      if (o.kind !== 'student' || o.rare === true) continue;
      checked += 1;
      maxAbility = Math.max(maxAbility, o.ability);
      if (o.ability > ABILITY_MAX) over += 1;
    }
    st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    if (st.ending) break;
  }
  s.ok(checked > 0, '前提：这 200 个月里确实生成过普通候选人', String(checked));
  s.eq(over, 0, '普通候选人从未超过 ABILITY_MAX（95%）', checked + ' 个样本，最高 ' + maxAbility);
}

/* ── 5 市场容量不变式：彩蛋用「替位」不用「加位」 ── */
{
  let overCap = 0;
  let overStudent = 0;
  let rareMonths = 0;
  let months = 0;
  for (const seed of ['rare-run-1', 'rare-run-2', 'rare-run-3']) {
    let st = freshGame(mods, seed);
    for (let i = 0; i < 120; i += 1) {
      if (st.market.pool.length > POOL_CAP) overCap += 1;
      if (st.market.pool.filter((o) => o.kind === 'student' && !o.locked).length > STUDENT_SLOTS) overStudent += 1;
      if (rares(st).length > 0) rareMonths += 1;
      months += 1;
      st.player.health = 90;
      st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
      if (st.ending) break;
    }
  }
  s.eq(overCap, 0, '彩蛋从未撑破 POOL_CAP（' + POOL_CAP + '）');
  s.eq(overStudent, 0, '彩蛋从未撑破学生席位 STUDENT_SLOTS（' + STUDENT_SLOTS + '）：出现时替掉一位普通候选人');
  s.ok(rareMonths >= 1, '前提：这段长跑里确实有稀有人才出现过', rareMonths + '/' + months + ' 个月');
}

/* ── 6 旧档（没有 market.rareHired）必须能读回来 ── */
{
  const st = freshGame(mods, 'rare-save-old');
  st.market.pool.push({
    offerId: 'oRare', kind: 'student', name: '路遥', gender: 'male', degree: 'phd', source: 'translate',
    ability: ABILITY_MAX_RARE, cost: 12.6, reqIF: 140, reqRank: 4, rare: true, locked: false,
    tier: 1, createdMonthIndex: st.calendar.monthIndex,
  });
  const raw = JSON.parse(JSON.stringify(st));
  delete raw.market.rareHired;                       // 旧档：根本没有这个字段
  const loaded = hydrate({ version: raw.version, savedAt: 1, state: raw });
  s.ok(Boolean(loaded), '旧档（缺 market.rareHired）能读回来，不抛异常、不判损坏');
  s.eq(loaded ? loaded.market.rareHired : null, [], '缺字段默认成空数组（[]）');
  s.eq(loaded ? loaded.market.pool.length : -1, st.market.pool.length, '缺字段不影响其它市场字段（候选人数量一致）');
  s.eq(loaded ? loaded.students.length : -1, st.students.length, '缺字段不影响学生名单');
  s.eq(loaded ? loaded.player.money : null, st.player.money, '缺字段不影响玩家字段');
  s.eq(loaded ? loaded.market.recruitedThisMonth : null, st.market.recruitedThisMonth, '缺字段不影响 recruitedThisMonth');
  const rareLoaded = loaded ? loaded.market.pool.filter((o) => o.name === '路遥')[0] : null;
  s.eq(rareLoaded ? rareLoaded.ability : null, ABILITY_MAX_RARE, '读档后稀有人才的天赋仍是 120%（rare 标记保住了上限）');

  // 脏数据：白名单 + 去重 + 非法类型丢弃
  const dirty = JSON.parse(JSON.stringify(st));
  dirty.market.rareHired = ['路遥', '路遥', '查无此人', 42, null];
  const l2 = hydrate({ version: dirty.version, savedAt: 1, state: dirty });
  s.eq(l2 ? l2.market.rareHired : null, ['路遥'], '脏数据（重复/非白名单/非字符串）被清洗成 [' + '路遥' + ']');

  // 存档往返
  const round = hydrate(serialize(st));
  s.eq(round ? round.market.rareHired : null, st.market.rareHired, '存档往返：rareHired 逐字段一致');
}

/* ── 7 防同名：随机拼名永不拼出这 8 个名字 ── */
{
  const rng = createRng('rare-name-clash');
  let clash = 0;
  for (let i = 0; i < 5000; i += 1) {
    if (RARE_NAMES.indexOf(generateName(rng, { used: [] }).name) >= 0) clash += 1;
  }
  s.eq(clash, 0, '随机拼名 5000 次都不会拼出这 8 个名字（NAME_BLOCKLIST 生效）');

  // 市场上的普通候选人也不带这 8 个名字（彩蛋只能靠 RARE_TALENTS 独立注入）
  let stray = 0;
  let samples = 0;
  for (const seed of ['rare-run-1', 'rare-run-2', 'rare-run-3']) {
    let st = freshGame(mods, seed);
    for (let i = 0; i < 120; i += 1) {
      for (const o of st.market.pool) {
        if (o.kind !== 'student') continue;
        samples += 1;
        if (o.rare !== true && RARE_NAMES.indexOf(o.name) >= 0) stray += 1;
      }
      st.player.health = 90;
      st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
      if (st.ending) break;
    }
  }
  s.eq(stray, 0, '普通候选人里没有任何一个稀有人才名字', samples + ' 个候选人样本');
}

/* ── 8 机器人路线：1.2 进入估价/发薪链路不产生 NaN，招走后台账自洽 ── */
{
  const run = runGame({ seed: 'rare-bots', strategy: 'speedrun', months: 160 });
  const rareStu = run.state.students.filter((x) => x.rare === true);
  const bad = rareStu.filter((x) => !Number.isFinite(x.ability) || !Number.isFinite(wageCost(x)) || x.ability !== ABILITY_MAX_RARE);
  s.eq(bad.length, 0, '机器人招进来的稀有人才：天赋恒为 120%，工资/进度全部有限（无 NaN）', rareStu.length + ' 人');
  s.eq(rareStu.map((x) => x.name).sort(), run.state.market.rareHired.slice().sort(), 'rareHired 与实际招进来的稀有人才一一对应');
  s.note('机器人路线（rare-bots / speedrun / 160 月）实际招到的稀有人才：'
    + (run.state.market.rareHired.join('、') || '（一个都没有）'));
  s.ok(run.state.market.rareHired.length >= 1, '前提：这条机器人路线确实招到过稀有人才',
    run.state.market.rareHired.join('、') || '（一个都没有）');
}

s.finish();

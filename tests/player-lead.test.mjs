/**
 * tests/player-lead.test.mjs —— 亲带（game/togglePlayerLead）的并发上限
 *
 * v1.7.0 口径变更：同时亲带的数量上限由**头衔**决定（src/data/ranks.js 的 playerLeadCap：
 * 1/2/2/3/3/4/4/4），不再由精力上限派生（旧实现 = max(1, floor(精力上限/2))）。
 * 保留不变：亲带本身的代价（推进 ×0.85、每月多 1 点精力、一作全归玩家）。
 *
 * 边界（本轮验收项）：
 *   · 每个头衔档的上限正确，且上限与精力无关；
 *   · 达上限时 toggle ON 被拒、状态一字未改、toast 说清「头衔上限 / 已带数量」；
 *   · 取消亲带永远允许（超限档也允许）；
 *   · 旧档超限：不追溯取消（推进月份也不撤销），但禁止再新增；
 *   · 百科「亲带」词条里的 N = 玩家当前头衔的真实上限（与 core 常量逐字一致）。
 *
 * 运行：node 评院士/tests/player-lead.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState, createProject } from '../src/core/state.js';
import { RANKS, rankOf, MAX_RANK_INDEX } from '../src/data/ranks.js';
import { PLAYER_LEAD_MUL, PLAYER_LEAD_ENERGY_COST } from '../src/data/hardpoints.js';
import { serialize, hydrate } from '../src/core/save.js';
import { selectPlayerLead, selectUiConstants } from '../src/core/selectors.js';
import { energyMax } from '../src/core/formulas.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('亲带并发上限（v1.7.0：按头衔）');

/** 玩家亲带上限阶梯的独立规格字面量（与 src/data 分开写，改数据不改口径就红）。 */
const LADDER = [1, 2, 2, 3, 3, 4, 4, 4];

function leadProject(id, playerLeading) {
  return createProject({
    instanceId: id, defId: 'E1', name: '亲带测试项目 ' + id, category: 'enterprise', tier: 1,
    workload: 100, progress: 0, money: 20, deadlineMonthIndex: 999, playerLeading,
  });
}

/** 造一局：指定头衔 + total 个在研项目，其中前 leadingCount 个已经亲带。 */
function stateWithLeads(seed, rankIndex, total, leadingCount) {
  const st = freshGame(mods, seed);
  st.player.rankIndex = rankIndex;
  st.projects = [];
  for (let k = 0; k < total; k += 1) st.projects.push(leadProject('p' + (k + 1), k < leadingCount));
  return st;
}

const flags = (st) => st.projects.map((p) => p.playerLeading);
const ledCount = (st) => st.projects.filter((p) => p.playerLeading).length;
const toastOf = (st) => String(st.ui.toast || '');

/* ── 1 数据表：八档上限 + 单调不减 ── */
for (let i = 1; i <= MAX_RANK_INDEX; i += 1) {
  s.eq(rankOf(i).playerLeadCap, LADDER[i - 1], 'rank' + i + '「' + rankOf(i).title + '」的 playerLeadCap');
}
s.eq(RANKS.filter(Boolean).length, LADDER.length, 'RANKS 的档数与规格阶梯一一对应');
s.ok(LADDER.every((v, i) => i === 0 || v >= LADDER[i - 1]), '上限阶梯单调不减（晋升只会更宽，不会变窄）', LADDER.join('/'));

/* ── 2 每档实测：恰好到上限可以，再多一个被拒且状态不变 ── */
for (let i = 1; i <= MAX_RANK_INDEX; i += 1) {
  const rank = rankOf(i);
  const cap = rank.playerLeadCap;
  // 2.1 从 cap-1 加到 cap：允许
  const under = stateWithLeads('lead-under-' + i, i, cap, cap - 1);
  const filled = reduce(under, ACTIONS.togglePlayerLead({ projectId: 'p' + cap }));
  s.eq(ledCount(filled), cap, 'rank' + i + '：从 ' + (cap - 1) + ' 个加到上限 ' + cap + ' 个成功');
  // 2.2 已满再 toggle ON：拒绝 + 状态一字未改 + toast 讲清上限与已带数
  const full = stateWithLeads('lead-full-' + i, i, cap + 1, cap);
  const before = flags(full);
  const rejected = reduce(full, ACTIONS.togglePlayerLead({ projectId: 'p' + (cap + 1) }));
  s.eq(flags(rejected), before, 'rank' + i + '：到上限后再加被拒，所有项目的亲带状态一字未改');
  s.eq(ledCount(rejected), cap, 'rank' + i + '：被拒后已亲带数量仍是 ' + cap);
  s.ok(toastOf(rejected).includes('最多同时亲带 ' + cap) && toastOf(rejected).includes('你已亲带 ' + cap)
    && toastOf(rejected).includes(rank.title),
  'rank' + i + '：拒绝 toast 说明「' + rank.title + ' 上限 ' + cap + ' / 已带 ' + cap + '」', toastOf(rejected));
}

/* ── 3 上限与精力无关（回归：旧实现 = max(1, floor(精力上限/2))，健康好时能到 6+） ── */
{
  let weakOk = true;
  let strongOk = true;
  for (const health of [1, 100]) {
    let st = stateWithLeads('lead-energy-' + health, 8, 5, 0);   // 院士上限 4
    st.player.health = health;
    for (let k = 1; k <= 4; k += 1) st = reduce(st, ACTIONS.togglePlayerLead({ projectId: 'p' + k }));
    const fourOk = ledCount(st) === 4;
    const fifth = reduce(st, ACTIONS.togglePlayerLead({ projectId: 'p5' }));
    const fifthRejected = ledCount(fifth) === 4;
    if (health === 1) weakOk = fourOk && fifthRejected; else strongOk = fourOk && fifthRejected;
    s.note('健康 ' + health + ' → 精力上限 ' + energyMax(st) + '：院士仍只允许 4 个亲带（'
      + (fourOk ? '4 个都成功' : '第 4 个被拒') + '，第 5 个' + (fifthRejected ? '被拒' : '竟然通过') + '）');
  }
  s.ok(weakOk && strongOk, '亲带上限只由头衔决定：精力上限高低都不改变院士的 4 个上限（旧实现按 精力÷2 会在健康 100 时放到 6）');
}

/* ── 4 取消亲带永远允许（超限旧档也一样） ── */
{
  const over = stateWithLeads('lead-cancel', 3, 5, 4);          // 副教授上限 2，旧档挂着 4 个
  const off = reduce(over, ACTIONS.togglePlayerLead({ projectId: 'p1' }));
  s.eq(ledCount(off), 3, '超限旧档：取消亲带照常生效（取消不受上限约束）');
  s.eq(off.projects.find((p) => p.instanceId === 'p1').playerLeading, false, '取消后该项目确实不再是亲带');
  const off2 = reduce(off, ACTIONS.togglePlayerLead({ projectId: 'p2' }));
  s.eq(ledCount(off2), 2, '继续取消到上限以内也允许（一路允许到 0）');
}

/* ── 5 旧档超限：不追溯取消，但禁止再新增 ── */
{
  const over = stateWithLeads('lead-legacy-over', 3, 5, 4);
  const sel = selectPlayerLead(over);
  s.eq([sel.cap, sel.count, sel.over, sel.canAdd], [2, 4, true, false],
    '超限旧档的选择器读数：上限 2 / 已带 4 / 超限 / 不能再加');
  const before = flags(over);
  const add = reduce(over, ACTIONS.togglePlayerLead({ projectId: 'p5' }));
  s.eq(flags(add), before, '超限旧档：新增亲带被拒，且没有任何已亲带项目被静默取消');
  s.eq(ledCount(add), 4, '超限旧档：拒绝新增后仍是 4 个亲带');
  s.ok(toastOf(add).includes('最多同时亲带 2') && toastOf(add).includes('你已亲带 4'),
    '超限旧档的拒绝 toast 写的是「上限 2 / 已带 4」', toastOf(add));
  const adv = reduce(over, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.eq(ledCount(adv), 4, '推进月份不会追溯取消超限的亲带项目（引擎没有自动撤销路径）');
  const offAfterAdv = reduce(adv, ACTIONS.togglePlayerLead({ projectId: 'p1' }));
  s.eq(ledCount(offAfterAdv), 3, '超限旧档在推进月份之后仍然可以取消亲带');
}

/* ── 6 百科：亲带词条里的 N = 玩家当前头衔的真实上限（逐字对账） ── */
{
  const firstAuthorRow = (st) => {
    const chapter = selectUiConstants(st).wiki.chapters.find((c) => c.id === 'firstAuthor');
    return chapter.rows.find((r) => r.key === 'firstAuthor.lead');
  };
  for (const i of [1, 3, 4, 8]) {
    const st = stateWithLeads('lead-wiki-' + i, i, 0, 0);
    const want = '项目推进 ×' + PLAYER_LEAD_MUL + ' · 每月多 ' + PLAYER_LEAD_ENERGY_COST + ' 点精力'
      + ' · 同时最多 ' + rankOf(i).playerLeadCap + ' 个（随头衔提升；你当前是「' + rankOf(i).title + '」）';
    s.eq(firstAuthorRow(st).value, want, 'rank' + i + '：百科「亲带」词条的上限取当前头衔的真实值');
  }
  const rankChapter = selectUiConstants(stateWithLeads('lead-wiki-ladder', 8, 0, 0)).wiki.chapters.find((c) => c.id === 'ranks');
  const rankRow = (i) => (rankChapter.rows.find((r) => r.key === 'rank.' + i) || {}).value || '';
  // 晋升门槛章按设计只列「要爬的档」（rank2..rank8）；rank1 的上限由上面的亲带词条与 §1/§2 覆盖。
  for (let i = 2; i <= MAX_RANK_INDEX; i += 1) {
    s.ok(rankRow(i).includes('亲带上限 ' + LADDER[i - 1] + ' 项'),
      '百科「晋升门槛」章里 rank' + i + '「' + rankOf(i).title + '」写明亲带上限 ' + LADDER[i - 1] + ' 项');
  }
  s.ok(rankRow(1) === '', '晋升门槛章不含起始档（rank1）的行——它的亲带上限由亲带词条与数据断言覆盖');
}

/* ── 7 旧档读档往返：亲带标记原样保留（读档不追梢取消，也不静默改写） ── */
{
  const over = stateWithLeads('lead-save', 3, 5, 4);
  const back = hydrate(serialize(over));
  s.ok(Boolean(back), '超限旧档能被读档器还原（不是「格式不认识」）');
  if (back) {
    s.eq(back.projects.map((p) => p.playerLeading), over.projects.map((p) => p.playerLeading),
      '存档 → 读档往返后 4 个亲带标记原样保留');
    s.eq(selectPlayerLead(back).over, true, '读档回来仍被识别为超限（供 UI 提示）');
    const add = reduce(back, ACTIONS.togglePlayerLead({ projectId: 'p5' }));
    s.eq(ledCount(add), 4, '读档回来的超限档同样禁止新增（4 个一个都没少）');
    const off = reduce(back, ACTIONS.togglePlayerLead({ projectId: 'p1' }));
    s.eq(ledCount(off), 3, '读档回来的超限档同样允许取消');
  }
}

/* ── 8 代价不变（本轮只改上限，不改亲带的代价） ── */
{
  const st = stateWithLeads('lead-cost', 4, 2, 0);
  const on = reduce(st, ACTIONS.togglePlayerLead({ projectId: 'p1' }));
  s.eq(on.projects.find((p) => p.instanceId === 'p1').playerLeading, true, '上限以内 toggle 正常打开亲带');
  s.eq(PLAYER_LEAD_MUL, 0.85, '亲带的项目推进倍率仍是 ×0.85（本轮不动代价）');
  s.eq(PLAYER_LEAD_ENERGY_COST, 1, '亲带每月额外精力仍是 1 点（本轮不动代价）');
  s.eq(RANKS[RANKS.length - 1].playerLeadCap, 4, '院士档上限 4（不是「精力好就无限」）');
}

s.finish();

/**
 * tests/happiness.test.mjs —— 幸福度公式与后果（工资四档 / 耗材模式 / 延毕 / 离职 / 极端事件）
 * 运行：node 评院士/tests/happiness.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState, createStudent } from '../src/core/state.js';
import { pendingDeferStudents } from '../src/core/engine.js';
import { happinessDelta, expectedWageTier } from '../src/core/formulas.js';
import {
  WAGE_HAPPY, GAP_PENALTY, PROJECT_STRESS_IDLE, PROJECT_STRESS_HARDPOINT, HAPPY_REGRESSION_THRESHOLD,
  HAPPY_REGRESSION_SLOPE, LEAVE_TRIGGER_HAPPINESS, LEAVE_TRANSFER_PROGRESS_MUL, LEAVE_EXTREME_RATE,
  LEAVE_EXTREME_INTEGRITY, DEFER_HAPPY, DEFER_MONTHS_SUBTRACT, WAGE_INDEX, WAGE_EXPECT_THRESHOLDS,
  MULTI_PROJECT_HAPPY_PENALTY,
} from '../src/data/students.js';
import { CONSUME_MODES } from '../src/data/tuning.js';
import { INTEGRITY_DELTA } from '../src/data/tuning.js';
import { createProject } from '../src/core/state.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('幸福度与后果');

/* ── 1 工资四档 ── */
{
  const st = createStudent({ id: 's1', ability: 0.9, wageTier: 'high' });
  const d = happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  s.eq(d, WAGE_HAPPY.high, '高天赋 + 高工资：幸福变化 = WAGE_HAPPY.high');
}
{
  const st = createStudent({ id: 's1', ability: 0.3, wageTier: 'none' });
  const d = happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  const gap = WAGE_INDEX[expectedWageTier(0.3)] - WAGE_INDEX.none;
  // t47：差档是**惩罚**（旧实现写成加法 ⇒ 欠薪反而加幸福）。标签语义不变。
  s.eq(d, WAGE_HAPPY.none - GAP_PENALTY * gap, '不发工资：基础 ' + WAGE_HAPPY.none + ' − 期望差档惩罚 ' + GAP_PENALTY + '×' + gap);
}
{
  const st = createStudent({ id: 's1', ability: 0.9, wageTier: 'low' });
  const d = happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  const gap = WAGE_INDEX[expectedWageTier(0.9)] - WAGE_INDEX.low;
  s.eq(d, WAGE_HAPPY.low - GAP_PENALTY * gap, '天赋与工资期望差档时，每档额外扣 ' + GAP_PENALTY + '（t47 修符号）');
}
s.eq(expectedWageTier(WAGE_EXPECT_THRESHOLDS.high), 'high', '天赋 ≥0.80 期望高工资');
s.eq(expectedWageTier(WAGE_EXPECT_THRESHOLDS.mid), 'mid', '天赋 ≥0.55 期望中工资');

/* ── 2 耗材模式 / 没项目 / 未解决难点 ── */
{
  const st = createStudent({ id: 's1', ability: 0.7, wageTier: 'mid' });
  const base = happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  s.eq(base, 0, '中工资 + 正常耗材 + 有项目：ΔH = 0（BALANCE 红线 5）');
  s.eq(happinessDelta(st, { consumeHappy: CONSUME_MODES.tight.happyDelta, hasProject: true, hasOpenHardpoint: false }),
    CONSUME_MODES.tight.happyDelta, '收紧裤腰：每月额外 ' + CONSUME_MODES.tight.happyDelta + ' 幸福');
  s.eq(happinessDelta(st, { consumeHappy: CONSUME_MODES.free.happyDelta, hasProject: true, hasOpenHardpoint: false }),
    CONSUME_MODES.free.happyDelta, '随意挥霍：每月 +' + CONSUME_MODES.free.happyDelta + ' 幸福');
  s.eq(happinessDelta(st, { consumeHappy: 0, hasProject: false, hasOpenHardpoint: false }),
    PROJECT_STRESS_IDLE, '没有项目的学生会掉幸福（PROJECT_STRESS_IDLE）');
  s.eq(happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: true }),
    PROJECT_STRESS_HARDPOINT, '有未解决难点时掉幸福（PROJECT_STRESS_HARDPOINT）');
}
{
  const st = createStudent({ id: 's1', ability: 0.7, wageTier: 'mid', happiness: 100 });
  const d = happinessDelta(st, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  s.near(d, -(HAPPY_REGRESSION_THRESHOLD - 100) * 0 + 0, 6, '高幸福时回归项为非正（越幸福越难再涨）');
  s.ok(d <= 0, '幸福 >80 时回归项 ≤ 0', String(d));
  const mid = createStudent({ id: 's2', ability: 0.7, wageTier: 'mid', happiness: 90 });
  const dm = happinessDelta(mid, { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false });
  s.eq(dm, -Math.round((90 - HAPPY_REGRESSION_THRESHOLD) * HAPPY_REGRESSION_SLOPE * 1000) / 1000, '回归斜率 = ' + HAPPY_REGRESSION_SLOPE);
}

/* ── 3 实际月份结算：幸福度真的会掉 / 会触发离组 ── */
{
  const st = freshGame(mods, 'happy-leave');
  const st0 = st.students[0];
  st0.happiness = 1;
  st0.projectIds = [];
  // t47：本用例以前是靠**旧符号 bug**（欠薪反而扣幸福）才把幸福度打到 0 的。
  // 现在改成真正被欠薪的学生（不发工资 + 期望更高），使月变化确定性地为负。
  st0.wageTier = 'none';
  const before = st.students.length;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const gone = after.students.find((x) => x.id === st0.id);
  s.ok(gone.left, '幸福度归零的学生会转组离组', JSON.stringify(gone));
  s.eq(after.month.leavesThisMonth >= 1, true, '本月离组人数被记录（实验室空了结局的判据）');
  s.ok(after.students.length <= before, '离组后学生不会被凭空复活');
}
{
  // 离组默认保留 40% 进度
  const st = freshGame(mods, 'leave-progress');
  const st0 = st.students[0];
  const project = createProject({
    instanceId: 'p1', defId: 'E1', name: '测试项目', category: 'enterprise', tier: 1,
    workload: 1000, progress: 500, consumablePerMonth: 0, deadlineMonthIndex: 999,
    assignedStudentIds: [st0.id],
  });
  st.projects.push(project);
  st0.projectIds = ['p1'];
  st0.happiness = 0;
  st0.wageTier = 'none';   // t47：同上——不发工资才会确定性掉幸福度（旧符号 bug 下才靠欠薪掉）
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const p = after.projects.find((x) => x.instanceId === 'p1');
  const left = after.students.find((x) => x.id === st0.id);
  if (left.left && p.progress === 500) {
    s.ok(false, '离组应该让项目进度打折', '进度未变化');
  } else {
    s.ok(left.left && p.progress <= 500, '学生离组：项目进度按 ' + LEAVE_TRANSFER_PROGRESS_MUL + ' 打折', String(p.progress));
  }
}

/* ── 4 延毕：学制读满 → 待决状态 → 玩家二选一（t8 finding） ── */
{
  const st = freshGame(mods, 'happy-defer');
  const st0 = st.students.find((x) => x.degree === 'master');
  st0.degreeProgress = 10;
  st0.studyMonthsLeft = 1;
  st0.happiness = 70;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const s2 = after.students.find((x) => x.id === st0.id);
  s.eq(s2.studyMonthsLeft, 0, '学制读满：不再自动延毕，而是挂起等玩家拍板');
  s.eq(pendingDeferStudents(after).length, 1, '出现 1 个待决的延毕学生');
  const blocked = reduce(after, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.eq(blocked.calendar.monthIndex, after.calendar.monthIndex, '没拍板之前月份不能推进（待决状态拦截）');
  const deferred = reduce(after, ACTIONS.chooseDefer({ studentId: st0.id, choice: 'defer' }));
  const s3 = deferred.students.find((x) => x.id === st0.id);
  s.eq(s3.deferMonths, 1, '选择「延毕一年」：deferMonths +1');
  s.eq(s3.studyMonthsLeft, DEFER_MONTHS_SUBTRACT, '延毕补回 ' + DEFER_MONTHS_SUBTRACT + ' 个月学制');
  // t47：基准改成「拍板前那一刻的幸福度」（当月工资项修好后，70 不再是拍板前的值）
  s.ok(s3.happiness <= s2.happiness + DEFER_HAPPY + 1, '延毕大幅降低幸福度（' + DEFER_HAPPY + '，相对拍板前 ' + s2.happiness + '）', String(s3.happiness));
  s.eq(pendingDeferStudents(deferred).length, 0, '拍板后待决状态清空');
}
{
  const st = freshGame(mods, 'happy-defer-quit');
  const st0 = st.students.find((x) => x.degree === 'master');
  st0.degreeProgress = 10;
  st0.studyMonthsLeft = 0;
  const before = st.player.integrity;
  const after = reduce(st, ACTIONS.chooseDefer({ studentId: st0.id, choice: 'giveUp' }));
  const s2 = after.students.find((x) => x.id === st0.id);
  s.ok(s2.left && /肄业/.test(s2.note || ''), '选择「让他肄业」：学生离组', JSON.stringify(s2.note));
  s.ok(after.player.integrity < before, '肄业扣诚信', String(after.player.integrity));
}

/* ── 5 无工资 3 个月 / 极端事件常量 ── */
{
  const st = freshGame(mods, 'happy-nowage');
  const st0 = st.students[0];
  st0.wageTier = 'none';
  st0.monthsNoWage = 2;
  const before = st.player.integrity;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const s2 = after.students.find((x) => x.id === st0.id);
  s.eq(s2.monthsNoWage, 3, '无工资月数累计');
  s.eq(after.player.integrity, Math.min(before, 100) + INTEGRITY_DELTA.noWage, '连续 3 个月不发补助：诚信 ' + INTEGRITY_DELTA.noWage);
}
s.eq(LEAVE_EXTREME_RATE, 0.005, '0.5% 极端事件概率（SPEC 方向）');
s.eq(LEAVE_EXTREME_INTEGRITY, INTEGRITY_DELTA.extreme, '极端事件诚信扣减与诚信总表一致（' + INTEGRITY_DELTA.extreme + '）');

/* ── 6 工资四档常量表自洽 ── */
s.ok(WAGE_HAPPY.high > WAGE_HAPPY.mid && WAGE_HAPPY.mid >= WAGE_HAPPY.low && WAGE_HAPPY.low > WAGE_HAPPY.none,
  '工资四档的幸福度递减：high > mid ≥ low > none');

/* ── 7 数值型 limitPerMonth（t16 F3）：去团建每月只能 1 次 ── */
{
  let st = freshGame(mods, 'limit-teambuild');
  st.player.energy = 12;
  st.player.money = 500;
  const before = st.students.map((x) => x.happiness);
  st = reduce(st, ACTIONS.doAction({ actionId: 'teambuild' }));
  const afterFirst = st.students.map((x) => x.happiness);
  s.eq(st.player.monthActions.teambuild, 1, '第一次「去团建」计数 = 1');
  s.ok(afterFirst.every((h, i) => h >= before[i]), '第一次团建把幸福度抬上去');
  const moneyAfterFirst = st.player.money;
  const twice = reduce(st, ACTIONS.doAction({ actionId: 'teambuild' }));
  s.eq(twice.player.monthActions.teambuild, 1, '第二次「去团建」被引擎拒绝（计数不再增加）');
  s.ok(Boolean(twice.ui.toast), '被拒时给玩家 toast 说明原因', String(twice.ui.toast));
  s.eq(twice.player.money, moneyAfterFirst, '被拒的行动不扣经费');
  s.eq(twice.students.map((x) => x.happiness).join(','), afterFirst.join(','), '被拒的行动不加幸福度');
  const ex = reduce(twice, ACTIONS.doAction({ actionId: 'exercise' }));
  s.eq(ex.player.monthActions.exercise, 1, 'limitPerMonth=99 的行动不受影响（回归）');
  const mt = reduce(ex, ACTIONS.doAction({ actionId: 'meeting' }));
  s.eq(mt.player.monthActions.meeting, 1, '组会（99 次上限）不受影响（回归）');
}

/* ── 9 多项目幸福度惩罚（t42，B 方案）：在研 n≥1 时每月额外 −(n−1)×MULTI_PROJECT_HAPPY_PENALTY ── */
{
  const stu = { ...createStudent({ id: 'sP', name: '多项目甲', degree: 'master', ability: 0.7 }), happiness: 60 };
  const base = { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false };
  const d1 = happinessDelta(stu, { ...base, assignedProjectCount: 1 });
  const d2 = happinessDelta(stu, { ...base, assignedProjectCount: 2 });
  const d3 = happinessDelta(stu, { ...base, assignedProjectCount: 3 });
  const d0 = happinessDelta(stu, { ...base, hasProject: false, assignedProjectCount: 0 });
  s.eq(MULTI_PROJECT_HAPPY_PENALTY, 1, '常量 MULTI_PROJECT_HAPPY_PENALTY 默认 1，且住在 src/data/students.js（可调）');
  s.ok(d1 > d2, 'n=2 比 n=1 每月更不开心（多带一个项目有代价）', d1 + ' vs ' + d2);
  s.near(d1 - d2, MULTI_PROJECT_HAPPY_PENALTY, 1e-6, 'n=1 → n=2 的月差 = 1×MULTI');
  s.near(d1 - d3, 2, 1e-6, '硬数字：n=1 vs n=3 的月差恰好 2 点 —— 把常量改成 0，本条必红（证明它真的在起作用）');
  s.near(d2 - d3, MULTI_PROJECT_HAPPY_PENALTY, 1e-6, '惩罚线性可加：每多 1 个项目再 −1×MULTI');
  s.eq(d0, happinessDelta(stu, { ...base, hasProject: false }), 'n=0 不吃这条惩罚：与「不传计数」的旧口径逐位一致（仍走 PROJECT_STRESS_IDLE）');
  s.eq(happinessDelta(stu, { ...base }), d1, '未传 assignedProjectCount 时按 n=1 处理（向后兼容，不误伤）');
  const grudge = { ...stu, grudgeMonths: 1 };
  const defer = { ...stu, deferMonths: 1 };
  s.near(d1 - happinessDelta(grudge, { ...base, assignedProjectCount: 1 }), 2, 1e-6, '抢一作心结（grudgeMonths）照旧 −2，与多项目惩罚独立叠加');
  s.near(d1 - happinessDelta(defer, { ...base, assignedProjectCount: 1 }), 1, 1e-6, '延毕（deferMonths）照旧 −1，与多项目惩罚独立叠加');
  s.near(d1 - happinessDelta(grudge, { ...base, assignedProjectCount: 3 }), 2 + 2, 1e-6, '心结 + n=3：两条惩罚同时生效（−2 与 −2 相加）');
}

{
  // 集成：engine 必须复用产出守恒的同一份 loadByStudent（由 assignedStudentIds 统计），
  // 而不是 settleStudents 里那份「按 st.projectIds 过滤」的列表 —— 两套计数必然漂移。
  const month = (opts) => {
    const g = freshGame(mods, 't42-multi');
    g.player.money = 5000;
    g.player.consumable = 5000;
    g.lab.equipment = { centrifuge: 2, shaker: 2, hplc: 2, hood: 2, elisa: 2, gc: 2, ms: 2, bath: 2 };
    const who = g.students[0];
    const list = [];
    for (let i = 0; i < opts.assigned; i += 1) {
      const p = createProject({ instanceId: 'pM' + i, defId: 'N2', name: '多项目惩罚用' + i, category: 'nation', tier: 2,
        workload: 1e6, money: 50, depositRate: 0.30, consumablePerMonth: 0, deadlineMonthIndex: 999, hardpoints: [] });
      g.projects.push(p);
      list.push(p);
    }
    who.projectIds = list.slice(0, opts.listed).map((p) => p.instanceId);
    for (const p of list) p.assignedStudentIds = [who.id];
    const before = who.happiness;
    const after = reduce(g, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    return after.students.find((x) => x.id === who.id).happiness - before;
  };
  const one = month({ assigned: 1, listed: 1 });
  const three = month({ assigned: 3, listed: 3 });
  s.near(one - three, 2, 1e-6, '集成：1 个项目 vs 3 个项目，本月幸福度净变化差 = −2（引擎真的把 n 传进来了）',
    '1 项目 Δ' + one + ' / 3 项目 Δ' + three);
  const split = month({ assigned: 3, listed: 1 });
  s.near(one - split, 2, 1e-6, '计数口径：assignedStudentIds=3 但 student.projectIds=1 时，惩罚按 3 算 —— 证明用的是产出守恒那份 loadByStudent（若改用 projectIds 计数，本条会变成 0）',
    'Δ' + split);
}

/* ── 10 t47 工资差档必须是【惩罚】：单调性哨兵 + 修复前后对照 ──
   这是唯一能挡住「欠薪更开心」这类**方向性**错误的断言：给定同一能力值，幸福度净变化
   随工资档下降不得上升。旧实现把差档写成加法，实测 low(+6) 反而优于 mid(+5)/none(+3)，
   于是「克扣最好的学生」成了支配策略 —— 机器人路线测不出来（bots 一律按期望档发薪，gap 恒 0）。 */
{
  const ctxZero = { consumeHappy: 0, hasProject: true, hasOpenHardpoint: false, assignedProjectCount: 1 };
  const TIERS = ['high', 'mid', 'low', 'none'];
  const BANDS = [
    { label: '低天赋', ability: 0.40 },
    { label: '中天赋', ability: 0.65 },
    { label: '高天赋', ability: 0.90 },
  ];
  for (const band of BANDS) {
    const deltas = TIERS.map((tier, i) => happinessDelta(
      createStudent({ id: 'w' + i + band.ability, ability: band.ability, wageTier: tier }), ctxZero));
    const monotone = deltas.every((d, i) => i === 0 || deltas[i - 1] >= d);
    s.ok(monotone, band.label + '（期望 ' + expectedWageTier(band.ability) + '）：幸福度净变化随工资档下降不得上升（欠薪永远不优于正常发薪）',
      TIERS.map((t, i) => t + ' ' + deltas[i]).join(' | '));
  }
  const high = TIERS.map((tier, i) => happinessDelta(
    createStudent({ id: 'hi' + i, ability: 0.90, wageTier: tier }), ctxZero));
  s.ok(high[0] >= high[1] && high[1] > high[2] && high[2] > high[3],
    '高天赋学生（expected=high）四档严格方向：high ≥ mid > low > none', high.join(' > '));
  const ctxNoProject = { ...ctxZero, hasProject: false, assignedProjectCount: 0 };
  s.ok(happinessDelta(createStudent({ id: 'hiX', ability: 0.90, wageTier: 'none' }), ctxNoProject)
    < happinessDelta(createStudent({ id: 'hiY', ability: 0.90, wageTier: 'high' }), ctxNoProject),
    '不发工资（含无项目）永远差于高工资：欠薪不可能靠「省下的钱」换回幸福');
  const rows = TIERS.map((tier) => {
    const gap = WAGE_INDEX[expectedWageTier(0.90)] - WAGE_INDEX[tier];
    const before = WAGE_HAPPY[tier] + GAP_PENALTY * gap;   // 旧公式（+）：欠薪反而加幸福
    const after = WAGE_HAPPY[tier] - GAP_PENALTY * gap;    // 新公式（−）：差档即惩罚
    const sign = (v) => (v >= 0 ? '+' : '') + v;
    return tier + '：修复前 ' + sign(before) + ' → 修复后 ' + sign(after);
  });
  s.note('t47 对照表（高天赋 expected=high，ctx 其余项均为 0）：' + rows.join('；')
    + '。修复前 low(+6) 反而优于 mid(+5)/none(+3) ⇒ 克扣最好的学生是支配策略；修复后严格单调递减。');
}

s.finish();

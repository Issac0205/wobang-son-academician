/**
 * tests/defer-boss.test.mjs —— v1.6.0「延毕他」（老板随时拍板的主动延毕）
 *
 * 被测契约（docs/CONTRACT.md §3.1）：game/deferStudentByBoss { studentId }
 *   · 守卫：学生不存在 / 已 left / 已 graduated → 中文 toast，状态逐字不变、不扣钱
 *   · 效果只有两条：happiness +DEFER_BY_BOSS_HAPPY、degreeProgress +DEFER_BY_BOSS_PROGRESS
 *     （各自夹到 0..上限）；不动 studyMonthsLeft / deferMonths / 诚信
 *   · 允许连点：每一次各自生效
 * 运行：node 评院士/tests/defer-boss.test.mjs
 */

import { createSuite } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { DEFER_BY_BOSS_HAPPY, DEFER_BY_BOSS_PROGRESS } from '../src/data/students.js';

const s = createSuite('延毕他（老板主动延毕）');
const fresh = () => reduce(createState({ seed: 'defer-boss-seed' }), ACTIONS.newGame({ seed: 'defer-boss-seed' }));
const activeOf = (st) => st.students.filter((x) => !x.left && !x.graduated);
const rowOf = (st, id) => st.students.filter((x) => x.id === id)[0];

/* ── 1 两个数值恰好生效，且不改其它字段 ── */
{
  const st0 = fresh();
  const t = activeOf(st0)[0];
  t.happiness = 60;
  t.degreeProgress = 40;
  const study = t.studyMonthsLeft;
  const defer = t.deferMonths;
  const integrity = st0.player.integrity;
  const money = st0.player.money;
  const after = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: t.id }));
  const a = rowOf(after, t.id);
  s.eq(a.happiness - 60, DEFER_BY_BOSS_HAPPY, 'happiness 恰好 −20（60 → ' + a.happiness + '）');
  s.eq(a.degreeProgress - 40, DEFER_BY_BOSS_PROGRESS, 'degreeProgress 恰好 −25（40 → ' + a.degreeProgress + '）');
  s.eq(a.studyMonthsLeft, study, '不动 studyMonthsLeft（' + study + '）');
  s.eq(a.deferMonths, defer, '不动 deferMonths（' + defer + '）');
  s.eq(after.player.integrity, integrity, '不动诚信（' + integrity + '）');
  s.eq(after.player.money, money, '不扣钱（' + money + ' 万）');
  s.eq(JSON.stringify(st0.students.filter((x) => x.id === t.id)[0].happiness), '60', 'reducer 不就地修改入参（原 state 的幸福度仍是 60）');
}

/* ── 2 边界夹取：happiness 5 → 0；progress 10 → 0 ── */
{
  const st0 = fresh();
  const t = activeOf(st0)[0];
  t.happiness = 5;
  t.degreeProgress = 10;
  const after = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: t.id }));
  const a = rowOf(after, t.id);
  s.eq(a.happiness, 0, 'happiness 5 → 0（夹到下限）');
  s.eq(a.degreeProgress, 0, '毕业进度 10 → 0（夹到下限）');
}

/* ── 3 拒绝路径：已毕业 / 已离组 / 不存在 —— 状态逐字不变 ── */
{
  const st0 = fresh();
  const list = activeOf(st0);
  const grad = list[0];
  const left = list[1];
  grad.graduated = true;
  left.left = true;
  const before = JSON.stringify(st0);

  const afterGrad = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: grad.id }));
  s.eq(JSON.stringify(afterGrad.students), JSON.stringify(st0.students), '已毕业学生：学生表逐字不变');
  s.ok(/[\u4e00-\u9fa5]/.test(String(afterGrad.ui.toast || '')), '已毕业学生：给了中文 toast（' + String(afterGrad.ui.toast).slice(0, 20) + '）');

  const afterLeft = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: left.id }));
  s.eq(JSON.stringify(afterLeft.students), JSON.stringify(st0.students), '已离组学生：学生表逐字不变');
  s.ok(/[\u4e00-\u9fa5]/.test(String(afterLeft.ui.toast || '')), '已离组学生：给了中文 toast（' + String(afterLeft.ui.toast).slice(0, 20) + '）');

  const afterMissing = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: 'no-such-student' }));
  s.eq(JSON.stringify(afterMissing.students), JSON.stringify(st0.students), '不存在的 id：学生表逐字不变');
  s.eq(afterMissing.player.integrity, st0.player.integrity, '被拒绝时不扣诚信');
  s.eq(afterMissing.player.money, st0.player.money, '被拒绝时不扣钱');
  s.ok(/[\u4e00-\u9fa5]/.test(String(afterMissing.ui.toast || '')), '不存在的 id：给了中文 toast（' + String(afterMissing.ui.toast).slice(0, 20) + '）');
  s.eq(JSON.stringify(st0), before, '三次拒绝都没有就地修改原 state');
}

/* ── 4 允许连点：两次各自生效 ── */
{
  const st0 = fresh();
  const t = activeOf(st0)[0];
  t.happiness = 80;
  t.degreeProgress = 60;
  const once = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: t.id }));
  const twice = reduce(once, ACTIONS.deferStudentByBoss({ studentId: t.id }));
  const a = rowOf(twice, t.id);
  s.eq(a.happiness, 80 + 2 * DEFER_BY_BOSS_HAPPY, '连点两次：幸福度累计 −40（允许连点，每次各自生效）');
  s.eq(a.degreeProgress, 60 + 2 * DEFER_BY_BOSS_PROGRESS, '连点两次：毕业进度累计 −50');
}

/* ── 5 写一条 system 纪事，且说明是老板拍的板 ── */
{
  const st0 = fresh();
  const t = activeOf(st0)[0];
  const beforeLen = st0.chronicle.length;
  const after = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: t.id }));
  const added = after.chronicle.slice(beforeLen);
  s.eq(added.length, 1, '成功路径恰好写 1 条纪事');
  s.eq(added[0].kind, 'system', '纪事 kind = system');
  s.ok(String(added[0].text).indexOf('你拍的板') >= 0, '纪事写明是老板拍的板：' + String(added[0].text).slice(0, 60));
  const rejected = reduce(st0, ACTIONS.deferStudentByBoss({ studentId: 'no-such-student' }));
  s.eq(rejected.chronicle.length, beforeLen, '拒绝路径不写纪事');
}

s.finish();

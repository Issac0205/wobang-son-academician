/** probeJ.mjs — t29 复验 t35 ①：一作空窗提示的阈值判定在 core（UI 不得自算） */
import { createState } from '../../src/core/state.js';
import { ACTIONS, reduce, pendingDeferStudents } from '../../src/core/engine.js';
import { firstAuthorDrought } from '../../src/core/formulas.js';
const say = (s) => console.log(s);
let st = reduce(createState({ seed: 'drought-probe' }), ACTIONS.newGame({ seed: 'drought-probe' }));
const rows = [];
for (let i = 0; i < 40; i += 1) {
  if (st.ending) break;
  st.player.health = 90; if (st.player.money < 60) st.player.money = 200;
  let guard = 0;
  while (pendingDeferStudents(st).length && guard < 8) { guard += 1; const s0 = pendingDeferStudents(st)[0]; const nx = reduce(st, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' })); if (nx === st) break; st = nx; }
  const d = firstAuthorDrought(st);
  rows.push({ m: st.calendar.monthIndex, months: d.months, stuck: d.stuck, threshold: d.threshold });
  st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
}
const first = rows.filter((r) => r.stuck)[0];
const before = rows.filter((r) => !r.stuck && r.months > 0).slice(-1)[0];
say('阈值（core 给的 threshold）= ' + (rows[0] ? rows[0].threshold : '?'));
say('自然推进（不亲带/不买/不抢）逐月：' + rows.map((r) => r.m + ':' + r.months + (r.stuck ? '(stuck)' : '')).join(' '));
say('首次 stuck 出现在 months=' + (first ? first.months : '无') + '（月索引 ' + (first ? first.m : '-') + '）');
say('stuck 前一个月 months=' + (before ? before.months : '无'));
say('判定：stuck 恰在 months ≥ threshold 时翻真 → ' + (first && before && first.months === before.months + 1 && before.months < first.threshold && first.months >= first.threshold ? 'PASS' : '需要人工复核'));
// 解除侧：买一篇一作，看是否同月清零
const beforeBuy = firstAuthorDrought(st);
const st2 = reduce(st, ACTIONS.buyFirstAuthor({ tier: 'q1' }));
const afterBuy = firstAuthorDrought(st2);
say('买一作前 ' + JSON.stringify(beforeBuy) + ' → 买后 ' + JSON.stringify(afterBuy) + '　（期望 stuck=false 且 months 归零）');
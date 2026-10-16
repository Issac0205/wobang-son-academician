/** probeL.mjs — 招生季候选人在架情况逐月诊断（判定 ② 的 0 是真实缺口还是早期效应） */
import { createState } from '../../src/core/state.js';
import { ACTIONS, reduce, pendingDeferStudents } from '../../src/core/engine.js';
import { canRecruitOffer } from '../../src/core/rules.js';
import { MARKET_OPEN_MONTHS } from '../../src/data/market.js';
const say = (s) => console.log(s);
const rows = [];
let st = reduce(createState({ seed: 't4-01' }), ACTIONS.newGame({ seed: 't4-01' }));
for (let i = 0; i < 96; i += 1) {
  if (st.ending) break;
  st.player.health = 90; if (st.player.money < 60) st.player.money = 200;
  let guard = 0;
  while (pendingDeferStudents(st).length && guard < 8) { guard += 1; const s0 = pendingDeferStudents(st)[0]; const nx = reduce(st, ACTIONS.chooseDefer({ studentId: s0.id, choice: 'giveUp' })); if (nx === st) break; st = nx; }
  const before = st.calendar.monthIndex;
  st = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  if (st.calendar.monthIndex === before) break;
  const stu = st.market.pool.filter((o) => o.kind === 'student');
  const month = ((st.calendar.monthIndex) % 12) + 1;
  const season = MARKET_OPEN_MONTHS.indexOf(month) >= 0;
  rows.push(st.calendar.monthIndex + '(第' + st.calendar.year + '年' + st.calendar.month + '月):' + stu.length + '/可招' + stu.filter((o) => canRecruitOffer(st, o)).length + (season ? '[季]' : ''));
}
say('前 96 月 在架候选人/可招人数：');
say(rows.join('  '));
const zeroSeason = rows.filter((r) => r.indexOf('[季]') >= 0 && r.indexOf(':0/') >= 0);
say('');
say('招生季中「在架候选人为 0」的月份数：' + zeroSeason.length + (zeroSeason.length ? ' → ' + zeroSeason.slice(0, 12).join(', ') : ''));
say('招生季中「可招为 0」的月份数：' + rows.filter((r) => r.indexOf('[季]') >= 0 && /可招0/.test(r)).length);
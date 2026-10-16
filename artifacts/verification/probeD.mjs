/** probeD.mjs —— 逐月轨迹诊断：次优人类打法到底在哪一步崩掉 */
import { runGame } from '../../src/systems/bots.js';
import { activeProjects, activeStudents } from '../../src/core/formulas.js';
const CFG = { hire: true, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false, usePlayerLead: false, buyFirstAuthorMax: 0, integrityFloor: 25, deferHappyFloor: 40, consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 20, hireMinAbility: 0.45, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4 };
const say = (s) => console.log(s);
for (const seed of ['t4-01']) {
  const rows = [];
  const run = runGame({ seed, strategy: CFG, months: 400, onMonth: (state, snap) => {
    rows.push({ m: snap.monthIndex, rank: snap.rankIndex, IF: snap.totalIF, fin: snap.finished, fail: snap.failed, act: snap.activeProjects, crew: snap.students, hap: snap.avgHappiness, money: snap.money, cons: snap.consumable, over: snap.overdueProjects, leaves: state.month && state.month.leavesThisMonth });
  } });
  say('seed=' + seed + ' 结局=' + (run.state.ending ? run.state.ending.id : 'none') + ' 月=' + run.state.calendar.monthIndex);
  say('月份  头衔 IF    结题 失败 在研 组员 均幸福 经费   耗材  逾期 离组');
  for (const r of rows) { if (r.m % 3 !== 0 && r.m > 24) continue; say(String(r.m).padStart(4) + '  #' + r.rank + '  ' + String(r.IF).padStart(6) + ' ' + String(r.fin).padStart(4) + ' ' + String(r.fail).padStart(4) + ' ' + String(r.act).padStart(4) + ' ' + String(r.crew).padStart(4) + ' ' + String(r.hap).padStart(5) + ' ' + String(r.money).padStart(6) + ' ' + String(r.cons).padStart(6) + ' ' + String(r.over).padStart(4) + ' ' + String(r.leaves === undefined ? '-' : r.leaves)); }
  void activeProjects; void activeStudents;
}
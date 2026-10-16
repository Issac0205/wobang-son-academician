/**
 * probeC.mjs —— t6 探针 C：T5/T6 结题门槛的可达性（必答 2 的根因定位）
 * 目的：区分「设计上够不到 T6」与「机器人买不起质谱」两种情况。
 */
import { runGame } from '../../src/systems/bots.js';
import { PROJECT_MAP, PROJECTS } from '../../src/data/projects.js';
import { INSTRUMENT_MAP } from '../../src/data/instruments.js';
import { activeProjects } from '../../src/core/formulas.js';

const SEEDS = ['t4-01', 't4-02', 't4-03', 't4-04', 't4-05', 't4-06', 't4-07', 't4-08'];
const say = (s) => console.log(s);
const f = (n, d = 1) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : String(n));
const BASE = { hire: true, hireMinAbility: 0.45, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false, usePlayerLead: false, buyFirstAuthorMax: 0, integrityFloor: 25, deferHappyFloor: 40, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4, consumeModePolicy: 'adaptive' };
const PROFILES = {
  'A 次优·耗材囤 5 个月（默认）': { ...BASE, consumableMonths: 5, moneyReserve: 20 },
  'B 次优·耗材只囤 1 个月（攒钱买设备）': { ...BASE, consumableMonths: 1, moneyReserve: 20 },
  'C 次优·耗材 1 月 + 设备优先（reserve 5）': { ...BASE, consumableMonths: 1, moneyReserve: 5 },
  'D 次优·耗材 1 月 + 只投 T5/T6（ifPerMonth 挑大本子）': { ...BASE, consumableMonths: 1, moneyReserve: 5, projectScore: 'ifPerMonth', studentsPerProject: 6, hardpointMethod: 'team' },
};
say('N6（T6 项目）仪器要求：' + JSON.stringify(PROJECT_MAP.N6.require) + '  工期 ' + PROJECT_MAP.N6.limitMonths + ' 工作量 ' + PROJECT_MAP.N6.workload + ' 钱 ' + PROJECT_MAP.N6.money);
say('N5（T5）仪器要求：' + JSON.stringify(PROJECT_MAP.N5.require) + '  工期 ' + PROJECT_MAP.N5.limitMonths + ' 工作量 ' + PROJECT_MAP.N5.workload);
say('');
for (const name of Object.keys(PROFILES)) {
  say('▸ ' + name);
  for (const seed of SEEDS) {
    let maxTierAccepted = 0, t6ReachableMonths = 0, t6Finished = 0, t5Finished = 0, minMoney = Infinity, maxMoney = 0, equipAtEnd = null;
    const run = runGame({ seed, strategy: PROFILES[name], months: 400, onMonth: (state) => {
      const equip = state.lab.equipment || {};
      const need = PROJECT_MAP.N6.require;
      const ok = Object.keys(need).every((k) => (equip[k] || 0) >= need[k]);
      if (ok) t6ReachableMonths += 1;
      minMoney = Math.min(minMoney, state.player.money);
      maxMoney = Math.max(maxMoney, state.player.money);
      equipAtEnd = Object.keys(equip).filter((k) => equip[k] > 0).map((k) => INSTRUMENT_MAP[k].name + '×' + equip[k]).join(' ');
    } });
    const s = run.state;
    t6Finished = (s.projects || []).filter((p) => p.status === 'finished' && p.tier >= 6).length;
    t5Finished = (s.projects || []).filter((p) => p.status === 'finished' && p.tier >= 5).length;
    void maxTierAccepted; void activeProjects;
    say('   ' + seed + ' 结局=' + (s.ending ? s.ending.id : 'none') + ' 头衔#' + s.player.rankIndex + ' T6结题=' + t6Finished + ' T5+结题=' + t5Finished + ' 结题总数=' + s.counters.projectsFinished
      + ' 满足 N6 仪器要求的月数=' + t6ReachableMonths + ' 经费 min/max=' + f(minMoney, 0) + '/' + f(maxMoney, 0) + ' IF=' + f(s.player.totalIF, 0));
    say('        仪器：' + equipAtEnd);
  }
}
say('');
say('▸ 参考：项目档位 → 仪器要求一览');
for (const d of PROJECTS) say('   ' + d.id + ' tier' + d.tier + ' 工作量' + d.workload + ' 工期' + d.limitMonths + ' 钱' + d.money + ' 耗材/月' + d.consumablePerMonth + ' require=' + JSON.stringify(d.require));
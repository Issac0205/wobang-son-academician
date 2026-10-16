/** probeE.mjs —— t6 探针 E：T6 项目到底有没有出现过、有没有被接、为什么结不了题 */
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
import { offerReachable } from '../../src/core/rules.js';
import { PROJECT_MAP } from '../../src/data/projects.js';
const HUMAN = { hire: true, hireMinAbility: 0.45, buyEquipment: true, hardpointMethod: 'adaptive', grabFirstAuthors: false, usePlayerLead: false, buyFirstAuthorMax: 0, integrityFloor: 25, deferHappyFloor: 40, consumeModePolicy: 'adaptive', consumableMonths: 5, moneyReserve: 20, projectScore: 'cashFirst', studentsPerProject: 4, exerciseHealthFloor: 65, teamBuildHappyFloor: 50, keepCrewFloor: 4 };
const PROFILES = { speedrun: STRATEGIES.speedrun, casual: STRATEGIES.casual, balanced: STRATEGIES.balanced, humanA: HUMAN };
const say = (s) => console.log(s);
say('N6: workload=' + PROJECT_MAP.N6.workload + ' 工期=' + PROJECT_MAP.N6.limitMonths + ' → 需要 ' + (PROJECT_MAP.N6.workload / PROJECT_MAP.N6.limitMonths).toFixed(1) + ' 进度/月');
say('N5: workload=' + PROJECT_MAP.N5.workload + ' 工期=' + PROJECT_MAP.N5.limitMonths + ' → 需要 ' + (PROJECT_MAP.N5.workload / PROJECT_MAP.N5.limitMonths).toFixed(1) + ' 进度/月');
for (const name of Object.keys(PROFILES)) {
  for (const seed of ['t4-01', 't4-03']) {
    const seen = new Map(); const accepted = new Map(); const finished = new Map();
    let maxPerProject = 0, maxDelta = 0, reach6Months = 0, tier6Offers = 0, maxRank = 1;
    const known = new Set(); const prevProg = new Map();
    const run = runGame({ seed, strategy: PROFILES[name], months: 400, onMonth: (state) => {
      maxRank = Math.max(maxRank, state.player.rankIndex);
      const pool = (state.market && state.market.pool) || [];
      const t6 = pool.filter((o) => o.kind === 'project' && o.tier >= 6);
      if (t6.length) { tier6Offers += t6.length; if (t6.some((o) => offerReachable(state, o))) reach6Months += 1; }
      for (const o of pool.filter((x) => x.kind === 'project')) {
        const k = o.tier + ':' + o.defId;
        seen.set(k, (seen.get(k) || 0) + 1);
      }
      for (const p of state.projects) {
        if (!known.has(p.instanceId)) { known.add(p.instanceId); accepted.set('T' + p.tier, (accepted.get('T' + p.tier) || 0) + 1); }
        if (p.status === 'active') {
          maxPerProject = Math.max(maxPerProject, p.assignedStudentIds.length);
          if (prevProg.has(p.instanceId)) maxDelta = Math.max(maxDelta, p.progress - prevProg.get(p.instanceId));
          prevProg.set(p.instanceId, p.progress);
        }
        if (p.status === 'finished') finished.set('T' + p.tier, (finished.get('T' + p.tier) || 0) + 1);
      }
    } });
    const s = run.state;
    say('▸ ' + name + ' / ' + seed + '：终局头衔#' + maxRank + ' 结局=' + (s.ending ? s.ending.id : 'none') + ' 结题=' + s.counters.projectsFinished);
    say('   offer 出现过的 T6 数=' + tier6Offers + '，其中「真能承接」的月数=' + reach6Months + '；单项目最大人数=' + maxPerProject + '；单月最大进度=' + maxDelta.toFixed(1));
    say('   承接（按档位）：' + JSON.stringify(Object.fromEntries([...accepted].sort())) + '  结题（按档位）：' + JSON.stringify(Object.fromEntries([...finished].sort())));
  }
}
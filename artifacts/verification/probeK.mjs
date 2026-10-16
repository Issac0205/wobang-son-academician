/** probeK.mjs — t29 独立复算：当选时推荐票数（对照 BALANCE §18.18 裁定② 区间 速通[20,27] / 中庸[35,50]） */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
import { RANKS } from '../../src/data/ranks.js';
const S = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
const say = (s) => console.log(s);
const ENG = S('D:/harness/评院士/src/core/engine.js'); const BOT = S('D:/harness/评院士/src/systems/bots.js');
say('engine.js=' + ENG + '  bots.js=' + BOT);
const fam = (n, pre) => Array.from({ length: n }, (_, i) => pre + String(i + 1).padStart(2, '0'));
for (const [name, seeds] of [['速通 speedrun（t4-01..08）', fam(8, 't4-0')], ['速通 speedrun（casual-01..08）', fam(8, 'casual-')], ['随手玩 casual（t4-01..16）', ['t4-01','t4-02','t4-03','t4-04','t4-05','t4-06','t4-07','t4-08','t4-09','t4-10','t4-11','t4-12','t4-13','t4-14','t4-15','t4-16']], ['中庸 balanced（t4-01..08）', fam(8, 't4-0')]]) {
  const strat = name.indexOf('speedrun') >= 0 ? 'speedrun' : (name.indexOf('casual') >= 0 ? 'casual' : 'balanced');
  const runs = seeds.map((seed) => runGame({ seed, strategy: STRATEGIES[strat], months: 400 }));
  const wins = runs.filter((r) => r.state.ending && r.state.ending.id === 'academician');
  const tk = wins.map((r) => r.state.player.tickets).sort((a, b) => a - b);
  const all = runs.map((r) => r.state.player.tickets).sort((a, b) => a - b);
  say(name + '：通关 ' + wins.length + '/' + seeds.length + '　当选票数 ' + (tk.length ? tk[0] + '–' + tk[tk.length - 1] + '（中位 ' + tk[Math.floor(tk.length / 2)] + '）' : '无样本') + '　全部局票数 ' + all[0] + '–' + all[all.length - 1] + '　[engine ' + ENG + ' / bots ' + BOT + ']');
}
say('');
say('§18.18 裁定② 区间：速通当选票 ∈ [20,27]；中庸 ∈ [35,50]。RECOMMEND_TICKET_REQ=' + (RANKS.filter(Boolean).length ? 3 : '?') + '（预留机制，当前非约束）。');
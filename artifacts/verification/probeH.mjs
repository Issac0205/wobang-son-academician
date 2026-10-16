/** probeH.mjs — t29 尺子纪律：同一配置在不同种子族上的通关率（验证红线口径是否稳健） */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runGame, STRATEGIES } from '../../src/systems/bots.js';
const S = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
const say = (s) => console.log(s);
const ENGINE = S('D:/harness/评院士/src/core/engine.js'); const BOTS = S('D:/harness/评院士/src/systems/bots.js');
const fam1 = Array.from({ length: 16 }, (_, i) => 't4-' + String(i + 1).padStart(2, '0'));
const fam2 = Array.from({ length: 16 }, (_, i) => 'casual-' + String(i + 1).padStart(2, '0'));
say('engine.js=' + ENGINE + '  bots.js=' + BOTS + '（以下每个百分比都绑定这两个哈希与具体种子族）');
for (const strat of ['speedrun', 'casual', 'balanced']) {
  for (const [fname, fam] of [['t4-01..16', fam1], ['casual-01..16', fam2]]) {
    let runs = [];
    try { runs = fam.map((seed) => runGame({ seed, strategy: STRATEGIES[strat], months: 400 })); } catch (err) { say(strat + ' × ' + fname + ' 抛错：' + err.message); continue; }
    const wins = runs.filter((r) => r.state.ending && r.state.ending.id === 'academician').length;
    const end = {}; for (const r of runs) { const e = r.state.ending ? r.state.ending.id : 'none'; end[e] = (end[e] || 0) + 1; }
    say(strat.padEnd(9) + ' × ' + fname.padEnd(13) + ' → ' + wins + '/' + fam.length + ' = ' + (100 * wins / fam.length).toFixed(1) + '%　' + JSON.stringify(end) + '　[engine ' + ENGINE + ' / bots ' + BOTS + ']');
  }
}
say('');
say('红线判定：balance.test.mjs:161 断言 casual 落在 [85%,95%]（16 局粒度）。');
const c1 = fam1.map((seed) => runGame({ seed, strategy: STRATEGIES.casual, months: 400 })).filter((r) => r.state.ending && r.state.ending.id === 'academician').length;
const c2 = fam2.map((seed) => runGame({ seed, strategy: STRATEGIES.casual, months: 400 })).filter((r) => r.state.ending && r.state.ending.id === 'academician').length;
const inRange = (w) => (w / 16 >= 0.85 && w / 16 <= 0.95);
say('  casual 在 t4-01..16 上 ' + c1 + '/16 = ' + (100 * c1 / 16).toFixed(1) + '% → ' + (inRange(c1) ? '区间内' : '出界（红线会红）'));
say('  casual 在 casual-01..16 上 ' + c2 + '/16 = ' + (100 * c2 / 16).toFixed(1) + '% → ' + (inRange(c2) ? '区间内' : '出界（红线会红）'));
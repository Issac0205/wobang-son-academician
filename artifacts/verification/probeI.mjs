/** probeI.mjs — t29 数据自洽：项目模板声明的 expectedIF/q1Expect/topExpect vs 按 papers.js 权重独立重算 */
import { PROJECTS } from '../../src/data/projects.js';
import { PAPER_PATTERNS, JOURNAL_IF_BASE } from '../../src/data/papers.js';
const say = (s) => console.log(s);
const pat = (id) => PAPER_PATTERNS[id] || null;
const weights = (p) => { const src = p.weights || p; const w = {}; let sum = 0; for (const k of ['top', 'q1', 'q2', 'q3', 'q4']) { const v = src[k] || 0; w[k] = v; sum += v; } return { w, sum }; };
say('| 模板 | 声明 expectedIF | 重算 | 声明 q1Expect | 重算 Σw(q1) | 声明 topExpect | 重算 Σw(top) | 判定 |');
let bad = 0;
for (const d of PROJECTS) {
  let exp = 0, q1 = 0, top = 0, unknown = 0;
  for (const pid of (d.papers || [])) {
    const key = typeof pid === 'string' ? pid : (pid && (pid.id || pid.pattern));
    const p = pat(key);
    if (!p) { unknown += 1; continue; }
    const m = weights(p);
    const avg = Object.keys(m.w).reduce((n, k) => n + m.w[k] * JOURNAL_IF_BASE[k], 0) / (m.sum || 1);
    exp += avg; q1 += m.w.q1 || 0; top += m.w.top || 0;
  }
  const ok = unknown === 0 && (Math.abs(exp - (d.expectedIF || 0)) < 0.01) && (Math.abs(q1 - (d.q1Expect || 0)) < 0.005) && (Math.abs(top - (d.topExpect || 0)) < 0.005);
  if (!ok) bad += 1;
  say('| ' + d.id + ' | ' + d.expectedIF + ' | ' + exp.toFixed(2) + ' | ' + (d.q1Expect || 0) + ' | ' + q1.toFixed(2) + ' | ' + (d.topExpect || 0) + ' | ' + top.toFixed(2) + ' | ' + (ok ? '✓' : '✗' + (unknown ? '(未知模板×' + unknown + ')' : '')) + ' |');
}
say('');
say('不自洽模板数 = ' + bad + ' / ' + PROJECTS.length);
say('带正刊权重的论文模板：' + Object.keys(PAPER_PATTERNS).filter((k) => ((PAPER_PATTERNS[k].weights || {}).top || 0) > 0).map((k) => k + '=' + PAPER_PATTERNS[k].weights.top).join(', ') + '（其余模板 top 权重为 0）');
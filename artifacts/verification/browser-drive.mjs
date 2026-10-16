/**
 * browser-drive.mjs —— t6 浏览器实测：真实 Edge(headless) + CDP，零外部依赖
 *
 * 前置：先起 `node 评院士/server.mjs`（127.0.0.1:5175）与 headless Edge（--remote-debugging-port=9333）。
 * 运行：node 评院士/artifacts/verification/browser-drive.mjs
 * 产物：browser-report.json + browser-*.png
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const CDP = 'http://127.0.0.1:9333';
const SITE = 'http://127.0.0.1:5175/';
const OUTDIR = 'D:/harness/评院士/artifacts/verification';
const DRIVER = OUTDIR + '/page-driver.js';
const MAX_STEPS = 6000;
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const report = { startedAt: new Date().toISOString(), phases: {}, errors: [], consoleIssues: [], months: [], consistency: [], screenshots: [], driverSteps: { total: 0, byKind: {} } };
const say = function (s) { console.log(s); report.log = report.log || []; report.log.push(s); };

async function pickTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(CDP + '/json/list')).json();
      const pages = list.filter(function (t) { return t.type === 'page'; });
      const page = pages.filter(function (t) { return t.url.indexOf('127.0.0.1:5175') === 0; })[0]
        || pages.filter(function (t) { return t.url === 'about:blank'; })[0] || pages[0];
      if (page && page.webSocketDebuggerUrl) return page;
    } catch (err) { void err; }
    await sleep(500);
  }
  throw new Error('CDP 目标页不可用');
}

const target = await pickTarget();
say('CDP 目标：' + target.url + ' | ' + (target.webSocketDebuggerUrl ? 'ws ok' : 'no ws'));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = function (e) { rej(new Error('ws error: ' + String(e && e.message))); }; });
let seq = 0;
const waiting = new Map();
ws.onmessage = function (ev) {
  const msg = JSON.parse(ev.data);
  if (msg.id && waiting.has(msg.id)) {
    const w = waiting.get(msg.id); waiting.delete(msg.id);
    if (msg.error) w.reject(new Error('CDP ' + w.method + ' 失败：' + JSON.stringify(msg.error)));
    else w.resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    report.errors.push({ kind: 'exception', text: d.text + ' ' + ((d.exception && d.exception.description) || ''), line: d.lineNumber });
  } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    report.errors.push({ kind: 'log', text: msg.params.entry.text, url: msg.params.entry.url });
  } else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
    report.consoleIssues.push({ type: msg.params.type, text: msg.params.args.map(function (a) { return a.value !== undefined ? a.value : (a.description || ''); }).join(' ').slice(0, 300) });
  }
};
function send(method, params) {
  const myId = ++seq;
  return new Promise(function (resolve, reject) {
    waiting.set(myId, { resolve: resolve, reject: reject, method: method });
    ws.send(JSON.stringify({ id: myId, method: method, params: params || {} }));
    setTimeout(function () { if (waiting.has(myId)) { waiting.delete(myId); reject(new Error('CDP 超时：' + method)); } }, 60000);
  });
}
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面异常：' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}
async function ready() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const ok = await ev("document.readyState === 'complete' && !!document.querySelector('#hud-money') && document.querySelector('#hud-money').textContent.trim().length > 0 && !!window.__GAME__");
      if (ok) return true;
    } catch (err) { void err; }
    await sleep(250);
  }
  return false;
}
async function shot(name) {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const p = OUTDIR + '/browser-' + name + '.png';
    writeFileSync(p, Buffer.from(r.data, 'base64'));
    report.screenshots.push({ name: name, path: p, bytes: Buffer.from(r.data, 'base64').length });
    say('  截图 → ' + p);
  } catch (err) { say('  截图失败：' + String(err.message)); }
}

mkdirSync(OUTDIR, { recursive: true });
await send('Page.enable', {});
await send('Runtime.enable', {});
await send('Log.enable', {});

/* ── 阶段 0：清存档 → 全新一局 ── */
await send('Page.navigate', { url: SITE });
await ready();
await ev('localStorage.clear(); 1');
await send('Page.reload', {});
await sleep(1200);
if (!(await ready())) throw new Error('页面未就绪');
await ev(readFileSync(DRIVER, 'utf8'));
report.phases.boot = await ev('__T6.snap()');
say('【阶段 0】全新一局：' + JSON.stringify(report.phases.boot));
await shot('00-start');
const c0 = await ev('__T6.consistency()');
report.consistency.push({ when: 'boot', rows: c0 });
say('【阶段 0】断链核对：' + c0.filter(function (r) { return r.ok; }).length + '/' + c0.length + ' 通过' + (c0.filter(function (r) { return !r.ok; }).length ? ' → 失败项：' + JSON.stringify(c0.filter(function (r) { return !r.ok; })) : ''));

/* ── 阶段 1：真实点击驱动，一步一个动作 ── */
const milestones = { firstAccept: false, firstHardpoint: false, firstFinish: false, firstPromote: false, firstRank6: false, firstOverdue: false, firstTop: false, firstTicket: false, firstElection: false, firstStall6: false, firstConsumableZero: false };
let lastFinished = 0, lastMonthSeen = -1, stallRun = 0, stallNote = '', blockedRun = 0;
let steps = 0;
let ending = null;
while (steps < MAX_STEPS) {
  steps += 1;
  let rec = null;
  try { rec = await ev('__T6.step()'); } catch (err) { report.errors.push({ kind: 'driver', text: String(err.message) }); break; }
  const kind = rec.advanced ? 'next-month' : (rec.modal ? 'modal' : (rec.acceptedOk ? 'accept' : (rec.hardpoint ? 'hardpoint' : (rec.hired ? 'hire' : (rec.equipment ? 'equipment' : (rec.consumed ? 'consumable' : (rec.action ? 'action' : 'other')))))));
  report.driverSteps.total += 1;
  report.driverSteps.byKind[kind] = (report.driverSteps.byKind[kind] || 0) + 1;
  if (rec.acceptedOk && !milestones.firstAccept) { milestones.firstAccept = true; report.phases.firstAccept = { step: steps, text: rec.accepted }; say('【阶段 1】首次承接项目（第 ' + steps + ' 步）：' + rec.accepted); }
  if (rec.hardpoint && !milestones.firstHardpoint) { milestones.firstHardpoint = true; report.phases.firstHardpoint = { step: steps, method: rec.hardpoint }; say('【阶段 1】首次用「多人攻坚」处理难点（第 ' + steps + ' 步）'); await shot('10-hardpoint'); }
  if (!rec.changed) {
    blockedRun += 1;
    if (blockedRun === 1) report.phases.firstBlocked = { step: steps, rec: rec, snap: await ev('__T6.snap()') };
    if (blockedRun === 31) { say('【阶段 1】⚠ 连续 30 步点击都没能让状态变化，最后一步=' + JSON.stringify(rec) + ' → 停止驱动'); await shot('92-blocked'); }
    if (blockedRun > 32) break;
  } else { blockedRun = 0; }
  if (rec.advanced) {
    const s = await ev('__T6.snap()');
    report.months.push(s);
    if (s.monthIndex !== lastMonthSeen) { lastMonthSeen = s.monthIndex; }
    if (s.finished > lastFinished) { lastFinished = s.finished; if (!milestones.firstFinish) { milestones.firstFinish = true; report.phases.firstFinish = s; say('【阶段 1】首个项目结题：第 ' + s.monthIndex + ' 月，IF=' + s.totalIF + '，一区=' + s.q1); await shot('20-first-finish'); } }
    if (s.rankIndex >= 2 && !milestones.firstPromote) { milestones.firstPromote = true; report.phases.firstPromote = s; say('【阶段 1】首次晋升：第 ' + s.monthIndex + ' 月 → ' + s.rank + '（IF ' + s.totalIF + '）'); await shot('30-first-promote'); }
    if (s.rankIndex >= 6 && !milestones.firstRank6) { milestones.firstRank6 = true; report.phases.firstRank6 = s; say('【阶段 1】到达 ' + s.rank + '：第 ' + s.monthIndex + ' 月'); await shot('40-rank6'); }
    if (s.q1 >= 2 && !milestones.firstQ1Two) { milestones.firstQ1Two = true; report.phases.firstQ1Two = s; say('【阶段 1】一区论文达到 2 篇（晋升研究员的门槛）：第 ' + s.monthIndex + ' 月，IF=' + s.totalIF + ' 一区=' + s.q1); }
    if (s.top >= 1 && !milestones.firstTop) { milestones.firstTop = true; report.phases.firstTop = s; say('【阶段 1】首篇正刊：第 ' + s.monthIndex + ' 月（正刊 ' + s.top + '）'); }
    if (s.tickets >= 1 && !milestones.firstTicket) { milestones.firstTicket = true; report.phases.firstTicket = s; say('【阶段 1】首张推荐票：第 ' + s.monthIndex + ' 月（票 ' + s.tickets + '）'); }
    if (s.consumable <= 0 && !milestones.firstConsumableZero) { milestones.firstConsumableZero = true; report.phases.firstConsumableZero = s; say('【阶段 1】耗材见底：第 ' + s.monthIndex + ' 月（耗材 ' + s.consumable + '）'); }
    if (s.consumable < 0) report.phases.negativeConsumable = report.phases.negativeConsumable || s;
    const prev = report.months[report.months.length - 2];
    if (prev && s.progressSum <= prev.progressSum && s.finished <= prev.finished && s.totalIF <= prev.totalIF) { stallRun += 1; } else { stallRun = 0; }
    if (stallRun >= 6 && !milestones.firstStall6) { milestones.firstStall6 = true; stallNote = '第 ' + (s.monthIndex - 5) + '–' + s.monthIndex + ' 月连续 ' + stallRun + ' 月 IF/结题/在研数都没变（click-driver 打法）'; report.phases.firstStall6 = { at: s.monthIndex, note: stallNote, snap: s }; say('【阶段 1】⚑ ' + stallNote); }
    if (s.monthIndex % 12 === 0) {
      const sweep = ((s.monthIndex / 12 - 1) % 4);
      const chkTab = ['lab', 'projects', 'market', 'actions'][sweep < 0 ? 0 : sweep];
      const rows = await ev('__T6.consistency(' + JSON.stringify(chkTab) + ')');
      const bad = rows.filter(function (r) { return !r.ok; });
      report.consistency.push({ when: 'month' + s.monthIndex, tab: chkTab, rows: rows });
      say('【阶段 1】第 ' + s.monthIndex + ' 月：' + s.rank + ' IF=' + s.totalIF + ' 一区=' + s.q1 + ' 正刊=' + s.top + ' 票=' + s.tickets + ' 结题=' + s.finished + ' 在研=' + s.active + ' 经费=' + s.money + ' 耗材=' + s.consumable + ' 诚信=' + s.integrity + ' 组员=' + s.crew + ' 均幸福=' + s.happy + ' | 断链核对 ' + (rows.length - bad.length) + '/' + rows.length + (bad.length ? ' ❌' + JSON.stringify(bad) : ''));
    }
    if (s.ending) { ending = s; break; }
    if (s.monthIndex >= 384) break;
  }
}
report.phases.final = await ev('__T6.snap()');
// 收尾：把四个面板各切出来核对一遍（保证 DOM 新鲜）
for (const tabId of ['lab', 'projects', 'market', 'actions']) {
  const rows = await ev('__T6.consistency(' + JSON.stringify(tabId) + ')');
  report.consistency.push({ when: 'final', tab: tabId, rows: rows });
  const bad = rows.filter(function (r) { return !r.ok; });
  say('【阶段 1】收尾核对 ' + tabId + '：' + (rows.length - bad.length) + '/' + rows.length + (bad.length ? ' ❌' + JSON.stringify(bad) : ''));
}
report.phases.milestones = milestones;
say('【阶段 1】结束：共 ' + report.driverSteps.total + ' 步，' + JSON.stringify(report.driverSteps.byKind));
say('【阶段 1】终局：' + JSON.stringify(report.phases.final));
await shot('90-final');
if (report.phases.final.modal) await shot('91-final-modal');

/* ── 阶段 2：存档回读 ── */
const info = await ev('__T6.saveInfo()');
report.phases.save = info;
say('【阶段 2】localStorage：' + JSON.stringify(info));
const before = report.phases.final;
await send('Page.reload', {});
await sleep(1500);
await ready();
await ev(readFileSync(DRIVER, 'utf8'));
const after = await ev('__T6.snap()');
report.phases.afterReload = after;
report.phases.reloadOk = after.monthIndex === before.monthIndex && after.money === before.money && after.finished === before.finished;
say('【阶段 2】刷新后：' + JSON.stringify(after));
say('【阶段 2】存档回读一致：' + report.phases.reloadOk + '（刷新前 monthIndex=' + before.monthIndex + ' / 刷新后 ' + after.monthIndex + '）');

/* ── 阶段 3：控制台异常汇总 ── */
report.phases.errorCount = report.errors.length;
report.phases.consoleIssueCount = report.consoleIssues.length;
say('【阶段 3】JS 异常 ' + report.errors.length + ' 条，console warn/error ' + report.consoleIssues.length + ' 条');
if (report.errors.length) say('   ' + JSON.stringify(report.errors.slice(0, 5)));
if (report.consoleIssues.length) say('   ' + JSON.stringify(report.consoleIssues.slice(0, 5)));

report.finishedAt = new Date().toISOString();
writeFileSync(OUTDIR + '/browser-report.json', JSON.stringify(report, null, 2));
say('报告 → ' + OUTDIR + '/browser-report.json');
ws.close();
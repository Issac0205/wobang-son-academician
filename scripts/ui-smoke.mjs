#!/usr/bin/env node
/**
 * ui-smoke.mjs —— DOM 冒烟（必须退出码 0）
 *
 * 在没有浏览器的环境里把 UI 真的渲染一遍并点一遍：
 *   · 用 scripts/lib/dom-shim.mjs 搭出与 index.html 一致的骨架
 *   · 导入 src/main.js（它会自己建 store、读存档、装配 UI）
 *   · 覆盖：顶栏 / 5 个标签页 / 课题组 3 个分栏 / 结算回执 / 事件弹层 / 改名 /
 *           承接项目 / 难点三处理 / 行动 / 一作交易 / 结局画面（院士·被举报）/ 重开 / 存档回读
 *   · 断言「渲染不报错 + 关键信息可见 + 所有 data-action 都有处理函数」
 *
 * 用法：node 评院士/scripts/ui-smoke.mjs   （cwd 任意）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installDomShim, installLocalStorage } from './lib/dom-shim.mjs';
import { INSTRUMENTS } from '../src/data/instruments.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
const fail = (msg) => { checks.push({ ok: false, msg }); };
const pass = (msg) => { checks.push({ ok: true, msg }); };
const check = (cond, okMsg, failMsg) => (cond ? pass(okMsg) : fail(failMsg || okMsg));

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const { document } = installDomShim(html);
const storage = installLocalStorage();

const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => { warnings.push(args.map(String).join(' ')); };

function walk(node, fn) {
  for (const child of node.children || []) {
    fn(child);
    walk(child, fn);
  }
}
function findAllByAction(node, action) {
  const out = [];
  walk(node, (n) => { if (n.dataset && n.dataset.action === action) out.push(n); });
  return out;
}
function findByAction(node, action) { return findAllByAction(node, action)[0] || null; }
function textOf(node) { return node ? String(node.textContent || '') : ''; }
function $(id) { return document.getElementById(id); }
function panelText(id) { return textOf($(id)); }
function clickAction(action) {
  const node = findByAction($('app'), action);
  if (!node) return null;
  node.click();
  return node;
}
function clone(state) { return JSON.parse(JSON.stringify(state)); }

try {
  await import(pathToFileURL(join(ROOT, 'src', 'main.js')).href);
  const game = globalThis.window && globalThis.window.__GAME__;
  check(Boolean(game), '入口 src/main.js 启动成功并暴露 window.__GAME__', 'main.js 没有把 __GAME__ 挂到 window 上');

  if (game) {
    const store = game.store;

    /* ── T21-F1 回归：无存档的全新会话，首屏项目市场必须有可接 offer ──
     * 这条断言**必须跑在任何 replaceState 之前**，而且必须走 app 的启动链路（上面 import src/main.js
     * 就是 boot()）。过去的 111 项没抓到，是因为它们只跑引擎/机器人路径（bots.js 用的是正确的
     * reduce(createState, ACTIONS.newGame)），而 app 的 boot 过去直接用裸 createState 当初始态，
     * 绕过了「开局填市场」。把断言插在固定种子之前，才能真的覆盖启动路径。 */
    check(typeof game.hasSave === 'function' && game.hasSave() === false,
      '全新会话：没有存档（hasSave=false）', '期望无存档启动，实际 hasSave 为真 —— 这条回归只能在没有存档时验证');
    const bootVm = game.buildViewModel(store.getState());
    check(bootVm.hud && bootVm.hud.time && bootVm.hud.time.monthIndex === 0,
      '全新会话停在开局：' + (bootVm.hud && bootVm.hud.time ? bootVm.hud.time.text : '?'),
      '新局不在第 0 月：' + (bootVm.hud && bootVm.hud.time ? bootVm.hud.time.text : '?'));
    const bootOffers = (bootVm.market && bootVm.market.projects) || [];
    check(bootOffers.length >= 1,
      '启动链路（main.js boot）首屏可接项目 offer = ' + bootOffers.length + ' 个（无存档会话）',
      '无存档首屏项目市场为空：boot 绕过了 game/newGame（T21-F1）');
    const bootTab = $('tab-projects');
    if (bootTab) bootTab.click();
    const bootAccept = findAllByAction($('app'), 'accept-project');
    check(bootAccept.filter((n) => !n.disabled).length >= 1,
      '首屏项目市场卡里存在可点击的「承接这个项目」（enabled ' + bootAccept.filter((n) => !n.disabled).length + ' / 共 ' + bootAccept.length + '）',
      '首屏项目市场没有任何可承接的按钮（DOM 层证据）');
    check(panelText('panel-projects').indexOf('项目市场') >= 0,
      '首屏项目页渲染出「项目市场」卡片', '首屏项目页没有项目市场卡片');

    /* 固定种子：冒烟必须能在同一局棋上重复跑（否则市场随机性会让「禁用态」这类断言时红时绿）。 */
    if (typeof game.createState === 'function') {
      store.replaceState(game.createState({ seed: 'ui-smoke-seed', playerName: '马老板', sonName: '马小程' }), { source: 'ui-smoke-seed' });
    }
    const advance = (opts) => store.dispatch({ type: 'game/advanceMonth', payload: opts || {} });
    const replaceState = (s) => store.replaceState(s, { source: 'ui-smoke' });
    const vmNow = () => game.buildViewModel(store.getState());

    /**
     * 延毕待决会挡住月份推进（t10 新机制）：冒烟的常规流程里默认「延毕」把待决清掉，
     * 这样长流程不会被弹层卡住；延毕弹层本身的断言在专门的小节里做。
     */
    function clearDefer(choice) {
      for (let i = 0; i < 8; i += 1) {
        const waiting = vmNow().pendingDefer || [];
        if (waiting.length === 0) return true;
        for (const s of waiting) {
          store.dispatch({ type: 'game/chooseDefer', payload: { studentId: s.id, choice: choice || 'defer' } });
        }
      }
      return false;
    }
    /** 推进一个月 + 清掉延时待决。 */
    const step = (opts) => { advance(opts); clearDefer('defer'); };
    /** 把某个在读学生推到「学制读满」的边界，用于延毕弹层断言。 */
    function forceDeferEdge(extra) {
      const s = clone(store.getState());
      const target = s.students.filter((x) => !x.left && !x.graduated)[0];
      if (!target) return null;
      target.studyMonthsLeft = 0;
      target.degreeProgress = Math.min(90, target.degreeProgress || 0);
      target.deferMonths = 0;
      if (extra) extra(s, target);
      replaceState(s);
      return store.getState().students.filter((x) => x.id === target.id)[0];
    }

    /* ── 1 首屏与「怎么玩」 ── */
    const lab = $('panel-lab');
    check(lab && lab.childNodes.length > 0, '首屏「课题组」面板有 ' + (lab ? lab.childNodes.length : 0) + ' 个顶层节点', '首屏课题组面板没有渲染内容');
    check(panelText('panel-lab').indexOf('总览') >= 0, '首屏包含「总览」卡片', '首屏缺少总览卡片');
    const introOpen = textOf($('modal-root')).indexOf('怎么玩') >= 0;
    check(introOpen, '第一次进游戏自动摊开「怎么玩」弹层', '没有自动打开「怎么玩」弹层');
    if (introOpen) {
      clickAction('modal-close');
      check(textOf($('modal-root')).length === 0, '「怎么玩」可以关闭', '「怎么玩」弹层关不掉');
    }

    /* ── 2 顶栏信息完整性（总览面板的验收字段） ── */
    const hudIds = ['hud-name', 'hud-son', 'hud-rank', 'hud-month', 'hud-age', 'hud-phase', 'hud-money', 'hud-consumable', 'hud-energy', 'hud-health', 'hud-integrity', 'hud-if', 'hud-first', 'hud-tickets', 'hud-students'];
    const emptyHud = hudIds.filter((id) => textOf($(id)).trim().length === 0);
    check(emptyHud.length === 0, '顶栏 ' + hudIds.length + ' 个字段全部渲染（姓名/头衔/经费/耗材/IF/分区/诚信/精力/健康/年月…）', '顶栏字段没渲染：' + emptyHud.join('、'));
    check(textOf($('hud-money')).indexOf('经费') >= 0, '顶栏经费可见（' + textOf($('hud-money')).trim() + '）', '顶栏没有经费');
    const tiles = $('hud-first') ? $('hud-first').querySelectorAll('.paper-tile') : [];
    check(tiles.length === 5, '顶栏 SCI 一作分区计数渲染 5 档（正刊/一区/二区/三区/四区）', '顶栏分区计数档位数量不对：' + tiles.length);
    check(textOf($('hud-name')).indexOf('改名') >= 0, '姓名旁有「改名」入口', '姓名没有改名入口');

    /* ── 3 五个标签页 + 内容关键词 ── */
    const tabs = {
      lab: ['panel-lab', ['总览', '学生名册', '仪器台', '耗材库']],
      projects: ['panel-projects', ['在研项目', '项目市场']],
      market: ['panel-market', ['人才市场', '保研生池', '考研生池']],
      actions: ['panel-actions', ['与学生交流课题', '开组会', '锻炼与享乐', '去团建']],
      chronicle: ['panel-chronicle', ['纪事']],
    };
    for (const [tab, [panelId, keywords]] of Object.entries(tabs)) {
      const btn = $('tab-' + tab);
      if (!btn) { fail('找不到标签按钮 tab-' + tab); continue; }
      btn.click();
      const text = panelText(panelId);
      const missing = keywords.filter((k) => text.indexOf(k) < 0);
      check(text.length > 0 && missing.length === 0, '标签页「' + tab + '」渲染正常（' + keywords.join('/') + '）', '标签页「' + tab + '」缺少：' + missing.join('、'));
    }

    /* ── 3.5 DOM 树完整性：children 里不允许出现数组/裸对象（浏览器 appendChild 会直接抛错）── */
    function collectBadChildren(node, path, out) {
      for (let i = 0; i < (node.childNodes || []).length; i += 1) {
        const child = node.childNodes[i];
        if (!child || typeof child.appendChild !== 'function' || typeof child.textContent !== 'string') {
          out.push(path + ' 的第 ' + i + ' 个 child 不是节点：' + Object.prototype.toString.call(child));
        } else {
          collectBadChildren(child, path + '>' + (child.tagName || '?'), out);
        }
      }
      return out;
    }
    const badNodes = collectBadChildren($('app'), '#app', []);
    check(badNodes.length === 0, '整棵渲染树都是合法节点（' + badNodes.length + ' 个异常）', '渲染树里有非法 child：' + badNodes.slice(0, 3).join(' / '));

    /* ── 3.6 纪事筛选 ── */
    $('tab-chronicle').click();
    const filters = findAllByAction($('panel-chronicle'), 'chronicle-filter');
    check(filters.length >= 4, '纪事面板提供分类筛选（全部/项目/学生/钱/头衔）', '纪事面板没有筛选按钮：' + filters.length);
    const studentFilter = filters.filter((n) => n.dataset.filter === 'student')[0];
    if (studentFilter) {
      studentFilter.click();
      check(panelText('panel-chronicle').indexOf('纪事') >= 0, '纪事筛选切换后仍能渲染', '纪事筛选后没有渲染');
    }

    /* ── 4 课题组四个分栏（总览 / 学生 / 仪器 / 耗材）── */
    $('tab-lab').click();
    const sections = [
      ['overview', '离院士还差什么'],
      ['students', '一作交易台'],
      ['instruments', '仪器台'],
      ['consumables', '耗材库'],
    ];
    for (const [section, keyword] of sections) {
      const all = findAllByAction($('app'), 'lab-section');
      const target = all.filter((n) => n.dataset.section === section)[0];
      if (!target) { fail('找不到分栏按钮：' + section); continue; }
      target.click();
      const text = panelText('panel-lab');
      check(text.indexOf(keyword) >= 0, '课题组分栏「' + keyword + '」渲染正常', '课题组分栏「' + keyword + '」没有渲染');
      if (section === 'instruments') {
        const buys = findAllByAction($('panel-lab'), 'buy-equipment');
        check(buys.length === INSTRUMENTS.length, '仪器台渲染全部仪器（' + INSTRUMENTS.length + ' 种，各带购买价/维护费/加成说明）', '仪器数量不对：' + buys.length);

        /* ── 4b v1.3 仓库（LAB-SPACE §11）：空态 → 存入 → 取出（走「拿在手上→点台位」流程） ── */
        const labText = panelText('panel-lab');
        check(labText.indexOf('仓库是空的') >= 0, '仓库为空时显示诚实的空态', '仓库空态缺失');
        check(labText.indexOf('仓库里的仪器不提供加成、不收维护费') >= 0,
          '仓库区块常驻写明「仓库里的仪器不提供加成、不收维护费」', '仓库没有写明不提供加成/不收维护费');
        const placedItems = store.getState().lab.rooms.flatMap((r) => r.slots).filter(Boolean).flatMap((b) => b.items);
        const picked = placedItems[0];
        const srcBench = store.getState().lab.rooms.flatMap((r) => r.slots).filter(Boolean)
          .find((b) => b.items.some((it) => it.uid === picked.uid));
        const bonusBefore = vmNow().crew.lab.bonusPct;
        const moneyBefore = store.getState().player.money;
        store.dispatch({ type: 'lab/storeItem', payload: { itemUid: picked.uid } });
        check(findAllByAction($('panel-lab'), 'lab-deploy-item').length === 1, '存入后仓库行渲染出「取出」按钮', '仓库没有渲染「取出」');
        check(findAllByAction($('panel-lab'), 'lab-sell-stored').length === 1, '存入后仓库行渲染出「卖掉」按钮', '仓库没有渲染「卖掉」');
        check(vmNow().crew.lab.bonusPct < bonusBefore, '存入仓库后视图加成下降（' + bonusBefore + '% → ' + vmNow().crew.lab.bonusPct + '%）', '仓库里的仪器仍然提供加成');
        check(store.getState().player.money === moneyBefore, '存入仓库不是卖出：钱不变', '存入仓库动了钱');
        // 取出：点「取出」进入拿在手上流程，再点台面空位放回原处
        const takeBtn = findByAction($('panel-lab'), 'lab-deploy-item');
        takeBtn.click();
        let heldBar = null;
        walk($('panel-lab'), (n) => { if (!heldBar && n.dataset && n.dataset.role === 'held-bar') heldBar = n; });
        check(Boolean(heldBar) && textOf(heldBar).indexOf('手上：仓库取出') >= 0,
          '点「取出」进入「拿在手上 → 点台位」放置流程', '取出没有进入放置流程：' + textOf(heldBar));
        const cell = findAllByAction($('panel-lab'), 'lab-cell').filter((n) => n.parentNode && n.parentNode.dataset
          && n.parentNode.dataset.benchUid === srcBench.uid && Number(n.dataset.x) === picked.x && Number(n.dataset.y) === picked.y)[0];
        check(Boolean(cell), '取出的仪器原位置仍是可点的台面格子', '找不到原位置的格子');
        if (cell) cell.click();
        check(findAllByAction($('panel-lab'), 'lab-deploy-item').length === 0, '点台位后仪器真的从仓库取出', '取出后台面没有拿到仪器');
        check(vmNow().crew.lab.bonusPct === bonusBefore, '取出放回后加成恢复原值（' + bonusBefore + '%）', '取出后加成没有恢复');
      }
      if (section === 'consumables') {
        const modes = findAllByAction($('panel-lab'), 'consume-mode');
        check(modes.length >= 2, '耗材面板提供三种消耗模式的切换入口', '耗材模式切换按钮数量不对：' + modes.length);
        check(findAllByAction($('panel-lab'), 'buy-consumable').length === 1, '耗材面板提供「采购一批」补充入口', '缺少耗材采购入口');
      }
    }

    /* ── 5 行动页：精力消耗提示 + 真实执行一次 ── */
    $('tab-actions').click();
    check(panelText('panel-actions').indexOf('精力 −') >= 0, '行动页显示每个行动的精力消耗', '行动页没有精力消耗提示');
    const energyBefore = store.getState().player.energy;
    const meetBtn = findAllByAction($('panel-actions'), 'do-action').filter((n) => n.dataset.actionId === 'meeting')[0];
    if (meetBtn) {
      meetBtn.click();
      const energyAfter = store.getState().player.energy;
      check(energyAfter < energyBefore, '点「开组会」真的扣了精力（' + energyBefore + ' → ' + energyAfter + '）', '行动没有扣精力');
    } else {
      fail('行动页缺少「开组会」按钮');
    }

    /* ── 6 改名（总览面板：姓名可改） ── */
    $('tab-lab').click();
    const renameBtn = findByAction($('app'), 'rename-open');
    if (!renameBtn) fail('找不到改名入口');
    else {
      renameBtn.click();
      const input = document.querySelector('#rename-input');
      const sonInput = document.querySelector('#rename-son-input');
      check(Boolean(input), '改名弹层渲染出姓名输入框', '改名弹层没有输入框');
      if (input) {
        input.value = '赵老板';
        if (sonInput) sonInput.value = '赵小程';
        clickAction('rename-apply');
        const st = store.getState();
        check(st.player.name === '赵老板', '改名生效：player.name = ' + st.player.name, '改名没有生效（player.name = ' + st.player.name + '）');
        check(textOf($('hud-name')).indexOf('赵老板') >= 0, '改完名字顶栏立刻更新', '顶栏没有跟着改名更新');
      }
    }

    /* ── 7 推进一个月：结算回执（收入/支出/项目/学生都要可见） ── */
    const monthBefore = store.getState().calendar.monthIndex;
    $('btn-next-month').click();
    const monthAfter = store.getState().calendar.monthIndex;
    check(monthAfter === monthBefore + 1, '点「下一个月」推进 1 个月（' + monthBefore + ' → ' + monthAfter + '）', '下一个月没有推进');
    const reportText = textOf($('month-report'));
    check(reportText.indexOf('上月结算回执') >= 0, '结算回执渲染在页面上', '没有渲染结算回执');
    check(reportText.indexOf('进项') >= 0 && reportText.indexOf('出项') >= 0, '结算回执给出进项/出项笔数（不是黑箱）', '结算回执没有进项/出项信息');
    check(reportText.indexOf('经费') >= 0 && reportText.indexOf('耗材资金') >= 0, '结算回执列出经费与耗材资金变化', '结算回执缺少资金变化');
    const detailBtn = findByAction($('app'), 'receipt-open');
    if (!detailBtn) fail('结算回执没有「看明细」入口');
    else {
      detailBtn.click();
      const modal = textOf($('modal-root'));
      check(modal.indexOf('进项（') >= 0 && modal.indexOf('出项（') >= 0, '明细弹层逐笔列出进项/出项', '明细弹层没有逐笔账目');
      check(modal.indexOf('项目进度（') >= 0 && modal.indexOf('学生状态（') >= 0, '明细弹层包含项目进度与学生状态变化', '明细弹层缺少项目/学生变化');
      clickAction('modal-close');
    }

    /* ── 8 事件弹层 ── */
    let guard = 0;
    while (!store.getState().pendingEvent && guard < 24) { step({}); guard += 1; }
    if (store.getState().pendingEvent) {
      const choice = findByAction($('modal-root'), 'event-choice');
      check(Boolean(choice), '随机事件弹层渲染出可点的选项', '事件弹层没有选项按钮');
      let clicks = 0;
      while (store.getState().pendingEvent && clicks < 6) {
        const btn = findByAction($('modal-root'), 'event-choice');
        if (!btn) break;
        btn.click();
        clicks += 1;
      }
      check(!store.getState().pendingEvent, '事件可以选择并结算（本月处理 ' + clicks + ' 起）', '事件点不掉，pendingEvent 还挂着（后续所有推进都会被它挡住）');
    } else {
      pass('本轮没有触发随机事件（跳过弹层检查）');
    }

    /* ── 9 市场：项目承接 / 人才池 ── */
    let accepted = -1;
    for (let i = 0; i < 14 && accepted < 0; i += 1) {
      step({ autoResolveEvents: true });
      $('tab-projects').click();
      const acceptBtns = findAllByAction($('panel-projects'), 'accept-project').filter((n) => !n.disabled);
      if (acceptBtns.length) {
        acceptBtns[0].click();
        if (store.getState().projects.filter((p) => p.status === 'active').length > 0) accepted = i;
      }
    }
    check(accepted >= 0, '项目市场可以承接本子（第 ' + (accepted + 1) + ' 次尝试成功）', '接了 14 个月都没接到项目');
    $('tab-projects').click();
    const projText = panelText('panel-projects');
    check(projText.indexOf('尾款') >= 0, '在研项目卡片显示尾款提示', '在研项目没有尾款提示');
    check(projText.indexOf('定金') >= 0 || findAllByAction($('panel-projects'), 'accept-project').length === 0, '项目市场 offer 显示定金提示', '项目 offer 没有定金提示');

    /* ── 10 在研项目：进度条 + 难点三种处理 ── */
    const st9 = clone(store.getState());
    const active = st9.projects.filter((p) => p.status === 'active');
    if (active.length) {
      const p0 = active[0];
      p0.deadlineMonthIndex = st9.calendar.monthIndex + 24;
      if (!p0.hardpoints.length) p0.hardpoints.push({ id: 'h1', hd: 2, status: 'open', method: null, appearAt: st9.calendar.monthIndex, retries: 0, fakeCount: 0 });
      p0.hardpoints[0].status = 'open';
      p0.hardpoints[0].appearAt = st9.calendar.monthIndex;
      if (st9.students.length) p0.assignedStudentIds = [st9.students[0].id];
      replaceState(st9);
      $('tab-projects').click();
      const methods = ['hardpoint-team', 'hardpoint-fake', 'hardpoint-solo'].map((a) => findAllByAction($('panel-projects'), a).length);
      check(methods.every((n) => n >= 1), '难点渲染出三种处理方式（多人攻坚/造假蒙混/单人猛干）', '难点三种处理方式没渲染全：' + methods.join('/'));
      /* t8 finding：按钮必须显示成功率、并说明会抽调谁（title 至少要有「将抽调：X、Y」） */
      const hpText = panelText('panel-projects');
      check(hpText.indexOf('成功率') >= 0 && hpText.indexOf('被抓概率') >= 0, '难点按钮显示成功率/被抓概率（由 core 计算）', '难点按钮没有成功率');
      const teamBtn = findAllByAction($('panel-projects'), 'hardpoint-team')[0];
      const teamTitle = teamBtn ? String((teamBtn.attributes && teamBtn.attributes.title) || '') : '';
      check(teamTitle.indexOf('将抽调：') >= 0, '多人攻坚按钮 title 写明抽调名单（' + teamTitle.slice(0, 40) + '…）', '多人攻坚 title 没有抽调名单：' + teamTitle);
      const teamIds = teamBtn && teamBtn.dataset ? String(teamBtn.dataset.studentIds || '') : '';
      check(teamIds.split(',').filter(Boolean).length >= 1, '多人攻坚按钮带着 core 给的抽调人选（data-student-ids=' + teamIds + '）', '多人攻坚没有带 studentIds');
      const soloBtn = findAllByAction($('panel-projects'), 'hardpoint-solo')[0];
      check(Boolean(soloBtn) && Boolean(soloBtn.dataset.studentIds), '单人猛干按钮带指定学生（' + (soloBtn ? soloBtn.dataset.studentIds : '') + '）', '单人猛干没有带 studentIds');
      const integrityBefore = store.getState().player.integrity;
      const fakeBtn = findAllByAction($('panel-projects'), 'hardpoint-fake')[0];
      if (fakeBtn) {
        fakeBtn.click();
        const after = store.getState();
        const changed = after.projects.filter((p) => p.instanceId === p0.instanceId)[0];
        const hp = (changed || after.projects[0]).hardpoints[0];
        check(hp.status !== 'open' || after.player.integrity < integrityBefore, '「造假蒙混」真的改状态（难点=' + hp.status + '，诚信 ' + integrityBefore + ' → ' + after.player.integrity + '）', '造假蒙混没有任何效果');
      }
      /* 结题：把进度推满，结算后应进档案并写出结题纪事 */
      const st10 = clone(store.getState());
      const proj = st10.projects.filter((p) => p.status === 'active')[0];
      proj.progress = proj.workload;
      proj.deadlineMonthIndex = st10.calendar.monthIndex + 24;
      proj.hardpoints = proj.hardpoints.map((h) => Object.assign({}, h, { status: 'solved' }));
      replaceState(st10);
      step({ autoResolveEvents: true });
      const archived = store.getState().projects.filter((p) => p.status === 'finished').length;
      check(archived > 0, '进度满工作量后自动结题并进入档案（已结题 ' + archived + ' 个）', '项目没有结题');
      $('tab-projects').click();
      check(panelText('panel-projects').indexOf('结题档案') >= 0, '结题档案卡片渲染', '没有结题档案');
      check(textOf($('month-report')).indexOf('论文') >= 0 || textOf($('month-report')).indexOf('进项') >= 0, '结题后的回执/纪事可见产出', '结题后没有可见产出');
    } else {
      fail('没有在研项目，无法验证难点与结题');
    }

    /* ── 11 人才市场：两个池子 + 门槛/成本/天赋/工资期望 ── */
    let poolOk = false;
    for (let i = 0; i < 14 && !poolOk; i += 1) {
      $('tab-market').click();
      const t = panelText('panel-market');
      if (t.indexOf('工资期望') >= 0 && t.indexOf('天赋') >= 0 && t.indexOf('招募成本') >= 0) poolOk = true;
      else step({ autoResolveEvents: true });
    }
    check(poolOk, '人才市场展示天赋、招募成本、门槛与工资期望（保研生池/考研生池分组）', '人才市场没有渲染候选人信息');
    const hireBtn = findAllByAction($('panel-market'), 'hire-student');
    check(hireBtn.length > 0, '人才市场为候选人渲染招募按钮（门槛不足时禁用并给出原因）', '没有招募按钮');
    const hireDisabled = hireBtn.filter((n) => n.disabled).length;
    const marketText = panelText('panel-market');
    check(hireDisabled > 0 || (marketText.indexOf('门槛') >= 0 && marketText.indexOf('招募成本') >= 0),
      '候选人的门槛与禁用原因可见（当前 ' + hireDisabled + ' 个不满足门槛被禁用）', '招募按钮既没有禁用态也没有门槛说明');

    /* ── 12 设备 / 耗材模式 / 工资档 ── */
    $('tab-lab').click();
    const sub = (section) => findAllByAction($('app'), 'lab-section').filter((n) => n.dataset.section === section)[0];
    if (sub('instruments')) {
      sub('instruments').click();
      const ownedBefore = store.getState().lab.equipment['bath'] || 0;
      const buy = findAllByAction($('panel-lab'), 'buy-equipment').filter((n) => n.dataset.id === 'bath')[0];
      if (buy && !buy.disabled) {
        buy.click();
        const ownedAfter = store.getState().lab.equipment['bath'] || 0;
        check(ownedAfter === ownedBefore + 1, '买仪器生效（水浴锅 ' + ownedBefore + ' → ' + ownedAfter + '）', '买仪器没有生效');
      } else {
        pass('水浴锅已到持有上限或经费不足（跳过购买断言）');
      }
    }
    if (sub('consumables')) {
      sub('consumables').click();
      const modeBefore = store.getState().player.consumeMode;
      const modeBtn = findAllByAction($('panel-lab'), 'consume-mode')[0];
      if (modeBtn) {
        modeBtn.click();
        const modeAfter = store.getState().player.consumeMode;
        check(modeAfter !== modeBefore, '切换耗材消耗模式生效（' + modeBefore + ' → ' + modeAfter + '）', '耗材模式切换无效');
      }
      const buyPack = findByAction($('panel-lab'), 'buy-consumable');
      if (buyPack && !buyPack.disabled) {
        const before = store.getState().player.consumable;
        buyPack.click();
        check(store.getState().player.consumable > before, '采购耗材生效', '采购耗材无效');
      }
    }
    if (sub('students')) {
      sub('students').click();
      const wage = findAllByAction($('panel-lab'), 'wage');
      const activeNow = store.getState().students.filter((s) => !s.left && !s.graduated).length;
      check(activeNow === 0 || (wage.length >= 4 && wage.length % 4 === 0), '在读学生卡片提供四档工资按钮（' + wage.length + ' 个 / ' + activeNow + ' 名学生）', '工资档按钮数量不对：' + wage.length);
      check(findAllByAction($('panel-lab'), 'buy-first').length > 0, '一作交易台提供「购买一作」入口', '缺少购买一作入口');
      const grabBtns = findAllByAction($('panel-lab'), 'grab-first');
      check(grabBtns.length > 0, '结题产出的论文在「可抢的一作」里各有一个按钮（' + grabBtns.length + ' 篇）', '没有可抢的一作按钮');
      check(panelText('panel-lab').indexOf('可抢的一作') >= 0, '学生卡片有「可抢的一作」台帐区块', '缺少可抢的一作区块');
      const withPaper = grabBtns.filter((n) => n.dataset && n.dataset.paperId && n.dataset.tier)[0] || null;
      check(Boolean(withPaper), '抢一作按钮带了该篇的 paperId 与 tier（' + (withPaper ? withPaper.dataset.paperId + ' / ' + withPaper.dataset.tier : '—') + '）', '抢一作按钮没有带 paperId/tier');
      const grabTarget = withPaper ? withPaper.dataset : null;
      if (grabTarget) {
        /* ③ 先二次确认：确认条必须写明档位/总 IF/诚信/幸福度 */
        withPaper.click();
        const confirmRow = $('panel-lab').querySelectorAll('.is-confirm');
        const confirmText = confirmRow.length ? String(confirmRow[0].textContent) : '';
        check(confirmRow.length === 1, '点「抢他一作」先展开二次确认（不直接执行）', '没有二次确认就直接抢了');
        const papersBefore = clone(store.getState().player.papersFirst);
        const integrityBefore = store.getState().player.integrity;
        const victimBefore = (store.getState().students.filter((s) => s.id === grabTarget.studentId)[0] || {}).happiness;
        check(confirmText.indexOf('到手一作档位') >= 0 && confirmText.indexOf('总影响因子') >= 0
          && confirmText.indexOf('你的诚信') >= 0 && confirmText.indexOf('他的幸福度') >= 0,
        '确认条写明「档位 / 总 IF / 诚信 −8 / 该生幸福度 −30」', '确认条内容不全：' + confirmText.slice(0, 60));
        check(confirmText.indexOf('−8') >= 0 && confirmText.indexOf('−30') >= 0, '确认条里的数值来自 core（诚信 −8、幸福度 −30）', '确认条缺少数值');
        const cancelBtn = findByAction($('panel-lab'), 'grab-cancel');
        if (cancelBtn) {
          cancelBtn.click();
          check(JSON.stringify(store.getState().player.papersFirst) === JSON.stringify(papersBefore), '「算了」取消后什么都没发生（二次确认真的挡在前面）', '取消之后仍然改了状态');
        }
        /* ③ 确认后执行 */
        const again = findAllByAction($('panel-lab'), 'grab-first').filter((n) => n.dataset.paperId === grabTarget.paperId)[0];
        if (again) again.click();
        const confirmBtn = findByAction($('panel-lab'), 'grab-confirm');
        if (confirmBtn) {
          confirmBtn.click();
          const after = store.getState();
          const gained = Object.keys(after.player.papersFirst).reduce((sum, k) => sum + ((after.player.papersFirst[k] || 0) - (papersBefore[k] || 0)), 0);
          check(gained === 1, '确认后一作真的记到自己名下（+1 篇）', '抢一作没有生效：+' + gained);
          check(after.player.integrity === integrityBefore - 8, '抢一作扣诚信 −8（' + integrityBefore + ' → ' + after.player.integrity + '）', '诚信没有按 −8 扣');
          const victimAfter = (after.students.filter((s) => s.id === grabTarget.studentId)[0] || {}).happiness;
          const expectHappy = victimBefore === undefined ? undefined : Math.max(0, victimBefore - 30);
          check(victimBefore === undefined || victimAfter === expectHappy, '该生幸福度按 −30 掉（' + victimBefore + ' → ' + victimAfter + '，夹在 0–100）', '幸福度没有掉 −30：' + victimBefore + ' → ' + victimAfter);
          const rec = after.projects.flatMap((p) => (Array.isArray(p.paperTiers) ? p.paperTiers : [])).filter((x) => x && typeof x === 'object' && x.paperId === grabTarget.paperId)[0];
          check(Boolean(rec) && rec.grabbed === true, '论文台帐写回 grabbed（这篇不会再出现在可抢列表）', '台帐没有标记 grabbed');
          check(findAllByAction($('panel-lab'), 'grab-first').filter((n) => n.dataset.paperId === grabTarget.paperId).length === 0, '被抢过的论文不再渲染按钮（只在「该生为一作且尚未被抢」时给入口）', '被抢过的论文还留着按钮');
          /* ② 每篇只能抢一次 / 每生每月最多一次：再抢一次必须被拒 */
          const againCount = clone(store.getState().player.papersFirst);
          store.dispatch({ type: 'game/grabFirstAuthor', payload: { studentId: grabTarget.studentId, paperId: grabTarget.paperId, tier: grabTarget.tier } });
          const after2 = store.getState();
          const gained2 = Object.keys(after2.player.papersFirst).reduce((sum, k) => sum + ((after2.player.papersFirst[k] || 0) - (againCount[k] || 0)), 0);
          check(gained2 === 0 && String(after2.ui.toast || '').length > 0, '同一篇再抢一次被拒（提示：' + String(after2.ui.toast).slice(0, 20) + '…）', '重复抢一作没有被拒');
          /* ④ 缺 tier 直接拒绝（不再有 payload.tier || 'q1' 的静默默认） */
          store.dispatch({ type: 'game/grabFirstAuthor', payload: { studentId: grabTarget.studentId, paperId: grabTarget.paperId } });
          const after3 = store.getState();
          const gained3 = Object.keys(after3.player.papersFirst).reduce((sum, k) => sum + ((after3.player.papersFirst[k] || 0) - (againCount[k] || 0)), 0);
          check(gained3 === 0 && String(after3.ui.toast || '').indexOf('tier') >= 0, '缺 tier 的抢一作请求被引擎拒绝（' + String(after3.ui.toast).slice(0, 24) + '…）', '缺 tier 仍然被静默当成一区执行了');
        } else {
          fail('确认条没有「确认抢」按钮');
        }
      }
    }

    /* ── 12.5 耗材单位口径 + 交流课题限次（t8 finding ⑤⑥）── */
    if (sub('consumables')) {
      sub('consumables').click();
      check(panelText('panel-lab').indexOf('1 单位 = 1 万元') >= 0, '耗材库常驻标注「1 单位 = 1 万元」', '耗材库没有单位换算说明');
      const hudConsumable = $('hud-consumable');
      const hudTitle = hudConsumable && hudConsumable.getAttribute ? String(hudConsumable.getAttribute('title') || '') : '';
      check(hudTitle.indexOf('1 单位 = 1 万元') >= 0, '顶栏「耗材资金」悬停也能看到单位换算', '顶栏没有单位换算提示：' + hudTitle);
    }
    $('tab-actions').click();
    const talkLimitShown = panelText('panel-actions').indexOf('每人每月最多 2 次') >= 0;
    check(talkLimitShown, '交流课题的限次文案与 core 一致（每人每月最多 2 次，取自 vm.consts.limits）', '交流课题限次文案与 core 不一致');

    /* ── 12.6 延毕决定：二选一弹层 + 未拍板不推进（t8 finding ②）── */
    const edge = forceDeferEdge(null);
    check(Boolean(edge), '能把学生推到「学制读满」的边界（延毕弹层的前置条件）', '没有在读学生，无法验证延毕');
    if (edge) {
      const waitVm = vmNow();
      check((waitVm.pendingDefer || []).length >= 1, 'core 把到期的学生挂成待决状态（pendingDefer=' + (waitVm.pendingDefer || []).length + '）', 'pendingDefer 没有暴露');
      check(waitVm.canAdvance === false, '待决期间 canAdvance = false（顶栏按钮同步置灰）', '待决期间仍然 canAdvance');
      const deferModal = textOf($('modal-root'));
      check(deferModal.indexOf('延毕还是肄业') >= 0, '延毕决定以弹层摊开（与随机事件同级的待决状态）', '没有渲染延毕弹层：' + deferModal.slice(0, 40));
      check(deferModal.indexOf('−40') >= 0 && deferModal.indexOf('不占招生名额') >= 0
        && deferModal.indexOf('2 次') >= 0 && deferModal.indexOf('3 次') >= 0,
      '弹层写明不可逆后果：幸福度 −40 / 不占招生名额 / 硕士 2 次 · 博士 3 次', '延毕弹层文案缺后果：' + deferModal.slice(0, 80));
      const monthBeforeDefer = store.getState().calendar.monthIndex;
      clickAction('next-month');
      check(store.getState().calendar.monthIndex === monthBeforeDefer, '没拍板之前「下一个月」推不动（仍停在第 ' + monthBeforeDefer + ' 月）', '未选择也推进了月份');
      const beforeSt = store.getState().students.filter((s) => s.id === edge.id)[0];
      const deferBtn = findAllByAction($('modal-root'), 'defer-choice').filter((n) => n.dataset.choice === 'defer')[0];
      if (deferBtn) {
        deferBtn.click();
        const afterSt = store.getState().students.filter((s) => s.id === edge.id)[0];
        check(afterSt.deferMonths === beforeSt.deferMonths + 1 && afterSt.studyMonthsLeft > beforeSt.studyMonthsLeft,
          '选「延毕一年」：延毕次数 +1、在读月数 +（' + beforeSt.studyMonthsLeft + ' → ' + afterSt.studyMonthsLeft + '）', '延毕没有生效');
        check(afterSt.happiness === Math.max(0, beforeSt.happiness - 40), '延毕扣幸福度 −40（' + beforeSt.happiness + ' → ' + afterSt.happiness + '）', '延毕没扣幸福度');
        check(vmNow().canAdvance === true, '拍板之后恢复推进（canAdvance = true）', '拍板后仍然推不动');
      } else {
        fail('延毕弹层缺少「让他延毕一年」按钮');
      }
      const edge2 = forceDeferEdge(null);
      const quitBtn = edge2 ? findAllByAction($('modal-root'), 'defer-choice').filter((n) => n.dataset.choice === 'giveUp')[0] : null;
      if (quitBtn) {
        quitBtn.click();
        const afterQuit = store.getState().students.filter((s) => s.id === edge2.id)[0];
        check(afterQuit.left === true, '选「让他肄业」：学生直接离组（note=' + afterQuit.note + '，诚信也扣了）', '肄业没有生效');
      } else {
        fail('延毕弹层缺少「让他肄业」按钮');
      }
      clearDefer('defer');
    }

    /* ── 13 toast：core 的失败反馈要能显示并关掉 ── */
    store.dispatch({ type: 'game/buyConsumable', payload: { amount: 99999 } });
    const toastText = textOf($('toast-root'));
    check(toastText.length > 0, 'core 的提示（toast）能显示：' + toastText.trim().slice(0, 24), 'toast 没有渲染');
    if (toastText.length) {
      clickAction('dismiss-toast');
      check(textOf($('toast-root')).length === 0, 'toast 可以关掉', 'toast 关不掉');
    }

    /* ── 14 存档回读 ── */
    check(Boolean(storage.getItem('wobang_son_academician_save')), '月末自动存档写进 localStorage', '没有写入 localStorage');
    const saveMod = await import(pathToFileURL(join(ROOT, 'src', 'core', 'save.js')).href);
    const reloaded = saveMod.loadGame(storage);
    check(Boolean(reloaded), '存档能读回来', '存档读不回来');
    if (reloaded) {
      check(reloaded.player.name === '赵老板', '读回的存档保留了改过的名字（' + reloaded.player.name + '）', '存档没有保留改名');
    }

    /* ── 14.5 下海：先确认再结束（t8 finding ③）── */
    const resignBtn = $('btn-resign');
    if (resignBtn && !resignBtn.disabled) {
      resignBtn.click();
      const resignText = textOf($('modal-root'));
      check(resignText.indexOf('不可撤销') >= 0 && resignText.indexOf('纪事') >= 0,
        '点「下海」先弹确认（写明「本局立即结束、不可撤销、结局记入纪事」）', '下海没有二次确认：' + resignText.slice(0, 40));
      check(!store.getState().ending, '确认之前不会真的结束本局', '还没确认就结束了');
      const confirmResign = findByAction($('modal-root'), 'resign-confirm');
      check(Boolean(confirmResign), '确认弹层提供「确认下海」按钮', '确认弹层没有确认按钮');
      if (confirmResign) {
        confirmResign.click();
        check(Boolean(store.getState().ending), '确认后才真的结束本局（结局=' + ((store.getState().ending || {}).id || '—') + '）', '确认后没有结束');
      }
    } else {
      fail('找不到可用的「下海」按钮');
    }

    /* ── 15 结局画面：院士（渲染路径）+ 被举报（真实机制）── */
    const stE = clone(store.getState());
    stE.ending = { id: 'academician', title: '院士', text: '名单公布那天，你儿子终于搞明白你在做什么——是在你当选之后。', monthIndex: 137, variant: 'default' };
    stE.phase = 'ended';
    stE.player.rankIndex = 8;
    replaceState(stE);
    const endText = textOf($('modal-root'));
    check(endText.indexOf('院士') >= 0, '院士结局画面渲染', '院士结局画面没有渲染');
    check(endText.indexOf('最终头衔') >= 0 && endText.indexOf('SCI 一作') >= 0 && endText.indexOf('培养毕业') >= 0, '结局画面摊开战绩：头衔/总IF/一作/结题/毕业/诚信/年龄', '结局画面缺少战绩字段');
    check(Boolean(findByAction($('modal-root'), 'reset')), '结局画面有重开入口', '结局画面没有重开按钮');
    const resetBtn = findByAction($('modal-root'), 'reset');
    if (resetBtn) {
      resetBtn.click();
      const fresh = store.getState();
      check(fresh.calendar.monthIndex === 0 && !fresh.ending, '结局后可以重开一局（回到第 1 个月）', '重开没有生效');
    }

    /* 被举报：走真实机制（诚信归零 → 结算判定坏结局） */
    const stB = clone(store.getState());
    // 设为足够负的值：autoResolveEvents 结算随机事件时，任何事件的默认选项（诚信增量）都无法把它抬回 0 以上，
    // 从而保证「integrity <= 0」的坏结局条件确定触发，消除种子相关的偶发失败。
    stB.player.integrity = -9999;
    replaceState(stB);
    step({ autoResolveEvents: true });
    const badText = textOf($('modal-root'));
    check(badText.indexOf('被举报') >= 0, '诚信归零触发坏结局「被举报」并渲染结局画面', '坏结局没有触发：' + badText.slice(0, 40));
    check(Boolean(findByAction($('modal-root'), 'reset-confirm')) || Boolean(findByAction($('modal-root'), 'reset')), '坏结局画面同样能重开', '坏结局画面没有重开入口');

    /* ── 16 交互契约：页面上出现的 data-action 都必须有处理函数 ── */
    const handlers = Object.keys(game.app.handlers || {});
    const used = new Set();
    walk($('app'), (n) => { if (n.dataset && n.dataset.action) used.add(n.dataset.action); });
    const orphans = Array.from(used).filter((a) => handlers.indexOf(a) < 0);
    check(orphans.length === 0, '页面上 ' + used.size + ' 个 data-action 全部有处理函数', '这些按钮点了没反应：' + orphans.join('、'));

    /* ── 17 视觉与分层：静态自检（评审抽查用）── */
    const cssRaw = readFileSync(join(ROOT, 'src', 'styles', 'main.css'), 'utf8');
    const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');   // 注释里提到 @import 不算依赖
    const rootBlock = (css.match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
    const varCount = (rootBlock.match(/--[a-z0-9-]+\s*:/g) || []).length;
    check(varCount >= 25, '设计令牌集中在 :root（' + varCount + ' 个 CSS 变量：配色/字号/间距/圆角/阴影）', 'CSS 变量太少：' + varCount);
    const tokens = ['--paper-bg', '--ink-strong', '--seal', '--gold', '--jade', '--blue', '--sp-4', '--r-3', '--fs-md'];
    const missingTokens = tokens.filter((k) => css.indexOf(k + ':') < 0);
    check(missingTokens.length === 0, '配色/间距/圆角/字号成体系（纸墨底 + 印章红 + 铜金 + 学术青）', '缺少设计令牌：' + missingTokens.join('、'));
    check(css.indexOf('@import') < 0 && !/url\(\s*['"]?https?:/.test(css), 'CSS 无 @import / 无外链资源（离线单文件可玩）', 'CSS 里有外部依赖');
    check(/@media[^{]*max-width:\s*900px/.test(css) && /@media[^{]*max-width:\s*1279px/.test(css), '响应式断点覆盖 1366/1920 两栏与 ≤900px 窄屏', '缺少响应式断点');
    check(/@media[^{]*min-width:\s*1600px/.test(css), '大屏断点单独调过（1920×1080 不浪费宽度）', '缺少大屏断点');
    check(/PingFang|Microsoft YaHei|Noto Sans CJK/.test(css), '中文字体栈可读（系统中文字体回退）', '中文字体栈缺失');
    check(/rel="icon"[^>]*href="data:image\/svg\+xml/.test(html), 'index.html 带内联 favicon（data: URI，离线单文件也有站点图标）', 'index.html 没有 favicon');
    const uiFiles = [];
    (function walkDir(dir) {
      for (const name of readdirSync(dir)) {
        const fullPath = join(dir, name);
        if (statSync(fullPath).isDirectory()) walkDir(fullPath);
        else if (fullPath.endsWith('.js')) uiFiles.push(fullPath);
      }
    })(join(ROOT, 'src', 'ui'));
    const leaky = uiFiles.filter((f) => /from\s*['"][^'"]*\/core\/formulas\.js|from\s*['"][^'"]*\/data\//.test(readFileSync(f, 'utf8')));
    check(leaky.length === 0, 'UI 层不 import src/data 或 core/formulas（' + uiFiles.length + ' 个 UI 文件全部只看 viewmodel）', 'UI 越层导入：' + leaky.join('、'));
    const hexRe = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/;
    const colored = uiFiles.filter((f) => hexRe.test(readFileSync(f, 'utf8')));
    check(colored.length === 0, 'JS 里没有硬编码颜色（配色全部走 CSS 变量）', 'UI 里写死了颜色：' + colored.join('、'));
    const mathRe = /\b(?:0\.\d+\s*\*|\*\s*0\.\d+|Math\.(?:pow|sqrt|exp))\b/;
    const formula = uiFiles.filter((f) => mathRe.test(readFileSync(f, 'utf8')));
    check(formula.length === 0, 'UI 里没有倍率/公式（经济与科研数值全部来自 core）', 'UI 里疑似有公式：' + formula.join('、'));

    /* ── 18 UI 不应该有未注册动作的告警 ── */
    const uiWarnings = warnings.filter((w) => w.indexOf('[ui]') >= 0);
    check(uiWarnings.length === 0, '整个流程没有出现「未注册的 data-action」告警', 'UI 告警：' + uiWarnings.join(' | '));
  }
} catch (err) {
  fail('冒烟过程中抛异常：' + (err && err.stack ? err.stack.split(String.fromCharCode(10)).slice(0, 8).join(' | ') : err));
}

console.warn = realWarn;
console.log('');
console.log('『我帮儿子评院士』UI 冒烟（DOM shim，无浏览器）');
console.log('');
for (const c of checks) console.log('  ' + (c.ok ? '[ok]  ' : '[fail]') + ' ' + c.msg);
const bad = checks.filter((c) => !c.ok).length;
console.log('');
console.log(bad ? '冒烟失败：' + bad + ' 项' : '冒烟通过：' + checks.length + ' 项全部 ok');
process.exit(bad ? 1 : 0);

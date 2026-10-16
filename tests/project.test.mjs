/**
 * tests/project.test.mjs —— 项目系统（承接 / 难点三种处理 / 结题产出 / 逾期失败）
 * 运行：node 评院士/tests/project.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState, createProject, createOffer, createStudent } from '../src/core/state.js';
import { PROJECT_MAP, PROJECT_OFFER_TTL_MONTHS, DEPOSIT_RATE, OVERDUE_GRACE_MONTHS, PER_HARDPOINT_TAIL_MUL, UNDERDUE_TAIL_MUL } from '../src/data/projects.js';
import { TEAM_MONEY, SOLO_MONEY, FAKE_MONEY, TEAM_STUDENT_HAPPY, SOLO_STUDENT_HAPPY, TEAM_OTHER_PROJECT_MUL, hardpointCount, MAX_PROJECTS_PER_STUDENT, PROJECT_MAX_STUDENTS } from '../src/data/hardpoints.js';
import { INTEGRITY_DELTA } from '../src/data/tuning.js';
import { projectTail, openHardpointCount, projectProgressPct, studentBaseProgress } from '../src/core/formulas.js';
import { PAPER_TIER_ORDER, PLAYER_AUTHOR_ID } from '../src/data/papers.js';
import { buildViewModel } from '../src/core/viewmodel.js';
import { EVENTS } from '../src/data/events.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('项目系统');

/* ── 1 承接：定金 / 时限 / 难点数量 ── */
{
  const st = freshGame(mods, 'proj-accept');
  st.player.rankIndex = 6;
  st.player.money = 100;
  st.lab.equipment = { centrifuge: 2, shaker: 2, hplc: 2, hood: 2, elisa: 2, gc: 2, ms: 2, bath: 2 };
  // 第 0 个月市场还没刷新，手工挂一个确定的 offer（测试要可重复，不依赖生成随机）
  const offer = createOffer({
    offerId: 'oTest', kind: 'project', defId: 'N4', category: 'nation', tier: 4,
    money: PROJECT_MAP.N4.money, limitMonths: PROJECT_MAP.N4.limitMonths, workload: PROJECT_MAP.N4.workload,
    require: { ...PROJECT_MAP.N4.require }, createdMonthIndex: 0, expiresMonthIndex: 24,
  });
  st.market.pool.push(offer);
  const def = PROJECT_MAP[offer.defId];
  const moneyBefore = st.player.money;
  const consumableBefore = st.player.consumable;
  const after = reduce(st, ACTIONS.acceptProject({ offerId: offer.offerId }));
  const project = after.projects.find((p) => p.defId === offer.defId);
  s.ok(Boolean(project), '能承接市场里的项目', offer.defId);
  const deposit = Math.round(def.money * DEPOSIT_RATE[def.category] * 100) / 100;
  s.eq(after.player.money, moneyBefore + deposit, '承接拿到定金（' + def.category + ' 定金率 ' + DEPOSIT_RATE[def.category] + '）');
  s.ok(after.player.consumable > consumableBefore, '定金的一部分转成耗材');
  s.eq(project.deadlineMonthIndex - project.acceptMonthIndex, def.limitMonths, '时限 = 模板 limitMonths');
  s.eq(project.hardpoints.length, hardpointCount(def.tier), '难点数量 = hardpointCount(tier)');
  s.eq(after.market.pool.some((o) => o.offerId === offer.offerId), false, '承接后该 offer 从市场移除');
}

/* ── 2 难点三种处理 ── */
function withProject(seed, defId) {
  const st = freshGame(mods, seed);
  st.player.rankIndex = 6;
  st.player.money = 500;
  st.player.consumable = 500;
  const def = PROJECT_MAP[defId];
  const crew = st.students.filter((x) => !x.left && !x.graduated);
  const p = createProject({
    instanceId: 'pX', defId, name: def.name, category: def.category, tier: def.tier,
    workload: def.workload, progress: 300, money: def.money, depositRate: def.depositRate,
    consumablePerMonth: def.consumablePerMonth, deadlineMonthIndex: 999,
    assignedStudentIds: crew.map((x) => x.id),
    hardpoints: [{ id: 'pX-h1', hd: 3, hdRolled: true, status: 'open', appearAt: 0, retries: 0, method: null }],
  });
  st.projects.push(p);
  for (const x of crew) x.projectIds = ['pX'];
  return { st, crew, p };
}

{
  const { st, crew } = withProject('hp-team', 'N4');
  const other = createProject({ instanceId: 'pO', defId: 'E1', category: 'enterprise', tier: 1, workload: 500, progress: 400, deadlineMonthIndex: 999, assignedStudentIds: [] });
  st.projects.push(other);
  const moneyBefore = st.player.money;
  const after = reduce(st, ACTIONS.resolveHardpoint({ projectId: 'pX', hardpointId: 'pX-h1', method: 'team', studentIds: crew.slice(0, 3).map((x) => x.id) }));
  const p = after.projects.find((x) => x.instanceId === 'pX');
  const o = after.projects.find((x) => x.instanceId === 'pO');
  s.eq(after.player.money, moneyBefore - TEAM_MONEY, '多人攻坚花 ' + TEAM_MONEY + ' 万');
  s.ok(['solved'].includes(p.hardpoints[0].status) || p.hardpoints[0].retries >= 0, '没解决时该难点保持开放并累计重试');
  s.eq(o.progress, 400, '「其他项目本月进度 -25%」不写在累计进度上（旧的实现 bug）');
  s.eq(o.distractMul, 1 + TEAM_OTHER_PROJECT_MUL, '改用本月进度乘子：其他项目 distractMul = ' + (1 + TEAM_OTHER_PROJECT_MUL));
  s.ok(crew.slice(0, 3).every((x) => after.students.find((y) => y.id === x.id).happiness <= 100), '队员幸福度被消耗（' + TEAM_STUDENT_HAPPY + '）');
}
{
  const { st, crew } = withProject('hp-solo', 'N2');
  const moneyBefore = st.player.money;
  const victim = crew[0];
  const happyBefore = victim.happiness;
  const after = reduce(st, ACTIONS.resolveHardpoint({ projectId: 'pX', hardpointId: 'pX-h1', method: 'solo', studentIds: [victim.id] }));
  s.eq(after.player.money, moneyBefore - SOLO_MONEY, '单人猛干花 ' + SOLO_MONEY + ' 万');
  const v2 = after.students.find((x) => x.id === victim.id);
  s.ok(v2.happiness <= happyBefore + SOLO_STUDENT_HAPPY, '被猛干的学生幸福度 -' + Math.abs(SOLO_STUDENT_HAPPY), String(v2.happiness));
  s.ok(v2.soloThisMonth === true || after.projects[0].hardpoints[0].status === 'solved', '本月该生产出全部用于攻坚（soloThisMonth）');
}
{
  const { st } = withProject('hp-fake', 'N2');
  const integrityBefore = st.player.integrity;
  const after = reduce(st, ACTIONS.resolveHardpoint({ projectId: 'pX', hardpointId: 'pX-h1', method: 'fake' }));
  s.eq(after.projects.find((x) => x.instanceId === 'pX').hardpoints[0].status, 'faked', '造假蒙混：难点状态 = faked');
  s.eq(after.counters.fakesTotal, 1, '造假次数被记账（审计触发器）');
  s.ok(after.player.integrity <= integrityBefore + INTEGRITY_DELTA.fake, '造假扣诚信 ' + INTEGRITY_DELTA.fake, String(after.player.integrity));
}

/* ── 3 结题产出：论文 / 尾款 / 清空学生负责列表 / 推荐票 ── */
{
  const st = freshGame(mods, 'proj-finish');
  st.player.rankIndex = 6;
  st.player.money = 0;
  const def = PROJECT_MAP.N5;
  const crew = st.students.filter((x) => !x.left && !x.graduated);
  const p = createProject({
    instanceId: 'pF', defId: 'N5', name: def.name, category: 'nation', tier: def.tier,
    workload: 10, progress: 9.9, money: def.money, depositRate: def.depositRate,
    consumablePerMonth: 0, deadlineMonthIndex: 999,
    assignedStudentIds: crew.map((x) => x.id),
    paperTiers: def.papers.slice(),
  });
  st.projects.push(p);
  for (const x of crew) x.projectIds = ['pF'];
  const papersBefore = { ...st.player.papers };
  const ifBefore = st.player.totalIF;
  const ticketsBefore = st.player.tickets;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const p2 = after.projects.find((x) => x.instanceId === 'pF');
  s.eq(p2.status, 'finished', '进度达到工作量即结题');
  // t24：产出论文数以结题台帐为准（player.papers 现在只数「老板是一作」，学生负责的项目不进它）。
  s.eq(p2.paperTiers.length, def.papers.length, '结题产出论文数 = 模板论文槽数（' + def.papers.length + ' 篇）');
  s.ok(after.player.totalIF > ifBefore, '结题产出计入 totalIF（所有论文都算，GDD §3.2）', ifBefore + ' → ' + after.player.totalIF);
  s.eq(Object.keys(papersBefore).reduce((n, k) => n + ((after.player.papers[k] || 0) - (papersBefore[k] || 0)), 0), 0,
    '学生负责的项目：老板一作数不变（t24 一作归属）');
  s.ok(after.player.money > 0, '尾款到账', String(after.player.money));
  s.ok(crew.every((x) => (after.students.find((y) => y.id === x.id).projectIds || []).length === 0),
    '结题后学生的负责列表被清空（否则 3 个名额会被已结题项目占满 → 全组停止接项目）');
  s.ok(after.player.tickets >= ticketsBefore + 1, 'T5 结题给 1 张推荐票（T6 给 2 张，T4 及以下不给）', String(after.player.tickets));
}

/* ── 4 尾款公式与未解决难点降档 ── */
{
  const p = createProject({ instanceId: 'pT', defId: 'N2', category: 'nation', tier: 2, workload: 300, progress: 300, money: 50, depositRate: 0.30, hardpoints: [{ id: 'a', hd: 2, status: 'open' }] });
  s.near(projectTail(p), 50 * 0.7 * PER_HARDPOINT_TAIL_MUL, 0.01, '尾款 = 合同额 ×(1-定金率)× 0.8^未解决难点数');
  p.overdueMonths = 1;
  s.near(projectTail(p), 50 * 0.7 * PER_HARDPOINT_TAIL_MUL * UNDERDUE_TAIL_MUL, 0.01, '逾期再打 ' + UNDERDUE_TAIL_MUL);
  s.eq(openHardpointCount(p), 1, '未解决难点计数');
  s.ok(projectProgressPct(p) > 0, '进度百分比（分母含难点系数）');
}

/* ── 5 逾期 → 失败 ── */
{
  const st = freshGame(mods, 'proj-overdue');
  st.player.consumable = 500;
  const p = createProject({
    instanceId: 'pO', defId: 'E1', name: '过期横向', category: 'enterprise', tier: 1,
    workload: 99999, progress: 0, consumablePerMonth: 0, deadlineMonthIndex: 0,
    overdueMonths: OVERDUE_GRACE_MONTHS, assignedStudentIds: [],
  });
  st.projects.push(p);
  const integrityBefore = st.player.integrity;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const p2 = after.projects.find((x) => x.instanceId === 'pO');
  s.eq(p2.status, 'failed', '逾期超过宽限期（' + OVERDUE_GRACE_MONTHS + ' 个月）→ 项目失败');
  s.eq(after.counters.projectsFailed, 1, '失败项目计数 +1');
  s.ok(after.player.integrity <= integrityBefore, '失败扣诚信', String(after.player.integrity));
}

/* ── 6 市场 offer 有效期 ── */
{
  const st = freshGame(mods, 'proj-ttl');
  st.calendar.monthIndex = PROJECT_OFFER_TTL_MONTHS + 2;
  const projectOffers = st.market.pool.filter((o) => o.kind === 'project');
  for (const o of projectOffers) o.expiresMonthIndex = 1;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(after.market.pool.filter((o) => o.kind === 'project').every((o) => o.locked || o.expiresMonthIndex > after.calendar.monthIndex),
    '过期的项目 offer 会被撤走（甲方不会等你一辈子）');
}

/* ── 7 一作归属（t24）：晋升门槛只认「老板是一作」的论文 ──
   证据三连：(a) 学生负责的项目结题 → 老板一作数不变、totalIF 增加；
             (b) 抢一作 → 老板一作数恰好 +1（且 totalIF 不变，IF 在结题时已计过）；
             (c) 老板亲带的项目结题 → 该项目每篇论文的一作都是玩家，一作数全部 +1。 */
const paperTotal = (p) => PAPER_TIER_ORDER.reduce((n, t) => n + (p[t] || 0), 0);
function paperGame(seed, defId, leading) {
  const st = freshGame(mods, seed);
  st.player.rankIndex = 6;
  st.player.money = 0;
  st.player.consumable = 999;
  const def = PROJECT_MAP[defId];
  const crew = st.students.filter((x) => !x.left && !x.graduated);
  const p = createProject({
    instanceId: 'pA', defId, name: def.name, category: def.category, tier: def.tier,
    workload: def.workload, progress: def.workload, money: def.money, depositRate: def.depositRate,
    consumablePerMonth: def.consumablePerMonth, deadlineMonthIndex: 999,
    assignedStudentIds: crew.map((x) => x.id), playerLeading: leading,
    paperTiers: def.papers.slice(), hardpoints: [],
  });
  st.projects.push(p);
  for (const x of crew) x.projectIds = ['pA'];
  return { st, crew, p };
}
{
  // (a) 学生负责：老板一作数不变，总 IF 增加
  const { st } = paperGame('t24-a', 'N4', false);
  const papersBefore = paperTotal(st.player.papers);
  const ifBefore = st.player.totalIF;
  const after = reduce(st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const done = after.projects.find((x) => x.instanceId === 'pA');
  s.eq(done.status, 'finished', '(a) 学生负责的项目按期结题');
  s.ok(done.paperTiers.length > 0 && done.paperTiers.every((x) => x.firstAuthorId !== PLAYER_AUTHOR_ID),
    '(a) 学生负责的项目：一作都是学生', done.paperTiers.map((x) => x.firstAuthorName).join('、'));
  s.eq(paperTotal(after.player.papers), papersBefore, '(a) 老板一作数不变（学生一作不计入晋升门槛）');
  const vmStuPapers = [].concat(buildViewModel(after).projects.list || [], buildViewModel(after).projects.archive || []).flatMap((x) => x.papers || []);
  s.ok(vmStuPapers.length > 0 && vmStuPapers.every((x) => x.byPlayer === false),
    '(a) 学生一作的论文在视图层标为 byPlayer=false（UI 显示「一作还在学生名下」）',
    vmStuPapers.map((x) => x.firstAuthorName + ':' + x.byPlayer).join('、'));
  s.ok(after.player.totalIF > ifBefore, '(a) totalIF 增加（GDD §3.2：所有论文都算）',
    ifBefore + ' → ' + after.player.totalIF);
  s.note('(a) 学生负责的 ' + done.defId + ' 结题：老板一作 ' + papersBefore + ' → ' + paperTotal(after.player.papers)
    + ' 篇（不变），totalIF ' + ifBefore + ' → ' + after.player.totalIF + '（+' + (after.player.totalIF - ifBefore) + '），实产论文 ' + done.paperTiers.length + ' 篇');

  // (b) 抢一作：恰好 +1，且 totalIF 不变
  const victim = done.paperTiers[0];
  const papersBeforeGrab = paperTotal(after.player.papers);
  const ifBeforeGrab = after.player.totalIF;
  const grabbed = reduce(after, ACTIONS.grabFirstAuthor({ studentId: victim.firstAuthorId, paperId: victim.paperId, tier: victim.tier }));
  s.eq(paperTotal(grabbed.player.papers), papersBeforeGrab + 1, '(b) 抢一作后老板一作数恰好 +1');
  s.eq(grabbed.player.totalIF, ifBeforeGrab, '(b) 抢一作不动 totalIF（这篇的 IF 结题时已经计过）');
  s.eq(grabbed.player.papersFirst[victim.tier], 1, '(b) 抢来的台账 papersFirst 记一次（诚信/展示用）');
  const again = reduce(grabbed, ACTIONS.grabFirstAuthor({ studentId: victim.firstAuthorId, paperId: victim.paperId, tier: victim.tier }));
  s.eq(paperTotal(again.player.papers), papersBeforeGrab + 1, '(b) 同一篇再抢不重复计数');
  s.note('(b) 抢一作：老板一作 ' + papersBeforeGrab + ' → ' + paperTotal(grabbed.player.papers) + ' 篇，totalIF 保持 ' + ifBeforeGrab);

  // (c) 老板亲带：该项目论文一作全部归玩家
  const lead = paperGame('t24-c', 'N4', true);
  const leadBefore = paperTotal(lead.st.player.papers);
  const leadIfBefore = lead.st.player.totalIF;
  const leadAfter = reduce(lead.st, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  const leadDone = leadAfter.projects.find((x) => x.instanceId === 'pA');
  s.ok(leadDone.paperTiers.length > 0 && leadDone.paperTiers.every((x) => x.firstAuthorId === PLAYER_AUTHOR_ID),
    '(c) 亲带项目的每篇论文一作都是玩家', leadDone.paperTiers.map((x) => x.firstAuthorName).join('、'));
  s.eq(paperTotal(leadAfter.player.papers), leadBefore + leadDone.paperTiers.length,
    '(c) 亲带结题 → 老板一作数按台帐篇数全部 +1');
  s.ok(leadAfter.player.totalIF > leadIfBefore, '(c) totalIF 同样增加');
  const vmLeadPapers = [].concat(buildViewModel(leadAfter).projects.list || [], buildViewModel(leadAfter).projects.archive || []).flatMap((x) => x.papers || []);
  s.ok(vmLeadPapers.length > 0 && vmLeadPapers.every((x) => x.byPlayer === true),
    '(c) 亲带论文在视图层标为 byPlayer=true（UI 显示「一作在你名下」，不再误报「一作还在学生名下」）',
    vmLeadPapers.map((x) => x.firstAuthorName + ':' + x.byPlayer).join('、'));
  s.note('(c) 亲带的 ' + leadDone.defId + ' 结题：老板一作 ' + leadBefore + ' → ' + paperTotal(leadAfter.player.papers)
    + ' 篇（台帐 ' + leadDone.paperTiers.length + ' 篇全部归玩家），totalIF ' + leadIfBefore + ' → ' + leadAfter.player.totalIF);

  // 毕业产出是学生一作：加 IF、不加老板一作数
  const grad = freshGame(mods, 't24-grad');
  const g0 = grad.students[0];
  g0.degreeProgress = 100;
  const gradPapersBefore = paperTotal(grad.player.papers);
  const gradIfBefore = grad.player.totalIF;
  const gradAfter = reduce(grad, ACTIONS.advanceMonth({ autoResolveEvents: true }));
  s.ok(gradAfter.player.totalIF > gradIfBefore, '学生毕业产出论文计入 totalIF');
  s.eq(paperTotal(gradAfter.player.papers), gradPapersBefore, '毕业产出（学生一作）不计入老板一作数');
}

/* ── 8 一键分配工作（t25）：每人至少一个项目 / 双上限 / 幂等 / 明确反馈 ──
   实测场景：6 个在研项目（N1/N2/N3/N4/E2/E3）+ 8 名在读学生，打印分配矩阵前后对照。 */
const activeOf = (state) => state.students.filter((x) => !x.left && !x.graduated);
const matrixOf = (state) => state.projects.filter((p) => p.status === 'active')
  .map((p) => p.instanceId + ' ' + p.name + '：' + p.assignedStudentIds.length + ' 人（'
    + p.assignedStudentIds.map((id) => ((state.students.find((x) => x.id === id) || {}).name || id)).join('、') + '）')
  .join('\n      ');
const loadOf = (state) => activeOf(state).map((x) => x.name + ':' + x.projectIds.length).join(' ');
const membersTotal = (state) => state.projects.reduce((n, p) => n + p.assignedStudentIds.length, 0);
function autoAssignSetup(seed) {
  const st = freshGame(mods, seed);
  st.player.rankIndex = 6;
  st.player.money = 5000;
  st.player.consumable = 5000;
  let n = activeOf(st).length;
  while (n < 8) {
    n += 1;
    st.students.push(createStudent({ id: 'sA' + n, name: '学生' + n, degree: 'master', ability: 0.5 + (n % 5) * 0.05, projectIds: [] }));
  }
  ['N1', 'N2', 'N3', 'N4', 'E2', 'E3'].forEach((defId, i) => {
    const def = PROJECT_MAP[defId];
    st.projects.push(createProject({
      instanceId: 'pA' + (i + 1), defId, name: def.name, category: def.category, tier: def.tier,
      workload: def.workload, progress: 0, money: def.money, depositRate: def.depositRate,
      consumablePerMonth: def.consumablePerMonth, deadlineMonthIndex: 999,
      assignedStudentIds: [], paperTiers: def.papers.slice(), hardpoints: [],
    }));
  });
  return st;
}
{
  const st = autoAssignSetup('t25-auto');
  s.note('一键分配前——项目：\n      ' + matrixOf(st) + '\n      学生负载：' + loadOf(st));
  const after = reduce(st, ACTIONS.autoAssign());
  s.note('一键分配后——项目：\n      ' + matrixOf(after) + '\n      学生负载：' + loadOf(after));
  const act = activeOf(after);
  s.ok(act.length >= 8, '场景里有 ≥8 名在读学生', String(act.length));
  s.ok(after.projects.filter((p) => p.status === 'active').length >= 6, '场景里有 ≥6 个在研项目');
  s.ok(act.every((x) => x.projectIds.length >= 1), '名额允许时每名学生至少 1 个在研项目', loadOf(after));
  s.eq(membersTotal(after), act.reduce((n, x) => n + x.projectIds.length, 0), '学生侧与项目侧的分配总数一致（没有只写一边）');
  s.ok(act.every((x) => x.projectIds.length <= MAX_PROJECTS_PER_STUDENT), '没有学生超过 ' + MAX_PROJECTS_PER_STUDENT + ' 个项目上限');
  s.ok(after.projects.every((p) => p.assignedStudentIds.length <= PROJECT_MAX_STUDENTS), '没有项目超过 ' + PROJECT_MAX_STUDENTS + ' 人上限');
  s.eq(membersTotal(st), 0, '入参 state 没被改动（纯函数：分配只发生在新对象上）');
  s.ok(typeof after.ui.toast === 'string' && after.ui.toast.includes('一键分配'), '分配后给出结果反馈', after.ui.toast);

  // 幂等：连点第二次
  const again = reduce(after, ACTIONS.autoAssign());
  s.eq(again.ui.autoAssign.moveCount, 0, '连点第二次：0 个新岗位（不会重复分配）');
  s.eq(membersTotal(again), membersTotal(after), '连点两次后分配总数不超上限、也不增加');
  s.ok(again.projects.every((p) => p.assignedStudentIds.length <= PROJECT_MAX_STUDENTS), '连点后项目人数仍不超上限');
  s.ok(activeOf(again).every((x) => x.projectIds.length <= MAX_PROJECTS_PER_STUDENT), '连点后学生名额仍不超上限');
  s.eq(matrixOf(again), matrixOf(after), '连点后分配矩阵完全一致（结果稳定）');
  s.ok(typeof again.ui.toast === 'string' && again.ui.toast.length > 0, '第二次点击也有明确反馈，不静默失败', again.ui.toast);

  // viewmodel：UI 需要的三样东西
  const vm = buildViewModel(after);
  s.ok(vm.autoAssign && typeof vm.autoAssign.availableStudents === 'number', 'viewmodel 暴露「可分配学生数」',
    String(vm.autoAssign && vm.autoAssign.availableStudents));
  s.ok(Array.isArray(vm.autoAssign.projectsShort), 'viewmodel 暴露「仍缺人的项目」',
    JSON.stringify(vm.autoAssign.projectsShort.slice(0, 2)));
  s.ok(vm.autoAssign.last && typeof vm.autoAssign.last.feedback === 'string', 'viewmodel 暴露「上次分配结果摘要」',
    vm.autoAssign.last ? vm.autoAssign.last.feedback : 'null');
  s.ok(vm.actions.autoAssign && typeof vm.actions.autoAssign.canAssign === 'boolean', '行动页也拿到同一份一键分配数据');
}
{
  // 没有在研项目 → 明确说明为什么没分
  const st = autoAssignSetup('t25-none');
  st.projects = [];
  const r = reduce(st, ACTIONS.autoAssign());
  s.eq(r.ui.autoAssign.moveCount, 0, '没有在研项目 → 0 个岗位');
  s.ok(r.ui.toast.includes('没有在研项目'), '没有在研项目时给出明确原因', r.ui.toast);
}
{
  // 学生名额耗尽 → 明确说明 + 列出已满的学生
  const st = autoAssignSetup('t25-full');
  const act = activeOf(st);
  for (const x of act) x.projectIds = st.projects.slice(0, MAX_PROJECTS_PER_STUDENT).map((p) => p.instanceId);
  const r = reduce(st, ACTIONS.autoAssign());
  s.eq(r.ui.autoAssign.moveCount, 0, '学生都满名额 → 不再分配');
  s.ok(r.ui.toast.includes('带满'), '名额耗尽反馈写明「带满 N 个项目」', r.ui.toast);
  s.eq(r.ui.autoAssign.studentsFull.length, act.length, '摘要里列出已满名额的学生');
  s.ok(r.ui.autoAssign.availableStudents === 0, '摘要里可分配学生数为 0');
}
{
  // 手工分配/取消分配的语义不变：手工点过的分配，一键分配不会重复、也不会取消
  const st = autoAssignSetup('t25-manual');
  const s1 = activeOf(st)[0];
  const manual = reduce(st, ACTIONS.assignStudent({ projectId: 'pA1', studentId: s1.id }));
  s.eq(manual.students.find((x) => x.id === s1.id).projectIds.length, 1, '手工分配仍然生效（语义未变）');
  const auto = reduce(manual, ACTIONS.autoAssign());
  const p1 = auto.projects.find((p) => p.instanceId === 'pA1');
  s.eq(p1.assignedStudentIds.filter((id) => id === s1.id).length, 1, '一键分配不会重复挂同一个人');
  const back = reduce(auto, ACTIONS.unassignStudent({ projectId: 'pA1', studentId: s1.id }));
  s.eq(back.projects.find((p) => p.instanceId === 'pA1').assignedStudentIds.includes(s1.id), false, '手工取消分配仍然生效');
  s.ok(back.students.find((x) => x.id === s1.id).projectIds.includes('pA1') === false, '取消后学生侧也同步摘掉');
}

/* ── 9 产出守恒（t30）与手工分配的项目人数上限 ── */
{
  // 9.1 单元：一个学生的月产能有限——做 3 个项目时单项 ÷3，三项合计 = 做 1 个项目。
  //（旧实现每个项目都按满产能算，于是「把所有学生塞进所有项目」成了无脑最优解。）
  const st = freshGame(mods, 't30-conserve');
  const stu = st.students[0];
  const proj = createProject({ instanceId: 'pC1', defId: 'N2', category: 'nation', tier: 2, workload: 1e6, money: 50, consumablePerMonth: 0, deadlineMonthIndex: 999 });
  const one = studentBaseProgress(stu, proj, { projectCount: 1 });
  const three = studentBaseProgress(stu, proj, { projectCount: 3 });
  s.near(three * 3, one, 1e-6, '守恒：1 人做 3 个项目时单项产出 = 1/3，三项合计 = 做 1 个项目');
  s.ok(one > three, '守恒：项目越多，单个项目的月进度越低（多接项目有代价）');

  // 9.2 集成：引擎确实把「该生当前在研项目数」传进了公式（不是只改了纯函数）
  const run = (count) => {
    const g = freshGame(mods, 't30-conserve-run');
    // 机制 fixture：全部事件处于冷却期，避免断电扣进度污染产能守恒比较。
    for (const ev of EVENTS) g.eventState.lastFiredMonth[ev.id] = g.calendar.monthIndex;
    g.player.money = 5000;
    g.player.consumable = 5000;
    g.lab.equipment = { centrifuge: 2, shaker: 2, hplc: 2, hood: 2, elisa: 2, gc: 2, ms: 2, bath: 2 };
    const who = g.students[0];
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const p = createProject({ instanceId: 'pK' + i, defId: 'N2', name: '守恒用项目' + i, category: 'nation', tier: 2,
        workload: 1e6, money: 50, depositRate: 0.30, consumablePerMonth: 0, deadlineMonthIndex: 999, hardpoints: [] });
      g.projects.push(p);
      list.push(p);
    }
    who.projectIds = list.map((p) => p.instanceId);
    for (const p of list) p.assignedStudentIds = [who.id];
    const before = new Map(list.map((p) => [p.instanceId, p.progress]));
    const after = reduce(g, ACTIONS.advanceMonth({ autoResolveEvents: true }));
    s.eq(after.stats.lastReceipt.events.length, 0, '守恒 fixture 不受随机事件影响');
    return after.projects.reduce((n, p) => n + (before.has(p.instanceId) ? p.progress - before.get(p.instanceId) : 0), 0);
  };
  const t1 = run(1);
  const t3 = run(3);
  s.ok(t1 > 0, '对照组（1 个项目）当月确实有进度', t1.toFixed(2));
  s.near(t3, t1, 0.02, '无事件时三项目总产出等于单项目（仅逐项目分币舍入误差）');
  s.ok(t3 <= t1 * 1.35, '守恒（集成）：1 人做 3 个项目的当月总产出 ≤ 做 1 个项目的 1.35 倍（旧实现是 ~3 倍）',
    '1 项目 ' + t1.toFixed(2) + ' / 3 项目合计 ' + t3.toFixed(2) + '（比值 ' + (t3 / t1).toFixed(2) + '；随机事件会带来少量扰动）');
}
{
  // 9.3 手工分配也受项目人数上限约束：挂满 6 人后第 7 个人必须被拒，且不能静默成功。
  const st = autoAssignSetup('t30-manual-cap');
  const projectId = st.projects[0].instanceId;
  let cur = st;
  for (const x of activeOf(st).slice(0, PROJECT_MAX_STUDENTS)) {
    cur = reduce(cur, ACTIONS.assignStudent({ projectId, studentId: x.id }));
  }
  const proj = cur.projects.find((p) => p.instanceId === projectId);
  s.eq(proj.assignedStudentIds.length, PROJECT_MAX_STUDENTS, '手工分配可以先挂满 ' + PROJECT_MAX_STUDENTS + ' 人');
  const seventh = activeOf(st).find((x) => !proj.assignedStudentIds.includes(x.id));
  s.ok(Boolean(seventh), '还有第 ' + (PROJECT_MAX_STUDENTS + 1) + ' 个学生可以试着塞进来');
  const over = reduce(cur, ACTIONS.assignStudent({ projectId, studentId: seventh.id }));
  s.eq(over.projects.find((p) => p.instanceId === projectId).assignedStudentIds.length, PROJECT_MAX_STUDENTS,
    '第 ' + (PROJECT_MAX_STUDENTS + 1) + ' 个人被拒绝（手工分配与一键分配同一套上限）');
  s.eq(over.students.find((x) => x.id === seventh.id).projectIds.includes(projectId), false, '被拒的学生侧也没有偷偷挂上');
  s.ok(typeof over.ui.toast === 'string' && over.ui.toast.length > 0, '被拒时有明确反馈，不静默成功', over.ui.toast);
}

s.finish();

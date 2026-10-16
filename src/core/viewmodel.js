/**
 * viewmodel.js —— UI 的「一次性取数」入口
 *
 * 冻结约定（docs/CONTRACT.md §3.3）：UI 每个视图只接收本文件产出的 plain object，
 * 不允许在 UI 里 import src/data/ 或 src/core/formulas.js 自己算数值。
 */

import {
  selectTime, selectPhase, selectRankInfo, selectAchievements, selectSlots, selectStudents,
  selectProjects, selectLab, selectMarket, selectActions, selectChronicle, selectPendingEvent,
  selectEnding, selectElection, selectReceipt, selectUiConstants, selectPendingDefer, selectAutoAssign, selectFirstAuthorDrought,
  selectPlayerLead,
} from './selectors.js';

/** 标签页顺序即 UI 渲染顺序（与 index.html 的 data-tab 一一对应）。 */
export const TABS = [
  { id: 'lab', label: '课题组' },
  { id: 'projects', label: '项目' },
  { id: 'market', label: '市场' },
  { id: 'actions', label: '行动' },
  { id: 'chronicle', label: '纪事' },
];

export function buildHud(state) {
  const time = selectTime(state);
  const rank = selectRankInfo(state);
  const ach = selectAchievements(state);
  const slots = selectSlots(state);
  return {
    time,
    rank,
    name: state.player.name,
    sonName: state.player.sonName,
    ageText: state.player.age + ' 岁',
    phase: selectPhase(state),
    money: state.player.money,
    consumable: state.player.consumable,
    consumableLow: selectActions(state).consumableLow,
    consumableHint: selectActions(state).consumableLow ? '耗材见底：去「行动」页采购，否则本月进度归零' : '',
    energy: state.player.energy,
    energyMax: selectActions(state).energyMax,
    health: state.player.health,
    integrity: state.player.integrity,
    achievements: ach,
    slots,
    tickets: state.player.tickets,
    // 延毕决定是「待决状态」：没拍板之前不能推进月份（t8 finding）
    canAdvance: state.phase === 'action' && !state.pendingEvent && !state.ending && selectPendingDefer(state).length === 0,
    election: selectElection(state),
    // t30（前端 t26/t36 的顶栏提示）：一作空窗——months 从第 0 月起算，stuck 由 core 判定。
    firstAuthorDrought: selectFirstAuthorDrought(state),
  };
}

/**
 * 生成整个界面的数据快照。
 * @param {any} state
 * @returns {{hud:any, tabs:any[], crew:any, projects:any, market:any, actions:any, chronicle:any[], pendingEvent:any, ending:any, toast:any}}
 */
export function buildViewModel(state) {
  return {
    hud: buildHud(state),
    tabs: TABS.map((t) => ({ ...t, active: normalTab(state.ui.tab) === t.id })),
    tab: normalTab(state.ui.tab),
    crew: {
      students: selectStudents(state),
      active: selectStudents(state).filter((s) => s.statusLabel === '在读' || s.statusLabel === '延毕中'),
      lab: selectLab(state),
      slots: selectSlots(state),
      achievements: selectAchievements(state),
      rank: selectRankInfo(state),
    },
    projects: {
      list: selectProjects(state).filter((p) => p.status === 'active'),
      archive: selectProjects(state).filter((p) => p.status !== 'active'),
      // v1.7.0：亲带并发上限/已带数量/是否超限（上限由头衔决定，见 selectors.selectPlayerLead）
      lead: selectPlayerLead(state),
    },
    market: selectMarket(state),
    actions: selectActions(state),
    autoAssign: selectAutoAssign(state),
    consts: selectUiConstants(state),
    receipt: selectReceipt(state),
    chronicle: selectChronicle(state),
    pendingEvent: selectPendingEvent(state),
    pendingDefer: selectPendingDefer(state),
    ending: selectEnding(state),
    toast: state.ui.toast,
    canAdvance: state.phase === 'action' && !state.pendingEvent && !state.ending && selectPendingDefer(state).length === 0,
  };
}

/** 兼容旧存档里的 'crew' 之类的写法。 */
export function normalTab(tab) {
  const map = { crew: 'lab', lab: 'lab', projects: 'projects', market: 'market', actions: 'actions', chronicle: 'chronicle' };
  return map[tab] || 'lab';
}

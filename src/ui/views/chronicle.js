/**
 * views/chronicle.js —— 纪事流（右侧速览 + 全量面板）
 *
 * 数据来自 vm.chronicle（core 的 pushChronicle 产物，已经是最新在前）。
 * 筛选只影响「显示」，不改 state（属于展示行为）。
 */

import { $, h, mount, clear, button, tag, uiCard, uiNote, uiEmpty } from '../dom.js';
import { UI_CHRONICLE_FILTERS, UI_EMPTY } from '../copy.js';

function uiEntryNode(c, compact) {
  const cls = 'entry tone-' + (c.tone || 'system') + (compact ? ' entry-compact' : '');
  return h('li', { class: cls, dataset: { kind: c.kind, tone: c.tone } }, [
    h('span', { class: 'entry-time', text: '第 ' + c.year + ' 年 ' + c.month + ' 月' }),
    h('span', { class: 'entry-text', text: c.text }),
  ]);
}

/** 右侧栏：最新几条，密度高一点。 */
export function renderChronicleAside(vm) {
  const list = $('chronicle-list');
  if (!list) return;
  const items = vm.chronicle.slice(0, 12);
  mount(list, items.length ? items.map((c) => uiEntryNode(c, true)) : [h('li', { class: 'muted', text: '还没有纪事。' })]);
}

function uiFilterBar(activeId) {
  return h('div', { class: 'filter-bar' }, UI_CHRONICLE_FILTERS.map((f) => button(f.label, {
    action: 'chronicle-filter', filter: f.id,
  }, { class: 'btn-xs' + (f.id === activeId ? ' active' : ''), kind: f.id === activeId ? 'primary' : null })));
}

function uiMatchFilter(c, filterId) {
  const filter = UI_CHRONICLE_FILTERS.filter((f) => f.id === filterId)[0];
  if (!filter || !filter.kinds) return true;
  return filter.kinds.indexOf(c.kind) >= 0;
}

function uiGrouped(entries) {
  const groups = [];
  let current = null;
  for (const c of entries) {
    const key = '第 ' + c.year + ' 年 ' + c.month + ' 月';
    if (!current || current.key !== key) {
      current = { key, items: [] };
      groups.push(current);
    }
    current.items.push(c);
  }
  return groups.map((g) => h('div', { class: 'chron-group' }, [
    h('h3', { class: 'chron-group-title', text: g.key }),
    h('ul', { class: 'chron-list' }, g.items.map((c) => uiEntryNode(c, false))),
  ]));
}

export function renderChroniclePanel(vm, ctx) {
  const panel = $('panel-chronicle');
  if (!panel) return;
  const filterId = (ctx && ctx.chronicleFilter) || 'all';
  const entries = vm.chronicle.filter((c) => uiMatchFilter(c, filterId));
  const body = [uiFilterBar(filterId)];
  if (entries.length) { for (const group of uiGrouped(entries)) body.push(group); }
  else body.push(uiEmpty(filterId === 'all' ? UI_EMPTY.chronicle : '这一类还没有记录。'));
  body.push(uiNote('纪事是 core 写的流水账：结题、论文、学生异动、事件、晋升、结局都会记一句。右侧栏只显示最近几条。'));
  clear(panel);
  panel.appendChild(uiCard('纪事（' + entries.length + ' / ' + vm.chronicle.length + ' 条）', '一整局发生过的事，全在这儿', null, body));
}

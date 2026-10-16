/**
 * dom.js —— UI 的 DOM 工具层与微型组件
 *
 * 原则（docs/CONTRACT.md §6）：
 *   · 视图全部用 createElement 构造节点（可被 scripts/lib/dom-shim.mjs 驱动）。
 *   · 文本一律走 textContent；本文件永不使用 innerHTML。
 *   · 本文件只做「排版与格式化」，不含任何游戏数值计算：数字都来自 vm。
 *   · HUD 里的挂载点是 <span>，所以凡是可能塞进 HUD 的组件都必须用行内元素。
 */

import { uiIcon } from './icons.js';
import { UI_PAPER_TILE } from './copy.js';

export const $ = (id) => document.getElementById(id);

/** 递归拍平 children：数组可以任意嵌套，最终只留节点与文本（浏览器 appendChild 不接受数组）。 */
function uiFlatten(children, out = []) {
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) uiFlatten(child, out);
    else out.push(child);
  }
  return out;
}

/** 创建元素：h('div', { class:'x', dataset:{a:'1'}, text:'hi', attrs:{title:'…'} }, [child]) */
export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined && attrs.text !== null) node.textContent = String(attrs.text);
  if (attrs.attrs) for (const [k, v] of Object.entries(attrs.attrs)) node.setAttribute(k, String(v));
  if (attrs.dataset) for (const [k, v] of Object.entries(attrs.dataset)) node.dataset[k] = String(v);
  if (attrs.on) for (const [k, v] of Object.entries(attrs.on)) node.addEventListener(k, v);
  for (const child of uiFlatten(children)) {
    node.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** 用新节点替换容器内容。 */
export function mount(node, children) {
  if (!node) return node;
  clear(node);
  for (const child of uiFlatten(children)) {
    node.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function show(node, visible) {
  if (!node) return node;
  if (visible) node.removeAttribute('hidden');
  else node.setAttribute('hidden', 'hidden');
  return node;
}

/* ── 基础零件 ── */

function uiPctValue(pct) {
  const value = Number(pct);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** 进度条（块级）：pct 0-100。label 可选，显示在右侧。 */
export function bar(pct, tone, label) {
  const value = uiPctValue(pct);
  const track = h('div', { class: 'bar ' + (tone ? 'tone-' + tone : ''), dataset: { role: 'bar', value: String(Math.round(value)) } }, [
    h('div', { class: 'bar-fill', attrs: { style: 'width:' + value + '%' } }),
  ]);
  if (label === undefined || label === null || label === '') return track;
  return h('div', { class: 'bar-wrap' }, [track, h('span', { class: 'bar-label', text: String(label) })]);
}

/** 行内迷你进度条（可塞进 HUD 的 span）：pct 0-100。 */
export function uiInlineBar(pct, tone) {
  const value = uiPctValue(pct);
  return h('span', { class: 'mini-bar ' + (tone ? 'tone-' + tone : ''), dataset: { role: 'mini-bar', value: String(Math.round(value)) } }, [
    h('span', { class: 'mini-bar-fill', attrs: { style: 'width:' + value + '%' } }),
  ]);
}

/** 小标签。tone：good / bad / warn / info / mute / tier-top … */
export function tag(text, tone) {
  return h('span', { class: 'chip ' + (tone ? 'tone-' + tone : ''), text });
}

/** 按钮。dataset 自动带上 data-action；opts: { class, kind, disabled, title } */
export function button(label, dataset, opts = {}) {
  const attrs = { type: 'button' };
  if (opts.title) attrs.title = opts.title;
  const cls = ['btn'];
  if (opts.kind) cls.push('btn-' + opts.kind);
  if (opts.class) cls.push(opts.class);
  if (opts.disabled) cls.push('is-disabled');
  const node = h('button', { class: cls.join(' '), text: label, attrs, dataset });
  if (opts.disabled) node.disabled = true;
  return node;
}

/* ── 行内组合件（HUD 专用） ── */

/** 行内「标签 + 数值」：塞进 #hud-* 的 span 里也是合法 HTML。 */
export function uiInlineStat(labelText, valueText, tone, icon) {
  return h('span', { class: 'stat' + (tone ? ' tone-' + tone : '') }, [
    icon ? uiIcon(icon) : null,
    h('span', { class: 'stat-k', text: labelText }),
    h('span', { class: 'stat-v', text: valueText === undefined || valueText === null ? '—' : String(valueText) }),
  ]);
}

/** 行内「标签 + 数值 + 迷你条」：精力/健康/诚信这类有上限的资源。 */
export function uiInlineMeter(labelText, valueText, pct, tone, icon) {
  return h('span', { class: 'stat stat-meter' + (tone ? ' tone-' + tone : '') }, [
    icon ? uiIcon(icon) : null,
    h('span', { class: 'stat-k', text: labelText }),
    h('span', { class: 'stat-v', text: String(valueText) }),
    uiInlineBar(pct, tone),
  ]);
}

/**
 * 行内分区计数：正刊/一区/二区/三区/四区。
 * 语义（t24 之后，见 docs/GDD.md §2.7）：
 *   · 主数字 r.count ＝ 你的一作篇数（core 只把「你是一作」的论文记进 player.papers，晋升门槛按它算）；
 *   · 副标记 papersFirst[tier] ＝ 其中抢学生 / 花钱买来的一作台账（是子集，不是另一套口径）。
 * 两个数都来自 vm.hud.achievements，UI 不做任何推导。
 */
export function uiPaperTiles(ranks, papersFirst) {
  const first = papersFirst || {};
  const tiles = (ranks || []).map((r) => {
    const grabbed = first[r.tier] || 0;
    return h('span', { class: 'paper-tile tone-' + r.tier, dataset: { role: 'paper-tile', tier: r.tier } }, [
      h('span', { class: 'paper-tile-k', text: r.label }),
      h('span', { class: 'paper-tile-v', text: String(r.count) }),
      h('span', {
        class: 'paper-tile-first',
        attrs: { title: UI_PAPER_TILE.title.replace('{tier}', r.label).replace('{count}', String(r.count)).replace('{grabbed}', String(grabbed)) },
        text: UI_PAPER_TILE.first.replace('{n}', String(r.count)),
      }),
      grabbed
        ? h('span', {
          class: 'paper-tile-grabbed',
          attrs: { title: UI_PAPER_TILE.grabbedTitle.replace('{tier}', r.label).replace('{n}', String(grabbed)) },
          text: UI_PAPER_TILE.grabbed.replace('{n}', String(grabbed)),
        })
        : null,
    ]);
  });
  return h('span', { class: 'paper-tiles' }, tiles);
}

/* ── 块级组合件 ── */

/** 卡片：section.card > 头（标题/副标题/右侧操作） + 内容。 */
export function uiCard(titleText, subtitleText, rightNodes, children, opts = {}) {
  const head = h('div', { class: 'card-head' }, [
    h('div', { class: 'card-title-wrap' }, [
      h('h2', { class: 'card-title', text: titleText }),
      subtitleText ? h('p', { class: 'card-sub', text: subtitleText }) : null,
    ]),
    rightNodes && rightNodes.length ? h('div', { class: 'card-actions' }, rightNodes) : null,
  ]);
  return h('section', { class: 'card ' + (opts.class || '') }, [head, h('div', { class: 'card-body' }, children)]);
}

/** 子标签条（课题组页内的 学生/仪器/耗材 切换）。 */
export function uiSubTabs(items, activeId, actionName) {
  return h('nav', { class: 'subtabs', dataset: { role: 'subtabs' } }, (items || []).map((it) => {
    const active = it.id === activeId;
    return h('button', {
      class: 'subtab' + (active ? ' active' : ''),
      attrs: { type: 'button', title: it.hint || '' },
      dataset: { role: 'subtab', action: actionName, section: it.id },
      text: it.label,
    });
  }));
}

/** 空态：一句话告诉玩家下一步做什么。 */
export function uiEmpty(text) {
  return h('p', { class: 'empty', text });
}

/** 块级「键 : 值」行。 */
export function uiKv(labelText, valueText, tone) {
  return h('div', { class: 'kv' + (tone ? ' tone-' + tone : '') }, [
    h('span', { class: 'kv-k', text: labelText }),
    h('span', { class: 'kv-v', text: valueText === undefined || valueText === null ? '—' : String(valueText) }),
  ]);
}

/** 小字说明。 */
export function uiNote(text, tone) {
  return h('p', { class: 'note' + (tone ? ' tone-' + tone : ''), text });
}

/** 一行可换行的按钮组。 */
export function uiBtnRow(nodes, opts = {}) {
  return h('div', { class: 'btn-row ' + (opts.class || '') }, nodes);
}

/** 网格容器。 */
export function uiGrid(className, children) {
  return h('div', { class: 'grid ' + (className || '') }, children);
}

/** 跳转到某个标签页（可顺带指定课题组页内的分栏）。 */
export function uiGoto(labelText, tab, opts = {}) {
  const dataset = { action: 'goto-tab', tab };
  if (opts.section) dataset.section = opts.section;
  return button(labelText, dataset, { class: 'btn-ghost btn-xs ' + (opts.class || ''), title: opts.title || '' });
}

/* ── 格式化（只做展示，不做业务计算） ── */

/** 一位小数，整数不带 .0 */
export function uiNum1(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10) / 10;
  return String(r);
}

export function fmtMoney(v) {
  return uiNum1(v) + ' 万';
}

export function fmtIF(v) {
  return uiNum1(v);
}

export function fmtPct(v) {
  return uiNum1(v) + '%';
}

/** 带符号的展示文本：+3 / −2 / 0（负号用 U+2212，排版更整齐）。 */
export function uiDeltaText(v, unit) {
  const n = Number(v);
  const suffix = unit ? ' ' + unit : '';
  if (!Number.isFinite(n) || Math.round(n * 10) === 0) return '0' + suffix;
  const abs = uiNum1(Math.abs(n));
  return (n > 0 ? '+' : '−') + abs + suffix;
}

/** 只用于配色的三档视觉阈值（与任何游戏规则无关，纯粹是「看起来要出事」的提示）。 */
export function uiLevelTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n <= 20) return 'bad';
  if (n <= 45) return 'warn';
  return 'good';
}

/** 涨跌色调：up / down / flat。 */
export function uiDeltaTone(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.round(n * 10) === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

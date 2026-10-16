/**
 * icons.js —— 界面图标的唯一来源（全部在构建时内联成 SVG 元素，零网络请求）
 *
 * 素材：Lucide Icons（ISC 许可证，与 MIT 发布相容）
 *   · 包：lucide-static@1.57.0（registry.npmjs.org），逐图标取自 package/icons/<name>.svg
 *   · 版权：Copyright (c) Lucide Icons and Contributors，许可证全文见 docs/ASSETS.md 附录
 *   · 只取「描边路径数据」，不复制其文件/类名；统一 stroke=currentColor，跟随本站 CSS 变量着色
 *   · 逐条登记见 docs/ASSETS.md（名称 / 来源 URL / 许可证 / 作者 / 用途 / 是否内联）
 *
 * 另外：本文件不含任何游戏数值，也不 import src/data / src/core —— 只负责把图标画出来。
 */

/** 所有图标共用 Lucide 的 24×24 / stroke-width 2 网格。 */
export const ICON_VIEWBOX = '0 0 24 24';

/** id → 图元数组（t = 标签名，a = 属性；只保留几何属性，样式统一由 CSS 控制）。 */
export const ICON_SHAPES = {
  'coins': [
    { t: 'path', a: {"d":"M13.744 17.736a6 6 0 1 1-7.48-7.48"} },
    { t: 'path', a: {"d":"M15 6h1v4"} },
    { t: 'path', a: {"d":"m6.134 14.768.866-.5 2 3.464"} },
    { t: 'circle', a: {"cx":"16","cy":"8","r":"6"} },
  ],
  'flask-conical': [
    { t: 'path', a: {"d":"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"} },
    { t: 'path', a: {"d":"M6.453 15h11.094"} },
    { t: 'path', a: {"d":"M8.5 2h7"} },
  ],
  'zap': [
    { t: 'path', a: {"d":"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"} },
  ],
  'heart-pulse': [
    { t: 'path', a: {"d":"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"} },
    { t: 'path', a: {"d":"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"} },
  ],
  'shield-check': [
    { t: 'path', a: {"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"} },
    { t: 'path', a: {"d":"m9 12 2 2 4-4"} },
  ],
  'trending-up': [
    { t: 'path', a: {"d":"M16 7h6v6"} },
    { t: 'path', a: {"d":"m22 7-8.5 8.5-5-5L2 17"} },
  ],
  'ticket': [
    { t: 'path', a: {"d":"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"} },
    { t: 'path', a: {"d":"M13 5v2"} },
    { t: 'path', a: {"d":"M13 17v2"} },
    { t: 'path', a: {"d":"M13 11v2"} },
  ],
  'graduation-cap': [
    { t: 'path', a: {"d":"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"} },
    { t: 'path', a: {"d":"M22 10v6"} },
    { t: 'path', a: {"d":"M6 12.5V16a6 3 0 0 0 12 0v-3.5"} },
  ],
  'calendar-days': [
    { t: 'path', a: {"d":"M8 2v3"} },
    { t: 'path', a: {"d":"M16 2v3"} },
    { t: 'rect', a: {"x":"3","y":"3","width":"18","height":"18","rx":"2"} },
    { t: 'path', a: {"d":"M3 9h18"} },
    { t: 'path', a: {"d":"M8 13h.01"} },
    { t: 'path', a: {"d":"M12 13h.01"} },
    { t: 'path', a: {"d":"M16 13h.01"} },
    { t: 'path', a: {"d":"M8 17h.01"} },
    { t: 'path', a: {"d":"M12 17h.01"} },
    { t: 'path', a: {"d":"M16 17h.01"} },
  ],
  'badge-check': [
    { t: 'path', a: {"d":"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"} },
    { t: 'path', a: {"d":"m16 9-5.5 5.5L8 12"} },
  ],
  'folder-open': [
    { t: 'path', a: {"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"} },
  ],
  'users-round': [
    { t: 'path', a: {"d":"M18 21a8 8 0 0 0-16 0"} },
    { t: 'circle', a: {"cx":"10","cy":"8","r":"5"} },
    { t: 'path', a: {"d":"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"} },
  ],
  'activity': [
    { t: 'path', a: {"d":"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"} },
  ],
  'scroll-text': [
    { t: 'path', a: {"d":"M15 12h-5"} },
    { t: 'path', a: {"d":"M15 8h-5"} },
    { t: 'path', a: {"d":"M19 17V5a2 2 0 0 0-2-2H4"} },
    { t: 'path', a: {"d":"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"} },
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 画一个图标。
 * @param {string} name ICON_SHAPES 里的 id
 * @param {{class?:string, title?:string, size?:number}} [opts]
 * @returns {Element} <svg class="ico ...">；宿主不支持 SVG 时降级成空的 <span>（脚本/无头环境不至于崩）
 */
export function uiIcon(name, opts = {}) {
  const shapes = ICON_SHAPES[name] || null;
  const doc = typeof document === 'undefined' ? null : document;
  const canSvg = Boolean(doc && typeof doc.createElementNS === 'function' && shapes);
  if (!canSvg) {
    return doc ? doc.createElement('span') : null;
  }
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', ICON_VIEWBOX);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'ico' + (opts.class ? ' ' + opts.class : ''));
  if (opts.title) {
    svg.setAttribute('role', 'img');
    svg.removeAttribute('aria-hidden');
    const t = doc.createElementNS(SVG_NS, 'title');
    t.textContent = String(opts.title);
    svg.appendChild(t);
  }
  for (const shape of shapes) {
    const node = doc.createElementNS(SVG_NS, shape.t);
    for (const [k, v] of Object.entries(shape.a)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}

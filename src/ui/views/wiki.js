/**
 * views/wiki.js —— 游戏内百科（v1.5.0）
 *
 * 硬约束（_probe/wiki-1.5-spec.md ①）：本文件只负责排版，**不出现任何游戏数值字面量**。
 * 全部数字来自 vm.consts.wiki —— 由 src/core/selectors.js 的 selectWiki() 从 src/data 组装。
 *
 * 每个词条渲染成 [data-wiki-key="<key>"]，scripts/ui-smoke.mjs 用这个契约把
 * 页面上的数字与 core 常量逐项对账（防漂移）。
 */
import { h } from '../dom.js';
import { UI_WIKI } from '../copy.js';

function uiWikiRow(row) {
  return h('div', { class: 'wiki-row', dataset: { wikiKey: row.key } }, [
    h('span', { class: 'wiki-k', text: row.label }),
    h('span', { class: 'wiki-v', text: row.value }),
    row.note ? h('span', { class: 'wiki-note', text: row.note }) : null,
  ]);
}

function uiWikiChapter(chapter) {
  return h('section', { class: 'wiki-chapter', dataset: { role: 'wiki-chapter', wikiChapter: chapter.id } }, [
    h('div', { class: 'wiki-chapter-head' }, [
      h('span', { class: 'wiki-chapter-no', text: UI_WIKI.chapterOf.replace('{no}', String(chapter.no)) }),
      h('h3', { class: 'wiki-chapter-name', text: chapter.title }),
    ]),
    chapter.intro ? h('p', { class: 'wiki-intro', text: chapter.intro }) : null,
    h('div', { class: 'wiki-rows' }, (chapter.rows || []).map(uiWikiRow)),
  ]);
}

/** 渲染整本百科；core 没给出数据时返回 null（弹层只留新手说明）。 */
export function uiWikiView(wiki) {
  const chapters = wiki && Array.isArray(wiki.chapters) ? wiki.chapters : [];
  if (!chapters.length) return null;
  return h('div', { class: 'wiki', dataset: { role: 'wiki' } }, [
    h('div', { class: 'wiki-head' }, [
      h('h3', { class: 'wiki-title', text: UI_WIKI.title }),
      h('p', { class: 'wiki-sub', text: UI_WIKI.subtitle }),
    ]),
    h('div', { class: 'wiki-index', dataset: { role: 'wiki-index' } },
      chapters.map((c) => h('span', { class: 'wiki-index-chip', text: c.no + '. ' + c.title }))),
    h('div', { class: 'wiki-body' }, chapters.map(uiWikiChapter)),
    h('p', { class: 'wiki-foot', text: UI_WIKI.footnote }),
  ]);
}

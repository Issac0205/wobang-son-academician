#!/usr/bin/env node
/**
 * asset-audit.mjs —— 单文件离线合规审计
 *
 * 本项目要交付「双击即玩、离线可用」的单文件 dist/wobang-son-academician.html，
 * 同时以 MIT 发布。这个脚本负责把两条硬约束变成可复跑的数字：
 *   ① 外部引用数 = 0（任何 http(s) 资源、<link>/<script> 外链、CSS url() 非 data URI）
 *   ② 素材全部内联（内联 <svg> 与 data: URI 计数，供 docs/ASSETS.md 对账）
 * XML 命名空间（xmlns="http://www.w3.org/2000/svg"）不是网络引用，先剥离再统计。
 *
 * 用法：node 评院士/scripts/asset-audit.mjs   （退出码 0 = 合规）
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist', 'wobang-son-academician.html');
const html = readFileSync(DIST, 'utf8');
const bytes = Buffer.byteLength(html);

// 命名空间 URI（SVG/XHTML/XLINK）是标识符，不是网络引用：先按白名单剥离
const NS_ALLOW = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
];
let stripped = html;
for (const ns of NS_ALLOW) stripped = stripped.split(ns).join(' ');
stripped = stripped.replace(/xmlns(:\w+)?=("[^"]*"|'[^']*')/g, '');
const httpRefs = Array.from(new Set((stripped.match(/https?:\/\/[^\s"'()<>]+/g) || [])));
const extAttrs = Array.from(new Set((html.match(/(?:href|src)\s*=\s*("[^"]*"|'[^']*')/gi) || [])
  .map((s) => s.replace(/^[a-z]+\s*=\s*["']?/i, '').replace(/["']$/, ''))
  .filter((u) => /^(https?:)?\/\//i.test(u))));
const cssUrls = Array.from(new Set((html.match(/url\(\s*["']?([^"')]+)["']?\s*\)/g) || [])
  .map((s) => s.replace(/^url\(\s*["']?/, '').replace(/["']?\s*\)$/, ''))
  .filter((u) => !u.startsWith('data:'))));
const dataUris = (html.match(/data:[a-z0-9.+-]+\/[a-z0-9.+-]+(;base64)?,/gi) || []).length;
const inlineSvg = (html.match(/<svg[\s>]/gi) || []).length;
// 内联图标：src/ui/icons.js 的 ICON_SHAPES 条目被打包进单文件（运行时 createElementNS 画出，无外部请求）
const iconBlock = (html.match(/ICON_SHAPES\s*=\s*\{([\s\S]*?)\n\};/) || ['', ''])[1];
const iconCount = (iconBlock.match(/^\s*'[a-z0-9-]+':\s*\[/gm) || []).length;
const styleBlocks = (html.match(/<style[\s>]/gi) || []).length;
const scriptBlocks = (html.match(/<script[\s>]/gi) || []).length;

const bad = httpRefs.length + extAttrs.length + cssUrls.length;
console.log('『我帮儿子评院士』单文件离线合规审计');
console.log('  文件：dist/wobang-son-academician.html');
console.log('  体积：' + (bytes / 1024).toFixed(0) + ' KB（' + bytes + ' 字节）');
console.log('  外部网络引用：' + httpRefs.length + (httpRefs.length ? ' → ' + httpRefs.join(' / ') : '（合规；XML 命名空间已按白名单排除）'));
console.log('  外链 <link>/<script>：' + extAttrs.length + (extAttrs.length ? ' → ' + extAttrs.join(' / ') : '（合规）'));
console.log('  CSS url() 非 data URI：' + cssUrls.length + (cssUrls.length ? ' → ' + cssUrls.join(' / ') : '（合规）'));
console.log('  内联 <style> / <script>：' + styleBlocks + ' / ' + scriptBlocks);
console.log('  内联图标（ICON_SHAPES 条目）：' + iconCount + ' 个（运行时 createElementNS 内联渲染）');
console.log('  字面 <svg> 出现：' + inlineSvg + ' 次（含注释里的示例文本，仅供参考）');
console.log('  内联 data: URI：' + dataUris + ' 处');
console.log(bad === 0 ? '  结论：合规（0 个外部引用，可离线双击运行）' : '  结论：不合规（' + bad + ' 个外部引用）');
process.exit(bad === 0 ? 0 : 1);

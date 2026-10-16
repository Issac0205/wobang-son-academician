#!/usr/bin/env node
/**
 * build-single.mjs —— 打包成「双击即玩」的单文件 HTML（必须退出码 0）
 *
 * 打包策略（与先例 xiuxian-family 一致，但补齐了路径解析）：
 *   1 从 src/main.js 出发做深度优先遍历（后序遍历 = 依赖在前）
 *   2 只支持静态相对导入：import { a, b } from './x.js'
 *   3 剥掉 import / export 关键字，把所有模块拼成一段代码
 *   4 顶层标识符重名直接报错退出（避免静默覆盖）
 *   5 把 index.html 的 <link> 换成 <style>，<script src> 换成内联脚本
 *   6 写 dist/wobang-son-academician.html
 *
 * 用法：node 评院士/scripts/build-single.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'src', 'main.js');
const CSS_FILE = join(ROOT, 'src', 'styles', 'main.css');
const INDEX_FILE = join(ROOT, 'index.html');
const OUT_DIR = join(ROOT, 'dist');
const OUT_FILE = join(OUT_DIR, 'wobang-son-academician.html');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const IMPORT_RE = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const EXPORT_KEYWORD_RE = /^[ \t]*export\s+(?=(?:const|let|var|function|class|async))/gm;
const EXPORT_LIST_RE = /^[ \t]*export\s*\{[\s\S]*?\};?[ \t]*$/gm;
const EXPORT_DEFAULT_RE = /^[ \t]*export\s+default\s+.*$/gm;
// 只统计「列 0 的顶层声明」：函数体内部的同名变量不算冲突
const DECL_RE = /^(?:const|let|var|function|class|async\s+function)\s+([A-Za-z0-9_$]+)/gm;

const order = [];
const seen = new Set();
const modules = new Map();

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!existsSync(file)) throw new Error('找不到模块：' + relative(ROOT, file));
  const text = readFileSync(file, 'utf8');
  modules.set(file, text);
  const deps = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[2];
    if (!spec.startsWith('.')) {
      throw new Error('单文件打包不支持裸模块导入：' + spec + '（来自 ' + relative(ROOT, file) + '）');
    }
    deps.push(resolve(dirname(file), spec));
  }
  for (const dep of deps) visit(dep);
  order.push(file);
}

visit(ENTRY);

const declared = new Map();
const chunks = [];
for (const file of order) {
  const raw = modules.get(file);
  const cleaned = raw
    .replace(IMPORT_RE, '')
    .replace(EXPORT_DEFAULT_RE, '')
    .replace(EXPORT_LIST_RE, '')
    .replace(EXPORT_KEYWORD_RE, '');
  DECL_RE.lastIndex = 0;
  let m;
  while ((m = DECL_RE.exec(cleaned))) {
    const name = m[1];
    if (declared.has(name)) {
      console.error('顶层标识符重名：' + name + '（' + relative(ROOT, declared.get(name)) + ' 与 ' + relative(ROOT, file) + '）');
      process.exit(1);
    }
    declared.set(name, file);
  }
  chunks.push('/* ── ' + relative(ROOT, file).split(String.fromCharCode(92)).join('/') + ' ── */\n' + cleaned.trim());
}

const bundle = chunks.join('\n\n');
if (/^[ \t]*(?:import|export)\s/m.test(bundle)) {
  console.error('打包后仍残留 import/export，请检查 src/ 里是否用了不支持的写法。');
  process.exit(1);
}

const css = readFileSync(CSS_FILE, 'utf8');
let html = readFileSync(INDEX_FILE, 'utf8');

const linkRe = /<link[^>]*href="\.\/src\/styles\/main\.css"[^>]*>/;
const scriptRe = /<script[^>]*src="\.\/src\/main\.js"[^>]*><\/script>/;
if (!linkRe.test(html)) { console.error('index.html 里找不到 main.css 的 <link>'); process.exit(1); }
if (!scriptRe.test(html)) { console.error('index.html 里找不到 src/main.js 的 <script>'); process.exit(1); }

const banner = '<!-- 我帮儿子评院士 v' + pkg.version + ' · 单文件构建 · ' + new Date().toISOString()
  + ' · 源码：' + order.length + ' 个模块（纯前端 ES Module，零构建依赖） -->';
html = html.replace('<!doctype html>', '<!doctype html>\n' + banner);
html = html.replace(linkRe, '<style>\n' + css.trim() + '\n</style>');
html = html.replace(scriptRe, '<script type="module">\n' + bundle + '\n</script>');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html, 'utf8');

const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
console.log('');
console.log('单文件打包完成');
console.log('  模块：' + order.length + ' 个（' + order.map((f) => relative(ROOT, f).split(String.fromCharCode(92)).join('/')).join(' → ') + '）');
console.log('  产物：' + OUT_FILE);
console.log('  大小：' + kb + ' KB（含内联 CSS / JS，无外部依赖，双击即玩）');
console.log('');
process.exit(0);

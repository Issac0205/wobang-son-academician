#!/usr/bin/env node
/**
 * check.mjs —— 脚手架自检（必须退出码 0）
 *
 * 检查项（全静态、零依赖、不启动浏览器）：
 *   1 交付物清单：关键文件都在
 *   2 语法：node --check 每个 .js/.mjs
 *   3 导入完整性：相对导入的路径存在、具名导入在目标文件里真的导出
 *   4 DOM 契约：src/ui 里 $('x') / getElementById('x') 的 id 必须出现在 index.html
 *   5 交互契约：UI 里用到的 data-action 必须在 src/ui/app.js 的 HANDLERS 里注册
 *   6 静态资源：index.html 引用的 css/js 存在
 *   7 数据纯度：src/data/** 不许 import 任何东西（只放数据）
 *   8 确定性：src/core/** 不许用 Math.random / Date.now（随机必须走 core/rng.js）
 *   9 数据规模：逐个数 names.js 的数组是否达到它自己声明的 NAME_DATA_TARGET（BALANCE §14），只发 WARN
 *  10 断言脚本齐全：四个必测面 + 存档往返 + 平衡回归
 *  11 core 小数常量白名单：游戏数值必须住在 src/data/
 *  12 统计红线两侧可失败：tests/ 里禁止反向断言 / 由被测数据反推的判定阈值（t14）
 *
 * 用法：node 评院士/scripts/check.mjs   （cwd 任意，路径按本文件位置解析）
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const errors = [];
const warnings = [];
const ok = [];

/** 去掉注释与字符串，避免把注释里的示例当成真实调用。 */
function stripComments(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const rel = (p) => relative(ROOT, p).split(String.fromCharCode(92)).join('/');
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const read = (p) => readFileSync(p, 'utf8');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* ── 1 交付物清单 ── */
const REQUIRED = [
  'index.html', 'server.mjs', 'package.json', '.gitignore',
  'src/main.js', 'src/core/engine.js', 'src/core/state.js', 'src/core/store.js', 'src/core/rules.js',
  'src/core/formulas.js', 'src/core/save.js', 'src/core/rng.js', 'src/core/selectors.js',
  'src/core/viewmodel.js', 'src/core/naming.js',
  'src/ui/app.js', 'src/ui/dom.js', 'src/ui/hud.js', 'src/ui/modal.js',
  'src/ui/views/crew.js', 'src/ui/views/projects.js', 'src/ui/views/market.js', 'src/ui/views/actions.js', 'src/ui/views/chronicle.js',
  'src/data/tuning.js', 'src/data/ranks.js', 'src/data/instruments.js', 'src/data/projects.js',
  'src/data/papers.js', 'src/data/hardpoints.js', 'src/data/students.js', 'src/data/market.js',
  'src/data/actions.js', 'src/data/endings.js', 'src/data/events.js', 'src/data/names.js',
  'src/styles/main.css', 'scripts/check.mjs', 'scripts/simulate.mjs', 'scripts/ui-smoke.mjs',
  'scripts/build-single.mjs', 'scripts/version.mjs', 'scripts/lib/dom-shim.mjs',
  'docs/ARCHITECTURE.md', 'docs/CONTRACT.md', 'docs/DEV.md',
  'src/systems/bots.js',
  'tests/run-all.mjs', 'tests/lib/harness.mjs', 'tests/promotion.test.mjs',
  'tests/happiness.test.mjs', 'tests/project.test.mjs', 'tests/market.test.mjs',
  'tests/balance.test.mjs', 'tests/save.test.mjs',
];
const missingFiles = REQUIRED.filter((p) => !existsSync(join(ROOT, p)));
if (missingFiles.length) err('缺少交付物：' + missingFiles.join('、'));
else ok.push('交付物清单 ' + REQUIRED.length + ' 项齐全');

/* ── 2 语法 ── */
const jsFiles = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'scripts')),
  ...walk(join(ROOT, 'tests')),
  join(ROOT, 'server.mjs'),
].filter((p) => ['.js', '.mjs'].includes(extname(p)));

let syntaxBad = 0;
for (const file of jsFiles) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    syntaxBad += 1;
    err('语法错误 ' + rel(file) + '：\n' + String(res.stderr || '').split('\n').slice(0, 6).join('\n'));
  }
}
if (!syntaxBad) ok.push('语法检查通过（' + jsFiles.length + ' 个文件）');

/* ── 3 导入完整性 ── */
const EXPORT_RE = /export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
const EXPORT_LIST_RE = /export\s*\{([\s\S]*?)\}/g;
const IMPORT_RE = /import\s*(?:\{([\s\S]*?)\})?\s*(?:[A-Za-z0-9_$]+\s*,\s*)?(?:\*\s*as\s*[A-Za-z0-9_$]+\s*)?from\s*['"]([^'"]+)['"]/g;

function exportNames(file) {
  const text = stripComments(read(file));
  const names = new Set();
  let m;
  while ((m = EXPORT_RE.exec(text))) names.add(m[1]);
  while ((m = EXPORT_LIST_RE.exec(text))) {
    for (const piece of m[1].split(',')) {
      const t = piece.trim();
      if (!t) continue;
      const asMatch = t.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      names.add(asMatch ? asMatch[2] : t.replace(/^type\s+/, ''));
    }
  }
  return names;
}

let importBad = 0;
for (const file of jsFiles) {
  const text = stripComments(read(file));   // 注释里的示例 import 不算依赖
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text))) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) {
      importBad += 1;
      err('导入路径不存在：' + rel(file) + ' → ' + spec);
      continue;
    }
    const names = (m[1] || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const t = s.replace(/^type\s+/, '');
      const asMatch = t.match(/^([A-Za-z0-9_$]+)\s+as\s+[A-Za-z0-9_$]+$/);
      return asMatch ? asMatch[1] : t;
    });
    if (names.length === 0) continue;
    const exported = exportNames(target);
    const hasDefault = /export\s+default/.test(stripComments(read(target)));
    for (const name of names) {
      if (name === 'default') continue;
      if (!exported.has(name) && !hasDefault) {
        importBad += 1;
        err('具名导入不存在：' + rel(file) + ' 里的 ' + name + '（来自 ' + spec + '）');
      }
    }
  }
}
if (!importBad) ok.push('导入完整性通过（相对路径 + 具名导出）');

/* ── 4 DOM 契约 ── */
const html = read(join(ROOT, 'index.html'));
const htmlIds = new Set();
{
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) htmlIds.add(m[1]);
}
const uiFiles = walk(join(ROOT, 'src', 'ui')).filter((p) => extname(p) === '.js');
let domBad = 0;
for (const file of uiFiles) {
  const text = read(file);
  const re = /(?:\$|getElementById)\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    if (!htmlIds.has(m[1])) {
      domBad += 1;
      err('DOM 契约：' + rel(file) + ' 用了 $(' + m[1] + ')，但 index.html 里没有这个 id');
    }
  }
}
if (!domBad) ok.push('DOM 契约通过（src/ui 引用的 ' + htmlIds.size + ' 个 id 都在 index.html 里）');

/* ── 5 data-action 覆盖 ── */
const appText = read(join(ROOT, 'src', 'ui', 'app.js'));
const handlers = new Set();
{
  const re = /'([a-z][a-z0-9-]*)'\s*:/g;
  let m;
  const handlersStart = appText.indexOf('const HANDLERS');
  const handlersEnd = appText.indexOf('function dispatch');
  const block = appText.slice(handlersStart, handlersEnd);
  while ((m = re.exec(block))) handlers.add(m[1]);
}
const usedActions = new Set();
for (const file of [...uiFiles, join(ROOT, 'index.html')]) {
  const text = read(file);
  const patterns = [/action:\s*'([a-z][a-z0-9-]*)'/g, /data-action="([a-z][a-z0-9-]*)"/g, /dataset:\s*\{\s*action:\s*'([a-z][a-z0-9-]*)'/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) usedActions.add(m[1]);
  }
}
const unhandled = [...usedActions].filter((a) => !handlers.has(a));
if (unhandled.length) err('这些 data-action 没有在 src/ui/app.js 的 HANDLERS 里注册：' + unhandled.join('、'));
else ok.push('交互契约通过（' + usedActions.size + ' 个 data-action 全部有处理函数）');

/* ── 6 静态资源 ── */
{
  const re = /(?:href|src)="(\.\/[^"]+)"/g;
  let m;
  const missing = [];
  while ((m = re.exec(html))) {
    if (!existsSync(join(ROOT, m[1]))) missing.push(m[1]);
  }
  if (missing.length) err('index.html 引用的静态资源不存在：' + missing.join('、'));
  else ok.push('静态资源引用通过');
}

/* ── 7 数据纯度 ── */
{
  const dataFiles = walk(join(ROOT, 'src', 'data')).filter((p) => extname(p) === '.js');
  const dirty = dataFiles.filter((p) => /^\s*import\s/m.test(stripComments(read(p))));
  if (dirty.length) err('src/data 只允许放数据，不能 import：' + dirty.map(rel).join('、'));
  else ok.push('数据纯度通过（' + dataFiles.length + ' 个数据文件零 import）');
}

/* ── 8 确定性 ── */
{
  const coreFiles = walk(join(ROOT, 'src', 'core')).filter((p) => extname(p) === '.js');
  // 这三个文件里的 Date.now 只用于「元数据」：新局种子 / 存档时间戳 / 调试历史，
  // 不参与任何游戏数值，因此允许；其余 core 文件必须纯粹由 state.rng 驱动。
  const allowTime = ['state.js', 'save.js', 'store.js'];
  const bad = [];
  for (const file of coreFiles) {
    const raw = read(file);
    const text = stripComments(raw);
    const name = file.split(/[\\/]/).pop();
    if (/Math\.random\s*\(/.test(text)) bad.push(rel(file) + ' 用了 Math.random');
    if (/Date\.now\s*\(/.test(text) && !allowTime.includes(name)) bad.push(rel(file) + ' 用了 Date.now');
  }
  if (bad.length) err('确定性检查失败：' + bad.join('；'));
  else ok.push('确定性通过（core 里没有 Math.random；Date.now 只允许出现在 state.js（新局种子兜底）/ save.js（存档时间戳）/ store.js（调试历史）这三处元数据，不参与任何游戏数值）');
}

/* ── 9 数据规模（WARN；尺子 = src/data/names.js 的 NAME_DATA_TARGET，不再硬编码） ──
   t28：原来这里写死 `const target = 150`，而文档/数据层的目标其实是 186/240/260/200——
   结果「扩到 150」就能把 4 条警告全部消掉，尺子和目标不是同一个数（绿色信号不代表它声称的含义）。
   现在直接导入 NAME_DATA_TARGET 逐个比，含 SURNAMES_COMPOUND / NAME_BLOCKLIST / HOMOPHONE_BLOCK。 */
{
  const names = read(join(ROOT, 'src', 'data', 'names.js'));
  const { NAME_DATA_TARGET } = await import(pathToFileURL(join(ROOT, 'src', 'data', 'names.js')).href);
  const countOf = (name) => {
    const m = names.match(new RegExp('export const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    if (!m) return 0;
    return (m[1].match(/\{[^}]*\}|'[^']*'/g) || []).length;
  };
  let short = 0;
  for (const [key, target] of Object.entries(NAME_DATA_TARGET)) {
    const got = countOf(key);
    if (got < target) {
      short += 1;
      warn('字库 ' + key + ' 未达目标 ' + got + '/' + target + ' 条（目标来自 src/data/names.js 的 NAME_DATA_TARGET / BALANCE §14）；逻辑已可用，扩表只加数组条目');
    }
  }
  if (!short) ok.push('字库规模达标（' + Object.keys(NAME_DATA_TARGET).length + ' 个数组全部 ≥ NAME_DATA_TARGET）');
}

/* ── 10 断言脚本：四个必测面 + 平衡回归都得在 ── */
{
  const need = {
    '晋升判定': 'tests/promotion.test.mjs',
    '幸福度衰减': 'tests/happiness.test.mjs',
    '项目结题': 'tests/project.test.mjs',
    '市场不堵死': 'tests/market.test.mjs',
    '存档往返': 'tests/save.test.mjs',
    '平衡回归': 'tests/balance.test.mjs',
  };
  const missing = Object.entries(need).filter(([, p]) => !existsSync(join(ROOT, p))).map(([k]) => k);
  if (missing.length) err('tests/ 缺少断言脚本：' + missing.join('、'));
  else ok.push('断言脚本齐全（' + Object.keys(need).join(' / ') + '）');
}

/* ── 11 core 小数常量白名单（t16 F4：游戏数值必须住在 src/data） ── */
{
  const ALLOW = new Set(['0.001']);   // 浮点比较用的 epsilon，不是游戏数值
  const hit = [];
  for (const file of walk(join(ROOT, 'src', 'core')).filter((p) => extname(p) === '.js')) {
    const text = stripComments(read(file));
    const re = /[^\w.$](\d*\.\d+)/g;
    let m;
    while ((m = re.exec(text))) {
      if (!ALLOW.has(m[1])) hit.push(rel(file) + ' 里的 ' + m[1]);
    }
  }
  if (hit.length) err('core 里出现裸小数常量（数值必须放 src/data/；core 只允许索引/循环/epsilon 0.001）：\n    ' + hit.slice(0, 12).join('\n    '));
  else ok.push('core 小数常量白名单通过（没有硬编码游戏数值，全部来自 src/data）');
}

/* ── 12 统计断言纪律（t14 两侧化 → t42 起通关率不再进门禁） ──
   背景：t6 抓到 tests/balance.test.mjs 曾用 s.range(rate, 0, 0.84) 断言「通关率 <85% 才通过」——
   游戏越不可通关测试越绿；t30 又出现过下界 = 被测数据自己算出的「名义供给率 ×0.85」，供给一降下界跟着降。
   静态规则（都在 tests/*.test.mjs 上生效）：
   A) 禁止下界为 0 的区间断言（s.range(x, 0, ...)）——那是「越差越绿」的单侧反向断言；
   B) 禁止用「被测系统自身常量算出来的量」当下界/上界（>= nominal / >= derived / >= 名义 之类）；
   C) 禁止对通关率做单侧 < / <= 形式的 ok() 断言；
   D) t42（用户决策）：**机器人通关率不得再作为发布门禁** —— 禁止出现以「通关率」为标签的
      s.ok/s.range/s.eq，且 balance.test.mjs 必须保留「【信息性·非门禁】」标记与降级说明（原因见该文件 §0）。 */
{
  const testFiles = walk(join(ROOT, 'tests')).filter((p) => extname(p) === '.mjs' && !p.includes('lib'));
  const bad = [];
  for (const file of testFiles) {
    const text = stripComments(read(file));
    const name = rel(file);
    let m;
    const reA = /s\.range\(\s*[A-Za-z_$][\w.$]*\s*,\s*0\s*,/g;
    while ((m = reA.exec(text))) bad.push(name + ' 用了下界为 0 的区间断言（反向断言风险）：' + m[0]);
    const reB = /s\.(?:ok|range)\([^;]{0,80}?(?:>=|<=)\s*(?:nominal|derived|estimate|名义)/g;
    while ((m = reB.exec(text))) bad.push(name + ' 用被测数据反推的阈值做判定（阈值必须来自文档常量）：' + m[0]);
    const reC = /s\.ok\([^;]{0,60}?\b(?:rate|winRate|wins)\b[^;]{0,30}?<=?\s*0?\.\d/g;
    while ((m = reC.exec(text))) bad.push(name + ' 对通关率做了单侧 < 断言（必须两侧区间）：' + m[0]);
  }
  const bal = read(join(ROOT, 'tests', 'balance.test.mjs'));
  // t42：通关率类断言不得再当门禁（AI 机器人测量无效，见 tests/balance.test.mjs §0）。
  const gate = (bal.match(/s\.(?:ok|range|eq)\([^;]*?通关率[^;]*?\)/g) || []).length;
  if (gate > 0) bad.push('tests/balance.test.mjs 还有 ' + gate + ' 条以「通关率」为标签的断言——机器人通关率不得再作为发布门禁，请降级为【信息性·非门禁】的 note');
  const marks = (bal.match(/【信息性·非门禁】/g) || []).length;
  if (marks === 0) bad.push('tests/balance.test.mjs 缺少「【信息性·非门禁】」标记：降级必须可见、不能静默');
  if (bad.length) err('统计红线检查失败（红线必须两侧可失败、阈值必须独立于被测数据）：\n    ' + bad.slice(0, 8).join('\n    '));
  else ok.push('统计断言纪律通过（' + testFiles.length + ' 个测试脚本无反向断言/自算阈值；通关率类门禁 ' + gate + ' 条、信息性标记 ' + marks + ' 处）');
}

/* ── 汇总 ── */
console.log('\n『我帮儿子评院士』工程自检');
console.log('根目录：' + ROOT);
console.log('');
for (const line of ok) console.log('  [ok]   ' + line);
for (const line of warnings) console.log('  [warn] ' + line);
for (const line of errors) console.log('  [fail] ' + line);
console.log('');
console.log(errors.length ? '自检失败：' + errors.length + ' 个错误，' + warnings.length + ' 个警告' : '自检通过：0 个错误，' + warnings.length + ' 个警告');
process.exit(errors.length ? 1 : 0);

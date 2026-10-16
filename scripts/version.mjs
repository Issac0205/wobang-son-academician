#!/usr/bin/env node
/**
 * version.mjs —— 版本一览 + 版本归档（SPEC §1.3「每个发布版本留档」）
 *
 * 用法（从工作区根目录跑）：
 *   node 评院士/scripts/version.mjs                      只读一览：目录规模 + 已归档版本
 *   node 评院士/scripts/version.mjs --list               同上（显式）
 *   node 评院士/scripts/version.mjs --archive            归档当前版本（跑 check.mjs / simulate.mjs 并记录退出码）
 *   node 评院士/scripts/version.mjs --archive --skip-tests   跳过跑测试（退出码记 null）
 *   node 评院士/scripts/version.mjs --archive --force    目标目录已存在时强制重建
 *   node 评院士/scripts/version.mjs --verify             重算已归档单文件 SHA-256，与 PROVENANCE.json 对账
 *
 * 约定：目录名 = package.json 的 version；单文件必须来自 dist/（一次 build-single 的产物）。
 * 退出码：0 = 成功/无破损；1 = 归档被拒（check/simulate 未通过 或 目录已存在）或 verify 对不上。
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, join, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = resolve(ROOT, '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (name, def) => { const hit = argv.find((a) => a.startsWith(name + '=')); return hit ? hit.slice(name.length + 1) : def; };
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const readJson = (p, def) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return def; } };
const pkg = readJson(join(ROOT, 'package.json'), {});
const VERSION = String(pkg.version || '0.0.0');
const DIST = join(ROOT, 'dist', 'wobang-son-academician.html');
const VERSIONS = join(ROOT, 'versions');
const ARCHIVE_NAME = 'wobang-son-academician.html';

function stats(dir) {
  const out = { files: 0, lines: 0, bytes: 0 };
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const info = statSync(full);
      if (info.isDirectory()) walk(full);
      else if (['.js', '.mjs', '.css', '.html', '.md'].includes(extname(full))) {
        const text = readFileSync(full, 'utf8');
        out.files += 1;
        out.lines += text.split('\n').length;
        out.bytes += info.size;
      }
    }
  };
  walk(dir);
  return out;
}

/** src/ 的聚合哈希：按相对 POSIX 路径排序，逐文件 sha256 再整体 sha256（取前 16 位展示）。 */
function srcHash() {
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(join(ROOT, 'src'));
  const rows = files.map((f) => [relative(ROOT, f).split(sep).join('/'), sha256(readFileSync(f))]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const joined = rows.map((r) => r[1] + ' ' + r[0]).join('\n');
  return { hash: sha256(Buffer.from(joined, 'utf8')).slice(0, 16), files: rows.length };
}

/** 从 docs/VERIFICATION.md 摘出最后一条 verdict 结论（原样记录，不改写）。 */
function verificationVerdict() {
  const p = join(ROOT, 'docs', 'VERIFICATION.md');
  if (!existsSync(p)) return { file: 'docs/VERIFICATION.md', sha256: null, verdictLine: null };
  const text = readFileSync(p, 'utf8');
  const lines = text.split('\n');
  const hits = lines.filter((l) => /verdict\s*[:：]\s*[*_`]*\s*(pass|needs_revision)/i.test(l));
  const fallback = lines.filter((l) => /verdict/i.test(l));
  const pick = hits.length ? hits[hits.length - 1] : (fallback.length ? fallback[fallback.length - 1] : null);
  const last = pick ? pick.trim().slice(0, 240) : null;
  return { file: 'docs/VERIFICATION.md', sha256: sha256(Buffer.from(text, 'utf8')).slice(0, 16), verdictLine: last };
}

function runScript(rel) {
  try {
    const r = spawnSync(process.execPath, [rel], { cwd: HARNESS, stdio: 'inherit' });
    if (r.error) return { exit: null, note: '未执行（' + (r.error.code || r.error.message) + '）' };
    return { exit: r.status, note: '' };
  } catch (e) {
    return { exit: null, note: '未执行（' + e.message + '）' };
  }
}

function listVersions() {
  if (!existsSync(VERSIONS)) return [];
  return readdirSync(VERSIONS)
    .filter((n) => /^v\d+\.\d+\.\d+$/.test(n) && statSync(join(VERSIONS, n)).isDirectory())
    .sort()
    .map((n) => { const prov = readJson(join(VERSIONS, n, 'PROVENANCE.json'), null); return { dir: n, prov }; });
}

function printStats() {
  const sections = [
    ['src/data', stats(join(ROOT, 'src', 'data'))],
    ['src/core', stats(join(ROOT, 'src', 'core'))],
    ['src/ui', stats(join(ROOT, 'src', 'ui'))],
    ['src/styles', stats(join(ROOT, 'src', 'styles'))],
    ['scripts', stats(join(ROOT, 'scripts'))],
    ['docs', stats(join(ROOT, 'docs'))],
    ['versions', stats(VERSIONS)],
  ];
  console.log('');
  console.log(pkg.name + '  v' + VERSION);
  console.log('node ' + process.version + '（engines: ' + (pkg.engines ? pkg.engines.node : '-') + '）');
  console.log('');
  console.log('  目录          文件   行数   大小');
  for (const [name, s] of sections) {
    console.log('  ' + name.padEnd(13) + String(s.files).padEnd(7) + String(s.lines).padEnd(7) + (Math.round(s.bytes / 1024) + ' KB'));
  }
  const total = sections.reduce((acc, [, s]) => ({ files: acc.files + s.files, lines: acc.lines + s.lines }), { files: 0, lines: 0 });
  console.log('  ' + '合计'.padEnd(13) + String(total.files).padEnd(7) + String(total.lines).padEnd(7));
  const sh = srcHash();
  console.log('');
  console.log('  src 聚合哈希（sha256[:16]）：' + sh.hash + '（' + sh.files + ' 个文件）');
  console.log('  脚本：' + Object.keys(pkg.scripts || {}).join(' / '));
}

function printList() {
  const list = listVersions();
  console.log('');
  if (!list.length) {
    console.log('  已归档版本：无（用 --archive 归档当前版本 v' + VERSION + '）');
    return;
  }
  console.log('  已归档版本：');
  for (const { dir, prov } of list) {
    const html = join(VERSIONS, dir, ARCHIVE_NAME);
    const ok = prov && existsSync(html) && sha256(readFileSync(html)) === prov.distSha256;
    console.log('   · ' + dir + '  ' + (prov ? (prov.distBytes + ' 字节, 归档于 ' + prov.archivedAt) : '缺 PROVENANCE.json')
      + '  check=' + (prov && prov.commands ? String(prov.commands.check.exit) : '?')
      + ' simulate=' + (prov && prov.commands ? String(prov.commands.simulate.exit) : '?')
      + '  哈希对账=' + (ok ? '一致' : '不一致'));
    if (prov && prov.verification && prov.verification.verdictLine) console.log('       verdict：' + prov.verification.verdictLine);
  }
}

function archive() {
  const dir = join(VERSIONS, 'v' + VERSION);
  console.log('');
  console.log('归档 v' + VERSION + ' → versions/v' + VERSION + '/');
  if (!existsSync(DIST)) { console.log('  [拒绝] dist 产物不存在：' + DIST + '（先跑 node 评院士/scripts/build-single.mjs）'); process.exit(1); }
  const already = existsSync(join(dir, 'PROVENANCE.json')) || existsSync(join(dir, ARCHIVE_NAME));
  if (already && !has('--force')) {
    console.log('  [拒绝] 该版本已归档过：versions/v' + VERSION + '/ 里已有 PROVENANCE.json 或单文件（已归档的版本不许被静默覆盖；确认要重建再加 --force）');
    process.exit(1);
  }
  // 只放了人写的 README.md 的版本目录不算「已归档」，允许补齐单文件与 PROVENANCE。
  const codes = { check: { exit: null, note: '跳过（--skip-tests）' }, simulate: { exit: null, note: '跳过（--skip-tests）' } };
  if (!has('--skip-tests')) {
    const c = val('--check-exit', null);
    const s = val('--simulate-exit', null);
    if (c === null) { console.log('  跑 check.mjs …'); codes.check = runScript(join(ROOT, 'scripts', 'check.mjs')); } else codes.check = { exit: Number(c), note: '由调用方提供' };
    if (s === null) { console.log('  跑 simulate.mjs …'); codes.simulate = runScript(join(ROOT, 'scripts', 'simulate.mjs')); } else codes.simulate = { exit: Number(s), note: '由调用方提供' };
    if (codes.check.exit !== 0 || codes.simulate.exit !== 0) {
      console.log('  [拒绝] 验收命令未通过：check=' + String(codes.check.exit) + ' simulate=' + String(codes.simulate.exit) + '（不允许归档一个验收为红的版本；确需留档请修好再来）');
      process.exit(1);
    }
  }
  const distBuf = readFileSync(DIST);
  mkdirSync(dir, { recursive: true });
  copyFileSync(DIST, join(dir, ARCHIVE_NAME));
  const sh = srcHash();
  const prov = {
    version: VERSION,
    archivedAt: new Date().toISOString(),
    singleFile: ARCHIVE_NAME,
    distSha256: sha256(distBuf),
    distBytes: distBuf.length,
    srcHash: sh.hash,
    srcFiles: sh.files,
    commands: codes,
    verification: verificationVerdict(),
    note: 'README.md 由人写（归档器不覆盖）；本文件由 scripts/version.mjs --archive 生成。',
  };
  writeFileSync(join(dir, 'PROVENANCE.json'), JSON.stringify(prov, null, 2) + '\n', 'utf8');
  console.log('  单文件：' + ARCHIVE_NAME + '（' + distBuf.length + ' 字节，sha256 ' + prov.distSha256.slice(0, 16) + '…）');
  console.log('  src 聚合哈希：' + sh.hash);
  console.log('  退出码：check=' + String(codes.check.exit) + ' simulate=' + String(codes.simulate.exit));
  console.log('  verdict：' + (prov.verification.verdictLine || '（未找到）'));
  console.log('  已写：versions/v' + VERSION + '/PROVENANCE.json');
  if (!existsSync(join(dir, 'README.md'))) console.log('  [提醒] versions/v' + VERSION + '/README.md 还不存在：该版本的一页说明需要人写（关键数值 / 玩法变化 / 修了什么）。');
}

function verify() {
  const list = listVersions();
  console.log('');
  if (!list.length) { console.log('  没有可校验的版本目录。'); process.exit(1); }
  let bad = 0;
  const current = existsSync(DIST) ? sha256(readFileSync(DIST)) : null;
  for (const { dir, prov } of list) {
    const html = join(VERSIONS, dir, ARCHIVE_NAME);
    if (!existsSync(html)) { console.log('  [破损] ' + dir + '：缺 ' + ARCHIVE_NAME); bad += 1; continue; }
    const got = sha256(readFileSync(html));
    const want = prov ? prov.distSha256 : null;
    const ok = want && got === want;
    if (!ok) bad += 1;
    console.log('  ' + (ok ? '[ok]  ' : '[破损] ') + dir + '：单文件 sha256 ' + got.slice(0, 16) + '… vs PROVENANCE ' + (want ? want.slice(0, 16) + '…' : '缺失'));
    console.log('        ' + (current === got ? '与当前 dist 一致（说明 dist 未再变更）' : '与当前 dist 不同（属正常：dist 会被后续构建覆盖）'));
  }
  if (bad) { console.log(''); console.log('校验失败：' + bad + ' 个版本目录对不上。'); process.exit(1); }
  console.log(''); console.log('校验通过：' + list.length + ' 个版本目录与 PROVENANCE.json 一致。');
}

if (has('--verify')) { printStats(); verify(); process.exit(0); }
if (has('--archive')) { printStats(); archive(); printList(); console.log(''); process.exit(0); }
printStats();
printList();
console.log('');
process.exit(0);

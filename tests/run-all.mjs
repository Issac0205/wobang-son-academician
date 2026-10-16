#!/usr/bin/env node
/**
 * tests/run-all.mjs —— 依次跑全部断言脚本（任一失败即整体失败）
 * 用法：node 评院士/tests/run-all.mjs
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = ['promotion.test.mjs', 'happiness.test.mjs', 'project.test.mjs', 'market.test.mjs', 'save.test.mjs', 'balance.test.mjs', 'conservative.test.mjs'];

let failed = 0;
for (const file of FILES) {
  const full = join(HERE, file);
  process.stdout.write('\n══════ ' + file + ' ══════\n');
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (res.status !== 0) failed += 1;
}
process.stdout.write('\n测试汇总：' + (FILES.length - failed) + '/' + FILES.length + ' 个脚本通过\n');
process.exit(failed ? 1 : 0);

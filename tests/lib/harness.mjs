/**
 * tests/lib/harness.mjs —— 零依赖断言小工具
 *
 * 约定：测试脚本必须可重复（固定随机种子）、失败时退出码非 0、输出能直接看出哪条断言挂了。
 */

export function createSuite(title) {
  const failures = [];
  let passed = 0;
  const log = (line) => console.log(line);

  const api = {
    ok(cond, label, detail) {
      if (cond) { passed += 1; return true; }
      failures.push(label + (detail === undefined ? '' : '  「' + detail + '」'));
      return false;
    },
    eq(actual, expected, label) {
      const same = JSON.stringify(actual) === JSON.stringify(expected);
      if (!same) failures.push(label + '  期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
      else passed += 1;
      return same;
    },
    near(actual, expected, tol, label) {
      const ok = Math.abs(Number(actual) - Number(expected)) <= tol;
      if (!ok) failures.push(label + '  期望 ' + expected + '±' + tol + '，实际 ' + actual);
      else passed += 1;
      return ok;
    },
    range(value, lo, hi, label) {
      const v = Number(value);
      const ok = Number.isFinite(v) && v >= lo && v <= hi;
      if (!ok) failures.push(label + '  期望落在 [' + lo + ', ' + hi + ']，实际 ' + value);
      else passed += 1;
      return ok;
    },
    fail(label, detail) {
      failures.push(label + (detail === undefined ? '' : '  「' + detail + '」'));
    },
    note(line) { log('      · ' + line); },
    finish() {
      log('');
      log('【' + title + '】通过 ' + passed + ' 条，失败 ' + failures.length + ' 条');
      for (const f of failures) log('  [FAIL] ' + f);
      if (failures.length) {
        log('结果：FAILED');
        process.exitCode = 1;
      } else {
        log('结果：PASSED');
      }
      return failures.length === 0;
    },
    get failures() { return failures; },
    get passed() { return passed; },
  };
  log('=== ' + title + ' ===');
  return api;
}

/** 固定种子开局（走 game/newGame，与线上同一入口）。 */
export function freshGame(mods, seed) {
  if (!mods || typeof mods.createState !== 'function') throw new Error('freshGame({ createState, reduce, ACTIONS }, seed) 需要模块参数');
  return mods.reduce(mods.createState({ seed }), mods.ACTIONS.newGame({ seed }));
}

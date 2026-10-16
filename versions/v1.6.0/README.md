# v1.6.0 — 学生名册「延毕他」

## 这一版新增

学生名册每张学生卡新增 **「延毕他」** 按钮（确认弹层后才生效）：

| 效果 | 数值 |
| --- | --- |
| 幸福度 | **−20** |
| 毕业进度 | **−25** |

- 动作：`game/deferStudentByBoss { studentId }`；常量 `DEFER_BY_BOSS_HAPPY = -20` / `DEFER_BY_BOSS_PROGRESS = -25`（`src/data/students.js`），core 无裸字面量。
- 毕业判据是 `degreeProgress >= DEGREE_PROGRESS_MAX`，所以 −25 进度就是实打实延后他毕业。
- **不改**学制年限（`studyMonthsLeft`）、不改延毕次数（`deferMonths`）、不扣诚信与经费；到期的「延毕/肄业」二选一流程一行未改。
- 边界：数值夹取到 0；已毕业 / 已离组 / 不存在的学生 → 拒绝并给中文提示，状态不变。
- 百科「学生」章节已自动收录该动作（数字由 `selectWiki()` 从 `src/data` 组装）。

## 验收

| 命令 | 退出码 |
| --- | --- |
| `node scripts/check.mjs` | 0（0 错 0 警）|
| `node tests/run-all.mjs` | 0（10/10 脚本，新增 `tests/defer-boss.test.mjs` 24 条）|
| `node scripts/ui-smoke.mjs` | 0（157 项）|
| `node scripts/asset-audit.mjs` | 0（外部引用 0）|
| `node scripts/version.mjs --verify` | 0（9 个版本全部对账）|

单文件 sha256 见 `PROVENANCE.json`；与 `dist/` 逐字节一致。

## 未验证

- 未在真实浏览器手动点击（仅 DOM shim 冒烟 + ui-smoke 断言）。

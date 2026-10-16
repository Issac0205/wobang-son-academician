# v1.5.0 — 游戏内百科

> 归档时间：2026-10-17　|　包版本：`1.5.0`　|　溯源：同目录 `PROVENANCE.json`（含 src 聚合哈希、单文件 SHA-256/字节数、check/simulate 退出码、VERIFICATION verdict）

## 怎么玩

**双击同目录的 `wobang-son-academician.html`** 即可开玩（自包含单文件：内联 CSS/JS、零外部引用）。存档走浏览器 localStorage（键 `wobang_son_academician_save`）。源码版：根目录 `node server.mjs` → `http://127.0.0.1:5175/`。

## 这个版本的变化

| 项 | 值 |
|---|---|
| 入口 | 顶栏「玩法」→ 既有帮助弹层；**没有新增标签页**（仍是 5 项导航） |
| 内容 | 游戏内百科 10 章：经费来源 / 诚信值 / 晋升门槛 / 一作三途径 / 学生 / 实验室空间 / 项目与难点 / 人才市场 / 行动·精力·健康 / 结局 |
| 词条 | 193 条，条条带真实数字（整数/百分比/倍率/万元），无「较多/少量」这类模糊词 |
| 数字来源 | `src/core/selectors.js` 的 `selectWiki()` → `selectUiConstants().wiki` → `buildViewModel().consts.wiki`；UI 只排版 |
| 视图 | `src/ui/views/wiki.js`（去掉注释后除 HTML 标签名外**不含任何数字字符**） |
| 防漂移 | `scripts/ui-smoke.mjs` §19：页面 `[data-wiki-key]` ↔ `src/data` 真值 ↔ 独立规格字面量，三面逐项对账 |
| 手机宽度 | 375px 视口无横向溢出（`documentElement.scrollWidth = 375`，193 行词条 0 行越界） |

## 本版本的数值口径（节选）

- 诚信总表 15 项逐条上页：抢一作 −8 / 买一作 −4 / 造假 −10 / 被抓 −25 / 挪用 −3 / 审查 −15 / 极端事件 −50 / 结题 +2 / 横向交付 +1 / 毕业 +3 / 晋升 +2 / 欠薪 −2 / 逾期 −1 / 项目失败 −5 / 肄业 −2；范围 0–100。
- 晋升 8 级头衔的总 IF / 一区 / 二区 / 正刊 / 项目条款 / 招生名额 / 校投 / 在研上限 / 最高等级 / 黄金年龄线全部逐级列出；院士另列 ≥45 岁、3 张推荐票（每错过窗口 +2、上限 9）、每 24 个月一次增选窗口。
- 一作三途径：亲带 ×0.85 + 每月 1 点精力 / 抢（−8 诚信、−30 幸福、6 个月心结）/ 买（2–120 万，−4 诚信）。
- 项目与难点：13 个项目模板（T / 工作量 / 期限 / 合同 / 定金）、难点数量与进度惩罚、三种处理方式的成功率与代价、被抓概率与审查概率。

## 验证状态（发布必读）

- 五条验收命令全部 **exit 0**：`scripts/check.mjs`（0 错 0 警）/ `tests/run-all.mjs`（**9/9**）/ `scripts/ui-smoke.mjs`（**150 项**，含百科 11 项）/ `scripts/build-single.mjs`（552 KB）/ `scripts/asset-audit.mjs`（外部引用 0）。归档时 `version.mjs --archive` 另跑 check=0 / simulate=0；`--verify` 8 个版本目录哈希全部一致，v1.5.0 单文件与当前 `dist/` 逐字节相同（sha256 `2e7a64917fcc6ed7…`）。
- 防漂移负向对照：把 `INTEGRITY_DELTA.grabFirst` 临时改成 −5、百科不动 → §19 红（退出码 1）；改回 −8 → 绿（150/150）。前后输出：`artifacts/verification/wiki-antidrift-red.txt` / `wiki-antidrift-green.txt`。
- 实机证据：`artifacts/verification/wiki-shots.mjs`（375 / 1366 两种视口实测滚动宽度）+ 四张截图。
- 机器人通关率类读数仍为【信息性·非门禁】（t42 决策）；集成验证结论见 `docs/VERIFICATION.md`。

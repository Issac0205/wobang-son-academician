# 变更记录（CHANGELOG）

本项目遵循「契约先改文档、再改代码」的流程；契约版本号 = STATE_VERSION（src/core/state.js）。

> 分段约定：`## x.y.z` = 版本发布条目（按版本倒序）；**契约文档本身的修正**（只动 docs/CONTRACT.md 与
> docs/ARCHITECTURE.md、不动代码与数值的那种）统一记在文末「契约变更记录」段，依据 CONTRACT §7。

## 0.1.0 — 工程骨架与接口冻结（t3 [arch]）

### 新增：目录骨架
- index.html（HUD + 五个标签页 + 纪事侧栏 + 弹层容器）
- server.mjs（零依赖静态服务器，默认 127.0.0.1:5175，路径按 import.meta.url 解析，不依赖 cwd）
- package.json（type=module，node >= 18，scripts：dev/start/check/simulate/ui-smoke/build/version/test）
- src/（data / core / ui / styles 四层）、scripts/、docs/、.gitignore

### 新增：数据层（src/data，12 个文件，零 import）
- tuning.js 全局常量与诚信变化总表 INTEGRITY_DELTA
- ranks.js 八级头衔（副研究员 → 院士）+ 推荐票与增选周期
- instruments.js 8 种仪器（initCount 即开局持有量，初始加成 0.45）
- projects.js 10 个项目模板 + 市场槽位/刷新/定金率/逾期规则 + PROJECT_OFFER_TTL_MONTHS
- papers.js 五档期刊（正刊/一区/二区/三区/四区）、五种论文槽位模板、买卖一作价格
- hardpoints.js 进度公式常量、难点分布、三种处理方式（多人攻坚/造假蒙混/单人猛干）
- students.js 天赋分布、四档工资、幸福度、毕业与延毕、离组与极端事件
- market.js 人才市场开放月份、生源、招募成本与门槛
- actions.js 4 种行动（交流/组会/锻炼/团建）；导出名用 ACTION_DEFS（引擎层已占用 ACTIONS，避免单文件打包时顶层标识符撞名）
- endings.js 8 个结局（含院士三种变体文案）
- events.js 24 条随机事件 + 条件/效果 DSL
- names.js 学生命名字库与黑名单（种子规模，扩表目标见 NAME_DATA_TARGET）
  > **后续（t28 扩表 / t38 复核）**：七项语料已全部 ≥ NAME_DATA_TARGET（实际 192/20/244/264/204/50/42；
  > 目标 186/20/240/260/200/50/40），check.mjs 现输出「[ok] 字库规模达标」、0 警告。上面的「种子规模」
  > 是 0.1.0 当时的真实状态，保留不改写。

### 新增：核心层（src/core，9 个文件）
- rng.js 确定性随机（mulberry32），种子存进 state，可复现整局
- state.js GameState 唯一定义处（STATE_VERSION = 1）+ 子对象工厂 + cloneState
- naming.js 学生命名（黑名单/同音/同名规避）
- formulas.js 全部纯计算（精力、仪器加成、进度、毕业、幸福度、成功率、IF、晋升差距）
- rules.js 全部纯判定（条件 DSL、市场开放、承接与招募门槛、晋升与增选、结局）
- engine.js ACTIONS + reduce（唯一合法变迁处）+ 事件效果求值 + 月份结算 12 步顺序
- store.js 单一 store（getState/dispatch/replaceState/subscribe）
- save.js 存档信封、宽容反序列化、版本迁移表 MIGRATIONS
- selectors.js + viewmodel.js UI 取数层（buildViewModel 一屏一对象）

### 新增：界面层（src/ui）
- dom.js（h/mount/clear/bar/tag/button，全部 createElement，禁止 innerHTML）
- hud.js、views/crew.js、views/projects.js、views/market.js、views/actions.js、views/chronicle.js、modal.js
- app.js 事件代理（data-action → HANDLERS → dispatch），全量重渲染，UI 不写 state
- src/main.js 装配 store/UI/自动存档/导入导出，并把测试钩子挂在 window.__GAME__

### 新增：脚本与文档
- scripts/check.mjs 九项静态自检（交付物/语法/导入完整性/DOM 契约/交互契约/静态资源/数据纯度/确定性/字库规模）
- scripts/simulate.mjs 无头模拟（固定种子，打印关键曲线与结局）
- scripts/ui-smoke.mjs + scripts/lib/dom-shim.mjs 无浏览器 DOM 冒烟（渲染 + 事件代理 + 存档回读）
- scripts/build-single.mjs 单文件打包（拓扑排序 + 重名检查 + 内联 CSS/JS）
- scripts/version.mjs 版本与规模一览
- docs/ARCHITECTURE.md 分层、状态树、存档策略、月份推进顺序、UI 通信方式
- docs/CONTRACT.md **冻结契约**：数据形状、core API、UI 视图与 data-action、事件/存档格式
- docs/DEV.md 给非程序员的运行与改数值手册

### 设计决定（需要主程/策划知晓）
1. **论文归属**：player.papers = 课题组产出（玩家为通讯作者，晋升门槛按它算）；
   player.papersFirst = 抢/买来的第一作者（只影响诚信与结局文案）。
   > ⚠ 本条后半句的口径**已于 2026-10 修正**（旧文字与 GDD §5.5 及实现相反）：
   > 见文末「契约变更记录」第 1 条，与 docs/CONTRACT.md §2 / §8。
2. **新增耗材采购机制**：CONSUMABLE_PRICE_PER_UNIT / CONSUMABLE_BUY_PACK + game/buyConsumable。
   原因：SPEC/BALANCE 未定义耗材来源，缺了它会出现「有钱没耗材 → 项目进度永远 ×0」的死锁。
3. **新增市场 offer 有效期**：PROJECT_OFFER_TTL_MONTHS = 6，且刷新时优先挂「玩家现在真能接」的
   （等级够 + 仪器够），否则市场上会堆一批永远接不了的本子，导致玩家无事可做。
4. **月度结算是 12 步固定顺序**（见 ARCHITECTURE §5）；随机调用顺序属于契约，改动会改变将来每一局。
5. **脚本必须能从工作区根目录直接运行**（node 评院士/scripts/xxx.mjs），因此全部用 import.meta.url 解析路径。

### 已知问题（移交主程与策划）
- 参考机器人（simulate.mjs）只做保底操作，**不追求通关**；平衡验收属于 BALANCE 负责人。
  观察到的现象：多局在中期出现「结题数远低于预期 / 总 IF 停滞」，怀疑难度曲线与推荐票来源偏紧。
- 字库为种子规模（SURNAMES_SINGLE 84 / GIVEN_FIRST 39 / GIVEN_LAST 36 / GIVEN_SINGLE 40），
  check.mjs 会发 WARN；扩表只需往数组加条目。
  > **后续（t28 扩表 / t37 同步 / t38 复核）**：已扩表达标，「4 条 WARN」不复存在（check.mjs 现在 0 错 0 警）。
  > 本条记录的是 2026-10 初的状态，按「历史不改写」保留；当时的修法（往数组加条目）依然有效。
- src/styles/main.css 只是结构占位，视觉设计（配色/排版/动效）留给前端工程师。
- 事件目前都走「单一确认」路径；choices 分支的 UI 已支持（弹层按 choices 渲染按钮），
  但 24 条事件里还没有需要选择的事件，主程可先加一条试水。

---

## 1.0.0 — 首个可发布版本（2026-10-16）

> 归档：`versions/v1.0.0/`（可双击的自包含单文件 + 一页说明 + `PROVENANCE.json` 溯源）。本条目之下是历史记录，按「最新在前」排列。

### 玩法（相对 0.1.0 骨架）

- 八级头衔阶梯：副研究员 → 研究员 → 副教授 → 教授 → 优青/万人 → 杰青/长江（单有）→ 杰青+长江（兼有）→ 院士；院士硬门槛 = 总 IF ≥1400 + 一区一作 ≥16 + 正刊 ≥3 + ≥3 张推荐票 + ≥45 岁 + 增选窗口 + T6 结题 ≥1 且 T5+ 结题 ≥2。
- 一作归属（t24）：**晋升门槛只认玩家署名的一作**。三条来源 —— 亲带（「我亲自带」，代价：项目推进 ×0.85、每月多 1 点精力）、买（一作交易台，越厉害越贵，诚信 −4/篇）、抢（抢学生一作，诚信 −8、该生幸福 −30、心结 6 个月）。学生一作只计入 totalIF，不计入晋升门槛。
- 一作空窗提示（t35）：连续 ≥24 个月没拿到自己的一作时，顶栏出提示并给出三条途径与代价。
- 多项目幸福度惩罚（t42 B 方案）：学生在研项目数 n ≥ 1 时，每多带 1 个项目每月额外 −1 幸福度（n=1 → 0、n=2 → −1、n=3 → −2），与「学生月产出被其在研项目均分」的产出守恒互补，一起堵住「把所有学生塞进所有项目」的套利。
- 延毕改为老板签字（t10/t34）：+12 个月、幸福度 −40、不占招生名额（硕士 2 次 / 博士 3 次上限），没拍板不能推进月份。
- 一键分配工作（t25/t26）：先保证每名学生至少 1 个项目，再铺满缺人项目；幂等，边界原因（名额满 / 项目满 / 仍缺人）如实回显。
- 抢一作按篇记账 + 二次确认（t10）：一篇只能抢一次、一人一月只能抢一篇；结题档案摊开论文台账（档位 / 本篇 IF / 一作是谁）。
- 启动路径修复（t36）：无存档的首次会话与「重开一局」都走 `game/newGame`，首屏项目市场不再为空。

### 数值与门槛（集中在 `src/data/`）

- 项目模板：企业 E1–E4 / 国家 N1–N6；IF/(工作量×0.85) 双区间 T1–T3 ∈ [0.070,0.100]、T4–T6 ∈ [0.100,0.135]（N5 ≥0.105、N6 ≥0.115；实测 N5 0.1052 / N6 0.1265），最高/最低 = 1.63 ≤ 上界 1.93，无支配解。
- 市场：项目席位 7 + 学生席位 3（各自独立配额）、项目与学生 offer TTL 各 3 个月、`SUPPLY_FLOOR_12M = 21`（绝对常量：名义 24 × 事先批准的漏刷预算 1/8，不由实测反推）、不变式「任何月份至少 1 个当前头衔 + 仪器真能承接的项目」。
- 薪酬（t47）：工资缺口项符号修正为 `d -= GAP_PENALTY × gap`，欠薪不再反而更幸福；四档净变化严格递减（高天赋样本 high +5 > mid −5 > low −14 > none −27）。
- 存档：`STATE_VERSION = 2`（t24 口径变更）带 v1→v2 迁移；存档键 `wobang_son_academician_save`。

### 本版本包含的修复（摘要）

t16 存档白名单 / negativeMoneyMonths 持久化、t22 项目刷新与招生季解耦、t24 一作归属模型、t25/t26 一键分配、t30 门槛落表 + 产出守恒、t36 启动路径、t42 多项目幸福度惩罚、t47 工资缺口符号、t48/t50 契约与文档一致性（含 CONTRACT §9 并发截断恢复、VERIFICATION.md 竖线转义）。

### 验证状态（发布必读）

- 冻结最终态上六条命令全部 **exit 0**：`check.mjs`（0 错 0 警）/ `simulate.mjs` / `ui-smoke.mjs`（116 项）/ `tests/run-all.mjs`（7/7 脚本）/ `build-single.mjs` / `asset-audit.mjs`（**外部引用 0**）。单文件尺寸与 SHA-256、退出码与 src 哈希见 `versions/v1.0.0/PROVENANCE.json`。
- 集成验证结论：`docs/VERIFICATION.md`（t6 首轮 + t29 第二轮复验）→ **verdict = needs_revision（非 blocker 级）**；未闭合项与未验证项见该文档 R11。
- **平衡/通关率类断言自 t42 起为【信息性·非门禁】**（用户决策：机器人打法 ≠ 真人打法，数值待真人试玩后重定，依据 BALANCE §18.19）；`check.mjs` 反向保证它们不得变回门禁。归档时的信息性读数：速通 2/8、随手玩 15/16。
- 已知未验证：GitHub Pages 工作流（t15 范围，本机无法验证）、市场「可接 offer 数」分支（T21-F2）无独立浏览器复核。

---

## 契约变更记录

> 本段只登记**契约文档本身的修正**（改 docs/CONTRACT.md / docs/ARCHITECTURE.md），不含玩法数值与代码变更；
> 条目**最新在前**。依据 CONTRACT §7「改契约 = 先改本文件 + docs/CHANGELOG.md」。
> 契约版本号以 docs/CONTRACT.md 头部为准（当前 = **2**，见 2026-10 t24 条目）。

### 2026-10 数值级契约核对（t46 [arch]；**最新**）

> 起因：t45 登记时撞见一处探针抓不到的漂移（契约写 `PROJECT_SLOTS=5 / TTL=6 / MARKET_SLOTS=8`，代码已是 **7 / 3 / 10**）。
> 根因：`contract-coverage.mjs` 只认**符号**，认不出**数字**。本轮把它补成**机器检查**——不写进人工清单。

**1. 新探针 `_t18-probe/contract-values.mjs`**
- 从 docs/CONTRACT.md 抽「当前声明」的 `NAME = 数值`，与 src/data、src/core（含 src/systems/bots.js）的实际导出值逐一比对；
  不一致或代码里找不到 → **FAIL**，并打印**双方数值 + 行号 + 所在模块**。
- **只认当前声明**：结构规则跳过表格行、含「曾/原/写成/历史/勘误」标记的说明块、`//` 注释行（那些是**引用**不是声明）；
  被跳过的、看起来像数值声明的行单独列 advisory 并在输出里点名，**不算通过**。
- 覆盖（实测）：**12 条标量** + **2 个扁平对象字面量**（INTEGRITY_DELTA 15/15 键、JOURNAL_IF_BASE 5/5 键）
  + **2 个扁平数组**（PHASE_ORDER、PAPER_TIER_ORDER）。
- 未覆盖（如实登记，见 §7.1）：嵌套结构 `HARDPOINT_HD_DIST`；表格/引用块里的历史数值；散文描述的量；
  未按 `NAME = 数值` 形式登记的量。

**2. 顺手补两条登记**（原来只藏在注释/散文里，机器核不到）
- §1.6 增 `MAX_PROJECTS_PER_STUDENT = 3`（原先只在 `//` 注释里写「=3」）；
- §1.1 增 `FIRST_AUTHOR_DROUGHT_MONTHS = 24`（t30 新增字段 `hud.firstAuthorDrought` 的阈值，此前未在契约登记）。
  → 数值级覆盖因此包含派工单点名的全部 9 个名字，另加 5 条。

**3. 负向对照（证明尺子有刻度，不是把尺子掰弯）**
- 把 §1.4 的 `PROJECT_SLOTS = 7` 临时改成 5 → `FAIL PROJECT_SLOTS 契约=5 代码=7`（exit 1）；
- 恢复 → PASS（exit 0），且**恢复后 CONTRACT.md 的 sha256 与改前一致**（逐字节还原，不留痕）。

**4. CONTRACT 新增 §7.1「契约校验工具」**
- 登记三条可复跑命令（contract-coverage / contract-values / md-sanity）与「改契约后**必须**跑」；
- 覆盖清单、未覆盖清单与理由、负向对照纪律全部写进契约——**未覆盖项要能被看见，而不是假装覆盖**。

### 验证（t46 留档，全部 exit 0）
- `node _t18-probe/contract-values.mjs` → PASS（12 标量 + 2 对象 + 2 数组；负向对照红→绿已留痕）。
- `node _t18-probe/contract-coverage.mjs` → PASS（符号级原功能不变：370 条声明 / 695 符号 / 0 悬空 / 双向 data-action / selector 字段级）。
- `node _t18-probe/md-sanity.mjs` → CONTRACT / ARCHITECTURE / CHANGELOG 三份文档 0 问题。

### 2026-10 登记 SUPPLY_FLOOR_12M 与 conservative 对照配置（t45 [arch]）

> 由 t41 请求转派（两样新产物在 src/，契约面归我）。**只改 docs/**：CONTRACT §1.4 + 新增 §9。
> 末尾附一条由本次登记顺带撞见的**数字级**漂移（符号对得上、数字对不上，探针抓不到）。

**1. `SUPPLY_FLOOR_12M = 21`（src/data/projects.js:77）**
- 语义：任意连续 12 个月内**新增可承接项目 offer**的绝对下界（不含已挂 N 月的旧 offer）。
- 与名义值的关系：名义 = `(PROJECT_SLOTS − 1) / PROJECT_OFFER_TTL_MONTHS × 12` = 6/3 × 12 = **24**
  （减 1 席留给「看得见目标、仪器未齐」的本子），再乘事先批准的 **1/8 漏刷预算** → **21**。
- **21 是结论，不是下界的来源**：当前**零余量**。改 `PROJECT_SLOTS` / `PROJECT_OFFER_TTL_MONTHS` 必须**显式复核并修改
  这个常量、说明理由**（红线与参数解耦；BALANCE §18.18 裁定 ①/④、§18.9 尺子纪律）。
- 消费方：`tests/market.test.mjs:19`（import）→ `:185` `SUPPLY_MIN_NEW_OFFERS_PER_YEAR = SUPPLY_FLOOR_12M`，
  断言 `newReach >= 21`。**禁止出现第二个供给下界**，也禁止「由 slots/TTL 反推」的写法（那样下界会随参数一起降）。

**2. 顺带更正 §1.4 的一处过期数值（t30 落表后一直没同步）**
- 原契约写 `PROJECT_SLOTS = 5 / PROJECT_OFFER_TTL_MONTHS = 6 / MARKET_SLOTS = 8`；
  实际已是 **7 / 3 / 10**（src/data/projects.js:65-70，t30 落表）。已按代码更正并加「t45 数值同步」说明。
- 教训：契约覆盖率探针只认**符号**，认不出**数字**——这类漂移只能靠「登记新常量时顺手核对邻近数值」发现。

**3. 新增 CONTRACT §9「测量脚手架与统计红线」（src/systems/bots.js + tests/）**
- **9.1** STRATEGIES 5 条定位表：speedrun（上限性能）/ casual（主线验收）/ **conservative**（保守但合规的尺子）/
  balanced（**负面对照**，一作恒 0 ⇒ 0/8 是期望值）/ cheater（负向路线）。
- **9.2** conservative 逐字段登记 + **与 casual 的真实差异（程序化 diff，5 项）**：`buyFirstAuthorMax` 3→**1**、
  `leadMinTier` **4**（casual 无此字段 ⇒ 等价 0）、`buyFirstAuthorTier` casual=`'top'` 而 conservative **未设**（另加 id/label）。
  ⚠ 派工单写的「其余四项与 casual 相同」与实测不符（差在 `buyFirstAuthorTier`）——**以 §9.2 为准**。
  定位：属 BALANCE §18.9 尺子纪律管辖（是尺子，不是难度档位）。
- **9.3 【未定稿】现状与待裁定**：spec 原样的 conservative **通关 0/8**（8 局全 retire），根因是
  「只亲带 T4+」的**启动段自锁**（接 T4+ 要 rank3 ← rank3 要 q1/q2 ← 一作要靠亲带/买/抢）；
  该状态现在被 `tests/conservative.test.mjs:57` 当作**「登记在案的缺陷签名」**断言（变红即表示死锁已修好，须改配置+改断言）。
  bootstrap 规则待策划 **t43** 裁定 —— 本配置**不是已定稿的验收尺子**，引用时必须写明这一状态。
- **9.4** 红线分工与纪律：数值归 BALANCE、接口归契约；机器人配置字段属测量接口（新增必须在 §9 登记）；
  统计口径统一 `ifPerWorkloadTable().ifPerSlot` = IF/(W×0.85)。
- **9.5** tests 契约面（7 个脚本）：market.test.mjs 的供给下界、conservative.test.mjs 的 24 处断言（ok 8/eq 12/note 4）；
  新增脚本要**同时**改 `scripts/check.mjs` 的清单与 `tests/run-all.mjs` 的 FILES。

### 验证（t45 留档，全部 exit 0）
- `node _t18-probe/contract-coverage.mjs` → PASS：**370** 条声明 / 695 符号 / 0 悬空 / 反向 0 未登记
  （探针本轮把 `src/systems/bots.js` 纳入符号表，并对 strategy 做字段级核对）。
- `node _t18-probe/md-sanity.mjs` → CONTRACT / ARCHITECTURE / CHANGELOG 三份文档 0 问题。

### 2026-10 §6.3 data-action 表与 HANDLERS 对账（t39 [arch]）

> 起因：t38 顺带观察到 HANDLERS 已从 40 增到 41，而 §6.3 表仍写 40。本轮用脚本读**整个对象体**对账（不看前几十行）。

**对账结果（脚本可复跑：`_t39-probe/handlers-diff.mjs`）**
- `src/ui/app.js` 的 HANDLERS：**41 个键**。
- CONTRACT §6.3 表内 token：48 个，**唯一 41**（多出的 7 个是「2026-10 补登记」说明段里重复出现的名字，非新增动作）。
- **未登记 1 个 → 已补**：`projects-intro-dismiss`（t34 引入）。
- **已移除 0 个**：反向核对为空 —— 表里没有任何动作是 HANDLERS 已删除的，故无需保留删除说明。

**补登记：`projects-intro-dismiss`（app.js:96）**
- 语义：首次进项目页引导的**关闭按钮**，点掉只置 `ui/app.js` 的 `localUi.projectsIntroDone = true` 并重渲染；
  引导块在 app.js:290 / :309 渲染。
- 边界（写进契约）：**不写 GameState、不 dispatch、不进存档**；重开一局或刷新会重新出现（刻意的：新玩家每次该看到一次引导）。

**同时澄清 §6.3 表的语义**（此前容易被读成「表内每个都是会 dispatch 的按钮」）
- 表 = HANDLERS 键全集；其中 **11 个是 UI 本地处理器**：`help` `modal-close` `receipt-open` `ending-hide`
  `rename-open` `rename-apply` `tab` `goto-tab` `lab-section` `chronicle-filter` `projects-intro-dismiss`，
  只有 `tab` 会 dispatch('ui/setTab')，其余纯 localUi。
- 判定口径入契约：**只要 index.html 或视图生成了某个 data-action，它必须同时出现在 §6.3 表与 HANDLERS 里**，两向一致。

**工具升级**：`_t18-probe/contract-coverage.mjs` 增加**反向校验**（HANDLERS 有、§6.3 未登记 → FAIL），
两个方向现在由一条命令守住。

### 验证（t39 留档，全部 exit 0）
- `node _t39-probe/handlers-diff.mjs` → PASS：HANDLERS 41 = 表内唯一 41；未登记 0、已移除 0。
- `node _t18-probe/contract-coverage.mjs` → PASS：369 条声明、0 悬空、反向 0 未登记（data-action 41）。
- `node _t18-probe/md-sanity.mjs` → CONTRACT / ARCHITECTURE / CHANGELOG 三份文档 0 问题。

### 2026-10 文档过期表述同步（t38 [arch]）

> 目标：让 ARCHITECTURE / CHANGELOG / CONTRACT 里关于**字库规模**与**三个年龄加成常量**的表述与实现一致。
> 处置原则：**当前状态声明 → 直接改正**；**历史记录（发布条目 / 当次验证留档）→ 不改写，追加「后续」说明**。

**1. 字库规模：从「种子规模 / 4 条 WARN」改为「已达标 / 0 警告」**
- 实测（t38 现读 src/data/names.js）：单字姓 **192**（目标 186）/ 复姓 **20**（20）/ 双字名首 **244**（240）/
  双字名末 **264**（260）/ 单字名 **204**（200）/ 黑名单 **50**（50）/ 谐音 **42**（40）—— 七项全部 ≥ NAME_DATA_TARGET。
- `scripts/check.mjs` 第 9 项直读 NAME_DATA_TARGET 逐键比对，正常输出「[ok] 字库规模达标」；当前 check 为
  **0 错 0 警**（「4 条 WARN」已是历史）。
- 改正位置：CONTRACT §1.8 后的字库说明、ARCHITECTURE §10.5（原「字库是种子规模：names.js 只有 39–84 条/库」）。
- 保留历史：CHANGELOG 的 0.1.0 发布条目（names.js 那行、已知问题那行）与 t18 验证留档里的「4 警」**原文不动**，
  各自追加「后续」说明；t33 验证条目里的「4 警」是抄错，已更正为 0 警并注明原因。

**2. 三个年龄加成常量：从「空转常量」更正为「已删除 + 设计正式取消」**
- `GOLDEN_AGE_INTEGRITY_BONUS` / `AGE_IF_MUL_60` / `AGE_IF_MUL_65` 已由 t28 从 `src/data/ranks.js` 删除
  （core 零引用），t37 裁定**正式取消**该设计（65 岁 = 第 384 月 = 退休月，×1.40 无生效窗口；×1.15 只鞭打落后者），
  替代设计（人才计划年龄开窗）作为 backlog 记在 BALANCE §18.17。
- 改正位置：CONTRACT §1.2 的注释（t33 写的「空转常量」→ 补 t37 定案与三步接线要求）、
  t33 条目的第 6 点（同上措辞）。
- 生效项未动：`GOLDEN_AGE_MONEY_MUL`（0.40，engine.js:300 真读）仍在，契约里保留。

**3. 未处置（按归属留在别人文件里）**
- `docs/VERIFICATION.md` 的 M1 / M4（死常量、字库 WARN）**按指示不动**，归项目总监 t29 复验时更新。
- GDD / BALANCE / DEV 已由 t37 同步完毕（核对：GDD:556、BALANCE:676/747-748、DEV:241-242 均已写明达标与删除）。

### 验证（t38 留档，全部 exit 0）
- `node _t18-probe/contract-coverage.mjs`：契约声明 368 条、0 悬空、pending 空。
- `node _t18-probe/md-sanity.mjs`：CONTRACT / ARCHITECTURE / CHANGELOG 三份文档 0 问题。
- `node 评院士/scripts/check.mjs`：**0 错 0 警**，含「[ok] 字库规模达标（7 个数组全部 ≥ NAME_DATA_TARGET）」。

### 2026-10 一键分配工作（t25 [主程]，契约登记 t33 [arch]）

**1. §3.1 新增动作 `game/autoAssign`**
- 无 payload（reducer 不读 payload）；把可用学生分配进在研项目：① 每名还有名额的活跃学生至少挂 1 个项目；
  ② 剩余名额补进缺人最多的项目（同级看等级高、id 小）。
- **确定性**：不掷点、纯遍历（`autoAssignPlan` 是纯函数，同一 state 同一结果，可复现）。
- **幂等**：已分好的不会再动；连点第二次 `moveCount=0`、分配矩阵逐字不变，只回一句反馈（`ui.toast`）。
- 约束：每生 ≤ `MAX_PROJECTS_PER_STUDENT`(3)、每项目 ≤ `PROJECT_MAX_STUDENTS`(6)（后者只在这条路径生效，见第 3 点）。
- 写入：`ui.toast` + `ui.autoAssign` 摘要；**有实际移动时**补一条 kind=system 的纪事。
- 实现依据：`src/core/engine.js:57`（ACTIONS 表）、`engine.js:111`（reduce 分发）、
  `engine.js:1128-1199`（autoAssignPlan）、`engine.js:1206-1229`（reduceAutoAssign）。

**2. §3.4 新增 selector 与 vm 字段（形状逐字段核对 src/core，不照抄描述）**
- `selectAutoAssign(state)`（`selectors.js:421-439`）→ `{ canAssign, planCount, plan[], feedback, availableStudents,
  studentsTotal, projectsTotal, studentsWithoutProject[], studentsFull[], projectsShort[{id,name,members,cap}],
  studentCap, projectCap, last }`（`last` = `state.ui.autoAssign` 的深拷贝，可为 null）。
- `vm.autoAssign = selectAutoAssign(state)`（`viewmodel.js:73`）；同一对象也挂在 `vm.actions.autoAssign`
  （`selectors.js:413`）；两个上限另见 `selectUiConstants().autoAssign = { studentCap, projectCap }`（`selectors.js:358`）。
- `engine.autoAssignPlan(state)` 是**导出**的纯函数（`engine.js:1128`），reduceAutoAssign 与 selectAutoAssign 共用，
  保证「引擎会做的」=「UI 预览看到的」。

**3. §1.6 新增数据常量 `PROJECT_MAX_STUDENTS = 6`（`src/data/hardpoints.js:18`）**
- **作用域不对称，登记在案**：它只约束一键分配；手工路径 `reduceAssign`（`engine.js:1231-1249`）只检查
  `MAX_PROJECTS_PER_STUDENT`，**不读**它 → 手工仍可把第 7 人塞进同一项目。该不对称已由主理人转策划（t32）；
  若裁定收紧，需同改 `reduceAssign` 并回填 CONTRACT §1.6 与 BALANCE。

**4. §2 / §5 新增 state 字段 `ui.autoAssign` 与存档白名单**
- 形状：`{ monthIndex, moveCount, studentsTouched, studentsTotal, projectsTotal, availableStudents,
  studentCap, projectCap, studentsWithoutProject[], studentsFull[], projectsShort[], feedback }`。
- `save.js` 的 `pickUi`（`save.js:285-305`）已逐字段校验（非法值丢弃）；`createState` 不预置它（运行期创建）。

**5. §6.3 data-action 表补 `auto-assign`（前端 t26 已接线，登记即对齐）**
- 动作：`dispatch('game/autoAssign')`；handler 在 `src/ui/app.js:92`，UI 在
  `src/ui/views/projects.js:134-180`（只读 `vm.autoAssign` 渲染预览/反馈/上次摘要/两个上限），
  文案在 `src/ui/copy.js` 的 `UI_AUTO_ASSIGN`。
- 登记当时 HANDLERS 还没有这个键（文档先行）；t26 落地后复核：**HANDLERS 40 个、契约表 40 个，一一对应，pending 归零**。

**6. 顺带修掉一处既有悬空声明（探针抓出来的，不是 t25 引入的）**
- CONTRACT §1.2 原来还列着 `GOLDEN_AGE_INTEGRITY_BONUS` / `AGE_IF_MUL_60` / `AGE_IF_MUL_65`，
  但 `src/data/ranks.js` 已把这三个常量删除（core 从未读过它们）。
  已从本表移除并加注「要接线需三步：加回常量 → engine 真读 → 回填文档」；`GOLDEN_AGE_MONEY_MUL` 仍在生效，未动。
  > **后续（t28 移除 / t37 定案 / t38 复核）**：命名从「空转常量」更正为「**已删除**」，且 t37 已**正式取消**
  > 该年龄加成设计（理由与替代设计见 BALANCE §18.17）。上述「三步」仍然成立，但还需写明为何推翻 t37。

### 验证（t33 留档，全部 exit 0）
- `node _t18-probe/contract-coverage.mjs`：契约声明 365 → **368** 条（263 导出/字段名 + 26 action + 39 #id +
  40 data-action；符号表 650 个），逐条在代码侧符号表对上，**0 悬空**，**pending 为空**
  （`auto-assign` 已随 t26 接线闭合：HANDLERS 40 = 契约 40）。
  探针本轮强化为「selector 返回对象的字段级核对」—— selectAutoAssign / vm.actions.autoAssign / vm.consts.autoAssign
  的每个字段都在符号表里，所以上面第 2 条的字段形状是被机器核过的，不是照抄描述。
  （368 而非 371：第 6 条移除的 3 个已删除空转常量不再计入声明。）
- `node _t18-probe/md-sanity.mjs`：CONTRACT / ARCHITECTURE / CHANGELOG 三份文档 0 问题。
- `node 评院士/scripts/check.mjs`（0 错 0 警 —— **本条初写「4 警」是从更早条目抄来的旧文案，t33 当次实测已是 0 警**：
  字库在 t28 就扩表达标了；t38 复核时再次实测确认）、`node 评院士/tests/run-all.mjs`（6/6）—— 退出码 0。

### 2026-10 一作归属模型 v1→v2（t24 [主程]，契约登记 t31 [arch]）

> **本条把契约版本从 1 提到 2**，取代下面 t18 条目里关于版本号的说明（t18 当时确实还是 1）。
> **与 t18 那次的区别（别混）**：t18 只修**文字**（门槛到底读 papersFirst 还是 papers），papers 的含义没变、
> 也没动 STATE_VERSION；t24 改的是 **papers 的含义本身**（v1 课题组全部产出 → v2 玩家一作数），
> 因此必须 STATE_VERSION +1 并补迁移。冻结分工一句话：**晋升门槛读 player.papers（玩家一作篇数），
> totalIF 读全部论文**。

**1. STATE_VERSION 1 → 2 + 新增迁移 MIGRATIONS[1]（src/core/save.js:25-50）**
- 起因：一作归属模型改了 `player.papers` 的含义 —— v1 = 课题组全部产出（含学生一作）；
  v2 = **玩家一作的论文数**。
- 迁移规则：`player.papers` 逐档重算 = ① 结题台帐里 `firstAuthorId === PLAYER_AUTHOR_ID`（`'player'`）
  的篇数 + ② `player.papersFirst` 逐档计数（买/抢各记一次）；**totalIF 不动**（它一直是「所有论文」口径）。
- 依据（为什么不重算就是错的）：v1 里亲带项目并**不**给老板一作（署名按学生轮流），老板真正到手的一作只有
  买/抢 —— 所以按台帐重算与 v1 的实际行为完全一致；反之直接沿用旧 `papers` 会让门槛虚高。
- **主程实测样例（t24 留档）**：某 v1 存档 `papers = { q1: 9, q2: 24 }`、`papersFirst = { q1: 2, top: 1 }`，
  结题台帐里没有 `firstAuthorId === 'player'` 的篇 → 迁移后 `papers = { q1: 2, q2: 0, top: 1 }`
  （= 台帐 0 篇 + papersFirst 逐档），**`totalIF` = 777 保持不变**。
- `SAVE_VERSION` 随之 = 2（`save.js:19`）。**旧档不会崩**：hydrate 逐级迁移，迁移缺步/抛错才回落新局。

**2. §2 语义登记（v2）**
- `player.papers` = **玩家一作的论文数**：晋升门槛（q1/q2/正刊）只读它（`formulas.rankStatus`）。
  亲带项目（`project.playerLeading`）的论文一作全部归玩家 → 每篇 +1；学生负责的项目一作轮转署名给学生 →
  不进 papers（只进 totalIF）；买一作 +1；抢一作 +1。
- `player.papersFirst` = 「买来/抢来的第一作者」台账（诚信与展示读它；不再单独加门槛）。
- `player.totalIF` = **全部论文**（不论一作归属，含学生一作与毕业产出）的 IF 之和（GDD §3.2）；
  每篇只在「结题 / 买一作」时计一次，抢一作不重复计 IF。
- 实现依据：`src/core/engine.js:484-489`（awardPaper 只在 `ctx.playerFirst` 时 papers++）、
  `engine.js:404-431`（finishProject：亲带 → `firstAuthorId = PLAYER_AUTHOR_ID`）、
  `engine.js:1246-1267`（买一作 → `awardPaper(next, tier, { playerFirst: true })`）、
  `engine.js:1296-1331`（抢一作 → 改台帐署名 + papers/papersFirst 各 +1，不加 IF）。

**3. 新数据常量与新增 state 字段**
- `src/data/papers.js:51` 新增 **`PLAYER_AUTHOR_ID = 'player'`**（论文台帐里「一作是玩家本人」的署名 id）。
- 论文台帐条目形状（`project.paperTiers` 结题后）：
  `{ paperId, patternId, tier, if, firstAuthorId, firstAuthorName, grabbed, grabbedMonthIndex }`。
- `counters.papersAwarded`（`state.js:221`）：全局见过刊的论文数（所有论文都算，与一作归属无关）。
- `stats.lastReceipt` 新增 `papersAll`（本月见刊全部论文数）与 `papersStudent`（其中学生一作数）
  （`engine.js:248-249`；`save.js:254-255` 已在读档白名单里）。

**4. 待办（UT 范围，不是契约问题）**
- UI 文案：`src/ui/views/projects.js:123` 的「我亲自带」按钮应说明
  「亲带项目的论文一作全部归你，代价：进度 ×0.85、每月 +1 精力」；
  月报（`src/ui/receipt.js`）可用 `papersAll` / `papersStudent` 展示「本月见刊 X 篇，其中你的一作 Y 篇」。
  截至本次登记，这两处还没落地 → 归前端。
- `docs/VERIFICATION.md`（项目总监的 SPEC 覆盖表）里「玩家是通讯作者、想拿一作必须抢/买」的表述已过期，
  需按 v2 复核（亲带项目即为一作）。

### 2026-10 契约漂移修复（t18 [arch]，评审来源 t7 F6/F7/F8）

**1. CONTRACT §2 论文归属判定——原表述与实现相反，已修正**
- 旧文字：「player.papersFirst …只影响诚信与结局文案，不参与晋升门槛」。它容易被读成「买/抢的论文不进
  papers、不进门槛」，照它改代码会把晋升与抢一作玩法改坏（也是 t7 F2「抢一作重复计 IF」的诱因）。
- 现口径（与 GDD §5.5「抢到的论文计入玩家的一作计数」及实现一致）：
  `player.papers` = **计入晋升门槛的论文计数**（结题时每篇按最终档位 +1；买来/抢来的一作各再 +1）；
  `player.papersFirst` = 「抢来/买来的第一作者」**台账**（不直接参与门槛计算，诚信与结局文案读它）；
  抢一作只挪署名，**不再重复计 IF**（该篇 IF 已在结题时计过一次）。
- 同时在 CONTRACT 新增 **§8 契约勘误记录（Errata）**，把历次「文档写反/漏登记」的地方连修正日期一起留痕；
  §2 正文保留「此处曾写反，2026-10 修正」的说明，防止再次被误引。

**2. CONTRACT §1.4 / §1.8 市场席位与「市场不变式（冻结）」——MARKET_SLOTS 语义 5 → 8**
- 明确常量：`PROJECT_SLOTS = 5`、`STUDENT_SLOTS = 3`、
  `MARKET_SLOTS = PROJECT_SLOTS + STUDENT_SLOTS = 8`（总席位，仅作 UI 展示口径 `selectMarket.slots.cap`）、
  `PROJECT_OFFER_TTL_MONTHS = 6`、`STUDENT_OFFER_TTL_MONTHS = 6`、
  `MIN_ACCEPTABLE_PROJECT_OFFERS = 1`、`MIN_RECRUITABLE_STUDENT_OFFERS = 1`（market.js）。
- 新增**不变式四条**：① 项目与候选人各自独立配额、互不挤占；② 任一月份至少 N 个「按当前头衔与持有仪器
  真能承接」的项目 offer；③ 至少 N 个「按当前 IF 与头衔够得着」的候选人；④ 非锁定 offer 按各自 TTL 到期
  撤走（locked 的不受 TTL 限制、仍占席位）。
- 起因：t4 修「项目与学生抢同一个池子 → 项目 offer 永久停发」死锁；回归断言在 tests/market.test.mjs
  与 scripts/simulate.mjs 的「任何月份至少 1 个可承接 offer」。
- 待办（非本文件）：docs/BALANCE.md §5.2 仍写 MARKET_SLOTS = 5，由策划师同步——团队约定是
  「契约改 CONTRACT、数值改 BALANCE」。

**3. CONTRACT §3.1 / §3.4 / §6 新增 API、字段与 data-action 登记**
- action：新增 `game/chooseDefer {studentId, choice:'defer'|'giveUp'}`、`game/setName {name?, sonName?}`；
  修正参数口径——买一作 `{tier}` **必填**（缺档位或经费不足 → toast 且不扣钱）、
  抢一作 `{studentId, paperId, tier}` **全必填**（只能抢「台帐里该生为一作且未被抢」的那一篇；一篇一次、
  每生每月一次、档位必须与台帐一致）。
- viewmodel：`vm.consts`（常量透传，UI 不许硬编码数值）、`vm.receipt`（上月结算回执 = state.stats.lastReceipt）、
  `vm.pendingDefer`（延毕待决名单，非空时 canAdvance 为 false）。
- selectors：`selectPendingDefer`、`selectReceipt`、`selectUiConstants`、
  `selectHardpoint.attempts`（team/solo/fake 的 studentIds/names/chance/pct）、`selectMarket.slots{used,cap}`。
- GameState 字段补登记（§2）：`Student.soloThisMonth`、`eventState.cooldowns`、
  `stats.lastReceipt`（含完整 Receipt 形状）、`counters.deferredStudents`、
  `flags.negativeMoneyMonths` 的运行期创建说明。
- UI 契约：§6.1 视图表补 `src/ui/copy.js`（只放文案、零数值）与 `src/ui/receipt.js`（月报）；
  §6.3 补登记 t5–t10 期间新增的 14 个 data-action（reset-confirm / resign-confirm / defer-choice / help /
  modal-close / receipt-open / ending-hide / rename-open / rename-apply / goto-tab / lab-section /
  chronicle-filter / grab-confirm / grab-cancel）与 4 个 dataset 字段
  （data-paper-id / data-choice / data-section / data-filter）。

**4. CONTRACT §3.5 STATE_VERSION 归属更正（结论：改契约、不改代码）**
- 旧文字把 `STATE_VERSION` 列在 `save.js` 名下。核实结果：它只由 **src/core/state.js:24** 拥有
  （`STATE_VERSION = 1`）；src/core/save.js 只是 import 它并导出 `SAVE_VERSION = STATE_VERSION`；
  src/core/engine.js 做了 re-export；全仓库没有任何调用方从 save.js 取 `STATE_VERSION`。
- 故 §3.5 把 `STATE_VERSION` 归到 `state.js` 一行（save.js 一行只留 `SAVE_VERSION`）并记录该笔误；
  docs/ARCHITECTURE.md §4 同步补「版本号归属」说明。

### 本次契约变更的验证（t18 留档，全部 exit 0）
- `node _t18-probe/contract-coverage.mjs`（仓库外探针）：从 CONTRACT 抽出 **364 条声明**
  （261 个导出/字段名 + 25 个 action 类型 + 39 个 DOM `#id` + 39 个 data-action），逐条在代码侧 632 个符号里
  找到对应实现，**0 条悬空**。
- `node _t18-probe/md-sanity.mjs`：CONTRACT.md / ARCHITECTURE.md 表格列数一致、无未闭合反引号；
  顺带修掉 §3.1/§4.3 表格里 5 处未转义竖线（原本渲染会错列）。
- 全量回归：check.mjs（0 错 4 警）、tests/run-all.mjs（6/6）、ui-smoke.mjs（111 ok）、simulate.mjs（速通 8/8）、
  build-single.mjs（348 KB）、version.mjs —— 全部通过。
  > **后续（t38 复核）**：这里记的「4 警」是 **t18 当次运行的真实输出**（当时字库仍是种子规模），保留不改写；
  > 字库在 t28 扩表达标后，check.mjs 现为 **0 错 0 警**。

### 未决事项（已解决，留档）
GDD §2.7「晋升门槛只统计玩家为一作的论文」与实现的口径差，已由上面的 t24 v2 模型消除。
若将来再改这个口径，仍须 STATE_VERSION +1 + 补迁移 + 重跑平衡标定（属策划决策范围）。

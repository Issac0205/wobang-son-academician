# 工程架构（ARCHITECTURE）

版本 0.1.0 · 契约版本 STATE_VERSION = **2**（t24 一作归属模型 v1→v2）· 配套文档：docs/CONTRACT.md（接口冻结）、docs/GDD.md（玩法）、docs/BALANCE.md（数值）、docs/DEV.md（怎么改）

---

## 1. 目标与技术约束

| 约束 | 落地方式 |
|---|---|
| 纯前端 ES Module，无构建依赖 | 源码直接可跑（原生 import），没有任何打包器/转译器；npm scripts 只是 node 脚本 |
| 开发用 node 静态服务器 | server.mjs（零依赖 http 服务器，默认 127.0.0.1:5175） |
| 发布用单文件 HTML（双击即玩） | scripts/build-single.mjs 把所有模块内联进 dist/wobang-son-academician.html |
| 存档用 localStorage | src/core/save.js（带版本迁移与宽容校验） |
| node >= 18 | package.json engines；脚本只用 node 内置模块 |
| 可从工作区根目录直接跑脚本 | 所有脚本用 import.meta.url 解析路径，不依赖 cwd |

---

## 2. 分层与模块职责

    浏览器 / DOM
       ↑ 单向：UI 读 viewmodel，写只走 dispatch
    src/ui/          渲染 + 交互（无业务计算）
       ↑
    src/core/        状态 + 规则 + reducer + 存档（无 DOM、无 Math.random）
       ↑
    src/data/        纯常量与数据表（零 import、零逻辑）

    src/main.js      唯一的装配点：createStore + createApp + 自动存档 + 导入导出
    server.mjs       开发用静态服务器
    scripts/         check / simulate / ui-smoke / build-single / version（自检与发布）
    docs/            ARCHITECTURE（本文）/ CONTRACT（接口冻结）/ DEV（怎么改）/ GDD / BALANCE

### 2.1 每个文件的职责与依赖方向

| 文件 | 职责 | 允许依赖 |
|---|---|---|
| src/main.js | 装配 store、UI、自动存档、导入导出、把实例挂到 window.__GAME__ | core/*、ui/app.js、data/tuning.js |
| src/core/state.js | GameState 唯一定义处：createState / 子对象工厂 / cloneState / advanceCalendar / energyMaxFrom | data/* |
| src/core/rng.js | 确定性随机（mulberry32）+ clamp/round，可序列化为 { seed } | 无 |
| src/core/naming.js | 学生命名（字库 + 黑名单 + 同名规避） | data/names.js |
| src/core/formulas.js | 全部纯计算：精力、仪器、进度、毕业、幸福度、成功率、论文 IF、晋升差距 | data/*、rng(clamp/round) |
| src/core/rules.js | 全部纯判定：条件 DSL、市场开放、承接/招募门槛、晋升与增选、结局 | data/*、formulas |
| src/core/engine.js | ACTIONS + reduce（state 的唯一合法变迁处）+ 事件效果求值 + 月份结算 | data/*、state、formulas、rules、rng、naming |
| src/core/store.js | 单一 store：getState / dispatch / replaceState / subscribe | state(cloneState) |
| src/core/save.js | 存档信封、序列化、宽容反序列化、版本迁移 | data/tuning、state、rng |
| src/core/selectors.js | 细粒度只读派生数据（UI 取数的原料） | data/*、formulas、rules |
| src/core/viewmodel.js | 把 selectors 组装成「一屏一对象」（含 consts/receipt/pendingDefer），UI 只消费它 | selectors |
| src/systems/bots.js | 无头参考机器人（策略 + 批量跑局），只给 scripts/simulate.mjs 与 tests 用；不被 main.js 引用，因此**不进 UI、不进单文件包** | core/*、data/* |
| src/ui/dom.js | DOM 构建小工具（h/mount/clear/bar/tag/button/kv/card/subtabs/paper-tiles/格式化） | 无 |
| src/ui/copy.js | UI 文案表（**只放中文，零数值**）：标题、按钮、提示、结局副标题 | 无 |
| src/ui/receipt.js | 月度回执（月报）渲染：钱/耗材/进度/幸福度都去哪了 | dom、copy |
| src/ui/hud.js | 顶部资源条渲染 | dom |
| src/ui/views/*.js | 五个标签页视图（课题组/项目/市场/行动/纪事），课题组页内分 总览/学生名册/仪器台/耗材库 | dom、copy、viewmodel 产物 |
| src/ui/modal.js | 事件弹层、延毕决定、下海/重开确认、月报、结局结算、toast | dom、copy、viewmodel 产物 |
| src/ui/app.js | UI 装配：订阅 store → 渲染；事件代理 data-action → dispatch；纯展示的局部状态放 localUi（进 state） | dom、copy、hud、views、modal、viewmodel |

**依赖方向铁律**：data ← core ← ui ← main。任何反向 import（例如 core 引 ui）都会在评审里被打回。

---

## 3. 状态树（GameState）

完整字段与类型见 docs/CONTRACT.md §2（同一份契约，避免两处定义漂移）。这里只强调**不变量**：

1. state 必须是 JSON 可序列化纯数据：不放函数、Map、Set、Date、DOM 节点。
2. 所有随机都必须来自 state.rng：reduce 开始时 createRng(state.rng)，结束时写回 rng.snapshot()。
   因此「同一存档 + 同一操作序列」永远复现同一结果（无头模拟与 bug 复现都靠它）。
3. 派生数值不落库：进度百分比、仪器加成、月收入、晋升差距等一律现算（formulas/selectors），
   避免存档里出现「缓存与真相不一致」。
4. 数组里只放「当前为真」的实体：毕业/离组的学生留在 students 里但标 graduated/left = true；
   已结题/失败的项目留在 projects 里并标 status，便于纪事与统计。
5. 计数器的 nextXxxId 只增不减，且读档后取 max(存档值, 现存 id 最大值+1)，防止 id 撞车。
6. ui 子树只放「视图状态」（当前标签页、选中项、toast），不允许放业务数据。
   纯展示性的局部状态（当前分栏、纪事筛选、抢一作二次确认条、弹层开关）放在 src/ui/app.js 的 localUi 里，**不进 state**。
7. 待决状态不加新字段：事件待决用 state.pendingEvent / month.pendingQueue；延毕待决由 studyMonthsLeft /
   degreeProgress / deferMonths 推导（engine.pendingDeferStudents）。这样读档后待决依然成立。

---

## 4. 存档格式与版本迁移

    localStorage[SAVE_SLOT_KEY] = JSON.stringify({ version: STATE_VERSION, savedAt: Date.now(), state: GameState })

- **写入**：主循环里每次 calendar.monthIndex 变化后自动存档（AUTOSAVE_ON_MONTH_END）；
  手动存档、导出 JSON、导入 JSON 都走同一信封。
- **读取**：hydrate(信封) 的做法是「先 createState 造一个全新 state，再按白名单把存档里的合法字段合并进来」：
  缺字段用默认值、非法类型丢弃、数值越界夹紧（clamp）、数组元素逐条重建（createStudent/createProject/createOffer）。
  因此旧版本存档、被手工改坏的存档都不会让游戏崩，最坏情况是丢几个字段。
- **版本号归属**：STATE_VERSION 定义在 src/core/state.js（当前 = 2）；save.js 既导出 SAVE_VERSION = STATE_VERSION，
  也 re-export STATE_VERSION 本身（t16 F8），engine.js 同样 re-export —— 取值只有一个来源。
- **迁移**：STATE_VERSION 每 +1，就在 save.js 的 MIGRATIONS 里加一条 vN: (state) => state。
  现有 MIGRATIONS[1]（v1→v2，t24）：把 player.papers 由「课题组全部产出」重算为「玩家一作数」——
  逐档 = 结题台帐里 firstAuthorId === PLAYER_AUTHOR_ID（'player'）的篇数 + papersFirst 逐档计数；totalIF 不动。
  语义依据见 CONTRACT §2 与 §5。
  迁移链按版本逐级执行；任何一步缺失或抛错 → 判定存档不可用 → 返回 null → 主流程开新局并提示。
- **版本高于当前**（玩家用新版存了档再打开旧版）：直接判定不可读，绝不尝试「猜字段」。

---

## 5. 时间推进：一个月的调用顺序（契约级顺序，不能随意调换）

入口：store.dispatch(ACTIONS.advanceMonth({ autoResolveEvents:false })) → engine.reduceAdvanceMonth。
前置守卫：state.ending 或 phase='ended' → 原样返回；存在 state.pendingEvent → 拒绝推进（先处理事件）；
有延毕待决（engine.pendingDeferStudents(state) 非空）→ 拒绝推进并写 ui.toast（「先做延毕决定：X」），
必须由 game/chooseDefer 拍板；UI 侧同一条件体现在 vm.canAdvance。

在 cloneState 出来的副本上依次执行（每一步都只改副本，最后一次性返回）：

| # | 步骤（函数） | 做了什么 | 受影响字段 |
|---|---|---|---|
| 1 | settlePlayer | 健康 −HEALTH_DECAY_PER_MONTH；累计造假 ≥ AUDIT_TRIGGER_FAKE_COUNT 时按月概率触发审查（诚信 −15） | player.health, player.integrity, counters.auditsTotal |
| 2 | settleIncome | 校投 +schoolFundMonthly(rank)（黄金年龄有额外资助）；扣仪器维护费；扣全体学生工资 | player.money |
| 3 | settleProjects | 逐项目：耗材消耗（不足则本月进度 ×0）→ 暴露到期难点 → 学生产出累加进度（本月 soloThisMonth 的学生不计）→ 逾期判定（扣诚信/幸福，超 OVERDUE_GRACE_MONTHS 判失败）→ 进度达标则结题（结算出论文台帐 paperTiers：档位 + 实际 IF + 一作是谁；**只有一作是玩家本人那篇进 papers**，亲带项目即如此）；尾款、诚信加成、票 | player.consumable/money/integrity/papers/totalIF/tickets, projects[], counters（含 papersAwarded） |
| 4 | settleStudents | 逐学生：幸福度变化（工资/期望差/耗材模式/压力/心结/延毕/高位回归）→ 毕业进度 → 毕业（发论文、诚信 +3、博士每 3 人 +1 票）或**进入延毕待决**（不再自动延毕，等 game/chooseDefer 拍板）→ 幸福归零离组（99.5% 转组，项目进度 ×0.40；0.5% 极端事件诚信 −50）；soloThisMonth 用完即清 | students[], player.graduated/integrity/papers/tickets |
| 5 | refreshMarket | 过期 offer 撤走（项目/候选人各自 TTL）；按开放月份刷新：项目 offer 维持 PROJECT_SLOTS 个且保证 ≥MIN_ACCEPTABLE_PROJECT_OFFERS 个「现在真能接」的，候选人维持 STUDENT_SLOTS 个且保证 ≥MIN_RECRUITABLE_STUDENT_OFFERS 个「够得着」的 | market.* |
| 6 | rollEvents | 抽 RANDOM_EVENTS_PER_MONTH_MIN..MAX 条可用事件，写入 pendingQueue；phase='settle'（autoResolveEvents=true 时立即结算，无头模式用） | month.eventQueue/pendingQueue, pendingEvent, eventState, phase |
| 7 | 重置月度行动 | monthActions 清零、monthEnergySpent/monthMoneySpent 清零、fakesThisMonth 清零 | player.month* |
| 8 | advanceCalendar | monthIndex +1，year/month 联动；年龄 = START_AGE_YEARS + (year-1)；精力重置为 energyMax | calendar, player.age/energy |
| 9 | checkElectionWindow | 每 ELECTION_WINDOW_INTERVAL（24）个月打开一次增选窗口；错过且票够则置 almostAcademician | flags |
| 10 | checkPromotion | 达标即晋升（院士还要年龄/推荐票/窗口）；院士即结局 | player.rankIndex/integrity, ending |
| 11 | recordHistory | 写一条 MonthlyRecord（曲线与统计的来源） | stats.history/peak |
| 12 | checkEnding | 破产计数、实验室空了、退休；按 ENDINGS 优先级判定结局（含变体文案） | flags, ending, phase |

结算完成后：next.rng = rng.snapshot()；返回 next。UI 收到新 state 后重渲染，若 pendingEvent 非空则弹事件弹层。

**年**不是独立的推进单位：year = floor(monthIndex / 12) + 1，只有 UI 展示与年龄计算用。

---

## 6. UI 与核心的通信方式

    main.js:  store = createStore({ initialState, reducer: reduce, actions: ACTIONS })
              app = createApp({ store, io })   // io 提供存档/导出/导入/重开
              app.start()                      // 订阅 + 首屏渲染

1. **单一 store**：整个应用只有一个 store 实例，state 只有一个来源。
2. **单向数据流**：UI 事件 → store.dispatch(action) → reduce 返回新 state → 通知订阅者 → app.render() → 各视图从 buildViewModel(state) 取数重建 DOM。
   UI **永远不写 state**（不写 state.player.money -= x 这类代码），也不缓存跨帧的业务数据。
   UI 需要的一切数值与文案都来自 buildViewModel(state)：hud / tabs / tab / crew / projects / market / actions /
   chronicle / consts / receipt / pendingEvent / pendingDefer / ending / toast / canAdvance。
3. **全量重渲染**：每次 state 变化都重新构建当前标签页的 DOM。游戏规模小（几十个节点），
   换来的是「不可能出现界面与状态不一致」；性能瓶颈出现时再引入局部更新，属于后续优化。
4. **事件代理**：只在 #app 上挂一个 click 监听，向上找最近的 [data-action] 元素，
   查 app.js 的 HANDLERS 表得到处理器；因此视图代码只声明「这个按钮是哪个动作」。
5. **错误兜底**：参数不合法或资源不足时，reducer 返回「带 ui.toast 的新 state」或原 state，
   绝不在 UI 里做业务判断（UI 只负责把 disabled 状态画出来）。
6. **测试钩子**：main.js 把 { store, app, actions, reduce, createState, buildViewModel, save, hasSave } 挂到 window.__GAME__，
   scripts/ui-smoke.mjs 用它在无浏览器环境里驱动整个界面。

---

## 7. 一条完整数据流（接项目 → 推进 → 结题）

1. 市场页点「承接」→ dispatch game/acceptProject({offerId, studentIds})
2. reduceAcceptProject：校验（仪器/等级/并发上限）→ 扣/加钱（定金 = money × depositRate，按 DEPOSIT_TO_CONSUMABLE 折算成耗材）
   → createProject（按 hardpointCount(tier) 生成 hidden 难点，appearAt 均匀分布在工期内）→ 分配学生 → 写纪事。
3. 每次 advanceMonth 的 settleProjects：耗材扣减 → 到期难点变 open（rollHardpointHd 抽难度）→
   每个学生贡献 studentBaseProgress × progressMultiplier（耗材模式 × 仪器加成 × (1 − 0.25×最重难点)）→ 累加 progress。
4. 项目页点「多人攻坚 / 造假蒙混 / 单人猛干」→ dispatch game/resolveHardpoint：
   三种方式的成功率/被抓概率由 core 预先算好（selectHardpoint.attempts），UI 原样显示并把**同一批 studentIds** 回传；
   solo 会把该生 soloThisMonth 置 true（本月不产出项目进度）。失败累计 retries（下次成功率 +0.10，上限 +0.30）。
5. progress ≥ workload → finishProject：按 def.papers 的槽位模板抽档位、每个未解决难点降一档，把槽位结算成**论文台帐**
   （paperTiers：paperId / 档位 / 实际 IF / 一作是谁 / 是否被抢）→ 每篇 awardPaper（IF **一律**计入 totalIF、
   只有 ctx.playerFirst 为真时档位才计入 papers）→
   尾款 = money × (1 − depositRate) × 0.8^未解决难点（逾期再 ×0.8）→ 诚信加成 → 学生幸福 +5 → T5/T6 给推荐票。
   抢一作（game/grabFirstAuthor {studentId, paperId, tier}）只改台帐署名与 papers/papersFirst 计数，**不再加 IF**。
6. UI 侧：projects 视图读 selectProjects()，看到的就是上面这些字段的只读投影。

---

## 8. 确定性与可复现

- 随机源：src/core/rng.js（mulberry32）。种子存 state.rng.seed，每次 reduce 结束写回。
- 禁止：core 里出现 Math.random()（check.mjs 静态检查）；Date.now() 只允许出现在
  state.js（新局种子兜底）、save.js（存档时间戳）、store.js（调试历史），不参与任何数值。
- 复现方式：createState({ seed })，再喂同一串 action 即可得到同一局。
  scripts/simulate.mjs 的种子固定为 'sim-1'、'sim-2'…，所以它的输出可以逐字对比。
- 随机调用顺序是契约的一部分：改动结算顺序会改变将来的每一局，必须同步 CHANGELOG。

---

## 9. 工程约定与自检

| 脚本 | 作用 | 必须的行为 |
|---|---|---|
| scripts/check.mjs | 交付物清单、语法、导入完整性、DOM 契约、交互契约、静态资源、数据纯度、确定性、字库规模 | 发现问题退出码 1；干净退出码 0 |
| scripts/simulate.mjs | 无头模拟 N 局 × M 月，打印关键曲线与结局 | 退出码 0；曲线条数必须等于推进月数 |
| scripts/ui-smoke.mjs | 用 scripts/lib/dom-shim.mjs 渲染整个 UI 并点击交互 | 退出码 0；渲染/代理/存档任一环节抛错即失败 |
| scripts/build-single.mjs | 打包单文件 HTML 到 dist/ | 退出码 0；发现残留 import/export 或重名即失败 |
| scripts/version.mjs | 打印版本与各目录规模 | 退出码 0 |

所有脚本都能从工作区根目录直接运行（node 评院士/scripts/xxx.mjs），因为路径一律基于 import.meta.url。

---

## 10. 已知取舍与待办（交给主程/策划）

1. **参考机器人（src/systems/bots.js）现在能打通速通线**：simulate 的 speedrun 策略 8/8 真院士（144–288 月）；
   balanced 策略 8/8 在 384 月退休、仍停 rank5 —— 这个「断崖」是 BALANCE 决策项（t7 F11），不是链路故障。
2. **耗材采购是新增机制**：SPEC/BALANCE 没写「耗材用经费买」，但缺了它会出现「有钱没耗材 → 进度永远 ×0」的死锁，
   因此加了 CONSUMABLE_PRICE_PER_UNIT / CONSUMABLE_BUY_PACK 与 game/buyConsumable（已登记在 CONTRACT）。
3. **市场改成独立配额 + 双 TTL**：PROJECT_SLOTS 5 / STUDENT_SLOTS 3 / 各自 TTL 6 个月 / 两条不变式（见 CONTRACT §1.4），
   治的是 t4 发现的「项目与学生抢同一个池子 → 项目 offer 永久停发」死锁。
4. **结题论文归属**（t24 起「v2 一作归属模型」）：papers = **玩家一作的论文数**（亲带项目的论文全部归玩家；
   学生负责的项目一作署名轮转给学生、不进 papers；买/抢一作各 +1）；papersFirst 是「买来/抢来的第一作者」台账；
   totalIF 统计全部论文、每篇只计一次；抢一作不重复计 IF。改这个模型动过一次 STATE_VERSION（1→2，见 §4）。
   详见 CONTRACT §2、§5、§8。
5. **字库已达标（2026-10，t28 扩表 / t38 同步）**：names.js 七项语料全部 ≥ NAME_DATA_TARGET ——
   实际 单字姓 192 / 复姓 20 / 双字名首 244 / 双字名末 264 / 单字名 204 / 黑名单 50 / 谐音 42
   （目标 186/20/240/260/200/50/40）；check.mjs 第 9 项直读 NAME_DATA_TARGET 逐键比对，正常输出
   「[ok] 字库规模达标」、**0 警告**。扩表仍然只加数组条目、不动逻辑。
6. **UI 视觉已由前端落地**：src/styles/main.css 是完整设计系统（纸感台账风、58 个 CSS 变量、4 个断点、
   prefers-reduced-motion 兜底），不再是「结构占位」。
7. **性能**：全量重渲染在小规模下没问题；若将来加动画/大量节点，再引入按视图局部更新（保持同样的 dispatch 契约）。
8. **契约勘误已归档**：2026-10 修掉了几处「文档与实现相反」的表述（论文归属、市场席位、新增 API、STATE_VERSION 归属），
   全部记在 docs/CONTRACT.md §8；改代码前先看那张表，避免照旧文字把玩法改坏。

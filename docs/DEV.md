# 开发与改数值手册（给非程序员的版本）

这份文档假设你**不会写代码**，但想改数值、加内容、或者把游戏跑起来。所有操作都在命令行（Windows 的 PowerShell / 终端）里做，
每段命令都可以直接复制粘贴。命令里的 评院士 就是项目文件夹 D:/harness/评院士。

---

## 1. 先把游戏跑起来

### 1.1 最省事：双击单文件

1. 在 D:/harness/评院士 打开终端，运行：

       node 评院士/scripts/build-single.mjs

   （如果你已经在 评院士 目录里，就写 node scripts/build-single.mjs）

2. 会生成 dist/wobang-son-academician.html —— **双击它就能玩**，不需要服务器、不需要联网。

### 1.2 开发模式（改完刷新就能看到）

    node 评院士/server.mjs

然后在浏览器打开 http://127.0.0.1:5175/ 。改完源码保存，刷新页面即可（不需要重新构建）。

### 1.3 想换端口

    $env:PORT=8080; node 评院士/server.mjs

---

## 2. 三个必会的自检命令

    node 评院士/scripts/check.mjs        # 检查代码没写坏（语法/接口/DOM/数值表）
    node 评院士/scripts/simulate.mjs     # 让机器人自动打几局，打印曲线
    node 评院士/scripts/ui-smoke.mjs     # 不打开浏览器，把界面渲染一遍看会不会报错

外加一条一键全跑：

    cd 评院士; npm test

它们**只要退出码是 0（屏幕上最后一行不是「失败」）**就说明项目是健康的。
改完数值，至少跑一次 check.mjs 和 simulate.mjs 再提交。

---

## 3. 改数值：只需要动 src/data/ 里的表格

所有数值都集中在 src/data/ 目录。**不要改 src/core/ 里的文件来调数值**（那里只有逻辑）。

| 你想改什么 | 打开哪个文件 | 找这些名字 |
|---|---|---|
| 开局经费/耗材/健康/年龄 | src/data/tuning.js | INITIAL_MONEY INITIAL_CONSUMABLE INITIAL_HEALTH START_AGE_YEARS |
| 每月精力上限 | src/data/tuning.js | ENERGY_MAX_BASE ENERGY_PER_HEALTH_10 ENERGY_LOW_HEALTH_THRESHOLD |
| 耗材模式（随意挥霍/正常/收紧） | src/data/tuning.js | CONSUME_MODES 里的 consumeMul / progressMul / happyDelta |
| 买耗材的价钱与批量 | src/data/tuning.js | CONSUMABLE_PRICE_PER_UNIT CONSUMABLE_BUY_PACK |
| 晋升门槛（IF/论文数/名额/校投） | src/data/ranks.js | RANKS 数组里每一级的 ifReq q1Req q2Req topReq masterCap phdCap schoolFundYear |
| 院士推荐票/增选周期 | src/data/ranks.js | RECOMMEND_TICKET_REQ ELECTION_WINDOW_INTERVAL TICKET_PER_T6 |
| 仪器价格/加成/维护费 | src/data/instruments.js | INSTRUMENTS 里的 price bonus maintain tierGate |
| 项目工作量/钱/工期/仪器要求 | src/data/projects.js | PROJECTS 数组里的 workload money limitMonths require consumablePerMonth |
| 期刊影响因子 | src/data/papers.js | JOURNAL_IF_BASE |
| 论文档位概率（投中一区的机会） | src/data/papers.js | PAPER_PATTERNS 里的 weights |
| 学生天赋分布/工资档 | src/data/students.js | ABILITY_* WAGE WAGE_HAPPY GAP_PENALTY |
| 幸福度压力/离组阈值 | src/data/students.js | PROJECT_STRESS_IDLE LEAVE_TRIGGER_HAPPINESS DEFER_HAPPY |
| 难点数量、三种处理方式的成功率 | src/data/hardpoints.js | HARDPOINT_HD_DIST TEAM_SUCCESS_* SOLO_SUCCESS_* FAKE_CATCH_* |
| 人才市场开放月份/招募门槛 | src/data/market.js | MARKET_OPEN_MONTHS REQ_IF_WEIGHT RECRUIT_COST RECRUIT_PER_MONTH |
| 四种行动的消耗与效果 | src/data/actions.js | ACTION_DEFS TALK_* MEETING_* EXERCISE_* HAPPY_ACTION_* |
| 结局条件与文案 | src/data/endings.js | ENDINGS 里的 cond 与 text |
| 随机事件的触发条件与效果 | src/data/events.js | EVENTS 数组 |
| 学生名字的字库 | src/data/names.js | SURNAMES_SINGLE GIVEN_FIRST GIVEN_LAST GIVEN_SINGLE |

### 改完之后怎么验证

1. 跑 node 评院士/scripts/check.mjs —— 表格写错格式（漏逗号、名字拼错）会立刻报错并指出文件与行号。
2. 跑 node 评院士/scripts/simulate.mjs —— 看机器人几局的曲线：经费会不会崩、IF 涨得快不快、多久通关、诚信掉不掉。
3. 想对比改动效果，可以把两次 simulate 的输出贴在一起看（它的随机种子是固定的，同一份代码结果可复现）。

---

## 4. 加一种新仪器

只改一个文件：src/data/instruments.js，往 INSTRUMENTS 数组里加一条（**照抄格式**，注意逗号）：

    { id: 'nmr', name: '核磁', tier: 'major', tierLabel: '大幅',
      bonus: 0.20, initCount: 0, price: 320, maintain: 3.2, tierGate: 5, holdCap: 3 },

字段含义：

- id：英文小写标识，**不能和已有的重复**（程序内部靠它记账）。
- name：中文显示名。
- tier：'minor'（小幅）或 'major'（大幅，界面上会标出来）。
- bonus：拥有 1 台带来的进度加成（0.20 = +20%），全部仪器的加成合计最多 INST_BONUS_CAP = 0.90。
- initCount：开局就有的台数（新仪器一般写 0）。
- price：第一台的价格（万元）；买第 2、3 台会自动乘 INST_PRICE_GROWTH = 1.6 倍。
- maintain：每月维护费（万元）。
- tierGate：需要的最低头衔等级才能申购（1 = 副研究员就能买）。
- holdCap：最多持有几台。

加完之后：跑 check.mjs（会检查 id 有没有重复、字段有没有漏），然后 ui-smoke.mjs 看能不能正常渲染。
仪器界面、购买逻辑、维护费结算**都是自动的**，不需要改别的地方。

---

## 5. 加一个新项目

改 src/data/projects.js，往 PROJECTS 数组里加一条：

    { id: 'N7', name: '国家·重大仪器专项', category: 'nation', tier: 4,
      workload: 900, limitMonths: 30, money: 300, depositRate: 0.30, consumablePerMonth: 10,
      papers: ['PA','PA','PB','PB','PB','PC','PC','PD'],
      require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 2, elisa: 1 },
      expectedIF: 62, q1Expect: 1.6, topExpect: 0.05,
      hint: '一句话吐槽，会显示在市场上。' },

字段含义：

- id / name：内部标识与中文名（id 不能重复）。
- category：'nation'（国家项目）或 'enterprise'（企业横向）—— 决定定金率、诚信加成与市场上的标色。
- tier：1–6，越高越难、越赚钱；玩家必须头衔等级够高才能接。
- workload：总工作量（进度攒够它就结题）。参考：T1 约 80–170，T2 约 300–380，T6 约 2000。
- limitMonths：工期（月）。逾期会扣诚信、掉学生的幸福度，拖太久直接判失败。
- money：项目总额（万元）。承接时先给一部分定金（money × depositRate），结题时给尾款（有难点/逾期会打折）。
- consumablePerMonth：每月消耗的耗材单位数。**注意**：耗材见底时项目进度会归零，别设得太夸张。
- papers：结题时产出的论文槽位（PA..PE，见 src/data/papers.js 的 PAPER_PATTERNS）。每个未解决的难点会把论文整体降一档。
- require：需要的仪器与台数（key 必须是 instruments.js 里的 id）。
- expectedIF / q1Expect / topExpect：预期产出（只用于展示与平衡自检，程序不靠它们算账）。
- hint：市场卡片上的一句吐槽文案。

加完之后跑 check.mjs + simulate.mjs，看机器人能不能接得上、结得掉。

---

## 6. 加一个新随机事件

改 src/data/events.js，往 EVENTS 数组里加一条：

    { id: 'e_coffee', title: '咖啡机坏了', weight: 6, cond: { stat: 'monthIndex', op: '>=', value: 6 },
      tone: 'absurd',
      effects: [
        { kind: 'energy', mode: 'add', value: -1 },
        { kind: 'studentHappy', target: 'all', value: -4 },
      ],
      text: '咖啡机坏了。有人在群里发了三行「理性讨论」，然后自己下楼买了三杯。' },

字段含义：

- id：唯一标识（e_ 开头）。title：弹层标题。
- weight：出现权重，越大越常见（缺省 6）。
- cooldown：同一条事件多少个月内不再出现（缺省用 EVENT_COOLDOWN_MONTHS = 6）。
- once: true：整局只出一次（默认不写 = 可重复）。
- cond：触发条件，写 true 表示随时都可能。常用写法：
  { stat:'totalIF', op:'>=', value:300 }（数值比较）、{ flag:'electionWindowOpen' }（某个开关）、
  { anyStudent:{ happinessBelow:40 } }（存在某类学生）、{ all:[...] } / { any:[...] } / { not:{...} }（组合）。
- tone：bad（倒霉） / absurd（荒诞） / system（体制） / good（好事），只影响显示颜色。
- text：事件文案。原则是**反差优先、不说教、具体到物件和数字**。
- effects：直接生效的效果列表（见下表）。
- choices（可选）：需要玩家做选择时写成
  choices: [ { id:'pay', label:'掏钱修', effects:[{ kind:'money', mode:'add', value:-2 }] },
             { id:'ignore', label:'当没看见', effects:[{ kind:'studentHappy', target:'all', value:-4 }] } ]
  —— 写了 choices 就不写 effects。

常用效果（kind）：

| kind | 写法示例 | 含义 |
|---|---|---|
| money / consumable / integrity / health / energy / ticket | { kind:'money', mode:'add', value:-5 } | 加减玩家的经费/耗材/诚信/健康/精力/推荐票 |
| selectStudent | { kind:'selectStudent', pick:'lowestHappy' } | 挑一名学生当「主角」，后面的 target:'ctx' 指他 |
| selectProject | { kind:'selectProject', pick:'randomActive' } | 挑一个在研项目当主角 |
| studentHappy / studentDegree / studentAbility | { kind:'studentHappy', target:'ctx', value:-8 } | 改指定学生（ctx / ctxStudents / all）的幸福度/毕业进度/天赋 |
| studentLeave | { kind:'studentLeave', target:'ctx', progressMul:0.4 } | 该学生离组，项目进度打折 |
| projectProgress | { kind:'projectProgress', target:'ctx', mode:'add', value:-10 } | 改项目进度 |
| projectPaperShift | { kind:'projectPaperShift', target:'ctx', value:-1 } | 结题论文整体降一档（被抢发） |
| instrumentDown | { kind:'instrumentDown', instrument:'hplc', months:1 } | 某仪器停机 |
| consumeMulNextMonth | { kind:'consumeMulNextMonth', value:1.2 } | 下个月耗材消耗 ×1.2（接待视察后浪费） |
| if | { kind:'if', cond:{ ctxStudent:{ happinessBelow:30 } }, then:[ ... ] } | 条件分支 |

加完之后跑 check.mjs（它会检查事件写法有没有用到未注册的 kind）+ simulate.mjs（机器人会把事件跑一遍）。

---

## 7. 其他常见改动

### 7.1 加/改一个结局

src/data/endings.js 的 ENDINGS 数组，**顺序就是优先级**（从上往下第一个条件成立的生效）：

    { id: 'fired', title: '被解聘', kind: 'bad',
      cond: { all: [ { stat:'integrity', op:'<=', value:10 }, { flag:'caughtRedHanded' } ] },
      text: '人事处的文件用的是标准模板，只有名字和日期是新的。' },

想按诚信高低给同一结局不同文案，就用 variants:[{ id, cond, text }]。

### 7.2 改学生工资档的效果

src/data/students.js：WAGE（每档每月给多少钱）、WAGE_HAPPY（每档每月涨/掉多少幸福）、
GAP_PENALTY（实际工资档低于学生期望档时的额外惩罚，期望档见 WAGE_EXPECT_THRESHOLDS）。

### 7.3 改界面上的文字/顺序

标签页顺序在 src/core/viewmodel.js 的 TABS；顶栏在 src/ui/hud.js；五个页面分别在 src/ui/views/ 下。
改按钮**行为**要动 src/ui/app.js 的 HANDLERS，并在 docs/CONTRACT.md §6.3 登记。

---

### 7.4 玩家引导：一作从哪来（改 UI 文案前必读）

**这条不是数值问题，是文案问题。** t24 之后晋升门槛只认「玩家本人的一作」（详见 `docs/GDD.md` §2.7/§2.8/§2.9），而机器人实测「从不亲带」的打法是 **0/16 通关、卡死在副研究员**。数值上这是设计意图，但如果不写清楚，新玩家会一直评不上职却不知道为什么——这是真实的 UX 悬崖。

**给玩家必须说清的三句话**：

1. 晋升看的是**你本人**的一作，不是全组论文数（全组论文只算总影响因子）。
2. 拿到一作只有三条路：**亲自带项目**（该项目论文一作全归你；代价：该项目推进 ×0.85、每月 +1 精力）／**抢学生的一作**（诚信 −8、该生幸福度 −30）／**买一作**（花钱、诚信 −4）。
3. **一条都不做，会永远停在副研究员。**

**建议的游戏内提示文案（供 t26 / t21 落 UI，均为玩家语言、不含内部常量名）**：

| 位置 | 建议文案 |
|---|---|
| 总览页「下个头衔」缺项附近（缺一作时） | 「缺的是**你自己署名的一作**。全组论文再多也不算——去项目卡片点『我亲自带』，或者用一作交易台。」 |
| 项目卡片「我亲自带」按钮 title | 「亲自带：这个项目的论文一作**全部归你**。代价：该项目推进 ×0.85、每月多 1 精力。」 |
| 学生卡片「抢他一作」确认条 | 「抢：这一篇的一作归你。代价：诚信 −8、他幸福度 −30、记恨 6 个月。」 |
| 一作交易台标题旁 | 「买一作：花钱买署名，诚信 −4，没有真实产出。越厉害越贵。」 |
| 首次进入项目页（一次性引导） | 「评职称看的是**你本人的一作**。要么亲自带项目，要么抢、要么买——一条都不做，你会一直停在副研究员。」 |
| 卡在 rank1 超过 24 个月时的顶栏提示 | 「你已经很久没有自己署名的一作了。试试『我亲自带』。」 |

**改这类文案的注意事项**：① 不要写内部变量名或常量名（一作台账的字段名、亲带的进度倍率、诚信增减的常量名之类）——玩家看不懂；② 三条途径的代价要与 `src/data/papers.js` / `src/data/hardpoints.js` 的实际数值一致，数值改了记得回来改文案；③ 「抢」的文案要明确它是应急手段（诚信 −8 / 幸福度 −30 不是小代价）。
---

## 8. 常见问题

**Q：我改了数值，浏览器里没变化？**
A：开发模式（server.mjs）刷新即可；单文件模式要重新跑 build-single.mjs。如果还没变，可能是浏览器缓存，Ctrl+F5 强刷。

**Q：为什么我的进度不动了？**
A：最常见是**耗材见底**（进度乘 0）或项目上没人。到「行动」页采购耗材，到「项目」页给学生分配项目。

**Q：check.mjs 报了一堆红字怎么办？**
A：每条红字都会写出文件名和原因，照它改即可。最常见三类：AData 表里少逗号/多逗号（语法错误）、
用了 index.html 里不存在的 id（DOM 契约）、写了没注册的 data-action（交互契约）。

**Q：check.mjs 里还会有「字库是种子规模」的黄字吗？**
A：现在没有了。字库已在 t28 扩到目标规模，check.mjs 第 9 项会直接读 `NAME_DATA_TARGET` 逐项比对，正常输出是「[ok] 字库规模达标」。如果你自己把某个数组删短了，它会重新变回警告——修法仍然只是往数组里加条目，不动逻辑。

**Q：改完存档会不会坏？**
A：不会崩。程序读档时缺字段补默认、坏值丢弃；但**旧存档不会自动获得新机制的好处**，
验证数值时建议点「重开一局」从头跑。

**Q：想加一个全新的机制（比如新的资源）怎么办？**
A：那不是改数值了：先改 docs/CONTRACT.md（状态字段 + action），再动 src/core/state.js 与 engine.js，
并在 **src/core/state.js** 里把 STATE_VERSION 加 1（它定义在这里，别去 save.js 改），
再去 src/core/save.js 的 MIGRATIONS 里补一条 vN→vN+1 的迁移，最后在 docs/CHANGELOG.md 的「契约变更记录」登记。
做完请主程复核。

---

## 9. 提交前的清单

1. node 评院士/scripts/check.mjs —— 0 错误（黄字警告可接受）
2. node 评院士/scripts/simulate.mjs —— 退出码 0，曲线没有明显异常（经费/IF/诚信）
3. node 评院士/scripts/ui-smoke.mjs —— 退出码 0
4. node 评院士/scripts/build-single.mjs —— 单文件能生成，双击能玩
5. 如果改了接口或存档结构：同步 docs/CONTRACT.md / docs/ARCHITECTURE.md / docs/CHANGELOG.md

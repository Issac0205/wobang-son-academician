# 《我帮儿子评院士》数值总表（BALANCE）

> 交付物：`docs/BALANCE.md` ｜ 任务：t2 ｜ 作者：策划师
> 配套：`docs/GDD.md`（设计说明）、`docs/SPEC.md`（硬性需求源）、`docs/RESEARCH.md`（真实制度与数值出处）
> 本表是 §数值 的唯一权威清单：实现期照此建 `src/data/*.js`，逻辑层只读数据、禁止硬编码。
> **来源标记**：`[SPEC]` = SPEC 硬性值，**不得改动**；`[研究]` = RESEARCH.md 有真实出处的量级锚点；`[策划]` = 策划推断值，可调。
> **单位约定**：金额 = 万元；影响因子 = IF 点；时间 = 月；比率 = 无量纲小数（0.40 = 40%）。
> **耗材资金**：与经费同为本位万元，「单位」是它的展示名，`CONSUMABLE_PRICE_PER_UNIT = 1` ⇒ **1 单位 = 1 万元**。

---

## 1. [SPEC] 硬性值清单（不可改动，共 44 项）

改动本清单任何一项 = 违反需求。如必须改动，须回到主理人处确认。

| # | 常量 | SPEC 硬性值 | 照表的落地位置 |
|---|---|---|---|
| 1 | 初始经费 | 200 万 | `INITIAL_MONEY` |
| 2 | 硕士招生名额上限（初始） | 4 | `RANKS[1].masterCap` |
| 3 | 博士招生名额上限（初始） | 1 | `RANKS[1].phdCap` |
| 4 | 硕士学制 | 3 年 = 36 月 | `MASTER_STUDY_MONTHS` |
| 5 | 博士学制 | 5 年 = 60 月 | `PHD_STUDY_MONTHS` |
| 6 | 仪器种类数 | 8 种 | `INSTRUMENTS` 长度 |
| 7 | 小幅加成仪器 | 离心机 / 摇床 / 超净台 / 水浴锅 | `INSTRUMENTS[].tier = "minor"` |
| 8 | 大幅加成仪器 | 液相 / 质谱 / 酶标仪 / 气相 | `INSTRUMENTS[].tier = "major"` |
| 9 | 初始持有·离心机 | 1 | `INSTRUMENTS.centrifuge.initCount` |
| 10 | 初始持有·摇床 | 1 | `INSTRUMENTS.shaker.initCount` |
| 11 | 初始持有·液相 | 1 | `INSTRUMENTS.hplc.initCount` |
| 12 | 初始持有·质谱 | 0 | `INSTRUMENTS.ms.initCount` |
| 13 | 初始持有·超净台 | 2 | `INSTRUMENTS.hood.initCount` |
| 14 | 初始持有·酶标仪 | 0 | `INSTRUMENTS.elisa.initCount` |
| 15 | 初始持有·气相 | 0 | `INSTRUMENTS.gc.initCount` |
| 16 | 初始持有·水浴锅 | 1 | `INSTRUMENTS.bath.initCount` |
| 17 | 耗材模式 1 | 随意挥霍：科研效率提高、幸福度下降变慢 | `CONSUME_MODES.free` |
| 18 | 耗材模式 2 | 正常消耗：效率不变、幸福度不变 | `CONSUME_MODES.normal` |
| 19 | 耗材模式 3 | 收紧裤腰：效率下降、幸福度下降加快 | `CONSUME_MODES.tight` |
| 20 | 头衔序列 | 副研究员 > 研究员 > 副教授 > 教授 | `RANKS[1..4].title` |
| 21 | 头衔上限梯度 | 院士 > 杰青/长江兼有 > 杰青/长江单有 > 万人/优青 > 其他教授 | `RANKS[5..8]` 顺序 |
| 22 | 初始头衔 | 副研究员 | `RANKS[1]` 为起始 |
| 23 | 初始一作·一区 | 1 篇 | `INITIAL_FIRST_Q1` |
| 24 | 初始一作·二区 | 0 | `INITIAL_FIRST_Q2` |
| 25 | 初始一作·三区 | 0 | `INITIAL_FIRST_Q3` |
| 26 | 初始一作·四区 | 0 | `INITIAL_FIRST_Q4` |
| 27 | 初始一作·正刊 | 0 | `INITIAL_FIRST_TOP` |
| 28 | 一作五档 | 一区 / 二区 / 三区 / 四区 / 正刊 | `TIERS` |
| 29 | 初始诚信 | 100 | `INITIAL_INTEGRITY` |
| 30 | 诚信归零后果 | 坏结局「被举报」 | `ENDINGS.reported` |
| 31 | 抢学生一作 | 大幅降低诚信 + 降低该生幸福度 | `GRAB_FIRST_INTEGRITY` / `GRAB_FIRST_HAPPY` |
| 32 | 购买一作 | 消耗经费 + 诚信减少（比抢一作少）+ 幸福度减少较少；越厉害的论文越贵 | `PAPER_BUY_PRICE` / `BUY_FIRST_INTEGRITY` |
| 33 | 诚信可提升 | 完成项目可提高诚信 | `INTEGRITY_DELTA.finishProject`（见 §15.1） |
| 34 | 精力 | 每月更新 | `ENERGY_CARRYOVER = 0` |
| 35 | 健康 | 影响精力上限 | `MAX_ENERGY_FROM_HEALTH` |
| 36 | 行动种类 | 4 种：与学生交流课题 / 开组会 / 锻炼与享乐 / 去团建 | `ACTIONS` |
| 37 | 学生名字 | 必须自然随机、不千篇一律 | `src/data/names.js` 全部字库 |
| 38 | 学生属性 | 在读年份、毕业进度（幸福度太低会降低） | `degreeProgress` / `enrollMonth` |
| 39 | 延毕 | 延长一年、大幅降低幸福度、不占用招生名额 | `DEFER_*` |
| 40 | 幸福度初始值 | 60 | `INITIAL_HAPPINESS` |
| 41 | 幸福度归零·转组 | 100% 触发：该生负责项目进度 −60% | `LEAVE_TRANSFER_PROGRESS_MUL = 0.40` |
| 42 | 幸福度归零·极端事件 | 0.5% 概率，玩家诚信 −50 | `LEAVE_EXTREME_RATE = 0.005` / `LEAVE_EXTREME_INTEGRITY = −50` |
| 43 | 工资档位 | 四档：高 / 中 / 低 / 无 | `WAGE_TIERS` |
| 44 | 人才市场 | 每年 6–12 月开放；6–10 月保研生（能力高、门槛高、可花钱招）；10–12 月考研生（均值低但有概率高能力）；天赋越高越需高工资；开局可见 | `MARKET_OPEN_MONTHS` / `POOL_*` / `REQ_IF_WEIGHT` |

### 1.1 SPEC 中「有意保留为方向性描述、由本表量化」的条目

SPEC 只写方向、未给数字，本表负责量化（因此这些是 `[策划]` 值）：

| SPEC 原文方向 | 本表量化 | 常量 |
|---|---|---|
| 耗材三模式的「效率提高 / 不变 / 下降」 | 1.15 / 1.00 / 0.85 | `CONSUME_MODES[*].progressMul`（见 §15.1） |
| 耗材三模式的「幸福度下降变慢 / 不变 / 加快」 | +3 / 0 / −5 | `CONSUME_MODES[*].happyDelta`（见 §15.1） |
| 抢一作「大幅降低诚信」 | −8 / 篇 | `GRAB_FIRST_INTEGRITY` |
| 购买一作「诚信减少较少」 | −4 / 篇 | `BUY_FIRST_INTEGRITY` |
| 造假「降低诚信、可能被举报」 | −10 / 次，被查概率见 §8 | `FAKE_INTEGRITY` |
| 多人攻坚「影响其他项目进度」 | 其他项目本月进度 −25% | `TEAM_OTHER_PROJECT_MUL` |
| 单人猛干「消耗更多财力」 | 5 万 / 次（对比多人攻坚 3 万） | `SOLO_MONEY` |
| 「越难的项目难点越多」 | 难点数 = 项目等级 T | `project.tier` |
| 「越高端的项目对仪器要求越高」 | 逐级加码 require（§5.4） | `project.require` |
| 「幸福度太低会降低毕业进度」 | 幸福度 < 30 时系数腰斩至 0.50 | `DEG_HAPPY_LOW` |
| 「延毕一年，大幅降低幸福度」 | −40（一次性）+ 此后每月 −1 | `DEFER_HAPPY` |
| 「越厉害的论文越贵」 | 四区 2 → 正刊 120 万 | `PAPER_BUY_PRICE` |

---

## 2. [研究] 真实世界锚点（用于校对，不进游戏逻辑）

| 量 | 现实值 | 来源强度 | 游戏中对应 |
|---|---|---|---|
| 副研究员 → 研究员年限 | 满 5 年 | [A] | 由 IF/项目门槛隐式控制 |
| 副教授 → 教授年限 | 满 5 年 | [A] | 同上 |
| 教授代表作要求（示例校） | 3 篇核心含 2 权威 或 1 项国家级项目 | [A] | `RANKS[4]` 门槛 |
| 青年基金 C 类 | 约 30 万；男 ≤35 / 女 ≤40 岁 | [A] | `N1` 总额 25 万 |
| 青年基金 B 类（原优青） | 约 200 万；男 ≤38 / 女 ≤40 | [A] | `N4` 总额 200 万 |
| 青年基金 A 类（原杰青） | 约 400 万；男 ≤45 / 女 ≤48 | [A] | `N5` 总额 400 万 |
| 面上项目 | 约 50 万 / 4 年 | [A] | `N2` 总额 50 万 |
| 重点项目 | 约 225 万 / 5 年 | [A] | `N3` 总额 225 万 |
| 国家重点研发计划 | 项目千万级、负责人 ≤60 岁 | [C] | `N6` 总额 800 万 |
| 长江特聘 | 每年约 150 名、聘期 5 年、奖金 20 万/年、自科 ≤45 岁 | [A] | `RANKS[6]` / `RANKS[7]` |
| 万人计划领军 | ≤45 岁 | [B] | `RANKS[5]` 黄金年龄 ≤43 |
| 院士增选 | 每两年一次、不受理个人申请、65 周岁需 2 名院士推荐；2025 当选 73 人、平均 57.2 岁、最小 44 岁 | [A] | `院士增选` 见 §3.4 |
| 一区 / 二区 / 三区 / 四区 IF | 8–10 / 4–8 / 2–5 / <2 | [C] | `JOURNAL_IF_BASE` 10 / 5.5 / 3.2 / 1.3 |
| 横向经费 | 5–200 万常见 | [C] | `E1`–`E4` 8 / 30 / 80 / 150 万 |
| 硕士月补助 | 0.05–0.3 万 | [C] | 硕士工资 0.30 / 0.15 / 0.05 / 0 |
| 博士月补助 | 0.2–0.6 万 | [C] | 博士工资 0.60 / 0.30 / 0.10 / 0 |
| 仪器单价 | 质谱 100–500 万；液相 20–80；气相 20–60；酶标仪 5–30；超净台 1–3；离心机 1–10；摇床 0.5–3；水浴锅 0.1–1 | [C] | `INSTRUMENTS[].price` |
| RESEARCH §5.1 建议 IF 阈值 | 7 级 0 / 30 / 80 / 180 / 320 / 600 / 1200 | — | 前 6 级沿用；第 7 级 950、第 8 级 1400（见 §3 备注） |
| RESEARCH 建议诚信扣减 | 抢一作 −8、造假被查 −25、购买一作 −4、攻坚挪用 −3 | — | 原样采用 |

---

## 3. `src/data/ranks.js` — 头衔阶梯

### 3.1 `RANKS`（8 级，索引 1–8）

| ID | 头衔 | 总 IF | 一区一作 | 二区一作 | 正刊一作 | 项目等级门槛 | 硕士上限 | 博士上限 | 学校年投资(万) | 可承接最高等级 | 同时承接上限 | 黄金年龄 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `RANKS[1]` | 副研究员 | 0 | 1 | 0 | 0 | 0 | 4 | 1 | 72 | 2 | 2 | — |
| `RANKS[2]` | 研究员 | 30 | 2 | 2 | 0 | 1 | 5 | 2 | 120 | 3 | 3 | ≤36 |
| `RANKS[3]` | 副教授 | 80 | 3 | 5 | 0 | 2 | 6 | 2 | 180 | 4 | 3 | ≤38 |
| `RANKS[4]` | 教授 | 180 | 5 | 10 | 0 | 3 | 8 | 3 | 240 | 5 | 4 | ≤41 |
| `RANKS[5]` | 优青 / 万人 | 320 | 7 | 16 | 0 | 4 | 9 | 3 | 320 | 6 | 4 | ≤43 |
| `RANKS[6]` | 杰青 / 长江（单有） | 600 | 9 | 24 | 1 | 5 | 10 | 4 | 420 | 6 | 5 | ≤47 |
| `RANKS[7]` | 杰青 + 长江（兼有） | 950 | 12 | 34 | 2 | 6 | 12 | 5 | 560 | 6 | 6 | ≤51 |
| `RANKS[8]` | 院士 | 1400 | 16 | 44 | 3 | 6（且 ≥2 个） | 15 | 6 | 760 | 6 | 6 | ≥45 |

| 字段 | 单位 | 含义 | 来源 |
|---|---|---|---|
| `ifReq` | IF | 晋升所需总影响因子（含学生一作论文） | [策划]，前 6 级取自 [研究] §5.1 |
| `q1Req` / `q2Req` / `topReq` | 篇 | 晋升所需**玩家为一作**的一区 / 二区 / 正刊论文数 | [策划] |
| `projTierReq` | 等级 | 需历史结题过的最高项目等级 | [策划]（对应 [研究]「国家级项目」硬门槛） |
| `projCountReq` | 个 | 仅院士级：需结题 T6 项目 ≥2 个 | [策划] |
| `masterCap` / `phdCap` | 人 | 在读硕士 / 博士名额上限（延毕生不占名额） | [SPEC]（初始 4 / 1），其余 [策划] |
| `schoolFundYear` | 万/年 | 学校年投资，按 /12 月度发放 | [策划] |
| `maxProjectTier` | 等级 | 可承接的最高项目等级 | [SPEC] 方向 + [策划] 数值 |
| `concurrentCap` | 个 | 同时承接的在研项目数上限 | [策划] |
| `goldenAge` | 岁 | 黄金年龄窗口，窗口内晋升给奖励（§3.3） | [策划] |

### 3.2 晋升相关常量

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `INTEGRITY_DELTA.promote` | +2 | 点 | 每次晋升的诚信奖励 | [策划]（旧文档名 `PROMOTE_INTEGRITY_BONUS` 是**死名**，见 §15.1） |
| `GOLDEN_AGE_MONEY_MUL` | 0.40 | × | 窗口内晋升时，按新等级年投资 ×0.4 发放一次性经费 | [策划] |
| ~~`GOLDEN_AGE_INTEGRITY_BONUS`~~ | — | — | ~~窗口内晋升的额外诚信~~：**已于 t28 从 `data/ranks.js` 移除**（core 零引用）；「黄金年龄」只剩下面的经费倍率在生效 | [策划]（t37 登记） |
| ~~`AGE_IF_MUL_60`~~ / ~~`AGE_IF_MUL_65`~~ | — | — | 原值 1.15 / 1.40（「60 / 65 岁后院士总 IF 门槛倍率」）：**t37 正式取消该设计、t28 已从 `data/ranks.js` 移除**（只在源码注释里留删除理由）。65 岁 = 第 384 月 = 退休月，×1.40 无生效窗口；×1.15 属「鞭打落后者」且无可对冲手段——裁定与替代设计见 §18.17 | [策划] |
| `MIN_ACADEMICIAN_AGE` | 45 | 岁 | 院士候选人最低年龄 | [研究]（2025 年最年轻当选者 44 岁） |
| `ELECTION_WINDOW_INTERVAL` | 24 | 月 | 院士增选窗口间隔 | [研究]（每两年一次） |
| `ELECTION_WINDOW_START` | 24 | 月 | 首个增选窗口的月份 | [策划] |
| `RECOMMEND_TICKET_REQ` | 3 | 张 | 院士所需推荐票 | [SPEC] 方向（不受理个人申请）+ [研究] |
| `TICKET_PER_T6` | +2 | 张 | 每结题 1 个 T6 项目的票数 | [策划] |
| `TICKET_PER_T5` | +1 | 张 | 每结题 1 个 T5 项目的票数 | [策划] |
| `TICKET_PER_PHD_GRADUATES` | 3 → +1 | 人 / 张 | 每培养 3 名博士毕业得 1 张 | [策划] |
| `TICKET_VISIT_COST` | 8 | 万 | 事件「院士来访」购买 1 张票 | [策划] |
| `START_AGE_YEARS` | 33 | 岁 | 玩家起始年龄 | [策划] |
| `RETIRE_AGE_YEARS` | 65 | 岁 | 退休年龄（第 384 个月） | [策划] |
| `RETIRE_MONTH` | 384 | 月 | 硬性一局上限 | [策划] |

> **偏离说明（必须留档）**：[研究] §5.1 给的是 7 级阈值 0/30/80/180/320/600/1200。SPEC 要求 8 级阶梯，故插入 950（杰青+长江兼有），并把院士阈值上调到 1400。前 6 级严格沿用 [研究] 值。

---

## 4. `src/data/instruments.js` — 仪器

| ID | 名称 | 档位 | 单台加成 | 初始持有 | 售价(万) | 月维护(万) | 门槛等级 | 持有上限 |
|---|---|---|---|---|---|---|---|---|
| `centrifuge` | 离心机 | minor | 0.06 | 1 | 8 | 0.08 | 1 | 3 |
| `shaker` | 摇床 | minor | 0.06 | 1 | 3 | 0.03 | 1 | 3 |
| `hplc` | 液相 | major | 0.15 | 1 | 45 | 0.50 | 2 | 3 |
| `ms` | 质谱 | major | 0.15 | 0 | 260 | 2.50 | 4 | 3 |
| `hood` | 超净台 | minor | 0.06 | 2 | 2.5 | 0.02 | 1 | 3 |
| `elisa` | 酶标仪 | major | 0.15 | 0 | 22 | 0.20 | 2 | 3 |
| `gc` | 气相 | major | 0.15 | 0 | 38 | 0.40 | 3 | 3 |
| `bath` | 水浴锅 | minor | 0.06 | 1 | 0.8 | 0.01 | 1 | 3 |

| 字段 | 单位 | 含义 | 来源 |
|---|---|---|---|
| `tier` | — | minor = 小幅加成，major = 大幅加成 | [SPEC] 硬性 |
| `bonus` | 无量纲 | 单台加成贡献，累加进仪器系数 | [策划]（幅度关系由 [SPEC] 定性） |
| `initCount` | 台 | 开局持有台数 | [SPEC] 硬性 |
| `price` | 万 | 第一台售价；第 n 台 = price × 1.6^(n−1) | [研究] 区间内取值 |
| `maintain` | 万/月 | 每月维护费 | [策划]（按售价 ~1%/月 标定） |
| `tierGate` | 等级 | 该仪器提供项目门槛判定用的最低等级 | [策划] |
| `holdCap` | 台 | 单种仪器持有上限 | [策划]（[SPEC] 超净台初始 2 台 ⇒ 允许重复持有） |

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `INST_PRICE_GROWTH` | 1.6 | × | 每多买一台的价格递增系数 | [策划] |
| `INST_HOLD_CAP` | 3 | 台 | 单种仪器持有上限 | [策划] |
| `INST_BONUS_CAP` | 0.90 | 无量纲 | 全仪器加成总和上限 | [策划] |
| `INST_COEF_BASE` | 1.00 | × | 仪器系数基准（无仪器时） | [策划] |
| `START_INST_BONUS` | 0.45 | 无量纲 | 开局持有量对应的加成（离心机 .06 + 摇床 .06 + 液相 .15 + 超净台 .12 + 水浴锅 .06） | [SPEC] 推导 |
| `TEMP_BROKEN_BONUS_MUL` | 0 | × | 停机事件期间该仪器贡献的倍率 | [策划] |

---

## 5. `src/data/projects.js` — 项目

### 5.1 `PROJECTS`（10 种模板）

| ID | 名称 | 类别 | T | W | 时限(月) | 总额(万) | 定金率 | 耗材/月(万) | 论文数 | 期望 IF | 一区期望 | 正刊期望 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `E1` | 小横向（检测外包） | 企业 | 1 | 80 | 4 | 8 | 0.40 | 0.8 | 1 | 2.44 | 0.00 | 0 |
| `E2` | 中横向（工艺优化） | 企业 | 1 | 170 | 8 | 30 | 0.40 | 2.0 | 2 | 6.16 | 0.00 | 0 |
| `E3` | 大横向（新产品开发） | 企业 | 2 | 380 | 12 | 80 | 0.40 | 5.0 | 3 | 8.60 | 0.00 | 0 |
| `E4` | 战略横向（联合实验室） | 企业 | 3 | 620 | 15 | 150 | 0.40 | 8.0 | 4 | 13.86 | 0.15 | 0 |
| `N1` | 国家·青年基金 C 类 | 国家 | 1 | 130 | 12 | 25 | 0.30 | 1.6 | 3 | 10.14 | 0.15 | 0 |
| `N2` | 国家·面上项目 | 国家 | 2 | 300 | 18 | 50 | 0.30 | 3.0 | 7 | 25.27 | 0.30 | 0 |
| `N3` | 国家·重点项目 | 国家 | 3 | 760 | 30 | 225 | 0.30 | 8.0 | 12 | 50.01 | 0.90 | 0.045 |
| `N4` | 国家·青年基金 B 类 | 国家 | 4 | 600 | 24 | 200 | 0.30 | 7.0 | 10 | 53.51 | 1.81 | 0.04 |
| `N5` | 国家·青年基金 A 类 | 国家 | 5 | 1100 | 36 | 400 | 0.30 | 12.0 | 14 | 75.13 | 2.64 | 0.06 |
| `N6` | 国家·国家重点研发计划 | 国家 | 6 | 2000 | 48 | 800 | 0.30 | 24.0 | 24 | 150.53 | 6.44 | 0.26 |

| 字段 | 单位 | 含义 | 来源 |
|---|---|---|---|
| `tier` | 等级 1–6 | 项目等级，同时决定难点数、可承接门槛、推荐票 | [策划]（等级概念源自 [研究] 的基金层级） |
| `workload W` | 进度点 | 结题所需累计进度点 | [策划] |
| `limitMonths` | 月 | 规定时限，超时进逾期 | [策划]（现实 4 年 → 12–48 月的压缩） |
| `money` | 万 | 项目总额；`国家 25/50/225/200/400/800` 对齐 [研究]「30/50/225/200/400/千万」 | [研究] 锚点 + [策划] 微调 |
| `depositRate` | 无量纲 | 承接即入账的定金比例；余款结题入账 | [策划]（SPEC 硬性：承接得定金、完成得尾款） |
| `consumablePerMonth` | 万/月 | 每月从耗材资金扣除 | [策划]（按总额 ~1.5–3%/月） |
| `papers` | — | 结题时的论文槽位序列（§6.2） | [策划] |
| `require` | — | 承接所需仪器与台数（§5.4） | [SPEC] 硬性方向 + [策划] 数值 |

### 5.2 项目市场与生成

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `PROJECT_SLOTS` | 7 | 个 | **项目** offer 的独立席位数（与人才市场互不挤占） | [策划] |
| `STUDENT_SLOTS` | 3 | 个 | **学生** offer 的独立席位数（只在招生季补充） | [策划] |
| `MARKET_SLOTS` | 10 | 个 | `PROJECT_SLOTS + STUDENT_SLOTS`，只作 **UI 展示口径**（「市场容量 N / 8」的分母），不再是被两池共用的席位上限 | [策划]（t13 修订，旧值 5 的旧语义见文末注） |
| `REFRESH_MONTHLY` | 2 | 个/月 | 每月新增的项目 offer 数（**全年每月都刷**，与招生季无关） | [策划]（t22 解耦） |
| `POOL_CAP` | 12 | 个 | 池子硬上限（防御性，任何路径都不得越界） | [策划] |
| `LOCKABLE_SLOTS` | 1 | 个 | 玩家可锁定的席位数（锁定后不被刷新淘汰） | [策划] |
| `PROJECT_OFFER_TTL_MONTHS` | 3 | 月 | 未被锁定的项目 offer 挂多久撤走 | [策划] |
| `STUDENT_OFFER_TTL_MONTHS` | 6 | 月 | 未被锁定的候选人挂多久撤走 | [策划] |
| `TIER_LOOKAHEAD` | 1 | 等级 | 可刷出「比当前可承接等级高 1 级」的项目（看得见接不了） | [策划] |
| `NATION_PROJECT_RATIO` | 0.60 | 概率 | 刷新时出的国家项目概率（其余为企业 0.40） | [策划] |
| `MIN_ACCEPTABLE_PROJECT_OFFERS` | 1 | 个 | 不变式：池子里始终至少有 1 个「当前头衔 + 当前仪器」真能承接的项目 offer | [策划]（防死锁） |
| `MIN_RECRUITABLE_STUDENT_OFFERS` | 1 | 个 | 不变式：招生季里至少挂 1 个「头衔 + IF」够得着的候选人 | [策划]（防死锁） |

**三条刷新规则（t22 + t13 口径）**

1. **项目市场全年刷新**：每月按 `REFRESH_MONTHLY` 补充到 `PROJECT_SLOTS`；第 0 月（开局）就补，因此不存在「标记开放但一个本子都没有」的月份。

> **滚动 12 个月供给下界（t40 定稿，绝对常量）**：任一连续 12 个月内「新增且当时可承接」的项目 offer ≥ **21**。推导见 §18.18 裁定 ①；旧写法 `nominal × 0.85`（与被测参数耦合）作废 —— `PROJECT_SLOTS` / TTL 变更时必须**显式复核本常量并留痕**。
2. **人才市场只在招生季补充**：投放月见 §9（保研 / 考研分池），非招生季池子保留但不补新人。
3. **项目 offer 的等级过滤（对平衡至关重要，别随手改）**：`createProjectOffer` 先用 `strict = 等级 ≤ 当前头衔 maxProjectTier 且 require 仪器全部已购` 生成候选，只有 strict 为空时才退化成 `maxTier = maxProjectTier + TIER_LOOKAHEAD`。**含义：T5/T6 本子只有在玩家已经买齐它的仪器之后才会出现在市场上**（lookahead 只放宽头衔、不放宽仪器）。这是 §18.3 要处理的「看不见目标」问题的根源，改它之前先读 §18。

> **旧口径作废（t13 / F6）**：`MARKET_SLOTS` 曾写作「5 = 市场同时展示的项目槽位（国家 3 + 企业 2）」，且项目与学生 offer 共用这一上限（旧实现里学生 offer 永不过期、挂满后项目 offer 永久停发，见 §17.1 第 7 条）。现行语义是「项目 5 + 学生 3，各自独立、各自 6 个月 TTL」，`MARKET_SLOTS` 只剩 UI 展示口径。照旧值把某个池子的席位调成 5 会直接复活那个死锁。

### 5.3 经费与耗材挂钩

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `DEPOSIT_TO_CONSUMABLE` | 0.40 | × | 承接项目时，定金 ×0.40 注入耗材资金 | [策划] |
| `TRANSFER_RATE` | 1.0 | 经费:耗材 | 经费 → 耗材资金划拨比率（无损耗） | [SPEC] 要求「专门资金池」 + [策划] |
| `CONSUMABLE_PRICE_PER_UNIT` | 1 | 万/单位 | 采购耗材的单价 ⇒ **1 单位 = 1 万元**（UI 在「耗材库」常驻标注，顶栏悬停显示） | [策划]（t8 修复：单位口径必须可查） |
| `UNDERDUE_TAIL_MUL` | 0.80 | × | 逾期结题的尾款倍率 | [策划] |
| `PER_HARDPOINT_TAIL_MUL` | 0.80 | × | 每个未解决难点的尾款倍率（连乘） | [策划] |
| `OVERDUE_GRACE_MONTHS` | 12 | 月 | 逾期超过此月数项目自动失败 | [策划] |
| `INTEGRITY_DELTA.overdue` | −1 | 点/月 | 逾期期间每月诚信 | [策划]（旧文档名 `OVERDUE_INTEGRITY_PER_MONTH` 是**死名**，见 §15.1） |
| `OVERDUE_STUDENT_HAPPY` | −2 | 点/月 | 逾期期间该项目学生每月幸福度 | [策划] |
| `PROJECT_FAIL_INTEGRITY` | −5 | 点 | 项目失败（逾期 >12 月）一次性诚信 | [策划] |
| `PROJECT_FAIL_STUDENT_HAPPY` | −10 | 点 | 项目失败时该项目学生幸福度 | [策划] |

### 5.4 项目承接仪器门槛（`require`）

| 项目 | 离心机 | 摇床 | 液相 | 质谱 | 超净台 | 酶标仪 | 气相 | 水浴锅 |
|---|---|---|---|---|---|---|---|---|
| E1 | 1 | — | — | — | — | — | — | — |
| E2 | 1 | 1 | — | — | — | — | — | — |
| E3 | 1 | 1 | 1 | — | 1 | — | — | — |
| E4 | 1 | 1 | 1 | — | 1 | 1 | — | — |
| N1 | 1 | 1 | — | — | 1 | — | — | — |
| N2 | 1 | 1 | 1 | — | 1 | — | — | — |
| N3 | 1 | 1 | 1 | — | 1 | 1 | 1 | — |
| N4 | 1 | 1 | 2 | — | 1 | 1 | 1 | — |
| N5 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | — |
| N6 | 1 | 1 | 2 | 1 | 1 | 2 | 1 | — |

来源：[SPEC] 硬性（「越高端的项目要求越高」）+ [策划] 具体台数。水浴锅不入任何门槛（开局即持有，纯加成件）。

---

## 6. `src/data/papers.js` — 论文与期刊

### 6.1 `JOURNAL_IF_BASE`

| ID | 档位 | 基准 IF | 实际 IF 公式 | 来源 |
|---|---|---|---|---|
| `top` | 正刊 | 45.0 | 45.0 × U(0.85, 1.15) | [策划]（[研究] 无正刊数值，按 CNS 量级） |
| `q1` | 一区 | 10.0 | 10.0 × U(0.85, 1.15) | [研究]（8–10 区间上沿） |
| `q2` | 二区 | 5.5 | 5.5 × U(0.85, 1.15) | [研究]（4–8 区间中值） |
| `q3` | 三区 | 3.2 | 3.2 × U(0.85, 1.15) | [研究]（2–5 区间中值） |
| `q4` | 四区 | 1.3 | 1.3 × U(0.85, 1.15) | [研究]（<2） |

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `IF_RANDOM_LOW` / `IF_RANDOM_HIGH` | 0.85 / 1.15 | × | 每篇论文的 IF 随机浮动区间 | [策划] |
| `IF_ROUND_DECIMALS` | 1 | 位 | IF 保留小数位 | [策划] |

### 6.2 `PAPER_PATTERNS` — 论文槽位模板

| ID | 名称 | 一区 | 二区 | 三区 | 四区 | 正刊 | 期望 IF |
|---|---|---|---|---|---|---|---|
| `PA` | 冲天刊 | 0.34 | 0.45 | 0.20 | 0 | 0.01 | 6.97 |
| `PB` | 主力刊 | 0.15 | 0.45 | 0.40 | 0 | 0 | 5.26 |
| `PC` | 稳健刊 | 0 | 0.35 | 0.50 | 0.15 | 0 | 3.72 |
| `PD` | 凑数刊 | 0 | 0 | 0.60 | 0.40 | 0 | 2.44 |
| `PE` | 登顶刊 | 0.38 | 0.40 | 0.20 | 0 | 0.02 | 7.54 |

来源：[策划]。项目 → 槽位序列：

| 项目 | 序列 | 期望总 IF |
|---|---|---|
| E1 | [PD] | 2.44 |
| E2 | [PC, PD] | 6.16 |
| E3 | [PC, PD, PD] | 8.60 |
| E4 | [PB, PC, PD, PD] | 13.86 |
| N1 | [PB, PD, PD] | 10.14 |
| N2 | [PB, PB, PC, PC, PD, PD, PD] | 25.27 |
| N3 | [PB×6, PC×3, PD×3] | 50.01 |
| N4 | [PA×4, PB×3, PC×2, PD×1] | 53.51 |
| N5 | [PA×6, PB×4, PC×2, PD×2] | 75.13 |
| N6 | [PE×10, PA×6, PB×4, PC×2, PD×2] | 150.53 |

### 6.3 购买一作

| ID | 档位 | 价格(万) | 诚信 | 来源 |
|---|---|---|---|---|
| `PAPER_BUY_PRICE.q4` | 四区 | 2 | −4 | [策划] 数值 + [SPEC] 硬性「越厉害越贵」 |
| `PAPER_BUY_PRICE.q3` | 三区 | 5 | −4 | 同上 |
| `PAPER_BUY_PRICE.q2` | 二区 | 12 | −4 | 同上 |
| `PAPER_BUY_PRICE.q1` | 一区 | 25 | −4 | 同上 |
| `PAPER_BUY_PRICE.top` | 正刊 | 120 | −4 | 同上 |

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `BUY_FIRST_INTEGRITY` | −4 | 点/篇 | 购买一作的诚信代价 | [研究] 建议值 |
| `GRAB_FIRST_INTEGRITY` | −8 | 点/篇 | 抢学生一作的诚信代价 | [研究] 建议值 |
| `GRAB_FIRST_HAPPY` | −30 | 点 | 被抢一作学生的一次性幸福度 | [策划] |
| `GRAB_GRUDGE_MONTHS` | 6 | 月 | 被抢一作后的「心结」时长 | [策划] |
| `GRUDGE_HAPPY_PER_MONTH` | −2 | 点/月 | 心结期间每月幸福度 | [策划] |

---

## 7. `src/data/hardpoints.js` / 进度模型 — 难点与进度

### 7.1 进度

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `BASE_PROGRESS` | 6.0 | 点/月 | 学生月度基准进度 | [策划] |
| `ABILITY_DIVISOR` | 0.5 | — | ability 归一化除数（0.5 → 系数 1.0） | [策划] |
| `HAPPY_COEF_BASE` | 0.6 | — | 幸福度系数常数项 | [策划] |
| `HAPPY_COEF_SLOPE` | 0.004 | /点 | 幸福度系数斜率（幸福 100 → 1.00） | [策划] |
| `CONSUME_MODES[*].progressMul` | 1.15 / 1.00 / 0.85 | × | 挥霍 / 正常 / 收紧 的科研效率 | [策划]（[SPEC] 硬性方向） |
| `MAX_PROJECTS_PER_STUDENT` | 3 | 个 | 单名学生最多同时负责的项目数 | [策划] |
| `PROJECT_MAX_STUDENTS` | 6 | 个 | **单个在研项目的人数上限**；目前**只被「一键分配」读取**（`core/engine.js` 的 `autoAssignPlan` / 应用分支 / `selectors.projectCap`），手工分配 `reduceAssign` 不受限（裁定见 §18.16） | [策划]（t25 新增，t32 登记；契约侧见 `docs/CONTRACT.md` §1.6 第 131–133 行与 `docs/CHANGELOG.md` 第 107 行） |

> **产出分配口径（与 GDD §5.3 的差距，t32 登记）**：GDD §5.3 规定学生产出按其项目数**均分**（产出守恒），当前实现按（学生 × 项目）对数**各给全额**。这是 §18.16 裁定 2 的待修项，改完必须重测全部通关率；**在修好之前，本表所有通关率读数都建立在「人均 3 项目 = 3 倍产出」之上**。
| `PLAYER_LEAD_MUL` | 0.85 | × | 玩家亲自当负责人的项目进度倍率 | [策划] |
| `PLAYER_LEAD_ENERGY_COST` | 1 | 点/月 | 玩家每个亲带项目每月额外精力 | [策划] |
| `ZERO_CONSUMABLE_PROGRESS_MUL` | 0 | × | 耗材资金为 0 时的项目进度倍率 | [策划]（SPEC 要求「专门资金池」的推论） |
| `PROGRESS_PCT_DENOM_MUL` | 1 + 0.10 × K | × | 进度条分母放大（K = 难点数） | [策划] |

### 7.2 难点

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `hardpointCount(tier)`（函数） | K = tier | 个 | 难点数量 = 项目等级（T1→1 … T6→6）；分布见 `HARDPOINT_HD_DIST` | [SPEC] 硬性方向 |
| `HARDPOINT_APPEAR_RULE` | W × i / (K+1) | 进度点 | 第 i 个难点的出现进度 | [策划] |
| `HARDPOINT_HD_DIST` | T1→[1]；T2→[1×0.6, 2×0.4]；T3→[2×0.7, 3×0.3]；T4→[2×0.4, 3×0.6]；T5→[3]；T6→[3] | — | 难点难度 hd 分布 | [策划] |
| `HARDPOINT_PROGRESS_PENALTY` | 1 − 0.25 × hd | × | 未解决难点对项目进度的乘子（取最重的一个，不叠加） | [策划] |

### 7.3 三种难点处理方式

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| **多人攻坚** | | | | |
| `TEAM_MIN_STUDENTS` | 2 | 人 | 最少参与人数 | [策划] |
| `TEAM_MONTHS` | 1 | 月 | 耗时 | [策划] |
| `TEAM_MONEY` | 3 | 万 | 经费 | [策划] |
| `TEAM_OTHER_PROJECT_MUL` | −25% | 进度 | 其他项目本月进度扣减 | [SPEC] 硬性「影响其他项目进度」 |
| `TEAM_STUDENT_HAPPY` | −2 | 点/人 | 参与学生幸福度 | [策划] |
| `TEAM_SUCCESS_BASE` | 0.45 | 概率 | 成功率常数项 | [策划] |
| `TEAM_SUCCESS_PER_STUDENT` | 0.12 | /人 | 每名参与学生的成功率增量 | [策划] |
| `TEAM_SUCCESS_ABILITY_COEF` | 0.40 | × | 平均能力对成功率的影响（基准 0.6） | [策划] |
| `TEAM_SUCCESS_CLAMP` | [0.10, 0.95] | 概率 | 成功率上下限 | [策划] |
| **造假蒙混** | | | | |
| `FAKE_MONEY` | 1 | 万 | 经费 | [策划] |
| `FAKE_INTEGRITY` | −10 | 点/次 | 每次造假的诚信代价 | [SPEC] 硬性「降低诚信」+ [策划] 数值 |
| `FAKE_STUDENT_HAPPY` | −5 | 点 | 涉及学生幸福度 | [策划] |
| `FAKE_CATCH_BASE` | 0.10 | 概率 | 被查基础概率 | [策划] |
| `FAKE_CATCH_PER_PROJECT` | 0.04 | /次 | 本项目累计造假次数增量 | [策划] |
| `FAKE_CATCH_GLOBAL` | 0.02 | /次 | 全局累计造假次数增量 | [策划] |
| `FAKE_CATCH_CAP` | 0.60 | 概率 | 被查概率上限 | [策划] |
| `FAKE_CAUGHT_INTEGRITY` | −25 | 点 | 被查后的额外诚信 | [研究] 建议值 |
| `FAKE_CAUGHT_PROGRESS_MUL` | −30% | 进度 | 被查后该项目进度扣减 | [策划] |
| `AUDIT_TRIGGER_FAKE_COUNT` | 3 | 次 | 全局造假达到此次数后开启举报审查 | [策划] |
| `AUDIT_MONTHLY_CHANCE` | 0.15 | 概率/月 | 举报审查月度触发概率 | [策划] |
| `AUDIT_INTEGRITY` | −15 | 点 | 举报审查的诚信 | [研究] 建议值 |
| `AUDIT_PROJECT_MUL` | −20% | 进度 | 举报审查随机命中一个在研项目 | [策划] |
| `CAUGHT_BAD_ENDING_INTEGRITY` | ≤25 | 点 | 被查时诚信低于此值 → 直接坏结局 | [策划] |
| **单人猛干** | | | | |
| `SOLO_MONEY` | 5 | 万 | 经费（SPEC：消耗更多财力） | [SPEC] 方向 + [策划] 数值 |
| `SOLO_STUDENT_HAPPY` | −20 | 点 | 该生幸福度 | [策划] |
| `SOLO_SUCCESS_ABILITY_COEF` | 0.90 | × | ability 系数 | [策划] |
| `SOLO_SUCCESS_BASE` | −0.11 | — | 成功率常数项 | [策划] |
| `SOLO_SUCCESS_CLAMP` | [0.05, 0.80] | 概率 | 成功率上下限 | [策划] |
| `SOLO_FAIL_HAPPY` | −10 | 点 | 失败时该生再扣幸福度 | [策划] |
| **通用** | | | | |
| `RETRY_SUCCESS_BONUS` | +0.10 | 概率/次 | 失败后重试的成功率加成 | [策划] |
| `RETRY_BONUS_CAP` | +0.30 | 概率 | 重试加成累计上限 | [策划] |
| `HARDPOINT_PAPER_DOWNGRADE` | 1 | 档 | 结题时每个未解决难点使论文整体降档 | [策划] |

---

## 8. `src/data/students.js` — 学生

### 8.1 初始与范围

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `INITIAL_HAPPINESS` | 60 | 点 | 学生入学幸福度 | [SPEC] 硬性 |
| `HAPPINESS_MIN` / `HAPPINESS_MAX` | 0 / 100 | 点 | 幸福度范围 | [策划] |
| `DEGREE_PROGRESS_MAX` | 100 | 点 | 毕业进度满值 | [SPEC] |
| `MASTER_STUDY_MONTHS` | 36 | 月 | 硕士学制 | [SPEC] 硬性 |
| `PHD_STUDY_MONTHS` | 60 | 月 | 博士学制 | [SPEC] 硬性 |
| `MASTER_GRAD_PAPER` | 三区 / IF 3.2 | 篇 | 硕士毕业产出 | [策划] |
| `PHD_GRAD_PAPER` | 二区 / IF 5.5 | 篇 | 博士毕业产出 | [策划] |
| `INTEGRITY_DELTA.graduate` | +3 | 点 | 学生毕业的诚信奖励 | [策划]（旧文档名 `GRAD_INTEGRITY_BONUS` 是**死名**，见 §15.1） |

### 8.2 能力分布

| ID | 生源 | 分布 | 区间 | 来源 |
|---|---|---|---|---|
| `ABILITY_TRANSLATE_MEAN_SD` | 保研生 | N(0.75, 0.08) | [0.60, 0.95] | [策划]（[研究]：保研生整体质量更高 [C]） |
| `ABILITY_EXAM_MEAN_SD` | 考研生·主群 90% | N(0.53, 0.10) | [0.30, 0.80] | [策划]（[SPEC]：均值低） |
| `ABILITY_DARKHORSE_MEAN_SD` | 考研生·黑马 10% | N(0.85, 0.05) | [0.70, 0.95] | [策划]（[SPEC]：有概率高能力） |
| `ABILITY_MIN` / `ABILITY_MAX` | — | — | 0.30 / 0.95 | [策划] |

### 8.3 幸福度每月变化

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `WAGE_HAPPY.high` | +5 | 点/月 | 高工资 | [SPEC] 硬性方向（高 → 幸福不降） |
| `WAGE_HAPPY.mid` | 0 | 点/月 | 中工资（SPEC：不变动） | [SPEC] 硬性 |
| `WAGE_HAPPY.low` | −4 | 点/月 | 低工资 | [策划] |
| `WAGE_HAPPY.none` | −12 | 点/月 | 无工资 | [策划] |
| `WAGE_INDEX` | 高 3 / 中 2 / 低 1 / 无 0 | — | 档位序号 | [策划] |
| `GAP_PENALTY` | 5 | 点/档 | 每低于期望工资一档的幸福度惩罚 | [策划] |
| `WAGE_EXPECT_THRESHOLDS` | ability ≥0.80→高；0.55–0.79→中；<0.55→低 | — | 期望工资档 | [SPEC] 硬性「天赋越高越需高工资」 |
| `CONSUME_MODES[*].happyDelta` | +3 / 0 / −5 | 点/月 | 挥霍 / 正常 / 收紧 | [策划]（SPEC 硬性方向） |
| `PROJECT_STRESS_HARDPOINT` | −3 | 点/月 | 有未解决难点 | [策划] |
| `PROJECT_STRESS_IDLE` | −3 | 点/月 | 学生当前无负责任何项目 | [策划] |
| `MULTI_PROJECT_HAPPY_PENALTY` | 1 | 点/月 | **t42 B 方案**：在研项目数 n ≥ 1 时每月额外 **−(n−1) × 本值**（n=1 → 0 / n=2 → −1 / n=3 → −2） | [策划]（t43 登记；实现：`core/formulas.js:216-217`，由 `engine.projectLoadByStudent` 喂入） |
| `HAPPY_REGRESSION_THRESHOLD` | 80 | 点 | 幸福度高于此值开始回归 | [策划] |
| `HAPPY_REGRESSION_SLOPE` | 0.05 | × | 超出部分的每月衰减系数 | [策划] |
| `HAPPY_ACTION_TALK` | +4 | 点 | 行动「交流课题」 | [策划] |
| `HAPPY_ACTION_MEETING` | +2 | 点 | 行动「开组会」（全体） | [策划] |
| `HAPPY_ACTION_TEAMBUILD` | +8 | 点 | 行动「去团建」（全体） | [策划] |
| `HAPPY_PROJECT_FINISH` | +5 | 点 | 项目结题庆祝（参与学生） | [策划] |
| `HAPPY_LEAD_BONUS` | +2 | 点/月 | 学生当项目负责人（一作归自己） | [策划] |
| `HAPPY_BREAKDOWN_DROP` | ≥25 | 点/月 | 当月下降达到此值触发「情绪崩溃」加餐事件 | [策划] |
| `HAPPY_BREAKDOWN_TALK_COST` | 2 精力 / +15 幸福 | — | 谈话机会 | [策划] |

### 8.4 离组与极端事件

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `LEAVE_TRIGGER_HAPPINESS` | 0 | 点 | 幸福度归零立即离组（不掷骰） | [SPEC] 硬性 |
| `LEAVE_TRANSFER_RATE` | 0.995 | 概率 | 转组（其余 0.005 = 极端事件） | [SPEC] 硬性 |
| `LEAVE_TRANSFER_PROGRESS_MUL` | 0.40 | × | 转组时该生负责项目进度保留比例（即 −60%） | [SPEC] 硬性 |
| `LEAVE_EXTREME_RATE` | 0.005 | 概率 | 极端事件（自杀）概率 | [SPEC] 硬性 |
| `LEAVE_EXTREME_INTEGRITY` | −50 | 点 | 极端事件对玩家诚信 | [SPEC] 硬性 |
| `LEAVE_EXTREME_PROGRESS_MUL` | 0 | × | 极端事件时长项目进度归零 | [策划] |
| `POACH_PROGRESS_MUL` | 0.40 | × | 事件「被挖角」时项目进度保留比例 | [策划] |
| `LAB_EMPTY_THRESHOLD` | 3 | 人/月 | 单月离组达到此数 → 结局「实验室空了」 | [策划] |

### 8.5 毕业与延毕

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `DEGREE_BASE` | 4.0 | 点/月 | 毕业进度基准 | [策划] |
| `DEG_HAPPY_COEF_BASE` | 0.6 | — | 毕业进度幸福度系数常数项 | [策划] |
| `DEG_HAPPY_COEF_SLOPE` | 0.004 | /点 | 幸福度系数斜率 | [策划] |
| `DEG_HAPPY_LOW` | 0.50 | × | 幸福度 < 30 时的系数（腰斩，SPEC：幸福度太低会降低） | [SPEC] 方向 + [策划] 数值 |
| `DEG_HAPPY_LOW_THRESHOLD` | 30 | 点 | 上一条的触发阈值 | [策划] |
| `DEG_PROJECT_FACTOR` | 1.0 / 0.3 | × | 有负责任何项目 / 无项目 | [策划] |
| `DEFER_HAPPY` | −40 | 点 | 延毕一次性幸福度（SPEC：大幅降低） | [SPEC] 方向 + [策划] 数值 |
| `DEFER_HAPPY_PER_MONTH` | −1 | 点/月 | 延毕后每月持续 | [策划] |
| `DEFER_MONTHS_SUBTRACT` | 12 | 月 | 延毕一年（在读月数回退） | [SPEC] 硬性 |
| `DEFER_QUOTA_MASTER` | 2 | 次 | 硕士延毕上限 | [策划] |
| `DEFER_QUOTA_PHD` | 3 | 次 | 博士延毕上限 | [策划] |
| `DEFER_FREE_QUOTA` | true | — | 延毕生不占招生名额（SPEC 硬性） | [SPEC] |
| `GIVEUP_PROGRESS_MUL` | 0.40 | × | 肄业时项目进度保留比例 | [策划] |
| `GIVEUP_INTEGRITY` | −2 | 点 | 肄业诚信 | [策划] |

### 8.6 工资

| ID | 学位 | 高 | 中 | 低 | 无 | 来源 |
|---|---|---|---|---|---|---|
| `WAGE.master` | 硕士 | 0.30 | 0.15 | 0.05 | 0 | [研究]（0.05–0.3 万）+ [SPEC] 四档 |
| `WAGE.phd` | 博士 | 0.60 | 0.30 | 0.10 | 0 | [研究]（0.2–0.6 万）+ [SPEC] 四档 |

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `NO_WAGE_MONTHS_THRESHOLD` | 3 | 月 | 连续无工资达到此月数开始惩罚 | [策划] |
| `NO_WAGE_INTEGRITY` | −2 | 点/月 | 无工资惩罚（诚信） | [策划] |

---

## 9. `src/data/market.js` — 人才市场

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `MARKET_OPEN_MONTHS` | [6,7,8,9,10,11,12] | 月 | 每年开放月份（SPEC 硬性） | [SPEC] 硬性 |
| `MARKET_OPEN_FIRST_MONTH` | true | — | 第 1 个月也开放（SPEC：开局可见） | [SPEC] 硬性 |
| `POOL_CAP` | 12 | 人 | 池容量，每月补满 | [策划] |
| `POOL_TRANSLATE_MONTHS` | 6,7,8,9,10 | 月 | 保研生窗口 | [SPEC] 硬性（6–10 月） |
| `POOL_EXAM_MONTHS` | 10,11,12 | 月 | 考研生窗口 | [SPEC] 硬性（10–12 月） |
| `RECRUIT_COST_BASE_TRANSLATE` | 3 | 万 | 保研生招募基础成本 | [策划] |
| `RECRUIT_COST_ABILITY_TRANSLATE` | 8 | 万/能力点 | 保研生招募成本 = 3 + ability × 8 | [策划] |
| `RECRUIT_COST_BASE_EXAM` | 1 | 万 | 考研生招募基础成本 | [策划] |
| `RECRUIT_COST_ABILITY_EXAM` | 4 | 万/能力点 | 考研生招募成本 = 1 + ability × 4 | [策划] |
| `REQ_IF_WEIGHT_TRANSLATE` | 200 | — | 保研生 IF 门槛权重 | [策划] |
| `REQ_IF_WEIGHT_EXAM` | 140 | — | 考研生 IF 门槛权重 | [策划] |
| `REQ_IF_FORMULA` | max(0, round((ability − 0.5) × W)) | — | 头衔/IF 门槛公式 | [SPEC] 方向（需更多头衔与 IF） |
| `REQ_RANK_FORMULA` | min(6, 1 + floor(reqIF / 40)) | — | 头衔等级门槛 | [策划] |
| `REQ_RANK_CAP` | 6 | 级 | 头衔门槛上限 | [策划] |

---

## 10. `src/data/actions.js` — 行动

| ID | 行动 | 精力 | 经费(万) | 效果 | 每月限次 | 来源 |
|---|---|---|---|---|---|---|
| `talk` | 与学生交流课题 | 2 | 0 | 指定学生 + 其 1 个项目 +8 进度；该生 +4 幸福、+2 毕业进度 | 每名学生 2 次 | [SPEC] 硬性（行动种类）+ [策划] 数值 |
| `meeting` | 开组会 | 4 | 0.5 | 全体学生负责的所有项目各 +3 进度；全体 +2 幸福 | 不限次，同月第 2 次 ×0.5、第 3 次 ×0.25、第 4 次起无效 | 同上 |
| `exercise` | 锻炼与享乐 | 3 | 2 | 健康 +8（≥90 时 +3） | 不限次 | 同上 |
| `teambuild` | 去团建 | 5 | 1.0 × 在读学生数 | 全体 +8 幸福 | 1 次/月 | 同上 |

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `TALK_PROJECT_PROGRESS` | +8 | 点 | 交流课题的项目进度 | [策划] |
| `MEETING_PROJECT_PROGRESS` | +3 | 点 | 组会的每项目进度 | [策划] |
| `MEETING_CREW_MUL` | [1, 0.5, 0.25, 0, …] | × | 同月第 n 次组会的效果系数 | [策划] |
| `EXERCISE_HEALTH` | +8 / +3 | 点 | 锻炼的健康（边际递减分界 90） | [策划] |
| `TEAMBUILD_COST_PER_STUDENT` | 1.0 | 万/人 | 团建经费按在读人数计 | [策划] |
| `TALK_PER_STUDENT_PER_MONTH` | 2 | 次/生/月 | 交流课题的每生每月上限（实现于 `src/core/engine.js`，UI 从 `vm.consts.limits` 读同一数字） | [SPEC] 硬性（行动种类）+ [策划] 数值 |

---

## 11. `src/data/tuning.js` — 全局常量

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `INITIAL_MONEY` | 200 | 万 | 初始经费 | [SPEC] 硬性 |
| `INITIAL_CONSUMABLE` | 40 | 万 | 初始耗材资金（1 单位 = 1 万元，见 `CONSUMABLE_PRICE_PER_UNIT`） | [策划] |
| `INITIAL_INTEGRITY` | 100 | 点 | 初始诚信 | [SPEC] 硬性 |
| `INITIAL_HEALTH` | 80 | 点 | 初始健康 | [策划] |
| `INITIAL_TOTAL_IF` | 10 | IF | 初始总影响因子（= 开局那篇一区一作） | [策划] |
| `INITIAL_FIRST_Q1/Q2/Q3/Q4/TOP` | 1 / 0 / 0 / 0 / 0 | 篇 | 初始一作计数 | [SPEC] 硬性 |
| `HEALTH_MAX` | 100 | 点 | 健康上限 | [策划] |
| `HEALTH_DECAY_PER_MONTH` | 1 | 点/月 | 健康自然消耗 | [策划] |
| `ENERGY_MAX_FORMULA` | 2 + floor(health / 10) | 点 | 精力上限公式 | [策划]（[SPEC]：健康影响精力上限） |
| `ENERGY_LOW_HEALTH_THRESHOLD` | 30 | 点 | 健康低于此值精力腰斩 | [策划] |
| `ENERGY_LOW_HEALTH_MUL` | 0.5 | × | 腰斩系数 | [策划] |
| `ENERGY_CARRYOVER` | 0 | 点 | 剩余精力不结转 | [SPEC] 硬性「每月更新」 |
| `START_AGE_YEARS` | 33 | 岁 | 起始年龄 | [策划] |
| `RETIRE_MONTH` | 384 | 月 | 65 岁对应的月数（一局硬上限） | [策划] |
| `MONTHS_PER_YEAR` | 12 | 月 | 年龄换算 | — |
| `RANDOM_EVENTS_PER_MONTH_MIN/MAX` | 1 / 2 | 条 | 每月随机事件条数 | [策划] |
| `BANKRUPT_NEGATIVE_MONTHS` | 6 | 月 | 经费持续为负达到此月数 → 解散结局 | [策划] |
| `SAVE_SLOT_KEY` | `wobang_son_academician_save` | — | localStorage 存档键 | [策划] |
| `AUTOSAVE_ON_MONTH_END` | true | — | 每月末自动存档 | [策划] |
| `MAX_MONTHS` | 384 | 月 | 同上（退休月） | [策划] |

### 11.1 诚信变化总表（集中登记，便于调参）

| ID | 行为 | 变化 | 来源 |
|---|---|---|---|
| 代码里的真实名字（生效） | 场景 | 变化 | 来源 |
|---|---|---|---|
| `INTEGRITY_DELTA.grabFirst` | 抢学生一作 | −8 / 篇 | [研究] |
| `INTEGRITY_DELTA.buyFirst` | 购买一作 | −4 / 篇 | [研究] |
| `FAKE_INTEGRITY`（`data/hardpoints.js`） | 造假蒙混 | −10 / 次 | [SPEC] + [策划] |
| `FAKE_CAUGHT_INTEGRITY`（`data/hardpoints.js`） | 造假被查 | −25 | [研究] |
| `INTEGRITY_DELTA.divert` | 多人攻坚挪用其他项目 | −3 | [研究]（**当前引擎未引用，见 §15.1 空转常量**） |
| `INTEGRITY_DELTA.audit` | 举报审查 | −15 | [研究] |
| `LEAVE_EXTREME_INTEGRITY`（`data/students.js`） | 学生极端事件 | −50 | [SPEC] 硬性 |
| `INTEGRITY_DELTA.finishProject` | 按期结题 | +2 | [SPEC] 硬性（完成项目可提高） |
| `INTEGRITY_DELTA.finishEnterprise` | 横向按期交付 | +1 | [策划] |
| `INTEGRITY_DELTA.graduate` | 学生顺利毕业 | +3 | [策划] |
| `INTEGRITY_DELTA.promote` | 晋升 | +2 | [策划] |
| `INTEGRITY_DELTA.noWage` | 无工资 ≥3 个月 | −2 / 月 | [策划] |
| `INTEGRITY_DELTA.overdue` | 项目逾期 | −1 / 月 | [策划] |
| `INTEGRITY_DELTA.projectFail` | 项目逾期失败 | −5 | [策划] |
| `INTEGRITY_DELTA.giveUpStudent` | 学生肄业 | −2 | [策划] |

> **t13 修正（F9）**：本表原来用的是 `INTEGRITY_*` 这种「扁平名」，它在代码里**不存在**（玩家照名字改会找不到）。上表已换成引擎真正读的名字。注意有两套同名同值的副本：`data/papers.js` 的 `GRAB_FIRST_INTEGRITY` / `BUY_FIRST_INTEGRITY`、`data/hardpoints.js` 的 `AUDIT_INTEGRITY`、`data/students.js` 的 `GRAD_INTEGRITY_BONUS` / `NO_WAGE_INTEGRITY` / `GIVEUP_INTEGRITY`、`data/ranks.js` 的 `PROMOTE_INTEGRITY_BONUS`（仍存在，但引擎只 import 不读）、`data/projects.js` 的 `OVERDUE_INTEGRITY_PER_MONTH` —— 这些**引擎只 import 不用**（或完全没引用），改它们不会生效，清单见 §15.1「空转常量」。
> **t37 更正**：`data/ranks.js` 的 `GOLDEN_AGE_INTEGRITY_BONUS` **已不在上列**——它连同 `AGE_IF_MUL_60` / `AGE_IF_MUL_65` 已被 t28 从源码中**删除**（不是「空转」而是「已移除」），且 t37 已裁定正式取消该设计，见 §18.17。

---

## 12. `src/data/endings.js` — 结局

| ID | 结局 | 触发条件 | 类型 | 来源 |
|---|---|---|---|---|
| `academician` | 院士 | `rankIndex == 8` | 成功 | [SPEC] |
| `reported` | 被举报 | `integrity ≤ 0` 或 造假被查时 `integrity ≤ 25` | 坏结局 | [SPEC] 硬性 |
| `hospital` | 住院 | `health ≤ 0` | 中间 | [策划] |
| `retire` | 退休 | 第 384 月（65 岁）仍未到院士 | 中间 | [策划] |
| `lab_empty` | 实验室空了 | 单月 ≥3 名学生离组 | 中间 | [策划] |
| `bankrupt` | 课题组解散 | `money < 0` 连续 6 月且耗材 = 0 | 中间 | [策划] |
| `industry` | 下海 | 玩家主动选择退出学术界 | 中间（主动） | [策划] |
| `almost` | 准院士，来年再战 | rank 7 后触发退休；或票数 ≥3 但错过最后窗口 | 中间 | [策划] |

| ID | 取值 | 含义 |
|---|---|---|
| `ACADEMICIAN_VARIANT_HIGH` | 诚信 ≥80 且毕业学生 ≥10 | 院士结局·高洁版文案 |
| `ACADEMICIAN_VARIANT_DARK` | 诚信 <50 | 院士结局·暗面版文案 |
| `ACADEMICIAN_VARIANT_DEFAULT` | 其余 | 院士结局·默认文案 |

---

## 13. `src/data/events.js` — 随机事件数值

事件文案见 `docs/GDD.md` §10.3。事件的结构：`{ id, weight, cond, effects[], text }`。

| ID | 事件 | 权重 | cond | effects（可量化部分） |
|---|---|---|---|---|
| `e_reviewer2` | 审稿人二号 | 10 | 有在研项目 | 随机项目进度 −10；该项目学生幸福 −5 |
| `e_reagent` | 试剂到货 | 10 | 无 | 耗材资金 +5 |
| `e_machine_down` | 仪器罢工 | 8 | 液相 ≥1 | 液相停机 1 月；经费 −3 |
| `e_midnight_post` | 深夜朋友圈 | 8 | 有学生幸福 <40 | 该生幸福 +5 |
| `e_meeting_derail` | 组会跑题 | 6 | 本月开过组会 | 本月组会效果 = 0 |
| `e_peer_hat` | 同龄人的帽子 | 8 | 年龄 ≥40 | 精力 −1 |
| `e_inspection` | 校领导视察 | 6 | 无 | 经费 +10；下月耗材消耗 ×1.20 |
| `e_client_onsite` | 甲方来人 | 8 | 有在研企业项目 | 该项目进度 +15；该项目学生幸福 −6 |
| `e_grab_aftermath` | 抢一作后遗症 | 8 | 有学生被抢过一作 | 该生幸福 −8；若幸福 <30 再 −10 毕业进度 |
| `e_academician_visit` | 院士来访 | 5 | 总 IF ≥300 | 经费 −8；推荐票 +1 |
| `e_nsfc_letter` | 基金委来函 | 8 | 累计造假 ≥1 | 随机项目进度 −10；诚信 −3 |
| `e_wedding` | 学生的婚礼 | 6 | 有已毕业学生 | 经费 −3；全体学生幸福 +3 |
| `e_power_outage` | 断电事故 | 6 | 有在研项目 | 随机项目进度 −12；耗材 −4 |
| `e_exam_rise` | 考研生逆袭 | 6 | 有考研生 | 该生 ability +0.05（上限 0.95）；幸福 +10 |
| `e_editor_invite` | 主编约稿 | 5 | 总 IF ≥180 | 该项目下一篇论文档位 +1 |
| `e_poach` | 被挖角 | 6 | 有 ability ≥0.85 且幸福 <50 的学生 | 该生离组；项目进度 ×0.40 |
| `e_health_check` | 体检报告 | 6 | 健康 <40 | 健康 +5；本月精力上限 −2 |
| `e_apc` | 版面费 | 6 | 近 3 月结题含四区 | 经费 −6 |
| `e_scooped` | 隔壁组抢发 | 5 | 有在研项目 | 该项目最高档位论文 −1 档 |
| `e_love` | 学生恋爱了 | 6 | 有学生幸福 ≥50 | 该生幸福 +15；毕业进度 −8 |
| `e_breakup` | 学生失恋了 | 6 | 有学生幸福 <60 | 该生幸福 −15；下月产出 ×0.50 |
| `e_stipend_raise` | 学校上调补助标准 | 4 | rank ≥3 | 全体期望工资档 +1（永久）；本月幸福 −3 |
| `e_flood` | 实验室水漫金山 | 4 | 超净台 ≥1 | 耗材 −8；超净台停机 1 月 |
| `e_reunion` | 老同学聚会 | 6 | 无 | 精力 −1；健康 −3 |

| 常量 | 取值 | 含义 |
|---|---|---|
| `EVENT_WEIGHT_DEFAULT` | 6 | 未单列事件的默认权重 |
| `EVENT_COOLDOWN_MONTHS` | 6 | 同一条事件触发后的冷却月数（防重复） |
| `MACHINE_DOWN_MONTHS` | 1 | 停机事件持续月数 |
| `INSPECTION_CONSUME_MUL` | 1.20 | 校领导视察后下月耗材消耗倍率 |

---

## 14. `src/data/names.js` — 命名字库

| ID | 规模 | 内容 | 来源 |
|---|---|---|---|
| `SURNAMES_SINGLE` | 192 | 单字姓，按人口常见度 5 档加权（王 7.2 … 末档 0.06） | [策划] |
| `SURNAMES_COMPOUND` | 20 | 复姓（欧阳、上官、司马、诸葛、东方、独孤、慕容、尉迟、皇甫、长孙、宇文、夏侯、西门、南宫、公孙、呼延、赫连、澹台、端木、拓跋） | [策划] |
| `GIVEN_FIRST` | 244 | 双字名首字（偏中性 / 偏男性两段，比例见源码注释） | [策划] |
| `GIVEN_LAST` | 264 | 双字名末字（偏中性 / 偏女性两段，比例见源码注释） | [策划] |
| `GIVEN_SINGLE` | 204 | 单字名用字（与末字库部分重叠 + 独立字） | [策划] |
| `NAME_BLOCKLIST` | 50 | 直接禁用的姓名 | [策划] |
| `HOMOPHONE_BLOCK` | 42 | 谐音禁用拼音对 | [策划] |

> **t28 扩表完成（t37 同步）**：上表为**实际条目数**，七项全部 ≥ `NAME_DATA_TARGET`（186 / 20 / 240 / 260 / 200 / 50 / 40）；`check.mjs` 第 9 项已改为直读 `NAME_DATA_TARGET` 逐项比对，当前输出「[ok] 字库规模达标」（**0 警告**）。组合空间 = (192 + 20) × (244 × 264 + 204) = **13,699,440**。实测 200 名新生：全名重复 0 例、姓氏 63 种（Top5 张 19 / 刘 17 / 王 11 / 李 11 / 陈 10）、男性 48%。

| ID | 取值 | 单位 | 含义 | 来源 |
|---|---|---|---|---|
| `NAME_DOUBLE_RATE` | 0.70 | 概率 | 双字名比例（其余 0.30 单字名） | [策划] |
| `COMPOUND_SURNAME_RATE` | 0.03 | 概率 | 复姓比例 | [策划] |
| `GENDER_NEUTRAL_RATE` | 0.60 | 概率 | 完全中性组合比例（其余 0.40 带性别倾向） | [策划] |
| `NAME_RETRY_MAX` | 30 | 次 | 合法性检查最大重抽次数 | [策划] |
| `NAME_CHAR_DECAY` | 0.35 | — | 用字衰减指数：权重 × exp(−0.35 × 已用次数) | [策划] |
| `NAME_TONE_RULE` | 姓与名首字不同为三声 | — | 声调规避规则 | [策划] |
| `NAME_SPACE_SIZE` | 12,895,600 | — | 组合空间 = 206 × (240 × 260 + 200) | 计算值 |
| `NAME_EFFECTIVE_SPACE` | ≈3.2×10⁵ | — | 有效组合（按权重前 40% 覆盖 80% 生成量） | 计算值 |
| `NAME_COLLISION_TARGET` | ≤0.2% | — | 一局 30 名学生的重名概率上限（实际 ≈0.14%） | 计算值 |
| `NAME_CHAR_REUSE_TARGET` | ≤8% | — | 一局内用字重复率上限 | [策划] |

---

## 15. 可调性速查（调参指引）

### 15.1 只能改这里，别的地方不要有数字（t13 重写：F9「照着改改不动」）

**数据层（12 个文件，全部可改）**：`src/data/` 下的 `tuning.js` / `ranks.js` / `instruments.js` / `projects.js` / `papers.js` / `hardpoints.js` / `students.js` / `market.js` / `actions.js` / `events.js` / `endings.js` / `names.js`。

**逻辑层**：`src/core/`（**不是** `src/engine/`，早期版本写错过这个路径）只允许出现 0、1、比较运算符与数组下标；公式住在 `src/core/formulas.js`，规则住在 `src/core/rules.js` 与 `src/core/engine.js`。改公式请改这两个文件，不要在数据表里找。

#### 文档 ID → 代码真实名字（逐个核对过；下表 20 个 ID 在代码里**没有**同名导出，照旧名改会找不到）

| 文档里曾用的 ID | 代码里的真实位置 | 现值 |
|---|---|---|
| `INTEGRITY_GRAB_FIRST` | **`INTEGRITY_DELTA.grabFirst`**（`data/tuning.js`）；`data/papers.js` 的 `GRAB_FIRST_INTEGRITY` 同名同值但引擎只 import 不读 | −8 |
| `INTEGRITY_BUY_FIRST` | **`INTEGRITY_DELTA.buyFirst`**（`data/tuning.js`）；`BUY_FIRST_INTEGRITY` 同上（死名） | −4 |
| `INTEGRITY_FAKE` | `FAKE_INTEGRITY`（`data/hardpoints.js`） | −10 |
| `INTEGRITY_FAKE_CAUGHT` | `FAKE_CAUGHT_INTEGRITY`（`data/hardpoints.js`） | −25 |
| `INTEGRITY_AUDIT` | **`INTEGRITY_DELTA.audit`**（`data/tuning.js`）；`AUDIT_INTEGRITY` 为死名 | −15 |
| `INTEGRITY_EXTREME` | `LEAVE_EXTREME_INTEGRITY`（`data/students.js`） | −50 |
| `INTEGRITY_FINISH_PROJECT` | `INTEGRITY_DELTA.finishProject`（`data/tuning.js`） | +2 |
| `INTEGRITY_FINISH_ENTERPRISE` | `INTEGRITY_DELTA.finishEnterprise`（`data/tuning.js`） | +1 |
| `INTEGRITY_GRADUATE` | `INTEGRITY_DELTA.graduate`（`data/tuning.js`）；`GRAD_INTEGRITY_BONUS` 为死名 | +3 |
| `INTEGRITY_PROMOTE` | `INTEGRITY_DELTA.promote`（`data/tuning.js`）；`PROMOTE_INTEGRITY_BONUS` 为死名 | +2 |
| `INTEGRITY_NO_WAGE` | `INTEGRITY_DELTA.noWage`（`data/tuning.js`） | −2 |
| `INTEGRITY_OVERDUE` | `INTEGRITY_DELTA.overdue`（`data/tuning.js`）；`OVERDUE_INTEGRITY_PER_MONTH`（`data/projects.js`）为死名 | −1 |
| `INTEGRITY_PROJECT_FAIL` | `INTEGRITY_DELTA.projectFail`（`data/tuning.js`） | −5 |
| `INTEGRITY_GIVEUP_STUDENT` | `INTEGRITY_DELTA.giveUpStudent`（`data/tuning.js`） | −2 |
| `CONSUME_PROGRESS_MUL` | `CONSUME_MODES[mode].progressMul`（`data/tuning.js`） | free 1.15 / normal 1.00 / tight 0.85 |
| `CONSUME_HAPPY_DELTA` | `CONSUME_MODES[mode].happyDelta`（`data/tuning.js`） | +3 / 0 / −5 |
| `HARDPOINT_COUNT_BY_TIER` | 函数 `hardpointCount(tier)`（`data/hardpoints.js`，导出的是函数不是表；难度分布见 `HARDPOINT_HD_DIST`） | K = tier |
| `HARDPOINT_PROGRESS_PENALTY` | `HARDPOINT_PROGRESS_PENALTY_PER_HD`（`data/hardpoints.js`） | 0.25 |
| `PROGRESS_PCT_DENOM_MUL` | `PROGRESS_PCT_DENOM_PER_HARDPOINT`（`data/hardpoints.js`） | 见文件 |
| `ENERGY_MAX_FORMULA`、`MAX_ENERGY_FROM_HEALTH` | `ENERGY_MAX_BASE` + `ENERGY_PER_HEALTH_10` + `ENERGY_MAX_SOURCE`（`data/tuning.js`）+ `energyMax()`（`core/formulas.js`） | 见 §11 |

#### 另外三类「不是常量」的名字（别去数据表里找）

| 类 | 文档里出现过的名字 | 实际位置 |
|---|---|---|
| 公式（标 `[公式]`） | `REQ_IF_FORMULA`、`REQ_RANK_FORMULA`、`HARDPOINT_APPEAR_RULE`、`NAME_TONE_RULE` | `src/core/formulas.js` / `src/core/rules.js` / `src/core/engine.js` 里的函数 |
| 分析量（估算/口径，不参与运行） | `NAME_SPACE_SIZE`、`NAME_EFFECTIVE_SPACE`、`NAME_COLLISION_TARGET`、`NAME_CHAR_REUSE_TARGET` | 字库本体是 `SURNAMES_SINGLE` / `SURNAMES_COMPOUND` / `GIVEN_FIRST` / `GIVEN_LAST` / `GIVEN_SINGLE` / `NAME_BLOCKLIST` / `HOMOPHONE_BLOCK`（`data/names.js`，**没有** `NAME_` 前缀）；组合空间是文档口算 |
| 只读镜像（改它无效） | `RANKS[].ifReq` 等经 `rankOf()` 暴露；`INTEGRITY_MAX/MIN` 是夹取边界不是增量 | 改增量请改 `INTEGRITY_DELTA.*` |

#### 空转常量（改了不生效，t13 审计发现）

| 常量 | 位置 | 为什么改了没用 |
|---|---|---|
| `NO_WAGE_INTEGRITY`（−2） | `data/students.js` | 引擎走 `INTEGRITY_DELTA.noWage`；同名同值两份，只有前者生效 |
| `GIVEUP_INTEGRITY`（−2） | `data/students.js` | 同上，引擎走 `INTEGRITY_DELTA.giveUpStudent` |
| `GRUDGE_HAPPY_PER_MONTH`（−2） | `data/papers.js` | 引擎里心结月扣写在 `core/formulas.js:202`（字面 −2），未读该常量；改它无效（§18.5 列为待修） |
| `INTEGRITY_DELTA.divert`（−3） | `data/tuning.js` | 引擎未引用：多人攻坚目前只扣其他项目的**进度**、不扣诚信（§18.5 列为待修） |
| `GRAB_FIRST_INTEGRITY`（−8）/ `BUY_FIRST_INTEGRITY`（−4） | `data/papers.js` | engine 只 import 不读；真正生效的是 `INTEGRITY_DELTA.grabFirst` / `.buyFirst` |
| `AUDIT_INTEGRITY`（−15） | `data/hardpoints.js` | engine 只 import 不读；真正生效的是 `INTEGRITY_DELTA.audit` |
| `GRAD_INTEGRITY_BONUS`（+3） | `data/students.js` | engine 只 import 不读；真正生效的是 `INTEGRITY_DELTA.graduate` |
| `PROMOTE_INTEGRITY_BONUS`（+2） | `data/ranks.js` | engine 只 import 不读；真正生效的是 `INTEGRITY_DELTA.promote` |
| `OVERDUE_INTEGRITY_PER_MONTH`（−1） | `data/projects.js` | engine 只 import 不读；真正生效的是 `INTEGRITY_DELTA.overdue` |
| ~~`AGE_IF_MUL_60`（1.15）/ `AGE_IF_MUL_65`（1.40）~~ | `data/ranks.js` | **状态已从「空转」改为「已删除」**：t28 认定其结构上不可生效（65 岁 = 退休月）并从 `data/ranks.js` 移除，只在源码注释保留理由；t37 裁定**正式取消该设计**（§18.17）。本条保留是为了让「文档里见过的旧名」有去处 |
| ~~`GOLDEN_AGE_INTEGRITY_BONUS`（+2）~~ | `data/ranks.js` | **已删除**（core 零引用）；黄金年龄当前只有 `GOLDEN_AGE_MONEY_MUL` 在生效 |

> **半空转（只被一条路径读，t32 登记）**：`PROJECT_MAX_STUDENTS`（6，`data/hardpoints.js:18`）只被**一键分配**读取（`core/engine.js` 的 `autoAssignPlan()` / 应用分支 / `selectors` 的 `projectCap`），**手工分配 `reduceAssign()` 不读**。所以「改它」只改一键分配的上限，玩家手工仍可往同一项目无限堆人；裁定（应统一到同一不变式）与支配性评估见 §18.16。

#### 自查命令（改完跑一次，确认文档里没有不存在的 ID）

```bash
node -e "const fs=require('fs');const d=fs.readFileSync('docs/BALANCE.md','utf8');const ids=[...new Set(d.match(/[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+/g))];const src=['data','core'].flatMap(k=>fs.readdirSync('src/'+k).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync('src/'+k+'/'+f,'utf8'))).join('\n');const miss=ids.filter(i=>!src.includes(i));console.log('文档 ID',ids.length,'| 未在 src/ 出现',miss.length,miss.join(', '))"
```

> 期望输出：`未在 src/ 出现 ≈26`。这 26 个**全部是刻意保留的旧名/非常量名**，分两类，每一类都能在本文档查到去处：① 上表左列的 14 个 `INTEGRITY_*` 旧名 + `HARDPOINT_COUNT_BY_TIER`（15 个）；② 「不是常量」表里的公式名与分析量（11 个，如 `REQ_IF_FORMULA`、`NAME_SPACE_SIZE`）。
> 判定规则：**只有出现这三类之外的新名字才算破例**——那说明有人又写了个不存在（或已改名）的 ID，按上表映射修正，不要沉默照办。数字会随文档增删轻微浮动，看名单不看个数。

### 15.2 关键调参杠杆（改一个值会牵动什么）

| 想调 | 改这个 | 副作用 |
|---|---|---|
| 通关太快 / 太慢 | `RANKS[8].ifReq`（1400） | 直接影响一局月数（±100 IF ≈ ±8 个月） |
| 前期太穷 | `RANKS[1].schoolFundYear`（72）或 `E1/E2.money` | 开局买不起液相时最明显 |
| 抢一作太划算 | `INTEGRITY_DELTA.grabFirst`（−8） | 调大 → 玩家转向「买一作」，需同步调 `PAPER_BUY_PRICE` |
| 造假太划算 | `FAKE_CATCH_BASE`（0.10）/ `FAKE_CATCH_PER_PROJECT`（0.04） | 调大 → 造假流被压制；调小 → 诚信系统失去威慑 |
| 学生太难伺候 | `WAGE_HAPPY.*` | 影响所有学生的长期幸福度曲线 |
| 名字太单调 | `NAME_CHAR_DECAY`（0.35）/ 字库规模 | 衰减越大越多样，但可能抽出怪名字 |
| 仪器太贵 | `INST_PRICE_GROWTH`（1.6） | 调小 → 后期无所事事；调大 → 终局买不起质谱 |
| 项目拖太久 | 各项目 `limitMonths` | 影响逾期率（当前 3–7 个/局 ≈10%） |

### 15.3 平衡红线（改参数时的自检项，t13 重写）

> 两条旧红线的处置（t13，含一次自我更正）：①「IF/工作量 ∈ [0.070,0.115]」的**度量名**曾按字面 IF/W 读，实为 IF/(W×0.85)（逐项吻合，见 §17.2），已改名并升级为「区间 + 单调」；②「随手玩通关率 85%–95%」的**区间本身保留**，但它的**支点归因是错的**——真正的支点是项目/候选人**供给节奏**，不是 rank8 门槛（t22 解耦后 casual 回到 15/16 = 93.8%）。区间必须与「供给不变式 + 一作供给机制」同批测量才有意义；更正过程见 §18.15。

#### 红线 1｜国家项目的产出效率：单调 + 区间（原「唯一最优解」检查）

度量：`IF/(工作量 × 0.85)`（0.85 = 老板亲带系数，GDD §3.4 口径；**旧的「IF/工作量」字面口径作废**）。

| 项目 | N1 | N2 | N3 | N4 | N5 | N6 |
|---|---|---|---|---|---|---|
| 现值 IF/(W×0.85) | 0.0918 | 0.0991 | 0.0774 | 0.1049 | 0.0804 | 0.0885 |
| tier | 1 | 2 | 3 | 4 | 5 | 6 |

自检条件（两条同时成立）：

1. **区间**：T1–T3 ∈ **[0.070, 0.100]**；T4–T6 ∈ **[0.100, 0.135]**（高等级必须更强，允许的上限比低等级高）。
2. **单调**：tier 越高 `IF/(W×0.85)` 不得低于低 tier 的最低值；同一 tier 内任意两项比值 ≤ **1.35**（防「唯一最优解」）。

现状判定：**不通过**——N3（0.0774）低于 N1/N2，N5（0.0804）、N6（0.0885）低于 N4（0.1049），即「越高级的本子越不划算」。这正是 §18.3 硬墙的根因，处置方案见 §18.3。

#### 红线 2｜通关率（两侧可失败；8 局粒度 12.5%）

先定义两个路线（口径必须写死，否则数字没意义）：

| 路线 | 定义 | 目标区间 | 判定 |
|---|---|---|---|
| 速通 | `simulate --strategy=speedrun`：全力扩招 + 买设备 + 挑 IF/月最高的本子 + 多人攻坚 | **[75%, 100%]**（8 局：6/8–8/8） | <6/8 → 门槛过高（须修）；恒 8/8 且当选月中位 <140 → 门槛过硬（复核 rank8） |
| 随手玩（`casual`） | `simulate --strategy=casual`：正常消耗、5 人/项目、多人攻坚、不抢不买、不做极限运营。**「随手玩」在仓库里是 `casual`，不是 `balanced`（后者是「中庸经营」）** | **[85%, 95%]**（8 局：7/8–8/8） | <7/8 → 过难（先按 §18.15 第 3 条查供给与一作链，再动数值）；恒 8/8 且当选月中位 <140 → 门槛过硬（复核 rank8） |
| 中庸经营（`balanced`，参考线） | `--strategy=balanced`：不亲带、不买一作、只保毕业与稳定 | **不设通关率红线** | **负面对照（无解打法）**：它的配置是「不亲带 + 不抢 + 不买」⇒ 玩家一作恒为 0 ⇒ rank2 起数学上不可达，**它必须永远 0/8**；若某天 > 0/8，说明一作门槛失效了。**不要**把它读成「稳健玩法无法通关」（保守但合规的玩法是 `casual`，实测 93.8%）；见 §18.18 裁定 ③ |

判别力说明：8 局粒度 12.5%，绿区恰好覆盖 3 个刻度（50/62.5/75），两端各留 ≥1 个刻度给「过难 / 过易」，因此单次 8 局即可给出无歧义判定；若要更细的置信度，用 16 局（6.25% 粒度）跑一次复核，但红线阈值仍按 8 局口径换算。

历史与现状（**旧口径「全部论文计入」，t24 后将作废**）：

| 指标 | t2 锚点（启发式脚本） | t4 实测 | t13 实测（t22 后、当前代码） |
|---|---|---|---|
| 速通通关率 | ≈15/16（93.8%） | 8/8（100%） | 8/8（100%） |
| 随手玩（`casual`）通关率 | 85%–95%（红线旧值） | 12/16（75%） | **15/16（93.8%，t22 实测）** —— 区间成立，支点 = 供给节奏 |
| 中庸经营（`balanced`）通关率 | 未列入（旧表把两条路线混成一列） | 12/16（75%，口径混用） | **0/8（0%）**：8 局全部「退休」在 rank5（7 局）/rank6（1 局），唯一缺口 `T5 及以上结题 1 项`；原因是它不亲带不买一作 |

→ t13 一度把上面的 `balanced` 0/8 当成「随手玩」并据此把区间改成 [50%, 75%]，**该结论已撤回**（口径写错：随手玩是 `casual`）。修正后的口径、机制与判定顺序见 §18.15。

#### 红线 3｜通关节奏（双重锚点）

1. **总 IF 首达 1400 的月中位** ∈ **[90, 180]**（对应 25–50 分钟）。旧锚点 [170,190] 保留作对照，但它来自未留档的启发式脚本；t13 实测（post-t22 speedrun 8 局）IF+论文门槛齐备月为 89–177。
2. **实际当选院士月 `≤ 264`（22 年）**：当选还受「T6 结题 ≥2 + 增选窗口（每 24 月）」约束，故比 IF 首达晚 1–2 个窗口是**设计意图**，但不应晚于 264 月（即 55 岁），否则一局拖到退休边缘、玩家看不到结局节奏。
3. **滞后检查**：`当选月 − IF 首达 1400 月 ≤ 48 月`（=2 个增选窗口）。t13 实测旧口径速通 8 局中 7 局满足（滞后 8–44 月），1 局为 158 月（种子 t4-02，瓶颈是 T6 结题而非票数）——记为观察项，不是硬性红灯。

#### 红线 4｜诚信只增不减（「从不抢/从不造假」路线）

保持：按期结题 +2、横向 +1、学生毕业 +3、晋升 +2 的正向来源足以抵消逾期 −1/月。

#### 红线 5｜学生幸福度持平（中工资 + 正常耗材 + 有项目）

保持：ΔH ≈ 0（否则玩家被迫做无意义操作）。

#### 红线 6｜一作来源结构（t24 新增，配合「门槛只计玩家一作」）

一局结束时，玩家一作应满足：**亲带贡献 ≥ 60%**，抢 + 买合计 ≤ 40%。理由：SPEC 给了三条来源（亲带 / 抢 / 买），若「买」占多数，则晋升完全由经费与 100 点诚信额度决定、亲带与「认可」叙事消失；若「抢」占多数，诚信系统必然先崩（每次 −8）。t13 阴影账本实测（speedrun + 亲带=all）亲带占比 ≈ 100%（q1 26–49 篇全部来自亲带，买只用于补正刊）——即当前数值下结构健康，但**只有在玩家发现亲带时**才健康（§18.4）。

#### 红线 7｜硬墙检查（t13 新增）

任何一级晋升都不允许出现「单一指标硬墙」：若某局在 384 月内 IF ≥ 2× 门槛、玩家一作 ≥ 2× 需求、结题项目 ≥ 60，却因**单一**项目等级或**单一**票数停滞 ≥ 120 月 → 判定为硬墙，必须按 §18.3 处置。t13 实测触发：7/8 局（**中庸经营 `balanced`**）卡在「T5 及以上结题 1 项」。

---

## 16. 与 GDD 的对应关系

| BALANCE 章节 | GDD 章节 |
|---|---|
| §1、§11 | §0、§2 |
| §3 | §3 |
| §4 | §4 |
| §5、§7 | §5 |
| §6 | §2.7、§2.8、§5.5 |
| §8 | §6 |
| §9 | §7 |
| §10 | §8 |
| §12 | §9 |
| §13 | §10 |
| §14 | §6.1 |
| §15 | §11 |
---

## 17. 数值实现修订与实测记录（t4 主程）

本节记录「实现层」为对齐本文档而做的修订与实测数据。**未改动 §1–§16 的任何数值**，
只登记实现口径与一条红线口径的说明，供后续调参者对照。

### 17.1 实现 bug 修复（口径对齐本文档，不是改数值）

| # | 位置 | 原实现 | 现在 | 依据 |
|---|---|---|---|---|
| 1 | 多人攻坚「影响其他项目进度」 | 其他项目**累计**进度 ×0.75 | 其他项目**本月**进度 ×0.75（月度乘子，月底消费一次） | §4.3 / GDD §6.3 原文是「其他项目**本月**进度 −25%」。按累计进度扣，在 4–6 个在研项目下一次攻坚就吃掉近一个项目的进度，多人攻坚长期净亏、大项目永远结不了题 |
| 2 | 单人猛干 | 只扣 5 万 + 该生幸福 −20 | 追加「该生本月产出全部用于攻坚」 | GDD §6.3 ③ |
| 3 | 难点难度掷点 | 只有「隐藏→暴露」时掷 hd，提前攻坚的难点永远是占位 hd=1 | 难点**首次被打开**时掷点（两条路径都掷） | §4.3 难点难度分布 |
| 4 | 学生名册上限 | students.slice(0, 60)：保留最早 60 条，**把新招的学生删掉** | 只裁剪已毕业/已离组的历史记录，在读学生永不裁剪 | 无此设计，属实现 bug（课题组到 60 条后招聘全部静默失效） |
| 5 | 结题后的学生负责列表 | 结题后不清 projectIds，学生 3 个项目名额被已结题项目占满 | 结题时把项目从学生 projectIds 摘掉 | §8 MAX_PROJECTS_PER_STUDENT=3 的本意 |
| 6 | 耗材资金为负 | 事件（断电事故 consumable −4）可把耗材扣成负数 | 任何路径夹到 ≥0 | §5.3 耗材资金是「非负库存」 |
| 7 | 市场挂位 | 学生 offer 永不过期 + 与项目 offer 共用 MARKET_SLOTS=5 | 项目/学生**独立配额**（项目 5 + 学生 3），两类各自 6 个月 TTL | §5.2；新增不变式「任何月份至少有 1 个当前头衔+仪器真能承接的项目 offer」 |
| 8 | 候选人挂位 | 招生季里挂着的候选人都「够不着」（reqRank/reqIF 超）时席位被占满、新生代进不来 | 招生季里若没有够得着的候选人，淘汰最旧的换新（不变式：≥1 个够得着的候选人） | §9 |
| 9 | 增选窗口 | rank7 + 3 票时，**任一**窗口关闭后立刻判「准院士」结束 | 只在「最后一个增选窗口 / 退休」时判「准院士」 | GDD §10 结局表 |

### 17.2 红线口径澄清（§15.3 第 1 条）

§15.3 写作「国家项目 IF/工作量 ∈[0.070,0.115]（当前 0.077–0.105）」，
但「当前 0.077–0.105」这串实际是 **GDD §3.4 的 IF/(W×0.85)**（0.85 = 玩家亲带系数）：
N1 0.0918、N2 0.0991、N3 0.0774、N4 0.1049、N5 0.0804、N6 0.0885，逐项落在区间内。
若按字面的 IF/W 计算：N1 0.0780、N2 0.0842、**N3 0.0658**、N4 0.0892、**N5 0.0683**、N6 0.0753，
N3/N5 会掉到 0.070 以下 —— 这是**口径命名不一致，不是数值超标**（实现数值与 GDD §3.4 表逐行一致）。
建议把 §15.3 的度量写成 IF/(工作量×0.85)。

### 17.3 实测记录（scripts/simulate.mjs，固定种子）

| 指标 | 锚点（策划师一次性脚本） | 本实现实测（8 个固定种子） |
|---|---|---|
| 速通路线通关率 | ≈15/16（93.8%） | 8/8（100%） |
| 通关月（总 IF 首达 1400）中位 | 182（171–189） | 132（94–157；策略机器人越强越低） |
| 通关时总 IF | 1403–1471 | 2100–3400 |
| 通关时一区一作 | 22–32 | 39–81 |
| 一局结题项目 | 44–50 | 62–87 |
| 逾期项目峰值 | 3–7/局 | 0–2/局 |
| 末局诚信 | 61–89 | 100（不抢不造假） |
| 随手玩通关率 | 85%–95% | **12/16（75%）** |

表内实测值随策略机器人调参而变：**以 node 评院士/scripts/simulate.mjs 的当次输出为准**，
tests/balance.test.mjs 只断言不会被正常调参打破的量级区间。

两条偏差的结论（已回报主理人，不擅自改数值）：

1. **通关时 IF / 一区 / 结题数高于锚点**：本仓库的策略机器人比未留档的一次性脚本打得更狠
   （把 6 名学生堆到同一项目、按「每月还差多少进度」派活）。通关月中位 176 与锚点 182 同量级，
   先达阈值月的分布与锚点区间一致。
> **t13 更新（保留原文备查）**：本表最后一行是**口径混用**的产物（把 `balanced` 与 `casual` 混成一列）。现行读数：`casual`（随手玩）t22 后 15/16 = 93.8%；`balanced`（中庸经营）0/8（不亲带不买一作，新口径下必然卡住）。现行口径与红线见 §15.3 红线 2、红线 3，裁定与更正见 §18。

---

## 18. t13 平衡裁定（门槛结构 / 一作口径 / 推荐票 / 通关率口径）

> 本节是**裁定与依据**：所有「【建议 · 未落表】」都需要主程在 t24 或后续任务里落进 `src/data/`，本节不擅自改数。
> 全部数字来自 t13 自建探针（`D:/harness/_t13probe/`，交付物之外），版本与复跑要求见 §18.9。

### 18.1 基线实测（t22 解耦后，8 个固定种子 × 384 月，机器人原样不干预）

| 路线 | 通关率 | 结局 | 末局总 IF | 唯一缺口 |
|---|---|---|---|---|
| 速通 `speedrun` | 8/8（100%） | academician ×8 | 2009–2903 | — |
| 中庸 `balanced` | **0/8（0%）** | retire ×8 | 5399–6957 | 7 局「T5 及以上结题 1 项」、1 局「T6 结题 1 项」 |

中庸路线的关键读数（t4-01）：总 IF 6502、全部论文一区 117 篇、推荐票 42 张、结题项目 243 个、现金 13522 万 —— **全部超额，唯一缺口是单一项目等级**。

结论：这不是「够不着门槛」，而是「门槛只认一件事，而那件事在数值上不值得做」。诊断见 §18.3。

### 18.2 一作口径变更（t24）：门槛只计玩家一作

裁定（依据 SPEC「满足 sci 一作数量 以后头衔晋升」+ GDD §2.7/§3.2 的 firstQ1/firstQ2/firstTop）：

1. 晋升门槛只计**玩家一作**（`papersFirst`）；`totalIF` 仍计全部论文（GDD.md:164）。
2. 老板亲带 → 该项目全部论文一作归玩家；抢一作 / 买一作 各恰好 +1。
3. 修复前缺陷（t13 复核确认）：`core/engine.js:411 → 473 awardPaper` 对**每篇**结题论文无条件 `+1`，不论一作是谁；`core/engine.js:410` 只要有学生参与就把一作派给学生（亲带只改署名文案、不给一作）。⇒ 修复前「抢一作」对晋升零帮助。

表 18.2｜**新口径阴影账本**（t13 探针按裁定语义离线重算：`玩家一作 = 亲带项目全部论文 + 无学生署名论文 + papersFirst(抢/买)`；**t24 落地后必须复跑替换本表**）

| 路线 | 玩家一作 q1 | 玩家一作 q2 | 玩家一作 top | 新口径各项齐备月 | 旧口径实际当选月 |
|---|---|---|---|---|---|
| 速通 · 不亲带 | 0 | 0 | 3（全靠买正刊） | **rank2 都过不去**（q1 需 2） | 144–216 |
| 速通 · 只亲带 tier ≥ 4 | 22–46 | 61–67 | 2–3 | r7–r8：97–207（1/3 局缺正刊） | 143–215 |
| 速通 · 亲带全部 | 26–49 | 78–109 | 3 | r8：114 / 143 / 166 | 144–216 |
| 中庸 · 不亲带 | 0 | 0–1 | 0 | **rank1 卡死** | 384（退休） |
| 中庸 · 亲带全部 | 80–92 | 292–295 | 1 | r6：126–160；**卡在 r7 的正刊 ≥2** | 384（退休） |

三条结论：

1. **q1 现值（2 → 16）在新口径下够用**：只要亲带，一区一作供给 26–92 篇，远超 r8 的 16；齐备月 114–166，早于旧口径的实际当选月（144–216）。
2. **q2 现值（2 → 44）在新口径下是装饰性的**：亲带党的二区一作供给 78–295 篇（r8 只需 44），q2 从不构成约束。【建议 · 未落表】下调 q2 需求（r6 24→16、r7 34→24、r8 44→28）；若坚持不改，则 UI 必须突出「真正卡你的是哪几条」（t20 的 missing 列表已具备该能力），否则玩家会把资源投在一个零约束的指标上。
3. **新口径的真正瓶颈是正刊（r7 需 2、r8 需 3）**：正刊只有两个来源——N6 的 10 个 PE 槽位（每槽 0.02 正刊权重 ≈ 0.2 篇/次结题）与买一作（120 万/篇）。中庸 + 亲带党 384 月只攒到 1 篇正刊，于是卡在 r7。【建议 · 未落表】三选一：(a) r7 的正刊需求 2→1（r8 保持 3）；(b) PE 槽位正刊权重 0.02→0.05；(c) 正刊买价 120→80 万。优先 (a)。

### 18.3 硬墙裁定：rank5 → 6 的「T5 及以上结题 ≥ 1」

逐项排除（每条都有独立探针，见 §18.9）：

| 假设 | 证据 | 结论 |
|---|---|---|
| 市场不给 T5/T6 本子 | T5/T6 offer 首现于第 53–121 月且 `offerReachable` 为真（当时质谱 1、气相 1、酶标仪 2、液相 2、现金 390–2234 万）；t22 后项目 offer 全年刷新 | 否 |
| 仪器不够（质谱 260 万，tierGate 4） | 机器人在 rank4 就买齐 T5 所需全套（§5.4 的 require 全绿），现金始终 ≥ 390 万 | 否 |
| 工期 / 工作量不可行 | 「亲带 + 优先接高等级本子」策略在同一引擎上跑出 T5 首接 54–108 月、首结 72–126 月；速通 8/8 都完成了 T5/T6 | 否 |
| **不划算（理性玩家拒接）** | ① IF 效率倒挂：N5 0.0804、N6 0.0885 都低于 N4 0.1049（§15.3 红线 1 判定不通过）；② 现金流：N6 合同 800 万 vs 正常消耗 24 万/月 × 48 月 = 1152 万 → **净 −352 万**；N5 400 万 vs 432 万 → 净 −32 万；③ 还要占用 4 年工期与 3–6 名学生名额 | **是（根因）** |

**裁定：保留「T5+ 结题 ≥ 1」硬门槛，不加「IF 达标即可」的宽口径替代路径。** 理由：

1. 杰青 / 长江的现实门槛就是「主持国家级项目」（[研究] §1）；rank7 / rank8 仍要求 T6 结题 ≥ 1 / ≥ 2，只在 rank6 开 IF 替代只是把硬墙往后挪一格，不解决根因。
2. 上表第 3 行证明该门槛**可达可结题**；被卡住的是「接它划不来」。

【建议 · 未落表】四条修法（按优先级）：

1. **IF 效率改单调**（对齐 §15.3 红线 1 的新区间）：N5 0.0804 → **≥ 0.105**、N6 0.0885 → **≥ 0.115**。两条等价路径任选其一：提 `expectedIF`（N5 75.13 → 约 98、N6 150.53 → 约 196，做法是把 PB/PC 槽位换成 PA/PE）；或缩工期与工作量（N5 W 1100 → 850 且 limitMonths 36 → 30；N6 W 2000 → 1500 且 limitMonths 48 → 40）。
2. **耗材不再吞掉利润**：N5 `consumablePerMonth` 12 → **8**（36 月 = 288 万，占 400 万的 72%）；N6 24 → **18** 且合同额 `money` 800 → **1100 万**（对齐 [研究]「国家重点研发计划项目千万级」锚点；落表后 48 月耗材 864 万，净 +236 万）。
3. **让目标看得见**：§5.2 规则 3 使 T5/T6 本子只在仪器买齐后才出现，玩家看不到自己缺哪台仪器。修法：每个刷新周期保证挂 1 个「当前头衔可达但仪器未齐」的最高等级本子（置灰 + 列出缺失仪器）。UI 已具备「仪器要求」展示能力。
4. **有界兜底**：若 1–3 落地后「随手玩」通关率仍 ≤ 3/8、且停滞样本缺口清一色是「T5+ 结题」，再启用一次性破格认定：`T5+ 结题 ≥ 1` **或**（正刊一作 ≥ 2 且 一区一作 ≥ 40 且 已结题 ≥ 120）。依据 [A] 人社部发〔2020〕100 号的「破四唯 / 代表性成果制」。通过面实测：中庸路线 8/8 局都会在 200–300 月满足这三项（IF 5399–6957、一区 76–141 篇、结题 ≥ 200 个），且该兜底**不适用于 rank7/8**（那两级仍必须结 T6）。

### 18.4 亲带路径的强度｜「只亲带不招兵」会不会成为支配策略

**裁定：不会；相反，亲带是「署名税」，不招兵等于自杀。**

1. 机制：`studentBaseProgress()`（`src/core/formulas.js:114-118`）只按**学生**能力与幸福度算进度；亲带只是把该项目内每名学生的进度 ×0.85。玩家本人不产生独立进度点。
2. 实测（speedrun 配置 + `hire:false` + 亲带全部，384 月）：**结题 3 个项目、rank1–2、IF 69–79、玩家一作 q1 = 0–1**；对照组（不亲带不招兵）IF 46–86、q1 = 0。⇒ 不招兵 384 个月连院士门槛的 5% 都到不了。
3. 亲带的真实代价：**该项目在校学生的进度 −15%** + **每亲带 1 个项目 1 精力/月**（上限 `floor(energyMax/2)` = 5 个项目）。以月精力 10 计，亲带 5 个项目后只剩 5 点：一次组会（4 点）+ 一次交流（2 点）就超支（§10）。
4. 新口径下的正解：**亲带高等级项目**（PA/PB/PE 槽位所在）+ 学生打进度。实测「只亲带 tier ≥ 4」就足以满足 r7/r8 的一作门槛（见 §18.2 表）。
5. 【建议 · 未落表】若 t24 落地后速通通关率跌破 §15.3 红线 2 的下界（75%），**优先调亲带代价**而不是调门槛：`PLAYER_LEAD_MUL` 0.85 → 0.92，或 `PLAYER_LEAD_ENERGY_COST` 1 → 0.5/月。理由：亲带是唯一可规模化的一作来源（抢/买受 100 点诚信总额限制：抢 −8、买 −4，撑不到 r8 的 60 篇），永远不亲带 = 永远卡在 rank1–2。

### 18.5 抢 vs 买：性价比与两处必须登记的偏离

| 来源 | 一区 | 二区 | 正刊 | 诚信 | 学生幸福 | 其它 |
|---|---|---|---|---|---|---|
| 抢（`GRAB_FIRST_INTEGRITY` / `GRAB_FIRST_HAPPY`） | 0 万 | 0 万 | 0 万 | **−8** | **−30** + 心结 6 个月（每月 −2） | 需该项目确有该生一作；一篇只能抢一次；一人一月一篇 |
| 买（`PAPER_BUY_PRICE` / `BUY_FIRST_INTEGRITY`） | 25 万 | 12 万 | 120 万 | −4 | **0（SPEC 要求「较少」，当前缺失）** | 随时可买，越厉害越贵 |

1. **相对关系符合 SPEC**：诚信 8 : 4 = 2 : 1（「大幅」达标）；幸福 −30 : 0（「暴跌」达标）；经费 0 : 2–120 万（达标）。
2. **两处偏离必须登记**：
   - 【SPEC 偏离 · 待实现】SPEC 写「购买一作：消耗经费、**诚信与幸福减少较少**」，当前实现的学生幸福代价是 0。建议落表：买一作时若该篇能定位到原一作学生 → 该生幸福 **−6**；否则（买「无主」一作，当前常态）→ 全组在读学生幸福 **−2**。量级取「抢」的 1/5，维持「较少」。
   - 【空转常量 · 待修】`INTEGRITY_DELTA.divert`（−3，多人攻坚挪用其他项目）在 core 里**无引用**：GDD §6.3 与 BALANCE §7.3 都登记了这条诚信代价，引擎只扣其他项目进度、不扣诚信。要么接上、要么从 §7.3 删掉该行（二选一必须做，否则玩家照着查不到）。同类还有 `NO_WAGE_INTEGRITY`、`GIVEUP_INTEGRITY`、`GRUDGE_HAPPY_PER_MONTH`（见 §15.1「空转常量」表）。
3. **买一作是新口径下的正刊直通车**（120 万/篇，对比 N6 自然产出约 0.2 篇/次）：一局末现金 6000–19000 万说明后期经费没有出口。⇒ 【建议 · 未落表】给后期经费一个出口（例如院士冲刺阶段的学部报告 / 国际会议花经费换推荐票或名誉），否则「钱」在后期不是资源而是噪声——这与 §18.6 的推荐票改造是同一件事。

### 18.6 推荐票（F12）：从「零成本」改成「节奏约束」

实测：速通 20–30 张、中庸 36–47 张，而院士门槛只需 **3 张**（`RECOMMEND_TICKET_REQ`）→ 推荐票常年非约束。

**裁定：给票真实约束力，但不动院士的 3 张**（SPEC 与 [研究] 锚点）：

1. 【建议 · 未落表】门槛按「错过的增选窗口」递增：所需票数 = 3 + 2 × 已错过窗口数（上限 9）。票是人情，错过一轮就得重新走动；3 张起步与 [研究] 一致。**（t40 更正：该机制保留为「预留」——当前票供给 21–26 张 ≫ 上限 9，它在任何现实玩法下都不会咬人；见 §18.18 裁定 ②）**
2. 【建议 · 未落表】供给端收紧一档：`TICKET_PER_PHD_GRADUATES` 3 → **2**（每 2 名博士毕业 +1 张）；事件「院士来访」（8 万/张）保持不动——它是玩家**主动补票**的口子。
3. 验收：改造后速通 8 局当选时的票数应落在 **[20, 27]**（当前 20–30）；若某局因票额外多等超过 1 个窗口，视为过度收紧。

### 18.7 通关率口径

见 §15.3 红线 2（区间 + 路线定义 + 判别力）与 §18.15（机制与更正记录）。要点：区间 [85%, 95%] **保留**，但支点是**供给节奏 + 一作供给机制**，不是 rank8 门槛；`balanced` 0/8 曾被误标为「随手玩」，已撤回。

### 18.8 三套学生能力分布是**有意为之**（不许顺手统一）

| 来源 | 分布 | 定位 |
|---|---|---|
| 开局自带 | 硕 N(0.60, 0.09)、博 N(0.72, 0.09)（`INITIAL_STUDENT_ABILITY_MEAN_SD`） | 开局有活干、但立刻不够用 |
| 保研生池 | N(0.75, 0.08)（`ABILITY_TRANSLATE_MEAN_SD`） | 最强、最贵（`3 + ability × 8` 万）、门槛最高（reqIF/reqRank）——「抢人」的正反馈 |
| 考研生池 | 90% N(0.53, 0.10) + 10% N(0.85, 0.05)（`ABILITY_EXAM_MEAN_SD`、`ABILITY_DARKHORSE_MEAN_SD`） | 均值最低但便宜（`1 + ability × 4` 万），**10% 黑马**比任何保研生都强——「捡到宝」的记忆点 |
| 挖人事件 | 阈值 `POACHABLE_ABILITY_MIN` 0.85 | 只对最好的人下手，强化稀缺感 |

**算例（开局首 12 个月，证明三套分布有游戏意义）**

- 开局 2 硕 1 博（能力 0.60 / 0.60 / 0.72，均值约 0.64）；亲和系数 0.6 + 0.004 × 60 = 0.84；仪器加成 +0.45 ⇒ 每人约 6.0 × (0.64 / 0.5) × 0.84 × 1.45 ≈ **9.4 进度/月**，三人合计约 **28/月**。接 E2（W 170、8 个月）刚好压线；接 N2（W 300、18 个月）需要 11 个月且不能有未解决难点 ⇒ 玩家在第 1 年就被逼出三个决策：**招人 / 买设备 / 亲带换一作**。
- 若统一成一套 N(0.75, 0.08)：开局三人约 **39/月**，E2 四个月结题、N2 八个月结题；市场第一次开放（第 6 月）时玩家已经不需要人，保研与考研的差异随之失去意义。
- 结论：三套分布是**教学节奏装置**（pacing device），不是数值漂移；任何「统一分布」的改动都会同时削弱开局压力、市场动机与黑马叙事。

### 18.9 测量协议与修订记录

- 探针（交付物之外）：`D:/harness/_t13probe/t13rates.mjs`（8 局通关率）、`t13stock.mjs`（等级与头衔进度）、`shadow.mjs` / `shadowBal.mjs`（新口径阴影账本）、`solo.mjs`（不招兵 / 不亲带对照）、`auditExports.mjs`（文档 ID 与代码导出审计）。
- 命令：`node D:/harness/_t13probe/探针名.mjs`；8 局 × 400 月约 2–4 分钟，建议后台跑。
- 本节数字对应的修订（sha256 前 12 位）：`src/core/engine.js` **775f1c69d4a3**（t22 解耦已落地；t24 一作口径**尚未**落地）、`src/data/ranks.js` **e637efa6526e**、`src/systems/bots.js` **a895a243d913**、`scripts/simulate.mjs` **9534758c2ffa**。
- **复跑要求**：t24 落地后必须重跑 `t13rates.mjs` 与 `shadow*.mjs` 并回填表 18.1 / 18.2；§18.3 的建议值落表后必须重跑 §15.3 红线 1–3。
- **尺子纪律（captain 裁定，t13 确认理解）**：机器人配置（`src/systems/bots.js` 的 `STRATEGIES`）是**测量工具**，不是游戏数值。改动它必须同时满足三条：① 报出**旧配置与新配置两套完整通关率**，好让「游戏改动的影响」与「测量工具改动的影响」能被拆开看；② 改动理由必须引用用户 SPEC（亲带 / 买一作是玩家可用的正规动作），**不得以「让区间好看」为由**；③ 由独立评审与复验（本轮为 t17 / t29）。
- 由此收紧引用规则：**凡引用本节任何通关率数字，都必须同时写明「哪一版 `bots.js` 配置 + 哪一版 `engine.js` 哈希」**；只写百分比不写口径的读数一律视为无效（t13 本轮犯过这个错：把 `balanced` 当成 `casual` 只贴数字）。

### 18.10 新口径 + 解耦后的完整门槛表（裁定 · 待落表）

前提三条：① t24 把晋升门槛改成只计玩家一作（§18.2）；② t22 已把项目市场与招生季解耦（§5.2）；③ t6 的集成验证确认了 T6 硬墙（§18.11）。
下表是 t13 的最终裁定值。落表时 §3.1 的 `RANKS` 表应整体替换为本表（括号内是实现字段名）；**本次只写文档，不动数值常量**。

| 级 | 头衔 | 总 IF (ifReq) | 一区一作 (q1Req) | 二区一作 (q2Req) | 正刊一作 (topReq) | 项目要求 | 硕/博上限 | 校投/年 | 可接最高 (maxProjectTier) | 同时承接 | 黄金年龄 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 副研究员 | 0 | 1（起始库存，非门槛） | 0 | 0 | — | 4 / 1 | 72 | T2 | 2 | — |
| 2 | 研究员 | 30 | 2 | 2 | 0 | T1+ ×1 | 5 / 2 | 120 | T3 | 3 | ≤36 |
| 3 | 副教授 | 80 | 3 | **4**（原 5） | 0 | T2+ ×1 | 6 / 2 | 180 | T4 | 3 | ≤38 |
| 4 | 教授 | 180 | 5 | **8**（原 10） | 0 | T3+ ×1 | 8 / 3 | 240 | T5 | 4 | ≤41 |
| 5 | 优青 / 万人 | 320 | 7 | **12**（原 16） | **1**（原 0） | T4+ ×1 | 9 / 3 | 320 | T6 | 4 | ≤43 |
| 6 | 杰青 / 长江（单有） | 600 | 9 | **16**（原 24） | 1 | **T5+ ×1**（不变） | 10 / 4 | 420 | T6 | 5 | ≤47 |
| 7 | 杰青 + 长江（兼有） | 950 | 12 | **22**（原 34） | **1**（原 2） | **T5+ ×2**（原 T6 ≥1） | 12 / 5 | 560 | T6 | 6 | ≤51 |
| 8 | 院士 | 1400 | 16 | **28**（原 44） | **3**（不变） | **T6 ×1 且 T5+ ×2**（原 T6 ≥2） | 15 / 6 | 760 | T6 | 6 | ≥45 |

逐条依据：

1. **q1 保持**：实测亲带党的一区一作供给 22–92 篇（r8 只需 16 篇），从不构成瓶颈；它在新口径下承担教学职责——rank2 起就要求「一篇自己的」，逼玩家在第一年学会亲带 / 买一作。
2. **q2 下调到原值的 60% 左右**：亲带党的二区一作供给 61–295 篇，原值（5/10/16/24/34/44）**零约束**。下调后「二区」仍是看得见的一条线，但不再诱导玩家把资源投进一个永不会卡住自己的指标。
3. **正刊只在 r7 从 2 降到 1；r8 保持 3**：实测中庸 + 亲带 384 月只自然产出 1 篇正刊（正刊只来自 N6 的 10 篇 PE × 0.02 ≈ 0.2 篇/次结题，或 120 万/篇买）。r8 保留 3 篇，因为「三篇正刊代表作」是院士叙事的核心，且两条供给路径都在（做 N6 / 花钱买），是「要做的事」而不是「不可能」。
4. **项目要求：把「多次旗舰」改成「一次旗舰 + 两次重点」**：r7 由 T6 ≥1 改为 T5+ ≥2，r8 由 T6 ≥2 改为 T6 ×1 且 T5+ ≥2。依据 §18.11 t6 实测（T6 = W 2000 / 48 月 + 342 万仪器，稳健打法终身不接；两次 T6 等于 8 年以上旗舰工期，而一局只有 384 月、还要留两个增选窗口）。改后院士仍必须「主持一次国家重大专项」，硬要求不丢。
5. **其余全部不动**（IF、名额、校投、等级上限、黄金年龄）：实测它们是松弛项（IF 5.4k–7.0k vs 门槛 1.4k），动了只会改变无关体验。
6. **必须同批落表的三件配套**：§18.11 的 N5/N6 经济性修复；§18.4 第 5 条的亲带代价复核；UI 把「一作（你署名）」独立成列（t20 已有 missing 列表，文案需按新口径改写）。

**通关率目标（新口径 + 解耦后，8 局粒度 12.5%）**

| 路线 | 目标区间 | 依据 |
|---|---|---|
| 速通 `speedrun`（亲带高等级 + 买正刊） | **[75%, 100%]**（6/8–8/8） | 旧口径实测 8/8；新口径阴影齐备月 114–166，早于旧口径当选月 144–216 |
| 随手玩（`casual`） | **[85%, 95%]**（7/8–8/8） | t22 解耦后实测 15/16 = 93.8%；**前提**：供给不变式成立 + 一作供给机制成立（`casual` 需会亲带，否则新口径下必然 0–1/8，见 §18.15） |
| 中庸经营（`balanced`，参考线） | 不设红线 | t24 新口径下玩家一作恒为 0 → 必然卡在 rank1–2；只用于监控「一作门槛确实生效」 |
| 失败判定 | 速通 <6/8 或随手玩 ≤3/8 → 判「过难」，按 §18.3 → §18.11 的顺序修 | 两侧可失败，禁止把 0/8 当绿 |

### 18.11 t6 集成验证的评估（含对其 5 条建议的逐条裁定）

**t6 报的数据**：5 组「次优但合理」人类配置 × 8 种子 → 随手玩通关率 5/8 = 62.5%；5 组次优配置 0/8 到达院士；仓库自带 `balanced` 同样 0/8；卡点全部是 rank6→7 的「T6 结题 ≥1」与 rank8 的「≥2」；T6 offer 连续 91 个月 `offerReachable` 为真，但稳健打法从不承接。

**t13 评估**：与我的独立探针一致且互补——我测的 8 局连 T5 都没接（卡在 rank5→6 的 T5+），t6 的次优配置接了 T5、卡在 T6。两条合起来说明**墙有三道：T5+ / T6×1 / T6×2**，而三道墙背后是同一个原因：高等级本子不划算（§18.3 逐项排除表）+ 机器人工期估计过保守。

| t6 建议 | t13 裁定 | 理由 |
|---|---|---|
| ① rank7 `projTierReq` 6→5 | **部分采纳并加码** | 只改 r7 会把墙从 r7 挪到 r8（r8 仍要 T6×2）。裁定：r7 = T5+ ×2、r8 = T6 ×1 且 T5+ ×2（§18.10） |
| ② `N6.workload` 2000→1200~1400 | **采纳，取 1400**（并 `limitMonths` 48→36） | 1400/36 = 38.9 进度/月，4–5 名学生即可按期结题；同时把 N6 的 IF/(W×0.85) 从 0.0885 提到 0.126，落进 §15.3 红线 1 的 T4–T6 新区间，一举解决「接不动」与「不划算」 |
| ③ 改累计量门槛 | **不采纳为主路径** | 累计量（如「T5+ 累计 3 项」）会把「一次旗舰」变回「多次旗舰」，且玩家难以自检进度；只在 §18.3 第 4 条的一次性破格兜底里使用（正刊 ≥2 且 一区 ≥40 且 已结题 ≥120） |
| ④ 修 `bots.js:271-276` 保守工期估计 | **采纳，作为测量工具修复** | 不改游戏，但直接决定我们读到的「通关率」：`estimateMonthlyProgress` 硬编码 1.45 仪器系数（实际可达 1.9）且按 3 人估算，导致 T5/T6 永远被判「来不及」。**修它 = 换尺子**，必须与门槛落表同批做、同批重测 |
| ⑤ 复核被反向断言掉的红线 | **采纳，已完成** | t13 已作废旧红线 85%–95%（§15.3 红线 2 换成两侧区间），并新增红线 6（一作来源结构）与红线 7（硬墙检查）。`tests/balance.test.mjs` 里若有断言旧值，需主程同批更新（t13 只改文档，不动 tests/） |

### 18.12 项目总经费的单调性（t6 转来的第 ① 项）

SPEC 要求「越好的项目给的钱越多」。按 tier 取各类别的最大合同额：

| tier | 国家最高 | 企业最高 | 该 tier 最高额 |
|---|---|---|---|
| 1 | N1 25 万 | E2 30 万 | 30 |
| 2 | N2 50 万 | E3 80 万 | 80 |
| 3 | N3 225 万 | E4 150 万 | 225 |
| 4 | N4 200 万 | — | **200 ← 断点** |
| 5 | N5 400 万 | — | 400 |
| 6 | N6 800 万 | — | 800 |

判定：**T3（225 万）> T4（200 万），违反 SPEC 的单调要求**。根因是 [研究] 的真实锚点本身不单调（国家重点 225 万 > 优青 200 万），而 SPEC 要求游戏内单调。

裁定：**游戏内以 SPEC 为准**，[研究] 锚点只在 §2 留档；本项目标不因真实制度让路。

【建议 · 未落表】`N4.money` 200 → **280 万**（= 优青 200 + 单位配套 80；现实中优青常有单位 1:0.4 配套，属于可解释的设定）。该改动同时缓解 §18.2 第 3 条「新口径下正刊要靠 N4/N6 自然产出」的紧张。等价替代（若非保留 225 万锚点不可）：`N3.money` 225 → **180 万**，但那样会偏离 [研究] 的重点项目锚点，代价更大，故不推荐。

### 18.13 招人死锁中间态（backlog ①）——判定与修法

**现象**：玩家总 IF 已过 rank2 门槛，但**玩家一作**不够 → 卡在副研究员（rank1）→ 候选人的 `reqRank`（= `min(6, 1 + floor(reqIF / 40))`）够不着 → 招不到人 → 没人做项目 → 更攒不出一作，只能等一个低 `reqRank` 的考研生刷出来。

**判定：不是硬死锁，但确实是一个设计缺陷（中间态惩罚）。** 三条逃生口客观存在：① 一作交易台买一篇一区（25 万，开局 200 万就够，诚信 −4）；② 开局自带 2 硕 1 博，可以立刻接 E1/E2 并亲带换一作；③ 招生季的 `MIN_RECRUITABLE_STUDENT_OFFERS = 1` 不变式保证池子里至少挂 1 个够得着的候选人。

**但缺陷在于**：`reqRank` 是**准入硬墙**而不是「给什么名分」。它的数值完全由 `reqIF` 推出（reqIF 40–79 → reqRank 2，80–119 → 3 …），于是出现一类荒谬状态：**一个 IF 上万、经费上千万的 rank1 课题组，招不到一个 reqIF 只有 120 的副教授级候选人**——因为候选人的「名分要求」被当成了「准入门槛」。这既不真实（现实里是「先来干活、名分下次评」），也让 t24 新口径下的 rank1 变成一个玩家不理解的陷阱。

**修法（裁定）**：把 `reqRank` 从准入判定里拿出来，只用于决定「入职头衔与工资档」；准入只看 `reqIF` 与招募成本。实现上等价于把 `canRecruitOffer` 的 rank 条件改成 `candidate.reqRank <= player.rankIndex + 1`（允许高一级），或直接删掉 rank 条件、保留 IF 条件。

【建议 · 未落表】具体落表项：

1. `src/core/rules.js` 的 `recruitReachable` / `canRecruitOffer`：`reqRank` 不再参与「能不能招」，改为参数字段 `titleReq`（用于 UI 展示「他要副教授名分」）。
2. 保留 `reqIF` 作为唯一硬门槛（组内总 IF），并对 rank1 额外允许 `reqRank <= 2` 的候选人（避免开局空池）。
3. 若评审坚持保留 rank 门槛，则等价修法是给 rank1 一条「降格录取」：招募成本 ×2，可招 `reqRank = 当前等级 + 1` 的候选人，并在 UI 上写明「先来干活，名分明年给」。
4. 验收：新口径下「总 IF ≥ rank2 门槛但玩家一作不足」的存档，在招生季内必须能招到 ≥1 名候选人（当前会 0 名）。

### 18.14 推荐票：裁定摘要（backlog ②，细化 §18.6）

**事实**：实测通关局票数 19–30 张（中庸路线 36–47 张），院士门槛只要 3 张（`RECOMMEND_TICKET_REQ`）→ 票机制当前纯叙事，且 IF 首达与当选之间的滞后（8–158 月）与票数无关（瓶颈是 T6 结题 + 24 月窗口）。

**裁定：给真实约束力，但不提高「第一次冲刺」的票价。** 选「约束力」而非「降权」的理由：院士增选[研究]本来就是「不受理个人申请、需要推荐」的流程，票是这套流程在游戏里唯一的具体化；砍掉它，事件「院士来访」（8 万/张）与「人际关系」这条支线就同时失去意义。

【建议 · 未落表】

1. `RECOMMEND_TICKET_REQ` 3 → **按错过窗口递增**：`3 + 2 × 已错过窗口数`，上限 9。
2. 供给端收紧一档：`TICKET_PER_PHD_GRADUATES` 3 → 2；`TICKET_PER_T5` 1、`TICKET_PER_T6` 2 不动（它们是「做旗舰项目」的回报，应保持）。
3. 验收：改造后速通 8 局当选时票数落在 **[20, 27]**；中庸路线落在 **[35, 50]**。任一路线因票额外多等 >1 个窗口 → 过度收紧，回退到 `3 + 1 × 错过数`。
4. 若 t28 全路线重测显示票数普遍低于 6 张（说明供给端本来就紧），则本改造降级为「降权」：维持 3 张不变，把 §18.6 的条目改为纯叙事。**判定依据以 t28 数据为准，不靠推理。**

### 18.15 更正记录：区间 [50%, 75%] 撤回；机制是「一作供给悬崖」

**被撤回的内容**：§15.3 红线 2 与 §18.10 曾把「随手玩」写成 `--strategy=balanced` 并给出 **[50%, 75%]**。这是**口径写错**导致的错误结论：

- 仓库里「随手玩」是 `casual`（`src/systems/bots.js:53-71`，label 就是「随手玩」）；`balanced` 是「中庸经营」，是另一条路线。
- 我测到的 `balanced` 0/8 被误当成「随手玩」；它 0/8 的真实原因是该配置 `usePlayerLead:false` 且 `buyFirstAuthorMax:0`——**不亲带也不买一作**，在 t24 新口径下玩家一作恒为 0。
- t22 实测「随手玩」（`casual`）15/16 = 93.8%，与 `balanced` 0/8 并不矛盾：两条不同路线。

**机制结论（回答「93.8% 会被哪一条改动拉下来、拉低多少」）**：唯一能把 93.8% 拉下来的是 **t24 的一作口径**，而且它不是「拉低」，是**悬崖**：

1. 一作门槛是**层级式绝对篇数**（rank2 起每一级都要 q1 / q2 / top 的具体篇数）；新口径下玩家一作的供给只有三条路：亲带 / 抢 / 买。
2. `casual` 当前配置 `usePlayerLead:false`、`buyFirstAuthorMax:0` ⇒ 供给 = 0 ⇒ **rank2 都过不去**（需 2 篇，起始库存 1）⇒ 通关率 93.8% → **0–12.5%（0–1/8）**。给再多 IF、再多结题都补不回来，所以表现为悬崖而不是坡。
3. t30 的四条改动（N5/N6 效率、耗材、N6 工期、门槛项目要求放宽）方向**全是抬高通关率**，没有一条拉低它。
4. 若 t30 同时让 `casual` 亲带（应当做——否则机器人不代表「会玩的普通玩家」），产出侧几乎不变（亲带只影响该项目进度 ×0.85 与 1 精力/月，不改 IF 与结题数）⇒ 通关率**维持 [85%, 95%]**。

**修正后的红线**：随手玩 **[85%, 95%]**，且必须与两条前置条件**同批**测量（否则区间无意义）：

1. **供给不变式**：任一月份可承接项目 offer ≥ 1；招生季可招候选人 ≥ 1；滚动 12 个月内新增「可承接」项目 offer ≥ **21**（**绝对值**，推导见 §18.18 裁定 ①；旧写法「名义供给率 × 0.85」作废）。
2. **一作供给机制成立**：亲带可规模化产出玩家一作，且至少一条交易路径（买一作）可用；用 §15.3 红线 6（一作来源结构：亲带 ≥ 60%）监控。

**若 t30 落地后实测 > 75%（含维持 93.8%）的判定顺序（明确表态）**：

1. 一作供给机制与供给不变式都成立 → **区间就是对的**，红线通过；既不修区间、也不修门槛（上一版 [50%, 75%] 作废）。
2. 实测 > 75% 但一作口径其实没生效（例如 t24 未真正接线、玩家一作仍等于全组论文）→ **先修实现**，区间保持 [85%, 95%]。
3. 只有当实测 < 85% **且**两条前置条件都成立时，才轮到修数值，顺序固定：**一作供给链（亲带代价 / `casual` 配置）→ N5/N6 经济性 → 最后才是门槛**。
4. **绝不为贴合区间调高门槛**：门槛只因「实测证明它挡不住人」而下调，不因「想让区间好看」而上调。

### 18.16 t25 常量登记 + 手工/一键分配的不对称裁定（t32 补办）

#### 登记：`PROJECT_MAX_STUDENTS = 6`（`data/hardpoints.js:18`）

| 常量 | 取值 | 含义 | 读取方 | 来源 |
|---|---|---|---|---|
| `PROJECT_MAX_STUDENTS` | 6 | **单个在研项目的人数上限** | **只被一键分配读**：`core/engine.js` 的 `autoAssignPlan()`（1135 行过滤、1163 行回显 `cap`、1221 行应用）与 UI 透传（`selectors` 的 `projectCap`）；**手工分配 `reduceAssign()`（1231 行）不读** | [策划]（t25 新增） |
| `MAX_PROJECTS_PER_STUDENT` | 3 | 单名学生最多同时负责的在研项目数 | `reduceAssign()`（1238 行）、`autoAssignPlan()`（1139 行）、`engine.js:1088` 的挑人逻辑 | [策划] |

#### 裁定 1：手工与一键应当统一到同一不变式（**建议 · 未落表，交主理人派工**）

**现状不对称**：一键分配受 6 人上限约束，手工分配可以往同一个项目堆任意多人（只要每人不超 3 个项目）。

**裁定：这是缺陷，应当统一——手工分配也读 `PROJECT_MAX_STUDENTS`。** 理由：

1. **两套规则破坏测量口径**：平衡测量用的机器人走一键路径、人类玩家走手工路径；同一份「游戏」出现两套能力边界，实测通关率与玩家体验就没有可比性（§18.9 尺子纪律的同一逻辑）。
2. **上限是设计语言的一部分**：`rank` 名额（开局 4 硕 1 博、院士 15 硕 6 博）与「同时承接上限」都建立在「人是有上限的资源」上；单项目 6 人是这套语言的一环。
3. 修法（不改 src，建议由主理人派工）：`reduceAssign()` 的 assign 分支在 `st.projectIds.length` 之外再加一条 `project.assignedStudentIds.length >= PROJECT_MAX_STUDENTS` 判定，并在 UI 上给出与一键一致的 toast 文案（上限值取 `selectors` 已透传的 `projectCap`，UI 不写死 6）。

**顺带评估「全部学生堆一个项目」是不是支配策略：不是。** 两条独立理由：

- **摊薄**：每名学生最多只能同时在 3 个项目上（`MAX_PROJECTS_PER_STUDENT`），把全组堆到一个项目上，等于让每个人只发挥 1/3 的可用名额，全组在研项目数被压到 1，结题速度与论文总量都下降；而晋升门槛同时要**论文篇数**（一作台账）与**结题项目等级/数量**（T6×1 且 T5+×2），单一项目堆人拿不到广度。
- **惩罚机制**：项目逾期后尾款 ×0.80、每月诚信 −1、逾期 >12 个月直接失败（−5 诚信）；「多人攻坚」还会抽掉其他项目的进度（`TEAM_OTHER_PROJECT_MUL`）。堆人堆出来的速度红利会被逾期与挪用吃掉。

> **状态（t30 已落地 / t43 更新）**：**已修**。`core/formulas.js` 的 `studentBaseProgress(student, project, ctx)` 现在接收 `ctx`，引擎每月只算一份 `projectLoadByStudent`，把学生月产出按其在研项目数**均分**（产出守恒）；t30 同批重测了通关率。以下原文保留为历史记录。
>
> 配套机制：与之互补的「多项目幸福度惩罚」（人心会累）见 §8.3 与 GDD §6.3（t42 B 方案）。

#### 裁定 2（历史）：GDD 写「产出守恒（按项目数均分）」，实现是「按（学生 × 项目）对数各给全额」——**以 GDD 为准，实现待修**

**证据（读代码即可复现，无需运行）**：

| 位置 | 内容 |
|---|---|
| `docs/GDD.md:372-380`（§5.3） | 「学生分给每个项目的进度 = P(student) / 该生被指派的项目数（**产出守恒，不是复制**）」 |
| `src/core/formulas.js:114-118` | `studentBaseProgress(student, project)` 只吃 `(student, project)`，**签名里根本没有「该生被指派了几个项目」**，所以不可能做除法 |
| `src/core/engine.js:339-346` | 在**按项目**的循环里，对每个指派学生累加 `studentBaseProgress(st, project) * mul` ⇒ 同一名学生挂 3 个项目就拿 3 份全额产出 |

**影响**：实现口径下「把每名学生塞满 3 个项目」是**严格支配**操作（产出 ×3、无额外代价），而 GDD 的守恒制下分配才是**零和的取舍**——这直接决定「多接项目」是策略还是免费午餐，也决定所有通关率读数的含义。

【建议 · 未落表，交主理人派工】以 GDD 为准，把 `engine.js` 的月进度累加改成先取 `P(st) / st.projectIds.length` 再乘 `mul`（或等价地在 `studentBaseProgress` 传入该生当前项目数）。注意三点连带：

1. 改完**所有通关率必须复跑**（守恒制下全组产能会降到 1/3–1，384 月的可达性需要重新标定），这条应与 t30 的落表同批做；
2. `MAX_PROJECTS_PER_STUDENT = 3` 在守恒制下不再是「免费 ×3」，它的作用回到设计本意：**允许一名学生在多个项目间分摊，而不是复制**；
3. 若主理人反过来裁定「实现是对的、GDD 该改」，则必须同时接受「人均 3 项目 = 3 倍产出」这一前提，并重新标定 384 月的难度曲线（我建议不要走这条，因为它取消了「分配」的取舍）。
### 18.17 年龄门槛加成裁定：**正式取消**（t37，含替代设计 backlog）

**事实（可复跑）**

| 项 | 现状 | 证据 |
|---|---|---|
| 年龄与退休 | 起点 33 岁、65 岁退休、`RETIRE_MONTH = 384` | `src/data/tuning.js:47-48` + `RETIRE_MONTH` |
| 原设计的生效窗口 | ×1.15 → 第 324–383 月（60–64 岁）；×1.40 → **无窗口**（第 384 月即退休月） | GDD §3.3 原文 + `RETIRE_MONTH` |
| 实现现状（t28） | 三常量 `GOLDEN_AGE_INTEGRITY_BONUS` / `AGE_IF_MUL_60` / `AGE_IF_MUL_65` **已从 `src/data/ranks.js` 导出中删除**（`import` 取到 `undefined`），只在源码注释保留删除理由 | 实测：`ranks.js` 导入三者均为 undefined；`core/engine.js` 对 `AGE_IF_MUL`、`GOLDEN_AGE_INTEGRITY` 的引用次数 = **0** |
| 仍在生效的年龄机制 | `GOLDEN_AGE_MONEY_MUL`（窗口内晋升 → 经费 += 该级校投 ×0.4）+ 每级 `goldenAge` 窗口 | `engine.js` 引用 `GOLDEN_AGE_MONEY_MUL` 2 处；`ranks.js` 的 `goldenAge` 9 处 |

**裁定：正式取消，不复活。** 三条机制理由：

1. **×1.40 结构上不可达**：生效月恰好是退休月（第 384 月结算即进退休结局），没有任何可结算的窗口。
2. **×1.15 是「鞭打落后者」且无可对冲手段**：玩家 60 岁时能做的决策与 40 岁完全相同（多出论文、多接项目），门槛却反过来抬高 15%。它不产生新选择，只把「差一点」变成「更差」，违反本作「失败要能归因到某个决策」的原则（与 §18.15 判定 [50,75] 区间时用的是同一条逻辑）。它还会让测量失真：只会压掉尾部样本，不改变任何策略。
3. **年龄压力并未缺失**，已由三条生效机制承担：① 每级 `goldenAge` 窗口内晋升奖励（经费 += 校投 ×0.4、诚信 +2）；② 一局 384 月硬上限（65 岁退休结局）；③ 起点 33 岁 —— 一局只有 32 年。取消加成不丢设计意图。

**替代设计（backlog · 未落表 · 需主理人派工）** —— 若将来要恢复年龄压力，正确形态是**人才计划年龄开窗**，而不是门槛惩罚：

- 内容：rank5（优青 / 万人）**≤38 岁**、rank6（杰青 / 长江单有）**≤45 岁**作为**入场券**（错过即该级不可达），但保留「杰青或长江任一可达」的替代路径；rank7 / rank8 不设年龄线（院士仍只需 45 岁 + 推荐票）。
- 依据：[研究] 有 [A] 级来源（青年 C ≤35、优青 ≤38、杰青 ≤45、长江 ≤45）。这比「60 岁门槛 ×1.15」更贴近现实，也更有决策价值（玩家必须提前规划资源去赶窗口）。
- 风险量化（**必须先实测再落地**）：当前速通 8 局的 rank6 达标月 114–166（对应年龄 43–47）、中庸 + 亲带 126–160 ⇒ 45 岁入场券会掐掉约 1/3 的速通样本与全部中庸样本，速通通关率可能跌破 §15.3 红线 2 的下界（75%）。**因此该设计必须与 t30 的门槛落表同批实测，不得单独落地。**

> **归属说明**：`docs/VERIFICATION.md` 的 M1 条目（死常量）是项目总监的产物，由 t29 复验时更新；t37 只同步 GDD / BALANCE，不动那份文件。

### 18.18 t40 三项验收冲突的裁定（供给不变式 / 推荐票 / balanced 打法）

#### 裁定 ① 供给不变式：**绝对常量 = 21 个 / 12 个月**（保留 slots7 / TTL3，casual 93.8%）

**先修正一处定性**：`tests/market.test.mjs:180` 的 `nominal` 取自常量（`(PROJECT_SLOTS − 1) / PROJECT_OFFER_TTL_MONTHS × 12` = 6/3 × 12 = **24**），不是取自实测样本 —— 严格说它不是「自证」。但它有两个**真实缺陷**：① **与被测参数耦合**：`PROJECT_SLOTS` / TTL 一改，红线自动跟着改，等于「调参数顺便调红线」；② 用**百分比**而非**绝对个数**表述，判别力随参数漂移，也无法一眼看出「一年至少承诺给玩家几个本子」。

**裁定：下界写成绝对值 21。** 推导（全部来自设计参数与事先预算，与实测无关）：

```
名义供给 = (PROJECT_SLOTS − 1) / PROJECT_OFFER_TTL_MONTHS × 12 = (7 − 1) / 3 × 12 = 24 个/年
          // 减 1：给「看得见目标」的不可承接本子预留一席
漏刷预算 = 1/8 = 12.5%   // 事先批准：TTL=3 与月刷新的相位损失 + 玩家锁定 offer 占席 + 取整
绝对下界 = 24 × 7/8 = 21 个 / 12 个月
```

**为什么接受 21、不接受 24**：

1. **不变式的职能是防饿死 + 防慢性饥饿，不是维持吞吐量。** 需求侧上界：任何头衔的同时承接上限是 2–6 个（rank1 2 → rank8 6），一局 384 月。21 个/年 ≈ **1.75 个/月**，是承接上限的 3–9 倍 —— 不会被「有本子但接不完」卡住。
2. **21 与 24 不改变任何玩家决策，但 24 会把红线永久点亮。** 永远红 = 没有判别力的噪音，还会诱导后人「为了让红线变绿」去加供给 —— 这正是我们禁止的「为指标而调参」的反向版本。
3. **21 必须是绝对常量、不得由实测推导。** 实测 21 是**结论**（说明当前参数正好压在事先预算的下界上、**零余量**），不是下界的来源。改 `PROJECT_SLOTS` / TTL 后**必须显式改这个常量并说明理由** —— 红线与参数解耦，符合 §18.9 尺子纪律。
4. 【建议 · 未落表】零余量本身是风险：任何再吃掉一个席位的改动都会点亮红线。要留余量应加 `REFRESH_MONTHLY` 或 `PROJECT_SLOTS`（实测 slots7/TTL2 与 slots8/TTL3 都能到 24，但会把 casual 顶到 100%、与 §15.3 红线 2 的 [85%, 95%] 冲突）。**主理人已裁定「区间优先」，故本轮保留零余量**，取舍登记备查。

**两段式不变式（新规范）**

| 级别 | 内容 | 值 | 性质 |
|---|---|---|---|
| 逐月 | 任一月「可承接」项目 offer 数 ≥ `MIN_ACCEPTABLE_PROJECT_OFFERS` | **1** | 既有常量（§5.2） |
| 逐月 | 任一月「可招手」候选人 ≥ `MIN_RECRUITABLE_STUDENT_OFFERS` | **1** | 既有常量（§5.2） |
| 滚动 12 月 | 新增「可承接」项目 offer ≥ **21** | **21** | **新增绝对常量**（t40 定稿；旧写法 `nominal × 0.85` 作废） |

#### 裁定 ② 推荐票：**正式承认当前为非约束资源**；验收区间改实测口径 [20, 27]；递增门槛保留为预留机制

**数据（t30 实测）**：速通 8 局当选票数 **21–26**，构成 = 博士毕业票 9–10（`TICKET_PER_PHD_GRADUATES` 2 ⇒ 每 2 名博士 +1 张）+ T5/T6 票 12–17。

**为什么不做 (a) 把票变成硬约束**：

1. **只会增加等待、不增加决策**：票的两条主要来源（博士毕业数、旗舰项目数）**本来就是** rank6/7/8 的门槛（T5+×2、T6×1、q1/q2/top 篇数）。压低票产值 = 对同一批行为二次收费，玩家唯一的新决策是「再多等一个 24 月增选窗口」—— 纯惩罚式节奏。
2. **直接压低通关率**，与本轮刚落地的基线冲突：每次多等 24 月，速通从 6/8–8/8 往下掉，而 §15.3 红线 2 的下界（75%）刚校准。
3. **递进机制在当前供给下根本不咬人**（必须纠正的说法）：门槛 = 3 + 2×错过窗口、上限 9，而票数 21–26 ⇒ 要咬人需要**错过 ≥ 4 个增选窗口**。所以「票只在反复错过窗口时起作用」在数字上不成立，不能这么写进文档（否则又是一条被反向断言掉的红线，t6 的教训）。

**裁定**：

1. §18.14 与 §18.6 的验收区间由 **[10, 20]** 改为 **实测口径 [20, 27]**（速通 8 局 21–26，留 1 张余量）；中庸路线由 [20, 35] 改为 **[35, 50]**（实测 36–47）。
2. 票的定位写明：**结局展示 + 叙事资源**（「人情」），当前**不构成晋升约束**；`RECOMMEND_TICKET_REQ = 3` 与「3 + 2×错过窗口（上限 9）」保留为**预留机制**。
3. 【backlog · 未落表 · 需派工】唯一能把票变成真约束的方案与代价：`TICKET_PER_T5` 1→0、`TICKET_PER_T6` 2→1、`TICKET_PER_PHD_GRADUATES` 2→1 ⇒ 速通票数落到约 **5–8**，递进门槛会在「错过 2 个窗口」时咬人（3+2×2=7）。代价：院士路径至少多等一个 24 月窗口，**必须与门槛同批实测通关率**（预计速通 −1/8 至 −2/8）。本轮不改。

#### 裁定 ③ balanced 打法的 0/8：**不是「稳健打法的设计深度」，是「无解打法」配置 —— 定位为负面对照（negative control）**

**先纠正一处事实**：`src/systems/bots.js:79-95` 的 `balanced` 至今仍是 `usePlayerLead: false` + `buyFirstAuthorMax: 0` —— **补一作供给的改动打在 `speedrun` / `casual` 上（:41-49、:66-75），balanced 没有被补**。即「配置补上供给后仍全 retire」的前提与实现不符：balanced 是**仍然零一作供给**的配置。

**裁定**：0/8 是**期望值**，因为它不是「稳健」而是**无解**：

1. v2 规则下「不亲带 + 不抢 + 不买」数学上等价于「玩家一作恒为 0」，而 rank2 起就要求 q1 ≥ 2 ⇒ **rank2 都不可达**，与难度无关。任何合规打法必须至少用一条一作来源（亲带 / 抢 / 买）。
2. 「稳健玩家无法通关」的说法**不成立**：`casual`（随手玩）本身就是「正常消耗、不抢不买、不做极限运营」的保守配置，t30 补上供给后实测 **15/16 = 93.8%**。
3. 因此 balanced 明确登记为**负面对照**：它**必须永远 0/8**；若某天它 > 0/8，说明一作门槛失效了 —— 这正是它作为尺子的价值（已写进 §15.3 红线 2 路线表）。
4. 【建议 · 未落表】目前**缺一条「保守但合规」的对照配置**（例：只亲带 T4+ 项目、不抢、买 ≤1 篇）。这是**测量工具的缺口**而非游戏缺陷，需派工补上并同批实测；在补上之前，不要用 balanced 的 0/8 论证「游戏只奖励速通流派」。
5. 若将来要让保守玩法更容易通关，正确做法是**降低亲带代价**（`PLAYER_LEAD_MUL` 0.85 → 0.92 或 `PLAYER_LEAD_ENERGY_COST` 1 → 0.5/月，见 §18.4 第 5 条），**不是放宽门槛**。

#### 被更正的原文位置（t40）

| 位置 | 原文 | 现文 |
|---|---|---|
| §5.2 `PROJECT_SLOTS` | 5 | **7**（t30 落表；旧值 5 的语义见该节作废注） |
| §5.2 `PROJECT_OFFER_TTL_MONTHS` | 6 月 | **3 月** |
| §5.2 `MARKET_SLOTS` | 8 | **10**（= 7 + 3，UI 分母随之） |
| §5.2 不变式段 | 只有逐月 ≥1 | 增补「滚动 12 月 ≥ **21**（绝对常量）」 |
| §18.6 第 1 条 | 未验证的「票只在反复错过窗口时起作用」 | 明确为**预留机制**，并说明当前不咬人（21–26 ≫ 上限 9） |
| §18.6 第 3 条 / §18.14 第 3 条 | 验收 **[10, 20]** / 中庸 [20, 35] | **[20, 27]** / **[35, 50]**（实测口径） |
| §18.15 第 1 条 | 「12 个月内新增项目 offer ≥ 24」 | **≥ 21**（绝对常量，见裁定 ①） |
| §15.3 红线 2 路线表 balanced 行 | 「不亲带就上不去是设计意图」 | 改为**负面对照（无解打法）** + 「它 >0/8 即说明一作门槛失效」的判别语义 |
| `tests/market.test.mjs:163-183`（实现侧，只报告） | `newReach >= nominal * 0.85`（与被测参数耦合） | 建议改为 `newReach >= SUPPLY_FLOOR_12M(=21)`；**t41 已落地**：常量落在 `src/data/projects.js`，`tests/market.test.mjs` 改为 import 它（不再由 slots/TTL 反推），并做了负向对照 |

### 18.19 t43 数值校准决策 + 已知限制清单（未经真人验证）

#### A. 决策：数值校准由**真人试玩**决定（用户裁定，t43 登记）

- **内容**：**停止一切「用 AI 机器人测通关率」的平衡工作**。没有严重 bug 就直接发布；数值（含门槛与通关率区间）由**真人试玩之后再定**。
- **用户给出的理由（原样登记）**：机器人打法与真人不同，**用它当门槛是浪费资源**。
- **三条直接后果**（避免后人误读成「红线全废」）：
  1. §15.3 红线 2 的通关率区间**降级为信息性参考**，不再是发布门禁；引用时必须标注「机器人读数，非真人」。
  2. t42 起 `tests/` 里所有机器人通关率 / 停滞 / 结题数 / 路线结局类断言已改为 **【信息性·非门禁】** 输出；`check.mjs` 第 12 项改为「禁止通关率门禁 + 要求保留信息性标记」。
  3. **仍然保留的门禁（不因本决策放宽）**：数据性质、门槛数值钉住、存档往返、产出守恒、市场不变式（逐月 ≥1 与滚动 12 月 ≥21）、抢/买/亲带恰好 +1、断崖报警、命名质量、DOM / data-action 契约。
- **与 §18.9 尺子纪律的关系**：尺子纪律**不废止**。它今后约束的是**真人测试协议**（记录版本、留痕、独立复验），而不是机器人读数；本决策只改「谁来定数」，不改「改尺子要留痕」。

#### B. 已知限制清单（逐条状态：**未经真人验证，待真人试玩后重议**）

| # | 限制 | 现状与影响（截至 t43） | 状态 |
|---|---|---|---|
| L1 | **通关率区间的适用性**（§15.3 红线 2 / §18.15） | `casual [85%,95%]`、`speedrun [75%,100%]` 全部来自 AI 机器人；样本粒度 16 局 6.25% / 8 局 12.5%；**不代表真人打法** | 未经真人验证，待重议 |
| L2 | **F1：通关率红线依赖种子族** | 同一段代码换种子族，读数会整体位移；当前只用固定种子的 8 / 16 局 | 同上 |
| L3 | **F2：推荐票区间无断言覆盖 + 取帧口径差** | §18.14 的 `[20, 27]` / `[35, 50]` 只是文档口径，**没有任何测试断言**；且「当选时票数」与「IF 首达时票数」不是同一帧，差额未量化 | 同上 |
| L4 | **F3：招生季首月空池** | 招生季首月可能出现候选人池为空（不变式只在赛季内的刷新点兜底） | 同上 |
| L5 | **F4：供给常量零余量** | `SUPPLY_FLOOR_12M = 21` 与实测 21 恰好相等 —— 任何再吃掉一个席位的改动都会点亮它（现为信息性） | 同上 |
| L6 | **`conservative`（保守经营）是未定稿的尺子，不是难度档位** | 启动段自锁：`leadMinTier = 4` ⇒ 拿不到一作 ⇒ 上不了 rank3 ⇒ 开不了 T4+ 亲带 ⇒ 一作恒 0（实测 0/8 全 retire）。架构师已在 `docs/CONTRACT.md` §9「测量脚手架与统计红线」登记其定位 | 同上 |

> **使用规则**：以上六条**不得**被当作调数值的依据，发布前也**不要**再深挖（用户已明确停止此类平衡工作）。真人试玩之后按「先修实现缺陷 → 再谈数值」的顺序重议。
> **L6 补充（防误读）**：`conservative` 是**测量配置**，玩家在游戏里看不到它，**它不构成「难度档位」**；`0/8` 只说明这把尺子没定稿，**不说明保守玩法不可行**（保守但合规的玩家读数是 `casual`）。

#### C. 本轮明确不做的事（边界）

不重估通关率、不裁定 F1 / F2 / F3、不给 `conservative` 的 bootstrap 规格、不改任何门槛数值 —— 全部留待真人试玩后重议。

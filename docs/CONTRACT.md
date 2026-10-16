# 接口契约（FROZEN v1，对应 package.json 0.1.0）

> 本文件是**冻结契约**：src/data 的数据形状、src/core 暴露给 UI 的 API、src/ui 必须实现的视图与 DOM 钩子、事件与存档格式，全部以本文件为准。
> 改契约 = 先改本文件 + docs/CHANGELOG.md，再改代码；不允许「代码就是文档」。契约版本号 = STATE_VERSION（src/core/state.js）= **2**
> （t24：一作归属模型变更 v1→v2 —— player.papers 由「课题组全部产出」收窄为「玩家一作的论文数」，
>  迁移 MIGRATIONS[1] 见 §5；历史：t18 修文字时的版本号是 1）。

---

## 0. 分层与依赖方向（只允许箭头方向）

    src/data/    纯常量与纯数据（零 import、零逻辑、零随机）
      ↓ 只能被下面引用
    src/core/    状态、规则、reducer（不碰 DOM、不读 localStorage）
      ↓
    src/ui/      渲染与交互（只读 state，只能 dispatch）
      ↓
    src/main.js  装配 store + UI + 存档（唯一副作用汇聚点）

| 约束 | 检查方式 |
|---|---|
| src/data/** 不许 import 任何东西 | scripts/check.mjs（数据纯度） |
| src/core/** 不许 Math.random() / Date.now()（白名单见脚本）/ 不许用 DOM | scripts/check.mjs（确定性） |
| src/ui/** 不许 import src/data/** 或 src/core/formulas.js | 代码评审；UI 只从 core/viewmodel.js 取数 |
| UI 不许直接改 state | 只能 store.dispatch / store.actions.X() |
| 所有 $('id') 必须在 index.html 里存在 | scripts/check.mjs（DOM 契约） |
| 所有 data-action 必须在 app.js 的 HANDLERS 里注册 | scripts/check.mjs（交互契约） |

---

## 1. src/data/ 数据文件契约

单位约定：**金额 = 万元**、**影响因子 = IF 点**、**时间 = 月**、**比率 = 无量纲小数**。

### 1.1 tuning.js —— 全局常量

导出：INITIAL_MONEY INITIAL_CONSUMABLE INITIAL_INTEGRITY INITIAL_HEALTH INITIAL_TOTAL_IF
INITIAL_FIRST_Q1/Q2/Q3/Q4/TOP INITIAL_RECOMMEND_TICKETS INITIAL_MASTER_COUNT INITIAL_PHD_COUNT
INTEGRITY_MIN/MAX HEALTH_MAX HEALTH_DECAY_PER_MONTH ENERGY_MAX_BASE ENERGY_PER_HEALTH_10
ENERGY_LOW_HEALTH_THRESHOLD ENERGY_LOW_HEALTH_MUL ENERGY_CARRYOVER ENERGY_MAX_SOURCE
MONTHS_PER_YEAR START_AGE_YEARS RETIRE_AGE_YEARS RETIRE_MONTH MAX_MONTHS
CONSUME_MODES CONSUME_MODE_ORDER DEFAULT_CONSUME_MODE
CONSUMABLE_PRICE_PER_UNIT CONSUMABLE_BUY_PACK CONSUMABLE_LOW_THRESHOLD
RANDOM_EVENTS_PER_MONTH_MIN/MAX BANKRUPT_NEGATIVE_MONTHS LAB_EMPTY_THRESHOLD
SAVE_SLOT_KEY SAVE_APP_ID AUTOSAVE_ON_MONTH_END INTEGRITY_DELTA PHASE_LABELS PHASE_ORDER
FIRST_AUTHOR_DROUGHT_MONTHS

关键形状：

    CONSUME_MODES = { free|normal|tight: { id, label, hint, consumeMul, progressMul, happyDelta } }
    INTEGRITY_DELTA = { grabFirst:-8, buyFirst:-4, fake:-10, fakeCaught:-25, divert:-3, audit:-15,
                        extreme:-50, finishProject:2, finishEnterprise:1, graduate:3, promote:2,
                        noWage:-2, overdue:-1, projectFail:-5, giveUpStudent:-2 }
    PHASE_ORDER = ['action','settle','ended']
    FIRST_AUTHOR_DROUGHT_MONTHS = 24   // 一作空窗阈值（月）：距最近一次拿到「玩家署名一作」超过它就置
                                       //   hud.firstAuthorDrought.stuck = true（core 判定，UI 只渲染；t30）

### 1.2 ranks.js —— 八级头衔

导出：RANKS（下标 1..8，RANKS[0]=null） MAX_RANK_INDEX rankOf(index) PROMOTE_INTEGRITY_BONUS
GOLDEN_AGE_MONEY_MUL MIN_ACADEMICIAN_AGE
ELECTION_WINDOW_INTERVAL ELECTION_WINDOW_START RECOMMEND_TICKET_REQ TICKET_PER_T6 TICKET_PER_T5
TICKET_PER_PHD_GRADUATES TICKET_VISIT_COST

> ⚠ 2026-10 修订（t33 复核发现、t37 定案）：`GOLDEN_AGE_INTEGRITY_BONUS`、`AGE_IF_MUL_60`、`AGE_IF_MUL_65`
> **已从 src/data/ranks.js 删除**（它们从未被 core 读取；t28 移除，t37 **正式取消该设计**——
> 65 岁 = 第 384 月 = 退休月，×1.40 结构上无生效窗口；×1.15 只鞭打落后者，理由与替代设计见 BALANCE §18.17），
> 故本表不再列它们。若将来要重新接线，必须**三步齐做**：加回常量 → engine 里真读 → 回填本表与 BALANCE
> （并写明为何推翻 t37 的裁定）。
> 另：`GOLDEN_AGE_MONEY_MUL`（0.40）**仍在且生效**（engine.js:300 的黄金年龄经费加成），不要误删。

    Rank = { index, id, title, ifReq, q1Req, q2Req, topReq, projTierReq, projCountReq,
             masterCap, phdCap, schoolFundYear, maxProjectTier, concurrentCap, goldenAge|null, note? }

rankOf(i) 会把越界值夹到 1..8；任何地方都不要自己写 RANKS[i-1]。

### 1.3 instruments.js —— 8 种仪器

导出：INSTRUMENTS INSTRUMENT_MAP INSTRUMENT_IDS INST_PRICE_GROWTH INST_HOLD_CAP
（v1.3 起 INST_BONUS_CAP 已删除：仪器加成不再封顶）
INST_COEF_BASE START_INST_BONUS TEMP_BROKEN_BONUS_MUL

    Instrument = { id, name, tier:'minor'|'major', tierLabel, bonus, initCount, price, maintain, tierGate, holdCap }

- initCount 是**开局持有数**：离心机 1 / 摇床 1 / 液相 1 / 质谱 0 / 超净台 2 / 酶标仪 0 / 气相 0 / 水浴锅 1。
  这批设备的加成合 = START_INST_BONUS（0.45），属于初始科研效率。
- 第 n 台价格 = price × INST_PRICE_GROWTH^(n-1)，n = 已持有数（用 formulas.instrumentPrice 取，不要自己算）。

### 1.4 projects.js —— 10 个项目模板 + 市场规则

导出：PROJECTS PROJECT_MAP PROJECT_IDS DEPOSIT_RATE MARKET_SLOTS REFRESH_MONTHLY LOCKABLE_SLOTS
PROJECT_SLOTS STUDENT_SLOTS PROJECT_OFFER_TTL_MONTHS STUDENT_OFFER_TTL_MONTHS
MIN_ACCEPTABLE_PROJECT_OFFERS **SUPPLY_FLOOR_12M** TIER_LOOKAHEAD NATION_PROJECT_RATIO DEPOSIT_TO_CONSUMABLE TRANSFER_RATE
UNDERDUE_TAIL_MUL PER_HARDPOINT_TAIL_MUL OVERDUE_GRACE_MONTHS OVERDUE_INTEGRITY_PER_MONTH
OVERDUE_STUDENT_HAPPY PROJECT_FAIL_INTEGRITY PROJECT_FAIL_STUDENT_HAPPY

    ProjectDef = { id, name, category:'enterprise'|'nation', tier, workload, limitMonths, money,
                   depositRate, consumablePerMonth, papers:string[], require:{instrumentId:number},
                   expectedIF, q1Expect, topExpect, hint }

papers 是论文槽位模板 id 序列（见 1.5），例如 N2.papers = ['PB','PB','PC','PC','PD','PD','PD']。

**市场席位（2026-10 修订：项目与学生各自独立配额，不再抢同一个 MARKET_SLOTS）**：

    PROJECT_SLOTS = 7                    // 项目 offer 独立席位（t30：5→7）
    STUDENT_SLOTS = 3                    // 候选人 offer 独立席位
    MARKET_SLOTS  = PROJECT_SLOTS + STUDENT_SLOTS = 10  // 总席位，仅作 UI 展示口径（selectMarket.slots.cap）
    PROJECT_OFFER_TTL_MONTHS = 3         // 非锁定项目 offer 存活月数（到期即撤走；t30：6→3）
    STUDENT_OFFER_TTL_MONTHS = 6         // 非锁定候选人 offer 存活月数
    MIN_ACCEPTABLE_PROJECT_OFFERS = 1    // 不变式下限：始终有 N 个「当前真能接」的项目 offer
    MIN_RECRUITABLE_STUDENT_OFFERS = 1   // 不变式下限：始终有 N 个「当前够得着」的候选人（market.js 导出）
    SUPPLY_FLOOR_12M = 21                // ★ 供给绝对下界（个 / 12 个月），见下（t41，BALANCE §18.18 裁定 ①）

> ⚠ 数值同步（t45）：上一段曾在 t18 写成 `PROJECT_SLOTS = 5 / TTL = 6 / MARKET_SLOTS = 8`，
> t30 落表后实际已是 **7 / 3 / 10**。契约按**当前代码**更正（依据 src/data/projects.js:65-70）。

**供给下界 `SUPPLY_FLOOR_12M`（冻结；"结论"而非"推导"）**：

- 语义：**任意连续 12 个月内新增的可承接项目 offer 数量**的绝对下界（不含已挂 N 月的旧 offer）。
- 与名义值的关系：名义供给 = `(PROJECT_SLOTS − 1) / PROJECT_OFFER_TTL_MONTHS × 12` = 6/3 × 12 = **24**
  （减 1 个席位留给「看得见目标、仪器未齐」的本子），再乘事先批准的 **1/8 漏刷预算** → **21**。
- ★ **21 是结论，不是下界的来源**：实测正好压在下界上、**零余量**。因此
  **改 `PROJECT_SLOTS` 或 `PROJECT_OFFER_TTL_MONTHS` 必须显式复核并修改这个常量、说明理由**（红线与参数解耦）；
  禁止再写「由 slots/TTL 反推的下界」——那种写法会让下界随被测参数一起下降，断言永远绿（BALANCE §18.18 裁定 ①/④、§18.9 尺子纪律）。
- 消费方：`tests/market.test.mjs`（第 19 行 import；第 185 行 `const SUPPLY_MIN_NEW_OFFERS_PER_YEAR = SUPPLY_FLOOR_12M`）
  断言 `newReach >= 21`。**别处不许再定义第二个供给下界。**

**市场不变式（冻结，engine.refreshMarket 必须维持）**：任一月份结算后，market.pool 同时满足
① 项目 offer 数 ≤ PROJECT_SLOTS、候选人 offer 数 ≤ STUDENT_SLOTS（各自独立，互不挤占）；
② 至少 MIN_ACCEPTABLE_PROJECT_OFFERS 个「按当前头衔与持有仪器真能承接」的项目 offer；
③ 至少 MIN_RECRUITABLE_STUDENT_OFFERS 个「按当前 IF 与头衔够得着」的候选人；
④ 非锁定 offer 一律按各自 TTL 到期撤走（locked=true 的不受 TTL 限制，仍占席位）。
⑤ **稀有人才也不许破 ①**（v1.4.0）：5% 露面的彩蛋候选人**替位**入场 —— 学生席位满时先挤走一位
   「够不着 / 最老」的普通候选人；池子已达 POOL_CAP 时本轮不再注入（宁可这次不出现，也不破容量）。
   回归断言：tests/market.test.mjs 的 overStudent/overCap 计数 + tests/rare-talent.test.mjs 第 5 段。
回归断言在 tests/market.test.mjs 与 scripts/simulate.mjs（「任何月份至少 1 个可承接 offer」）。

### 1.5 papers.js —— 期刊档位与论文槽位

导出：PAPER_TIER_ORDER PAPER_TIER_LABELS PAPER_TIER_IDS JOURNAL_IF_BASE IF_RANDOM_LOW/HIGH
IF_ROUND_DECIMALS PAPER_PATTERNS PAPER_PATTERN_IDS PAPER_BUY_PRICE BUY_FIRST_INTEGRITY
GRAB_FIRST_INTEGRITY GRAB_FIRST_HAPPY GRAB_GRUDGE_MONTHS GRUDGE_HAPPY_PER_MONTH
MASTER_GRAD_PAPER PHD_GRAD_PAPER PLAYER_AUTHOR_ID downgradeTier(tier) upgradeTier(tier)

    PLAYER_AUTHOR_ID = 'player'   // t24：论文台帐里「一作是玩家本人」的署名 id
                                  //（亲带项目的论文、被抢/买走的一作都用它；学生一作记学生 id）

    PAPER_TIER_ORDER = ['top','q1','q2','q3','q4']        // top = 正刊
    JOURNAL_IF_BASE  = { top:45, q1:10, q2:5.5, q3:3.2, q4:1.3 }
    PAPER_PATTERNS[id] = { id, name, weights:{tier:prob}, expectedIF }   // PA..PE

### 1.6 hardpoints.js —— 进度与难点

导出：BASE_PROGRESS ABILITY_DIVISOR HAPPY_COEF_BASE/SLOPE MAX_PROJECTS_PER_STUDENT PLAYER_LEAD_MUL
PLAYER_LEAD_ENERGY_COST ZERO_CONSUMABLE_PROGRESS_MUL PROGRESS_PCT_DENOM_PER_HARDPOINT
HARDPOINT_PROGRESS_PENALTY_PER_HD HARDPOINT_PAPER_DOWNGRADE HARDPOINT_RETRY_BONUS HARDPOINT_RETRY_CAP
HARDPOINT_HD_DIST hardpointCount(tier) HARDPOINT_METHODS HARDPOINT_METHOD_ORDER
TEAM_* FAKE_* AUDIT_* SOLO_* RETRY_* CAUGHT_BAD_ENDING_INTEGRITY PROJECT_MAX_STUDENTS

    MAX_PROJECTS_PER_STUDENT = 3   // 单名学生最多同时在研项目数（手工 reduceAssign 与一键分配都读它）
    PROJECT_MAX_STUDENTS = 6       // 单个项目的**人数上限**，t25 起由「一键分配」使用。
    // ⚠ 作用域是不对称的（**登记在案，不是漏读**）：它只约束一键分配（engine.autoAssignPlan / reduceAutoAssign）；
    //   手工路径 reduceAssign 只检查学生的 MAX_PROJECTS_PER_STUDENT（=3），**不读** PROJECT_MAX_STUDENTS，
    //   因此手工仍可把第 7 个人塞进同一项目。该不对称已由主理人转策划裁定（t32）；若裁定收紧，
    //   实现要同时改 reduceAssign，并回填本节与 BALANCE。

    HARDPOINT_METHODS = { team:{id,label,hint,penalty}, fake:{...}, solo:{...} }   // SPEC 硬性三种
    HARDPOINT_HD_DIST = { 1:[[1,1.0]], 2:[[1,0.6],[2,0.4]], ... }                  // [hd, 概率]

### 1.7 students.js —— 学生

    MULTI_PROJECT_HAPPY_PENALTY = 1   // t42 B 方案：同一名学生带 n 个在研项目时每月额外 −(n−1)×本值
                                      //（n=1 → 0、n=2 → −1、n=3 → −2；消费方 formulas.happinessDelta:222 与
                                      // engine.projectLoadByStudent:310 / engine.js:533 的同一份负载计数）

导出：INITIAL_HAPPINESS HAPPINESS_MIN/MAX DEGREE_PROGRESS_MAX MASTER_STUDY_MONTHS PHD_STUDY_MONTHS
MASTER_GRAD_PAPER_TIER PHD_GRAD_PAPER_TIER GRAD_INTEGRITY_BONUS ABILITY_MIN/MAX
ABILITY_TRANSLATE_MEAN_SD ABILITY_EXAM_MEAN_SD ABILITY_DARKHORSE_MEAN_SD ABILITY_DARKHORSE_RATE
WAGE_TIERS WAGE_TIER_LABELS WAGE_INDEX WAGE DEFAULT_WAGE_TIER WAGE_HAPPY GAP_PENALTY
WAGE_EXPECT_THRESHOLDS NO_WAGE_MONTHS_THRESHOLD NO_WAGE_INTEGRITY PROJECT_STRESS_HARDPOINT
PROJECT_STRESS_IDLE HAPPY_REGRESSION_THRESHOLD/SLOPE HAPPY_PROJECT_FINISH HAPPY_LEAD_BONUS
MULTI_PROJECT_HAPPY_PENALTY
HAPPY_BREAKDOWN_DROP HAPPY_BREAKDOWN_TALK_COST LEAVE_* POACH_PROGRESS_MUL DEGREE_* DEFER_*
GIVEUP_* DEGREE_KIND DEGREE_LABELS
**RARE_TALENTS RARE_SPAWN_RATE ABILITY_MAX_RARE**（v1.4.0 稀有人才：8 人的名字/性别/所属池、
每人每次该池刷新 5% 露面、天赋上限 120% —— 普通路径仍是 ABILITY_MIN..ABILITY_MAX）

### 1.8 market.js / actions.js / endings.js / events.js / names.js

- market.js：RECRUIT_SOURCES RECRUIT_SOURCE_LABELS MARKET_OPEN_MONTHS MARKET_OPEN_FIRST_MONTH POOL_CAP
  POOL_TRANSLATE_MONTHS POOL_EXAM_MONTHS RECRUIT_COST（及拆开的 RECRUIT_COST_BASE_*）REQ_IF_WEIGHT
  REQ_RANK_CAP REQ_IF_BASE_ABILITY REQ_RANK_PER_IF RECRUIT_PER_MONTH
  MIN_RECRUITABLE_STUDENT_OFFERS（不变式下限，见 §1.4 市场席位）
- actions.js：ACTION_DEFS（4 条；引擎层另有同名概念 ACTIONS，见 §3.1，故数据层改名以免打包冲突）ACTION_MAP
  TALK_* MEETING_* EXERCISE_* TEAMBUILD_COST_PER_STUDENT HAPPY_ACTION_*

      ActionDef = { id:'talk'|'meeting'|'exercise'|'teambuild', name, energyCost,
                    moneyCost:number|'perStudent', limitPerMonth:number|'perStudent',
                    needs:{student?,project?,count:number}, hint }

- endings.js：ENDINGS（8 条，按优先级从上到下）ENDING_MAP ACADEMICIAN_VARIANT_HIGH/DARK/DEFAULT

      EndingDef = { id, title, kind:'success'|'bad'|'neutral'|'active', cond, text,
                    variants?:[{ id, cond, text }] }

- events.js：EVENTS（24 条）EVENT_MAP EVENT_WEIGHT_DEFAULT EVENT_COOLDOWN_MONTHS MACHINE_DOWN_MONTHS
  INSPECTION_CONSUME_MUL
- names.js：SURNAMES_SINGLE（{name,w}）SURNAMES_COMPOUND GIVEN_FIRST/LAST/SINGLE（{name,g:'n'|'m'|'f'}）
  NAME_BLOCKLIST HOMOPHONE_BLOCK NAME_DOUBLE_RATE COMPOUND_SURNAME_RATE GENDER_NEUTRAL_RATE
  NAME_RETRY_MAX NAME_CHAR_DECAY NAME_DATA_TARGET

> **字库状态（2026-10 复核，t38 同步）**：七项语料**全部 ≥ NAME_DATA_TARGET** ——
> 实际 单字姓 192 / 复姓 20 / 双字名首 244 / 双字名末 264 / 单字名 204 / 黑名单 58 / 谐音 42
> （目标 186 / 20 / 240 / 260 / 200 / 50 / 40，实测于 src/data/names.js）。
> **黑名单 58 = 原本 50 + v1.4.0 的 8 位稀有人才名字**（彩蛋必须靠 RARE_TALENTS 独立注入，
> 随机拼名不得拼出同名路人；目标值 50 是下限，超出不报错）。
> scripts/check.mjs 第 9 项**直读 NAME_DATA_TARGET 逐键比对**，正常输出「[ok] 字库规模达标」、**0 警告**；
> 扩表仍然只往数组里加条目、不动逻辑；若把某个数组删短，check 会重新报警告（而不是静默通过）。

---

## 2. GameState（唯一世界状态）字段契约

由 src/core/state.js 的 createState(opts) 产出；**必须可 JSON 序列化**（无函数 / Map / Set / Date）。

    state = {
      version:1, appId:'wobang-son-academician', seed:string, rng:{ seed:number },
      calendar:{ year, month, monthIndex },        // monthIndex 从 0 起 = 已推进月数
      phase:'action'|'settle'|'ended',
      player:{ name, sonName, age, health, energy, energyMaxDelta, rankIndex, totalIF, integrity,
               money, consumable, consumeMode, tickets, papers:{top,q1,q2,q3,q4},
               papersFirst:{top,q1,q2,q3,q4}, graduated:{master,phd},
               monthActions:{talk,meeting,exercise,teambuild}, monthEnergySpent, monthMoneySpent },
      lab:{ equipment:{instrumentId:count}, equipmentDown:{instrumentId:monthsLeft},
            purchaseCount:{instrumentId:n}, holdCap:3, consumeMulThisMonth },
      students:[Student], projects:[Project],
      market:{ pool:[Offer], refreshedMonthIndex, lockedOfferId|null, recruitedThisMonth,
               rareHired:[name] },   // v1.4.0：本局已招走的稀有人才名字（刷新时跳过；旧档缺失默认 []）
      month:{ index, eventQueue:[eventId], pendingQueue:[{eventId,monthIndex,choiceId}],
              eventsResolved:[eventId], fakesThisMonth, leavesThisMonth, flags:{} },
      counters:{ nextStudentId, nextProjectId, nextOfferId, nextChronicleId, fakesTotal, auditsTotal,
                 grabbedPapers, boughtPapers, projectsFinished, projectsFailed, eventsFired,
                 papersAwarded, deferredStudents },
                                                 // papersAwarded（t24）：全局见过刊的论文数（所有论文都算，
                                                 //   与一作归属无关；receipt.papersAll 由它差分）
                                                 // deferredStudents 运行期新增（首次延毕时置 1）
      eventState:{ cooldowns:{eventId:monthIndex}, lastFiredMonth:{eventId:monthIndex} },
                                                 // lastFiredMonth：冷却/once 判定的真相（rules.eventCooldownLeft）
                                                 // cooldowns：预留初值 {}，当前无人读取（登记在此以免评审再当成漏读）
      flags:{ retired, resigned, bankrupt, labEmptyThisMonth, almostAcademician, caughtRedHanded,
              electionWindowOpen, negativeMoneyMonths, lastElectionMonthIndex },
                                                 // negativeMoneyMonths 不在 createState 初值里，由 engine 首次见到负经费时创建（初值 0）
      chronicle:[Chronicle], pendingEvent:null|{eventId,monthIndex,choiceId},
      ending:null|{id,title,text,monthIndex,variant},
      stats:{ history:[MonthlyRecord], peak:{totalIF,money,students}, lastReceipt:Receipt|null },
      ui:{ tab, modal, toast, selectedStudentId, selectedProjectId, filter, autoAssign },
                                                 // autoAssign（t25）：上次「一键分配工作」的摘要快照
                                                 // （monthIndex/moveCount/studentsTouched/studentsTotal/projectsTotal/
                                                 //  availableStudents/studentCap/projectCap/studentsWithoutProject[]/
                                                 //  studentsFull[]/projectsShort[{id,name,members,cap}]/feedback）
    }

    Student = { id, name, gender:'male'|'female', degree:'master'|'phd', source:'translate'|'exam',
                ability, happiness, wageTier:'high'|'mid'|'low'|'none', studyMonthsLeft, degreeProgress,
                projectIds:[projectInstanceId], monthsNoWage, monthsInLab, grudgeMonths, outputMulMonths,
                outputMul, wageExpectShift, monthTalkCount, soloThisMonth, deferMonths, graduated, left,
                enteredMonthIndex, note, rare:boolean }
    // rare（v1.4.0）：稀有人才标记。唯一的语义 = createStudent 允许 ability 落在 (ABILITY_MAX, ABILITY_MAX_RARE]；
    // 事件效果 studentAbility 也按它取上限（否则 120% 会被夹回 95%）。普通学生一律 false。

    // soloThisMonth:Boolean —— 本月「单人猛干」标记：该生本月不产出项目进度，跑完一次月底结算即清掉
    //                        （engine.js settleProjects 读、settleStudents 清、resolveHardpoint 置 true）

    Project = { instanceId, defId, name, category, tier, workload, progress, money, depositRate,
                consumablePerMonth, assignedStudentIds:[studentId], playerLeading,
                hardpoints:[{ id, hd:1|2|3, status:'hidden'|'open'|'solved'|'faked', appearAt,
                              retries, method:null|'team'|'fake'|'solo', fakeCount }],
                paperTiers:[patternId|PaperRecord], acceptMonthIndex, deadlineMonthIndex, overdueMonths,
                tailPaid, status:'active'|'finished'|'failed' }

    PaperRecord = { paperId, patternId, tier, if, firstAuthorId, firstAuthorName,
                    grabbed:boolean, grabbedMonthIndex:number }
    // project.paperTiers **结题前**是槽位模板 id 数组（'PB' 等）；结题时被结算成 PaperRecord 数组（一篇一条），
    // 抢一作与读档都只看这张台帐。firstAuthorId === PLAYER_AUTHOR_ID（'player'）表示一作是玩家本人，
    // 这也正是该篇进不进 player.papers 的判据。

    Offer（kind='project'）= { offerId, kind, tier, locked, createdMonthIndex, defId, category, money,
                              limitMonths, workload, require, expiresMonthIndex }
    Offer（kind='student'）= { offerId, kind, tier, locked, createdMonthIndex, name, gender, degree,
                              source, ability, cost, reqIF, reqRank, rare:boolean }
    // rare=true 的候选人只能由 data/students.js 的 RARE_TALENTS 注入（不参与随机拼名），
    // 天赋恒为 ABILITY_MAX_RARE（1.2 = 120%）；招走时把 name 记进 market.rareHired（本局永不再现）。

    Receipt = { monthIndex, year, month, income:[{label,amount}], expense:[{label,amount}],
                projects:[{instanceId,name,progressDelta,progressPct,status,starved}],
                students:[{id,name,happyDelta,degreeDelta,happiness,note}],
                papers:[{tier,count,if}],   // count = 本月新增的「玩家一作」篇数（按档位）
                papersAll:number, papersStudent:number,   // t24：本月见刊的全部论文数 / 其中学生一作数
                events:[string],
                starvedCount, starvedProjects:[], starvedHint, consumableLow,
                moneyBefore, moneyAfter, moneyNet, consumableBefore, consumableAfter, consumableNet,
                integrityDelta, integrityAfter, ticketsDelta, ticketsAfter, ifDelta }
    // 最近一次月底结算的回执（engine.newReceipt + finalizeReceipt 写入，随存档保存）：
    // 单位金额=万，其余为点；★ 这份形状是 UI 月报（src/ui/receipt.js）的唯一数据源，改字段必须同步 UI。

    Chronicle = { id, monthIndex, year, month, kind, tone:'good'|'bad'|'absurd'|'system', text }
    MonthlyRecord = { monthIndex, year, month, money, consumable, totalIF, rankIndex, health, integrity,
                      students, activeProjects, avgHappiness, avgDegree, tickets, papers:{...} }

**论文归属判定（t24「v2 一作归属模型」；本段在 2026-10 被修正过两次，见 §8 勘误表）**：

- player.papers:{top,q1,q2,q3,q4} = **玩家一作的论文数**（= 晋升门槛 q1/q2/正刊的取值来源，
  formulas.rankStatus 只读它；同时是展示台账）。谁 +1：
  · 结题时**老板亲带**（project.playerLeading === true）的项目：论文一作**全部归玩家** → 每篇 +1（GDD §2.7/§2.8）；
  · 学生负责的项目：一作按参与学生的科研能力降序轮流署名（台帐记 firstAuthorId = 学生 id）→
    **不进 papers**（只进 totalIF，玩家挂通讯）；
  · 玩家**买来**的一作（game/buyFirstAuthor）→ +1（该篇对玩家而言是全新一篇，同时计 IF）；
  · 玩家**抢来**的一作（game/grabFirstAuthor）→ +1（这一刻署名改到玩家名下；该篇 IF 已在结题时计过，不重复计）。
- player.papersFirst:{...} = **台账**：只统计「玩家买来/抢来的第一作者」有几篇（诚信与展示读它）。
  它不单独再加门槛 —— 买/抢这一步已经各给 papers +1。
- player.totalIF = **全部论文**（不论一作归属，含学生一作与毕业产出）的影响因子之和（GDD §3.2）；
  每篇只在「结题 / 买一作」时计一次，抢一作不重复计 IF。
- counters.papersAwarded = 全局「见过刊的论文数」（所有论文都 +1，与一作归属无关）；月报 papersAll 由它差分得出。

> **修正记录（两次，性质不同，别混——这是本段最容易读错的地方）**：
> ① 2026-10（t18）**只修文字**：旧句「player.papersFirst …不参与晋升门槛」被读成「买/抢的论文不进门槛」。
>    当时的 papers 含义没变（仍是「课题组全部产出」），改的是「门槛读哪本账」的表述，**没有动 STATE_VERSION**。
> ② 2026-10（t24）**改语义**：papers 的含义从「课题组全部产出（含学生一作）」收窄为「**玩家一作的论文数**」，
>    因此 STATE_VERSION 1 → 2、旧档由 MIGRATIONS[1] 按结题台帐重算（见 §5）。
>    GDD §2.7「门槛只统计玩家为一作的论文」自 t24 起与实现一致 —— 此前那条口径差**已消除**。
>
> **冻结分工（一句话记住）**：**晋升门槛只读 player.papers（玩家一作篇数）；totalIF 统计全部论文。**
> 两本账永远不要混用：拿 totalIF 去比 q1/正刊 门槛、或用 papers 去当「课题组产出」展示，都是错的。

---

## 3. src/core/ 暴露给 UI 的 API

### 3.1 engine.js —— action 与 reducer

    import { ACTIONS, reduce, ACTION_TYPES } from './core/engine.js';
    reduce(state, { type, payload }) -> newState    // 纯函数，永不原地改入参
    ACTIONS.<name>(payload) -> { type, payload }    // action 创建器
    ACTION_TYPES                                    // = ACTIONS 的键名数组，即 action 创建器名（25 个：newGame…dismissToast）
                                                    //   注意：type 字符串是 ACTIONS.x({}).type —— 形如「game/ 前缀 + 动词」或「ui/ 前缀 + 动词」，见下表

    // engine.js 同时导出的查询/工具函数（selectors 与 scripts/systems/bots.js 用）：
    pendingDeferStudents(state) -> Student[]        // 学制读满且未到延毕上限 = 等玩家拍板（纯推导，不落新字段）
    grabbedPaperThisMonth(state, studentId) -> boolean
    rollPaperTier(pattern, rng) -> tier
    autoAssignPlan(state) -> { moves:[{studentId, studentName, projectId, projectName}], summary }
                                                    // t25：reduceAutoAssign 与 selectAutoAssign 共用同一份计划，
                                                    // 保证「引擎会做的」= 「UI 预览看到的」；纯函数、无随机
    // 为 UI/脚本方便做的 re-export（真身在别处）：
    STATE_VERSION（state.js）  hashString createRng（rng.js）  equipmentBonus energyMax projectProgressPct
    rankStatus totalStudentsGraduated（formulas.js）  ENDING_MAP（data/endings.js）  WAGE（data/students.js）

| action 名 | 参数 | 改 state？ | 说明 |
|---|---|---|---|
| game/newGame | {seed?, playerName?, sonName?} | 是（整局替换） | 新开一局 |
| game/advanceMonth | {autoResolveEvents?:boolean} | 是 | 月末结算 + 进入下一月；有未处理事件时拒绝执行 |
| game/doAction | {actionId, studentId?, projectId?} | 是 | 4 种行动；精力/经费不足时写 ui.toast 后原样返回 |
| game/buyConsumable | {amount?} | 是 | 用经费采购耗材（默认一批 CONSUMABLE_BUY_PACK=20） |
| game/setConsumeMode | {mode:'free'\|'normal'\|'tight'} | 是 | 切换耗材模式 |
| game/setWage | {studentId, tier} | 是 | 设置工资档 |
| game/hireStudent | {offerId, wageTier?} | 是 | 招募候选人（过名额/IF/头衔/经费检查） |
| game/buyEquipment | {id} | 是 | 采购仪器（按持有数涨价，受 tierGate 限制） |
| game/acceptProject | {offerId, studentIds?} | 是 | 承接项目：得定金、生成难点、可同时分配学生 |
| game/lockOffer | {offerId} | 是 | 锁定/解锁市场项目（最多 LOCKABLE_SLOTS 个） |
| game/assignStudent / game/unassignStudent | {projectId, studentId} | 是 | 学生 ↔ 项目 |
| game/togglePlayerLead | {projectId} | 是 | 玩家亲带（进度 ×PLAYER_LEAD_MUL，占用精力） |
| game/resolveHardpoint | {projectId, hardpointId, method:'team'\|'fake'\|'solo', studentIds?} | 是 | 三种处理方式，随机结果取自 state.rng |
| game/buyFirstAuthor | {tier:'top'\|'q1'\|'q2'\|'q3'\|'q4'} | 是 | 买一作：**tier 必填**（缺档位或经费不足 → toast + 原样返回，不扣钱）；扣 PAPER_BUY_PRICE[tier] + 诚信 BUY_FIRST_INTEGRITY；该篇一作归玩家 → papers[tier] +1（玩家一作数）、totalIF += IF、papersFirst[tier] +1、counters.papersAwarded +1 |
| game/grabFirstAuthor | {studentId, paperId, tier} | 是 | 抢一作：三者**全必填**；只能抢「结题台帐里该生为一作、尚未被抢」的那一篇，一篇一次、每生每月一次、tier 必须与台帐一致；台帐里该篇 firstAuthorId 改成 PLAYER_AUTHOR_ID（grabbed=true + grabbedMonthIndex）；诚信 GRAB_FIRST_INTEGRITY、该生幸福 GRAB_FIRST_HAPPY、心结 GRAB_GRUDGE_MONTHS 个月；**不重复计 IF**（该篇 IF 已在结题时计过）、**不动 papersAwarded**，只有 papers[tier] +1 与 papersFirst[tier] +1 |
| game/chooseDefer | {studentId, choice:'defer'\|'giveUp'} | 是 | 延毕决定（t8）：学制读满的学生必须由玩家拍板，没拍板不能推进月份；defer = 工期 +DEFER_MONTHS_SUBTRACT、幸福 +DEFER_HAPPY、deferMonths+1、不占招生名额；giveUp = 肄业离组（与超年限同一条路径） |
| game/deferStudentByBoss | {studentId} | 是 | **v1.6.0「延毕他」**：老板随时拍板的主动延毕，与到期的 game/chooseDefer 是两件事。守卫：该生存在、未 left、未 graduated，否则中文 toast + 原样返回（不改状态、不扣钱）；效果只有两条 —— happiness +DEFER_BY_BOSS_HAPPY（夹 0..HAPPINESS_MAX）、degreeProgress +DEFER_BY_BOSS_PROGRESS（夹 0..DEGREE_PROGRESS_MAX）；**不动** studyMonthsLeft / deferMonths / 诚信；成功写一条 system 纪事（说明是老板拍的板）；允许连点，每次各自生效 |
| game/resolveEvent | {eventId, choiceId?} | 是 | 结算当前事件；队列非空时自动弹下一个 |
| game/resign | {} | 是 | 主动下海（industry 结局） |
| game/setName | {name?, sonName?} | 是 | 改玩家/儿子姓名（trim + 压空格 + 截断 PLAYER_NAME_MAX_LENGTH；空值 → toast 不改 state；改动成功写一条系统纪事） |
| game/autoAssign | 无（reducer 不读 payload） | 是 | 一键分配工作（t25）：把可用学生分配进在研项目 —— ① 先让每名还有名额的活跃学生至少挂 1 个项目，② 再把剩余名额补进缺人最多的项目（同级看等级高、id 小）。约束沿用 engine.autoAssignPlan（每生 ≤MAX_PROJECTS_PER_STUDENT、每项目 ≤PROJECT_MAX_STUDENTS）。**纯函数、不掷点（确定性：同一 state 同一结果）**；**幂等**（已分好的不动，连点第二次 moveCount=0、分配矩阵逐字不变，只回一句反馈）。写入 ui.toast、ui.autoAssign 摘要；**有实际移动时**再补一条 system 纪事 |
| ui/setTab | {tab} | 仅 ui | 切标签页 |
| ui/setModal | {modal} | 仅 ui | 开关弹层 |
| ui/selectStudent / ui/selectProject | {studentId} / {projectId} | 仅 ui | 选中项 |
| ui/dismissToast | {} | 仅 ui | 关提示条 |

### 3.2 formulas.js —— 纯计算（UI 一般不直接用，viewmodel 已包装）

    energyMax(state) consumeMode(state) equipmentBonus(lab) instrumentPrice(id, ownedCount)
    maintenanceTotal(lab) missingInstruments(lab, require) schoolFundMonthly(rankIndex)
    abilityCoef(ability) happyCoef(happiness) studentBaseProgress(student, project)
    progressMultiplier({consumable, lab, project, consumeMul})
    worstOpenHardpoint(project) openHardpointCount(project) projectProgressPct(project)
    isProjectComplete(project) projectTail(project) degreePerMonth(student, hasProject, {consumable})
    expectedWageTier(ability, shift?) wageCost(student) happinessDelta(student, ctx) clampHappiness(v)
    totalStudentsGraduated(state) activeStudents(state) activeProjects(state)
    hireCost(ability, source) recruitRequirement(ability, source) rollHardpointHd(tier, rng)
    teamSuccessChance(students, retryBonus) soloSuccessChance(ability, retryBonus)
    fakeCatchChance(fakeInProject, fakesTotal) retryBonus(retries) paperIF(tier, rng) paperScore(papers)
    rankStatus(state) isElectionWindow(state) projectDefOf(project)

    rankStatus(state) -> { rank, next, ok, missing:[{key,need,have,text}] }
    recruitRequirement(ability, source) -> { reqIF, reqRank }

### 3.3 rules.js —— 纯判定

    evaluateCondition(cond, {state, student?, project?}) -> boolean
    isMarketOpen(state) canAcceptOffer(state, offer) canRecruitOffer(state, offer)
    availableEvents(state) eventCooldownLeft(state, eventId)
    promotionStatus(state) -> { rank, next, ok, eligible, reason, missing }
    endingFor(state) -> { ending, variant } | null
    isBankrupt(state) isLabEmpty(state)

    canAcceptOffer / canRecruitOffer -> { ok, reasons:[{code, text}] }

### 3.4 selectors.js + viewmodel.js —— UI 取数（UI 只用这两个）

    // viewmodel.js
    buildViewModel(state) -> { hud, tabs, tab, crew, projects, market, actions, chronicle,
                              consts, receipt, pendingEvent, pendingDefer, ending, toast, canAdvance }
    //   consts      = selectUiConstants()（UI 展示用的常量透传：UI 不许硬编码任何数值）
    //   receipt     = selectReceipt(state)（上月结算回执，UI 月报的唯一数据源）
    //   pendingDefer= selectPendingDefer(state)（等玩家拍板的延毕决定；非空时 canAdvance 必为 false）
    //   canAdvance  = phase==='action' && 无 pendingEvent && 无 ending && pendingDefer.length===0
    buildHud(state) -> { time, rank, ageText, phase, money, consumable, energy, energyMax, health,
                        integrity, achievements, slots, tickets, canAdvance, election }
    TABS -> [{id:'lab'|'projects'|'market'|'actions'|'chronicle', label}]
    normalTab(tab) -> 合法 tab id

    // selectors.js（细粒度，viewmodel 内部使用，UI 也可直接用）
    selectTime selectPhase selectRankInfo selectAchievements selectSlots
    selectStudents selectActiveStudents selectStudentRow
    selectProjects selectProjectRow selectHardpoint
    selectEquipment selectLab
    selectMarket -> { open, openText, slots:{used,cap}, projects:[...], students:[...] }   // cap = MARKET_SLOTS(8)
    selectActions -> { energy, energyMax, money, consumable, consumableLow, buyPack, buyPackCost,
                      canBuyConsumable, consumeMode, consumeModes, studentOptions, projectOptions,
                      autoAssign }   // autoAssign 与 vm.autoAssign 同一个对象（t25）

    // selectAutoAssign(state) = vm.autoAssign（t25 一键分配工作）
    selectAutoAssign(state) -> {
      canAssign:boolean,          // planCount>0：点下去真的会动
      planCount:number,           // 本次会移动的「学生×项目」条数
      plan:[{ studentId, studentName, projectId, projectName }],   // 「点了会怎么分」的预览
      feedback:string,            // 一句话结果（无学生 / 无在研项目 / 学生带满 / 项目满 / 谁排不下 / 几个项目仍缺人）
      availableStudents:number, studentsTotal:number, projectsTotal:number,
      studentsWithoutProject:string[],   // 分不到项目的学生姓名
      studentsFull:string[],             // 已到学生名额的姓名
      projectsShort:[{ id, name, members, cap }],   // 仍缺人的在研项目
      studentCap:number, projectCap:number,         // MAX_PROJECTS_PER_STUDENT / PROJECT_MAX_STUDENTS
      last:null|object,   // 上次执行的摘要快照（= state.ui.autoAssign 的深拷贝，含 monthIndex）
    }
    // 两个上限也可单独从 selectUiConstants().autoAssign 取：{ studentCap, projectCap }
    selectChronicle(state, limit?) selectPendingEvent(state) selectEnding(state) selectElection(state)
    selectPendingDefer(state) -> StudentRow[]      // 延毕待决名单（行包装；判定在 engine.pendingDeferStudents）
    selectReceipt(state) -> Receipt|null           // state.stats.lastReceipt 的深拷贝（无回执时为 null）
    selectUiConstants() -> { actions, hardpoints, papers, limits, defer, consumable, consumeModes,
                             market, integrity }  // 常量透传表，见实现 selectors.js selectUiConstants
    GRADE_LABELS PAPER_TIER_LABELS PROJECT_MAP WAGE hireCost（模块级导出，UI 可直接 import）

    // selectHardpoint(state, project, hp) 的返回（难点按钮要显示成功率与抽调名单，公式只有 core 有）
    row.attempts = { retryBonus,
                     team:{ studentIds, names, enough, chance, pct },
                     solo:{ studentIds, names, chance, pct },
                     fake:{ chance, pct } }        // chance=0..1，pct=四舍五入百分数；只有 status==='open' 时存在

### 3.5 store.js / save.js / rng.js / state.js / naming.js

    createStore({ initialState, reducer, actions, onChange? }) -> {
      getState(), dispatch(action), replaceState(state, meta), subscribe(fn) -> unsubscribe,
      getHistory(), actions:{ <bound action creators> } }
    subscribe 回调签名：(state, event:{type, action, changed})

    save.js:  SAVE_VERSION STATE_VERSION MIGRATIONS serialize(state) hydrate(raw)|null validateState(raw)
              saveGame(state, storage?) loadGame(storage?)|null hasSave(storage?) clearSave(storage?)
              // STATE_VERSION 的**唯一拥有者**仍是 state.js（当前值 = 2）；save.js 在此基础上 re-export 它
              //   （t16 F8 加的，方便读档方直接比版本），并导出 SAVE_VERSION = STATE_VERSION；engine.js 也 re-export。
              //   三处都在，但取值只有一个来源（state.js）。
              // 历史：t18 曾按当时的代码判定「save.js 导出 STATE_VERSION」是笔误、只列 state.js；
              //   t16 之后那句话重新成立，故两边都列（详见 §8 勘误表）。
    rng.js:   RNG_VERSION hashString(str) createRng(seed|snapshot) rngFromSnapshot(snap) clamp(v,lo,hi) round(v,digits)
    state.js: STATE_VERSION createState(opts) createStudent(o) createProject(o) createOffer(o)
              createChronicleEntry(o) energyMaxFrom(state) advanceCalendar(cal, months) cloneState(state)
    naming.js: generateName(rng, {used?, gender?}) -> {name, gender}  isClean(name)  PROTAGONIST

---

## 4. 事件契约

### 4.1 事件对象

    GameEvent = {
      id: 'e_xxx', title: '审稿人二号',
      weight: 10,                  // 权重（缺省用 EVENT_WEIGHT_DEFAULT）
      cooldown: 6,                 // 可选；缺省用 EVENT_COOLDOWN_MONTHS
      once: false,                 // 可选；true = 全局只出一次
      cond: <条件 DSL>,            // 必填，恒真写 true
      tone: 'bad'|'absurd'|'system'|'good',
      text: '事件文案（反差优先、不说教、具体到物件与数字）',
      effects: [ <效果 DSL>, ... ],                     // 二选一
      choices: [{ id, label, hint?, effects:[...] }]     // 需要选择时才写；不写 = 单个「知道了」
    }

### 4.2 条件 DSL（可序列化，禁止函数）

    true
    { stat:'totalIF', op:'>='|'>'|'<='|'<'|'=='|'!=', value:300 }
        stat 取值：totalIF integrity health money consumable energy rankIndex ageYears tickets
                   studentsGraduated studentCount projectCount fakesTotal grabbedPapers
                   boughtPapers recentQ4Papers monthIndex year month
    { flag:'electionWindowOpen' }                     // state.flags / state.month.flags
    { hasInstrument:'hplc', min:1 }
    { anyProject:{ active:true, category:'enterprise', tierAtLeast:3, openHardpoint:true } }
    { anyStudent:{ active:true, source:'exam', degree:'phd', happinessBelow:40,
                   happinessAtLeast:50, abilityAtLeast:0.85, grudge:true } }
    { all:[...] } | { any:[...] } | { not:<条件> }
    { ctxStudent:{ happinessBelow:30 } } | { ctxProject:{ category:'enterprise' } }   // 仅效果 DSL 的 if 里用

### 4.3 效果 DSL（按顺序结算，实现在 engine.applyEffects）

| kind | 参数 | 作用 |
|---|---|---|
| selectStudent | pick = random / lowestHappy / randomHappyHigh / randomHappyLow / examSource / hasGrudge / poachable | 绑定 ctx.student |
| selectProject | pick = randomActive / enterprise | 绑定 ctx.project |
| money / consumable / integrity / energy / health / energyMaxDelta / ticket | {mode:'add'\|'mul', value} | 改玩家数值 |
| studentHappy | target:'ctx'\|'ctxStudents'\|'all', value | 改幸福度 |
| studentDegree / studentAbility / studentOutputMul | target, value, months? | 改毕业进度 / 天赋 / 限时产出倍率 |
| studentLeave | target, progressMul | 学生离组（项目进度打折） |
| projectProgress | target:'ctx'\|instanceId, mode:'add'\|'mul', value | 改项目进度 |
| projectPaperShift | target, value:±1 | 结题论文整体升/降一档 |
| instrumentDown | {instrument, months} | 仪器停机 |
| consumeMulNextMonth | {value} | 下个月耗材消耗倍率（如视察后浪费） |
| meetingNull | — | 组会白开（纯文案） |
| wageExpectShift | target, value | 学生期望工资档上移（学校涨补助） |
| if | {cond, then:[...]} | 条件分支 |

新增事件 = 只往 EVENTS 里加对象；不要为单个事件改 engine。要加新 kind 就得同步本表 + CHANGELOG。

---

## 5. 存档契约

> 编号说明：存档契约就是本节（§5）。§3.5 是 core API 清单里 save.js/state.js 那一段，两者不要混引；
> 早期任务单里写的「§3.5 存档契约」按本节处理。

- key：SAVE_SLOT_KEY = 'wobang_son_academician_save'（localStorage）。
- 信封：{ version:STATE_VERSION, savedAt:number, state:GameState }。**当前 STATE_VERSION = 2**。
- **迁移表**（src/core/save.js 的 MIGRATIONS，key = 源版本）：
  · 「1」（v1 → v2，t24 一作归属模型）：把 player.papers 由「课题组全部产出」重算为「**玩家一作数**」——
    逐档 = 结题台帐里 firstAuthorId === PLAYER_AUTHOR_ID（'player'）的篇数 + player.papersFirst 的逐档计数
    （买/抢各记一次）；**totalIF 不动**（它一直是「所有论文」口径）。
    依据：v1 里亲带项目并**不**给老板一作（署名按学生轮流），老板真正到手的一作只有买/抢，
    故按台帐重算与 v1 的实际行为完全一致；不重算会让旧档门槛虚高。
  · **主程实测样例（t24 留档）**：某 v1 存档 papers = { q1: 9, q2: 24 }、papersFirst = { q1: 2, top: 1 }，
    且结题台帐里没有 firstAuthorId === 'player' 的篇 —— 迁移后 papers = { q1: 2, q2: 0, top: 1 }
    （= 台帐 0 篇 + papersFirst 逐档），**totalIF = 777 保持不变**。
  · **冻结分工**：晋升门槛读 player.papers（玩家一作篇数）；totalIF 读全部论文（见 §2）。
- 写入时机：AUTOSAVE_ON_MONTH_END = true → calendar.monthIndex 变化后自动存；另有手动存档/导出/导入。
- **ui 子树的持久化白名单**（save.js 的 pickUi）：tab / modal / toast / selectedStudentId / selectedProjectId /
  filter **以及 ui.autoAssign**（t25：一键分配摘要，逐字段校验后回填；非法值丢弃）。其余 ui 字段不落盘。
- 读档：loadGame() → hydrate() → validateState()：**缺字段补默认、非法值丢弃、越界夹紧、绝不抛异常**；
  版本低于当前按 MIGRATIONS 逐级迁移；高于当前（来自更新版本）返回 null 并开新局。
- **改 GameState 字段的流程**：STATE_VERSION +1 → MIGRATIONS 加 vN:(state)=>state → 更新本文件 §2 →
  更新 ARCHITECTURE §3/§4 → 补 CHANGELOG 的「契约变更记录」。篡改过的档按白名单逐字段丢弃非法值（绝不抛异常）。

---

## 6. UI 契约

### 6.1 视图清单（每个视图消费的字段）

| 视图文件 | 面板 / 容器 id | 消费的 viewmodel 字段 |
|---|---|---|
| src/ui/dom.js | （无面板，工具层） | 无（只提供 h/mount/clear/bar/tag/button/kv/card/subtabs/paper-tiles 与格式化函数） |
| src/ui/copy.js | （无面板，文案表） | 无（**只放中文文案，零数值**；UI 里不许出现裸数字） |
| src/ui/receipt.js | #month-report 内月报 | vm.receipt（= state.stats.lastReceipt）+ vm.consts.consumable |
| src/ui/hud.js | #hud 内各 #hud-* | vm.hud.* |
| src/ui/views/crew.js | #panel-lab | vm.crew.students / active / lab / slots / achievements / rank |
| src/ui/views/projects.js | #panel-projects | vm.projects.list / archive、vm.crew.active |
| src/ui/views/market.js | #panel-market | vm.market.projects / students / open / openText / slots |
| src/ui/views/actions.js | #panel-actions | vm.actions.* |
| src/ui/views/chronicle.js | #chronicle-list + #panel-chronicle | vm.chronicle |
| src/ui/modal.js | #modal-root + #toast-root | vm.pendingEvent / vm.pendingDefer / vm.ending / vm.toast / vm.consts.defer |

### 6.2 必须存在的 DOM 钩子（index.html）

#app #hud #hud-rank #hud-month #hud-age #hud-phase #hud-money #hud-consumable #hud-energy
#hud-health #hud-integrity #hud-if #hud-first #hud-tickets #hud-students #hud-election
#btn-next-month #btn-save #btn-export #btn-import #btn-resign #btn-reset
#tabs #tab-lab #tab-projects #tab-market #tab-actions #tab-chronicle
#panels #panel-lab #panel-projects #panel-market #panel-actions #panel-chronicle
#chronicle-wrap #chronicle-list #modal-root #toast-root

### 6.3 data-action 表（UI 与 app.js 的接线，必须一一对应）

next-month save export import reset reset-confirm resign resign-confirm defer-choice help modal-close
receipt-open ending-hide rename-open rename-apply tab goto-tab lab-section chronicle-filter
wage buy-equipment accept-project lock-offer hire-student assign-student unassign-student toggle-lead
auto-assign projects-intro-dismiss
hardpoint-team hardpoint-fake hardpoint-solo buy-first grab-first grab-confirm grab-cancel
consume-mode buy-consumable do-action event-choice dismiss-toast

> **表的语义（t39 澄清）**：本表 = `src/ui/app.js` 的 **HANDLERS 键全集**（当前 **41** 个），
> 不全是「会 dispatch game/ui action 的按钮」——其中有 11 个是 **UI 本地处理器**，只改 `ui/app.js` 的
> `localUi` 或开关弹层，**不写 GameState、不 dispatch**：
> `help` `modal-close` `receipt-open` `ending-hide` `rename-open` `rename-apply` `tab`
> `goto-tab` `lab-section` `chronicle-filter` `projects-intro-dismiss`
> （`tab` 经 dispatch('ui/setTab') 落进 state.ui，是其中唯一的例外；其余纯本地）。
> 判定口径：**只要 index.html 或视图生成了某个 `data-action`，它就必须在这里、且必须在 HANDLERS 里**，
> 两向都要一致（对账脚本见 t39 交付说明）。

`auto-assign`（t25 登记，**t26 已完成接线**）：动作 = dispatch('game/autoAssign')；
UI 实现见 `src/ui/views/projects.js:134-180`（只读 vm.autoAssign 渲染「点了会怎么分」的预览 plan、
反馈 feedback、上次摘要 last、两个上限 boundary，自己不推导任何规则、不给 state 赋值），
handler 在 `src/ui/app.js:92` 注册，静态文案在 `src/ui/copy.js` 的 `UI_AUTO_ASSIGN`。

`projects-intro-dismiss`（t34 登记，**t39 补登记入表**）：**一次性本地引导的关闭按钮** ——
点掉后只置 `ui/app.js` 的 `localUi.projectsIntroDone = true` 并重渲染（app.js:96），
引导块本身在 app.js:290/:309 渲染，**不写 GameState、不 dispatch、不进存档**；
因此重开一局/刷新页面会重新出现（这是刻意的：新玩家每次都该看到一次引导）。

（2026-10 补登记：reset-confirm / resign-confirm / defer-choice / help / modal-close / receipt-open /
ending-hide / rename-open / rename-apply / goto-tab / lab-section / chronicle-filter / grab-confirm /
grab-cancel 这些 handler 在 t5–t10 期间新增，此前契约表漏列。表以 src/ui/app.js 的 HANDLERS 键为准，
scripts/check.mjs 会校验「index.html 里出现的 data-action 必须已注册」。）

约定的 dataset 字段：data-tab data-student-id data-project-id data-offer-id data-id data-tier
data-mode data-amount data-action-id data-hardpoint-id data-choice-id data-paper-id data-choice
data-section data-filter。

### 6.4 渲染规则

- 视图必须用 src/ui/dom.js 的 h() / mount() / clear() / bar() / tag() / button() **构建 DOM**，
  禁止 innerHTML（scripts/lib/dom-shim.mjs 在冒烟时会直接抛错）。
- 文本一律 textContent；所有交互挂 data-action，由 #app 上的事件代理统一分发。

---

## 7. 契约变更流程

1. 改本文件 + docs/CHANGELOG.md；
2. 若动了 GameState：STATE_VERSION +1 + MIGRATIONS + docs/ARCHITECTURE.md §3；
3. 跑 node 评院士/scripts/check.mjs、simulate.mjs、ui-smoke.mjs、build-single.mjs（或 npm test）；
4. 契约变更必须写进给主程/前端的交接说明，不允许口头约定。

### 7.1 契约校验工具（可复跑；改契约后**必须**跑）

    node _t18-probe/contract-coverage.mjs   # 符号级：契约声明能否在代码里找到（含双向 data-action、selector 字段级、bots 配置字段）
    node _t18-probe/contract-values.mjs     # 数值级：「常量名 = 数值」与代码导出值逐一比对（t46 新增）
    node _t18-probe/md-sanity.mjs           # 文档结构：覆盖 docs/ 下全部 .md（见下）

三条命令都必须 **exit 0**；产品侧脚本（check / simulate / ui-smoke / build / tests）见本节第 3 条。

- **【纪律·改文档只用定点编辑（t49）】改 docs/ 下的文档必须用定点 edit（改哪段写哪段），
  `禁止「读整个文件 + 写整个文件」的覆盖式写回`。** 理由不是洁癖：这种写法在并发编辑下会用**陈旧快照**
  把别人的改动整段抹掉，而且**不产生任何冲突信号** —— t48 就是这样发现 CONTRACT 的 §9.2–§9.5 被截断，
  文件停在 §9.1 表格中途（bytes 63266 → 53286），没有任何一条命令报过红。
  这条纪律与上面三条探针命令**并列**：探针负责「事后能发现」，定点编辑负责「事前不发生」。
- **md-sanity 的覆盖与判据（t49 扩面）**：扫描 `docs/*.md` **全部 10 份**（ARCHITECTURE / ASSETS / BALANCE /
  CHANGELOG / CONTRACT / DEV / GDD / RESEARCH / SPEC / VERIFICATION）。FAIL 四类：**(a)** 文件末尾停在表格行中途
  （以 `|` 开头却不以 `|` 结尾）；**(b)** 代码围栏未闭合（``` 行计数为奇数，允许 ```bash 这类语言标签）；
  **(c)** 段落内行内反引号未闭合（按「段落」统计，允许代码跨度跨行）；**(d)** 表格行竖线数与表头不一致
  （`\|` 转义的不算）。advisory（不判失败）：**(e)** 文件不以换行结尾（现状：CHANGELOG.md 与 CONTRACT.md 两份缺尾换行）。
  「已登记基线」= 他人负责、已确认存在但本轮不由架构师修的破损（报出来、计基线、不判失败）；
  责任人修好后从 BASELINE 删除即恢复硬失败。

- **数值级覆盖（t46 实测）**：12 条标量 —— STATE_VERSION / FIRST_AUTHOR_DROUGHT_MONTHS / PROJECT_SLOTS /
  STUDENT_SLOTS / MARKET_SLOTS / PROJECT_OFFER_TTL_MONTHS / STUDENT_OFFER_TTL_MONTHS /
  MIN_ACCEPTABLE_PROJECT_OFFERS / MIN_RECRUITABLE_STUDENT_OFFERS / SUPPLY_FLOOR_12M /
  MAX_PROJECTS_PER_STUDENT / PROJECT_MAX_STUDENTS；2 个扁平对象字面量（INTEGRITY_DELTA 15/15 键、
  JOURNAL_IF_BASE 5/5 键）；2 个扁平数组（PHASE_ORDER、PAPER_TIER_ORDER）。
- **未覆盖（如实登记，不假装覆盖）**：① 嵌套结构 `HARDPOINT_HD_DIST`（`{1:[[1,1.0]],…}` 需递归解析，当前人工核对）；
  ② 表格行/引用块里的**历史数值**（§8 勘误、t45「数值同步」注记等）—— 它们不是当前声明，探针按结构规则跳过并在输出里点名；
  ③ 纯散文描述的量（如「跨学科 IF 量级估算」）与单位换算说明；④ 未以「常量名 = 数值」形式登记的量 ——
  **要让某个常量被机器核对，先按 §1.x 的代码块形式写进来**（t46 已顺手补登 MAX_PROJECTS_PER_STUDENT /
  FIRST_AUTHOR_DROUGHT_MONTHS 两条）。
- **负向对照纪律**（证明尺子有刻度，≠ 把尺子掰弯）：临时改错契约数值 → 探针必须**红**并打印双方数值 →
  恢复 → 必须**绿**，且恢复后文件 sha256 与改前一致。已留痕：把 §1.4 的 `PROJECT_SLOTS = 7` 临时改成 5 →
  `FAIL PROJECT_SLOTS 契约=5 代码=7`；恢复 → PASS 且 sha256 一致（t46）。


---

## 8. 契约勘误记录（Errata）

> 只记录「契约文字曾与实现/GDD 相反、或被误读」的修正，防止被再次误引。功能性的契约演进记在 docs/CHANGELOG.md。

| 日期 | 位置 | 曾写成什么 | 实际是什么（依据） |
|---|---|---|---|
| 2026-10 | §2 论文归属判定 | 「player.papersFirst …只影响诚信与结局文案，不参与晋升门槛」，容易被读成「买/抢的论文不进 papers、不进门槛」 | 抢/买一作**计入晋升门槛**：结题时该篇已按档位进 papers，抢/买再各 +1；papersFirst 只是台账。抢一作**不重复计 IF**（依据：GDD §5.5 + engine.finishProject / reduceGrabFirstAuthor） |
| 2026-10 | §1.4 市场席位 | MARKET_SLOTS = 5，项目与学生共用一个池子（国家 3 + 企业 2） | PROJECT_SLOTS 5 + STUDENT_SLOTS 3 = MARKET_SLOTS 8；两类 offer 独立配额 + 各自 TTL(6) + 不变式「≥1 个当前可承接项目 / ≥1 个够得着的候选人」（依据：data/projects.js、data/market.js、engine.refreshMarket） |
| 2026-10 | §3.1 | 表里没有 game/chooseDefer、game/setName；买/抢一作仍写作 {tier?} | chooseDefer {studentId, choice:'defer'\|'giveUp'}、setName {name?, sonName?} 已登记；买一作 tier 必填、抢一作 {studentId, paperId, tier} 全必填（依据：engine.ACTIONS + 各 reduce* 实现） |
| 2026-10 | §3.4 | 未登记 vm.consts / vm.receipt / vm.pendingDefer；selectors 未登记 selectPendingDefer / selectReceipt / selectUiConstants / selectHardpoint.attempts | 已登记（依据：viewmodel.buildViewModel 返回对象、selectors 导出表） |
| 2026-10 | §2 / §3.5 | 未登记 Student.soloThisMonth、eventState.cooldowns、stats.lastReceipt、counters.deferredStudents、flags.negativeMoneyMonths 的运行期创建；并把 STATE_VERSION 误列在 save.js 名下 | 字段已在 §2 补齐并注明来源；STATE_VERSION 归 state.js（save.js 只导出 SAVE_VERSION = STATE_VERSION），改契约、不改代码 |
| 2026-10 | §6.1 / §6.3 | 视图表缺 copy.js / receipt.js；data-action 表缺 t5–t10 新增的 14 个 handler | 已补齐（依据：src/ui/ 文件清单、app.js 的 HANDLERS） |
| 2026-10（t24） | §2 论文归属（**第二次**修正；区别于上表第一行的 t18 文字修正） | papers = 计入门槛的论文计数（含学生一作）；本节原「待策划裁定」条目 | t24 起 papers = **玩家一作数**：亲带项目全部归玩家、学生一作不进 papers、买/抢各 +1；totalIF 仍是全部论文。STATE_VERSION 1→2，MIGRATIONS[1] 按结题台帐重算（依据：engine.awardPaper engine.js:484-489、finishProject engine.js:404-431、save.js:25-50） |
| 2026-10（t24） | §3.5 / §5 | 「save.js 不导出 STATE_VERSION」（t18 的结论）、「STATE_VERSION = 1」 | t16 F8 已让 save.js 重新 **re-export** STATE_VERSION；t24 把值升到 **2**。现 §3.5 两处都列，取值唯一来源是 state.js（依据：save.js:19-22、state.js:31） |

**已解决（原「待策划裁定」条目）**：GDD §2.7「晋升门槛只统计玩家为一作的论文」与实现的口径差，
已由 t24 的 v2 一作归属模型消除（papers 收窄为玩家一作数）。若将来再动这个口径，仍须
STATE_VERSION +1 + 补迁移 + 重跑平衡标定（属策划决策范围）。

---

## 9. 测量脚手架与统计红线（src/systems/bots.js + tests/）

> **为什么进契约**：通关率、供给、门槛这些「红线」全部由无头机器人跑出来。机器人**不是产品代码**
> （不被 main.js 引用、不进 dist 单文件），但它的**配置字段**与**统计口径**是团队共同依赖的测量接口——
> 改了它，所有红线的读数就变了。故在此冻结：常量名、所在模块、消费方、以及每条配置的定位与现状。

### 9.1 STRATEGIES（版本化配置）—— 当前 5 条

| id | label | 定位 | 归属 |
|---|---|---|---|
| speedrun | 速通院士 | 上限性能对照（效率/通关速度） | BALANCE §15.3 红线 1 |
| casual | 随手玩 | **主线验收路线**：随手玩通关率 | BALANCE §18.15（当前区间 [85%, 95%]，**t42 起为信息性**，见 9.4） |
| conservative | 保守经营 | 「保守但合规」的对照尺子（**当前有未裁定缺陷，见 9.3**） | BALANCE §18.18 裁定 ③ |
| balanced | 中庸经营 | **负面对照**：`usePlayerLead:false` + `buyFirstAuthorMax:0` ⇒ 玩家一作恒为 0 ⇒ rank2 起不可达；**0/8 是期望值，不是难度问题** | BALANCE §18.18 裁定 ③ |
| cheater | 诚信崩盘 | 负向路线对照（应走向「被举报」） | BALANCE §12 结局验收 |

### 9.2 conservative（保守经营）—— 逐字段登记（t41 立；来源 BALANCE §18.18 裁定 ③）

    conservative = { id:'conservative', label:'保守经营',
      consumeModePolicy:'adaptive', consumableMonths:6, moneyReserve:20,
      hire:true, hireMinAbility:0.45, buyEquipment:true,
      projectScore:'ifPerWorkload', studentsPerProject:5, hardpointMethod:'team',
      grabFirstAuthors:false,                        // 保守 = 不碰诚信红线
      usePlayerLead:true, leadMinTier:4, leadMax:4,   // ★ 只对 T4+ 在研项目开亲带（leadMinTier 读于 bots.js:478）
      exerciseHealthFloor:72, teamBuildHappyFloor:52, keepCrewFloor:5, deferHappyFloor:45,
      buyFirstAuthorTiers:['top','q1'], buyFirstAuthorMax:1,   // ★ 缺口才出手、最多买 1 篇
      integrityFloor:30 }

- **与 casual 的真实差异（程序化 diff，共 5 项）**：`id`、`label` 两个标识项 + 三个实质项 ——
  `buyFirstAuthorMax` 3 → **1**；`leadMinTier` **4**（casual 无此字段，等价 0）；`buyFirstAuthorTier`
  casual = `'top'` 而 conservative **未设**（走实现里的默认档）。
  ⚠ 派工单里写的「其余四项与 casual 相同」与实测不符（差在 `buyFirstAuthorTier`）——**以本节为准**。
- **定位**：`casual` 的「更保守、但同样合规」的兄弟路线：它**也**亲带、也买一作，只是更挑（只亲带 T4+、最多买 1 篇）。
  属 BALANCE §18.9 **尺子纪律**管辖——它是**尺子**，不是难度档位；不许为「让它好看」而调它的数值。

### 9.3 【未定稿】conservative 的当前状态与待裁定项（必须与 9.2 一起读）

- **实测（t41）：spec 原样的 conservative 通关 0/8**（8 局全部 retire）。诊断：亲带篇数恒 0、
  出现过的最高项目等级 ≤ T2、末局恒 rank1、缺口恒 q2 ⇒ **启动段自锁**：
  「只亲带 T4+」 ← 但接 T4+ 要 rank3 ← rank3 要 q1/q2 ← 一作只能靠亲带/买/抢 —— 环。
- 该状态目前被 `tests/conservative.test.mjs:57` **当作「登记在案的缺陷签名」断言**
  （`s.eq(wins.length, 0, '【登记在案的缺陷签名】…')`），文件里写明：**此条变红 = 启动段死锁已被修好，
  届时必须把配置改成能通关的版本并更新该断言与本文件的诊断。**
- **修法已定位（t41 实测）**：`leadMinTier 0 + leadMax 2` → 4/4 通关；`leadMinTier 3` → 仍 0/4。
  即需要一条「供给为 0 的**启动段 bootstrap 规则**」，不是降门槛、也不是 N5/N6 经济性。
- **待策划裁定（t43）**：bootstrap 规格落定之前，本配置**不是已定稿的验收尺子**；引用它时必须同时写明
  「当前为缺陷签名状态（0/8，启动段自锁，待 t43）」。
- 顺带登记的读数（区分度证据）：conservative **总产出更高**（8 局结题 455 项 vs casual 通关 8 局 207 项）
  却 0 晋升 —— 「**产出 ≠ 晋升**」的直接证据，说明卡点不在经济性/门槛。

### 9.4 统计红线的分工与纪律

- 红线**数值**归 BALANCE（§15.3 效率、§18.15 通关率、§18.18 三项裁定）；契约只冻结**测量接口**：
  常量名、所在模块、消费方与禁止写法。
- **【t42 状态指针（t48 补）】通关率 / 停滞 / 结题数 / 路线结局类红线自 t42 起为【信息性·非门禁】**：
  机器人策略 ≠ 真人，用户已裁定把它们逐出发布门禁（出处 **BALANCE §18.19** 第 1/2 条）；
  `scripts/check.mjs` 第 12 项反向保证「不得把它们变回门禁」，并要求保留 `【信息性·非门禁】` 标记。
  ⇒ 引用任何通关率读数时，必须同时写明它是**信息性读数**，不得表述为「红线通过/未通过」。
- **【acceptRiskyWhenIdle 是负载开关（t48 补，t17 独立对照实验）】**：默认臂速通 **7/8**
  （academician 7 + lab_empty 1）vs `--idle-guard=off` 臂速通 **2/8**（academician 2 + lab_empty 5 + reported 1），
  **两臂都「无 ≥6 月零进展段落」**。⇒ 它不掩盖游戏停滞（停滞形态由 t22 市场解耦消除），但**速通读数与它强耦合**：
  引用速通读数时必须**同批报两套**（与 slots / TTL 同级纪律）。
  ⚠ BALANCE §18.9 的尺子纪律**亦应登记此项**（BALANCE 归策划师，本契约只出指针，不由架构师改）。
- `SUPPLY_FLOOR_12M`（§1.4）是**绝对下界**，由 `tests/market.test.mjs` 直接 import；
  **禁止**再出现「由 slots/TTL 反推的下界」（下界随被测参数一起降 = 永远绿）。
- 机器人新增/改名的配置字段（`leadMinTier` / `leadMax` / `buyFirstAuthorTiers` / `buyFirstAuthorMax` /
  `usePlayerLead` / `acceptRiskyWhenIdle` 等）属于测量接口：**必须在本节登记**，否则红线读数不可复现。
- 统计口径统一为 `ifPerWorkloadTable().ifPerSlot` = **IF / (W × 0.85)**；字面 IF/W 口径已作废（BALANCE §15.3）。

### 9.5 tests 的契约面（跑法 `node 评院士/tests/run-all.mjs`，当前 7 个脚本）

| 脚本 | 冻结什么 |
|---|---|
| promotion / happiness / project / market / save / balance | 见 §7 变更流程；balance 只管读数与锚点回归（通关率类自 t42 起为信息性） |
| `tests/market.test.mjs` | 市场不变式 + 供给下界 `newReach >= SUPPLY_FLOOR_12M`（绝对常量，import 自 data/projects.js） |
| `tests/conservative.test.mjs` | conservative 的逐字段 spec（实测 104 行 / 24 处断言：ok 8 / eq 12 / note 4）+ 与 casual 的区分度 + 9.3 的缺陷签名 |

> 新增 tests 脚本要**同时**改 `scripts/check.mjs` 的「断言脚本齐全」清单与 `tests/run-all.mjs` 的 FILES 数组（当前 7 个）。
>
> **修复留痕（t48）**：本节 9.2–9.5 曾在一次并发编辑中被误截断（文件在 9.1 表格中途结束），
> 由架构师按 t45 的 CHANGELOG 记录与本轮实测逐条恢复，并补上 9.4 的两条指针（t42 信息性状态、acceptRiskyWhenIdle 负载开关）。
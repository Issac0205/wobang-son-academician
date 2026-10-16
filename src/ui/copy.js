/**
 * copy.js —— UI 层静态文案（只放「字」，不放「数」）
 *
 * 约定（docs/CONTRACT.md §6 + t5 验收「UI 层不含任何数值公式」）：
 *   · 本文件只允许出现产品文案/标签/空态/帮助说明，禁止出现任何数值阈值、倍率、价格。
 *   · 一切数字都从 vm（src/core/viewmodel.js）取；缺字段时降级为纯文字描述。
 *   · 文案风格对齐 GDD §10.1：用官方口吻包装荒诞机制；不做道德说教；具体到物件。
 */

export const UI_SUBTABS = [
  { id: 'overview', label: '总览', hint: '身份、资源、论文账目、晋级进度' },
  { id: 'students', label: '学生名册', hint: '名额、学生、工资、一作' },
  { id: 'instruments', label: '仪器台', hint: '持有量、加成、维护费' },
  { id: 'consumables', label: '耗材库', hint: '消耗模式与采购' },
];

/** 四个行动：SPEC 固定名称，UI 侧只提供「没有数字」的兜底说明。 */
export const UI_ACTION_LABELS = {
  talk: '与学生交流课题',
  meeting: '开组会',
  exercise: '锻炼与享乐',
  teambuild: '去团建',
};

export const UI_ACTION_HINTS = {
  talk: '指定一名学生和他手上的一个项目，坐下来把问题聊透：项目往前走，人也顺气。',
  meeting: '把全组叫进会议室：手上项目一起推进，气氛回暖。同一个月开太多次，没人再带本子。',
  exercise: '跑步、游泳，或者干脆睡一整天。身体是本钱，健康决定你每月的精力上限。',
  teambuild: '全组出去吃一顿。幸福感靠预算买，按人头结账。',
};

/** 工资四档（SPEC 固定四档）：UI 只放标签，金额来自 vm 的 wageCost。 */
export const UI_WAGE_TIERS = [
  { id: 'high', label: '高' },
  { id: 'mid', label: '中' },
  { id: 'low', label: '低' },
  { id: 'none', label: '无' },
];

/** 难点三种处理方式：SPEC 固定名称 + 没有数字的兜底说明。 */
export const UI_METHOD_LABELS = { team: '多人攻坚', fake: '造假蒙混', solo: '单人猛干' };
export const UI_METHOD_FILE = {
  team: '抽调多名学生集中攻坚一个月：其他项目进度受损，但不动诚信。',
  fake: '一步到位，代价是诚信，且被查的概率会随次数累积。',
  solo: '让一名学生这个月只干这一件事：额外花钱，该生幸福感大降。',
};

export const UI_METHOD_TONE = { team: 'info', fake: 'bad', solo: 'warn' };

/** 空态文案：告诉玩家「现在该做什么」，而不是只说「没有」。 */
export const UI_EMPTY = {
  students: '名册是空的。去「市场」页的考研生池、保研生池看简历，招两个进来。',
  // T21-F2（t35）：指向市场的前提是「市场里真的有你能接的本子」——
  // 判定用可接 offer 数（OfferRow.canAccept），不是列表长度：池子里可能全是接不了的（锁定/够不着）。
  projectsToMarket: '没有在研项目。下面「项目市场」里有你能接的本子，接一个，再把学生派上去。',
  projectsNoMarket: '没有在研项目，这个月市场里也没有你能接的本子：等下个月结算刷新，或者先去「一作交易台」看看。',
  offers: '这个月市场里没有能接的本子：下个月结算后会补上新的。',
  candidates: '这个月没人投简历。市场一年只开几个月，先用现有的人把项目顶起来。',
  equipment: '仪器台空了。先去「耗材库」确认有耗材，再回「仪器台」买设备。',
  chronicle: '还没有发生任何值得记下来的事。推进一个月试试。',
  active: '名下没有在读学生。招人——这是唯一能把项目推起来的办法。',
};

/** 一键分配工作（t25/t26）：数字与文案里的每个数都来自 vm.autoAssign，UI 只排版不推导。 */
export const UI_AUTO_ASSIGN = {
  button: '一键分配工作',
  previewOn: '点下去会安排 {n} 个岗位（触达 {s} 名学生）；学生最多同时带 {studentCap} 个项目、项目最多收 {projectCap} 人。',
  previewOff: '没得分：{feedback}',
  previewListTitle: '点了会这么分（只列前 {n} 条）',
  previewItem: '{studentName} → {projectName}',
  boundary: '一键分配的边界：学生最多同时带 {studentCap} 个项目、项目最多收 {projectCap} 人（手工点选不受这条限制）。',
  lastTitle: '上次一键分配（第 {month} 月）',
  lastMoved: '安排了 {n} 个岗位 · 触达 {s} 名学生',
  lastNone: '这次一个岗位都没动',
  lastNoneHint: '分配结果和上次完全一样——引擎是幂等的，按钮已经无事可做，不会假装又分一轮。',
  studentsFullLabel: '名额已满',
  projectsShortLabel: '仍然缺人',
  projectShortItem: '{name} {members}/{cap} 人',
  noMarketNote: '注意：这个月「项目市场」里没有你能接的本子，去市场也接不到——下个月结算后会补充。',
  studentsWithoutLabel: '暂时排不下',
  noneLabel: '无',
};

/**
 * 一作空窗提示（t35 第 ① 件 / DEV §7.4 第 6 条）。
 * 触发与阈值全部由 core 判定（vm.hud.firstAuthorDrought = { months, stuck, threshold }），
 * UI 只负责把 core 给的 months / threshold 填进句子，不自己算任何阈值。
 */
export const UI_DROUGHT = {
  tag: '该弄一篇你的一作了',
  title: '距上次拿到「你自己署名的一作」已经 {months} 个月（提醒阈值 {threshold} 个月）。三条路任选一条：亲带一个项目（该项目推进 ×0.85）／抢一篇（诚信 −8）／买一篇（诚信 −4）。',
  help: '缺一作会一直卡在副研究员：点项目卡片的「我亲自带」，或者去「一作交易台」。',
};

/** 论文分区计数（t24 后的真实语义）：主数字＝你的一作篇数（晋升门槛按它算），「抢/买」是台账。 */
export const UI_PAPER_TILE = {
  title: '{tier}：你的一作 {count} 篇（晋升门槛按它算）；其中抢/买来的台账 {grabbed} 篇',
  first: '一作 {n}',
  grabbed: '抢/买 {n}',
  grabbedTitle: '{tier}：抢学生或花钱买来的一作台账 {n} 篇（已计入你的一作）',
  legend: '分区计数＝你的一作篇数（晋升门槛按它算）；「抢/买」是抢学生或花钱买来的台账，另计。',
};

/**
 * 总览「下个头衔」缺一作时的提示（DEV §7.4 第 1 条 / GDD §2.9）。
 * 触发条件只用 core 给的机器可读 key（rankStatus().missing[].key ∈ q1|q2|top），
 * 阈值与判定全在 core；这里只负责「缺的是一作」时多写一句话。
 */
export const UI_RANK_HINT = {
  tag: '晋升只认你的一作',
  missingFirstAuthor: '缺的是你自己署名的一作。全组论文再多也不算——去项目卡片点「我亲自带」，或者用一作交易台。',
  routes: '拿到一作只有三条路：亲带（该项目论文一作全归你，代价：该项目推进 ×0.85、每月多 1 点精力）／抢（诚信 −8、该生幸福度 −30）／买（花钱、诚信 −4，没有真实产出）。',
};

/** 首次进入项目页的一次性引导（DEV §7.4 第 5 条）：只存 app.js 的本地状态，不写 GameState。 */
export const UI_PROJECTS_INTRO = {
  title: '先看这一句：评职称看你本人的一作',
  text: '评职称看你本人的一作。要么亲自带项目，要么抢、要么买——一条都不做，你会一直停在副研究员。',
  hint: '全组发再多论文也只算总影响因子；晋升门槛数的是「你署名为一作」的那几篇。',
  dismiss: '知道了，去接本子',
};

/** 亲带（t24 之后 project.playerLeading 真正决定一作归属）。 */
export const UI_LEAD = {
  on: '取消亲带',
  off: '我亲自带',
  titleOff: '你亲带的项目，论文一作全部归你；代价：该项目推进 ×0.85、每月多消耗 1 点精力',
  titleOn: '正在亲带：论文一作全部归你；代价：该项目推进 ×0.85、每月多 1 点精力。再点一次取消亲带',
  note: '亲带＝这个项目的论文一作全部归你（晋升门槛按你的一作算）· 该项目推进 ×0.85 · 每月多 1 点精力',
};

/** 帮助弹层：新玩家第一次打开就能看懂「现在该做什么」。 */
export const UI_HELP_SECTIONS = [
  { title: '你在干什么', text: '你是课题组负责人。目标只有一个：把职称从副研究员一路推到院士。经费、学生、仪器、项目都是手段。' },
  { title: '一个月怎么过', text: '行动阶段：先花精力（交流课题、开组会、锻炼、团建），再点「下一个月」进入结算。结算会涨项目进度、发工资、扣维护费、抽随机事件，结果都写在「上月结算回执」里。' },
  { title: '钱从哪来', text: '经费三个来源：学校的月度拨款、项目定金与尾款、黄金年龄的额外资助。耗材资金要用经费去采购，见「课题组 · 耗材库」。' },
  { title: '论文怎么来', text: '项目结题会自动产出论文，档位取决于项目等级、难点是否解决、以及学生水平。总影响因子和分区计数决定你能不能晋级。' },
  { title: '两条捷径', text: '抢一作（对学生，便宜但伤人和诚信）和购买一作（直接花钱）。抢一作按「结题产出的某一篇」来算：一篇只能抢一次、一个人一个月只能抢一篇，而且点下去会先让你确认一遍档位和代价。系统不骂你，账都在纪事里记着。' },
  { title: '延毕要你签字', text: '学生读到年限还没毕业，会挂起成「待决」：弹层里二选一——让他延毕一年（在读月数 +12 个月、幸福度大幅下降、不占招生名额，硕士最多 2 次、博士 3 次），或者让他肄业离组。没拍板之前「下一个月」是点不动的，时间等你。' },
  { title: '什么时候会输', text: '诚信归零被举报、连续赤字被解散、健康归零住院、学生跑光、或者到退休年龄还没评上。坏结局也是一种结局。想提前收摊可以点「下海」——会先跟你确认一次，确认后本局立刻结束、结局记进纪事。' },
  { title: '一键分配与亲带', text: '项目多了可以用「一键分配工作」：引擎先把每个学生至少塞进一个项目，再把剩下的名额铺满缺人的本子，分完会把「谁满了、哪个本子还缺人」摊给你看。点「我亲自带」则是你亲自上：这个项目的论文一作全部归你（晋升门槛按你的一作算），代价是这个项目推进 ×0.85、每月多 1 点精力。' },
  { title: '素材与授权', text: '界面图标部分取自 Lucide（ISC 许可证），已随分发包内联；页面字体用系统字体，运行时不请求任何外部资源。完整素材清单与许可证全文见 docs/ASSETS.md。' },
];

/** 纪事筛选分组：按 core 写入的 kind 归类。 */
export const UI_CHRONICLE_FILTERS = [
  { id: 'all', label: '全部', kinds: null },
  { id: 'project', label: '项目', kinds: ['project', 'hardpoint', 'warn'] },
  { id: 'student', label: '学生', kinds: ['student'] },
  { id: 'money', label: '钱', kinds: ['money', 'market', 'audit'] },
  { id: 'rank', label: '头衔', kinds: ['rank', 'ending'] },
];

/** 结算回执的分组标题。 */
export const UI_RECEIPT = {
  title: '上月结算回执',
  empty: '还没有结算过。点右上角「下一个月」，这里会列出：钱怎么变的、项目涨了多少、谁的心情变了。',
  detailTitle: '结算明细',
  // t6 finding（low）：回执里的耗材数是「本月净变化」，不是库存——曾把玩家误导成「库存为负」
  consumableLabel: '耗材资金净变化',
  consumableDetailLabel: '耗材资金净变化（单位）',
  consumableStock: '（本月结余后库存 {stock} 单位）',
  noProject: '本月没有项目推进。',
  noStudent: '本月学生状态没有变化。',
};

/** 结局画面用的字段名（数值全部来自 vm）。 */
export const UI_ENDING_FIELDS = [
  { key: 'rank', label: '最终头衔' },
  { key: 'if', label: '总影响因子' },
  { key: 'papers', label: 'SCI 一作' },
  { key: 'projects', label: '结题项目' },
  { key: 'students', label: '培养毕业' },
  { key: 'integrity', label: '诚信' },
  { key: 'age', label: '年龄' },
  { key: 'months', label: '任职月数' },
];

export const UI_LOCAL_MODALS = { rename: 'rename', help: 'help', receipt: 'receipt', reset: 'reset' };

export const UI_RNAME = {
  title: '改个名字',
  playerLabel: '课题组负责人',
  playerHint: '对外署名的那个名字。你儿子其实没在这张表上。',
  sonLabel: '儿子',
  sonHint: '你挂在嘴边的那个名字：评院士的真正理由（借口）。',
  apply: '签上名字',
  cancel: '再想想',
  inputId: 'rename-input',
  sonInputId: 'rename-son-input',
};

export const UI_RESET = {
  title: '重开一局',
  text: '当前存档会被清掉，从副研究员、第一年一月重新开始。这一步不可撤销。',
  confirm: '确认重开',
  cancel: '手滑了',
};

/** 下海（结束本局）确认：t8 finding 要求「先确认再 dispatch」。 */
export const UI_RESIGN = {
  title: '下海（结束这一局）',
  text: '这一局立刻结束：不再有月份结算，这个结局会记进纪事，本局不能继续。这一步不可撤销。',
  confirm: '确认下海，收摊',
  cancel: '再干两年',
};

/**
 * 项目市场（T11-F1 ①②）：与人才市场彻底分开——
 * 项目全年可接、每月结算后补充；只有人才市场才有「招生季开 / 关」。
 * 这里绝不引用 vm.market.open / vm.market.openText（那是人才市场按 MARKET_OPEN_MONTHS 算的口径）。
 */
export const UI_PROJECT_MARKET = {
  subtitle: '全年可接 · 每月结算后补充新本子（先看仪器要求，再看工期）',
  emptySubtitle: '这个月还没发标 · 下个月结算后刷新',
  // T21-F2：池子里有本子但一个都接不了（被锁 / 仪器头衔够不着）——不能说「市场里没有本子」
  lockedOnlySubtitle: '这个月没有你能接的本子',
  lockedOnlyNote: '池子里确实有本子，但都接不了：要么被锁定观察了，要么仪器/头衔还够不着。下个月结算后会补充新的。',
  recruitHint: '招人在「市场」页：保研生 / 考研生按招生季投简历',
};

/** 一作交易台（购买一作）的静态文案：档位/价格数字仍由 vm.consts.papers 提供。 */
export const UI_PAPER_SHOP = {
  title: '一作交易台',
  subtitle: '「导师对论文贡献度的再评估」（GDD 原话）',
  kvGrabbed: '抢/买来的一作',
  kvTotal: '论文合计（含一作）',
  // 兜底：core 没给档位价格表时，购买一作在 t10 之后必须指名档位，不存在「不带档位也能买」的路径。
  // 缺口 1（DEV §7.4 / GDD §2.9 ③）：讲清楚「买」买到的是什么、买不到什么
  honest: '购买一作＝花钱买署名，没有真实产出；越厉害的文章越贵。',
  fallbackButton: '买一篇一作',
  fallbackNote: '没取到档位价格表（vm.consts.papers.price）：购买一作暂时不可用，缺档位的请求引擎会直接拒绝。先去「学生名册」抢一篇结题产出的。',
  integrityHint: '购买一作便宜但掉诚信；抢一作更伤人和诚信。系统不骂你，账都记在纪事里。',
};

/** 抢一作：按「结题产出的某一篇」操作 + 二次确认（数值全部由 vm.consts.papers 提供）。 */
export const UI_GRAB = {
  section: '可抢的一作',
  sectionHint: '结题产出的论文按篇记账：一篇只能抢一次，一个人一个月只能抢一篇。',
  button: '抢他一作',
  confirmTitle: '确认抢这一篇？',
  confirm: '确认抢（署名改我）',
  cancel: '算了，留给他',
  grabbedAt: '已在第 {month} 个月抢走',
  grabbedThisMonth: '本月已经抢过一篇，下个月再来',
  noPaper: '名下还没有结题产出的一作论文：项目结题之后才谈得上抢。',
  gainTier: '到手一作档位',
  gainIf: '总影响因子',
  loseIntegrity: '你的诚信',
  loseHappy: '他的幸福度',
  grudge: '心结时长',
  monthsUnit: '个月',
};

/** 延毕决定弹层：与随机事件同级的待决状态（没选完不能推进月份）。 */
export const UI_DEFER = {
  title: '学制读满了：延毕还是肄业？',
  subtitle: '不可逆的二选一 · 选完才能进下一个月',
  studentLine: '学生',
  deferButton: '让他延毕一年',
  giveUpButton: '让他肄业',
  deferEffect: '在读月数 +{months} 个月、幸福度 {happy}（一次性）、不占招生名额；硕士最多 {quotaMaster} 次、博士 {quotaPhd} 次',
  giveUpEffect: '直接离组：组里少一个人，他手上的项目进度会被带走一部分，诚信 {integrity}',
  irreversible: '两条路都不能反悔；这也是「延毕」唯一的入口——以前是自动发生的，现在由你签字。',
  quotaUsedUp: '延毕次数已经用满，只剩肄业这一条路。',
  // core 没给 vm.consts.defer 时的兜底：不带数字，但必须说明两边都不可逆
  noConsts: '两条路都不可逆：延毕会大幅降他的幸福度、还占不到招生名额；肄业则直接少一个人（具体数值由 core 提供）。',
  pendingTag: '待决',
};

/** 耗材资金的单位说明（t8 finding：把「单位」与「万元」说清楚）。 */
export const UI_CONSUMABLE_UNIT = {
  note: '耗材资金按万元记：{unit} 单位 = {yuan} 万元（交付、消耗都走这一本账）。',
  packNote: '一批 = {pack} 单位 = {cost} 万。',
};

/** 难点三种处理方式的成功率/抽调提示。 */
export const UI_ATTEMPT = {
  chance: '成功率',
  catch: '被抓概率',
  pulled: '将抽调：',
  pulledNone: '暂时没人可抽：先去市场招人。',
  retry: '重试加成 +{pct}%',
  perPerson: '幸福 {happy}/人',
};

export const UI_TAB_IDS = { lab: 'tab-lab', projects: 'tab-projects', market: 'tab-market', actions: 'tab-actions', chronicle: 'tab-chronicle' };
export const UI_PANEL_IDS = { lab: 'panel-lab', projects: 'panel-projects', market: 'panel-market', actions: 'panel-actions', chronicle: 'panel-chronicle' };

export const UI_MONTH_REPORT_HINT = '每月结算后这里会列出账目变化。点「看明细」展开完整回执。';

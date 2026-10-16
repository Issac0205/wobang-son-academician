/**
 * projects.js —— 13 种项目模板 + 市场生成规则 + 承接门槛（BALANCE §5 / GDD §5）
 * SPEC 硬性：市场同时有国家项目与企业项目；每个项目有规定完成时间、当前进度、难点；
 *          承接得定金、完成得尾款；越高端对仪器要求越高。
 */

/** 论文槽位模板 id 序列（PA..PE 见 papers.js）。 */
/** @typedef {{id:string,name:string,category:'enterprise'|'nation',tier:number,workload:number,limitMonths:number,money:number,depositRate:number,consumablePerMonth:number,papers:string[],require:Record<string,number>,expectedIF:number,q1Expect:number,topExpect:number,hint:string}} ProjectDef */

/** @type {ProjectDef[]} */
export const PROJECTS = [
  { id: 'E1', name: '小横向（检测外包）', category: 'enterprise', tier: 1,
    workload: 80, limitMonths: 4, money: 8, depositRate: 0.40, consumablePerMonth: 0.8,
    papers: ['PD'], require: { centrifuge: 1 }, expectedIF: 2.44, q1Expect: 0, topExpect: 0,
    hint: '给企业测样品。钱少、活碎、不出论文，但定金率高。' },
  { id: 'E2', name: '中横向（工艺优化）', category: 'enterprise', tier: 1,
    workload: 170, limitMonths: 8, money: 30, depositRate: 0.40, consumablePerMonth: 2.0,
    papers: ['PC', 'PD'], require: { centrifuge: 1, shaker: 1 }, expectedIF: 6.16, q1Expect: 0, topExpect: 0,
    hint: '甲方要「再快一点、再便宜一点」。' },
  { id: 'E3', name: '大横向（新产品开发）', category: 'enterprise', tier: 2,
    workload: 380, limitMonths: 12, money: 80, depositRate: 0.40, consumablePerMonth: 5.0,
    papers: ['PC', 'PD', 'PD'], require: { centrifuge: 1, shaker: 1, hplc: 1, hood: 1 }, expectedIF: 8.60, q1Expect: 0, topExpect: 0,
    hint: '合同附件 37 页，验收标准由甲方心情决定。' },
  { id: 'E4', name: '战略横向（联合实验室）', category: 'enterprise', tier: 3,
    workload: 620, limitMonths: 15, money: 150, depositRate: 0.40, consumablePerMonth: 8.0,
    papers: ['PB', 'PC', 'PD', 'PD'], require: { centrifuge: 1, shaker: 1, hplc: 1, hood: 1, elisa: 1 }, expectedIF: 13.86, q1Expect: 0.15, topExpect: 0,
    hint: '挂牌那天来了三位领导，剪彩的剪刀是学生临时买的。' },
  { id: 'N1', name: '国家·青年基金 C 类', category: 'nation', tier: 1,
    workload: 130, limitMonths: 12, money: 25, depositRate: 0.30, consumablePerMonth: 1.6,
    papers: ['PB', 'PD', 'PD'], require: { centrifuge: 1, shaker: 1, hood: 1 }, expectedIF: 10.14, q1Expect: 0.15, topExpect: 0,
    hint: '研究：青基 C 类约 30 万、男 ≤35 岁 [A]。' },
  { id: 'N2', name: '国家·面上项目', category: 'nation', tier: 2,
    workload: 300, limitMonths: 18, money: 50, depositRate: 0.30, consumablePerMonth: 3.0,
    papers: ['PB', 'PB', 'PC', 'PC', 'PD', 'PD', 'PD'], require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 1 }, expectedIF: 25.27, q1Expect: 0.30, topExpect: 0,
    hint: '研究：面上约 50 万 / 4 年 [A]。函评意见永远是「创新性不足」。' },
  { id: 'N3', name: '国家·重点项目', category: 'nation', tier: 3,
    workload: 760, limitMonths: 30, money: 225, depositRate: 0.30, consumablePerMonth: 8.0,
    papers: ['PB','PB','PB','PB','PB','PB','PC','PC','PC','PD','PD','PD'], require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 1, elisa: 1, gc: 1 }, expectedIF: 50.01, q1Expect: 0.90, topExpect: 0.00,
    hint: '研究：重点约 225 万 / 5 年 [A]。结题要求里有一句「形成标志性成果」。' },
  { id: 'N4', name: '国家·青年基金 B 类（优青级）', category: 'nation', tier: 4,
    workload: 600, limitMonths: 24, money: 280, depositRate: 0.30, consumablePerMonth: 7.0,   // t30 §18.12：200→280（消除 T3 225 > T4 200 倒挂）
    papers: ['PA','PA','PA','PA','PB','PB','PB','PC','PC','PD'], require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 2, elisa: 1, gc: 1 }, expectedIF: 53.51, q1Expect: 1.81, topExpect: 0.04,
    hint: '研究：B 类约 200 万、男 ≤38 岁 [A]。帽子一戴，会议室的位置就变了。' },
  { id: 'N5', name: '国家·青年基金 A 类（杰青级）', category: 'nation', tier: 5,
    workload: 840, limitMonths: 36, money: 400, depositRate: 0.30, consumablePerMonth: 8.0,   // t30 §18.11：W 1100→840（IF/(W×0.85)=0.1052 ✓）、耗材 12→8
    papers: ['PA','PA','PA','PA','PA','PA','PB','PB','PB','PB','PC','PC','PD','PD'], require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 2, elisa: 1, gc: 1, ms: 1 }, expectedIF: 75.13, q1Expect: 2.64, topExpect: 0.06,
    hint: '研究：A 类（原杰青）约 400 万、男 ≤45 岁 [A]。' },
  { id: 'N6', name: '国家·国家重点研发计划', category: 'nation', tier: 6,
    workload: 1400, limitMonths: 36, money: 1100, depositRate: 0.30, consumablePerMonth: 18.0,   // t30 §18.11：W 2000→1400、期限 48→36、耗材 24→18、合同 800→1100（IF/(W×0.85)=0.1265 ✓）
    papers: ['PE','PE','PE','PE','PE','PE','PE','PE','PE','PE','PA','PA','PA','PA','PA','PA','PB','PB','PB','PB','PC','PC','PD','PD'], require: { centrifuge: 1, shaker: 1, hood: 1, hplc: 2, elisa: 2, gc: 1, ms: 1 }, expectedIF: 150.53, q1Expect: 6.44, topExpect: 0.26,
    hint: '研究：项目千万级、负责人 ≤60 岁 [C]。三层架构：专项-项目-课题，写本子的人在第一层。' },
  // v1.2：沿用 E2/E3/N3 同档工作量、资金与论文槽位，不改原项目难度。
  { id: 'E5', name: '横向·紫外可见定量检测', category: 'enterprise', tier: 1,
    workload: 170, limitMonths: 8, money: 30, depositRate: 0.40, consumablePerMonth: 2.0,
    papers: ['PC', 'PD'], require: { centrifuge: 1, uvvis: 1 }, expectedIF: 6.16, q1Expect: 0, topExpect: 0,
    hint: '建立标准曲线，测定样品浓度；需分光光度计完成定量检测。' },
  { id: 'E6', name: '横向·分子检测方法开发', category: 'enterprise', tier: 2,
    workload: 380, limitMonths: 12, money: 80, depositRate: 0.40, consumablePerMonth: 5.0,
    papers: ['PC', 'PD', 'PD'], require: { centrifuge: 1, hood: 1, pcr: 1, gel: 1 }, expectedIF: 8.60, q1Expect: 0, topExpect: 0,
    hint: 'PCR 扩增后用凝胶成像验证条带；两台设备齐备才能承接。' },
  { id: 'N7', name: '国家·蛋白纯化与功能研究', category: 'nation', tier: 3,
    workload: 760, limitMonths: 30, money: 225, depositRate: 0.30, consumablePerMonth: 8.0,
    papers: ['PB','PB','PB','PB','PB','PB','PC','PC','PC','PD','PD','PD'], require: { centrifuge: 1, shaker: 1, hood: 1, akta: 1, uvvis: 1, elisa: 1 }, expectedIF: 50.01, q1Expect: 0.90, topExpect: 0,
    hint: 'AKTA 分离纯化、紫外定量、酶标功能验证，串起完整蛋白研究流程。' },
];

export const PROJECT_MAP = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
export const PROJECT_IDS = PROJECTS.map((p) => p.id);

/* ── 定金率（按类别，SPEC：承接得定金、完成得尾款） ── */
export const DEPOSIT_RATE = { nation: 0.30, enterprise: 0.40 };

/* ── 市场与刷新（BALANCE §5.2） ──
   席位拆分（数值实现修订：修复「市场死锁」）：
   项目 offer 与学生 offer 各占**独立配额**，不再抢同一个 MARKET_SLOTS。
   否则开局 6–12 月刷出的学生 offer（副研究员招不起、却永不过期）会占满全部席位，
   项目 offer 从此永久停发。不变式见 MIN_ACCEPTABLE_PROJECT_OFFERS。 */
export const PROJECT_SLOTS = 7;              // 项目 offer 独立席位（t30：5→7，见 TTL 注释）
export const STUDENT_SLOTS = 3;              // 候选人独立席位
export const MARKET_SLOTS = PROJECT_SLOTS + STUDENT_SLOTS;  // 总席位（UI 展示口径）
export const REFRESH_MONTHLY = 2;
export const LOCKABLE_SLOTS = 1;
export const PROJECT_OFFER_TTL_MONTHS = 3;   // 挂太久的项目会撤走（甲方不会等你一辈子）
// 供给核算（t41 修正：旧注释写的是「6/3 = 2.0 → 24」且自称 5→8，与常量不符）。
// 当前实际值：PROJECT_SLOTS = 7、PROJECT_OFFER_TTL_MONTHS = 3 ⇒ 名义供给 = 6/3 × 12 = 24 个/12 月
//（减去 1 个席位给「看得见目标、仪器未齐」的本子，再乘事先批准的 1/8 漏刷预算 → 21）。
// 旧值 5/6 ≈ 0.83 个/月 → 实测 12 个月只有 10 个，远低于下界。
// 21 是**结论**（实测正好压在下界上、零余量），不是下界的来源；改 slots/TTL 必须显式复核并修改
// SUPPLY_FLOOR_12M 并留痕（BALANCE §18.18 裁定 ① 与 ④、§18.9 尺子纪律）。
export const SUPPLY_FLOOR_12M = 21;          // ★ 绝对常量（个/12 个月），来源 docs/BALANCE.md §18.18 裁定 ①
export const STUDENT_OFFER_TTL_MONTHS = 6;   // 候选人也只等半年（否则永久占席位）
export const MIN_ACCEPTABLE_PROJECT_OFFERS = 1;  // 不变式：市场里始终有 N 个「当前真能接」的项目
export const TIER_LOOKAHEAD = 1;
export const NATION_PROJECT_RATIO = 0.60;

/* ── 经费 / 耗材 / 逾期（BALANCE §5.3） ── */
export const DEPOSIT_TO_CONSUMABLE = 0.40;
export const TRANSFER_RATE = 1.0;
export const UNDERDUE_TAIL_MUL = 0.80;
export const PER_HARDPOINT_TAIL_MUL = 0.80;
export const OVERDUE_GRACE_MONTHS = 12;
export const OVERDUE_INTEGRITY_PER_MONTH = -1;
export const OVERDUE_STUDENT_HAPPY = -2;
export const PROJECT_FAIL_INTEGRITY = -5;
export const PROJECT_FAIL_STUDENT_HAPPY = -10;

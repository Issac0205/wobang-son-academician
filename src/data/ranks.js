/**
 * ranks.js —— 八级头衔阶梯（BALANCE §3 / GDD §3.1）
 *
 * RANKS 按 index 1..8 升序，RANKS[0] 为 undefined 占位（不导出），
 * 用 rankOf(index) 取，避免各处写 +1/-1。
 * SPEC 硬性：头衔序列 副研究员 > 研究员 > 副教授 > 教授，
 *          上限梯度 院士 > 杰青/长江兼有 > 杰青/长江单有 > 万人/优青 > 其他教授。
 *
 * v1.7.0：老板「亲带」的**同时数量上限**由头衔决定（playerLeadCap，1/2/2/3/3/4/4/4），
 * 不再由精力上限派生（旧实现 = max(1, floor(精力上限/2))）。上限值只住本文件；
 * core 通过 rankOf(state.player.rankIndex).playerLeadCap 取值，UI 通过 vm 透传，均不写死。
 * 亲带本身的代价（推进 ×0.85、每月多 1 点精力、一作全归玩家）不变，见 src/data/hardpoints.js。
 */

/** @typedef {{index:number,id:string,title:string,ifReq:number,q1Req:number,q2Req:number,topReq:number,projTierReq:number,projCountReq:number,masterCap:number,phdCap:number,schoolFundYear:number,maxProjectTier:number,concurrentCap:number,playerLeadCap:number,goldenAge:number|null,note?:string}} Rank */

/** @type {Rank[]} 索引即等级（1..8），RANKS[0] 为占位 null。 */
export const RANKS = [
  null,
  { index: 1, id: 'associate_researcher', title: '副研究员',
    ifReq: 0, q1Req: 1, q2Req: 0, topReq: 0, projTierReq: 0, projCountReq: 0,
    masterCap: 4, phdCap: 1, schoolFundYear: 72, maxProjectTier: 2, concurrentCap: 2, playerLeadCap: 1,
    goldenAge: null, note: 'SPEC 起始头衔；q1Req=1 为初始持有量，非门槛' },
  { index: 2, id: 'researcher', title: '研究员',
    ifReq: 30, q1Req: 2, q2Req: 2, topReq: 0, projTierReq: 1, projCountReq: 1,
    masterCap: 5, phdCap: 2, schoolFundYear: 120, maxProjectTier: 3, concurrentCap: 3, playerLeadCap: 2,
    goldenAge: 36, note: 'BALANCE §18.10：项目要求 T1+×1' },
  { index: 3, id: 'associate_professor', title: '副教授',
    ifReq: 80, q1Req: 3, q2Req: 4, topReq: 0, projTierReq: 2, projCountReq: 1,
    masterCap: 6, phdCap: 2, schoolFundYear: 180, maxProjectTier: 4, concurrentCap: 3, playerLeadCap: 2,
    goldenAge: 38, note: 'BALANCE §18.10：q2 5→4、项目要求 T2+×1' },
  { index: 4, id: 'professor', title: '教授',
    ifReq: 180, q1Req: 5, q2Req: 8, topReq: 0, projTierReq: 3, projCountReq: 1,
    masterCap: 8, phdCap: 3, schoolFundYear: 240, maxProjectTier: 5, concurrentCap: 4, playerLeadCap: 3,
    goldenAge: 41, note: 'BALANCE §18.10：q2 10→8、项目要求 T3+×1' },
  { index: 5, id: 'young_talent', title: '优青 / 万人',
    ifReq: 320, q1Req: 7, q2Req: 12, topReq: 1, projTierReq: 4, projCountReq: 1,
    masterCap: 9, phdCap: 3, schoolFundYear: 320, maxProjectTier: 6, concurrentCap: 4, playerLeadCap: 3,
    goldenAge: 43, note: 'BALANCE §18.10：q2 16→12、top 0→1、项目要求 T4+×1' },
  { index: 6, id: 'distinguished_single', title: '杰青 / 长江（单有）',
    ifReq: 600, q1Req: 9, q2Req: 16, topReq: 1, projTierReq: 5, projCountReq: 1,
    masterCap: 10, phdCap: 4, schoolFundYear: 420, maxProjectTier: 6, concurrentCap: 5, playerLeadCap: 4,
    goldenAge: 47, note: 'BALANCE §18.10：q2 24→16、项目要求 T5+×1' },
  { index: 7, id: 'distinguished_both', title: '杰青 + 长江（兼有）',
    ifReq: 950, q1Req: 12, q2Req: 22, topReq: 1, projTierReq: 5, projCountReq: 2,
    masterCap: 12, phdCap: 5, schoolFundYear: 560, maxProjectTier: 6, concurrentCap: 6, playerLeadCap: 4,
    goldenAge: 51, note: 'BALANCE §18.10：q2 34→22、top 2→1、项目要求 T5+×2（原 T6≥1）' },
  { index: 8, id: 'academician', title: '院士',
    ifReq: 1400, q1Req: 16, q2Req: 28, topReq: 3, projTierReq: 6, projCountReq: 1,
    projTierReq2: 5, projCountReq2: 2,
    masterCap: 15, phdCap: 6, schoolFundYear: 760, maxProjectTier: 6, concurrentCap: 6, playerLeadCap: 4,
    goldenAge: 45, note: 'BALANCE §18.10：q2 44→28、项目要求 T6×1 且 T5+×2（两条子句）；+ ≥3 张推荐票 + 增选窗口 + ≥45 岁' },
];

export const MAX_RANK_INDEX = 8;

/** 取第 index 级头衔；越界回落为 1。 */
export function rankOf(index) {
  const i = Math.max(1, Math.min(MAX_RANK_INDEX, Math.floor(Number(index) || 1)));
  return RANKS[i];
}

/* ── 晋升相关常量（BALANCE §3.2） ── */
export const PROMOTE_INTEGRITY_BONUS = 2;
export const GOLDEN_AGE_MONEY_MUL = 0.40;
// t28（t6-M1）移除三个「死常量」：GOLDEN_AGE_INTEGRITY_BONUS / AGE_IF_MUL_60 / AGE_IF_MUL_65。
//   证据：`grep -rn 'AGE_IF_MUL\|GOLDEN_AGE_INTEGRITY_BONUS' 评院士/src` 只命中本文件定义处，core 零引用；
//   AGE_IF_MUL_65 的生效月是第 384 月 = RETIRE_MONTH（退休月），结构上不可能生效；
//   AGE_IF_MUL_60 只在 324–383 月（60–64 岁）生效——把院士门槛对「本来就落后的人」再抬 15%，
//   与 B2（帮中强度玩家摸到院士）和 t13 的裁定方向相反。
//   若策划要保留「年龄反向约束」，需 t13 先定生效窗口与倍率，再由 core/formulas.js 的 rankStatus 接线
//   （t28 的 declared scope 不含该文件；本轮只做「代码与文档一致」的移除，文档侧由策划/架构师同步）。
export const MIN_ACADEMICIAN_AGE = 45;
export const ELECTION_WINDOW_INTERVAL = 24;  // 研究：每两年一次
export const ELECTION_WINDOW_START = 24;
export const RECOMMEND_TICKET_REQ = 3;            // 基准票数（SPEC/[研究]：院士需 3 位院士推荐）
export const TICKET_REQ_PER_MISSED_WINDOW = 2;    // BALANCE §18.6：每错过一个增选窗口 +2 张
export const TICKET_REQ_MAX = 9;                  // BALANCE §18.6：上限 9 张
export const TICKET_PER_T6 = 2;
export const TICKET_PER_T5 = 1;
export const TICKET_PER_PHD_GRADUATES = 2;   // BALANCE §18.6：3→2（每 2 名博士毕业 +1 张）
export const TICKET_VISIT_COST = 8;

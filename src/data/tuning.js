/**
 * tuning.js —— 全局常量表（BALANCE §11）
 *
 * 约定（docs/CONTRACT.md 冻结）：
 *   · 本目录只放数据：不得 import 任何模块、不得包含业务逻辑（纯查表常量）。
 *   · 数值来源标记：SPEC=硬性需求 / 研究=有真实出处 / 策划=可调推断值。
 *   · 逻辑层禁止硬编码魔法数字，一律从这里取。
 * 单位：金额 = 万元，影响因子 = IF 点，时间 = 月，比率 = 无量纲小数。
 */

/* ── 开局资源（SPEC 硬性 + 策划） ── */
export const INITIAL_MONEY = 200;            // SPEC：初始经费 200 万
export const INITIAL_CONSUMABLE = 40;        // 策划
export const INITIAL_INTEGRITY = 100;        // SPEC
export const INITIAL_HEALTH = 80;            // 策划
export const INITIAL_TOTAL_IF = 10;          // 策划：= 开局那篇一区一作，保证账目自洽
export const INITIAL_FIRST_Q1 = 1;           // SPEC
export const INITIAL_FIRST_Q2 = 0;           // SPEC
export const INITIAL_FIRST_Q3 = 0;           // SPEC
export const INITIAL_FIRST_Q4 = 0;           // SPEC
export const INITIAL_FIRST_TOP = 0;          // SPEC
export const INITIAL_RECOMMEND_TICKETS = 0;  // 策划

/* 开局队伍：SPEC 只规定名额上限（硕 4 / 博 1），未规定初始在读人数。
   此处取 2 硕 + 1 博（策划）。改动只改这两个常量，逻辑层不要另写数字。 */
export const INITIAL_MASTER_COUNT = 2;       // 策划
export const INITIAL_PHD_COUNT = 1;          // 策划

/* ── 容量与范围 ── */
export const INTEGRITY_MIN = 0;
export const INTEGRITY_MAX = 100;
export const HEALTH_MAX = 100;

/* ── 健康 ── */
export const HEALTH_DECAY_PER_MONTH = 1;     // 策划

/* ── 精力（SPEC：每月更新；健康影响上限） ── */
export const ENERGY_MAX_BASE = 2;            // 策划：energyMax = 2 + floor(health/10)
export const ENERGY_PER_HEALTH_10 = 1;
export const ENERGY_LOW_HEALTH_THRESHOLD = 30;
export const ENERGY_LOW_HEALTH_MUL = 0.5;
export const ENERGY_CARRYOVER = 0;           // SPEC：不结转
export const ENERGY_MAX_SOURCE = 'health';   // SPEC 硬性方向：健康影响精力上限

/* ── 时间 ── */
export const MONTHS_PER_YEAR = 12;
export const START_AGE_YEARS = 33;           // 策划
export const RETIRE_AGE_YEARS = 65;          // 策划
export const RETIRE_MONTH = 384;             // 策划：第 384 月 = 65 岁，一局硬上限
export const MAX_MONTHS = 384;

/* ── 耗材消耗模式（SPEC 三种） ──
   consumeMul  = 每月耗材消耗倍率（CONSUME_MODE_COEF）
   progressMul = 科研效率倍率（CONSUME_PROGRESS_MUL）
   happyDelta  = 幸福度每月增减（CONSUME_HAPPY_DELTA） */
export const CONSUME_MODES = {
  free: {
    id: 'free', label: '随意挥霍', hint: '成员会一定程度浪费耗材，但效率高、心情好。',
    consumeMul: 1.60, progressMul: 1.15, happyDelta: 3,
  },
  normal: {
    id: 'normal', label: '正常消耗', hint: '不影响科研效率与幸福度。',
    consumeMul: 1.00, progressMul: 1.00, happyDelta: 0,
  },
  tight: {
    id: 'tight', label: '收紧裤腰', hint: '10ml 以上的离心管必须洗了再用，效率下降、怨气上升。',
    consumeMul: 0.60, progressMul: 0.85, happyDelta: -5,
  },
};
export const CONSUME_MODE_ORDER = ['free', 'normal', 'tight'];
export const DEFAULT_CONSUME_MODE = 'normal';

/* ── 耗材采购（策划：耗材用经费买，避免「有钱没耗材」死锁） ── */
export const CONSUMABLE_PRICE_PER_UNIT = 1;   // 1 万 / 单位
export const CONSUMABLE_BUY_PACK = 20;        // 「采购一批」= 20 单位
export const CONSUMABLE_LOW_THRESHOLD = 10;   // 低于此值 UI 会提醒

/* ── 一作空窗提示（t30；策划 t26 §7.4 建议 24 个月） ── */
/** 距最近一次拿到「本人署名一作」超过这么多个月 → hud.firstAuthorDrought.stuck = true。 */
export const FIRST_AUTHOR_DROUGHT_MONTHS = 24;

/* ── 随机事件频率 ── */
export const RANDOM_EVENTS_PER_MONTH_MIN = 1;
export const RANDOM_EVENTS_PER_MONTH_MAX = 2;

/* ── 破产与结局 ── */
export const BANKRUPT_NEGATIVE_MONTHS = 6;   // money<0 连续月数
export const LAB_EMPTY_THRESHOLD = 3;        // 单月离组人数 → 结局「实验室空了」

/* ── 存档 ── */
export const SAVE_SLOT_KEY = 'wobang_son_academician_save';
export const SAVE_APP_ID = 'wobang-son-academician';
export const AUTOSAVE_ON_MONTH_END = true;

/* ── 诚信变化总表（BALANCE §11.1，集中登记） ── */
export const INTEGRITY_DELTA = {
  grabFirst: -8,        // 抢学生一作 / 篇
  buyFirst: -4,         // 购买一作 / 篇
  fake: -10,            // 造假蒙混 / 次
  fakeCaught: -25,      // 造假被查（额外）
  divert: -3,           // 多人攻坚挪用其他项目
  audit: -15,           // 举报审查
  extreme: -50,         // 学生极端事件
  finishProject: 2,     // 项目按期结题
  finishEnterprise: 1,  // 横向按期交付
  graduate: 3,          // 学生顺利毕业
  promote: 2,           // 晋升
  noWage: -2,           // 无工资 ≥3 个月 / 月
  overdue: -1,          // 项目逾期 / 月
  projectFail: -5,      // 项目逾期失败
  giveUpStudent: -2,    // 学生肄业
};

/* ── 玩家资料（t5 验收：总览面板姓名可改） ── */
export const PLAYER_NAME_MAX_LENGTH = 12;    // 策划：姓名/儿子名字的长度上限（字符）

/* ── 仪表盘/UI 需要的显示常量 ── */
export const PHASE_LABELS = { action: '行动阶段', settle: '月末结算', ended: '已结束' };
export const PHASE_ORDER = ['action', 'settle', 'ended'];

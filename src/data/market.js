/**
 * market.js —— 人才市场（BALANCE §9 / GDD §7）
 * SPEC 硬性：每年 6–12 月开放；6–10 月保研生；10–12 月考研生；开局可见
 *          （「开局可见」由 engine 在 game/newGame 里直接生成项目 offer 保证；t22 起项目市场全年刷新）；
 *          保研生能力高/门槛高/可花钱招；考研生均值低但有概率出高能力；天赋越高越需高工资。
 * 注：门槛公式与成本公式的实现放 src/core/formulas.js（本文件只放常量）。
 */

/** 保研生（推免）与考研生的生源类型。 */
export const RECRUIT_SOURCES = { translate: 'translate', exam: 'exam' };
export const RECRUIT_SOURCE_LABELS = { translate: '保研生', exam: '考研生' };

export const MARKET_OPEN_MONTHS = [6, 7, 8, 9, 10, 11, 12];   // SPEC：招生季（每年 6–12 月）
// t22（T11-F1）：删除 MARKET_OPEN_FIRST_MONTH。项目市场与招生季解耦、全年按
// REFRESH_MONTHLY / PROJECT_SLOTS 刷新，「开局可见」由 engine 在 game/newGame 里直接生成项目
// offer 实现 —— 不再需要一个「第 0 月强行算开放」的特例（那会让 isMarketOpen 与池子自相矛盾：
// open=true 却一个 offer 都没有）。
export const POOL_CAP = 12;
export const POOL_TRANSLATE_MONTHS = [6, 7, 8, 9, 10];        // SPEC
export const POOL_EXAM_MONTHS = [10, 11, 12];                  // SPEC

export const RECRUIT_COST_BASE_TRANSLATE = 3;   // 万
export const RECRUIT_COST_ABILITY_TRANSLATE = 8;
export const RECRUIT_COST_BASE_EXAM = 1;
export const RECRUIT_COST_ABILITY_EXAM = 4;
export const RECRUIT_COST = {
  translate: { base: 3, perAbility: 8 },
  exam: { base: 1, perAbility: 4 },
};

export const REQ_IF_WEIGHT_TRANSLATE = 200;
export const REQ_IF_WEIGHT_EXAM = 140;
export const REQ_IF_WEIGHT = { translate: 200, exam: 140 };
export const REQ_RANK_CAP = 6;
export const REQ_IF_BASE_ABILITY = 0.5;
export const REQ_RANK_PER_IF = 40;

/** 人才市场每月可招募人数上限（策划：防止一口气招满）。 */
export const RECRUIT_PER_MONTH = 2;

/** 数值实现修订（修复「招不到人」的次生死锁）：
    招生季里若挂着的候选人一个都「够不着」（reqRank/reqIF 超了），就淘汰最旧的那个换新，
    保证市场始终至少有 MIN_RECRUITABLE_STUDENT_OFFERS 个够得着的候选人。 */
export const MIN_RECRUITABLE_STUDENT_OFFERS = 1;

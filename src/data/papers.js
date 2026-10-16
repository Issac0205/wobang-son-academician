/**
 * papers.js —— 期刊档位、论文槽位模板、一作买卖（BALANCE §6 / GDD §2.7-2.8, §5.5）
 * SPEC 硬性：一作五档（一区/二区/三区/四区/正刊）；抢学生一作大幅降诚信；
 *          购买一作消耗经费且诚信减少较少，越厉害越贵。
 */

/** 档位由高到低：top（正刊）> q1 > q2 > q3 > q4。UI 与结题降档都按此顺序。 */
export const PAPER_TIER_ORDER = ['top', 'q1', 'q2', 'q3', 'q4'];
export const PAPER_TIER_LABELS = { top: '正刊', q1: '一区', q2: '二区', q3: '三区', q4: '四区' };

/** 论文模板的「质量降序」：索引 +1 = 降一档，-1 = 升一档（按 expectedIF 排序）。 */
export const PAPER_PATTERN_ORDER = ['PA', 'PE', 'PB', 'PC', 'PD'];
export const PAPER_TIER_IDS = { top: 'firstTop', q1: 'firstQ1', q2: 'firstQ2', q3: 'firstQ3', q4: 'firstQ4' };

export const JOURNAL_IF_BASE = { top: 45.0, q1: 10.0, q2: 5.5, q3: 3.2, q4: 1.3 };
export const IF_RANDOM_LOW = 0.85;
export const IF_RANDOM_HIGH = 1.15;
export const IF_ROUND_DECIMALS = 1;

/** 论文槽位模板：一次加权随机决定这一篇投什么档。 */
export const PAPER_PATTERNS = {
  PA: { id: 'PA', name: '冲天刊', weights: { top: 0.01, q1: 0.34, q2: 0.45, q3: 0.20 }, expectedIF: 6.97 },
  PB: { id: 'PB', name: '主力刊', weights: { q1: 0.15, q2: 0.45, q3: 0.40 }, expectedIF: 5.26 },
  PC: { id: 'PC', name: '稳健刊', weights: { q2: 0.35, q3: 0.50, q4: 0.15 }, expectedIF: 3.72 },
  PD: { id: 'PD', name: '凑数刊', weights: { q3: 0.60, q4: 0.40 }, expectedIF: 2.44 },
  PE: { id: 'PE', name: '登顶刊', weights: { top: 0.02, q1: 0.38, q2: 0.40, q3: 0.20 }, expectedIF: 7.54 },
};

/** 论文槽位 id → 小数位展示用（IF_ROUND_DECIMALS = 1）。 */
export const PAPER_PATTERN_IDS = Object.keys(PAPER_PATTERNS);

/* ── 购买一作（SPEC：越厉害越贵；诚信减少较少） ── */
export const PAPER_BUY_PRICE = { q4: 2, q3: 5, q2: 12, q1: 25, top: 120 };
export const BUY_FIRST_INTEGRITY = -4;

/* ── 抢一作（SPEC：大幅降诚信 + 降低该生幸福度） ── */
export const GRAB_FIRST_INTEGRITY = -8;
export const GRAB_FIRST_HAPPY = -30;
export const GRAB_GRUDGE_MONTHS = 6;
export const GRUDGE_HAPPY_PER_MONTH = -2;

/* ── 毕业产出论文（策划） ── */
export const MASTER_GRAD_PAPER = 'q3';
export const PHD_GRAD_PAPER = 'q2';

/**
 * 论文台帐里「一作是玩家本人」的署名 id（t24 一作归属模型）。
 * 结题时老板亲带（project.playerLeading）的项目，其全部论文用这个 id 记一作；
 * 学生一作的论文记学生 id；抢一作会把该篇署名改成它。
 */
export const PLAYER_AUTHOR_ID = 'player';

/** 降档：四区再降 = null（不计入统计）。 */
export function downgradeTier(tier) {
  const i = PAPER_TIER_ORDER.indexOf(tier);
  if (i < 0) return null;
  return PAPER_TIER_ORDER[i + 1] || null;
}

/** 升档：正刊再升 = 正刊。 */
export function upgradeTier(tier) {
  const i = PAPER_TIER_ORDER.indexOf(tier);
  if (i <= 0) return 'top';
  return PAPER_TIER_ORDER[i - 1];
}

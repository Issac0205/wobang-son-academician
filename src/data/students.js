/**
 * students.js —— 学生参数（BALANCE §8 / GDD §6）
 * SPEC 硬性：幸福度初始 60；工资四档；幸福度归零转组（项目进度 −60%）/ 0.5% 极端事件（诚信 −50）；
 *          延毕一年、大幅降幸福度、不占招生名额；硕士 3 年、博士 5 年。
 */

/* ── 初始与范围 ── */
export const INITIAL_HAPPINESS = 60;          // SPEC
export const HAPPINESS_MIN = 0;
export const HAPPINESS_MAX = 100;
export const DEGREE_PROGRESS_MAX = 100;
export const MASTER_STUDY_MONTHS = 36;        // SPEC：3 年
export const PHD_STUDY_MONTHS = 60;           // SPEC：5 年
export const MASTER_GRAD_PAPER_TIER = 'q3';
export const PHD_GRAD_PAPER_TIER = 'q2';
export const GRAD_INTEGRITY_BONUS = 3;

/* ── 能力分布（BALANCE §8.2） ── */
export const ABILITY_MIN = 0.30;
export const ABILITY_MAX = 0.95;
export const ABILITY_TRANSLATE_MEAN_SD = { mean: 0.75, sd: 0.08 };   // 保研生
export const ABILITY_EXAM_MEAN_SD = { mean: 0.53, sd: 0.10 };         // 考研生主群 90%
export const ABILITY_DARKHORSE_MEAN_SD = { mean: 0.85, sd: 0.05 };    // 考研生黑马 10%
export const ABILITY_DARKHORSE_RATE = 0.10;

/* ── 开局学生的能力分布（t16 F4：原来硬编码在 core/state.js 里） ──
   注意：开局学生与市场候选人用的是**两套**分布（开局学生更强），数值照原样搬移，未改动；
   是否需要统一由策划裁定（见 docs/BALANCE.md 的值不动，由 t13 处理）。 */
export const INITIAL_STUDENT_ABILITY_MEAN_SD = {
  master: { mean: 0.60, sd: 0.09 },
  phd: { mean: 0.72, sd: 0.09 },
};
/** 开局学生的来源比例（保研 : 考研）。 */
export const INITIAL_STUDENT_TRANSLATE_RATE = 0.50;
/** createStudent 在调用方没给 ability 时的兜底值（数据层统一口径，core 里不再出现裸小数）。 */
export const ABILITY_DEFAULT = 0.50;
/** 新开一局时生成学生的硕士 : 博士比例（engine 生成市场候选人时共用）。 */
export const STUDENT_DEGREE_MASTER_RATE = 0.60;

/* ── 挖人事件（engine pickStudent 'poachable'）的判定阈值 ── */
export const POACHABLE_ABILITY_MIN = 0.85;
export const POACHABLE_HAPPY_MAX = 50;

/* ── 工资（SPEC 四档） ── */
export const WAGE_TIERS = ['high', 'mid', 'low', 'none'];
export const WAGE_TIER_LABELS = { high: '高', mid: '中', low: '低', none: '无' };
export const WAGE_INDEX = { high: 3, mid: 2, low: 1, none: 0 };
export const WAGE = {
  master: { high: 0.30, mid: 0.15, low: 0.05, none: 0 },
  phd: { high: 0.60, mid: 0.30, low: 0.10, none: 0 },
};
export const DEFAULT_WAGE_TIER = 'mid';
export const WAGE_HAPPY = { high: 5, mid: 0, low: -4, none: -12 };
export const GAP_PENALTY = 5;
/** SPEC 硬性方向：天赋越高越需要高工资。 */
export const WAGE_EXPECT_THRESHOLDS = { high: 0.80, mid: 0.55 };
export const NO_WAGE_MONTHS_THRESHOLD = 3;
export const NO_WAGE_INTEGRITY = -2;

/* ── 幸福度每月变化（BALANCE §8.3） ── */
// t42（B 方案，主理人拍板）：同一名学生每多带 1 个在研项目，每月额外扣 1 点幸福度（n=3 时共 −2）。
// 作用：把「一个人挂多个项目」从「只保证产出不增（t30 守恒）」升级为**严格劣势**——多带即掉幸福，
// 进而抬高离组/产出风险。n=0 不吃这条，仍走 PROJECT_STRESS_IDLE。
export const MULTI_PROJECT_HAPPY_PENALTY = 1;
export const PROJECT_STRESS_HARDPOINT = -3;
export const PROJECT_STRESS_IDLE = -3;
export const HAPPY_REGRESSION_THRESHOLD = 80;
export const HAPPY_REGRESSION_SLOPE = 0.05;
export const HAPPY_PROJECT_FINISH = 5;
export const HAPPY_LEAD_BONUS = 2;
export const HAPPY_BREAKDOWN_DROP = 25;
export const HAPPY_BREAKDOWN_TALK_COST = { energy: 2, happy: 15 };

/* ── 离组与极端事件（SPEC 硬性） ── */
export const LEAVE_TRIGGER_HAPPINESS = 0;
export const LEAVE_TRANSFER_RATE = 0.995;
export const LEAVE_TRANSFER_PROGRESS_MUL = 0.40;   // 即 −60%
export const LEAVE_EXTREME_RATE = 0.005;
export const LEAVE_EXTREME_INTEGRITY = -50;
export const LEAVE_EXTREME_PROGRESS_MUL = 0;
export const POACH_PROGRESS_MUL = 0.40;

/* ── 毕业与延毕 ── */
export const DEGREE_BASE = 4.0;
export const DEG_HAPPY_COEF_BASE = 0.6;
export const DEG_HAPPY_COEF_SLOPE = 0.004;
export const DEG_HAPPY_LOW = 0.50;
export const DEG_HAPPY_LOW_THRESHOLD = 30;
export const DEG_PROJECT_FACTOR = { withProject: 1.0, withoutProject: 0.3 };
export const DEFER_HAPPY = -40;
export const DEFER_HAPPY_PER_MONTH = -1;
export const DEFER_MONTHS_SUBTRACT = 12;
export const DEFER_QUOTA_MASTER = 2;
export const DEFER_QUOTA_PHD = 3;
export const DEFER_FREE_QUOTA = true;             // SPEC：延毕生不占招生名额
export const GIVEUP_PROGRESS_MUL = 0.40;
export const GIVEUP_INTEGRITY = -2;
export const DEGREE_KIND = { master: 'master', phd: 'phd' };
export const DEGREE_LABELS = { master: '硕士', phd: '博士' };

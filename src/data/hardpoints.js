/**
 * hardpoints.js —— 进度模型与难点系统（BALANCE §7 / GDD §5.3-5.4）
 * SPEC 硬性：越难的项目难点越多；三种处理方式（多人攻坚 / 造假蒙混 / 单人猛干）。
 */

/* ── 进度 ── */
export const BASE_PROGRESS = 6.0;              // 学生月度基准进度
export const ABILITY_DIVISOR = 0.5;            // ability / 0.5 = 能力系数
export const HAPPY_COEF_BASE = 0.6;
export const HAPPY_COEF_SLOPE = 0.004;         // 幸福 100 → 1.00
export const MAX_PROJECTS_PER_STUDENT = 3;

/**
 * 单个项目的学生人数上限（t25「一键分配工作」的规划约束）。
 * 只约束这个便捷动作；手工分配 / 取消分配维持原语义（不受它限制），因此不改变任何既有行为。
 * 取值沿用机器人长期使用的 studentsPerProject = 6（BALANCE 未定义该上限，属新增可调常量）。
 */
export const PROJECT_MAX_STUDENTS = 6;
export const PLAYER_LEAD_MUL = 0.85;           // 玩家亲带项目进度倍率
export const PLAYER_LEAD_ENERGY_COST = 1;      // 每个亲带项目每月额外精力
export const ZERO_CONSUMABLE_PROGRESS_MUL = 0;
export const PROGRESS_PCT_DENOM_PER_HARDPOINT = 0.10; // 分母 = W * (1 + 0.10 * K)

/* ── 难点 ── */
export const HARDPOINT_PROGRESS_PENALTY_PER_HD = 0.25; // 进度乘子 = 1 - 0.25 * hd
export const HARDPOINT_PAPER_DOWNGRADE = 1;            // 结题时每个未解决难点降 1 档
export const HARDPOINT_RETRY_BONUS = 0.10;
export const HARDPOINT_RETRY_CAP = 0.30;

/** 难度 hd 分布：[hd, 概率]。 */
export const HARDPOINT_HD_DIST = {
  1: [[1, 1.0]],
  2: [[1, 0.6], [2, 0.4]],
  3: [[2, 0.7], [3, 0.3]],
  4: [[2, 0.4], [3, 0.6]],
  5: [[3, 1.0]],
  6: [[3, 1.0]],
};

/** 难点数量 = 项目等级（SPEC 方向）。 */
export function hardpointCount(tier) {
  return Math.max(1, Math.min(6, Math.floor(tier)));
}

/* ── 三种处理方式（SPEC 硬性三选一） ── */
export const HARDPOINT_METHODS = {
  team: {
    id: 'team', label: '多人攻坚',
    hint: '抽调 2 人以上攻坚 1 个月：影响其他项目进度，但不动诚信。',
    penalty: { teamOtherProjectMul: -0.25, studentHappyPerPerson: -2, money: 3, months: 1 },
  },
  fake: {
    id: 'fake', label: '造假蒙混',
    hint: '立刻解决，但诚信 −10，且被查概率随次数上升。',
    penalty: { money: 1, integrity: -10, studentHappy: -5 },
  },
  solo: {
    id: 'solo', label: '单人猛干',
    hint: '让 1 名学生本月不做别的：多花钱、该生幸福度大降。',
    penalty: { money: 5, studentHappy: -20, months: 1 },
  },
};
export const HARDPOINT_METHOD_ORDER = ['team', 'fake', 'solo'];

/* 多人攻坚 */
export const TEAM_MIN_STUDENTS = 2;
export const TEAM_MONTHS = 1;
export const TEAM_MONEY = 3;
export const TEAM_OTHER_PROJECT_MUL = -0.25;
export const TEAM_STUDENT_HAPPY = -2;
export const TEAM_SUCCESS_BASE = 0.45;
export const TEAM_SUCCESS_PER_STUDENT = 0.12;
export const TEAM_SUCCESS_ABILITY_COEF = 0.40;
export const TEAM_SUCCESS_ABILITY_REF = 0.6;
export const TEAM_SUCCESS_CLAMP = [0.10, 0.95];

/* 造假蒙混 */
export const FAKE_MONEY = 1;
export const FAKE_INTEGRITY = -10;
export const FAKE_STUDENT_HAPPY = -5;
export const FAKE_CATCH_BASE = 0.10;
export const FAKE_CATCH_PER_PROJECT = 0.04;
export const FAKE_CATCH_GLOBAL = 0.02;
export const FAKE_CATCH_CAP = 0.60;
export const FAKE_CAUGHT_INTEGRITY = -25;
export const FAKE_CAUGHT_PROGRESS_MUL = -0.30;
export const AUDIT_TRIGGER_FAKE_COUNT = 3;
export const AUDIT_MONTHLY_CHANCE = 0.15;
export const AUDIT_INTEGRITY = -15;
export const AUDIT_PROJECT_MUL = -0.20;
export const CAUGHT_BAD_ENDING_INTEGRITY = 25;

/* 单人猛干 */
export const SOLO_MONEY = 5;
export const SOLO_STUDENT_HAPPY = -20;
export const SOLO_SUCCESS_ABILITY_COEF = 0.90;
export const SOLO_SUCCESS_BASE = -0.11;
export const SOLO_SUCCESS_CLAMP = [0.05, 0.80];
export const SOLO_FAIL_HAPPY = -10;

/* 通用 */
export const RETRY_SUCCESS_BONUS = 0.10;
export const RETRY_BONUS_CAP = 0.30;

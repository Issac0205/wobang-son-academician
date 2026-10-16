/**
 * actions.js —— 4 种行动（BALANCE §10 / GDD §8）
 * SPEC 硬性四种：与学生交流课题 / 开组会 / 锻炼与享乐 / 去团建。
 * energyCost、moneyCost 由逻辑层读取；moneyCost 为 'perStudent' 时按在读人数计。
 */

/** @typedef {{id:string,name:string,hint:string,energyCost:number,moneyCost:number|'perStudent',limitPerMonth:number|'perStudent',needs:{student?:boolean,project?:boolean,count?:number}}} ActionDef */

/** @type {ActionDef[]} */
export const ACTION_DEFS = [
  { id: 'talk', name: '与学生交流课题', energyCost: 2, moneyCost: 0, limitPerMonth: 'perStudent',
    needs: { student: true, project: true, count: 1 },
    hint: '指定 1 名学生 + 他负责的 1 个项目：进度 +8，该生幸福 +4、毕业进度 +2。' },
  { id: 'meeting', name: '开组会', energyCost: 4, moneyCost: 0.5, limitPerMonth: 99,
    needs: { count: 0 },
    hint: '全体学生负责的项目各 +3；全体幸福 +2。同月第 2 次 ×0.5、第 3 次 ×0.25、第 4 次无效。' },
  { id: 'exercise', name: '锻炼与享乐', energyCost: 3, moneyCost: 2, limitPerMonth: 99,
    needs: { count: 0 },
    hint: '健康 +8（健康 ≥90 时改为 +3）。' },
  { id: 'teambuild', name: '去团建', energyCost: 5, moneyCost: 'perStudent', limitPerMonth: 1,
    needs: { count: 0 },
    hint: '全体在读学生幸福 +8；经费按在读人数 ×1 万。' },
];

export const ACTION_MAP = Object.fromEntries(ACTION_DEFS.map((a) => [a.id, a]));

/** 「与学生交流课题」每名学生每月的次数上限（t16 F4：原来硬编码在 core/engine.js）。 */
export const TALK_PER_STUDENT_PER_MONTH = 2;
export const DEFAULT_TALK_PROJECT_PROGRESS = 8;
export const TALK_PROJECT_PROGRESS = 8;
export const TALK_HAPPY = 4;
export const TALK_DEGREE = 2;
export const MEETING_PROJECT_PROGRESS = 3;
export const MEETING_CREW_MUL = [1, 1, 0.5, 0.25, 0];  // 索引 = 本月第 n 次
export const HAPPY_ACTION_MEETING = 2;
export const EXERCISE_HEALTH = 8;
export const EXERCISE_HEALTH_HIGH_THRESHOLD = 90;
export const EXERCISE_HEALTH_HIGH = 3;
export const HAPPY_ACTION_TEAMBUILD = 8;
export const TEAMBUILD_COST_PER_STUDENT = 1.0;
export const HAPPY_ACTION_TALK = 4;

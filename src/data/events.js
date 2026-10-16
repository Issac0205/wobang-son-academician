/**
 * events.js —— 24 条随机事件（BALANCE §13 / GDD §10.3）
 *
 * 事件结构（docs/CONTRACT.md 冻结）：
 *   { id, title, weight, cooldown, cond, effects[], text, tone, once }
 *   · cond    —— 条件 DSL（见 docs/CONTRACT.md §4），不放函数，保证可存档、可检查。
 *   · effects —— 效果 DSL 数组，按序结算；select* 效果会把「本次事件的主角」
 *                绑定到 ctx.student / ctx.project，后续目标写 'ctx' 即指它。
 *   · tone    —— bad（倒霉事）/ absurd（荒诞事）/ system（体制事）/ good
 *   · 文案原则（GDD §10.1）：反差优先、不说教、具体到物件与数字。
 */

/** 条件 DSL 里的常用片段，减少重复。 */
const hasProject = { anyProject: { active: true } };
const hasEnterprise = { anyProject: { active: true, category: 'enterprise' } };
const hasActive = { anyProject: { active: true } };

/** @typedef {{id:string,title:string,weight:number,cooldown?:number,cond:any,effects:any[],text:string,tone:'bad'|'absurd'|'system'|'good',once?:boolean}} GameEvent */

/** @type {GameEvent[]} */
export const EVENTS = [
  { id: 'e_reviewer2', title: '审稿人二号', weight: 10, cond: hasActive, tone: 'bad',
    effects: [
      { kind: 'selectProject', pick: 'randomActive' },
      { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -10 },
      { kind: 'studentHappy', target: 'ctxStudents', value: -5 },
    ],
    text: '审稿人二号建议补三个实验，并顺手否定了你的人生。' },

  { id: 'e_reagent', title: '试剂到货', weight: 10, cond: true, tone: 'good',
    effects: [{ kind: 'consumable', mode: 'add', value: 5 }],
    text: '厂家送来一批试用装，附赠一张名片和一句「下批要涨价了」。' },

  { id: 'e_machine_down', title: '仪器罢工', weight: 8, cond: { hasInstrument: 'hplc', min: 1 }, tone: 'bad',
    effects: [{ kind: 'instrumentDown', instrument: 'hplc', months: 1 }, { kind: 'money', mode: 'add', value: -3 }],
    text: '液相的压力曲线画出了一个心形。工程师说这是他见过最有创意的故障。' },

  { id: 'e_midnight_post', title: '深夜朋友圈', weight: 8, cond: { anyStudent: { happinessBelow: 40 } }, tone: 'absurd',
    effects: [
      { kind: 'selectStudent', pick: 'lowestHappy' },
      { kind: 'studentHappy', target: 'ctx', value: 5 },
    ],
    text: '凌晨两点，你的学生发了一条朋友圈，配图是空的实验室。你点了个赞。他三分钟后删了。' },

  { id: 'e_meeting_derail', title: '组会跑题', weight: 6, cond: { flag: 'metThisMonth' }, tone: 'absurd',
    effects: [{ kind: 'meetingNull', value: true }],
    text: '组会从课题讨论一路聊到谁的导师更离谱。两小时后散会，进度零。' },

  { id: 'e_peer_hat', title: '同龄人的帽子', weight: 8, cond: { stat: 'ageYears', op: '>=', value: 40 }, tone: 'system',
    effects: [{ kind: 'energy', mode: 'add', value: -1 }],
    text: '你大学室友评上了长江。你在群里发了个 nb，然后退出去看了两眼自己的结题报告。' },

  { id: 'e_inspection', title: '校领导视察', weight: 6, cond: true, tone: 'system',
    effects: [{ kind: 'money', mode: 'add', value: 10 }, { kind: 'consumeMulNextMonth', value: 1.20 }],
    text: '校领导来实验室视察，称赞你们「很有烟火气」。第二天给你批了一笔专项，要求「出点标志性成果」。' },

  { id: 'e_client_onsite', title: '甲方来人', weight: 8, cond: hasEnterprise, tone: 'absurd',
    effects: [
      { kind: 'selectProject', pick: 'enterprise' },
      { kind: 'projectProgress', target: 'ctx', mode: 'add', value: 15 },
      { kind: 'studentHappy', target: 'ctxStudents', value: -6 },
    ],
    text: '甲方派人驻场，坐在你学生旁边看他做实验。效率翻倍，士气腰斩。' },

  { id: 'e_grab_aftermath', title: '抢一作后遗症', weight: 8, cond: { stat: 'grabbedPapers', op: '>=', value: 1 }, tone: 'bad',
    effects: [
      { kind: 'selectStudent', pick: 'hasGrudge' },
      { kind: 'studentHappy', target: 'ctx', value: -8 },
      { kind: 'if', cond: { ctxStudent: { happinessBelow: 30 } }, then: [{ kind: 'studentDegree', target: 'ctx', value: -10 }] },
    ],
    text: '他在组会上把你的名字念了三遍，每次都停顿半秒。你假装在回邮件。' },

  { id: 'e_academician_visit', title: '院士来访', weight: 5, cond: { stat: 'totalIF', op: '>=', value: 300 }, tone: 'system',
    effects: [{ kind: 'money', mode: 'add', value: -8 }, { kind: 'ticket', value: 1 }],
    text: '一位老院士来参观，对你们的离心机型号表示赞赏。你请了一顿饭。他记住了你的名字。' },

  { id: 'e_nsfc_letter', title: '基金委来函', weight: 8, cond: { stat: 'fakesTotal', op: '>=', value: 1 }, tone: 'bad',
    effects: [
      { kind: 'selectProject', pick: 'randomActive' },
      { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -10 },
      { kind: 'integrity', mode: 'add', value: -3 },
    ],
    text: '基金委来函，要求补充说明三项经费支出的合理性。你翻出三年前的发票，发现是复印件。' },

  { id: 'e_wedding', title: '学生的婚礼', weight: 6, cond: { stat: 'studentsGraduated', op: '>=', value: 1 }, tone: 'good',
    effects: [{ kind: 'money', mode: 'add', value: -3 }, { kind: 'studentHappy', target: 'all', value: 3 }],
    text: '你的第一届学生结婚，请你坐主桌。你随了三千块，讲了三分钟话，全场只有他自己在认真听。' },

  { id: 'e_power_outage', title: '断电事故', weight: 6, cond: hasActive, tone: 'bad',
    effects: [
      { kind: 'selectProject', pick: 'randomActive' },
      { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -12 },
      { kind: 'consumable', mode: 'add', value: -4 },
    ],
    text: '-80℃ 冰箱跳闸一夜。二十年的祖宗菌种和三十万的样品，一起归西。' },

  { id: 'e_exam_rise', title: '考研生逆袭', weight: 6, cond: { anyStudent: { source: 'exam' } }, tone: 'good',
    effects: [
      { kind: 'selectStudent', pick: 'examSource' },
      { kind: 'studentAbility', target: 'ctx', value: 0.05 },
      { kind: 'studentHappy', target: 'ctx', value: 10 },
    ],
    text: '你在数据里发现一组漂亮的重复性结果，来源是你最不看好的那个统考生。他不好意思地说：「我只是把每个条件都做了五遍。」' },

  { id: 'e_editor_invite', title: '主编约稿', weight: 5, cond: { stat: 'totalIF', op: '>=', value: 180 }, tone: 'good',
    effects: [
      { kind: 'selectProject', pick: 'randomActive' },
      { kind: 'projectPaperShift', target: 'ctx', value: 1 },
    ],
    text: '一位期刊主编在会议上认出你，说「欢迎投稿」。你知道这句话值多少钱——大概一篇一区。' },

  { id: 'e_poach', title: '被挖角', weight: 6, cond: { anyStudent: { abilityAtLeast: 0.85, happinessBelow: 50 } }, tone: 'bad',
    effects: [
      { kind: 'selectStudent', pick: 'poachable' },
      { kind: 'studentLeave', target: 'ctx', progressMul: 0.40 },
    ],
    text: '隔壁高校给他发了 offer，安家费比你的年投资高。他来告别时说：「老师，我不是嫌钱少。」' },

  { id: 'e_health_check', title: '体检报告', weight: 6, cond: { stat: 'health', op: '<', value: 40 }, tone: 'system',
    effects: [{ kind: 'health', mode: 'add', value: 5 }, { kind: 'energyMaxDelta', value: -2 }],
    text: '体检报告：脂肪肝、颈椎曲度变直、窦性心律不齐。医生问你的职业，你说「老师」，他点点头，像是懂了。' },

  { id: 'e_apc', title: '版面费', weight: 6, cond: { stat: 'recentQ4Papers', op: '>=', value: 1 }, tone: 'bad',
    effects: [{ kind: 'money', mode: 'add', value: -6 }],
    text: 'OA 期刊的 APC 账单到了。你盯着那个数字，想起十年前发论文还倒赚钱。' },

  { id: 'e_scooped', title: '隔壁组抢发', weight: 5, cond: hasActive, tone: 'bad',
    effects: [
      { kind: 'selectProject', pick: 'randomActive' },
      { kind: 'projectPaperShift', target: 'ctx', value: -1 },
    ],
    text: '隔壁组发了同一体系。你的学生问：「老师，我们还做吗？」你说：「做，我们做深一点。」——然后降了一档。' },

  { id: 'e_love', title: '学生恋爱了', weight: 6, cond: { anyStudent: { happinessAtLeast: 50 } }, tone: 'absurd',
    effects: [
      { kind: 'selectStudent', pick: 'randomHappyHigh' },
      { kind: 'studentHappy', target: 'ctx', value: 15 },
      { kind: 'studentDegree', target: 'ctx', value: -8 },
    ],
    text: '他恋爱了。一个月没做实验，但数据记录本上的字变得非常工整。' },

  { id: 'e_breakup', title: '学生失恋了', weight: 6, cond: { anyStudent: { happinessBelow: 60 } }, tone: 'absurd',
    effects: [
      { kind: 'selectStudent', pick: 'randomHappyLow' },
      { kind: 'studentHappy', target: 'ctx', value: -15 },
      { kind: 'studentOutputMul', target: 'ctx', value: 0.50, months: 1 },
    ],
    text: '他失恋了。在实验室循环同一首歌听了六个小时，配平了三篇文献综述。' },

  { id: 'e_stipend_raise', title: '学校上调补助标准', weight: 4, cond: { stat: 'rankIndex', op: '>=', value: 3 }, tone: 'system',
    effects: [{ kind: 'wageExpectShift', target: 'all', value: 1 }, { kind: 'studentHappy', target: 'all', value: -3 }],
    text: '学校上调了研究生补助标准。你的学生们看你的眼神变得很有内容。' },

  { id: 'e_flood', title: '实验室水漫金山', weight: 4, cond: { hasInstrument: 'hood', min: 1 }, tone: 'bad',
    effects: [{ kind: 'consumable', mode: 'add', value: -8 }, { kind: 'instrumentDown', instrument: 'hood', months: 1 }],
    text: '半夜管道爆了，水从三楼流到一楼，路过的人都以为你们在做湿实验。' },

  { id: 'e_reunion', title: '老同学聚会', weight: 6, cond: true, tone: 'system',
    effects: [{ kind: 'energy', mode: 'add', value: -1 }, { kind: 'health', mode: 'add', value: -3 }],
    text: '老同学都当上处长了。你喝多了，说了三遍「我这课题要做真东西」。第二天他们都忘了，你没忘。' },
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const EVENT_WEIGHT_DEFAULT = 6;
export const EVENT_COOLDOWN_MONTHS = 6;
export const MACHINE_DOWN_MONTHS = 1;
export const INSPECTION_CONSUME_MUL = 1.20;

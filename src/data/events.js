/**
 * events.js —— 38 条随机事件（BALANCE §13 / GDD §10.3；1.1 起每条都带 choices）
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

/** @typedef {{id:string,title:string,weight:number,cooldown?:number,cond:any,effects?:any[],choices?:{id:string,label:string,hint?:string,effects:any[]}[],text:string,tone:'bad'|'absurd'|'system'|'good',once?:boolean}} GameEvent */

/** @type {GameEvent[]} */
export const EVENTS = [
  /* ── 一、原有 24 条：choices[0] 保留 1.0 的原始效果（机器人默认选第一项，结算口径不变） ── */
  { id: 'e_reviewer2', title: '审稿人二号', weight: 10, cond: hasActive, tone: 'bad',
    text: '审稿人二号的意见写了四页：建议补三个实验，引用他本人的五篇文章，并指出「作者对本领域缺乏基本了解」。',
    choices: [
      { id: 'redo', label: '照单全收，补实验', hint: '项目进度倒退，干活的学生不太高兴',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -10 },
          { kind: 'studentHappy', target: 'ctxStudents', value: -5 },
        ] },
      { id: 'cite', label: '把他那五篇全引上', hint: '进度少退一些，诚信沾一点灰',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -4 },
          { kind: 'integrity', mode: 'add', value: -1 },
        ] },
    ] },

  { id: 'e_reagent', title: '试剂到货', weight: 10, cond: true, tone: 'good',
    text: '厂家送来一批试用装，附赠名片一张、台历一本，以及一句「下一批要涨价了」。',
    choices: [
      { id: 'take', label: '收下试用装', hint: '耗材资金增加',
        effects: [{ kind: 'consumable', mode: 'add', value: 5 }] },
      { id: 'contract', label: '顺手签下年度采购协议', hint: '耗材到得更多，经费先出一笔',
        effects: [{ kind: 'consumable', mode: 'add', value: 8 }, { kind: 'money', mode: 'add', value: -3 }] },
    ] },

  { id: 'e_machine_down', title: '仪器罢工', weight: 8, cond: { hasInstrument: 'hplc', min: 1 }, tone: 'bad',
    text: '液相的压力曲线画出了一个心形。原厂工程师看了二十分钟，说这是他从业以来见过最有创意的故障。',
    choices: [
      { id: 'repair', label: '请原厂工程师修', hint: '停机一个月，付一笔维修费',
        effects: [{ kind: 'instrumentDown', instrument: 'hplc', months: 1 }, { kind: 'money', mode: 'add', value: -3 }] },
      { id: 'diy', label: '让学生照着论坛帖子自己拆', hint: '省下维修费，停机更久，学生多了一门手艺和一肚子怨气',
        effects: [{ kind: 'instrumentDown', instrument: 'hplc', months: 2 }, { kind: 'studentHappy', target: 'all', value: -3 }] },
    ] },

  { id: 'e_midnight_post', title: '深夜朋友圈', weight: 8, cond: { anyStudent: { happinessBelow: 40 } }, tone: 'absurd',
    text: '凌晨两点，组里一名学生发了条朋友圈：配图是空荡荡的实验室，文案只有一个句号。三分钟后删了。',
    choices: [
      { id: 'like', label: '在删之前点个赞', hint: '他知道有人看见了',
        effects: [
          { kind: 'selectStudent', pick: 'lowestHappy' },
          { kind: 'studentHappy', target: 'ctx', value: 5 },
        ] },
      { id: 'tea', label: '第二天约他喝杯奶茶', hint: '花一点精力，他的心情好转更多',
        effects: [
          { kind: 'selectStudent', pick: 'lowestHappy' },
          { kind: 'energy', mode: 'add', value: -1 },
          { kind: 'studentHappy', target: 'ctx', value: 10 },
        ] },
    ] },

  { id: 'e_meeting_derail', title: '组会跑题', weight: 6, cond: { flag: 'metThisMonth' }, tone: 'absurd',
    text: '组会从课题讨论一路聊到「谁的导师更离谱」，每个人都带了素材。两小时后散会，白板上只写着日期。',
    choices: [
      { id: 'drift', label: '由它去', hint: '这次组会白开',
        effects: [{ kind: 'meetingNull', value: true }] },
      { id: 'supper', label: '既然聊开了，加一顿夜宵', hint: '组会照样白开，花点经费，气氛好起来',
        effects: [{ kind: 'meetingNull', value: true }, { kind: 'money', mode: 'add', value: -1 }, { kind: 'studentHappy', target: 'all', value: 4 }] },
    ] },

  { id: 'e_peer_hat', title: '同龄人的帽子', weight: 8, cond: { stat: 'ageYears', op: '>=', value: 40 }, tone: 'system',
    text: '大学室友评上了长江学者，同学群里刷了两百条「恭喜」。你那条排在第一百三十七位。',
    choices: [
      { id: 'congrats', label: '发一句「苟富贵，勿相忘」', hint: '耗掉一点精力',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }] },
      { id: 'lecture', label: '请他来组里做个报告', hint: '花一点经费，学生开了眼界',
        effects: [{ kind: 'money', mode: 'add', value: -2 }, { kind: 'studentHappy', target: 'all', value: 3 }] },
    ] },

  { id: 'e_inspection', title: '校领导视察', weight: 6, cond: true, tone: 'system',
    text: '校领导视察实验室，称赞大家「很有烟火气」。第二天批下一笔专项，附言：「尽快出点标志性成果」。',
    choices: [
      { id: 'accept', label: '收下专项，准备迎检', hint: '经费到账；为了迎检，下个月耗材多烧一些',
        effects: [{ kind: 'money', mode: 'add', value: 10 }, { kind: 'consumeMulNextMonth', value: 1.20 }] },
      { id: 'decline', label: '说经费够用，婉拒', hint: '钱没拿，口碑攒了一点',
        effects: [{ kind: 'integrity', mode: 'add', value: 1 }] },
    ] },

  { id: 'e_client_onsite', title: '甲方来人', weight: 8, cond: hasEnterprise, tone: 'absurd',
    text: '甲方派来一名工程师驻场，坐在学生旁边看他做实验，每隔十分钟问一次「快好了吗」。',
    choices: [
      { id: 'welcome', label: '欢迎驻场', hint: '效率翻倍，士气腰斩',
        effects: [
          { kind: 'selectProject', pick: 'enterprise' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: 15 },
          { kind: 'studentHappy', target: 'ctxStudents', value: -6 },
        ] },
      { id: 'corridor', label: '以安全规定为由请他在走廊等', hint: '进度涨得少，学生不受打扰',
        effects: [
          { kind: 'selectProject', pick: 'enterprise' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: 5 },
        ] },
    ] },

  { id: 'e_grab_aftermath', title: '抢一作后遗症', weight: 8, cond: { stat: 'grabbedPapers', op: '>=', value: 1 }, tone: 'bad',
    text: '组会上，他把你的名字念了三遍，每次都停顿半秒。其他人都低头看手机，屏幕是黑的。',
    choices: [
      { id: 'mail', label: '当场打开邮箱回邮件', hint: '他的不满会继续发酵，太低落时会拖慢毕业',
        effects: [
          { kind: 'selectStudent', pick: 'hasGrudge' },
          { kind: 'studentHappy', target: 'ctx', value: -8 },
          { kind: 'if', cond: { ctxStudent: { happinessBelow: 30 } }, then: [{ kind: 'studentDegree', target: 'ctx', value: -10 }] },
        ] },
      { id: 'dinner', label: '会后单独请他吃饭', hint: '花点精力，关系缓和一点，但饭桌上谁都没提那篇文章',
        effects: [
          { kind: 'selectStudent', pick: 'hasGrudge' },
          { kind: 'energy', mode: 'add', value: -1 },
          { kind: 'studentHappy', target: 'ctx', value: 4 },
        ] },
    ] },

  { id: 'e_academician_visit', title: '院士来访', weight: 5, cond: { stat: 'totalIF', op: '>=', value: 300 }, tone: 'system',
    text: '一位老院士来参观，对组里那台离心机的型号表示赞赏，说他年轻时用的也是这一款。',
    choices: [
      { id: 'treat', label: '留他吃顿饭', hint: '花一笔招待费，他记住了你的名字',
        effects: [{ kind: 'money', mode: 'add', value: -8 }, { kind: 'ticket', value: 1 }] },
      { id: 'tour', label: '只参观，不留饭', hint: '一分钱没花，学生得到一张合影',
        effects: [{ kind: 'studentHappy', target: 'all', value: 2 }] },
    ] },

  { id: 'e_nsfc_letter', title: '基金委来函', weight: 8, cond: { stat: 'fakesTotal', op: '>=', value: 1 }, tone: 'bad',
    text: '基金委来函，要求说明三项经费支出的合理性。翻出来的三年前的发票是复印件，复印件上还有咖啡渍。',
    choices: [
      { id: 'explain', label: '连夜写情况说明', hint: '项目停摆一阵，诚信受损',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -10 },
          { kind: 'integrity', mode: 'add', value: -3 },
        ] },
      { id: 'refund', label: '主动退回说不清的那部分', hint: '经费吐出去一笔，诚信损失较小',
        effects: [{ kind: 'money', mode: 'add', value: -5 }, { kind: 'integrity', mode: 'add', value: -1 }] },
    ] },

  { id: 'e_wedding', title: '学生的婚礼', weight: 6, cond: { stat: 'studentsGraduated', op: '>=', value: 1 }, tone: 'good',
    text: '第一届毕业生结婚，请导师坐主桌、上台致辞。三分钟的讲话，全场只有新郎在认真听。',
    choices: [
      { id: 'attend', label: '随礼、上台致辞', hint: '花一点钱，在读的学生看在眼里',
        effects: [{ kind: 'money', mode: 'add', value: -3 }, { kind: 'studentHappy', target: 'all', value: 3 }] },
      { id: 'card', label: '寄张贺卡，说在开会', hint: '省钱，在读的学生同样看在眼里',
        effects: [{ kind: 'studentHappy', target: 'all', value: -2 }] },
    ] },

  { id: 'e_power_outage', title: '断电事故', weight: 6, cond: hasActive, tone: 'bad',
    text: '-80℃ 冰箱跳闸一夜。冻了二十年的祖传菌种和价值三十万的样品，一起化了。',
    choices: [
      { id: 'redo', label: '认栽，从头做', hint: '项目进度和耗材都有损失',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -12 },
          { kind: 'consumable', mode: 'add', value: -4 },
        ] },
      { id: 'claim', label: '找后勤处索赔', hint: '损失照旧；扯皮耗精力，能要回一点钱',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -12 },
          { kind: 'consumable', mode: 'add', value: -4 },
          { kind: 'energy', mode: 'add', value: -2 },
          { kind: 'money', mode: 'add', value: 2 },
        ] },
    ] },

  { id: 'e_exam_rise', title: '考研生逆袭', weight: 6, cond: { anyStudent: { source: 'exam' } }, tone: 'good',
    text: '数据里冒出一组重复性极好的结果，来源是组里最不被看好的统考生。被问起时他说：「我只是把每个条件都做了五遍。」',
    choices: [
      { id: 'praise', label: '组会上点名表扬', hint: '他能力见长，心情大好',
        effects: [
          { kind: 'selectStudent', pick: 'examSource' },
          { kind: 'studentAbility', target: 'ctx', value: 0.05 },
          { kind: 'studentHappy', target: 'ctx', value: 10 },
        ] },
      { id: 'teach', label: '让他给全组讲讲怎么做的', hint: '他能力见长，全组跟着沾光',
        effects: [
          { kind: 'selectStudent', pick: 'examSource' },
          { kind: 'studentAbility', target: 'ctx', value: 0.05 },
          { kind: 'studentHappy', target: 'ctx', value: 4 },
          { kind: 'studentHappy', target: 'all', value: 2 },
        ] },
    ] },

  { id: 'e_editor_invite', title: '主编约稿', weight: 5, cond: { stat: 'totalIF', op: '>=', value: 180 }, tone: 'good',
    text: '一位期刊主编在茶歇时认出了你，递来一张名片：「欢迎投稿」。名片背面印着版面费标准。',
    choices: [
      { id: 'submit', label: '当场答应投稿', hint: '一个在研项目的论文升一档',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectPaperShift', target: 'ctx', value: 1 },
        ] },
      { id: 'pass', label: '收下名片，说再看看', hint: '论文不变，名片夹厚了一点',
        effects: [{ kind: 'integrity', mode: 'add', value: 1 }] },
    ] },

  { id: 'e_poach', title: '被挖角', weight: 6, cond: { anyStudent: { abilityAtLeast: 0.85, happinessBelow: 50 } }, tone: 'bad',
    text: '隔壁高校给他发了 offer，安家费比课题组一年的投入还多。他来告别时说：「老师，我不是嫌钱少。」',
    choices: [
      { id: 'farewell', label: '祝他前程似锦', hint: '他离组，手上的项目进度被带走一大截',
        effects: [
          { kind: 'selectStudent', pick: 'poachable' },
          { kind: 'studentLeave', target: 'ctx', progressMul: 0.40 },
        ] },
      { id: 'retain', label: '加钱挽留', hint: '经费出一大笔，他留下了，以后的工资预期也上去了',
        effects: [
          { kind: 'selectStudent', pick: 'poachable' },
          { kind: 'money', mode: 'add', value: -10 },
          { kind: 'studentHappy', target: 'ctx', value: 15 },
          { kind: 'wageExpectShift', target: 'ctx', value: 1 },
        ] },
    ] },

  { id: 'e_health_check', title: '体检报告', weight: 6, cond: { stat: 'health', op: '<', value: 40 }, tone: 'system',
    text: '体检报告：脂肪肝、颈椎曲度变直、窦性心律不齐。医生问职业，听到「高校老师」后点点头，没再往下问。',
    choices: [
      { id: 'rest', label: '遵医嘱，少熬夜', hint: '健康回升，精力上限下降',
        effects: [{ kind: 'health', mode: 'add', value: 5 }, { kind: 'energyMaxDelta', value: -2 }] },
      { id: 'drawer', label: '把报告塞进抽屉', hint: '精力照旧，健康继续下滑',
        effects: [{ kind: 'health', mode: 'add', value: -5 }] },
    ] },

  { id: 'e_apc', title: '版面费', weight: 6, cond: { stat: 'recentQ4Papers', op: '>=', value: 1 }, tone: 'bad',
    text: 'OA 期刊的版面费账单到了，金额后面跟着好几个零，备注栏写着「感谢您对开放科学的支持」。',
    choices: [
      { id: 'pay', label: '按时付款', hint: '经费少一笔',
        effects: [{ kind: 'money', mode: 'add', value: -6 }] },
      { id: 'stall', label: '拖着不付', hint: '钱暂时没出，催款邮件抄送了学校，诚信受损',
        effects: [{ kind: 'integrity', mode: 'add', value: -3 }] },
    ] },

  { id: 'e_scooped', title: '隔壁组抢发', weight: 5, cond: hasActive, tone: 'bad',
    text: '隔壁组抢先发表了同一个体系。学生问：「老师，我们还做吗？」',
    choices: [
      { id: 'deeper', label: '「做，我们做深一点。」', hint: '一个在研项目的论文降一档',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectPaperShift', target: 'ctx', value: -1 },
        ] },
      { id: 'pivot', label: '连夜换方向', hint: '论文档位保住，进度大幅倒退',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: -15 },
        ] },
    ] },

  { id: 'e_love', title: '学生恋爱了', weight: 6, cond: { anyStudent: { happinessAtLeast: 50 } }, tone: 'absurd',
    text: '组里有人恋爱了。一个月没怎么进实验室，但数据记录本上的字变得非常工整。',
    choices: [
      { id: 'bless', label: '随他去', hint: '他很开心，毕业进度慢了',
        effects: [
          { kind: 'selectStudent', pick: 'randomHappyHigh' },
          { kind: 'studentHappy', target: 'ctx', value: 15 },
          { kind: 'studentDegree', target: 'ctx', value: -8 },
        ] },
      { id: 'remind', label: '提醒他还有毕业论文', hint: '开心少一点，进度也少掉一点',
        effects: [
          { kind: 'selectStudent', pick: 'randomHappyHigh' },
          { kind: 'studentHappy', target: 'ctx', value: 5 },
          { kind: 'studentDegree', target: 'ctx', value: -3 },
        ] },
    ] },

  { id: 'e_breakup', title: '学生失恋了', weight: 6, cond: { anyStudent: { happinessBelow: 60 } }, tone: 'absurd',
    text: '有人失恋了，在实验室单曲循环同一首歌六个小时，顺手写完了三篇文献综述。',
    choices: [
      { id: 'leave', label: '让他静一静', hint: '他很低落，这个月产出减半',
        effects: [
          { kind: 'selectStudent', pick: 'randomHappyLow' },
          { kind: 'studentHappy', target: 'ctx', value: -15 },
          { kind: 'studentOutputMul', target: 'ctx', value: 0.50, months: 1 },
        ] },
      { id: 'holiday', label: '放他一周假', hint: '这个月他几乎不干活，心情恢复得快',
        effects: [
          { kind: 'selectStudent', pick: 'randomHappyLow' },
          { kind: 'studentHappy', target: 'ctx', value: -5 },
          { kind: 'studentOutputMul', target: 'ctx', value: 0.20, months: 1 },
        ] },
    ] },

  { id: 'e_stipend_raise', title: '学校上调补助标准', weight: 4, cond: { stat: 'rankIndex', op: '>=', value: 3 }, tone: 'system',
    text: '学校上调了研究生补助标准，通知在学生群里被转发了十一次，每次都有人@课题组负责人。',
    choices: [
      { id: 'hold', label: '按兵不动', hint: '学生的工资预期上涨，心里不痛快',
        effects: [{ kind: 'wageExpectShift', target: 'all', value: 1 }, { kind: 'studentHappy', target: 'all', value: -3 }] },
      { id: 'raise', label: '主动给大家补一点', hint: '经费出一笔，工资预期照涨，但没人摆脸色',
        effects: [{ kind: 'wageExpectShift', target: 'all', value: 1 }, { kind: 'money', mode: 'add', value: -3 }, { kind: 'studentHappy', target: 'all', value: 3 }] },
    ] },

  { id: 'e_flood', title: '实验室水漫金山', weight: 4, cond: { hasInstrument: 'hood', min: 1 }, tone: 'bad',
    text: '半夜水管爆裂，水从三楼流到一楼。路过的人以为这个组改做湿实验了。',
    choices: [
      { id: 'mop', label: '全组拖地', hint: '耗材泡了一批，超净台停一个月',
        effects: [{ kind: 'consumable', mode: 'add', value: -8 }, { kind: 'instrumentDown', instrument: 'hood', months: 1 }] },
      { id: 'insurance', label: '拍照取证，找后勤和保险', hint: '损失照旧；跑流程耗精力，能报回一点',
        effects: [{ kind: 'consumable', mode: 'add', value: -8 }, { kind: 'instrumentDown', instrument: 'hood', months: 1 }, { kind: 'energy', mode: 'add', value: -1 }, { kind: 'money', mode: 'add', value: 2 }] },
    ] },

  { id: 'e_reunion', title: '老同学聚会', weight: 6, cond: true, tone: 'system',
    text: '同学聚会，一桌坐了一半处长。席间有人说了三遍「我这课题是要做真东西的」，第二天群里没人提起。',
    choices: [
      { id: 'stay', label: '陪到最后一轮', hint: '精力和健康都有损耗',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }, { kind: 'health', mode: 'add', value: -3 }] },
      { id: 'early', label: '借口盯实验，先走一步', hint: '少喝几杯，但还是耗掉一晚上',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }] },
    ] },

  /* ── 二、1.1 新增 14 条：全部只用既有效果 DSL；choices[0] 为温和默认项 ── */
  { id: 'e_form_season', title: '表格季', weight: 7, cond: true, tone: 'system',
    text: '科研处下发通知：年度业绩表由十二页增至十九页，新增栏目为「填表减负工作成效」。',
    choices: [
      { id: 'self', label: '亲自填', hint: '耗掉不少精力',
        effects: [{ kind: 'energy', mode: 'add', value: -2 }] },
      { id: 'delegate', label: '交给学生代填', hint: '精力省下了，学生多了一份不算学分的工作',
        effects: [{ kind: 'studentHappy', target: 'all', value: -4 }] },
    ] },

  { id: 'e_reimburse', title: '报销', weight: 7, cond: true, tone: 'system',
    text: '一张两百块的发票报了三周，财务退回的理由是：抬头少了「有限」两个字。',
    choices: [
      { id: 'reissue', label: '重新开票，再跑一趟', hint: '耗一点精力',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }] },
      { id: 'forget', label: '这笔钱不要了', hint: '经费少一点，时间省下来',
        effects: [{ kind: 'money', mode: 'add', value: -1 }] },
    ] },

  { id: 'e_conference', title: '学术年会', weight: 5, cond: { stat: 'totalIF', op: '>=', value: 50 }, tone: 'good',
    text: '受邀参加学术年会。十五分钟的报告，被前一位大佬超时压缩到了六分钟，茶歇时还是有三个人来加了微信。',
    choices: [
      { id: 'solo', label: '自己去，当天往返', hint: '耗精力',
        effects: [{ kind: 'energy', mode: 'add', value: -2 }] },
      { id: 'bring', label: '带两名学生一起去', hint: '花一笔差旅，学生开心',
        effects: [{ kind: 'money', mode: 'add', value: -3 }, { kind: 'studentHappy', target: 'all', value: 5 }] },
    ] },

  { id: 'e_ranking', title: '学科排行榜', weight: 5, cond: true, tone: 'system',
    text: '某机构发布年度学科排行榜，学院上升三位。院长办公室当天订了横幅，第二天下发「冲一流」专项申报通知。',
    choices: [
      { id: 'repost', label: '转发朋友圈，配个大拇指', hint: '学生跟着与有荣焉',
        effects: [{ kind: 'studentHappy', target: 'all', value: 1 }] },
      { id: 'apply', label: '连夜申报专项', hint: '熬掉精力，换一笔经费',
        effects: [{ kind: 'energy', mode: 'add', value: -2 }, { kind: 'money', mode: 'add', value: 5 }] },
    ] },

  { id: 'e_ai_review', title: 'AI 写的综述', weight: 6, cond: { all: [{ anyStudent: { active: true } }, hasProject] }, tone: 'absurd',
    text: '学生交来一份 AI 写的综述初稿。参考文献里有两篇不存在的论文，通讯作者都是你。',
    choices: [
      { id: 'rewrite', label: '退回去重写', hint: '他不太高兴，毕业进度慢一点',
        effects: [
          { kind: 'selectStudent', pick: 'random' },
          { kind: 'studentHappy', target: 'ctx', value: -4 },
          { kind: 'studentDegree', target: 'ctx', value: -2 },
        ] },
      { id: 'patch', label: '删掉那两篇，其余照用', hint: '项目往前走，诚信沾一点灰',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: 6 },
          { kind: 'integrity', mode: 'add', value: -2 },
        ] },
    ] },

  { id: 'e_hood_queue', title: '超净台排队', weight: 5, cond: { all: [{ hasInstrument: 'hood', min: 1 }, { stat: 'studentCount', op: '>=', value: 3 }] }, tone: 'absurd',
    text: '超净台预约表排到了凌晨四点。表格底下贴着一张便条：「轮到的同学请不要睡着」。',
    choices: [
      { id: 'allow', label: '默许通宵', hint: '学生熬着，怨气上来',
        effects: [{ kind: 'studentHappy', target: 'all', value: -4 }] },
      { id: 'schedule', label: '亲自排一张值班表', hint: '花点精力，大家睡得着了',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }, { kind: 'studentHappy', target: 'all', value: 2 }] },
    ] },

  { id: 'e_safety_check', title: '安全检查', weight: 6, cond: true, tone: 'system',
    text: '学校安全检查组到访。扣分项：试剂柜标签字体不统一、垃圾桶离水池太近、墙上的「安全第一」贴歪了。',
    choices: [
      { id: 'fix', label: '连夜整改', hint: '耗精力，扔掉一批过期耗材',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }, { kind: 'consumable', mode: 'add', value: -2 }] },
      { id: 'argue', label: '据理力争', hint: '道理讲赢了，罚款照交',
        effects: [{ kind: 'money', mode: 'add', value: -2 }] },
    ] },

  { id: 'e_hotpot', title: '实验室火锅', weight: 5, cond: { stat: 'studentCount', op: '>=', value: 2 }, tone: 'absurd',
    text: '有人在实验室偷偷煮火锅，烟雾报警器响了。消防通道里站满了隔壁组的人，有两个拿着碗。',
    choices: [
      { id: 'scold', label: '全组通报批评', hint: '学生不高兴，安全记录干净了',
        effects: [{ kind: 'studentHappy', target: 'all', value: -3 }, { kind: 'integrity', mode: 'add', value: 1 }] },
      { id: 'join', label: '先尝一口再说', hint: '全组很开心，安全处记了一笔',
        effects: [{ kind: 'studentHappy', target: 'all', value: 5 }, { kind: 'integrity', mode: 'add', value: -1 }] },
    ] },

  { id: 'e_talent_program', title: '人才计划申报', weight: 5, cond: { stat: 'rankIndex', op: '>=', value: 1 }, tone: 'system',
    text: '学院动员申报青年人才计划。材料要求「突出代表性成果」，模板里的代表作一栏留了十行。',
    choices: [
      { id: 'apply', label: '熬夜写申报书', hint: '伤身体，学院配套一笔申报经费',
        effects: [{ kind: 'energy', mode: 'add', value: -2 }, { kind: 'health', mode: 'add', value: -3 }, { kind: 'money', mode: 'add', value: 4 }] },
      { id: 'skip', label: '今年先不报', hint: '多睡几个好觉',
        effects: [{ kind: 'health', mode: 'add', value: 2 }] },
    ] },

  { id: 'e_vendor_dinner', title: '代理商饭局', weight: 5, cond: true, tone: 'system',
    text: '仪器代理商请吃饭。饭后递上一份「年度战略合作方案」，第三页用小一号字写着返点比例。',
    choices: [
      { id: 'eat', label: '只吃饭，不签字', hint: '酒喝了，方案没签',
        effects: [{ kind: 'health', mode: 'add', value: -1 }] },
      { id: 'sign', label: '签了方案', hint: '经费多一笔，诚信少一截',
        effects: [{ kind: 'money', mode: 'add', value: 4 }, { kind: 'integrity', mode: 'add', value: -4 }] },
    ] },

  { id: 'e_mentor_survey', title: '导师评价问卷', weight: 5, cond: { stat: 'studentCount', op: '>=', value: 1 }, tone: 'system',
    text: '研究生院开展导师评价问卷。问卷是匿名的，登录需要学号。',
    choices: [
      { id: 'silent', label: '什么也不说', hint: '学生如实填写，口碑攒了一点',
        effects: [{ kind: 'integrity', mode: 'add', value: 1 }] },
      { id: 'remind', label: '组会上「提醒」大家认真填', hint: '分数好看了，学生心里有数',
        effects: [{ kind: 'studentHappy', target: 'all', value: -4 }, { kind: 'integrity', mode: 'add', value: -1 }] },
    ] },

  { id: 'e_paper_mill', title: '论文中介', weight: 6, cond: true, tone: 'absurd',
    text: '邮箱收到一封邮件：「SCI 一区包录用，可开发票，支持分期」。落款是某某科技文化传媒有限公司。',
    choices: [
      { id: 'report', label: '转发给科研处', hint: '花一点精力，口碑攒了一点',
        effects: [{ kind: 'energy', mode: 'add', value: -1 }, { kind: 'integrity', mode: 'add', value: 1 }] },
      { id: 'ask', label: '回复问个价', hint: '没买，但聊天记录还在',
        effects: [{ kind: 'integrity', mode: 'add', value: -1 }] },
    ] },

  { id: 'e_cat', title: '实验室来了只猫', weight: 5, cond: true, tone: 'good',
    text: '一只橘猫从窗户钻进实验室，在恒温摇床上睡了一下午。第二天它带来了另一只。',
    choices: [
      { id: 'adopt', label: '收养，列入组员名单', hint: '全组开心，猫粮从耗材里出',
        effects: [{ kind: 'studentHappy', target: 'all', value: 6 }, { kind: 'consumable', mode: 'add', value: -2 }] },
      { id: 'evict', label: '请出去，关好窗', hint: '实验室干净了，学生有点失落',
        effects: [{ kind: 'studentHappy', target: 'all', value: -2 }] },
    ] },

  { id: 'e_deadline_extend', title: '截止日期延后', weight: 5, cond: hasProject, tone: 'absurd',
    text: '项目节点延后一周的通知，在原截止日期当晚十一点五十分发出。此时材料已经提交了。',
    choices: [
      { id: 'polish', label: '撤回来再打磨一周', hint: '花精力，项目往前走一点',
        effects: [
          { kind: 'selectProject', pick: 'randomActive' },
          { kind: 'projectProgress', target: 'ctx', mode: 'add', value: 5 },
          { kind: 'energy', mode: 'add', value: -1 },
        ] },
      { id: 'sleep', label: '交了就交了，睡觉', hint: '健康回升一点',
        effects: [{ kind: 'health', mode: 'add', value: 2 }] },
    ] },
];

export const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export const EVENT_WEIGHT_DEFAULT = 6;
export const EVENT_COOLDOWN_MONTHS = 6;
export const MACHINE_DOWN_MONTHS = 1;
export const INSPECTION_CONSUME_MUL = 1.20;

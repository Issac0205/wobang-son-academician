/**
 * endings.js —— 8 个结局（BALANCE §12 / GDD §9）
 * SPEC 硬性：诚信归零 → 坏结局「被举报」。
 * cond 使用 docs/CONTRACT.md 冻结的条件 DSL（可序列化，不放函数）。
 */

/** @typedef {{id:string,title:string,kind:'success'|'bad'|'neutral'|'active',cond:any,text:string,variants?:Array<{id:string,cond:any,text:string}>}} EndingDef */

/** @type {EndingDef[]} 按优先级从高到低排列，判定取第一个 cond 成立者。 */
export const ENDINGS = [
  { id: 'academician', title: '院士', kind: 'success',
    cond: { stat: 'rankIndex', op: '>=', value: 8 },
    text: '名单公布那天，你儿子终于搞明白你在做什么——是在你当选之后。',
    variants: [
      { id: 'high', cond: { all: [{ stat: 'integrity', op: '>=', value: 80 }, { stat: 'studentsGraduated', op: '>=', value: 10 }] },
        text: '增选名单公布那天，你在实验室擦了一下午离心机。学生把手机怼到你脸上，说：「老师，是您。」你说：「先把这批样跑完。」——这是你唯一一次说话没人听。' },
      { id: 'dark', cond: { stat: 'integrity', op: '<', value: 50 },
        text: '你当选了。名单后面的脚注里，有一份没有被公开的举报材料。你把它折起来，放进抽屉最底层。' },
    ] },
  { id: 'reported', title: '被举报', kind: 'bad',
    cond: { any: [{ stat: 'integrity', op: '<=', value: 0 }, { flag: 'caughtRedHanded' }] },
    text: '举报信是你带过的博士写的。他在信里叫你「马老师」，写了 11 页。' },
  { id: 'hospital', title: '住院', kind: 'neutral',
    cond: { stat: 'health', op: '<=', value: 0 },
    text: '体检报告最后一页写着「建议住院」。你把它夹进结题报告里，当成进度。' },
  { id: 'lab_empty', title: '实验室空了', kind: 'neutral',
    cond: { flag: 'labEmptyThisMonth' },
    text: '一个月里走了三个人。通风橱还开着，离心机里还转着昨天那管样。' },
  { id: 'bankrupt', title: '课题组解散', kind: 'neutral',
    cond: { flag: 'bankrupt' },
    text: '财务处的电话打来时你正在写本子。对方说：先把上次那批试剂的钱结了吧。' },
  { id: 'industry', title: '下海', kind: 'active',
    cond: { flag: 'resigned' },
    text: '你去了企业，做技术副总。第一次开会，你发现「保密协议」这一页比基金申请书好写得多。' },
  { id: 'almost', title: '准院士，来年再战', kind: 'neutral',
    cond: { flag: 'almostAcademician' },
    text: '你差一点。差的那一点，是三个人愿意为你写推荐信。' },
  { id: 'retire', title: '退休', kind: 'neutral',
    cond: { flag: 'retired' },
    text: '65 岁，你交回办公室钥匙。抽屉里有一沓没投出去的本子，最上面那本写着你儿子的名字。' },
];

export const ENDING_MAP = Object.fromEntries(ENDINGS.map((e) => [e.id, e]));
export const ACADEMICIAN_VARIANT_HIGH = 'high';
export const ACADEMICIAN_VARIANT_DARK = 'dark';
export const ACADEMICIAN_VARIANT_DEFAULT = 'default';

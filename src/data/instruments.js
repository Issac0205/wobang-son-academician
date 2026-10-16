/**
 * instruments.js —— 12 种仪器（原 8 种 ID 保留；v1.2 新增 4 种）
 * v1.2：价格与月维护费单位为万元；新增仪器初始为 0。
 *          初始持有量见 initCount。
 */

/** @typedef {{id:string,name:string,tier:'minor'|'major',tierLabel:string,bonus:number,initCount:number,price:number,maintain:number,tierGate:number,w:number,h:number,flavor:string}} Instrument */

/** @type {Instrument[]} */
export const INSTRUMENTS = [
  { id: 'centrifuge', name: '离心机', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 8, maintain: 0.08, tierGate: 1, w: 1, h: 1, flavor: '转子有点偏心，转起来整张台都在抖。' },
  { id: 'shaker', name: '摇床', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 3, maintain: 0.03, tierGate: 1, w: 2, h: 1, flavor: '通宵摇菌，声音像一台老洗衣机。' },
  { id: 'hplc', name: '液相', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 1, price: 45, maintain: 0.50, tierGate: 2, w: 2, h: 2, flavor: '色谱柱比学生还金贵。' },
  { id: 'ms', name: '质谱', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 260, maintain: 2.50, tierGate: 4, w: 3, h: 2, flavor: '真空泵一开，整层楼都知道你有钱了。' },
  { id: 'hood', name: '超净台', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 2, price: 2.5, maintain: 0.02, tierGate: 1, w: 2, h: 1, flavor: '紫外灯记得关。' },
  { id: 'elisa', name: '酶标仪', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 22, maintain: 0.20, tierGate: 2, w: 2, h: 1, flavor: '96 孔板排队等读数。' },
  { id: 'gc', name: '气相', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 38, maintain: 0.40, tierGate: 3, w: 2, h: 2, flavor: '载气钢瓶得用链子拴在墙上。' },
  { id: 'bath', name: '水浴锅', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 0.8, maintain: 0.01, tierGate: 1, w: 1, h: 1, flavor: '常年 37℃，冬天大家都来暖手。' },
  // v1.2 策划值：固定价；v1.3 起科研加成无上限（堆仪器的唯一约束是台面空间与维护费）。
  { id: 'akta', name: 'AKTA蛋白纯化系统', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 65, maintain: 0.65, tierGate: 3, w: 2, h: 2, flavor: '层析峰终于分开，收集管还得一支支编号。' },
  { id: 'uvvis', name: '紫外可见分光光度计', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 0, price: 6, maintain: 0.06, tierGate: 1, w: 1, h: 1, flavor: '先调空白再测样品，比色皿透光面别用手摸。' },
  { id: 'pcr', name: 'PCR仪', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 0, price: 12, maintain: 0.12, tierGate: 2, w: 1, h: 1, flavor: '扩增跑了一夜，梦里还在调退火温度。' },
  { id: 'gel', name: '凝胶成像系统', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 0, price: 10, maintain: 0.10, tierGate: 2, w: 2, h: 1, flavor: '条带清楚才算数，过曝的胶图不能交差。' },
];

export const INSTRUMENT_MAP = Object.fromEntries(INSTRUMENTS.map((it) => [it.id, it]));
export const INSTRUMENT_IDS = INSTRUMENTS.map((it) => it.id);

// 1.1（LAB-SPACE §5）：固定价、取消持有上限——约束改由实验室空间承担。
// w×h = 占格（可旋转 90°）。常量保留，避免旧引用报错。
export const INST_PRICE_GROWTH = 1;    // 不再涨价
export const INST_HOLD_CAP = Infinity; // 不再限台数
// 1.3：INST_BONUS_CAP 已删除 —— 仪器加成不再封顶，堆仪器要让玩家舒服。
export const INST_COEF_BASE = 1.00;
export const START_INST_BONUS = 0.45;   // SPEC 初始持有量推导值（离心机.06+摇床.06+液相.15+超净台.12+水浴锅.06）
export const TEMP_BROKEN_BONUS_MUL = 0; // 停机当月该仪器贡献倍率

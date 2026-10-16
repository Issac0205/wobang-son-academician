/**
 * instruments.js —— 8 种仪器（BALANCE §4 / GDD §4）
 * SPEC 硬性：8 种；小幅 = 离心机/摇床/超净台/水浴锅，大幅 = 液相/质谱/酶标仪/气相；
 *          初始持有量见 initCount。
 */

/** @typedef {{id:string,name:string,tier:'minor'|'major',tierLabel:string,bonus:number,initCount:number,price:number,maintain:number,tierGate:number,holdCap:number}} Instrument */

/** @type {Instrument[]} */
export const INSTRUMENTS = [
  { id: 'centrifuge', name: '离心机', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 8,   maintain: 0.08, tierGate: 1, holdCap: 3 },
  { id: 'shaker',     name: '摇床',   tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 3,   maintain: 0.03, tierGate: 1, holdCap: 3 },
  { id: 'hplc',       name: '液相',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 1, price: 45,  maintain: 0.50, tierGate: 2, holdCap: 3 },
  { id: 'ms',         name: '质谱',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 260, maintain: 2.50, tierGate: 4, holdCap: 3 },
  { id: 'hood',       name: '超净台', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 2, price: 2.5, maintain: 0.02, tierGate: 1, holdCap: 3 },
  { id: 'elisa',      name: '酶标仪', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 22,  maintain: 0.20, tierGate: 2, holdCap: 3 },
  { id: 'gc',         name: '气相',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 38,  maintain: 0.40, tierGate: 3, holdCap: 3 },
  { id: 'bath',       name: '水浴锅', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 0.8, maintain: 0.01, tierGate: 1, holdCap: 3 },
];

export const INSTRUMENT_MAP = Object.fromEntries(INSTRUMENTS.map((it) => [it.id, it]));
export const INSTRUMENT_IDS = INSTRUMENTS.map((it) => it.id);

export const INST_PRICE_GROWTH = 1.6;   // 第 n 台价 = price * 1.6^(n-1)
export const INST_HOLD_CAP = 3;
export const INST_BONUS_CAP = 0.90;     // 全仪器加成总和上限
export const INST_COEF_BASE = 1.00;
export const START_INST_BONUS = 0.45;   // SPEC 初始持有量推导值（离心机.06+摇床.06+液相.15+超净台.12+水浴锅.06）
export const TEMP_BROKEN_BONUS_MUL = 0; // 停机当月该仪器贡献倍率

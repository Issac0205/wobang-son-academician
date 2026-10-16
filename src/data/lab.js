/**
 * lab.js —— 1.1 实验室空间（docs/LAB-SPACE.md §3/§4/§7）
 * 层级：实验室 room（4 台位）→ 实验台 bench（W×H 网格）→ 仪器 item（w×h，可旋转）。
 * 只放数据，不 import 任何东西（check.mjs §7）。
 */

export const ROOM_SLOTS = 4;            // 每间实验室台位数（2×2 平面）
export const ROOM_SLOT_COLS = 2;
export const ROOM_MAX = 4;

/** 第 i 间实验室（下标 0 起）；price 固定；rankGate = 购买所需 rankIndex */
export const ROOMS = [
  { id: 'A301', name: '主楼 A301',     price: 0,   rankGate: 0, flavor: '走廊尽头那间，窗外是锅炉房。' },
  { id: 'A302', name: '主楼 A302',     price: 60,  rankGate: 1, flavor: '隔壁课题组退休腾出来的，墙上还贴着旧海报。' },
  { id: 'B205', name: '实验楼 B205',   price: 150, rankGate: 2, flavor: '新楼，有独立通风，学生终于不用排队用超净台。' },
  { id: 'C101', name: '公共平台 C101', price: 300, rankGate: 3, flavor: '一楼承重地面，大型仪器专用。' },
];

export const BENCHES = [
  { id: 'bench_std', name: '标准实验台', w: 4, h: 2, price: 4,  rankGate: 0 },
  { id: 'bench_big', name: '大型仪器台', w: 4, h: 3, price: 12, rankGate: 2 },
];
export const BENCH_MAP = Object.fromEntries(BENCHES.map((b) => [b.id, b]));

export const SELL_REFUND_RATE = 0.5;    // 仪器/实验台出售退款比例
export const START_BENCHES = ['bench_std', 'bench_std'];  // 开局 A301 的台子

/** 迁移/自动摆放新建台子时：单件 ≥ 该格数，或剩余需求 ≥ 该格数 → 用大型台（LAB-SPACE §9.3） */
export const BIG_BENCH_ITEM_CELLS = 6;
export const BIG_BENCH_DEMAND_CELLS = 8;

/** 沉浸文案（§10） */
export const LAB_TEXT = {
  full: '台面上已经挤不下了。再加一张实验台，或者去申请一间新实验室。',
  badSpot: '这个位置放不下：越界了，或者和别的仪器挤在一起。',
  noSlot: '实验室的台位都占满了，先去申请一间新实验室。',
  roomsMaxed: '学院已经批不出更多房间了。',
  benchNotEmpty: '台上还有仪器，先把仪器搬走或卖掉再拆台。',
  // 1.3 仓库（§11）
  notOnBench: '这台仪器不在台面上，收不进仓库。',
  noStorageItem: '仓库里没有这台仪器。',
  storageDeployFail: '仓库里这台仪器暂时摆不出来：先加一张实验台，或者腾出台面空间。',
};

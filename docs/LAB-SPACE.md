# LAB-SPACE —— 1.1 实验室空间背包系统（策划案 t2）

> 范围：只改仪器的「获取与摆放」方式。8 种仪器的科研加成、维护费、头衔门槛、项目仪器要求 **全部沿用 1.0**。
> v1.3 变更：`INST_BONUS_CAP` 已删除（**加成无上限**），并新增「仓库」（见 §11）。
> 数值未做机器人通关率测量（用户决策：真人试玩调）。

## 1. 一句话
实验室 → 摆实验台（花钱）→ 实验台上摆仪器（占格，越大越占）。不再有「越买越贵」和「每种最多 3 台」，唯一约束是空间和钱。

## 2. 层级与规则

| 层 | 规则 |
| --- | --- |
| 实验室 room | 每间 4 个台位（2×2 平面图）。开局 1 间（免费）。可加购，最多 4 间。 |
| 实验台 bench | 放在空台位上，花钱。有两种尺寸（见 §4）。台上是 W×H 网格。 |
| 仪器 item | 矩形占格 w×h，放在一张台子内，不可跨台，不可重叠。允许旋转 90°（w/h 互换）。 |

- 加成/维护/项目要求：按「**摆在台面上**的仪器」按种类计数，= 1.0 的 `lab.equipment[id]`。买下即必须当场摆放；放不下就买不了（提示「空间不足，先加实验台」）。
- 仓库（v1.3，§11）：台面上的仪器可「存入仓库」腾出台面，仓库里的仪器可「取出」重新摆放或直接卖出。**仓库不提供加成、不收维护费**。
- 移动：免费，可在任意台子间挪（拖拽或「选中→点空位」）。
- 出售仪器：退回固定价 50%。拆除实验台：台上必须清空，退 50%。实验室不可出售。
- 停机事件 `instrumentDown`：仍按种类生效（该种所有台停机），UI 在对应格子上叠「停机」灰罩。

## 3. 实验室（新增）

| 序号 | 名称（沉浸文案） | 价格（万） | 头衔门槛 rankIndex |
| --- | --- | --- | --- |
| 1 | 主楼 A301 | 0（开局） | 0 |
| 2 | 主楼 A302 | 60 | 1 |
| 3 | 实验楼 B205 | 150 | 2 |
| 4 | 公共平台 C101 | 300 | 3 |

每间 4 台位，空间总上限 = 16 台位。

## 4. 实验台（新增）

| id | 名称 | 网格 W×H | 格数 | 价格（万） | 头衔门槛 |
| --- | --- | --- | --- | --- | --- |
| bench_std | 标准实验台 | 4×2 | 8 | 4 | 0 |
| bench_big | 大型仪器台 | 4×3 | 12 | 12 | 2 |

单价固定（不随数量涨）。每格造价：标准 0.50 万/格，大型 1.00 万/格（大型台用来放 2×2/3×2 的大件更省台位）。

## 5. 仪器（8 种，固定价）

价格 = 1.0 的基础价（第一台价）；不再乘 1.6^n，无持有上限。

| id | 名称 | 档 | 占格 w×h | 格数 | 固定价（万） | 加成（1.0 不变） | 月维护（1.0 不变） | 头衔门槛（不变） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bath | 水浴锅 | 小幅 | 1×1 | 1 | 0.8 | 0.06 | 0.01 | 1 |
| centrifuge | 离心机 | 小幅 | 1×1 | 1 | 8 | 0.06 | 0.08 | 1 |
| shaker | 摇床 | 小幅 | 2×1 | 2 | 3 | 0.06 | 0.03 | 1 |
| hood | 超净台 | 小幅 | 2×1 | 2 | 2.5 | 0.06 | 0.02 | 1 |
| elisa | 酶标仪 | 大幅 | 2×1 | 2 | 22 | 0.15 | 0.20 | 2 |
| hplc | 液相 | 大幅 | 2×2 | 4 | 45 | 0.15 | 0.50 | 2 |
| gc | 气相 | 大幅 | 2×2 | 4 | 38 | 0.15 | 0.40 | 3 |
| ms | 质谱 | 大幅 | 3×2 | 6 | 260 | 0.15 | 2.50 | 4 |

说明：
- v1.3：**加成不再封顶**（`INST_BONUS_CAP` 已删除，见 §12）。原来「每种 3 台」隐性封住的堆叠，现在只由「空间 + 维护费」约束：无限堆小件（例：15 台水浴锅 = +90%）需要 15 格 ≈ 2 张标准台，且每月照付 0.15 万维护费——这是预期内的「穷组玩法」。
- 3×2 质谱可以放在标准台（4×2）上，但只剩一条 1×2 的竖条，只能塞两台 1×1，提示玩家「大型台更合适」。

## 6. 开局与空间预算

开局（=1.0 initCount）：离心机1、摇床1、液相1、超净台2、水浴锅1，共 12 格。
开局送 A301 + 2 张标准台（16 格），自动摆放后剩 4 格空余（可放下一台酶标仪 + 一台摇床/超净台）。

推荐开局摆放（坐标 x,y 从 0 起，台宽 4 高 2）：

| 台 | 物件 |
| --- | --- |
| A301-台位1 标准台 | 液相 2×2 @(0,0)；超净台 2×1 @(2,0)；超净台 2×1 @(2,1) |
| A301-台位2 标准台 | 摇床 2×1 @(0,0)；离心机 @(2,0)；水浴锅 @(3,0)；空 4 格（第二行） |

满配需求（顶级项目 require：离心1 摇床1 超净1 液相2 酶标2 气相1 质谱1）= 1+2+2+8+4+4+6 = 27 格 → 约 A301 满 4 台位（如 2 标准 + 2 大型 = 40 格）即可，无需第二间实验室；第二间以后是为**无上限的加成堆叠**与冗余（停机备份）准备的，放不下的仪器也可以先存进仓库。

## 7. 可直接落 src/data 的表

建议新文件 `src/data/lab.js`，并改 `src/data/instruments.js`：

```js
// src/data/lab.js —— 1.1 实验室空间（LAB-SPACE.md）
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
```

```js
// src/data/instruments.js 变更：price 改为固定价语义；新增 w/h/flavor；删除 holdCap 字段使用
export const INSTRUMENTS = [
  { id: 'centrifuge', name: '离心机', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 8,   maintain: 0.08, tierGate: 1, w: 1, h: 1, flavor: '转子有点偏心，转起来整张台都在抖。' },
  { id: 'shaker',     name: '摇床',   tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 3,   maintain: 0.03, tierGate: 1, w: 2, h: 1, flavor: '通宵摇菌，声音像一台老洗衣机。' },
  { id: 'hplc',       name: '液相',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 1, price: 45,  maintain: 0.50, tierGate: 2, w: 2, h: 2, flavor: '色谱柱比学生还金贵。' },
  { id: 'ms',         name: '质谱',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 260, maintain: 2.50, tierGate: 4, w: 3, h: 2, flavor: '真空泵一开，整层楼都知道你有钱了。' },
  { id: 'hood',       name: '超净台', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 2, price: 2.5, maintain: 0.02, tierGate: 1, w: 2, h: 1, flavor: '紫外灯记得关。' },
  { id: 'elisa',      name: '酶标仪', tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 22,  maintain: 0.20, tierGate: 2, w: 2, h: 1, flavor: '96 孔板排队等读数。' },
  { id: 'gc',         name: '气相',   tier: 'major', tierLabel: '大幅', bonus: 0.15, initCount: 0, price: 38,  maintain: 0.40, tierGate: 3, w: 2, h: 2, flavor: '载气钢瓶得用链子拴在墙上。' },
  { id: 'bath',       name: '水浴锅', tier: 'minor', tierLabel: '小幅', bonus: 0.06, initCount: 1, price: 0.8, maintain: 0.01, tierGate: 1, w: 1, h: 1, flavor: '常年 37℃，冬天大家都来暖手。' },
];
export const INST_PRICE_GROWTH = 1;    // 1.1：固定价（保留常量以免旧引用报错；instrumentPrice 不再用 ownedCount）
export const INST_HOLD_CAP = Infinity; // 1.1：取消持有上限，空间约束取代
// v1.3：INST_BONUS_CAP 已删除（加成无上限）/ START_INST_BONUS = 0.45 / TEMP_BROKEN_BONUS_MUL 不变
```

## 8. 状态结构（STATE_VERSION 2 → 3）

```js
lab: {
  rooms: [ { id: 'A301', slots: [ benchOrNull, benchOrNull, benchOrNull, benchOrNull ] } ],
  // bench = { uid: 'b1', type: 'bench_std', items: [ { uid: 'i1', inst: 'hplc', x: 0, y: 0, rot: false } ] }
  // rot=true 时占 h×w
  nextUid: 3,
  // 1.3 仓库：{ uid, inst }（uid 沿用采购时分配的 lab.nextUid 流水号）
  storage: [],
  equipment: { centrifuge: 1, ... },   // 派生字段：每次摆放变更后由 recountEquipment(lab) 重算，旧公式/rules/selectors 照用
  equipmentDown, purchaseCount,          // 不变
}
```

保留 `lab.equipment` 为派生计数，是为了让 `equipmentBonus / maintenanceTotal / missingInstruments / rules / bots` 零改动。

新 action（engine）：`lab/buyRoom`、`lab/buyBench {roomIdx, slot, type}`、`lab/sellBench {benchUid}`、`lab/buyInstrument {id, benchUid, x, y, rot}`（替换旧 buyEquipment；无坐标时自动首个可放位）、`lab/moveItem {itemUid, benchUid, x, y, rot}`、`lab/sellItem {itemUid}`。
v1.3 仓库 action：`lab/storeItem {itemUid}`（台面 → 仓库）、`lab/deployItem {storageUid, benchUid?, x?, y?, rot?}`（仓库 → 台面；无坐标时自动第一个可放位，放不下则拒绝且留在仓库）、`lab/sellStored {storageUid}`（仓库直接卖，退款同 `SELL_REFUND_RATE`）。三个动作都会 `recountEquipment(next.lab)`。
校验：`fits(bench, w, h, x, y, ignoreUid)` = 不越界 && 不与其他 item 重叠。

## 9. 旧存档迁移（MIGRATIONS[2]，v2→v3）

1. 读 `lab.equipment` 计数（1.0 的档最多每种 3 台，最多 24 台 / 66 格）。
2. 建 A301，空台位。
3. 把所有仪器展开成列表，按格数降序（同格数按 INSTRUMENTS 顺序）—— First-Fit Decreasing：
   - 对每台：遍历已有台子，按 (y, x) 扫描找第一个能放的位置，先试不旋转再试旋转；
   - 放不下 → 在当前房间下一个空台位**免费**新建台子（3×2 以上的大件或剩余 ≥ 8 格的需求用 bench_big，否则 bench_std），台位满就**免费**开下一间（ROOMS 顺序，最多 4 间）。
4. 迁移赠送的台子/房间不扣钱：老玩家既有资产不缩水，加成数值完全等同（equipment 计数不变）。
5. `equipmentDown / purchaseCount` 原样保留；重算 `equipment` 并断言与迁移前逐项相等（不等则迁移失败返回 null → 走 1.0 现有的「读档失败」路径）。
6. 新开局不走迁移：直接用 §6 推荐摆放（等价于对 initCount 跑同一算法，START_BENCHES 预置 2 张标准台）。

验证口径（供实现/测试）：1.0 初始档迁移后 = 1 间、2 张标准台、equipment 与 initCount 相等、equipmentBonus = 0.45；1.0 满仓档（每种 3 台）迁移后 equipment 不变、equipmentBonus = 2.52（v1.3 起不封顶，不再是 0.90）。

## 10. 沉浸感（UI 文案建议）

- 「仪器台」页改名「实验室」：顶部房间页签（A301/A302…，未购显示锁 + 价格 + 一句 flavor）。
- 2×2 台位平面图，每张台子画成格子，仪器为带图标/名称的色块（小幅=蓝灰，大幅=琥珀），停机叠灰斜纹 + 「停机」。
- 购买流程：选仪器 → 格子上出现虚影，绿=可放、红=冲突，点击落位；R 键/按钮旋转。键盘可达：方向键移动虚影、Enter 落位、Esc 取消（无障碍）。
- 购入/搬迁写入编年史：「A301 新到一台质谱，真空泵的嗡嗡声成了课题组的新背景音。」
- 空间不足提示：「台面上已经挤不下了。再加一张实验台，或者去申请一间新实验室。」
- 仪器 hover 显示 flavor + 加成 + 维护费。

## 11. 仓库（v1.3 新增）

用户反馈：仪器应该能卖掉、或放进仓库，方便重新设计实验室布局。

| 动作 | 入口 | 规则 |
| --- | --- | --- |
| 存入仓库 `lab/storeItem {itemUid}` | 台面仪器 → 搬动条「存入仓库」 | 只接受**在台面上**的仪器；不在台面 → 拒绝并 toast |
| 取出 `lab/deployItem {storageUid, benchUid?, x?, y?, rot?}` | 仓库行「取出」→ 拿在手上 → 点台位 | 未给坐标自动找位置；放不下 → 拒绝且**留在仓库**（资产不丢） |
| 卖出 `lab/sellStored {storageUid}` | 仓库行「卖掉」 | 退款 = 仪器价 × `SELL_REFUND_RATE`（与台面卖出同口径） |

结构：`lab.storage = [{ uid, inst }]`，uid 沿用该仪器采购时从 `lab.nextUid` 分配的流水号（存取改位置，不改身份）。

**仓库不提供加成、不收维护费**（这是设计底线，不是省事）：
`countEquipment` 只统计台上的仪器，`equipmentBonus / maintenanceTotal / missingInstruments` 全部读这个派生计数。
若仓库也给加成，仓库就等于一块**无限大且免费**的台面，「空间不足 → 加台 / 开房间」这条唯一的取舍会被「先塞仓库」直接绕过，台面系统失去意义。

失败一律「clone + toast」：不扣钱、不改 lab（只写 `ui.toast`），与既有 `lab/*` 动作同风格。
旧档没有 `lab.storage` 时安全默认成 `[]`（不因此让读档失败）；serialize/hydrate 往返保留仓库内容。

验证口径（供实现/测试）：
1. 存入后 `countEquipment`、`lab.equipment`、`equipmentBonus`、`maintenanceTotal` 同步下降，钱不变；
2. 取出放回后四项全部恢复原值，且台面上该 uid 恰好一台（不复制）；
3. 仓库卖出退款 = 价格 × 0.5；
4. 删掉 `lab.storage` 字段的旧档 hydrate 后不报错且 `storage = []`。

## 12. 加成无上限（v1.3 变更）

用户反馈：仪器加成不应该封顶，堆仪器要让玩家舒服。

- 删除 `src/data/instruments.js` 的 `INST_BONUS_CAP`（原值 0.90）及全部引用；
- `core/formulas.js` 的 `equipmentBonus` 直接返回全部仪器加成之和（`equipmentBonusSum` 保留为同值别名，接口不变）；
- `core/selectors.js` 删除 `bonusCapPct` / `bonusCapped` 字段，`bonusPct` 保留（`bonusRawPct` 为同值）；
- UI 撤销「（已封顶）」「（上限 90%）」等文案，直接显示加成百分比。

实测（tests/lab.test.mjs §10）：12 种仪器各一台 = **+123%**；再添一台水浴锅 = **+129%**（旧实现两处都会显示 90%）。

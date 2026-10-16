/**
 * tests/lab.test.mjs —— 1.1 实验室空间（docs/LAB-SPACE.md）
 *
 * 断言三件事：
 *   ① 摆放校验：fits 的越界 / 碰撞 / 旋转 / 移动时忽略自身；引擎动作拒绝非法坐标且不扣钱；
 *   ② 存档迁移 v2 → v3：只有 equipment 计数的旧档按 FFD 自动摆放，计数逐项不变；
 *   ③ 加成不变：科研加成/维护费只看已摆放仪器的派生计数，与 1.0 公式同值；
 *   ④ 1.3：加成不封顶（堆仪器必须继续涨）+ 仓库（不提供加成、不收维护费，可取出/卖出）。
 *
 * 运行：node 评院士/tests/lab.test.mjs
 */

import { createSuite, freshGame } from './lib/harness.mjs';
import { ACTIONS, reduce } from '../src/core/engine.js';
import { createState } from '../src/core/state.js';
import { hydrate, serialize, STATE_VERSION } from '../src/core/save.js';
import { fits, footprint, findSpot, countEquipment, layoutFromCounts } from '../src/core/lab.js';
import { equipmentBonus, maintenanceTotal, instrumentPrice } from '../src/core/formulas.js';
import { INSTRUMENTS, INSTRUMENT_MAP } from '../src/data/instruments.js';
import { PROJECT_MAP } from '../src/data/projects.js';
import { ROOMS, BENCH_MAP, ROOM_MAX, SELL_REFUND_RATE } from '../src/data/lab.js';
import { selectLabSpace, selectLab } from '../src/core/selectors.js';

const mods = { createState, reduce, ACTIONS };
const s = createSuite('实验室空间');
// 开局台子上已摆着起始仪器 → 测试用一张新买的空台（最后一张 = 新买的那张）
const lastBench = (st) => st.lab.rooms.flatMap((r) => r.slots).filter(Boolean).slice(-1)[0];
const benchOf = (st, uid) => st.lab.rooms.flatMap((r) => r.slots).find((x) => x && x.uid === uid);
const rich = (seed) => { const g = freshGame(mods, seed); g.player.money = 5000; g.player.rankIndex = 3; return g; };

/* ── 1 纯函数摆放校验 ── */
{
  const bench = { uid: 'bx', type: 'bench_std', items: [{ uid: 'i1', inst: 'centrifuge', x: 0, y: 0, rot: false }] };
  const big = INSTRUMENTS.find((d) => d.w * d.h === 6);
  s.ok(Boolean(big), '有 3×2 的大件（质谱）');
  s.ok(!fits(bench, 1, 1, 0, 0), '与已有仪器重叠 → 不能放');
  s.ok(fits(bench, 1, 1, 1, 0), '相邻空格 → 能放');
  s.ok(!fits(bench, 2, 2, 3, 0), '越右边界 → 不能放');
  s.ok(!fits(bench, 1, 1, 0, 2), '越下边界 → 不能放');
  s.ok(!fits(bench, 1, 1, -1, 0), '负坐标 → 不能放');
  s.ok(!fits(bench, 1, 1, 0.5, 0), '非整数坐标 → 不能放');
  s.ok(fits(bench, 1, 1, 0, 0, 'i1'), '移动时忽略自身占格');
  const fp = footprint(big.id, false); const fr = footprint(big.id, true);
  s.eq(fp.w * fp.h, fr.w * fr.h, '旋转不改面积');
  s.eq(fr.w, fp.h, '旋转交换宽高');
  const stdCap = BENCH_MAP.bench_std.w * BENCH_MAP.bench_std.h;
  s.eq(stdCap, 8, '标准台 4×2 = 8 格');
  s.eq(BENCH_MAP.bench_big.w * BENCH_MAP.bench_big.h, 12, '大型台 4×3 = 12 格');
}

/* ── 2 引擎动作 ── */
{
  let g = rich('lab-actions');
  g = reduce(g, ACTIONS.buyBench({ type: 'bench_std' }));
  s.eq(lastBench(g).items.length, 0, '新买的实验台是空的');
  const before = g.player.money;
  const eq0 = countEquipment(g.lab);
  const b = lastBench(g);
  const bad = reduce(g, ACTIONS.buyInstrument({ id: 'centrifuge', benchUid: b.uid, x: 99, y: 0 }));
  s.eq(bad.player.money, before, '越界坐标申购：不扣钱');
  s.ok(Boolean(bad.ui.toast), '越界坐标申购：给出提示');
  g = reduce(g, ACTIONS.buyInstrument({ id: 'centrifuge', benchUid: b.uid, x: 0, y: 0 }));
  g = reduce(g, ACTIONS.buyInstrument({ id: 'centrifuge', benchUid: b.uid, x: 1, y: 0 }));
  const p = instrumentPrice('centrifuge');
  s.eq(g.player.money, Math.round((before - 2 * p) * 100) / 100, '第二台同款不涨价（固定价）');
  const clash = reduce(g, ACTIONS.buyInstrument({ id: 'centrifuge', benchUid: b.uid, x: 0, y: 0 }));
  s.eq(clash.player.money, g.player.money, '碰撞坐标申购：不扣钱');
  s.eq(countEquipment(g.lab).centrifuge, (eq0.centrifuge || 0) + 2, '摆放后派生计数 +2');
  s.eq(g.lab.equipment.centrifuge, countEquipment(g.lab).centrifuge, 'lab.equipment 与摆放结果一致');

  // 买满到放不下：无上限，但空间会满
  let h = rich('lab-full');
  let n = 0;
  while (findSpot(h.lab, 'centrifuge') && n < 200) { h = reduce(h, ACTIONS.buyInstrument({ id: 'centrifuge' })); n += 1; }
  const m = h.player.money;
  const full = reduce(h, ACTIONS.buyInstrument({ id: 'centrifuge' }));
  s.eq(full.player.money, m, '空间满：申购被拒，不扣钱');
  h = reduce(h, ACTIONS.buyBench({ type: 'bench_std' }));
  s.ok(Boolean(findSpot(h.lab, 'centrifuge')), '买张实验台后又有位置');

  // 房间：按序、头衔门槛、上限
  let r = rich('lab-rooms');
  const r0 = r.lab.rooms.length;
  r = reduce(r, ACTIONS.buyRoom());
  s.eq(r.lab.rooms.length, r0 + 1, '申请实验室：房间 +1');
  for (let i = 0; i < 6; i += 1) r = reduce(r, ACTIONS.buyRoom());
  s.eq(r.lab.rooms.length, ROOM_MAX, '房间最多 ' + ROOM_MAX + ' 间');
  let lo = freshGame(mods, 'lab-gate'); lo.player.money = 5000; lo.player.rankIndex = 0;
  if (lo.lab.rooms.length < ROOMS.length && ROOMS[lo.lab.rooms.length].rankGate > 0) {
    s.eq(reduce(lo, ACTIONS.buyRoom()).lab.rooms.length, lo.lab.rooms.length, '头衔不够：申请实验室被拒');
  }
  s.eq(reduce(lo, ACTIONS.buyBench({ type: 'bench_big' })).player.money, lo.player.money, '头衔不够：大型台被拒');

  // 移动 / 出售
  const item = benchOf(g, b.uid).items[0];
  const moved = reduce(g, ACTIONS.moveItem({ itemUid: item.uid, benchUid: b.uid, x: 2, y: 1, rot: false }));
  const mi = benchOf(moved, b.uid).items.find((it) => it.uid === item.uid);
  s.ok(mi && mi.x === 2 && mi.y === 1, '移动仪器到空位成功');
  const noMove = reduce(g, ACTIONS.moveItem({ itemUid: item.uid, benchUid: b.uid, x: 1, y: 0 }));
  s.eq(benchOf(noMove, b.uid).items.find((it) => it.uid === item.uid).x, item.x, '移动到被占位置 → 不动');
  const sold = reduce(g, ACTIONS.sellItem({ itemUid: item.uid }));
  s.ok(sold.player.money > g.player.money, '出售仪器回收经费');
  s.eq(countEquipment(sold.lab).centrifuge, countEquipment(g.lab).centrifuge - 1, '出售后计数 -1');
  const notEmpty = reduce(g, ACTIONS.sellBench({ benchUid: b.uid }));
  s.ok(Boolean(benchOf(notEmpty, b.uid)), '台上有仪器：不能拆台');
  let empty = reduce(rich('lab-sell'), ACTIONS.buyBench({ type: 'bench_std' }));
  const eb = lastBench(empty).uid; const em = empty.player.money;
  empty = reduce(empty, ACTIONS.sellBench({ benchUid: eb }));
  s.ok(!benchOf(empty, eb) && empty.player.money > em, '空台可拆，回收半价');
}

/* ── 3 存档迁移 v2 → v3 ── */
{
  s.eq(STATE_VERSION, 3, 'STATE_VERSION 随实验室空间 +1（2 → 3）');
  const legacy = freshGame(mods, 'lab-v2');
  delete legacy.lab.rooms; delete legacy.lab.nextUid;
  legacy.lab.equipment = { centrifuge: 3, shaker: 2, hplc: 2, ms: 1 };
  legacy.player.rankIndex = 2;
  const back = hydrate({ version: 2, savedAt: 1, state: legacy });
  s.ok(back !== null, 'v2 存档能读进来');
  s.eq(back.version, STATE_VERSION, '迁移后版本号 = 当前');
  const c = countEquipment(back.lab);
  for (const k of Object.keys(legacy.lab.equipment)) s.eq(c[k] || 0, legacy.lab.equipment[k], 'v2→v3：' + k + ' 数量不变');
  s.eq(JSON.stringify(back.lab.equipment), JSON.stringify(c), 'lab.equipment 与摆放派生一致');
  // 每台都在台内且不重叠
  let okAll = true;
  for (const room of back.lab.rooms) for (const bench of room.slots) if (bench) for (const it of bench.items) {
    const fp = footprint(it.inst, it.rot);
    if (!fits({ ...bench, items: bench.items }, fp.w, fp.h, it.x, it.y, it.uid)) okAll = false;
  }
  s.ok(okAll, 'v2→v3：自动摆放无越界 / 无重叠');
  s.ok(layoutFromCounts({ ms: 999 }) === null, '放不下（超 4 间）→ layoutFromCounts 返回 null');
  // v3 往返
  const again = hydrate(JSON.parse(JSON.stringify(serialize(back))));
  s.eq(JSON.stringify(again.lab.rooms), JSON.stringify(back.lab.rooms), 'v3 往返：房间/台/仪器原样');
}

/* ── 4 加成不变：只看已摆放的仪器 ── */
{
  const g = rich('lab-bonus');
  const counts = { centrifuge: 2, shaker: 1, hplc: 1 };
  const placed = { ...g.lab, ...layoutFromCounts(counts) };
  placed.equipment = countEquipment(placed);
  const ref = { ...g.lab, equipment: { ...counts } };
  s.eq(equipmentBonus(placed), equipmentBonus(ref), '科研加成 = 1.0 计数口径同值');
  s.eq(maintenanceTotal(placed), maintenanceTotal(ref), '维护费 = 1.0 计数口径同值');
  s.ok(Object.keys(counts).every((k) => INSTRUMENT_MAP[k]), '测试用仪器 id 存在');
}

/* v1.2：新仪器采购/门槛/存档与项目准入，固定样例无需平衡机器人。 */
const added = ['akta', 'uvvis', 'pcr', 'gel'];
s.eq(INSTRUMENTS.slice(0, 8).map((d) => d.id), ['centrifuge', 'shaker', 'hplc', 'ms', 'hood', 'elisa', 'gc', 'bath'], '保留原八种 ID 与顺序');
for (const [id, price, maintain, bonus, gate, cells] of [
  ['akta', 65, 0.65, 0.15, 3, 4], ['uvvis', 6, 0.06, 0.06, 1, 1],
  ['pcr', 12, 0.12, 0.06, 2, 1], ['gel', 10, 0.10, 0.06, 2, 2],
]) {
  let g = reduce(rich('new-' + id), ACTIONS.buyBench({ type: 'bench_std' }));
  const before = g.player.money;
  g.player.rankIndex = gate - 1;
  s.eq(reduce(g, ACTIONS.buyInstrument({ id })).player.money, before, id + ' 头衔不足不扣钱');
  g.player.rankIndex = gate;
  g = reduce(g, ACTIONS.buyInstrument({ id }));
  g = reduce(g, ACTIONS.buyInstrument({ id }));
  s.eq(g.lab.equipment[id], 2, id + ' 可以实购两台');
  s.near(g.player.money, before - price * 2, 0.001, id + ' 重复购买固定价');
  const fp = footprint(id, false);
  s.eq(fp.w * fp.h, cells, id + ' 占格');
  s.near(equipmentBonus({ equipment: { [id]: 1 } }), bonus, 0.001, id + ' 科研加成');
  s.near(maintenanceTotal({ equipment: { [id]: 1 } }), maintain, 0.001, id + ' 月维护费');
  const back = hydrate(serialize(g));
  s.eq(back.lab.equipment, g.lab.equipment, id + ' 已购设备读档不丢');
  s.eq(back.lab.rooms, g.lab.rooms, id + ' 摆放读档不变');
}
for (const version of [2, 3]) {
  let legacy = rich('legacy-' + version);
  legacy = reduce(legacy, ACTIONS.buyInstrument({ id: 'centrifuge' }));
  const before = { ...legacy.lab.equipment };
  for (const id of added) {
    delete legacy.lab.equipment[id]; delete legacy.lab.equipmentDown[id]; delete legacy.lab.purchaseCount[id];
  }
  if (version === 2) { delete legacy.lab.rooms; delete legacy.lab.nextUid; }
  const back = hydrate({ version, state: legacy });
  s.ok(back !== null, 'v' + version + ' 旧档可读');
  s.eq(back.lab.equipment, before, 'v' + version + ' 旧设备保留且新增设备归零');
  for (const id of added) {
    s.eq(back.lab.equipmentDown[id], 0, 'v' + version + ' ' + id + ' 停机缺键归零');
    s.eq(back.lab.purchaseCount[id], 0, 'v' + version + ' ' + id + ' 采购缺键归零');
  }
}
for (const defId of ['E5', 'E6', 'N7']) {
  const def = PROJECT_MAP[defId];
  let g = rich('project-' + defId);
  g.market.pool = [{ ...def, defId, kind: 'project', offerId: 'extension' }];
  const blocked = reduce(g, ACTIONS.acceptProject({ offerId: 'extension' }));
  s.eq(blocked.projects.length, g.projects.length, defId + ' 缺设备不能承接');
  s.eq(blocked.player.money, g.player.money, defId + ' 拒接不发定金');
  for (const id of Object.keys(def.require)) {
    if (!g.lab.equipment[id]) {
      if (!findSpot(g.lab, id)) g = reduce(g, ACTIONS.buyBench({ type: 'bench_std' }));
      g = reduce(g, ACTIONS.buyInstrument({ id }));
    }
  }
  const accepted = reduce(g, ACTIONS.acceptProject({ offerId: 'extension' }));
  s.ok(accepted.projects.some((p) => p.defId === defId), defId + ' 设备齐备后实接成功');
  s.ok(accepted.player.money > g.player.money, defId + ' 实接收到定金');
  const back = hydrate(serialize(accepted));
  s.ok(back.projects.some((p) => p.defId === defId), defId + ' 新项目读档保留');
}

/* ── 9 头衔门槛必须说人话：不得把内部索引（「头衔 2」）直接给玩家 ── */
{
  const g = freshGame(mods, 'lab-rank-title');            // 开局：副研究员（rankIndex 1）
  const sp = selectLabSpace(g);
  const big = sp.benches.find((b) => b.id === 'bench_big');
  s.ok(Boolean(big), '实验台列表里有大型仪器台');
  s.ok(Boolean(big) && typeof big.rankGateTitle === 'string' && big.rankGateTitle.length > 0,
    '大型仪器台给的是头衔名 rankGateTitle，不是裸索引', big ? String(big.rankGateTitle) : '未找到');
  s.ok(Boolean(big) && !/头衔\s*\d/.test(String(big.reason || '')),
    '实验台被头衔挡住时，理由里不得出现「头衔 + 数字」', big ? String(big.reason) : '');
  s.ok(Boolean(big) && String(big.reason || '').includes(big.rankGateTitle),
    '实验台被头衔挡住时，理由要写明具体头衔名', big ? String(big.reason) : '');
  const locked = sp.lockedRooms || [];
  s.ok(locked.length > 0 && locked.every((r) => typeof r.rankGateTitle === 'string' && r.rankGateTitle.length > 0),
    '后续房间列表也带头衔名（不再显示「头衔 3」）', locked.map((r) => r.rankGateTitle).join('、'));
  // 房间：把头衔压到最低，下一间 A302（rankGate 1）就买不起
  const g0 = freshGame(mods, 'lab-rank-title-0');
  g0.player.rankIndex = 0;
  const sp0 = selectLabSpace(g0);
  s.ok(Boolean(sp0.nextRoom) && String(sp0.nextRoom.reason || '').includes(sp0.nextRoom.rankGateTitle),
    '申请下一间实验室被头衔挡住时，理由要写明头衔名', sp0.nextRoom ? String(sp0.nextRoom.reason) : '无');
  s.ok(Boolean(sp0.nextRoom) && !/头衔\s*\d/.test(String(sp0.nextRoom.reason || '')),
    '申请实验室的理由里不得出现「头衔 + 数字」', sp0.nextRoom ? String(sp0.nextRoom.reason) : '');
  // 引擎侧同样说人话，且告诉玩家自己现在是什么头衔
  const denied = reduce(g, ACTIONS.buyBench({ type: 'bench_big' }));
  s.ok(!/头衔\s*\d/.test(String(denied.ui.toast || '')),
    '引擎拒绝买大型台时也不得出现「头衔 + 数字」', String(denied.ui.toast));
  s.ok(String(denied.ui.toast || '').includes(big.rankGateTitle) && String(denied.ui.toast || '').includes('副研究员'),
    '引擎拒绝时要写明「需要哪个头衔」和「你现在是什么头衔」', String(denied.ui.toast));
}

/* ── 10 加成不封顶（v1.3 用户反馈：仪器加成不应该封顶，堆仪器要让玩家舒服） ── */
{
  let st = freshGame(mods, 'lab-bonus-cap');
  st.player.money = 5000;
  st.player.rankIndex = 4;                       // 教授：所有仪器都过得了头衔门槛
  for (const d of INSTRUMENTS) {
    let guard = 0;
    while ((st.lab.equipment[d.id] || 0) < 1 && guard < 6) {
      guard += 1;
      if (!findSpot(st.lab, d.id)) st = reduce(st, ACTIONS.buyBench({ type: 'bench_std' }));
      const before = st.lab.equipment[d.id] || 0;
      st = reduce(st, ACTIONS.buyInstrument({ id: d.id }));
      if ((st.lab.equipment[d.id] || 0) === before) break;
    }
  }
  // 未截断总和：按 src/data 的 bonus × 台面台数独立算一遍（断言用实际计算值，不写死数字）
  const rawSum = INSTRUMENTS.reduce((sum, d) => sum + d.bonus * (st.lab.equipment[d.id] || 0), 0);
  const expectPct = Math.round(rawSum * 100);
  const lab = selectLab(st);
  s.eq(lab.bonusPct, expectPct, '12 种各一台：bonusPct = 未截断总和 ' + expectPct + '%');
  s.ok(rawSum > 0.90, '这 12 台的裸加成确实超过旧上限 0.90（实际 ' + rawSum.toFixed(4) + '）');
  s.ok(lab.bonusPct > 90, '实际加成超过旧上限 90%（' + lab.bonusPct + '%）→ 不再截断');
  s.eq(lab.bonusCapPct, undefined, 'v1.3 已删除 bonusCapPct 字段');
  s.eq(lab.bonusCapped, undefined, 'v1.3 已删除 bonusCapped 字段（不存在「已封顶」）');
  s.eq(lab.bonusRawPct, lab.bonusPct, 'bonusRawPct 与 bonusPct 同值');
  // 再添一台（改派生计数，等价于「又买到并摆上一台」；不依赖还有没有空台位）：加成必须继续变大
  const st2 = { ...st, lab: { ...st.lab, equipment: { ...st.lab.equipment, bath: (st.lab.equipment.bath || 0) + 1 } } };
  const lab2 = selectLab(st2);
  s.ok(lab2.bonusPct > lab.bonusPct, '再添一台，加成【继续变大】（' + lab.bonusPct + '% → ' + lab2.bonusPct + '%）');
  s.near(equipmentBonus(st2.lab) - equipmentBonus(st.lab), 0.06, 0.0001, '增量 = 水浴锅单台加成（不再被上限吃掉）');
  // 实际读数（给交付报告用）
  s.note('加成实测：12 种各一台 = ' + lab.bonusPct + '%；再加一台水浴锅 = ' + lab2.bonusPct + '%');
}

/* ── 11 仓库（v1.3 / LAB-SPACE §11）：不提供加成、不收维护费，可取出/卖出 ── */
{
  const benchesOf = (st) => st.lab.rooms.flatMap((r) => r.slots).filter(Boolean);
  const firstItem = (st) => { const b = benchesOf(st).find((x) => x.items.length > 0); return b.items[0]; };
  const itemsOf = (st) => benchesOf(st).flatMap((b) => b.items);

  // ① 存入仓库：台面计数与 equipmentBonus 下降，维护费同步下降，钱不变
  let g = rich('lab-storage');
  const target = firstItem(g);
  const money0 = g.player.money;
  const count0 = countEquipment(g.lab)[target.inst] || 0;
  const bonus0 = equipmentBonus(g.lab);
  const maint0 = maintenanceTotal(g.lab);
  const stored = reduce(g, ACTIONS.storeItem({ itemUid: target.uid }));
  s.eq(stored.lab.storage.length, 1, '存入仓库：仓库多一台');
  s.eq(countEquipment(stored.lab)[target.inst] || 0, count0 - 1, '存入仓库：台面计数 -1');
  s.eq(stored.lab.equipment[target.inst] || 0, count0 - 1, '存入仓库：lab.equipment 派生计数同步下降');
  s.ok(equipmentBonus(stored.lab) < bonus0, '存入仓库：加成下降（' + bonus0 + ' → ' + equipmentBonus(stored.lab) + '）');
  s.ok(maintenanceTotal(stored.lab) < maint0, '存入仓库：维护费同步下降（仓库不收维护费）');
  s.eq(stored.player.money, money0, '存入仓库：钱不变（这不是卖出）');
  s.eq(stored.lab.storage[0].uid, target.uid, '仓库沿用仪器原 uid（走既有 lab.nextUid 计数）');
  s.eq(selectLab(stored).storage.length, 1, 'viewmodel 暴露仓库列表');

  // 拒绝路径：不在台面上的仪器
  const rejected = reduce(stored, ACTIONS.storeItem({ itemUid: 'i_no_such' }));
  s.eq(rejected.lab.storage.length, 1, '存入不在台面的仪器：被拒，仓库不变');
  s.eq(rejected.player.money, stored.player.money, '存入被拒：不扣钱');
  s.ok(Boolean(rejected.ui.toast), '存入被拒：给中文提示', String(rejected.ui.toast));

  // ② 取出放回：恢复原值
  const back = reduce(stored, ACTIONS.deployItem({ storageUid: target.uid }));
  s.eq(back.lab.storage.length, 0, '取出：仓库清空');
  s.eq(countEquipment(back.lab)[target.inst] || 0, count0, '取出放回：台面计数恢复');
  s.eq(equipmentBonus(back.lab), bonus0, '取出放回：加成恢复原值');
  s.eq(maintenanceTotal(back.lab), maint0, '取出放回：维护费恢复原值');
  s.eq(back.player.money, stored.player.money, '取出不花钱');
  s.eq(itemsOf(back).filter((it) => it.uid === target.uid).length, 1, '取出后台面上恰好一台该 uid（没有复制）');

  // 取出被拒（仓库里没有）：状态不变
  const noDeploy = reduce(back, ACTIONS.deployItem({ storageUid: target.uid }));
  s.eq(noDeploy.lab.storage.length, 0, '取出不存在的仓库条目：被拒');
  s.ok(Boolean(noDeploy.ui.toast), '取出不存在的仓库条目：给提示', String(noDeploy.ui.toast));

  // 存档往返：仓库内容保留
  const rt = hydrate(JSON.parse(JSON.stringify(serialize(stored))));
  s.eq(rt.lab.storage, stored.lab.storage, '存档往返保留仓库内容');
  s.eq(rt.lab.rooms, stored.lab.rooms, '存档往返保留摆放');

  // ③ 从仓库卖出：退款 = 价格 × SELL_REFUND_RATE（与台面同口径）
  let g2 = rich('lab-storage-sell');
  const t2 = firstItem(g2);
  g2 = reduce(g2, ACTIONS.storeItem({ itemUid: t2.uid }));
  const money2 = g2.player.money;
  const sold = reduce(g2, ACTIONS.sellStored({ storageUid: t2.uid }));
  const expectRefund = Math.round(instrumentPrice(t2.inst) * SELL_REFUND_RATE * 100) / 100;
  s.eq(sold.lab.storage.length, 0, '仓库卖出：条目移除');
  s.near(sold.player.money - money2, expectRefund, 0.001, '仓库卖出退款 = 价格 × SELL_REFUND_RATE（' + expectRefund + ' 万）');
  const sold0 = reduce(sold, ACTIONS.sellStored({ storageUid: t2.uid }));
  s.eq(sold0.player.money, sold.player.money, '卖仓库里没有的仪器：不退款');
  s.ok(Boolean(sold0.ui.toast), '卖不存在的仓库条目：给提示', String(sold0.ui.toast));

  // ④ 没有 storage 字段的旧档：hydrate 不报错且 storage = []
  const legacy = freshGame(mods, 'lab-storage-legacy');
  delete legacy.lab.storage;
  const hydrated = hydrate({ version: STATE_VERSION, savedAt: 1, state: legacy });
  s.ok(hydrated !== null, '没有 storage 字段的旧档：hydrate 不报错');
  s.eq(hydrated.lab.storage, [], '没有 storage 字段的旧档：storage 安全默认成 []');
  s.eq(countEquipment(hydrated.lab), countEquipment(legacy.lab), '旧档补齐 storage 后台面计数不变');
  // 脏仓库条目（未知仪器 / 缺 inst / null）一律丢弃，合法条目保留
  const dirty = freshGame(mods, 'lab-storage-dirty');
  dirty.lab.storage = [{ uid: 'i997', inst: 'bath' }, { uid: 'i998', inst: 'nope' }, { uid: 'i999' }, null];
  const cleaned = hydrate({ version: STATE_VERSION, savedAt: 1, state: dirty });
  s.eq(cleaned.lab.storage.map((x) => x.uid), ['i997'], '脏仓库条目被丢弃，合法条目保留');
}

s.finish();

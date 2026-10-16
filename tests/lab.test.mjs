/**
 * tests/lab.test.mjs —— 1.1 实验室空间（docs/LAB-SPACE.md）
 *
 * 断言三件事：
 *   ① 摆放校验：fits 的越界 / 碰撞 / 旋转 / 移动时忽略自身；引擎动作拒绝非法坐标且不扣钱；
 *   ② 存档迁移 v2 → v3：只有 equipment 计数的旧档按 FFD 自动摆放，计数逐项不变；
 *   ③ 加成不变：科研加成/维护费只看已摆放仪器的派生计数，与 1.0 公式同值。
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
import { ROOMS, BENCH_MAP, ROOM_MAX } from '../src/data/lab.js';

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

s.finish();

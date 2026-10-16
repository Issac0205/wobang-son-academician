/**
 * core/lab.js —— 1.1 实验室空间（docs/LAB-SPACE.md §8/§9）纯函数
 *
 * 结构：lab.rooms[i] = { id, slots: [bench|null × ROOM_SLOTS] }
 *       bench = { uid, type, items: [{ uid, inst, x, y, rot }] }   rot=true 时占 h×w
 *       lab.nextUid：台子/仪器共用的流水号
 *       lab.equipment：派生计数（recountEquipment 重算），formulas/rules/bots 照用。
 */

import { INSTRUMENTS, INSTRUMENT_MAP } from '../data/instruments.js';
import { ROOMS, ROOM_SLOTS, ROOM_MAX, BENCH_MAP, START_BENCHES, BIG_BENCH_ITEM_CELLS, BIG_BENCH_DEMAND_CELLS } from '../data/lab.js';

/** 仪器在给定朝向下的占格。 */
export function footprint(instId, rot) {
  const def = INSTRUMENT_MAP[instId];
  if (!def) return null;
  return rot ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export function instrumentCells(instId) {
  const def = INSTRUMENT_MAP[instId];
  return def ? def.w * def.h : 0;
}

/** 不越界 && 不与台上其他仪器重叠（ignoreUid = 正在挪动的那台自己）。 */
export function fits(bench, w, h, x, y, ignoreUid) {
  const size = bench && BENCH_MAP[bench.type];
  if (!size) return false;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h)) return false;
  if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > size.w || y + h > size.h) return false;
  for (const it of bench.items || []) {
    if (ignoreUid && it.uid === ignoreUid) continue;
    const fp = footprint(it.inst, it.rot);
    if (!fp) continue;
    if (x < it.x + fp.w && it.x < x + w && y < it.y + fp.h && it.y < y + h) return false;
  }
  return true;
}

/** 在一张台子上按 (y, x) 扫描找第一个可放位置：先试不旋转，再试旋转。 */
export function findSpotOnBench(bench, instId, ignoreUid) {
  const size = bench && BENCH_MAP[bench.type];
  const def = INSTRUMENT_MAP[instId];
  if (!size || !def) return null;
  const tries = def.w === def.h ? [false] : [false, true];
  for (const rot of tries) {
    const fp = footprint(instId, rot);
    for (let y = 0; y + fp.h <= size.h; y += 1) {
      for (let x = 0; x + fp.w <= size.w; x += 1) {
        if (fits(bench, fp.w, fp.h, x, y, ignoreUid)) return { x, y, rot };
      }
    }
  }
  return null;
}

/** 所有台子（按房间、台位顺序），附带所在位置。 */
export function allBenches(lab) {
  const out = [];
  (lab.rooms || []).forEach((room, roomIdx) => {
    (room.slots || []).forEach((bench, slot) => { if (bench) out.push({ bench, room, roomIdx, slot }); });
  });
  return out;
}

export function findBench(lab, benchUid) {
  return allBenches(lab).find((b) => b.bench.uid === benchUid) || null;
}

export function findItem(lab, itemUid) {
  for (const loc of allBenches(lab)) {
    const item = loc.bench.items.find((it) => it.uid === itemUid);
    if (item) return { ...loc, item };
  }
  return null;
}

/** 全实验室第一个能放下该仪器的位置；没有返回 null。 */
export function findSpot(lab, instId) {
  for (const loc of allBenches(lab)) {
    const spot = findSpotOnBench(loc.bench, instId);
    if (spot) return { benchUid: loc.bench.uid, ...spot };
  }
  return null;
}

/** 第一个空台位（已购房间内）。 */
export function findEmptySlot(lab) {
  const rooms = lab.rooms || [];
  for (let r = 0; r < rooms.length; r += 1) {
    const slots = rooms[r].slots || [];
    for (let s = 0; s < slots.length; s += 1) if (!slots[s]) return { roomIdx: r, slot: s };
  }
  return null;
}

/** 由摆放重算按种类计数（= 1.0 的 lab.equipment）。 */
export function countEquipment(lab) {
  const counts = Object.fromEntries(INSTRUMENTS.map((it) => [it.id, 0]));
  for (const { bench } of allBenches(lab)) {
    for (const it of bench.items || []) if (counts[it.inst] !== undefined) counts[it.inst] += 1;
  }
  return counts;
}

export function recountEquipment(lab) {
  lab.equipment = countEquipment(lab);
  return lab;
}

export function newRoom(index) {
  const def = ROOMS[index];
  return { id: def ? def.id : 'R' + (index + 1), slots: Array.from({ length: ROOM_SLOTS }, () => null) };
}

/** 空间汇总（UI/机器人用）。 */
export function spaceSummary(lab) {
  let cells = 0;
  let used = 0;
  for (const { bench } of allBenches(lab)) {
    const size = BENCH_MAP[bench.type];
    cells += size.w * size.h;
    for (const it of bench.items) used += instrumentCells(it.inst);
  }
  const slotsTotal = (lab.rooms || []).length * ROOM_SLOTS;
  const benches = allBenches(lab).length;
  return { rooms: (lab.rooms || []).length, roomMax: ROOM_MAX, slotsTotal, slotsFree: slotsTotal - benches, benches, cells, used, free: cells - used };
}

/**
 * First-Fit Decreasing 自动摆放（LAB-SPACE §9）：把计数展开成仪器列表，按格数降序
 * （同格数按 INSTRUMENTS 顺序）逐台找位；放不下就在下一个空台位**免费**建台，
 * 台位满就**免费**开下一间（最多 ROOM_MAX 间）。用于新开局与 v2→v3 迁移。
 * @param {Record<string, number>} counts
 * @param {{startBenches?: string[]}} [opts]
 * @returns {{rooms:any[], nextUid:number} | null} 放不下（超过 4 间）返回 null
 */
export function layoutFromCounts(counts, opts = {}) {
  const lab = { rooms: [newRoom(0)], nextUid: 1 };
  const addBench = (type) => {
    let spot = findEmptySlot(lab);
    if (!spot) {
      if (lab.rooms.length >= ROOM_MAX) return null;
      lab.rooms.push(newRoom(lab.rooms.length));
      spot = findEmptySlot(lab);
    }
    const bench = { uid: 'b' + lab.nextUid, type, items: [] };
    lab.nextUid += 1;
    lab.rooms[spot.roomIdx].slots[spot.slot] = bench;
    return bench;
  };
  for (const type of opts.startBenches || []) if (BENCH_MAP[type]) addBench(type);
  const order = INSTRUMENTS.map((d, i) => ({ id: d.id, i, cells: d.w * d.h }))
    .sort((a, b) => (b.cells - a.cells) || (a.i - b.i));
  const queue = [];
  for (const o of order) {
    const n = Math.max(0, Math.floor(Number(counts && counts[o.id]) || 0));
    for (let k = 0; k < n; k += 1) queue.push(o.id);
  }
  let demand = queue.reduce((sum, id) => sum + instrumentCells(id), 0);
  for (const instId of queue) {
    let placed = findSpot(lab, instId);
    if (!placed) {
      const cells = instrumentCells(instId);
      const type = cells >= BIG_BENCH_ITEM_CELLS || demand >= BIG_BENCH_DEMAND_CELLS ? 'bench_big' : 'bench_std';
      const bench = addBench(type);
      if (!bench) return null;
      const spot = findSpotOnBench(bench, instId);
      if (!spot) return null;
      placed = { benchUid: bench.uid, ...spot };
    }
    const loc = findBench(lab, placed.benchUid);
    loc.bench.items.push({ uid: 'i' + lab.nextUid, inst: instId, x: placed.x, y: placed.y, rot: placed.rot });
    lab.nextUid += 1;
    demand -= instrumentCells(instId);
  }
  return lab;
}

/** 新开局布局：A301 + START_BENCHES，摆入 initCount。 */
export function startingLayout() {
  return layoutFromCounts(Object.fromEntries(INSTRUMENTS.map((it) => [it.id, it.initCount])), { startBenches: START_BENCHES });
}

/**
 * 存档里的 rooms 逐项校验：未知台型/仪器、越界、重叠的一律丢弃。返回 null 表示结构不可用。
 */
export function sanitizeRooms(rawRooms) {
  if (!Array.isArray(rawRooms) || rawRooms.length === 0) return null;
  const rooms = [];
  let maxUid = 0;
  const seen = new Set();
  const uidNum = (uid) => { const n = Number(String(uid).slice(1)); return Number.isFinite(n) ? n : 0; };
  rawRooms.slice(0, ROOM_MAX).forEach((raw, idx) => {
    const room = newRoom(idx);
    const slots = raw && Array.isArray(raw.slots) ? raw.slots : [];
    for (let s = 0; s < ROOM_SLOTS; s += 1) {
      const b = slots[s];
      if (!b || typeof b !== 'object' || !BENCH_MAP[b.type] || typeof b.uid !== 'string' || seen.has(b.uid)) continue;
      seen.add(b.uid);
      maxUid = Math.max(maxUid, uidNum(b.uid));
      const bench = { uid: b.uid, type: b.type, items: [] };
      for (const it of Array.isArray(b.items) ? b.items : []) {
        if (!it || typeof it.uid !== 'string' || seen.has(it.uid) || !INSTRUMENT_MAP[it.inst]) continue;
        const rot = Boolean(it.rot);
        const fp = footprint(it.inst, rot);
        const x = Number(it.x);
        const y = Number(it.y);
        if (!fits(bench, fp.w, fp.h, x, y)) continue;
        seen.add(it.uid);
        maxUid = Math.max(maxUid, uidNum(it.uid));
        bench.items.push({ uid: it.uid, inst: it.inst, x, y, rot });
      }
      room.slots[s] = bench;
    }
    rooms.push(room);
  });
  return { rooms, nextUid: maxUid + 1 };
}

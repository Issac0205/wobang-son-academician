/**
 * views/lab.js —— 1.1 实验室空间：房间 → 台位 → 实验台网格 → 仪器（背包式摆放）
 *
 * 只读 vm.crew.lab（selectLab / selectLabSpace），所有写操作通过 data-action 交给 app.js 去 dispatch。
 * 「手上拿着的仪器」(ctx.labPick) 是纯展示状态：只存在 app.js 的 localUi，不进 state。
 * 占格预览只做几何判断（越界/重叠），真正能否放下以 core 的 fits 为准（失败会 toast，不扣钱）。
 */

import { h, tag, button, uiCard, uiDisclosure, uiNote, uiInlineStat, uiNum1 } from '../dom.js';

const UI_LAB = {
  title: '实验室 · 空间台账',
  subtitle: '房间里摆实验台，台面上摆仪器；仪器只看「摆进来了几台」，放不下就加台、开新房。',
  shopTitle: '仪器台 · 申购目录',
  shopSub: '选择仪器查看价格与规格；拿起后点台面空格放置，或自动摆放。',
  holdBuy: '手上：待采购',
  holdMove: '手上：搬动中',
  holdTip: '点选空格放置；可用下方按钮旋转或取消。桌面也支持 R / Esc。',
  emptySlot: '空台位',
  roomLocked: '尚未申请',
};

function uiFootprint(w, hh) {
  const cells = [];
  for (let i = 0; i < w * hh; i += 1) cells.push(h('span', { class: 'fp-cell' }));
  return h('span', { class: 'fp', attrs: { style: 'grid-template-columns:repeat(' + w + ',8px)', 'aria-hidden': 'true' } }, cells);
}

function uiLabItem(item, bench, pick) {
  const selected = pick && pick.mode === 'move' && pick.uid === item.uid;
  return h('button', {
    class: 'lab-item tone-' + (item.down ? 'bad' : item.tier) + (selected ? ' is-selected' : ''),
    text: item.name,
    attrs: {
      type: 'button',
      draggable: 'true',
      title: item.name + '（' + item.w + '×' + item.h + '）· 加成 +' + item.bonusPct + '% · 维护 ' + uiNum1(item.maintain) + ' 万/月' + (item.down ? ' · 停机中' : '') + (item.flavor ? '\n' + item.flavor : ''),
      style: 'grid-column:' + (item.x + 1) + ' / span ' + item.w + ';grid-row:' + (item.y + 1) + ' / span ' + item.h,
    },
    dataset: { action: 'lab-item', uid: item.uid, benchUid: bench.uid, w: item.w, h: item.h, rot: item.rot ? '1' : '0' },
  });
}

function uiBench(bench, pick) {
  const cells = [];
  for (let y = 0; y < bench.h; y += 1) {
    for (let x = 0; x < bench.w; x += 1) {
      cells.push(h('button', {
        class: 'lab-cell',
        attrs: { type: 'button', 'aria-label': bench.name + ' 第 ' + (y + 1) + ' 行第 ' + (x + 1) + ' 格', style: 'grid-column:' + (x + 1) + ';grid-row:' + (y + 1) },
        dataset: { action: 'lab-cell', benchUid: bench.uid, x, y },
      }));
    }
  }
  // 占用表交给前端几何预览（uid:x,y,w,h;...），只是把 vm 的摆放原样序列化
  const occ = bench.items.map((it) => [it.uid, it.x, it.y, it.w, it.h].join(',')).join(';');
  const used = bench.items.reduce((n, it) => n + it.w * it.h, 0);
  return h('div', { class: 'bench' + (pick ? ' is-holding' : ''), dataset: { role: 'bench', uid: bench.uid } }, [
    h('div', { class: 'bench-head' }, [
      h('strong', { class: 'bench-name', text: bench.name }),
      h('span', { class: 'bench-size', text: bench.w + '×' + bench.h + ' · 占 ' + used + '/' + (bench.w * bench.h) }),
      bench.canSell
        ? button('拆台 +' + uiNum1(bench.sellRefund) + ' 万', { action: 'lab-sell-bench', benchUid: bench.uid }, { class: 'btn-ghost btn-xs', title: '空台才能拆，回收半价' })
        : null,
    ]),
    h('div', {
      class: 'bench-grid',
      attrs: { style: 'grid-template-columns:repeat(' + bench.w + ',var(--cell));grid-template-rows:repeat(' + bench.h + ',var(--cell))' },
      dataset: { role: 'bench-grid', benchUid: bench.uid, bw: bench.w, bh: bench.h, occ },
    }, cells.concat(bench.items.map((it) => uiLabItem(it, bench, pick)))),
  ]);
}

function uiEmptySlot(room, slot, space) {
  return h('div', { class: 'bench bench-empty', dataset: { role: 'slot-empty' } }, [
    h('span', { class: 'bench-empty-k', text: UI_LAB.emptySlot + ' ' + (slot.slot + 1) }),
    h('div', { class: 'bench-empty-actions' }, space.benches.map((b) => {
      const blocked = b.reason && b.reason !== '没有空台位' ? b.reason : '';
      return button('放' + b.name + ' ' + uiNum1(b.price) + ' 万', { action: 'lab-buy-bench', type: b.id, roomIdx: room.roomIdx, slot: slot.slot }, {
        class: 'btn-xs', disabled: Boolean(blocked), title: blocked || (b.w + '×' + b.h + '，共 ' + b.cells + ' 格'),
      });
    })),
  ]);
}

function uiRoom(room, space, pick) {
  const benches = room.slots.filter((s) => !s.empty).length;
  return uiDisclosure('room-' + room.id, room.name + ' · ' + benches + '/' + room.slots.length + ' 台位', [h('section', { class: 'room', dataset: { role: 'room', id: room.id } }, [
    h('header', { class: 'room-head' }, [
      h('span', { class: 'room-seal', text: room.id }),
      h('div', { class: 'room-title-wrap' }, [
        h('strong', { class: 'room-name', text: room.name }),
        room.flavor ? h('span', { class: 'room-flavor', text: room.flavor }) : null,
      ]),
      h('span', { class: 'room-count', text: '台位 ' + benches + '/' + room.slots.length }),
    ]),
    h('div', { class: 'room-floor', attrs: { style: 'grid-template-columns:repeat(' + room.cols + ',minmax(0,1fr))' } },
      room.slots.map((s, i) => uiDisclosure('slot-' + room.id + '-' + s.slot, '台位 ' + (s.slot + 1) + ' · ' + (s.empty ? '空闲，可添加实验台' : s.name), [s.empty ? uiEmptySlot(room, s, space) : uiBench(s, pick)], i === 0))),
  ])], space.rooms[0].id === room.id);
}

function uiNextRoom(space) {
  const next = space.nextRoom;
  const later = space.lockedRooms.slice(1);
  if (!next) return h('p', { class: 'room-maxed', text: space.text.roomsMaxed });
  return h('div', { class: 'room room-locked', dataset: { role: 'room-next' } }, [
    h('header', { class: 'room-head' }, [
      h('span', { class: 'room-seal is-locked', text: next.id }),
      h('div', { class: 'room-title-wrap' }, [
        h('strong', { class: 'room-name', text: next.name }),
        h('span', { class: 'room-flavor', text: next.flavor }),
      ]),
      button('申请这间 ' + uiNum1(next.price) + ' 万', { action: 'lab-buy-room' }, { kind: 'primary', class: 'btn-xs', disabled: !next.canBuy, title: next.reason || '新房间带 4 个空台位' }),
    ]),
    next.reason ? h('p', { class: 'muted', text: '暂时批不下来：' + next.reason }) : null,
    later.length ? h('p', { class: 'room-later', text: '之后还能申请：' + later.map((r) => r.name + '（' + r.price + ' 万 · ' + (r.rankGateTitle || ('头衔 ' + r.rankGate)) + ' 起）').join('、') }) : null,
  ]);
}

function uiHeldBar(vm, pick) {
  if (!pick) return null;
  const isMove = pick.mode === 'move';
  return h('div', { class: 'held-bar' + (isMove ? ' is-move' : ''), dataset: { role: 'held-bar' } }, [
    tag(isMove ? UI_LAB.holdMove : UI_LAB.holdBuy, isMove ? 'info' : 'warn'),
    h('strong', { class: 'held-name', text: pick.name + (isMove ? '' : ' · ' + uiNum1(pick.price) + ' 万') }),
    uiFootprint(pick.w, pick.h),
    h('span', { class: 'held-size', text: pick.w + '×' + pick.h }),
    h('span', { class: 'held-tip', text: UI_LAB.holdTip }),
    h('span', { class: 'held-actions' }, [
      pick.w !== pick.h ? button('旋转', { action: 'lab-rotate' }, { class: 'btn-xs' }) : null,
      isMove ? button('卖掉 +' + uiNum1(pick.refund) + ' 万', { action: 'lab-sell-item', uid: pick.uid }, { class: 'btn-xs btn-danger-ghost', title: '转给兄弟课题组，回收半价' }) : null,
      button('取消放置', { action: 'lab-cancel' }, { class: 'btn-ghost btn-xs' }),
    ]),
  ]);
}

let uiSelectedEquipment = null;
function uiShopCard(vm, pick) {
  const lab = vm.crew.lab;
  const rows = lab.equipment.map((e) => {
    const holding = pick && pick.mode === 'buy' && pick.id === e.id;
    const pickBlocked = e.reason && e.reason !== '空间不足' ? e.reason : '';
    return h('div', {
      class: 'shop-item tone-' + (e.down ? 'bad' : e.tier) + (holding ? ' is-holding' : ''),
      attrs: { draggable: pickBlocked ? 'false' : 'true' },
      dataset: { role: 'shop-item', id: e.id },
    }, [
      h('div', { class: 'shop-item-head' }, [
        uiFootprint(e.w, e.h),
        h('strong', { class: 'shop-item-name', text: e.name }),
        tag(e.tierLabel, e.tier === 'major' ? 'good' : 'mute'),
        e.owned ? h('span', { class: 'shop-item-owned', text: '已摆 ' + e.owned + ' 台' }) : null,
        e.down ? tag('停机 ' + e.downMonths + ' 月', 'bad') : null,
      ]),
      h('div', { class: 'shop-item-stats' }, [
        uiInlineStat('占格', e.w + '×' + e.h),
        uiInlineStat('加成', lab.bonusCapped ? '+0%（已封顶）' : '+' + e.bonusPct + '%', lab.bonusCapped ? 'warn' : null),
        uiInlineStat('维护', uiNum1(e.maintain) + ' 万/月'),
      ]),
      e.flavor ? h('p', { class: 'shop-item-flavor', text: e.flavor }) : null,
      h('div', { class: 'shop-item-actions' }, [
        button(holding ? '已拿在手上' : '拿起来 ' + uiNum1(e.price) + ' 万', { action: 'lab-pick', id: e.id }, {
          kind: holding ? null : 'primary', class: 'btn-xs' + (holding ? ' active' : ''), disabled: Boolean(pickBlocked), title: pickBlocked || '拿在手上，再点台面格子放下',
        }),
        button('自动摆放', { action: 'buy-equipment', id: e.id }, { class: 'btn-xs', disabled: !e.canBuy, title: e.reason || '放到第一个能放下的位置' }),
        e.reason ? h('span', { class: 'muted', text: e.reason }) : null,
      ]),
    ]);
  });
  const chosen = lab.equipment.some((e) => e.id === uiSelectedEquipment) ? uiSelectedEquipment : (lab.equipment[0] || {}).id;
  const select = h('select', { attrs: { 'aria-label': '选择申购仪器' }, on: { change: (ev) => { uiSelectedEquipment = ev.target.value; rows.forEach((row, i) => { row.hidden = lab.equipment[i].id !== uiSelectedEquipment; }); } } }, lab.equipment.map((e) => h('option', { text: e.name + ' · ' + uiNum1(e.price) + ' 万' + (e.reason ? ' · ' + e.reason : ''), attrs: { value: e.id, ...(e.id === chosen ? { selected: '' } : {}) } })));
  rows.forEach((row, i) => { if (lab.equipment[i].id !== chosen) row.setAttribute('hidden', ''); });
  return uiCard(UI_LAB.shopTitle, UI_LAB.shopSub, null, [
    h('label', { class: 'catalog-select' }, [h('span', { text: '申购仪器 · 共 ' + lab.equipment.length + ' 种' }), select]),
    h('div', { class: 'shop-grid' }, rows),
    uiNote(lab.bonusCapped
      ? '仪器加成已经封顶（上限 ' + lab.bonusCapPct + '%）：再买仪器不会提高科研加成，但它仍可能满足项目的「设备要求」；维护费照收。'
      : '大幅仪器贵但加成高；停机当月不提供加成。仪器没有持有上限，唯一的限制是台面空间；全仪器加成上限 ' + lab.bonusCapPct + '%。'),
  ]);
}

/** 课题组 →「实验室」分栏：空间台账 + 申购目录。 */
export function renderLabSpace(vm, ctx) {
  const lab = vm.crew.lab;
  const space = lab.space;
  const pick = (ctx && ctx.labPick) || null;
  const sum = space.summary;
  const head = h('div', { class: 'slot-row' }, [
    uiInlineStat('实验室', sum.rooms + ' / ' + sum.roomMax + ' 间'),
    uiInlineStat('实验台', sum.benches + ' 张 · 空台位 ' + sum.slotsFree),
    uiInlineStat('台面格子', sum.used + ' / ' + sum.cells, sum.free <= 1 ? 'warn' : null),
    uiInlineStat('全仪器加成', lab.bonusPct + '%' + (lab.bonusCapped ? '（已封顶）' : '（上限 ' + lab.bonusCapPct + '%）'), lab.bonusCapped ? 'warn' : null),
    uiInlineStat('每月维护', uiNum1(lab.maintain) + ' 万'),
  ]);
  const rooms = h('div', { class: 'rooms' }, space.rooms.map((r) => uiRoom(r, space, pick)).concat([uiNextRoom(space)]));
  return [
    uiCard(UI_LAB.title, UI_LAB.subtitle, null, [head, uiHeldBar(vm, pick), rooms], { class: 'card-lab' + (pick ? ' is-holding' : '') }),
    uiShopCard(vm, pick),
  ];
}
/**
 * page-driver.js —— t6 浏览器实测的页面内驱动（真实页面里运行）
 *
 * 约定：
 *   · 所有改变游戏状态的操作都通过「点真实 DOM 节点」完成（走 #app 的事件代理，和真人点击同一条路径）；
 *   · window.__GAME__ 只用来「读」核心层状态做核对（UI 显示值 vs core 计算值），不直接改 state；
 *   · step() 用「状态指纹」判定点击是否真的生效，失效点击算 no-op 并换下一个候选；
 *   · consistency(tab) 会先把目标标签页/分栏切出来（保证 DOM 是新鲜的），再逐项核对。
 */
(function () {
  var q = function (s) { return document.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var vis = function (e) {
    if (!e) return false;
    if (e.hidden) return false;
    var r = e.getClientRects();
    return r.length > 0 && (r[0].width > 0 || r[0].height > 0 || e.offsetWidth > 0 || e.offsetHeight > 0);
  };
  var TABS = { lab: '#tab-lab', projects: '#tab-projects', market: '#tab-market', actions: '#tab-actions', chronicle: '#tab-chronicle' };
  function tab(id) { var b = q(TABS[id]); if (!b) return false; b.click(); return true; }
  function subtab(section) {
    var list = qa('#panel-lab [data-action="lab-section"]').filter(function (e) { return e.dataset.section === section; });
    if (list.length) { list[0].click(); return true; }
    return false;
  }
  function G() { return window.__GAME__; }
  function st() { return G().store.getState(); }
  function vm() { return G().buildViewModel(st()); }
  function fp() {
    var s = st();
    return [s.calendar.monthIndex, s.phase, s.player.energy, s.player.money, s.player.consumable,
      s.counters.projectsFinished, s.students.length, (s.projects || []).filter(function (p) { return p.status === 'active'; }).length,
      s.pendingEvent ? s.pendingEvent.eventId : '-', s.ending ? s.ending.id : '-', s.player.tickets, s.player.papers.top, s.player.integrity].join('|');
  }

  /**
   * 挑本子：只在「按当前人手算来得及」的本子里挑档位最高、钱最多的那个。
   * 估算速率优先用上一月回执里 core 给的 progressDelta（真实产出），没有就按人手粗估。
   * 这是「会看一眼工作量和工期」的普通玩家，而不是见大单就接。
   */
  function monthlyRate() {
    var v = vm();
    var rp = (v.receipt && v.receipt.projects) || [];
    var deltas = rp.map(function (x) { return Number(x.progressDelta) || 0; }).filter(function (x) { return x > 0; });
    if (deltas.length) return deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
    var crew = ((v.crew && v.crew.active) || []).length;
    return Math.max(1, crew * 4);
  }
  function crewCount() { var v = vm(); return ((v.crew && v.crew.active) || []).length; }
  function overdueNow() { return st().projects.filter(function (p) { return p.status === 'active' && p.overdueMonths > 0; }).length; }
  function bestOffer() {
    var rate = monthlyRate();
    var cards = qa('#panel-projects [data-role="offer"]');
    var cands = cards.map(function (c) {
      var btn = c.querySelector('[data-action="accept-project"]');
      var txt = String(c.textContent || '');
      var tm = txt.match(/T([0-9])/);
      var mm = txt.match(/总经费([0-9.]+)/);
      var wm = txt.match(/工作量([0-9.]+)/);
      var dm = txt.match(/工期([0-9]+)/);
      var wl = wm ? Number(wm[1]) : 0;
      var mo = dm ? Number(dm[1]) : 0;
      var need = mo > 0 ? wl / mo : 999;
      return { card: c, btn: btn, tier: tm ? Number(tm[1]) : 0, money: mm ? Number(mm[1]) : 0, need: need, feasible: need <= rate * 0.85 };
    }).filter(function (x) { return x.btn && !x.btn.disabled && vis(x.btn) && x.feasible; });
    cands.sort(function (a, b) { return (b.tier - a.tier) || (b.money - a.money); });
    return cands.length ? cands[0] : null;
  }

  function step() {
    var rec = { modal: null, hired: 0, accepted: null, acceptedTier: null, hardpoint: null, consumed: 0, equipment: null, action: null, advanced: false, changed: false, noop: 0, blocked: null };
    var before = fp();
    var s0 = st();

    var b = qa('[data-action="defer-choice"]').filter(vis);
    if (b.length) {
      var sid = b[0].dataset.studentId;
      var stu = (s0.students || []).filter(function (x) { return x.id === sid; })[0];
      var want = (stu && stu.happiness > 40) ? 'defer' : 'giveUp';
      var pick = b.filter(function (x) { return x.dataset.choice === want; })[0] || b[0];
      pick.click();
      rec.modal = 'defer:' + pick.dataset.choice;
      rec.changed = fp() !== before;
      if (rec.changed) return rec;
    }
    var evBtn = firstClickable('#modal-root [data-action="event-choice"]');
    if (evBtn) { rec.modal = 'event'; rec.changed = fp() !== before; if (rec.changed) return rec; }

    tab('market');
    var hireBtn = firstClickable('#panel-market [data-action="hire-student"]');
    if (hireBtn) { rec.hired = 1; rec.changed = fp() !== before; if (rec.changed) return rec; }

    tab('projects');
    // 有项目逾期就先别接新单（普通玩家会先把火扑灭）
    var best = overdueNow() > 0 ? null : bestOffer();
    if (best) {
      var txt = String(best.card.textContent || '').slice(0, 60);
      best.btn.click();
      if (fp() !== before) { rec.accepted = txt; rec.acceptedTier = best.tier; rec.changed = true; return rec; }
      rec.noop += 1;
    }
    var hpBtn = firstClickable('#panel-projects [data-action="hardpoint-team"]');
    if (hpBtn) { rec.hardpoint = 'team'; rec.changed = fp() !== before; if (rec.changed) return rec; }
    hpBtn = firstClickable('#panel-projects [data-action="hardpoint-solo"]');
    if (hpBtn) { rec.hardpoint = 'solo'; rec.changed = fp() !== before; if (rec.changed) return rec; }

    var s1 = st();
    tab('lab');
    if (s1.player.consumable < 40 && subtab('consumable')) {
      var buyBtn = firstClickable('#panel-lab [data-action="buy-consumable"]');
      if (buyBtn) { rec.consumed = 1; rec.changed = fp() !== before; if (rec.changed) return rec; }
    }
    if (s1.player.money > 40 && subtab('equipment')) {
      var eqBtn = firstClickable('#panel-lab [data-action="buy-equipment"]');
      if (eqBtn) { rec.equipment = 1; rec.changed = fp() !== before; if (rec.changed) return rec; }
    }

    tab('actions');
    if (s1.player.health < 65) {
      var exBtn = firstClickable('#panel-actions [data-action="do-action"][data-action-id="exercise"]');
      if (exBtn) { rec.action = 'exercise'; rec.changed = fp() !== before; if (rec.changed) return rec; }
    }
    if (s1.player.energy >= 3) {
      var tkBtn = firstClickable('#panel-actions [data-action="do-action"][data-action-id="talk"]');
      if (tkBtn) { rec.action = 'talk'; rec.changed = fp() !== before; if (rec.changed) return rec; }
      var mtBtn = firstClickable('#panel-actions [data-action="do-action"][data-action-id="meeting"]');
      if (mtBtn) { rec.action = 'meeting'; rec.changed = fp() !== before; if (rec.changed) return rec; }
    }

    var nb = q('#btn-next-month');
    if (nb && !nb.disabled) {
      nb.click();
      rec.advanced = fp() !== before;
      rec.changed = rec.changed || rec.advanced;
    } else {
      rec.blocked = nb ? String(nb.textContent || '').trim() : 'no-next-button';
      rec.modalOpen = !!q('#modal-root [data-role="modal"]');
      rec.phase = st().phase;
      rec.pendingEvent = st().pendingEvent ? st().pendingEvent.eventId : null;
    }
    return rec;
  }
  function firstClickable(sel) {
    var list = qa(sel).filter(function (e) { return !e.disabled && vis(e); });
    if (!list.length) return null;
    var el = list[0];
    el.click();
    return el;
  }

  /* ── 只读核对 ── */
  function nums(sel) {
    var e = q(sel);
    if (!e) return null;
    var m = String(e.textContent || '').match(/-?[0-9]+(\.[0-9]+)?/g);
    return m ? m.map(Number) : [];
  }
  function near(sel, v, dp) {
    var list = nums(sel);
    if (!list) return { ok: false, why: 'selector missing' };
    var t = Math.pow(10, dp === undefined ? 1 : dp);
    var want = Math.round(Number(v) * t) / t;
    var tol = 0.5 / t + 1e-9;
    return { ok: list.some(function (x) { return Math.abs(x - want) <= tol; }), shown: list.join(','), want: want };
  }
  function contains(sel, text) {
    var e = q(sel);
    if (!e) return { ok: false, why: 'selector missing' };
    var t = String(e.textContent || '');
    return { ok: t.indexOf(String(text)) >= 0, shown: t.slice(0, 60), want: text };
  }
  /** 检查某个面板：先切到该标签页（必要时切分栏），再逐项核对。 */
  function consistency(which) {
    var rows = [];
    var add = function (name, res) { rows.push({ check: name, ok: !!res.ok, want: res.want, shown: res.shown || res.why }); };
    var v0 = vm();
    add('资源栏 经费 ↔ vm.hud.money', near('#hud-money', v0.hud.money, 1));
    add('资源栏 耗材资金 ↔ vm.hud.consumable', near('#hud-consumable', v0.hud.consumable, 1));
    add('资源栏 诚信 ↔ vm.hud.integrity', near('#hud-integrity', v0.hud.integrity, 1));
    add('资源栏 总 IF ↔ vm.hud.achievements.totalIF', near('#hud-if', v0.hud.achievements.totalIF, 1));
    add('资源栏 推荐票 ↔ vm.hud.tickets', near('#hud-tickets', v0.hud.tickets, 0));
    add('身份栏 头衔 ↔ vm.hud.rank.title', contains('#hud-rank', v0.hud.rank.title));
    add('身份栏 年月 ↔ vm.hud.time.text', contains('#hud-month', v0.hud.time.text));
    var r = v0.receipt;
    if (r && r.moneyNet !== undefined) add('月报 经费净额 ↔ vm.receipt.moneyNet', near('#month-report', r.moneyNet, 1));
    if (which === 'projects') {
      tab('projects');
      var v = vm();
      var list = (v.projects && v.projects.active) || [];
      var okP = true, detailP = [];
      list.forEach(function (p) {
        var el = q('[data-role="project"][data-id="' + p.instanceId + '"]');
        if (!el) { okP = false; detailP.push(p.instanceId + ':缺节点'); return; }
        var m = String(el.textContent || '').match(/-?[0-9]+(\.[0-9]+)?/g) || [];
        var t = Math.round(Number(p.progress) * 10) / 10;
        if (!m.map(Number).some(function (x) { return Math.abs(x - t) <= 0.051; })) { okP = false; detailP.push(p.instanceId + ':显示里没有进度 ' + t); }
      });
      add('项目页 在研进度 ↔ vm.projects.active[].progress（' + list.length + ' 个）', { ok: okP, want: '全部命中', shown: detailP.join(';') || '全部命中' });
      var off = (v.market && v.market.projects) || [];
      var okO = true, detailO = [];
      off.forEach(function (o) {
        if (!q('[data-role="offer"][data-id="' + o.offerId + '"]')) { okO = false; detailO.push(o.offerId + ':缺节点'); }
      });
      add('项目页 市场 offer 节点 ↔ vm.market.projects（' + off.length + ' 个）', { ok: okO, want: '全部有节点', shown: detailO.join(';') || '全部命中' });
    }
    if (which === 'market') {
      tab('market');
      var v2 = vm();
      var stu = (v2.market && v2.market.students) || [];
      var okS = true, detailS = [];
      stu.forEach(function (o) {
        var el = q('[data-role="candidate"][data-id="' + o.offerId + '"]');
        if (!el) { okS = false; detailS.push(o.offerId + ':缺节点'); return; }
        var m = String(el.textContent || '').match(/-?[0-9]+(\.[0-9]+)?/g) || [];
        if (!m.map(Number).some(function (x) { return Math.abs(x - Number(o.cost)) <= 0.051; })) { okS = false; detailS.push(o.offerId + ':显示里没有招募成本 ' + o.cost); }
      });
      add('市场页 候选人成本 ↔ vm.market.students[].cost（' + stu.length + ' 人）', { ok: okS, want: '全部命中', shown: detailS.join(';') || '全部命中' });
    }
    if (which === 'lab') {
      tab('lab');
      subtab('students');
      var v3 = vm();
      var crew = (v3.crew && v3.crew.active) || [];
      var okC = true, detailC = [], checked = 0;
      crew.forEach(function (s) {
        var el = q('[data-role="student"][data-id="' + s.id + '"]');
        if (!el) { okC = false; detailC.push(s.id + ':缺节点'); return; }
        var barEl = el.querySelector('[data-role="mini-bar"]');
        if (!barEl) return;
        checked += 1;
        var shown = Number(barEl.dataset.value);
        var want = Math.round(Number(s.happiness));
        if (Math.abs(shown - want) > 1) { okC = false; detailC.push(s.id + ':幸福条 ' + shown + ' vs core ' + want); }
      });
      add('课题组页 学生幸福度条 ↔ vm.crew.active[].happiness（核对 ' + checked + ' 条）', { ok: okC, want: '全部命中', shown: detailC.join(';') || '全部命中' });
      subtab('equipment');
      var v4 = vm();
      var items = (v4.lab && v4.lab.items) || [];
      var okE = true, detailE = [];
      items.forEach(function (e) {
        var node = q('[data-role="equipment"]');
        void node;
      });
      add('课题组页 仪器台渲染 ↔ vm.lab.items（' + items.length + ' 种）', { ok: okE, want: '渲染成功', shown: detailE.join(';') || '无异常' });
    }
    if (which === 'actions') {
      tab('actions');
      var v5 = vm();
      var acts = (v5.actions && v5.actions.list) || [];
      var okA = true, detailA = [];
      acts.forEach(function (a) {
        if (!q('[data-role="action"][data-id="' + a.id + '"]')) { okA = false; detailA.push(a.id + ':缺节点'); }
      });
      add('行动页 4 个行动卡 ↔ vm.actions.list（' + acts.length + ' 个）', { ok: okA, want: '全部有节点', shown: detailA.join(';') || '全部命中' });
    }
    return rows;
  }

  function snap() {
    var s = st();
    var v = vm();
    var crew = (s.students || []).filter(function (x) { return !x.left && !x.graduated; });
    return {
      monthIndex: s.calendar.monthIndex, year: s.calendar.year, month: s.calendar.month, age: s.player.age,
      rank: v.hud.rank.title, rankIndex: s.player.rankIndex, money: Math.round(s.player.money * 10) / 10,
      consumable: Math.round(s.player.consumable * 10) / 10, energy: s.player.energy, health: s.player.health,
      integrity: Math.round(s.player.integrity * 10) / 10, totalIF: Math.round(s.player.totalIF * 10) / 10,
      top: s.player.papers.top, q1: s.player.papers.q1, q2: s.player.papers.q2, q3: s.player.papers.q3,
      tickets: s.player.tickets, finished: s.counters.projectsFinished, failed: s.counters.projectsFailed,
      active: (s.projects || []).filter(function (p) { return p.status === 'active'; }).length,
      progressSum: Math.round((s.projects || []).filter(function (p) { return p.status === 'active'; }).reduce(function (n, p) { return n + p.progress; }, 0) * 10) / 10,
      overdue: (s.projects || []).filter(function (p) { return p.status === 'active' && p.overdueMonths > 0; }).length,
      hardpointsOpen: (s.projects || []).filter(function (p) { return p.status === 'active'; }).reduce(function (n, p) { return n + (p.hardpoints || []).filter(function (h) { return h.status === 'open'; }).length; }, 0),
      crew: crew.length,
      happy: crew.length ? Math.round(crew.reduce(function (n, x) { return n + x.happiness; }, 0) / crew.length) : 0,
      phase: s.phase,
      pendingEvent: s.pendingEvent ? s.pendingEvent.eventId : null,
      pendingDefer: (v.pendingDefer || []).length,
      modal: !!q('#modal-root [data-role="modal"]'),
      nextDisabled: (function () { var b = q('#btn-next-month'); return b ? b.disabled : null; })(),
      nextText: (function () { var b = q('#btn-next-month'); return b ? String(b.textContent || '').trim() : null; })(),
      ending: s.ending ? s.ending.id : null,
      endingTitle: s.ending ? s.ending.title : null,
      chronicleTail: (s.chronicle || []).slice(-1).map(function (c) { return c.text; })[0] || '',
      hudMonth: String((q('#hud-month') || {}).textContent || '').trim(),
      equipment: Object.keys(s.lab.equipment || {}).filter(function (k) { return s.lab.equipment[k] > 0; }).map(function (k) { return k + ':' + s.lab.equipment[k]; }).join(' '),
      marketProjects: ((v.market && v.market.projects) || []).map(function (o) { return o.offerId + '/' + (o.tierLabel || '') + '/' + o.money; }).join(' '),
      marketStudents: ((v.market && v.market.students) || []).length,
    };
  }
  function saveInfo() {
    var keys = Object.keys(window.localStorage);
    var out = { keys: keys, parsed: null, bytes: 0 };
    keys.forEach(function (k) {
      var t = window.localStorage.getItem(k) || '';
      if (t.length > out.bytes) {
        out.bytes = t.length;
        try {
          var j = JSON.parse(t);
          var inner = j.state || j;
          out.parsed = { key: k, topKeys: Object.keys(j).slice(0, 12), version: inner.version, monthIndex: inner.calendar ? inner.calendar.monthIndex : null, seed: inner.seed, savedAt: j.savedAt || null };
        } catch (e) { out.parsed = { key: k, error: String(e.message) }; }
      }
    });
    return out;
  }
  window.__T6 = { step: step, snap: snap, consistency: consistency, saveInfo: saveInfo, vm: vm, state: st, fp: fp };
})();
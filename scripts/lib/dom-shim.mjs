/**
 * dom-shim.mjs —— 无浏览器环境下的最小 DOM
 *
 * 用途：让 scripts/ui-smoke.mjs 能真的把 UI 渲染一遍（构建 DOM 树、跑事件代理），
 *      从而在没有浏览器的 CI/命令行里发现「渲染时抛异常」「节点缺失」这类错误。
 *
 * 限制（明确写出来，避免误用）：
 *   · 不解析 HTML 字符串（innerHTML 不支持）；骨架按 index.html 的结构手工镜像，
 *     真实契约由 scripts/check.mjs 的 DOM id 检查保证。
 *   · 只实现项目用到的那一小撮 API：createElement/createTextNode/getElementById/
 *     appendChild/removeChild/textContent/className/dataset/setAttribute/hidden/
 *     addEventListener/dispatchEvent/click/style/classList/closest。
 */

class ClassList {
  constructor(node) {
    this.node = node;
  }
  _list() {
    return String(this.node.className || '').split(/\s+/).filter(Boolean);
  }
  contains(name) {
    return this._list().includes(name);
  }
  add(name) {
    const list = this._list();
    if (!list.includes(name)) list.push(name);
    this.node.className = list.join(' ');
  }
  remove(name) {
    this.node.className = this._list().filter((x) => x !== name).join(' ');
  }
  toggle(name, force) {
    if (force === undefined ? !this.contains(name) : force) this.add(name);
    else this.remove(name);
  }
}

class Element {
  constructor(tagName) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.className = '';
    this._text = '';
    this.disabled = false;
    this.classList = new ClassList(this);
    this.id = '';
  }
  get children() {
    return this.childNodes.filter((n) => n instanceof Element);
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get textContent() {
    if (this.childNodes.length === 0) return this._text;
    return this.childNodes.map((n) => n.textContent).join('');
  }
  set textContent(value) {
    this.childNodes = [];
    this._text = value === undefined || value === null ? '' : String(value);
  }
  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) this.childNodes.splice(i, 1);
    if (child) child.parentNode = null;
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'hidden') this.hidden = true;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'hidden') this.hidden = false;
  }
  getAttribute(name) {
    return this.attributes[name] === undefined ? null : this.attributes[name];
  }
  addEventListener(type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this.listeners[type] || [];
    this.listeners[type] = list.filter((f) => f !== fn);
  }
  dispatchEvent(event) {
    const ev = event || {};
    ev.target = ev.target || this;
    if (typeof ev.preventDefault !== 'function') ev.preventDefault = () => { ev.defaultPrevented = true; };
    let node = this;
    while (node) {
      const list = (node.listeners && node.listeners[ev.type]) || [];
      for (const fn of list.slice()) fn.call(node, ev);
      if (ev.stopPropagation) break;
      node = node.parentNode;
    }
    return true;
  }
  click() {
    return this.dispatchEvent({ type: 'click' });
  }
  closest(selector) {
    let node = this;
    const want = String(selector).replace(/^\[|\]$/g, '');
    while (node) {
      if (want.startsWith('data-')) {
        const key = want.slice(5);
        if (node.dataset && node.dataset[key] !== undefined) return node;
      } else if (node.className && String(node.className).split(/\s+/).includes(want)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const want = String(selector);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (want.startsWith('#') && child.id === want.slice(1)) found.push(child);
        else if (want.startsWith('.') && String(child.className).split(/\s+/).includes(want.slice(1))) found.push(child);
        else if (!want.startsWith('#') && !want.startsWith('.') && child.tagName === want.toUpperCase()) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
  set innerHTML(value) {
    // 明确不支持：视图层必须用 createElement（见 src/ui/dom.js）
    throw new Error('dom-shim 不支持 innerHTML，请用 src/ui/dom.js 的 h()/mount()');
  }
}

const registry = new Map();

function make(tag) {
  return new Element(tag);
}

/** 按 index.html 的结构搭骨架（容器 id 与真实文件一致）。 */
export function buildSkeleton(html) {
  const body = make('body');
  const app = make('div');
  app.id = 'app';
  body.appendChild(app);
  registry.set('app', app);

  const ids = new Set();
  const idRe = /id="([^"]+)"/g;
  const roles = new Set();
  const roleRe = /data-role="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(html))) ids.add(m[1]);
  while ((m = roleRe.exec(html))) roles.add(m[1]);

  const nest = (parent, id, tag) => {
    const node = make(tag || 'div');
    node.id = id;
    node.setAttribute('id', id);
    parent.appendChild(node);
    registry.set(id, node);
    return node;
  };

  // hud
  const hud = make('header');
  hud.id = 'hud';
  hud.setAttribute('id', 'hud');
  hud.setAttribute('data-role', 'hud');
  app.appendChild(hud);
  registry.set('hud', hud);

  // tabs
  const tabs = make('nav');
  tabs.id = 'tabs';
  app.appendChild(tabs);
  registry.set('tabs', tabs);

  // panels
  const panels = make('main');
  panels.id = 'panels';
  app.appendChild(panels);
  registry.set('panels', panels);

  // chronicle
  const chronicleWrap = make('aside');
  chronicleWrap.id = 'chronicle-wrap';
  app.appendChild(chronicleWrap);
  registry.set('chronicle-wrap', chronicleWrap);

  const modalRoot = make('div');
  modalRoot.id = 'modal-root';
  app.appendChild(modalRoot);
  registry.set('modal-root', modalRoot);

  const toastRoot = make('div');
  toastRoot.id = 'toast-root';
  app.appendChild(toastRoot);
  registry.set('toast-root', toastRoot);

  // 真实 index.html 里出现过的 id：按语义挂到最合适的父亲上
  for (const id of ids) {
    if (registry.has(id)) continue;
    let parent = app;
    let tag = 'div';
    if (id.startsWith('hud-')) { parent = hud; tag = 'span'; }
    else if (id.startsWith('btn-')) { parent = hud; tag = 'button'; }
    else if (id.startsWith('tab-')) { parent = tabs; tag = 'button'; }
    else if (id === 'panel-lab' || id === 'panel-projects' || id === 'panel-market' || id === 'panel-actions' || id === 'panel-chronicle') { parent = panels; tag = 'section'; }
    else if (id === 'chronicle-list') { parent = chronicleWrap; tag = 'ul'; }
    nest(parent, id, tag);
  }

  // 顶栏按钮：与 index.html 一致的 data-action（事件代理用）
  const buttonActions = {
    'btn-help': 'help',
    'btn-next-month': 'next-month',
    'btn-save': 'save',
    'btn-export': 'export',
    'btn-import': 'import',
    'btn-resign': 'resign',
    'btn-reset': 'reset',
  };
  for (const [id, action] of Object.entries(buttonActions)) {
    const node = registry.get(id);
    if (node) node.dataset.action = action;
  }
  for (const [id, tab] of Object.entries({ 'tab-lab': 'lab', 'tab-projects': 'projects', 'tab-market': 'market', 'tab-actions': 'actions', 'tab-chronicle': 'chronicle' })) {
    const node = registry.get(id);
    if (node) { node.dataset.action = 'tab'; node.dataset.tab = tab; }
  }
  const lab = registry.get('panel-lab');
  if (lab) lab.removeAttribute('hidden');

  return { body, app, registry, ids, roles };
}

/** 安装到 globalThis，返回卸载函数。 */
export function installDomShim(html) {
  const skeleton = buildSkeleton(html);
  const document = {
    body: skeleton.body,
    documentElement: make('html'),
    getElementById: (id) => skeleton.registry.get(String(id)) || null,
    querySelector: (sel) => skeleton.body.querySelector(sel),
    querySelectorAll: (sel) => skeleton.body.querySelectorAll(sel),
    createElement: (tag) => make(tag),
    createTextNode: (text) => {
      const node = make('#text');
      node._text = String(text);
      return node;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  document.documentElement.appendChild(skeleton.body);
  globalThis.document = document;
  globalThis.window = globalThis.window || globalThis;
  globalThis.__DOM_REGISTRY__ = skeleton.registry;
  return { document, skeleton };
}

/** 内存版 localStorage（保存/读取路径也能被冒烟覆盖）。 */
export function installLocalStorage() {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] || null,
    get length() { return map.size; },
  };
  globalThis.localStorage = storage;
  return storage;
}

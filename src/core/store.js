/**
 * store.js —— 单一 store（state + 订阅）
 *
 * 冻结约定（docs/CONTRACT.md §3.1）：
 *   · 全应用只有一个 store 实例，由 src/main.js 创建。
 *   · UI 只能 store.getState() 读、store.actions.X()/store.dispatch() 写。
 *   · 任何 reduce 都是「旧 state → 新 state」，禁止原地改（store 会冻结旧 state 便于抓错）。
 *   · 订阅回调收到 (state, event)；event 里有 { type, action, changed }。
 */

import { cloneState } from './state.js';

/**
 * @param {{initialState:any, reducer:(state:any, action:any)=>any, actions?:Record<string,Function>, onChange?:(state:any,event:any)=>void}} options
 */
export function createStore(options) {
  const reducer = options.reducer;
  const listeners = new Set();
  const history = [];
  let state = options.initialState;

  function getState() {
    return state;
  }

  function notify(event) {
    if (typeof options.onChange === 'function') options.onChange(state, event);
    for (const listener of Array.from(listeners)) {
      try {
        listener(state, event);
      } catch (err) {
        console.error('[store] 订阅回调出错：', err);
      }
    }
  }

  /**
   * 分发一个 action。action 必须是 { type, payload } 形状的纯对象。
   * @param {{type:string, payload?:any}} action
   */
  function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new Error('store.dispatch 需要一个 { type, payload } 对象');
    }
    const prev = state;
    const next = reducer(prev, action);
    if (next === undefined) {
      throw new Error('reducer 返回了 undefined（action=' + action.type + '）');
    }
    if (next === prev) {
      notify({ type: action.type, action, changed: false });
      return state;
    }
    state = next;
    history.push({ type: action.type, at: Date.now() });
    if (history.length > 200) history.shift();
    notify({ type: action.type, action, changed: true });
    return state;
  }

  /** 直接替换整个 state（读档/开新档用）。 */
  function replaceState(nextState, meta) {
    state = nextState;
    notify({ type: 'state/replace', action: { type: 'state/replace', payload: meta || {} }, changed: true });
    return state;
  }

  /** 把 ACTIONS 里的创建器绑成可直接调用的方法。 */
  const bound = {};
  for (const [name, create] of Object.entries(options.actions || {})) {
    bound[name] = (payload) => dispatch(create(payload));
  }

  return {
    getState,
    dispatch,
    replaceState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getHistory: () => history.slice(),
    actions: bound,
  };
}

/** 调试/测试用：确保 state 不被 UI 原地改写。 */
export function freezeState(state) {
  return Object.freeze(cloneState(state));
}

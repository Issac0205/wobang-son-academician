/**
 * main.js —— 入口：建 store、读存档、装配 UI
 *
 * 运行方式（docs/DEV.md）：
 *   npm run dev   → 本机静态服务器（server.mjs）
 *   npm run build → 单文件 HTML（scripts/build-single.mjs）
 */

import { createState } from './core/state.js';
import { createStore } from './core/store.js';
import { ACTIONS, reduce } from './core/engine.js';
import { loadGame, saveGame, clearSave, hasSave, serialize, hydrate } from './core/save.js';
import { buildViewModel } from './core/viewmodel.js';
import { createApp } from './ui/app.js';
import { AUTOSAVE_ON_MONTH_END } from './data/tuning.js';

/**
 * 全新一局的初始态（T21-F1）。
 *
 * 必须经过引擎动作 game/newGame：它除了建 state，还负责「开局就把项目市场填上」
 * （t22 把首次刷新放进了 newGame，理由是第 0 月不该出现「市场开着但一个本子都没有」）。
 * 过去这里直接用裸 createState 当初始态，等于绕过了那次刷新 —— 全新会话首屏项目市场为空，
 * 而机器人走的是 reduce(createState, ACTIONS.newGame)，所以只有 app 这条路踩了坑。
 * 启动与「重开一局」两条路径都必须走这个函数。
 */
function newGameState(payload) {
  return reduce(createState(payload), ACTIONS.newGame(payload));
}

function boot() {
  const loaded = loadGame();
  const initial = loaded || newGameState({ seed: String(Date.now()) });
  const store = createStore({
    initialState: initial,
    reducer: reduce,
    actions: ACTIONS,
  });

  let lastMonth = store.getState().calendar.monthIndex;
  store.subscribe((state) => {
    if (!AUTOSAVE_ON_MONTH_END) return;
    if (state.calendar.monthIndex !== lastMonth) {
      lastMonth = state.calendar.monthIndex;
      saveGame(state);
    }
  });

  const io = {
    // 给 UI 判断「这是不是第一次进游戏」（首次进入自动摊开「怎么玩」）。
    hasSave: () => hasSave(),
    onSave() {
      saveGame(store.getState());
    },
    onExport() {
      const text = JSON.stringify(serialize(store.getState()));
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wobang-yuanshi-save.json';
      a.click();
      URL.revokeObjectURL(url);
    },
    onImport() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const next = hydrate(JSON.parse(String(reader.result)));
            if (next) {
              store.replaceState(next, { source: 'import' });
              saveGame(next);
            } else {
              console.warn('[main] 存档格式不认识，已忽略');
            }
          } catch (err) {
            console.warn('[main] 导入失败：', err);
          }
        };
        reader.readAsText(file);
      });
      input.click();
    },
    onReset() {
      clearSave();
      const fresh = newGameState({ seed: String(Date.now()) });
      store.replaceState(fresh, { source: 'reset' });
      saveGame(fresh);
    },
  };

  const app = createApp({ store, io });
  app.start();

  const api = { store, app, actions: ACTIONS, reduce, createState, buildViewModel, save: () => saveGame(store.getState()), hasSave };
  if (typeof window !== 'undefined') window.__GAME__ = api;
  return api;
}

const instance = boot();
export default instance;

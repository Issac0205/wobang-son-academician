/** cdp-eval.mjs —— 在已连接的 Edge 页面上 eval 一段表达式（表达式从文件读，避免命令行转义问题） */
import { readFileSync } from 'node:fs';
const CDP = 'http://127.0.0.1:9333';
const expr = readFileSync(process.argv[2], 'utf8');
const list = await (await fetch(CDP + '/json/list')).json();
const pages = list.filter((t) => t.type === 'page');
const page = pages.filter((t) => t.url.indexOf('127.0.0.1:5175') === 0)[0] || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const wait = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && wait.has(m.id)) { const w = wait.get(m.id); wait.delete(m.id); w(m); } };
const send = (method, params) => new Promise((res) => { const myId = ++id; wait.set(myId, res); ws.send(JSON.stringify({ id: myId, method, params: params || {} })); });
await send('Runtime.enable', {});
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
const payload = r.result || {};
console.log(JSON.stringify(payload.result ? payload.result.value : payload, null, 2));
if (payload.exceptionDetails) console.log('EXC: ' + JSON.stringify(payload.exceptionDetails).slice(0, 800));
ws.close();
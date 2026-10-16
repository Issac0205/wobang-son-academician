/** t5-shots.mjs —— 真实浏览器（headless Edge, CDP 9341）验收实验室空间视图 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const CDP='http://127.0.0.1:9341', URL='http://127.0.0.1:5181/';
const OUT=fileURLToPath(new globalThis.URL('.', import.meta.url));
const t=await (await fetch(CDP+'/json/new?'+encodeURIComponent(URL),{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
let id=0; const wait=new Map(); const logs=[];
ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&wait.has(m.id)){wait.get(m.id)(m);wait.delete(m.id);} if(m.method==='Runtime.exceptionThrown')logs.push('EXC '+JSON.stringify(m.params.exceptionDetails).slice(0,300)); if(m.method==='Runtime.consoleAPICalled'&&m.params.type!=='log')logs.push(m.params.type+' '+JSON.stringify(m.params.args.map(a=>a.value)).slice(0,300));};
const send=(method,params)=>new Promise((r)=>{const i=++id;wait.set(i,r);ws.send(JSON.stringify({id:i,method,params:params||{}}));});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const ev=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});return r.result&&r.result.result?r.result.result.value:r;};
const shot=async(name,full)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:!!full});writeFileSync(OUT+name,Buffer.from(r.result.data,'base64'));};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1366,height:1000,deviceScaleFactor:1,mobile:false});
await ev('localStorage.clear(); location.reload(); 1'); await sleep(1200);
const click=(sel)=>ev('(()=>{const n=document.querySelector('+JSON.stringify(sel)+'); if(!n) return "missing '+sel.replace(/"/g,'')+'"; n.click(); return "ok";})()');
const out={};
out.closeHelp=await click('[data-action="modal-close"]'); await sleep(200);
out.tab=await click('[data-action="tab"][data-tab="lab"]'); await sleep(200);
out.sec=await click('[data-action="lab-section"][data-section="instruments"]'); await sleep(300);
out.initial=await ev('({rooms:document.querySelectorAll("[data-role=room]").length,benches:document.querySelectorAll("[data-role=bench]").length,items:document.querySelectorAll("[data-action=lab-item]").length,shop:document.querySelectorAll("[data-role=shop-item]").length,buyEq:document.querySelectorAll("[data-action=buy-equipment]").length})');
await shot('t5-lab-01-overview.png', true);
// 拿起水浴锅并悬停到一个已占格子（应红）与空格子（应绿）
out.pick=await click('[data-action="lab-pick"][data-id="bath"]'); await sleep(200);
const rectOf=async(sel)=>ev('(()=>{const n=document.querySelector('+JSON.stringify(sel)+');if(!n)return null;n.scrollIntoView({block:"center"});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
const free=await ev('(()=>{for(const g of document.querySelectorAll("[data-role=bench-grid]")){const occ=(g.dataset.occ||"").split(";").filter(Boolean).map(s=>s.split(",").map(Number));for(const c of g.querySelectorAll("[data-action=lab-cell]")){const x=+c.dataset.x,y=+c.dataset.y;if(!occ.some(o=>x>=o[1]&&x<o[1]+o[3]&&y>=o[2]&&y<o[2]+o[4]))return {b:g.dataset.benchUid,x,y};}}return null;})()');
const freeSel=free?'[data-action=lab-cell][data-bench-uid='+free.b+'][data-x="'+free.x+'"][data-y="'+free.y+'"]':null;
out.freeSel=freeSel;
const p=await rectOf(freeSel); await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y}); await sleep(150);
out.previewOk=await ev('({ok:document.querySelectorAll(".lab-cell.is-ok").length,bad:document.querySelectorAll(".lab-cell.is-bad").length,fit:(document.querySelector("[data-role=held-bar]")||{dataset:{}}).dataset.fit})');
await shot('t5-lab-02-preview-ok.png');
// 换成液相 2x2 悬停到最后一列（越界→红）
out.pick2=await click('[data-action="lab-pick"][data-id="hplc"]'); await sleep(200);
const edge=await rectOf('[data-action=lab-cell][data-x="3"][data-y="0"]'); await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:edge.x,y:edge.y}); await sleep(150);
out.previewBad=await ev('({ok:document.querySelectorAll(".lab-cell.is-ok").length,bad:document.querySelectorAll(".lab-cell.is-bad").length,fit:document.querySelector("[data-role=held-bar]").dataset.fit})');
await shot('t5-lab-03-preview-bad.png');
// 放水浴锅到空格
await click('[data-action="lab-pick"][data-id="bath"]'); await sleep(150);
const before=await ev('JSON.parse(JSON.stringify(window.__store?1:0))');
const p2=await rectOf(freeSel); await send('Input.dispatchMouseEvent',{type:'mousePressed',x:p2.x,y:p2.y,button:'left',clickCount:1}); await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p2.x,y:p2.y,button:'left',clickCount:1}); await sleep(300);
out.afterPlace=await ev('({items:document.querySelectorAll("[data-action=lab-item]").length,held:!!document.querySelector("[data-role=held-bar]"),toast:(document.getElementById("toast-root")||{}).textContent||""})');
// 点选一台已摆仪器 → 搬动条
out.sel=await click('[data-action="lab-item"]'); await sleep(200);
out.moveBar=await ev('(document.querySelector("[data-role=held-bar]")||{}).textContent||null');
await shot('t5-lab-04-move.png');
await click('[data-action="lab-cancel"]'); await sleep(150);
// 买一张标准台到空台位
out.buyBench=await click('[data-action="lab-buy-bench"][data-type="bench_std"]'); await sleep(250);
out.afterBench=await ev('document.querySelectorAll("[data-role=bench]").length');
await ev('window.scrollTo(0,0)'); await shot('t5-lab-05-after.png', true);
out.logs=logs;
console.log(JSON.stringify(out,null,1));
ws.close(); process.exit(0);

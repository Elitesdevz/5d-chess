import type {Profile} from './account-model.ts'
import {cleanUsage,usagePage,TELEMETRY_BATCH_LIMIT,type UsageEvent} from './telemetry-model.ts'
let enabled=false,owner='',checking='',queue:UsageEvent[]=[],sending=false,sequence=0,lastAction='',lastActionAt=0,lastBalance:{coins:number;elo:number}|undefined
const eventId=()=>globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2)
let session='';try{session=sessionStorage.getItem('5d-usage-session')??eventId();sessionStorage.setItem('5d-usage-session',session)}catch{session=eventId()}
const page=()=>usagePage(location.href)
const key=()=>`5d-usage-pending:${owner}`
function persist(){if(!owner)return;try{sessionStorage.setItem(key(),JSON.stringify(queue))}catch{/* Browser storage can be unavailable; in-memory capture still works. */}}
function record(event:Omit<UsageEvent,'id'|'time'|'session'|'sequence'|'page'>&Partial<Pick<UsageEvent,'page'>>){
 if(!enabled)return
 const clean=cleanUsage({id:eventId(),time:Date.now(),session,sequence:++sequence,page:page(),...event});if(!clean)return
 queue.push(clean);if(queue.length>1000)queue.splice(0,queue.length-1000);persist();if(queue.length>=TELEMETRY_BATCH_LIMIT)void flushUsage()
 return clean.id
}
export async function startUsage(profile:Profile){
 if(owner!==profile.name){enabled=false;owner=profile.name;checking='';queue=[];lastBalance=undefined;try{queue=JSON.parse(sessionStorage.getItem(key())??'[]').map(cleanUsage).filter(Boolean).slice(-1000)}catch{queue=[]}}
 if(checking!==profile.name){checking=profile.name;const name=profile.name
  try{const response=await fetch('/api/telemetry');if(!response.ok){checking='';return}const data=await response.json();if(owner!==name)return;enabled=data.enabled===true;if(!enabled){queue=[];persist();return}record({kind:'navigation',label:'page',width:innerWidth,height:innerHeight});recordBalance(profile);void flushUsage()}
  catch{checking=''}
 }else recordBalance(profile)
}
export function recordBalance(profile:Profile){
 if(!enabled||profile.name!==owner)return
 const balance={coins:profile.coins,elo:profile.rating.value};if(!lastBalance||balance.coins!==lastBalance.coins||balance.elo!==lastBalance.elo){record({kind:'balance',...balance,previousCoins:lastBalance?.coins,previousElo:lastBalance?.elo,actionId:recentAction()});lastBalance=balance}
}
function recentAction(){return Date.now()-lastActionAt<15000?lastAction:undefined}
export function usageTrace(){return {id:eventId(),actionId:recentAction(),started:performance.now()}}
export function recordApi(path:string,method:string,status:number,trace:ReturnType<typeof usageTrace>){if(method==='GET'&&status>=200&&status<400&&!trace.actionId)return;record({kind:'api',page:usagePage('/api'+path),method,status,duration:Math.round(performance.now()-trace.started),requestId:trace.id,actionId:trace.actionId})}
export async function flushUsage(beacon=false){
 if(!enabled||!queue.length)return
 const batch=queue.slice(0,TELEMETRY_BATCH_LIMIT),payload=JSON.stringify({events:batch})
 if(beacon){try{navigator.sendBeacon('/api/telemetry',new Blob([payload],{type:'application/json'}))}catch{}return}
 if(sending)return;sending=true;let acknowledged=false
 try{const response=await fetch('/api/telemetry',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true});if(response.ok){acknowledged=true;const data=await response.json();if(data.enabled===false){enabled=false;queue=[]}else{const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id))}persist()}}
 catch{/* Leave the bounded queue for the next retry/page. */}finally{sending=false;if(acknowledged&&queue.length>=TELEMETRY_BATCH_LIMIT)queueMicrotask(()=>void flushUsage())}
}
const board='[data-square],[data-cell],[data-match-square],[data-board-square],.board-cell,.match-square,.square'
function control(target:EventTarget|null){return target instanceof Element&&!target.closest(board)?target.closest<HTMLElement>('button,a,summary,[role=button],input[type=button],input[type=submit],input[type=checkbox],input[type=radio]'):null}
function description(el:HTMLElement){return {label:(el.getAttribute('aria-label')??el.getAttribute('title')??el.textContent??el.tagName).replace(/\s+/g,' ').trim().slice(0,180),target:(el.id?'#'+el.id:el.tagName.toLowerCase()+'.'+Array.from(el.classList).slice(0,3).join('.')).slice(0,120)}}
document.addEventListener('click',e=>{const el=control(e.target);if(!el)return;lastAction=record({kind:'click',...description(el),href:el instanceof HTMLAnchorElement?usagePage(el.href):undefined,x:e.clientX,y:e.clientY,width:innerWidth,height:innerHeight,input:e.detail===0?'keyboard':'pointer',disabled:'disabled' in el?!!el.disabled:undefined})??'';lastActionAt=Date.now()},true)
document.addEventListener('pointerdown',e=>{const el=control(e.target);if(el&&'disabled' in el&&el.disabled){lastAction=record({kind:'click',...description(el),disabled:true,x:e.clientX,y:e.clientY,input:e.pointerType})??'';lastActionAt=Date.now()}},true)
document.addEventListener('change',e=>{const el=e.target;if(!(el instanceof HTMLSelectElement||el instanceof HTMLInputElement&&['checkbox','radio','range'].includes(el.type))||el.closest(board))return;lastAction=record({kind:'change',...description(el),label:el instanceof HTMLSelectElement?`${description(el).label}: ${el.selectedOptions[0]?.textContent??''}`:description(el).label,checked:el instanceof HTMLInputElement&&['checkbox','radio'].includes(el.type)?el.checked:undefined})??'';lastActionAt=Date.now()},true)
for(const method of ['pushState','replaceState'] as const){const original=history[method].bind(history);history[method]=(data:unknown,unused:string,url?:string|URL|null)=>{original(data,unused,url);record({kind:'navigation',label:method,width:innerWidth,height:innerHeight})}}
for(const event of ['hashchange','popstate'])window.addEventListener(event,()=>record({kind:'navigation',label:event,width:innerWidth,height:innerHeight}))
window.addEventListener('error',event=>record({kind:'error',label:event.error instanceof Error?event.error.name:'Resource error',target:usagePage(event.filename),line:event.lineno,column:event.colno}))
window.addEventListener('unhandledrejection',event=>record({kind:'error',label:event.reason instanceof Error?event.reason.name:'Unhandled rejection'}))
document.addEventListener('visibilitychange',()=>{record({kind:'visibility',label:document.visibilityState});if(document.visibilityState==='hidden')void flushUsage(true)})
window.addEventListener('pagehide',()=>{record({kind:'navigation',label:'leave'});void flushUsage(true)})
setInterval(()=>void flushUsage(),3000)

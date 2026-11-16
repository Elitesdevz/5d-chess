export const TELEMETRY_ACCOUNT_LIMIT=100
export const TELEMETRY_BYTES_PER_ACCOUNT=10_000_000
export const TELEMETRY_BATCH_LIMIT=20
export interface UsageEvent {
 id:string;time:number;kind:'click'|'change'|'navigation'|'visibility'|'balance'|'error'|'api';session?:string;sequence?:number;page:string
 label?:string;target?:string;href?:string;actionId?:string;requestId?:string;method?:string;status?:number;duration?:number
 coins?:number;elo?:number;previousCoins?:number;previousElo?:number;width?:number;height?:number;x?:number;y?:number;checked?:boolean;disabled?:boolean;input?:string;line?:number;column?:number
}
export function usagePage(raw:unknown){
 if(typeof raw!=='string')return '/'
 try{const u=new URL(raw,'https://app.invalid');const query=new URLSearchParams();for(const k of ['code','lesson','players','local','name']){const v=u.searchParams.get(k);if(v&&v.length<=48)query.set(k,v)}return (u.pathname+(query.size?'?'+query:'')+(/^#[\w-]{1,35}$/.test(u.hash)?u.hash:'')).slice(0,220)}catch{return '/'}
}
/** Explicit allowlist: request bodies, text inputs, passwords, cookies and tokens have no field here. */
export function cleanUsage(raw:unknown):UsageEvent|undefined{
 if(!raw||typeof raw!=='object')return
 const r=raw as Record<string,unknown>;if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(r.id)||!['click','change','navigation','visibility','balance','error','api'].includes(String(r.kind))||!Number.isSafeInteger(r.time)||Number(r.time)<0)return
 const out:UsageEvent={id:r.id,time:Number(r.time),kind:r.kind as UsageEvent['kind'],page:usagePage(r.page)}
 for(const k of ['session','label','target','href','actionId','requestId','method','input'] as const){const value=r[k];if(typeof value==='string')out[k]=(k==='href'?usagePage(value):value.replace(/[\u0000-\u001f]/g,' ').replace(/(?:password|authorization|cookie|token)\s*[:=]\s*\S+/gi,'[redacted]')).slice(0,k==='label'?180:120)}
 for(const k of ['sequence','status','duration','coins','elo','previousCoins','previousElo','width','height','x','y','line','column'] as const)if(typeof r[k]==='number'&&Number.isFinite(r[k]))out[k]=r[k] as number
 for(const k of ['checked','disabled'] as const)if(typeof r[k]==='boolean')out[k]=r[k] as boolean
 return out
}

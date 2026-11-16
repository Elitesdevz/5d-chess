import {DatabaseSync} from 'node:sqlite'
import {dirname,join} from 'node:path'
import {openSync,closeSync,existsSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import type {ChessStore} from './storage.ts'
import type {Reply} from './model.ts'
import {cleanUsage,usagePage,TELEMETRY_ACCOUNT_LIMIT,TELEMETRY_BYTES_PER_ACCOUNT,TELEMETRY_BATCH_LIMIT,type UsageEvent} from '../src/telemetry-model.ts'
import {fail} from './http.ts'

export class UsageStore {
 private db:DatabaseSync;private closed=false;private warned=false
 constructor(path:string,privateLimit=TELEMETRY_BYTES_PER_ACCOUNT){
  this.limit=privateLimit;if(path!==':memory:'&&!existsSync(path)){const fd=openSync(path,'wx',0o600);closeSync(fd)}
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=1000;
   CREATE TABLE IF NOT EXISTS usage_events(id INTEGER PRIMARY KEY,account TEXT NOT NULL,event_key TEXT NOT NULL,received INTEGER NOT NULL,bytes INTEGER NOT NULL,payload TEXT NOT NULL,UNIQUE(account,event_key));
   CREATE INDEX IF NOT EXISTS usage_account_order ON usage_events(account,id);
   CREATE TABLE IF NOT EXISTS usage_totals(account TEXT PRIMARY KEY,bytes INTEGER NOT NULL DEFAULT 0,events INTEGER NOT NULL DEFAULT 0);`)
 }
 readonly limit:number
 append(account:string,events:UsageEvent[],source:'client'|'server',now=Date.now()){
  if(this.closed)return
  this.db.exec('BEGIN IMMEDIATE')
  try{
   this.db.prepare('INSERT OR IGNORE INTO usage_totals(account) VALUES(?)').run(account)
   for(const event of events){const payload=JSON.stringify({...event,source,received:now}),bytes=Buffer.byteLength(payload);if(bytes>this.limit)continue
    const inserted=this.db.prepare('INSERT OR IGNORE INTO usage_events(account,event_key,received,bytes,payload) VALUES(?,?,?,?,?)').run(account,event.id,now,bytes,payload)
    if(inserted.changes)this.db.prepare('UPDATE usage_totals SET bytes=bytes+?,events=events+1 WHERE account=?').run(bytes,account)
   }
   let total=this.usage(account)
   while(total.bytes>this.limit){const oldest=this.db.prepare('SELECT id,bytes FROM usage_events WHERE account=? ORDER BY id LIMIT 1').get(account) as {id:number;bytes:number}|undefined;if(!oldest)throw new Error('Invalid telemetry retention total');this.db.prepare('DELETE FROM usage_events WHERE id=?').run(oldest.id);this.db.prepare('UPDATE usage_totals SET bytes=bytes-?,events=events-1 WHERE account=?').run(oldest.bytes,account);total={bytes:total.bytes-oldest.bytes,events:total.events-1}}
   this.db.exec('COMMIT')
  }catch(error){this.db.exec('ROLLBACK');throw error}
 }
 bestEffort(account:string,event:UsageEvent){try{this.append(account,[event],'server')}catch{if(!this.warned){this.warned=true;console.error('Usage telemetry is unavailable; gameplay continues.')}}}
 usage(account:string){return (this.db.prepare('SELECT bytes,events FROM usage_totals WHERE account=?').get(account) as {bytes:number;events:number}|undefined)??{bytes:0,events:0}}
 events(account:string){return (this.db.prepare('SELECT payload FROM usage_events WHERE account=? ORDER BY id').all(account) as {payload:string}[]).map(r=>JSON.parse(r.payload))}
 close(){if(this.closed)return;this.closed=true;this.db.close()}
}
export function telemetryEligible(store:ChessStore,name:string){const ordinal=store.accountOrdinal(name);return ordinal!==undefined&&ordinal<=TELEMETRY_ACCOUNT_LIMIT}
export function usagePath(store:ChessStore){return store.path===':memory:'?':memory:':join(dirname(store.path),'telemetry.sqlite')}
export function usageApi(log:UsageStore,store:ChessStore,name:string,path:string,method:string,data:Record<string,unknown>):Reply|undefined{
 if(path!=='/api/telemetry')return
 const enabled=telemetryEligible(store,name)
 if(method==='GET')return {status:200,value:{enabled,byteLimit:TELEMETRY_BYTES_PER_ACCOUNT,accountLimit:TELEMETRY_ACCOUNT_LIMIT}}
 if(method!=='POST')fail(405,'Method not allowed')
 if(!enabled)return {status:200,value:{accepted:0,enabled:false}}
 if(!Array.isArray(data.events)||data.events.length>TELEMETRY_BATCH_LIMIT)fail(400,'Invalid telemetry batch')
 const events=data.events.map(cleanUsage);if(events.some(e=>!e))fail(400,'Invalid telemetry event')
 log.append(name,events as UsageEvent[],'client');return {status:200,value:{accepted:events.length,enabled:true}}
}
export function serverUsage(log:UsageStore,store:ChessStore,name:string|undefined,path:string,method:string,status:number,start:number,trace?:string,action?:string,before?:{coins?:number;elo?:number}){
 if(!name||path==='/api/telemetry'||!telemetryEligible(store,name))return
 const raw=store.accountJson(name);if(!raw)return;const account=JSON.parse(raw)
 const event:UsageEvent={id:randomUUID(),kind:'api',time:Date.now(),page:usagePage(path),method,status,duration:Date.now()-start,coins:account.wallet?.coins,elo:account.rating?.value,previousCoins:before?.coins,previousElo:before?.elo}
 if(trace&&/^[\w-]{8,80}$/.test(trace))event.requestId=trace;if(action&&/^[\w-]{8,80}$/.test(action))event.actionId=action
 log.bestEffort(name,event)
}

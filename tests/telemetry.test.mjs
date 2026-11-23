import test from 'node:test'
import assert from 'node:assert/strict'
import {UsageStore,telemetryEligible} from '../server/telemetry.ts'
import {cleanUsage} from '../src/telemetry-model.ts'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tokenHash} from '../server/security.ts'

const event=i=>({id:'event-key-'+i,time:100+i,kind:'click',page:'/chess/lobby.html?password=never-log&code=ABCD',label:'Find game'})
test('usage retention is isolated, bounded per user, oldest-first and retry-safe',()=>{
 const log=new UsageStore(':memory:',1000);try{log.append('A',[event(1)],'client');const first=log.usage('A');log.append('A',[event(1)],'client');assert.deepEqual(log.usage('A'),first);log.append('B',[event(1)],'client');log.append('A',Array.from({length:15},(_,i)=>event(i+2)),'client');assert.ok(log.usage('A').bytes<=1000);assert.ok(log.events('A').every(e=>e.id!=='event-key-1'));assert.equal(log.events('A').at(-1).id,'event-key-16');assert.equal(log.events('B').length,1)}finally{log.close()}
 const cleaned=cleanUsage({...event(1),password:'private-password',token:'private-token',body:{secret:'private-body'}});assert.doesNotMatch(JSON.stringify(cleaned),/never-log|private-/);assert.equal(cleaned.page,'/chess/lobby.html?code=ABCD')
})
test('cohort is the first 100 created accounts including existing users; APIs enforce owner and record balances',async t=>{
 const dir=await mkdtemp('/tmp/chess-usage-'),store=new ChessStore(dir);store.transaction(u=>{for(let i=1;i<=101;i++){u.users.add('User'+i,{name:'User'+i,salt:'s',hash:'h',rating:{value:1200,games:0}});u.putSession(tokenHash('session-'+i),{user:'User'+i,expires:Date.now()+60000})}});assert.equal(telemetryEligible(store,'User1'),true);assert.equal(telemetryEligible(store,'User100'),true);assert.equal(telemetryEligible(store,'User101'),false)
 const app=createApplication(store),server=createServer(app.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port
 t.after(async()=>{app.drain();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 const request=(path,who=1,data,headers={})=>fetch(base+path,{method:data?'POST':'GET',headers:{cookie:'multiverse_session=session-'+who,...(data?{'content-type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined})
 assert.equal((await fetch(base+'/api/telemetry')).status,401);assert.equal((await(await request('/api/telemetry',100)).json()).enabled,true);assert.equal((await(await request('/api/telemetry',101)).json()).enabled,false)
 assert.equal((await(await request('/api/telemetry',101,{events:[event(1)]})).json()).accepted,0)
 assert.equal((await request('/api/telemetry',1,{events:[{...event(1),account:'User101',password:'private-password'}]})).status,200)
 await request('/api/me',1,undefined,{'x-client-trace':'trace-12345678','x-ui-action':'action-12345678'})
 const read=new UsageStore(dir+'/telemetry.sqlite');const count=read.events('User1').length;await request('/api/me');assert.equal(read.events('User1').length,count,'unchanged background polling does not fill the record');store.transaction(u=>u.users.get('User1').wallet.coins=777);await request('/api/me');assert.equal(read.events('User1').at(-1).coins,777,'an uncorrelated balance change still produces an authoritative snapshot');try{assert.equal(read.events('User101').length,0);const records=read.events('User1');assert.ok(records.some(e=>e.source==='client'&&e.label==='Find game'));assert.ok(records.some(e=>e.source==='server'&&e.requestId==='trace-12345678'&&e.actionId==='action-12345678'&&typeof e.coins==='number'&&e.elo===1200));assert.doesNotMatch(JSON.stringify(records),/private-password|session-1|never-log/)}finally{read.close()}
})

test('economy telemetry delivers committed events only and keeps company and player trails separate',async()=>{
 const {drainEconomyUsage}=await import('../server/telemetry.ts')
 const {stockApi}=await import('../server/stock-api.ts')
 const {bankApi}=await import('../server/bank.ts')
 const {maintainEconomy}=await import('../server/governance.ts')
 const {companies,saveCompanies,cashUnits}=await import('../server/corporate.ts')
 const now=Date.UTC(2026,10,23,11),store=new ChessStore('.', {memory:true}),log=new UsageStore(':memory:')
 try{
  store.transaction(u=>{
   for(let i=1;i<=101;i++)u.users.add('Trader'+i,{name:'Trader'+i,salt:'',hash:'',wallet:{coins:500,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}})
   maintainEconomy(u,now)
  })
  const stock=(name,side,id)=>store.transaction(u=>{
   u.usageTrace('client-trace-001','ui-action-001')
   return stockApi(u,u.users.get(name),'/api/stocks/order','POST',{symbol:'CAS',side,price:.2,shares:2,id},now)
  })
  stock('Trader1','buy','usage-order-0001')
  stock('Trader1','buy','usage-order-0001')
  stock('Trader101','buy','usage-order-0101')
  assert.throws(()=>stock('Trader2','sell','usage-order-rollback'),{status:409})
  store.transaction(u=>bankApi(u,u.users.get('Trader1'),'/api/bank/borrow','POST',{id:'usage-loan-001',sequence:1,amount:200,days:7},now))
  store.transaction(u=>{const e=companies(u,now);e.CAS.cash=0;e.CAS.obligations=cashUnits(50000);saveCompanies(u,e);maintainEconomy(u,now)})
  assert.equal(log.events('Trader1').length,0)
  drainEconomyUsage(log,store);drainEconomyUsage(log,store)
  assert.deepEqual(log.events('Trader1').map(e=>e.economy.action),['order_placed','order_filled','loan_opened'])
  assert.equal(log.events('Trader1')[0].requestId,'client-trace-001')
  assert.equal(log.events('Trader1')[0].actionId,'ui-action-001')
  assert.equal(log.events('Trader2').length,0)
  assert.equal(log.events('Trader101').length,0)
  const company=log.events('@economy:CAS').map(e=>e.economy.action)
  assert.equal(company.filter(action=>action==='order_placed').length,6)
  assert.deepEqual(company.filter(action=>action!=='order_placed'),['order_filled','order_filled','bankruptcy'])
  assert.equal(cleanUsage({id:'forged-event',kind:'economy',page:'/api/stocks',time:now}),undefined)
  assert.equal(cleanUsage({id:'regular-event',kind:'click',page:'/chess/',time:now,economy:{action:'loan_opened'}}).economy,undefined)
 }finally{log.close();store.close()}
})

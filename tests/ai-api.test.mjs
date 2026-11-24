import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {chooseAiPlan} from '../src/ai.ts'
import {initialState,index} from '../src/model.ts'
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'chess-ai-api-'));let store,app,server,base
 const start=async()=>{store=new ChessStore(dir);app=createApplication(store);server=createServer(app.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`}
 const stop=async()=>{app.drain();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close()}
 await start();t.after(async()=>{await stop();await rm(dir,{recursive:true,force:true})})
 let cookie
 const call=async(path,data,otherCookie=cookie)=>{const r=await fetch(base+'/api'+path,{method:data===undefined?'GET':'POST',headers:{...(otherCookie?{cookie:otherCookie}:{}),...(data!==undefined?{'content-type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 cookie=(await call('/signup',{username:'Alice',password:'p',confirm:'p'})).cookie
 const ready=async code=>{for(let i=0;i<120;i++){const r=await call('/games/'+code);if(!r.data.ai.thinking)return r.data;await new Promise(r=>setTimeout(r,50))}throw Error('AI did not finish planning')}
 return {call,ready,store:()=>store,restart:async()=>{await stop();await start()}}
}

test('AI plans privately in a worker, persists through restart, and resolves Live without rating changes',async t=>{
 const f=await fixture(t),catalog=await f.call('/games/ai');assert.equal(catalog.data.opponents.length,5)
 const created=await f.call('/games',{ai:'orion',movement:'live',rated:true,reward:999999});assert.equal(created.status,201);const code=created.data.code
 assert.equal(created.data.rated,false);assert.equal(created.data.waiting,false);assert.equal(created.data.ai.id,'orion')
 assert.equal(created.data.ai.seed,undefined);assert.equal(created.data.ai.orders,undefined)
 if(created.data.ai.thinking)assert.equal((await f.call('/games/'+code+'/orders',{orders:[]})).status,409)
 const health=await f.call('/health');assert.equal(health.data.ok,true)
 const room=await f.ready(code);assert.equal(room.locked.yellow,true)
 const committed=f.store().transaction(unit=>structuredClone(unit.rooms.get(code).locked.yellow))
 const duplicate=await f.call('/games',{ai:'orion',movement:'classic'});assert.equal(duplicate.status,200);assert.equal(duplicate.data.code,code);assert.equal(duplicate.data.state.movement,'live')
 await f.restart();const restored=await f.ready(code);assert.deepEqual(f.store().transaction(unit=>unit.rooms.get(code).locked.yellow),committed)
 const human=chooseAiPlan(restored.state,'red','pip','human');const result=await f.call('/games/'+code+'/orders',{orders:human});assert.equal(result.status,200);assert.ok(result.data.state.round>room.state.round)
 assert.ok(result.data.journal.at(-1).some(o=>o.player==='yellow'))
 const bob=(await f.call('/signup',{username:'Bob',password:'p',confirm:'p'})).cookie
 assert.equal((await f.call('/games/'+code+'/join',{},bob)).status,403)
 assert.equal((await f.call('/games/'+code,undefined,bob)).status,403)
 assert.equal((await f.call('/games')).data.available.length,0)
 assert.equal(f.store().activeRooms(),0);assert.equal(f.store().check().accounts,2)
 const before=(await f.call('/me')).data.profile
 if(!result.data.finished)await f.call('/games/'+code+'/resign',{})
 const lossReward=f.store().transaction(u=>u.rooms.get(code).ai.lossReward)
 const after=(await f.call('/me')).data.profile;assert.deepEqual(after.rating,before.rating);assert.equal(lossReward,4);assert.equal(after.coins,before.coins+lossReward)
 assert.equal((await f.call('/ai/claim',{coins:999999})).status,404)
})
test('Classic AI responds automatically and a server-verified victory pays exactly once',async t=>{
 const f=await fixture(t),created=await f.call('/games',{ai:'pip',movement:'classic',playerCount:2}),code=created.data.code
 let room=await f.ready(code);assert.equal(room.state.turn,'red')
 const initialRound=room.state.round,human=chooseAiPlan(room.state,'red','pip','human-classic')
 assert.equal((await f.call('/games/'+code+'/orders',{orders:human})).status,200)
 room=await f.ready(code);assert.equal(room.state.turn,'red');assert.equal(room.state.round,initialRound+2)
 // Seed a legal final position in this isolated database; clients cannot send state.
 f.store().transaction(unit=>{const room=unit.rooms.get(code),s=initialState(2,'classic',['red','yellow']),cells=Array(196).fill(null);for(const[x,y,player,kind]of[[3,10,'red','K'],[7,5,'red','R'],[7,3,'yellow','K']])cells[index({x,y})]={player,kind,moved:true};room.state={...s,round:100,universes:[{...s.universes[0],boards:[{...s.universes[0].boards[0],cells}]}]};room.results=[];room.journal=[];room.locked={}})
 const before=(await f.call('/me')).data.profile.coins
 const result=await f.call('/games/'+code+'/orders',{orders:[{player:'red',from:{x:7,y:5,t:0,u:0},to:{x:7,y:3,t:0,u:0},route:[0]}]})
 assert.equal(result.status,200);assert.equal(result.data.finished,true);assert.equal(result.data.ai.reward.coins,60)
 assert.equal((await f.call('/games/'+code+'/orders',{orders:[]})).status,409)
 await f.restart();const me=(await f.call('/me')).data.profile;assert.equal(me.coins,before+60+4);assert.equal(me.rating.games,0)
 const catalog=(await f.call('/games/ai')).data;assert.equal(catalog.opponents[0].wins,1);assert.equal(catalog.opponents[0].nextReward,30)
 const history=f.store().profileGameRows('Alice',Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,20);assert.equal(JSON.parse(history[0].summary).aiReward,60)
 assert.equal(f.store().check().accounts,1)
})

test('pending searches recover after restart and never attach a stale plan to a resigned match',async t=>{
 const f=await fixture(t),created=await f.call('/games',{ai:'vesper',movement:'live'}),code=created.data.code
 await f.restart();const restored=await f.ready(code);assert.equal(restored.locked.yellow,true)
 const next=await f.call('/games',{ai:'iris',movement:'live'}),resigned=await f.call('/games/'+next.data.code+'/resign',{})
 assert.equal(resigned.data.finished,true)
 await new Promise(r=>setTimeout(r,150))
 const final=(await f.call('/games/'+next.data.code)).data;assert.equal(final.results.length,1);assert.equal(final.ai.reward,undefined);assert.equal(final.locked.yellow,false)
})

test('a real account with an AI-looking name cannot enter another player’s AI duel',async t=>{
 const f=await fixture(t),room=await f.call('/games',{ai:'pip',movement:'live'})
 const other=(await f.call('/signup',{username:'AI · Pip',password:'p',confirm:'p'})).cookie
 assert.equal((await f.call('/games/'+room.data.code,undefined,other)).status,403)
 assert.equal((await f.call('/games/'+room.data.code+'/resign',{},other)).status,403)
 const own=await f.call('/games',{ai:'pip',movement:'classic'},other)
 assert.equal(own.status,201);assert.equal(own.data.seat,'red');assert.notEqual(own.data.seats.red,own.data.seats.yellow)
 assert.equal(f.store().check().accounts,2)
})

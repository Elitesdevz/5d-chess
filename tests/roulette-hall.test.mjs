import test from 'node:test'
import assert from 'node:assert/strict'
import {RouletteHall} from '../server/roulette-hall.ts'
import {ChessStore} from '../server/storage.ts'
import {casinoView} from '../server/casino.ts'
import {BET_WINDOW,SPIN_TIME} from '../src/roulette-hall-model.ts'

function setup(t,count){
 const store=new ChessStore('.', {memory:true}),hall=new RouletteHall(store)
 hall.stop()
 t.after(()=>store.close())
 const names=Array.from({length:count},(_,i)=>'Player'+i)
 store.transaction(unit=>{
  for(const name of names)unit.users.add(name,{name,salt:'',hash:'',wallet:{coins:1000,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}})
 })
 return {store,hall,names}
}

test('roulette fills rooms to ten and settles a single shared draw exactly once',t=>{
 const {store,hall,names}=setup(t,11),now=Date.now()
 const joins=names.map(name=>hall.update(name,'presence',{},now))
 assert.equal(new Set(joins.slice(0,10).map(j=>j.room)).size,1)
 assert.notEqual(joins[0].room,joins[10].room)
 const first=hall.update(names[0],'sit',{table:0},now)
 hall.update(names[1],'sit',{table:0},now)
 const a={round:first.tables[0].round,requestId:'roulette-test-a',stake:25,choice:'white'}
 const b={...a,requestId:'roulette-test-b',choice:'black'}
 assert.equal(hall.update(names[0],'bet',a,now).coins,975)
 assert.equal(hall.update(names[0],'bet',a,now).coins,975)
 assert.throws(()=>hall.update(names[0],'stand',{},now),{status:409})
 const draw=hall.update(names[1],'bet',b,now)
 assert.equal(draw.tables[0].phase,'spin')
 assert.equal(draw.tables[0].prizes,undefined)
 assert.deepEqual(hall.update(names[1],'bet',b,now).tables[0].spin,draw.tables[0].spin)
 assert.throws(()=>hall.update(names[1],'bet',{...b,stake:26},now),{status:409})
 const finish=names.slice(0,2).map(name=>hall.update(name,'presence',{},now+SPIN_TIME))
 assert.equal(finish[0].receipt.result,finish[1].receipt.result)
 assert.equal(finish[0].tables[0].prizes.length,2)
 for(const [i,v] of finish.entries()){
  assert.equal(v.coins,1000+v.receipt.net)
  assert.equal(casinoView(JSON.parse(store.accountJson(names[i]))).recent.length,1)
 }
 const tax=finish.reduce((sum,v)=>sum+v.receipt.tax,0)
 const owner=store.accountJson('CasinoOwner')
 assert.equal(owner?JSON.parse(owner).wallet.coins:0,tax)
})

test('a timed wager settles without an unready player, and a pending stake survives restart',t=>{
 const {store,hall,names}=setup(t,2),now=Date.now()
 for(const name of names)hall.update(name,'presence',{},now)
 const open=hall.update(names[0],'sit',{table:1},now)
 hall.update(names[1],'sit',{table:1},now)
 const table=open.tables[1],ticket={round:table.round,requestId:'roulette-timer-1',stake:10,choice:0}
 const awaiting=hall.update(names[0],'bet',ticket,now)
 assert.equal(awaiting.tables[1].phase,'betting')
 for(const ms of [15000,30000,45000,59999]){
  hall.update(names[1],'presence',{},now+ms)
  assert.equal(hall.update(names[0],'presence',{},now+ms).tables[1].phase,'betting')
 }
 const recovered=new RouletteHall(store)
 recovered.stop()
 const spin=recovered.update(names[0],'presence',{},now+BET_WINDOW)
 assert.equal(spin.room,awaiting.room)
 assert.equal(spin.tables[1].phase,'spin')
 const result=recovered.update(names[0],'presence',{},now+BET_WINDOW+SPIN_TIME)
 assert.equal(result.coins,1000+result.receipt.net)
 assert.deepEqual(store.metadataValue('rouletteHallEscrow'),[])
 assert.equal(JSON.parse(store.accountJson(names[1])).wallet.coins,1000)
})

test('couch seats are shared and leave the betting tables untouched',t=>{
 const {hall,names}=setup(t,4),now=Date.now()
 for(const name of names)hall.update(name,'presence',{},now)
 const seated=names.slice(0,3).map(name=>hall.update(name,'lounge',{couch:0},now))
 assert.equal(new Set(seated.map(view=>view.you.lounge.index)).size,3)
 assert.equal(seated[2].players.filter(player=>player.lounge?.couch===0).length,3)
 assert.ok(seated[2].tables.every(table=>table.phase==='idle'))
 assert.throws(()=>hall.update(names[3],'lounge',{couch:0},now),{status:409})
 assert.throws(()=>hall.update(names[0],'sit',{table:0},now),{status:409})
 const standing=hall.update(names[0],'stand',{},now)
 assert.equal(standing.you.lounge,undefined)
 assert.equal(hall.update(names[3],'lounge',{couch:0},now).you.lounge.index,seated[0].you.lounge.index)
})

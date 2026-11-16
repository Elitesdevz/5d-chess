import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {initialState} from '../src/model.ts'
import {planLegacyRatings,applyLegacyRatings,BATCH} from '../scripts/backfill-legacy-ratings.mjs'
function room(code,created,a,b,winner){const state=initialState(2);state.eliminated=[winner==='red'?'yellow':'red'];return {code,created,owner:a,title:code,seats:{red:a,yellow:b},state,results:[{state,outcomes:[],rejected:[],eliminated:state.eliminated}],journal:[[]],locked:{}}}
test('legacy replay starts at 1200, carries results forward, preserves gambling losses and never settles twice',()=>{
 const first=room('AAAA',10,'A','B','red'),second=room('BBBB',20,'A','B','red'),rated=room('CCCC',30,'A','B','red');rated.state.movement='classic';rated.ratingSettled=true
 const plan=planLegacyRatings([second,rated,first]);assert.deepEqual(plan.games.map(g=>g.code),['AAAA','BBBB']);assert.deepEqual(plan.games[1].before,[1216,1184]);assert.deepEqual(plan.games.map(g=>g.deltas),[[16,-16],[15,-15]])
 const store=new ChessStore('/tmp/not-created',{memory:true});try{store.transaction(u=>{for(const [name,value]of [['A',920],['B',1190]])u.users.add(name,{name,salt:'s',hash:'h',rating:{value,games:0},wallet:{coins:888},eloGambling:{lifetimeLost:1200-value}});for(const r of [first,second,rated])u.rooms.add(r.code,r)})
 const result=applyLegacyRatings(store,plan,100);assert.equal(result.coinsChanged,false);let snapshot=store.snapshot();assert.equal(snapshot.users.find(u=>u.name==='A').rating.value,951);assert.equal(snapshot.users.find(u=>u.name==='B').rating.value,1159);assert.equal(snapshot.users[0].wallet.coins,888);assert.equal(snapshot.users.find(u=>u.name==='A').eloGambling.lifetimeLost,280);assert.ok(snapshot[BATCH]);assert.equal(snapshot.rooms.find(r=>r.code==='AAAA').state.movement,undefined);assert.deepEqual(applyLegacyRatings(store,plan,200),{...result,alreadyApplied:true});assert.deepEqual(store.snapshot(),snapshot)
 }finally{store.close()}
})
test('legacy multiplayer replay uses finish order and shared production elimination scoring',()=>{
 const first=room('AAAA',1,'A','D','red'),last=room('CCCC',3,'C','D','red'),state=initialState(4);state.eliminated=['yellow','red','blue']
 const results=Array.from({length:12},()=>({state,outcomes:[],rejected:[],eliminated:[]}));for(const [i,victim,killer]of [[5,'yellow','blue'],[8,'red','green'],[11,'blue','green']])results[i]={state,outcomes:[{move:{player:killer},captures:[{piece:{kind:'K',player:victim}}]}],rejected:[],eliminated:[victim]}
 const multi={...room('BBBB',2,'C','D','red'),state,results,seats:{red:'C',blue:'B',yellow:'A',green:'D'}};const plan=planLegacyRatings([last,multi,first]);assert.deepEqual(plan.games[1].deltas,[-8,7,-20,21]);assert.deepEqual(plan.games[2].deltas,[17,-17]);assert.deepEqual(plan.totals,{A:-4,D:-12,C:9,B:7})
})

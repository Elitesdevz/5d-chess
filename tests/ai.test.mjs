import test from 'node:test'
import assert from 'node:assert/strict'
import {AI_OPPONENTS,aiPrize} from '../src/ai-model.ts'
import {chooseAiPlan,aiAcceptsDraw} from '../src/ai.ts'
import {initialState,index,survivors,frontier} from '../src/model.ts'
import {legalMoves} from '../src/moves.ts'
import {requiredBoards} from '../src/rules.ts'
import {resolveRound} from '../src/resolve.ts'
import {settleAiReward,aiDaily} from '../server/ai-games.ts'
import {ensureAccount} from '../server/accounts.ts'
import {dayKey,nextReset} from '../src/collection.ts'
const c=(x,y,t=0,u=0)=>({x,y,t,u})
function position(pieces,movement='live',player='yellow'){
 const s=initialState(2,movement,[player,player==='red'?'yellow':'red']),cells=Array(196).fill(null)
 for(const[x,y,p,kind]of pieces)cells[index(c(x,y))]={player:p,kind,moved:true}
 return {...s,universes:[{...s.universes[0],boards:[{t:0,cells,enPassant:[],...(movement==='classic'?{turn:player}:{})}]}]}
}

test('five characters have ascending prizes and varied, reproducible openings',()=>{
 assert.equal(AI_OPPONENTS.length,5)
 assert.deepEqual(AI_OPPONENTS.map(b=>b.reward),[60,100,160,240,360])
 const openings=new Set()
 for(const bot of AI_OPPONENTS)for(const movement of ['classic','live']){
  const s=initialState(2,movement,['yellow','red']),plan=chooseAiPlan(s,'yellow',bot.id,'same-seed')
  assert.equal(requiredBoards(s,'yellow',plan).length,0)
  assert.equal(resolveRound(s,plan,{partial:true}).rejected.length,0)
  openings.add(JSON.stringify(plan))
 }
 assert.ok(openings.size>=2)
 const s=initialState(2,'live');assert.deepEqual(chooseAiPlan(s,'red','pip','stable'),chooseAiPlan(s,'red','pip','stable'))
})
test('every AI supplies all compulsory boards without exceeding the optional budget',()=>{
 const s=initialState(2,'live'),root=s.universes[0]
 s.universes.push({...root,id:1,parent:0,creator:'red',boards:[{...root.boards[0],cells:[...root.boards[0].cells]}]})
 for(const bot of AI_OPPONENTS){
  const plan=chooseAiPlan(s,'yellow',bot.id,'two-boards',{budgetMs:80})
  assert.equal(requiredBoards(s,'yellow',plan).length,0);assert.equal(plan.length,2)
  assert.equal(new Set(plan.map(m=>m.from.u)).size,2)
  assert.deepEqual(resolveRound(s,plan,{partial:true}).rejected,[])
 }
})
test('stronger opponents defend a threatened king under the actual simultaneous collision rules',()=>{
 const s=position([[3,3,'red','B'],[8,8,'yellow','K'],[4,7,'yellow','N'],[10,3,'red','K']])
 const attack=legalMoves(s,c(3,3),c(8,8))[0]
 for(const id of ['iris','vesper','orion']){
  const plan=chooseAiPlan(s,'yellow',id,'intercept'),r=resolveRound(s,[...plan,attack])
  assert.deepEqual(r.rejected,[]);assert.ok(survivors(r.state).includes('yellow'))
 }
})
test('Orion does not sacrifice its king for an ordinary pawn in Live',()=>{
 const s=position([[6,6,'yellow','K'],[6,5,'red','P'],[10,3,'red','K']])
 const plan=chooseAiPlan(s,'yellow','orion','king-safety'),r=resolveRound(s,plan,{partial:true})
 assert.ok(!r.eliminated.includes('yellow'))
})
test('historical king captures are winning targets for temporal opponents',()=>{
 const s=position([[3,10,'yellow','K'],[5,5,'yellow','R'],[10,3,'red','K']]),past=[...frontier(s.universes[0]).cells]
 past[index(c(10,3))]=null;past[index(c(5,5))]={player:'red',kind:'K',moved:true}
 s.universes[0].boards=[{t:0,cells:past,enPassant:[]},{...s.universes[0].boards[0],t:1},{...s.universes[0].boards[0],t:2}]
 for(const id of ['vesper','orion']){
  const plan=chooseAiPlan(s,'yellow',id,'past-king'),r=resolveRound(s,plan,{partial:true})
  assert.deepEqual(r.rejected,[]);assert.ok(r.eliminated.includes('red'))
 }
})
test('AI accepts king-only draws but does not abandon a playable material position',()=>{
 assert.equal(aiAcceptsDraw(position([[3,10,'yellow','K'],[10,3,'red','K']])),true)
 assert.equal(aiAcceptsDraw(initialState(2,'live')),false)
})
function won(id='orion'){
 return {code:'TEST',title:'AI duel',owner:'Alice',seats:{red:'Alice',yellow:'AI · Orion'},state:{...initialState(2,'live'),eliminated:['yellow']},results:[],journal:[],locked:{},created:0,rated:false,ai:{id,player:'yellow'}}
}
test('victory rewards diminish per opponent and reset at Dutch midnight, including DST boundaries',()=>{
 const account=ensureAccount({name:'Alice',salt:'s',hash:'h'}),before=account.wallet.coins,ratings=structuredClone({rating:account.rating,ratings:account.ratings})
 const now=Date.parse('2026-10-24T12:00:00Z'),amounts=[]
 for(let i=0;i<5;i++){const room=won();settleAiReward(room,account,now);amounts.push(room.ai.reward.coins);const coins=account.wallet.coins;settleAiReward(room,account,now);assert.equal(account.wallet.coins,coins)}
 assert.deepEqual(amounts,[360,180,90,36,36]);assert.equal(account.wallet.coins-before,702)
 const other=won('pip');settleAiReward(other,account,now);assert.equal(other.ai.reward.coins,60)
 const reset=nextReset(now);assert.equal(aiDaily(account,reset-1).wins.orion,5);assert.equal(aiDaily(account,reset).wins.orion,undefined)
 const fresh=won();settleAiReward(fresh,account,reset);assert.equal(fresh.ai.reward.coins,360);assert.equal(fresh.ai.reward.day,dayKey(reset))
 assert.deepEqual({rating:account.rating,ratings:account.ratings},ratings)
 for(const bot of AI_OPPONENTS)assert.ok(aiPrize(bot.id,10000)>0)
})
test('losses, draws and unfinished games never award coins or consume victory tiers',()=>{
 const account=ensureAccount({name:'Alice',salt:'s',hash:'h'}),coins=account.wallet.coins
 for(const state of [{...initialState(2,'live'),eliminated:['red']},{...initialState(2,'live'),draw:true},initialState(2,'live')]){const room=won();room.state=state;settleAiReward(room,account);assert.equal(room.ai.reward,undefined)}
 assert.equal(account.wallet.coins,coins);assert.equal(account.aiDaily,undefined)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {initialState,frontier,moveBudget,isMain,present,boardTurn} from '../src/model.ts'
import {legalMoves} from '../src/moves.ts'
import {resolveRound,sourceBudget} from '../src/resolve.ts'
import {optionalAllowance} from '../src/rules.ts'
import {chooseAiPlan} from '../src/ai.ts'
function fixture(mode,main,extra){
 const s=initialState(2,mode,['red','yellow']),root=s.universes[0]
 s.universes=Array.from({length:main+extra},(_,id)=>({...root,id,active:id<main,parent:id?0:null,creator:'red',boards:[{...frontier(root),cells:[...frontier(root).cells],turn:'red'}]}))
 return s
}
function orders(s){return s.universes.map(u=>legalMoves(s,{x:6,y:9,u:u.id,t:frontier(u).t}).find(m=>m.to.x===6&&m.to.y===8&&m.to.u===u.id&&m.to.t===frontier(u).t))}
test('Classic accepts every owned optional frontier, still enforcing board owners and one source order',()=>{
 const s=fixture('classic',1,5),plan=orders(s)
 assert.ok(plan.every(Boolean));assert.equal(optionalAllowance(s,'red').total,5)
 assert.deepEqual(resolveRound(s,plan).rejected,[])
 assert.equal(sourceBudget(s,plan[1].from,[plan[1]]),null)
 s.universes[2].boards[0].turn='yellow'
 assert.equal(sourceBudget(s,plan[2].from,[]),null)
 assert.ok(resolveRound(s,plan).rejected.length)
})
test('Live extra orders scale with active Present boards up to three; inactive stockpiles add no allowance',()=>{
 for(const [main,cap]of [[1,1],[2,2],[3,3],[5,3]]){
  const s=fixture('live',main,5),all=orders(s),allowed=all.slice(0,main+cap)
  assert.equal(moveBudget(s).optional,cap);assert.equal(optionalAllowance(s,'red').total,cap)
  assert.deepEqual(resolveRound(s,allowed,{partial:true}).rejected,[])
  assert.equal(sourceBudget(s,all[main+cap].from,allowed),null)
  assert.ok(resolveRound(s,all.slice(0,main+cap+1),{partial:true}).rejected.some(r=>/optional/.test(r.reason)))
  assert.equal(optionalAllowance(s,'red',allowed).left,0)
 }
})
test('AI plans obey scalable Live and uncapped Classic source budgets',()=>{
 for(const mode of ['classic','live']){
  const s=fixture(mode,2,4),plan=chooseAiPlan(s,'red','brass','optional-test',{budgetMs:80,fast:true})
  assert.deepEqual(resolveRound(s,plan,{partial:true}).rejected,[])
  assert.equal(new Set(plan.map(m=>m.from.u)).size,plan.length)
  if(mode==='live')assert.ok(plan.filter(m=>!isMain(s.universes[m.from.u],present(s))).length<=2)
 }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {newSession,decode,encode,commit,liveState} from '../src/session.ts'
import {resolveRound} from '../src/resolve.ts'
import {resolveLive} from '../src/continuous.ts'
import {legalMoves} from '../src/moves.ts'
import {initialState,frontier,index} from '../src/model.ts'
const c=(x,y,t=0)=>({x,y,t,u:0})
const move=(s,from,to)=>{const m=legalMoves(s,from,to)[0];assert.ok(m,JSON.stringify({from,to}));return m}
test('old Live journals preserve past captures and switch future rounds to current rules across repeated reloads',()=>{
 const session=newSession(2,'live')
 for(const pair of [[[c(6,9),c(6,7)],[c(7,4),c(7,6)]],[[c(6,7,1),c(7,6,1)],[c(4,3,1),c(5,5,1)]]]){
  const state=liveState(session),batch=pair.map(([a,b])=>move(state,a,b)),result=resolveRound(state,batch,{legacyLive:true})
  assert.deepEqual(result.rejected,[]);session.journal.push(batch);session.results.push(result);session.frames.push(result.state)
 }
 const old=JSON.parse(encode(session));delete old.liveRulesFrom
 const migrated=decode(JSON.stringify(old));assert.equal(migrated.liveRulesFrom,2);assert.deepEqual(migrated.frames,session.frames)
 assert.equal(frontier(liveState(migrated).universes[0]).cells[index(c(7,6))],null)
 // Continue with current rules, then verify the mixed journal reloads exactly.
 const state=liveState(migrated)
 migrated.draft=[move(state,c(4,10,2),c(5,8,2))];assert.equal(commit(migrated),undefined)
 migrated.draft=[move(state,c(5,5,2),c(7,6,2))];commit(migrated)
 const roundTrip=decode(encode(migrated));assert.equal(roundTrip.liveRulesFrom,2);assert.deepEqual(roundTrip.frames,migrated.frames)
 assert.throws(()=>decode(JSON.stringify({...old,liveRulesFrom:99})),/boundary/)
})

function position(pieces){
 const s=initialState(4,'live'),cells=Array(196).fill(null)
 for(const[x,y,player,kind]of [[3,13,'red','K'],[0,3,'blue','K'],[10,0,'yellow','K'],[13,10,'green','K'],...pieces])cells[index(c(x,y))]={player,kind,moved:true}
 s.universes[0].boards[0].cells=cells;return s
}
test('simultaneous captures of one stationary target resolve the attackers instead of overwriting a survivor',()=>{
 const s=position([[3,5,'red','R'],[7,5,'blue','R'],[5,5,'yellow','P']]),orders=[move(s,c(3,5),c(5,5)),move(s,c(7,5),c(5,5))]
 for(const batch of [orders,[...orders].reverse()]){
  const r=resolveRound(s,batch,{partial:true})
  assert.deepEqual(r.rejected,[]);assert.equal(r.outcomes.filter(o=>o.status==='collided').length,2)
  assert.equal(frontier(r.state.universes[0]).cells[index(c(5,5))],null)
 }
})
test('a later traveller captures an attacker that already stopped on its first victim',()=>{
 const s=position([[3,5,'red','R'],[5,9,'blue','R'],[5,5,'yellow','P']]),orders=[move(s,c(3,5),c(5,5)),move(s,c(5,9),c(5,5))]
 const r=resolveRound(s,orders,{partial:true}),board=frontier(r.state.universes[0])
 assert.deepEqual(r.rejected,[]);assert.equal(board.cells[index(c(5,5))].player,'blue')
 assert.equal(r.outcomes.find(o=>o.move.player==='red').status,'collided')
 assert.deepEqual(r.outcomes.find(o=>o.move.player==='blue').captures.map(c=>c.piece.player),['red'])
})

test('friendly movers contesting a capture bounce nearby without losing or overwriting a piece',()=>{
 const s=position([[3,5,'red','R'],[7,5,'red','R'],[5,5,'yellow','P']]),orders=[move(s,c(3,5),c(5,5)),move(s,c(7,5),c(5,5))]
 const r=resolveLive(s,orders,[]),board=frontier(r.state.universes[0])
 assert.equal(board.cells.filter(p=>p?.kind==='R').length,2)
 assert.notDeepEqual(r.travel[0].to,r.travel[1].to)
 for(const t of r.travel.filter(t=>t.piece.kind==='R'))assert.ok(Math.hypot(t.to.x-5,t.to.y-5)<=3)
 assert.deepEqual(r,resolveLive(s,orders,[]))
})

for(const [label,pieces,paths,attackerKind]of [
 ['king captures a checking pawn before its planned capture',[[6,6,'red','K'],[5,5,'yellow','P']],[[[6,6],[5,5]],[[5,5],[6,6]]],'K'],
 ['king captures a knight before its jump',[[6,6,'red','K'],[5,5,'yellow','N']],[[[6,6],[5,5]],[[5,5],[7,6]]],'K'],
 ['knight captures a pawn before it starts travelling',[[4,7,'red','N'],[5,5,'yellow','P']],[[[4,7],[5,5]],[[5,5],[5,6]]],'N']
])test(label,()=>{
 const s=position(pieces),orders=paths.map(([a,b])=>move(s,c(...a),c(...b)))
 for(const batch of [orders,[...orders].reverse()]){
  const r=resolveRound(s,batch,{partial:true}),board=frontier(r.state.universes[0])
  assert.deepEqual(r.rejected,[]);assert.ok(!r.eliminated.includes('red'))
  assert.equal(board.cells[index(c(5,5))]?.player,'red');assert.equal(board.cells[index(c(5,5))]?.kind,attackerKind)
  assert.equal(r.outcomes.find(o=>o.move.player==='yellow').status,'collided')
  assert.equal(r.outcomes.find(o=>o.move.player==='red').status,'applied')
  assert.equal(r.travel.find(t=>t.piece.player==='yellow').endTick,0)
 }
})
test('a king vacates its old square before an opposing knight arrives there',()=>{
 const s=position([[6,6,'red','K'],[4,5,'yellow','N']]),orders=[move(s,c(6,6),c(7,7)),move(s,c(4,5),c(6,6))]
 const r=resolveRound(s,orders,{partial:true}),board=frontier(r.state.universes[0])
 assert.deepEqual(r.rejected,[]);assert.deepEqual(r.eliminated,[])
 assert.equal(board.cells[index(c(7,7))]?.kind,'K');assert.equal(board.cells[index(c(6,6))]?.kind,'N')
})

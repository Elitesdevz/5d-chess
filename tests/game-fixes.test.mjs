import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {initialState,index,frontier,survivors} from '../src/model.ts'
import {legalMoves} from '../src/moves.ts'
import {resolveRound} from '../src/resolve.ts'
import {ChessStore} from '../server/storage.ts'
import {gameApi} from '../server/game-api.ts'
import {maintainRoom,maintainGames,TURN_LIMIT} from '../server/game-lifecycle.ts'
import {ensureAccount} from '../server/accounts.ts'
const c=(x,y,t=0,u=0)=>({x,y,t,u})
const move=(s,a,b)=>{const m=legalMoves(s,a,b)[0];assert.ok(m,JSON.stringify({a,b}));return m}
function bias(swap=false){
 const base=initialState(4,'live'),old=Array(196).fill(null),label=p=>swap?({red:'blue',blue:'red'}[p]??p):p
 for(const [x,y,p]of[[3,13,'red'],[0,3,'blue'],[10,0,'yellow'],[13,10,'green']])old[index(c(x,y))]={player:label(p),kind:'K',moved:true}
 const now=[...old];for(const[x,y,p]of[[5,9,'red'],[4,5,'blue']])now[index(c(x,y))]={player:label(p),kind:'R',moved:true}
 const s={...base,round:3,universes:[{...base.universes[0],boards:[{t:0,cells:old,enPassant:[]},{t:1,cells:old,enPassant:[]},{t:2,cells:now,enPassant:[]}]}]}
 return {s,orders:[[c(5,9,2),c(5,9,1)],[c(4,5,2),c(4,5,0)],[c(10,0,2),c(9,0,2)],[c(13,10,2),c(13,9,2)]].map(([a,b])=>move(s,a,b))}
}
test('swapping faction labels cannot change dimensional durations or kill a king under a drawn flight path',()=>{
 const results=[false,true].map(swap=>{const{s,orders}=bias(swap);return resolveRound(s,orders)})
 for(const r of results){assert.deepEqual(r.rejected,[]);assert.deepEqual(r.eliminated,[]);assert.ok(r.outcomes.every(o=>o.status==='applied'))}
 const times=r=>r.travel.filter(t=>t.piece.kind==='R').sort((a,b)=>a.from.x-b.from.x).map(t=>t.endTick)
 assert.deepEqual(times(results[0]),times(results[1]))
 const{s,orders}=bias();s.universes.push({...s.universes[0],id:10,parent:0,creator:'green',boards:[{t:2,cells:Array(196).fill(null),enPassant:[]}]});const reversed=resolveRound({...s,universes:[...s.universes].reverse()},[...orders].reverse());assert.deepEqual(times(reversed),times(results[0]))
})
function sparse(){const s=initialState(2,'live');const cells=Array(196).fill(null);return {...s,universes:[{...s.universes[0],boards:[{t:0,cells,enPassant:[]}]}]}}
test('Live dimensional routes pass intervening occupied boards while spatial and Classic blockers remain',()=>{
 const s=sparse(),empty=Array(196).fill(null),middle=[...empty],now=[...empty]
 middle[index(c(5,5))]={player:'yellow',kind:'K',moved:true};now[index(c(5,5))]={player:'red',kind:'R',moved:true}
 s.universes[0].boards=[{t:0,cells:empty,enPassant:[]},{t:1,cells:middle,enPassant:[]},{t:2,cells:now,enPassant:[]}]
 const order=move(s,c(5,5,2),c(5,5,0)),r=resolveRound(s,[order],{partial:true})
 assert.equal(r.outcomes[0].status,'applied');assert.deepEqual(r.eliminated,[])
 assert.equal(legalMoves({...s,movement:'classic',turn:'red'},c(5,5,2),c(5,5,0)).length,0)
 now[index(c(5,6))]={player:'yellow',kind:'P',moved:true}
 assert.equal(legalMoves(s,c(5,5,2),c(5,7,2)).length,0)
})
test('dimensional arrival still trades with an occupied destination',()=>{
 const s=sparse(),now=[...s.universes[0].boards[0].cells],old=[...now]
 now[index(c(5,5))]={player:'red',kind:'R',moved:true};old[index(c(5,5))]={player:'yellow',kind:'B',moved:true}
 s.universes[0].boards=[{t:0,cells:old,enPassant:[]},{t:1,cells:now,enPassant:[]}]
 const r=resolveRound(s,[move(s,c(5,5,1),c(5,5,0))],{partial:true})
 assert.equal(r.outcomes[0].status,'collided');assert.equal(frontier(r.state.universes.at(-1)).cells[index(c(5,5))],null)
})
test('opposing dimensional travellers collide on a shared connection regardless of drawn row spacing',()=>{
 const s=sparse(),root=s.universes[0];root.boards[0].cells[index(c(5,5))]={player:'red',kind:'R',moved:true}
 const cells=Array(196).fill(null);cells[index(c(5,5))]={player:'yellow',kind:'R',moved:true}
 s.universes.push({...root,id:1,parent:0,creator:'yellow',boards:[{t:0,cells,enPassant:[]}]})
 const orders=[move(s,c(5,5),c(5,5,0,1)),move(s,c(5,5,0,1),c(5,5))]
 const r=resolveRound(s,orders,{partial:true});assert.equal(r.outcomes.filter(o=>o.status==='collided').length,2)
 assert.ok(r.travel.every(t=>t.endTick<.25))
})
async function fixture(t,count=2,movement='live'){
 const dir=await mkdtemp(join(tmpdir(),'chess-game-fixes-')),store=new ChessStore(dir)
 t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true})})
 const names=['Alice','Bob','Cy','Dan'].slice(0,count)
 store.transaction(unit=>{for(const name of names)unit.users.add(name,ensureAccount({name,salt:'s',hash:'h'}))})
 const call=(name,path,data={},method='POST')=>store.transaction(unit=>gameApi(store,unit,name,path,method,data))
 const made=call('Alice','/api/games',{title:'Test',playerCount:count,movement}),code=made.value.code,path='/api/games/'+code
 for(const name of names.slice(1))call(name,path+'/join')
 return {store,call,path,code,names}
}
test('Classic refuses Elo even when requested but completion still pays coins once',async t=>{
 const{store,call,path,code}=await fixture(t,2,'classic')
 assert.equal(call('Alice',path,{},'GET').value.rated,false)
 const before=store.snapshot().users.map(u=>({rating:u.rating,ratings:u.ratings,coins:u.wallet.coins}))
 const result=call('Bob',path+'/resign').value;assert.equal(result.finished,true);assert.deepEqual(result.ratingChanges,{})
 const after=store.snapshot().users
 for(let i=0;i<2;i++){assert.deepEqual(after[i].rating,before[i].rating);assert.deepEqual(after[i].ratings,before[i].ratings);assert.equal(after[i].wallet.coins-before[i].coins,i===0?100:60)}
 const snapshot=store.snapshot();call('Alice',path,{},'GET');store.transaction(unit=>maintainGames(store,unit,Date.now()+TURN_LIMIT*3));assert.deepEqual(store.snapshot(),snapshot)
 assert.equal(store.transaction(unit=>unit.rooms.get(code).rewardsSettled),true)
})
test('a three-player Live game remains ranked and draw needs all surviving players',async t=>{
 const{store,call,path}=await fixture(t,3)
 assert.equal(call('Alice',path,{},'GET').value.rated,true)
 const deadline=call('Alice',path+'/draw',{action:'offer'}).value.deadline
 const accepted=call('Bob',path+'/draw',{action:'accept'}).value;assert.equal(accepted.finished,false);assert.equal(accepted.deadline,deadline)
 assert.throws(()=>call('Intruder',path+'/draw',{action:'accept'}))
 const drawn=call('Cy',path+'/draw',{action:'accept'}).value;assert.equal(drawn.finished,true);assert.equal(drawn.state.draw,true);assert.deepEqual(survivors(drawn.state),[])
 for(const user of store.snapshot().users){assert.equal(user.rating.value,1200);assert.equal(user.rating.games,1);assert.equal(user.wallet.coins,540)}
 assert.deepEqual(store.profileRecord('Alice'),{played:1,wins:0,draws:1,losses:0})
})
test('declining clears a draw offer, resignation skips a Classic turn and cannot be repeated',async t=>{
 const{store,call,path,code}=await fixture(t,3,'classic')
 call('Alice',path+'/draw',{action:'offer'});assert.equal(call('Bob',path+'/draw',{action:'decline'}).value.drawOffer,undefined)
 const current=call('Alice',path,{},'GET').value;const name=current.seats[current.state.turn]
 const result=call(name,path+'/resign').value;assert.equal(result.finished,false);assert.notEqual(result.state.turn,current.state.turn);assert.equal(result.drawOffer,undefined)
 assert.throws(()=>call(name,path+'/resign'));assert.equal(store.transaction(unit=>unit.rooms.get(code).results.length),1)
})
test('48-hour deadlines survive reads; only unlocked Live players forfeit and old games get grace',async t=>{
 const{store,call,path,code}=await fixture(t)
 const s=call('Alice',path,{},'GET').value.state
 call('Alice',path+'/orders',{orders:[move(s,c(4,10),c(5,8))]})
 store.transaction(unit=>{const room=unit.rooms.get(code),deadline=room.deadline;maintainRoom(unit,room,deadline-1);assert.deepEqual(room.state.eliminated,[]);maintainRoom(unit,room,deadline);assert.deepEqual(room.state.eliminated,['yellow']);assert.equal(room.finishedAt,deadline)})
 assert.equal(call('Alice',path,{},'GET').value.finished,true)
 assert.deepEqual(store.snapshot().users.map(u=>u.rating.value),[1216,1184])
 const legacy=await fixture(t,3,'classic')
 legacy.store.transaction(unit=>{const room=unit.rooms.get(legacy.code);delete room.deadline;maintainRoom(unit,room,1000);assert.equal(room.deadline,1000+TURN_LIMIT);maintainRoom(unit,room,1000+TURN_LIMIT);assert.equal(room.state.eliminated.length,1);assert.equal(room.deadline,1000+2*TURN_LIMIT)})
})

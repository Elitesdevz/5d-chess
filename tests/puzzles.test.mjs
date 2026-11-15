import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ChessStore} from '../server/storage.ts'
import {ensureAccount} from '../server/accounts.ts'
import {puzzleApi,puzzleProgress} from '../server/puzzles.ts'
import {PUZZLES,PUZZLE_CHAPTERS,testPuzzle,puzzleById,order,at} from '../src/puzzle-model.ts'
import {requiredBoards} from '../src/rules.ts'
import {legalMoves} from '../src/moves.ts'
import {frontier,pieceAt} from '../src/model.ts'

test('all 30 tutorial lessons have distinct titles, six chapters, valid positions and engine-verified solutions',()=>{
 assert.equal(PUZZLES.length,30);assert.equal(PUZZLE_CHAPTERS.length,6);assert.equal(new Set(PUZZLES.map(p=>p.title)).size,30)
 for(const p of PUZZLES){
  assert.equal(PUZZLES.filter(n=>n.chapter===p.chapter).length,5)
  assert.ok(p.lesson.length>=2);assert.equal(p.hints.length,2);assert.ok(p.explanation.length>50)
  const s=p.setup(),before=JSON.stringify(s),solution=p.solution(s)
  assert.equal(requiredBoards(s,p.player,solution).length,0,p.title)
  const result=testPuzzle(p,solution);assert.equal(result.ok,true,p.title+': '+result.message);assert.deepEqual(result.result.rejected,[])
  assert.equal(JSON.stringify(s),before,'solution evaluation never mutates its input setup')
  assert.equal(testPuzzle(p,[]).ok,false,p.title+' cannot be completed by passing')
 }
})
test('tutorial rejects illegal, forged, opponent and incomplete multi-board orders',()=>{
 for(const value of [undefined,null,{},'solved',[null],[{player:'red'}]])assert.equal(testPuzzle(PUZZLES[0],value).ok,false)
 const p=PUZZLES[0],s=p.setup(),valid=p.solution(s)[0]
 for(const changed of [{...valid,player:'yellow'},{...valid,from:{...valid.from,t:100}},{...valid,to:{...valid.to,x:-1}},{...valid,route:[999]},{...valid,to:{...valid.to,x:NaN}}])assert.equal(testPuzzle(p,[changed]).ok,false)
 const many=PUZZLES[25],solution=many.solution(many.setup());assert.equal(testPuzzle(many,solution.slice(0,1)).ok,false)
 assert.match(testPuzzle(many,solution.slice(0,1)).message,/Present/)
 assert.equal(testPuzzle(many,[solution[0],solution[0]]).ok,false)
})
test('feedback distinguishes legal-but-wrong moves and completed objectives',()=>{
 const p=PUZZLES[0],s=p.setup(),wrong=order(s,at(6,9),at(6,7))
 const attempt=testPuzzle(p,[wrong]);assert.equal(attempt.ok,false);assert.ok(attempt.result);assert.equal(attempt.message,p.failure)
 const king=PUZZLES[11],ks=king.setup(),suicide=order(ks,at(6,6),at(6,5)),dead=testPuzzle(king,[suicide]);assert.equal(dead.ok,false);assert.equal(dead.result.eliminated.includes('red'),false)
 const final=PUZZLES[29],plans=final.solution(final.setup());assert.equal(testPuzzle(final,plans.slice(1)).ok,false)
})
test('tutorial accepts alternative successful interceptions rather than requiring an exact scripted answer',()=>{
 const p=PUZZLES[12],s=p.setup(),alternatives=legalMoves(s,at(4,7)).filter(m=>testPuzzle(p,[m]).ok)
 assert.ok(alternatives.length>=2)
})
test('verified progress persists per account, is idempotent, and rewards first completion without changing Elo',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-tutorial-'));t.after(()=>rm(dir,{recursive:true,force:true}));let store=new ChessStore(dir)
 try{
  store.transaction(unit=>{for(const name of ['Alice','Bob'])unit.users.add(name,ensureAccount({name,salt:'s',hash:'h'}))})
  const before=store.snapshot().users
  assert.throws(()=>store.transaction(unit=>puzzleApi(unit.users.get('Alice'),'/api/puzzles/1/solve','POST',{orders:[]})))
  for(const id of [1,9,15,23,26,30,30])store.transaction(unit=>{const p=puzzleById(id);const reply=puzzleApi(unit.users.get('Alice'),`/api/puzzles/${id}/solve`,'POST',{orders:p.solution(p.setup())});assert.equal(reply.status,200)})
  assert.deepEqual(store.transaction(unit=>puzzleProgress(unit.users.get('Alice'))).completed,[1,9,15,23,26,30])
  assert.deepEqual(store.transaction(unit=>puzzleProgress(unit.users.get('Bob'))).completed,[])
  const after=store.snapshot().users;for(let i=0;i<2;i++){assert.equal(after[i].wallet.coins,before[i].wallet.coins+(after[i].name==='Alice'?150:0));assert.deepEqual(after[i].rating,before[i].rating)}
  store.close();store=new ChessStore(dir)
  assert.deepEqual(store.transaction(unit=>puzzleApi(unit.users.get('Alice'),'/api/puzzles','GET',{})).value,{completed:[1,9,15,23,26,30],total:30,next:2})
  assert.throws(()=>store.transaction(unit=>puzzleApi(unit.users.get('Alice'),'/api/puzzles/31/solve','POST',{orders:[]})))
 }finally{store.close()}
})

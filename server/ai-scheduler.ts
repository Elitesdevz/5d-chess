import {Worker} from 'node:worker_threads'
import {aiNeedsPlan} from './ai-games.ts'
import {rewardCaptures} from './game-rewards.ts'
import {finishUpdate,resetDeadline} from './game-lifecycle.ts'
import {gameNotices} from './accounts.ts'
import {requiredBoards} from '../src/rules.ts'
import {legalMoves,routeKey} from '../src/moves.ts'
import {sourceBudget,resolveRound} from '../src/resolve.ts'
import type {Order} from '../src/model.ts'
import type {ChessStore} from './storage.ts'
import type {Room} from './model.ts'

/** One worker at a time: search never holds SQLite's writer lock or the HTTP event loop. */
export class AiScheduler {
 private running=false
 private stopped=false
 private worker?:Worker
 private retry?:ReturnType<typeof setTimeout>
 private store:ChessStore
 constructor(store:ChessStore){this.store=store}
 stop(){this.stopped=true;clearTimeout(this.retry);void this.worker?.terminate()}
 kick(){if(!this.running&&!this.stopped){this.running=true;void this.pump()}}
 private async search(room:Room):Promise<Order[]>{
  const ai=room.ai!
  return new Promise((resolve,reject)=>{
   const worker=this.worker=new Worker(new URL('../dist/ai-worker.mjs',import.meta.url),{execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128},workerData:{state:room.state,player:ai.player,id:ai.id,seed:(ai.seed??room.code)+':'+room.state.round,fast:(ai.failures??0)>0}})
   const timer=setTimeout(()=>{void worker.terminate();reject(Error('AI search timed out'))},8000)
   worker.once('message',(value)=>{clearTimeout(timer);void worker.terminate();value.error?reject(Error(value.error)):resolve(value.orders)})
   worker.once('error',error=>{clearTimeout(timer);reject(error)})
   worker.once('exit',()=>{clearTimeout(timer);reject(Error('AI worker exited without a plan'))})
  })
 }
 private async pump(){
  try{
   while(!this.stopped){
    const code=this.store.pendingAiCodes()[0];if(!code)break
    const snapshot=this.store.transaction(unit=>structuredClone(unit.rooms.get(code)!))
    if(!aiNeedsPlan(snapshot))break
    try{
     const orders=await this.search(snapshot);if(this.stopped)return
     this.store.transaction(unit=>{
      const room=unit.rooms.get(code)!
      if(room.state.round!==snapshot.state.round||!aiNeedsPlan(room))return
      const ai=room.ai!,checked:Order[]=[]
      if(!Array.isArray(orders)||orders.length>room.state.universes.length+1)throw Error('Invalid AI plan')
      for(const order of orders){
       if(order.player!==ai.player||!sourceBudget(room.state,order.from,checked)||!legalMoves(room.state,order.from,order.to).some(m=>routeKey(m.route)===routeKey(order.route)))throw Error('Invalid AI move')
       checked.push(order)
      }
      if(requiredBoards(room.state,ai.player,checked).length)throw Error('Incomplete AI plan')
      delete ai.error;delete ai.retryAt;delete ai.failures
      const owner=unit.users.get(room.owner)!
      if(room.state.movement==='live')room.locked[ai.player]=checked
      else{
       const result=resolveRound(room.state,checked)
       if(result.rejected.length)throw Error('AI turn rejected')
       room.state=result.state;room.results.push(result);room.journal.push(checked)
       rewardCaptures(room,result,name=>unit.users.get(name),Date.now())
       gameNotices(room,[owner],room.seats[ai.player]!,true)
      }
      resetDeadline(room);finishUpdate(unit,room)
     })
    }catch{
     if(this.stopped)return
     this.store.transaction(unit=>{const room=unit.rooms.get(code);if(!room?.ai||room.state.round!==snapshot.state.round||!aiNeedsPlan(room))return;room.ai.failures=(room.ai.failures??0)+1;room.ai.error='Planning was interrupted. Retrying shortly.';room.ai.retryAt=Date.now()+5000})
     clearTimeout(this.retry);this.retry=setTimeout(()=>this.kick(),5100);this.retry.unref()
    }
   }
  }finally{this.running=false}
 }
}

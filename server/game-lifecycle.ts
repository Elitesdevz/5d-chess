import {aiNeedsPlan,settleAiReward} from './ai-games.ts'
import {activation,nextPlayer,playerCount,survivors,type Player} from '../src/model.ts'
import {gameNotices,settleRatings,notify} from './accounts.ts'
import type {Room} from './model.ts'
import type {ChessStore,UnitOfWork} from './storage.ts'
export const TURN_LIMIT = 48 * 60 * 60 * 1000
const accounts=(unit:UnitOfWork,room:Room)=>Object.entries(room.seats).filter(([p])=>p!==room.ai?.player).map(([,name])=>unit.users.get(name!)!).filter(Boolean)
export function finishUpdate(unit:UnitOfWork,room:Room,now=Date.now()) {
  if(survivors(room.state).length<=1){room.finishedAt??=now;delete room.deadline;delete room.drawOffer}
  if(room.ai)settleAiReward(room,unit.users.get(room.owner)!,now)
  else settleRatings(room,accounts(unit,room))
}
export function resetDeadline(room:Room,now=Date.now()) {
  room.deadline=now+TURN_LIMIT
  delete room.drawOffer
}
export function eliminate(unit:UnitOfWork,room:Room,victims:Player[],reason:string,now=Date.now()) {
  const dead=[...new Set([...room.state.eliminated,...victims])]
  let state={...room.state,round:room.state.round+1,eliminated:dead}
  state={...state,universes:activation(state.universes,dead,playerCount(state))}
  if(state.movement==='classic'&&state.turn&&dead.includes(state.turn))state={...state,turn:nextPlayer(state,state.turn)}
  room.state=state;room.endReason=reason
  room.journal.push([]);room.results.push({state,outcomes:[],rejected:[],eliminated:victims})
  for(const name of Object.values(room.seats).filter(n=>n===room.owner||!room.ai))notify(unit.users.get(name!)!,{kind:'result',code:room.code,title:reason,detail:`${victims.map(p=>room.seats[p]).join(', ')} resigned. Remaining players have 48 hours to submit fresh plans.`})
  // Departure changes legal captures and board obligations: replan against the new state.
  room.locked={}
  resetDeadline(room,now)
  finishUpdate(unit,room,now)
  gameNotices(room,accounts(unit,room),'',true)
}
export function maintainRoom(unit:UnitOfWork,room:Room,now=Date.now()) {
  if(aiNeedsPlan(room))return
  if(room.state.movement!=='live'&&room.rated&&!room.ratingSettled)room.rated=false
  if(Object.keys(room.seats).length<playerCount(room.state)||survivors(room.state).length<=1)return
  // Existing games receive a full grace period; never backdate a new deadline.
  if(!room.deadline){resetDeadline(room,now);return}
  if(now<room.deadline)return
  const pending=survivors(room.state).filter(p=>p!==room.ai?.player&&(room.state.movement==='classic'?room.state.turn===p:!room.locked[p]))
  if(pending.length)eliminate(unit,room,pending,'48-hour inactivity forfeit',now)
}
export function maintainGames(store:ChessStore,unit:UnitOfWork,now=Date.now()) {
  for(const code of store.activeRoomCodes()){const room=unit.rooms.get(code);if(room)maintainRoom(unit,room,now)}
}

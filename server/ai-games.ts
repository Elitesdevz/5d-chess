import {AI_OPPONENTS,aiOpponent,aiPrize,type AiId,type AiDaily} from '../src/ai-model.ts'
import {dayKey,nextReset} from '../src/collection.ts'
import {survivors} from '../src/model.ts'
import {notify,type Account} from './accounts.ts'
import {wallet} from './economy.ts'
import type {Room} from './model.ts'
import type {ChessStore} from './storage.ts'
export function aiDaily(account:Account,now=Date.now()):AiDaily {
 return account.aiDaily?.day===dayKey(now)?account.aiDaily:{day:dayKey(now),wins:{}}
}
export function aiCatalog(store:ChessStore,account:Account,now=Date.now()){
 const daily=aiDaily(account,now),active=store.activeAiRooms(account.name)
 return {opponents:AI_OPPONENTS.map(bot=>({...bot,wins:daily.wins[bot.id]??0,nextReward:aiPrize(bot.id,daily.wins[bot.id]??0),active:active.find(room=>room.ai===bot.id)?.code})),reset:nextReset(now),now,day:daily.day}
}
/** The only AI payout path: actual persisted victory, once, in the room transaction. */
export function settleAiReward(room:Room,account:Account,now=Date.now()){
 if(!room.ai||room.rewardsSettled||survivors(room.state).length>1)return
 room.rewardsSettled=true
 const human=survivors(room.state).find(p=>p!==room.ai!.player)
 if(!human||room.seats[human]!==account.name)return
 const daily=aiDaily(account,now),wins=daily.wins[room.ai.id]??0,coins=aiPrize(room.ai.id,wins)
 account.aiDaily={day:daily.day,wins:{...daily.wins,[room.ai.id]:wins+1}}
 wallet(account).coins+=coins
 room.ai.reward={coins,day:daily.day,win:wins+1}
 notify(account,{kind:'result',code:room.code,title:`You beat ${aiOpponent(room.ai.id)!.name}`,detail:`+${coins} coins. Next victory today: ${aiPrize(room.ai.id,wins+1)} coins. Your Elo is unchanged.`})
}
export const aiNeedsPlan=(room:Room)=>!!room.ai&&survivors(room.state).length>1&&(room.state.movement==='live'?!room.locked[room.ai.player]:room.state.turn===room.ai.player)

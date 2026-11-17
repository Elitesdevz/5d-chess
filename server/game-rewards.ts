import {dayKey} from '../src/collection.ts'
import {survivors,type Resolution,type Player} from '../src/model.ts'
import {notify,type Account} from './accounts.ts'
import {wallet} from './economy.ts'
import type {Room} from './model.ts'

export const DAILY_GAME_REWARD_POOL=2000
const MIN_REWARD=1
const rewardAt=(events:number)=>Math.max(MIN_REWARD,Math.round(4/(1+events/160)))

function credit(account:Account,room:Room,player:Player,now:number){
 const day=dayKey(now),daily=account.gameRewardDaily?.day===day?account.gameRewardDaily:{day,coins:0,events:0}
 const coins=Math.min(rewardAt(daily.events),Math.max(0,DAILY_GAME_REWARD_POOL-daily.coins))
 daily.events++;daily.coins+=coins;account.gameRewardDaily=daily
 if(coins)wallet(account).coins+=coins
 room.gameRewardTotals??={};room.gameRewardTotals[player]=(room.gameRewardTotals[player]??0)+coins
 return coins
}

/** Pays each human piece capture once as its resolution is committed. */
export function rewardCaptures(room:Room,result:Resolution,findAccount:(name:string)=>Account|undefined,now=Date.now()){
 if(!room.ai&&Object.keys(room.seats).length<2)return
 for(const outcome of result.outcomes){
  if(outcome.status!=='applied'||!outcome.captures.length)continue
  const name=room.seats[outcome.move.player];if(!name||outcome.move.player===room.ai?.player)continue
  const account=findAccount(name);if(!account)continue
  for(const capture of outcome.captures){const coins=credit(account,room,outcome.move.player,now);if(coins)capture.rewardCoins=coins}
 }
}

/** Awards AI-loss participation and sends one totalized coin receipt per human. */
export function settleGameCoinNotices(room:Room,findAccount:(name:string)=>Account|undefined,now=Date.now()){
 const alive=survivors(room.state),finished=alive.length<=1||!!room.state.draw
 if(!finished)return
 if(room.ai&&!room.state.draw&&alive.length===1&&alive[0]===room.ai.player&&room.ai.lossReward===undefined){
  const human=Object.keys(room.seats).map(p=>p as Player).find(p=>p!==room.ai!.player&&room.seats[p])
  const account=human?findAccount(room.seats[human]!):undefined
  room.ai.lossReward=human&&account?credit(account,room,human,now):0
 }
 room.gameRewardNotified??={}
 for(const [rawPlayer,name]of Object.entries(room.seats)){
  const player=rawPlayer as Player
  if(!name||player===room.ai?.player||room.gameRewardNotified[player])continue
  const account=findAccount(name);if(!account)continue
  const total=(room.gameRewardTotals?.[player]??0)+(room.gameSettlementCoins?.[player]??0)
    +(room.ai?.reward&&room.seats[player]===room.owner?room.ai.reward.coins:0)
  const amount=Math.round(total*10000)/10000
  const outcome=room.state.draw?'The game ended in a draw.':survivors(room.state).includes(player)?'You survived the game.':'You were eliminated.'
  notify(account,{kind:'result',code:room.code,title:`You won ${amount} coins from game`,detail:`${room.title}: ${outcome} Your game coin rewards total ${amount} coins.`})
  room.gameRewardNotified[player]=true
 }
}

import type {UnitOfWork} from './storage.ts'
import type {CasinoBet,CasinoRound} from '../src/casino-model.ts'
import {grossMultiplier} from '../src/casino-model.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import {companies,operating,saveCompanies,shortfall,safetyReserve,ratio,type Companies} from './corporate.ts'
import {fail} from './http.ts'

export function casinoTerms(unit:UnitOfWork,now:number){
  const c=companies(unit,now).CAS
  return {houseEdge:c.policy.edge/10000,maxStake:c.policy.stake,open:!!c.policy.open&&!c.bankruptcy&&shortfall(c,now)===0&&c.cash>=safetyReserve(c)+c.obligations}
}
export function acceptWager(unit:UnitOfWork,bet:CasinoBet,now:number){
  const e=companies(unit,now),c=e.CAS
  if(c.bankruptcy||shortfall(c,now)||!c.policy.open)fail(409,'The casino is currently closed to new wagers')
  if(bet.stake>c.policy.stake)fail(409,'This wager exceeds the casino’s maximum stake')
  const stake=toStockUnits(bet.stake)
  const maximum=toStockUnits(bet.stake*grossMultiplier(bet.game,bet.choice,c.policy.edge/10000))
  const cost=ratio(stake,1,1000)
  c.cash+=stake-cost;c.pending+=maximum
  if(shortfall(c,now)||c.cash<safetyReserve(c)+c.obligations)fail(409,'The casino cannot back this payout. Try a smaller stake.')
  operating(c,'Casino stakes',stake,now)
  if(cost)operating(c,'Casino operating expenses',-cost,now)
  saveCompanies(unit,e)
  return maximum
}
export function postPayout(e:Companies,round:CasinoRound,maximum:number,now:number){
  const c=e.CAS,paid=toStockUnits(round.gross)
  c.pending-=maximum;c.cash-=paid
  if(paid)operating(c,'Casino gross payouts',-paid,now)
}
export function settleWager(unit:UnitOfWork,round:CasinoRound,maximum:number,now:number){
  const e=companies(unit,now);postPayout(e,round,maximum,now);saveCompanies(unit,e)
}

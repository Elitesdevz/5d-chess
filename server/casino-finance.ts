import type {UnitOfWork} from './storage.ts'
import type {CasinoBet,CasinoRound} from '../src/casino-model.ts'
import {grossMultiplier} from '../src/casino-model.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import {companies,operating,saveCompanies,shortfall,type Companies} from './corporate.ts'
import {fail} from './http.ts'

export function casinoTerms(unit:UnitOfWork,now:number){
  const c=companies(unit,now).CAS
  return {houseEdge:c.policy.edge/10000,maxStake:c.policy.stake,open:!!c.policy.open&&!c.bankruptcy&&shortfall(c,now)===0}
}
export function acceptWager(unit:UnitOfWork,bet:CasinoBet,now:number){
  const e=companies(unit,now),c=e.CAS
  if(c.bankruptcy||shortfall(c,now)||!c.policy.open)fail(409,'The casino is currently closed to new wagers')
  if(bet.stake>c.policy.stake)fail(409,'This wager exceeds the casino’s maximum stake')
  const stake=toStockUnits(bet.stake)
  const maximum=toStockUnits(bet.stake*grossMultiplier(bet.game,bet.choice,c.policy.edge/10000))
  c.cash+=stake;c.pending+=maximum
  if(shortfall(c,now))fail(409,'The casino cannot back this payout. Try a smaller stake.')
  operating(c,'Casino stakes',stake,now);saveCompanies(unit,e)
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

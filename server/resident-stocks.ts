import {randomUUID} from 'node:crypto'
import {companies,saveCompanies,residentHolder,type Companies,type ListedCompany} from './corporate.ts'
import {book,maintainLotteryMarket,offerInventory,submit} from './order-book.ts'
import type {UnitOfWork} from './storage.ts'

const interval=30*60_000
const symbols=['LOT','BNK','CAS'] as const

// A resident can offer only owned shares. Price above the best bid so a player
// can actually see the offer instead of it immediately crossing a resting bid.
export function offerResidentShares(unit:UnitOfWork,e:Companies,c:ListedCompany,now:number){
  if(book(c,'sell').length)return
  const seller=Object.keys(e.residents).find(id=>c.holders[id]>0)
  if(!seller)return
  const price=Math.max(c.price,(book(c,'buy')[0]?.price??0)+1)
  return submit(unit,e,c,{holder:seller,side:'sell',shares:Math.min(3,c.holders[seller]),price,id:randomUUID()},now)
}
export function advanceResidentStocks(unit:UnitOfWork,now:number){
  const key='residentStockClock'
  const clock=unit.metadata<{next:number;turn:number}>(key)
  if(!clock){unit.putMetadata(key,{next:now+interval,turn:0});return}
  if(now<clock.next)return
  // Resume with one small trade after downtime, without replaying a backlog.
  unit.putMetadata(key,{next:now+interval,turn:clock.turn+1})
  const e=companies(unit,now),c=e[symbols[clock.turn%3]],residents=Object.keys(e.residents)
  const id=residents[Math.floor(clock.turn/3)%residents.length]
  if(c.symbol==='LOT')maintainLotteryMarket(unit,e,now)
  else offerInventory(unit,e,c,now)
  const asks=book(c,'sell'),bid=book(c,'buy')[0],ask=asks[0],held=c.holders[id]??0
  const free=held-asks.filter(o=>o.holder===id).reduce((n,o)=>n+o.shares,0)
  if(free>0&&(Math.floor(clock.turn/(3*residents.length))%2||held>=6)){
    const price=bid&&!residentHolder(bid.holder)?bid.price:Math.max(c.price,(bid?.price??0)+1)
    submit(unit,e,c,{holder:id,side:'sell',shares:Math.min(2,free),price,id:randomUUID()},now)
  }else if(ask&&!residentHolder(ask.holder)&&held<6){
    const shares=Math.min(2,6-held,ask.shares,Math.floor(e.residents[id]/ask.price),asks.reduce((n,o)=>n+o.shares,0)-1)
    if(shares>0)submit(unit,e,c,{holder:id,side:'buy',shares,price:ask.price,id:randomUUID()},now)
  }
  offerResidentShares(unit,e,c,now)
  saveCompanies(unit,e)
}

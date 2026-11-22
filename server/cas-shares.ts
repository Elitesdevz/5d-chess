import {randomInt} from 'node:crypto'
import {dayKey} from '../src/collection.ts'
import type {CasinoRound} from '../src/casino-model.ts'
import {CAS,casOrderTotal,casPrice,fromStockUnits,toStockUnits,type CasPublic,type StockSide} from '../src/stock-model.ts'
import type {Account} from './accounts.ts'
import type {UnitOfWork} from './storage.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'

export const CAS_META='casinoShares'
const MIN_EQUITY=1500,MAX_EQUITY=3000
const nextEquityOrder=(now:number)=>now+randomInt(48,121)*60*60*1000
type CasState=Omit<CasPublic,'price'|'bid'|'ask'> & {
  cash:number
  holders:Record<string,number>
  day:string
  margin:number
  nextEquity:number
}
export const portfolio=(account:Account)=>account.stocks??={sequence:0,positions:{},trades:[],dividends:[],dividendsPaid:0}
const holderKey=(name:string)=>'@'+name

function newState(now:number):CasState{
  return {day:dayKey(now),margin:0,holders:{},cash:toStockUnits(60_000),equity:MAX_EQUITY,float:1000,available:1000,version:1,
    history:[{at:now,price:20}],equityMoves:[],nextEquity:nextEquityOrder(now)}
}

function dividend(unit:UnitOfWork,state:CasState){
  // Apply 30% operating costs and then assign 10% of the remainder to the current float.
  const pool=Math.floor(Math.max(0,state.margin)*7/100)
  let paid=0
  if(pool){
    for(const [key,shares] of Object.entries(state.holders)){
      const amount=Math.floor(pool*shares/state.float)
      if(!amount)continue
      const account=unit.users.get(key.slice(1))
      if(!account)continue
      const w=wallet(account),holdings=portfolio(account),after=toStockUnits(w.coins)+amount
      if(!Number.isSafeInteger(after))continue
      w.coins=fromStockUnits(after)
      holdings.dividends.unshift({day:state.day,shares,amount:fromStockUnits(amount)})
      holdings.dividends.length=Math.min(60,holdings.dividends.length)
      holdings.dividendsPaid=fromStockUnits(toStockUnits(holdings.dividendsPaid)+amount)
      paid+=amount
    }
  }
  state.lastDividend={day:state.day,pool:fromStockUnits(pool),paid:fromStockUnits(paid)}
  state.margin=0
}

function chart(state:CasState,now:number){
  const price=casPrice(state.float,state.available)
  state.version++
  if(state.history.at(-1)?.price!==price)state.history=[...state.history,{at:now,price}].slice(-80)
}

function rebalance(state:CasState,now:number){
  state.nextEquity=nextEquityOrder(now)
  const canSell=state.equity-MIN_EQUITY,canBuy=Math.min(MAX_EQUITY-state.equity,state.available)
  if(!canBuy&&!canSell)return
  const buy=!canSell||canBuy>0&&randomInt(2)===1
  const shares=Math.min(buy?canBuy:canSell,randomInt(100,501))
  const change=buy?-shares:shares
  state.equity-=change
  state.float+=change
  state.available+=change
  state.equityMoves=[{at:now,shares,side:buy?'buy' as const:'sell' as const},...state.equityMoves].slice(0,25)
  chart(state,now)
}

export function casState(unit:UnitOfWork,now:number){
  const saved=unit.metadata<CasState>(CAS_META),state=saved??newState(now),today=dayKey(now)
  let changed=!saved
  if(state.day<today){dividend(unit,state);state.day=today;changed=true}
  if(state.nextEquity<=now){rebalance(state,now);changed=true}
  if(changed)unit.putMetadata(CAS_META,state)
  return state
}

export function casPublic(state:CasState):CasPublic{
  return {equity:state.equity,float:state.float,available:state.available,price:casPrice(state.float,state.available),
    ask:state.available?casOrderTotal(state,'buy',1):0,bid:state.available<state.float?casOrderTotal(state,'sell',1):0,
    version:state.version,history:state.history,equityMoves:state.equityMoves,lastDividend:state.lastDividend}
}

export function casTrade(state:CasState,account:Account,side:StockSide,shares:number,total:number,now:number){
  if(side==='buy'&&shares>state.available)fail(409,'There are fewer CAS shares available now')
  const change=side==='buy'?shares:-shares
  const cash=state.cash+toStockUnits(total)*Math.sign(change)
  if(!Number.isSafeInteger(cash)||cash<0)fail(409,'CAS has reached its available buyback liquidity')
  const held=(portfolio(account).positions[CAS]?.shares??0)+change
  if(held>0)state.holders[holderKey(account.name)]=held
  else delete state.holders[holderKey(account.name)]
  state.cash=cash
  state.available-=change
  chart(state,now)
}

export function recordCasinoMargins(unit:UnitOfWork,rounds:Iterable<CasinoRound>,now=Date.now()){
  const state=casState(unit,now)
  for(const round of rounds)state.margin+=toStockUnits(round.stake)-toStockUnits(round.gross)
  unit.putMetadata(CAS_META,state)
}

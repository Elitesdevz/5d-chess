import {randomUUID} from 'node:crypto'
import {fromStockUnits,toStockUnits,type StockSide} from '../src/stock-model.ts'
import {EQUITY_ORDER_LIMIT} from '../src/equity-v2.ts'
import type {UnitOfWork} from './storage.ts'
import {income,requireSpending,updateCredit,DAY} from './credit.ts'
import {wallet} from './economy.ts'
import {portfolio} from './cas-shares.ts'
import {BUYBACK,INVENTORY,PE,type Companies,type Company,type Order,sharesOf,equityPosition,setHolding,journal,cashForDistribution} from './corporate.ts'
import {fail} from './http.ts'

const priceTime=(side:StockSide)=>(a:Order,b:Order)=>(side==='buy'?b.price-a.price:a.price-b.price)||a.seq-b.seq
export const book=(c:Company,side:StockSide)=>c.orders.filter(o=>o.side===side&&o.shares>0).sort(priceTime(side))
const total=(order:Order)=>order.price*order.shares
export const inventoryAvailable=(c:Company)=>c.inventory-book(c,'sell').filter(o=>o.holder===INVENTORY).reduce((n,o)=>n+o.shares,0)
const institution=(name:string)=>name===INVENTORY||name===BUYBACK||name===PE
const reservedShares=(c:Company,holder:string)=>book(c,'sell').filter(o=>o.holder===holder).reduce((n,o)=>n+o.shares,0)

function receive(unit:UnitOfWork,e:Companies,c:Company,holder:string,units:number,now:number,sale=false){
  if(!units)return
  if(holder===INVENTORY||holder===BUYBACK){
    c.cash+=units
    if(sale)journal(c,'Inventory sold',units,now)
  }else if(holder===PE)e.peCash+=units
  else {
    const account=unit.users.get(holder)??fail(409,'Order owner unavailable')
    if(sale)income(account,units,now)
    else wallet(account).coins=fromStockUnits(toStockUnits(wallet(account).coins)+units)
  }
}
function unlock(unit:UnitOfWork,e:Companies,c:Company,o:Order,now:number){
  if(o.side==='buy'){
    const units=total(o)
    if(o.holder===BUYBACK)c.buybackCash-=units
    receive(unit,e,c,o.holder,units,now)
  }
  o.shares=0
}
export function cancelOrders(unit:UnitOfWork,e:Companies,c:Company,predicate:(o:Order)=>boolean,now:number){
  for(const o of c.orders)if(o.shares&&predicate(o))unlock(unit,e,c,o,now)
}

export function submit(unit:UnitOfWork,e:Companies,c:Company,input:{holder:string;side:StockSide;price:number;shares:number;id:string},now:number){
  const {holder,side,price,shares,id}=input
  const old=c.orders.find(o=>o.id===id&&o.holder===holder)
  if(old){
    if(old.side!==side||old.price!==price||old.initial!==shares)fail(409,'This order ID already belongs to another order')
    return old
  }
  const order:Order={...input,initial:shares,at:now,seq:++c.nextOrder}
  const units=total(order)
  if(!Number.isSafeInteger(shares)||shares<1||shares>EQUITY_ORDER_LIMIT||!Number.isSafeInteger(price)||price<1||!Number.isSafeInteger(units)||units>toStockUnits(100_000_000))fail(400,'Enter a valid limit price and 1–100,000 shares')
  if(side==='sell'){
    const held=holder===INVENTORY?c.inventory:sharesOf(c,holder)
    if(held-reservedShares(c,holder)<shares)fail(409,'Not enough unreserved shares')
  }else if(holder===PE){
    if(e.peCash<units)fail(409,'Insufficient private equity funds')
    e.peCash-=units
  }else if(holder===BUYBACK){
    if(c.bankruptcy||cashForDistribution(c,now)<units)fail(409,'Insufficient free cash for buyback')
    c.cash-=units;c.buybackCash+=units
  }else{
    const owner=unit.users.get(holder)??fail(409,'Order owner unavailable')
    requireSpending(owner,now)
    const w=wallet(owner),balance=toStockUnits(w.coins)
    if(balance<units)fail(409,'Not enough unreserved coins')
    w.coins=fromStockUnits(balance-units)
  }
  c.orders.push(order)
  for(const resting of book(c,side==='buy'?'sell':'buy')){
    if(!order.shares||!(side==='buy'?resting.price<=price:resting.price>=price))break
    const bid=side==='buy'?order:resting,ask=side==='sell'?order:resting
    if(bid.holder===ask.holder||bid.holder===BUYBACK&&ask.holder===INVENTORY){
      unlock(unit,e,c,order,now)
      break
    }
    const buyer=institution(bid.holder)?undefined:unit.users.get(bid.holder)
    if(buyer&&updateCredit(buyer,now).loan?.defaulted){
      unlock(unit,e,c,bid,now)
      if(bid===order)break
      continue
    }
    const key=JSON.stringify([c.symbol,...[bid.holder,ask.holder].sort()])
    const last=e.reversals[key]
    if(!institution(bid.holder)&&!institution(ask.holder)&&last&&last.buyer===ask.holder&&now-last.at<DAY){
      // Stop at the incompatible top order. Skipping it would violate price priority.
      unlock(unit,e,c,order,now)
      break
    }
    const qty=Math.min(bid.shares,ask.shares),execution=resting.price,paid=qty*execution
    bid.shares-=qty;ask.shares-=qty
    if(bid.holder===BUYBACK){
      c.buybackCash-=qty*bid.price
      c.inventory+=qty
      journal(c,'Shares repurchased',-paid,now,qty)
    }else setHolding(c,bid.holder,qty)
    if(buyer)equityPosition(c,buyer,qty,paid)
    if(ask.holder===INVENTORY)c.inventory-=qty
    else setHolding(c,ask.holder,-qty)
    const seller=institution(ask.holder)?undefined:unit.users.get(ask.holder)
    if(seller)equityPosition(c,seller,-qty,0)
    receive(unit,e,c,ask.holder,paid,now,true)
    receive(unit,e,c,bid.holder,qty*(bid.price-execution),now)
    const trade={id:randomUUID(),buy:bid.holder,sell:ask.holder,price:execution,shares:qty,at:now}
    c.trades.push(trade)
    for(const [account,side] of [[buyer,'buy'],[seller,'sell']] as const)if(account){
      const p=portfolio(account)
      p.trades.unshift({id:trade.id,sequence:++p.sequence,symbol:c.symbol,side,shares:qty,total:fromStockUnits(paid),at:now})
    }
    if(!institution(bid.holder)&&!institution(ask.holder))e.reversals[key]={buyer:bid.holder,at:now}
    c.price=execution;c.quotes.push({at:now,price:fromStockUnits(execution)})
    c.quotes=c.quotes.slice(-1000)
  }
  return order
}
export function offerInventory(unit:UnitOfWork,e:Companies,c:Company,now:number){
  let quantity=inventoryAvailable(c)
  while(quantity>0){
    const shares=Math.min(quantity,EQUITY_ORDER_LIMIT)
    submit(unit,e,c,{holder:INVENTORY,side:'sell',price:c.price,shares,id:randomUUID()},now)
    quantity-=shares
  }
}
export function maintainOrders(unit:UnitOfWork,e:Companies,now:number){
  for(const [key,value] of Object.entries(e.reversals))if(now-value.at>=DAY)delete e.reversals[key]
  for(const c of [e.CAS,e.BNK]){
    cancelOrders(unit,e,c,o=>o.side==='buy'&&(o.holder===BUYBACK&&(!!c.bankruptcy||now-o.at>=7*DAY)||
      !institution(o.holder)&&!!unit.users.get(o.holder)?.bank?.loan?.defaulted),now)
    // Add new supply once. Old asks keep their original price and queue priority.
    offerInventory(unit,e,c,now)
  }
}

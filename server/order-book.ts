import {randomUUID} from 'node:crypto'
import {fromStockUnits,toStockUnits,type StockSide} from '../src/stock-model.ts'
import {EQUITY_ORDER_LIMIT} from '../src/equity-v2.ts'
import type {UnitOfWork} from './storage.ts'
import {income,inDefault,requireSpending,updateCredit,DAY} from './credit.ts'
import {wallet} from './economy.ts'
import {portfolio} from './cas-shares.ts'
import {BUYBACK,INVENTORY,PE,holderLabel,residentHolder,type Companies,type ListedCompany,type Order,sharesOf,equityPosition,setHolding,journal,cashForDistribution} from './corporate.ts'
import {fail} from './http.ts'

const priceTime=(side:StockSide)=>(a:Order,b:Order)=>(side==='buy'?b.price-a.price:a.price-b.price)||a.seq-b.seq
export const book=(c:ListedCompany,side:StockSide)=>c.orders.filter(o=>o.side===side&&o.shares>0).sort(priceTime(side))
export const displayOrder=({id,holder,side,price,shares,at}:Order)=>({id,holder:holderLabel(holder),side,price:fromStockUnits(price),shares,at})
export function orderBookView(c:ListedCompany,name:string){
  return {bids:book(c,'buy').slice(0,20).map(displayOrder),asks:book(c,'sell').slice(0,20).map(displayOrder),
    orders:c.orders.filter(o=>o.holder===name&&o.shares).map(displayOrder)}
}
const total=(order:Order)=>order.price*order.shares
export const inventoryAvailable=(c:ListedCompany)=>c.inventory-book(c,'sell').filter(o=>o.holder===INVENTORY).reduce((n,o)=>n+o.shares,0)
const institution=(name:string)=>name===INVENTORY||name===BUYBACK||name===PE||residentHolder(name)
const reservedShares=(c:ListedCompany,holder:string)=>book(c,'sell').filter(o=>o.holder===holder).reduce((n,o)=>n+o.shares,0)

function receive(unit:UnitOfWork,e:Companies,c:ListedCompany,holder:string,units:number,now:number,sale=false){
  if(!units)return
  if(holder===INVENTORY||holder===BUYBACK){
    c.cash+=units
    if(sale)journal(c,'Inventory sold',units,now)
  }else if(residentHolder(holder))e.residents[holder]+=units
  else if(holder===PE)e.peCash+=units
  else {
    const account=unit.users.get(holder)??fail(409,'Order owner unavailable')
    if(sale)income(account,units,now)
    else wallet(account).coins=fromStockUnits(toStockUnits(wallet(account).coins)+units)
  }
}
function unlock(unit:UnitOfWork,e:Companies,c:ListedCompany,o:Order,now:number){
  if(o.side==='buy'){
    const units=total(o)
    if(o.holder===BUYBACK)c.buybackCash-=units
    receive(unit,e,c,o.holder,units,now)
  }
  o.shares=0
}
export function cancelOrders(unit:UnitOfWork,e:Companies,c:ListedCompany,predicate:(o:Order)=>boolean,now:number){
  let changed=false
  for(const o of c.orders)if(o.shares&&predicate(o)){
    changed=true
    if(o.holder!==INVENTORY)unit.economyUsage(institution(o.holder)?undefined:o.holder,'/api/stocks/cancel',
      {action:'order_canceled',reference:o.id,symbol:c.symbol,side:o.side,shares:o.shares,price:fromStockUnits(o.price)},now)
    unlock(unit,e,c,o,now)
  }
  return changed
}

export function submit(unit:UnitOfWork,e:Companies,c:ListedCompany,input:{holder:string;side:StockSide;price:number;shares:number;id:string},now:number,sellAll=false){
  const {holder,side,price,shares,id}=input
  const old=c.orders.find(o=>o.id===id&&o.holder===holder)
  if(old){
    if(old.side!==side||old.price!==price||old.initial!==shares)fail(409,'This order ID already belongs to another order')
    return old
  }
  const order:Order={...input,initial:shares,at:now,seq:++c.nextOrder}
  const units=total(order)
  if(!Number.isSafeInteger(shares)||shares<1||shares>EQUITY_ORDER_LIMIT&&!(sellAll&&side==='sell'&&shares===sharesOf(c,holder))||!Number.isSafeInteger(price)||price<1||!Number.isSafeInteger(units))fail(400,'Enter a valid limit price and 1–100,000 shares')
  if(side==='sell'){
    const held=holder===INVENTORY?c.inventory:sharesOf(c,holder)
    if(held-reservedShares(c,holder)<shares)fail(409,'Not enough unreserved shares')
  }else if(residentHolder(holder)){
    if(!(holder in e.residents)||e.residents[holder]<units)fail(409,'Insufficient resident funds')
    e.residents[holder]-=units
  }else if(holder===PE){
    if(e.peCash<units)fail(409,'Insufficient private equity funds')
    e.peCash-=units
  }else if(holder===BUYBACK){
    if((!('policy' in c)?c.cash:c.bankruptcy?0:cashForDistribution(c,now))<units)fail(409,'Insufficient free cash for buyback')
    c.cash-=units;c.buybackCash+=units
  }else{
    const owner=unit.users.get(holder)??fail(409,'Order owner unavailable')
    requireSpending(owner,now)
    const w=wallet(owner),balance=toStockUnits(w.coins)
    if(balance<units)fail(409,'Not enough unreserved coins')
    w.coins=fromStockUnits(balance-units)
  }
  c.orders.push(order)
  if(holder!==INVENTORY)unit.economyUsage(institution(holder)?undefined:holder,'/api/stocks/order',
    {action:'order_placed',reference:id,symbol:c.symbol,side,shares,price:fromStockUnits(price)},now)
  for(const resting of book(c,side==='buy'?'sell':'buy')){
    if(!order.shares||!(side==='buy'?resting.price<=price:resting.price>=price))break
    const bid=side==='buy'?order:resting,ask=side==='sell'?order:resting
    if(bid.holder===BUYBACK&&ask.holder===INVENTORY)continue
    if(bid.holder===ask.holder){
      unlock(unit,e,c,order,now)
      break
    }
    const buyer=institution(bid.holder)?undefined:unit.users.get(bid.holder)
    if(buyer&&inDefault(updateCredit(buyer,now))){
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
    const fill={action:'order_filled' as const,reference:trade.id,symbol:c.symbol,shares:qty,price:fromStockUnits(execution),coins:fromStockUnits(paid)}
    unit.economyUsage(undefined,'/api/stocks/order',fill,now)
    for(const [account,side] of [[buyer,'buy'],[seller,'sell']] as const)if(account)
      unit.economyUsage(account.name,'/api/stocks/order',{...fill,side},now)
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
export function offerInventory(unit:UnitOfWork,e:Companies,c:ListedCompany,now:number,price=c.price){
  let quantity=inventoryAvailable(c)
  while(quantity>0){
    const shares=Math.min(quantity,EQUITY_ORDER_LIMIT,Math.floor(Number.MAX_SAFE_INTEGER/price))
    submit(unit,e,c,{holder:INVENTORY,side:'sell',price,shares,id:randomUUID()},now)
    quantity-=shares
  }
}
// Only share-sale proceeds back the standing bid. Ticket receipts fund the draw.
export function maintainListingMarket(unit:UnitOfWork,e:Companies,now:number,c:Companies['LOT']|Companies['PRI']=e.LOT){
  const before=c.nextOrder
  const canceled=cancelOrders(unit,e,c,o=>o.side==='buy'&&!institution(o.holder)&&inDefault(unit.users.get(o.holder)?.bank),now)
  offerInventory(unit,e,c,now)
  const bid=Math.max(1,Math.floor(c.price*99/100))
  const reserved=book(c,'buy').filter(o=>o.holder===BUYBACK).reduce((n,o)=>n+o.shares,0)
  const shares=Math.min(c.issued-c.inventory-reserved,Math.floor(c.cash/bid))
  if(shares>0)submit(unit,e,c,{id:randomUUID(),holder:BUYBACK,side:'buy',price:bid,shares},now)
  return canceled||before!==c.nextOrder
}
export function maintainOrders(unit:UnitOfWork,e:Companies,now:number){
  for(const [key,value] of Object.entries(e.reversals))if(now-value.at>=DAY)delete e.reversals[key]
  for(const c of [e.CAS,e.BNK]){
    cancelOrders(unit,e,c,o=>o.side==='buy'&&(o.holder===BUYBACK&&(!!c.bankruptcy||now-o.at>=7*DAY)||
      !institution(o.holder)&&inDefault(unit.users.get(o.holder)?.bank)),now)
    // Add new supply once. Old asks keep their original price and queue priority.
    offerInventory(unit,e,c,now)
  }
}

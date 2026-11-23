import type {Account} from './accounts.ts'
import type {Reply} from './model.ts'
import type {UnitOfWork} from './storage.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import {portfolio} from './cas-shares.ts'
import {companies,saveCompanies,PE,type Company} from './corporate.ts'
import {book,cancelOrders,submit} from './order-book.ts'
import {advanceEconomy,castVote,companyView,rescueSupport,supportPolicy,markSupport} from './governance.ts'
import {income,requireSpending} from './credit.ts'
import {STOCK_QUOTES} from './stock-quotes.ts'
import {STOCK_SYMBOLS} from '../src/stock-catalog.ts'
import {MAX_STOCK_ORDER,QUOTE_MAX_AGE,isEquity,fromStockUnits,toStockUnits,type StockQuote,type StockTrade,type StockView} from '../src/stock-model.ts'

const idFrom=(id:unknown)=>{
  if(typeof id!=='string'||!/^[\w-]{12,80}$/.test(id))fail(400,'A valid order ID is required')
  return id
}
const equityQuote=(c:Company)=>({float:c.issued,available:c.inventory,price:fromStockUnits(c.price),
  ask:fromStockUnits(book(c,'sell')[0]?.price??0),bid:fromStockUnits(book(c,'buy')[0]?.price??0),
  version:c.nextOrder,history:c.quotes,lastDividend:c.lastDividend})

export function stockApi(unit:UnitOfWork,account:Account,path:string,method:string,data:Record<string,unknown>,now=Date.now()):Reply|undefined{
  const read=path==='/api/stocks'&&method==='GET'
  if(!read&&(method!=='POST'||!['trade','order','cancel','support','vote','rescue'].some(k=>path==='/api/stocks/'+k)))return
  const e=companies(unit,now),quotes=unit.metadata<Record<string,StockQuote>>(STOCK_QUOTES)??{}
  const positions=portfolio(account),purse=wallet(account)
  const view=():StockView=>({coins:purse.coins,portfolio:positions,quotes,cas:{...equityQuote(e.CAS),equity:e.CAS.holders[PE]??0,equityMoves:[]},
    bank:equityQuote(e.BNK),companies:{CAS:companyView(e,e.CAS,account.name,now),BNK:companyView(e,e.BNK,account.name,now)},now})
  if(read){
    // Initial offering is created on first read even when using the application without its scheduler.
    if(!e.CAS.nextOrder)advanceEconomy(unit,e,now)
    return {status:200,value:view()}
  }
  const {symbol,side,shares,sequence,total}=data
  const action=path.split('/').at(-1)!
  if(action!=='trade'){
    if(typeof symbol!=='string'||!isEquity(symbol))fail(400,'Choose CAS or BNK')
    const c=e[symbol]
    advanceEconomy(unit,e,now)
    if(action==='order'){
      if((side!=='buy'&&side!=='sell')||typeof shares!=='number'||typeof data.price!=='number')fail(400,'Choose a side, share count and limit price')
      const price=toStockUnits(data.price)
      if(fromStockUnits(price)!==data.price)fail(400,'Use a price in increments of 0.0001 coin')
      submit(unit,e,c,{holder:account.name,side,shares,price,id:idFrom(data.id)},now)
      markSupport(c,now)
    }else if(action==='cancel'){
      const id=idFrom(data.id)
      cancelOrders(unit,e,c,o=>o.id===id&&o.holder===account.name,now)
    }else if(action==='support')supportPolicy(c,account.name,data,now)
    else if(action==='rescue')rescueSupport(c,account.name,data)
    else {
      castVote(e,account.name,data.id,data.choice,now)
      advanceEconomy(unit,e,now)
    }
    saveCompanies(unit,e)
    return {status:200,value:view()}
  }
  const id=idFrom(data.id)
  if(typeof symbol!=='string'||!STOCK_SYMBOLS.has(symbol))fail(400,'Use the company order book for CAS or BNK')
  if(side!=='buy'&&side!=='sell')fail(400,'Choose Buy or Sell')
  if(typeof shares!=='number'||!Number.isSafeInteger(shares)||shares<1||shares>MAX_STOCK_ORDER)fail(400,'Choose 1–1,000 whole shares')
  const previous=positions.trades.find(trade=>trade.id===id)
  if(previous){
    if(previous.sequence!==sequence||previous.symbol!==symbol||previous.side!==side||previous.shares!==shares||previous.total!==total)fail(409,'That order ID belongs to another trade')
    return {status:200,value:{...view(),trade:previous}}
  }
  if(sequence!==positions.sequence+1)fail(409,'Your portfolio changed. Review the order again.')
  const existing=positions.positions[symbol]??{shares:0,cost:0},nextShares=existing.shares+(side==='buy'?shares:-shares)
  if(nextShares<0)fail(409,'You do not own that many shares')
  if(nextShares>100_000)fail(409,'Position limit reached')
  const quote=quotes[symbol]
  if(!quote||now-quote.updated>=QUOTE_MAX_AGE)fail(503,'The price feed is unavailable for this stock')
  if(total!==Math.round(quote.price*100)*shares/100)fail(409,'The quote changed. Review the order again.')
  const units=toStockUnits(total)
  if(side==='buy'){
    requireSpending(account,now)
    const balance=toStockUnits(purse.coins)-units
    if(balance<0)fail(409,'Not enough coins for that order')
    purse.coins=fromStockUnits(balance)
  }else income(account,units,now)
  if(nextShares){
    const cost=side==='buy'?toStockUnits(existing.cost)+units:Math.round(toStockUnits(existing.cost)*nextShares/existing.shares)
    positions.positions[symbol]={shares:nextShares,cost:fromStockUnits(cost)}
  }else delete positions.positions[symbol]
  positions.sequence=sequence
  const trade:StockTrade={id,sequence,symbol,side,shares,total,at:now}
  positions.trades.unshift(trade)
  return {status:200,value:{...view(),trade}}
}

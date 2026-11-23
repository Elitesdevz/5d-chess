import type {Account} from './accounts.ts'
import type {Reply} from './model.ts'
import type {UnitOfWork} from './storage.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import {casPublic,casState,casTrade,CAS_META,portfolio} from './cas-shares.ts'
import {bankState,bankPublic,bankTrade,BANK_META} from './bank.ts'
import {STOCK_QUOTES} from './stock-quotes.ts'
import {STOCK_SYMBOLS} from '../src/stock-catalog.ts'
import {BNK,CAS,MAX_STOCK_ORDER,QUOTE_MAX_AGE,isEquity,equityOrderTotal,fromStockUnits,toStockUnits,type StockOrder,type StockQuote,type StockTrade,type StockView} from '../src/stock-model.ts'

function order(data:Record<string,unknown>):StockOrder{
  const {id,sequence,symbol,side,shares,total,version}=data
  if(typeof id!=='string'||!/^[\w-]{12,80}$/.test(id))fail(400,'A valid order ID is required')
  if(typeof sequence!=='number'||!Number.isSafeInteger(sequence)||sequence<1)fail(400,'A valid order sequence is required')
  if(typeof symbol!=='string'||!isEquity(symbol)&&!STOCK_SYMBOLS.has(symbol))fail(400,'Choose a listed stock')
  if(side!=='buy'&&side!=='sell')fail(400,'Choose Buy or Sell')
  if(typeof shares!=='number'||!Number.isSafeInteger(shares)||shares<1||shares>MAX_STOCK_ORDER)fail(400,'Choose 1–1,000 whole shares')
  if(typeof total!=='number'||!Number.isFinite(total)||total<=0)fail(400,'A valid order total is required')
  if(isEquity(symbol)&&(typeof version!=='number'||!Number.isSafeInteger(version)))fail(400,'Refresh the share quote')
  return {id,sequence,symbol,side,shares,total,version:typeof version==='number'?version:undefined}
}

export function stockApi(unit:UnitOfWork,account:Account,path:string,method:string,data:Record<string,unknown>,now=Date.now()):Reply|undefined{
  const read=path==='/api/stocks'&&method==='GET'
  if(!read&&!(path==='/api/stocks/trade'&&method==='POST'))return
  const state=casState(unit,now),bank=bankState(unit,now),quotes=unit.metadata<Record<string,StockQuote>>(STOCK_QUOTES)??{}
  const positions=portfolio(account),purse=wallet(account)
  const view=():StockView=>({coins:purse.coins,portfolio:positions,quotes,cas:casPublic(state),bank:bankPublic(bank),now})
  if(read)return {status:200,value:view()}

  const request=order(data),{symbol,side,shares}=request
  const previous=positions.trades.find(trade=>trade.id===request.id)
  if(previous){
    if(previous.sequence!==request.sequence||previous.symbol!==symbol||previous.side!==side||previous.shares!==shares||previous.total!==request.total)fail(409,'That order ID belongs to another trade')
    return {status:200,value:{...view(),trade:previous}}
  }
  if(request.sequence!==positions.sequence+1)fail(409,'Your portfolio changed. Review the order again.')
  const existing=positions.positions[symbol]??{shares:0,cost:0}
  const nextShares=existing.shares+(side==='buy'?shares:-shares)
  if(nextShares<0)fail(409,'You do not own that many shares')
  if(nextShares>100_000)fail(409,'Position limit reached')
  let total:number
  if(isEquity(symbol)){
    const issue=symbol===CAS?state:bank
    if(request.version!==issue.version)fail(409,`The ${symbol} quote changed. Review the order again.`)
    if(side==='buy'&&shares>issue.available)fail(409,`There are fewer ${symbol} shares available now`)
    total=equityOrderTotal(symbol,issue,side,shares)
  }else{
    const quote=quotes[symbol]
    if(!quote||now-quote.updated>=QUOTE_MAX_AGE)fail(503,'The price feed is unavailable for this stock')
    total=Math.round(quote.price*100)*shares/100
  }
  if(total!==request.total)fail(409,'The quote changed. Review the order again.')
  const delta=side==='buy'?-toStockUnits(total):toStockUnits(total),balance=toStockUnits(purse.coins)+delta
  if(balance<0)fail(409,'Not enough coins for that order')
  if(!Number.isSafeInteger(balance))fail(409,'This trade exceeds the supported wallet balance')
  if(symbol===CAS){casTrade(state,account,side,shares,total,now);unit.putMetadata(CAS_META,state)}
  if(symbol===BNK){bankTrade(bank,account,side,shares,total,now);unit.putMetadata(BANK_META,bank)}
  purse.coins=fromStockUnits(balance)
  if(nextShares){
    const cost=side==='buy'?toStockUnits(existing.cost)+toStockUnits(total):Math.round(toStockUnits(existing.cost)*nextShares/existing.shares)
    positions.positions[symbol]={shares:nextShares,cost:fromStockUnits(cost)}
  }else delete positions.positions[symbol]
  positions.sequence=request.sequence
  const trade:StockTrade={id:request.id,sequence:request.sequence,symbol,side,shares,total,at:now}
  positions.trades=[trade,...positions.trades].slice(0,100)
  return {status:200,value:{...view(),trade}}
}

import {advanceLottery} from './weekly-lottery.ts'
import {offerResidentShares} from './resident-stocks.ts'
import type {Account} from './accounts.ts'
import type {Reply} from './model.ts'
import type {UnitOfWork} from './storage.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import {portfolio} from './cas-shares.ts'
import {companies,saveCompanies,PE,amsterdamDay,nextAmsterdamMidnight,type ListedCompany} from './corporate.ts'
import {book,displayOrder,orderBookView,cancelOrders,maintainLotteryMarket,submit} from './order-book.ts'
import {advanceEconomy,castVote,companyView,rescueSupport,supportPolicy,markSupport} from './governance.ts'
import {income,requireSpending} from './credit.ts'
import {STOCK_QUOTES} from './stock-quotes.ts'
import {STOCK_SYMBOLS} from '../src/stock-catalog.ts'
import {EQUITY_ORDER_LIMIT} from '../src/equity-v2.ts'
import {bookQuote,MAX_STOCK_ORDER,QUOTE_MAX_AGE,isExchangeStock,fromStockUnits,toStockUnits,type StockQuote,type StockTrade,type StockView} from '../src/stock-model.ts'

let dayBounds={start:0,end:0}
function startOfDay(now:number){
  if(now<dayBounds.start||now>=dayBounds.end){
    const day=amsterdamDay(now)
    let low=now-26*3600_000,high=now
    while(high-low>1){
      const mid=Math.floor((high+low)/2)
      if(amsterdamDay(mid)===day)high=mid;else low=mid
    }
    dayBounds={start:high,end:nextAmsterdamMidnight(high)}
  }
  return dayBounds.start
}
const idFrom=(id:unknown)=>{
  if(typeof id!=='string'||!/^[\w-]{12,80}$/.test(id))fail(400,'A valid order ID is required')
  return id
}
function equityQuote(c:ListedCompany,boundary:number){
  let previousClose=c.quotes.findLast(q=>q.at<boundary)?.price
  if(previousClose===undefined){
    const trade=c.trades.findLast(t=>t.at<boundary)
    if(trade)previousClose=fromStockUnits(trade.price)
  }
  return {float:c.issued,available:c.inventory,price:fromStockUnits(c.price),previousClose,
    ask:fromStockUnits(book(c,'sell')[0]?.price??0),bid:fromStockUnits(book(c,'buy')[0]?.price??0),
    version:c.nextOrder,history:c.quotes,lastDividend:c.lastDividend}
}

export function stockApi(unit:UnitOfWork,account:Account,path:string,method:string,data:Record<string,unknown>,now=Date.now()):Reply|undefined{
  const read=path==='/api/stocks'&&method==='GET'
  if(!read&&(method!=='POST'||!['trade','market','order','cancel','support','vote','rescue'].some(k=>path==='/api/stocks/'+k)))return
  advanceLottery(unit,now)
  const e=companies(unit,now),quotes=unit.metadata<Record<string,StockQuote>>(STOCK_QUOTES)??{}
  const positions=portfolio(account),purse=wallet(account)
  const saleQuotes=()=>{
    const result:Record<string,number>={}
    for(const [ticker,h] of Object.entries(positions.positions)){
      if(isExchangeStock(ticker)){
        const c=e[ticker]
        if(c.orders.some(o=>o.holder===account.name&&o.side==='sell'&&o.shares))continue
        const q=bookQuote(book(c,'buy').map(displayOrder),account.name,h.shares)
        if(q)result[ticker]=q.total
      }else if(quotes[ticker]&&now-quotes[ticker].updated<QUOTE_MAX_AGE)result[ticker]=Math.round(quotes[ticker].price*100)*h.shares/100
    }
    return result
  }
  const dayStart=startOfDay(now)
  const view=():StockView=>({
    dayStart,saleQuotes:saleQuotes(),coins:purse.coins,portfolio:positions,quotes,now,
    lottery:{...equityQuote(e.LOT,dayStart),...orderBookView(e.LOT,account.name)},lotteryDividends:account.resort?.dividends??0,
    cas:{...equityQuote(e.CAS,dayStart),equity:e.CAS.holders[PE]??0,equityMoves:[]},bank:equityQuote(e.BNK,dayStart),
    companies:{CAS:companyView(e,e.CAS,account.name,now),BNK:companyView(e,e.BNK,account.name,now)}
  })
  if(read){
    let changed=maintainLotteryMarket(unit,e,now)
    // Initial offering is created on first read even when using the application without its scheduler.
    if(!e.CAS.nextOrder)advanceEconomy(unit,e,now)
    for(const c of [e.CAS,e.BNK,e.LOT])if(offerResidentShares(unit,e,c,now))changed=true
    if(changed)saveCompanies(unit,e)
    return {status:200,value:view()}
  }
  const {symbol,side,shares,sequence,total}=data
  const action=path.split('/').at(-1)!
  if(action==='market'){
    if(typeof symbol!=='string'||!isExchangeStock(symbol)||side!=='buy'&&side!=='sell'||typeof shares!=='number'||!Number.isSafeInteger(shares)||shares<1||shares>EQUITY_ORDER_LIMIT&&!(data.sellAll===true&&side==='sell'))fail(400,'Choose a share count and trade direction')
    const id=idFrom(data.id),c=e[symbol]
    const trade=(paid:number,at:number):StockTrade=>({id,sequence:positions.sequence,symbol,side,shares,total:paid,at})
    const old=c.orders.find(o=>o.id===id&&o.holder===account.name)
    if(old){
      if(!old.market||old.side!==side||old.initial!==shares||old.market.quote!==total)fail(409,'That order ID belongs to another trade')
      return {status:200,value:{...view(),trade:trade(old.market.total,old.at)}}
    }
    if(c.symbol==='LOT')maintainLotteryMarket(unit,e,now)
    if(data.sellAll&&(side!=='sell'||shares!==positions.positions[symbol]?.shares))fail(409,'Your holding changed. Review the sale again.')
    advanceEconomy(unit,e,now)
    const quote=bookQuote(book(c,side==='buy'?'sell':'buy').map(displayOrder),account.name,shares)
    if(!quote)fail(409,'There is not enough liquidity for this trade. Try fewer shares.')
    if(total!==quote.total)fail(409,'The quote changed. Review the trade again.')
    const offset=c.trades.length
    const order=submit(unit,e,c,{holder:account.name,side,price:toStockUnits(quote.limit),shares,id},now,data.sellAll===true)
    const fills=c.trades.slice(offset)
    if(fills.reduce((n,t)=>n+t.shares,0)!==shares)fail(409,'The trade could not be filled at this price')
    const paid=fromStockUnits(fills.reduce((n,t)=>n+t.shares*t.price,0))
    order.market={quote:quote.total,total:paid}
    if(c.symbol!=='LOT')markSupport(c,now)
    else maintainLotteryMarket(unit,e,now)
    offerResidentShares(unit,e,c,now);saveCompanies(unit,e)
    return {status:200,value:{...view(),trade:trade(paid,now)}}
  }
  if(action!=='trade'){
    if(typeof symbol!=='string'||!isExchangeStock(symbol))fail(400,'Choose an exchange company')
    const c=e[symbol]
    advanceEconomy(unit,e,now)
    if(action==='order'){
      if(c.symbol==='LOT')maintainLotteryMarket(unit,e,now)
      if((side!=='buy'&&side!=='sell')||typeof shares!=='number'||typeof data.price!=='number')fail(400,'Choose a side, share count and limit price')
      const price=toStockUnits(data.price)
      if(fromStockUnits(price)!==data.price)fail(400,'Use a price in increments of 0.0001 coin')
      submit(unit,e,c,{holder:account.name,side,shares,price,id:idFrom(data.id)},now)
      if(c.symbol!=='LOT')markSupport(c,now)
    }else if(action==='cancel'){
      const id=idFrom(data.id)
      cancelOrders(unit,e,c,o=>o.id===id&&o.holder===account.name,now)
    }else if(c.symbol==='LOT')fail(400,'LOT has no shareholder board')
    else if(action==='support'){
      if(supportPolicy(c,account.name,data,now))unit.economyUsage(account.name,'/api/stocks/support',{action:'policy_support',symbol,
        policy:data.policy as string,value:data.value as number,status:data.on?'enabled':'disabled'},now)
    }else if(action==='rescue'){
      if(rescueSupport(c,account.name,data))unit.economyUsage(account.name,'/api/stocks/rescue',{action:'rescue_support',symbol,
        value:data.value as number,status:data.on?'enabled':'disabled'},now)
    }else {
      const vote=castVote(e,account.name,data.id,data.choice,now,c.symbol)
      if(vote)unit.economyUsage(account.name,'/api/stocks/vote',{action:'ballot_vote',reference:vote.id,symbol:vote.symbol,
        policy:vote.policy,value:vote.value,status:vote.votes[account.name]},now)
      advanceEconomy(unit,e,now)
    }
    if(c.symbol==='LOT')maintainLotteryMarket(unit,e,now)
    offerResidentShares(unit,e,c,now);saveCompanies(unit,e)
    return {status:200,value:view()}
  }
  const id=idFrom(data.id)
  if(typeof symbol!=='string'||!STOCK_SYMBOLS.has(symbol))fail(400,'Use the exchange order book for city stocks')
  if(side!=='buy'&&side!=='sell')fail(400,'Choose Buy or Sell')
  if(typeof shares!=='number'||!Number.isSafeInteger(shares)||shares<1||shares>(data.sellAll===true&&side==='sell'?100_000:MAX_STOCK_ORDER))fail(400,'Choose 1–1,000 whole shares')
  const previous=positions.trades.find(trade=>trade.id===id)
  if(previous){
    if(previous.sequence!==sequence||previous.symbol!==symbol||previous.side!==side||previous.shares!==shares||previous.total!==total)fail(409,'That order ID belongs to another trade')
    return {status:200,value:{...view(),trade:previous}}
  }
  if(sequence!==positions.sequence+1)fail(409,'Your portfolio changed. Review the order again.')
  const existing=positions.positions[symbol]??{shares:0,cost:0},nextShares=existing.shares+(side==='buy'?shares:-shares)
  if(data.sellAll&&(side!=='sell'||shares!==existing.shares))fail(409,'Your holding changed. Review the sale again.')
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
  unit.economyUsage(account.name,'/api/stocks/trade',{action:'quoted_stock_trade',reference:id,symbol,side,shares,coins:total,price:quote.price},now)
  return {status:200,value:{...view(),trade}}
}

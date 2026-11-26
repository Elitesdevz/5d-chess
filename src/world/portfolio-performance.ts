import {cityQuote,fromStockUnits,toStockUnits,type StockView} from '../stock-model.ts'

/** Cash flows are in integer stock units so buying or selling at the mark has zero return. */
export function portfolioPerformance(data:StockView){
  const p=data.portfolio
  const flows=new Map<string,{net:number;today:number;sharesToday:number;incomeToday:number;hasPurchase:boolean}>()
  function flow(symbol:string){
    let f=flows.get(symbol)
    if(!f){f={net:0,today:0,sharesToday:0,incomeToday:0,hasPurchase:false};flows.set(symbol,f)}
    return f
  }
  for(const symbol of Object.keys(p.positions))flow(symbol)
  for(const trade of p.trades){
    const f=flow(trade.symbol),direction=trade.side==='buy'?1:-1,cash=-direction*toStockUnits(trade.total)
    if(trade.side==='buy')f.hasPurchase=true
    f.net+=cash
    if(trade.at>=data.dayStart){f.today+=cash;f.sharesToday+=direction*trade.shares}
  }
  const today=new Date(data.dayStart).toLocaleDateString('sv-SE',{timeZone:'Europe/Amsterdam'})
  for(const d of p.dividends){
    const f=flow(d.symbol??'CAS')
    if(d.at===undefined?d.day===today:d.at>=data.dayStart)f.incomeToday+=toStockUnits(d.amount)
  }
  const dividends:Record<string,number>={CAS:p.dividendsPaid,BNK:p.bankDividendsPaid??0,LOT:data.lotteryDividends}
  for(const symbol of Object.keys(dividends))if(dividends[symbol])flow(symbol)
  const complete=p.trades.length===p.sequence
  const todayComplete=complete||p.trades.some(t=>t.at<data.dayStart)
  const rows=Array.from(flows,([symbol,f])=>{
    const holding=p.positions[symbol],shares=holding?.shares??0
    const issue=cityQuote(data,symbol)
    const quote=data.quotes[symbol],mark=issue?.price??quote?.price
    const prior=issue?.previousClose??issue?.history.findLast(q=>q.at<data.dayStart)?.price??
      (quote?.history.findLast(q=>q.at<data.dayStart)?.price??(quote?(quote.updated<data.dayStart?quote.price:quote.price-quote.change):undefined))
    const value=shares===0?0:mark===undefined?undefined:shares*toStockUnits(mark)
    const startShares=shares-f.sharesToday
    const opening=startShares===0?0:prior===undefined?undefined:toStockUnits(prior)*startShares
    const daily=todayComplete&&value!==undefined&&opening!==undefined?value-opening+f.today+f.incomeToday:undefined
    // Imported paid positions may predate their first recorded purchase.
    const basisKnown=!holding?.cost||f.hasPurchase
    const lifetime=complete&&basisKnown&&value!==undefined?value+f.net+toStockUnits(dividends[symbol]??0):undefined
    return {symbol,shares,mark,value,daily,lifetime,cost:holding?.cost??0}
  }).sort((a,b)=>(b.value??0)-(a.value??0)||a.symbol.localeCompare(b.symbol))
  function sum(key:'value'|'daily'|'lifetime'){
    let units=0
    for(const row of rows){const n=row[key];if(n===undefined)return;units+=n}
    return fromStockUnits(units)
  }
  return {rows,value:sum('value'),daily:todayComplete?sum('daily'):undefined,lifetime:complete?sum('lifetime'):undefined,
    dividends:Object.values(dividends).reduce((n,v)=>n+v,0)}
}

import type {ChessStore} from './storage.ts'
import {STOCKS} from '../src/stock-catalog.ts'
import type {StockQuote} from '../src/stock-model.ts'

export const STOCK_QUOTES='stockQuotes'
const URL='https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true'
const marketClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
const marketDay=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',dateStyle:'short'})
const day=(now:number)=>marketDay.format(now)
type Quotes=Record<string,StockQuote>

function marketHours(now:number){
  const fields=Object.fromEntries(marketClock.formatToParts(now).map(({type,value})=>[type,value]))
  const minutes=Number(fields.hour)*60+Number(fields.minute)
  return !['Sat','Sun'].includes(fields.weekday)&&minutes>=8*60&&minutes<=18*60
}
function parseMoney(value:unknown){
  if(typeof value!=='string'||!value.trim())return NaN
  return Number(value.trim().replace(/[$,%]/g,''))
}

export async function fetchStockQuotes(previous:Quotes={},now=Date.now(),signal?:AbortSignal){
  const response=await fetch(URL,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20_000)]):AbortSignal.timeout(20_000),
    headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',accept:'application/json'}})
  if(!response.ok)throw new Error('Nasdaq quote feed returned HTTP '+response.status)
  const body=await response.json() as {status?:{rCode:number};data?:{rows?:{symbol:string;lastsale:string;netchange:string;pctchange:string}[]}}
  if(body.status?.rCode!==200||!Array.isArray(body.data?.rows))throw new Error('Nasdaq returned no stock quotes')
  const bySymbol=new Map(body.data.rows.map(row=>[row.symbol,row]))
  let updated=0
  const quotes={...previous}
  for(const {symbol} of STOCKS){
    const row=bySymbol.get(symbol==='BRK.B'?'BRK/B':symbol)
    const raw=parseMoney(row?.lastsale),change=parseMoney(row?.netchange),percent=parseMoney(row?.pctchange)
    if(!Number.isFinite(raw)||raw<=0||raw>100_000||!Number.isFinite(change)||!Number.isFinite(percent))continue
    const price=Math.round(raw*100)/100
    const before=quotes[symbol]?.history??[]
    const history=[...before]

    const last=history.at(-1)
    if(!last||last.price!==price){
      if(last&&day(last.at)===day(now))history[history.length-1]={at:now,price}
      else history.push({at:now,price})
    }
    quotes[symbol]={price,change,percent,updated:now,history:history.slice(-35)}
    updated++
  }
  if(updated<75)throw new Error(`Nasdaq returned only ${updated} supported prices`)
  return quotes
}

export function startStockQuotes(store:ChessStore){
  const abort=new AbortController()
  let timer:ReturnType<typeof setTimeout>|undefined
  const fetchNext=async()=>{
    let delay=marketHours(Date.now())?15*60_000:75*60_000
    try{
      const quotes=await fetchStockQuotes(store.metadataValue(STOCK_QUOTES) as Quotes|undefined,Date.now(),abort.signal)
      if(!abort.signal.aborted)store.transaction(unit=>unit.putMetadata(STOCK_QUOTES,quotes))
    }catch(error){
      if(!abort.signal.aborted){console.error('Stock quote refresh deferred:',(error as Error).message);delay=5*60_000}
    }
    if(!abort.signal.aborted){timer=setTimeout(fetchNext,delay);timer.unref()}
  }
  void fetchNext()
  return ()=>{abort.abort();clearTimeout(timer)}
}

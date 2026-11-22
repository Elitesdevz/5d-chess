import {STOCK_SYMBOLS} from '../src/stock-catalog.ts'
import type {PricePoint} from '../src/stock-model.ts'
import {fail} from './http.ts'

const HALF_DAY=12*60*60*1000
const date=(time:number)=>new Date(time).toISOString().slice(0,10)
const dollar=(value?:string)=>typeof value==='string'&&value.trim()?Number(value.replace(/[$,]/g,'')):NaN
const headers={accept:'application/json','user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'}
type NasdaqRow={date?:string;close?:string;volume?:string}

export function nasdaqPoints(rows:NasdaqRow[]):PricePoint[]{
  const sessions=new Map<number,PricePoint>()
  for(const row of rows){
    const match=typeof row.date==='string'?/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.date):null
    if(!match)continue
    const label=`${match[3]}-${match[1]}-${match[2]}`,at=Date.parse(label+'T12:00:00Z'),price=dollar(row.close),volume=dollar(row.volume)
    if(!Number.isFinite(at)||date(at)!==label||!Number.isFinite(price)||price<=0||price>100_000)continue
    sessions.set(at,{at,price,volume:Number.isSafeInteger(volume)&&volume>=0?volume:undefined})
  }
  return [...sessions.values()].sort((a,b)=>a.at-b.at).slice(-270)
}

export class StockHistory {
  private cache=new Map<string,{points:PricePoint[];until:number}>()
  private pending=new Map<string,Promise<PricePoint[]>>()
  private retryAfter=new Map<string,number>()
  private abort=new AbortController()
  close(){this.abort.abort()}

  async get(symbol:string,now=Date.now()){
    if(!STOCK_SYMBOLS.has(symbol))fail(404,'Stock not found')
    const saved=this.cache.get(symbol)
    if(saved&&saved.until>now)return saved.points
    const existing=this.pending.get(symbol)
    if(existing)return existing
    if((this.retryAfter.get(symbol)??0)>now||this.pending.size>=4){
      if(saved)return saved.points
      return fail(503,'Price history is temporarily unavailable')
    }
    const task=this.load(symbol,now).then(points=>{
      this.cache.set(symbol,{points,until:now+HALF_DAY})
      this.retryAfter.delete(symbol)
      return points
    }).catch(()=>{
      this.retryAfter.set(symbol,now+5*60_000)
      return saved?.points??fail(503,'Price history is temporarily unavailable')
    }).finally(()=>this.pending.delete(symbol))
    this.pending.set(symbol,task)
    return task
  }
  private async load(symbol:string,now:number){
    const url=new URL('https://api.nasdaq.com/api/quote/'+symbol+'/historical')
    url.search=new URLSearchParams({assetclass:'stocks',fromdate:date(now-370*24*60*60*1000),todate:date(now),limit:'300'}).toString()
    const response=await fetch(url,{headers,signal:AbortSignal.any([AbortSignal.timeout(8500),this.abort.signal])})
    if(!response.ok)throw new Error('Price history request failed')
    const body=await response.json() as {data?:{tradesTable?:{rows?:unknown}}}
    const rows=body.data?.tradesTable?.rows
    const points=Array.isArray(rows)?nasdaqPoints(rows.filter(r=>r&&typeof r==='object')):[]
    if(!points.length)throw new Error('No historical prices')
    return points
  }
}

export const CAS='CAS'
export const CAS_SHARES=10_000
export const MAX_STOCK_ORDER=1_000
export const QUOTE_MAX_AGE=72*60*60*1000
export const STOCK_UNITS=10_000
export type StockSide='buy'|'sell'
export interface StockHolding {shares:number;cost:number}
export interface StockTrade {
  id:string; sequence:number; symbol:string; side:StockSide; shares:number; total:number; at:number
}
export interface StockDividend {day:string;shares:number;amount:number}
export interface StockPortfolio {
  sequence:number; positions:Record<string,StockHolding>; trades:StockTrade[]; dividends:StockDividend[]; dividendsPaid:number
}
export interface PricePoint {at:number;price:number;volume?:number}
export interface StockQuote {price:number;change:number;percent:number;updated:number;history:{at:number;price:number}[]}
export interface CasPublic {
  equity:number; float:number; available:number; price:number; bid:number; ask:number; version:number
  history:{at:number;price:number}[]
  equityMoves:{at:number;shares:number;side:StockSide}[]
  lastDividend?:{day:string;pool:number;paid:number}
}
export interface StockView {
  coins:number; quotes:Record<string,StockQuote>; cas:CasPublic; portfolio:StockPortfolio; now:number
}
export interface StockOrder {symbol:string;side:StockSide;shares:number;total:number;sequence:number;id:string;version?:number}
export const toStockUnits=(coins:number)=>Math.round(coins*STOCK_UNITS)
export const fromStockUnits=(amount:number)=>amount/STOCK_UNITS

/** The next share costs more as players take inventory off the market. */
export function casPrice(publicShares:number,available:number){
  const demand=(publicShares-available)/publicShares
  const addedSupply=(publicShares-1000)/1000
  return Math.round((20+18*demand-7*addedSupply)*100)/100
}
export function casOrderTotal(cas:Pick<CasPublic,'float'|'available'>,side:StockSide,shares:number){
  let totalCents=0
  for(let i=0;i<shares;i++){
    const marginal=casPrice(cas.float,cas.available+(side==='buy'?-i:i+1))
    totalCents+=Math.round(marginal*100)+(side==='buy'?15:-15)
  }
  return totalCents/100
}

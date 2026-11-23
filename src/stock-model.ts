import type {CompanyView} from './equity-v2.ts'
export const CAS='CAS'
export const BNK='BNK'
export type EquitySymbol=typeof CAS|typeof BNK
export const isEquity=(symbol:string):symbol is EquitySymbol=>symbol===CAS||symbol===BNK
export const CAS_SHARES=1_000_000
export const MAX_STOCK_ORDER=1_000
export const QUOTE_MAX_AGE=72*60*60*1000
export const STOCK_UNITS=10_000
export type StockSide='buy'|'sell'
export interface StockHolding {shares:number;cost:number}
export interface StockTrade {
  id:string; sequence:number; symbol:string; side:StockSide; shares:number; total:number; at:number
}
export interface StockDividend {day:string;shares:number;amount:number;symbol?:EquitySymbol}
export interface StockPortfolio {
  sequence:number; positions:Record<string,StockHolding>; trades:StockTrade[]; dividends:StockDividend[]; dividendsPaid:number;bankDividendsPaid?:number
}
export interface PricePoint {at:number;price:number;volume?:number}
export interface StockQuote {price:number;change:number;percent:number;updated:number;history:{at:number;price:number}[]}
export interface EquityPublic { float:number; available:number; price:number; bid:number; ask:number; version:number
  history:{at:number;price:number}[]
  lastDividend?:{day:string;pool:number;paid:number}
}
export interface CasPublic extends EquityPublic {equity:number;equityMoves:{at:number;shares:number;side:StockSide}[]}
export interface StockView {
  coins:number; quotes:Record<string,StockQuote>; cas:CasPublic; bank:EquityPublic; portfolio:StockPortfolio; now:number; companies:Record<EquitySymbol,CompanyView>
}
export interface StockOrder {symbol:string;side:StockSide;shares:number;total:number;sequence:number;id:string;version?:number;price?:number}
export function bookQuote(orders:readonly {shares:number;price:number;holder:string}[],owner:string,shares:number){
  let left=shares,units=0,limit=0
  for(const order of orders){
    // The matching engine protects price priority and rejects an order that would cross its own.
    if(order.holder===owner)return
    const quantity=Math.min(left,order.shares)
    limit=toStockUnits(order.price);units+=quantity*limit;left-=quantity
    if(!left)return {total:fromStockUnits(units),limit:fromStockUnits(limit)}
  }
}
export const toStockUnits=(coins:number)=>Math.round(coins*STOCK_UNITS)
export const fromStockUnits=(amount:number)=>amount/STOCK_UNITS

/** The next share costs more as players take inventory off the market. */
export function casPrice(publicShares:number,available:number){
  const demand=(publicShares-available)/publicShares
  const addedSupply=(publicShares-1000)/1000
  return Math.round((20+18*demand-7*addedSupply)*100)/100
}
export function equityPrice(symbol:EquitySymbol,issue:Pick<EquityPublic,'float'|'available'>){
  return symbol===CAS?casPrice(issue.float,issue.available):Math.round((16+11*(issue.float-issue.available)/issue.float)*100)/100
}
export function equityOrderTotal(symbol:EquitySymbol,issue:Pick<EquityPublic,'float'|'available'>,side:StockSide,shares:number){
  let totalCents=0
  for(let i=0;i<shares;i++){
    const marginal=equityPrice(symbol,{float:issue.float,available:issue.available+(side==='buy'?-i:i+1)})
    totalCents+=Math.round(marginal*100)+(side==='buy'?15:-15)
  }
  return totalCents/100
}

export const casOrderTotal=(issue:Pick<EquityPublic,'float'|'available'>,side:StockSide,shares:number)=>equityOrderTotal(CAS,issue,side,shares)

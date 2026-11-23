import {randomUUID} from 'node:crypto'
import {dayKey,midnight} from '../src/collection.ts'
import {BANK_DIVIDEND_PERCENT,BANK_MAX_INTEREST_PERCENT,BANK_MAX_LOAN,BANK_MIN_LOAN,BANK_OVERDUE_BPS,BANK_PUBLIC_SHARES,BANK_TERMS,type BankLoanView,type BankReceipt,type BankTerm,type BankView} from '../src/bank-model.ts'
import {BNK,equityOrderTotal,equityPrice,fromStockUnits,toStockUnits,type EquityPublic,type StockSide} from '../src/stock-model.ts'
import type {Account} from './accounts.ts'
import type {UnitOfWork} from './storage.ts'
import type {Reply} from './model.ts'
import {payEquityDividend,portfolio} from './cas-shares.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'

const DAY=86_400_000
const dayNumber=(now:number)=>Math.floor(Date.parse(dayKey(now))/DAY)
const dayDate=(day:number)=>new Date(day*DAY).toISOString().slice(0,10)
export const BANK_META='bankExchange'
type BankExchange=Omit<EquityPublic,'price'|'bid'|'ask'>&{
  reserve:number; marketCash:number; day:string; collectedInterest:number; holders:Record<string,number>
}
type Loan={id:string;days:BankTerm;original:number;principal:number;interest:number;charged:number;opened:number;lastDay:number;dueDay:number}
export interface BankAccount {loan?:Loan;sequence:number;receipts:BankReceipt[]}

export function bankState(unit:UnitOfWork,now=Date.now()){
  const today=dayKey(now)
  const saved=unit.metadata<BankExchange>(BANK_META)
  const state=saved??{reserve:toStockUnits(120_000),marketCash:toStockUnits(50_000),day:today,collectedInterest:0,
    holders:{},float:BANK_PUBLIC_SHARES,available:BANK_PUBLIC_SHARES,version:1,history:[{at:now,price:16}]}
  if(state.day<today){
    const pool=Math.floor(state.collectedInterest*BANK_DIVIDEND_PERCENT/100)
    const paid=pool?payEquityDividend(unit,BNK,state.day,state.float,state.holders,pool):0
    state.lastDividend={day:state.day,pool:fromStockUnits(pool),paid:fromStockUnits(paid)}
    state.reserve+=state.collectedInterest-paid
    state.day=today
    state.collectedInterest=0
    unit.putMetadata(BANK_META,state)
  }else if(!saved)unit.putMetadata(BANK_META,state)
  return state
}

export function bankPublic(state:BankExchange):EquityPublic{
  const {float,available,version,history,lastDividend}=state
  return {float,available,version,history,lastDividend,price:equityPrice(BNK,state),
    bid:available<float?equityOrderTotal(BNK,state,'sell',1):0,ask:available?equityOrderTotal(BNK,state,'buy',1):0}
}
export function bankTrade(state:BankExchange,account:Account,side:StockSide,shares:number,total:number,now:number){
  const delta=side==='buy'?shares:-shares
  const cash=state.marketCash+Math.sign(delta)*toStockUnits(total)
  if(!Number.isSafeInteger(cash)||cash<0)fail(409,'The bank has reached its buyback limit')
  const key='@'+account.name,held=(portfolio(account).positions[BNK]?.shares??0)+delta
  if(held)state.holders[key]=held
  else delete state.holders[key]
  state.available-=delta
  state.marketCash=cash
  state.version++
  const price=equityPrice(BNK,state)
  if(price!==state.history.at(-1)?.price)state.history=[...state.history,{at:now,price}].slice(-80)
}

function updateInterest(loan:Loan,now:number):Loan{
  const today=dayNumber(now)
  const termDays=Math.max(0,Math.min(today,loan.dueDay)-loan.lastDay)
  const lateDays=Math.max(0,today-Math.max(loan.dueDay,loan.lastDay))
  const rate=BANK_TERMS.find(t=>t.days===loan.days)!.basisPoints
  const interest=Math.min(Math.floor(loan.original*BANK_MAX_INTEREST_PERCENT/100)-loan.charged,
    termDays*Math.floor(loan.principal*rate/10_000)+lateDays*Math.floor(loan.principal*BANK_OVERDUE_BPS/10_000))
  return {...loan,interest:loan.interest+interest,charged:loan.charged+interest,lastDay:Math.max(loan.lastDay,today)}
}
function loanView(loan:Loan,now:number):BankLoanView{
  return {id:loan.id,days:loan.days,original:fromStockUnits(loan.original),principal:fromStockUnits(loan.principal),
    interest:fromStockUnits(loan.interest),total:fromStockUnits(loan.principal+loan.interest),
    opened:loan.opened,due:midnight(dayDate(loan.dueDay+1))-1,overdue:dayNumber(now)>loan.dueDay}
}

export function bankApi(unit:UnitOfWork,account:Account,path:string,method:string,data:Record<string,unknown>,now=Date.now()):Reply|undefined{
  const read=path==='/api/bank'&&method==='GET',
    borrow=path==='/api/bank/borrow'&&method==='POST',
    repay=path==='/api/bank/repay'&&method==='POST'
  if(!read&&!borrow&&!repay)return
  const exchange=bankState(unit,now),client=account.bank??={sequence:0,receipts:[]},purse=wallet(account)
  let loan=client.loan?updateInterest(client.loan,now):undefined
  const limit=()=>loan?0:Math.min(BANK_MAX_LOAN,Math.floor(purse.coins/2),Math.floor(fromStockUnits(exchange.reserve)))
  const view=():BankView=>({coins:purse.coins,limit:Math.max(0,limit()),reserve:fromStockUnits(exchange.reserve),
    loan:loan?loanView(loan,now):undefined,receipts:client.receipts,sequence:client.sequence,now})
  if(read)return {status:200,value:view()}
  const {id,sequence}=data,requested=repay&&data.amount===null?null:data.amount
  if(typeof id!=='string'||!/^[\w-]{12,80}$/.test(id)||typeof sequence!=='number'||!Number.isSafeInteger(sequence))fail(400,'Invalid bank request')
  if(requested!==null&&(typeof requested!=='number'||!Number.isFinite(requested)||requested<=0||requested>20_000))fail(400,'Enter a valid coin amount')
  const kind=borrow?'borrow':'repay',match=client.receipts.find(r=>r.id===id)
  if(match){
    if(match.sequence!==sequence||match.kind!==kind||match.requested!==requested||(borrow&&match.days!==data.days))fail(409,'That request ID belongs to another transaction')
    return {status:200,value:{...view(),receipt:match}}
  }
  if(sequence!==client.sequence+1)fail(409,'Your bank ledger changed. Review the transaction again.')
  const balance=toStockUnits(purse.coins)
  let amount:number,interest=0
  if(borrow){
    const term=BANK_TERMS.find(t=>t.days===data.days)
    if(!term)fail(400,'Choose a loan term')
    if(loan)fail(409,'Repay your current loan before borrowing again')
    if(typeof requested!=='number'||!Number.isSafeInteger(requested)||requested<BANK_MIN_LOAN||requested>limit())fail(409,'Choose an amount within your borrowing limit')
    amount=toStockUnits(requested)
    if(!Number.isSafeInteger(balance+amount))fail(409,'This loan exceeds the wallet limit')
    const today=dayNumber(now)
    loan={id:randomUUID(),days:term.days,original:amount,principal:amount,interest:0,charged:0,opened:now,lastDay:today,dueDay:today+term.days}
    exchange.reserve-=amount
    purse.coins=fromStockUnits(balance+amount)
  }else{
    if(!loan)fail(409,'You have no active loan')
    const due=loan.principal+loan.interest
    amount=requested===null?due:toStockUnits(requested as number)
    if(amount<=0||amount>due)fail(409,'Payment exceeds the balance due')
    if(balance<amount)fail(409,'Not enough coins to make that payment')
    interest=Math.min(amount,loan.interest)
    const principal=amount-interest
    exchange.collectedInterest+=interest
    exchange.reserve+=principal
    purse.coins=fromStockUnits(balance-amount)
    loan.principal-=principal
    loan.interest-=interest
    if(loan.principal===0&&loan.interest===0)loan=undefined
  }
  client.sequence=sequence
  client.loan=loan
  const receipt:BankReceipt={id,sequence,kind,requested:requested as number|null,amount:fromStockUnits(amount),interest:fromStockUnits(interest),at:now,days:borrow?loan?.days:undefined}
  client.receipts=[receipt,...client.receipts].slice(0,60)
  unit.putMetadata(BANK_META,exchange)
  return {status:200,value:{...view(),receipt}}
}

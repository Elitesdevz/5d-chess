import type {EconomicAccount as Account} from './economy.ts'
import {BANK_TERMS,type BankReceipt,type BankTerm} from '../src/bank-model.ts'
import {dayKey,midnight} from '../src/collection.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import type {EconomyUsage} from './economy-usage.ts'
import {fail} from './http.ts'

export const DAY=86_400_000
export const tiers=[{score:600,limit:500,rate:18},{score:650,limit:1500,rate:14},{score:700,limit:3500,rate:11},{score:750,limit:7000,rate:8},{score:800,limit:12000,rate:5}]
export const creditTier=(score:number)=>tiers.findLast(t=>score>=t.score)
export type Loan={
  id:string;days:BankTerm;original:number;principal:number;interest:number;charged:number;opened:number
  dueDay?:number;lastDay?:number;due?:number;lastAccrual?:number;rate?:number;late?:boolean;defaulted?:boolean
}
export interface BankAccount {
  loan?:Loan;sequence:number;receipts:BankReceipt[];score?:number;positive?:number[]
  blockedUntil?:number;recoveryAt?:number
}
export function creditAccount(account:Account){
  const bank=account.bank??={sequence:0,receipts:[]}
  bank.score??=620
  return bank as BankAccount & {score:number}
}
type Collections={principal:number;interest:number;loss:number;recovered:number;events:{at:number;details:EconomyUsage}[]}
const pending=new WeakMap<Account,Collections>()
function ledger(account:Account){
  let record=pending.get(account)
  if(!record){record={principal:0,interest:0,loss:0,recovered:0,events:[]};pending.set(account,record)}
  return record
}
export function collections(account:Account){
  const record=pending.get(account)
  pending.delete(account)
  return record
}

export function migrateLoan(loan:Loan){
  if(loan.due!==undefined)return
  const day=(n:number)=>new Date(n*DAY).toISOString().slice(0,10)
  loan.due=midnight(day(loan.dueDay!+1))-1
  loan.lastAccrual=midnight(day(loan.lastDay!))
  // Carry the old contract's fixed rate across the split.
  loan.rate=({3:60,7:45,14:35} as Record<number,number>)[loan.days]??18
}
function creditEvent(account:Account,details:EconomyUsage,at:number){
  ledger(account).events.push({at,details:{symbol:'BNK',...details}})
}
export function updateCredit(account:Account,now:number){
  const bank=creditAccount(account),loan=bank.loan
  if(!loan){
    if(bank.recoveryAt&&now>=bank.recoveryAt&&bank.score<600){
      const steps=1+Math.floor((now-bank.recoveryAt)/(14*DAY))
      bank.score=Math.min(600,bank.score+steps*10);bank.recoveryAt+=steps*14*DAY
      creditEvent(account,{action:'credit_changed',score:bank.score},now)
    }
    return bank
  }
  migrateLoan(loan)
  const last=loan.lastAccrual!,due=loan.due!,rate=loan.rate!
  if(loan.lastDay!==undefined){
    // The original contracts accrued at Dutch midnight. Preserve that calendar.
    const today=Math.floor(Date.parse(dayKey(now))/DAY),lastDay=loan.lastDay
    const term=Math.max(0,Math.min(today,loan.dueDay!)-lastDay)
    const late=Math.max(0,today-Math.max(loan.dueDay!,lastDay))
    const charge=Math.min(Math.floor(loan.original/4)-loan.charged,
      term*Math.floor(loan.principal*rate/10000)+late*Math.floor(loan.principal*(rate+10)/10000))
    loan.charged+=charge;loan.interest+=charge;loan.lastDay=Math.max(today,lastDay)
  }else{
    const days=Math.max(0,Math.floor((now-last)/DAY)),regular=Math.min(days,Math.max(0,Math.floor((due-last)/DAY)))
    const charge=Math.min(Math.floor(loan.original/4)-loan.charged,
      regular*Math.floor(loan.principal*rate/10000)+(days-regular)*Math.floor(loan.principal*(rate+10)/10000))
    loan.interest+=charge;loan.charged+=charge;loan.lastAccrual=last+days*DAY
  }
  if(now>due+DAY&&!loan.late){bank.score=Math.max(300,bank.score-80);loan.late=true;creditEvent(account,{action:'credit_changed',score:bank.score},now)}
  if(now>=due+7*DAY&&!loan.defaulted){
    bank.score=Math.max(300,bank.score-120);loan.defaulted=true;ledger(account).loss+=loan.principal
    creditEvent(account,{action:'loan_default',reference:loan.id,score:bank.score,coins:fromStockUnits(loan.principal+loan.interest)},now)
  }
  return bank
}
export function requireSpending(account:Account,now=Date.now()){
  if(updateCredit(account,now).loan?.defaulted)fail(409,'Repay the defaulted loan before making new purchases or wagers')
}
export function collect(account:Account,amount:number,now:number,automatic=false){
  const bank=creditAccount(account),loan=bank.loan!
  const interest=Math.min(amount,loan.interest),principal=amount-interest,flow=ledger(account)
  flow.interest+=interest;flow.principal+=principal
  if(loan.defaulted)flow.recovered+=principal
  loan.interest-=interest;loan.principal-=principal
  if(!loan.interest&&!loan.principal){
    bank.loan=undefined
    if(loan.defaulted){bank.blockedUntil=now+30*DAY;bank.recoveryAt=bank.blockedUntil+14*DAY}
    else if(loan.late&&bank.score<600){bank.recoveryAt=now+14*DAY}
    else if(now<=loan.due!&&loan.original>=toStockUnits(300)&&loan.days>=7&&now-loan.opened>=loan.days*DAY/2){
      const positive=(bank.positive??[]).filter(at=>at>now-30*DAY)
      if(positive.length<2&&(!positive.length||now-positive.at(-1)!>=14*DAY)){
        bank.score=Math.min(850,bank.score+15);bank.positive=[...positive,now]
        creditEvent(account,{action:'credit_changed',score:bank.score},now)
      }
    }
  }
  if(automatic){
    creditEvent(account,{action:'debt_collection',reference:loan.id,coins:fromStockUnits(amount),interest:fromStockUnits(interest)},now)
    const sequence=++bank.sequence
    bank.receipts=[{id:'collection-'+sequence,sequence,kind:'collection',requested:null,amount:fromStockUnits(amount),interest:fromStockUnits(interest),at:now},...bank.receipts]
  }
  return interest
}
// Every income path uses integer units so default collection and wallet credit commit together.
export function income(account:Account,units:number,now=Date.now()){
  if(!Number.isSafeInteger(units)||units<0)throw new Error('Invalid coin credit')
  let swept=0
  if(account.bank?.loan){
    const loan=updateCredit(account,now).loan!
    if(loan.defaulted){
      swept=Math.min(Math.floor(units/4),loan.principal+loan.interest)
      if(swept)collect(account,swept,now,true)
    }
  }
  const w=account.wallet!
  const balance=toStockUnits(w.coins)+units-swept
  if(!Number.isSafeInteger(balance))fail(409,'Wallet limit reached')
  w.coins=fromStockUnits(balance)
  return units-swept
}
export const validTerm=(days:unknown):days is BankTerm=>BANK_TERMS.some(t=>t.days===days)

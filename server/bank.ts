import {randomUUID} from 'node:crypto'
import {BANK_MIN_LOAN,type BankLoanView,type BankReceipt,type BankView} from '../src/bank-model.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import type {Account} from './accounts.ts'
import type {UnitOfWork} from './storage.ts'
import type {Reply} from './model.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import {creditTier,updateCredit,collect,inDefault,loansFor,validTerm,DAY,type Loan} from './credit.ts'
import {companies,journal,lendable,postCreditCollections,saveCompanies} from './corporate.ts'
export type {BankAccount} from './credit.ts'

function loanView(loan:Loan,now:number):BankLoanView{
  return {id:loan.id,days:loan.days,original:fromStockUnits(loan.original),principal:fromStockUnits(loan.principal),
    interest:fromStockUnits(loan.interest),total:fromStockUnits(loan.principal+loan.interest),
    opened:loan.opened,due:loan.due!,overdue:now>loan.due!,rate:loan.rate!/100,defaulted:!!loan.defaulted}
}

export function bankApi(unit:UnitOfWork,account:Account,path:string,method:string,data:Record<string,unknown>,now=Date.now()):Reply|undefined{
  const read=path==='/api/bank'&&method==='GET'
  const borrow=path==='/api/bank/borrow'&&method==='POST'
  const repay=path==='/api/bank/repay'&&method==='POST'
  if(!read&&!borrow&&!repay)return
  let economy=companies(unit,now)
  const bank=updateCredit(account,now),purse=wallet(account)
  const tier=creditTier(bank.score)
  const limit=()=>{
    const active=loansFor(bank)
    if((bank.blockedUntil??0)>now||active.some(l=>l.due!<now)||inDefault(bank))return 0
    const exposure=active.reduce((sum,l)=>sum+l.principal+l.interest,0)
    const capacity=(tier?.limit??0)*Math.max(.55,1-active.length*.075)
    return Math.max(0,Math.floor(Math.min(capacity-fromStockUnits(exposure),fromStockUnits(lendable(economy.BNK,now)))))
  }
  const rate=(tier?.rate??0)+economy.BNK.policy.rates
  const view=():BankView=>({coins:purse.coins,limit:limit(),reserve:fromStockUnits(economy.BNK.cash),score:bank.score,rate:rate/100,
    blockedUntil:bank.blockedUntil,recoveryAt:bank.recoveryAt,lendingOpen:!economy.BNK.bankruptcy&&!!economy.BNK.policy.open,
    loan:bank.loan?loanView(bank.loan,now):undefined,loans:loansFor(bank).map(l=>loanView(l,now)),receipts:bank.receipts,sequence:bank.sequence,now})
  if(read)return {status:200,value:view()}
  const {id,sequence}=data,requested=repay&&data.amount===null?null:data.amount
  if(typeof id!=='string'||!/^[\w-]{12,80}$/.test(id)||typeof sequence!=='number'||!Number.isSafeInteger(sequence))fail(400,'Invalid bank request')
  const kind=borrow?'borrow':'repay',match=bank.receipts.find(r=>r.id===id)
  if(match){
    if(match.sequence!==sequence||match.kind!==kind||match.requested!==requested||(borrow&&match.days!==data.days)||(repay&&data.loanId!==undefined&&match.loanId!==data.loanId))fail(409,'That request ID belongs to another transaction')
    return {status:200,value:{...view(),receipt:match}}
  }
  if(sequence!==bank.sequence+1)fail(409,'Your bank ledger changed. Review the transaction again.')
  if(requested!==null&&(typeof requested!=='number'||!Number.isFinite(requested)||requested<=0||requested>100_000))fail(400,'Enter a valid coin amount')
  const balance=toStockUnits(purse.coins)
  let loan=loansFor(bank).find(l=>data.loanId===undefined||l.id===data.loanId)
  let amount:number,interest=0
  if(borrow){
    const days=data.days
    if(!validTerm(days))fail(400,'Choose a loan term')
    if(typeof requested!=='number'||!Number.isSafeInteger(requested)||requested<BANK_MIN_LOAN||requested>limit())fail(409,'Choose an amount within your credit and the bank’s lending limits')
    amount=toStockUnits(requested)
    if(!Number.isSafeInteger(balance+amount))fail(409,'This loan exceeds the wallet limit')
    loan={id:randomUUID(),days,original:amount,principal:amount,interest:0,charged:0,opened:now,lastAccrual:now,due:now+days*DAY,rate}
    if(bank.loan)(bank.additionalLoans??=[]).push(loan)
    else bank.loan=loan
    economy.BNK.cash-=amount;economy.BNK.receivables+=amount
    journal(economy.BNK,'Personal loan issued',-amount,now)
    purse.coins=fromStockUnits(balance+amount)
    saveCompanies(unit,economy)
  }else{
    if(!loan)fail(409,'Choose an active loan')
    const due=loan.principal+loan.interest
    amount=requested===null?due:toStockUnits(requested as number)
    if(amount<=0||amount>due)fail(409,'Payment exceeds the balance due')
    if(balance<amount)fail(409,'Not enough coins to make that payment')
    interest=collect(account,amount,now,false,loan.id)
    purse.coins=fromStockUnits(balance-amount)
    postCreditCollections(unit,[account],now)
    economy=companies(unit,now)
  }
  bank.sequence=sequence
  const receipt:BankReceipt={id,sequence,kind,loanId:loan.id,requested:requested as number|null,amount:fromStockUnits(amount),interest:fromStockUnits(interest),at:now,days:borrow?loan.days:undefined}
  bank.receipts=[receipt,...bank.receipts]
  unit.economyUsage(account.name,'/api/bank/'+kind,{action:borrow?'loan_opened':'loan_payment',symbol:'BNK',reference:loan.id,coins:receipt.amount,
    interest:receipt.interest,days:receipt.days,score:bank.score,value:borrow?rate/100:undefined},now)
  return {status:200,value:{...view(),receipt}}
}

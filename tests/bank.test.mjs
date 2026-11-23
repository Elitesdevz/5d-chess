import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {bankApi} from '../server/bank.ts'
import {stockApi} from '../server/stock-api.ts'
import {BNK,equityOrderTotal} from '../src/stock-model.ts'
import {nextReset} from '../src/collection.ts'

const now=Date.parse('2026-11-23T15:00:00Z')
const borrow={id:'bank-loan-fixture',sequence:1,amount:1000,days:7}
function fixture(t){
  const store=new ChessStore('.',{memory:true})
  t.after(()=>store.close())
  store.transaction(unit=>{
    for(const name of ['Alice','Bob'])unit.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:10000,inventory:[],loadout:{icon:'default',pieces:{}}}})
  })
  const bank=(name,action='',data={},time=now)=>store.transaction(unit=>bankApi(unit,unit.users.get(name),'/api/bank'+action,action?'POST':'GET',data,time).value)
  const stock=(name,order,time=now)=>store.transaction(unit=>stockApi(unit,unit.users.get(name),order?'/api/stocks/trade':'/api/stocks',order?'POST':'GET',order??{},time).value)
  return {bank,stock}
}

test('loans reserve funds once, accrue on the unpaid principal and repay interest first',t=>{
  const {bank}=fixture(t)
  const opening=bank('Alice')
  assert.equal(opening.limit,5000)
  const issued=bank('Alice','/borrow',borrow)
  assert.equal(issued.coins,11000)
  assert.equal(issued.reserve,opening.reserve-1000)
  assert.deepEqual(bank('Alice','/borrow',borrow),issued)
  assert.throws(()=>bank('Alice','/borrow',{...borrow,id:'bank-second-loan',sequence:2}),{status:409})
  const day2=nextReset(now)+10
  const accrued=bank('Alice','',{},day2)
  assert.equal(accrued.loan.interest,4.5)
  const repaid=bank('Alice','/repay',{id:'bank-part-payment',sequence:2,amount:100},day2)
  assert.equal(repaid.receipt.interest,4.5)
  assert.equal(repaid.loan.principal,904.5)
  assert.equal(repaid.loan.interest,0)
  assert.equal(repaid.reserve,opening.reserve-904.5)
  const cleared=bank('Alice','/repay',{id:'bank-full-payment',sequence:3,amount:null},day2)
  assert.equal(cleared.loan,undefined)
  assert.equal(cleared.coins,9995.5)
})

test('bank interest is capped and borrowing limits are enforced by the server',t=>{
  const {bank}=fixture(t)
  assert.throws(()=>bank('Alice','/borrow',{...borrow,amount:5001}),{status:409})
  bank('Alice','/borrow',borrow)
  const overdue=bank('Alice','',{},now+120*86400000)
  assert.equal(overdue.loan.overdue,true)
  assert.equal(overdue.loan.interest,250)
  assert.equal(overdue.loan.total,1250)
})

test('BNK shares allocate collected interest once and keep casino dividends separate',t=>{
  const {bank,stock}=fixture(t)
  const issue=stock('Bob').bank
  const order={id:'bank-share-buy-one',sequence:1,symbol:BNK,side:'buy',shares:100,total:equityOrderTotal(BNK,issue,'buy',100),version:issue.version}
  const bought=stock('Bob',order)
  assert.equal(bought.bank.available,900)
  assert.equal(bought.portfolio.positions.BNK.shares,100)
  assert.throws(()=>stock('Alice',{...order,id:'bank-share-stale'}),{status:409})
  bank('Alice','/borrow',borrow)
  const payment=nextReset(now)+50
  bank('Alice','/repay',{id:'bank-final-payment',sequence:2,amount:null},payment)
  const payout=nextReset(payment)+50
  const settled=stock('Bob',undefined,payout)
  assert.equal(settled.bank.lastDividend.pool,1.125)
  assert.equal(settled.bank.lastDividend.paid,.1125)
  assert.equal(settled.portfolio.bankDividendsPaid,.1125)
  assert.equal(settled.portfolio.dividendsPaid,0)
  assert.equal(settled.portfolio.dividends[0].symbol,BNK)
  assert.deepEqual(stock('Bob',undefined,payout),settled)
  const sold=stock('Bob',{...order,id:'bank-share-sold',sequence:2,side:'sell',total:equityOrderTotal(BNK,settled.bank,'sell',100),version:settled.bank.version},payout)
  assert.equal(sold.bank.available,1000)
  assert.equal(sold.portfolio.positions.BNK,undefined)
})
